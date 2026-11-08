import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import { getLesson } from '../index'

const lesson = getLesson('batteries')!
const FRAME = 1 / 60
// readout indices
const [TERM, CURRENT, LOAD_P, INT_P] = [0, 1, 2, 3]

const near = (v: number, want: number, tol = 0.05) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * tol)

function build(opts: { failure?: string; tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(lesson, { tweaks: opts.tweaks })
  b.dispatch('place-all')
  b.dispatch('power')
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  return b
}
async function frames(b: Bench, n: number): Promise<BenchSnapshot> {
  for (let i = 0; i < n; i++) await b.frame(FRAME)
  return b.snapshot()
}

describe('T0 batteries lesson', () => {
  it('is registered and validates', () => {
    expect(lesson).toBeDefined()
    expect(validateLesson(lesson)).toEqual([])
    expect(lesson.powerElementId).toBe('SW1')
  })

  it('100 Ω load: 88.7 mA, terminal 8.87 V, load 0.79 W, internal loss 11.8 mW', async () => {
    const b = build()
    expect(b.snapshot().status).toBe('POWERED')
    const s = await frames(b, 20)
    near(s.values[CURRENT], 0.0887)
    near(s.values[TERM], 8.867, 0.01)
    near(s.values[LOAD_P], 0.7866)
    near(s.values[INT_P], 0.0118)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('10 Ω load: the battery sags to 7.83 V at 0.78 A, and the 10 W load survives its 6.1 W', async () => {
    const b = build({ tweaks: { 'R_LOAD.value': 10 } })
    const s = await frames(b, 20)
    near(s.values[CURRENT], 0.7826)
    near(s.values[TERM], 7.826, 0.01)
    near(s.values[LOAD_P], 6.12)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  })

  it('load power peaks where R_load = r (1.5 Ω, 13.5 W) and the internal loss equals it', async () => {
    const at = async (r: number) => {
      const b = build({ tweaks: { 'R_LOAD.value': r } })
      const s = await frames(b, 8)
      const v = { load: s.values[LOAD_P], int: s.values[INT_P] }
      b.dispose()
      return v
    }
    const lo = await at(1)
    const mid = await at(1.5)
    const hi = await at(3)
    near(mid.load, 13.5, 0.05)
    near(mid.int, mid.load, 0.1)
    expect(mid.load).toBeGreaterThan(lo.load)
    expect(mid.load).toBeGreaterThan(hi.load)
  })

  it('a worn cell (r = 10 Ω) sags far more at the same load', async () => {
    const s = await frames(build({ tweaks: { 'R_INT.value': 10 } }), 20)
    near(s.values[TERM], 9 - (9 / 110) * 10, 0.01)
  })

  it('F1 keys in the pocket: 6 A, terminal near 0 V, 54 W inside the battery', async () => {
    const b = build()
    await frames(b, 10)
    b.dispatch('break:short')
    const s = await frames(b, 10)
    expect(s.values[TERM]).toBeLessThan(0.1)
    near(s.values[INT_P], 54, 0.03)
    expect(lesson.failures.find((f) => f.id === 'short')!.patches).toEqual([{ op: 'short', a: 'term', b: '0' }])
    expect(s.readouts[INT_P].tone).toBe('warn')
    b.dispose()
  })

  it('INTERNAL LOSS stays normal in ordinary use', async () => {
    const s = await frames(build(), 10)
    expect(s.readouts[INT_P].tone).toBe('normal')
  })

  it('F2 a tired battery: 7.3 V at 73 mA under the 100 Ω load', async () => {
    const b = build()
    await frames(b, 10)
    b.dispatch('break:tired')
    const s = await frames(b, 20)
    near(s.values[CURRENT], 0.073, 0.02)
    near(s.values[TERM], 7.3, 0.02)
    b.dispose()
  })

  it('F3 chase maximum power: 3 A, 4.5 V, 13.5 W in the load, which is over its rating and burns', async () => {
    const b = build()
    await frames(b, 10)
    b.dispatch('break:max-power')
    let s = await frames(b, 8)
    near(s.values[CURRENT], 3, 0.04)
    near(s.values[TERM], 4.5, 0.03)
    near(s.values[LOAD_P], 13.5, 0.05)
    for (let i = 0; i < 120 && !s.assembly.burns.length; i++) s = await frames(b, 1)
    expect(s.assembly.burns[0]).toMatchObject({ elementId: 'R_LOAD' })
    expect(s.partBurnt.rl).toBe(true)
    b.dispose()
  })
})
