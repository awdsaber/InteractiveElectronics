import { describe, expect, it } from 'vitest'
import type { Element } from '../types'
import { createTransient } from './transient'

// Regression guard, not a benchmark: budgets are ~10x the measured cost so CI noise
// doesn't flake. Target in the browser is < 2 ms per frame (30 steps) for this chain.
function chain(nonlinear: boolean): Element[] {
  const els: Element[] = [{ id: 'V1', type: 'V', nodes: ['n0', '0'], value: 5 }]
  for (let k = 0; k < 60; k++) {
    els.push({ id: `R${k}`, type: 'R', nodes: [`n${k}`, `n${k + 1}`], value: 100 })
    if (k % 3 === 0) els.push({ id: `C${k}`, type: 'C', nodes: [`n${k + 1}`, '0'], value: 1e-6 })
    else if (nonlinear && k % 3 === 1) els.push({ id: `D${k}`, type: 'LED', nodes: [`n${k + 1}`, '0'], color: 'red' })
    else els.push({ id: `G${k}`, type: 'R', nodes: [`n${k + 1}`, '0'], value: 1e4 })
  }
  return els
}

function msPerFrame(nonlinear: boolean): number {
  const sim = createTransient({ elements: chain(nonlinear) }, 1e-4)
  for (let i = 0; i < 600; i++) sim.step() // warm up the JIT
  let best = Infinity
  for (let rep = 0; rep < 5; rep++) {
    const t0 = performance.now()
    for (let f = 0; f < 20; f++) for (let i = 0; i < 30; i++) sim.step()
    best = Math.min(best, (performance.now() - t0) / 20)
  }
  return best
}

describe('transient performance (60-stage chain, 30 steps per frame)', () => {
  it('linear RC chain stays well under budget', () => {
    expect(msPerFrame(false)).toBeLessThan(5)
  })
  it('LED chain stays well under budget', () => {
    expect(msPerFrame(true)).toBeLessThan(8)
  })
})
