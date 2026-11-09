import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import { getLesson } from '../index'

const lesson = getLesson('diode-rectifier')!
const FRAME = 1 / 60
const [DC, RIPPLE, ILOAD, D1PK, ACIN, PIV] = [0, 1, 2, 3, 4, 5]

const VPEAK = 13.5 * Math.SQRT2 // 19.09 V, the adapter's open-circuit peak
const F = 50
const SETTLE = 1.2 // s of sim time: several RC time constants (RC = 0.1 s)

const within = (v: number, want: number, frac: number) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * frac)

function build(opts: { failure?: string; tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(lesson, { tweaks: opts.tweaks, speed: lesson.sim?.speed })
  b.dispatch('place-all')
  b.dispatch('power')
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  return b
}
async function runTo(b: Bench, t: number): Promise<BenchSnapshot> {
  while (b.t < t - 1e-9) await b.frame(FRAME)
  return b.snapshot()
}

interface Run {
  s: BenchSnapshot
  /** scope CH1 (DC out) min / max over the last 40 ms (two mains cycles) */
  lo: number
  hi: number
  /** time the output spends rising (the capacitor being recharged), per half-cycle of the rectified wave */
  tCharge: number
}

/** run to steady state and read the scope's DC-out trace over the last two cycles */
async function steady(opts: { failure?: string; tweaks?: Record<string, number> } = {}, period = 1 / (2 * F)): Promise<Run> {
  const b = build(opts)
  const s = await runTo(b, SETTLE)
  const r = b.scope
  const t0 = b.t - 2 / F
  let lo = Infinity
  let hi = -Infinity
  let rise = 0
  let prevT = NaN
  let prevV = NaN
  for (let k = r.lowerBound(t0); k < r.count; k++) {
    const v = r.value(0, k)
    const t = r.time(k)
    lo = Math.min(lo, v)
    hi = Math.max(hi, v)
    if (Number.isFinite(prevT) && v > prevV) rise += t - prevT
    prevT = t
    prevV = v
  }
  b.dispose()
  return { s, lo, hi, tCharge: rise / (2 / F / period) }
}

describe('T2 diode-rectifier lesson', () => {
  it('validates, runs on the trapezoidal rule at 50 µs in slow motion with the scope open', () => {
    expect(validateLesson(lesson)).toEqual([])
    expect(lesson.sim).toMatchObject({ method: 'trap', dt: 5e-5 })
    expect(lesson.sim!.speed!).toBeLessThanOrEqual(0.25)
    expect(lesson.instruments?.open).toBe(true)
    expect(lesson.instruments?.scope?.channels).toHaveLength(2)
    expect(lesson.powerElementId).toBe('SW_MAINS')
  })

  it('full wave: DC out = V_peak − two diode drops − winding drop; load current = DC / 100 Ω; no part burns', async () => {
    const r = await steady()
    const v = r.s.values
    // the ac-meter average agrees with the scope trace: peak − ripple/2
    within(v[DC], (r.hi + r.lo) / 2, 0.02)
    // peak = V_peak − 2·VF (≈ 0.65-0.9 V at the pulse current) − I_pulse·R_W
    const lost = VPEAK - r.hi
    expect(lost).toBeGreaterThan(2 * 0.6)
    expect(lost).toBeLessThan(2 * 0.9 + 1.5 * 1.5)
    within(v[DC], 16, 0.05)
    within(v[ILOAD], v[DC] / 100, 0.03)
    within(v[ACIN], 13.2, 0.03) // the adapter sags a little under the 150 mA load
    expect(r.s.assembly.burns).toEqual([])
    // the switch-on gulp into the empty capacitor: several amps, far under the 30 A I_FSM
    expect(v[D1PK]).toBeGreaterThan(2)
    expect(v[D1PK]).toBeLessThan(30)
  }, 120000)

  it('ripple ≈ I/(2fC) less the time the capacitor is being recharged; the meter and the scope agree', async () => {
    const r = await steady()
    const i = r.s.values[ILOAD]
    const ripple = r.hi - r.lo
    const upper = i / (2 * F * 1e-3) // 1.56 V: the capacitor feeding the load for a whole half-cycle
    within(r.s.values[RIPPLE], ripple, 0.1)
    expect(ripple).toBeLessThan(upper)
    expect(ripple).toBeGreaterThan(0.6 * upper)
    // the corrected estimate: it sags only while the diodes are off
    within(ripple, (i * (1 / (2 * F) - r.tCharge)) / 1e-3, 0.15)
  }, 120000)

  it('half wave (D2 lifted): the ripple is about twice the full-wave ripple, I/(fC)', async () => {
    const full = await steady()
    const half = await steady({ tweaks: { 'SW_D2.closed': 0 } })
    const rf = full.hi - full.lo
    const rh = half.hi - half.lo
    expect(rf / rh).toBeGreaterThan(0.38)
    expect(rf / rh).toBeLessThan(0.55)
    expect(rh).toBeLessThan(half.s.values[ILOAD] / (F * 1e-3))
    expect(rh).toBeGreaterThan(0.7 * (half.s.values[ILOAD] / (F * 1e-3)))
    expect(half.s.values[DC]).toBeLessThan(full.s.values[DC])
    // the D3-open failure is the same half-wave circuit
    const open = await steady({ failure: 'open-diode' })
    within(open.hi - open.lo, rh, 0.05)
  }, 120000)

  it('ripple is proportional to 1/C and to the load current', async () => {
    const base = await steady()
    const bigC = await steady({ tweaks: { 'C1.value': 2.2e-3 } })
    const heavy = await steady({ tweaks: { 'R_LOAD.value': 50 } })
    const r0 = base.hi - base.lo
    within((bigC.hi - bigC.lo) / r0, 1 / 2.2, 0.2)
    expect(heavy.s.values[ILOAD]).toBeGreaterThan(1.8 * base.s.values[ILOAD])
    expect((heavy.hi - heavy.lo) / r0).toBeGreaterThan(1.5)
  }, 120000)

  it('each bridge diode blocks about one peak (17 to 19 V), far below 1000 V', async () => {
    const r = await steady()
    expect(r.s.values[PIV]).toBeGreaterThan(15)
    expect(r.s.values[PIV]).toBeLessThan(20)
  }, 120000)

  it('no capacitor: DC out is the rectified average 2·V_p/π less two drops, and the ripple is the whole hump', async () => {
    const r = await steady({ failure: 'no-cap' })
    within(r.s.values[DC], (2 * VPEAK) / Math.PI - 1.6, 0.06)
    expect(r.s.values[RIPPLE]).toBeGreaterThan(15)
    expect(r.s.assembly.burns).toEqual([])
  }, 120000)

  it('a diode fitted backwards shorts the winding through D1: about 10 A, and the diodes burn', async () => {
    const r = await steady({ failure: 'reversed-diode' })
    expect(r.s.values[D1PK]).toBeGreaterThan(8)
    const burnt = r.s.assembly.burns.map((x) => x.elementId)
    expect(burnt).toContain('D1')
    expect(burnt).toContain('D2R')
    expect(r.s.assembly.burns[0].limit).toBe(1)
  }, 120000)
})
