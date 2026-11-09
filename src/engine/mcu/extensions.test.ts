// M1.5 X2: interrupts, timestamped edges, per-board semantics, libraries and built-ins.
import { describe, expect, it } from 'vitest'
import type { PinState } from '../types'
import { VirtualMcu } from './index'
import type { VirtualMcuOptions } from './index'

interface PinEvent {
  t: number
  pin: number
  state: PinState
}

function harness(opts: Partial<VirtualMcuOptions> = {}) {
  const pins: PinEvent[] = []
  const lines: string[] = []
  const warnings: string[] = []
  const box: { mcu?: VirtualMcu } = {}
  const onPin = opts.onPin
  const mcu: VirtualMcu = new VirtualMcu({
    vcc: 5,
    readAnalog: () => 0,
    readDigital: () => 0,
    serial: (l) => lines.push(l),
    warn: (m) => warnings.push(m),
    ...opts,
    onPin: (pin, state) => {
      pins.push({ t: box.mcu ? box.mcu.timeMs : 0, pin, state: { ...state } })
      onPin?.(pin, state)
    },
  })
  box.mcu = mcu
  return { mcu, pins, lines, warnings }
}

async function runSketch(src: string, ms: number, opts: Partial<VirtualMcuOptions> = {}) {
  const h = harness(opts)
  h.mcu.load(src)
  h.mcu.start()
  await h.mcu.advance(ms)
  return h
}

// ───────────────────────── interrupts ─────────────────────────

