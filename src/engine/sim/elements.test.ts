import { describe, expect, it } from 'vitest'
import type { BurnEvent, Element, LogicGate, Netlist } from '../types'
import { applyBurn } from './failures'
import { checkRatings, createRatingState } from './ratings'
import { solveDC } from './solve'
import { createTransient } from './transient'

describe('POT', () => {
  const pot = (pos: number, extra: Element[] = []): Netlist => ({
    elements: [
      { id: 'V1', type: 'V', nodes: ['top', '0'], value: 10 },
      { id: 'P1', type: 'POT', nodes: ['top', 'w', '0'], value: 10e3, pos },
      ...extra,
    ],
  })

  it('10 kΩ at pos 0.25 from A: unloaded wiper = 10·(1 - 0.25) = 7.5 V, 1 mA through the track', () => {
    const s = solveDC(pot(0.25))
    expect(s.nodeV['w']).toBeCloseTo(7.5, 6) // (node gmin 1e-12 S sets the last digits)
    expect(s.current['P1']).toBeCloseTo(1e-3, 9)
    expect(s.power['P1']).toBeCloseTo(0.01, 9)
  })

  it('loaded by 2.5 kΩ: 7.5k ∥ 2.5k = 1.875k, wiper = 10·1.875/4.375 = 4.2857 V', () => {
    const s = solveDC(pot(0.25, [{ id: 'RL', type: 'R', nodes: ['w', '0'], value: 2500 }]))
    expect(s.nodeV['w']).toBeCloseTo(10 * 1.875 / 4.375, 6)
  })

  it('ends are clamped (pos 0 and 1 stay solvable) and pos is tweakable live', () => {
    expect(solveDC(pot(0)).nodeV['w']).toBeCloseTo(10, 5)
    expect(solveDC(pot(1)).nodeV['w']).toBeCloseTo(0, 5)
    const sim = createTransient(pot(0.5), 1e-3)
    expect(sim.step().nodeV['w']).toBeCloseTo(5, 6)
    sim.setParam('P1', 'pos', 0.9)
    expect(sim.step().nodeV['w']).toBeCloseTo(1, 6)
  })
})

describe('XFMR', () => {
  const xf = (n: number, lm?: number, r = 10): Netlist => ({
    elements: [
      { id: 'V1', type: 'V', nodes: ['p', '0'], value: 10 },
      { id: 'T1', type: 'XFMR', nodes: ['p', '0', 's', 'sr'], n, ...(lm ? { lm } : {}) },
      { id: 'RL', type: 'R', nodes: ['s', 'sr'], value: r },
      // the secondary is isolated: give it a reference
      { id: 'RG', type: 'R', nodes: ['sr', '0'], value: 1e6 },
    ],
  })

  it('ideal 10:1 step-down into 10 Ω: Vs = 1 V, Is = 0.1 A, Ip = n·Is = 0.01 A', () => {
    const s = solveDC(xf(0.1))
    expect(s.ok).toBe(true)
    expect(s.nodeV['s'] - s.nodeV['sr']).toBeCloseTo(1, 9)
    expect(s.extra['T1.is']).toBeCloseTo(0.1, 9)
    expect(s.current['T1']).toBeCloseTo(0.01, 9)
    expect(s.extra['T1.ip']).toBeCloseTo(0.01, 9)
    expect(s.power['T1']).toBeCloseTo(0, 9) // ideal: power in = power out
  })

  it('1:2 step-up of a 10 V sine: Vs = 2·Vp at every step', () => {
    const n = xf(2)
    n.elements[0] = { id: 'V1', type: 'V', nodes: ['p', '0'], value: 0, wave: { kind: 'sine', amp: 10, freq: 50 } }
    const sim = createTransient(n, 1e-3)
    for (let k = 0; k < 20; k++) {
      const s = sim.step()
      expect(s.nodeV['s'] - s.nodeV['sr']).toBeCloseTo(2 * s.nodeV['p'], 6)
    }
  })

  it('magnetizing inductance 1 H on 10 V DC: im ramps 10 A/s, 10 mA after 1 ms (on top of the reflected 10 mA)', () => {
    const sim = createTransient(xf(0.1, 1), 1e-4)
    let s = sim.step()
    for (let k = 1; k < 10; k++) s = sim.step()
    expect(s.extra['T1.im']).toBeCloseTo(0.01, 9)
    expect(s.current['T1']).toBeCloseTo(0.02, 9)
  })
})

