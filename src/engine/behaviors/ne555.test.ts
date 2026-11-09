import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Element, Lesson } from '../types'
import { behavior } from './ne555'

// An NE555 test bench: the lesson's internal blocks (5 k divider, R_Q, discharge switch, output source)
// around an astable (pin 2 tied to pin 6) or monostable (pin 2 pulled up, button to ground) timer.
interface Opts {
  vcc?: number
  r1?: number
  r2?: number
  c?: number
  mode?: 'astable' | 'monostable'
  noCap?: boolean
  rBat?: number
  extra?: Element[]
}

function fixture(o: Opts = {}): Lesson {
  const mono = o.mode === 'monostable'
  const els: Element[] = [
    { id: 'V_BAT', type: 'V', nodes: ['vcc', '0'], value: o.vcc ?? 9, rInternal: o.rBat ?? 1.5 },
    { id: 'R_Q', type: 'R', nodes: ['vcc', '0'], value: 1500 },
    { id: 'R_D1', type: 'R', nodes: ['vcc', 'th_ref'], value: 5000 },
    { id: 'R_D2', type: 'R', nodes: ['th_ref', 'tr_ref'], value: 5000 },
    { id: 'R_D3', type: 'R', nodes: ['tr_ref', '0'], value: 5000 },
    { id: 'C_CTL', type: 'C', nodes: ['th_ref', '0'], value: 10e-9 },
    { id: 'SW_DIS', type: 'SW', nodes: ['dis', '0'], closed: false, rating: { maxI: 0.2 } },
    { id: 'V_OUT', type: 'V', nodes: ['o', '0'], value: 0, rInternal: 5 },
    { id: 'R1', type: 'R', nodes: ['vcc', 'dis'], value: o.r1 ?? 1000 },
    { id: 'R2', type: 'R', nodes: ['dis', 'thr'], value: o.r2 ?? 10000 },
    ...(o.noCap ? [] : [{ id: 'C1', type: 'C', nodes: ['thr', '0'], value: o.c ?? 47e-6 } as Element]),
    { id: 'R_LOAD', type: 'R', nodes: ['o', '0'], value: 1000 },
    ...(o.extra ?? []),
  ]
  if (mono) {
    els.push(
      { id: 'R_TRG', type: 'R', nodes: ['vcc', 'trg'], value: 10000 },
      { id: 'SW_TRIG', type: 'SW', nodes: ['trg', '0'], closed: false },
    )
  } else els.push({ id: 'W_TRG', type: 'SW', nodes: ['thr', 'trg'], closed: true })
  return {
    id: 'ne555-fixture',
    fig: 1,
    track: 'T3',
    title: 'NE555',
    subtitle: '',
    tagline: '',
    board: { name: 'T', size: [4, 4], parts: [{ id: 'p', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['R1'] }] },
    circuit: { elements: els },
    powerElementId: 'V_BAT',
    sim: { dt: 5e-4 },
    readouts: [
      { label: 'CAP', source: { kind: 'voltage', node: 'thr' }, unit: 'V' },
      { label: 'OUT', source: { kind: 'voltage', node: 'o' }, unit: 'V' },
      { label: 'FREQ', source: { kind: 'behavior', key: 'u1.freq' }, unit: 'Hz' },
      { label: 'DUTY', source: { kind: 'behavior', key: 'u1.duty' }, unit: '' },
      { label: 'PULSE', source: { kind: 'behavior', key: 'u1.pulse' }, unit: 's' },
      { label: 'FAST', source: { kind: 'behavior', key: 'u1.stepLimited' }, unit: '' },
    ],
    tweaks: mono ? [{ label: 'TRIGGER', elementId: 'SW_TRIG', key: 'closed', kind: 'momentary', min: 0, max: 1, step: 1, unit: '' }] : [],
    failures: [{ id: 'short', label: 'R1 out', explain: 'x', patches: [{ op: 'short', a: 'vcc', b: 'dis' }] }],
    meet: '',
    mechanicalAnalogy: '',
    proTips: [],
    quiz: [],
    behaviors: [{ id: 'ne555', instance: 'u1', params: { trig: 'trg' } }],
  }
}

const FRAME = 1 / 60
const [CAP, OUT, FREQ, DUTY, PULSE, FAST] = [0, 1, 2, 3, 4, 5]

function mk(o: Opts = {}) {
  const b = createBench(fixture(o), { registry: { ne555: behavior } })
  b.dispatch('power')
  return b
}
async function run(b: ReturnType<typeof mk>, seconds: number, each?: (v: number[]) => void) {
  const t1 = b.t + seconds
  while (b.t < t1 - 1e-9) {
    await b.frame(FRAME)
    each?.(b.snapshot().values)
  }
  return b.snapshot().values
}
const within = (got: number, want: number, tol: number) => Math.abs(got - want) <= tol * Math.abs(want)

