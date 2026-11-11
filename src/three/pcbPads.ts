// Footprint pads in board coordinates (pure, no WebGL): the same transform the Pcb texture uses,
// so the DRC (src/engine/pcb/drc.ts) and the layer tour measure the pads that are drawn.

import type { PartPlacement } from '../engine/types'
import { footprint, type Pad } from './parts/footprints'

export interface WorldPad extends Pad {
  part: string
  index: number
}

/** a part's pads, moved and rotated onto the board (rot is degrees about +y, as in Pcb.tsx) */
export function worldPads(part: PartPlacement): WorldPad[] {
  const px = part.pos[0]
  const pz = part.pos.length === 3 ? part.pos[2] : part.pos[1]
  const a = ((part.rot ?? 0) * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  const quarter = Math.abs(Math.round(((part.rot ?? 0) / 90) % 2)) === 1
  return footprint(part).pads.map((p, index) => ({
    ...p,
    // the canvas rotates by −rot: (x, z) → (x·c + z·s, −x·s + z·c)
    x: px + p.x * c + p.z * s,
    z: pz - p.x * s + p.z * c,
    w: quarter ? p.d : p.w,
    d: quarter ? p.w : p.d,
    part: part.id,
    index,
  }))
}

/** a `padAt` resolver for runDrc */
export function padResolver(parts: readonly PartPlacement[]): (part: string, pad: number) => [number, number] | undefined {
  const cache = new Map<string, WorldPad[]>()
  return (id, k) => {
    let pads = cache.get(id)
    if (!pads) {
      const p = parts.find((x) => x.id === id)
      if (!p) return undefined
      pads = worldPads(p)
      cache.set(id, pads)
    }
    const pad = pads[k]
    return pad ? [pad.x, pad.z] : undefined
  }
}
