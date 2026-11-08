import { describe, expect, it } from 'vitest'
import type { Behavior, Lesson } from '../types'
import { createBench } from './simLoop'

// Behavior.onStep: every instantaneous solve of the frame's transient steps, in time order.
const lesson: Lesson = {
  id: 'onstep',
  fig: 1,
  track: 'T1',
  title: 'onStep',
  subtitle: '',
  tagline: '',
  board: { name: 'S', size: [4, 4], parts: [{ id: 'r', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['R1'] }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['a', '0'], value: 0, wave: { kind: 'sine', amp: 1, freq: 50 } },
      { id: 'R1', type: 'R', nodes: ['a', '0'], value: 100 },
    ],
  },
  powerElementId: 'V1',
  readouts: [],
  failures: [],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  sim: { dt: 1e-4 },
  behaviors: ['stepper'],
}

describe('Behavior.onStep', () => {
  it('sees every step of a frame, in time order, before tick', async () => {
    const seen: number[] = []
    const vs: number[] = []
    let tickAt = -1
    const stepper: Behavior = {
      id: 'stepper',
      onStep(_ctx, t, s) {
        seen.push(t)
        vs.push(s.voltageOf ? s.voltageOf('a') : s.nodeV.a)
      },
      tick() {
        tickAt = seen.length
      },
    }
    const b = createBench(lesson, { registry: { stepper } })
    b.dispatch('power')
    await b.frame(1 / 60)
    expect(seen.length).toBe(167) // ⌈(1/60) / 100 µs⌉
    expect(tickAt).toBe(167)
    for (let k = 1; k < seen.length; k++) expect(seen[k] - seen[k - 1]).toBeCloseTo(1e-4, 9)
    expect(seen.at(-1)).toBeCloseTo(b.t, 12)
    // instantaneous values, not frame samples: the sine is visible inside one frame
    for (let k = 0; k < seen.length; k++) expect(vs[k]).toBeCloseTo(Math.sin(2 * Math.PI * 50 * seen[k]), 6)
    b.dispose()
  })
})
