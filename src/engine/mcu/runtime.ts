// Pure helpers used by transpiled sketches (math, formatting, array helpers).

/** Marks a value that the transpiler knows is a float, so Serial.print uses decimals. */
export class FloatBox {
  readonly v: number
  constructor(v: number) {
    this.v = v
  }
}

/** Marks a value that is a char (numeric code) so Serial.print shows the character. */
export class CharBox {
  readonly c: number
  constructor(c: number) {
    this.c = c
  }
}

/** `char s[] = "hi"` -> char codes plus the terminating 0. */
export function cstr(s: string): number[] {
  return [...s].map((ch) => ch.charCodeAt(0) & 0xff).concat(0)
}

export function toInt(v: unknown): unknown {
  if (typeof v === 'number') return Math.trunc(v)
  if (typeof v === 'boolean') return v ? 1 : 0
  return v
}

/** `(int)x` cast: numbers truncate, booleans become 0/1, one-character strings become their code. */
export function castInt(v: unknown): unknown {
  if (typeof v === 'string' && v.length === 1) return v.charCodeAt(0)
  return toInt(v)
}

export const u8 = (v: number): number => Math.trunc(Number(v)) & 0xff
export const u16 = (v: number): number => Math.trunc(Number(v)) & 0xffff
export const chr = (v: unknown): unknown => (typeof v === 'number' ? String.fromCharCode(v & 0xff) : v)

/** `int a[2][3]` -> nested zero-filled arrays. */
export function makeArray(dims: number[], fill: unknown): unknown[] {
  const [n, ...rest] = dims
  const len = Math.max(0, Math.trunc(Number(n)))
  return Array.from({ length: len }, () => (rest.length ? makeArray(rest, fill) : fill))
}

/** `int a[5] = {1, 2}` -> pad with the fill value, as C does. */
export function padArray(init: unknown[], len: number, fill: unknown): unknown[] {
  const out = init.slice()
  while (out.length < len) out.push(fill)
  return out
}

/** sizeof for values: element count for arrays (the idiom sizeof(a)/sizeof(a[0])), else 1. */
export function sizeOf(v: unknown): number {
  return Array.isArray(v) ? v.length : 1
}

export function arduinoMap(x: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const [a, b, c, d, e] = [x, inMin, inMax, outMin, outMax].map((n) => Math.trunc(Number(n)))
  if (c === b) return d
  return Math.trunc(((a - b) * (e - d)) / (c - b)) + d
}

export function constrain(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/** Arduino round(): half away from zero. */
export function arduinoRound(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x)
}

/** Deterministic PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Format a value the way Serial.print would. `fmt` is the base for integers or the digits for floats. */
export function formatPrint(v: unknown, fmt?: number): string {
  if (v instanceof FloatBox) return formatNumber(v.v, fmt, true)
  if (v instanceof CharBox) return fmt === undefined ? String.fromCharCode(v.c) : formatNumber(v.c, fmt, false)
  if (Array.isArray(v)) {
    // a char array prints as a C string (up to the terminating 0)
    const end = v.indexOf(0)
    return v
      .slice(0, end < 0 ? v.length : end)
      .map((c) => String.fromCharCode(Number(c)))
      .join('')
  }
  if (typeof v === 'number') return formatNumber(v, fmt, false)
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (v === undefined || v === null) return ''
  return String(v)
}

function formatNumber(n: number, fmt: number | undefined, isFloat: boolean): string {
  if (Number.isNaN(n)) return 'nan'
  if (!Number.isFinite(n)) return n < 0 ? '-inf' : 'inf'
  if (isFloat) return n.toFixed(fmt === undefined ? 2 : Math.max(0, Math.trunc(fmt)))
  if (!Number.isInteger(n)) return n.toFixed(2)
  if (fmt === 2 || fmt === 8 || fmt === 16) return (n < 0 ? n >>> 0 : n).toString(fmt).toUpperCase()
  return String(n)
}

// ── fixed-width integers (board semantics) ──

function intOf(v: unknown): number {
  const x = castInt(v)
  const n = typeof x === 'number' ? x : Number(x)
  return Number.isFinite(n) ? n : 0
}
/** int8_t */
export const i8 = (v: unknown): number => (intOf(v) << 24) >> 24
/** Uno int / short / int16_t */
export const i16 = (v: unknown): number => (intOf(v) << 16) >> 16
/** Uno unsigned int / uint16_t / word */
export const u16w = (v: unknown): number => intOf(v) & 0xffff
/** long / int32_t, and int on the ESP32 */
export const i32 = (v: unknown): number => intOf(v) | 0
/** unsigned long / uint32_t */
export const u32 = (v: unknown): number => intOf(v) >>> 0

// ── bitSet / bitClear / bitWrite (the transpiler turns them into x = helper(x, ...)) ──

