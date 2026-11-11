import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { behavior as pcbTour } from './pcb-tour'

const lesson: Lesson = {
  id: 'tour',
  fig: 1,
  track: 'T7',
  title: 'Tour',
  subtitle: '',
  tagline: '',
  board: { name: 'T', size: [4, 4], parts: [{ id: 'j', kind: 'screw-terminal', pos: [0, 0], mount: 'tht', role: 'j' }] },
  circuit: { elements: [{ id: 'V1', type: 'V', nodes: ['a', '0'], value: 1 }, { id: 'R', type: 'R', nodes: ['a', '0'], value: 1 }] },
  powerElementId: 'V1',
  readouts: [{ label: 'DRC', source: { kind: 'behavior', key: 'tour.drc_errors' }, unit: '' }],
  tweaks: [
    { label: 'Layer', elementId: 'behavior:tour', key: 'view', kind: 'enum', min: 0, max: 6, unit: '', options: [{ label: 'All', value: 0 }, { label: 'Mask', value: 4 }] },
    { label: 'Width', elementId: 'behavior:tour', key: 'w', min: 0.1, max: 2, unit: '' },
  ],
  failures: [],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  // no width / current keys: the fallback params `w` and `a` stand in, so the test needs no other behavior
  behaviors: [{ id: 'pcb-tour', instance: 'tour', params: { view: 0, drc: 0, staticErrors: 3, widthKey: '', ampsKey: '', oz: 1, riseC: 10, w: 0.3, a: 2 } }],
}

async function run(b: ReturnType<typeof createBench>, n = 4) {
  for (let i = 0; i < n; i++) await b.frame(1 / 60)
  return b.snapshot()
}

describe('pcb-tour behavior', () => {
  it('publishes the view, the overlay switch and the DRC count: static errors + the live trace-width rule', async () => {
    const b = createBench(lesson, { registry: { 'pcb-tour': pcbTour } })
    b.dispatch('power')
    let s = await run(b)
    expect(s.published['tour.view']).toBe(0)
    expect(s.published['tour.drc']).toBe(0)
    // 0.30 mm for 2 A fails IPC-2221 (0.78 mm): 3 + 1
    expect(s.published['tour.wmin_mm']).toBeCloseTo(0.78, 2)
    expect(s.published['tour.drc_errors']).toBe(4)
    expect(s.published['tour.trace_ok']).toBe(0)
    b.setTweak('behavior:tour.w', 0.8)
    b.setTweak('behavior:tour.view', 4)
    s = await run(b)
    expect(s.published['tour.drc_errors']).toBe(3)
    expect(s.published['tour.trace_ok']).toBe(1)
    expect(s.published['tour.view']).toBe(4)
    b.dispose()
  })
})
