// Schema checks for the X4 authoring fields: tweak kinds / options / links, derived and peak
// readouts, sim speed and instrument defaults.
import { describe, expect, it } from 'vitest'
import { lesson as ledResistor } from '../lessons/T2/led-resistor'
import { validateLesson } from './lessonSchema'
import type { Lesson } from './types'

const base = { ...(ledResistor as Lesson), fig: 1 }
const v = (over: Partial<Lesson>) => validateLesson({ ...base, ...over })
const R1 = base.circuit.elements.find((e) => e.type === 'R')!.id

describe('lessonSchema: X4 fields', () => {
  it('the reference lesson is valid', () => {
    expect(v({})).toEqual([])
  })

  it('tweak kinds: enum needs options within min..max; options only on enum', () => {
    const tw = { label: 'R', elementId: R1, key: 'value', min: 100, max: 1000, unit: 'Ω' }
    expect(v({ tweaks: [{ ...tw, kind: 'enum', options: [{ label: 'a', value: 100 }, { label: 'b', value: 470 }] }] })).toEqual([])
    expect(v({ tweaks: [{ ...tw, kind: 'enum' }] })).toEqual(['tweaks.0: an enum tweak needs at least 2 options'])
    expect(v({ tweaks: [{ ...tw, kind: 'enum', options: [{ label: 'a', value: 100 }, { label: 'b', value: 5000 }] }] })).toEqual([
      'tweaks.0: option "b" (5000) is outside min..max',
    ])
    expect(v({ tweaks: [{ ...tw, options: [{ label: 'a', value: 100 }, { label: 'b', value: 200 }] }] })).toEqual([
      'tweaks.0: options are only for kind "enum"',
    ])
    expect(v({ tweaks: [{ ...tw, kind: 'momentary' }, { ...tw, kind: 'toggle' }] })).toEqual([])
    expect(v({ tweaks: [{ ...tw, kind: 'knob' as never }] })[0]).toMatch(/^tweaks\.0\.kind/)
  })

  it('tweak links must name real elements / keys or behavior instances', () => {
    const tw = { label: 'R', elementId: R1, key: 'value', min: 100, max: 1000, unit: 'Ω' }
    expect(v({ tweaks: [{ ...tw, link: [{ elementId: R1, key: 'value', scale: 2 }] }] })).toEqual([])
    expect(v({ tweaks: [{ ...tw, link: [{ elementId: 'NOPE', key: 'value' }] }] })).toEqual(['tweaks.0.link.0: no element "NOPE"'])
    expect(v({ tweaks: [{ ...tw, link: [{ elementId: R1, key: 'zz' }] }] })).toEqual([`tweaks.0.link.0: R "${R1}" has no key "zz"`])
    expect(v({ tweaks: [{ ...tw, link: [{ elementId: 'behavior:none', key: 'x' }] }] })).toEqual(['tweaks.0.link.0: no behavior instance "none"'])
  })

  it('derived readouts and peak-hold', () => {
    const r = base.readouts[0]
    expect(v({ readouts: [r, r, { label: 'S', source: { kind: 'derived', op: 'sum', of: [0, 1] }, unit: 'A', peak: true }] })).toEqual([])
    expect(v({ readouts: [r, { label: 'S', source: { kind: 'derived', op: 'ratio', of: [0, 4] }, unit: '' }] })).toEqual(['readouts.1: no readout 4'])
    expect(v({ readouts: [{ label: 'S', source: { kind: 'derived', op: 'sum', of: [0, 0] }, unit: '' }] })[0]).toMatch(/cycle/)
  })

  it('every readout unit the lessons ask for', () => {
    for (const unit of ['%', 's', 'counts', 'µs', 'mΩ', 'dBm', 'C', 'Hz'] as const) {
      expect(v({ readouts: [{ ...base.readouts[0], unit }] })).toEqual([])
    }
  })

  it('sim.speed is positive', () => {
    expect(v({ sim: { speed: 0.1 } })).toEqual([])
    expect(v({ sim: { speed: 0 } })[0]).toMatch(/^sim\.speed/)
  })

  it('instrument defaults: scope channels, trigger and chart signals are checked against the lesson', () => {
    const node = base.circuit.elements[0].nodes[0]
    const ok: Lesson['instruments'] = {
      open: true,
      scope: {
        channels: [
          { source: { kind: 'voltage', node, ref: '0' }, perDiv: 1, offset: -2, marks: [{ value: 3, label: 'x' }] },
          { source: { kind: 'current', elementId: R1 } },
        ],
        timePerDiv: 1e-3,
        trigger: { channel: 1, level: 0.01, slope: 'falling', mode: 'normal' },
      },
      chart: { signals: [0, { label: 'V', source: { kind: 'voltage', node }, unit: 'V' }], span: 5 },
    }
    expect(v({ instruments: ok })).toEqual([])
    expect(
      v({
        instruments: {
          scope: { channels: [{ source: { kind: 'voltage', node: 'zz' } }], trigger: { channel: 1 } },
          chart: { signals: [9, { label: 'I', source: { kind: 'current', elementId: 'NOPE' }, unit: 'A' }] },
        },
      }),
    ).toEqual([
      'instruments.scope.channels.0: no node "zz"',
      'instruments.scope.trigger: no channel 1',
      'instruments.chart.signals.0: no readout 9',
      'instruments.chart.signals.1: no element "NOPE"',
    ])
    expect(v({ instruments: { scope: { channels: [] } } })[0]).toMatch(/^instruments\.scope\.channels/)
    expect(v({ instruments: { scope: { channels: [{ source: { kind: 'voltage', node } }], timePerDiv: 0 } } })[0]).toMatch(/timePerDiv/)
  })
})

describe('lessonSchema: part facts (part inspector)', () => {
  const withFacts = (facts: unknown) => ({ board: { ...base.board, parts: base.board.parts.map((p, i) => (i === 0 ? { ...p, facts } : p)) } }) as Partial<Lesson>
  it('facts are optional, non-empty strings', () => {
    expect(v(withFacts(['Vf 2.0 V at 20 mA', 'IF max 30 mA']))).toEqual([])
    expect(v(withFacts(undefined))).toEqual([])
    expect(v(withFacts([3]))[0]).toMatch(/^board\.parts\.0\.facts\.0/)
    expect(v(withFacts(['']))[0]).toMatch(/^board\.parts\.0\.facts\.0/)
  })
})
