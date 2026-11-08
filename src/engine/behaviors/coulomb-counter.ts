// coulomb-counter: integrates the current through one element over sim time, so charge
// (Q = I·t) can be watched piling up, and converts the current to a count of electrons.
//
// params: element (the element whose current is counted, default 'P_I').
// Publishes `coulombs` (net charge past the element since power-on, C), `electronsPerSec`
// (I / e, the real count) and `electronsE15` (the same in units of 10^15 per second: the
// readout formatter cannot show 7.5e16 sensibly). The count restarts at power-off and on reset.

import type { Behavior, BehaviorContext, Solution } from '../types'

/** elementary charge, C (exact, SI 2019) */
export const E_CHARGE = 1.602176634e-19

const counts = new WeakMap<BehaviorContext, { q: number }>()
const state = (ctx: BehaviorContext) => {
  let s = counts.get(ctx)
  if (!s) counts.set(ctx, (s = { q: 0 }))
  return s
}
const curOf = (s: Solution, id: string) => (s.currentOf ? s.currentOf(id) : (s.current[id] ?? 0))

export const behavior: Behavior = {
  id: 'coulomb-counter',

  tick(ctx, dt) {
    const s = ctx.solution
    if (!s) return
    const st = state(ctx)
    const i = curOf(s, String(ctx.params.element ?? 'P_I'))
    st.q += i * dt
    ctx.publish('coulombs', st.q)
    // leakage below 0.1 µA (a burnt part's gmin) is not a flow worth counting: show a clean 0
    const rate = Math.abs(i) < 1e-7 ? 0 : i / E_CHARGE
    ctx.publish('electronsPerSec', rate)
    ctx.publish('electronsE15', rate / 1e15)
  },

  onEvent(ctx, ev) {
    if (ev === 'power-off' || ev === 'repair' || ev === 'strip') state(ctx).q = 0
  },

  reset(ctx) {
    state(ctx).q = 0
  },
}
