// edge-counter: counts how often a node crosses a logic threshold, so a lesson can show how many
// times a gate output "changed its mind" (a noisy edge into a plain input versus a Schmitt input).
//
// params: `node` (counted node), `threshold` (V, default 2.5), `hyst` (V, default 0.5: the counter
// needs the node to clear threshold ± hyst/2 before it takes the next edge, so solver ripple on a
// rail is not counted). Publishes `edges` (all transitions since power-on) and `rising`.
// It samples every instantaneous solve (onStep), so edges between frames are seen. It restarts on
// power-on/off, break, repair, strip and reset.

import type { Behavior, BehaviorContext } from '../types'

interface State {
  level: number // -1 unknown, 0 low, 1 high
  edges: number
  rising: number
}

const states = new WeakMap<BehaviorContext, State>()
function stateOf(ctx: BehaviorContext): State {
  let st = states.get(ctx)
  if (!st) states.set(ctx, (st = { level: -1, edges: 0, rising: 0 }))
  return st
}
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const restart = (st: State) => {
  st.level = -1
  st.edges = 0
  st.rising = 0
}

export const behavior: Behavior = {
  id: 'edge-counter',

  onStep(ctx, _t, s) {
    const node = String(ctx.params.node ?? '')
    if (!node) return
    const v = s.voltageOf ? s.voltageOf(node) : (s.nodeV[node] ?? 0)
    const th = num(ctx.params.threshold, 2.5)
    const h = num(ctx.params.hyst, 0.5) / 2
    const st = stateOf(ctx)
    if (st.level < 0) {
      if (v >= th + h) st.level = 1
      else if (v <= th - h) st.level = 0
      return
    }
    if (st.level === 0 && v >= th + h) {
      st.level = 1
      st.edges++
      st.rising++
    } else if (st.level === 1 && v <= th - h) {
      st.level = 0
      st.edges++
    }
  },

  tick(ctx) {
    const st = stateOf(ctx)
    ctx.publish('edges', st.edges)
    ctx.publish('rising', st.rising)
  },

  onEvent(ctx, ev) {
    if (ev !== 'upload') restart(stateOf(ctx))
  },

  reset(ctx) {
    restart(stateOf(ctx))
  },
}
