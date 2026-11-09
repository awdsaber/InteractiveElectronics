import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { behavior } from './edge-counter'

const lesson: Lesson = {
  id: 'ec',
  fig: 1,
  track: 'T3',
  title: 'EC',
  subtitle: '',
  tagline: '',
  board: { name: 'E', size: [4, 4], parts: [{ id: 'p', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['R1'] }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['n', '0'], value: 0, wave: { kind: 'sine', amp: 2, freq: 10, offset: 2.5 } },
      { id: 'R1', type: 'R', nodes: ['n', '0'], value: 1000 },
    ],
  },
  powerElementId: 'V1',
  readouts: [{ label: 'EDGES', source: { kind: 'behavior', key: 'ec.edges' }, unit: '' }],
  failures: [],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  behaviors: [{ id: 'edge-counter', instance: 'ec', params: { node: 'n' } }],
}

describe('edge-counter behavior', () => {
  it('counts both crossings of a 10 Hz sine: about 20 edges per second', async () => {
    const b = createBench(lesson, { registry: { 'edge-counter': behavior } })
    b.dispatch('power')
    for (let k = 0; k < 120; k++) await b.frame(1 / 60) // 2 s
    const edges = b.snapshot().values[0]
    expect(edges).toBeGreaterThanOrEqual(36)
    expect(edges).toBeLessThanOrEqual(42)
  })
})
