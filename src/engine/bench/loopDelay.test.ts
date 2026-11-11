// End-to-end loop delay on the bench: motor shaft → quad-encoder edge → MCU ISR → sketch → analogWrite
// → TB6612 → the voltage the motor sees. The PID lesson's circuit runs a test sketch that cuts the PWM
// the moment its ×4 count reaches N; a probe behavior integrates the motor's true ω every step to find
// when the shaft actually got there, and watches the bridge output. The difference is the loop's
// transport delay (plus the sketch's own sampling, when it reacts in a fixed-rate loop).
import { describe, expect, it } from 'vitest'
import { registry } from '../behaviors'
import type { Behavior, Lesson } from '../types'
import { getLesson } from '../../lessons'
import { createBench } from './simLoop'

const PID = getLesson('pid-motor-control') as Lesson
/** counts at steady speed (≈ 0.55 s), and early in the start-up ramp, while ω is still rising fast */
const N = 1500
const N_RAMP = 60
const EDGES_PER_REV = 4 * 11

const head = `#define ENC_A 2
#define ENC_B 3
const int QEM[16] = {0, -1, 1, 0,  1, 0, 0, -1,  -1, 0, 0, 1,  0, 1, -1, 0};
volatile long count = 0;
volatile int lastState = 0;
volatile int fired = 0;
void start() {
  pinMode(ENC_A, INPUT);
  pinMode(ENC_B, INPUT);
  pinMode(5, OUTPUT); pinMode(7, OUTPUT); pinMode(8, OUTPUT); pinMode(4, OUTPUT);
  digitalWrite(4, HIGH); digitalWrite(7, HIGH); digitalWrite(8, LOW);
  lastState = (digitalRead(ENC_A) << 1) | digitalRead(ENC_B);
  attachInterrupt(digitalPinToInterrupt(ENC_A), onEdge, CHANGE);
  attachInterrupt(digitalPinToInterrupt(ENC_B), onEdge, CHANGE);
  delay(100);
  analogWrite(5, 150);
}
`
/** the ISR itself cuts the drive: no sampling delay, only the bench's transport */
const isrSketch = (n: number) => `${head}
void onEdge() {
  int s = (digitalRead(ENC_A) << 1) | digitalRead(ENC_B);
  count += QEM[(lastState << 2) | s];
  lastState = s;
  if (!fired && count >= ${n}) { fired = 1; analogWrite(5, 0); }
}
void setup() { start(); }
void loop() { delay(10); }
`
/** a 100 Hz fixed-rate loop cuts it: up to one control period more */
const loopSketch = (n: number) => `${head}
void onEdge() {
  int s = (digitalRead(ENC_A) << 1) | digitalRead(ENC_B);
  count += QEM[(lastState << 2) | s];
  lastState = s;
}
unsigned long nextTick = 0;
void setup() { start(); nextTick = millis(); }
void loop() {
  long wait = nextTick - millis();
  if (wait > 0) { delay(wait); }
  nextTick += 10;
  noInterrupts();
  long c = count;
  interrupts();
  if (!fired && c >= ${n}) { fired = 1; analogWrite(5, 0); }
}
`

interface Probe {
  /** sim time at which the shaft has truly turned N edges */
  tTrue: number
  /** sim time at which the motor's bridge output first shows the cut */
  tMotor: number
}

function probe(rec: Probe, n: number): Behavior {
  let phase = 0.5 // the encoder starts half an edge from its first transition
  let wPrev = 0
  let tPrev = 0
  return {
    id: 'loop-probe',
    onStep(_ctx, t, s) {
      const w = s.extraOf ? s.extraOf('m1', 'm1.omega') : (s.extra['m1.omega'] ?? 0)
      phase += (((w + wPrev) / 2) * (t - tPrev) * EDGES_PER_REV) / (2 * Math.PI)
      wPrev = w
      tPrev = t
      const v = (n: string) => (s.voltageOf ? s.voltageOf(n) : (s.nodeV[n] ?? 0))
      if (rec.tTrue < 0 && Math.floor(phase) >= n) rec.tTrue = t
      if (rec.tTrue >= 0 && rec.tMotor < 0 && v('ha_i') - v('bat_n') < 0.1) rec.tMotor = t
    },
  }
}

async function measure(sketch: (n: number) => string, n = N, frame = 1 / 60): Promise<Probe> {
  const rec: Probe = { tTrue: -1, tMotor: -1 }
  const lesson: Lesson = { ...PID, behaviors: [...(PID.behaviors ?? []), { id: 'loop-probe', instance: 'probe' }] }
  const b = createBench(lesson, { registry: { ...registry, 'loop-probe': probe(rec, n) }, speed: 1, code: sketch(n) })
  b.dispatch('place-all')
  b.dispatch('power')
  b.upload()
  while (b.t < 2 && rec.tMotor < 0) await b.frame(frame)
  b.dispose()
  if ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.LOOP_DELAY_LOG) {
    const ms = (x: number) => ((x - rec.tTrue) * 1e3).toFixed(2)
    console.log(`loop delay n=${n} ${(1 / frame).toFixed(0)} fps: shaft at ${rec.tTrue.toFixed(4)} s, motor +${ms(rec.tMotor)} ms`)
  }
  return rec
}

const DT = PID.sim?.dt ?? 1e-3
/** observed at the end of a step: the duty lands at the next step after the MCU's 1 ms chunk */
const TRANSPORT = 2 * DT + 1e-9

describe('bench loop delay (PID bench: encoder → ISR → sketch → PWM → motor)', () => {
  it('an ISR that cuts the PWM reaches the motor within two sim steps of the shaft passing N counts', async () => {
    const r = await measure(isrSketch)
    expect(r.tTrue).toBeGreaterThan(0.2)
    expect(r.tMotor).toBeGreaterThan(0)
    expect(r.tMotor - r.tTrue).toBeGreaterThanOrEqual(0)
    expect(r.tMotor - r.tTrue).toBeLessThanOrEqual(TRANSPORT)
  })

  it('the same while the motor is still accelerating: the edges follow ω as it is, not as it was', async () => {
    const r = await measure(isrSketch, N_RAMP)
    expect(r.tTrue).toBeGreaterThan(0.1)
    expect(r.tTrue).toBeLessThan(0.2)
    expect(r.tMotor - r.tTrue).toBeGreaterThanOrEqual(0)
    expect(r.tMotor - r.tTrue).toBeLessThanOrEqual(TRANSPORT)
  })

  it('a 100 Hz loop adds at most one control period', async () => {
    for (const n of [N, N_RAMP]) {
      const r = await measure(loopSketch, n)
      expect(r.tMotor - r.tTrue).toBeGreaterThanOrEqual(0)
      expect(r.tMotor - r.tTrue).toBeLessThanOrEqual(0.01 + TRANSPORT)
    }
  })

  it('the delay does not depend on the animation frame length', async () => {
    for (const frame of [1 / 30, 1 / 120]) {
      const r = await measure(isrSketch, N, frame)
      expect(r.tMotor - r.tTrue).toBeLessThanOrEqual(TRANSPORT)
    }
  })
})
