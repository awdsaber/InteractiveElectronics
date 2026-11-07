// Duty-weighted PWM (state-space averaging).
//
// A PIN in PWM (0 < level < 1) is by default a source at level·vcc. That is exact for the averaged
// state of a linear netlist, but wrong once something nonlinear sits on the pin: an LED at 50 %
// sees 2.5 V and barely conducts, a base drive sits in the linear region instead of switching, and
// a vccNode pin conducts to both rails at once (phantom shoot-through). So when a step has a PWM
// pin and the netlist is nonlinear (or the PWM pin has a vccNode), the step is solved once per
// switch state from the same committed state and the results are blended by the time spent in
// each state: reactive state x = Σ w·x_k, currents and powers Σ w·i_k and Σ w·p_k (the mean of the
// per-state powers, so heating is RMS-correct).
//
// Several PWM pins: their periods are taken as phase-aligned at the period start (all rising
// edges together, as on one AVR timer in fast-PWM mode, where every OCnx output sets at BOTTOM).
// With distinct duties u1 < … < um that gives m + 1 states: [0, u1) all HIGH, [u1, u2) every pin
// with duty > u1 HIGH, …, [um, 1) all LOW. Each pin is HIGH for exactly its own duty, and the
// common one-pin (or same-duty) case costs exactly two solves. Pins on different timers are not
// really phase-locked; the aligned rule is the documented approximation for them.

import type { PinState, Solution, PwmPhaseSolution } from '../types'
import type { Compiled } from './devices'

export interface PwmPlanPhase {
  weight: number
  /** the pin map for this state: PWM pins forced to level 0 or 1 */
  pins: Record<number, PinState>
}

export interface PwmPlan {
  /** HIGH (all PWM pins on) first, LOW last */
  phases: PwmPlanPhase[]
  /** a PWM pin changes the matrix between states (vccNode split or open-drain conductance) */
  aVaries: boolean
  /** identifies the state structure (pins and duties), for per-state warm-start memory */
  key: string
}

/** a pin state that switches within a PWM period (servo pulses are not modelled as a duty) */
export function isPwm(s: PinState | undefined): boolean {
  if (!s || s.servoDeg !== undefined) return false
  if (s.mode !== 'OUTPUT' && s.mode !== 'OUTPUT_OPEN_DRAIN') return false
  return s.level > 0 && s.level < 1
}

/** the switch states for one step, or null when the averaged source is already right */
export function pwmPlan(c: Compiled, pins: Record<number, PinState>): PwmPlan | null {
  let duties: Map<number, number> | null = null
  let aVaries = false
  let railPwm = false
  for (const d of c.devs) {
    const el = d.el
    if (el.type !== 'PIN' || d.p.off) continue
    const s = pins[el.pin]
    if (!isPwm(s)) continue
    ;(duties ??= new Map()).set(el.pin, s.level)
    if (el.vccNode !== undefined) railPwm = aVaries = true
    if (s.mode === 'OUTPUT_OPEN_DRAIN') aVaries = true
  }
  if (!duties || !(c.nonlinear || railPwm)) return null
  const levels = [...new Set(duties.values())].sort((a, b) => a - b)
  const phases: PwmPlanPhase[] = []
  for (let j = 0; j <= levels.length; j++) {
    const lo = j === 0 ? 0 : levels[j - 1]
    const hi = j === levels.length ? 1 : levels[j]
    const ps: Record<number, PinState> = { ...pins }
    for (const [p, duty] of duties) ps[p] = { ...pins[p], level: duty > lo ? 1 : 0 }
    phases.push({ weight: hi - lo, pins: ps })
  }
  const key = [...duties].map(([p, duty]) => `${p}:${duty}`).join(',')
  return { phases, aVaries, key }
}

/**
 * One Solution blending per-state solutions by weight: voltages, currents, powers and extras are
 * Σ w·value_k (extras that are mode flags become the fraction of time in that mode). The parts
 * stay readable as `phases`. Single reads (currentOf …) don't materialise any maps.
 */
export function blendSolutions(parts: readonly PwmPhaseSolution[]): Solution {
  let ok = true
  let iterations = 0
  for (const p of parts) {
    ok &&= p.solution.ok
    iterations += p.solution.iterations ?? 0
  }
  const n = parts.length
  const one = (s: Solution, read: 'currentOf' | 'powerOf', map: 'current' | 'power', id: string) =>
    s[read] ? s[read]!(id) : (s[map][id] ?? 0)
  let cid = ''
  let ci = 0
  let cp = 0
  /** current and power of one element, measured together (each phase caches the pair) */
  const ip = (id: string) => {
    if (cid === id) return
    ci = 0
    cp = 0
    for (let k = 0; k < n; k++) {
      const { weight, solution } = parts[k]
      ci += weight * one(solution, 'currentOf', 'current', id)
      cp += weight * one(solution, 'powerOf', 'power', id)
    }
    cid = id
  }
  const merge = (get: (s: Solution) => Record<string, number>): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const { weight, solution } of parts) {
      const m = get(solution)
      for (const k in m) out[k] = (out[k] ?? 0) + weight * m[k]
    }
    return out
  }
  let nodeV: Record<string, number> | null = null
  let current: Record<string, number> | null = null
  let power: Record<string, number> | null = null
  let extra: Record<string, number> | null = null
  let overlay: Record<string, number> | null = null
  return {
    ok,
    iterations,
    phases: parts,
    currentOf(id) {
      if (current) return current[id] ?? 0
      ip(id)
      return ci
    },
    powerOf(id) {
      if (power) return power[id] ?? 0
      ip(id)
      return cp
    },
    extraOf(id, key) {
      if (extra) return extra[key] ?? 0
      if (overlay && key in overlay) return overlay[key]
      let v = 0
      for (const { weight, solution } of parts)
        v += weight * (solution.extraOf ? solution.extraOf(id, key) : (solution.extra[key] ?? 0))
      return v
    },
    voltageOf(node) {
      if (nodeV) return nodeV[node] ?? 0
      let v = 0
      for (const { weight, solution } of parts)
        v += weight * (solution.voltageOf ? solution.voltageOf(node) : (solution.nodeV[node] ?? 0))
      return v
    },
    publish(key, value) {
      if (extra) extra[key] = value
      else (overlay ??= {})[key] = value
    },
    get nodeV() {
      return (nodeV ??= merge((s) => s.nodeV))
    },
    get current() {
      return (current ??= merge((s) => s.current))
    },
    get power() {
      return (power ??= merge((s) => s.power))
    },
    get extra() {
      if (!extra) {
        extra = merge((s) => s.extra)
        if (overlay) Object.assign(extra, overlay)
      }
      return extra
    },
  }
}
