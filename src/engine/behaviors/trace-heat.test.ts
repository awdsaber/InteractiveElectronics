import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import { ipcRise, traceResistance } from '../pcb/ipc2221'
import type { Lesson } from '../types'
import { behavior as eLoad } from './e-load'
import { behavior as traceHeat } from './trace-heat'

// 12 V → a copper trace (an R the behavior sizes) → an electronic load holding 2 A
const lesson: Lesson = {
  id: 'trace',
  fig: 1,
  track: 'T7',
  title: 'Trace',
  subtitle: '',
  tagline: '',
  board: { name: 'T', size: [4, 4], parts: [{ id: 'j', kind: 'screw-terminal', pos: [0, 0], mount: 'tht', role: 'j' }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['vin', '0'], value: 12, rInternal: 0.05 },
      { id: 'TRACE', type: 'R', nodes: ['vin', 'out'], value: 0.05 },
      { id: 'R_LOAD', type: 'R', nodes: ['out', '0'], value: 6 },
    ],
  },
  powerElementId: 'V1',
  readouts: [
    { label: 'I', source: { kind: 'current', elementId: 'TRACE' }, unit: 'A' },
    { label: 'DROP', source: { kind: 'voltage', node: 'vin', ref: 'out' }, unit: 'V' },
  ],
  tweaks: [
    { label: 'Width', elementId: 'behavior:tr', key: 'widthMm', min: 0.1, max: 1.5, unit: '' },
    { label: 'Load', elementId: 'behavior:load', key: 'iSet', min: 0, max: 3, unit: 'A' },
  ],
  failures: [{ id: 'thin', label: 'Thin', explain: '', patches: [{ op: 'set', elementId: 'behavior:tr', key: 'widthMm', value: 0.1 }] }],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  behaviors: [
    { id: 'trace-heat', instance: 'tr', params: { element: 'TRACE', widthMm: 0.8, oz: 1, lengthMm: 50, ambientC: 25, tau: 1.5, failC: 300 } },
    { id: 'e-load', instance: 'load', params: { element: 'R_LOAD', node: 'out', iSet: 2 } },
  ],
}

const registry = { 'trace-heat': traceHeat, 'e-load': eLoad }

async function run(b: ReturnType<typeof createBench>, sec: number) {
  for (let i = 0; i < Math.round(sec * 60); i++) await b.frame(1 / 60)
  return b.snapshot()
}

describe('e-load behavior', () => {
  it('holds the set current whatever the trace drops', async () => {
    const b = createBench(lesson, { registry })
    b.dispatch('power')
    let s = await run(b, 1)
    expect(s.values[0]).toBeCloseTo(2, 2)
    expect(s.published['load.iSet']).toBe(2)
    b.setTweak('behavior:load.iSet', 1)
    s = await run(b, 1)
    expect(s.values[0]).toBeCloseTo(1, 2)
    b.dispose()
  })
})

describe('trace-heat behavior (IPC-2221 + copper resistance)', () => {
  it('0.80 mm at 2 A: about a 10 °C rise, 50 mm of trace ≈ 31 mΩ, 62 mV drop', async () => {
    const b = createBench(lesson, { registry })
    b.dispatch('power')
    const s = await run(b, 8)
    const rise = ipcRise(2, 0.8, 1)
    expect(rise).toBeGreaterThan(9)
    expect(rise).toBeLessThan(10.5)
    expect(s.published['tr.temp_C']).toBeCloseTo(25 + rise, 0)
    expect(s.published['tr.dT_ss']).toBeCloseTo(rise, 1)
    expect(s.published['tr.r_ohm']).toBeCloseTo(traceResistance(50, 0.8, 1, 25 + rise), 3)
    expect(s.published['tr.widthMm']).toBe(0.8)
    expect(s.published['tr.wmin_mm']).toBeCloseTo(0.78, 2)
    expect(s.values[1]).toBeCloseTo(2 * traceResistance(50, 0.8, 1, 25 + rise), 2)
    expect(s.status).toBe('POWERED')
    b.dispose()
  })

  it('0.30 mm at 2 A runs about 48 °C over ambient and heats with a lag, not at once', async () => {
    const b = createBench(lesson, { registry, tweaks: { 'behavior:tr.widthMm': 0.3 } })
    b.dispatch('power')
    const early = (await run(b, 0.3)).published['tr.temp_C']
    const s = await run(b, 10)
    expect(early).toBeLessThan(s.published['tr.temp_C'] - 10)
    expect(s.published['tr.temp_C']).toBeCloseTo(25 + ipcRise(2, 0.3, 1), 0)
    expect(s.status).toBe('POWERED')
    b.dispose()
  })

  it('0.10 mm at 2 A: the estimate passes 300 °C, the trace opens and the load loses its current', async () => {
    const b = createBench(lesson, { registry })
    b.dispatch('power')
    await run(b, 1)
    b.dispatch('break:thin')
    const s = await run(b, 10)
    expect(s.status).toBe('FAULT')
    expect(s.assembly.burns.map((x) => [x.elementId, x.reason])).toEqual([['TRACE', 'overtemp']])
    expect(s.values[0]).toBeLessThan(0.01)
    b.dispatch('repair')
    const r = await run(b, 1)
    expect(r.assembly.burns).toEqual([])
    b.dispose()
  })

  it('2 oz copper halves the resistance and needs about half the width', async () => {
    const b = createBench(lesson, { registry, tweaks: { 'behavior:tr.widthMm': 0.8 } })
    b.dispatch('power')
    const one = await run(b, 6)
    b.dispose()
    const l2 = { ...lesson, behaviors: [{ ...(lesson.behaviors![0] as object), params: { ...(lesson.behaviors![0] as { params: object }).params, oz: 2 } }, lesson.behaviors![1]] } as Lesson
    const b2 = createBench(l2, { registry })
    b2.dispatch('power')
    const two = await run(b2, 6)
    expect(two.published['tr.wmin_mm']).toBeCloseTo(0.39, 2)
    expect(two.published['tr.r_ohm']).toBeLessThan(one.published['tr.r_ohm'] * 0.55)
    b2.dispose()
  })
})
