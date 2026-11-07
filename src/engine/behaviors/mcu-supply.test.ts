import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../bench/simLoop'
import type { BehaviorRef, Lesson } from '../types'
import { behavior, fMaxAt, minVccFor } from './mcu-supply'

describe('ATmega328P speed grade (datasheet safe operating area)', () => {
  it('allows 4 MHz at 1.8 V, 10 MHz at 2.7 V and 20 MHz at 4.5 V, linear in between', () => {
    expect(fMaxAt(1.8)).toBeCloseTo(4, 6)
    expect(fMaxAt(2.7)).toBeCloseTo(10, 6)
    expect(fMaxAt(3.6)).toBeCloseTo(15, 6)
    expect(fMaxAt(4.5)).toBeCloseTo(20, 6)
    expect(fMaxAt(5.5)).toBe(20)
    expect(fMaxAt(1.0)).toBe(0)
  })

  it('needs about 3.78 V for 16 MHz', () => {
    expect(minVccFor(16)).toBeCloseTo(3.78, 2)
    expect(minVccFor(8)).toBeCloseTo(2.4, 2)
    expect(fMaxAt(minVccFor(12))).toBeCloseTo(12, 6)
  })
})

const SKETCH = `void setup() {
  Serial.begin(9600);
  Serial.println("boot");
  pinMode(13, OUTPUT);
}
void loop() {
  digitalWrite(13, HIGH);
  delay(10);
}
`

function supplyLesson(ref: BehaviorRef = { id: 'mcu-supply', instance: 'mcu' }): Lesson {
  return {
    id: 'supply',
    fig: 1,
    track: 'T4',
    title: 'Supply',
    subtitle: '',
    tagline: '',
    board: { name: 'S', size: [4, 4], parts: [{ id: 'r', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['R1'] }] },
    circuit: {
      elements: [
        { id: 'VS', type: 'V', nodes: ['5v', '0'], value: 5, rInternal: 0.1 },
        { id: 'PIN13', type: 'PIN', nodes: ['d13', '0'], pin: 13, vcc: 5, vccNode: '5v' },
        { id: 'R1', type: 'R', nodes: ['d13', '0'], value: 1000 },
      ],
    },
    powerElementId: 'VS',
    readouts: [
      { label: 'VCC', source: { kind: 'behavior', key: 'mcu.vcc' }, unit: 'V' },
      { label: 'PIN 13', source: { kind: 'voltage', node: 'd13' }, unit: 'V' },
    ],
    tweaks: [{ label: 'Supply', elementId: 'VS', key: 'value', min: 0, max: 6, unit: 'V' }],
    sketch: { title: 'Boot', code: SKETCH, pins: { 13: 'PIN13' }, vcc: 5, board: 'uno' },
    failures: [{ id: 'sag', label: 'Sag', explain: 'The rail sags to 2 V.', patches: [{ op: 'set', elementId: 'VS', key: 'value', value: 2 }] }],
    meet: '',
    mechanicalAnalogy: '',
    proTips: [],
    quiz: [],
    behaviors: [ref],
  }
}

const frames = async (b: Bench, n: number) => {
  for (let i = 0; i < n; i++) await b.frame(1 / 60)
}
const pub = (b: Bench, k: string) => b.snapshot().published[`mcu.${k}`]
const boots = (b: Bench) => b.snapshot().serial.filter((l) => l === 'boot').length

function running(lesson = supplyLesson()) {
  const b = createBench(lesson, { registry: { 'mcu-supply': behavior } })
  b.dispatch('power')
  b.upload()
  return b
}

