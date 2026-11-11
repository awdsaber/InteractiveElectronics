import { describe, expect, it } from 'vitest'
import type { PinState } from '../types'
import { TranspileError, VirtualMcu } from './index'

interface PinEvent {
  t: number
  pin: number
  state: PinState
}

function harness(opts: { analog?: (pin: number) => number; digital?: (pin: number) => 0 | 1; libraries?: Record<string, unknown> } = {}) {
  const pins: PinEvent[] = []
  const lines: string[] = []
  const warnings: string[] = []
  const mcu: VirtualMcu = new VirtualMcu({
    vcc: 5,
    onPin: (pin, state) => pins.push({ t: mcu.timeMs, pin, state: { ...state } }),
    readAnalog: opts.analog ?? (() => 0),
    readDigital: opts.digital ?? (() => 0),
    serial: (l) => lines.push(l),
    warn: (m) => warnings.push(m),
    libraries: opts.libraries,
  })
  return { mcu, pins, lines, warnings }
}

const BLINK = `
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}
void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}`

describe('VirtualMcu: Blink', () => {
  it('toggles pin 13 every 1000 ms of virtual time', async () => {
    const { mcu, pins } = harness()
    mcu.load(BLINK)
    mcu.start()
    await mcu.advance(3500)
    const writes = pins.filter((p) => p.pin === 13 && p.state.mode === 'OUTPUT')
    // pinMode at t=0 (LOW), then HIGH@0, LOW@1000, HIGH@2000, LOW@3000
    expect(writes.map((p) => [p.t, p.state.level])).toEqual([
      [0, 0],
      [0, 1],
      [1000, 0],
      [2000, 1],
      [3000, 0],
    ])
  })

  it('is deterministic regardless of how advance() is sliced', async () => {
    const a = harness()
    a.mcu.load(BLINK)
    a.mcu.start()
    await a.mcu.advance(4000)
    const b = harness()
    b.mcu.load(BLINK)
    b.mcu.start()
    for (let i = 0; i < 4000; i++) await b.mcu.advance(1)
    expect(b.pins.map((p) => [p.t, p.pin, p.state.level])).toEqual(a.pins.map((p) => [p.t, p.pin, p.state.level]))
  })

  it('stop() halts the program; start() restarts from time zero', async () => {
    const { mcu, pins } = harness()
    mcu.load(BLINK)
    mcu.start()
    await mcu.advance(1500)
    mcu.stop()
    const n = pins.length
    await mcu.advance(5000)
    expect(pins.length).toBe(n)
    mcu.start()
    expect(mcu.timeMs).toBe(0)
    await mcu.advance(1)
    expect(pins.length).toBeGreaterThan(n)
  })

  it('millis() and micros() report virtual time', async () => {
    const { mcu, lines } = harness()
    mcu.load(`void setup(){ delay(250); Serial.println(millis()); delayMicroseconds(500); Serial.println(micros()); }`)
    mcu.start()
    await mcu.advance(300)
    expect(lines).toEqual(['250', '250500'])
  })
})

describe('VirtualMcu: PWM / fade', () => {
  it('analogWrite in a for loop sets level v/255', async () => {
    const { mcu, pins } = harness()
    mcu.load(`
      int led = 9;
      void setup() { pinMode(led, OUTPUT); }
      void loop() {
        for (int b = 0; b <= 255; b += 51) {
          analogWrite(led, b);
          delay(10);
        }
      }`)
    mcu.start()
    await mcu.advance(60)
    const levels = pins.filter((p) => p.pin === 9).map((p) => p.state.level)
    expect(levels.slice(0, 7)).toEqual([0, 0, 51 / 255, 102 / 255, 153 / 255, 204 / 255, 1])
  })

  it('clamps analogWrite to 0..255', async () => {
    const { mcu, pins } = harness()
    mcu.load(`void setup(){ analogWrite(3, 999); analogWrite(3, -5); }`)
    mcu.start()
    await mcu.advance(1)
    expect(pins.map((p) => p.state.level)).toEqual([1, 0])
  })
})

