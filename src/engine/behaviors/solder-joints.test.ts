import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { ALLOYS, JOINT_OHMS, QUALITIES, behavior, ironWindow, solderResult, wickResult } from './solder-joints'

const OK = { alloy: 0, tipC: 350, dwellS: 3, flux: true, feed: 1 } as const

describe('joint-quality rule (solderResult)', () => {
  it('anchors: Sn63/Pb37 eutectic 183 °C, SAC305 217–220 °C, setpoints 330–370 / 350–400 °C', () => {
    expect(ALLOYS[0]).toMatchObject({ solidusC: 183, liquidusC: 183, lo: 330, hi: 370 })
    expect(ALLOYS[1]).toMatchObject({ solidusC: 217, liquidusC: 220, lo: 350, hi: 400 })
    // ±20 °C of tolerance around the typical setpoint window
    expect(ironWindow(0)).toEqual({ coldBelow: 310, hotAbove: 390 })
    expect(ironWindow(1)).toEqual({ coldBelow: 330, hotAbove: 420 })
  })

  it('a good joint: in the window, 2–5 s, with flux and the right amount of solder', () => {
    expect(solderResult(OK, 'good', false)).toBe('good')
    expect(solderResult({ ...OK, dwellS: 2 }, 'cold', false)).toBe('good')
    expect(solderResult({ ...OK, dwellS: 5 }, 'insufficient', false)).toBe('good')
    expect(solderResult({ ...OK, alloy: 1, tipC: 380 }, 'good', false)).toBe('good')
  })

  it('cold: tip too cool for the alloy, dwell under 2 s, or no flux', () => {
    expect(solderResult({ ...OK, tipC: 280 }, 'good', false)).toBe('cold')
    expect(solderResult({ ...OK, dwellS: 1 }, 'good', false)).toBe('cold')
    expect(solderResult({ ...OK, flux: false }, 'good', false)).toBe('cold')
    // a leaded setpoint on lead-free solder: 320 °C is fine for Sn63 but cold for SAC305
    expect(solderResult({ ...OK, tipC: 320 }, 'good', false)).toBe('good')
    expect(solderResult({ ...OK, alloy: 1, tipC: 320 }, 'good', false)).toBe('cold')
  })

  it('too much or too little solder: insufficient; excess on a big pad, a bridge on a fine pad', () => {
    expect(solderResult({ ...OK, feed: 0 }, 'good', false)).toBe('insufficient')
    expect(solderResult({ ...OK, feed: 2 }, 'good', false)).toBe('excess')
    expect(solderResult({ ...OK, feed: 2 }, 'good', true)).toBe('bridge')
  })

  it('overheating: too hot or over 5 s weakens the pad; a second overheat lifts it; lifted is final', () => {
    expect(solderResult({ ...OK, tipC: 450 }, 'good', false)).toBe('overheated')
    expect(solderResult({ ...OK, dwellS: 8 }, 'good', false)).toBe('overheated')
    expect(solderResult({ ...OK, tipC: 450 }, 'overheated', false)).toBe('lifted')
    expect(solderResult(OK, 'lifted', false)).toBe('lifted')
    // a good pass over an overheated joint is a good joint (the pad is still weakened, not lifted)
    expect(solderResult(OK, 'overheated', false)).toBe('good')
  })

  it('wick: takes the solder off (a bridge goes), leaving a thin film; it cannot fix a lifted pad', () => {
    expect(wickResult(OK, 'bridge')).toBe('insufficient')
    expect(wickResult(OK, 'excess')).toBe('insufficient')
    expect(wickResult(OK, 'cold')).toBe('insufficient')
    expect(wickResult(OK, 'lifted')).toBe('lifted')
    expect(wickResult({ ...OK, tipC: 450 }, 'overheated')).toBe('lifted')
  })

  it('electrical model: good ≈ 1 mΩ, insufficient 10 mΩ, cold 0.6 Ω, lifted open', () => {
    expect(JOINT_OHMS.good).toBe(0.001)
    expect(JOINT_OHMS.excess).toBe(0.001)
    expect(JOINT_OHMS.overheated).toBe(0.001)
    expect(JOINT_OHMS.insufficient).toBe(0.01)
    expect(JOINT_OHMS.cold).toBe(0.6)
    expect(JOINT_OHMS.lifted).toBeGreaterThanOrEqual(1e7)
    expect(QUALITIES.indexOf('good')).toBe(0)
    expect(QUALITIES.indexOf('lifted')).toBe(QUALITIES.length - 1)
  })
})

