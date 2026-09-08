import { createHash } from 'node:crypto'
import {
  appendFile,
  cp,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'

const PLUGIN_SUFFIX = '.sdplugin'
const TWITCH_PLUGIN_ID = 'com.elgato.twitch.sdPlugin'
const PROJECTCHAT_PLUGIN_ID = 'ru.projectchat.control.sdPlugin'
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp'])
const SOURCE_LABELS = {
  library: 'Моя библиотека',
  elgato: 'Наборы Elgato',
  ajazz: 'Профили AJAZZ',
}

function opaqueId(value) {
  return createHash('sha256').update(value.toLowerCase()).digest('hex').slice(0, 24)
}

function firstExisting(paths) {
  return paths.find((path) => path && existsSync(path))
}

export function createStreamDockPaths({
  appData,
  programFiles = 'C:\\Program Files',
  programFilesX86 = 'C:\\Program Files (x86)',
  windowsDir = 'C:\\Windows',
  packagedPlugins,
}) {
  const ajazzRoot = join(appData, 'HotSpot', 'StreamDock')
  const managerRoot = join(appData, 'AjazzPluginManager')
  return {
    ajazzRoot,
    ajazzPlugins: join(ajazzRoot, 'plugins'),
    ajazzProfiles: join(ajazzRoot, 'profiles'),
    ajazzExe: firstExisting([
      join(programFilesX86, 'HotSpot', 'Stream Dock AJAZZ.exe'),
      join(programFiles, 'HotSpot', 'Stream Dock AJAZZ.exe'),
    ]),
    elgatoPlugins: join(appData, 'Elgato', 'StreamDeck', 'Plugins'),
    elgatoIconPacks: join(appData, 'Elgato', 'StreamDeck', 'IconPacks'),
    managerRoot,
    iconLibrary: join(managerRoot, 'IconLibrary'),
    backupRoot: join(managerRoot, 'Backups'),
    logPath: join(managerRoot, 'manager.log'),
    packagedPlugins,
    windowsDir,
  }
}

async function directoryEntries(path) {
  try {
    return await readdir(path, { withFileTypes: true })
  } catch {
    return []
  }
}

async function pluginFolders(root) {
  return (await directoryEntries(root))
    .filter((entry) => entry.isDirectory() && entry.name.toLowerCase().endsWith(PLUGIN_SUFFIX))
    .map((entry) => join(root, entry.name))
}

async function readJson(path) {
  const value = await readFile(path, 'utf8')
  return JSON.parse(value.charCodeAt(0) === 0xfeff ? value.slice(1) : value)
}

async function protectedManifest(path) {
  const handle = await open(path, 'r')
  try {
    const signature = Buffer.alloc(6)
    await handle.read(signature, 0, 6, 0)
    return signature.toString('ascii') === 'ELGATO'
  } finally {
    await handle.close()
  }
}

async function readManifest(folder) {
  const manifestPath = join(folder, 'manifest.json')
  if (await protectedManifest(manifestPath)) {
    const folderId = basename(folder).replace(/\.sdPlugin$/iu, '')
    let localization = {}
    try {
      localization = await readJson(join(folder, 'en.json'))
    } catch {
      // Protected plugins can still be listed from their folder and executable.
    }
    const executable = (await directoryEntries(folder)).find(
      (entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.exe',
    )
    return {
      uuid: folderId,
      name: typeof localization.Name === 'string' ? localization.Name : folderId,
      version: 'защищён',
      codePath: executable?.name ?? '',
      actionCount: Object.keys(localization).filter((key) =>
        key.toLowerCase().startsWith(`${folderId.toLowerCase()}.`),
      ).length,
      hasIconEditor: false,
      isProtected: true,
    }
  }

  const manifest = await readJson(manifestPath)
  return {
    uuid: typeof manifest.UUID === 'string' ? manifest.UUID : '',
    name: typeof manifest.Name === 'string' ? manifest.Name : basename(folder),
    version: typeof manifest.Version === 'string' ? manifest.Version : '—',
    codePath: typeof manifest.CodePath === 'string' ? manifest.CodePath : '',
    actionCount: Array.isArray(manifest.Actions) ? manifest.Actions.length : 0,
    hasIconEditor: typeof manifest.IconEditorPath === 'string',
    isProtected: false,
  }
}

function compatibilityFor(id, manifest, packaged) {
  if (
    packaged &&
    [TWITCH_PLUGIN_ID, PROJECTCHAT_PLUGIN_ID].some(
      (pluginId) => id.toLowerCase() === pluginId.toLowerCase(),
    )
  ) {
    return 'supported'
  }
  if (manifest.isProtected) return 'protected'
  if (manifest.actionCount === 0) return 'unsupported'
  return 'experimental'
}

function publicPlugin(folder, manifest, packaged, sourceLabel) {
  const id = basename(folder)
  return {
    id,
    sourceKey: opaqueId(folder),
    name: manifest.name || id,
    version: manifest.version,
    installedVersion: null,
    sourceLabel,
    actionCount: manifest.actionCount,
    isInstalled: false,
    isPackaged: packaged,
    isIconEditor: manifest.hasIconEditor,
    isProtected: manifest.isProtected,
    compatibility: compatibilityFor(id, manifest, packaged),
  }
}

async function walkImages(root) {
  const result = []
  async function walk(folder) {
    for (const entry of await directoryEntries(folder)) {
      if (entry.name === '.history') continue
      const path = join(folder, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) result.push(path)
    }
  }
  await walk(root)
  return result
}

function normalizedFolder(path) {
  return path.split(sep).filter(Boolean).join(' / ') || 'Корень'
}

function timestamp(now) {
  return new Date(now()).toISOString().replace(/\D/gu, '').slice(0, 17)
}

function safeName(value, fallback) {
  const cleaned = String(value || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_')
    .trim()
  return cleaned || fallback
}

async function uniquePath(folder, fileName) {
  const extension = extname(fileName)
  const stem = basename(fileName, extension)
  let candidate = join(folder, fileName)
  let index = 2
  while (existsSync(candidate)) candidate = join(folder, `${stem} (${index++})${extension}`)
  return candidate
}

async function readClientId(folder) {
  try {
    const config = await readJson(join(folder, 'auth-config.json'))
    return typeof config.clientId === 'string' ? config.clientId : ''
  } catch {
    return ''
  }
}

export function createStreamDockManager({
  paths,
  platform = process.platform,
  now = Date.now,
  processes,
  compileProjectChatPlugin = async () => {
    throw new Error('Сборка плагина projectCHAT не настроена.')
  },
}) {
  const supported = platform === 'win32'
  const pluginSources = new Map()
  const iconSources = new Map()
  const backupSources = new Map()
  const processAdapter = processes ?? {
    running: async () => false,
    stop: async () => {},
    start: async () => {},
  }

  async function log(message) {
    await mkdir(paths.managerRoot, { recursive: true })
    await appendFile(paths.logPath, `${new Date(now()).toISOString()}  ${message}\n`, 'utf8')
  }

  function requireWindows() {
    if (!supported) throw new Error('Управление Stream Dock доступно только в Windows-приложении.')
  }

  function safePluginTarget(pluginId) {
    if (
      typeof pluginId !== 'string' ||
      !pluginId.toLowerCase().endsWith(PLUGIN_SUFFIX) ||
      pluginId.includes('..') ||
      pluginId.includes('/') ||
      pluginId.includes('\\')
    ) {
      throw new Error('Некорректный идентификатор плагина.')
    }
    const root = `${resolve(paths.ajazzPlugins)}${sep}`.toLowerCase()
    const target = resolve(paths.ajazzPlugins, pluginId)
    if (!`${target}${sep}`.toLowerCase().startsWith(root)) throw new Error('Небезопасный путь установки.')
    return target
  }

  async function withAjazzStopped(operation) {
    await processAdapter.stop(paths)
    try {
      return await operation()
    } finally {
      await processAdapter.start(paths)
    }
  }

  async function moveToBackup(target, pluginId) {
    await mkdir(paths.backupRoot, { recursive: true })
    const stem = `${pluginId}--${timestamp(now)}`
    let backup = join(paths.backupRoot, stem)
    let index = 2
    while (existsSync(backup)) backup = join(paths.backupRoot, `${stem}-${index++}`)
    await rename(target, backup)
    return backup
  }

  async function preservePluginData(target, backup) {
    if (!backup) return
    const oldData = join(backup, 'data')
    const newData = join(target, 'data')
    if (existsSync(oldData) && !existsSync(newData)) await cp(oldData, newData, { recursive: true })
  }

  async function prepareTwitchInstall(target, backup) {
    await rm(join(target, 'data'), { recursive: true, force: true })
    await rm(join(target, 'logs'), { recursive: true, force: true })
    let preserve = false
    const credential = backup ? join(backup, 'data', 'auth.bin') : ''
    if (backup && existsSync(credential)) {
      preserve = (await readClientId(backup)) === (await readClientId(target))
      if (preserve) {
        await mkdir(join(target, 'data'), { recursive: true })
        await cp(credential, join(target, 'data', 'auth.bin'))
      }
    }
    const marker = join(target, 'first-run-auth')
    if (preserve) await rm(marker, { force: true })
    else await writeFile(marker, '')
  }

  async function installSource(sourceKey) {
    requireWindows()
    const source = pluginSources.get(sourceKey)
    if (!source) throw new Error('Источник плагина устарел. Обновите список и повторите попытку.')
    const manifest = await readManifest(source.path)
    if (manifest.actionCount < 1) {
      throw new Error(
        manifest.hasIconEditor
          ? 'Это редактор иконок Elgato. Используйте раздел «Иконки».'
          : 'В пакете не найдено ни одного действия Stream Deck.',
      )
    }
    const target = safePluginTarget(source.id)
    return withAjazzStopped(async () => {
      let backup
      try {
        if (existsSync(target)) backup = await moveToBackup(target, source.id)
        await cp(source.path, target, { recursive: true })
        if (source.id.toLowerCase() === TWITCH_PLUGIN_ID.toLowerCase()) {
          await prepareTwitchInstall(target, backup)
        } else {
          await preservePluginData(target, backup)
        }
        if (source.id.toLowerCase() === PROJECTCHAT_PLUGIN_ID.toLowerCase()) {
          await compileProjectChatPlugin(target, paths)
        }
        const installed = await readManifest(target)
        if (installed.actionCount < 1) throw new Error('Проверка установленного плагина не пройдена.')
        await log(`Установлен ${source.id} ${installed.version}`)
        return { backupCreated: Boolean(backup) }
      } catch (error) {
        await rm(target, { recursive: true, force: true })
        if (backup && existsSync(backup)) await rename(backup, target)
        throw error
      }
    })
  }

  async function addPluginSource(result, root, packaged, sourceLabel) {
    for (const folder of await pluginFolders(root)) {
      const key = basename(folder).toLowerCase()
      if (result.has(key)) continue
      try {
        const plugin = publicPlugin(folder, await readManifest(folder), packaged, sourceLabel)
        result.set(key, plugin)
        pluginSources.set(plugin.sourceKey, { id: plugin.id, path: folder })
      } catch (error) {
        await log(`Пропущен некорректный пакет ${folder}: ${error.message}`)
      }
    }
  }

  async function listPlugins() {
    pluginSources.clear()
    const result = new Map()
    await addPluginSource(result, paths.packagedPlugins, true, 'Встроенный пакет')
    if (supported) {
      await addPluginSource(result, paths.elgatoPlugins, false, 'Elgato Stream Deck')
      for (const folder of await pluginFolders(paths.ajazzPlugins)) {
        const key = basename(folder).toLowerCase()
        try {
          const manifest = await readManifest(folder)
          let plugin = result.get(key)
          if (!plugin) {
            plugin = publicPlugin(folder, manifest, false, 'Установлен в AJAZZ')
            plugin.compatibility = 'installed-only'
            result.set(key, plugin)
          }
          plugin.isInstalled = true
          plugin.installedVersion = manifest.version
        } catch (error) {
          await log(`Пропущен установленный пакет ${folder}: ${error.message}`)
        }
      }
    }
    const order = { supported: 0, experimental: 1, protected: 2, unsupported: 3, 'installed-only': 4 }
    return [...result.values()].sort(
      (left, right) => order[left.compatibility] - order[right.compatibility] || left.name.localeCompare(right.name, 'ru'),
    )
  }

  async function inspectPlugin(folder) {
    requireWindows()
    const sourcePath = resolve(folder)
    const manifest = await readManifest(sourcePath)
    let id = basename(sourcePath).replace(/[\\/]$/u, '')
    if (!id.toLowerCase().endsWith(PLUGIN_SUFFIX)) {
      if (!manifest.uuid) throw new Error('Не удалось определить UUID плагина.')
      id = manifest.uuid.toLowerCase().endsWith(PLUGIN_SUFFIX) ? manifest.uuid : `${manifest.uuid}.sdPlugin`
    }
    const plugin = publicPlugin(join(dirname(sourcePath), id), manifest, false, 'Выбранная папка')
    plugin.sourceKey = opaqueId(`${sourcePath}:${now()}`)
    const installedPath = safePluginTarget(id)
    if (existsSync(installedPath)) {
      plugin.isInstalled = true
      try {
        plugin.installedVersion = (await readManifest(installedPath)).version
      } catch {
        plugin.installedVersion = 'неизвестно'
      }
    }
    pluginSources.set(plugin.sourceKey, { id, path: sourcePath })
    return plugin
  }

  async function uninstallPlugin(pluginId) {
    requireWindows()
    const target = safePluginTarget(pluginId)
    if (!existsSync(target)) throw new Error('Плагин уже удалён.')
    return withAjazzStopped(async () => {
      const backup = await moveToBackup(target, pluginId)
      await log(`Удалён с резервной копией ${pluginId}`)
      return { backupCreated: Boolean(backup) }
    })
  }

  async function listBackups() {
    if (!supported) return []
    backupSources.clear()
    const results = []
    const roots = [...new Set([paths.backupRoot, join(paths.ajazzRoot, 'plugin-backups')])]
    for (const root of roots) {
      for (const entry of await directoryEntries(root)) {
        if (!entry.isDirectory()) continue
        const folder = join(root, entry.name)
        try {
          const manifest = await readManifest(folder)
          let pluginId = manifest.uuid || entry.name.split('--')[0]
          if (!pluginId.toLowerCase().endsWith(PLUGIN_SUFFIX)) pluginId += '.sdPlugin'
          const info = await stat(folder)
          const id = opaqueId(folder)
          backupSources.set(id, folder)
          results.push({ id, pluginId, pluginName: manifest.name, version: manifest.version, createdAt: info.mtime.toISOString() })
        } catch {
          // A partial backup is omitted rather than offered for restoration.
        }
      }
    }
    return results.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  async function restoreBackup(backupId) {
    requireWindows()
    let backup = backupSources.get(backupId)
    if (!backup) {
      await listBackups()
      backup = backupSources.get(backupId)
    }
    if (!backup || !existsSync(backup)) throw new Error('Резервная копия не найдена.')
    const manifest = await readManifest(backup)
    let pluginId = manifest.uuid || basename(backup).split('--')[0]
    if (!pluginId.toLowerCase().endsWith(PLUGIN_SUFFIX)) pluginId += '.sdPlugin'
    const target = safePluginTarget(pluginId)
    return withAjazzStopped(async () => {
      let currentBackup
      try {
        if (existsSync(target)) currentBackup = await moveToBackup(target, pluginId)
        await cp(backup, target, { recursive: true })
        await readManifest(target)
        await log(`Восстановлена резервная копия ${basename(backup)}`)
        return { backupCreated: Boolean(currentBackup) }
      } catch (error) {
        await rm(target, { recursive: true, force: true })
        if (currentBackup && existsSync(currentBackup)) await rename(currentBackup, target)
        throw error
      }
    })
  }

  async function addIcon(result, path, root, source, packName) {
    const info = await stat(path)
    const id = opaqueId(path)
    iconSources.set(id, path)
    result.push({
      id,
      name: basename(path, extname(path)),
      packName,
      source,
      sourceLabel: SOURCE_LABELS[source],
      folder: normalizedFolder(relative(root, dirname(path))),
      extension: extname(path).slice(1).toUpperCase(),
      size: info.size,
      previewUrl: `stream-dock-icon://asset/${id}`,
    })
  }

  async function addIconTree(result, root, source, packName) {
    for (const path of await walkImages(root)) await addIcon(result, path, root, source, packName)
  }

  async function listIcons() {
    if (!supported) return []
    iconSources.clear()
    const result = []
    const libraryEntries = await directoryEntries(paths.iconLibrary)
    for (const entry of libraryEntries) {
      const path = join(paths.iconLibrary, entry.name)
      if (entry.isDirectory()) await addIconTree(result, path, 'library', entry.name)
      else if (entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        await addIcon(result, path, paths.iconLibrary, 'library', 'Без набора')
      }
    }
    for (const entry of await directoryEntries(paths.elgatoIconPacks)) {
      if (!entry.isDirectory() || !entry.name.toLowerCase().endsWith('.sdiconpack')) continue
      const folder = join(paths.elgatoIconPacks, entry.name)
      let packName = entry.name.replace(/\.sdIconPack$/iu, '')
      try {
        const manifest = await readJson(join(folder, 'manifest.json'))
        if (typeof manifest.Name === 'string' && manifest.Name.trim()) packName = manifest.Name
      } catch {
        // Folder name is a sufficient fallback.
      }
      await addIconTree(result, join(folder, 'icons'), 'elgato', packName)
    }
    for (const profile of await directoryEntries(paths.ajazzProfiles)) {
      if (!profile.isDirectory()) continue
      await addIconTree(
        result,
        join(paths.ajazzProfiles, profile.name),
        'ajazz',
        profile.name.replace(/\.sdProfile$/iu, ''),
      )
    }
    return result.sort(
      (left, right) =>
        left.source.localeCompare(right.source) ||
        left.packName.localeCompare(right.packName, 'ru') ||
        left.folder.localeCompare(right.folder, 'ru') ||
        left.name.localeCompare(right.name, 'ru'),
    )
  }

  async function importIconFiles(files, packName) {
    requireWindows()
    const destination = join(paths.iconLibrary, safeName(packName, `Импорт ${timestamp(now)}`))
    await mkdir(destination, { recursive: true })
    let imported = 0
    for (const file of files) {
      if (!IMAGE_EXTENSIONS.has(extname(file).toLowerCase()) || !existsSync(file)) continue
      await cp(file, await uniquePath(destination, basename(file)))
      imported += 1
    }
    await log(`Импортировано иконок: ${imported} в ${destination}`)
    return { imported }
  }

  async function importIconFolder(folder) {
    return importIconFiles(await walkImages(folder), basename(folder))
  }

  async function status() {
    if (!supported) {
      return {
        platform,
        supported: false,
        ajazzFound: false,
        ajazzRunning: false,
        elgatoFound: false,
        elgatoPluginCount: 0,
        paths: null,
      }
    }
    return {
      platform,
      supported: true,
      ajazzFound: Boolean(paths.ajazzExe),
      ajazzRunning: await processAdapter.running(paths),
      elgatoFound: existsSync(paths.elgatoPlugins),
      elgatoPluginCount: (await pluginFolders(paths.elgatoPlugins)).length,
      paths: {
        ajazzPlugins: paths.ajazzPlugins,
        elgatoPlugins: paths.elgatoPlugins,
        iconLibrary: paths.iconLibrary,
        backupRoot: paths.backupRoot,
      },
    }
  }

  return {
    status,
    listPlugins,
    inspectPlugin,
    installSource,
    uninstallPlugin,
    listBackups,
    restoreBackup,
    listIcons,
    importIconFiles,
    importIconFolder,
    iconPath(id) {
      return iconSources.get(id)
    },
  }
}