describe('interrupts', () => {
  const COUNTER = `
    volatile int rises = 0;
    volatile int falls = 0;
    volatile int changes = 0;
    void onRise() { rises++; }
    void onFall() { falls++; }
    void onChange() { changes++; }
    void setup() {
      pinMode(2, INPUT);
      pinMode(3, INPUT);
      attachInterrupt(digitalPinToInterrupt(2), onRise, RISING);
      attachInterrupt(digitalPinToInterrupt(3), onFall, FALLING);
    }
    void loop() {
      delay(100);
      Serial.print(rises);
      Serial.print(",");
      Serial.println(falls);
    }`

  it('RISING and FALLING ISRs fire once per matching edge', async () => {
    const { mcu, lines } = harness({ board: 'uno' })
    mcu.load(COUNTER)
    mcu.start()
    // pin 2: 3 full pulses; pin 3: 2 full pulses (starting low)
    for (const t of [1000, 3000, 5000]) {
      mcu.injectEdge(2, 1, t)
      mcu.injectEdge(2, 0, t + 500)
    }
    for (const t of [2000, 4000]) {
      mcu.injectEdge(3, 1, t)
      mcu.injectEdge(3, 0, t + 500)
    }
    await mcu.advance(150)
    expect(lines).toEqual(['3,2'])
  })

  it('CHANGE fires on both edges; detachInterrupt stops it; repeated same level is not an edge', async () => {
    const { mcu, lines } = harness({ board: 'uno' })
    mcu.load(`
      volatile long n = 0;
      void isr() { n++; }
      void setup() {
        attachInterrupt(digitalPinToInterrupt(2), isr, CHANGE);
        delay(10);
        Serial.println(n);
        detachInterrupt(digitalPinToInterrupt(2));
        delay(10);
        Serial.println(n);
      }`)
    mcu.start()
    mcu.injectEdge(2, 1, 1000)
    mcu.injectEdge(2, 1, 1500) // no change
    mcu.injectEdge(2, 0, 2000)
    mcu.injectEdge(2, 1, 3000)
    mcu.injectEdge(2, 0, 12000) // after detach
    await mcu.advance(30)
    expect(lines).toEqual(['3', '3'])
  })

  it('digitalRead and micros inside an ISR see the level and time of the edge', async () => {
    const { mcu, lines } = harness({ board: 'uno' })
    mcu.load(`
      volatile unsigned long t[4];
      volatile int lv[4];
      volatile int k = 0;
      void isr() { if (k < 4) { t[k] = micros(); lv[k] = digitalRead(2); k++; } }
      void setup() {
        attachInterrupt(0, isr, CHANGE);
        delay(5);
        for (int i = 0; i < k; i++) {
          Serial.print(t[i]);
          Serial.print(":");
          Serial.println(lv[i]);
        }
      }`)
    mcu.start()
    mcu.injectEdge(2, 1, 1234)
    mcu.injectEdge(2, 0, 1301)
    mcu.injectEdge(2, 1, 2500)
    await mcu.advance(10)
    expect(lines).toEqual(['1234:1', '1301:0', '2500:1'])
  })

  it('an edge injected while the sketch runs preempts a busy-wait at once (no time passes)', async () => {
    const box: { mcu?: VirtualMcu } = {}
    const h = harness({
      board: 'uno',
      onPin: (pin, st) => {
        if (pin === 4 && st.level === 1) box.mcu?.injectEdge(3, 1, box.mcu.timeMicros)
      },
    })
    box.mcu = h.mcu
    h.mcu.load(`
      volatile bool flag = false;
      void isr() { flag = true; }
      void setup() {
        pinMode(4, OUTPUT);
        attachInterrupt(digitalPinToInterrupt(3), isr, RISING);
        delay(2);
        digitalWrite(4, HIGH);
        while (!flag) { }
        Serial.println(micros());
      }`)
    h.mcu.start()
    await h.mcu.advance(5)
    expect(h.lines).toEqual(['2000'])
    expect(h.warnings).toEqual([])
  })

  it('an edge injected between advance() calls is serviced before the sketch resumes', async () => {
    const { mcu, lines } = harness({ board: 'uno' })
    mcu.load(`
      volatile bool flag = false;
      void isr() { flag = true; }
      void setup() {
        attachInterrupt(digitalPinToInterrupt(3), isr, RISING);
        while (!flag) { }
        Serial.println("got it");
      }`)
    mcu.start()
    await mcu.advance(1)
    mcu.injectEdge(3, 1, 0) // an edge "now", while the sketch spins
    await mcu.advance(1)
    expect(lines).toEqual(['got it'])
  })

  it('noInterrupts() holds one pending interrupt per pin until interrupts()', async () => {
    const { mcu, lines } = harness({ board: 'uno' })
    mcu.load(`
      volatile int n = 0;
      void isr() { n++; }
      void setup() {
        attachInterrupt(digitalPinToInterrupt(2), isr, RISING);
        noInterrupts();
        delay(10);
        Serial.println(n);
        interrupts();
        Serial.println(n);
      }`)
    mcu.start()
    for (const t of [1000, 3000, 5000]) {
      mcu.injectEdge(2, 1, t)
      mcu.injectEdge(2, 0, t + 500)
    }
    await mcu.advance(20)
    expect(lines).toEqual(['0', '1'])
  })

  it('polls the simulated level of interrupt pins when no edges are injected', async () => {
    let level: 0 | 1 = 1
    const { mcu, lines } = harness({ board: 'uno', readDigital: () => level })
    mcu.load(`
      volatile int n = 0;
      void isr() { n++; }
      void setup() { pinMode(2, INPUT_PULLUP); attachInterrupt(digitalPinToInterrupt(2), isr, FALLING); }
      void loop() { delay(10); Serial.println(n); }`)
    mcu.start()
    await mcu.advance(5)
    level = 0
    await mcu.advance(10)
    expect(lines).toEqual(['1'])
  })

  it('warns about a non-interrupt pin on the Uno, delay() in an ISR, and an ISR that never returns', async () => {
    const { mcu, warnings, lines } = harness({ board: 'uno' })
    mcu.load(`
      volatile int n = 0;
      void slow() { delay(100); n++; }
      void stuck() { while (true) { } }
      void setup() {
        attachInterrupt(digitalPinToInterrupt(7), slow, RISING);
        attachInterrupt(digitalPinToInterrupt(2), slow, RISING);
        attachInterrupt(digitalPinToInterrupt(3), stuck, RISING);
      }
      void loop() { delay(5); Serial.println(n); }`)
    mcu.start()
    mcu.injectEdge(2, 1, 1000)
    mcu.injectEdge(3, 1, 7000)
    const t0 = Date.now()
    await mcu.advance(20)
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(lines).toEqual(['1'])
    expect(warnings[0]).toMatch(/interrupts 0 \(pin 2\) and 1 \(pin 3\)/)
    expect(warnings[1]).toMatch(/delay\(\) inside an interrupt handler/)
    expect(warnings[2]).toMatch(/interrupt handler.*line 4.*never returns/)
    expect(mcu.isRunning).toBe(false)
  })

  it('library timers can schedule ISRs (TimerOne-style)', async () => {
    const box: { mcu?: VirtualMcu } = {}
    const Timer1 = {
      period: 1000000,
      initialize(us: number) {
        this.period = us
      },
      attachInterrupt(fn: () => unknown) {
        const m = box.mcu as VirtualMcu
        const tick = (at: number) => m.schedule(at, () => {
          tick(at + this.period)
          return fn()
        })
        tick(m.timeMicros + this.period)
      },
    }
    const h = harness({ board: 'uno', libraries: { Timer1 } })
    box.mcu = h.mcu
    h.mcu.load(`
      volatile int n = 0;
      void onTimer() { n++; }
      void setup() { Timer1.initialize(250000); Timer1.attachInterrupt(onTimer); }
      void loop() { delay(1000); Serial.println(n); }`)
    h.mcu.start()
    await h.mcu.advance(2100)
    expect(h.lines).toEqual(['4', '8'])
  })

  it('10 kHz of edges for 1 virtual second runs in under 1 s of wall time', async () => {
    const { mcu, lines } = harness({ board: 'uno' })
    mcu.load(`
      volatile unsigned long n = 0;
      void isr() { n++; }
      void setup() { attachInterrupt(digitalPinToInterrupt(2), isr, CHANGE); }
      void loop() { delay(1000); Serial.println(n); }`)
    mcu.start()
    const t0 = Date.now()
    let level: 0 | 1 = 0
    for (let ms = 0; ms < 1000; ms++) {
      for (let k = 0; k < 10; k++) {
        level = level ? 0 : 1
        mcu.injectEdge(2, level, ms * 1000 + k * 100 + 50)
      }
      await mcu.advance(1)
    }
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(lines).toEqual(['10000'])
  })

  it('10 kHz of edges with a loop() that never waits stays fast', async () => {
    const { mcu, lines } = harness({ board: 'uno' })
    mcu.load(`
      volatile unsigned long n = 0;
      unsigned long last = 0;
      void isr() { n++; }
      void setup() { attachInterrupt(digitalPinToInterrupt(2), isr, RISING); }
      void loop() {
        if (millis() - last >= 500) { last += 500; Serial.println(n); }
      }`)
    mcu.start()
    for (let k = 0; k < 10000; k++) mcu.injectEdge(2, k % 2 ? 0 : 1, k * 100 + 50)
    const t0 = Date.now()
    await mcu.advance(1000)
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(lines).toEqual(['2500', '5000'])
  })
})

