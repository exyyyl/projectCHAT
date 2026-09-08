import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createUpdateController } from '../desktop/updater.mjs'

class FakeUpdater extends EventEmitter {
  checks = 0
  downloads = 0
  installs = 0
  setFeedURL(options) { this.feed = options }
  async checkForUpdates() { this.checks++; this.emit('update-available', { version: '0.3.0' }) }
  async downloadUpdate() {
    this.downloads++
    this.emit('download-progress', { percent: 42.4 })
    this.emit('update-downloaded', { version: '0.3.0' })
  }
  quitAndInstall() { this.installs++ }
}

test('desktop updater waits for explicit download and install actions', async () => {
  const updater = new FakeUpdater()
  const states = []
  const controller = createUpdateController({ autoUpdater: updater, currentVersion: '0.2.0', isPackaged: true, updateUrl: 'https://updates.example.test', emit: state => states.push(state) })
  assert.deepEqual(updater.feed, { provider: 'generic', url: 'https://updates.example.test' })
  assert.equal(updater.autoDownload, false)
  assert.equal(updater.autoInstallOnAppQuit, false)

  await controller.check()
  assert.equal(updater.checks, 1)
  assert.equal(updater.downloads, 0)
  assert.equal(controller.snapshot().phase, 'available')
  assert.equal(controller.snapshot().availableVersion, '0.3.0')

  await controller.download()
  assert.equal(updater.downloads, 1)
  assert.ok(states.some(state => state.phase === 'downloading' && state.progress === 42))
  assert.equal(controller.snapshot().phase, 'ready')
  assert.equal(updater.installs, 0)

  assert.equal(controller.install(), true)
  assert.equal(updater.installs, 1)
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
})
