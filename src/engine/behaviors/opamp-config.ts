// opamp-config: the configuration selector and gain meter of an op-amp trainer (T2 opamp-basics).
//
// One op-amp is rewired between four configurations by a set of SW elements, driven by an enum tweak
// `behavior:<instance>.mode`:
//   0 non-inverting (gain 1 + R_F/R_G), 1 inverting (−R_F/R_G), 2 buffer (1), 3 comparator (no feedback:
//   the op-amp's open-loop gain).
//
// params:
//   mode      configuration index (default 0)
//   switches  comma-separated SW ids
//   patterns  '|'-separated, one string of 0/1 per mode, one digit per switch (1 = closed)
//   rf, rg    the feedback and gain resistors (ideal gain); opamp: the OPAMP (its `gain` is the open-loop gain)
//   sine      a V with a `wave`: one measurement window is one period of it
//   in, out, ref  nodes: the measured gain is (out − ref) / (in − ref), peak-to-peak over a period
//
// Publishes `mode`, `ideal` (the ideal closed-loop gain; the open-loop gain in comparator mode or when
// R_F is missing), and, after each whole period, `gain` (measured, signed by the phase of out against
// in), `inPp`, `outPp`, `outHi` and `outLo` (the output's highest and lowest voltage to ground), and
// `clipPct` (the % of the wanted output swing the rails cut off; 0 in comparator mode). The
// samples are taken once per frame, so the extremes of an unclipped sine can read a few % low; ratios
// of samples taken at the same instants are exact for a linear stage.

import type { Behavior, BehaviorContext, Element } from '../types'

interface Win {
  t0: number
  inLo: number
  inHi: number
  outLo: number
  outHi: number
  vLo: number
  vHi: number
  corr: number
  n: number
}

const fresh = (t0: number): Win => ({ t0, inLo: Infinity, inHi: -Infinity, outLo: Infinity, outHi: -Infinity, vLo: Infinity, vHi: -Infinity, corr: 0, n: 0 })

const wins = new WeakMap<BehaviorContext, Win>()

const find = (ctx: BehaviorContext, id: unknown): Element | undefined => ctx.netlist.elements.find((e) => e.id === String(id ?? ''))

/** the ideal gain of `mode` from the live netlist */
export function idealGain(mode: number, rf: Element | undefined, rg: Element | undefined, opamp: Element | undefined): number {
  const aol = opamp && opamp.type === 'OPAMP' ? (opamp.gain ?? 1e5) : 1e5
  if (mode === 3) return aol
  if (mode === 2) return 1
  if (!rf || rf.type !== 'R' || rf.disabled) return aol
  if (!rg || rg.type !== 'R' || rg.disabled || rg.value <= 0) return aol
  return mode === 1 ? -rf.value / rg.value : 1 + rf.value / rg.value
}

export const behavior: Behavior = {
  id: 'opamp-config',

  tick(ctx) {
    const p = ctx.params
    const mode = Math.round(typeof p.mode === 'number' ? p.mode : 0)
    const ids = String(p.switches ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const pattern = String(p.patterns ?? '').split('|')[mode] ?? ''
    ids.forEach((id, i) => {
      if (find(ctx, id)?.type === 'SW') ctx.setParam(id, 'closed', pattern[i] === '1')
    })
    ctx.publish('mode', mode)
    ctx.publish('ideal', idealGain(mode, find(ctx, p.rf), find(ctx, p.rg), find(ctx, p.opamp)))

    if (!ctx.powered || !ctx.solution) return
    const sine = find(ctx, p.sine)
    const freq = sine && sine.type === 'V' && sine.wave ? sine.wave.freq : 5
    const period = freq > 0 ? 1 / freq : 0.2
    let w = wins.get(ctx)
    if (!w) wins.set(ctx, (w = fresh(ctx.t)))
    const ref = String(p.ref ?? '0')
    const vi = ctx.v(String(p.in ?? 'in'), ref)
    const vo = ctx.v(String(p.out ?? 'out'), ref)
    const vabs = ctx.v(String(p.out ?? 'out'))
    w.inLo = Math.min(w.inLo, vi)
    w.inHi = Math.max(w.inHi, vi)
    w.outLo = Math.min(w.outLo, vo)
    w.outHi = Math.max(w.outHi, vo)
    w.vLo = Math.min(w.vLo, vabs)
    w.vHi = Math.max(w.vHi, vabs)
    w.n++
    if (ctx.t - w.t0 < period) {
      w.corr += vi * vo
      return
    }
    w.corr += vi * vo
    const inPp = w.inHi - w.inLo
    const outPp = w.outHi - w.outLo
    ctx.publish('inPp', inPp)
    ctx.publish('outPp', outPp)
    ctx.publish('outHi', w.vHi)
    ctx.publish('outLo', w.vLo)
    const gain = inPp > 1e-6 ? (w.corr < 0 ? -1 : 1) * (outPp / inPp) : Number.NaN
    ctx.publish('gain', gain)
    // how much of the wanted output swing the rails cut off (linear configurations only)
    const ideal = idealGain(mode, find(ctx, p.rf), find(ctx, p.rg), find(ctx, p.opamp))
    const linear = mode !== 3 && Math.abs(ideal) < 1e3 && gain === gain
    ctx.publish('clipPct', linear ? Math.max(0, (1 - Math.abs(gain) / Math.abs(ideal)) * 100) : 0)
    wins.set(ctx, fresh(ctx.t))
  },

  onEvent(ctx, ev) {
    if (ev === 'power-off' || ev === 'repair' || ev === 'strip' || ev === 'break') wins.delete(ctx)
  },

  reset(ctx) {
    wins.delete(ctx)
  },
}
