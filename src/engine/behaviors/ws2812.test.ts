import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import { benchOf, esp32Lesson, powerAndRun, runFor } from './fixtures/esp32Bench'
import { behavior as ws2812 } from './ws2812'

const reg = { ws2812 }

describe('ws2812 behavior', () => {
  it('rgbLedWrite on the LED pin publishes the colour and sets the LED supply current', async () => {
    const b = benchOf(`void setup() { rgbLedWrite(48, 255, 128, 0); } void loop() { delay(10); }`, reg)
    powerAndRun(b)
    const s = await runFor(b, 0.1)
    expect(s.sketchError).toBeNull()
    expect(s.published['ws2812.rgb_r']).toBe(255)
    expect(s.published['ws2812.rgb_g']).toBe(128)
    expect(s.published['ws2812.rgb_b']).toBe(0)
    // (255 + 128 + 0)/765 × 36 mA ≈ 18 mA
    expect(s.elementValues['i_rgb.value']).toBeCloseTo((383 / 765) * 0.036, 6)
    expect(s.published['ws2812.rgb_mA']).toBeCloseTo((383 / 765) * 36, 3)
  })

  it('full white draws about 36 mA; black draws nothing', async () => {
    const b = benchOf(`void setup() { rgbLedWrite(48, 255, 255, 255); delay(100); rgbLedWrite(48, 0, 0, 0); } void loop() { delay(10); }`, reg)
    powerAndRun(b)
    let s = await runFor(b, 0.05)
    expect(s.elementValues['i_rgb.value']).toBeCloseTo(0.036, 6)
    s = await runFor(b, 0.15)
    expect(s.elementValues['i_rgb.value']).toBe(0)
    expect(s.published['ws2812.rgb_r']).toBe(0)
  })

  it('a write to the wrong GPIO (a v1.1 sketch on a v1.0 board) leaves the LED dark', async () => {
    const b = benchOf(`void setup() { rgbLedWrite(38, 40, 20, 0); } void loop() { delay(10); }`, reg)
    powerAndRun(b)
    const s = await runFor(b, 0.1)
    expect(s.published['ws2812.rgb_r']).toBe(0)
    expect(s.elementValues['i_rgb.value']).toBe(0)
  })

  it('the pin follows the PIN element, so a v1.1 bench (pin 38) works with 38', async () => {
    const l = esp32Lesson(`void setup() { neopixelWrite(38, 10, 20, 30); } void loop() { delay(10); }`, ['ws2812'])
    l.circuit.elements = l.circuit.elements.map((e) => (e.id === 'pin_rgb' ? { ...e, pin: 38, nodes: ['g38', '0'] } : e)) as typeof l.circuit.elements
    l.sketch!.pins = { 38: 'pin_rgb', 0: 'pin0' }
    const b = createBench(l, { registry: reg })
    powerAndRun(b)
    const s = await runFor(b, 0.1)
    expect([s.published['ws2812.rgb_r'], s.published['ws2812.rgb_g'], s.published['ws2812.rgb_b']]).toEqual([10, 20, 30])
  })

  it('clamps channels to 0..255 integers', async () => {
    const b = benchOf(`void setup() { rgbLedWrite(48, 300, -5, 12); } void loop() { delay(10); }`, reg)
    powerAndRun(b)
    const s = await runFor(b, 0.1)
    expect([s.published['ws2812.rgb_r'], s.published['ws2812.rgb_g'], s.published['ws2812.rgb_b']]).toEqual([255, 0, 12])
  })

  it('goes dark when the MCU stops or the board loses power, and forgets the colour on a new upload', async () => {
    const b = benchOf(`void setup() { rgbLedWrite(48, 0, 0, 200); } void loop() { delay(10); }`, reg)
    powerAndRun(b)
    let s = await runFor(b, 0.1)
    expect(s.published['ws2812.rgb_b']).toBe(200)
    b.dispatch('power')
    s = b.snapshot()
    expect(s.published['ws2812.rgb_b'] ?? 0).toBe(0)
    b.dispatch('power')
    s = await runFor(b, 0.1)
    expect(s.published['ws2812.rgb_b'] ?? 0).toBe(0)
    b.upload(`void setup() { } void loop() { delay(10); }`)
    s = await runFor(b, 0.1)
    expect(s.published['ws2812.rgb_b']).toBe(0)
    expect(s.elementValues['i_rgb.value']).toBe(0)
  })
})
