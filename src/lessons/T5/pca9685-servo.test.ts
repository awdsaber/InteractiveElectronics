import { describe, expect, it } from 'vitest'
import { usToDeg } from '../../engine/behaviors/pca9685'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { partState } from '../../three/Board'
import { lesson as def } from './pca9685-servo'

const lesson: Lesson = { ...def, fig: def.fig ?? 8 }
const FRAME = 1 / 60

// readout indices
const FREQ = 0
const PULSE = 1
const ANGLE = 2
const VPLUS = 3
const SERVO_A = 4
const UNO5V = 5
const NACKS = 6

/** within ±15 % of the curriculum's number */
const near = (v: number, want: number) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * 0.15)

function build(opts: { psu?: boolean; code?: string; failure?: string; tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(lesson, { tweaks: opts.tweaks })
  b.dispatch('pick-place')
  b.dispatch('place-all')
  b.dispatch('solder')
  b.dispatch('power')
  if (opts.psu !== false) b.dispatch('power:psu_sw')
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  b.upload(opts.code)
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

const pub = (s: BenchSnapshot, k: string) => s.published[`pca9685.${k}`] ?? 0

/** setup() centres ch0 only, then the loop idles: a steady 1.5 ms command */
const centre = (osc = '25000000', addr = '0x40') => `
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver(${addr});
void setup() {
  Serial.begin(115200);
  Wire.begin();
  pwm.begin();
  pwm.setOscillatorFrequency(${osc});
  pwm.setPWMFreq(50);
  Serial.println(pwm.setPWM(0, 0, 307));
}
void loop() { delay(20); }
`

describe('T5 pca9685-servo lesson', () => {
  it('validates, runs the walking wave and prints the 307-count centre', async () => {
    expect(validateLesson(lesson)).toEqual([])
    const b = build()
    const s = await run(b, 0.5)
    expect(s.sketchError).toBeNull()
    expect(s.status).toBe('RUNNING')
    expect(s.serial).toContain('1.5 ms = 307 ticks')
    b.dispose()
  })

  it('prescale 121 makes a 50.03 Hz frame; setup centres each servo at about 1.5 ms / 90°', async () => {
    const b = build()
    const s = await run(b, 1.1)
    expect(pub(s, 'prescale')).toBe(121)
    near(s.values[FREQ], 50.03)
    expect(s.values[FREQ]).toBeCloseTo(50.03, 2)
    near(s.values[PULSE], 1.5e-3)
    near(s.values[ANGLE], 90)
    expect(s.values[ANGLE]).toBeCloseTo(89.8, 0)
    for (const n of [0, 1, 2]) near(pub(s, `ch${n}_deg`), 90)
    expect(pub(s, 'i2c_errors')).toBe(0)
    near(s.values[VPLUS], 5)
    near(s.values[UNO5V], 5)
    // the 3D horns follow the published angle
    const s0 = lesson.board.parts.find((p) => p.id === 's0')!
    expect(partState(lesson, s0, s).value).toBeCloseTo(pub(s, 'ch0_deg'), 6)
    b.dispose()
  })

  it('each centring move starts with a ~0.65 A surge; the wave then sweeps 45..135°', async () => {
    const b = build()
    let peak = 0
    let total = 0
    await run(b, 1.2, (s) => {
      peak = Math.max(peak, pub(s, 'ch0_A'))
      total = Math.max(total, s.values[SERVO_A])
    })
    near(peak, 0.65)
    // the last servo's surge on top of three holding servos
    near(total, 0.65 + 3 * 0.2)
    let lo = 180
    let hi = 0
    let iSum = 0
    let n = 0
    await run(b, 0.5) // the loop's first frame jumps each servo to its wave phase: surges
    await run(b, 2.5, (s) => {
      lo = Math.min(lo, s.values[ANGLE])
      hi = Math.max(hi, s.values[ANGLE])
      iSum += s.values[SERVO_A]
      n++
    })
    near(lo, 45)
    near(hi, 135)
    // holding a small arm on each horn (0.3 × stall torque) is about 0.2 A per servo; each
    // 1.8° step every 20 ms adds a short drive pulse on top: about 1.3 A for the four in total
    expect(iSum / n).toBeGreaterThan(4 * 0.205)
    expect(iSum / n).toBeLessThan(1.5)
    b.dispose()
  })

  it('the servo current really comes from V+: the PSU sags by I × R', async () => {
    const b = build({ tweaks: { 'psu.rInternal': 1 } })
    const s = await run(b, 3)
    const i = s.values[SERVO_A]
    expect(i).toBeGreaterThan(0.5)
    // the bulk capacitor carries the ripple, so V+ follows the average draw within 0.15 V
    expect(Math.abs(s.values[VPLUS] - (5 - i * 1))).toBeLessThan(0.15)
    expect(s.statusLine.text).toMatch(/sagging/)
    b.dispose()
  })

  it('a 26.5 MHz real oscillator runs the frame 6 % fast and every pulse 6 % short', async () => {
    const b = build({ code: centre(), tweaks: { 'behavior:pca9685.oscActual': 26.5e6 } })
    const s = await run(b, 1)
    near(s.values[FREQ], 53.03)
    expect(s.values[FREQ]).toBeCloseTo(53.03, 1)
    expect(s.values[PULSE] / 1.4984e-3).toBeCloseTo(0.943, 2)
    expect(s.values[ANGLE]).toBeCloseTo(usToDeg(1413.6), 0) // about 8° short of 90
    b.dispose()
  })

  it('with the servo PSU off the pulses run but the servos stay where they are', async () => {
    const b = build({ psu: false })
    const s = await run(b, 1)
    expect(s.values[PULSE]).toBeGreaterThan(1e-3)
    expect(pub(s, 'ch0_deg')).toBe(20)
    expect(s.values[VPLUS]).toBeLessThan(0.1)
    expect(s.statusLine.text).toMatch(/servo PSU is off/)
    b.dispose()
  })

  it('raw Wire: the register writes the library makes, and a NACK from the wrong address', async () => {
    const code = `
#include <Wire.h>
void w8(int reg, int v) { Wire.beginTransmission(0x40); Wire.write(reg); Wire.write(v); Wire.endTransmission(); }
void setup() {
  Serial.begin(115200);
  Wire.begin();
  w8(0x00, 0x10);          // MODE1: sleep
  w8(0xFE, 121);           // PRE_SCALE
  w8(0x00, 0x20);          // wake, auto-increment
  Wire.beginTransmission(0x40);
  Wire.write(0x06);        // LED0_ON_L
  Wire.write(0); Wire.write(0); Wire.write(307 & 0xFF); Wire.write(307 >> 8);
  Serial.println(Wire.endTransmission());
  Wire.beginTransmission(0x41);
  Wire.write(0x00);
  Serial.println(Wire.endTransmission());
}
void loop() { delay(20); }
`
    const b = build({ code })
    const s = await run(b, 0.6)
    expect(s.serial).toEqual(['0', '2'])
    expect(pub(s, 'ch0_us')).toBeCloseTo(1498, 0)
    expect(pub(s, 'i2c_errors')).toBe(1)
    b.dispose()
  })

  it('F1 servos on the Uno 5 V: the rail sags, the polyfuse trips and the Uno boot-loops', async () => {
    const b = build({ failure: 'servos-on-uno-5v' })
    let sagMin = 9
    let vMin = 9
    let trips = 0
    let resets = 0
    let wasOff = false
    let hadPulse = false
    await run(b, 8, (s) => {
      const v = s.values[UNO5V]
      vMin = Math.min(vMin, v)
      if (v > 3) sagMin = Math.min(sagMin, v)
      const off = s.assembly.disabled.includes('f1')
      if (off && !wasOff) trips++
      wasOff = off
      const pulse = pub(s, 'ch0_us') > 0
      if (hadPulse && !pulse) resets++
      hadPulse = pulse
    })
    near(sagMin, 4.3)
    expect(vMin).toBeLessThan(2.7)
    expect(trips).toBeGreaterThanOrEqual(2)
    expect(resets).toBeGreaterThanOrEqual(2)
    expect(b.snapshot().statusLine.text).toMatch(/^BROKEN: .*boot loop/)
    b.dispose()
  })

  it('F2 no common ground: V+ is fine but the servos twitch at random', async () => {
    const b = build({ failure: 'no-common-gnd' })
    await run(b, 1.5)
    const seen = new Set<number>()
    const s = await run(b, 2, (x) => seen.add(Math.round(pub(x, 'ch3_deg') / 15)))
    expect(pub(s, 'gnd_ok')).toBe(0)
    near(s.values[VPLUS], 5)
    expect(s.values[PULSE]).toBeGreaterThan(0)
    expect(seen.size).toBeGreaterThan(5)
    b.dispose()
  })

  it('F3 no pull-ups: SDA/SCL near 0 V, every call NACKs and the servos never move', async () => {
    const b = build({ failure: 'no-pullups' })
    const s = await run(b, 1.5)
    expect(s.values[NACKS]).toBeGreaterThan(5)
    expect(s.values[PULSE]).toBe(0)
    expect([0, 1, 2, 3].map((n) => pub(s, `ch${n}_deg`))).toEqual([20, 160, 45, 135])
    b.dispose()
  })

  it('F4 the A0 jumper bridged: the board answers at 0x41 and the sketch at 0x40 gets NACKs', async () => {
    let b = build({ failure: 'addr-jumper', code: centre() })
    let s = await run(b, 0.5)
    expect(pub(s, 'addr')).toBe(0x41)
    expect(s.serial).toEqual(['2'])
    expect(s.values[PULSE]).toBe(0)
    b.dispose()
    b = build({ failure: 'addr-jumper', code: centre('25000000', '0x41') })
    s = await run(b, 0.5)
    expect(s.serial).toEqual(['0'])
    expect(s.values[PULSE]).toBeGreaterThan(1e-3)
    b.dispose()
  })
})
