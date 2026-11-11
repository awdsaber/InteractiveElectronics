// Board-level parts: breadboard, generic / Uno-style / Nano-style module
// boards, Wi-Fi module, OLED, ultrasonic sensor, load cell.

import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import type { PartKind, PartPlacement } from '../../engine/types'
import { G, extrudeAlongZ, extrudeUp, geo, roundedRectShape } from '../geometry'
import { InkInstances, InkMesh, type InkInstance } from '../ink'
import { C } from '../palette'
import { MONO, drawnTexture, fitCapTexture, useCanvasTexture } from '../textures'
import { Block, CylZ, Decal, Leg, Marking, Tube, type Vec3 } from './common'
import { BarrelJack, HeaderFemale, HeaderMale, MicroUsb, UsbB } from './connectors'
import { Button } from './controls'
import { moduleRowZ, modulePins, moduleSize } from './footprints'
import { CapacitorSmd, Crystal, Electrolytic, ResistorSmd } from './passives'
import { Dip, LedSmd, SmdIc } from './semis'
import { PITCH, num, str, type PartProps, type PartRenderState } from './types'

// ───────────── helpers ─────────────

/** Fake placement for composing a sub-part body inside a board. */
function sub(kind: PartKind, params: Record<string, unknown> = {}, color?: string): PartPlacement {
  return { id: `sub-${kind}`, kind, pos: [0, 0], mount: 'smd', role: '', params, color }
}

function At({ p, rot = 0, children }: { p: Vec3; rot?: number; children: ReactNode }) {
  return (
    <group position={p} rotation={[0, (rot * Math.PI) / 180, 0]}>
      {children}
    </group>
  )
}

const OFF: PartRenderState = { visible: true, soldered: false, glow: 0, burnt: false, explodedOffset: 0, showLabel: false }

function boardGeo(w: number, d: number, t: number, r = 0.08) {
  return geo(`board:${w}:${d}:${t}:${r}`, () => extrudeUp(roundedRectShape(w, d, r), t, 4))
}

interface Art {
  /** board colour */
  color: string
  w: number
  d: number
  draw?: (ctx: CanvasRenderingContext2D, u: (x: number) => number, v: (z: number) => number, s: number) => void
}

/** Cached top-face artwork: mask colour, mounting holes, silk via `draw`. */
function boardArt(key: string, a: Art): THREE.CanvasTexture {
  const ppu = Math.min(160, 2048 / Math.max(a.w, a.d))
  return drawnTexture(`art:${key}:${a.color}`, a.w * ppu, a.d * ppu, (ctx, W, H) => {
    const s = W / a.w
    const u = (x: number) => (x + a.w / 2) * s
    const v = (z: number) => (z + a.d / 2) * s
    ctx.fillStyle = a.color
    ctx.fillRect(0, 0, W, H)
    a.draw?.(ctx, u, v, s)
  })
}

