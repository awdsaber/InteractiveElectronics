// intermittent: a cracked or cold solder joint that makes and breaks contact at random, the classic
// fault that "goes away when you look at it".
//
// The joint is one R element (`element`). While `active` is 0 it is a good contact (`good` Ω). Once
// `active` is 1 (usually a failure's `set` patch on `behavior:<instance>`), it alternates between a
// good contact and a poor one (`bad` Ω): each spell lasts a random time drawn from an exponential
// distribution with mean `goodMs` / `badMs`, never shorter than `minMs`. A seeded generator makes
// the sequence repeatable. A real cold joint is erratic (tens of ohms to open, set off by heat and
// vibration); one `bad` value is the level that teaches it.
//
// Params (defaults): element 'j1', good 0.01 Ω, bad 1000 Ω, active 0, goodMs 600, badMs 150,
//   minMs 30, seed 7.
// Publishes: bad (1 while the contact is poor), breaks (good → poor transitions since power-on or
//   repair), contact_ohm.

import type { Behavior, BehaviorContext } from '../types'

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

interface State {
  bad: boolean
  /** sim time left in the current spell, s */
  left: number
  breaks: number
  rng: number
}

const states = new WeakMap<BehaviorContext, State>()

function fresh(ctx: BehaviorContext): State {
  // scramble the seed (a small xorshift state gives tiny first outputs, i.e. very long first spells)
  const seed = (Math.imul(Math.trunc(num(ctx.params.seed, 7)) | 0, 2654435761) ^ 0x9e3779b9) >>> 0
  const s: State = { bad: false, left: -1, breaks: 0, rng: seed || 1 }
  for (let i = 0; i < 8; i++) uniform(s)
  return s
}

function state(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = fresh(ctx)
    states.set(ctx, s)
  }
  return s
}

/** xorshift32 → (0, 1) */
function uniform(s: State): number {
  let x = s.rng
  x ^= x << 13
  x >>>= 0
  x ^= x >>> 17
  x ^= x << 5
  x >>>= 0
  s.rng = x || 1
  return (s.rng + 0.5) / 4294967296
}

function spell(ctx: BehaviorContext, s: State, bad: boolean): number {
  const mean = num(bad ? ctx.params.badMs : ctx.params.goodMs, bad ? 150 : 600) / 1000
  const min = num(ctx.params.minMs, 30) / 1000
  return Math.max(min, -mean * Math.log(uniform(s)))
}

function apply(ctx: BehaviorContext, s: State): void {
  const id = String(ctx.params.element ?? 'j1')
  const ohm = s.bad ? num(ctx.params.bad, 1000) : num(ctx.params.good, 0.01)
  ctx.setParam(id, 'value', ohm)
  ctx.publish('bad', s.bad ? 1 : 0)
  ctx.publish('breaks', s.breaks)
  ctx.publish('contact_ohm', ohm)
}

export const behavior: Behavior = {
  id: 'intermittent',

  init(ctx) {
    apply(ctx, state(ctx))
  },

  tick(ctx, dt) {
    const s = state(ctx)
    if (num(ctx.params.active, 0) < 0.5) {
      s.bad = false
      s.left = -1
    } else {
      if (s.left < 0) s.left = spell(ctx, s, false)
      s.left -= dt
      while (s.left <= 0) {
        s.bad = !s.bad
        if (s.bad) s.breaks++
        s.left += spell(ctx, s, s.bad)
      }
    }
    apply(ctx, s)
  },

  onEvent(ctx, ev) {
    if (ev === 'power-on' || ev === 'strip') {
      const s = state(ctx)
      s.breaks = 0
    }
  },

  reset(ctx) {
    const s = fresh(ctx)
    states.set(ctx, s)
    apply(ctx, s)
  },
}
