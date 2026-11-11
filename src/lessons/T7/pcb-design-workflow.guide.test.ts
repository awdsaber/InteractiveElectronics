// The pcb-design-workflow guide driven end to end headless: a real bench and the guide evaluator, doing
// exactly what each step asks, with no skips (same rig as pid-motor-control.guide.test.ts).
import { describe, expect, it } from 'vitest'
import { createBench } from '../../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../../engine/guide'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import type { BenchAction } from '../../ui/types'
import { getLesson } from '../index'

const FRAME = 1 / 60
const L = getLesson('pcb-design-workflow') as Lesson

describe('pcb-design-workflow guide', () => {
  it('shape: validates, 6–9 steps, no manual steps, heat → DRC → widen → peel → isolate → break → repair → quiz', () => {
    expect(validateLesson(L)).toEqual([])
    const n = L.guide!.length
    expect(n).toBeGreaterThanOrEqual(6)
    expect(n).toBeLessThanOrEqual(9)
    expect(L.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
    expect(JSON.stringify(L.guide).includes('"manual"')).toBe(false)
    expect(new Set(L.guide!.map((s) => s.id)).size).toBe(n)
    expect(L.guide!.map((s) => s.id)).toEqual(['power-on', 'hot-trace', 'drc-on', 'widen', 'peel', 'bottom-copper', 'break-thin', 'repair', 'quiz'])
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
    await finish('hot-trace', 15)
    tweak('DRC overlay', 1)
    await finish('drc-on')
    tweak('Power trace width', 0.8)
    await finish('widen', 15)
    act('explode')
    await finish('peel')
    tweak('Layer view', 1)
    await finish('bottom-copper')
    tweak('Layer view', 0)
    act('break:thin-trace')
    await finish('break-thin', 15)
    act('repair')
    await finish('repair')
    pending.push({ type: 'quiz' })
    await finish('quiz')
    expect(g.state()).toMatchObject({ complete: true, done: L.guide!.map((s) => s.id) })
    b.dispose()
  })
})