export const bitSetFn = (x: number, n: number): number => Math.trunc(Number(x)) | (1 << n)
export const bitClearFn = (x: number, n: number): number => Math.trunc(Number(x)) & ~(1 << n)
export const bitWriteFn = (x: number, n: number, b: unknown): number => (b ? bitSetFn(x, n) : bitClearFn(x, n))

// ── Arduino String methods ──
// Sketch strings are JS strings. `s.method(args)` on a String-only method becomes `__S.method(s, args)`; the methods that
// change the String in place get a setter as their second argument. A non-string receiver (a library object with a
// method of the same name) is passed through to its own method.

type Setter = ((v: string) => void) | null
const asText = (v: unknown): string => (typeof v === 'number' ? String.fromCharCode(v & 0xff) : String(v))
const passThrough = (x: unknown, m: string, args: unknown[]): unknown => {
  const f = (x as Record<string, unknown> | null | undefined)?.[m]
  if (typeof f !== 'function') throw new TypeError(`.${m}() is not available on this value`)
  return (f as (...a: unknown[]) => unknown).apply(x, args)
}

function pure(m: string, fn: (s: string, ...args: unknown[]) => unknown) {
  return (x: unknown, ...args: unknown[]): unknown => (typeof x === 'string' ? fn(x, ...args) : passThrough(x, m, args))
}
function inPlace(m: string, fn: (s: string, ...args: unknown[]) => string, ret: unknown = undefined) {
  return (x: unknown, set: Setter, ...args: unknown[]): unknown => {
    if (typeof x !== 'string') return passThrough(x, m, args)
    set?.(fn(x, ...args))
    return ret
  }
}

const INT_RE = /^\s*[+-]?\d+/
const FLOAT_RE = /^\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/
const parseLeadingFloat = (s: string): number => {
  const m = FLOAT_RE.exec(s)
  return m ? parseFloat(m[0]) : 0
}

export const STRING_METHODS = {
  toInt: pure('toInt', (s) => {
    const m = INT_RE.exec(s)
    return m ? parseInt(m[0], 10) | 0 : 0
  }),
  toFloat: pure('toFloat', parseLeadingFloat),
  toDouble: pure('toDouble', parseLeadingFloat),
  indexOf: pure('indexOf', (s, v, from) => s.indexOf(asText(v), from === undefined ? 0 : Number(from))),
  lastIndexOf: pure('lastIndexOf', (s, v, from) => s.lastIndexOf(asText(v), from === undefined ? Infinity : Number(from))),
  substring: pure('substring', (s, a, b) => s.substring(Number(a), b === undefined ? undefined : Number(b))),
  charAt: pure('charAt', (s, i) => {
    const k = Math.trunc(Number(i))
    return k >= 0 && k < s.length ? s.charCodeAt(k) & 0xff : 0
  }),
  equals: pure('equals', (s, o) => s === String(o)),
  equalsIgnoreCase: pure('equalsIgnoreCase', (s, o) => s.toLowerCase() === String(o).toLowerCase()),
  startsWith: pure('startsWith', (s, p, off) => s.startsWith(String(p), off === undefined ? 0 : Number(off))),
  endsWith: pure('endsWith', (s, p) => s.endsWith(String(p))),
  compareTo: pure('compareTo', (s, o) => (s < String(o) ? -1 : s > String(o) ? 1 : 0)),
  c_str: pure('c_str', (s) => s),
  toUpperCase: inPlace('toUpperCase', (s) => s.toUpperCase()),
  toLowerCase: inPlace('toLowerCase', (s) => s.toLowerCase()),
  trim: inPlace('trim', (s) => s.trim()),
  replace: inPlace('replace', (s, a, b) => s.split(asText(a)).join(asText(b))),
  remove: inPlace('remove', (s, i, n) => {
    const k = Math.trunc(Number(i))
    return n === undefined ? s.slice(0, k) : s.slice(0, k) + s.slice(k + Math.trunc(Number(n)))
  }),
  concat: inPlace('concat', (s, v) => s + formatPrint(v), 1),
}

/** Methods the transpiler routes through STRING_METHODS; the in-place ones take a setter. */
export const STRING_METHOD_NAMES: ReadonlySet<string> = new Set(Object.keys(STRING_METHODS))
export const STRING_INPLACE: ReadonlySet<string> = new Set(['toUpperCase', 'toLowerCase', 'trim', 'replace', 'remove', 'concat'])
export const STRING_INT_METHODS: ReadonlySet<string> = new Set(['toInt', 'indexOf', 'lastIndexOf', 'compareTo', 'charAt'])
export const STRING_FLOAT_METHODS: ReadonlySet<string> = new Set(['toFloat', 'toDouble'])
