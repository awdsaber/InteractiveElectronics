// Schema checks for `lesson.guide`: shape, and cross-references (failures, parts, tweaks, readouts, pins).
import { describe, expect, it } from 'vitest'
import { lesson as ledResistor } from '../lessons/T2/led-resistor'
import { validateLesson } from './lessonSchema'
import type { GuideCheck, GuideStep, Lesson } from './types'

const base = { ...(ledResistor as Lesson), fig: 1, guide: undefined }
const step = (check: GuideCheck, over: Partial<GuideStep> = {}): GuideStep => ({ id: 's', title: 'T', body: 'B', check, ...over })
const v = (guide: GuideStep[]) => validateLesson({ ...base, guide })

describe('lessonSchema: guide', () => {
  it('accepts every check kind with real references', () => {
    expect(
      v([
        step({ kind: 'action', action: 'place-all' }, { id: 'a' }),
        step({ kind: 'status', is: 'RUNNING' }, { id: 'b', focus: { control: 'power', part: 'led1' } }),
        step({ kind: 'break', failure: 'no-resistor' }, { id: 'c', focus: { control: 'break' } }),
        step({ kind: 'tweak', target: 'Series resistor', min: 400 }, { id: 'd', focus: { control: 'tweak:Series resistor' } }),
        step({ kind: 'tweak', target: 'R1.value', max: 300 }, { id: 'e' }),
        step({ kind: 'readout', index: 0, above: 0.01, holdMs: 500 }, { id: 'f' }),
        step({ kind: 'pin', pin: 13, level: 1 }, { id: 'g' }),
        step({ kind: 'inspect', part: 'r1' }, { id: 'h', hint: 'Click it', explain: 'Nice' }),
        step({ kind: 'all', of: [{ kind: 'instruments' }, { kind: 'any', of: [{ kind: 'quiz' }, { kind: 'manual' }] }] }, { id: 'i' }),
      ]),
    ).toEqual([])
  })

  it('rejects malformed steps', () => {
    expect(v([step({ kind: 'action', action: 'dance' as never })])[0]).toMatch(/^guide\.0\.check/)
    expect(v([step({ kind: 'all', of: [] })])[0]).toMatch(/^guide\.0\.check/)
    expect(v([{ id: 'x', title: '', body: 'b', check: { kind: 'manual' } }])[0]).toMatch(/^guide\.0\.title/)
    expect(v([step({ kind: 'manual' }, { focus: { control: 'nope' as never } })])[0]).toMatch(/^guide\.0\.focus/)
  })

  it('cross-references every id, label, index and pin', () => {
    expect(v([step({ kind: 'break', failure: 'nope' })])).toEqual(['guide.0.check: no failure "nope"'])
    expect(v([step({ kind: 'inspect', part: 'nope' })])).toEqual(['guide.0.check: no part "nope"'])
    expect(v([step({ kind: 'tweak', target: 'Volume' })])).toEqual(['guide.0.check: no tweak "Volume" (use its label or elementId.key)'])
    expect(v([step({ kind: 'tweak', target: 'R1.value', min: 5, max: 1 })])).toEqual(['guide.0.check: max must be at least min'])
    expect(v([step({ kind: 'readout', index: 9, above: 1 })])).toEqual(['guide.0.check: no readout 9'])
    expect(v([step({ kind: 'readout', index: 0 })])).toEqual(['guide.0.check: a readout check needs above and/or below'])
    expect(v([step({ kind: 'pin', pin: 7, level: 1 })])).toEqual(['guide.0.check: pin 7 is not in sketch.pins'])
    expect(v([step({ kind: 'all', of: [{ kind: 'manual' }, { kind: 'break', failure: 'zz' }] })])).toEqual(['guide.0.check.of.1: no failure "zz"'])
    expect(v([step({ kind: 'manual' }, { focus: { part: 'zz' } })])).toEqual(['guide.0.focus: no part "zz"'])
    expect(v([step({ kind: 'manual' }, { focus: { control: 'tweak:Nope' } })])).toEqual(['guide.0.focus: no tweak "Nope"'])
    expect(v([step({ kind: 'manual' }), step({ kind: 'manual' })])).toEqual(['guide: duplicate step id "s"'])
  })

  it('a focus on upload or code needs a sketch; pick-place and solder need a PCB', () => {
    const noSketch = { ...base, sketch: undefined, statusLines: [] }
    expect(validateLesson({ ...noSketch, guide: [step({ kind: 'manual' }, { focus: { control: 'upload' } })] })).toEqual([
      'guide.0.focus: "upload" needs a sketch',
    ])
    expect(v([step({ kind: 'action', action: 'solder' }, { focus: { control: 'solder' } })])).toEqual([
      'guide.0.check: a breadboard bench has no "solder" button',
      'guide.0.focus: a breadboard bench has no "solder" button',
    ])
  })
})
