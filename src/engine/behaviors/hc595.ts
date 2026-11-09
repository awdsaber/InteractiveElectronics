// hc595: a 74HC595 8-bit shift register with an output latch, driven from the MCU's hardware SPI.
//
// SER = MOSI, SRCLK = SCK, RCLK (the latch) = the SPI "chip select" pin `cs`. The chip shifts on every
// SRCLK rising edge, whatever SPI mode the master uses, so it is a mode-0 (or mode-3) device: each
// byte's bits are found by laying the byte out at the master's mode (logic/synth.ts) and sampling MOSI on
// the rising edges. In mode 1 the master changes MOSI just after each rising edge, so the 595 clocks in
// the previous level first and the byte arrives shifted by one bit. The rising edge of RCLK (the CS pin
// going HIGH again) copies the shift register to Q0..Q7, which close the `outs` SW elements (Q0 first).
// QH' (serial out) is not wired to MISO, so a transfer reads back 0xFF.
//
// Params (defaults): cs 10 (latch pin), outs 'q0,q1,q2,q3,q4,q5,q6,q7' (SW ids, Q0 first), vcc '5v',
//   vMin 2 (the 74HC family's lowest supply: below it the outputs drop out).
// Publishes: q (latched outputs, 0..255), sr (shift register), latches (count).

import { spiSampled } from '../logic/decode'
import type { SpiDevice, SpiSettingsLike } from '../mcu/virtualMcu'
import type { Behavior, BehaviorContext } from '../types'

interface State {
  sr: number
  q: number
  /** what MOSI holds between bytes: the last bit the master put out */
  mosi: 0 | 1
  latches: number
  applied: number
}

const states = new WeakMap<BehaviorContext, State>()
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d)

function state(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = { sr: 0, q: 0, mosi: 0, latches: 0, applied: -1 }
    states.set(ctx, s)
  }
  return s
}

function clear(s: State): void {
  s.sr = 0
  s.q = 0
  s.mosi = 0
  s.latches = 0
  s.applied = -1
}

export const behavior: Behavior = {
  id: 'hc595',
  init(ctx) {
    const s = state(ctx)
    const dev: SpiDevice = {
      transfer(byte: number, st: SpiSettingsLike) {
        s.sr = spiSampled(byte & 0xff, st.mode & 3, st.bitOrder, s.mosi)
        s.mosi = ((byte >> (st.bitOrder === 0 ? 7 : 0)) & 1) as 0 | 1
        return 0xff
      },
      select(active: boolean) {
        if (active) return
        s.q = s.sr // RCLK rising: shift register → output latch
        s.latches++
      },
    }
    ctx.mcu.attachSpi(num(ctx.params.cs, 10), dev)
  },
  tick(ctx) {
    const s = state(ctx)
    const on = ctx.powered && ctx.v(str(ctx.params.vcc, '5v')) >= num(ctx.params.vMin, 2)
    const q = on ? s.q : 0
    if (q !== s.applied) {
      s.applied = q
      str(ctx.params.outs, 'q0,q1,q2,q3,q4,q5,q6,q7')
        .split(',')
        .map((x) => x.trim())
        .forEach((id, k) => id && ctx.setParam(id, 'closed', ((q >> k) & 1) === 1))
    }
    ctx.publish('q', q)
    ctx.publish('sr', s.sr)
    ctx.publish('latches', s.latches)
  },
  onEvent(ctx, ev) {
    if (ev === 'power-off' || ev === 'strip') clear(state(ctx)) // an MCU reset does not clear the 595
  },
  reset(ctx) {
    clear(state(ctx))
  },
}
