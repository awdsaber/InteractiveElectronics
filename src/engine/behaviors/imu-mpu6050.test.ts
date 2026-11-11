import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../bench/simLoop'
import type { Behavior, BehaviorRef, Lesson } from '../types'
import { behavior as imu, complementaryTau } from './imu-mpu6050'

const FRAME = 1 / 60

/** a minimal Uno + GY-521 bench: 5 V → LDO → 3V3, pull-ups, AD0 pull-down, a switchable shaker */
function imuLesson(code: string, behaviors: BehaviorRef[] = [{ id: 'imu-mpu6050', instance: 'imu' }]): Lesson {
  return {
    id: 'imu-fixture',
    fig: 1,
    track: 'T6',
    title: 'IMU fixture',
    subtitle: 'test',
    tagline: 'test',
    board: { name: 'FX', size: [8, 4], base: 'breadboard-only', parts: [{ id: 'uno', kind: 'module', pos: [0, 0], mount: 'module', role: 'board' }] },
    circuit: {
      elements: [
        { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5, rInternal: 0.3 },
        { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', '5v'], closed: false },
        { id: 'ldo', type: 'OPAMP', nodes: ['5v', '3v3', '3v3'], vPos: 3.3, vNeg: 0 },
        { id: 'i_mpu', type: 'I', nodes: ['3v3', '0'], value: 0.0039 },
        { id: 'r_sda', type: 'R', nodes: ['3v3', 'sda'], value: 4700 },
        { id: 'r_scl', type: 'R', nodes: ['3v3', 'scl'], value: 4700 },
        { id: 'pin_sda', type: 'PIN', nodes: ['sda', '0'], pin: 18, vcc: 5 },
        { id: 'pin_scl', type: 'PIN', nodes: ['scl', '0'], pin: 19, vcc: 5 },
        { id: 'r_ad0', type: 'R', nodes: ['ad0', '0'], value: 4700 },
        { id: 'v_m', type: 'V', nodes: ['vm', '0'], value: 3.5 },
        { id: 'sw_m', type: 'SW', nodes: ['vm', 'vm2'], closed: false },
        { id: 'vib', type: 'MOTOR', nodes: ['vm2', '0'], r: 30, l: 0.0002, ke: 0.00095, j: 2e-9, b: 4e-8 },
      ],
    },
    powerElementId: 'usb_plug',
    readouts: [{ label: '3V3', source: { kind: 'voltage', node: '3v3' }, unit: 'V' }],
    sketch: { title: 'fx', code, pins: { 18: 'pin_sda', 19: 'pin_scl' }, vcc: 5, board: 'uno' },
    tweaks: [{ label: 'shaker', elementId: 'sw_m', key: 'closed', kind: 'toggle', min: 0, max: 1, unit: '' }],
    failures: [
      { id: 'no-pu', label: 'no pull-ups', explain: 'x', patches: [{ op: 'remove', elementId: 'r_sda' }, { op: 'remove', elementId: 'r_scl' }] },
      { id: 'ad0', label: 'AD0 high', explain: 'x', patches: [{ op: 'short', a: 'ad0', b: '3v3' }] },
      { id: 'warm', label: 'warm', explain: 'x', patches: [{ op: 'set', elementId: 'behavior:imu', key: 'tempC', value: 55 }] },
    ],
    meet: 'm',
    mechanicalAnalogy: 'm',
    proTips: [],
    quiz: [],
    behaviors,
    transient: true,
  }
}

const IDLE = `void setup() { } void loop() { delay(10); }`

function bench(code = IDLE, reg: Record<string, Behavior> = { 'imu-mpu6050': imu }, behaviors?: BehaviorRef[]): Bench {
  const b = createBench(imuLesson(code, behaviors), { registry: reg })
  b.dispatch('power')
  b.upload()
  return b
}

async function run(b: Bench, seconds: number, each?: (s: BenchSnapshot) => void): Promise<BenchSnapshot> {
  const end = b.t + seconds
  while (b.t < end - 1e-9) {
    await b.frame(FRAME)
    each?.(b.snapshot())
  }
  return b.snapshot()
}

const P = (s: BenchSnapshot, k: string) => s.published[`imu.${k}`] ?? NaN
const near = (v: number, want: number, rel = 0.15) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * rel)

function stats(xs: number[]) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return { mean: m, sd: Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) }
}

