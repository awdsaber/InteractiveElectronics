// Small building blocks shared by the part bodies. All geometry is unit
// primitives scaled per mesh, so they share the module geometry cache.

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import { G, disposeOutline, geo } from '../geometry'
import { InkInstances, InkMesh, type InkInstance, type InkLookProps, type Vec3 } from '../ink'
import { C } from '../palette'
import { glowTexture, textTexture, type TextOpts } from '../textures'

export type { Vec3 }

type Look = Omit<InkLookProps, 'color'> & { color: string }

type Common = Look & {
  rotation?: Vec3
  children?: ReactNode
}

/** Plates thinner than this get 1 px edge lines instead of an outline hull. */
export const THIN = 0.05

function thinLook(s: Vec3, look: Look): Look & { edges?: boolean } {
  if (look.outline === false || Math.min(s[0], s[1], s[2]) >= THIN) return look
  return { ...look, outline: false, edges: true }
}

/** Box with its bottom face centred on p. */
export function Block({ p, s, rotation, children, ...look }: Common & { p: Vec3; s: Vec3 }) {
  return (
    <InkMesh geometry={G.box()} position={[p[0], p[1] + s[1] / 2, p[2]]} scale={s} rotation={rotation} {...thinLook(s, look)}>
      {children}
    </InkMesh>
  )
}

/** Box centred on p. */
export function BoxC({ p, s, rotation, children, ...look }: Common & { p: Vec3; s: Vec3 }) {
  return (
    <InkMesh geometry={G.box()} position={p} scale={s} rotation={rotation} {...thinLook(s, look)}>
      {children}
    </InkMesh>
  )
}

/** Vertical cylinder standing on p. */
export function CylY({ p, r, h, seg = 16, ...look }: Common & { p: Vec3; r: number; h: number; seg?: number }) {
  return <InkMesh geometry={G.cyl(seg)} position={[p[0], p[1] + h / 2, p[2]]} scale={[r, h, r]} {...look} />
}

/** Cylinder along X centred on p. */
export function CylX({ p, r, l, seg = 16, ...look }: Common & { p: Vec3; r: number; l: number; seg?: number }) {
  return <InkMesh geometry={G.cyl(seg)} position={p} rotation={[0, 0, Math.PI / 2]} scale={[r, l, r]} {...look} />
}

/** Cylinder along Z centred on p. */
export function CylZ({ p, r, l, seg = 16, ...look }: Common & { p: Vec3; r: number; l: number; seg?: number }) {
  return <InkMesh geometry={G.cyl(seg)} position={p} rotation={[Math.PI / 2, 0, 0]} scale={[r, l, r]} {...look} />
}

const UP = new THREE.Vector3(0, 1, 0)

/** Round rod from a to b (legs, wires, shafts). */
export function Rod({ a, b, r, seg = 6, ...look }: Look & { a: Vec3; b: Vec3; r: number; seg?: number }) {
  const { mid, len, quat } = useMemo(() => {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const dir = vb.clone().sub(va)
    const l = dir.length()
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize())
    return { mid: va.add(vb).multiplyScalar(0.5), len: l, quat: q }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a[0], a[1], a[2], b[0], b[1], b[2]])
  return <InkMesh geometry={G.cyl(seg)} position={mid} quaternion={quat} scale={[r, len, r]} {...look} />
}

/** Polyline of rods with round joints (bent component leads). */
export function LeadPath({ points, r = 0.025, color = C.tin, outline = 1.2 }: { points: Vec3[]; r?: number; color?: string; outline?: number | false }) {
  return (
    <>
      {points.slice(1).map((b, i) => (
        <Rod key={i} a={points[i]} b={b} r={r} color={color} outline={outline} />
      ))}
      {points.slice(1, -1).map((p, i) => (
        <InkMesh key={`j${i}`} geometry={G.sphere(6, 4)} position={p} scale={r} color={color} outline={false} />
      ))}
    </>
  )
}

/** Straight vertical lead from y0 down to y1 (default into the hole). */
export function Leg({ x, z, top, bottom = -0.05, r = 0.025, color = C.tin, square = false }: { x: number; z: number; top: number; bottom?: number; r?: number; color?: string; square?: boolean }) {
  if (square) return <Block p={[x, bottom, z]} s={[r * 2, top - bottom, r * 2]} color={color} outline={1.2} />
  return <CylY p={[x, bottom, z]} r={r} h={top - bottom} seg={6} color={color} outline={1.2} />
}

export type Facing = 'up' | '+z' | '-z' | '+x' | '-x'

const FACING_ROT: Record<Facing, Vec3> = {
  up: [-Math.PI / 2, 0, 0],
  '+z': [0, 0, 0],
  '-z': [0, Math.PI, 0],
  '+x': [0, Math.PI / 2, 0],
  '-x': [0, -Math.PI / 2, 0],
}

