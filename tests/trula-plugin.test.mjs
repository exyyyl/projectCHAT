import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { once } from 'node:events'
import { runInNewContext } from 'node:vm'

const require = createRequire(import.meta.url)
const { createClient, createController, parseToken, outputStatus } = require('../plugins/ru.projectchat.trula.sdPlugin/plugin/trula.cjs')
const token = '00000000-0000-4000-8000-000000000000'
function fixture() {
  let state = {
    panel: { orderVolume: 34, playlistVolume: 19, eventVolume: 65, volumeSource: 'all' },
    source: { orderVolume: 72, playlistVolume: 40, isTitleVisible: true },
  }
  const patches = []
  const client = {
    read: async () => structuredClone(state),
    patch: async patch => {
      patches.push(structuredClone(patch))
      for (const [output, changes] of Object.entries(patch)) Object.assign(state[output], changes)
    },
  }
  return { client, patches, get state() { return state }, set state(value) { state = value } }
}

test('Trula accepts a token or its own panel link; rejects other destinations', () => {
  assert.equal(parseToken(`https://trula.io/cp/?token=${token}`), token)
  assert.equal(parseToken(` ${token} `), token)
  for (const value of [`https://evil.example/?token=${token}`, '', 'bad', `https://trula.io.evil.example/?token=${token}`]) {
    assert.throws(() => parseToken(value))
  }
})

test('mute and unmute only change the selected output, preserving unequal levels and alerts', async () => {
  const f = fixture()
  const original = structuredClone(f.state)
  let saved
  const controller = createController({ client: f.client, persist: value => { saved = value } })
  await controller.toggle('source')
  assert.deepEqual(f.patches[0], { source: { orderVolume: 0, playlistVolume: 0 } })
  assert.deepEqual(f.state.panel, original.panel)
  assert.equal(f.state.source.isTitleVisible, true)
  assert.deepEqual(saved.source, { orderVolume: 72, playlistVolume: 40 })
  // Saved levels survive a plugin restart.
  await createController({ client: f.client, restore: saved }).toggle('source')
  assert.deepEqual(f.state, original)
  await controller.toggle('panel')
  assert.deepEqual(f.state.source, original.source)
  assert.equal(f.state.panel.eventVolume, 65)
  await controller.toggle('panel')
  assert.deepEqual(f.state, original)
})

test('rapid presses are serialized across both outputs', async () => {
  const f = fixture()
  const original = structuredClone(f.state)
  const controller = createController({ client: f.client })
  await Promise.all([controller.toggle('source'), controller.toggle('panel'), controller.toggle('source'), controller.toggle('panel')])
  assert.deepEqual(f.state, original)
  assert.equal(f.patches.length, 4)
})

test('disabled route refuses mutation, null source levels inherit panel levels', async () => {
  const f = fixture()
  f.state.panel.volumeSource = 'panel'
  await assert.rejects(createController({ client: f.client }).toggle('source'), /выход отключён/)
  assert.equal(f.patches.length, 0)
  f.state.panel.volumeSource = 'all'
  f.state.source.orderVolume = null
  f.state.source.playlistVolume = null
  let saved
  await createController({ client: f.client, persist: value => { saved = value } }).toggle('source')
  assert.deepEqual(saved.source, { orderVolume: 34, playlistVolume: 19 })
})

test('fresh mute state uses 50% fallback; invalid stored levels cannot be sent', async () => {
  const f = fixture()
  f.state.source.orderVolume = f.state.source.playlistVolume = 0
  await createController({ client: f.client, restore: { source: { orderVolume: '90', playlistVolume: 200 } } }).toggle('source')
  assert.deepEqual(f.state.source, { orderVolume: 50, playlistVolume: 50, isTitleVisible: true })
  f.state.panel.orderVolume = '50'
  assert.throws(() => outputStatus(f.state, 'panel'), /формат/)
})

test('failed or unconfirmed writes do not report success, and the queue recovers', async () => {
  const f = fixture()
  let fail = true
  const patch = f.client.patch
  f.client.patch = async value => { if (fail) throw new Error('offline'); return patch(value) }
  const controller = createController({ client: f.client })
  await assert.rejects(controller.toggle('source'), /offline/)
  fail = false
  await controller.toggle('source')
  assert.equal(f.state.source.orderVolume, 0)
  f.client.patch = async () => {}
  await assert.rejects(controller.toggle('source'), /не подтверждена/)
})

test('HTTP uses the token header, a fixed TLS endpoint, narrow PATCH, and sanitized errors', async () => {
  const calls = []
  const client = createClient(token, async (url, options) => {
    calls.push({ url, ...options })
    return { ok: true, json: async () => ({ panel: {} }) }
  })
  await client.read()
  await client.patch({ panel: { orderVolume: 0, playlistVolume: 0 } })
  assert.equal(calls[0].url, 'https://trula.io/api/v1/widget/panel/')
  assert.equal(calls[0].headers.token, token)
  assert.equal(calls[0].redirect, 'error')
  assert.equal(calls[1].method, 'PATCH')
  assert.deepEqual(JSON.parse(calls[1].body), { panel: { orderVolume: 0, playlistVolume: 0 } })
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(createClient(token, async () => ({ status, ok: false })).read(), error => !error.message.includes(token))
  }
  await assert.rejects(createClient(token, async () => { throw new Error(token) }).read(), error => !error.message.includes(token))
})

test('manifest declares two independent keys, Node 20 and manual state control', async () => {
  const root = new URL('../plugins/ru.projectchat.trula.sdPlugin/', import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root)))
  assert.equal(manifest.Nodejs.Version, '20')
  assert.equal(manifest.Actions.length, 2)
  for (const action of manifest.Actions) {
    assert.equal(action.DisableAutomaticStates, true)
    assert.equal(action.States.length, 2)
    await readFile(new URL(action.PropertyInspectorPath, root))
  }
})

