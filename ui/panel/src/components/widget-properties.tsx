import { Input } from "@/components/ui/input"
export function NumberProperty({
  label,
  value,
  min,
  max,
  unit = "px",
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  onChange: (value: number) => void
}) {
  const commit = (input: HTMLInputElement) => {
    const parsed = Number(input.value)
    const next =
      input.value.trim() && Number.isFinite(parsed)
        ? Math.min(max, Math.max(min, Math.round(parsed)))
        : value
    input.value = String(next)
    if (next !== value) onChange(next)
  }
  return (
    <label className="widget-number-property">
      <span>{label}</span>
      <span>
        <Input
          key={value}
          type="number"
          defaultValue={value}
          min={min}
          max={max}
          aria-label={label}
          onBlur={(event) => commit(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
          }}
        />
        <small>{unit}</small>
      </span>
    </label>
  )
}

export function ColorProperty({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="widget-color-property">
      <span>{label}</span>
      <span className="widget-color-input">
        <span style={{ backgroundColor: value }}>
          <input
            type="color"
            value={value}
            aria-label={label}
            onChange={(event) => onChange(event.target.value)}
          />
        </span>
        <Input
          key={value}
          defaultValue={value.toUpperCase()}
          aria-label={label + " HEX"}
          maxLength={7}
          onBlur={(event) => {
            const next = event.target.value
            if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase())
            else event.target.value = value.toUpperCase()
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
          }}
        />
      </span>
    </label>
  )
}
