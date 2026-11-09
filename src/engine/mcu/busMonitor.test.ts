// Bus monitors: the logic analyzer's view of Serial, Wire and SPI (additive hooks on VirtualMcu).
import { describe, expect, it } from 'vitest'
import type { BusEvent } from '../types'
import { VirtualMcu } from './index'

function make() {
  const lines: string[] = []
  const mcu = new VirtualMcu({ vcc: 5, board: 'uno', onPin: () => undefined, readAnalog: () => 0, readDigital: () => 0, serial: (l) => lines.push(l) })
  const evs: BusEvent[] = []
  mcu.addBusMonitor({ event: (e) => evs.push(structuredClone(e)) })
  return { mcu, evs, lines }
}

describe('VirtualMcu bus monitors', () => {
  it('Serial: each print reports its bytes at the begin() baud, println ends with CR LF', async () => {
    const { mcu, evs, lines } = make()
    mcu.load(`void setup() { Serial.begin(115200); Serial.print("Hi"); delay(2); Serial.println(66, HEX); } void loop() { delay(1000); }`)
    mcu.start()
    await mcu.advance(10)
    const u = evs.filter((e) => e.bus === 'uart')
    expect(u).toEqual([
      { bus: 'uart', t: 0, baud: 115200, bytes: [0x48, 0x69] },
      { bus: 'uart', t: 2000, baud: 115200, bytes: [0x34, 0x32, 0x0d, 0x0a] },
    ])
    expect(lines).toEqual(['Hi42'])
  })

  it('Wire: write and read transactions with address ACK, the stop flag and setClock', async () => {
    const { mcu, evs } = make()
    mcu.attachI2c(0x68, { write: () => undefined, read: (n) => [0x68, 0x01].slice(0, n) })
    mcu.load(`#include <Wire.h>
      void setup() {
        Wire.begin(); Wire.setClock(400000);
        Wire.beginTransmission(0x68); Wire.write(0x75); Serial.println(Wire.endTransmission(false));
        Wire.requestFrom(0x68, 1);
        Wire.beginTransmission(0x3C); Wire.write(1); Serial.println(Wire.endTransmission());
      }
      void loop() { delay(1000); }`)
    mcu.start()
    await mcu.advance(5)
    // after an address NACK the master sends STOP: the data bytes never go out
    const i = evs.filter((e) => e.bus === 'i2c')
    expect(i).toEqual([
      { bus: 'i2c', t: 0, clock: 400000, addr: 0x68, read: false, bytes: [0x75], addrAck: true, stop: false },
      { bus: 'i2c', t: 0, clock: 400000, addr: 0x68, read: true, bytes: [0x68], addrAck: true, stop: true },
      { bus: 'i2c', t: 0, clock: 400000, addr: 0x3c, read: false, bytes: [], addrAck: false, stop: true },
    ])
  })

  it('i2cOk false NACKs the address and keeps the device from seeing the transaction', async () => {
    const { mcu, evs, lines } = make()
    const seen: number[][] = []
    mcu.attachI2c(0x68, { write: (b) => seen.push(b), read: () => [1] })
    mcu.addBusMonitor({ i2cOk: () => false })
    mcu.load(`#include <Wire.h>
      void setup() { Wire.begin(); Wire.beginTransmission(0x68); Wire.write(0x6B); Wire.write(0); Serial.println(Wire.endTransmission()); Serial.println(Wire.requestFrom(0x68, 1)); }
      void loop() { delay(1000); }`)
    mcu.start()
    await mcu.advance(5)
    expect(lines).toEqual(['2', '0'])
    expect(seen).toEqual([])
    expect(evs.filter((e) => e.bus === 'i2c').map((e) => (e.bus === 'i2c' ? e.addrAck : null))).toEqual([false, false])
  })

  it('SPI: each byte with its settings and the byte shifted back', async () => {
    const { mcu, evs } = make()
    mcu.attachSpi(10, { transfer: (b) => b ^ 0xff })
    mcu.load(`#include <SPI.h>
      void setup() { pinMode(10, OUTPUT); SPI.begin(); SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE1));
        digitalWrite(10, LOW); SPI.transfer(0x0F); digitalWrite(10, HIGH); SPI.endTransaction(); }
      void loop() { delay(1000); }`)
    mcu.start()
    await mcu.advance(5)
    expect(evs.filter((e) => e.bus === 'spi')).toEqual([{ bus: 'spi', t: 0, clock: 1000000, mode: 1, bitOrder: 1, mosi: 0x0f, miso: 0xf0 }])
  })

  it('a removed monitor hears nothing; monitors survive start()', async () => {
    const { mcu, evs } = make()
    const other: BusEvent[] = []
    const m = { event: (e: BusEvent) => other.push(e) }
    mcu.addBusMonitor(m)
    mcu.removeBusMonitor(m)
    mcu.load(`void setup() { Serial.begin(9600); Serial.write(65); } void loop() { delay(1000); }`)
    mcu.start()
    await mcu.advance(1)
    mcu.start()
    await mcu.advance(1)
    expect(other).toEqual([])
    expect(evs.filter((e) => e.bus === 'uart').length).toBe(2)
  })
})
