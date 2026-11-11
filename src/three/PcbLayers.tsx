// A board with `board.layers`, drawn layer by layer: assembled it is one FR-4 slab with the composite
// art (mask over copper, gold pads, silk); in the exploded view the stack peels apart into bottom
// copper, core, top copper, solder mask and silkscreen, each labelled, with the drill hits as pins
// through all of them. The `pcb-tour` view isolates one layer; its DRC switch rings each violation.

import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { runDrc } from '../engine/pcb/drc'
import { liveTrace } from '../engine/pcb/drc'
import { PCB_LAYERS, PCB_STACK, PEEL_FAN, PEEL_GAP, layerShift, layerVisible, layerY, type PcbLayerId } from '../engine/pcb/layers'
import type { BenchSnapshot } from '../engine/bench/simLoop'
import type { Lesson } from '../engine/types'
import { Callout } from './Callout'
import { extrudeUp, geo, roundedRectShape } from './geometry'
import { InkMesh } from './ink'
import { DEFAULT_PCB, INK, WARN } from './palette'
import { PCB_THICKNESS } from './parts/types'
import { drawLayerArt, drillHits, FR4, type ArtInput, type ArtLayer } from './pcbLayerArt'
import { padResolver } from './pcbPads'
import { drcPill, type TourState } from './pcbTour'
import { fitCapTexture, useCanvasTexture } from './textures'

export interface PcbLayersProps {
  lesson: Lesson
  snap: BenchSnapshot
  tour: TourState
  color?: string
}

const CORNER = 0.12

function useArt(input: ArtInput, layer: ArtLayer, w: number, d: number, key: string) {
  const ppu = Math.min(220, 2048 / Math.max(w, d))
  return useCanvasTexture(w * ppu, d * ppu, (ctx, W) => drawLayerArt(ctx, W, input, layer), [key, layer, w, d])
}

/** a sheet that eases to its target height */
function Sheet({ y, z = 0, children }: { y: number; z?: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const invalidate = useThree((s) => s.invalidate)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const dy = y - g.position.y
    const dz = z - g.position.z
    if (Math.abs(dy) < 0.002 && Math.abs(dz) < 0.002) {
      if (g.position.y !== y || g.position.z !== z) g.position.set(0, y, z)
      return
    }
    g.position.y += dy * 0.16
    g.position.z += dz * 0.16
    invalidate()
  })
  return <group ref={ref}>{children}</group>
}

