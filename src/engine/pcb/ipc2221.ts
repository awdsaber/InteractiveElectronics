// IPC-2221 conductor sizing and copper trace resistance (pure).
//
// IPC-2221 (the generic standard for printed board design) fits its conductor-heating charts with
//   I = k · ΔT^0.44 · A^0.725        A = cross-section in mil², ΔT = rise above ambient in °C
// with k = 0.048 for outer layers and k = 0.024 for inner layers. The charts were measured up to
// about 35 A, 400 mil wide and a 100 °C rise; beyond that the formula is an extrapolation.
// Copper weight: 1 oz/ft² is 1.378 mil (35 µm) thick.

/** 1 oz/ft² copper thickness, mil */
export const OZ_MIL = 1.378
/** 1 oz/ft² copper thickness, µm */
export const OZ_UM = OZ_MIL * 25.4
/** resistivity of annealed copper at 20 °C, Ω·m */
export const COPPER_RHO = 1.724e-8
/** copper temperature coefficient of resistance near 20 °C, 1/°C */
export const COPPER_ALPHA = 0.00393
/** the IPC-2221 charts stop at this rise (°C) */
export const IPC_CHART_MAX_RISE = 100

const MIL_MM = 0.0254
const B = 0.44
const C = 0.725
const k = (external: boolean) => (external ? 0.048 : 0.024)

/** cross-section (mil²) that carries `amps` with a `riseC` temperature rise */
export function ipcArea(amps: number, riseC: number, external = true): number {
  const i = Math.abs(amps)
  if (i === 0) return 0
  return Math.pow(i / (k(external) * Math.pow(Math.max(1e-9, riseC), B)), 1 / C)
}

/** minimum width (mm) for `amps` at a `riseC` rise in `oz` copper */
export function ipcWidthMm(amps: number, riseC: number, oz = 1, external = true): number {
  return (ipcArea(amps, riseC, external) / (oz * OZ_MIL)) * MIL_MM
}

/** temperature rise (°C) of a trace `widthMm` wide in `oz` copper carrying `amps` */
export function ipcRise(amps: number, widthMm: number, oz = 1, external = true): number {
  const i = Math.abs(amps)
  if (i === 0) return 0
  const area = (Math.max(1e-6, widthMm) / MIL_MM) * oz * OZ_MIL
  return Math.pow(i / (k(external) * Math.pow(area, C)), 1 / B)
}

/** current (A) a trace `widthMm` wide carries at a `riseC` rise */
export function ipcCurrent(widthMm: number, riseC: number, oz = 1, external = true): number {
  const area = (widthMm / MIL_MM) * oz * OZ_MIL
  return k(external) * Math.pow(riseC, B) * Math.pow(area, C)
}

/** resistance (Ω) of a copper trace at `tempC` */
export function traceResistance(lengthMm: number, widthMm: number, oz = 1, tempC = 20): number {
  const area = widthMm * 1e-3 * (oz * OZ_UM * 1e-6)
  return ((COPPER_RHO * lengthMm * 1e-3) / Math.max(1e-15, area)) * (1 + COPPER_ALPHA * (tempC - 20))
}

/** length (mm) of a polyline in board units (1 unit = 10 mm) */
export function polylineLengthMm(pts: readonly (readonly [number, number])[]): number {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return s * 10
}
