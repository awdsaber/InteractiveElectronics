// Semiconductors: LEDs, TO-92, TO-220, heatsink, DIP and SMD ICs.

import * as THREE from 'three'
import { G, extrudeAlongZ, extrudeUp, geo, lathe, mergedBoxes } from '../geometry'
import { InkInstances, InkMesh, type InkInstance } from '../ink'
import { C, ledLook } from '../palette'
import { Block, Decal, GlowHalo, LeadPath, Leg, Marking } from './common'
import { dipGeom, smdIcGeom } from './footprints'
import { SmdChip } from './passives'
import { PITCH, str, type PartProps } from './types'

// ───────────── LEDs ─────────────

const ledLensGeo = () => {
  const pts: [number, number][] = [
    [0, 0],
    [0.25, 0],
    [0.25, 0.42],
  ]
  for (let i = 1; i <= 7; i++) {
    const t = (i / 7) * (Math.PI / 2)
    pts.push([0.25 * Math.cos(t), 0.42 + 0.25 * Math.sin(t)])
  }
  return geo('led5-lens', () => lathe(pts, 18))
}

function ledFlangeGeo() {
  return geo('led5-flange', () => {
    // circle r 0.29 with the cathode flat at -x (shape x → world x)
    const r = 0.29
    const flat = 0.255
    const a = Math.acos(flat / r)
    const s = new THREE.Shape()
    s.absarc(0, 0, r, Math.PI + a, Math.PI - a + Math.PI * 2, false)
    s.lineTo(-flat, Math.sin(Math.PI + a) * r)
    return extrudeUp(s, 0.09, 18)
  })
}

function LedBody({ part, state }: PartProps) {
  const look = ledLook(part.params?.color ?? part.color)
  const base = 0.14
  const g = state.burnt ? 0 : state.glow
  return (
    <group>
      {/* cathode (−x, flat side, short leg) and anode (+x, long leg) */}
      <Leg x={-0.127} z={0} top={base} square r={0.022} />
      <Leg x={0.127} z={0} top={base} square r={0.022} />
      <InkMesh geometry={ledFlangeGeo()} position={[0, base, 0]} color={look.lens} opacity={0.9} glow={g * 0.6} glowColor={look.glow} />
      {/* inner lead frame: post (anode) and anvil (cathode) */}
      <Block p={[0.1, base + 0.09, 0]} s={[0.04, 0.22, 0.03]} color="#9aa1a8" outline={1} />
      <Block p={[-0.1, base + 0.09, 0]} s={[0.04, 0.16, 0.03]} color="#9aa1a8" outline={1} />
      <Block p={[-0.08, base + 0.25, 0]} s={[0.12, 0.08, 0.04]} color="#8d949b" outline={1} />
      <InkMesh geometry={ledLensGeo()} position={[0, base + 0.09, 0]} color={look.lens} opacity={0.78} glow={g} glowColor={look.glow} />
      <GlowHalo p={[0, base + 0.55, 0]} color={look.glow} glow={g} size={1.7} />
    </group>
  )
}

function LedSmdBody({ part, state }: PartProps) {
  const look = ledLook(part.params?.color ?? part.color)
  const g = state.burnt ? 0 : state.glow
  return (
    <group>
      <SmdChip part={{ ...part, color: look.lens }} state={state} kind="led" glow={g} glowColor={look.glow} />
      <GlowHalo p={[0, 0.08, 0]} color={look.glow} glow={g} size={0.9} />
    </group>
  )
}

// ───────────── TO-92 ─────────────

const to92Geo = () =>
  geo('to92', () => {
    // D shape: round back, flat front. Shape y → world −z, so the flat chord
    // at shape y = −0.19 faces +z. Circle centre at world z = +0.05.
    const r = 0.24
    const cy = -0.05
    const fy = -0.19
    const x0 = Math.sqrt(r * r - (fy - cy) ** 2)
    const a0 = Math.atan2(fy - cy, x0)
    const s = new THREE.Shape()
    s.moveTo(-x0, fy)
    s.lineTo(x0, fy)
    s.absarc(0, cy, r, a0, Math.PI - a0, false)
    return extrudeUp(s, 0.45, 16)
  })

function To92Body({ part }: PartProps) {
  const base = 0.32
  return (
    <group>
      {[-1, 0, 1].map((i) => (
        <LeadPath
          key={i}
          points={[
            [i * 0.09, base + 0.02, 0],
            [i * 0.09, base - 0.08, 0],
            [i * 0.127, base - 0.16, 0],
            [i * 0.127, -0.05, 0],
          ]}
          r={0.02}
        />
      ))}
      <InkMesh geometry={to92Geo()} position={[0, base, 0]} color={part.color ?? C.epoxy} />
      <Marking text={str(part, 'marking', '2N2222A')} p={[0, base + 0.26, 0.192]} w={0.36} h={0.11} facing="+z" color="#cfcac0" />
    </group>
  )
}

