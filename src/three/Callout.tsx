// Callout tag: a white pill with an ink border and monospace caps, joined to
// its part by an ink leader line with a dot at the anchor (spec §2).
//
// The leader and dot live in the 3D scene; the pill is drawn by one DOM overlay
// (<CalloutHost>, wrapped around the <Canvas>) that every Callout registers with.
// See calloutLayer.ts for why this is not a drei <Html> per tag.

import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { createContext, useContext, useId, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { Vector3, type Group, type Object3D } from 'three'
import { createCalloutLayer, type CalloutEntry, type CalloutLayer, type CalloutTone } from './calloutLayer'
import { G } from './geometry'
import { InkMesh, type Vec3 } from './ink'
import { ACCENT, INK, OK, WARN } from './palette'
import { MONO } from './textures'

export type { CalloutTone } from './calloutLayer'

export interface CalloutProps {
  text: string
  /** point on the part the leader starts from (local units) */
  anchor?: Vec3
  /**
   * Label position relative to the anchor, in board units at the reference
   * zoom (60 px/unit). The leader is divided by the camera zoom each frame,
   * so it keeps the same on-screen length whether zoomed in or out.
   */
  offset?: Vec3
  tone?: CalloutTone
  /** Hide without unregistering (toggled labels stay mounted, which is cheap). */
  hidden?: boolean
}

const TONE: Record<CalloutTone, string> = { ink: INK, accent: ACCENT, warn: WARN, ok: OK }

/** Zoom (px per unit) at which `offset` is taken literally. */
export const CALLOUT_REF_ZOOM = 60

const CalloutLayerContext = createContext<CalloutLayer | null>(null)

/** Shown while it and every ancestor is visible (drop animation, unplaced parts). */
function shown(o: Object3D | null): boolean {
  for (let p = o; p; p = p.parent) if (!p.visible) return false
  return true
}

const v = new Vector3()

export function Callout({ text, anchor = [0, 0, 0], offset = [-0.45, 1.1, 0.45], tone = 'ink', hidden = false }: CalloutProps) {
  const layer = useContext(CalloutLayerContext)
  const id = useId()
  const grp = useRef<Group>(null)
  const tip = useRef<Group>(null)
  useLayoutEffect(() => {
    layer?.set({ id, text, tone, hidden })
  }, [layer, id, text, tone, hidden])
  useLayoutEffect(() => () => layer?.remove(id), [layer, id])
  useFrame(({ camera, size }) => {
    const g = grp.current
    const z = (camera as { zoom?: number }).zoom ?? 1
    if (g) g.scale.setScalar(CALLOUT_REF_ZOOM / Math.max(1e-3, z))
    const t = tip.current
    if (!layer || !t) return
    t.getWorldPosition(v).project(camera)
    layer.place(id, {
      x: ((v.x + 1) / 2) * size.width,
      y: ((1 - v.y) / 2) * size.height,
      visible: !hidden && v.z >= -1 && v.z <= 1 && shown(t),
      z: Math.round((1 - v.z) * 500),
    })
  })
  return (
    <group ref={grp} position={anchor} visible={!hidden}>
      <Line points={[[0, 0, 0], offset]} color={INK} lineWidth={1.25} />
      <InkMesh geometry={G.sphere(8, 6)} color={INK} unlit outline={false} noChar scale={0.035} />
      <group ref={tip} position={offset} />
    </group>
  )
}

function Pill({ entry, layer }: { entry: CalloutEntry; layer: CalloutLayer }) {
  const c = TONE[entry.tone]
  return (
    <div
      ref={(el) => {
        layer.bind(entry.id, el)
        return () => layer.bind(entry.id, null)
      }}
      className="callout"
      data-callout={entry.text}
      style={{ position: 'absolute', top: 0, left: 0, visibility: 'hidden', display: entry.hidden ? 'none' : undefined }}
    >
      <div
        style={{
          background: '#ffffff',
          border: `1.5px solid ${INK}`,
          borderRadius: 999,
          padding: '2px 9px 2px 8px',
          font: `600 10.5px/1.35 ${MONO}`,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: c,
          whiteSpace: 'nowrap',
          boxShadow: `2px 2px 0 ${INK}`,
          userSelect: 'none',
        }}
      >
        {entry.tone !== 'ink' && (
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: 3,
              background: c,
              marginRight: 6,
              verticalAlign: 1,
            }}
          />
        )}
        {entry.text}
      </div>
    </div>
  )
}

/**
 * Wrap a <Canvas> (positioned `absolute; inset: 0`) with this: it provides the callout
 * layer to the scene and draws every registered tag in one overlay the same size as the
 * canvas.
 */
export function CalloutHost({ children }: { children: ReactNode }) {
  const layer = useMemo(createCalloutLayer, [])
  const entries = useSyncExternalStore(layer.subscribe, layer.list, layer.list)
  return (
    <CalloutLayerContext.Provider value={layer}>
      {children}
      <div
        className="callout-layer"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', isolation: 'isolate' }}
      >
        {entries.map((e) => (
          <Pill key={e.id} entry={e} layer={layer} />
        ))}
      </div>
    </CalloutLayerContext.Provider>
  )
}
