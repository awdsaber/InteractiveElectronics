import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import { getLesson } from '../index'

const lesson = getLesson('flipflops-counters')!
const FRAME = 1 / 60

// tweak keys
const SET = 'SW_SET.closed'
const RESET = 'SW_RESET.closed'
const CLK = 'behavior:bnc.press'
const D = 'SW_D.closed'
const TOG = 'SW_TOG.closed'
const AUTO = 'SW_AUTO.closed'
const MR = 'SW_MR.closed'

// published behavior keys
const COUNT = 'ctr.count'
const EDGES = 'ctr.edges'
const PRESSES = 'bnc.presses'

function build(opts: { failure?: string; tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(lesson, { tweaks: opts.tweaks, speed: lesson.sim?.speed })
  b.dispatch('place-all')
  b.dispatch('power')
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  return b
}

/** run `seconds` of sim time */
async function run(b: Bench, seconds: number) {
  const t1 = b.t + seconds
  while (b.t < t1 - 1e-9) await b.frame(FRAME)
}

const pub = (b: Bench, key: string) => b.snapshot().published[key]
const volt = (b: Bench, node: string) => {
  const s = b.snapshot()
  return s.values[lesson.readouts.findIndex((r) => r.source.kind === 'voltage' && r.source.node === node)]
}
const ro = (b: Bench, label: string) => b.snapshot().values[lesson.readouts.findIndex((r) => r.label === label)]

/** one press of the CLOCK button: hold 60 ms, release, let the debounce settle */
async function press(b: Bench, hold = 0.06) {
  b.setTweak(CLK, 1)
  await run(b, hold)
  b.setTweak(CLK, 0)
  await run(b, 0.08)
}

async function tap(b: Bench, key: string) {
  b.setTweak(key, 1)
  await run(b, 0.03)
  b.setTweak(key, 0)
  await run(b, 0.03)
}

describe('T3 flipflops-counters lesson', () => {
  it('validates and powers up with the part facts filled in', async () => {
    expect(validateLesson(lesson)).toEqual([])
    const b = build()
    await run(b, 0.05)
    expect(b.snapshot().status).toBe('POWERED')
    for (const id of ['u1', 'u2', 'u3', 'u4']) {
      const p = lesson.board.parts.find((x) => x.id === id)!
      expect(p.facts?.length ?? 0).toBeGreaterThan(0)
    }
    b.dispose()
  })

  describe('SR latch (cross-coupled NAND)', () => {
    it('powers up reset, sets, holds, resets and holds', async () => {
      const b = build()
      await run(b, 0.05)
      expect(volt(b, 'q')).toBeLessThan(0.5)
      expect(volt(b, 'qn')).toBeGreaterThan(4.5)

      await tap(b, SET)
      expect(volt(b, 'q')).toBeGreaterThan(4.5) // set, and the button is already released: memory
      expect(volt(b, 'qn')).toBeLessThan(0.5)
      await tap(b, SET) // set again: no change
      expect(volt(b, 'q')).toBeGreaterThan(4.5)
      await run(b, 0.5)
      expect(volt(b, 'q')).toBeGreaterThan(4.5) // still holding

      await tap(b, RESET)
      expect(volt(b, 'q')).toBeLessThan(0.5)
      expect(volt(b, 'qn')).toBeGreaterThan(4.5)
      await run(b, 0.5)
      expect(volt(b, 'q')).toBeLessThan(0.5)
      b.dispose()
    })

    it('F1: S and R together force both outputs high, the forbidden state', async () => {
      const b = build({ failure: 'both-buttons' })
      await run(b, 0.05)
      expect(volt(b, 'q')).toBeGreaterThan(4.5)
      expect(volt(b, 'qn')).toBeGreaterThan(4.5)
      b.dispose()
    })

    it('F2: with the feedback cut it only follows the button', async () => {
      const b = build({ failure: 'cut-feedback' })
      await run(b, 0.05)
      b.setTweak(SET, 1)
      await run(b, 0.03)
      expect(volt(b, 'q')).toBeGreaterThan(4.5) // while held
      b.setTweak(SET, 0)
      await run(b, 0.03)
      expect(volt(b, 'q')).toBeLessThan(0.5) // forgotten on release
      b.dispose()
    })
  })

  describe('74HC393 ripple counter', () => {
    it('counts 11 clock presses as 1011 and wraps on the 16th', async () => {
      const b = build()
      await run(b, 0.05)
      for (let i = 1; i <= 11; i++) {
        await press(b)
        expect(pub(b, COUNT)).toBe(i)
      }
      expect(pub(b, PRESSES)).toBe(11)
      expect(pub(b, EDGES)).toBe(11)
      expect(volt(b, 'q0')).toBeGreaterThan(4.5)
      expect(volt(b, 'q1')).toBeGreaterThan(4.5)
      expect(volt(b, 'q2')).toBeLessThan(0.5)
      expect(volt(b, 'q3')).toBeGreaterThan(4.5)
      for (let i = 12; i <= 16; i++) await press(b)
      expect(pub(b, COUNT)).toBe(0) // 16 presses wrap to 0000
      expect(pub(b, EDGES)).toBe(16)
      b.dispose()
    })

    it('master reset clears it', async () => {
      const b = build()
      await run(b, 0.05)
      for (let i = 0; i < 5; i++) await press(b)
      expect(pub(b, COUNT)).toBe(5)
      await tap(b, MR)
      expect(pub(b, COUNT)).toBe(0)
      b.dispose()
    })

    it('each stage halves the frequency: 25 Hz in, Q0 12.5 Hz, Q1 6.25 Hz, Q2 3.125 Hz, Q3 1.5625 Hz', async () => {
      const b = build({ tweaks: { [AUTO]: 1 } })
      const rises = [0, 0, 0, 0]
      const was = [false, false, false, false]
      const T = 3.2 // 2 full Q3 cycles
      const t0 = b.t
      await run(b, 0.2) // settle the clock RC
      const t1 = b.t
      while (b.t - t1 < T - 1e-9) {
        await b.frame(FRAME)
        for (let k = 0; k < 4; k++) {
          const hi = volt(b, `q${k}`) > 2.5
          if (hi && !was[k]) rises[k]++
          was[k] = hi
        }
      }
      expect(b.t - t0).toBeGreaterThan(T)
      // 25 / 2^(k+1) Hz over 3.2 s = 40, 20, 10, 5 cycles (±1 for the window edges)
      const want = [40, 20, 10, 5]
      for (let k = 0; k < 4; k++) expect(Math.abs(rises[k] - want[k])).toBeLessThanOrEqual(1)
      b.dispose()
    })
  })

  describe('74HC74 D flip-flop', () => {
    it('copies D to Q only on the clock edge', async () => {
      const b = build()
      await run(b, 0.05)
      expect(ro(b, 'FF Q')).toBeLessThan(0.5)
      b.setTweak(D, 1)
      await run(b, 0.05)
      expect(ro(b, 'FF Q')).toBeLessThan(0.5) // D high, no edge yet: Q does not follow
      b.setTweak(CLK, 1) // rising edge of the clean clock
      await run(b, 0.06)
      expect(ro(b, 'FF Q')).toBeGreaterThan(4.5)
      b.setTweak(D, 0) // clock still held high: no edge, no change
      await run(b, 0.05)
      expect(ro(b, 'FF Q')).toBeGreaterThan(4.5)
      b.setTweak(CLK, 0)
      await run(b, 0.08)
      expect(ro(b, 'FF Q')).toBeGreaterThan(4.5) // falling clock edge does not load either
      await press(b)
      expect(ro(b, 'FF Q')).toBeLessThan(0.5) // next rising edge loads D = 0
      b.dispose()
    })

    it('with D tied to Q-bar it toggles: divide by 2', async () => {
      const b = build({ tweaks: { [TOG]: 1 } })
      await run(b, 0.05)
      const seq: boolean[] = []
      for (let i = 0; i < 6; i++) {
        await press(b)
        seq.push(ro(b, 'FF Q') > 2.5)
      }
      expect(seq).toEqual([true, false, true, false, true, false])
      b.dispose()
    })
  })

  describe('switch bounce', () => {
    it('with the RC debounce every press is exactly one count', async () => {
      const b = build()
      await run(b, 0.05)
      for (let i = 0; i < 20; i++) await press(b, 0.04)
      expect(pub(b, PRESSES)).toBe(20)
      expect(pub(b, EDGES)).toBe(20)
      b.dispose()
    })

    it('F3: without the capacitor the bounces are counted: extra counts on most presses', async () => {
      const b = build({ failure: 'no-debounce' })
      await run(b, 0.05)
      for (let i = 0; i < 20; i++) await press(b, 0.04)
      expect(pub(b, PRESSES)).toBe(20)
      const edges = pub(b, EDGES)
      expect(edges).toBeGreaterThan(30) // at least 1.5 counts per press
      expect(edges).toBeLessThan(160)
      b.dispose()
    })

    it('a 10 nF capacitor is too small to swallow the bounce (tweak)', async () => {
      const b = build({ tweaks: { 'C_DB.value': 1e-8 } })
      await run(b, 0.05)
      for (let i = 0; i < 20; i++) await press(b, 0.04)
      expect(pub(b, EDGES)).toBeGreaterThan(30)
      b.dispose()
    })

    it('bounce is repeatable for a given seed and differs between presses', async () => {
      const edgesOf = async () => {
        const b = build({ failure: 'no-debounce' })
        await run(b, 0.05)
        const per: number[] = []
        let last = 0
        for (let i = 0; i < 6; i++) {
          await press(b, 0.04)
          per.push(pub(b, EDGES) - last)
          last = pub(b, EDGES)
        }
        b.dispose()
        return per
      }
      const a = await edgesOf()
      const c = await edgesOf()
      expect(a).toEqual(c)
      expect(new Set(a).size).toBeGreaterThan(1)
    })
  })
})
