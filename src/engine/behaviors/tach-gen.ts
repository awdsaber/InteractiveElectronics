// tach-gen: a Hall tachometer on a test wheel, one pulse per revolution, delivered to the MCU as
// timestamped pin edges so pulse rates far above the 1 ms sim step still work.
//
// The sensor is an A3144-type open-collector output with a pull-up (r_pull): idle HIGH, LOW for
// about a quarter of each revolution. The behavior schedules each falling edge (and the rising edge
// that follows) ahead of the MCU's clock with `mcu.injectEdge(pin, level, µs)`, so the sketch's
// attachInterrupt(…, FALLING) ISR fires at the exact microsecond and `digitalRead` agrees.
//
// ISR capacity: every accepted edge costs the ISR `isrUs` of CPU (about 4 cycles of hardware entry
// plus the Arduino dispatch wrapper and the user code: approximate). An edge that comes sooner than
// `isrUs` after the last accepted one is dropped and counted; the AVR has one flag per interrupt, so
// it would merge into the pending request. The ceiling is therefore about 1 / isrUs.
//
// Floating input: when the pull-up element is missing from the netlist the open-collector output
// has no high level, so the pin picks up noise instead. The wheel is ignored and the pin gets
// random falling edges at about `noiseHz`.
//
// params: hz (wheel pulses per second, default 50), pin (default 3), isrUs (default 5),
//   duty (fraction of a period spent LOW, default 0.25), pull (pull-up element id, default 'r_pull'),
//   sw (the sensor's SW element, driven for the 3D LED and the scope below 200 Hz, default 'tach_sw'),
//   noiseHz (default 120), jitter (fractional period jitter, default 0.01), seed (default 1).
// Publishes true_hz (the wheel, 0 until powered), dropped (edges the ISR could not take, since
// the sketch started) and delivered (edges the ISR took).

import type { Behavior, BehaviorContext } from '../types'

interface State {
  armed: boolean
  lastNow: number
  /** the first falling edge not yet delivered, MCU µs */
  next: number
  /** MCU time of the last event delivered (a rising or falling edge) */
  lastInj: number
  /** level the pin was last driven to */
  lvl: 0 | 1
  lastAccept: number
  lastFall: number
  lastWidth: number
  hz: number
  floating: boolean
  dropped: number
  delivered: number
  rngState: number
  /** MCU µs at sim time 0 of the current frame: maps onStep's t to MCU time */
  offset: number
  swClosed: boolean
}

