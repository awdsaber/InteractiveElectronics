import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { lesson as def } from './capacitor-rc'

const lesson: Lesson = { ...def, fig: def.fig ?? 99 }
const FRAME = 1 / 60
const [VC, ICH, ICAP] = [0, 1, 2]

const near = (v: number, want: number, tol = 0.03) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * tol)

function build(opts: { tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(lesson, { tweaks: opts.tweaks })
  b.dispatch('place-all')
  b.dispatch('power')
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
/** close the charge switch and return the sim time it happened */
function charge(b: Bench): number {
  b.setTweak('SW_CHG.closed', 1)
  return b.t
}

describe('T1 capacitor-rc lesson', () => {
  it('validates; powered, the switch is open and the cap sits at 0 V', async () => {
    expect(validateLesson(lesson)).toEqual([])
    const b = build()
    const s = await run(b, 0.5)
    expect(s.status).toBe('POWERED')
    expect(s.values[VC]).toBeLessThan(0.01)
    b.dispose()
  })

  it('charges with tau = RC = 1 s: 3.16 V at 1 s, 4.32 V at 2 s, 4.97 V at 5 s; initial current 0.5 mA', async () => {
    const b = build()
    await run(b, 0.2)
    charge(b)
    let s = await run(b, 0.05)
    near(s.values[ICH], 0.5e-3 * Math.exp(-0.05), 0.05)
    s = await run(b, 0.95)
    near(s.values[VC], 3.16, 0.02)
    near(s.values[VC] / 5, 0.632, 0.02)
    s = await run(b, 1)
    near(s.values[VC], 4.32, 0.02)
    s = await run(b, 3)
    near(s.values[VC], 4.97, 0.01)
    near(s.values[ICH], s.values[ICAP], 0.1)
    b.dispose()
  })

  it('the scope samples follow 1 - e^(-t/RC) with RC = 10 k x 100 uF', async () => {
    const b = build()
    await run(b, 0.2)
    const t0 = charge(b)
    await run(b, 5)
    const r = b.scope
    const tau = 10000.05 * 100e-6
    let n = 0
    for (let k = r.lowerBound(t0 + 0.01); k < r.count; k++) {
      const t = r.time(k) - t0
      if (t > 5) break
      const want = 5 * (1 - Math.exp(-t / tau))
      expect(Math.abs(r.value(0, k) - want)).toBeLessThan(0.02)
      n++
    }
    expect(n).toBeGreaterThan(4000)
    // the 63 % mark: the first sample at or above 3.16 V lies at t = tau
    let k63 = r.lowerBound(t0)
    while (r.value(0, k63) < 3.1606) k63++
    expect(Math.abs(r.time(k63) - t0 - 1)).toBeLessThan(0.02)
    expect(lesson.instruments?.scope?.channels).toHaveLength(2)
    b.dispose()
  })

  it('opening the charge switch holds the charge; DRAIN then empties it through 1 k with tau 0.1 s', async () => {
    const b = build()
    await run(b, 0.2)
    charge(b)
    await run(b, 5)
    b.setTweak('SW_CHG.closed', 0)
    let s = await run(b, 3)
    expect(s.values[VC]).toBeGreaterThan(4.95) // no leakage modelled: it just stays
    b.setTweak('SW_DIS.closed', 1)
    s = await run(b, 0.1)
    near(s.values[VC], 4.966 * Math.exp(-1), 0.04)
    s = await run(b, 0.6)
    expect(s.values[VC]).toBeLessThan(0.02)
    b.dispose()
  })

  it('DRAIN pressed with the charger still on only divides: 5 x 1k/11k = 0.45 V', async () => {
    const b = build()
    await run(b, 0.2)
    charge(b)
    await run(b, 5)
    b.setTweak('SW_DIS.closed', 1)
    const s = await run(b, 1)
    near(s.values[VC], 0.4545, 0.03)
    b.dispose()
  })

  it('tweaks scale tau: 1000 uF makes it 10 s (63 % at 10 s)', async () => {
    const b = build({ tweaks: { 'C1.value': 1e-3 } })
    await run(b, 0.2)
    charge(b)
    const s = await run(b, 10)
    near(s.values[VC], 3.16, 0.03)
    b.dispose()
  })

  it('F1 24 V: V_C passes 16 V at ~1.1 s and C1 fails shorted; 2.4 mA then flows through R1', async () => {
    const b = build()
    await run(b, 0.2)
    charge(b)
    const t0 = b.t
    b.dispatch('break:overvoltage-24v')
    const s0 = await runUntilBurn(b, 5)
    expect(s0.assembly.burns[0]).toMatchObject({ elementId: 'C1', reason: 'overvoltage' })
    expect(s0.t - t0).toBeGreaterThan(1.0)
    expect(s0.t - t0).toBeLessThan(1.4)
    const s = await run(b, 0.5)
    expect(s.values[VC]).toBeLessThan(0.1)
    near(s.values[ICH], 2.4e-3, 0.05)
    expect(s.partBurnt.c1).toBe(true)
    b.dispose()
  })

  it('F2 1000 uF: tau = 10 s', async () => {
    const b = build()
    await run(b, 0.2)
    charge(b)
    b.dispatch('break:big-cap')
    const s = await run(b, 10)
    near(s.values[VC], 3.16, 0.03)
    b.dispose()
  })

  it('F3 leaky cap: settles at 4.12 V with tau = 0.825 s', async () => {
    const b = build()
    await run(b, 0.2)
    charge(b)
    b.dispatch('break:leaky')
    let s = await run(b, 0.825)
    near(s.values[VC], 4.12 * 0.632, 0.03)
    s = await run(b, 6)
    near(s.values[VC], 4.12, 0.01)
    b.dispose()
  })

  it('F4 fitted backwards: the reverse voltage passes 1 V, C1 fails short and V_C collapses', async () => {
    const b = build()
    await run(b, 0.2)
    charge(b)
    b.dispatch('break:backwards')
    expect(b.snapshot().partVisible.c1).toBe(false)
    expect(b.snapshot().partVisible.c1rev).toBe(true)
    const s0 = await runUntilBurn(b, 5)
    expect(s0.assembly.burns[0]).toMatchObject({ elementId: 'C1', reason: 'reverse-voltage' })
    const s = await run(b, 0.5)
    expect(s.values[VC]).toBeLessThan(0.1)
    b.dispatch('repair')
    b.setTweak('SW_CHG.closed', 1)
    const s2 = await run(b, 1)
    expect(s2.values[VC]).toBeGreaterThan(0.2)
    b.dispose()
  })
})
