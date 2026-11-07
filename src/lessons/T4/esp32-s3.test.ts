import { describe, expect, it } from 'vitest'
import { createBench, type Bench, type BenchSnapshot } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import { getLesson } from '../index'

const lesson = getLesson('esp32-s3')!
const FRAME = 1 / 60

/** readout indices */
const RAIL = 0
const MODULE = 1
const G4 = 2
const LED = 3
const POT = 4
const RSSI = 5

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
    if (b.t - t0 > maxSim) throw new Error(`condition not reached in ${maxSim}s of sim time (t=${b.t})`)
  }
}

async function runFor(b: Bench, seconds: number): Promise<BenchSnapshot> {
  for (let i = 0; i < Math.ceil(seconds / FRAME); i++) await b.frame(FRAME)
  return b.snapshot()
}

/** the bench flow from a bare board to a running sketch */
function build(): Bench {
  const b = createBench(lesson)
  b.dispatch('strip')
  expect(b.snapshot().status).toBe('BARE PCB')
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
const connected = (s: BenchSnapshot) => s.published['wifi.wifi_state'] === 2

describe('esp32-s3 lesson', () => {
  it('validates, and its sketch loads with no MCU warnings', async () => {
    expect(validateLesson(lesson)).toEqual([])
    const b = build()
    const s = await runFor(b, 0.3)
    expect(s.sketchError).toBeNull()
    expect(s.serial.filter((l) => l.startsWith('[mcu]'))).toEqual([])
    b.dispose()
  })

  it('boots, connects to WiFi, prints its IP and reports core 1, RSSI, pot and the divided signal', async () => {
    const b = build()
    let s = await runUntil(b, (x) => x.serial.some((l) => l.startsWith('IP ')), 4)
    expect(s.sketchError).toBeNull()
    expect(s.serial[0]).toMatch(/^Connecting\.{5,8}$/) // about 1.5 s at 250 ms a dot
    expect(s.serial).toContain('IP 192.168.4.23')
    s = await runUntil(b, (x) => x.serial.some((l) => l.startsWith('core:')), 3)
    const report = s.serial.find((l) => l.startsWith('core:'))!
    const m = /^core:1,rssi:(-\d+),pot:(\d+),sig:([01])$/.exec(report)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBeGreaterThanOrEqual(-58)
    expect(Number(m![1])).toBeLessThanOrEqual(-52)
    within(Number(m![2]), 3481) // pot at 85 %: 2.805 V of 3.3 V on a 12-bit ADC
    expect(s.statusLine.text).toBe('RUNNING: loop() on core 1, WiFi on core 0, RGB cycling.')
    // the divided signal reads as a clean digital level, both ways, over a few reports
    s = await runFor(b, 4.5)
    const sigs = new Set(s.serial.filter((l) => l.startsWith('core:')).map((l) => l.slice(-1)))
    expect([...sigs].sort()).toEqual(['0', '1'])
    b.dispose()
  })

  it('readouts: 3.3 V rail, 3.33 V on GPIO4, 2.8 V pot (85 %), about 100 mA module current and -55 dBm', async () => {
    const b = build()
    let s = await runUntil(b, connected, 4)
    within(s.values[RAIL], 3.3)
    within(s.values[POT], 2.805)
    s = await runUntil(b, sigHigh, 2)
    await b.frame(FRAME)
    s = b.snapshot()
    within(s.values[G4], 3.33) // 5 × 20/30
    within(s.values[RSSI], -55, 0.06)
    // the module current averages 100 mA once connected (frames with a TX burst read higher)
    let sum = 0
    for (let i = 0; i < 60; i++) sum += (await runFor(b, FRAME)).values[MODULE]
    within(sum / 60, 100)
    // the 5 V signal's low half: GPIO4 reads 0 V
    s = await runUntil(b, (x) => !sigHigh(x), 2)
    await b.frame(FRAME)
    expect(b.snapshot().values[G4]).toBeLessThan(0.05)
    b.dispose()
  })

  it('GPIO5 LED at full pot: (3.3 − 1.8)/(150 + 25) ≈ 8.6 mA, and brightness follows the pot', async () => {
    const b = build()
    b.setTweak('pot.pos', 1)
    await runUntil(b, connected, 4)
    let s = await runFor(b, 0.2)
    within(s.values[LED], 0.0086)
    // the bench averages PWM as a voltage, so a lower duty dims the LED (more steeply than real PWM)
    b.setTweak('pot.pos', 0.75)
    s = await runFor(b, 0.2)
    expect(s.values[LED]).toBeLessThan(0.0086 * 0.8)
    expect(s.values[LED]).toBeGreaterThan(0)
    b.setTweak('pot.pos', 0)
    s = await runFor(b, 0.2)
    expect(s.values[LED]).toBeLessThan(1e-5)
    b.dispose()
  })

  it('the RGB LED blinks amber while connecting, then cycles dim colours (max about 50)', async () => {
    const b = build()
    let s = await runFor(b, 0.06)
    expect([s.published['ws2812.rgb_r'], s.published['ws2812.rgb_g'], s.published['ws2812.rgb_b']]).toEqual([40, 20, 0])
    await runUntil(b, connected, 4)
    const seen = new Set<string>()
    let max = 0
    for (let i = 0; i < 40; i++) {
      s = await runFor(b, 0.1)
      const c = [s.published['ws2812.rgb_r'], s.published['ws2812.rgb_g'], s.published['ws2812.rgb_b']]
      seen.add(c.join(','))
      max = Math.max(max, ...c)
    }
    expect(seen.size).toBeGreaterThan(10)
    expect(max).toBeLessThanOrEqual(50)
    expect(s.elementValues['i_rgb.value']).toBeLessThan(0.036 * (100 / 765) + 1e-9)
    b.dispose()
  })

  it('a divider bottom above about 26 kΩ lifts GPIO4 past 3.6 V and warns about the clamp', async () => {
    const b = build()
    await runUntil(b, connected, 4)
    await runUntil(b, (x) => !sigHigh(x), 2)
    b.setTweak('r_dbot.value', 30_000)
    const s = await runUntil(b, sigHigh, 2)
    await b.frame(FRAME)
    const s2 = b.snapshot()
    expect(s2.values[G4]).toBeGreaterThan(3.6) // 5 × 30/40 = 3.75 V
    expect(s2.values[G4]).toBeLessThan(3.8)
    expect(s2.statusLine.text).toMatch(/GPIO4 is above VDD \+ 0\.3 V/)
    expect(s.status).toBe('RUNNING')
    b.dispose()
  })

  it('F1: 5 V straight into GPIO4 clamps it near 4.2 V through the ESD diode, which burns, and GPIO4 dies', async () => {
    const b = build()
    await runUntil(b, connected, 4)
    await runUntil(b, (x) => !sigHigh(x), 2)
    b.dispatch('break:direct-5v')
    let s = await runUntil(b, sigHigh, 2)
    await b.frame(FRAME)
    s = b.snapshot()
    expect(s.values[G4]).toBeGreaterThan(4.0)
    expect(s.values[G4]).toBeLessThan(4.4)
    within(s.current['d_esd'], 0.008, 0.2) // (5 − 4.2)/100
    expect(s.partVisible['j_direct']).toBe(true)
    expect(s.partVisible['r_dtop']).toBe(false)
    // the clamp burns once it has carried more than 5 mA for 300 ms (inside one 1 s high half of the 0.5 Hz signal)
    s = await runUntil(b, (x) => x.status === 'FAULT', 2)
    expect(s.assembly.burns.map((x) => x.elementId)).toEqual(['d_esd'])
    expect(s.statusLine.text).toMatch(/^FAULT: d_esd .*burnt.*GPIO4 is dead/)
    expect(s.partBurnt['u1']).toBe(true)
    // shorted clamp: GPIO4 is stuck at the rail and reads HIGH through the signal's low half
    s = await runUntil(b, (x) => !sigHigh(x), 2)
    await b.frame(FRAME)
    within(b.snapshot().values[G4], 3.3, 0.05)
    s = await runFor(b, 1.2)
    const reports = s.serial.filter((l) => l.startsWith('core:'))
    expect(reports.at(-1)).toMatch(/sig:1$/)
    b.dispose()
  })

  it('F2: an LED with no resistor pulls about 50 mA and kills GPIO5', async () => {
    const b = build()
    b.setTweak('pot.pos', 1)
    await runUntil(b, connected, 4)
    await runFor(b, 0.1)
    b.dispatch('break:no-resistor')
    await b.frame(FRAME)
    let s = b.snapshot()
    within(Math.abs(s.current['pin5']), 0.05, 0.2) // (3.3 − 2.0)/25
    s = await runUntil(b, (x) => x.status === 'FAULT', 1)
    expect(s.assembly.burns.map((x) => x.elementId)).toContain('pin5')
    b.dispose()
  })

  it('F3: GPIO0 held low at power-up: "waiting for download", no sketch, RGB dark, radio off', async () => {
    const b = createBench(lesson)
    b.dispatch('break:boot-held')
    b.dispatch('power')
    b.upload()
    const s = await runFor(b, 2)
    expect(s.serial.at(-1)).toBe('waiting for download')
    expect(s.serial.some((l) => l.startsWith('Connecting'))).toBe(false)
    expect(s.published['boot.boot_mode']).toBe(1)
    expect(s.published['ws2812.rgb_r'] + s.published['ws2812.rgb_g'] + s.published['ws2812.rgb_b']).toBe(0)
    expect(s.published['wifi.wifi_state']).toBe(0)
    within(s.values[MODULE], 45)
    expect(s.values[RSSI]).toBe(0)
    b.dispose()
  })
})
