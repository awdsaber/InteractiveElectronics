// output-gate: a bench supply's OUTPUT button that disconnects every channel, not just one return
// wire. The listed V elements are disabled (open) until the lesson's power element comes on, so two
// channels wired into each other (a floating loop of sources and resistors) read zero while OFF.
//
// Params: `elements`, a comma-separated list of element ids (default 'V1,V2').
// Lesson use: behaviors: [{ id: 'output-gate', params: { elements: 'V1,V2' } }]

import type { Behavior, BehaviorContext } from '../types'

function gate(ctx: BehaviorContext, on: boolean) {
  for (const id of String(ctx.params.elements ?? 'V1,V2').split(',')) {
    const trimmed = id.trim()
    if (trimmed) ctx.setParam(trimmed, 'disabled', !on)
  }
}

export const behavior: Behavior = {
  id: 'output-gate',
  init: (ctx) => gate(ctx, false),
  onEvent(ctx, ev) {
    if (ev === 'power-on') gate(ctx, true)
    else if (ev === 'power-off' || ev === 'strip') gate(ctx, false)
  },
  reset: (ctx) => gate(ctx, ctx.powered),
}
