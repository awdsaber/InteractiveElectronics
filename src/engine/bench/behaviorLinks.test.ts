// M2 (mpu6050-imu): the small additive engine hooks a sensor behavior needs.
//  - I2cDevice.ack(): a device that is attached but does not answer (wrong address, dead bus) NACKs
//  - BehaviorContext.read(key): one behavior reads another's published value (capstone: robot pitch → IMU)
//  - failure `set` patches on `behavior:<instance>` override that instance's param while active
import { describe, expect, it } from 'vitest'
import { lesson as ledResistor } from '../../lessons/T2/led-resistor'
import { validateLesson } from '../lessonSchema'
import { VirtualMcu } from '../mcu'
import type { Behavior, Lesson } from '../types'
import { createBench } from './simLoop'

const FRAME = 1 / 60

describe('I2cDevice.ack', () => {
  it('a device whose ack() is false NACKs the address and returns no bytes', async () => {
    const lines: string[] = []
    let answer = false
    const mcu = new VirtualMcu({
      vcc: 5,
      onPin: () => undefined,
      readAnalog: () => 0,
      readDigital: () => 0,
      serial: (l) => lines.push(l),
      warn: () => undefined,
    })
    mcu.attachI2c(0x68, { ack: () => answer, write: () => undefined, read: (n: number) => Array(n).fill(0x68) })
    mcu.load(`#include <Wire.h>
      void probe() {
        Wire.beginTransmission(0x68); Wire.write(0x75);
        int e = Wire.endTransmission();
        int n = Wire.requestFrom(0x68, 1);
        Serial.print(e); Serial.print(" "); Serial.println(n);
      }
      void setup() { probe(); delay(10); probe(); }`)
    mcu.start()
    await mcu.advance(5)
    answer = true
    await mcu.advance(10)
    expect(lines).toEqual(['2 0', '0 1'])
  })
})

const writer: Behavior = {
  id: 'writer',
  tick(ctx) {
    ctx.publish('angle', 12.5)
  },
}
const reader: Behavior = {
  id: 'reader',
  tick(ctx) {
    ctx.publish('seen', ctx.read?.('writer.angle') ?? -1)
    const k = ctx.params.k
    ctx.publish('k', typeof k === 'number' ? k : -1)
  },
}

function lessonWith(): Lesson {
  return {
    ...ledResistor,
    fig: 1,
    behaviors: ['writer', { id: 'reader', params: { k: 1 } }],
    tweaks: [{ label: 'k', elementId: 'behavior:reader', key: 'k', min: 0, max: 10, unit: '' }],
    failures: [
      ...ledResistor.failures,
      { id: 'k9', label: 'k = 9', explain: 'k is forced.', patches: [{ op: 'set', elementId: 'behavior:reader', key: 'k', value: 9 }] },
    ],
    readouts: [...ledResistor.readouts, { label: 'K', source: { kind: 'behavior', key: 'reader.k' }, unit: '' }],
  }
}

describe('behavior links', () => {
  it('ctx.read returns another instance’s published value', async () => {
    const b = createBench(lessonWith(), { registry: { writer, reader } })
    b.dispatch('power')
    await b.frame(FRAME)
    await b.frame(FRAME)
    expect(b.snapshot().published['reader.seen']).toBe(12.5)
  })

  it('ctx.read sees exactly one tick of lag, whatever the behavior order', async () => {
    const counts = new WeakMap<object, number>()
    const counter: Behavior = {
      id: 'counter',
      tick(ctx) {
        const n = (counts.get(ctx) ?? 0) + 1
        counts.set(ctx, n)
        ctx.publish('n', n)
      },
    }
    const watcher: Behavior = {
      id: 'watcher',
      tick(ctx) {
        ctx.publish('seen', ctx.read?.('counter.n') ?? 0)
      },
    }
    for (const order of [['counter', 'watcher'], ['watcher', 'counter']]) {
      const b = createBench({ ...lessonWith(), behaviors: order, tweaks: [], failures: ledResistor.failures, readouts: ledResistor.readouts }, { registry: { counter, watcher } })
      b.dispatch('power')
      for (let i = 0; i < 5; i++) await b.frame(FRAME)
      const p = b.snapshot().published
      expect(p['counter.n']).toBe(5)
      expect(p['watcher.seen']).toBe(4)
    }
  })

  it('a failure set patch on behavior:<instance> overrides the param until repaired, then the tweak value returns', async () => {
    const l = lessonWith()
    expect(validateLesson(l, { writer, reader })).toEqual([])
    const b = createBench(l, { registry: { writer, reader } })
    b.dispatch('power')
    b.setTweak('behavior:reader.k', 3)
    await b.frame(FRAME)
    expect(b.snapshot().published['reader.k']).toBe(3)
    b.dispatch('break:k9')
    await b.frame(FRAME)
    expect(b.snapshot().published['reader.k']).toBe(9)
    b.setTweak('behavior:reader.k', 4) // the failure still wins
    await b.frame(FRAME)
    expect(b.snapshot().published['reader.k']).toBe(9)
    b.dispatch('repair')
    await b.frame(FRAME)
    expect(b.snapshot().published['reader.k']).toBe(4)
  })

  it('validateLesson rejects a behavior patch naming an unknown instance', () => {
    const l = lessonWith()
    l.failures = [{ id: 'bad', label: 'bad', explain: 'x', patches: [{ op: 'set', elementId: 'behavior:nope', key: 'k', value: 1 }] }]
    expect(validateLesson(l, { writer, reader }).join(' ')).toMatch(/no behavior instance "nope"/)
  })
})
