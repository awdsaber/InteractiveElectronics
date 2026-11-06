// Cutting-mat base under the board: a green self-healing mat with a 10 mm
// grid (bold every 50 mm) and a ruler edge. Top surface sits at BENCH_Y.

import * as THREE from 'three'
import { G, extrudeUp, geo, roundedRectShape } from './geometry'
import { InkMesh } from './ink'
import { MAT } from './palette'
import { BENCH_Y } from './parts/types'
import { MONO, drawnTexture } from './textures'

export interface BenchBaseProps {
  /** mat size in board units. Default [36, 26] */
  size?: [number, number]
  /** centre of the mat (x, z). Default [0, 0] */
  center?: [number, number]
  color?: string
  /** mat top height. Default BENCH_Y (just under the PCB) */
  y?: number
}

const TILE = 5

function gridTile(color: string) {
  return drawnTexture(`mat-grid:${color}`, 400, 400, (ctx, W) => {
    const s = W / TILE
    ctx.fillStyle = color
    ctx.fillRect(0, 0, W, W)
    ctx.strokeStyle = MAT.line
    ctx.globalAlpha = 0.55
    ctx.lineWidth = 1.2
    for (let i = 1; i < TILE; i++) {
      ctx.beginPath()
      ctx.moveTo(i * s, 0)
      ctx.lineTo(i * s, W)
      ctx.moveTo(0, i * s)
      ctx.lineTo(W, i * s)
      ctx.stroke()
    }
    ctx.globalAlpha = 0.9
    ctx.strokeStyle = MAT.bold
    ctx.lineWidth = 2.4
    ctx.strokeRect(0, 0, W, W)
    ctx.globalAlpha = 1
  })
}

function rulerStrip(len: number) {
  const ppu = 40
  return drawnTexture(`mat-ruler:${len}`, len * ppu, 0.6 * ppu, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H)
    ctx.strokeStyle = MAT.bold
    ctx.fillStyle = MAT.bold
    ctx.lineWidth = 1.5
    ctx.font = `600 ${H * 0.36}px ${MONO}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    for (let mm = 0; mm <= len * 10; mm += 5) {
      const x = (mm / 10) * ppu
      const tall = mm % 50 === 0 ? 0.55 : mm % 10 === 0 ? 0.35 : 0.2
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H * tall)
      ctx.stroke()
      if (mm % 50 === 0 && mm > 0 && mm < len * 10) ctx.fillText(String(mm / 10), x, H)
    }
  })
}

export function BenchBase({ size = [36, 26], center = [0, 0], color = MAT.base, y = BENCH_Y }: BenchBaseProps) {
  const [w, d] = size
  const t = 0.2
  const slab = geo(`mat:${w}:${d}`, () => extrudeUp(roundedRectShape(w, d, 0.4), t, 4))
  // the grid rides on the slab's top cap (cap UVs are board units)
  const grid = gridTile(color)
  if (grid.wrapS !== THREE.RepeatWrapping) {
    grid.wrapS = THREE.RepeatWrapping
    grid.wrapT = THREE.RepeatWrapping
    grid.repeat.set(1 / TILE, 1 / TILE)
    grid.needsUpdate = true
  }
  const ruler = rulerStrip(Math.floor(w - 1))
  return (
    <group position={[center[0], y, center[1]]}>
      <InkMesh geometry={slab} position={[0, -t, 0]} color={color} capMap={grid} />
      <InkMesh
        geometry={G.planeY()}
        position={[0, 0.0012, d / 2 - 0.62]}
        scale={[Math.floor(w - 1), 1, 0.6]}
        color="#ffffff"
        map={ruler}
        alphaTest={0.05}
        decal
        outline={false}
        noChar
      />
    </group>
  )
}
