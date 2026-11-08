import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'

// Two sources, one selected at a time: a 3 V and a 7 V source through SW_A / SW_B into a 1 kΩ load.
const lesson: Lesson = {
  id: 'sel',
  fig: 1,
  track: 'T1',
  title: 'Select',
  subtitle: '',
  tagline: '',
  board: { name: 'S', size: [4, 4], parts: [{ id: 'r', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['R1'] }] },
  circuit: {
    elements: [
      { id: 'VA', type: 'V', nodes: ['a', '0'], value: 3 },
      { id: 'VB', type: 'V', nodes: ['b', '0'], value: 7 },
      { id: 'SW_A', type: 'SW', nodes: ['a', 'o'], closed: true },
      { id: 'SW_B', type: 'SW', nodes: ['b', 'o'], closed: false },
      { id: 'SW_P', type: 'SW', nodes: ['o', 'l'], closed: true },
      { id: 'R1', type: 'R', nodes: ['l', '0'], value: 1000 },
    ],
  },
  powerElementId: 'SW_P',
  readouts: [{ label: 'V', source: { kind: 'voltage', node: 'l' }, unit: 'V' }],
  tweaks: [
    {
      label: 'Source',
      elementId: 'behavior:sel',
      key: 'mode',
      kind: 'enum',
      min: 0,
      max: 1,
      unit: '',
      options: [
        { label: 'A', value: 0 },
        { label: 'B', value: 1 },
      ],
    },
  ],
  failures: [{ id: 'force-a', label: 'A', explain: '', patches: [{ op: 'set', elementId: 'behavior:sel', key: 'mode', value: 0 }] }],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  behaviors: [{ id: 'source-select', instance: 'sel', params: { mode: 0, switches: 'SW_A,SW_B' } }],
}

const run = async (b: ReturnType<typeof createBench>, n = 4) => {
  for (let i = 0; i < n; i++) await b.frame(1 / 60)
}

describe('source-select behavior', () => {
  it('closes only the switch whose index is `mode`', async () => {
    const b = createBench(lesson)
    b.dispatch('power')
    await run(b)
    expect(b.snapshot().values[0]).toBeCloseTo(3, 2)
    b.setTweak('behavior:sel.mode', 1)
    await run(b)
    expect(b.snapshot().values[0]).toBeCloseTo(7, 2)
    expect(b.snapshot().published['sel.mode']).toBe(1)
    b.dispatch('break:force-a') // a failure can force the selection
    await run(b)
    expect(b.snapshot().values[0]).toBeCloseTo(3, 2)
    b.dispose()
  })
})
