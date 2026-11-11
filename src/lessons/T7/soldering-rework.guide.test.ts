// The soldering-rework guide driven end to end headless: a real bench and the guide evaluator,
// doing exactly what each step asks (set the iron, solder, tap, wick, cook a pad), with no skips.
import { describe, expect, it } from 'vitest'
import { createBench } from '../../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../../engine/guide'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import type { BenchAction } from '../../ui/types'
import { getLesson } from '../index'

const FRAME = 1 / 60
const L = getLesson('soldering-rework') as Lesson

describe('soldering-rework guide', () => {
  it('shape: validates, 6–9 steps, no manual steps, break → rework → repair in order, ends on the quiz', () => {
    expect(validateLesson(L)).toEqual([])
    const n = L.guide!.length
    expect(n).toBeGreaterThanOrEqual(6)
    expect(n).toBeLessThanOrEqual(9)
    expect(L.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
    expect(JSON.stringify(L.guide)).not.toContain('"manual"')
    expect(new Set(L.guide!.map((s) => s.id)).size).toBe(n)
    const ids = L.guide!.map((s) => s.id)
    const at = (id: string) => ids.indexOf(id)
    expect(at('build-run')).toBe(0)
    expect(at('cold')).toBeLessThan(at('tap'))
    expect(at('tap')).toBeLessThan(at('reflow'))
    expect(at('bridge')).toBeLessThan(at('wick'))
    expect(at('lift')).toBeLessThan(at('repair'))
    expect(at('repair')).toBe(n - 2)
    // every tweak a step names exists
    const tweakLabels = new Set((L.tweaks ?? []).map((t) => t.label))
    for (const s of L.guide!) {
      const f = s.focus?.control
      if (f?.startsWith('tweak:')) expect(tweakLabels).toContain(f.slice(6))
    }
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
    const tick = async (sec: number) => {
      for (let i = 0; i < Math.round(sec / FRAME); i++) {
        await b.frame(FRAME)
        ui.now += FRAME * 1000
      }
    }
    const press = async (key: 'go' | 'wick') => {
      b.setTweak(`behavior:solder.${key}`, 1)
      await tick(0.05)
      b.setTweak(`behavior:solder.${key}`, 0)
      await tick(0.05)
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
    act('power:pwr')
    for (let i = 0; i < 10; i++) await b.frame(FRAME)
    act('upload')
    await finish('build-run')

    b.setTweak('behavior:solder.target', 2)
    b.setTweak('behavior:solder.tipC', 280)
    await press('go')
    await finish('cold')

    b.setTweak('behavior:solder.vibration', 0.5)
    await finish('tap', 15)

    b.setTweak('behavior:solder.vibration', 0)
    b.setTweak('behavior:solder.tipC', 340)
    b.setTweak('behavior:solder.dwellS', 3)
    b.setTweak('behavior:solder.flux', 1)
    await press('go')
    await finish('reflow')

    b.setTweak('behavior:solder.target', 5)
    b.setTweak('behavior:solder.feed', 2)
    await press('go')
    await finish('bridge')

    await press('wick')
    b.setTweak('behavior:solder.feed', 1)
    await press('go')
    await finish('wick')

    b.setTweak('behavior:solder.target', 3)
    b.setTweak('behavior:solder.tipC', 450)
    await press('go')
    await press('go')
    await finish('lift')

    act('repair')
    await finish('repair')

    pending.push({ type: 'quiz' })
    await finish('quiz')
    expect(g.state()).toMatchObject({ complete: true, done: L.guide!.map((s) => s.id) })
    b.dispose()
  })
})
