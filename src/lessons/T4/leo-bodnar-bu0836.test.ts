import { describe, expect, it } from 'vitest'
import type { HidView } from '../../engine/behaviors/usb-hid'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const L = getLesson('leo-bodnar-bu0836') as Lesson
const FRAME = 1 / 60
const [THR, BRK, WIPER, DOWN, GHOSTS, ENC, RATE, BRK_GAME] = [0, 1, 2, 3, 4, 5, 6, 7]

function build(opts: { failure?: string; tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(L, { speed: 1 })
  b.dispatch('place-all')
  b.dispatch('power')
  for (const [label, v] of Object.entries(opts.tweaks ?? {})) tweak(b, label, v)
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  return b
}
function tweak(b: Bench, label: string, v: number) {
  const t = L.tweaks!.find((x) => x.label === label)!
  b.setTweak(`${t.elementId}.${t.key}`, v)
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

describe('T4 leo-bodnar-bu0836 lesson', () => {
  it('validates; no sketch; the board carries the sourced figures; the panel opens on the game controller', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.track).toBe('T4')
    expect(L.sketch).toBeUndefined()
    const facts = L.board.parts.find((p) => p.id === 'mcu')!.facts!.join(' ')
    expect(facts).toMatch(/8 analog axes, 12-bit \(4096 steps\)/)
    expect(facts).toMatch(/32 buttons/)
    expect(facts).toMatch(/6 rows × 6 columns/)
    expect(facts).toMatch(/3 simultaneous contacts/)
    expect(facts).toMatch(/500 updates per second/)
    expect(L.instruments?.hid?.instance).toBe('hid')
    expect(L.instruments?.view).toBe('hid')
  })

  it('powers to POWERED and reports at 500 Hz; pedals at rest read 0', async () => {
    const b = build()
    const s = await run(b, 1.5)
    expect(s.status).toBe('POWERED')
    expect(s.values[RATE]).toBeGreaterThan(475)
    expect(s.values[RATE]).toBeLessThan(525)
    expect(s.values[THR]).toBe(0)
    expect(s.values[BRK]).toBe(0)
    b.dispose()
  })

  it('half throttle: wiper ≈ 2.49 V, ≈ 2042 counts (±15 %); full throttle ≈ 4086', async () => {
    const b = build({ tweaks: { 'Throttle pedal': 50 } })
    let s = await run(b, 0.5)
    expect(s.values[WIPER]).toBeCloseTo(2.494, 2)
    expect(s.values[THR]).toBeGreaterThanOrEqual(2038)
    expect(s.values[THR]).toBeLessThanOrEqual(2046)
    tweak(b, 'Throttle pedal', 100)
    s = await run(b, 0.5)
    // 5 V × 1 MΩ / (1 MΩ + 0.1 Ω) on the wiper; reference 5 V: 4095 at the top
    expect(s.values[THR]).toBeGreaterThan(4080)
    b.dispose()
  })

  it('three latched switches read as three buttons; without B7\'s diode a ghost B2 appears', async () => {
    const t = { 'B1 IGNITION': 1, 'B7 LIGHTS': 1, 'B8 WIPERS': 1 }
    const b = build({ tweaks: t })
    let s = await run(b, 0.3)
    expect(s.values[DOWN]).toBe(3)
    expect(s.values[GHOSTS]).toBe(0)
    expect(s.published['hid.b2']).toBe(0)
    b.dispatch('break:no-diode-b7')
    s = await run(b, 0.3)
    expect(s.values[DOWN]).toBe(4)
    expect(s.values[GHOSTS]).toBe(1)
    expect(s.published['hid.b2']).toBe(1)
    const v = b.behaviorData('hid') as HidView
    expect(v.buttons.find((x) => x.n === 2)).toMatchObject({ on: true, ghost: true, label: 'PIT LIM' })
    expect(s.statusLine.text).toMatch(/a ghost/) // a failure's explain takes the status line
    b.dispatch('repair')
    s = await run(b, 0.3)
    expect(s.values[GHOSTS]).toBe(0)
    expect(s.values[DOWN]).toBe(3)
    b.dispose()
  })

  it('open throttle ground pins the axis near full scale at any pedal position', async () => {
    for (const pedal of [0, 30, 80]) {
      const b = build({ tweaks: { 'Throttle pedal': pedal }, failure: 'thr-ground-open' })
      const s = await run(b, 0.6)
      expect(s.values[THR]).toBeGreaterThan(4040)
      b.dispose()
    }
  })

  it('a worn brake wiper makes the axis jump toward 0 and back', async () => {
    const b = build({ tweaks: { 'Brake pedal': 60 }, failure: 'worn-wiper' })
    await run(b, 0.3)
    let lo = Infinity
    let hi = -Infinity
    await run(b, 4, (s) => {
      lo = Math.min(lo, s.values[BRK])
      hi = Math.max(hi, s.values[BRK])
    })
    expect(hi).toBeGreaterThan(2400) // 60 % ≈ 2450
    expect(lo).toBeLessThan(1500) // a dropout sagging through the 1 MΩ input
    b.dispose()
  })

  it('a long unshielded brake cable jitters the axis by tens of counts', async () => {
    const b = build({ tweaks: { 'Brake pedal': 50 }, failure: 'long-cable' })
    await run(b, 0.3)
    let lo = Infinity
    let hi = -Infinity
    await run(b, 1, (s) => {
      lo = Math.min(lo, s.values[BRK])
      hi = Math.max(hi, s.values[BRK])
    })
    expect(hi - lo).toBeGreaterThan(50)
    expect(hi - lo).toBeLessThan(400)
    b.dispose()
  })

  it('the encoder counts one step per click each way', async () => {
    const b = build()
    await run(b, 0.2)
    for (let i = 0; i < 3; i++) {
      tweak(b, 'Encoder: one click clockwise', 1)
      await run(b, 0.1)
      tweak(b, 'Encoder: one click clockwise', 0)
      await run(b, 0.1)
    }
    expect(b.snapshot().values[ENC]).toBe(3)
    tweak(b, 'Encoder: one click anticlockwise', 1)
    await run(b, 0.1)
    tweak(b, 'Encoder: one click anticlockwise', 0)
    const s = await run(b, 0.2)
    expect(s.values[ENC]).toBe(2)
    expect(s.values[GHOSTS]).toBe(0)
    expect(s.published['hid.enc_pos']).toBeCloseTo(2 / 24, 6)
    b.dispose()
  })

  it('a 5 % game deadzone zeroes a resting brake at 3 % and rescales the rest', async () => {
    const b = build({ tweaks: { 'Brake pedal': 3, 'Game deadzone': 5 } })
    let s = await run(b, 0.4)
    expect(s.values[BRK]).toBeGreaterThan(100)
    expect(s.values[BRK_GAME]).toBe(0)
    tweak(b, 'Brake pedal', 100)
    s = await run(b, 0.4)
    expect(s.values[BRK_GAME]).toBeGreaterThan(99)
    b.dispose()
  })
})
