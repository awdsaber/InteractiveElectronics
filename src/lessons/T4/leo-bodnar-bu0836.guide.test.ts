// The leo-bodnar-bu0836 guide driven end to end headless: a real bench and the guide evaluator,
// doing exactly what each step asks (same rig as interrupts-timers.guide.test.ts), with no skips.
import { describe, expect, it } from 'vitest'
import { createBench } from '../../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../../engine/guide'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import type { BenchAction } from '../../ui/types'
import { getLesson } from '../index'

const FRAME = 1 / 60
const L = getLesson('leo-bodnar-bu0836') as Lesson

describe('leo-bodnar-bu0836 guide', () => {
  it('shape: validates, 6–9 steps, no manual steps, a break and a repair, ends on the quiz', () => {
    expect(validateLesson(L)).toEqual([])
    const n = L.guide!.length
    expect(n).toBeGreaterThanOrEqual(6)
    expect(n).toBeLessThanOrEqual(9)
    expect(L.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
    const json = JSON.stringify(L.guide)
    expect(json).not.toMatch(/"manual"/)
    expect(json).toMatch(/"kind":"break"/)
    expect(json).toMatch(/"action":"repair"/)
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
    const finish = async (id: string, sec = 4) => {
      expect(g.state().step?.id).toBe(id)
      const start = g.state().current
      for (let i = 0; i < Math.round(sec / FRAME); i++) {
        if (evaluate().current !== start) return
        await b.frame(FRAME)
        ui.now += FRAME * 1000
      }
      throw new Error(`step "${id}" did not complete in ${sec} s; values ${b.snapshot().values.join(', ')}`)
    }

    ui.selectedPart = 'mcu'
    pending.push({ type: 'inspect', part: 'mcu' })
    await finish('meet-the-board')
    ui.selectedPart = null
    act('power')
    await finish('power')
    ui.instrumentsOpen = true
    pending.push({ type: 'instruments' })
    await finish('open-panel')
    tweak('Throttle pedal', 50)
    await finish('throttle-half')
    tweak('B1 IGNITION', 1)
    tweak('B7 LIGHTS', 1)
    tweak('B8 WIPERS', 1)
    await finish('three-buttons')
    act('break:no-diode-b7')
    await finish('ghost')
    act('repair')
    await finish('repair')
    act('break:thr-ground-open')
    await finish('ground-open')
    pending.push({ type: 'quiz' })
    await finish('quiz')
    expect(g.state()).toMatchObject({ complete: true, done: L.guide!.map((s) => s.id) })
    b.dispose()
  })

  it('the ghost step does not pass on the break alone with fewer than three switches latched', async () => {
    const b = createBench(L)
    b.dispatch('power')
    const t = L.tweaks!.find((x) => x.label === 'B1 IGNITION')!
    b.setTweak(`${t.elementId}.${t.key}`, 1)
    b.dispatch('break:no-diode-b7')
    for (let i = 0; i < 30; i++) await b.frame(FRAME)
    expect(b.snapshot().values[4]).toBe(0)
    b.dispose()
  })
})
