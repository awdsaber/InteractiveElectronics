// Newton-Raphson operating-point solver with gmin and source stepping fallbacks.

import type { Netlist, PinState, Solution } from '../types'
import { type Compiled, type Dev, type Measured, type StampCtx, GMIN, compile, measureDevice, stampDevice } from './devices'
import { addA, clearSystem, luFactor, luSolve, residualOk, restoreMatrix } from './mna'

export const MAX_ITER = 100
export const RELTOL = 1e-6
export const VNTOL = 1e-6 // V
export const ABSTOL = 1e-9 // A (branch variables)
/** node voltages beyond this mean the answer is held up only by gmin (e.g. a current source into nothing) */
export const V_SANE = 1e6

export interface SolveOptions {
  /** GPIO states for PIN elements, keyed by pin number (default: INPUT) */
  pins?: Record<number, PinState>
  /** Newton iteration limit per attempt (default 100) */
  maxIter?: number
}

export interface SolveContext {
  mode: 'dc' | 'tran'
  dt: number
  pins: Record<number, PinState>
}

export interface SolveResult {
  ok: boolean
  /** may point into a Compiled work buffer: copy it if you keep it past the next solve */
  x: Float64Array
  iterations: number
}

/**
 * Newton from x0 (copied). Returns a Compiled work buffer.
 * The linear devices' matrix (plus gmin) is stamped once and cached in Compiled.Alin while
 * mode / dt / gmin / source scale are unchanged; each step only re-stamps their right-hand
 * side. Each Newton iteration restores that matrix and adds the nonlinear companions.
 * Fully linear circuits also keep their LU factorisation and just back-substitute.
 */
function newton(c: Compiled, sc: SolveContext, x0: Float64Array, gmin: number, srcScale: number, maxIter: number): SolveResult {
  const sys = c.sys
  let x = c.xa
  let xn = c.xb
  if (x0 !== x) x.set(x0)
  const ctx: StampCtx = {
    mode: sc.mode,
    dt: sc.dt,
    x,
    st: c.st,
    pins: sc.pins,
    lim: c.lim,
    limited: false,
    srcScale,
  }

  // linear part
  const cached =
    c.linValid && c.linMode === sc.mode && c.linDt === sc.dt && c.linGmin === gmin && c.linScale === srcScale
  if (!cached) c.luValid = false
  // a linear circuit's sys.A is untouched since it was cached; otherwise rebuild below
  sys.rhsOnly = cached
  clearSystem(sys)
  for (const d of c.linDevs) stampDevice(d, sys, ctx)
  sys.rhsOnly = false
  if (!cached) {
    for (let k = 0; k < c.nNodes; k++) addA(sys, c.nodeUnk[k], c.nodeUnk[k], gmin)
    c.Alin.set(sys.A)
    c.rfLin.set(sys.rf)
    c.rlLin.set(sys.rl)
    c.clLin.set(sys.cl)
    c.linValid = true
    c.linMode = sc.mode
    c.linDt = sc.dt
    c.linGmin = gmin
    c.linScale = srcScale
  }
  c.blin.set(sys.b)

  if (!c.nonlinear) {
    if (!c.luValid) {
      if (!luFactor(sys, c.lu, c.isNode)) return { ok: false, x, iterations: 1 }
      c.luValid = true
    }
    if (!luSolve(c.lu, sys.b, xn)) return { ok: false, x, iterations: 1 }
    c.xa = xn
    c.xb = x
    return { ok: residualOk(sys, xn) && sane(c, xn), x: xn, iterations: 1 }
  }

  for (let it = 1; it <= maxIter; it++) {
    if (it > 1 || cached) {
      restoreMatrix(sys, c.Alin, c.rfLin, c.rlLin, c.clLin)
      sys.b.set(c.blin)
    }
    ctx.x = x
    ctx.limited = false
    for (const d of c.nlDevs) stampDevice(d, sys, ctx)
    if (!luFactor(sys, c.lu, c.isNode)) return { ok: false, x, iterations: it }
    if (!luSolve(c.lu, sys.b, xn)) return { ok: false, x, iterations: it }
    let converged = !ctx.limited
    for (let i = 0; converged && i < c.size; i++) {
      const tol = (c.isNode[i] ? VNTOL : ABSTOL) + RELTOL * Math.max(Math.abs(xn[i]), Math.abs(x[i]))
      if (Math.abs(xn[i] - x[i]) > tol) converged = false
    }
    const t = x
    x = xn
    xn = t
    if (converged) {
      c.xa = x
      c.xb = xn
      return { ok: residualOk(sys, x) && sane(c, x), x, iterations: it }
    }
  }
  c.xa = x
  c.xb = xn
  return { ok: false, x, iterations: maxIter }
}

