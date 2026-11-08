import { describe, expect, it } from 'vitest'
import type { Element, Netlist, PinState, Solution } from '../types'
import { DEFAULT_PWM_HZ } from './pwm'
import { checkRatings, createRatingState } from './ratings'
import { solveDC } from './solve'
import { createTransient } from './transient'

// Switched PWM: with a PIN in PWM and a nonlinear device in the netlist (or a vccNode PWM pin),
// the transient cuts each step at the pin's edges (490 Hz unless the pin says otherwise) and solves
// every piece with the pin HIGH or LOW for its real duration. The solution handed out is the time
// average of those pieces over the last max(dt, period). Linear netlists keep the averaged source.

const within = (x: number, target: number, tol = 0.1) => expect(Math.abs(x - target)).toBeLessThanOrEqual(Math.abs(target) * tol)
const pwm = (level: number, pwmHz?: number): PinState => ({ mode: 'OUTPUT', level, ...(pwmHz ? { pwmHz } : {}) })
const pin = (n: number, node: string, extra: Partial<Extract<Element, { type: 'PIN' }>> = {}): Element =>
  ({ id: `P${n}`, type: 'PIN', nodes: [node, '0'], pin: n, vcc: 5, ...extra }) as Element

/** run a transient with fixed pins for `steps` steps and return the last solution */
function settle(n: Netlist, pins: Record<number, PinState>, steps = 50, dt = 1e-3): Solution {
  const sim = createTransient(n, dt)
  for (const [p, s] of Object.entries(pins)) sim.setPin(Number(p), s)
  let s!: Solution
  for (let k = 0; k < steps; k++) s = sim.step()
  expect(s.ok).toBe(true)
  return s
}
/** the largest / smallest value of `read` over the pieces of a switched solution */
const peak = (s: Solution, read: (x: Solution) => number) => Math.max(...s.phases!.map((p) => read(p.solution)))
const trough = (s: Solution, read: (x: Solution) => number) => Math.min(...s.phases!.map((p) => read(p.solution)))

// pin 9 (25 Ω output) → 220 Ω → red LED
const ledNet = (): Netlist => ({
  elements: [
    pin(9, 'p'),
    { id: 'R1', type: 'R', nodes: ['p', 'a'], value: 220 },
    { id: 'D1', type: 'LED', nodes: ['a', '0'], color: 'red' },
  ],
})

