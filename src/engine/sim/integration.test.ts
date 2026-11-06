import { describe, expect, it } from 'vitest'
import type { Netlist } from '../types'
import { createTransient } from './transient'

// L = 1 mH, C = 1 µF, C charged to 1 V: ω = 1/√(LC) = 31 623 rad/s, T = 198.7 µs.
const lc: Netlist = {
  elements: [
    { id: 'C1', type: 'C', nodes: ['n', '0'], value: 1e-6, v0: 1 },
    { id: 'L1', type: 'L', nodes: ['n', '0'], value: 1e-3 },
  ],
}

/** max |v(n)| over the last period after `steps` steps of 1 µs */
function lastPeriodPeak(method: 'be' | 'trap', steps: number): number {
  const sim = createTransient(lc, 1e-6, { method })
  let peak = 0
  for (let k = 0; k < steps; k++) {
    const v = sim.step().nodeV['n']
    if (k >= steps - 200) peak = Math.max(peak, Math.abs(v))
  }
  return peak
}

describe('integration method', () => {
  it('trapezoidal keeps an undamped LC ringing at full amplitude after 10 periods', () => {
    const peak = lastPeriodPeak('trap', 2000)
    expect(peak).toBeGreaterThan(0.99)
    expect(peak).toBeLessThan(1.001)
  })

  it('backward Euler damps it by (1 + (ω·dt)²)^(-n/2) = 1.001^(-n/2)', () => {
    // the first peak of the last period (steps 1800..1900) is between e^-0.90 and e^-0.95
    const peak = lastPeriodPeak('be', 2000)
    expect(peak).toBeGreaterThan(Math.exp(-0.95))
    expect(peak).toBeLessThan(Math.exp(-0.9))
  })

  it('trapezoidal rings at the analytic frequency: v(T) ≈ +1 after one period', () => {
    const sim = createTransient(lc, 1e-7, { method: 'trap' })
    const T = 2 * Math.PI * Math.sqrt(1e-9)
    let s = sim.step()
    const n = Math.round(T / 1e-7)
    for (let k = 1; k < n; k++) s = sim.step()
    expect(s.nodeV['n']).toBeGreaterThan(0.999)
    // at T/2 the inductor current had its peak magnitude 1 V·√(C/L) = 31.6 mA a quarter period in
  })

  it('trapezoidal is second-order accurate on an RC step (dt = τ/100)', () => {
    const rc: Netlist = {
      elements: [
        { id: 'V1', type: 'V', nodes: ['in', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['in', 'c'], value: 1000 },
        { id: 'C1', type: 'C', nodes: ['c', '0'], value: 1e-3 },
      ],
    }
    const exact = 1 - Math.exp(-1)
    const run = (method: 'be' | 'trap') => {
      const sim = createTransient(rc, 1e-2, { method })
      let s = sim.step()
      for (let k = 1; k < 100; k++) s = sim.step()
      return s
    }
    const trap = run('trap')
    expect(Math.abs(trap.nodeV['c'] / 5 - exact)).toBeLessThan(2e-4)
    // capacitor current from the trapezoidal companion matches the resistor current
    expect(trap.current['C1']).toBeCloseTo(trap.current['R1'], 9)
    // BE: 1 - 1.01^-100 = 0.63029, an error of 1.8e-3
    expect(Math.abs(run('be').nodeV['c'] / 5 - exact)).toBeGreaterThan(1e-3)
  })

  it('setDt changes the step mid-run; t accumulates', () => {
    const rc: Netlist = {
      elements: [
        { id: 'V1', type: 'V', nodes: ['in', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['in', 'c'], value: 1000 },
        { id: 'C1', type: 'C', nodes: ['c', '0'], value: 1e-3 },
      ],
    }
    const sim = createTransient(rc, 1e-3)
    for (let k = 0; k < 500; k++) sim.step()
    sim.setDt(5e-4)
    expect(sim.dt).toBe(5e-4)
    let s = sim.step()
    for (let k = 1; k < 1000; k++) s = sim.step()
    expect(sim.t).toBeCloseTo(1, 9)
    expect(s.nodeV['c'] / 5).toBeGreaterThan(0.62)
    expect(s.nodeV['c'] / 5).toBeLessThan(0.64)
    expect(() => sim.setDt(0)).toThrow()
  })

  it('trapezoidal restarts with one backward-Euler step after a LOGIC output edge', () => {
    const sim = createTransient(
      {
        elements: [
          { id: 'V1', type: 'V', nodes: ['i', '0'], value: 0, wave: { kind: 'sine', amp: 5, freq: 50 } },
          { id: 'U1', type: 'LOGIC', gate: 'NOT', nodes: ['i', 'y'], vcc: 5 },
          { id: 'C1', type: 'C', nodes: ['y', '0'], value: 1e-6 },
        ],
      },
      1e-4,
      { method: 'trap' },
    )
    let prev = sim.step().extra['U1.out']
    let edges = 0
    let edgeNext = false
    for (let k = 0; k < 400; k++) {
      const out = sim.step().extra['U1.out']
      if (edgeNext) expect(sim.lastStepTrap).toBe(false)
      else expect(sim.lastStepTrap).toBe(true)
      edgeNext = prev > 0.5 !== out > 0.5
      if (edgeNext) edges++
      prev = out
    }
    expect(edges).toBeGreaterThanOrEqual(4) // 50 Hz for 40 ms: two periods, two edges each
  })

  it('…and after a V current-limit mode flip', () => {
    const sim = createTransient(
      {
        elements: [
          { id: 'V1', type: 'V', nodes: ['a', '0'], value: 0, wave: { kind: 'sine', amp: 10, freq: 50 }, iLimit: 0.5 },
          { id: 'R1', type: 'R', nodes: ['a', '0'], value: 10 },
        ],
      },
      1e-4,
      { method: 'trap' },
    )
    sim.step()
    let prevCc = 0
    let flips = 0
    let flipNext = false
    for (let k = 0; k < 200; k++) {
      const cc = sim.step().extra['V1.cc']
      expect(sim.lastStepTrap).toBe(!flipNext)
      flipNext = cc !== prevCc
      if (flipNext) flips++
      prevCc = cc
    }
    // |10·sin| > 5 V (0.5 A into 10 Ω) on part of each half-cycle: enters CC once per half-cycle
    expect(flips).toBeGreaterThanOrEqual(2)
  })
})
