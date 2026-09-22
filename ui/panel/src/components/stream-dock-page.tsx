import { useCallback, useEffect, useState } from "react"
import {
  Check,
  Clock3,
  Grid2X2,
  LoaderCircle,
  MessageCircle,
  Radio,
  Tag,
  Trash2,
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
import { PageContainer, PageScroll } from "@/components/page-layout"
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
  const [plugins, setPlugins] = useState<StreamDockPlugin[]>([])
  const [loading, setLoading] = useState(Boolean(api))
  const [operation, setOperation] = useState<"remove">()
  const [confirmRemove, setConfirmRemove] = useState(false)

  const refresh = useCallback(async () => {
    if (!api) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setPlugins(await api.listPlugins())
    } catch (error) {
      showToast({ message: errorMessage(error), tone: "error" })
    } finally {
      setLoading(false)
    }
  }, [api, showToast])

  useEffect(() => {
    if (!api) return
    let active = true
    void api
      .listPlugins()
      .then((nextPlugins) => {
        if (!active) return
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

  const removeProjectChat = async () => {
    if (!api || !projectChatPlugin) return
    setOperation("remove")
    try {
      await api.uninstallPlugin(projectChatPlugin.id)
      showToast({
        message: "Плагин опросов удалён",
        tone: "success",
      })
      await refresh()
    } catch (error) {
      showToast({ message: errorMessage(error), tone: "error" })
    } finally {
      setOperation(undefined)
      setConfirmRemove(false)
    }
  }

  return (
    <PageScroll aria-label="Stream Dock">
      <PageContainer>
        <div className="grid gap-4 xl:grid-cols-2">
          <ProjectChatPluginCard
            plugin={projectChatPlugin}
            loading={loading}
            operation={operation}
            onRemove={() => setConfirmRemove(true)}
          />
          <TwitchPluginCard plugin={twitchPlugin} />
        </div>
      </PageContainer>

      <AlertDialog
        open={confirmRemove}
        onOpenChange={(open) => !open && setConfirmRemove(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить плагин опросов?</AlertDialogTitle>
            <AlertDialogDescription>
              AJAZZ перезапустится, а копия плагина сохранится для
              восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(operation)}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={Boolean(operation)}
              onClick={() => void removeProjectChat()}
            >
              {operation === "remove" && (
                <LoaderCircle className="animate-spin" />
              )}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageScroll>
  )
}

function ProjectChatPluginCard({
  plugin,
  loading,
  operation,
  onRemove,
}: {
  plugin?: StreamDockPlugin
  loading: boolean
  operation?: "remove"
  onRemove: () => void
}) {
  const installed = Boolean(plugin?.isInstalled)

  return (
    <article className="flex min-h-[300px] flex-col overflow-hidden rounded-xl bg-surface-subtle ring-1 ring-border-subtle ring-inset">
      <div className="flex items-start gap-4 p-5 pb-4 lg:p-6 lg:pb-4">
        <img
          src={projectChatIcon}
          alt=""
          className="size-12 shrink-0 rounded-2xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-[-0.02em]">
              Плагин опросов
            </h2>
            <DevelopmentBadge />
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

      <div className="mt-auto flex justify-end gap-2 p-5 lg:p-6">
        {installed && (
          <Button
            size="lg"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={Boolean(operation) || loading}
            onClick={onRemove}
          >
            <Trash2 /> Удалить
          </Button>
        )}
        <Button
          size="lg"
          disabled
          aria-disabled="true"
        >
          Установить
        </Button>
      </div>
    </article>
  )
}

function DevelopmentBadge() {
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-md bg-foreground/6 px-2 text-[11px] font-medium text-muted-foreground ring-1 ring-border-subtle ring-inset">
      <Clock3 className="size-3" />
      В разработке
    </span>
  )
}

function TwitchPluginCard({ plugin }: { plugin?: StreamDockPlugin }) {
  const installed = Boolean(plugin?.isInstalled)
  return (
    <article className="flex min-h-[300px] flex-col overflow-hidden rounded-xl bg-surface-subtle ring-1 ring-border-subtle ring-inset">
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
      className="mx-5 grid gap-2 rounded-xl bg-background/65 p-3 ring-1 ring-border-subtle transition-colors ring-inset lg:mx-6"
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
        className={`mx-auto flex aspect-square w-full max-w-14 items-center justify-center overflow-hidden rounded-xl bg-surface-raised shadow-[inset_0_1px_var(--border-subtle)] ${tone === "twitch" ? "text-twitch" : "text-brand"}`}
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
      ? "bg-twitch/10 text-twitch ring-twitch/18"
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
