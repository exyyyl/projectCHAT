import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const plugin = join(root, '..', 'build', 'stream-dock-plugins', 'ru.projectchat.control.sdPlugin')

test('bundled Stream Dock plugin exposes universal poll controls and preset selection', async () => {
  const manifest = JSON.parse(await readFile(join(plugin, 'manifest.json'), 'utf8'))
  assert.equal(manifest.UUID, 'ru.projectchat.control')
  assert.equal(manifest.CodePathWin, 'ProjectChatPlugin.exe')
  assert.equal(manifest.Version, '0.5.0')
  assert.deepEqual(
    manifest.Actions.map((action) => action.UUID),
    [
      'ru.projectchat.control.toggle-poll',
      'ru.projectchat.control.toggle-output',
      'ru.projectchat.control.extend',
      'ru.projectchat.control.select-preset',
    ],
  )
  const presetAction = manifest.Actions.find(action => action.UUID === 'ru.projectchat.control.select-preset')
  assert.equal(presetAction.PropertyInspectorPath, 'property-inspector/preset.html')
  assert.equal(manifest.Actions[0].States.length, 2)
  for (const image of ['plugin', 'start', 'finish', 'visibility', 'extend', 'preset']) {
    assert.ok((await stat(join(plugin, 'images', `${image}.png`))).size > 100)
  }
  const source = await readFile(join(plugin, 'ProjectChatPlugin.cs'), 'utf8')
  const inspector = await readFile(join(plugin, 'property-inspector', 'preset.html'), 'utf8')
  assert.match(source, /ClientWebSocket/u)
  assert.match(source, /127\.0\.0\.1:4317\/api\/stream-dock/u)
  assert.match(source, /setState|sendToPropertyInspector/u)
  assert.match(inspector, /setSettings|sendToPlugin/u)
})

test('Stream Dock controls are available in packaged UI', async () => {
  const app = await readFile(join(root, '..', 'ui', 'panel', 'src', 'App.tsx'), 'utf8')
  const page = await readFile(join(root, '..', 'ui', 'panel', 'src', 'components', 'stream-dock-page.tsx'), 'utf8')
  assert.doesNotMatch(app, /streamDockComingSoon/u)
  assert.doesNotMatch(page, /StreamDockComingSoon|releasePreview/u)
  assert.match(page, /projectCHAT Control/u)
  assert.match(page, /PROJECTCHAT_PLUGIN_VERSION = "0\.5\.0"/u)
  assert.match(page, /Ajazz-Twitch-Setup\.exe/u)
  assert.match(page, /TWITCH_PLUGIN_VERSION = "1\.11\.6\.15-ajazz\.5"/u)
  assert.match(page, /Старт \/ стоп/u)
  assert.match(page, /twitch-ajazz\.svg/u)
  assert.match(page, /function PluginActionGrid/u)
  assert.doesNotMatch(page, /function DeviceBar/u)
  assert.doesNotMatch(page, /Встроен|16 действий|Только Windows/u)
  assert.doesNotMatch(page, /Выбрать \.sdPlugin|Наборы Elgato|Поиск плагина|Поиск иконки/u)
})
