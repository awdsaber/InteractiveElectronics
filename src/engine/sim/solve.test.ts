import { describe, expect, it } from 'vitest'
import type { Element, LedColor, Netlist } from '../types'
import { solveDC } from './solve'

const net = (...elements: Element[]): Netlist => ({ elements })

describe('solveDC: linear circuits', () => {
  it('voltage divider: 5 V across 1 kΩ + 1 kΩ gives 2.5 V', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['in', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['in', 'mid'], value: 1000 },
        { id: 'R2', type: 'R', nodes: ['mid', '0'], value: 1000 },
      ),
    )
    expect(s.ok).toBe(true)
    expect(s.nodeV['mid']).toBeCloseTo(2.5, 6)
    expect(s.nodeV['0']).toBe(0)
    expect(s.current['R1']).toBeCloseTo(2.5e-3, 9)
    // source current flows nodes[0] -> nodes[1] through the source: negative when supplying
    expect(s.current['V1']).toBeCloseTo(-2.5e-3, 9)
    expect(s.power['R1']).toBeCloseTo(6.25e-3, 9)
    expect(s.power['V1']).toBeCloseTo(-12.5e-3, 9)
  })

  it('source internal resistance drops voltage under load', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 9, rInternal: 1 },
        { id: 'R1', type: 'R', nodes: ['a', '0'], value: 8 },
      ),
    )
    expect(s.nodeV['a']).toBeCloseTo(8, 6)
  })

  it('current source follows SPICE convention', () => {
    // 1 mA flows from node 0 through the source into node a, then through 1 kΩ back to ground
    const s = solveDC(
      net(
        { id: 'I1', type: 'I', nodes: ['0', 'a'], value: 1e-3 },
        { id: 'R1', type: 'R', nodes: ['a', '0'], value: 1000 },
      ),
    )
    expect(s.nodeV['a']).toBeCloseTo(1, 6)
    expect(s.current['I1']).toBeCloseTo(1e-3, 12)
  })

  it('switch open and closed', () => {
    const build = (closed: boolean) =>
      net(
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 5 },
        { id: 'S1', type: 'SW', nodes: ['a', 'b'], closed },
        { id: 'R1', type: 'R', nodes: ['b', '0'], value: 100 },
      )
    expect(solveDC(build(true)).current['R1']).toBeCloseTo(5 / 100.05, 6)
    expect(Math.abs(solveDC(build(false)).current['R1'])).toBeLessThan(1e-7)
  })

  it('probe is a 0 V ammeter', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 5 },
        { id: 'P1', type: 'PROBE', nodes: ['a', 'b'] },
        { id: 'R1', type: 'R', nodes: ['b', '0'], value: 500 },
      ),
    )
    expect(s.current['P1']).toBeCloseTo(0.01, 9)
    expect(s.nodeV['b']).toBeCloseTo(5, 9)
  })

  it('capacitor is open and inductor is a short in DC', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['a', 'b'], value: 1000 },
        { id: 'C1', type: 'C', nodes: ['b', '0'], value: 1e-6 },
        { id: 'R2', type: 'R', nodes: ['a', 'c'], value: 1000 },
        { id: 'L1', type: 'L', nodes: ['c', '0'], value: 1e-3 },
      ),
    )
    expect(s.nodeV['b']).toBeCloseTo(5, 5)
    expect(s.nodeV['c']).toBeCloseTo(0, 6)
    expect(s.current['L1']).toBeCloseTo(5e-3, 8)
  })

  it('floating nodes do not crash (gmin)', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['a', '0'], value: 1000 },
        { id: 'R2', type: 'R', nodes: ['x', 'y'], value: 1000 }, // island
        { id: 'C1', type: 'C', nodes: ['a', 'z'], value: 1e-6 }, // dangling
        { id: 'D1', type: 'D', nodes: ['p', 'q'] }, // floating diode
      ),
    )
    expect(s.ok).toBe(true)
    for (const v of Object.values(s.nodeV)) expect(Number.isFinite(v)).toBe(true)
    expect(s.nodeV['a']).toBeCloseTo(5, 6)
  })

  it('empty netlist is ok', () => {
    const s = solveDC(net())
    expect(s.ok).toBe(true)
    expect(s.nodeV['0']).toBe(0)
  })

  it('reports failure on a contradictory circuit instead of throwing', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 5 },
        { id: 'V2', type: 'V', nodes: ['a', '0'], value: 3 },
      ),
    )
    expect(s.ok).toBe(false)
    for (const v of Object.values(s.nodeV)) expect(Number.isFinite(v)).toBe(true)
  })
})

