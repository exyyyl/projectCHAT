'use strict'

const ENDPOINT = 'https://trula.io/api/v1/widget/panel/'
const FIELDS = ['orderVolume', 'playlistVolume']

function parseToken(value) {
  let token = String(value || '').trim()
  if (token.startsWith('https://')) {
    const url = new URL(token)
    if (url.hostname !== 'trula.io' || url.port || url.username || url.password) {
      throw new Error('Вставьте токен или ссылку панели trula.io.')
    }
    token = url.searchParams.get('token') || ''
  }
  if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(token)) {
    throw new Error('Нужен токен из ссылки док-панели Trula.')
  }
  return token.toLowerCase()
}

function volumes(settings, output) {
  if (!['panel', 'source'].includes(output)) throw new Error('Неизвестный выход звука.')
  const result = {}
  for (const field of FIELDS) {
    // Trula uses the panel level when a source level has not been set yet.
    const value = settings?.[output]?.[field] ?? settings?.panel?.[field]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error('Trula вернула неизвестный формат громкости. Обновите плагин.')
    }
    result[field] = value
  }
  return result
}

function outputStatus(settings, output) {
  const levels = volumes(settings, output)
  const mode = settings.panel.volumeSource
  if (!['all', 'panel', 'source'].includes(mode)) throw new Error('Неизвестный режим вывода Trula.')
  return { levels, active: mode === 'all' || mode === output, muted: FIELDS.every(k => levels[k] === 0) }
}

function createClient(token, fetchImpl = globalThis.fetch) {
  token = parseToken(token)
  async function request(method, body) {
    let response
    try {
      response = await fetchImpl(ENDPOINT, {
        method,
        headers: { token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(7000),
        redirect: 'error',
      })
    } catch {
      throw new Error('Trula не отвечает. Проверьте интернет и повторите проверку.')
    }
    if (response.status === 401 || response.status === 403) throw new Error('Trula отклонила токен. Вставьте актуальную ссылку панели.')
    if (response.status === 429) throw new Error('Слишком много запросов к Trula. Подождите и повторите.')
    if (!response.ok) throw new Error(`Ошибка Trula (${response.status}). Повторите проверку.`)
    let data
    try { data = await response.json() } catch { throw new Error('Trula вернула неожиданный ответ.') }
    if (data?.error || data?.code) throw new Error('Trula не приняла команду. Повторите проверку.')
    return data
  }
  return {
    read: () => request('GET'),
    patch: body => request('PATCH', body),
  }
}

// One queue for both outputs: a rapid second press reads the result of the first.
// Polling and token replacement use the same queue as mutations.
function createController({ client, restore = {}, persist = () => {} }) {
  let queue = Promise.resolve()
  const serial = operation => {
    const next = queue.then(operation)
    queue = next.catch(() => {})
    return next
  }
  return {
    read: () => serial(async () => {
      const settings = await client.read()
      outputStatus(settings, 'panel')
      outputStatus(settings, 'source')
      return settings
    }),
    toggle: output => serial(async () => {
      const settings = await client.read()
      const status = outputStatus(settings, output)
      if (!status.active) throw new Error('Этот выход отключён в Trula. Выберите «Оба» в настройках звука Trula.')
      let next
      if (status.muted) {
        const saved = restore[output]
        next = saved && FIELDS.every(k => typeof saved[k] === 'number' && saved[k] >= 0 && saved[k] <= 100)
          && FIELDS.some(k => saved[k] > 0) ? { ...saved } : { orderVolume: 50, playlistVolume: 50 }
      } else {
        restore[output] = { ...status.levels }
        // Save before the request: a lost response must not lose the old levels.
        await persist(structuredClone(restore))
        next = { orderVolume: 0, playlistVolume: 0 }
      }
      // Only send the selected output's music fields. Keep alert and other output settings.
      await client.patch({ [output]: next })
      const actual = await client.read()
      const actualLevels = volumes(actual, output)
      if (FIELDS.some(k => actualLevels[k] !== next[k])) {
        throw new Error('Громкость не подтверждена Trula. Проверьте панель перед повторным нажатием.')
      }
      return actual
    }),
  }
}

module.exports = { createClient, createController, parseToken, volumes, outputStatus }
