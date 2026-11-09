// tmp36 (shared): an Analog Devices TMP36 as a voltage source from temperature.
//
// The TMP36's output is V_out = 0.5 V + 10 mV/°C × T (750 mV at 25 °C), and it is measured from the
// sensor's OWN ground pin. Put the lesson's V element between the output node and that pin's node, so
// any voltage on the ground conductor adds straight onto what an ADC referenced elsewhere reads.
//
// Params: `element` ('tmp36', the V element), `tempC` (25; clamped to the rated −40…+125 °C).
// Publishes `true_C` (the temperature the sensor is at) and `out_V` (the source's value).
// Allocates nothing per tick.

import type { Behavior, BehaviorContext } from '../types'

/** datasheet transfer function: 500 mV offset, 10 mV/°C */
export const TMP36_OFFSET_V = 0.5
export const TMP36_V_PER_C = 0.01

function tempOf(ctx: BehaviorContext): number {
  const raw = Number(ctx.params.tempC ?? 25)
  const t = Number.isFinite(raw) ? raw : 25
  return Math.min(125, Math.max(-40, t))
}

function apply(ctx: BehaviorContext): number {
  const t = tempOf(ctx)
  ctx.setParam(String(ctx.params.element ?? 'tmp36'), 'value', TMP36_OFFSET_V + TMP36_V_PER_C * t)
  return t
}

export const behavior: Behavior = {
  id: 'tmp36',
  init: (ctx) => void apply(ctx),
  tick(ctx) {
    const t = apply(ctx)
    ctx.publish('true_C', t)
    ctx.publish('out_V', TMP36_OFFSET_V + TMP36_V_PER_C * t)
  },
}
