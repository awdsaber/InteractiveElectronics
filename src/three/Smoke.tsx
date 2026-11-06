// Cartoon smoke puff for burnt parts: faceted ink-outlined blobs that rise,
// swell and shrink away on a loop. Shared geometry and materials; only the
// transforms animate, so it costs nothing to keep a few on screen.

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { G } from './geometry'
import { InkMesh } from './ink'

export interface SmokeProps {
  position?: [number, number, number]
  /** overall size multiplier. Default 1 */
  scale?: number
  /** number of puffs. Default 5 */
  puffs?: number
  /** seconds per rise. Default 2.4 */
  period?: number
}

const SHADES = ['#77726a', '#948f86', '#5f5a53', '#aaa59b']

export function Smoke({ position = [0, 0, 0], scale = 1, puffs = 5, period = 2.4 }: SmokeProps) {
  const root = useRef<Group>(null)
  const t0 = useRef(Math.random() * period)
  useFrame((_, dt) => {
    const g = root.current
    if (!g) return
    t0.current += dt
    g.children.forEach((child, i) => {
      const phase = (t0.current / period + i / puffs) % 1
      const swell = Math.sin(Math.PI * Math.min(1, phase * 1.15))
      const s = (0.08 + 0.2 * swell) * (1 - phase * 0.35)
      child.position.set(
        Math.sin(i * 2.3 + phase * 3.1) * 0.12 * (0.4 + phase) - phase * 0.25,
        phase * 1.4,
        Math.cos(i * 1.7 + phase * 2.3) * 0.1 * (0.4 + phase) + phase * 0.15,
      )
      child.scale.setScalar(Math.max(0.001, s))
      child.rotation.set(phase * 2 + i, phase * 3, 0)
    })
  })
  return (
    <group position={position} scale={scale}>
      <group ref={root}>
        {Array.from({ length: puffs }, (_, i) => (
          <InkMesh key={i} geometry={G.sphere(7, 5)} color={SHADES[i % SHADES.length]} noChar />
        ))}
      </group>
    </group>
  )
}
