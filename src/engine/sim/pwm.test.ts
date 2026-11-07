import { describe, expect, it } from 'vitest'
import type { Element, Netlist, PinState, Solution } from '../types'
import { checkRatings, createRatingState } from './ratings'
import { solveDC } from './solve'
import { createTransient } from './transient'

// Duty-weighted PWM (state-space averaging): with a PIN in PWM and a nonlinear device in the
// netlist, each step is solved once with the PWM pins HIGH and once LOW from the same state,
// and the results are blended by duty. Linear netlists keep the averaged-source path.

const within = (x: number, target: number, tol = 0.1) => expect(Math.abs(x - target)).toBeLessThanOrEqual(Math.abs(target) * tol)
const pwm = (level: number): PinState => ({ mode: 'OUTPUT', level })
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
  it('full duty: (5 − 1.8)/(220 + 25) ≈ 13.1 mA', () => {
    within(settle(ledNet(), { 9: pwm(1) }).current['D1'], 0.0131)
  })

  it('50 % duty averages to about half the full-on current (±10 %), not the 2.5 V-averaged value', () => {
    const full = settle(ledNet(), { 9: pwm(1) }).current['D1']
    const s = settle(ledNet(), { 9: pwm(0.5) })
    within(s.current['D1'], full / 2)
    expect(s.currentOf!('D1')).toBeCloseTo(s.current['D1'], 12)
    // the phases are exposed for ratings: HIGH first
    expect(s.phases!.map((p) => p.weight)).toEqual([0.5, 0.5])
    within(s.phases![0].solution.current['D1'], full, 0.01)
    expect(Math.abs(s.phases![1].solution.current['D1'])).toBeLessThan(1e-6)
    // the averaged pin voltage still reads as a DMM would show it
    within(s.nodeV['p'], (5 - 25 * full) / 2, 0.02)
  })

  it('25 % duty gives a quarter of the full-on current; the DC operating point blends too', () => {
    const full = settle(ledNet(), { 9: pwm(1) }).current['D1']
    within(settle(ledNet(), { 9: pwm(0.25) }).current['D1'], full / 4)
    within(solveDC(ledNet(), { pins: { 9: pwm(0.25) } }).current['D1'], full / 4)
  })

  it('peek and edge substeps blend the states too, and peek commits nothing', () => {
    const sim = createTransient(ledNet(), 1e-3, { edgeSubsteps: 4 })
    sim.setPin(9, pwm(1))
    for (let k = 0; k < 5; k++) sim.step()
    const full = sim.lastGood!.current['D1']
    sim.setPin(9, pwm(0.5))
    const p = sim.peek(1e-4)
    within(p.current['D1'], full / 2)
    expect(sim.lastGood!.current['D1']).toBeCloseTo(full, 12)
    const s = sim.step()
    expect(sim.substeps).toHaveLength(3)
    for (const x of sim.substeps) expect(x.solution.phases).toHaveLength(2)
    within(s.current['D1'], full / 2)
  })

  it('power is the mean of the per-state powers, not V̄·Ī', () => {
    const s = settle(ledNet(), { 9: pwm(0.5) })
    const [hi, lo] = s.phases!
    const pR = 0.5 * hi.solution.power['R1'] + 0.5 * lo.solution.power['R1']
    expect(s.power['R1']).toBeCloseTo(pR, 12)
    expect(s.powerOf!('R1')).toBeCloseTo(pR, 12)
    // V̄·Ī would be a quarter of the HIGH-state power; the true mean is half
    within(s.power['R1'], hi.solution.power['R1'] / 2, 0.01)
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
    expect(s.phases![0].solution.extra['Q1.vce']).toBeLessThan(0.3)
    within(s.extra['Q1.ic'], 0.5 * sat.extra['Q1.ic'], 0.05)
    within(s.current['Q1'], 0.5 * sat.current['Q1'], 0.05)
    within(s.power['Q1'], 0.5 * sat.power['Q1'], 0.1)
    expect(s.power['Q1']).toBeLessThan(1e-3) // the linear-region answer is ≈ 4 mW
  })
})

describe('PWM into an RC filter', () => {
  // pin → 1 kΩ → 10 µF (τ = 10 ms): the capacitor settles at duty × 5 V either way
  const rc = (withDiode: boolean): Netlist => ({
    elements: [
      pin(9, 'p'),
      { id: 'R1', type: 'R', nodes: ['p', 'c'], value: 1000 },
      { id: 'C1', type: 'C', nodes: ['c', '0'], value: 10e-6 },
      // an unrelated diode branch makes the netlist nonlinear, forcing the two-state path
      ...(withDiode
        ? ([
            { id: 'V2', type: 'V', nodes: ['v2', '0'], value: 3 },
            { id: 'R2', type: 'R', nodes: ['v2', 'd'], value: 1000 },
            { id: 'D2', type: 'D', nodes: ['d', '0'] },
          ] as Element[])
        : []),
    ],
  })

  it('a linear netlist keeps the averaged source (no phases) and settles at 2.5 V', () => {
    const s = settle(rc(false), { 9: pwm(0.5) }, 1000, 1e-4)
    expect(s.phases).toBeUndefined()
    within(s.nodeV['c'], 2.5, 0.001)
  })

  it('the two-state path gives the same averaged capacitor voltage, step by step', () => {
    const a = createTransient(rc(false), 1e-4)
    const b = createTransient(rc(true), 1e-4)
    a.setPin(9, pwm(0.3))
    b.setPin(9, pwm(0.3))
    for (let k = 0; k < 1000; k++) {
      const sa = a.step()
      const sb = b.step()
      expect(sb.phases).toHaveLength(2)
      expect(sb.nodeV['c']).toBeCloseTo(sa.nodeV['c'], 7)
      expect(sb.current['C1']).toBeCloseTo(sa.current['C1'], 9)
    }
    within(b.lastGood!.nodeV['c'], 1.5, 0.01)
  })
})

