// Shared toon materials. One material per distinct look (colour, glow step,
// opacity, burnt, map), cached at module level and patched for wobble.

import * as THREE from 'three'
import { applyWobble, registerDecal } from './wobble'

/**
 * Light setup the gradient is tuned for (see `InkLights`): ambient ≈ 0.42π and
 * a key light ≈ 0.6π from upper-left-front. The gradient puts the three
 * visible iso faces on three distinct steps: top lit, +Z mid, +X shade.
 */
const GRADIENT_STEPS = 20
let gradient: THREE.DataTexture | null = null

export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient
  const data = new Uint8Array(GRADIENT_STEPS)
  for (let i = 0; i < GRADIENT_STEPS; i++) {
    const t = (i + 0.5) / GRADIENT_STEPS
    data[i] = t < 0.55 ? 110 : t < 0.8 ? 190 : 255
  }
  gradient = new THREE.DataTexture(data, GRADIENT_STEPS, 1, THREE.RedFormat)
  gradient.minFilter = THREE.NearestFilter
  gradient.magFilter = THREE.NearestFilter
  gradient.generateMipmaps = false
  gradient.needsUpdate = true
  return gradient
}

/** Charred-part tint: mixes toward warm soot. */
export const CHAR = '#2b2420'

export interface InkLook {
  color: string
  /** 0..1 emissive glow (quantised to 1/20 for caching) */
  glow?: number
  glowColor?: string
  opacity?: number
  burnt?: boolean
  /** MeshBasicMaterial: ignores lights (screens, holes, decals) */
  unlit?: boolean
  map?: THREE.Texture | null
  alphaTest?: number
  side?: THREE.Side
  depthWrite?: boolean
  /** pulled toward the camera with polygon offset (surface decals; survives wobble) */
  decal?: boolean
}

const cache = new Map<string, THREE.Material>()
const tmp = new THREE.Color()

export function charColor(color: string): string {
  return '#' + tmp.set(color).lerp(new THREE.Color(CHAR), 0.78).getHexString()
}

function lookKey(look: InkLook): string {
  const glow = quantGlow(look)
  return [
    look.color,
    glow,
    look.glowColor ?? '',
    look.opacity ?? 1,
    look.burnt ? 1 : 0,
    look.unlit ? 1 : 0,
    look.map?.uuid ?? '',
    look.alphaTest ?? 0,
    look.side ?? THREE.FrontSide,
    look.depthWrite ?? '',
    look.decal ? 1 : 0,
  ].join('|')
}

function quantGlow(look: InkLook): number {
  return look.burnt ? 0 : Math.round(Math.min(1, Math.max(0, look.glow ?? 0)) * 20) / 20
}

/**
 * A texture is "per-instance" when its owner disposes it (live screens, PCB
 * artwork). Materials using one bypass the shared cache so nothing keeps the
 * disposed texture alive; the caller owns and disposes the material.
 */
export function isPerInstance(map: THREE.Texture | null | undefined): boolean {
  return !!map && map.userData.perInstance === true
}

/** Build a fresh (uncached) ink material. Caller disposes it. */
export function createInkMaterial(look: InkLook): THREE.Material {
  const glow = quantGlow(look)
  const opacity = look.opacity ?? 1
  const color = look.burnt ? charColor(look.color) : look.color
  const transparent = opacity < 1
  let m: THREE.Material
  if (look.unlit) {
    m = new THREE.MeshBasicMaterial({
      color,
      map: look.map ?? null,
      transparent: transparent || !!look.map,
      opacity,
      alphaTest: look.alphaTest ?? 0,
      side: look.side ?? THREE.FrontSide,
      depthWrite: look.depthWrite ?? !transparent,
    })
  } else {
    m = new THREE.MeshToonMaterial({
      color,
      gradientMap: toonGradient(),
      map: look.map ?? null,
      emissive: glow > 0 ? (look.glowColor ?? look.color) : '#000000',
      emissiveIntensity: glow * 1.4,
      transparent,
      opacity,
      alphaTest: look.alphaTest ?? 0,
      side: look.side ?? THREE.FrontSide,
      depthWrite: look.depthWrite ?? true,
    })
  }
  if (look.decal) registerDecal(m)
  applyWobble(m)
  return m
}

/** Shared, cached material for a look. Not for per-instance textures. */
export function inkMaterial(look: InkLook): THREE.Material {
  const key = lookKey(look)
  let m = cache.get(key)
  if (m) return m
  m = createInkMaterial(look)
  cache.set(key, m)
  return m
}

/** Material for a look: cached, or (per-instance map) a fresh one the caller must dispose. */
export function lookKeyOf(look: InkLook): string {
  return lookKey(look)
}

export function materialCacheSize(): number {
  return cache.size
}

const baked = new Map<string, THREE.Material>()

/** Shared vertex-coloured material for merged (baked) part geometry. */
export function bakedMaterial(unlit: boolean, decal: boolean, side: THREE.Side): THREE.Material {
  const key = `${unlit ? 1 : 0}|${decal ? 1 : 0}|${side}`
  let m = baked.get(key)
  if (m) return m
  m = unlit
    ? new THREE.MeshBasicMaterial({ vertexColors: true, side })
    : new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), side })
  if (decal) registerDecal(m)
  applyWobble(m)
  baked.set(key, m)
  return m
}
