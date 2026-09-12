import { useCallback, useEffect, useState } from "react"
import {
  Check,
  Grid2X2,
  LoaderCircle,
  MessageCircle,
  Radio,
  Tag,
  Video,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import projectChatIcon from "@/assets/stream-dock/projectchat.png?inline"
import extendIcon from "@/assets/stream-dock/projectchat-extend.png"
import presetIcon from "@/assets/stream-dock/projectchat-preset.png"
import startIcon from "@/assets/stream-dock/projectchat-start.png"
import visibilityIcon from "@/assets/stream-dock/projectchat-visibility.png"
import twitchIcon from "@/assets/stream-dock/twitch-ajazz.svg"

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
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"

const PROJECTCHAT_PLUGIN_ID = "ru.projectchat.control.sdplugin"
const PROJECTCHAT_PLUGIN_VERSION = "0.5.0"
const TWITCH_PLUGIN_ID = "com.elgato.twitch.sdplugin"
const TWITCH_PLUGIN_VERSION = "1.11.6.15-ajazz.5"
const TWITCH_PLUGIN_DOWNLOAD =
  "https://github.com/exyyyl/ajazz-plugin-manager/releases/latest/download/Ajazz-Twitch-Setup.exe"

const pollActions = [
  { image: startIcon, label: "Старт / стоп" },
  { image: visibilityIcon, label: "Виджет" },
  { image: extendIcon, label: "+30 секунд" },
  { image: presetIcon, label: "Выбрать шаблон" },
]

const twitchActions = [
  { icon: MessageCircle, label: "Чат" },
  { icon: Video, label: "Видео" },
  { icon: Radio, label: "Эфир" },
  { icon: Tag, label: "Категория" },
  { icon: Grid2X2, label: "+12" },
]

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Операция не выполнена"
}

