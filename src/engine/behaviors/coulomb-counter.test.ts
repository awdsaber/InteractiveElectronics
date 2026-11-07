import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { behavior } from './coulomb-counter'

const lesson: Lesson = {
  id: 'cc',
  fig: 1,
  track: 'T0',
  title: 'Counter',
  subtitle: '',
  tagline: '',
  board: { name: 'C', size: [4, 4], parts: [{ id: 'r', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['R1'] }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['a', '0'], value: 1.2 },
      { id: 'P', type: 'PROBE', nodes: ['a', 'b'] },
      { id: 'R1', type: 'R', nodes: ['b', '0'], value: 100 }, // 12 mA
    ],
  },
  powerElementId: 'V1',
  readouts: [
    { label: 'I', source: { kind: 'current', elementId: 'P' }, unit: 'A' },
    { label: 'Q', source: { kind: 'behavior', key: 'coulomb-counter.coulombs' }, unit: 'C' },
    { label: 'e/s', source: { kind: 'behavior', key: 'coulomb-counter.electronsPerSec' }, unit: '' },
  ],
  failures: [],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  behaviors: [{ id: 'coulomb-counter', params: { element: 'P' } }],
}

const run = async (b: ReturnType<typeof createBench>, sec: number) => {
  for (let t = 0; t < sec; t += 1 / 60) await b.frame(1 / 60)
}

describe('coulomb-counter behavior', () => {
  it('integrates I dt and publishes the electron rate', async () => {
    const b = createBench(lesson, { registry: { 'coulomb-counter': behavior } })
    b.dispatch('power')
    await run(b, 10)
    const s = b.snapshot()
    expect(s.values[0]).toBeCloseTo(0.012, 4)
    expect(s.values[1]).toBeCloseTo(0.012 * b.t, 3) // Q = I t over the sim time that passed
    expect(b.t).toBeGreaterThan(9.9)
    expect(s.values[2] / 7.49e16).toBeCloseTo(1, 2) // 0.012 / 1.602e-19 electrons per second
    expect(s.published['coulomb-counter.electronsE15']).toBeCloseTo(74.9, 0)
    b.dispose()
  })

  it('starts again from zero after power-off', async () => {
    const b = createBench(lesson, { registry: { 'coulomb-counter': behavior } })
    b.dispatch('power')
    await run(b, 2)
    b.dispatch('power') // off
    b.dispatch('power') // on
    const t0 = b.t
    await run(b, 1)
    const q = b.snapshot().values[1]
    expect(q).toBeCloseTo(0.012 * (b.t - t0), 3)
    b.dispose()
  })
})
