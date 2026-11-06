// Core contracts shared by sim, mcu, bench, 3D and lessons. See docs/spec.md.
// No enums (erasableSyntaxOnly) — use string literal unions.

// ───────────────────────── Circuit / netlist ─────────────────────────

export type NodeId = string // '0' is ground

export interface Rating {
  maxI?: number // A (absolute value)
  maxP?: number // W
  maxV?: number // V across nodes[0]-nodes[1] (or Vce / Vds for transistors)
  /** how the part fails: 'open' (default) or 'short' */
  failMode?: 'open' | 'short'
}

interface ElementBase {
  id: string
  rating?: Rating
  /** 3D part this element belongs to (for glow / burn rendering) */
  partId?: string
}

export type LedColor = 'red' | 'yellow' | 'green' | 'blue' | 'white'

export type Element =
  | (ElementBase & { type: 'R'; nodes: [NodeId, NodeId]; value: number })
  | (ElementBase & { type: 'V'; nodes: [NodeId, NodeId]; value: number; rInternal?: number }) // nodes[0] = +
  | (ElementBase & { type: 'I'; nodes: [NodeId, NodeId]; value: number }) // SPICE convention: `value` A flows from nodes[0] through the source to nodes[1]
  | (ElementBase & { type: 'SW'; nodes: [NodeId, NodeId]; closed: boolean })
  | (ElementBase & { type: 'D'; nodes: [NodeId, NodeId]; is?: number; n?: number; rs?: number }) // anode, cathode
  | (ElementBase & { type: 'LED'; nodes: [NodeId, NodeId]; color: LedColor })
  | (ElementBase & { type: 'ZENER'; nodes: [NodeId, NodeId]; vz: number })
  | (ElementBase & { type: 'NPN' | 'PNP'; nodes: [NodeId, NodeId, NodeId]; beta?: number; is?: number }) // C, B, E
  | (ElementBase & { type: 'NMOS' | 'PMOS'; nodes: [NodeId, NodeId, NodeId]; vth?: number; k?: number }) // D, G, S
  | (ElementBase & { type: 'C'; nodes: [NodeId, NodeId]; value: number; v0?: number })
  | (ElementBase & { type: 'L'; nodes: [NodeId, NodeId]; value: number; i0?: number })
  | (ElementBase & {
      type: 'MOTOR'
      nodes: [NodeId, NodeId]
      r: number // winding resistance Ω
      l?: number // H
      ke: number // V/(rad/s)
      kt?: number // N·m/A (defaults to ke)
      j?: number // kg·m²
      b?: number // viscous friction N·m·s
      load?: number // N·m
    })
  | (ElementBase & { type: 'PIN'; nodes: [NodeId, NodeId]; pin: number; vcc: number; rOut?: number }) // nodes[0]=pin net, nodes[1]=GND
  | (ElementBase & { type: 'OPAMP'; nodes: [NodeId, NodeId, NodeId]; gain?: number; vPos: number; vNeg: number }) // in+, in-, out
  | (ElementBase & { type: 'PROBE'; nodes: [NodeId, NodeId] })

export type ElementType = Element['type']

export interface Netlist {
  elements: Element[]
}

export interface Solution {
  ok: boolean
  nodeV: Record<NodeId, number>
  /** current through element, positive nodes[0] -> nodes[1] (for 3-terminal: into first terminal) */
  current: Record<string, number>
  power: Record<string, number>
  /** transistor extras: ib, ic, ie, vce/vds, motor omega, etc. keyed `${id}.${key}` */
  extra: Record<string, number>
  iterations?: number
}

export type PinMode = 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP'
export interface PinState {
  mode: PinMode
  /** 0..1 — digital LOW/HIGH = 0/1, PWM = duty */
  level: number
  /** set when the pin drives a hobby servo: commanded angle in degrees (level is deg/180) */
  servoDeg?: number
  /** set while tone() drives the pin: square-wave frequency in Hz (level is 0.5, the 50 % duty) */
  toneHz?: number
}

// ───────────────────────── Failures ─────────────────────────

export type FailurePatch =
  | { op: 'remove'; elementId: string }
  | { op: 'set'; elementId: string; key: string; value: number | boolean | string }
  | { op: 'short'; a: NodeId; b: NodeId }
  | { op: 'add'; element: Element }

export interface FailureScenario {
  id: string
  label: string // menu text e.g. "Remove the current-limiting resistor"
  explain: string // what happens and why (shown after it triggers)
  patches: FailurePatch[]
}

export interface BurnEvent {
  elementId: string
  partId?: string
  reason: 'overcurrent' | 'overpower' | 'overvoltage' | 'pin-overcurrent'
  value: number
  limit: number
  t: number
}

// ───────────────────────── 3D board ─────────────────────────

