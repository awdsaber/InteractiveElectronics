// Connectors. Convention: at rot = 0 cable entries / mouths face +Z, the
// board's front edge, which the iso camera sees. (Bodies are modelled
// facing −X and turned by FRONT; footprints apply the same turn.)

import * as THREE from 'three'
import { G, extrudeAlongX, geo, stadiumShape } from '../geometry'
import { InkInstances, InkMesh, type InkInstance } from '../ink'
import { C } from '../palette'
import { Block, CylX, CylY, Decal } from './common'
import { FRONT, headerGeom } from './footprints'
import { num, str, type PartProps } from './types'

// ───────────── pin headers ─────────────

function HeaderMaleBody({ part }: PartProps) {
  const g = headerGeom(part)
  const blocks: InkInstance[] = []
  const pins: InkInstance[] = []
  const above = num(part, 'pinLength', 0.6)
  for (let r = 0; r < g.rows; r++)
    for (let i = 0; i < g.pins; i++) {
      const x = g.pinX(i)
      const z = g.rowZ(r)
      blocks.push({ p: [x, 0.125, z], s: [0.248, 0.25, 0.248] })
      pins.push({ p: [x, (0.25 + above - 0.3) / 2, z], s: [0.064, 0.25 + above + 0.3, 0.064] })
    }
  return (
    <group>
      <InkInstances geometry={G.box()} items={blocks} color={part.color ?? C.black} />
      <InkInstances geometry={G.box()} items={pins} color={C.gold} outline={1.1} />
    </group>
  )
}

function HeaderFemaleBody({ part }: PartProps) {
  const g = headerGeom(part)
  const h = num(part, 'height', 0.85)
  const blocks: InkInstance[] = []
  const holes: InkInstance[] = []
  for (let r = 0; r < g.rows; r++)
    for (let i = 0; i < g.pins; i++) {
      const x = g.pinX(i)
      const z = g.rowZ(r)
      blocks.push({ p: [x, h / 2, z], s: [0.25, h, 0.25] })
      holes.push({ p: [x, h + 0.002, z], s: [0.095, 0.002, 0.095] })
    }
  return (
    <group>
      <InkInstances geometry={G.box()} items={blocks} color={part.color ?? C.black} />
      <InkInstances geometry={G.box()} items={holes} color={C.hole} unlit decal outline={false} />
    </group>
  )
}

// ───────────── USB-B (Uno-style) ─────────────

function usbBMouthGeo() {
  return geo('usbb-mouth', () => {
    const s = new THREE.Shape()
    const w = 0.42
    const h = 0.39
    const c = 0.1
    s.moveTo(-w, -h)
    s.lineTo(w, -h)
    s.lineTo(w, h - c)
    s.lineTo(w - c, h)
    s.lineTo(-w + c, h)
    s.lineTo(-w, h - c)
    s.lineTo(-w, -h)
    return new THREE.ShapeGeometry(s)
  })
}

