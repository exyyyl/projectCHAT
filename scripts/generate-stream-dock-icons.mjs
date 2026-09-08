import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const output = 'build/stream-dock-plugins/ru.projectchat.control.sdPlugin/images'
await mkdir(output, { recursive: true })

const symbols = {
  plugin: '<path d="M39 42h66a13 13 0 0 1 13 13v43a13 13 0 0 1-13 13H67l-18 13v-13H39a13 13 0 0 1-13-13V55a13 13 0 0 1 13-13Z"/><path d="M55 87V73M72 87V64M89 87V56"/>',
  start: '<path fill="#d3fb75" stroke="none" d="m55 43 48 29-48 29Z"/>',
  finish: '<rect x="48" y="48" width="48" height="48" rx="8" fill="#d3fb75" stroke="none"/>',
  visibility: '<path d="M24 72s17-29 48-29 48 29 48 29-17 29-48 29S24 72 24 72Z"/><circle cx="72" cy="72" r="15"/>',
  extend: '<path d="M72 28a44 44 0 1 0 41 28"/><path d="M97 27h20v20"/><path d="M72 51v42M51 72h42"/>',
  preset: '<rect x="29" y="35" width="63" height="48" rx="8"/><path d="m76 101 18-18-18-18M94 83H51"/>',
}

for (const [name, symbol] of Object.entries(symbols)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
    <rect width="144" height="144" rx="28" fill="#111419"/>
    <g fill="none" stroke="#d3fb75" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">${symbol}</g>
  </svg>`
  await sharp(Buffer.from(svg)).png().toFile(`${output}/${name}.png`)
}
