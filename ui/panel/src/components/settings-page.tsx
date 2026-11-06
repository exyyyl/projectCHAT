import type { SavedTemplate } from "@/domain/templates"
import type { ContestOverlaySettings } from "../../../../public/contest-overlay-model.js"
import type { ChatOverlaySettings } from "../../../../public/chat-overlay-model.js"
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionTransition } from "@/components/section-transition"
import { Check, Download, ExternalLink, FileUp } from "lucide-react"
import appIcon from "@/assets/app-icon.png"
import {
  settingsTitles,
  type SettingsSection,
} from "@/domain/settings-navigation"

import { useTheme } from "@/components/theme-provider"
import { appThemes, isAppTheme } from "@/domain/app-themes"
import { RadioGroup } from "radix-ui"
import { TwitchSettings } from "@/components/twitch-settings"
import { UpdateSettings } from "@/components/update-control"
import { StreamDockPage } from "@/components/stream-dock-page"
import { DiagnosticsSettings } from "@/components/diagnostics-settings"
import { Button } from "@/components/ui/button"
import "./settings-page.css"
import { FormSwitch } from "@/components/form-controls"
import { useToast } from "@/components/ui/toast"
import { useDemoMode } from "@/hooks/use-demo-mode"
import type { Draft, Preset, TwitchState, WidgetSettings } from "@/domain/polls"

type SettingsPageProps = {
  section: SettingsSection
  active: boolean
  onSectionChange: (section: SettingsSection) => void
  draft: Draft
  presets: Preset[]
  templates: SavedTemplate[]
  widget: WidgetSettings
  contestOverlay: ContestOverlaySettings
  chatOverlay: ChatOverlaySettings
  canImport: boolean
  busy: boolean
  twitch: TwitchState
  onImport: (settings: unknown) => Promise<boolean>
  onTwitchCommand: (type: "connect" | "disconnect") => void
}

