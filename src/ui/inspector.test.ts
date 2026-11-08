import { describe, expect, it } from 'vitest'
import { createBench } from '../engine/bench/simLoop'
import type { Lesson, PartPlacement } from '../engine/types'
import { lesson as divider } from '../lessons/T1/resistor-codes-divider'
import { bandDecode, inspectPart, ratingUse, resistorDecode } from './inspector'

describe('bandDecode: the colour bands read back as a value', () => {
  it('4-band ±5 % parts', () => {
    expect(bandDecode(4700).text).toBe('yellow · violet · red · gold = 4.7 kΩ ±5 %')
    expect(bandDecode(10000).text).toBe('brown · black · orange · gold = 10 kΩ ±5 %')
    expect(bandDecode(220).text).toBe('red · red · brown · gold = 220 Ω ±5 %')
    expect(bandDecode(100000).bands).toEqual(['brown', 'black', 'yellow', 'gold'])
    expect(bandDecode(1e6).text).toBe('brown · black · green · gold = 1 MΩ ±5 %')
  })

  it('reads the bands, not the exact value (a slider between E-series steps)', () => {
    expect(bandDecode(4730).text).toBe('yellow · violet · red · gold = 4.7 kΩ ±5 %')
  })

  it('fractional multipliers and 5-band ±1 % parts', () => {
    expect(bandDecode(4.7).text).toBe('yellow · violet · gold · gold = 4.7 Ω ±5 %')
    expect(bandDecode(4700, { bands: 5 }).text).toBe('yellow · violet · black · brown · brown = 4.7 kΩ ±1 %')
    expect(bandDecode(10000, { tolerance: 10 }).text).toBe('brown · black · orange · silver = 10 kΩ ±10 %')
  })

  it('a zero-ohm link is one black band', () => {
    expect(bandDecode(0).text).toBe('black = 0 Ω')
  })

  it('resistorDecode reads a part the way the 3D body does', () => {
    const p = (params: Record<string, unknown>): PartPlacement => ({ id: 'r', kind: 'resistor', pos: [0, 0], mount: 'tht', role: '', params })
    expect(resistorDecode(p({ ohms: '4k7' }))?.text).toBe('yellow · violet · red · gold = 4.7 kΩ ±5 %')
    expect(resistorDecode(p({ ohms: 4700, film: 'metal' }))?.bands).toHaveLength(5)
    expect(resistorDecode({ ...p({}), kind: 'led' })).toBeNull()
  })
})

describe('ratingUse: how close a value is to its limit', () => {
  it('fraction, percent and tone', () => {
    expect(ratingUse(0.013, 0.02)).toEqual({ frac: 0.65, pct: 65, tone: 'ok' })
    expect(ratingUse(-0.013, 0.02)?.pct).toBe(65) // magnitude
    expect(ratingUse(0.017, 0.02)?.tone).toBe('ok') // 85 %: below the 90 % warn line
    expect(ratingUse(0.019, 0.02)?.tone).toBe('warn') // 95 %
    expect(ratingUse(0.03, 0.02)).toEqual({ frac: 1.5, pct: 150, tone: 'warn' })
  })
  it('a temperature is measured from ambient (25 °C)', () => {
    expect(ratingUse(90, 155, 25)?.pct).toBe(50)
    expect(ratingUse(20, 155, 25)?.pct).toBe(0)
  })
  it('no limit, no use', () => {
    expect(ratingUse(1, 0)).toBeNull()
    expect(ratingUse(1, undefined)).toBeNull()
    expect(ratingUse(NaN, 1)).toBeNull()
  })
})

describe('inspectPart: live values and ratings for a part', () => {
  const L = { ...divider, fig: 1 } as Lesson
  const r1 = L.board.parts.find((p) => p.id === 'r1')!

  it('R1 in the divider: I, V, P and its 1/4 W rating', () => {
    const b = createBench(L)
    b.dispatch('power')
    const info = inspectPart(L, r1, b.snapshot())
    expect(info.elements).toHaveLength(1)
    const e = info.elements[0]
    expect(e.id).toBe('R1')
    const live = Object.fromEntries(e.live.map((r) => [r.label, r.text]))
    // 9 V, ~1.5 Ω inside, 10 k over 4.7 k ∥ 100 k: about 0.6 mA, 6.2 V, 4 mW
    expect(live.I).toMatch(/^6\d\d µA$|^0\.6\d mA$/)
    expect(live.V).toMatch(/^6\.\d+ V$/)
    expect(live.P).toMatch(/mW$/)
    const p = e.ratings.find((r) => r.label === 'P')!
    expect(p.text).toMatch(/^P .+ mW \/ 250 mW max, \d+ %$/)
    expect(p.tone).toBe('ok')
  })

  it('unpowered: values read zero, ratings still listed', () => {
    const info = inspectPart(L, r1, createBench(L).snapshot())
    expect(info.elements[0].ratings.map((r) => r.label)).toContain('P')
  })

  it('a part with no circuit elements has none', () => {
    const bb = L.board.parts.find((p) => p.id === 'bb')!
    expect(inspectPart(L, bb, createBench(L).snapshot()).elements).toEqual([])
  })
})
