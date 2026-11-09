// Guides for the T1/T2/T3 lessons of batch B, driven end to end headless: a real bench (createBench)
// and the guide evaluator, doing exactly what each step asks (bench actions, tweaks, UI events).
import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../engine/guide'
import { validateLesson } from '../engine/lessonSchema'
import type { Lesson } from '../engine/types'
import type { BenchAction } from '../ui/types'
import { getLesson } from './index'

const FRAME = 1 / 60

/** a tiny store: the bench, the guide, the UI state a guide reads, and a ms clock */
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
    /** set a tweak by its label, or by `elementId.key` */
    tweak(label: string, v: number) {
      const t = L.tweaks!.find((x) => x.label === label)
      b.setTweak(t ? `${t.elementId}.${t.key}` : label, v)
    },
    inspect(part: string) {
      ui.selectedPart = part
      pending.push({ type: 'inspect', part })
    },
    openInstruments() {
      ui.instrumentsOpen = true
      pending.push({ type: 'instruments' })
    },
    quiz() {
      pending.push({ type: 'quiz' })
    },
    /** run frames (evaluating after each) until the guide leaves step `id`; fails after `sec` */
    async finish(id: string, sec = 4) {
      expect(g.state().step?.id).toBe(id)
      const start = g.state().current
      for (let i = 0; i < Math.round(sec / FRAME); i++) {
        if (evaluate().current !== start) return
        await b.frame(FRAME)
        ui.now += FRAME * 1000
      }
      throw new Error(`step "${id}" did not complete in ${sec} s; values ${b.snapshot().values.join(', ')}`)
    },
    /** the guide ended with every step done and none skipped */
    expectComplete() {
      expect(g.state()).toMatchObject({ complete: true, done: L.guide!.map((s) => s.id) })
      b.dispose()
    },
  }
}