describe('PWM into an LED', () => {
  // full on: (5 − 1.8)/(220 + 25) ≈ 13.1 mA. Averaging the source would put 2.5 V on the chain:
  // (2.5 − ≈1.7)/245 ≈ 3 mA or less, far from half of full-on.
  it('full duty: (5 − 1.8)/(220 + 25) ≈ 13.1 mA, with no switching', () => {
    const s = settle(ledNet(), { 9: pwm(1) })
    within(s.current['D1'], 0.0131)
    expect(s.phases).toBeUndefined()
  })

  it('50 % duty averages to about half the full-on current (±10 %), at any dt', () => {
    const full = settle(ledNet(), { 9: pwm(1) }).current['D1']
    for (const dt of [1e-5, 1e-4, 1e-3, 1e-2]) {
      const s = settle(ledNet(), { 9: pwm(0.5) }, Math.round(0.05 / dt), dt)
      within(s.current['D1'], full / 2)
      expect(s.currentOf!('D1')).toBeCloseTo(s.current['D1'], 12)
      // the pieces are full-on and off
      within(peak(s, (x) => x.current['D1']), full, 0.01)
      expect(Math.abs(trough(s, (x) => x.current['D1']))).toBeLessThan(1e-6)
      expect(s.phases!.reduce((a, p) => a + p.weight, 0)).toBeCloseTo(1, 9)
      // the averaged pin voltage still reads as a DMM would show it
      within(s.nodeV['p'], (5 - 25 * full) / 2, 0.02)
    }
  })

  it('25 % duty gives a quarter of the full-on current; the DC operating point blends by duty', () => {
    const full = settle(ledNet(), { 9: pwm(1) }).current['D1']
    within(settle(ledNet(), { 9: pwm(0.25) }).current['D1'], full / 4)
    within(solveDC(ledNet(), { pins: { 9: pwm(0.25) } }).current['D1'], full / 4)
  })

  it('edges land at their real times: 490 Hz at dt = 0.1 ms is ≈ 10 steps HIGH, then ≈ 10 LOW', () => {
    const sim = createTransient(ledNet(), 1e-4)
    sim.setPin(9, pwm(0.5))
    const lit: boolean[] = []
    for (let k = 0; k < 41; k++) {
      sim.step()
      lit.push(sim.peek(1e-7).current['D1'] > 0.005)
    }
    const T = 1 / DEFAULT_PWM_HZ
    for (let k = 0; k < 41; k++) {
      const ph = (((k + 1) * 1e-4) / T) % 1 // phase at the end of step k
      if (ph > 0.05 && ph < 0.45) expect(lit[k]).toBe(true)
      if (ph > 0.55 && ph < 0.95) expect(lit[k]).toBe(false)
    }
  })

  it('peek commits nothing and averages over its own interval', () => {
    const sim = createTransient(ledNet(), 1e-3)
    sim.setPin(9, pwm(1))
    for (let k = 0; k < 5; k++) sim.step()
    const full = sim.lastGood!.current['D1']
    const t0 = sim.t
    sim.setPin(9, pwm(0.5))
    within(sim.peek(1 / DEFAULT_PWM_HZ).current['D1'], full / 2, 0.02)
    expect(sim.t).toBe(t0)
    expect(sim.lastGood!.current['D1']).toBeCloseTo(full, 12)
  })

  it('edge substeps switch too, and the step still averages over the period', () => {
    const sim = createTransient(ledNet(), 1e-3, { edgeSubsteps: 4 })
    sim.setPin(9, pwm(1))
    for (let k = 0; k < 5; k++) sim.step()
    const full = sim.lastGood!.current['D1']
    sim.setPin(9, pwm(0.5))
    let s = sim.step()
    expect(sim.substeps).toHaveLength(3)
    for (let k = 0; k < 10; k++) s = sim.step()
    within(s.current['D1'], full / 2)
  })

  it('power is the time average of the per-piece powers, not V̄·Ī', () => {
    const s = settle(ledNet(), { 9: pwm(0.5) })
    let pR = 0
    for (const p of s.phases!) pR += p.weight * p.solution.power['R1']
    expect(s.power['R1']).toBeCloseTo(pR, 12)
    expect(s.powerOf!('R1')).toBeCloseTo(pR, 12)
    // V̄·Ī would be a quarter of the HIGH-state power; the true mean is half
    within(s.power['R1'], peak(s, (x) => x.power['R1']) / 2, 0.02)
  })
})

describe('PWM into an NPN switch', () => {
  // 5 V → 1 kΩ → collector; pin → 47 kΩ → base. HIGH: Ib = (5 − 0.65)/47 025 ≈ 92 µA, β·Ib ≈ 9 mA
  // exceeds (5 − 0.1)/1 kΩ ≈ 4.9 mA, so Q1 saturates. The 2.5 V average would give Ib ≈ 40 µA,
  // Ic ≈ 4 mA at Vce ≈ 1 V: the linear region, ≈ 4 mW in Q1.
  const npn = (): Netlist => ({
    elements: [
      { id: 'VC', type: 'V', nodes: ['vcc', '0'], value: 5 },
      { id: 'RC', type: 'R', nodes: ['vcc', 'c'], value: 1000 },
      { id: 'Q1', type: 'NPN', nodes: ['c', 'b', '0'] },
      { id: 'RB', type: 'R', nodes: ['p', 'b'], value: 47000 },
      pin(9, 'p'),
    ],
  })

  it('saturates during HIGH; average Ic ≈ d·Ic(sat) and Q1 power ≈ d·P(sat)', () => {
    const sat = settle(npn(), { 9: pwm(1) })
    within(sat.extra['Q1.ic'], 0.0049, 0.03)
    expect(sat.extra['Q1.vce']).toBeLessThan(0.3)
    const s = settle(npn(), { 9: pwm(0.5) })
    expect(trough(s, (x) => x.extra['Q1.vce'])).toBeLessThan(0.3)
    within(s.extra['Q1.ic'], 0.5 * sat.extra['Q1.ic'], 0.05)
    within(s.current['Q1'], 0.5 * sat.current['Q1'], 0.05)
    within(s.power['Q1'], 0.5 * sat.power['Q1'], 0.1)
    expect(s.power['Q1']).toBeLessThan(1e-3) // the linear-region answer is ≈ 4 mW
  })
})

