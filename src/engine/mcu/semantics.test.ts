import { describe, expect, it } from 'vitest'
import { BUILTIN_NAMES, TranspileError, VirtualMcu, transpile } from './index'

async function run(src: string, opts: { analog?: (pin: number) => number; ms?: number } = {}) {
  const lines: string[] = []
  const warnings: string[] = []
  const mcu = new VirtualMcu({
    vcc: 5,
    onPin: () => undefined,
    readAnalog: opts.analog ?? (() => 0),
    readDigital: () => 0,
    serial: (l) => lines.push(l),
    warn: (m) => warnings.push(m),
  })
  mcu.load(src)
  mcu.start()
  await mcu.advance(opts.ms ?? 1)
  return { lines, warnings, mcu }
}

function errorOf(src: string): TranspileError {
  try {
    transpile(src)
  } catch (e) {
    if (e instanceof TranspileError) return e
    throw e
  }
  throw new Error('expected TranspileError')
}

describe('integer division follows C', () => {
  it('truncates between int operands in print, declarations and call arguments', async () => {
    const { lines } = await run(`
      void setup() {
        int x = 5;
        int a = 7, b = 2;
        float r = x / 2;
        float f = x / 2.0;
        Serial.println(x / 2);
        Serial.println(r);
        Serial.println(f);
        Serial.println(a / b);
        Serial.println(5 / 2);
        Serial.println((x + 1) / 4);
        Serial.println(x * 3 / 2);
        Serial.println(map(x / 2, 0, 4, 0, 100));
        Serial.println(millis() / 1000);
        Serial.println(-7 / 2);
      }`)
    expect(lines).toEqual(['2', '2.00', '2.50', '3', '2', '1', '7', '50', '0', '-3'])
  })

  it('keeps float division when either side is float', async () => {
    const { lines } = await run(
      `
      const float VREF = 5.0;
      void setup() {
        int x = 5;
        Serial.println(analogRead(A0) * 5.0 / 1023.0);
        Serial.println(x * 2.0 / 4);
        Serial.println((float)x / 2);
        Serial.println((int)(x * 1.5) / 2);
        Serial.println(x / VREF);
        float v = analogRead(A0) * VREF / 1023;
        Serial.println(v);
      }`,
      { analog: () => 2.5 },
    )
    expect(lines).toEqual(['2.50', '2.50', '2.50', '3', '1.00', '2.50'])
  })

  it('compound assignment truncates for int variables', async () => {
    const { lines } = await run(`
      void setup() {
        int x = 5, y = 7;
        x += y / 2;
        Serial.println(x);
        x /= 2;
        Serial.println(x);
        int k = 5;
        k += k / 2.0;
        Serial.println(k);
        int m = 10;
        m *= 0.75;
        Serial.println(m);
      }`)
    expect(lines).toEqual(['8', '4', '7', '7'])
  })

  it('byte wraps at 256', async () => {
    const { lines } = await run(`
      void setup() {
        byte b = 255;
        b++;
        Serial.println(b);
        byte c = 250;
        c += 10;
        Serial.println(c);
        uint8_t d = 0;
        d--;
        Serial.println(d);
        byte e = 300;
        Serial.println(e);
      }`)
    expect(lines).toEqual(['0', '4', '255', '44'])
  })
})

describe('char literals are numeric', () => {
  it('supports arithmetic and comparisons', async () => {
    const { lines } = await run(`
      void setup() {
        Serial.println('a' - 'A');
        int d = 7;
        Serial.println('0' + d);
        char z = 'A' + 1;
        Serial.println(z);
        Serial.println(z == 'B');
        Serial.println('\\n' + 0);
        Serial.println('\\'' + 0);
      }`)
    expect(lines).toEqual(['32', '55', 'B', '1', '10', '39'])
  })

  it('prints char variables and literals as characters, numbers when a base is given', async () => {
    const { lines } = await run(`
      void setup() {
        char c = 'a';
        Serial.println(c);
        Serial.println('x');
        Serial.println(c, DEC);
        Serial.println(c + 1);
        Serial.println((char)(c + 1));
        Serial.print('<'); Serial.print(c); Serial.println('>');
      }`)
    expect(lines).toEqual(['a', 'x', '97', '98', 'b', '<a>'])
  })

  it('char arrays and strings', async () => {
    const { lines } = await run(`
      void setup() {
        char buf[] = "hi";
        Serial.println(buf);
        Serial.println(buf[0]);
        Serial.println(sizeof(buf));
        String s = "x";
        s += 'c';
        s = s + 'd';
        Serial.println(s);
        Serial.println("a" + String('b'));
        String t = "ab";
        Serial.println(t[1]);
        Serial.println(t[0] == 'a');
        char up = 'q' - 32;
        switch (up) { case 'Q': Serial.println("Q!"); break; default: Serial.println("?"); }
      }`)
    expect(lines).toEqual(['hi', 'h', '3', 'xcd', 'ab', 'b', '1', 'Q!'])
  })
})

describe('error reporting', () => {
  it('maps JS parse errors that slip past the structural checks to the Arduino line', () => {
    const e = errorOf(`void setup() {\n  int a = 3;\n  a = 5 +* 2;\n  a = 1;\n}`)
    expect(e.line).toBe(3)
  })

  it('flags unknown identifiers at transpile time with the line', () => {
    expect(errorOf(`void setup() {\n  int a = 1;\n  fooBar(3);\n}`).line).toBe(3)
    expect(errorOf(`void setup() {\n\n  y = 3;\n}`).line).toBe(3)
    expect(errorOf(`void setup() {\n  int a = 1;\n  a = b + 1;\n}`).message).toMatch(/'b'/)
    expect(errorOf(`void setup() {\n  shiftOut(8, 9, MSBFIRST, 1);\n}`).message).toMatch(/'shiftOut' is not supported by the simulator yet/)
  })

  it('does not flag declared names, functions, params, defines, constants, libraries', () => {
    expect(() =>
      transpile(`
        #define N 3
        int g = N;
        int f(int p) { int loc = p + g; return loc; }
        void setup() { pinMode(LED_BUILTIN, OUTPUT); int r = f(HIGH) + A0 + sizeof(g); Serial.println(r); mpu.go(); }`, { knownLibraries: ['mpu'] }),
    ).not.toThrow()
  })

  it('every builtin name used by the checker exists in the sandbox API', () => {
    const mcu = new VirtualMcu({ vcc: 5, onPin: () => undefined, readAnalog: () => 0, readDigital: () => 0, serial: () => undefined })
    const api = new Set(mcu.apiNames())
    for (const name of BUILTIN_NAMES) expect(api.has(name), name).toBe(true)
  })

  it('runtime errors include the Arduino line', async () => {
    const { lines, warnings } = await run(`void setup() {\n  Serial.println("a");\n  int a[2];\n  a[9].v = 1;\n  Serial.println("b");\n}`)
    expect(lines).toEqual(['a'])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/line 4/)
  })
})
