import { widgetFontFamily } from './widget-fonts.js';
export const chatOverlayDefaults = Object.freeze({
  enabled: true, style: 'cards', fontSize: 24, emoteSize: 32,
  font: 'geist', textColor: '#f4f4f5', backgroundColor: '#141416', opacity: 82,
  nameColor: '#c4c4cb', useTwitchColors: true, showBadges: true, showTime: false,
  maxMessages: 7, hideAfter: 20, animation: 'slide', animationDuration: 450,
  alignment: 'left', gap: 10, radius: 14, emoteProvider: 'ffz',
});
export const chatOverlayRanges = Object.freeze({ fontSize: [14, 48], emoteSize: [20, 72], opacity: [0, 100], maxMessages: [1, 30], hideAfter: [0, 300], animationDuration: [150, 1200], gap: [0, 32], radius: [0, 32] });
export function resolveChatOverlay(input = {}) {
  const settings = { ...chatOverlayDefaults, ...input };
  if (settings.animation === 'none') settings.animation = chatOverlayDefaults.animation;
  return settings;
}
export function chatOverlayMotion(input, reduced = false) {
  const settings = resolveChatOverlay(input);
  const still = { x: 0, y: 0, scale: 1, rotation: 0, clipPath: 'inset(0% 0% 0% 0%)' };
  const side = settings.alignment === 'right' ? 24 : -24;
  const enter = { ...still }, exit = { ...still };
  let ease = 'power3.out';
  if (!reduced) {
    if (settings.animation === 'slide') { enter.y = 20; exit.y = -10; }
    if (settings.animation === 'side') { enter.x = side; exit.x = side / 2; }
    if (settings.animation === 'scale') {
      enter.scale = 0.72; enter.y = 12;
      exit.scale = 0.9;
      ease = 'back.out(1.7)';
    }
    if (settings.animation === 'turn') {
      enter.rotation = settings.alignment === 'right' ? 7 : -7;
      enter.x = side; enter.scale = 0.88;
      exit.rotation = enter.rotation / 2; exit.scale = 0.96;
      ease = 'back.out(1.2)';
    }
    if (settings.animation === 'reveal') {
      enter.clipPath = 'inset(0% 0% 100% 0%)';
      exit.clipPath = 'inset(100% 0% 0% 0%)';
    }
    if (settings.animation === 'bounce') {
      enter.y = -32; exit.y = 12;
      ease = 'bounce.out';
    }
  }
  return {
    enter, exit, settled: still, ease,
    duration: reduced ? 0 : settings.animationDuration / 1000,
    origin: settings.alignment === 'right' ? '100% 100%' : '0% 100%',
  };
}
export function visibleChatMessages(messages, settings, now) {
  const cutoff = settings.hideAfter > 0 ? now - settings.hideAfter * 1000 : -Infinity;
  return messages.filter(message => !message.deleted && message.kind !== 'activity' && message.sentAt > cutoff).slice(-settings.maxMessages);
}

// Looks change appearance only. Output, emote preference and message lifetime stay independent.
export const chatOverlayPresets = Object.freeze([
  { id: 'studio', name: 'Студия', settings: { style: 'cards', font: 'geist', fontSize: 24, emoteSize: 32, backgroundColor: '#141416', textColor: '#f4f4f5', nameColor: '#c4c4cb', opacity: 82, radius: 14, gap: 10, useTwitchColors: true } },
  { id: 'clean', name: 'Лента', settings: { style: 'minimal', font: 'geist', fontSize: 22, emoteSize: 30, backgroundColor: '#141416', textColor: '#f4f4f5', nameColor: '#c4c4cb', opacity: 0, radius: 0, gap: 8, useTwitchColors: true } },
  { id: 'conversation', name: 'Диалог', settings: { style: 'bubble', font: 'geist', fontSize: 22, emoteSize: 30, backgroundColor: '#242329', textColor: '#f5f3f7', nameColor: '#cbbde3', opacity: 94, radius: 22, gap: 8, useTwitchColors: true } },
  { id: 'light', name: 'Снежинка', settings: { style: 'cards', font: 'geist', fontSize: 24, emoteSize: 32, backgroundColor: '#f4f4f5', textColor: '#202024', nameColor: '#62586d', opacity: 96, radius: 14, gap: 10, useTwitchColors: false } },
  { id: 'graphite', name: 'Графит', settings: { style: 'cards', font: 'system', fontSize: 22, emoteSize: 30, backgroundColor: '#24262b', textColor: '#fafafa', nameColor: '#d0d4db', opacity: 96, radius: 8, gap: 6, useTwitchColors: true } },
  { id: 'midnight', name: 'Полночь', settings: { style: 'cards', font: 'geist', fontSize: 24, emoteSize: 32, backgroundColor: '#0d1b2a', textColor: '#e9f1ff', nameColor: '#8cc5ff', opacity: 94, radius: 12, gap: 10, useTwitchColors: false } },
  { id: 'lavender', name: 'Лаванда', settings: { style: 'bubble', font: 'geist', fontSize: 22, emoteSize: 30, backgroundColor: '#302840', textColor: '#f5efff', nameColor: '#d7bcff', opacity: 94, radius: 20, gap: 10, useTwitchColors: false } },
  { id: 'mint', name: 'Мята', settings: { style: 'bubble', font: 'geist', fontSize: 22, emoteSize: 30, backgroundColor: '#18352e', textColor: '#ebfff5', nameColor: '#9ee4b7', opacity: 94, radius: 18, gap: 8, useTwitchColors: false } },
  { id: 'paper', name: 'Бумага', settings: { style: 'cards', font: 'system', fontSize: 22, emoteSize: 30, backgroundColor: '#fff9ed', textColor: '#2f302c', nameColor: '#6b663f', opacity: 100, radius: 4, gap: 8, useTwitchColors: false } },
  { id: 'peach', name: 'Персик', settings: { style: 'bubble', font: 'geist', fontSize: 22, emoteSize: 30, backgroundColor: '#ffe6d9', textColor: '#3d2720', nameColor: '#a4482d', opacity: 98, radius: 24, gap: 10, useTwitchColors: false } },
  { id: 'terminal', name: 'Терминал', settings: { style: 'minimal', font: 'mono', fontSize: 22, emoteSize: 30, backgroundColor: '#08130b', textColor: '#bfe5bd', nameColor: '#7bd174', opacity: 0, radius: 0, gap: 6, useTwitchColors: false } },
  { id: 'monochrome', name: 'Монохром', settings: { style: 'minimal', font: 'system', fontSize: 22, emoteSize: 30, backgroundColor: '#111111', textColor: '#ffffff', nameColor: '#cccccc', opacity: 0, radius: 0, gap: 8, useTwitchColors: false } },
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
    fontFamily: widgetFontFamily(settings.font),
  };
}
