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

export function inkMaterial(look: InkLook): THREE.Material {
  const glow = look.burnt ? 0 : Math.round(Math.min(1, Math.max(0, look.glow ?? 0)) * 20) / 20
  const opacity = look.opacity ?? 1
  const key = [
    look.color,
    glow,
    look.glowColor ?? '',
    opacity,
    look.burnt ? 1 : 0,
    look.unlit ? 1 : 0,
    look.map?.uuid ?? '',
    look.alphaTest ?? 0,
    look.side ?? THREE.FrontSide,
    look.depthWrite ?? '',
    look.decal ? 1 : 0,
  ].join('|')
  let m = cache.get(key)
  if (m) return m
  const color = look.burnt ? charColor(look.color) : look.color
  const transparent = opacity < 1
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
  cache.set(key, m)
  return m
}

export function materialCacheSize(): number {
  return cache.size
}