// ───────────────────────── curriculum sketches ─────────────────────────

const T4_INTERRUPTS = `
#include <TimerOne.h>

#define LOOP_DELAY 1      // try 300: polling misses presses, the ISR does not

volatile unsigned long tachCount = 0;
volatile unsigned long buttonEdges = 0;
volatile bool ledState = false;

unsigned long presses = 0;      // debounced, counted by polling
unsigned long lastPrint = 0;
unsigned long lastTach = 0;
unsigned long lastChange = 0;
int lastRaw = HIGH;
int stable = HIGH;

void onTach() {            // INT1: keep it to a few instructions
  tachCount++;
}

void onButton() {          // INT0: counts every edge, bounce included
  buttonEdges++;
}

void onTimer() {           // Timer1 compare: every 0.5 s
  ledState = !ledState;
  digitalWrite(13, ledState);
}

void setup() {
  pinMode(13, OUTPUT);
  pinMode(2, INPUT_PULLUP);
  pinMode(3, INPUT);       // external 10k pull-up
  Serial.begin(115200);
  attachInterrupt(digitalPinToInterrupt(3), onTach, FALLING);
  attachInterrupt(digitalPinToInterrupt(2), onButton, FALLING);
  Timer1.initialize(500000);        // 500 000 us = 0.5 s -> LED at 1 Hz
  Timer1.attachInterrupt(onTimer);  // note: TimerOne takes over PWM on 9/10
}

void loop() {
  // Software debounce by polling: accept a level only after 20 ms of quiet.
  int raw = digitalRead(2);
  if (raw != lastRaw) {
    lastChange = millis();
    lastRaw = raw;
  }
  if (millis() - lastChange > 20 && raw != stable) {
    stable = raw;
    if (stable == LOW) {
      presses++;
    }
  }

  if (millis() - lastPrint >= 1000) {
    lastPrint += 1000;
    noInterrupts();                 // copy multi-byte volatiles atomically
    unsigned long t = tachCount;
    unsigned long e = buttonEdges;
    interrupts();
    unsigned long hz = t - lastTach;
    lastTach = t;
    Serial.print("tach_hz:");
    Serial.print(hz);
    Serial.print(",rpm:");
    Serial.print(hz * 60);
    Serial.print(",presses:");
    Serial.print(presses);
    Serial.print(",isr_edges:");
    Serial.println(e);
  }
  delay(LOOP_DELAY);
}`

