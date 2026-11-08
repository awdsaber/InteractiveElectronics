import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { lesson as def } from './transformer'

const lesson: Lesson = { ...def, fig: def.fig ?? 99 }
const FRAME = 1 / 60

// readout indices
const [VP, VS, IP, IS, IM, VRATIO, IRATIO, SEEN, PLOAD, PIN] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

const N = 0.25 // 4 : 1 step-down

const within = (v: number, want: number, tol: number) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * tol)

function build(opts: { failure?: string; tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(lesson, { tweaks: opts.tweaks })
  b.dispatch('place-all')
  b.dispatch('power')
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  return b
}

async function run(b: Bench, seconds: number): Promise<BenchSnapshot> {
  const end = b.t + seconds
  while (b.t < end - 1e-9) await b.frame(FRAME)
  return b.snapshot()
}

describe('T1 transformer lesson', () => {
  it('validates, and the secondary amplitude is n × the primary (±5 %) at the 6 Ω load', async () => {
    expect(validateLesson(lesson)).toEqual([])
    const b = build()
    let s = b.snapshot()
    expect(s.status).toBe('POWERED')
    s = await run(b, 2)
    within(s.values[VP], 12, 0.03) // the 12 V rms source barely sags behind its own resistance
    within(s.values[VS] / s.values[VP], N, 0.05)
    within(s.values[VRATIO], 1 / N, 0.05) // V RATIO reads Vp / Vs, the turns ratio N_p / N_s
    within(s.values[VS], 2.87, 0.05)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('the currents are in the inverse ratio: I_s ≈ I_p / n', async () => {
    const b = build()
    const s = await run(b, 2)
    within(s.values[IS], 0.475, 0.05)
    within(s.values[IP], 0.1203, 0.05)
    within(s.values[IS] / s.values[IP], 1 / N, 0.05)
    within(s.values[IRATIO], 1 / N, 0.05)
    // power balance: what goes in comes out, less the copper (≈ 0.35 W of ≈ 1.4 W)
    within(s.values[PLOAD], 1.36, 0.06)
    expect(s.values[PIN]).toBeGreaterThan(s.values[PLOAD])
    expect(s.values[PIN] - s.values[PLOAD]).toBeLessThan(0.3 * s.values[PIN])
    b.dispose()
  })

  it('the source sees the load reflected: V/I ≈ R / n² (96 Ω for 6 Ω)', async () => {
    const b = build()
    const s = await run(b, 2)
    within(s.values[SEEN], 96, 0.08)
    // and a 12 Ω load reflects to twice that
    const b2 = build({ tweaks: { 'R_LOAD.value': 12 } })
    const s2 = await run(b2, 2)
    within(s2.values[SEEN], 192, 0.08)
    expect(s2.values[SEEN] / s.values[SEEN]).toBeGreaterThan(1.8)
    b.dispose()
    b2.dispose()
  })

  it('magnetizing current: with no load the primary still draws ≈ 19 mA, 90° behind the voltage', async () => {
    const b = build({ tweaks: { 'R_LOAD.value': 1000 } })
    const s = await run(b, 2)
    within(s.values[IM], 0.0186, 0.1) // 11.7 V / (2π·50·2 H)
    expect(s.values[IS]).toBeLessThan(0.005)
    within(s.values[IP], s.values[IM], 0.1)
    // the same magnetizing current under load: it does not grow with the load
    const b2 = build()
    const s2 = await run(b2, 2)
    within(s2.values[IM], 0.0186, 0.1)
    b.dispose()
    b2.dispose()
  })

  it('turns-ratio tweak: 1 : 1 gives the primary voltage back', async () => {
    const b = build({ tweaks: { 'T1.n': 1, 'R_LOAD.value': 30 } })
    const s = await run(b, 2)
    within(s.values[VS] / s.values[VP], 1, 0.05)
    b.dispose()
  })

  it('F1 (DC into the primary): nothing is induced; the primary is a 2.6 Ω resistor, the fuse blows', async () => {
    const b = build({ failure: 'dc' })
    const s = await run(b, 2) // the meters' 0.25 s memory has long since forgotten the AC
    expect(s.values[VS]).toBeLessThan(0.05)
    expect(s.assembly.burns.map((x) => x.elementId)).toContain('F1')
    b.dispose()
  })

  it('F2 (short the secondary): the secondary current explodes and the fuse blows', async () => {
    const b = build({ failure: 'short' })
    const s = await run(b, 1)
    expect(s.assembly.burns.map((x) => x.elementId)).toContain('F1')
    expect(s.values[VS]).toBeLessThan(0.3)
    b.dispose()
  })

  it('F3 (10 Hz): the magnetizing current grows five-fold', async () => {
    const b = build({ failure: 'low-freq' })
    const s = await run(b, 3)
    within(s.values[IM], 0.0186 * 5, 0.25)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('an overload (1.5 Ω) takes the secondary winding past its 1.67 A rating', async () => {
    const b = build({ tweaks: { 'R_LOAD.value': 1.5 } })
    let s = await run(b, 4)
    for (let k = 0; k < 20 && !s.assembly.burns.length; k++) s = await run(b, 1)
    expect(s.assembly.burns.map((x) => x.elementId)).toContain('RS')
    b.dispose()
  })
})
