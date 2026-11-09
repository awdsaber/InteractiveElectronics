import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import { getLesson } from '../index'

const lesson = getLesson('logic-gates')!
const FRAME = 1 / 60

// readout indices
const [A, B, AND, OR, NAND, XOR, NOT, I_LED, X, RAW, SCH, RAW_EDGES, SCH_EDGES, NOT_EDGES] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

// 74HC at 4.5 V (TI SN74HC08 / SN74HC14, SCLS081 / SCLS085): VIH min 3.15, VIL max 1.35; the 5 V
// board scales the same 0.7 / 0.3 · VCC ratios. The simulated plain gate switches at VCC / 2.
const VT_PLAIN = 2.5
// 74HC14 typical thresholds interpolated to 5 V from the 4.5 V (2.5 / 1.6) and 6 V (3.3 / 2.0) rows
const VT_PLUS = 2.75
const VT_MINUS = 1.75

function build(opts: { failure?: string; tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(lesson, { tweaks: opts.tweaks, speed: 1 })
  b.dispatch('place-all')
  b.dispatch('power')
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  return b
}

async function run(b: Bench, seconds: number, each?: (s: BenchSnapshot) => void): Promise<BenchSnapshot> {
  const t1 = b.t + seconds
  let s = b.snapshot()
  while (b.t < t1 - 1e-9) {
    await b.frame(FRAME)
    s = b.snapshot()
    each?.(s)
  }
  return s
}

const bit = (v: number) => (v > 2.5 ? 1 : 0)
/** a still analog input: sweep amplitude 0 holds x at the 2.5 V offset, so the logic table tests use buttons only */
const STILL = { 'V_GEN.wave.freq': 0.2 }

describe('T3 logic-gates lesson', () => {
  it('validates; the part inspector has datasheet facts; the scope opens on the analog input', () => {
    expect(validateLesson(lesson)).toEqual([])
    expect(lesson.instruments?.open).toBe(true)
    const facts = lesson.board.parts.filter((p) => p.kind === 'ic-dip').flatMap((p) => p.facts ?? []).join(' ')
    expect(facts).toMatch(/3\.15 V/)
    expect(facts).toMatch(/1\.35 V/)
    expect(facts).toMatch(/±25 mA/)
    expect(lesson.powerElementId).toBe('V_SUP')
  })

  it('full truth tables: AND, OR, NAND, XOR for all four button combinations, NOT of A', async () => {
    const want = (a: number, b: number) => ({
      and: a & b,
      or: a | b,
      nand: 1 - (a & b),
      xor: a ^ b,
      not: 1 - a,
    })
    for (const a of [0, 1])
      for (const bb of [0, 1]) {
        const b = build({ tweaks: { ...STILL, 'SW_A.closed': a, 'SW_B.closed': bb } })
        const s = await run(b, 0.3)
        const w = want(a, bb)
        expect(bit(s.values[A]), `A (a=${a}, b=${bb})`).toBe(a)
        expect(bit(s.values[B]), `B (a=${a}, b=${bb})`).toBe(bb)
        expect(bit(s.values[AND]), `AND ${a}${bb}`).toBe(w.and)
        expect(bit(s.values[OR]), `OR ${a}${bb}`).toBe(w.or)
        expect(bit(s.values[NAND]), `NAND ${a}${bb}`).toBe(w.nand)
        expect(bit(s.values[XOR]), `XOR ${a}${bb}`).toBe(w.xor)
        expect(bit(s.values[NOT]), `NOT ${a}`).toBe(w.not)
      }
  })

  it('levels: released input sits at 0 V on its 10 kΩ, pressed at 5 V; a high output drives its LED with (5 − 1.8)/1 kΩ ≈ 3.3 mA', async () => {
    const b = build({ tweaks: STILL })
    const s = await run(b, 0.3)
    expect(s.values[A]).toBeLessThan(0.01)
    expect(s.values[NAND]).toBeGreaterThan(4.85) // 5 V minus 25 Ω × 3.3 mA
    expect(s.values[I_LED]).toBeGreaterThan(0.0027)
    expect(s.values[I_LED]).toBeLessThan(0.0035)
    expect(s.values[AND]).toBeLessThan(0.01)
    const b2 = build({ tweaks: { ...STILL, 'SW_A.closed': 1 } })
    const s2 = await run(b2, 0.3)
    expect(s2.values[A]).toBeGreaterThan(4.99)
  })

  it('the plain 74HC04 inverter trips at about VCC/2 on a slow ramp; the 74HC14 trips at 2.75 V up and 1.75 V down (hysteresis 1.0 V)', async () => {
    const b = build({ tweaks: { 'V_GEN.wave.freq': 0.2 } }) // 5 s period, 2 V/s
    const rawFalls: number[] = []
    const rawRises: number[] = []
    const schFalls: number[] = []
    const schRises: number[] = []
    let prev = b.snapshot().values
    await run(b, 5, (s) => {
      const v = s.values
      if (prev[RAW] > 2.5 && v[RAW] <= 2.5) rawFalls.push(v[X])
      if (prev[RAW] < 2.5 && v[RAW] >= 2.5) rawRises.push(v[X])
      if (prev[SCH] > 2.5 && v[SCH] <= 2.5) schFalls.push(v[X])
      if (prev[SCH] < 2.5 && v[SCH] >= 2.5) schRises.push(v[X])
      prev = v
    })
    expect(rawFalls).toHaveLength(1)
    expect(rawRises).toHaveLength(1)
    expect(Math.abs(rawFalls[0] - VT_PLAIN)).toBeLessThan(0.1)
    expect(Math.abs(rawRises[0] - VT_PLAIN)).toBeLessThan(0.1)
    expect(schFalls).toHaveLength(1)
    expect(schRises).toHaveLength(1)
    expect(Math.abs(schFalls[0] - VT_PLUS)).toBeLessThan(0.1)
    expect(Math.abs(schRises[0] - VT_MINUS)).toBeLessThan(0.1)
    expect(schFalls[0] - schRises[0]).toBeGreaterThan(0.9)
    expect(schFalls[0] - schRises[0]).toBeLessThan(1.1)
  })

  it('noise: 0.4 V of ripple makes the plain inverter chatter (many edges) while the Schmitt gives exactly one edge per crossing', async () => {
    const quiet = build({ tweaks: { 'V_GEN.wave.freq': 0.5, 'V_NOISE.wave.amp': 0 } })
    const q = await run(quiet, 2)
    expect(q.values[RAW_EDGES]).toBeLessThanOrEqual(3)
    expect(q.values[SCH_EDGES]).toBeLessThanOrEqual(3)

    const noisy = build({ tweaks: { 'V_GEN.wave.freq': 0.5, 'V_NOISE.wave.amp': 0.4 } })
    const n = await run(noisy, 2)
    expect(n.values[RAW_EDGES]).toBeGreaterThanOrEqual(8)
    expect(n.values[SCH_EDGES]).toBeLessThanOrEqual(3)
  })

  it('F1 floating input: with the pull-down gone and the button up, hum rides in and the NOT output flips about 100 times a second', async () => {
    const ok = build({ tweaks: STILL })
    const s0 = await run(ok, 1)
    expect(s0.values[NOT_EDGES]).toBe(0)

    const b = build({ failure: 'floating-input', tweaks: STILL })
    const s = await run(b, 1)
    expect(s.values[NOT_EDGES]).toBeGreaterThanOrEqual(40)
  })

  it('F2 shorted output: a NAND output into ground pushes ~200 mA, far past ±25 mA, and the 74HC00 fails', async () => {
    const b = build({ failure: 'output-short', tweaks: STILL })
    let s = await run(b, 0.2)
    for (let k = 0; k < 120 && s.assembly.burns.length === 0; k++) s = await run(b, 0.05)
    const burn = s.assembly.burns.find((x) => x.elementId === 'U_NAND')
    expect(burn).toBeDefined()
    expect(burn!.reason).toBe('overcurrent')
    expect(s.status).toBe('FAULT')
  })

  it('F3 noisy wires: the failure adds 0.4 V of noise, and only the plain gate chatters', async () => {
    const b = build({ failure: 'noisy-edge', tweaks: { 'V_GEN.wave.freq': 0.5 } })
    const s = await run(b, 2)
    expect(s.values[RAW_EDGES]).toBeGreaterThanOrEqual(8)
    expect(s.values[SCH_EDGES]).toBeLessThanOrEqual(3)
  })
})
