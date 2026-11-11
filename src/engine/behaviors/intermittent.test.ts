import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { behavior } from './intermittent'

// A 5 V supply feeding a 1 kΩ load through a solder joint J1. The `intermittent` behavior makes J1
// a cracked joint once `active` is set (here by a failure): contact comes and goes at random.
const lesson: Lesson = {
  id: 'joint',
  fig: 1,
  track: 'T7',
  title: 'Joint',
  subtitle: '',
  tagline: '',
  board: { name: 'J', size: [4, 4], parts: [{ id: 'r', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['R1'] }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['a', '0'], value: 5 },
      { id: 'SW_P', type: 'SW', nodes: ['a', 'b'], closed: true },
      { id: 'J1', type: 'R', nodes: ['b', 'l'], value: 0.01 },
      { id: 'R1', type: 'R', nodes: ['l', '0'], value: 1000 },
    ],
  },
  powerElementId: 'SW_P',
  readouts: [{ label: 'V', source: { kind: 'voltage', node: 'l' }, unit: 'V' }],
  tweaks: [],
  failures: [{ id: 'crack', label: 'crack', explain: '', patches: [{ op: 'set', elementId: 'behavior:joint', key: 'active', value: 1 }] }],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  behaviors: [{ id: 'intermittent', instance: 'joint', params: { element: 'J1', good: 0.01, bad: 1000, goodMs: 300, badMs: 100 } }],
}

const FRAME = 1 / 60

describe('intermittent behavior (a cracked solder joint)', () => {
  it('inactive: the joint is a good contact; active: it breaks and remakes at random, and repair heals it', async () => {
    const b = createBench(lesson, { registry: { intermittent: behavior } })
    b.dispatch('power')
    for (let i = 0; i < 30; i++) await b.frame(FRAME)
    expect(b.snapshot().values[0]).toBeCloseTo(5, 2)
    expect(b.snapshot().published['joint.breaks']).toBe(0)

    b.dispatch('break:crack')
    const seen: number[] = []
    for (let i = 0; i < 6 * 60; i++) {
      await b.frame(FRAME)
      seen.push(b.snapshot().values[0])
    }
    // bad contact: 5 V × 1000 / (1000 + 1000) = 2.5 V; good contact: 5 V
    const low = seen.filter((v) => v < 2.6 && v > 2.4).length
    const high = seen.filter((v) => v > 4.99).length
    expect(low).toBeGreaterThan(20)
    expect(high).toBeGreaterThan(100)
    expect(low + high).toBe(seen.length)
    const breaks = b.snapshot().published['joint.breaks']
    expect(breaks).toBeGreaterThan(5) // a mean cycle of 0.4 s over 6 s
    expect(breaks).toBeLessThan(40)

    b.dispatch('repair')
    for (let i = 0; i < 30; i++) await b.frame(FRAME)
    expect(b.snapshot().values[0]).toBeCloseTo(5, 2)
    expect(b.snapshot().published['joint.bad']).toBe(0)
    b.dispose()
  })

  it('is deterministic for a seed', async () => {
    const trace = async () => {
      const b = createBench(lesson, { registry: { intermittent: behavior } })
      b.dispatch('power')
      b.dispatch('break:crack')
      const out: number[] = []
      for (let i = 0; i < 120; i++) {
        await b.frame(FRAME)
        out.push(b.snapshot().published['joint.bad'])
      }
      b.dispose()
      return out
    }
    expect(await trace()).toEqual(await trace())
  })
})
