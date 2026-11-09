import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../../engine/guide'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import type { BenchAction } from '../../ui/types'
import { getLesson } from '../index'

const FRAME = 1 / 60

// readout indices
const LOSS = 0
const TJ = 1
const TC = 2
const THS = 3
const VOUT = 4
const EFF = 5
const TJ_PAPER = 6
const DT_TAB_SINK = 7
const TRIPS = 8
const THETA = 9
const PMAX = 10
const TAU = 11

const lesson = getLesson('thermal-design') as Lesson

/** a powered bench; `speed` 100 settles a 2-minute time constant in under 10 s of frames */
function build(speed = 100): Bench {
  const b = createBench(lesson, { speed })
  b.dispatch('power')
  return b
}

async function run(b: Bench, seconds: number): Promise<BenchSnapshot> {
  const end = b.t + seconds
  while (b.t < end - 1e-9) await b.frame(FRAME)
  return b.snapshot()
}

/** about 7 time constants of the slowest configuration (small sink, still air) */
const SETTLE = 900

describe('T7 thermal-design lesson', () => {
  it('validates; failures, tweaks, a strip chart of Tj, Tc and Ths', () => {
    expect(validateLesson(lesson)).toEqual([])
    expect(lesson.failures.map((f) => f.id)).toEqual(['no-heatsink', 'dry-tab', 'fan-dies', 'adapter-24v'])
    expect(lesson.tweaks!.map((t) => t.label)).toEqual(['Heatsink', 'Thermal interface', 'Airflow', 'Ambient', 'Input voltage', 'Load resistor'])
    expect(lesson.instruments!.chart!.signals).toEqual([TJ, TC, THS])
    expect(lesson.sim?.speed).toBe(20)
    expect(lesson.board.parts.find((p) => p.kind === 'heatsink')).toBeTruthy()
    expect(lesson.board.parts.find((p) => p.kind === 'regulator-to220')).toBeTruthy()
  })

  it('the text states the analogy: theta is to C/W as R is to V/A, C_th to J/K as C to Q = C V', () => {
    expect(lesson.meet).toContain('θ is to °C/W as R is to V/A')
    expect(lesson.meet).toMatch(/C_th is to J\/K as C is to the charge-voltage relation/)
  })

  it('12 V in, 5 V at 0.667 A: 4.73 W, 41 % efficient, 5.00 V out', async () => {
    const b = build()
    const s = await run(b, 5)
    expect(Math.abs(s.values[LOSS] - 4.73)).toBeLessThan(0.1)
    expect(Math.abs(s.values[EFF] - 41.3)).toBeLessThan(2)
    expect(Math.abs(s.values[VOUT] - 5)).toBeLessThan(0.05)
    b.dispose()
  })

  it('default (small sink 12, silicone pad 1, still air): chain 18 C/W, Tj 25 + 4.73 x 18 = 110 +/- 3 C', async () => {
    const b = build()
    const s = await run(b, SETTLE)
    expect(s.values[THETA]).toBeCloseTo(18, 6)
    expect(Math.abs(s.values[TJ] - 110.1)).toBeLessThan(3)
    expect(Math.abs(s.values[TJ_PAPER] - 110.1)).toBeLessThan(3)
    // each step of the chain is P x its resistance
    expect(Math.abs(s.values[TJ] - s.values[TC] - 4.73 * 5)).toBeLessThan(0.7)
    expect(Math.abs(s.values[DT_TAB_SINK] - 4.73 * 1)).toBeLessThan(0.5)
    expect(Math.abs(s.values[THS] - (25 + 4.73 * 12))).toBeLessThan(3)
    expect(s.values[TRIPS]).toBe(0)
    b.dispose()
  })

  it('time constant of the small sink: (0.05 + 0.8 + 9 J/K) x 12 C/W = 118 s', async () => {
    const b = build(20)
    const s = await run(b, 3)
    expect(Math.abs(s.values[TAU] - 118.2)).toBeLessThan(1)
    b.dispose()
  })

  it('tweaks: large sink 5 C/W gives 77 C; with the fan 64 C; grease 0.5 gives 62 C', async () => {
    const b = build()
    b.setTweak('behavior:th.sink', 2)
    let s = await run(b, SETTLE)
    expect(Math.abs(s.values[TJ] - (25 + 4.73 * 11))).toBeLessThan(3)
    b.setTweak('behavior:th.fan', 1)
    s = await run(b, SETTLE)
    expect(Math.abs(s.values[TJ] - (25 + 4.73 * (5 + 1 + 2.25)))).toBeLessThan(3)
    b.setTweak('behavior:th.pad', 2)
    s = await run(b, SETTLE)
    expect(Math.abs(s.values[TJ] - (25 + 4.73 * (5 + 0.5 + 2.25)))).toBeLessThan(3)
    b.dispose()
  })

  it('derating: the power the chain allows falls with ambient (125 C limit, 18 C/W: 5.6 W at 25 C, 3.6 W at 60 C)', async () => {
    const b = build()
    let s = await run(b, 3)
    expect(Math.abs(s.values[PMAX] - 100 / 18)).toBeLessThan(0.05)
    b.setTweak('behavior:th.ambientC', 60)
    s = await run(b, 3)
    expect(Math.abs(s.values[PMAX] - 65 / 18)).toBeLessThan(0.05)
    b.dispose()
  })

  it('F1 take the heatsink off: bare tab, 65 C/W, thermal shutdown cycling; the output drops to 0 V', async () => {
    const b = build(20)
    b.dispatch('break:no-heatsink')
    let sawOff = false
    let peak = 0
    const end = b.t + 140
    while (b.t < end) {
      await b.frame(FRAME)
      const s = b.snapshot()
      peak = Math.max(peak, s.values[TJ])
      if (s.values[VOUT] < 0.1 && s.values[TRIPS] >= 1) sawOff = true
    }
    const s = b.snapshot()
    expect(s.values[TRIPS]).toBeGreaterThanOrEqual(3)
    expect(sawOff).toBe(true)
    expect(peak).toBeGreaterThan(148)
    expect(peak).toBeLessThan(156)
    expect(Math.abs(s.values[THETA] - 65)).toBeLessThan(0.01)
    expect(Math.abs(s.values[TJ_PAPER] - (25 + 4.73 * 65)) < 12).toBe(true) // on paper: about 330 C
    b.dispose()
  })

  it('F2 forget the pad: tab-to-sink 3 C/W, so Tj rises by P x 2 = 9 K; the sink does not change', async () => {
    const b = build()
    b.setTweak('behavior:th.sink', 2)
    const before = await run(b, SETTLE)
    b.dispatch('break:dry-tab')
    const after = await run(b, SETTLE)
    expect(Math.abs(after.values[TJ] - before.values[TJ] - 4.73 * 2)).toBeLessThan(2)
    expect(Math.abs(after.values[THS] - before.values[THS])).toBeLessThan(1)
    expect(after.values[DT_TAB_SINK]).toBeGreaterThan(before.values[DT_TAB_SINK] + 7)
    expect(Math.abs(after.values[TJ] - (25 + 4.73 * (5 + 3 + 5)))).toBeLessThan(3)
    b.dispose()
  })

  it('F3 the fan stops: back to still-air theta_sa, Tj up by P x (12 - 5.4) = 31 K (small sink)', async () => {
    const b = build()
    b.setTweak('behavior:th.fan', 1)
    const cool = await run(b, SETTLE)
    expect(Math.abs(cool.values[TJ] - (25 + 4.73 * (5 + 1 + 5.4)))).toBeLessThan(3)
    b.dispatch('break:fan-dies')
    const hot = await run(b, SETTLE)
    expect(Math.abs(hot.values[TJ] - (25 + 4.73 * 18))).toBeLessThan(3)
    expect(hot.values[TJ] - cool.values[TJ]).toBeGreaterThan(28)
    // repair gives the fan back (the tweak keeps its value underneath)
    b.dispatch('repair')
    const back = await run(b, SETTLE)
    expect(Math.abs(back.values[TJ] - cool.values[TJ])).toBeLessThan(3)
    b.dispose()
  })

  it('F4 24 V adapter: 12.8 W. Large sink trips (166 C on paper); with the fan it holds near 130 C', async () => {
    const b = build(20)
    b.setTweak('behavior:th.sink', 2)
    b.dispatch('break:adapter-24v')
    let s = await run(b, 700)
    expect(s.values[LOSS] === 0 || Math.abs(s.values[LOSS] - 12.8) < 0.4).toBe(true)
    expect(s.values[TRIPS]).toBeGreaterThanOrEqual(1)
    expect(Math.abs(s.values[TJ_PAPER] - 166)).toBeLessThan(5)
    b.dispatch('repair')
    b.dispatch('break:adapter-24v')
    b.setTweak('behavior:th.fan', 1)
    s = await run(b, 500)
    expect(Math.abs(s.values[TJ] - (25 + 12.8 * 8.25))).toBeLessThan(5)
    b.dispose()
  })
})

