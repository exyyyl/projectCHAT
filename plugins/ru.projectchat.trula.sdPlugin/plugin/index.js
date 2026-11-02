'use strict'

const WebSocket = require('ws')
const { createClient, createController, parseToken, outputStatus } = require('./trula.cjs')
const OUTPUTS = { 'ru.projectchat.trula.stream': 'source', 'ru.projectchat.trula.monitor': 'panel' }
const LABELS = { source: 'Стрим', panel: 'У меня' }

function launch(args = process.argv.slice(2), { makeClient = createClient, pollMs = 5000 } = {}) {
  const options = Object.fromEntries(Array.from({ length: Math.floor(args.length / 2) }, (_, i) => args.slice(i * 2, i * 2 + 2)))
  if (!/^\d+$/.test(options['-port']) || Number(options['-port']) < 1 || Number(options['-port']) > 65535
    || !options['-pluginUUID'] || options['-registerEvent'] !== 'registerPlugin') {
    throw new Error('Stream Dock не передал параметры регистрации.')
  }
  const socket = new WebSocket(`ws://127.0.0.1:${options['-port']}`, { maxPayload: 256 * 1024 })
  const contexts = new Map()
  let globals = {}
  let controller
  let loaded = false
  let latest
  let lastError = ''
  let work = Promise.resolve()
  let refreshPending = false

  function send(event, context, payload, action) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event, context, payload, ...(action ? { action } : {}) }))
  }
  function persist() { send('setGlobalSettings', options['-pluginUUID'], globals) }
  function setController() {
    controller = globals.token ? createController({
      client: makeClient(globals.token),
      restore: globals.restore || {},
      persist: restore => { globals = { ...globals, restore }; persist() },
    }) : undefined
    latest = undefined
  }
  function inspector(context, requestId) {
    const item = contexts.get(context)
    if (!item) return
    let status
    try { if (latest) status = outputStatus(latest, item.output) } catch {}
    send('sendToPropertyInspector', context, {
      event: 'status', connected: Boolean(latest) && !lastError, hasToken: Boolean(globals.token),
      output: item.output, mode: latest?.panel?.volumeSource, status, error: lastError, requestId,
    }, item.action)
  }
  function render() {
    for (const [context, item] of contexts) {
      let title = !globals.token ? 'Токен?' : lastError ? 'Нет связи' : 'Проверка'
      let state = 0
      if (latest && !lastError) {
        const status = outputStatus(latest, item.output)
        state = !status.active || status.muted ? 1 : 0
        title = !status.active ? 'Выход выкл.' : status.muted ? 'Без звука' : 'Звук вкл.'
      }
      send('setState', context, { state })
      send('setTitle', context, { title: `${LABELS[item.output]}\n${title}`, target: 0 })
      inspector(context)
    }
  }
  function enqueue(operation, context, requestId) {
    work = work.then(async () => {
      try { await operation(); lastError = '' } catch (error) {
        // Only our own sanitized API errors reach the inspector; never raw HTTP/WS errors.
        lastError = error.message
        latest = undefined
        if (context) send('showAlert', context, {})
      }
      render()
      if (requestId) inspector(context, requestId)
    }).catch(() => { latest = undefined })
    return work
  }
  function refresh(context) {
    if (!loaded || !controller || refreshPending) { if (context) inspector(context); return }
    refreshPending = true
    enqueue(async () => { latest = await controller.read() }, context).finally(() => { refreshPending = false })
  }

  socket.on('open', () => {
    socket.send(JSON.stringify({ event: options['-registerEvent'], uuid: options['-pluginUUID'] }))
    send('getGlobalSettings', options['-pluginUUID'])
  })
  socket.on('message', raw => {
    let message
    try { message = JSON.parse(raw.toString()) } catch { return }
    const { event, context, action, payload = {} } = message
    if (event === 'didReceiveGlobalSettings') {
      // Our own saves are echoed by the host. Do not replace an in-flight controller.
      if (loaded) return
      loaded = true
      enqueue(async () => {
        globals = { token: payload.settings?.token || '', restore: payload.settings?.restore || {} }
        setController()
        if (controller) latest = await controller.read()
      })
      return
    }
    if (event === 'willDisappear') { contexts.delete(context); return }
    if (!OUTPUTS[action] || !context) return
    if (event === 'willAppear' || event === 'propertyInspectorDidAppear') {
      contexts.set(context, { action, output: OUTPUTS[action] })
      render()
      refresh(context)
    } else if (event === 'keyDown') {
      contexts.set(context, { action, output: OUTPUTS[action] })
      enqueue(async () => {
        if (!loaded || !controller) throw new Error('Откройте настройки кнопки и подключите Trula.')
        latest = await controller.toggle(OUTPUTS[action])
      }, context)
    } else if (event === 'sendToPlugin') {
      contexts.set(context, { action, output: OUTPUTS[action] })
      if (payload.event === 'saveToken') enqueue(async () => {
        if (!loaded) throw new Error('Настройки Stream Dock ещё загружаются. Повторите подключение.')
        const token = parseToken(payload.token)
        // Verify before replacing a working account and its saved volume levels.
        const candidate = await makeClient(token).read()
        outputStatus(candidate, OUTPUTS[action])
        globals = { token, restore: token === globals.token ? globals.restore : {} }
        persist()
        setController()
        latest = candidate
      }, context, payload.requestId)
      else if (payload.event === 'disconnect') enqueue(async () => {
        globals = {}; persist(); setController()
      }, context)
      else if (payload.event === 'check') { render(); refresh(context) }
    }
  })
  socket.on('error', () => { /* Host connection errors carry no user data into logs. */ })
  const timer = setInterval(() => { if (contexts.size) refresh() }, pollMs)
  socket.on('close', () => { clearInterval(timer) })
  return socket
}

if (require.main === module) {
  try { launch() } catch { process.stderr.write('Trula Audio: неверные параметры запуска Stream Dock.\n'); process.exitCode = 1 }
}
module.exports = { launch }