export function SettingsPage({
  section,
  active,
  onSectionChange,
  draft,
  presets,
  templates,
  widget,
  contestOverlay,
  chatOverlay,
  canImport,
  busy,
  twitch,
  onImport,
  onTwitchCommand,
}: SettingsPageProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const headingId = useId()
  const previousSection = useRef(section)
  useEffect(() => {
    if (previousSection.current === section) return
    previousSection.current = section
    const frame = requestAnimationFrame(() =>
      headingRef.current?.focus({ preventScroll: true })
    )
    return () => cancelAnimationFrame(frame)
  }, [section])
  useEffect(() => {
    const element = root.current
    const showJournal = () => onSectionChange("diagnostics")
    element?.addEventListener("cue:open-diagnostics", showJournal)
    return () =>
      element?.removeEventListener("cue:open-diagnostics", showJournal)
  }, [onSectionChange])
  const showToast = useToast()
  const bridge = window.streamPollsDesktop
  const { enabled: demoEnabled, setEnabled: setDemoEnabled } = useDemoMode()
  const [preferences, setPreferences] = useState<DesktopPreferences>()
  const [preferenceBusy, setPreferenceBusy] = useState<
    "openAtLogin" | "runInBackground" | "updateChannel"
  >()

  useEffect(() => {
    if (!bridge) return
    let active = true
    void bridge
      .getPreferences()
      .then((value) => active && setPreferences(value))
      .catch((failure) => {
        if (active)
          showToast({
            message:
              failure instanceof Error
                ? failure.message
                : "Не удалось загрузить настройки приложения.",
            tone: "error",
          })
      })
    return () => {
      active = false
    }
  }, [bridge, showToast])

  const updatePreference = async (
    key: "openAtLogin" | "runInBackground" | "updateChannel",
    value: boolean | DesktopPreferences["updateChannel"]
  ) => {
    if (!bridge) return
    setPreferenceBusy(key)
    try {
      const patch =
        key === "updateChannel"
          ? { updateChannel: value as DesktopPreferences["updateChannel"] }
          : { [key]: value as boolean }
      const next = await bridge.setPreferences(patch)
      setPreferences(next)
      showToast({
        message:
          key === "openAtLogin"
            ? value
              ? "Автозапуск включён"
              : "Автозапуск выключен"
            : key === "runInBackground"
              ? value
                ? "Работа в трее включена"
                : "Работа в трее выключена"
              : value === "beta"
                ? "Бета-обновления включены"
                : "Выбран стабильный канал",
        tone: "success",
      })
    } catch (failure) {
      showToast({
        message:
          failure instanceof Error
            ? failure.message
            : "Не удалось изменить настройку.",
        tone: "error",
      })
    } finally {
      setPreferenceBusy(undefined)
    }
  }

  const exportSettings = () => {
    const settings = {
      schema: 1,
      app: "Cue",
      exportedAt: new Date().toISOString(),
      draft,
      presets: presets.map((preset) => ({
        name: preset.name,
        draft: preset.draft,
        pinned: preset.pinned,
      })),
      templates,
      widget,
      contestOverlay,
      chatOverlay,
    }
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Cue-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    showToast({ message: "Файл настроек экспортирован", tone: "success" })
  }

  const importSettings = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Файл настроек должен быть не больше 2 МБ")
      const settings = JSON.parse(await file.text()) as unknown
      if (await onImport(settings))
        showToast({ message: "Настройки импортированы", tone: "success" })
    } catch (failure) {
      showToast({
        message:
          failure instanceof Error
            ? failure.message
            : "Не удалось прочитать файл",
        tone: "error",
      })
    }
  }

  return (
    <section
      ref={root}
      data-error-journal
      aria-label="Настройки"
      className="settings-layout"
    >
      <SectionTransition
        transitionKey={section}
        active={active}
        variant="settings"
        className="settings-detail"
      >
        <header className="settings-detail-header">
          <h1 ref={headingRef} id={headingId} tabIndex={-1}>
            {settingsTitles[section]}
          </h1>
        </header>
        <div
          key={section}
          className="settings-detail-scroll"
          role="region"
          aria-labelledby={headingId}
        >
          <div className="settings-detail-content">
            {section === "general" && (
              <>
                <SettingsBlock title="Аккаунт Twitch">
                  <TwitchSettings
                    state={twitch}
                    busy={busy}
                    onCommand={onTwitchCommand}
                  />
                </SettingsBlock>
                <SettingsBlock title="Приложение">
                  <div className="settings-rows">
                    <PreferenceRow
                      label="Автозапуск"
                      hint={
                        preferenceHint(
                          bridge,
                          preferences,
                          preferences?.openAtLoginSupported
                        ) ??
                        (preferences?.openAtLogin
                          ? "Запускается в трее"
                          : undefined)
                      }
                      checked={preferences?.openAtLogin ?? false}
                      disabled={
                        !preferences?.openAtLoginSupported ||
                        preferenceBusy !== undefined
                      }
                      onCheckedChange={(checked) =>
                        void updatePreference("openAtLogin", checked)
                      }
                    />
                    <PreferenceRow
                      label="Работа в трее"
                      hint={preferenceHint(
                        bridge,
                        preferences,
                        preferences?.runInBackgroundSupported
                      )}
                      checked={preferences?.runInBackground ?? false}
                      disabled={
                        !preferences?.runInBackgroundSupported ||
                        preferenceBusy !== undefined
                      }
                      onCheckedChange={(checked) =>
                        void updatePreference("runInBackground", checked)
                      }
                    />
                    <PreferenceRow
                      label="Демо-режим"
                      checked={demoEnabled}
                      disabled={false}
                      onCheckedChange={setDemoEnabled}
                    />
                  </div>
                </SettingsBlock>
              </>
            )}
            {section === "appearance" && <ThemeSettings />}
            {section === "updates" && (
              <SettingsBlock title="Версия приложения">
                <UpdateSettings />
              </SettingsBlock>
            )}
            {section === "data" && (
              <SettingsBlock title="Настройки и шаблоны">
                <div className="settings-data-actions">
                  <div className="settings-data-row">
                    <span className="settings-data-icon">
                      <Download aria-hidden="true" />
                    </span>
                    <div className="settings-data-copy">
                      <h3>Экспорт</h3>
                      <p>Сохранить на компьютер</p>
                    </div>
                    <Button variant="outline" onClick={exportSettings}>
                      Экспортировать
                    </Button>
                  </div>
                  <div className="settings-data-row">
                    <span className="settings-data-icon">
                      <FileUp aria-hidden="true" />
                    </span>
                    <div className="settings-data-copy">
                      <h3>Импорт</h3>
                      <p id={`${headingId}-import-hint`}>
                        {canImport
                          ? "Восстановить из файла"
                          : "Завершите опрос для импорта."}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={!canImport || busy}
                      aria-describedby={`${headingId}-import-hint`}
                      onClick={() => inputRef.current?.click()}
                    >
                      Импортировать
                    </Button>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={importSettings}
                  />
                </div>
              </SettingsBlock>
            )}
            {section === "plugins" && active && <StreamDockPage />}
            {section === "diagnostics" && active && <DiagnosticsSettings />}
            {section === "about" && <ProjectInfo />}
          </div>
        </div>
      </SectionTransition>
    </section>
  )
}

