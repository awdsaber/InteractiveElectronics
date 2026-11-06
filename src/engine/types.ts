// Core contracts shared by sim, mcu, bench, 3D and lessons. See docs/spec.md.
// No enums (erasableSyntaxOnly) — use string literal unions.

// ───────────────────────── Circuit / netlist ─────────────────────────

export type NodeId = string // '0' is ground

export interface Rating {
  maxI?: number // A (absolute value; RMS over rmsWindow when that is set)
  maxP?: number // W (mean over rmsWindow when that is set)
  maxV?: number // V across nodes[0]-nodes[1] (or Vce / Vds for transistors)
  /**
   * how the part fails: 'open' (default), 'short', or 'shutdown' (thermal shutdown: the part
   * is disabled while Tj > tMax and re-enabled once it has cooled by THERMAL_HYST)
   */
  failMode?: 'open' | 'short' | 'shutdown'
  /** thermal resistance junction-to-ambient, °C/W. With tMax, temperature replaces the maxP 300 ms rule */
  rth?: number
  /** thermal time constant, s (omitted: Tj follows power instantly) */
  tauTh?: number
  /** maximum junction temperature, °C */
  tMax?: number
  /** averaging window, s, for pulsed / AC current (RMS) and power (mean) */
  rmsWindow?: number
}

interface ElementBase {
  id: string
  rating?: Rating
  /** 3D part this element belongs to (for glow / burn rendering) */
  partId?: string
  /** disabled parts stamp as an open circuit (thermal shutdown) */
  disabled?: boolean
}

/** periodic source waveform: v(t) = offset + amp·shape(freq·t + phase/360) */
export interface Waveform {
  kind: 'sine' | 'square' | 'triangle'
  /** peak amplitude, V */
  amp: number
  /** Hz */
  freq: number
  /** default 0 */
  offset?: number
  /** degrees, default 0 */
  phase?: number
  /** square only: fraction of the period at +amp, default 0.5 */
  duty?: number
}

export type LogicGate = 'NOT' | 'AND' | 'OR' | 'NAND' | 'NOR' | 'XOR' | 'BUF' | 'SCHMITT'

export type LedColor = 'red' | 'yellow' | 'green' | 'blue' | 'white'

