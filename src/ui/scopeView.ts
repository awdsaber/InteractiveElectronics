// Pure helpers behind the instrument panel: 1-2-5 control steps, scope source keys for <select>s,
// a captured sweep (a copy of one window of the bench's scope ring), and min/max-per-pixel-column
// decimation, so a one-sample µs spike survives being drawn in a millisecond window.

import type { SampleRing } from '../engine/bench/sampleRing'
import type { ScopeSource } from '../engine/types'

/** 1-2-5 steps from lo to hi inclusive (lo, hi powers of ten times 1, 2 or 5) */
export function seq125(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let e = Math.floor(Math.log10(lo)) - 1; e <= Math.ceil(Math.log10(hi)) + 1; e++) {
    for (const m of [1, 2, 5]) {
      const v = Number((m * 10 ** e).toPrecision(3))
      if (v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9)) out.push(v)
    }
  }
  return out
}

/** `list` with `v` inserted in order when it is not already there */
export function withValue(list: readonly number[], v: number): number[] {
  if (list.some((x) => Math.abs(x - v) <= Math.abs(v) * 1e-9)) return list.slice()
  return [...list, v].sort((a, b) => a - b)
}

export const sourceKey = (s: ScopeSource | null): string =>
  !s ? 'off' : s.kind === 'current' ? `i:${s.elementId}` : `v:${s.node}${s.ref && s.ref !== '0' ? `|${s.ref}` : ''}`

export function parseSource(key: string): ScopeSource | null {
  if (key.startsWith('i:')) return { kind: 'current', elementId: key.slice(2) }
  if (key.startsWith('v:')) {
    const [node, ref] = key.slice(2).split('|')
    return ref ? { kind: 'voltage', node, ref } : { kind: 'voltage', node }
  }
  return null
}

/** one captured scope window: preallocated copies of the ring rows between t0 and t1 */
export class Sweep {
  readonly t: Float64Array
  readonly ch: [Float32Array, Float32Array]
  n = 0
  t0 = 0
  t1 = 0
  constructor(capacity: number) {
    this.t = new Float64Array(capacity)
    this.ch = [new Float32Array(capacity), new Float32Array(capacity)]
  }
  /** copy the rows in [t0, t1], plus one either side so the trace reaches the screen edges */
  capture(r: SampleRing, t0: number, t1: number): void {
    this.t0 = t0
    this.t1 = t1
    let k = Math.max(0, r.lowerBound(t0) - 1)
    let n = 0
    for (; k < r.count && n < this.t.length; k++) {
      const tk = r.time(k)
      this.t[n] = tk
      this.ch[0][n] = r.value(0, k)
      this.ch[1][n] = r.channels > 1 ? r.value(1, k) : NaN
      n++
      if (tk > t1) break
    }
    this.n = n
  }
  max(c: number): number {
    let m = -Infinity
    for (let i = 0; i < this.n; i++) if (this.t[i] >= this.t0 && this.t[i] <= this.t1 && this.ch[c][i] > m) m = this.ch[c][i]
    return m
  }
  min(c: number): number {
    let m = Infinity
    for (let i = 0; i < this.n; i++) if (this.t[i] >= this.t0 && this.t[i] <= this.t1 && this.ch[c][i] < m) m = this.ch[c][i]
    return m
  }
}

/**
 * A polyline [x0, y0, x1, y1, …] of `n` samples (times `t`, values `v`) across `width` pixel
 * columns for the window t0..t1. A column holding several samples contributes its first, min,
 * max and last value, so narrow spikes are never lost; [NaN, NaN] marks a break (NaN samples).
 * y stays in signal units.
 */
export function columnPath(t: ArrayLike<number>, v: ArrayLike<number>, n: number, t0: number, t1: number, width: number): number[] {
  const out: number[] = []
  const span = t1 - t0 || 1
  let col = NaN
  let cnt = 0
  let fx = 0
  let first = 0
  let lo = 0
  let hi = 0
  let last = 0
  let broken = true
  const flush = () => {
    if (!cnt) return
    if (cnt === 1) out.push(fx, first)
    else {
      const x = col + 0.5
      out.push(x, first, x, lo, x, hi, x, last)
    }
    cnt = 0
    broken = false
  }
  for (let i = 0; i < n; i++) {
    const y = v[i]
    if (Number.isNaN(y)) {
      flush()
      if (!broken && out.length) out.push(NaN, NaN)
      broken = true
      continue
    }
    const x = ((t[i] - t0) / span) * width
    const c = Math.floor(x)
    if (c !== col) {
      flush()
      col = c
      fx = x
      first = lo = hi = last = y
      cnt = 1
      continue
    }
    cnt++
    if (y < lo) lo = y
    if (y > hi) hi = y
    last = y
  }
  flush()
  return out
}
