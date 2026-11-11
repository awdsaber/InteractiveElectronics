// Design-rule check (pure) over a board's layer data (BoardSpec.layers).
//
// Coordinates are board units (1 = 10 mm); widths, gaps and limits are mm. Rules:
// - trace-width: a trace that must carry `amps` is narrower than IPC-2221 allows for the fab's rise
// - min-trace: narrower than the fab can etch
// - clearance: copper-to-copper air gap between different nets on one layer (traces, vias)
// - annular-ring: a via's copper ring round its drill is thinner than the fab's minimum
// - decoupling: a decoupling capacitor sits further from the pin it serves than `maxMm`
// - thermal-relief: a pad joined solid to a copper pour (hard to solder: the pour sinks the heat)

import type { PcbLayersSpec, PcbTrace } from '../types'
import { ipcWidthMm } from './ipc2221'

export type DrcRule = 'trace-width' | 'min-trace' | 'clearance' | 'annular-ring' | 'decoupling' | 'thermal-relief'
type Pt = [number, number]

export interface DrcViolation {
  rule: DrcRule
  /** stable key, e.g. 'clearance:a:b' */
  id: string
  /** where to mark it, board units */
  at: Pt
  layer: 'top' | 'bottom'
  /** the measured value and the rule's limit, mm */
  value: number
  limit: number
  message: string
}

export interface DrcOptions {
  /** live behavior params, by '<instance>.<param>' (for `widthParam` / `ampsParam`) */
  param?: (key: string) => number | undefined
  /** a footprint pad's centre in board units (decoupling and thermal-relief rules need it) */
  padAt?: (part: string, pad: number) => Pt | undefined
}

/** a trace with its live width and current resolved */
export function liveTrace(t: PcbTrace, param?: (key: string) => number | undefined): PcbTrace {
  const w = t.widthParam ? param?.(t.widthParam) : undefined
  const a = t.ampsParam ? param?.(t.ampsParam) : undefined
  if (w === undefined && a === undefined) return t
  return { ...t, ...(w !== undefined && Number.isFinite(w) ? { w } : {}), ...(a !== undefined && Number.isFinite(a) ? { amps: a } : {}) }
}

function closest(p: Pt, a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const l2 = dx * dx + dz * dz
  const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2))
  return [a[0] + t * dx, a[1] + t * dz]
}

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
}

/** closest distance between segments a1a2 and b1b2 (board units) and the midpoint of that gap */
export function segmentGap(a1: Pt, a2: Pt, b1: Pt, b2: Pt): { d: number; at: Pt } {
  const d1 = cross(a1, a2, b1)
  const d2 = cross(a1, a2, b2)
  const d3 = cross(b1, b2, a1)
  const d4 = cross(b1, b2, a2)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    const t = d3 / (d3 - d4)
    return { d: 0, at: [a1[0] + t * (a2[0] - a1[0]), a1[1] + t * (a2[1] - a1[1])] }
  }
  let best = { d: Infinity, at: a1 as Pt }
  const tryPair = (p: Pt, q: Pt) => {
    const d = Math.hypot(p[0] - q[0], p[1] - q[1])
    if (d < best.d) best = { d, at: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] }
  }
  tryPair(a1, closest(a1, b1, b2))
  tryPair(a2, closest(a2, b1, b2))
  tryPair(closest(b1, a1, a2), b1)
  tryPair(closest(b2, a1, a2), b2)
  return best
}

function traceGap(a: PcbTrace, b: PcbTrace): { d: number; at: Pt } {
  let best = { d: Infinity, at: a.pts[0] }
  for (let i = 1; i < a.pts.length; i++)
    for (let j = 1; j < b.pts.length; j++) {
      const g = segmentGap(a.pts[i - 1], a.pts[i], b.pts[j - 1], b.pts[j])
      if (g.d < best.d) best = g
    }
  return best
}

function pointToTrace(p: Pt, t: PcbTrace): number {
  let d = Infinity
  for (let i = 1; i < t.pts.length; i++) {
    const c = closest(p, t.pts[i - 1], t.pts[i])
    d = Math.min(d, Math.hypot(p[0] - c[0], p[1] - c[1]))
  }
  return d
}

/** midpoint of a trace's longest segment: where a width callout reads best */
function markAt(t: PcbTrace): Pt {
  let best = 0
  let at: Pt = t.pts[0]
  for (let i = 1; i < t.pts.length; i++) {
    const [x0, z0] = t.pts[i - 1]
    const [x1, z1] = t.pts[i]
    const l = Math.hypot(x1 - x0, z1 - z0)
    if (l > best) {
      best = l
      at = [(x0 + x1) / 2, (z0 + z1) / 2]
    }
  }
  return at
}

const f2 = (x: number) => x.toFixed(2)

