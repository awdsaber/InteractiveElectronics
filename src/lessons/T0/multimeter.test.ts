import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const L = getLesson('multimeter') as Lesson
const FRAME = 1 / 60
// readout indices
const [METER, AMMETER, BURDEN, MID] = [0, 1, 2, 3]

const runFor = async (b: Bench, sec: number) => {
  for (let i = 0; i < Math.round(sec / FRAME); i++) await b.frame(FRAME)
  return b.snapshot()
}
const within = (v: number, target: number, tol = 0.02) => {
  expect(v).toBeGreaterThan(target * (1 - tol))
  expect(v).toBeLessThan(target * (1 + tol))
}
async function powered(): Promise<Bench> {
  const b = createBench(L)
  b.dispatch('power')
  await runFor(b, 0.3)
  return b
}

describe('T0 multimeter', () => {
  it('validates, and the readouts are in the order this test assumes', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.readouts.map((r) => r.label)).toEqual(['METER READS', 'AMMETER', 'BURDEN', 'MIDPOINT'])
    expect(L.powerElementId).toBe('SW_OUT')
    expect(L.powerLabel).toBe('Output ON')
    expect(L.circuit.elements.find((e) => e.id === 'R_FUSE')?.type).toBe('FUSE')
  })

  it('10 MΩ meter on a 1 MΩ / 1 MΩ divider reads 4.76 V (true 5.00 V); ammeter 204.9 mA, burden 0.37 V', async () => {
    const b = createBench(L)
    expect(b.snapshot().status).toBe('READY')
    b.dispatch('power')
    const s = await runFor(b, 0.5)
    expect(s.status).toBe('POWERED')
    within(s.values[METER], 4.762, 0.005)
    within(s.values[MID], 4.762, 0.005)
    within(s.values[AMMETER], 0.2049, 0.005)
    within(s.values[BURDEN], 0.369, 0.01)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('lifting the leads: the meter reads 0 and the midpoint is the unloaded 5.00 V', async () => {
    const b = await powered()
    b.setTweak('SW_VM.closed', 0)
    const s = await runFor(b, 0.3)
    within(s.values[MID], 5, 0.005) // the closed output switch (0.05 Ω) sags the 10 V a little
    expect(Math.abs(s.values[METER])).toBeLessThan(0.1) // only the 1 GΩ open-switch leakage
    b.dispose()
  })

  it('loading error shrinks with a lower-resistance divider, and a weaker meter makes it worse', async () => {
    const b = await powered()
    // 100 kΩ / 100 kΩ on a 10 MΩ meter: 4.975 V (quiz 1)
    b.setTweak('R1.value', 100000)
    b.setTweak('R2.value', 100000)
    let s = await runFor(b, 0.3)
    within(s.values[METER], 4.975, 0.002)
    // 1 kΩ / 1 kΩ: the error all but vanishes
    b.setTweak('R1.value', 1000)
    b.setTweak('R2.value', 1000)
    s = await runFor(b, 0.3)
    within(s.values[METER], 5, 0.003)
    // back to 1 MΩ with a 1 MΩ-input meter: R2 ∥ 1M = 500k, so 10 × 0.5/1.5 = 3.33 V
    b.setTweak('R1.value', 1000000)
    b.setTweak('R2.value', 1000000)
    b.setTweak('R_VM.value', 1000000)
    s = await runFor(b, 0.3)
    within(s.values[METER], 3.333, 0.005)
    b.dispose()
  })

  it('burden: 1.8 Ω reads 3.7 % low on 47 Ω, and drops 1.8 mV per mA (90 mV at 50 mA)', async () => {
    const b = await powered()
    const s = b.snapshot()
    within(s.values[AMMETER] / (10 / 47.01), 0.963, 0.003)
    within(s.values[BURDEN] / s.values[AMMETER], 1.8, 0.01)
    b.dispose()
    expect(1.8e-3 * 50).toBeCloseTo(0.09, 6)
  })

  it('F1 analog meter (200 kΩ): reads 1.43 V instead of 5 V', async () => {
    const b = await powered()
    b.dispatch('break:analog-meter')
    const s = await runFor(b, 0.3)
    within(s.values[METER], 1.4286, 0.005)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('F2 ammeter across the supply: ~5.5 A, the 0.44 A fuse blows, the current meter goes dead but the volts still work', async () => {
    const b = await powered()
    b.dispatch('break:amps-across-supply')
    const s = await runFor(b, 0.5)
    expect(s.assembly.burns.map((x) => x.elementId)).toEqual(['R_FUSE'])
    expect(s.assembly.burns[0].reason).toBe('blown')
    within(s.assembly.burns[0].value, 5.5, 0.03) // the current when it blew: 10 V / (1.8 Ω + the closed switch)
    expect(s.assembly.burns[0].limit).toBe(0.44)
    expect(Math.abs(s.values[AMMETER])).toBeLessThan(1e-4)
    within(s.values[METER], 4.762, 0.01)
    b.dispose()
  })

  it('the 0.44 A fuse carries the normal 205 mA indefinitely', async () => {
    const b = await powered()
    const s = await runFor(b, 3)
    expect(s.assembly.burns).toEqual([])
    within(s.values[AMMETER], 0.2049, 0.005)
    b.dispose()
  })

  it('F3 R2 falls out: the 10 MΩ meter reads a plausible 9.09 V on a node that is disconnected', async () => {
    const b = await powered()
    b.dispatch('break:r2-out')
    const s = await runFor(b, 0.3)
    within(s.values[METER], 9.0909, 0.005)
    b.dispose()
  })

  it("the curriculum's quiz arithmetic is right", () => {
    expect((5 * 10) / 10.05).toBeCloseTo(4.975, 3)
    expect(L.quiz).toHaveLength(4)
    for (const q of L.quiz) expect(q.options[q.answer]).toBeTruthy()
    expect(L.quiz[0].options[L.quiz[0].answer]).toBe('4.98 V')
    expect(L.quiz[1].options[L.quiz[1].answer]).toBe('90 mV')
    expect(L.quiz[2].options[L.quiz[2].answer]).toMatch(/series/)
  })
})