describe('PWM into an RC filter', () => {
  // pin → 1 kΩ → 10 µF (τ = 10 ms ≫ the 2 ms period): the capacitor settles at duty × 5 V
  const rc = (withDiode: boolean): Netlist => ({
    elements: [
      pin(9, 'p'),
      { id: 'R1', type: 'R', nodes: ['p', 'c'], value: 1000 },
      { id: 'C1', type: 'C', nodes: ['c', '0'], value: 10e-6 },
      // an unrelated diode branch makes the netlist nonlinear, forcing the switched path
      ...(withDiode
        ? ([
            { id: 'V2', type: 'V', nodes: ['v2', '0'], value: 3 },
            { id: 'R2', type: 'R', nodes: ['v2', 'd'], value: 1000 },
            { id: 'D2', type: 'D', nodes: ['d', '0'] },
          ] as Element[])
        : []),
    ],
  })

  it('a linear netlist keeps the averaged source (no switching) and settles at 2.5 V', () => {
    const s = settle(rc(false), { 9: pwm(0.5) }, 1000, 1e-4)
    expect(s.phases).toBeUndefined()
    within(s.nodeV['c'], 2.5, 0.001)
  })

  it('the switched path gives the same average capacitor voltage, plus a real ripple', () => {
    for (const dt of [1e-4, 1e-3]) {
      const s = settle(rc(true), { 9: pwm(0.3) }, Math.round(0.15 / dt), dt)
      within(s.nodeV['c'], 1.5, 0.01)
      // ripple ≈ 5 V · d(1 − d) · T/τ ≈ 0.21 V peak to peak
      const ripple = peak(s, (x) => x.nodeV['c']) - trough(s, (x) => x.nodeV['c'])
      expect(ripple).toBeGreaterThan(0.1)
      expect(ripple).toBeLessThan(0.3)
    }
  })
})

