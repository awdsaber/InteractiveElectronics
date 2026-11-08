import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const L = getLesson('ohms-law') as Lesson
const FRAME = 1 / 60
const [VOLT, CUR, PWR, CC] = [0, 1, 2, 3]

const runFor = async (b: Bench, sec: number) => {
  // a fixed frame count: sim time does not advance while the bench is unpowered
  for (let i = 0; i < Math.round(sec / FRAME); i++) await b.frame(FRAME)
  return b.snapshot()
}
const within = (v: number, target: number, tol = 0.15) => {
  expect(v).toBeGreaterThan(target * (1 - tol))
  expect(v).toBeLessThan(target * (1 + tol))
}

async function powered(): Promise<Bench> {
  const b = createBench(L)
  b.dispatch('power')
  await runFor(b, 0.3)
  return b
}

describe('T0 ohms-law', () => {
  it('validates, and the readouts are in the order this test assumes', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.readouts.map((r) => r.label)).toEqual(['VOLTAGE', 'CURRENT', 'R1 POWER', 'CC MODE (0 OFF, 1 ON)'])
    expect(L.powerElementId).toBe('SW_OUT')
    expect(L.powerLabel).toBe('Output ON')
    expect(L.board.base).toBe('breadboard-only')
  })

  it('output off: the supply is set but nothing flows; ON gives 5 V, 5 mA, 25 mW', async () => {
    const b = createBench(L)
    expect(b.snapshot().status).toBe('READY')
    await runFor(b, 0.2)
    expect(Math.abs(b.snapshot().values[CUR])).toBeLessThan(1e-6)
    b.dispatch('power')
    const s = await runFor(b, 0.5)
    expect(s.status).toBe('POWERED')
    within(s.values[VOLT], 5)
    within(s.values[CUR], 0.005)
    within(s.values[PWR], 0.025)
    expect(s.values[CC]).toBe(0)
    expect(s.assembly.burns).toEqual([])
    expect(s.statusLine.tone).toBe('ok')
    b.dispose()
  })

  it('I tracks V in a straight line at fixed R (slope 1/R), and 1/R in R at fixed V', async () => {
    const b = await powered()
    const pts: [number, number][] = []
    for (const v of [2, 4, 6, 8, 10]) {
      b.setTweak('V_PSU.value', v)
      const s = await runFor(b, 0.2)
      pts.push([s.values[VOLT], s.values[CUR]])
      within(s.values[CUR], v / 1000, 0.02)
    }
    const slope = (pts[4][1] - pts[0][1]) / (pts[4][0] - pts[0][0])
    within(slope, 1 / 1000, 0.02)
    b.setTweak('V_PSU.value', 12)
    let s = await runFor(b, 0.2)
    within(s.values[CUR], 0.012) // the curriculum's "raise the supply to 12 V and I = 12 mA"
    b.setTweak('V_PSU.value', 5)
    b.setTweak('R1.value', 2380)
    s = await runFor(b, 0.2)
    within(s.values[CUR], 0.0021) // the worked "R = 5 / 2.1 mA = 2.38 kΩ" example
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('12 V across 470 Ω is 0.31 W: over the 1/4 W rating, so R1 burns open', async () => {
    const b = await powered()
    b.setTweak('V_PSU.value', 12)
    b.setTweak('R1.value', 470)
    let s = await runFor(b, 0.1)
    within(s.values[CUR], 0.0255)
    within(s.values[PWR], 0.306)
    expect(s.statusLine.text).toMatch(/WARNING/)
    s = await runFor(b, 0.5)
    expect(s.assembly.burns.map((x) => x.elementId)).toEqual(['R1'])
    expect(s.status).toBe('FAULT')
    expect(Math.abs(s.values[CUR])).toBeLessThan(1e-6)
    b.dispose()
  })

  it('stays inside the rating at the 576 Ω boundary and below it burns', async () => {
    const b = await powered()
    b.setTweak('V_PSU.value', 12)
    b.setTweak('R1.value', 620)
    const s = await runFor(b, 1)
    within(s.values[PWR], 144 / 620)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('the current limit folds the supply back: 12 V into 100 Ω limited to 50 mA is 5 V and 0.25 W', async () => {
    const b = await powered()
    b.setTweak('V_PSU.value', 12)
    b.setTweak('R1.value', 100)
    b.setTweak('V_PSU.iLimit', 0.05)
    const s = await runFor(b, 1)
    within(s.values[CUR], 0.05, 0.03)
    within(s.values[VOLT], 5, 0.03)
    expect(s.values[CC]).toBe(1)
    expect(s.assembly.burns).toEqual([])
    expect(s.statusLine.text).toMatch(/CC/)
    b.dispose()
  })

  it('F1 12 V into 100 Ω: 120 mA and 1.44 W, R1 burns open after 300 ms', async () => {
    const b = await powered()
    b.dispatch('break:twelve-into-100')
    let s = await runFor(b, 0.15)
    within(s.values[CUR], 0.12)
    within(s.values[PWR], 1.44)
    expect(s.assembly.burns).toEqual([])
    s = await runFor(b, 0.6)
    expect(s.assembly.burns.map((x) => x.elementId)).toEqual(['R1'])
    expect(s.assembly.burns[0].reason).toBe('overpower')
    expect(s.partBurnt.r1).toBe(true)
    expect(Math.abs(s.values[CUR])).toBeLessThan(1e-6)
    b.dispose()
  })

  it('F2 10 Ω fitted instead of 1 kΩ: 500 mA, 2.5 W, then burnt', async () => {
    const b = await powered()
    b.dispatch('break:wrong-bands')
    let s = await runFor(b, 0.15)
    within(s.values[CUR], 0.5)
    within(s.values[PWR], 2.5)
    expect(s.values[CC]).toBe(0) // the supply's limit is above this, so it does not save the part
    s = await runFor(b, 0.6)
    expect(s.assembly.burns.map((x) => x.elementId)).toEqual(['R1'])
    expect(Math.abs(s.values[CUR])).toBeLessThan(1e-6)
    b.dispose()
  })

  it('F3 lead out of the board: 0 A, and the whole 5 V sits across the gap', async () => {
    const b = await powered()
    b.dispatch('break:lead-out')
    expect(b.snapshot().partVisible.r1).toBe(false)
    const s = await runFor(b, 0.5)
    expect(Math.abs(s.values[CUR])).toBeLessThan(1e-6)
    within(s.values[VOLT], 5, 0.02)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('F4 shorting the output: the supply folds into CC at its limit instead of reporting hundreds of amps', async () => {
    const b = await powered()
    b.dispatch('break:short-output')
    const s = await runFor(b, 1)
    within(s.values[CUR], 0.6, 0.03)
    expect(s.values[VOLT]).toBeLessThan(0.1)
    expect(s.values[CC]).toBe(1)
    expect(s.assembly.burns).toEqual([])
    expect(s.statusLine.text).toMatch(/current limit set to 0.6 A/)
    b.dispatch('repair')
    const r = await runFor(b, 0.3)
    within(r.values[CUR], 0.005)
    expect(r.values[CC]).toBe(0)
    b.dispose()
  })

  it("the curriculum's quiz arithmetic is right", () => {
    expect(9 / 4700).toBeCloseTo(0.00191, 5)
    expect(5 / 0.01).toBe(500)
    expect(144 / 470).toBeCloseTo(0.306, 3)
    expect(L.quiz).toHaveLength(4)
    for (const q of L.quiz) expect(q.options[q.answer]).toBeTruthy()
    expect(L.quiz[0].options[L.quiz[0].answer]).toBe('1.91 mA')
    expect(L.quiz[3].options[L.quiz[3].answer]).toBe('0.31 W')
  })
})
