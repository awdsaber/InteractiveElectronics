import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { type GuideEvent, type GuideUi, benchActionEvents, createGuide } from '../../engine/guide'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import type { BenchAction } from '../../ui/types'
import { getLesson } from '../index'

const FRAME = 1 / 60

// readout indices
const I_SOL = 0
const SHIFT = 1
const A0 = 2
const OFF_C = 3
const ON_C = 4
const ERR_C = 5
const RAIL = 6
const RAIL_PK = 7
const DRAIN_PK = 8
const BOUNCE_PK = 9
const A0_PK = 10

const lesson = getLesson('power-grounding-emc') as Lesson

// the netlist's parasitics (1 m of 24 AWG per wire, 1 µH per metre)
const R_WIRE = 0.084
const R_PSU = 0.05
const R_SOL = 10
const R_DS = 1 / (11 * (5 - 1.5)) // IRLZ44N fit, 26 mΩ at V_GS = 5 V
const R_SW = 0.05 // the STAR / SHARED slide switch's contact (SW_RON)
const I_STAR = 12 / (R_PSU + R_WIRE + R_SOL + R_DS + R_SW + R_WIRE)
const V_CLAMP = 60 // Q1's avalanche clamp
/**
 * Turn-off without local capacitors: the gate is driven from the Uno's ground, but Q1's source sits
 * on 1 µH of return wire. As the current falls, L·di/dt pulls the source below the Uno's ground,
 * which is V_GS: Q1 holds itself partly on at the V_GS that passes the current, Vth + √(2I/k). So
 * the return wire's L·di/dt ≈ that V_GS (≈ 1.96 V, di/dt ≈ 2 A/µs), the supply wire's 1 µH adds the
 * same on top of the rail, and the rail peaks near 12 + 2·V_GS ≈ 15.9 V. All from the solve.
 */
const vgsAt = (i: number) => 1.5 + Math.sqrt((2 * i) / 11)

const pin9 = (s: BenchSnapshot) => (s.pins[9]?.mode === 'OUTPUT' ? s.pins[9].level : -1)

async function runFor(b: Bench, sec: number): Promise<BenchSnapshot> {
  const end = b.t + sec
  while (b.t < end - 1e-9) await b.frame(FRAME)
  return b.snapshot()
}

async function runUntil(b: Bench, pred: (s: BenchSnapshot) => boolean, maxSim = 6): Promise<BenchSnapshot> {
  const t0 = b.t
  for (;;) {
    await b.frame(FRAME)
    const s = b.snapshot()
    if (pred(s)) return s
    if (b.t - t0 > maxSim) throw new Error(`condition not reached in ${maxSim} s (t = ${b.t})`)
  }
}

/** a fresh serial line after `n0` lines: one full off/on cycle measured by the sketch */
const nextLine = (b: Bench, n0: number) => runUntil(b, (s) => s.serial.length > n0 && /shift_C/.test(s.serial.at(-1) ?? ''), 5)

/** USB and 12 V on, sketch running, through the first full cycle */
async function running(): Promise<Bench> {
  const b = createBench(lesson)
  b.dispatch('power')
  b.dispatch('power:V_PSU')
  b.upload()
  await nextLine(b, 0)
  return b
}

/** the solenoid on and settled (pin 9 HIGH for 0.3 s) */
async function loadOn(b: Bench): Promise<BenchSnapshot> {
  await runUntil(b, (s) => pin9(s) === 1)
  return runFor(b, 0.3)
}

const within = (v: number, target: number, tol: number) => {
  expect(v, `${v} vs ${target}`).toBeGreaterThan(target - tol)
  expect(v, `${v} vs ${target}`).toBeLessThan(target + tol)
}

