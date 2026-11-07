// Wires, instruments and board markings.

import * as THREE from 'three'
import { G, geo, lathe } from '../geometry'
import { InkMesh } from '../ink'
import { C, wireColor } from '../palette'
import { MONO, useCanvasTexture } from '../textures'
import { Block, BoxC, CylY, Decal, Marking, Rod, Tube, deg, type Vec3 } from './common'
import { num, str, type PartProps } from './types'

// ───────────── wire ─────────────

function toVec(p: unknown, endY: number): Vec3 | null {
  if (!Array.isArray(p)) return null
  const n = p.map(Number)
  if (n.some((v) => !Number.isFinite(v))) return null
  if (n.length === 2) return [n[0], endY, n[1]]
  if (n.length >= 3) return [n[0], n[1], n[2]]
  return null
}

/** Wire through `params.points` ([x,y,z] or [x,z], relative to `pos`). Two points make a jumper arch. */
function WireBody({ part }: PartProps) {
  const endY = num(part, 'y', 0.02)
  const raw = Array.isArray(part.params?.points) ? (part.params?.points as unknown[]) : []
  const pts = raw.map((p) => toVec(p, endY)).filter((p): p is Vec3 => p !== null)
  const r = num(part, 'radius', 0.045)
  const color = wireColor(part.params?.color ?? part.color, C.wireRed)
  if (pts.length < 2) {
    pts.splice(0, pts.length, [-1, endY, 0], [1, endY, 0])
  }
  let path = pts
  const arch = pts.length === 2 && part.params?.arch !== false
  if (arch) {
    const [a, b] = pts
    const dist = Math.hypot(b[0] - a[0], b[2] - a[2])
    const lift = num(part, 'lift', 0.18 + dist * 0.18)
    const m: Vec3 = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + lift, (a[2] + b[2]) / 2]
    path = [a, [a[0], a[1] + 0.12, a[2]], m, [b[0], b[1] + 0.12, b[2]], b]
  }
  const tips = arch && part.params?.tips !== false
  const first = path[0]
  const last = path[path.length - 1]
  return (
    <group>
      <Tube points={path} r={r} color={color} />
      {tips && <Rod a={first} b={[first[0], first[1] - 0.14, first[2]]} r={r * 0.45} color={C.tin} outline={1} />}
      {tips && <Rod a={last} b={[last[0], last[1] - 0.14, last[2]]} r={r * 0.45} color={C.tin} outline={1} />}
    </group>
  )
}

// ───────────── probe ─────────────

const needleGeo = () =>
  geo('probe-needle', () =>
    lathe(
      [
        [0, 0],
        [0.018, 0.05],
        [0.028, 0.15],
        [0.03, 0.42],
        [0, 0.42],
      ],
      10,
    ),
  )

const handleGeo = () =>
  geo('probe-handle', () =>
    lathe(
      [
        [0, 0.4],
        [0.045, 0.4],
        [0.075, 0.6],
        [0.2, 0.64],
        [0.2, 0.72],
        [0.105, 0.76],
        [0.115, 1.1],
        [0.105, 1.5],
        [0.118, 1.9],
        [0.09, 2.15],
        [0.06, 2.45],
        [0, 2.45],
      ],
      14,
    ),
  )

function ProbeBody({ part }: PartProps) {
  const color = wireColor(part.params?.color ?? part.color, C.wireRed)
  const tilt = num(part, 'tilt', 28)
  return (
    <group rotation={[0, 0, deg(-tilt)]}>
      <InkMesh geometry={needleGeo()} color={C.steel} outline={1.2} />
      <InkMesh geometry={handleGeo()} color={color} />
      <Tube points={[[0, 2.42, 0], [0, 3.0, 0], [0.25, 3.5, -0.35], [0.9, 3.8, -1.2]]} r={0.06} color={color} cacheKey="probe-cable" />
    </group>
  )
}

// ───────────── multimeter ─────────────

const MODES: Record<string, { angle: number; label: string }> = {
  off: { angle: -60, label: 'OFF' },
  V: { angle: -30, label: 'V⎓' },
  VAC: { angle: 0, label: 'V~' },
  R: { angle: 30, label: 'Ω' },
  A: { angle: 60, label: 'A' },
}

