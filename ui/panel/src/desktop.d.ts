type DesktopUpdatePhase =
  | "development"
  | "unconfigured"
  | "idle"
  | "checking"
  | "current"
  | "available"
  | "downloading"
  | "ready"
  | "error"

type DesktopUpdateState = {
  phase: DesktopUpdatePhase
  currentVersion: string
  availableVersion: string | null
  progress: number
  message: string
}

type DesktopInfo = {
  version: string
  platform: string
  development: boolean
  update: DesktopUpdateState
}

type DesktopPreferences = {
  openAtLogin: boolean
  runInBackground: boolean
  openAtLoginSupported: boolean
  runInBackgroundSupported: boolean
}

type StreamDockCompatibility =
  "supported" | "experimental" | "protected" | "unsupported" | "installed-only"

type StreamDockStatus = {
  platform: string
  supported: boolean
  ajazzFound: boolean
  ajazzRunning: boolean
  elgatoFound: boolean
  elgatoPluginCount: number
  paths: null | {
    ajazzPlugins: string
    elgatoPlugins: string
    iconLibrary: string
    backupRoot: string
  }
}

type StreamDockPlugin = {
  id: string
  sourceKey: string
  name: string
  version: string
  installedVersion: string | null
  sourceLabel: string
  actionCount: number
  isInstalled: boolean
  isPackaged: boolean
  isIconEditor: boolean
  isProtected: boolean
  compatibility: StreamDockCompatibility
}

type StreamDockIcon = {
  id: string
  name: string
  packName: string
  source: "library" | "elgato" | "ajazz"
  sourceLabel: string
  folder: string
  extension: string
  size: number
  previewUrl: string
}

type StreamDockBackup = {
  id: string
  pluginId: string
  pluginName: string
  version: string
  createdAt: string
}

type StreamDockOperation = {
  backupCreated?: boolean
  imported?: number
}

interface Window {
  streamPollsDesktop?: {
    getInfo(): Promise<DesktopInfo>
    checkForUpdates(): Promise<DesktopUpdateState>
    downloadUpdate(): Promise<DesktopUpdateState>
    installUpdate(): Promise<boolean>
    onUpdateState(callback: (state: DesktopUpdateState) => void): () => void
    getPreferences(): Promise<DesktopPreferences>
    setPreferences(
      preferences: Partial<
        Pick<DesktopPreferences, "openAtLogin" | "runInBackground">
      >
    ): Promise<DesktopPreferences>
    streamDock: {
      getStatus(): Promise<StreamDockStatus>
      listPlugins(): Promise<StreamDockPlugin[]>
      choosePlugin(): Promise<StreamDockPlugin | null>
      installPlugin(sourceKey: string): Promise<StreamDockOperation>
      uninstallPlugin(pluginId: string): Promise<StreamDockOperation>
      listIcons(): Promise<StreamDockIcon[]>
      importIconFiles(): Promise<StreamDockOperation | null>
      importIconFolder(): Promise<StreamDockOperation | null>
      copyIconPath(id: string): Promise<boolean>
      revealIcon(id: string): Promise<boolean>
      listBackups(): Promise<StreamDockBackup[]>
      restoreBackup(backupId: string): Promise<StreamDockOperation>
    }
  }
}
