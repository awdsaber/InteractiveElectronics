import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson, Waveform } from '../types'
import { behavior } from './ac-meter'

const mk = (wave: Waveform): Lesson => ({
  id: 'acm',
  fig: 1,
  track: 'T1',
  title: 'AC meter',
  subtitle: '',
  tagline: '',
  board: { name: 'A', size: [4, 4], parts: [{ id: 'r', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['R1'] }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['a', '0'], value: 0, wave },
      { id: 'R1', type: 'R', nodes: ['a', '0'], value: 10 },
    ],
  },
  powerElementId: 'V1',
  readouts: [
    { label: 'V', source: { kind: 'behavior', key: 'vm.rms' }, unit: 'V' },
    { label: 'I', source: { kind: 'behavior', key: 'im.rms' }, unit: 'A' },
    { label: 'Vamp', source: { kind: 'behavior', key: 'vm.amp' }, unit: 'V' },
    { label: 'Vdc', source: { kind: 'behavior', key: 'vm.dc' }, unit: 'V' },
  ],
  failures: [],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  behaviors: [
    { id: 'ac-meter', instance: 'vm', params: { kind: 'v', node: 'a', source: 'V1' } },
    { id: 'ac-meter', instance: 'im', params: { kind: 'i', element: 'R1', source: 'V1' } },
  ],
  sim: { dt: 1e-3 },
})

async function run(wave: Waveform, sec: number, fps = 60) {
  const b = createBench(mk(wave), { registry: { 'ac-meter': behavior } })
  b.dispatch('power')
  for (let t = 0; t < sec; t += 1 / fps) await b.frame(1 / fps)
  const s = b.snapshot()
  b.dispose()
  return s
}

describe('ac-meter behavior', () => {
  it('reads the RMS of a 50 Hz, 16.97 V peak sine (12 V rms) and of the current through 10 Ω', async () => {
    const s = await run({ kind: 'sine', amp: 16.97, freq: 50 }, 2)
    expect(s.values[0]).toBeCloseTo(12, 1)
    expect(s.values[1]).toBeCloseTo(1.2, 2)
    expect(s.values[2]).toBeCloseTo(16.97, 1)
    expect(Math.abs(s.values[3])).toBeLessThan(0.05)
  })

  it('reads a 61 Hz sine sampled once per 60 fps frame', async () => {
    const s = await run({ kind: 'sine', amp: 10, freq: 61 }, 3)
    expect(s.values[0]).toBeCloseTo(10 / Math.SQRT2, 1)
  })

  it('reports a DC level as dc and as total rms', async () => {
    const s = await run({ kind: 'sine', amp: 0, freq: 50, offset: 12 }, 2)
    expect(s.values[3]).toBeCloseTo(12, 1)
    expect(s.values[0]).toBeCloseTo(12, 1)
    expect(s.values[2]).toBeLessThan(0.1)
  })
})
