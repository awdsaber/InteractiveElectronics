export interface StatusLineProps {
  text: string
  tone?: 'info' | 'ok' | 'warn'
}

/** One sentence under the action buttons, e.g. "POWERED: pin 13 goes HIGH and the LED lights". */
export function StatusLine({ text, tone = 'info' }: StatusLineProps) {
  if (!text) return null
  const i = text.indexOf(':')
  const head = i > 0 && i < 14 ? text.slice(0, i) : ''
  const rest = head ? text.slice(i + 1) : text
  return (
    <p className="status-line" data-tone={tone} role="status">
      {head && <strong>{head}</strong>}
      {rest}
    </p>
  )
}
