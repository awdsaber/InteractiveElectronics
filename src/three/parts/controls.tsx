// User controls and annunciators: tactile button, slide switch, pot, buzzer.

import { G } from '../geometry'
import { InkMesh } from '../ink'
import { C } from '../palette'
import { Block, CylY, Decal, LeadPath, Leg, SPINS, deg } from './common'
import { bool, num, type PartProps } from './types'

function ButtonBody({ part, state }: PartProps) {
  const pressed = (state.value ?? (bool(part, 'pressed', false) ? 1 : 0)) > 0.5
  const capColor = part.color ?? C.black
  const legs: [number, number][] = [
    [-0.325, -0.225],
    [0.325, -0.225],
    [-0.325, 0.225],
    [0.325, 0.225],
  ]
  return (
    <group>
      {legs.map(([x, z], i) => (
        <LeadPath key={i} points={[[Math.sign(x) * 0.29, 0.1, z], [x, 0.06, z], [x, -0.05, z]]} r={0.022} />
      ))}
      <Block p={[0, 0.02, 0]} s={[0.6, 0.33, 0.6]} color={C.black} />
      <Block p={[0, 0.35, 0]} s={[0.6, 0.02, 0.6]} color={C.steel} outline={1.2} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <InkMesh key={`${sx}${sz}`} geometry={G.discY(10)} position={[sx * 0.22, 0.372, sz * 0.22]} scale={0.035} color="#3f4448" unlit decal outline={false} />
        )),
      )}
      <CylY p={[0, 0.37, 0]} r={0.175} h={pressed ? 0.05 : 0.14} seg={18} color={capColor} />
    </group>
  )
}

function SwitchSlideBody({ part, state }: PartProps) {
  const on = (state.value ?? (bool(part, 'on', false) ? 1 : 0)) > 0.5
  return (
    <group>
      {[-1, 0, 1].map((i) => (
        <Leg key={i} x={i * 0.254} z={0} top={0.04} square r={0.02} />
      ))}
      <Leg x={-0.43} z={0} top={0.06} square r={0.03} />
      <Leg x={0.43} z={0} top={0.06} square r={0.03} />
      <Block p={[0, 0.02, 0]} s={[0.86, 0.16, 0.36]} color={C.black} />
      <Block p={[0, 0.18, 0]} s={[0.86, 0.2, 0.36]} color={part.color ?? C.tin} />
      <Block p={[0, 0.38, 0]} s={[0.4, 0.005, 0.12]} color={C.hole} unlit decal outline={false} />
      <Block p={[on ? 0.1 : -0.1, 0.36, 0]} s={[0.16, 0.36, 0.13]} color={C.black} />
    </group>
  )
}

function PotentiometerBody({ part, state }: PartProps) {
  // params.endless: a rotary encoder's knob, turning freely (value 0..1 = one turn) with a knurled cap
  const endless = bool(part, 'endless', false)
  const raw = state.value ?? num(part, 'value', endless ? 0 : 0.5)
  const v = endless ? raw - Math.floor(raw) : Math.min(1, Math.max(0, raw))
  const angle = endless ? deg(-v * 360) : deg(135 - v * 270)
  const knob = part.color ?? '#33302c'
  return (
    <group>
      {[-1, 0, 1].map((i) => (
        <LeadPath key={i} points={[[i * 0.25, 0.08, 0.3], [i * 0.25, 0.08, 0.4], [i * 0.25, -0.05, 0.4]]} r={0.02} />
      ))}
      <Leg x={-0.48} z={-0.3} top={0.05} square r={0.035} />
      <Leg x={0.48} z={-0.3} top={0.05} square r={0.035} />
      <Block p={[0, 0.02, 0]} s={[0.98, 0.55, 0.78]} color={endless ? '#2b2d30' : '#2f4f8f'} />
      <CylY p={[0, 0.57, 0]} r={0.3} h={0.16} seg={18} color={C.steel} />
      <group position={[0, 0.73, 0]} rotation={[0, angle, 0]} userData={SPINS}>
        <CylY p={[0, 0, 0]} r={0.29} h={0.5} seg={endless ? 20 : 14} color={knob} />
        <Decal p={[0, 0.502, -0.13]} size={[0.05, 0.22]} color={C.white} />
        {endless && <Decal p={[0, 0.503, 0]} size={[0.34, 0.34]} round color="#55504a" />}
      </group>
      <Decal p={[0, 0.571, 0]} size={[0.9, 0.9]} round color={endless ? '#3f4448' : '#3c5d9c'} />
    </group>
  )
}

function BuzzerBody({ part }: PartProps) {
  const r = 0.6
  const h = 0.95
  return (
    <group>
      <Leg x={-0.38} z={0} top={0.05} />
      <Leg x={0.38} z={0} top={0.05} />
      <CylY p={[0, 0.02, 0]} r={r} h={0.12} seg={24} color="#1f1f21" />
      <CylY p={[0, 0.14, 0]} r={r} h={h - 0.14} seg={24} color={part.color ?? C.black} />
      <Decal p={[0, h + 0.002, 0]} size={[0.2, 0.2]} round color={C.hole} />
      <Decal p={[-0.36, h + 0.002, -0.05]} size={[0.14, 0.035]} color={C.silk} />
      <Decal p={[-0.36, h + 0.002, -0.05]} size={[0.14, 0.035]} spin={Math.PI / 2} color={C.silk} />
      <Decal p={[0, h + 0.0015, 0]} size={[1.0, 1.0]} round color="#2a2a2d" />
    </group>
  )
}

export const Button = ButtonBody
export const SwitchSlide = SwitchSlideBody
export const Potentiometer = PotentiometerBody
export const Buzzer = BuzzerBody
