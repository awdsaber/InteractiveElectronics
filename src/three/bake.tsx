// <Bake>: collapse a part's static sub-meshes into a few merged draws.
//
// Part bodies are authored as many small <InkMesh>/<InkInstances> (easy to
// read and tweak). After they mount, Bake walks the subtree, merges every
// opaque, untextured, non-glowing mesh (instances expanded) into one geometry
// per material class with per-vertex colours, merges their outline hulls into
// one hull and their edge lines into one line set, and hides the sources.
// Textured, transparent, glowing, sprite and `userData.noBake` subtrees
// (spinning shafts, servo horns) are left alone. It rebakes when `bakeKey`
// changes.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { outlineGeometry } from './geometry'
import { InkHull, inkLineMaterial } from './ink'
import { bakedMaterial } from './materials'

/** Hull width used for the merged outline (CSS px). */
export const BAKED_INK_PX = 1.5

export interface BakeResult {
  fills: THREE.Mesh[]
  hull: THREE.BufferGeometry | null
  lines: THREE.LineSegments | null
  /** number of source objects hidden */
  merged: number
  restore(): void
  dispose(): void
}

interface Bucket {
  unlit: boolean
  decal: boolean
  side: THREE.Side
  geos: THREE.BufferGeometry[]
}

function bakeable(mat: THREE.Material | THREE.Material[]): mat is THREE.MeshToonMaterial | THREE.MeshBasicMaterial {
  if (Array.isArray(mat)) return false
  if (!(mat instanceof THREE.MeshToonMaterial) && !(mat instanceof THREE.MeshBasicMaterial)) return false
  if (mat.transparent || mat.map || mat.vertexColors || mat.alphaTest > 0) return false
  if (mat instanceof THREE.MeshToonMaterial && mat.emissiveIntensity > 0 && mat.emissive.getHex() !== 0) return false
  return true
}

/** Non-indexed copy holding only position + normal (+ colour), transformed by m. */
function prep(src: THREE.BufferGeometry, m: THREE.Matrix4, color?: THREE.Color): THREE.BufferGeometry {
  const base = src.index ? src.toNonIndexed() : src.clone()
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', base.getAttribute('position'))
  const n = base.getAttribute('normal')
  if (n) g.setAttribute('normal', n)
  else g.computeVertexNormals()
  base.dispose()
  g.applyMatrix4(m)
  if (color) {
    const count = g.getAttribute('position').count
    const c = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      c[i * 3] = color.r
      c[i * 3 + 1] = color.g
      c[i * 3 + 2] = color.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  }
  return g
}

function linesOf(src: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', (src.index ? src.toNonIndexed() : src).getAttribute('position').clone())
  g.applyMatrix4(m)
  return g
}

function isHullHost(o: THREE.Object3D): boolean {
  return o.userData.inkHullPx !== undefined
}

/** Merge the static meshes under `root` (see file header). Pure three.js. */
export function bakeGroup(root: THREE.Object3D): BakeResult {
  root.updateWorldMatrix(true, true)
  const inv = root.matrixWorld.clone().invert()
  const buckets = new Map<string, Bucket>()
  const hulls: THREE.BufferGeometry[] = []
  const lines: THREE.BufferGeometry[] = []
  const hidden: THREE.Object3D[] = []
  const rel = new THREE.Matrix4()
  const inst = new THREE.Matrix4()
  const im = new THREE.Matrix4()

  const visit = (obj: THREE.Object3D): void => {
    if (obj !== root && (obj.userData.noBake || obj.userData.baked)) return
    if (!obj.visible) return
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh && bakeable(mesh.material)) {
      const others = obj.children.filter((c) => !isHullHost(c) && !(c as THREE.LineSegments).isLineSegments)
      if (others.length === 0) {
        const mat = mesh.material as THREE.MeshToonMaterial | THREE.MeshBasicMaterial
        const unlit = mat instanceof THREE.MeshBasicMaterial
        const key = `${unlit ? 1 : 0}|${mat.polygonOffset ? 1 : 0}|${mat.side}`
        let b = buckets.get(key)
        if (!b) {
          b = { unlit, decal: mat.polygonOffset, side: mat.side, geos: [] }
          buckets.set(key, b)
        }
        const outlined = obj.children.some(isHullHost)
        const edgeKids = obj.children.filter((c) => (c as THREE.LineSegments).isLineSegments) as THREE.LineSegments[]
        rel.multiplyMatrices(inv, obj.matrixWorld)
        const im0 = (obj as THREE.InstancedMesh).isInstancedMesh ? (obj as THREE.InstancedMesh) : null
        const n = im0 ? im0.count : 1
        for (let i = 0; i < n; i++) {
          if (im0) {
            im0.getMatrixAt(i, inst)
            im.multiplyMatrices(rel, inst)
          } else im.copy(rel)
          b.geos.push(prep(mesh.geometry, im, mat.color))
          if (outlined) hulls.push(prep(outlineGeometry(mesh.geometry), im))
          for (const e of edgeKids) {
            const em = new THREE.Matrix4().multiplyMatrices(im, e.matrix)
            lines.push(linesOf(e.geometry, em))
          }
        }
        obj.visible = false
        hidden.push(obj)
        return
      }
    }
    for (const c of obj.children) visit(c)
  }
  visit(root)

  const fills: THREE.Mesh[] = []
  for (const b of buckets.values()) {
    const g = mergeGeometries(b.geos, false)
    for (const x of b.geos) x.dispose()
    if (!g) continue
    g.computeBoundingSphere()
    const m = new THREE.Mesh(g, bakedMaterial(b.unlit, b.decal, b.side))
    m.userData.baked = true
    fills.push(m)
  }
  let hull: THREE.BufferGeometry | null = null
  if (hulls.length) {
    hull = mergeGeometries(hulls, false)
    for (const x of hulls) x.dispose()
    hull?.computeBoundingSphere()
  }
  let lineObj: THREE.LineSegments | null = null
  if (lines.length) {
    const lg = mergeGeometries(lines, false)
    for (const x of lines) x.dispose()
    if (lg) {
      lineObj = new THREE.LineSegments(lg, inkLineMaterial())
      lineObj.userData.baked = true
      lineObj.raycast = () => {}
    }
  }
  return {
    fills,
    hull,
    lines: lineObj,
    merged: hidden.length,
    restore() {
      for (const o of hidden) o.visible = true
    },
    dispose() {
      for (const f of fills) f.geometry.dispose()
      hull?.dispose()
      lineObj?.geometry.dispose()
    },
  }
}

/** Wrap static part geometry; children are merged after mount (see header). */
export function Bake({ bakeKey, enabled = true, children }: { bakeKey: string; enabled?: boolean; children: ReactNode }) {
  const root = useRef<THREE.Group>(null)
  const [res, setRes] = useState<BakeResult | null>(null)
  useLayoutEffect(() => {
    const g = root.current
    if (!enabled || !g) return
    const r = bakeGroup(g)
    setRes(r)
    return () => {
      r.restore()
      r.dispose()
      setRes((cur) => (cur === r ? null : cur))
    }
  }, [bakeKey, enabled])
  return (
    <group ref={root}>
      {children}
      {res && (
        <group userData={{ baked: true }}>
          {res.fills.map((m) => (
            <primitive key={m.uuid} object={m} />
          ))}
          {res.lines && <primitive object={res.lines} />}
          {res.hull && <InkHull key={res.hull.uuid} hull={res.hull} px={BAKED_INK_PX} />}
        </group>
      )}
    </group>
  )
}
