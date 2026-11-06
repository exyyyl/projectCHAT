export type WidgetFont = 'geist' | 'system' | 'mono' | 'serif' | 'manrope' | 'rubik' | 'nunito-sans' | 'montserrat' | 'oswald' | 'roboto-slab' | 'cormorant-garamond' | 'jetbrains-mono';
export const widgetFonts: readonly WidgetFont[];
export const widgetFontOptions: ReadonlyArray<readonly [WidgetFont, string]>;
export const widgetFontFiles: readonly string[];
export function widgetFontFamily(font?: WidgetFont): string;
export function resolveWidgetFont(font?: WidgetFont): WidgetFont;
