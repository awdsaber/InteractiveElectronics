// Power sources: AA holder, 9 V battery, LiPo pouch, and an EI transformer.

import { G } from '../geometry'
import { InkInstances, InkMesh, type InkInstance } from '../ink'
import { C } from '../palette'
import { Block, CylX, Decal, Leg, Marking, Tube } from './common'
import { num, str, type PartProps } from './types'

function AaPackBody({ part }: PartProps) {
  const n = Math.max(1, Math.min(4, Math.round(num(part, 'cells', 2))))
  const pitch = 1.5
  const W = n * pitch + 0.24
  const L = 5.8
  const cy = 0.12 + 0.725
  const wrap = part.color ?? '#2f6d68'
  const zs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * pitch)
  return (
    <group>
      {/* tray */}
      <Block p={[0, 0, 0]} s={[L, 0.12, W]} color={C.black} />
      <Block p={[0, 0, -W / 2 + 0.06]} s={[L, 0.95, 0.12]} color={C.black} />
      <Block p={[0, 0, W / 2 - 0.06]} s={[L, 0.95, 0.12]} color={C.black} />
      <Block p={[-L / 2 + 0.08, 0, 0]} s={[0.16, 1.25, W]} color={C.black} />
      <Block p={[L / 2 - 0.08, 0, 0]} s={[0.16, 1.25, W]} color={C.black} />
      {zs.map((z, i) => {
        const flip = i % 2 === 0 ? 1 : -1
        return (
          <group key={i}>
            <CylX p={[0, cy, z]} r={0.725} l={4.7} seg={20} color={wrap} />
            <CylX p={[flip * 1.4, cy, z]} r={0.73} l={0.7} seg={20} color="#e3c25a" outline={false} />
            <CylX p={[flip * 2.42, cy, z]} r={0.69} l={0.14} seg={20} color={C.steel} />
            <CylX p={[flip * 2.54, cy, z]} r={0.26} l={0.1} seg={12} color={C.steel} outline={1.2} />
            <CylX p={[-flip * 2.42, cy, z]} r={0.7} l={0.14} seg={20} color={C.steel} />
            <Marking text="AA 1.5V" p={[-flip * 0.4, cy + 0.727, z]} w={1.6} h={0.32} color="#f2efe6" spin={flip > 0 ? 0 : Math.PI} />
          </group>
        )
      })}
      <Tube points={[[-L / 2, 0.45, -0.25], [-L / 2 - 0.5, 0.42, -0.3], [-L / 2 - 1.2, 0.06, -0.1]]} r={0.05} color={C.wireRed} />
      <Tube points={[[-L / 2, 0.45, 0.25], [-L / 2 - 0.5, 0.42, 0.3], [-L / 2 - 1.15, 0.06, 0.45]]} r={0.05} color={C.wireBlack} />
    </group>
  )
}

function Battery9vBody({ part }: PartProps) {
  const L = 4.85
  const H = 1.75
  const W = 2.65
  const cy = H / 2
  const color = part.color ?? '#34404f'
  return (
    <group>
      <InkMesh geometry={G.roundedBox(L, H, W, 0.14)} position={[0, cy, 0]} color={color} />
      <InkMesh geometry={G.roundedBox(1.7, H + 0.02, W + 0.02, 0.14)} position={[0.9, cy, 0]} color="#e07a2f" outline={false} />
      <InkMesh geometry={G.roundedBox(0.12, H - 0.1, W - 0.1, 0.05)} position={[-L / 2 + 0.02, cy, 0]} color={C.steel} />
      {/* snaps: round (+) and hex (−) */}
      <CylX p={[-L / 2 - 0.12, cy, -0.5]} r={0.19} l={0.24} seg={14} color={C.steel} />
      <CylX p={[-L / 2 - 0.1, cy, 0.5]} r={0.27} l={0.2} seg={6} color={C.steel} />
      <Decal p={[-L / 2 - 0.201, cy, 0.5]} size={[0.3, 0.3]} facing="-x" round color="#3c4046" />
      <Marking text="9V" p={[0.9, H + 0.012, 0]} w={1.2} h={0.7} color="#fff7ea" weight={700} />
      <Marking text={str(part, 'marking', 'ALKALINE')} p={[-0.8, H + 0.002, 0]} w={2.0} h={0.32} color="#c9d0d8" />
    </group>
  )
}

function LipoBody({ part }: PartProps) {
  const L = 5.0
  const H = 0.6
  const W = 3.4
  return (
    <group>
      <InkMesh geometry={G.roundedBox(L, H, W, 0.12)} position={[0, H / 2, 0]} color={part.color ?? '#3b78bd'} />
      <Block p={[-L / 2 + 0.2, 0.0, 0]} s={[0.42, H + 0.02, W - 0.1]} color="#d9a93f" opacity={0.9} />
      <Marking text={str(part, 'marking', 'Li-Po 3.7V\n1000mAh')} p={[0.35, H + 0.003, 0]} w={2.6} h={1.2} color="#f4f1ea" weight={600} />
      <Tube points={[[-L / 2, 0.3, -0.2], [-L / 2 - 0.5, 0.3, -0.25], [-L / 2 - 1.05, 0.18, -0.08]]} r={0.045} color={C.wireBlack} />
      <Tube points={[[-L / 2, 0.3, 0.2], [-L / 2 - 0.5, 0.3, 0.25], [-L / 2 - 1.05, 0.18, 0.08]]} r={0.045} color={C.wireRed} />
      <Block p={[-L / 2 - 1.3, 0.02, 0]} s={[0.5, 0.32, 0.6]} color={C.white} />
    </group>
  )
}

function TransformerBody({ part }: PartProps) {
  const slabs: InkInstance[] = Array.from({ length: 10 }, (_, i) => ({
    p: [0, 0.15 + 1.25, -1.17 + i * 0.26],
    s: [3.0, 2.5, 0.24],
  }))
  return (
    <group>
      {[
        [-1.0, -0.9],
        [-1.0, 0.9],
        [1.0, -0.9],
        [1.0, 0.9],
      ].map(([x, z], i) => (
        <Leg key={i} x={x} z={z} top={0.16} r={0.035} />
      ))}
      <InkInstances geometry={G.box()} items={slabs} color={part.color ?? '#4d5157'} />
      <Block p={[0, 0.55, 0]} s={[1.5, 1.7, 3.6]} color="#e7c15a" />
      <Block p={[0, 1.15, 0]} s={[1.52, 0.04, 3.62]} color="#c9a13e" outline={false} />
      <Block p={[0, 1.7, 0]} s={[1.52, 0.04, 3.62]} color="#c9a13e" outline={false} />
      <Block p={[-1.53, 0, 0]} s={[0.06, 2.75, 2.7]} color={C.steel} />
      <Block p={[1.53, 0, 0]} s={[0.06, 2.75, 2.7]} color={C.steel} />
      <Block p={[0, 0, 0]} s={[3.1, 0.16, 2.7]} color={C.steel} />
      {str(part, 'marking', '') && <Marking text={str(part, 'marking', '')} p={[0, 1.4, 1.802]} w={1.3} h={0.3} facing="+z" color="#4a3b16" />}
    </group>
  )
}

export const AaPack = AaPackBody
export const Battery9v = Battery9vBody
export const Lipo = LipoBody
export const Transformer = TransformerBody
