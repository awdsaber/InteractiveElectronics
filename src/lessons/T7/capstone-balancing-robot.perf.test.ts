// The capstone's frame cost at ×1: the transient (two bridges, two motors with prescribed speed, set every
// 1 ms step), the MCU in lockstep, the pendulum, the IMU sampling every step and the encoder's edges. The
// bench's budget is 8 ms per frame; this measures the engine headless (no rendering), after a warm-up.
import { describe, expect, it } from 'vitest'
import { createBench } from '../../engine/bench/simLoop'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const L = getLesson('capstone-balancing-robot') as Lesson
const FRAME = 1 / 60

describe('capstone-balancing-robot: frame cost', () => {
  it('balancing (and catching a push) costs well under the 8 ms frame budget at ×1', async () => {
    const b = createBench(L)
    b.dispatch('power')
    b.upload()
    while (b.t < 1.5) await b.frame(FRAME)
    b.setTweak('behavior:bot.push', 1)
    const t0 = performance.now()
    let frames = 0
    while (b.t < 5.5) {
      await b.frame(FRAME)
      b.snapshot()
      if (frames === 1) b.setTweak('behavior:bot.push', 0)
      frames++
    }
    const ms = (performance.now() - t0) / frames
    console.log(`capstone: ${ms.toFixed(2)} ms per frame at x1 (${frames} frames, headless)`)
    expect(b.snapshot().values[9]).toBe(0)
    // Wall-clock: in the full parallel suite every worker shares the CPU, so the 8 ms budget is asserted only
    // when this file runs alone (CAPSTONE_PERF=1 npx vitest run capstone-balancing-robot.perf); otherwise a
    // loose bound that still catches an order-of-magnitude regression. Alone it measures about 3–4.5 ms.
    const strict = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.CAPSTONE_PERF
    expect(ms).toBeLessThan(strict ? 8 : 40)
    b.dispose()
  }, 30000)
})
