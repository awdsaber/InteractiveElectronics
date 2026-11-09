import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { behavior } from './pid-tune'
import { behavior as plotter } from './serial-plotter'

// The sketch prints what Tune hands it each loop, so the test sees exactly what the sketch reads.
const SKETCH = `void setup() {
  Serial.begin(115200);
}
void loop() {
  float kp = Tune.kp();
  float ki = Tune.ki();
  float kd = Tune.kd();
  int ms = Tune.periodMs();
  int aw = Tune.antiWindup();
  Serial.print("kp:");
  Serial.print(kp);
  Serial.print(",ki:");
  Serial.print(ki);
  Serial.print(",kd:");
  Serial.print(kd, 4);
  Serial.print(",ms:");
  Serial.print(ms);
  Serial.print(",aw:");
  Serial.println(aw);
  delay(20);
}
`

const lesson: Lesson = {
  id: 'tune',
  fig: 1,
  track: 'T7',
  title: 'Tune',
  subtitle: '',
  tagline: '',
  board: { name: 'T', size: [4, 4], parts: [{ id: 'uno', kind: 'module', pos: [0, 0], mount: 'module', role: 'u', circuitIds: ['V1'] }] },
  circuit: { elements: [{ id: 'V1', type: 'V', nodes: ['5v', '0'], value: 5 }, { id: 'R1', type: 'R', nodes: ['5v', '0'], value: 1000 }] },
  powerElementId: 'V1',
  readouts: [
    { label: 'KP', source: { kind: 'behavior', key: 'serial.kp' }, unit: '' },
    { label: 'KI', source: { kind: 'behavior', key: 'serial.ki' }, unit: '' },
    { label: 'KD', source: { kind: 'behavior', key: 'serial.kd' }, unit: '' },
    { label: 'MS', source: { kind: 'behavior', key: 'serial.ms' }, unit: '' },
    { label: 'AW', source: { kind: 'behavior', key: 'serial.aw' }, unit: '' },
  ],
  sketch: { title: 't', code: SKETCH, pins: {}, vcc: 5, board: 'uno' },
  tweaks: [
    { label: 'Kp', elementId: 'behavior:tune', key: 'kp', min: 0, max: 10, step: 0.05, unit: '' },
    { label: 'Ki', elementId: 'behavior:tune', key: 'ki', min: 0, max: 60, step: 0.5, unit: '' },
  ],
  failures: [{ id: 'hot', label: 'Hot', explain: 'x', patches: [{ op: 'set', elementId: 'behavior:tune', key: 'kp', value: 9 }, { op: 'set', elementId: 'behavior:tune', key: 'periodMs', value: 100 }] }],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  behaviors: [{ id: 'pid-tune', instance: 'tune', params: { kp: 0.4, ki: 8.7, kd: 0.002, periodMs: 10, antiWindup: 1 } }, { id: 'serial-plotter', instance: 'serial' }],
}

const REG = { 'pid-tune': behavior, 'serial-plotter': plotter }

async function run(b: ReturnType<typeof createBench>, s: number) {
  const t1 = b.t + s
  while (b.t < t1 - 1e-9) await b.frame(1 / 60)
}

describe('pid-tune behavior', () => {
  it('hands the sketch its gains, loop period and anti-windup switch as Tune.* calls', async () => {
    const b = createBench(lesson, { registry: REG })
    b.dispatch('power')
    b.upload()
    await run(b, 0.2)
    const v = b.snapshot().values
    expect(v[0]).toBeCloseTo(0.4, 6)
    expect(v[1]).toBeCloseTo(8.7, 6)
    expect(v[2]).toBeCloseTo(0.002, 6)
    expect(v[3]).toBe(10)
    expect(v[4]).toBe(1)
    expect(b.snapshot().published['tune.loop_hz']).toBeCloseTo(100, 6)
    b.dispose()
  })

  it('a slider changes the gain the running sketch reads, with no re-upload', async () => {
    const b = createBench(lesson, { registry: REG })
    b.dispatch('power')
    b.upload()
    await run(b, 0.1)
    b.setTweak('behavior:tune.kp', 2.5)
    await run(b, 0.1)
    expect(b.snapshot().values[0]).toBeCloseTo(2.5, 6)
    b.dispose()
  })

  it('a failure overrides the values while it is active, and repair hands back the slider values', async () => {
    const b = createBench(lesson, { registry: REG })
    b.dispatch('power')
    b.upload()
    await run(b, 0.1)
    b.dispatch('break:hot')
    await run(b, 0.1)
    expect(b.snapshot().values[0]).toBeCloseTo(9, 6)
    expect(b.snapshot().values[3]).toBe(100)
    b.dispatch('repair')
    await run(b, 0.1)
    expect(b.snapshot().values[0]).toBeCloseTo(0.4, 6)
    expect(b.snapshot().values[3]).toBe(10)
    b.dispose()
  })

  it('clamps: gains are never negative, the period is 1..1000 ms', async () => {
    const b = createBench(lesson, { registry: REG })
    b.setTweak('behavior:tune.kp', -3)
    b.setTweak('behavior:tune.periodMs', 0)
    b.dispatch('power')
    b.upload()
    await run(b, 0.1)
    expect(b.snapshot().values[0]).toBe(0)
    expect(b.snapshot().values[3]).toBe(1)
    b.dispose()
  })
})
