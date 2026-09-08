import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import updaterModule from 'electron-updater'
import { createApp } from '../server/app.mjs'
import { createUpdateController } from './updater.mjs'

const { autoUpdater } = updaterModule
const preload = fileURLToPath(new URL('./preload.cjs', import.meta.url))
const developmentIcon = fileURLToPath(new URL('../build/icon.png', import.meta.url))
let serverApp
let mainWindow
const trace = message => { if (!app.isPackaged) console.log(`[desktop] ${message}`) }

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
    mainWindow.show()
    mainWindow.focus()
  })

  const start = async () => {
  trace('ready')
  if (!app.isPackaged && app.dock) app.dock.setIcon(developmentIcon)

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

  ipcMain.handle('desktop:get-info', () => ({ version: app.getVersion(), platform: process.platform, update: updates.snapshot() }))
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
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => { if (serverApp) void serverApp.close() })
}
