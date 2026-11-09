// T2 · The MOSFET Switch. Source: docs/curriculum/T2/mosfet-switch.md
//
// The NMOS model is a square law (triode: id = k·((Vgs−Vth)·Vds − Vds²/2)), so R_DS(on) = 1/(k·(Vgs−Vth)).
// vth 1.5 V and k 11.4 A/V² reproduce the IRLZ44N datasheet's 25 mΩ at 5 V and 35 mΩ at 4 V
// (it reads 10 mΩ at 10 V, where the real part saturates at 22 mΩ). A 1.7 nF gate capacitor (C_iss)
// makes the gate a real capacitor: its edge shows on the scope once R_G is raised.
import type { Element, LessonDef } from '../../engine/types'
import { PITCH, jumper } from '../layout'

// ── bench layout: one 18 × 11 PCB, everything stands on it (y = 0) ──
const UNO_AT: [number, number] = [4.6, 0] // rot 0: header along the −x edge, USB toward the viewer
const UNO_HEADER_Y = 0.16 + 0.85
const Q1_AT: [number, number] = [-1.0, 0]
const RG_AT: [number, number] = [-3.0, 0]
const RPD_AT: [number, number] = [-1.254, 1.8]
const TERM_AT: [number, number] = [-0.746, -3.0]
const GND_TP: [number, number] = [0.5, 2.308]
const JACK: [number, number] = [-6.5, 2.5]
const HEATER_AT: [number, number] = [-4.5, -3.2]

const unoPin = (pin: 9 | 'GND'): [number, number, number] => {
  const lx = pin === 'GND' ? -0.25 + (3 - 4.5) * PITCH : -0.25 + (4.5 - (pin - 8)) * PITCH
  return [UNO_AT[0] - 2.4, UNO_HEADER_Y, UNO_AT[1] - lx]
}
const RG_PIN: [number, number, number] = [RG_AT[0] - 0.508, 0.3, RG_AT[1]]
const GND_PT: [number, number, number] = [GND_TP[0], 0.3, GND_TP[1]]
const TERM_D: [number, number, number] = [TERM_AT[0] - 0.254, 0.4, TERM_AT[1] - 0.1]
const TERM_P: [number, number, number] = [TERM_AT[0] + 0.254, 0.4, TERM_AT[1] - 0.1]
const JACK_P: [number, number, number] = [JACK[0] + 0.6, 0.3, JACK[1] - 0.45]
const JACK_N: [number, number, number] = [JACK[0] + 0.3, 0.3, JACK[1] - 0.45]
const HEATER_D: [number, number, number] = [HEATER_AT[0] + 1.1, 0.3, HEATER_AT[1]]
const HEATER_P: [number, number, number] = [HEATER_AT[0] - 1.1, 0.3, HEATER_AT[1]]

