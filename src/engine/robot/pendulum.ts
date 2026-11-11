// The wheeled inverted pendulum (a two-wheel balancing robot in its pitch plane), as pure functions.
//
// Coordinates: x is the axle's travel (m, + forward), θ the body's pitch from vertical (rad, + leaning
// forward), v = ẋ, ω = θ̇. The two wheels roll without slipping and are lumped into one. The gear motors'
// rotors turn relative to the body at N·ψ̇, ψ̇ = v/r − ω (the encoder's wheel speed), so their inertia
// reflected to the wheel is J_r = Σ N²·J_m, and it couples x and θ. From the Lagrangian
//
//   T = ½(M + m_w)·v² + M·l·cos θ·v·ω + ½(I_c + M·l²)·ω² + ½·I_w·(v/r)² + ½·J_r·(v/r − ω)²,  V = M·g·l·cos θ
//
// with τ the motors' torque on the wheels (relative to the body; work τ·δψ) and F a horizontal push at the COM:
//
//   a11·v̇ + a12·ω̇ = τ_net/r + F + M·l·sin θ·ω²             a11 = M + m_w + (I_w + J_r)/r²
//   a12·v̇ + a22·ω̇ = M·g·l·sin θ − τ_net + F·l·cos θ        a12 = M·l·cos θ − J_r/r,  a22 = I_c + M·l² + J_r
//
// where τ_net = τ − c·ψ̇ includes the gearbox's viscous friction. Integrated by semi-implicit Euler.

export interface PendulumParams {
  /** body mass, kg (everything that pitches: chassis, boards, battery, motor stators) */
  M: number
  /** COM height above the axle, m */
  l: number
  /** body inertia about its COM, kg·m² */
  Ic: number
  /** wheel radius, m */
  r: number
  /** both wheels' mass, kg */
  mw: number
  /** both wheels' inertia about the axle, kg·m² */
  Iw: number
  /** the rotors' inertia reflected to the wheel, Σ N²·J_m, kg·m² */
  Jr: number
  /** viscous friction on ψ̇ at the wheel, Σ N²·b_m, N·m·s */
  c: number
  g: number
}

export interface PendulumState {
  x: number
  v: number
  theta: number
  omega: number
}

/** a robot as built: body, wheels, gear motors and their drive (the motor values are the MOTOR element's) */
export interface BotSpec {
  M: number
  l: number
  Ic: number
  r: number
  /** one wheel's mass, kg (I_w = ½·m·r² each, a disc: illustrative) */
  wheelMass: number
  gear: number
  /** gearbox efficiency on the motor's torque (illustrative) */
  eff: number
  motor: { r: number; ke: number; kt: number; j: number; b: number }
  /** H-bridge on-resistance, high + low side, per channel, Ω */
  rDrive: number
  /** battery internal resistance, Ω (shared by both channels) */
  rBat: number
  vBat: number
  motors: number
  /** the PWM count that is 100 % duty */
  pwmFull: number
  g?: number
}

/**
 * The capstone robot: 0.8 kg body, COM 8 cm above the axle, 65 mm wheels, two TT-class 48:1 gear motors
 * (the course's representative values: 4 Ω, ke = kt = 0.0054, J 3e-7, b 8e-7), a TB6612FNG (0.5 Ω per
 * channel, typ.) on a 2S Li-ion pack at 7.4 V nominal with 0.15 Ω. I_c = 0.003 kg·m² is illustrative (a
 * uniform 21 cm block of 0.8 kg).
 */
export const DEFAULT_BOT: BotSpec = {
  M: 0.8,
  l: 0.08,
  Ic: 0.003,
  r: 0.0325,
  wheelMass: 0.03,
  gear: 48,
  eff: 0.7,
  motor: { r: 4, ke: 0.0054, kt: 0.0054, j: 3e-7, b: 8e-7 },
  rDrive: 0.5,
  rBat: 0.15,
  vBat: 7.4,
  motors: 2,
  pwmFull: 255,
}

export function botParams(b: BotSpec): PendulumParams {
  const n2 = b.gear * b.gear
  return {
    M: b.M,
    l: b.l,
    Ic: b.Ic,
    r: b.r,
    mw: b.motors * b.wheelMass,
    Iw: b.motors * 0.5 * b.wheelMass * b.r * b.r,
    Jr: b.motors * n2 * b.motor.j,
    c: b.motors * n2 * b.motor.b,
    g: b.g ?? 9.81,
  }
}

/** a11, a12, a22 of the mass matrix at pitch θ */
function mass(p: PendulumParams, theta: number, out: Float64Array): void {
  out[0] = p.M + p.mw + (p.Iw + p.Jr) / (p.r * p.r)
  out[1] = p.M * p.l * Math.cos(theta) - p.Jr / p.r
  out[2] = p.Ic + p.M * p.l * p.l + p.Jr
}