/** Flat unlit decal (no outline). `size` is [width, height] on the plane. */
export function Decal({
  p,
  size,
  facing = 'up',
  spin = 0,
  color = '#ffffff',
  map,
  opacity,
  round = false,
}: {
  p: Vec3
  size: [number, number]
  facing?: Facing
  /** rotation within the plane, radians */
  spin?: number
  color?: string
  map?: THREE.Texture
  opacity?: number
  round?: boolean
}) {
  const r = FACING_ROT[facing]
  return (
    <group position={p} rotation={r}>
      <InkMesh
        geometry={round ? G.discZ(20) : G.planeZ()}
        rotation={[0, 0, spin]}
        scale={round ? [size[0] / 2, size[1] / 2, 1] : [size[0], size[1], 1]}
        color={color}
        map={map}
        unlit
        outline={false}
        opacity={opacity}
        alphaTest={map ? 0.02 : undefined}
        decal
        noChar={!!map}
      />
    </group>
  )
}

/** Printed / laser-etched text on a surface. */
export function Marking({
  text,
  p,
  w,
  h,
  facing = 'up',
  spin = 0,
  color = C.silk,
  weight = 600,
  font = 'mono',
  px = 64,
}: {
  text: string
  p: Vec3
  w: number
  h: number
  facing?: Facing
  spin?: number
  color?: string
  weight?: number
  font?: TextOpts['font']
  px?: number
}) {
  if (!text) return null
  const lines = text.split('\n').length
  const map = textTexture({ text, aspect: w / h, color, weight, font, px: px * lines })
  return <Decal p={p} size={[w, h]} facing={facing} spin={spin} map={map} />
}

/** Soft coloured halo billboard + light pool for glowing parts. */
export function GlowHalo({ p, color, glow, size = 1.4, pool = true }: { p: Vec3; color: string; glow: number; size?: number; pool?: boolean }) {
  const sprite = useMemo(
    () => new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, opacity: 0 }),
    [color],
  )
  const poolMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, opacity: 0 }),
    [color],
  )
  useEffect(() => () => sprite.dispose(), [sprite])
  useEffect(() => () => poolMat.dispose(), [poolMat])
  const g = Math.min(1, Math.max(0, glow))
  sprite.opacity = 0.85 * g
  poolMat.opacity = 0.55 * g
  if (g <= 0.01) return null
  const s = size * (0.55 + 0.45 * g)
  return (
    <>
      <sprite material={sprite} position={p} scale={[s, s, 1]} renderOrder={5} />
      {pool && (
        <mesh geometry={G.planeY()} material={poolMat} position={[p[0], 0.004, p[2]]} scale={[s * 1.3, 1, s * 1.3]} renderOrder={4} />
      )}
    </>
  )
}

/** Visual rotations per second for a shaft spinning at `rpm` (capped so it reads on screen). */
export function visualRps(rpm: number): number {
  if (!Number.isFinite(rpm) || rpm === 0) return 0
  const rps = rpm / 60
  return Math.sign(rps) * Math.min(Math.abs(rps), 2.5)
}

/** Spin a group about an axis at the given rpm. */
export function useSpin(ref: RefObject<THREE.Object3D | null>, rpm: number, axis: 'x' | 'y' | 'z' = 'x'): void {
  const rps = useRef(0)
  rps.current = visualRps(rpm)
  useFrame((_, dt) => {
    const o = ref.current
    if (o && rps.current) o.rotation[axis] += rps.current * Math.PI * 2 * Math.min(dt, 0.05)
  })
}

/** Instanced small boxes (pins, slats). */
export function BoxInstances({ items, color, outline = 1.2, unlit }: { items: InkInstance[]; color: string; outline?: number | false; unlit?: boolean }) {
  return <InkInstances geometry={G.box()} items={items} color={color} outline={outline} unlit={unlit} />
}

export const deg = (d: number) => (d * Math.PI) / 180

/** userData for groups that move at runtime: <Bake> leaves them unmerged. */
export const SPINS = { noBake: true } as const

/**
 * Flexible cable through control points (Catmull-Rom). Per-instance geometry,
 * memoised on the points and disposed on unmount; pass `cacheKey` for fixed
 * shapes so identical cables share one geometry.
 */
export function Tube({
  points,
  r = 0.05,
  color,
  cacheKey,
  segments,
  outline,
  ends = true,
}: {
  points: Vec3[]
  r?: number
  color: string
  cacheKey?: string
  segments?: number
  outline?: number | false
  ends?: boolean
}) {
  const sig = points.map((p) => p.map((v) => v.toFixed(3)).join(',')).join(';')
  const geometry = useMemo(() => {
    const make = () => {
      const curve = new THREE.CatmullRomCurve3(
        points.map((p) => new THREE.Vector3(...p)),
        false,
        'centripetal',
      )
      const len = curve.getLength()
      return new THREE.TubeGeometry(curve, segments ?? Math.max(8, Math.min(96, Math.round(len * 14))), r, 7, false)
    }
    return cacheKey ? geo(`tube:${cacheKey}:${r}`, make) : make()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, r, cacheKey, segments])
  useEffect(() => {
    if (cacheKey) return
    return () => {
      disposeOutline(geometry)
      geometry.dispose()
    }
  }, [geometry, cacheKey])
  const a = points[0]
  const b = points[points.length - 1]
  return (
    <>
      <InkMesh geometry={geometry} color={color} outline={outline} />
      {ends && <InkMesh geometry={G.sphere(8, 6)} position={a} scale={r} color={color} outline={false} />}
      {ends && <InkMesh geometry={G.sphere(8, 6)} position={b} scale={r} color={color} outline={false} />}
    </>
  )
}
