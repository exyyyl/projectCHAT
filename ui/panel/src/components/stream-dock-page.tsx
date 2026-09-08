import { useEffect, useMemo, useState } from "react"
import {
  ArchiveRestore,
  Check,
  Copy,
  Eye,
  FilePlus2,
  FolderOpen,
  Images,
  Keyboard,
  Layers3,
  LoaderCircle,
  PackagePlus,
  Play,
  PlugZap,
  RefreshCw,
  Search,
  Square,
  TimerReset,
  Trash2,
  TriangleAlert,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/toast"

const compatibility: Record<
  StreamDockCompatibility,
  { label: string; className: string }
> = {
  supported: {
    label: "Проверен",
    className: "border-brand/20 bg-brand/8 text-brand",
  },
  experimental: {
    label: "Экспериментальный",
    className: "border-amber-300/15 bg-amber-300/8 text-amber-200",
  },
  protected: {
    label: "Защищён Elgato",
    className: "border-violet-300/15 bg-violet-300/8 text-violet-200",
  },
  unsupported: {
    label: "Не поддерживается",
    className: "border-border-subtle bg-surface-raised text-muted-foreground",
  },
  "installed-only": {
    label: "Установлен",
    className: "border-sky-300/15 bg-sky-300/8 text-sky-200",
  },
}

type PendingAction =
  | { type: "install"; plugin: StreamDockPlugin }
  | { type: "uninstall"; plugin: StreamDockPlugin }
  | { type: "restore"; backup: StreamDockBackup }

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Операция не выполнена"
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

export function StreamDockPage() {
  const desktop = window.streamPollsDesktop
  const api = desktop?.streamDock
  const showToast = useToast()
  const [status, setStatus] = useState<StreamDockStatus>()
  const [plugins, setPlugins] = useState<StreamDockPlugin[]>([])
  const [icons, setIcons] = useState<StreamDockIcon[]>([])
  const [backups, setBackups] = useState<StreamDockBackup[]>([])
  const [tab, setTab] = useState("control")
  const [loading, setLoading] = useState(Boolean(api))
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState<PendingAction>()
  const [releasePreview, setReleasePreview] = useState(false)

  useEffect(() => {
    if (notice) showToast({ message: notice, tone: "success" })
  }, [notice, showToast])

  useEffect(() => {
    if (error) showToast({ message: error, tone: "error" })
  }, [error, showToast])

  const refresh = async () => {
    if (!api) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      const nextStatus = await api.getStatus()
      setStatus(nextStatus)
      const [nextPlugins, nextBackups] = await Promise.all([
        api.listPlugins(),
        nextStatus.supported ? api.listBackups() : Promise.resolve([]),
      ])
      setPlugins(nextPlugins)
      setBackups(nextBackups)
      if (tab === "icons" && nextStatus.supported)
        setIcons(await api.listIcons())
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!api || !desktop) return
    let active = true
    void (async () => {
      try {
        const info = await desktop.getInfo()
        if (!active) return
        if (!info.development) {
          setReleasePreview(true)
          return
        }
        const nextStatus = await api.getStatus()
        if (!active) return
        setStatus(nextStatus)
        const [nextPlugins, nextBackups] = await Promise.all([
          api.listPlugins(),
          nextStatus.supported ? api.listBackups() : Promise.resolve([]),
        ])
        if (!active) return
        setPlugins(nextPlugins)
        setBackups(nextBackups)
      } catch (failure) {
        if (active) setError(errorMessage(failure))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [api, desktop])

  useEffect(() => {
    if (tab !== "icons" || !api || !status?.supported || icons.length) return
    void api
      .listIcons()
      .then(setIcons)
      .catch((failure) => setError(errorMessage(failure)))
  }, [api, icons.length, status?.supported, tab])

  const run = async (operation: () => Promise<unknown>, success: string) => {
    if (!api) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const result = await operation()
      if (result === null) return
      setNotice(success)
      const [nextStatus, nextPlugins, nextBackups] = await Promise.all([
        api.getStatus(),
        api.listPlugins(),
        api.listBackups(),
      ])
      setStatus(nextStatus)
      setPlugins(nextPlugins)
      setBackups(nextBackups)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
      setPending(undefined)
    }
  }

  if (!api) return <UnavailableState />
  if (releasePreview) return <StreamDockComingSoon />
  if (loading && !status) return <StreamDockLoading />

  const canManage = Boolean(status?.supported && status.ajazzFound)

  return (
    <section
      className="flex min-h-full flex-col p-6 lg:p-8"
      aria-label="Stream Dock"
    >
      <div className="mb-4 flex min-h-10 items-center gap-3 rounded-xl border border-border-subtle bg-surface-subtle px-4">
        {status?.supported ? (
          <>
            <StatusDot
              active={Boolean(status.ajazzFound)}
              label={
                status.ajazzFound
                  ? status.ajazzRunning
                    ? "AJAZZ запущен"
                    : "AJAZZ найден"
                  : "AJAZZ не найден"
              }
            />
            <span className="text-xs text-muted-foreground/35">•</span>
            <StatusDot
              active={Boolean(status.elgatoFound)}
              label={
                status.elgatoFound
                  ? `Elgato · ${status.elgatoPluginCount}`
                  : "Elgato не найден"
              }
            />
          </>
        ) : (
          <StatusDot
            active={false}
            label={`Режим просмотра · ${status?.platform === "darwin" ? "macOS" : status?.platform || "другая система"}`}
          />
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={loading || busy}
            aria-label="Обновить данные Stream Dock"
            onClick={() => void refresh()}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1">
        <TabsList className="grid w-full max-w-2xl grid-cols-4 rounded-xl border border-border-subtle bg-surface-subtle p-1">
          <TabsTrigger
            value="control"
            className="rounded-lg data-[state=active]:bg-surface-raised data-[state=active]:after:hidden"
          >
            <Play />
            Пульт
          </TabsTrigger>
          <TabsTrigger
            value="plugins"
            className="rounded-lg data-[state=active]:bg-surface-raised data-[state=active]:after:hidden"
          >
            <PlugZap />
            Плагины
          </TabsTrigger>
          <TabsTrigger
            value="icons"
            className="rounded-lg data-[state=active]:bg-surface-raised data-[state=active]:after:hidden"
          >
            <Images />
            Иконки
          </TabsTrigger>
          <TabsTrigger
            value="backups"
            className="rounded-lg data-[state=active]:bg-surface-raised data-[state=active]:after:hidden"
          >
            <ArchiveRestore />
            Копии
          </TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="mt-5">
          <ControlView
            plugin={plugins.find(
              (plugin) =>
                plugin.id.toLowerCase() === "ru.projectchat.control.sdplugin"
            )}
            canInstall={canManage}
            platformSupported={Boolean(status?.supported)}
            busy={busy}
            onInstall={(plugin) => setPending({ type: "install", plugin })}
          />
        </TabsContent>

        <TabsContent value="plugins" className="mt-5">
          <PluginsView
            plugins={plugins}
            canInstall={canManage}
            platformSupported={Boolean(status?.supported)}
            busy={busy}
            onChoose={async () => {
              if (!api) return
              setError("")
              try {
                const plugin = await api.choosePlugin()
                if (plugin) {
                  setPlugins((current) => [
                    plugin,
                    ...current.filter((item) => item.id !== plugin.id),
                  ])
                  setPending({ type: "install", plugin })
                }
              } catch (failure) {
                setError(errorMessage(failure))
              }
            }}
            onInstall={(plugin) => setPending({ type: "install", plugin })}
            onUninstall={(plugin) => setPending({ type: "uninstall", plugin })}
          />
        </TabsContent>

        <TabsContent value="icons" className="mt-5">
          <IconsView
            icons={icons}
            busy={busy}
            canManage={Boolean(status?.supported)}
            onImportFiles={() =>
              void run(async () => {
                const result = await api.importIconFiles()
                if (result) setIcons(await api.listIcons())
                return result
              }, "Иконки добавлены")
            }
            onImportFolder={() =>
              void run(async () => {
                const result = await api.importIconFolder()
                if (result) setIcons(await api.listIcons())
                return result
              }, "Папка добавлена")
            }
            onCopy={(id) =>
              void run(() => api.copyIconPath(id), "Путь скопирован")
            }
            onReveal={(id) => void api.revealIcon(id)}
          />
        </TabsContent>

        <TabsContent value="backups" className="mt-5">
          <BackupsView
            backups={backups}
            busy={busy}
            onRestore={(backup) => setPending({ type: "restore", backup })}
          />
        </TabsContent>
      </Tabs>

      <ConfirmOperation
        pending={pending}
        busy={busy}
        onCancel={() => setPending(undefined)}
        onConfirm={() => {
          if (!pending) return
          if (pending.type === "install") {
            void run(
              () => api.installPlugin(pending.plugin.sourceKey),
              pending.plugin.isInstalled
                ? "Плагин обновлён"
                : "Плагин установлен"
            )
          } else if (pending.type === "uninstall") {
            void run(
              () => api.uninstallPlugin(pending.plugin.id),
              "Плагин удалён, резервная копия сохранена"
            )
          } else {
            void run(
              () => api.restoreBackup(pending.backup.id),
              "Резервная копия восстановлена"
            )
          }
        }}
      />
    </section>
  )
}

function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        className={`size-1.5 rounded-full ${active ? "bg-brand" : "bg-muted-foreground/40"}`}
      />
      {label}
    </span>
  )
}

function UnavailableState() {
  return (
    <section
      className="flex min-h-full items-center justify-center p-8"
      aria-label="Stream Dock"
    >
      <div className="max-w-md rounded-2xl border border-border-subtle bg-surface-subtle p-7 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-brand/8 text-brand">
          <PlugZap className="size-5" />
        </div>
        <h2 className="mt-4 font-medium">Откройте projectCHAT</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Браузер не получает доступ к локальным плагинам. В установленном
          приложении раздел доступен и на macOS, и на Windows.
        </p>
      </div>
    </section>
  )
}

function StreamDockLoading() {
  return (
    <section className="p-6 lg:p-8" aria-label="Загрузка Stream Dock">
      <div className="h-10 animate-pulse rounded-xl bg-white/[0.035]" />
      <div className="mt-5 h-10 max-w-2xl animate-pulse rounded-xl bg-white/[0.035]" />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="h-52 animate-pulse rounded-xl bg-white/[0.035]" />
        <div className="h-52 animate-pulse rounded-xl bg-white/[0.035]" />
      </div>
    </section>
  )
}

function StreamDockComingSoon() {
  return (
    <section
      className="flex min-h-full items-center justify-center p-8"
      aria-label="Stream Dock — скоро"
    >
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand/8 text-brand">
          <Keyboard className="size-5" />
        </div>
        <div className="mt-5 text-[11px] font-medium tracking-[0.14em] text-brand uppercase">
          Скоро
        </div>
        <h2 className="mt-2 text-xl font-medium">Раздел в разработке</h2>
      </div>
    </section>
  )
}

function ControlView({
  plugin,
  canInstall,
  platformSupported,
  busy,
  onInstall,
}: {
  plugin?: StreamDockPlugin
  canInstall: boolean
  platformSupported: boolean
  busy: boolean
  onInstall: (plugin: StreamDockPlugin) => void
}) {
  const actions = [
    { icon: Play, label: "Запустить опрос" },
    { icon: Square, label: "Завершить опрос" },
    { icon: Eye, label: "Показать или скрыть виджет" },
    { icon: TimerReset, label: "+30 секунд" },
    { icon: Layers3, label: "Следующий шаблон" },
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(300px,.8fr)_minmax(360px,1.2fr)]">
      <div className="rounded-xl border border-border-subtle bg-surface-subtle p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/8 text-brand">
            <PlugZap className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-medium">projectCHAT для Stream Dock</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Управление опросом с физических кнопок без переключения окна.
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3 border-t border-border-subtle pt-4">
          <span
            className={`mr-auto flex items-center gap-2 text-xs ${plugin?.isInstalled ? "text-brand" : "text-muted-foreground"}`}
          >
            <span
              className={`size-1.5 rounded-full ${plugin?.isInstalled ? "bg-brand" : "bg-muted-foreground/40"}`}
            />
            {plugin?.isInstalled
              ? `Установлен ${plugin.installedVersion ?? ""}`
              : "Не установлен"}
          </span>
          <Button
            disabled={!plugin || !canInstall || busy}
            onClick={() => plugin && onInstall(plugin)}
          >
            {plugin?.isInstalled ? "Обновить" : "Установить"}
          </Button>
        </div>
        {!canInstall && (
          <p className="mt-3 text-xs text-amber-100">
            {platformSupported
              ? "Сначала установите Stream Dock AJAZZ."
              : "Установка на устройство доступна в Windows. На macOS можно посмотреть состав плагина."}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border-subtle bg-surface-subtle p-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {actions.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex min-h-12 items-center gap-3 rounded-lg border border-border-subtle bg-panel/35 px-3"
            >
              <Icon className="size-4 text-brand" />
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Кнопки подтверждают действие прямо на устройстве. Если projectCHAT
          закрыт, на кнопке появится ошибка.
        </p>
      </div>
    </div>
  )
}

function PluginsView({
  plugins,
  canInstall,
  platformSupported,
  busy,
  onChoose,
  onInstall,
  onUninstall,
}: {
  plugins: StreamDockPlugin[]
  canInstall: boolean
  platformSupported: boolean
  busy: boolean
  onChoose: () => void
  onInstall: (plugin: StreamDockPlugin) => void
  onUninstall: (plugin: StreamDockPlugin) => void
}) {
  const [search, setSearch] = useState("")
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("ru")
    return plugins.filter(
      (plugin) =>
        !needle ||
        [plugin.name, plugin.id, plugin.sourceLabel].some((value) =>
          value.toLocaleLowerCase("ru").includes(needle)
        )
    )
  }, [plugins, search])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-64 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск плагина"
            className="pl-9"
          />
        </label>
        <Button
          variant="outline"
          disabled={busy || !canInstall}
          onClick={onChoose}
        >
          <PackagePlus />
          Выбрать .sdPlugin
        </Button>
      </div>

      {!canInstall && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300/10 bg-amber-300/6 px-3 py-2 text-xs text-amber-100">
          <TriangleAlert className="size-4" />
          {platformSupported
            ? "Установка станет доступна после обнаружения Stream Dock AJAZZ."
            : "Пакеты доступны для просмотра. Установка в AJAZZ выполняется в Windows."}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-3">
        {filtered.map((plugin) => {
          const state = compatibility[plugin.compatibility]
          const installable = ![
            "protected",
            "unsupported",
            "installed-only",
          ].includes(plugin.compatibility)
          return (
            <article
              key={`${plugin.id}:${plugin.sourceKey}`}
              className="rounded-xl border border-border-subtle bg-surface-subtle p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/7 text-brand">
                  <PlugZap className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2
                        className="truncate text-sm font-medium"
                        title={plugin.name}
                      >
                        {plugin.name}
                      </h2>
                      <p
                        className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground"
                        title={plugin.id}
                      >
                        {plugin.id}
                      </p>
                    </div>
                    <Badge variant="outline" className={state.className}>
                      {state.label}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Версия {plugin.version}</span>
                    <span>{plugin.actionCount} действий</span>
                    <span>{plugin.sourceLabel}</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-border-subtle pt-3">
                    <span
                      className={`mr-auto flex items-center gap-1.5 text-xs ${plugin.isInstalled ? "text-brand" : "text-muted-foreground"}`}
                    >
                      {plugin.isInstalled && <Check className="size-3.5" />}
                      {plugin.isInstalled
                        ? `Установлен ${plugin.installedVersion ?? ""}`
                        : "Не установлен"}
                    </span>
                    {plugin.isInstalled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => onUninstall(plugin)}
                      >
                        <Trash2 />
                        Удалить
                      </Button>
                    )}
                    {installable && (
                      <Button
                        size="sm"
                        disabled={busy || !canInstall}
                        onClick={() => onInstall(plugin)}
                      >
                        {plugin.isInstalled ? "Обновить" : "Установить"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      {!filtered.length && <EmptyState label="Плагины не найдены" />}
    </div>
  )
}

function IconsView({
  icons,
  busy,
  canManage,
  onImportFiles,
  onImportFolder,
  onCopy,
  onReveal,
}: {
  icons: StreamDockIcon[]
  busy: boolean
  canManage: boolean
  onImportFiles: () => void
  onImportFolder: () => void
  onCopy: (id: string) => void
  onReveal: (id: string) => void
}) {
  const [search, setSearch] = useState("")
  const [source, setSource] = useState("all")
  const [limit, setLimit] = useState(180)
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("ru")
    return icons.filter(
      (icon) =>
        (source === "all" || icon.source === source) &&
        (!needle ||
          [icon.name, icon.packName, icon.folder].some((value) =>
            value.toLocaleLowerCase("ru").includes(needle)
          ))
    )
  }, [icons, search, source])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск иконки"
            className="pl-9"
          />
        </label>
        <select
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className="h-8 rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus:border-ring"
        >
          <option value="all">Все источники</option>
          <option value="library">Моя библиотека</option>
          <option value="elgato">Elgato</option>
          <option value="ajazz">AJAZZ</option>
        </select>
        <Button
          variant="outline"
          disabled={busy || !canManage}
          onClick={onImportFiles}
        >
          <FilePlus2 />
          Файлы
        </Button>
        <Button
          variant="outline"
          disabled={busy || !canManage}
          onClick={onImportFolder}
        >
          <FolderOpen />
          Папка
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-3">
        {filtered.slice(0, limit).map((icon) => (
          <article
            key={icon.id}
            className="group overflow-hidden rounded-xl border border-border-subtle bg-surface-subtle"
          >
            <button
              className="flex aspect-square w-full items-center justify-center bg-[#0c0f13] p-4"
              onClick={() => onCopy(icon.id)}
              title="Скопировать путь"
            >
              <img
                src={icon.previewUrl}
                alt=""
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
            </button>
            <div className="p-3">
              <div className="truncate text-xs font-medium" title={icon.name}>
                {icon.name}
              </div>
              <div
                className="mt-1 truncate text-[11px] text-muted-foreground"
                title={`${icon.packName} · ${icon.folder}`}
              >
                {icon.packName}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {icon.extension} · {formatBytes(icon.size)}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onCopy(icon.id)}
                    aria-label="Скопировать путь"
                  >
                    <Copy />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onReveal(icon.id)}
                    aria-label="Показать файл"
                  >
                    <FolderOpen />
                  </Button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && <EmptyState label="Иконки не найдены" />}
      {filtered.length > limit && (
        <Button
          variant="ghost"
          className="mx-auto mt-4 flex"
          onClick={() => setLimit((value) => value + 180)}
        >
          Показать ещё · {filtered.length - limit}
        </Button>
      )}
    </div>
  )
}

function BackupsView({
  backups,
  busy,
  onRestore,
}: {
  backups: StreamDockBackup[]
  busy: boolean
  onRestore: (backup: StreamDockBackup) => void
}) {
  if (!backups.length) return <EmptyState label="Резервных копий пока нет" />
  return (
    <div className="space-y-2">
      {backups.map((backup) => (
        <article
          key={backup.id}
          className="flex items-center gap-4 rounded-xl border border-border-subtle bg-surface-subtle px-4 py-3"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/7 text-brand">
            <ArchiveRestore className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {backup.pluginName}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>{backup.version}</span>
              <span>
                {new Intl.DateTimeFormat("ru", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(backup.createdAt))}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onRestore(backup)}
          >
            Восстановить
          </Button>
        </article>
      ))}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center rounded-xl border border-dashed border-border-subtle text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function ConfirmOperation({
  pending,
  busy,
  onCancel,
  onConfirm,
}: {
  pending?: PendingAction
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const title =
    pending?.type === "install"
      ? pending.plugin.isInstalled
        ? "Обновить плагин?"
        : "Установить плагин?"
      : pending?.type === "uninstall"
        ? "Удалить плагин?"
        : "Восстановить эту копию?"
  const description =
    pending?.type === "install"
      ? pending.plugin.isInstalled
        ? `${pending.plugin.name}. Stream Dock AJAZZ будет перезапущен, а текущая версия сохранится в резервной копии.`
        : `${pending.plugin.name}. Для подключения плагина Stream Dock AJAZZ будет перезапущен.`
      : pending?.type === "uninstall"
        ? `${pending.plugin.name} будет перемещён в резервные копии. Действие можно отменить восстановлением.`
        : pending?.type === "restore"
          ? `${pending.backup.pluginName}, версия ${pending.backup.version}. Текущая установка также будет сохранена.`
          : ""
  return (
    <AlertDialog
      open={Boolean(pending)}
      onOpenChange={(open) => !open && onCancel()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={busy}
            variant={pending?.type === "uninstall" ? "destructive" : "default"}
          >
            {busy && <LoaderCircle className="animate-spin" />}
            Продолжить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
