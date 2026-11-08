import type { ComponentType } from 'react'
import type { PartKind, PartPlacement } from '../../engine/types'

/** How a part is drawn right now (derived from bench state by the Board). */
export interface PartRenderState {
  visible: boolean
  /** THT solder fillets / SMD solder shown */
  soldered: boolean
  /** 0..1 emissive glow (LED current, screen on, module powered) */
  glow: number
  /** charred with smoke */
  burnt: boolean
  /** extra lift in board units for the exploded view */
  explodedOffset: number
  /** show the callout tag (part.label) */
  showLabel: boolean
  /** live shaft speed for motors / wheels / steppers (overrides params.rpm) */
  rpm?: number
  /** live analogue value: servo angle in degrees, pot position 0..1, button pressed 0/1 */
  value?: number
  /** live text for displays (multimeter reading) */
  reading?: string
  /** unit text for the multimeter LCD (SI prefix + unit, e.g. 'mA'); set unless params.autoUnit is false */
  readingUnit?: string
  /** live LED colour '#rrggbb' (addressable RGB LEDs); not in the bake key, so it never rebakes */
  glowColor?: string
}

export const DEFAULT_PART_STATE: PartRenderState = {
  visible: true,
  soldered: false,
  glow: 0,
  burnt: false,
  explodedOffset: 0,
  showLabel: false,
}

export interface PartProps {
  part: PartPlacement
  state: PartRenderState
}

export type PartComponent = ComponentType<PartProps>
export type PartRegistry = Record<PartKind, PartComponent>

/** PCB thickness (1.6 mm). The PCB top is y = 0. */
export const PCB_THICKNESS = 0.16
/** Bench (cutting mat) top, just under the PCB. Off-board parts sit here. */
export const BENCH_Y = -PCB_THICKNESS - 0.02
/** 0.1" pitch in board units */
export const PITCH = 0.254

/**
 * World position of a part in board units. `pos` is [x, z] (y = 0 on the PCB,
 * or BENCH_Y for `mount: 'offboard'`) or [x, y, z].
 */
export function partPosition(part: PartPlacement): [number, number, number] {
  const p = part.pos
  if (p.length === 3) return [p[0], p[1], p[2]]
  return [p[0], part.mount === 'offboard' ? BENCH_Y : 0, p[1]]
}

// ───────────── param helpers ─────────────

export function num(part: PartPlacement, key: string, fallback: number): number {
  const v = part.params?.[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function str(part: PartPlacement, key: string, fallback: string): string {
  const v = part.params?.[key]
  return typeof v === 'string' ? v : fallback
}

export function bool(part: PartPlacement, key: string, fallback: boolean): boolean {
  const v = part.params?.[key]
  return typeof v === 'boolean' ? v : fallback
}

export function param(part: PartPlacement, key: string): unknown {
  return part.params?.[key]
}
