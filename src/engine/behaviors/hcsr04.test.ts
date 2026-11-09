import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../bench/simLoop'
import type { BehaviorRef, Lesson } from '../types'
import { behavior as hcsr04, soundSpeed } from './hcsr04'

const FRAME = 1 / 60
const DT = 0.0001

type Params = Record<string, number | string | boolean>

/** a minimal Uno + HC-SR04 bench: TRIG on pin 9, ECHO through a wire into pin 10 */
function fixture(code: string, params: Params = {}): Lesson {
  const behaviors: BehaviorRef[] = [{ id: 'hcsr04', instance: 'us', params: { noiseCm: 0, ...params } }]
  return {
    id: 'us-fixture',
    fig: 1,
    track: 'T6',
    title: 'US fixture',
    subtitle: 'test',
    tagline: 'test',
    board: { name: 'FX', size: [8, 4], base: 'breadboard-only', parts: [{ id: 'uno', kind: 'module', pos: [0, 0], mount: 'module', role: 'board' }] },
    circuit: {
      elements: [
        { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5, rInternal: 0.3 },
        { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', '5v'], closed: true },
        { id: 'i_board', type: 'I', nodes: ['5v', '0'], value: 0.045 },
        { id: 'pin9', type: 'PIN', nodes: ['d9', '0'], pin: 9, vcc: 5 },
        { id: 'echo_src', type: 'V', nodes: ['echo_out', '0'], value: 0, rInternal: 100 },
        { id: 'w_echo', type: 'R', nodes: ['echo_out', 'd10'], value: 0.01 },
        { id: 'pin10', type: 'PIN', nodes: ['d10', '0'], pin: 10, vcc: 5 },
        { id: 'trig_mon', type: 'V', nodes: ['trig_mon', '0'], value: 0 },
      ],
    },
    powerElementId: 'usb_plug',
    readouts: [{ label: 'ECHO', source: { kind: 'voltage', node: 'd10' }, unit: 'V' }],
    sketch: { title: 'fx', code, pins: { 9: 'pin9', 10: 'pin10' }, vcc: 5, board: 'uno' },
    tweaks: [],
    failures: [{ id: 'echo-off', label: 'ECHO wire off', explain: 'x', patches: [{ op: 'remove', elementId: 'w_echo' }] }],
    meet: 'm',
    mechanicalAnalogy: 'm',
    proTips: [],
    quiz: [],
    behaviors,
    transient: true,
    sim: { dt: DT, speed: 0.25 },
  }
}

function bench(code: string, params: Params = {}): Bench {
  const b = createBench(fixture(code, params), { registry: { hcsr04 } })
  b.dispatch('power')
  b.upload()
  return b
}

async function run(b: Bench, seconds: number, each?: (s: BenchSnapshot) => void): Promise<BenchSnapshot> {
  const end = b.t + seconds
  while (b.t < end - 1e-9) {
    await b.frame(FRAME)
    each?.(b.snapshot())
  }
  return b.snapshot()
}

/** run until the sketch has printed n lines (or give up after maxS sim seconds) */
async function lines(b: Bench, n: number, maxS = 30): Promise<string[]> {
  const end = b.t + maxS
  while (b.t < end && b.snapshot().serial.filter((l) => l !== '').length < n) await b.frame(FRAME)
  return b.snapshot().serial.filter((l) => l !== '')
}

const PING = `unsigned long ping(unsigned long to) {
  digitalWrite(9, LOW); delayMicroseconds(2);
  digitalWrite(9, HIGH); delayMicroseconds(10);
  digitalWrite(9, LOW);
  return pulseIn(10, HIGH, to);
}`
const ONCE = (to: string) => `${PING}
void setup() { pinMode(9, OUTPUT); pinMode(10, INPUT); Serial.begin(115200); Serial.println(ping(${to})); }
void loop() { delay(1000); }`
const MANY = `${PING}
void setup() { pinMode(9, OUTPUT); pinMode(10, INPUT); Serial.begin(115200); }
void loop() { Serial.println(ping(30000)); delay(60); }`

const within = (v: number, want: number, rel: number) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * rel)

