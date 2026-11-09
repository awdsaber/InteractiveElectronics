// The two pilot guides, driven end to end headless: a real bench (createBench) and the guide
// evaluator, doing what each step asks the way the store would (bench actions → guide events).
import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../engine/guide'
import { validateLesson } from '../engine/lessonSchema'
import type { Lesson } from '../engine/types'
import type { BenchAction } from '../ui/types'
import { getLesson } from './index'

const FRAME = 1 / 60

/** a tiny store: the bench, the guide, the UI state a guide reads, and a ms clock */
function rig(id: string) {
  const L = getLesson(id) as Lesson
  const b: Bench = createBench(L)
  const g = createGuide(L)
  const ui: Required<GuideUi> = { now: 0, tweaks: b.tweakValues(), selectedPart: null, instrumentsOpen: false }
  let pending: GuideEvent[] = []
  const evaluate = () => {
    ui.tweaks = b.tweakValues()
    const s = g.evaluate(b.snapshot(), pending, ui)
    pending = []
    return s
  }
  return {
    L,
    b,
    g,
    act(a: BenchAction) {
      const before = b.snapshot()
      b.dispatch(a)
      pending.push(...benchActionEvents(a, before, b.snapshot()))
    },
    tweak(label: string, v: number) {
      const t = L.tweaks!.find((x) => x.label === label)!
      b.setTweak(`${t.elementId}.${t.key}`, v)
    },
    inspect(part: string) {
      ui.selectedPart = part
      pending.push({ type: 'inspect', part })
    },
    event(e: GuideEvent) {
      pending.push(e)
    },
    /** run frames (evaluating after each) until the guide leaves step `id`; fails after `sec` */
    async finish(id: string, sec = 3) {
      expect(g.state().step?.id).toBe(id)
      const start = g.state().current
      for (let i = 0; i < Math.round(sec / FRAME); i++) {
        if (evaluate().current !== start) return
        await b.frame(FRAME)
        ui.now += FRAME * 1000
      }
      throw new Error(`step "${id}" did not complete in ${sec} s; values ${b.snapshot().values.join(', ')}`)
    },
  }
}

describe('pilot guide: led-resistor', () => {
  it('validates and has 5–9 steps, ending with break, repair and the quiz', () => {
    const L = getLesson('led-resistor') as Lesson
    expect(validateLesson(L)).toEqual([])
    expect(L.guide!.length).toBeGreaterThanOrEqual(5)
    expect(L.guide!.length).toBeLessThanOrEqual(9)
    expect(L.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
  })

  it('runs end to end through the bench and the evaluator', async () => {
    const r = rig('led-resistor')
    r.inspect('r1')
    await r.finish('meet-the-resistor')
    r.act('power')
    await r.finish('plug-usb')
    r.act('upload')
    await r.finish('upload-blink')
    await r.finish('read-13-ma')
    r.tweak('Series resistor', 1000)
    await r.finish('dim-it')
    r.act('break:no-resistor')
    await r.finish('break-it')
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    expect(r.g.state()).toMatchObject({ complete: true, done: r.L.guide!.map((s) => s.id) })
    r.b.dispose()
  })

  it('does not pass the 13 mA step on the dark half of the blink, or the dim step at 220 Ω', async () => {
    const r = rig('led-resistor')
    r.g.goTo(3)
    r.act('power')
    r.act('upload')
    await r.finish('read-13-ma')
    // 220 Ω still fitted: the dim step waits for the tweak, however long the LED blinks
    await expect(r.finish('dim-it', 2)).rejects.toThrow(/did not complete/)
    r.b.dispose()
  })
})

describe('pilot guide: ohms-law', () => {
  it('validates and has 5–9 steps, ending with the quiz', () => {
    const L = getLesson('ohms-law') as Lesson
    expect(validateLesson(L)).toEqual([])
    expect(L.guide!.length).toBeGreaterThanOrEqual(5)
    expect(L.guide!.length).toBeLessThanOrEqual(9)
    expect(L.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
  })

  it('runs end to end through the bench and the evaluator', async () => {
    const r = rig('ohms-law')
    r.inspect('r1')
    await r.finish('find-the-load')
    r.act('power')
    await r.finish('output-on')
    r.tweak('Supply voltage', 10)
    await r.finish('double-the-volts')
    r.tweak('Resistance', 2000)
    await r.finish('double-the-ohms')
    r.tweak('Resistance', 1000)
    r.tweak('Supply voltage', 12)
    await r.finish('watch-the-power')
    expect(r.b.snapshot().assembly.burns).toEqual([])
    r.act('break:short-output')
    await r.finish('short-it')
    expect(r.b.snapshot().assembly.burns).toEqual([])
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    expect(r.g.state()).toMatchObject({ complete: true, done: r.L.guide!.map((s) => s.id) })
    r.b.dispose()
  })
})
