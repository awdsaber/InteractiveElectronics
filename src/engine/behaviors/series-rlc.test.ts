import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { behavior, seriesRlc } from './series-rlc'

const lesson: Lesson = {
  id: 'rlc',
  fig: 1,
  track: 'T1',
  title: 'RLC',
  subtitle: '',
  tagline: '',
  board: { name: 'R', size: [4, 4], parts: [{ id: 'r', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['R1'] }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['a', '0'], value: 0, wave: { kind: 'sine', amp: 1, freq: 1000 } },
      { id: 'R1', type: 'R', nodes: ['a', 'b'], value: 10 },
      { id: 'R2', type: 'R', nodes: ['b', 'c'], value: 10 },
      { id: 'L1', type: 'L', nodes: ['c', 'd'], value: 0.01 },
      { id: 'C1', type: 'C', nodes: ['d', '0'], value: 1e-6 },
    ],
  },
  powerElementId: 'V1',
  readouts: [{ label: 'z', source: { kind: 'behavior', key: 'rlc.zeta' }, unit: '' }],
  tweaks: [{ label: 'R1', elementId: 'R1', key: 'value', min: 0, max: 470, unit: 'Ω' }],
  failures: [],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  sim: { dt: 5e-6, method: 'trap' },
  behaviors: [{ id: 'series-rlc', instance: 'rlc', params: { l: 'L1', c: 'C1', r: 'R1,R2', rExtra: 0.05, sine: 'V1' } }],
}

describe('seriesRlc (pure)', () => {
  it('10 mH, 1 µF, 20 Ω: f0 1592 Hz, Z0 100 Ω, ζ 0.1, Q 5, fd = f0·√(1−ζ²)', () => {
    const r = seriesRlc(0.01, 1e-6, 20, 1000)
    expect(r.f0).toBeCloseTo(1591.55, 1)
    expect(r.z0).toBeCloseTo(100, 6)
    expect(r.zeta).toBeCloseTo(0.1, 9)
    expect(r.q).toBeCloseTo(5, 9)
    expect(r.fd).toBeCloseTo(1591.55 * Math.sqrt(1 - 0.01), 1)
    // |H| = 1/√((1−u²)² + (2ζu)²), u = f/f0
    const u = 1000 / r.f0
    expect(r.gain).toBeCloseTo(1 / Math.hypot(1 - u * u, 2 * 0.1 * u), 9)
  })
  it('gain at resonance is Q; ζ ≥ 1 does not ring (fd = 0)', () => {
    expect(seriesRlc(0.01, 1e-6, 20, 1 / (2 * Math.PI * 1e-4)).gain).toBeCloseTo(5, 6)
    expect(seriesRlc(0.01, 1e-6, 200, 1000).fd).toBe(0)
    expect(seriesRlc(0.01, 1e-6, 480, 1000).zeta).toBeCloseTo(2.4, 9)
  })
})

describe('series-rlc behavior', () => {
  it('publishes f0, ζ, Q, fd and the sine gain from the live netlist, tweaks included', async () => {
    const b = createBench(lesson, { tweaks: { 'R1.value': 180 } })
    b.dispatch('power')
    for (let i = 0; i < 3; i++) await b.frame(1 / 60)
    let s = b.snapshot()
    expect(s.published['rlc.zeta']).toBeCloseTo(190.05 / 200, 6)
    b.setTweak('R1.value', 10)
    for (let i = 0; i < 2; i++) await b.frame(1 / 60)
    s = b.snapshot()
    expect(s.published['rlc.f0']).toBeCloseTo(1591.55, 1)
    expect(s.published['rlc.zeta']).toBeCloseTo(20.05 / 200, 6)
    expect(s.published['rlc.q']).toBeCloseTo(100 / 20.05, 6)
    expect(s.published['rlc.z0']).toBeCloseTo(100, 6)
    expect(s.published['rlc.fd']).toBeGreaterThan(1580)
    expect(s.published['rlc.gain']).toBeCloseTo(seriesRlc(0.01, 1e-6, 20.05, 1000).gain, 6)
    b.dispose()
  })
  it('publishes NaN ("—") once L or C is no longer an L / C (a burnt part becomes a resistor)', async () => {
    const l2: Lesson = {
      ...lesson,
      failures: [{ id: 'c-gone', label: 'x', explain: '', patches: [{ op: 'remove', elementId: 'C1' }, { op: 'add', element: { id: 'C1', type: 'R', nodes: ['d', '0'], value: 1e9 } }] }],
    }
    const b = createBench(l2)
    b.dispatch('power')
    b.dispatch('break:c-gone')
    for (let i = 0; i < 2; i++) await b.frame(1 / 60)
    const s = b.snapshot()
    expect(s.published['rlc.f0']).toBeNaN()
    expect(s.published['rlc.zeta']).toBeNaN()
    expect(s.published['rlc.gain']).toBeNaN()
    b.dispose()
  })
  it('the pure function backs the behaviour id', () => {
    expect(behavior.id).toBe('series-rlc')
  })
})