function silkText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, align: CanvasTextAlign = 'center', rot = 0) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.fillStyle = C.silk
  ctx.font = `600 ${px}px ${MONO}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

function padRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = C.gold
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#2a2622'
  ctx.beginPath()
  ctx.arc(x, y, r * 0.5, 0, Math.PI * 2)
  ctx.fill()
}

function BoardSlab({ w, d, t = 0.16, y = 0, art }: { w: number; d: number; t?: number; y?: number; art: THREE.Texture }) {
  fitCapTexture(art, w, d)
  return <InkMesh geometry={boardGeo(w, d, t)} position={[0, y, 0]} color="#cdbf8f" capMap={art} />
}


/** Header pins (and plastic spacers under a raised board) for two rows at ±rowZ. */
function useHeaderPins(n: number, rowZ: number, top: number, standoff: number) {
  return useMemo(() => {
    const pins: InkInstance[] = []
    const spacers: InkInstance[] = []
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * PITCH
      for (const z of [rowZ, -rowZ]) {
        pins.push({ p: [x, (top + 0.04 - 0.3) / 2, z], s: [0.064, top + 0.04 + 0.3, 0.064] })
        if (standoff > 0) spacers.push({ p: [x, standoff / 2, z], s: [0.248, standoff, 0.248] })
      }
    }
    return { pins, spacers }
  }, [n, rowZ, top, standoff])
}

// ───────────── breadboard ─────────────

export const BREADBOARD = { w: 8.25, d: 5.5, h: 0.85, cols: 30 }

const ROWS = 'abcdefghij'

/**
 * Local [x, y, z] of a breadboard hole (top surface). `col` 1..30; `row`
 * 'a'..'j' (a farthest from the viewer), or a rail: '+t' / '-t' (top pair),
 * '-b' / '+b' (bottom pair).
 */
export function breadboardHole(col: number, row: string): [number, number, number] {
  const x = (col - 15.5) * PITCH
  const rails: Record<string, number> = { '+t': -2.286, '-t': -2.032, '-b': 2.032, '+b': 2.286 }
  if (row in rails) return [x, BREADBOARD.h, rails[row]]
  const i = ROWS.indexOf(row.toLowerCase())
  if (i < 0) throw new RangeError(`no breadboard row ${row}`)
  const z = i < 5 ? -0.381 - (4 - i) * PITCH : 0.381 + (i - 5) * PITCH
  return [x, BREADBOARD.h, z]
}

function breadboardArt(): THREE.CanvasTexture {
  const { w, d } = BREADBOARD
  const ppu = 120
  return drawnTexture('breadboard-half', w * ppu, d * ppu, (ctx, W) => {
    const s = W / w
    const u = (x: number) => (x + w / 2) * s
    const v = (z: number) => (z + d / 2) * s
    ctx.fillStyle = '#f1eee4'
    ctx.fillRect(0, 0, W, d * s)
    // centre channel
    ctx.fillStyle = '#d9d3c3'
    ctx.fillRect(0, v(-0.14), W, 0.28 * s)
    ctx.fillStyle = '#c4bdab'
    ctx.fillRect(0, v(-0.14), W, 0.04 * s)
    // rail stripes
    const stripe = (z: number, c: string) => {
      ctx.fillStyle = c
      ctx.fillRect(u(-3.75), v(z) - 0.02 * s, 7.5 * s, 0.04 * s)
    }
    stripe(-2.52, '#d0443a')
    stripe(-1.8, '#3d6fc0')
    stripe(1.8, '#3d6fc0')
    stripe(2.52, '#d0443a')
    const hole = (x: number, z: number) => {
      const hs = 0.1 * s
      ctx.fillStyle = '#d8d2c2'
      ctx.fillRect(u(x) - hs * 0.7, v(z) - hs * 0.7, hs * 1.4, hs * 1.4)
      ctx.fillStyle = '#3a3631'
      ctx.fillRect(u(x) - hs / 2, v(z) - hs / 2, hs, hs)
    }
    for (let c = 1; c <= 30; c++) {
      for (const r of ROWS) {
        const [x, , z] = breadboardHole(c, r)
        hole(x, z)
      }
      if ((c - 1) % 6 !== 5) for (const r of ['+t', '-t', '-b', '+b']) {
        const [x, , z] = breadboardHole(c, r)
        hole(x, z)
      }
    }
    ctx.fillStyle = '#8b8577'
    ctx.font = `600 ${0.15 * s}px ${MONO}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let c = 1; c <= 30; c++) {
      if (c === 1 || c % 5 === 0) {
        const [x] = breadboardHole(c, 'a')
        ctx.fillText(String(c), u(x), v(-1.62))
        ctx.fillText(String(c), u(x), v(1.62))
      }
    }
    for (const r of ROWS) {
      const [, , z] = breadboardHole(1, r)
      ctx.fillText(r, u(-3.9), v(z))
      ctx.fillText(r, u(3.9), v(z))
    }
    ctx.fillStyle = '#d0443a'
    ctx.font = `700 ${0.22 * s}px ${MONO}`
    ctx.fillText('+', u(-3.95), v(-2.286))
    ctx.fillText('+', u(-3.95), v(2.286))
    ctx.fillStyle = '#3d6fc0'
    ctx.fillText('−', u(-3.95), v(-2.032))
    ctx.fillText('−', u(-3.95), v(2.032))
  })
}

function BreadboardBody({ part }: PartProps) {
  const { w, d, h } = BREADBOARD
  return (
    <group>
      <InkMesh geometry={G.roundedBox(w, h, d, 0.06)} position={[0, h / 2, 0]} color={part.color ?? '#efebe0'} />
      <Decal p={[0, h + 0.001, 0]} size={[w - 0.04, d - 0.04]} map={breadboardArt()} />
    </group>
  )
}

// ───────────── module boards ─────────────

