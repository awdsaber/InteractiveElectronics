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
  /**
   * Set on a switched-PWM solution (sim/pwm.ts): the single-state solutions this one time-averages,
   * oldest first, with weights summing to 1. Ratings read peaks and RMS from them.
   */
  phases?: readonly PwmPhaseSolution[]
}

export interface PwmPhaseSolution {
  /** fraction of the PWM period spent in this state */
  weight: number
  solution: Solution
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
  /** analogWrite PWM frequency in Hz (the simulator switches PWM pins at it; default 490) */
  pwmHz?: number
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
  /** 3D parts this failure removes from / adds to the bench while it is active */
  parts?: { hide?: string[]; show?: string[] }
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
  /** behavior burns: the FAULT text after the part name, instead of value / limit */
  note?: string
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
  /** not part of the build: only on the bench while a failure `parts.show`s it (e.g. a jumper in place of R1) */
  hidden?: boolean
  /** short datasheet facts shown in the part inspector, e.g. "Vf 2.0 V at 20 mA (typ.)" */
  facts?: string[]
}

export interface BoardSpec {
  name: string // silkscreen text
  size: [number, number] // w, d in board units
  pcbColor?: string // default from palette
  /** decorative traces as polylines in board units */
  traces?: [number, number][][]
  /** base / bench object under the board */
  base?: 'mat' | 'breadboard-only' | 'none'
  /**
   * the bench area the camera frames and the mat covers, when off-board parts sit beside the PCB
   * (default: `size`, centred on the PCB). `center` is [x, z] in board units.
   */
  frame?: { size: [number, number]; center?: [number, number] }
  parts: PartPlacement[]
  /**
   * the board's manufacturing layers (copper, pours, vias, drill, mask, silk and DRC rules). With it the
   * PCB is drawn layer by layer: the exploded view peels the stack apart and the `pcb-tour` behavior
   * isolates one layer or overlays the DRC (src/engine/pcb, src/three/PcbLayers.tsx)
   */
  layers?: PcbLayersSpec
}

/** a copper trace: a polyline in board units, its width in mm */
export interface PcbTrace {
  id: string
  net: string
  pts: [number, number][]
  /** width, mm */
  w: number
  /** the current it must carry, A: the DRC sizes it with IPC-2221 */
  amps?: number
  /** the width follows a behavior param live: '<instance>.<param>' (published value, then tweak, then default) */
  widthParam?: string
  /** the design current follows a behavior param live, as `widthParam` */
  ampsParam?: string
  /** the netlist element this trace is (burns show on it) */
  elementId?: string
}

export interface PcbVia {
  at: [number, number]
  net: string
  /** finished drill, mm */
  drill: number
  /** pad (land) diameter, mm */
  pad: number
}

export interface PcbLayersSpec {
  /** finished board thickness, mm (core + copper) */
  thicknessMm: number
  /** outer copper weight, oz/ft² */
  copperOz: number
  /** the copper weight follows a behavior param live, as PcbTrace.widthParam */
  copperOzParam?: string
  top: PcbTrace[]
  bottom: PcbTrace[]
  /** copper pours: the net fills the layer, cleared by `clearance` mm round other nets */
  pours?: { net: string; layer: 'top' | 'bottom'; clearance: number }[]
  vias?: PcbVia[]
  /** pad nets: 'part:padIndex' → net (pads not listed belong to no pour) */
  padNets?: Record<string, string>
  /** pads joined to a pour: relief false is a solid connection (no thermal relief spokes) */
  pourPads?: { part: string; pad: number; relief: boolean }[]
  /** decoupling capacitors and the IC pad each one serves */
  decoupling?: { cap: string; ic: string; pad: number; pin: string; maxMm: number }[]
  /** pick-and-place camera marks: bare copper dots, mm diameter */
  fiducials?: { at: [number, number]; d: number }[]
  /** extra silkscreen text */
  silk?: { text: string; at: [number, number]; size?: number }[]
  /** the fab's design rules, mm (riseC: the allowed IPC-2221 temperature rise) */
  rules: { minTrace: number; minClearance: number; minAnnular: number; riseC: number }
}

// ───────────────────────── Lesson ─────────────────────────

export type TrackId = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7'