function expectShape(id: string, steps: number) {
  const L = getLesson(id) as Lesson
  expect(validateLesson(L)).toEqual([])
  expect(L.guide!.length).toBe(steps)
  expect(L.guide!.length).toBeGreaterThanOrEqual(5)
  expect(L.guide!.length).toBeLessThanOrEqual(9)
  expect(L.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
  expect(L.guide!.filter((s) => JSON.stringify(s.check).includes('"manual"')).length).toBeLessThanOrEqual(1)
}

describe('guide: inductor-rl', () => {
  it('validates', () => expectShape('inductor-rl', 9))
  it('runs end to end', async () => {
    const r = rig('inductor-rl')
    r.inspect('l1')
    await r.finish('meet-the-choke')
    r.act('power')
    await r.finish('switch-on')
    r.tweak('PUSH BUTTON', 1)
    await r.finish('hold-the-button')
    r.tweak('PUSH BUTTON', 0)
    await r.finish('let-go')
    r.openInstruments()
    r.tweak('PUSH BUTTON', 1)
    await r.finish('open-scope')
    r.tweak('PUSH BUTTON', 0)
    r.tweak('Series resistor', 220)
    r.tweak('PUSH BUTTON', 1)
    await r.finish('bigger-resistor')
    r.act('break:no-flyback')
    r.tweak('PUSH BUTTON', 0)
    await r.finish('no-flyback')
    r.act('repair')
    await r.finish('repair')
    r.quiz()
    await r.finish('quiz')
    r.expectComplete()
  })
})

describe('guide: rlc-resonance', () => {
  it('validates', () => expectShape('rlc-resonance', 9))
  it('runs end to end', async () => {
    const r = rig('rlc-resonance')
    r.inspect('l1')
    await r.finish('meet-the-coil')
    r.act('power')
    await r.finish('output-on')
    await r.finish('see-the-overshoot', 10)
    r.tweak('Damping resistor', 190)
    await r.finish('critical-damping')
    r.tweak('Generator waveform', 1)
    r.tweak('Damping resistor', 10)
    await r.finish('resonant-gain')
    r.tweak('Sine frequency', 5000)
    await r.finish('detune')
    r.act('break:no-damping')
    await r.finish('no-damping')
    r.act('repair')
    await r.finish('repair')
    r.quiz()
    await r.finish('quiz')
    r.expectComplete()
  })
})

describe('guide: ac-oscilloscope', () => {
  it('validates', () => expectShape('ac-oscilloscope', 8))
  it('runs end to end (slow motion: x0.1)', async () => {
    const r = rig('ac-oscilloscope')
    r.act('power')
    await r.finish('output-on', 10)
    await r.finish('read-the-filter', 10)
    r.tweak('Amplitude (peak)', 2)
    await r.finish('set-the-amplitude', 10)
    r.tweak('Frequency', 200)
    await r.finish('go-faster', 10)
    r.tweak('Frequency', 500)
    r.tweak('Filter resistor', 330)
    await r.finish('move-the-corner', 10)
    r.act('break:load-47')
    await r.finish('load-47', 10)
    r.act('repair')
    await r.finish('repair')
    r.quiz()
    await r.finish('quiz')
    r.expectComplete()
  })
})

describe('guide: transformer', () => {
  it('validates', () => expectShape('transformer', 8))
  it('runs end to end', async () => {
    const r = rig('transformer')
    r.inspect('xf')
    await r.finish('meet-the-transformer')
    r.act('power')
    await r.finish('switch-on')
    r.tweak('Load resistance', 3)
    await r.finish('heavy-load')
    r.tweak('Load resistance', 100)
    await r.finish('light-load')
    r.tweak('T1.n', 0.5)
    await r.finish('turns-ratio')
    r.act('break:short')
    await r.finish('short-it', 8)
    r.act('repair')
    await r.finish('repair')
    r.quiz()
    await r.finish('quiz')
    r.expectComplete()
  })
})

describe('guide: diode-rectifier', () => {
  it('validates', () => expectShape('diode-rectifier', 8))
  it('runs end to end', async () => {
    const r = rig('diode-rectifier')
    r.inspect('d1')
    await r.finish('meet-the-diode')
    r.act('power')
    await r.finish('plug-in', 8)
    r.tweak('Smoothing capacitor', 1e-4)
    await r.finish('small-cap', 8)
    r.tweak('Smoothing capacitor', 1e-3)
    await r.finish('restore-cap', 8)
    r.tweak('Rectifier', 0)
    await r.finish('half-wave', 8)
    r.tweak('Rectifier', 1)
    r.act('break:no-cap')
    await r.finish('no-cap', 8)
    r.act('repair')
    await r.finish('repair')
    r.quiz()
    await r.finish('quiz')
    r.expectComplete()
  })
})

describe('guide: zener', () => {
  it('validates', () => expectShape('zener', 8))
  it('runs end to end', async () => {
    const r = rig('zener')
    r.inspect('z1')
    await r.finish('meet-the-zener')
    r.act('power')
    await r.finish('connect')
    r.tweak('Input voltage', 6)
    await r.finish('low-input')
    r.tweak('Input voltage', 10)
    await r.finish('ten-volts')
    r.tweak('Load resistance', 100)
    await r.finish('heavy-load')
    r.act('break:adapter-15v')
    await r.finish('adapter-15v', 20)
    r.act('repair')
    await r.finish('repair')
    r.quiz()
    await r.finish('quiz')
    r.expectComplete()
  })
})

describe('guide: transistor-switch', () => {
  it('validates', () => expectShape('transistor-switch', 9))
  it('runs end to end', async () => {
    const r = rig('transistor-switch')
    r.inspect('q1')
    await r.finish('meet-the-transistor')
    r.act('power')
    r.act('power:V_PACK')
    await r.finish('power-both')
    r.act('upload')
    await r.finish('upload')
    await r.finish('read-the-numbers', 6)
    r.tweak('Base resistor', 4700)
    await r.finish('weak-base', 6)
    r.openInstruments()
    await r.finish('open-scope', 6)
    r.tweak('Base resistor', 470)
    r.act('break:no-flyback')
    await r.finish('no-flyback', 8)
    r.act('repair')
    await r.finish('repair')
    r.quiz()
    await r.finish('quiz')
    r.expectComplete()
  })
})

describe('guide: mosfet-switch', () => {
  it('validates', () => expectShape('mosfet-switch', 9))
  it('runs end to end', async () => {
    const r = rig('mosfet-switch')
    r.inspect('q1')
    await r.finish('meet-the-mosfet')
    r.act('power')
    await r.finish('power')
    r.act('upload')
    await r.finish('upload')
    await r.finish('on-state', 8)
    r.tweak('Pin 9 HIGH level', 3.3)
    await r.finish('three-volt-three', 8)
    r.openInstruments()
    await r.finish('open-scope')
    r.act('break:wrong-fet-3v3')
    await r.finish('wrong-fet', 8)
    r.act('repair')
    await r.finish('repair')
    r.quiz()
    await r.finish('quiz')
    r.expectComplete()
  })
})

describe('guide: opamp-basics', () => {
  it('validates', () => expectShape('opamp-basics', 8))
  it('runs end to end', async () => {
    const r = rig('opamp-basics')
    r.inspect('u1')
    await r.finish('meet-the-chip')
    r.act('power')
    await r.finish('connect', 6)
    r.tweak('Configuration', 1)
    await r.finish('inverting', 6)
    r.tweak('Input amplitude (peak)', 0.5)
    await r.finish('clip', 6)
    r.tweak('Chip', 4.975)
    await r.finish('rail-to-rail', 6)
    r.act('break:no-feedback')
    await r.finish('no-feedback', 6)
    r.act('repair')
    await r.finish('repair')
    r.quiz()
    await r.finish('quiz')
    r.expectComplete()
  })
})

describe('guide: regulators-linear-buck', () => {
  it('validates', () => expectShape('regulators-linear-buck', 9))
  it('runs end to end', async () => {
    const r = rig('regulators-linear-buck')
    r.inspect('u1')
    await r.finish('meet-the-ldo')
    r.act('power')
    await r.finish('plug-in')
    r.act('upload')
    await r.finish('upload', 6)
    r.openInstruments()
    await r.finish('open-scope')
    r.tweak('Input voltage', 6)
    await r.finish('low-input', 8)
    r.tweak('Input voltage', 12)
    r.act('break:hot-ldo')
    await r.finish('hot-ldo', 25)
    r.tweak('LDO cooling', 46)
    await r.finish('cool-it', 25)
    r.act('repair')
    await r.finish('repair')
    r.quiz()
    await r.finish('quiz')
    r.expectComplete()
  })
})

describe('guide: adc-dac-pwm', () => {
  it('validates', () => expectShape('adc-dac-pwm', 9))
  it('runs end to end', async () => {
    const r = rig('adc-dac-pwm')
    r.act('power')
    await r.finish('plug-usb')
    r.act('upload')
    await r.finish('upload', 6)
    r.tweak('Knob', 20)
    await r.finish('turn-the-knob', 6)
    r.tweak('Filter capacitor', 1e-7)
    await r.finish('small-cap', 6)
    r.tweak('Filter capacitor', 1e-5)
    await r.finish('big-cap', 6)
    r.tweak('Reference switch (1 = internal 1.1 V)', 1)
    await r.finish('internal-reference', 6)
    r.act('break:heavy-load')
    await r.finish('heavy-load', 6)
    r.act('repair')
    await r.finish('repair')
    r.quiz()
    await r.finish('quiz')
    r.expectComplete()
  })
})

