import { rm } from 'node:fs/promises'

const generatedPaths = [
  'dist',
  'release',
  'build/icon.png',
  'build/update-config.json',
]

await Promise.all(generatedPaths.map((path) => rm(path, { recursive: true, force: true })))

console.log('Локальные сборки и временные файлы удалены.')
