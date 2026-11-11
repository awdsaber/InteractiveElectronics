// T7 pid-motor-control: the closed loop driven headless. The sketch's setpoint profile repeats every 8 s:
// 60 rpm (0–2 s), 150 rpm (2–5 s), −100 rpm (5–7 s), 0 (7–8 s). Numbers are checked against the curriculum.
import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const L = getLesson('pid-motor-control') as Lesson
const FRAME = 1 / 60
const [SET, MEAS, DUTY, TRUE, ERR, ITERM, BRAKE, , JITTER, , LOOP_HZ] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const KP = 'behavior:tune.kp'
const KI = 'behavior:tune.ki'
const KD = 'behavior:tune.kd'
const IMC = { [KP]: 0.4, [KI]: 8.7 }

function build(opts: { failure?: string; tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(L, { tweaks: opts.tweaks, speed: 1 })
  b.dispatch('place-all')
  b.dispatch('power')
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  b.upload()
  return b
}

/** every frame's readout values, per bench, so several windows can look at the same stretch of time */
const history = new WeakMap<Bench, { t: number; v: number[] }[]>()

/** run to sim time `until`, calling `each` every frame */
async function runTo(b: Bench, until: number, each?: (s: BenchSnapshot, t: number) => void): Promise<BenchSnapshot> {
  let s = b.snapshot()
  const h = history.get(b) ?? []
  history.set(b, h)
  while (b.t < until - 1e-9) {
    await b.frame(FRAME)
    s = b.snapshot()
    h.push({ t: b.t, v: [...s.values] })
    each?.(s, b.t)
  }
  return s
}

/** min / max / mean of one readout over a time window (runs the bench on to `to` when needed) */
async function window(b: Bench, from: number, to: number, idx: number) {
  await runTo(b, to)
  const rows = (history.get(b) ?? []).filter((r) => r.t >= from && r.t <= to + 1e-9)
  if (!rows.length) throw new Error(`no frames in ${from}..${to}`)
  const xs = rows.map((r) => r.v[idx])
  return { lo: Math.min(...xs), hi: Math.max(...xs), mean: xs.reduce((a, x) => a + x, 0) / xs.length }
}

describe('T7 pid-motor-control lesson', () => {
  it('validates; behaviors, failures, quiz and guide as planned', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.track).toBe('T7')
    expect(L.powerElementId).toBe('usb_plug')
    expect(L.behaviors!.map((x) => (typeof x === 'string' ? x : x.id))).toEqual(['tb6612', 'quad-encoder', 'dyno-load', 'pid-tune', 'mcu-supply', 'serial-plotter'])
    expect(L.failures!.map((f) => f.id)).toEqual(['swap-ab', 'too-much-gain', 'slow-loop', 'no-pullups', 'tired-battery'])
    expect(L.quiz).toHaveLength(4)
    expect(L.instruments!.chart!.signals).toEqual([SET, MEAS, DUTY])
  })

  it('P only leaves a steady-state error: e = (sp + K·u0) / (1 + K·Kp), ≈ 88 rpm at Kp 1 and ≈ 62 rpm at Kp 2 on the 150 rpm step', async () => {
    const b1 = build()
    await runTo(b1, 3.5)
    const e1 = await window(b1, 3.5, 4.9, ERR)
    expect(e1.mean).toBeGreaterThan(88 * 0.85)
    expect(e1.mean).toBeLessThan(88 * 1.15)
    expect((await window(b1, 4.9, 4.95, LOOP_HZ)).mean).toBeCloseTo(100, 6)
    b1.dispose()

    const b2 = build({ tweaks: { [KP]: 2 } })
    await runTo(b2, 3.5)
    const e2 = await window(b2, 3.5, 4.9, ERR)
    expect(e2.mean).toBeGreaterThan(62 * 0.85)
    expect(e2.mean).toBeLessThan(62 * 1.15)
    b2.dispose()
  })

  it('the IMC PI (Kp 0.40, Ki 8.7) removes the error: no overshoot, 63 % in ≈ τc = 0.15 s, K ≈ 0.76 rpm/count', async () => {
    const b = build({ tweaks: IMC })
    const d60 = await window(b, 1.2, 1.95, DUTY)
    let t63 = -1
    let peak = 0
    await runTo(b, 2.8, (s, t) => {
      if (t < 2) return
      peak = Math.max(peak, s.values[TRUE])
      if (t63 < 0 && s.values[TRUE] > 60 + 0.632 * 90) t63 = t - 2
    })
    expect(t63).toBeGreaterThan(0.15 * 0.85)
    expect(t63).toBeLessThan(0.15 * 1.15)
    expect(peak).toBeLessThan(153) // first order: no overshoot beyond the 2.8 rpm quantisation
    // no steady-state error in the true speed; the printed measurement is within one count (2.84 rpm) of
    // it. (Its mean is not zero: 150 rpm is 52.8 counts a sample, a 53-53-53-53-52 pattern that repeats
    // every 5 samples, exactly the sketch's 50 ms print period, so the print catches one phase of it.)
    const e = await window(b, 3.2, 4.9, ERR)
    expect(e.lo).toBeGreaterThan(-2.9)
    expect(e.hi).toBeLessThan(2.9)
    expect(Math.abs((await window(b, 3.2, 4.9, TRUE)).mean - 150)).toBeLessThan(0.5)
    const tr = await window(b, 4.0, 4.9, TRUE)
    expect(tr.lo).toBeGreaterThan(147)
    expect(tr.hi).toBeLessThan(153)
    // the incremental plant gain from the two steady states: Δrpm / ΔPWM counts
    const d150 = await window(b, 4.0, 4.9, DUTY)
    const K = 90 / (((d150.mean - d60.mean) / 100) * 255)
    expect(K).toBeGreaterThan(0.76 * 0.85)
    expect(K).toBeLessThan(0.76 * 1.15)
    // and the reversal: it tracks −100 too
    const rev = await window(b, 6.2, 6.9, TRUE)
    expect(rev.mean).toBeGreaterThan(-103)
    expect(rev.mean).toBeLessThan(-97)
    b.dispose()
  })

  it('a 0.03 N·m brake step: PI dips and recovers within 0.6 s; P only loses speed for good', async () => {
    const b = build({ tweaks: IMC })
    await runTo(b, 3.0)
    b.setTweak('behavior:dyno.brakeNm', 0.03)
    const dip = await window(b, 3.0, 3.6, TRUE)
    expect(dip.lo).toBeLessThan(140) // the disturbance is visible
    const after = await window(b, 3.6, 4.9, TRUE)
    expect(after.lo).toBeGreaterThan(146)
    expect(after.hi).toBeLessThan(154)
    const brake = await window(b, 4.9, 4.95, BRAKE)
    expect(brake.mean).toBeCloseTo(0.03, 6)
    b.dispose()

    const p = build({ tweaks: { [KP]: 2 } })
    await runTo(p, 2.9)
    const before = await window(p, 2.6, 2.95, TRUE)
    p.setTweak('behavior:dyno.brakeNm', 0.03)
    await runTo(p, 3.6)
    const loaded = await window(p, 3.6, 4.9, TRUE)
    expect(before.mean - loaded.mean).toBeGreaterThan(8) // ≈ 11 rpm of droop that never comes back
    p.dispose()
  })

  it('D on a quantised speed is noise: Kd 0.02 multiplies the PWM jitter several times over', async () => {
    const pi = build({ tweaks: IMC })
    await runTo(pi, 3.5)
    const j0 = await window(pi, 3.5, 4.9, JITTER)
    pi.dispose()
    const pid = build({ tweaks: { ...IMC, [KD]: 0.02 } })
    await runTo(pid, 3.5)
    const j1 = await window(pid, 3.5, 4.9, JITTER)
    const tr = await window(pid, 3.5, 4.9, TRUE)
    pid.dispose()
    expect(j0.mean).toBeLessThan(1.5)
    expect(j1.mean).toBeGreaterThan(4)
    expect(j1.mean).toBeGreaterThan(4 * j0.mean)
    expect(Math.abs(tr.mean - 150)).toBeLessThan(3) // the speed itself barely changes
  })

  it('the stability limit: P only holds at Kp 10 and oscillates for good at Kp 14 (Ku ≈ 12; an ideal 100 Hz loop: 14)', async () => {
    // on the 60 rpm step, where the PWM has room both ways
    const calm = build({ tweaks: { [KP]: 10 } })
    const c = await window(calm, 1.0, 1.9, TRUE)
    calm.dispose()
    expect(c.hi - c.lo).toBeLessThan(20) // the encoder's 2.84 rpm steps × Kp: chatter, not a growing swing
    const ring = build({ tweaks: { [KP]: 14 } })
    const r = await window(ring, 1.0, 1.9, TRUE)
    ring.dispose()
    expect(r.hi - r.lo).toBeGreaterThan(30)
  })

  it('failure too-much-gain: Kp 20 oscillates between the PWM limits instead of settling', async () => {
    const b = build({ failure: 'too-much-gain' })
    const tr = await window(b, 1.0, 1.9, TRUE)
    const du = await window(b, 1.0, 1.9, DUTY)
    expect(tr.hi - tr.lo).toBeGreaterThan(40) // about 25 to 80 rpm round the 60 rpm setpoint
    expect(du.lo).toBeLessThan(-95) // full reverse …
    expect(du.hi).toBeGreaterThan(95) // … to full forward
    b.dispose()
  })

  it('failure swap-ab: reversed feedback runs away to full speed whatever the setpoint', async () => {
    const b = build({ tweaks: IMC, failure: 'swap-ab' })
    await runTo(b, 1.0)
    const fwd = await window(b, 1.0, 1.9, TRUE)
    expect(fwd.lo).toBeGreaterThan(175) // setpoint is 60
    const du = await window(b, 1.0, 1.9, DUTY)
    expect(du.lo).toBeGreaterThan(99)
    const meas = await window(b, 1.0, 1.9, MEAS)
    expect(meas.hi).toBeLessThan(-175) // it reads its own speed as reverse
    await runTo(b, 6.0)
    const rev = await window(b, 6.0, 6.9, TRUE)
    expect(rev.lo).toBeGreaterThan(150) // setpoint −100: still flat out forward
    b.dispose()
  })

  it('failure slow-loop: a tight PI that is crisp at 100 Hz rings without end at 10 Hz', async () => {
    const tight = { [KP]: 2, [KI]: 35 }
    const fast = build({ tweaks: tight })
    await runTo(fast, 3.5)
    const f = await window(fast, 3.5, 4.9, TRUE)
    fast.dispose()
    expect(f.hi - f.lo).toBeLessThan(6)

    const slow = build({ failure: 'slow-loop' })
    await runTo(slow, 3.5)
    const s = await window(slow, 3.5, 4.9, TRUE)
    const hz = await window(slow, 4.9, 4.95, LOOP_HZ)
    slow.dispose()
    expect(hz.mean).toBeCloseTo(10, 6)
    expect(s.hi - s.lo).toBeGreaterThan(40)
  })

  it('failure no-pullups: with no feedback the motor runs flat out in the setpoint direction', async () => {
    const b = build({ tweaks: IMC, failure: 'no-pullups' })
    await runTo(b, 3.0)
    const fwd = await window(b, 3.0, 4.9, TRUE)
    expect(fwd.lo).toBeGreaterThan(175)
    await runTo(b, 6.0)
    const rev = await window(b, 6.0, 6.9, TRUE)
    expect(rev.hi).toBeLessThan(-175)
    b.dispose()
  })

  it('failure tired-battery: tops out near 136 rpm; without anti-windup the integral winds past 500 and the reversal comes late', async () => {
    const crossing = async (b: Bench) => {
      let peakI = 0
      let top = 0
      let cross = -1
      await runTo(b, 6.0, (s, t) => {
        peakI = Math.max(peakI, s.values[ITERM])
        if (t > 4 && t < 5) top = Math.max(top, s.values[TRUE])
        if (t > 5 && cross < 0 && s.values[TRUE] < 0) cross = t - 5
      })
      return { peakI, top, cross }
    }
    const wound = build({ failure: 'tired-battery' })
    const w = await crossing(wound)
    wound.dispose()
    const clamped = build({ tweaks: { ...IMC, 'bat.value': 4.6, 'bat.rInternal': 2 } })
    const c = await crossing(clamped)
    clamped.dispose()
    expect(w.top).toBeGreaterThan(136 * 0.95)
    expect(w.top).toBeLessThan(136 * 1.05)
    expect(w.peakI).toBeGreaterThan(450)
    expect(c.peakI).toBeLessThan(260)
    expect(w.cross - c.cross).toBeGreaterThan(0.1)
  })
})
