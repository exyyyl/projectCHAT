const cleanError = error => {
  const message = error instanceof Error ? error.message : String(error || 'Неизвестная ошибка')
  return message.replace(/^Error:\s*/u, '').slice(0, 240)
}

const cleanReleaseNotes = value => {
  const notes = Array.isArray(value)
    ? value.flatMap(entry => typeof entry === 'string' ? entry : entry?.note || '')
    : [value]
  return notes
    .flatMap(note => String(note || '').split(/\r?\n/u))
    .map(note => note.replace(/^\s*(?:[-*+]\s+|#{1,6}\s*)/u, '').trim())
    .filter(note => note && !/^v?\d+\.\d+\.\d+$/iu.test(note))
    .slice(0, 6)
    .map(note => note.slice(0, 180))
}

const normalizeChannel = value => value === 'beta' ? 'beta' : 'stable'

const updateFeed = updateUrl => {
  const github = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases(?:\/|$)/iu.exec(updateUrl)
  return github
    ? { provider: 'github', owner: github[1], repo: github[2] }
    : { provider: 'generic', url: updateUrl }
}

const restingState = ({ isPackaged, updateUrl }) => ({
  phase: !isPackaged ? 'development' : updateUrl ? 'idle' : 'unconfigured',
  message: !isPackaged
    ? 'Проверка обновлений доступна в установленной версии.'
    : updateUrl ? '' : 'Адрес обновлений ещё не настроен.',
})

export function createUpdateController({ autoUpdater, currentVersion, currentReleaseNotes = '', channel = 'stable', isPackaged, updateUrl, emit = () => {} }) {
  const installedReleaseNotes = cleanReleaseNotes(currentReleaseNotes)
  let selectedChannel = normalizeChannel(channel)
  let state = {
    phase: restingState({ isPackaged, updateUrl }).phase,
    currentVersion,
    availableVersion: null,
    progress: 0,
    releaseNotes: installedReleaseNotes,
    channel: selectedChannel,
    message: restingState({ isPackaged, updateUrl }).message,
  }
  const publish = patch => {
    state = { ...state, ...patch }
    emit({ ...state })
    return { ...state }
  }

  if (isPackaged && updateUrl) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.setFeedURL(updateFeed(updateUrl))
    const applyChannel = () => {
      autoUpdater.channel = selectedChannel === 'beta' ? 'beta' : 'latest'
      autoUpdater.allowPrerelease = selectedChannel === 'beta'
      autoUpdater.allowDowngrade = false
    }
    applyChannel()
    autoUpdater.on('checking-for-update', () => publish({ phase: 'checking', message: '' }))
    autoUpdater.on('update-available', info => publish({
      phase: 'available',
      availableVersion: info.version,
      progress: 0,
      releaseNotes: cleanReleaseNotes(info.releaseNotes),
      message: '',
    }))
    autoUpdater.on('update-not-available', () => publish({ phase: 'current', availableVersion: null, progress: 0, releaseNotes: installedReleaseNotes, message: 'Установлена последняя версия.' }))
    autoUpdater.on('download-progress', info => publish({ phase: 'downloading', progress: Math.round(info.percent), message: '' }))
    autoUpdater.on('update-downloaded', info => publish({
      phase: 'ready',
      availableVersion: info.version,
      progress: 100,
      releaseNotes: cleanReleaseNotes(info.releaseNotes).length ? cleanReleaseNotes(info.releaseNotes) : state.releaseNotes,
      message: 'Обновление готово к установке.',
    }))
    autoUpdater.on('error', error => publish({ phase: 'error', message: cleanError(error) }))
  }

  return {
    snapshot: () => ({ ...state }),
    setChannel(channel) {
      selectedChannel = normalizeChannel(channel)
      if (isPackaged && updateUrl) {
        autoUpdater.channel = selectedChannel === 'beta' ? 'beta' : 'latest'
        autoUpdater.allowPrerelease = selectedChannel === 'beta'
        autoUpdater.allowDowngrade = false
      }
      return publish({
        ...restingState({ isPackaged, updateUrl }),
        availableVersion: null,
        progress: 0,
        releaseNotes: installedReleaseNotes,
        channel: selectedChannel,
      })
    },
    async check() {
      if (!isPackaged || !updateUrl) return { ...state }
      if (['checking', 'downloading'].includes(state.phase)) return { ...state }
      publish({ phase: 'checking', message: '' })
      try { await autoUpdater.checkForUpdates() }
      catch (error) { publish({ phase: 'error', message: cleanError(error) }) }
      return { ...state }
    },
    async download() {
      if (state.phase !== 'available') return { ...state }
      publish({ phase: 'downloading', progress: 0, message: '' })
      try { await autoUpdater.downloadUpdate() }
      catch (error) { publish({ phase: 'error', message: cleanError(error) }) }
      return { ...state }
    },
    install() {
      if (state.phase !== 'ready') return false
      autoUpdater.quitAndInstall(false, true)
      return true
    },
  }
}
