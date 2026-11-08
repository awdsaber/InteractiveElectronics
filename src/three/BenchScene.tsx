// The workbench canvas (lazy-loaded chunk): iso camera framed to the board, ink lights,
// wobble clock and the lesson Board. Renders on demand unless something moves.

import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Box3, Sphere, Vector3, type Object3D } from 'three'
import { boardFrame } from './autoFrame'
import type { BenchSnapshot } from '../engine/bench/simLoop'
import type { Lesson } from '../engine/types'
import type { Settings } from '../ui/types'
import { Board } from './Board'
import { CalloutHost } from './Callout'
import { IsoCamera } from './IsoCamera'
import { InkLights } from './ink'
import { WobbleClock, setWobble } from './wobble'

export interface BenchSceneProps {
  lesson: Lesson
  snap: BenchSnapshot
  settings: Settings
  /** the inspected part */
  selected?: string | null
  /** click a part (or its callout pill) to inspect it */
  onSelect?: (id: string) => void
  /** camera request: frame a part, or the board (partId null); `seq` changes per request */
  view?: { partId: string | null; seq: number }
}

/**
 * Zoom and look-at that frame one part: its bounding sphere fills about 45 % of the free
 * canvas (the width left of a docked card, `insetRight` px), and the target is shifted along
 * the camera's right vector so the part sits in the middle of that free area.
 */
export function partGoal(
  center: [number, number, number],
  radius: number,
  width: number,
  height: number,
  insetRight: number,
  minZoom: number,
  maxZoom: number,
): { target: [number, number, number]; zoom: number } {
  const freeW = Math.max(160, width - insetRight)
  const zoom = Math.min(maxZoom, Math.max(minZoom, (0.45 * Math.min(freeW, height)) / Math.max(0.05, 2 * radius)))
  // camera right at the iso azimuth (45°): (cos 45°, 0, −sin 45°)
  const shift = Math.min(insetRight, width - freeW) / 2 / zoom
  const r = Math.SQRT1_2
  return { target: [center[0] + r * shift, center[1], center[2] - r * shift], zoom }
}

function findPart(root: Object3D, id: string): Object3D | undefined {
  let hit: Object3D | undefined
  root.traverse((o) => {
    if (!hit && o.userData?.partId === id) hit = o
  })
  return hit
}

/** px of the canvas covered by the docked inspector card on its right (0 when it is a bottom sheet) */
function cardInset(canvas: HTMLElement): number {
  const card = document.querySelector<HTMLElement>('.inspector[data-dock="side"]')
  if (!card) return 0
  const a = canvas.getBoundingClientRect()
  const b = card.getBoundingClientRect()
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left - 12))
}

/** pixels per board unit that fit a w × d board (plus part height) into the canvas */
export function fitZoom(w: number, d: number, width: number, height: number, overlays: boolean): number {
  const c = Math.SQRT1_2
  const spanX = (w + d) * c
  const spanY = (w + d) * c * Math.sin((35.264 * Math.PI) / 180) + 2.2
  const availW = Math.max(200, width - (overlays ? 430 : 24))
  const availH = Math.max(160, height - (overlays ? 40 : 16))
  return Math.max(12, Math.min(availW / spanX, availH / spanY))
}

const box = new Box3()
const sphere = new Sphere()

function Camera({ lesson, view }: { lesson: Lesson; view?: BenchSceneProps['view'] }) {
  const size = useThree((s) => s.size)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const frame = useMemo(() => boardFrame(lesson.board), [lesson.board])
  const [w, d] = frame.size
  const [cx, cz] = frame.center ?? [0, 0]
  const overlays = size.width > 600 && window.innerWidth > 760
  const zoom = fitZoom(w, d, size.width, size.height, overlays)
  const maxZoom = zoom * 8
  const partId = view?.partId ?? null
  const seq = view?.seq ?? 0
  const goal = useMemo(() => {
    if (!partId) return null
    const o = findPart(scene, partId)
    if (!o) return null
    box.setFromObject(o)
    if (box.isEmpty()) return null
    box.getBoundingSphere(sphere)
    return partGoal(sphere.center.toArray() as [number, number, number], sphere.radius, size.width, size.height, cardInset(gl.domElement), zoom, maxZoom)
    // seq: a repeated request re-measures (the part may have moved in the exploded view)
  }, [partId, seq, scene, gl, size.width, size.height, zoom, maxZoom])
  // a little off-centre so the board sits between the action column and the status panel
  return (
    <IsoCamera
      zoom={zoom}
      target={[cx + (overlays ? -0.4 : 0), 0.4, cz]}
      minZoom={zoom * 0.7}
      maxZoom={maxZoom}
      resetKey={`${lesson.id}:${size.width}x${size.height}`}
      distance={80}
      goal={goal}
      goalKey={seq}
    />
  )
}

/**
 * Dev / e2e only: `window.__partScreen(id)` gives the client-space point of a part's bounding-box
 * centre, so tests can click a part that has no callout pill.
 */
function DevPartProbe() {
  const get = useThree((s) => s.get)
  useEffect(() => {
    const w = window as unknown as { __partScreen?: (id: string) => { x: number; y: number } | null }
    w.__partScreen = (id) => {
      const { scene, camera, gl } = get()
      const o = findPart(scene, id)
      if (!o) return null
      box.setFromObject(o)
      if (box.isEmpty()) return null
      const v = box.getCenter(new Vector3()).project(camera)
      const r = gl.domElement.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    }
    return () => {
      delete w.__partScreen
    }
  }, [get])
  return null
}

/** wobble boils at 8 fps (the clock is stepped), so idle demand-mode frames at 8 fps are enough */
function WobbleTicker({ wobble }: { wobble: number }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    setWobble(wobble)
    invalidate()
    if (wobble <= 0) return
    const h = setInterval(() => invalidate(), 125)
    return () => clearInterval(h)
  }, [wobble, invalidate])
  return null
}

export default function BenchScene({ lesson, snap, settings, selected = null, onSelect, view }: BenchSceneProps) {
  const smoking = Object.values(snap.partBurnt).some(Boolean)
  const live = snap.assembly.running || smoking
  return (
    <CalloutHost onSelect={onSelect} selected={selected}>
    <Canvas
      flat
      dpr={[1, 2]}
      frameloop={live ? 'always' : 'demand'}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
      data-testid="bench-canvas"
      aria-label={`3D workbench: ${lesson.title}`}
    >
      <InkLights />
      <WobbleClock />
      <WobbleTicker wobble={settings.wobble} />
      <Camera lesson={lesson} view={view} />
      <Board lesson={lesson} snap={snap} settings={settings} selected={selected} onSelect={onSelect} />
      {import.meta.env.DEV && <DevPartProbe />}
    </Canvas>
    </CalloutHost>
  )
}
