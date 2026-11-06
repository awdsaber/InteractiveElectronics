// Passive parts: resistors, capacitors, inductors, diodes, thermistor, fuse,
// crystal. Axial parts lie along X with leads bent down at ±span/2.

import * as THREE from 'three'
import { BAND_HEX, capacitorCode, parseOhms, resistorBands, smdCode, type BandColor } from '../colorCode'
import { G, extrudeUp, geo, lathe, stadiumShape } from '../geometry'
import { InkInstances, InkMesh, type InkInstance } from '../ink'
import { C } from '../palette'
import { Block, CylX, CylY, Decal, LeadPath, Leg, Marking, type Vec3 } from './common'
import { axialSpan, chipSize, electroSize } from './footprints'
import { num, str, type PartProps } from './types'

// ───────────── axial (resistor, diode, zener) ─────────────

function AxialLeads({ span, y, bodyHalf, r = 0.025 }: { span: number; y: number; bodyHalf: number; r?: number }) {
  const h = span / 2
  const bend = Math.min(0.06, (h - bodyHalf) * 0.5)
  const side = (s: number): Vec3[] => [
    [s * bodyHalf, y, 0],
    [s * (h - bend), y, 0],
    [s * h, y - bend, 0],
    [s * h, -0.05, 0],
  ]
  return (
    <>
      <LeadPath points={side(-1)} r={r} />
      <LeadPath points={side(1)} r={r} />
    </>
  )
}

const resistorBodyGeo = () =>
  geo('resistor-body', () =>
    lathe(
      [
        [0, -0.315],
        [0.085, -0.312],
        [0.118, -0.29],
        [0.126, -0.25],
        [0.124, -0.2],
        [0.106, -0.155],
        [0.104, 0],
        [0.106, 0.155],
        [0.124, 0.2],
        [0.126, 0.25],
        [0.118, 0.29],
        [0.085, 0.312],
        [0, 0.315],
      ],
      16,
    ).rotateZ(-Math.PI / 2),
  )

function bandsFor(ohms: number, five: boolean, tol: number | undefined): BandColor[] {
  try {
    return resistorBands(ohms, { bands: five ? 5 : 4, tolerance: tol })
  } catch {
    return resistorBands(220)
  }
}

function ResistorBody({ part }: PartProps) {
  const ohms = parseOhms(part.params?.ohms) ?? 220
  const film = str(part, 'film', 'carbon')
  const five = film === 'metal' || num(part, 'bands', 4) === 5
  const tol = typeof part.params?.tolerance === 'number' ? (part.params.tolerance as number) : undefined
  const bands = bandsFor(ohms, five, tol)
  const y = 0.15
  const xs = bands.length === 1 ? [0] : five ? [-0.215, -0.12, -0.05, 0.02, 0.215] : [-0.215, -0.11, -0.03, 0.215]
  return (
    <group>
      <AxialLeads span={axialSpan(part)} y={y} bodyHalf={0.3} />
      <InkMesh geometry={resistorBodyGeo()} position={[0, y, 0]} color={part.color ?? (five ? C.resistorBlue : C.resistorTan)} />
      {bands.map((b, i) => {
        const x = xs[i] ?? 0
        const r = Math.abs(x) > 0.17 ? 0.129 : 0.108
        return <CylX key={i} p={[x, y, 0]} r={r} l={0.042} seg={16} color={BAND_HEX[b]} outline={false} />
      })}
    </group>
  )
}

function DiodeBody({ part }: PartProps) {
  const y = 0.15
  return (
    <group>
      <AxialLeads span={axialSpan(part)} y={y} bodyHalf={0.26} />
      <CylX p={[0, y, 0]} r={0.135} l={0.52} color={part.color ?? '#2a2a2d'} />
      <CylX p={[0.18, y, 0]} r={0.137} l={0.07} color="#c9ced4" outline={false} />
      <Marking text={str(part, 'marking', '1N4007')} p={[-0.03, y + 0.137, 0]} w={0.3} h={0.09} />
    </group>
  )
}

function ZenerBody({ part }: PartProps) {
  const y = 0.1
  return (
    <group>
      <AxialLeads span={axialSpan(part)} y={y} bodyHalf={0.19} r={0.02} />
      <CylX p={[0, y, 0]} r={0.04} l={0.3} color="#3a3530" outline={false} />
      <CylX p={[0, y, 0]} r={0.09} l={0.38} color={part.color ?? '#e0733a'} opacity={0.72} />
      <CylX p={[0.13, y, 0]} r={0.092} l={0.05} color="#1f1d1b" outline={false} />
    </group>
  )
}

// ───────────── SMD chips ─────────────

