// hcsr04: an HC-SR04 ultrasonic ranger, 5 V module, TRIG in and ECHO out.
//
// The sketch pulses TRIG HIGH for at least 10 us. `onPin` (MCU microsecond stamps) measures that
// pulse; a good one starts a ping. The module sends an 8-cycle 40 kHz burst, then holds ECHO HIGH
// for the round-trip time t = 2·d / c, with c = 331.3 + 0.606·T m/s. The behavior schedules both
// ECHO edges ahead of the MCU's clock with `mcu.injectEdge(echoPin, level, µs)`, so the sketch's
// `pulseIn` measures them to the microsecond, whatever the sim step.
//
// What goes wrong:
//   - no echo (the target is under `minCm` or over `maxCm`, or a soft / angled surface loses the
//     ping): the module holds ECHO HIGH for `timeoutUs` (about 38 ms, the figure vendors quote;
//     approximate, varies by clone). A sketch's `pulseIn(…, 30000)` gives up at 30 ms and returns 0;
//     one with no timeout reads about 38 000 us, a 650 cm "distance".
//   - the ECHO wire (`wire`) or the input pin element (`inPin`) is missing: nothing reaches the
//     pin, so `pulseIn` waits out its whole timeout (1 s when none is given: the sketch hangs).
//   - `otherSensor` (crosstalk): `crosstalkPct` of the pings (30 %) end early, at a random time,
//     because the module hears another ranger's burst.
//   - a ping within `minGapUs` (20 ms) of the previous one, or while the previous echo is still
//     being held, is ignored: the module is still listening.
//
// Scope view: the bench simulates the circuit a frame before the MCU catches up, so the ECHO line
// (V source `echoSrc`) and a TRIG marker (V source `trigMon`, drawn `trigViewUs` wide so a 10 us
// pulse shows at the sim step) are replayed from the start of the next frame. Widths and spacing are
// exact; the pair is shifted by under one frame.
//
// params: distanceCm (true distance, 100), airTempC (20), surface ('hard' | 'soft' | 'angled' or
//   0 | 1 | 2; loses 0 / 85 / 75 % of pings), lossPct (overrides the surface when 0..100, else -1),
//   noiseCm (1-sigma range noise, 0.3: illustrative), otherSensor (false), crosstalkPct (30),
//   minCm (2), maxCm (400), timeoutUs (38000), delayUs (500: burst plus processing, approximate),
//   minGapUs (20000), trigMinUs (10), trigPin (9), echoPin (10), trigViewUs (100), seed (1),
//   wire ('w_echo'), inPin ('pin10'), echoSrc ('echo_src'), trigMon ('trig_mon'); an id of '' skips it.
// Publishes true_cm, c_mps, echo_us (last echo width), pings, pings_lost, pings_ignored, strays.
// Allocates nothing per tick or per step.

import type { Behavior, BehaviorContext, PinState } from '../types'

/** speed of sound in air, m/s, at T °C */
export function soundSpeed(tempC: number): number {
  return 331.3 + 0.606 * tempC
}

/** share of pings a surface loses (soft fabric absorbs, an angled wall reflects away) */
const LOSS_SOFT = 0.85
const LOSS_ANGLED = 0.75

interface State {
  trigRise: number
  /** a ping is not accepted before this MCU time */
  busyUntil: number
  rng: number
  pings: number
  lost: number
  ignored: number
  strays: number
  echoUs: number
  /** a ping seen by onPin that tick has not yet scheduled for the scope */
  pend: boolean
  pendTf: number
  pendDelay: number
  pendWidth: number
  /** scope replay: sim time the marker starts, and the echo window after it (µs) */
  viewT0: number
  viewDelay: number
  viewWidth: number
  echoHi: boolean
  trigHi: boolean
  /** MCU µs at sim time 0: maps a frame's sim time to MCU time */
  offset: number
  hasEcho: boolean
  hasMon: boolean
  hasWire: boolean
}

