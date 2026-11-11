import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BOT,
  DEFAULT_SKETCH_GAINS,
  botParams,
  cascadeK,
  charPoly,
  closedLoopPoles,
  defaultGains,
  driveModel,
  energy,
  freePole,
  fromSketchUnits,
  isFallen,
  linearize,
  pdGains,
  pivotPole,
  polyRoots,
  sketchUnits,
  stepPendulum,
  type CascadeGains,
  type PendulumParams,
  type PendulumState,
} from './pendulum'

const G = 9.81

/** a point mass on light wheels, nothing reflected: the textbook inverted pendulum */
const pointMass = (lockWheels: boolean): PendulumParams => ({
  M: 1,
  l: 0.1,
  Ic: 0,
  r: 0.03,
  mw: 1e-6,
  // a huge wheel inertia holds the axle in place: the pivot of a pendulum on a fixed hinge
  Iw: lockWheels ? 1e6 : 1e-9,
  Jr: 0,
  c: 0,
  g: G,
})

/** growth rate of an unforced fall from a tiny tilt, measured on the integrator (log slope of θ) */
function measuredGrowth(p: PendulumParams): number {
  const s: PendulumState = { x: 0, v: 0, theta: 1e-6, omega: 0 }
  const h = 1e-4
  // after the decaying mode has died out, θ ∝ e^(λt): compare two instants
  let t = 0
  let th1 = 0
  let t1 = 0
  while (t < 1.2 && Math.abs(s.theta) < 0.01) {
    stepPendulum(p, s, 0, 0, h)
    t += h
    if (!th1 && t >= 0.3) {
      th1 = s.theta
      t1 = t
    }
  }
  return Math.log(s.theta / th1) / (t - t1)
}

describe('wheeled inverted pendulum: open-loop poles', () => {
  it('a point mass on a fixed pivot falls at √(g/l): 9.9 rad/s at l = 0.1 m', () => {
    expect(pivotPole(pointMass(true))).toBeCloseTo(Math.sqrt(G / 0.1), 6)
    expect(measuredGrowth(pointMass(true))).toBeCloseTo(Math.sqrt(G / 0.1), 1)
  })

  it('a body with its own inertia on a fixed pivot: √(M·g·l / (I_c + M·l²))', () => {
    const p = { ...pointMass(true), Ic: 0.005 }
    const want = Math.sqrt((1 * G * 0.1) / (0.005 + 0.01))
    expect(pivotPole(p)).toBeCloseTo(want, 6)
    expect(measuredGrowth(p)).toBeCloseTo(want, 1)
  })

  it('on free wheels the cart recoils, so the robot falls faster: √(M·g·l·A11 / det)', () => {
    const p = { ...botParams(DEFAULT_BOT), c: 0 }
    expect(freePole(p)).toBeGreaterThan(pivotPole(p))
    expect(measuredGrowth(p) / freePole(p)).toBeCloseTo(1, 2)
  })

  it('the default robot: pole about 8.2 rad/s free, the reflected rotors weigh like 1.3 kg of cart', () => {
    const p = botParams(DEFAULT_BOT)
    // J_r = 2 · 48² · 3e-7 = 1.38e-3 kg·m², J_r / r² = 1.31 kg
    expect(p.Jr).toBeCloseTo(2 * 48 * 48 * 3e-7, 9)
    expect(p.Jr / (p.r * p.r)).toBeCloseTo(1.31, 2)
    expect(freePole(p)).toBeGreaterThan(8.0)
    expect(freePole(p)).toBeLessThan(8.4)
    // doubling time ln 2 / λ ≈ 85 ms
    expect(Math.LN2 / freePole(p)).toBeCloseTo(0.085, 2)
  })
})

