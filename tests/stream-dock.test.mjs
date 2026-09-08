import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createStreamDockManager } from '../desktop/stream-dock/manager.mjs'

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'projectchat-stream-dock-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const paths = {
    ajazzRoot: join(root, 'ajazz'),
    ajazzPlugins: join(root, 'ajazz', 'plugins'),
    ajazzProfiles: join(root, 'ajazz', 'profiles'),
    ajazzExe: join(root, 'Stream Dock AJAZZ.exe'),
    elgatoPlugins: join(root, 'elgato', 'Plugins'),
    elgatoIconPacks: join(root, 'elgato', 'IconPacks'),
    managerRoot: join(root, 'manager'),
    iconLibrary: join(root, 'manager', 'IconLibrary'),
    backupRoot: join(root, 'manager', 'Backups'),
    logPath: join(root, 'manager', 'manager.log'),
    packagedPlugins: join(root, 'packaged'),
  }
  await Promise.all([
    mkdir(paths.ajazzPlugins, { recursive: true }),
    mkdir(paths.elgatoPlugins, { recursive: true }),
    mkdir(paths.packagedPlugins, { recursive: true }),
    writeFile(paths.ajazzExe, ''),
  ])
  return { root, paths }
}

async function plugin(folder, { name = 'Example', version = '1.0.0', uuid = 'com.example.plugin' } = {}) {
  await mkdir(folder, { recursive: true })
  await writeFile(
    join(folder, 'manifest.json'),
    JSON.stringify({ UUID: uuid, Name: name, Version: version, CodePath: 'plugin.exe', Actions: [{ UUID: `${uuid}.action` }] }),
  )
  await writeFile(join(folder, 'plugin.exe'), 'fixture')
}

test('Stream Dock stays unavailable outside Windows without touching local folders', async () => {
  const manager = createStreamDockManager({ paths: {}, platform: 'darwin' })
  assert.deepEqual(await manager.listPlugins(), [])
  assert.deepEqual(await manager.listIcons(), [])
  assert.deepEqual(await manager.status(), {
    platform: 'darwin',
    supported: false,
    ajazzFound: false,
    ajazzRunning: false,
    elgatoFound: false,
    elgatoPluginCount: 0,
    paths: null,
  })
  await assert.rejects(() => manager.uninstallPlugin('com.example.sdPlugin'), /только в Windows/u)
})

test('macOS preview exposes bundled plugins without enabling device operations', async t => {
  const { paths } = await fixture(t)
  await plugin(join(paths.packagedPlugins, 'ru.projectchat.control.sdPlugin'), {
    name: 'projectCHAT Control',
    uuid: 'ru.projectchat.control',
  })
  const manager = createStreamDockManager({ paths, platform: 'darwin' })

  const [entry] = await manager.listPlugins()
  assert.equal(entry.name, 'projectCHAT Control')
  assert.equal(entry.isPackaged, true)
  assert.equal(entry.isInstalled, false)
  await assert.rejects(() => manager.installSource(entry.sourceKey), /только в Windows/u)
})

