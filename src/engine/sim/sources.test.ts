import { describe, expect, it } from 'vitest'
import type { Element, Netlist } from '../types'
import { applyPatches } from './failures'
import { solveDC } from './solve'
import { createTransient } from './transient'

const load = (v: Element, r = 1000): Netlist => ({
  elements: [v, { id: 'RL', type: 'R', nodes: ['a', '0'], value: r }],
})

describe('V waveforms', () => {
  const sine: Element = {
    id: 'V1',
    type: 'V',
    nodes: ['a', '0'],
    value: 0,
    wave: { kind: 'sine', amp: 2, freq: 50, offset: 1 },
  }

  it('DC uses the value at t = 0: offset + amp·sin(phase)', () => {
    expect(solveDC(load(sine)).nodeV['a']).toBeCloseTo(1, 9)
    const shifted = { ...sine, wave: { kind: 'sine', amp: 2, freq: 50, offset: 1, phase: 90 } } as Element
    expect(solveDC(load(shifted)).nodeV['a']).toBeCloseTo(3, 9)
  })

  it('sine in transient: 50 Hz, 1 + 2·sin(2π·50·t) gives 3 V at 5 ms and -1 V at 15 ms', () => {
    const sim = createTransient(load(sine), 1e-3)
    const v: number[] = []
    for (let k = 0; k < 15; k++) v.push(sim.step().nodeV['a'])
    expect(v[4]).toBeCloseTo(3, 6) // t = 5 ms
    expect(v[14]).toBeCloseTo(-1, 6) // t = 15 ms
    expect(v[9]).toBeCloseTo(1, 6) // t = 10 ms
  })

  it('square with 25% duty: +amp for the first quarter of each period', () => {
    const sq: Element = { id: 'V1', type: 'V', nodes: ['a', '0'], value: 0, wave: { kind: 'square', amp: 5, freq: 100, duty: 0.25 } }
    const sim = createTransient(load(sq), 1e-3)
    const v: number[] = []
    for (let k = 0; k < 12; k++) v.push(sim.step().nodeV['a'])
    // t = 1..12 ms, period 10 ms: high for frac < 0.25
    // (t = 10 ms sits exactly on an edge and is skipped)
    const r = v.map((x) => Math.round(x))
    expect([...r.slice(0, 9), ...r.slice(10)]).toEqual([5, 5, -5, -5, -5, -5, -5, -5, -5, 5, 5])
  })

  it('triangle: 0 → +amp at a quarter period, 0 at half, -amp at three quarters', () => {
    const tri: Element = { id: 'V1', type: 'V', nodes: ['a', '0'], value: 0, wave: { kind: 'triangle', amp: 1, freq: 250 } }
    const sim = createTransient(load(tri), 5e-4)
    const v: number[] = []
    for (let k = 0; k < 6; k++) v.push(sim.step().nodeV['a'])
    // t = 0.5, 1, 1.5, 2, 2.5, 3 ms with a 4 ms period
    const want = [0.5, 1, 0.5, 0, -0.5, -1]
    v.forEach((x, i) => expect(x).toBeCloseTo(want[i], 6))
  })

  it('setParam with a nested key retunes the waveform live', () => {
    const sim = createTransient(load(sine), 1e-3)
    sim.setParam('V1', 'wave.freq', 25)
    const v: number[] = []
    for (let k = 0; k < 10; k++) v.push(sim.step().nodeV['a'])
    expect(v[9]).toBeCloseTo(3, 6) // 25 Hz peaks at 10 ms
  })
})

describe('V current limit and sink', () => {
  const sup = (extra: Partial<Extract<Element, { type: 'V' }>>): Element =>
    ({ id: 'V1', type: 'V', nodes: ['a', '0'], value: 12, ...extra }) as Element

  it('below the limit it is a plain voltage source', () => {
    const s = solveDC(load(sup({ iLimit: 0.5 }), 100))
    expect(s.ok).toBe(true)
    expect(s.nodeV['a']).toBeCloseTo(12, 6)
    expect(s.current['V1']).toBeCloseTo(-0.12, 6)
    expect(s.extra['V1.cc']).toBe(0)
  })

  it('12 V / 0.5 A limit into 10 Ω: constant current 0.5 A, output folds to 5 V', () => {
    const s = solveDC(load(sup({ iLimit: 0.5 }), 10))
    expect(s.ok).toBe(true)
    expect(s.nodeV['a']).toBeCloseTo(5, 6)
    expect(s.current['V1']).toBeCloseTo(-0.5, 6)
    expect(s.extra['V1.cc']).toBe(1)
  })

  it('current limit also holds in transient and recovers when the load lightens', () => {
    const sim = createTransient(load(sup({ iLimit: 0.5 }), 10), 1e-3)
    expect(sim.step().nodeV['a']).toBeCloseTo(5, 6)
    sim.setParam('RL', 'value', 1000)
    expect(sim.step().nodeV['a']).toBeCloseTo(12, 6)
  })

  it('sink: false refuses back-fed current (9 V through 1 kΩ into a 5 V supply)', () => {
    const n = (sink?: boolean): Netlist => ({
      elements: [
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 5, ...(sink === undefined ? {} : { sink }) },
        { id: 'R1', type: 'R', nodes: ['a', 'b'], value: 1000 },
        { id: 'V2', type: 'V', nodes: ['b', '0'], value: 9 },
      ],
    })
    const normal = solveDC(n())
    expect(normal.nodeV['a']).toBeCloseTo(5, 6)
    expect(normal.current['V1']).toBeCloseTo(0.004, 9)
    const blocked = solveDC(n(false))
    expect(blocked.ok).toBe(true)
    expect(blocked.nodeV['a']).toBeCloseTo(9, 5)
    expect(Math.abs(blocked.current['V1'])).toBeLessThan(1e-9)
    // still sources normally
    const sourcing = solveDC(load(sup({ sink: false, value: 5 }), 1000))
    expect(sourcing.nodeV['a']).toBeCloseTo(5, 6)
  })
})

describe('nested patches', () => {
  it("applyPatches 'set' writes nested keys like rating.maxP without touching siblings", () => {
    const n: Netlist = {
      elements: [{ id: 'R1', type: 'R', nodes: ['a', '0'], value: 10, rating: { maxP: 0.25, maxV: 50 } }],
    }
    const p = applyPatches(n, [{ op: 'set', elementId: 'R1', key: 'rating.maxP', value: 2 }])
    expect(p.elements[0].rating).toEqual({ maxP: 2, maxV: 50 })
    expect(n.elements[0].rating).toEqual({ maxP: 0.25, maxV: 50 })
    const q = applyPatches({ elements: [{ id: 'R2', type: 'R', nodes: ['a', '0'], value: 1 }] }, [
      { op: 'set', elementId: 'R2', key: 'rating.maxI', value: 1 },
    ])
    expect(q.elements[0].rating).toEqual({ maxI: 1 })
  })
})