const MM = new Float64Array(3)
/** the last call's accelerations: [v̇, ω̇] */
export const ACC = new Float64Array(2)

/** v̇ and ω̇ into ACC, for the wheel torque `tau` (N·m, motors on the wheels) and a push `force` (N) at the COM */
export function accelerations(p: PendulumParams, s: PendulumState, tau: number, force: number): void {
  mass(p, s.theta, MM)
  const sn = Math.sin(s.theta)
  const tNet = tau - p.c * (s.v / p.r - s.omega)
  const fx = tNet / p.r + force + p.M * p.l * sn * s.omega * s.omega
  const ft = p.M * p.g * p.l * sn - tNet + force * p.l * Math.cos(s.theta)
  const det = MM[0] * MM[2] - MM[1] * MM[1]
  ACC[0] = (MM[2] * fx - MM[1] * ft) / det
  ACC[1] = (MM[0] * ft - MM[1] * fx) / det
}

/** one semi-implicit Euler step of h seconds (velocities first, then positions with the new velocities) */
export function stepPendulum(p: PendulumParams, s: PendulumState, tau: number, force: number, h: number): void {
  accelerations(p, s, tau, force)
  s.v += ACC[0] * h
  s.omega += ACC[1] * h
  s.x += s.v * h
  s.theta += s.omega * h
}

/** kinetic + potential energy, J (zero of potential at the axle) */
export function energy(p: PendulumParams, s: PendulumState): number {
  const psi = s.v / p.r - s.omega
  const t =
    0.5 * (p.M + p.mw) * s.v * s.v +
    p.M * p.l * Math.cos(s.theta) * s.v * s.omega +
    0.5 * (p.Ic + p.M * p.l * p.l) * s.omega * s.omega +
    (0.5 * p.Iw * s.v * s.v) / (p.r * p.r) +
    0.5 * p.Jr * psi * psi
  return t + p.M * p.g * p.l * Math.cos(s.theta)
}

/** the unstable pole with the axle held in place (the wheels locked to the floor): √(M·g·l / (I_c + M·l² + J_r)) */
export function pivotPole(p: PendulumParams): number {
  return Math.sqrt((p.M * p.g * p.l) / (p.Ic + p.M * p.l * p.l + p.Jr))
}

/** the unstable pole on free wheels with no drive: √(M·g·l·a11 / det) at θ = 0 */
export function freePole(p: PendulumParams): number {
  mass(p, 0, MM)
  return Math.sqrt((p.M * p.g * p.l * MM[0]) / (MM[0] * MM[2] - MM[1] * MM[1]))
}

/** |θ| beyond the limit (degrees) */
export const isFallen = (theta: number, limitDeg: number): boolean => Math.abs(theta) > (limitDeg * Math.PI) / 180

// ───────────────────────── linear model and the loop design ─────────────────────────

export interface DriveModel {
  /** wheel torque per PWM count at stall, N·m (both motors) */
  ku: number
  /** back-EMF damping on ψ̇ at the wheel, N·m·s (both motors): Σ η·N²·kt·ke / R */
  cEmf: number
  /** loop resistance per motor: winding + bridge + its share of the battery, Ω */
  rEff: number
  /** the reaction factor on the body, 1 + a12 / (r·a11) at θ = 0: a wheel torque τ tips the body by β·τ */
  beta: number
}

/**
 * The motors as a torque source: each draws i = (duty·V − ke·N·ψ̇) / R, so the wheels get η·N·kt·i.
 * The battery's resistance is shared, so each motor sees R = R_m + R_bridge + motors·R_bat.
 */
export function driveModel(b: BotSpec): DriveModel {
  const p = botParams(b)
  const rEff = b.motor.r + b.rDrive + b.motors * b.rBat
  const ku = (b.motors * b.eff * b.gear * b.motor.kt * b.vBat) / (b.pwmFull * rEff)
  const cEmf = (b.motors * b.eff * b.gear * b.gear * b.motor.kt * b.motor.ke) / rEff
  mass(p, 0, MM)
  return { ku, cEmf, rEff, beta: 1 + MM[1] / (p.r * MM[0]) }
}

/**
 * The linearised plant at θ = 0, state [θ, ω, x, v], input u in PWM counts, with τ = ku·u − (cEmf + c)·ψ̇.
 * Returns row-major A (4×4) and B (4).
 */