describe('wheeled inverted pendulum: integration', () => {
  it('conserves energy with no friction and no drive (semi-implicit Euler, 0.25 ms substeps)', () => {
    const p = { ...botParams(DEFAULT_BOT), c: 0 }
    // a hanging pendulum (θ near π) swings for 10 s: the symplectic step keeps the energy bounded
    const s: PendulumState = { x: 0, v: 0, theta: Math.PI - 0.6, omega: 0 }
    const e0 = energy(p, s)
    let worst = 0
    for (let i = 0; i < 40000; i++) {
      stepPendulum(p, s, 0, 0, 2.5e-4)
      worst = Math.max(worst, Math.abs(energy(p, s) - e0))
    }
    const scale = p.M * p.g * p.l // the energy scale of the swing
    expect(worst / scale).toBeLessThan(5e-3)
    // and it is a bounded wobble that shrinks with the step, not a drift
    const s2: PendulumState = { x: 0, v: 0, theta: Math.PI - 0.6, omega: 0 }
    let worst2 = 0
    for (let i = 0; i < 100000; i++) {
      stepPendulum(p, s2, 0, 0, 1e-4)
      worst2 = Math.max(worst2, Math.abs(energy(p, s2) - e0))
    }
    expect(worst2).toBeLessThan(worst * 0.6)
  })

  it('conserves energy through a fall from 3° to 60°', () => {
    const p = { ...botParams(DEFAULT_BOT), c: 0 }
    const s: PendulumState = { x: 0, v: 0, theta: (3 * Math.PI) / 180, omega: 0 }
    const e0 = energy(p, s)
    while (s.theta < Math.PI / 3) stepPendulum(p, s, 0, 0, 2.5e-4)
    expect(Math.abs(energy(p, s) - e0) / (p.M * p.g * p.l)).toBeLessThan(1e-3)
    // the cart recoils backwards as the body falls forwards (momentum: no horizontal force)
    expect(s.x).toBeLessThan(0)
  })

  it('a wheel torque drives the cart forward and tips the body back (the reaction)', () => {
    const p = botParams(DEFAULT_BOT)
    const s: PendulumState = { x: 0, v: 0, theta: 0, omega: 0 }
    for (let i = 0; i < 100; i++) stepPendulum(p, s, 0.1, 0, 1e-4)
    expect(s.v).toBeGreaterThan(0)
    expect(s.theta).toBeLessThan(0)
  })

  it('a push at the COM tips the body the way it is pushed', () => {
    const p = botParams(DEFAULT_BOT)
    const s: PendulumState = { x: 0, v: 0, theta: 0, omega: 0 }
    for (let i = 0; i < 100; i++) stepPendulum(p, s, 0, 2, 1e-4)
    expect(s.omega).toBeGreaterThan(0)
  })

  it('detects a fall past the limit, either way', () => {
    expect(isFallen((44 * Math.PI) / 180, 45)).toBe(false)
    expect(isFallen((46 * Math.PI) / 180, 45)).toBe(true)
    expect(isFallen((-46 * Math.PI) / 180, 45)).toBe(true)
  })
})

describe('the balance loop, derived from the linear model', () => {
  const p = botParams(DEFAULT_BOT)
  const drive = driveModel(DEFAULT_BOT)
  const { A, B } = linearize(p, drive)

  it('drive: about 2.2 mN·m of wheel torque per PWM count on 7.4 V, back-EMF damping about 0.02 N·m·s', () => {
    expect(drive.ku).toBeGreaterThan(2.0e-3)
    expect(drive.ku).toBeLessThan(2.4e-3)
    expect(drive.cEmf).toBeGreaterThan(0.015)
    expect(drive.cEmf).toBeLessThan(0.025)
  })

  it('finds the roots of a polynomial (Durand–Kerner) and a characteristic polynomial (Faddeev–LeVerrier)', () => {
    // (s + 1)(s + 2)(s² + 2s + 5)
    const r = polyRoots([1, 5, 13, 19, 10]).sort((a, b) => a.re - b.re || a.im - b.im)
    expect(r[0].re).toBeCloseTo(-2, 6)
    expect(r[1].re).toBeCloseTo(-1, 6)
    expect(r[1].im).toBeCloseTo(-2, 6)
    expect(r[3].re).toBeCloseTo(-1, 6)
    expect(r[3].im).toBeCloseTo(2, 6)
    expect(charPoly([2, 1, 0, 3], 2)).toEqual([1, -5, 6])
  })

  it('open loop: one unstable pole (+7.4 rad/s, a little under λ_free: the back-EMF damps the rotors), two stable, and the cart at 0', () => {
    const poles = closedLoopPoles(A, B, [0, 0, 0, 0]).sort((a, b) => b.re - a.re)
    expect(poles[0].re).toBeCloseTo(7.37, 1)
    expect(poles[0].re).toBeLessThan(freePole(p))
    expect(Math.abs(poles[1].re)).toBeLessThan(1e-6)
    expect(poles[2].re).toBeLessThan(0)
    expect(poles[3].re).toBeLessThan(0)
  })

  it('PD on the angle alone cannot stand for long: a slow pole stays unstable (it leans, speeds up, and the back-EMF eats its torque)', () => {
    const g = pdGains(p, drive, 15, 0.8)
    const poles = closedLoopPoles(A, B, cascadeK({ kp: g.kpRad, kd: g.kdRad, kv: 0 }, p.r))
    const slow = Math.max(...poles.map((z) => z.re))
    expect(slow).toBeGreaterThan(1)
    expect(slow).toBeLessThan(4)
  })

  it('the default gains place the poles at −12 ± 9i (ω_n 15 rad/s, ζ 0.8) and −3 rad/s, plus the parked cart at 0', () => {
    const g = defaultGains()
    const poles = closedLoopPoles(A, B, cascadeK(g, p.r)).sort((a, b) => a.re - b.re || a.im - b.im)
    expect(poles[0].re).toBeCloseTo(-12, 4)
    expect(Math.abs(poles[0].im)).toBeCloseTo(9, 4)
    expect(poles[2].re).toBeCloseTo(-3, 4)
    expect(Math.abs(poles[3].re)).toBeLessThan(1e-6)
    // in the sketch's units, rounded
    const d = sketchUnits(g)
    expect(Math.abs(d.kpDeg - DEFAULT_SKETCH_GAINS.kp)).toBeLessThan(0.5)
    expect(Math.abs(d.kdDeg - DEFAULT_SKETCH_GAINS.kd)).toBeLessThan(0.05)
    expect(Math.abs(d.kvDegPerRpm - DEFAULT_SKETCH_GAINS.kv)).toBeLessThan(0.005)
  })

  it('the rounded sketch gains are still stable, with the fast pair within 10 % of the design', () => {
    const k = DEFAULT_SKETCH_GAINS
    const g = fromSketchUnits(k.kp, k.kd, k.kv)
    const poles = closedLoopPoles(A, B, cascadeK(g, p.r))
    const fast = poles.filter((z) => Math.abs(z.im) > 1)
    expect(fast).toHaveLength(2)
    expect(Math.hypot(fast[0].re, fast[0].im)).toBeGreaterThan(13.5)
    expect(Math.hypot(fast[0].re, fast[0].im)).toBeLessThan(16.5)
    for (const z of poles) expect(z.re).toBeLessThan(1e-6)
  })

  it('a Kp below gravity’s stiffness (β·ku·Kp < M·g·l) cannot hold it, whatever Kd', () => {
    const weak = (0.5 * p.M * p.g * p.l) / (drive.beta * drive.ku)
    const poles = closedLoopPoles(A, B, cascadeK({ kp: weak, kd: 60, kv: 0.02 }, p.r))
    expect(Math.max(...poles.map((z) => z.re))).toBeGreaterThan(0)
  })
})