function ThemeSettings() {
  const { theme, setTheme } = useTheme()
  return (
    <RadioGroup.Root
      className="theme-grid"
      aria-label="Тема приложения"
      value={theme}
      onValueChange={(value) => {
        if (isAppTheme(value)) setTheme(value)
      }}
    >
      {appThemes.map((option) => (
        <RadioGroup.Item
          key={option.id}
          value={option.id}
          className="theme-option"
          aria-label={option.label}
        >
          <span
            aria-hidden="true"
            className={`theme-preview dark theme-${option.id}`}
          >
            <span className="theme-preview-sidebar">
              <span className="theme-preview-mark" />
              <span className="theme-preview-nav" data-active />
              <span className="theme-preview-nav" />
              <span className="theme-preview-nav" />
              <span className="theme-preview-profile" />
            </span>
            <span className="theme-preview-workspace">
              <span className="theme-preview-title">Студия</span>
              <span className="theme-preview-content">
                <span className="theme-preview-tools">
                  <span />
                  <span />
                </span>
                <span className="theme-preview-chat">
                  {[0, 1, 2].map((row) => (
                    <span className="theme-preview-message" key={row}>
                      <span className="theme-preview-avatar" />
                      <span className="theme-preview-lines">
                        <span />
                        <span />
                      </span>
                    </span>
                  ))}
                  <span className="theme-preview-composer">
                    <span />
                    <span />
                  </span>
                </span>
              </span>
            </span>
          </span>
          <span className="theme-option-caption">
            <span>{option.label}</span>
            <span aria-hidden="true" className="theme-option-check">
              {theme === option.id && <Check />}
            </span>
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}

function SettingsBlock({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="settings-block">
      <div className="settings-block-heading">
        <h3>{title}</h3>
        {action}
      </div>
      <div className="settings-group @container">{children}</div>
    </section>
  )
}

function PreferenceRow({
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  hint?: ReactNode
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <FormSwitch
      label={label}
      hint={hint}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    />
  )
}

function preferenceHint(
  bridge: typeof window.streamPollsDesktop,
  preferences: DesktopPreferences | undefined,
  supported: boolean | undefined
) {
  if (!bridge) return "Только в приложении"
  if (!preferences) return <Skeleton className="my-1 h-2.5 w-28" />
  return supported ? undefined : "Недоступно на этом устройстве"
}

function ProjectInfo() {
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    const bridge = window.streamPollsDesktop
    if (bridge)
      void bridge
        .getInfo()
        .then((info) => {
          if (active) setVersion(info.version)
        })
        .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return (
    <div className="settings-group about-cue">
      <div className="about-cue-identity">
        <img src={appIcon} width={48} height={48} alt="" />
        <div>
          <div className="about-cue-name">
            <h2>Cue</h2>
            {version && <span>{version}</span>}
          </div>
        </div>
      </div>
      <dl className="about-cue-team" aria-label="Команда Cue">
        <div>
          <dt>exyyyl</dt>
          <dd>Разработка</dd>
        </div>
        <div>
          <dt>peachysoul</dt>
          <dd>Креативная поддержка</dd>
        </div>
      </dl>
      <TelegramLink />
    </div>
  )
}

function TelegramLink() {
  return (
    <a
      href="https://t.me/itsprojectCHAT"
      target="_blank"
      rel="noreferrer"
      aria-label="@itsprojectCHAT — новости и поддержка в Telegram"
      className="about-cue-telegram"
    >
      <span className="about-cue-telegram-icon">
        <TelegramIcon />
      </span>
      <span>
        <strong>Telegram</strong>
        <span>@itsprojectCHAT</span>
      </span>
      <ExternalLink aria-hidden="true" />
    </a>
  )
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M21.6 3.2a1.6 1.6 0 0 0-1.7-.23L3.25 9.5c-1.12.44-1.1 2.03.04 2.43l4.23 1.47 1.63 5.02c.34 1.05 1.68 1.34 2.42.53l2.32-2.55 4.13 3.03c.93.68 2.25.17 2.42-.97l2.08-13.27a1.6 1.6 0 0 0-.92-1.99ZM9.3 12.84l8.46-5.27-6.83 6.63-.53 2.82-1.1-4.18Z" />
    </svg>
  )
}
