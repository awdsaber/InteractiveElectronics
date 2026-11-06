import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { BehaviorContext, Lesson } from '../types'
import { behavior, parsePlotterLine } from './serial-plotter'

describe('parsePlotterLine (Arduino Serial Plotter format)', () => {
  it('reads name:value pairs separated by commas', () => {
    expect(parsePlotterLine('raw:510,volts:2.49')).toEqual([
      ['raw', 510],
      ['volts', 2.49],
    ])
  })

  it('accepts spaces and tabs as separators and skips words without a value', () => {
    expect(parsePlotterLine('press raw:614\tvolts:3.00')).toEqual([
      ['raw', 614],
      ['volts', 3],
    ])
  })

  it('numbers bare values v1, v2… by their position among the values', () => {
    expect(parsePlotterLine('12, -3.5 temp:21')).toEqual([
      ['v1', 12],
      ['v2', -3.5],
      ['temp', 21],
    ])
  })

  it('ignores text lines, empty names and non-numbers', () => {
    expect(parsePlotterLine('Uno tour ready')).toEqual([])
    expect(parsePlotterLine(':5,x:abc,y:,z:1e3')).toEqual([['z', 1000]])
    expect(parsePlotterLine('')).toEqual([])
  })
})

describe('serial-plotter behavior', () => {
  it('publishes each value as <instance>.<name>', () => {
    const out: Record<string, number> = {}
    const ctx = { publish: (k: string, v: number) => (out[k] = v), params: {} } as unknown as BehaviorContext
    behavior.onSerial!(ctx, 'press raw:510,volts:2.49')
    behavior.onSerial!(ctx, 'raw:511')
    expect(out).toEqual({ raw: 511, volts: 2.49 })
  })

  it('drives a behavior readout from a running sketch', async () => {
    const lesson: Lesson = {
      id: 'plot',
      fig: 1,
      track: 'T4',
      title: 'Plot',
      subtitle: '',
      tagline: '',
      board: { name: 'P', size: [4, 4], parts: [{ id: 'r', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['R1'] }] },
      circuit: {
        elements: [
          { id: 'V1', type: 'V', nodes: ['v', '0'], value: 5 },
          { id: 'R1', type: 'R', nodes: ['v', '0'], value: 1000 },
        ],
      },
      powerElementId: 'V1',
      readouts: [{ label: 'COUNT', source: { kind: 'behavior', key: 'serial.count' }, unit: '' }],
      sketch: {
        title: 'Count',
        code: 'int n = 0;\nvoid setup() { Serial.begin(9600); }\nvoid loop() { n++; Serial.print("count:"); Serial.println(n); delay(100); }\n',
        pins: {},
        vcc: 5,
        board: 'uno',
      },
      failures: [],
      meet: '',
      mechanicalAnalogy: '',
      proTips: [],
      quiz: [],
      behaviors: [{ id: 'serial-plotter', instance: 'serial' }],
    }
    const b = createBench(lesson, { registry: { 'serial-plotter': behavior } })
    b.dispatch('power')
    b.upload()
    for (let i = 0; i < 40; i++) await b.frame(1 / 60) // ≈ 0.67 s of sim time: 7 lines
    const s = b.snapshot()
    expect(s.values[0]).toBeGreaterThanOrEqual(6)
    expect(s.values[0]).toBeLessThanOrEqual(8)
    b.dispatch('power') // off: published values clear
    expect(b.snapshot().published['serial.count']).toBeUndefined()
    b.dispose()
  })
})