export type PartKind =
  | 'resistor'
  | 'resistor-smd'
  | 'led'
  | 'led-smd'
  | 'capacitor-ceramic'
  | 'capacitor-smd'
  | 'capacitor-electrolytic'
  | 'inductor'
  | 'diode'
  | 'zener'
  | 'transistor-to92'
  | 'mosfet-to220'
  | 'regulator-to220'
  | 'ic-dip'
  | 'ic-smd' // SOIC/TQFP/QFN — params.pins, params.package
  | 'crystal'
  | 'header-male'
  | 'header-female'
  | 'usb-b'
  | 'usb-c'
  | 'micro-usb'
  | 'barrel-jack'
  | 'screw-terminal'
  | 'button'
  | 'switch-slide'
  | 'potentiometer'
  | 'buzzer'
  | 'battery-aa-pack'
  | 'battery-9v'
  | 'battery-lipo'
  | 'dc-motor'
  | 'gear-motor-wheel'
  | 'servo'
  | 'stepper-nema17'
  | 'breadboard'
  | 'module' // generic sub-board: params.w, params.d, params.color, params.title
  | 'wifi-module' // ESP32 metal can + PCB antenna
  | 'oled'
  | 'heatsink'
  | 'wire' // params.points: [x,y,z][] , params.color
  | 'probe' // multimeter / scope probe tip
  | 'multimeter'
  | 'sensor-ultrasonic'
  | 'load-cell'
  | 'thermistor'
  | 'transformer'
  | 'fuse'
  | 'logic-ic-label' // flat silkscreen text
  | 'testpoint'

export type Mount = 'smd' | 'tht' | 'module' | 'offboard'

export interface PartPlacement {
  id: string
  kind: PartKind
  /** board units (1 = 10 mm). x right, z toward viewer; y is height above PCB top */
  pos: [number, number] | [number, number, number]
  /** rotation about vertical axis, degrees */
  rot?: number
  mount: Mount
  label?: string // callout tag text, e.g. "FLYBACK"
  role: string // one-line "what it does" (toast when placed)
  color?: string
  params?: Record<string, unknown>
  /** netlist element ids rendered by this part (glow, burn) */
  circuitIds?: string[]
}

export interface BoardSpec {
  name: string // silkscreen text
  size: [number, number] // w, d in board units
  pcbColor?: string // default from palette
  /** decorative traces as polylines in board units */
  traces?: [number, number][][]
  /** base / bench object under the board */
  base?: 'mat' | 'breadboard-only' | 'none'
  parts: PartPlacement[]
}

// ───────────────────────── Lesson ─────────────────────────

export type TrackId = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7'

export interface Readout {
  label: string // "LED CURRENT"
  /** what to read */
  source:
    | { kind: 'current'; elementId: string }
    | { kind: 'voltage'; node: NodeId; ref?: NodeId }
    | { kind: 'power'; elementId: string }
    | { kind: 'extra'; key: string } // Solution.extra key
    | { kind: 'behavior'; key: string } // value published by a behavior
  unit: 'A' | 'V' | 'W' | 'Ω' | 'rpm' | '°' | '°C' | 'Hz' | 'g' | 'cm' | ''
  digits?: number
}

export interface Tweak {
  label: string
  elementId: string
  key: string // 'value', 'closed', 'r', 'load' ...
  min: number
  max: number
  step?: number
  /** log slider for resistors / caps */
  log?: boolean
  unit: string
}

export interface StatusLine {
  /** expression-free condition */
  when:
    | { kind: 'state'; is: BenchStatus }
    | { kind: 'above'; readout: number; value: number } // readout index
    | { kind: 'below'; readout: number; value: number }
    | { kind: 'pin'; pin: number; level: 0 | 1 }
  text: string
}

export interface QuizItem {
  q: string
  options: string[]
  answer: number // index
  why: string
}

export interface Sketch {
  title: string // "Blink"
  code: string
  /** pin number -> netlist PIN element id */
  pins: Record<number, string>
  /** analog inputs: A0.. -> node id (read voltage) */
  analogPins?: Record<string, NodeId>
  vcc: number // 5 for Uno, 3.3 for ESP32
  board: 'uno' | 'esp32s3' | 'generic'
}

export interface Lesson {
  id: string
  fig: number
  track: TrackId
  title: string
  subtitle: string
  /** one sentence shown top-right of the bench, e.g. "a 20 mA pin switches a 250 mA motor" */
  tagline: string
  board: BoardSpec
  circuit: Netlist
  /** element id of the power switch/source toggled by "Plug USB / Connect power" */
  powerElementId: string
  powerLabel?: string // "Plug USB" (default) / "Connect battery"
  readouts: Readout[]
  sketch?: Sketch
  tweaks?: Tweak[]
  failures: FailureScenario[]
  statusLines?: StatusLine[]
  meet: string // markdown
  mechanicalAnalogy: string // markdown
  proTips: string[]
  quiz: QuizItem[]
  behaviors?: string[] // ids registered in src/engine/behaviors
  /** transient step needed? (RC, motors, PWM). default true when C/L/MOTOR present */
  transient?: boolean
}

export type BenchStatus = 'BARE PCB' | 'ASSEMBLING' | 'READY' | 'POWERED' | 'RUNNING' | 'FAULT'

export interface Track {
  id: TrackId
  name: string
  blurb: string
}

// ───────────────────────── Behaviors (lesson-specific dynamics) ─────────────────────────

export interface BehaviorContext {
  /** sim time, seconds */
  t: number
  solution: Solution | null
  pins: Record<number, PinState>
  powered: boolean
  /** publish a value readable by Readout { kind:'behavior', key } and 3D parts */
  publish(key: string, value: number): void
  /** change a netlist element parameter live (e.g. sensor resistance) */
  setParam(elementId: string, key: string, value: number | boolean): void
}

export interface Behavior {
  id: string
  /** objects exposed to sketches as globals, e.g. { mpu: {...} } or classes like Servo */
  libraries?: (ctx: BehaviorContext) => Record<string, unknown>
  init?(ctx: BehaviorContext): void
  /** dt in seconds */
  tick?(ctx: BehaviorContext, dt: number): void
}