const states = new WeakMap<BehaviorContext, State>()
function stateOf(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = {
      trigRise: -1, busyUntil: -1e12, rng: 1, pings: 0, lost: 0, ignored: 0, strays: 0, echoUs: 0,
      pend: false, pendTf: 0, pendDelay: 0, pendWidth: 0, viewT0: -1e9, viewDelay: 0, viewWidth: 0,
      echoHi: false, trigHi: false, offset: 0, hasEcho: false, hasMon: false, hasWire: true,
    }
    states.set(ctx, s)
  }
  return s
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** mulberry32 on the state's own counter */
function rand(s: State): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0
  let t = s.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** standard normal by Box-Muller */
function gauss(s: State): number {
  const u = Math.max(1e-12, rand(s))
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand(s))
}

/** 0 hard, 1 soft, 2 angled, from either the name or the enum tweak's number */
function surfaceOf(v: unknown): number {
  if (typeof v === 'string') return v === 'soft' ? 1 : v === 'angled' ? 2 : 0
  return Math.max(0, Math.min(2, Math.round(num(v, 0))))
}

function has(ctx: BehaviorContext, id: string): boolean {
  if (id === '') return true
  const els = ctx.netlist.elements
  for (let i = 0; i < els.length; i++) if (els[i].id === id) return true
  return false
}

function disarm(ctx: BehaviorContext, s: State) {
  s.trigRise = -1
  s.busyUntil = -1e12
  s.pings = 0
  s.lost = 0
  s.ignored = 0
  s.strays = 0
  s.echoUs = 0
  s.pend = false
  s.viewT0 = -1e9
  if (s.echoHi && s.hasEcho) ctx.setParam(String(ctx.params.echoSrc ?? 'echo_src'), 'value', 0)
  if (s.trigHi && s.hasMon) ctx.setParam(String(ctx.params.trigMon ?? 'trig_mon'), 'value', 0)
  s.echoHi = false
  s.trigHi = false
}

/** a good trigger pulse ended at MCU time `tf`: start a ping */
function ping(ctx: BehaviorContext, s: State, tf: number) {
  const p = ctx.params
  if (!ctx.powered || !ctx.mcu.running) return
  if (tf < s.busyUntil) {
    s.ignored++
    return
  }
  const minGap = Math.max(0, num(p.minGapUs, 20000))
  s.busyUntil = tf + minGap
  s.pings++
  const echoPin = Math.trunc(num(p.echoPin, 10))
  const delay = Math.max(0, num(p.delayUs, 500))
  const timeout = Math.max(1, num(p.timeoutUs, 38000))
  const c = soundSpeed(num(p.airTempC, 20))
  const d = num(p.distanceCm, 100)
  const noise = Math.max(0, num(p.noiseCm, 0.3))

  let lossFrac = num(p.lossPct, -1)
  if (lossFrac >= 0) lossFrac = Math.min(100, lossFrac) / 100
  else {
    const sf = surfaceOf(p.surface)
    lossFrac = sf === 1 ? LOSS_SOFT : sf === 2 ? LOSS_ANGLED : 0
  }
  const out = d < num(p.minCm, 2) || d > num(p.maxCm, 400)
  const lost = out || (lossFrac > 0 && rand(s) < lossFrac)
  let width: number
  if (lost) {
    width = timeout
    s.lost++
  } else {
    const dn = Math.max(0.1, d + (noise > 0 ? noise * gauss(s) : 0))
    width = ((2 * dn) / 100 / c) * 1e6
  }
  // another ranger's burst ends the echo early, at a random time between 2 cm of range and the echo
  if (p.otherSensor === true || p.otherSensor === 1) {
    if (rand(s) < Math.min(100, Math.max(0, num(p.crosstalkPct, 30))) / 100) {
      const lo = ((2 * 2) / 100 / c) * 1e6
      const hi = lost ? Math.min(23000, timeout) : width
      if (hi > lo) {
        width = lo + rand(s) * (hi - lo)
        s.strays++
      }
    }
  }
  s.echoUs = width
  const wire = String(p.wire ?? 'w_echo')
  const inPin = String(p.inPin ?? 'pin10')
  if (has(ctx, wire) && has(ctx, inPin)) {
    ctx.mcu.injectEdge(echoPin, 1, tf + delay)
    ctx.mcu.injectEdge(echoPin, 0, tf + delay + width)
    s.busyUntil = Math.max(s.busyUntil, tf + delay + width)
  }
  s.pend = true
  s.pendTf = tf
  s.pendDelay = delay
  s.pendWidth = width
}