export type ReadoutSource =
  | { kind: 'current'; elementId: string }
  | { kind: 'voltage'; node: NodeId; ref?: NodeId }
  | { kind: 'power'; elementId: string }
  | { kind: 'extra'; key: string } // Solution.extra key
  | { kind: 'behavior'; key: string } // value published by a behavior
  /**
   * computed from other readouts (indices into `lesson.readouts`): sum / product of all of them,
   * diff = of[0] − of[1], ratio = of[0] / of[1] (a 0 denominator reads "—")
   */
  | { kind: 'derived'; op: 'sum' | 'diff' | 'ratio' | 'product'; of: number[] }

export interface Readout {
  label: string // "LED CURRENT"
  /** what to read */
  source: ReadoutSource
  unit: ReadoutUnit
  digits?: number
  /** |value| below this reads 0 (default: 1 µV for V, 1 nA / 1 nW for A / W) */
  floor?: number
  /**
   * peak-hold: show the value of largest magnitude since power-on (or repair / strip / a manual
   * reset), sampled on every sim step and edge substep, so µs spikes are caught
   */
  peak?: boolean
  /** the readout shows in the warn tone while its value is above this */
  warnAbove?: number
}

export type ReadoutUnit =
  | 'A'
  | 'V'
  | 'W'
  | 'Ω'
  | 'mΩ'
  | 'rpm'
  | '°'
  | '°C'
  | 'Hz'
  | 'g'
  | 'cm'
  | '%'
  | 's'
  | 'µs'
  | 'counts'
  | 'dBm'
  | 'steps'
  | 'C'
  | ''

export interface TweakTarget {
  /** netlist element id, or `behavior:<instance>` */
  elementId: string
  key: string
  /** the target gets the tweak's value × scale (default 1) */
  scale?: number
}

export interface Tweak {
  label: string
  /** netlist element id, or `behavior:<instance>` to drive a behavior param */
  elementId: string
  key: string // 'value', 'closed', 'r', 'load' ... (or the behavior param name)
  /**
   * - slider (default): min..max, linear or log, snapped to `step`
   * - toggle: an on/off switch, off = min, on = max
   * - enum: one of `options` (a segmented choice)
   * - momentary: a press-and-hold button (pointer or Space / Enter): while held the value is the
   *   end of min/max opposite its resting value (the circuit's own value), e.g. a normally open
   *   SW `closed` 0 → 1, a normally closed one 1 → 0
   */
  kind?: 'slider' | 'enum' | 'momentary' | 'toggle'
  /** enum choices; values within min..max */
  options?: { label: string; value: number }[]
  min: number
  max: number
  step?: number
  /** log slider for resistors / caps */
  log?: boolean
  unit: string
  /** ganged: these targets follow the tweak too (a dual pot, a matched resistor pair, a DPDT switch) */
  link?: TweakTarget[]
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
  /**
   * cap on transient steps per animation frame (default 30 × max(1, speed)); when the steps a
   * frame owes exceed it, the sim runs slower than requested and the speed control says so
   */
  stepsPerFrame?: number
  /**
   * split the step after each external switching event (a pin, tweak, failure or power change;
   * not square-wave source edges or device mode flips) into this many substeps growing ×2, and
   * check the instant ratings (maxV) on each, so µs events (an inductive kick into a transistor's
   * vBreak clamp) are seen at a coarse dt. Opt-in per lesson; default off.
   */
  edgeSubsteps?: number
  /** starting sim speed, sim seconds per real second (the speed control offers ×0.01 … ×100; default 1) */
  speed?: number
}

/** what a scope channel probes */
export type ScopeSource = { kind: 'voltage'; node: NodeId; ref?: NodeId } | { kind: 'current'; elementId: string }

export interface ScopeChannel {
  source: ScopeSource
  /** trace name on screen (default "V(node)" / "I(id)") */
  label?: string
  /** volts (or amps) per division; 8 divisions tall */
  perDiv?: number
  /** vertical position of the trace's zero, divisions above the centre line (−4..4) */
  offset?: number
  /** dashed reference lines, e.g. a rating: { value: 40, label: 'V_CEO 40 V' } */
  marks?: { value: number; label: string }[]
}

