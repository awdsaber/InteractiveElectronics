import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const L = getLesson('encoders') as Lesson
const FRAME = 1 / 60
const [TRUE_RPM, MEAS_RPM, POS, POS_TRUE, EDGE_RATE, INVALID, , COUNT_TRUE, COUNT_SKETCH, LOST, SIGN] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function build(opts: { failure?: string; tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(L, { tweaks: opts.tweaks, speed: 1 })
  b.dispatch('place-all')
  b.dispatch('power')
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  b.upload()
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

describe('T5 encoders lesson', () => {
  it('validates; the behaviors, failures and quiz are as the curriculum lists', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.track).toBe('T5')
    expect(L.powerElementId).toBe('usb_plug')
    expect(L.behaviors!.map((x) => (typeof x === 'string' ? x : x.id))).toEqual(['tb6612', 'quad-encoder', 'mcu-supply', 'serial-plotter'])
    expect(L.failures!.map((f) => f.id)).toEqual(['no-pullups', 'swap-ab', 'noisy-12v'])
    expect(L.quiz).toHaveLength(4)
  })

  it('runs: the sketch count equals the true count, the measured speed tracks the true speed, nothing is lost', async () => {
    const b = build()
    let worst = 0
    let sawFwd = false
    let sawRev = false
    const s = await run(b, 9, (x) => {
      if (x.values[TRUE_RPM] > 30) sawFwd = true
      if (x.values[TRUE_RPM] < -30) sawRev = true
      if (b.t > 1 && Math.abs(x.values[TRUE_RPM]) > 5) worst = Math.max(worst, Math.abs(x.values[MEAS_RPM] - x.values[TRUE_RPM]))
    })
    expect(sawFwd && sawRev).toBe(true)
    expect(s.values[INVALID]).toBe(0)
    expect(s.values[COUNT_TRUE]).toBe(s.values[COUNT_SKETCH])
    expect(s.values[LOST]).toBe(0)
    expect(worst).toBeLessThan(15) // the 50 ms window lags the true speed while it sweeps (peak is ~170 rpm)
    b.dispose()
  })

  it('counts per revolution: 2112 per output turn; x2 reads half and x1 a quarter of x4', async () => {
    const b = build()
    await run(b, 3)
    const line = [...b.snapshot().serial].reverse().find((l) => /x4:/.test(l))!
    const kv = Object.fromEntries(line.split(',').map((p) => p.split(':')))
    const x4 = Number(kv.x4)
    expect(Math.abs(x4)).toBeGreaterThan(500)
    expect(Math.abs(Number(kv.x2) - x4 / 2)).toBeLessThanOrEqual(2)
    expect(Math.abs(Number(kv.x1) - x4 / 4)).toBeLessThanOrEqual(2)
    const s = b.snapshot()
    expect(Math.abs(s.values[POS] - (x4 * 360) / 2112)).toBeLessThan(0.1) // POSITION = counts x 360 / 2112
    expect(Math.abs(s.values[POS] - s.values[POS_TRUE])).toBeLessThan(30) // the true angle runs ahead by the print lag
    b.dispose()
  })

  it('the edge rate is the speed times 2112 counts per output revolution', async () => {
    const b = build()
    let peakRpm = 0
    let atPeak = 0
    await run(b, 9, (x) => {
      if (x.values[TRUE_RPM] > peakRpm) {
        peakRpm = x.values[TRUE_RPM]
        atPeak = x.values[EDGE_RATE]
      }
    })
    // the sweep tops out at 200/255 of full duty
    expect(peakRpm).toBeGreaterThan(130)
    expect(peakRpm).toBeLessThan(170)
    expect(Math.abs(atPeak - (peakRpm / 60) * 2112)).toBeLessThan(0.02 * atPeak)
    b.dispose()
  })

  it('swapped A and B: the measured speed has the opposite sign and the sign check goes negative', async () => {
    const b = build({ failure: 'swap-ab' })
    let minSign = 0
    let maxSign = 0
    await run(b, 6, (x) => {
      minSign = Math.min(minSign, x.values[SIGN])
      maxSign = Math.max(maxSign, x.values[SIGN])
    })
    expect(minSign).toBeLessThan(-500)
    expect(maxSign).toBeLessThan(50)
    expect(b.snapshot().values[INVALID]).toBe(0) // swapped is wrong, not noisy
    b.dispose()
  })

  it('missing pull-ups: the inputs float, the invalid count climbs and the count no longer matches', async () => {
    const b = build({ failure: 'no-pullups' })
    const s = await run(b, 4)
    expect(Math.abs(s.values[LOST])).toBeGreaterThan(5)
    b.dispose()
  })

  it('a slow ISR loses counts: invalid climbs and the sketch falls short of the true count', async () => {
    const b = build({ tweaks: { 'behavior:enc.isrUs': 300 } })
    const s = await run(b, 6)
    expect(s.values[INVALID]).toBeGreaterThan(30)
    expect(Math.abs(s.values[LOST])).toBeGreaterThan(100)
    b.dispose()
  })

  it('12 V with noisy wiring: the edge rate reaches thousands per second and invalid climbs with the glitches', async () => {
    const b = build({ failure: 'noisy-12v' })
    let peakEdges = 0
    const s = await run(b, 8, (x) => (peakEdges = Math.max(peakEdges, x.values[EDGE_RATE])))
    expect(peakEdges).toBeGreaterThan(5000)
    expect(s.values[INVALID]).toBeGreaterThan(20)
    b.dispose()
  })
})
