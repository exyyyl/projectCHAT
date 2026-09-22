import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import electron from 'electron'
import { watchDesktopSources } from './watch-desktop.mjs'

const root = resolve(import.meta.dirname, '..')
const panelRoot = resolve(root, 'ui', 'panel')
const viteCli = resolve(panelRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const children = new Set()
let stopping = false
let stopWatching = () => {}
let desktop
let restarting = false

if (process.platform === 'win32') {
  const capture = spawnSync(process.execPath, [resolve(root, 'scripts', 'build-input-capture.mjs')], { cwd: root, stdio: 'inherit' })
  if (capture.error) throw capture.error
  if (capture.status !== 0) process.exit(capture.status || 1)
}

const portAvailable = port => new Promise((resolvePort, reject) => {
  const server = createServer()
  server.once('error', error => {
    if (error.code === 'EADDRINUSE') resolvePort(false)
    else reject(error)
  })
  server.listen(port, '127.0.0.1', () => server.close(() => resolvePort(true)))
})

const findPanelPort = async () => {
  for (let port = 5173; port <= 5192; port++) {
    if (await portAvailable(port)) return port
  }
  throw new Error('Не найден свободный порт для Vite.')
}

const panelPort = await findPanelPort()
const panelUrl = `http://127.0.0.1:${panelPort}`

const run = (command, args, options = {}) => {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    ...options,
  })
  children.add(child)
  child.once('exit', () => children.delete(child))
  return child
}

const stop = signal => {
  if (stopping) return
  stopping = true
  stopWatching()
  for (const child of children) child.kill(signal)
}

const waitForPanel = async () => {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(panelUrl)
      if (response.ok) return
    } catch { /* Vite is still starting */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 100))
  }
  throw new Error('Vite не запустился вовремя.')
}

process.once('SIGINT', () => stop('SIGINT'))
process.once('SIGTERM', () => stop('SIGTERM'))

const vite = run(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', String(panelPort), '--strictPort'], { cwd: panelRoot })
const viteStopped = new Promise((_, reject) => {
  vite.once('exit', code => {
    if (!stopping) reject(new Error(`Vite завершился с кодом ${code ?? 1}.`))
  })
})

try {
  await Promise.race([waitForPanel(), viteStopped])
  const launchDesktop = () => {
    desktop = run(electron, ['.'], {
      env: {
        ...process.env,
        STREAM_POLLS_PANEL_URL: panelUrl,
      },
    })
    return desktop
  }
  const code = await new Promise(resolveExit => {
    const attach = child => {
      child.once('exit', code => {
        if (stopping) return resolveExit(code)
        if (!restarting) return resolveExit(code)
        restarting = false
        attach(launchDesktop())
      })
    }
    attach(launchDesktop())
    stopWatching = watchDesktopSources({
      directories: [resolve(root, 'server'), resolve(root, 'desktop')],
      onReload(filename) {
        if (stopping || !desktop || restarting) return
        console.log(`[dev] ${filename} изменён — перезапускаю Cue`)
        restarting = true
        desktop.kill('SIGTERM')
      },
    })
  })
  stop('SIGTERM')
  process.exitCode = code ?? 0
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  stop('SIGTERM')
  process.exitCode = 1
}
