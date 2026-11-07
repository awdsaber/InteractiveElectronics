// pot-knob (shared): a percentage knob for a POT element, so a tweak slider reads "50 %"
// instead of a bare 0..1 wiper position.
//
// Params: `pot` (the POT element id), `turn` (0–100 %, 0 = wiper at nodes[0], 100 = at nodes[2]).
// Publishes `<instance>.turn`.
//
// Lesson use: behaviors: [{ id: 'pot-knob', instance: 'knob', params: { pot: 'pot', turn: 50 } }]
//             tweaks:    [{ label: 'Pot', elementId: 'behavior:knob', key: 'turn', min: 0, max: 100, step: 1, unit: '%' }]

import type { Behavior, BehaviorContext } from '../types'

function apply(ctx: BehaviorContext): number {
  const raw = Number(ctx.params.turn ?? 50)
  const turn = Math.min(100, Math.max(0, Number.isFinite(raw) ? raw : 50))
  ctx.setParam(String(ctx.params.pot ?? 'pot'), 'pos', turn / 100)
  return turn
}

export const behavior: Behavior = {
  id: 'pot-knob',
  // from the start, so the 3D knob and an unpowered bench already show the lesson's setting
  init: (ctx) => void apply(ctx),
  tick(ctx) {
    ctx.publish('turn', apply(ctx))
  },
}
