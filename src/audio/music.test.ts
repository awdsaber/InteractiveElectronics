import { describe, expect, it } from 'vitest'
import { BASS, PROGRESSION, loopSeconds, midiToHz, mulberry32, whirHz } from './music'

describe('music helpers', () => {
  it('midiToHz', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 6)
    expect(midiToHz(57)).toBeCloseTo(220, 6)
  })
  it('progression is four chords with matching bass', () => {
    expect(PROGRESSION).toHaveLength(4)
    expect(BASS).toHaveLength(4)
  })
  it('loop length is 4 chords of 4 beats at 72 bpm', () => {
    expect(loopSeconds()).toBeCloseTo((60 / 72) * 16, 6)
  })
  it('prng is deterministic and in [0,1)', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    for (let i = 0; i < 20; i++) {
      const x = a()
      expect(x).toBe(b())
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
  it('whir pitch rises with speed and clamps', () => {
    expect(whirHz(0)).toBeLessThan(whirHz(1))
    expect(whirHz(5)).toBe(whirHz(1))
  })
})