const states = new WeakMap<BehaviorContext, State>()
function stateOf(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = {
      armed: false, lastNow: 0, next: 0, lastInj: 0, lvl: 1, lastAccept: -1e9, lastFall: -1e9, lastWidth: 0,
      hz: 0, floating: false, dropped: 0, delivered: 0, rngState: 1, offset: 0, swClosed: false,
    }
    states.set(ctx, s)
  }
  return s
}
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** mulberry32 step on the state's own counter */
function rand(s: State): number {
  s.rngState = (s.rngState + 0x6d2b79f5) >>> 0
  let t = s.rngState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function disarm(s: State) {
  s.armed = false
  s.dropped = 0
  s.delivered = 0
  s.lastAccept = -1e9
  s.lastFall = -1e9
  s.lvl = 1
  s.swClosed = false
}

export const behavior: Behavior = {
  id: 'tach-gen',

  tick(ctx, dt) {
    const s = stateOf(ctx)
    const hz = Math.max(0, num(ctx.params.hz, 50))
    const m = ctx.mcu
    ctx.publish('true_hz', ctx.powered ? hz : 0)
    ctx.publish('dropped', s.dropped)
    ctx.publish('delivered', s.delivered)
    if (!ctx.powered || !m.running) {
      s.armed = false
      return
    }
    const pin = Math.trunc(num(ctx.params.pin, 3))
    const isrUs = Math.max(0, num(ctx.params.isrUs, 5))
    const duty = Math.min(0.9, Math.max(0.02, num(ctx.params.duty, 0.25)))
    const noiseHz = Math.max(1, num(ctx.params.noiseHz, 120))
    const jitter = Math.min(0.2, Math.max(0, num(ctx.params.jitter, 0.01)))
    const pullId = String(ctx.params.pull ?? 'r_pull')
    const floating = pullId !== '' && !ctx.netlist.elements.some((e) => e.id === pullId)
    const now = m.timeMicros

    // a restart of the sketch (upload, reset) sets the MCU clock back: begin again
    if (!s.armed || now < s.lastNow - 1) {
      disarm(s)
      s.armed = true
      s.rngState = (Math.floor(num(ctx.params.seed, 1)) * 2654435761) >>> 0
      s.lastInj = now
      s.hz = hz
      s.floating = floating
      s.next = now + (floating ? 1e6 / noiseHz : hz > 0 ? 1e6 / hz : 1e12)
    }
    s.lastNow = now
    s.offset = now - ctx.t * 1e6

    if (floating !== s.floating) {
      s.floating = floating
      if (s.lvl === 0) m.injectEdge(pin, 1, Math.max(now, s.lastInj) + 1)
      s.lvl = 1
      s.lastInj = Math.max(now, s.lastInj) + 1
      s.next = Math.max(now, s.lastInj) + (floating ? 1e6 / noiseHz : hz > 0 ? 1e6 / hz : 1e12)
      s.hz = hz
    } else if (hz !== s.hz) {
      // a new wheel speed takes over from the last edge already delivered
      s.hz = hz
      if (!floating) s.next = Math.max(now, s.lastInj) + (hz > 0 ? 1e6 / hz : 1e12)
    }

    // look ahead two frames (at least 25 ms) so the next advance already has its edges
    const horizon = now + Math.max(2 * dt * 1e6, 25000)
    if (floating) {
      // Poisson-ish noise: a falling edge after an exponential gap, LOW for 30 % of the gap
      while (s.next < horizon) {
        const gap = Math.max(50, (-Math.log(1 - rand(s) * 0.999) * 1e6) / noiseHz)
        const at = Math.max(s.next, now)
        m.injectEdge(pin, 0, at)
        m.injectEdge(pin, 1, at + 0.3 * gap)
        s.lastInj = at + 0.3 * gap
        s.delivered++
        s.next = at + gap
      }
      return
    }
    if (hz <= 0) return
    const period = 1e6 / hz
    const width = period * duty
    let guard = 0
    while (s.next < horizon && guard++ < 400000) {
      const at = Math.max(s.next, now)
      if (at - s.lastAccept >= isrUs) {
        m.injectEdge(pin, 0, at)
        m.injectEdge(pin, 1, at + width)
        s.lastAccept = at
        s.lastFall = at
        s.lastWidth = width
        s.lastInj = at + width
        s.delivered++
      } else {
        s.dropped++
      }
      // a real wheel is never perfectly regular; the jitter also stops a fixed-rate polling loop
      // from locking onto one phase of the pulse train
      s.next += period * (1 + jitter * (2 * rand(s) - 1))
    }
  },

  // the sensor's LED / scope trace at low rates: the SW follows the schedule at each solve
  onStep(ctx, t) {
    const s = stateOf(ctx)
    const id = String(ctx.params.sw ?? 'tach_sw')
    let closed = false
    if (s.armed && !s.floating && s.hz > 0 && s.hz < 200 && s.lastFall > -1e8) {
      const period = 1e6 / s.hz
      const at = t * 1e6 + s.offset
      const d = (((at - s.lastFall) % period) + period) % period
      closed = d < s.lastWidth
    }
    if (closed !== s.swClosed) {
      s.swClosed = closed
      ctx.setParam(id, 'closed', closed)
    }
  },

  onEvent(ctx, ev) {
    if (ev === 'power-on' || ev === 'power-off' || ev === 'upload' || ev === 'repair' || ev === 'strip') disarm(stateOf(ctx))
  },

  reset(ctx) {
    disarm(stateOf(ctx))
  },
}
