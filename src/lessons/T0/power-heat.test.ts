import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { partState } from '../../three/Board'
import { partBakeKey } from '../../three/parts/frame'
import { lesson as def } from './power-heat'

const lesson: Lesson = { ...def, fig: def.fig ?? 3 }
const FRAME = 1 / 60

// readout indices
const [CURRENT, POWER, TEMP, VOLTS] = [0, 1, 2, 3]

/** within ±15 % of the curriculum's number */
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

describe('T0 power-heat lesson', () => {
  it('validates and powers up with the curriculum numbers: 22.7 mA, 0.114 W, 45 % of the rating', async () => {
    expect(validateLesson(lesson)).toEqual([])
    const b = build()
    let s = b.snapshot()
    expect(s.status).toBe('POWERED')
    s = await run(b, 0.3)
    near(s.values[CURRENT], 0.0227)
    near(s.values[POWER], 0.114)
    near(s.values[VOLTS], 5)
    expect(s.values[POWER] / 0.25).toBeGreaterThan(0.4)
    expect(s.values[POWER] / 0.25).toBeLessThan(0.5)
    b.dispose()
  })

  it('heat takes time: BODY TEMP starts at ambient, climbs gradually and settles near 25 + 0.114 × 340 ≈ 64 °C without burning', async () => {
    const b = build()
    let s = await run(b, 0.2)
    expect(s.values[TEMP]).toBeLessThan(28) // power is instant, temperature is not
    s = await run(b, 2)
    const mid = s.values[TEMP]
    expect(mid).toBeGreaterThan(30)
    expect(mid).toBeLessThan(55)
    s = await run(b, 40)
    near(s.values[TEMP], 64)
    expect(s.assembly.burns).toEqual([])
    expect(s.status).toBe('POWERED')
    b.dispose()
  })

  it('halving R doubles the power; doubling V quadruples it (P = V²/R)', async () => {
    const half = await run(build({ tweaks: { 'R1.value': 110 } }), 0.3)
    near(half.values[POWER], 0.227)
    const dbl = await run(build({ tweaks: { 'V_PSU.value': 10 } }), 0.3)
    near(dbl.values[POWER], 0.4545)
    near(dbl.values[POWER] / 0.114, 4)
  })

  it('a resistor at its full 0.25 W rating (100 Ω on 5 V) runs hot but survives: Tj = 25 + 0.25 × 340 ≈ 110 °C', async () => {
    const b = build({ tweaks: { 'R1.value': 100 } })
    const s = await run(b, 40)
    near(s.values[POWER], 0.25)
    near(s.values[TEMP], 110)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('F1 47 Ω on 5 V: 0.53 W (213 % of the rating), temperature climbs past 155 °C and R1 burns open; current drops to 0', async () => {
    const b = build()
    await run(b, 0.5)
    b.dispatch('break:r-47')
    let s = await run(b, 0.5)
    near(s.values[POWER], 0.53)
    near(s.values[CURRENT], 0.106)
    // not the old 300 ms over-power timer: the part is still alive, just heating
    expect(s.assembly.burns).toEqual([])
    expect(s.values[TEMP]).toBeGreaterThan(30)
    s = await runUntilBurn(b, 20)
    expect(s.assembly.burns).toHaveLength(1)
    expect(s.assembly.burns[0]).toMatchObject({ elementId: 'R1', reason: 'overtemp', limit: 155 })
    expect(s.partBurnt.r1).toBe(true)
    expect(s.status).toBe('FAULT')
    // burn time: Tj = 25 + 180·(1 − e^(−t/τ)) hits 155 °C at τ·ln(1/(1 − 130/180)) with τ = 5 s: 6.4 s
    expect(s.t).toBeGreaterThan(5)
    expect(s.t).toBeLessThan(9)
    s = await run(b, 0.3)
    expect(Math.abs(s.values[CURRENT])).toBeLessThan(1e-4)
    b.dispatch('repair')
    s = await run(b, 0.5)
    expect(s.assembly.burns).toEqual([])
    near(s.values[CURRENT], 0.0227)
    b.dispose()
  })

  it('F2 supply to 12 V on 220 Ω: 54.5 mA, 0.65 W (5.8× the power for 2.4× the voltage), R1 burns', async () => {
    const b = build()
    await run(b, 0.5)
    b.dispatch('break:v-12')
    let s = await run(b, 0.5)
    near(s.values[CURRENT], 0.0545)
    near(s.values[POWER], 0.65)
    near(s.values[POWER] / 0.114, 5.8)
    s = await runUntilBurn(b, 20)
    expect(s.assembly.burns[0]).toMatchObject({ elementId: 'R1', reason: 'overtemp' })
    expect(s.partBurnt.r1).toBe(true)
    b.dispose()
  })

  it('F3 a 2 W resistor in place of the 47 Ω: the same 0.53 W, but the lower thermal resistance keeps it cool and alive', async () => {
    const b = build()
    b.dispatch('break:big-2w')
    expect(b.snapshot().partVisible.r1).toBe(false)
    expect(b.snapshot().partVisible.r1big).toBe(true)
    const s = await run(b, 40)
    near(s.values[POWER], 0.53)
    near(s.values[TEMP], 47.5) // 25 + 0.53 × 42.5
    expect(s.assembly.burns).toEqual([])
    expect(s.status).not.toBe('FAULT')
    b.dispose()
  })

  it('ambient boundary: 0.37 W survives on the 25 °C bench, 0.4 W burns (limit 130/340 = 0.38 W)', async () => {
    // 5 V across R: 0.37 W is 67.6 Ω, 0.4 W is 62.5 Ω
    const sOk = await run(build({ tweaks: { 'R1.value': 67.6 } }), 40)
    expect(sOk.assembly.burns).toEqual([])
    expect(sOk.values[TEMP]).toBeGreaterThan(145)
    const sHot = await runUntilBurn(build({ tweaks: { 'R1.value': 62.5 } }), 40)
    expect(sHot.assembly.burns[0]).toMatchObject({ elementId: 'R1', reason: 'overtemp' })
  })

  it('BODY TEMP warns above 90 °C, and the glow never changes the bake key', async () => {
    const b = build({ tweaks: { 'R1.value': 100 } })
    expect(b.snapshot().readouts[TEMP].tone).toBe('normal')
    const s = await run(b, 40)
    expect(s.readouts[TEMP].tone).toBe('warn')
    expect(s.readouts[CURRENT].tone).toBe('normal')
    const part = lesson.board.parts.find((p) => p.id === 'r1')!
    const st = (glow: number) => ({ visible: true, soldered: false, glow, burnt: false, explodedOffset: 0, showLabel: false, glowColor: '#ff6a1f' })
    expect(partBakeKey(part, st(0.3), {})).toBe(partBakeKey(part, st(0.9), {}))
  })

  it('the resistor glows as it heats (3D render state), and the status line warns before it burns', async () => {
    const b = build({ tweaks: { 'R1.value': 100 } })
    const cool = partState(lesson, lesson.board.parts.find((p) => p.id === 'r1')!, b.snapshot())
    expect(cool.glow).toBe(0)
    const s = await run(b, 40)
    const hot = partState(lesson, lesson.board.parts.find((p) => p.id === 'r1')!, s)
    expect(hot.glow).toBeGreaterThan(0.3)
    expect(hot.glowColor).toBeDefined()
    expect(s.statusLine.text).toMatch(/too hot.*155/)
    b.dispose()
  })
})