describe('VirtualMcu: Serial', () => {
  it('println emits lines; print accumulates until a newline', async () => {
    const { mcu, lines } = harness()
    mcu.load(`
      void setup() {
        Serial.begin(9600);
        Serial.println("hello");
        Serial.print("a");
        Serial.print(1);
        Serial.print(' ');
        Serial.println(2);
      }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['hello', 'a1 2'])
  })

  it('formats floats with two decimals by default and honours digits and bases', async () => {
    const { mcu, lines } = harness()
    mcu.load(`
      void setup() {
        float x = 3.14159;
        Serial.println(x);
        Serial.println(x, 4);
        Serial.println(10, HEX);
        Serial.println(5, BIN);
        Serial.println(7);
        Serial.println(2.0);
        Serial.println(1 / 4.0);
      }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['3.14', '3.1416', 'A', '101', '7', '2.00', '0.25'])
  })

  it('keeps comment markers inside string literals', async () => {
    const { mcu, lines } = harness()
    mcu.load(`void setup(){ Serial.println("a // b /* c */ d"); } // trailing
      /* block
         comment */`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['a // b /* c */ d'])
  })

  it('concatenates strings and numbers', async () => {
    const { mcu, lines } = harness()
    mcu.load(`void setup(){ String s = "n="; int n = 4; s += n; Serial.println(s + "!"); Serial.println(s.length()); }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['n=4!', '3'])
  })
})

describe('VirtualMcu: functions, arrays, defines', () => {
  it('user functions with params and return values (awaited)', async () => {
    const { mcu, lines } = harness()
    mcu.load(`
      int add(int a, int b) { return a + b; }
      int twice(int x) { return add(x, x); }
      long fact(int n) { if (n <= 1) return 1; return n * fact(n - 1); }
      void report(int v) { Serial.println(v); delay(5); Serial.println(v + 1); }
      void setup() {
        Serial.println(twice(add(1, 2)));
        Serial.println(fact(5));
        report(10);
      }`)
    mcu.start()
    await mcu.advance(10)
    expect(lines).toEqual(['6', '120', '10', '11'])
  })

  it('functions can be used before they are defined (prototypes dropped)', async () => {
    const { mcu, lines } = harness()
    mcu.load(`
      int sq3(int);
      void setup() { Serial.println(sq3(4)); }
      int sq3(int x) { return x * x; }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['16'])
  })

  it('arrays, #define and multi-declarators', async () => {
    const { mcu, lines } = harness()
    mcu.load(`
      #define N 4
      #define LED_PIN 7
      #define SCALE (N * 2)
      int a = 1, b[3] = {1, 2, 3};
      const int pins[N] = {2, 3, 4, 5};
      int grid[2][3] = {{1, 2, 3}, {4, 5, 6}};
      int zeros[N];
      byte part[5] = {9, 8};
      int total() { int s = 0; for (int i = 0; i < N; i++) s += pins[i]; return s; }
      void setup() {
        Serial.println(a);
        Serial.println(b[2]);
        Serial.println(total());
        Serial.println(grid[1][2]);
        Serial.println(zeros[3]);
        Serial.println(part[4]);
        Serial.println(SCALE);
        Serial.println(LED_PIN);
        Serial.println(sizeof(pins) / sizeof(pins[0]));
      }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['1', '3', '14', '6', '0', '0', '8', '7', '4'])
  })

  it('static locals persist across calls', async () => {
    const { mcu, lines } = harness()
    mcu.load(`
      int next() { static int n = 0; n++; return n; }
      void setup() { next(); next(); Serial.println(next()); }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['3'])
  })

  it('integer semantics: integer declarations and casts truncate', async () => {
    const { mcu, lines } = harness()
    mcu.load(`
      void setup() {
        int a = 7 / 2;
        int b;
        b = 9 / 2;
        float c = 7 / 2.0;
        Serial.println(a);
        Serial.println(b);
        Serial.println((int)(c * 10));
        Serial.println((float)a / 2);
        Serial.println(int(3.9));
        Serial.println(7 % 3);
      }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['3', '4', '35', '1.50', '3', '1'])
  })

  it('switch / while / do-while / ternary / bit ops', async () => {
    const { mcu, lines } = harness()
    mcu.load(`
      int classify(int v) {
        switch (v) {
          case 0: return 10;
          case 1:
          case 2: return 20;
          default: return 30;
        }
      }
      void setup() {
        int i = 0, sum = 0;
        while (i < 5) { sum += i; i++; }
        do { sum += 100; } while (sum < 50);
        Serial.println(sum);
        Serial.println(classify(0) + classify(2) + classify(9));
        Serial.println(i > 3 ? 1 : 0);
        Serial.println((0xF0 >> 4) | (1 << 3));
        bool f = !(i == 5) || true;
        Serial.println(f);
      }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['110', '60', '1', '15', '1'])
  })

  it('for loops with empty clauses, nested loops, break and continue', async () => {
    const { mcu, lines } = harness()
    mcu.load(`
      void setup() {
        int n = 0;
        for (;;) { n++; if (n == 3) continue; if (n > 5) break; }
        int t = 0;
        for (int i = 0, j = 10; i < j; i++, j--) t++;
        Serial.println(n);
        Serial.println(t);
      }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['6', '5'])
  })

  it('JS-reserved words are usable as C identifiers', async () => {
    const { mcu, lines } = harness()
    mcu.load(`void setup(){ int in = 2; int function = in + 1; Serial.println(function); }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['3'])
  })
})

