import { describe, expect, it } from 'vitest'
import { fitSine } from './ac-meter'

const sample = (f: number, amp: number, phaseDeg: number, off: number, n: number, dt: number) => {
  const ts = Array.from({ length: n }, (_, i) => i * dt + 0.0123)
  const xs = ts.map((t) => off + amp * Math.sin(2 * Math.PI * f * t + (phaseDeg * Math.PI) / 180))
  return { ts, xs }
}

describe('ac-meter fitSine', () => {
  it('recovers amplitude and phase of an offset sine from sparse, uneven frame samples', () => {
    const { ts, xs } = sample(50, 4.96, -46, 3, 30, 1 / 240 + 0.0003)
    const fit = fitSine(ts, xs, 50)!
    expect(fit.amp).toBeCloseTo(4.96, 6)
    expect((fit.phase * 180) / Math.PI).toBeCloseTo(-46, 4)
  })

  it('refuses when every sample lands on the same phase (nothing to fit)', () => {
    const { ts, xs } = sample(50, 5, 0, 0, 30, 1 / 50) // exactly one period apart
    expect(fitSine(ts, xs, 50)).toBeNull()
  })
})