describe('solveDC: diodes and LEDs', () => {
  it('LED + 220 Ω on 5 V: red current about 14 mA', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['vcc', 'a'], value: 220 },
        { id: 'D1', type: 'LED', nodes: ['a', '0'], color: 'red' },
      ),
    )
    expect(s.ok).toBe(true)
    expect(s.current['D1']).toBeGreaterThan(0.012)
    expect(s.current['D1']).toBeLessThan(0.016)
  })

  it.each<[LedColor, number]>([
    ['red', 1.8],
    ['yellow', 2.0],
    ['green', 2.1],
    ['blue', 2.9],
    ['white', 2.9],
  ])('%s LED Vf at 20 mA is within 0.1 V of %f', (color, vf) => {
    const s = solveDC(
      net(
        { id: 'I1', type: 'I', nodes: ['0', 'a'], value: 0.02 },
        { id: 'D1', type: 'LED', nodes: ['a', '0'], color },
      ),
    )
    expect(s.ok).toBe(true)
    expect(Math.abs(s.nodeV['a'] - vf)).toBeLessThanOrEqual(0.1)
  })

  it('5 V straight across a red LED draws more than 0.1 A', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 5 },
        { id: 'D1', type: 'LED', nodes: ['vcc', '0'], color: 'red' },
      ),
    )
    expect(s.ok).toBe(true)
    expect(s.current['D1']).toBeGreaterThan(0.1)
  })

  it('reverse-biased LED blocks', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['vcc', 'a'], value: 220 },
        { id: 'D1', type: 'LED', nodes: ['0', 'a'], color: 'red' },
      ),
    )
    expect(Math.abs(s.current['D1'])).toBeLessThan(1e-9)
  })

  it('silicon diode drops about 0.6-0.75 V at a few mA', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['vcc', 'a'], value: 1000 },
        { id: 'D1', type: 'D', nodes: ['a', '0'] },
      ),
    )
    expect(s.nodeV['a']).toBeGreaterThan(0.6)
    expect(s.nodeV['a']).toBeLessThan(0.75)
  })

  it('converges on a stiff circuit (1 kV across a diode and 1 Ω)', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 1000 },
        { id: 'R1', type: 'R', nodes: ['vcc', 'a'], value: 1 },
        { id: 'D1', type: 'D', nodes: ['a', '0'] },
      ),
    )
    expect(s.ok).toBe(true)
    expect(s.current['D1']).toBeGreaterThan(990)
    expect(s.current['D1']).toBeLessThan(1000)
  })

  it('falls back to gmin / source stepping when plain Newton runs out of iterations', () => {
    const led = net(
      { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 5 },
      { id: 'R1', type: 'R', nodes: ['vcc', 'a'], value: 220 },
      { id: 'D1', type: 'LED', nodes: ['a', '0'], color: 'red' },
    )
    const full = solveDC(led)
    const starved = solveDC(led, { maxIter: 8 })
    expect(full.iterations).toBeGreaterThan(8)
    expect(starved.ok).toBe(true)
    expect(starved.iterations).toBeGreaterThan(8)
    expect(starved.current['D1']).toBeCloseTo(full.current['D1'], 9)
  })

  it('zener regulates near vz in reverse and conducts forward', () => {
    const rev = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 12 },
        { id: 'R1', type: 'R', nodes: ['vcc', 'k'], value: 1000 },
        { id: 'Z1', type: 'ZENER', nodes: ['0', 'k'], vz: 5.1 },
      ),
    )
    expect(rev.ok).toBe(true)
    expect(rev.nodeV['k']).toBeGreaterThan(4.95)
    expect(rev.nodeV['k']).toBeLessThan(5.25)
    const fwd = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 12 },
        { id: 'R1', type: 'R', nodes: ['vcc', 'a'], value: 1000 },
        { id: 'Z1', type: 'ZENER', nodes: ['a', '0'], vz: 5.1 },
      ),
    )
    expect(fwd.nodeV['a']).toBeGreaterThan(0.6)
    expect(fwd.nodeV['a']).toBeLessThan(0.8)
  })
})

