import { useCallback, useEffect, useState } from "react"
import {
  ChartNoAxesColumn,
  ChevronRight,
  Grid2X2,
  Puzzle,
  X,
  Check,
  Download,
  LoaderCircle,
  Trash2,
} from "lucide-react"

import twitchIcon from "@/assets/stream-dock/twitch-soft.svg"
import discordIcon from "@/assets/stream-dock/discord-ajazz.svg"
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
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import "./utility-windows.css"
import "./stream-dock-page.css"

const PROJECTCHAT_PLUGIN_ID = "ru.projectchat.control.sdplugin"
const PROJECTCHAT_PLUGIN_VERSION = "0.5.0"
const TWITCH_PLUGIN_ID = "com.elgato.twitch.sdplugin"
const TWITCH_PLUGIN_VERSION = "1.11.6.15-ajazz.5"
const TWITCH_PLUGIN_DOWNLOAD =
  "https://github.com/exyyyl/ajazz-plugin-manager/releases/download/twitch-ajazz-v1.11.6.15-ajazz.5/Ajazz-Twitch-Setup.exe"
const DISCORD_PLUGIN_ID = "com.elgato.discord.sdplugin"
const DISCORD_PLUGIN_VERSION = "1.1.0"
const DISCORD_PLUGIN_DOWNLOAD =
  "https://github.com/exyyyl/ajazz-plugin-manager/releases/download/discord-ajazz-v1.1.0/Ajazz-Discord-Setup.exe"

type PluginDefinition = {
  id: string
  name: string
  version: string
  image?: string
  description: string
  actions: string[]
  download?: string
  requirement?: string
  inDevelopment?: boolean
}

const pluginDefinitions: PluginDefinition[] = [
  {
    id: TWITCH_PLUGIN_ID,
    name: "Twitch для AJAZZ",
    version: TWITCH_PLUGIN_VERSION,
    image: twitchIcon,
    description: "Управление Twitch с кнопок Stream Dock.",
    actions: ["Чат", "Клипы", "Реклама", "Название и категория"],
    download: TWITCH_PLUGIN_DOWNLOAD,
    requirement:
      "Запустите установщик, затем подтвердите вход на официальной странице Twitch.",
  },
  {
    id: DISCORD_PLUGIN_ID,
    name: "Discord для AJAZZ",
    version: DISCORD_PLUGIN_VERSION,
    image: discordIcon,
    description: "Управление Discord с кнопок Stream Dock.",
    actions: ["Микрофон", "Звук", "Голосовые каналы"],
    download: DISCORD_PLUGIN_DOWNLOAD,
    requirement:
      "Сначала установите официальный Discord-плагин в Elgato Stream Deck. Затем запустите этот установщик и подтвердите доступ в Discord через настройки действия в AJAZZ.",
  },
  {
    id: PROJECTCHAT_PLUGIN_ID,
    name: "Плагин опросов",
    version: PROJECTCHAT_PLUGIN_VERSION,
    description: "Управление опросами и виджетом Cue с кнопок Stream Dock.",
    actions: ["Старт / стоп", "Виджет", "+30 секунд", "Выбрать шаблон"],
    inDevelopment: true,
  },
]

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Операция не выполнена"
}

