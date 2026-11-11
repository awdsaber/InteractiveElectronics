// Composes a lesson's BoardSpec on the bench: cutting mat, PCB (unless breadboard-only) and
// every part, with PartRenderState derived from the bench snapshot. Placement drops parts in
// (250 ms ease from y + 3, staggered); the exploded view lifts mount layers apart.

import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Group } from 'three'
import type { BenchSnapshot } from '../engine/bench/simLoop'
import type { BoardDynamic, Lesson, PartPlacement } from '../engine/types'
import { dynamicPose, easePose, ridesOnBody, type Pose } from './dynamicPose'
import { PALETTES, type Settings } from '../ui/types'
import { BenchBase } from './BenchBase'
import { Callout, type CalloutTone } from './Callout'
import { PartHighlight } from './Highlight'
import { partPosition, partRegistry, type PartRenderState } from './parts'
import { matFrame } from './autoFrame'
import { calloutOffset, partHeight } from './parts/frame'
import { Pcb } from './Pcb'
import { PcbLayers } from './PcbLayers'
import { tourState } from './pcbTour'
import { partsLift } from '../engine/pcb/layers'
import { rgbGlow } from './rgbGlow'

const DROP_H = 3
const DROP_MS = 250
const STAGGER_MS = 55
const LIFT = 1.1

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)

/** exploded-view layer per part: PCB, then SMD, then THT, then modules / off-board parts */
export function explodeLayer(p: PartPlacement, breadboard: boolean): number {
  if (breadboard) {
    // no PCB: the breadboard is the base, then the board module, the parts, the wires on top
    if (p.kind === 'breadboard') return 0
    if (p.mount === 'module') return 1
    if (p.kind === 'wire') return 3
    return 2
  }
  return p.mount === 'smd' ? 1 : p.mount === 'tht' ? 2 : 3
}

const LED_KINDS = new Set(['led', 'led-smd'])
const MOTOR_KINDS = new Set(['dc-motor', 'gear-motor-wheel', 'stepper-nema17'])

