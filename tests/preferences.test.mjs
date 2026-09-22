import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  loadDesktopPreferences,
  normalizeDesktopPreferences,
  saveDesktopPreferences,
} from '../desktop/preferences.mjs'
import {
  LOGIN_LAUNCH_ARGUMENT,
  loginItemQuery,
  loginItemUpdate,
  wasLaunchedAtLogin,
} from '../desktop/startup.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('desktop preferences default safely and persist background mode', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'projectchat-preferences-'))
  const path = join(directory, 'desktop-preferences.json')
  t.after(() => rm(directory, { recursive: true, force: true }))

  assert.deepEqual(await loadDesktopPreferences(path), {
    runInBackground: false,
    updateChannel: 'stable',
  })

  await saveDesktopPreferences(path, { runInBackground: true, updateChannel: 'beta', unknown: true })
  assert.deepEqual(await loadDesktopPreferences(path), {
    runInBackground: true,
    updateChannel: 'beta',
  })
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), {
    runInBackground: true,
    updateChannel: 'beta',
  })

  await writeFile(path, '{broken json', 'utf8')
  assert.deepEqual(await loadDesktopPreferences(path), {
    runInBackground: false,
    updateChannel: 'stable',
  })
})

test('desktop preferences accept only an explicit true value', () => {
  assert.deepEqual(normalizeDesktopPreferences({ runInBackground: 1 }), {
    runInBackground: false,
    updateChannel: 'stable',
  })
  assert.deepEqual(normalizeDesktopPreferences({ runInBackground: true, updateChannel: 'beta' }), {
    runInBackground: true,
    updateChannel: 'beta',
  })
  assert.equal(normalizeDesktopPreferences({ updateChannel: 'nightly' }).updateChannel, 'stable')
})

test('login launch is marked on Windows and detected without changing manual launches', () => {
  assert.deepEqual(loginItemQuery('win32'), {
    args: [LOGIN_LAUNCH_ARGUMENT],
  })
  assert.deepEqual(loginItemUpdate('win32', true), {
    openAtLogin: true,
    args: [LOGIN_LAUNCH_ARGUMENT],
  })
  assert.equal(
    wasLaunchedAtLogin({
      platform: 'win32',
      argv: ['Cue.exe', LOGIN_LAUNCH_ARGUMENT],
      settings: {},
      packaged: true,
    }),
    true,
  )
  assert.equal(
    wasLaunchedAtLogin({
      platform: 'win32',
      argv: ['Cue.exe'],
      settings: {},
      packaged: true,
    }),
    false,
  )
})

test('macOS uses the system login flag and development always opens normally', () => {
  assert.deepEqual(loginItemQuery('darwin'), {})
  assert.deepEqual(loginItemUpdate('darwin', false), { openAtLogin: false })
  assert.equal(
    wasLaunchedAtLogin({
      platform: 'darwin',
      argv: [],
      settings: { wasOpenedAtLogin: true },
      packaged: true,
    }),
    true,
  )
  assert.equal(
    wasLaunchedAtLogin({
      platform: 'darwin',
      argv: [LOGIN_LAUNCH_ARGUMENT],
      settings: { wasOpenedAtLogin: true },
      packaged: false,
    }),
    false,
  )
})

test('desktop shell provides dedicated platform tray icons and custom title bar', async () => {
  const [main, app, titleBar, trayIcon, trayIcon2x, trayTemplateIcon, trayTemplateIcon2x] = await Promise.all([
    readFile(join(root, 'desktop', 'main.mjs'), 'utf8'),
    readFile(join(root, 'ui', 'panel', 'src', 'App.tsx'), 'utf8'),
    readFile(join(root, 'ui', 'panel', 'src', 'components', 'app-title-bar.tsx'), 'utf8'),
    stat(join(root, 'build', 'tray-icon.png')),
    stat(join(root, 'build', 'tray-icon@2x.png')),
    stat(join(root, 'build', 'tray-icon-template.png')),
    stat(join(root, 'build', 'tray-icon-template@2x.png')),
  ])

  assert.match(main, /tray-icon-template\.png/u)
  assert.match(main, /tray-icon\.png/u)
  assert.match(main, /setTemplateImage\(true\)/u)
  assert.match(main, /startupTrayActive/u)
  assert.match(main, /ready-to-show/u)
  assert.match(main, /revealMainWindow/u)
  assert.match(main, /titleBarStyle:\s*'hidden'/u)
  assert.match(app, /AppTitleBar/u)
  assert.match(titleBar, /app-drag-region/u)
  assert.ok(trayIcon.size > 100)
  assert.ok(trayIcon2x.size > trayIcon.size)
  assert.ok(trayTemplateIcon.size > 100)
  assert.ok(trayTemplateIcon2x.size > trayTemplateIcon.size)
})
