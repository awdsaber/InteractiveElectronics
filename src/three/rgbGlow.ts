// Addressable RGB LEDs: a part with `params.rgbFrom: '<behavior instance>'` glows in the colour
// that behavior publishes as `<instance>.rgb_r / rgb_g / rgb_b` (0..255, e.g. the ws2812 behavior).
// Pure (no three.js), so Board can use it per frame and tests can check it headless.

import type { PartPlacement } from '../engine/types'

export interface RgbGlow {
  /** '#rrggbb' at full brightness (the hue), or null while the LED is dark */
  color: string | null
  /** 0..1 */
  glow: number
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0')

export function rgbGlow(p: PartPlacement, published: Record<string, number>): RgbGlow | null {
  const inst = p.params?.rgbFrom
  if (typeof inst !== 'string' || !inst) return null
  const ch = (k: string) => Math.max(0, Math.min(255, published[`${inst}.${k}`] ?? 0))
  const r = ch('rgb_r')
  const g = ch('rgb_g')
  const b = ch('rgb_b')
  const m = Math.max(r, g, b)
  if (m <= 0) return { color: null, glow: 0 }
  // hue normalised to full brightness, quantised to 16 steps a channel so the material cache stays small
  const q = (c: number) => hex2(Math.round((c / m) * 15) * 17)
  // a WS2812 at 50/255 is still bright to the eye: a square-root curve keeps dim colours visible
  return { color: `#${q(r)}${q(g)}${q(b)}`, glow: Math.min(1, Math.sqrt(m / 255) * 1.3) }
}
