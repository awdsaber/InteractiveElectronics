// The debugging-instruments guide driven end to end headless: a real bench and the guide evaluator,
// doing exactly what each step asks (measure this, see that, conclude this), with no skips.
import { describe, expect, it } from 'vitest'
import { createBench } from '../../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../../engine/guide'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import type { BenchAction } from '../../ui/types'
import { getLesson } from '../index'

const FRAME = 1 / 60
const L = getLesson('debugging-instruments') as Lesson

describe('debugging-instruments guide', () => {
  it('shape: validates, 6–9 steps, no manual steps, the four-step method in order, ends on the quiz', () => {
    expect(validateLesson(L)).toEqual([])
    const n = L.guide!.length
    expect(n).toBeGreaterThanOrEqual(6)
    expect(n).toBeLessThanOrEqual(9)
    expect(L.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
    expect(JSON.stringify(L.guide)).not.toContain('"manual"')
    expect(new Set(L.guide!.map((s) => s.id)).size).toBe(n)
    // meter (rails) → scope (signals) → halves → analyzer (bus) → repair → quiz
    const ids = L.guide!.map((s) => s.id)
    const at = (id: string) => ids.indexOf(id)
    expect(at('power-up')).toBe(0)
    expect(at('sag')).toBeLessThan(at('scope'))
    expect(at('scope')).toBeLessThan(at('halves'))
    expect(at('halves')).toBeLessThan(at('cold-joint'))
    expect(at('repair')).toBe(n - 2)
    // every hidden fault the guide breaks exists
    const broken = JSON.stringify(L.guide).match(/"failure":"[a-z-]+"/g) ?? []
    for (const b of broken) expect(L.failures.map((f) => `"failure":"${f.id}"`)).toContain(b)
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
    for (let i = 0; i < 10; i++) await b.frame(FRAME)
    act('upload')
    await finish('power-up')
    b.setTweak('behavior:leads.mode', 3) // DMM leads on VIN SENSE
    await finish('meter-loading')
    act('break:small-reg')
    b.setTweak('behavior:leads.mode', 0) // back on the 5 V rail
    await finish('sag')
    ui.instrumentsOpen = true
    pending.push({ type: 'instruments' })
    await finish('scope')
    act('break:swapped-wires')
    await finish('halves')
    b.setTweak('behavior:probe.mode', 2) // ×1
    await finish('probe-x1')
    act('break:cold-joint')
    b.setTweak('behavior:logic-analyzer.vth', 2.5)
    await finish('cold-joint', 15)
    act('repair')
    await finish('repair')
    pending.push({ type: 'quiz' })
    await finish('quiz')
    expect(g.state()).toMatchObject({ complete: true, done: L.guide!.map((s) => s.id) })
    b.dispose()
  })
})
