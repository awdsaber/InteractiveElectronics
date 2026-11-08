import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { liveParams, partState } from '../../three/Board'
import { lesson as def } from './charge-voltage-current'

const L = { ...def, fig: 99 } as Lesson
const FRAME = 1 / 60
const [CURRENT, BATTERY, LED_V, CHARGE, E_RATE, R1_DROP] = [0, 1, 2, 3, 4, 5]
const E = 1.602176634e-19

const runFor = async (b: Bench, sec: number) => {
  const t0 = b.t
  while (b.t - t0 < sec) await b.frame(FRAME)
  return b.snapshot()
}
async function runUntil(b: Bench, pred: (s: BenchSnapshot) => boolean, maxSim = 3): Promise<BenchSnapshot> {
  const t0 = b.t
  for (;;) {
    await b.frame(FRAME)
    const s = b.snapshot()
    if (pred(s)) return s
    if (b.t - t0 > maxSim) throw new Error(`condition not reached in ${maxSim}s of sim time`)
  }
}
const within = (v: number, target: number, tol = 0.15) => {
  expect(v).toBeGreaterThan(target * (1 - tol))
  expect(v).toBeLessThan(target * (1 + tol))
}
const part = (id: string) => L.board.parts.find((p) => p.id === id)!

describe('charge-voltage-current lesson', () => {
  it('validates, and every figure on the board is a real part', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.id).toBe('charge-voltage-current')
    expect(L.track).toBe('T0')
    expect(L.board.base).toBe('breadboard-only')
    expect(L.board.parts.filter((p) => !p.hidden).map((p) => p.kind)).toEqual(
      expect.arrayContaining(['breadboard', 'battery-aa-pack', 'switch-slide', 'multimeter', 'resistor', 'led']),
    )
  })

  it('opens finished and dark: switch open, so no current, but the cells still show their 3 V', async () => {
    const b = createBench(L)
    expect(b.snapshot().status).toBe('READY')
    for (let i = 0; i < 12; i++) await b.frame(FRAME) // unpowered: sim time does not advance
    const s = b.snapshot()
    expect(s.assembly.powered.SW1).toBe(false)
    expect(s.values[CURRENT]).toBe(0)
    within(s.values[BATTERY], 3.0, 0.01) // the push is there even with the switch open
    expect(s.statusLine.text).toMatch(/^SWITCH OPEN/)
    b.dispose()
  })

  it('flip the switch: 12 mA, 7.5e16 electrons per second, Q = I t, 36 mW from the cells', async () => {
    const b = createBench(L)
    b.dispatch('power')
    const s = await runFor(b, 20)
    expect(s.status).toBe('POWERED')
    within(s.values[CURRENT], 0.012) // (3.0 - 1.78) / 100.3 = 12.2 mA
    within(s.values[BATTERY], 2.996, 0.01) // 3.0 V less 0.3 ohm x 12 mA
    within(s.values[LED_V], 1.78, 0.05)
    within(s.values[R1_DROP], 1.22, 0.1)
    // charge: Q = I t. 0.012 A x 60 s = 0.72 C (curriculum); 20 s of sim time is checked here
    expect(s.values[CHARGE]).toBeCloseTo(s.values[CURRENT] * b.t, 2)
    within(s.values[CHARGE], 0.012 * b.t, 0.05)
    // electrons: I / e, about 7.5e16 per second ("75 million billion")
    within(s.values[E_RATE], 75, 0.1) // shown in units of 1e15 per second: 7.5e16 = 75
    expect(s.values[E_RATE] * 1e15 * E).toBeCloseTo(s.values[CURRENT], 4)
    // power: P = V I = 3.0 x 0.012 = 36 mW
    within(s.values[BATTERY] * s.values[CURRENT], 0.036, 0.15)
    expect(s.assembly.burns).toEqual([])
    expect(s.statusLine.tone).toBe('ok')
    expect(s.statusLine.text).toMatch(/12\.\d mA/)
    // the LED glows at about 12/20 of full, and the ammeter on the bench reads in mA
    expect(partState(L, part('led1'), s).glow).toBeGreaterThan(0.5)
    expect(partState(L, part('meter'), s).reading).toMatch(/^12\.\d/)
    b.dispose()
  })

  it('quiz answers follow from values measured on the bench', async () => {
    const b = createBench(L)
    b.dispatch('power')
    const s = await runFor(b, 1)
    const nearest = (q: number, target: number) => {
      const nums = L.quiz[q].options.map((o) => parseFloat(o))
      return nums.indexOf(nums.reduce((best, n) => (Math.abs(Math.log(n / target)) < Math.abs(Math.log(best / target)) ? n : best)))
    }
    const i = s.values[CURRENT]
    // quiz 1: Q = I t over 10 minutes (measured I) -> about 7.5 C, nearest option 7.2 C
    expect(nearest(0, i * 600)).toBe(L.quiz[0].answer)
    // quiz 3: 2500 mAh at the measured current -> hours; the nearest option is 208 h
    expect(nearest(2, 2.5 / i)).toBe(L.quiz[2].answer)
    // quiz 2 is a definition: 1 V = 1 J/C, checked through P = V I = (J/C)(C/s)
    expect(L.quiz[1].options[L.quiz[1].answer]).toMatch(/joule/)
    b.dispatch('break:open-loop')
    const open = await runFor(b, 0.5)
    // quiz 4: the measured voltage across the empty gap
    expect(nearest(3, open.values[R1_DROP])).toBe(L.quiz[3].answer)
    b.dispose()
  })

  it('tweak: a smaller resistor makes the current, and the LED, rise; a bigger one dims it', async () => {
    const b = createBench(L)
    b.dispatch('power')
    await runFor(b, 0.5)
    const base = b.snapshot()
    b.setTweak('R1.value', 220)
    const dim = await runFor(b, 0.5)
    expect(dim.values[CURRENT]).toBeLessThan(base.values[CURRENT])
    within(dim.values[CURRENT], (3 - 1.7) / 220.3, 0.15)
    b.setTweak('R1.value', 47)
    const bright = await runFor(b, 0.5)
    within(bright.values[CURRENT], 0.024, 0.2)
    expect(partState(L, part('led1'), bright).glow).toBeGreaterThan(partState(L, part('led1'), dim).glow)
    expect(bright.assembly.burns).toEqual([]) // still inside the LED's 30 mA
    b.dispose()
  })

  it('tweak: one cell (1.5 V) is below the LED knee and stays dark; three cells with 47 ohm burn it', async () => {
    const b = createBench(L)
    b.dispatch('power')
    b.setTweak('V_BAT.value', 1.5)
    let s = await runFor(b, 0.5)
    expect(s.values[CURRENT]).toBeLessThan(0.0005)
    expect(partState(L, part('led1'), s).glow).toBeLessThan(0.05)
    expect(s.assembly.burns).toEqual([])
    b.setTweak('V_BAT.value', 4.5)
    s = await runFor(b, 0.3)
    within(s.values[CURRENT], 0.026, 0.2) // three cells on 100 ohm: still safe
    expect(s.assembly.burns).toEqual([])
    b.setTweak('R1.value', 47)
    s = await runUntil(b, (x) => x.assembly.burns.some((y) => y.elementId === 'LED1'), 1.5)
    expect(s.partBurnt.led1).toBe(true)
    b.dispose()
  })

  it('F1 open the loop: 0 A, LED dark, the cells still read 3.0 V, and 3.0 V sits across the gap', async () => {
    const b = createBench(L)
    b.dispatch('power')
    await runFor(b, 0.3)
    b.dispatch('break:open-loop')
    const s = await runFor(b, 0.5)
    expect(Math.abs(s.values[CURRENT])).toBeLessThan(1e-6)
    expect(partState(L, part('led1'), s).glow).toBe(0)
    within(s.values[BATTERY], 3.0, 0.01)
    within(s.values[R1_DROP], 3.0, 0.01) // quiz 4: the whole push appears across the empty gap
    expect(s.partVisible.r1).toBe(false)
    expect(s.assembly.burns).toEqual([])
    expect(s.statusLine.text).toMatch(/BROKEN/)
    b.dispatch('repair')
    const r = await runFor(b, 0.3)
    within(r.values[CURRENT], 0.012)
    b.dispose()
  })

  it('F2 jumper across R1: past 30 mA, then LED1 burns open after ~300 ms and the current falls to 0', async () => {
    const b = createBench(L)
    b.dispatch('power')
    await runFor(b, 0.3)
    b.dispatch('break:bypass-resistor')
    const first = await runFor(b, FRAME * 2)
    expect(first.values[CURRENT]).toBeGreaterThan(0.03)
    expect(first.partVisible.jumper).toBe(true)
    expect(first.assembly.burns).toEqual([])
    const burnt = await runUntil(b, (x) => x.assembly.burns.some((y) => y.elementId === 'LED1'), 1)
    expect(burnt.assembly.burns[0].reason).toBe('overcurrent')
    expect(burnt.partBurnt.led1).toBe(true)
    const after = await runFor(b, 0.3)
    expect(Math.abs(after.values[CURRENT])).toBeLessThan(1e-6)
    expect(after.status).toBe('FAULT')
    b.dispatch('repair')
    expect(b.snapshot().assembly.burns).toEqual([])
    b.dispose()
  })

  it('F3 cells backwards: about 0 A, LED dark, nothing damaged (3 V is inside the 5 V reverse rating)', async () => {
    const b = createBench(L)
    b.dispatch('power')
    await runFor(b, 0.3)
    b.dispatch('break:cells-reversed')
    const s = await runFor(b, 1)
    expect(Math.abs(s.values[CURRENT])).toBeLessThan(1e-4)
    expect(partState(L, part('led1'), s).glow).toBeLessThan(0.02)
    expect(s.assembly.burns).toEqual([])
    expect(s.values[BATTERY]).toBeLessThan(-2.9)
    b.dispose()
  })

  it('quiz answers agree with the physics and the copy keeps its figures', () => {
    expect(L.quiz).toHaveLength(4)
    expect(L.tagline).toMatch(/75 million billion|7\.5/)
    expect(L.meet).toMatch(/6\.24/)
    expect(L.meet).toMatch(/0\.72 C/)
  })

  it('3D: the slide switch follows the power state', async () => {
    const b = createBench(L)
    expect(partState(L, part('sw'), b.snapshot()).value).toBe(0)
    b.dispatch('power')
    await runFor(b, 0.1)
    expect(partState(L, part('sw'), b.snapshot()).value).toBe(1)
    // one AA cell per 1.5 V on the pack
    expect(liveParams(part('bat'), b.snapshot()).params?.cells).toBe(2)
    b.setTweak('V_BAT.value', 4.5)
    await runFor(b, 0.1)
    expect(liveParams(part('bat'), b.snapshot()).params?.cells).toBe(3)
    b.dispose()
  })
})
