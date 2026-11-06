import { describe, expect, it } from 'vitest'
import { siLabel, sliderToValue, valueToSlider } from './format'

describe('slider mapping', () => {
  it('linear endpoints and midpoint', () => {
    expect(sliderToValue(0, 0, 10)).toBe(0)
    expect(sliderToValue(1, 0, 10)).toBe(10)
    expect(sliderToValue(0.5, 0, 10)).toBe(5)
  })
  it('log midpoint is the geometric mean', () => {
    expect(sliderToValue(0.5, 10, 1000, true)).toBeCloseTo(100, 6)
  })
  it('snaps to step when linear', () => {
    expect(sliderToValue(0.33, 0, 10, false, 1)).toBe(3)
  })
  it('clamps out of range input', () => {
    expect(sliderToValue(2, 1, 100, true)).toBe(100)
    expect(sliderToValue(-1, 1, 100, true)).toBe(1)
  })
  it('round-trips', () => {
    for (const log of [false, true]) {
      const v = sliderToValue(0.37, 1, 1e6, log)
      expect(valueToSlider(v, 1, 1e6, log)).toBeCloseTo(0.37, 6)
    }
  })
})

describe('siLabel', () => {
  it('formats common values', () => {
    expect(siLabel(0.0043, 'A')).toBe('4.3 mA')
    expect(siLabel(4700, 'Ω')).toBe('4.7 kΩ')
    expect(siLabel(1e-6, 'A')).toBe('1 µA')
    expect(siLabel(5, 'V')).toBe('5 V')
    expect(siLabel(0, 'V')).toBe('0 V')
  })
})
