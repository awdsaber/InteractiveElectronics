// Hover / selection mark for the part inspector: ink corner brackets around a part's bounding
// box, in blueprint blue (dashed while hovered, solid when selected). The box is taken in the
// part's own (rotated) frame, so a chip turned 45° gets a snug box, not its world AABB. Pure
// segment maths in `bracketSegments`, so it is testable without WebGL.

import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { Box3, Matrix4, type BufferGeometry, type Object3D } from 'three'
import { ACCENT } from './palette'

type V3 = [number, number, number]

/**
 * Corner brackets of the box min..max (padded by `pad`): three ticks at each of the 8 corners,
 * each `frac` of that edge long. Returns segment endpoint pairs (48 points).
 */
export function bracketSegments(min: V3, max: V3, pad = 0.04, frac = 0.22): V3[] {
  const lo = min.map((v) => v - pad) as V3
  const hi = max.map((v) => v + pad) as V3
  const len = [0, 1, 2].map((i) => Math.max(0.03, (hi[i] - lo[i]) * frac))
  const pts: V3[] = []
  for (const cx of [0, 1])
    for (const cy of [0, 1])
      for (const cz of [0, 1]) {
        const c: V3 = [cx ? hi[0] : lo[0], cy ? hi[1] : lo[1], cz ? hi[2] : lo[2]]
        const dir = [cx ? -1 : 1, cy ? -1 : 1, cz ? -1 : 1]
        for (let axis = 0; axis < 3; axis++) {
          const end = [...c] as V3
          end[axis] += dir[axis] * len[axis]
          pts.push(c, end)
        }
      }
  return pts
}

const box = new Box3()
const tmp = new Box3()
const inv = new Matrix4()
const rel = new Matrix4()

/** the registered part's own group under a board slot (skips the callout leader beside it) */
export function partBody(slot: Object3D): Object3D {
  let hit: Object3D | undefined
  slot.traverse((o) => {
    if (!hit && o.userData?.partId !== undefined) hit = o
  })
  return hit ?? slot
}

type Measurable = Object3D & {
  geometry?: BufferGeometry
  isSprite?: boolean
  isInstancedMesh?: boolean
  boundingBox?: Box3 | null
  computeBoundingBox?: () => void
}

/** bounding box of everything under `root`, in `frame`'s local coordinates (sprites skipped) */
export function localBox(root: Object3D, frame: Object3D, out: Box3): Box3 {
  out.makeEmpty()
  root.updateWorldMatrix(true, true)
  inv.copy(frame.matrixWorld).invert()
  root.traverse((o) => {
    const m = o as Measurable
    if (!m.geometry || m.isSprite) return
    let bb: Box3 | null | undefined
    if (m.isInstancedMesh) {
      if (!m.boundingBox) m.computeBoundingBox?.()
      bb = m.boundingBox
    } else {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
      bb = m.geometry.boundingBox
    }
    if (!bb || bb.isEmpty()) return
    tmp.copy(bb).applyMatrix4(rel.multiplyMatrices(inv, m.matrixWorld))
    out.union(tmp)
  })
  return out
}

const keyOf = (b: Box3, m: Matrix4) => [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z, ...m.elements].map((v) => v.toFixed(3)).join(',')

interface Mark {
  min: V3
  max: V3
  matrix: Matrix4
}

/** Brackets that follow a part's bounding box (drop and exploded-view animation included). */
export function PartHighlight({ object, mode }: { object: Object3D | undefined; mode: 'hover' | 'selected' }) {
  const [b, setB] = useState<Mark | null>(null)
  const last = useRef('')
  useFrame(() => {
    // measure the part body (the frame group tagged with its partId), not its callout leader,
    // in the frame of its rotation group
    const body = object && partBody(object)
    if (!body) return
    const frame = body.children[0] ?? body
    localBox(frame, frame, box)
    if (box.isEmpty()) return
    const k = keyOf(box, frame.matrixWorld)
    if (k === last.current) return
    last.current = k
    setB({ min: box.min.toArray() as V3, max: box.max.toArray() as V3, matrix: frame.matrixWorld.clone() })
  })
  const pts = useMemo(() => (b ? bracketSegments(b.min, b.max) : null), [b])
  if (!pts || !b) return null
  return (
    <group matrixAutoUpdate={false} matrix={b.matrix}>
      <Line
        points={pts}
        segments
        color={ACCENT}
        lineWidth={mode === 'selected' ? 2.25 : 1.5}
        dashed={mode === 'hover'}
        dashSize={0.06}
        gapSize={0.04}
        depthTest={false}
        renderOrder={10}
        raycast={() => null}
      />
    </group>
  )
}
