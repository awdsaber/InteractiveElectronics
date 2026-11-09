// Logic-analyzer core: the edge ring, the bus waveform synthesis and the protocol decoders.
// Round trips: what the master sends is what the decoder reads back, and each fault has its signature.
import { describe, expect, it } from 'vitest'
import { type Frame, decodeI2c, decodeSpi, decodeUart, spiSampled } from './decode'
import { I2cLines, i2cRiseDelay, i2cRiseTime, spiByte, uartBytes } from './synth'
import { EdgeTrace } from './trace'

const bytesOf = (fr: Frame[]) => fr.filter((f) => f.kind === 'byte' || f.kind === 'addr').map((f) => f.value)
const kinds = (fr: Frame[]) => fr.map((f) => (f.kind === 'addr' ? `addr:${f.value!.toString(16)}${f.read ? 'R' : 'W'}` : f.kind === 'byte' ? `0x${f.value!.toString(16)}` : f.kind))

describe('EdgeTrace', () => {
  it('stores level changes only, answers levelAt, and keeps the level of evicted edges', () => {
    const tr = new EdgeTrace(4, 1)
    tr.push(10, 0)
    tr.push(12, 0) // no change
    tr.push(20, 1)
    expect(tr.count).toBe(2)
    expect([tr.levelAt(5), tr.levelAt(10), tr.levelAt(15), tr.levelAt(25)]).toEqual([1, 0, 0, 1])
    for (let k = 0; k < 6; k++) tr.push(30 + k, (k % 2) as 0 | 1)
    expect(tr.count).toBe(4)
    expect(tr.time(0)).toBe(32)
    expect(tr.levelAt(31.5)).toBe(1) // the evicted edge at 31 left the line high
    expect(tr.lowerBound(33)).toBe(1)
  })
})

describe('UART 8N1', () => {
  it('115 200 baud: 8.68 us per bit, 86.8 us per byte, decoded back byte for byte', () => {
    const tr = new EdgeTrace(4096, 1)
    const end = uartBytes([0x48, 0x69, 0x0d, 0x0a], 115200, 100, (t, v) => tr.push(t, v))
    expect(end - 100).toBeCloseTo(4 * 86.806, 2)
    const fr = decodeUart(tr, 115200, 0, end + 100)
    expect(bytesOf(fr)).toEqual([0x48, 0x69, 0x0d, 0x0a])
    expect(fr.filter((f) => f.error)).toEqual([])
    expect(fr[0].t1 - fr[0].t0).toBeCloseTo(86.806, 2)
    expect(fr[0].text).toBe("0x48 'H'")
  })

  it('9600 baud: 1.04 ms per byte', () => {
    const tr = new EdgeTrace(64, 1)
    expect(uartBytes([0x55], 9600, 0, (t, v) => tr.push(t, v))).toBeCloseTo(1041.67, 1)
  })

  it('a baud mismatch decodes garbage with framing errors', () => {
    const tr = new EdgeTrace(4096, 1)
    const text = [...'ax:-512\r\n'].map((c) => c.charCodeAt(0))
    const end = uartBytes(text, 115200, 0, (t, v) => tr.push(t, v))
    const slow = decodeUart(tr, 9600, 0, end + 2000)
    expect(bytesOf(slow)).not.toEqual(text)
    expect(slow.length).toBeLessThan(text.length)
    const fast = decodeUart(tr, 9600 * 1.06, 0, end + 2000)
    expect(bytesOf(fast)).not.toEqual(text)
    // the receiver at 115 200 * 1.03 (3 % off) still reads it: the mid-bit sample drifts 0.3 bit per frame
    expect(bytesOf(decodeUart(tr, 115200 * 1.03, 0, end + 100))).toEqual(text)
  })

  it('a framing error is reported when the stop bit is low', () => {
    const tr = new EdgeTrace(64, 1)
    tr.push(0, 0) // start, then the line just stays low (a break)
    const fr = decodeUart(tr, 115200, 0, 200)
    expect(fr[0]).toMatchObject({ kind: 'byte', value: 0, error: true })
  })
})

