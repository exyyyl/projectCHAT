'use strict'

let socket
let context
let action
let pendingTimer
let pendingRequest
const field = document.querySelector('#token')
const connectButton = document.querySelector('#connect')
const checkButton = document.querySelector('#check')
const disconnectButton = document.querySelector('#disconnect')
const statusElement = document.querySelector('#status')

function send(payload) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event: 'sendToPlugin', context, action, payload }))
}
function showStatus(text, error = false) {
  statusElement.textContent = text
  statusElement.dataset.error = String(error)
}
document.querySelector('#connection').addEventListener('submit', event => {
  event.preventDefault()
  connectButton.disabled = true
  pendingRequest = String(Date.now())
  showStatus('Проверяем подключение…')
  send({ event: 'saveToken', token: field.value, requestId: pendingRequest })
  clearTimeout(pendingTimer)
  pendingTimer = setTimeout(() => {
    connectButton.disabled = false
    pendingRequest = undefined
    showStatus('Ответ не получен. Нажмите «Проверить связь» или подключите заново.', true)
  }, 20000)
})
checkButton.addEventListener('click', () => { showStatus('Проверяем связь…'); send({ event: 'check' }) })
disconnectButton.addEventListener('click', () => send({ event: 'disconnect' }))

window.connectElgatoStreamDeckSocket = function (port, uuid, registerEvent, info, actionInfo) {
  context = uuid
  const details = typeof actionInfo === 'string' ? JSON.parse(actionInfo) : actionInfo
  action = details.action
  const stream = action === 'ru.projectchat.trula.stream'
  document.querySelector('#output').textContent = stream ? 'Звук на стриме' : 'Звук у стримера'
  document.querySelector('#description').textContent = stream ? 'Музыка в источнике Trula OBS.' : 'Музыка в док-панели Trula.'
  socket = new WebSocket(`ws://127.0.0.1:${port}`)
  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ event: registerEvent, uuid }))
    connectButton.disabled = false
    checkButton.disabled = false
    send({ event: 'check' })
  })
  socket.addEventListener('message', event => {
    let message
    try { message = JSON.parse(event.data) } catch { return }
    if (message.event !== 'sendToPropertyInspector' || message.payload?.event !== 'status') return
    const data = message.payload
    if (pendingRequest && data.requestId !== pendingRequest) return
    const completedConnection = Boolean(pendingRequest)
    pendingRequest = undefined
    clearTimeout(pendingTimer)
    connectButton.disabled = false
    disconnectButton.hidden = !data.hasToken
    document.querySelector('#levels').hidden = !data.connected
    if (data.connected) {
      if (completedConnection) field.value = ''
      connectButton.textContent = 'Сменить подключение'
      document.querySelector('#orders').textContent = `${data.status.levels.orderVolume}%`
      document.querySelector('#playlist').textContent = `${data.status.levels.playlistVolume}%`
      showStatus(!data.status.active ? 'Этот выход отключён. Выберите «Оба» в Trula.' : data.status.muted ? 'Подключено · музыка выключена' : 'Подключено · музыка включена')
    } else {
      connectButton.textContent = data.hasToken ? 'Сменить подключение' : 'Подключить Trula'
      showStatus(data.error || (data.hasToken ? 'Проверяем связь…' : 'Вставьте ссылку панели Trula.'), Boolean(data.error))
    }
  })
  socket.addEventListener('close', () => {
    clearTimeout(pendingTimer)
    connectButton.disabled = true
    checkButton.disabled = true
    showStatus('Нет связи со Stream Dock. Выберите кнопку заново.', true)
  })
}
window.connectStreamDockSocket = window.connectElgatoStreamDeckSocket
