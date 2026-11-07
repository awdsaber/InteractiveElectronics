// Fixed-step transient simulation: backward Euler (default) or trapezoidal.
// t = 0 is "power on": capacitors start at v0 (default 0), inductors at i0 (default 0),
// motors at rest, node voltages guessed from netlist.ic.
// Trapezoidal steps fall back to one backward-Euler step after any discontinuity (start,
// parameter / pin / netlist / dt change, square-wave edge, a device mode flip in the previous
// step: V current limit, REG mode, LOGIC edge) so they don't ring numerically.
// A step with a PIN in PWM and a nonlinear netlist (or a vccNode PWM pin) is solved once per
// switch state and blended by duty (state-space averaging, see pwm.ts).

import type { Element, Netlist, PinState, Solution } from '../types'
import {
  type Compiled,
  type Dev,
  branchCount,
  captureState,
  compile,
  inheritState,
  layoutSignature,
  modesChanged,
  partition,
  prepareDevice,
  waveValue,
} from './devices'
import { setElementKey } from './failures'
import { type PwmPlan, blendSolutions, pwmPlan } from './pwm'
import { type SolveContext, buildSolution, initialGuess, solveCompiled } from './solve'

export interface TransientOptions {
  /** 'be' backward Euler (default: robust, damps), 'trap' trapezoidal (keeps LC ringing) */
  method?: 'be' | 'trap'
  /**
   * split the first step after an external discontinuity (pin, parameter or netlist change) into
   * this many backward-Euler substeps growing ×2 (the first is dt/(2^n − 1)), so µs events such as
   * an inductive kick into an avalanche clamp are resolved at a coarse dt. Square-wave source edges
   * and internal device mode flips are not split. Default: off.
   */
  edgeSubsteps?: number
}

/** an intermediate solution inside the last step (see TransientOptions.edgeSubsteps) */
export interface Substep {
  t: number
  solution: Solution
}

export interface Transient {
  /** advance one dt and return the solution at the new time */
  step(): Solution
  /** current sim time in seconds (after the last step) */
  readonly t: number
  readonly dt: number
  readonly method: 'be' | 'trap'
  /** whether the last step used the trapezoidal rule (false on backward-Euler restarts) */
  readonly lastStepTrap: boolean
  /** change the step size (slow motion / time lapse); takes effect on the next step */
  setDt(dt: number): void
  /**
   * the most recent solution with ok === true (null before the first one).
   * Pass this to checkRatings so a step that fails to converge doesn't reset burn timers.
   */
  readonly lastGood: Solution | null
  /** intermediate solutions of the last step when it was split by edgeSubsteps (else empty) */
  readonly substeps: readonly Substep[]
  /** change one element parameter, e.g. setParam('S1', 'closed', true); dotted keys ('wave.freq') reach nested fields */
  setParam(id: string, key: string, value: number | boolean | string): void
  /** set the GPIO state of every PIN element with this pin number */
  setPin(pin: number, state: PinState): void
  /** swap the circuit (patches, burns) keeping state for elements whose id survives */
  setNetlist(n: Netlist): void
  /** the netlist currently being simulated */
  readonly netlist: Netlist
  /**
   * the circuit `h` seconds after the last step with the current pins and parameters: one
   * backward-Euler step from the present C/L state that is NOT committed (time, state and lastGood
   * stay put). For reads between steps, e.g. a digitalRead right after a pin changed. PWM pins are
   * split into their switch states as in step().
   */
  peek(h: number): Solution
}

/** carry an unknown vector across a recompile: nodes by name, branches by element id */
function remapGuess(oldC: Compiled, oldX: Float64Array, newC: Compiled): Float64Array {
  const x = new Float64Array(newC.size)
  for (let k = 0; k < newC.nNodes; k++) {
    const j = oldC.nodeIndex.get(newC.nodeNames[k])
    if (j !== undefined) x[newC.nodeUnk[k]] = oldX[j]
  }
  for (const d of newC.devs) {
    if (d.br < 0) continue
    const o = oldC.byId.get(d.el.id)
    if (!o || o.br < 0 || o.el.type !== d.el.type) continue
    const count = Math.min(branchCount(d.el), branchCount(o.el))
    for (let k = 0; k < count; k++) x[d.br + k] = oldX[o.br + k]
  }
  return x
}

