// A segmented radio group with a roving tabindex: Tab enters on the checked option, the arrow keys
// (and Home / End) move the choice, as the ARIA radio-group pattern expects.
import { useRef } from 'react'
import type { KeyboardEvent } from 'react'

export interface RadioSegProps<T extends string | number> {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}

export function RadioSeg<T extends string | number>({ label, options, value, onChange, className }: RadioSegProps<T>) {
  const box = useRef<HTMLDivElement>(null)
  const sel = options.findIndex((o) => o.value === value)
  const focusIdx = sel < 0 ? 0 : sel
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value)
    let j = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + options.length) % options.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = options.length - 1
    if (j < 0) return
    e.preventDefault()
    onChange(options[j].value)
    box.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[j]?.focus()
  }
  return (
    <div ref={box} className={className ?? 'seg'} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o, i) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} tabIndex={i === focusIdx ? 0 : -1} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
