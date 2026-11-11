import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { behavior } from './tmp36'

// a TMP36 as a voltage source between its output and its own ground pin, read by a divider-free node
const lesson: Lesson = {
  id: 'tmp',
  fig: 1,
  track: 'T6',
  title: 'TMP36',
  subtitle: '',
  tagline: '',
  board: { name: 'T', size: [4, 4], parts: [{ id: 'u', kind: 'transistor-to92', pos: [0, 0], mount: 'tht', role: 'u', circuitIds: ['TMP'] }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['5v', '0'], value: 5 },
      // the sensor's ground pin sits on a 0.1 Ω wire carrying 1 A, so it is 0.1 V above node 0
      { id: 'I_GND', type: 'I', nodes: ['5v', 'g'], value: 1 },
      { id: 'R_GND', type: 'R', nodes: ['g', '0'], value: 0.1 },
      { id: 'TMP', type: 'V', nodes: ['out', 'g'], value: 0 },
      { id: 'R_LOAD', type: 'R', nodes: ['out', '0'], value: 1e6 },
    ],
  },
  powerElementId: 'V1',
  readouts: [
    { label: 'OUT', source: { kind: 'voltage', node: 'out', ref: 'g' }, unit: 'V' },
    { label: 'OUT VS 0', source: { kind: 'voltage', node: 'out' }, unit: 'V' },
  ],
  tweaks: [{ label: 'Temperature', elementId: 'behavior:tmp', key: 'tempC', min: -40, max: 125, unit: '°C' }],
  failures: [],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  behaviors: [{ id: 'tmp36', instance: 'tmp', params: { element: 'TMP', tempC: 25 } }],
}

async function settle(b: ReturnType<typeof createBench>) {
  for (let i = 0; i < 3; i++) await b.frame(1 / 60)
  return b.snapshot()
}

describe('tmp36 behavior', () => {
  it('sets the source to 0.5 V + 10 mV/°C: 750 mV at 25 °C, relative to its own ground pin', async () => {
    const b = createBench(lesson, { registry: { tmp36: behavior } })
    b.dispatch('power')
    const s = await settle(b)
    expect(s.values[0]).toBeCloseTo(0.75, 6)
    // node 0 sees the ground-pin offset added: the error the lesson is about
    expect(s.values[1]).toBeCloseTo(0.85, 4)
    expect(s.published['tmp.true_C']).toBe(25)
    expect(s.published['tmp.out_V']).toBeCloseTo(0.75, 9)
    b.dispose()
  })

  it('follows a temperature tweak (100 °C: 1.5 V; −40 °C: 0.1 V) and clamps to the rated −40…125 °C', async () => {
    const b = createBench(lesson, { registry: { tmp36: behavior } })
    b.dispatch('power')
    b.setTweak('behavior:tmp.tempC', 100)
    expect((await settle(b)).values[0]).toBeCloseTo(1.5, 6)
    b.setTweak('behavior:tmp.tempC', -40)
    expect((await settle(b)).values[0]).toBeCloseTo(0.1, 6)
    b.setTweak('behavior:tmp.tempC', 200)
    const s = await settle(b)
    expect(s.values[0]).toBeCloseTo(1.75, 6)
    expect(s.published['tmp.true_C']).toBe(125)
    b.dispose()
  })

  it('applies the temperature at init, before power-on', () => {
    const b = createBench(lesson, { registry: { tmp36: behavior } })
    expect(b.snapshot().elementValues['TMP.value']).toBeCloseTo(0.75, 9)
    b.dispose()
  })
})
