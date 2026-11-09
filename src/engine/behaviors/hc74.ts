// hc74: one half of a 74HC74 D-type flip-flop, positive-edge triggered.
//
// On each LOW-to-HIGH transition of CP it copies D to Q (and the complement to Q-bar); at any other
// time D is ignored. The clock and D are read on every instantaneous solve (`onStep`). Q and Q-bar
// are V elements set once per frame (give them an rInternal of tens of ohms: a CMOS output stage).
// No set/reset pins are modelled. Powers up with Q = 0.
//
// params: d (node, default 'd'), clk (node, default 'ck'), q / qn (V element ids), vcc (default 5).
// Input levels are the 74HC guarantees at 4.5 V (NXP 74HC74): V_IH 3.15 V min, V_IL 1.35 V max,
// scaled with vcc/4.5. Publishes `q` (0/1).

import type { Behavior, BehaviorContext, Solution } from '../types'

interface State {
  q: number
  low: boolean
}
const states = new WeakMap<BehaviorContext, State>()
const state = (ctx: BehaviorContext): State => {
  let s = states.get(ctx)
  if (!s) states.set(ctx, (s = { q: 0, low: false }))
  return s
}
const volt = (s: Solution, node: string) => (s.voltageOf ? s.voltageOf(node) : (s.nodeV[node] ?? 0))
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d)

function clearAll(ctx: BehaviorContext) {
  const s = state(ctx)
  s.q = 0
  s.low = false
}

export const behavior: Behavior = {
  id: 'hc74',

  onStep(ctx, _t, sol) {
    if (!ctx.powered) return
    const s = state(ctx)
    const vcc = num(ctx.params.vcc, 5)
    const vih = (3.15 / 4.5) * vcc
    const vil = (1.35 / 4.5) * vcc
    const c = volt(sol, str(ctx.params.clk, 'ck'))
    if (c < vil) s.low = true
    else if (c > vih && s.low) {
      s.low = false
      s.q = volt(sol, str(ctx.params.d, 'd')) > vcc / 2 ? 1 : 0
    }
  },

  tick(ctx) {
    const s = state(ctx)
    const vcc = num(ctx.params.vcc, 5)
    const on = ctx.powered
    ctx.setParam(str(ctx.params.q, 'V_DQ'), 'value', on ? s.q * vcc : 0)
    ctx.setParam(str(ctx.params.qn, 'V_DQN'), 'value', on ? (1 - s.q) * vcc : 0)
    if (on) ctx.publish('q', s.q)
  },

  onEvent(ctx, ev) {
    if (ev === 'power-on' || ev === 'power-off' || ev === 'repair' || ev === 'strip') clearAll(ctx)
  },

  reset(ctx) {
    clearAll(ctx)
  },
}
