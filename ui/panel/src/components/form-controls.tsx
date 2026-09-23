import { useId, type ReactNode, type ComponentPropsWithoutRef } from "react"
import { Check, ChevronDown, Plus } from "lucide-react"
import { Select } from "radix-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export function FormField({
  label,
  htmlFor,
  labelId,
  children,
}: {
  label: string
  htmlFor?: string
  labelId?: string
  children: ReactNode
}) {
  const Label = htmlFor ? "label" : "span"

  return (
    <div className="space-y-2">
      <Label
        {...(htmlFor ? { htmlFor } : {})}
        id={labelId}
        className="block text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  )
}
export function FormStack({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("space-y-6", className)} {...props} />
}

export function FormSegmented({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: string
  options: ReadonlyArray<readonly [string, string]>
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const labelId = useId()

  return (
    <FormField label={label} labelId={labelId}>
      <ToggleGroup
        type="single"
        value={value}
        disabled={disabled}
        aria-labelledby={labelId}
        onValueChange={(next) => next && onChange(next)}
        className="grid w-full rounded-lg border border-border-subtle bg-surface-subtle p-1"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map(([option, title]) => (
          <ToggleGroupItem key={option} value={option}>
            {title}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </FormField>
  )
}

export function FormActions({
  secondary,
  primary,
}: {
  secondary?: ReactNode
  primary: ReactNode
}) {
  return (
    <div
      className={cn(
        "grid gap-2 pt-1",
        secondary && "grid-cols-[auto_minmax(0,1fr)]"
      )}
    >
      {secondary}
      {primary}
    </div>
  )
}
export function FormColumns({
  children,
  settings,
}: {
  children: ReactNode
  settings: ReactNode
}) {
  return (
    <div style={{ containerType: "inline-size" }}>
      <div className="form-columns grid items-start gap-8">
        <FormStack className="min-w-0">{children}</FormStack>
        <div className="form-settings grid min-w-0 gap-6">{settings}</div>
      </div>
    </div>
  )
}
export function FormSwitch({
  label,
  hint,
  id,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  hint?: ReactNode
  id?: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4 py-2">
      <span className="min-w-0 text-sm leading-snug">
        {label}
        {hint && (
          <span className="mt-1 block text-xs text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={onCheckedChange}
      />
    </label>
  )
}

export function FormSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: string
  options: ReadonlyArray<readonly [string, string]>
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
        <Select.Trigger
          aria-label={label}
          className="flex h-8 min-w-32 items-center justify-between gap-3 rounded-md px-2 text-xs hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40"
        >
          <Select.Value />
          <Select.Icon>
            <ChevronDown className="size-3 text-muted-foreground" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            align="end"
            className="z-50 min-w-40 overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-border"
          >
            <Select.Viewport>
              {options.map(([option, title]) => (
                <Select.Item
                  key={option}
                  value={option}
                  className="relative flex min-h-8 cursor-default items-center rounded-md py-2 pr-7 pl-2.5 text-xs outline-none data-highlighted:bg-surface-raised"
                >
                  <Select.ItemText>{title}</Select.ItemText>
                  <Select.ItemIndicator className="absolute right-2">
                    <Check className="size-3" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}

export function FormColor({
  value,
  colors,
  disabled,
  onChange,
}: {
  value: string
  colors: ReadonlyArray<{ value: string; label: string }>
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">Акцент</span>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
        {colors.map((color) => (
          <button
            key={color.value}
            aria-label={color.label}
            aria-pressed={value === color.value}
            disabled={disabled}
            onClick={() => onChange(color.value)}
            className={`flex size-7 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${value === color.value ? "ring-1 ring-foreground/60" : "hover:bg-surface-raised"}`}
          >
            <span
              className="size-4 rounded-full"
              style={{ backgroundColor: color.value }}
            />
          </button>
        ))}
        <label className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md bg-surface-subtle focus-within:ring-2 focus-within:ring-ring">
          <Plus className="size-3.5" />
          <input
            type="color"
            aria-label="Свой цвет акцента"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 h-full w-full min-w-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  )
}
export function FormDuration({
  label = "Длительность",
  value,
  invalid,
  disabled,
  onChange,
}: {
  label?: string
  value: number
  invalid?: boolean
  disabled?: boolean
  onChange: (value: number) => void
}) {
  const labelId = useId()

  return (
    <FormField label={label} labelId={labelId}>
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          value={String(value)}
          disabled={disabled}
          aria-labelledby={labelId}
          onValueChange={(next) => next && onChange(Number(next))}
          className="rounded-lg border border-border-subtle bg-surface-subtle p-1"
        >
          {(
            [
              [30, "30 сек"],
              [60, "1 мин"],
              [180, "3 мин"],
              [300, "5 мин"],
            ] as const
          ).map(([seconds, title]) => (
            <ToggleGroupItem key={seconds} value={String(seconds)}>
              {title}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Input
            type="number"
            min={10}
            max={3600}
            step={1}
            value={value || ""}
            disabled={disabled}
            aria-label="Своя длительность в секундах"
            aria-invalid={invalid || undefined}
            className="w-22 tabular-nums"
            onChange={(event) => onChange(Number(event.target.value))}
          />
          сек
        </label>
      </div>
    </FormField>
  )
}

export function VisibilityButton({
  visible,
  disabled,
  onChange,
}: {
  visible: boolean
  disabled: boolean
  onChange: (visible: boolean) => void
}) {
  return (
    <Button
      variant="outline"
      className={`h-8 min-w-40 gap-2 rounded-md px-3 text-xs ${visible ? "border-brand/20 bg-brand/5 text-brand hover:bg-brand/10" : "text-muted-foreground"}`}
      aria-pressed={visible}
      aria-label={
        visible ? "Скрыть виджет со стрима" : "Показать виджет на стриме"
      }
      disabled={disabled}
      onClick={() => onChange(!visible)}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${visible ? "bg-brand" : "bg-muted-foreground/50"}`}
      />
      {visible ? "Виджет включён" : "Виджет скрыт"}
    </Button>
  )
}
