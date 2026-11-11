// quad-encoder: an incremental (A/B quadrature) encoder on a MOTOR element's shaft, delivered to the
// MCU as timestamped pin edges. Reusable: a PID lesson or the capstone drops it next to any MOTOR.
//
// The motor's shaft speed ω (the MOTOR element's `extra[<id>.omega]`, rad/s, signed) is integrated
// into an edge phase p (one unit = one A or B edge). The encoder has `ppr` pulses per motor
// revolution on each channel, so a revolution is 4·ppr edges, and each time p crosses an integer the
// state steps one place round the Gray cycle. Forward (ω > 0) the channels run A leads B:
//   (A,B) = 00 → 10 → 11 → 01 → 00 (state index n, A = ((n+1) mod 4) >> 1, B = (n mod 4) >> 1).
// Every edge is scheduled ahead of the MCU's clock with `mcu.injectEdge(pin, level, µs)` (the
// pattern of tach-gen), so edge rates far above the 1 ms sim step still reach the ISR at the exact
// microsecond and `digitalRead` agrees. Several instances work side by side (one per motor): give
// each its own `motor`, pins and element ids.
//
// ISR capacity: an accepted edge costs the ISR `isrUs` of CPU. An edge that arrives sooner than
// that after the last accepted one is merged into it: both level changes land at one instant, so
// the sketch's ISR reads both channels changed at once, which a table decoder flags as an invalid
// transition (and cannot count). The true count keeps going; the difference is the lost counts.
//
// Pull-ups: the hall outputs are open drain, so a channel whose pull-up element (`pullA`, `pullB`)
// is missing from the netlist has no HIGH level. That pin floats and picks up noise instead of the
// channel: random falling/rising pairs at about `noiseHz`.
//
// Glitches: `glitchRate` per second, common-mode spikes (motor-commutation noise coupled into both
// wires at once): both A and B flip for `glitchUs` and flip back. A table decoder sees two invalid
// transitions per glitch; a real edge inside the window can be mis-stepped.
//
// params (defaults): motor 'm1', ppr 11 (per channel per MOTOR revolution), gear 48 (output
//   revolutions = motor revolutions / gear), a 2, b 3 (the MCU pins), swapAB false (A on pin b and
//   B on pin a: the wiring mistake, so forward reads as reverse), isrUs 12, glitchRate 0, glitchUs 20,
//   pullA 'r_pa', pullB 'r_pb' ('' = no pull-up needed), swA 'enc_sa', swB 'enc_sb' (the open-drain
//   switches, driven for the 3D LED and the scope), noiseHz 200, seed 1.
// Publishes: count_true (signed edges since the sketch started, up to the MCU's clock: what a
//   perfect ×4 decoder would hold), rev_out_true (output revolutions), deg_out_true (°), rpm_true
//   (motor shaft), rpm_out_true (output shaft), edge_rate (edges/s), cpr_out (counts per output
//   revolution = 4·ppr·gear), edges_lost (merged by the ISR limit), glitches, noise_edges,
//   floating (pins with no pull-up), count_sync (count_true at the moment the sketch last printed a
//   Serial line).

import type { Behavior, BehaviorContext } from '../types'

const CAP = 16384 // ring of recent true edges
const TWO_PI = 2 * Math.PI

interface State {
  armed: boolean
  lastNow: number
  /** MCU µs up to which edges are generated */
  tSched: number
  /** edge phase at tSched, in edges; n = floor(p) is the state index */
  p: number
  /** the ring of true edges: time (µs) and state index after the edge */
  rt: Float64Array
  rn: Int32Array
  total: number
  curStep: number
  curNow: number
  /** per MCU pin (index 0 = a, 1 = b): last injected level and time, and noise bookkeeping */
  lvl: [number, number]
  lastInj: [number, number]
  floating: [boolean, boolean]
  nextNoise: [number, number]
  lastAcc: number
  lastAccT: number
  nextGlitch: number
  lost: number
  glitches: number
  noise: number
  rng: number
  /** MCU µs at sim time 0 (maps a sim time to MCU time): the largest `timeMicros - t` seen, so a frame where the
   *  MCU lags (it is advanced asynchronously and may fall behind) doesn't pull it back */
  offset: number
  swClosed: [boolean, boolean]
  omega: number
  /** the state index the count is measured from (the shaft position when counting began) */
  baseN: number
  /** the host runs the MCU in lockstep (ctx.mcu.microsAt): edges are made in onStep, one step at a time */
  jit: boolean
  /** ω at the last onStep instant, rad/s (the step's edge rate is the mean of its two ends) */
  wPrev: number
  /** the params as of the last tick, so onStep parses nothing */
  cfg: Cfg
}

