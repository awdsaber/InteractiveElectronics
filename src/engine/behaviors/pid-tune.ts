// pid-tune: live tuning knobs for a control-loop sketch. The bench's sliders set this instance's params; the
// sketch reads them every loop through a `Tune` object, so a gain change takes effect at the next sample with
// no re-upload (on a real bench you would send the gains over Serial, or read three pots, for the same effect).
//
// Sketch API (globals):
//   Tune.kp(), Tune.ki(), Tune.kd()  the gains (clamped ≥ 0; units are the sketch's: PWM counts per rpm,
//                                    per rpm·s and per rpm/s on the PID bench)
//   Tune.periodMs()                  the loop period, an integer 1..1000 ms
//   Tune.antiWindup()                1 = clamp the integrator while the output is saturated, 0 = don't
//
// params (defaults): kp 1, ki 0, kd 0, periodMs 10, antiWindup 1. A failure can override any of them
//   ({ op: 'set', elementId: 'behavior:<instance>', key: 'kp', value }); the sketch reads `ctx.params` live,
//   so the override and its repair reach the running loop at once.
// Publishes: kp, ki, kd, period_ms, loop_hz, anti_windup (what the sketch is reading now).

import type { Behavior, BehaviorContext } from '../types'

const num = (v: unknown, d: number) => {
  const x = typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : NaN
  return Number.isFinite(x) ? x : d
}

const gain = (ctx: BehaviorContext, key: string, d: number) => Math.max(0, num(ctx.params[key], d))
const period = (ctx: BehaviorContext) => Math.min(1000, Math.max(1, Math.round(num(ctx.params.periodMs, 10))))
const aw = (ctx: BehaviorContext) => (num(ctx.params.antiWindup, 1) >= 0.5 ? 1 : 0)

export const behavior: Behavior = {
  id: 'pid-tune',

  libraries(ctx) {
    const Tune = {
      kp: () => gain(ctx, 'kp', 1),
      ki: () => gain(ctx, 'ki', 0),
      kd: () => gain(ctx, 'kd', 0),
      periodMs: () => period(ctx),
      antiWindup: () => aw(ctx),
    }
    return { Tune }
  },

  tick(ctx) {
    ctx.publish('kp', gain(ctx, 'kp', 1))
    ctx.publish('ki', gain(ctx, 'ki', 0))
    ctx.publish('kd', gain(ctx, 'kd', 0))
    ctx.publish('period_ms', period(ctx))
    ctx.publish('loop_hz', 1000 / period(ctx))
    ctx.publish('anti_windup', aw(ctx))
  },
}