describe('imu-mpu6050: register-level I²C', () => {
  it('answers at 0x68 with WHO_AM_I = 0x68, starts asleep (PWR_MGMT_1 = 0x40), and 0x69 NACKs', async () => {
    const b = bench(`#include <Wire.h>
      int rd(int reg) { Wire.beginTransmission(0x68); Wire.write(reg); Wire.endTransmission(); Wire.requestFrom(0x68, 1); return Wire.read(); }
      void setup() {
        Wire.begin();
        delay(50);
        Serial.println(rd(0x75), HEX);
        Serial.println(rd(0x6B), HEX);
        Wire.beginTransmission(0x69);
        Serial.println(Wire.endTransmission());
        Wire.beginTransmission(0x68); Wire.write(0x6B); Wire.write(0); Wire.endTransmission();
        delay(50);
        Wire.beginTransmission(0x68); Wire.write(0x3F); Wire.endTransmission();
        Wire.requestFrom(0x68, 2);
        int hi = Wire.read(); int lo = Wire.read();
        int az = (hi << 8) | lo;
        Serial.println(az);
      }
      void loop() { delay(10); }`)
    const s = await run(b, 0.3)
    expect(s.sketchError).toBeNull()
    expect(s.serial.slice(0, 3)).toEqual(['68', '40', '2'])
    near(Number(s.serial[3]), 16384, 0.02)
  })

  it('the mpu object: testConnection, 1 g on Z at rest, the gyro bias in raw counts, the temperature', async () => {
    const b = bench(`#include <MPU6050.h>
      void setup() {
        mpu.initialize();
        Serial.println(mpu.testConnection());
        delay(100);
        Serial.println(mpu.getAccelerationZ());
        Serial.println(mpu.getRotationY());
        Serial.println(mpu.getTemperature());
      }
      void loop() { delay(10); }`)
    const s = await run(b, 0.3)
    expect(s.sketchError).toBeNull()
    expect(s.serial[0]).toBe('1')
    near(Number(s.serial[1]), 16384, 0.02)
    near(Number(s.serial[2]), 2.1 * 131, 0.1) // 275 counts
    near(Number(s.serial[3]), (25 - 36.53) * 340, 0.01)
  })

  it('an MPU6050 object at 0x69 does not find a chip with AD0 low; AD0 high moves the chip there', async () => {
    const code = `MPU6050 other(0x69);
      void setup() { } void loop() { Serial.print(mpu.testConnection()); Serial.print(" "); Serial.println(other.testConnection()); delay(100); }`
    const b = bench(code)
    let s = await run(b, 0.15)
    expect(s.serial.at(-1)).toBe('1 0')
    b.dispatch('break:ad0')
    s = await run(b, 0.3)
    expect(s.serial.at(-1)).toBe('0 1')
    expect(P(s, 'addr_now')).toBe(0x69)
    expect(P(s, 'i2c_ok')).toBe(0)
  })

  it('no pull-ups: the bus is dead, testConnection fails and reads return 0', async () => {
    const b = bench(`void setup() { mpu.initialize(); } void loop() { Serial.print(mpu.testConnection()); Serial.print(" "); Serial.println(mpu.getAccelerationZ()); delay(100); }`)
    let s = await run(b, 0.3)
    expect(s.serial.at(-1)?.startsWith('1 ')).toBe(true)
    b.dispatch('break:no-pu')
    s = await run(b, 0.3)
    expect(s.serial.at(-1)).toBe('0 0')
    expect(P(s, 'i2c_ok')).toBe(0)
    expect(P(s, 'pitch_filtered')).toBe(0)
  })

  it('setDLPFMode writes CONFIG and the dlpf param is applied when it changes', async () => {
    const b = bench(`void setup() { mpu.initialize(); mpu.setDLPFMode(5); } void loop() { delay(10); }`)
    let s = await run(b, 0.2)
    expect(P(s, 'dlpf')).toBe(5)
    b.setTweak('behavior:imu.dlpf', 2)
    s = await run(b, 0.1)
    expect(P(s, 'dlpf')).toBe(2)
  })
})

