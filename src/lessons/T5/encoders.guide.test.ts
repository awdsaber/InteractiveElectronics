// The encoders guide driven end to end headless: a real bench and the guide evaluator, doing exactly
// what each step asks (same rig as guidesBatchA.test.ts), with no skips.
import { describe, expect, it } from 'vitest'
import { createBench } from '../../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../../engine/guide'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import type { BenchAction } from '../../ui/types'
import { getLesson } from '../index'

const FRAME = 1 / 60
const L = getLesson('encoders') as Lesson

describe('encoders guide', () => {
  it('shape: validates, 5–9 steps, at most one manual, ends on the quiz', () => {
    expect(validateLesson(L)).toEqual([])
    const n = L.guide!.length
    expect(n).toBeGreaterThanOrEqual(5)
    expect(n).toBeLessThanOrEqual(9)
    expect(L.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
    expect(JSON.stringify(L.guide).split('"manual"').length - 1).toBeLessThanOrEqual(1)
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
    const tweak = (label: string, v: number) => {
      const t = L.tweaks!.find((x) => x.label === label)!
      b.setTweak(`${t.elementId}.${t.key}`, v)
    }
    const finish = async (id: string, sec = 8) => {
      expect(g.state().step?.id).toBe(id)
      const start = g.state().current
      for (let i = 0; i < Math.round(sec / FRAME); i++) {
        if (evaluate().current !== start) return
        await b.frame(FRAME)
        ui.now += FRAME * 1000
      }
      throw new Error(`step "${id}" did not complete in ${sec} s; values ${b.snapshot().values.join(', ')}`)
    }

    ui.selectedPart = 'enc'
    pending.push({ type: 'inspect', part: 'enc' })
    await finish('meet-the-encoder')
    act('power')
    await finish('power-on')
    act('upload')
    await finish('upload')
    await finish('reverse', 12)
    ui.instrumentsOpen = true
    pending.push({ type: 'instruments' })
    await finish('open-scope')
    act('break:swap-ab')
    await finish('swap-ab', 12)
    act('repair')
    await finish('repair')
    tweak('ISR cost', 300)
    await finish('slow-isr', 12)
    pending.push({ type: 'quiz' })
    await finish('quiz')
    expect(g.state()).toMatchObject({ complete: true, done: L.guide!.map((s) => s.id) })
    b.dispose()
  })
})
