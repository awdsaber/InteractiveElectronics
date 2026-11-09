import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import { getLesson } from '../index'

const lesson = getLesson('timer-555')!
const FRAME = 1 / 60

// readout indices
const [CAP, OUT, FREQ, DUTY, I_LED, PULSE, BLINKS, SUPPLY] = [0, 1, 2, 3, 4, 5, 6, 7]

function build(opts: { failure?: string; tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(lesson, { tweaks: opts.tweaks, speed: 1 })
  b.dispatch('place-all')
  b.dispatch('power')
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  return b
}

async function run(b: Bench, seconds: number, each?: (s: BenchSnapshot) => void): Promise<BenchSnapshot> {
  const t1 = b.t + seconds
  let s = b.snapshot()
  while (b.t < t1 - 1e-9) {
    await b.frame(FRAME)
    s = b.snapshot()
    each?.(s)
  }
  return s
}
const within = (got: number, want: number, tol: number) => Math.abs(got - want) <= tol * Math.abs(want)

describe('T3 timer-555 lesson', () => {
  it('validates; the chip has datasheet facts; the scope opens on the capacitor with both threshold marks', () => {
    expect(validateLesson(lesson)).toEqual([])
    expect(lesson.powerElementId).toBe('SW1')
    expect(lesson.instruments?.open).toBe(true)
    const marks = lesson.instruments?.scope?.channels[0].marks?.map((m) => m.value)
    expect(marks).toEqual([6, 3])
    const facts = lesson.board.parts.find((p) => p.id === 'u1')!.facts!.join(' ')
    expect(facts).toMatch(/4\.5 V to 16 V/)
    expect(facts).toMatch(/200 mA/)
    expect(facts).toMatch(/9\.4 V min/)
    expect(lesson.board.parts.filter((p) => p.kind === 'ic-dip').length).toBe(1)
  })

  it('astable at the defaults: f = 1.44/((R1 + 2 R2) C) = 1.46 Hz and duty = 52 %, within 5 %', async () => {
    const s = await run(build(), 8)
    expect(within(s.values[FREQ], 1.44 / (21e3 * 47e-6), 0.05), `freq ${s.values[FREQ]}`).toBe(true)
    expect(within(s.values[DUTY], (11 / 21) * 100, 0.05), `duty ${s.values[DUTY]}`).toBe(true)
    // the blink counter counts rising edges: about 1.46 per second over the 8 s since power-on
    expect(s.values[BLINKS]).toBeGreaterThanOrEqual(10)
    expect(s.values[BLINKS]).toBeLessThanOrEqual(13)
  })

  it('the capacitor swings between 3 V and 6 V (1/3 and 2/3 of 9 V) and the output is Vcc - 1.2 V behind 5 ohm when high', async () => {
    const b = build()
    await run(b, 1.5)
    let lo = 99
    let hi = 0
    let outHi = 0
    let outLo = 99
    let iMax = 0
    await run(b, 4, (s) => {
      lo = Math.min(lo, s.values[CAP])
      hi = Math.max(hi, s.values[CAP])
      outHi = Math.max(outHi, s.values[OUT])
      outLo = Math.min(outLo, s.values[OUT])
      iMax = Math.max(iMax, s.values[I_LED])
    })
    expect(hi).toBeGreaterThan(5.85)
    expect(hi).toBeLessThan(6.15)
    expect(lo).toBeGreaterThan(2.85)
    expect(lo).toBeLessThan(3.15)
    expect(outHi).toBeGreaterThan(7.2)
    expect(outHi).toBeLessThan(7.9)
    expect(outLo).toBeLessThan(0.3)
    // (9 - 1.2 - 1.8) / 475 is about 12.6 mA; the model's LED knee gives a little less or more
    expect(iMax).toBeGreaterThan(0.009)
    expect(iMax).toBeLessThan(0.016)
  })

  it('the frequency does not depend on the supply (6 V against 15 V), the thresholds follow it', async () => {
    const f: number[] = []
    for (const v of [6, 15]) {
      const b = build({ tweaks: { 'V_BAT.value': v } })
      let hi = 0
      await run(b, 1.5)
      const s = await run(b, 5, (x) => (hi = Math.max(hi, x.values[CAP])))
      f.push(s.values[FREQ])
      expect(within(s.values[FREQ], 1.46, 0.05), `${v} V: ${s.values[FREQ]}`).toBe(true)
      expect(within(hi, (2 / 3) * v, 0.03), `${v} V: cap peak ${hi}`).toBe(true)
    }
    expect(Math.abs(f[0] - f[1]) / f[0]).toBeLessThan(0.03)
  })

  it('tweaking R1, R2 and C1 follows the formula (10 kΩ / 100 kΩ / 10 µF: 0.69 Hz)', async () => {
    const b = build({ tweaks: { 'R1.value': 10e3, 'R2.value': 100e3, 'C1.value': 10e-6 } })
    const s = await run(b, 12)
    expect(within(s.values[FREQ], 1.44 / (210e3 * 10e-6), 0.05), `freq ${s.values[FREQ]}`).toBe(true)
    expect(within(s.values[DUTY], (110 / 210) * 100, 0.05), `duty ${s.values[DUTY]}`).toBe(true)
  })

  it('monostable: with pin 2 untied the timer rests low; TRIGGER gives one 1.1 (R1 + R2) C = 0.57 s pulse', async () => {
    const b = build({ tweaks: { 'behavior:mode.mode': 1 } })
    let s = await run(b, 1)
    expect(s.values[OUT]).toBeLessThan(0.3)
    expect(s.values[CAP]).toBeLessThan(0.1)
    expect(s.values[FREQ]).toBe(0)
    b.setTweak('SW_TRIG.closed', 1)
    await run(b, 0.1)
    b.setTweak('SW_TRIG.closed', 0)
    let peak = 0
    s = await run(b, 2, (x) => (peak = Math.max(peak, x.values[OUT])))
    expect(peak).toBeGreaterThan(7)
    expect(within(s.values[PULSE], 1.1 * 11e3 * 47e-6, 0.05), `pulse ${s.values[PULSE]}`).toBe(true)
    expect(s.values[OUT]).toBeLessThan(0.3)
    expect(s.values[BLINKS]).toBe(1)
  })

  it('F1 no R1: the discharge transistor shorts the supply, burns out, and the oscillation stops', async () => {
    const b = build({ failure: 'no-r1' })
    const s = await run(b, 4)
    expect(s.status).toBe('FAULT')
    expect(b.snapshot().assembly.burns.some((x) => x.elementId === 'SW_DIS')).toBe(true)
    expect(s.values[FREQ]).toBe(0)
    expect(s.values[OUT]).toBeLessThan(0.3)
    // a burn that big: the battery's 1.5 ohm limits it to about 5.8 A
    expect(b.snapshot().assembly.burns.find((x) => x.elementId === 'SW_DIS')!.value).toBeGreaterThan(3)
  })

  it('F2 no capacitor: the output flips every step and the status says it is step-limited', async () => {
    const b = build({ failure: 'no-cap' })
    const s = await run(b, 1)
    expect(s.values[FREQ]).toBeGreaterThan(500)
    expect(lesson.failures.find((f) => f.id === 'no-cap')!.explain).toMatch(/every simulation step/)
  })

  it('F3 two AA cells: below 4.5 V the output stays low and nothing blinks', async () => {
    const b = build({ failure: 'two-aa' })
    const s = await run(b, 4)
    expect(s.values[SUPPLY]).toBeLessThan(3.1)
    expect(s.values[OUT]).toBeLessThan(0.3)
    expect(s.values[FREQ]).toBe(0)
    expect(s.values[BLINKS]).toBe(0)
  })

  it('repairing a failure restores the blink', async () => {
    const b = build({ failure: 'two-aa' })
    await run(b, 1)
    b.dispatch('repair')
    const s = await run(b, 6)
    expect(within(s.values[FREQ], 1.46, 0.06), `freq ${s.values[FREQ]}`).toBe(true)
  })
})
