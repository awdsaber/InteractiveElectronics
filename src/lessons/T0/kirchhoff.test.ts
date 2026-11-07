import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const L = getLesson('kirchhoff') as Lesson
const FRAME = 1 / 60
const [NODE_A, I1, I3, I2, R1_DROP] = [0, 1, 2, 3, 4]

const runFor = async (b: Bench, sec: number) => {
  const t0 = b.t
  while (b.t - t0 < sec) await b.frame(FRAME)
  return b.snapshot()
}
const near = (v: number, target: number, tol = 0.02) => expect(Math.abs(v - target)).toBeLessThanOrEqual(Math.abs(target) * tol + 1e-9)

async function powered(): Promise<Bench> {
  const b = createBench(L)
  b.dispatch('power')
  await runFor(b, 0.3)
  return b
}

describe('kirchhoff lesson', () => {
  it('validates', () => {
    expect(validateLesson(L)).toEqual([])
  })

  it('is dark until Output ON, then NODE A = 4.667 V with the curriculum currents and KCL / KVL closing', async () => {
    const b = createBench(L)
    expect(b.snapshot().status).toBe('READY')
    for (let i = 0; i < 12; i++) await b.frame(FRAME) // sim time doesn't advance until something is powered
    let s = b.snapshot()
    expect(Math.abs(s.values[NODE_A])).toBeLessThan(0.01)
    b.dispatch('power')
    s = await runFor(b, 0.3)
    expect(s.status).toBe('POWERED')
    near(s.values[NODE_A], 4.667)
    near(s.values[I1], 0.004333)
    near(s.values[I3], 0.000333, 0.05)
    near(s.values[I2], 0.004667)
    near(s.values[R1_DROP], 4.333)
    // KCL at node A, KVL around channel 1 -> R1 -> R2 -> ground
    expect(s.values[I1] + s.values[I3] - s.values[I2]).toBeCloseTo(0, 6)
    expect(9 - s.values[R1_DROP] - s.values[NODE_A]).toBeCloseTo(0, 1)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('raising channel 1 shrinks I3 to zero at V1 = 10 V (V_a = 5 V) and then reverses it', async () => {
    const b = await powered()
    b.setTweak('V1.value', 5)
    let s = await runFor(b, 0.2)
    near(s.values[NODE_A], 3.333) // (5 + 5)/3
    near(s.values[I3], 0.001667, 0.05)
    b.setTweak('V1.value', 10)
    s = await runFor(b, 0.2)
    near(s.values[NODE_A], 5.0) // I3 exactly zero when V_a = 5 V, i.e. V1 = 10 V
    expect(Math.abs(s.values[I3])).toBeLessThan(1e-5)
    b.setTweak('V1.value', 11)
    s = await runFor(b, 0.2)
    near(s.values[NODE_A], 5.333) // 16/3
    near(s.values[I3], -0.000333, 0.05)
    b.dispose()
  })

  it('channel 2 at 0 V: NODE A is 3.0 V (quiz 3)', async () => {
    const b = await powered()
    b.setTweak('V2.value', 0)
    const s = await runFor(b, 0.2)
    near(s.values[NODE_A], 3.0)
    b.dispose()
  })

  it('F1 channel 1 at 12 V: NODE A 5.67 V, I3 = -0.667 mA (the ideal channel absorbs it)', async () => {
    const b = await powered()
    b.dispatch('break:ch1-12v')
    const s = await runFor(b, 0.3)
    near(s.values[NODE_A], 5.667)
    near(s.values[I3], -0.000667)
    near(s.values[I1], 0.006333)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('F2 sink arm open: NODE A 7.0 V, I1 = 2 mA, I3 = -2 mA', async () => {
    const b = await powered()
    b.dispatch('break:sink-open')
    const s = await runFor(b, 0.3)
    near(s.values[NODE_A], 7.0)
    near(s.values[I1], 0.002)
    near(s.values[I3], -0.002)
    expect(Math.abs(s.values[I2])).toBeLessThan(1e-6)
    b.dispose()
  })

  it('F3 short at node A: 0 V, 9 mA + 5 mA = 14 mA down the short, R1 81 mW and safe', async () => {
    const b = await powered()
    b.dispatch('break:short-a')
    const s = await runFor(b, 0.3)
    expect(Math.abs(s.values[NODE_A])).toBeLessThan(0.01)
    near(s.values[I1], 0.009)
    near(s.values[I3], 0.005)
    near(s.values[I1] ** 2 * 1000, 0.081)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('F4 real supply: channel 2 refuses back-fed current, so I3 stays 0 and NODE A rises to 6 V', async () => {
    const b = await powered()
    b.dispatch('break:supply-wont-sink')
    const s = await runFor(b, 0.3)
    near(s.values[NODE_A], 6.0)
    expect(Math.abs(s.values[I3])).toBeLessThan(1e-6)
    near(s.values[I1], 0.006)
    b.dispose()
  })

  it('repair restores the 4.667 V solution', async () => {
    const b = await powered()
    b.dispatch('break:supply-wont-sink')
    await runFor(b, 0.2)
    b.dispatch('repair')
    const s = await runFor(b, 0.3)
    near(s.values[NODE_A], 4.667)
    b.dispose()
  })
})
