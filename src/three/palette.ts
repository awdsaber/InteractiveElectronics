// Circuit Atelier 3D palette. Notebook tones from spec §2 plus part colours.
// Plastic "black" is kept off pure black so the toon steps stay readable
// against the ink outlines.

import type { LedColor } from '../engine/types'

export const INK = '#1d1b17'
export const PAPER = '#f3eee2'
export const ACCENT = '#2b59c3'
export const WARN = '#d9480f'
export const OK = '#2f9e44'

export const C = {
  // metals
  tin: '#c9cdd2',
  steel: '#a3abb4',
  darkSteel: '#5f666e',
  alu: '#bcc4cc',
  gold: '#d9b44a',
  copper: '#c8763f',
  brass: '#c9a24a',
  // plastics
  black: '#2d2c2a',
  epoxy: '#2a2928',
  charcoal: '#3a3b3e',
  white: '#efece4',
  cream: '#ece6d6',
  hole: '#1a1816',
  // passives
  resistorTan: '#dcc391',
  resistorBlue: '#86acd0',
  ceramicDisc: '#d68b37',
  electroSleeve: '#27447a',
  electroStripe: '#ccd5e2',
  ferrite: '#3b3b40',
  glass: '#dbeef0',
  // wiring
  wireRed: '#c8322b',
  wireBlack: '#2a2a2c',
  wireYellow: '#e8b730',
  wireGreen: '#3e8f4b',
  wireBlue: '#2f5fb3',
  wireOrange: '#e5762a',
  wireBrown: '#7a4a26',
  wireWhite: '#efece4',
  silk: '#f6f2e7',
  // misc
  ttYellow: '#f2c230',
  servoBlue: '#3b64b0',
  terminalBlue: '#2f6fb3',
  rubber: '#2a2a2c',
  lcd: '#b9c6a2',
  bumper: '#d9581f',
} as const

/** The five solder-mask swatches offered by the palette control (spec §1). */
export const PCB_SWATCHES = ['#2f7d5b', '#2b59c3', '#2a2b2f', '#a8352f', '#5f449c'] as const
export const DEFAULT_PCB = PCB_SWATCHES[0]

/** Cutting-mat colours. */
export const MAT = { base: '#4c7c68', line: '#8fb9a3', bold: '#b9d6c2' }

export interface LedLook {
  lens: string
  glow: string
}

export const LED_LOOK: Record<LedColor, LedLook> = {
  red: { lens: '#e0473a', glow: '#ff4a2e' },
  yellow: { lens: '#f1c83c', glow: '#ffd23a' },
  green: { lens: '#4cb860', glow: '#4cff6a' },
  blue: { lens: '#3f78d8', glow: '#4f8dff' },
  white: { lens: '#eef1f2', glow: '#fff8e8' },
}

export function ledLook(color: unknown): LedLook {
  if (typeof color === 'string' && color in LED_LOOK) return LED_LOOK[color as LedColor]
  return LED_LOOK.red
}

/** Named wire colours accepted by `params.color`, plus any CSS colour. */
export function wireColor(c: unknown, fallback: string = C.wireRed): string {
  if (typeof c !== 'string' || !c) return fallback
  const named: Record<string, string> = {
    red: C.wireRed,
    black: C.wireBlack,
    yellow: C.wireYellow,
    green: C.wireGreen,
    blue: C.wireBlue,
    orange: C.wireOrange,
    brown: C.wireBrown,
    white: C.wireWhite,
  }
  return named[c] ?? c
}
