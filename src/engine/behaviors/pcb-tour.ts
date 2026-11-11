// pcb-tour (shared): the guided PCB layer tour's state, and the board's live DRC count.
//
// The 3D board (src/three/PcbLayers.tsx) draws `board.layers` sheet by sheet: the exploded view peels
// them apart, `view` isolates one (0 all, 1 bottom copper, 2 core, 3 top copper, 4 mask, 5 silk,
// 6 drill: src/engine/pcb/layers.ts) and `drc` 1 overlays the design-rule violations. Tweak them as
// `behavior:<instance>.view` / `.drc`; the 3D reads the published value, or the tweak while unpowered.
//
// DRC count: `staticErrors` (the layout's fixed violations, which the lesson test checks against
// src/engine/pcb/drc.ts) plus one when the power trace is narrower than IPC-2221 allows: its width
// is read from the published key `widthKey` (mm) and its design current from `ampsKey` (A), with
// the fab's allowed `riseC` and the copper weight (published key `ozKey`, else param `oz`).
// Empty keys fall back to params `w` / `a` / `oz`.
//
// Publishes `view`, `drc`, `drc_errors`, `wmin_mm` (IPC-2221 width for the design current, to the
// 0.01 mm a layout tool uses) and `trace_ok` (1 when the trace is wide enough). Allocates nothing.

import { ipcWidthMm } from '../pcb/ipc2221'
import type { Behavior, BehaviorContext } from '../types'

function num(ctx: BehaviorContext, key: string, def: number): number {
  const v = Number(ctx.params[key] ?? def)
  return Number.isFinite(v) ? v : def
}

function live(ctx: BehaviorContext, keyParam: string, fallback: string): number {
  const key = String(ctx.params[keyParam] ?? '')
  const v = key ? ctx.read?.(key) : undefined
  return v !== undefined && Number.isFinite(v) ? v : num(ctx, fallback, 0)
}

export const behavior: Behavior = {
  id: 'pcb-tour',
  tick(ctx) {
    const w = live(ctx, 'widthKey', 'w')
    const a = live(ctx, 'ampsKey', 'a')
    const ozRaw = ctx.params.ozKey ? live(ctx, 'ozKey', 'oz') : num(ctx, 'oz', 1)
    const oz = ozRaw > 0 ? ozRaw : 1
    const wmin = a > 0 ? Math.round(ipcWidthMm(a, num(ctx, 'riseC', 10), oz) * 100) / 100 : 0
    const ok = w >= wmin - 1e-9 ? 1 : 0
    ctx.publish('view', Math.round(num(ctx, 'view', 0)))
    ctx.publish('drc', num(ctx, 'drc', 0) >= 0.5 ? 1 : 0)
    ctx.publish('wmin_mm', wmin)
    ctx.publish('trace_ok', ok)
    ctx.publish('drc_errors', Math.max(0, Math.round(num(ctx, 'staticErrors', 0))) + (ok ? 0 : 1))
  },
}
