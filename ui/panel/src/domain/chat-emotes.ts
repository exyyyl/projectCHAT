export type ChatEmoteProvider = "twitch" | "7tv" | "bttv" | "ffz"
export type ChatEmote = {
  id: string
  code: string
  url: string
  provider: ChatEmoteProvider
  scope?: "channel" | "global"
  ownerId?: string
  ownerName?: string
  ownerAvatarUrl?: string
}
export type ChatEmoteSpan = { start: number; end: number; id: string }
export type ChatEmoteCatalog = {
  channelId: string
  emotes: ChatEmote[]
  unavailable: ChatEmoteProvider[]
  requiresReconnect: boolean
}
export type ChatMessagePart = { text: string; url?: string; href?: string }

export type ChatEmoteGroup = {
  id: string
  label: string
  avatarUrl?: string
  emotes: ChatEmote[]
}
const providerLabels = {
  twitch: "Twitch",
  "7tv": "7TV",
  bttv: "BTTV",
  ffz: "FFZ",
}

export function groupChatEmotes(
  emotes: ChatEmote[],
  channelId = ""
): ChatEmoteGroup[] {
  const groups = new Map<string, ChatEmoteGroup>()
  for (const emote of emotes) {
    const channel = emote.scope === "channel"
    const id = channel
      ? `channel:${emote.ownerId || channelId || emote.provider}`
      : `global:${emote.provider}`
    if (!groups.has(id))
      groups.set(id, {
        id,
        label: channel
          ? emote.ownerName ||
            (emote.ownerId || channelId
              ? `Канал #${emote.ownerId || channelId}`
              : "Смайлики канала")
          : `${providerLabels[emote.provider]} · Глобальные`,
        avatarUrl: emote.ownerAvatarUrl,
        emotes: [],
      })
    groups.get(id)!.emotes.push(emote)
  }
  const providers = ["twitch", "7tv", "bttv", "ffz"]
  const rank = (group: ChatEmoteGroup) =>
    group.id.startsWith("global:")
      ? providers.indexOf(group.id.slice(7))
      : group.id === `channel:${channelId}`
        ? 4
        : 5
  return [...groups.values()].sort(
    (a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label, "ru")
  )
}

function linkParts(text: string): ChatMessagePart[] {
  const parts: ChatMessagePart[] = []
  const pattern =
    /https?:\/\/[^\s<>"']+|(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+[\p{L}]{2,}(?::\d{1,5})?(?:[/?#][^\s<>"']*)?/giu
  let offset = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index
    // Do not turn the domain inside an email or another URI scheme into a link.
    if (start && /[\p{L}\p{N}_@/:.-]/u.test(text[start - 1])) continue
    let label = match[0].replace(/[.,!?;:…]+$/u, "")
    for (const [open, close] of [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
    ]) {
      while (
        label.endsWith(close) &&
        label.split(close).length > label.split(open).length
      )
        label = label.slice(0, -1)
    }
    label = label.replace(/[.,!?;:…]+$/u, "")
    try {
      const url = new URL(
        /^https?:\/\//iu.test(label) ? label : `https://${label}`
      )
      if (
        !url.hostname ||
        url.username ||
        url.password ||
        !["http:", "https:"].includes(url.protocol)
      )
        continue
      if (start > offset) parts.push({ text: text.slice(offset, start) })
      parts.push({ text: label, href: url.href })
      offset = start + label.length
    } catch {
      /* Malformed addresses remain plain text. */
    }
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) })
  return parts
}

export function emoteLookup(
  emotes: ChatEmote[],
  preferred: ChatEmoteProvider = "ffz"
) {
  const lookup = new Map<string, ChatEmote>()
  const order = [...new Set([preferred, "ffz", "7tv", "bttv", "twitch"])]
  // Channel aliases take precedence over global names, regardless of provider.
  for (const channel of [true, false])
    for (const provider of order) {
      for (const emote of emotes)
        if (
          (emote.scope === "channel") === channel &&
          emote.provider === provider &&
          !lookup.has(emote.code)
        )
          lookup.set(emote.code, emote)
    }
  return lookup
}

export function messageParts(
  text: string,
  spans: ChatEmoteSpan[] | undefined,
  lookup: Map<string, ChatEmote>
): ChatMessagePart[] {
  const parts: ChatMessagePart[] = []
  const appendText = (value: string) => {
    for (const token of value.split(/(\s+)/u)) {
      if (!token) continue
      const emote = lookup.get(token)
      if (emote && (emote.provider !== "twitch" || spans === undefined))
        parts.push({ text: token, url: emote.url })
      else if (parts.length && !parts.at(-1)!.url) parts.at(-1)!.text += token
      else parts.push({ text: token })
    }
  }
  let offset = 0
  for (const span of spans || []) {
    if (
      !Number.isSafeInteger(span.start) ||
      !Number.isSafeInteger(span.end) ||
      span.start < offset ||
      span.end <= span.start ||
      span.end > text.length ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(span.id)
    )
      continue
    appendText(text.slice(offset, span.start))
    parts.push({
      text: text.slice(span.start, span.end),
      url: `https://static-cdn.jtvnw.net/emoticons/v2/${span.id}/default/dark/2.0`,
    })
    offset = span.end
  }
  appendText(text.slice(offset))
  return parts.flatMap((part) => (part.url ? [part] : linkParts(part.text)))
}

export function insertEmote(
  text: string,
  code: string,
  start: number,
  end: number,
  limit = 500
) {
  const from = Math.max(0, Math.min(text.length, start))
  const to = Math.max(from, Math.min(text.length, end))
  const before = text.slice(0, from)
  const after = text.slice(to)
  const insertion = `${before && !/\s$/.test(before) ? " " : ""}${code}${after && /^\s/.test(after) ? "" : " "}`
  const next = before + insertion + after
  return next.length <= limit
    ? { text: next, caret: before.length + insertion.length }
    : null
}
