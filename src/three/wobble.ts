// Ink wobble: a vertex offset that makes outlines "boil" like hand-drawn
// animation (spec §2). One shared uniform store drives every patched material
// (toon fills, decals and drei outline hulls alike), so a single setWobble()
// call affects the whole scene. At wobble 0 nothing moves.
//
// Noise is sampled at each vertex's world position, as in the spec
// (noise(position*4 + time*0.5)), and applied as a screen-plane offset of
// constant pixel size. Depth is untouched, so layered faces never z-fight,
// and the boil looks the same at every zoom, like a pen line.

import { useFrame } from '@react-three/fiber'
import type { Material } from 'three'

/** Maximum offset at wobble = 1, in CSS pixels. */
export const WOBBLE_PX = 1.25
/** Noise frequency per board unit and time speed (spec §2: position*4 + time*0.5). */
export const WOBBLE_FREQ = 4
export const WOBBLE_SPEED = 0.5
/** Boil frame rate: time advances in steps like cel animation on twos. */
export const WOBBLE_FPS = 8

export const wobbleUniforms = {
  uInkWobble: { value: 0 },
  uInkTime: { value: 0 },
  /** 2 / viewport size in CSS px (NDC per CSS pixel) */
  uInkPx: { value: [2 / 1280, 2 / 800] as [number, number] },
}

let clock = 0

// Surface decals sit a hair above their face. The screen-plane wobble can
// shift the two layers' triangles differently by up to 2·WOBBLE_PX, so decal
// materials get a polygon offset that grows with the wobble (and is ~0 when
// still, so decals never cover small neighbouring geometry needlessly).
const decals = new Set<Material>()

function decalOffset(m: Material, w: number): void {
  m.polygonOffset = true
  m.polygonOffsetFactor = -(0.5 + 2.5 * w)
  m.polygonOffsetUnits = -2
}

/** Register a decal material so its polygon offset follows the wobble. */
export function registerDecal(m: Material): void {
  if (decals.has(m)) return
  decals.add(m)
  decalOffset(m, wobbleUniforms.uInkWobble.value)
  m.addEventListener('dispose', () => decals.delete(m))
}

/** Set the wobble amount, clamped to 0..1. */
export function setWobble(v: number): void {
  const w = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0))
  if (w === wobbleUniforms.uInkWobble.value) return
  wobbleUniforms.uInkWobble.value = w
  for (const m of decals) decalOffset(m, w)
}

export function getWobble(): number {
  return wobbleUniforms.uInkWobble.value
}

/** Advance wobble time by dt seconds (stepped at WOBBLE_FPS). */
export function tickWobble(dt: number): void {
  clock += dt
  wobbleUniforms.uInkTime.value = Math.floor(clock * WOBBLE_FPS) / WOBBLE_FPS
}

/** Tell the shaders the viewport size in CSS pixels. */
export function setWobbleViewport(width: number, height: number): void {
  const px = wobbleUniforms.uInkPx.value
  px[0] = 2 / Math.max(1, width)
  px[1] = 2 / Math.max(1, height)
}

const GLSL_HEADER = /* glsl */ `
uniform float uInkWobble;
uniform float uInkTime;
uniform vec2 uInkPx;
vec2 inkOffset;
float inkHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float inkNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(inkHash(i), inkHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(inkHash(i + vec3(0.0, 1.0, 0.0)), inkHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(inkHash(i + vec3(0.0, 0.0, 1.0)), inkHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(inkHash(i + vec3(0.0, 1.0, 1.0)), inkHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
`

const f = (n: number) => n.toFixed(4)

const GLSL_NOISE = /* glsl */ `
inkOffset = vec2(0.0);
if (uInkWobble > 0.0) {
  mat4 inkM = modelMatrix;
  #ifdef USE_INSTANCING
    inkM = modelMatrix * instanceMatrix;
  #endif
  vec3 inkW = (inkM * vec4(transformed, 1.0)).xyz;
  vec3 inkP = inkW * ${f(WOBBLE_FREQ)} + vec3(uInkTime * ${f(WOBBLE_SPEED)});
  vec2 inkD = vec2(inkNoise(inkP), inkNoise(inkP + 19.1)) - 0.5;
  inkOffset = inkD * (2.0 * uInkWobble * ${f(WOBBLE_PX)}) * uInkPx;
}
`

const GLSL_APPLY = 'gl_Position.xy += inkOffset * gl_Position.w;'

/**
 * Pure string patch: declares the wobble uniforms/noise after `#include <common>`,
 * samples the noise after `#include <begin_vertex>`, and offsets gl_Position
 * after `#include <project_vertex>` and after any explicit `gl_Position = …;`
 * (drei's outline shader sets it by hand). Idempotent.
 */
export function injectWobble(vertexShader: string): string {
  if (vertexShader.includes('uInkWobble')) return vertexShader
  if (!vertexShader.includes('#include <begin_vertex>')) return vertexShader
  let s = vertexShader.includes('#include <common>')
    ? vertexShader.replace('#include <common>', `#include <common>\n${GLSL_HEADER}`)
    : `${GLSL_HEADER}\n${vertexShader}`
  s = s.replace('#include <begin_vertex>', `#include <begin_vertex>\n${GLSL_NOISE}`)
  s = s.replace(/(gl_Position\s*=[^;]+;)/g, `$1 ${GLSL_APPLY}`)
  s = s.replace('#include <project_vertex>', `#include <project_vertex>\n${GLSL_APPLY}`)
  return s
}

/** Patch a material (toon, basic or drei's outline ShaderMaterial) to wobble. */
export function applyWobble<T extends Material>(material: T): T {
  if (material.userData.inkWobble) return material
  material.userData.inkWobble = true
  const prev = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer)
    shader.uniforms.uInkWobble = wobbleUniforms.uInkWobble
    shader.uniforms.uInkTime = wobbleUniforms.uInkTime
    shader.uniforms.uInkPx = wobbleUniforms.uInkPx
    shader.vertexShader = injectWobble(shader.vertexShader)
  }
  const prevKey = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => `${prevKey()}|ink-wobble`
  material.needsUpdate = true
  return material
}

/** Mount once inside a <Canvas>: advances wobble time and tracks the viewport. */
export function WobbleClock(): null {
  useFrame((state, dt) => {
    tickWobble(dt)
    setWobbleViewport(state.size.width, state.size.height)
  })
  return null
}