function GenericModule({ part, state }: PartProps) {
  const { w, d } = moduleSize(part)
  const n = modulePins(part)
  const rowZ = moduleRowZ(part)
  const color = part.color ?? str(part, 'color', '#2b59c3')
  const title = str(part, 'title', 'MODULE')
  const standoff = num(part, 'standoff', n > 0 ? 0.25 : 0)
  const t = 0.16
  const top = standoff + t
  const art = boardArt(`mod:${w}:${d}:${n}:${title}`, {
    color,
    w,
    d,
    draw: (ctx, u, v, s) => {
      for (const [x, z] of [
        [-w / 2 + 0.22, -d / 2 + 0.22],
        [w / 2 - 0.22, -d / 2 + 0.22],
        [-w / 2 + 0.22, d / 2 - 0.22],
        [w / 2 - 0.22, d / 2 - 0.22],
      ]) {
        if (n > 0 && Math.abs(Math.abs(z) - rowZ) < 0.15) continue
        padRing(ctx, u(x), v(z), 0.12 * s)
      }
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * PITCH
        padRing(ctx, u(x), v(rowZ), 0.075 * s)
        padRing(ctx, u(x), v(-rowZ), 0.075 * s)
      }
      ctx.strokeStyle = C.silk
      ctx.lineWidth = 0.02 * s
      ctx.strokeRect(u(-w / 2 + 0.08), v(-d / 2 + 0.08), (w - 0.16) * s, (d - 0.16) * s)
      silkText(ctx, title, u(0), v(n > 0 ? -rowZ + 0.32 : -d / 2 + 0.3), 0.2 * s)
    },
  })
  const chip = str(part, 'chip', 'soic')
  const { pins, spacers } = useHeaderPins(n, rowZ, top, standoff)
  return (
    <group>
      {pins.length > 0 && <InkInstances geometry={G.box()} items={pins} color={C.gold} outline={1} />}
      {spacers.length > 0 && <InkInstances geometry={G.box()} items={spacers} color={C.black} />}
      <BoardSlab w={w} d={d} y={standoff} art={art} />
      {chip !== 'none' && (
        <At p={[0, top, 0.05]}>
          <SmdIc
            part={sub('ic-smd', { package: chip === 'tqfp' ? 'TQFP' : chip === 'qfn' ? 'QFN' : 'SOIC', pins: chip === 'soic' ? 8 : 32, marking: str(part, 'chipLabel', '') || undefined })}
            state={OFF}
          />
        </At>
      )}
      <At p={[w / 2 - 0.45, top, -d / 2 + 0.45 + (n > 0 ? 0.2 : 0)]}>
        <LedSmd part={sub('led-smd', { color: 'red', size: '0603' })} state={{ ...OFF, glow: state.glow }} />
      </At>
      <At p={[-0.55, top, 0.1]} rot={90}>
        <CapacitorSmd part={sub('capacitor-smd', { size: '0603' })} state={OFF} />
      </At>
      <At p={[0.6, top, 0.1]} rot={90}>
        <ResistorSmd part={sub('resistor-smd', { size: '0603', ohms: 10_000 })} state={OFF} />
      </At>
    </group>
  )
}

