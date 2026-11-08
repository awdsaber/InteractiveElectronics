// Switched PWM (M2.5-X6).
//
// A PIN in PWM (0 < level < 1) is by default a source at level·vcc. That is exact for the averaged
// state of a linear netlist, but wrong once something nonlinear sits on the pin: an LED at 50 %
// sees 2.5 V and barely conducts, a base drive sits in the linear region instead of switching, and
// a vccNode pin conducts to both rails at once (phantom shoot-through). So when the netlist is
// nonlinear (or a PWM pin has a vccNode), the transient really switches the pin: each step is cut
// at the pin's edges and every piece is solved with the pin HIGH or LOW for its physical duration
// (transient.ts). This module holds the pieces that don't need the stepper: which pins switch, at
// what period, where their edges fall, and the Solution that time-weights several pieces.
//
// Timing: a pin's period T is 1/toneHz, else 1/pwmHz, else 1/DEFAULT_PWM_HZ. Every pin's rising
// edges sit at whole multiples of its own T in sim time (a free-running timer), so pins with the
// same frequency are phase-aligned at the period start, as on one AVR timer in fast-PWM mode, and
// pins on different frequencies interleave as they do on separate timers. A step shorter than T
// carries the phase across steps, so edges land at their real times. A step of dt ≥ T holds
// k = round(dt/T) periods, capped at MAX_PERIODS_PER_STEP and stretched to fill dt exactly, laid
// from the step start (beyond the cap the period is longer than the real one: the averages stay
// right, the ripple is overstated).
//
// solveDC has no time axis, so it blends one operating point per switch state by duty (pwmPlan).

import type { PinState, PwmPhaseSolution, Solution } from '../types'
import type { Compiled } from './devices'

/** analogWrite frequency when a pin does not say (Uno pins other than 5 and 6) */
export const DEFAULT_PWM_HZ = 490
/** at most this many PWM periods are resolved inside one step (see the header) */
export const MAX_PERIODS_PER_STEP = 8

/** a pin state that switches within a PWM period (servo pulses are not modelled as a duty) */
export function isPwm(s: PinState | undefined): boolean {
  if (!s || s.servoDeg !== undefined) return false
  if (s.mode !== 'OUTPUT' && s.mode !== 'OUTPUT_OPEN_DRAIN') return false
  return s.level > 0 && s.level < 1
}

/** switching period of a PWM pin state, s */
export function pwmPeriod(s: PinState): number {
  const f = s.toneHz && s.toneHz > 0 ? s.toneHz : s.pwmHz && s.pwmHz > 0 ? s.pwmHz : DEFAULT_PWM_HZ
  return 1 / f
}

export interface PwmPin {
  pin: number
  duty: number
  /** period, s */
  period: number
}

export interface PwmPins {
  /** the switching pins, in a fixed order (bit k of a state mask is pins[k]) */
  pins: PwmPin[]
  /** a PWM pin changes the matrix between states (vccNode split or open-drain conductance) */
  aVaries: boolean
  /** longest period, s */
  tMax: number
  /** identifies the pin set (not the duties): state masks keep their meaning while it holds */
  key: string
}

/** the pins to switch, or null when the averaged source is already right (linear netlist) */
export function pwmPins(c: Compiled, pins: Record<number, PinState>): PwmPins | null {
  let out: PwmPin[] | null = null
  let aVaries = false
  let rail = false
  for (const d of c.devs) {
    const el = d.el
    if (el.type !== 'PIN' || d.p.off) continue
    const s = pins[el.pin]
    if (!isPwm(s)) continue
    if (el.vccNode !== undefined) rail = aVaries = true
    if (s.mode === 'OUTPUT_OPEN_DRAIN') aVaries = true
    if (out?.some((p) => p.pin === el.pin)) continue
    ;(out ??= []).push({ pin: el.pin, duty: s.level, period: pwmPeriod(s) })
  }
  if (!out || !(c.nonlinear || rail)) return null
  if (out.length > 30) out = out.slice(0, 30) // state masks are 31-bit ints
  let tMax = 0
  for (const p of out) tMax = Math.max(tMax, p.period)
  return { pins: out, aVaries, tMax, key: out.map((p) => `${p.pin}@${p.period}`).join(',') }
}