describe('hcsr04: echo width = 2d/c', () => {
  it('soundSpeed is 331.3 + 0.606 T', () => {
    expect(soundSpeed(20)).toBeCloseTo(343.42, 2)
    expect(soundSpeed(0)).toBeCloseTo(331.3, 2)
    expect(soundSpeed(40)).toBeCloseTo(355.54, 2)
  })

  for (const [cm, tc] of [
    [10, 20],
    [50, 20],
    [100, 20],
    [100, 0],
    [200, 40],
    [300, -10],
    [400, 20],
  ] as const) {
    it(`${cm} cm at ${tc} °C: pulseIn width within 1 % of 2d/c, and the published echo_us/c_mps agree`, async () => {
      const b = bench(ONCE('60000'), { distanceCm: cm, airTempC: tc })
      const out = await lines(b, 1)
      const want = ((2 * cm) / 100 / soundSpeed(tc)) * 1e6
      within(Number(out[0]), want, 0.01)
      const s = await run(b, 0.05)
      within(s.published['us.echo_us'], want, 0.01)
      expect(s.published['us.c_mps']).toBeCloseTo(soundSpeed(tc), 6)
      expect(s.published['us.true_cm']).toBe(cm)
      b.dispose()
    })
  }

  it('the curriculum rule of thumb: 20 cm at 20 °C is a 1166 us echo', async () => {
    const b = bench(ONCE('60000'), { distanceCm: 20, airTempC: 20 })
    const out = await lines(b, 1)
    within(Number(out[0]), 1166, 0.005)
    b.dispose()
  })

  it('a sketch computing cm from the width with the right temperature lands within 1 cm', async () => {
    const code = `${PING}
void setup() { pinMode(9, OUTPUT); pinMode(10, INPUT); Serial.begin(115200);
  unsigned long us = ping(30000);
  float c = 331.3 + 0.606 * 20.0;
  Serial.println(us * c / 20000.0); }
void loop() { delay(1000); }`
    for (const cm of [30, 100, 250]) {
      const b = bench(code, { distanceCm: cm, airTempC: 20 })
      const out = await lines(b, 1)
      expect(Math.abs(Number(out[0]) - cm)).toBeLessThanOrEqual(1)
      b.dispose()
    }
  })

  it('assuming 20 °C on a 0 °C day reads 3.6 % long (103.6 cm at 100 cm), within 1 cm', async () => {
    const code = `${PING}
void setup() { pinMode(9, OUTPUT); pinMode(10, INPUT); Serial.begin(115200);
  unsigned long us = ping(30000);
  Serial.println(us * (331.3 + 0.606 * 20.0) / 20000.0); }
void loop() { delay(1000); }`
    const b = bench(code, { distanceCm: 100, airTempC: 0 })
    const out = await lines(b, 1)
    expect(Math.abs(Number(out[0]) - 103.6)).toBeLessThanOrEqual(1)
    b.dispose()
  })

  it('noise: the 1-sigma spread of the width follows noiseCm (1 cm of range = 58 us)', async () => {
    const b = bench(MANY, { distanceCm: 100, noiseCm: 1 })
    const out = (await lines(b, 40)).map(Number)
    const m = out.reduce((a, x) => a + x, 0) / out.length
    const sd = Math.sqrt(out.reduce((a, x) => a + (x - m) ** 2, 0) / out.length)
    expect(sd).toBeGreaterThan(30)
    expect(sd).toBeLessThan(120)
    b.dispose()
  })
})