// A 5 V supply through a 10 Ω load and two joints in series (J1, J2), plus an LED path with joint J3
// whose neighbour pad is the LED's cathode (ground): too much solder there bridges the LED.
const lesson: Lesson = {
  id: 'sj',
  fig: 1,
  track: 'T7',
  title: 'SJ',
  subtitle: '',
  tagline: '',
  board: { name: 'S', size: [4, 4], parts: [{ id: 'r', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['RL'] }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['a', '0'], value: 5 },
      { id: 'SW_P', type: 'SW', nodes: ['a', 'b'], closed: true },
      { id: 'RL', type: 'R', nodes: ['b', 'n0'], value: 10 },
      { id: 'j1', type: 'R', nodes: ['n0', 'n1'], value: 0.001 },
      { id: 'j2', type: 'R', nodes: ['n1', '0'], value: 0.001 },
      { id: 'RLED', type: 'R', nodes: ['b', 'l5'], value: 330 },
      { id: 'j3', type: 'R', nodes: ['l5', 'l6'], value: 0.001 },
      { id: 'D', type: 'LED', nodes: ['l6', '0'], color: 'green' },
      { id: 'br3', type: 'SW', nodes: ['l6', '0'], closed: false },
    ],
  },
  powerElementId: 'SW_P',
  readouts: [
    { label: 'I LOAD', source: { kind: 'current', elementId: 'RL' }, unit: 'A' },
    { label: 'I LED', source: { kind: 'current', elementId: 'D' }, unit: 'A' },
  ],
  tweaks: [],
  failures: [{ id: 'cold', label: 'cold', explain: '', patches: [{ op: 'set', elementId: 'behavior:solder', key: 'j2', value: 'cold' }] }],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  behaviors: [{ id: 'solder-joints', instance: 'solder', params: { joints: 'j1,j2,j3', fine: 'j3', bridgeSw: 'br3', target: 1, tipC: 350, dwellS: 3, flux: 1, feed: 1, alloy: 0 } }],
}

const FRAME = 1 / 60

async function frames(b: ReturnType<typeof createBench>, n: number) {
  for (let i = 0; i < n; i++) await b.frame(FRAME)
}
/** press and release a momentary behavior button */
async function press(b: ReturnType<typeof createBench>, key: 'go' | 'wick') {
  b.setTweak(`behavior:solder.${key}`, 1)
  await frames(b, 2)
  b.setTweak(`behavior:solder.${key}`, 0)
  await frames(b, 2)
}

