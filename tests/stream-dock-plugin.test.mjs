import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const plugin = join(root, '..', 'build', 'stream-dock-plugins', 'ru.projectchat.control.sdPlugin')

test('bundled Stream Dock plugin exposes the five projectCHAT controls and complete artwork', async () => {
  const manifest = JSON.parse(await readFile(join(plugin, 'manifest.json'), 'utf8'))
  assert.equal(manifest.UUID, 'ru.projectchat.control')
  assert.equal(manifest.CodePathWin, 'ProjectChatPlugin.exe')
  assert.deepEqual(
    manifest.Actions.map((action) => action.UUID),
    [
      'ru.projectchat.control.start',
      'ru.projectchat.control.finish',
      'ru.projectchat.control.toggle-output',
      'ru.projectchat.control.extend',
      'ru.projectchat.control.next-preset',
    ],
  )
  for (const image of ['plugin', 'start', 'finish', 'visibility', 'extend', 'preset']) {
    assert.ok((await stat(join(plugin, 'images', `${image}.png`))).size > 100)
  }
  const source = await readFile(join(plugin, 'ProjectChatPlugin.cs'), 'utf8')
  assert.match(source, /ClientWebSocket/u)
  assert.match(source, /127\.0\.0\.1:4317\/api\/stream-dock/u)
})
