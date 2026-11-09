import { describe, expect, it } from 'vitest'
import type { SpiDevice } from '../mcu/virtualMcu'
import type { BehaviorContext } from '../types'
import { behavior } from './hc595'

function fake(vcc = 5) {
  const set: Record<string, number | boolean> = {}
  const pub: Record<string, number> = {}
  const devs = new Map<number, SpiDevice>()
  const ctx = {
    t: 0,
    powered: true,
    params: { cs: 10, outs: 'q0,q1,q2,q3,q4,q5,q6,q7' },
    v: () => vcc,
    publish: (k: string, v: number) => (pub[k] = v),
    setParam: (id: string, _k: string, v: number | boolean) => (set[id] = v),
    mcu: { attachSpi: (cs: number, d: unknown) => devs.set(cs, d as SpiDevice) },
  } as unknown as BehaviorContext
  behavior.init!(ctx)
  const dev = devs.get(10)!
  const send = (byte: number, mode = 0, bitOrder = 1) => {
    dev.select!(true)
    const back = dev.transfer(byte, { clock: 1e6, mode, bitOrder })
    dev.select!(false) // RCLK rising
    behavior.tick!(ctx, 1 / 60)
    return back
  }
  return { ctx, set, pub, send }
}

describe('hc595 behavior', () => {
  it('mode 0, MSB first: the byte lands on Q7..Q0 at the latch edge; QH\' is not on MISO (0xFF)', () => {
    const f = fake()
    expect(f.send(0b1010_0101)).toBe(0xff)
    expect(f.pub.q).toBe(0xa5)
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((k) => f.set[`q${k}`])).toEqual([true, false, true, false, false, true, false, true])
  })

  it('nothing reaches the outputs until the latch rises', () => {
    const f = fake()
    f.send(0x0f)
    const devs = new Map<number, SpiDevice>()
    // a second chip on the same context would share state: drive the attached one directly instead
    ;(f.ctx.mcu as unknown as { attachSpi: (cs: number, d: unknown) => void }).attachSpi = (cs, d) => devs.set(cs, d as SpiDevice)
    behavior.init!(f.ctx)
    const dev = devs.get(10)!
    dev.select!(true)
    dev.transfer(0xf0, { clock: 1e6, mode: 0, bitOrder: 1 })
    behavior.tick!(f.ctx, 1 / 60)
    expect(f.pub.sr).toBe(0xf0)
    expect(f.pub.q).toBe(0x0f) // still the old latch
    dev.select!(false)
    behavior.tick!(f.ctx, 1 / 60)
    expect(f.pub.q).toBe(0xf0)
  })

  it('mode 1 shifts the byte one bit (the 595 clocks on SCK rising, where mode 1 changes MOSI); LSBFIRST reverses it', () => {
    const f = fake()
    f.send(0x0f, 1) // MOSI starts LOW
    expect(f.pub.q).toBe(0x07)
    f.send(0x0f, 1) // the previous byte left MOSI HIGH
    expect(f.pub.q).toBe(0x87)
    f.send(0x01, 0, 0)
    expect(f.pub.q).toBe(0x80)
  })

  it('outputs drop with VCC below 2 V', () => {
    const f = fake(1.5)
    f.send(0xff)
    expect(f.pub.q).toBe(0)
  })
})
