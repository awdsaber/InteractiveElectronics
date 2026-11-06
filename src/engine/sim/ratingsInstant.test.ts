import { describe, expect, it } from 'vitest'
import type { Netlist, Solution } from '../types'
import { checkRatings, createRatingState } from './ratings'

// checkRatings(..., { instantOnly: true }) is for sub-frame samples (edge substeps): it may only
// fire instant limits (maxV) and must not advance time, heat, running means or burn timers.

const net: Netlist = {
  elements: [
    { id: 'RH', type: 'R', nodes: ['a', '0'], value: 10, rating: { rth: 100, tauTh: 2, tMax: 150 } },
    { id: 'RI', type: 'R', nodes: ['a', '0'], value: 10, rating: { maxI: 0.5, rmsWindow: 1 } },
    { id: 'RV', type: 'R', nodes: ['v', '0'], value: 10, rating: { maxV: 40 } },
  ],
}

function sol(p: { pRH?: number; iRI?: number; v?: number }): Solution {
  return {
    ok: true,
    nodeV: { a: 1, v: p.v ?? 5, '0': 0 },
    current: { RH: 0.1, RI: p.iRI ?? 0, RV: 0 },
    power: { RH: p.pRH ?? 0, RI: 0, RV: 0 },
    extra: {},
  }
}

describe('checkRatings instantOnly', () => {
  it('leaves junction temperature, running means and lastT exactly as plain frame checks would', () => {
    const a = createRatingState()
    const b = createRatingState()
    const hot = sol({ pRH: 1, iRI: 0.8 })
    checkRatings(net, hot, 0, a)
    checkRatings(net, hot, 0, b)
    // a substep sample half-way through the frame, with a very different operating point
    expect(checkRatings(net, sol({ pRH: 0, iRI: 0 }), 0.5, b, { instantOnly: true })).toEqual([])
    expect(b.lastT).toBe(0)
    checkRatings(net, hot, 1, a)
    checkRatings(net, hot, 1, b)
    expect(b.parts.get('RH')!.tj).toBe(a.parts.get('RH')!.tj)
    expect(b.parts.get('RI')!.meanI2).toBe(a.parts.get('RI')!.meanI2)
    expect(b.parts.get('RH')!.tj).toBeGreaterThan(25)
  })

  it('does not restart or clear an over-current timer', () => {
    const st = createRatingState()
    const over = { ...net, elements: [{ id: 'RI', type: 'R' as const, nodes: ['a', '0'] as [string, string], value: 10, rating: { maxI: 0.5 } }] }
    checkRatings(over, sol({ iRI: 0.8 }), 0, st)
    checkRatings(over, sol({ iRI: 0 }), 0.1, st, { instantOnly: true })
    const ev = checkRatings(over, sol({ iRI: 0.8 }), 0.31, st)
    expect(ev.map((e) => [e.elementId, e.reason])).toEqual([['RI', 'overcurrent']])
  })

  it('still fires over-voltage at once, and only once', () => {
    const st = createRatingState()
    const ev = checkRatings(net, sol({ v: 60 }), 0.2, st, { instantOnly: true })
    expect(ev).toMatchObject([{ elementId: 'RV', reason: 'overvoltage', value: 60, limit: 40, t: 0.2 }])
    expect(st.lastT).toBeNull()
    expect(checkRatings(net, sol({ v: 60 }), 0.3, st)).toEqual([])
  })
})