describe('PWM into a motor through a transistor', () => {
  // 12 V → motor (2 Ω, 0.2 H: the current falls only 6 V·1 ms/0.2 H = 30 mA in a LOW interval,
  // so it stays continuous through the diode) → NPN low side,
  // flyback diode across the motor, 0.002 N·m load (0.2 A at kt = 0.01). Pin → 470 Ω → base:
  // Ib ≈ 8.6 mA, β·Ib ≈ 0.86 A ≫ 0.2 A, so Q1 saturates whenever the pin is HIGH.
  // Averaged-voltage answer: ω = (d·12 − I·R)/ke = (6 − 0.4)/0.01 = 560 rad/s; during LOW the
  // diode's ≈ 0.7 V adds −0.35 V on average (≈ 525 rad/s), inside 10 %.
  // The averaged pin (2.5 V) would saturate Q1 continuously: ω ≈ (12 − 0.4)/0.01 ≈ 1160 rad/s.
  const motor = (): Netlist => ({
    elements: [
      { id: 'VM', type: 'V', nodes: ['vm', '0'], value: 12 },
      { id: 'M1', type: 'MOTOR', nodes: ['vm', 'c'], r: 2, l: 0.2, ke: 0.01, j: 1e-5, load: 0.002 },
      { id: 'D1', type: 'D', nodes: ['c', 'vm'] },
      { id: 'Q1', type: 'NPN', nodes: ['c', 'b', '0'] },
      { id: 'RB', type: 'R', nodes: ['p', 'b'], value: 470 },
      pin(9, 'p'),
    ],
  })

  it('ω matches the averaged-voltage result within 10 %', () => {
    const ref: Netlist = {
      elements: [
        { id: 'VM', type: 'V', nodes: ['vm', '0'], value: 6 },
        { id: 'M1', type: 'MOTOR', nodes: ['vm', '0'], r: 2, l: 0.2, ke: 0.01, j: 1e-5, load: 0.002 },
      ],
    }
    const wRef = settle(ref, {}, 2000).extra['M1.omega']
    within(wRef, 560, 0.02)
    const s = settle(motor(), { 9: pwm(0.5) }, 2000)
    within(s.extra['M1.omega'], wRef)
    within(s.current['M1'], 0.2, 0.05) // the load current, continuous through the diode
    expect(s.phases![0].solution.extra['Q1.vce']).toBeLessThan(0.3)
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
    within(s.nodeV['p'], 2.5, 0.001)
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
})

describe('several PWM pins: phases aligned at the period start', () => {
  // pins 5 (25 %) and 6 (75 %), one LED each. Aligned rising edges give three intervals:
  // [0, 0.25) both HIGH, [0.25, 0.75) only pin 6, [0.75, 1) both LOW.
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

  it('each LED averages its own duty × full-on current', () => {
    const full = settle(two(), { 5: pwm(1), 6: pwm(1) }).current['D5']
    const s = settle(two(), { 5: pwm(0.25), 6: pwm(0.75) })
    expect(s.phases!.map((p) => p.weight)).toEqual([0.25, 0.5, 0.25])
    within(s.current['D5'], 0.25 * full, 0.02)
    within(s.current['D6'], 0.75 * full, 0.02)
  })

  it('pins sharing a duty need only two states', () => {
    expect(settle(two(), { 5: pwm(0.4), 6: pwm(0.4) }).phases).toHaveLength(2)
  })

  it('servo pins (servoDeg) and full / zero levels are not split', () => {
    expect(settle(two(), { 5: pwm(1), 6: pwm(0) }).phases).toBeUndefined()
    expect(settle(two(), { 5: { mode: 'OUTPUT', level: 0.5, servoDeg: 90 } }).phases).toBeUndefined()
  })
})

describe('ratings on a PWM step', () => {
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

  it('maxI compares the RMS over the states (√d × peak), not the average (d × peak)', () => {
    // 13 mA peak at 50 %: average 6.5 mA, RMS 9.3 mA; a 8 mA limit is exceeded only by the RMS
    const n: Netlist = { elements: ledNet().elements.map((e) => (e.id === 'D1' ? { ...e, rating: { maxI: 0.008 } } : e)) }
    const s = settle(n, { 9: pwm(0.5) })
    expect(s.current['D1']).toBeLessThan(0.008)
    const st = createRatingState()
    checkRatings(n, s, 0, st)
    const ev = checkRatings(n, s, 0.5, st)
    expect(ev.map((e) => [e.elementId, e.reason])).toEqual([['D1', 'overcurrent']])
    within(ev[0].value, Math.sqrt(0.5) * s.phases![0].solution.current['D1'], 0.01)
  })
})
