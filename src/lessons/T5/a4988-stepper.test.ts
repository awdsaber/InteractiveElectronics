import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { lesson as def } from './a4988-stepper'

const lesson: Lesson = { ...def, fig: def.fig ?? 7 }
const FRAME = 1 / 60

// readout indices
const VREF = 0
const ITRIP = 1
const COIL_A = 2
const COIL_B = 3
const RPM = 4
const SKIPPED = 5
const TJ = 6
const COIL_T = 7
const OCP = 8

/** within ±15 % of the curriculum's number */
const near = (v: number, want: number, tol = 0.15) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * tol)

function build(opts: { code?: string | null } = {}): Bench {
  const b = createBench(lesson)
  b.dispatch('pick-place')
  b.dispatch('place-all')
  b.dispatch('solder')
  b.dispatch('power')
  if (opts.code !== null) b.upload(opts.code)
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

const pub = (s: BenchSnapshot, k: string) => s.published[`a4988.${k}`] ?? 0

describe('T5 a4988-stepper lesson', () => {
  it('validates and reaches RUNNING; the sketch prints its banner', async () => {
    expect(validateLesson(lesson)).toEqual([])
    const b = build()
    const s = await run(b, 0.5)
    expect(s.sketchError).toBeNull()
    expect(s.status).toBe('RUNNING')
    expect(s.serial.join('\n')).toContain('A4988 ready: 1/16 step, 3200 steps per rev')
    b.dispose()
  })

  it('Vref 0.544 V on a 0.068 Ω board sets I_trip = 1.0 A; holding in full step each coil carries 0.707 A', async () => {
    const b = build({ code: null })
    const s = await run(b, 0.3)
    near(s.values[VREF], 0.544, 0.02)
    near(s.values[ITRIP], 1.0, 0.03)
    near(s.values[COIL_A], 0.707, 0.05)
    near(s.values[COIL_B], 0.707, 0.05)
    expect(pub(s, 'microstep')).toBe(1) // MS pins float: the pull-downs give full step
    b.dispose()
  })

  it('a clone board (R100) needs 0.8 V for the same 1.0 A', async () => {
    const b = build({ code: null })
    b.setTweak('behavior:a4988.rs', 0.1)
    b.setTweak('pot.pos', 0.16)
    const s = await run(b, 0.2)
    near(s.values[VREF], 0.8, 0.02)
    near(s.values[ITRIP], 1.0, 0.03)
    b.dispose()
  })

  it('the sketch: 1/16, one CW turn ramped to 120 rpm, one CCW turn to 60 rpm, nothing skipped', async () => {
    const b = build()
    let maxRpm = 0
    let minRpm = 0
    let maxDeg = 0
    let s = await run(b, 4.0, (x) => {
      maxRpm = Math.max(maxRpm, x.values[RPM])
      minRpm = Math.min(minRpm, x.values[RPM])
      maxDeg = Math.max(maxDeg, pub(x, 'shaft_deg'))
    })
    expect(pub(s, 'microstep')).toBe(16)
    near(maxRpm, 120, 0.1)
    near(-minRpm, 60, 0.15)
    near(maxDeg, 360, 0.02) // one full turn out
    expect(Math.abs(pub(s, 'shaft_deg'))).toBeLessThan(3) // and back
    expect(s.values[SKIPPED]).toBe(0)
    expect(pub(s, 'steps')).toBe(6400)
    // 1 A at 1/16: Tj stays far from shutdown
    expect(s.values[TJ]).toBeLessThan(80)
    s = await run(b, 2.5) // into "holding, then free": EN HIGH turns the coils off
    expect(Math.abs(s.values[COIL_A]) + Math.abs(s.values[COIL_B])).toBeLessThan(0.02)
    b.dispose()
  }, 120_000)

  it('F1 no current limit: Vref ≈ 4.95 V, I_trip ≈ 9.1 A; the genuine part latches its outputs off, the sketch\'s ENABLE toggle retries', async () => {
    const b = build()
    b.dispatch('break:no-current-limit')
    let s = await run(b, 0.3)
    near(s.values[VREF], 4.95, 0.02)
    near(s.values[ITRIP], 9.1, 0.03)
    expect(s.values[OCP]).toBe(1)
    expect(Math.abs(s.values[COIL_A]) + Math.abs(s.values[COIL_B])).toBeLessThan(0.01)
    expect(s.statusLine.text).toContain('0.44 ms')
    // the sketch's free phase (EN HIGH from ≈ 4.0 s) clears the latch; EN LOW again at ≈ 6 s trips it again
    let cleared = false
    s = await run(b, 7, (x) => {
      if (x.values[OCP] === 0) cleared = true
    })
    expect(cleared).toBe(true)
    expect(s.values[OCP]).toBe(1)
    expect(s.status).not.toBe('FAULT')
    expect(s.values[TJ]).toBeLessThan(40)
    b.dispose()
  }, 60_000)

  it('just under the latch, thermal shutdown is the guard: 1.6 A on a bare carrier trips it, a cooler driver does not', async () => {
    const hot = async (rth: number) => {
      const b = build({ code: null })
      b.setTweak('pot.pos', (1.6 * 8 * 0.068) / 5)
      b.setTweak('behavior:a4988.rthJA', rth)
      let tsd = false
      await run(b, 40, (x) => {
        if (pub(x, 'tsd_active') === 1) tsd = true
      })
      b.dispose()
      return tsd
    }
    expect(await hot(90)).toBe(true)
    expect(await hot(50)).toBe(false)
  }, 120_000)

  it('F1 on a clone without working protection, from a stiff bench supply: coils cap near V/R, thermal shutdown, then the driver dies', async () => {
    // (on the lesson's 2 A adapter VMOT just collapses to ≈ 2.2 V: 2 A into two 2.2 Ω coils)
    const stiff = lesson.circuit.elements.map((e) => (e.id === 'psu' && e.type === 'V' ? { ...e, iLimit: undefined } : e))
    const b = createBench({
      ...lesson,
      circuit: { elements: stiff },
      behaviors: [{ id: 'a4988', params: { ...(lesson.behaviors![0] as { params: Record<string, number | boolean> }).params, ocp: false } }],
    })
    b.dispatch('pick-place')
    b.dispatch('place-all')
    b.dispatch('solder')
    b.dispatch('power')
    b.dispatch('break:no-current-limit')
    let s = await run(b, 0.2)
    expect(s.values[COIL_A]).toBeGreaterThan(2)
    let tsd = false
    for (let i = 0; i < 40 && s.status !== 'FAULT'; i++) {
      s = await run(b, 0.5)
      if (pub(s, 'tsd_active') === 1) tsd = true
    }
    expect(tsd).toBe(true)
    expect(s.status).toBe('FAULT')
    expect(s.partBurnt.u1).toBe(true)
    expect(s.statusLine.text).toContain('through a 2 A part')
    b.dispose()
  }, 60_000)

  it('F2 unplugging the motor while powered burns the A4988', async () => {
    const b = build({ code: null })
    await run(b, 0.3)
    b.dispatch('break:unplug-motor')
    const s = await run(b, 0.3)
    expect(s.status).toBe('FAULT')
    expect(s.partBurnt.u1).toBe(true)
    expect(s.partVisible.w_1a).toBe(false)
    expect(s.statusLine.text).toMatch(/failed: coil A was cut open carrying 0\.7\d A, and its ½·L·I² = 0\.\d\d mJ went into the outputs/)
    // the removed winding has no temperature of its own: the readout stays at ambient, not 0 °C
    expect(s.values[COIL_T]).toBeCloseTo(25, 0)
    b.dispose()
  })

  it('F3 MS wires off: full step, the 1/16 pulse train asks 16× too much and steps are skipped', async () => {
    const b = build()
    b.dispatch('break:ms-wires-off')
    let maxDeg = 0
    const s = await run(b, 2.0, (x) => {
      maxDeg = Math.max(maxDeg, Math.abs(pub(x, 'shaft_deg')))
    })
    expect(pub(s, 'microstep')).toBe(1)
    expect(s.values[SKIPPED]).toBeGreaterThan(0)
    expect(s.statusLine.text).toContain('BROKEN')
    expect(maxDeg).toBeGreaterThan(0)
    b.dispose()
  }, 60_000)

  it('a load above the holding torque at 1 A (≈ 0.235 N·m) loses steps', async () => {
    const b = build()
    b.setTweak('behavior:a4988.loadNm', 0.3)
    const s = await run(b, 2.0)
    expect(s.values[SKIPPED]).toBeGreaterThan(0)
    expect(s.statusLine.text).toContain('steps lost')
    b.dispose()
  }, 60_000)
})