export interface ScopeDefaults {
  /** 1 or 2 channels */
  channels: ScopeChannel[]
  /** seconds per division; 10 divisions wide */
  timePerDiv?: number
  trigger?: {
    /** 0 = CH1 (default), 1 = CH2 */
    channel?: number
    level?: number
    slope?: 'rising' | 'falling'
    /** auto (default): free-run when nothing triggers; normal: hold the last triggered sweep */
    mode?: 'auto' | 'normal'
  }
}

export interface ChartDefaults {
  /** signals against time: readout indices, or inline readouts (any source) */
  signals: (number | Readout)[]
  /** seconds shown (default 10) */
  span?: number
}

/** one logic-analyzer channel: an MCU pin (its bus signal or its level) or a circuit node (thresholded) */
export interface LogicChannel {
  pin?: number
  node?: NodeId
  label: string
}

/** a logic analyzer's starting setup; it needs a `logic-analyzer` behavior on the bench, which records the data */
export interface LogicDefaults {
  /** 1 to 8 channels, top to bottom */
  channels: LogicChannel[]
  /** protocol decoder for the annotation row */
  decode?: 'uart' | 'i2c' | 'spi'
  /** UART decode baud (default: the analyzer behavior's laBaud) */
  baud?: number
  /** time window shown, seconds (default 2 ms) */
  span?: number
}

export interface InstrumentDefaults {
  scope?: ScopeDefaults
  chart?: ChartDefaults
  /** a logic analyzer tab (timeline + protocol decode), fed by the `logic-analyzer` behavior */
  logic?: LogicDefaults
  /** the instrument panel starts open (default closed) */
  open?: boolean
  /** which instrument the panel shows first (default: scope when it has one, else chart) */
  view?: 'scope' | 'chart' | 'logic'
}

/** a bench action a guide step can wait for ('place' = any single part placed by hand) */
export type GuideAction = 'strip' | 'pick-place' | 'place' | 'place-all' | 'solder' | 'power' | 'upload' | 'explode' | 'repair'

/**
 * A guide step's completion condition: plain data, no code. Event kinds (action, break, inspect,
 * instruments, quiz, manual) count only what happened since the step became active; state kinds
 * (status, tweak, readout, pin) look at the bench now.
 */
export type GuideCheck =
  /** that bench button was used at least once since the step became active */
  | { kind: 'action'; action: GuideAction }
  /** the bench status is this right now */
  | { kind: 'status'; is: BenchStatus }
  /** that failure was triggered since the step became active (or is active now) */
  | { kind: 'break'; failure: string }
  /** a tweak (by its label, or `${elementId}.${key}`) sits inside min..max (inclusive) */
  | { kind: 'tweak'; target: string; min?: number; max?: number }
  /** readout `index` (SI base units) is above / below the bound, continuously for holdMs (default 0) */
  | { kind: 'readout'; index: number; above?: number; below?: number; holdMs?: number }
  /** a sketch pin is driven as OUTPUT at this level (PWM rounds to the nearer level) */
  | { kind: 'pin'; pin: number; level: 0 | 1 }
  /** the part inspector was opened on this board part (or is open on it now) */
  | { kind: 'inspect'; part: string }
  /** the instrument panel was opened (or is open now) */
  | { kind: 'instruments' }
  /** the quiz was finished since the step became active */
  | { kind: 'quiz' }
  | { kind: 'all'; of: GuideCheck[] }
  | { kind: 'any'; of: GuideCheck[] }
  /** an "I've done this" button: for observe-only steps the bench can't detect */
  | { kind: 'manual' }

/**
 * What the guide points at: a bench control and/or a board part. Controls: the bench buttons
 * ('strip', 'pick-place', 'place', 'solder', 'power', 'upload', 'explode', 'break'), 'instruments'
 * (the toggle), 'quiz', 'code' (the sketch editor), or `tweak:<label>` (a tweak control).
 */
export type GuideControl =
  | 'strip'
  | 'pick-place'
  | 'place'
  | 'solder'
  | 'power'
  | 'upload'
  | 'explode'
  | 'break'
  | 'instruments'
  | 'quiz'
  | 'code'
  | `tweak:${string}`

