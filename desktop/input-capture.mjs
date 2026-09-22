import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

export function createInputCapture({ emit, status, executable, platform = process.platform, spawnProcess = spawn }) {
  let child
  let enabled = null
  let lastError = ''
  const report = (listening, message = '') => status({ supported: platform === 'win32', listening, platform, message })

  const stop = () => {
    enabled = false
    if (child) {
      const current = child
      child = undefined
      current.kill()
    }
    report(false)
  }

  const start = () => {
    if (platform !== 'win32') {
      report(false, 'Захват ввода доступен в Windows.')
      return
    }
    if (child) return
    try {
      lastError = ''
      child = spawnProcess(executable, [], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      const current = child
      const lines = createInterface({ input: current.stdout })
      lines.on('line', line => {
        try { emit(JSON.parse(line)) } catch { /* malformed helper output is ignored */ }
      })
      current.stderr.on('data', chunk => { lastError = `${lastError}${chunk}`.trim().slice(-160) })
      current.once('spawn', () => report(true))
      current.once('error', error => {
        if (child !== current) return
        child = undefined
        report(false, error.message)
      })
      current.once('exit', code => {
        if (child !== current) return
        child = undefined
        report(false, lastError || (code ? `Захват ввода завершился с кодом ${code}.` : ''))
      })
    } catch (error) {
      child = undefined
      report(false, error instanceof Error ? error.message : 'Не удалось включить захват ввода.')
    }
  }

  return {
    async setEnabled(next) {
      if (next === enabled) return
      enabled = next
      if (enabled) start(); else stop()
    },
    stop,
  }
}