describe('mcu-supply behavior', () => {
  it('publishes vcc, no warning and no resets on a healthy 5 V rail', async () => {
    const b = running()
    await frames(b, 10)
    expect(pub(b, 'vcc')).toBeCloseTo(5, 2)
    expect(pub(b, 'warn')).toBe(0)
    expect(pub(b, 'held')).toBe(0)
    expect(pub(b, 'resets')).toBe(0)
    expect(pub(b, 'fmax')).toBe(20)
    expect(b.snapshot().pins[13]).toMatchObject({ mode: 'OUTPUT', level: 1 })
    b.dispose()
  })

  it('warns between the 2.7 V brown-out level and the 3.78 V needed for 16 MHz, but keeps running', async () => {
    const b = running()
    await frames(b, 5)
    b.setTweak('VS.value', 3.3)
    await frames(b, 5)
    expect(pub(b, 'vcc')).toBeCloseTo(3.3, 2)
    expect(pub(b, 'warn')).toBe(1)
    expect(pub(b, 'held')).toBe(0)
    expect(pub(b, 'fmax')).toBeCloseTo(13.33, 1)
    expect(b.snapshot().pins[13]).toMatchObject({ mode: 'OUTPUT', level: 1 })
    expect(b.snapshot().values[1]).toBeCloseTo((3.3 * 1000) / 1025, 2) // the pin's HIGH follows its rail (25 Ω into 1 kΩ)
    b.dispose()
  })

  it('holds the MCU in reset below 2.7 V (pins float), then restarts it from setup() when the rail returns', async () => {
    const b = running()
    await frames(b, 10)
    expect(boots(b)).toBe(1)
    b.setTweak('VS.value', 2.0)
    await frames(b, 5)
    expect(pub(b, 'held')).toBe(1)
    expect(pub(b, 'resets')).toBe(1)
    expect(b.snapshot().pins[13].mode).toBe('INPUT')
    expect(b.events().some((e) => e.channel === 'mcu' && e.kind === 'brown-out')).toBe(true)
    // staying low is still one reset
    await frames(b, 10)
    expect(pub(b, 'resets')).toBe(1)
    b.setTweak('VS.value', 5)
    await frames(b, 10)
    expect(pub(b, 'held')).toBe(0)
    expect(b.snapshot().pins[13]).toMatchObject({ mode: 'OUTPUT', level: 1 })
    expect(boots(b)).toBe(1) // the serial log restarts with the sketch: one fresh "boot"
    expect(b.snapshot().serial[0]).toBe('boot')
    expect(b.events().some((e) => e.channel === 'mcu' && e.kind === 'reset')).toBe(true)
    b.dispose()
  })

  it('an upload during a brown-out keeps the MCU held and counts no second reset', async () => {
    const b = running()
    await frames(b, 5)
    b.setTweak('VS.value', 2.0)
    await frames(b, 3)
    expect(pub(b, 'resets')).toBe(1)
    b.upload()
    await frames(b, 5)
    expect(pub(b, 'held')).toBe(1)
    expect(pub(b, 'resets')).toBe(1)
    expect(b.snapshot().pins[13]?.mode ?? 'INPUT').toBe('INPUT')
    b.setTweak('VS.value', 5)
    await frames(b, 10)
    expect(pub(b, 'held')).toBe(0)
    expect(b.snapshot().pins[13]).toMatchObject({ mode: 'OUTPUT', level: 1 })
    b.dispose()
  })

  it('uses hysteresis: a rail hovering just above 2.7 V does not release a held MCU', async () => {
    const b = running()
    await frames(b, 5)
    b.setTweak('VS.value', 2.5)
    await frames(b, 3)
    b.setTweak('VS.value', 2.72)
    await frames(b, 3)
    expect(pub(b, 'held')).toBe(1)
    b.setTweak('VS.value', 2.9)
    await frames(b, 3)
    expect(pub(b, 'held')).toBe(0)
    b.dispose()
  })

  it('Repair all on a browned-out board releases the MCU and boots the sketch again', async () => {
    const b = running()
    await frames(b, 5)
    b.dispatch('break:sag')
    await frames(b, 5)
    expect(pub(b, 'held')).toBe(1)
    b.dispatch('repair')
    await frames(b, 10)
    expect(b.snapshot().status).toBe('RUNNING')
    expect(b.snapshot().pins[13]).toMatchObject({ mode: 'OUTPUT', level: 1 })
    expect(pub(b, 'held')).toBe(0)
    expect(pub(b, 'resets')).toBe(0) // reset() forgets the count
    b.dispose()
  })

  it('takes the threshold, clock and supply node from params', async () => {
    // an 8 MHz board with the 1.8 V brown-out fuse: 2.5 V is above both 1.8 V and the 2.4 V that 8 MHz needs
    const b = running(supplyLesson({ id: 'mcu-supply', instance: 'mcu', params: { fClk: 8, bor: 1.8 } }))
    b.setTweak('VS.value', 2.5)
    await frames(b, 5)
    expect(pub(b, 'warn')).toBe(0)
    expect(pub(b, 'held')).toBe(0)
    expect(b.snapshot().pins[13]).toMatchObject({ mode: 'OUTPUT', level: 1 })
    b.dispose()
    // a supply node the netlist doesn't have is ignored, not read as 0 V (which would hold the MCU forever)
    const c = running(supplyLesson({ id: 'mcu-supply', instance: 'mcu', params: { supplyNode: 'nowhere' } }))
    await frames(c, 5)
    expect(pub(c, 'held')).toBeUndefined()
    expect(c.snapshot().pins[13]).toMatchObject({ mode: 'OUTPUT', level: 1 })
    c.dispose()
  })

  it('a power cycle starts over: no held state carried into the next run', async () => {
    const b = running()
    await frames(b, 5)
    b.setTweak('VS.value', 2.0)
    await frames(b, 3)
    b.dispatch('power') // off
    b.setTweak('VS.value', 5)
    b.dispatch('power')
    b.upload()
    await frames(b, 10)
    expect(pub(b, 'held')).toBe(0)
    expect(b.snapshot().pins[13]).toMatchObject({ mode: 'OUTPUT', level: 1 })
    expect(boots(b)).toBe(1)
    b.dispose()
  })
})
