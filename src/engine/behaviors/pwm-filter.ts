// pwm-filter (shared): the textbook numbers for a PWM pin feeding an RC low-pass, so a lesson can
// put the prediction next to what the simulator and the ac-meter measure.
//
// params: pin (the sketch's PWM pin number), r and c (element ids of the series R and the shunt C).
// Publishes `fc` (Hz, 1/(2πRC)), `tau` (s), `fpwm` (Hz, the pin's analogWrite frequency), `ratio`
// (fpwm / fc), `duty` (0..1), `vavg` (V, duty × Vcc) and `ripple` (V peak-to-peak, the exact steady
// state of a first-order filter: Vcc (1-e^(-DT/τ)) (1-e^(-(1-D)T/τ)) / (1-e^(-T/τ)); with RC >> T this
// is Vcc D (1-D) / (f RC)). The pin's own output resistance (25 Ω) is not added to R.
// With the capacitor removed fc and tau are NaN and the ripple is the full swing Vcc.
//
// Lesson use: behaviors: [{ id: 'pwm-filter', instance: 'pf', params: { pin: 9, r: 'R_F', c: 'C_F' } }]
//             readouts:  [{ label: 'CUTOFF', source: { kind: 'behavior', key: 'pf.fc' }, unit: 'Hz' }]

import type { Behavior, BehaviorContext } from '../types'

/** analogWrite frequency when the pin state carries none (matches sim/pwm.ts) */
const DEFAULT_HZ = 490

/** peak-to-peak steady-state ripple of an RC low-pass driven by a 0..vcc square wave */
export function rippleVpp(vcc: number, duty: number, period: number, tau: number): number {
  if (!(duty > 0 && duty < 1)) return 0
  if (!(tau > 0)) return vcc
  const a = -Math.expm1(-(duty * period) / tau)
  const b = -Math.expm1(-((1 - duty) * period) / tau)
  const c = -Math.expm1(-period / tau)
  return (vcc * a * b) / c
}

function value(ctx: BehaviorContext, id: string): number | undefined {
  const el = ctx.netlist.elements.find((e) => e.id === id)
  return el && 'value' in el && typeof el.value === 'number' ? el.value : undefined
}

export const behavior: Behavior = {
  id: 'pwm-filter',

  tick(ctx) {
    const pin = Number(ctx.params.pin ?? 9)
    const st = ctx.pins[pin]
    const pinEl = ctx.netlist.elements.find((e) => e.type === 'PIN' && e.pin === pin)
    const vcc = pinEl && pinEl.type === 'PIN' ? pinEl.vcc : 5
    const duty = st && st.mode === 'OUTPUT' ? st.level : 0
    const f = st?.pwmHz && st.pwmHz > 0 ? st.pwmHz : DEFAULT_HZ
    const r = value(ctx, String(ctx.params.r ?? 'R_F'))
    const c = value(ctx, String(ctx.params.c ?? 'C_F'))
    const tau = r !== undefined && c !== undefined ? r * c : NaN
    const fc = tau > 0 ? 1 / (2 * Math.PI * tau) : NaN
    ctx.publish('fc', fc)
    ctx.publish('tau', tau)
    ctx.publish('fpwm', f)
    ctx.publish('ratio', Number.isFinite(fc) ? f / fc : 0)
    ctx.publish('duty', duty)
    ctx.publish('vavg', duty * vcc)
    ctx.publish('ripple', rippleVpp(vcc, duty, 1 / f, Number.isFinite(tau) ? tau : 0))
  },
}
