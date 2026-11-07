import { describe, expect, it } from 'vitest'
import type { Element, Solution } from '../types'
import { checkRatings, createRatingState } from './ratings'
import { createTransient } from './transient'

/** Wall-clock budgets are tuned for dev machines; shared CI runners are too noisy. */
const ON_CI = !!(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.CI

// Regression guard, not a benchmark: budgets are ~10x the measured cost so CI noise
// doesn't flake. Target in the browser is < 2 ms per frame (30 steps) for this chain.
function chain(nonlinear: boolean, pwm = false): Element[] {
  const els: Element[] = [
    pwm
      ? { id: 'P9', type: 'PIN', nodes: ['n0', '0'], pin: 9, vcc: 5, rOut: 1e-3 }
      : { id: 'V1', type: 'V', nodes: ['n0', '0'], value: 5 },
  ]
  for (let k = 0; k < 60; k++) {
    els.push({ id: `R${k}`, type: 'R', nodes: [`n${k}`, `n${k + 1}`], value: 100 })
    if (k % 3 === 0) els.push({ id: `C${k}`, type: 'C', nodes: [`n${k + 1}`, '0'], value: 1e-6 })
    else if (nonlinear && k % 3 === 1) els.push({ id: `D${k}`, type: 'LED', nodes: [`n${k + 1}`, '0'], color: 'red' })
    else els.push({ id: `G${k}`, type: 'R', nodes: [`n${k + 1}`, '0'], value: 1e4 })
  }
  return els
}

function msPerFrame(nonlinear: boolean, pwm = false): number {
  const sim = createTransient({ elements: chain(nonlinear, pwm) }, 1e-4)
  if (pwm) sim.setPin(9, { mode: 'OUTPUT', level: 0.5 })
  for (let i = 0; i < 600; i++) sim.step() // warm up the JIT
  let best = Infinity
  for (let rep = 0; rep < 5; rep++) {
    const t0 = performance.now()
    for (let f = 0; f < 20; f++) for (let i = 0; i < 30; i++) sim.step()
    best = Math.min(best, (performance.now() - t0) / 20)
  }
  return best
}

/** ms for 30 checkRatings calls on fresh (lazy) solutions of a chain with 60 rated resistors */
function ratingsMs(): number {
  const els = chain(true).map((e, k): Element =>
    e.type === 'R' ? { ...e, rating: k % 2 ? { maxI: 1, maxP: 1 } : { maxP: 1, rth: 50, tauTh: 1, tMax: 150 } } : e,
  )
  const n = { elements: els }
  const sim = createTransient(n, 1e-4)
  const st = createRatingState()
  for (let i = 0; i < 300; i++) checkRatings(n, sim.step(), sim.t, st) // warm up
  // fresh solutions made up front, so stepping (and its garbage) stays out of the timed loop
  const reps = 20
  const sols: Solution[] = []
  const ts: number[] = []
  for (let i = 0; i < 30 * reps; i++) {
    sols.push(sim.step())
    ts.push(sim.t)
  }
  let best = Infinity
  for (let rep = 0; rep < reps; rep++) {
    const t0 = performance.now()
    for (let i = rep * 30; i < rep * 30 + 30; i++) checkRatings(n, sols[i], ts[i], st)
    best = Math.min(best, performance.now() - t0)
  }
  return best
}

describe.skipIf(ON_CI)('checkRatings performance', () => {
  it('60 rated elements, 30 calls on fresh solutions, under 3 ms (measured ≈0.5 ms; headroom for a loaded machine)', () => {
    expect(ratingsMs()).toBeLessThan(3)
  })
})

describe.skipIf(ON_CI)('transient performance (60-stage chain, 30 steps per frame)', () => {
  it('linear RC chain stays well under budget', () => {
    expect(msPerFrame(false)).toBeLessThan(5)
  })
  it('LED chain stays well under budget', () => {
    expect(msPerFrame(true)).toBeLessThan(8)
  })
  it('LED chain on a 50 % PWM pin (two switch states per step) costs at most about 2x', () => {
    expect(msPerFrame(true, true)).toBeLessThan(16)
  })
  it('linear RC chain on a PWM pin keeps the single averaged solve', () => {
    expect(msPerFrame(false, true)).toBeLessThan(5)
  })
})
