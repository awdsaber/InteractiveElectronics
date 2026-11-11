// balance-bot: a two-wheel balancing robot in its pitch plane (src/engine/robot/pendulum.ts), co-simulated
// with the two gear motors the circuit already solves.
//
// Coupling, every transient step (onStep): the circuit has just solved the winding currents with the shaft
// speeds this behavior prescribed (MOTOR `omegaSet`), so the wheels get τ = polarity · eff · N · Σ kt·i
// (back-EMF and the bridge's drive both live in that current). The pendulum integrates over the step in
// semi-implicit Euler substeps of at most 0.25 ms, and each motor's next shaft speed is set to
// polarity · N · ψ̇, ψ̇ = v/r − θ̇ (the rotor turns against the stator on the body). So the electrical side
// is solved implicitly by the MNA and the mechanics here, with one 1 ms step of lag on ω. The rotors'
// inertia (Σ N²·J_m) and the gearbox's viscous friction (Σ N²·b_m) come from the MOTOR elements' own j and b.
//
// It publishes the pitch from onStep, so an `imu-mpu6050` with pitchSource '<instance>.pitch' and perStep 1,
// listed after this behavior, samples the same step: `pitch` (°), `pitch_rate` (°/s), and the IMU's
// non-gravity specific force in its own axes, `pitch_ax_g` / `pitch_az_g` (g), at height `imuH` on the body.
// The encoders (quad-encoder) count the motors' prescribed ω.
//
// States: held (by hand: upright and still, wheels on the floor and unable to turn), free (balancing or
// falling), lying (past `fallDeg` it is down; it keeps falling to `restDeg` and lies there, wheels free).
// It is held from power-on, upload and repair until the sketch has run `releaseMs` (its gyro calibration),
// and while the momentary tweak `hold` is pressed; letting go of `hold` releases it at once. When picked up
// from the floor it is swung upright at `liftDegS` (the gyro sees that rotation). A push of `pushN` (N, at the
// COM, + forward) is applied for `pushMs` each time the momentary tweak `push` is pressed.
//
// Params (defaults): motorL 'm_l', motorR 'm_r', M 0.8 kg, l 0.08 m (COM above the axle), Ic 0.003 kg·m²,
// r 0.0325 m, wheelMass 0.03 kg (each), gear 48, eff 0.7, polarity 1 (−1: both motors' leads swapped),
// fallDeg 45, restDeg 78, releaseMs 900 (just after the sketch's 0.8 s calibration), liftDegS 240, hold 0, push 0, pushN 3, pushMs 50, imuH 0.015 m.
// Publishes: pitch, pitch_rate, pitch_ax_g, pitch_az_g, x_m, x_cm, v_mps, wheel_rpm (output, relative to
// the body), tau_Nm, held, fallen, falls, pole_rad_s (free-wheel open-loop pole at the current params),
// pivot_pole_rad_s, push_N. Allocates nothing per step.

import { ACC, botParams, freePole, pivotPole, stepPendulum, type BotSpec, type PendulumParams, type PendulumState } from '../robot/pendulum'
import type { Behavior, BehaviorContext, Element, Solution } from '../types'

const D2R = Math.PI / 180
const R2D = 180 / Math.PI
const H_MAX = 2.5e-4
const RING_FROM = 0.3
const RING_TO = 1.5
const G = 9.81

const num = (v: unknown, d: number) => {
  const x = typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : NaN
  return Number.isFinite(x) ? x : d
}
const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d)

const MODE = { HELD: 0, FREE: 1, LYING: 2 } as const

interface Motor {
  id: string
  kt: number
  j: number
  b: number
}

