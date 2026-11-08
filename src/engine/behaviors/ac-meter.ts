// ac-meter: the numbers a bench scope's measurement menu would give for a sine source and two nodes.
//
// params: source (the V element whose `wave` is the stimulus, default 'V_GEN'), a (the input node,
// default 'in'), b (the output node, default 'out').
// Publishes: `vpp` (V, input peak-to-peak), `rmsIn`, `rmsOut` (V, the AC part only: a DC offset is
// not counted), `gain` (%, output amplitude over input amplitude), `freq` (Hz), `period` (s) and
// `phase` (°, output relative to input; negative = the output lags).
//
// Method: the generator's frequency is known, so each node's recent samples are fitted with
// a·sin(ωt) + b·cos(ωt) + c by least squares. That gives amplitude and phase exactly for a sine
// whatever the sample spacing, with no zero-crossing detection (which a once-per-frame sampler
// cannot do). The samples are the solver's real node voltages, taken once per solution; the
// frequency is read from the generator's setting, not counted from the waveform.
// Limit: if the frame period is an exact multiple of the signal period every sample lands on the
// same phase and nothing can be fitted; the readouts then hold their last value. Real frame jitter
// avoids this in the browser.

import type { Behavior, BehaviorContext } from '../types'

const WINDOW_CYCLES = 2.5
const WINDOW_MIN = 0.05 // s
const MIN_SAMPLES = 12
const KEEP_SAMPLES = 24 // never fewer, however short the window is in time (at ×1 a frame is 1/60 s)

interface State {
  t: number[]
  a: number[]
  b: number[]
  freq: number
}

interface Fit {
  amp: number
  phase: number // rad
}

/** least-squares fit of a·sin(ωt) + b·cos(ωt) + c; null when the samples can't separate the three */
export function fitSine(ts: number[], xs: number[], freq: number): Fit | null {
  const w = 2 * Math.PI * freq
  let ss = 0, sc = 0, s1 = 0, cc = 0, c1 = 0, n = 0
  let xs_ = 0, xc = 0, x1 = 0
  for (let i = 0; i < ts.length; i++) {
    const s = Math.sin(w * ts[i])
    const c = Math.cos(w * ts[i])
    ss += s * s; sc += s * c; s1 += s; cc += c * c; c1 += c; n++
    xs_ += xs[i] * s; xc += xs[i] * c; x1 += xs[i]
  }
  // normal equations M·[a b c]ᵀ = [xs_ xc x1]ᵀ, solved by Cramer's rule
  const det3 = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  const M = [[ss, sc, s1], [sc, cc, c1], [s1, c1, n]]
  const d = det3(M)
  if (!(Math.abs(d) > 1e-3 * n * n * n)) return null
  const rhs = [xs_, xc, x1]
  const col = (k: number) => det3(M.map((row, i) => row.map((v, j) => (j === k ? rhs[i] : v)))) / d
  const a = col(0)
  const b = col(1)
  return { amp: Math.hypot(a, b), phase: Math.atan2(b, a) }
}

const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d)
export const behavior: Behavior = {
  id: 'ac-meter',

  tick(ctx) {
    const sol = ctx.solution
    if (!sol) return
    const src = ctx.netlist.elements.find((e) => e.id === str(ctx.params.source, 'V_GEN'))
    if (!src || src.type !== 'V' || !src.wave) return
    const freq = src.wave.freq
    if (!(freq > 0)) return
    let st = stateOf.get(ctx)
    if (!st) stateOf.set(ctx, (st = { t: [], a: [], b: [], freq }))
    if (st.freq !== freq) {
      st.t.length = st.a.length = st.b.length = 0 // old samples belong to another ω
      st.freq = freq
    }
    const t = ctx.t
    const va = ctx.v(str(ctx.params.a, 'in'))
    const vb = ctx.v(str(ctx.params.b, 'out'))
    const n = st.t.length
    if (n && (t <= st.t[n - 1] || (va === st.a[n - 1] && vb === st.b[n - 1]))) return // no new solver step since the last frame
    st.t.push(t)
    st.a.push(va)
    st.b.push(vb)
    const keepFrom = t - Math.max(WINDOW_MIN, WINDOW_CYCLES / freq)
    let drop = 0
    while (drop < st.t.length - KEEP_SAMPLES && st.t[drop] < keepFrom) drop++
    if (drop) {
      st.t.splice(0, drop)
      st.a.splice(0, drop)
      st.b.splice(0, drop)
    }
    if (st.t.length < MIN_SAMPLES) return
    const fa = fitSine(st.t, st.a, freq)
    const fb = fitSine(st.t, st.b, freq)
    if (!fa || !fb) return
    let ph = ((fb.phase - fa.phase) * 180) / Math.PI
    ph = ((((ph + 180) % 360) + 360) % 360) - 180
    ctx.publish('vpp', 2 * fa.amp)
    ctx.publish('rmsIn', fa.amp / Math.SQRT2)
    ctx.publish('rmsOut', fb.amp / Math.SQRT2)
    ctx.publish('gain', fa.amp > 1e-9 ? (fb.amp / fa.amp) * 100 : 0)
    ctx.publish('freq', freq)
    ctx.publish('period', 1 / freq)
    ctx.publish('phase', ph)
  },

  reset(ctx) {
    stateOf.delete(ctx)
  },
  onEvent(ctx, ev) {
    if (ev === 'power-on' || ev === 'power-off' || ev === 'repair' || ev === 'strip') stateOf.delete(ctx)
  },
}

const stateOf = new WeakMap<BehaviorContext, State>()
