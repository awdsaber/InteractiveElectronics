// logic-analyzer on a real bench: a small three-bus board (UART to an adapter's RX, an MPU-6050 at 0x68
// with RC pull-ups, a 74HC595 on SPI). The decoders must read back what the sketch sent, and each
// fault must show its signature.
import { describe, expect, it } from 'vitest'
import { lesson as ledResistor } from '../../lessons/T2/led-resistor'
import { createBench } from '../bench/simLoop'
import type { Frame } from '../logic/decode'
import type { Element, Lesson } from '../types'
import { type LogicCapture, behavior } from './logic-analyzer'
import { behavior as hc595 } from './hc595'
import { behavior as imu } from './imu-mpu6050'

const FRAME = 1 / 60

const SKETCH = `#include <Wire.h>
#include <SPI.h>
void setup() {
  Serial.begin(115200);
  pinMode(10, OUTPUT);
  digitalWrite(10, HIGH);
  SPI.begin();
  Wire.begin();
}
void loop() {
  Wire.beginTransmission(0x68);
  Wire.write(0x75);
  int st = Wire.endTransmission(false);
  int who = 0;
  if (st == 0 && Wire.requestFrom(0x68, 1) == 1) {
    who = Wire.read();
  }
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  digitalWrite(10, LOW);
  SPI.transfer(0x0F);
  digitalWrite(10, HIGH);
  SPI.endTransaction();
  Serial.print("WHO_AM_I=0x");
  Serial.println(who, HEX);
  delay(50);
}
`

function lesson(): Lesson {
  const q: Element[] = []
  for (let k = 0; k < 8; k++) {
    q.push({ id: `q${k}`, type: 'SW', nodes: ['5v', `q${k}`], closed: false })
    q.push({ id: `rl${k}`, type: 'R', nodes: [`q${k}`, '0'], value: 1000 })
  }
  return {
    ...ledResistor,
    fig: 1,
    board: { ...ledResistor.board, parts: [] },
    circuit: {
      elements: [
        { id: 'v1', type: 'V', nodes: ['vin', '0'], value: 5 },
        { id: 'usb', type: 'SW', nodes: ['vin', '5v'], closed: true },
        { id: 'ldo', type: 'OPAMP', nodes: ['5v', '3v3', '3v3'], vPos: 3.3, vNeg: 0 },
        { id: 'r_load', type: 'R', nodes: ['3v3', '0'], value: 1000 },
        { id: 'r_sda', type: 'R', nodes: ['3v3', 'sda'], value: 4700 },
        { id: 'r_scl', type: 'R', nodes: ['3v3', 'scl'], value: 4700 },
        { id: 'c_sda', type: 'C', nodes: ['sda', '0'], value: 100e-12 },
        { id: 'c_scl', type: 'C', nodes: ['scl', '0'], value: 100e-12 },
        { id: 'pin_sda', type: 'PIN', nodes: ['sda', '0'], pin: 18, vcc: 5 },
        { id: 'pin_scl', type: 'PIN', nodes: ['scl', '0'], pin: 19, vcc: 5 },
        { id: 'pin1', type: 'PIN', nodes: ['d1', '0'], pin: 1, vcc: 5 },
        { id: 'w_tx', type: 'R', nodes: ['d1', 'ad_rx'], value: 0.05 },
        { id: 'r_rxpu', type: 'R', nodes: ['3v3', 'ad_rx'], value: 47000 },
        ...q,
      ],
    },
    powerElementId: 'usb',
    readouts: [
      { label: 'UART BYTE', source: { kind: 'behavior', key: 'logic-analyzer.uart_byte_us' }, unit: 'µs' },
      { label: 'RISE', source: { kind: 'behavior', key: 'logic-analyzer.i2c_tr' }, unit: 's' },
    ],
    tweaks: [],
    statusLines: [],
    guide: undefined,
    instruments: undefined,
    behaviors: [{ id: 'logic-analyzer', params: { uartRx: 'ad_rx' } }, { id: 'hc595', params: { cs: 10, outs: 'q0,q1,q2,q3,q4,q5,q6,q7' } }, { id: 'imu-mpu6050' }],
    sketch: { title: 'buses', code: SKETCH, pins: { 1: 'pin1', 18: 'pin_sda', 19: 'pin_scl' }, vcc: 5, board: 'uno' },
    failures: [
      { id: 'weak', label: 'weak', explain: '', patches: [{ op: 'set', elementId: 'r_sda', key: 'value', value: 47000 }, { op: 'set', elementId: 'r_scl', key: 'value', value: 47000 }] },
      { id: 'nopull', label: 'nopull', explain: '', patches: [{ op: 'remove', elementId: 'r_sda' }, { op: 'remove', elementId: 'r_scl' }] },
      { id: 'baud', label: 'baud', explain: '', patches: [{ op: 'set', elementId: 'behavior:logic-analyzer', key: 'laBaud', value: 9600 }] },
      { id: 'swap', label: 'swap', explain: '', patches: [{ op: 'remove', elementId: 'w_tx' }, { op: 'add', element: { id: 'w_tx2', type: 'R', nodes: ['d1', 'ad_tx'], value: 0.05 } }] },
    ],
  }
}

