// ws2812: the ESP32 DevKit's onboard addressable RGB LED (WS2812-class, one pixel).
//
// Sketch API (Arduino-ESP32 core 3.x): rgbLedWrite(pin, r, g, b); core 2.x called it
// neopixelWrite, which is accepted too. A write only lands when `pin` is the GPIO of the PIN
// element named by params.pinElement (default 'pin_rgb'): GPIO48 on DevKitC-1 v1.0, GPIO38 on
// v1.1, so a sketch written for the other revision leaves the LED dark, as on the real board.
//
// Publishes rgb_r / rgb_g / rgb_b (0..255, for the 3D glow) and rgb_mA. Sets the LED's supply
// current element (params.currentElement, default 'i_rgb') to (r + g + b)/765 × maxMa, a rough
// figure for a WS2812-class LED (about 12 mA per channel, 36 mA at full white).
//
// The bench shows the LED dark while the MCU is not running (unpowered, held in reset or in the
// ROM bootloader); a new upload or power cycle forgets the last colour, as a power-on reset does.

import type { Behavior, BehaviorContext } from '../types'

interface State {
  rgb: [number, number, number]
}

const states = new WeakMap<BehaviorContext, State>()

function state(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = { rgb: [0, 0, 0] }
    states.set(ctx, s)
  }
  return s
}

const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d)
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const channel = (v: unknown) => Math.max(0, Math.min(255, Math.trunc(Number(v) || 0)))

/** GPIO of the LED's PIN element in the live netlist, or -1 */
function ledPin(ctx: BehaviorContext): number {
  const id = str(ctx.params.pinElement, 'pin_rgb')
  const el = ctx.netlist.elements.find((e) => e.id === id)
  return el && el.type === 'PIN' ? el.pin : -1
}

export const behavior: Behavior = {
  id: 'ws2812',

  libraries(ctx) {
    const write = (pin: number, r: number, g: number, b: number) => {
      if (Math.trunc(Number(pin)) !== ledPin(ctx)) return
      const s = state(ctx)
      s.rgb = [channel(r), channel(g), channel(b)]
      ctx.events.push({ t: ctx.t, channel: 'ws2812', kind: 'write', data: { r: s.rgb[0], g: s.rgb[1], b: s.rgb[2] } })
    }
    return { rgbLedWrite: write, neopixelWrite: write }
  },

  tick(ctx) {
    const s = state(ctx)
    const lit = ctx.powered && ctx.mcu.running
    const [r, g, b] = lit ? s.rgb : [0, 0, 0]
    const mA = ((r + g + b) / 765) * num(ctx.params.maxMa, 36)
    ctx.publish('rgb_r', r)
    ctx.publish('rgb_g', g)
    ctx.publish('rgb_b', b)
    ctx.publish('rgb_mA', mA)
    const cur = str(ctx.params.currentElement, 'i_rgb')
    if (ctx.netlist.elements.some((e) => e.id === cur)) ctx.setParam(cur, 'value', mA / 1000)
  },

  onEvent(ctx, ev) {
    if (ev === 'upload' || ev === 'power-on' || ev === 'power-off') state(ctx).rgb = [0, 0, 0]
  },

  reset(ctx) {
    state(ctx).rgb = [0, 0, 0]
  },
}
