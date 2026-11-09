// Protocol decoders that read digital traces the way a logic analyzer does: from edges alone, at the
// analyzer's own settings (a UART decoder only knows its configured baud; an SPI decoder only knows
// which clock edge to sample on). Times in µs.

import { spiByte } from './synth'
import { EdgeTrace, type DigitalWave } from './trace'

export type FrameKind = 'byte' | 'addr' | 'start' | 'restart' | 'stop' | 'ack' | 'nack'

export interface Frame {
  t0: number
  t1: number
  kind: FrameKind
  value?: number
  /** I²C address frames: the R/W bit */
  read?: boolean
  /** UART framing error (stop bit LOW) */
  error?: boolean
  /** annotation text: "0x48 'H'", "0x68 W", "S", "P", "A", "N" */
  text: string
}

const NAMES: Record<number, string> = { 0x0a: 'LF', 0x0d: 'CR', 0x09: 'TAB', 0x00: 'NUL' }
const hex = (v: number) => `0x${v.toString(16).toUpperCase().padStart(2, '0')}`
/** "0x48 'H'" for printable ASCII, "0x0D CR" for a few controls, else just the hex */
export function byteText(v: number): string {
  if (v >= 0x20 && v < 0x7f) return `${hex(v)} '${String.fromCharCode(v)}'`
  return NAMES[v] ? `${hex(v)} ${NAMES[v]}` : hex(v)
}

/**
 * UART 8N1 at `baud`: wait for a falling edge (start bit), check it is still LOW half a bit later,
 * sample the 8 data bits (LSB first) mid-bit, then the stop bit, which must be HIGH or the frame is a
 * framing error. After the stop-bit sample it hunts for the next start, as a hardware UART does.
 * Only frames whose 10 bits fit inside [from, to] are returned.
 */
export function decodeUart(w: DigitalWave, baud: number, from: number, to: number): Frame[] {
  const T = 1e6 / baud
  const out: Frame[] = []
  let cursor = from
  for (let k = w.lowerBound(from); k < w.count; ) {
    const ts = w.time(k)
    if (ts + 10 * T > to) break
    if (w.level(k) !== 0 || ts < cursor) {
      k++
      continue
    }
    if (w.levelAt(ts + 0.5 * T) !== 0) {
      k++ // a glitch, not a start bit
      continue
    }
    let v = 0
    for (let i = 0; i < 8; i++) v |= w.levelAt(ts + (1.5 + i) * T) << i
    const stopOk = w.levelAt(ts + 9.5 * T) === 1
    out.push({ t0: ts, t1: ts + 10 * T, kind: 'byte', value: v, text: stopOk ? byteText(v) : `${hex(v)} FRAMING ERR`, ...(stopOk ? {} : { error: true }) })
    cursor = ts + 9.5 * T
    k = w.lowerBound(cursor)
    // after a framing error the line may still be LOW: the next start is the next falling edge
  }
  return out
}

/**
 * I²C: START = SDA falls while SCL is HIGH, STOP = SDA rises while SCL is HIGH, a data bit = SDA on
 * each SCL rising edge, MSB first, 8 bits then the ACK bit (LOW = ACK). The first byte after a START
 * is the 7-bit address plus R/W.
 */
