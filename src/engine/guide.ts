// Guided steps: a pure evaluator for `lesson.guide`. It holds the active step, the guide events
// seen since that step became active and the start times of readout holds, and advances one step
// per `evaluate` call whose check passes. No DOM, no clock: the caller passes `now` (ms), so it
// runs headless in tests. The store feeds it bench snapshots and UI events.

import type { BenchAction } from '../ui/types'
import type { BenchStatus, GuideAction, GuideCheck, GuideStep, Lesson } from './types'

/** something the learner did that a guide check can wait for */
export type GuideEvent =
  | { type: 'action'; action: GuideAction }
  | { type: 'break'; failure: string }
  | { type: 'inspect'; part: string }
  | { type: 'instruments' }
  | { type: 'quiz' }
  | { type: 'manual' }

/** the part of a bench snapshot the guide reads (a BenchSnapshot fits) */
export interface GuideBenchView {
  status: BenchStatus
  /** raw readout values, SI base units, lesson.readouts order */
  values: number[]
  pins: Record<number, { mode: string; level: number }>
  assembly?: { failures: string[] }
}

/** UI state the guide reads */
export interface GuideUi {
  /** ms, any monotonic clock */
  now: number
  /** tweak values keyed `${elementId}.${key}` */
  tweaks?: Record<string, number>
  selectedPart?: string | null
  instrumentsOpen?: boolean
}

/** what is saved per lesson */
export interface GuideProgress {
  /** index of the active step; steps.length once the guide is complete */
  current: number
  /** ids of the steps completed (not skipped), in order */
  done: string[]
}

export interface GuideState extends GuideProgress {
  total: number
  complete: boolean
  /** the active step, or null once complete */
  step: GuideStep | null
  /** the step completed most recently (its `explain` is shown), cleared by navigation */
  justDone: GuideStep | null
  /** `now` when the active step became active */
  since: number
}

export interface Guide {
  readonly steps: readonly GuideStep[]
  /** record `events` against the active step, judge it on `snap` + `ui`, and advance if it passes */
  evaluate(snap: GuideBenchView, events: readonly GuideEvent[], ui: GuideUi): GuideState
  state(): GuideState
  progress(): GuideProgress
  back(now?: number): GuideState
  skip(now?: number): GuideState
  restart(now?: number): GuideState
  goTo(index: number, now?: number): GuideState
}

const eventMatches = (c: GuideCheck, e: GuideEvent): boolean => {
  switch (c.kind) {
    case 'action':
      return e.type === 'action' && e.action === c.action
    case 'break':
      return e.type === 'break' && e.failure === c.failure
    case 'inspect':
      return e.type === 'inspect' && e.part === c.part
    case 'instruments':
    case 'quiz':
    case 'manual':
      return e.type === c.kind
    default:
      return false
  }
}

export function createGuide(lesson: Lesson, saved?: Partial<GuideProgress>, now = 0): Guide {
  const steps = lesson.guide ?? []
  const N = steps.length
  const ids = new Set(steps.map((s) => s.id))
  const tweakKeyOf = (target: string): string => {
    const t = lesson.tweaks?.find((x) => x.label === target)
    return t ? `${t.elementId}.${t.key}` : target
  }

  const start = typeof saved?.current === 'number' && Number.isFinite(saved.current) ? Math.round(saved.current) : 0
  let current = Math.min(N, Math.max(0, start))
  let done: string[] = Array.isArray(saved?.done) ? saved.done.filter((id): id is string => typeof id === 'string' && ids.has(id)) : []
  let justDone: GuideStep | null = null
  let since = now
  let events: GuideEvent[] = []
  /** hold start times by check path ("0.1") */
  let holds = new Map<string, number>()

  const state = (): GuideState => ({
    current,
    done: [...done],
    total: N,
    complete: current >= N,
    step: steps[current] ?? null,
    justDone,
    since,
  })

  function activate(i: number, t: number) {
    current = Math.min(N, Math.max(0, i))
    events = []
    holds = new Map()
    since = t
  }

  /** every child is judged (no short-circuit), so holds inside an `any` keep their clocks */
  function passes(c: GuideCheck, path: string, snap: GuideBenchView, ui: GuideUi): boolean {
    switch (c.kind) {
      case 'all':
        return c.of.map((x, i) => passes(x, `${path}.${i}`, snap, ui)).every(Boolean)
      case 'any':
        return c.of.map((x, i) => passes(x, `${path}.${i}`, snap, ui)).some(Boolean)
      case 'status':
        return snap.status === c.is
      case 'tweak': {
        const v = ui.tweaks?.[tweakKeyOf(c.target)]
        return v !== undefined && Number.isFinite(v) && (c.min === undefined || v >= c.min) && (c.max === undefined || v <= c.max)
      }
      case 'readout': {
        const v = snap.values[c.index]
        const ok = v !== undefined && Number.isFinite(v) && (c.above === undefined || v > c.above) && (c.below === undefined || v < c.below)
        if (!ok) {
          holds.delete(path)
          return false
        }
        const t0 = holds.get(path) ?? ui.now
        holds.set(path, t0)
        return ui.now - t0 >= (c.holdMs ?? 0)
      }
      case 'pin': {
        const p = snap.pins[c.pin]
        return !!p && p.mode === 'OUTPUT' && Math.round(p.level) === c.level
      }
      case 'break':
        return events.some((e) => eventMatches(c, e)) || !!snap.assembly?.failures.includes(c.failure)
      case 'inspect':
        return events.some((e) => eventMatches(c, e)) || ui.selectedPart === c.part
      case 'instruments':
        return events.some((e) => eventMatches(c, e)) || !!ui.instrumentsOpen
      default:
        return events.some((e) => eventMatches(c, e))
    }
  }

  return {
    steps,
    evaluate(snap, evs, ui) {
      const step = steps[current]
      if (!step) return state()
      events.push(...evs)
      if (passes(step.check, '0', snap, ui)) {
        if (!done.includes(step.id)) done = [...done, step.id]
        justDone = step
        activate(current + 1, ui.now)
      }
      return state()
    },
    state,
    progress: () => ({ current, done: [...done] }),
    back(t = since) {
      if (current > 0) {
        const prev = steps[current - 1]
        done = done.filter((id) => id !== prev.id)
        activate(current - 1, t)
      }
      justDone = null
      return state()
    },
    skip(t = since) {
      if (current < N) activate(current + 1, t)
      justDone = null
      return state()
    },
    restart(t = since) {
      done = []
      justDone = null
      activate(0, t)
      return state()
    },
    goTo(i, t = since) {
      justDone = null
      activate(i, t)
      return state()
    },
  }
}

/** the guide events one bench button press produces (`before` / `after`: the snapshot around it) */
export function benchActionEvents(a: BenchAction, before: { allPlaced: boolean }, after: { allPlaced: boolean }): GuideEvent[] {
  if (a.startsWith('break:')) return [{ type: 'break', failure: a.slice(6) }]
  if (a.startsWith('power:')) return [{ type: 'action', action: 'power' }]
  if (a.startsWith('place:')) {
    const out: GuideEvent[] = [{ type: 'action', action: 'place' }]
    if (!before.allPlaced && after.allPlaced) out.push({ type: 'action', action: 'place-all' })
    return out
  }
  return [{ type: 'action', action: a as GuideAction }]
}