interface Cfg {
  motor: string
  key: string
  /** edges per radian */
  k: number
  pins: [number, number]
  swap: boolean
  isrUs: number
  glitchRate: number
  glitchUs: number
  noiseHz: number
}

const states = new WeakMap<BehaviorContext, State>()
function stateOf(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = {
      armed: false, lastNow: 0, tSched: 0, p: 2.5, rt: new Float64Array(CAP), rn: new Int32Array(CAP), total: 0,
      curStep: 0, curNow: 0, lvl: [1, 1], lastInj: [-1e9, -1e9], floating: [false, false], nextNoise: [0, 0],
      lastAcc: -1e9, lastAccT: -1e9, nextGlitch: 1e18, lost: 0, glitches: 0, noise: 0, rng: 1, offset: 0,
      swClosed: [false, false], omega: 0, baseN: N0, jit: false, wPrev: 0,
      cfg: { motor: 'm1', key: 'm1.omega', k: 44 / TWO_PI, pins: [2, 3], swap: false, isrUs: 12, glitchRate: 0, glitchUs: 20, noiseHz: 200 },
    }
    states.set(ctx, s)
  }
  return s
}
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** mulberry32 step on the state's own counter */
function rand(s: State): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0
  let t = s.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** channel A level in state index n (forward: 00, 10, 11, 01) */
export const levelA = (n: number): 0 | 1 => ((((n + 1) % 4) + 4) % 4 >> 1) as 0 | 1
/** channel B level in state index n */
export const levelB = (n: number): 0 | 1 => ((((n % 4) + 4) % 4) >> 1) as 0 | 1
/** the state the sketch sees at rest with both pull-ups high (A = B = 1) */
const N0 = 2

function disarm(s: State) {
  s.armed = false
  s.total = 0
  s.curStep = 0
  s.curNow = 0
  s.lvl = [1, 1]
  s.lastInj = [-1e9, -1e9]
  s.lastAcc = -1e9
  s.lastAccT = -1e9
  s.lost = 0
  s.glitches = 0
  s.noise = 0
  s.swClosed = [false, false]
}

/** the state index after the last ring entry at or before `T`, advancing cursor `c` */
function seek(s: State, c: number, T: number): { c: number; n: number } {
  if (s.total - c > CAP) c = s.total - CAP
  while (c < s.total && s.rt[c % CAP] <= T) c++
  return { c, n: c === 0 ? s.baseN : s.rn[(c - 1) % CAP] }
}