export function linearize(p: PendulumParams, d: DriveModel): { A: number[]; B: number[] } {
  mass(p, 0, MM)
  const [a11, a12, a22] = MM
  const det = a11 * a22 - a12 * a12
  const mgl = p.M * p.g * p.l
  const cT = d.cEmf + p.c
  // τ = ku·u + cT·ω − (cT/r)·v;  ω̇ = (a11·mgl·θ − kθ·τ)/det,  v̇ = (kx·τ − a12·mgl·θ)/det
  const kTh = a12 / p.r + a11
  const kX = a22 / p.r + a12
  const A = [
    0, 1, 0, 0,
    (a11 * mgl) / det, (-kTh * cT) / det, 0, (kTh * cT) / p.r / det,
    0, 0, 0, 1,
    (-a12 * mgl) / det, (kX * cT) / det, 0, (-kX * cT) / p.r / det,
  ]
  const B = [0, (-kTh * d.ku) / det, 0, (kX * d.ku) / det]
  return { A, B }
}

/**
 * PD gains (counts per rad and per rad/s) for u = Kp·θ + Kd·ω on the reduced angle model: eliminating v̇,
 * J_e·θ̈ = M·g·l·θ − β·τ with J_e = det / a11, and ignoring the cart speed,
 *   J_e·s² + β·(ku·Kd + c)·s + (β·ku·Kp − M·g·l) = 0
 * so a natural frequency ω_n and damping ζ need Kp = (M·g·l + J_e·ω_n²) / (β·ku), Kd = (2ζ·ω_n·J_e − β·c) / (β·ku).
 */
export function pdGains(p: PendulumParams, d: DriveModel, wn: number, zeta: number): { kpRad: number; kdRad: number; je: number } {
  mass(p, 0, MM)
  const je = (MM[0] * MM[2] - MM[1] * MM[1]) / MM[0]
  const bk = d.beta * d.ku
  const cT = d.cEmf + p.c
  return {
    kpRad: (p.M * p.g * p.l + je * wn * wn) / bk,
    kdRad: (2 * zeta * wn * je - d.beta * cT) / bk,
    je,
  }
}

export interface Complex {
  re: number
  im: number
}

/** roots of a monic-or-not polynomial, coefficients highest power first (Durand–Kerner) */
export function polyRoots(coeffs: number[]): Complex[] {
  const a0 = coeffs[0]
  const c = coeffs.map((x) => x / a0)
  const n = c.length - 1
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  // start on a spiral, scaled to the root bound
  const bound = 1 + Math.max(...c.slice(1).map(Math.abs))
  for (let i = 0; i < n; i++) {
    const ang = (2 * Math.PI * i) / n + 0.4
    re[i] = bound * 0.5 * Math.cos(ang)
    im[i] = bound * 0.5 * Math.sin(ang)
  }
  for (let iter = 0; iter < 2000; iter++) {
    let moved = 0
    for (let i = 0; i < n; i++) {
      // p(z_i)
      let pr = 1
      let pi = 0
      for (let k = 1; k <= n; k++) {
        const nr = pr * re[i] - pi * im[i] + c[k]
        pi = pr * im[i] + pi * re[i]
        pr = nr
      }
      // Π (z_i − z_j)
      let qr = 1
      let qi = 0
      for (let j = 0; j < n; j++) {
        if (j === i) continue
        const dr = re[i] - re[j]
        const di = im[i] - im[j]
        const nr = qr * dr - qi * di
        qi = qr * di + qi * dr
        qr = nr
      }
      const den = qr * qr + qi * qi || 1e-300
      const wr = (pr * qr + pi * qi) / den
      const wi = (pi * qr - pr * qi) / den
      re[i] -= wr
      im[i] -= wi
      moved = Math.max(moved, Math.hypot(wr, wi))
    }
    if (moved < 1e-13 * bound) break
  }
  return Array.from({ length: n }, (_, i) => ({ re: re[i], im: Math.abs(im[i]) < 1e-9 ? 0 : im[i] }))
}

/** det(sI − M) of a row-major n×n matrix, highest power first (Faddeev–LeVerrier) */
export function charPoly(m: number[], n: number): number[] {
  const coeffs = [1]
  let mk = new Array(n * n).fill(0)
  let ck = 1
  for (let k = 1; k <= n; k++) {
    // M_k = A·M_{k-1} + c_{n-k+1}·I
    const next = new Array(n * n).fill(0)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        let s = 0
        for (let q = 0; q < n; q++) s += m[i * n + q] * mk[q * n + j]
        next[i * n + j] = s + (i === j ? ck : 0)
      }
    mk = next
    let tr = 0
    for (let i = 0; i < n; i++) for (let q = 0; q < n; q++) tr += m[i * n + q] * mk[q * n + i]
    ck = -tr / k
    coeffs.push(ck)
  }
  return coeffs
}

/** the cascade's gains: u = Kp·(θ − θt) + Kd·ω with θt = −kv·ψ̇ (rad, rad/s, PWM counts) */
export interface CascadeGains {
  /** counts per rad */
  kp: number
  /** counts per rad/s */
  kd: number
  /** rad of lean per rad/s of wheel speed (ψ̇) */
  kv: number
}

