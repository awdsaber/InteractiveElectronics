import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { lesson as def } from './zener'

const lesson: Lesson = { ...def, fig: def.fig ?? 99 }
const FRAME = 1 / 60

// readout indices
const [VOUT, IZ, ILOAD, PR1, PZ, TR1] = [0, 1, 2, 3, 4, 5]

/** within ±15 % of the expected number */
const near = (v: number, want: number) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * 0.15)

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

async function runUntilBurn(b: Bench, maxSim: number): Promise<BenchSnapshot> {
  const t0 = b.t
  while (b.t - t0 < maxSim) {
    await b.frame(FRAME)
    if (b.snapshot().assembly.burns.length) break
  }
  return b.snapshot()
}

describe('T2 zener lesson', () => {
  it('validates and regulates: the 1N4733A (5.1 V at 49 mA, 7 Ω) sits at ~4.9 V at 24 mA; R1 33.6 mA, load 9.7 mA', async () => {
    expect(validateLesson(lesson)).toEqual([])
    const b = build()
    let s = b.snapshot()
    expect(s.status).toBe('POWERED')
    s = await run(b, 0.3)
    expect(s.values[VOUT]).toBeGreaterThan(4.8) // datasheet 5.1 V at 49 mA, less 7 Ω × 25 mA
    expect(s.values[VOUT]).toBeLessThan(5.1)
    near(s.values[VOUT], 4.92)
    near(s.values[IZ], 0.0239)
    expect(s.values[IZ]).toBeGreaterThan(0) // positive: the zener is read through an in-line ammeter
    near(s.values[ILOAD], 0.00965)
    near(s.values[PR1], 0.135)
    near(s.values[PZ], 0.118)
    // Kirchhoff: R1 current = zener + load
    near(s.values[IZ] + s.values[ILOAD], (9 - s.values[VOUT]) / 121.5)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('sweeping V_in: below ~5 V the output follows the input; above it the output barely moves (rz = 7 Ω)', async () => {
    const at = async (v: number) => (await run(build({ tweaks: { 'V_BAT.value': v } }), 0.3)).values[VOUT]
    const v3 = await at(3)
    near(v3, (3 * 510) / (510 + 121.5)) // plain divider
    const v9 = await at(9)
    const v11 = await at(11)
    expect(v11 - v9).toBeGreaterThan(0)
    expect(v11 - v9).toBeLessThan(0.15) // 2 V more input, ~0.1 V more output
    expect(v9).toBeGreaterThan(4.8)
  })

  it('load regulation: 510 Ω to 220 Ω moves V OUT by less than 0.1 V, and the zener gives up the load current', async () => {
    const base = await run(build(), 0.3)
    const heavy = await run(build({ tweaks: { 'R_LOAD.value': 220 } }), 0.3)
    expect(Math.abs(heavy.values[VOUT] - base.values[VOUT])).toBeLessThan(0.1)
    expect(heavy.values[IZ]).toBeLessThan(base.values[IZ] - 0.01)
    expect(heavy.values[IZ]).toBeGreaterThan(0.005)
  })

  it('F1 15 V adapter: R1 carries ~80 mA / 0.8 W and burns open, the zener (~0.37 W) was fine; V OUT collapses', async () => {
    const b = build()
    await run(b, 0.5)
    b.dispatch('break:adapter-15v')
    let s = await run(b, 0.5)
    near(s.values[PR1], 0.8)
    near(s.values[PZ], 0.37)
    expect(s.assembly.burns).toEqual([])
    s = await runUntilBurn(b, 20)
    expect(s.assembly.burns).toHaveLength(1)
    expect(s.assembly.burns[0]).toMatchObject({ elementId: 'R1', reason: 'overtemp' })
    expect(s.partBurnt.r1).toBe(true)
    expect(s.partBurnt.z1).toBeFalsy()
    expect(s.status).toBe('FAULT')
    s = await run(b, 0.3)
    expect(s.values[VOUT]).toBeLessThan(0.1)
    b.dispatch('repair')
    s = await run(b, 0.5)
    near(s.values[VOUT], 4.92)
    b.dispose()
  })

  it('F2 100 Ω load: the zener drops out; V OUT = 9 × 100/221.5 ≈ 4.06 V and the zener current is ~0', async () => {
    const b = build()
    await run(b, 0.3)
    b.dispatch('break:heavy-load')
    const s = await run(b, 0.5)
    near(s.values[VOUT], 4.06)
    expect(Math.abs(s.values[IZ])).toBeLessThan(0.001)
    near(s.values[ILOAD], 0.0406)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('F3 zener backwards: it clamps at one diode drop (~0.7 V), ~68 mA flows and R1 (0.56 W) burns', async () => {
    const b = build()
    await run(b, 0.3)
    b.dispatch('break:zener-backwards')
    expect(b.snapshot().partVisible.z1).toBe(false)
    expect(b.snapshot().partVisible.z1rev).toBe(true)
    let s = await run(b, 0.5)
    expect(s.values[VOUT]).toBeGreaterThan(0.55)
    expect(s.values[VOUT]).toBeLessThan(0.9)
    near(s.values[IZ], 0.068)
    near(s.values[PR1], 0.56)
    s = await runUntilBurn(b, 20)
    expect(s.assembly.burns[0]).toMatchObject({ elementId: 'R1', reason: 'overtemp' })
    expect(s.t).toBeGreaterThan(4)
    b.dispose()
  })

  it('dropout boundary: a 150 Ω load has left regulation (the edge is ~160 Ω); 330 Ω keeps the zener above 5 mA', async () => {
    const light = await run(build({ tweaks: { 'R_LOAD.value': 330 } }), 0.3)
    expect(light.values[IZ]).toBeGreaterThan(0.005)
    const heavy = await run(build({ tweaks: { 'R_LOAD.value': 150 } }), 0.3)
    expect(heavy.values[IZ]).toBeLessThan(0.005)
    expect(heavy.values[VOUT]).toBeLessThan(4.79)
  })

  it('R1 temperature warns above 90 °C and the zener stays cool (1 W part)', async () => {
    const b = build({ tweaks: { 'V_BAT.value': 11 } })
    const s = await run(b, 40)
    expect(s.values[TR1]).toBeGreaterThan(90)
    expect(s.readouts[TR1].tone).toBe('warn')
    b.dispose()
  })
})