describe('closed loop on the nonlinear model: a sampled cascade with a saturating drive', () => {
  const p = botParams(DEFAULT_BOT)
  const drive = driveModel(DEFAULT_BOT)

  /**
   * The sketch's loop on the pure model: every `periodS` it reads θ and ω (through a 5 ms first-order lag,
   * the IMU's filter), the wheel speed from a 4-sample count, and holds the PWM (capped at ±182) until the
   * next sample. The motors are torque = ku·u − cEmf·ψ̇. Returns whether it fell, and the peak tilt.
   */
  function run(g: CascadeGains, theta0Deg: number, seconds: number, periodS = 0.005, pushN = 0) {
    const s: PendulumState = { x: 0, v: 0, theta: (theta0Deg * Math.PI) / 180, omega: 0 }
    const h = 2.5e-4
    let u = 0
    let next = 0
    let peak = 0
    let thF = s.theta
    let wF = 0
    let psi = 0
    let psiAt = 0
    let speed = 0
    let n = 0
    for (let t = 0; t < seconds; t += h) {
      thF += (h / 0.005) * (s.theta - thF)
      wF += (h / 0.005) * (s.omega - wF)
      if (t >= next - 1e-12) {
        next += periodS
        if (++n % 4 === 0) {
          speed = (psi - psiAt) / (4 * periodS)
          psiAt = psi
        }
        u = Math.max(-182, Math.min(182, g.kp * (thF + g.kv * speed) + g.kd * wF))
      }
      const rel = s.v / p.r - s.omega
      psi += rel * h
      const push = t > 1 && t < 1.05 ? pushN : 0
      stepPendulum(p, s, drive.ku * u - drive.cEmf * rel, push, h)
      peak = Math.max(peak, Math.abs(s.theta))
      if (isFallen(s.theta, 45)) return { fell: true, peakDeg: (peak * 180) / Math.PI, v: s.v }
    }
    return { fell: false, peakDeg: (peak * 180) / Math.PI, v: s.v }
  }

  it('the default gains catch a 3° start and stand for 10 s, back at rest', () => {
    const r = run(defaultGains(), 3, 10)
    expect(r.fell).toBe(false)
    expect(r.peakDeg).toBeLessThan(3.5)
    expect(Math.abs(r.v)).toBeLessThan(0.01)
  })

  it('they ride out a 3 N push for 50 ms', () => {
    const r = run(defaultGains(), 0, 6, 0.005, 3)
    expect(r.fell).toBe(false)
    expect(r.peakDeg).toBeLessThan(8)
  })

  it('half the critical Kp falls (gravity wins)', () => {
    const crit = (p.M * p.g * p.l) / (drive.beta * drive.ku)
    const r = run({ ...defaultGains(), kp: 0.5 * crit }, 2, 5)
    expect(r.fell).toBe(true)
  })

  it('angle PD with no speed loop runs away and falls within seconds', () => {
    const r = run({ ...defaultGains(), kv: 0 }, 2, 10)
    expect(r.fell).toBe(true)
  })
})

