// Canvas art for each manufacturing layer of a board with `board.layers` (see PcbLayers.tsx):
// copper (pads, traces, vias, fiducials, pours with clearance and thermal relief), FR-4 core,
// solder mask (openings over pads), silkscreen, drill hits, and the assembled composite.

import type { BoardSpec, PcbLayersSpec, PcbTrace } from '../engine/types'
import { C } from './palette'
import { footprint } from './parts/footprints'
import { worldPads, type WorldPad } from './pcbPads'
import { MONO } from './textures'

export type ArtLayer = 'bottom-copper' | 'core' | 'top-copper' | 'mask' | 'silk' | 'drill' | 'composite'

export interface ArtInput {
  spec: BoardSpec
  layers: PcbLayersSpec
  /** traces with live widths */
  top: PcbTrace[]
  bottom: PcbTrace[]
  /** trace ids burnt open */
  burnt: Set<string>
  mask: string
}

export const COPPER = C.copper
export const FR4 = '#cdbf8e'
const BURNT = '#3a2a1c'
const HOLE = '#24201b'

interface Hole {
  x: number
  z: number
  /** diameter, board units */
  d: number
}

/** every pad on the board (off-board parts have none) */
export function boardPads(spec: BoardSpec): WorldPad[] {
  return spec.parts.filter((p) => !p.hidden && p.mount !== 'offboard').flatMap(worldPads)
}

/** the corner mounting holes the plain Pcb draws (same rule) */
export function mountingHoles(spec: BoardSpec): Hole[] {
  const [bw, bd] = spec.size
  if (bw < 3 || bd < 2) return []
  return [
    [-bw / 2 + 0.3, -bd / 2 + 0.3],
    [bw / 2 - 0.3, -bd / 2 + 0.3],
    [-bw / 2 + 0.3, bd / 2 - 0.3],
    [bw / 2 - 0.3, bd / 2 - 0.3],
  ].map(([x, z]) => ({ x, z, d: 0.22 }))
}