function Film({ map, w, d }: { map: THREE.Texture; w: number; d: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} raycast={() => null}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial map={map} transparent alphaTest={0.02} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

const LABEL: Record<PcbLayerId, string> = Object.fromEntries(PCB_LAYERS.map((l) => [l.id, `${l.label.toUpperCase()} · ${l.file}`])) as Record<PcbLayerId, string>

export function PcbLayers({ lesson, snap, tour, color }: PcbLayersProps) {
  const spec = lesson.board
  const layers = spec.layers!
  const [w, d] = spec.size
  const mask = color ?? spec.pcbColor ?? DEFAULT_PCB
  const top = layers.top.map((t) => liveTrace(t, tour.param))
  const bottom = layers.bottom.map((t) => liveTrace(t, tour.param))
  const burnt = new Set(snap.assembly.burns.map((b) => b.elementId))
  const key = `${mask}|${top.map((t) => t.w).join(',')}|${[...burnt].join(',')}`
  // the art input changes only with the key (widths, burns, mask colour)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const input = useMemo<ArtInput>(() => ({ spec, layers, top, bottom, burnt, mask }), [key, spec])
  const tex = {
    composite: useArt(input, 'composite', w, d, key),
    'bottom-copper': useArt(input, 'bottom-copper', w, d, key),
    core: useArt(input, 'core', w, d, key),
    'top-copper': useArt(input, 'top-copper', w, d, key),
    mask: useArt(input, 'mask', w, d, key),
    silk: useArt(input, 'silk', w, d, key),
    drill: useArt(input, 'drill', w, d, key),
  }
  fitCapTexture(tex.composite, w, d)
  fitCapTexture(tex.core, w, d)
  const slab = geo(`pcb-slab:${w}:${d}`, () => extrudeUp(roundedRectShape(w, d, CORNER), PCB_THICKNESS, 3))
  const pin = geo('pcb-drill-pin', () => new THREE.CylinderGeometry(1, 1, 1, 10, 1, true))
  const ring = geo('pcb-drc-ring', () => new THREE.RingGeometry(0.75, 1, 40))

  const { view, peeled } = tour
  const stack = peeled || view !== 'all'
  const holes = useMemo(() => drillHits(spec, layers), [spec, layers])
  const padAt = useMemo(() => padResolver(spec.parts), [spec.parts])
  // an isolated copper layer shows only its own violations
  const violations = tour.drc
    ? runDrc(layers, { param: tour.param, padAt }).filter((v) => (view === 'top-copper' ? v.layer === 'top' : view === 'bottom-copper' ? v.layer === 'bottom' : true))
    : []

  const yOf = (id: PcbLayerId) => layerY(id, peeled, view)
  const zOf = (id: PcbLayerId) => layerShift(id, peeled, view)
  const drcLayer = (side: 'top' | 'bottom'): PcbLayerId => (side === 'top' ? 'top-copper' : 'bottom-copper')
  const drcPos = (side: 'top' | 'bottom', x: number, z: number): [number, number, number] =>
    view !== 'all' || !peeled ? [x, 0.012, z] : [x, yOf(drcLayer(side)) + 0.012, z + zOf(drcLayer(side))]
  // drill hits: straight pins from the bottom sheet to the silk, slanted with the fan
  const pinFrom = new THREE.Vector3()
  const pinTo = new THREE.Vector3()
  const pinPose = (x: number, z: number, d: number) => {
    pinFrom.set(x, yOf('bottom-copper') - 0.05, z + zOf('bottom-copper') + 0.05 * (PEEL_FAN / PEEL_GAP))
    pinTo.set(x, yOf('silk') + 0.05, z + zOf('silk') - 0.05 * (PEEL_FAN / PEEL_GAP))
    const dir = pinTo.clone().sub(pinFrom)
    const len = dir.length()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    const mid = pinFrom.clone().add(pinTo).multiplyScalar(0.5)
    return { position: mid.toArray() as [number, number, number], quaternion: q, scale: [d / 2, len, d / 2] as [number, number, number] }
  }

  return (
    <group>
      {!stack && <InkMesh geometry={slab} position={[0, -PCB_THICKNESS, 0]} color={mixEdge(mask)} capMap={tex.composite} />}
      {stack &&
        PCB_STACK.filter((l) => layerVisible(view, l.id)).map((l) => (
          <Sheet key={l.id} y={yOf(l.id)} z={zOf(l.id)}>
            {l.id === 'core' ? (
              <InkMesh geometry={slab} position={[0, -PCB_THICKNESS, 0]} color={FR4} capMap={tex.core} />
            ) : (
              <Film map={tex[l.id]} w={w} d={d} />
            )}
            <Callout text={LABEL[l.id]} anchor={[w / 2, 0, d / 2]} offset={[0.9, 0.15, 0.25]} tone="accent" />
          </Sheet>
        ))}
      {stack && view === 'drill' && (
        <>
          <Film map={tex.drill} w={w} d={d} />
          <Callout text={LABEL.drill} anchor={[w / 2, 0, d / 2]} offset={[0.9, 0.15, 0.25]} tone="accent" />
        </>
      )}
      {/* drill hits as pins through the peeled stack */}
      {peeled && view === 'all' && (
        <group>
          {holes.map((h, i) => (
            <mesh key={i} geometry={pin} {...pinPose(h.x, h.z, Math.max(0.02, h.d))} raycast={() => null}>
              <meshBasicMaterial color={INK} transparent opacity={0.6} toneMapped={false} />
            </mesh>
          ))}
          <Callout text={LABEL.drill} anchor={pinPose(holes[0]?.x ?? 0, holes[0]?.z ?? 0, 0.02).position} offset={[-0.9, 0.3, 0.5]} tone="accent" />
        </group>
      )}
      {violations.map((v) => (
        <group key={v.id} position={drcPos(v.layer, v.at[0], v.at[1])}>
          <mesh geometry={ring} rotation={[-Math.PI / 2, 0, 0]} scale={0.16} raycast={() => null}>
            <meshBasicMaterial color={WARN} toneMapped={false} side={THREE.DoubleSide} depthTest={false} />
          </mesh>
          <Callout text={drcPill(v)} anchor={[0, 0.02, 0]} offset={[-0.3, 0.9, 0.3]} tone="warn" />
        </group>
      ))}
    </group>
  )
}

function mixEdge(mask: string): string {
  return '#' + new THREE.Color(mask).lerp(new THREE.Color('#d8cc9c'), 0.55).getHexString()
}
