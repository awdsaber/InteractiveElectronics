// Readout evaluation shared by the status panel, peak-hold and the instruments: one source read
// from a solution (through its single-value accessors when it has them, so a per-step read does
// not materialise the solution's maps), derived readouts (sum / diff / ratio / product of other
// readouts, evaluated in dependency order) and peak-hold.

import type { Readout, ReadoutSource, Solution } from '../types'

type Published = Readonly<Record<string, number>>

/** default |value| below which a readout reads 0 */
export const defaultFloor = (unit: string): number => (unit === 'V' ? 1e-6 : unit === 'A' || unit === 'W' ? 1e-9 : 0)

/** one non-derived source (a derived source reads 0 here: use createReadoutEval) */
export function readSource(src: ReadoutSource, s: Solution | null, published: Published): number {
  if (src.kind === 'behavior') return published[src.key] ?? 0
  if (!s || src.kind === 'derived') return 0
  switch (src.kind) {
    case 'voltage': {
      const v = s.voltageOf ? s.voltageOf(src.node) : (s.nodeV[src.node] ?? 0)
      if (!src.ref || src.ref === '0') return v
      return v - (s.voltageOf ? s.voltageOf(src.ref) : (s.nodeV[src.ref] ?? 0))
    }
    case 'current':
      return s.currentOf ? s.currentOf(src.elementId) : (s.current[src.elementId] ?? 0)
    case 'power':
      return s.powerOf ? s.powerOf(src.elementId) : (s.power[src.elementId] ?? 0)
    case 'extra': {
      if (!s.extraOf) return s.extra[src.key] ?? 0
      const dot = src.key.indexOf('.')
      return s.extraOf(dot < 0 ? src.key : src.key.slice(0, dot), src.key)
    }
  }
}

export function derivedValue(op: 'sum' | 'diff' | 'ratio' | 'product', vals: readonly number[]): number {
  switch (op) {
    case 'sum':
      return vals.reduce((a, b) => a + b, 0)
    case 'product':
      return vals.reduce((a, b) => a * b, 1)
    case 'diff':
      return (vals[0] ?? 0) - (vals[1] ?? 0)
    case 'ratio':
      return vals[1] ? (vals[0] ?? 0) / vals[1] : NaN
  }
}

/**
 * Problems with the derived readouts of a list: indices out of range, operand counts, cycles.
 * Empty when every derived readout can be evaluated.
 */
export function readoutGraphErrors(readouts: readonly Readout[]): string[] {
  const errs: string[] = []
  readouts.forEach((r, i) => {
    const s = r.source
    if (s.kind !== 'derived') return
    for (const j of s.of) if (!Number.isInteger(j) || j < 0 || j >= readouts.length) errs.push(`readouts.${i}: no readout ${j}`)
    if ((s.op === 'diff' || s.op === 'ratio') && s.of.length !== 2) errs.push(`readouts.${i}: ${s.op} needs exactly 2 readouts`)
    if ((s.op === 'sum' || s.op === 'product') && s.of.length < 2) errs.push(`readouts.${i}: ${s.op} needs at least 2 readouts`)
  })
  if (errs.length) return errs
  const cyc = cycleFrom(readouts)
  if (cyc) errs.push(`readouts.${cyc[0]}: derived readouts form a cycle (${cyc.join(' → ')})`)
  return errs
}

/** a dependency cycle as readout indices (first repeated at the end), or null */
function cycleFrom(readouts: readonly Readout[]): number[] | null {
  const state = new Uint8Array(readouts.length) // 0 new, 1 on stack, 2 done
  const stack: number[] = []
  const visit = (i: number): number[] | null => {
    if (state[i] === 2) return null
    if (state[i] === 1) return [...stack.slice(stack.indexOf(i)), i]
    state[i] = 1
    stack.push(i)
    const s = readouts[i].source
    if (s.kind === 'derived') {
      for (const j of s.of) {
        const c = readouts[j] ? visit(j) : null
        if (c) return c
      }
    }
    stack.pop()
    state[i] = 2
    return null
  }
  for (let i = 0; i < readouts.length; i++) {
    const c = visit(i)
    if (c) return c
  }
  return null
}

export interface ReadoutEval {
  /** every readout's value (floors applied, derived ones computed) into `out` */
  evalInto(s: Solution | null, published: Published, out: { [i: number]: number; length: number }): void
}

/**
 * An evaluator for a list of readouts (which must pass readoutGraphErrors; a cycle reads 0).
 * Plain sources are read first, then derived ones in dependency order.
 */
export function createReadoutEval(readouts: readonly Readout[]): ReadoutEval {
  const n = readouts.length
  const floors = readouts.map((r) => r.floor ?? defaultFloor(r.unit))
  const plain: number[] = []
  const order: number[] = []
  const seen = new Uint8Array(n)
  const ok = readoutGraphErrors(readouts).length === 0
  const place = (i: number) => {
    if (seen[i]) return
    seen[i] = 1
    const s = readouts[i].source
    if (s.kind === 'derived') for (const j of s.of) place(j)
    order.push(i)
  }
  readouts.forEach((r, i) => {
    if (r.source.kind !== 'derived') plain.push(i)
    else if (ok) place(i)
  })
  const derived = order.filter((i) => readouts[i].source.kind === 'derived')
  const operands = derived.map((i) => new Array<number>((readouts[i].source as { of: number[] }).of.length).fill(0))
  const clamp = (v: number, i: number) => (Math.abs(v) < floors[i] ? 0 : v)
  return {
    evalInto(s, published, out) {
      for (const i of plain) out[i] = clamp(readSource(readouts[i].source, s, published), i)
      for (let k = 0; k < derived.length; k++) {
        const i = derived[k]
        const src = readouts[i].source as Extract<ReadoutSource, { kind: 'derived' }>
        const ops = operands[k]
        for (let m = 0; m < ops.length; m++) ops[m] = out[src.of[m]]
        out[i] = clamp(derivedValue(src.op, ops), i)
      }
      if (!ok) for (const r of readouts.keys()) if (readouts[r].source.kind === 'derived') out[r] = 0
    },
  }
}

/** peak-hold for the readouts with `peak: true`: the value of largest magnitude, sign kept */
export class PeakHold {
  private readonly idx: number[]
  private readonly held: Float64Array
  private readonly has: Uint8Array

  constructor(readouts: readonly Readout[]) {
    this.idx = readouts.flatMap((r, i) => (r.peak ? [i] : []))
    this.held = new Float64Array(readouts.length)
    this.has = new Uint8Array(readouts.length)
  }

  get any(): boolean {
    return this.idx.length > 0
  }

  update(values: { readonly [i: number]: number }): void {
    for (const i of this.idx) {
      const v = values[i]
      if (Number.isNaN(v)) continue
      if (!this.has[i] || Math.abs(v) > Math.abs(this.held[i])) {
        this.held[i] = v
        this.has[i] = 1
      }
    }
  }

  /** replace the peak readouts' live values in `values` with their held peaks */
  apply(values: { [i: number]: number }): void {
    for (const i of this.idx) if (this.has[i]) values[i] = this.held[i]
  }

  reset(): void {
    this.has.fill(0)
  }
}
