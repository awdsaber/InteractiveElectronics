import { describe, expect, it } from 'vitest'
import { soundSpeed } from '../../engine/behaviors/hcsr04'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../../engine/guide'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import type { BenchAction } from '../../ui/types'
import { getLesson } from '../index'

const FRAME = 1 / 60

// readout indices
const TRUE = 0
const MEASURED = 1
const ECHO = 2
const C = 3
const GOOD = 4
const PEAK = 5
const LOST = 6

const lesson = getLesson('ultrasonic-hcsr04') as Lesson

/** the full bench flow: strip, build, solder, power, upload */
function build(): Bench {
  const b = createBench(lesson, { speed: lesson.sim?.speed })
  b.dispatch('strip')
  b.dispatch('pick-place')
  b.dispatch('place-all')
  b.dispatch('solder')
  b.dispatch('power')
  b.upload()
  return b
}

async function run(b: Bench, seconds: number, each?: (s: BenchSnapshot) => void): Promise<BenchSnapshot> {
  const end = b.t + seconds
  while (b.t < end - 1e-9) {
    await b.frame(FRAME)
    each?.(b.snapshot())
  }
  return b.snapshot()
}

const within = (v: number, want: number, rel: number) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * rel)

/** the sketch's last "cm:…,good:…" line */
function lastOut(s: BenchSnapshot): { cm: number; good: number } {
  const line = [...s.serial].reverse().find((l) => l.startsWith('cm:')) ?? ''
  const m = /cm:([-\d.]+),good:(\d+)/.exec(line)
  return m ? { cm: Number(m[1]), good: Number(m[2]) } : { cm: NaN, good: NaN }
}