describe('VirtualMcu: Arduino helpers', () => {
  it('map and constrain', async () => {
    const { mcu, lines } = harness()
    mcu.load(`
      void setup() {
        Serial.println(map(512, 0, 1023, 0, 255));
        Serial.println(map(5, 0, 10, 100, 0));
        Serial.println(map(-3, 0, 10, 0, 100));
        Serial.println(constrain(300, 0, 255));
        Serial.println(constrain(-4, 0, 255));
        Serial.println(constrain(42, 0, 255));
        Serial.println(min(3, 9) + max(3, 9) + abs(-4));
        Serial.println(random(10) < 10);
        long r = random(5, 6);
        Serial.println(r);
      }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['127', '50', '-30', '255', '0', '42', '16', '1', '5'])
  })

  it('random() is deterministic per start', async () => {
    const run = async () => {
      const { mcu, lines } = harness()
      mcu.load(`void setup(){ for (int i = 0; i < 5; i++) Serial.println(random(1000)); }`)
      mcu.start()
      await mcu.advance(1)
      return lines
    }
    const a = await run()
    const b = await run()
    expect(a).toHaveLength(5)
    expect(a).toEqual(b)
  })

  it('analogRead = round(V / vcc * 1023); digitalRead uses readDigital for inputs', async () => {
    const { mcu, lines } = harness({
      analog: (pin) => (pin === 14 ? 2.5 : 5),
      digital: (pin) => (pin === 2 ? 1 : 0),
    })
    mcu.load(`
      void setup() {
        pinMode(2, INPUT_PULLUP);
        pinMode(8, OUTPUT);
        digitalWrite(8, HIGH);
        Serial.println(analogRead(A0));
        Serial.println(analogRead(A1));
        Serial.println(digitalRead(2));
        Serial.println(digitalRead(3));
        Serial.println(digitalRead(8));
      }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['512', '1023', '1', '0', '1'])
  })

  it('reports pin modes through onPin', async () => {
    const { mcu, pins } = harness()
    mcu.load(`void setup(){ pinMode(2, INPUT_PULLUP); pinMode(5, OUTPUT); digitalWrite(5, HIGH); }`)
    mcu.start()
    await mcu.advance(1)
    expect(pins.map((p) => [p.pin, p.state.mode, p.state.level])).toEqual([
      [2, 'INPUT_PULLUP', 1],
      [5, 'OUTPUT', 0],
      [5, 'OUTPUT', 1],
    ])
  })
})