type Wire = ReturnType<typeof jumper>
const wire = (w: Wire, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

/**
 * IRLZ44N (TO-220AB) from the Infineon/IR datasheet: V_DSS 55 V; V_GS(th) 1.0–2.0 V; R_DS(on) 22 mΩ
 * at 10 V, 25 mΩ at 5 V (I_D 25 A), 35 mΩ at 4 V; V_GS ±16 V; T_J max 175 °C; R_θJA 62 °C/W in free air.
 * maxP is the free-air limit, (175 − 25)/62 = 2.4 W; Tj follows P with a time-compressed lag.
 */
const Q1: Element = {
  id: 'Q1',
  type: 'NMOS',
  nodes: ['d', 'g', '0'],
  vth: 1.5,
  k: 11.4,
  rating: { maxI: 47, maxP: 2.4, maxV: 55, rth: 62, tauTh: 1.5, tMax: 175, failMode: 'short' },
  partId: 'q1',
}

const sketch = `// Low-side MOSFET switch on pin 9: heater on 3 s, off 3 s
const int GATE_PIN = 9;

void setup() {
  pinMode(GATE_PIN, OUTPUT);
  digitalWrite(GATE_PIN, LOW);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(GATE_PIN, HIGH);
  Serial.println("heater ON");
  delay(3000);
  digitalWrite(GATE_PIN, LOW);
  Serial.println("heater OFF");
  delay(3000);
}
`

export const lesson: LessonDef = {
  id: 'mosfet-switch',
  track: 'T2',
  title: 'The MOSFET Switch',
  subtitle: 'A voltage-driven power gate',
  tagline: 'With 5 V on its gate, an IRLZ44N is about 25 mΩ, so switching a 1 A heater costs it just 25 mW.',

  board: {
    name: 'FET-19',
    size: [18, 11],
    base: 'mat',
    traces: [
      [[RG_AT[0] + 0.508, 0], [Q1_AT[0] - 0.254, 0]], // R_G to the gate
      [[Q1_AT[0] - 0.254, 0], [Q1_AT[0] - 0.254, 1.292]], // gate to the pull-down
      [[Q1_AT[0] + 0.254, 0], [Q1_AT[0] + 0.254, GND_TP[1]], [GND_TP[0], GND_TP[1]]], // source to the ground rail
      [[RPD_AT[0], 2.308], [GND_TP[0], GND_TP[1]]], // pull-down to ground
      [[Q1_AT[0], 0], [Q1_AT[0], TERM_AT[1] - 0.1]], // drain to the terminal
    ],
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], 0, UNO_AT[1]],
        mount: 'module',
        label: 'UNO',
        role: 'Pin 9 drives the gate through R_G. USB powers the Uno.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [1.2, 1.8, 0.4] },
        circuitIds: ['PIN9', 'V_USB'],
      },
      {
        id: 'q1',
        kind: 'mosfet-to220',
        pos: [Q1_AT[0], 0, Q1_AT[1]],
        mount: 'tht',
        label: 'MOSFET',
        role: 'IRLZ44N, a logic-level N-channel low-side switch: gate, drain, source.',
        params: { callout: [0.2, 2.4, -0.8] },
        circuitIds: ['Q1'],
        facts: [
          'V_DSS 55 V, I_D 47 A at 25 °C (package-limited)',
          'V_GS(th) 1.0–2.0 V (at I_D = 250 µA: only the start of conduction)',
          'R_DS(on) 22 mΩ at V_GS = 10 V, 25 mΩ at 5 V, 35 mΩ at 4 V (max)',
          'V_GS ±16 V abs. max; T_J 175 °C max',
          'R_θJA 62 °C/W in free air (TO-220, no heatsink)',
          'A plain IRFZ44N is not logic-level: V_GS(th) 2–4 V, R_DS(on) rated only at 10 V',
        ],
      },
      {
        id: 'rg',
        kind: 'resistor',
        pos: [RG_AT[0], 0, RG_AT[1]],
        mount: 'tht',
        label: 'GATE',
        role: 'Limits the gate-charging current spike and damps ringing (100 Ω: brown-black-brown-gold).',
        params: { ohms: 100, callout: [0, 1.0, -0.8] },
        circuitIds: ['R_G'],
        facts: ['1/4 W, 5 %'],
      },
      {
        id: 'rpd',
        kind: 'resistor',
        pos: [RPD_AT[0], 0, RPD_AT[1]],
        rot: 90,
        mount: 'tht',
        label: 'PULLDOWN',
        role: 'Holds the gate low while the MCU boots (10 kΩ: brown-black-orange-gold).',
        params: { ohms: 10000, callout: [-1.0, 1.0, 0.4] },
        circuitIds: ['R_PD'],
        facts: ['1/4 W, 5 %', 'draws 4.9 V / 10 kΩ ≈ 0.5 mA from pin 9 while HIGH'],
      },
      {
        id: 'term',
        kind: 'screw-terminal',
        pos: [TERM_AT[0], 0, TERM_AT[1]],
        mount: 'tht',
        label: 'TERMINAL',
        role: 'Heater wiring: drain on the left screw, +12 V on the right. An amp is too much for breadboard clips.',
        params: { pins: 2, callout: [0.4, 1.5, -0.6] },
      },
      {
        id: 'gndtp',
        kind: 'testpoint',
        pos: [GND_TP[0], 0, GND_TP[1]],
        mount: 'tht',
        label: 'GND RAIL',
        role: 'The shared ground: Q1 source, pull-down, Uno GND and the 12 V negative all meet here.',
        params: { color: 'black', callout: [0.4, 1.0, 0.5] },
      },
      {
        id: 'jack',
        kind: 'barrel-jack',
        pos: [JACK[0], 0, JACK[1]],
        mount: 'offboard',
        label: '12 V IN',
        role: '12 V supply for the heater (a 2 A adapter is plenty for the 1 A heater).',
        params: { callout: [0.4, 1.4, 0.4] },
        circuitIds: ['V_12'],
      },
      {
        id: 'load',
        kind: 'resistor',
        pos: [HEATER_AT[0], 0, HEATER_AT[1]],
        mount: 'offboard',
        label: 'HEATER',
        role: 'A 12 Ω heater element, 12 W at 12 V: the load.',
        params: { ohms: 12, span: 2.2, callout: [0, 1.2, -0.6] },
        circuitIds: ['R_LOAD'],
        facts: ['12 V / 12 Ω = 1 A, 12 W', 'rated 150 W so a lower-resistance swap does not burn it'],
      },
      { id: 'w-pin9', kind: 'wire', ...wire(jumper(unoPin(9), RG_PIN, 'yellow', 0.9), [0, 0.9, 0.3]), mount: 'offboard', label: 'PIN 9', role: 'Pin 9 to the gate resistor.' },
      { id: 'w-ugnd', kind: 'wire', ...wire(jumper(unoPin('GND'), GND_PT, 'black', 0.5), [0, 0.6, 0.2]), mount: 'offboard', role: 'Uno GND to the PCB ground rail.' },
      {
        id: 'wg',
        kind: 'wire',
        ...wire(jumper(JACK_N, GND_PT, 'black', 0.6), [0, 0.8, 0.3]),
        mount: 'offboard',
        label: 'GROUND',
        role: 'Common ground: the 12 V negative to the Uno GND rail.',
        circuitIds: ['W_GND'],
      },
      { id: 'w-12v', kind: 'wire', ...wire(jumper(JACK_P, TERM_P, 'red', 0.7), [0, 0.7, 0]), mount: 'offboard', role: '12 V positive to the terminal.' },
      { id: 'w-hp', kind: 'wire', ...wire(jumper(HEATER_P, TERM_P, 'red', 0.5), [0, 0.5, 0]), mount: 'offboard', role: 'Heater end to the +12 V screw.' },
      { id: 'w-hd', kind: 'wire', ...wire(jumper(HEATER_D, TERM_D, 'blue', 0.4), [0, 0.5, 0]), mount: 'offboard', role: 'Heater other end to the drain screw.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_USB', type: 'V', nodes: ['usb5v', '0'], value: 5, rInternal: 0.1, partId: 'uno' },
      { id: 'PIN9', type: 'PIN', nodes: ['p9', '0'], pin: 9, vcc: 5, rOut: 25, rating: { maxI: 0.04 }, partId: 'uno' },
      { id: 'R_G', type: 'R', nodes: ['p9', 'g'], value: 100, rating: { maxP: 0.25 }, partId: 'rg' },
      { id: 'R_PD', type: 'R', nodes: ['g', '0'], value: 10e3, rating: { maxP: 0.25 }, partId: 'rpd' },
      // C_iss of the IRLZ44N, 1.7 nF: the gate is a capacitor
      { id: 'C_GS', type: 'C', nodes: ['g', '0'], value: 1.7e-9, partId: 'q1' },
      Q1,
      { id: 'V_12', type: 'V', nodes: ['v12', 'gnd12'], value: 12, rInternal: 0.1, partId: 'jack' },
      { id: 'W_GND', type: 'R', nodes: ['gnd12', '0'], value: 0.01, partId: 'wg' },
      { id: 'R_LOAD', type: 'R', nodes: ['v12', 'd'], value: 12, rating: { maxP: 150 }, partId: 'load' },
    ],
  },
  powerElementId: 'V_USB',
  powerLabel: 'Plug USB',
  // the gate-charging edge lasts microseconds: split each switching step so the scope resolves it
  sim: { edgeSubsteps: 10 },

  readouts: [
    { label: 'LOAD CURRENT', source: { kind: 'current', elementId: 'R_LOAD' }, unit: 'A' },
    { label: 'GATE', source: { kind: 'voltage', node: 'g' }, unit: 'V' },
    { label: 'V DS', source: { kind: 'voltage', node: 'd' }, unit: 'V' },
    { label: 'FET POWER', source: { kind: 'power', elementId: 'Q1' }, unit: 'W' },
    { label: 'LOAD POWER', source: { kind: 'power', elementId: 'R_LOAD' }, unit: 'W' },
    { label: 'FET TEMP', source: { kind: 'extra', key: 'Q1.tj' }, unit: '°C' },
    { label: 'R DS(ON)', source: { kind: 'derived', op: 'ratio', of: [2, 0] }, unit: 'Ω' },
  ],

  instruments: {
    scope: {
      channels: [
        { label: 'GATE', source: { kind: 'voltage', node: 'g' }, perDiv: 1, offset: -3, marks: [{ value: 2, label: 'V_GS(th) max 2 V' }] },
        { label: 'V DS', source: { kind: 'voltage', node: 'd' }, perDiv: 4, offset: -3.5 },
      ],
      timePerDiv: 50e-6,
      trigger: { channel: 0, level: 0.5, slope: 'rising', mode: 'normal' },
    },
    chart: { signals: [0, 3, 5], span: 10 },
  },

  sketch: { title: 'Heater on/off', code: sketch, pins: { 9: 'PIN9' }, vcc: 5, board: 'uno' },

  tweaks: [
    {
      label: 'Pin 9 HIGH level',
      elementId: 'PIN9',
      key: 'vcc',
      kind: 'enum',
      min: 3.3,
      max: 5,
      unit: 'V',
      options: [
        { label: '3.3 V', value: 3.3 },
        { label: '5 V', value: 5 },
      ],
    },
    { label: 'Gate resistor', elementId: 'R_G', key: 'value', min: 10, max: 10000, log: true, unit: 'Ω' },
    { label: 'Load resistance', elementId: 'R_LOAD', key: 'value', min: 2, max: 100, log: true, unit: 'Ω' },
    { label: 'MOSFET threshold (swap part)', elementId: 'Q1', key: 'vth', min: 1, max: 4.9, step: 0.1, unit: 'V' },
  ],

  statusLines: [
    { when: { kind: 'pin', pin: 9, level: 0 }, text: 'RUNNING: pin 9 LOW, the gate is pulled to 0 V and the heater is off' },
    { when: { kind: 'pin', pin: 9, level: 1 }, text: 'RUNNING: pin 9 HIGH, gate at {1}, {0} through the heater, FET drops only {2}' },
    { when: { kind: 'above', readout: 3, value: 0.3 }, text: 'WARNING: Q1 dissipates {3} (junction {5}): it is only half on or carrying too much' },
  ],

  failures: [
    {
      id: 'wrong-fet-3v3',
      label: 'Plain IRFZ44N on a 3.3 V pin',
      explain:
        'An IRFZ44N-type part has V_GS(th) of 2–4 V and its R_DS(on) is specified only at 10 V. A sample near the top of the spread does not conduct at all from 3.3 V (this one: 3.5 V threshold), the gate sits at about 3.26 V, V_DS stays at 12 V and the heater stays cold. Others conduct partly and overheat. Either way, the design is wrong: pick by R_DS(on) at the gate voltage you have.',
      patches: [
        { op: 'set', elementId: 'PIN9', key: 'vcc', value: 3.3 },
        { op: 'set', elementId: 'Q1', key: 'vth', value: 3.5 },
      ],
    },
    {
      id: 'fet-short',
      label: 'The MOSFET fails short',
      explain:
        'MOSFETs usually fail drain-to-source short after overheating, overvoltage or ESD. The heater now runs at full power whatever pin 9 does. Anything that must be able to switch off (heaters, motors) needs an independent fuse or thermal cutout.',
      patches: [{ op: 'short', a: 'd', b: '0' }],
    },
    {
      id: 'no-common-ground',
      label: 'Forget the common ground',
      explain:
        'The gate is still at 4.9 V relative to the Uno GND, but the heater current must return to the 12 V adapter negative through Q1’s source. Without the link the loop is open, so the load current is 0 and V_GS is not even defined relative to the load circuit.',
      patches: [{ op: 'remove', elementId: 'W_GND' }],
      parts: { hide: ['wg'] },
    },
    {
      id: 'overload',
      label: 'Swap in a 1 Ω heater (12 A) with no heatsink',
      explain:
        'At 12 A the FET dissipates I²·R_DS(on) = 144 × 0.025 ≈ 3.7 W. In free air a TO-220 has R_θJA of 62 °C/W, so the junction heads for 25 + 62 × 3.7 ≈ 250 °C, past the 175 °C limit. It fails short, leaving the heater stuck on. (A real R_DS(on) also climbs as the die heats, making it worse.) It needs a heatsink or a lower-R_DS(on) part.',
      patches: [{ op: 'set', elementId: 'R_LOAD', key: 'value', value: 1 }],
    },
  ],

  guide: [
    {
      id: 'meet-the-mosfet',
      title: 'Meet the MOSFET',
      body: 'Click **Q1** to open its inspector. It is a logic-level N-channel MOSFET, an **IRLZ44N**: its on-resistance is specified at a gate voltage of **5 V**.',
      check: { kind: 'inspect', part: 'q1' },
      focus: { part: 'q1' },
      hint: 'It is the black TO-220 part with a metal tab, standing on the board.',
      explain: 'A MOSFET is voltage controlled: the gate draws no steady current, only the charge to fill its capacitance. Gate above the threshold and the channel conducts. A "logic-level" part is built to be fully on at 5 V, or even 3.3 V.',
    },
    {
      id: 'power',
      title: 'Plug in',
      body: 'Press **Plug USB**. The Uno powers up and the heater’s 12 V supply is live. The gate is still pulled to 0 V, so **LOAD CURRENT** is 0 and **V DS** sits at the full **12 V**.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'power' }, { kind: 'status', is: 'POWERED' }, { kind: 'readout', index: 2, above: 11.5, holdMs: 300 }] },
      focus: { control: 'power' },
      explain: 'With the gate at 0 V the channel is off and the FET stands off the whole 12 V. The pull-down resistor on the gate keeps it off while the Uno is still booting or unplugged.',
    },
    {
      id: 'upload',
      title: 'Upload the sketch',
      body: 'Press **Upload**. Pin 9 goes HIGH for 3 s, then LOW for 3 s.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'upload' }, { kind: 'status', is: 'RUNNING' }] },
      focus: { control: 'upload' },
      explain: 'The sketch sets pin 9 to OUTPUT and toggles it. The pin supplies 5 V into the gate; the gate takes a few nanocoulombs to charge, then no current at all.',
    },
    {
      id: 'on-state',
      title: 'Read the ON state',
      body: 'While pin 9 is HIGH, read **LOAD CURRENT** (about **1 A**), **V DS** (about **25 mV**) and **R DS(ON)** (about **25 mΩ**).',
      check: {
        kind: 'all',
        of: [
          { kind: 'readout', index: 0, above: 0.9, below: 1.05, holdMs: 500 },
          { kind: 'readout', index: 2, below: 0.05, holdMs: 500 },
          { kind: 'readout', index: 6, above: 0.02, below: 0.03, holdMs: 500 },
        ],
      },
      focus: { part: 'q1' },
      hint: 'The readings only show up while pin 9 is HIGH. They stay for 3 s, then go back to the OFF state.',
      explain: 'The heater is 12 V / 12 Ω = 1 A. The FET drops I × R_DS(on) = 1 A × 25 mΩ = 25 mV and dissipates just 25 mW, so the heater gets 11.7 W of the 12 W. R DS(ON) is simply V DS divided by the load current.',
    },
    {
      id: 'three-volt-three',
      title: 'Drive it from 3.3 V',
      body: 'Set **Pin 9 HIGH level** to **3.3 V**, like a 3.3 V board. The gate gets less drive, so **R DS(ON)** doubles to about **50 mΩ**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Pin 9 HIGH level', max: 3.3 },
          { kind: 'readout', index: 2, above: 0.04, below: 0.06, holdMs: 500 },
          { kind: 'readout', index: 6, above: 0.04, below: 0.06, holdMs: 500 },
        ],
      },
      focus: { control: 'tweak:Pin 9 HIGH level' },
      hint: 'The readings need pin 9 HIGH, so they appear within 3 s of the change.',
      explain: 'R_DS(on) = 1 / (k·(V_GS − V_th)), so a gate of 3.3 V against 5 V cuts the overdrive from 3.4 V to 1.8 V and doubles the resistance. It still works here: the FET passes 1 A and dissipates 50 mW. The lesson is to read R_DS(on) at the gate voltage you will actually have.',
    },
    {
      id: 'open-scope',
      title: 'Watch the gate',
      body: 'Open **Instruments**. The scope shows **GATE** against **V DS** across a turn-on. The 2 V line marks the **maximum** gate threshold.',
      check: { kind: 'instruments' },
      focus: { control: 'instruments' },
      explain: 'The gate is a capacitor (about 1.7 nF here), charged through the gate resistor, so its edge has a finite slope: time constant R_G·C_iss. Raise the gate resistor to watch it slow down. V DS falls only when the gate crosses the threshold.',
    },
    {
      id: 'wrong-fet',
      title: 'Break it: the wrong FET',
      body: 'Open **Break something** and choose **Plain IRFZ44N on a 3.3 V pin**. The gate reaches about **3.3 V**, yet **LOAD CURRENT** falls to **0**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'break', failure: 'wrong-fet-3v3' },
          { kind: 'readout', index: 1, above: 3, below: 3.4, holdMs: 300 },
          { kind: 'readout', index: 0, below: 0.05, holdMs: 300 },
        ],
      },
      focus: { control: 'break' },
      hint: 'Wait for pin 9 to go HIGH, within 3 s of the break.',
      explain: 'A standard IRFZ44N has a threshold of 2 to 4 V, and its R_DS(on) is only specified at 10 V. This sample sits at 3.5 V, so a 3.3 V gate never turns it on, and V DS stays at 12 V. Pick MOSFETs by R_DS(on) at your gate voltage, not by name.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: they use I²R and the gate threshold.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  meet: `A MOSFET's gate is insulated from its channel by a thin oxide layer. Apply V_GS above the threshold and an N-channel forms between drain and source; its resistance R_DS(on) falls the harder you drive the gate. At DC the gate draws essentially **no current**. It charges and discharges like a capacitor (the IRLZ44N's C_iss is about 1.7 nF), so current flows only during the edge. Raise the **Gate resistor** tweak and watch the gate trace on the scope slow down.

**Thresholds mislead.** V_GS(th) is where the part *begins* to conduct, at 250 µA. For the IRLZ44N it is 1–2 V. What matters is R_DS(on) at your gate voltage: this logic-level part is specified at ≤ **25 mΩ at 5 V** and 35 mΩ at 4 V, so an Uno drives it fully on. A plain IRFZ44N has V_GS(th) 2–4 V and is rated only at 10 V, so it is **not** logic-level.

**Gate voltage.** R_G and the pull-down form a small divider with the pin's 25 Ω: V_GS = 5 × 10k/(10k + 125) = **4.94 V**. The pull-down is what pin 9 sources in steady state (about 0.5 mA), against 8.6 mA of base current in the BJT lesson.

**Conduction loss.** I = 12/(12 + 0.1 + 0.025) ≈ **0.99 A**, so P = I²·R_DS(on) ≈ **25 mW**. Push 10 A through the same part and P = 10² × 0.025 = **2.5 W**. In free air a TO-220 has R_θJA ≈ 62 °C/W, so the junction would rise about 155 °C.

**3.3 V drive.** The IRLZ44N is not specified below 4 V, but at 3.3 V it still conducts a 1 A heater (the model gives about 50 mΩ). Choose parts by R_DS(on) at your gate voltage.`,

  mechanicalAnalogy: `A MOSFET is like a valve held open by pilot pressure on a sealed piston. Once you have pressurised the piston (charged the gate), no further pilot flow is needed to hold it, unlike the BJT's continuous pilot flow. R_DS(on) is the pressure drop of the fully open valve. Too little pilot pressure (V_GS) and it throttles and heats.

**Where it breaks:** every power MOSFET hides a "body diode" from source to drain, a built-in reverse check valve you cannot remove. The gate oxide is punctured by tens of volts or by static (±16 V maximum here).`,

  proTips: [
    'Choose MOSFETs by "R_DS(on) at V_GS = 4.5 V" (or 2.5 V for 3.3 V logic) in the datasheet table. Never choose by V_GS(th).',
    'Always fit a gate pull-down (10–100 kΩ) and a small gate resistor (22–220 Ω). For PWM above a few kHz, use a gate-driver IC, because MCU pins charge big gates slowly.',
    'Inductive loads (motors, solenoids) still need a flyback diode across the load. Do not count on the MOSFET avalanche rating to absorb the energy.',
  ],

  quiz: [
    {
      q: 'What is the conduction loss at 3 A through 25 mΩ?',
      options: ['0.075 W', '0.75 W', '0.225 W', '2.25 W'],
      answer: 2,
      why: 'P = I²R = 9 × 0.025 = 0.225 W.',
    },
    {
      q: 'A TO-220 in free air (62 °C/W) dissipates 1.5 W. What is its junction temperature rise?',
      options: ['24 °C', '41 °C', '93 °C', '155 °C'],
      answer: 2,
      why: 'ΔT = P·θ = 1.5 × 62 = 93 °C.',
    },
    {
      q: 'What does V_GS(th) on a datasheet tell you?',
      options: [
        'The gate voltage at which the device just begins to conduct (a small specified drain current)',
        'The voltage for minimum R_DS(on)',
        'The maximum safe gate voltage',
        'The drain breakdown voltage',
      ],
      answer: 0,
      why: 'It is measured at a tiny drain current (e.g. 250 µA), so the device is far from fully on there.',
    },
    {
      q: 'Why fit a 10 kΩ resistor from gate to source?',
      options: [
        'To increase switching speed',
        'To hold the gate low (FET off) when the driving pin floats, e.g. during reset',
        'To limit the drain current',
        'To protect against reverse polarity',
      ],
      answer: 1,
      why: 'An insulated gate holds charge, so a floating gate can leave the load half on.',
    },
  ],
}