describe('PWM into a motor through a transistor', () => {
  // 6 V → motor (2.5 Ω, 0.5 mH: L/R = 200 µs, far shorter than the ≈ 1 ms HIGH and LOW intervals
  // at 490 Hz) → NPN low side, flyback diode across the motor. Pin → 470 Ω → base: Ib ≈ 9 mA, so
  // Q1 saturates whenever the pin is HIGH. ke = kt = 5.4 mV/(rad/s), b = 8e-7 N·m·s, 1.75 mN·m load.
  // The current is discontinuous: it reaches (5.9 V − E)/R early in each HIGH and decays through
  // the diode to zero early in each LOW, so the average current is ≈ d·(5.9 − E)/R less the rise,
  // plus the decay. ω settles where kt·Ī = load + b·ω, ≈ 0.4 A: E ≈ 2.8 V, ω ≈ 520 rad/s.
  // A run that resolves every edge (dt = 2 µs, 1000 steps per period) settles at 512 rad/s.
  // The old per-step blend gave 604 / 1018 / 1116 rad/s at dt = 10 µs / 100 µs / 1 ms.
  const motor = (diode: boolean, load = 1.75e-3): Netlist => ({
    elements: [
      { id: 'VM', type: 'V', nodes: ['vm', '0'], value: 6 },
      { id: 'M1', type: 'MOTOR', nodes: ['vm', 'c'], r: 2.5, l: 5e-4, ke: 0.0054, j: 3e-7, b: 8e-7, load },
      ...(diode ? ([{ id: 'D1', type: 'D', nodes: ['c', 'vm'] }] as Element[]) : []),
      { id: 'Q1', type: 'NPN', nodes: ['c', 'b', '0'], vBreak: 60 },
      { id: 'RB', type: 'R', nodes: ['p', 'b'], value: 470 },
      pin(9, 'p'),
    ],
  })

  for (const dt of [1e-5, 1e-4, 1e-3])
    it(`ω ≈ 520 rad/s within 10 % at dt = ${dt}`, () => {
      const s = settle(motor(true), { 9: pwm(0.5) }, Math.round(1 / dt), dt)
      within(s.extra['M1.omega'], 520)
      // Q1 is switched on in the HIGH pieces (it leaves hard saturation near the ≈ 1.2 A peak)
      expect(trough(s, (x) => x.extra['Q1.vce'])).toBeLessThan(1.5)
    })

  // Without the diode the winding current can't freewheel: each LOW the switch opens, the kick is
  // clamped at vBreak and the current stops; each HIGH it rises again with τ = 200 µs. A per-step
  // blend drove the average current to 0 as dt shrank; switched, it doesn't depend on dt. (A light
  // 0.5 mN·m load: near the 1.75 mN·m stall knee a 1 ms piece's backward-Euler rise error moves ω
  // by ≈ 25 %, which is integration accuracy, not the PWM model.)
  it('without a flyback diode the current and speed do not collapse as dt shrinks', () => {
    const runs = [1e-5, 1e-4, 1e-3].map((dt) => settle(motor(false, 5e-4), { 9: pwm(0.5) }, Math.round(1 / dt), dt))
    for (const s of runs) {
      expect(s.current['M1']).toBeGreaterThan(0.15)
      within(s.current['M1'], runs[0].current['M1'], 0.2) // readout: end-of-piece samples at coarse dt
      within(s.extra['M1.omega'], runs[0].extra['M1.omega'], 0.02)
    }
  })
})

describe('PWM on a PIN with vccNode', () => {
  const rail = (load: boolean): Netlist => ({
    elements: [
      { id: 'VR', type: 'V', nodes: ['rail', '0'], value: 5 },
      pin(9, 'p', { vccNode: 'rail' }),
      ...(load
        ? ([
            { id: 'R1', type: 'R', nodes: ['p', 'a'], value: 220 },
            { id: 'D1', type: 'LED', nodes: ['a', '0'], color: 'red' },
          ] as Element[])
        : []),
    ],
  })

  it('an unloaded pin draws no phantom shoot-through from the rail (averaging drew g·d(1−d)·5 = 50 mA)', () => {
    const s = settle(rail(false), { 9: pwm(0.5) })
    expect(Math.abs(s.current['VR'])).toBeLessThan(1e-6)
    within(s.nodeV['p'], 2.5, 0.02)
  })

  it('a loaded pin draws d × the full-on load current from the rail', () => {
    const full = settle(rail(true), { 9: pwm(1) })
    const s = settle(rail(true), { 9: pwm(0.5) })
    within(-s.current['VR'], -0.5 * full.current['VR'], 0.02)
    within(s.current['D1'], 0.5 * full.current['D1'], 0.02)
  })

  it('DC: the same, from the operating point', () => {
    expect(Math.abs(solveDC(rail(false), { pins: { 9: pwm(0.5) } }).current['VR'])).toBeLessThan(1e-6)
  })

  it('a blended mode flag reads the fraction of time in that mode', () => {
    // a 5 mA current-limited rail: the 13 mA LED pulls it into current limit only while HIGH
    const n: Netlist = {
      elements: rail(true).elements.map((e) => (e.id === 'VR' ? { ...e, iLimit: 0.005 } : e)) as Element[],
    }
    const s = settle(n, { 9: pwm(0.5) })
    const cc = s.extra['VR.cc']
    expect(cc).toBeGreaterThan(0)
    within(cc, 0.5, 0.05)
  })
})

