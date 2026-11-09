// The serial-protocols guide driven end to end headless: a real bench and the guide evaluator, doing
// exactly what each step asks, with no skips.
import { describe, expect, it } from 'vitest'
import { createBench } from '../../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../../engine/guide'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import type { BenchAction } from '../../ui/types'
import { getLesson } from '../index'

const FRAME = 1 / 60
const L = getLesson('serial-protocols') as Lesson

describe('serial-protocols guide', () => {
  it('shape: validates, 5–9 steps, no manual steps, ends on the quiz', () => {
    expect(validateLesson(L)).toEqual([])
    const n = L.guide!.length
    expect(n).toBeGreaterThanOrEqual(5)
    expect(n).toBeLessThanOrEqual(9)
    expect(L.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
    expect(JSON.stringify(L.guide)).not.toContain('"manual"')
    expect(new Set(L.guide!.map((s) => s.id)).size).toBe(n)
  })

  it('end to end: every step completes with no skips', async () => {
    const b = createBench(L)
    const g = createGuide(L)
    const ui: Required<GuideUi> = { now: 0, tweaks: b.tweakValues(), selectedPart: null, instrumentsOpen: false }
    let pending: GuideEvent[] = []
    const evaluate = () => {
      ui.tweaks = b.tweakValues()
      const s = g.evaluate(b.snapshot(), pending, ui)
      pending = []
      return s
    }
    const act = (a: BenchAction) => {
      const before = b.snapshot()
      b.dispatch(a)
      pending.push(...benchActionEvents(a, before, b.snapshot()))
    }
    const finish = async (id: string, sec = 6) => {
      expect(g.state().step?.id).toBe(id)
      const start = g.state().current
      for (let i = 0; i < Math.round(sec / FRAME); i++) {
        if (evaluate().current !== start) return
        await b.frame(FRAME)
        ui.now += FRAME * 1000
      }
      throw new Error(`step "${id}" did not complete in ${sec} s; values ${b.snapshot().values.join(', ')}`)
    }

    act('power')
    await finish('plug-usb')
    act('upload')
    await finish('upload')
    ui.instrumentsOpen = true
    pending.push({ type: 'instruments' })
    await finish('open-analyzer')
    b.setTweak('r_sda.value', 2200)
    await finish('stronger-pullups')
    act('break:wrong-baud')
    await finish('wrong-baud')
    act('break:weak-pullups')
    await finish('weak-pullups')
    act('repair')
    await finish('repair')
    pending.push({ type: 'quiz' })
    await finish('quiz')
    expect(g.state()).toMatchObject({ complete: true, done: L.guide!.map((s) => s.id) })
    b.dispose()
  })
})
