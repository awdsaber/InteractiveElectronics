import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const L = getLesson('regulators-linear-buck') as Lesson
const FRAME = 1 / 60

// readout indices
const VIN = 0
const LIN_IN = 1
const LIN_OUT = 2
const LIN_HEAT = 3
const LIN_TJ = 4
const LIN_EFF = 5
const BUCK_IN = 6
const BUCK_OUT = 7
const DUTY = 8
const BUCK_LOSS = 9
const BUCK_EFF = 10

/** within ±tol (default 15 %) of the curriculum's number */
const near = (v: number, want: number, tol = 0.15) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * tol)

function build(opts: { failure?: string; tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(L, { tweaks: opts.tweaks })
  b.dispatch('strip')
  b.dispatch('pick-place')
  b.dispatch('place-all')
  b.dispatch('solder')
  b.dispatch('power')
  b.upload()
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  return b
}

async function run(b: Bench, seconds: number, each?: (s: BenchSnapshot) => void): Promise<BenchSnapshot> {
  const end = b.t + seconds
  while (b.t < end - 1e-9) {
    await b.frame(FRAME)
    if (each) each(b.snapshot())
  }
  return b.snapshot()
}

describe('T2 regulators-linear-buck lesson', () => {
  it('validates; the buck really switches (PWM gate pin, transient at a sub-ms step)', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.transient).toBe(true)
    expect(L.sim?.dt).toBeLessThanOrEqual(1e-3)
    expect(L.sketch?.pwmFreq).toBe(10000)
    const u1 = L.circuit.elements.find((e) => e.id === 'U1')
    expect(u1).toMatchObject({ type: 'REG', vout: 3.3, dropout: 1.1, rating: { maxV: 15, rth: 90, tMax: 150, failMode: 'shutdown' } })
  })

  it('12 V in, 100 mA each side: the LDO burns (12 − 3.3)·0.1 + 12·0.005 = 0.93 W at 26 %; the buck runs at D ≈ 3.3/12', async () => {
    const b = build()
    const s = await run(b, 1.5)
    expect(s.sketchError).toBeNull()
    expect(s.status).toBe('RUNNING')
    near(s.values[VIN], 12, 0.01)
    // linear: input current = output current + quiescent
    near(s.values[LIN_OUT], 3.3, 0.01)
    near(s.values[LIN_IN], 0.105, 0.05)
    near(s.values[LIN_HEAT], 0.93, 0.05)
    near(s.values[LIN_EFF], 26.2, 0.05)
    // buck: Vout regulated, duty close to Vout / Vin (a little above it: the switch and diode losses)
    near(s.values[BUCK_OUT], 3.3, 0.03)
    const d = s.values[DUTY]
    expect(d).toBeGreaterThan(0.275)
    near(d, 3.3 / 12, 0.15)
    near(d * s.values[VIN], s.values[BUCK_OUT], 0.15)
    // efficiency: real switch, real diode, real inductor, so somewhere around 75-85 %
    expect(s.values[BUCK_EFF]).toBeGreaterThan(70)
    expect(s.values[BUCK_EFF]).toBeLessThan(90)
    // the gap: the buck draws about a third of the linear's input current, and loses ~1/10 of the heat
    expect(s.values[BUCK_IN]).toBeLessThan(0.45 * s.values[LIN_IN])
    near(s.values[BUCK_IN], 0.33 / ((s.values[BUCK_EFF] / 100) * 12), 0.05)
    expect(s.values[BUCK_LOSS]).toBeLessThan(0.15 * s.values[LIN_HEAT])
    expect(s.values[BUCK_EFF] - s.values[LIN_EFF]).toBeGreaterThan(40)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('the LDO heats with θJA = 90 °C/W toward 25 + 0.93·90 ≈ 109 °C and stays on', async () => {
    const b = build()
    const s = await run(b, 30)
    near(s.values[LIN_TJ], 25 + 0.93 * 90, 0.05)
    expect(s.assembly.disabled).toEqual([])
    b.dispose()
  })

  it('the scope shows the inductor ripple ΔI = (Vin − Vout)·D/(L·f) ≈ 12 mA (capacitor current) on the 100 mA inductor current', async () => {
    const b = build()
    await run(b, 1.0)
    const r = b.scope
    const span = (ch: number) => {
      let lo = Infinity
      let hi = -Infinity
      let sum = 0
      let n = 0
      for (let k = Math.max(0, r.count - 200); k < r.count; k++) {
        const v = r.value(ch, k)
        lo = Math.min(lo, v)
        hi = Math.max(hi, v)
        sum += v
        n++
      }
      return { pp: hi - lo, mean: sum / n }
    }
    const cap = span(0)
    near(cap.pp, (8.7 * 0.29) / (22e-3 * 10000), 0.2)
    expect(Math.abs(cap.mean)).toBeLessThan(0.003)
    near(span(1).mean, 0.1, 0.05)
    b.dispose()
  })

  it('F1 hot-ldo: 220 mA from the bare LDO (≈ 1.97 W) trips thermal shutdown and cycles; the buck carries on', async () => {
    const b = build({ failure: 'hot-ldo' })
    let s = await run(b, 1)
    near(s.values[LIN_HEAT], 8.7 * 0.22 + 0.06, 0.05)
    let shut = false
    let back = false
    s = await run(b, 15, (x) => {
      if (x.assembly.disabled.includes('U1')) shut = true
      else if (shut) back = true
    })
    expect(shut).toBe(true)
    expect(back).toBe(true) // it recovers below 130 °C and tries again
    expect(s.assembly.burns.filter((e) => e.reason !== 'thermal-shutdown' && e.reason !== 'thermal-recover')).toEqual([])
    near(s.values[BUCK_OUT], 3.3, 0.03)
    b.dispose()
  })

  it('F1 with the big copper pour (46 °C/W) the same 1.97 W holds at about 116 °C', async () => {
    const b = build({ failure: 'hot-ldo', tweaks: { 'U1.rating.rth': 46 } })
    const s = await run(b, 30)
    expect(s.assembly.disabled).toEqual([])
    near(s.values[LIN_TJ], 25 + 1.97 * 46, 0.06)
    b.dispose()
  })

  it('F2 dropout: 4 V in leaves the LDO at 4 − 1.1 = 2.9 V while the buck still makes 3.3 V', async () => {
    const b = build({ failure: 'low-input' })
    const s = await run(b, 1.5)
    near(s.values[LIN_OUT], 2.9, 0.03)
    near(s.values[BUCK_OUT], 3.3, 0.04)
    expect(s.values[DUTY]).toBeGreaterThan(0.8)
    b.dispose()
  })

  it('F3 24 V adapter: the LDO dies over its 15 V absolute maximum; the buck halves its duty and its input current', async () => {
    const before = await run(build(), 1.5)
    const b = build({ failure: 'adapter-24v' })
    const s = await run(b, 1.5)
    expect(s.assembly.burns.some((e) => e.elementId === 'U1' && e.reason === 'overvoltage')).toBe(true)
    expect(s.values[LIN_OUT]).toBeLessThan(0.1)
    near(s.values[BUCK_OUT], 3.3, 0.03)
    near(s.values[DUTY], 3.3 / 24, 0.2)
    expect(s.values[BUCK_IN]).toBeLessThan(0.65 * before.values[BUCK_IN])
    b.dispose()
  })
})
