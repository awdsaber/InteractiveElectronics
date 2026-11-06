// Pure layout helpers for lesson authors (no three.js import, so lessons stay plain data).
// They mirror the 3D part library's geometry; layout.test.ts checks they agree.

/** 0.1" pitch in board units (1 unit = 10 mm) */
export const PITCH = 0.254
/** top of the cutting mat: off-board parts stand here */
export const BENCH_Y = -0.18
/** half-size breadboard: 8.25 × 5.5, holes 0.85 above its base */
export const BB_H = 0.85

const ROWS = 'abcdefghij'

/**
 * World [x, y, z] of a breadboard hole for a breadboard placed at `bb` ([x, z] on the mat).
 * `col` 1..30; `row` 'a'..'j' (a is farthest from the viewer) or a rail '+t' '-t' '-b' '+b'.
 */
export function bbHole(bb: [number, number], col: number, row: string): [number, number, number] {
  const x = bb[0] + (col - 15.5) * PITCH
  const y = BENCH_Y + BB_H
  const rails: Record<string, number> = { '+t': -2.286, '-t': -2.032, '-b': 2.032, '+b': 2.286 }
  if (row in rails) return [x, y, bb[1] + rails[row]]
  const i = ROWS.indexOf(row)
  if (i < 0) throw new RangeError(`no breadboard row ${row}`)
  const z = i < 5 ? -0.381 - (4 - i) * PITCH : 0.381 + (i - 5) * PITCH
  return [x, y, bb[1] + z]
}

/** Midpoint of two holes, for a 2-lead part (resistor rot 0 spans 4 holes, LED spans 1). */
export function between(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [(a[0] + b[0]) / 2, Math.max(a[1], b[1]), (a[2] + b[2]) / 2]
}

/** Uno-style module at `uno` ([x, z] on the mat, rot 0, USB toward the viewer). */
export const UNO = {
  /** header socket tops above the mat */
  headerY: BENCH_Y + 0.16 + 0.85,
  /**
   * Digital header socket (D0..D13, GND, AREF): the header runs along the board's −X edge.
   * Returns the world position of the socket's top.
   */
  digital(uno: [number, number], pin: number | 'GND' | 'AREF'): [number, number, number] {
    // along the header, in the module's own frame (connector edge at −X, rotated to face +Z)
    let lx: number
    if (pin === 'GND') lx = -0.25 + (3 - 4.5) * PITCH
    else if (pin === 'AREF') lx = -0.25 + (2 - 4.5) * PITCH
    else if (pin < 8) lx = 2.35 + (3.5 - pin) * PITCH
    else lx = -0.25 + (4.5 - (pin - 8)) * PITCH
    return [uno[0] - 2.4, UNO.headerY, uno[1] - lx]
  },
}

/**
 * A jumper wire part's `pos` and `params.points` from two world points. `pos` sits just under the
 * arch's apex, so the wire's callout points at the top of the arch.
 */
export function jumper(a: [number, number, number], b: [number, number, number], color: string, lift?: number) {
  const dist = Math.hypot(b[0] - a[0], b[2] - a[2])
  const apex = Math.max(a[1], b[1]) + 0.02 + (lift ?? 0.18 + dist * 0.18)
  const m: [number, number, number] = [(a[0] + b[0]) / 2, +(apex - WIRE_H).toFixed(4), (a[2] + b[2]) / 2]
  const rel = (p: [number, number, number]) => [+(p[0] - m[0]).toFixed(4), +(p[1] + 0.02 - m[1]).toFixed(4), +(p[2] - m[2]).toFixed(4)]
  return { pos: m, params: { points: [rel(a), rel(b)], color, ...(lift !== undefined ? { lift } : {}) } }
}

/** the wire part's nominal height (its callout anchor sits this far above `pos`) */
const WIRE_H = 0.3
