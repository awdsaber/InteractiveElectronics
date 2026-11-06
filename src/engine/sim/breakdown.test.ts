import { describe, expect, it } from 'vitest'
import type { Element, Netlist } from '../types'
import { solveDC } from './solve'
import { createTransient } from './transient'

// 12 V, 12 Ω, 10 mH: 1 A steady coil current, τ = L/R = 0.83 ms
function coil(sw: Element): Netlist {
  return {
    elements: [
      { id: 'V1', type: 'V', nodes: ['s', '0'], value: 12 },
      { id: 'R1', type: 'R', nodes: ['s', 'n1'], value: 12 },
      { id: 'L1', type: 'L', nodes: ['n1', 'n2'], value: 0.01 },
      sw,
    ],
  }
}

describe('avalanche clamps (vBreak)', () => {
  it('opening a switch on a 1 A coil: contacts clamp at vBreak + i·1 Ω ≈ 101 V, then the current dies', () => {
    const sim = createTransient(coil({ id: 'S1', type: 'SW', nodes: ['n2', '0'], closed: true, vBreak: 100 }), 1e-5)
    let s = sim.step()
    for (let k = 1; k < 1000; k++) s = sim.step()
    expect(s.current['L1']).toBeCloseTo(12 / 12.05, 3) // 50 mΩ contact resistance
    sim.setParam('S1', 'closed', false)
    let peak = 0
    for (let k = 0; k < 200; k++) {
      s = sim.step()
      expect(s.ok).toBe(true)
      peak = Math.max(peak, s.nodeV['n2'])
      if (k === 0) expect(s.current['S1']).toBeGreaterThan(0.85) // the coil current flows through the clamp
    }
    expect(peak).toBeGreaterThan(100)
    expect(peak).toBeLessThan(102)
    expect(Math.abs(s.current['L1'])).toBeLessThan(1e-3)
    expect(s.nodeV['n2']).toBeCloseTo(12, 2)
  })

  it('without vBreak the same kick is unphysically large', () => {
    const sim = createTransient(coil({ id: 'S1', type: 'SW', nodes: ['n2', '0'], closed: true }), 1e-5)
    for (let k = 0; k < 1000; k++) sim.step()
    sim.setParam('S1', 'closed', false)
    const s = sim.step()
    expect(!s.ok || s.nodeV['n2'] > 1000).toBe(true)
  })

  it('a clamp below the working voltage is inactive: open switch with vBreak 100 blocks 12 V', () => {
    const s = solveDC({
      elements: [
        { id: 'V1', type: 'V', nodes: ['s', '0'], value: 12 },
        { id: 'R1', type: 'R', nodes: ['s', 'n'], value: 12 },
        { id: 'S1', type: 'SW', nodes: ['n', '0'], closed: false, vBreak: 100 },
      ],
    })
    expect(s.nodeV['n']).toBeCloseTo(12, 6)
    expect(Math.abs(s.current['S1'])).toBeLessThan(1e-6)
  })

  it('NPN low-side driver on a coil with no flyback diode: Vce clamps at vBreak = 60 V', () => {
    const n = coil({ id: 'Q1', type: 'NPN', nodes: ['n2', 'b', '0'], vBreak: 60 })
    n.elements.push(
      { id: 'VB', type: 'V', nodes: ['drv', '0'], value: 5 },
      { id: 'RB', type: 'R', nodes: ['drv', 'b'], value: 220 },
    )
    const sim = createTransient(n, 1e-5)
    let s = sim.step()
    for (let k = 1; k < 1000; k++) s = sim.step()
    expect(s.current['L1']).toBeGreaterThan(0.95) // saturated: ~1 A
    sim.setParam('VB', 'value', 0)
    let peak = 0
    for (let k = 0; k < 200; k++) {
      s = sim.step()
      expect(s.ok).toBe(true)
      peak = Math.max(peak, s.extra['Q1.vce'])
    }
    expect(peak).toBeGreaterThan(60)
    expect(peak).toBeLessThan(62)
    expect(Math.abs(s.current['L1'])).toBeLessThan(1e-3)
  })

  it('NMOS with vBreak clamps Vds the same way', () => {
    const n = coil({ id: 'M1', type: 'NMOS', nodes: ['n2', 'g', '0'], vBreak: 40, k: 5 })
    n.elements.push({ id: 'VG', type: 'V', nodes: ['g', '0'], value: 10 })
    const sim = createTransient(n, 1e-5)
    for (let k = 0; k < 1000; k++) sim.step()
    sim.setParam('VG', 'value', 0)
    let peak = 0
    for (let k = 0; k < 200; k++) peak = Math.max(peak, sim.step().extra['M1.vds'])
    expect(peak).toBeGreaterThan(40)
    expect(peak).toBeLessThan(42)
  })
})

describe('zener dynamic resistance', () => {
  it('rz keeps vz at 5 mA exactly', () => {
    const s = solveDC({
      elements: [
        { id: 'I1', type: 'I', nodes: ['0', 'k'], value: 0.005 },
        { id: 'Z1', type: 'ZENER', nodes: ['0', 'k'], vz: 5.1, rz: 10 },
      ],
    })
    expect(s.nodeV['k']).toBeCloseTo(5.1, 6)
  })

  it('12 V through 130 Ω into a 5.1 V / 10 Ω zener: V ≈ vz + (I - 5 mA)·rz ≈ 5.548 V', () => {
    // asymptote V = vz + i·rz + u0, u0 = -0.02·ln(e^(0.05/0.02) - 1) = -0.0483 V
    // 130·i = 12 - (5.1 - 0.0483 + 10·i)  =>  i = 49.63 mA, V = 5.548 V
    const s = solveDC({
      elements: [
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 12 },
        { id: 'R1', type: 'R', nodes: ['a', 'k'], value: 130 },
        { id: 'Z1', type: 'ZENER', nodes: ['0', 'k'], vz: 5.1, rz: 10 },
      ],
    })
    expect(s.ok).toBe(true)
    expect(s.nodeV['k']).toBeGreaterThan(5.545)
    expect(s.nodeV['k']).toBeLessThan(5.551)
    expect(s.current['Z1']).toBeCloseTo(-(12 - s.nodeV['k']) / 130, 9)
  })

  it('soft knee: well below vz the zener draws almost nothing', () => {
    const s = solveDC({
      elements: [
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 4 },
        { id: 'R1', type: 'R', nodes: ['a', 'k'], value: 1000 },
        { id: 'Z1', type: 'ZENER', nodes: ['0', 'k'], vz: 5.1, rz: 10 },
      ],
    })
    expect(s.nodeV['k']).toBeCloseTo(4, 4)
  })
})
