import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { lesson as def } from './transistor-switch'

const L = def as Lesson
const FRAME = 1 / 60
const [I_M, I_B, V_CE, RPM, P_Q1] = [0, 1, 2, 3, 4]

async function runUntil(b: Bench, pred: (s: BenchSnapshot) => boolean, maxSim = 6): Promise<BenchSnapshot> {
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

/** both supplies on, sketch running, motor up to speed at the end of the first ON phase */
async function running(): Promise<Bench> {
  const b = createBench(L)
  b.dispatch('power')
  b.dispatch('power:V_PACK')
  b.upload()
  await runUntil(b, high)
  await runFor(b, 1.5)
  return b
}

describe('transistor-switch lesson', () => {
  it('validates', () => {
    expect(validateLesson(L)).toEqual([])
  })

  it('strip → place → power both supplies → upload: the curriculum numbers with pin 9 HIGH', async () => {
    const b = createBench(L)
    b.dispatch('strip')
    expect(b.snapshot().status).toBe('BARE PCB')
    b.dispatch('place-all')
    expect(b.snapshot().status).toBe('READY')
    b.dispatch('power') // USB: the Uno only
    expect(b.snapshot().assembly.powered).toEqual({ V_USB: true, V_PACK: false })
    b.upload()
    expect(b.snapshot().status).toBe('RUNNING')
    await runUntil(b, high)
    let s = await runFor(b, 0.5)
    // no pack yet: the base current flows, the motor has no supply
    within(s.values[I_B], 0.0086)
    expect(Math.abs(s.values[I_M])).toBeLessThan(1e-3)

    b.dispatch('power:V_PACK')
    s = await runFor(b, 1.2)
    expect(high(s)).toBe(true)
    expect(s.serial).toContain('motor ON')
    within(s.values[I_B], 0.0086) // (5 − 0.75)/495
    within(s.values[I_M], 0.18) // free-running motor current
    within(s.values[RPM], 9500)
    expect(s.values[V_CE]).toBeGreaterThan(0.08) // V_CE(sat) ≈ 0.1–0.2 V
    expect(s.values[V_CE]).toBeLessThan(0.25)
    within(s.values[P_Q1], 0.033, 0.25) // ≈ 30–36 mW
    expect(s.values[I_M] / s.values[I_B]).toBeLessThan(30) // forced β ≈ 21: hard saturation
    expect(s.statusLine.text).toMatch(/pin 9 HIGH, the transistor saturates/)
    expect(s.statusLine.tone).toBe('ok')

    // pin LOW: Q1 off, D1 catches the winding current, the motor coasts down
    s = await runUntil(b, low)
    s = await runFor(b, 0.3)
    expect(Math.abs(s.values[I_M])).toBeLessThan(1e-3)
    expect(s.values[V_CE]).toBeLessThan(7) // clamped by D1 at ≤ 6 V + 0.7 V
    expect(s.values[RPM]).toBeLessThan(9000)
    expect(s.serial.at(-1)).toBe('motor OFF')
    expect(s.assembly.burns).toEqual([])
    expect(s.statusLine.text).toMatch(/pin 9 LOW/)

    // several more cycles with the diode fitted: no failures
    await runFor(b, 8)
    expect(b.snapshot().assembly.burns).toEqual([])
    b.dispose()
  })

  it('R_B = 47 kΩ: β·I_b ≈ 14 mA, Q1 drops out of saturation, the motor crawls and Q1 heats', async () => {
    const b = await running()
    b.setTweak('R_B.value', 47000)
    await runUntil(b, low)
    await runUntil(b, high)
    const s = await runFor(b, 1.5)
    within(s.values[I_B], 0.00009, 0.2)
    expect(s.values[I_M]).toBeLessThan(0.02)
    expect(s.values[V_CE]).toBeGreaterThan(1)
    expect(s.values[RPM]).toBeLessThan(3000)
    expect(s.values[P_Q1]).toBeGreaterThan(0.05) // ≈ 80 mW: half-on, heating
    expect(s.statusLine.text).toMatch(/^WARNING: Q1 dissipates .* not saturated/)
    expect(s.statusLine.text).not.toMatch(/saturates/)
    expect(s.statusLine.tone).toBe('warn')
    b.dispose()
  })

  it('a heavier shaft load raises the motor current', async () => {
    const b = await running()
    const free = b.snapshot().values[I_M]
    b.setTweak('M1.load', 0.002)
    const s = await runFor(b, 0.4)
    expect(high(s)).toBe(true)
    expect(s.values[I_M]).toBeGreaterThan(free + 0.3) // + T/kt = 0.4 A
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('F1 no flyback diode: the first turn-off avalanches Q1 far above 40 V, it fails short and the motor runs on', async () => {
    const b = await running()
    b.dispatch('break:no-flyback')
    expect(b.snapshot().partVisible.d1).toBe(false)
    await runFor(b, 0.2)
    expect(b.snapshot().assembly.burns).toEqual([]) // still HIGH: nothing happens yet
    // the pin goes LOW at the end of the 2 s ON phase; the kick burns Q1 in that frame's switching step
    const s = await runUntil(b, (x) => x.assembly.burns.length > 0, 1)
    expect(low(s)).toBe(true)
    expect(s.assembly.burns).toHaveLength(1)
    const burn = s.assembly.burns.find((x) => x.elementId === 'Q1')
    expect(burn).toMatchObject({ reason: 'overvoltage', limit: 40 })
    expect(burn!.value).toBeGreaterThan(55) // the 60 V avalanche clamp
    expect(s.status).toBe('FAULT')
    expect(s.partBurnt.q1).toBe(true)
    // the sketch keeps the pin LOW, yet the shorted switch keeps the motor running
    const later = await runFor(b, 1)
    expect(low(later)).toBe(true)
    within(later.values[I_M], 0.18)
    expect(later.values[RPM]).toBeGreaterThan(8000)
    // Repair all brings the diode and a fresh Q1 back
    b.dispatch('repair')
    await runUntil(b, high)
    await runUntil(b, low)
    expect(b.snapshot().assembly.burns).toEqual([])
    b.dispose()
  })

  it('F2 no base resistor: ≈ 170 mA from pin 9, which dies within 300 ms', async () => {
    const b = await running()
    b.dispatch('break:no-base-resistor')
    expect(b.snapshot().partVisible['j-rb']).toBe(true)
    await b.frame(FRAME)
    await b.frame(FRAME)
    within(Math.abs(b.snapshot().current.PIN9), 0.17)
    const tBreak = b.t
    const s = await runUntil(b, (x) => x.assembly.burns.some((y) => y.elementId === 'PIN9'), 1)
    expect(b.t - tBreak).toBeLessThan(0.4)
    expect(s.assembly.burns.find((y) => y.elementId === 'PIN9')!.reason).toBe('pin-overcurrent')
    b.dispose()
  })

  it('F3 stalled motor: speed falls to 0, current heads past 1 A and Q1 burns short', async () => {
    const b = await running()
    b.dispatch('break:stall')
    const s0 = await runFor(b, 0.15)
    expect(high(s0)).toBe(true)
    expect(s0.values[RPM]).toBeLessThan(500)
    expect(s0.values[I_M]).toBeGreaterThan(1)
    expect(s0.extra['Q1.ic']).toBeGreaterThan(0.6)
    const s = await runUntil(b, (x) => x.assembly.burns.some((y) => y.elementId === 'Q1'), 1)
    expect(['overcurrent', 'overpower']).toContain(s.assembly.burns.find((y) => y.elementId === 'Q1')!.reason)
    const later = await runFor(b, 0.3)
    within(later.values[I_M], 6 / 4.6) // shorted switch: winding + pack only
    expect(later.values[RPM]).toBeLessThan(50)
    b.dispose()
  })

  it('F4 no common ground: pin HIGH and base current flowing, but no motor current', async () => {
    const b = await running()
    b.dispatch('break:no-common-ground')
    expect(b.snapshot().partVisible.wg).toBe(false)
    const s = await runFor(b, 0.2)
    expect(high(s)).toBe(true)
    within(s.values[I_B], 0.0086)
    expect(Math.abs(s.values[I_M])).toBeLessThan(1e-3)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('F5 motor straight on pin 9: well over 40 mA, the pin dies', async () => {
    const b = await running()
    b.dispatch('break:motor-on-pin')
    expect(b.snapshot().partVisible['w-motor-pin']).toBe(true)
    // the spinning motor arrives with its back-EMF, slows to the pin's ≈ 90 mA and kills it
    let peak = 0
    const s = await runUntil(b, (x) => {
      peak = Math.max(peak, Math.abs(x.current.PIN9 ?? 0))
      return x.assembly.burns.some((y) => y.elementId === 'PIN9')
    }, 2)
    expect(peak).toBeGreaterThan(0.08)
    expect(s.assembly.burns.find((y) => y.elementId === 'PIN9')!.reason).toBe('pin-overcurrent')
    expect(s.partBurnt.uno).toBe(false) // a dead pin doesn't char the board
    b.dispose()
  })
})

describe('transistor-switch scope (lesson.instruments)', () => {
  const V_PEAK = 5
  const maxFrom = (b: Bench, ch: number, from: number) => {
    const r = b.scope
    let m = -Infinity
    for (let k = r.lowerBound(from); k < r.count; k++) m = Math.max(m, r.value(ch, k))
    return m
  }

  it('probes V_CE and the motor current by default', () => {
    const b = createBench(L)
    expect(b.scope.channels).toBe(2)
    expect(L.instruments?.scope?.trigger).toMatchObject({ level: 3, slope: 'rising', mode: 'normal' })
    b.dispose()
  })

  it('with D1 the turn-off edge is clamped near 6.7 V', async () => {
    const b = await running()
    const t0 = b.t
    await runUntil(b, low)
    await runFor(b, 0.05)
    const m = maxFrom(b, 0, t0)
    expect(m).toBeGreaterThan(6.2)
    expect(m).toBeLessThan(7.5)
    b.dispose()
  })

  it('F1 no flyback diode: the edge substeps put the ≈ 60 V avalanche spike in the scope ring', async () => {
    const b = await running()
    b.dispatch('break:no-flyback')
    const t0 = b.t
    const s = await runUntil(b, (x) => x.assembly.burns.length > 0, 3)
    const r = b.scope
    let kMax = -1
    for (let k = r.lowerBound(t0); k < r.count; k++) if (kMax < 0 || r.value(0, k) > r.value(0, kMax)) kMax = k
    expect(r.value(0, kMax)).toBeGreaterThan(55)
    // a µs event: the spike sample sits inside a 1 ms step, off the step grid
    const tk = r.time(kMax)
    expect(Math.abs(tk * 1000 - Math.round(tk * 1000))).toBeGreaterThan(1e-4)
    expect(r.time(kMax) - r.time(kMax - 1)).toBeLessThan(1e-4)
    // the frame-rate readout never saw it; the peak-hold readout did
    expect(s.values[V_CE]).toBeLessThan(40)
    expect(s.values[V_PEAK]).toBeGreaterThan(55)
    expect(s.readouts[V_PEAK].peak).toBe(true)
    b.dispose()
  })
})