describe('solveDC: transistors', () => {
  const npnSwitch = (level: number) =>
    solveDC(
      net(
        { id: 'P13', type: 'PIN', nodes: ['pin', '0'], pin: 13, vcc: 5 },
        { id: 'RB', type: 'R', nodes: ['pin', 'b'], value: 1000 },
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 5 },
        { id: 'RL', type: 'R', nodes: ['vcc', 'c'], value: 100 },
        { id: 'Q1', type: 'NPN', nodes: ['c', 'b', '0'] },
      ),
      { pins: { 13: { mode: 'OUTPUT', level } } },
    )

  it('NPN switch saturates when the pin is HIGH', () => {
    const s = npnSwitch(1)
    expect(s.ok).toBe(true)
    expect(s.extra['Q1.ic']).toBeGreaterThan(0.045)
    expect(s.extra['Q1.ic']).toBeLessThan(0.05)
    expect(s.extra['Q1.vce']).toBeLessThan(0.3)
    expect(s.extra['Q1.vce']).toBeGreaterThan(0)
    expect(s.current['Q1']).toBeCloseTo(s.extra['Q1.ic'], 12)
    expect(s.extra['Q1.ib']).toBeGreaterThan(3.5e-3)
    expect(s.extra['Q1.ie']).toBeCloseTo(s.extra['Q1.ic'] + s.extra['Q1.ib'], 9)
  })

  it('NPN switch is off when the pin is LOW', () => {
    const s = npnSwitch(0)
    expect(s.ok).toBe(true)
    expect(Math.abs(s.extra['Q1.ic'])).toBeLessThan(1e-6)
    expect(s.nodeV['c']).toBeCloseTo(5, 3)
  })

  it('NPN in forward-active has Ic ≈ β·Ib', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 10 },
        { id: 'RB', type: 'R', nodes: ['vcc', 'b'], value: 1e6 },
        { id: 'RC', type: 'R', nodes: ['vcc', 'c'], value: 1000 },
        { id: 'Q1', type: 'NPN', nodes: ['c', 'b', '0'], beta: 100 },
      ),
    )
    expect(s.ok).toBe(true)
    expect(s.extra['Q1.ic'] / s.extra['Q1.ib']).toBeCloseTo(100, 0)
  })

  it('PNP high-side switch saturates when its base is pulled low', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 5 },
        { id: 'RB', type: 'R', nodes: ['b', '0'], value: 1000 },
        { id: 'Q1', type: 'PNP', nodes: ['c', 'b', 'vcc'] },
        { id: 'RL', type: 'R', nodes: ['c', '0'], value: 100 },
      ),
    )
    expect(s.ok).toBe(true)
    expect(s.current['RL']).toBeGreaterThan(0.045)
    expect(s.extra['Q1.ic']).toBeGreaterThan(0.045)
    // raw "into first terminal" current is negative for a conducting PNP
    expect(s.current['Q1']).toBeLessThan(0)
  })

  it('NMOS: Vgs = 5 V, Vth = 2 gives load current at about V/R', () => {
    const s = solveDC(
      net(
        { id: 'VG', type: 'V', nodes: ['g', '0'], value: 5 },
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 5 },
        { id: 'RL', type: 'R', nodes: ['vcc', 'd'], value: 100 },
        { id: 'M1', type: 'NMOS', nodes: ['d', 'g', '0'], vth: 2 },
      ),
    )
    expect(s.ok).toBe(true)
    expect(s.current['RL']).toBeGreaterThan(0.05 * 0.98)
    expect(s.current['RL']).toBeLessThanOrEqual(0.05)
    expect(s.extra['M1.id']).toBeCloseTo(s.current['RL'], 9)
  })

  it('NMOS is off below threshold', () => {
    const s = solveDC(
      net(
        { id: 'VG', type: 'V', nodes: ['g', '0'], value: 1.5 },
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 5 },
        { id: 'RL', type: 'R', nodes: ['vcc', 'd'], value: 100 },
        { id: 'M1', type: 'NMOS', nodes: ['d', 'g', '0'], vth: 2 },
      ),
    )
    expect(Math.abs(s.current['RL'])).toBeLessThan(1e-9)
  })

  it('NMOS in saturation follows the square law', () => {
    const s = solveDC(
      net(
        { id: 'VG', type: 'V', nodes: ['g', '0'], value: 3 },
        { id: 'VD', type: 'V', nodes: ['d', '0'], value: 10 },
        { id: 'M1', type: 'NMOS', nodes: ['d', 'g', '0'], vth: 2, k: 0.02 },
      ),
    )
    expect(s.extra['M1.id']).toBeCloseTo((0.02 / 2) * 1 * 1, 9)
  })

  it('PMOS high-side switch conducts when its gate is low', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 5 },
        { id: 'M1', type: 'PMOS', nodes: ['d', '0', 'vcc'], vth: -2 },
        { id: 'RL', type: 'R', nodes: ['d', '0'], value: 100 },
      ),
    )
    expect(s.ok).toBe(true)
    expect(s.current['RL']).toBeGreaterThan(0.049)
  })
})

