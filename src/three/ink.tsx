// <InkMesh> and <InkInstances>: cel-shaded toon fill + drei <Outlines> ink
// hull. Geometry and materials come from module caches; the hull uses a
// crease-smoothed copy of the geometry (also cached) so box corners close.

import { Outlines } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { ThreeElements } from '@react-three/fiber'
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { edgesGeometry, outlineGeometry } from './geometry'
import { createInkMaterial, inkMaterial, isPerInstance, lookKeyOf, type InkLook } from './materials'
import { INK } from './palette'
import { applyWobble } from './wobble'

/** Default ink line width in CSS pixels (constant on screen, like a pen). */
export const INK_PX = 1.6

export interface InkState {
  /** char every InkMesh below (burnt part) */
  burnt: boolean
}

export const InkContext = createContext<InkState>({ burnt: false })

export interface InkLookProps {
  color: string
  /** 0..1 emissive glow */
  glow?: number
  glowColor?: string
  opacity?: number
  /** outline width in CSS px, or false for none */
  outline?: number | false
  outlineColor?: string
  /** ignore lights (screens, holes, decals) */
  unlit?: boolean
  map?: THREE.Texture
  alphaTest?: number
  /** surface decal: polygon offset toward the camera */
  decal?: boolean
  side?: THREE.Side
  /** keep original colour when the part is burnt (labels, screens) */
  noChar?: boolean
}

type MeshProps = Omit<ThreeElements['mesh'], 'geometry' | 'material' | 'args' | 'color'>

export type InkMeshProps = MeshProps &
  InkLookProps & {
    geometry: THREE.BufferGeometry
    /**
     * Texture for the cap faces of an ExtrudeGeometry (group 0: top and
     * bottom); sides keep `color`. Lets slabs carry artwork with no
     * separate coplanar decal.
     */
    capMap?: THREE.Texture
    /** draw hard edges as 1 px ink lines (thin plates, where a hull fails) */
    edges?: boolean
  }

/**
 * Shared cached material for ordinary looks; for a per-instance texture
 * (`texture.userData.perInstance`) a private material that is disposed on
 * unmount, so the cache never holds a disposed texture.
 */