export function decodeI2c(sda: DigitalWave, scl: DigitalWave, from: number, to: number): Frame[] {
  const out: Frame[] = []
  let i = sda.lowerBound(from)
  let j = scl.lowerBound(from)
  let inTx = false
  let first = false
  let bits = 0
  let v = 0
  let byteT0 = from
  let lastFall = from
  let lastRise = NaN
  let period = NaN
  while (i < sda.count || j < scl.count) {
    const ts = i < sda.count ? sda.time(i) : Infinity
    const tc = j < scl.count ? scl.time(j) : Infinity
    const t = Math.min(ts, tc)
    if (t > to) break
    if (tc <= ts) {
      // SCL edge
      const up = scl.level(j) === 1
      j++
      if (!up) {
        lastFall = t
        continue
      }
      if (Number.isFinite(lastRise)) period = t - lastRise
      lastRise = t
      if (!inTx) continue
      const b = sda.levelAt(t)
      const half = Number.isFinite(period) ? period / 2 : 2
      if (bits === 0) byteT0 = lastFall
      if (bits < 8) {
        v = (v << 1) | b
        bits++
        if (bits === 8) {
          const end = t + half
          if (first) out.push({ t0: byteT0, t1: end, kind: 'addr', value: v >> 1, read: (v & 1) === 1, text: `${hex(v >> 1)} ${v & 1 ? 'R' : 'W'}` })
          else out.push({ t0: byteT0, t1: end, kind: 'byte', value: v, text: byteText(v) })
        }
      } else {
        out.push({ t0: t - half, t1: t + half, kind: b ? 'nack' : 'ack', text: b ? 'N' : 'A' })
        bits = 0
        v = 0
        first = false
      }
    } else {
      // SDA edge: only a START or STOP while SCL is high
      const up = sda.level(i) === 1
      i++
      if (scl.levelAt(t) !== 1 || (j < scl.count && scl.time(j) === t)) continue
      if (!up) {
        out.push({ t0: t, t1: t, kind: inTx ? 'restart' : 'start', text: inTx ? 'Sr' : 'S' })
        inTx = true
        first = true
        bits = 0
        v = 0
      } else if (inTx) {
        out.push({ t0: t, t1: t, kind: 'stop', text: 'P' })
        inTx = false
        bits = 0
        v = 0
      }
    }
  }
  return out
}

/**
 * SPI: sample MOSI on the mode's sampling edge (modes 0 and 3: SCK rising; 1 and 2: falling), 8 bits
 * per byte in `bitOrder` (1 = MSB first). With a chip-select trace, only edges while CS is LOW count
 * and each CS assertion starts a new byte; without one, a pause of more than 3 clock periods does.
 */
export function decodeSpi(sck: DigitalWave, mosi: DigitalWave, cs: DigitalWave | null, mode: number, bitOrder: number, from: number, to: number): Frame[] {
  const out: Frame[] = []
  const sampleRising = mode === 0 || mode === 3
  let bits = 0
  let v = 0
  let t0 = from
  let prev = NaN
  let iv = NaN
  let csIdx = -1
  for (let k = sck.lowerBound(from); k < sck.count; k++) {
    const t = sck.time(k)
    if (t > to) break
    if ((sck.level(k) === 1) !== sampleRising) continue
    if (cs) {
      if (cs.levelAt(t) !== 0) continue
      const w = cs.lowerBound(t)
      if (w !== csIdx) {
        csIdx = w
        bits = 0
        v = 0
      }
    }
    if (Number.isFinite(prev)) {
      const gap = t - prev
      if (Number.isFinite(iv) && gap > 3 * iv) {
        bits = 0
        v = 0
      } else iv = gap
    }
    prev = t
    const b = mosi.levelAt(t)
    if (bits === 0) {
      v = 0
      t0 = t - (Number.isFinite(iv) ? iv / 2 : 0.5)
    }
    v = bitOrder === 0 ? v | (b << bits) : (v << 1) | b
    bits++
    if (bits === 8) {
      const half = Number.isFinite(iv) ? iv / 2 : 0.5
      out.push({ t0, t1: t + half, kind: 'byte', value: v & 0xff, text: byteText(v & 0xff) })
      bits = 0
      v = 0
    }
  }
  return out
}

/**
 * What a shift register that samples on SCK rising (a 74HC595 on SRCLK) actually clocks in from one
 * master byte in `mode`, as 8 bits shifted in first-to-last (the first one ends up in Q7). MOSI starts at
 * `prevMosi`, the level the last byte left on the line.
 */
export function spiSampled(byte: number, mode: number, bitOrder: number, prevMosi: 0 | 1): number {
  const sck = new EdgeTrace(32, ((mode >> 1) & 1) as 0 | 1)
  const mosi = new EdgeTrace(32, prevMosi)
  spiByte({ mosi: byte, miso: 0xff, mode, clock: 1e6, bitOrder }, 1, (t, l) => sck.push(t, l), (t, l) => mosi.push(t, l), null)
  let v = 0
  for (let k = 0; k < sck.count; k++) if (sck.level(k) === 1) v = ((v << 1) | mosi.levelAt(sck.time(k))) & 0xff
  return v
}
