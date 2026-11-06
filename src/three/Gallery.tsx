// Dev page (?gallery): every PartKind on a cutting mat, each THT/SMD part on
// its own PCB coupon, plus a small sample board. Click a tile to zoom in;
// use ?gallery&focus=<kind> to open focused on one kind.

import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import type { BoardSpec, PartKind, PartPlacement } from '../engine/types'
import { BenchBase } from './BenchBase'
import { IsoCamera } from './IsoCamera'
import { InkLights } from './ink'
import { ACCENT, INK, PAPER, PCB_SWATCHES } from './palette'
import { ALL_PART_KINDS, partRegistry, type PartRenderState } from './parts'
import { Pcb } from './Pcb'
import { MONO, SERIF, useCanvasTexture } from './textures'
import { G } from './geometry'
import { InkMesh } from './ink'
import { BENCH_Y } from './parts/types'
import { lessonParts } from './galleryLesson'
import { WobbleClock, setWobble } from './wobble'

interface Entry {
  kind: PartKind
  /** tile size [w, d] in board units */
  cell: [number, number]
  mount: PartPlacement['mount']
  params?: Record<string, unknown>
  title?: string
  label?: string
  rot?: number
  color?: string
}

const E = (kind: PartKind, cell: [number, number], mount: PartPlacement['mount'], extra: Partial<Entry> = {}): Entry => ({
  kind,
  cell,
  mount,
  ...extra,
})

