const updateUrl = process.env.STREAM_POLLS_UPDATE_URL || 'https://updates.invalid/projectchat'

module.exports = {
  appId: 'ru.projectchat.app',
  productName: 'Cue',
  copyright: 'Copyright © 2026 exyyyl. All rights reserved.',
  generateUpdatesFilesForAllChannels: true,
  asar: true,
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: [
    'desktop/**/*',
    'build/icon.png',
    'build/release-notes.md',
    'build/tray-icon.png',
    'build/tray-icon@2x.png',
    'build/tray-icon-template.png',
    'build/tray-icon-template@2x.png',
    'server/**/*',
    'public/**/*',
    'package.json',
    '!desktop/update-config.json',
    '!public/panel-build/vite.svg',
  ],
  extraResources: [
    { from: 'build/update-config.json', to: 'update-config.json' },
    { from: 'build/stream-dock-plugins', to: 'stream-dock-plugins' },
    ...(process.platform === 'win32' ? [{ from: 'build/input-capture', to: 'input-capture' }] : []),
  ],
  publish: {
    provider: 'generic',
    url: updateUrl,
  },
  releaseInfo: {
    releaseNotesFile: 'build/release-notes.md',
  },
  win: {
    icon: 'build/icon.png',
    legalTrademarks: 'Cue © 2026 exyyyl',
    target: [{ target: 'nsis', arch: ['x64'] }],
    artifactName: 'Cue-Setup-${version}.${ext}',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Cue',
  },
  mac: {
    icon: 'build/icon.png',
    target: [{ target: 'dmg', arch: [process.arch] }],
    artifactName: 'Cue-${version}-${arch}.${ext}',
  },
}
