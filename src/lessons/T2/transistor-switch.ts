// T2 · The Transistor Switch (video Fig. 03). Source: docs/curriculum/T2/transistor-switch.md
import type { Element, LessonDef } from '../../engine/types'
import { BENCH_Y, UNO, bbHole, between, jumper } from '../layout'

// Bench layout (the camera looks from +x +z): breadboard front left, Uno front right with its
// digital header facing the breadboard, the 4 × AA motor pack behind the breadboard (leads toward
// it) and the motor behind the Uno (tabs toward the breadboard, shaft flag toward the viewer).
const BB: [number, number] = [-2.5, 3.0]
const UNO_AT: [number, number] = [4.3, 2.8]
const PACK_AT: [number, number] = [-5.5, -4.2]
const MOTOR_AT: [number, number] = [3.5, -2.0]

// Breadboard: the top rails carry the motor supply (+t = pack +6 V, −t = pack −), the bottom − rail
// is the Uno's GND; the GROUND jumper at column 1 joins the two grounds. Driver in the top half:
// Q1 (E-B-C, flat side toward the viewer) in row c across columns 13-14-15, R_B in row d from the
// base column 14 to column 18 (pin 9), and D1 in front in row e from the collector column 15 to
// column 19, which a short red jumper ties to the +6 V rail.
const C_E = 13
const C_B = 14
const C_C = 15
const C_PLUS = 19
const C_PIN = 18

const q1At = bbHole(BB, C_B, 'c')
const rbBase = bbHole(BB, C_B, 'd')
const rbPin = bbHole(BB, C_PIN, 'd')
const d1Anode = bbHole(BB, C_C, 'e')
const d1Cathode = bbHole(BB, C_PLUS, 'e')
const pin9 = UNO.digital(UNO_AT, 9)
const unoGnd = UNO.digital(UNO_AT, 'GND')

/** where the pack's own red (+) / black (−) leads end (pack at rot 90: leads leave toward +z) */
const packLead = (c: 'red' | 'black'): [number, number, number] =>
  c === 'red' ? [PACK_AT[0] - 0.1, BENCH_Y + 0.06, PACK_AT[1] + 4.1] : [PACK_AT[0] + 0.45, BENCH_Y + 0.06, PACK_AT[1] + 4.05]
/** the motor's two solder tabs (motor at rot 180: its tab end cap faces −x, toward the breadboard) */
const motorTab = (dz: number): [number, number, number] => [MOTOR_AT[0] - 1.62, BENCH_Y + 0.95, MOTOR_AT[1] + dz]

const wPin9 = jumper(pin9, bbHole(BB, C_PIN, 'a'), 'yellow')
const wEmit = jumper(bbHole(BB, C_E, 'e'), bbHole(BB, C_E, '-b'), 'black', 0.3)
const wUnoGnd = jumper(unoGnd, bbHole(BB, 28, '-b'), 'black', 0.6)
const wPackPlus = jumper(packLead('red'), bbHole(BB, 3, '+t'), 'red', 0.4)
const wPackMinus = jumper(packLead('black'), bbHole(BB, 5, '-t'), 'black', 0.4)
const wGnd = jumper(bbHole(BB, 1, '-t'), bbHole(BB, 1, '-b'), 'black', 0.5)
const wMotorPlus = jumper(motorTab(0.42), bbHole(BB, 21, '+t'), 'red', 0.5)
const wMotorMinus = jumper(motorTab(-0.42), bbHole(BB, C_C, 'a'), 'blue', 0.6)
const wPlus6 = jumper(bbHole(BB, C_PLUS, 'a'), bbHole(BB, C_PLUS, '+t'), 'red', 0.15)
// the "skip the base resistor" failure: a bare jumper bridges R_B's two columns
const jRb = jumper(rbBase, rbPin, 'green', 0.22)
// the "motor straight on the pin" failure: the motor's leads moved to pin 9's column and ground
const wMotorPin = jumper(motorTab(0.42), bbHole(BB, C_PIN, 'c'), 'yellow', 0.6)
const wMotorGnd = jumper(motorTab(-0.42), bbHole(BB, 23, '-t'), 'black', 0.5)

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

/**
 * PN2222A (TO-92) absolute maximums: V_CEO 40 V, I_C 600 mA, 625 mW. The avalanche clamp sits at
 * 60 V, between V_CEO (40 V) and V_CBO (75 V): an unprotected inductive kick drives V_CE there,
 * far above the 40 V rating. Transistors usually fail shorted.
 */
