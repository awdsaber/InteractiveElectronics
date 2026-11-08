import { describe, expect, it } from 'vitest'
import { SampleRing, findTrigger } from './sampleRing'

const fill = (r: SampleRing, ts: number[], f: (t: number) => number[]) => {
  for (const t of ts) r.push(t, f(t))
}

describe('SampleRing', () => {
  it('starts empty and keeps samples in time order', () => {
    const r = new SampleRing(8, 2)
    expect(r.count).toBe(0)
    expect(r.lastT).toBeNaN()
    r.push(0.001, [1, 10])
    r.push(0.002, [2, 20])
    expect(r.count).toBe(2)
    expect(r.time(0)).toBe(0.001)
    expect(r.value(1, 1)).toBe(20)
    expect(r.firstT).toBe(0.001)
    expect(r.lastT).toBe(0.002)
  })

  it('preallocates: the arrays never change identity, values are Float32 and times Float64', () => {
    const r = new SampleRing(4, 1)
    const t = r.t
    const v = r.ch[0]
    for (let i = 0; i < 20; i++) r.push(i * 1e-6 + 1000, [i])
    expect(r.t).toBe(t)
    expect(r.ch[0]).toBe(v)
    expect(r.t).toBeInstanceOf(Float64Array)
    expect(r.ch[0]).toBeInstanceOf(Float32Array)
    // µs resolution survives at t = 1000 s (a Float32 time would collapse these)
    expect(r.time(1) - r.time(0)).toBeCloseTo(1e-6, 9)
  })

  it('wraps around, dropping the oldest sample', () => {
    const r = new SampleRing(3, 1)
    fill(r, [1, 2, 3, 4, 5], (t) => [t * 10])
    expect(r.count).toBe(3)
    expect([r.time(0), r.time(1), r.time(2)]).toEqual([3, 4, 5])
    expect([r.value(0, 0), r.value(0, 2)]).toEqual([30, 50])
    expect(r.writes).toBe(5)
  })

  it('ignores samples that go back in time', () => {
    const r = new SampleRing(4, 1)
    r.push(1, [1])
    r.push(0.5, [2])
    expect(r.count).toBe(1)
  })

  it('pushes single values without an array (push1 / push2)', () => {
    const r = new SampleRing(4, 2)
    r.push2(1, 3, 4)
    expect([r.value(0, 0), r.value(1, 0)]).toEqual([3, 4])
    const one = new SampleRing(4, 1)
    one.push1(2, 7)
    expect(one.value(0, 0)).toBe(7)
  })

  it('lowerBound finds the first sample at or after a time', () => {
    const r = new SampleRing(4, 1)
    fill(r, [1, 2, 3, 4, 5, 6], () => [0])
    expect(r.lowerBound(0)).toBe(0)
    expect(r.lowerBound(3.5)).toBe(1) // 3,4,5,6 → index of 4
    expect(r.lowerBound(4)).toBe(1)
    expect(r.lowerBound(7)).toBe(4)
  })

  it('clear() empties it', () => {
    const r = new SampleRing(4, 1)
    r.push(1, [1])
    r.clear()
    expect(r.count).toBe(0)
    r.push(0.5, [1]) // time may restart after a clear
    expect(r.count).toBe(1)
  })
})

describe('findTrigger', () => {
  // a 100 Hz square wave 0 → 5 V sampled every 0.1 ms over 50 ms
  const square = () => {
    const r = new SampleRing(1000, 1)
    for (let i = 0; i <= 500; i++) {
      const t = i * 1e-4
      r.push1(t, Math.floor(t * 200 + 1e-9) % 2 === 1 ? 5 : 0)
    }
    return r
  }

  it('returns the latest rising crossing that still has `post` seconds of data after it', () => {
    const r = square()
    // rising edges at 5, 15, 25, 35, 45 ms
    const tc = findTrigger(r, 0, { level: 2.5, slope: 'rising', post: 0.008 })
    expect(tc).toBeCloseTo(0.035, 3) // 45 ms + 8 ms runs past the 50 ms of data
  })

  it('falling edges', () => {
    const r = square()
    const tc = findTrigger(r, 0, { level: 2.5, slope: 'falling', post: 0.001 })
    expect(tc).toBeCloseTo(0.04, 3)
  })

  it('interpolates the crossing time between samples', () => {
    const r = new SampleRing(8, 1)
    r.push1(0, 0)
    r.push1(1, 10)
    r.push1(2, 10)
    expect(findTrigger(r, 0, { level: 2.5, slope: 'rising', post: 0.5 })).toBeCloseTo(0.25, 9)
  })

  it('only looks after `after` (a held sweep is not re-found)', () => {
    const r = square()
    expect(findTrigger(r, 0, { level: 2.5, slope: 'rising', post: 0.001, after: 0.045 })).toBeNull()
    expect(findTrigger(r, 0, { level: 2.5, slope: 'rising', post: 0.001, after: 0.03 })).toBeCloseTo(0.045, 4)
  })

  it('null when nothing crosses', () => {
    const r = new SampleRing(8, 1)
    for (let i = 0; i < 8; i++) r.push1(i, 1)
    expect(findTrigger(r, 0, { level: 2.5, slope: 'rising', post: 0 })).toBeNull()
  })

  it('catches a one-sample spike between coarse samples', () => {
    const r = new SampleRing(64, 1)
    for (let i = 0; i < 10; i++) r.push1(i * 1e-3, 0.1)
    r.push1(0.009 + 1e-6, 60) // a substep 1 µs after the edge
    r.push1(0.009 + 3e-6, 6)
    for (let i = 10; i < 20; i++) r.push1(i * 1e-3, 6)
    expect(findTrigger(r, 0, { level: 20, slope: 'rising', post: 0.005 })).toBeGreaterThan(0.009)
  })
})