function UnoModule({ part, state }: PartProps) {
  const w = 6.86
  const d = 5.33
  const t = 0.16
  const color = part.color ?? str(part, 'color', '#24508f')
  const title = str(part, 'title', 'ATELIER UNO')
  const art = boardArt(`uno:${title}`, {
    color,
    w,
    d,
    draw: (ctx, u, v, s) => {
      for (const [x, z] of [
        [-1.95, -2.4],
        [3.15, -2.0],
        [3.15, 1.3],
        [-2.0, 2.4],
      ])
        padRing(ctx, u(x), v(z), 0.16 * s)
      ctx.strokeStyle = 'rgba(246,242,231,0.9)'
      ctx.lineWidth = 0.018 * s
      ctx.strokeRect(u(-0.95), v(-2.08), 4.25 * s, 0.001)
      silkText(ctx, 'DIGITAL (PWM ~)', u(1.1), v(-1.92), 0.15 * s)
      silkText(ctx, 'POWER', u(-0.35), v(1.98), 0.14 * s)
      silkText(ctx, 'ANALOG IN', u(1.95), v(1.98), 0.14 * s)
      for (let i = 0; i < 14; i++) {
        const x = i < 8 ? 2.35 + (3.5 - i) * PITCH : -0.25 + (4.5 - (i - 8)) * PITCH
        silkText(ctx, String(i), u(x), v(-2.15), 0.09 * s)
      }
      for (let i = 0; i < 6; i++) silkText(ctx, `A${i}`, u(1.95 + (i - 2.5) * PITCH), v(2.15), 0.08 * s)
      ;['IOREF', 'RST', '3V3', '5V', 'GND', 'GND', 'VIN'].forEach((l, i) =>
        silkText(ctx, l, u(-0.35 + (i - 3) * PITCH), v(2.15), 0.06 * s),
      )
      silkText(ctx, title, u(0.4), v(-0.45), 0.32 * s)
      silkText(ctx, 'ON', u(2.45), v(-0.75), 0.1 * s)
      silkText(ctx, 'L', u(-0.15), v(-1.45), 0.1 * s)
      silkText(ctx, 'TX', u(0.35), v(-1.7), 0.08 * s)
      silkText(ctx, 'RX', u(0.35), v(-1.45), 0.08 * s)
      silkText(ctx, 'RESET', u(-2.4), v(-2.15), 0.1 * s)
      silkText(ctx, 'ICSP', u(2.8), v(0.3), 0.09 * s, 'center', -Math.PI / 2)
      // a few decorative traces
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'
      ctx.lineWidth = 0.05 * s
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const pts of [
        [[-2.4, -1.4], [-1.9, -1.4], [-1.6, -1.1], [-0.8, -1.1]],
        [[-2.4, -1.2], [-2.0, -1.2], [-1.6, -0.8], [0.1, -0.8], [0.4, 0.9]],
        [[-1.3, 1.1], [-0.4, 1.1], [0, 0.7], [0.6, 0.7]],
        [[1.0, -2.3], [1.0, -1.5], [1.4, -1.1], [1.4, 0.55]],
        [[2.0, -2.3], [2.0, -1.4], [2.6, -0.8], [2.6, 0.55]],
      ]) {
        ctx.beginPath()
        pts.forEach(([x, z], i) => (i ? ctx.lineTo(u(x), v(z)) : ctx.moveTo(u(x), v(z))))
        ctx.stroke()
      }
    },
  })
  const top = t
  const powered = state.glow > 0.01
  return (
    // the connector edge (modelled at −X) faces the viewer (+Z) at rot 0
    <group rotation={[0, Math.PI / 2, 0]}>
      <BoardSlab w={w} d={d} art={art} />
      <At p={[-3.25, top, -1.35]} rot={-90}>
        <UsbB part={sub('usb-b')} state={OFF} />
      </At>
      <At p={[-2.93, top, 1.75]} rot={-90}>
        <BarrelJack part={sub('barrel-jack')} state={OFF} />
      </At>
      <At p={[-0.25, top, -2.4]}>
        <HeaderFemale part={sub('header-female', { pins: 10 })} state={OFF} />
      </At>
      <At p={[2.35, top, -2.4]}>
        <HeaderFemale part={sub('header-female', { pins: 8 })} state={OFF} />
      </At>
      <At p={[-0.35, top, 2.4]}>
        <HeaderFemale part={sub('header-female', { pins: 8 })} state={OFF} />
      </At>
      <At p={[1.95, top, 2.4]}>
        <HeaderFemale part={sub('header-female', { pins: 6 })} state={OFF} />
      </At>
      <At p={[1.55, top, 1.05]}>
        <Dip part={sub('ic-dip', { pins: 28, marking: str(part, 'mcu', 'ATMEGA328P') })} state={OFF} />
      </At>
      <At p={[-0.45, top, 0.5]} rot={90}>
        <Crystal part={sub('crystal', { mhz: 16 })} state={OFF} />
      </At>
      <At p={[-1.25, top, -1.0]} rot={45}>
        <SmdIc part={sub('ic-smd', { package: 'QFN', pins: 32, marking: '16U2' })} state={OFF} />
      </At>
      <At p={[-2.4, top, -2.4]}>
        <Button part={sub('button', {}, '#c8322b')} state={OFF} />
      </At>
      <At p={[2.95, top, 0.3]} rot={90}>
        <HeaderMale part={sub('header-male', { pins: 3, rows: 2, pinLength: 0.55 })} state={OFF} />
      </At>
      <At p={[-1.7, top, 1.25]}>
        <Electrolytic part={sub('capacitor-electrolytic', { d: 0.63, h: 0.75 })} state={OFF} />
      </At>
      <At p={[-0.95, top, 1.25]}>
        <Electrolytic part={sub('capacitor-electrolytic', { d: 0.63, h: 0.75 })} state={OFF} />
      </At>
      {/* SOT-223-style regulator */}
      <Block p={[-1.4, top, 2.25]} s={[0.65, 0.16, 0.35]} color={C.epoxy} outline={1.2} />
      <Block p={[-1.4, top, 1.98]} s={[0.3, 0.02, 0.2]} color={C.tin} outline={1} />
      <At p={[2.45, top, -0.55]}>
        <LedSmd part={sub('led-smd', { color: 'green', size: '0805' })} state={{ ...OFF, glow: powered ? 1 : 0 }} />
      </At>
      <At p={[-0.15, top, -1.25]}>
        <LedSmd part={sub('led-smd', { color: 'yellow', size: '0805' })} state={{ ...OFF, glow: num(part, 'led13', 0) }} />
      </At>
      <At p={[0.1, top, -1.7]}>
        <LedSmd part={sub('led-smd', { color: 'yellow', size: '0805' })} state={OFF} />
      </At>
      <At p={[0.1, top, -1.45]}>
        <LedSmd part={sub('led-smd', { color: 'yellow', size: '0805' })} state={OFF} />
      </At>
      {[
        [0.4, -0.55],
        [0.4, -0.3],
        [-2.0, -0.4],
        [-2.0, -0.15],
        [2.0, -0.5],
      ].map(([x, z], i) => (
        <At key={i} p={[x, top, z]}>
          {i % 2 ? (
            <ResistorSmd part={sub('resistor-smd', { size: '0603', ohms: 1000 })} state={OFF} />
          ) : (
            <CapacitorSmd part={sub('capacitor-smd', { size: '0603' })} state={OFF} />
          )}
        </At>
      ))}
    </group>
  )
}

