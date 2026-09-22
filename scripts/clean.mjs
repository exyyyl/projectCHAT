import { rm } from 'node:fs/promises'

const generatedPaths = [
  'dist',
  'release',
  'public/panel-build',
  'build/icon.png',
  'build/update-config.json',
  'build/input-capture',
]

await Promise.all(generatedPaths.map((path) => rm(path, { recursive: true, force: true })))

console.log('Локальные сборки и временные файлы удалены.')