describe('solder-joints behavior on a bench', () => {
  const make = () => {
    const b = createBench(lesson, { registry: { 'solder-joints': behavior } })
    b.dispatch('power')
    return b
  }

  it('starts with good joints; a cool iron makes a 0.6 Ω cold joint that drops the load current', async () => {
    const b = make()
    await frames(b, 10)
    const s0 = b.snapshot()
    expect(s0.published['solder.j1_q']).toBe(0)
    expect(s0.elementValues['j1.value']).toBeCloseTo(0.001, 6)
    const i0 = s0.values[0]
    expect(i0).toBeCloseTo(5 / 10.002, 2)
    b.setTweak('behavior:solder.tipC', 280)
    await press(b, 'go')
    const s1 = b.snapshot()
    expect(s1.published['solder.j1_q']).toBe(QUALITIES.indexOf('cold'))
    expect(s1.published['solder.sel_ohm']).toBeCloseTo(0.6, 6)
    expect(s1.values[0]).toBeCloseTo(5 / 10.601, 2)
    // reflow with the right technique fixes it
    b.setTweak('behavior:solder.tipC', 340)
    await press(b, 'go')
    expect(b.snapshot().published['solder.j1_q']).toBe(0)
    expect(b.snapshot().published['solder.j1_heats']).toBe(2)
    b.dispose()
  })

  it('a cold joint breaks contact when the board vibrates, and only then', async () => {
    const b = make()
    b.setTweak('behavior:solder.tipC', 280)
    await press(b, 'go')
    await frames(b, 120)
    expect(b.snapshot().published['solder.breaks']).toBe(0)
    b.setTweak('behavior:solder.vibration', 1)
    let low = 0
    for (let i = 0; i < 300; i++) {
      await b.frame(FRAME)
      if (b.snapshot().values[0] < 0.1) low++
    }
    expect(b.snapshot().published['solder.breaks']).toBeGreaterThan(3)
    expect(low).toBeGreaterThan(3)
    expect(low).toBeLessThan(200)
    b.dispose()
  })

  it('too much solder on the fine LED pad bridges the LED dark; wick then reflow brings it back', async () => {
    const b = make()
    await frames(b, 5)
    const lit = b.snapshot().values[1]
    expect(lit).toBeGreaterThan(0.007)
    b.setTweak('behavior:solder.target', 3)
    b.setTweak('behavior:solder.feed', 2)
    await press(b, 'go')
    expect(b.snapshot().published['solder.j3_q']).toBe(QUALITIES.indexOf('bridge'))
    expect(b.snapshot().elementValues['br3.closed']).toBe(1)
    expect(b.snapshot().values[1]).toBeLessThan(1e-4)
    await press(b, 'wick')
    expect(b.snapshot().published['solder.j3_q']).toBe(QUALITIES.indexOf('insufficient'))
    expect(b.snapshot().values[1]).toBeGreaterThan(0.007)
    b.setTweak('behavior:solder.feed', 1)
    await press(b, 'go')
    expect(b.snapshot().published['solder.j3_q']).toBe(0)
    b.dispose()
  })

  it('overheating twice lifts the pad: the load circuit opens; repair fits a jumper (all good again)', async () => {
    const b = make()
    b.setTweak('behavior:solder.target', 2)
    b.setTweak('behavior:solder.tipC', 450)
    await press(b, 'go')
    expect(b.snapshot().published['solder.j2_q']).toBe(QUALITIES.indexOf('overheated'))
    expect(b.snapshot().values[0]).toBeGreaterThan(0.4)
    await press(b, 'go')
    expect(b.snapshot().published['solder.j2_q']).toBe(QUALITIES.indexOf('lifted'))
    expect(b.snapshot().values[0]).toBeLessThan(1e-5)
    b.dispatch('repair')
    await frames(b, 5)
    expect(b.snapshot().published['solder.j2_q']).toBe(0)
    expect(b.snapshot().values[0]).toBeGreaterThan(0.4)
    b.dispose()
  })

  it('a failure patch with a string quality forces that joint, and is reworkable while active', async () => {
    const b = make()
    await frames(b, 3)
    b.dispatch('break:cold')
    await frames(b, 3)
    expect(b.snapshot().published['solder.j2_q']).toBe(QUALITIES.indexOf('cold'))
    b.setTweak('behavior:solder.target', 2)
    await press(b, 'go')
    expect(b.snapshot().published['solder.j2_q']).toBe(0)
    b.dispose()
  })

  it('publishes the worst joint’s I²R at the 0.5 A design current', async () => {
    const b = make()
    b.setTweak('behavior:solder.target', 2)
    b.setTweak('behavior:solder.flux', 0)
    await press(b, 'go')
    expect(b.snapshot().published['solder.joint_W']).toBeCloseTo(0.25 * 0.6, 6)
    b.dispose()
  })
})
