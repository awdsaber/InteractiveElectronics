// T7 soldering-rework: the joint tester on a real bench. The sketch's 4-wire readings, the LED and
// the load must show what each joint quality does, and every failure its described effect.
import { describe, expect, it } from 'vitest'
import { QUALITIES } from '../../engine/behaviors/solder-joints'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { partState } from '../../three/Board'
import { bakeKeyOf } from '../../three/parts/frame'
import { partRegistry } from '../../three/parts'
import { getLesson } from '../index'

const FRAME = 1 / 60
const L = getLesson('soldering-rework') as Lesson

const J = [0, 1, 2, 3] // measured J1..J4, mΩ
const LOAD = 4
const LED = 5
const SEL_OHM = 6
const GRADE = 7
const BREAKS = 8
const HEAT = 9

async function build(): Promise<Bench> {
  const b = createBench(L)
  b.dispatch('strip')
  b.dispatch('pick-place')
  b.dispatch('place-all')
  b.dispatch('solder')
  b.dispatch('power')
  b.dispatch('power:pwr')
  b.upload()
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

async function press(b: Bench, key: 'go' | 'wick') {
  b.setTweak(`behavior:solder.${key}`, 1)
  await run(b, 0.05)
  b.setTweak(`behavior:solder.${key}`, 0)
  await run(b, 0.05)
}

const q = (name: (typeof QUALITIES)[number]) => QUALITIES.indexOf(name)

describe('T7 soldering-rework lesson', () => {
  it('validates: four failures, a joint tester sketch, 9 tweaks, a 6–9 step guide', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.failures.map((f) => f.id)).toEqual(['cold-j2', 'bridge-pins', 'lifted-j3', 'esd-zap'])
    expect(L.tweaks?.length).toBe(9)
    expect(L.guide!.length).toBeGreaterThanOrEqual(6)
    expect(L.guide!.length).toBeLessThanOrEqual(9)
  })

  it('good joints: each reads under 5 mΩ (0.5 mV is under one 1.07 mV count), LED ≈ 8.2 mA', async () => {
    const b = await build()
    let peakLoad = 0
    const s = await run(b, 2.5, (x) => (peakLoad = Math.max(peakLoad, x.values[LOAD])))
    expect(s.status).toBe('RUNNING')
    expect(s.serial.at(-1)).toMatch(/^J1_mohm:-?[\d.]+,J2_mohm:-?[\d.]+,J3_mohm:-?[\d.]+,J4_mohm:-?[\d.]+$/)
    for (const k of J) expect(Math.abs(s.values[k])).toBeLessThan(5)
    // (5 − 2.1) / (330 + 25) = 8.2 mA
    expect(s.values[LED]).toBeGreaterThan(0.0082 * 0.85)
    expect(s.values[LED]).toBeLessThan(0.0082 * 1.15)
    expect(s.values[SEL_OHM]).toBeCloseTo(0.001, 6)
    expect(s.values[GRADE]).toBe(0)
    expect(s.values[HEAT]).toBeCloseTo(0.25e-3, 6)
    b.dispose()
  })

  it('cold J2 from a 280 °C iron: reads ≈ 560 mΩ (0.6 Ω at 0.47 A over a nominal 0.5 A), 0.15 W', async () => {
    const b = await build()
    await run(b, 1.2)
    b.setTweak('behavior:solder.target', 2)
    b.setTweak('behavior:solder.tipC', 280)
    await press(b, 'go')
    let peakLoad = 0
    const s = await run(b, 2.2, (x) => (peakLoad = Math.max(peakLoad, x.values[LOAD])))
    expect(s.values[GRADE]).toBe(q('cold'))
    expect(s.values[SEL_OHM]).toBeCloseTo(0.6, 6)
    expect(s.values[J[1]]).toBeGreaterThan(560 * 0.85)
    expect(s.values[J[1]]).toBeLessThan(560 * 1.15)
    for (const k of [0, 2, 3]) expect(Math.abs(s.values[k])).toBeLessThan(5)
    expect(s.values[HEAT]).toBeCloseTo(0.15, 6)
    // the 0.6 Ω cuts the pulse current from ≈ 0.495 A to ≈ 0.468 A
    expect(peakLoad).toBeGreaterThan(0.468 * 0.97)
    expect(peakLoad).toBeLessThan(0.468 * 1.03)
    b.dispose()
  })

  it('vibration breaks the cold joint’s contact; a proper reflow (340 °C, 3 s, flux) makes it good', async () => {
    const b = await build()
    b.setTweak('behavior:solder.target', 2)
    b.setTweak('behavior:solder.tipC', 280)
    await press(b, 'go')
    b.setTweak('behavior:solder.vibration', 0.5)
    const s = await run(b, 4)
    expect(s.values[BREAKS]).toBeGreaterThan(3)
    b.setTweak('behavior:solder.vibration', 0)
    b.setTweak('behavior:solder.tipC', 340)
    await press(b, 'go')
    const g = await run(b, 2.2)
    expect(g.values[GRADE]).toBe(q('good'))
    expect(Math.abs(g.values[J[1]])).toBeLessThan(5)
    b.dispose()
  })

  it('a cold J5 under vibration flickers the LED (dips to ≈ 2 mA through the 1 kΩ open contact)', async () => {
    const b = await build()
    b.setTweak('behavior:solder.target', 5)
    b.setTweak('behavior:solder.flux', 0)
    await press(b, 'go')
    expect(b.snapshot().values[GRADE]).toBe(q('cold'))
    b.setTweak('behavior:solder.vibration', 1)
    let dim = 0
    let bright = 0
    await run(b, 4, (x) => {
      if (x.values[LED] < 0.003) dim++
      if (x.values[LED] > 0.007) bright++
    })
    expect(dim).toBeGreaterThan(3)
    expect(bright).toBeGreaterThan(dim)
    b.dispose()
  })

  it('too much solder on J5 bridges the LED dark; wick, then the right amount, brings it back', async () => {
    const b = await build()
    b.setTweak('behavior:solder.target', 5)
    b.setTweak('behavior:solder.feed', 2)
    await press(b, 'go')
    let s = await run(b, 0.3)
    expect(s.values[GRADE]).toBe(q('bridge'))
    expect(s.values[LED]).toBeLessThan(1e-4)
    // pin 6 now drives the bridge: 5 / 355 ≈ 14 mA, inside its 40 mA limit
    expect(s.status).toBe('RUNNING')
    expect(Math.abs(s.current.pin6)).toBeGreaterThan(0.014 * 0.85)
    expect(Math.abs(s.current.pin6)).toBeLessThan(0.014 * 1.15)
    await press(b, 'wick')
    expect(b.snapshot().values[GRADE]).toBe(q('insufficient'))
    b.setTweak('behavior:solder.feed', 1)
    await press(b, 'go')
    s = await run(b, 0.3)
    expect(s.values[GRADE]).toBe(q('good'))
    expect(s.values[LED]).toBeGreaterThan(0.0082 * 0.85)
    b.dispose()
  })

  it('lead-free with a leaded setpoint is cold; at 380 °C it is good', async () => {
    const b = await build()
    b.setTweak('behavior:solder.alloy', 1)
    b.setTweak('behavior:solder.tipC', 320)
    await press(b, 'go')
    expect(b.snapshot().values[GRADE]).toBe(q('cold'))
    b.setTweak('behavior:solder.tipC', 380)
    await press(b, 'go')
    expect(b.snapshot().values[GRADE]).toBe(q('good'))
    b.dispose()
  })

  it('450 °C twice on J3: overheated, then lifted: the load stops and J3 reads impossibly high', async () => {
    const b = await build()
    b.setTweak('behavior:solder.target', 3)
    b.setTweak('behavior:solder.tipC', 450)
    await press(b, 'go')
    expect(b.snapshot().values[GRADE]).toBe(q('overheated'))
    await press(b, 'go')
    let peakLoad = 0
    const s = await run(b, 2.2, (x) => (peakLoad = Math.max(peakLoad, x.values[LOAD])))
    expect(s.values[GRADE]).toBe(q('lifted'))
    expect(peakLoad).toBeLessThan(1e-4)
    expect(s.values[J[2]]).toBeGreaterThan(1000)
    b.dispatch('repair')
    const r = await run(b, 2.2)
    expect(r.values[GRADE]).toBe(q('good'))
    expect(Math.abs(r.values[J[2]])).toBeLessThan(5)
    b.dispose()
  })

  it('failure cold-j2: J2 ≈ 560 mΩ, reworkable while the failure is active', async () => {
    const b = await build()
    b.dispatch('break:cold-j2')
    const s = await run(b, 2.2)
    expect(s.values[J[1]]).toBeGreaterThan(560 * 0.85)
    expect(s.values[J[1]]).toBeLessThan(560 * 1.15)
    b.setTweak('behavior:solder.target', 2)
    await press(b, 'go')
    const g = await run(b, 2.2)
    expect(Math.abs(g.values[J[1]])).toBeLessThan(5)
    b.dispose()
  })

  it('failure bridge-pins: D6 HIGH against D5 LOW, 100 mA, both pins burn and the LED goes dark', async () => {
    const b = await build()
    await run(b, 0.5)
    b.dispatch('break:bridge-pins')
    const s = await run(b, 1.5)
    expect(s.status).toBe('FAULT')
    expect(s.assembly.burns.map((x) => x.elementId).sort()).toEqual(['pin5', 'pin6'])
    expect(s.values[LED]).toBeLessThan(0.002)
    b.dispose()
  })

  it('failure lifted-j3: the load circuit opens', async () => {
    const b = await build()
    b.dispatch('break:lifted-j3')
    let peakLoad = 0
    const s = await run(b, 2.2, (x) => (peakLoad = Math.max(peakLoad, x.values[LOAD])))
    expect(peakLoad).toBeLessThan(1e-4)
    expect(s.values[J[2]]).toBeGreaterThan(1000)
    b.dispose()
  })

  it('failure esd-zap: pin 6 fails (FAULT) and the LED goes out', async () => {
    const b = await build()
    await run(b, 0.3)
    b.dispatch('break:esd-zap')
    const s = await run(b, 0.5)
    expect(s.status).toBe('FAULT')
    expect(s.assembly.burns.map((x) => x.elementId)).toEqual(['pin6'])
    expect(s.statusLine.text).toMatch(/ESD/)
    // a dead pin, not a charred board
    expect(s.partBurnt.uno).toBe(false)
    expect(s.values[LED]).toBeLessThan(1e-4)
    b.dispose()
  })

  it('3D: a joint part follows its published quality, and the quality is in its bake key', async () => {
    const b = await build()
    await run(b, 0.2)
    const tp2 = L.board.parts.find((p) => p.id === 'tp2')!
    const good = partState(L, tp2, b.snapshot())
    expect(good.joint).toBe(0)
    b.setTweak('behavior:solder.target', 2)
    b.setTweak('behavior:solder.tipC', 280)
    await press(b, 'go')
    const cold = partState(L, tp2, b.snapshot())
    expect(cold.joint).toBe(q('cold'))
    expect(bakeKeyOf(partRegistry.testpoint, tp2, good)).not.toBe(bakeKeyOf(partRegistry.testpoint, tp2, cold))
    // a part without jointKey is untouched
    const rl = L.board.parts.find((p) => p.id === 'r_load')!
    expect(partState(L, rl, b.snapshot()).joint).toBeUndefined()
    b.dispose()
  })
})
