// The PCB: an FR4 slab (top at y = 0) whose top face is one canvas texture
// holding solder mask, traces, copper pads (from every part's footprint),
// drill holes, silkscreen outlines, reference designators and the board name.
// One mesh + one decal per board, however many pads.

import { useMemo } from 'react'
import * as THREE from 'three'
import type { BoardSpec, PartPlacement } from '../engine/types'
import { extrudeUp, geo, roundedRectShape } from './geometry'
import { InkMesh } from './ink'
import { C, DEFAULT_PCB } from './palette'
import { footprint, type Pad } from './parts/footprints'
import { PCB_THICKNESS } from './parts/types'
import { MONO, fitCapTexture, useCanvasTexture } from './textures'

export interface PcbProps {
  spec: BoardSpec
  /** solder-mask colour override (palette control); default spec.pcbColor */
  color?: string
  /** draw silkscreen outlines and designators. Default true */
  silk?: boolean
  /** draw pads for these parts only (e.g. hide pads of off-board parts). Default all */
  parts?: PartPlacement[]
}

const CORNER = 0.12

function mix(a: string, b: string, t: number): string {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawPad(ctx: CanvasRenderingContext2D, pad: Pad, s: number) {
  const x = pad.x * s
  const y = pad.z * s
  const w = pad.w * s
  const d = pad.d * s
  ctx.fillStyle = C.gold
  ctx.strokeStyle = '#a8862f'
  ctx.lineWidth = Math.max(1, 0.01 * s)
  ctx.beginPath()
  if (pad.shape === 'round') ctx.arc(x, y, w / 2, 0, Math.PI * 2)
  else if (pad.shape === 'oval') ctx.ellipse(x, y, w / 2, d / 2, 0, 0, Math.PI * 2)
  else ctx.rect(x - w / 2, y - d / 2, w, d)
  ctx.fill()
  ctx.stroke()
  if (pad.drill) {
    ctx.fillStyle = '#2a2622'
    ctx.beginPath()
    ctx.arc(x, y, (pad.drill * s) / 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawPcbArt(
  ctx: CanvasRenderingContext2D,
  W: number,
  spec: BoardSpec,
  mask: string,
  parts: PartPlacement[],
  silk: boolean,
): void {
  const [bw, bd] = spec.size
  const s = W / bw
  const u = (x: number) => (x + bw / 2) * s
  const v = (z: number) => (z + bd / 2) * s
  ctx.fillStyle = mix(mask, "#1d1b17", 0.35)
  ctx.fillRect(0, 0, W, bd * s)
  roundRectPath(ctx, 0, 0, bw * s, bd * s, CORNER * s)
  ctx.fillStyle = mask
  ctx.fill()
  ctx.save()
  roundRectPath(ctx, 0, 0, bw * s, bd * s, CORNER * s)
  ctx.clip()

  // traces: copper under mask reads as a lighter shade of the mask
  ctx.strokeStyle = mix(mask, '#ffffff', 0.2)
  ctx.lineWidth = 0.07 * s
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const line of spec.traces ?? []) {
    if (line.length < 2) continue
    ctx.beginPath()
    line.forEach(([x, z], i) => (i ? ctx.lineTo(u(x), v(z)) : ctx.moveTo(u(x), v(z))))
    ctx.stroke()
  }

  // mounting holes
  if (bw >= 3 && bd >= 2) {
    for (const [x, z] of [
      [-bw / 2 + 0.3, -bd / 2 + 0.3],
      [bw / 2 - 0.3, -bd / 2 + 0.3],
      [-bw / 2 + 0.3, bd / 2 - 0.3],
      [bw / 2 - 0.3, bd / 2 - 0.3],
    ])
      drawPad(ctx, { x: x + bw / 2, z: z + bd / 2, w: 0.36, d: 0.36, shape: 'round', drill: 0.22 }, s)
  }

  for (const part of parts) {
    const fp = footprint(part)
    if (fp.pads.length === 0 && !fp.silk) continue
    const p = part.pos
    const px = p[0]
    const pz = p.length === 3 ? p[2] : p[1]
    ctx.save()
    ctx.translate(u(px), v(pz))
    ctx.rotate(-((part.rot ?? 0) * Math.PI) / 180)
    if (silk && fp.silk) {
      const k = fp.silk
      ctx.strokeStyle = C.silk
      ctx.lineWidth = Math.max(1, 0.025 * s)
      const cx = (k.x ?? 0) * s
      const cz = (k.z ?? 0) * s
      ctx.beginPath()
      if (k.round) ctx.ellipse(cx, cz, (k.w / 2) * s, (k.d / 2) * s, 0, 0, Math.PI * 2)
      else ctx.rect(cx - (k.w / 2) * s, cz - (k.d / 2) * s, k.w * s, k.d * s)
      ctx.stroke()
      if (k.mark) {
        ctx.fillStyle = C.silk
        ctx.beginPath()
        ctx.arc(k.mark[0] * s, k.mark[1] * s, 0.04 * s, 0, Math.PI * 2)
        ctx.fill()
      }
      const ref = part.id.toUpperCase().slice(0, 6)
      ctx.fillStyle = C.silk
      ctx.font = `600 ${0.13 * s}px ${MONO}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillText(ref, cx - (k.w / 2) * s, cz - (k.d / 2) * s - 0.03 * s)
    }
    for (const pad of fp.pads) drawPad(ctx, pad, s)
    ctx.restore()
  }

  if (silk && spec.name) {
    ctx.fillStyle = C.silk
    ctx.font = `700 ${0.26 * s}px ${MONO}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${0.03 * s}px`
    ctx.fillText(spec.name.toUpperCase(), u(-bw / 2 + 0.22), v(bd / 2 - 0.2))
  }
  ctx.restore()
}

export function Pcb({ spec, color, silk = true, parts }: PcbProps) {
  const [w, d] = spec.size
  const mask = color ?? spec.pcbColor ?? DEFAULT_PCB
  const ppu = Math.min(180, 2048 / Math.max(w, d))
  const list = parts ?? spec.parts
  const edge = useMemo(() => mix(mask, '#d8cc9c', 0.55), [mask])
  const slab = geo(`pcb-slab:${w}:${d}`, () => extrudeUp(roundedRectShape(w, d, CORNER), PCB_THICKNESS, 3))
  const art = useCanvasTexture(
    w * ppu,
    d * ppu,
    (ctx, W) => drawPcbArt(ctx, W, spec, mask, list, silk),
    [spec, mask, list, silk],
  )
  fitCapTexture(art, w, d)
  return <InkMesh geometry={slab} position={[0, -PCB_THICKNESS, 0]} color={edge} capMap={art} />
}

