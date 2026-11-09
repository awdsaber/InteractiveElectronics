// hc393: a 74HC393 4-bit binary ripple counter (one of its two counters).
//
// It counts HIGH-to-LOW transitions of its clock pin (nCP) and a HIGH on MR clears it. The clock is
// read on every instantaneous solve (`onStep`), so no edge is missed whatever the frame rate. The
// four outputs Q0 (LSB) to Q3 are V elements set to 0 or vcc once per frame (CMOS output stage:
// give the V elements an rInternal of tens of ohms).
//
// params: clk (node, default 'nck'), mr (node, optional), q (comma-separated V element ids, Q0 first),
// vcc (default 5). Input levels are the 74HC guarantees at 4.5 V (NXP 74HC393): V_IH 3.15 V min,
// V_IL 1.35 V max, scaled with vcc/4.5; the HIGH-to-LOW trip is armed only after a true HIGH.
// Publishes `count` (0..15), `edges` (falling edges seen since power-on, unwrapped), `b0`..`b3`.

import type { Behavior, BehaviorContext, Solution } from '../types'

interface State {
  count: number
  edges: number
  high: boolean
  mrHigh: boolean
}
const states = new WeakMap<BehaviorContext, State>()
const state = (ctx: BehaviorContext): State => {
  let s = states.get(ctx)
  if (!s) states.set(ctx, (s = { count: 0, edges: 0, high: false, mrHigh: false }))
  return s
}
const volt = (s: Solution, node: string) => (s.voltageOf ? s.voltageOf(node) : (s.nodeV[node] ?? 0))
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d)

function clearAll(ctx: BehaviorContext) {
  const s = state(ctx)
  s.count = 0
  s.edges = 0
  s.high = false
  s.mrHigh = false
}

export const behavior: Behavior = {
  id: 'hc393',

  onStep(ctx, _t, sol) {
    if (!ctx.powered) return
    const s = state(ctx)
    const vcc = num(ctx.params.vcc, 5)
    const vih = (3.15 / 4.5) * vcc
    const vil = (1.35 / 4.5) * vcc
    const mr = str(ctx.params.mr, '')
    if (mr) {
      const m = volt(sol, mr)
      if (m > vih) {
        s.mrHigh = true
        s.count = 0
      } else if (m < vil) s.mrHigh = false
    }
    const v = volt(sol, str(ctx.params.clk, 'nck'))
    if (v > vih) s.high = true
    else if (v < vil && s.high) {
      s.high = false
      if (!s.mrHigh) {
        s.count = (s.count + 1) & 15
        s.edges++
      }
    }
  },

  tick(ctx) {
    const s = state(ctx)
    const vcc = num(ctx.params.vcc, 5)
    const ids = str(ctx.params.q, 'V_Q0,V_Q1,V_Q2,V_Q3').split(',')
    for (let k = 0; k < ids.length; k++) {
      const bit = (s.count >> k) & 1
      ctx.setParam(ids[k].trim(), 'value', ctx.powered ? bit * vcc : 0)
      if (ctx.powered) ctx.publish(`b${k}`, bit)
    }
    if (ctx.powered) {
      ctx.publish('count', s.count)
      ctx.publish('edges', s.edges)
    }
  },

  onEvent(ctx, ev) {
    if (ev === 'power-on' || ev === 'power-off' || ev === 'repair' || ev === 'strip') clearAll(ctx)
  },

  reset(ctx) {
    clearAll(ctx)
  },
}
