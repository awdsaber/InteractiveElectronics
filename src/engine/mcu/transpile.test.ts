import { describe, expect, it } from 'vitest'
import { TranspileError, transpile } from './index'

function errorOf(src: string): TranspileError {
  try {
    transpile(src)
  } catch (e) {
    if (e instanceof TranspileError) return e
    throw e
  }
  throw new Error('expected TranspileError')
}

describe('transpile: output shape', () => {
  it('turns functions into async functions and awaits user calls and delay', () => {
    const { js } = transpile(`int f(int x){ return x; } void setup(){ delay(5); int y = f(2); }`)
    expect(js).toContain('async function f')
    expect(js).toContain('async function setup')
    expect(js).toMatch(/await\s+delay\s*\(/)
    expect(js).toMatch(/await\s+f\s*\(/)
  })

  it('rewrites declarations to let/const', () => {
    const { js } = transpile(`const int A = 1; int a = 1, b[3] = {1,2,3}; unsigned long t = 0; Servo s;`)
    expect(js).toMatch(/const\s+A\s*=/)
    expect(js).toMatch(/let\s+a\s*=/)
    expect(js).toContain('[ 1 , 2 , 3 ]')
    expect(js).toMatch(/let\s+s\s*=\s*new\s+Servo\s*\(\s*\)/)
    expect(js).not.toMatch(/\bint\b|\bunsigned\b|\blong\b/)
  })

  it('does not rewrite text inside strings or comments', () => {
    const { js } = transpile(`void setup(){ Serial.println("int x = delay(5); // hi"); } // int y;`)
    expect(js).toContain('"int x = delay(5); // hi"')
    expect(js).not.toContain('int y')
  })

  it('ignores known includes silently and warns about unknown ones', () => {
    expect(transpile(`#include <Servo.h>\n#include <Wire.h>\nvoid setup(){}`).warnings).toEqual([])
    const w = transpile(`#include <FancyLib.h>\nvoid setup(){}`).warnings
    expect(w).toHaveLength(1)
    expect(w[0]).toContain('FancyLib.h')
    expect(w[0]).toContain('1')
    expect(transpile(`#include <FancyLib.h>\n`, { knownLibraries: ['FancyLib'] }).warnings).toEqual([])
  })
})

describe('transpile: errors carry line numbers', () => {
  it('missing semicolon', () => {
    const e = errorOf(`void setup() {\n  int a = 1;\n  int b = 2\n  a = b;\n}`)
    expect(e.line).toBe(3)
    expect(e.message).toMatch(/;/)
  })

  it('unclosed brace points at the opener', () => {
    expect(errorOf(`void setup() {\n  if (1) {\n    int a = 1;\n  }\n`).line).toBe(1)
  })

  it('stray closing paren', () => {
    expect(errorOf(`void setup() {\n  foo(1));\n}`).line).toBe(2)
  })

  it('mismatched brackets', () => {
    expect(errorOf(`void setup() {\n  int a[3 = {1};\n}`).line).toBe(2)
  })

  it('unterminated string and comment', () => {
    expect(errorOf(`void setup() {\n\n  Serial.println("abc);\n}`).line).toBe(3)
    expect(errorOf(`void setup() {}\n/* never closed\n`).line).toBe(2)
  })

  it('unsupported syntax', () => {
    expect(errorOf(`void setup(){}\nstruct P { int x; };`).line).toBe(2)
    expect(errorOf(`int *p;`).line).toBe(1)
    expect(errorOf(`#define SQ(x) ((x)*(x))\n`).line).toBe(1)
    expect(errorOf(`void f(int &r){}`).line).toBe(1)
    expect(errorOf(`#ifdef FOO\n#endif`).line).toBe(1)
    expect(errorOf(`void setup(){\n  goto end;\n}`).line).toBe(2)
  })

  it('const without initializer and a bad character', () => {
    expect(errorOf(`const int a;`).line).toBe(1)
    expect(errorOf(`void setup(){\n  int a = 3 @ 4;\n}`).line).toBe(2)
  })

  it('does not flag legal multi-line code', () => {
    expect(() =>
      transpile(`
        int table[] = {
          1, 2,
          3
        };
        void setup()
        {
          int x = 1 +
                  2;
          if (x)
            x++;
          else
            x--;
          for (int i = 0;
               i < 3;
               i++)
            x += i;
          Serial.println(x
            + 1);
        }`),
    ).not.toThrow()
  })
})

describe('transpile: loop guard', () => {
  it('instruments while, for and do-while conditions', () => {
    const { js } = transpile(`void loop(){ while (1) {} for (;;) {} do { } while (0); }`)
    expect(js.match(/__g\.pause/g)?.length).toBe(3)
  })
})
