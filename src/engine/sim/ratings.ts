// Absolute-maximum checks: turn sustained overloads into BurnEvents.
// Also: junction temperature (rth / tauTh / tMax), RMS windows, fuse I²t, polarized-capacitor
// reverse voltage and thermal shutdown / recovery.

import type { BurnEvent, Element, ElementType, Netlist, Rating, Solution } from '../types'

/** over-current / over-power must persist this long (sim seconds) before a part fails */
export const BURN_DELAY = 0.3
/** ATmega328P-style absolute maximum DC current per I/O pin */
export const PIN_ABS_MAX_I = 0.04
/** recommended continuous GPIO current: above this a pin works but is out of spec */
export const PIN_WARN_I = 0.02
/** ambient temperature for the thermal model, °C */
export const T_AMB = 25
/** a thermally shut-down part restarts once Tj < tMax - THERMAL_HYST, °C */
export const THERMAL_HYST = 20
/** reverse voltage a polarized (electrolytic) capacitor survives, V */
export const POLAR_REV_V = 1

/** ratings applied when an element has none of its own (typical 5 mm LED: 30 mA abs max) */
export const DEFAULT_RATINGS: Partial<Record<ElementType, Rating>> = {
  LED: { maxI: 0.03, failMode: 'open' },
  // regulators protect themselves; thermal shutdown needs rth and tMax from the lesson
  REG: { failMode: 'shutdown' },
}

/** per-element rating memory (NaN timers = not overloaded) */
export interface PartState {
  /** sim time the over-current / over-power / reverse-voltage condition started */
  ocSince: number
  opSince: number
  rvSince: number
  /** junction temperature, °C */
  tj: number
  /** running means of i² and p (rmsWindow) */
  meanI2: number
  meanP: number
  /** fuse melting integral, A²s */
  melt: number
  /** in thermal shutdown */
  shutdown: boolean
}

export interface RatingState {
  /** elements already reported, so a burn fires once */
  burnt: Set<string>
  /** per element id */
  parts: Map<string, PartState>
  /** time of the previous check (null before the first) */
  lastT: number | null
}

export function createRatingState(): RatingState {
  return { burnt: new Set(), parts: new Map(), lastT: null }
}

function part(state: RatingState, id: string): PartState {
  let p = state.parts.get(id)
  if (!p) {
    p = {
      ocSince: NaN,
      opSince: NaN,
      rvSince: NaN,
      tj: T_AMB,
      meanI2: 0,
      meanP: 0,
      melt: 0,
      shutdown: false,
    }
    state.parts.set(id, p)
  }
  return p
}

export function effectiveRating(el: Element): Rating | undefined {
  const base = el.type === 'PIN' ? { maxI: PIN_ABS_MAX_I } : DEFAULT_RATINGS[el.type]
  if (!base && !el.rating) return undefined
  return { ...base, ...el.rating }
}

// cheap single reads (fall back to the maps for hand-built Solutions)
const curOf = (s: Solution, id: string) => (s.currentOf ? s.currentOf(id) : (s.current[id] ?? 0))
const powOf = (s: Solution, id: string) => (s.powerOf ? s.powerOf(id) : (s.power[id] ?? 0))
const xOf = (s: Solution, id: string, key: string) => (s.extraOf ? s.extraOf(id, key) : (s.extra[key] ?? 0))
const vOf = (s: Solution, n: string) => (s.voltageOf ? s.voltageOf(n) : (s.nodeV[n] ?? 0))
/** |V| across a maxV-rated element: the highest over the PWM states (an instant limit sees the peak) */
function peakV(s: Solution, e: Entry): number {
  if (e.vFixed !== null) return Math.abs(e.vFixed)
  if (!s.phases) return Math.abs(vOf(s, e.va) - vOf(s, e.vb))
  let v = 0
  for (const p of s.phases) v = Math.max(v, Math.abs(vOf(p.solution, e.va) - vOf(p.solution, e.vb)))
  return v
}
/** rated current squared: Σ w·i² over the PWM states (RMS heating), else i² */
function i2(s: Solution, e: Entry): number {
  const one = (x: Solution) => (e.iKey ? xOf(x, e.id, e.iKey) : curOf(x, e.id))
  if (!s.phases) {
    const i = one(s)
    return i * i
  }
  let v = 0
  for (const p of s.phases) {
    const i = one(p.solution)
    v += p.weight * i * i
  }
  return v
}
const publish = (s: Solution, key: string, v: number) => {
  if (s.publish) s.publish(key, v)
  else s.extra[key] = v
}

