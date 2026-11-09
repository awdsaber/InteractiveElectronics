// timerone: the Paul Stoffregen TimerOne library (`#include <TimerOne.h>`, object `Timer1`) as a
// periodic interrupt on the virtual MCU.
//
// Supported calls: Timer1.initialize(periodUs) (default 1 000 000 µs), setPeriod(periodUs),
// attachInterrupt(fn[, periodUs]), detachInterrupt(), stop(), start(), restart(), read() (µs since the
// last overflow). The ISR is scheduled with `mcu.schedule`, so it runs at the exact virtual
// microsecond and respects noInterrupts(). The real library keeps a hardware counter on Timer1 (a
// 16-bit counter clocked from 16 MHz through a prescaler) and takes over PWM on pins 9 and 10; this
// behavior models only the period, not the PWM.
//
// Publishes `hz` (the interrupt rate, 0 while stopped or detached).

import type { Behavior, BehaviorContext } from '../types'

interface State {
  period: number
  fn: (() => unknown) | null
  running: boolean
  /** bumped to cancel the pending scheduled call */
  epoch: number
  /** MCU time of the last overflow, for read() */
  lastFire: number
}

const states = new WeakMap<BehaviorContext, State>()
function stateOf(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) states.set(ctx, (s = { period: 1_000_000, fn: null, running: true, epoch: 0, lastFire: 0 }))
  return s
}

function arm(ctx: BehaviorContext, s: State) {
  const my = ++s.epoch
  if (!s.fn || !s.running || !ctx.mcu.schedule) return
  const mcu = ctx.mcu
  s.lastFire = mcu.timeMicros
  const next = (at: number) =>
    mcu.schedule!(at, () => {
      if (my !== s.epoch) return undefined
      s.lastFire = at
      next(at + s.period)
      return s.fn?.()
    })
  next(mcu.timeMicros + s.period)
}

export const behavior: Behavior = {
  id: 'timerone',

  libraries(ctx) {
    const s = stateOf(ctx)
    const timer = {
      initialize(periodUs?: number) {
        s.period = Math.max(1, Number(periodUs ?? 1_000_000))
        s.running = true
        arm(ctx, s)
      },
      setPeriod(periodUs: number) {
        s.period = Math.max(1, Number(periodUs))
        arm(ctx, s)
      },
      attachInterrupt(fn: () => unknown, periodUs?: number) {
        if (periodUs !== undefined) s.period = Math.max(1, Number(periodUs))
        s.fn = fn
        arm(ctx, s)
      },
      detachInterrupt() {
        s.fn = null
        s.epoch++
      },
      stop() {
        s.running = false
        s.epoch++
      },
      start() {
        s.running = true
        arm(ctx, s)
      },
      restart() {
        arm(ctx, s)
      },
      read() {
        return Math.max(0, Math.round(ctx.mcu.timeMicros - s.lastFire))
      },
    }
    // `TimerOne` is the library's name, so `#include <TimerOne.h>` is accepted without a warning
    return { Timer1: timer, TimerOne: timer }
  },

  tick(ctx) {
    const s = stateOf(ctx)
    ctx.publish('hz', s.fn && s.running && ctx.powered ? 1e6 / s.period : 0)
  },

  onEvent(ctx, ev) {
    if (ev === 'upload' || ev === 'power-off' || ev === 'power-on') {
      const s = stateOf(ctx)
      s.epoch++
      s.fn = null
      s.running = true
      s.period = 1_000_000
    }
  },

  reset(ctx) {
    const s = stateOf(ctx)
    s.epoch++
    s.fn = null
    s.running = true
  },
}