test('inspector waits for its connection result and preserves a replacement token during status polling', async () => {
  const elements = new Map()
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, { value: '', dataset: {}, listeners: {}, addEventListener(event, callback) { this.listeners[event] = callback } })
    return elements.get(selector)
  }
  let socket
  class Socket {
    static OPEN = 1
    readyState = 1
    listeners = {}
    sent = []
    constructor() { socket = this }
    addEventListener(event, callback) { this.listeners[event] = callback }
    send(raw) { this.sent.push(JSON.parse(raw)) }
  }
  const window = {}
  const source = await readFile(new URL('../plugins/ru.projectchat.trula.sdPlugin/property-inspector/inspector.js', import.meta.url), 'utf8')
  runInNewContext(source, { window, document: { querySelector: element }, WebSocket: Socket, setTimeout: () => 1, clearTimeout: () => {} })
  window.connectElgatoStreamDeckSocket(1234, 'pi', 'registerPropertyInspector', '{}', JSON.stringify({ action: 'ru.projectchat.trula.stream' }))
  socket.listeners.open()
  const field = element('#token')
  field.value = 'replacement-token-being-typed'
  const connected = { event: 'status', connected: true, hasToken: true, status: { active: true, muted: false, levels: { orderVolume: 50, playlistVolume: 50 } } }
  const receive = payload => socket.listeners.message({ data: JSON.stringify({ event: 'sendToPropertyInspector', payload }) })
  receive(connected)
  assert.equal(field.value, 'replacement-token-being-typed')
  element('#connection').listeners.submit({ preventDefault() {} })
  const requestId = socket.sent.at(-1).payload.requestId
  receive(connected)
  assert.equal(element('#connect').disabled, true)
  assert.equal(field.value, 'replacement-token-being-typed')
  receive({ ...connected, requestId })
  assert.equal(element('#connect').disabled, false)
  assert.equal(field.value, '')
})

test('Stream Dock protocol registers, shares a token, drives independent keys and never exposes it to the inspector', async t => {
  const pluginRequire = createRequire(new URL('../plugins/ru.projectchat.trula.sdPlugin/package.json', import.meta.url))
  const { WebSocketServer } = pluginRequire('ws')
  const { launch } = pluginRequire('./plugin/index.js')
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await once(server, 'listening')
  let host
  let plugin
  t.after(async () => {
    const closed = plugin ? once(plugin, 'close') : Promise.resolve()
    plugin?.close()
    host?.close()
    await closed
    await new Promise(resolve => server.close(resolve))
  })
  const frames = []
  const waiters = new Set()
  const waitFor = predicate => {
    if (frames.some(predicate)) return Promise.resolve(frames.find(predicate))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { waiters.delete(callback); reject(new Error('Expected Stream Dock frame was not received')) }, 3000)
      const callback = frame => { if (predicate(frame)) { clearTimeout(timer); waiters.delete(callback); resolve(frame) } }
      waiters.add(callback)
    })
  }
  const connected = once(server, 'connection')
  const f = fixture()
  plugin = launch(['-port', String(server.address().port), '-pluginUUID', 'plugin-id', '-registerEvent', 'registerPlugin'], { makeClient: () => f.client, pollMs: 60000 })
  ;[host] = await connected
  host.on('message', raw => { const frame = JSON.parse(raw); frames.push(frame); for (const notify of waiters) notify(frame) })
  await waitFor(frame => frame.event === 'registerPlugin' && frame.uuid === 'plugin-id')
  await waitFor(frame => frame.event === 'getGlobalSettings')
  const send = frame => host.send(JSON.stringify(frame))
  send({ event: 'didReceiveGlobalSettings', payload: { settings: {} } })
  const stream = { context: 'stream-key', action: 'ru.projectchat.trula.stream' }
  const monitor = { context: 'monitor-key', action: 'ru.projectchat.trula.monitor' }
  send({ event: 'willAppear', ...stream })
  send({ event: 'willAppear', ...monitor })
  send({ event: 'sendToPlugin', ...stream, payload: { event: 'saveToken', token: `https://trula.io/cp/?token=${token}`, requestId: 'connect-1' } })
  await waitFor(frame => frame.event === 'setGlobalSettings' && frame.payload.token === token)
  await waitFor(frame => frame.event === 'sendToPropertyInspector' && frame.payload.connected)
  await waitFor(frame => frame.event === 'sendToPropertyInspector' && frame.payload.requestId === 'connect-1' && frame.payload.connected)
  // Host echo must not roll back in-flight commands.
  send({ event: 'didReceiveGlobalSettings', payload: { settings: { token } } })
  send({ event: 'keyDown', ...stream })
  await waitFor(frame => frame.event === 'setTitle' && frame.context === stream.context && frame.payload.title.includes('Без звука'))
  assert.equal(f.state.source.orderVolume, 0)
  assert.equal(f.state.panel.orderVolume, 34)
  send({ event: 'keyDown', ...monitor })
  await waitFor(frame => frame.event === 'setTitle' && frame.context === monitor.context && frame.payload.title.includes('Без звука'))
  assert.equal(f.state.panel.orderVolume, 0)
  for (const frame of frames.filter(frame => frame.event === 'sendToPropertyInspector')) assert.ok(!JSON.stringify(frame).includes(token))
  send({ event: 'sendToPlugin', ...stream, payload: { event: 'disconnect' } })
  await waitFor(frame => frame.event === 'setGlobalSettings' && !frame.payload.token)
})
