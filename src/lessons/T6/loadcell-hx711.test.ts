import { describe, expect, it } from 'vitest'
import { CODE_MIN, codeFor, countsPerGram } from '../../engine/behaviors/hx711'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'
import { NOMINAL_FACTOR } from './loadcell-hx711'

const FRAME = 1 / 60
const lesson = getLesson('loadcell-hx711') as Lesson

// readout indices
const TRUE = 0
const MEAS = 1
const BRIDGE = 2
const EXC = 3
const RAW = 4
const PER_G = 5
const DR = 6

const MV_PER_V = 0.98
const ZERO = 0.05e-3
const AVDD = 4.3
/** the solved-bridge prediction: V(E+) × (rated output × m / capacity + zero balance) */
const bridgeV = (m: number, exc = AVDD) => exc * ((MV_PER_V * 1e-3 * m) / 1000 + ZERO)

function build(code?: string): Bench {
  const b = createBench(lesson)
  b.dispatch('strip')
  b.dispatch('pick-place')
  b.dispatch('place-all')
  b.dispatch('solder')
  b.dispatch('power')
  b.upload(code)
  return b
}
async function run(b: Bench, sec: number, each?: (s: BenchSnapshot) => void): Promise<BenchSnapshot> {
  const end = b.t + sec
  while (b.t < end - 1e-9) {
    await b.frame(FRAME)
    each?.(b.snapshot())
  }
  return b.snapshot()
}
const mass = (b: Bench, g: number) => b.setTweak('behavior:hx711.massG', g)
const calibrated = (f: number) => lesson.sketch!.code.replace(`float calFactor = ${NOMINAL_FACTOR.toFixed(1)};`, `float calFactor = ${f};`)
function stats(xs: number[]) {
  const m = xs.reduce((a, c) => a + c, 0) / xs.length
  return { mean: m, sd: Math.sqrt(xs.reduce((a, c) => a + (c - m) ** 2, 0) / xs.length) }
}