export function StreamDockPage() {
  const api = window.streamPollsDesktop?.streamDock
  const showToast = useToast()
  const [open, setOpen] = useState(false)
  const [plugins, setPlugins] = useState<StreamDockPlugin[]>([])
  const [loading, setLoading] = useState(Boolean(api))
  const [failed, setFailed] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const refresh = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      setPlugins(await api.listPlugins())
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    if (!api) return
    let active = true
    void api
      .listPlugins()
      .then((nextPlugins) => {
        if (active) setPlugins(nextPlugins)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [api])

  useEffect(() => {
    if (!open || !api) return
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [open, api, refresh])

  const isInstalled = (id: string) =>
    plugins.some(
      (plugin) => plugin.id.toLowerCase() === id && plugin.isInstalled
    )
  const installedCount = pluginDefinitions.filter((definition) =>
    isInstalled(definition.id)
  ).length
  const pollInstalled = isInstalled(PROJECTCHAT_PLUGIN_ID)

  const removeProjectChat = async () => {
    const plugin = plugins.find(
      (item) => item.id.toLowerCase() === PROJECTCHAT_PLUGIN_ID
    )
    if (!api || !plugin) return
    setRemoving(true)
    try {
      await api.uninstallPlugin(plugin.id)
      showToast({ message: "Плагин опросов удалён", tone: "success" })
      await refresh()
    } catch (error) {
      showToast({ message: errorMessage(error), tone: "error" })
    } finally {
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (nextOpen) void refresh()
        }}
      >
        <DialogTrigger asChild>
          <button
            type="button"
            className="utility-launcher stream-dock-launcher"
            aria-label="Открыть плагины Stream Dock"
          >
            <span className="utility-launcher-symbol">
              <Grid2X2 aria-hidden="true" />
            </span>
            <span className="utility-launcher-name">
              <span>Stream Dock</span>
              {(failed || installedCount > 0) && (
                <small>
                  {failed
                    ? "Не удалось проверить установку"
                    : `Установлено: ${installedCount}`}
                </small>
              )}
            </span>
            <span className="stream-dock-launcher-marks" aria-hidden="true">
              <img src={twitchIcon} alt="" />
              <img src={discordIcon} alt="" />
              <span className="stream-dock-mini-poll">
                <ChartNoAxesColumn />
              </span>
            </span>
            {loading ? (
              <LoaderCircle
                className="utility-launcher-arrow animate-spin"
                aria-hidden="true"
              />
            ) : (
              <ChevronRight
                className="utility-launcher-arrow"
                aria-hidden="true"
              />
            )}
          </button>
        </DialogTrigger>
        <DialogContent
          className="utility-window stream-dock-window"
          showCloseButton={false}
        >
          <header className="utility-window-header">
            <Puzzle className="utility-heading-symbol" aria-hidden="true" />
            <div className="utility-heading">
              <DialogTitle>Плагины</DialogTitle>
              <DialogDescription className="sr-only">
                Установка плагинов для Stream Dock
              </DialogDescription>
            </div>
            <div className="utility-window-tools">
              <DialogClose asChild>
                <button
                  type="button"
                  className="utility-tool utility-close"
                  aria-label="Закрыть"
                >
                  <X />
                </button>
              </DialogClose>
            </div>
          </header>
          <div className="stream-dock-window-body">
            {failed && (
              <p role="status" className="stream-dock-error">
                Не удалось проверить установку. Откройте окно ещё раз, чтобы
                повторить.
              </p>
            )}
            <div
              className="stream-dock-services"
              aria-label="Плагины Stream Dock"
            >
              {pluginDefinitions
                .filter((definition) => definition.download)
                .map((definition) => {
                  const discord = definition.id === DISCORD_PLUGIN_ID
                  const installed = isInstalled(definition.id)
                  return (
                    <section
                      key={definition.id}
                      className={`stream-dock-service ${discord ? "stream-dock-service--discord" : "stream-dock-service--twitch"}`}
                    >
                      <div className="stream-dock-service-heading">
                        <img
                          src={definition.image}
                          alt=""
                          className="stream-dock-service-mark"
                        />
                        <div className="stream-dock-service-name">
                          <h2>{discord ? "Discord" : "Twitch"}</h2>
                          {discord && <p>Нужен плагин Elgato</p>}
                          {!loading && !failed && installed && (
                            <p className="stream-dock-installed">
                              <Check />
                              Установлен
                            </p>
                          )}
                        </div>
                      </div>
                      <a
                        className="stream-dock-download"
                        href={definition.download}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Скачать ${definition.name}`}
                      >
                        <Download aria-hidden="true" />
                        Скачать
                      </a>
                    </section>
                  )
                })}
            </div>
            <div className="stream-dock-poll">
              <span className="stream-dock-poll-mark" aria-hidden="true">
                <ChartNoAxesColumn />
              </span>
              <div className="stream-dock-poll-name">
                <h2>Опросы Cue</h2>
                {pollInstalled && !loading && !failed && (
                  <p>
                    <Check />
                    Установлен
                  </p>
                )}
              </div>
              <span className="stream-dock-poll-state">В разработке</span>
              {pollInstalled && (
                <button
                  type="button"
                  className="utility-tool"
                  aria-label="Удалить плагин опросов"
                  title="Удалить плагин опросов"
                  disabled={removing || loading}
                  onClick={() => setConfirmRemove(true)}
                >
                  <Trash2 />
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={confirmRemove}
        onOpenChange={(nextOpen) => {
          if (!removing) setConfirmRemove(nextOpen)
        }}
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
            <AlertDialogCancel disabled={removing}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removing}
              onClick={() => void removeProjectChat()}
            >
              {removing && <LoaderCircle className="animate-spin" />}Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
