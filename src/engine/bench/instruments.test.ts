// Bench-level instruments: the scope ring filled inside the step loop (steps and edge substeps),
// the strip chart, derived and peak-hold readouts, ganged / momentary tweaks and sim speed.
import { describe, expect, it } from 'vitest'
import { lesson as ledResistor } from '../../lessons/T2/led-resistor'
import type { Lesson } from '../types'
import { createBench } from './simLoop'

const FRAME = 1 / 60

/** an RC charging from a switched 5 V source: τ = 1 kΩ × 100 µF = 0.1 s */
function rcLesson(over: Partial<Lesson> = {}): Lesson {
  return {
    ...(ledResistor as Lesson),
    fig: 1,
    id: 'rc',
    sketch: undefined,
    behaviors: undefined,
    statusLines: [],
    board: { name: 'RC', size: [4, 4], parts: [{ id: 'c1', kind: 'capacitor-ceramic', pos: [0, 0], mount: 'tht', role: 'c', circuitIds: ['C1'] }] },
    circuit: {
      elements: [
        { id: 'V1', type: 'V', nodes: ['in', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['in', 'out'], value: 1000 },
        { id: 'C1', type: 'C', nodes: ['out', '0'], value: 100e-6 },
        { id: 'R2', type: 'R', nodes: ['out', '0'], value: 1e6 },
        { id: 'SW', type: 'SW', nodes: ['out', 'dis'], closed: false },
        { id: 'RD', type: 'R', nodes: ['dis', '0'], value: 10 },
      ],
    },
    powerElementId: 'V1',
    readouts: [
      { label: 'VIN', source: { kind: 'voltage', node: 'in' }, unit: 'V' },
      { label: 'VOUT', source: { kind: 'voltage', node: 'out' }, unit: 'V' },
      { label: 'VR', source: { kind: 'derived', op: 'diff', of: [0, 1] }, unit: 'V' },
      { label: 'GAIN', source: { kind: 'derived', op: 'ratio', of: [1, 0] }, unit: '%' },
      { label: 'I', source: { kind: 'current', elementId: 'R1' }, unit: 'A', peak: true },
    ],
    tweaks: [],
    failures: [],
    ...over,
  }
}

describe('scope ring (sampled in the step loop)', () => {
  it('records one row per 1 ms step, keyed by sim time, for the lesson’s default channels', async () => {
    const l = rcLesson({
      instruments: { scope: { channels: [{ source: { kind: 'voltage', node: 'out' } }, { source: { kind: 'current', elementId: 'R1' } }] } },
    })
    const b = createBench(l)
    b.dispatch('power')
    for (let i = 0; i < 6; i++) await b.frame(FRAME) // 6 × 17 steps
    const r = b.scope
    expect(r.count).toBe(102)
    expect(r.time(0)).toBeCloseTo(0.001, 9)
    expect(r.lastT).toBeCloseTo(b.t, 9)
    for (let k = 1; k < r.count; k++) expect(r.time(k) - r.time(k - 1)).toBeCloseTo(0.001, 9)
    // V(out) = 5(1 − e^(−t/τ)), I = (5 − V)/1k
    const k = 49
    const tk = r.time(k)
    expect(r.value(0, k)).toBeCloseTo(5 * (1 - Math.exp(-tk / 0.1)), 1)
    expect(r.value(1, k)).toBeCloseTo((5 - r.value(0, k)) / 1000, 4)
  })

  it('samples many steps per frame, not one per frame (time-lapse ×10)', async () => {
    const l = rcLesson({ instruments: { scope: { channels: [{ source: { kind: 'voltage', node: 'out' } }] } } })
    const b = createBench(l, { speed: 10 })
    b.dispatch('power')
    await b.frame(FRAME)
    expect(b.scope.count).toBe(167)
    expect(b.scope.value(1, 0)).toBeNaN() // channel 2 off
  })

  it('setScope probes new sources (a voltage against a reference node) and clears the ring', async () => {
    const b = createBench(rcLesson())
    b.dispatch('power')
    await b.frame(FRAME)
    expect(b.scope.count).toBe(0) // nothing probed
    b.setScope([{ kind: 'voltage', node: 'in', ref: 'out' }, null])
    await b.frame(FRAME)
    expect(b.scope.count).toBe(17)
    const v = b.scope.value(0, 16)
    expect(v).toBeCloseTo(5 * Math.exp(-0.34), 1) // V(in) − V(out) after 34 ms, τ = 0.1 s
  })

  it('a split switching step puts its edge substeps in the ring, in time order', async () => {
    const l = rcLesson({
      sim: { edgeSubsteps: 6 },
      instruments: { scope: { channels: [{ source: { kind: 'voltage', node: 'out' } }] } },
      tweaks: [{ label: 'Discharge', elementId: 'SW', key: 'closed', kind: 'momentary', min: 0, max: 1, unit: '' }],
    })
    const b = createBench(l)
    b.dispatch('power')
    for (let i = 0; i < 30; i++) await b.frame(FRAME)
    const before = b.scope.count
    b.setTweak('SW.closed', 1) // 10 Ω across the cap: it dumps in µs, inside the split step
    await b.frame(FRAME)
    const r = b.scope
    // power-on step + switching step: 5 substeps each (6 − 1 are intermediate)
    expect(r.count - before).toBe(17 + 5)
    for (let k = 1; k < r.count; k++) expect(r.time(k)).toBeGreaterThan(r.time(k - 1))
    const gaps: number[] = []
    for (let k = before; k < before + 6; k++) gaps.push(r.time(k) - r.time(k - 1))
    expect(Math.min(...gaps)).toBeLessThan(2e-5) // the first substep is dt/63 ≈ 16 µs
  })
})

describe('strip chart', () => {
  it('records readout indices and inline readouts against time, decimated to the span', async () => {
    const l = rcLesson({
      instruments: { chart: { signals: [1, 2, { label: 'IN', source: { kind: 'voltage', node: 'in' }, unit: 'V' }], span: 2 } },
    })
    const b = createBench(l)
    b.dispatch('power')
    for (let i = 0; i < 60; i++) await b.frame(FRAME) // ≈ 1 s
    const c = b.chart
    expect(c.channels).toBe(3)
    // one row per ≥ 2·span/2048 ≈ 1.95 ms: about 520 rows in a second of 1 ms steps
    expect(c.count).toBeGreaterThan(450)
    expect(c.count).toBeLessThan(600)
    const k = c.count - 1
    expect(c.value(0, k) + c.value(1, k)).toBeCloseTo(5, 4) // VOUT + VR
    expect(c.value(2, k)).toBeCloseTo(5, 6)
  })
})

describe('switched PWM on the instruments', () => {
  // pin 9 (25 Ω) → 220 Ω → red LED, analogWrite 50 %: the solver cuts each step at the pin's
  // 490 Hz edges and hands out the time average; the instruments must see the pieces instead
  const pwmLesson = (): Lesson => ({
    ...(ledResistor as Lesson),
    fig: 1,
    id: 'pwm',
    behaviors: undefined,
    statusLines: [],
    board: { name: 'P', size: [4, 4], parts: [{ id: 'd1', kind: 'led', pos: [0, 0], mount: 'tht', role: 'd', circuitIds: ['D1'] }] },
    circuit: {
      elements: [
        { id: 'V_USB', type: 'V', nodes: ['usb', '0'], value: 5 },
        { id: 'P9', type: 'PIN', nodes: ['p', '0'], pin: 9, vcc: 5, rOut: 25 },
        { id: 'R1', type: 'R', nodes: ['p', 'a'], value: 220 },
        { id: 'D1', type: 'LED', nodes: ['a', '0'], color: 'red' },
      ],
    },
    powerElementId: 'V_USB',
    sketch: { title: 'PWM', code: 'void setup() {\n  pinMode(9, OUTPUT);\n  analogWrite(9, 128);\n}\nvoid loop() {}\n', pins: { 9: 'P9' }, vcc: 5, board: 'uno' },
    readouts: [
      { label: 'PIN', source: { kind: 'voltage', node: 'p' }, unit: 'V' },
      { label: 'PIN PEAK', source: { kind: 'voltage', node: 'p' }, unit: 'V', peak: true },
    ],
    tweaks: [],
    failures: [],
    instruments: { scope: { channels: [{ source: { kind: 'voltage', node: 'p' } }] } },
  })

  it('a 50 % PWM pin shows on the scope as a square wave (≈ 0 and ≈ 4.7 V, nothing at 2.5 V); peak-hold reads the HIGH level', async () => {
    const b = createBench(pwmLesson())
    b.dispatch('power')
    b.upload()
    for (let i = 0; i < 30; i++) await b.frame(FRAME)
    const t0 = b.t
    for (let i = 0; i < 10; i++) await b.frame(FRAME)
    const r = b.scope
    let lo = 0
    let hi = 0
    let mid = 0
    for (let k = r.lowerBound(t0); k < r.count; k++) {
      const v = r.value(0, k)
      if (v < 0.3) lo++
      else if (v > 4.4) hi++
      else mid++
    }
    expect(lo).toBeGreaterThan(50)
    expect(hi).toBeGreaterThan(50)
    expect(mid).toBe(0)
    // pieces are pushed at their own end times: rows stay time-ordered and finer than dt
    for (let k = r.lowerBound(t0) + 1; k < r.count; k++) expect(r.time(k)).toBeGreaterThan(r.time(k - 1))
    const s = b.snapshot()
    expect(s.values[0]).toBeGreaterThan(1.8) // the readout stays the meter-like average
    expect(s.values[0]).toBeLessThan(2.8)
    expect(s.values[1]).toBeGreaterThan(4.4) // peak-hold saw the HIGH pieces
  })
})

describe('strip chart power gaps', () => {
  it('power-off pushes a NaN row so the trace breaks across the gap', async () => {
    const b = createBench(rcLesson({ instruments: { chart: { signals: [1] } } }))
    b.dispatch('power')
    for (let i = 0; i < 10; i++) await b.frame(FRAME)
    b.dispatch('power')
    const c = b.chart
    expect(c.value(0, c.count - 1)).toBeNaN()
    expect(c.value(0, c.count - 2)).toBeGreaterThan(0)
  })
})

describe('derived and peak-hold readouts', () => {
  it('derived readouts: diff and ratio of other readouts', async () => {
    const b = createBench(rcLesson())
    b.dispatch('power')
    for (let i = 0; i < 30; i++) await b.frame(FRAME)
    const v = b.snapshot().values
    expect(v[2]).toBeCloseTo(v[0] - v[1], 9)
    expect(v[3]).toBeCloseTo(v[1] / v[0], 9)
  })

  it('peak-hold keeps the inrush current (5 mA at t=0⁺) while the live current decays; power-on resets it', async () => {
    const b = createBench(rcLesson())
    b.dispatch('power')
    for (let i = 0; i < 60; i++) await b.frame(FRAME)
    const s = b.snapshot()
    expect(s.values[4]).toBeGreaterThan(0.0045)
    expect(s.readouts[4].peak).toBe(true)
    expect(s.readouts[1].peak).toBeUndefined()
    b.resetPeaks()
    expect(b.snapshot().values[4]).toBeLessThan(0.0002) // ≈ 5 mA · e^(−10)
  })

  it('peak-hold sees a µs substep spike the frame-rate readouts never show', async () => {
    const l = rcLesson({
      sim: { edgeSubsteps: 10 },
      readouts: [{ label: 'I DIS', source: { kind: 'current', elementId: 'RD' }, unit: 'A', peak: true }],
      tweaks: [{ label: 'Discharge', elementId: 'SW', key: 'closed', kind: 'momentary', min: 0, max: 1, unit: '' }],
    })
    const b = createBench(l)
    b.dispatch('power')
    for (let i = 0; i < 60; i++) await b.frame(FRAME)
    b.setTweak('SW.closed', 1)
    for (let i = 0; i < 3; i++) await b.frame(FRAME)
    // ≈ 5 V / 10 Ω at the first µs; by the end of the step the cap has long emptied
    expect(b.snapshot().values[0]).toBeGreaterThan(0.2)
  })
})

describe('tweak kinds', () => {
  it('ganged tweaks move every linked element (×scale)', async () => {
    const l = rcLesson({
      tweaks: [
        { label: 'Both resistors', elementId: 'R1', key: 'value', min: 100, max: 1e6, log: true, unit: 'Ω', link: [{ elementId: 'R2', key: 'value', scale: 2 }] },
      ],
    })
    const b = createBench(l)
    b.setTweak('R1.value', 4700)
    const ev = b.snapshot().elementValues
    expect(ev['R1.value']).toBe(4700)
    expect(ev['R2.value']).toBe(9400)
  })

  it('toggle / enum / momentary values snap to what the control can produce', () => {
    const l = rcLesson({
      tweaks: [
        { label: 'Switch', elementId: 'SW', key: 'closed', kind: 'toggle', min: 0, max: 1, unit: '' },
        {
          label: 'R1',
          elementId: 'R1',
          key: 'value',
          kind: 'enum',
          min: 100,
          max: 10000,
          unit: 'Ω',
          options: [
            { label: '100 Ω', value: 100 },
            { label: '10 kΩ', value: 10000 },
          ],
        },
      ],
    })
    const b = createBench(l)
    b.setTweak('SW.closed', 0.8)
    b.setTweak('R1.value', 7000)
    expect(b.tweakValues()).toMatchObject({ 'SW.closed': 1, 'R1.value': 10000 })
    expect(b.tweakDefaults()).toMatchObject({ 'SW.closed': 0, 'R1.value': 1000 })
  })
})

describe('sim speed', () => {
  it('slow motion ×0.01 averages the right sim rate even though one frame is under one step', async () => {
    const b = createBench(rcLesson(), { speed: 0.01 })
    b.dispatch('power')
    for (let i = 0; i < 600; i++) await b.frame(FRAME) // 10 s real → 0.1 s sim
    expect(b.t).toBeCloseTo(0.1, 2)
    expect(b.snapshot().capped).toBe(false)
  })

  it('a stepsPerFrame cap holds a fine-dt lesson back and the snapshot says so', async () => {
    const l = rcLesson({ sim: { dt: 1e-5, stepsPerFrame: 30 } })
    const b = createBench(l)
    b.dispatch('power')
    for (let i = 0; i < 120; i++) await b.frame(FRAME) // wants 1667 steps a frame, gets 30
    const s = b.snapshot()
    expect(s.capped).toBe(true)
    expect(s.rate).toBeLessThan(0.05)
    expect(b.t).toBeCloseTo(120 * 30 * 1e-5, 6)
  })

  it('the default step cap is a whole frame of sim time, not 30 steps: a 10 µs lesson keeps up at ×1', async () => {
    const b = createBench(rcLesson({ sim: { dt: 1e-5 } }))
    b.dispatch('power')
    await b.frame(FRAME) // 1667 steps owed, all taken (no wall-clock budget headless)
    expect(b.t).toBeCloseTo(1667e-5, 9)
    expect(b.snapshot().capped).toBe(false)
  })

  it('the wall-clock step budget stops a frame early and reports capped', async () => {
    let clock = 0
    // every clock read advances 1 ms: an 8 ms budget allows about 8 steps
    const b = createBench(rcLesson({ sim: { dt: 1e-5 } }), { stepBudgetMs: 8, now: () => (clock += 1) })
    b.dispatch('power')
    await b.frame(FRAME)
    expect(b.t).toBeGreaterThan(0)
    expect(b.t).toBeLessThan(20e-5)
    expect(b.snapshot().capped).toBe(true)
  })

  it('stepsPerFrame is a cap, not a fixed count', async () => {
    const b = createBench(rcLesson({ sim: { stepsPerFrame: 5 } }), { speed: 0.1 })
    b.dispatch('power')
    await b.frame(FRAME) // 1.7 ms of sim wanted: 2 steps, under the cap
    expect(b.t).toBeCloseTo(0.002, 9)
    expect(b.snapshot().capped).toBe(false)
    b.setSpeed(1)
    await b.frame(FRAME)
    expect(b.t).toBeCloseTo(0.007, 9)
    expect(b.snapshot().capped).toBe(true)
  })

  it('time-lapse ×100 runs 100× real time when the cap allows', async () => {
    const b = createBench(rcLesson(), { speed: 100 })
    b.dispatch('power')
    for (let i = 0; i < 30; i++) await b.frame(FRAME)
    const s = b.snapshot()
    expect(s.capped).toBe(false)
    expect(s.rate).toBeGreaterThan(95)
    expect(s.speed).toBe(100)
  })
})