describe('T6 loadcell-hx711 lesson', () => {
  it('validates, builds from a bare PCB, tares: E+ 4.3 V, zero balance 0.21 mV, MEASURED 0 g', async () => {
    expect(validateLesson(lesson)).toEqual([])
    expect(lesson.sketch!.code).toContain(`float calFactor = ${NOMINAL_FACTOR.toFixed(1)};`)
    const b = build()
    const s = await run(b, 2.5)
    expect(s.sketchError).toBeNull()
    expect(s.status).toBe('RUNNING')
    expect(s.serial).toContain('Tared. Place masses now.')
    expect(s.values[EXC]).toBeCloseTo(4.3, 3)
    expect(s.values[BRIDGE]).toBeCloseTo(bridgeV(0), 7) // 0.215 mV
    expect(Math.abs(s.values[MEAS])).toBeLessThan(0.2)
    expect(Math.abs(s.values[RAW] - codeFor(ZERO, 128))).toBeLessThan(150) // ≈ 107 374 + noise
    b.dispose()
  })

  it('the solved bridge follows the mass: 4.3 V × ΔR/R, ΔR ≈ 1 Ω per gauge at 1 kg', async () => {
    const b = build()
    await run(b, 2.2)
    for (const m of [100, 200, 500, 1000]) {
      mass(b, m)
      const s = await run(b, 0.2)
      expect(s.values[TRUE]).toBe(m)
      expect(Math.abs(s.values[BRIDGE] - bridgeV(m))).toBeLessThan(bridgeV(m) * 1e-4)
      expect(s.values[DR]).toBeCloseTo((MV_PER_V * m) / 1000, 3)
    }
    // full load: 4.3 × (0.98 + 0.05) mV/V ≈ 4.43 mV, well inside ±16.8 mV
    expect(b.snapshot().values[BRIDGE]).toBeCloseTo(4.429e-3, 5)
    b.dispose()
  })

  it('HX711 counts: 2 104 per gram for this 0.98 mV/V cell; the nominal 2 147 reads 2 % low', async () => {
    expect(countsPerGram(MV_PER_V, 1000, 128, 1)).toBeCloseTo(2104.5, 1)
    expect(countsPerGram(1.0, 1000, 128, 1)).toBeCloseTo(NOMINAL_FACTOR, 0)
    const b = build()
    await run(b, 2.2)
    mass(b, 500)
    const s = await run(b, 1.5)
    const ratio = s.values[BRIDGE] / s.values[EXC]
    expect(Math.abs(s.values[RAW] - codeFor(ratio, 128))).toBeLessThan(150) // 25 counts rms noise
    expect(s.values[MEAS]).toBeCloseTo((500 * 2104.5) / NOMINAL_FACTOR, 0) // ≈ 490 g
    expect(Math.abs(s.values[PER_G] - 2104.5)).toBeLessThan(1)
    b.dispose()
  })

  it('calibrated with the measured factor: 500 g and 1 kg read true; 50 nV noise is ~0.01 g', async () => {
    const b = build(calibrated(2104.5))
    await run(b, 2.2)
    mass(b, 500)
    await run(b, 1.2)
    const xs: number[] = []
    await run(b, 5, (s) => xs.push(s.values[MEAS]))
    const st = stats(xs)
    expect(Math.abs(st.mean - 500)).toBeLessThan(0.3)
    expect(st.sd).toBeLessThan(0.1)
    mass(b, 1000)
    const s = await run(b, 1.5)
    expect(Math.abs(s.values[MEAS] - 1000)).toBeLessThan(0.5)
    b.dispose()
  })

  it('80 SPS: same calibration, more noise (90 nV), still a few hundredths of a gram', async () => {
    const b = build(calibrated(2104.5))
    b.setTweak('behavior:hx711.rate', 80)
    await run(b, 2.2)
    mass(b, 200)
    await run(b, 1.2)
    const s = await run(b, 0.6)
    expect(s.published['hx711.sps']).toBe(80)
    expect(Math.abs(s.values[MEAS] - 200)).toBeLessThan(0.3)
    b.dispose()
  })

  it('ratiometric: on AVDD a USB sag changes nothing; excited from 5 V it reads ~16 % high and follows the rail', async () => {
    const b = build(calibrated(2104.5))
    await run(b, 2.2)
    mass(b, 500)
    const a = (await run(b, 1.5)).values[MEAS]
    b.setTweak('v_usb.value', 4.6)
    const a2 = (await run(b, 1.5)).values[MEAS]
    expect(Math.abs(a2 - a)).toBeLessThan(0.2)
    b.setTweak('v_usb.value', 5.0)
    await run(b, 1)

    b.dispatch('break:excite-5v')
    const xs: number[] = []
    await run(b, 6, (s) => xs.push(s.values[MEAS]))
    const s = b.snapshot()
    expect(s.values[EXC]).toBeGreaterThan(4.85)
    const st = stats(xs.slice(60))
    // 500 g × E+/AVDD plus the zero balance scaled the same way: ≈ 580..590 g
    expect(st.mean).toBeGreaterThan(565)
    expect(st.mean).toBeLessThan(600)
    expect(st.sd).toBeGreaterThan(0.8) // the 30 mV rms rail wander shows up as grams
    b.setTweak('v_usb.value', 4.6)
    const ys: number[] = []
    await run(b, 4, (q) => ys.push(q.values[MEAS]))
    const drop = (st.mean - stats(ys.slice(90)).mean) / st.mean
    expect(drop).toBeGreaterThan(0.06) // ≈ 8 %: 0.4 V of a 4.97 V excitation
    expect(drop).toBeLessThan(0.11)
    b.dispose()
  })

  it('overload: a 1.4 kg push leaves a permanent +40 g on the empty pan until Repair', async () => {
    const b = build(calibrated(2104.5))
    await run(b, 2.2)
    b.dispatch('break:overload')
    const push = await run(b, 0.9)
    expect(push.values[MEAS]).toBeGreaterThan(1000)
    const s = await run(b, 2)
    expect(s.published['hx711.set_g']).toBeCloseTo(40, 0)
    expect(s.values[MEAS]).toBeGreaterThan(36)
    expect(s.values[MEAS]).toBeLessThan(44)
    expect(s.values[TRUE]).toBe(0)
    b.dispatch('repair')
    const r = await run(b, 1.5)
    expect(r.published['hx711.set_g']).toBe(0)
    expect(Math.abs(r.values[MEAS])).toBeLessThan(0.5)
    b.dispose()
  })

  it('broken A+ wire: the open input pins the code at 0x800000 and ignores the load', async () => {
    const b = build(calibrated(2104.5))
    await run(b, 2.2)
    b.dispatch('break:broken-wire')
    mass(b, 500)
    const s = await run(b, 1.5)
    expect(s.values[RAW]).toBe(CODE_MIN)
    expect(s.values[MEAS]).toBeLessThan(-3900)
    expect(s.statusLine.text).toMatch(/0x800000/)
    mass(b, 0)
    expect((await run(b, 1)).values[RAW]).toBe(CODE_MIN)
    b.dispose()
  })

  it('A+ and A− swapped: the sign flips, 500 g reads about −500 g', async () => {
    const b = build(calibrated(2104.5))
    await run(b, 2.2)
    b.dispatch('break:swap-signal')
    mass(b, 500)
    const s = await run(b, 1.5)
    // the tared zero balance flips too: −(500 + 2 × 51) g
    expect(s.values[MEAS]).toBeLessThan(-550)
    expect(s.values[MEAS]).toBeGreaterThan(-650)
    b.dispose()
  })

  it('creep: the effective load rises slowly under a constant mass', async () => {
    const b = build()
    await run(b, 2.2)
    mass(b, 1000)
    await run(b, 1)
    const c1 = b.snapshot().published['hx711.creep_g']
    await run(b, 4)
    const c2 = b.snapshot().published['hx711.creep_g']
    expect(c1).toBeGreaterThan(0)
    expect(c2).toBeGreaterThan(c1)
    expect(c2).toBeLessThan(0.05) // 0.05 % in 30 min: about 4 mg after 5 s
    b.dispose()
  })
})
