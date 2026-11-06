// Absolute-maximum checks: turn sustained overloads into BurnEvents.

import type { BurnEvent, Element, ElementType, Netlist, Rating, Solution } from '../types'

/** over-current / over-power must persist this long (sim seconds) before a part fails */
export const BURN_DELAY = 0.3
/** ATmega328P-style absolute maximum DC current per I/O pin */
export const PIN_ABS_MAX_I = 0.04

/** ratings applied when an element has none of its own (typical 5 mm LED: 30 mA abs max) */
export const DEFAULT_RATINGS: Partial<Record<ElementType, Rating>> = {
  LED: { maxI: 0.03, failMode: 'open' },
}

export interface RatingState {
  /** `${elementId}:${reason}` -> sim time the overload started */
  overSince: Record<string, number>
  /** elements already reported, so a burn fires once */
  burnt: Set<string>
}

export function createRatingState(): RatingState {
  return { overSince: {}, burnt: new Set() }
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
      return v(el.nodes[0]) - v(el.nodes[2])
    case 'OPAMP':
      return el.vPos - el.vNeg
    default:
      return v(el.nodes[0]) - v(el.nodes[1])
  }
}

function ratedCurrent(el: Element, s: Solution): number {
  if (el.type === 'OPAMP') return s.extra[`${el.id}.iout`] ?? 0
  return s.current[el.id] ?? 0
}

/**
 * Check every rated element against the solution at sim time `t`.
 * Over-voltage fails instantly; over-current and over-power must persist for BURN_DELAY.
 * `state` is mutated (timers, already-burnt set). At most one event per element.
 */
export function checkRatings(netlist: Netlist, solution: Solution, t: number, state: RatingState): BurnEvent[] {
  if (!solution.ok) return []
  const events: BurnEvent[] = []
  for (const el of netlist.elements) {
    if (state.burnt.has(el.id)) continue
    const r = effectiveRating(el)
    if (!r) continue
    const fire = (reason: BurnEvent['reason'], value: number, limit: number) => {
      state.burnt.add(el.id)
      events.push({ elementId: el.id, partId: el.partId, reason, value, limit, t })
    }

    if (r.maxV !== undefined) {
      const v = Math.abs(ratedVoltage(el, solution))
      if (v > r.maxV) {
        fire('overvoltage', v, r.maxV)
        continue
      }
    }

    const checks: [BurnEvent['reason'], number, number | undefined][] = [
      [el.type === 'PIN' ? 'pin-overcurrent' : 'overcurrent', Math.abs(ratedCurrent(el, solution)), r.maxI],
      ['overpower', Math.abs(solution.power[el.id] ?? 0), r.maxP],
    ]
    for (const [reason, value, limit] of checks) {
      if (limit === undefined) continue
      const key = `${el.id}:${reason}`
      if (value > limit) {
        const since = (state.overSince[key] ??= t)
        if (t - since >= BURN_DELAY - 1e-9) {
          delete state.overSince[key]
          fire(reason, value, limit)
          break
        }
      } else {
        delete state.overSince[key]
      }
    }
  }
  return events
}