export function useInkMaterial(look: InkLook): THREE.Material {
  const own = isPerInstance(look.map)
  const key = lookKeyOf(look)
  const shared = own ? null : inkMaterial(look)
  const priv = useMemo(
    () => (own ? createInkMaterial(look) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [own, key],
  )
  useEffect(() => () => priv?.dispose(), [priv])
  return (priv ?? shared) as THREE.Material
}

function useLookMaterial(look: InkLookProps): THREE.Material {
  const { burnt } = useContext(InkContext)
  return useInkMaterial({
    color: look.color,
    glow: look.glow,
    glowColor: look.glowColor,
    opacity: look.opacity,
    burnt: burnt && !look.noChar,
    unlit: look.unlit,
    map: look.map,
    alphaTest: look.alphaTest,
    decal: look.decal,
    side: look.side,
  })
}

let lineMat: THREE.LineBasicMaterial | null = null

/** Shared ink line material for edge-drawn thin plates. */
export function inkLineMaterial(): THREE.LineBasicMaterial {
  if (!lineMat) lineMat = applyWobble(new THREE.LineBasicMaterial({ color: INK }))
  return lineMat
}

/** A cel-shaded mesh with an ink outline. */
export function InkMesh({
  geometry,
  color,
  glow,
  glowColor,
  opacity,
  outline = INK_PX,
  outlineColor = INK,
  unlit,
  map,
  alphaTest,
  decal,
  side,
  noChar,
  capMap,
  edges,
  children,
  ...rest
}: InkMeshProps) {
  const material = useLookMaterial({ color, glow, glowColor, opacity, unlit, map, alphaTest, decal, side, noChar })
  const cap = useInkMaterial({ color: '#ffffff', map: capMap ?? null })
  const mats = useMemo(() => (capMap ? [cap, material] : material), [capMap, cap, material])
  return (
    <mesh geometry={geometry} material={mats} {...rest}>
      {outline !== false && <InkHull geometry={geometry} px={outline} color={outlineColor} />}
      {edges && <lineSegments geometry={edgesGeometry(geometry)} material={inkLineMaterial()} raycast={() => null} />}
      {children}
    </mesh>
  )
}

type HullHost = THREE.Group & {
  geometry?: THREE.BufferGeometry
  isInstancedMesh?: boolean
  count?: number
  instanceMatrix?: THREE.InstancedBufferAttribute
}

/**
 * drei <Outlines> reads `parent.geometry`. We parent it to a host group that
 * carries the cached crease-smoothed hull geometry (and, for instances, the
 * instance matrix), so the hull stays closed and nothing is cloned per mesh.
 */
export function InkHull({
  geometry,
  hull,
  px,
  color = INK,
  instanced,
}: {
  geometry?: THREE.BufferGeometry
  /** ready-made hull geometry (skips the crease pass) */
  hull?: THREE.BufferGeometry
  px: number
  color?: string
  instanced?: THREE.InstancedMesh
}) {
  const dpr = useThree((s) => s.viewport.dpr)
  const host = useMemo(() => {
    const g = new THREE.Group() as HullHost
    g.userData.inkHullPx = px
    g.geometry = hull ?? outlineGeometry(geometry as THREE.BufferGeometry)
    if (instanced) {
      g.isInstancedMesh = true
      g.count = instanced.count
      g.instanceMatrix = instanced.instanceMatrix
    }
    return g
  }, [geometry, hull, instanced, px])
  const hullMat = useRef<THREE.Material | null>(null)
  useLayoutEffect(() => {
    const hull = host.children[0]?.children[0] as THREE.Mesh | undefined
    if (hull && !Array.isArray(hull.material)) {
      applyWobble(hull.material)
      hullMat.current = hull.material
    }
    if (hull) hull.raycast = () => {}
  })
  // drei <Outlines> keeps its ShaderMaterial in useState and never disposes it
  useEffect(
    () => () => {
      hullMat.current?.dispose()
      hullMat.current = null
    },
    [],
  )
  return (
    <primitive object={host}>
      <Outlines angle={0} thickness={px * dpr} color={color} />
    </primitive>
  )
}

export type Vec3 = [number, number, number]

export interface InkInstance {
  p: Vec3
  /** euler XYZ radians */
  r?: Vec3
  s?: Vec3 | number
}

type GroupProps = Omit<ThreeElements['group'], 'args' | 'color'>

export type InkInstancesProps = GroupProps &
  InkLookProps & {
    geometry: THREE.BufferGeometry
    items: readonly InkInstance[]
  }

const tmpObj = new THREE.Object3D()

/** Many copies of one geometry in a single draw call (pins, holes, fins). */
export function InkInstances({
  geometry,
  items,
  color,
  glow,
  glowColor,
  opacity,
  outline = INK_PX,
  outlineColor = INK,
  unlit,
  map,
  alphaTest,
  decal,
  side,
  noChar,
  ...rest
}: InkInstancesProps) {
  const material = useLookMaterial({ color, glow, glowColor, opacity, unlit, map, alphaTest, decal, side, noChar })
  const count = Math.max(1, items.length)
  const inst = useMemo(() => new THREE.InstancedMesh(geometry, material, count), [geometry, count])
  useLayoutEffect(() => {
    inst.material = material
  }, [inst, material])
  useLayoutEffect(() => {
    items.forEach((it, i) => {
      tmpObj.position.set(it.p[0], it.p[1], it.p[2])
      if (it.r) tmpObj.rotation.set(it.r[0], it.r[1], it.r[2])
      else tmpObj.rotation.set(0, 0, 0)
      const s = it.s ?? 1
      if (typeof s === 'number') tmpObj.scale.setScalar(s)
      else tmpObj.scale.set(s[0], s[1], s[2])
      tmpObj.updateMatrix()
      inst.setMatrixAt(i, tmpObj.matrix)
    })
    inst.count = items.length
    inst.instanceMatrix.needsUpdate = true
    inst.computeBoundingSphere()
  }, [inst, items])
  useEffect(() => () => inst.dispose(), [inst])
  if (items.length === 0) return null
  return (
    <group {...rest}>
      <primitive object={inst}>
        {outline !== false && <InkHull geometry={geometry} px={outline} color={outlineColor} instanced={inst} />}
      </primitive>
    </group>
  )
}

/**
 * Lights the toon gradient is tuned for: top faces lit, +Z faces mid tone,
 * +X faces in shade under the iso camera.
 */
export function InkLights() {
  return (
    <>
      <ambientLight intensity={0.42 * Math.PI} />
      <directionalLight position={[-3.5, 8.5, 4]} intensity={0.6 * Math.PI} />
    </>
  )
}
