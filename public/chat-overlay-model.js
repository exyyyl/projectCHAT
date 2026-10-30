export const chatOverlayDefaults = Object.freeze({
  enabled: true, style: 'cards', fontSize: 24, emoteSize: 32,
  font: 'geist', textColor: '#f4f4f5', backgroundColor: '#141416', opacity: 82,
  nameColor: '#c4c4cb', useTwitchColors: true, showBadges: true, showTime: false,
  maxMessages: 7, hideAfter: 20, animation: 'slide', animationDuration: 450,
  alignment: 'left', gap: 10, radius: 14, emoteProvider: 'ffz',
});
export const chatOverlayRanges = Object.freeze({ fontSize: [14, 48], emoteSize: [20, 72], opacity: [0, 100], maxMessages: [1, 30], hideAfter: [0, 300], animationDuration: [150, 1200], gap: [0, 32], radius: [0, 32] });
export function resolveChatOverlay(input = {}) { return { ...chatOverlayDefaults, ...input }; }
export function visibleChatMessages(messages, settings, now) {
  const cutoff = settings.hideAfter > 0 ? now - settings.hideAfter * 1000 : -Infinity;
  return messages.filter(message => message.kind !== 'activity' && message.sentAt > cutoff).slice(-settings.maxMessages);
}

// Looks change appearance only. Output, emote preference and message lifetime stay independent.
export const chatOverlayPresets = Object.freeze([
  { id: 'studio', name: 'Студия', settings: { style: 'cards', font: 'geist', fontSize: 24, emoteSize: 32, backgroundColor: '#141416', textColor: '#f4f4f5', nameColor: '#c4c4cb', opacity: 82, radius: 14, gap: 10, useTwitchColors: true } },
  { id: 'clean', name: 'Лента', settings: { style: 'minimal', font: 'geist', fontSize: 22, emoteSize: 30, backgroundColor: '#141416', textColor: '#f4f4f5', nameColor: '#c4c4cb', opacity: 0, radius: 0, gap: 8, useTwitchColors: true } },
  { id: 'conversation', name: 'Диалог', settings: { style: 'bubble', font: 'geist', fontSize: 22, emoteSize: 30, backgroundColor: '#242329', textColor: '#f5f3f7', nameColor: '#cbbde3', opacity: 94, radius: 22, gap: 8, useTwitchColors: true } },
  { id: 'light', name: 'Светлый', settings: { style: 'cards', font: 'geist', fontSize: 24, emoteSize: 32, backgroundColor: '#f4f4f5', textColor: '#202024', nameColor: '#62586d', opacity: 96, radius: 14, gap: 10, useTwitchColors: false } },
].map(preset => Object.freeze({ ...preset, settings: Object.freeze(preset.settings) })));
const identityFields = ['style', 'font', 'backgroundColor', 'textColor', 'nameColor', 'opacity', 'useTwitchColors'];
export function matchingChatOverlayPreset(settings) {
  return chatOverlayPresets.find(preset => identityFields.every(key => settings[key] === preset.settings[key])) || null;
}
export function chatOverlayStyle(settings) {
  const alpha = Math.round(settings.opacity * 2.55).toString(16).padStart(2, '0');
  return {
    '--chat-font-size': `${settings.fontSize}px`, '--chat-emote-size': `${settings.emoteSize}px`,
    '--chat-text': settings.textColor, '--chat-background': `${settings.backgroundColor}${alpha}`,
    '--chat-gap': `${settings.gap}px`, '--chat-radius': `${settings.radius}px`,
    fontFamily: settings.font === 'mono' ? 'ui-monospace, monospace' : settings.font === 'system' ? 'system-ui, sans-serif' : 'Geist, system-ui, sans-serif',
  };
}
