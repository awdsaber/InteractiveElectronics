// Pure helpers used by transpiled sketches (math, formatting, array helpers).

/** Marks a value that the transpiler knows is a float, so Serial.print uses decimals. */
export class FloatBox {
  readonly v: number
  constructor(v: number) {
    this.v = v
  }
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
