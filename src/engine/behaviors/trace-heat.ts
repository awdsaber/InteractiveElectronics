// trace-heat (shared): a copper PCB trace as a resistor that heats by IPC-2221.
//
// Each tick it reads the current through `element` (an R), works out the steady temperature rise
// IPC-2221 gives for that current in a trace `widthMm` wide of `oz` copper (outer layer unless
// `external` is 0), lets the trace temperature follow it with a first-order lag `tau`, and sets the
// element's resistance to the copper's R = ρ(T)·L / (w·t) at that temperature (src/engine/pcb/ipc2221.ts).
//
// Above `failC` (default 300 °C, about where standard FR-4 epoxy starts to decompose) the trace is
// burnt open ('overtemp'): the laminate chars and the copper lifts. IPC-2221's charts stop at a
// 100 °C rise, so anything above that is an extrapolation: read it as "far too hot", not a forecast.
// `tau` is illustrative (seconds: a trace on FR-4 heats in seconds, the board round it in minutes).
//
// Params: `element` ('TRACE'), `widthMm` (0.3), `oz` (1), `lengthMm` (50), `ambientC` (25),
// `tau` (1.5 s), `failC` (300), `external` (1), `riseC` (10: the rise `wmin_mm` is sized for).
// Publishes `widthMm` and `oz` (the effective params, failure overrides included), `i_A`, `dT_ss`
// (IPC rise at the present current), `temp_C`, `r_ohm`, `wmin_mm` (IPC width for the present current
// at `riseC`), `beyond_chart` (1 above a 100 °C rise). Allocates nothing per tick.

import { IPC_CHART_MAX_RISE, ipcRise, ipcWidthMm, traceResistance } from '../pcb/ipc2221'
import type { Behavior, BehaviorContext } from '../types'

interface State {
  temp: number
  failed: boolean
}

const states = new WeakMap<BehaviorContext, State>()

function num(ctx: BehaviorContext, key: string, def: number): number {
  const v = Number(ctx.params[key] ?? def)
  return Number.isFinite(v) ? v : def
}

function state(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = { temp: num(ctx, 'ambientC', 25), failed: false }
    states.set(ctx, s)
  }
  return s
}

function resistance(ctx: BehaviorContext, temp: number): number {
  return traceResistance(num(ctx, 'lengthMm', 50), Math.max(0.01, num(ctx, 'widthMm', 0.3)), Math.max(0.1, num(ctx, 'oz', 1)), temp)
}

function cool(ctx: BehaviorContext): void {
  state(ctx).temp = num(ctx, 'ambientC', 25)
}

export const behavior: Behavior = {
  id: 'trace-heat',
  init(ctx) {
    ctx.setParam(String(ctx.params.element ?? 'TRACE'), 'value', resistance(ctx, state(ctx).temp))
  },
  onEvent(ctx, ev) {
    if (ev === 'power-on' || ev === 'power-off' || ev === 'strip' || ev === 'repair') cool(ctx)
  },
  reset(ctx) {
    const s = state(ctx)
    s.failed = false
    cool(ctx)
    ctx.setParam(String(ctx.params.element ?? 'TRACE'), 'value', resistance(ctx, s.temp))
  },
  tick(ctx, dt) {
    const s = state(ctx)
    const id = String(ctx.params.element ?? 'TRACE')
    const w = Math.max(0.01, num(ctx, 'widthMm', 0.3))
    const oz = Math.max(0.1, num(ctx, 'oz', 1))
    const ext = num(ctx, 'external', 1) >= 0.5
    const amb = num(ctx, 'ambientC', 25)
    const sol = ctx.solution
    const i = s.failed ? 0 : Math.abs(sol ? (sol.currentOf?.(id) ?? sol.current[id] ?? 0) : 0)
    const rise = ipcRise(i, w, oz, ext)
    const tau = Math.max(0.01, num(ctx, 'tau', 1.5))
    s.temp += (amb + rise - s.temp) * (1 - Math.exp(-Math.max(0, dt) / tau))
    const r = resistance(ctx, s.temp)
    if (!s.failed) ctx.setParam(id, 'value', r)
    const failC = num(ctx, 'failC', 300)
    if (!s.failed && s.temp >= failC) {
      s.failed = true
      ctx.burn(id, 'overtemp', {
        value: s.temp,
        limit: failC,
        note: `burnt open: about ${Math.round(s.temp)} °C in a ${w.toFixed(2)} mm trace at ${i.toFixed(1)} A (FR-4 chars near ${Math.round(failC)} °C)`,
      })
    }
    ctx.publish('widthMm', w)
    ctx.publish('oz', oz)
    ctx.publish('i_A', i)
    ctx.publish('dT_ss', rise)
    ctx.publish('temp_C', s.temp)
    ctx.publish('r_ohm', r)
    ctx.publish('wmin_mm', ipcWidthMm(i, num(ctx, 'riseC', 10), oz, ext))
    ctx.publish('beyond_chart', rise > IPC_CHART_MAX_RISE ? 1 : 0)
  },
}