describe('curriculum: T4 interrupts-timers', () => {
  it('counts a 2 kHz tach, a bouncy button press and blinks pin 13 from Timer1', async () => {
    const box: { mcu?: VirtualMcu } = {}
    const Timer1 = {
      period: 1000000,
      initialize(us: number) {
        this.period = us
      },
      attachInterrupt(fn: () => unknown) {
        const m = box.mcu as VirtualMcu
        const tick = (at: number) => m.schedule(at, () => {
          tick(at + this.period)
          return fn()
        })
        tick(m.timeMicros + this.period)
      },
    }
    const h = harness({ board: 'uno', libraries: { Timer1 }, readDigital: () => 1 })
    box.mcu = h.mcu
    h.mcu.load(T4_INTERRUPTS)
    h.mcu.start()
    // tach: falling edges at 2 kHz, offset 100 us from the ms grid
    // button on pin 2: pressed at 300 ms with 3 bounces (4 falling edges), released at 600 ms
    const bounce = [0, 300, 700, 1200]
    for (const [i, dt] of bounce.entries()) {
      h.mcu.injectEdge(2, 0, 300000 + dt)
      if (i < bounce.length - 1) h.mcu.injectEdge(2, 1, 300000 + dt + 150)
    }
    h.mcu.injectEdge(2, 1, 600000)
    for (let ms = 0; ms < 2050; ms++) {
      h.mcu.injectEdge(3, 0, ms * 1000 + 100)
      h.mcu.injectEdge(3, 1, ms * 1000 + 350)
      h.mcu.injectEdge(3, 0, ms * 1000 + 600)
      h.mcu.injectEdge(3, 1, ms * 1000 + 850)
      await h.mcu.advance(1)
    }
    expect(h.warnings).toEqual([expect.stringContaining('TimerOne')])
    expect(h.lines).toEqual(['tach_hz:2000,rpm:120000,presses:1,isr_edges:4', 'tach_hz:2000,rpm:120000,presses:1,isr_edges:4'])
    const led = h.pins.filter((p) => p.pin === 13).map((p) => [p.t, p.state.level])
    expect(led).toEqual([
      [0, 0],
      [500, 1],
      [1000, 0],
      [1500, 1],
      [2000, 0],
    ])
  })
})

const T5_ENCODER = `
#define ENC_A 2
#define ENC_B 3
#define PWMA 5
#define AIN1 7
#define AIN2 8
#define STBY 4

const float CPR = 11.0 * 4 * 48;      // 2112 counts per output revolution
const unsigned long WINDOW_MS = 50;   // speed window

// Transition table indexed by (old state << 2) | new state, state = A<<1 | B.
// +1 = one step forward, -1 = one step back, 0 = no change or invalid jump.
const int QEM[16] = {0, 1, -1, 0,  -1, 0, 0, 1,  1, 0, 0, -1,  0, -1, 1, 0};

volatile long count = 0;
volatile int lastState = 0;
volatile unsigned long invalid = 0;

void onEdge() {
  int s = (digitalRead(ENC_A) << 1) | digitalRead(ENC_B);
  int idx = (lastState << 2) | s;
  if (s != lastState && QEM[idx] == 0) {
    invalid++;                         // both bits changed at once: an edge was missed
  }
  count += QEM[idx];
  lastState = s;
}

void motor(int speed) {
  speed = constrain(speed, -255, 255);
  if (speed >= 0) {
    digitalWrite(AIN1, HIGH);
    digitalWrite(AIN2, LOW);
    analogWrite(PWMA, speed);
  } else {
    digitalWrite(AIN1, LOW);
    digitalWrite(AIN2, HIGH);
    analogWrite(PWMA, -speed);
  }
}

unsigned long lastT = 0;
long lastCount = 0;
int demand = 0;
int dir = 1;

void setup() {
  pinMode(ENC_A, INPUT);               // external 10 k pull-ups
  pinMode(ENC_B, INPUT);
  pinMode(PWMA, OUTPUT);
  pinMode(AIN1, OUTPUT);
  pinMode(AIN2, OUTPUT);
  pinMode(STBY, OUTPUT);
  digitalWrite(STBY, HIGH);
  Serial.begin(115200);
  lastState = (digitalRead(ENC_A) << 1) | digitalRead(ENC_B);
  attachInterrupt(digitalPinToInterrupt(ENC_A), onEdge, CHANGE);
  attachInterrupt(digitalPinToInterrupt(ENC_B), onEdge, CHANGE);
}

void loop() {
  if (millis() - lastT >= WINDOW_MS) {
    lastT += WINDOW_MS;
    noInterrupts();
    long c = count;
    unsigned long bad = invalid;
    interrupts();
    long delta = c - lastCount;
    lastCount = c;
    float rpm = delta / CPR * 60000.0 / WINDOW_MS;
    float deg = c * 360.0 / CPR;

    // Slow triangle sweep of the drive: -200 .. +200
    demand = demand + dir * 4;
    if (demand >= 200 || demand <= -200) {
      dir = -dir;
    }
    motor(demand);

    Serial.print("pwm:");
    Serial.print(demand);
    Serial.print(",rpm:");
    Serial.print(rpm);
    Serial.print(",deg:");
    Serial.print(deg);
    Serial.print(",invalid:");
    Serial.println(bad);
  }
}`

/**
 * Forward quadrature (state A<<1|B: 0 -> 1 -> 3 -> 2): B toggles on even edges, A on odd.
 * `glitchAt`: edge glitchAt+1 arrives at the same instant as edge glitchAt (both bits change at once).
 */