function sane(c: Compiled, x: Float64Array): boolean {
  for (let k = 0; k < c.nNodes; k++) if (!(Math.abs(x[c.nodeUnk[k]]) <= V_SANE)) return false
  return true
}

/** Newton; on failure gmin stepping (1e-2 → 1e-12); then source stepping. */
export function solveCompiled(c: Compiled, sc: SolveContext, x0: Float64Array, maxIter = MAX_ITER): SolveResult {
  c.limSave.set(c.lim)
  const direct = newton(c, sc, x0, GMIN, 1, maxIter)
  if (direct.ok || !c.nonlinear) return direct
  let total = direct.iterations
  // keep the failed iterate for reporting; the fallbacks reuse the work buffers
  const failed = new Float64Array(direct.x)
  const start = new Float64Array(x0)

  // gmin stepping
  c.lim.set(c.limSave)
  let x = start
  let ok = true
  for (let g = 1e-2; g >= GMIN * 0.999; g /= 10) {
    const r = newton(c, sc, x, Math.max(g, GMIN), 1, maxIter)
    total += r.iterations
    if (!r.ok) {
      ok = false
      break
    }
    x = new Float64Array(r.x)
  }
  if (ok) {
    const r = newton(c, sc, x, GMIN, 1, maxIter)
    total += r.iterations
    if (r.ok) return { ok: true, x: r.x, iterations: total }
  }

  // source stepping
  c.lim.fill(Number.NaN)
  x = new Float64Array(c.size)
  const steps = 20
  for (let k = 1; k <= steps; k++) {
    const r = newton(c, sc, x, GMIN, k / steps, maxIter)
    total += r.iterations
    if (!r.ok) {
      c.lim.set(c.limSave)
      return { ok: false, x: failed, iterations: total }
    }
    x = new Float64Array(r.x)
  }
  return { ok: true, x, iterations: total }
}

/**
 * Turn a raw unknown vector into a Solution. The nodeV / current / power / extra maps are
 * materialised on first access (most transient steps are never read), from snapshots taken
 * here, so later steps or parameter changes can't alter an earlier Solution.
 */
export function buildSolution(c: Compiled, r: SolveResult, sc: SolveContext): Solution {
  let finite = true
  for (let i = 0; i < r.x.length; i++) if (!Number.isFinite(r.x[i])) finite = false
  const x = finite ? r.x.slice() : new Float64Array(c.size)
  const st = c.st.slice()
  const pins = { ...sc.pins }
  const devs: readonly Dev[] = c.devs
  const { nodeNames, nodeUnk, nNodes } = c
  const mode = sc.mode
  const dt = sc.dt

  let nodeV: Record<string, number> | null = null
  let m: Measured | null = null
  const measured = (): Measured => {
    if (!m) {
      m = { current: {}, power: {}, extra: {} }
      const ctx = { mode, dt, st, pins }
      for (const d of devs) measureDevice(d, x, ctx, m)
    }
    return m
  }
  return {
    ok: r.ok && finite,
    iterations: r.iterations,
    get nodeV() {
      if (!nodeV) {
        nodeV = { '0': 0 }
        for (let k = 0; k < nNodes; k++) {
          const name = nodeNames[k]
          if (!name.includes('#')) nodeV[name] = x[nodeUnk[k]]
        }
      }
      return nodeV
    },
    get current() {
      return measured().current
    },
    get power() {
      return measured().power
    },
    get extra() {
      return measured().extra
    },
  }
}

/** DC operating point. Capacitors are open, inductors short, motors at mechanical steady state. */
export function solveDC(netlist: Netlist, opts: SolveOptions = {}): Solution {
  const c = compile(netlist)
  const sc: SolveContext = { mode: 'dc', dt: 0, pins: opts.pins ?? {} }
  const r = solveCompiled(c, sc, new Float64Array(c.size), opts.maxIter ?? MAX_ITER)
  return buildSolution(c, r, sc)
}