describe('LOGIC', () => {
  const lv = (v: number) => (v > 2.5 ? 1 : 0)
  function gateOut(gate: LogicGate, ins: number[], load = 0): { v: number; s: ReturnType<typeof solveDC> } {
    const els: Element[] = ins.map((v, i) => ({ id: `V${i}`, type: 'V', nodes: [`i${i}`, '0'], value: v }) as Element)
    els.push({ id: 'U1', type: 'LOGIC', gate, nodes: [...ins.map((_, i) => `i${i}`), 'y'], vcc: 5 })
    if (load) els.push({ id: 'RL', type: 'R', nodes: ['y', '0'], value: load })
    const s = solveDC({ elements: els })
    return { v: s.nodeV['y'], s }
  }

  it('truth tables (5 V logic, unloaded outputs sit on the rails)', () => {
    const table: Record<string, (a: number, b: number) => number> = {
      AND: (a, b) => a & b,
      OR: (a, b) => a | b,
      NAND: (a, b) => 1 - (a & b),
      NOR: (a, b) => 1 - (a | b),
      XOR: (a, b) => a ^ b,
    }
    for (const [gate, f] of Object.entries(table)) {
      for (const a of [0, 5])
        for (const b of [0, 5]) {
          const { v, s } = gateOut(gate as LogicGate, [a, b])
          expect(s.ok).toBe(true)
          expect(v).toBeCloseTo(5 * f(lv(a), lv(b)), 6)
        }
    }
    expect(gateOut('NOT', [0]).v).toBeCloseTo(5, 6)
    expect(gateOut('NOT', [5]).v).toBeCloseTo(0, 6)
    expect(gateOut('BUF', [5]).v).toBeCloseTo(5, 6)
    expect(gateOut('AND', [5, 5, 0]).v).toBeCloseTo(0, 6)
    expect(gateOut('AND', [5, 5, 5]).v).toBeCloseTo(5, 6)
  })

  it('output is a source behind 25 Ω: HIGH into 1 kΩ = 5·1000/1025 = 4.878 V', () => {
    const { v, s } = gateOut('NOT', [0], 1000)
    expect(v).toBeCloseTo(5000 / 1025, 6)
    expect(s.current['U1']).toBeCloseTo(5 / 1025, 9) // sourced into the output
  })

  it('inputs are high impedance: a 1 MΩ divider input is not loaded', () => {
    const s = solveDC({
      elements: [
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['a', 'i'], value: 1e6 },
        { id: 'R2', type: 'R', nodes: ['i', '0'], value: 1e6 },
        { id: 'U1', type: 'LOGIC', gate: 'BUF', nodes: ['i', 'y'], vcc: 5 },
      ],
    })
    expect(s.nodeV['i']).toBeCloseTo(2.5, 4) // only gmin loads it
  })

  it('SCHMITT (inverting, vth 2.5, hyst 1): switches at 3.0 V rising and 2.0 V falling', () => {
    const sim = createTransient(
      {
        elements: [
          { id: 'V1', type: 'V', nodes: ['i', '0'], value: 0, wave: { kind: 'triangle', amp: 2.5, offset: 2.5, freq: 1, phase: -90 } },
          { id: 'U1', type: 'LOGIC', gate: 'SCHMITT', nodes: ['i', 'y'], vcc: 5, hyst: 1 },
        ],
      },
      1e-3,
    )
    let prev = sim.step().nodeV['y']
    const falls: number[] = []
    const rises: number[] = []
    for (let k = 0; k < 2000; k++) {
      const s = sim.step()
      const y = s.nodeV['y']
      if (prev > 2.5 && y <= 2.5) falls.push(s.nodeV['i'])
      if (prev < 2.5 && y >= 2.5) rises.push(s.nodeV['i'])
      prev = y
    }
    expect(falls.length).toBeGreaterThanOrEqual(2)
    expect(rises.length).toBeGreaterThanOrEqual(1)
    for (const v of falls) expect(Math.abs(v - 3)).toBeLessThan(0.05)
    for (const v of rises) expect(Math.abs(v - 2)).toBeLessThan(0.05)
  })

  it('SCHMITT RC relaxation oscillator: T = R·C·ln((Vcc-VT-)/(Vcc-VT+)·VT+/VT-) = 10.025k·100n·ln 2.25 = 0.813 ms', () => {
    const sim = createTransient(
      {
        elements: [
          { id: 'U1', type: 'LOGIC', gate: 'SCHMITT', nodes: ['c', 'y'], vcc: 5, hyst: 1 },
          { id: 'R1', type: 'R', nodes: ['y', 'c'], value: 10e3 },
          { id: 'C1', type: 'C', nodes: ['c', '0'], value: 100e-9 },
        ],
      },
      1e-6,
      { method: 'trap' },
    )
    let prev = 0
    const edges: number[] = []
    for (let k = 0; k < 6000; k++) {
      const y = sim.step().nodeV['y']
      if (prev > 2.5 && y <= 2.5) edges.push(sim.t)
      prev = y
    }
    expect(edges.length).toBeGreaterThanOrEqual(4)
    const T = (edges[edges.length - 1] - edges[1]) / (edges.length - 2)
    const want = 10025 * 100e-9 * Math.log(2.25)
    expect(Math.abs(T / want - 1)).toBeLessThan(0.02)
  })

  it('NOR SR latch powers up in the state given by netlist.ic', () => {
    const latch = (ic: Record<string, number>): Netlist => ({
      ic,
      elements: [
        { id: 'VS', type: 'V', nodes: ['s', '0'], value: 0 },
        { id: 'VR', type: 'V', nodes: ['r', '0'], value: 0 },
        { id: 'U1', type: 'LOGIC', gate: 'NOR', nodes: ['r', 'qn', 'q'], vcc: 5 },
        { id: 'U2', type: 'LOGIC', gate: 'NOR', nodes: ['s', 'q', 'qn'], vcc: 5 },
      ],
    })
    for (const q0 of [0, 5]) {
      const n = latch({ q: q0, qn: 5 - q0 })
      const sim = createTransient(n, 1e-6)
      const s = sim.step()
      expect(s.ok).toBe(true)
      expect(s.nodeV['q']).toBeCloseTo(q0, 4)
      expect(s.nodeV['qn']).toBeCloseTo(5 - q0, 4)
      expect(solveDC(n).nodeV['q']).toBeCloseTo(q0, 4)
    }
    // set: pulse S high, Q goes high and stays after S returns low
    const sim = createTransient(latch({ q: 0, qn: 5 }), 1e-6)
    sim.step()
    sim.setParam('VS', 'value', 5)
    sim.step()
    sim.setParam('VS', 'value', 0)
    expect(sim.step().nodeV['q']).toBeCloseTo(5, 4)
  })
})

