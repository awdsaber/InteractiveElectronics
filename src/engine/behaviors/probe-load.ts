// probe-load: what a passive scope probe hangs on the node it touches, R ‖ C to ground, set by the
// probe's ×1 / ×10 switch (an enum tweak on `behavior:<instance>.mode`).
//
//   mode 0  probe lifted off: nothing (R 1 TΩ, C 0.001 pF)
//   mode 1  ×10: 10 MΩ ‖ 12 pF (typical passive ×10 probes are 10 MΩ ‖ 10–15 pF at the tip)
//   mode 2  ×1:  1 MΩ ‖ 100 pF (the scope's 1 MΩ ‖ ~15 pF input plus about a metre of cable)
//
// The lesson owns the two elements (`r`, `c`, both from the probed node to ground); this behavior only
// sets their values, every tick, so a tweak acts at once and the netlist always shows the probe in
// use. Pair it with the logic analyzer's capacitor list (`sclCap: 'c_scl,c_probe'`) to see the probe
// slow an I²C edge.
//
// Params (defaults): r 'r_probe', c 'c_probe', mode 1, rX10 1e7, cX10 12e-12, rX1 1e6, cX1 100e-12.
// Publishes: mode, r_ohm, c_pf.

import type { Behavior, BehaviorContext } from '../types'

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

function apply(ctx: BehaviorContext): void {
  const P = ctx.params
  const mode = Math.round(num(P.mode, 1))
  const r = mode === 1 ? num(P.rX10, 1e7) : mode === 2 ? num(P.rX1, 1e6) : 1e12
  const c = mode === 1 ? num(P.cX10, 12e-12) : mode === 2 ? num(P.cX1, 100e-12) : 1e-15
  ctx.setParam(String(P.r ?? 'r_probe'), 'value', r)
  ctx.setParam(String(P.c ?? 'c_probe'), 'value', c)
  ctx.publish('mode', mode)
  ctx.publish('r_ohm', r)
  ctx.publish('c_pf', c * 1e12)
}

export const behavior: Behavior = {
  id: 'probe-load',
  init: apply,
  tick: (ctx) => apply(ctx),
  onEvent(ctx, ev) {
    if (ev === 'power-on') apply(ctx)
  },
}
