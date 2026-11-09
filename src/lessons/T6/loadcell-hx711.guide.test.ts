// The loadcell-hx711 guide driven end to end headless: a real bench and the guide evaluator, doing
// exactly what each step asks (same rig as guidesBatchC.test.ts), with no skips. The calibrate
// step edits the sketch's calFactor to the PER GRAM value the bench shows and re-uploads.
import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../../engine/guide'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import type { BenchAction } from '../../ui/types'
import { getLesson } from '../index'

const FRAME = 1 / 60
const L = getLesson('loadcell-hx711') as Lesson

function rig() {
  const b: Bench = createBench(L, { speed: L.sim?.speed })
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
    async run(sec: number) {
      for (let i = 0; i < Math.round(sec / FRAME); i++) {
        await b.frame(FRAME)
        ui.now += FRAME * 1000
      }
    },
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

describe('loadcell-hx711 guide', () => {
  it('shape: validates, 5–9 steps, at most one manual, ends on the quiz', () => {
    expect(validateLesson(L)).toEqual([])
    const n = L.guide!.length
    expect(n).toBeGreaterThanOrEqual(5)
    expect(n).toBeLessThanOrEqual(9)
    expect(L.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
    expect(JSON.stringify(L.guide).split('"manual"').length - 1).toBeLessThanOrEqual(1)
  })

  it('end to end: every step completes with no skips', async () => {
    const r = rig()
    r.inspect('cell')
    await r.finish('meet-the-cell')
    r.act('power')
    await r.finish('power')
    r.act('upload')
    await r.finish('upload', 5)
    r.tweak('Mass on pan', 500)
    await r.finish('place-500', 3)

    // calibrate: read PER GRAM, empty the pan, edit calFactor, upload, 500 g back on
    const perG = r.b.snapshot().values[5]
    expect(perG).toBeGreaterThan(2095)
    expect(perG).toBeLessThan(2115)
    r.tweak('Mass on pan', 0)
    await r.run(0.6)
    r.b.setCode(r.b.code.replace('float calFactor = 2147.0;', `float calFactor = ${perG.toFixed(1)};`))
    r.act('upload')
    await r.run(2.6)
    r.tweak('Mass on pan', 500)
    await r.finish('calibrate', 4)

    r.tweak('Mass on pan', 0)
    await r.run(1.2)
    r.act('break:overload')
    await r.finish('overload', 5)
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    expect(r.g.state()).toMatchObject({ complete: true, done: L.guide!.map((s) => s.id) })
    r.b.dispose()
  })

  it('the calibrate step does not pass if the sketch is re-uploaded with the mass on (it tares it away)', async () => {
    const r = rig()
    r.inspect('cell')
    await r.finish('meet-the-cell')
    r.act('power')
    await r.finish('power')
    r.act('upload')
    await r.finish('upload', 5)
    r.tweak('Mass on pan', 500)
    await r.finish('place-500', 3)
    r.b.setCode(r.b.code.replace('float calFactor = 2147.0;', 'float calFactor = 2104.5;'))
    r.act('upload')
    await expect(r.finish('calibrate', 4)).rejects.toThrow(/did not complete/)
    r.b.dispose()
  })
})