interface State {
  mode: number
  s: PendulumState
  /** ψ̇ while the wheels are in the air (held or lying), rad/s */
  psiFree: number
  lastT: number
  /** the sketch has been running long enough: let go once */
  released: boolean
  holdPrev: number
  pushPrev: number
  pushLeft: number
  /** the push's force, latched when it starts: a short press still pushes for the full pushMs */
  pushF: number
  fallen: number
  falls: number
  pushes: number
  /** EMA of θ̇² ((°/s)², τ 1 s): the wobble */
  ms: number
  /** the ring after the last push: time since it (−1 when done), Σ θ̇²·dt, Σ dt, and the result (°/s rms) */
  ringT: number
  ringSum: number
  ringN: number
  ring: number
  tau: number
  thdd: number
  xdd: number
  // params resolved from the netlist and ctx.params
  p: PendulumParams
  spec: BotSpec
  mL: Motor
  mR: Motor
  sig: string
  keyL: string
  keyR: string
}

const states = new WeakMap<BehaviorContext, State>()

function motorOf(ctx: BehaviorContext, id: string): Motor {
  const el = ctx.netlist.elements.find((e: Element) => e.id === id)
  if (el && el.type === 'MOTOR') return { id, kt: el.kt ?? el.ke, j: el.j ?? 1e-6, b: el.b ?? 0 }
  return { id, kt: 0, j: 0, b: 0 }
}

/** rebuild the physical params when the inputs change (a COM tweak, a failure) */
function refresh(ctx: BehaviorContext, st: State): void {
  const q = ctx.params
  const mLid = str(q.motorL, 'm_l')
  const mRid = str(q.motorR, 'm_r')
  const sig = [mLid, mRid, q.M, q.l, q.Ic, q.r, q.wheelMass, q.gear, q.eff, ctx.netlist.elements.length].join('|')
  if (sig === st.sig) return
  st.sig = sig
  st.mL = motorOf(ctx, mLid)
  st.mR = motorOf(ctx, mRid)
  st.keyL = mLid
  st.keyR = mRid
  const m = st.mL
  st.spec = {
    M: num(q.M, 0.8),
    l: Math.max(0.005, num(q.l, 0.08)),
    Ic: num(q.Ic, 0.003),
    r: num(q.r, 0.0325),
    wheelMass: num(q.wheelMass, 0.03),
    gear: num(q.gear, 48),
    eff: num(q.eff, 0.7),
    motor: { r: 4, ke: m.kt, kt: m.kt, j: m.j, b: m.b },
    rDrive: 0,
    rBat: 0,
    vBat: 0,
    motors: 2,
    pwmFull: 255,
  }
  st.p = botParams(st.spec)
}

function state(ctx: BehaviorContext): State {
  let st = states.get(ctx)
  if (!st) {
    st = {
      mode: MODE.HELD,
      s: { x: 0, v: 0, theta: 0, omega: 0 },
      psiFree: 0,
      lastT: NaN,
      released: false,
      holdPrev: 0,
      pushPrev: 0,
      pushLeft: 0,
      pushF: 0,
      fallen: 0,
      falls: 0,
      pushes: 0,
      ms: 0,
      ringT: -1,
      ringSum: 0,
      ringN: 0,
      ring: 0,
      tau: 0,
      thdd: 0,
      xdd: 0,
      p: botParams({ M: 0.8, l: 0.08, Ic: 0.003, r: 0.0325, wheelMass: 0.03, gear: 48, eff: 0.7, motor: { r: 4, ke: 0, kt: 0, j: 0, b: 0 }, rDrive: 0, rBat: 0, vBat: 0, motors: 2, pwmFull: 255 }),
      spec: null as unknown as BotSpec,
      mL: { id: 'm_l', kt: 0, j: 0, b: 0 },
      mR: { id: 'm_r', kt: 0, j: 0, b: 0 },
      sig: '',
      keyL: 'm_l',
      keyR: 'm_r',
    }
    states.set(ctx, st)
  }
  return st
}

