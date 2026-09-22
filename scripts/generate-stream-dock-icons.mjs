import { mkdir, readFile } from 'node:fs/promises'
import sharp from 'sharp'

const pluginOutput = 'build/stream-dock-plugins/ru.projectchat.control.sdPlugin/images'
const previewOutput = 'ui/panel/src/assets/stream-dock'
await Promise.all([pluginOutput, previewOutput].map(output => mkdir(output, { recursive: true })))

// These paths mirror the Lucide icons used in the panel so the physical keys
// and their on-screen preview share one visual language.
const lucideSymbols = {
  start: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
  finish: '<circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  visibility: '<path d="m9 10 3-3 3 3"/><path d="M12 13V7"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/>',
  extend: '<path d="M10 2h4"/><path d="M12 14v-4"/><path d="M4 13a8 8 0 0 1 8-7 8 8 0 1 1-5.3 14L4 17.6"/><path d="M9 17H4v5"/>',
  preset: '<rect width="18" height="7" x="3" y="3" rx="1"/><rect width="9" height="7" x="3" y="14" rx="1"/><rect width="5" height="7" x="16" y="14" rx="1"/>',
}

const appIcon = await readFile('build/icon-source.png')
await Promise.all([
  sharp(appIcon).resize(144, 144).png().toFile(`${pluginOutput}/plugin.png`),
  sharp(appIcon).resize(144, 144).png().toFile(`${previewOutput}/projectchat.png`),
])

for (const [name, symbol] of Object.entries(lucideSymbols)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
    <rect x="1" y="1" width="142" height="142" rx="28" fill="#090a0c" stroke="#292c32" stroke-width="2"/>
    <g transform="translate(36 36) scale(3)" fill="none" stroke="#f4f4f5" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${symbol}</g>
  </svg>`
  const source = Buffer.from(svg)
  await Promise.all([
    sharp(source).png().toFile(`${pluginOutput}/${name}.png`),
    sharp(source).png().toFile(`${previewOutput}/projectchat-${name}.png`),
  ])
}