export const behavior: Behavior = {
  id: 'quad-encoder',

  tick(ctx, dt) {
    const s = stateOf(ctx)
    const m = ctx.mcu
    const gear = Math.max(1e-9, num(ctx.params.gear, 48))
    const ppr = Math.max(1e-9, num(ctx.params.ppr, 11))
    const edgesPerRev = 4 * ppr
    const motor = String(ctx.params.motor ?? 'm1')
    const sol = ctx.solution
    const key = `${motor}.omega`
    const omega = ctx.powered && sol ? (sol.extraOf ? sol.extraOf(motor, key) : (sol.extra[key] ?? 0)) || 0 : 0
    s.omega = omega
    const rate = (omega / TWO_PI) * edgesPerRev // edges per second, signed
    ctx.publish('cpr_out', edgesPerRev * gear)
    ctx.publish('rpm_true', ((omega * 60) / TWO_PI))
    ctx.publish('rpm_out_true', (omega * 60) / TWO_PI / gear)
    ctx.publish('edge_rate', Math.abs(rate))
    ctx.publish('edges_lost', s.lost)
    ctx.publish('glitches', s.glitches)
    ctx.publish('noise_edges', s.noise)
    ctx.publish('floating', (s.floating[0] ? 1 : 0) + (s.floating[1] ? 1 : 0))

    const now = m.timeMicros
    // the true count at the MCU's clock
    if (s.armed) s.curNow = seek(s, s.curNow, now).c
    publishCount(ctx, s, edgesPerRev, gear)

    if (!ctx.powered || !m.running) {
      s.armed = false
      return
    }
    const pinA = Math.trunc(num(ctx.params.a, 2))
    const pinB = Math.trunc(num(ctx.params.b, 3))
    const swap = ctx.params.swapAB === true || num(ctx.params.swapAB, 0) >= 0.5
    const isrUs = Math.max(0, num(ctx.params.isrUs, 12))
    const glitchRate = Math.max(0, num(ctx.params.glitchRate, 0))
    const glitchUs = Math.max(1, num(ctx.params.glitchUs, 20))
    const noiseHz = Math.max(1, num(ctx.params.noiseHz, 200))
    const pullA = String(ctx.params.pullA ?? 'r_pa')
    const pullB = String(ctx.params.pullB ?? 'r_pb')
    const floatA = pullA !== '' && !ctx.netlist.elements.some((e) => e.id === pullA)
    const floatB = pullB !== '' && !ctx.netlist.elements.some((e) => e.id === pullB)
    const pins: [number, number] = [pinA, pinB]
    s.cfg = { motor, key, k: edgesPerRev / TWO_PI, pins, swap, isrUs, glitchRate, glitchUs, noiseHz }

    // a restart of the sketch (upload, reset) sets the MCU clock back: begin again. A fresh sketch finds both
    // lines HIGH (the pull-ups) and the shaft at state 11.
    if (!s.armed || now < s.lastNow - 1) {
      disarm(s)
      s.armed = true
      s.rng = (Math.floor(num(ctx.params.seed, 1)) * 2654435761) >>> 0
      s.tSched = now
      s.offset = now - ctx.t * 1e6
      s.floating = [floatA, floatB]
      s.p = N0 + 0.5
      // say so explicitly: setup() may read the pins before the circuit's first solve has pulled them up
      if (!floatA) m.injectEdge(pinA, 1, now)
      if (!floatB) m.injectEdge(pinB, 1, now)
      s.baseN = Math.floor(s.p)
      s.nextNoise = [now + gap(s, noiseHz), now + gap(s, noiseHz)]
      s.nextGlitch = glitchRate > 0 ? now + gap(s, glitchRate) : 1e18
      s.wPrev = omega
    }
    s.lastNow = now
    s.offset = Math.max(s.offset, now - ctx.t * 1e6)

    // a pull-up fitted or removed while running: the pin goes back to the signal, or starts to float
    const fl: [boolean, boolean] = [floatA, floatB]
    for (let i = 0; i < 2; i++) {
      if (fl[i] !== s.floating[i]) {
        s.floating[i] = fl[i]
        const at = Math.max(now, s.lastInj[i]) + 1
        s.nextNoise[i] = at + gap(s, noiseHz)
        if (!fl[i]) {
          const n = Math.floor(s.p)
          const want = i === 0 ? (swap ? levelB(n) : levelA(n)) : swap ? levelA(n) : levelB(n)
          if (want !== s.lvl[i]) m.injectEdge(pins[i], want, at)
          s.lvl[i] = want
          s.lastInj[i] = at
        } else if (s.lvl[i] === 0) {
          m.injectEdge(pins[i], 1, at)
          s.lvl[i] = 1
          s.lastInj[i] = at
        }
      }
    }
    if (glitchRate <= 0) s.nextGlitch = 1e18
    else if (s.nextGlitch > 1e17) s.nextGlitch = now + gap(s, glitchRate)
    if (s.tSched < now) s.tSched = now

    // a lockstep host: onStep makes every step's edges from that step's ω, just in time
    s.jit = !!m.microsAt
    if (s.jit) return

    // otherwise look ahead so the advance that follows this tick already has its edges: two frames (at
    // least 25 ms) past the MCU's clock, and past where the host will advance the MCU to (the end of this
    // frame, which is further than two frames ahead of `now` when the MCU has fallen behind)
    const target = ctx.t * 1e6 + s.offset
    const horizon = Math.max(now + Math.max(2 * dt * 1e6, 25000), target + Math.max(dt * 1e6, 25000))
    generate(ctx, s, now, horizon, rate)
  },

  // Lockstep host: this step's edges, from the mean ω over the step, up to the MCU time of `t` (the MCU
  // has not passed it yet). Then the open-drain outputs for the 3D LED and the scope: the switches
  // follow the true edges.
  onStep(ctx, t, sol) {
    const s = stateOf(ctx)
    const m = ctx.mcu
    let T = t * 1e6 + s.offset
    if (s.jit && m.microsAt) {
      T = m.microsAt(t)
      if (s.armed && m.running) {
        const c = s.cfg
        const w = ctx.powered ? (sol.extraOf ? sol.extraOf(c.motor, c.key) : (sol.extra[c.key] ?? 0)) || 0 : 0
        if (T > s.tSched) generate(ctx, s, m.timeMicros, T, ((s.wPrev + w) / 2) * c.k)
        s.wPrev = w
      }
    }
    const ids = [String(ctx.params.swA ?? 'enc_sa'), String(ctx.params.swB ?? 'enc_sb')]
    let a: number = 1
    let b: number = 1
    if (s.armed) {
      const r = seek(s, s.curStep, T)
      s.curStep = r.c
      a = levelA(r.n)
      b = levelB(r.n)
    }
    const swap = ctx.params.swapAB === true || num(ctx.params.swapAB, 0) >= 0.5
    const lv = swap ? [b, a] : [a, b]
    for (let i = 0; i < 2; i++) {
      // a floating pin has no HIGH level to show: leave its switch open
      const closed = s.armed && !s.floating[i] && lv[i] === 0
      if (closed !== s.swClosed[i]) {
        s.swClosed[i] = closed
        ctx.setParam(ids[i], 'closed', closed)
      }
    }
  },

  // the true count at the instant a Serial line completes: the number the sketch just printed
  // should equal it, so the difference is exactly the counts lost, with no print-lag in it
  onSerial(ctx) {
    const s = stateOf(ctx)
    if (!s.armed) return
    s.curNow = seek(s, s.curNow, ctx.mcu.timeMicros).c
    const n = s.curNow > 0 ? s.rn[(s.curNow - 1) % CAP] - s.baseN : 0
    ctx.publish('count_sync', n)
  },

  onEvent(ctx, ev) {
    const s = stateOf(ctx)
    if (ev === 'repair') {
      // the sketch keeps running and the shaft keeps turning: only the tallies start again, from here
      if (s.armed) {
        s.curNow = seek(s, s.curNow, s.lastNow).c
        s.baseN = s.curNow > 0 ? s.rn[(s.curNow - 1) % CAP] : s.baseN
        s.lost = 0
        s.glitches = 0
        s.noise = 0
      }
    } else if (ev === 'power-on' || ev === 'power-off' || ev === 'upload' || ev === 'strip') disarm(s)
  },

  reset(ctx) {
    disarm(stateOf(ctx))
  },
}