export function runDrc(spec: PcbLayersSpec, opts: DrcOptions = {}): DrcViolation[] {
  const out: DrcViolation[] = []
  const r = spec.rules
  const ozLive = spec.copperOzParam ? opts.param?.(spec.copperOzParam) : undefined
  const oz = ozLive !== undefined && Number.isFinite(ozLive) && ozLive > 0 ? ozLive : spec.copperOz
  const layers: ['top' | 'bottom', PcbTrace[]][] = [
    ['top', spec.top.map((t) => liveTrace(t, opts.param))],
    ['bottom', spec.bottom.map((t) => liveTrace(t, opts.param))],
  ]

  for (const [layer, traces] of layers) {
    for (const t of traces) {
      if (t.amps !== undefined && t.amps > 0) {
        // to the 0.01 mm a layout tool sets widths in
        const wmin = Math.round(ipcWidthMm(t.amps, r.riseC, oz) * 100) / 100
        if (t.w < wmin - 1e-9)
          out.push({
            rule: 'trace-width',
            id: `trace-width:${t.id}`,
            at: markAt(t),
            layer,
            value: t.w,
            limit: wmin,
            message: `${f2(t.w)} mm trace for ${t.amps} A: IPC-2221 needs ${f2(wmin)} mm for a ${r.riseC} °C rise`,
          })
      }
      if (t.w < r.minTrace - 1e-9)
        out.push({ rule: 'min-trace', id: `min-trace:${t.id}`, at: markAt(t), layer, value: t.w, limit: r.minTrace, message: `${f2(t.w)} mm is below the fab's ${f2(r.minTrace)} mm minimum` })
    }
    for (let i = 0; i < traces.length; i++)
      for (let j = i + 1; j < traces.length; j++) {
        const a = traces[i]
        const b = traces[j]
        if (a.net === b.net) continue
        const g = traceGap(a, b)
        const gap = g.d * 10 - (a.w + b.w) / 2
        if (gap < r.minClearance - 1e-9)
          out.push({
            rule: 'clearance',
            id: `clearance:${a.id}:${b.id}`,
            at: g.at,
            layer,
            value: Math.max(0, gap),
            limit: r.minClearance,
            message: `${f2(Math.max(0, gap))} mm gap between ${a.net} and ${b.net}: the rule is ${f2(r.minClearance)} mm`,
          })
      }
    ;(spec.vias ?? []).forEach((v, k) => {
      for (const t of traces) {
        if (t.net === v.net) continue
        const gap = pointToTrace(v.at, t) * 10 - v.pad / 2 - t.w / 2
        if (gap < r.minClearance - 1e-9)
          out.push({
            rule: 'clearance',
            id: `clearance:via${k}:${t.id}`,
            at: v.at,
            layer,
            value: Math.max(0, gap),
            limit: r.minClearance,
            message: `${f2(Math.max(0, gap))} mm from a ${v.net} via to ${t.net}: the rule is ${f2(r.minClearance)} mm`,
          })
      }
    })
  }

  ;(spec.vias ?? []).forEach((v, k) => {
    const ring = (v.pad - v.drill) / 2
    if (ring < r.minAnnular - 1e-9)
      out.push({ rule: 'annular-ring', id: `annular-ring:via${k}`, at: v.at, layer: 'top', value: ring, limit: r.minAnnular, message: `${f2(ring)} mm annular ring: the rule is ${f2(r.minAnnular)} mm` })
  })

  if (opts.padAt) {
    for (const d of spec.decoupling ?? []) {
      const pin = opts.padAt(d.ic, d.pad)
      if (!pin) continue
      let best: { mm: number; at: Pt } | null = null
      for (const k of [0, 1]) {
        const p = opts.padAt(d.cap, k)
        if (!p) continue
        const mm = Math.hypot(p[0] - pin[0], p[1] - pin[1]) * 10
        if (!best || mm < best.mm) best = { mm, at: p }
      }
      if (best && best.mm > d.maxMm + 1e-9)
        out.push({
          rule: 'decoupling',
          id: `decoupling:${d.cap}`,
          at: best.at,
          layer: 'top',
          value: best.mm,
          limit: d.maxMm,
          message: `${d.cap.toUpperCase()} is ${best.mm.toFixed(1)} mm from ${d.ic.toUpperCase()} ${d.pin}: keep it within ${d.maxMm} mm`,
        })
    }
    for (const p of spec.pourPads ?? []) {
      if (p.relief) continue
      const at = opts.padAt(p.part, p.pad)
      if (!at) continue
      out.push({
        rule: 'thermal-relief',
        id: `thermal-relief:${p.part}:${p.pad}`,
        at,
        layer: 'bottom',
        value: 0,
        limit: 0,
        message: `${p.part.toUpperCase()} pad ${p.pad + 1} is solid to the pour: no thermal relief, so the iron can't heat it`,
      })
    }
  }
  return out
}