describe('hcsr04: trigger rules', () => {
  it('a 5 us trigger pulse is ignored (needs 10 us)', async () => {
    const code = `void setup() { pinMode(9, OUTPUT); pinMode(10, INPUT); Serial.begin(115200);
  digitalWrite(9, HIGH); delayMicroseconds(5); digitalWrite(9, LOW);
  Serial.println(pulseIn(10, HIGH, 40000)); }
void loop() { delay(1000); }`
    const b = bench(code, { distanceCm: 100 })
    expect((await lines(b, 1))[0]).toBe('0')
    expect(b.snapshot().published['us.pings']).toBe(0)
    b.dispose()
  })

  it('a ping sooner than 20 ms after the last is ignored, and the count shows it', async () => {
    const code = `${PING}
void setup() { pinMode(9, OUTPUT); pinMode(10, INPUT); Serial.begin(115200);
  Serial.println(ping(30000)); delay(5); Serial.println(ping(30000)); }
void loop() { delay(1000); }`
    const b = bench(code, { distanceCm: 100 })
    const out = await lines(b, 2)
    expect(Number(out[0])).toBeGreaterThan(5000)
    expect(out[1]).toBe('0')
    expect(b.snapshot().published['us.pings']).toBe(1)
    expect(b.snapshot().published['us.pings_ignored']).toBe(1)
    b.dispose()
  })

  it('publishes the setup before the sketch pings', async () => {
    const b = bench(`void setup() { pinMode(9, OUTPUT); } void loop() { delay(10); }`, { distanceCm: 123 })
    await run(b, 0.2)
    const s = b.snapshot()
    expect(s.published['us.true_cm']).toBe(123)
    expect(s.published['us.pings']).toBe(0)
    b.dispose()
  })
})

describe('hcsr04: pulseIn timeout and the echo wire', () => {
  it('out of range (450 cm): ECHO stays high for the 38 ms timeout; pulseIn(30 ms) returns 0, a longer timeout returns 38000', async () => {
    const a = bench(ONCE('30000'), { distanceCm: 450 })
    expect((await lines(a, 1))[0]).toBe('0')
    a.dispose()
    const b = bench(ONCE('60000'), { distanceCm: 450 })
    within(Number((await lines(b, 1))[0]), 38000, 0.01)
    b.dispose()
  })

  it('a target closer than 2 cm gives no echo either', async () => {
    const b = bench(ONCE('60000'), { distanceCm: 1 })
    within(Number((await lines(b, 1))[0]), 38000, 0.01)
    expect(b.snapshot().published['us.pings_lost']).toBe(1)
    b.dispose()
  })

  it('ECHO wire off: pulseIn waits out its whole 30 ms timeout and returns 0', async () => {
    const code = `${PING}
void setup() { pinMode(9, OUTPUT); pinMode(10, INPUT); Serial.begin(115200);
  unsigned long t0 = micros(); unsigned long us = ping(30000); Serial.println(us); Serial.println(micros() - t0); }
void loop() { delay(1000); }`
    const b = createBench(fixture(code, { distanceCm: 100 }), { registry: { hcsr04 } })
    b.dispatch('power')
    b.dispatch('break:echo-off')
    b.upload()
    const out = await lines(b, 2)
    expect(out[0]).toBe('0')
    within(Number(out[1]), 30000 + 12, 0.01)
    b.dispose()
  })

  it('with no timeout the call blocks for the default 1 s when the wire is off (the sketch hangs)', async () => {
    const code = `unsigned long hang() {
  digitalWrite(9, LOW); delayMicroseconds(2);
  digitalWrite(9, HIGH); delayMicroseconds(10);
  digitalWrite(9, LOW);
  return pulseIn(10, HIGH);
}
void setup() { pinMode(9, OUTPUT); pinMode(10, INPUT); Serial.begin(115200);
  unsigned long t0 = micros(); unsigned long us = hang(); Serial.println(us); Serial.println((micros() - t0) / 1000); }
void loop() { delay(1000); }`
    const b = createBench(fixture(code, { distanceCm: 100 }), { registry: { hcsr04 } })
    b.dispatch('power')
    b.dispatch('break:echo-off')
    b.upload()
    const out = await lines(b, 2, 60)
    expect(out[0]).toBe('0')
    within(Number(out[1]), 1000, 0.01)
    b.dispose()
  })
})