export const behavior: Behavior = {
  id: 'hcsr04',

  onPin(ctx, pin, ps: PinState, tMicros) {
    if (pin !== Math.trunc(num(ctx.params.trigPin, 9))) return
    const s = stateOf(ctx)
    const high = (ps.mode === 'OUTPUT' || ps.mode === 'OUTPUT_OPEN_DRAIN') && ps.level >= 0.5
    if (high) {
      if (s.trigRise < 0) s.trigRise = tMicros
      return
    }
    if (s.trigRise < 0) return
    const w = tMicros - s.trigRise
    s.trigRise = -1
    if (w >= num(ctx.params.trigMinUs, 10) - 1e-6 && ps.mode.startsWith('OUTPUT')) ping(ctx, s, tMicros)
  },

  tick(ctx) {
    const s = stateOf(ctx)
    const p = ctx.params
    s.hasEcho = has(ctx, String(p.echoSrc ?? 'echo_src'))
    s.hasMon = has(ctx, String(p.trigMon ?? 'trig_mon'))
    s.hasWire = has(ctx, String(p.wire ?? 'w_echo'))
    ctx.publish('true_cm', num(p.distanceCm, 100))
    ctx.publish('c_mps', soundSpeed(num(p.airTempC, 20)))
    ctx.publish('echo_us', s.echoUs)
    ctx.publish('pings', s.pings)
    ctx.publish('pings_lost', s.lost)
    ctx.publish('pings_ignored', s.ignored)
    ctx.publish('strays', s.strays)
    if (!ctx.powered || !ctx.mcu.running) {
      if (s.trigRise >= 0) s.trigRise = -1
      return
    }
    s.offset = ctx.mcu.timeMicros - ctx.t * 1e6
    if (s.pend) {
      s.pend = false
      // replay from the next solve on (the steps up to ctx.t are already simulated)
      s.viewT0 = Math.max(ctx.t, (s.pendTf - s.offset) * 1e-6)
      s.viewDelay = s.pendDelay
      s.viewWidth = s.pendWidth
    }
  },

  // the scope's ECHO and TRIG marker: set from the replay window at each solve
  onStep(ctx, t) {
    const s = stateOf(ctx)
    const r = (t - s.viewT0) * 1e6
    const echo = r >= s.viewDelay && r < s.viewDelay + s.viewWidth && s.hasWire
    if (echo !== s.echoHi) {
      s.echoHi = echo
      if (s.hasEcho) ctx.setParam(String(ctx.params.echoSrc ?? 'echo_src'), 'value', echo ? 5 : 0)
    }
    const trig = r >= 0 && r < Math.max(10, num(ctx.params.trigViewUs, 100))
    if (trig !== s.trigHi) {
      s.trigHi = trig
      if (s.hasMon) ctx.setParam(String(ctx.params.trigMon ?? 'trig_mon'), 'value', trig ? 5 : 0)
    }
  },

  onEvent(ctx, ev) {
    if (ev === 'power-on' || ev === 'power-off' || ev === 'upload' || ev === 'repair' || ev === 'strip') {
      const s = stateOf(ctx)
      s.rng = (Math.floor(num(ctx.params.seed, 1)) * 2654435761) >>> 0
      disarm(ctx, s)
    }
  },

  reset(ctx) {
    disarm(ctx, stateOf(ctx))
  },
}