function quadEdges(mcu: VirtualMcu, fromEdge: number, toEdge: number, periodUs: number, glitchAt?: number) {
  for (let k = fromEdge; k < toEdge; k++) {
    const t = (glitchAt !== undefined && k === glitchAt + 1 ? k - 0.5 : k + 0.5) * periodUs
    const pin = k % 2 === 0 ? 3 : 2
    // after edge k: B = 1 for k%4 in {0,1}, A = 1 for k%4 in {1,2}
    const level = k % 2 === 0 ? (k % 4 === 0 ? 1 : 0) : k % 4 === 1 ? 1 : 0
    mcu.injectEdge(pin, level as 0 | 1, t)
  }
}

describe('curriculum: T5 encoders', () => {
  async function run(sliceMs: number, glitchAt?: number) {
    const h = harness({ board: 'uno' })
    h.mcu.load(T5_ENCODER)
    h.mcu.start()
    // 4000 counts/s -> 250 us per edge, 200 counts per 50 ms window
    for (let ms = 0; ms < 200; ms += sliceMs) {
      quadEdges(h.mcu, (ms * 4), (ms + sliceMs) * 4, 250, glitchAt)
      await h.mcu.advance(sliceMs)
    }
    return h
  }

  it('reports rpm and position from quadrature edges', async () => {
    const h = await run(1)
    expect(h.warnings).toEqual([])
    expect(h.lines).toEqual([
      'pwm:4,rpm:113.64,deg:34.09,invalid:0',
      'pwm:8,rpm:113.64,deg:68.18,invalid:0',
      'pwm:12,rpm:113.64,deg:102.27,invalid:0',
      'pwm:16,rpm:113.64,deg:136.36,invalid:0',
    ])
    expect(h.pins.filter((p) => p.pin === 5).at(-1)?.state.level).toBeCloseTo(16 / 255)
  })

  it('is deterministic regardless of how advance() is sliced', async () => {
    const a = await run(1)
    const b = await run(10)
    expect(b.lines).toEqual(a.lines)
  })

  it('counts an invalid transition when A and B change at the same instant', async () => {
    const h = await run(1, 500)
    expect(h.lines[1]).toMatch(/invalid:0$/)
    expect(h.lines[2]).toMatch(/invalid:1$/)
  })
})

const T6_ULTRASONIC = `
#define TRIG 9
#define ECHO 10
#define N 5                         // readings per median

float airTempC = 20.0;              // what the code assumes
float readings[N];

float readCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);            // >= 10 us trigger pulse
  digitalWrite(TRIG, LOW);
  unsigned long us = pulseIn(ECHO, HIGH, 30000);   // 30 ms ~ 5 m round trip
  if (us == 0) {
    return -1.0;                    // no echo
  }
  float c = 331.3 + 0.606 * airTempC;              // m/s
  return us * c / 20000.0;          // us * 1e-6 * c * 100 cm/m / 2
}

void sortReadings() {               // insertion sort, N is small
  for (int i = 1; i < N; i++) {
    float key = readings[i];
    int j = i - 1;
    while (j >= 0 && readings[j] > key) {
      readings[j + 1] = readings[j];
      j--;
    }
    readings[j + 1] = key;
  }
}

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  digitalWrite(TRIG, LOW);
  Serial.begin(115200);
}

void loop() {
  int good = 0;
  for (int i = 0; i < N; i++) {
    readings[i] = readCm();
    if (readings[i] > 0) {
      good++;
    }
    delay(60);                      // let echoes die out between pings
  }
  sortReadings();
  float median = readings[N / 2];
  Serial.print("cm:");
  Serial.print(median);
  Serial.print(",good:");
  Serial.println(good);
}`

describe('curriculum: T6 ultrasonic HC-SR04 (pulseIn)', () => {
  function sensor(echoUs: () => number | null) {
    let trig = 0
    const box: { mcu?: VirtualMcu } = {}
    const h = harness({
      board: 'uno',
      onPin: (pin, st) => {
        if (pin !== 9) return
        const lv = st.level >= 0.5 ? 1 : 0
        if (trig === 1 && lv === 0) {
          const m = box.mcu as VirtualMcu
          const w = echoUs()
          if (w !== null) {
            m.injectEdge(10, 1, m.timeMicros + 460)
            m.injectEdge(10, 0, m.timeMicros + 460 + w)
          }
        }
        trig = lv
      },
    })
    box.mcu = h.mcu
    return h
  }

  it('measures a 5824 us echo as 100.00 cm', async () => {
    const h = sensor(() => 5824)
    h.mcu.load(T6_ULTRASONIC)
    h.mcu.start()
    await h.mcu.advance(400)
    expect(h.warnings).toEqual([])
    expect(h.lines).toEqual(['cm:100.00,good:5'])
  })

  it('times out to 0 (cm:-1.00) with no echo, and the median rejects two bad pings', async () => {
    const none = sensor(() => null)
    none.mcu.load(T6_ULTRASONIC)
    none.mcu.start()
    await none.mcu.advance(460)
    expect(none.lines).toEqual(['cm:-1.00,good:0'])

    let n = 0
    const some = sensor(() => (n++ % 5 < 2 ? null : 5824))
    some.mcu.load(T6_ULTRASONIC)
    some.mcu.start()
    await some.mcu.advance(400)
    expect(some.lines).toEqual(['cm:100.00,good:3'])
  })

  it('pulseIn also works on a simulated level (polled every max(10 us, timeout/1000))', async () => {
    const box: { mcu?: VirtualMcu } = {}
    const h = harness({
      readDigital: (pin) => {
        const t = (box.mcu as VirtualMcu).timeMicros
        return pin === 7 && t >= 1000 && t < 1500 ? 1 : 0
      },
    })
    box.mcu = h.mcu
    h.mcu.load(`void setup() { Serial.println(pulseIn(7, HIGH, 3000)); Serial.println(pulseIn(7, HIGH, 2000)); }`)
    h.mcu.start()
    await h.mcu.advance(10)
    expect(h.lines).toEqual(['500', '0'])
  })
})

