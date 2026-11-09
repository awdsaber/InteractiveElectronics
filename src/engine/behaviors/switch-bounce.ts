// switch-bounce: a mechanical push button whose contacts chatter when they make or break.
//
// A tweak `behavior:<instance>.press` (0/1) is the finger. The behavior drives the contact, a SW
// element, to follow it, but after each change the contact flips back and forth a few times for a
// few milliseconds before it settles: the first touch, a bounce open, a bounce closed, ... and then
// the final state. The number of chatters (1..maxBounces) and each interval (minMs..maxMs) come from
// a seeded generator, so a run is repeatable and every press differs.
//
// The contact is set once per frame, from the state at the frame's end, so the intervals must be
// longer than a frame's sim time: the defaults (2-4 ms) suit the lesson's 0.1x speed (1.7 ms frames).
// Real tactile switches chatter from well under a millisecond to several milliseconds; faster
// chatter would need the contact driven inside the transient, which behaviors cannot do.
//
// params: element (the contact SW, default 'SW_CLK'), press (0/1), bounce (1 = chatter, 0 = ideal
// contact), seed (default 1), maxBounces (default 3), minMs / maxMs (default 2 / 4).
// Publishes `presses` (finger-down count since power-on), `closed` (the contact now, 0/1).

import type { Behavior, BehaviorContext } from '../types'

interface State {
  target: number
  presses: number
  events: number
  tStart: number
  /** segment end times (s after tStart): segment k lasts until ends[k]; its state is `target` when k is even */
  ends: number[]
}
const states = new WeakMap<BehaviorContext, State>()
const state = (ctx: BehaviorContext): State => {
  let s = states.get(ctx)
  if (!s) states.set(ctx, (s = { target: 0, presses: 0, events: 0, tStart: 0, ends: [] }))
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

/** the contact's state at sim time t: the final state, or a chatter segment */
function contactAt(s: Pick<State, 'target' | 'tStart' | 'ends'>, t: number): number {
  const dt = t - s.tStart
  for (let k = 0; k < s.ends.length; k++) if (dt < s.ends[k]) return k % 2 === 0 ? s.target : 1 - s.target
  return s.target
}

function clearAll(ctx: BehaviorContext) {
  const s = state(ctx)
  s.presses = 0
  s.ends = []
}

export const behavior: Behavior = {
  id: 'switch-bounce',

  tick(ctx) {
    const s = state(ctx)
    const press = num(ctx.params.press, 0) >= 0.5 ? 1 : 0
    if (press !== s.target) {
      s.target = press
      s.tStart = ctx.t
      s.events++
      if (press) s.presses++
      s.ends = []
      if (num(ctx.params.bounce, 1) >= 0.5) {
        const r = rng(Math.floor(num(ctx.params.seed, 1)) * 7919 + s.events * 104729)
        const maxB = Math.max(1, Math.floor(num(ctx.params.maxBounces, 3)))
        const lo = num(ctx.params.minMs, 2) / 1000
        const hi = Math.max(lo, num(ctx.params.maxMs, 4) / 1000)
        const n = 1 + Math.floor(r() * maxB) // n bounces: n opposite segments, each between target segments
        let at = 0
        for (let k = 0; k < 2 * n; k++) {
          at += lo + r() * (hi - lo)
          s.ends.push(at)
        }
      }
    }
    const el = typeof ctx.params.element === 'string' ? ctx.params.element : 'SW_CLK'
    const c = contactAt(s, ctx.t)
    ctx.setParam(el, 'closed', c === 1)
    ctx.publish('presses', s.presses)
    ctx.publish('closed', c)
  },

  onEvent(ctx, ev) {
    if (ev === 'power-on' || ev === 'power-off' || ev === 'repair' || ev === 'strip') clearAll(ctx)
  },

  reset(ctx) {
    clearAll(ctx)
  },
}