/** u = −K·[θ, ω, x, v] for the cascade (ψ̇ = v/r − ω: the encoder sees the wheel turn relative to the body) */
export function cascadeK(g: CascadeGains, r: number): number[] {
  return [-g.kp, -(g.kd - g.kp * g.kv), 0, -(g.kp * g.kv) / r]
}

/**
 * Pole placement for the cascade. The position x feeds nothing back (A's x column is zero), so the loop is
 * the three states [θ, ω, v], and the cascade's three gains are exactly a full state feedback on them:
 * u = Kp·θ + (Kd − Kp·kv)·ω + (Kp·kv/r)·v. The closed-loop characteristic polynomial is affine in those
 * three feedback gains, so matching it to (s − p1)(s − p2)(s − p3) is a 3 × 3 linear solve.
 */
export function placeCascade(p: PendulumParams, d: DriveModel, poles: Complex[]): CascadeGains {
  const { A, B } = linearize(p, d)
  // the [θ, ω, v] subsystem
  const idx = [0, 1, 3]
  const A3 = idx.flatMap((i) => idx.map((j) => A[i * 4 + j]))
  const B3 = idx.map((i) => B[i])
  const poly = (k: number[]) => {
    const m = A3.slice()
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i * 3 + j] -= B3[i] * k[j]
    return charPoly(m, 3)
  }
  const c0 = poly([0, 0, 0])
  const cols = [0, 1, 2].map((j) => poly([0, 1, 2].map((q) => (q === j ? 1 : 0))).map((c, i) => c - c0[i]))
  // desired (s − p1)(s − p2)(s − p3): s³ + d2·s² + d1·s + d0, from the real and complex roots
  let want: Complex[] = [{ re: 1, im: 0 }]
  for (const z of poles) {
    const next: Complex[] = want.map(() => ({ re: 0, im: 0 })).concat([{ re: 0, im: 0 }])
    want.forEach((w, i) => {
      next[i].re += w.re
      next[i].im += w.im
      next[i + 1].re -= w.re * z.re - w.im * z.im
      next[i + 1].im -= w.re * z.im + w.im * z.re
    })
    want = next
  }
  // solve Σ_j cols[j][i]·k_j = want[i] − c0[i] for i = 1..3
  const M = [1, 2, 3].map((i) => [cols[0][i], cols[1][i], cols[2][i], want[i].re - c0[i]])
  for (let c = 0; c < 3; c++) {
    let piv = c
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    ;[M[c], M[piv]] = [M[piv], M[c]]
    for (let r = 0; r < 3; r++) {
      if (r === c) continue
      const f = M[r][c] / M[c][c]
      for (let q = c; q < 4; q++) M[r][q] -= f * M[c][q]
    }
  }
  const k = M.map((row, i) => row[3] / row[i])
  const kp = -k[0]
  const kv = (-k[2] * p.r) / kp
  return { kp, kv, kd: -k[1] + kp * kv }
}

/** the design poles: an angle pair at ω_n 15 rad/s, ζ 0.8 (−12 ± 9i), and the speed loop at −3 rad/s (τ 0.33 s) */
export const DESIGN_POLES: Complex[] = [
  { re: -12, im: 9 },
  { re: -12, im: -9 },
  { re: -3, im: 0 },
]

/** the cascade placed at DESIGN_POLES on the default robot */
export const defaultGains = (b: BotSpec = DEFAULT_BOT): CascadeGains => placeCascade(botParams(b), driveModel(b), DESIGN_POLES)

const D2R = Math.PI / 180
/** rad/s of wheel per rpm */
const RPM = (2 * Math.PI) / 60

/** the sketch's units: Kp counts/°, Kd counts per °/s, KV ° of lean per output rpm */
export function sketchUnits(g: CascadeGains): { kpDeg: number; kdDeg: number; kvDegPerRpm: number } {
  return { kpDeg: g.kp * D2R, kdDeg: g.kd * D2R, kvDegPerRpm: (g.kv * RPM) / D2R }
}

export function fromSketchUnits(kpDeg: number, kdDeg: number, kvDegPerRpm: number): CascadeGains {
  return { kp: kpDeg / D2R, kd: kdDeg / D2R, kv: (kvDegPerRpm * D2R) / RPM }
}

/** the sketch's defaults: `defaultGains()` rounded (pendulum.test.ts checks they still match) */
export const DEFAULT_SKETCH_GAINS = { kp: 20.7, kd: 2.3, kv: 0.11 }

/** eigenvalues of A − B·K (u = −K·x) */
export function closedLoopPoles(A: number[], B: number[], K: number[]): Complex[] {
  const n = B.length
  const m = A.slice()
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) m[i * n + j] -= B[i] * K[j]
  return polyRoots(charPoly(m, n))
}