// ───────────────────────── timing ─────────────────────────

describe('microsecond timing', () => {
  it('delayMicroseconds accumulates exactly', async () => {
    const { lines } = await runSketch(`void setup() { for (int i = 0; i < 1000; i++) { delayMicroseconds(3); } Serial.println(micros()); }`, 10)
    expect(lines).toEqual(['3000'])
  })
})

// ───────────────────────── per-board semantics ─────────────────────────

describe('per-board semantics', () => {
  const WRAP = `
    void setup() {
      int x = 32767;
      x++;
      Serial.println(x);
      int y = 200 * 300;
      Serial.println(y);
      unsigned int u = -1;
      Serial.println(u);
      long l = 100000;
      Serial.println(l);
      unsigned long ul = -1;
      Serial.println(ul);
      int z = 30000;
      z += 10000;
      Serial.println(z);
      Serial.println((int)40000);
    }`

  it("uno: int is 16-bit and wraps; long is 32-bit", async () => {
    const { lines } = await runSketch(WRAP, 1, { board: 'uno' })
    expect(lines).toEqual(['-32768', '-5536', '65535', '100000', '4294967295', '-25536', '-25536'])
  })

  it('uno: int parameters wrap too', async () => {
    const { lines } = await runSketch(`void show(int v) { Serial.println(v); } void setup() { show(40000); }`, 1, { board: 'uno' })
    expect(lines).toEqual(['-25536'])
  })

  it('esp32s3: int is 32-bit', async () => {
    const { lines } = await runSketch(`void setup() { int x = 2147483647; x++; Serial.println(x); int y = 200 * 300; Serial.println(y); }`, 1, { board: 'esp32s3', vcc: 3.3 })
    expect(lines).toEqual(['-2147483648', '60000'])
  })

  it('generic (default) keeps the old unbounded ints', async () => {
    const { lines } = await runSketch(`void setup() { int x = 32767; x++; Serial.println(x); }`, 1)
    expect(lines).toEqual(['32768'])
  })

  it('uno: 10-bit ADC and analogReference(INTERNAL) = 1.1 V', async () => {
    const { lines } = await runSketch(
      `void setup() { Serial.println(analogRead(A0)); analogReference(INTERNAL); Serial.println(analogRead(A0)); analogReference(DEFAULT); Serial.println(analogRead(A1)); }`,
      1,
      { board: 'uno', readAnalog: (p) => (p === 14 ? 0.55 : 2.5) },
    )
    expect(lines).toEqual(['112', '512', '512']) // floor(0.55·1024/5 = 112.64), the datasheet transfer
  })

  it('esp32s3: 12-bit ADC, A0 is GPIO1, analogReadResolution', async () => {
    const seen: number[] = []
    const { lines } = await runSketch(
      `void setup() { Serial.println(A0); Serial.println(analogRead(1)); analogReadResolution(10); Serial.println(analogRead(A0)); }`,
      1,
      {
        board: 'esp32s3',
        vcc: 3.3,
        readAnalog: (p) => {
          seen.push(p)
          return 1.65
        },
      },
    )
    expect(lines).toEqual(['1', '2048', '512'])
    expect(seen).toEqual([1, 1])
  })

  it('esp32s3: every GPIO can take an interrupt', async () => {
    const { mcu, lines } = harness({ board: 'esp32s3', vcc: 3.3 })
    mcu.load(`volatile int n = 0; void isr() { n++; } void setup() { attachInterrupt(digitalPinToInterrupt(14), isr, RISING); delay(5); Serial.println(n); }`)
    mcu.start()
    mcu.injectEdge(14, 1, 1000)
    await mcu.advance(10)
    expect(lines).toEqual(['1'])
  })
})

