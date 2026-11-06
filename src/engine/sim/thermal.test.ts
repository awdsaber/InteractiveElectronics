import { describe, expect, it } from 'vitest'
import type { BurnEvent, Netlist, Rating } from '../types'
import { applyBurn } from './failures'
import { T_AMB, checkRatings, createRatingState } from './ratings'
import { solveDC } from './solve'
import { createTransient } from './transient'

// 10 V across 100 Ω: 1 W
const oneWatt = (rating: Rating): Netlist => ({
  elements: [
    { id: 'V1', type: 'V', nodes: ['a', '0'], value: 10 },
    { id: 'R1', type: 'R', nodes: ['a', '0'], value: 100, rating, partId: 'r1' },
  ],
})

function firstEvent(n: Netlist, dt: number, tEnd: number): { t: number; ev: BurnEvent | null; tjAt10: number } {
  const s = solveDC(n)
  const st = createRatingState()
  let tjAt10 = NaN
  for (let k = 0; k * dt <= tEnd; k++) {
    const t = k * dt
    const ev = checkRatings(n, s, t, st)
    if (Math.abs(t - 10) < dt / 2) tjAt10 = s.extra['R1.tj']
    if (ev.length) return { t, ev: ev[0], tjAt10 }
  }
  return { t: -1, ev: null, tjAt10 }
}

describe('thermal model', () => {
  it('1 W at 50 °C/W, τ 10 s, tMax 60 °C: Tj = 25 + 50·(1 - e^(-t/10)) reaches 60 °C at t = 10·ln(1/0.3) = 12.04 s', () => {
    expect(T_AMB).toBe(25)
    const { t, ev, tjAt10 } = firstEvent(oneWatt({ rth: 50, tauTh: 10, tMax: 60 }), 0.01, 20)
    expect(tjAt10).toBeCloseTo(25 + 50 * (1 - Math.exp(-1)), 3)
    expect(Math.abs(t - 10 * Math.log(1 / 0.3))).toBeLessThan(0.015)
    expect(ev).toMatchObject({ elementId: 'R1', partId: 'r1', reason: 'overtemp', limit: 60 })
  })

  it('temperature replaces the 300 ms rule: maxP 0.5 W is exceeded but nothing burns while Tj < tMax', () => {
    const { t } = firstEvent(oneWatt({ maxP: 0.5, rth: 20, tauTh: 1, tMax: 100 }), 0.01, 5)
    expect(t).toBe(-1) // steady Tj = 45 °C
  })

  it('without tauTh Tj follows power instantly (25 + 1·80 = 105 > 100 °C)', () => {
    const { t, ev } = firstEvent(oneWatt({ rth: 80, tMax: 100 }), 0.01, 1)
    expect(t).toBe(0)
    expect(ev?.value).toBeCloseTo(105, 9)
  })

  it('publishes Tj in solution.extra', () => {
    const n = oneWatt({ rth: 30, tMax: 150 })
    const s = solveDC(n)
    checkRatings(n, s, 0, createRatingState())
    expect(s.extra['R1.tj']).toBeCloseTo(55, 9)
  })
})

describe('rmsWindow', () => {
  // 0 / 2 A square wave, 2 Hz (250 ms high): each overload is shorter than 300 ms, but RMS = √2 A
  const pulsed = (rating: Rating): Netlist => ({
    elements: [
      { id: 'V1', type: 'V', nodes: ['a', '0'], value: 0, wave: { kind: 'square', amp: 1, offset: 1, freq: 2 } },
      { id: 'R1', type: 'R', nodes: ['a', '0'], value: 1, rating },
    ],
  })
  const run = (n: Netlist) => {
    const sim = createTransient(n, 1e-3)
    const st = createRatingState()
    for (let k = 0; k < 5000; k++) {
      const s = sim.step()
      const ev = checkRatings(n, s, sim.t, st)
      if (ev.length) return { t: sim.t, ev: ev[0] }
    }
    return { t: -1, ev: null }
  }

  it('instantaneous check never sees 300 ms of continuous overload', () => {
    expect(run(pulsed({ maxI: 1 })).t).toBe(-1)
  })

  it('1 s RMS window: mean i² passes 1 A² at ≈0.6 s, burns 300 ms later', () => {
    const { t, ev } = run(pulsed({ maxI: 1, rmsWindow: 1 }))
    expect(ev?.reason).toBe('overcurrent')
    expect(t).toBeGreaterThan(0.85)
    expect(t).toBeLessThan(0.95)
  })
})

describe('ratings additions', () => {
  it('SW maxI: a closed switch carrying 2 A on a 1 A rating burns after 300 ms', () => {
    const n: Netlist = {
      elements: [
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 2 },
        { id: 'S1', type: 'SW', nodes: ['a', 'b'], closed: true, rating: { maxI: 1 } },
        { id: 'R1', type: 'R', nodes: ['b', '0'], value: 0.95 },
      ],
    }
    const s = solveDC(n)
    const st = createRatingState()
    expect(checkRatings(n, s, 0, st)).toEqual([])
    const ev = checkRatings(n, s, 0.3, st)
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ elementId: 'S1', reason: 'overcurrent' })
  })

  it('polarized capacitor reverse-biased by 5 V fails short after 300 ms; forward bias is fine', () => {
    const n = (v: number): Netlist => ({
      elements: [
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: v },
        { id: 'R1', type: 'R', nodes: ['a', 'p'], value: 100 },
        { id: 'C1', type: 'C', nodes: ['p', '0'], value: 100e-6, polarized: true, partId: 'c1' },
      ],
    })
    const run = (net: Netlist) => {
      const sim = createTransient(net, 1e-3)
      const st = createRatingState()
      for (let k = 0; k < 1000; k++) {
        const s = sim.step()
        const ev = checkRatings(net, s, sim.t, st)
        if (ev.length) return { t: sim.t, ev: ev[0] }
      }
      return { t: -1, ev: null }
    }
    expect(run(n(5)).t).toBe(-1)
    const { t, ev } = run(n(-5))
    expect(ev).toMatchObject({ elementId: 'C1', reason: 'reverse-voltage' })
    // reverse voltage passes 1 V at t = -τ·ln(1 - 1/5) = 2.2 ms (τ = 10 ms), plus 300 ms
    expect(t).toBeGreaterThan(0.3)
    expect(t).toBeLessThan(0.31)
    const after = applyBurn(n(-5), ev!)
    const shorted = after.elements.find((e) => e.id === 'C1')!
    expect(shorted).toMatchObject({ type: 'R', value: 0.01, partId: 'c1' })
  })

  it('thermal-shutdown and thermal-recover toggle `disabled` instead of replacing the part', () => {
    const n = oneWatt({ rth: 200, tMax: 150, failMode: 'shutdown' })
    const s = solveDC(n)
    const st = createRatingState()
    const off = checkRatings(n, s, 0, st)
    expect(off).toHaveLength(1)
    expect(off[0].reason).toBe('thermal-shutdown')
    const n2 = applyBurn(n, off[0])
    expect(n2.elements[1]).toMatchObject({ type: 'R', disabled: true, value: 100 })
    const s2 = solveDC(n2)
    expect(s2.current['R1']).toBe(0)
    const on = checkRatings(n2, s2, 1, st)
    expect(on.map((e) => e.reason)).toEqual(['thermal-recover'])
    expect(applyBurn(n2, on[0]).elements[1].disabled).toBe(false)
    expect(st.burnt.has('R1')).toBe(false)
  })
})
