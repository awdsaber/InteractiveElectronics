// Guided steps for ten T3-T6 lessons (logic, 555, Uno, ESP32, motor drivers, IMU), driven end to end
// headless: a real bench (createBench) and the guide evaluator, doing exactly what each step asks
// (same rig as guidesBatchA.test.ts). Proves every check is reachable with the lessons' real numbers.
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
  const b: Bench = createBench(L, { speed: L.sim?.speed })
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
    event(e: GuideEvent) {
      pending.push(e)
    },
    /** let the bench run (wall seconds) without judging the guide */
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
  'logic-gates',
  'flipflops-counters',
  'timer-555',
  'arduino-uno',
  'esp32-s3',
  'tb6612fng',
  'l298n',
  'a4988-stepper',
  'pca9685-servo',
  'mpu6050-imu',
]

describe('batch C guides: shape', () => {
  for (const id of LESSONS) {
    it(`${id}: validates, 5-9 steps, at most one manual, ends on the quiz`, () => {
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

describe('batch C guides: end to end', () => {
  it('logic-gates', async () => {
    const r = rig('logic-gates')
    r.inspect('u-nand')
    await r.finish('meet-the-nand')
    r.act('power')
    await r.finish('power-up')
    r.tweak('Input A', 1)
    await r.finish('a-only')
    r.tweak('Input B', 1)
    await r.finish('both-on')
    r.tweak('Ripple on the signal (peak)', 0.4)
    await r.finish('ripple', 10)
    r.act('break:floating-input')
    await r.finish('float-it', 5)
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('flipflops-counters', async () => {
    const r = rig('flipflops-counters')
    r.act('power')
    await r.finish('power-up')
    const tap = async (label: string, hold = 0.6) => {
      r.tweak(label, 1)
      await r.run(hold)
      r.tweak(label, 0)
    }
    await tap('SET button')
    await r.finish('set', 5)
    await tap('RESET button')
    await r.finish('reset', 5)
    r.act('break:both-buttons')
    await r.finish('forbidden', 5)
    r.act('repair')
    await r.finish('repair-latch')
    for (let i = 0; i < 5; i++) {
      await tap('CLOCK button', 0.8)
      await r.run(1)
    }
    await r.finish('count-five')
    r.act('break:no-debounce')
    for (let i = 0; i < 4; i++) {
      await tap('CLOCK button', 0.8)
      await r.run(1)
    }
    await r.finish('bounce')
    r.act('repair')
    await r.finish('repair-bounce')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('timer-555', async () => {
    const r = rig('timer-555')
    r.inspect('c1')
    await r.finish('meet-c1')
    r.act('power')
    await r.finish('power-up', 10)
    r.tweak('C1', 100e-6)
    await r.finish('slow-it', 15)
    r.tweak('Supply', 12)
    await r.finish('supply', 10)
    r.act('break:no-r1')
    await r.finish('no-r1', 10)
    r.act('repair')
    await r.finish('repair', 10)
    r.tweak('Timer mode', 1)
    await r.run(4)
    r.tweak('TRIGGER button', 1)
    await r.run(0.2)
    r.tweak('TRIGGER button', 0)
    await r.finish('one-shot', 5)
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('arduino-uno', async () => {
    const r = rig('arduino-uno')
    r.act('strip')
    await r.finish('strip')
    r.act('pick-place')
    r.act('place-all')
    await r.finish('rebuild')
    r.act('solder')
    await r.finish('solder')
    r.act('power')
    await r.finish('power')
    r.act('upload')
    await r.finish('upload', 2)
    r.tweak('Pot (turned toward 5 V)', 100)
    await r.finish('fade', 3)
    r.act('break:bypass-resistor')
    await r.finish('bypass', 3)
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('esp32-s3', async () => {
    const r = rig('esp32-s3')
    r.inspect('u1')
    await r.finish('meet-the-module')
    r.act('power')
    await r.finish('power')
    r.act('upload')
    await r.finish('upload', 8)
    r.tweak('Pot position', 1)
    await r.finish('pot-full', 3)
    r.tweak('Divider bottom', 30000)
    await r.finish('divider', 5)
    r.act('break:direct-5v')
    await r.finish('direct-5v', 6)
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('tb6612fng', async () => {
    const r = rig('tb6612fng')
    r.inspect('u1')
    await r.finish('meet-the-driver')
    r.act('power')
    r.act('power:bat_sw')
    await r.finish('both-supplies')
    r.act('upload')
    await r.finish('upload', 2)
    await r.finish('full-speed', 6)
    await r.finish('reverse', 8)
    r.tweak('Wheel load torque', 0.006)
    await r.finish('load', 15)
    r.act('break:vm-4s')
    await r.finish('vm-4s', 3)
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('l298n', async () => {
    const r = rig('l298n')
    r.inspect('u1')
    await r.finish('meet-the-bridge')
    r.act('power')
    r.act('power:bat_sw')
    await r.finish('both-supplies')
    r.act('upload')
    await r.finish('upload', 2)
    await r.finish('bridge-drop', 8)
    r.tweak('Load torque (motor shaft)', 0.0053)
    await r.finish('load', 30)
    r.act('break:no-flyback')
    await r.finish('no-flyback', 30)
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('a4988-stepper', async () => {
    const r = rig('a4988-stepper')
    r.inspect('u1')
    await r.finish('meet-the-driver')
    r.act('power')
    await r.finish('power')
    r.inspect('pot')
    await r.finish('read-vref')
    r.act('upload')
    await r.finish('upload', 2)
    await r.finish('spin-up', 8)
    r.tweak('Load torque', 0.3)
    await r.finish('overload', 8)
    r.act('break:no-current-limit')
    await r.finish('no-limit', 3)
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('pca9685-servo', async () => {
    const r = rig('pca9685-servo')
    r.inspect('u1')
    await r.finish('meet-the-chip')
    r.act('power')
    await r.finish('power-usb')
    r.act('power:psu_sw')
    await r.finish('power-psu')
    r.act('upload')
    await r.finish('upload', 3)
    await r.finish('wave', 6)
    r.tweak('PSU internal R', 1)
    await r.finish('weak-psu', 6)
    r.act('break:servos-on-uno-5v')
    await r.finish('servos-on-5v', 15)
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })

  it('mpu6050-imu', async () => {
    const r = rig('mpu6050-imu')
    r.inspect('u1')
    await r.finish('meet-the-sensor')
    r.act('power')
    await r.finish('power')
    r.act('upload')
    await r.finish('upload', 3)
    r.tweak('Plate pitch', 30)
    await r.finish('tilt', 8)
    await r.finish('shaker', 12)
    r.tweak('Plate pitch', 0)
    await r.run(3)
    r.act('break:warm')
    await r.finish('warm', 15)
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })
})
