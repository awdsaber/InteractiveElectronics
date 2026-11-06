import { describe, expect, it } from 'vitest'
import type { PartPlacement } from '../engine/types'
import { ledLook } from './palette'
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

  it('ledLook accepts a hex colour for the lens and glow', () => {
    const look = ledLook('#00ff00')
    expect(look.glow).toBe('#00ff00')
    expect(look.lens).toMatch(/^#[0-9a-f]{6}$/)
    expect(ledLook('blue').glow).toBe('#4f8dff')
  })
})
