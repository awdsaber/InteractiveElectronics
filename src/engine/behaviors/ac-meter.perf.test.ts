import { describe, expect, it } from 'vitest'
import type { BehaviorContext, Netlist, Solution } from '../types'
import { behavior } from './ac-meter'

// In a file of its own, so the JIT sees only this monomorphic fake solution: mixed with the bench
// tests, the solver's and the fake's voltageOf make the reads polymorphic, and V8 boxes the doubles
// they return (which is the caller's cost, not the meter's).
// ── headless drive of the hook: perf and allocation ──

const NET: Netlist = { elements: [{ id: 'V1', type: 'V', nodes: ['a', '0'], value: 0, wave: { kind: 'sine', amp: 2, freq: 50 } }, { id: 'R1', type: 'R', nodes: ['a', 'b'], value: 1 }, { id: 'R2', type: 'R', nodes: ['b', '0'], value: 1 }] }

function fakeCtx(published: Record<string, number>): BehaviorContext {
  return {
    t: 0,
    solution: null,
    pins: {},
    powered: true,
    params: { node: 'a', nodeB: 'b' },
    netlist: NET,
    v: () => 0,
    publish(k, v) {
      published[k] = v
    },
    setParam() {},
    setMotorLoad() {},
    burn() {},
    events: { push() {} },
    mcu: {} as BehaviorContext['mcu'],
  }
}

/** one reusable solution whose node voltages follow `set(t)` (doubles kept in a typed array, so the harness itself allocates nothing) */
function fakeSolution(): { s: Solution; set(t: number): void } {
  const v = new Float64Array(2)
  const s = {
    ok: true,
    nodeV: {},
    current: {},
    power: {},
    extra: {},
    voltageOf: (n: string) => (n === 'a' ? v[0] : n === 'b' ? v[1] : 0),
  } as Solution
  return {
    s,
    set(t) {
      v[0] = 2 * Math.sin(2 * Math.PI * 50 * t)
      v[1] = 0.5 * Math.sin(2 * Math.PI * 50 * t - 0.3)
    },
  }
}

describe('ac-meter: cost of the hook', () => {
  it('reads a synthetic sine through onStep alone', () => {
    const published: Record<string, number> = {}
    const ctx = fakeCtx(published)
    const { s, set } = fakeSolution()
    behavior.onEvent!(ctx, 'power-on')
    const dt = 50e-6
    let t = 0
    for (let f = 0; f < 60; f++) {
      for (let k = 0; k < 333; k++) {
        t += dt
        set(t)
        behavior.onStep!(ctx, t, s)
      }
      ctx.t = t
      behavior.tick!(ctx, 333 * dt)
    }
    expect(published.amp).toBeCloseTo(2, 3)
    expect(published.gain).toBeCloseTo(0.25, 3)
    expect(published.phase).toBeCloseTo((-0.3 * 180) / Math.PI, 1)
  })

  it('does not allocate per step, and 333 steps cost well under a millisecond', () => {
    const published: Record<string, number> = {}
    const ctx = fakeCtx(published)
    const { s, set } = fakeSolution()
    behavior.onEvent!(ctx, 'power-on')
    const dt = 50e-6
    const clock = new Float64Array(1)
    const steps = (n: number) => {
      for (let k = 0; k < n; k++) {
        const t = (clock[0] += dt)
        set(t)
        behavior.onStep!(ctx, t, s)
      }
    }
    steps(200_000) // warm up the JIT
    const mem = (globalThis as { process?: { memoryUsage?: () => { heapUsed: number } } }).process?.memoryUsage
    const h0 = mem ? mem().heapUsed : 0
    steps(300_000)
    const grown = mem ? mem().heapUsed - h0 : 0
    // the meter keeps its state in preallocated fields and typed arrays; one 16-byte object (or a
    // boxed double) per step would be 4.8 MB here. What's left is V8 noise of a few bytes per step.
    expect(grown).toBeLessThan(3_000_000)

    let best = Infinity
    for (let rep = 0; rep < 20; rep++) {
      const t0 = performance.now()
      steps(333)
      best = Math.min(best, performance.now() - t0)
    }
    console.info(`ac-meter: ${best.toFixed(4)} ms per 333 onStep calls (two channels)`)
    expect(best).toBeLessThan(1)
  })
})
