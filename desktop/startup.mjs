export const LOGIN_LAUNCH_ARGUMENT = '--started-at-login'

export function loginItemQuery(platform) {
  return platform === 'win32' ? { args: [LOGIN_LAUNCH_ARGUMENT] } : {}
}

export function loginItemUpdate(platform, openAtLogin) {
  return {
    openAtLogin,
    ...(platform === 'win32' ? { args: [LOGIN_LAUNCH_ARGUMENT] } : {}),
  }
}

export function wasLaunchedAtLogin({ platform, argv, settings, packaged }) {
  if (!packaged) return false
  if (platform === 'win32') return argv.includes(LOGIN_LAUNCH_ARGUMENT)
  if (platform === 'darwin') return settings.wasOpenedAtLogin === true
  return false
}
