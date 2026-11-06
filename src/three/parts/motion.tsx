// Motion parts: brushed DC motor, TT gear motor with wheel, micro servo,
// NEMA 17 stepper. Shafts spin from state.rpm (live) or params.rpm.

import { useRef } from 'react'
import * as THREE from 'three'
import type { Group } from 'three'
import { G, chamferRectShape, extrudeAlongX, extrudeUp, flattedCircleShape, geo } from '../geometry'
import { InkInstances, InkMesh, type InkInstance } from '../ink'
import { C } from '../palette'
import { Block, BoxC, CylX, CylY, CylZ, Decal, Marking, Tube, deg, useSpin } from './common'
import { num, str, type PartProps } from './types'

const rpmOf = (p: PartProps) => p.state.rpm ?? num(p.part, 'rpm', 0)

// ───────────── DC motor (130 size) ─────────────

const canGeo = () => geo('motor130-can', () => extrudeAlongX(flattedCircleShape(1.0, 0.755), 2.5, 24))
const capGeo = () => geo('motor130-cap', () => extrudeAlongX(flattedCircleShape(0.96, 0.73), 0.35, 24))

function DcMotorBody(props: PartProps) {
  const { part } = props
  const shaft = useRef<Group>(null)
  useSpin(shaft, rpmOf(props), 'x')
  const cy = 0.755
  return (
    <group>
      <InkMesh geometry={canGeo()} position={[0, cy, 0]} color={part.color ?? C.tin} />
      <InkMesh geometry={capGeo()} position={[1.42, cy, 0]} color={str(part, 'cap', '#ebe6d8')} />
      <Block p={[1.62, cy + 0.2, -0.42]} s={[0.05, 0.32, 0.16]} color={C.brass} outline={1.2} />
      <Block p={[1.62, cy + 0.2, 0.42]} s={[0.05, 0.32, 0.16]} color={C.brass} outline={1.2} />
      <Decal p={[1.601, cy + 0.36, -0.42]} size={[0.07, 0.07]} facing="+x" round color={C.hole} />
      <Decal p={[1.601, cy + 0.36, 0.42]} size={[0.07, 0.07]} facing="+x" round color={C.hole} />
      <CylX p={[-1.31, cy, 0]} r={0.32} l={0.12} seg={18} color={C.steel} />
      {[-0.55, 0.55].map((z) => (
        <Decal key={z} p={[-1.251, cy + 0.15, z]} size={[0.16, 0.3]} facing="-x" color="#4a4f55" />
      ))}
      <group ref={shaft} position={[-1.37, cy, 0]}>
        <CylX p={[-0.45, 0, 0]} r={0.1} l={0.9} seg={10} color={C.steel} />
        {/* a little paddle so the spin reads */}
        <BoxC p={[-0.82, 0, 0]} s={[0.08, 0.7, 0.14]} color={str(part, 'flag', '#d9480f')} />
        <BoxC p={[-0.82, 0, 0]} s={[0.1, 0.16, 0.16]} color={C.white} />
      </group>
    </group>
  )
}

// ───────────── TT gear motor + wheel ─────────────

const treadItems: InkInstance[] = Array.from({ length: 30 }, (_, i) => {
  const a = (i / 30) * Math.PI * 2
  return { p: [Math.cos(a) * 3.3, Math.sin(a) * 3.3, 0], r: [0, 0, a], s: [0.12, 0.3, 2.3] }
})

const spokeItems: InkInstance[] = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2
  return { p: [Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0], r: [0, 0, a], s: [1.6, 0.32, 0.12] }
})

function GearMotorWheelBody(props: PartProps) {
  const { part } = props
  const wheel = useRef<Group>(null)
  useSpin(wheel, -rpmOf(props), 'z')
  const R = 3.3
  const ay = R
  const yellow = part.color ?? C.ttYellow
  return (
    <group>
      {/* gearbox and motor */}
      <Block p={[-0.95, ay - 1.12, -0.95]} s={[3.7, 2.25, 1.9]} color={yellow} />
      <InkMesh geometry={canGeo()} position={[-3.9, ay - 0.1, -0.95]} scale={[0.85, 1, 1]} color={C.tin} />
      <InkMesh geometry={capGeo()} position={[-5.1, ay - 0.1, -0.95]} color="#ebe6d8" />
      {[-2.2, 0.3].map((x) => (
        <Decal key={x} p={[x, ay - 0.4, 0.002]} size={[0.22, 0.22]} facing="+z" round color="#7a6420" />
      ))}
      <Marking text={str(part, 'marking', '1:48')} p={[-1.4, ay + 1.131, -0.95]} w={1.0} h={0.35} color="#7a6420" />
      <CylZ p={[0, ay, 0.12]} r={0.3} l={0.3} seg={10} color={C.white} />
      {/* wheel */}
      <group ref={wheel} position={[0, ay, 1.45]}>
        <CylZ p={[0, 0, 0]} r={R - 0.12} l={2.6} seg={32} color={C.rubber} />
        <InkInstances geometry={G.box()} items={treadItems} color="#3a3a3d" outline={1} />
        <CylZ p={[0, 0, 0.02]} r={2.2} l={2.62} seg={28} color={yellow} />
        <CylZ p={[0, 0, 1.34]} r={1.9} l={0.02} seg={28} color="#7a6420" outline={false} />
        <InkInstances geometry={G.box()} items={spokeItems} position={[0, 0, 1.4]} color={yellow} outline={1.2} />
        <CylZ p={[0, 0, 1.4]} r={0.55} l={0.25} seg={16} color={yellow} />
        <Decal p={[0, 0, 1.526]} size={[0.3, 0.3]} facing="+z" round color={C.hole} />
      </group>
    </group>
  )
}

