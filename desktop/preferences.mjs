import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const defaults = Object.freeze({ runInBackground: false })

export function normalizeDesktopPreferences(value) {
  return {
    runInBackground: value?.runInBackground === true,
  }
}

export async function loadDesktopPreferences(path) {
  try {
    return normalizeDesktopPreferences(JSON.parse(await readFile(path, 'utf8')))
  } catch {
    return { ...defaults }
  }
}

export async function saveDesktopPreferences(path, preferences) {
  const value = normalizeDesktopPreferences(preferences)
  const temporary = `${path}.tmp`
  await mkdir(dirname(path), { recursive: true })
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, path)
  return value
}