/** Live render state of one part (pure, so it is testable without WebGL). */
export function partState(lesson: Lesson, p: PartPlacement, snap: BenchSnapshot): PartRenderState {
  const cid = p.circuitIds?.[0]
  const placed = snap.partVisible[p.id] ?? snap.assembly.placed.includes(p.id)
  const breadboard = lesson.board.base === 'breadboard-only'
  let glow = 0
  if (LED_KINDS.has(p.kind) && cid) glow = Math.min(1.5, Math.max(0, (snap.current[cid] ?? 0) / 0.02))
  else if ((p.kind === 'module' || p.kind === 'oled' || p.kind === 'wifi-module') && snap.assembly.powered[lesson.powerElementId]) glow = 1
  // addressable RGB LEDs glow in the colour their behavior publishes. The colour rides in the
  // render state, not params, so it stays out of the bake key and never rebakes the part.
  const rgb = rgbGlow(p, snap.published)
  if (rgb) glow = rgb.glow
  // a resistor with a thermal rating (rth/tMax) publishes `<id>.tj`: its body glows orange from
  // 70 °C (barely warm) to full at 155 °C (the 1/4 W carbon-film limit)
  const tj = p.kind === 'resistor' && cid ? snap.extra[`${cid}.tj`] : undefined
  if (tj !== undefined) glow = Math.min(1, Math.max(0, (tj - 42) / 98))
  const s: PartRenderState = {
    visible: placed,
    soldered: !breadboard && snap.assembly.soldered && (p.mount === 'tht' || p.mount === 'smd'),
    glow: glow < 0.01 ? 0 : glow,
    burnt: !!snap.partBurnt[p.id],
    explodedOffset: 0,
    // labels are drawn by the Board (always mounted, see Callout `hidden`)
    showLabel: false,
  }
  // a hand-soldered joint (`solder-joints` behavior): params.jointKey names its published quality
  if (s.soldered && typeof p.params?.jointKey === 'string') {
    const q = snap.published[p.params.jointKey]
    if (q !== undefined) s.joint = Math.round(q)
  }
  if (rgb?.color) s.glowColor = rgb.color
  else if (tj !== undefined) s.glowColor = '#ff6a1f'
  // a button a failure holds down (e.g. BOOT held at power-up): params.pressedWhen = failure id
  if (p.kind === 'button' && typeof p.params?.pressedWhen === 'string') s.value = snap.assembly.failures.includes(p.params.pressedWhen) ? 1 : 0
  // a push button that is a switch element in the circuit shows pressed while the element is closed
  if (p.kind === 'button' && cid && typeof p.params?.pressedWhen !== 'string') {
    const closed = snap.elementValues[`${cid}.closed`]
    if (closed !== undefined) s.value = closed
  }
  if (cid && MOTOR_KINDS.has(p.kind)) s.rpm = snap.extra[`${cid}.rpm`] ?? 0
  // a stepper driven by a behavior: params.angleKey / rpmKey name published values (shaft degrees, rpm)
  if (p.kind === 'stepper-nema17') {
    const ak = p.params?.angleKey
    const rk = p.params?.rpmKey
    if (typeof ak === 'string') s.value = snap.published[ak] ?? 0
    if (typeof rk === 'string') s.rpm = snap.published[rk] ?? 0
  }
  // a servo on a driver chip (PCA9685) follows the horn angle its behavior publishes
  if (p.kind === 'servo' && typeof p.params?.angleKey === 'string') {
    const a = snap.published[p.params.angleKey]
    s.value = a ?? (typeof p.params.angle === 'number' ? p.params.angle : 90)
  } else if (p.kind === 'servo') {
    const pin = lesson.circuit.elements.find((e) => p.circuitIds?.includes(e.id) && e.type === 'PIN')
    if (pin && pin.type === 'PIN') s.value = snap.pins[pin.pin]?.servoDeg ?? 90
  }
  if (p.kind === 'potentiometer' && cid) s.value = snap.elementValues[`${cid}.pos`] ?? 0.5
  // a knob a behavior turns (a rotary encoder): params.valueKey names a published 0..1 value
  if (p.kind === 'potentiometer' && typeof p.params?.valueKey === 'string') s.value = snap.published[p.params.valueKey] ?? 0
  // a slide switch that is the lesson's power element sits on while the bench is powered
  if (p.kind === 'switch-slide' && cid && cid === lesson.powerElementId) s.value = snap.assembly.powered[cid] ? 1 : 0
  if (p.kind === 'multimeter') {
    const i = typeof p.params?.readout === 'number' ? p.params.readout : 0
    s.reading = snap.readouts[i]?.value.split(' ')[0] ?? '----'
    // the LCD shows the readout's own SI unit (mV, mA, kΩ…) unless a lesson opts out with autoUnit:false.
    // A bare number under a fixed unit was 1000× wrong in three lessons, so this is the default.
    if (p.params?.autoUnit !== false) s.readingUnit = snap.readouts[i]?.value.split(' ')[1] ?? ''
  }
  return s
}

/** Params that follow the simulation: resistor bands follow its value, the Uno's L LED follows pin 13. */
export function liveParams(p: PartPlacement, snap: BenchSnapshot): PartPlacement {
  const cid = p.circuitIds?.[0]
  if (p.kind === 'resistor' && cid) {
    const ohms = snap.elementValues[`${cid}.value`]
    if (ohms !== undefined && ohms !== p.params?.ohms) return { ...p, params: { ...p.params, ohms: +ohms.toPrecision(3) } }
  }
  // an AA pack follows its source: one cell per 1.5 V (a tweak that adds cells adds cells)
  if (p.kind === 'battery-aa-pack' && cid) {
    const v = snap.elementValues[`${cid}.value`]
    if (v !== undefined) {
      const cells = Math.max(1, Math.min(4, Math.round(Math.abs(v) / 1.5)))
      if (cells !== p.params?.cells) return { ...p, params: { ...p.params, cells } }
    }
  }
  if (p.kind === 'module' && p.params?.variant === 'uno') {
    const pin = snap.pins[13]
    const led13 = snap.assembly.running && pin?.mode === 'OUTPUT' && pin.level >= 0.5 ? 1 : 0
    if (led13 !== (p.params?.led13 ?? 0)) return { ...p, params: { ...p.params, led13 } }
  }
  return p
}

interface Anim {
  dropAt: number
  lift: number
}

interface PickHandlers {
  /** pointer over / out of a part (null: out) */
  onHover?: (id: string | null) => void
  onPick?: (id: string) => void
  /** the slot group, for the highlight's bounding box */
  onGroup?: (id: string, g: Group | null) => void
}

