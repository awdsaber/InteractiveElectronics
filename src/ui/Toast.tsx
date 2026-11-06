import { useEffect } from 'react'
import type { ToastMessage } from './types'

export interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: number) => void
  /** auto-dismiss delay, ms */
  duration?: number
}

function Item({ t, onDismiss, duration }: { t: ToastMessage; onDismiss: (id: number) => void; duration: number }) {
  useEffect(() => {
    const h = setTimeout(() => onDismiss(t.id), duration)
    return () => clearTimeout(h)
  }, [t.id, onDismiss, duration])
  return (
    <div className="toast" data-tone={t.tone ?? 'info'} role="status">
      <span>{t.text}</span>
      <button type="button" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}

export function Toast({ toasts, onDismiss, duration = 4200 }: ToastProps) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <Item key={t.id} t={t} onDismiss={onDismiss} duration={duration} />
      ))}
    </div>
  )
}