function NanoModule({ part, state }: PartProps) {
  const w = 4.32
  const d = 1.78
  const t = 0.16
  const standoff = num(part, 'standoff', 0.25)
  const color = part.color ?? str(part, 'color', '#2a5a9f')
  const title = str(part, 'title', 'NANO-STYLE')
  const art = boardArt(`nano:${title}`, {
    color,
    w,
    d,
    draw: (ctx, u, v, s) => {
      for (let i = 0; i < 15; i++) {
        const x = (i - 7) * PITCH
        padRing(ctx, u(x), v(0.762), 0.075 * s)
        padRing(ctx, u(x), v(-0.762), 0.075 * s)
      }
      silkText(ctx, title, u(0.9), v(0.45), 0.13 * s)
      ;['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND', 'RST', 'RX0', 'TX1'].forEach((l, i) =>
        silkText(ctx, l, u((7 - i) * PITCH), v(-0.6), 0.055 * s),
      )
      ;['D13', '3V3', 'REF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'RST', 'GND', 'VIN'].forEach((l, i) =>
        silkText(ctx, l, u((7 - i) * PITCH), v(0.6), 0.055 * s),
      )
    },
  })
  const top = standoff + t
  const { pins, spacers } = useHeaderPins(15, 0.762, top, standoff)
  return (
    <group>
      <InkInstances geometry={G.box()} items={pins} color={C.gold} outline={1} />
      <InkInstances geometry={G.box()} items={spacers} color={C.black} />
      <BoardSlab w={w} d={d} y={standoff} art={art} />
      <At p={[w / 2 - 0.2, top, 0]} rot={90}>
        <MicroUsb part={sub('micro-usb')} state={OFF} />
      </At>
      <At p={[0.2, top, 0]} rot={45}>
        <SmdIc part={sub('ic-smd', { package: 'TQFP', pins: 32, marking: 'MEGA328P' })} state={OFF} />
      </At>
      <At p={[1.35, top, -0.1]}>
        <Button part={sub('button', {}, C.white)} state={OFF} />
      </At>
      <Block p={[-0.9, top, -0.3]} s={[0.32, 0.1, 0.13]} color={C.tin} outline={1.2} />
      <At p={[-0.95, top, 0.3]}>
        <LedSmd part={sub('led-smd', { color: 'blue', size: '0603' })} state={{ ...OFF, glow: state.glow }} />
      </At>
      <At p={[-0.7, top, 0.3]}>
        <LedSmd part={sub('led-smd', { color: 'yellow', size: '0603' })} state={{ ...OFF, glow: num(part, 'led13', 0) }} />
      </At>
    </group>
  )
}

