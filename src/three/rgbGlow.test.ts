import { describe, expect, it } from 'vitest'
import type { PartPlacement } from '../engine/types'
import { createBench } from '../engine/bench/simLoop'
import { getLesson } from '../lessons'
import { liveParams, partState } from './Board'
import { ledLook } from './palette'
import { partRegistry } from './parts'
import { bakeKeyOf } from './parts/frame'
import { rgbGlow } from './rgbGlow'

const led: PartPlacement = { id: 'led_rgb', kind: 'led-smd', pos: [0, 0], mount: 'smd', role: 'rgb', params: { color: 'white', rgbFrom: 'ws2812' } }

describe('rgbGlow', () => {
  it('ignores parts without rgbFrom', () => {
    expect(rgbGlow({ ...led, params: { color: 'red' } }, { 'ws2812.rgb_r': 255 })).toBeNull()
  })

  it('is dark when the behavior publishes black or nothing', () => {
    expect(rgbGlow(led, {})).toEqual({ color: null, glow: 0 })
    expect(rgbGlow(led, { 'ws2812.rgb_r': 0, 'ws2812.rgb_g': 0, 'ws2812.rgb_b': 0 })).toEqual({ color: null, glow: 0 })
  })

  it('glows in the published hue, brighter for larger values', () => {
    const amber = rgbGlow(led, { 'ws2812.rgb_r': 40, 'ws2812.rgb_g': 20, 'ws2812.rgb_b': 0 })!
    expect(amber.color).toBe('#ff8800')
    const dim = rgbGlow(led, { 'ws2812.rgb_b': 50 })!
    const full = rgbGlow(led, { 'ws2812.rgb_b': 255 })!
    expect(dim.color).toBe('#0000ff')
    expect(dim.glow).toBeGreaterThan(0.4)
    expect(full.glow).toBe(1)
    expect(full.glow).toBeGreaterThan(dim.glow)
  })

  it('the Board carries the colour in the render state, so colour changes never rebake the LED', () => {
    const lesson = getLesson('esp32-s3')!
    const p = lesson.board.parts.find((x) => x.id === 'led_rgb')!
    const b = createBench(lesson)
    const base = b.snapshot()
    const snap = (r: number, g: number, bl: number) => ({ ...base, published: { 'ws2812.rgb_r': r, 'ws2812.rgb_g': g, 'ws2812.rgb_b': bl } })
    const a = partState(lesson, p, snap(40, 20, 0))
    const c = partState(lesson, p, snap(0, 10, 50))
    expect(a.glowColor).toBe('#ff8800')
    expect(c.glowColor).toBe('#0033ff')
    expect(liveParams(p, snap(40, 20, 0))).toBe(p)
    const comp = partRegistry['led-smd']
    expect(bakeKeyOf(comp, p, a)).toBe(bakeKeyOf(comp, p, c))
    expect(partState(lesson, p, snap(0, 0, 0)).glowColor).toBeUndefined()
    b.dispose()
  })

  it('a button with params.pressedWhen shows pressed while that failure is active', () => {
    const lesson = getLesson('esp32-s3')!
    const p = lesson.board.parts.find((x) => x.id === 'sw_boot')!
    const b = createBench(lesson)
    expect(partState(lesson, p, b.snapshot()).value ?? 0).toBe(0)
    b.dispatch('break:boot-held')
    expect(partState(lesson, p, b.snapshot()).value).toBe(1)
    b.dispose()
  })

  it('ledLook accepts a hex colour for the lens and glow', () => {
    const look = ledLook('#00ff00')
    expect(look.glow).toBe('#00ff00')
    expect(look.lens).toMatch(/^#[0-9a-f]{6}$/)
    expect(ledLook('blue').glow).toBe('#4f8dff')
  })
})
