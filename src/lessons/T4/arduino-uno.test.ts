import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson, pinned } from '../index'

const L = getLesson('arduino-uno') as Lesson
const FRAME = 1 / 60

async function runUntil(b: Bench, pred: (s: BenchSnapshot) => boolean, maxSim = 3): Promise<BenchSnapshot> {
  const t0 = b.t
  for (;;) {
    await b.frame(FRAME)
    const s = b.snapshot()
    if (pred(s)) return s
    if (b.t - t0 > maxSim) throw new Error(`condition not reached in ${maxSim}s (status ${s.status}: ${s.statusLine.text})`)
  }
}
const frames = async (b: Bench, n: number) => {
  for (let i = 0; i < n; i++) await b.frame(FRAME)
}

/** readout value by label */
const val = (s: BenchSnapshot, label: string) => s.values[L.readouts.findIndex((r) => r.label === label)]
const within = (x: number, target: number, tol = 0.15) => expect(Math.abs(x - target)).toBeLessThanOrEqual(Math.abs(target) * tol)

function running(): Bench {
  const b = createBench(L)
  b.dispatch('power')
  b.upload()
  return b
}

describe('T4 arduino-uno', () => {
  it('validates, is pinned "Start here" and is Fig. 01', () => {
    expect(validateLesson(L)).toEqual([])
    expect(pinned).toEqual(['arduino-uno'])
    expect(L.fig).toBe(1)
  })

  it('strips to a bare PCB, then pick-and-place, hand placement and solder rebuild it', () => {
    const b = createBench(L)
    b.dispatch('strip')
    let s = b.snapshot()
    expect(s.status).toBe('BARE PCB')
    expect(s.smdPlaced).toBe(false)
    b.dispatch('pick-place')
    s = b.snapshot()
    expect(s.smdPlaced).toBe(true)
    const smd = L.board.parts.filter((p) => p.mount === 'smd').map((p) => p.id)
    expect(smd).toEqual(expect.arrayContaining(['u1', 'u2', 'u3', 'u4', 'u5', 'q1', 'f1', 'y2', 'c3', 'led_l']))
    expect(s.remaining.map((p) => p.id)).toEqual(expect.arrayContaining(['j1', 'j2', 'c1', 'c2', 'h_dig_hi', 'y1', 'bb', 'pot']))
    b.dispatch('place-all')
    expect(b.snapshot().status).toBe('ASSEMBLING') // placed, not yet soldered
    b.dispatch('power')
    expect(b.snapshot().powered).toBe(false)
    b.dispatch('solder')
    expect(b.snapshot().status).toBe('READY')
  })

  it('powers up at ≈ 4.96 V, A0 at 2.49 V reads ≈ 510, and the board draws ≈ 65 mA with L and the fade LED on', async () => {
    const b = running()
    const s = await runUntil(b, (x) => x.serial.includes('Uno tour ready'))
    await frames(b, 3)
    let t = b.snapshot()
    expect(t.status).toBe('RUNNING')
    within(val(t, '5V RAIL'), 4.96, 0.02)
    within(val(t, 'A0'), 2.49, 0.02)
    expect(s.statusLine.text).toMatch(/L blinks at 1 Hz/)
    expect(s.serial).toEqual(['Uno tour ready']) // no phantom press while the pull-up comes up
    // ≈ 45 mA board + 3 mA ON LED + 0.5 mA pot through the polyfuse. The curriculum's ≈ 65 mA also
    // counts L and the fade LED at full duty, but the engine sources pin loads from the PIN's ideal
    // rail (see the pin9 note in the lesson), so they don't show in USB CURRENT.
    b.setTweak('behavior:knob.turn', 100)
    await runUntil(b, (x) => x.pins[13]?.level === 1 && val(x, 'FADE LED') > 0.01)
    await frames(b, 2)
    t = b.snapshot()
    within(val(t, 'USB CURRENT'), 0.045 + 0.003 + 0.0005)
    within(val(t, 'USB CURRENT') + val(t, 'L LED') + val(t, 'FADE LED'), 0.065) // the curriculum's total
    within(val(t, '5V RAIL'), 4.96, 0.02)
    // the board's own LEDs: ON ≈ 3 mA, and the curriculum's 5 V/(1 kΩ) class of current
    expect(t.current.led_on).toBeGreaterThan(0.002)
    expect(t.current.led_on).toBeLessThan(0.0035)
    b.dispose()
  })

  it('L blinks at 1 Hz (500 ms on, 500 ms off) through the op-amp buffer at ≈ 3 mA', async () => {
    const b = running()
    const high = (x: BenchSnapshot) => x.pins[13]?.mode === 'OUTPUT' && x.pins[13].level === 1
    const low = (x: BenchSnapshot) => x.pins[13]?.mode === 'OUTPUT' && x.pins[13].level === 0
    await runUntil(b, high)
    await frames(b, 2)
    within(val(b.snapshot(), 'L LED'), 0.003, 0.2)
    await runUntil(b, low)
    const tOff = b.t
    await frames(b, 1)
    expect(val(b.snapshot(), 'L LED')).toBeLessThan(1e-6)
    await runUntil(b, high)
    within(b.t - tOff, 0.5, 0.1)
    b.dispose()
  })

  it('the pot sets the PWM duty on pin 9: 50 % → 2.5 V average, 25 % → 1.25 V, full → ≈ 13 mA in the LED', async () => {
    const b = running()
    await frames(b, 20)
    let s = b.snapshot()
    within(val(s, 'PIN 9 AVG'), (127 / 255) * 5, 0.15) // a little under: the LED current drops across the pin's 25 Ω
    b.setTweak('behavior:knob.turn', 25)
    await frames(b, 10)
    s = b.snapshot()
    within(val(s, 'A0'), 1.25, 0.02)
    within(val(s, 'PIN 9 AVG'), 1.25, 0.12)
    b.setTweak('behavior:knob.turn', 100)
    await frames(b, 10)
    s = b.snapshot()
    within(val(s, 'FADE LED'), 0.013) // (5 − 1.8)/(220 + 25)
    within(val(s, 'PIN 9 AVG'), 5 - 25 * val(s, 'FADE LED'), 0.02) // 5 V minus the drop in the pin's 25 Ω
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('a press reads LOW through the pull-up and the sketch reports raw and volts over Serial', async () => {
    const b = running()
    b.setTweak('behavior:knob.turn', 60)
    await runUntil(b, (x) => x.serial.includes('Uno tour ready'))
    await frames(b, 5)
    b.setTweak('sw_btn.closed', 1)
    const s = await runUntil(b, (x) => x.serial.some((l) => l.startsWith('press raw:')), 1)
    await frames(b, 2)
    const t = b.snapshot()
    const line = s.serial.find((l) => l.startsWith('press raw:'))!
    expect(line).toMatch(/^press raw:\d+,volts:\d\.\d\d$/)
    const raw = Number(/raw:(\d+)/.exec(line)![1])
    within(raw, 614, 0.02) // 60 % of 5 V = 3.0 V → 614
    expect(t.published['serial.raw']).toBe(raw)
    within(t.published['serial.volts'], 3.0, 0.02)
    within(val(t, 'PULL-UP I'), 5 / 35e3, 0.1) // ≈ 0.14 mA through the internal pull-up
    expect(t.statusLine.text).toMatch(/Button down: pin 2 reads LOW/)
    expect(t.pins[2].mode).toBe('INPUT_PULLUP')
    b.dispose()
  })

  it('the fade resistor tweak changes the LED current: 470 Ω → ≈ 6.4 mA at full duty', async () => {
    const b = running()
    b.setTweak('behavior:knob.turn', 100)
    b.setTweak('r_ext.value', 470)
    await frames(b, 15)
    within(val(b.snapshot(), 'FADE LED'), 3.2 / 495)
    b.dispose()
  })

  it('F1: a motor straight off pin 9 kills the pin within ≈ 300 ms', async () => {
    const b = running()
    b.setTweak('behavior:knob.turn', 100)
    await frames(b, 10)
    b.dispatch('break:motor-on-pin')
    const t0 = b.t
    await frames(b, 1)
    within(Math.abs(b.snapshot().current.pin9), 5 / 29, 0.15) // ≈ 170 mA into the stalled motor
    const s = await runUntil(b, (x) => x.assembly.burns.some((y) => y.elementId === 'pin9'), 1)
    expect(b.t - t0).toBeLessThan(0.5)
    const burn = s.assembly.burns.find((y) => y.elementId === 'pin9')!
    expect(burn.value).toBeGreaterThan(0.04) // still past 40 mA as the motor's back-EMF builds
    expect(s.partVisible).toMatchObject({ r_ext: false, motor: true })
    expect(s.status).toBe('FAULT')
    b.dispose()
  })

  it('F2: bypassing the 220 Ω burns the LED and the pin (≈ 100 mA)', async () => {
    const b = running()
    b.setTweak('behavior:knob.turn', 100)
    await frames(b, 10)
    b.dispatch('break:bypass-resistor')
    await frames(b, 1)
    within(b.snapshot().current.led_ext, 0.1, 0.35)
    const s = await runUntil(b, (x) => x.assembly.burns.length >= 2, 1)
    expect(s.assembly.burns.map((x) => x.elementId).sort()).toEqual(['led_ext', 'pin9'])
    expect(s.partBurnt.led_ext).toBe(true)
    b.dispatch('repair')
    await frames(b, 20)
    expect(b.snapshot().status).toBe('RUNNING')
    b.dispose()
  })

  it('F3: a 5V–GND short draws ≈ 8 A, blows the polyfuse, drops the rail and holds the MCU in reset', async () => {
    const b = running()
    await frames(b, 10)
    b.dispatch('break:short-5v')
    await frames(b, 1)
    within(val(b.snapshot(), 'USB CURRENT'), 5 / 0.6, 0.1)
    const s = await runUntil(b, (x) => x.assembly.burns.some((y) => y.elementId === 'f1'), 0.6)
    expect(s.assembly.burns.find((y) => y.elementId === 'f1')!.reason).toBe('blown')
    await frames(b, 5)
    const t = b.snapshot()
    expect(val(t, '5V RAIL')).toBeLessThan(0.05)
    expect(t.published['mcu.held']).toBe(1)
    expect(val(t, 'BROWN-OUTS')).toBe(1)
    expect(t.statusLine.text).toMatch(/blew/)
    // Repair all: the fuse "cools", the rail returns and the sketch boots again
    b.dispatch('repair')
    await runUntil(b, (x) => x.serial.includes('Uno tour ready') && x.published['mcu.held'] === 0, 2)
    expect(val(b.snapshot(), '5V RAIL')).toBeGreaterThan(4.9)
    b.dispose()
  })

  it('F4: 12 V on the 5V pin destroys the 328P at once', async () => {
    const b = running()
    await frames(b, 10)
    b.dispatch('break:12v-into-5v')
    const s = await runUntil(b, (x) => x.assembly.burns.some((y) => y.elementId === 'i_board'), 0.1)
    const burn = s.assembly.burns.find((y) => y.elementId === 'i_board')!
    expect(burn.reason).toBe('overvoltage')
    expect(burn.value).toBeGreaterThan(6)
    expect(s.partBurnt.u1).toBe(true)
    expect(s.partVisible.psu).toBe(true)
    b.dispose()
  })
})
