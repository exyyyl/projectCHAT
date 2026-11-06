import {
  widgetFontFamily,
  resolveWidgetFont,
  widgetFontOptions,
  type WidgetFont,
} from "../../../../public/widget-fonts.js"
import { FormSelect } from "./form-controls"

export function WidgetFontSelect({
  value,
  onChange,
}: {
  value: WidgetFont
  onChange: (font: WidgetFont) => void
}) {
  return (
    <FormSelect
      disabled={false}
      label="Шрифт"
      value={resolveWidgetFont(value)}
      options={widgetFontOptions}
      onChange={(font) => onChange(font as WidgetFont)}
      renderOption={(font, label) => (
        <span style={{ fontFamily: widgetFontFamily(font as WidgetFont) }}>
          {label}
        </span>
      )}
    />
  )
}