interface SlotProps extends PickHandlers {
  part: PartPlacement
  state: PartRenderState
  layer: number
  exploded: boolean
  /** extra exploded-view lift (a peeled PCB layer stack sits under the parts) */
  baseLift?: number
  anim: Anim
  labels: boolean
}

/** a press that moved further than this (px) was an orbit drag, not a click */
const CLICK_SLOP = 6

function PartSlot({ part, state, layer, exploded, baseLift = 0, anim, labels, onHover, onPick, onGroup }: SlotProps) {
  const ref = useRef<Group>(null)
  const invalidate = useThree((s) => s.invalidate)
  const id = part.id
  const setRef = useCallback(
    (g: Group | null) => {
      ref.current = g
      onGroup?.(id, g)
    },
    [id, onGroup],
  )
  const pick = onPick
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          onHover?.(id)
        },
        onPointerOut: () => onHover?.(null),
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          if (e.delta <= CLICK_SLOP) onPick(id)
        },
      }
    : {}
  const Comp = partRegistry[part.kind]
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const now = performance.now()
    const k = Math.min(1, Math.max(0, (now - anim.dropAt) / DROP_MS))
    const drop = (1 - easeOut(k)) * DROP_H
    const target = exploded ? layer * LIFT + baseLift : 0
    anim.lift += (target - anim.lift) * 0.16
    if (Math.abs(target - anim.lift) < 0.002) anim.lift = target
    g.position.y = drop + anim.lift
    g.visible = now >= anim.dropAt
    if (k < 1 || anim.lift !== target) invalidate()
  })
  return (
    <group ref={setRef} {...pick}>
      <Comp part={part} state={state} />
      <PartLabel part={part} state={state} labels={labels} />
    </group>
  )
}

export interface PartCalloutSpec {
  text: string
  tone: CalloutTone
  hidden: boolean
}

/**
 * The callout a part gets on the board (pure): every part with a `label` has one, whatever
 * its position in the list, and it stays registered (just hidden) while labels are off or
 * the part is not placed.
 */
export function partCallout(part: PartPlacement, state: PartRenderState, labels: boolean): PartCalloutSpec | null {
  if (!part.label) return null
  return { text: part.label, tone: state.burnt ? 'warn' : 'ink', hidden: !labels || !state.visible }
}

function PartLabel({ part, state, labels }: { part: PartPlacement; state: PartRenderState; labels: boolean }) {
  const anchor = useMemo<[number, number, number]>(() => {
    const [x, y, z] = partPosition(part)
    return [x, y + partHeight(partRegistry[part.kind], part), z]
  }, [part])
  const c = partCallout(part, state, labels)
  if (!c) return null
  return <Callout text={c.text} anchor={anchor} offset={calloutOffset(part)} tone={c.tone} hidden={c.hidden} target={part.id} />
}

/**
 * The moving board (BoardSpec.dynamic): lift, travel and pitch about the pivot, eased between the ~15 Hz
 * snapshots so the tilt reads smoothly (src/three/dynamicPose.ts).
 */
function DynamicBody({ spec, published, children }: { spec: BoardDynamic; published: Record<string, number>; children: ReactNode }) {
  const outer = useRef<Group>(null)
  const rot = useRef<Group>(null)
  const cur = useRef<Pose>({ pitch: 0, travel: 0 })
  const invalidate = useThree((s) => s.invalidate)
  const { pitch, travel } = dynamicPose(spec, published)
  const want = useRef<Pose>({ pitch: 0, travel: 0 })
  useEffect(() => {
    want.current = { pitch, travel }
    invalidate()
  }, [pitch, travel, invalidate])
  const [px, py, pz] = spec.pivot
  const lift = spec.lift ?? 0
  useFrame((_, dt) => {
    const moving = easePose(cur.current, want.current, Math.min(dt, 0.1))
    const o = outer.current
    const r = rot.current
    if (o) o.position.set(px + cur.current.travel, py + lift, pz)
    if (r) r.rotation.z = -cur.current.pitch
    if (moving) invalidate()
  })
  return (
    <group ref={outer} position={[px, py + lift, pz]}>
      <group ref={rot}>
        <group position={[-px, -py, -pz]}>{children}</group>
      </group>
    </group>
  )
}

