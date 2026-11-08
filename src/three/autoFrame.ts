// Automatic camera frame for breadboard lessons that have no manual `board.frame`.
// Pure (no three.js, no React): the bounding box of the meaningful parts plus a margin, as the same
// `{ size, center }` a manual frame gives BenchScene (camera) and Board (mat).
//
// The camera fits a frame with fitZoom(), which takes the projected iso extent against the actual
// canvas size, so the viewport aspect is honoured there (the frame itself is aspect-free: the
// projected width of a w × d rectangle depends only on w + d).

import type { BoardSpec, PartPlacement } from '../engine/types'
import { footprint, moduleSize } from './parts/footprints'
import { partPosition } from './parts/types'

export type Frame = NonNullable<BoardSpec['frame']>

export interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** margin around the parts' bounding box, board units (1 = 10 mm) */
export const AUTO_MARGIN = 1.6
/** smallest automatic frame, so one lone LED isn't zoomed absurdly */
export const AUTO_MIN_SIZE: [number, number] = [7, 5.5]

/** base parts that are never framed: the breadboard itself, the mat and a bare PCB */
const BASE_KINDS = new Set<string>(['breadboard', 'pcb', 'mat'])

/** half-extent [x, z] for parts that have neither footprint pads nor a size param */
const DEFAULT_HALF = 0.4
const KIND_SIZE: Partial<Record<PartPlacement['kind'], [number, number]>> = {
  'wifi-module': [1.8, 2.55],
  oled: [2.7, 2.8],
  'battery-aa-pack': [2.6, 1.6],
  'battery-9v': [2.7, 1.7],
  'battery-lipo': [3, 2],
  'dc-motor': [3, 2.4],
  'gear-motor-wheel': [4, 3],
  servo: [2.4, 1.3],
  'stepper-nema17': [4.2, 4.2],
  multimeter: [6, 3.5],
  transformer: [3, 3],
}

function rotateBox(hx: number, hz: number, cx: number, cz: number, rotDeg: number): Bounds {
  const a = (rotDeg * Math.PI) / 180
  const c = Math.abs(Math.cos(a))
  const s = Math.abs(Math.sin(a))
  const ex = hx * c + hz * s
  const ez = hx * s + hz * c
  return { minX: cx - ex, maxX: cx + ex, minZ: cz - ez, maxZ: cz + ez }
}

/**
 * World xz bounds of one part: wire points, the module's size, its footprint (pads and silkscreen),
 * a per-kind size, else a small default. `pos` is the part's centre, rotated by `rot`.
 */
export function partBounds(part: PartPlacement): Bounds {
  const [px, , pz] = partPosition(part)
  if (part.kind === 'wire') {
    const pts = Array.isArray(part.params?.points) ? (part.params!.points as number[][]) : []
    const b: Bounds = { minX: px - 0.1, maxX: px + 0.1, minZ: pz - 0.1, maxZ: pz + 0.1 }
    for (const p of pts) {
      if (p.length < 3) continue
      b.minX = Math.min(b.minX, px + p[0] - 0.1)
      b.maxX = Math.max(b.maxX, px + p[0] + 0.1)
      b.minZ = Math.min(b.minZ, pz + p[2] - 0.1)
      b.maxZ = Math.max(b.maxZ, pz + p[2] + 0.1)
    }
    return b
  }
  const rot = part.rot ?? 0
  if (part.kind === 'module') {
    const { w, d } = moduleSize(part)
    return rotateBox(w / 2, d / 2, px, pz, rot)
  }
  const fp = footprint(part)
  let hx = 0
  let hz = 0
  for (const p of fp.pads) {
    hx = Math.max(hx, Math.abs(p.x) + p.w / 2)
    hz = Math.max(hz, Math.abs(p.z) + p.d / 2)
  }
  if (fp.silk) {
    hx = Math.max(hx, Math.abs(fp.silk.x ?? 0) + fp.silk.w / 2)
    hz = Math.max(hz, Math.abs(fp.silk.z ?? 0) + fp.silk.d / 2)
  }
  if (hx === 0 && hz === 0) {
    const k = KIND_SIZE[part.kind]
    hx = k ? k[0] / 2 : DEFAULT_HALF
    hz = k ? k[1] / 2 : DEFAULT_HALF
  }
  return rotateBox(hx, hz, px, pz, rot)
}

function union(list: Bounds[]): Bounds | undefined {
  if (list.length === 0) return undefined
  return list.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    maxX: Math.max(a.maxX, b.maxX),
    minZ: Math.min(a.minZ, b.minZ),
    maxZ: Math.max(a.maxZ, b.maxZ),
  }))
}

function toFrame(b: Bounds, margin: number, min: [number, number]): Frame {
  return {
    size: [Math.max(min[0], b.maxX - b.minX + 2 * margin), Math.max(min[1], b.maxZ - b.minZ + 2 * margin)],
    center: [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2],
  }
}

/**
 * The frame around every part except the base (breadboard, pcb, mat): hidden failure-only parts
 * count, so the camera doesn't move when a failure shows one. Undefined when nothing is left.
 */
export function autoFrame(parts: PartPlacement[]): Frame | undefined {
  const b = union(parts.filter((p) => !BASE_KINDS.has(p.kind)).map(partBounds))
  return b && toFrame(b, AUTO_MARGIN, AUTO_MIN_SIZE)
}

/** breadboard lessons only: a PCB board's `size` already is its frame */
function isAuto(board: BoardSpec): boolean {
  return !board.frame && board.base === 'breadboard-only'
}

/** The frame the camera fits: the manual `frame`, else the automatic one, else `size` centred. */
export function boardFrame(board: BoardSpec): Frame {
  if (board.frame) return board.frame
  return (isAuto(board) ? autoFrame(board.parts) : undefined) ?? { size: board.size }
}

/** The area the mat covers: as boardFrame, but an automatic frame is widened to include the breadboard. */
export function matFrame(board: BoardSpec): Frame {
  const f = boardFrame(board)
  if (!isAuto(board)) return f
  const bb = board.parts.filter((p) => p.kind === 'breadboard').map((p) => {
    const [x, , z] = partPosition(p)
    return rotateBox(4.2, 2.8, x, z, p.rot ?? 0)
  })
  const fb = f.center
    ? { minX: f.center[0] - f.size[0] / 2, maxX: f.center[0] + f.size[0] / 2, minZ: f.center[1] - f.size[1] / 2, maxZ: f.center[1] + f.size[1] / 2 }
    : undefined
  const u = union([...(fb ? [fb] : []), ...bb])
  return u ? toFrame(u, 0, [0, 0]) : f
}
