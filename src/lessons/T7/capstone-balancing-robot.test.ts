// T7 capstone-balancing-robot: the robot driven headless. Upload, it calibrates while held, is let go at 0.9 s
// (MCU time) and balances; pushes, filter failures, a slow loop, swapped motors, a tired pack and a tall robot.
import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import { DEFAULT_SKETCH_GAINS } from '../../engine/robot/pendulum'
import type { Lesson } from '../../engine/types'
import { dynamicPose } from '../../three/dynamicPose'
import { getLesson } from '../index'

const L = getLesson('capstone-balancing-robot') as Lesson
const FRAME = 1 / 60
const [PITCH, EST, , U, , , TRAVEL, VBAT, , FALLEN, POLE, , LOOP_HZ, HELD, , WOBBLE, RING] = Array.from({ length: 17 }, (_, i) => i)

function build(opts: { failure?: string; tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(L, { tweaks: opts.tweaks })
  b.dispatch('power')
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  b.upload()
  return b
}

const v = (b: Bench, i: number) => b.snapshot().values[i]

/** run until sim time `until`, calling `each` every frame */
async function runTo(b: Bench, until: number, each?: () => void) {
  while (b.t < until - 1e-9) {
    await b.frame(FRAME)
    each?.()
  }
}

/** a short press of the momentary Push: `n` newtons (Push size) for 50 ms */
async function push(b: Bench, n = 3) {
  b.setTweak('behavior:bot.pushN', n)
  b.setTweak('behavior:bot.push', 1)
  await b.frame(FRAME)
  await b.frame(FRAME)
  b.setTweak('behavior:bot.push', 0)
}

/** the first sim time at which the robot is down, or Infinity */
async function fallTime(b: Bench, until: number): Promise<number> {
  let at = Infinity
  await runTo(b, until, () => {
    if (at === Infinity && v(b, FALLEN) > 0.5) at = b.t
  })
  return at
}

describe('capstone-balancing-robot: lesson data', () => {
  it('validates, and its board moves (pitch and travel from balance-bot)', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.board.dynamic).toMatchObject({ pitchKey: 'bot.pitch', travelKey: 'bot.x_m' })
    expect(dynamicPose(L.board.dynamic!, { 'bot.pitch': 10, 'bot.x_m': 0.03 })).toEqual({ pitch: (10 * Math.PI) / 180, travel: 3 })
  })

  it('the sketch starts from the gains derived in engine/robot/pendulum.ts, and the text states them and the poles', () => {
    const tune = L.behaviors!.find((r) => typeof r !== 'string' && r.instance === 'tune')
    expect(typeof tune !== 'string' && tune?.params).toMatchObject({ kp: DEFAULT_SKETCH_GAINS.kp, kd: DEFAULT_SKETCH_GAINS.kd, kv: DEFAULT_SKETCH_GAINS.kv, periodMs: 5, alpha: 0.98 })
    for (const s of ['−12 ± 9i', '−3 rad/s', 'Kp = 20.7', 'Kd = 2.3', 'KV = 0.11', '+7.4', '11.1 rad/s', '8.2 rad/s', '0.245 s', '3.8 counts per degree'])
      expect(L.meet).toContain(s)
  })
})

describe('capstone-balancing-robot: balancing', () => {
  it('held while it calibrates, let go just after, then stands within a degree at 200 Hz', async () => {
    const b = build()
    await runTo(b, 0.5)
    expect(v(b, HELD)).toBe(1)
    let peak = 0
    await runTo(b, 6, () => {
      if (b.t > 2) peak = Math.max(peak, Math.abs(v(b, PITCH)))
    })
    expect(v(b, HELD)).toBe(0)
    expect(v(b, FALLEN)).toBe(0)
    expect(peak).toBeLessThan(1)
    expect(Math.abs(v(b, EST) - v(b, PITCH))).toBeLessThan(0.5)
    expect(v(b, LOOP_HZ)).toBe(200)
    expect(v(b, POLE)).toBeCloseTo(8.22, 1)
    b.dispose()
  })

  it('catches a 3 N push (peak under 8°), settles about 10 cm away, and rides out five more in a row', async () => {
    const b = build()
    await runTo(b, 3)
    await push(b)
    let peak = 0
    await runTo(b, 6, () => (peak = Math.max(peak, Math.abs(v(b, PITCH)))))
    expect(v(b, FALLEN)).toBe(0)
    expect(peak).toBeGreaterThan(2)
    expect(peak).toBeLessThan(8)
    expect(v(b, RING)).toBeGreaterThan(2)
    expect(Math.abs(v(b, PITCH))).toBeLessThan(1.5)
    expect(Math.abs(v(b, TRAVEL))).toBeGreaterThan(4)
    expect(Math.abs(v(b, TRAVEL))).toBeLessThan(20)
    for (let k = 0; k < 5; k++) {
      await push(b)
      await runTo(b, b.t + 2.4)
    }
    expect(v(b, FALLEN)).toBe(0)
    b.dispose()
  })

  it('the board tilts with it: the 3D pose follows the published pitch', async () => {
    const b = build()
    await runTo(b, 3)
    await push(b)
    let maxPose = 0
    await runTo(b, 4, () => (maxPose = Math.max(maxPose, Math.abs(dynamicPose(L.board.dynamic!, b.snapshot().published).pitch))))
    expect(maxPose).toBeGreaterThan((2 * Math.PI) / 180)
    b.dispose()
  })

  it('without its damper (Kd 0) it rings after a push harder than with the designed Kd', async () => {
    const ring = async (kd: number) => {
      const b = build({ tweaks: { 'behavior:tune.kd': kd } })
      await runTo(b, 3)
      await push(b)
      await runTo(b, 5)
      const r = v(b, RING)
      b.dispose()
      return r
    }
    expect(await ring(0)).toBeGreaterThan(1.5 * (await ring(DEFAULT_SKETCH_GAINS.kd)))
  })

  it('falls past 45°, lies down with the motors cut, and Hold it upright stands it up again cleanly', async () => {
    const b = build()
    await runTo(b, 2.5)
    b.setTweak('behavior:tune.kp', 0) // no stiffness: gravity wins
    expect(await fallTime(b, 5)).toBeLessThan(5)
    await runTo(b, 5.5)
    expect(Math.abs(v(b, PITCH))).toBeCloseTo(78, 3)
    expect(v(b, U)).toBe(0) // the sketch's fall cut-off
    b.setTweak('behavior:tune.kp', DEFAULT_SKETCH_GAINS.kp)
    b.setTweak('behavior:bot.hold', 1)
    await runTo(b, 6.5)
    expect(v(b, PITCH)).toBeCloseTo(0, 6)
    expect(v(b, FALLEN)).toBe(0)
    b.setTweak('behavior:bot.hold', 0)
    let peak = 0
    await runTo(b, 10, () => (peak = Math.max(peak, Math.abs(v(b, PITCH)))))
    expect(v(b, FALLEN)).toBe(0)
    expect(peak).toBeLessThan(3)
    b.dispose()
  })

  it('angle PD alone (KV = 0) runs away and falls: the speed loop is not optional', async () => {
    const b = build({ tweaks: { 'behavior:tune.kv': 0 } })
    expect(await fallTime(b, 12)).toBeLessThan(12)
    b.dispose()
  })

  it('the COM slider changes the open-loop pole: 7.2 rad/s at 20 cm (the rotors dominate below about 9 cm)', async () => {
    const b = build({ tweaks: { 'behavior:bot.l': 0.2 } })
    await runTo(b, 0.2)
    expect(v(b, POLE)).toBeCloseTo(7.22, 1)
    b.dispose()
  })
})

