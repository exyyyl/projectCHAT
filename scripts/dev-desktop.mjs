import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import electron from 'electron'

const root = resolve(import.meta.dirname, '..')
const panelRoot = resolve(root, 'ui', 'panel')
const panelUrl = 'http://127.0.0.1:5173'
const viteCli = resolve(panelRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const children = new Set()
let stopping = false

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

const vite = run(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: panelRoot })
vite.once('exit', code => {
  if (!stopping && code) {
    stop('SIGTERM')
    process.exitCode = code
  }
})

try {
  await waitForPanel()
  const desktop = run(electron, ['.'], {
    env: {
      ...process.env,
      STREAM_POLLS_PANEL_URL: panelUrl,
    },
  })
  desktop.once('exit', code => {
    stop('SIGTERM')
    process.exitCode = code ?? 0
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  stop('SIGTERM')
  process.exitCode = 1
}
