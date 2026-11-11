// Land patterns (pads) and silkscreen outlines per part, in part-local board
// units before rotation. The Pcb draws these as copper; the part frame puts
// solder fillets on them; part bodies use the same helpers so their legs
// land on the pads.

import type { PartPlacement } from '../../engine/types'
import { PITCH, bool, num, str } from './types'

export interface Pad {
  x: number
  z: number
  /** size along x / z */
  w: number
  d: number
  shape: 'round' | 'rect' | 'oval'
  /** drill diameter for THT pads */
  drill?: number
  smd?: boolean
  /** outward direction of an SMD joint (unit x, z) */
  out?: [number, number]
}

export interface Silk {
  w: number
  d: number
  x?: number
  z?: number
  round?: boolean
  /** pin-1 / polarity mark position */
  mark?: [number, number]
}

export interface Footprint {
  pads: Pad[]
  silk?: Silk
}

const tht = (x: number, z: number, w = 0.17, shape: Pad['shape'] = 'round', drill = 0.08): Pad => ({
  x,
  z,
  w,
  d: shape === 'oval' ? w * 1.45 : w,
  shape,
  drill,
})

const smd = (x: number, z: number, w: number, d: number, out?: [number, number]): Pad => ({
  x,
  z,
  w,
  d,
  shape: 'rect',
  smd: true,
  out,
})

// ───────────── shared geometry helpers (bodies use these too) ─────────────

export const CHIP_SIZES: Record<string, [number, number, number]> = {
  '0402': [0.1, 0.05, 0.035],
  '0603': [0.16, 0.08, 0.045],
  '0805': [0.2, 0.125, 0.05],
  '1206': [0.32, 0.16, 0.055],
}

/** [length (x), width (z), height] of an SMD chip part. */
export function chipSize(part: PartPlacement): [number, number, number] {
  return CHIP_SIZES[str(part, 'size', '0805')] ?? CHIP_SIZES['0805']
}

export function axialSpan(part: PartPlacement): number {
  const def = part.kind === 'zener' ? 0.762 : 1.016
  return num(part, 'span', def)
}

export function electroSize(part: PartPlacement): { d: number; h: number; span: number } {
  const d = num(part, 'd', 0.63)
  const h = num(part, 'h', 1.1)
  const span = d <= 0.5 ? 0.2 : d <= 0.8 ? 0.25 : d <= 1.0 ? 0.35 : 0.5
  return { d, h, span }
}

export interface DipGeom {
  pins: number
  perSide: number
  length: number
  rowZ: number
  bodyW: number
  pinX: (i: number) => number
}

export function dipGeom(part: PartPlacement): DipGeom {
  const pins = Math.max(4, Math.round(num(part, 'pins', 8) / 2) * 2)
  const perSide = pins / 2
  const wide = bool(part, 'wide', pins >= 40)
  const rowZ = wide ? 0.762 : 0.381
  return {
    pins,
    perSide,
    length: perSide * PITCH,
    rowZ,
    bodyW: wide ? 1.4 : 0.63,
    pinX: (i) => (i - (perSide - 1) / 2) * PITCH,
  }
}

export type SmdPackage = 'SOIC' | 'TQFP' | 'QFN'

export interface SmdIcGeom {
  pkg: SmdPackage
  pins: number
  perSide: number
  pitch: number
  /** body size x, z, height */
  bx: number
  bz: number
  h: number
  /** lead tip-to-tip span (pad centre distance + lead) */
  span: number
  quad: boolean
  offset: (i: number) => number
}

export function smdIcGeom(part: PartPlacement): SmdIcGeom {
  const raw = str(part, 'package', 'SOIC').toUpperCase()
  const pkg: SmdPackage = raw.startsWith('TQFP') || raw.startsWith('LQFP') ? 'TQFP' : raw.startsWith('QFN') ? 'QFN' : 'SOIC'
  if (pkg === 'SOIC') {
    const pins = Math.max(4, Math.round(num(part, 'pins', 8) / 2) * 2)
    const perSide = pins / 2
    const pitch = 0.127
    return {
      pkg,
      pins,
      perSide,
      pitch,
      bx: perSide * pitch + 0.06,
      bz: 0.39,
      h: 0.15,
      span: 0.6,
      quad: false,
      offset: (i) => (i - (perSide - 1) / 2) * pitch,
    }
  }
  const pins = Math.max(8, Math.round(num(part, 'pins', 32) / 4) * 4)
  const perSide = pins / 4
  const pitch = pkg === 'QFN' ? 0.05 : pins <= 44 ? 0.08 : 0.05
  const s = perSide * pitch + (pkg === 'QFN' ? 0.1 : 0.1)
  return {
    pkg,
    pins,
    perSide,
    pitch,
    bx: s,
    bz: s,
    h: pkg === 'QFN' ? 0.085 : 0.1,
    span: pkg === 'QFN' ? s : s + 0.2,
    quad: true,
    offset: (i) => (i - (perSide - 1) / 2) * pitch,
  }
}