const ENTRIES: Entry[] = [
  E('resistor', [1.8, 1.0], 'tht', { params: { ohms: 220 }, title: 'resistor 220 Ω', label: 'R1 220Ω' }),
  E('resistor', [1.8, 1.0], 'tht', { params: { ohms: '4k7', film: 'metal' }, title: 'resistor 4.7 kΩ 1%', label: 'R2 4.7k' }),
  E('resistor-smd', [1.0, 1.0], 'smd', { params: { ohms: 4700, size: '1206' }, title: 'resistor-smd 1206', label: 'R3' }),
  E('resistor-smd', [1.0, 1.0], 'smd', { params: { ohms: 220, size: '0603' }, title: 'resistor-smd 0603' }),
  E('capacitor-ceramic', [1.2, 1.0], 'tht', { title: 'capacitor-ceramic 100 nF', label: 'C1 100n' }),
  E('capacitor-smd', [1.0, 1.0], 'smd', { params: { size: '0805' }, title: 'capacitor-smd 0805' }),
  E('capacitor-electrolytic', [1.3, 1.3], 'tht', { title: 'electrolytic 6.3×11', label: 'C2 100µ' }),
  E('capacitor-electrolytic', [1.6, 1.6], 'tht', { params: { d: 1.0, h: 1.6 }, title: 'electrolytic 10×16' }),
  E('inductor', [1.4, 1.4], 'tht', { title: 'inductor (drum)', label: 'L1' }),
  E('inductor', [1.8, 1.2], 'tht', { params: { style: 'toroid' }, title: 'inductor (toroid)' }),
  E('diode', [1.8, 1.0], 'tht', { title: 'diode 1N4007', label: 'FLYBACK' }),
  E('zener', [1.5, 1.0], 'tht', { title: 'zener (DO-35)' }),
  E('thermistor', [1.0, 1.0], 'tht', { title: 'thermistor (NTC)' }),
  E('fuse', [2.6, 1.2], 'tht', { title: 'fuse 5×20' }),
  E('crystal', [1.6, 1.0], 'tht', { title: 'crystal HC-49/S' }),
  E('led', [1.2, 1.2], 'tht', { params: { color: 'red' }, title: 'led red (glows)', label: 'D1' }),
  E('led', [1.2, 1.2], 'tht', { params: { color: 'green' }, title: 'led green' }),
  E('led-smd', [1.0, 1.0], 'smd', { params: { color: 'blue', size: '1206' }, title: 'led-smd blue' }),
  E('transistor-to92', [1.2, 1.0], 'tht', { title: 'transistor TO-92', label: 'Q1' }),
  E('mosfet-to220', [1.6, 1.2], 'tht', { title: 'mosfet TO-220' }),
  E('regulator-to220', [1.6, 1.2], 'tht', { title: 'regulator TO-220' }),
  E('heatsink', [2.2, 1.8], 'tht', { title: 'heatsink' }),
  E('ic-dip', [1.8, 1.4], 'tht', { params: { pins: 8 }, title: 'ic-dip 8 (555)', label: 'U1' }),
  E('ic-dip', [4.2, 1.4], 'tht', { params: { pins: 28 }, title: 'ic-dip 28' }),
  E('ic-smd', [1.2, 1.2], 'smd', { params: { package: 'SOIC', pins: 8 }, title: 'ic-smd SOIC-8' }),
  E('ic-smd', [1.4, 1.4], 'smd', { params: { package: 'TQFP', pins: 32 }, title: 'ic-smd TQFP-32' }),
  E('ic-smd', [1.2, 1.2], 'smd', { params: { package: 'QFN', pins: 32 }, title: 'ic-smd QFN-32' }),
  E('logic-ic-label', [1.8, 1.0], 'smd', { params: { text: '74HC595' }, title: 'logic-ic-label' }),
  E('testpoint', [1.0, 1.0], 'tht', { params: { color: 'red' }, title: 'testpoint' }),
  E('header-male', [2.6, 1.0], 'tht', { params: { pins: 8 }, title: 'header-male 1×8' }),
  E('header-male', [2.0, 1.2], 'tht', { params: { pins: 6, rows: 2 }, title: 'header-male 2×6' }),
  E('header-female', [2.6, 1.0], 'tht', { params: { pins: 8 }, title: 'header-female 1×8' }),
  E('usb-b', [1.8, 2.4], 'tht', { title: 'usb-b' }),
  E('usb-c', [1.4, 1.6], 'smd', { title: 'usb-c' }),
  E('micro-usb', [1.2, 1.4], 'smd', { title: 'micro-usb' }),
  E('barrel-jack', [1.6, 2.2], 'tht', { title: 'barrel-jack' }),
  E('screw-terminal', [2.0, 1.4], 'tht', { params: { pins: 3 }, title: 'screw-terminal ×3' }),
  E('button', [1.2, 1.2], 'tht', { title: 'button 6×6' }),
  E('switch-slide', [1.4, 1.0], 'tht', { title: 'switch-slide' }),
  E('potentiometer', [1.6, 1.6], 'tht', { title: 'potentiometer' }),
  E('buzzer', [1.6, 1.6], 'tht', { title: 'buzzer' }),
  E('transformer', [4.2, 4.0], 'tht', { title: 'transformer (EI)' }),
  E('battery-aa-pack', [8.0, 3.8], 'offboard', { title: 'battery-aa-pack 2×AA' }),
  E('battery-9v', [6.2, 3.2], 'offboard', { title: 'battery-9v' }),
  E('battery-lipo', [7.4, 4.0], 'offboard', { title: 'battery-lipo' }),
  E('dc-motor', [5.0, 2.6], 'offboard', { title: 'dc-motor (130)' }),
  E('gear-motor-wheel', [9.5, 5.0], 'offboard', { title: 'gear-motor-wheel (TT)' }),
  E('servo', [5.2, 2.4], 'offboard', { title: 'servo (micro)' }),
  E('stepper-nema17', [5.0, 5.0], 'offboard', { title: 'stepper-nema17' }),
  E('breadboard', [9.0, 6.2], 'offboard', { title: 'breadboard (half)' }),
  E('module', [3.8, 2.8], 'module', { params: { w: 3, d: 2, title: 'HX711-ISH', pins: 0, chip: 'soic' }, title: 'module (generic)' }),
  E('module', [6.2, 7.8], 'offboard', { params: { variant: 'uno' }, title: 'module variant=uno' }),
  E('module', [5.4, 2.6], 'offboard', { params: { variant: 'nano' }, title: 'module variant=nano' }),
  E('wifi-module', [2.6, 3.2], 'smd', { title: 'wifi-module' }),
  E('oled', [3.4, 3.6], 'module', { title: 'oled 0.96"' }),
  E('sensor-ultrasonic', [5.4, 2.6], 'tht', { title: 'sensor-ultrasonic' }),
  E('load-cell', [12.0, 3.0], 'offboard', { title: 'load-cell' }),
  E('wire', [3.2, 1.6], 'offboard', { params: { points: [[-1.2, 0.02, 0], [1.2, 0.02, 0]], color: 'yellow' }, title: 'wire (jumper)' }),
  E('probe', [2.4, 2.4], 'offboard', { params: { color: 'red' }, title: 'probe' }),
  E('multimeter', [8.4, 15.0], 'offboard', { params: { reading: '4.98', unit: 'V' }, title: 'multimeter' }),
]

