import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { behavior } from './ac-meter'

// A function generator (ideal sine) into a 3.3 kΩ / 1 µF RC low-pass, stepped at 50 µs.
const R = 3300
const C = 1e-6

function rcLesson(freq: number, params: Record<string, number | string | boolean>, offset = 0): Lesson {
  return {
    id: 'acm',
    fig: 1,
    track: 'T1',
    title: 'AC meter',
    subtitle: '',
    tagline: '',
    board: { name: 'A', size: [4, 4], parts: [{ id: 'r', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['R1'] }] },
    circuit: {
      elements: [
        { id: 'V_GEN', type: 'V', nodes: ['in', '0'], value: 0, wave: { kind: 'sine', amp: 5, freq, offset } },
        { id: 'R1', type: 'R', nodes: ['in', 'out'], value: R },
        { id: 'C1', type: 'C', nodes: ['out', '0'], value: C },
      ],
    },
    powerElementId: 'V_GEN',
    readouts: [],
    tweaks: [{ label: 'Amplitude', elementId: 'V_GEN', key: 'wave.amp', min: 0, max: 10, unit: 'V' }],
    failures: [
      { id: 'dc', label: 'DC', explain: 'The generator is switched to DC.', patches: [{ op: 'set', elementId: 'V_GEN', key: 'wave.amp', value: 0 }, { op: 'set', elementId: 'V_GEN', key: 'wave.offset', value: 3 }] },
      { id: 'lift', label: 'Lift', explain: 'R1 and C1 are lifted: out is floating.', patches: [{ op: 'remove', elementId: 'R1' }, { op: 'remove', elementId: 'C1' }] },
    ],
    meet: '',
    mechanicalAnalogy: '',
    proTips: [],
    quiz: [],
    sim: { dt: 50e-6, method: 'trap' },
    behaviors: [{ id: 'ac-meter', instance: 'm', params }],
  }
}

const bench = (l: Lesson) => {
  // the slider's start value is given: main's initialTweaks reads only flat keys, not 'wave.amp'
  const b = createBench(l, { registry: { 'ac-meter': behavior }, tweaks: { 'V_GEN.wave.amp': 5 } })
  b.dispatch('power')
  return b
}
const run = async (b: Bench, sec: number, fps: number) => {
  const t0 = b.t
  while (b.t - t0 < sec - 1e-9) await b.frame(1 / fps)
}
const pub = (b: Bench, key: string) => b.snapshot().published[`m.${key}`] ?? NaN
/** the extreme values of `key` over `frames` consecutive frames (a reading must hold still, not just pass through) */
async function span(b: Bench, key: string, frames: number, fps: number): Promise<[number, number]> {
  let lo = Infinity
  let hi = -Infinity
  for (let k = 0; k < frames; k++) {
    await b.frame(1 / fps)
    const v = pub(b, key)
    lo = Math.min(lo, v)
    hi = Math.max(hi, v)
  }
  return [lo, hi]
}

describe('ac-meter: a 50 Hz sine, any frame rate', () => {
  // fps = f (50) and fps = 2f (100) are where a once-per-frame sampler sees one phase only
  for (const fps of [30, 50, 60, 100, 144]) {
    it(`reads rms, amp, vpp and freq of 5 V peak at ${fps} fps`, async () => {
      const b = bench(rcLesson(50, { node: 'in' }))
      await run(b, 1, fps)
      const checks: [string, number, number][] = [
        ['rms', 5 / Math.SQRT2, 2e-3],
        ['acrms', 5 / Math.SQRT2, 2e-3],
        ['amp', 5, 2e-3],
        ['vpp', 10, 1e-3],
        ['freq', 50, 1e-3],
        ['period', 0.02, 1e-3],
      ]
      for (const [key, want, rel] of checks) {
        const [lo, hi] = await span(b, key, 10, fps)
        expect(lo, `${key} low`).toBeGreaterThan(want * (1 - rel))
        expect(hi, `${key} high`).toBeLessThan(want * (1 + rel))
      }
      expect(Math.abs(pub(b, 'dc'))).toBeLessThan(0.02)
      b.dispose()
    })
  }

  it("reads an element's current (kind 'i'), and copes with the transformer lesson's coarse 1 ms step", async () => {
    const l = rcLesson(50, { kind: 'i', element: 'R1', source: 'V_GEN' })
    const b = bench({ ...l, sim: { dt: 1e-3, method: 'trap' } })
    await run(b, 1, 60)
    const wrc = 2 * Math.PI * 50 * R * C
    const iAmp = (5 * wrc) / Math.sqrt(1 + wrc * wrc) / R // |Vin − Vout| / R
    expect(pub(b, 'amp') / iAmp).toBeCloseTo(1, 2)
    expect(pub(b, 'freq')).toBeCloseTo(50, 1)
    b.dispose()
  })

  it('separates a DC offset from the AC part', async () => {
    const b = bench(rcLesson(50, { node: 'in' }, 1))
    await run(b, 1, 60)
    expect(pub(b, 'dc')).toBeCloseTo(1, 2)
    expect(pub(b, 'acrms')).toBeCloseTo(5 / Math.SQRT2, 2)
    expect(pub(b, 'rms')).toBeCloseTo(Math.sqrt(1 + 12.5), 2)
    expect(pub(b, 'vpp')).toBeCloseTo(10, 2)
    b.dispose()
  })
})

