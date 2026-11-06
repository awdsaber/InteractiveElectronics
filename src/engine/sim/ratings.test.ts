import { describe, expect, it } from 'vitest'
import type { BurnEvent, Netlist } from '../types'
import { applyBurn, applyPatches } from './failures'
import { checkRatings, createRatingState, pinWarnings } from './ratings'
import { solveDC } from './solve'
import { createTransient } from './transient'

const ledCircuit: Netlist = {
  elements: [
    { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 5 },
    { id: 'R1', type: 'R', nodes: ['vcc', 'a'], value: 220 },
    { id: 'D1', type: 'LED', nodes: ['a', '0'], color: 'red', partId: 'led1' },
  ],
}

describe('checkRatings', () => {
  it('remove the resistor: LED draws > 0.1 A and burns (overcurrent) after 300 ms', () => {
    const broken = applyPatches(ledCircuit, [
      { op: 'remove', elementId: 'R1' },
      { op: 'short', a: 'vcc', b: 'a' },
    ])
    const sim = createTransient(broken, 1e-3)
    const state = createRatingState()
    let burns: BurnEvent[] = []
    let firstBurnT = -1
    for (let k = 0; k < 400 && firstBurnT < 0; k++) {
      const s = sim.step()
      expect(s.current['D1']).toBeGreaterThan(0.1)
      burns = checkRatings(broken, s, sim.t, state)
      if (burns.length) firstBurnT = sim.t
    }
    expect(firstBurnT).toBeGreaterThanOrEqual(0.3 - 1e-9)
    expect(firstBurnT).toBeLessThan(0.31)
    expect(burns).toHaveLength(1)
    expect(burns[0]).toMatchObject({ elementId: 'D1', partId: 'led1', reason: 'overcurrent' })
    expect(burns[0].value).toBeGreaterThan(0.1)
    expect(burns[0].limit).toBeCloseTo(0.03, 9)
  })

  it('does not burn a correctly limited LED', () => {
    const s = solveDC(ledCircuit)
    const state = createRatingState()
    expect(checkRatings(ledCircuit, s, 0, state)).toEqual([])
    expect(checkRatings(ledCircuit, s, 10, state)).toEqual([])
  })

  it('resets the timer when the overload stops before 300 ms', () => {
    const n: Netlist = {
      elements: [
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['a', '0'], value: 10, rating: { maxP: 0.25 } },
      ],
    }
    const hot = solveDC(n)
    const cool = solveDC({ elements: [n.elements[0], { ...n.elements[1], value: 1000 } as typeof n.elements[1]] })
    const st = createRatingState()
    expect(checkRatings(n, hot, 0, st)).toEqual([])
    expect(checkRatings(n, hot, 0.2, st)).toEqual([])
    expect(checkRatings(n, cool, 0.25, st)).toEqual([])
    expect(checkRatings(n, hot, 0.3, st)).toEqual([])
    const b = checkRatings(n, hot, 0.6, st)
    expect(b).toHaveLength(1)
    expect(b[0]).toMatchObject({ elementId: 'R1', reason: 'overpower', limit: 0.25, t: 0.6 })
    // a burn is reported once
    expect(checkRatings(n, hot, 0.7, st)).toEqual([])
  })

  it('overvoltage is instant', () => {
    const n: Netlist = {
      elements: [
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 25 },
        { id: 'C1', type: 'C', nodes: ['a', '0'], value: 1e-6, rating: { maxV: 16, failMode: 'short' } },
      ],
    }
    const b = checkRatings(n, solveDC(n), 0, createRatingState())
    expect(b).toHaveLength(1)
    expect(b[0]).toMatchObject({ elementId: 'C1', reason: 'overvoltage', limit: 16 })
    expect(b[0].value).toBeCloseTo(25, 6)
  })

  it('PIN abs max is 40 mA (pin-overcurrent)', () => {
    const n: Netlist = {
      elements: [
        { id: 'P13', type: 'PIN', nodes: ['p', '0'], pin: 13, vcc: 5 },
        { id: 'R1', type: 'R', nodes: ['p', '0'], value: 47 },
      ],
    }
    const s = solveDC(n, { pins: { 13: { mode: 'OUTPUT', level: 1 } } })
    const st = createRatingState()
    expect(checkRatings(n, s, 0, st)).toEqual([])
    const b = checkRatings(n, s, 0.3, st)
    expect(b).toHaveLength(1)
    expect(b[0]).toMatchObject({ elementId: 'P13', reason: 'pin-overcurrent', limit: 0.04 })
  })

  it('a burnt LED (open) stops conducting after applyBurn', () => {
    const shorted = applyPatches(ledCircuit, [{ op: 'set', elementId: 'R1', key: 'value', value: 0.01 }])
    const s = solveDC(shorted)
    const st = createRatingState()
    checkRatings(shorted, s, 0, st)
    const [burn] = checkRatings(shorted, s, 0.3, st)
    expect(burn).toBeDefined()
    const after = applyBurn(shorted, burn)
    expect(Math.abs(solveDC(after).current['D1'])).toBeLessThan(1e-6)
  })

  it('a non-converged step neither burns nor resets the overload timer', () => {
    const n: Netlist = {
      elements: [
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['a', '0'], value: 10, rating: { maxP: 0.25 } },
      ],
    }
    const hot = solveDC(n)
    const failed = { ok: false, nodeV: {}, current: {}, power: {}, extra: {} }
    const st = createRatingState()
    expect(checkRatings(n, hot, 0, st)).toEqual([])
    expect(checkRatings(n, failed, 0.2, st)).toEqual([])
    expect(checkRatings(n, hot, 0.3, st)).toHaveLength(1)
  })

  it('pinWarnings flags GPIO pins above the recommended 20 mA', () => {
    const n = (r: number): Netlist => ({
      elements: [
        { id: 'P13', type: 'PIN', nodes: ['p', '0'], pin: 13, vcc: 5 },
        { id: 'R1', type: 'R', nodes: ['p', '0'], value: r },
      ],
    })
    const pins = { 13: { mode: 'OUTPUT' as const, level: 1 } }
    expect(pinWarnings(n(1000), solveDC(n(1000), { pins }))).toEqual([])
    const w = pinWarnings(n(150), solveDC(n(150), { pins }))
    expect(w).toHaveLength(1)
    expect(w[0]).toMatchObject({ elementId: 'P13', pin: 13, limit: 0.02 })
    expect(w[0].current).toBeCloseTo(5 / 175, 6)
  })
})
