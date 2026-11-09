// Guided steps for the T0 lessons and the first two T1 lessons, driven end to end headless: a real
// bench (createBench) and the guide evaluator, doing exactly what each step asks (same rig as
// guidePilots.test.ts). Proves every check is reachable with the lesson's real numbers, in order.
import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../engine/guide'
import { validateLesson } from '../engine/lessonSchema'
import type { Lesson } from '../engine/types'
import type { BenchAction } from '../ui/types'
import { getLesson } from './index'

const FRAME = 1 / 60

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
    openInstruments() {
      ui.instrumentsOpen = true
      pending.push({ type: 'instruments' })
    },
    event(e: GuideEvent) {
      pending.push(e)
    },
    /** let the bench run without judging the guide */
    async run(sec: number) {
      for (let i = 0; i < Math.round(sec / FRAME); i++) {
        await b.frame(FRAME)
        ui.now += FRAME * 1000
      }
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
    done() {
      expect(g.state()).toMatchObject({ complete: true, done: L.guide!.map((s) => s.id) })
      b.dispose()
    },
  }
}

const LESSONS = [
  'charge-voltage-current',
  'power-heat',
  'series-parallel',
  'kirchhoff',
  'batteries',
  'multimeter',
  'breadboard',
  'resistor-codes-divider',
  'capacitor-rc',
]

describe('batch A guides: shape', () => {
  for (const id of LESSONS) {
    it(`${id}: validates, 5–9 steps, at most one manual, ends on the quiz`, () => {
      const L = getLesson(id) as Lesson
      expect(validateLesson(L)).toEqual([])
      const n = L.guide!.length
      expect(n).toBeGreaterThanOrEqual(5)
      expect(n).toBeLessThanOrEqual(9)
      expect(L.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
      expect(JSON.stringify(L.guide).split('"manual"').length - 1).toBeLessThanOrEqual(1)
    })
  }
})

describe('batch A guides: end to end', () => {
  it('charge-voltage-current', async () => {
    const r = rig('charge-voltage-current')
    r.inspect('r1')
    await r.finish('find-the-limiter')
    r.act('power')
    await r.finish('close-the-loop')
    r.tweak('Limit resistor', 470)
    await r.finish('fit-470')
    r.tweak('Cells in series (1.5 V each)', 4.5)
    await r.finish('more-push')
    r.act('break:open-loop')
    await r.finish('open-the-loop')
    r.act('repair')
    await r.finish('repair')
    r.act('break:bypass-resistor')
    await r.finish('bypass-it')
    r.act('repair')
    await r.finish('repair-again')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('power-heat', async () => {
    const r = rig('power-heat')
    r.inspect('r1')
    await r.finish('meet-the-hot-one')
    r.act('power')
    await r.finish('output-on')
    await r.finish('heat-arrives', 20)
    r.tweak('Supply voltage', 8)
    await r.finish('turn-it-up')
    r.act('break:r-47')
    await r.finish('burn-it', 20)
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('series-parallel', async () => {
    const r = rig('series-parallel')
    r.inspect('r1')
    await r.finish('find-r1')
    r.act('power')
    await r.finish('connect')
    r.tweak('R3', 330)
    await r.finish('fatten-r3')
    r.tweak('R3', 100000)
    await r.finish('starve-r3')
    r.act('break:bridge')
    await r.finish('solder-bridge')
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('kirchhoff', async () => {
    const r = rig('kirchhoff')
    r.act('power')
    await r.finish('output-on')
    r.tweak('Channel 1', 12)
    await r.finish('push-ch1')
    r.act('break:sink-open')
    await r.finish('sink-open')
    r.act('repair')
    await r.finish('repair')
    r.act('break:short-a')
    await r.finish('short-a')
    r.act('repair')
    await r.finish('repair-again')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('batteries', async () => {
    const r = rig('batteries')
    r.inspect('bat')
    await r.finish('meet-the-battery')
    r.act('power')
    await r.finish('connect-load')
    r.tweak('Load resistance', 10)
    await r.finish('heavier-load')
    r.act('break:short')
    await r.finish('keys-in-pocket')
    r.act('repair')
    await r.finish('repair')
    r.tweak('Internal resistance (age)', 15)
    await r.finish('age-it')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('multimeter', async () => {
    const r = rig('multimeter')
    r.inspect('vmeter')
    await r.finish('meet-the-voltmeter')
    r.act('power')
    await r.finish('output-on')
    r.tweak('Leads on midpoint', 1)
    await r.finish('leads-on')
    r.act('break:analog-meter')
    await r.finish('analog-meter')
    r.act('repair')
    await r.finish('repair')
    r.tweak('Meter input resistance', 10000)
    await r.finish('weak-meter')
    r.act('break:amps-across-supply')
    await r.finish('blow-the-fuse')
    r.act('repair')
    await r.finish('repair-again')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('breadboard', async () => {
    const r = rig('breadboard')
    r.inspect('r1')
    await r.finish('find-the-limiter')
    r.act('power')
    await r.finish('connect-usb')
    r.tweak('Limit resistor', 1000)
    await r.finish('bigger-resistor')
    r.act('break:resistor-one-strip')
    await r.finish('one-strip')
    r.act('repair')
    await r.finish('repair')
    r.act('break:split-rail')
    await r.finish('split-rail')
    r.act('repair')
    await r.finish('repair-again')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('resistor-codes-divider', async () => {
    const r = rig('resistor-codes-divider')
    r.inspect('r2')
    await r.finish('read-the-bands')
    r.act('power')
    await r.finish('connect')
    r.tweak('Bottom resistor R2', 10000)
    await r.finish('bigger-bottom')
    r.tweak('Load attached', 1)
    r.tweak('Load resistance', 10000)
    await r.finish('attach-load')
    r.act('break:heavy-load')
    await r.finish('heavy-load')
    r.act('repair')
    await r.finish('repair')
    r.act('break:misread-band')
    await r.finish('misread-band')
    r.act('repair')
    await r.finish('repair-again')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('capacitor-rc', async () => {
    const r = rig('capacitor-rc')
    r.inspect('c1')
    await r.finish('meet-the-cap')
    r.act('power')
    await r.finish('plug-in')
    r.openInstruments()
    await r.finish('open-scope')
    r.tweak('Charge switch', 1)
    await r.finish('charge-it', 8)
    r.tweak('Charge switch', 0)
    r.tweak('DRAIN button', 1)
    await r.run(0.5)
    r.tweak('DRAIN button', 0)
    await r.finish('drain-it')
    r.act('break:overvoltage-24v')
    await r.finish('overvoltage', 5)
    r.act('repair')
    await r.finish('repair')
    r.tweak('Capacitance', 1e-3)
    r.tweak('Charge switch', 1)
    await r.finish('bigger-cap', 8)
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })
})
