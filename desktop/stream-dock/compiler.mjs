import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)

export function createProjectChatPluginCompiler({ platform = process.platform } = {}) {
  return async function compileProjectChatPlugin(target, paths) {
    if (platform !== 'win32') throw new Error('Плагин projectCHAT можно собрать только в Windows.')
    const frameworkRoots = [
      join(paths.windowsDir, 'Microsoft.NET', 'Framework64', 'v4.0.30319'),
      join(paths.windowsDir, 'Microsoft.NET', 'Framework', 'v4.0.30319'),
    ]
    const framework = frameworkRoots.find((path) => existsSync(join(path, 'csc.exe')))
    if (!framework) throw new Error('Встроенный компилятор .NET Framework не найден.')
    const source = join(target, 'ProjectChatPlugin.cs')
    if (!existsSync(source)) throw new Error('В пакете отсутствует исходник плагина projectCHAT.')
    const output = join(target, 'ProjectChatPlugin.exe')
    try {
      await execute(
        join(framework, 'csc.exe'),
        [
          '/nologo',
          '/target:exe',
          '/optimize+',
          `/out:${output}`,
          `/reference:${join(framework, 'System.dll')}`,
          `/reference:${join(framework, 'System.Core.dll')}`,
          `/reference:${join(framework, 'System.Web.Extensions.dll')}`,
          source,
        ],
        { windowsHide: true },
      )
    } catch (error) {
      const detail = error?.stderr?.trim() || error?.message || String(error)
      throw new Error(`Не удалось собрать плагин projectCHAT: ${detail}`)
    }
  }
}