// ───────────────────────── built-ins ─────────────────────────

describe('tone / noTone', () => {
  it('tone sets toneHz and a 50 % level; a duration ends it', async () => {
    const { pins } = await runSketch(`void setup() { tone(8, 440); delay(10); noTone(8); tone(8, 1000, 100); }`, 200)
    const p8 = pins.filter((p) => p.pin === 8).map((p) => [p.t, p.state.level, p.state.toneHz ?? 0])
    expect(p8).toEqual([
      [0, 0.5, 440],
      [10, 0, 0],
      [10, 0.5, 1000],
      [110, 0, 0],
    ])
  })
})

describe('bitWrite / bitSet / bitClear', () => {
  it('rewrite their first argument', async () => {
    const { lines } = await runSketch(
      `byte a[2];
       void setup() {
         byte b = 0;
         bitSet(b, 3);
         bitWrite(b, 0, 1);
         bitWrite(b, 7, HIGH);
         bitClear(b, 3);
         Serial.println(b);
         bitSet(a[1], 2);
         Serial.println(a[1]);
       }`,
      1,
    )
    expect(lines).toEqual(['129', '4'])
  })
})

describe('String methods', () => {
  it('toInt, toFloat, trim, toUpperCase, indexOf, substring', async () => {
    const { lines } = await runSketch(
      `void setup() {
         String s = "  42 ";
         s.trim();
         Serial.println(s.toInt() + 1);
         String t = "3.5V";
         Serial.println(t.toFloat() * 2);
         String u = "hello,world";
         Serial.println(u.indexOf(','));
         Serial.println(u.substring(6));
         Serial.println(u.substring(0, 5));
         u.toUpperCase();
         Serial.println(u);
         Serial.println(u.indexOf("WORLD"));
         Serial.println(u.indexOf('o', 5));
         Serial.println(String("x12").toInt());
       }`,
      1,
    )
    expect(lines).toEqual(['43', '7.00', '5', 'world', 'hello', 'HELLO,WORLD', '6', '-1', '0'])
  })
})

describe('Serial input', () => {
  it('serialIn feeds available/read/parseInt/readStringUntil', async () => {
    const { mcu, lines } = harness()
    mcu.load(`
      void setup() { Serial.begin(9600); }
      void loop() {
        if (Serial.available() > 0) {
          char c = Serial.read();
          if (c == 'n') {
            int v = Serial.parseInt();
            Serial.println(v * 2);
          } else if (c == 's') {
            String w = Serial.readStringUntil('\\n');
            Serial.println(w);
          } else if (c != '\\n') {
            Serial.println(c);
          }
        }
        delay(1);
      }`)
    mcu.start()
    await mcu.advance(5)
    mcu.serialIn('n21\n')
    await mcu.advance(5)
    mcu.serialIn('shello\nx')
    await mcu.advance(5)
    expect(lines).toEqual(['42', 'hello', 'x'])
  })
})