describe('several PWM pins', () => {
  // pins 5 and 6, one LED each. Same frequency: rising edges aligned at every period start.
  const two = (): Netlist => ({
    elements: [
      pin(5, 'p5'),
      { id: 'R5', type: 'R', nodes: ['p5', 'a5'], value: 220 },
      { id: 'D5', type: 'LED', nodes: ['a5', '0'], color: 'red' },
      pin(6, 'p6'),
      { id: 'R6', type: 'R', nodes: ['p6', 'a6'], value: 220 },
      { id: 'D6', type: 'LED', nodes: ['a6', '0'], color: 'red' },
    ],
  })

  it('each LED averages its own duty × full-on current, aligned or on different frequencies', () => {
    const full = settle(two(), { 5: pwm(1), 6: pwm(1) }).current['D5']
    for (const hz of [490, 980]) {
      const s = settle(two(), { 5: pwm(0.25), 6: pwm(0.75, hz) })
      within(s.current['D5'], 0.25 * full, 0.03)
      within(s.current['D6'], 0.75 * full, 0.03)
    }
  })

  it('servo pins (servoDeg) and full / zero levels do not switch', () => {
    expect(settle(two(), { 5: pwm(1), 6: pwm(0) }).phases).toBeUndefined()
    expect(settle(two(), { 5: { mode: 'OUTPUT', level: 0.5, servoDeg: 90 } }).phases).toBeUndefined()
  })
})

describe('ratings on a switched PWM solution', () => {
  it('maxV sees the HIGH-state peak, also in instantOnly checks', () => {
    const n: Netlist = {
      elements: [...ledNet().elements, { id: 'RV', type: 'R', nodes: ['p', '0'], value: 1e6, rating: { maxV: 4 } }],
    }
    const s = settle(n, { 9: pwm(0.5) })
    expect(s.nodeV['p']).toBeLessThan(4) // the average is under the limit
    const ev = checkRatings(n, s, 0.05, createRatingState(), { instantOnly: true })
    expect(ev.map((e) => [e.elementId, e.reason])).toEqual([['RV', 'overvoltage']])
    expect(checkRatings(n, s, 0.05, createRatingState()).map((e) => e.elementId)).toEqual(['RV'])
  })

  // 13 mA peak at 50 %: average 6.5 mA, RMS 9.3 mA
  const rated = (id: string) => ({
    elements: ledNet().elements.map((e) => (e.id === id ? { ...e, rating: { maxI: id === 'D1' ? 0.012 : 0.008 } } : e)),
  })
  const fire = (n: Netlist) => {
    const s = settle(n, { 9: pwm(0.5) })
    const st = createRatingState()
    checkRatings(n, s, 0, st)
    return { s, ev: checkRatings(n, s, 0.5, st) }
  }

  it('an LED (and a PIN) maxI is instantaneous: the 13 mA pulses exceed 12 mA', () => {
    const { s, ev } = fire(rated('D1'))
    expect(s.current['D1']).toBeLessThan(0.012)
    expect(ev.map((e) => [e.elementId, e.reason])).toEqual([['D1', 'overcurrent']])
    within(ev[0].value, peak(s, (x) => x.current['D1']), 0.001)
  })

  it('a resistor maxI is thermal: the RMS (√d × peak) exceeds 8 mA, the average would not', () => {
    const { s, ev } = fire(rated('R1'))
    expect(s.current['R1']).toBeLessThan(0.008)
    expect(ev.map((e) => [e.elementId, e.reason])).toEqual([['R1', 'overcurrent']])
    within(ev[0].value, Math.sqrt(0.5) * peak(s, (x) => x.current['R1']), 0.02)
  })
})
