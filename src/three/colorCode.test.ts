import { describe, expect, it } from 'vitest'
import { capacitorCode, parseOhms, resistorBands, smdCode } from './colorCode'

describe('resistorBands (4-band)', () => {
  it('220 Ω → red red brown gold', () => {
    expect(resistorBands(220)).toEqual(['red', 'red', 'brown', 'gold'])
  })
  it('4.7 kΩ → yellow violet red gold', () => {
    expect(resistorBands(4700)).toEqual(['yellow', 'violet', 'red', 'gold'])
  })
  it('10 kΩ → brown black orange gold', () => {
    expect(resistorBands(10_000)).toEqual(['brown', 'black', 'orange', 'gold'])
  })
  it('1 kΩ → brown black red gold', () => {
    expect(resistorBands(1000)).toEqual(['brown', 'black', 'red', 'gold'])
  })
  it('10 Ω → brown black black gold', () => {
    expect(resistorBands(10)).toEqual(['brown', 'black', 'black', 'gold'])
  })
  it('1 MΩ → brown black green gold', () => {
    expect(resistorBands(1e6)).toEqual(['brown', 'black', 'green', 'gold'])
  })
  it('sub-10 Ω values use a gold multiplier: 4.7 Ω → yellow violet gold gold', () => {
    expect(resistorBands(4.7)).toEqual(['yellow', 'violet', 'gold', 'gold'])
  })
  it('sub-1 Ω values use a silver multiplier: 0.22 Ω → red red silver gold', () => {
    expect(resistorBands(0.22)).toEqual(['red', 'red', 'silver', 'gold'])
  })
  it('rounds to two significant figures', () => {
    expect(resistorBands(2199)).toEqual(['red', 'red', 'red', 'gold'])
    expect(resistorBands(995)).toEqual(['brown', 'black', 'red', 'gold'])
  })
  it('honours tolerance', () => {
    expect(resistorBands(330, { tolerance: 10 })).toEqual(['orange', 'orange', 'brown', 'silver'])
  })
  it('0 Ω is a single black band', () => {
    expect(resistorBands(0)).toEqual(['black'])
  })
  it('rejects out-of-range values', () => {
    expect(() => resistorBands(-1)).toThrow(RangeError)
    expect(() => resistorBands(1e12)).toThrow(RangeError)
  })
})

describe('resistorBands (5-band)', () => {
  it('10 kΩ 1% → brown black black red brown', () => {
    expect(resistorBands(10_000, { bands: 5 })).toEqual(['brown', 'black', 'black', 'red', 'brown'])
  })
  it('4.7 kΩ 1% → yellow violet black brown brown', () => {
    expect(resistorBands(4700, { bands: 5 })).toEqual(['yellow', 'violet', 'black', 'brown', 'brown'])
  })
})

describe('parseOhms', () => {
  it.each([
    [220, 220],
    ['220', 220],
    ['4.7k', 4700],
    ['4k7', 4700],
    ['2R2', 2.2],
    ['1M', 1e6],
    ['10 kΩ', 10_000],
    ['0R', 0],
  ])('%s → %s', (input, out) => {
    expect(parseOhms(input)).toBeCloseTo(out as number, 9)
  })
  it('returns null for junk', () => {
    expect(parseOhms('abc')).toBeNull()
    expect(parseOhms(undefined)).toBeNull()
    expect(parseOhms(-5)).toBeNull()
  })
})

describe('smdCode', () => {
  it.each([
    [220, '221'],
    [4700, '472'],
    [10, '100'],
    [100_000, '104'],
    [4.7, '4R7'],
    [0.47, 'R47'],
    [0, '000'],
  ])('%s Ω → %s', (ohms, code) => {
    expect(smdCode(ohms)).toBe(code)
  })
})

describe('capacitorCode', () => {
  it.each([
    [100e-9, '104'],
    [22e-12, '220'],
    [4.7e-6, '475'],
    [10e-9, '103'],
    [4.7e-12, '4R7'],
  ])('%s F → %s', (f, code) => {
    expect(capacitorCode(f)).toBe(code)
  })
})