// ───────────── micro servo ─────────────

const hornGeo = () =>
  geo('servo-horn', () => {
    const s = new THREE.Shape()
    s.moveTo(-0.85, -0.12)
    s.quadraticCurveTo(-0.95, 0, -0.85, 0.12)
    s.lineTo(-0.2, 0.26)
    s.quadraticCurveTo(0, 0.32, 0.2, 0.26)
    s.lineTo(0.85, 0.12)
    s.quadraticCurveTo(0.95, 0, 0.85, -0.12)
    s.lineTo(0.2, -0.26)
    s.quadraticCurveTo(0, -0.32, -0.2, -0.26)
    s.lineTo(-0.85, -0.12)
    return extrudeUp(s, 0.14, 8)
  })

function ServoBody({ part, state }: PartProps) {
  const color = part.color ?? C.servoBlue
  const angle = state.value ?? num(part, 'angle', 90)
  const ox = 0.55
  const top = 2.27
  return (
    <group>
      <Block p={[0, 0, 0]} s={[2.22, 1.6, 1.18]} color={color} />
      <Block p={[0, 1.6, 0]} s={[3.2, 0.25, 1.18]} color={color} />
      <Block p={[0, 1.85, 0]} s={[2.22, 0.42, 1.18]} color={color} />
      {[-1.4, 1.4].map((x) => (
        <Decal key={x} p={[x, 1.852, 0]} size={[0.2, 0.2]} round color={C.hole} />
      ))}
      <CylY p={[ox, top, 0]} r={0.58} h={0.14} seg={20} color={color} />
      <CylY p={[ox - 0.55, top, 0]} r={0.28} h={0.08} seg={14} color={color} />
      <CylY p={[ox, top + 0.14, 0]} r={0.22} h={0.18} seg={12} color={C.white} />
      <group position={[ox, top + 0.3, 0]} rotation={[0, deg(angle - 90), 0]}>
        <InkMesh geometry={hornGeo()} color={C.white} />
        {[-0.7, -0.5, 0.5, 0.7].map((x) => (
          <Decal key={x} p={[x, 0.142, 0]} size={[0.07, 0.07]} round color="#8a867c" />
        ))}
        <Decal p={[0, 0.142, 0]} size={[0.16, 0.16]} round color="#6a675f" />
      </group>
      <Marking text={str(part, 'marking', 'MICRO SERVO 9g')} p={[0, 0.95, 0.592]} w={1.8} h={0.28} facing="+z" color="#e6ecf6" />
      <Tube points={[[-1.11, 0.25, -0.12], [-1.6, 0.2, -0.15], [-2.5, 0.06, -0.3]]} r={0.04} color={C.wireBrown} />
      <Tube points={[[-1.11, 0.25, 0], [-1.6, 0.2, 0], [-2.5, 0.06, -0.05]]} r={0.04} color={C.wireRed} />
      <Tube points={[[-1.11, 0.25, 0.12], [-1.6, 0.2, 0.15], [-2.5, 0.06, 0.2]]} r={0.04} color={C.wireOrange} />
    </group>
  )
}

// ───────────── NEMA 17 stepper ─────────────

const nemaCapGeo = () => geo('nema17-cap', () => extrudeUp(chamferRectShape(4.23, 4.23, 0.45), 0.8, 2))
const nemaSlabGeo = () => geo('nema17-slab', () => extrudeUp(chamferRectShape(4.13, 4.13, 0.42), 0.36, 2))

function StepperBody(props: PartProps) {
  const { part } = props
  const shaft = useRef<Group>(null)
  useSpin(shaft, rpmOf(props), 'y')
  const slabs: InkInstance[] = Array.from({ length: 6 }, (_, i) => ({ p: [0, 0.82 + i * 0.4, 0] }))
  const top = 4.0
  return (
    <group>
      <InkMesh geometry={nemaCapGeo()} color={C.charcoal} />
      <InkInstances geometry={nemaSlabGeo()} items={slabs} color={part.color ?? '#8f979f'} />
      <InkMesh geometry={nemaCapGeo()} position={[0, 3.2, 0]} color={C.charcoal} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Decal key={`${sx}${sz}`} p={[sx * 1.55, top + 0.002, sz * 1.55]} size={[0.3, 0.3]} round color={C.hole} />
        )),
      )}
      <CylY p={[0, top, 0]} r={1.1} h={0.2} seg={24} color={C.alu} />
      <Marking text={str(part, 'marking', 'NEMA 17')} p={[0, top + 0.002, 1.65]} w={1.6} h={0.3} color="#8d9298" />
      <group ref={shaft} position={[0, top + 0.2, 0]}>
        <CylY p={[0, 0, 0]} r={0.25} h={2.0} seg={12} color={C.steel} />
        <CylY p={[0, 1.1, 0]} r={0.62} h={0.1} seg={20} color={C.alu} />
        <CylY p={[0, 1.2, 0]} r={0.5} h={0.5} seg={20} color={C.alu} />
        <CylY p={[0, 1.7, 0]} r={0.62} h={0.1} seg={20} color={C.alu} />
        <Decal p={[0, 1.45, 0.503]} size={[0.14, 0.14]} facing="+z" round color={C.hole} />
        <Block p={[0, 1.8, 0.18]} s={[0.2, 0.2, 0.06]} color="#6b7178" outline={1} />
      </group>
      <Block p={[0, 0.12, 2.12]} s={[1.1, 0.45, 0.3]} color={C.white} />
      <Decal p={[0, 0.34, 2.271]} size={[0.9, 0.2]} facing="+z" color="#4a4740" />
    </group>
  )
}

export const DcMotor = DcMotorBody
export const GearMotorWheel = GearMotorWheelBody
export const Servo = ServoBody
export const Stepper = StepperBody
