// Bus waveforms from bus transactions. The virtual MCU reports what the sketch sent (bytes, address,
// ACK, clock rate, SPI mode) but takes no time doing it; these functions lay the bits out at the bus's
// real rate, as edges on digital traces (time in µs). I²C lines are open-drain: a falling edge is
// immediate, a rising edge waits for the pull-up to charge the bus capacitance up to V_IH.

export type Sink = (t: number, level: 0 | 1) => void

/** 30 % → 70 % rise time of an RC pull-up, seconds: t_r = RC·ln(0.7/0.3) ≈ 0.8473·R·C (the I²C spec's t_r) */
export const i2cRiseTime = (r: number, c: number): number => 0.8473 * r * c
/** 0 → V_IH (0.7·VDD) on an RC pull-up, seconds: RC·ln(1/0.3) ≈ 1.204·R·C. Infinity with no pull-up. */
export const i2cRiseDelay = (r: number, c: number): number => (Number.isFinite(r) && r > 0 ? 1.204 * r * Math.max(0, c) : Infinity)

/** UART 8N1: a LOW start bit, 8 data bits LSB first, a HIGH stop bit. Returns the end time (10 bit times per byte). */
export function uartBytes(bytes: readonly number[], baud: number, t0: number, sink: Sink): number {
  const T = 1e6 / baud
  let t = t0
  for (const b of bytes) {
    sink(t, 0)
    for (let i = 0; i < 8; i++) sink(t + (i + 1) * T, ((b >> i) & 1) as 0 | 1)
    sink(t + 9 * T, 1)
    t += 10 * T
  }
  return t
}

/** one open-drain line: pulled low at once, released to rise after `delay` µs (Infinity: never) */
class OpenDrain {
  private seen: 0 | 1 = 1
  private released: 0 | 1 = 1
  private rise = NaN
  delay: number
  private readonly sink: Sink

  constructor(sink: Sink, delay: number) {
    this.sink = sink
    this.delay = delay
  }

  /** what the line reads now (pending rises included up to t) */
  levelAt(t: number): 0 | 1 {
    this.flush(t)
    return this.seen
  }

  set(t: number, level: 0 | 1): void {
    if (level === this.released) return
    this.released = level
    if (level === 0) {
      this.flush(t)
      this.rise = NaN // a rise that had not reached V_IH yet never happened
      if (this.seen === 1) {
        this.seen = 0
        this.sink(t, 0)
      }
    } else if (this.seen === 0) {
      this.rise = t + this.delay
    }
  }

  flush(t: number): void {
    if (this.rise <= t) {
      this.seen = 1
      this.sink(this.rise, 1)
      this.rise = NaN
    }
  }

  /** the pull-up is gone: the line sits low */
  sag(t: number): void {
    this.flush(t)
    this.rise = NaN
    if (this.seen === 1) {
      this.seen = 0
      this.sink(t, 0)
    }
  }

  /** a pull-up is back while nothing drives the line: it rises */
  recover(t: number): void {
    if (this.released === 1 && this.seen === 0 && Number.isNaN(this.rise) && Number.isFinite(this.delay)) this.rise = t + this.delay
  }
}

export interface I2cTxn {
  addr: number
  read: boolean
  bytes: readonly number[]
  addrAck: boolean
  stop: boolean
  clock: number
}

/** SDA and SCL of one I²C bus, driven by a master at a fixed clock (no clock stretching or synchronization) */
export class I2cLines {
  private readonly sda: OpenDrain
  private readonly scl: OpenDrain
  /** a transaction ended without STOP: the next one starts with a repeated START */
  private held = false

  constructor(sdaSink: Sink, sclSink: Sink, riseUs: number) {
    this.sda = new OpenDrain(sdaSink, riseUs)
    this.scl = new OpenDrain(sclSink, riseUs)
    if (!Number.isFinite(riseUs)) this.setRise(riseUs, riseUs, 0)
  }

