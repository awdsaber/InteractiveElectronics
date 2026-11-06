// Newton-Raphson operating-point solver with gmin and source stepping fallbacks.

import type { Netlist, PinState, Solution } from '../types'
import {
  type Compiled,
  type Dev,
  type Measured,
  type StampCtx,
  GMIN,
  IP,
  compile,
  measureCurrentPower,
  measureDevice,
  stampDevice,
} from './devices'
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
  /** time of this solution, s (source waveforms; default 0) */
  t?: number
  /** trapezoidal C / L companions (default backward Euler) */
  trap?: boolean
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
    t: sc.t ?? 0,
    trap: sc.trap === true && sc.mode === 'tran',
    x,
    st: c.st,
    pins: sc.pins,
    lim: c.lim,
    limited: false,
    srcScale,
  }

  // linear part
  const cached =
    c.linValid &&
    c.linMode === sc.mode &&
    c.linDt === sc.dt &&
    c.linGmin === gmin &&
    c.linScale === srcScale &&
    c.linTrap === ctx.trap
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
    c.linTrap = ctx.trap
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
/** id -> device per compiled device list (the list is replaced, never mutated, on setParam) */
const DEV_INDEX = new WeakMap<readonly Dev[], Map<string, Dev>>()
function devIndex(devs: readonly Dev[]): Map<string, Dev> {
  let m = DEV_INDEX.get(devs)
  if (!m) {
    m = new Map(devs.map((d) => [d.el.id, d]))
    DEV_INDEX.set(devs, m)
  }
  return m
}
/** shared scratch for single-element reads (overwritten by every read) */
const SCRATCH: Measured = { current: {}, power: {}, extra: {} }
/** which solution (by its private x) and element IP currently holds */
let IP_OWNER: Float64Array | null = null
let IP_ID = ''

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
  const t = sc.t ?? 0
  const trap = sc.trap === true && mode === 'tran'

  const nodeIndex = c.nodeIndex
  const ctx = { mode, dt, st, pins, t, trap }
  let nodeV: Record<string, number> | null = null
  let m: Measured | null = null
  /** values published before the maps were materialised */
  let overlay: Record<string, number> | null = null
  let index: Map<string, Dev> | null = null
  const measured = (): Measured => {
    if (!m) {
      m = { current: {}, power: {}, extra: {} }
      for (const d of devs) measureDevice(d, x, ctx, m)
      if (overlay) Object.assign(m.extra, overlay)
    }
    return m
  }
  /** current / power of one element into IP (0 when it doesn't exist); false if none */
  const ip = (id: string): boolean => {
    // current then power of the same element: measure once
    if (IP_OWNER === x && IP_ID === id) return true
    const d = (index ??= devIndex(devs)).get(id)
    if (!d) return false
    measureCurrentPower(d, x, ctx)
    IP_OWNER = x
    IP_ID = id
    return true
  }
  return {
    ok: r.ok && finite,
    iterations: r.iterations,
    currentOf(id) {
      if (m) return m.current[id] ?? 0
      return ip(id) ? IP.i : 0
    },
    powerOf(id) {
      if (m) return m.power[id] ?? 0
      return ip(id) ? IP.p : 0
    },
    extraOf(id, key) {
      if (m) return m.extra[key] ?? 0
      if (overlay && key in overlay) return overlay[key]
      const d = (index ??= devIndex(devs)).get(id)
      if (!d) return 0
      measureDevice(d, x, ctx, SCRATCH)
      IP_OWNER = null
      return SCRATCH.extra[key] ?? 0
    },
    voltageOf(node) {
      if (node === '0') return 0
      const k = nodeIndex.get(node)
      return k === undefined ? 0 : x[k]
    },
    publish(key, value) {
      if (m) m.extra[key] = value
      else (overlay ??= {})[key] = value
    },
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

/** initial unknown vector: zeros, with node voltages from netlist.ic */
export function initialGuess(c: Compiled, netlist: Netlist): Float64Array {
  const x = new Float64Array(c.size)
  if (netlist.ic) {
    for (const [node, v] of Object.entries(netlist.ic)) {
      const k = c.nodeIndex.get(node)
      if (k !== undefined) x[k] = v
    }
  }
  return x
}

/**
 * DC operating point (sources at t = 0). Capacitors are open, inductors short, motors at
 * mechanical steady state. Newton starts from netlist.ic when given.
 */
export function solveDC(netlist: Netlist, opts: SolveOptions = {}): Solution {
  const c = compile(netlist)
  const sc: SolveContext = { mode: 'dc', dt: 0, pins: opts.pins ?? {}, t: 0 }
  const r = solveCompiled(c, sc, initialGuess(c, netlist), opts.maxIter ?? MAX_ITER)
  return buildSolution(c, r, sc)
}
