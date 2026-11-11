import { describe, expect, it } from 'vitest'
import { createBench, type Bench } from '../bench/simLoop'
import type { Element, Lesson } from '../types'
import { applyDeadzone, behavior, type HidView, quadDelta, quantize } from './usb-hid'

const FRAME = 1 / 60

/** a 2 × 2 corner of a row/column matrix: key at (row r, col c), diode column → row */
function key(id: string, row: string, col: string): Element[] {
  return [
    { id: `sw_${id}`, type: 'SW', nodes: [col, `${id}_m`], closed: false },
    { id: `d_${id}`, type: 'D', nodes: [`${id}_m`, row] },
  ]
}

const lesson: Lesson = {
  id: 'hid-fixture',
  fig: 1,
  track: 'T4',
  title: 'HID',
  subtitle: '',
  tagline: '',
  board: { name: 'H', size: [4, 4], parts: [{ id: 'p', kind: 'potentiometer', pos: [0, 0], mount: 'tht', role: 'p', circuitIds: ['POT'] }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['5v', '0'], value: 5 },
      // axis 1: a 10 kΩ pot into a 1 MΩ ‖ 100 nF input
      { id: 'POT', type: 'POT', nodes: ['0', 'w', '5v'], value: 10000, pos: 0.5 },
      { id: 'RW', type: 'R', nodes: ['w', 'ax1'], value: 0.05 },
      { id: 'RIN', type: 'R', nodes: ['ax1', '0'], value: 1e6 },
      { id: 'CIN', type: 'C', nodes: ['ax1', '0'], value: 100e-9 },
      // matrix: rows driven low one at a time, columns pulled up
      { id: 'scan_r1', type: 'SW', nodes: ['row1', '0'], closed: true },
      { id: 'scan_r2', type: 'SW', nodes: ['row2', '0'], closed: false },
      { id: 'pu1', type: 'R', nodes: ['5v', 'col1'], value: 10000 },
      { id: 'pu2', type: 'R', nodes: ['5v', 'col2'], value: 10000 },
      { id: 'pu3', type: 'R', nodes: ['5v', 'col3'], value: 10000 },
      { id: 'pu4', type: 'R', nodes: ['5v', 'col4'], value: 10000 },
      ...key('k1', 'row1', 'col1'),
      ...key('k2', 'row1', 'col2'),
      ...key('k7', 'row2', 'col1'),
      ...key('k8', 'row2', 'col2'),
      // encoder A / B on row 1, columns 3 and 4 (buttons 3 and 4)
      { id: 'enc_a', type: 'SW', nodes: ['col3', 'ea_m'], closed: false },
      { id: 'd_ea', type: 'D', nodes: ['ea_m', 'row1'] },
      { id: 'enc_b', type: 'SW', nodes: ['col4', 'eb_m'], closed: false },
      { id: 'd_eb', type: 'D', nodes: ['eb_m', 'row1'] },
    ],
  },
  powerElementId: 'V1',
  readouts: [{ label: 'AX1', source: { kind: 'behavior', key: 'hid.ax1' }, unit: 'counts' }],
  failures: [
    {
      id: 'no-d7',
      label: 'no diode on 7',
      explain: '',
      patches: [
        { op: 'remove', elementId: 'd_k7' },
        { op: 'add', element: { id: 'd_k7_wire', type: 'R', nodes: ['k7_m', 'row2'], value: 0.01 } },
      ],
    },
  ],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  behaviors: [
    {
      id: 'usb-hid',
      instance: 'hid',
      params: {
        axes: 'ax1',
        axisNames: 'X',
        refNode: '5v',
        bits: 12,
        rows: 'scan_r1,scan_r2',
        cols: 'col1,col2,col3,col4',
        keys: 'sw_k1,sw_k2,sw_k7,sw_k8',
        keyButtons: '1,2,7,8',
        encPair: 3,
        encA: 'enc_a',
        encB: 'enc_b',
        seed: 3,
      },
    },
  ],
}

function bench(): Bench {
  const b = createBench(lesson, { registry: { 'usb-hid': behavior } })
  b.dispatch('power')
  return b
}
async function run(b: Bench, sec: number) {
  for (let i = 0; i < Math.round(sec / FRAME); i++) await b.frame(FRAME)
}
const pub = (b: Bench, k: string) => b.snapshot().published[`hid.${k}`]

describe('usb-hid pure helpers', () => {
  it('quantises a voltage against its reference to 2^bits codes, floored and clamped', () => {
    expect(quantize(2.5, 5, 12)).toBe(2048)
    expect(quantize(0, 5, 12)).toBe(0)
    expect(quantize(5, 5, 12)).toBe(4095)
    expect(quantize(5.3, 5, 12)).toBe(4095)
    expect(quantize(-0.2, 5, 12)).toBe(0)
    expect(quantize(1.0, 5, 12)).toBe(819) // 0.2 × 4096 = 819.2
    expect(quantize(2.5, 5, 10)).toBe(512) // a 10-bit ATmega32U4 ADC
    expect(quantize(1, 0, 12)).toBe(0) // no reference: nothing to measure against
  })

  it('applies a deadzone at the bottom of a 0..100 % axis and rescales the rest', () => {
    expect(applyDeadzone(3, 5)).toBe(0)
    expect(applyDeadzone(5, 5)).toBe(0)
    expect(applyDeadzone(100, 5)).toBe(100)
    expect(applyDeadzone(52.5, 5)).toBeCloseTo(50, 6)
    expect(applyDeadzone(40, 0)).toBe(40)
  })

  it('decodes quadrature (A, B as a 2-bit state): +1 forward, −1 back, 0 for no change or a skipped state', () => {
    // forward Gray sequence 00 → 01 → 11 → 10 → 00 (B leads... the order only defines the sign)
    expect(quadDelta(0b00, 0b01)).toBe(1)
    expect(quadDelta(0b01, 0b11)).toBe(1)
    expect(quadDelta(0b11, 0b10)).toBe(1)
    expect(quadDelta(0b10, 0b00)).toBe(1)
    expect(quadDelta(0b01, 0b00)).toBe(-1)
    expect(quadDelta(0b00, 0b10)).toBe(-1)
    expect(quadDelta(0b00, 0b00)).toBe(0)
    expect(quadDelta(0b00, 0b11)).toBe(0) // two contacts changed at once: invalid, ignored
  })
})

