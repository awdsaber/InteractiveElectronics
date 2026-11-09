import { describe, expect, it } from 'vitest'
import type { LogicCapture } from '../../engine/behaviors/logic-analyzer'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import type { Frame } from '../../engine/logic/decode'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const FRAME = 1 / 60
const L = getLesson('serial-protocols') as Lesson

// readout indices
const BYTE_US = 0
const RX_RATE = 1
const FRAMING = 2
const RISE = 3
const NACKS = 4
const SPI_LAST = 5
const SDA_IDLE = 6
const BAR_I = 7

function build(code?: string): Bench {
  const b = createBench(L)
  b.dispatch('strip')
  b.dispatch('pick-place')
  b.dispatch('place-all')
  b.dispatch('solder')
  b.dispatch('power')
  b.upload(code)
  return b
}

async function run(b: Bench, seconds: number): Promise<BenchSnapshot> {
  const end = b.t + seconds
  while (b.t < end - 1e-9) await b.frame(FRAME)
  return b.snapshot()
}

const cap = (b: Bench) => b.behaviorData('logic-analyzer') as LogicCapture
const ascii = (fr: Frame[]) => String.fromCharCode(...fr.filter((f) => f.kind === 'byte').map((f) => f.value!))
const label = (f: Frame) => (f.kind === 'addr' ? `${f.value!.toString(16)}${f.read ? 'R' : 'W'}` : f.kind === 'byte' ? f.value!.toString(16) : f.kind)