/** periods of `p` inside a step of length h ≥ its period, and their stretched length */
function stretched(p: PwmPin, h: number): number {
  const k = Math.min(MAX_PERIODS_PER_STEP, Math.max(1, Math.round(h / p.period)))
  return h / k
}

/** is pin `p` HIGH at time tau, inside a step [t0, t0 + h]? */
export function pwmHighAt(p: PwmPin, tau: number, t0: number, h: number): boolean {
  let ph: number
  if (h >= p.period) ph = (tau - t0) / stretched(p, h)
  else ph = tau / p.period
  return ph - Math.floor(ph) < p.duty
}

/** push every edge of `p` in [t0, t0 + h] onto `out` (unsorted, may include the ends) */
export function pwmEdges(p: PwmPin, t0: number, h: number, out: number[]): void {
  const t1 = t0 + h
  if (h >= p.period) {
    const T = stretched(p, h)
    const k = Math.round(h / T)
    for (let n = 0; n < k; n++) out.push(t0 + n * T, t0 + (n + p.duty) * T)
    return
  }
  const T = p.period
  for (let n = Math.floor(t0 / T); n * T <= t1; n++) {
    const up = n * T
    const down = (n + p.duty) * T
    if (up > t0 && up < t1) out.push(up)
    if (down > t0 && down < t1) out.push(down)
  }
}

/** state mask (bit k = pins[k] HIGH) at time tau of a step [t0, t0 + h] */
export function pwmMask(pp: PwmPins, tau: number, t0: number, h: number): number {
  let m = 0
  for (let k = 0; k < pp.pins.length; k++) if (pwmHighAt(pp.pins[k], tau, t0, h)) m |= 1 << k
  return m
}

/** the pin map for one state mask: PWM pins forced to level 0 or 1 */
export function pwmStatePins(pp: PwmPins, base: Record<number, PinState>, mask: number): Record<number, PinState> {
  const ps: Record<number, PinState> = { ...base }
  for (let k = 0; k < pp.pins.length; k++) {
    const p = pp.pins[k].pin
    ps[p] = { ...base[p], level: mask & (1 << k) ? 1 : 0 }
  }
  return ps
}

// ── DC: duty-weighted operating points ──

export interface PwmPlanPhase {
  weight: number
  pins: Record<number, PinState>
}

/**
 * Switch states for a time-free solve, HIGH first: phase-aligned pins with distinct duties
 * u1 < … < um give [0, u1) all HIGH, [u1, u2) the pins with duty > u1 HIGH, …, [um, 1) all LOW.
 */
export function pwmPlan(c: Compiled, pins: Record<number, PinState>): { phases: PwmPlanPhase[]; aVaries: boolean } | null {
  const pp = pwmPins(c, pins)
  if (!pp) return null
  const levels = [...new Set(pp.pins.map((p) => p.duty))].sort((a, b) => a - b)
  const phases: PwmPlanPhase[] = []
  for (let j = 0; j <= levels.length; j++) {
    const lo = j === 0 ? 0 : levels[j - 1]
    const hi = j === levels.length ? 1 : levels[j]
    let mask = 0
    pp.pins.forEach((p, k) => {
      if (p.duty > lo) mask |= 1 << k
    })
    phases.push({ weight: hi - lo, pins: pwmStatePins(pp, pins, mask) })
  }
  return { phases, aVaries: pp.aVaries }
}

// ── time-weighted Solution ──

const readOne = (s: Solution, read: 'currentOf' | 'powerOf', map: 'current' | 'power', id: string) =>
  s[read] ? s[read]!(id) : (s[map][id] ?? 0)

/**
 * One Solution averaging several by weight (weights sum to 1): voltages, currents, powers and
 * extras are Σ w·value_k, so a mode-flag extra (V `cc`, REG `dropout`) reads the fraction of the
 * time spent in that mode. The parts stay readable as `phases` for ratings (peaks, RMS). Single
 * reads don't materialise any maps; methods live on the prototype, and `phases` is built on first read.
 */