/** picked up and put upright, still: the next free run starts from rest at x = 0 */
function pickUp(st: State, resetX: boolean): void {
  st.mode = MODE.HELD
  st.s.v = 0
  st.s.omega = 0
  if (resetX) st.s.x = 0
  st.fallen = 0
  st.pushLeft = 0
  st.thdd = 0
  st.xdd = 0
}

function restart(st: State): void {
  pickUp(st, true)
  st.s.theta = 0
  st.psiFree = 0
  st.released = false
  st.lastT = NaN
  st.ms = 0
}

const currentOf = (sol: Solution, id: string) => (sol.currentOf ? sol.currentOf(id) : (sol.current[id] ?? 0)) || 0

function onStep(ctx: BehaviorContext, t: number, sol: Solution): void {
  const st = state(ctx)
  refresh(ctx, st)
  const q = ctx.params
  const p = st.p
  const s = st.s
  const h = t - st.lastT
  st.lastT = t
  const pol = num(q.polarity, 1) < 0 ? -1 : 1
  const gear = st.spec.gear
  const eff = st.spec.eff
  // the motors' torque on the wheels, from the currents the circuit just solved
  const tau = pol * eff * gear * (st.mL.kt * currentOf(sol, st.mL.id) + st.mR.kt * currentOf(sol, st.mR.id))
  st.tau = tau

  // ── the hand: hold, let go, push ──
  const hold = num(q.hold, 0) >= 0.5 ? 1 : 0
  if (hold && !st.holdPrev) pickUp(st, false)
  if (!hold && st.holdPrev && st.mode === MODE.HELD) st.mode = MODE.FREE
  st.holdPrev = hold
  if (!st.released && st.mode === MODE.HELD && !hold && ctx.mcu.running && ctx.mcu.timeMicros >= num(q.releaseMs, 900) * 1000) {
    st.released = true
    st.mode = MODE.FREE
  }
  const push = num(q.push, 0) >= 0.5 ? num(q.pushN, 3) : 0
  if (push !== 0 && st.pushPrev === 0) {
    st.pushLeft = num(q.pushMs, 50) / 1000
    st.pushF = push
    st.pushes++
    st.ringT = 0
    st.ringSum = 0
    st.ringN = 0
  }
  st.pushPrev = push
  // the ring after a push: rms pitch rate from 0.3 s to 1.5 s after it (the catch is over by then), held
  if (st.ringT >= 0 && h > 1e-9 && h < 0.05) {
    st.ringT += h
    if (st.ringT > RING_FROM) {
      const r = st.mode === MODE.FREE ? s.omega * R2D : 0
      st.ringSum += r * r * h
      st.ringN += h
    }
    if (st.ringT >= RING_TO || st.mode === MODE.LYING) {
      st.ring = st.mode === MODE.LYING ? 999 : Math.sqrt(st.ringSum / Math.max(1e-9, st.ringN))
      st.ringT = -1
    }
  }

  if (h > 1e-9 && h < 0.05) {
    if (st.mode === MODE.FREE) {
      const n = Math.max(1, Math.ceil(h / H_MAX - 1e-9))
      const hs = h / n
      const fall = num(q.fallDeg, 45)
      const rest = num(q.restDeg, 78) * D2R
      for (let k = 0; k < n; k++) {
        const f = st.pushLeft > 0 ? st.pushF : 0
        if (st.pushLeft > 0) st.pushLeft -= hs
        stepPendulum(p, s, tau, f, hs)
        if (!st.fallen && Math.abs(s.theta) > fall * D2R) {
          st.fallen = 1
          st.falls++
        }
        if (Math.abs(s.theta) >= rest) {
          // it hits the floor: lies there, wheels free
          s.theta = Math.sign(s.theta) * rest
          st.psiFree = s.v / p.r - s.omega
          s.v = 0
          s.omega = 0
          st.mode = MODE.LYING
          break
        }
      }
      st.xdd = ACC[0]
      st.thdd = ACC[1]
    } else {
      if (st.mode === MODE.HELD) {
        // swung upright by hand at liftDegS, then held still with its wheels on the floor: they cannot turn
        // (the wheel turns with the body while it swings up)
        const step = num(q.liftDegS, 240) * D2R * h
        const d = Math.max(-step, Math.min(step, -s.theta))
        s.theta += d
        s.omega = d / h
        st.psiFree = -s.omega
      } else {
        // lying: the wheels are off the floor and spin freely against their friction
        const jw = p.Iw + p.Jr
        if (jw > 0) st.psiFree += ((tau - p.c * st.psiFree) / jw) * h
        s.omega = 0
      }
      s.v = 0
      st.xdd = 0
      st.thdd = 0
    }
  }

  // ── each motor's next shaft speed ──
  const psiDot = st.mode === MODE.FREE ? s.v / p.r - s.omega : st.psiFree
  const w = pol * gear * psiDot
  ctx.setParam(st.keyL, 'omegaSet', w)
  ctx.setParam(st.keyR, 'omegaSet', w)

  // ── the IMU's view, this very step ──
  const c = Math.cos(s.theta)
  const sn = Math.sin(s.theta)
  const hI = num(q.imuH, 0.015)
  const asx = st.xdd + hI * (st.thdd * c - s.omega * s.omega * sn)
  const asy = -hI * (st.thdd * sn + s.omega * s.omega * c)
  ctx.publish('pitch', s.theta * R2D)
  ctx.publish('pitch_rate', s.omega * R2D)
  ctx.publish('pitch_ax_g', (asx * c - asy * sn) / G)
  ctx.publish('pitch_az_g', (asx * sn + asy * c) / G)
  ctx.publish('x_m', s.x)
  ctx.publish('x_cm', s.x * 100)
  ctx.publish('v_mps', s.v)
  // the wobble: rms of the pitch rate over about a second (0 while held): a ring, not a slow wander
  if (h > 1e-9 && h < 0.05) {
    const deg = st.mode === MODE.FREE ? s.omega * R2D : 0
    st.ms += (deg * deg - st.ms) * Math.min(1, h / 1.0)
  }
}