describe('hcsr04: surface loss', () => {
  async function lostFraction(surface: number | string, n = 120): Promise<number> {
    const b = bench(MANY, { distanceCm: 80, surface })
    const out = await lines(b, n, 90)
    b.dispose()
    return out.filter((l) => l === '0').length / out.length
  }
  it('hard: nothing is lost', async () => {
    expect(await lostFraction('hard', 30)).toBe(0)
    expect(await lostFraction(0, 30)).toBe(0)
  })
  it('soft (1) loses about 85 % of pings', async () => {
    const f = await lostFraction(1)
    expect(f).toBeGreaterThan(0.75)
    expect(f).toBeLessThan(0.95)
  })
  it('angled loses more than 70 % of pings', async () => {
    const f = await lostFraction('angled')
    expect(f).toBeGreaterThan(0.7)
    expect(f).toBeLessThan(0.9)
  })
  it('an explicit lossPct overrides the surface', async () => {
    const b = bench(MANY, { distanceCm: 80, surface: 'hard', lossPct: 100 })
    const out = await lines(b, 10)
    expect(out.every((l) => l === '0')).toBe(true)
    b.dispose()
  })
})

describe('hcsr04: crosstalk from a second sensor', () => {
  it('about 30 % of pings come back short and random, the rest are exact', async () => {
    const b = bench(MANY, { distanceCm: 200, otherSensor: true })
    const out = (await lines(b, 120, 90)).map(Number)
    const want = ((2 * 200) / 100 / soundSpeed(20)) * 1e6
    const short = out.filter((w) => w < want * 0.99 && w > 0).length
    const exact = out.filter((w) => Math.abs(w - want) < want * 0.01).length
    expect(short / out.length).toBeGreaterThan(0.18)
    expect(short / out.length).toBeLessThan(0.42)
    expect(short + exact).toBe(out.length)
    expect(b.snapshot().published['us.strays']).toBeGreaterThan(0)
    b.dispose()
  })
})

describe('hcsr04: waveform for the scope', () => {
  it('ECHO rises to 5 V for the echo width, preceded by the TRIG marker', async () => {
    const b = bench(MANY, { distanceCm: 100 })
    b.setScope([
      { kind: 'voltage', node: 'trig_mon' },
      { kind: 'voltage', node: 'd10' },
    ])
    await run(b, 0.12)
    const n = b.scope.count
    let e0 = -1
    let e1 = -1
    let t0 = -1
    for (let k = 0; k < n; k++) {
      if (t0 < 0 && b.scope.value(0, k) > 4) t0 = b.scope.time(k)
      if (e0 < 0 && b.scope.value(1, k) > 4) e0 = b.scope.time(k)
      if (e0 >= 0 && e1 < 0 && b.scope.value(1, k) < 1) e1 = b.scope.time(k)
    }
    expect(t0).toBeGreaterThan(0)
    expect(e0).toBeGreaterThan(t0)
    const widthUs = (e1 - e0) * 1e6
    const want = ((2 * 100) / 100 / soundSpeed(20)) * 1e6
    expect(Math.abs(widthUs - want)).toBeLessThanOrEqual(4 * DT * 1e6)
    // the marker leads the echo by about the module's 0.5 ms burst-and-processing delay
    expect((e0 - t0) * 1e6).toBeGreaterThan(300)
    expect((e0 - t0) * 1e6).toBeLessThan(900)
    b.dispose()
  })
})

describe('hcsr04: lifecycle', () => {
  it('re-uploading forgets the busy window so the first ping answers', async () => {
    const b = bench(ONCE('60000'), { distanceCm: 100 })
    await lines(b, 1)
    b.upload()
    await run(b, 0.1)
    const out = await lines(b, 1)
    expect(Number(out.at(-1))).toBeGreaterThan(5000)
    b.dispose()
  })
})