describe('imu-mpu6050: drift, noise, filter', () => {
  it('raw gyro integration drifts at the 2.1 °/s bias; the filtered pitch holds the true pitch', async () => {
    const b = bench()
    const s0 = await run(b, 2)
    const g0 = P(s0, 'pitch_gyro')
    const s = await run(b, 10)
    near(P(s, 'pitch_gyro') - g0, 21) // 2.1 °/s × 10 s
    expect(Math.abs(P(s, 'pitch_filtered'))).toBeLessThan(0.3)
    expect(Math.abs(P(s, 'pitch_gyro_cal'))).toBeLessThan(1)
    expect(P(s, 'gyro_bias_now')).toBeCloseTo(2.1, 6)
  })

  it('warming 30 °C after calibration: bias +0.9 °/s, calibrated gyro drifts ≈ 54 °/min, filter offset ≈ bias × τ = 0.44°', async () => {
    const b = bench()
    await run(b, 2)
    b.dispatch('break:warm')
    const s1 = await run(b, 5)
    expect(P(s1, 'gyro_bias_now')).toBeCloseTo(3.0, 6)
    const g1 = P(s1, 'pitch_gyro_cal')
    const filt: number[] = []
    const s2 = await run(b, 10, (s) => filt.push(P(s, 'pitch_filtered')))
    near((P(s2, 'pitch_gyro_cal') - g1) * 6, 54) // per minute
    expect(complementaryTau(0.98, 0.01)).toBeCloseTo(0.49, 6)
    near(stats(filt).mean, 0.9 * 0.49, 0.15)
  })

  it('accelerometer pitch is unbiased but noisier with a wider DLPF', async () => {
    const sd: Record<number, number> = {}
    for (const dl of [0, 6]) {
      const b = bench()
      b.setTweak('behavior:imu.dlpf', dl)
      b.setTweak('behavior:imu.pitchDeg', 20)
      await run(b, 1)
      const xs: number[] = []
      await run(b, 3, (s) => xs.push(P(s, 'pitch_accel')))
      const st = stats(xs)
      expect(Math.abs(st.mean - 20)).toBeLessThan(0.3)
      sd[dl] = st.sd
    }
    // σ ∝ √BW: 400 µg·√260 ≈ 6.4 mg ≈ 0.37° at DLPF 0; √(260/5) ≈ 7× less at DLPF 6
    expect(sd[0]).toBeGreaterThan(0.2)
    expect(sd[0]).toBeLessThan(0.6)
    expect(sd[0] / sd[6]).toBeGreaterThan(4)
  })

  it('the tilt tweak is slew-limited to 200 °/s and every estimate follows it', async () => {
    const b = bench()
    await run(b, 1.5)
    b.setTweak('behavior:imu.pitchDeg', 40)
    let s = await run(b, 0.1)
    expect(P(s, 'pitch_true')).toBeGreaterThan(14)
    expect(P(s, 'pitch_true')).toBeLessThan(26)
    s = await run(b, 2)
    expect(P(s, 'pitch_true')).toBe(40)
    expect(Math.abs(P(s, 'pitch_accel') - 40)).toBeLessThan(2)
    expect(Math.abs(P(s, 'pitch_filtered') - 40)).toBeLessThan(0.5)
    expect(Math.abs(P(s, 'pitch_gyro_cal') - 40)).toBeLessThan(1.5)
  })

  it('is deterministic for a given seed', async () => {
    const a = await run(bench(), 1)
    const c = await run(bench(), 1)
    expect(P(a, 'pitch_accel')).toBe(P(c, 'pitch_accel'))
    expect(P(a, 'pitch_filtered')).toBe(P(c, 'pitch_filtered'))
  })
})

describe('imu-mpu6050: shaker vibration', () => {
  it('a running shaker publishes ≈ 0.5 g rms, scrambles the accel pitch, and the filter barely moves', async () => {
    const b = bench()
    b.setTweak('behavior:imu.dlpf', 3)
    await run(b, 1.5)
    b.setTweak('sw_m.closed', 1)
    await run(b, 1)
    const acc: number[] = []
    const filt: number[] = []
    const s = await run(b, 3, (x) => {
      acc.push(P(x, 'pitch_accel'))
      filt.push(P(x, 'pitch_filtered'))
    })
    // ω = kt·V/(R·b + kt·ke) = 0.00095 × 3.5 / (30 × 4e-8 + 0.00095²) ≈ 1580 rad/s
    near(s.extra['vib.omega'], 1580, 0.05)
    near(P(s, 'vib_g'), 0.5, 0.2)
    expect(stats(acc).sd).toBeGreaterThan(1)
    expect(stats(filt).sd).toBeLessThan(stats(acc).sd / 3) // the shake reaches the filter attenuated by the DLPF and aliased by the 100 Hz loop
  })
})