// ───────────── TO-220 ─────────────

const to220TabGeo = () =>
  geo('to220-tab', () => {
    const s = new THREE.Shape()
    s.moveTo(-0.5, 0)
    s.lineTo(0.5, 0)
    s.lineTo(0.5, 1.5)
    s.lineTo(-0.5, 1.5)
    s.lineTo(-0.5, 0)
    const hole = new THREE.Path()
    hole.absarc(0, 1.2, 0.18, 0, Math.PI * 2, true)
    s.holes.push(hole)
    return extrudeAlongZ(s, 0.13, 18)
  })

const to220LeadGeo = () =>
  geo('to220-lead', () =>
    mergedBoxes([
      [0, -0.07, 0, 0.15, 0.14, 0.05],
      [0, -0.27, 0, 0.08, 0.3, 0.05],
    ]),
  )

function To220({ part, marking }: PartProps & { marking: string }) {
  const base = 0.38
  const leads: InkInstance[] = [-1, 0, 1].map((i) => ({ p: [i * PITCH, base, 0] }))
  return (
    <group>
      <InkInstances geometry={to220LeadGeo()} items={leads} color={C.tin} outline={1.2} />
      <InkMesh geometry={to220TabGeo()} position={[0, base, -0.155]} color={C.steel} />
      <Block p={[0, base, 0.065]} s={[1.0, 0.9, 0.31]} color={part.color ?? C.epoxy} />
      <Marking text={str(part, 'marking', marking)} p={[0, base + 0.55, 0.222]} w={0.8} h={0.17} facing="+z" color="#d6d1c6" />
      <Marking text={str(part, 'sub', '')} p={[0, base + 0.36, 0.222]} w={0.6} h={0.11} facing="+z" color="#a9a49a" />
    </group>
  )
}

function MosfetBody(p: PartProps) {
  return <To220 {...p} marking="IRLZ44N" />
}

function RegulatorBody(p: PartProps) {
  return <To220 {...p} marking="LM7805" />
}

function HeatsinkBody({ part }: PartProps) {
  const fins: InkInstance[] = Array.from({ length: 6 }, (_, i) => ({
    p: [-0.7 + i * 0.28, 1.0, -0.6],
    s: [0.07, 2.0, 0.8],
  }))
  return (
    <group>
      <Leg x={-0.4} z={-0.55} top={0.05} r={0.035} />
      <Leg x={0.4} z={-0.55} top={0.05} r={0.035} />
      <Block p={[0, 0, -0.25]} s={[1.6, 2.0, 0.14]} color={part.color ?? C.alu} />
      <InkInstances geometry={G.box()} items={fins} color={part.color ?? C.alu} />
      <Block p={[0, 0, -0.6]} s={[1.6, 0.12, 0.8]} color={part.color ?? C.alu} />
    </group>
  )
}

// ───────────── DIP ─────────────

const dipPinGeo = () =>
  geo('dip-pin', () =>
    // for the +z row; the −z row is rotated π about Y
    mergedBoxes([
      [0, 0.125, 0.345, 0.05, 0.025, 0.07],
      [0, 0.055, 0.381, 0.1, 0.12, 0.025],
      [0, -0.04, 0.381, 0.045, 0.1, 0.025],
    ]),
  )

function DipBody({ part }: PartProps) {
  const g = dipGeom(part)
  const def = g.pins === 8 ? 'NE555' : g.pins === 14 ? '74HC00' : g.pins === 16 ? '74HC595' : g.pins === 28 ? 'ATMEGA328P' : 'IC'
  const marking = str(part, 'marking', def)
  const pins: InkInstance[] = []
  const scaleZ = g.rowZ / 0.381
  for (let i = 0; i < g.perSide; i++) {
    pins.push({ p: [g.pinX(i), 0, 0], s: [1, 1, scaleZ] })
    pins.push({ p: [g.pinX(i), 0, 0], r: [0, Math.PI, 0], s: [1, 1, scaleZ] })
  }
  const L = g.length
  const W = g.bodyW
  const top = 0.38
  return (
    <group>
      <InkInstances geometry={dipPinGeo()} items={pins} color={C.tin} outline={1} />
      <Block p={[0, 0.06, 0]} s={[L, 0.15, W]} color={part.color ?? C.epoxy} />
      <Block p={[0, 0.21, 0]} s={[L - 0.02, 0.17, W - 0.03]} color={part.color ?? C.epoxy} />
      <InkMesh geometry={G.halfDiscY()} position={[-L / 2 + 0.005, top + 0.002, 0]} scale={0.065} color="#151413" unlit decal outline={false} />
      <InkMesh geometry={G.discY(12)} position={[-L / 2 + 0.13, top + 0.002, W / 2 - 0.12]} scale={0.035} color="#1c1b1a" unlit decal outline={false} />
      <Marking text={marking} p={[0.02, top + 0.002, -0.03]} w={Math.min(L * 0.82, 2.6)} h={Math.min(0.15, W * 0.24)} color="#d8d3c8" />
      {str(part, 'sub', '') && <Marking text={str(part, 'sub', '')} p={[0.02, top + 0.002, 0.13]} w={Math.min(L * 0.6, 1.8)} h={0.09} color="#a8a397" />}
    </group>
  )
}