describe('ac-meter: RC low-pass gain and phase', () => {
  for (const f of [50, 500]) {
    it(`reads gain 1/√(1+(ωRC)²) and phase −atan(ωRC) at ${f} Hz`, async () => {
      const wrc = 2 * Math.PI * f * R * C
      const gain = 1 / Math.sqrt(1 + wrc * wrc)
      const phase = (-Math.atan(wrc) * 180) / Math.PI
      const b = bench(rcLesson(f, { node: 'in', nodeB: 'out' }))
      await run(b, 1, 60)
      const [glo, ghi] = await span(b, 'gain', 10, 60)
      expect(glo).toBeGreaterThan(gain * 0.995)
      expect(ghi).toBeLessThan(gain * 1.005)
      expect(pub(b, 'gainPct')).toBeCloseTo(gain * 100, 0)
      const [plo, phi] = await span(b, 'phase', 10, 60)
      expect(plo).toBeGreaterThan(phase - 0.5)
      expect(phi).toBeLessThan(phase + 0.5)
      expect(pub(b, 'acrmsB')).toBeCloseTo((5 * gain) / Math.SQRT2, 2)
      expect(pub(b, 'ampB')).toBeCloseTo(5 * gain, 2)
      expect(pub(b, 'freq')).toBeCloseTo(f, 0)
      b.dispose()
    })
  }

  it('takes the ac-oscilloscope params (a, b) as aliases, and the phase sign flips with the channels', async () => {
    const b = bench(rcLesson(50, { source: 'V_GEN', a: 'out', b: 'in' }))
    await run(b, 1, 60)
    expect(pub(b, 'phase')).toBeCloseTo(46.03, 0) // in leads out
    expect(pub(b, 'gain')).toBeCloseTo(1.44, 1)
    b.dispose()
  })
})

describe('ac-meter: lifecycle', () => {
  const W = 0.2

  it('reads 0 within one window after the source is swapped to DC (failure)', async () => {
    const b = bench(rcLesson(50, { node: 'in', nodeB: 'out' }))
    await run(b, 0.5, 60)
    expect(pub(b, 'amp')).toBeCloseTo(5, 1)
    b.dispatch('break:dc')
    await run(b, W, 60)
    for (const k of ['acrms', 'amp', 'vpp', 'freq', 'gain', 'phase']) expect(Math.abs(pub(b, k)), k).toBeLessThan(5e-3)
    expect(pub(b, 'dc')).toBeCloseTo(3, 3)
    expect(pub(b, 'rms')).toBeCloseTo(3, 3)
    b.dispose()
  })

  it('reads 0 within one window after the amplitude is tweaked to 0 (no event)', async () => {
    const b = bench(rcLesson(50, { node: 'in' }))
    await run(b, 0.5, 60)
    b.setTweak('V_GEN.wave.amp', 0)
    await run(b, W, 60)
    for (const k of ['rms', 'acrms', 'amp', 'vpp', 'freq']) expect(Math.abs(pub(b, k)), k).toBeLessThan(5e-3)
    b.dispose()
  })

  it('publishes 0 for a floating channel, and gates the ratios', async () => {
    const b = bench(rcLesson(50, { node: 'in', nodeB: 'out' }))
    await run(b, 0.5, 60)
    b.dispatch('break:lift')
    await run(b, 0.1, 60)
    for (const k of ['rmsB', 'acrmsB', 'ampB', 'vppB', 'dcB', 'gain', 'gainPct', 'phase']) expect(pub(b, k), k).toBe(0)
    expect(pub(b, 'amp')).toBeGreaterThan(0) // channel A is still driven
    b.dispatch('repair')
    await run(b, 0.5, 60)
    expect(pub(b, 'gain')).toBeCloseTo(0.694, 2)
    b.dispose()
  })

  it('starts clean after power-off / power-on', async () => {
    const b = bench(rcLesson(50, { node: 'in' }))
    await run(b, 0.5, 60)
    b.dispatch('power')
    b.dispatch('power')
    await run(b, 0.5, 60)
    expect(pub(b, 'amp')).toBeCloseTo(5, 1)
    b.dispose()
  })
})
