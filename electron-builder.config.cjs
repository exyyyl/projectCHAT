const updateUrl = process.env.STREAM_POLLS_UPDATE_URL || 'https://updates.invalid/projectchat'

module.exports = {
  appId: 'ru.projectchat.app',
  productName: 'projectCHAT',
  asar: true,
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: [
    'desktop/**/*',
    'server/**/*',
    'public/**/*',
    'package.json',
    '!desktop/update-config.json',
    '!public/panel-build/vite.svg',
  ],
  extraResources: [
    { from: 'build/update-config.json', to: 'update-config.json' },
  ],
  publish: {
    provider: 'generic',
    url: updateUrl,
  },
  win: {
    icon: 'build/icon.png',
    target: [{ target: 'nsis', arch: ['x64'] }],
    artifactName: 'projectCHAT-Setup-${version}.${ext}',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'projectCHAT',
  },
  mac: {
    icon: 'build/icon.png',
    target: [{ target: 'dmg', arch: [process.arch] }],
    artifactName: 'projectCHAT-${version}-${arch}.${ext}',
  },
}