/**
 * Make every edge from s.tSched up to MCU time `horizon` at `rate` edges/s (signed): the true edges from
 * ∫ω, then the noise on a floating pin and the common-mode glitches. `now` is the MCU's clock, the
 * earliest an edge can still be delivered.
 */
function generate(ctx: BehaviorContext, s: State, now: number, horizon: number, rate: number): void {
  const m = ctx.mcu
  const { pins, swap, isrUs, noiseHz, glitchRate, glitchUs } = s.cfg

  // ── the true edges, from ∫ω ──
  const rUs = rate * 1e-6 // edges per µs
  const p0 = s.p
  const t0 = s.tSched
  const span = Math.max(0, horizon - t0) // the horizon can fall behind the last one when the MCU catches up: never run time backwards
  const p1 = p0 + rUs * span
  if (rUs !== 0 && span > 0) {
    const up = rUs > 0
    let guard = 0
    // integer crossings of p between p0 and p1, in time order
    let k = up ? Math.floor(p0) + 1 : Math.floor(p0)
    let nPrev = Math.floor(p0)
    while ((up ? k <= Math.floor(p1) : k > Math.floor(p1)) && guard++ < 200000) {
      const t = t0 + (k - p0) / rUs
      const nNew = up ? k : k - 1
      pushEdge(ctx, s, t, nNew, nPrev, pins, swap, isrUs)
      nPrev = nNew
      k += up ? 1 : -1
    }
  }
  s.p = p1
  s.tSched = Math.max(s.tSched, horizon)

  // ── noise on a floating pin, and the common-mode glitches ──
  for (let i = 0; i < 2; i++) {
    if (!s.floating[i]) continue
    let guard = 0
    while (s.nextNoise[i] < horizon && guard++ < 100000) {
      const g = Math.max(50, gap(s, noiseHz))
      const at = Math.max(s.nextNoise[i], now, s.lastInj[i] + 1)
      m.injectEdge(pins[i], 0, at)
      m.injectEdge(pins[i], 1, at + 0.3 * g)
      s.lvl[i] = 1
      s.lastInj[i] = at + 0.3 * g
      s.noise++
      s.nextNoise[i] = at + g
    }
  }
  if (glitchRate > 0) {
    let guard = 0
    while (s.nextGlitch < horizon && guard++ < 100000) {
      const at = Math.max(s.nextGlitch, now)
      // both channels flip, then flip back to whatever the true level is by then
      const n1 = nAt(s, at, p1)
      const n2 = nAt(s, at + glitchUs, p1)
      for (let i = 0; i < 2; i++) {
        if (s.floating[i]) continue
        const cur = i === 0 ? (swap ? levelB(n1) : levelA(n1)) : swap ? levelA(n1) : levelB(n1)
        const back = i === 0 ? (swap ? levelB(n2) : levelA(n2)) : swap ? levelA(n2) : levelB(n2)
        m.injectEdge(pins[i], 1 - cur, at)
        m.injectEdge(pins[i], back, at + glitchUs)
        s.lvl[i] = back
        s.lastInj[i] = Math.max(s.lastInj[i], at + glitchUs)
      }
      s.glitches++
      s.nextGlitch = at + glitchUs + gap(s, glitchRate)
    }
  }
}

