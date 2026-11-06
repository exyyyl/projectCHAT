// Shared allowlist for saved settings, all editor previews and OBS.
const catalog = [
  {
    "id": "geist",
    "label": "Geist",
    "family": "\"Geist Variable\", Geist, sans-serif"
  },
  {
    "id": "system",
    "label": "Системный",
    "family": "system-ui, \"Segoe UI\", sans-serif"
  },
  {
    "id": "mono",
    "label": "Моноширинный",
    "family": "ui-monospace, SFMono-Regular, Consolas, monospace"
  },
  {
    "id": "serif",
    "label": "С засечками",
    "family": "Georgia, \"Times New Roman\", serif"
  },
  {
    "id": "manrope",
    "label": "Manrope",
    "family": "\"Manrope Variable\", sans-serif",
    "files": [
      "manrope-cyrillic-wght-normal.woff2",
      "manrope-latin-wght-normal.woff2"
    ]
  },
  {
    "id": "rubik",
    "label": "Rubik",
    "family": "\"Rubik Variable\", sans-serif",
    "files": [
      "rubik-cyrillic-wght-normal.woff2",
      "rubik-latin-wght-normal.woff2"
    ]
  },
  {
    "id": "nunito-sans",
    "label": "Nunito Sans",
    "family": "\"Nunito Sans Variable\", sans-serif",
    "files": [
      "nunito-sans-cyrillic-wght-normal.woff2",
      "nunito-sans-latin-wght-normal.woff2"
    ]
  },
  {
    "id": "montserrat",
    "label": "Montserrat",
    "family": "\"Montserrat Variable\", sans-serif",
    "files": [
      "montserrat-cyrillic-wght-normal.woff2",
      "montserrat-latin-wght-normal.woff2"
    ]
  },
  {
    "id": "oswald",
    "label": "Oswald",
    "family": "\"Oswald Variable\", sans-serif",
    "files": [
      "oswald-cyrillic-wght-normal.woff2",
      "oswald-latin-wght-normal.woff2"
    ]
  },
  {
    "id": "roboto-slab",
    "label": "Roboto Slab",
    "family": "\"Roboto Slab Variable\", serif",
    "files": [
      "roboto-slab-cyrillic-wght-normal.woff2",
      "roboto-slab-latin-wght-normal.woff2"
    ]
  },
  {
    "id": "cormorant-garamond",
    "label": "Cormorant Garamond",
    "family": "\"Cormorant Garamond Variable\", serif",
    "files": [
      "cormorant-garamond-cyrillic-wght-normal.woff2",
      "cormorant-garamond-latin-wght-normal.woff2"
    ]
  },
  {
    "id": "jetbrains-mono",
    "label": "JetBrains Mono",
    "family": "\"JetBrains Mono Variable\", monospace",
    "files": [
      "jetbrains-mono-cyrillic-wght-normal.woff2",
      "jetbrains-mono-latin-wght-normal.woff2"
    ]
  }
];
export const widgetFonts = Object.freeze(catalog.map(font => font.id));
const legacyFonts = Object.freeze({system: "manrope", mono: "jetbrains-mono", serif: "roboto-slab"});
export function resolveWidgetFont(font = "geist") { return legacyFonts[font] || (catalog.some(item => item.id === font) ? font : "geist"); }
export const widgetFontOptions = Object.freeze(catalog.filter(font => !Object.hasOwn(legacyFonts,font.id)).map(font => Object.freeze([font.id, font.label])));
export const widgetFontFiles = Object.freeze(catalog.flatMap(font => font.files || []));
export function widgetFontFamily(font = "geist") {
  return catalog.find(item => item.id === resolveWidgetFont(font)).family;
}