/** Teensy 4.1 silk, pin order along each row from the USB end (PJRC pinout card) */
const TEENSY41_BACK = ['VIN', 'GND', '3.3V', '23', '22', '21', '20', '19', '18', '17', '16', '15', '14', '13', 'GND', '41', '40', '39', '38', '37', '36', '35', '34', '33']
const TEENSY41_FRONT = ['GND', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '3.3V', '24', '25', '26', '27', '28', '29', '30', '31', '32']

/**
 * Teensy 4.1 carrier (61 × 18 mm): the bare PCB with its two 24-pad rows 0.6" apart, pin labels and
 * outline. USB end at −x, the VIN row at −z. The lesson places the chips, connectors and headers as
 * their own parts so each one can be inspected.
 */
function Teensy41Module({ part }: PartProps) {
  const { w, d } = moduleSize(part)
  const rowZ = 0.762
  const color = part.color ?? str(part, 'color', '#2d6a43')
  const standoff = num(part, 'standoff', 0)
  const art = boardArt(`teensy41:${w}:${d}`, {
    color,
    w,
    d,
    draw: (ctx, u, v, s) => {
      for (let i = 0; i < 24; i++) {
        const x = (i - 11.5) * PITCH
        padRing(ctx, u(x), v(rowZ), 0.075 * s)
        padRing(ctx, u(x), v(-rowZ), 0.075 * s)
        silkText(ctx, TEENSY41_BACK[i], u(x), v(-rowZ + 0.17), 0.06 * s)
        silkText(ctx, TEENSY41_FRONT[i], u(x), v(rowZ - 0.17), 0.06 * s)
      }
      ctx.strokeStyle = C.silk
      ctx.lineWidth = 0.015 * s
      ctx.strokeRect(u(-w / 2 + 0.05), v(-d / 2 + 0.05), (w - 0.1) * s, (d - 0.1) * s)
      silkText(ctx, str(part, 'title', 'Teensy 4.1'), u(0.15), v(0.5), 0.12 * s)
    },
  })
  return (
    <group>
      <BoardSlab w={w} d={d} y={standoff} art={art} />
    </group>
  )
}

function ModuleBody(p: PartProps) {
  const v = str(p.part, 'variant', '')
  if (v === 'teensy41') return <Teensy41Module {...p} />
  if (v === 'uno') return <UnoModule {...p} />
  if (v === 'nano') return <NanoModule {...p} />
  return <GenericModule {...p} />
}

// ───────────── Wi-Fi module (ESP32-style can + PCB antenna) ─────────────

function WifiModuleBody({ part }: PartProps) {
  const w = 1.8
  const d = 2.55
  const t = 0.08
  const color = part.color ?? '#1f2733'
  const art = boardArt('wroom', {
    color,
    w,
    d,
    draw: (ctx, u, v, s) => {
      // meandering PCB antenna
      ctx.strokeStyle = C.gold
      ctx.lineWidth = 0.05 * s
      ctx.lineJoin = 'miter'
      ctx.beginPath()
      ctx.moveTo(u(-0.75), v(-0.68))
      ctx.lineTo(u(-0.75), v(-1.15))
      for (let i = 0; i < 7; i++) {
        const x0 = -0.75 + i * 0.22
        ctx.lineTo(u(x0 + 0.11), v(-1.15))
        ctx.lineTo(u(x0 + 0.11), v(-0.8))
        ctx.lineTo(u(x0 + 0.22), v(-0.8))
        ctx.lineTo(u(x0 + 0.22), v(-1.15))
      }
      ctx.stroke()
      // castellated pads
      ctx.fillStyle = C.gold
      for (let i = 0; i < 14; i++) {
        const z = 1.2 - i * 0.127
        ctx.fillRect(u(-0.9), v(z) - 0.03 * s, 0.1 * s, 0.06 * s)
        ctx.fillRect(u(0.8), v(z) - 0.03 * s, 0.1 * s, 0.06 * s)
      }
      for (let i = 0; i < 10; i++) ctx.fillRect(u((i - 4.5) * 0.127) - 0.03 * s, v(1.175), 0.06 * s, 0.1 * s)
    },
  })
  return (
    <group>
      <BoardSlab w={w} d={d} t={t} art={art} />
      <Block p={[0, t, 0.3]} s={[1.6, 0.26, 1.72]} color={C.tin} />
      <Marking text={str(part, 'marking', 'ESP32-S3\nWROOM-1')} p={[0, t + 0.262, 0.15]} w={1.2} h={0.5} color="#5a6068" weight={700} />
      <Decal p={[0, t + 0.262, 0.85]} size={[0.5, 0.5]} round color="#b4bac1" />
    </group>
  )
}