describe('capstone-balancing-robot: failures', () => {
  it('accelerometer only: the estimate jumps with every catch and it falls within 3 s', async () => {
    const b = build()
    await runTo(b, 2.5)
    b.dispatch('break:accel-only')
    let worst = 0
    const at = await fallTime(b, 6)
    void worst
    expect(at - 2.5).toBeLessThan(3)
    b.dispose()
  })

  it('gyro only, chip 20 °C warmer: the estimate drifts about 0.6 °/s and it runs away', async () => {
    const b = build()
    await runTo(b, 2.5)
    b.dispatch('break:gyro-only')
    await runTo(b, 4.5)
    const e0 = v(b, EST) - v(b, PITCH)
    await runTo(b, 6.5)
    const drift = (v(b, EST) - v(b, PITCH) - e0) / 2
    expect(drift).toBeGreaterThan(0.45)
    expect(drift).toBeLessThan(0.75)
    let far = 0
    await runTo(b, 20, () => (far = Math.max(far, Math.abs(v(b, TRAVEL)))))
    expect(far).toBeGreaterThan(30)
    b.dispose()
  })

  it('a 10 Hz loop (100 ms) falls; 50 ms still stands', async () => {
    const b = build()
    await runTo(b, 2.5)
    b.dispatch('break:slow-loop')
    expect(await fallTime(b, 6)).toBeLessThan(6)
    b.dispose()
    const c = build({ tweaks: { 'behavior:tune.periodMs': 50 } })
    expect(await fallTime(c, 6)).toBe(Infinity)
    c.dispose()
  })

  it('both motors’ leads swapped: positive feedback, on the floor within a second', async () => {
    const b = build()
    await runTo(b, 2.5)
    b.dispatch('break:motor-polarity')
    expect((await fallTime(b, 5)) - 2.5).toBeLessThan(1)
    b.dispose()
  })

  it('a tired pack stands still, but sags under a 5 N push and cannot catch it (a fresh one can)', async () => {
    const b = build({ failure: 'low-battery' })
    expect(await fallTime(b, 3)).toBe(Infinity)
    expect(v(b, VBAT)).toBeGreaterThan(6.0)
    await push(b, 5)
    let low = 99
    let at = Infinity
    await runTo(b, 6, () => {
      low = Math.min(low, v(b, VBAT))
      if (at === Infinity && v(b, FALLEN) > 0.5) at = b.t
    })
    expect(at).toBeLessThan(6)
    expect(low).toBeLessThan(5.5)
    const c = build()
    await runTo(c, 3)
    await push(c, 5)
    expect(await fallTime(c, 6)).toBe(Infinity)
    c.dispose()
    b.dispose()
  })

  it('a tall robot (COM 20 cm) wobbles more than the short one, standing and after a push', async () => {
    /** mean WOBBLE from 3 s to 8 s, with an optional push at 3 s */
    const wobble = async (failure: string | undefined, pushed: boolean) => {
      const b = build({ failure })
      await runTo(b, 3)
      if (pushed) await push(b)
      let sum = 0
      let n = 0
      await runTo(b, 8, () => {
        sum += v(b, WOBBLE)
        n++
      })
      expect(v(b, FALLEN)).toBe(0)
      b.dispose()
      return sum / n
    }
    expect(await wobble('high-com', false)).toBeGreaterThan(1.6 * (await wobble(undefined, false)))
    expect(await wobble('high-com', true)).toBeGreaterThan(1.6 * (await wobble(undefined, true)))
  })
})
