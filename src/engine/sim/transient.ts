// Fixed-step transient simulation: backward Euler (default) or trapezoidal.
// t = 0 is "power on": capacitors start at v0 (default 0), inductors at i0 (default 0),
// motors at rest, node voltages guessed from netlist.ic.
// Trapezoidal steps fall back to one backward-Euler step after any discontinuity (start,
// parameter / pin / netlist / dt change, square-wave edge, a device mode flip in the previous
// step: V current limit, REG mode, LOGIC edge) so they don't ring numerically.
// With a PIN in PWM and a nonlinear netlist (or a vccNode PWM pin) the pin really switches: each
// step is cut at its edges and the pieces are solved in turn (pwm.ts). The returned solution is
// the time average of the pieces over the last max(dt, PWM period), so readouts read like a DMM.

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
import { type PwmPins, blendArrays, blendSolutions, pwmEdges, pwmMask, pwmPins, pwmStatePins } from './pwm'
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
   * stay put). For reads between steps, e.g. a digitalRead right after a pin changed. Switching PWM
   * pins switch inside it as in step(); the result is the time average over h.
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

  // ── switched PWM (pwm.ts) ──
  let pp: PwmPins | null = null
  /** pins or the device split changed: recompute the switching pins before the next solve */
  let ppDirty = true
  /** per switch state (mask): its last solution (Newton warm start) and limiter memory */
  let mem = new Map<number, { x: Float64Array; lim: Float64Array }>()
  let memKey = ''
  /** state of the committed solution (-1: none / averaged) */
  let lastMask = -1
  /** recent single-state pieces (oldest first), covering at least one period: the readouts' average */
  let window: { w: number; sol: Solution; mask: number }[] = []
  const WINDOW_MAX = 64
  const statePins = new Map<number, Record<number, PinState>>()
  const edgesBuf: number[] = []
  // rollback buffers for a failed or peeked step
  let xSave = new Float64Array(0)
  let stSave = new Float64Array(0)
  let limSave0 = new Float64Array(0)
  let limSave1 = new Float64Array(0)
  const psc: SolveContext = { mode: 'tran', dt, pins, t: 0, trap: false }

  const refreshPwm = () => {
    if (!ppDirty) return
    ppDirty = false
    const prevKey = pp?.key ?? ''
    pp = pwmPins(compiled, pins)
    statePins.clear()
    if (!pp) {
      window = []
      lastMask = -1
    } else if (pp.key !== prevKey || memKey === '') {
      mem = new Map()
      memKey = pp.key
      lastMask = -1
    }
  }

  interface Advance {
    /** the solution at the end (plain), or the time-weighted pieces' blend (PWM) */
    sol: Solution
    ok: boolean
    modes: boolean
    /** trapezoidal rule used (only for one unsplit piece) */
    trap: boolean
  }

  /**
   * Advance the committed state over [t0, t0 + h]: one solve, or with switching PWM pins one solve
   * per piece between their edges, each committed before the next. Pieces go to `pieces` (when
   * given). With `commit` false (peek) every committed buffer is restored afterwards.
   */
  function advance(t0: number, h: number, trapOk: boolean, commit: boolean, pieces: { w: number; sol: Solution; mask: number }[] | null): Advance {
    refreshPwm()
    const c = compiled
    const pl = pp
    if (!pl) {
      sc.dt = h
      sc.t = t0 + h
      sc.trap = trapOk
      c.linTag = -1
      const r = solveCompiled(c, sc, x)
      const sol = buildSolution(c, r, sc)
      sc.dt = dt
      if (r.ok && commit) {
        x.set(r.x)
        captureState(c, x, h, trapOk)
      }
      return { sol, ok: r.ok, modes: r.ok && modesChanged(c), trap: trapOk }
    }
    // piece boundaries: the step ends plus every edge inside, closer than 1 ppm of h merged
    const eb = edgesBuf
    eb.length = 0
    for (const p of pl.pins) pwmEdges(p, t0, h, eb)
    eb.sort((u, v) => u - v)
    const eps = h * 1e-6
    if (xSave.length !== x.length) xSave = new Float64Array(x.length)
    if (stSave.length !== c.st.length) stSave = new Float64Array(c.st.length)
    if (limSave0.length !== c.lim.length) {
      limSave0 = new Float64Array(c.lim.length)
      limSave1 = new Float64Array(c.lim.length)
    }
    xSave.set(x)
    stSave.set(c.st)
    limSave0.set(c.lim)
    limSave1.set(c.limSave)
    const t1 = t0 + h
    const parts: { weight: number; solution: Solution }[] = []
    let a = t0
    let ok = true
    let modes = false
    let trapUsed = false
    let mask = lastMask
    for (let e = 0; e <= eb.length && ok; e++) {
      const b = e < eb.length ? eb[e] : t1
      if (e < eb.length && (b - a < eps || t1 - b < eps)) continue
      const hk = b - a
      mask = pwmMask(pl, (a + b) / 2, t0, h)
      let ps = statePins.get(mask)
      if (!ps) {
        ps = pwmStatePins(pl, pins, mask)
        statePins.set(mask, ps)
      }
      let m = mem.get(mask)
      if (!m) {
        m = { x: new Float64Array(x), lim: new Float64Array(c.lim) }
        if (mem.size > 32) mem.clear()
        mem.set(mask, m)
      }
      const trap = trapOk && eb.length === 0 && mask === lastMask
      c.lim.set(m.lim)
      c.linTag = pl.aVaries ? mask : -1 // a vccNode / open-drain pin stamps the matrix per state
      psc.dt = hk
      psc.t = b
      psc.trap = trap
      psc.pins = ps
      const r = solveCompiled(c, psc, m.x)
      const sol = buildSolution(c, r, psc)
      if (!r.ok) {
        ok = false
        parts.length = 0
        parts.push({ weight: 1, solution: sol })
        break
      }
      modes ||= modesChanged(c)
      trapUsed = trap
      if (commit) {
        m.x.set(r.x)
        m.lim.set(c.lim)
      }
      x.set(r.x)
      captureState(c, x, hk, trap)
      parts.push({ weight: hk, solution: sol })
      pieces?.push({ w: hk, sol, mask })
      a = b
    }
    if (!ok || !commit) {
      x.set(xSave)
      c.st.set(stSave)
      c.lim.set(limSave0)
      c.limSave.set(limSave1)
    } else lastMask = mask
    if (ok) for (const p of parts) p.weight /= h
    const sol = parts.length === 1 ? parts[0].solution : blendSolutions(parts)
    // several pieces: a state switched inside the step
    return { sol, ok, modes: modes || parts.length > 1, trap: trapUsed }
  }

  /** add pieces to the readout window and return its time average over the last max(dt, period) */
  function windowed(pieces: { w: number; sol: Solution; mask: number }[], stepH: number): Solution {
    for (const p of pieces) {
      const last = window[window.length - 1]
      if (window.length >= WINDOW_MAX && last && last.mask === p.mask) {
        // a long run in one state (dt ≪ period): one representative piece for its whole duration
        last.w += p.w
        last.sol = p.sol
      } else window.push({ ...p })
      if (window.length > 2 * WINDOW_MAX) {
        const [o, n] = window.splice(0, 2)
        window.unshift({ w: o.w + n.w, sol: n.sol, mask: n.mask })
      }
    }
    const span = Math.max(stepH, pp?.tMax ?? 0)
    let total = 0
    for (const p of window) total += p.w
    while (window.length > 1 && total - window[0].w >= span * (1 - 1e-9)) total -= window.shift()!.w
    if (window.length === 1) return window[0].sol
    const used = Math.min(total, span)
    const extra = total - used
    const n = window.length
    const sols = new Array<Solution>(n)
    const w = new Float64Array(n)
    for (let k = 0; k < n; k++) {
      sols[k] = window[k].sol
      w[k] = (k === 0 ? window[k].w - extra : window[k].w) / used
    }
    return blendArrays(sols, w)
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
    ppDirty = true
    memKey = ''
    window = []
    lastMask = -1
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
    const pieces: { w: number; sol: Solution; mask: number }[] = []
    let sol: Solution | null = null
    let tk = t0
    for (let k = 0; k < nSub; k++) {
      const h = k === nSub - 1 ? t0 + dt - tk : h0 * 2 ** k
      const ta = tk
      tk = k === nSub - 1 ? t0 + dt : tk + h
      const r = advance(ta, tk - ta, false, true, pieces)
      sol = r.sol
      if (r.ok) lastGood = sol
      if (k < nSub - 1) out.push({ t: tk, solution: sol })
    }
    if (pp && pieces.length) {
      sol = windowed(pieces, dt)
      if (sol.ok) lastGood = sol
    }
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
      const trapOk = method === 'trap' && !restart && !(squares.length > 0 && edgeIn(t, tNext))
      const pieces: { w: number; sol: Solution; mask: number }[] = []
      const r = advance(t, dt, trapOk, true, pieces)
      lastTrap = r.trap
      let sol = r.sol
      if (r.ok) {
        if (pp) sol = windowed(pieces, dt)
        lastGood = sol
        // a device switched mode (or a PWM pin switched) inside this step: take the next one with backward Euler
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
        ppDirty = true
        findSquares()
      } else recompile()
    },
    setPin(pin, state) {
      const prev = pins[pin]
      pins[pin] = { ...state }
      if (!prev || prev.mode !== state.mode || prev.level !== state.level) {
        compiled.linValid = false
        restart = edge = true
        ppDirty = true
      } else if (prev.pwmHz !== state.pwmHz || prev.toneHz !== state.toneHz) ppDirty = true
    },
    setNetlist(n) {
      current = { ...n, elements: n.elements.slice() }
      recompile()
    },
    peek(h) {
      const lim = new Float64Array(compiled.lim)
      const limSave = new Float64Array(compiled.limSave)
      const sol = advance(t, Math.max(h, 1e-9), false, false, null).sol
      compiled.lim.set(lim)
      compiled.limSave.set(limSave)
      return sol
    },
  }
}
