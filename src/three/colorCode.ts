// Resistor colour code (IEC 60062), SMD resistor codes and capacitor codes.

export type BandColor =
  | 'black'
  | 'brown'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'violet'
  | 'grey'
  | 'white'
  | 'gold'
  | 'silver'

export const DIGIT_COLORS: readonly BandColor[] = [
  'black',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'violet',
  'grey',
  'white',
]

/** Tolerance (%) → band colour. */
export const TOLERANCE_COLORS: Readonly<Record<string, BandColor>> = {
  '1': 'brown',
  '2': 'red',
  '0.5': 'green',
  '0.25': 'blue',
  '0.1': 'violet',
  '0.05': 'grey',
  '5': 'gold',
  '10': 'silver',
}

/** Paint colours used for bands on the 3D body. */
export const BAND_HEX: Readonly<Record<BandColor, string>> = {
  black: '#1f1d1b',
  brown: '#7a4a26',
  red: '#c8322b',
  orange: '#e5762a',
  yellow: '#f0c93a',
  green: '#3e8f4b',
  blue: '#2f5fb3',
  violet: '#7d4bb0',
  grey: '#8d8d8d',
  white: '#f4f2ec',
  gold: '#c9a23f',
  silver: '#bfc4c9',
}

const SUFFIX: Record<string, number> = { R: 1, r: 1, k: 1e3, K: 1e3, M: 1e6, m: 1e6, G: 1e9 }

/**
 * Parse a resistance: numbers pass through; strings accept "220", "4.7k",
 * "4k7", "2R2", "1M", "10 kΩ", "0R". Returns null when unparseable.
 */
export function parseOhms(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, '').replace(/(Ω|ohms?)$/i, '')
  if (!s) return null
  // "4k7" / "2R2" (letter as decimal point)
  let m = /^(\d+)([RrKkMmG])(\d+)$/.exec(s)
  if (m) return Number(`${m[1]}.${m[3]}`) * SUFFIX[m[2]]
  // "4.7k" / "220" / "1M" / "0R"
  m = /^(\d+(?:\.\d+)?|\.\d+)([RrKkMmG])?$/.exec(s)
  if (m) return Number(m[1]) * (m[2] ? SUFFIX[m[2]] : 1)
  return null
}

function sigExp(value: number, sig: number): { mant: number; exp: number } {
  let exp = Math.floor(Math.log10(value)) - (sig - 1)
  let mant = Math.round(value / 10 ** exp)
  if (mant >= 10 ** sig) {
    exp += 1
    mant = Math.round(value / 10 ** exp)
  } else if (mant < 10 ** (sig - 1)) {
    exp -= 1
    mant = Math.round(value / 10 ** exp)
  }
  return { mant, exp }
}

export interface BandOptions {
  /** percent, default 5 (4-band) or 1 (5-band) */
  tolerance?: number
  bands?: 4 | 5
}

/**
 * Colour bands for a resistance, first band first.
 * 220 Ω → red red brown gold; 4.7 kΩ → yellow violet red gold.
 * 0 Ω → a single black band.
 */
export function resistorBands(ohms: number, opts: BandOptions = {}): BandColor[] {
  if (ohms === 0) return ['black']
  if (!Number.isFinite(ohms) || ohms < 0) throw new RangeError(`bad resistance ${ohms}`)
  const bands = opts.bands ?? 4
  const sig = bands === 5 ? 3 : 2
  const tol = opts.tolerance ?? (bands === 5 ? 1 : 5)
  const { mant, exp } = sigExp(ohms, sig)
  if (exp < -2 || exp > 9) throw new RangeError(`resistance ${ohms} Ω outside colour-code range`)
  const digits = String(mant)
    .split('')
    .map((d) => DIGIT_COLORS[Number(d)])
  const mult: BandColor = exp === -1 ? 'gold' : exp === -2 ? 'silver' : DIGIT_COLORS[exp]
  const tolColor = TOLERANCE_COLORS[String(tol)]
  if (!tolColor) throw new RangeError(`no band for tolerance ${tol}%`)
  return [...digits, mult, tolColor]
}

/**
 * Three-digit SMD resistor marking: 220 → "221", 4700 → "472", 10 → "100",
 * 4.7 → "4R7", 0.47 → "R47", 0 → "000".
 */
export function smdCode(ohms: number): string {
  if (ohms === 0) return '000'
  if (!Number.isFinite(ohms) || ohms < 0) throw new RangeError(`bad resistance ${ohms}`)
  if (ohms < 1) return `R${String(Math.round(ohms * 100)).padStart(2, '0')}`
  if (ohms < 10) {
    const n = Math.round(ohms * 10)
    if (n < 100) return `${Math.floor(n / 10)}R${n % 10}`
  }
  const { mant, exp } = sigExp(ohms, 2)
  return `${mant}${exp}`
}

/**
 * Three-digit capacitor code in pF: 100 nF → "104", 22 pF → "220", 4.7 µF → "475".
 * Values under 10 pF use R notation ("4R7").
 */
export function capacitorCode(farads: number): string {
  if (!Number.isFinite(farads) || farads <= 0) throw new RangeError(`bad capacitance ${farads}`)
  const pf = farads * 1e12
  if (pf < 10) {
    const n = Math.round(pf * 10)
    return `${Math.floor(n / 10)}R${n % 10}`
  }
  const { mant, exp } = sigExp(pf, 2)
  return `${mant}${exp}`
}
