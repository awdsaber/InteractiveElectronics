// e-load (shared): a DC electronic load in constant-current (CC) mode.
//
// A bench e-load sinks a set current whatever the voltage across it, so a test of a power path
// (a trace, a connector, a fuse) runs at exactly the current it is rated for. Modelled as an R the
// behavior re-sizes every tick to V / I_set (clamped to rMin..rMax): it settles in a few frames.
// When the supply path opens, V falls to 0 and so does the current, as with a real load.
//
// Params: `element` ('R_LOAD', an R from `node` to `ref`), `node` ('out'), `ref` ('0'), `iSet` (A, 1),
// `rMin` (0.01 Ω), `rMax` (1 MΩ, also used for iSet = 0), `vOn` (0.5 V: below it the load is off). Publishes `iSet` (effective) and `v_load`.
// Allocates nothing per tick.

import type { Behavior, BehaviorContext } from '../types'

function num(ctx: BehaviorContext, key: string, def: number): number {
  const v = Number(ctx.params[key] ?? def)
  return Number.isFinite(v) ? v : def
}

export const behavior: Behavior = {
  id: 'e-load',
  tick(ctx) {
    const iSet = Math.max(0, num(ctx, 'iSet', 1))
    const rMin = num(ctx, 'rMin', 0.01)
    const rMax = num(ctx, 'rMax', 1e6)
    const v = ctx.v(String(ctx.params.node ?? 'out'), String(ctx.params.ref ?? '0'))
    // below Von the load lets go (as real e-loads do), so a restored supply is not met by a dead short
    const vOn = num(ctx, 'vOn', 0.5)
    const r = iSet <= 0 || !(v >= vOn) ? rMax : Math.min(rMax, Math.max(rMin, v / iSet))
    ctx.setParam(String(ctx.params.element ?? 'R_LOAD'), 'value', r)
    ctx.publish('iSet', iSet)
    ctx.publish('v_load', Number.isFinite(v) ? v : 0)
  },
}