const SAMPLE: BoardSpec = {
  name: 'Fig. 02  LED + resistor',
  size: [7, 4.6],
  traces: [
    [[-2.6, -1.0], [-1.4, -1.0], [-1.0, -0.6], [-0.508, -0.6]],
    [[0.508, -0.6], [1.3, -0.6], [1.3, 0.4], [1.62, 0.4]],
    [[1.88, 0.4], [2.4, 0.4], [2.4, 1.6], [-2.6, 1.6], [-2.6, -0.75]],
    [[-1.0, 1.0], [-0.45, 1.0]],
  ],
  parts: [
    { id: 'J1', kind: 'header-male', pos: [-2.6, -0.875], rot: 90, mount: 'tht', role: '', params: { pins: 2 } },
    { id: 'R1', kind: 'resistor', pos: [0, -0.6], mount: 'tht', role: '', params: { ohms: 220 }, label: '220 Ω' },
    { id: 'D1', kind: 'led', pos: [1.75, 0.4], mount: 'tht', role: '', params: { color: 'red' }, label: 'LED' },
    { id: 'C1', kind: 'capacitor-smd', pos: [-0.7, 1.0], mount: 'smd', role: '' },
    { id: 'SW1', kind: 'button', pos: [0.4, 1.0], mount: 'tht', role: '' },
    { id: 'U1', kind: 'ic-smd', pos: [-1.6, 0.35], rot: 90, mount: 'smd', role: '', params: { package: 'SOIC', pins: 8 } },
  ],
}

interface Placed {
  entry: Entry
  key: string
  x: number
  z: number
}

function layout(entries: Entry[], maxW: number, gap: number) {
  const placed: Placed[] = []
  let x = 0
  let z = 0
  let rowD = 0
  let width = 0
  entries.forEach((e, i) => {
    const [w, d] = e.cell
    if (x > 0 && x + w > maxW) {
      x = 0
      z += rowD + gap + 0.6
      rowD = 0
    }
    placed.push({ entry: e, key: `${e.kind}-${i}`, x: x + w / 2, z: z + d / 2 })
    x += w + gap
    rowD = Math.max(rowD, d)
    width = Math.max(width, x - gap)
  })
  return { placed, width, depth: z + rowD }
}

function stateFor(e: Entry, s: GalleryControls): PartRenderState {
  const value =
    e.kind === 'servo' ? s.value * 180 : e.kind === 'button' || e.kind === 'switch-slide' ? (s.value > 0.5 ? 1 : 0) : s.value
  return {
    visible: true,
    soldered: s.soldered,
    glow: s.glow,
    burnt: s.burnt,
    explodedOffset: s.exploded * (e.mount === 'smd' ? 0.6 : e.mount === 'tht' ? 1.2 : 1.8),
    showLabel: s.labels,
    rpm: s.rpm,
    value,
  }
}

interface GalleryControls {
  wobble: number
  glow: number
  soldered: boolean
  burnt: boolean
  labels: boolean
  exploded: number
  rpm: number
  value: number
  swatch: number
}

function Tile({ p, s }: { p: Placed; s: GalleryControls }) {
  const { entry: e } = p
  const Comp = partRegistry[e.kind]
  const part = useMemo<PartPlacement>(
    () => ({
      id: e.label?.split(' ')[0] ?? e.kind.toUpperCase().slice(0, 4),
      kind: e.kind,
      pos: [0, 0],
      rot: e.rot,
      mount: e.mount,
      role: e.title ?? e.kind,
      label: e.label ?? e.kind,
      params: e.params,
      color: e.color,
    }),
    [e],
  )
  const coupon = e.mount === 'tht' || e.mount === 'smd' || (e.mount === 'module' && e.kind !== 'module')
  const spec = useMemo<BoardSpec>(() => ({ name: '', size: [e.cell[0] - 0.2, e.cell[1] - 0.2], parts: [part] }), [e, part])
  return (
    <group position={[p.x, 0, p.z]}>
      {coupon && <Pcb spec={spec} color={PCB_SWATCHES[s.swatch]} silk={false} />}
      <Comp part={part} state={stateFor(e, s)} />
    </group>
  )
}