export function StreamDockPage() {
  const api = window.streamPollsDesktop?.streamDock
  const showToast = useToast()
  const [status, setStatus] = useState<StreamDockStatus>()
  const [plugins, setPlugins] = useState<StreamDockPlugin[]>([])
  const [loading, setLoading] = useState(Boolean(api))
  const [installing, setInstalling] = useState(false)
  const [confirmInstall, setConfirmInstall] = useState(false)

  const refresh = useCallback(async () => {
    if (!api) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [nextStatus, nextPlugins] = await Promise.all([
        api.getStatus(),
        api.listPlugins(),
      ])
      setStatus(nextStatus)
      setPlugins(nextPlugins)
    } catch (error) {
      showToast({ message: errorMessage(error), tone: "error" })
    } finally {
      setLoading(false)
    }
  }, [api, showToast])

  useEffect(() => {
    if (!api) return
    let active = true
    void Promise.all([api.getStatus(), api.listPlugins()])
      .then(([nextStatus, nextPlugins]) => {
        if (!active) return
        setStatus(nextStatus)
        setPlugins(nextPlugins)
      })
      .catch((error) => {
        if (active) showToast({ message: errorMessage(error), tone: "error" })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [api, showToast])

  const projectChatPlugin = plugins.find(
    (plugin) => plugin.id.toLowerCase() === PROJECTCHAT_PLUGIN_ID
  )
  const twitchPlugin = plugins.find(
    (plugin) => plugin.id.toLowerCase() === TWITCH_PLUGIN_ID
  )
  const canInstall = Boolean(status?.supported && status.ajazzFound)

  const installProjectChat = async () => {
    if (!api || !projectChatPlugin) return
    setInstalling(true)
    try {
      await api.installPlugin(projectChatPlugin.sourceKey)
      showToast({
        message: projectChatPlugin.isInstalled
          ? "Плагин projectCHAT обновлён"
          : "Плагин projectCHAT установлен",
        tone: "success",
      })
      await refresh()
    } catch (error) {
      showToast({ message: errorMessage(error), tone: "error" })
    } finally {
      setInstalling(false)
      setConfirmInstall(false)
    }
  }

  return (
    <section
      className="h-full overflow-y-auto overscroll-contain p-5 lg:p-8"
      aria-label="Stream Dock"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-4 xl:grid-cols-2">
          <ProjectChatPluginCard
            plugin={projectChatPlugin}
            canInstall={canInstall}
            loading={loading}
            installing={installing}
            onInstall={() => setConfirmInstall(true)}
          />
          <TwitchPluginCard plugin={twitchPlugin} />
        </div>
      </div>

      <AlertDialog
        open={confirmInstall}
        onOpenChange={(open) => !open && setConfirmInstall(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {projectChatPlugin?.isInstalled
                ? "Обновить projectCHAT Control?"
                : "Установить projectCHAT Control?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Stream Dock AJAZZ перезапустится. При обновлении текущая версия
              плагина будет сохранена автоматически.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={installing}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={installing}
              onClick={() => void installProjectChat()}
            >
              {installing && <LoaderCircle className="animate-spin" />}
              Продолжить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function ProjectChatPluginCard({
  plugin,
  canInstall,
  loading,
  installing,
  onInstall,
}: {
  plugin?: StreamDockPlugin
  canInstall: boolean
  loading: boolean
  installing: boolean
  onInstall: () => void
}) {
  const installed = Boolean(plugin?.isInstalled)

  return (
    <article className="flex min-h-[300px] flex-col overflow-hidden rounded-2xl bg-surface-subtle ring-1 ring-border-subtle ring-inset">
      <div className="flex items-start gap-4 p-5 pb-4 lg:p-6 lg:pb-4">
        <img
          src={projectChatIcon}
          alt=""
          className="size-12 shrink-0 rounded-2xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-[-0.02em]">
              projectCHAT Control
            </h2>
            {installed && <PluginBadge>Установлен</PluginBadge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Версия{" "}
            {plugin?.installedVersion ||
              plugin?.version ||
              PROJECTCHAT_PLUGIN_VERSION}
          </p>
        </div>
      </div>

      <PluginActionGrid actions={pollActions} tone="brand" />

      <div className="mt-auto flex justify-end p-5 lg:p-6">
        <Button
          size="lg"
          disabled={!plugin || !canInstall || installing || loading}
          onClick={onInstall}
        >
          {installing && <LoaderCircle className="animate-spin" />}
          {installed ? "Обновить" : "Установить"}
        </Button>
      </div>
    </article>
  )
}

function TwitchPluginCard({ plugin }: { plugin?: StreamDockPlugin }) {
  const installed = Boolean(plugin?.isInstalled)
  return (
    <article className="flex min-h-[300px] flex-col overflow-hidden rounded-2xl bg-surface-subtle ring-1 ring-border-subtle ring-inset">
      <div className="flex items-start gap-4 p-5 pb-4 lg:p-6 lg:pb-4">
        <img src={twitchIcon} alt="" className="size-12 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-[-0.02em]">
              Twitch для AJAZZ
            </h2>
            {installed && <PluginBadge tone="twitch">Установлен</PluginBadge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Версия {plugin?.installedVersion || TWITCH_PLUGIN_VERSION}
          </p>
        </div>
      </div>

      <PluginActionGrid actions={twitchActions} tone="twitch" />

      <div className="mt-auto flex justify-end p-5 lg:p-6">
        <Button asChild size="lg">
          <a href={TWITCH_PLUGIN_DOWNLOAD} target="_blank" rel="noreferrer">
            Скачать
          </a>
        </Button>
      </div>
    </article>
  )
}

type PluginAction = {
  label: string
  image?: string
  icon?: LucideIcon
}

function PluginActionGrid({
  actions,
  tone,
}: {
  actions: PluginAction[]
  tone: "brand" | "twitch"
}) {
  return (
    <div
      className="mx-5 grid gap-2 rounded-2xl bg-background/65 p-3 ring-1 ring-border-subtle ring-inset transition-colors lg:mx-6"
      style={{
        gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))`,
      }}
    >
      {actions.map((action) => (
        <PluginActionKey key={action.label} action={action} tone={tone} />
      ))}
    </div>
  )
}

function PluginActionKey({
  action,
  tone,
}: {
  action: PluginAction
  tone: "brand" | "twitch"
}) {
  const Icon = action.icon
  return (
    <div className="min-w-0 text-center">
      <div
        className={`mx-auto flex aspect-square w-full max-w-14 items-center justify-center overflow-hidden rounded-xl bg-surface-raised shadow-[inset_0_1px_var(--border-subtle)] ${tone === "twitch" ? "text-[#b98cff]" : "text-brand"}`}
      >
        {action.image ? (
          <img src={action.image} alt="" className="size-full object-cover" />
        ) : (
          Icon && <Icon className="size-[18px]" />
        )}
      </div>
      <span className="mt-2 block truncate text-[11px] text-muted-foreground">
        {action.label}
      </span>
    </div>
  )
}

function PluginBadge({
  tone = "brand",
  children,
}: {
  tone?: "brand" | "twitch"
  children: string
}) {
  const className =
    tone === "twitch"
      ? "bg-[#9146ff]/10 text-[#c5a2ff] ring-[#9146ff]/18"
      : "bg-brand/8 text-brand ring-brand/15"
  return (
    <span
      className={`inline-flex h-5 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium ring-1 ring-inset ${className}`}
    >
      <Check className="size-3" />
      {children}
    </span>
  )
}
