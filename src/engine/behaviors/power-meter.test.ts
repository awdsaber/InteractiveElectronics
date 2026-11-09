import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { behavior } from './power-meter'

// 10 V in through a probe, a 4 Ω series "loss" resistor, and a 6 Ω load: I = 1 A,
// P_in = 10 W, P_out = 6 W, loss = 4 W, η = 60 %.
const lesson: Lesson = {
  id: 'pm',
  fig: 1,
  track: 'T0',
  title: 'Power meter',
  subtitle: '',
  tagline: '',
  board: { name: 'P', size: [4, 4], parts: [{ id: 'r', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['RL'] }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['in', '0'], value: 10 },
      { id: 'P_IN', type: 'PROBE', nodes: ['in', 'a'] },
      { id: 'R_LOSS', type: 'R', nodes: ['a', 'out'], value: 4 },
      { id: 'RL', type: 'R', nodes: ['out', '0'], value: 6 },
    ],
  },
  powerElementId: 'V1',
  readouts: [
    { label: 'ETA', source: { kind: 'behavior', key: 'pm.eta' }, unit: '%' },
    { label: 'LOSS', source: { kind: 'behavior', key: 'pm.loss' }, unit: 'W' },
  ],
  failures: [],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  behaviors: [{ id: 'power-meter', instance: 'pm', params: { vin: 'in', iin: 'P_IN', vout: 'out', iout: 'RL' } }],
}

const run = async (b: ReturnType<typeof createBench>, sec: number) => {
  for (let t = 0; t < sec; t += 1 / 60) await b.frame(1 / 60)
}

describe('power-meter behavior', () => {
  it('publishes P_in, P_out, loss and efficiency in %', async () => {
    const b = createBench(lesson, { registry: { 'power-meter': behavior } })
    b.dispatch('power')
    await run(b, 0.2)
    const s = b.snapshot()
    expect(s.published['pm.pin']).toBeCloseTo(10, 6)
    expect(s.published['pm.pout']).toBeCloseTo(6, 6)
    expect(s.values[1]).toBeCloseTo(4, 6)
    expect(s.values[0]).toBeCloseTo(60, 6)
    b.dispose()
  })

  it('reads 0 % (not NaN) with no input power', async () => {
    const b = createBench(
      { ...lesson, circuit: { elements: lesson.circuit.elements.map((e) => (e.id === 'RL' ? { ...e, value: 1e12 } : e)) } },
      { registry: { 'power-meter': behavior } },
    )
    b.dispatch('power')
    await run(b, 0.1)
    const s = b.snapshot()
    expect(s.values[0]).toBe(0)
    b.dispose()
  })
})
