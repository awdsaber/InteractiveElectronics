// ntc: an NTC thermistor in a water bath, with the Beta model, self-heating and thermal lag.
//
//   R(T) = r25 · exp(bTrue · (1/T − 1/T0))      T in kelvin, T0 = t0C + 273.15 (25 °C)
//
// The bath sets the target temperature (`bathC`, a tweak). The sensor body does not follow it
// instantly: it relaxes with a first-order lag, time constant `tau`, toward
//   T_target = bath + P / δ
// where P is the power the thermistor dissipates (read from the solved circuit, ctx.solution) and
// δ the dissipation constant (W/K): the sensor warms itself with its own measuring current. Each tick
// the new temperature sets the element's resistance with setParam, so the loop is closed through the
// solver with one tick of lag (stable: the loop gain P'(T)/δ is far below 1, and the update is the
// exact first-order step, so any dt is safe).
//
// Numbers (Vishay NTCLE100E3103JB0, datasheet 29049 rev. 07-May-2025): R25 10 kΩ, B25/85 3977 K
// (±0.75 %), dissipation factor 8.5 mW/K and thermal time constant 15 s (both "for information
// only", still air), response time in oil 1.2 s, 500 mW maximum at 55 °C. Stirred water has a much
// larger δ and a much shorter τ; the lesson's defaults are the still-air datasheet values.
//
// Params: element ('ntc'), bathC (25), r25 (10000), t0C (25), bTrue (3977: the actual part's B; a
//   failure patch can change it), delta (0.0085 W/K), tau (15 s; <= 0 follows instantly),
//   selfHeat (1; 0 switches self-heating off, to compare).
// Publishes: bath_C (the true temperature), ntc_C (the sensor body), ntc_ohm, p_self_mW, self_heat_K
//   (P/δ: the steady error the measuring current causes), lag_K (body minus its target: negative
//   while the bath warms, positive while it cools, 0 when settled).
// Allocates nothing per tick.

import type { Behavior, BehaviorContext } from '../types'

const K0 = 273.15

/** Beta-model resistance of an NTC at tempC */
export function ntcOhms(tempC: number, r25 = 10000, bTrue = 3977, t0C = 25): number {
  return r25 * Math.exp(bTrue * (1 / (tempC + K0) - 1 / (t0C + K0)))
}

interface State {
  /** sensor body temperature, °C */
  temp: number
}

const states = new WeakMap<BehaviorContext, State>()
function stateOf(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = { temp: 25 }
    states.set(ctx, s)
  }
  return s
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

function ohmsFor(ctx: BehaviorContext, tempC: number): number {
  const p = ctx.params
  return ntcOhms(tempC, num(p.r25, 10000), num(p.bTrue, 3977), num(p.t0C, 25))
}

function apply(ctx: BehaviorContext) {
  ctx.setParam(String(ctx.params.element ?? 'ntc'), 'value', ohmsFor(ctx, stateOf(ctx).temp))
}

function settle(ctx: BehaviorContext) {
  stateOf(ctx).temp = num(ctx.params.bathC, 25)
  apply(ctx)
}

export const behavior: Behavior = {
  id: 'ntc',
  init: settle,
  // the sensor sat in the bath while the bench was off: it starts at the bath temperature
  onEvent(ctx, ev) {
    if (ev === 'power-on' || ev === 'repair' || ev === 'strip' || ev === 'upload') settle(ctx)
  },
  reset: settle,
  tick(ctx, dt) {
    const p = ctx.params
    const s = stateOf(ctx)
    const id = String(p.element ?? 'ntc')
    const bath = num(p.bathC, 25)
    const delta = Math.max(1e-6, num(p.delta, 0.0085))
    const tau = num(p.tau, 15)
    const sol = ctx.solution
    let pw = 0
    if (sol && ctx.powered) pw = sol.powerOf ? sol.powerOf(id) : (sol.power[id] ?? 0)
    if (!(pw > 0) || num(p.selfHeat, 1) === 0) pw = 0
    const heat = pw / delta
    const target = bath + heat
    if (tau <= 0 || dt <= 0) s.temp = target
    else s.temp += (target - s.temp) * (1 - Math.exp(-dt / tau))
    apply(ctx)
    ctx.publish('bath_C', bath)
    ctx.publish('ntc_C', s.temp)
    ctx.publish('ntc_ohm', ohmsFor(ctx, s.temp))
    ctx.publish('p_self_mW', pw * 1000)
    ctx.publish('self_heat_K', heat)
    ctx.publish('lag_K', s.temp - target)
  },
}