/** All tile captions printed on the mat in one texture (one draw, no DOM). */
function LabelSheet({ placed, w, d }: { placed: Placed[]; w: number; d: number }) {
  const ppu = Math.min(56, 2048 / Math.max(w, d))
  const tex = useCanvasTexture(
    w * ppu,
    d * ppu,
    (ctx, W) => {
      const k = W / w
      ctx.fillStyle = '#e4eee6'
      ctx.font = `600 ${0.3 * k}px ${MONO}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const p of placed) ctx.fillText(p.entry.title ?? p.entry.kind, (p.x + 0) * k, (p.z + p.entry.cell[1] / 2 + 0.32) * k)
    },
    [placed, w, d],
  )
  return (
    <InkMesh
      geometry={G.planeY()}
      position={[w / 2, BENCH_Y + 0.004, d / 2]}
      scale={[w, 1, d]}
      color="#ffffff"
      map={tex}
      unlit
      decal
      alphaTest={0.05}
      outline={false}
      noChar
    />
  )
}

/** Draw-call counter (dev page): reads renderer.info after each frame. */
function DrawStats({ onCalls }: { onCalls: (n: number) => void }) {
  const last = useRef(0)
  useFrame(({ gl }) => {
    const now = performance.now()
    if (now - last.current < 500) return
    last.current = now
    onCalls(gl.info.render.calls)
  })
  return null
}

export default function Gallery() {
  const q = new URLSearchParams(location.search)
  const [s, setS] = useState<GalleryControls>(() => ({
    wobble: Number(q.get('wobble') ?? 0.35),
    glow: 0.8,
    soldered: true,
    burnt: q.has('burnt'),
    labels: q.has('labels'),
    exploded: Number(q.get('exploded') ?? 0),
    rpm: 60,
    value: 0.5,
    swatch: 0,
  }))
  setWobble(s.wobble)
  const { placed, width, depth } = useMemo(() => layout(ENTRIES, 34, 0.7), [])
  const sampleW = SAMPLE.size[0]
  const offX = -width / 2
  const offZ = -depth / 2 + 3.5
  const params = new URLSearchParams(location.search)
  const initialFocus = params.get('focus')
  const [focus, setFocus] = useState<string | null>(() => {
    const hit = placed.find((p) => p.key === initialFocus) ?? placed.find((p) => p.entry.kind === initialFocus)
    return hit ? hit.key : null
  })
  const fp = placed.find((p) => p.key === focus)
  const target: [number, number, number] = fp ? [fp.x + offX, 0.4, fp.z + offZ] : [0, 0, 0]
  const fit = Math.min(window.innerWidth / ((width + depth) * 0.74), window.innerHeight / ((width + depth) * 0.45))
  const lesson = q.has('lesson')
  const zoom = lesson ? window.innerWidth / 27 : fp ? Math.min(260, 900 / Math.max(fp.entry.cell[0], fp.entry.cell[1], 2.2)) : fit
  const covered = new Set(ENTRIES.map((e) => e.kind))
  const missing = ALL_PART_KINDS.filter((k) => !covered.has(k))
  const set = <K extends keyof GalleryControls>(k: K, v: GalleryControls[K]) => setS((o) => ({ ...o, [k]: v }))
  const [calls, setCalls] = useState(0)
  const lessonList = useMemo(() => lessonParts(), [])
  return (
    <div style={page}>
      <Canvas flat dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ position: 'absolute', inset: 0 }}>
        <InkLights />
        <WobbleClock />
        <IsoCamera zoom={zoom} target={target} pan minZoom={fit * 0.6} maxZoom={300} resetKey={focus} distance={80} />
        <DrawStats onCalls={setCalls} />
        {lesson ? (
          <>
            <BenchBase size={[24, 14]} />
            {lessonList.map((p) => {
              const Comp = partRegistry[p.kind]
              return (
                <Comp
                  key={p.id}
                  part={p}
                  state={{ visible: true, soldered: false, glow: p.kind === 'led' || p.kind === 'module' ? s.glow : 0, burnt: false, explodedOffset: 0, showLabel: s.labels }}
                />
              )
            })}
          </>
        ) : (
          <>
            <BenchBase size={[width + 4, depth + 12]} center={[0, 3]} />
            <group position={[-sampleW / 2 - 6, 0, offZ - 5.6]}>
              <Pcb spec={SAMPLE} color={PCB_SWATCHES[s.swatch]} />
              {SAMPLE.parts.map((p) => {
                const Comp = partRegistry[p.kind]
                return (
                  <Comp
                    key={p.id}
                    part={p}
                    state={{
                      visible: true,
                      soldered: s.soldered,
                      glow: s.glow,
                      burnt: s.burnt && p.id === 'D1',
                      explodedOffset: s.exploded * (p.mount === 'smd' ? 0.6 : 1.2),
                      showLabel: s.labels,
                    }}
                  />
                )
              })}
            </group>
            <group position={[offX, 0, offZ]}>
              {placed.map((p) => (
                <group
                  key={p.key}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    setFocus((f) => (f === p.key ? null : p.key))
                  }}
                >
                  <Tile p={p} s={s} />
                </group>
              ))}
            </group>
            <group position={[offX, 0, offZ]}>
              <LabelSheet placed={placed} w={width} d={depth + 1} />
            </group>
          </>
        )}
      </Canvas>

      <div style={panel}>
        <div style={{ font: `600 22px/1.1 ${SERIF}`, marginBottom: 2 }}>Part library</div>
        <div style={{ font: `500 10.5px/1.4 ${MONO}`, opacity: 0.7, marginBottom: 10 }}>
          {ALL_PART_KINDS.length} kinds · {calls} draw calls · click a tile to zoom · drag to orbit
          {missing.length > 0 && <span style={{ color: '#d9480f' }}> · missing: {missing.join(', ')}</span>}
        </div>
        <Slider label="ink wobble" value={s.wobble} onChange={(v) => set('wobble', v)} />
        <Slider label="glow" value={s.glow} onChange={(v) => set('glow', v)} />
        <Slider label="exploded" value={s.exploded} onChange={(v) => set('exploded', v)} />
        <Slider label="rpm" value={s.rpm / 300} onChange={(v) => set('rpm', Math.round(v * 300))} />
        <Slider label="value" value={s.value} onChange={(v) => set('value', v)} />
        <div style={{ display: 'flex', gap: 10, margin: '6px 0' }}>
          <Check label="soldered" value={s.soldered} onChange={(v) => set('soldered', v)} />
          <Check label="burnt" value={s.burnt} onChange={(v) => set('burnt', v)} />
          <Check label="labels" value={s.labels} onChange={(v) => set('labels', v)} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {PCB_SWATCHES.map((c, i) => (
            <button
              key={c}
              aria-label={`pcb colour ${i + 1}`}
              onClick={() => set('swatch', i)}
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: c,
                border: `2px solid ${i === s.swatch ? INK : 'transparent'}`,
                outline: `1px solid ${INK}`,
                cursor: 'pointer',
              }}
            />
          ))}
          {focus && (
            <button onClick={() => setFocus(null)} style={btn}>
              overview
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: `500 11px ${MONO}`, margin: '3px 0' }}>
      <span style={{ width: 72 }}>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: ACCENT, width: 130 }}
      />
    </label>
  )
}

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4, font: `500 11px ${MONO}` }}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: ACCENT }} />
      {label}
    </label>
  )
}

const page: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: PAPER,
  backgroundImage: 'radial-gradient(rgba(29,27,23,0.16) 1px, transparent 1px)',
  backgroundSize: '18px 18px',
  color: INK,
}

const panel: CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 16,
  maxWidth: 'calc(100vw - 32px)',
  background: 'rgba(255,255,255,0.94)',
  border: `1.5px solid ${INK}`,
  boxShadow: `3px 3px 0 ${INK}`,
  borderRadius: 8,
  padding: '12px 14px',
  boxSizing: 'border-box',
}

const btn: CSSProperties = {
  marginLeft: 8,
  font: `600 10.5px ${MONO}`,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  border: `1.5px solid ${INK}`,
  borderRadius: 999,
  background: '#fff',
  padding: '2px 10px',
  cursor: 'pointer',
}