describe('I2C', () => {
  it('rise time 0.8473 RC: 4.7 kOhm x 100 pF = 398 ns; 47 kOhm = 3.98 us; to 0.7 VDD = 1.204 RC', () => {
    expect(i2cRiseTime(4700, 100e-12) * 1e9).toBeCloseTo(398.2, 0)
    expect(i2cRiseTime(2200, 100e-12) * 1e9).toBeCloseTo(186.4, 0)
    expect(i2cRiseTime(47000, 100e-12) * 1e6).toBeCloseTo(3.98, 2)
    expect(i2cRiseDelay(4700, 100e-12) * 1e9).toBeCloseTo(565.9, 0)
  })

  function wire(clock: number, riseUs: number) {
    const sda = new EdgeTrace(8192, 1)
    const scl = new EdgeTrace(8192, 1)
    const bus = new I2cLines((t, v) => sda.push(t, v), (t, v) => scl.push(t, v), riseUs)
    let t = 10
    t = bus.transaction({ addr: 0x68, read: false, bytes: [0x75], addrAck: true, stop: false, clock }, t)
    t = bus.transaction({ addr: 0x68, read: true, bytes: [0x68], addrAck: true, stop: true, clock }, t)
    t = bus.transaction({ addr: 0x3c, read: false, bytes: [], addrAck: false, stop: true, clock }, t + 20)
    bus.flush(t + 50)
    return { sda, scl, end: t }
  }

  it('WHO_AM_I read: START, 0x68 W, ACK, 0x75, ACK, Sr, 0x68 R, ACK, 0x68, NACK, STOP; then a NACKed address', () => {
    const { sda, scl, end } = wire(100000, 0.05)
    const fr = decodeI2c(sda, scl, 0, end + 100)
    expect(kinds(fr)).toEqual(['start', 'addr:68W', 'ack', '0x75', 'ack', 'restart', 'addr:68R', 'ack', '0x68', 'nack', 'stop', 'start', 'addr:3cW', 'nack', 'stop'])
    // 4 bytes x 9 clocks = 36 clocks = 360 us at 100 kHz, plus START, Sr and STOP
    const first = fr.find((f) => f.kind === 'start')!
    const stop = fr.find((f) => f.kind === 'stop')!
    expect(stop.t1 - first.t0).toBeGreaterThan(360)
    expect(stop.t1 - first.t0).toBeLessThan(400)
  })

  it('4.7 kOhm at 400 kHz is out of spec (398 ns > 300 ns) but still decodes; 47 kOhm never reaches HIGH', () => {
    const ok = wire(400000, i2cRiseDelay(4700, 100e-12) * 1e6)
    expect(kinds(decodeI2c(ok.sda, ok.scl, 0, ok.end + 100)).slice(0, 4)).toEqual(['start', 'addr:68W', 'ack', '0x75'])
    const slow = wire(400000, i2cRiseDelay(47000, 100e-12) * 1e6)
    expect(bytesOf(decodeI2c(slow.sda, slow.scl, 0, slow.end + 100))).not.toContain(0x68)
    // at 100 kHz 47 kOhm takes 5.66 us to reach 0.7 VDD, longer than the 5 us half-period: also lost
    const std = wire(100000, i2cRiseDelay(47000, 100e-12) * 1e6)
    expect(bytesOf(decodeI2c(std.sda, std.scl, 0, std.end + 100))).not.toContain(0x68)
  })

  it('no pull-up: the line never rises, so nothing decodes', () => {
    const { sda, scl, end } = wire(100000, Infinity)
    expect(decodeI2c(sda, scl, 0, end + 100)).toEqual([])
    expect(scl.levelAt(end)).toBe(0)
  })
})

describe('SPI', () => {
  function spi(byte: number, mode: number, prevMosi: 0 | 1 = 0) {
    const sck = new EdgeTrace(256, mode >= 2 ? 1 : 0)
    const mosi = new EdgeTrace(256, prevMosi)
    const end = spiByte({ mosi: byte, miso: 0xff, mode, clock: 1e6, bitOrder: 1 }, 5, (t, v) => sck.push(t, v), (t, v) => mosi.push(t, v), null)
    return { sck, mosi, end }
  }

  it('1 MHz: a byte takes 8 us; each mode decodes back when the analyzer uses the same mode', () => {
    for (const mode of [0, 1, 2, 3]) {
      const { sck, mosi, end } = spi(0x0f, mode)
      expect(end - 5).toBeCloseTo(8, 6)
      expect(bytesOf(decodeSpi(sck, mosi, null, mode, 1, 0, end + 1))).toEqual([0x0f])
    }
    const { sck, mosi, end } = spi(0x0f, 0)
    expect(bytesOf(decodeSpi(sck, mosi, null, 0, 0, 0, end + 1))).toEqual([0xf0]) // LSB-first reading of an MSB-first byte
  })

  it('a 74HC595 samples on SCK rising: right in modes 0 and 3, shifted one bit in mode 1', () => {
    expect(spiSampled(0x0f, 0, 1, 0)).toBe(0x0f)
    expect(spiSampled(0x0f, 3, 1, 0)).toBe(0x0f)
    expect(spiSampled(0x0f, 1, 1, 0)).toBe(0x07) // the old MOSI level, then b7..b1
    expect(spiSampled(0x0f, 1, 1, 1)).toBe(0x87)
    expect(spiSampled(0xf0, 1, 1, 0)).toBe(0x78)
  })
})
