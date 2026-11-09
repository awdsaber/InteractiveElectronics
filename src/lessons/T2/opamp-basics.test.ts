import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import { getLesson } from '../index'

const lesson = getLesson('opamp-basics')!
const FRAME = 1 / 60

// readout indices
const [VP, VN, VOUT, ERR, IDEAL, GAIN, HI, LO, CLIP, REF] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
// configuration and chip values (enum tweaks)
const MODE = 'behavior:cfg.mode'
const [INV, BUFFER, COMPARATOR] = [1, 2, 3] // 0 = non-inverting, the default
const CHIP = 'U1A.vPos'
const LM358_HI = 3.5 // V+ − 1.5 V (TI SLOS068: swing from the positive rail 1.5 V max, V+ = 5 V, RL ≥ 2 kΩ)
const MCP6002_HI = 4.975 // VDD − 25 mV (Microchip DS20001733: RL = 10 kΩ, VDD = 5.5 V)
const LOW = 0.005 // LM358 negative rail 5 mV typ at RL ≤ 10 kΩ

const within = (v: number, want: number, frac: number) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * frac)

function build(opts: { failure?: string; tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(lesson, { tweaks: opts.tweaks, speed: 1 })
  b.dispatch('place-all')
  b.dispatch('power')
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  return b
}

/** run for `seconds` of sim time; returns every frame's snapshot */
async function run(b: Bench, seconds: number): Promise<BenchSnapshot[]> {
  const out: BenchSnapshot[] = []
  const t1 = b.t + seconds
  while (b.t < t1 - 1e-9) {
    await b.frame(FRAME)
    out.push(b.snapshot())
  }
  return out
}

/** scope samples of channel `ch` over the last `span` seconds */
function scopeTrace(b: Bench, ch: number, span: number): number[] {
  const r = b.scope
  const v: number[] = []
  for (let k = r.lowerBound(b.t - span); k < r.count; k++) v.push(r.value(ch, k))
  return v
}

describe('T2 opamp-basics lesson', () => {
  it('validates; scope opens on IN (around the 2.5 V reference) and OUT; the op-amp part has datasheet facts', () => {
    expect(validateLesson(lesson)).toEqual([])
    expect(lesson.instruments?.open).toBe(true)
    expect(lesson.instruments?.scope?.channels[0].source).toEqual({ kind: 'voltage', node: 'sig', ref: 'ref' })
    expect(lesson.instruments?.scope?.channels[1].source).toEqual({ kind: 'voltage', node: 'out' })
    const u1 = lesson.board.parts.find((p) => p.id === 'u1')!
    expect(u1.facts?.length).toBeGreaterThanOrEqual(4)
    expect(u1.facts!.join(' ')).toMatch(/0\.7 MHz/)
  })

  it('golden rules, non-inverting: gain 1 + 100k/10k = 11, and V− tracks V+ to within microvolts', async () => {
    const b = build()
    await run(b, 0.5)
    const frames = await run(b, 0.4)
    const s = frames[frames.length - 1]
    expect(s.status).toBe('POWERED')
    expect(s.values[IDEAL]).toBeCloseTo(11, 9)
    within(s.values[GAIN], 11, 0.01)
    expect(s.values[CLIP]).toBeLessThan(1)
    within(s.values[REF], 2.5, 0.001)
    for (const f of frames) {
      expect(Math.abs(f.values[ERR])).toBeLessThan(1e-3) // 3.3 V / 1e5 ≈ 33 µV at most
      expect(Math.abs(f.values[VP] - f.values[VN])).toBeLessThan(1e-3)
      // V_out − 2.5 = 11 × (V_in − 2.5)
      expect(f.values[VOUT] - 2.5).toBeCloseTo(11 * (f.values[VP] - 2.5), 2)
    }
    // 50 mV peak in: the output swings 2.5 ± 0.55 V
    expect(s.values[HI]).toBeGreaterThan(2.5 + 0.55 * 0.95)
    expect(s.values[HI]).toBeLessThan(2.5 + 0.55 * 1.001)
    b.dispose()
  })

  it('inverting: gain −R_F/R_G = −10, V+ sits on the 2.5 V reference and V− is a virtual 2.5 V', async () => {
    const b = build({ tweaks: { [MODE]: INV } })
    await run(b, 0.5)
    const frames = await run(b, 0.4)
    const s = frames[frames.length - 1]
    expect(s.values[IDEAL]).toBeCloseTo(-10, 9)
    within(s.values[GAIN], -10, 0.01)
    for (const f of frames) {
      within(f.values[VP], 2.5, 0.001)
      within(f.values[VN], 2.5, 0.001)
    }
    b.dispose()
  })

  it('buffer: gain 1 (output = input), whatever R_F is', async () => {
    const b = build({ tweaks: { [MODE]: BUFFER, 'R_F.value': 470e3 } })
    await run(b, 0.9)
    const s = b.snapshot()
    expect(s.values[IDEAL]).toBe(1)
    within(s.values[GAIN], 1, 0.005)
    b.dispose()
  })

  it('comparator (no feedback): the output slams between the rails, 0 V to 3.5 V on an LM358', async () => {
    const b = build({ tweaks: { [MODE]: COMPARATOR } })
    await run(b, 0.9)
    const s = b.snapshot()
    expect(s.values[IDEAL]).toBe(1e5)
    expect(s.values[HI]).toBeCloseTo(LM358_HI, 3)
    expect(s.values[LO]).toBeCloseTo(LOW, 3)
    // on the scope: (almost) every sample is at one rail or the other
    const out = scopeTrace(b, 1, 0.4)
    const between = out.filter((v) => v > 0.1 && v < LM358_HI - 0.1).length
    expect(between / out.length).toBeLessThan(0.02)
    b.dispose()
  })

  it('comparator on an MCP6002 swings rail to rail: 5 mV to 4.975 V', async () => {
    const b = build({ tweaks: { [MODE]: COMPARATOR, [CHIP]: MCP6002_HI } })
    await run(b, 0.9)
    const s = b.snapshot()
    expect(s.values[HI]).toBeCloseTo(MCP6002_HI, 3)
    expect(s.values[LO]).toBeCloseTo(LOW, 3)
    b.dispose()
  })

  it('clipping: 150 mV × 11 asks for 4.15 V; the LM358 stops at 3.5 V, the MCP6002 does not clip', async () => {
    const lm = build({ tweaks: { 'V_SIG.wave.amp': 0.15 } })
    await run(lm, 0.9)
    const a = lm.snapshot()
    expect(a.values[HI]).toBeCloseTo(LM358_HI, 2)
    expect(a.values[LO]).toBeLessThan(0.9) // 2.5 − 1.65 = 0.85 V: the bottom is still linear
    expect(a.values[LO]).toBeGreaterThan(0.8)
    expect(a.values[CLIP]).toBeGreaterThan(10)
    lm.dispose()

    const mcp = build({ tweaks: { 'V_SIG.wave.amp': 0.15, [CHIP]: MCP6002_HI } })
    await run(mcp, 0.9)
    const c = mcp.snapshot()
    within(c.values[GAIN], 11, 0.01)
    expect(c.values[HI]).toBeGreaterThan(4.0)
    expect(c.values[CLIP]).toBeLessThan(1)
    mcp.dispose()
  })

  it('a 1.5 V buffer: the LM358 output flat-tops at 3.5 V, the MCP6002 follows to 4 V', async () => {
    const lm = build({ tweaks: { [MODE]: BUFFER, 'V_SIG.wave.amp': 1.5 } })
    await run(lm, 0.9)
    expect(lm.snapshot().values[HI]).toBeCloseTo(LM358_HI, 2)
    lm.dispose()
    const mcp = build({ tweaks: { [MODE]: BUFFER, 'V_SIG.wave.amp': 1.5, [CHIP]: MCP6002_HI } })
    await run(mcp, 0.9)
    expect(mcp.snapshot().values[HI]).toBeGreaterThan(3.9)
    within(mcp.snapshot().values[GAIN], 1, 0.005)
    mcp.dispose()
  })

  it('F1 no feedback: the golden rules fail, V+ − V− is no longer ≈ 0 and the output hits both rails', async () => {
    const b = build({ failure: 'no-feedback' })
    await run(b, 0.5)
    const frames = await run(b, 0.4)
    const s = frames[frames.length - 1]
    expect(s.values[HI]).toBeCloseTo(LM358_HI, 2)
    expect(s.values[LO]).toBeCloseTo(LOW, 2)
    expect(Math.max(...frames.map((f) => Math.abs(f.values[ERR])))).toBeGreaterThan(0.03)
    b.dispose()
  })

  it('F2 R_F = 1 MΩ: gain 101 wants ±5 V, so the output clips at both the 3.5 V and the 0 V stops', async () => {
    const b = build({ failure: 'too-much-gain' })
    await run(b, 0.9)
    const s = b.snapshot()
    expect(s.values[IDEAL]).toBeCloseTo(101, 6)
    expect(s.values[HI]).toBeCloseTo(LM358_HI, 2)
    expect(s.values[LO]).toBeCloseTo(LOW, 2)
    expect(s.values[CLIP]).toBeGreaterThan(50)
    b.dispose()
  })

  it('F3 lost bias: with the divider’s bottom resistor out the reference rises to 3.5 V and the output sits on 0 V', async () => {
    const b = build({ failure: 'lost-bias' })
    await run(b, 0.9)
    const s = b.snapshot()
    expect(s.values[REF]).toBeCloseTo(LM358_HI, 2)
    expect(s.values[HI]).toBeLessThan(0.05)
    b.dispose()
  })
})