export interface GuideStep {
  /** unique within the lesson (kebab-case); progress is saved by it */
  id: string
  title: string
  /** short markdown: what to do and what to notice */
  body: string
  check: GuideCheck
  /** markdown, offered after about 20 s on the step (or on request) */
  hint?: string
  focus?: { part?: string; control?: GuideControl }
  /** markdown shown once the step is done: why the bench did what it did */
  explain?: string
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
  /** element id of the power switch/source toggled by "Plug USB / Connect power". It also powers the MCU. */
  powerElementId: string
  powerLabel?: string // "Plug USB" (default) / "Connect battery"
  /** extra independently switched sources (each gets its own labelled button), e.g. a motor battery */
  extraPower?: { elementId: string; label: string }[]
  readouts: Readout[]
  sketch?: Sketch
  tweaks?: Tweak[]
  failures: FailureScenario[]
  statusLines?: StatusLine[]
  meet: string // markdown
  mechanicalAnalogy: string // markdown
  proTips: string[]
  quiz: QuizItem[]
  /** ids registered in src/engine/behaviors, or { id, instance, params } */
  behaviors?: BehaviorRef[]
  /** transient step needed? (RC, motors, PWM). default true when C/L/MOTOR present, a sketch or a ticking behavior */
  transient?: boolean
  sim?: SimSettings
  /** defaults for the instrument panel (scope, strip chart); the learner can change channels */
  instruments?: InstrumentDefaults
  /** guided steps (see src/lessons/README.md, "Guided steps"); without one the lesson is free explore */
  guide?: GuideStep[]
}

export type BehaviorRef = string | { id: string; instance?: string; params?: Record<string, number | string | boolean> }

/** A lesson as authored in src/lessons: `fig` is optional (assigned in sidebar order unless it is a video figure). */
export type LessonDef = Omit<Lesson, 'fig'> & { fig?: number }

export type BenchStatus = 'BARE PCB' | 'ASSEMBLING' | 'READY' | 'POWERED' | 'RUNNING' | 'FAULT'

export interface Track {
  id: TrackId
  name: string
  blurb: string
}

// ───────────────────────── Behaviors (lesson-specific dynamics) ─────────────────────────

export interface BehaviorEvent {
  t: number
  channel: string
  kind: string
  data?: unknown
}

/**
 * Bus activity a sketch performed (Serial output, Wire transactions, SPI bytes), for a logic analyzer.
 * `t` is the MCU time (µs) of the call. The calls themselves take no MCU time: a listener lays the
 * bits out on its own timeline at the bus's real rate.
 */
export type BusEvent =
  | { bus: 'uart'; t: number; baud: number; bytes: number[] }
  | {
      bus: 'i2c'
      t: number
      /** Wire.setClock, Hz (default 100 kHz) */
      clock: number
      addr: number
      read: boolean
      /** bytes written (read = false) or received (read = true) */
      bytes: number[]
      /** the address was acknowledged */
      addrAck: boolean
      /** a STOP ends it (false: endTransmission(false), a repeated START follows) */
      stop: boolean
    }
  | { bus: 'spi'; t: number; clock: number; mode: number; bitOrder: number; mosi: number; miso: number }

/** a listener on the MCU's buses (VirtualMcu.addBusMonitor) */
export interface BusMonitor {
  event?(ev: BusEvent): void
  /**
   * Called before an I²C address goes out: false = the bus mangles it (edges too slow, line stuck), so
   * no device sees the transaction and the address is NACKed. Must be side-effect free.
   */
  i2cOk?(addr: number, read: boolean, clock: number): boolean
}

export interface BehaviorMcu {
  /** brown-out: stop the sketch and float every pin until release() */
  hold(reason?: string): void
  release(): void
  /** restart the uploaded sketch from setup() */
  reset(): void
  injectEdge(pin: number, level: number | boolean, tMicros: number): void
  /** run `fn` as an interrupt handler at MCU time `tMicros` (timer libraries such as TimerOne); it respects noInterrupts() */
  schedule?(tMicros: number, fn: () => unknown): void
  serialIn(text: string): void
  /** a line on the serial monitor from outside the sketch (e.g. the ESP32 ROM bootloader) */
  serialOut(line: string): void
  attachI2c(address: number, device: unknown): void
  attachSpi(csPin: number, device: unknown): void
  /** listen to the sketch's bus activity (Serial, Wire, SPI); safe to call before upload */
  tapBus?(monitor: BusMonitor): void
  /** MCU virtual time, µs */
  readonly timeMicros: number
  readonly running: boolean
}

