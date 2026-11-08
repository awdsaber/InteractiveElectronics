// The inspector's close-up: one part alone in a small canvas of its own, lit like the bench and
// slowly turning. It draws the part through the same registry and PartRenderState as the main
// scene (partState / liveParams), so glow, burnt and value states match live. Mounted only while
// the card is open; frameloop "demand" unless it is turning.

import { OrthographicCamera } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Box3, Vector3, type Group } from 'three'
import type { BenchSnapshot } from '../engine/bench/simLoop'
import type { Lesson, PartPlacement } from '../engine/types'
import { liveParams, partState } from './Board'
import { isoPosition } from './IsoCamera'
import { InkLights } from './ink'
import { partRegistry, type PartRenderState } from './parts'

/** turn rate, rad/s (one turn in about 18 s) */
export const CLOSEUP_SPIN = 0.35

export interface PartCloseupProps {
  lesson: Lesson
  part: PartPlacement
  snap: BenchSnapshot
  /** slowly turn the part (frameloop "always"); off: still, frameloop "demand" */
  spin: boolean
}

/** the part at the origin, unrotated, shown whatever the assembly state */
export function closeupPart(p: PartPlacement): PartPlacement {
  return { ...p, pos: p.pos.length === 3 ? [0, p.pos[1], 0] : [0, 0], rot: 0 }
}

const box = new Box3()
const center = new Vector3()
const extent = new Vector3()

const SIN_EL = Math.sin((35.264 * Math.PI) / 180)
const COS_EL = Math.cos((35.264 * Math.PI) / 180)

/**
 * Orthographic zoom (px per unit) that keeps a part of box size [w, h, d] inside a width × height
 * canvas at every turn angle seen from the iso elevation: across, its footprint diagonal; up,
 * that diagonal foreshortened plus its height.
 */
export function closeupZoom([w, h, d]: [number, number, number], width: number, height: number): number {
  const diag = Math.max(0.05, Math.hypot(w, d))
  const tall = Math.max(0.05, diag * SIN_EL + h * COS_EL)
  return Math.min((0.88 * width) / diag, (0.82 * height) / tall)
}

function Turntable({ part, state, spin }: { part: PartPlacement; state: PartRenderState; spin: boolean }) {
  const turn = useRef<Group>(null)
  const inner = useRef<Group>(null)
  const fitted = useRef('')
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const Comp = partRegistry[part.kind]
  const fitKey = `${part.kind}:${JSON.stringify(part.params ?? {})}:${size.width}x${size.height}`
  useFrame((_, dt) => {
    const t = turn.current
    const g = inner.current
    if (!t || !g) return
    if (spin) t.rotation.y += Math.min(0.1, dt) * CLOSEUP_SPIN
    // centre and fit once the part has geometry (and again when its look or the canvas changes)
    if (fitted.current === fitKey) return
    // measure unturned, so the box is the part's own
    const turned = t.rotation.y
    t.rotation.y = 0
    g.position.set(0, 0, 0)
    g.updateWorldMatrix(true, true)
    box.setFromObject(g)
    t.rotation.y = turned
    if (box.isEmpty()) {
      invalidate()
      return
    }
    box.getCenter(center)
    box.getSize(extent)
    // turn about the part's own centre: offset the part, not the turntable
    t.position.set(0, 0, 0)
    g.position.set(-center.x, -center.y, -center.z)
    const cam = camera as { zoom: number; updateProjectionMatrix(): void }
    cam.zoom = closeupZoom([extent.x, extent.y, extent.z], size.width, size.height)
    cam.updateProjectionMatrix()
    fitted.current = fitKey
    invalidate()
  })
  return (
    <group ref={turn}>
      <group ref={inner}>
        <Comp part={part} state={state} />
      </group>
    </group>
  )
}

export default function PartCloseup({ lesson, part, snap, spin }: PartCloseupProps) {
  const shown = useMemo(() => closeupPart(liveParams(part, snap)), [part, snap])
  const live = partState(lesson, part, snap)
  // always drawn here (an unplaced or stripped part can still be looked at); no tag, no lift
  const state: PartRenderState = { ...live, visible: true, explodedOffset: 0, showLabel: false }
  const animated = spin || state.burnt || (state.rpm ?? 0) !== 0
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      frameloop={animated ? 'always' : 'demand'}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden="true"
    >
      <OrthographicCamera makeDefault position={isoPosition([0, 0, 0], 30)} zoom={60} near={0.1} far={120} onUpdate={(c) => c.lookAt(0, 0, 0)} />
      <InkLights />
      <Turntable part={shown} state={state} spin={spin} />
    </Canvas>
  )
}
