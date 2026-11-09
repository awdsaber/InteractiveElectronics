// The pid-motor-control guide driven end to end headless: a real bench and the guide evaluator, doing exactly
// what each step asks (same rig as encoders.guide.test.ts), with no skips. The tuning path: P only, add I,
// add D, a brake disturbance, then a reversed-feedback failure and its repair.
import { describe, expect, it } from 'vitest'
import { createBench } from '../../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../../engine/guide'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import type { BenchAction } from '../../ui/types'
import { getLesson } from '../index'

const FRAME = 1 / 60
const L = getLesson('pid-motor-control') as Lesson

describe('pid-motor-control guide', () => {
  it('shape: validates, 5–9 steps, no manual steps, P → I → D → brake → break → repair → quiz', () => {
    expect(validateLesson(L)).toEqual([])
    const n = L.guide!.length
    expect(n).toBeGreaterThanOrEqual(5)
    expect(n).toBeLessThanOrEqual(9)
    expect(L.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
    expect(JSON.stringify(L.guide).includes('"manual"')).toBe(false)
    expect(new Set(L.guide!.map((s) => s.id)).size).toBe(n)
    expect(L.guide!.map((s) => s.id)).toEqual(['power-on', 'upload', 'p-only', 'add-i', 'add-d', 'brake', 'reverse-feedback', 'repair', 'quiz'])
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

    act('power')
    await finish('power-on')
    act('upload')
    await finish('upload')
    tweak('Kp', 2)
    await finish('p-only', 12) // waits for the 150 rpm step of the 8 s profile
    tweak('Kp', 0.4)
    tweak('Ki', 8.7)
    await finish('add-i', 12)
    tweak('Kd', 0.02)
    await finish('add-d', 12)
    tweak('Kd', 0)
    tweak('Brake torque', 0.03)
    await finish('brake', 12)
    act('break:swap-ab')
    await finish('reverse-feedback', 12)
    act('repair')
    await finish('repair')
    pending.push({ type: 'quiz' })
    await finish('quiz')
    expect(g.state()).toMatchObject({ complete: true, done: L.guide!.map((s) => s.id) })
    b.dispose()
  })
})
