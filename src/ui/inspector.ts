// Part inspector, pure side: the band decode of a resistor, how close a value is to its rating,
// and the live values / ratings rows for a part's circuit elements (no React, no WebGL).

import type { BenchSnapshot } from '../engine/bench/simLoop'
import { formatSI } from '../engine/sim/format'
import { T_AMB, effectiveRating } from '../engine/sim/ratings'
import type { Element, Lesson, PartPlacement } from '../engine/types'
import { BAND_HEX, DIGIT_COLORS, TOLERANCE_COLORS, parseOhms, resistorBands, type BandColor, type BandOptions } from '../three/colorCode'

export interface BandDecode {
  bands: BandColor[]
  /** "yellow · violet · red · gold = 4.7 kΩ ±5 %" */
  text: string
}

const TOL_OF: Partial<Record<BandColor, string>> = Object.fromEntries(Object.entries(TOLERANCE_COLORS).map(([t, c]) => [c, t]))

/** a resistance with SI prefix and no trailing zeros: 4700 → "4.7 kΩ", 1e6 → "1 MΩ" */
function ohmsText(v: number): string {
  return formatSI(v, 'Ω', 3).replace(/(\.\d*?)0+(?= )/, '$1').replace(/\.(?= )/, '')
}

/** the value the bands themselves encode (digits × multiplier) */
function bandValue(bands: readonly BandColor[]): number {
  if (bands.length === 1) return 0
  const digits = bands.slice(0, -2).map((b) => DIGIT_COLORS.indexOf(b))
  const mult = bands[bands.length - 2]
  const exp = mult === 'gold' ? -1 : mult === 'silver' ? -2 : DIGIT_COLORS.indexOf(mult)
  const mant = digits.reduce((a, d) => a * 10 + d, 0)
  // round away float noise (47 × 0.1 = 4.7000000000000002)
  return Number((mant * 10 ** exp).toPrecision(6))
}

/** Colour bands of a resistance and what they read back as. */
export function bandDecode(ohms: number, opts: BandOptions = {}): BandDecode {
  const bands = resistorBands(ohms, opts)
  const names = bands.join(' · ')
  if (bands.length === 1) return { bands, text: `${names} = 0 Ω` }
  const tol = TOL_OF[bands[bands.length - 1]]
  return { bands, text: `${names} = ${ohmsText(bandValue(bands))}${tol ? ` ±${tol} %` : ''}` }
}

/** The band decode of a through-hole resistor part (same params as its 3D body), else null. */
export function resistorDecode(part: PartPlacement): BandDecode | null {
  if (part.kind !== 'resistor') return null
  const ohms = parseOhms(part.params?.ohms) ?? 220
  const five = part.params?.film === 'metal' || part.params?.bands === 5
  const tolerance = typeof part.params?.tolerance === 'number' ? part.params.tolerance : undefined
  try {
    return bandDecode(ohms, { bands: five ? 5 : 4, tolerance })
  } catch {
    return null
  }
}

export const bandHex = (b: BandColor): string => BAND_HEX[b]

export type UseTone = 'ok' | 'warn'

export interface RatingUse {
  /** |value| / max (from `floor` when given) */
  frac: number
  /** rounded percent */
  pct: number
  /** ok below 80 % of the limit, warn from 80 % */
  tone: UseTone
}

export const WARN_FRAC = 0.8

/**
 * How much of a limit a value uses. `floor` is the zero of the scale (ambient for a
 * temperature: 90 °C of a 155 °C part at 25 °C ambient is half its headroom).
 */
export function ratingUse(value: number, max: number | undefined, floor = 0): RatingUse | null {
  if (max === undefined || !Number.isFinite(value) || !(max > floor)) return null
  const frac = Math.max(0, (floor === 0 ? Math.abs(value) : value - floor) / (max - floor))
  const r = Math.round(frac * 1e6) / 1e6
  return { frac: r, pct: Math.round(r * 100), tone: r >= WARN_FRAC ? 'warn' : 'ok' }
}

export interface LiveRow {
  label: 'I' | 'V' | 'P' | 'T'
  text: string
}

export interface RatingRow extends RatingUse {
  label: 'I' | 'V' | 'P' | 'T'
  /** "I 13 mA / 20 mA max, 65 %" */
  text: string
}

export interface ElementInfo {
  id: string
  type: Element['type']
  live: LiveRow[]
  ratings: RatingRow[]
}

export interface PartInfo {
  elements: ElementInfo[]
}

const UNIT = { I: 'A', V: 'V', P: 'W', T: '°C' } as const
const fmt = (label: keyof typeof UNIT, v: number) =>
  label !== 'T' && Math.abs(v) < 1e-12 ? `0 ${UNIT[label]}` : formatSI(v, UNIT[label], label === 'T' ? 3 : 2)

/** Live values and rating use of every circuit element a part renders. */
export function inspectPart(lesson: Lesson, part: PartPlacement, snap: BenchSnapshot): PartInfo {
  const elements: ElementInfo[] = []
  for (const id of part.circuitIds ?? []) {
    const el = lesson.circuit.elements.find((e) => e.id === id)
    if (!el) continue
    const vals: Partial<Record<keyof typeof UNIT, number>> = {
      I: snap.current[id],
      V: snap.elementV[id],
      P: snap.power[id],
      T: snap.extra[`${id}.tj`],
    }
    const live: LiveRow[] = []
    for (const k of ['I', 'V', 'P', 'T'] as const) {
      const v = vals[k]
      if (v !== undefined && Number.isFinite(v)) live.push({ label: k, text: fmt(k, v) })
    }
    const rating = effectiveRating(el)
    const ratings: RatingRow[] = []
    const add = (label: keyof typeof UNIT, max: number | undefined, floor = 0) => {
      const u = ratingUse(vals[label] ?? (label === 'T' ? T_AMB : 0), max, floor)
      if (!u || max === undefined) return
      const cur = vals[label] ?? (label === 'T' ? T_AMB : 0)
      ratings.push({ label, ...u, text: `${label} ${fmt(label, label === 'T' ? cur : Math.abs(cur))} / ${fmt(label, max)} max, ${u.pct} %` })
    }
    add('I', rating?.maxI)
    add('V', rating?.maxV)
    add('P', rating?.maxP)
    add('T', rating?.tMax, T_AMB)
    elements.push({ id, type: el.type, live, ratings })
  }
  return { elements }
}
