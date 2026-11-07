import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { behavior } from './pot-knob'

const lesson: Lesson = {
  id: 'knob',
  fig: 1,
  track: 'T4',
  title: 'Knob',
  subtitle: '',
  tagline: '',
  board: { name: 'K', size: [4, 4], parts: [{ id: 'p', kind: 'potentiometer', pos: [0, 0], mount: 'tht', role: 'p', circuitIds: ['POT'] }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['5v', '0'], value: 5 },
      { id: 'POT', type: 'POT', nodes: ['0', 'w', '5v'], value: 10000, pos: 0.5 },
    ],
  },
  powerElementId: 'V1',
  readouts: [{ label: 'WIPER', source: { kind: 'voltage', node: 'w' }, unit: 'V' }],
  tweaks: [{ label: 'Knob', elementId: 'behavior:knob', key: 'turn', min: 0, max: 100, step: 1, unit: '%' }],
  failures: [],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  behaviors: [{ id: 'pot-knob', instance: 'knob', params: { pot: 'POT', turn: 20 } }],
}

describe('pot-knob behavior', () => {
  it('turns a POT element from a 0–100 % param (a % slider for the wiper)', async () => {
    const b = createBench(lesson, { registry: { 'pot-knob': behavior } })
    b.dispatch('power')
    await b.frame(1 / 60)
    await b.frame(1 / 60)
    expect(b.snapshot().values[0]).toBeCloseTo(1, 3) // 20 % of 5 V
    expect(b.snapshot().elementValues['POT.pos']).toBeCloseTo(0.2, 6)
    b.setTweak('behavior:knob.turn', 75)
    await b.frame(1 / 60)
    await b.frame(1 / 60)
    expect(b.snapshot().values[0]).toBeCloseTo(3.75, 3)
    expect(b.snapshot().published['knob.turn']).toBe(75)
    b.dispose()
  })

  it('clamps out-of-range turns', async () => {
    const b = createBench(lesson, { registry: { 'pot-knob': behavior } })
    b.setTweak('behavior:knob.turn', 140)
    b.dispatch('power')
    await b.frame(1 / 60)
    await b.frame(1 / 60)
    expect(b.snapshot().values[0]).toBeCloseTo(5, 3)
    b.dispose()
  })
})
