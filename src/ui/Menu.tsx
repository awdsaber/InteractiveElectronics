import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface MenuItem {
  id: string
  label: string
  danger?: boolean
}

export interface MenuButtonProps {
  label: ReactNode
  items: MenuItem[]
  onPick: (id: string) => void
  disabled?: boolean
  emptyText?: string
  className?: string
  /** extra row pinned at the top, e.g. "Place all" */
  header?: MenuItem
  /** data-guide id for the guide's focus highlight */
  guide?: string
}

/** Pill button that opens a small ink-bordered dropdown. */
export function MenuButton({ label, items, onPick, disabled, emptyText = 'Nothing available', className = '', header, guide }: MenuButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const pick = (id: string) => {
    setOpen(false)
    onPick(id)
  }

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className={`pill ${className}`}
        disabled={disabled}
        data-guide={guide}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <span className="caret" aria-hidden="true">▸</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          {header && (
            <button type="button" role="menuitem" className="menu-item head" onClick={() => pick(header.id)}>
              {header.label}
            </button>
          )}
          {items.length === 0 && !header && <div className="menu-empty">{emptyText}</div>}
          {items.map((it) => (
            <button key={it.id} type="button" role="menuitem" className="menu-item" data-danger={it.danger} onClick={() => pick(it.id)}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
