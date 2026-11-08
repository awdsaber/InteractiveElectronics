import { describe, expect, it } from 'vitest'
import { SampleRing } from '../engine/bench/sampleRing'
import { Sweep, columnPath, parseSource, seq125, sourceKey, withValue } from './scopeView'

describe('scope view helpers', () => {
  it('1-2-5 sequences', () => {
    expect(seq125(1e-3, 1)).toEqual([1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2, 0.5, 1])
    expect(withValue([1, 2, 5], 3)).toEqual([1, 2, 3, 5])
    expect(withValue([1, 2, 5], 2)).toEqual([1, 2, 5])
  })

  it('source keys round-trip', () => {
    const v = { kind: 'voltage', node: 'c', ref: 'e' } as const
    expect(parseSource(sourceKey(v))).toEqual(v)
    expect(parseSource(sourceKey({ kind: 'voltage', node: 'c' }))).toEqual({ kind: 'voltage', node: 'c' })
    expect(parseSource(sourceKey({ kind: 'current', elementId: 'M1' }))).toEqual({ kind: 'current', elementId: 'M1' })
    expect(parseSource('off')).toBeNull()
  })

  it('Sweep copies a window of the ring and keeps channel min / max', () => {
    const r = new SampleRing(64, 2)
    for (let i = 0; i < 20; i++) r.push2(i * 1e-3, i === 10 ? 60 : 0.1, -i)
    const s = new Sweep(64)
    s.capture(r, 0.005, 0.015)
    expect(s.n).toBe(13) // 11 inside, plus one either side
    expect(s.t0).toBe(0.005)
    expect(s.max(0)).toBe(60)
    expect(s.min(1)).toBe(-15)
  })

  it('columnPath keeps a one-sample spike when many samples share a pixel column', () => {
    const n = 1000
    const t = new Float64Array(n)
    const v = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      t[i] = i
      v[i] = i === 503 ? 60 : 1
    }
    const pts = columnPath(t, v, n, 0, n, 10) // 10 columns, 100 samples each
    const ys = pts.filter((_, i) => i % 2 === 1)
    expect(Math.max(...ys)).toBe(60)
    expect(pts.length / 2).toBeLessThanOrEqual(40) // ≤ 4 points per column
  })

  it('columnPath passes sparse samples through unchanged', () => {
    const t = new Float64Array([0, 5, 10])
    const v = new Float32Array([1, 2, 3])
    expect(columnPath(t, v, 3, 0, 10, 100)).toEqual([0, 1, 50, 2, 100, 3])
  })

  it('columnPath breaks the path at NaN (a channel switched off)', () => {
    const t = new Float64Array([0, 1, 2])
    const v = new Float32Array([NaN, NaN, NaN])
    expect(columnPath(t, v, 3, 0, 2, 10)).toEqual([])
  })
})