function UsbBBody({ part }: PartProps) {
  const L = 1.6
  const W = 1.2
  const H = 1.1
  return (
    <group rotation={FRONT}>
      <Block p={[0, 0, 0]} s={[L, H, W]} color={part.color ?? C.tin} />
      <Block p={[-L / 2 + 0.06, -0.01, 0]} s={[0.12, H + 0.04, W + 0.04]} color={C.steel} />
      {/* mouth: dark opening with the white tongue */}
      <group position={[-L / 2 - 0.002, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <InkMesh geometry={usbBMouthGeo()} color={C.hole} unlit decal outline={false} />
        <InkMesh geometry={G.planeZ()} position={[0, 0, 0.001]} scale={[0.36, 0.3, 1]} color={C.white} unlit decal outline={false} />
      </group>
      <Block p={[0.1, 0, -W / 2 - 0.01]} s={[0.3, 0.1, 0.02]} color={C.steel} outline={1} />
      <Block p={[0.1, 0, W / 2 + 0.01]} s={[0.3, 0.1, 0.02]} color={C.steel} outline={1} />
    </group>
  )
}

// ───────────── USB-C / micro-USB ─────────────

const usbCGeo = () => geo('usbc-shell', () => extrudeAlongX(stadiumShape(0.894, 0.326), 0.735, 14))
const usbCMouthGeo = () => geo('usbc-mouth', () => new THREE.ShapeGeometry(stadiumShape(0.8, 0.24), 12))

function UsbCBody({ part }: PartProps) {
  const L = 0.735
  return (
    <group rotation={FRONT}>
      <InkMesh geometry={usbCGeo()} position={[0, 0.163, 0]} color={part.color ?? C.tin} />
      <group position={[-L / 2 - 0.002, 0.163, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <InkMesh geometry={usbCMouthGeo()} color={C.hole} unlit decal outline={false} />
        <InkMesh geometry={G.planeZ()} position={[0, 0, 0.001]} scale={[0.6, 0.07, 1]} color="#3c3a37" unlit decal outline={false} />
      </group>
      <Block p={[0.12, 0, -0.45]} s={[0.2, 0.08, 0.03]} color={C.steel} outline={1} />
      <Block p={[0.12, 0, 0.45]} s={[0.2, 0.08, 0.03]} color={C.steel} outline={1} />
    </group>
  )
}

const microShape = () => {
  const s = new THREE.Shape()
  const top = 0.375
  const bot = 0.28
  const h = 0.13
  s.moveTo(-bot, -h)
  s.lineTo(bot, -h)
  s.lineTo(top, h * 0.1)
  s.lineTo(top, h)
  s.lineTo(-top, h)
  s.lineTo(-top, h * 0.1)
  s.lineTo(-bot, -h)
  return s
}
const microGeo = () => geo('microusb-shell', () => extrudeAlongX(microShape(), 0.5, 4))
const microMouthGeo = () => geo('microusb-mouth', () => new THREE.ShapeGeometry(microShape()).scale(0.85, 0.7, 1))

function MicroUsbBody({ part }: PartProps) {
  return (
    <group rotation={FRONT}>
      <InkMesh geometry={microGeo()} position={[0, 0.13, 0]} color={part.color ?? C.tin} />
      <group position={[-0.252, 0.13, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <InkMesh geometry={microMouthGeo()} color={C.hole} unlit decal outline={false} />
        <InkMesh geometry={G.planeZ()} position={[0, 0.01, 0.001]} scale={[0.42, 0.04, 1]} color="#3c3a37" unlit decal outline={false} />
      </group>
      <Block p={[0.02, 0, -0.36]} s={[0.16, 0.06, 0.05]} color={C.steel} outline={1} />
      <Block p={[0.02, 0, 0.36]} s={[0.16, 0.06, 0.05]} color={C.steel} outline={1} />
    </group>
  )
}

// ───────────── barrel jack ─────────────

function BarrelJackBody({ part }: PartProps) {
  const L = 1.4
  const W = 0.9
  const H = 1.1
  const cy = 0.62
  return (
    <group rotation={FRONT}>
      <Block p={[0.05, 0, 0]} s={[L - 0.1, H, W]} color={part.color ?? C.black} />
      <Block p={[-L / 2 + 0.06, 0, 0]} s={[0.14, H - 0.06, W - 0.04]} color={part.color ?? C.black} />
      <CylX p={[-L / 2 - 0.04, cy, 0]} r={0.4} l={0.12} seg={20} color={part.color ?? C.black} />
      <Decal p={[-L / 2 - 0.101, cy, 0]} size={[0.6, 0.6]} facing="-x" round color={C.hole} />
      <CylX p={[-L / 2 - 0.02, cy, 0]} r={0.09} l={0.16} seg={10} color={C.tin} outline={1} />
    </group>
  )
}

// ───────────── screw terminal ─────────────

function ScrewTerminalBody({ part }: PartProps) {
  const n = Math.max(2, Math.round(num(part, 'pins', 2)))
  const pitch = 0.508
  const blocks: InkInstance[] = []
  const color = part.color ?? str(part, 'color', C.terminalBlue)
  for (let i = 0; i < n; i++) {
    const z = (i - (n - 1) / 2) * pitch
    blocks.push({ p: [0, 0.5, z], s: [0.76, 1.0, pitch - 0.012] })
  }
  return (
    <group rotation={FRONT}>
      <InkInstances geometry={G.box()} items={blocks} color={color} />
      {blocks.map((b, i) => {
        const z = b.p[2]
        return (
          <group key={i}>
            <CylY p={[0.06, 1.0, z]} r={0.16} h={0.03} seg={14} color={C.tin} outline={1.2} />
            <Decal p={[0.06, 1.032, z]} size={[0.25, 0.04]} spin={Math.PI / 4} color="#4a4f55" />
            {/* wire entry */}
            <Decal p={[-0.382, 0.3, z]} size={[0.3, 0.3]} facing="-x" color={C.hole} />
            <Block p={[-0.36, 0.17, z]} s={[0.03, 0.04, 0.26]} color={C.tin} outline={false} />
          </group>
        )
      })}
    </group>
  )
}

export const HeaderMale = HeaderMaleBody
export const HeaderFemale = HeaderFemaleBody
export const UsbB = UsbBBody
export const UsbC = UsbCBody
export const MicroUsb = MicroUsbBody
export const BarrelJack = BarrelJackBody
export const ScrewTerminal = ScrewTerminalBody
