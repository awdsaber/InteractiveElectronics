import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../../engine/bench/simLoop'
import type { SampleRing } from '../../engine/bench/sampleRing'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const L = getLesson('ac-oscilloscope') as Lesson
const FRAME = 1 / 60
// readout indices
const [VPP, IN_RMS, OUT_RMS, GAIN, FREQ, PERIOD, PHASE] = [0, 1, 2, 3, 4, 5, 6]

const R = 3300
const C = 1e-6

/** the sim runs `seconds` of sim time (slow motion: many frames) */
async function run(b: Bench, seconds: number) {
  const end = b.t + seconds
  let guard = 0
  while (b.t < end - 1e-9 && guard++ < 200_000) await b.frame(FRAME)
  expect(guard).toBeLessThan(200_000)
  return b.snapshot()
}

function powered(opts: { tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(L, { speed: L.sim?.speed, ...opts })
  b.dispatch('place-all')
  b.dispatch('power')
  return b
}

const near = (v: number, want: number, tol = 0.05) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * tol)

/** times of rising crossings of `level` on a ring channel, linearly interpolated, from sim time t0 on */
function risingCrossings(r: SampleRing, ch: number, level: number, t0: number): number[] {
  const out: number[] = []
  for (let k = 1; k < r.count; k++) {
    if (r.time(k) < t0) continue
    const a = r.value(ch, k - 1)
    const c = r.value(ch, k)
    if (a < level && c >= level) out.push(r.time(k - 1) + ((level - a) / (c - a)) * (r.time(k) - r.time(k - 1)))
  }
  return out
}

function extent(r: SampleRing, ch: number, t0: number) {
  let lo = Infinity
  let hi = -Infinity
  let sum = 0
  let n = 0
  for (let k = 0; k < r.count; k++) {
    if (r.time(k) < t0) continue
    const v = r.value(ch, k)
    lo = Math.min(lo, v)
    hi = Math.max(hi, v)
    sum += v
    n++
  }
  return { lo, hi, pp: hi - lo, mean: sum / n }
}

