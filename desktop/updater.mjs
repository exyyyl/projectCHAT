const cleanError = error => {
  const message = error instanceof Error ? error.message : String(error || 'Неизвестная ошибка')
  return message.replace(/^Error:\s*/u, '').slice(0, 240)
}

export function createUpdateController({ autoUpdater, currentVersion, isPackaged, updateUrl, emit = () => {} }) {
  let state = {
    phase: !isPackaged ? 'development' : updateUrl ? 'idle' : 'unconfigured',
    currentVersion,
    availableVersion: null,
    progress: 0,
    message: !isPackaged
      ? 'Проверка обновлений доступна в установленной версии.'
      : updateUrl ? '' : 'Адрес обновлений ещё не настроен.',
  }
  const publish = patch => {
    state = { ...state, ...patch }
    emit({ ...state })
    return { ...state }
  }

  if (isPackaged && updateUrl) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowDowngrade = false
    autoUpdater.setFeedURL({ provider: 'generic', url: updateUrl })
    autoUpdater.on('checking-for-update', () => publish({ phase: 'checking', message: '' }))
    autoUpdater.on('update-available', info => publish({ phase: 'available', availableVersion: info.version, progress: 0, message: '' }))
    autoUpdater.on('update-not-available', () => publish({ phase: 'current', availableVersion: null, progress: 0, message: 'Установлена последняя версия.' }))
    autoUpdater.on('download-progress', info => publish({ phase: 'downloading', progress: Math.round(info.percent), message: '' }))
    autoUpdater.on('update-downloaded', info => publish({ phase: 'ready', availableVersion: info.version, progress: 100, message: 'Обновление готово к установке.' }))
    autoUpdater.on('error', error => publish({ phase: 'error', message: cleanError(error) }))
  }

  return {
    snapshot: () => ({ ...state }),
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
