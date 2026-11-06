import { describe, expect, it } from 'vitest'
import type { Netlist } from '../types'
import { solveDC } from './solve'
import { createTransient } from './transient'

describe('createTransient', () => {
  it('RC: 1 kΩ, 1 mF, 5 V step gives 63% ± 2% at t = τ', () => {
    const n: Netlist = {
      elements: [
        { id: 'V1', type: 'V', nodes: ['in', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['in', 'c'], value: 1000 },
        { id: 'C1', type: 'C', nodes: ['c', '0'], value: 1e-3 },
      ],
    }
    const sim = createTransient(n, 1e-3)
    expect(sim.t).toBe(0)
    let s = sim.step()
    for (let k = 1; k < 1000; k++) s = sim.step()
    expect(sim.t).toBeCloseTo(1, 9)
    expect(s.ok).toBe(true)
    const frac = s.nodeV['c'] / 5
    expect(frac).toBeGreaterThan(0.61)
    expect(frac).toBeLessThan(0.65)
    expect(s.current['C1']).toBeCloseTo(s.current['R1'], 9)
  })

  it('capacitor starts from v0', () => {
    const sim = createTransient(
      {
        elements: [
          { id: 'R1', type: 'R', nodes: ['c', '0'], value: 1000 },
          { id: 'C1', type: 'C', nodes: ['c', '0'], value: 1e-3, v0: 3 },
        ],
      },
      1e-4,
    )
    const s = sim.step()
    expect(s.nodeV['c']).toBeGreaterThan(2.99)
    expect(s.nodeV['c']).toBeLessThan(3)
  })

  it('RL: current reaches 63% of V/R at t = L/R', () => {
    const sim = createTransient(
      {
        elements: [
          { id: 'V1', type: 'V', nodes: ['in', '0'], value: 10 },
          { id: 'R1', type: 'R', nodes: ['in', 'x'], value: 10 },
          { id: 'L1', type: 'L', nodes: ['x', '0'], value: 0.1 },
        ],
      },
      1e-5,
    )
    let s = sim.step()
    for (let k = 1; k < 1000; k++) s = sim.step()
    const frac = s.current['L1'] / 1
    expect(frac).toBeGreaterThan(0.61)
    expect(frac).toBeLessThan(0.65)
  })

  it('motor spins up from rest towards the DC steady state and publishes omega/rpm', () => {
    const n: Netlist = {
      elements: [
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 6 },
        { id: 'M1', type: 'MOTOR', nodes: ['vcc', '0'], r: 2, l: 1e-3, ke: 0.01, j: 1e-6, b: 1e-6 },
      ],
    }
    const dc = solveDC(n)
    const sim = createTransient(n, 1e-3)
    const first = sim.step()
    expect(first.extra['M1.omega']).toBeLessThan(dc.extra['M1.omega'] * 0.5)
    // inrush current is far above the running current
    let peak = first.current['M1']
    let s = first
    for (let k = 1; k < 3000; k++) {
      s = sim.step()
      peak = Math.max(peak, s.current['M1'])
    }
    expect(peak).toBeGreaterThan(5 * dc.current['M1'])
    expect(s.extra['M1.omega']).toBeCloseTo(dc.extra['M1.omega'], 0)
    expect(s.extra['M1.rpm']).toBeCloseTo((s.extra['M1.omega'] * 60) / (2 * Math.PI), 6)
  })

  it('setPin drives PIN elements by pin number', () => {
    const sim = createTransient(
      {
        elements: [
          { id: 'P13', type: 'PIN', nodes: ['p', '0'], pin: 13, vcc: 5 },
          { id: 'R1', type: 'R', nodes: ['p', 'a'], value: 220 },
          { id: 'D1', type: 'LED', nodes: ['a', '0'], color: 'red' },
        ],
      },
      1e-3,
    )
    expect(Math.abs(sim.step().current['D1'])).toBeLessThan(1e-9)
    sim.setPin(13, { mode: 'OUTPUT', level: 1 })
    const on = sim.step()
    expect(on.current['D1']).toBeGreaterThan(0.01)
    sim.setPin(13, { mode: 'OUTPUT', level: 0 })
    expect(Math.abs(sim.step().current['D1'])).toBeLessThan(1e-9)
  })

  it('setParam changes element parameters live without mutating the input', () => {
    const n: Netlist = {
      elements: [
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 5 },
        { id: 'S1', type: 'SW', nodes: ['a', 'b'], closed: false },
        { id: 'R1', type: 'R', nodes: ['b', '0'], value: 100 },
      ],
    }
    const sim = createTransient(n, 1e-3)
    expect(Math.abs(sim.step().current['R1'])).toBeLessThan(1e-7)
    sim.setParam('S1', 'closed', true)
    expect(sim.step().current['R1']).toBeCloseTo(0.05, 3)
    sim.setParam('R1', 'value', 50)
    expect(sim.step().current['R1']).toBeCloseTo(0.1, 3)
    expect(n.elements[1]).toMatchObject({ closed: false })
  })

  it('setNetlist keeps capacitor state for elements that survive', () => {
    const base: Netlist = {
      elements: [
        { id: 'V1', type: 'V', nodes: ['in', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['in', 'c'], value: 1000 },
        { id: 'C1', type: 'C', nodes: ['c', '0'], value: 1e-3 },
      ],
    }
    const sim = createTransient(base, 1e-3)
    let s = sim.step()
    for (let k = 1; k < 1000; k++) s = sim.step()
    const charged = s.nodeV['c']
    // unplug the source: capacitor discharges through R1 only
    sim.setNetlist({ elements: base.elements.filter((e) => e.id !== 'V1') })
    s = sim.step()
    expect(s.nodeV['c']).toBeGreaterThan(charged * 0.99)
    expect(s.nodeV['c']).toBeLessThanOrEqual(charged)
  })
})
