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

const { autoUpdater } = updaterModule
const preload = fileURLToPath(new URL('./preload.cjs', import.meta.url))
const developmentIcon = fileURLToPath(new URL('../build/icon.png', import.meta.url))
let serverApp
let mainWindow
let streamDock
let tray
let isQuitting = false
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
if (!app.isPackaged && process.env.STREAM_POLLS_DEBUG_PORT) app.commandLine.appendSwitch('remote-debugging-port', process.env.STREAM_POLLS_DEBUG_PORT)
trace('main loaded')
if (!app.requestSingleInstanceLock()) { trace('another instance owns the lock'); app.quit() }
else {
  app.setAppUserModelId('ru.projectchat.app')
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.setSkipTaskbar(false)
    mainWindow.show()
    mainWindow.focus()
  })

  const start = async () => {
  trace('ready')
  if (!app.isPackaged && app.dock) app.dock.setIcon(developmentIcon)
  const preferencesPath = join(app.getPath('userData'), 'desktop-preferences.json')
  desktopPreferences = await loadDesktopPreferences(preferencesPath)

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
  try {
    const configFile = app.isPackaged ? join(process.resourcesPath, 'update-config.json') : new URL('./update-config.json', import.meta.url)
    const config = JSON.parse(await readFile(configFile, 'utf8'))
    configuredUrl = typeof config.url === 'string' ? config.url.trim().replace(/\/$/u, '') : ''
  } catch { /* the UI will report that the release source is not configured */ }
  const updateUrl = process.env.STREAM_POLLS_UPDATE_URL?.trim().replace(/\/$/u, '') || configuredUrl
  const sendUpdate = state => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updates:state', state)
  }
  const updates = createUpdateController({ autoUpdater, currentVersion: app.getVersion(), isPackaged: app.isPackaged, updateUrl, emit: sendUpdate })

  ipcMain.handle('desktop:get-info', () => ({ version: app.getVersion(), platform: process.platform, development: !app.isPackaged, update: updates.snapshot() }))
  ipcMain.handle('updates:check', () => updates.check())
  ipcMain.handle('updates:download', () => updates.download())
  ipcMain.handle('updates:install', () => updates.install())

  try {
    trace('starting local server')
    serverApp = await createApp({ dataDir: join(app.getPath('userData'), 'app-data') })
    const port = Number(process.env.PORT || 4317)
    const url = await serverApp.listen(port)
    trace(`server listening at ${url}`)
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 860,
      minWidth: 920,
      minHeight: 680,
      backgroundColor: '#090b0e',
      autoHideMenuBar: true,
      show: false,
      title: 'projectCHAT',
      icon: app.isPackaged ? undefined : developmentIcon,
      webPreferences: {
        preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    const showMainWindow = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.setSkipTaskbar(false)
      mainWindow.show()
      mainWindow.focus()
    }
    const syncTray = () => {
      if (!desktopPreferences.runInBackground) {
        tray?.destroy()
        tray = undefined
        return
      }
      if (tray) return
      const image = nativeImage.createFromPath(developmentIcon)
      tray = new Tray(process.platform === 'darwin' ? image.resize({ width: 18, height: 18 }) : image)
      tray.setToolTip('projectCHAT')
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Открыть projectCHAT', click: showMainWindow },
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
    const preferencesSnapshot = () => ({
      openAtLogin: app.getLoginItemSettings().openAtLogin,
      runInBackground: desktopPreferences.runInBackground,
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
    const trusted = event => event.sender === mainWindow?.webContents
    const handleDesktop = (channel, handler) => {
      ipcMain.handle(channel, async (event, ...args) => {
        if (!trusted(event)) throw new Error('Недоверенный источник IPC.')
        return handler(...args)
      })
    }
    handleDesktop('desktop:preferences:get', preferencesSnapshot)
    handleDesktop('desktop:preferences:set', async patch => {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Некорректные настройки приложения.')
      const allowed = ['openAtLogin', 'runInBackground']
      if (Object.keys(patch).some(key => !allowed.includes(key))) throw new Error('Неизвестная настройка приложения.')
      if ('openAtLogin' in patch) {
        if (typeof patch.openAtLogin !== 'boolean') throw new Error('Некорректная настройка автозапуска.')
        if (!preferencesSnapshot().openAtLoginSupported) throw new Error('Автозапуск доступен после установки приложения.')
        app.setLoginItemSettings({ openAtLogin: patch.openAtLogin })
      }
      if ('runInBackground' in patch) {
        if (typeof patch.runInBackground !== 'boolean') throw new Error('Некорректная настройка фоновой работы.')
        desktopPreferences = await saveDesktopPreferences(preferencesPath, { runInBackground: patch.runInBackground })
        syncTray()
      }
      return preferencesSnapshot()
    })
    const handleStreamDock = (channel, handler) => {
      ipcMain.handle(channel, async (event, ...args) => {
        if (!trusted(event)) throw new Error('Недоверенный источник IPC.')
        return handler(...args)
      })
    }
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
    mainWindow.webContents.on('will-navigate', (event, target) => {
      if (target.startsWith(url)) return
      event.preventDefault()
      if (/^https?:\/\//u.test(target)) void shell.openExternal(target)
    })
    mainWindow.once('ready-to-show', () => mainWindow.show())
    await mainWindow.loadURL(url)
    trace('window loaded')
    if (!app.isPackaged && process.env.STREAM_POLLS_SCREENSHOT) {
      await new Promise(resolve => setTimeout(resolve, 800))
      const image = await mainWindow.webContents.capturePage()
      await writeFile(process.env.STREAM_POLLS_SCREENSHOT, image.toPNG())
    }
    if (app.isPackaged && updateUrl) setTimeout(() => void updates.check(), 4000)
  } catch (error) {
    const message = error?.code === 'EADDRINUSE'
      ? 'Порт 4317 уже занят. Закройте другую копию сервера опросов и запустите приложение снова.'
      : error instanceof Error ? error.message : String(error)
    await dialog.showMessageBox({ type: 'error', title: 'projectCHAT', message: 'Не удалось запустить приложение', detail: message })
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
