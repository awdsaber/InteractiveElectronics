import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const L = getLesson('inductor-rl') as Lesson
const FRAME = 1 / 60
const [I_L, V_TOP, V_SW, P_R1, V_SW_PEAK] = [0, 1, 2, 3, 4]

const runFor = async (b: Bench, sec: number): Promise<BenchSnapshot> => {
  const t0 = b.t
  while (b.t - t0 < sec) await b.frame(FRAME)
  return b.snapshot()
}
const within = (v: number, target: number, tol = 0.1) => {
  expect(v).toBeGreaterThan(target * (1 - tol))
  expect(v).toBeLessThan(target * (1 + tol))
}

/** supply on, button not yet pressed */
async function powered(): Promise<Bench> {
  const b = createBench(L)
  b.dispatch('power')
  await runFor(b, 0.05)
  return b
}
const press = (b: Bench) => b.setTweak('SW1.closed', 1)
const release = (b: Bench) => b.setTweak('SW1.closed', 0)

/** the scope ring value of channel `ch` at the sample nearest sim time t */
function scopeAt(b: Bench, ch: number, t: number): number {
  const r = b.scope
  let k = r.lowerBound(t)
  if (k >= r.count) k = r.count - 1
  return r.value(ch, k)
}

describe('inductor-rl lesson', () => {
  it('validates', () => {
    expect(validateLesson(L)).toEqual([])
  })

  it('is a transient lesson with a momentary SW1 button, edge substeps and a 330 V switch clamp', () => {
    expect(L.transient).toBe(true)
    expect(L.sim?.edgeSubsteps).toBeGreaterThanOrEqual(10)
    const sw = L.circuit.elements.find((e) => e.id === 'SW1')
    expect(sw).toMatchObject({ type: 'SW', closed: false, vBreak: 330, rating: { maxV: 50, maxI: 0.5 } })
    expect(L.tweaks?.find((t) => t.elementId === 'SW1')).toMatchObject({ kind: 'momentary', key: 'closed' })
  })

  it('strip → place → power: the button is open, so no current flows and the switch holds the full 5 V', async () => {
    const b = createBench(L)
    b.dispatch('strip')
    b.dispatch('place-all')
    expect(b.snapshot().status).toBe('READY')
    b.dispatch('power')
    const s = await runFor(b, 0.1)
    expect(Math.abs(s.values[I_L])).toBeLessThan(1e-6)
    within(s.values[V_SW], 5, 0.01)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('press and hold: I rises as 1 − e^(−t/τ) with τ = 10 ms toward 50 mA, R1 dissipates 0.205 W', async () => {
    const b = await powered()
    const t0 = b.t
    press(b)
    await runFor(b, 0.2)
    const tau = 1 / (18 + 82 + 0.05)
    const iFinal = 5 / 100.05
    // the scope ring holds the exact exponential (backward Euler at 1 ms: a few % low early on)
    for (const k of [0.5, 1, 2, 3, 5]) {
      const want = iFinal * (1 - Math.exp(-k))
      const got = scopeAt(b, 0, t0 + k * tau)
      within(got, want, k < 1 ? 0.12 : 0.06)
    }
    // 63.2 % of 50 mA at one time constant
    within(scopeAt(b, 0, t0 + tau), 0.0316, 0.06)
    const s = b.snapshot()
    within(s.values[I_L], 0.05, 0.01)
    within(s.values[P_R1], 0.205, 0.02)
    expect(s.elementValues['SW1.closed']).toBe(1) // the 3D button reads this and sinks while held
    within(s.values[V_TOP], 5, 0.01) // closed switch: the coil's top sits on the rail
    expect(Math.abs(s.values[V_SW])).toBeLessThan(0.05)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('the first millisecond: di/dt = V/L = 5 A/s, about 5 mA', async () => {
    const b = await powered()
    const t0 = b.t
    press(b)
    await runFor(b, 0.03)
    // sample at t0 + 1 ms
    within(scopeAt(b, 0, t0 + 0.001), 0.005, 0.12)
    b.dispose()
  })

  it('release with D1 fitted: the switch sees only ≈ 5.7 V, the current freewheels and decays', async () => {
    const b = await powered()
    press(b)
    await runFor(b, 0.15)
    b.resetPeaks()
    const tRel = b.t
    release(b)
    const s = await runFor(b, 0.2)
    // 1 ms after the switch opens the coil current is still ≈ 44.6 mA and the switch sees 5.75 V:
    // D1 holds the coil top one diode drop below ground
    within(scopeAt(b, 0, tRel + 0.001), 0.0446, 0.03)
    within(scopeAt(b, 1, tRel + 0.001), 5.75, 0.03)
    expect(Math.abs(s.values[I_L])).toBeLessThan(1e-3)
    // the held peak is the freewheel clamp, nowhere near 50 V
    expect(s.values[V_SW_PEAK]).toBeGreaterThan(5.4)
    expect(s.values[V_SW_PEAK]).toBeLessThan(7)
    expect(s.assembly.burns).toEqual([])
    // the scope: the decay after release is exponential with τ ≈ L/(R_DCR + R1) ≈ 10 ms (+ the diode drop)
    // (D1's fixed ≈ 0.75 V drop makes it a bit faster than a pure exponential: 0.29 of the start at one τ, zero by ≈ 21 ms)
    const i0 = scopeAt(b, 0, tRel + 0.0001)
    const i10 = scopeAt(b, 0, tRel + 0.0101)
    expect(i10 / i0).toBeGreaterThan(0.24)
    expect(i10 / i0).toBeLessThan(0.34)
    expect(scopeAt(b, 0, tRel + 0.025)).toBeLessThan(0.002)
    b.dispose()
  })

  it('the scope holds the whole tap: the rise, then the clamped release', async () => {
    const b = await powered()
    const t0 = b.t
    press(b)
    await runFor(b, 0.1)
    release(b)
    await runFor(b, 0.1)
    const r = b.scope
    let iMax = -Infinity
    let vMax = -Infinity
    for (let k = r.lowerBound(t0); k < r.count; k++) {
      iMax = Math.max(iMax, r.value(0, k))
      vMax = Math.max(vMax, r.value(1, k))
    }
    within(iMax, 0.05, 0.02)
    expect(vMax).toBeGreaterThan(5.4)
    expect(vMax).toBeLessThan(7)
    expect(L.instruments?.scope?.trigger).toMatchObject({ channel: 0, slope: 'rising', mode: 'normal' })
    b.dispose()
  })

  it('tweak L: τ scales with L (2 H gives 20 ms)', async () => {
    const b = await powered()
    b.setTweak('L1.value', 2)
    const t0 = b.t
    press(b)
    await runFor(b, 0.3)
    within(scopeAt(b, 0, t0 + 0.02), 0.05 * (1 - Math.exp(-1)), 0.06)
    b.dispose()
  })

  it('F1 remove the flyback diode: the kick clamps at SW1’s ≈ 330 V, far past its 50 V rating, and the contacts fail', async () => {
    const b = await powered()
    b.dispatch('break:no-flyback')
    expect(b.snapshot().partVisible.d1).toBe(false)
    const tHold = b.t
    press(b)
    await runFor(b, 0.15)
    expect(b.snapshot().assembly.burns).toEqual([]) // closed: nothing wrong yet
    release(b)
    const s = await runFor(b, 0.05)
    const burn = s.assembly.burns.find((x) => x.elementId === 'SW1')
    expect(burn).toMatchObject({ reason: 'overvoltage', limit: 50 })
    expect(burn!.value).toBeGreaterThan(300)
    expect(s.partBurnt.sw1).toBe(true)
    expect(s.status).toBe('FAULT')
    expect(s.values[V_SW_PEAK]).toBeGreaterThan(300)
    expect(s.readouts[V_SW_PEAK].peak).toBe(true)
    // the scope ring has the spike on the switch channel, off the 1 ms grid (a µs event)
    const r = b.scope
    let kMax = -1
    for (let k = r.lowerBound(tHold); k < r.count; k++) if (kMax < 0 || r.value(1, k) > r.value(1, kMax)) kMax = k
    expect(r.value(1, kMax)).toBeGreaterThan(300)
    expect(r.time(kMax) - r.time(kMax - 1)).toBeLessThan(1e-4)
    // energy that had to go somewhere: ½·L·I² = 1.25 mJ
    expect(0.5 * 1 * 0.05 ** 2).toBeCloseTo(1.25e-3, 6)
    b.dispose()
  })

  it('F2 diode fitted backwards: pressing the button short-circuits the supply through D1', async () => {
    const b = await powered()
    b.dispatch('break:reverse-diode')
    expect(b.snapshot().partVisible.d1).toBe(false)
    expect(b.snapshot().partVisible.d1rev).toBe(true)
    press(b)
    const s = await runFor(b, 0.6)
    // ≈ 40 A (only the source's 0.05 Ω and the diode drop limit it) burns the 0.5 A switch and the 1 A diode
    expect(s.assembly.burns.map((x) => x.elementId).sort()).toEqual(['D1', 'SW1'])
    expect(s.assembly.burns[0].value).toBeGreaterThan(20)
    expect(s.status).toBe('FAULT')
    b.dispose()
  })

  it('F3 too little series resistance: R1 = 22 Ω pushes 125 mA through a 100 mA choke', async () => {
    const b = await powered()
    b.dispatch('break:low-r')
    press(b)
    const s0 = await runFor(b, 0.12)
    within(s0.values[I_L], 5 / (0.05 + 18 + 22), 0.05)
    const s = await runFor(b, 1)
    expect(s.assembly.burns.some((x) => x.elementId === 'L1')).toBe(true)
    expect(s.partBurnt.l1).toBe(true)
    b.dispose()
  })

  it('Repair all brings the diode and switch back', async () => {
    const b = await powered()
    b.dispatch('break:no-flyback')
    press(b)
    await runFor(b, 0.1)
    release(b)
    await runFor(b, 0.05)
    expect(b.snapshot().assembly.burns.length).toBeGreaterThan(0)
    b.dispatch('repair')
    expect(b.snapshot().assembly.burns).toEqual([])
    expect(b.snapshot().partVisible.d1).toBe(true)
    b.dispose()
  })
})
