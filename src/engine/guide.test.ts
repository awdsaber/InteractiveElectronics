import { describe, expect, it } from 'vitest'
import { lesson as ledResistor } from '../lessons/T2/led-resistor'
import { type GuideBenchView, type GuideEvent, benchActionEvents, createGuide } from './guide'
import type { GuideCheck, GuideStep, Lesson } from './types'

const step = (id: string, check: GuideCheck, over: Partial<GuideStep> = {}): GuideStep => ({ id, title: id, body: id, check, ...over })
const lessonWith = (guide: GuideStep[]): Lesson => ({ ...(ledResistor as Lesson), fig: 2, guide })
const bench = (over: Partial<GuideBenchView> = {}): GuideBenchView => ({ status: 'READY', values: [0, 0, 0, 0], pins: {}, ...over })
const ui = (now: number, over = {}) => ({ now, ...over })

describe('guide evaluator', () => {
  it('starts at step 0, advances one step per evaluate when its check passes, then completes', () => {
    const g = createGuide(
      lessonWith([step('a', { kind: 'action', action: 'power' }), step('b', { kind: 'status', is: 'POWERED' }, { explain: 'why' })]),
    )
    let s = g.evaluate(bench(), [], ui(0))
    expect(s).toMatchObject({ current: 0, total: 2, complete: false, done: [] })
    expect(s.step?.id).toBe('a')
    s = g.evaluate(bench({ status: 'POWERED' }), [{ type: 'action', action: 'power' }], ui(10))
    expect(s).toMatchObject({ current: 1, done: ['a'] })
    expect(s.justDone?.id).toBe('a')
    // the new step is judged on the next call
    s = g.evaluate(bench({ status: 'POWERED' }), [], ui(20))
    expect(s).toMatchObject({ current: 2, done: ['a', 'b'], complete: true, step: null })
    expect(s.justDone?.explain).toBe('why')
  })

  it('event checks only count events since the step became active', () => {
    const g = createGuide(lessonWith([step('a', { kind: 'action', action: 'strip' }), step('b', { kind: 'action', action: 'strip' })]))
    const s = g.evaluate(bench(), [{ type: 'action', action: 'strip' }], ui(0))
    expect(s.current).toBe(1)
    expect(g.evaluate(bench(), [], ui(1)).current).toBe(1) // the strip that finished step a does not count for b
    expect(g.evaluate(bench(), [{ type: 'action', action: 'strip' }], ui(2)).current).toBe(2)
  })

  it('events seen before a step are kept for it while it is the active step', () => {
    const g = createGuide(lessonWith([step('a', { kind: 'all', of: [{ kind: 'action', action: 'power' }, { kind: 'status', is: 'POWERED' }] })]))
    expect(g.evaluate(bench(), [{ type: 'action', action: 'power' }], ui(0)).current).toBe(0)
    expect(g.evaluate(bench({ status: 'POWERED' }), [], ui(1)).current).toBe(1)
  })

  it('break: the event, or the failure already active on the bench', () => {
    const L = lessonWith([step('a', { kind: 'break', failure: 'no-resistor' }), step('b', { kind: 'break', failure: 'r-22' })])
    const g = createGuide(L)
    expect(g.evaluate(bench(), [{ type: 'break', failure: 'r-22' }], ui(0)).current).toBe(0)
    expect(g.evaluate(bench(), [{ type: 'break', failure: 'no-resistor' }], ui(1)).current).toBe(1)
    expect(g.evaluate(bench({ assembly: { failures: ['r-22'] } }), [], ui(2)).current).toBe(2)
  })

  it('tweak: by label or elementId.key, inside an inclusive range', () => {
    const g = createGuide(
      lessonWith([step('a', { kind: 'tweak', target: 'Series resistor', min: 1000 }), step('b', { kind: 'tweak', target: 'R1.value', max: 220 })]),
    )
    expect(g.evaluate(bench(), [], ui(0, { tweaks: { 'R1.value': 220 } })).current).toBe(0)
    expect(g.evaluate(bench(), [], ui(1, { tweaks: { 'R1.value': 1000 } })).current).toBe(1)
    expect(g.evaluate(bench(), [], ui(2, { tweaks: { 'R1.value': 1000 } })).current).toBe(1)
    expect(g.evaluate(bench(), [], ui(3, { tweaks: { 'R1.value': 220 } })).current).toBe(2)
  })

  it('readout: above/below must hold continuously for holdMs; a dip restarts the clock', () => {
    const g = createGuide(lessonWith([step('a', { kind: 'readout', index: 0, above: 0.01, below: 0.02, holdMs: 500 })]))
    const at = (v: number, t: number) => g.evaluate(bench({ values: [v, 0, 0, 0] }), [], ui(t)).current
    expect(at(0.013, 0)).toBe(0)
    expect(at(0.013, 400)).toBe(0)
    expect(at(0.005, 450)).toBe(0) // dipped: the hold restarts
    expect(at(0.013, 500)).toBe(0)
    expect(at(0.025, 600)).toBe(0) // above the window
    expect(at(0.013, 700)).toBe(0)
    expect(at(0.013, 1199)).toBe(0)
    expect(at(0.013, 1200)).toBe(1)
  })

  it('readout without holdMs passes at once; NaN never passes', () => {
    const g = createGuide(lessonWith([step('a', { kind: 'readout', index: 1, below: 1 })]))
    expect(g.evaluate(bench({ values: [0, NaN] }), [], ui(0)).current).toBe(0)
    expect(g.evaluate(bench({ values: [0, 0.5] }), [], ui(1)).current).toBe(1)
  })

  it('pin: an OUTPUT at that level', () => {
    const g = createGuide(lessonWith([step('a', { kind: 'pin', pin: 13, level: 1 })]))
    expect(g.evaluate(bench({ pins: { 13: { mode: 'INPUT', level: 1 } } }), [], ui(0)).current).toBe(0)
    expect(g.evaluate(bench({ pins: { 13: { mode: 'OUTPUT', level: 0 } } }), [], ui(1)).current).toBe(0)
    expect(g.evaluate(bench({ pins: { 13: { mode: 'OUTPUT', level: 1 } } }), [], ui(2)).current).toBe(1)
  })

  it('inspect and instruments: the event, or the UI already showing it', () => {
    const g = createGuide(
      lessonWith([step('a', { kind: 'inspect', part: 'r1' }), step('b', { kind: 'inspect', part: 'led1' }), step('c', { kind: 'instruments' }), step('d', { kind: 'instruments' })]),
    )
    expect(g.evaluate(bench(), [{ type: 'inspect', part: 'led1' }], ui(0)).current).toBe(0)
    expect(g.evaluate(bench(), [{ type: 'inspect', part: 'r1' }], ui(1)).current).toBe(1)
    expect(g.evaluate(bench(), [], ui(2, { selectedPart: 'led1' })).current).toBe(2)
    expect(g.evaluate(bench(), [{ type: 'instruments' }], ui(3)).current).toBe(3)
    expect(g.evaluate(bench(), [], ui(4, { instrumentsOpen: true })).current).toBe(4)
  })

  it('quiz and manual are events only', () => {
    const g = createGuide(lessonWith([step('a', { kind: 'manual' }), step('b', { kind: 'quiz' })]))
    expect(g.evaluate(bench(), [], ui(0)).current).toBe(0)
    expect(g.evaluate(bench(), [{ type: 'manual' }], ui(1)).current).toBe(1)
    expect(g.evaluate(bench(), [{ type: 'manual' }], ui(2)).current).toBe(1)
    expect(g.evaluate(bench(), [{ type: 'quiz' }], ui(3)).complete).toBe(true)
  })

  it('all / any compose, and holds inside them keep timing', () => {
    const check: GuideCheck = {
      kind: 'any',
      of: [{ kind: 'manual' }, { kind: 'all', of: [{ kind: 'status', is: 'RUNNING' }, { kind: 'readout', index: 0, above: 1, holdMs: 100 }] }],
    }
    const g = createGuide(lessonWith([step('a', check)]))
    const run = bench({ status: 'RUNNING', values: [2, 0, 0, 0] })
    expect(g.evaluate(run, [], ui(0)).current).toBe(0)
    expect(g.evaluate(run, [], ui(100)).current).toBe(1)
    const g2 = createGuide(lessonWith([step('a', check)]))
    expect(g2.evaluate(bench(), [{ type: 'manual' }], ui(0)).current).toBe(1)
  })

  it('back, skip, restart and goTo; skip does not mark done; back un-does the step', () => {
    const g = createGuide(lessonWith(['a', 'b', 'c'].map((id) => step(id, { kind: 'manual' }))))
    g.evaluate(bench(), [{ type: 'manual' }], ui(0))
    expect(g.skip(1)).toMatchObject({ current: 2, done: ['a'] })
    expect(g.back(2)).toMatchObject({ current: 1, done: ['a'] })
    expect(g.back(3)).toMatchObject({ current: 0, done: [] })
    expect(g.back(4)).toMatchObject({ current: 0 })
    expect(g.goTo(2, 5)).toMatchObject({ current: 2 })
    expect(g.skip(6)).toMatchObject({ current: 3, complete: true })
    expect(g.skip(7)).toMatchObject({ current: 3 })
    expect(g.restart(8)).toMatchObject({ current: 0, done: [], complete: false, justDone: null })
  })

  it('navigating clears the step events and holds', () => {
    const g = createGuide(lessonWith([step('a', { kind: 'manual' }), step('b', { kind: 'action', action: 'upload' })]))
    g.goTo(1, 0)
    g.evaluate(bench(), [{ type: 'action', action: 'explode' }], ui(1))
    g.back(2)
    g.skip(3)
    expect(g.evaluate(bench(), [], ui(4)).current).toBe(1)
  })

  it('resumes from saved progress (clamped, unknown ids dropped) and reports progress()', () => {
    const L = lessonWith(['a', 'b'].map((id) => step(id, { kind: 'manual' })))
    expect(createGuide(L, { current: 1, done: ['a', 'zz'] }).state()).toMatchObject({ current: 1, done: ['a'] })
    expect(createGuide(L, { current: 99, done: [] }).state()).toMatchObject({ current: 2, complete: true })
    expect(createGuide(L, { current: -3, done: 'x' as never }).state()).toMatchObject({ current: 0, done: [] })
    const g = createGuide(L)
    g.evaluate(bench(), [{ type: 'manual' }], ui(0))
    expect(g.progress()).toEqual({ current: 1, done: ['a'] })
  })

  it('a lesson without a guide is complete and empty', () => {
    const g = createGuide({ ...(ledResistor as Lesson), fig: 2, guide: undefined })
    expect(g.evaluate(bench(), [], ui(0))).toMatchObject({ total: 0, current: 0, complete: true, step: null })
  })

  it('since: when the active step became active', () => {
    const g = createGuide(lessonWith(['a', 'b'].map((id) => step(id, { kind: 'manual' }))), undefined, 5)
    expect(g.state().since).toBe(5)
    expect(g.evaluate(bench(), [{ type: 'manual' }], ui(40)).since).toBe(40)
  })
})

describe('benchActionEvents', () => {
  const e = (a: Parameters<typeof benchActionEvents>[0], before = false, after = false): GuideEvent[] =>
    benchActionEvents(a, { allPlaced: before }, { allPlaced: after })
  it('maps bench buttons to guide events', () => {
    expect(e('power')).toEqual([{ type: 'action', action: 'power' }])
    expect(e('power:V_MOTOR')).toEqual([{ type: 'action', action: 'power' }])
    expect(e('break:no-resistor')).toEqual([{ type: 'break', failure: 'no-resistor' }])
    expect(e('place:r1')).toEqual([{ type: 'action', action: 'place' }])
    // the last part placed by hand counts as place-all too
    expect(e('place:r1', false, true)).toEqual([{ type: 'action', action: 'place' }, { type: 'action', action: 'place-all' }])
    expect(e('place-all', false, true)).toEqual([{ type: 'action', action: 'place-all' }])
    expect(e('repair')).toEqual([{ type: 'action', action: 'repair' }])
  })
})
