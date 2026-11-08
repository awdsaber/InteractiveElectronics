import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const L = getLesson('series-parallel') as Lesson
const FRAME = 1 / 60
const [I_T, I_2, I_3, V_B] = [0, 1, 2, 3]

const runFor = async (b: Bench, sec: number): Promise<BenchSnapshot> => {
  const t0 = b.t
  while (b.t - t0 < sec) await b.frame(FRAME)
  return b.snapshot()
}
const within = (v: number, target: number, tol = 0.15) => {
  expect(v).toBeGreaterThan(target * (1 - tol))
  expect(v).toBeLessThan(target * (1 + tol))
}

async function powered(): Promise<Bench> {
  const b = createBench(L)
  b.dispatch('power')
  await runFor(b, 0.3)
  return b
}

describe('series-parallel lesson', () => {
  it('validates', () => {
    expect(validateLesson(L)).toEqual([])
  })

  it('strip → place all → connect the pack: the curriculum numbers', async () => {
    const b = createBench(L)
    b.dispatch('strip')
    expect(b.snapshot().status).toBe('BARE PCB')
    b.dispatch('place-all')
    expect(b.snapshot().status).toBe('READY')
    b.dispatch('power')
    const s = await runFor(b, 0.3)
    expect(s.status).toBe('POWERED')
    within(s.values[I_T], 2.59e-3, 0.02) // 6 V / 2320.6 Ω
    within(s.values[V_B], 3.41, 0.02)
    within(s.values[I_2], 1.55e-3, 0.02)
    within(s.values[I_3], 1.03e-3, 0.02)
    expect(s.values[I_2] + s.values[I_3]).toBeCloseTo(s.values[I_T], 6) // KCL at the junction
    expect(s.statusLine.text).toMatch(/^POWERED/)
    expect(s.statusLine.text).toContain('I(R2) + I(R3) = TOTAL I')
    expect(s.statusLine.text).toContain('I(R2) + I(R3) = TOTAL I')
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('R3 slider: very high behaves as R1 + R2, low swallows the current and collapses the junction', async () => {
    const b = await powered()
    b.setTweak('R3.value', 100000)
    let s = await runFor(b, 0.2)
    within(s.values[I_T], 6 / 3200, 0.04) // R1 + R2 (+ a sliver through 100 kΩ)
    expect(s.values[I_3]).toBeLessThan(5e-5)
    b.setTweak('R3.value', 100)
    s = await runFor(b, 0.2)
    expect(s.values[V_B]).toBeLessThan(0.7) // 100 Ω ∥ 2.2 k ≈ 95.7 Ω under 1 k
    expect(s.values[I_3]).toBeGreaterThan(5 * s.values[I_2])
    expect(s.statusLine.text).toMatch(/^NOTE: R3 is the low-value branch/)
    b.dispose()
  })

  it('R1 slider changes the series current and the junction voltage together', async () => {
    const b = await powered()
    b.setTweak('R1.value', 100)
    const s = await runFor(b, 0.2)
    within(s.values[I_T], 6 / (100 + 1320), 0.02) // 4.2 mA
    within(s.values[V_B], 6 * (1320 / 1420), 0.02)
    expect(s.statusLine.text).toMatch(/^NOTE: R1 is small now/)
    expect(s.statusLine.tone).toBe('ok')
    b.dispose()
  })

  it('F1 R3 open: 1 k + 2.2 k = 3.2 kΩ, 1.87 mA, junction 4.12 V, no I(R3)', async () => {
    const b = await powered()
    b.dispatch('break:r3-open')
    expect(b.snapshot().partVisible.r3).toBe(false)
    const s = await runFor(b, 0.3)
    within(s.values[I_T], 1.87e-3, 0.02)
    within(s.values[V_B], 4.12, 0.02)
    expect(Math.abs(s.values[I_3])).toBeLessThan(1e-6)
    expect(s.assembly.burns).toEqual([])
    // the R3 slider cannot bring a removed R3 back
    b.setTweak('R3.value', 200)
    const t = await runFor(b, 0.2)
    within(t.values[I_T], 1.87e-3, 0.02)
    expect(Math.abs(t.values[I_3])).toBeLessThan(1e-6)
    b.dispose()
  })

  it('F2 bridge across the pair: 6 mA through R1 alone, junction 0 V, branches dead, nothing burns', async () => {
    const b = await powered()
    b.dispatch('break:bridge')
    expect(b.snapshot().partVisible.bridge).toBe(true)
    const s = await runFor(b, 0.3)
    within(s.values[I_T], 6e-3, 0.02)
    expect(s.values[V_B]).toBeLessThan(0.01)
    expect(Math.abs(s.values[I_2])).toBeLessThan(1e-6)
    expect(Math.abs(s.values[I_3])).toBeLessThan(1e-6)
    expect(s.assembly.burns).toEqual([]) // 36 mW in a 250 mW part
    b.dispose()
  })

  it('F3 100 Ω across R2: ≈ 93 Ω pair, 5.5 mA, junction ≈ 0.51 V, branch currents down ≈ 7×', async () => {
    const b = await powered()
    const before = b.snapshot().values
    b.dispatch('break:shunt-100')
    expect(b.snapshot().partVisible.rx).toBe(true)
    const s = await runFor(b, 0.3)
    within(s.values[I_T], 5.5e-3, 0.02)
    within(s.values[V_B], 0.51, 0.03)
    within(before[I_2] / s.values[I_2], 6.7, 0.05)
    within(before[I_3] / s.values[I_3], 6.7, 0.05)
    expect(s.assembly.burns).toEqual([])
    b.dispatch('repair')
    const r = await runFor(b, 0.3)
    within(r.values[I_T], 2.59e-3, 0.02)
    expect(b.snapshot().partVisible.rx).toBe(false)
    b.dispose()
  })

  it('the meter reads the total current', async () => {
    const b = await powered()
    expect(b.snapshot().readouts[I_T].value).toMatch(/^2\.5\d mA/)
    b.dispose()
  })
})
