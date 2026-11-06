import type { BenchStatus } from '../engine/types'

/** Every action the bench buttons can emit. `place:<partId>` and `break:<failureId>` carry an id. */
export type BenchAction =
  | 'strip'
  | 'pick-place'
  | 'place-all'
  | `place:${string}`
  | 'solder'
  | 'power'
  | 'upload'
  | 'explode'
  | `break:${string}`
  | 'repair'

export type PaletteId = 'green' | 'blue' | 'red' | 'black' | 'purple'

export interface PaletteSwatch {
  id: PaletteId
  label: string
  color: string
}

export const PALETTES: PaletteSwatch[] = [
  { id: 'green', label: 'Solder-mask green', color: '#1f7a4d' },
  { id: 'blue', label: 'Blueprint blue', color: '#2b59c3' },
  { id: 'red', label: 'Signal red', color: '#c0392b' },
  { id: 'black', label: 'Matte black', color: '#25242a' },
  { id: 'purple', label: 'Violet', color: '#6c3fa0' },
]

export interface Settings {
  wobble: number // 0..1
  palette: PaletteId
  labels: boolean
  lofi: boolean
  effects: boolean
}

/** Readout ready for display (value already SI-formatted by the store). */
export interface ReadoutView {
  label: string
  value: string
  tone?: 'normal' | 'warn' | 'ok'
}

export interface PartChoice {
  id: string
  label: string
}

export interface FailureChoice {
  id: string
  label: string
}

export interface ToastMessage {
  id: number
  text: string
  tone?: 'info' | 'warn' | 'ok'
}

export type { BenchStatus }