async function bench(code = SKETCH, seconds = 0.6) {
  const b = createBench(lesson(), { registry: { 'logic-analyzer': behavior, hc595, 'imu-mpu6050': imu } })
  b.dispatch('power')
  b.upload(code)
  for (let i = 0; i < Math.round(seconds / FRAME); i++) await b.frame(FRAME)
  const cap = b.behaviorData('logic-analyzer') as LogicCapture
  return { b, cap }
}
const run = async (b: { frame(dt: number): Promise<void> }, s: number) => {
  for (let i = 0; i < Math.round(s / FRAME); i++) await b.frame(FRAME)
}
const label = (f: Frame) => (f.kind === 'addr' ? `${f.value!.toString(16)}${f.read ? 'R' : 'W'}` : f.kind === 'byte' ? f.value!.toString(16) : f.kind)
const pub = (b: { snapshot(): { published: Record<string, number> } }, k: string) => b.snapshot().published[`logic-analyzer.${k}`]

describe('logic-analyzer behavior', () => {
  it('decodes the I2C WHO_AM_I read, the UART line and the SPI byte that the sketch sent', async () => {
    const { b, cap } = await bench()
    expect(cap).toBeTruthy()
    const now = cap.now()
    const i2c = cap.decode('i2c', now - 60000, now).map(label)
    const k = i2c.indexOf('start')
    expect(i2c.slice(k, k + 11)).toEqual(['start', '68W', 'ack', '75', 'ack', 'restart', '68R', 'ack', '68', 'nack', 'stop'])
    const uart = cap.decode('uart', now - 60000, now)
    const text = String.fromCharCode(...uart.map((f) => f.value!))
    expect(text).toContain('68\r\n')
    expect(uart.some((f) => f.error)).toBe(false)
    const spi = cap.decode('spi', now - 60000, now)
    expect(spi.map((f) => f.value)).toContain(0x0f)
    // the 595 latched 0x0F: Q0..Q3 on
    const s = b.snapshot()
    expect(s.published['hc595.q']).toBe(0x0f)
    expect(s.elementV.rl0).toBeGreaterThan(4.5)
    expect(Math.abs(s.elementV.rl7)).toBeLessThan(0.1)
    // key numbers: 86.8 us per byte at 115 200, t_r = 0.8473 x 4.7k x 100p = 398 ns
    expect(pub(b, 'uart_byte_us')).toBeCloseTo(86.8, 1)
    expect(pub(b, 'i2c_tr') * 1e9).toBeCloseTo(398, 0)
    expect(pub(b, 'i2c_tr_limit') * 1e9).toBe(1000)
    expect(pub(b, 'i2c_nacks')).toBe(0)
    expect(pub(b, 'spi_last')).toBe(0x0f)
    expect(pub(b, 'uart_rx_rate')).toBeGreaterThan(200) // "WHO_AM_I=0x68\r\n" = 15 bytes every ~50 ms
    expect(pub(b, 'la_decode_errors')).toBe(0)
    b.dispose()
  })

  it('one loop on the timeline: the I2C read, then the SPI byte inside the latch pulse, then the UART line', async () => {
    const { b, cap } = await bench()
    const now = cap.now()
    const i2c = cap.decode('i2c', now - 50000, now)
    const stop = i2c.find((f) => f.kind === 'stop')!
    const spi = cap.decode('spi', stop.t0, now)[0]
    const uart = cap.decode('uart', stop.t0, now)[0]
    expect(spi.t0).toBeGreaterThan(stop.t0)
    expect(uart.t0).toBeGreaterThanOrEqual(spi.t1)
    const latch = cap.channel({ pin: 10, label: 'LATCH' }).trace
    expect(latch.levelAt((spi.t0 + spi.t1) / 2)).toBe(0) // selected while the byte is clocked
    expect(latch.levelAt(spi.t1 + 1)).toBe(1) // and latched right after
    b.dispose()
  })

  it('channels resolve to bus lines: a node wired to pin 1 shows the TX frames; the I2C lines carry rise delays', async () => {
    const { b, cap } = await bench()
    const rx = cap.channel({ node: 'ad_rx', label: 'RX' })
    expect(rx.kind).toBe('uart')
    expect(cap.channel({ pin: 18, label: 'SDA' }).kind).toBe('i2c')
    expect(cap.channel({ node: 'scl', label: 'SCL' }).riseUs).toBeCloseTo(1.204 * 4700 * 100e-12 * 1e6, 3)
    expect(cap.channel({ pin: 10, label: 'LATCH' }).trace.count).toBeGreaterThan(4)
    b.dispose()
  })

  it('47 kOhm pull-ups: t_r 3.98 us, the edges never reach V_IH within the 5 us half-period at 100 kHz, every address NACKs', async () => {
    const { b, cap } = await bench()
    b.dispatch('break:weak')
    await run(b, 0.4)
    expect(pub(b, 'i2c_tr') * 1e6).toBeCloseTo(3.98, 2)
    expect(pub(b, 'i2c_nacks')).toBeGreaterThan(3)
    const now = cap.now()
    expect(cap.decode('i2c', now - 100000, now).filter((f) => f.kind === 'byte' && f.value === 0x68)).toEqual([])
    expect(b.snapshot().serial.at(-1)).toBe('WHO_AM_I=0x0')
    b.dispatch('repair')
    await run(b, 0.4)
    expect(b.snapshot().serial.at(-1)).toBe('WHO_AM_I=0x68')
    b.dispose()
  })

  it('no pull-ups: SDA and SCL sit low, no START, every transaction fails', async () => {
    const { b, cap } = await bench()
    b.dispatch('break:nopull')
    await run(b, 0.4)
    const now = cap.now()
    const sda = cap.channel({ node: 'sda', label: 'SDA' }).trace
    expect(sda.levelAt(now)).toBe(0)
    expect(sda.lowerBound(now - 200000) === sda.count || sda.time(sda.count - 1) < now - 200000).toBe(true) // flat for the last 200 ms
    expect(cap.decode('i2c', now - 200000, now)).toEqual([])
    expect(pub(b, 'i2c_nacks')).toBeGreaterThan(3)
    expect(b.snapshot().elementV.c_sda).toBeLessThan(0.5)
    b.dispose()
  })

  it('analyzer at 9600 on a 115 200 line: garbage and framing errors, while I2C and SPI decode fine', async () => {
    const { b, cap } = await bench()
    b.dispatch('break:baud')
    await run(b, 0.5)
    expect(cap.baud()).toBe(9600)
    const now = cap.now()
    const uart = cap.decode('uart', now - 300000, now)
    expect(String.fromCharCode(...uart.map((f) => f.value!))).not.toContain('68')
    expect(pub(b, 'la_decode_errors')).toBeGreaterThan(0)
    // one 1.04 ms frame swallows about 12 bytes of the 115 200 line: far fewer bytes, all wrong
    expect(uart.length).toBeLessThan(300000 / 50000 * 15 / 4)
    expect(cap.decode('spi', now - 100000, now).map((f) => f.value)).toContain(0x0f)
    expect(cap.decode('i2c', now - 100000, now).some((f) => f.kind === 'byte' && f.value === 0x68)).toBe(true)
    b.dispose()
  })

  it('TX wired to the adapter TX: nothing arrives at its RX (flat HIGH), though pin 1 still sends', async () => {
    const { b, cap } = await bench()
    b.dispatch('break:swap')
    await run(b, 1.2)
    const now = cap.now()
    const rx = cap.channel({ node: 'ad_rx', label: 'RX' })
    expect(rx.kind).toBe('node')
    expect(rx.trace.levelAt(now)).toBe(1)
    expect(pub(b, 'uart_rx_rate')).toBe(0)
    expect(cap.decode('uart', now - 200000, now)).toEqual([])
    const tx = cap.channel({ pin: 1, label: 'TX' })
    expect(cap.decodeUartOn(tx.trace, now - 200000, now).length).toBeGreaterThan(3)
    b.dispose()
  })

  it('SPI mode 1 into the 595 (it samples on SCK rising): the bar is shifted one bit, the analyzer in mode 1 still reads 0x0F', async () => {
    const { b, cap } = await bench(SKETCH.replace('SPI_MODE0', 'SPI_MODE1'))
    expect(pub(b, 'spi_mode')).toBe(1)
    // after the first byte MOSI idles at the last bit (1): the 595 clocks in that 1, then b7..b1
    expect(b.snapshot().published['hc595.q']).toBe(0x87)
    const now = cap.now()
    expect(cap.decode('spi', now - 100000, now).map((f) => f.value)).toContain(0x0f)
    b.dispose()
  })
})
