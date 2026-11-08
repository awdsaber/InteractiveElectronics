// ac-meter: an RMS / amplitude meter for a sinusoidal signal, read once per animation frame.
//
// A behavior only sees the last sim step of each frame, so averaging v² over frames would alias
// (a 50 Hz sine sampled at 60 fps). Instead it fits x(t) ≈ a·sin(ωt) + b·cos(ωt) + c to those samples
// by recursive least squares with exponential forgetting (τ = 0.25 s), where ω comes from the source
// element's waveform. The fit is exact for a sine at any phase and any frame rate that is not an
// exact multiple of the source frequency, and it separates the AC part from a DC level.
//
// params:
//   kind    'v' (a node voltage, default), 'i' (an element's current) or 'extra' (a Solution.extra key)
//   key         for 'extra': the key, e.g. 'T1.im'
//   node, ref   for 'v': the node and its reference (default '0')
//   element     for 'i': the element whose current is read
//   source      the V element whose `wave.freq` sets ω (follows tweaks of `wave.freq`)
// Publishes `amp` (peak of the fundamental), `dc` (mean) and `rms` (total: √(dc² + amp²/2)).
// Restarts at power-off, repair, strip and reset.

import type { Behavior, BehaviorContext } from '../types'

const TAU = 0.25

interface Fit {
  m: number[] // 3×3, row-major: Σ w·φφᵀ
  b: number[] // Σ w·x·φ
  w: number // Σ w (effective sample count)
}
const fresh = (): Fit => ({ m: new Array<number>(9).fill(0), b: [0, 0, 0], w: 0 })

const fits = new WeakMap<BehaviorContext, Fit>()
const fitOf = (ctx: BehaviorContext) => {
  let f = fits.get(ctx)
  if (!f) fits.set(ctx, (f = fresh()))
  return f
}

/** solve a·x = y for a 3×3 by Gaussian elimination with partial pivoting; null when singular */
function solve3(a: number[], y: number[]): number[] | null {
  const A = [a.slice(0, 3), a.slice(3, 6), a.slice(6, 9)]
  const Y = y.slice()
  const scale = Math.max(Math.abs(a[0]), Math.abs(a[4]), Math.abs(a[8]), 1e-30)
  for (let c = 0; c < 3; c++) {
    let p = c
    for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    if (Math.abs(A[p][c]) < 1e-3 * scale) return null
    ;[A[c], A[p]] = [A[p], A[c]]
    ;[Y[c], Y[p]] = [Y[p], Y[c]]
    for (let r = c + 1; r < 3; r++) {
      const f = A[r][c] / A[c][c]
      for (let k = c; k < 3; k++) A[r][k] -= f * A[c][k]
      Y[r] -= f * Y[c]
    }
  }
  const x = [0, 0, 0]
  for (let r = 2; r >= 0; r--) {
    let s = Y[r]
    for (let k = r + 1; k < 3; k++) s -= A[r][k] * x[k]
    x[r] = s / A[r][r]
  }
  return x
}

function measure(ctx: BehaviorContext): number | null {
  const s = ctx.solution
  if (!s) return null
  if (ctx.params.kind === 'extra') return s.extra[String(ctx.params.key ?? '')] ?? 0
  if (ctx.params.kind === 'i') {
    const id = String(ctx.params.element ?? '')
    return s.currentOf ? s.currentOf(id) : (s.current[id] ?? 0)
  }
  return ctx.v(String(ctx.params.node ?? ''), ctx.params.ref === undefined ? undefined : String(ctx.params.ref))
}

function freqOf(ctx: BehaviorContext): number {
  const id = ctx.params.source
  const el = ctx.netlist.elements.find((e) => e.id === id)
  return el && el.type === 'V' && el.wave ? el.wave.freq : 0
}

export const behavior: Behavior = {
  id: 'ac-meter',

  tick(ctx, dt) {
    if (!(dt > 0)) return
    const x = measure(ctx)
    if (x === null || !Number.isFinite(x)) return
    const f = fitOf(ctx)
    const lam = Math.exp(-dt / TAU)
    const th = 2 * Math.PI * freqOf(ctx) * ctx.t
    const phi = [Math.sin(th), Math.cos(th), 1]
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) f.m[r * 3 + c] = lam * f.m[r * 3 + c] + phi[r] * phi[c]
      f.b[r] = lam * f.b[r] + x * phi[r]
    }
    f.w = lam * f.w + 1
    if (f.w < 3) return
    let sol = solve3(f.m, f.b)
    // no usable sinusoid (a DC source, or too few distinct phases yet): just the mean
    if (!sol) sol = [0, 0, f.b[2] / f.m[8]]
    const amp = Math.hypot(sol[0], sol[1])
    const dc = sol[2]
    ctx.publish('amp', amp)
    ctx.publish('dc', dc)
    ctx.publish('rms', Math.sqrt(dc * dc + (amp * amp) / 2))
  },

  onEvent(ctx, ev) {
    if (ev === 'power-off' || ev === 'repair' || ev === 'strip') fits.set(ctx, fresh())
  },

  reset(ctx) {
    fits.set(ctx, fresh())
  },
}
