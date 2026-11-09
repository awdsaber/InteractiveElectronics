import { describe, expect, it } from 'vitest'
import { SPANS_US, asciiOf, formatUs, framesText, liveWindow, zoomStep } from './logicView'

describe('logic-analyzer view helpers', () => {
  it('spans run 5 us .. 1 s in 1-2-5 steps; zoom moves one step and clamps', () => {
    expect(SPANS_US[0]).toBe(5)
    expect(SPANS_US.at(-1)).toBe(1e6)
    expect(zoomStep(2000, 1)).toBe(5000)
    expect(zoomStep(2000, -1)).toBe(1000)
    expect(zoomStep(5, -1)).toBe(5)
    expect(zoomStep(1e6, 1)).toBe(1e6)
  })

  it('the live window ends just after the newest activity, or at now', () => {
    expect(liveWindow(1000, 5000, 100)).toEqual([908, 1008])
    expect(liveWindow(-Infinity, 5000, 100)).toEqual([4900, 5000])
  })

  it('formats times and decoded text', () => {
    expect(formatUs(2000)).toBe('2 ms')
    expect(formatUs(8.68)).toBe('8.68 µs')
    expect(formatUs(0.398)).toBe('398 ns')
    const fr = [
      { t0: 0, t1: 1, kind: 'byte' as const, value: 0x68, text: "0x68 'h'" },
      { t0: 1, t1: 2, kind: 'byte' as const, value: 0x0d, text: '0x0D CR' },
      { t0: 2, t1: 3, kind: 'byte' as const, value: 0x0a, text: '0x0A LF' },
    ]
    expect(framesText(fr)).toBe("0x68 'h'  0x0D CR  0x0A LF")
    expect(asciiOf(fr)).toBe('h↵')
  })
})
