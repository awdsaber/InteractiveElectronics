// Modified nodal analysis: a dense linear system A·x = b, stamping helpers and a
// sparsity-aware LU factorisation (dense storage; per-row/column nonzero extents are
// tracked so banded circuit matrices factor in ~O(n·band²) instead of O(n³)).
// Index -1 is ground and is silently skipped by every helper.

export interface LinearSystem {
  size: number
  /** row-major size × size */
  A: Float64Array
  b: Float64Array
  /** when true, matrix writes are skipped (matrix reused from a cached factorisation) */
  rhsOnly: boolean
  /** first / last nonzero column per row, last nonzero row per column (n / -1 when empty) */
  rf: Int32Array
  rl: Int32Array
  cl: Int32Array
}

export function createSystem(size: number): LinearSystem {
  const sys: LinearSystem = {
    size,
    A: new Float64Array(size * size),
    b: new Float64Array(size),
    rhsOnly: false,
    rf: new Int32Array(size),
    rl: new Int32Array(size),
    cl: new Int32Array(size),
  }
  clearSystem(sys)
  return sys
}

export function clearSystem(sys: LinearSystem): void {
  if (!sys.rhsOnly) {
    sys.A.fill(0)
    sys.rf.fill(sys.size)
    sys.rl.fill(-1)
    sys.cl.fill(-1)
  }
  sys.b.fill(0)
}

export function addA(sys: LinearSystem, row: number, col: number, v: number): void {
  if (row < 0 || col < 0 || sys.rhsOnly) return
  sys.A[row * sys.size + col] += v
  if (col < sys.rf[row]) sys.rf[row] = col
  if (col > sys.rl[row]) sys.rl[row] = col
  if (row > sys.cl[col]) sys.cl[col] = row
}

export function addB(sys: LinearSystem, row: number, v: number): void {
  if (row < 0) return
  sys.b[row] += v
}

/** conductance g between nodes i and j */
export function stampConductance(sys: LinearSystem, i: number, j: number, g: number): void {
  if (sys.rhsOnly) return
  addA(sys, i, i, g)
  addA(sys, j, j, g)
  addA(sys, i, j, -g)
  addA(sys, j, i, -g)
}

/** independent current `I` flowing out of node i, through the element, into node j */
export function stampCurrent(sys: LinearSystem, i: number, j: number, I: number): void {
  addB(sys, i, -I)
  addB(sys, j, I)
}

/**
 * Branch-variable voltage source: V(p) - V(n) - r·i = v, with branch current i
 * flowing from p through the source to n.
 */
export function stampVoltageSource(sys: LinearSystem, p: number, n: number, k: number, v: number, r = 0): void {
  addA(sys, p, k, 1)
  addA(sys, n, k, -1)
  addA(sys, k, p, 1)
  addA(sys, k, n, -1)
  if (r !== 0) addA(sys, k, k, -r)
  addB(sys, k, v)
}

/**
 * Linearised two-terminal nonlinear element: current i(v) into terminal a (out at b),
 * linearised at v with slope g.
 */
export function stampNonlinear2(sys: LinearSystem, a: number, b: number, v: number, i: number, g: number): void {
  stampConductance(sys, a, b, g)
  stampCurrent(sys, a, b, i - g * v)
}

/**
 * Linearised three-terminal device with two controlling voltages
 * v0 = V(c0p) - V(c0n), v1 = V(c1p) - V(c1n).
 * `I0..I2` are currents into terminals t0..t2, `gXY` = dI_X / dv_Y.
 */
export function stampNonlinear3(
  sys: LinearSystem,
  t0: number,
  t1: number,
  t2: number,
  c0p: number,
  c0n: number,
  c1p: number,
  c1n: number,
  v0: number,
  v1: number,
  I0: number,
  I1: number,
  I2: number,
  g00: number,
  g01: number,
  g10: number,
  g11: number,
  g20: number,
  g21: number,
): void {
  row(sys, t0, c0p, c0n, c1p, c1n, v0, v1, I0, g00, g01)
  row(sys, t1, c0p, c0n, c1p, c1n, v0, v1, I1, g10, g11)
  row(sys, t2, c0p, c0n, c1p, c1n, v0, v1, I2, g20, g21)
}

