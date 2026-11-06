// Twitch receives one message; keep line breaks only in the composer's draft.
export function normalizeChatText(text) {
  return text.replace(/[ \t]*[\r\n\u2028\u2029][ \t\r\n\u2028\u2029]*/g, ' ').trim();
}
