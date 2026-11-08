// Engineering-notation formatting for readouts: 0.0043 A -> "4.3 mA".

const PREFIXES: [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
]

/**
 * units that read wrong with SI prefixes ("1.5 krpm"): non-SI units, units that already carry a
 * prefix (µs, mΩ, cm: "1.5 kµs"), logarithmic dBm ("2 mdBm") and integer counts
 */
const NO_PREFIX = new Set(['rpm', '°', '°C', 'cm', '%', 'µs', 'mΩ', 'dBm', 'counts'])

function fixed(m: number, digits: number): string {
  const mag = m === 0 ? 0 : Math.floor(Math.log10(Math.abs(m)))
  const text = m.toFixed(Math.max(0, digits - 1 - mag))
  const r = Math.abs(Number(text))
  // rounding up a power of ten (0.996 -> "1.00") adds a digit: drop one decimal
  if (r !== 0 && Math.floor(Math.log10(r)) > mag) return m.toFixed(Math.max(0, digits - 2 - mag))
  return text
}

const join = (num: string, prefix: string, unit: string) => `${num} ${prefix}${unit}`.trimEnd()

/**
 * Format `value` with an SI prefix and `digits` significant digits
 * (integer mantissas such as 220 keep all their digits).
 */
export function formatSI(value: number, unit: string, digits = 2): string {
  if (!Number.isFinite(value)) return join('—', '', unit)
  if (NO_PREFIX.has(unit)) return join(fixed(value, digits), '', unit)
  if (value === 0) return join(fixed(0, digits), '', unit)

  const abs = Math.abs(value)
  let i = PREFIXES.findIndex(([scale]) => abs >= scale * (1 - 1e-12))
  if (i < 0) i = PREFIXES.length - 1
  let text = fixed(value / PREFIXES[i][0], digits)
  // rounding can push the mantissa to 1000 (999.96 -> "1000"): move up one prefix
  if (Math.abs(Number(text)) >= 1000 && i > 0) {
    i -= 1
    text = fixed(value / PREFIXES[i][0], digits)
  }
  return join(text, PREFIXES[i][1], unit)
}