function MultimeterBody({ part, state }: PartProps) {
  const reading = state.reading ?? str(part, 'reading', '0.000')
  const unit = state.readingUnit ?? str(part, 'unit', 'V')
  const modeKey = str(part, 'mode', unit === 'Ω' ? 'R' : unit === 'A' ? 'A' : 'V')
  const mode = MODES[modeKey] ?? MODES.V
  const W = 7.4
  const L = 14
  const H = 1.5
  const lcd = useCanvasTexture(
    512,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = C.lcd
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(29,27,23,0.08)'
      ctx.font = `700 ${h * 0.62}px ${MONO}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText('8.8.8.8', w * 0.8, h * 0.52)
      ctx.fillStyle = '#1d1b17'
      ctx.fillText(reading, w * 0.8, h * 0.52)
      ctx.font = `700 ${h * 0.24}px ${MONO}`
      ctx.textAlign = 'left'
      ctx.fillText(unit, w * 0.83, h * 0.62)
      ctx.font = `600 ${h * 0.12}px ${MONO}`
      ctx.fillText(modeKey === 'VAC' ? 'AC' : 'DC', w * 0.05, h * 0.14)
    },
    [reading, unit, modeKey],
  )
  const FW = W - 1.1
  const FL = L - 1.1
  const face = useCanvasTexture(
    480,
    Math.round((480 * FL) / FW),
    (ctx, w, h) => {
      ctx.fillStyle = '#3a3d42'
      ctx.fillRect(0, 0, w, h)
      const s = w / FW
      const cx = w / 2
      const cy = (1.1 + FL / 2) * s
      ctx.fillStyle = '#e9e4d8'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `600 ${0.36 * s}px ${MONO}`
      for (const k of Object.keys(MODES)) {
        const m = MODES[k]
        const a = deg(m.angle) - Math.PI / 2
        ctx.fillStyle = k === modeKey ? '#f2c230' : '#e9e4d8'
        ctx.fillText(m.label, cx + Math.cos(a) * 2.6 * s, cy + Math.sin(a) * 2.6 * s)
      }
      ctx.fillStyle = '#e9e4d8'
      ctx.font = `600 ${0.3 * s}px ${MONO}`
      ;['A', 'COM', 'VΩ'].forEach((l, i) => ctx.fillText(l, cx + (i - 1) * 2.0 * s, (6.15 + FL / 2) * s))
      ctx.font = `700 ${0.3 * s}px ${MONO}`
      ctx.fillText(str(part, 'title', 'BENCH DMM'), cx, (-2.45 + FL / 2) * s)
    },
    [modeKey],
  )
  const jacks: [number, string][] = [
    [-2.0, C.wireRed],
    [0, '#1f1f22'],
    [2.0, C.wireRed],
  ]
  return (
    <group scale={num(part, 'scale', 1)}>
      <InkMesh geometry={G.roundedBox(W, H, L, 0.45)} position={[0, H / 2, 0]} color={part.color ?? C.bumper} />
      <InkMesh geometry={G.roundedBox(W - 1.0, 0.14, L - 1.0, 0.06)} position={[0, H, 0]} color="#3a3d42" />
      <Decal p={[0, H + 0.072, 0]} size={[W - 1.1, L - 1.1]} map={face} />
      <Block p={[0, H + 0.07, -4.1]} s={[5.4, 0.05, 2.9]} color="#24262a" outline={1.2} />
      <Decal p={[0, H + 0.122, -4.1]} size={[5.0, 2.5]} map={lcd} />
      <CylY p={[0, H + 0.07, 1.1]} r={2.05} h={0.25} seg={28} color="#2c2e33" />
      <group position={[0, H + 0.32, 1.1]} rotation={[0, -deg(mode.angle), 0]}>
        <BoxC p={[0, 0.18, 0]} s={[0.7, 0.36, 3.7]} color="#3d4046" />
        <Decal p={[0, 0.362, -1.5]} size={[0.16, 0.5]} color="#f2c230" />
      </group>
      {jacks.map(([x, c]) => (
        <group key={x}>
          <CylY p={[x, H + 0.07, 5.5]} r={0.45} h={0.12} seg={18} color={c} />
          <Decal p={[x, H + 0.192, 5.5]} size={[0.42, 0.42]} round color={C.hole} />
        </group>
      ))}
    </group>
  )
}

// ───────────── markings / test points ─────────────

function LogicIcLabelBody({ part }: PartProps) {
  const text = str(part, 'text', part.label ?? '74HC00')
  const h = num(part, 'size', 0.22)
  const lines = text.split('\n')
  const longest = Math.max(...lines.map((l) => l.length))
  const w = Math.max(h, longest * h * 0.62)
  return (
    <Marking text={text} p={[0, 0.002, 0]} w={w} h={h * lines.length} color={str(part, 'color', C.silk)} px={72} />
  )
}

const loopGeo = () => geo('testpoint-loop', () => new THREE.TorusGeometry(0.075, 0.018, 6, 14, Math.PI))

function TestpointBody({ part }: PartProps) {
  const color = wireColor(part.params?.color ?? part.color, C.wireRed)
  return (
    <group>
      <Rod a={[-0.075, 0.18, 0]} b={[-0.03, -0.05, 0]} r={0.018} color={C.tin} outline={1} />
      <Rod a={[0.075, 0.18, 0]} b={[0.03, -0.05, 0]} r={0.018} color={C.tin} outline={1} />
      <CylY p={[0, 0, 0]} r={0.085} h={0.12} seg={12} color={color} />
      <InkMesh geometry={loopGeo()} position={[0, 0.18, 0]} color={C.tin} outline={1.2} />
      <Decal p={[0, 0.001, 0.2]} size={[0.06, 0.06]} round color={C.silk} />
    </group>
  )
}

export const Wire = WireBody
export const Probe = ProbeBody
export const Multimeter = MultimeterBody
export const LogicIcLabel = LogicIcLabelBody
export const Testpoint = TestpointBody
