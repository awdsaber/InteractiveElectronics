import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import { getLesson } from '../index'

const lesson = getLesson('rlc-resonance')!
const FRAME = 1 / 60

// readout indices
const [VC, IL, PEAK, F0, ZETA, FD, Q, GAIN] = [0, 1, 2, 3, 4, 5, 6, 7]

// the loop: R_D + 10 Ω DCR + 0.05 Ω generator + 2 × 0.05 Ω switch contacts
const L = 0.01
const C = 1e-6
const R_EXTRA = 10 + 0.15
const Z0 = Math.sqrt(L / C) // 100 Ω
const F_0 = 1 / (2 * Math.PI * Math.sqrt(L * C)) // 1591.5 Hz
const zetaOf = (rd: number) => (rd + R_EXTRA) / (2 * Z0)
const fdOf = (z: number) => F_0 * Math.sqrt(1 - z * z)
/** first overshoot of a unit step, e^(−πζ/√(1−ζ²)) */
const overshoot = (z: number) => Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z))

const within = (v: number, want: number, frac: number) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * frac)

function build(opts: { failure?: string; tweaks?: Record<string, number>; speed?: number } = {}): Bench {
  // the app's store starts the bench at lesson.sim.speed; headless benches take it as an option
  const b = createBench(lesson, { tweaks: opts.tweaks, speed: opts.speed ?? lesson.sim?.speed })
  b.dispatch('place-all')
  b.dispatch('power')
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  return b
}

async function runTo(b: Bench, t: number): Promise<BenchSnapshot> {
  while (b.t < t - 1e-9) await b.frame(FRAME)
  return b.snapshot()
}

/** scope samples of channel `ch` in [t0, t1) */
function trace(b: Bench, ch: number, t0: number, t1: number): { t: number[]; v: number[] } {
  const r = b.scope
  const t: number[] = []
  const v: number[] = []
  for (let k = r.lowerBound(t0); k < r.count && r.time(k) < t1; k++) {
    t.push(r.time(k))
    v.push(r.value(ch, k))
  }
  return { t, v }
}

/** times where v crosses `level` (linear interpolation) */
function crossings(tr: { t: number[]; v: number[] }, level: number): number[] {
  const out: number[] = []
  for (let k = 1; k < tr.v.length; k++) {
    const a = tr.v[k - 1] - level
    const c = tr.v[k] - level
    if ((a < 0 && c >= 0) || (a > 0 && c <= 0)) out.push(tr.t[k - 1] + (a / (a - c)) * (tr.t[k] - tr.t[k - 1]))
  }
  return out
}

/** local maxima of v (strict, by sample) */
function maxima(tr: { t: number[]; v: number[] }): number[] {
  const out: number[] = []
  for (let k = 1; k < tr.v.length - 1; k++) if (tr.v[k] > tr.v[k - 1] && tr.v[k] >= tr.v[k + 1]) out.push(tr.v[k])
  return out
}

const EDGE = 0.02 // the square drive (50 Hz, 0 ↔ 5 V) rises at every 20 ms; this one starts from rest