describe('FUSE', () => {
  const fused = (v: number, r: number): Netlist => ({
    elements: [
      { id: 'V1', type: 'V', nodes: ['a', '0'], value: v },
      { id: 'F1', type: 'FUSE', nodes: ['a', 'b'], iRated: 1, i2t: 1, r: 0.1, partId: 'fuse1' },
      { id: 'RL', type: 'R', nodes: ['b', '0'], value: r },
    ],
  })

  it('conducts through its cold resistance: 10 V / (0.1 + 9.9) Ω = 1 A', () => {
    const s = solveDC(fused(10, 9.9))
    expect(s.current['F1']).toBeCloseTo(1, 9)
    expect(s.nodeV['a'] - s.nodeV['b']).toBeCloseTo(0.1, 9)
  })

  it('2 A on a 1 A, 1 A²s fuse blows at ∫(i² - 1)dt = 1, i.e. t = 1/3 s', () => {
    const n = fused(20, 9.9)
    const sim = createTransient(n, 1e-3)
    const st = createRatingState()
    let ev: BurnEvent[] = []
    let t = -1
    for (let k = 0; k < 1000 && t < 0; k++) {
      const s = sim.step()
      ev = checkRatings(n, s, sim.t, st)
      if (ev.length) t = sim.t
    }
    expect(t).toBeGreaterThan(0.332)
    expect(t).toBeLessThan(0.336)
    expect(ev[0]).toMatchObject({ elementId: 'F1', partId: 'fuse1', reason: 'blown' })
    const after = applyBurn(n, ev[0])
    expect(Math.abs(solveDC(after).current['F1'])).toBeLessThan(1e-7)
  })

  it('never blows at its rated current', () => {
    const n = fused(10, 9.9)
    const s = solveDC(n)
    const st = createRatingState()
    for (let k = 0; k <= 1000; k++) expect(checkRatings(n, s, k * 0.01, st)).toEqual([])
  })

  it('blown: true is an open circuit', () => {
    const n = fused(10, 9.9)
    n.elements[1] = { ...n.elements[1], blown: true } as Element
    expect(Math.abs(solveDC(n).current['F1'])).toBeLessThan(1e-7)
  })
})

