import { mkdir, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

const flags = new Set(process.argv.slice(2))
const platform = flags.has('--win') ? 'win' : flags.has('--mac') ? 'mac' : null
const release = flags.has('--release')
const updateUrl = (process.env.STREAM_POLLS_UPDATE_URL || '').trim().replace(/\/$/u, '')
if (!platform) throw new Error('Укажите --win или --mac.')
if (release && !updateUrl) throw new Error('Для релизной сборки задайте STREAM_POLLS_UPDATE_URL.')

await mkdir('build', { recursive: true })
await writeFile('build/update-config.json', JSON.stringify({ url: updateUrl }, null, 2) + '\n')
await sharp('build/icon-source.png').resize(512, 512).png().toFile('build/icon.png')
await sharp('build/icon-source.png').resize(64, 64).png().toFile('public/favicon.png')

const panel = spawnSync('npm', ['run', 'build:panel'], { stdio: 'inherit' })
if (panel.status !== 0) process.exit(panel.status || 1)
const builder = process.platform === 'win32' ? 'node_modules/.bin/electron-builder.cmd' : 'node_modules/.bin/electron-builder'
const args = platform === 'win'
  ? ['--config', 'electron-builder.config.cjs', '--win', 'nsis', '--x64', '--publish', 'never']
  : ['--config', 'electron-builder.config.cjs', '--mac', 'dmg', `--${process.arch}`, '--publish', 'never']
const packaged = spawnSync(builder, args, { stdio: 'inherit', env: { ...process.env, STREAM_POLLS_UPDATE_URL: updateUrl || 'https://updates.invalid/projectchat' } })
if (packaged.status !== 0) process.exit(packaged.status || 1)
console.log(`Готово: release/ содержит ${platform === 'win' ? 'Windows-установщик' : 'macOS-сборку'}.`)
