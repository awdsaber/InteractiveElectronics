// Orthographic camera at the true isometric angle (elevation 35.264°,
// azimuth 45°) with gently clamped OrbitControls.

import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { OrthographicCamera as OrthoImpl } from 'three'

export const ISO_ELEVATION_DEG = 35.264
export const ISO_AZIMUTH_DEG = 45

const D2R = Math.PI / 180

export interface IsoCameraProps {
  /** pixels per board unit (orthographic zoom). Default 60 */
  zoom?: number
  minZoom?: number
  maxZoom?: number
  /** look-at point in board units */
  target?: [number, number, number]
  /** allow orbiting (clamped). Default true */
  orbit?: boolean
  /** allow panning. Default false */
  pan?: boolean
  /** clamp pan to |x| ≤ w/2, |z| ≤ d/2 around the initial target */
  panBounds?: [number, number]
  /** ± degrees of azimuth swing around 45°. Default 25 */
  azimuthSwing?: number
  /** ± degrees of elevation swing around 35.264°. Default 12 */
  elevationSwing?: number
  /** camera distance from target (only affects clipping). Default 60 */
  distance?: number
  /** change to snap the camera back to the iso pose */
  resetKey?: unknown
}

export function isoPosition(
  target: [number, number, number],
  distance: number,
  azimuthDeg = ISO_AZIMUTH_DEG,
  elevationDeg = ISO_ELEVATION_DEG,
): [number, number, number] {
  const az = azimuthDeg * D2R
  const el = elevationDeg * D2R
  return [
    target[0] + distance * Math.cos(el) * Math.sin(az),
    target[1] + distance * Math.sin(el),
    target[2] + distance * Math.cos(el) * Math.cos(az),
  ]
}

export function IsoCamera({
  zoom = 60,
  minZoom,
  maxZoom,
  target = [0, 0, 0],
  orbit = true,
  pan = false,
  panBounds,
  azimuthSwing = 25,
  elevationSwing = 12,
  distance = 60,
  resetKey,
}: IsoCameraProps) {
  const cam = useRef<OrthoImpl>(null)
  const controls = useRef<OrbitControlsImpl>(null)
  const [tx, ty, tz] = target
  const position = useMemo(() => isoPosition([tx, ty, tz], distance), [tx, ty, tz, distance])

  // Snap back to the iso pose when target / zoom / resetKey change.
  useEffect(() => {
    const c = cam.current
    const ctl = controls.current
    if (!c) return
    c.position.set(...position)
    c.zoom = zoom
    c.updateProjectionMatrix()
    if (ctl) {
      ctl.target.set(tx, ty, tz)
      ctl.update()
    }
  }, [position, zoom, tx, ty, tz, resetKey])

  const polar = 90 - ISO_ELEVATION_DEG
  return (
    <>
      <OrthographicCamera
        ref={cam}
        makeDefault
        position={position}
        zoom={zoom}
        near={0.1}
        far={distance * 4}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        target={[tx, ty, tz]}
        enableRotate={orbit}
        enablePan={pan}
        enableZoom
        enableDamping
        dampingFactor={0.12}
        screenSpacePanning
        zoomToCursor={pan}
        minZoom={minZoom ?? zoom * 0.5}
        maxZoom={maxZoom ?? zoom * 4}
        minAzimuthAngle={(ISO_AZIMUTH_DEG - azimuthSwing) * D2R}
        maxAzimuthAngle={(ISO_AZIMUTH_DEG + azimuthSwing) * D2R}
        minPolarAngle={(polar - elevationSwing) * D2R}
        maxPolarAngle={(polar + elevationSwing) * D2R}
        onChange={() => {
          const ctl = controls.current
          if (!ctl || !panBounds) return
          const t = ctl.target
          const cx = Math.min(tx + panBounds[0] / 2, Math.max(tx - panBounds[0] / 2, t.x))
          const cz = Math.min(tz + panBounds[1] / 2, Math.max(tz - panBounds[1] / 2, t.z))
          if (cx !== t.x || cz !== t.z) {
            const dx = cx - t.x
            const dz = cz - t.z
            t.x = cx
            t.z = cz
            ctl.object.position.x += dx
            ctl.object.position.z += dz
          }
        }}
      />
    </>
  )
}
