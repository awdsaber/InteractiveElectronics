import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const L = getLesson('multimeter') as Lesson
const FRAME = 1 / 60
// readout indices
const [METER, AMMETER, BURDEN, MID, TRUE_I] = [0, 1, 2, 3, 4]

const runFor = async (b: Bench, sec: number) => {
  for (let i = 0; i < Math.round(sec / FRAME); i++) await b.frame(FRAME)
  return b.snapshot()
}
const within = (v: number, target: number, tol = 0.02) => {
  expect(v).toBeGreaterThan(target * (1 - tol))
  expect(v).toBeLessThan(target * (1 + tol))
}
/** powered, with the voltmeter leads on the midpoint unless told otherwise (they start lifted) */
async function powered(leadsOn = true): Promise<Bench> {
  const b = createBench(L)
  b.dispatch('power')
  if (leadsOn) b.setTweak('SW_VM.closed', 1)
  await runFor(b, 0.3)
  return b
}

describe('T0 multimeter', () => {
  it('validates, and the readouts are in the order this test assumes', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.readouts.map((r) => r.label)).toEqual(['METER READS', 'AMMETER', 'BURDEN', 'MIDPOINT', 'TRUE (NO METER)'])
    expect(L.powerElementId).toBe('SW_OUT')
    expect(L.powerLabel).toBe('Output ON')
    expect(L.circuit.elements.find((e) => e.id === 'R_FUSE')?.type).toBe('FUSE')
  })

  it('first view: leads lifted, so MIDPOINT shows the true 5.00 V and the reference current is 212.8 mA', async () => {
    const b = createBench(L)
    expect(b.snapshot().status).toBe('READY')
    expect(Math.abs(b.snapshot().values[TRUE_I])).toBeLessThan(1e-6) // the reference branch is gated off until power
    b.dispatch('power')
    const s = await runFor(b, 0.5)
    expect(s.status).toBe('POWERED')
    within(s.values[MID], 5, 0.005) // the closed output switch (0.05 Ω) sags the 10 V a little
    expect(Math.abs(s.values[METER])).toBeLessThan(0.1) // only the 1 GΩ open-switch leakage
    within(s.values[TRUE_I], 0.2128, 0.002)
    within(s.values[AMMETER], 0.2049, 0.005)
    within(s.values[BURDEN], 0.369, 0.01)
    expect(s.statusLine.text).toMatch(/sits at 4\.9\d V with the voltmeter leads off/)
    b.dispose()
  })

  it('attaching the leads drops MIDPOINT from 5.00 V to 4.76 V, and the meter reads it', async () => {
    const b = await powered(false)
    const before = b.snapshot().values[MID]
    b.setTweak('SW_VM.closed', 1)
    const s = await runFor(b, 0.3)
    within(before, 5, 0.005)
    within(s.values[MID], 4.762, 0.005)
    within(s.values[METER], 4.762, 0.005)
    expect(before - s.values[MID]).toBeGreaterThan(0.2)
    expect(s.assembly.burns).toEqual([])
    expect(s.statusLine.text).toMatch(/LEADS ON/)
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

  it('burden: the 1.8 Ω meter reads 3.7 % under the true current on 47 Ω, 1.8 mV per mA', async () => {
    const b = await powered()
    let s = b.snapshot()
    within(s.values[AMMETER] / s.values[TRUE_I], 0.963, 0.003)
    within(s.values[BURDEN] / s.values[AMMETER], 1.8e-3 / 1e-3, 0.01)
    // quiz 2: at 50 mA the burden is 90 mV (47 Ω + 1.8 Ω loop: load 198 Ω for 50 mA)
    b.setTweak('R3.value', 10 / 0.05 - 1.81)
    s = await runFor(b, 0.3)
    within(s.values[AMMETER], 0.05, 0.005)
    within(s.values[BURDEN], 0.09, 0.01)
    b.dispose()
  })

  it('F1 analog meter (200 kΩ): reads 1.43 V instead of 5 V', async () => {
    const b = await powered()
    b.dispatch('break:analog-meter')
    const s = await runFor(b, 0.3)
    within(s.values[METER], 1.4286, 0.005)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('F2 ammeter across the supply: about 5.4 A, the 0.44 A fuse blows, the current meter goes dead but the volts still work', async () => {
    const b = await powered()
    b.dispatch('break:amps-across-supply')
    const s = await runFor(b, 0.5)
    expect(s.assembly.burns.map((x) => x.elementId)).toEqual(['R_FUSE'])
    expect(s.assembly.burns[0].reason).toBe('blown')
    within(s.assembly.burns[0].value, 5.4, 0.05) // the current when it blew: 10 V / (1.8 Ω + switch and supply resistance)
    expect(s.assembly.burns[0].limit).toBe(0.44)
    expect(Math.abs(s.values[AMMETER])).toBeLessThan(1e-4)
    within(s.values[METER], 4.762, 0.01)
    expect(s.values[BURDEN]).toBeGreaterThan(9)
    expect(s.statusLine.text).toMatch(/R_FUSE.*blew/)
    b.dispatch('repair')
    const r = await runFor(b, 0.3)
    within(r.values[AMMETER], 0.2049, 0.005) // a fresh fuse is fitted
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

  it("the curriculum's quiz answers are the right options", () => {
    expect(L.quiz).toHaveLength(4)
    expect(L.quiz.map((q) => q.options[q.answer])).toEqual([
      '4.98 V',
      '90 mV',
      'in series with the resistor',
      'To protect the meter when it is accidentally connected across a voltage in current mode',
    ])
  })
})
