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

export interface RatingState {
  /** `${elementId}:${reason}` -> sim time the overload started */
  overSince: Record<string, number>
  /** elements already reported, so a burn fires once */
  burnt: Set<string>
  /** junction temperature by element id, °C */
  tj: Record<string, number>
  /** running mean of i² and of p by element id (rmsWindow) */
  meanI2: Record<string, number>
  meanP: Record<string, number>
  /** fuse melting integral by element id, A²s */
  melt: Record<string, number>
  /** elements currently in thermal shutdown */
  shutdown: Set<string>
  /** time of the previous check (null before the first) */
  lastT: number | null
}

export function createRatingState(): RatingState {
  return { overSince: {}, burnt: new Set(), tj: {}, meanI2: {}, meanP: {}, melt: {}, shutdown: new Set(), lastT: null }
}

export function effectiveRating(el: Element): Rating | undefined {
  const base = el.type === 'PIN' ? { maxI: PIN_ABS_MAX_I } : DEFAULT_RATINGS[el.type]
  if (!base && !el.rating) return undefined
  return { ...base, ...el.rating }
}

/** voltage the rating's maxV applies to: nodes[0]-nodes[1], or Vce / Vds for transistors */
function ratedVoltage(el: Element, s: Solution): number {
  const v = (n: string) => s.nodeV[n] ?? 0
  switch (el.type) {
    case 'NPN':
    case 'PNP':
    case 'NMOS':
    case 'PMOS':
    case 'POT':
      return v(el.nodes[0]) - v(el.nodes[2])
    case 'OPAMP':
      return el.vPos - el.vNeg
    case 'LOGIC':
      return el.vcc
    default:
      return v(el.nodes[0]) - v(el.nodes[1])
  }
}

function ratedCurrent(el: Element, s: Solution): number {
  if (el.type === 'OPAMP') return s.extra[`${el.id}.iout`] ?? 0
  if (el.type === 'REG') return s.extra[`${el.id}.iout`] ?? 0
  return s.current[el.id] ?? 0
}

/** exponential running mean with time constant tau */
function runningMean(map: Record<string, number>, id: string, value: number, dt: number, tau: number): number {
  const prev = map[id] ?? 0
  const next = dt > 0 ? prev + (value - prev) * (1 - Math.exp(-dt / tau)) : prev
  map[id] = next
  return next
}

/** advance Tj by dt at power p (exact for piecewise-constant power) */
function stepTj(state: RatingState, id: string, r: Rating, p: number, dt: number): number {
  const tss = T_AMB + p * (r.rth ?? 0)
  const tau = r.tauTh ?? 0
  let tj: number
  if (!(tau > 0)) tj = tss
  else {
    const prev = state.tj[id] ?? T_AMB
    tj = prev + (tss - prev) * (1 - Math.exp(-dt / tau))
  }
  state.tj[id] = tj
  return tj
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
 * `state` is mutated (timers, temperatures, already-burnt set). At most one event per element.
 * Call it with increasing t; the step since the previous call integrates heat.
 */
export function checkRatings(netlist: Netlist, solution: Solution, t: number, state: RatingState): BurnEvent[] {
  if (!solution.ok) return []
  const dt = state.lastT === null ? 0 : Math.max(0, t - state.lastT)
  state.lastT = t
  const events: BurnEvent[] = []
  for (const el of netlist.elements) {
    if (state.burnt.has(el.id)) continue
    const fire = (reason: BurnEvent['reason'], value: number, limit: number) => {
      if (reason !== 'thermal-shutdown' && reason !== 'thermal-recover') state.burnt.add(el.id)
      events.push({ elementId: el.id, partId: el.partId, reason, value, limit, t })
    }
    /** true when `over` has held for BURN_DELAY */
    const sustained = (reason: string, over: boolean): boolean => {
      const key = `${el.id}:${reason}`
      if (!over) {
        delete state.overSince[key]
        return false
      }
      const since = (state.overSince[key] ??= t)
      if (t - since >= BURN_DELAY - 1e-9) {
        delete state.overSince[key]
        return true
      }
      return false
    }

    if (el.type === 'FUSE' && !el.blown) {
      const i = solution.current[el.id] ?? 0
      const melt = Math.max(0, (state.melt[el.id] ?? 0) + (i * i - el.iRated * el.iRated) * dt)
      state.melt[el.id] = melt
      if (melt >= el.i2t) {
        fire('blown', Math.abs(i), el.iRated)
        continue
      }
    }
    if (el.type === 'C' && el.polarized && !el.disabled) {
      const v = (solution.nodeV[el.nodes[0]] ?? 0) - (solution.nodeV[el.nodes[1]] ?? 0)
      if (sustained('reverse-voltage', v < -POLAR_REV_V)) {
        fire('reverse-voltage', -v, POLAR_REV_V)
        continue
      }
    }

    const r = effectiveRating(el)
    if (!r) continue
    const thermal = r.rth !== undefined && r.tMax !== undefined

    if (state.shutdown.has(el.id)) {
      // disabled while hot: cool down (it dissipates nothing) and restart below the hysteresis
      const tj = stepTj(state, el.id, r, el.disabled ? 0 : Math.abs(solution.power[el.id] ?? 0), dt)
      solution.extra[`${el.id}.tj`] = tj
      if (tj < r.tMax! - THERMAL_HYST) {
        state.shutdown.delete(el.id)
        fire('thermal-recover', tj, r.tMax! - THERMAL_HYST)
      }
      continue
    }
    if (el.disabled) continue

    if (r.maxV !== undefined) {
      const v = Math.abs(ratedVoltage(el, solution))
      if (v > r.maxV) {
        fire('overvoltage', v, r.maxV)
        continue
      }
    }

    if (r.maxI !== undefined) {
      const i = Math.abs(ratedCurrent(el, solution))
      const value = r.rmsWindow ? Math.sqrt(runningMean(state.meanI2, el.id, i * i, dt, r.rmsWindow)) : i
      if (sustained('overcurrent', value > r.maxI)) {
        fire(el.type === 'PIN' ? 'pin-overcurrent' : 'overcurrent', value, r.maxI)
        continue
      }
    }

    const p = Math.abs(solution.power[el.id] ?? 0)
    if (thermal) {
      const tj = stepTj(state, el.id, r, p, dt)
      solution.extra[`${el.id}.tj`] = tj
      if (tj >= r.tMax!) {
        if (r.failMode === 'shutdown') {
          state.shutdown.add(el.id)
          fire('thermal-shutdown', tj, r.tMax!)
        } else fire('overtemp', tj, r.tMax!)
      }
    } else if (r.maxP !== undefined) {
      const value = r.rmsWindow ? runningMean(state.meanP, el.id, p, dt, r.rmsWindow) : p
      if (sustained('overpower', value > r.maxP)) fire('overpower', value, r.maxP)
    }
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
