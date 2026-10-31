import { createVersionManager, seedBetaData, versionDataDirectory } from './versions/manager.mjs'
import { createVersionSource, versionChannel } from './versions/source.mjs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, net, protocol, shell, Tray } from 'electron'
import updaterModule from 'electron-updater'
import { createApp } from '../server/app.mjs'
import { createStreamDockManager, createStreamDockPaths } from './stream-dock/manager.mjs'
import { createProjectChatPluginCompiler } from './stream-dock/compiler.mjs'
import { createStreamDockProcessAdapter } from './stream-dock/processes.mjs'
import { createUpdateController } from './updater.mjs'
import { loadDesktopPreferences, saveDesktopPreferences } from './preferences.mjs'
import { loginItemQuery, loginItemUpdate, wasLaunchedAtLogin } from './startup.mjs'
import { windowThemes } from './window-theme.mjs'
import { createDesktopIpcHandler, isTrustedPanelUrl } from './security.mjs'
import { createErrorJournal } from '../server/diagnostics.mjs'
import { presentError } from '../public/error-messages.js'

const { autoUpdater } = updaterModule
const preload = fileURLToPath(new URL('./preload.cjs', import.meta.url))
const developmentIcon = fileURLToPath(new URL('../build/icon-source.png', import.meta.url))
const trayIconPath = fileURLToPath(new URL(process.platform === 'darwin' ? '../build/tray-icon-template.png' : '../build/tray-icon.png', import.meta.url))
let serverApp
let mainWindow
let streamDock
let tray
let isQuitting = false
let revealMainWindow
let desktopPreferences = { runInBackground: false }
const trace = message => { if (!app.isPackaged) console.log(`[desktop] ${message}`) }

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'stream-dock-icon',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
])