describe('Wire and SPI delegate to bus devices', () => {
  it('Wire master write/requestFrom reaches an attached I2C device; missing address NACKs', async () => {
    const writes: number[][] = []
    const { mcu, lines } = harness()
    mcu.attachI2c(0x68, {
      write: (bytes) => {
        writes.push(bytes)
      },
      read: (n) => [0x68, 0x01, 0x02].slice(0, n),
    })
    mcu.load(`
      #include <Wire.h>
      void setup() {
        Wire.begin();
        Wire.beginTransmission(0x68);
        Wire.write(0x75);
        Serial.println(Wire.endTransmission(false));
        Serial.println(Wire.requestFrom(0x68, 2));
        while (Wire.available()) { Serial.println(Wire.read(), HEX); }
        Wire.beginTransmission(0x3C);
        Wire.write(0);
        Serial.println(Wire.endTransmission());
        Serial.println(Wire.requestFrom(0x3C, 1));
      }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['0', '2', '68', '1', '2', '0'])
    expect(writes).toEqual([[0x75]])
  })

  it('a device whose ack() returns false NACKs its address: no write, no read', async () => {
    const writes: number[][] = []
    let present = false
    const { mcu, lines } = harness()
    mcu.attachI2c(0x41, { ack: () => present, write: (b) => void writes.push(b), read: () => [7] })
    mcu.load(`
      #include <Wire.h>
      void setup() {
        Wire.begin();
        Wire.beginTransmission(0x41);
        Wire.write(1);
        Serial.println(Wire.endTransmission());
        Serial.println(Wire.requestFrom(0x41, 1));
      }
      void loop() { delay(10); }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['2', '0'])
    expect(writes).toEqual([])
    present = true
    mcu.start()
    await mcu.advance(1)
    expect(lines.slice(2)).toEqual(['0', '1'])
    expect(writes).toEqual([[1]])
  })

  it('SPI.transfer goes to the device whose CS pin is low', async () => {
    const sel: boolean[] = []
    const seen: Array<[number, number]> = []
    const { mcu, lines } = harness()
    mcu.attachSpi(10, {
      transfer: (b, s) => {
        seen.push([b, s.mode])
        return b ^ 0xff
      },
      select: (on) => {
        sel.push(on)
      },
    })
    mcu.load(`
      #include <SPI.h>
      SPISettings slow(1000000, MSBFIRST, SPI_MODE0);
      void setup() {
        SPI.begin();
        pinMode(10, OUTPUT);
        digitalWrite(10, HIGH);
        SPI.beginTransaction(SPISettings(4000000, MSBFIRST, SPI_MODE3));
        digitalWrite(10, LOW);
        byte r = SPI.transfer(0x0F);
        digitalWrite(10, HIGH);
        SPI.endTransaction();
        Serial.println(r);
        SPI.beginTransaction(slow);
        Serial.println(SPI.transfer(0x0F));
        SPI.endTransaction();
      }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['240', '255'])
    expect(seen).toEqual([[0x0f, 3]])
    expect(sel).toEqual([true, false, true, false]) // pinMode(OUTPUT) drives the latch (LOW) first
  })
})

describe('behaviour library classes', () => {
  it('ClassName(args) as an initializer or argument constructs the class', async () => {
    class Adafruit_PWMServoDriver {
      addr: number
      freq = 0
      constructor(addr = 0x40) {
        this.addr = addr
      }
      begin() {
        return true
      }
      setPWMFreq(f: number) {
        this.freq = f
      }
    }
    const helper = (x: number) => x * 2
    const { lines, warnings } = await runSketch(
      `#include <Adafruit_PWMServoDriver.h>
       Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver(0x41);
       Adafruit_PWMServoDriver other;
       void setup() {
         pwm.begin();
         pwm.setPWMFreq(50);
         Serial.println(pwm.addr);
         Serial.println(pwm.freq);
         Serial.println(other.addr);
         Serial.println(helper(21));
       }`,
      1,
      { libraries: { Adafruit_PWMServoDriver, helper } },
    )
    expect(warnings).toEqual([])
    expect(lines).toEqual(['65', '50', '64', '42'])
  })
})

// ───────────────────────── review round 1 ─────────────────────────

describe('review fixes', () => {
  it('a deferred ISR reads the level at its edge, not the current level', async () => {
    const { mcu, lines } = harness({ board: 'uno' })
    mcu.load(`
      volatile int seen = -1;
      void isr() { seen = digitalRead(2); }
      void setup() {
        attachInterrupt(digitalPinToInterrupt(2), isr, RISING);
        noInterrupts();
        delay(10);
        interrupts();
        Serial.println(seen);
        Serial.println(digitalRead(2));
      }`)
    mcu.start()
    mcu.injectEdge(2, 1, 2000)
    mcu.injectEdge(2, 0, 3000)
    await mcu.advance(20)
    expect(lines).toEqual(['1', '0'])
  })

  it('String.charAt prints as a character and still compares as a char code', async () => {
    const { lines } = await runSketch(
      `void setup() { String s = "hey"; Serial.println(s.charAt(1)); char c = s.charAt(0); Serial.println(c == 'h'); Serial.println(c); }`,
      1,
    )
    expect(lines).toEqual(['e', '1', 'h'])
  })

  it('uno: int array elements wrap on ++, --, = and op=', async () => {
    const { lines } = await runSketch(
      `int a[3] = {32767, -32768, 30000};
       void setup() {
         a[0]++;
         a[1]--;
         a[2] += 10000;
         Serial.println(a[0]);
         Serial.println(a[1]);
         Serial.println(a[2]);
         a[0] = 40000;
         Serial.println(a[0]);
         for (int i = 0; i < 1; a[1]++) { i++; }
         Serial.println(a[1]);
       }`,
      1,
      { board: 'uno' },
    )
    expect(lines).toEqual(['-32768', '32767', '-25536', '-25536', '-32768'])
  })

  it('pulseIn on a polled pin scales its poll interval with the timeout', async () => {
    let reads = 0
    const { lines } = await runSketch(`void setup() { Serial.println(pulseIn(7, HIGH, 1000000)); }`, 1100, {
      readDigital: (pin) => {
        if (pin === 7) reads++
        return 0
      },
    })
    expect(lines).toEqual(['0'])
    expect(reads).toBeLessThan(2100)
  })

  it('a user function wins over a library class of the same name', async () => {
    class Thing {
      v = 7
    }
    const { lines, warnings } = await runSketch(`int Thing(int x) { return x + 1; } void setup() { Serial.println(Thing(1)); }`, 1, { libraries: { Thing } })
    expect(warnings).toEqual([])
    expect(lines).toEqual(['2'])
  })
})