const Q1: Element = {
  id: 'Q1',
  type: 'NPN',
  nodes: ['c', 'b', '0'],
  beta: 150,
  vBreak: 60,
  rating: { maxI: 0.6, maxP: 0.625, maxV: 40, failMode: 'short' },
  partId: 'q1',
}

/** illustrative small 130-size brushed motor: ≈ 0.18 A and ≈ 9 500 rpm free-running at 6 V */
const M1: Element = {
  id: 'M1',
  type: 'MOTOR',
  nodes: ['pk', 'c'],
  r: 4,
  l: 1e-3,
  ke: 0.005,
  kt: 0.005,
  j: 1e-6,
  b: 9e-7,
  load: 0,
  partId: 'm1',
}

const sketch = `// Switch a motor with an NPN low-side driver on pin 9
const int MOTOR_PIN = 9;

void setup() {
  pinMode(MOTOR_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(MOTOR_PIN, HIGH);
  Serial.println("motor ON");
  delay(2000);
  digitalWrite(MOTOR_PIN, LOW);
  Serial.println("motor OFF");
  delay(2000);
}
`

export const lesson: LessonDef = {
  id: 'transistor-switch',
  fig: 3,
  track: 'T2',
  title: 'The Transistor Switch',
  subtitle: 'Small current commands big',
  tagline: 'Pin 9 sources under 9 mA, yet through a PN2222A it switches a 6 V hobby motor drawing around 180 mA.',

  board: {
    name: 'NPN-18',
    size: [18, 14],
    base: 'breadboard-only',
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], BENCH_Y, UNO_AT[1]],
        mount: 'module',
        label: 'UNO',
        role: 'ATmega328P at 5 V; pin 9 gives the command. USB powers the Uno.',
        params: { variant: 'uno', title: 'ATELIER UNO' },
        circuitIds: ['PIN9', 'V_USB'],
      },
      {
        id: 'bb',
        kind: 'breadboard',
        pos: BB,
        mount: 'offboard',
        label: 'BREADBOARD',
        role: 'Holds the driver: base resistor, transistor and flyback diode.',
        params: { callout: [-3.2, 0.6, 2.2] },
      },
      {
        id: 'rb',
        kind: 'resistor',
        pos: between(rbBase, rbPin),
        mount: 'tht',
        label: 'BASE',
        role: 'Limits the base current to ≈ 8.6 mA (470 Ω: yellow-violet-brown-gold, 1/4 W).',
        params: { ohms: 470, callout: [1.0, 1.4, 2.6] },
        circuitIds: ['R_B'],
      },
      {
        id: 'q1',
        kind: 'transistor-to92',
        pos: q1At,
        mount: 'tht',
        label: 'SWITCH',
        role: 'PN2222A NPN, low-side switch: collector to the motor, emitter to ground. Flat side faces you: E-B-C.',
        params: { marking: 'PN2222A', callout: [0.4, 1.6, 1.2] },
        circuitIds: ['Q1'],
      },
      {
        id: 'd1',
        kind: 'diode',
        pos: between(d1Cathode, d1Anode),
        // stripe (cathode, +x) toward column 19, the +6 V column
        mount: 'tht',
        label: 'FLYBACK',
        role: '1N4007: clamps the motor’s inductive kick at turn-off. Stripe (cathode) toward +6 V.',
        params: { marking: '1N4007', callout: [-1.6, 1.2, 2.8] },
        circuitIds: ['D1'],
      },
      {
        id: 'm1',
        kind: 'dc-motor',
        pos: [MOTOR_AT[0], BENCH_Y, MOTOR_AT[1]],
        rot: 180,
        mount: 'offboard',
        label: 'MOTOR',
        role: 'Small 130-size brushed motor (3–6 V): the load, ≈ 0.18 A free-running.',
        params: { callout: [0, 1.6, 0] },
        circuitIds: ['M1'],
      },
      {
        id: 'pack',
        kind: 'battery-aa-pack',
        pos: [PACK_AT[0], BENCH_Y, PACK_AT[1]],
        rot: 90,
        mount: 'offboard',
        label: 'PACK',
        role: 'Separate 6 V motor supply: 4 × AA alkaline.',
        params: { cells: 4, callout: [0, 1.8, 0] },
        circuitIds: ['V_PACK'],
      },
      { id: 'w-pin9', kind: 'wire', ...withCallout(wPin9, [1.4, 1.0, -0.3]), mount: 'offboard', label: 'PIN 9', role: 'Pin 9 to the base resistor.' },
      { id: 'w-emit', kind: 'wire', ...wEmit, mount: 'offboard', role: 'Emitter to the ground rail.' },
      { id: 'w-uno-gnd', kind: 'wire', ...withCallout(wUnoGnd, [0.8, 0.3, 1.3]), mount: 'offboard', label: 'UNO GND', role: 'Uno GND to the top ground rail.' },
      { id: 'w-pack-plus', kind: 'wire', ...wPackPlus, mount: 'offboard', role: 'Pack + to the +6 V column.' },
      { id: 'w-pack-minus', kind: 'wire', ...wPackMinus, mount: 'offboard', role: 'Pack − to the bottom rail.' },
      {
        id: 'wg',
        kind: 'wire',
        ...withCallout(wGnd, [-1.2, 0.6, 0.6]),
        mount: 'offboard',
        label: 'GROUND',
        role: 'Common ground: joins the pack’s − to the Uno’s GND.',
        circuitIds: ['W_GND'],
      },
      { id: 'w-motor-plus', kind: 'wire', ...wMotorPlus, mount: 'offboard', role: 'Motor + to the +6 V column.' },
      { id: 'w-plus6', kind: 'wire', ...wPlus6, mount: 'offboard', role: 'Column 19 to the +6 V rail (D1’s cathode).' },
      { id: 'w-motor-minus', kind: 'wire', ...wMotorMinus, mount: 'offboard', role: 'Motor − to the collector column.' },
      {
        id: 'j-rb',
        kind: 'wire',
        ...withCallout(jRb, [0.6, 2.0, -0.6]),
        mount: 'offboard',
        label: 'JUMPER',
        role: 'A bare jumper where the base resistor should be.',
        hidden: true,
      },
      {
        id: 'w-motor-pin',
        kind: 'wire',
        ...withCallout(wMotorPin, [1.0, 1.2, 0]),
        mount: 'offboard',
        label: 'MOTOR ON PIN 9',
        role: 'The motor wired straight to pin 9, no transistor.',
        hidden: true,
      },
      { id: 'w-motor-gnd', kind: 'wire', ...wMotorGnd, mount: 'offboard', role: 'The motor’s other lead to ground.', hidden: true },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_USB', type: 'V', nodes: ['usb5v', '0'], value: 5, rInternal: 0.1, partId: 'uno' },
      { id: 'PIN9', type: 'PIN', nodes: ['p9', '0'], pin: 9, vcc: 5, rOut: 25, rating: { maxI: 0.04 }, partId: 'uno' },
      { id: 'R_B', type: 'R', nodes: ['p9', 'b'], value: 470, rating: { maxP: 0.25 }, partId: 'rb' },
      Q1,
      { id: 'V_PACK', type: 'V', nodes: ['pk', 'bgnd'], value: 6, rInternal: 0.6, partId: 'pack' },
      { id: 'W_GND', type: 'R', nodes: ['bgnd', '0'], value: 0.01, partId: 'wg' },
      M1,
      { id: 'D1', type: 'D', nodes: ['c', 'pk'], rating: { maxI: 1, maxV: 1000 }, partId: 'd1' },
    ],
  },
  powerElementId: 'V_USB',
  powerLabel: 'Plug USB',
  extraPower: [{ elementId: 'V_PACK', label: 'Connect pack' }],
  // τ = L/R = 0.25 ms and the turn-off kick lasts a few µs: the default 1 ms step is fine for the
  // motor, and each switching step is split into 10 substeps (the first ≈ 1 µs) to resolve the kick
  sim: { edgeSubsteps: 10 },

  readouts: [
    { label: 'MOTOR CURRENT', source: { kind: 'current', elementId: 'M1' }, unit: 'A' },
    { label: 'BASE CURRENT', source: { kind: 'extra', key: 'Q1.ib' }, unit: 'A' },
    { label: 'V CE', source: { kind: 'extra', key: 'Q1.vce' }, unit: 'V' },
    { label: 'SPEED', source: { kind: 'extra', key: 'M1.rpm' }, unit: 'rpm' },
    { label: 'Q1 POWER', source: { kind: 'power', elementId: 'Q1' }, unit: 'W' },
    // sampled on every step and edge substep: catches the µs turn-off kick the readouts above miss
    { label: 'V CE PEAK', source: { kind: 'extra', key: 'Q1.vce' }, unit: 'V', peak: true },
  ],

  // The scope samples every sim step and every edge substep (the first ≈ 1 µs after the switch),
  // so the turn-off edge is drawn at µs resolution: clamped at ≈ 6.7 V by D1, or with D1 removed
  // the ≈ 60 V avalanche spike, far over the 40 V V_CEO line. Normal trigger holds the last edge.
  instruments: {
    scope: {
      channels: [
        {
          label: 'V CE',
          source: { kind: 'voltage', node: 'c' },
          perDiv: 10,
          offset: -3,
          marks: [{ value: 40, label: 'V_CEO 40 V' }],
        },
        { label: 'I MOTOR', source: { kind: 'current', elementId: 'M1' }, perDiv: 0.1, offset: -3.5 },
      ],
      timePerDiv: 0.5e-3,
      trigger: { channel: 0, level: 3, slope: 'rising', mode: 'normal' },
    },
    chart: { signals: [0, 2, 3], span: 10 },
  },

  sketch: { title: 'Motor on/off', code: sketch, pins: { 9: 'PIN9' }, vcc: 5, board: 'uno' },

  tweaks: [
    { label: 'Base resistor', elementId: 'R_B', key: 'value', min: 100, max: 47000, log: true, unit: 'Ω' },
    { label: 'Motor load torque', elementId: 'M1', key: 'load', min: 0, max: 0.002, step: 0.0001, unit: 'N·m' },
  ],

  statusLines: [
    { when: { kind: 'pin', pin: 9, level: 0 }, text: 'RUNNING: pin 9 LOW, Q1 is off and the motor coasts down' },
    { when: { kind: 'pin', pin: 9, level: 1 }, text: 'RUNNING: pin 9 HIGH, the transistor saturates and the motor spins: {0} at {3}' },
    { when: { kind: 'above', readout: 4, value: 0.05 }, text: 'WARNING: Q1 dissipates {4} with V_CE at {2}: it is not saturated and is heating' },
  ],

  failures: [
    {
      id: 'no-flyback',
      label: 'Remove the flyback diode',
      explain:
        'At the first turn-off the winding’s inductance keeps its current flowing, and with no diode the only path is through Q1 breaking down: the collector spikes to its ≈ 60 V avalanche, far above the 40 V V_CEO. Q1 fails short, so the motor now runs continuously and the sketch can no longer stop it. Transistors usually fail shorted, which leaves the load stuck ON, the unsafe direction. The sim fails Q1 at the first kick to make the point; a real part usually survives a few of these ≈ 16 µJ kicks (½·L·I² = ½ × 1 mH × 0.18²) and dies from repeated ones.',
      patches: [{ op: 'remove', elementId: 'D1' }],
      parts: { hide: ['d1'] },
    },
    {
      id: 'no-base-resistor',
      label: 'Skip the base resistor (jumper in its place)',
      explain:
        'The base-emitter junction is a diode (≈ 0.8 V), so only the pin’s ≈ 25 Ω output resistance limits the current: (5 − 0.8)/25 ≈ 170 mA, four times the 40 mA absolute maximum. Pin 9 dies.',
      patches: [{ op: 'short', a: 'p9', b: 'b' }],
      parts: { hide: ['rb'], show: ['j-rb'] },
    },
    {
      id: 'stall',
      label: 'Stall the motor (grip the shaft)',
      explain:
        'A stalled motor has no back-EMF, so only its 4 Ω winding plus the pack’s 0.6 Ω limit the current: 6/4.6 ≈ 1.3 A. Q1 passes 600 mA, and its power rating as V_CE rises, then burns short. Size the switch for the stall current, not the running current.',
      patches: [{ op: 'set', elementId: 'M1', key: 'load', value: 0.01 }],
    },
    {
      id: 'no-common-ground',
      label: 'Forget the common ground',
      explain:
        'Pin 9 is HIGH and base current flows, but the motor current is 0. The motor’s current must return to the pack’s − terminal through Q1’s emitter; without the shared ground there is no loop. It is the most common bench mistake with two supplies.',
      patches: [{ op: 'remove', elementId: 'W_GND' }],
      parts: { hide: ['wg'] },
    },
    {
      id: 'motor-on-pin',
      label: 'Drive the motor straight from pin 9',
      explain:
        'A motor at rest is just its 4 Ω winding, so pin 9 sees (5)/(25 + 4) ≈ 170 mA at start-up, and still ≈ 90 mA once it spins: both far above the 40 mA absolute maximum. Pin 9 dies. That is the reason for the transistor.',
      patches: [
        { op: 'remove', elementId: 'M1' },
        { op: 'add', element: { ...M1, nodes: ['p9', '0'] } },
      ],
      parts: { hide: ['w-motor-minus', 'w-motor-plus'], show: ['w-motor-pin', 'w-motor-gnd'] },
    },
  ],

  meet: `An NPN bipolar transistor lets a small **base** current control a much larger **collector** current. In the active region, I_c = β·I_b with β ≈ 100–300. As a *switch* we drive it past that, into **saturation**, where V_CE falls to ≈ 0.1–0.3 V and the transistor behaves like a closed contact.

**Base drive.** I_b = (5 − 0.75)/(470 + 25) ≈ **8.6 mA**, well inside the pin's 20 mA comfort zone.

**Is it saturated?** The motor draws ≈ 0.18 A. Forced β = I_c/I_b = 0.18/0.0086 ≈ **21**, far below the part's minimum β (≈ 100 at 150 mA), so it is driven hard into saturation even with a weak sample. Designers aim for a forced β of 10–30.

**Dissipation.** P ≈ V_CE(sat) × I_c ≈ 0.2 × 0.18 ≈ **36 mW**, against 625 mW available. The danger is the half-on state (a stalled motor, or a big R_B): at V_CE = 3 V and 0.18 A, P = 0.54 W.

**Separate supplies.** The motor runs from its own 6 V pack. The only connection the two circuits need is the **ground**, which closes both loops through the emitter.

**Flyback.** D1 points its cathode at +6 V, so when Q1 turns off, the winding's current circulates through D1 instead of spiking the collector.`,

  mechanicalAnalogy: `A transistor switch works like a pilot-operated hydraulic valve: a small pilot flow (base current) opens a main spool that passes a far larger flow (collector current). Fully open, it drops little pressure (saturation). Half open, it throttles and gets hot. The flyback diode is the relief path for the motor's "inertia", its inductance.

**Where it breaks:** a BJT's pilot needs about 0.7 V just to begin, and its gain β varies two- or threefold between parts and with temperature. Design for the worst sample, not the typical one.`,

  proTips: [
    "Above roughly 0.5 A, or wherever base current is precious, switch to a logic-level MOSFET (next lesson). A BJT needs a continuous base current, but a MOSFET's gate draws current only while switching.",
    "Add a 10 kΩ resistor from base to emitter. During reset and boot the MCU's pins are high-impedance inputs, and the pull-down keeps the motor off.",
    'Fit the flyback diode at the motor terminals with short leads. For PWM speed control, use a fast Schottky (1N5819) rather than a slow 1N4007.',
  ],

  quiz: [
    {
      q: 'A 300 mA load must be driven with a forced β of 15. What base current is needed?',
      options: ['2 mA', '20 mA', '4.5 mA', '45 mA'],
      answer: 1,
      why: "I_b = 300/15 = 20 mA, which is at the pin's recommended limit, so a MOSFET is a better choice.",
    },
    {
      q: 'What base resistor gives about 10 mA from a 5 V pin (V_BE ≈ 0.7 V, ignore pin resistance)?',
      options: ['430 Ω', '43 Ω', '4.3 kΩ', '50 Ω'],
      answer: 0,
      why: 'R = (5 − 0.7)/0.010 = 430 Ω (470 Ω is the common choice).',
    },
    {
      q: 'Q1 carries 0.2 A with V_CE = 0.25 V. What is its dissipation?',
      options: ['5 mW', '0.5 W', '50 mW', '1.25 W'],
      answer: 2,
      why: 'P = V_CE × I_c = 0.25 × 0.2 = 0.05 W.',
    },
    {
      q: 'Why is the diode across the motor essential?',
      options: [
        'It increases motor speed',
        'It stops the motor running backwards',
        'It filters noise on the 5 V rail',
        "It gives the winding's current a path at turn-off, preventing a collector voltage spike",
      ],
      answer: 3,
      why: "The motor's inductance forces current to keep flowing, and without the diode it drives V_CE above 40 V.",
    },
  ],
}