function row(
  sys: LinearSystem,
  t: number,
  c0p: number,
  c0n: number,
  c1p: number,
  c1n: number,
  v0: number,
  v1: number,
  I: number,
  g0: number,
  g1: number,
): void {
  if (t < 0) return
  // always touch the entries so the sparsity extents don't depend on the operating point
  addA(sys, t, c0p, g0)
  addA(sys, t, c0n, -g0)
  addA(sys, t, c1p, g1)
  addA(sys, t, c1n, -g1)
  addB(sys, t, -(I - g0 * v0 - g1 * v1))
}

/**
 * Restore `sys` matrix to a cached base (`A0` with extents rf0/rl0/cl0), touching only the
 * union of the current and base row extents.
 */
export function restoreMatrix(sys: LinearSystem, A0: Float64Array, rf0: Int32Array, rl0: Int32Array, cl0: Int32Array): void {
  const n = sys.size
  const A = sys.A
  for (let r = 0; r < n; r++) {
    const lo = Math.min(sys.rf[r], rf0[r])
    const hi = Math.max(sys.rl[r], rl0[r])
    for (let q = r * n + lo, end = r * n + hi; q <= end; q++) A[q] = A0[q]
  }
  sys.rf.set(rf0)
  sys.rl.set(rl0)
  sys.cl.set(cl0)
}

// ───────────────────────── LU ─────────────────────────

export interface LUWork {
  n: number
  /** in-place L (unit, below diagonal) and U */
  LU: Float64Array
  /** row swapped into position k at step k */
  piv: Int32Array
  /** per row: nonzero columns of L (lStart/lIdx) and of strict U (uStart/uIdx) */
  lStart: Int32Array
  lIdx: Int32Array
  uStart: Int32Array
  uIdx: Int32Array
  rows: Int32Array
  cols: Int32Array
  rf: Int32Array
  rl: Int32Array
  cl: Int32Array
  /** LU holds factors from a previous call (cleared by extents next time) */
  dirty: boolean
}

export function createLU(n: number): LUWork {
  const tri = (n * (n - 1)) / 2 + 1
  return {
    n,
    LU: new Float64Array(n * n),
    piv: new Int32Array(n),
    lStart: new Int32Array(n + 1),
    lIdx: new Int32Array(tri),
    uStart: new Int32Array(n + 1),
    uIdx: new Int32Array(tri),
    rows: new Int32Array(n),
    cols: new Int32Array(n),
    rf: new Int32Array(n),
    rl: new Int32Array(n),
    cl: new Int32Array(n),
    dirty: false,
  }
}

/** a pivot this small relative to its column's original magnitude means the branch equations are dependent */
export const BRANCH_PIVOT_RTOL = 1e-13

/**
 * LU with partial pivoting. Returns false when singular: an exactly-zero pivot, or (for
 * branch-variable columns, where `isNode[col]` is 0) a pivot that collapsed below
 * BRANCH_PIVOT_RTOL of the column's original size — a voltage-source / inductor loop hidden
 * by roundoff. Node columns are not tested relatively: tiny gmin-only pivots are legitimate.
 */