describe('T7 serial-protocols lesson', () => {
  it('validates: 5 failures, a logic-analyzer tab with 7 channels, a 5–9 step guide', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.failures.map((f) => f.id)).toEqual(['wrong-baud', 'weak-pullups', 'long-bus', 'no-pullups', 'tx-to-tx'])
    expect(L.instruments!.logic!.channels.map((c) => c.label)).toEqual(['TX', 'RX (adapter)', 'SDA', 'SCL', 'SCK', 'MOSI', 'LATCH'])
    expect(L.instruments!.view).toBe('logic')
    expect(L.guide!.length).toBeGreaterThanOrEqual(5)
    expect(L.guide!.length).toBeLessThanOrEqual(9)
  })

  it('running: WHO_AM_I = 0x68, 86.8 us per byte, t_r 398 ns, no NACKs, the bar shows level 5 (0x1F) at -25 deg', async () => {
    const b = build()
    const s = await run(b, 1.5)
    expect(s.status).toBe('RUNNING')
    expect(s.serial[0]).toBe('WHO_AM_I=0x68')
    expect(s.serial[1]).toBe('wake status 0')
    expect(s.serial.at(-1)).toMatch(/^ax:\d+,bar:5$/)
    expect(s.values[BYTE_US]).toBeCloseTo(86.8, 1)
    expect(s.values[RISE] * 1e9).toBeCloseTo(398, 0)
    expect(s.values[NACKS]).toBe(0)
    expect(s.values[FRAMING]).toBe(0)
    expect(s.values[SPI_LAST]).toBe(0x1f)
    expect(s.values[SDA_IDLE]).toBeCloseTo(3.3, 1)
    // five LEDs at about 2.8 mA each ((5 - Vf) / 1050 ohm)
    expect(s.values[BAR_I] / 5).toBeGreaterThan(0.0024)
    expect(s.values[BAR_I] / 5).toBeLessThan(0.0033)
    // ~16 bytes per 100 ms line
    expect(s.values[RX_RATE]).toBeGreaterThan(120)
    expect(s.values[RX_RATE]).toBeLessThan(200)
    expect(s.warnings ?? []).toEqual([])
    b.dispose()
  })

  it('the decoders read back what the sketch sent: the I2C register read, the SPI byte and the UART text', async () => {
    const b = build()
    await run(b, 1.0)
    const c = cap(b)
    const now = c.now()
    const i2c = c.decode('i2c', now - 150000, now).map(label)
    const k = i2c.indexOf('start')
    expect(i2c.slice(k, k + 13)).toEqual(['start', '68W', 'ack', '3b', 'ack', 'restart', '68R', 'ack', i2c[k + 8], 'ack', i2c[k + 10], 'nack', 'stop'])
    expect(c.decode('spi', now - 150000, now).map((f) => f.value)).toContain(0x1f)
    const text = ascii(c.decode('uart', now - 250000, now))
    expect(text).toMatch(/ax:\d+,bar:5\r\n/)
    // the analyzer's view of one register read: 5 bytes x 9 clocks at 100 kHz = 450 us plus START, Sr, STOP
    const fr = c.decode('i2c', now - 150000, now)
    const s0 = fr.find((f) => f.kind === 'start')!
    const p0 = fr.find((f) => f.kind === 'stop' && f.t0 > s0.t0)!
    expect(p0.t0 - s0.t0).toBeGreaterThan(450)
    expect(p0.t0 - s0.t0).toBeLessThan(500)
    b.dispose()
  })

  it('wrong baud: UART garbage and framing errors; I2C and SPI unaffected', async () => {
    const b = build()
    await run(b, 0.6)
    b.dispatch('break:wrong-baud')
    const s = await run(b, 1.2)
    expect(s.values[FRAMING]).toBeGreaterThan(0)
    expect(s.values[RX_RATE]).toBeLessThan(40)
    const c = cap(b)
    const now = c.now()
    expect(ascii(c.decode('uart', now - 500000, now))).not.toContain('bar:')
    expect(s.values[NACKS]).toBe(0)
    expect(s.values[SPI_LAST]).toBe(0x1f)
    expect(s.statusLine.text).toContain('BROKEN')
    b.dispose()
  })

  it('47 kOhm pull-ups: t_r 3.98 us, every transaction NACKed, "I2C read failed"; repair recovers', async () => {
    const b = build()
    await run(b, 0.6)
    b.dispatch('break:weak-pullups')
    const s = await run(b, 1.0)
    expect(s.values[RISE] * 1e6).toBeCloseTo(3.98, 2)
    expect(s.values[NACKS]).toBeGreaterThan(5)
    expect(s.serial.at(-1)).toBe('I2C read failed')
    b.dispatch('repair')
    const r = await run(b, 1.5)
    expect(r.values[NACKS]).toBe(0)
    expect(r.serial.at(-1)).toMatch(/^ax:/)
    // the same with the slider instead of the failure: the status line points at the pull-ups
    b.setTweak('r_sda.value', 47000)
    const t = await run(b, 1.0)
    expect(t.values[NACKS]).toBeGreaterThan(2)
    expect(t.statusLine.text).toContain('I²C NACKs')
    b.dispose()
  })

  it('400 pF: t_r 1.59 us is over the 1000 ns standard-mode limit, but 100 kHz still works', async () => {
    const b = build()
    await run(b, 0.6)
    b.dispatch('break:long-bus')
    const s = await run(b, 1.0)
    expect(s.values[RISE] * 1e6).toBeCloseTo(1.593, 2)
    expect(s.published['logic-analyzer.i2c_tr_limit']).toBeCloseTo(1e-6, 12)
    expect(s.values[NACKS]).toBe(0)
    expect(s.serial.at(-1)).toMatch(/^ax:/)
    b.dispose()
  })

  it('400 kHz in the code: 4.7 kOhm is out of spec (398 ns > 300 ns) yet still reads; 47 kOhm fails', async () => {
    const b = build(L.sketch!.code.replace('Wire.setClock(100000)', 'Wire.setClock(400000)'))
    const s = await run(b, 1.0)
    expect(s.published['logic-analyzer.i2c_clock']).toBe(400000)
    expect(s.published['logic-analyzer.i2c_tr_limit']).toBeCloseTo(300e-9, 15)
    expect(s.values[RISE]).toBeGreaterThan(300e-9)
    expect(s.values[NACKS]).toBe(0)
    b.dispatch('break:weak-pullups')
    const w = await run(b, 0.6)
    expect(w.values[NACKS]).toBeGreaterThan(2)
    b.dispose()
  })

  it('no pull-ups: SDA idles near 0 V, flat lines, no START, the read fails', async () => {
    const b = build()
    await run(b, 0.6)
    b.dispatch('break:no-pullups')
    const s = await run(b, 1.5)
    expect(s.values[SDA_IDLE]).toBeLessThan(0.3)
    expect(s.serial.at(-1)).toBe('I2C read failed')
    const c = cap(b)
    const now = c.now()
    expect(c.decode('i2c', now - 500000, now).filter((f) => f.kind === 'start')).toEqual([])
    expect(c.channel({ node: 'sda', label: 'SDA' }).trace.levelAt(now)).toBe(0)
    b.dispose()
  })

  it('TX wired to TX: the adapter RX lane is flat HIGH and nothing arrives, the TX lane still carries frames', async () => {
    const b = build()
    await run(b, 0.6)
    b.dispatch('break:tx-to-tx')
    const s = await run(b, 1.5)
    expect(s.values[RX_RATE]).toBe(0)
    const c = cap(b)
    const now = c.now()
    const rx = c.channel({ node: 'ad_rx', label: 'RX' })
    expect(rx.kind).toBe('node')
    expect(rx.trace.levelAt(now)).toBe(1)
    expect(ascii(c.decodeUartOn(c.channel({ pin: 1, label: 'TX' }).trace, now - 300000, now))).toContain('bar:5')
    expect(s.assembly.failures).toContain('tx-to-tx')
    b.dispose()
  })

  it('SPI_MODE1 in the code: the 595 catches every bit one clock late (0x1F shows as 0x8F); the analyzer in mode 1 reads 0x1F', async () => {
    const b = build(L.sketch!.code.replace('SPI_MODE0', 'SPI_MODE1'))
    const s = await run(b, 1.0)
    expect(s.published['logic-analyzer.spi_mode']).toBe(1)
    expect(s.values[SPI_LAST]).toBe(0x1f)
    expect(s.published['hc595.q']).toBe(0x8f)
    const c = cap(b)
    const now = c.now()
    expect(c.decode('spi', now - 150000, now).map((f) => f.value)).toContain(0x1f)
    b.dispose()
  })

  it('tilting the sensor moves the bar: +25 deg gives level 2 (0x03)', async () => {
    const b = build()
    b.setTweak('behavior:imu-mpu6050.pitchDeg', 25)
    const s = await run(b, 2.0)
    expect(s.values[SPI_LAST]).toBe(0x03)
    b.dispose()
  })
})
