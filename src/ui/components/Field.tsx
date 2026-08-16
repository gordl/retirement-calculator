import type { JSX } from 'preact'

/**
 * A small "(i)" icon that reveals an explanatory bubble on hover or keyboard
 * focus. Pure CSS — no open/close state to manage, and it works the same way
 * for a mouse user and someone tabbing through the form.
 */
export function InfoTip({ text }: { text: string }): JSX.Element {
  return (
    <span class="infotip" tabIndex={0}>
      <span class="infotip-icon" aria-hidden="true">
        i
      </span>
      <span class="infotip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
  prefix?: string
  suffix?: string
  hint?: string
  /** Explanatory text shown in an InfoTip next to the label. */
  info?: string
}

/** A labeled numeric input. Empty/invalid input is treated as 0 rather than
 *  left uncontrolled — this is a planning tool, not a form validator. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  hint,
  info,
}: NumberFieldProps): JSX.Element {
  return (
    <label class="field">
      <span class="field-label">
        {label}
        {info && <InfoTip text={info} />}
      </span>
      <span class="field-input-wrap">
        {prefix && <span class="field-affix">{prefix}</span>}
        <input
          type="number"
          class="field-input"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onInput={(e) => {
            const n = Number((e.target as HTMLInputElement).value)
            onChange(Number.isFinite(n) ? n : 0)
          }}
        />
        {suffix && <span class="field-affix">{suffix}</span>}
      </span>
      {hint && <span class="field-hint">{hint}</span>}
    </label>
  )
}

interface SelectFieldProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>): JSX.Element {
  return (
    <label class="field">
      <span class="field-label">{label}</span>
      <select
        class="field-input"
        value={value}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

interface CheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Checkbox({ label, checked, onChange }: CheckboxProps): JSX.Element {
  return (
    <label class="checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
      />
      <span>{label}</span>
    </label>
  )
}