describe('solveDC: motor, pins and op-amp', () => {
  it('motor: steady-state ω ≈ (V - I·R)/ke', () => {
    const s = solveDC(
      net(
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 6 },
        { id: 'M1', type: 'MOTOR', nodes: ['vcc', '0'], r: 2, ke: 0.01, b: 1e-6, load: 2e-3 },
      ),
    )
    expect(s.ok).toBe(true)
    const i = s.current['M1']
    const w = s.extra['M1.omega']
    expect(i).toBeGreaterThan(0)
    expect(w).toBeGreaterThan(0)
    expect(w).toBeCloseTo((6 - i * 2) / 0.01, 6)
    expect(s.extra['M1.rpm']).toBeCloseTo((w * 60) / (2 * Math.PI), 6)
    // torque balance: kt·i = b·ω + load (load fully developed when spinning)
    expect(0.01 * i).toBeCloseTo(1e-6 * w + 2e-3, 6)
  })

  it('PIN modes: OUTPUT HIGH/LOW, PWM average, INPUT high-Z, INPUT_PULLUP', () => {
    const build = () =>
      net(
        { id: 'P2', type: 'PIN', nodes: ['p', '0'], pin: 2, vcc: 5 },
        { id: 'R1', type: 'R', nodes: ['p', '0'], value: 10000 },
      )
    const hi = solveDC(build(), { pins: { 2: { mode: 'OUTPUT', level: 1 } } })
    expect(hi.nodeV['p']).toBeCloseTo((5 * 10000) / 10025, 6)
    expect(hi.current['P2']).toBeLessThan(0) // sourcing current
    const pwm = solveDC(build(), { pins: { 2: { mode: 'OUTPUT', level: 0.5 } } })
    expect(pwm.nodeV['p']).toBeCloseTo((2.5 * 10000) / 10025, 6)
    const input = solveDC(build(), { pins: { 2: { mode: 'INPUT', level: 0 } } })
    expect(Math.abs(input.nodeV['p'])).toBeLessThan(1e-6)
    const pull = solveDC(build(), { pins: { 2: { mode: 'INPUT_PULLUP', level: 0 } } })
    expect(pull.nodeV['p']).toBeCloseTo((5 * 10000) / 45000, 4)
    // no pin state given: defaults to INPUT
    expect(Math.abs(solveDC(build()).nodeV['p'])).toBeLessThan(1e-6)
  })

  it('op-amp follower, non-inverting gain and rail clamp', () => {
    const follower = solveDC(
      net(
        { id: 'VIN', type: 'V', nodes: ['in', '0'], value: 1.2 },
        { id: 'U1', type: 'OPAMP', nodes: ['in', 'out', 'out'], vPos: 5, vNeg: 0 },
        { id: 'RL', type: 'R', nodes: ['out', '0'], value: 1000 },
      ),
    )
    expect(follower.ok).toBe(true)
    expect(follower.nodeV['out']).toBeCloseTo(1.2, 3)

    const gain = (vin: number) =>
      solveDC(
        net(
          { id: 'VIN', type: 'V', nodes: ['in', '0'], value: vin },
          { id: 'U1', type: 'OPAMP', nodes: ['in', 'fb', 'out'], vPos: 5, vNeg: 0 },
          { id: 'RF', type: 'R', nodes: ['out', 'fb'], value: 10000 },
          { id: 'RG', type: 'R', nodes: ['fb', '0'], value: 10000 },
        ),
      )
    expect(gain(1).nodeV['out']).toBeCloseTo(2, 3)
    const sat = gain(4)
    expect(sat.ok).toBe(true)
    expect(sat.nodeV['out']).toBeGreaterThan(4.95)
    expect(sat.nodeV['out']).toBeLessThanOrEqual(5)
  })

  it('op-amp comparator swings to the rails', () => {
    const cmp = (vin: number) =>
      solveDC(
        net(
          { id: 'VIN', type: 'V', nodes: ['in', '0'], value: vin },
          { id: 'VR', type: 'V', nodes: ['ref', '0'], value: 2.5 },
          { id: 'U1', type: 'OPAMP', nodes: ['in', 'ref', 'out'], vPos: 5, vNeg: 0 },
        ),
      ).nodeV['out']
    expect(cmp(3)).toBeGreaterThan(4.99)
    expect(cmp(2)).toBeLessThan(0.01)
  })
})