// ───────────── OLED 0.96" ─────────────

function OledBody({ part, state }: PartProps) {
  const w = 2.7
  const d = 2.8
  const t = 0.12
  const standoff = num(part, 'standoff', 0.25)
  const color = part.color ?? str(part, 'color', '#1f3f78')
  const on = !state.burnt && (state.glow > 0.01 || part.params?.on === true)
  const lines = (Array.isArray(part.params?.lines) ? (part.params?.lines as unknown[]).map(String) : ['CIRCUIT', 'ATELIER', '> 3.30 V']).slice(0, 4)
  if (state.reading) lines[lines.length - 1] = state.reading
  const sig = lines.join('\n')
  const screen = useCanvasTexture(
    256,
    128,
    (ctx, W, H) => {
      ctx.fillStyle = '#05080c'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#9fe8ff'
      ctx.textBaseline = 'middle'
      const n = lines.length
      lines.forEach((l, i) => {
        const big = i === 0
        ctx.font = `${big ? 700 : 500} ${big ? H * 0.26 : H * 0.17}px ${MONO}`
        ctx.fillText(l, W * 0.05, (H / (n + 0.4)) * (i + 0.7))
      })
      ctx.fillRect(W * 0.05, H * 0.93, W * 0.9 * 0.6, H * 0.03)
    },
    [sig],
  )
  const art = boardArt('oled', {
    color,
    w,
    d,
    draw: (ctx, u, v, s) => {
      for (const [x, z] of [
        [-1.15, -1.2],
        [1.15, -1.2],
        [-1.15, 1.2],
        [1.15, 1.2],
      ])
        padRing(ctx, u(x), v(z), 0.12 * s)
      ;['GND', 'VCC', 'SCL', 'SDA'].forEach((l, i) => {
        const x = (i - 1.5) * PITCH
        padRing(ctx, u(x), v(-1.27), 0.075 * s)
        silkText(ctx, l, u(x), v(-1.05), 0.07 * s)
      })
    },
  })
  const top = standoff + t
  const pins = useMemo<InkInstance[]>(
    () => [0, 1, 2, 3].map((i) => ({ p: [(i - 1.5) * PITCH, (top + 0.04 - 0.3) / 2, -1.27], s: [0.064, top + 0.34, 0.064] })),
    [top],
  )
  return (
    <group>
      <InkInstances geometry={G.box()} items={pins} color={C.gold} outline={1} />
      <Block p={[0, 0, -1.27]} s={[1.02, standoff, 0.25]} color={C.black} />
      <BoardSlab w={w} d={d} t={t} y={standoff} art={art} />
      <Block p={[0, top, 0.25]} s={[2.66, 0.12, 1.95]} color="#16181d" />
      <Block p={[0, top, 1.27]} s={[0.9, 0.02, 0.2]} color="#c99a3c" outline={false} />
      {on ? (
        <Decal p={[0, top + 0.121, 0.18]} size={[2.2, 1.1]} map={screen} />
      ) : (
        <Decal p={[0, top + 0.121, 0.18]} size={[2.2, 1.1]} color="#1d2129" />
      )}
    </group>
  )
}

// ───────────── HC-SR04-style ultrasonic sensor ─────────────

function meshArt() {
  return drawnTexture('sr04-mesh', 128, 128, (ctx, W) => {
    ctx.fillStyle = '#5b6067'
    ctx.beginPath()
    ctx.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2c3035'
    for (let y = 6; y < W; y += 9)
      for (let x = 6 + ((y / 9) % 2) * 4.5; x < W; x += 9) {
        if ((x - W / 2) ** 2 + (y - W / 2) ** 2 < (W / 2 - 6) ** 2) {
          ctx.beginPath()
          ctx.arc(x, y, 2.6, 0, Math.PI * 2)
          ctx.fill()
        }
      }
  })
}

