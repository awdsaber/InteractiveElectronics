// Canvas-drawn textures: chip markings, silkscreen, screens, glow halos.
// No font files are fetched; text uses the page's IBM Plex Mono when loaded
// and redraws once web fonts finish loading.

import * as THREE from 'three'
import { useEffect, useMemo } from 'react'

export const MONO = "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace"
export const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif"

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(2, Math.round(w))
  c.height = Math.max(2, Math.round(h))
  return c
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

/** Redraw after web fonts load (fonts may not be ready at first paint). */
function afterFonts(redraw: () => void): void {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined
  if (fonts && fonts.status !== 'loaded') void fonts.ready.then(redraw)
}

export interface TextOpts {
  text: string
  /** canvas aspect = plane width / height */
  aspect: number
  color?: string
  bg?: string
  /** canvas height in px (resolution) */
  px?: number
  weight?: number
  font?: 'mono' | 'serif'
  align?: 'center' | 'left'
  /** fraction of height used by one line of text */
  fill?: number
  letterSpacing?: number
}

const textCache = new Map<string, THREE.CanvasTexture>()

export function drawText(ctx: CanvasRenderingContext2D, w: number, h: number, o: TextOpts): void {
  ctx.clearRect(0, 0, w, h)
  if (o.bg) {
    ctx.fillStyle = o.bg
    ctx.fillRect(0, 0, w, h)
  }
  const lines = o.text.split('\n')
  const family = o.font === 'serif' ? SERIF : MONO
  const lineH = h / lines.length
  let size = lineH * (o.fill ?? 0.72)
  ctx.fillStyle = o.color ?? '#f6f2e7'
  ctx.textBaseline = 'middle'
  ctx.textAlign = o.align === 'left' ? 'left' : 'center'
  const spacing = o.letterSpacing ?? 0.04
  const setFont = () => {
    ctx.font = `${o.weight ?? 600} ${size}px ${family}`
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${size * spacing}px`
  }
  setFont()
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
  if (widest > w * 0.94) {
    size *= (w * 0.94) / widest
    setFont()
  }
  lines.forEach((l, i) => {
    const x = o.align === 'left' ? w * 0.03 : w / 2
    ctx.fillText(l, x, lineH * (i + 0.5))
  })
}

/** Cached text texture (shared by every mesh with the same options). */
export function textTexture(o: TextOpts): THREE.CanvasTexture {
  const key = JSON.stringify(o)
  let t = textCache.get(key)
  if (t) return t
  const h = o.px ?? 64
  const w = Math.min(2048, h * o.aspect)
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  const tex = toTexture(canvas)
  const draw = () => {
    if (!ctx) return
    drawText(ctx, canvas.width, canvas.height, o)
    tex.needsUpdate = true
  }
  draw()
  afterFonts(draw)
  t = tex
  textCache.set(key, t)
  return t
}

let glow: THREE.CanvasTexture | null = null

/** Soft radial white → transparent disc (tinted by material colour). */
export function glowTexture(): THREE.CanvasTexture {
  if (glow) return glow
  const s = 128
  const canvas = makeCanvas(s, s)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.65)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.18)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  }
  glow = toTexture(canvas)
  return glow
}

const drawnCache = new Map<string, THREE.CanvasTexture>()

/**
 * Cached texture from a custom draw function, keyed by `key`
 * (for static artwork such as breadboard faces and speaker grilles).
 */
export function drawnTexture(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  let t = drawnCache.get(key)
  if (t) return t
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  const tex = toTexture(canvas)
  const redraw = () => {
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    draw(ctx, canvas.width, canvas.height)
    tex.needsUpdate = true
  }
  redraw()
  afterFonts(redraw)
  t = tex
  drawnCache.set(key, t)
  return t
}

/**
 * Per-instance canvas texture redrawn when `deps` change (live screens,
 * PCB artwork). Disposed on unmount.
 */
export function useCanvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  deps: readonly unknown[],
): THREE.CanvasTexture {
  const tex = useMemo(() => {
    const t = toTexture(makeCanvas(w, h))
    // owned and disposed here: materials using it must not be cached
    t.userData.perInstance = true
    return t
  }, [w, h])
  useMemo(() => {
    const canvas = tex.image as HTMLCanvasElement
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const redraw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      draw(ctx, canvas.width, canvas.height)
      tex.needsUpdate = true
    }
    redraw()
    afterFonts(redraw)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tex, ...deps])
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

/**
 * Map a texture onto the caps of an extruded w × d shape centred on the
 * origin (ExtrudeGeometry cap UVs are raw shape coordinates).
 */
export function fitCapTexture(tex: THREE.Texture, w: number, d: number): void {
  if (tex.repeat.x === 1 / w && tex.repeat.y === 1 / d) return
  tex.repeat.set(1 / w, 1 / d)
  tex.offset.set(0.5, 0.5)
  tex.needsUpdate = true
}
