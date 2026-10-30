export type ChatEmoteProvider = "twitch" | "7tv" | "bttv" | "ffz"
export type ChatEmote = { id: string; code: string; url: string; provider: ChatEmoteProvider; scope?: "channel" | "global" }
export type ChatEmoteSpan = { start: number; end: number; id: string }
export type ChatEmoteCatalog = { channelId: string; emotes: ChatEmote[]; unavailable: ChatEmoteProvider[]; requiresReconnect: boolean }
export type ChatMessagePart = { text: string; url?: string }

export function emoteLookup(emotes: ChatEmote[], preferred: ChatEmoteProvider = "ffz") {
  const lookup = new Map<string, ChatEmote>()
  const order = [...new Set([preferred, "ffz", "7tv", "bttv", "twitch"])]
  // Channel aliases take precedence over global names, regardless of provider.
  for (const channel of [true, false]) for (const provider of order) {
    for (const emote of emotes) if ((emote.scope === "channel") === channel && emote.provider === provider && !lookup.has(emote.code)) lookup.set(emote.code, emote)
  }
  return lookup
}

export function messageParts(text: string, spans: ChatEmoteSpan[] | undefined, lookup: Map<string, ChatEmote>): ChatMessagePart[] {
  const parts: ChatMessagePart[] = []
  const appendText = (value: string) => {
    for (const token of value.split(/(\s+)/u)) {
      if (!token) continue
      const emote = lookup.get(token)
      if (emote && (emote.provider !== "twitch" || spans === undefined)) parts.push({ text: token, url: emote.url })
      else if (parts.length && !parts.at(-1)!.url) parts.at(-1)!.text += token
      else parts.push({ text: token })
    }
  }
  let offset = 0
  for (const span of spans || []) {
    if (!Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || span.start < offset || span.end <= span.start || span.end > text.length || !/^[A-Za-z0-9_-]{1,100}$/.test(span.id)) continue
    appendText(text.slice(offset, span.start))
    parts.push({ text: text.slice(span.start, span.end), url: `https://static-cdn.jtvnw.net/emoticons/v2/${span.id}/default/dark/2.0` })
    offset = span.end
  }
  appendText(text.slice(offset))
  return parts
}

export function insertEmote(text: string, code: string, start: number, end: number, limit = 500) {
  const from = Math.max(0, Math.min(text.length, start))
  const to = Math.max(from, Math.min(text.length, end))
  const before = text.slice(0, from)
  const after = text.slice(to)
  const insertion = `${before && !/\s$/.test(before) ? " " : ""}${code}${after && /^\s/.test(after) ? "" : " "}`
  const next = before + insertion + after
  return next.length <= limit ? { text: next, caret: before.length + insertion.length } : null
}
