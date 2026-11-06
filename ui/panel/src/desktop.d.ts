type DesktopVersionState = {
  supported: boolean
  currentChannel: "stable" | "beta"
  currentVersion: string
  phase:
    | "development"
    | "unsupported"
    | "idle"
    | "checking"
    | "downloading"
    | "unpacking"
    | "restarting"
    | "error"
  target: "stable" | "beta" | null
  progress: number
  message: string
  errors: Partial<Record<"stable" | "beta", string>>
  /** Expected, non-error states such as "no beta newer than stable yet". */
  notices?: Partial<Record<"stable" | "beta", string>>
  slots: Record<
    "stable" | "beta",
    {
      installedVersion: string | null
      availableVersion: string | null
      updateAvailable: boolean
      current: boolean
    }
  >
}
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
  releaseNotes: string[]
  channel: "stable" | "beta"
  message: string
}

type DesktopInfo = {
  version: string
  platform: string
  development: boolean
  versions?: DesktopVersionState
  update: DesktopUpdateState
}

type DesktopPreferences = {
  openAtLogin: boolean
  runInBackground: boolean
  updateChannel: "stable" | "beta"
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
    recordError?(message: string): Promise<void>
    setWindowTheme(theme: import("./domain/app-themes").AppTheme): Promise<void>
    getVersions(): Promise<DesktopVersionState>
    checkVersions(): Promise<DesktopVersionState>
    downloadVersion(branch: "stable" | "beta"): Promise<DesktopVersionState>
    activateVersion(branch: "stable" | "beta"): Promise<boolean>
    markVersionHealthy(): Promise<void>
    onVersionState(callback: (state: DesktopVersionState) => void): () => void
    checkForUpdates(): Promise<DesktopUpdateState>
    downloadUpdate(): Promise<DesktopUpdateState>
    installUpdate(): Promise<boolean>
    onUpdateState(callback: (state: DesktopUpdateState) => void): () => void
    getPreferences(): Promise<DesktopPreferences>
    setPreferences(
      preferences: Partial<
        Pick<
          DesktopPreferences,
          "openAtLogin" | "runInBackground" | "updateChannel"
        >
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
