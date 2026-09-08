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
  update: DesktopUpdateState
}

interface Window {
  streamPollsDesktop?: {
    getInfo(): Promise<DesktopInfo>
    checkForUpdates(): Promise<DesktopUpdateState>
    downloadUpdate(): Promise<DesktopUpdateState>
    installUpdate(): Promise<boolean>
    onUpdateState(callback: (state: DesktopUpdateState) => void): () => void
  }
}