/** every drill hit: plated pads, vias, mounting holes */
export function drillHits(spec: BoardSpec, layers: PcbLayersSpec): Hole[] {
  const pads = boardPads(spec)
    .filter((p) => p.drill)
    .map((p) => ({ x: p.x, z: p.z, d: p.drill! }))
  const vias = (layers.vias ?? []).map((v) => ({ x: v.at[0], z: v.at[1], d: v.drill / 10 }))
  return [...pads, ...vias, ...mountingHoles(spec)]
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** `bare`: the mask alone, opaque and without the sheet outline (for the composite) */
export function drawLayerArt(ctx: CanvasRenderingContext2D, W: number, a: ArtInput, layer: ArtLayer, bare = false): void {
  const [bw, bd] = a.spec.size
  const s = W / bw
  const u = (x: number) => (x + bw / 2) * s
  const v = (z: number) => (z + bd / 2) * s
  const H = bd * s
  const pads = boardPads(a.spec)
  const L = a.layers
  const netOf = (p: WorldPad) => L.padNets?.[`${p.part}:${p.index}`]

  const outline = (stroke = 'rgba(29,27,23,0.55)', dash = true) => {
    ctx.save()
    ctx.strokeStyle = stroke
    ctx.lineWidth = Math.max(2, 0.025 * s)
    if (dash) ctx.setLineDash([0.12 * s, 0.08 * s])
    rr(ctx, ctx.lineWidth, ctx.lineWidth, W - 2 * ctx.lineWidth, H - 2 * ctx.lineWidth, 0.12 * s)
    ctx.stroke()
    ctx.restore()
  }
  const padPath = (p: { x: number; z: number; w: number; d: number; shape: string }, grow = 0) => {
    ctx.beginPath()
    const w = p.w * s + 2 * grow
    const d = p.d * s + 2 * grow
    if (p.shape === 'round') ctx.arc(u(p.x), v(p.z), w / 2, 0, Math.PI * 2)
    else if (p.shape === 'oval') ctx.ellipse(u(p.x), v(p.z), w / 2, d / 2, 0, 0, Math.PI * 2)
    else ctx.rect(u(p.x) - w / 2, v(p.z) - d / 2, w, d)
  }
  const tracePath = (t: PcbTrace) => {
    ctx.beginPath()
    t.pts.forEach(([x, z], i) => (i ? ctx.lineTo(u(x), v(z)) : ctx.moveTo(u(x), v(z))))
  }
  const strokeTrace = (t: PcbTrace, color: string, grow = 0) => {
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1.5, (t.w / 10) * s + 2 * grow)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    tracePath(t)
    ctx.stroke()
  }
  const holes = (color = HOLE) => {
    ctx.fillStyle = color
    for (const h of drillHits(a.spec, L)) {
      ctx.beginPath()
      ctx.arc(u(h.x), v(h.z), Math.max(1.2, (h.d * s) / 2), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const copper = (side: 'top' | 'bottom', color: string) => {
    const traces = side === 'top' ? a.top : a.bottom
    const sidePads = pads.filter((p) => side === 'top' || p.drill)
    const pour = L.pours?.find((p) => p.layer === side)
    if (pour) {
      const clr = (pour.clearance / 10) * s
      ctx.save()
      ctx.fillStyle = color
      rr(ctx, 0.05 * s, 0.05 * s, W - 0.1 * s, H - 0.1 * s, 0.1 * s)
      ctx.fill()
      // clear round everything not on the pour's net
      ctx.globalCompositeOperation = 'destination-out'
      for (const t of traces) if (t.net !== pour.net) strokeTrace(t, '#000', clr)
      for (const p of sidePads) {
        const relief = L.pourPads?.find((q) => q.part === p.part && q.pad === p.index)
        if (netOf(p) === pour.net && relief && !relief.relief) continue
        padPath(p, clr)
        ctx.fill()
      }
      for (const via of L.vias ?? [])
        if (via.net !== pour.net) {
          ctx.beginPath()
          ctx.arc(u(via.at[0]), v(via.at[1]), (via.pad / 20) * s + clr, 0, Math.PI * 2)
          ctx.fill()
        }
      for (const h of mountingHoles(a.spec)) {
        ctx.beginPath()
        ctx.arc(u(h.x), v(h.z), 0.18 * s + clr, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
      // thermal-relief spokes back to the pour
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(2, 0.03 * s)
      for (const p of sidePads) {
        const relief = L.pourPads?.find((q) => q.part === p.part && q.pad === p.index)
        if (netOf(p) !== pour.net || !relief?.relief) continue
        const r = Math.max(p.w, p.d) * s * 0.5 + clr + 0.02 * s
        ctx.beginPath()
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          ctx.moveTo(u(p.x), v(p.z))
          ctx.lineTo(u(p.x) + dx * r, v(p.z) + dz * r)
        }
        ctx.stroke()
      }
    }
    for (const t of traces) {
      if (a.burnt.has(t.elementId ?? '')) {
        strokeTrace(t, BURNT)
        // the open: a gap burnt through the middle
        const m = Math.floor(t.pts.length / 2)
        const [x0, z0] = t.pts[m - 1] ?? t.pts[0]
        const [x1, z1] = t.pts[m]
        ctx.fillStyle = FR4
        ctx.beginPath()
        ctx.arc(u((x0 + x1) / 2), v((z0 + z1) / 2), Math.max(4, (t.w / 10) * s * 1.6), 0, Math.PI * 2)
        ctx.fill()
      } else strokeTrace(t, color)
    }
    ctx.fillStyle = color
    for (const p of sidePads) {
      padPath(p)
      ctx.fill()
    }
    for (const via of L.vias ?? []) {
      ctx.beginPath()
      ctx.arc(u(via.at[0]), v(via.at[1]), (via.pad / 20) * s, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const h of mountingHoles(a.spec)) {
      ctx.beginPath()
      ctx.arc(u(h.x), v(h.z), 0.18 * s, 0, Math.PI * 2)
      ctx.fill()
    }
    if (side === 'top')
      for (const f of L.fiducials ?? []) {
        ctx.beginPath()
        ctx.arc(u(f.at[0]), v(f.at[1]), (f.d / 20) * s, 0, Math.PI * 2)
        ctx.fill()
      }
  }

  const maskArt = (alpha: number) => {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = a.mask
    rr(ctx, 0, 0, W, H, 0.12 * s)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'destination-out'
    // openings: every pad (0.05 mm expansion), fiducials with a clear ring, mounting holes; vias tented
    for (const p of pads) {
      padPath(p, 0.005 * s)
      ctx.fill()
    }
    for (const f of L.fiducials ?? []) {
      ctx.beginPath()
      ctx.arc(u(f.at[0]), v(f.at[1]), (f.d / 10) * s, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const h of mountingHoles(a.spec)) {
      ctx.beginPath()
      ctx.arc(u(h.x), v(h.z), 0.19 * s, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  const silkArt = () => {
    ctx.strokeStyle = C.silk
    ctx.fillStyle = C.silk
    for (const part of a.spec.parts) {
      if (part.hidden || part.mount === 'offboard') continue
      const fp = footprint(part)
      if (!fp.silk) continue
      const k = fp.silk
      const px = part.pos[0]
      const pz = part.pos.length === 3 ? part.pos[2] : part.pos[1]
      ctx.save()
      ctx.translate(u(px), v(pz))
      ctx.rotate(-((part.rot ?? 0) * Math.PI) / 180)
      ctx.lineWidth = Math.max(1, 0.025 * s)
      const cx = (k.x ?? 0) * s
      const cz = (k.z ?? 0) * s
      ctx.beginPath()
      if (k.round) ctx.ellipse(cx, cz, (k.w / 2) * s, (k.d / 2) * s, 0, 0, Math.PI * 2)
      else ctx.rect(cx - (k.w / 2) * s, cz - (k.d / 2) * s, k.w * s, k.d * s)
      ctx.stroke()
      if (k.mark) {
        ctx.beginPath()
        ctx.arc(k.mark[0] * s, k.mark[1] * s, 0.04 * s, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.font = `600 ${0.13 * s}px ${MONO}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillText(part.id.toUpperCase().slice(0, 6), cx - (k.w / 2) * s, cz - (k.d / 2) * s - 0.03 * s)
      ctx.restore()
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (const t of L.silk ?? []) {
      ctx.font = `700 ${(t.size ?? 0.14) * s}px ${MONO}`
      ctx.fillText(t.text, u(t.at[0]), v(t.at[1]))
    }
    if (a.spec.name) {
      ctx.font = `700 ${0.26 * s}px ${MONO}`
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(a.spec.name.toUpperCase(), u(-bw / 2 + 0.22), v(bd / 2 - 0.2))
    }
  }

  ctx.clearRect(0, 0, W, H)
  switch (layer) {
    case 'bottom-copper':
      copper('bottom', COPPER)
      holes()
      outline()
      break
    case 'top-copper':
      copper('top', COPPER)
      holes()
      outline()
      break
    case 'core': {
      ctx.fillStyle = FR4
      rr(ctx, 0, 0, W, H, 0.12 * s)
      ctx.fill()
      // the glass weave, faintly
      ctx.strokeStyle = 'rgba(120,104,60,0.16)'
      ctx.lineWidth = 1
      for (let x = 0; x < W; x += 0.08 * s) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
      }
      for (let y = 0; y < H; y += 0.08 * s) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }
      holes()
      break
    }
    case 'mask':
      maskArt(bare ? 1 : 0.92)
      if (!bare) outline()
      break
    case 'silk':
      silkArt()
      outline()
      break
    case 'drill':
      holes()
      outline()
      break
    case 'composite':
      ctx.fillStyle = FR4
      rr(ctx, 0, 0, W, H, 0.12 * s)
      ctx.fill()
      copper('top', COPPER)
      // mask over copper reads as a lighter shade of the mask; openings show the bare (plated) pads
      if (typeof document !== 'undefined') {
        const off = document.createElement('canvas')
        off.width = ctx.canvas.width
        off.height = ctx.canvas.height
        const o = off.getContext('2d')
        if (o) {
          drawLayerArt(o, W, a, 'mask', true)
          ctx.save()
          ctx.globalAlpha = 0.88
          ctx.drawImage(off, 0, 0)
          ctx.restore()
        }
      }
      ctx.fillStyle = C.gold
      for (const p of pads) {
        padPath(p)
        ctx.fill()
      }
      for (const f of L.fiducials ?? []) {
        ctx.beginPath()
        ctx.arc(u(f.at[0]), v(f.at[1]), (f.d / 20) * s, 0, Math.PI * 2)
        ctx.fill()
      }
      for (const t of a.top) if (a.burnt.has(t.elementId ?? '')) strokeTrace(t, BURNT)
      silkArt()
      holes()
      break
  }
}
