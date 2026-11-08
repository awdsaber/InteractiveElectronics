// The workbench canvas (lazy-loaded chunk): iso camera framed to the board, ink lights,
// wobble clock and the lesson Board. Renders on demand unless something moves.

import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
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

function Camera({ lesson }: { lesson: Lesson }) {
  const size = useThree((s) => s.size)
  const frame = useMemo(() => boardFrame(lesson.board), [lesson.board])
  const [w, d] = frame.size
  const [cx, cz] = frame.center ?? [0, 0]
  const overlays = size.width > 600 && window.innerWidth > 760
  const zoom = fitZoom(w, d, size.width, size.height, overlays)
  // a little off-centre so the board sits between the action column and the status panel
  return <IsoCamera zoom={zoom} target={[cx + (overlays ? -0.4 : 0), 0.4, cz]} minZoom={zoom * 0.7} maxZoom={zoom * 3} resetKey={`${lesson.id}:${size.width}x${size.height}`} distance={80} />
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

export default function BenchScene({ lesson, snap, settings }: BenchSceneProps) {
  const smoking = Object.values(snap.partBurnt).some(Boolean)
  const live = snap.assembly.running || smoking
  return (
    <CalloutHost>
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
      <Camera lesson={lesson} />
      <Board lesson={lesson} snap={snap} settings={settings} />
    </Canvas>
    </CalloutHost>
  )
}
