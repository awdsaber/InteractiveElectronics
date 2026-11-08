import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { resistorBands } from '../../three/colorCode'
import { getLesson } from '../index'

const L = getLesson('resistor-codes-divider') as Lesson
const FRAME = 1 / 60
const [VOUT, IDIV, ILOAD] = [0, 1, 2]

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

describe('T1 resistor-codes-divider', () => {
  it('validates, with the readouts in the order this test assumes', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.readouts.map((r) => r.label)).toEqual(['V OUT', 'DIVIDER I', 'LOAD I'])
    expect(L.powerElementId).toBe('SW1')
    expect(L.powerLabel).toBe('Connect battery')
    expect(L.board.base).toBe('breadboard-only')
  })

  it('every resistor part carries the bands the curriculum names, and is tied to its circuit element', () => {
    const band = (id: string) => resistorBands(L.board.parts.find((p) => p.id === id)!.params!.ohms as number).join('-')
    expect(band('r1')).toBe('brown-black-orange-gold')
    expect(band('r2')).toBe('yellow-violet-red-gold')
    expect(band('ld')).toBe('brown-black-yellow-gold')
    for (const [pid, cid] of [['r1', 'R1'], ['r2', 'R2'], ['ld', 'R_LOAD']]) {
      expect(L.board.parts.find((p) => p.id === pid)!.circuitIds).toEqual([cid]) // live bands follow the tweak
    }
  })

  it('the voltmeter auto-ranges (mV on the loaded failures) and LOAD I reads 0 with the switch open', async () => {
    expect(L.board.parts.find((p) => p.id === 'dmm')!.params!.autoUnit).toBe(true)
    const b = await powered()
    expect((await runFor(b, 0.1)).values[ILOAD]).toBe(0)
    b.dispose()
  })

  it('unloaded: 2.88 V and 0.61 mA; attach 100 kΩ and it sags to 2.79 V', async () => {
    const b = createBench(L)
    expect(b.snapshot().status).toBe('READY')
    b.dispatch('power')
    let s = await runFor(b, 0.4)
    expect(s.status).toBe('POWERED')
    within(s.values[VOUT], 2.88)
    within(s.values[IDIV], 0.00061, 0.03)
    expect(Math.abs(s.values[ILOAD])).toBeLessThan(1e-6)
    b.setTweak('SW_LOAD.closed', 1)
    s = await runFor(b, 0.3)
    within(s.values[VOUT], 2.79)
    within(s.values[ILOAD], 2.79 / 100000, 0.03)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('curriculum arithmetic: Thevenin 3.20 kΩ, tolerance corners 2.69 V and 3.08 V', () => {
    within((10000 * 4700) / 14700, 3197, 0.001)
    within((9 * 4465) / (10500 + 4465), 2.69, 0.005)
    within((9 * 4935) / (9500 + 4935), 3.08, 0.005)
  })

  it('R2 tweak follows V = 9·R2/(R1+R2)', async () => {
    const b = await powered()
    b.setTweak('R2.value', 10000)
    const s = await runFor(b, 0.2)
    within(s.values[VOUT], 4.5, 0.01)
    b.dispose()
  })

  it('F1 a 1 kΩ load collapses V OUT to about 0.69 V', async () => {
    const b = await powered()
    b.dispatch('break:heavy-load')
    const s = await runFor(b, 0.3)
    within(s.values[VOUT], 0.69, 0.03)
    expect(s.assembly.burns).toEqual([])
    b.dispatch('repair')
    within((await runFor(b, 0.3)).values[VOUT], 2.88)
    b.dispose()
  })

  it('F2 bottom resistor drops out: V OUT rises to 9 V', async () => {
    const b = await powered()
    b.dispatch('break:r2-open')
    expect(b.snapshot().partVisible.r2).toBe(false)
    const s = await runFor(b, 0.3)
    within(s.values[VOUT], 9, 0.02)
    b.dispose()
  })

  it('F3 47 kΩ fitted for 4.7 kΩ: V OUT is 7.42 V', async () => {
    const b = await powered()
    b.dispatch('break:misread-band')
    const s = await runFor(b, 0.3)
    within(s.values[VOUT], 7.42, 0.02)
    b.dispose()
  })

  it("the curriculum's quiz is right", () => {
    expect(L.quiz).toHaveLength(4)
    for (const q of L.quiz) expect(q.options[q.answer]).toBeTruthy()
    expect(resistorBands(220).join('-')).toBe('red-red-brown-gold')
    expect(L.quiz[0].options[L.quiz[0].answer]).toBe('220 Ω ±5 %')
    expect((12 * 10) / 30).toBe(4)
    expect(L.quiz[1].options[L.quiz[1].answer]).toBe('4 V')
    expect(L.quiz[2].options[L.quiz[2].answer]).toBe('5 kΩ')
    within((3.3 * 1.8) / (5 - 3.3), 3.49, 0.01)
    within((5 * 3.3) / 5.1, 3.24, 0.01)
    expect(L.quiz[3].options[L.quiz[3].answer]).toBe('3.3 kΩ')
  })
})
