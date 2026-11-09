// irq-bounce: a push button whose contacts chatter, delivered to an interrupt pin as microsecond edges.
//
// switch-bounce works at frame granularity (its chatter is milliseconds long and the contact is set
// once per frame). An interrupt sees every transition, so this behavior works out the whole burst
// analytically, in MCU time, and injects the edges with `mcu.injectEdge`.
//
// A tweak `behavior:<instance>.press` (0/1) is the finger. On each change the contact makes (or
// breaks) and then chatters: a press is closed, then k open/closed pairs (k = 1..5), a release is
// open, then k closed/open pairs (k = 0..3), all inside a window of 0.5..5 ms. The burst comes from a
// seeded generator, so a run is repeatable and every press differs.
//
// The input RC filter is solved exactly for that contact sequence. The button pulls `node` (the
// resistor's far end) to ground; R = `r` (default r_rc) then charges and discharges C = `c` (default
// c_rc) at the pin. While the contact is closed C discharges toward 0 V with tau = R*C; while it is
// open C charges toward VCC through the pin's internal pull-up (`pullUpOhms`, 35 kΩ in this engine:
// the datasheet gives 20 to 50 kΩ) with tau = Rpu*C. The pin reads LOW once the voltage is below
// 0.3 VCC and HIGH once it is above 0.6 VCC (the ATmega328P's VIL max and VIH min), and an edge is
// injected at each crossing. With C removed the pin follows the contact directly; with R removed the
// button is not connected and nothing happens.
//
// The sw element (`sw`, default 'sw_btn') is set to the finger's state once per tick, for the 3D
// button and the analog circuit (the scope shows the RC curve at the sim step).
//
// params: press (0/1), pin (default 2), sw ('sw_btn'), r ('r_rc'), c ('c_rc'), pullUpOhms (35000),
//   vcc (5), seed (1).
// Publishes presses (finger-down count since power-on), pressed (0/1) and edges_last (falling edges
// the pin saw from the last press).

import type { Behavior, BehaviorContext } from '../types'

interface State {
  target: number
  presses: number
  events: number
  lastNow: number
  lvl: 0 | 1
  /** capacitor voltage once everything queued has settled */
  v: number
  /** MCU time (µs) at which the last queued edge happens */
  tFree: number
  edgesLast: number
}

const states = new WeakMap<BehaviorContext, State>()
function stateOf(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) states.set(ctx, (s = { target: 0, presses: 0, events: 0, lastNow: 0, lvl: 1, v: 5, tFree: 0, edgesLast: 0 }))
  return s
}
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** mulberry32 */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** the value of a netlist element, or null when it is not in the circuit */
function valueOf(ctx: BehaviorContext, id: string): number | null {
  const e = ctx.netlist.elements.find((x) => x.id === id)
  return e ? num((e as { value?: unknown }).value, 0) : null
}

function restart(s: State, vcc: number) {
  s.lvl = 1
  s.v = vcc
  s.tFree = 0
  s.edgesLast = 0
}

export const behavior: Behavior = {
  id: 'irq-bounce',

  tick(ctx) {
    const s = stateOf(ctx)
    const vcc = num(ctx.params.vcc, 5)
    const m = ctx.mcu
    const sw = typeof ctx.params.sw === 'string' ? ctx.params.sw : 'sw_btn'
    const press = num(ctx.params.press, 0) >= 0.5 ? 1 : 0
    const now = m.timeMicros
    if (now < s.lastNow - 1) restart(s, vcc) // the sketch restarted: the MCU clock went back
    s.lastNow = now

    if (press !== s.target) {
      s.target = press
      s.events++
      if (press) s.presses++
      if (ctx.powered && m.running) inject(ctx, s, press === 1, now)
    }
    ctx.setParam(sw, 'closed', press === 1)
    ctx.publish('presses', s.presses)
    ctx.publish('pressed', press)
    ctx.publish('edges_last', s.edgesLast)
  },

  onEvent(ctx, ev) {
    const s = stateOf(ctx)
    if (ev === 'power-on' || ev === 'power-off' || ev === 'upload' || ev === 'repair' || ev === 'strip') {
      restart(s, num(ctx.params.vcc, 5))
      if (ev !== 'upload') s.presses = 0
    }
  },

  reset(ctx) {
    restart(stateOf(ctx), num(ctx.params.vcc, 5))
    stateOf(ctx).presses = 0
  },
}

function inject(ctx: BehaviorContext, s: State, closing: boolean, now: number) {
  const m = ctx.mcu
  const pin = Math.trunc(num(ctx.params.pin, 2))
  const vcc = num(ctx.params.vcc, 5)
  const vil = 0.3 * vcc
  const vih = 0.6 * vcc
  const R = valueOf(ctx, typeof ctx.params.r === 'string' ? ctx.params.r : 'r_rc')
  const C = valueOf(ctx, typeof ctx.params.c === 'string' ? ctx.params.c : 'c_rc') ?? 0
  const Rpu = Math.max(1, num(ctx.params.pullUpOhms, 35000))
  const r = rng(Math.floor(num(ctx.params.seed, 1)) * 7919 + s.events * 104729)

  // the contact sequence: segments of [state, duration µs]; the last lasts for ever
  const k = closing ? 1 + Math.floor(r() * 5) : Math.floor(r() * 4)
  const window = (500 + r() * 4500) * 1 // µs
  const weights: number[] = []
  let wsum = 0
  for (let i = 0; i < 2 * k; i++) {
    const w = 0.2 + r()
    weights.push(w)
    wsum += w
  }
  const segs: { closed: boolean; us: number }[] = []
  for (let i = 0; i < 2 * k; i++) segs.push({ closed: closing ? i % 2 === 0 : i % 2 === 1, us: (weights[i] / wsum) * window })
  segs.push({ closed: closing, us: Infinity })

  let t = Math.max(now + 20, s.tFree)
  s.edgesLast = 0
  if (R === null) return // the button is not connected to the pin

  let lastAt = t
  const emit = (at: number, level: 0 | 1) => {
    if (level === s.lvl) return
    s.lvl = level
    lastAt = at
    m.injectEdge(pin, level, at)
    if (level === 0) s.edgesLast++
  }

  let v = s.v
  for (const seg of segs) {
    const target = seg.closed ? 0 : vcc
    const tau = C > 0 ? (seg.closed ? Math.max(R, 1e-3) : Rpu) * C * 1e6 : 0 // µs
    const last = seg.us === Infinity
    if (tau === 0) {
      // no capacitor: the pin follows the contact
      emit(t, seg.closed ? 0 : 1)
      v = target
    } else if (seg.closed) {
      let crossed = false
      if (s.lvl === 1 && v > vil) {
        const tc = -tau * Math.log(vil / v)
        if (tc <= seg.us) {
          emit(t + tc, 0)
          crossed = true
        }
      }
      // for the last segment, v is its value when the last edge happened
      v = last ? (crossed ? vil : v) : target + (v - target) * Math.exp(-seg.us / tau)
    } else {
      let crossed = false
      if (s.lvl === 0 && v < vih) {
        const tc = -tau * Math.log((vcc - vih) / (vcc - v))
        if (tc <= seg.us) {
          emit(t + tc, 1)
          crossed = true
        }
      }
      v = last ? (crossed ? vih : v) : target + (v - target) * Math.exp(-seg.us / tau)
    }
    if (last) s.tFree = Math.max(lastAt, t)
    else t += seg.us
  }
  s.v = v
}
