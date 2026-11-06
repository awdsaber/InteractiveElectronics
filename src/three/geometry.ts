// Module-level geometry cache. Every part shares unit primitives scaled per
// mesh, plus a handful of keyed custom shapes, so a 60-part board allocates
// a few dozen geometries rather than thousands.

import * as THREE from 'three'
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const cache = new Map<string, THREE.BufferGeometry>()

/** Get or build a geometry by key. Factories must be deterministic per key. */
export function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key)
  if (!g) {
    g = make()
    g.computeBoundingSphere()
    g.computeBoundingBox()
    cache.set(key, g)
  }
  return g
}

export function geometryCacheSize(): number {
  return cache.size
}

const hulls = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>()

/**
 * Outline hull geometry: same positions, normals averaged across creases so the
 * inverted hull stays closed at box corners. Cached per source geometry.
 */
export function outlineGeometry(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let h = hulls.get(g)
  if (!h) {
    h = toCreasedNormals(g, Math.PI)
    h.computeBoundingSphere()
    hulls.set(g, h)
  }
  return h
}

const edgeCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>()

/** Hard-edge line geometry for thin plates (cached per source geometry). */
export function edgesGeometry(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let e = edgeCache.get(g)
  if (!e) {
    e = new THREE.EdgesGeometry(g, 30)
    edgeCache.set(g, e)
  }
  return e
}

/**
 * Release the hull (and edge lines) derived from `g`. Call it wherever a
 * non-cached geometry is disposed, e.g. per-instance cables.
 */
export function disposeOutline(g: THREE.BufferGeometry): void {
  hulls.get(g)?.dispose()
  hulls.delete(g)
  edgeCache.get(g)?.dispose()
  edgeCache.delete(g)
}

/** Unit primitives (size 1, centred). Scale them per mesh. */
export const G = {
  box: () => geo('box', () => new THREE.BoxGeometry(1, 1, 1)),
  /** radius 1, height 1, axis Y */
  cyl: (seg = 16) => geo(`cyl:${seg}`, () => new THREE.CylinderGeometry(1, 1, 1, seg)),
  /** radius 1 bottom → `top` top radius, height 1, axis Y */
  cone: (top = 0, seg = 12) => geo(`cone:${top}:${seg}`, () => new THREE.CylinderGeometry(top, 1, 1, seg)),
  sphere: (w = 14, h = 10) => geo(`sphere:${w}:${h}`, () => new THREE.SphereGeometry(1, w, h)),
  /** upper hemisphere radius 1 */
  dome: (w = 16, h = 6) =>
    geo(`dome:${w}:${h}`, () => new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI / 2)),
  /** torus of radius 1 around Y axis, tube = ratio */
  ring: (tube = 0.1, seg = 20) =>
    geo(`ring:${tube}:${seg}`, () => new THREE.TorusGeometry(1, tube, 6, seg).rotateX(Math.PI / 2)),
  /** unit plane facing +Y */
  planeY: () => geo('planeY', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
  /** unit plane facing +Z */
  planeZ: () => geo('planeZ', () => new THREE.PlaneGeometry(1, 1)),
  /** unit disc facing +Y */
  discY: (seg = 20) => geo(`discY:${seg}`, () => new THREE.CircleGeometry(1, seg).rotateX(-Math.PI / 2)),
  /** unit disc facing +Z */
  discZ: (seg = 20) => geo(`discZ:${seg}`, () => new THREE.CircleGeometry(1, seg)),
  /** half disc facing +Y, bulging toward +X */
  halfDiscY: () =>
    geo('halfDiscY', () => new THREE.CircleGeometry(1, 10, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2)),
  roundedBox: (w: number, h: number, d: number, r: number) =>
    geo(`rbox:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 2, r)),
}

// ───────────── 2D shapes and extrusions ─────────────

export function stadiumShape(len: number, wid: number): THREE.Shape {
  const r = wid / 2
  const hx = len / 2 - r
  const s = new THREE.Shape()
  s.moveTo(-hx, -r)
  s.lineTo(hx, -r)
  s.absarc(hx, 0, r, -Math.PI / 2, Math.PI / 2, false)
  s.lineTo(-hx, r)
  s.absarc(-hx, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false)
  return s
}

export function roundedRectShape(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -d / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + d - r)
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d)
  s.lineTo(x + r, y + d)
  s.quadraticCurveTo(x, y + d, x, y + d - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

export function chamferRectShape(w: number, d: number, c: number): THREE.Shape {
  const s = new THREE.Shape()
  const hx = w / 2
  const hy = d / 2
  s.moveTo(-hx + c, -hy)
  s.lineTo(hx - c, -hy)
  s.lineTo(hx, -hy + c)
  s.lineTo(hx, hy - c)
  s.lineTo(hx - c, hy)
  s.lineTo(-hx + c, hy)
  s.lineTo(-hx, hy - c)
  s.lineTo(-hx, -hy + c)
  s.lineTo(-hx + c, -hy)
  return s
}

/** Circle of radius r with flats at ±flat (top/bottom of the shape's Y). */
export function flattedCircleShape(r: number, flat: number): THREE.Shape {
  const a = Math.asin(flat / r)
  const s = new THREE.Shape()
  s.absarc(0, 0, r, -a, a, false)
  s.lineTo(-Math.cos(a) * r, flat)
  s.absarc(0, 0, r, Math.PI - a, Math.PI + a, false)
  s.lineTo(Math.cos(a) * r, -flat)
  return s
}

/**
 * Extrude a shape upward from y = 0 to y = height. Shape x → world x and
 * shape y → world -z (so draw "toward the viewer" features at negative y).
 */
export function extrudeUp(shape: THREE.Shape, height: number, curveSegments = 12): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments })
  g.rotateX(-Math.PI / 2)
  return g
}

/**
 * Extrude a shape drawn in the ZY plane (shape x → z, shape y → y) along X,
 * centred on x = 0 with total length `len`.
 */
export function extrudeAlongX(shape: THREE.Shape, len: number, curveSegments = 14): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments })
  g.translate(0, 0, -len / 2)
  // +Z extrusion → +X; shape x → -z
  g.rotateY(Math.PI / 2)
  return g
}

/** Extrude a shape drawn in the XY plane along +Z by depth, centred on z = 0. */
export function extrudeAlongZ(shape: THREE.Shape, depth: number, curveSegments = 14): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments })
  g.translate(0, 0, -depth / 2)
  return g
}

/** Boxes merged into one geometry: [cx, cy, cz, w, h, d, rotX?] */
export function mergedBoxes(boxes: readonly (readonly number[])[]): THREE.BufferGeometry {
  const parts = boxes.map(([cx, cy, cz, w, h, d, rx = 0]) => {
    const b = new THREE.BoxGeometry(w, h, d)
    if (rx) b.rotateX(rx)
    b.translate(cx, cy, cz)
    return b
  })
  const g = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  if (!g) throw new Error('mergedBoxes failed')
  return g
}

/** Lathe a profile of [radius, y] points around Y. */
export function lathe(points: readonly (readonly [number, number])[], segments = 16): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  )
}
