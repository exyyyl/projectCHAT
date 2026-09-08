const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('streamPollsDesktop', {
  getInfo: () => ipcRenderer.invoke('desktop:get-info'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  getPreferences: () => ipcRenderer.invoke('desktop:preferences:get'),
  setPreferences: preferences => ipcRenderer.invoke('desktop:preferences:set', preferences),
  onUpdateState(callback) {
    const listener = (_event, state) => callback(state)
    ipcRenderer.on('updates:state', listener)
    return () => ipcRenderer.removeListener('updates:state', listener)
  },
  streamDock: {
    getStatus: () => ipcRenderer.invoke('stream-dock:status'),
    listPlugins: () => ipcRenderer.invoke('stream-dock:plugins'),
    choosePlugin: () => ipcRenderer.invoke('stream-dock:choose-plugin'),
    installPlugin: sourceKey => ipcRenderer.invoke('stream-dock:install', sourceKey),
    uninstallPlugin: pluginId => ipcRenderer.invoke('stream-dock:uninstall', pluginId),
    listIcons: () => ipcRenderer.invoke('stream-dock:icons'),
    importIconFiles: () => ipcRenderer.invoke('stream-dock:import-icon-files'),
    importIconFolder: () => ipcRenderer.invoke('stream-dock:import-icon-folder'),
    copyIconPath: id => ipcRenderer.invoke('stream-dock:copy-icon-path', id),
    revealIcon: id => ipcRenderer.invoke('stream-dock:reveal-icon', id),
    listBackups: () => ipcRenderer.invoke('stream-dock:backups'),
    restoreBackup: backupId => ipcRenderer.invoke('stream-dock:restore', backupId),
  },
})
