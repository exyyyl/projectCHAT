import { useCallback, useEffect, useState } from "react"
import { Check, Download, LoaderCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

import twitchIcon from "@/assets/stream-dock/twitch-soft.svg"
import discordIcon from "@/assets/stream-dock/discord-ajazz.svg"
import trulaIcon from "@/assets/stream-dock/trula.svg"
import cueIcon from "@/assets/app-icon.png"
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
import { useToast } from "@/components/ui/toast"
import "./stream-dock-page.css"

const PROJECTCHAT_PLUGIN_ID = "ru.projectchat.control.sdplugin"
const PROJECTCHAT_PLUGIN_VERSION = "0.5.0"
const TWITCH_PLUGIN_ID = "com.elgato.twitch.sdplugin"
const TWITCH_PLUGIN_VERSION = "1.11.6.15-ajazz.5"
const TWITCH_PLUGIN_DOWNLOAD =
  "https://github.com/exyyyl/ajazz-plugin-manager/releases/download/twitch-ajazz-v1.11.6.15-ajazz.5/Ajazz-Twitch-Setup.exe"
const DISCORD_PLUGIN_ID = "com.elgato.discord.sdplugin"
const DISCORD_PLUGIN_VERSION = "1.2.1"
const DISCORD_PLUGIN_DOWNLOAD =
  "https://github.com/exyyyl/ajazz-plugin-manager/releases/download/discord-ajazz-v1.2.1/Ajazz-Discord-Standalone-Setup.exe"
const TRULA_PLUGIN_ID = "com.projectdeck.trula.sdplugin"
const TRULA_PLUGIN_VERSION = "0.4.1"
const TRULA_PLUGIN_DOWNLOAD =
  "https://github.com/exyyyl/ajazz-plugin-manager/releases/download/trula-ajazz-v0.4.1/Ajazz-Trula-Setup.exe"

type PluginDefinition = {
  id: string
  name: string
  title?: string
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
    title: "Twitch",
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
    title: "Discord",
    version: DISCORD_PLUGIN_VERSION,
    image: discordIcon,
    description: "Управление Discord с кнопок Stream Dock.",
    actions: ["Микрофон", "Звук", "Голосовые каналы"],
    download: DISCORD_PLUGIN_DOWNLOAD,
    requirement:
      "Запустите установщик и подтвердите доступ в открытом Discord через настройки действия в AJAZZ.",
  },
  {
    id: TRULA_PLUGIN_ID,
    name: "Trula для AJAZZ",
    title: "Trula",
    version: TRULA_PLUGIN_VERSION,
    image: trulaIcon,
    description: "Управление музыкой Trula с кнопок Stream Dock.",
    actions: [
      "Пуск / пауза",
      "Звук на стриме и у себя",
      "Громкость",
      "Трек в чат",
    ],
    download: TRULA_PLUGIN_DOWNLOAD,
    requirement:
      "Запустите установщик и подключите Trula через настройки действия в AJAZZ.",
  },
  {
    id: PROJECTCHAT_PLUGIN_ID,
    name: "Cue",
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
    if (!api) return
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [api, refresh])

  const isInstalled = (id: string) =>
    plugins.some(
      (plugin) => plugin.id.toLowerCase() === id && plugin.isInstalled
    )
  const pollInstalled = isInstalled(PROJECTCHAT_PLUGIN_ID)

  const removeProjectChat = async () => {
    const plugin = plugins.find(
      (item) => item.id.toLowerCase() === PROJECTCHAT_PLUGIN_ID
    )
    if (!api || !plugin) return
    setRemoving(true)
    try {
      await api.uninstallPlugin(plugin.id)
      showToast({ message: "Cue удалён", tone: "success" })
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
      <section aria-label="Плагины Stream Dock" className="stream-dock-plugins">
        {failed && (
          <p role="status" className="stream-dock-error">
            Не удалось проверить установку. Откройте раздел ещё раз, чтобы
            повторить.
          </p>
        )}
        <div className="stream-dock-services">
          {pluginDefinitions
            .filter((definition) => definition.download)
            .map((definition) => {
              const installed = isInstalled(definition.id)
              return (
                <div key={definition.id} className="stream-dock-service">
                  <img
                    src={definition.image}
                    alt=""
                    className="stream-dock-service-mark"
                  />
                  <div className="stream-dock-service-name">
                    <h3>{definition.title || definition.name}</h3>
                    <p>
                      {definition.version}
                      {!loading && !failed && installed && (
                        <span className="stream-dock-installed">
                          <Check aria-hidden="true" />
                          Установлен
                        </span>
                      )}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={definition.download}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Скачать ${definition.name}`}
                    >
                      <Download aria-hidden="true" />
                      Скачать
                    </a>
                  </Button>
                </div>
              )
            })}
          <div className="stream-dock-service">
            <img src={cueIcon} alt="" className="stream-dock-service-mark" />
            <div className="stream-dock-service-name">
              <h3>Cue</h3>
              {pollInstalled && !loading && !failed && (
                <p className="stream-dock-installed">
                  <Check aria-hidden="true" />
                  Установлен
                </p>
              )}
            </div>
            <span className="stream-dock-state">В разработке</span>
            {pollInstalled && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Удалить Cue"
                disabled={removing || loading}
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </div>
      </section>
      <AlertDialog
        open={confirmRemove}
        onOpenChange={(nextOpen) => {
          if (!removing) setConfirmRemove(nextOpen)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить Cue?</AlertDialogTitle>
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
