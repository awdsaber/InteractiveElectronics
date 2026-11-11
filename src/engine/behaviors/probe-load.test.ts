import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { behavior } from './probe-load'

// A 1 MΩ / 1 MΩ divider on 10 V with a scope probe's tip loading (R_P ‖ C_P) on the midpoint.
const lesson: Lesson = {
  id: 'probe',
  fig: 1,
  track: 'T7',
  title: 'Probe',
  subtitle: '',
  tagline: '',
  board: { name: 'P', size: [4, 4], parts: [{ id: 'r', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['R1'] }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['a', '0'], value: 10 },
      { id: 'SW_P', type: 'SW', nodes: ['a', 'b'], closed: true },
      { id: 'R1', type: 'R', nodes: ['b', 'm'], value: 1e6 },
      { id: 'R2', type: 'R', nodes: ['m', '0'], value: 1e6 },
      { id: 'R_P', type: 'R', nodes: ['m', '0'], value: 1e7 },
      { id: 'C_P', type: 'C', nodes: ['m', '0'], value: 12e-12 },
    ],
  },
  powerElementId: 'SW_P',
  readouts: [{ label: 'MID', source: { kind: 'voltage', node: 'm' }, unit: 'V' }],
  tweaks: [
    {
      label: 'Probe',
      elementId: 'behavior:probe',
      key: 'mode',
      kind: 'enum',
      min: 0,
      max: 2,
      unit: '',
      options: [
        { label: 'Off', value: 0 },
        { label: '×10', value: 1 },
        { label: '×1', value: 2 },
      ],
    },
  ],
  failures: [],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  transient: true,
  behaviors: [{ id: 'probe-load', instance: 'probe', params: { r: 'R_P', c: 'C_P', mode: 1 } }],
}

const run = async (b: ReturnType<typeof createBench>, n = 30) => {
  for (let i = 0; i < n; i++) await b.frame(1 / 60)
}
const el = (b: ReturnType<typeof createBench>, id: string) => ({ value: b.snapshot().elementValues[`${id}.value`] })

describe('probe-load behavior', () => {
  it('×10: 10 MΩ ‖ 12 pF; ×1: 1 MΩ ‖ 100 pF; off: nothing on the node', async () => {
    const b = createBench(lesson, { registry: { 'probe-load': behavior } })
    b.dispatch('power')
    await run(b)
    // ×10: bottom leg 1 M ‖ 10 M = 909 k → 10 × 0.909 / 1.909 = 4.76 V
    expect(el(b, 'R_P').value).toBe(1e7)
    expect(el(b, 'C_P').value).toBeCloseTo(12e-12, 15)
    expect(b.snapshot().values[0]).toBeCloseTo(4.762, 2)
    expect(b.snapshot().published['probe.c_pf']).toBeCloseTo(12, 6)

    b.setTweak('behavior:probe.mode', 2) // ×1: bottom leg 500 k → 3.33 V
    await run(b)
    expect(el(b, 'R_P').value).toBe(1e6)
    expect(el(b, 'C_P').value).toBeCloseTo(100e-12, 15)
    expect(b.snapshot().values[0]).toBeCloseTo(3.333, 2)

    b.setTweak('behavior:probe.mode', 0) // lifted off: the divider's own 5 V
    await run(b)
    expect(b.snapshot().values[0]).toBeCloseTo(5, 2)
    expect(b.snapshot().published['probe.mode']).toBe(0)
    b.dispose()
  })
})
