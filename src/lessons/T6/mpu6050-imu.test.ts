import { describe, expect, it } from 'vitest'
import { complementaryTau } from '../../engine/behaviors/imu-mpu6050'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { lesson as def } from './mpu6050-imu'

const lesson: Lesson = { ...def, fig: def.fig ?? 9 }
const FRAME = 1 / 60

// readout indices
const TRUE = 0
const ACCEL = 1
const GYRO_RAW = 2
const GYRO_CAL = 3
const FILT = 4
const VIB = 5
const SDA = 6

/** within ±15 % of the curriculum's number */
const near = (v: number, want: number, rel = 0.15) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * rel)

function stats(xs: number[]) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return { mean: m, sd: Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) }
}

/** the full bench flow: strip, build, solder, power, upload */
function build(): Bench {
  const b = createBench(lesson)
  b.dispatch('strip')
  b.dispatch('pick-place')
  b.dispatch('place-all')
  b.dispatch('solder')
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

/** the sketch's own estimates from its last "accel:…,gyro:…,filtered:…" line */
function sketchOut(s: BenchSnapshot): { accel: number; gyro: number; filtered: number } {
  const line = [...s.serial].reverse().find((l) => l.startsWith('accel:')) ?? ''
  const m = /accel:([-\d.]+),gyro:([-\d.]+),filtered:([-\d.]+)/.exec(line)
  return m ? { accel: Number(m[1]), gyro: Number(m[2]), filtered: Number(m[3]) } : { accel: NaN, gyro: NaN, filtered: NaN }
}

describe('T6 mpu6050-imu lesson', () => {
  it('validates, builds from a bare PCB and runs: 3.3 V bus idle, calibration message, estimates streaming', async () => {
    expect(validateLesson(lesson)).toEqual([])
    const b = build()
    const s = await run(b, 1.5)
    expect(s.sketchError).toBeNull()
    expect(s.status).toBe('RUNNING')
    expect(s.serial).toContain('Hold still: calibrating gyro')
    expect(s.values[SDA]).toBeCloseTo(3.3, 2) // below the Uno's 0.7 × 5 = 3.5 V VIH (pro tip)
    expect(s.serial.at(-1)).toMatch(/^accel:/)
  })

  it('an uncorrected 2.1 °/s bias integrates to ≈ 126°/min; the calibrated gyro and the filter stay near the truth', async () => {
    const b = build()
    const s0 = await run(b, 2)
    const raw0 = s0.values[GYRO_RAW]
    const s = await run(b, 10)
    near((s.values[GYRO_RAW] - raw0) * 6, 2.1 * 60) // per minute
    // the run ends with the shaker on: its ≈ 203 Hz shake aliases to ≈ 3 Hz in the 100 Hz loop (see
    // the shaker test), which the filter passes as a ≈ ±1.5° wobble
    expect(Math.abs(s.values[FILT] - s.values[TRUE])).toBeLessThan(2)
    expect(Math.abs(s.values[GYRO_CAL])).toBeLessThan(1.5)
    const out = sketchOut(s)
    expect(Math.abs(out.gyro)).toBeLessThan(1.5) // the sketch calibrated too
    expect(Math.abs(out.filtered)).toBeLessThan(0.6)
    expect(complementaryTau(0.98, 0.01)).toBeCloseTo(0.49, 6)
  })

  it('the tilt tweak moves every estimate, the sketch’s included', async () => {
    const b = build()
    await run(b, 3.5) // calibrated, shaker off (it runs 1–3 s of every 10 s)
    b.setTweak('behavior:imu-mpu6050.pitchDeg', 30)
    const s = await run(b, 2.5)
    expect(s.values[TRUE]).toBe(30)
    expect(Math.abs(s.values[ACCEL] - 30)).toBeLessThan(1.5)
    expect(Math.abs(s.values[FILT] - 30)).toBeLessThan(0.6)
    const out = sketchOut(s)
    expect(Math.abs(out.accel - 30)).toBeLessThan(1.5)
    expect(Math.abs(out.filtered - 30)).toBeLessThan(0.8)
    expect(Math.abs(out.gyro - 30)).toBeLessThan(2)
  })

  it('shaker on: ≈ 0.5 g rms, the accel pitch scatters, the filter barely moves, and the status line says so', async () => {
    const b = build()
    await run(b, 1.3)
    const acc: number[] = []
    const filt: number[] = []
    let line = ''
    const s = await run(b, 1.5, (x) => {
      acc.push(x.values[ACCEL])
      filt.push(x.values[FILT])
      line = x.statusLine.text
    })
    // switched PWM: at analogWrite 200 (78 %) the ERM runs at ≈ 1275 rad/s, not the full-on
    // 1560 rad/s the averaged pin gave (the averaged 3.9 V held Q1 saturated): 2.9e-7·1275²/√2 ≈ 0.33 g
    near(s.values[VIB], 0.333)
    expect(stats(acc).sd).toBeGreaterThan(1)
    expect(stats(filt).sd).toBeLessThan(stats(acc).sd / 3) // measured ≈ 6×: the ≈ 203 Hz shake (78 % PWM) aliases to ≈ 3 Hz in the 100 Hz loop
    expect(line).toMatch(/^Shaker on/)
    // and it stops: the vibration readout falls once the sketch turns the shaker off
    const off = await run(b, 1.5)
    expect(off.values[VIB]).toBeLessThan(0.05)
  })

  it('F1 warm after calibrating: bias +0.9 °/s, calibrated gyro ≈ 54°/min, filter offset ≈ 0.44°', async () => {
    const b = build()
    await run(b, 3.5)
    b.dispatch('break:warm')
    const s1 = await run(b, 3)
    expect(s1.status).toBe('RUNNING') // the sketch keeps going: only the die temperature changed
    const g1 = s1.values[GYRO_CAL]
    const sk1 = sketchOut(s1).gyro
    const filt: number[] = []
    // shaker-off frames only: the switched-PWM shaker's ≈ 3 Hz alias would bias a 5 s mean
    const s2 = await run(b, 5, (x) => {
      if (x.values[VIB] < 0.01) filt.push(x.values[FILT])
    })
    near((s2.values[GYRO_CAL] - g1) * 12, 54)
    near((sketchOut(s2).gyro - sk1) * 12, 54)
    near(stats(filt).mean, 0.44)
    expect(s2.statusLine.text).toMatch(/^BROKEN: .*0\.44°/)
  })

  it('F2 no pull-ups: SDA idles near 0 V, testConnection fails and the sketch reports it', async () => {
    const b = build()
    await run(b, 1.5)
    b.dispatch('break:no-pullups')
    const s = await run(b, 0.5)
    expect(s.values[SDA]).toBeLessThan(0.1)
    expect(s.serial.at(-1)).toBe('MPU-6050 not found at 0x68: check wiring, pull-ups, AD0')
    expect(s.published['imu-mpu6050.i2c_ok']).toBe(0)
    expect(s.values[FILT]).toBe(0)
    expect(s.partVisible.r_pu).toBe(false)
    // repair, and the sketch finds the chip again
    b.dispatch('repair')
    const r = await run(b, 1.5)
    expect(r.serial).toContain('Hold still: calibrating gyro')
    expect(r.serial.at(-1)).toMatch(/^accel:/)
  })

  it('F3 AD0 high: the chip answers at 0x69, the library looks at 0x68, nothing is found', async () => {
    const b = build()
    await run(b, 1.5)
    b.dispatch('break:ad0-high')
    const s = await run(b, 0.5)
    expect(s.published['imu-mpu6050.addr_now']).toBe(0x69)
    expect(s.published['imu-mpu6050.i2c_ok']).toBe(0)
    expect(s.values[SDA]).toBeCloseTo(3.3, 2) // the bus itself is fine
    expect(s.values[FILT]).toBe(0) // the Uno sees no chip at 0x68
    expect(s.serial.at(-1)).toBe('MPU-6050 not found at 0x68: check wiring, pull-ups, AD0')
    expect(s.partVisible.w_ad0).toBe(true)
  })

  it('a wider DLPF passes more accelerometer noise', async () => {
    const sd: number[] = []
    for (const dl of [0, 6]) {
      const b = build()
      await run(b, 3.2) // shaker off
      b.setTweak('behavior:imu-mpu6050.dlpf', dl)
      const xs: number[] = []
      await run(b, 3, (x) => xs.push(x.values[ACCEL]))
      sd.push(stats(xs).sd)
    }
    expect(sd[0]).toBeGreaterThan(3 * sd[1])
  })
})