describe('imu-mpu6050: true pitch from elsewhere', () => {
  it('pitchSource names another behavior’s published key', async () => {
    const robot: Behavior = {
      id: 'robot',
      tick(ctx) {
        ctx.publish('pitch', 10 * Math.sin(2 * Math.PI * 0.5 * ctx.t))
        ctx.publish('pitch_rate', 10 * 2 * Math.PI * 0.5 * Math.cos(2 * Math.PI * 0.5 * ctx.t))
      },
    }
    const b = bench(IDLE, { 'imu-mpu6050': imu, robot }, ['robot', { id: 'imu-mpu6050', instance: 'imu', params: { pitchSource: 'robot.pitch' } }])
    let maxErr = 0
    await run(b, 1.5)
    await run(b, 3, (s) => {
      maxErr = Math.max(maxErr, Math.abs(P(s, 'pitch_true') - s.published['robot.pitch']), Math.abs(P(s, 'pitch_filtered') - P(s, 'pitch_true')))
    })
    expect(maxErr).toBeLessThan(1.5)
  })

  it('perStep samples the source every solve, so a sketch reads data a step old, not a frame old', async () => {
    // the robot publishes its pitch from onStep (a ramp of 100 °/s) and a 0.2 g forward acceleration
    const robot: Behavior = {
      id: 'robot',
      onStep(ctx, t) {
        ctx.publish('pitch', 100 * t)
        ctx.publish('pitch_rate', 100)
        ctx.publish('pitch_ax_g', 0.2)
        ctx.publish('pitch_az_g', 0)
      },
    }
    // the sketch reads raw gyro Y every 2 ms and keeps the largest spread between successive reads
    const code = `#include <Wire.h>
      int last = 0; long changes = 0; long reads = 0;
      void setup() { Serial.begin(115200); mpu.initialize(); last = mpu.getAccelerationX(); }
      void loop() {
        int ax = mpu.getAccelerationX();
        reads++;
        if (ax != last) changes++;
        last = ax;
        if (reads % 100 == 0) { Serial.print("chg:"); Serial.println(changes * 100 / reads); }
        delay(2);
      }`
    const reg = { 'imu-mpu6050': imu, robot, 'serial-plotter': (await import('./serial-plotter')).behavior }
    const b = bench(code, reg, ['robot', { id: 'imu-mpu6050', instance: 'imu', params: { pitchSource: 'robot.pitch', perStep: 1, seed: 3 } }, 'serial-plotter'])
    const s = await run(b, 1)
    // the true pitch is the same step's value (ctx.readNow), not last frame's
    expect(Math.abs(P(s, 'pitch_true') - 100 * b.t)).toBeLessThan(0.2)
    // nearly every 2 ms read sees a fresh register value (a frame-latched register would repeat ~8 times)
    expect(s.published['serial-plotter.chg']).toBeGreaterThan(90)
    // the accelerometer sees gravity plus the 0.2 g push: accel pitch = atan2(sin θ − 0.2, cos θ)
    const th = (P(s, 'pitch_true') * Math.PI) / 180
    near(P(s, 'pitch_accel'), (Math.atan2(Math.sin(th) - 0.2, Math.cos(th)) * 180) / Math.PI, 0.1)
  })

  it('a setup() that runs before the first tick (an await after the upload) still finds the chip', async () => {
    const b = bench(`void setup() { Serial.begin(115200); mpu.initialize(); Serial.println(mpu.testConnection() ? "found" : "missing"); } void loop() { delay(10); }`)
    await new Promise((r) => setTimeout(r, 0))
    await run(b, 0.1)
    expect(b.snapshot().serial).toContain('found')
  })

  it("pitchSource 'profile' sweeps a sine", async () => {
    const b = bench(IDLE, undefined, [{ id: 'imu-mpu6050', instance: 'imu', params: { pitchSource: 'profile', profileAmp: 15, profileHz: 0.25 } }])
    let hi = -99
    let lo = 99
    await run(b, 4, (s) => {
      hi = Math.max(hi, P(s, 'pitch_true'))
      lo = Math.min(lo, P(s, 'pitch_true'))
    })
    expect(hi).toBeGreaterThan(14.5)
    expect(lo).toBeLessThan(-14.5)
  })
})
