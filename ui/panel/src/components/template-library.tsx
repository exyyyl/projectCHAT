import { useState } from "react"
import {
  BookmarkPlus,
  CircleDashed,
  Gift,
  ListChecks,
  MessageCircle,
  MoreHorizontal,
  PanelsTopLeft,
  Pin,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { DropdownMenu } from "radix-ui"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { PresetEditor } from "./preset-editor"
import { PresetDialogs } from "./preset-dialogs"
import type { Draft, PresetDialogState } from "@/domain/polls"
import {
  templateLabels,
  templateSummary,
  type LibraryKind,
  type LibraryTemplate,
} from "@/domain/templates"
import "./template-library.css"

const icons = {
  poll: ListChecks,
  contest: Gift,
  wheel: CircleDashed,
  "poll-widget": PanelsTopLeft,
  "chat-widget": MessageCircle,
  "contest-widget": Gift,
}
export function TemplateLibrary({
  templates,
  dialog,
  busy,
  connected,
  onCreate,
  onUse,
  onEdit,
  onPin,
  onDelete,
  onReorder,
  onSavePoll,
  onCloseEditor,
  blocked,
}: {
  templates: LibraryTemplate[]
  dialog: PresetDialogState | null
  busy: boolean
  connected: boolean
  onCreate: (kind: LibraryKind) => void
  onUse: (template: LibraryTemplate) => void
  onEdit: (template: LibraryTemplate) => void
  onPin: (template: LibraryTemplate) => void
  onDelete: (template: LibraryTemplate) => Promise<boolean>
  onReorder: (template: LibraryTemplate, target: LibraryTemplate) => void
  onSavePoll: (name: string, draft: Draft) => Promise<boolean>
  onCloseEditor: () => void
  blocked: (template: LibraryTemplate) => string | null
}) {
  const [filter, setFilter] = useState<LibraryKind | "all">("all")
  const [query, setQuery] = useState("")
  const [pendingDelete, setPendingDelete] = useState<LibraryTemplate | null>(
    null
  )
  const [dragged, setDragged] = useState<LibraryTemplate | null>(null)
  const search = query.trim().toLocaleLowerCase("ru")
  const filtered = templates
    .filter(
      (template) =>
        (filter === "all" || template.kind === filter) &&
        (!search ||
          `${template.name} ${templateSummary(template)}`
            .toLocaleLowerCase("ru")
            .includes(search))
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned))
  if (dialog)
    return (
      <div className="h-full">
        <PresetEditor
          key={dialog.mode === "edit" ? dialog.preset.id : dialog.editorId}
          dialog={dialog}
          busy={busy}
          onSave={onSavePoll}
          onClose={onCloseEditor}
        />
      </div>
    )
  return (
    <section className="template-library" aria-label="Шаблоны">
      <div className="template-library-tools">
        <div className="template-search">
          <Search aria-hidden="true" />
          <Input
            aria-label="Найти шаблон"
            placeholder="Найти шаблон"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button disabled={busy || !connected}>
              <Plus />
              Новый шаблон
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="template-menu"
              align="end"
              sideOffset={6}
            >
              {(Object.keys(templateLabels) as LibraryKind[]).map((kind) => {
                const Icon = icons[kind]
                return (
                  <DropdownMenu.Item key={kind} onSelect={() => onCreate(kind)}>
                    <Icon />
                    {templateLabels[kind]}
                  </DropdownMenu.Item>
                )
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      <div
        className="template-filters"
        role="group"
        aria-label="Раздел шаблонов"
      >
        {(["all", ...Object.keys(templateLabels)] as const).map((kind) => (
          <Button
            key={kind}
            variant={filter === kind ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={filter === kind}
            onClick={() => setFilter(kind as LibraryKind | "all")}
          >
            {kind === "all" ? "Все" : templateLabels[kind as LibraryKind]}
          </Button>
        ))}
      </div>
      {!connected && (
        <p className="template-status" role="status">
          Нет связи с приложением. Шаблоны станут доступны после подключения.
        </p>
      )}
      <div className="template-library-results">
        {filtered.length ? (
          <div className="template-grid">
            {filtered.map((template) => {
              const Icon = icons[template.kind],
                reason = blocked(template)
              return (
                <article
                  key={template.id}
                  className="template-card"
                  draggable={!busy && connected}
                  onDragStart={(event) => {
                    setDragged(template)
                    event.dataTransfer.setData("text/plain", template.id)
                  }}
                  onDragEnd={() => setDragged(null)}
                  onDragOver={(event) => {
                    if (
                      dragged &&
                      dragged.id !== template.id &&
                      dragged.kind === template.kind &&
                      dragged.pinned === template.pinned
                    )
                      event.preventDefault()
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (
                      dragged &&
                      dragged.kind === template.kind &&
                      dragged.pinned === template.pinned
                    )
                      onReorder(dragged, template)
                    setDragged(null)
                  }}
                >
                  <div className="template-card-heading">
                    <Icon aria-hidden="true" />
                    <h2>{template.name}</h2>
                    {template.pinned && (
                      <Pin className="template-pinned" aria-label="Закреплён" />
                    )}
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Действия: ${template.name}`}
                          disabled={busy || !connected}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="template-menu"
                          align="end"
                        >
                          <DropdownMenu.Item onSelect={() => onPin(template)}>
                            <Pin />
                            {template.pinned ? "Открепить" : "Закрепить"}
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="template-delete"
                            onSelect={() => setPendingDelete(template)}
                          >
                            <Trash2 />
                            Удалить
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>
                  <span className="template-kind">
                    {templateLabels[template.kind]}
                  </span>
                  <p className="template-description">
                    {templateSummary(template)}
                  </p>
                  {template.kind === "poll" && (
                    <ul className="template-options">
                      {template.data.options.map((option) => (
                        <li key={option.id}>
                          {option.name}
                          <span>{option.word}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {template.kind === "contest" && (
                    <p className="template-details">
                      {template.data.allowedRoles
                        .map(
                          (role) =>
                            ({
                              viewer: "Зрители",
                              subscriber: "Подписчики",
                              vip: "VIP",
                              moderator: "Модераторы",
                            })[role]
                        )
                        .join(" · ")}
                      {template.data.antiSpam ? " · Антиспам" : ""}
                    </p>
                  )}
                  {template.kind === "wheel" && (
                    <p className="template-details">
                      {template.data.withoutRepeats
                        ? "Без повторов"
                        : "С повторами"}
                    </p>
                  )}
                  <div className="template-card-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={
                        busy ||
                        !connected ||
                        (template.kind !== "poll" && !!reason)
                      }
                      onClick={() => onEdit(template)}
                    >
                      Изменить
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy || !connected || !!reason}
                      onClick={() => onUse(template)}
                    >
                      {reason || "Использовать"}
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="template-empty">
            <BookmarkPlus aria-hidden="true" />
            <h2>{search ? "Ничего не найдено" : "Здесь будут ваши шаблоны"}</h2>
            <p>
              {search
                ? "Попробуйте другое название."
                : "Сохраните готовые настройки в нужном разделе."}
            </p>
            {!search && (
              <Button
                variant="outline"
                disabled={!connected || busy}
                onClick={() => onCreate(filter === "all" ? "poll" : filter)}
              >
                Создать шаблон
              </Button>
            )}
          </div>
        )}
      </div>
      <PresetDialogs
        pendingDelete={pendingDelete}
        onDeleteChange={setPendingDelete}
        onConfirmDelete={(template) => {
          void onDelete(template as LibraryTemplate).then((ok) => {
            if (ok) setPendingDelete(null)
          })
        }}
      />
    </section>
  )
}