export interface BoardProps {
  lesson: Lesson
  snap: BenchSnapshot
  settings: Settings
  /** the inspected part (selection brackets) */
  selected?: string | null
  /** the part the active guide step points at (guide brackets) */
  guideFocus?: string | null
  /** click a part to inspect it; without this the parts are not pickable */
  onSelect?: (id: string) => void
  /** live tweak values (the PCB layer tour reads its view from them while unpowered) */
  tweaks?: Record<string, number>
}

export function Board({ lesson, snap, settings, selected = null, guideFocus = null, onSelect, tweaks }: BoardProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const groups = useRef(new Map<string, Group>())
  const gl = useThree((s) => s.gl)
  const onHover = useCallback(
    (id: string | null) => {
      setHovered((h) => (id === null ? null : id === h ? h : id))
      gl.domElement.style.cursor = id ? 'pointer' : ''
    },
    [gl],
  )
  const onGroup = useCallback((id: string, g: Group | null) => {
    if (g) groups.current.set(id, g)
    else groups.current.delete(id)
  }, [])
  const { board } = lesson
  const breadboard = board.base === 'breadboard-only'
  const pcb = board.base !== 'breadboard-only'
  const color = PALETTES.find((p) => p.id === settings.palette)?.color
  const exploded = snap.assembly.exploded

  // drop animation bookkeeping: parts that just became placed fall in, staggered
  const anims = useRef(new Map<string, Anim>())
  const prev = useRef<Set<string> | null>(null)
  const placed = snap.assembly.placed
  const placedKey = placed.join('|')
  useMemo(() => {
    const now = performance.now()
    const before = prev.current
    let k = 0
    for (const p of board.parts) {
      const a = anims.current.get(p.id) ?? { dropAt: 0, lift: 0 }
      anims.current.set(p.id, a)
      const isIn = placed.includes(p.id)
      // first render: everything already placed is simply there
      if (isIn && before && !before.has(p.id)) a.dropAt = now + k++ * STAGGER_MS
    }
    prev.current = new Set(placed)
  }, [placedKey, board.parts])

  const mat = useMemo(() => matFrame(board), [board])
  const [w, d] = mat.size
  // a board with manufacturing layers: the layer tour (peel, isolate, DRC); isolating a layer hides the parts on it
  const tour = pcb && board.layers ? tourState(lesson, snap, tweaks) : null
  const tourPartState = (p: PartPlacement, s: PartRenderState): PartRenderState =>
    tour && tour.view !== 'all' && p.mount !== 'offboard' ? { ...s, visible: false } : s
  const slot = (p: PartPlacement) => (
    <PartSlot
      key={p.id}
      part={liveParams(p, snap)}
      state={tourPartState(p, partState(lesson, p, snap))}
      layer={tour && p.mount !== 'offboard' ? 0 : explodeLayer(p, breadboard)}
      exploded={exploded}
      baseLift={tour && p.mount !== 'offboard' ? partsLift(true) : 0}
      anim={anims.current.get(p.id)!}
      labels={settings.labels}
      onHover={onSelect ? onHover : undefined}
      onPick={onSelect}
      onGroup={onGroup}
    />
  )
  /* the PCB is the bottom layer: it stays put while the rest lifts off it */
  const pcbNode = pcb && (tour ? <PcbLayers lesson={lesson} snap={snap} tour={tour} color={color} /> : <Pcb spec={board} color={color} />)
  const dyn = board.dynamic
  return (
    <group>
      {board.base !== 'none' && <BenchBase size={[w + 2, d + 2]} center={mat.center} />}
      {dyn ? (
        <>
          {/* a board that moves: the PCB and its parts are one rigid body (a robot's chassis) */}
          <DynamicBody spec={dyn} published={snap.published}>
            {pcbNode}
            {board.parts.filter((p) => ridesOnBody(dyn, p.id)).map(slot)}
          </DynamicBody>
          {board.parts.filter((p) => !ridesOnBody(dyn, p.id)).map(slot)}
        </>
      ) : (
        <>
          {pcbNode}
          {board.parts.map(slot)}
        </>
      )}
      {guideFocus && guideFocus !== selected && guideFocus !== hovered && (
        <PartHighlight key={`g-${guideFocus}`} object={() => groups.current.get(guideFocus)} mode="guide" />
      )}
      {hovered && hovered !== selected && <PartHighlight key={`h-${hovered}`} object={groups.current.get(hovered)} mode="hover" />}
      {selected && <PartHighlight key={`s-${selected}`} object={groups.current.get(selected)} mode="selected" />}
    </group>
  )
}
