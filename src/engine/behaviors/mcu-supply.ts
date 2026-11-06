// mcu-supply (shared): the MCU watches its own supply rail, like the ATmega328P's brown-out
// detector and speed grade.
//
// Each frame it reads the rail (param `supplyNode`, default '5v') and:
//   - below the brown-out level (`bor`, default 2.7 V: the Uno's BODLEVEL fuse setting) holds
//     the MCU in reset: the sketch freezes and every pin floats. When the rail climbs back above
//     bor + `hyst` (default 0.05 V, the datasheet's BOD hysteresis) it releases the MCU and
//     restarts the sketch from setup(), as a real brown-out reset does;
//   - between bor and the voltage the clock needs (`fClk`, default 16 MHz → about 3.78 V)
//     publishes warn = 1: the chip runs, but outside its speed grade.
//
// Publishes `<instance>.vcc` (V), `.warn` (0/1), `.held` (0/1), `.resets` (brown-out resets since
// the last repair/strip) and `.fmax` (MHz the rail allows). Timeline events on channel 'mcu':
// 'brown-out' and 'reset'.
//
// Lesson use: behaviors: [{ id: 'mcu-supply', instance: 'mcu', params: { supplyNode: '5v' } }]

import type { Behavior, BehaviorContext, Netlist } from '../types'

/**
 * ATmega328P maximum clock vs VCC (datasheet "Speed grades", safe operating area):
 * 4 MHz at 1.8 V, 10 MHz at 2.7 V, 20 MHz at 4.5 V, linear in between.
 */
export function fMaxAt(v: number): number {
  if (v < 1.8) return 0
  if (v < 2.7) return 4 + ((v - 1.8) * 6) / 0.9
  if (v < 4.5) return 10 + ((v - 2.7) * 10) / 1.8
  return 20
}

/** the lowest VCC at which the ATmega328P is specified to run at `mhz` */
export function minVccFor(mhz: number): number {
  if (mhz <= 4) return 1.8
  if (mhz <= 10) return 1.8 + ((mhz - 4) * 0.9) / 6
  return 2.7 + ((Math.min(mhz, 20) - 10) * 1.8) / 10
}

interface State {
  /** in brown-out: the MCU is held */
  low: boolean
  resets: number
}

const states = new WeakMap<BehaviorContext, State>()
const fresh = (): State => ({ low: false, resets: 0 })
function state(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) states.set(ctx, (s = fresh()))
  return s
}

const nodeSets = new WeakMap<Netlist, Set<string>>()
function hasNode(n: Netlist, node: string): boolean {
  let s = nodeSets.get(n)
  if (!s) nodeSets.set(n, (s = new Set(n.elements.flatMap((e) => e.nodes as string[]))))
  return s.has(node)
}

const numParam = (ctx: BehaviorContext, key: string, def: number) => {
  const v = Number(ctx.params[key])
  return Number.isFinite(v) && ctx.params[key] !== undefined ? v : def
}

export const behavior: Behavior = {
  id: 'mcu-supply',

  init(ctx) {
    states.set(ctx, fresh())
  },

  tick(ctx) {
    const st = state(ctx)
    if (!ctx.powered || !ctx.solution?.ok) return
    const node = String(ctx.params.supplyNode ?? '5v')
    if (!hasNode(ctx.netlist, node)) return
    const bor = numParam(ctx, 'bor', 2.7)
    const hyst = numParam(ctx, 'hyst', 0.05)
    const fClk = numParam(ctx, 'fClk', 16)
    const v = ctx.v(node)

    if (!st.low && v < bor) {
      st.low = true
      st.resets++
      ctx.events.push({ t: ctx.t, channel: 'mcu', kind: 'brown-out', data: { v } })
    } else if (st.low && v > bor + hyst) {
      st.low = false
      ctx.mcu.release()
      ctx.mcu.reset()
      ctx.events.push({ t: ctx.t, channel: 'mcu', kind: 'reset', data: { v } })
    }
    // hold is idempotent: keep asserting it (an upload in between would otherwise start the chip)
    if (st.low) ctx.mcu.hold('brown-out')

    ctx.publish('vcc', v)
    ctx.publish('held', st.low ? 1 : 0)
    ctx.publish('warn', !st.low && v < minVccFor(fClk) ? 1 : 0)
    ctx.publish('resets', st.resets)
    ctx.publish('fmax', fMaxAt(v))
  },

  onEvent(ctx, ev) {
    // power-off stops the sketch and an upload starts a fresh one: the next tick re-checks the rail
    if (ev === 'power-off' || ev === 'upload') state(ctx).low = false
  },

  reset(ctx) {
    const st = state(ctx)
    if (st.low) {
      ctx.mcu.release()
      ctx.mcu.reset()
    }
    states.set(ctx, fresh())
  },
}