describe('VirtualMcu: Servo, Wire, libraries', () => {
  it('Servo.write reports servoDeg and level deg/180', async () => {
    const { mcu, pins } = harness()
    mcu.load(`
      #include <Servo.h>
      Servo s;
      void setup() { s.attach(9); s.write(90); delay(100); s.write(180); }`)
    mcu.start()
    await mcu.advance(200)
    const servo = pins.filter((p) => p.pin === 9 && p.state.servoDeg !== undefined)
    expect(servo.map((p) => [p.t, p.state.servoDeg, p.state.level, p.state.mode])).toEqual([
      [0, 90, 0.5, 'OUTPUT'],
      [100, 180, 1, 'OUTPUT'],
    ])
  })

  it('Wire.begin is a no-op', async () => {
    const { mcu, lines, warnings } = harness()
    mcu.load(`#include <Wire.h>\nvoid setup(){ Wire.begin(); Serial.println("ok"); }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['ok'])
    expect(warnings).toEqual([])
  })

  it('exposes behaviour libraries as globals and as class types', async () => {
    class Widget {
      v = 3
      get() {
        return this.v
      }
    }
    const mpu = { read: () => 42 }
    const { mcu, lines } = harness({ libraries: { mpu, Widget } })
    mcu.load(`Widget w; void setup(){ Serial.println(mpu.read()); Serial.println(w.get()); }`)
    mcu.start()
    await mcu.advance(1)
    expect(lines).toEqual(['42', '3'])
  })
})

describe('VirtualMcu: errors and guards', () => {
  it('load() throws TranspileError with the right line for a missing semicolon', () => {
    const { mcu } = harness()
    let err: unknown
    try {
      mcu.load(`void setup() {\n  pinMode(13, OUTPUT)\n  digitalWrite(13, HIGH);\n}\nvoid loop() {}`)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(TranspileError)
    expect((err as TranspileError).line).toBe(2)
  })

  it('an infinite loop without delay does not hang (under 1 s) and warns', async () => {
    const { mcu, warnings, pins } = harness()
    mcu.load(`
      int x = 0;
      void setup() { pinMode(4, OUTPUT); }
      void loop() { while (true) { x++; } }`)
    mcu.start()
    const t0 = Date.now()
    await mcu.advance(100)
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(mcu.timeMs).toBe(100)
    expect(warnings.some((w) => w.includes('loop() never waits'))).toBe(true)
    expect(pins.length).toBe(1)
  })

  it('keepBudget: advances in chunks share one statement budget, as if advanced at once', async () => {
    const run = async (chunks: number, keepBudget: boolean) => {
      let last = 0
      const { mcu } = harness({ libraries: { Probe: { set: (v: number) => (last = v) } } })
      mcu.load(`long x = 0;\nvoid loop() { while (true) { x++; Probe.set(x); } }`)
      mcu.start()
      for (let i = 0; i < chunks; i++) await mcu.advance(50 / chunks, { keepBudget: keepBudget && i > 0 })
      expect(mcu.timeMs).toBeCloseTo(50, 9)
      return last
    }
    const whole = await run(1, false)
    const kept = await run(5, true)
    const fresh = await run(5, false)
    expect(kept).toBeGreaterThan(whole * 0.9)
    expect(kept).toBeLessThan(whole * 1.1)
    expect(fresh).toBeGreaterThan(whole * 2) // each fresh advance hands out a whole new budget
  })

  it('for(;;) and a loop() that never waits are also bounded', async () => {
    const a = harness()
    a.mcu.load(`void loop() { for (;;) { } }`)
    a.mcu.start()
    const t0 = Date.now()
    await a.mcu.advance(50)
    const b = harness()
    b.mcu.load(`int n = 0; void loop() { n++; }`)
    b.mcu.start()
    await b.mcu.advance(1000)
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(b.mcu.timeMs).toBe(1000)
  })

  it('a loop() with no delay still lets time pass, at no more than 20000 iterations per second', async () => {
    const { mcu, lines } = harness()
    mcu.load(`int n = 0; void loop() { n++; if (n == 100) Serial.println(millis()); }`)
    mcu.start()
    await mcu.advance(1000)
    expect(lines).toHaveLength(1)
    expect(Number(lines[0])).toBeGreaterThanOrEqual(4)
  })

  it('a runtime error stops the program and is reported via warn', async () => {
    const { mcu, warnings, lines } = harness()
    mcu.load(`void setup(){ Serial.println("a"); int a[2]; a[9].v = 1; Serial.println("b"); }`)
    mcu.start()
    await mcu.advance(10)
    expect(lines).toEqual(['a'])
    expect(warnings.some((w) => /runtime error/.test(w))).toBe(true)
  })

  it('sketches cannot reach the host globals', () => {
    const { mcu } = harness()
    expect(() => mcu.load(`void setup(){ window.x = 1; }`)).toThrow(TranspileError)
  })
})

describe('VirtualMcu: realistic sketches', () => {
  it('non-blocking blink with millis(), button with pull-up, else-if chains, char* and F()', async () => {
    let button: 0 | 1 = 1
    const { mcu, pins, lines, warnings } = harness({ digital: () => button })
    mcu.load(`
      const char* NAME = "demo";
      const int BTN = 2;
      unsigned long last = 0;
      bool on = false;
      int mode = 0;
      void setup() {
        pinMode(BTN, INPUT_PULLUP);
        pinMode(LED_BUILTIN, OUTPUT);
        Serial.begin(9600);
        Serial.println(F("start"));
        Serial.println(NAME);
      }
      void loop() {
        if (digitalRead(BTN) == LOW) mode = 1;
        else if (mode == 1) mode = 2;
        else mode = 0;
        if (millis() - last >= 100) {
          last = millis();
          on = !on;
          digitalWrite(LED_BUILTIN, on ? HIGH : LOW);
        }
        if (mode == 1) { Serial.println("pressed"); mode = 3; }
      }`)
    mcu.start()
    await mcu.advance(350)
    button = 0
    await mcu.advance(10)
    expect(lines.slice(0, 2)).toEqual(['start', 'demo'])
    expect(lines).toContain('pressed')
    const led = pins.filter((p) => p.pin === 13).map((p) => p.state.level)
    expect(led.slice(0, 4)).toEqual([0, 1, 0, 1])
    expect(warnings).toEqual([])
  })
})