export function SmdChip({ part, kind, glow = 0, glowColor }: PartProps & { kind: 'r' | 'c' | 'led'; glow?: number; glowColor?: string }) {
  const [l, w, h] = chipSize(part)
  const cap = l * 0.2
  if (kind === 'led') {
    const lens = part.color ?? str(part, 'lens', '#e0473a')
    return (
      <group>
        <Block p={[0, 0, 0]} s={[l, h * 0.5, w]} color={C.white} />
        <Block p={[0, h * 0.5, 0]} s={[l * 0.9, h * 0.5, w * 0.9]} color={lens} opacity={0.85} glow={glow} glowColor={glowColor} outline={1.2} />
        <Decal p={[-l * 0.38, h * 0.5 + 0.001, w * 0.47]} size={[l * 0.18, w * 0.05]} color="#3e8f4b" />
      </group>
    )
  }
  const body = kind === 'r' ? C.white : part.color ?? '#b8956a'
  const code = kind === 'r' ? smdCode(parseOhms(part.params?.ohms) ?? 220) : ''
  return (
    <group>
      <Block p={[-l / 2 + cap / 2, 0, 0]} s={[cap, h, w]} color={C.tin} outline={1.2} />
      <Block p={[l / 2 - cap / 2, 0, 0]} s={[cap, h, w]} color={C.tin} outline={1.2} />
      <Block p={[0, 0, 0]} s={[l - cap * 2, h * (kind === 'r' ? 0.88 : 0.97), w * 0.99]} color={body} outline={1.2} />
      {kind === 'r' && <Block p={[0, h * 0.88, 0]} s={[l - cap * 2, h * 0.12, w * 0.99]} color="#24221f" outline={false} />}
      {kind === 'r' && l >= 0.2 && <Marking text={code} p={[0, h + 0.001, 0]} w={l * 0.55} h={w * 0.55} />}
    </group>
  )
}

// ───────────── capacitors ─────────────

function CeramicBody({ part }: PartProps) {
  const farads = num(part, 'farads', 100e-9)
  let code = str(part, 'code', '')
  if (!code) {
    try {
      code = capacitorCode(farads)
    } catch {
      code = '104'
    }
  }
  const cy = 0.42
  return (
    <group>
      <LeadPath points={[[-0.06, cy - 0.2, 0], [-0.127, 0.12, 0], [-0.127, -0.05, 0]]} r={0.02} />
      <LeadPath points={[[0.06, cy - 0.2, 0], [0.127, 0.12, 0], [0.127, -0.05, 0]]} r={0.02} />
      <InkMesh geometry={G.sphere(18, 12)} position={[0, cy, 0]} scale={[0.26, 0.25, 0.075]} color={part.color ?? C.ceramicDisc} />
      <Marking text={code} p={[0, cy + 0.02, 0.077]} w={0.3} h={0.12} facing="+z" color="#3b2412" weight={700} />
    </group>
  )
}

const stripeGeo = () =>
  geo('electro-stripe', () => new THREE.CylinderGeometry(1, 1, 1, 10, 1, true, Math.PI / 2 - 0.5, 1.0))

function ElectrolyticBody({ part }: PartProps) {
  const { d, h } = electroSize(part)
  const r = d / 2
  const base = 0.03
  const canH = h - 0.02
  return (
    <group>
      <CylY p={[0, base - 0.02, 0]} r={r - 0.03} h={0.03} color="#1f1f22" outline={1} />
      <CylY p={[0, base, 0]} r={r} h={canH} seg={20} color={part.color ?? C.electroSleeve} />
      {/* sleeve top lip and aluminium top */}
      <CylY p={[0, base + canH - 0.001, 0]} r={r - 0.035} h={0.012} seg={20} color="#c9ced4" outline={false} />
      <InkMesh geometry={stripeGeo()} position={[0, base + canH / 2, 0]} scale={[r + 0.004, canH * 0.98, r + 0.004]} color={C.electroStripe} outline={false} side={THREE.DoubleSide} />
      {[0.25, 0.5, 0.75].map((f) => (
        <Block key={f} p={[r + 0.006, base + canH * f - 0.008, 0]} s={[0.004, 0.016, Math.min(0.12, r * 0.4)]} color="#27447a" outline={false} />
      ))}
      {/* pressure vent (K-shaped score) */}
      <Decal p={[0, base + canH + 0.013, 0]} size={[r * 1.3, 0.012]} color="#7d858d" />
      <Decal p={[0, base + canH + 0.013, 0]} size={[r * 1.3, 0.012]} spin={Math.PI / 2} color="#7d858d" />
    </group>
  )
}

// ───────────── inductor ─────────────

const turnGeo = () => geo('winding-turn', () => new THREE.TorusGeometry(1, 0.11, 5, 20).rotateX(Math.PI / 2))
const toroidCoreGeo = () => geo('toroid-core', () => new THREE.TorusGeometry(0.46, 0.17, 10, 26))
const toroidTurnGeo = () => geo('toroid-turn', () => new THREE.TorusGeometry(0.205, 0.022, 4, 12).rotateY(Math.PI / 2))

