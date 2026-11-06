// Fixed-step backward-Euler transient simulation.
// t = 0 is "power on": capacitors start at v0 (default 0), inductors at i0 (default 0),
// motors at rest.

import type { Element, Netlist, PinState, Solution } from '../types'
import { type Compiled, type Dev, captureState, compile, inheritState, layoutSignature, partition, prepareDevice } from './devices'
import { type SolveContext, buildSolution, solveCompiled } from './solve'

export interface Transient {
  /** advance one dt and return the solution at the new time */
  step(): Solution
  /** current sim time in seconds (after the last step) */
  readonly t: number
  readonly dt: number
  /**
   * the most recent solution with ok === true (null before the first one).
   * Pass this to checkRatings so a step that fails to converge doesn't reset burn timers.
   */
  readonly lastGood: Solution | null
  /** change one element parameter, e.g. setParam('S1', 'closed', true) */
  setParam(id: string, key: string, value: number | boolean | string): void
  /** set the GPIO state of every PIN element with this pin number */
  setPin(pin: number, state: PinState): void
  /** swap the circuit (patches, burns) keeping state for elements whose id survives */
  setNetlist(n: Netlist): void
  /** the netlist currently being simulated */
  readonly netlist: Netlist
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
    const count = d.el.type === 'MOTOR' ? 2 : 1
    for (let k = 0; k < count; k++) x[d.br + k] = oldX[o.br + k]
  }
  return x
}

export function createTransient(netlist: Netlist, dt: number): Transient {
  if (!(dt > 0)) throw new Error(`createTransient: dt must be > 0 (got ${dt})`)
  let current: Netlist = { ...netlist, elements: netlist.elements.slice() }
  let compiled = compile(current)
  let x: Float64Array = new Float64Array(compiled.size)
  let steps = 0
  let lastGood: Solution | null = null
  const pins: Record<number, PinState> = {}
  const sc: SolveContext = { mode: 'tran', dt, pins }

  const recompile = () => {
    const next = compile(current)
    x = remapGuess(compiled, x, next)
    inheritState(compiled, next)
    compiled = next
  }

  return {
    get t() {
      return steps * dt
    },
    get dt() {
      return dt
    },
    get netlist() {
      return current
    },
    get lastGood() {
      return lastGood
    },
    step() {
      const r = solveCompiled(compiled, sc, x)
      const sol = buildSolution(compiled, r, sc)
      if (r.ok) {
        x.set(r.x)
        captureState(compiled, x)
        lastGood = sol
      }
      steps += 1
      return sol
    },
    setParam(id, key, value) {
      const old = current.elements.find((e) => e.id === id)
      if (!old) return
      const el = { ...old, [key]: value } as Element
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
      } else recompile()
    },
    setPin(pin, state) {
      const prev = pins[pin]
      pins[pin] = { ...state }
      if (!prev || prev.mode !== state.mode || prev.level !== state.level) compiled.linValid = false
    },
    setNetlist(n) {
      current = { ...n, elements: n.elements.slice() }
      recompile()
    },
  }
}
