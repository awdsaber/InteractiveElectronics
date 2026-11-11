// The layer tour's live state (pure, no WebGL): which view the `pcb-tour` behavior asks for, whether
// the DRC overlay is on, and a param resolver for `board.layers` (PcbTrace.widthParam etc.).
// A param '<instance>.<key>' reads the behavior's published value (failure overrides included), then
// the tweak (so the tour works unpowered too), then the lesson's default.

import type { BenchSnapshot } from '../engine/bench/simLoop'
import { type DrcViolation } from '../engine/pcb/drc'
import { type TourView, tourView } from '../engine/pcb/layers'
import type { Lesson } from '../engine/types'

export interface TourState {
  param: (key: string) => number | undefined
  view: TourView
  drc: boolean
  peeled: boolean
}

export function tourState(lesson: Lesson, snap: BenchSnapshot, tweaks: Record<string, number> = {}): TourState {
  const defaults: Record<string, number> = {}
  let tour = ''
  for (const b of lesson.behaviors ?? []) {
    if (typeof b === 'string') {
      if (b === 'pcb-tour') tour = b
      continue
    }
    const inst = b.instance ?? b.id
    if (b.id === 'pcb-tour' && !tour) tour = inst
    for (const [k, v] of Object.entries(b.params ?? {})) if (typeof v === 'number') defaults[`${inst}.${k}`] = v
  }
  const param = (key: string): number | undefined => {
    const p = snap.published[key]
    if (p !== undefined && Number.isFinite(p)) return p
    const t = tweaks[`behavior:${key}`]
    if (t !== undefined && Number.isFinite(t)) return t
    return defaults[key]
  }
  return {
    param,
    view: tour ? tourView(param(`${tour}.view`) ?? 0) : 'all',
    drc: tour ? (param(`${tour}.drc`) ?? 0) >= 0.5 : false,
    peeled: snap.assembly.exploded,
  }
}

/** a DRC violation as a short callout pill */
export function drcPill(v: DrcViolation): string {
  const f = (x: number) => x.toFixed(2)
  switch (v.rule) {
    case 'trace-width':
      return `DRC · ${f(v.value)} mm < ${f(v.limit)} mm IPC-2221`
    case 'min-trace':
      return `DRC · ${f(v.value)} mm below ${f(v.limit)} mm min`
    case 'clearance':
      return `DRC · gap ${f(v.value)} mm < ${f(v.limit)} mm`
    case 'annular-ring':
      return `DRC · ring ${f(v.value)} mm < ${f(v.limit)} mm`
    case 'decoupling':
      return `DRC · cap ${v.value.toFixed(0)} mm from pin (max ${v.limit})`
    case 'thermal-relief':
      return 'DRC · no thermal relief'
  }
}
