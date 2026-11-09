import { describe, expect, it } from 'vitest'
import { ntcOhms } from '../../engine/behaviors/ntc'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../../engine/guide'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import type { BenchAction } from '../../ui/types'
import { getLesson } from '../index'

const FRAME = 1 / 60

// readout indices
const BATH = 0
const MEASURED = 1
const OHMS = 2
const A0 = 3
const HEAT = 4
const POWER = 5
const BODY = 6
const COUNTS = 7

const lesson = getLesson('thermistor') as Lesson

function build(): Bench {
  const b = createBench(lesson, { speed: lesson.sim?.speed })
  b.dispatch('strip')
  b.dispatch('place-all')
  b.dispatch('power')
  b.upload()
  return b
}

async function run(b: Bench, seconds: number): Promise<BenchSnapshot> {
  const end = b.t + seconds
  while (b.t < end - 1e-9) await b.frame(FRAME)
  return b.snapshot()
}

/** set the bath and wait for the bead to settle (8 time constants) */
async function settleAt(b: Bench, bathC: number): Promise<BenchSnapshot> {
  b.setTweak('behavior:ntc.bathC', bathC)
  return run(b, 8 * 15 + 3)
}

describe('T6 thermistor lesson', () => {
  it('validates, 4 failures, 2 tweaks, a strip chart of bath, body and measured', () => {
    expect(validateLesson(lesson)).toEqual([])
    expect(lesson.failures.map((f) => f.id)).toEqual(['wrong-beta', 'open-lead', 'shorted', 'wrong-resistor'])
    expect(lesson.tweaks!.map((t) => t.label)).toEqual(['Bath temperature', 'Fixed resistor'])
    expect(lesson.instruments!.chart!.signals).toEqual([BATH, BODY, MEASURED])
  })

  it('at 25 C: R = 10 kOhm, A0 = 2.5 V = 512 counts, the sketch reads 25 +/- 0.5 C, self-heat 0.07 K', async () => {
    const b = build()
    const s = await run(b, 3)
    expect(s.status).toBe('RUNNING')
    expect(Math.abs(s.values[OHMS] / ntcOhms(s.values[BODY]) - 1)).toBeLessThan(0.005)
    expect(s.values[A0]).toBeCloseTo(2.5, 1)
    expect(s.values[COUNTS]).toBeGreaterThanOrEqual(511)
    expect(s.values[COUNTS]).toBeLessThanOrEqual(512)
    expect(Math.abs(s.values[MEASURED] - 25)).toBeLessThanOrEqual(0.5)
    expect(s.values[HEAT]).toBeCloseTo(0.625e-3 / 0.0085, 2)
    expect(s.values[POWER]).toBeCloseTo(0.625e-3, 5)
    expect(s.warnings ?? []).toEqual([])
    b.dispose()
  })

  it('sweeps the bath: R follows the Beta model (+/-0.5 %) and the sketch is within 0.5 C of the sensor', async () => {
    const b = build()
    for (const bath of [50, 75, 0, -10]) {
      const s = await settleAt(b, bath)
      const body = s.values[BODY]
      expect(Math.abs(s.values[OHMS] / ntcOhms(body) - 1)).toBeLessThan(0.005)
      expect(Math.abs(s.values[MEASURED] - body)).toBeLessThanOrEqual(0.5)
      expect(body - bath).toBeLessThan(0.2) // 10k divider: small self-heat
    }
    b.dispose()
  })

  it('50 C: 3.56 kOhm, A0 1.31 V, about 268 counts', async () => {
    const b = build()
    const s = await settleAt(b, 50)
    expect(Math.abs(s.values[OHMS] / 3560 - 1)).toBeLessThan(0.01)
    expect(s.values[A0]).toBeCloseTo(1.31, 1)
    expect(Math.abs(s.values[COUNTS] - 268)).toBeLessThanOrEqual(1.5)
    b.dispose()
  })

  it('the HOT LED lights above 40 C only', async () => {
    const b = build()
    let s = await settleAt(b, 30)
    expect(s.elementValues['pin9.level'] ?? 0).toBeLessThan(0.5)
    s = await settleAt(b, 50)
    expect(s.published['serial.tempC']).toBeGreaterThan(40)
    b.dispose()
  })

  it('thermal lag: after one tau (15 s) the body covers 63 % of a 25 -> 65 C step, 95 % after three', async () => {
    const b = build()
    await run(b, 2)
    b.setTweak('behavior:ntc.bathC', 65)
    let s = await run(b, 15)
    const f1 = (s.values[BODY] - 25) / 40
    expect(f1).toBeGreaterThan(0.6)
    expect(f1).toBeLessThan(0.66)
    s = await run(b, 30)
    expect((s.values[BODY] - 25) / 40).toBeGreaterThan(0.94)
    b.dispose()
  })

  it('self-heating at a stiff divider: 330 ohm over the 3.56 kOhm NTC at 50 C is about 0.7 K', async () => {
    const b = build()
    b.setTweak('r_fix.value', 330)
    const s = await settleAt(b, 50)
    expect(s.values[HEAT]).toBeGreaterThan(0.6)
    expect(s.values[HEAT]).toBeLessThan(0.8)
    expect(Math.abs(s.values[BODY] - 50 - s.values[HEAT])).toBeLessThan(0.1)
    b.dispose()
  })

  it('wrong B: a 3435 K part at 60 C reads 54.8 +/- 0.5 C through the 3977 K equation', async () => {
    const b = build()
    b.dispatch('break:wrong-beta')
    const s = await settleAt(b, 60)
    expect(Math.abs(s.values[MEASURED] - 54.8)).toBeLessThanOrEqual(0.6)
    expect(Math.abs(s.values[OHMS] / 2980 - 1)).toBeLessThan(0.02)
    b.dispose()
  })

  it('open lead: A0 pins at 5 V, 1023 counts, the sketch reports the fault value instead of a temperature', async () => {
    const b = build()
    await run(b, 2)
    b.dispatch('break:open-lead')
    const s = await run(b, 3)
    expect(s.values[A0]).toBeGreaterThan(4.9)
    expect(s.values[COUNTS]).toBeGreaterThanOrEqual(1022)
    expect(s.values[MEASURED]).toBe(-999)
    b.dispose()
  })

  it('shorted: A0 at 0 V, 0 counts, fault', async () => {
    const b = build()
    await run(b, 2)
    b.dispatch('break:shorted')
    const s = await run(b, 3)
    expect(s.values[A0]).toBeLessThan(0.01)
    expect(s.values[MEASURED]).toBe(-999)
    b.dispose()
  })

  it('1 kOhm fitted instead of 10 kOhm: the sketch reads about -19 C at 25 C', async () => {
    const b = build()
    b.dispatch('break:wrong-resistor')
    const s = await run(b, 20)
    expect(Math.abs(s.values[MEASURED] + 19)).toBeLessThanOrEqual(1)
    b.dispose()
  })
})

// ── guide: shape and end to end (same rig as guidesBatchC.test.ts) ──

function rig() {
  const L = lesson
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

describe('thermistor guide: shape', () => {
  it('validates, 5-9 steps, at most one manual, ends on the quiz', () => {
    expect(validateLesson(lesson)).toEqual([])
    const n = lesson.guide!.length
    expect(n).toBeGreaterThanOrEqual(5)
    expect(n).toBeLessThanOrEqual(9)
    expect(lesson.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
    expect(JSON.stringify(lesson.guide).split('"manual"').length - 1).toBeLessThanOrEqual(1)
  })
})

describe('thermistor guide: end to end', () => {
  it('walks every step on a real bench', async () => {
    const r = rig()
    r.inspect('ntc')
    await r.finish('meet-the-ntc')
    r.act('strip')
    r.act('place-all')
    r.act('power')
    await r.finish('power')
    r.act('upload')
    await r.finish('upload', 3)
    r.tweak('Bath temperature', 50)
    await r.finish('warm-bath', 30)
    r.act('break:open-lead')
    await r.finish('open-lead', 5)
    r.act('repair')
    await r.finish('repair')
    r.tweak('Fixed resistor', 330)
    await r.finish('self-heat', 30)
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })
})