describe('T1 rlc-resonance lesson', () => {
  it('validates, runs on the trapezoidal rule at 4 µs, starts in slow motion with the scope open', () => {
    expect(validateLesson(lesson)).toEqual([])
    expect(lesson.sim).toMatchObject({ method: 'trap', dt: 4e-6 })
    expect(lesson.sim!.speed!).toBeLessThanOrEqual(0.1)
    expect(lesson.instruments?.open).toBe(true)
    expect(lesson.instruments?.scope?.channels[0].source).toEqual({ kind: 'voltage', node: 'd' })
  })

  it('computed readouts: f0 = 1592 Hz, ζ ≈ 0.10, Q ≈ 5 from 10 mH, 1 µF and ≈ 20 Ω', async () => {
    const b = build({ speed: 1 })
    const s = await runTo(b, 0.005)
    expect(s.status).toBe('POWERED')
    within(s.values[F0], 1592, 0.005)
    within(s.values[ZETA], 0.1, 0.02)
    within(s.values[Q], 5, 0.02)
    within(s.values[FD], fdOf(zetaOf(10)), 0.001)
    b.dispose()
  })

  it('underdamped step (ζ ≈ 0.10): rings at f0·√(1−ζ²) ±5 %, first peak ≈ 8.6 V, envelope decays as e^(−ζω0t)', async () => {
    const b = build({ speed: 1 })
    await runTo(b, EDGE + 0.012)
    const z = zetaOf(10)
    const tr = trace(b, 0, EDGE, EDGE + 0.008)
    expect(tr.t.length).toBeGreaterThan(1500) // one sample per 4 µs step
    // ringing frequency from the crossings of the final value (two per cycle)
    const xs = crossings(tr, 5).slice(0, 12)
    expect(xs.length).toBe(12)
    const fRing = (xs.length - 1) / (2 * (xs[xs.length - 1] - xs[0]))
    within(fRing, fdOf(z), 0.05)
    within(fRing, 1583, 0.05)
    // first peak: 5 × (1 + e^(−πζ/√(1−ζ²))) ≈ 8.64 V
    const peaks = maxima(tr)
    within(peaks[0], 5 * (1 + overshoot(z)), 0.02)
    within(peaks[0], 8.6, 0.03)
    // successive overshoots shrink by e^(−2πζ/√(1−ζ²)) ≈ 0.53 per cycle
    const per = Math.exp((-2 * Math.PI * z) / Math.sqrt(1 - z * z))
    for (let k = 0; k < 3; k++) within((peaks[k + 1] - 5) / (peaks[k] - 5), per, 0.05)
    // after Q ≈ 5 cycles the ringing is down to about e^(−π) ≈ 4 %
    within((peaks[5] - 5) / (peaks[0] - 5), Math.exp(-Math.PI), 0.15)
    b.dispose()
  })

  it('peak coil current ≈ 43 mA and the peak-hold readout catches the 8.6 V overshoot', async () => {
    const b = build({ speed: 1 })
    await runTo(b, EDGE + 0.004)
    b.setScope([{ kind: 'current', elementId: 'L1' }, null])
    await runTo(b, 2 * EDGE + 0.004)
    const tr = trace(b, 0, 2 * EDGE, 2 * EDGE + 0.002)
    within(Math.max(...tr.v), 0.043, 0.05)
    const s = b.snapshot()
    within(s.values[PEAK], 8.64, 0.02)
    expect(s.readouts[PEAK].peak).toBe(true)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('ζ ≥ 1 has no overshoot: R_D = 190 Ω (R_total 200 Ω, critical) and 470 Ω (ζ ≈ 2.4, slower)', async () => {
    const riseTo90 = async (rd: number) => {
      const b = build({ speed: 1, tweaks: { 'R_D.value': rd } })
      await runTo(b, EDGE + 0.01)
      const s = b.snapshot()
      expect(s.values[ZETA]).toBeGreaterThanOrEqual(1)
      const tr = trace(b, 0, EDGE, EDGE + 0.0099)
      expect(Math.max(...tr.v)).toBeLessThan(5.005) // never above the final value
      expect(tr.v[tr.v.length - 1]).toBeGreaterThan(4.99) // and it does get there
      const k = tr.v.findIndex((v) => v > 4.5)
      b.dispose()
      return tr.t[k] - EDGE
    }
    const tCrit = await riseTo90(190)
    const tOver = await riseTo90(470)
    // critical: 90 % at ≈ 3.89/ω0 ≈ 0.39 ms; ζ = 2.4 is about three times slower
    within(tCrit, 3.89 / (2 * Math.PI * F_0), 0.1)
    expect(tOver).toBeGreaterThan(2.5 * tCrit)
  })

  it('sweeping R_D from 0 to 470 Ω takes ζ from ≈ 0.05 across 1 to ≈ 2.4', async () => {
    const tw = lesson.tweaks!.find((t) => t.elementId === 'R_D')!
    expect(tw.min).toBe(0)
    expect(tw.max).toBe(470)
    for (const [rd, want] of [
      [0, 0.0508],
      [470, 2.4008],
    ] as const) {
      const b = build({ speed: 1, tweaks: { 'R_D.value': rd } })
      const s = await runTo(b, 0.002)
      within(s.values[ZETA], want, 0.01)
      b.dispose()
    }
  })

  it('sine drive at f0: V_C swings Q ≈ 5 times the 1 V input; far above f0 it is attenuated as predicted', async () => {
    const gainAt = async (f?: number) => {
      const b = build({ speed: 1, tweaks: { 'behavior:drive.mode': 1, ...(f ? { 'V_SINE.wave.freq': f } : {}) } })
      expect(b.tweakValues()['V_SINE.wave.freq']).toBeCloseTo(f ?? 1592, 6) // the slider starts at f0
      await runTo(b, 0.04)
      const tr = trace(b, 0, 0.03, 0.04)
      const s = b.snapshot()
      b.dispose()
      return { sim: (Math.max(...tr.v) - Math.min(...tr.v)) / 2, theory: s.values[GAIN], status: s.status }
    }
    const res = await gainAt() // the sine starts at 1592 Hz ≈ f0
    within(res.theory, 4.96, 0.02)
    within(res.sim, res.theory, 0.05) // 1 V amplitude in
    const off = await gainAt(5000)
    within(off.sim, off.theory, 0.1)
    expect(off.sim).toBeLessThan(0.15)
  })

  it('F1 no damping resistor: ζ ≈ 0.05, the first peak reaches ≈ 9.3 V and it rings for many cycles', async () => {
    const b = build({ speed: 1, failure: 'no-damping' })
    await runTo(b, EDGE + 0.012)
    const z = zetaOf(0)
    const tr = trace(b, 0, EDGE, EDGE + 0.01)
    const peaks = maxima(tr)
    within(peaks[0], 5 * (1 + overshoot(z)), 0.02)
    within(peaks[0], 9.3, 0.02)
    // each overshoot is ≈ 0.73 of the one before: after 6 cycles still ≈ 15 % (at ζ = 0.1, 0.53⁶ ≈ 2 %)
    expect(peaks[6] - 5).toBeGreaterThan(0.1 * (peaks[0] - 5))
    const xs = crossings(tr, 5).slice(0, 16)
    within((xs.length - 1) / (2 * (xs[xs.length - 1] - xs[0])), fdOf(z), 0.05)
    expect(b.snapshot().assembly.burns).toEqual([])
    b.dispose()
  })

  it('F2 12 V hot-plug into a 16 V ceramic: V_C overshoots past 16 V, C1 fails short on overvoltage (at the lesson speed), then the coil burns', async () => {
    const b = build({ failure: 'hot-plug-12v' })
    let s = b.snapshot()
    let frames = 0
    while (!s.assembly.burns.length && frames < 2000) {
      await b.frame(FRAME)
      frames++
      s = b.snapshot()
    }
    expect(s.assembly.burns[0]).toMatchObject({ elementId: 'C1', reason: 'overvoltage' })
    expect(s.assembly.burns[0].value).toBeGreaterThan(16)
    expect(s.assembly.burns[0].value).toBeLessThan(22.5) // 12 × (1 + 0.85) ≈ 22.2 V at most
    expect(s.t).toBeLessThan(0.003) // the first half-cycle of the first step
    // a ceramic fails short: the coil alone across 12 V (≈ 1.2 A, RMS well over 0.1 A) burns next
    b.setSpeed(1)
    while (s.assembly.burns.length < 2 && b.t < 3) s = await runTo(b, b.t + 0.05)
    expect(s.assembly.burns[1].elementId).toBe('L1')
    expect(s.partBurnt.c1).toBe(true)
    expect(s.partBurnt.l1).toBe(true)
    expect(s.values[PEAK]).toBeLessThan(25) // the hold shows the real overshoot, no artefact spike
    expect(s.readouts[ZETA].value).toContain('—') // formulas no longer apply to a failed loop
    b.dispose()
  })

  it('F3 the capacitor fails short: a plain RL loop, ≈ 248 mA during each 5 V half, and the 100 mA coil burns', async () => {
    const b = build({ speed: 1, failure: 'cap-short' })
    while (b.t < 0.009) await b.frame(0.001) // stop inside the first 5 V half (0 to 10 ms)
    within(b.snapshot().values[IL], 5 / (R_EXTRA + 10), 0.05)
    expect(Math.abs(b.snapshot().values[VC])).toBeLessThan(0.01) // the short holds V_C at 0
    let s = b.snapshot()
    while (!s.assembly.burns.length && b.t < 3) s = await runTo(b, b.t + 0.05)
    expect(s.assembly.burns[0].elementId).toBe('L1')
    expect(s.partBurnt.l1).toBe(true)
    expect(s.status).toBe('FAULT')
    b.dispose()
  })

  it('keeps up in slow motion: a frame at the lesson speed costs well under the 8 ms step budget', async () => {
    const b = build()
    await runTo(b, 0.001)
    const n = 120
    const t0 = performance.now()
    for (let i = 0; i < n; i++) await b.frame(FRAME)
    const ms = (performance.now() - t0) / n
    expect(ms).toBeLessThan(8)
    within(b.snapshot().rate, lesson.sim!.speed!, 0.2) // not capped
    expect(b.snapshot().capped).toBe(false)
    b.dispose()
  })
})
