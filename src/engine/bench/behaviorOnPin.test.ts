import { describe, expect, it } from 'vitest'
import { lesson as ledResistor } from '../../lessons/T2/led-resistor'
import type { Behavior, Lesson } from '../types'
import { createBench } from './simLoop'

// Behavior.onPin: every sketch pin change, with the MCU's µs timestamp (for STEP/DIR drivers).
describe('Behavior.onPin', () => {
  it('sees every digitalWrite edge with µs timestamps', async () => {
    const seen: [number, number, number][] = []
    const watcher: Behavior = {
      id: 'watcher',
      onPin(_ctx, pin, st, tMicros) {
        if (pin === 13) seen.push([pin, st.level, tMicros])
      },
    }
    const l: Lesson = {
      ...ledResistor,
      fig: ledResistor.fig ?? 1,
      behaviors: ['watcher'],
      sketch: {
        ...ledResistor.sketch!,
        code: `void setup() { pinMode(13, OUTPUT); }
void loop() { digitalWrite(13, HIGH); delayMicroseconds(3); digitalWrite(13, LOW); delayMicroseconds(97); }`,
      },
    }
    const b = createBench(l, { registry: { watcher } })
    b.dispatch('power')
    b.upload()
    for (let i = 0; i < 4; i++) await b.frame(1 / 60)
    const highs = seen.filter((e) => e[1] === 1)
    expect(highs.length).toBeGreaterThan(300)
    // rising edges 100 µs apart, each high for 3 µs
    expect(highs[5][2] - highs[4][2]).toBe(100)
    const i = seen.indexOf(highs[4])
    expect(seen[i + 1][2] - seen[i][2]).toBe(3)
    b.dispose()
  })
})

describe('BehaviorContext.burn detail', () => {
  it('a behavior can state the value and limit that killed the part', async () => {
    const burner: Behavior = { id: 'burner', tick: (ctx) => ctx.t > 0.02 && ctx.burn('R1', 'overvoltage', { value: 220, limit: 35 }) }
    const l: Lesson = { ...ledResistor, fig: ledResistor.fig ?? 1, behaviors: ['burner'] }
    const b = createBench(l, { registry: { burner } })
    b.dispatch('power')
    for (let i = 0; i < 4; i++) await b.frame(1 / 60)
    const s = b.snapshot()
    expect(s.status).toBe('FAULT')
    expect(s.statusLine.text).toContain('220 V across a 35 V part')
    b.dispose()
  })
})
