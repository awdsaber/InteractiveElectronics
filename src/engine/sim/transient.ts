// Fixed-step backward-Euler transient simulation.
// t = 0 is "power on": capacitors start at v0 (default 0), inductors at i0 (default 0),
// motors at rest.

import type { Element, Netlist, PinState, Solution } from '../types'
import { type Compiled, captureState, compile } from './devices'
import { type SolveContext, buildSolution, emptyDynState, solveCompiled } from './solve'

export interface Transient {
  /** advance one dt and return the solution at the new time */
  step(): Solution
  /** current sim time in seconds (after the last step) */
  readonly t: number
  readonly dt: number
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
  for (let i = 0; i < newC.nNodes; i++) {
    const j = oldC.nodeIndex.get(newC.nodeNames[i])
    if (j !== undefined) x[i] = oldX[j]
  }
  const oldBr = new Map<string, { type: string; br: number }>()
  for (const d of oldC.devs) if (d.br >= 0) oldBr.set(d.el.id, { type: d.el.type, br: d.br })
  for (const d of newC.devs) {
    if (d.br < 0) continue
    const o = oldBr.get(d.el.id)
    if (!o || o.type !== d.el.type) continue
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
  const pins: Record<number, PinState> = {}
  const sc: SolveContext = { mode: 'tran', dt, prev: emptyDynState(), pins, lim: {} }

  const recompile = () => {
    const next = compile(current)
    x = remapGuess(compiled, x, next)
    compiled = next
    // forget state for elements that disappeared or changed type
    const types = new Map(current.elements.map((e) => [e.id, e.type]))
    for (const rec of [sc.prev.capV, sc.prev.indI, sc.prev.omega]) {
      for (const id of Object.keys(rec)) if (!types.has(id)) delete rec[id]
    }
    for (const key of Object.keys(sc.lim)) {
      const cut = key.lastIndexOf(':')
      if (types.get(key.slice(0, cut)) !== key.slice(cut + 1)) delete sc.lim[key]
    }
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
    step() {
      const r = solveCompiled(compiled, sc, x)
      const sol = buildSolution(compiled, r, sc)
      if (r.ok) {
        x = r.x
        captureState(compiled, x, sc.prev)
      }
      steps += 1
      return sol
    },
    setParam(id, key, value) {
      current = {
        ...current,
        elements: current.elements.map((e) => (e.id === id ? ({ ...e, [key]: value } as Element) : e)),
      }
      recompile()
    },
    setPin(pin, state) {
      pins[pin] = { ...state }
    },
    setNetlist(n) {
      current = { ...n, elements: n.elements.slice() }
      recompile()
    },
  }
}
