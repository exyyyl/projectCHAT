import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

import {
  loadDesktopPreferences,
  normalizeDesktopPreferences,
  saveDesktopPreferences,
} from '../desktop/preferences.mjs'

test('desktop preferences default safely and persist background mode', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'projectchat-preferences-'))
  const path = join(directory, 'desktop-preferences.json')
  t.after(() => rm(directory, { recursive: true, force: true }))

  assert.deepEqual(await loadDesktopPreferences(path), {
    runInBackground: false,
  })

  await saveDesktopPreferences(path, { runInBackground: true, unknown: true })
  assert.deepEqual(await loadDesktopPreferences(path), {
    runInBackground: true,
  })
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), {
    runInBackground: true,
  })

  await writeFile(path, '{broken json', 'utf8')
  assert.deepEqual(await loadDesktopPreferences(path), {
    runInBackground: false,
  })
})

test('desktop preferences accept only an explicit true value', () => {
  assert.deepEqual(normalizeDesktopPreferences({ runInBackground: 1 }), {
    runInBackground: false,
  })
  assert.deepEqual(normalizeDesktopPreferences({ runInBackground: true }), {
    runInBackground: true,
  })
})
