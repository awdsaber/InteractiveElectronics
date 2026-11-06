// Newton-Raphson operating-point solver with gmin and source stepping fallbacks.

import type { Netlist, PinState, Solution } from '../types'
import { type Compiled, type DynState, type Measured, type StampCtx, GMIN, compile, measureDevice, stampDevice } from './devices'
import { addA, clearSystem, createSystem, solveLinear } from './mna'

export const MAX_ITER = 100
export const RELTOL = 1e-6
export const VNTOL = 1e-6 // V
export const ABSTOL = 1e-9 // A (branch variables)

export interface SolveOptions {
  /** GPIO states for PIN elements, keyed by pin number (default: INPUT) */
  pins?: Record<number, PinState>
  /** Newton iteration limit per attempt (default 100) */
  maxIter?: number
}

export interface SolveContext {
  mode: 'dc' | 'tran'
  dt: number
  prev: DynState
  pins: Record<number, PinState>
  /** device linearisation memory; carried between transient steps */
  lim: Record<string, number[]>
}

export interface SolveResult {
  ok: boolean
  x: Float64Array
  iterations: number
}

export const emptyDynState = (): DynState => ({ capV: {}, indI: {}, omega: {} })

function newton(
  c: Compiled,
  sc: SolveContext,
  x0: Float64Array,
  gmin: number,
  srcScale: number,
  maxIter: number,
): SolveResult {
  const sys = createSystem(c.size)
  let x = x0
  const ctx: StampCtx = { ...sc, x, limited: false, srcScale }
  for (let it = 1; it <= maxIter; it++) {
    clearSystem(sys)
    ctx.x = x
    ctx.limited = false
    for (const d of c.devs) stampDevice(d, sys, ctx)
    for (let i = 0; i < c.nNodes; i++) addA(sys, i, i, gmin)
    const xn = solveLinear(sys)
    if (!xn) return { ok: false, x, iterations: it }
    if (!c.nonlinear) return { ok: true, x: xn, iterations: it }
    let converged = !ctx.limited
    for (let i = 0; converged && i < c.size; i++) {
      const tol = (i < c.nNodes ? VNTOL : ABSTOL) + RELTOL * Math.max(Math.abs(xn[i]), Math.abs(x[i]))
      if (Math.abs(xn[i] - x[i]) > tol) converged = false
    }
    x = xn
    if (converged) return { ok: true, x, iterations: it }
  }
  return { ok: false, x, iterations: maxIter }
}

/** Newton; on failure gmin stepping (1e-2 → 1e-12); then source stepping. */
export function solveCompiled(c: Compiled, sc: SolveContext, x0: Float64Array, maxIter = MAX_ITER): SolveResult {
  let total = 0
  const limStart = structuredClone(sc.lim)
  const restoreLim = () => {
    for (const k of Object.keys(sc.lim)) delete sc.lim[k]
    Object.assign(sc.lim, structuredClone(limStart))
  }

  const direct = newton(c, sc, x0, GMIN, 1, maxIter)
  total += direct.iterations
  if (direct.ok) return { ...direct, iterations: total }

  // gmin stepping
  restoreLim()
  let x = x0
  let ok = true
  for (let g = 1e-2; g >= GMIN * 0.999; g /= 10) {
    const r = newton(c, sc, x, Math.max(g, GMIN), 1, maxIter)
    total += r.iterations
    if (!r.ok) {
      ok = false
      break
    }
    x = r.x
  }
  if (ok) {
    const r = newton(c, sc, x, GMIN, 1, maxIter)
    total += r.iterations
    if (r.ok) return { ok: true, x: r.x, iterations: total }
  }

  // source stepping
  restoreLim()
  x = new Float64Array(c.size)
  const steps = 20
  for (let k = 1; k <= steps; k++) {
    const r = newton(c, sc, x, GMIN, k / steps, maxIter)
    total += r.iterations
    if (!r.ok) return { ok: false, x: direct.x, iterations: total }
    x = r.x
  }
  return { ok: true, x, iterations: total }
}

/** turn a raw unknown vector into a Solution */
export function buildSolution(c: Compiled, r: SolveResult, sc: SolveContext): Solution {
  const finite = r.x.every((v) => Number.isFinite(v))
  const x = finite ? r.x : new Float64Array(c.size)
  const nodeV: Record<string, number> = { '0': 0 }
  for (let i = 0; i < c.nNodes; i++) {
    const name = c.nodeNames[i]
    if (!name.includes('#')) nodeV[name] = x[i]
  }
  const m: Measured = { current: {}, power: {}, extra: {} }
  for (const d of c.devs) measureDevice(d, x, sc, m)
  return { ok: r.ok && finite, nodeV, current: m.current, power: m.power, extra: m.extra, iterations: r.iterations }
}

/** DC operating point. Capacitors are open, inductors short, motors at mechanical steady state. */
export function solveDC(netlist: Netlist, opts: SolveOptions = {}): Solution {
  const c = compile(netlist)
  const sc: SolveContext = { mode: 'dc', dt: 0, prev: emptyDynState(), pins: opts.pins ?? {}, lim: {} }
  const r = solveCompiled(c, sc, new Float64Array(c.size), opts.maxIter ?? MAX_ITER)
  return buildSolution(c, r, sc)
}