  /** rise delays to V_IH, µs, per line (Infinity: no pull-up, the line sags low at time t) */
  setRise(sdaUs: number, sclUs: number, t: number): void {
    this.sda.delay = sdaUs
    this.scl.delay = sclUs
    // SCL first: SDA falling while SCL is still high would look like a START
    if (!Number.isFinite(sclUs)) this.scl.sag(t)
    else this.scl.recover(t)
    if (!Number.isFinite(sdaUs)) this.sda.sag(t)
    else this.sda.recover(t)
  }

  flush(t: number): void {
    this.sda.flush(t)
    this.scl.flush(t)
  }

  /** what a device reads on SDA at time t */
  sdaAt(t: number): 0 | 1 {
    return this.sda.levelAt(t)
  }

  /** lay one transaction out from t0 (µs); returns its end */
  transaction(x: I2cTxn, t0: number): number {
    const q = 1e6 / (4 * x.clock) // a quarter of an SCL period
    let t = t0
    const sda = this.sda
    const scl = this.scl
    if (this.held) {
      // repeated START: release SDA, then SCL, then pull SDA low while SCL is high
      sda.set(t + q, 1)
      scl.set(t + 2 * q, 1)
      sda.set(t + 3 * q, 0)
      scl.set(t + 4 * q, 0)
      t += 4 * q
    } else {
      sda.set(t, 0) // START: SDA falls while SCL is high
      scl.set(t + 2 * q, 0)
      t += 2 * q
    }
    const bit = (level: 0 | 1) => {
      sda.set(t + q, level) // SDA changes while SCL is low
      scl.set(t + 2 * q, 1) // and is sampled on the SCL high
      scl.set(t + 4 * q, 0)
      t += 4 * q
    }
    const byte = (b: number) => {
      for (let i = 7; i >= 0; i--) bit(((b >> i) & 1) as 0 | 1) // MSB first
    }
    byte(((x.addr & 0x7f) << 1) | (x.read ? 1 : 0))
    bit(x.addrAck ? 0 : 1) // the addressed device pulls SDA low to ACK
    if (x.addrAck) {
      x.bytes.forEach((b, k) => {
        byte(b & 0xff)
        // write: the device ACKs each byte; read: the master ACKs all but the last (NACK = "no more")
        bit(x.read && k === x.bytes.length - 1 ? 1 : 0)
      })
    }
    if (x.stop || !x.addrAck) {
      sda.set(t + q, 0) // STOP: SDA rises while SCL is high
      scl.set(t + 2 * q, 1)
      sda.set(t + 3 * q, 1)
      t += 4 * q
      this.held = false
    } else {
      this.held = true
    }
    return t
  }
}

export interface SpiByte {
  mosi: number
  miso: number
  /** 0..3: CPOL = mode >> 1 (clock idle level), CPHA = mode & 1 (sample on the second edge) */
  mode: number
  clock: number
  /** 1 = MSBFIRST, 0 = LSBFIRST */
  bitOrder: number
}

/** a data line changes this long after the clock edge it follows (clock-to-output), µs */
const CLK_TO_Q = 1e-3

/**
 * One SPI byte from t0 (µs): 8 clocks at `clock` Hz. CPHA 0: data is set up half a clock before the
 * leading edge, sampled on it, and changes on the trailing edge. CPHA 1: data changes just after the
 * leading edge and is sampled on the trailing one. Returns the end (t0 + 8 clock periods).
 */
export function spiByte(s: SpiByte, t0: number, sck: Sink, mosi: Sink | null, miso: Sink | null): number {
  const h = 1e6 / (2 * s.clock)
  const cpol = (s.mode >> 1) & 1
  const cpha = s.mode & 1
  const idle = cpol as 0 | 1
  const lead = (1 - cpol) as 0 | 1
  for (let k = 0; k < 8; k++) {
    const i = s.bitOrder === 0 ? k : 7 - k
    const at = t0 + 2 * h * k
    const td = at + CLK_TO_Q
    mosi?.(td, ((s.mosi >> i) & 1) as 0 | 1)
    miso?.(td, ((s.miso >> i) & 1) as 0 | 1)
    if (cpha === 0) {
      sck(at + h, lead)
      sck(at + 2 * h, idle)
    } else {
      sck(at, lead)
      sck(at + h, idle)
    }
  }
  return t0 + 16 * h
}