// ───────────── SMD ICs ─────────────

function gullGeo(reach: number, wid: number, height: number) {
  const k = `gull:${reach.toFixed(3)}:${wid.toFixed(3)}:${height.toFixed(3)}`
  return geo(k, () => {
    // lead along +z: shoulder at mid height, slope, flat foot
    const foot = Math.min(0.06, reach * 0.45)
    const shoulder = Math.max(0.02, reach - foot - 0.03)
    const t = 0.018
    const sy = height * 0.45
    return mergedBoxes([
      [0, sy, shoulder / 2, wid, t, shoulder],
      [0, sy / 2 + t / 2, shoulder + 0.015, wid, sy, t],
      [0, t / 2, shoulder + 0.03 + foot / 2 - 0.01, wid, t, foot],
    ])
  })
}

function SmdIcBody({ part }: PartProps) {
  const g = smdIcGeom(part)
  const lift = g.pkg === 'QFN' ? 0 : 0.015
  const items: InkInstance[] = []
  const sides = g.quad ? 4 : 2
  const half = g.pkg === 'QFN' ? 0 : g.bz / 2
  const reach = g.pkg === 'QFN' ? 0 : g.span / 2 - g.bz / 2
  for (let s = 0; s < sides; s++) {
    const ry = [0, Math.PI, Math.PI / 2, -Math.PI / 2][s]
    for (let i = 0; i < g.perSide; i++) {
      const o = g.offset(i)
      const p: [number, number, number] =
        s === 0 ? [o, 0, half] : s === 1 ? [o, 0, -half] : s === 2 ? [half, 0, o] : [-half, 0, o]
      items.push({ p, r: [0, ry, 0] })
    }
  }
  const pinGeo = g.pkg === 'QFN' ? null : gullGeo(reach, g.pitch * 0.45, g.h + lift)
  const qfnPads: InkInstance[] = []
  if (g.pkg === 'QFN') {
    for (let i = 0; i < g.perSide; i++) {
      const o = g.offset(i)
      const sz = g.pitch * 0.5
      qfnPads.push({ p: [o, 0.012, g.bz / 2], s: [sz, 0.024, 0.05] })
      qfnPads.push({ p: [o, 0.012, -g.bz / 2], s: [sz, 0.024, 0.05] })
      qfnPads.push({ p: [g.bx / 2, 0.012, o], s: [0.05, 0.024, sz] })
      qfnPads.push({ p: [-g.bx / 2, 0.012, o], s: [0.05, 0.024, sz] })
    }
  }
  const def = g.pkg === 'SOIC' ? (g.pins === 16 ? 'CH340G' : 'LM358') : g.pkg === 'TQFP' ? 'MEGA328P' : `QFN-${g.pins}`
  const marking = str(part, 'marking', def)
  const top = lift + g.h
  return (
    <group>
      {pinGeo && <InkInstances geometry={pinGeo} items={items} color={C.tin} outline={0.9} />}
      {qfnPads.length > 0 && <InkInstances geometry={G.box()} items={qfnPads} color={C.tin} outline={false} />}
      <Block p={[0, lift, 0]} s={[g.bx, g.h, g.bz]} color={part.color ?? C.epoxy} outline={1.3} />
      <InkMesh
        geometry={G.discY(12)}
        position={[-g.bx / 2 + Math.min(0.08, g.bx * 0.14), top + 0.002, g.bz / 2 - Math.min(0.08, g.bz * 0.14)]}
        scale={Math.min(0.03, g.bx * 0.05)}
        color="#151413"
        unlit
        outline={false}
      />
      <Marking text={marking} p={[0, top + 0.002, 0]} w={g.bx * 0.8} h={Math.min(0.12, g.bz * 0.22)} color="#cfcac0" />
      {g.pkg !== 'SOIC' && <Decal p={[0, top + 0.0015, 0]} size={[g.bx * 0.97, g.bz * 0.97]} color="#353331" />}
    </group>
  )
}

export const Led = LedBody
export const LedSmd = LedSmdBody
export const To92 = To92Body
export const Mosfet = MosfetBody
export const Regulator = RegulatorBody
export const Heatsink = HeatsinkBody
export const Dip = DipBody
export const SmdIc = SmdIcBody
