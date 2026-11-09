// source-select: a selector switch made of SW elements, one closed at a time. Use it for a function
// generator's waveform buttons (two sources, each behind its own SW, into one node) driven by an
// enum tweak `behavior:<instance>.mode`.
//
// params: switches (comma-separated SW element ids), mode (index of the one to close, default 0).
// Publishes `mode`.

import type { Behavior, BehaviorContext } from '../types'

function apply(ctx: BehaviorContext): number {
  const ids = String(ctx.params.switches ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const mode = Math.round(typeof ctx.params.mode === 'number' ? ctx.params.mode : 0)
  ids.forEach((id, i) => {
    if (ctx.netlist.elements.some((e) => e.id === id && e.type === 'SW')) ctx.setParam(id, 'closed', i === mode)
  })
  return mode
}

export const behavior: Behavior = {
  id: 'source-select',

  tick(ctx) {
    ctx.publish('mode', apply(ctx))
  },

  // a selection made before power-on (a tweak) is in place for the first step
  onEvent(ctx, ev) {
    if (ev === 'power-on') apply(ctx)
  },
}