const userDataPath = !app.isPackaged && process.env.STREAM_POLLS_USER_DATA ? resolve(process.env.STREAM_POLLS_USER_DATA) : join(app.getPath('appData'), 'Stream Polls')
app.setPath('userData', userDataPath)
const diagnostics = await createErrorJournal(join(userDataPath, 'logs', 'errors.json'), { version: app.getVersion() })
process.on('uncaughtExceptionMonitor', error => { diagnostics.record({ source: 'desktop:crash', error }); diagnostics.flushSync() })
if (!app.isPackaged && process.env.STREAM_POLLS_DEBUG_PORT) app.commandLine.appendSwitch('remote-debugging-port', process.env.STREAM_POLLS_DEBUG_PORT)
trace('main loaded')
let runtimeSource
const versions = createVersionManager({
  root: join(userDataPath, 'versions'), currentVersion: app.getVersion(), executable: process.execPath,
  isPackaged: app.isPackaged,
  source: { describe: branch => {if (!runtimeSource) throw new Error('Источник версий ещё не настроен.'); return runtimeSource.describe(branch)}, download: (...args) => runtimeSource.download(...args) },
  emit: state => {
    for (const [branch, message] of Object.entries(state.errors)) diagnostics.record({ source: `versions:${branch}`, error: message })
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('versions:state',state)
  },
})
if (!app.requestSingleInstanceLock()) { trace('another instance owns the lock'); app.quit() }
else {
  let redirectTarget = null
  try { redirectTarget = await versions.initialize() }
  catch (error) { diagnostics.record({ source: 'versions:initialize', error }); trace(`local versions unavailable: ${error instanceof Error ? error.message : String(error)}`) }
  if (redirectTarget) {
    await app.whenReady()
    const loginLaunch = process.argv.includes('--started-at-login') || (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin)
    app.relaunch({execPath:redirectTarget,args:loginLaunch?['--started-at-login']:[]})
    app.exit(0)
  } else {
  app.setAppUserModelId('ru.projectchat.app')
  app.on('second-instance', () => {
    revealMainWindow?.()
  })
  app.on('activate', () => revealMainWindow?.())

  const start = async () => {
  trace('ready')
  if (!app.isPackaged && app.dock) app.dock.setIcon(developmentIcon)
  const developmentPanelUrl = !app.isPackaged ? process.env.STREAM_POLLS_PANEL_URL?.trim() : ''
  const developmentOrigins = developmentPanelUrl
    ? [new URL(developmentPanelUrl).origin, ...Array.from({ length: 20 }, (_, index) => `http://127.0.0.1:${5173 + index}`)]
    : []
  const preferencesPath = join(app.getPath('userData'), 'desktop-preferences.json')
  desktopPreferences = await loadDesktopPreferences(preferencesPath)
  const loginSettings = app.getLoginItemSettings(loginItemQuery(process.platform))
  const launchedAtLogin = wasLaunchedAtLogin({
    platform: process.platform,
    argv: process.argv,
    settings: loginSettings,
    packaged: app.isPackaged,
  })
  let startupTrayActive = launchedAtLogin
  if (startupTrayActive && app.dock) app.dock.hide()

  const packagedPlugins = app.isPackaged
    ? join(process.resourcesPath, 'stream-dock-plugins')
    : resolve(app.getAppPath(), 'build', 'stream-dock-plugins')
  const streamDockFixtureRoot = !app.isPackaged && process.env.STREAM_DOCK_FIXTURE_ROOT
    ? resolve(process.env.STREAM_DOCK_FIXTURE_ROOT)
    : ''
  const streamDockPaths = createStreamDockPaths({
    appData: streamDockFixtureRoot || app.getPath('appData'),
    programFiles: process.env.ProgramFiles,
    programFilesX86: process.env['ProgramFiles(x86)'],
    windowsDir: process.env.WINDIR,
    packagedPlugins,
  })
  if (streamDockFixtureRoot) streamDockPaths.ajazzExe = join(streamDockFixtureRoot, 'Stream Dock AJAZZ.exe')
  streamDock = createStreamDockManager({
    paths: streamDockPaths,
    platform: streamDockFixtureRoot ? 'win32' : process.platform,
    processes: streamDockFixtureRoot
      ? { running: async () => true, stop: async () => {}, start: async () => {} }
      : createStreamDockProcessAdapter(),
    compileProjectChatPlugin: streamDockFixtureRoot
      ? target => writeFile(join(target, 'ProjectChatPlugin.exe'), 'development fixture')
      : createProjectChatPluginCompiler(),
  })
  protocol.handle('stream-dock-icon', request => {
    const id = new URL(request.url).pathname.replace(/^\//u, '')
    const path = streamDock.iconPath(id)
    return path ? net.fetch(pathToFileURL(path).toString()) : new Response('Not found', { status: 404 })
  })

  let configuredUrl = ''
  let currentReleaseNotes = ''
  try {
    const configFile = app.isPackaged ? join(process.resourcesPath, 'update-config.json') : new URL('./update-config.json', import.meta.url)
    const config = JSON.parse(await readFile(configFile, 'utf8'))
    configuredUrl = typeof config.url === 'string' ? config.url.trim().replace(/\/$/u, '') : ''
  } catch { /* the UI will report that the release source is not configured */ }
  try {
    currentReleaseNotes = await readFile(
      app.isPackaged
        ? join(app.getAppPath(), 'build', 'release-notes.md')
        : new URL('../build/release-notes.md', import.meta.url),
      'utf8',
    )
  } catch { /* release notes are optional for local development */ }
  const updateUrl = process.env.STREAM_POLLS_UPDATE_URL?.trim().replace(/\/$/u, '') || configuredUrl
  if (app.isPackaged && updateUrl) runtimeSource = createVersionSource(updateUrl)
  const sendUpdate = state => {
    if (state.phase === 'error') diagnostics.record({ source: 'updates', error: state.message })
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updates:state', state)
  }
  const updates = createUpdateController({ autoUpdater, currentVersion: app.getVersion(), currentReleaseNotes, channel: versionChannel(app.getVersion()), isPackaged: app.isPackaged, updateUrl, emit: sendUpdate })

  try {
    trace('starting local server')
    const branch = versionChannel(app.getVersion())
    if (app.isPackaged && branch === 'beta') await seedBetaData(userDataPath)
    serverApp = await createApp({
      dataDir: versionDataDirectory(userDataPath, app.isPackaged ? branch : 'stable'),
      twitchOptions: { filename: join(userDataPath, 'app-data', 'twitch.json') },
      allowedOrigins: developmentOrigins,
      diagnostics,
    })
    const port = Number(process.env.PORT || 4317)
    const url = await serverApp.listen(port)
    const panelUrl = developmentPanelUrl || url
    trace(`server listening at ${url}`)
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 860,
      minWidth: 920,
      minHeight: 680,
      backgroundColor: windowThemes.lime.color,
      autoHideMenuBar: true,
      show: false,
      title: 'Cue',
      titleBarStyle: 'hidden',
      ...(process.platform === 'darwin'
        ? { trafficLightPosition: { x: 13, y: 11 } }
        : { titleBarOverlay: windowThemes.lime }),
      icon: app.isPackaged ? undefined : developmentIcon,
      webPreferences: {
        preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    mainWindow.webContents.on('render-process-gone', (_event, details) => diagnostics.record({ source: 'renderer', error: `Renderer stopped: ${details.reason}, exit ${details.exitCode}` }))
    const showMainWindow = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      startupTrayActive = false
      if (app.dock) void app.dock.show()
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.setSkipTaskbar(false)
      mainWindow.show()
      mainWindow.focus()
      syncTray()
    }
    const syncTray = () => {
      if (!desktopPreferences.runInBackground && !startupTrayActive) {
        tray?.destroy()
        tray = undefined
        return
      }
      if (tray) return
      const image = nativeImage.createFromPath(trayIconPath)
      if (image.isEmpty()) throw new Error('Не удалось загрузить иконку трея.')
      if (process.platform === 'darwin') image.setTemplateImage(true)
      tray = new Tray(image)
      tray.setToolTip('Cue')
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Открыть Cue', click: showMainWindow },
        { type: 'separator' },
        {
          label: 'Выйти',
          click: () => {
            isQuitting = true
            app.quit()
          },
        },
      ]))
      tray.on('click', showMainWindow)
    }
    revealMainWindow = showMainWindow
    const preferencesSnapshot = () => ({
      openAtLogin: app.getLoginItemSettings(loginItemQuery(process.platform)).openAtLogin,
      runInBackground: desktopPreferences.runInBackground,
      updateChannel: desktopPreferences.updateChannel,
      openAtLoginSupported: app.isPackaged && ['darwin', 'win32'].includes(process.platform),
      runInBackgroundSupported: true,
    })
    syncTray()
    mainWindow.on('close', event => {
      if (!desktopPreferences.runInBackground || isQuitting) return
      event.preventDefault()
      mainWindow.setSkipTaskbar(true)
      mainWindow.hide()
    })
    const secureHandler = createDesktopIpcHandler(() => mainWindow, panelUrl)
    const handleDesktop = (channel, handler) => {
      ipcMain.handle(channel, secureHandler(async (...args) => {
        try { return await handler(...args) }
        catch (error) {
          diagnostics.record({ source: channel, error })
          await diagnostics.flush()
          const notice = presentError(error, channel)
          throw new Error([notice.title, notice.description].filter(Boolean).join('. '))
        }
      }))
    }
    handleDesktop('desktop:get-info', () => ({ version: app.getVersion(), platform: process.platform, development: !app.isPackaged, update: updates.snapshot(), versions: versions.snapshot() }))
    handleDesktop('diagnostics:record', async message => {
      if (typeof message !== 'string' || message.length > 12000) throw new Error('Некорректная запись журнала.')
      diagnostics.record({ source: 'panel', error: message })
      await diagnostics.flush()
    })
    handleDesktop('versions:get', () => versions.snapshot())
    handleDesktop('versions:check', () => versions.check())
    handleDesktop('versions:download', branch => versions.download(branch))
    handleDesktop('versions:healthy', () => versions.markHealthy())
    handleDesktop('versions:activate', async branch => {
      const target = await versions.activate(branch)
      if (!target) return false
      isQuitting = true
      if (serverApp) {await serverApp.close(); serverApp = undefined}
      app.relaunch({execPath:target,args:[]})
      app.quit()
      return true
    })
    handleDesktop('updates:check', () => updates.check())
    handleDesktop('updates:download', () => updates.download())
    handleDesktop('updates:install', () => updates.install())
    handleDesktop('desktop:theme:set', theme => {
      if (!Object.hasOwn(windowThemes, theme)) throw new Error('Неизвестная тема приложения.')
      mainWindow.setBackgroundColor(windowThemes[theme].color)
      if (process.platform === 'win32') {
        mainWindow.setTitleBarOverlay(windowThemes[theme])
      }
    })
    handleDesktop('desktop:preferences:get', preferencesSnapshot)
    handleDesktop('desktop:preferences:set', async patch => {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Некорректные настройки приложения.')
      const allowed = ['openAtLogin', 'runInBackground', 'updateChannel']
      if (Object.keys(patch).some(key => !allowed.includes(key))) throw new Error('Неизвестная настройка приложения.')
      if ('openAtLogin' in patch) {
        if (typeof patch.openAtLogin !== 'boolean') throw new Error('Некорректная настройка автозапуска.')
        if (!preferencesSnapshot().openAtLoginSupported) throw new Error('Автозапуск доступен после установки приложения.')
        app.setLoginItemSettings(loginItemUpdate(process.platform, patch.openAtLogin))
      }
      if ('runInBackground' in patch && typeof patch.runInBackground !== 'boolean')
        throw new Error('Некорректная настройка фоновой работы.')
      if ('updateChannel' in patch && !['stable', 'beta'].includes(patch.updateChannel))
        throw new Error('Некорректный канал обновлений.')
      if ('runInBackground' in patch || 'updateChannel' in patch) {
        desktopPreferences = await saveDesktopPreferences(preferencesPath, {
          ...desktopPreferences,
          ...('runInBackground' in patch ? { runInBackground: patch.runInBackground } : {}),
          ...('updateChannel' in patch ? { updateChannel: patch.updateChannel } : {}),
        })
      }
      if ('runInBackground' in patch) {
        syncTray()
      }
      if ('updateChannel' in patch) updates.setChannel(desktopPreferences.updateChannel)
      return preferencesSnapshot()
    })
    const handleStreamDock = handleDesktop
    handleStreamDock('stream-dock:status', () => streamDock.status())
    handleStreamDock('stream-dock:plugins', () => streamDock.listPlugins())
    handleStreamDock('stream-dock:icons', () => streamDock.listIcons())
    handleStreamDock('stream-dock:backups', () => streamDock.listBackups())
    handleStreamDock('stream-dock:choose-plugin', async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Выберите папку плагина Stream Deck',
        properties: ['openDirectory'],
      })
      return result.canceled ? null : streamDock.inspectPlugin(result.filePaths[0])
    })
    handleStreamDock('stream-dock:install', sourceKey => streamDock.installSource(sourceKey))
    handleStreamDock('stream-dock:uninstall', pluginId => streamDock.uninstallPlugin(pluginId))
    handleStreamDock('stream-dock:restore', backupId => streamDock.restoreBackup(backupId))
    handleStreamDock('stream-dock:import-icon-files', async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Выберите иконки',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'] }],
      })
      return result.canceled ? null : streamDock.importIconFiles(result.filePaths)
    })
    handleStreamDock('stream-dock:import-icon-folder', async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Выберите папку с иконками',
        properties: ['openDirectory'],
      })
      return result.canceled ? null : streamDock.importIconFolder(result.filePaths[0])
    })
    handleStreamDock('stream-dock:copy-icon-path', id => {
      const path = streamDock.iconPath(id)
      if (!path) throw new Error('Иконка не найдена. Обновите библиотеку.')
      clipboard.writeText(path)
      return true
    })
    handleStreamDock('stream-dock:reveal-icon', id => {
      const path = streamDock.iconPath(id)
      if (!path) throw new Error('Иконка не найдена. Обновите библиотеку.')
      shell.showItemInFolder(path)
      return true
    })
    mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
      if (/^https?:\/\//u.test(target)) void shell.openExternal(target)
      return { action: 'deny' }
    })
    const restrictNavigation = (event, target) => {
      if (isTrustedPanelUrl(target, panelUrl)) return
      event.preventDefault()
    }
    mainWindow.webContents.on('will-navigate', restrictNavigation)
    mainWindow.webContents.on('will-redirect', restrictNavigation)
    mainWindow.once('ready-to-show', () => {
      if (startupTrayActive) {
        mainWindow.setSkipTaskbar(true)
        return
      }
      showMainWindow()
    })
    await mainWindow.loadURL(panelUrl)
    trace('window loaded')
    if (!app.isPackaged && process.env.STREAM_POLLS_SCREENSHOT) {
      await new Promise(resolve => setTimeout(resolve, 800))
      const image = await mainWindow.webContents.capturePage()
      await writeFile(process.env.STREAM_POLLS_SCREENSHOT, image.toPNG())
    }
    // Downloads and version changes are always explicit in Settings.
  } catch (error) {
    diagnostics.record({ source: 'startup', error })
    await diagnostics.flush()
    const message = error?.code === 'EADDRINUSE'
      ? 'Другая копия Cue уже работает. Закройте её и попробуйте запустить приложение снова.'
      : Object.values(presentError(error, 'startup')).filter(Boolean).join('. ')
    await dialog.showMessageBox({ type: 'error', title: 'Cue', message: 'Не удалось запустить приложение', detail: message })
    app.quit()
  }
  }

  trace('waiting for ready')
  void app.whenReady().then(start)
  app.on('window-all-closed', () => {
    if (!desktopPreferences.runInBackground) app.quit()
  })
  app.on('before-quit', () => {
    isQuitting = true
    if (serverApp) void serverApp.close()
  })
}

}