export interface BehaviorContext {
  /** sim time, seconds */
  t: number
  solution: Solution | null
  pins: Record<number, PinState>
  powered: boolean
  /** this instance's params (lesson defaults, then tweaks `behavior:<instance>.<param>`) */
  params: Record<string, number | string | boolean>
  /** the netlist being simulated (patched, read-only) */
  readonly netlist: Netlist
  /** node voltage (relative to `ref`, default ground) from the latest good solution */
  v(node: NodeId, ref?: NodeId): number
  /** publish a value readable by Readout { kind:'behavior', key } and 3D parts */
  publish(key: string, value: number): void
  /** a value another behavior published, by its full key `<instance>.<key>` (undefined when unset) */
  read?(key: string): number | undefined
  /**
   * change a netlist element parameter live (e.g. sensor resistance). From tick it applies at the next
   * frame; from onStep it applies from the next transient step (switch bounce, sub-ms events)
   */
  setParam(elementId: string, key: string, value: number | boolean): void
  /** shaft load torque on a MOTOR, N·m */
  setMotorLoad(elementId: string, torque: number): void
  /** fail a part as if its rating had been exceeded */
  /** `detail` (optional) states what killed the part: value / limit for the FAULT text, or a whole `note` ("failed: …") */
  burn(elementId: string, reason: BurnEvent['reason'], detail?: { value?: number; limit?: number; note?: string }): void
  /** timeline events for instruments (logic analyser, scope markers) */
  events: { push(e: BehaviorEvent): void }
  mcu: BehaviorMcu
}

/** bench moments a behavior can react to (after the assembly state has changed) */
export type BehaviorLifecycleEvent = 'power-on' | 'power-off' | 'upload' | 'repair' | 'strip' | 'break'

export interface Behavior {
  id: string
  /** objects exposed to sketches as globals, e.g. { mpu: {...} } or classes like Servo */
  libraries?: (ctx: BehaviorContext) => Record<string, unknown>
  init?(ctx: BehaviorContext): void
  /** dt in seconds; called once per animation frame with the sim time that frame covered */
  tick?(ctx: BehaviorContext, dt: number): void
  onEvent?(ctx: BehaviorContext, ev: BehaviorLifecycleEvent): void
  /**
   * One instantaneous solve of a transient step, in time order, at sim time `t` (s): one per step,
   * one per edge substep and one per switched-PWM piece (exactly what the scope samples), called
   * inside the frame's stepping loop before tick. For meters that must see the waveform between
   * frames (RMS, phase). Read the circuit from `solution` (voltageOf / currentOf / extraOf), not
   * ctx.v or ctx.t, which are the last frame's. Called hundreds of times a frame: allocate nothing,
   * publish in tick. Not called on DC (non-transient) benches, or for a step that failed.
   */
  onStep?(ctx: BehaviorContext, t: number, solution: Solution): void
  /**
   * A pin change as the circuit sees it (mode, level), at MCU time `tMicros` (µs since upload): every
   * sketch write that changes the pin, called synchronously inside the MCU's advance (so each edge of
   * a fast pulse train arrives), plus the floats on hold / stop / upload (mode 'INPUT', level 0) and the
   * re-drive on release. Queue them and integrate in tick. Don't call `ctx.v` here: the solution is the
   * last frame's, not the edge's (and a float on upload carries the old run's time).
   */
  onPin?(ctx: BehaviorContext, pin: number, state: PinState, tMicros: number): void
  /** one complete line the sketch printed with Serial (without the newline), as it is printed */
  onSerial?(ctx: BehaviorContext, line: string): void
  /** back to the initial state (after repair or strip): forget internal state, timers, latched faults */
  reset?(ctx: BehaviorContext): void
  /** the bench is going away (lesson switch): release anything held */
  dispose?(ctx: BehaviorContext): void
  /** live data for an instrument panel (e.g. the logic analyzer's capture), read by Bench.behaviorData */
  expose?(ctx: BehaviorContext): unknown
}