export function luFactor(sys: LinearSystem, lu: LUWork, isNode?: Uint8Array): boolean {
  const n = sys.size
  const a = lu.LU
  const { piv, rows, cols, rf, rl, cl } = lu
  // clear the previous factors (all nonzeros lie inside each row's [rf, rl]) and copy A by extents
  if (lu.dirty) {
    for (let r = 0; r < n; r++) for (let q = r * n + rf[r], end = r * n + rl[r]; q <= end; q++) a[q] = 0
  } else a.fill(0)
  const A = sys.A
  for (let r = 0; r < n; r++) {
    const lo = sys.rf[r]
    const hi = sys.rl[r]
    for (let q = r * n + lo, end = r * n + hi; q <= end; q++) a[q] = A[q]
  }
  lu.dirty = true
  rf.set(sys.rf)
  rl.set(sys.rl)
  cl.set(sys.cl)
  const A0 = sys.A

  for (let col = 0; col < n; col++) {
    let p = col
    let best = Math.abs(a[col * n + col])
    let nr = 0
    const last = cl[col]
    for (let r = col + 1; r <= last; r++) {
      const v = a[r * n + col]
      if (v === 0) continue
      rows[nr++] = r
      const av = Math.abs(v)
      if (av > best) {
        best = av
        p = r
      }
    }
    if (!(best > 1e-300)) return false
    if (isNode && !isNode[col]) {
      let colMax = 0
      for (let r = 0; r <= sys.cl[col]; r++) colMax = Math.max(colMax, Math.abs(A0[r * n + col]))
      if (best <= BRANCH_PIVOT_RTOL * colMax) return false
    }
    piv[col] = p
    if (p !== col) {
      const pr = p * n
      const cr = col * n
      const lo = Math.min(rf[p], rf[col])
      const hi = Math.max(rl[p], rl[col])
      for (let c = lo; c <= hi; c++) {
        const t = a[cr + c]
        a[cr + c] = a[pr + c]
        a[pr + c] = t
      }
      let t = rf[p]
      rf[p] = rf[col]
      rf[col] = t
      t = rl[p]
      rl[p] = rl[col]
      rl[col] = t
      // the old pivot row now sits at p: extend column extents it touches
      for (let c = col; c <= rl[p]; c++) if (a[pr + c] !== 0 && cl[c] < p) cl[c] = p
      // row p was in the update list; the old pivot row takes its place if it has an entry here
      for (let k = 0; k < nr; k++) {
        if (rows[k] === p) {
          if (a[pr + col] === 0) rows[k] = rows[--nr]
          break
        }
      }
    }
    const prow = col * n
    let nc = 0
    const plast = rl[col]
    for (let c = col + 1; c <= plast; c++) if (a[prow + c] !== 0) cols[nc++] = c
    const d = a[prow + col]
    for (let k = 0; k < nr; k++) {
      const r = rows[k]
      const rr = r * n
      const f = a[rr + col] / d
      a[rr + col] = f
      for (let m = 0; m < nc; m++) {
        const c = cols[m]
        a[rr + c] -= f * a[prow + c]
        if (cl[c] < r) cl[c] = r
      }
      if (rl[r] < plast) rl[r] = plast
    }
  }

  // sparse index of the final factors for fast repeated solves
  let li = 0
  let ui = 0
  for (let r = 0; r < n; r++) {
    lu.lStart[r] = li
    lu.uStart[r] = ui
    const rr = r * n
    for (let c = rf[r]; c < r; c++) if (a[rr + c] !== 0) lu.lIdx[li++] = c
    for (let c = r + 1; c <= rl[r]; c++) if (a[rr + c] !== 0) lu.uIdx[ui++] = c
  }
  lu.lStart[n] = li
  lu.uStart[n] = ui
  return true
}

/** solve with a factorisation from luFactor; writes into `x` (may not alias b). Returns false if not finite. */
export function luSolve(lu: LUWork, b: Float64Array, x: Float64Array): boolean {
  const n = lu.n
  const a = lu.LU
  x.set(b)
  for (let k = 0; k < n; k++) {
    const p = lu.piv[k]
    if (p !== k) {
      const t = x[k]
      x[k] = x[p]
      x[p] = t
    }
  }
  for (let r = 0; r < n; r++) {
    let s = x[r]
    const rr = r * n
    for (let q = lu.lStart[r]; q < lu.lStart[r + 1]; q++) {
      const c = lu.lIdx[q]
      s -= a[rr + c] * x[c]
    }
    x[r] = s
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = x[r]
    const rr = r * n
    for (let q = lu.uStart[r]; q < lu.uStart[r + 1]; q++) {
      const c = lu.uIdx[q]
      s -= a[rr + c] * x[c]
    }
    s /= a[rr + r]
    if (!Number.isFinite(s)) return false
    x[r] = s
  }
  return true
}

/** convenience one-shot solve (allocates); returns null if singular */
export function solveLinear(sys: LinearSystem): Float64Array | null {
  const lu = createLU(sys.size)
  if (!luFactor(sys, lu)) return null
  const x = new Float64Array(sys.size)
  return luSolve(lu, sys.b, x) ? x : null
}

/**
 * Relative residual check: |(A·x - b)_i| ≤ rtol·(Σ_j |A_ij·x_j| + |b_i|) + atol for every row.
 */
export function residualOk(sys: LinearSystem, x: Float64Array, rtol = 1e-8, atol = 1e-12): boolean {
  const n = sys.size
  const A = sys.A
  for (let r = 0; r < n; r++) {
    const rr = r * n
    let s = -sys.b[r]
    let mag = Math.abs(sys.b[r])
    for (let c = sys.rf[r]; c <= sys.rl[r]; c++) {
      const v = A[rr + c]
      if (v === 0) continue
      const t = v * x[c]
      s += t
      mag += Math.abs(t)
    }
    if (!(Math.abs(s) <= rtol * mag + atol)) return false
  }
  return true
}