describe('REG (LDO)', () => {
  const reg = (vin: number, rl: number, rating?: Element['rating'], extra: Element[] = []): Netlist => ({
    elements: [
      { id: 'VIN', type: 'V', nodes: ['in', '0'], value: vin },
      { id: 'U1', type: 'REG', nodes: ['in', '0', 'out'], vout: 5, dropout: 1.1, iLimit: 1, iq: 0.005, ...(rating ? { rating } : {}) },
      { id: 'RL', type: 'R', nodes: ['out', '0'], value: rl },
      ...extra,
    ],
  })

  it('regulates: 9 V in, 50 Ω load -> 5 V, 100 mA out, 105 mA in, P = 4·0.1 + 9·0.005 = 0.445 W', () => {
    const s = solveDC(reg(9, 50))
    expect(s.ok).toBe(true)
    expect(s.nodeV['out']).toBeCloseTo(5, 6)
    expect(s.extra['U1.iout']).toBeCloseTo(0.1, 6)
    expect(s.current['U1']).toBeCloseTo(0.105, 6)
    expect(s.power['U1']).toBeCloseTo(0.445, 5)
    expect(s.extra['U1.dropout']).toBe(0)
  })

  it('drops out: 5.5 V in -> 5.5 - 1.1 = 4.4 V', () => {
    const s = solveDC(reg(5.5, 50))
    expect(s.nodeV['out']).toBeCloseTo(4.4, 6)
    expect(s.extra['U1.dropout']).toBe(1)
  })

  it('current-limits: 1 Ω load -> 1 A, 1 V', () => {
    const s = solveDC(reg(9, 1))
    expect(s.nodeV['out']).toBeCloseTo(1, 6)
    expect(s.extra['U1.iout']).toBeCloseTo(1, 6)
    expect(s.extra['U1.cc']).toBe(1)
  })

  it('unpowered input gives 0 V out; it cannot sink (output back-driven to 7·1k/1.1k = 6.364 V)', () => {
    const off = solveDC(reg(0, 50))
    expect(off.ok).toBe(true)
    expect(off.nodeV['out']).toBeCloseTo(0, 6)
    const s = solveDC(
      reg(9, 1000, undefined, [
        { id: 'V2', type: 'V', nodes: ['x', '0'], value: 7 },
        { id: 'R2', type: 'R', nodes: ['x', 'out'], value: 100 },
      ]),
    )
    expect(s.nodeV['out']).toBeCloseTo(7000 / 1100, 5)
    expect(Math.abs(s.extra['U1.iout'])).toBeLessThan(1e-9)
  })

  it('thermal shutdown: 3.56 W at 50 °C/W, τ 1 s trips at 150 °C (t = ln(178/53) = 1.2115 s), recovers at 130 °C (+0.1744 s)', () => {
    let n = reg(12, 10, { rth: 50, tauTh: 1, tMax: 150, failMode: 'shutdown' })
    const sim = createTransient(n, 1e-3)
    const st = createRatingState()
    let tOff = -1
    let tOn = -1
    for (let k = 0; k < 3000 && tOn < 0; k++) {
      const s = sim.step()
      for (const ev of checkRatings(n, s, sim.t, st)) {
        if (ev.reason === 'thermal-shutdown') {
          tOff = sim.t
          expect(s.extra['U1.tj']).toBeGreaterThanOrEqual(150)
        }
        if (ev.reason === 'thermal-recover') tOn = sim.t
        n = applyBurn(n, ev)
        sim.setNetlist(n)
      }
      if (tOff > 0 && tOn < 0 && sim.t > tOff + 0.002) expect(s.nodeV['out']).toBeCloseTo(0, 6)
    }
    expect(Math.abs(tOff - Math.log(178 / 53))).toBeLessThan(0.003)
    expect(Math.abs(tOn - tOff - Math.log(125 / 105))).toBeLessThan(0.003)
    expect(sim.step().nodeV['out']).toBeCloseTo(5, 6)
  })
})