export const behavior: Behavior = {
  id: 'balance-bot',
  init(ctx) {
    const st = state(ctx)
    refresh(ctx, st)
    ctx.setParam(st.keyL, 'omegaSet', 0)
    ctx.setParam(st.keyR, 'omegaSet', 0)
  },
  onStep,
  tick(ctx) {
    const st = state(ctx)
    refresh(ctx, st)
    const s = st.s
    ctx.publish('pitch', s.theta * R2D)
    ctx.publish('pitch_rate', s.omega * R2D)
    ctx.publish('x_m', s.x)
    ctx.publish('x_cm', s.x * 100)
    ctx.publish('v_mps', s.v)
    const psiDot = st.mode === MODE.FREE ? s.v / st.p.r - s.omega : st.psiFree
    ctx.publish('wheel_rpm', (psiDot * 60) / (2 * Math.PI))
    ctx.publish('tau_Nm', st.tau)
    ctx.publish('held', st.mode === MODE.HELD ? 1 : 0)
    ctx.publish('lying', st.mode === MODE.LYING ? 1 : 0)
    ctx.publish('fallen', st.fallen)
    ctx.publish('falls', st.falls)
    ctx.publish('pushes', st.pushes)
    ctx.publish('wobble_dps', Math.sqrt(st.ms))
    ctx.publish('ring_dps', st.ring)
    ctx.publish('pole_rad_s', freePole(st.p))
    ctx.publish('pivot_pole_rad_s', pivotPole(st.p))
    ctx.publish('push_N', st.pushLeft > 0 ? st.pushF : 0)
  },
  onEvent(ctx, ev) {
    if (ev === 'power-on' || ev === 'power-off' || ev === 'upload' || ev === 'repair' || ev === 'strip') restart(state(ctx))
  },
  reset(ctx) {
    restart(state(ctx))
  },
}
