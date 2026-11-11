import { describe, expect, it } from 'vitest'
import { COPPER_ALPHA, OZ_MIL, OZ_UM, ipcArea, ipcCurrent, ipcRise, ipcWidthMm, polylineLengthMm, traceResistance } from './ipc2221'

describe('IPC-2221 trace sizing (outer layer: I = 0.048 · ΔT^0.44 · A^0.725, A in mil²)', () => {
  it('1 oz copper is 1.378 mil = 35 µm thick', () => {
    expect(OZ_MIL).toBeCloseTo(1.378, 3)
    expect(OZ_UM).toBeCloseTo(35, 0)
  })

  it('1 A at a 10 °C rise needs about 16.3 mil², 0.30 mm wide in 1 oz', () => {
    expect(ipcArea(1, 10)).toBeCloseTo(16.3, 1)
    expect(ipcWidthMm(1, 10, 1)).toBeCloseTo(0.3, 2)
  })

  it('2 A at a 10 °C rise needs about 42.4 mil², 0.78 mm wide in 1 oz and 0.39 mm in 2 oz', () => {
    expect(ipcArea(2, 10)).toBeCloseTo(42.4, 0)
    expect(ipcWidthMm(2, 10, 1)).toBeCloseTo(0.78, 2)
    expect(ipcWidthMm(2, 10, 2)).toBeCloseTo(0.39, 2)
  })

  it('inner layers carry half the current for the same area (k = 0.024)', () => {
    expect(ipcCurrent(ipcWidthMm(1, 10, 1), 10, 1, false)).toBeCloseTo(0.5, 6)
    expect(ipcWidthMm(1, 10, 1, false)).toBeGreaterThan(2.5 * ipcWidthMm(1, 10, 1))
  })

  it('rise is the inverse: 2 A in 0.30 mm rises about 48 °C, in 0.15 mm about 148 °C, in 0.10 mm about 300 °C', () => {
    expect(ipcRise(2, ipcWidthMm(2, 10, 1), 1)).toBeCloseTo(10, 6)
    expect(ipcRise(2, 0.3, 1)).toBeCloseTo(48, 0)
    expect(ipcRise(2, 0.15, 1)).toBeGreaterThan(140)
    expect(ipcRise(2, 0.15, 1)).toBeLessThan(155)
    expect(ipcRise(2, 0.1, 1)).toBeGreaterThan(285)
    expect(ipcRise(2, 0.1, 1)).toBeLessThan(310)
    expect(ipcRise(0, 0.3, 1)).toBe(0)
    expect(ipcRise(-2, 0.3, 1)).toBeCloseTo(ipcRise(2, 0.3, 1), 9)
  })

  it('copper resistance: ρ 1.724e-8 Ω·m at 20 °C, +0.393 %/°C', () => {
    // 54 mm × 0.80 mm × 35 µm ≈ 33 mΩ
    expect(traceResistance(54, 0.8, 1, 20)).toBeCloseTo((1.724e-8 * 0.054) / (0.8e-3 * 35e-6), 4)
    expect(traceResistance(54, 0.8, 1, 20)).toBeCloseTo(0.0333, 3)
    expect(traceResistance(54, 0.8, 1, 120) / traceResistance(54, 0.8, 1, 20)).toBeCloseTo(1 + COPPER_ALPHA * 100, 9)
    expect(traceResistance(54, 0.8, 2, 20)).toBeCloseTo(traceResistance(54, 0.8, 1, 20) / 2, 9)
  })

  it('polyline length in mm from board units (1 unit = 10 mm)', () => {
    expect(polylineLengthMm([[0, 0], [3, 0], [3, 4]])).toBeCloseTo(70, 9)
    expect(polylineLengthMm([[1, 1]])).toBe(0)
  })
})
