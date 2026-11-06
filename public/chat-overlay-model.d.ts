import type { WidgetFont } from './widget-fonts.js';
export type ChatOverlaySettings = {
  enabled: boolean; style: 'cards' | 'minimal' | 'bubble'; fontSize: number; emoteSize: number;
  font: WidgetFont; textColor: string; backgroundColor: string; opacity: number;
  nameColor: string; useTwitchColors: boolean; showBadges: boolean; showTime: boolean;
  maxMessages: number; hideAfter: number; animation: 'slide' | 'fade' | 'scale' | 'side' | 'turn' | 'reveal' | 'bounce'; animationDuration: number;
  alignment: 'left' | 'right'; gap: number; radius: number; emoteProvider: 'ffz' | '7tv' | 'bttv';
}
export const chatOverlayDefaults: Readonly<ChatOverlaySettings>;
export const chatOverlayRanges: Readonly<Record<string, readonly [number, number]>>;
type ChatOverlayInput = Omit<Partial<ChatOverlaySettings>, 'animation'> & { animation?: ChatOverlaySettings['animation'] | 'none' };
export function resolveChatOverlay(input?: ChatOverlayInput): ChatOverlaySettings;
type ChatMotionFrame = { x: number; y: number; scale: number; rotation: number; clipPath: string };
export function chatOverlayMotion(input: ChatOverlayInput, reduced?: boolean): { enter: ChatMotionFrame; exit: ChatMotionFrame; settled: ChatMotionFrame; duration: number; origin: string; ease: string };
export function visibleChatMessages<T extends { kind?: string; deleted?: boolean; sentAt: number }>(messages: T[], settings: ChatOverlaySettings, now: number): T[];
export type ChatOverlayPreset = { readonly id: string; readonly name: string; readonly settings: Readonly<Partial<ChatOverlaySettings>> };
export const chatOverlayPresets: readonly ChatOverlayPreset[];
export function matchingChatOverlayPreset(settings: ChatOverlaySettings): ChatOverlayPreset | null;
export function chatOverlayStyle(settings: ChatOverlaySettings): Record<string, string>;
