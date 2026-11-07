// Composes a lesson's BoardSpec on the bench: cutting mat, PCB (unless breadboard-only) and
// every part, with PartRenderState derived from the bench snapshot. Placement drops parts in
// (250 ms ease from y + 3, staggered); the exploded view lifts mount layers apart.

import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import type { BenchSnapshot } from '../engine/bench/simLoop'
import type { Lesson, PartPlacement } from '../engine/types'
import { PALETTES, type Settings } from '../ui/types'
import { BenchBase } from './BenchBase'
import { Callout, type CalloutTone } from './Callout'
import { partPosition, partRegistry, type PartRenderState } from './parts'
import { calloutOffset, partHeight } from './parts/frame'
import { Pcb } from './Pcb'
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
  const s: PartRenderState = {
    visible: placed,
    soldered: !breadboard && snap.assembly.soldered && (p.mount === 'tht' || p.mount === 'smd'),
    glow: glow < 0.01 ? 0 : glow,
    burnt: !!snap.partBurnt[p.id],
    explodedOffset: 0,
    // labels are drawn by the Board (always mounted, see Callout `hidden`)
    showLabel: false,
  }
  if (rgb?.color) s.glowColor = rgb.color
  // a button a failure holds down (e.g. BOOT held at power-up): params.pressedWhen = failure id
  if (p.kind === 'button' && typeof p.params?.pressedWhen === 'string') s.value = snap.assembly.failures.includes(p.params.pressedWhen) ? 1 : 0
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
  if (p.kind === 'multimeter') {
    const i = typeof p.params?.readout === 'number' ? p.params.readout : 0
    s.reading = snap.readouts[i]?.value.split(' ')[0] ?? '----'
    if (p.params?.autoUnit === true) s.readingUnit = snap.readouts[i]?.value.split(' ')[1] ?? ''
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

interface SlotProps {
  part: PartPlacement
  state: PartRenderState
  layer: number
  exploded: boolean
  anim: Anim
  labels: boolean
}

function PartSlot({ part, state, layer, exploded, anim, labels }: SlotProps) {
  const ref = useRef<Group>(null)
  const invalidate = useThree((s) => s.invalidate)
  const Comp = partRegistry[part.kind]
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const now = performance.now()
    const k = Math.min(1, Math.max(0, (now - anim.dropAt) / DROP_MS))
    const drop = (1 - easeOut(k)) * DROP_H
    const target = exploded ? layer * LIFT : 0
    anim.lift += (target - anim.lift) * 0.16
    if (Math.abs(target - anim.lift) < 0.002) anim.lift = target
    g.position.y = drop + anim.lift
    g.visible = now >= anim.dropAt
    if (k < 1 || anim.lift !== target) invalidate()
  })
  return (
    <group ref={ref}>
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
  return <Callout text={c.text} anchor={anchor} offset={calloutOffset(part)} tone={c.tone} hidden={c.hidden} />
}

export interface BoardProps {
  lesson: Lesson
  snap: BenchSnapshot
  settings: Settings
}

export function Board({ lesson, snap, settings }: BoardProps) {
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

  const [w, d] = board.frame?.size ?? board.size
  return (
    <group>
      {board.base !== 'none' && <BenchBase size={[w + 2, d + 2]} center={board.frame?.center} />}
      {/* the PCB is the bottom layer: it stays put while the rest lifts off it */}
      {pcb && <Pcb spec={board} color={color} />}
      {board.parts.map((p) => (
        <PartSlot
          key={p.id}
          part={liveParams(p, snap)}
          state={partState(lesson, p, snap)}
          layer={explodeLayer(p, breadboard)}
          exploded={exploded}
          anim={anims.current.get(p.id)!}
          labels={settings.labels}
        />
      ))}
    </group>
  )
}
