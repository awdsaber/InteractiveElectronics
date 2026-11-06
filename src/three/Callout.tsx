// Callout tag: a white pill with an ink border and monospace caps, joined to
// its part by an ink leader line with a dot at the anchor (spec §2).

import { Html, Line } from '@react-three/drei'
import { G } from './geometry'
import { InkMesh, type Vec3 } from './ink'
import { ACCENT, INK, OK, WARN } from './palette'
import { MONO } from './textures'

export type CalloutTone = 'ink' | 'accent' | 'warn' | 'ok'

export interface CalloutProps {
  text: string
  /** point on the part the leader starts from (local units) */
  anchor?: Vec3
  /** label position relative to the anchor. Default up and to the screen-left */
  offset?: Vec3
  tone?: CalloutTone
}

const TONE: Record<CalloutTone, string> = { ink: INK, accent: ACCENT, warn: WARN, ok: OK }

export function Callout({ text, anchor = [0, 0, 0], offset = [-0.45, 1.1, 0.45], tone = 'ink' }: CalloutProps) {
  const end: Vec3 = [anchor[0] + offset[0], anchor[1] + offset[1], anchor[2] + offset[2]]
  const c = TONE[tone]
  return (
    <group>
      <Line points={[anchor, end]} color={INK} lineWidth={1.25} />
      <InkMesh geometry={G.sphere(8, 6)} color={INK} unlit outline={false} noChar position={anchor} scale={0.035} />
      <Html position={end} center pointerEvents="none" zIndexRange={[20, 0]}>
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
          {tone !== 'ink' && (
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
          {text}
        </div>
      </Html>
    </group>
  )
}