test('plugin install, uninstall and restore preserve data and always restart AJAZZ', async (t) => {
  const { paths } = await fixture(t)
  const id = 'com.example.plugin.sdPlugin'
  const source = join(paths.elgatoPlugins, id)
  const installed = join(paths.ajazzPlugins, id)
  await plugin(source, { version: '2.0.0' })
  await plugin(installed, { version: '1.0.0' })
  await mkdir(join(installed, 'data'))
  await writeFile(join(installed, 'data', 'settings.json'), '{"kept":true}')

  const calls = []
  let clock = Date.parse('2026-09-08T12:00:00.000Z')
  const manager = createStreamDockManager({
    paths,
    platform: 'win32',
    now: () => clock++,
    processes: {
      running: async () => true,
      stop: async () => calls.push('stop'),
      start: async () => calls.push('start'),
    },
  })

  const status = await manager.status()
  assert.equal(status.ajazzFound, true)
  assert.equal(status.ajazzRunning, true)
  assert.equal(status.elgatoPluginCount, 1)
  const [entry] = await manager.listPlugins()
  assert.equal(entry.version, '2.0.0')
  assert.equal(entry.installedVersion, '1.0.0')
  assert.equal(entry.compatibility, 'experimental')

  await manager.installSource(entry.sourceKey)
  assert.equal(JSON.parse(await readFile(join(installed, 'manifest.json'))).Version, '2.0.0')
  assert.equal(await readFile(join(installed, 'data', 'settings.json'), 'utf8'), '{"kept":true}')
  assert.deepEqual(calls, ['stop', 'start'])
  assert.equal((await manager.listBackups()).length, 1)

  await manager.uninstallPlugin(id)
  assert.equal(existsSync(installed), false)
  assert.equal((await manager.listBackups()).length, 2)
  const newest = (await manager.listBackups()).find((backup) => backup.version === '2.0.0')
  assert.ok(newest)
  await manager.restoreBackup(newest.id)
  assert.equal(JSON.parse(await readFile(join(installed, 'manifest.json'))).Version, '2.0.0')
  assert.deepEqual(calls, ['stop', 'start', 'stop', 'start', 'stop', 'start'])
  await assert.rejects(() => manager.uninstallPlugin('../unsafe.sdPlugin'), /Некорректный/u)
})

test('icon library indexes every source and imports files without overwriting names', async (t) => {
  const { root, paths } = await fixture(t)
  const libraryPack = join(paths.iconLibrary, 'Свои')
  const elgatoPack = join(paths.elgatoIconPacks, 'Neon.sdIconPack')
  const profile = join(paths.ajazzProfiles, 'Игры.sdProfile')
  await Promise.all([
    mkdir(libraryPack, { recursive: true }),
    mkdir(join(elgatoPack, 'icons'), { recursive: true }),
    mkdir(profile, { recursive: true }),
  ])
  await Promise.all([
    writeFile(join(libraryPack, 'one.png'), 'one'),
    writeFile(join(elgatoPack, 'manifest.json'), JSON.stringify({ Name: 'Неон' })),
    writeFile(join(elgatoPack, 'icons', 'two.svg'), '<svg/>'),
    writeFile(join(profile, 'three.webp'), 'three'),
  ])
  const manager = createStreamDockManager({
    paths,
    platform: 'win32',
    processes: { running: async () => false, stop: async () => {}, start: async () => {} },
  })
  const icons = await manager.listIcons()
  assert.equal(icons.length, 3)
  assert.deepEqual(new Set(icons.map((icon) => icon.source)), new Set(['library', 'elgato', 'ajazz']))
  assert.ok(manager.iconPath(icons[0].id))

  const importFile = join(root, 'one.png')
  await writeFile(importFile, 'imported')
  await manager.importIconFiles([importFile, importFile], 'Свои')
  assert.equal(existsSync(join(libraryPack, 'one (2).png')), true)
  assert.equal(existsSync(join(libraryPack, 'one (3).png')), true)
})

test('bundled projectCHAT control plugin is compiled during installation', async (t) => {
  const { paths } = await fixture(t)
  const id = 'ru.projectchat.control.sdPlugin'
  const source = join(paths.packagedPlugins, id)
  await plugin(source, { name: 'projectCHAT', uuid: 'ru.projectchat.control', version: '0.1.0.0' })
  await writeFile(join(source, 'ProjectChatPlugin.cs'), 'source')
  let compiled = false
  const manager = createStreamDockManager({
    paths,
    platform: 'win32',
    processes: { running: async () => false, stop: async () => {}, start: async () => {} },
    compileProjectChatPlugin: async (target) => {
      compiled = true
      await writeFile(join(target, 'ProjectChatPlugin.exe'), 'compiled')
    },
  })
  const [entry] = await manager.listPlugins()
  assert.equal(entry.compatibility, 'supported')
  await manager.installSource(entry.sourceKey)
  assert.equal(compiled, true)
  assert.equal(existsSync(join(paths.ajazzPlugins, id, 'ProjectChatPlugin.exe')), true)
})