function InductorBody({ part }: PartProps) {
  if (str(part, 'style', 'drum') === 'toroid') {
    const cy = 0.72
    const n = 18
    const turns: InkInstance[] = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      return { p: [Math.cos(a) * 0.46, cy + Math.sin(a) * 0.46, 0], r: [0, 0, a + Math.PI / 2] }
    })
    return (
      <group>
        <LeadPath points={[[-0.22, cy - 0.5, 0.05], [-0.25, 0.1, 0], [-0.25, -0.05, 0]]} r={0.022} color={C.copper} />
        <LeadPath points={[[0.22, cy - 0.5, 0.05], [0.25, 0.1, 0], [0.25, -0.05, 0]]} r={0.022} color={C.copper} />
        <InkMesh geometry={toroidCoreGeo()} position={[0, cy, 0]} color={part.color ?? '#5d7f45'} />
        <InkInstances geometry={toroidTurnGeo()} items={turns} color={C.copper} outline={1} />
      </group>
    )
  }
  const base = 0.03
  const turns: InkInstance[] = Array.from({ length: 6 }, (_, i) => ({
    p: [0, base + 0.16 + i * 0.085, 0],
    s: [0.355, 0.4, 0.355],
  }))
  return (
    <group>
      <Leg x={-0.25} z={0} top={base + 0.05} />
      <Leg x={0.25} z={0} top={base + 0.05} />
      <CylY p={[0, base, 0]} r={0.45} h={0.1} seg={20} color={C.ferrite} />
      <CylY p={[0, base + 0.1, 0]} r={0.34} h={0.52} seg={20} color={C.copper} outline={1} />
      <InkInstances geometry={turnGeo()} items={turns} color="#d9884c" outline={false} />
      <CylY p={[0, base + 0.62, 0]} r={0.45} h={0.1} seg={20} color={C.ferrite} />
      <Marking text={str(part, 'marking', '100µH')} p={[0, base + 0.721, 0]} w={0.6} h={0.16} color="#d9d4c6" />
    </group>
  )
}

// ───────────── thermistor, fuse, crystal ─────────────

function ThermistorBody({ part }: PartProps) {
  const cy = 0.62
  return (
    <group>
      <LeadPath points={[[-0.04, cy - 0.1, 0], [-0.127, 0.25, 0], [-0.127, -0.05, 0]]} r={0.016} color="#c06b3a" />
      <LeadPath points={[[0.04, cy - 0.1, 0], [0.127, 0.25, 0], [0.127, -0.05, 0]]} r={0.016} color="#c06b3a" />
      <InkMesh geometry={G.sphere(12, 9)} position={[0, cy, 0]} scale={[0.12, 0.15, 0.09]} color={part.color ?? '#26332f'} />
    </group>
  )
}

function FuseBody({ part, state }: PartProps) {
  const cy = 0.42
  const clip = (x: number) => (
    <group key={x}>
      <Block p={[x, 0, -0.27]} s={[0.36, cy + 0.12, 0.035]} color={C.tin} outline={1.2} />
      <Block p={[x, 0, 0.27]} s={[0.36, cy + 0.12, 0.035]} color={C.tin} outline={1.2} />
      <Block p={[x, 0.0, 0]} s={[0.36, 0.06, 0.56]} color={C.tin} outline={1.2} />
    </group>
  )
  return (
    <group>
      {clip(-0.75)}
      {clip(0.75)}
      <CylX p={[-0.78, cy, 0]} r={0.255} l={0.44} color={C.steel} />
      <CylX p={[0.78, cy, 0]} r={0.255} l={0.44} color={C.steel} />
      {!state.burnt && <CylX p={[0, cy, 0]} r={0.016} l={1.2} seg={6} color="#8a8f94" outline={false} />}
      <CylX p={[0, cy, 0]} r={0.24} l={1.15} color={part.color ?? C.glass} opacity={0.42} outline={1.2} />
    </group>
  )
}

const hc49Geo = () => geo('hc49-can', () => extrudeUp(stadiumShape(1.1, 0.42), 0.33, 14))
const hc49BaseGeo = () => geo('hc49-base', () => extrudeUp(stadiumShape(1.16, 0.48), 0.04, 14))

function CrystalBody({ part }: PartProps) {
  const mhz = num(part, 'mhz', 16)
  return (
    <group>
      <Leg x={-0.244} z={0} top={0.03} r={0.02} />
      <Leg x={0.244} z={0} top={0.03} r={0.02} />
      <InkMesh geometry={hc49BaseGeo()} position={[0, 0.01, 0]} color={C.steel} />
      <InkMesh geometry={hc49Geo()} position={[0, 0.05, 0]} color={part.color ?? '#cfd4da'} />
      <Marking text={str(part, 'marking', mhz.toFixed(3))} p={[0, 0.381, 0]} w={0.7} h={0.17} color="#4a4f55" weight={700} />
    </group>
  )
}

export const Resistor = ResistorBody
export const Diode = DiodeBody
export const Zener = ZenerBody
export const Ceramic = CeramicBody
export const Electrolytic = ElectrolyticBody
export const Inductor = InductorBody
export const Thermistor = ThermistorBody
export const Fuse = FuseBody
export const Crystal = CrystalBody
export function ResistorSmd(p: PartProps) {
  return <SmdChip {...p} kind="r" />
}
export function CapacitorSmd(p: PartProps) {
  return <SmdChip {...p} kind="c" />
}
