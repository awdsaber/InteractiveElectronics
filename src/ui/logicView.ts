// Pure helpers for the logic-analyzer tab: the time window, zoom steps and the decoded-text summary.
import type { Frame } from '../engine/logic/decode'

/** span choices, µs, in 1-2-5 steps from 5 µs to 1 s */
export const SPANS_US: readonly number[] = (() => {
  const out: number[] = []
  for (let d = 1; d <= 1e6; d *= 10) for (const m of [1, 2, 5]) if (d * m >= 5 && d * m <= 1e6) out.push(d * m)
  return out
})()

/** the span a decoder starts at: one UART line, one I²C register read, one SPI byte with its latch */
export const DEFAULT_SPAN_US = { uart: 2000, i2c: 500, spi: 20 } as const

/** the next span step in or out from `span` */
export function zoomStep(span: number, dir: 1 | -1): number {
  const i = SPANS_US.findIndex((s) => s >= span - 1e-9)
  const k = i < 0 ? SPANS_US.length - 1 : i
  return SPANS_US[Math.max(0, Math.min(SPANS_US.length - 1, k + dir))]
}

/**
 * Live view: end the window a little after the newest activity on the bus being decoded (like an
 * analyzer triggered on that bus), or at `now` when there is none.
 */
export function liveWindow(lastActivity: number, now: number, span: number): [number, number] {
  const end = Number.isFinite(lastActivity) ? Math.min(now, lastActivity) + 0.08 * span : now
  return [end - span, end]
}

/** "2 ms", "500 µs", "1.5 s" */
export function formatUs(us: number): string {
  const a = Math.abs(us)
  const f = (v: number) => (Math.round(v * 100) / 100).toString()
  if (a >= 1e6) return `${f(us / 1e6)} s`
  if (a >= 1e3) return `${f(us / 1e3)} ms`
  if (a >= 1) return `${f(us)} µs`
  return `${f(us * 1e3)} ns`
}

/** one line of text for the frames in view: "S 0x68 W A 0x75 'u' A … P" (bytes as hex and ASCII) */
export function framesText(frames: readonly Frame[], max = 48): string {
  const parts = frames.slice(-max).map((f) => f.text)
  return (frames.length > max ? '… ' : '') + parts.join('  ')
}

/** the printable text of UART frames ('.' for anything else), "⚠" for a framing error */
export function asciiOf(frames: readonly Frame[]): string {
  return frames
    .filter((f) => f.kind === 'byte')
    .map((f) => (f.error ? '⚠' : f.value! >= 0x20 && f.value! < 0x7f ? String.fromCharCode(f.value!) : f.value === 0x0a ? '↵' : f.value === 0x0d ? '' : '·'))
    .join('')
}
