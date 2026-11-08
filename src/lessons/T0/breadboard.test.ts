import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const L = getLesson('breadboard') as Lesson
const FRAME = 1 / 60
const [LED, IR1, S15, RP, RN] = [0, 1, 2, 3, 4]

const runFor = async (b: Bench, sec: number) => {
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
  await runFor(b, 0.4)
  return b
}

describe('T0 breadboard', () => {
  it('validates, and the readouts are in the order this test assumes', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.readouts.map((r) => r.label)).toEqual(['LED CURRENT', 'R1 CURRENT', 'STRIP 15', '+ RAIL', '- RAIL'])
    expect(L.powerElementId).toBe('SW_PWR')
    expect(L.powerLabel).toBe('Connect USB power')
    expect(L.board.base).toBe('breadboard-only')
    expect(L.quiz).toHaveLength(4)
  })

  it('wired node by node: 9.7 mA, rails near 5 V and 0 V, R1 31 mW', async () => {
    const b = createBench(L)
    expect(b.snapshot().status).toBe('READY')
    b.dispatch('power')
    const s = await runFor(b, 0.5)
    expect(s.status).toBe('POWERED')
    within(s.values[LED], 0.0097)
    within(s.values[IR1], 0.0097)
    within(s.values[RP], 5, 0.02)
    expect(Math.abs(s.values[RN])).toBeLessThan(0.01)
    // strip 15 is the LED's forward drop above the return rail: ~1.8 V
    within(s.values[S15], 1.8, 0.1)
    within(s.values[IR1] ** 2 * 330, 0.031, 0.1)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('the limit-resistor slider moves the current as (5 - 1.8) / R', async () => {
    const b = await powered()
    b.setTweak('R1.value', 1000)
    let s = await runFor(b, 0.3)
    within(s.values[LED], 0.0032, 0.15)
    b.setTweak('R1.value', 220)
    s = await runFor(b, 0.3)
    within(s.values[LED], 0.0145, 0.15)
    b.dispose()
  })

  it('F1 both resistor legs in one strip: R1 bridges nothing, LED dark, strip 15 at 0 V', async () => {
    const b = await powered()
    b.dispatch('break:resistor-one-strip')
    const s = await runFor(b, 0.4)
    expect(s.partVisible.r1).toBe(false)
    expect(s.partVisible['r1-bad']).toBe(true)
    expect(Math.abs(s.values[LED])).toBeLessThan(1e-4)
    expect(Math.abs(s.values[S15])).toBeLessThan(0.3)
    b.dispose()
  })

  it('F2 LED legs in one strip: LED dark, R1 alone sets 15.2 mA (76 mW), no burn', async () => {
    const b = await powered()
    b.dispatch('break:led-one-strip')
    const s = await runFor(b, 1)
    expect(Math.abs(s.values[LED])).toBeLessThan(1e-4)
    within(s.values[IR1], 5 / 330)
    within(s.values[IR1] ** 2 * 330, 0.076, 0.1)
    expect(s.assembly.burns).toEqual([])
    expect(s.partVisible['led-bad']).toBe(true)
    b.dispose()
  })

  it('F3 split return rail: LED dark and the - rail floats up toward the + rail', async () => {
    const b = await powered()
    b.dispatch('break:split-rail')
    const s = await runFor(b, 0.5)
    expect(Math.abs(s.values[LED])).toBeLessThan(1e-4)
    expect(s.values[RN]).toBeGreaterThan(2.5)
    expect(s.partVisible.bridge).toBe(false)
    expect(s.assembly.burns).toEqual([])
    b.dispatch('repair')
    const r = await runFor(b, 0.4)
    within(r.values[LED], 0.0097)
    expect(Math.abs(r.values[RN])).toBeLessThan(0.01)
    b.dispose()
  })

  it('F4 jumper one strip off: R1 bypassed, LED past 30 mA and burns after 300 ms', async () => {
    const b = await powered()
    b.dispatch('break:jumper-wrong-strip')
    let s = await runFor(b, 0.1)
    expect(s.values[LED]).toBeGreaterThan(0.03)
    expect(s.partVisible['j1-wrong']).toBe(true)
    expect(s.partVisible.j1).toBe(false)
    s = await runFor(b, 0.8)
    expect(s.assembly.burns.map((x) => x.elementId)).toEqual(['LED1'])
    expect(Math.abs(s.values[LED])).toBeLessThan(1e-4)
    b.dispose()
  })

  it("the curriculum's arithmetic and quiz are right", () => {
    expect((5 - 1.8) / 330).toBeCloseTo(0.0097, 4)
    expect(0.0097 ** 2 * 330).toBeCloseTo(0.031, 3)
    expect(5 / 330).toBeCloseTo(0.01515, 4)
    expect((5 / 330) ** 2 * 330).toBeCloseTo(0.0758, 3)
    expect((5 - 2.1) / 0.01).toBeCloseTo(290, 6)
    const ans = (i: number) => L.quiz[i].options[L.quiz[i].answer]
    expect(ans(0)).toBe('5')
    expect(ans(1)).toMatch(/^290/)
    expect(ans(2)).toBe('15.2 mA')
    expect(ans(3)).toMatch(/own strip/)
  })
})
