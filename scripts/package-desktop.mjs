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

const streamDockIcons = spawnSync(process.execPath, ['scripts/generate-stream-dock-icons.mjs'], { stdio: 'inherit' })
if (streamDockIcons.error) throw streamDockIcons.error
if (streamDockIcons.status !== 0) process.exit(streamDockIcons.status || 1)

const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('Не удалось найти npm CLI. Запустите упаковку через npm run.')
const panel = spawnSync(process.execPath, [npmCli, 'run', 'build:panel'], { stdio: 'inherit' })
if (panel.error) throw panel.error
if (panel.status !== 0) process.exit(panel.status || 1)
const args = platform === 'win'
  ? ['--config', 'electron-builder.config.cjs', '--win', 'nsis', '--x64', '--publish', 'never']
  : ['--config', 'electron-builder.config.cjs', '--mac', 'dmg', `--${process.arch}`, '--publish', 'never']
const packaged = spawnSync(
  process.execPath,
  ['node_modules/electron-builder/out/cli/cli.js', ...args],
  { stdio: 'inherit', env: { ...process.env, STREAM_POLLS_UPDATE_URL: updateUrl || 'https://updates.invalid/projectchat' } },
)
if (packaged.error) throw packaged.error
if (packaged.status !== 0) process.exit(packaged.status || 1)
console.log(`Готово: release/ содержит ${platform === 'win' ? 'Windows-установщик' : 'macOS-сборку'}.`)