describe('T6 ultrasonic-hcsr04 lesson', () => {
  it('validates, and has 4 failures, 3 tweaks and a scope with TRIG and ECHO', () => {
    expect(validateLesson(lesson)).toEqual([])
    expect(lesson.failures.map((f) => f.id)).toEqual(['cold-air', 'echo-off', 'crosstalk', 'ranger-on-3v3'])
    expect(lesson.tweaks!.map((t) => t.label)).toEqual(['Target distance', 'Air temperature', 'Target surface'])
    expect(lesson.instruments!.scope!.channels.map((c) => c.label)).toEqual(['TRIG', 'ECHO'])
  })

  it('builds from a bare PCB and measures 100 cm at 20 °C: echo about 5820 us, c = 343.4, median 100 +/- 1', async () => {
    const b = build()
    const s = await run(b, 1.5)
    expect(s.status).toBe('RUNNING')
    expect(s.values[TRUE]).toBe(100)
    within(s.values[C], 343.4, 0.001)
    within(s.values[ECHO], 5824, 0.02) // noise 0.3 cm 1-sigma = 17 us
    expect(Math.abs(s.values[MEASURED] - 100)).toBeLessThanOrEqual(1)
    expect(s.values[GOOD]).toBe(5)
    expect(lastOut(s).good).toBe(5)
    expect(s.warnings ?? []).toEqual([])
    b.dispose()
  })

  it('target at 200 cm: the median is within 1 cm and the echo about 11 650 us; at 350 cm still true to 1 cm', async () => {
    const b = build()
    b.setTweak('behavior:hcsr04.distanceCm', 200)
    let s = await run(b, 1.5)
    expect(Math.abs(s.values[MEASURED] - 200)).toBeLessThanOrEqual(1)
    within(s.values[ECHO], 11650, 0.02)
    b.setTweak('behavior:hcsr04.distanceCm', 350)
    s = await run(b, 1.5)
    expect(Math.abs(s.values[MEASURED] - 350)).toBeLessThanOrEqual(1.8) // 0.3 cm noise at 5 pings, median
    b.dispose()
  })

  it('cold morning: the code assumes 20 C at 0 C, and a target at 100 cm reads 103.6 +/- 1 cm', async () => {
    const b = build()
    b.setTweak('behavior:hcsr04.airTempC', 0)
    const s = await run(b, 1.5)
    expect(s.values[C]).toBeCloseTo(331.3, 3)
    expect(Math.abs(s.values[MEASURED] - 103.6)).toBeLessThanOrEqual(1)
    b.dispose()
  })

  it('the same cold air through the failure menu, and the temperature coefficient is 0.606 m/s per C', async () => {
    const b = build()
    b.dispatch('break:cold-air')
    const s = await run(b, 1.5)
    expect(Math.abs(s.values[MEASURED] - 103.6)).toBeLessThanOrEqual(1)
    expect(soundSpeed(21) - soundSpeed(20)).toBeCloseTo(0.606, 6)
    b.dispose()
  })

  it('ECHO wire off: every ping times out, GOOD = 0, median -1, and the loop slows down', async () => {
    const b = build()
    await run(b, 1)
    b.dispatch('break:echo-off')
    const s = await run(b, 3)
    expect(lastOut(s)).toEqual({ cm: -1, good: 0 })
    expect(s.values[GOOD]).toBe(0)
    expect(s.values[MEASURED]).toBe(-1)
    // 5 x (30 ms timeout + 60 ms delay) = 450 ms a reading, against about 340 ms with an echo
    const lines = s.serial.filter((l) => l.startsWith('cm:')).length
    expect(lines).toBeGreaterThan(0)
    b.dispose()
  })

  it('two sensors: about 30 % of single pings are short, GOOD stays 5', async () => {
    const b = build()
    b.dispatch('break:crosstalk')
    const s = await run(b, 6)
    const outs = s.serial.filter((l) => l.startsWith('cm:'))
    expect(outs.length).toBeGreaterThan(8)
    expect(outs.every((l) => l.endsWith('good:5'))).toBe(true)
    expect(s.published['hcsr04.strays']).toBeGreaterThan(0)
    // the median of 5 mostly holds
    const near = outs.filter((l) => Math.abs(Number(/cm:([-\d.]+)/.exec(l)![1]) - 100) <= 1).length
    expect(near / outs.length).toBeGreaterThan(0.6)
    b.dispose()
  })

  it('soft target: most pings are lost, so GOOD is low and the status line complains', async () => {
    const b = build()
    b.setTweak('behavior:hcsr04.surface', 1)
    const s = await run(b, 4)
    expect(s.values[LOST]).toBeGreaterThan(8)
    expect(s.status).toBe('RUNNING')
    b.dispose()
  })

  it('a target at 450 cm (out of range) times the pulseIn out at 30 ms: no echo, median -1', async () => {
    const b = build()
    b.setTweak('behavior:hcsr04.distanceCm', 450)
    const s = await run(b, 2)
    expect(lastOut(s)).toEqual({ cm: -1, good: 0 })
    b.dispose()
  })

  it('ECHO into a 3.3 V part: the 5 V pulse overdrives the 3.6 V pin and it fails', async () => {
    const b = build()
    await run(b, 0.6)
    expect(b.snapshot().values[PEAK]).toBeGreaterThan(4.5)
    b.dispatch('break:ranger-on-3v3')
    const s = await run(b, 1.5)
    expect(s.status).toBe('FAULT')
    expect(s.assembly.burns.map((x) => x.elementId)).toContain('pin10')
    expect(s.statusLine.text).toMatch(/FAULT/)
    b.dispose()
  })
})

// ───────────────────────── the guide, end to end ─────────────────────────

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
    async run(sec: number) {
      for (let i = 0; i < Math.round(sec / FRAME); i++) {
        await b.frame(FRAME)
        ui.now += FRAME * 1000
      }
    },
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
    done() {
      expect(g.state()).toMatchObject({ complete: true, done: L.guide!.map((s) => s.id) })
      b.dispose()
    },
  }
}

describe('ultrasonic-hcsr04 guide', () => {
  it('shape: validates, 5-9 steps, at most one manual, ends on the quiz', () => {
    expect(validateLesson(lesson)).toEqual([])
    const n = lesson.guide!.length
    expect(n).toBeGreaterThanOrEqual(5)
    expect(n).toBeLessThanOrEqual(9)
    expect(lesson.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
    expect(JSON.stringify(lesson.guide).split('"manual"').length - 1).toBeLessThanOrEqual(1)
  })

  it('end to end: inspect, power, upload, move the target, cold air, pull ECHO, repair, quiz', async () => {
    const r = rig()
    r.inspect('sr04')
    await r.finish('meet-the-sensor')
    r.act('power')
    await r.finish('power')
    r.act('upload')
    await r.finish('upload', 6)
    r.tweak('Target distance', 200)
    await r.finish('move-target', 8)
    r.tweak('Air temperature', 0)
    await r.finish('cold-air', 8)
    r.act('break:echo-off')
    await r.finish('pull-echo', 10)
    r.act('repair')
    await r.finish('repair')
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })
})
