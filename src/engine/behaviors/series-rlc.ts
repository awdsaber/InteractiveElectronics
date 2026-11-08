// series-rlc: the second-order numbers of a series R-L-C loop, computed from the live netlist, so a
// tweak of R, L or C moves them at once. It measures nothing: the scope shows what the circuit does,
// these readouts show what the formulas predict.
//
// params: l (L element id), c (C element id), r (comma-separated R element ids in the loop),
// rExtra (Ω not in those elements: source and switch resistance, default 0), sine (a V element with a
// `wave`; its freq is used for `gain`).
// Publishes f0 (Hz, 1/(2π√LC)), z0 (Ω, √(L/C)), zeta (R/(2·Z0)), q (Z0/R), fd (ringing frequency
// f0·√(1−ζ²), 0 when ζ ≥ 1), gain (steady-state |V_C/V_in| at the sine frequency) and rTotal (Ω).

import type { Behavior, Element } from '../types'

export interface SeriesRlc {
  f0: number
  z0: number
  zeta: number
  q: number
  fd: number
  gain: number
}

/** series RLC with V_C as the output: natural frequency, damping and the sine gain at `f` */
export function seriesRlc(l: number, c: number, r: number, f: number): SeriesRlc {
  const w0 = 1 / Math.sqrt(l * c)
  const f0 = w0 / (2 * Math.PI)
  const z0 = Math.sqrt(l / c)
  const zeta = r / (2 * z0)
  const u = f / f0
  return {
    f0,
    z0,
    zeta,
    q: r > 0 ? z0 / r : Infinity,
    fd: zeta < 1 ? f0 * Math.sqrt(1 - zeta * zeta) : 0,
    gain: 1 / Math.hypot(1 - u * u, 2 * zeta * u),
  }
}

const KEYS = ['f0', 'z0', 'zeta', 'q', 'fd', 'gain', 'rTotal']

/** the `value` of element `id` when it is of `type` (a burnt part is stamped as another type) */
const valueOf = (els: readonly Element[], id: string, type?: Element['type']): number | undefined => {
  const e = els.find((x) => x.id === id)
  if (!e || (type && e.type !== type) || e.disabled) return undefined
  return 'value' in e && typeof e.value === 'number' ? e.value : undefined
}

export const behavior: Behavior = {
  id: 'series-rlc',

  tick(ctx) {
    const els = ctx.netlist.elements
    const l = valueOf(els, String(ctx.params.l ?? ''), 'L')
    const c = valueOf(els, String(ctx.params.c ?? ''), 'C')
    if (!l || !c || l <= 0 || c <= 0) {
      // no longer an LC loop (a part failed): the formulas no longer apply, readouts show "—"
      for (const k of KEYS) ctx.publish(k, NaN)
      return
    }
    let r = typeof ctx.params.rExtra === 'number' ? ctx.params.rExtra : 0
    for (const id of String(ctx.params.r ?? '').split(',')) {
      const v = id.trim() ? valueOf(els, id.trim()) : undefined
      if (v !== undefined) r += v
    }
    const src = els.find((e) => e.id === ctx.params.sine)
    const f = src && src.type === 'V' && src.wave ? src.wave.freq : 0
    const x = seriesRlc(l, c, r, f)
    ctx.publish('f0', x.f0)
    ctx.publish('z0', x.z0)
    ctx.publish('zeta', x.zeta)
    ctx.publish('q', x.q)
    ctx.publish('fd', x.fd)
    ctx.publish('gain', x.gain)
    ctx.publish('rTotal', r)
  },
}