describe('ne555 behavior (astable)', () => {
  it('f = 1.44 / ((R1 + 2 R2) C) and duty = (R1 + R2) / (R1 + 2 R2), both within 5 %', async () => {
    const v = await run(mk(), 6)
    expect(within(v[FREQ], 1.44 / (21e3 * 47e-6), 0.05), `freq ${v[FREQ]}`).toBe(true)
    expect(within(v[DUTY], 11 / 21, 0.05), `duty ${v[DUTY]}`).toBe(true)
  })

  it('the capacitor swings between 1/3 and 2/3 of Vcc', async () => {
    const b = mk()
    let lo = 99
    let hi = 0
    await run(b, 1) // settle the first charge from 0 V
    await run(b, 4, (v) => {
      lo = Math.min(lo, v[CAP])
      hi = Math.max(hi, v[CAP])
    })
    expect(hi).toBeGreaterThan(5.9)
    expect(hi).toBeLessThan(6.1)
    expect(lo).toBeGreaterThan(2.9)
    expect(lo).toBeLessThan(3.1)
  })

  it('the thresholds scale with the supply, so the frequency is the same at 6 V and 15 V', async () => {
    const f: number[] = []
    for (const vcc of [6, 15]) {
      const v = await run(mk({ vcc }), 6)
      f.push(v[FREQ])
      expect(within(v[FREQ], 1.46, 0.05), `${vcc} V: ${v[FREQ]} Hz`).toBe(true)
    }
    expect(Math.abs(f[0] - f[1]) / f[0]).toBeLessThan(0.03)
  })

  it('output swings from 0 V to about Vcc - 1.2 V, and a different timing network gives a different rate', async () => {
    let hi = 0
    let lo = 99
    const v = await run(mk({ r1: 10e3, r2: 100e3, c: 10e-6 }), 12, (s) => {
      hi = Math.max(hi, s[OUT])
      lo = Math.min(lo, s[OUT])
    })
    expect(within(v[FREQ], 1.44 / (210e3 * 10e-6), 0.05), `freq ${v[FREQ]}`).toBe(true)
    expect(hi).toBeGreaterThan(7.2)
    expect(hi).toBeLessThan(8.0)
    expect(lo).toBeLessThan(0.05)
  })

  it('the comparators read the real divider nodes: a 5 kohm from pin 5 to ground lowers the upper threshold to 3.6 V', async () => {
    // th_ref = 9 * (5k||10k) / (5k + 5k||10k) = 9 * 3.33 / 8.33 = 3.6 V; tr_ref = 1.2 V
    const b = createBench(fixture({ extra: [{ id: 'R_CTL', type: 'R', nodes: ['th_ref', '0'], value: 5000 }] }), { registry: { ne555: behavior } })
    b.dispatch('power')
    let hi = 0
    await run(b, 1)
    await run(b, 4, (v) => (hi = Math.max(hi, v[CAP])))
    expect(hi).toBeGreaterThan(3.5)
    expect(hi).toBeLessThan(3.8)
  })

  it('does nothing below 4.5 V: output low, no rate published', async () => {
    const v = await run(mk({ vcc: 3, rBat: 0.3 }), 4)
    expect(v[OUT]).toBeLessThan(0.1)
    expect(v[FREQ]).toBe(0)
  })

  it('no timing capacitor: it toggles every step and says the rate is step-limited', async () => {
    const v = await run(mk({ noCap: true }), 1)
    expect(v[FREQ]).toBeGreaterThan(300) // 1 / (2 dt) = 1 kHz at 0.5 ms
    expect(v[FAST]).toBe(1)
  })

  it('R1 shorted: the discharge switch carries the battery short and fails; the oscillation stops', async () => {
    const b = createBench(fixture(), { registry: { ne555: behavior } })
    b.dispatch('power')
    b.dispatch('break:short')
    await run(b, 3)
    expect(b.snapshot().status).toBe('FAULT')
    expect((await run(b, 2))[FREQ]).toBe(0)
  })
})

describe('ne555 behavior (monostable)', () => {
  it('idle: output low, capacitor held at 0 by the discharge transistor', async () => {
    const v = await run(mk({ mode: 'monostable' }), 1)
    expect(v[OUT]).toBeLessThan(0.1)
    expect(v[CAP]).toBeLessThan(0.05)
  })

  it('a trigger pulse gives one output pulse of 1.1 R C, then it rests', async () => {
    const b = mk({ mode: 'monostable' })
    await run(b, 0.5)
    b.setTweak('SW_TRIG.closed', 1)
    await run(b, 0.1)
    b.setTweak('SW_TRIG.closed', 0)
    let highFrames = 0
    const v = await run(b, 2, (s) => {
      if (s[OUT] > 4) highFrames++
    })
    const want = 1.1 * 11e3 * 47e-6 // 0.5687 s
    expect(within(v[PULSE], want, 0.05), `pulse ${v[PULSE]}`).toBe(true)
    // the frames counted start 0.1 s after the trigger went down
    expect(within(highFrames * FRAME, want - 0.1, 0.1), `high ${highFrames * FRAME}`).toBe(true)
    expect(v[OUT]).toBeLessThan(0.1)
    expect(v[FREQ]).toBe(0)
  })

  it('a trigger held longer than the pulse keeps the output high (the trigger comparator dominates)', async () => {
    const b = mk({ mode: 'monostable' })
    await run(b, 0.2)
    b.setTweak('SW_TRIG.closed', 1)
    const v = await run(b, 1.5)
    expect(v[OUT]).toBeGreaterThan(4)
  })
})