/** the state index at MCU time T from the ring of generated edges (beyond it, the end phase pEnd) */
function nAt(s: State, T: number, pEnd: number): number {
  let c = s.curNow
  while (c < s.total && s.rt[c % CAP] <= T) c++
  if (c < s.total || T <= s.tSched) return c === 0 ? s.baseN : s.rn[(c - 1) % CAP]
  return Math.floor(pEnd)
}

/** exponential gap, µs, for a Poisson rate in 1/s */
function gap(s: State, hz: number): number {
  return (-Math.log(1 - rand(s) * 0.999) * 1e6) / hz
}

/** record a true edge in the ring and deliver it to the MCU (subject to the ISR limit) */
function pushEdge(ctx: BehaviorContext, s: State, t: number, nNew: number, nOld: number, pins: [number, number], swap: boolean, isrUs: number) {
  s.rt[s.total % CAP] = t
  s.rn[s.total % CAP] = nNew
  s.total++
  // the signals as wired: channel A goes to pins[0] unless swapped
  const oldL = [swap ? levelB(nOld) : levelA(nOld), swap ? levelA(nOld) : levelB(nOld)]
  const newL = [swap ? levelB(nNew) : levelA(nNew), swap ? levelA(nNew) : levelB(nNew)]
  let at = t
  if (t - s.lastAcc < isrUs) {
    at = s.lastAccT // merged into the pending request: both changes land together
    s.lost++
  } else {
    s.lastAcc = t
    s.lastAccT = t
  }
  for (let i = 0; i < 2; i++) {
    if (s.floating[i] || newL[i] === oldL[i]) continue
    at = Math.max(at, s.lastInj[i])
    ctx.mcu.injectEdge(pins[i], newL[i], at)
    s.lvl[i] = newL[i]
    s.lastInj[i] = at
  }
}

/** the state index is unwrapped (floor of the phase), so the signed count is its change since arm */
function publishCount(ctx: BehaviorContext, s: State, edgesPerRev: number, gear: number) {
  const count = s.armed && s.curNow > 0 ? s.rn[(s.curNow - 1) % CAP] - s.baseN : 0
  ctx.publish('count_true', count)
  const revOut = count / (edgesPerRev * gear)
  ctx.publish('rev_out_true', revOut)
  ctx.publish('deg_out_true', revOut * 360)
}