export interface HeaderGeom {
  pins: number
  rows: number
  pinX: (i: number) => number
  rowZ: (r: number) => number
  w: number
  d: number
}

export function headerGeom(part: PartPlacement): HeaderGeom {
  const pins = Math.max(1, Math.round(num(part, 'pins', 8)))
  const rows = Math.max(1, Math.min(2, Math.round(num(part, 'rows', 1))))
  return {
    pins,
    rows,
    pinX: (i) => (i - (pins - 1) / 2) * PITCH,
    rowZ: (r) => (r - (rows - 1) / 2) * PITCH,
    w: pins * PITCH,
    d: rows * PITCH,
  }
}

export function moduleSize(part: PartPlacement): { w: number; d: number } {
  const variant = str(part, 'variant', '')
  if (variant === 'uno') return { w: 6.86, d: 5.33 }
  if (variant === 'nano') return { w: 4.32, d: 1.78 }
  return { w: num(part, 'w', 3), d: num(part, 'd', 2) }
}

/** Header pins per long side of a generic module (0 = none). */
export function modulePins(part: PartPlacement): number {
  const variant = str(part, 'variant', '')
  if (variant === 'nano') return 15
  if (variant === 'uno') return 0
  const { w } = moduleSize(part)
  return Math.max(0, Math.round(num(part, 'pins', Math.floor(w / PITCH) - 1)))
}

export function moduleRowZ(part: PartPlacement): number {
  const variant = str(part, 'variant', '')
  if (variant === 'nano') return 0.762
  const { d } = moduleSize(part)
  return d / 2 - 0.13
}

// ───────────── footprints ─────────────

function row(n: number, pitch: number, z: number, mk: (x: number, z: number, i: number) => Pad): Pad[] {
  return Array.from({ length: n }, (_, i) => mk((i - (n - 1) / 2) * pitch, z, i))
}

/** Turn applied to connector bodies modelled facing −X so they face +Z. */
export const FRONT: [number, number, number] = [0, Math.PI / 2, 0]

const FRONT_KINDS = new Set<PartPlacement['kind']>(['usb-b', 'usb-c', 'micro-usb', 'barrel-jack', 'screw-terminal'])

/** Rotate a footprint by FRONT (+90° about Y): (x, z) → (z, −x). */
function turnFront(fp: Footprint): Footprint {
  return {
    pads: fp.pads.map((p) => ({
      ...p,
      x: p.z,
      z: -p.x,
      w: p.d,
      d: p.w,
      out: p.out ? [p.out[1], -p.out[0]] : undefined,
    })),
    silk: fp.silk && {
      ...fp.silk,
      w: fp.silk.d,
      d: fp.silk.w,
      x: fp.silk.z,
      z: fp.silk.x === undefined ? undefined : -fp.silk.x,
      mark: fp.silk.mark && [fp.silk.mark[1], -fp.silk.mark[0]],
    },
  }
}

export function footprint(part: PartPlacement): Footprint {
  if (part.mount === 'offboard') return { pads: [] }
  const fp = rawFootprint(part)
  return FRONT_KINDS.has(part.kind) ? turnFront(fp) : fp
}