export type Element =
  | (ElementBase & { type: 'R'; nodes: [NodeId, NodeId]; value: number })
  | (ElementBase & {
      type: 'V'
      nodes: [NodeId, NodeId] // nodes[0] = +
      value: number // DC value (ignored when `wave` is set)
      rInternal?: number
      wave?: Waveform
      /** current limit, A: above it the source becomes a constant-current source (CC mode) */
      iLimit?: number
      /** false: the source cannot sink (back-fed current is refused, like a supply with an output diode) */
      sink?: boolean
    })
  | (ElementBase & { type: 'I'; nodes: [NodeId, NodeId]; value: number }) // SPICE convention: `value` A flows from nodes[0] through the source to nodes[1]
  | (ElementBase & { type: 'SW'; nodes: [NodeId, NodeId]; closed: boolean; vBreak?: number }) // vBreak: avalanche clamp across the contacts, V
  | (ElementBase & { type: 'D'; nodes: [NodeId, NodeId]; is?: number; n?: number; rs?: number }) // anode, cathode
  | (ElementBase & { type: 'LED'; nodes: [NodeId, NodeId]; color: LedColor })
  | (ElementBase & { type: 'ZENER'; nodes: [NodeId, NodeId]; vz: number; rz?: number }) // rz: dynamic resistance Ω (soft knee); vz is the voltage at 5 mA
  | (ElementBase & { type: 'NPN' | 'PNP'; nodes: [NodeId, NodeId, NodeId]; beta?: number; is?: number; vBreak?: number }) // C, B, E; vBreak: Vce avalanche clamp
  | (ElementBase & { type: 'NMOS' | 'PMOS'; nodes: [NodeId, NodeId, NodeId]; vth?: number; k?: number; vBreak?: number }) // D, G, S; vBreak: Vds avalanche clamp
  | (ElementBase & { type: 'C'; nodes: [NodeId, NodeId]; value: number; v0?: number; polarized?: boolean }) // polarized: electrolytic, nodes[0] = +; fails short when reverse-biased
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
  | (ElementBase & {
      type: 'PIN'
      nodes: [NodeId, NodeId] // nodes[0]=pin net, nodes[1]=GND
      pin: number
      vcc: number
      rOut?: number
      /** HIGH (and the pull-up) connect to this rail node instead of an ideal `vcc` */
      vccNode?: NodeId
    })
  | (ElementBase & { type: 'OPAMP'; nodes: [NodeId, NodeId, NodeId]; gain?: number; vPos: number; vNeg: number }) // in+, in-, out
  | (ElementBase & { type: 'PROBE'; nodes: [NodeId, NodeId] })
  | (ElementBase & { type: 'POT'; nodes: [NodeId, NodeId, NodeId]; value: number; pos: number }) // end A, wiper, end B; pos 0 = wiper at A
  | (ElementBase & {
      type: 'XFMR'
      nodes: [NodeId, NodeId, NodeId, NodeId] // primary +, primary -, secondary +, secondary -
      /** turns ratio Ns/Np: Vs = n·Vp */
      n: number
      /** magnetizing inductance across the primary, H (omitted: ideal) */
      lm?: number
    })
  | (ElementBase & {
      type: 'LOGIC'
      /** inputs..., then the output. Supply and ground are implicit (ideal vcc rail, node '0') */
      nodes: NodeId[]
      gate: LogicGate
      vcc: number
      /** input threshold, V (default vcc/2) */
      vth?: number
      /** hysteresis, V (SCHMITT default 0.2·vcc, others 0) */
      hyst?: number
    })
  | (ElementBase & {
      type: 'FUSE'
      nodes: [NodeId, NodeId]
      /** rated current, A: never blows at or below it */
      iRated: number
      /** melting integral ∫(i² − iRated²)dt, A²s */
      i2t: number
      /** cold resistance, Ω (default 0.01) */
      r?: number
      blown?: boolean
    })
  | (ElementBase & {
      type: 'REG'
      nodes: [NodeId, NodeId, NodeId] // in, gnd, out
      vout: number
      /** minimum Vin - Vout, V */
      dropout: number
      /** output current limit, A */
      iLimit: number
      /** quiescent (ground-pin) current, A */
      iq?: number
    })

export type ElementType = Element['type']

export interface Netlist {
  elements: Element[]
  /** initial node-voltage guess for the first solve, so bistable circuits power up deterministically */
  ic?: Record<NodeId, number>
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
  /**
   * Single reads that don't materialise the maps above (solutions from the simulator provide
   * them; checkRatings uses them so a per-frame check stays cheap). `extraOf(id, key)` reads
   * extra[key] produced by element `id` (key is the full `${id}.name` string).
   */
  currentOf?(elementId: string): number
  powerOf?(elementId: string): number
  extraOf?(elementId: string, key: string): number
  voltageOf?(node: NodeId): number
  /** set extra[key] (e.g. `${id}.tj`) without materialising the map before it is read */
  publish?(key: string, value: number): void
}

/** OUTPUT_OPEN_DRAIN: LOW pulls down through rOut, HIGH releases the pin (high impedance) */
export type PinMode = 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' | 'OUTPUT_OPEN_DRAIN'
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
  /**
   * 'thermal-shutdown' / 'thermal-recover' are not burns: applyBurn disables / re-enables the part.
   * 'overtemp', 'reverse-voltage' (polarized capacitor, fails short) and 'blown' (fuse) are.
   */
  reason:
    | 'overcurrent'
    | 'overpower'
    | 'overvoltage'
    | 'pin-overcurrent'
    | 'overtemp'
    | 'reverse-voltage'
    | 'blown'
    | 'thermal-shutdown'
    | 'thermal-recover'
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
  /** ADC resolution in bits (board default when omitted: Uno 10, ESP32-S3 12) */
  adcBits?: number
  /** analogWrite PWM frequency, Hz (board default when omitted) */
  pwmFreq?: number
}

export interface SimSettings {
  /** transient step, s */
  dt?: number
  /** integration: 'be' backward Euler (default, damps), 'trap' trapezoidal (keeps LC ringing) */
  method?: 'be' | 'trap'
  stepsPerFrame?: number
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
  sim?: SimSettings
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
