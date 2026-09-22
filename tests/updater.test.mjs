import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import { createUpdateController } from '../desktop/updater.mjs'

class FakeUpdater extends EventEmitter {
  checks = 0
  downloads = 0
  installs = 0
  setFeedURL(options) { this.feed = options }
  async checkForUpdates() { this.checks++; this.emit('update-available', { version: '0.3.0', releaseNotes: '- Новые конкурсы\n- Исправлен Stream Dock' }) }
  async downloadUpdate() {
    this.downloads++
    this.emit('download-progress', { percent: 42.4 })
    this.emit('update-downloaded', { version: '0.3.0', releaseNotes: '- Новые конкурсы\n- Исправлен Stream Dock' })
  }
  quitAndInstall() { this.installs++ }
}

test('desktop updater waits for explicit download and install actions', async () => {
  const updater = new FakeUpdater()
  const states = []
  const controller = createUpdateController({ autoUpdater: updater, currentVersion: '0.2.0', isPackaged: true, updateUrl: 'https://updates.example.test', emit: state => states.push(state) })
  assert.deepEqual(updater.feed, { provider: 'generic', url: 'https://updates.example.test' })
  assert.equal(updater.channel, 'latest')
  assert.equal(updater.allowPrerelease, false)
  assert.equal(updater.autoDownload, false)
  assert.equal(updater.autoInstallOnAppQuit, false)

  await controller.check()
  assert.equal(updater.checks, 1)
  assert.equal(updater.downloads, 0)
  assert.equal(controller.snapshot().phase, 'available')
  assert.equal(controller.snapshot().availableVersion, '0.3.0')
  assert.deepEqual(controller.snapshot().releaseNotes, ['Новые конкурсы', 'Исправлен Stream Dock'])

  await controller.download()
  assert.equal(updater.downloads, 1)
  assert.ok(states.some(state => state.phase === 'downloading' && state.progress === 42))
  assert.equal(controller.snapshot().phase, 'ready')
  assert.equal(updater.installs, 0)

  assert.equal(controller.install(), true)
  assert.equal(updater.installs, 1)
})

test('desktop updater switches between stable and beta GitHub channels', () => {
  const updater = new FakeUpdater()
  const controller = createUpdateController({
    autoUpdater: updater,
    currentVersion: '0.7.5',
    channel: 'beta',
    isPackaged: true,
    updateUrl: 'https://github.com/exyyyl/projectCHAT/releases/latest/download',
  })

  assert.deepEqual(updater.feed, {
    provider: 'github',
    owner: 'exyyyl',
    repo: 'projectCHAT',
  })
  assert.equal(updater.channel, 'beta')
  assert.equal(updater.allowPrerelease, true)
  assert.equal(updater.allowDowngrade, false)
  assert.equal(controller.snapshot().channel, 'beta')

  controller.setChannel('stable')
  assert.equal(updater.channel, 'latest')
  assert.equal(updater.allowPrerelease, false)
  assert.equal(controller.snapshot().channel, 'stable')
  assert.equal(controller.snapshot().phase, 'idle')
})

test('desktop updater stays inert when no release source is configured', async () => {
  const updater = new FakeUpdater()
  const controller = createUpdateController({ autoUpdater: updater, currentVersion: '0.2.0', isPackaged: true, updateUrl: '' })
  assert.equal(controller.snapshot().phase, 'unconfigured')
  await controller.check()
  await controller.download()
  assert.equal(updater.checks, 0)
  assert.equal(updater.downloads, 0)
  assert.equal(controller.install(), false)

  controller.setChannel('beta')
  assert.equal(controller.snapshot().phase, 'unconfigured')
  assert.match(controller.snapshot().message, /не настроен/u)
})

test('development updater keeps its explanatory state when channel changes', () => {
  const controller = createUpdateController({ autoUpdater: new FakeUpdater(), currentVersion: '0.7.5', isPackaged: false, updateUrl: '' })
  controller.setChannel('beta')
  assert.equal(controller.snapshot().phase, 'development')
  assert.equal(controller.snapshot().channel, 'beta')
  assert.match(controller.snapshot().message, /установленной версии/u)
})

test('bundled release notes keep only the important user-facing changes', async () => {
  const notes = (await readFile('build/release-notes.md', 'utf8'))
    .split('\n')
    .filter(line => line.startsWith('- '))
  assert.equal(notes.length, 3)
  assert.doesNotMatch(notes.join('\n'), /клавиатур|мыши|переустанов/u)
})