function UltrasonicBody({ part }: PartProps) {
  const color = part.color ?? '#2b5fb0'
  const base = 0.3
  const front = drawnTexture(`sr04-front:${color}`, 450, 200, (ctx, W, H) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = C.silk
    ctx.font = `600 15px ${MONO}`
    ctx.textAlign = 'center'
    ;['VCC', 'TRIG', 'ECHO', 'GND'].forEach((l, i) => ctx.fillText(l, W / 2 + (i - 1.5) * 25.4, H - 12))
    ctx.font = `700 20px ${MONO}`
    ctx.fillText('T', W / 2 - 130, 26)
    ctx.fillText('R', W / 2 + 130, 26)
  })
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <Leg key={i} x={(i - 1.5) * PITCH} z={0} top={base + 0.1} square r={0.032} color={C.gold} />
      ))}
      <Block p={[0, 0.05, 0]} s={[1.02, base - 0.05, 0.25]} color={C.black} />
      <Block p={[0, base, 0]} s={[4.5, 2.0, 0.16]} color={color} />
      <Decal p={[0, base + 1.0, 0.081]} size={[4.5, 2.0]} facing="+z" map={front} />
      {[-1.3, 1.3].map((x) => (
        <group key={x}>
          <CylZ p={[x, base + 1.05, 0.08 + 0.6]} r={0.8} l={1.2} seg={24} color="#c9ced4" />
          <CylZ p={[x, base + 1.05, 1.27]} r={0.74} l={0.04} seg={24} color="#8f969d" outline={false} />
          <Decal p={[x, base + 1.05, 1.292]} size={[1.36, 1.36]} facing="+z" round map={meshArt()} />
        </group>
      ))}
      <InkMesh geometry={G.roundedBox(0.9, 0.32, 0.3, 0.1)} position={[0, base + 1.75, 0.24]} color={C.tin} />
    </group>
  )
}

// ───────────── load cell (bar type) ─────────────

const loadCellGeo = () =>
  geo('loadcell-bar', () => {
    const L = 8.0
    const H = 1.27
    const s = new THREE.Shape()
    s.moveTo(-L / 2, -H / 2)
    s.lineTo(L / 2, -H / 2)
    s.lineTo(L / 2, H / 2)
    s.lineTo(-L / 2, H / 2)
    s.lineTo(-L / 2, -H / 2)
    // binocular hole: two circles joined by a slot
    const r = 0.32
    const c = 0.55
    const hh = 0.1
    const a = Math.asin(hh / r)
    const hole = new THREE.Path()
    hole.moveTo(-c + r * Math.cos(a), hh)
    hole.lineTo(c - r * Math.cos(a), hh)
    hole.absarc(c, 0, r, Math.PI - a, -(Math.PI - a), true)
    hole.lineTo(-c + r * Math.cos(a), -hh)
    hole.absarc(-c, 0, r, -a, a - 2 * Math.PI, true)
    s.holes.push(hole)
    return extrudeAlongZ(s, 1.27, 16)
  })

function LoadCellBody({ part }: PartProps) {
  const cy = 0.6 + 0.635
  const topY = cy + 0.635
  const wires: [string, number][] = [
    [C.wireRed, -0.36],
    [C.wireBlack, -0.12],
    [C.wireWhite, 0.12],
    [C.wireGreen, 0.36],
  ]
  return (
    <group>
      <Block p={[3.0, 0, 0]} s={[2.0, 0.6, 1.6]} color={C.charcoal} />
      <Block p={[-3.0, 0, 0]} s={[2.0, 0.3, 1.6]} color={C.charcoal} />
      <InkMesh geometry={loadCellGeo()} position={[0, cy, 0]} color={part.color ?? C.alu} />
      {[-3.6, -2.9, 2.9, 3.6].map((x) => (
        <Decal key={x} p={[x, topY + 0.002, 0]} size={[0.32, 0.32]} round color="#3f454b" />
      ))}
      <InkMesh geometry={G.sphere(14, 8)} position={[0, topY, 0]} scale={[0.75, 0.12, 0.5]} color="#f2f0ea" />
      <Marking text={str(part, 'marking', '5 kg')} p={[-2.0, cy, 0.637]} w={1.0} h={0.35} facing="+z" color="#4b5157" weight={700} />
      {wires.map(([c, z]) => (
        <Tube key={c} points={[[3.6, topY - 0.25, z * 0.5], [4.4, topY - 0.25, z], [5.2, 0.6, z * 1.6], [5.9, 0.05, z * 2.2]]} r={0.035} color={c} />
      ))}
    </group>
  )
}

export const Breadboard = BreadboardBody
export const Module = ModuleBody
export const WifiModule = WifiModuleBody
export const Oled = OledBody
export const Ultrasonic = UltrasonicBody
export const LoadCell = LoadCellBody
