import { spawnSync } from 'node:child_process'
import { mkdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

if (process.platform !== 'win32') throw new Error('Windows-модуль ввода собирается на Windows или в GitHub Actions.')

const root = resolve(import.meta.dirname, '..')
const source = join(root, 'desktop', 'input-capture', 'Program.cs')
const outputDirectory = join(root, 'build', 'input-capture')
const output = join(outputDirectory, 'projectCHAT.InputCapture.exe')
const windows = process.env.WINDIR || 'C:\\Windows'
const compilers = [
  join(windows, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
  join(windows, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
]

try {
  const [sourceInfo, outputInfo] = await Promise.all([stat(source), stat(output)])
  if (outputInfo.mtimeMs >= sourceInfo.mtimeMs) process.exit(0)
} catch { /* a missing output needs compilation */ }

await mkdir(outputDirectory, { recursive: true })
let failure
for (const compiler of compilers) {
  const result = spawnSync(compiler, ['/nologo', '/target:exe', '/platform:x64', `/out:${output}`, source], { stdio: 'inherit' })
  if (!result.error && result.status === 0) {
    console.log('Windows-модуль захвата ввода собран.')
    process.exit(0)
  }
  failure = result.error || new Error(`Компилятор завершился с кодом ${result.status ?? 1}.`)
}
throw new Error(`Не удалось собрать Windows-модуль захвата ввода: ${failure?.message || 'csc.exe не найден.'}`)
