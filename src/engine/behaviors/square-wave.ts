// square-wave: a logic-level test signal from a V element, switched in sim time.
//
// params: element (the V element to drive), hz (default 1), v (high level, default 5),
// duty (fraction of each period spent high, default 0.5). The level starts high at t = 0.
// Publishes `level` (V). Use it for a "5 V device" stand-in feeding a divider or a level shifter;
// a V element's `wave` does the same inside the netlist, but this keeps the edges on frame
// boundaries where readouts and sketches see clean levels.

import type { Behavior } from '../types'

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** the square wave's level at time t (s) */
export function squareLevel(t: number, hz: number, v: number, duty: number): number {
  const phase = t * hz - Math.floor(t * hz)
  return phase < duty - 1e-9 ? v : 0
}

export const behavior: Behavior = {
  id: 'square-wave',

  tick(ctx) {
    const id = ctx.params.element
    if (typeof id !== 'string' || !ctx.netlist.elements.some((e) => e.id === id && e.type === 'V')) return
    const level = squareLevel(ctx.t, num(ctx.params.hz, 1), num(ctx.params.v, 5), num(ctx.params.duty, 0.5))
    ctx.setParam(id, 'value', level)
    ctx.publish('level', level)
  },
}
