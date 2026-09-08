import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)

async function taskList() {
  try {
    const { stdout } = await execute('tasklist.exe', [
      '/FI',
      'IMAGENAME eq Stream Dock AJAZZ.exe',
      '/NH',
    ], { windowsHide: true })
    return stdout.toLowerCase().includes('stream dock ajazz.exe')
  } catch {
    return false
  }
}

async function stopProcess(imageName) {
  try {
    await execute('taskkill.exe', ['/IM', imageName, '/T', '/F'], { windowsHide: true })
  } catch {
    // taskkill returns a non-zero code when the process is not running.
  }
}

export function createStreamDockProcessAdapter({ platform = process.platform } = {}) {
  return {
    async running() {
      return platform === 'win32' ? taskList() : false
    },
    async stop() {
      if (platform !== 'win32') return
      await stopProcess('Stream Dock AJAZZ.exe')
      await stopProcess('TwitchLauncher.exe')
      await new Promise((resolve) => setTimeout(resolve, 650))
    },
    async start(paths) {
      if (platform !== 'win32' || !paths.ajazzExe || !existsSync(paths.ajazzExe)) return
      const child = spawn(paths.ajazzExe, [], {
        cwd: dirname(paths.ajazzExe),
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      })
      child.unref()
    },
  }
}