// ── guide: shape and end to end (same rig as thermistor.test.ts) ──

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

describe('thermal-design guide: shape', () => {
  it('validates, 5-9 steps, at most one manual, ends on the quiz, has break and repair steps', () => {
    expect(validateLesson(lesson)).toEqual([])
    const n = lesson.guide!.length
    expect(n).toBeGreaterThanOrEqual(5)
    expect(n).toBeLessThanOrEqual(9)
    expect(lesson.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
    expect(JSON.stringify(lesson.guide).split('"manual"').length - 1).toBeLessThanOrEqual(1)
    expect(lesson.guide!.some((s) => JSON.stringify(s.check).includes('"break"'))).toBe(true)
    expect(lesson.guide!.some((s) => JSON.stringify(s.check).includes('"repair"'))).toBe(true)
    expect(new Set(lesson.guide!.map((s) => s.id)).size).toBe(n)
  })
})

describe('thermal-design guide: end to end', () => {
  it('walks every step on a real bench', async () => {
    const r = rig()
    r.inspect('u1')
    await r.finish('meet-the-regulator')
    r.act('power')
    await r.finish('power-on')
    await r.finish('watch-it-heat', 40)
    r.tweak('Airflow', 1)
    await r.finish('fan-on', 20)
    r.tweak('Heatsink', 2)
    await r.finish('bigger-sink', 20)
    r.act('break:dry-tab')
    await r.finish('dry-tab', 10)
    r.act('break:no-heatsink')
    await r.finish('no-heatsink', 40)
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })
})