describe('T1 ac-oscilloscope', () => {
  it('validates, with the scope open by default: two channels, 5 ms/div, a rising trigger on CH1', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.readouts.map((r) => r.label)).toEqual(['IN Vpp', 'IN RMS', 'OUT RMS', 'GAIN', 'FREQUENCY', 'PERIOD', 'PHASE'])
    expect(L.powerElementId).toBe('SW_OUT')
    expect(L.powerLabel).toBe('Generator output ON')
    expect(L.sim?.dt).toBeLessThanOrEqual(1 / 500 / 40) // at least 40 points a cycle at the top of the range
    const i = L.instruments!
    expect(i.open).toBe(true)
    expect(i.scope!.channels).toHaveLength(2)
    expect(i.scope!.timePerDiv).toBeCloseTo(5e-3, 9)
    expect(i.scope!.trigger).toMatchObject({ channel: 0, level: 0, slope: 'rising' })
    expect(L.quiz).toHaveLength(4)
  })

  it('scope samples at 50 Hz: CH1 is 10 Vpp with a 20 ms period; CH2 is 0.69 of it, lagging atan(ωRC) = 46°', async () => {
    const b = powered()
    expect(b.snapshot().status).toBe('POWERED')
    await run(b, 0.3)
    const r = b.scope
    const t0 = b.t - 0.1 // the last five periods
    const ch1 = extent(r, 0, t0)
    const ch2 = extent(r, 1, t0)
    near(ch1.pp, 10, 0.03) // 5 V peak behind 50 Ω, a hair under 10 Vpp at the filter input
    near(ch2.pp, ch1.pp * 0.694, 0.05)
    near(ch2.pp / ch1.pp, 0.69, 0.05)
    const up1 = risingCrossings(r, 0, 0, t0)
    const up2 = risingCrossings(r, 1, 0, t0)
    expect(up1.length).toBeGreaterThanOrEqual(4)
    const period = (up1[up1.length - 1] - up1[0]) / (up1.length - 1)
    near(period, 0.02)
    // CH2 crosses after CH1 by phase/360 of a period
    const lag = up2.map((t) => t - up1.filter((u) => u <= t).pop()!).filter((d) => d >= 0)
    const phase = (lag[lag.length - 1] / period) * 360
    near(phase, (Math.atan(2 * Math.PI * 50 * R * C) * 180) / Math.PI) // 46.0°: CH1 is after the 50 Ω, so R1 alone
    b.dispose()
  })

  it('readouts: 9.9 Vpp, 3.5 V RMS in, 2.4 V RMS out, 69 % gain, 50 Hz, 20 ms, −46°', async () => {
    const b = powered()
    const s = await run(b, 0.5)
    near(s.values[VPP], 10, 0.03)
    near(s.values[IN_RMS], 5 / Math.SQRT2, 0.03)
    near(s.values[OUT_RMS], 2.44, 0.05)
    near(s.values[GAIN], 69, 0.05)
    near(s.values[FREQ], 50, 0.01)
    near(s.values[PERIOD], 0.02, 0.01)
    near(s.values[PHASE], -46, 0.05)
    b.dispose()
  })

  it('sweep: 5 Hz tracks (≈ −5°), 500 Hz is down to ~0.09 and lags ~−85° (OUT RMS 0.33 V)', async () => {
    const lo = powered({ tweaks: { 'V_GEN.wave.freq': 5 } })
    let s = await run(lo, 1.5)
    near(s.values[GAIN], 100 / Math.hypot(1, 2 * Math.PI * 5 * R * C), 0.03) // 99.5 %
    near(s.values[PHASE], -(Math.atan(2 * Math.PI * 5 * R * C) * 180) / Math.PI, 0.05)
    lo.dispose()

    const hi = powered({ tweaks: { 'V_GEN.wave.freq': 500 } })
    s = await run(hi, 0.1)
    near(s.values[FREQ], 500, 0.01)
    near(s.values[OUT_RMS], 0.333, 0.05)
    near(s.values[PHASE], -84.5, 0.05)
    near(s.values[PERIOD], 0.002, 0.01)
    hi.dispose()
  })

  it('at the 48.2 Hz cutoff (1/2πRC) the output is 71 % and 45° behind', async () => {
    const b = powered({ tweaks: { 'V_GEN.wave.freq': 1 / (2 * Math.PI * R * C) } })
    const s = await run(b, 0.6)
    near(s.values[GAIN], 70.7, 0.02)
    near(s.values[PHASE], -45, 0.02)
    b.dispose()
  })

  it('F1 a 3 V DC offset lifts both traces; the DC level passes at 100 % while the AC part stays at 69 %', async () => {
    const b = powered()
    b.dispatch('break:dc-offset')
    const s = await run(b, 0.4)
    const t0 = b.t - 0.1
    near(extent(b.scope, 0, t0).mean, 3, 0.03)
    near(extent(b.scope, 1, t0).mean, 3, 0.03)
    near(extent(b.scope, 1, t0).pp, 6.9, 0.06)
    near(s.values[GAIN], 69, 0.05) // RMS readouts are the AC part only
    b.dispose()
  })

  it('F2 500 Hz via the failure button', async () => {
    const b = powered()
    b.dispatch('break:fast')
    const s = await run(b, 0.2)
    near(s.values[OUT_RMS], 0.333, 0.06)
    near(s.values[PHASE], -84.5, 0.05)
    b.dispose()
  })

  it('F3 a 47 Ω load drops CH1 to 2.4 V peak (5 × 47/97)', async () => {
    const b = powered()
    b.dispatch('break:load-47')
    await run(b, 0.3)
    const e = extent(b.scope, 0, b.t - 0.1)
    near(e.pp / 2, 2.42, 0.05)
    expect(b.snapshot().assembly.burns).toEqual([]) // 47 Ω at 2.4 V peak is only 0.06 W
    b.dispose()
  })
})
