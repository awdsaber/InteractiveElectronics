/** Map a slider position t in [0,1] to a value in [min,max], linearly or logarithmically. */
export function sliderToValue(t: number, min: number, max: number, log = false, step?: number): number {
  const c = Math.min(1, Math.max(0, t))
  let v = log && min > 0 ? min * Math.pow(max / min, c) : min + (max - min) * c
  if (step && !log) v = min + Math.round((v - min) / step) * step
  return Math.min(max, Math.max(min, v))
}

/** Inverse of sliderToValue. */
export function valueToSlider(v: number, min: number, max: number, log = false): number {
  if (max === min) return 0
  const c = Math.min(max, Math.max(min, v))
  const t = log && min > 0 ? Math.log(c / min) / Math.log(max / min) : (c - min) / (max - min)
  return Math.min(1, Math.max(0, t))
}

const PREFIXES: [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
]

/** Display-only SI formatting: 0.0043,'A' -> "4.3 mA". */
export function siLabel(value: number, unit: string, digits = 2): string {
  if (!isFinite(value)) return `— ${unit}`.trim()
  if (value === 0) return `0 ${unit}`.trim()
  const abs = Math.abs(value)
  const [scale, prefix] = PREFIXES.find(([s]) => abs >= s * 0.9995) ?? PREFIXES[PREFIXES.length - 1]
  const n = value / scale
  const s = Number(n.toPrecision(digits)).toString()
  return `${s} ${prefix}${unit}`.trim()
}
