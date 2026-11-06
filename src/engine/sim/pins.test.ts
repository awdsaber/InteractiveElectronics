import { describe, expect, it } from 'vitest'
import type { Element, Netlist, PinState } from '../types'
import { solveDC } from './solve'

const pin = (extra: Partial<Extract<Element, { type: 'PIN' }>> = {}): Element =>
  ({ id: 'P13', type: 'PIN', nodes: ['p', '0'], pin: 13, vcc: 5, ...extra }) as Element

describe('PIN vccNode', () => {
  // the MCU rail sagged to 4 V
  const rail = (load: number, mode: PinState['mode'], level = 1): ReturnType<typeof solveDC> =>
    solveDC(
      {
        elements: [
          { id: 'VR', type: 'V', nodes: ['rail', '0'], value: 4 },
          pin({ vccNode: 'rail' }),
          ...(load ? [{ id: 'RL', type: 'R', nodes: ['p', '0'], value: load } as Element] : []),
        ],
      },
      { pins: { 13: { mode, level } } },
    )

  it('HIGH follows the rail: 4 V into 1 kΩ through 25 Ω = 3.902 V, drawn from the rail', () => {
    const s = rail(1000, 'OUTPUT')
    expect(s.nodeV['p']).toBeCloseTo(4000 / 1025, 9)
    expect(s.current['VR']).toBeCloseTo(-4 / 1025, 9)
    expect(s.current['P13']).toBeCloseTo(-4 / 1025, 9)
  })

  it('LOW still sinks to GND; the pull-up goes to the rail', () => {
    expect(rail(1000, 'OUTPUT', 0).nodeV['p']).toBeCloseTo(0, 9)
    expect(rail(0, 'INPUT_PULLUP').nodeV['p']).toBeCloseTo(4, 6)
  })

  it('PWM duty 0.5 averages to half the rail', () => {
    expect(rail(0, 'OUTPUT', 0.5).nodeV['p']).toBeCloseTo(2, 9)
  })
})

describe('OUTPUT_OPEN_DRAIN', () => {
  const od = (level: number): number => {
    const n: Netlist = {
      elements: [
        { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 5 },
        { id: 'RP', type: 'R', nodes: ['vcc', 'p'], value: 10e3 },
        pin(),
      ],
    }
    return solveDC(n, { pins: { 13: { mode: 'OUTPUT_OPEN_DRAIN', level } } }).nodeV['p']
  }

  it('LOW pulls the 10 kΩ pull-up down through 25 Ω: 5·25/10025 = 12.5 mV', () => {
    expect(od(0)).toBeCloseTo((5 * 25) / 10025, 9)
  })

  it('HIGH releases the line (the pull-up wins)', () => {
    expect(od(1)).toBeCloseTo(5 * 1e9 / (1e9 + 1e4), 6) // 1 GΩ input leakage
  })
})