/** per-element work precomputed once per netlist object */
interface Entry {
  el: Element
  id: string
  r: Rating | undefined
  thermal: boolean
  /** maxV terminals (vb unused when vFixed is set) */
  va: string
  vb: string
  vFixed: number | null
  /** extra key holding the rated current, or null for current[id] */
  iKey: string | null
  kTj: string
  ocReason: BurnEvent['reason']
}

const PLANS = new WeakMap<Netlist, Entry[]>()

function plan(netlist: Netlist): Entry[] {
  let p = PLANS.get(netlist)
  if (p) return p
  p = []
  for (const el of netlist.elements) {
    const r = effectiveRating(el)
    const special = el.type === 'FUSE' || (el.type === 'C' && el.polarized === true)
    if (!r && !special) continue
    const id = el.id
    const va = el.nodes[0]
    let vb = el.nodes[1] ?? '0'
    let vFixed: number | null = null
    switch (el.type) {
      case 'NPN':
      case 'PNP':
      case 'NMOS':
      case 'PMOS':
      case 'POT':
        vb = el.nodes[2] // Vce / Vds / track
        break
      case 'OPAMP':
        vFixed = el.vPos - el.vNeg
        break
      case 'LOGIC':
        vFixed = el.vcc
        break
      default:
        break
    }
    p.push({
      el,
      id,
      r,
      thermal: r !== undefined && r.rth !== undefined && r.tMax !== undefined,
      va,
      vb,
      vFixed,
      iKey: el.type === 'OPAMP' || el.type === 'REG' ? `${id}.iout` : null,
      kTj: `${id}.tj`,
      ocReason: el.type === 'PIN' ? 'pin-overcurrent' : 'overcurrent',
    })
  }
  PLANS.set(netlist, p)
  return p
}

function fire(
  state: RatingState,
  events: BurnEvent[],
  e: Entry,
  reason: BurnEvent['reason'],
  value: number,
  limit: number,
  t: number,
): void {
  if (reason !== 'thermal-shutdown' && reason !== 'thermal-recover') state.burnt.add(e.id)
  events.push({ elementId: e.id, partId: e.el.partId, reason, value, limit, t })
}

/** advance a running mean with time constant tau */
const mean = (prev: number, value: number, dt: number, tau: number) =>
  dt > 0 ? prev + (value - prev) * (1 - Math.exp(-dt / tau)) : prev

/** Tj after dt at power p (exact for piecewise-constant power) */
function nextTj(prev: number, r: Rating, p: number, dt: number): number {
  const tss = T_AMB + p * (r.rth ?? 0)
  const tau = r.tauTh ?? 0
  return tau > 0 ? prev + (tss - prev) * (1 - Math.exp(-dt / tau)) : tss
}

/**
 * Check every rated element against the solution at sim time `t`.
 * - Over-voltage fails instantly.
 * - Over-current (RMS over rmsWindow when set) must persist for BURN_DELAY.
 * - With rth and tMax, junction temperature (published as solution.extra[`${id}.tj`]) replaces
 *   the maxP rule: Tj ≥ tMax burns ('overtemp'), or with failMode 'shutdown' disables the part
 *   until it cools below tMax - THERMAL_HYST ('thermal-shutdown' then 'thermal-recover').
 * - Otherwise over-power (mean over rmsWindow when set) must persist for BURN_DELAY.
 * - FUSE blows when ∫(i² - iRated²)dt (floored at 0) reaches i2t; a polarized C fails short
 *   after BURN_DELAY of more than POLAR_REV_V reverse bias.
 *
 * Designed to be called once per frame with the frame's last good solution (Transient.lastGood)
 * and increasing `t`: heat and running means integrate over the time since the previous call,
 * so frame-rate sampling is enough. It reads only the rated elements (Solution.currentOf etc.,
 * without materialising the lazy maps) and caches its per-element plan per netlist object.
 * `state` is mutated (timers, temperatures, already-burnt set). At most one event per element.
 *
 * On a duty-weighted PWM step (solution.phases) maxV takes the highest |V| over the switch states,
 * maxI and fuse melting use the RMS current √(Σ w·i²), and power is the blended mean Σ w·p.
 *
 * `instantOnly` is for extra samples inside a frame (edge substeps): it fires only the instant
 * limit (maxV over-voltage) and leaves lastT, heat, running means, fuse melt and timers untouched,
 * so the per-frame checks integrate exactly as if the sample had not been taken.
 */