const checkDt = (dt: number) => {
  if (!(dt > 0) || !Number.isFinite(dt)) throw new Error(`transient: dt must be > 0 (got ${dt})`)
}

export function createTransient(netlist: Netlist, dt: number, opts: TransientOptions = {}): Transient {
  checkDt(dt)
  const method = opts.method ?? 'be'
  let current: Netlist = { ...netlist, elements: netlist.elements.slice() }
  let compiled = compile(current)
  let x: Float64Array = initialGuess(compiled, current)
  let t = 0
  let lastGood: Solution | null = null
  /** next step must be backward Euler (a discontinuity just happened) */
  let restart = true
  /** an external discontinuity happened since the last step (edgeSubsteps) */
  let edge = false
  const nSub = Math.max(0, Math.floor(opts.edgeSubsteps ?? 0))
  let substeps: Substep[] = []
  let lastTrap = false
  let squares: Extract<Element, { type: 'V' }>[] = []
  const pins: Record<number, PinState> = {}
  const sc: SolveContext = { mode: 'tran', dt, pins, t: 0, trap: false }

  // ── duty-weighted PWM ──
  let plan: PwmPlan | null = null
  /** pins or the device split changed: recompute the PWM plan before the next solve */
  let planDirty = true
  /** per switch state: its last solution (Newton warm start) and limiter memory, plus scratch */
  interface PhaseMem {
    x: Float64Array
    lim: Float64Array
    xn: Float64Array
    limn: Float64Array
  }
  let mem: PhaseMem[] = []
  let memKey = ''
  let xBlend = new Float64Array(0)
  const psc: SolveContext = { mode: 'tran', dt, pins, t: 0, trap: false }

  /**
   * Solve the step described by sc from the committed state. Returns the solution and, when it
   * converged, the unknown vector to commit (a work buffer: copy it before the next solve) and
   * whether a device switched mode. With `commit` the per-state PWM memory is updated.
   */
  function solveNow(commit: boolean): { sol: Solution; x: Float64Array | null; modes: boolean } {
    if (planDirty) {
      plan = pwmPlan(compiled, pins)
      planDirty = false
    }
    const pl = plan
    if (!pl) {
      const r = solveCompiled(compiled, sc, x)
      const sol = buildSolution(compiled, r, sc)
      return { sol, x: r.ok ? r.x : null, modes: r.ok && modesChanged(compiled) }
    }
    const c = compiled
    if (memKey !== pl.key || mem.length !== pl.phases.length || (mem[0] && mem[0].x.length !== c.size)) {
      mem = pl.phases.map(() => ({
        x: new Float64Array(x),
        lim: new Float64Array(c.lim),
        xn: new Float64Array(c.size),
        limn: new Float64Array(c.lim.length),
      }))
      memKey = pl.key
    }
    if (xBlend.length !== c.size) xBlend = new Float64Array(c.size)
    xBlend.fill(0)
    psc.dt = sc.dt
    psc.t = sc.t
    psc.trap = sc.trap
    const parts = []
    let modes = false
    let failed: Solution | null = null
    let heavy = 0
    for (let k = 0; k < pl.phases.length; k++) {
      const ph = pl.phases[k]
      const m = mem[k]
      c.lim.set(m.lim)
      if (pl.aVaries) c.linValid = false // the cached linear matrix holds the other state's pin stamp
      psc.pins = ph.pins
      const r = solveCompiled(c, psc, m.x)
      const sol = buildSolution(c, r, psc)
      if (!r.ok) {
        failed = sol
        break
      }
      modes ||= modesChanged(c)
      m.xn.set(r.x)
      m.limn.set(c.lim)
      const w = ph.weight
      for (let i = 0; i < c.size; i++) xBlend[i] += w * r.x[i]
      parts.push({ weight: w, solution: sol })
      if (w > pl.phases[heavy].weight) heavy = k
    }
    if (pl.aVaries) c.linValid = false
    if (failed) {
      c.lim.set(mem[heavy].lim)
      return { sol: failed, x: null, modes: false }
    }
    if (commit)
      for (const m of mem) {
        m.x.set(m.xn)
        m.lim.set(m.limn)
      }
    // later averaged solves and peeks start from the state the circuit spends longest in
    c.lim.set(mem[heavy].limn)
    return { sol: blendSolutions(parts), x: xBlend, modes }
  }

  const findSquares = () => {
    squares = []
    for (const el of current.elements) if (el.type === 'V' && el.wave?.kind === 'square') squares.push(el)
  }
  findSquares()

  const recompile = () => {
    const next = compile(current)
    x = remapGuess(compiled, x, next)
    inheritState(compiled, next)
    compiled = next
    restart = true
    edge = true
    planDirty = true
    memKey = ''
    findSquares()
  }

  /** a square source switches inside (t0, t1] */
  const edgeIn = (t0: number, t1: number) => {
    for (const el of squares) if (waveValue(el.wave!, t0) !== waveValue(el.wave!, t1)) return true
    return false
  }

  /** one dt as nSub backward-Euler substeps h, 2h, 4h, …; returns the solution at t + dt */
  function splitStep(): Solution {
    const t0 = t
    const h0 = dt / (2 ** nSub - 1)
    const out: Substep[] = []
    let sol: Solution | null = null
    let tk = t0
    for (let k = 0; k < nSub; k++) {
      const h = k === nSub - 1 ? t0 + dt - tk : h0 * 2 ** k
      tk = k === nSub - 1 ? t0 + dt : tk + h
      sc.dt = h
      sc.t = tk
      sc.trap = false
      const r = solveNow(true)
      sol = r.sol
      if (r.x) {
        x.set(r.x)
        captureState(compiled, x, h, false)
        lastGood = sol
      }
      if (k < nSub - 1) out.push({ t: tk, solution: sol })
    }
    sc.dt = dt
    lastTrap = false
    restart = true
    t = t0 + dt
    substeps = out
    return sol!
  }

  return {
    get t() {
      return t
    },
    get dt() {
      return dt
    },
    get method() {
      return method
    },
    get lastStepTrap() {
      return lastTrap
    },
    get netlist() {
      return current
    },
    get lastGood() {
      return lastGood
    },
    get substeps() {
      return substeps
    },
    setDt(next) {
      checkDt(next)
      if (next !== dt) restart = edge = true
      dt = next
      sc.dt = next
    },
    step() {
      if (substeps.length) substeps = []
      if (edge && nSub > 1) {
        edge = false
        return splitStep()
      }
      edge = false
      const tNext = t + dt
      const trap = method === 'trap' && !restart && !(squares.length > 0 && edgeIn(t, tNext))
      sc.t = tNext
      sc.trap = trap
      lastTrap = trap
      const r = solveNow(true)
      const sol = r.sol
      if (r.x) {
        x.set(r.x)
        captureState(compiled, x, dt, trap)
        lastGood = sol
        // a device switched mode inside this step: take the next one with backward Euler
        restart = r.modes
      }
      t = tNext
      return sol
    },
    setParam(id, key, value) {
      const old = current.elements.find((e) => e.id === id)
      if (!old) return
      const el = setElementKey(old, key, value)
      current = { ...current, elements: current.elements.map((e) => (e === old ? el : e)) }
      const dev = compiled.byId.get(id)
      if (dev && layoutSignature(el) === layoutSignature(old)) {
        // same matrix layout: swap in a re-prepared device (copy-on-write, so Solutions
        // already handed out keep measuring with the parameters they were solved with)
        const nd: Dev = { ...dev, el }
        prepareDevice(nd)
        compiled.devs = compiled.devs.map((d) => (d === dev ? nd : d))
        compiled.byId.set(id, nd)
        partition(compiled)
        restart = edge = true
        planDirty = true
        findSquares()
      } else recompile()
    },
    setPin(pin, state) {
      const prev = pins[pin]
      pins[pin] = { ...state }
      if (!prev || prev.mode !== state.mode || prev.level !== state.level) {
        compiled.linValid = false
        restart = edge = true
        planDirty = true
      }
    },
    setNetlist(n) {
      current = { ...n, elements: n.elements.slice() }
      recompile()
    },
    peek(h) {
      const lim = new Float64Array(compiled.lim)
      const limSave = new Float64Array(compiled.limSave)
      const saved = { dt: sc.dt, t: sc.t, trap: sc.trap }
      sc.dt = Math.max(h, 1e-9)
      sc.t = t + sc.dt
      sc.trap = false
      const sol = solveNow(false).sol
      sc.dt = saved.dt
      sc.t = saved.t
      sc.trap = saved.trap
      compiled.lim.set(lim)
      compiled.limSave.set(limSave)
      return sol
    },
  }
}
