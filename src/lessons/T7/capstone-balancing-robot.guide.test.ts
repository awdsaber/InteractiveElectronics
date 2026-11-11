// The capstone guide driven end to end headless: a real bench and the guide evaluator, doing exactly what each
// step asks, with no skips. Stand, push, break the filter, fix, slow the loop, then trust the gyro alone.
import { describe, expect, it } from 'vitest'
import { createBench } from '../../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../../engine/guide'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import type { BenchAction } from '../../ui/types'
import { getLesson } from '../index'

const FRAME = 1 / 60
const L = getLesson('capstone-balancing-robot') as Lesson

describe('capstone-balancing-robot guide', () => {
  it('shape: validates, 6–9 steps, no manual steps, ends on the quiz', () => {
    expect(validateLesson(L)).toEqual([])
    const n = L.guide!.length
    expect(n).toBeGreaterThanOrEqual(6)
    expect(n).toBeLessThanOrEqual(9)
    expect(L.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
    expect(JSON.stringify(L.guide).includes('"manual"')).toBe(false)
    expect(new Set(L.guide!.map((s) => s.id)).size).toBe(n)
    expect(L.guide!.map((s) => s.id)).toEqual(['power-on', 'upload', 'stand', 'push', 'break-filter', 'repair', 'slow-loop', 'gyro-drift', 'quiz'])
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
    const step = async () => {
      await b.frame(FRAME)
      ui.now += FRAME * 1000
    }
    /** a short press of the momentary Push button */
    const push = async () => {
      tweak('Push', 1)
      await step()
      await step()
      tweak('Push', 0)
    }
    const finish = async (id: string, sec = 8, during?: (t: number) => Promise<void>) => {
      expect(g.state().step?.id).toBe(id)
      const start = g.state().current
      const t0 = b.t
      for (let i = 0; i < Math.round(sec / FRAME); i++) {
        if (evaluate().current !== start) return
        if (during) await during(b.t - t0)
        await step()
      }
      throw new Error(`step "${id}" did not complete in ${sec} s; values ${b.snapshot().values.join(', ')}`)
    }
    /** push once, a second into the step */
    const pushOnceAt = (at: number) => {
      let done = false
      return async (t: number) => {
        if (!done && t >= at) {
          done = true
          await push()
        }
      }
    }

    act('power')
    await finish('power-on')
    act('upload')
    await finish('upload')
    await finish('stand', 8)
    await finish('push', 8, pushOnceAt(0.5))
    act('break:accel-only')
    await finish('break-filter', 8)
    act('repair')
    await finish('repair', 8)
    act('break:slow-loop')
    await finish('slow-loop', 10)
    act('repair')
    for (let i = 0; i < 150; i++) await step() // it calibrates and stands again
    act('break:gyro-only')
    await finish('gyro-drift', 12)
    pending.push({ type: 'quiz' })
    await finish('quiz')
    expect(g.state()).toMatchObject({ complete: true, done: L.guide!.map((s) => s.id) })
    b.dispose()
  }, 60000)
})
