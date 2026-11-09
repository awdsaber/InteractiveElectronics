// dyno-load: a mini dynamometer on a gear motor's output shaft. A friction brake (a felt pad on a lever
// pressing a flywheel) applies a torque to the OUTPUT shaft; the behavior reflects it through the gearbox to
// the MOTOR element's shaft with `ctx.setMotorLoad`:
//
//   T_motor = coulombNm + brakeNm / (gear × eff)
//
// `eff` is the gearbox efficiency while the motor drives the load (0.7 is illustrative for a small plastic
// spur gearbox; real ones run roughly 0.5–0.8). `coulombNm` is the gearbox's own dry friction, always present.
// The MOTOR element applies its `load` against the direction of ω, faded in over ±1 rad/s (MOTOR_LOAD_W), so
// a brake never drives a stopped shaft backwards and needs no sign handling here.
//
// params (defaults): motor 'm1', brakeNm 0 (N·m at the output shaft, clamped ≥ 0), gear 48, eff 0.7 (0.05..1),
//   coulombNm 0.0002 (N·m at the motor shaft), stepAtS 0 (> 0: the brake engages only once this many seconds
//   have passed since power-on, a scripted step disturbance).
// Publishes: brake_Nm (the output-shaft brake torque now applied), motor_load_Nm (what the MOTOR sees),
//   rpm_out (output shaft; below 1e-6 rpm it reads 0), out_power_W (brake power: brake torque × |ω_out|).

import type { Behavior, BehaviorContext } from '../types'

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const TWO_PI = 2 * Math.PI

/** sim time of the last power-on, per bench */
const onAt = new WeakMap<BehaviorContext, number>()

function loads(ctx: BehaviorContext): { brake: number; motor: number } {
  const p = ctx.params
  const gear = Math.max(1e-6, num(p.gear, 48))
  const eff = Math.min(1, Math.max(0.05, num(p.eff, 0.7)))
  const coulomb = Math.max(0, num(p.coulombNm, 0.0002))
  const stepAt = num(p.stepAtS, 0)
  const since = ctx.t - (onAt.get(ctx) ?? 0)
  const engaged = stepAt <= 0 || since >= stepAt
  const brake = engaged ? Math.max(0, num(p.brakeNm, 0)) : 0
  return { brake, motor: coulomb + brake / (gear * eff) }
}

export const behavior: Behavior = {
  id: 'dyno-load',

  // from the start, so the first solve already carries the gearbox friction
  init(ctx) {
    onAt.set(ctx, ctx.t)
    ctx.setMotorLoad(String(ctx.params.motor ?? 'm1'), loads(ctx).motor)
  },

  tick(ctx) {
    const motor = String(ctx.params.motor ?? 'm1')
    const { brake, motor: tm } = loads(ctx)
    ctx.setMotorLoad(motor, tm)
    const sol = ctx.solution
    const key = `${motor}.omega`
    const w = ctx.powered && sol ? (sol.extraOf ? sol.extraOf(motor, key) : (sol.extra[key] ?? 0)) || 0 : 0
    const wOut = w / Math.max(1e-6, num(ctx.params.gear, 48))
    ctx.publish('brake_Nm', brake)
    ctx.publish('motor_load_Nm', tm)
    const rpm = (wOut * 60) / TWO_PI
    // a shaft at rest solves to ~1e-17 rad/s: publish 0 so a readout doesn't print twenty decimals
    ctx.publish('rpm_out', Math.abs(rpm) < 1e-6 ? 0 : rpm)
    ctx.publish('out_power_W', brake * Math.abs(wOut))
  },

  onEvent(ctx, ev) {
    if (ev === 'power-on') onAt.set(ctx, ctx.t)
  },
}