describe('usb-hid behavior on a bench', () => {
  it('samples the axis node and quantises it at 12 bits: a 50 % pot reads ≈ 2043 (1 MΩ input load)', async () => {
    const b = bench()
    await run(b, 0.3)
    const raw = pub(b, 'ax1')
    // wiper 2.5 V behind 2.5 kΩ into 1 MΩ: 2.4938 V → ⌊0.49875 × 4096⌋ = 2042..2043
    expect(raw).toBeGreaterThanOrEqual(2040)
    expect(raw).toBeLessThanOrEqual(2046)
    expect(pub(b, 'ax1_v')).toBeCloseTo(2.494, 2)
    expect(pub(b, 'ax1_pct')).toBeCloseTo(49.9, 0)
    b.dispose()
  })

  it('reports at 500 Hz', async () => {
    const b = bench()
    await run(b, 1.2)
    expect(pub(b, 'report_hz')).toBeGreaterThan(450)
    expect(pub(b, 'report_hz')).toBeLessThan(550)
    b.dispose()
  })

  it('scans the matrix: keys 1, 7 and 8 held read as exactly those three buttons with the diodes fitted', async () => {
    const b = bench()
    for (const k of ['k1', 'k3', 'k4']) b.setTweak(`behavior:hid.${k}`, 1) // keys list index: 1 → B1, 3 → B7, 4 → B8
    await run(b, 0.2)
    expect(pub(b, 'b1')).toBe(1)
    expect(pub(b, 'b7')).toBe(1)
    expect(pub(b, 'b8')).toBe(1)
    expect(pub(b, 'b2')).toBe(0)
    expect(pub(b, 'buttons_down')).toBe(3)
    expect(pub(b, 'ghosts')).toBe(0)
    b.dispose()
  })

  it('ghosts without B7\'s diode: holding B1, B7 and B8 also reports B2, which nobody pressed', async () => {
    const b = bench()
    b.dispatch('break:no-d7')
    for (const k of ['k1', 'k3', 'k4']) b.setTweak(`behavior:hid.${k}`, 1)
    await run(b, 0.2)
    expect(pub(b, 'b2')).toBe(1)
    expect(pub(b, 'buttons_down')).toBe(4)
    expect(pub(b, 'ghosts')).toBe(1)
    const view = b.behaviorData('hid') as HidView
    expect(view.buttons.find((x) => x.n === 2)).toMatchObject({ on: true, ghost: true })
    b.dispose()
  })

  it('two keys never ghost, even without the diode', async () => {
    const b = bench()
    b.dispatch('break:no-d7')
    for (const k of ['k1', 'k3']) b.setTweak(`behavior:hid.${k}`, 1)
    await run(b, 0.2)
    expect(pub(b, 'buttons_down')).toBe(2)
    expect(pub(b, 'ghosts')).toBe(0)
    b.dispose()
  })

  it('decodes the encoder pair from the scan: one click each way is one step, reported as a short press of 3 or 4', async () => {
    const b = bench()
    await run(b, 0.1)
    let saw3 = false
    let saw4 = false
    b.setTweak('behavior:hid.cw', 1)
    for (let i = 0; i < 8; i++) {
      await b.frame(FRAME)
      saw3 ||= pub(b, 'b3') === 1
    }
    b.setTweak('behavior:hid.cw', 0)
    await run(b, 0.2)
    expect(pub(b, 'enc_steps')).toBe(1)
    expect(saw3).toBe(true)
    expect(pub(b, 'b3')).toBe(0) // the pulse ends
    b.setTweak('behavior:hid.ccw', 1)
    for (let i = 0; i < 8; i++) {
      await b.frame(FRAME)
      saw4 ||= pub(b, 'b4') === 1
    }
    b.setTweak('behavior:hid.ccw', 0)
    await run(b, 0.2)
    expect(saw4).toBe(true)
    expect(pub(b, 'enc_steps')).toBe(0)
    b.dispose()
  })

  it('adds pickup noise on a sampled axis when noiseMv is set: the raw count jitters by tens of counts', async () => {
    const b = createBench(lesson, { registry: { 'usb-hid': behavior }, tweaks: {} })
    b.setTweak('behavior:hid.noiseMv', 40)
    b.dispatch('power')
    await run(b, 0.2)
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i < 60; i++) {
      await b.frame(FRAME)
      const r = pub(b, 'ax1')
      lo = Math.min(lo, r)
      hi = Math.max(hi, r)
    }
    expect(hi - lo).toBeGreaterThan(40) // ±1.5σ of 33 counts
    b.dispose()
  })

  it('exposes a controller view with the descriptor lines and an illustrative report', async () => {
    const b = bench()
    await run(b, 0.2)
    const v = b.behaviorData('hid') as HidView
    expect(v.axes[0]).toMatchObject({ label: 'X', max: 4095 })
    expect(v.descriptor.join(' ')).toMatch(/Joystick/)
    expect(v.report.length).toBe(2 + 4) // one 16-bit axis, 32 button bits
    b.dispose()
  })
})
