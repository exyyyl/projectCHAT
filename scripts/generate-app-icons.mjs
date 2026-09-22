import { mkdir, readFile } from 'node:fs/promises'
import sharp from 'sharp'

const sourcePath = 'build/icon-source.png'

await Promise.all([
  mkdir('build', { recursive: true }),
  mkdir('public', { recursive: true }),
  mkdir('ui/panel/src/assets', { recursive: true }),
])

const appIcon = await readFile(sourcePath)

const traySymbol = color => `<g fill="none" stroke="${color}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M7.5 21.5V15A13.5 13.5 0 0 1 21 1.5h6"/>
  <path d="M12.5 21.5V16A8.5 8.5 0 0 1 21 7.5h6"/>
  <circle cx="21" cy="16" r="3.2" fill="${color}" stroke="none"/>
  <path d="m23.8 18.2 7.7 3.8-3.6 1.4 2.8 2.8-2.5 2.5-2.8-2.8-1.4 3.6Z" fill="${color}" stroke="none"/>
</g>`

const trayIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 36 36">
  <rect x="1" y="1" width="34" height="34" rx="10" fill="#090909" stroke="#292929"/>
  ${traySymbol('#f5f5f5')}
</svg>`

const trayTemplateIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
  ${traySymbol('#000')}
</svg>`

await Promise.all([
  sharp(appIcon).resize(512, 512).png().toFile('build/icon.png'),
  sharp(appIcon).resize(64, 64).png().toFile('public/favicon.png'),
  sharp(appIcon).resize(96, 96).png().toFile('ui/panel/src/assets/app-icon.png'),
  sharp(Buffer.from(trayIcon)).resize(20, 20).png().toFile('build/tray-icon.png'),
  sharp(Buffer.from(trayIcon)).resize(40, 40).png().toFile('build/tray-icon@2x.png'),
  sharp(Buffer.from(trayTemplateIcon)).resize(18, 18).png().toFile('build/tray-icon-template.png'),
  sharp(Buffer.from(trayTemplateIcon)).resize(36, 36).png().toFile('build/tray-icon-template@2x.png'),
])
