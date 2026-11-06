// Modified nodal analysis: a dense linear system A·x = b plus stamping helpers.
// Unknowns are node voltages (indices 0..nNodes-1) followed by branch variables.
// Index -1 is ground and is silently skipped by every helper.

export interface LinearSystem {
  size: number
  /** row-major size × size */
  A: Float64Array
  b: Float64Array
}

export function createSystem(size: number): LinearSystem {
  return { size, A: new Float64Array(size * size), b: new Float64Array(size) }
}

export function clearSystem(sys: LinearSystem): void {
  sys.A.fill(0)
  sys.b.fill(0)
}

export function addA(sys: LinearSystem, row: number, col: number, v: number): void {
  if (row < 0 || col < 0) return
  sys.A[row * sys.size + col] += v
}

export function addB(sys: LinearSystem, row: number, v: number): void {
  if (row < 0) return
  sys.b[row] += v
}

/** conductance g between nodes i and j */
export function stampConductance(sys: LinearSystem, i: number, j: number, g: number): void {
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
 * Linearised nonlinear device (Newton companion).
 * `I[t]` is the current into terminal `terms[t]` evaluated at the controlling voltages `vlin`,
 * where control k is V(ctrl[k][0]) - V(ctrl[k][1]); `G[t][k]` = dI[t]/dvk.
 */
export function stampNonlinear(
  sys: LinearSystem,
  terms: readonly number[],
  ctrl: readonly (readonly [number, number])[],
  vlin: readonly number[],
  I: readonly number[],
  G: readonly (readonly number[])[],
): void {
  for (let t = 0; t < terms.length; t++) {
    const row = terms[t]
    if (row < 0) continue
    let ieq = I[t]
    for (let k = 0; k < ctrl.length; k++) {
      const g = G[t][k]
      if (g === 0) continue
      ieq -= g * vlin[k]
      addA(sys, row, ctrl[k][0], g)
      addA(sys, row, ctrl[k][1], -g)
    }
    addB(sys, row, -ieq)
  }
}

/**
 * Gaussian elimination with partial pivoting. Works on copies; returns null if singular
 * or if the result is not finite.
 */
export function solveLinear(sys: LinearSystem): Float64Array | null {
  const n = sys.size
  const A = Float64Array.from(sys.A)
  const b = Float64Array.from(sys.b)
  let scale = 0
  for (let i = 0; i < A.length; i++) scale = Math.max(scale, Math.abs(A[i]))
  const tiny = Math.max(scale, 1) * 1e-300

  for (let col = 0; col < n; col++) {
    let piv = col
    let best = Math.abs(A[col * n + col])
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(A[r * n + col])
      if (v > best) {
        best = v
        piv = r
      }
    }
    if (!(best > tiny)) return null
    if (piv !== col) {
      for (let c = col; c < n; c++) {
        const tmp = A[col * n + c]
        A[col * n + c] = A[piv * n + c]
        A[piv * n + c] = tmp
      }
      const tb = b[col]
      b[col] = b[piv]
      b[piv] = tb
    }
    const d = A[col * n + col]
    for (let r = col + 1; r < n; r++) {
      const f = A[r * n + col] / d
      if (f === 0) continue
      A[r * n + col] = 0
      for (let c = col + 1; c < n; c++) A[r * n + c] -= f * A[col * n + c]
      b[r] -= f * b[col]
    }
  }

  const x = new Float64Array(n)
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]
    for (let c = r + 1; c < n; c++) s -= A[r * n + c] * x[c]
    x[r] = s / A[r * n + r]
    if (!Number.isFinite(x[r])) return null
  }
  return x
}
