import { describe, expect, it } from 'vitest'
import { lesson as ledResistor } from '../../lessons/T2/led-resistor'
import type { Lesson } from '../types'
import { createBench } from './simLoop'

// An NPN low-side switch on a 1 mH coil with no flyback diode, driven from a tweakable base
// supply. Turning the base off kicks V_CE into the 60 V avalanche clamp for a few µs: the bench
// must check ratings on the switching step's substeps, or the 40 V maxV is never seen.
function kickLesson(edgeSubsteps?: number): Lesson {
  return {
    ...(ledResistor as Lesson),
    fig: 1,
    id: 'kick',
    sketch: undefined,
    behaviors: undefined,
    statusLines: [],
    board: { name: 'K', size: [4, 4], parts: [{ id: 'q1', kind: 'transistor-to92', pos: [0, 0], mount: 'tht', role: 'q', circuitIds: ['Q1'] }] },
    circuit: {
      elements: [
        { id: 'VP', type: 'V', nodes: ['pk', '0'], value: 6 },
        { id: 'L1', type: 'L', nodes: ['pk', 'n'], value: 1e-3 },
        { id: 'R1', type: 'R', nodes: ['n', 'c'], value: 30 },
        { id: 'Q1', type: 'NPN', nodes: ['c', 'b', '0'], beta: 150, vBreak: 60, rating: { maxV: 40, failMode: 'short' }, partId: 'q1' },
        { id: 'VB', type: 'V', nodes: ['drv', '0'], value: 5 },
        { id: 'RB', type: 'R', nodes: ['drv', 'b'], value: 470 },
      ],
    },
    powerElementId: 'VP',
    readouts: [{ label: 'I', source: { kind: 'current', elementId: 'L1' }, unit: 'A' }],
    tweaks: [{ label: 'Base drive', elementId: 'VB', key: 'value', min: 0, max: 5, unit: 'V' }],
    failures: [],
    ...(edgeSubsteps ? { sim: { edgeSubsteps } } : {}),
  }
}

async function kick(l: Lesson) {
  const b = createBench(l)
  b.dispatch('power')
  for (let i = 0; i < 20; i++) await b.frame(1 / 60)
  expect(b.snapshot().values[0]).toBeGreaterThan(0.18)
  b.setTweak('VB.value', 0)
  for (let i = 0; i < 5; i++) await b.frame(1 / 60)
  return b
}

describe('bench: ratings on edge substeps (lesson.sim.edgeSubsteps)', () => {
  it('without substeps the turn-off kick goes unseen and Q1 survives', async () => {
    const b = await kick(kickLesson())
    expect(b.snapshot().assembly.burns).toEqual([])
  })

  it('with substeps V_CE reaches the clamp, Q1 fails short on overvoltage and the coil stays on', async () => {
    const b = await kick(kickLesson(10))
    const s = b.snapshot()
    expect(s.assembly.burns).toHaveLength(1)
    expect(s.assembly.burns[0]).toMatchObject({ elementId: 'Q1', reason: 'overvoltage', limit: 40 })
    expect(s.assembly.burns[0].value).toBeGreaterThan(55)
    expect(s.status).toBe('FAULT')
    for (let i = 0; i < 10; i++) await b.frame(1 / 60)
    expect(b.snapshot().values[0]).toBeGreaterThan(0.18) // shorted switch: the load is stuck ON
  })
})
