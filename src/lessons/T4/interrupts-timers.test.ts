import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const L = getLesson('interrupts-timers') as Lesson
const FRAME = 1 / 60

// readout indices
const [TRUE_HZ, COUNTED_HZ, RPM, , PRESSES, ISR_EDGES, PIN2, DROPPED, L_LED] = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const HZ = 'behavior:tach.hz'
const PRESS = 'behavior:bounce.press'

function build(opts: { failure?: string; tweaks?: Record<string, number>; code?: string } = {}): Bench {
  const b = createBench(L, { tweaks: opts.tweaks, speed: 1 })
  b.dispatch('place-all')
  b.dispatch('power')
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  b.upload(opts.code)
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

/** the last serial line, parsed as name:value pairs */
function serial(s: BenchSnapshot): Record<string, number> {
  const out: Record<string, number> = {}
  const line = [...s.serial].reverse().find((l) => /tach_hz:/.test(l)) ?? ''
  for (const kv of line.split(',')) {
    const [k, v] = kv.split(':')
    out[k] = Number(v)
  }
  return out
}
const within = (got: number, want: number, tol: number) => Math.abs(got - want) <= tol * Math.abs(want)

async function tap(b: Bench, holdS: number, gapS: number) {
  b.setTweak(PRESS, 1)
  await run(b, holdS)
  b.setTweak(PRESS, 0)
  await run(b, gapS)
}

describe('T4 interrupts-timers lesson', () => {
  it('validates; the Uno and the sensor carry datasheet facts; the scope opens on the tach and the debounce node', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.track).toBe('T4')
    expect(L.powerElementId).toBe('usb_plug')
    const uno = L.board.parts.find((p) => p.id === 'uno')!
    const facts = (uno.facts ?? []).join(' ')
    expect(facts).toMatch(/INT0.*pin 2/)
    expect(facts).toMatch(/INT1.*pin 3/)
    expect(facts).toMatch(/16-bit/)
    expect(L.board.parts.find((p) => p.id === 'hall')!.facts!.join(' ')).toMatch(/25 mA/)
    expect(L.instruments?.scope?.channels.length).toBe(2)
    expect(L.sketch!.code).toMatch(/volatile unsigned long tachCount/)
    expect(L.sketch!.code).toMatch(/noInterrupts\(\)/)
    expect(L.sketch!.code).toMatch(/attachInterrupt\(digitalPinToInterrupt\(3\)/)
  })

  it('at 50 Hz the ISR counts every pulse: tach_hz 50, 3000 rpm, and Timer1 blinks L at 1 Hz', async () => {
    const b = build()
    let transitions = 0
    let prev = false
    await run(b, 1.5)
    const s = await run(b, 4, (x) => {
      const on = x.values[L_LED] > 1e-3
      if (on !== prev) transitions++
      prev = on
    })
    const v = serial(s)
    expect(v.tach_hz).toBeGreaterThanOrEqual(49)
    expect(v.tach_hz).toBeLessThanOrEqual(51)
    expect(v.rpm).toBe(v.tach_hz * 60)
    expect(within(s.values[RPM], 3000, 0.03)).toBe(true)
    expect(s.values[TRUE_HZ]).toBe(50)
    expect(within(s.values[COUNTED_HZ], 50, 0.03)).toBe(true)
    // 4 s at 2 toggles per second
    expect(transitions).toBeGreaterThanOrEqual(7)
    expect(transitions).toBeLessThanOrEqual(9)
    expect(s.values[DROPPED]).toBe(0)
  })

  it('at 2 kHz the ISR still counts every edge while polling with delay(1) misses most of them', async () => {
    const b = build({ tweaks: { [HZ]: 2000 } })
    const s = await run(b, 4)
    const v = serial(s)
    expect(within(v.tach_hz, 2000, 0.02), `isr ${v.tach_hz}`).toBe(true)
    expect(v.rpm).toBe(v.tach_hz * 60)
    expect(v.poll_hz, `polled ${v.poll_hz}`).toBeLessThan(0.4 * v.tach_hz)
    expect(v.poll_hz).toBeGreaterThan(0)
    expect(s.values[DROPPED]).toBe(0)
  })

  it('a 20 kHz wheel is still counted exactly (the ISR costs 5 us, a pulse arrives every 50 us)', async () => {
    const b = build({ tweaks: { [HZ]: 20000 } })
    const s = await run(b, 3)
    const v = serial(s)
    expect(within(v.tach_hz, 20000, 0.01), `isr ${v.tach_hz}`).toBe(true)
    expect(s.values[DROPPED]).toBe(0)
  })

  it('a button press counts once through the 1 kΩ + 1 µF filter, and once by polling', async () => {
    const b = build()
    await run(b, 1.5)
    await tap(b, 0.4, 0.6)
    const s = await run(b, 1.2)
    expect(s.values[PRESSES]).toBe(1)
    expect(s.values[ISR_EDGES]).toBe(1)
    expect(s.values[PIN2]).toBeGreaterThan(4.5)
  })

  it('F1: without the capacitor one press gives several ISR edges while the debounced count still goes up by 1', async () => {
    const b = build({ failure: 'no-debounce-cap' })
    await run(b, 1.5)
    await tap(b, 0.4, 0.6)
    const s = await run(b, 1.2)
    expect(s.values[PRESSES]).toBe(1)
    // press: 1 + 1..5 closings; release: 0..3 re-closings
    expect(s.values[ISR_EDGES]).toBeGreaterThanOrEqual(2)
    expect(s.values[ISR_EDGES]).toBeLessThanOrEqual(9)
    // repeat a few times: the ISR edge count per press is never below the press count
    for (let k = 0; k < 4; k++) await tap(b, 0.3, 0.5)
    const s2 = await run(b, 1.2)
    expect(s2.values[PRESSES]).toBe(5)
    expect(s2.values[ISR_EDGES]).toBeGreaterThan(5)
  })

  it('F2: without the pull-up a stopped-ish wheel (1 Hz) still reads tens to hundreds of Hz of noise', async () => {
    const b = build({ failure: 'no-pullup', tweaks: { [HZ]: 1 } })
    const s = await run(b, 4)
    const v = serial(s)
    expect(v.tach_hz).toBeGreaterThan(20)
    expect(v.tach_hz).toBeLessThan(400)
    expect(s.values[TRUE_HZ]).toBe(1)
  })

  it('F3: at 300 kHz the ISR runs out of time: edges are dropped and the count stays at or under 200 kHz', async () => {
    const b = build({ failure: 'wheel-300k' })
    const s = await run(b, 2.5)
    const v = serial(s)
    expect(s.values[TRUE_HZ]).toBe(300000)
    expect(s.values[DROPPED]).toBeGreaterThan(1e5)
    expect(v.tach_hz).toBeLessThanOrEqual(200000)
    expect(v.tach_hz).toBeGreaterThan(50000)
  })

  it('polling with delay(300) misses short taps that the ISR still counts', async () => {
    const code = L.sketch!.code.replace('#define LOOP_DELAY 1', '#define LOOP_DELAY 300')
    expect(code).not.toBe(L.sketch!.code)
    const b = build({ code, failure: 'no-debounce-cap' })
    await run(b, 2)
    for (let k = 0; k < 6; k++) await tap(b, 0.08, 0.7)
    const s = await run(b, 1.5)
    expect(s.values[PRESSES]).toBeLessThan(6)
    expect(s.values[ISR_EDGES]).toBeGreaterThanOrEqual(6)
  })
})
