import { describe, expect, it } from 'vitest'
import type { Readout, Solution } from '../types'
import { PeakHold, createReadoutEval, readoutGraphErrors, readSource } from './readouts'

const sol = (over: Partial<Solution> = {}): Solution => ({
  ok: true,
  nodeV: { a: 5, b: 2 },
  current: { R1: 0.01, R2: 0.03 },
  power: { R1: 0.05 },
  extra: { 'Q1.vce': 0.2 },
  ...over,
})

const V = (node: string, ref?: string): Readout => ({ label: node, source: { kind: 'voltage', node, ref }, unit: 'V' })
const I = (id: string): Readout => ({ label: id, source: { kind: 'current', elementId: id }, unit: 'A' })
const D = (op: 'sum' | 'diff' | 'ratio' | 'product', of: number[], unit: Readout['unit'] = ''): Readout => ({
  label: op,
  source: { kind: 'derived', op, of },
  unit,
})

describe('readSource', () => {
  it('reads voltages (against ref), currents, power, extras and behavior values', () => {
    const s = sol()
    expect(readSource({ kind: 'voltage', node: 'a' }, s, {})).toBe(5)
    expect(readSource({ kind: 'voltage', node: 'a', ref: 'b' }, s, {})).toBe(3)
    expect(readSource({ kind: 'current', elementId: 'R2' }, s, {})).toBe(0.03)
    expect(readSource({ kind: 'power', elementId: 'R1' }, s, {})).toBe(0.05)
    expect(readSource({ kind: 'extra', key: 'Q1.vce' }, s, {})).toBe(0.2)
    expect(readSource({ kind: 'behavior', key: 'm.x' }, null, { 'm.x': 7 })).toBe(7)
    expect(readSource({ kind: 'current', elementId: 'R1' }, null, {})).toBe(0)
  })

  it('prefers the fast single-value accessors when the solution has them', () => {
    const s = sol({
      nodeV: {},
      current: {},
      voltageOf: (n) => (n === 'a' ? 9 : 1),
      currentOf: (id) => (id === 'R1' ? 0.5 : 0),
      extraOf: (id, key) => (id === 'Q1' && key === 'Q1.vce' ? 0.3 : 0),
      powerOf: () => 2,
    })
    expect(readSource({ kind: 'voltage', node: 'a', ref: 'x' }, s, {})).toBe(8)
    expect(readSource({ kind: 'current', elementId: 'R1' }, s, {})).toBe(0.5)
    expect(readSource({ kind: 'extra', key: 'Q1.vce' }, s, {})).toBe(0.3)
    expect(readSource({ kind: 'power', elementId: 'R1' }, s, {})).toBe(2)
  })
})

describe('derived readouts', () => {
  const evalAll = (rs: Readout[], s: Solution | null = sol()) => {
    const e = createReadoutEval(rs)
    const out = new Float64Array(rs.length)
    e.evalInto(s, {}, out)
    return [...out]
  }

  it('sum, diff, ratio and product of other readouts', () => {
    const rs = [V('a'), V('b'), D('sum', [0, 1], 'V'), D('diff', [0, 1], 'V'), D('ratio', [1, 0]), D('product', [0, 6], 'W'), I('R1')]
    const v = evalAll(rs)
    expect(v[2]).toBe(7)
    expect(v[3]).toBe(3)
    expect(v[4]).toBeCloseTo(0.4, 12)
    expect(v[5]).toBeCloseTo(0.05, 12) // 5 V × 10 mA
  })

  it('a derived readout may use a later readout and other derived ones', () => {
    const rs = [D('sum', [1, 2], 'A'), I('R1'), I('R2'), D('ratio', [0, 1])]
    const v = evalAll(rs)
    expect(v[0]).toBeCloseTo(0.04, 12)
    expect(v[3]).toBeCloseTo(4, 12)
  })

  it('a zero denominator gives NaN (shown as —)', () => {
    const v = evalAll([V('a'), V('z'), D('ratio', [0, 1])])
    expect(v[2]).toBeNaN()
  })

  it('applies each readout’s floor', () => {
    const v = evalAll([{ ...V('a'), floor: 10 }, V('b')])
    expect(v).toEqual([0, 2])
  })

  it('no solution: sources read 0', () => {
    expect(evalAll([V('a'), D('sum', [0, 0], 'V')], null)).toEqual([0, 0])
  })

  it('graph errors: bad indices, self references, cycles, operand counts', () => {
    expect(readoutGraphErrors([V('a'), D('sum', [0, 3])])).toEqual(['readouts.1: no readout 3'])
    expect(readoutGraphErrors([D('sum', [0, 0])])).toEqual(['readouts.0: derived readouts form a cycle (0 → 0)'])
    expect(readoutGraphErrors([D('sum', [1, 1]), D('diff', [0, 0])])[0]).toMatch(/cycle/)
    expect(readoutGraphErrors([V('a'), V('b'), D('diff', [0, 1, 0])])).toEqual(['readouts.2: diff needs exactly 2 readouts'])
    expect(readoutGraphErrors([V('a'), D('sum', [0])])).toEqual(['readouts.1: sum needs at least 2 readouts'])
    expect(readoutGraphErrors([V('a'), V('b'), D('ratio', [0, 1])])).toEqual([])
  })
})

describe('PeakHold', () => {
  it('holds the value of largest magnitude (with its sign) for peak readouts only', () => {
    const rs: Readout[] = [{ ...V('a'), peak: true }, V('b')]
    const p = new PeakHold(rs)
    p.update([1, 1])
    p.update([-3, 9])
    p.update([2, 0])
    const out = [2, 0]
    p.apply(out)
    expect(out).toEqual([-3, 0])
    expect(p.any).toBe(true)
  })

  it('reset forgets the peak; NaN never becomes the peak', () => {
    const p = new PeakHold([{ ...V('a'), peak: true }])
    p.update([5])
    p.update([NaN])
    const out = [0]
    p.apply(out)
    expect(out).toEqual([5])
    p.reset()
    out[0] = 1
    p.apply(out)
    expect(out).toEqual([1]) // nothing held yet: the live value shows
  })

  it('no peak readouts: inactive', () => {
    expect(new PeakHold([V('a')]).any).toBe(false)
  })
})
