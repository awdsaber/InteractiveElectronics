import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import { getLesson } from '../index'

const L = getLesson('mosfet-switch')!
const FRAME = 1 / 60
const [I_LOAD, V_GS, V_DS, P_Q1, P_LOAD, TJ, RDS] = [0, 1, 2, 3, 4, 5, 6]

async function runUntil(b: Bench, pred: (s: BenchSnapshot) => boolean, maxSim = 8): Promise<BenchSnapshot> {
  const t0 = b.t
  for (;;) {
    await b.frame(FRAME)
    const s = b.snapshot()
    if (pred(s)) return s
    if (b.t - t0 > maxSim) throw new Error(`condition not reached in ${maxSim}s of sim time (t=${b.t})`)
  }
}
const runFor = async (b: Bench, sec: number) => {
  const t0 = b.t
  while (b.t - t0 < sec) await b.frame(FRAME)
  return b.snapshot()
}
const high = (s: BenchSnapshot) => s.pins[9]?.mode === 'OUTPUT' && s.pins[9].level === 1
const low = (s: BenchSnapshot) => s.pins[9]?.mode === 'OUTPUT' && s.pins[9].level === 0
const within = (v: number, target: number, tol = 0.15) => {
  expect(v).toBeGreaterThan(target * (1 - tol))
  expect(v).toBeLessThan(target * (1 + tol))
}

/** powered, sketch running, heater on and settled */
async function running(): Promise<Bench> {
  const b = createBench(L)
  b.dispatch('power')
  b.upload()
  await runUntil(b, high)
  await runFor(b, 1.0)
  return b
}

describe('mosfet-switch lesson', () => {
  it('validates', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.instruments?.scope?.channels).toHaveLength(2)
    expect(L.board.parts.find((p) => p.id === 'q1')?.facts?.length).toBeGreaterThan(2)
  })

  it('strip → place → solder → power → upload: curriculum numbers with pin 9 HIGH', async () => {
    const b = createBench(L)
    b.dispatch('strip')
    expect(b.snapshot().status).toBe('BARE PCB')
    b.dispatch('place-all')
    b.dispatch('solder')
    b.dispatch('power')
    b.upload()
    expect(b.snapshot().status).toBe('RUNNING')
    await runUntil(b, high)
    let s = await runFor(b, 1.0)
    within(s.values[V_GS], 4.94, 0.02) // 5 × 10k/(10k + 125)
    within(s.values[I_LOAD], 0.99, 0.03)
    within(s.values[V_DS], 0.025, 0.2)
    within(s.values[P_Q1], 0.025, 0.2)
    within(s.values[RDS], 0.025, 0.1)
    within(s.values[P_LOAD], 11.8, 0.05)
    expect(s.values[TJ]).toBeLessThan(30)
    expect(s.serial).toContain('heater ON')
    expect(s.statusLine.text).toMatch(/pin 9 HIGH/)
    s = await runUntil(b, low)
    s = await runFor(b, 0.3)
    expect(Math.abs(s.values[I_LOAD])).toBeLessThan(1e-3)
    within(s.values[V_DS], 12, 0.02)
    expect(s.values[V_GS]).toBeLessThan(0.1)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('the gate draws no steady current: the pull-down divider only (about 0.5 mA vs the BJT lesson 8.6 mA)', async () => {
    const b = await running()
    const s = b.snapshot()
    within(Math.abs(s.current.R_G), 4.94 / 10e3, 0.05)
    b.dispose()
  })

  it('driving from 3.3 V: a logic-level part still turns on (R_DS(on) about 50 mOhm)', async () => {
    const b = await running()
    b.setTweak('PIN9.vcc', 3.3)
    const s = await runFor(b, 0.5)
    within(s.values[V_GS], 3.26, 0.03)
    within(s.values[I_LOAD], 0.99, 0.03)
    within(s.values[RDS], 0.05, 0.2)
    b.dispose()
  })

  it('threshold tweak toward 4.9 V: V_DS climbs and the FET only half turns on', async () => {
    const b = await running()
    const before = b.snapshot().values[P_Q1]
    b.setTweak('Q1.vth', 4.9)
    const s = await runFor(b, 0.5)
    expect(s.values[RDS]).toBeGreaterThan(1)
    expect(s.values[V_DS]).toBeGreaterThan(1.5)
    expect(s.values[P_Q1]).toBeGreaterThan(before * 3)
    expect(s.values[I_LOAD]).toBeLessThan(0.9)
    b.dispose()
  })

  it('load tweak: about 6 A through the FET warms it (Tj = 25 + 62 P)', async () => {
    const b = await running()
    b.setTweak('R_LOAD.value', 2)
    let peakI = 0
    let peakT = 0
    const t0 = b.t
    while (b.t - t0 < 5) {
      await b.frame(FRAME)
      const v = b.snapshot().values
      peakI = Math.max(peakI, v[I_LOAD])
      peakT = Math.max(peakT, v[TJ])
    }
    within(peakI, 5.7, 0.1)
    expect(peakT).toBeGreaterThan(55)
    expect(peakT).toBeLessThan(110)
    const s = b.snapshot()
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('gate resistor tweak: R_G and the pull-down divide the pin, and the gate cap slows the edge', async () => {
    const b = await running()
    b.setTweak('R_G.value', 5000)
    const t0 = b.t
    await runUntil(b, low)
    await runUntil(b, high)
    const s = await runFor(b, 0.5)
    within(s.values[V_GS], (5 * 10e3) / (10e3 + 5025), 0.03)
    // the gate edge: tau about 5.7 us, so the first substeps still see it rising
    const r = b.scope
    let seenMid = false
    for (let k = r.lowerBound(t0); k < r.count; k++) {
      const v = r.value(0, k)
      if (v > 0.5 && v < 3.0) seenMid = true
    }
    expect(seenMid).toBe(true)
    b.dispose()
  })

  it('F1 IRFZ44N on 3.3 V: the gate never reaches threshold, the heater stays cold', async () => {
    const b = await running()
    b.dispatch('break:wrong-fet-3v3')
    const s = await runFor(b, 0.5)
    within(s.values[V_GS], 3.26, 0.03)
    expect(Math.abs(s.values[I_LOAD])).toBeLessThan(1e-3)
    within(s.values[V_DS], 12, 0.02)
    b.dispose()
  })

  it('F2 MOSFET fails short: the heater runs with the pin LOW', async () => {
    const b = await running()
    b.dispatch('break:fet-short')
    await runUntil(b, low)
    const s = await runFor(b, 0.3)
    within(s.values[I_LOAD], 12 / 12.11, 0.05)
    b.dispose()
  })

  it('F3 no common ground: gate fine, no load current', async () => {
    const b = await running()
    b.dispatch('break:no-common-ground')
    const s = await runFor(b, 0.3)
    expect(high(s)).toBe(true)
    within(s.values[V_GS], 4.94, 0.02)
    expect(Math.abs(s.values[I_LOAD])).toBeLessThan(1e-3)
    b.dispose()
  })

  it('F4 a 12 A heater: about 3.7 W in a TO-220 in free air cooks it past 175 C and it fails short', async () => {
    const b = await running()
    b.dispatch('break:overload')
    const s = await runUntil(b, (x) => x.assembly.burns.some((y) => y.elementId === 'Q1'), 20)
    expect(s.assembly.burns.find((y) => y.elementId === 'Q1')!.reason).toBe('overtemp')
    await runUntil(b, low)
    const later = await runFor(b, 0.3)
    expect(later.values[I_LOAD]).toBeGreaterThan(5) // stuck on
    b.dispose()
  })
})