export function checkRatings(
  netlist: Netlist,
  solution: Solution,
  t: number,
  state: RatingState,
  opts: { instantOnly?: boolean } = {},
): BurnEvent[] {
  if (!solution.ok) return []
  if (opts.instantOnly) return checkInstant(netlist, solution, t, state)
  const dt = state.lastT === null ? 0 : Math.max(0, t - state.lastT)
  state.lastT = t
  const events: BurnEvent[] = []
  const s = solution
  const late = t - BURN_DELAY + 1e-9 // a timer started at or before this has run its course
  for (const e of plan(netlist)) {
    const { el, id } = e
    if (state.burnt.size > 0 && state.burnt.has(id)) continue
    const ps = part(state, id)

    if (el.type === 'FUSE' && !el.blown) {
      const ii = i2(s, e)
      ps.melt = Math.max(0, ps.melt + (ii - el.iRated * el.iRated) * dt)
      if (ps.melt >= el.i2t) {
        fire(state, events, e, 'blown', Math.sqrt(ii), el.iRated, t)
        continue
      }
    }
    if (el.type === 'C' && el.polarized && !el.disabled) {
      const v = vOf(s, el.nodes[0]) - vOf(s, el.nodes[1])
      if (v < -POLAR_REV_V) {
        if (ps.rvSince !== ps.rvSince) ps.rvSince = t
        if (ps.rvSince <= late) {
          fire(state, events, e, 'reverse-voltage', -v, POLAR_REV_V, t)
          continue
        }
      } else ps.rvSince = NaN
    }

    const r = e.r
    if (!r) continue

    if (ps.shutdown) {
      // disabled while hot: cool down (it dissipates nothing) and restart below the hysteresis
      ps.tj = nextTj(ps.tj, r, el.disabled ? 0 : Math.abs(powOf(s, id)), dt)
      publish(s, e.kTj, ps.tj)
      if (ps.tj < r.tMax! - THERMAL_HYST) {
        ps.shutdown = false
        fire(state, events, e, 'thermal-recover', ps.tj, r.tMax! - THERMAL_HYST, t)
      }
      continue
    }
    if (el.disabled) continue

    if (r.maxV !== undefined) {
      const v = peakV(s, e)
      if (v > r.maxV) {
        fire(state, events, e, 'overvoltage', v, r.maxV, t)
        continue
      }
    }

    if (r.maxI !== undefined) {
      const ii = i2(s, e)
      let value = Math.sqrt(ii)
      if (r.rmsWindow) {
        ps.meanI2 = mean(ps.meanI2, ii, dt, r.rmsWindow)
        value = Math.sqrt(ps.meanI2)
      }
      if (value > r.maxI) {
        if (ps.ocSince !== ps.ocSince) ps.ocSince = t
        if (ps.ocSince <= late) {
          fire(state, events, e, e.ocReason, value, r.maxI, t)
          continue
        }
      } else ps.ocSince = NaN
    }

    if (e.thermal) {
      ps.tj = nextTj(ps.tj, r, Math.abs(powOf(s, id)), dt)
      publish(s, e.kTj, ps.tj)
      if (ps.tj >= r.tMax!) {
        if (r.failMode === 'shutdown') {
          ps.shutdown = true
          fire(state, events, e, 'thermal-shutdown', ps.tj, r.tMax!, t)
        } else fire(state, events, e, 'overtemp', ps.tj, r.tMax!, t)
      }
    } else if (r.maxP !== undefined) {
      const p = Math.abs(powOf(s, id))
      let value = p
      if (r.rmsWindow) value = ps.meanP = mean(ps.meanP, p, dt, r.rmsWindow)
      if (value > r.maxP) {
        if (ps.opSince !== ps.opSince) ps.opSince = t
        if (ps.opSince <= late) fire(state, events, e, 'overpower', value, r.maxP, t)
      } else ps.opSince = NaN
    }
  }
  return events
}

/** over-voltage only, with no side effects on timers, heat or lastT (see checkRatings instantOnly) */
function checkInstant(netlist: Netlist, s: Solution, t: number, state: RatingState): BurnEvent[] {
  const events: BurnEvent[] = []
  for (const e of plan(netlist)) {
    const { el, id, r } = e
    if (r?.maxV === undefined || el.disabled || state.burnt.has(id)) continue
    if (state.parts.get(id)?.shutdown) continue
    const v = peakV(s, e)
    if (v > r.maxV) fire(state, events, e, 'overvoltage', v, r.maxV, t)
  }
  return events
}

export interface PinWarning {
  elementId: string
  pin: number
  /** |current| through the pin, A */
  current: number
  limit: number
}

/** PIN elements carrying more than the recommended 20 mA (not yet the 40 mA absolute maximum) */
export function pinWarnings(netlist: Netlist, solution: Solution): PinWarning[] {
  const out: PinWarning[] = []
  for (const el of netlist.elements) {
    if (el.type !== 'PIN') continue
    const i = Math.abs(solution.current[el.id] ?? 0)
    if (i > PIN_WARN_I) out.push({ elementId: el.id, pin: el.pin, current: i, limit: PIN_WARN_I })
  }
  return out
}
