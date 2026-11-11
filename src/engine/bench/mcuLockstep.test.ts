import { describe, expect, it } from 'vitest'
import { lesson as ledResistor } from '../../lessons/T2/led-resistor'
import type { Behavior, Lesson } from '../types'
import { createBench } from './simLoop'

// The bench runs the virtual MCU in lockstep with the circuit: within a frame it alternates ≤ 1 ms of
// transient steps with an MCU advance to the same sim time, so a pin write lands at the next step after
// it happens (not at the end of the animation frame), and behaviors' onStep can inject MCU edges just
// in time (ctx.mcu.microsAt).
const DT = 1e-3

function lesson(code: string, behaviors: string[] = ['watch']): Lesson {
  return { ...ledResistor, fig: ledResistor.fig ?? 1, behaviors, sketch: { ...ledResistor.sketch!, code } }
}

describe('bench: MCU and circuit in lockstep', () => {
  it('a pin write reaches the circuit at the next step, wherever it falls in the frame', async () => {
    // (a fresh sketch first runs after its first frame's tick, as before: these writes come after that)
    for (const ms of [25, 32, 43]) {
      let tHigh = -1
      const watch: Behavior = {
        id: 'watch',
        onStep(_ctx, t, s) {
          const v = s.voltageOf ? s.voltageOf('p13') : (s.nodeV.p13 ?? 0)
          if (tHigh < 0 && v > 2.5) tHigh = t
        },
      }
      const b = createBench(lesson(`void setup() { pinMode(13, OUTPUT); digitalWrite(13, LOW); delay(${ms}); digitalWrite(13, HIGH); }\nvoid loop() { delay(10); }`), {
        registry: { watch },
      })
      b.dispatch('power')
      b.upload()
      for (let i = 0; i < 5; i++) await b.frame(1 / 60)
      b.dispose()
      // written at ms; the step after the MCU chunk that holds it carries it, seen at that step's end
      expect(tHigh).toBeGreaterThan(ms / 1000)
      expect(tHigh).toBeLessThanOrEqual(ms / 1000 + 2 * DT + 1e-9)
    }
  })

  it('from onStep the MCU has not passed microsAt(t), and it is never more than one 1 ms chunk behind', async () => {
    const gaps: number[] = []
    let bad = 0
    let ticks = 0
    const watch: Behavior = {
      id: 'watch',
      tick() {
        ticks++
      },
      onStep(ctx, t) {
        // a fresh sketch first runs after its first frame's tick (as before): lockstep starts after it
        if (ticks < 1 || !ctx.mcu.running || !ctx.mcu.microsAt) return
        const ahead = ctx.mcu.microsAt(t) - ctx.mcu.timeMicros
        if (ahead < -1e-6) bad++
        gaps.push(ahead)
      },
    }
    const b = createBench(lesson(`void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); delay(3); digitalWrite(13, LOW); delay(4); }`), { registry: { watch } })
    b.dispatch('power')
    b.upload()
    for (let i = 0; i < 10; i++) await b.frame(1 / 60)
    expect(gaps.length).toBeGreaterThan(100)
    expect(bad).toBe(0)
    expect(Math.max(...gaps)).toBeLessThanOrEqual(1000 + 1e-6)
    // a frame ends on steps: the MCU is then at most one chunk behind, and catches up first thing next frame
    expect(b.mcuTimeMs()).toBeLessThanOrEqual(b.t * 1000 + 1e-6)
    expect(b.mcuTimeMs()).toBeGreaterThanOrEqual(b.t * 1000 - 1 - 1e-6)
    b.dispose()
  })

  it('a frame asked for while the last one still awaits its MCU is skipped, not run alongside it', async () => {
    const b = createBench(lesson(`void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); delay(1); digitalWrite(13, LOW); delay(1); }`, []), {})
    b.dispatch('power')
    b.upload()
    await b.frame(1 / 60)
    const t0 = b.t
    const p1 = b.frame(1 / 60)
    const p2 = b.frame(1 / 60)
    await Promise.all([p1, p2])
    expect(b.t - t0).toBeCloseTo(17 * DT, 9)
    expect(b.mcuTimeMs()).toBeGreaterThanOrEqual(b.t * 1000 - 1 - 1e-6)
    b.dispose()
  })

  it('a sketch that never waits is still bounded per frame, not per chunk', async () => {
    const b = createBench(lesson(`long x = 0;\nvoid setup() {}\nvoid loop() { while (true) { x++; } }`, []), {})
    b.dispatch('power')
    b.upload()
    const t0 = performance.now()
    for (let i = 0; i < 3; i++) await b.frame(1 / 60)
    expect(performance.now() - t0).toBeLessThan(3000)
    expect(b.mcuTimeMs()).toBeGreaterThanOrEqual(b.t * 1000 - 1 - 1e-6)
    b.dispose()
  })
})