function rawFootprint(part: PartPlacement): Footprint {
  switch (part.kind) {
    case 'resistor':
    case 'diode':
    case 'zener': {
      const h = axialSpan(part) / 2
      const cathodeSquare = part.kind !== 'resistor'
      return {
        pads: [tht(-h, 0), tht(h, 0, 0.17, cathodeSquare ? 'rect' : 'round')],
        silk: {
          w: part.kind === 'zener' ? 0.5 : 0.72,
          d: part.kind === 'zener' ? 0.24 : 0.32,
          mark: cathodeSquare ? [0.2, 0] : undefined,
        },
      }
    }
    case 'resistor-smd':
    case 'capacitor-smd':
    case 'led-smd': {
      const [l, w] = chipSize(part)
      return {
        pads: [smd(-l * 0.42, 0, l * 0.45, w * 1.2, [-1, 0]), smd(l * 0.42, 0, l * 0.45, w * 1.2, [1, 0])],
        silk: part.kind === 'led-smd' ? { w: l * 1.5, d: w * 1.8, mark: [-l * 0.9, 0] } : undefined,
      }
    }
    case 'led':
      return {
        pads: [tht(-0.127, 0, 0.16, 'rect'), tht(0.127, 0, 0.16)],
        silk: { w: 0.58, d: 0.58, round: true, mark: [-0.36, 0] },
      }
    case 'capacitor-ceramic':
    case 'thermistor':
      return { pads: [tht(-0.127, 0, 0.15), tht(0.127, 0, 0.15)], silk: { w: 0.56, d: 0.2 } }
    case 'capacitor-electrolytic': {
      const { d, span } = electroSize(part)
      return {
        pads: [tht(-span / 2, 0, 0.16, 'rect'), tht(span / 2, 0, 0.16)],
        silk: { w: d + 0.06, d: d + 0.06, round: true, mark: [d / 2 - 0.1, 0] },
      }
    }
    case 'inductor':
      return {
        pads: [tht(-0.25, 0, 0.18), tht(0.25, 0, 0.18)],
        silk: str(part, 'style', 'drum') === 'toroid' ? { w: 1.5, d: 0.6 } : { w: 0.96, d: 0.96, round: true },
      }
    case 'fuse':
      return {
        pads: [tht(-0.75, -0.1), tht(-0.75, 0.1), tht(0.75, -0.1), tht(0.75, 0.1)],
        silk: { w: 2.2, d: 0.6 },
      }
    case 'crystal':
      return { pads: [tht(-0.244, 0, 0.15), tht(0.244, 0, 0.15)], silk: { w: 1.2, d: 0.52 } }
    case 'transistor-to92':
      return {
        pads: row(3, 0.127, 0, (x, z, i) => tht(x, z, 0.12, i === 0 ? 'rect' : 'round', 0.07)),
        silk: { w: 0.52, d: 0.42, mark: [-0.3, 0.2] },
      }
    case 'mosfet-to220':
    case 'regulator-to220':
      return {
        pads: row(3, PITCH, 0, (x, z, i) => tht(x, z, 0.18, i === 0 ? 'rect' : 'oval', 0.1)),
        silk: { w: 1.08, d: 0.5, z: -0.02 },
      }
    case 'heatsink':
      return { pads: [tht(-0.4, -0.55, 0.2), tht(0.4, -0.55, 0.2)], silk: { w: 1.6, d: 1.0, z: -0.55 } }
    case 'ic-dip': {
      const g = dipGeom(part)
      const pads: Pad[] = []
      for (let i = 0; i < g.perSide; i++) pads.push(tht(g.pinX(i), g.rowZ, 0.16, i === 0 ? 'rect' : 'oval'))
      for (let i = g.perSide - 1; i >= 0; i--) pads.push(tht(g.pinX(i), -g.rowZ, 0.16, 'oval'))
      return { pads, silk: { w: g.length + 0.08, d: g.bodyW - 0.06, mark: [-g.length / 2 - 0.04, 0] } }
    }
    case 'ic-smd': {
      const g = smdIcGeom(part)
      const pads: Pad[] = []
      const padLen = g.pkg === 'SOIC' ? 0.15 : g.pkg === 'TQFP' ? 0.12 : 0.07
      const padW = g.pitch * 0.55
      const reach = g.pkg === 'QFN' ? g.bx / 2 : g.span / 2 - padLen / 2 + 0.02
      for (let i = 0; i < g.perSide; i++) pads.push(smd(g.offset(i), reach, padW, padLen, [0, 1]))
      for (let i = 0; i < g.perSide; i++) pads.push(smd(g.offset(i), -reach, padW, padLen, [0, -1]))
      if (g.quad) {
        for (let i = 0; i < g.perSide; i++) pads.push(smd(reach, g.offset(i), padLen, padW, [1, 0]))
        for (let i = 0; i < g.perSide; i++) pads.push(smd(-reach, g.offset(i), padLen, padW, [-1, 0]))
      }
      return { pads, silk: { w: g.bx + 0.04, d: g.bz + 0.04, mark: [-g.bx / 2 - 0.08, g.bz / 2 + 0.06] } }
    }
    case 'header-male':
    case 'header-female': {
      const g = headerGeom(part)
      const pads: Pad[] = []
      for (let r = 0; r < g.rows; r++)
        for (let i = 0; i < g.pins; i++) pads.push(tht(g.pinX(i), g.rowZ(r), 0.17, i === 0 && r === 0 ? 'rect' : 'round'))
      return { pads, silk: { w: g.w, d: g.d } }
    }
    case 'usb-b':
      return {
        pads: [
          tht(0.47, -0.125, 0.15),
          tht(0.47, 0.125, 0.15),
          tht(0.67, -0.125, 0.15),
          tht(0.67, 0.125, 0.15),
          tht(-0.1, -0.6, 0.28, 'oval', 0.16),
          tht(-0.1, 0.6, 0.28, 'oval', 0.16),
        ],
        silk: { w: 1.6, d: 1.2 },
      }
    case 'usb-c':
      return {
        pads: [
          ...Array.from({ length: 12 }, (_, i) => smd(0.46, (i - 5.5) * 0.05, 0.11, 0.028, [1, 0])),
          tht(0.12, -0.43, 0.14, 'oval', 0.07),
          tht(0.12, 0.43, 0.14, 'oval', 0.07),
        ],
        silk: { w: 0.74, d: 0.9 },
      }
    case 'micro-usb':
      return {
        pads: [
          ...Array.from({ length: 5 }, (_, i) => smd(0.3, (i - 2) * 0.065, 0.12, 0.04, [1, 0])),
          smd(0.02, -0.36, 0.2, 0.16),
          smd(0.02, 0.36, 0.2, 0.16),
        ],
        silk: { w: 0.5, d: 0.76 },
      }
    case 'barrel-jack':
      return {
        pads: [tht(0.6, 0, 0.3, 'oval', 0.15), tht(0.0, 0, 0.3, 'oval', 0.15), tht(0.3, 0.45, 0.3, 'oval', 0.15)],
        silk: { w: 1.4, d: 0.9 },
      }
    case 'screw-terminal': {
      const n = Math.max(2, Math.round(num(part, 'pins', 2)))
      return {
        pads: Array.from({ length: n }, (_, i) => tht(0.1, (i - (n - 1) / 2) * 0.508, 0.26, i === 0 ? 'rect' : 'round', 0.13)),
        silk: { w: 0.8, d: n * 0.508, x: 0 },
      }
    }
    case 'button':
      return {
        pads: [tht(-0.325, -0.225), tht(0.325, -0.225), tht(-0.325, 0.225), tht(0.325, 0.225)],
        silk: { w: 0.62, d: 0.62 },
      }
    case 'switch-slide':
      return {
        pads: [...row(3, PITCH, 0, (x, z) => tht(x, z, 0.15)), tht(-0.43, 0, 0.18, 'oval', 0.1), tht(0.43, 0, 0.18, 'oval', 0.1)],
        silk: { w: 0.86, d: 0.36 },
      }
    case 'potentiometer':
      return {
        pads: [...row(3, 0.25, 0.4, (x, z) => tht(x, z, 0.17)), tht(-0.48, -0.3, 0.2, 'oval', 0.12), tht(0.48, -0.3, 0.2, 'oval', 0.12)],
        silk: { w: 0.98, d: 0.98 },
      }
    case 'buzzer':
      return { pads: [tht(-0.38, 0, 0.18, 'rect'), tht(0.38, 0, 0.18)], silk: { w: 1.2, d: 1.2, round: true, mark: [-0.7, -0.3] } }
    case 'transformer':
      return {
        pads: [tht(-1.0, -0.9, 0.24), tht(-1.0, 0.9, 0.24), tht(1.0, -0.9, 0.24), tht(1.0, 0.9, 0.24)],
        silk: { w: 3.1, d: 2.7 },
      }
    case 'testpoint':
      // params.pad: pad diameter in board units (default 0.2; a big practice pad for hand soldering)
      return { pads: [tht(0, 0, num(part, 'pad', 0.2), 'round', 0.1)] }
    case 'oled':
      return { pads: row(4, PITCH, -1.27, (x, z) => tht(x, z, 0.17)) }
    case 'sensor-ultrasonic':
      return { pads: row(4, PITCH, 0, (x, z) => tht(x, z, 0.17)), silk: { w: 4.5, d: 0.3 } }
    case 'module': {
      const n = modulePins(part)
      if (n === 0) return { pads: [] }
      const z = moduleRowZ(part)
      return { pads: [...row(n, PITCH, z, (x, zz) => tht(x, zz)), ...row(n, PITCH, -z, (x, zz) => tht(x, zz))] }
    }
    case 'wifi-module': {
      const pads: Pad[] = []
      for (let i = 0; i < 14; i++) {
        const z = 1.2 - i * 0.127
        pads.push(smd(-0.9, z, 0.12, 0.07, [-1, 0]), smd(0.9, z, 0.12, 0.07, [1, 0]))
      }
      for (let i = 0; i < 10; i++) pads.push(smd((i - 4.5) * 0.127, 1.275, 0.07, 0.12, [0, 1]))
      return { pads, silk: { w: 1.8, d: 2.55 } }
    }
    case 'logic-ic-label':
    case 'wire':
    case 'probe':
    case 'multimeter':
    case 'breadboard':
    case 'battery-aa-pack':
    case 'battery-9v':
    case 'battery-lipo':
    case 'dc-motor':
    case 'gear-motor-wheel':
    case 'servo':
    case 'stepper-nema17':
    case 'load-cell':
      return { pads: [] }
  }
}

/** Part-local (x, z) → board (x, z) using pos and rot (degrees about +Y). */
export function toBoard(part: PartPlacement, x: number, z: number): [number, number] {
  const p = part.pos
  const px = p[0]
  const pz = p.length === 3 ? p[2] : p[1]
  const a = ((part.rot ?? 0) * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [px + x * c + z * s, pz - x * s + z * c]
}