describe('T7 power-grounding-emc lesson', () => {
  it('validates; failures, tweaks, a scope on the far ground, real parasitics in the netlist', () => {
    expect(validateLesson(lesson)).toEqual([])
    expect(lesson.failures.map((f) => f.id)).toEqual(['shared-return', 'thin-ground', 'no-decoupling', 'no-flyback'])
    expect(lesson.tweaks!.map((t) => t.label)).toEqual(['Load return', 'A0 filter', 'Sensor ground wire'])
    const el = (id: string) => lesson.circuit.elements.find((e) => e.id === id)!
    // every wire is R + L in the netlist, not a behavior's formula
    for (const w of ['SUP', 'RET', 'GND']) {
      expect(el(`R_W_${w}`)).toMatchObject({ type: 'R', value: R_WIRE })
      expect(el(`L_W_${w}`)).toMatchObject({ type: 'L', value: 1e-6 })
    }
    expect(el('L_SOL')).toMatchObject({ type: 'L' })
    expect(lesson.sim?.edgeSubsteps).toBeGreaterThanOrEqual(14)
    expect(lesson.instruments!.scope!.channels[0].source).toEqual({ kind: 'voltage', node: 'g_far' })
  })

  it('star return (default): the load current never touches the sensor ground; the sketch reads 25 °C either way', async () => {
    const b = await running()
    const s = await loadOn(b)
    within(s.values[I_SOL], I_STAR, 0.01)
    expect(Math.abs(s.values[SHIFT])).toBeLessThan(1e-4) // only the TMP36's 50 µA × 84 mΩ = 4 µV
    within(s.values[A0], 0.75, 0.001)
    const line = await nextLine(b, s.serial.length)
    expect(line.serial.at(-1)).toMatch(/^off_C:/)
    within(b.snapshot().values[ON_C], 25, 0.4) // 10-bit ADC: 4.9 mV = 0.49 °C per count
    expect(Math.abs(b.snapshot().values[ERR_C])).toBeLessThan(0.5)
    // the far rail droops by I × (R_psu + supply + return wire) under load, caps or not
    const on = await loadOn(b)
    within(on.values[RAIL], 12 - on.values[I_SOL] * (R_PSU + 2 * R_WIRE + R_SW), 0.01)
    expect(on.assembly.burns).toEqual([])
    b.dispose()
  })

  it('daisy chain (shared return): the sensor error is I_load × R_shared, about 98 mV = 9.8 °C', async () => {
    const b = await running()
    b.setTweak('behavior:topo.mode', 1)
    const s = await loadOn(b)
    const i = s.values[I_SOL]
    within(i, 1.17, 0.01)
    // the far ground shift is the load current times the shared wire's resistance, from the solve
    within(s.values[SHIFT], i * R_WIRE, 0.002)
    within(s.values[A0], 0.75 + i * R_WIRE, 0.002)
    await nextLine(b, s.serial.length)
    const r = b.snapshot()
    within(r.values[ERR_C], (i * R_WIRE) / 0.01, 0.6) // ≈ 9.8 °C of pure wiring error
    within(r.values[OFF_C], 25, 0.5) // load off: back to the true temperature
    // proportional to the shared resistance: double the wire, double the error
    b.setTweak('R_W_GND.value', 2 * R_WIRE)
    const s2 = await loadOn(b)
    within(s2.values[SHIFT] / s.values[SHIFT], 2, 0.03)
    b.dispose()
  })

  it('star grounding removes the error: back from shared to star, the shift falls by more than 99 %', async () => {
    const b = await running()
    b.setTweak('behavior:topo.mode', 1)
    const shared = await loadOn(b)
    b.setTweak('behavior:topo.mode', 0)
    const star = await loadOn(b)
    expect(Math.abs(star.values[SHIFT])).toBeLessThan(0.01 * shared.values[SHIFT])
    b.dispose()
  })

  it('F2 thin 30 AWG shared ground (0.34 Ω): 0.40 V shift, about a 40 °C error', async () => {
    const b = await running()
    b.dispatch('break:thin-ground')
    const s = await loadOn(b)
    within(s.values[SHIFT], s.values[I_SOL] * 0.34, 0.005)
    within(s.values[SHIFT], 0.4, 0.03)
    await nextLine(b, s.serial.length)
    within(b.snapshot().values[ERR_C], 39.5, 2)
    b.dispose()
  })

  it('with decoupling (default) the far rail barely moves at turn-off; without it the wires\u2019 L·di/dt spikes it to 12 + 2·V_GS', async () => {
    const b = await running()
    await loadOn(b)
    await runUntil(b, (s) => pin9(s) === 0)
    let s = await runFor(b, 0.05)
    // 100 µF bulk + 100 nF: the wire current dumps into the capacitors, the rail returns to 12 V
    expect(s.values[RAIL_PK]).toBeLessThan(12.3)
    expect(s.values[DRAIN_PK]).toBeLessThan(13.2) // D1 holds the drain at the rail + one diode drop
    b.dispatch('break:no-decoupling')
    const on = await loadOn(b)
    await runUntil(b, (s) => pin9(s) === 0)
    s = await runFor(b, 0.05)
    // no capacitor at the load: the 1.17 A in the 2 µH of wire must stop at Q1's turn-off rate
    within(s.values[RAIL_PK], 12 + 2 * vgsAt(on.values[I_SOL]), 0.5)
    expect(s.values[RAIL_PK]).toBeLessThan(V_CLAMP / 2) // limited by the source bounce, not the avalanche
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('daisy chain without decoupling: the far ground bounces about 2 V below the Uno’s; the A0 RC filter keeps it off the pin', async () => {
    const b = await running()
    b.setTweak('behavior:topo.mode', 1)
    b.dispatch('break:no-decoupling')
    const on = await loadOn(b)
    await runUntil(b, (s) => pin9(s) === 0)
    let s = await runFor(b, 0.05)
    // the shared ground wire's L·di/dt is the V_GS that Q1 holds while the current falls
    within(s.values[BOUNCE_PK], -vgsAt(on.values[I_SOL]), 0.25)
    // 1 kΩ + 100 nF (τ = 100 µs) against a spike under a microsecond: A0 stays at its DC level
    expect(s.values[A0_PK]).toBeGreaterThan(0.7)
    expect(s.values[A0_PK]).toBeLessThan(0.9)
    // with the filter out, the pin is driven below ground, past the ATmega328P's −0.5 V abs. max
    b.setTweak('R_F.value', 0.01)
    await loadOn(b)
    await runUntil(b, (s) => pin9(s) === 0)
    s = await runFor(b, 0.05)
    expect(s.values[A0_PK]).toBeLessThan(-1)
    b.dispose()
  })

  it('F4 no flyback: the solenoid\u2019s 20 mH drives the drain into Q1\u2019s ≈ 60 V avalanche; with D1 it stays at 12.7 V', async () => {
    const b = await running()
    await loadOn(b)
    await runUntil(b, (s) => pin9(s) === 0)
    let s = await runFor(b, 0.05)
    expect(s.values[DRAIN_PK]).toBeLessThan(13.2)
    b.dispatch('break:no-flyback')
    await loadOn(b)
    await runUntil(b, (s) => pin9(s) === 0)
    s = await runFor(b, 0.05)
    within(s.values[DRAIN_PK], V_CLAMP, 3)
    // IRLZ44N is avalanche-rated (no instantaneous maxV): ½·L·I² ≈ 14 mJ per kick
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })
})

// ── guide: shape and end to end ──

function rig() {
  const L = lesson
  const b: Bench = createBench(L, { speed: L.sim?.speed })
  const g = createGuide(L)
  const ui: Required<GuideUi> = { now: 0, tweaks: b.tweakValues(), selectedPart: null, instrumentsOpen: false }
  let pending: GuideEvent[] = []
  const evaluate = () => {
    ui.tweaks = b.tweakValues()
    const s = g.evaluate(b.snapshot(), pending, ui)
    pending = []
    return s
  }
  return {
    b,
    g,
    act(a: BenchAction) {
      const before = b.snapshot()
      b.dispatch(a)
      pending.push(...benchActionEvents(a, before, b.snapshot()))
    },
    upload() {
      const before = b.snapshot()
      b.upload()
      pending.push(...benchActionEvents('upload', before, b.snapshot()))
    },
    tweak(label: string, v: number) {
      const t = L.tweaks!.find((x) => x.label === label)!
      b.setTweak(`${t.elementId}.${t.key}`, v)
    },
    inspect(part: string) {
      ui.selectedPart = part
      pending.push({ type: 'inspect', part })
    },
    instruments() {
      ui.instrumentsOpen = true
      pending.push({ type: 'instruments' })
    },
    event(e: GuideEvent) {
      pending.push(e)
    },
    async finish(id: string, sec = 3) {
      expect(g.state().step?.id).toBe(id)
      const start = g.state().current
      for (let i = 0; i < Math.round(sec / FRAME); i++) {
        if (evaluate().current !== start) return
        await b.frame(FRAME)
        ui.now += FRAME * 1000
      }
      throw new Error(`step "${id}" did not complete in ${sec} s; values ${b.snapshot().values.join(', ')}`)
    },
    done() {
      expect(g.state()).toMatchObject({ complete: true, done: L.guide!.map((s) => s.id) })
      b.dispose()
    },
  }
}

describe('power-grounding-emc guide: shape', () => {
  it('validates, 5-9 steps, at most one manual, ends on the quiz, has break and repair steps', () => {
    expect(validateLesson(lesson)).toEqual([])
    const n = lesson.guide!.length
    expect(n).toBeGreaterThanOrEqual(5)
    expect(n).toBeLessThanOrEqual(9)
    expect(lesson.guide!.at(-1)!.check).toEqual({ kind: 'quiz' })
    expect(JSON.stringify(lesson.guide).split('"manual"').length - 1).toBeLessThanOrEqual(1)
    expect(lesson.guide!.some((s) => JSON.stringify(s.check).includes('"break"'))).toBe(true)
    expect(lesson.guide!.some((s) => JSON.stringify(s.check).includes('"repair"'))).toBe(true)
    expect(lesson.guide!.some((s) => JSON.stringify(s.check).includes('"instruments"'))).toBe(true)
    expect(new Set(lesson.guide!.map((s) => s.id)).size).toBe(n)
  })
})

describe('power-grounding-emc guide: end to end', () => {
  it('walks every step on a real bench', async () => {
    const r = rig()
    r.act('power')
    r.act('power:V_PSU')
    await r.finish('power-on')
    r.upload()
    await r.finish('star-reads-true', 6)
    r.tweak('Load return', 1)
    await r.finish('daisy-chain', 6)
    r.instruments()
    await r.finish('scope-bounce', 4)
    r.act('break:no-decoupling')
    await r.finish('no-decoupling', 5)
    r.act('repair')
    await r.finish('repair')
    r.act('break:no-flyback')
    await r.finish('no-flyback', 5)
    r.tweak('Load return', 0)
    r.act('repair')
    await r.finish('fix-it', 6)
    r.event({ type: 'quiz' })
    await r.finish('quiz')
    r.done()
  })
})
