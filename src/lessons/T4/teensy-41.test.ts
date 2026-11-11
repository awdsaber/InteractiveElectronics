import { describe, expect, it } from 'vitest'
import { createBench, type Bench, type BenchSnapshot } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import { getLesson } from '../index'

const lesson = getLesson('teensy-41')!
const FRAME = 1 / 60

/** readout indices */
const RAIL = 0
const VIN = 1
const P23 = 2
const LED = 3
const POT = 4
const USB = 5

const within = (v: number, target: number, tol = 0.15) => {
  expect(v).toBeGreaterThan(target - Math.abs(target) * tol)
  expect(v).toBeLessThan(target + Math.abs(target) * tol)
}

async function runUntil(b: Bench, pred: (s: BenchSnapshot) => boolean, maxSim = 5): Promise<BenchSnapshot> {
  const t0 = b.t
  for (;;) {
    await b.frame(FRAME)
    const s = b.snapshot()
    if (pred(s)) return s
    if (b.t - t0 > maxSim) throw new Error(`condition not reached in ${maxSim}s of sim time (t=${b.t}); values ${s.values.join(', ')}`)
  }
}

async function runFor(b: Bench, seconds: number): Promise<BenchSnapshot> {
  for (let i = 0; i < Math.ceil(seconds / FRAME); i++) await b.frame(FRAME)
  return b.snapshot()
}

function build(): Bench {
  const b = createBench(lesson)
  b.dispatch('strip')
  b.dispatch('pick-place')
  b.dispatch('place-all')
  b.dispatch('solder')
  expect(b.snapshot().status).toBe('READY')
  b.dispatch('power')
  expect(b.snapshot().status).toBe('POWERED')
  b.upload()
  expect(b.snapshot().status).toBe('RUNNING')
  return b
}

const sigHigh = (s: BenchSnapshot) => s.elementValues['v_sig.value'] === 5

describe('teensy-41 lesson', () => {
  it('validates, sits after esp32-s3 in T4, and its sketch loads with no MCU warnings', async () => {
    expect(validateLesson(lesson)).toEqual([])
    expect(lesson.sketch!.board).toBe('teensy41')
    const b = build()
    const s = await runFor(b, 0.3)
    expect(s.sketchError).toBeNull()
    expect(s.serial.filter((l) => l.startsWith('[mcu]'))).toEqual([])
    b.dispose()
  })

  it('reports the 12-bit pot reading, duty and the divided signal; pin 13 blinks', async () => {
    const b = build()
    const s = await runUntil(b, (x) => x.serial.length >= 4, 3)
    const m = /^pot:(\d+),duty:([\d.]+),sig:([01])$/.exec(s.serial[0])
    expect(m, s.serial[0]).not.toBeNull()
    within(Number(m![1]), 2048, 0.03) // pot at 50 %: 1.65 V of 3.3 V on a 12-bit ADC
    within(Number(m![2]), 50, 0.03)
    const s2 = await runFor(b, 3)
    const sigs = new Set(s2.serial.map((l) => l.slice(-1)))
    expect([...sigs].sort()).toEqual(['0', '1'])
    const levels = new Set<number>()
    for (let i = 0; i < 60; i++) {
      await runFor(b, 0.05)
      levels.add(Math.round(b.snapshot().pins[13]?.level ?? -1))
    }
    expect([...levels].sort()).toEqual([0, 1])
    b.dispose()
  })

  it('readouts: 3.3 V rail, 5 V VIN, 3.33 V on pin 23, LED ≈ 3 mA at full pot, USB port supplying', async () => {
    const b = build()
    b.setTweak('pot.pos', 1)
    let s = await runFor(b, 0.3)
    within(s.values[RAIL], 3.3, 0.03)
    within(s.values[VIN], 5, 0.05)
    within(s.values[POT], 3.3, 0.03)
    within(s.values[LED], 0.003) // (3.3 − 1.8)/(470 + 25)
    expect(s.values[USB]).toBeGreaterThan(0.08) // the board's 100 mA, from the computer
    s = await runUntil(b, sigHigh, 3)
    await b.frame(FRAME)
    within(b.snapshot().values[P23], 3.33, 0.05)
    // half pot: duty-weighted PWM halves the average LED current
    b.setTweak('pot.pos', 0.5)
    s = await runFor(b, 0.3)
    within(s.values[LED], 0.0015, 0.2)
    b.dispose()
  })

  it('a smaller LED resistor passes PJRC\'s 4 mA and the status line warns', async () => {
    const b = build()
    b.setTweak('pot.pos', 1)
    b.setTweak('r_led.value', 220)
    const s = await runFor(b, 0.3)
    expect(s.values[LED]).toBeGreaterThan(0.004)
    expect(s.statusLine.text).toMatch(/4 mA/)
    expect(s.status).toBe('RUNNING')
    b.dispose()
  })

  it('failure direct-5v: pin 23 clamped about a diode drop above 3.3 V, the clamp burns, pin 23 is stuck at the rail', async () => {
    const b = build()
    await runUntil(b, (x) => !sigHigh(x), 3)
    b.dispatch('break:direct-5v')
    let s = await runUntil(b, sigHigh, 3)
    await b.frame(FRAME)
    s = b.snapshot()
    expect(s.values[P23]).toBeGreaterThan(3.8)
    expect(s.values[P23]).toBeLessThan(4.4)
    expect(s.current['d_esd']).toBeGreaterThan(0.005)
    expect(s.partVisible['j_direct']).toBe(true)
    s = await runUntil(b, (x) => x.status === 'FAULT', 2)
    expect(s.assembly.burns.map((x) => x.elementId)).toEqual(['d_esd'])
    expect(s.partBurnt['u1']).toBe(true)
    s = await runUntil(b, (x) => !sigHigh(x), 3)
    await b.frame(FRAME)
    within(b.snapshot().values[P23], 3.3, 0.05)
    b.dispose()
  })

  it('failure no-resistor: about 50 mA, pin 22 burns', async () => {
    const b = build()
    b.setTweak('pot.pos', 1)
    await runFor(b, 0.2)
    b.dispatch('break:no-resistor')
    await b.frame(FRAME)
    let s = b.snapshot()
    within(Math.abs(s.current['pin22']), 0.05, 0.25) // (3.3 − 2.0)/25
    s = await runUntil(b, (x) => x.status === 'FAULT', 2)
    expect(s.assembly.burns.map((x) => x.elementId)).toContain('pin22')
    b.dispose()
  })

  it('failure vin-backfeed: current flows into the USB port until the pads are cut', async () => {
    const b = build()
    b.dispatch('break:vin-backfeed')
    let s = await runFor(b, 0.3)
    expect(s.values[USB]).toBeLessThan(-0.1)
    expect(s.statusLine.text).toMatch(/backwards/)
    b.setTweak('vin_trace.closed', 0)
    s = await runFor(b, 0.3)
    expect(Math.abs(s.values[USB])).toBeLessThan(0.001)
    within(s.values[RAIL], 3.3, 0.03)
    within(s.values[VIN], 5.2, 0.03)
    expect(s.status).toBe('RUNNING')
    b.dispose()
  })

  it('cutting the pads with no external supply kills the 3.3 V rail and holds the MCU', async () => {
    const b = build()
    await runFor(b, 0.2)
    b.setTweak('vin_trace.closed', 0)
    const s = await runFor(b, 0.3)
    expect(s.values[RAIL]).toBeLessThan(0.5)
    expect(s.published['mcu.held']).toBe(1)
    b.dispose()
  })
})