class Blend implements Solution {
  readonly ok: boolean
  readonly iterations: number
  private readonly sols: readonly Solution[]
  private readonly w: Float64Array
  private parts: PwmPhaseSolution[] | null = null
  private cid = ''
  private ci = 0
  private cp = 0
  private mNode: Record<string, number> | null = null
  private mCur: Record<string, number> | null = null
  private mPow: Record<string, number> | null = null
  private mExtra: Record<string, number> | null = null
  private overlay: Record<string, number> | null = null

  constructor(sols: readonly Solution[], w: Float64Array) {
    let ok = true
    let it = 0
    for (const s of sols) {
      ok &&= s.ok
      it += s.iterations ?? 0
    }
    this.ok = ok
    this.iterations = it
    this.sols = sols
    this.w = w
  }

  /** the pieces with their weights (built on first read: most step solutions are never rated) */
  get phases(): readonly PwmPhaseSolution[] {
    return (this.parts ??= this.sols.map((solution, k) => ({ weight: this.w[k], solution })))
  }

  /** current and power of one element, measured together (each part caches the pair) */
  private ip(id: string): void {
    if (this.cid === id) return
    let i = 0
    let p = 0
    const { sols, w } = this
    for (let k = 0; k < sols.length; k++) {
      i += w[k] * readOne(sols[k], 'currentOf', 'current', id)
      p += w[k] * readOne(sols[k], 'powerOf', 'power', id)
    }
    this.ci = i
    this.cp = p
    this.cid = id
  }

  private merge(get: (s: Solution) => Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {}
    const { sols, w } = this
    for (let j = 0; j < sols.length; j++) {
      const m = get(sols[j])
      for (const k in m) out[k] = (out[k] ?? 0) + w[j] * m[k]
    }
    return out
  }

  currentOf(id: string): number {
    if (this.mCur) return this.mCur[id] ?? 0
    this.ip(id)
    return this.ci
  }
  powerOf(id: string): number {
    if (this.mPow) return this.mPow[id] ?? 0
    this.ip(id)
    return this.cp
  }
  extraOf(id: string, key: string): number {
    if (this.mExtra) return this.mExtra[key] ?? 0
    if (this.overlay && key in this.overlay) return this.overlay[key]
    let v = 0
    const { sols, w } = this
    for (let k = 0; k < sols.length; k++) {
      const x = sols[k]
      v += w[k] * (x.extraOf ? x.extraOf(id, key) : (x.extra[key] ?? 0))
    }
    return v
  }
  voltageOf(node: string): number {
    if (this.mNode) return this.mNode[node] ?? 0
    let v = 0
    const { sols, w } = this
    for (let k = 0; k < sols.length; k++) {
      const x = sols[k]
      v += w[k] * (x.voltageOf ? x.voltageOf(node) : (x.nodeV[node] ?? 0))
    }
    return v
  }
  publish(key: string, value: number): void {
    if (this.mExtra) this.mExtra[key] = value
    else (this.overlay ??= {})[key] = value
  }
  get nodeV(): Record<string, number> {
    return (this.mNode ??= this.merge((s) => s.nodeV))
  }
  get current(): Record<string, number> {
    return (this.mCur ??= this.merge((s) => s.current))
  }
  get power(): Record<string, number> {
    return (this.mPow ??= this.merge((s) => s.power))
  }
  get extra(): Record<string, number> {
    if (!this.mExtra) {
      this.mExtra = this.merge((s) => s.extra)
      if (this.overlay) Object.assign(this.mExtra, this.overlay)
    }
    return this.mExtra
  }
}

/** time-weighted Solution over parts (weights summing to 1) */
export function blendSolutions(parts: readonly PwmPhaseSolution[]): Solution {
  return new Blend(
    parts.map((p) => p.solution),
    Float64Array.from(parts, (p) => p.weight),
  )
}

/** the same from parallel arrays (the stepper's allocation-light path) */
export function blendArrays(sols: readonly Solution[], weights: Float64Array): Solution {
  return new Blend(sols, weights)
}
