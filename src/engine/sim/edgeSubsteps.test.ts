import { describe, expect, it } from 'vitest'
import type { Netlist } from '../types'
import { createTransient } from './transient'

// A 6 V pack drives a 1 mH, 4 Ω winding through an NPN low-side switch with no flyback diode.
// At a 1 ms step backward Euler can't see the kick (L·I/dt ≈ 0.2 V per mA), so the switching
// step is split into geometrically growing substeps that resolve the µs-long avalanche.
function coil(): Netlist {
  return {
    elements: [
      { id: 'VP', type: 'V', nodes: ['pk', '0'], value: 6 },
      { id: 'L1', type: 'L', nodes: ['pk', 'n'], value: 1e-3 },
      { id: 'R1', type: 'R', nodes: ['n', 'c'], value: 30 },
      { id: 'Q1', type: 'NPN', nodes: ['c', 'b', '0'], beta: 150, vBreak: 60 },
      { id: 'VB', type: 'V', nodes: ['drv', '0'], value: 5 },
      { id: 'RB', type: 'R', nodes: ['drv', 'b'], value: 470 },
    ],
  }
}

function settle(edgeSubsteps?: number) {
  const sim = createTransient(coil(), 1e-3, { edgeSubsteps })
  for (let k = 0; k < 50; k++) sim.step()
  return sim
}

describe('edge substeps (TransientOptions.edgeSubsteps)', () => {
  it('without them a 1 ms step misses the inductive kick entirely', () => {
    const sim = settle()
    expect(sim.lastGood!.current['L1']).toBeGreaterThan(0.18)
    sim.setParam('VB', 'value', 0)
    const s = sim.step()
    expect(s.extra['Q1.vce']).toBeLessThan(40)
    expect(sim.substeps).toEqual([])
  })

  it('split the step after a parameter change: V_CE reaches the 60 V clamp, the interval still sums to dt', () => {
    const sim = settle(10)
    expect(sim.substeps).toEqual([]) // no edge, no substeps
    const t0 = sim.t
    sim.setParam('VB', 'value', 0)
    const s = sim.step()
    expect(sim.t).toBeCloseTo(t0 + 1e-3, 12)
    expect(sim.substeps.length).toBe(9) // 10 substeps: 9 intermediate solutions plus the returned one
    const ts = sim.substeps.map((x) => x.t)
    expect(ts[0] - t0).toBeCloseTo(1e-3 / 1023, 12)
    for (let k = 1; k < ts.length; k++) expect(ts[k]).toBeGreaterThan(ts[k - 1])
    const peak = Math.max(...sim.substeps.map((x) => x.solution.extra['Q1.vce']))
    expect(peak).toBeGreaterThan(59)
    expect(peak).toBeLessThan(62)
    expect(Math.abs(s.current['L1'])).toBeLessThan(1e-3) // the clamp ate the energy
    expect(s.extra['Q1.vce']).toBeCloseTo(6, 1)
    // the next step is a plain one again
    sim.step()
    expect(sim.substeps).toEqual([])
  })

  it('pin changes are edges too, and substeps leave the steady state unchanged', () => {
    const sim = settle(8)
    const before = sim.lastGood!.current['L1']
    sim.setPin(3, { mode: 'OUTPUT', level: 1 }) // no PIN element on pin 3: an edge, nothing changes
    const s = sim.step()
    expect(sim.substeps.length).toBe(7)
    expect(s.current['L1']).toBeCloseTo(before, 6)
  })
})
