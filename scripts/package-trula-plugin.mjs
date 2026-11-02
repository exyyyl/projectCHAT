import { cp, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

const name = 'ru.projectchat.trula.sdPlugin'
const source = resolve('plugins', name)
const output = resolve('release/Trula-Audio-0.1.0.zip')
const images = join(source, 'images')
await mkdir(images, { recursive: true })
for (const kind of ['stream', 'monitor']) {
  for (const muted of [false, true]) {
    const color = muted ? '#ffb9b2' : '#d3fb75'
    const device = kind === 'stream'
      ? '<rect x="29" y="28" width="70" height="44" rx="5"/><path d="M50 83h28m-14-11v11"/>'
      : '<path d="M35 65V52a29 29 0 0 1 58 0v13"/><rect x="28" y="54" width="14" height="25" rx="5"/><rect x="86" y="54" width="14" height="25" rx="5"/>'
    const slash = muted ? '<path d="M24 25l80 60" stroke="#202226" stroke-width="13"/><path d="M24 25l80 60" stroke="#ffb9b2" stroke-width="5"/>' : ''
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="20" fill="#202226"/><g stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round">${device}${slash}</g></svg>`
    await sharp(Buffer.from(svg)).png().toFile(join(images, `${kind}-${muted ? 'off' : 'on'}.png`))
  }
}
await cp(join(images, 'stream-on.png'), join(images, 'plugin.png'))
const dependency = join(source, 'node_modules/ws/package.json')
try {
  const pkg = JSON.parse(await readFile(dependency, 'utf8'))
  if (pkg.version !== '8.22.1') throw new Error('Версия ws не совпадает с lockfile.')
} catch {
  throw new Error(`Установите зависимости: npm ci --omit=dev --ignore-scripts --prefix plugins/${name}`)
}
const temporary = await mkdtemp(join(tmpdir(), 'trula-package-'))
try {
  const destination = join(temporary, name)
  await cp(source, destination, { recursive: true })
  await mkdir(resolve('release'), { recursive: true })
  // Use Python's standard zipfile on both platforms; no platform-specific archiver needed.
  const python = process.platform === 'win32' ? 'python' : 'python3'
  const result = spawnSync(python, ['-c', 'import pathlib,sys,zipfile\nroot=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED) as z:\n for f in sorted(root.rglob("*")):\n  if f.is_file(): z.write(f,f.relative_to(root))', temporary, output], { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('Не удалось собрать ZIP плагина.')
  console.log(`${output} (${(await stat(output)).size} bytes)`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
