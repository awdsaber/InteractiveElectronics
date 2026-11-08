import { describe, expect, it } from 'vitest'
import { formatSI } from './format'

describe('formatSI', () => {
  it('formats the plan cases', () => {
    expect(formatSI(0.0043, 'A')).toBe('4.3 mA')
    expect(formatSI(4700, 'Ω')).toBe('4.7 kΩ')
    expect(formatSI(1e-6, 'A')).toBe('1.0 µA')
  })

  it('counts steps without prefixes', () => {
    expect(formatSI(0, 'steps', 1)).toBe('0 steps')
    expect(formatSI(6380, 'steps', 1)).toBe('6380 steps')
  })

  it('keeps integer mantissas without exponent notation', () => {
    expect(formatSI(220, 'Ω')).toBe('220 Ω')
    expect(formatSI(47, 'Ω')).toBe('47 Ω')
    expect(formatSI(5, 'V')).toBe('5.0 V')
  })

  it('rolls over to the next prefix after rounding', () => {
    expect(formatSI(999.96, 'Ω')).toBe('1.0 kΩ')
  })

  it('handles sign, zero, digits and non-finite values', () => {
    expect(formatSI(-0.0043, 'A')).toBe('-4.3 mA')
    expect(formatSI(0, 'V')).toBe('0.0 V')
    expect(formatSI(0.0123456, 'A', 3)).toBe('12.3 mA')
    expect(formatSI(2.2e6, 'Ω')).toBe('2.2 MΩ')
    expect(formatSI(Number.NaN, 'V')).toBe('— V')
  })

  it('does not apply SI prefixes to non-SI units', () => {
    expect(formatSI(1500, 'rpm')).toBe('1500 rpm')
    expect(formatSI(25, '°C')).toBe('25 °C')
  })

  it('units that already carry a prefix, or are logarithmic or counted, take none', () => {
    expect(formatSI(-3.5, 'dBm', 3)).toBe('-3.50 dBm')
    expect(formatSI(0.002, 'dBm', 3)).toBe('0.00200 dBm')
    expect(formatSI(1234, 'counts', 3)).toBe('1234 counts')
    expect(formatSI(12.5, 'µs', 3)).toBe('12.5 µs')
    expect(formatSI(1500, 'µs', 3)).toBe('1500 µs')
    expect(formatSI(150, 'mΩ', 3)).toBe('150 mΩ')
    expect(formatSI(42, '%', 3)).toBe('42.0 %')
  })

  it('SI units with prefixes: seconds, hertz, coulombs', () => {
    expect(formatSI(0.0025, 's', 3)).toBe('2.50 ms')
    expect(formatSI(1590, 'Hz', 3)).toBe('1.59 kHz')
    expect(formatSI(4.7e-6, 'C', 2)).toBe('4.7 µC')
  })
})
