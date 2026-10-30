export type ChatOverlaySettings = {
  enabled: boolean; style: 'cards' | 'minimal' | 'bubble'; fontSize: number; emoteSize: number;
  font: 'geist' | 'system' | 'mono'; textColor: string; backgroundColor: string; opacity: number;
  nameColor: string; useTwitchColors: boolean; showBadges: boolean; showTime: boolean;
  maxMessages: number; hideAfter: number; animation: 'slide' | 'fade' | 'none'; animationDuration: number;
  alignment: 'left' | 'right'; gap: number; radius: number; emoteProvider: 'ffz' | '7tv' | 'bttv';
}
export const chatOverlayDefaults: Readonly<ChatOverlaySettings>;
export const chatOverlayRanges: Readonly<Record<string, readonly [number, number]>>;
export function resolveChatOverlay(input?: Partial<ChatOverlaySettings>): ChatOverlaySettings;
export function visibleChatMessages<T extends { kind?: string; sentAt: number }>(messages: T[], settings: ChatOverlaySettings, now: number): T[];
export type ChatOverlayPreset = { readonly id: string; readonly name: string; readonly settings: Readonly<Partial<ChatOverlaySettings>> };
export const chatOverlayPresets: readonly ChatOverlayPreset[];
export function matchingChatOverlayPreset(settings: ChatOverlaySettings): ChatOverlayPreset | null;
export function chatOverlayStyle(settings: ChatOverlaySettings): Record<string, string>;
