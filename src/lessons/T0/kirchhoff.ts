// T0 · Kirchhoff's Laws. Source: docs/curriculum/T0/kirchhoff.md
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

// Bench layout (the camera looks from +x +z): the dual supply back left, a screw-terminal block on it
// (CH1 9 V, COM, CH2 5 V), a bench meter front left (mirrors NODE A), the breadboard on the right.
//
// Breadboard: node A is column 15 (rows a-e). Three arms land on it, each in its own row so the leads
// don't share a hole, and each far end sits in its own column:
//   R1 (WEST)  row e, columns 9 -> 15, fed by the 9 V wire at column 9
//   R3 (EAST)  row c, columns 11 -> 15, fed by the 5 V wire at column 11
//   R2 (SINK)  row d, columns 15 -> 19, returned to the top ground rail by a wire at column 19
// An ammeter (PROBE element) sits in series in each arm; its test point is the hole beside each far end.
const BB: [number, number] = [-0.6, 2.4]
const PSU_AT: [number, number] = [-2.7, -1.9]
const TERM_Y = BENCH_Y + 0.16 // the supply's top face
const METER_AT: [number, number] = [0.6, -2.3]

const COL_NODE = 15
const COL_R1 = 9
const COL_R3 = 11
const COL_R2 = 19

const r1Far = bbHole(BB, COL_R1, 'e')
const r1Node = bbHole(BB, COL_NODE, 'e')
const r3Far = bbHole(BB, COL_R3, 'c')
const r3Node = bbHole(BB, COL_NODE, 'c')
const r2Node = bbHole(BB, COL_NODE, 'd')
const r2Far = bbHole(BB, COL_R2, 'd')

/** the three screw terminals of the supply's block (rot 0: pins run along +x, screw tops 1.03 above the face) */
const term = (i: number): [number, number, number] => [PSU_AT[0] + (i - 1) * 0.508, TERM_Y + 1.03, PSU_AT[1] + 0.55]

const wCh1 = jumper(term(0), bbHole(BB, COL_R1, 'a'), 'red', 0.5)
const wCh2 = jumper(term(2), bbHole(BB, COL_R3, 'a'), 'blue', 0.6)
const wCom = jumper(term(1), bbHole(BB, 4, '-t'), 'black', 0.6)
const wGnd = jumper(bbHole(BB, COL_R2, 'a'), bbHole(BB, COL_R2, '-t'), 'black', 0.25)
// the "short node A to ground" failure: a bare jumper from node A's column to the ground rail
const wShort = jumper(bbHole(BB, COL_NODE, 'a'), bbHole(BB, COL_NODE, '-t'), 'green', 0.3)

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

/** 1/4 W carbon-film resistor: the rating the sim uses to judge R1 to R3 */
const R_RATING = { maxP: 0.25 }

export const lesson: LessonDef = {
  id: 'kirchhoff',
  track: 'T0',
  title: "Kirchhoff's Laws",
  subtitle: 'Nodes and loops',
  tagline: 'Two supplies at 9 V and 5 V meet at one node through three 1 kΩ arms, and the node settles at 4.67 V.',

  board: {
    name: 'KCL-05',
    size: [10, 6],
    frame: { size: [6.2, 6.2], center: [-1.3, -0.4] },
    base: 'breadboard-only',
    parts: [
      {
        id: 'psu',
        kind: 'module',
        pos: [PSU_AT[0], BENCH_Y, PSU_AT[1]],
        mount: 'offboard',
        label: 'SUPPLY',
        role: 'Dual bench supply: channel 1 at 9 V, channel 2 at 5 V, sharing one common terminal behind the OUTPUT button.',
        color: '#4a5260',
        params: { title: 'DUAL PSU', w: 3.6, d: 2.2, pins: 0, callout: [0, 1.9, 0.2] },
        circuitIds: ['V1', 'V2', 'SW_OUT'],
      },
      {
        id: 'terminals',
        kind: 'screw-terminal',
        pos: [PSU_AT[0], TERM_Y, PSU_AT[1] + 0.55],
        mount: 'offboard',
        label: '9 V · COM · 5 V',
        role: 'Channel 1 (+9 V), the common return and channel 2 (+5 V).',
        params: { pins: 3, callout: [0, 1.6, 0.9] },
      },
      {
        id: 'meter',
        kind: 'multimeter',
        pos: [METER_AT[0], BENCH_Y, METER_AT[1]],
        rot: 0,
        mount: 'offboard',
        label: 'METER',
        role: 'Bench meter on node A: V = (9 + 5)/3 = 4.667 V.',
        params: { scale: 0.27, unit: 'V', readout: 0, title: 'NODE A', callout: [0, 1.2, 0] },
      },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', label: 'BREADBOARD', role: 'Holds the three arms; column 15 (rows a to e) is node A.' },
      {
        id: 'r1',
        kind: 'resistor',
        pos: between(r1Far, r1Node),
        mount: 'tht',
        label: 'WEST',
        role: 'Arm from the 9 V channel: 1 kΩ, 1/4 W. Carries 4.33 mA into node A.',
        params: { ohms: 1000, span: 6 * 0.254, callout: [0, 1.8, 0.3] },
        circuitIds: ['R1'],
      },
      {
        id: 'r3',
        kind: 'resistor',
        pos: between(r3Far, r3Node),
        mount: 'tht',
        label: 'EAST',
        role: 'Arm from the 5 V channel: 1 kΩ, 1/4 W. Carries only 0.33 mA into node A, and reverses once node A rises above 5 V.',
        params: { ohms: 1000, callout: [0.3, 1.5, -0.8] },
        circuitIds: ['R3'],
      },
      {
        id: 'r2',
        kind: 'resistor',
        pos: between(r2Node, r2Far),
        mount: 'tht',
        label: 'SINK',
        role: 'Arm from node A to ground: 1 kΩ, 1/4 W. Takes everything the other two bring.',
        params: { ohms: 1000, callout: [0.2, 1.8, 0.6] },
        circuitIds: ['R2'],
      },
      {
        id: 'node-a',
        kind: 'testpoint',
        pos: bbHole(BB, COL_NODE, 'b'),
        mount: 'tht',
        label: 'NODE A',
        role: 'Column 15, rows a to e: the one shared point where all three arms meet.',
        params: { color: 'green', callout: [0, 1.6, -0.5] },
      },
      {
        id: 'tp1',
        kind: 'testpoint',
        pos: bbHole(BB, COL_R1, 'c'),
        mount: 'tht',
        role: 'Ammeter point in the west arm.',
        params: { color: 'red' },
        circuitIds: ['P1'],
      },
      {
        id: 'tp3',
        kind: 'testpoint',
        pos: bbHole(BB, COL_R3, 'b'),
        mount: 'tht',
        role: 'Ammeter point in the east arm.',
        params: { color: 'blue' },
        circuitIds: ['P3'],
      },
      {
        id: 'tp2',
        kind: 'testpoint',
        pos: bbHole(BB, COL_R2, 'b'),
        mount: 'tht',
        role: 'Ammeter point in the sink arm.',
        params: { color: 'black' },
        circuitIds: ['P2'],
      },
      { id: 'w-ch1', kind: 'wire', ...withCallout(wCh1, [-0.6, 0.8, -0.4]), mount: 'offboard', label: '9 V', role: 'Channel 1 to the west arm.' },
      { id: 'w-ch2', kind: 'wire', ...withCallout(wCh2, [-0.2, 1.0, -0.6]), mount: 'offboard', role: 'Channel 2 to the east arm.' },
      { id: 'w-com', kind: 'wire', ...wCom, mount: 'offboard', role: 'Common return to the ground rail.' },
      { id: 'w-gnd', kind: 'wire', ...wGnd, mount: 'offboard', role: 'Sink arm to the ground rail.' },
      {
        id: 'w-short',
        kind: 'wire',
        ...withCallout(wShort, [0.5, 0.8, 0.4]),
        mount: 'offboard',
        label: 'SHORT',
        role: 'A bare jumper from node A to ground.',
        hidden: true,
      },
    ],
  },

  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['v1', 'com'], value: 9, rInternal: 0.01, partId: 'psu' },
      { id: 'V2', type: 'V', nodes: ['v2', 'com'], value: 5, rInternal: 0.01, partId: 'psu' },
      { id: 'SW_OUT', type: 'SW', nodes: ['com', '0'], closed: true, partId: 'psu' },
      { id: 'P1', type: 'PROBE', nodes: ['v1', 'p1'], partId: 'tp1' },
      { id: 'R1', type: 'R', nodes: ['p1', 'a'], value: 1000, rating: R_RATING, partId: 'r1' },
      { id: 'P2', type: 'PROBE', nodes: ['a', 'p2'], partId: 'tp2' },
      { id: 'R2', type: 'R', nodes: ['p2', '0'], value: 1000, rating: R_RATING, partId: 'r2' },
      { id: 'P3', type: 'PROBE', nodes: ['v2', 'p3'], partId: 'tp3' },
      { id: 'R3', type: 'R', nodes: ['p3', 'a'], value: 1000, rating: R_RATING, partId: 'r3' },
    ],
  },
  powerElementId: 'SW_OUT',
  powerLabel: 'Output ON',
  behaviors: [{ id: 'output-gate', params: { elements: 'V1,V2' } }],

  readouts: [
    { label: 'NODE A', source: { kind: 'voltage', node: 'a' }, unit: 'V', digits: 3, floor: 0.005 },
    { label: 'I1 (WEST)', source: { kind: 'current', elementId: 'P1' }, unit: 'A', floor: 0.000005 },
    { label: 'I3 (EAST)', source: { kind: 'current', elementId: 'P3' }, unit: 'A', floor: 0.000005 },
    { label: 'I2 (SINK)', source: { kind: 'current', elementId: 'P2' }, unit: 'A', floor: 0.000005 },
    { label: 'R1 DROP', source: { kind: 'voltage', node: 'v1', ref: 'a' }, unit: 'V', digits: 3 },
    { label: 'V2 TERMINAL', source: { kind: 'voltage', node: 'v2' }, unit: 'V', digits: 3 },
  ],

  tweaks: [
    { label: 'Channel 1', elementId: 'V1', key: 'value', min: 0, max: 15, step: 0.1, unit: 'V' },
    { label: 'Channel 2', elementId: 'V2', key: 'value', min: 0, max: 15, step: 0.1, unit: 'V' },
    { label: 'Sink arm', elementId: 'R2', key: 'value', min: 100, max: 10000, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: node A sits at {0}. In: {1} + {2}. Out: {3}. KCL closes.' },
    { when: { kind: 'below', readout: 2, value: -0.00001 }, text: 'REVERSED: I3 is {2}, so it flows opposite to your assumed arrow: back INTO the east channel' },
    { when: { kind: 'below', readout: 1, value: -0.00001 }, text: 'REVERSED: I1 is {1}, so it flows opposite to your assumed arrow: back INTO the west channel' },
  ],

  failures: [
    {
      id: 'ch1-12v',
      label: 'Turn channel 1 up to 12 V',
      explain:
        'Node A now sits at (12 + 5)/3 = 5.67 V, above the 5 V channel, so the east arm carries (5 − 5.67)/1 kΩ = −0.667 mA: current flows backward INTO channel 2. The ideal source in the sim absorbs it. A real linear bench supply usually cannot sink current, so its output would drift upward instead (see the next scenario).',
      patches: [{ op: 'set', elementId: 'V1', key: 'value', value: 12 }],
    },
    {
      id: 'sink-open',
      label: 'The sink arm goes open',
      explain:
        'With no path to ground, the only loop runs from 9 V to 5 V through 2 kΩ: I = (9 − 5)/2000 = 2 mA, all of it pushed into channel 2. Node A floats to the midpoint, 7.0 V. As above, the sim\'s ideal channel absorbs that current; a real supply could not.',
      patches: [{ op: 'remove', elementId: 'R2' }],
      parts: { hide: ['r2'] },
    },
    {
      id: 'short-a',
      label: 'Short node A to ground',
      explain:
        'Node A is 0 V, so each arm sees its full source voltage across 1 kΩ: I1 = 9 mA and I3 = 5 mA. KCL still holds: 9 + 5 = 14 mA leaves through the short. R1 dissipates 9²/1000 = 81 mW, which a 1/4 W resistor handles easily.',
      patches: [{ op: 'short', a: 'a', b: '0' }],
      parts: { show: ['w-short'] },
    },
    {
      id: 'supply-wont-sink',
      label: 'A realistic supply: channel 2 will not sink',
      explain:
        'Channel 1 is at 12 V and channel 2 refuses back-fed current, as a supply with an output diode or a linear regulator does. The east arm is cut off (I3 = 0), so node A is just a 1 kΩ / 1 kΩ divider on channel 1: 6.0 V, and I1 = 6 mA. Channel 2 is set to 5 V but its terminal now reads 6 V: the "stiff" supply drifts upward because it cannot absorb anything. This is why you put a series diode or a load resistor on a supply that might be back-fed.',
      patches: [
        { op: 'set', elementId: 'V1', key: 'value', value: 12 },
        { op: 'set', elementId: 'V2', key: 'sink', value: false },
      ],
    },
  ],

  meet: `Two conservation laws solve every circuit:

- **KCL (charge is conserved):** at any node, current in = current out, so Σ I = 0.
- **KVL (energy is conserved):** around any closed loop, rises equal drops, so Σ V = 0.

**Node equation.** Call the junction voltage V_a, and assume the two source arms flow *into* node A and the sink arm flows *out*:

(9 − V_a)/1k + (5 − V_a)/1k = V_a/1k

so 14 = 3·V_a, and **V_a = 4.667 V**.

**Currents.**

- I1 = (9 − 4.667)/1k = **4.333 mA**
- I3 = (5 − 4.667)/1k = **0.333 mA**
- I2 = 4.667/1k = **4.667 mA**

KCL check: 4.333 + 0.333 = 4.667 ✓.

**Loop check (KVL),** around channel 1 → R1 → R2 → ground: 9 − 4.333 − 4.667 = 0 ✓.

Raise channel 1 slowly. Node A follows it up by a third of each volt, and at 10 V node A reaches 5 V and I3 hits zero. Beyond that I3 is negative: if you guess a current's direction wrong, the algebra simply returns a negative number, meaning the current really flows the other way (here, from the node back into the 5 V source).

The simulator uses this same idea, called modified nodal analysis: one KCL equation per node, solved together.`,

  mechanicalAnalogy: `KCL is mass continuity at a pipe tee: what flows in must flow out, since a junction stores nothing. KVL is like elevation around a hiking loop: however you wander, you return to the height you started at, so the ups and downs sum to zero.

**Where it breaks:** KCL assumes a node can't store charge, which fails once capacitance between conductors matters (fast edges, RF). KVL fails when a changing magnetic flux threads the loop, because the induced EMF is not a "drop" at any single component.`,

  proTips: [
    "Pick current directions arbitrarily, write the equations and let the signs speak. Don't stop to \"fix\" arrows mid-calculation.",
    "Most bench supplies can't sink current. When two sources fight, add a load resistor or series diode so neither one gets back-fed.",
    "Choose as ground the node with the most connections. It removes the most unknowns and matches how you'll probe with a scope.",
  ],

  quiz: [
    {
      q: 'Three wires meet at a node. 3 mA and 5 mA flow in, and 2 mA flows out on the first exit. What flows out of the second exit?',
      options: ['0 mA', '6 mA', '4 mA', '10 mA'],
      answer: 1,
      why: 'KCL: 3 + 5 = 2 + I, so I = 6 mA.',
    },
    {
      q: 'A 12 V source drives three series resistors. Two drop 4.5 V and 3.3 V. What does the third drop?',
      options: ['4.2 V', '7.8 V', '3.3 V', '12 V'],
      answer: 0,
      why: 'KVL: 12 − 4.5 − 3.3 = 4.2 V.',
    },
    {
      q: 'On this board, channel 2 is set to 0 V (output still connected). What is node A?',
      options: ['0 V', '4.5 V', '9.0 V', '3.0 V'],
      answer: 3,
      why: '(9 − V_a) + (0 − V_a) = V_a, so 9 = 3·V_a and V_a = 3 V.',
    },
    {
      q: 'Your node analysis gives I3 = −0.67 mA. What does that mean?',
      options: [
        'The calculation is wrong',
        'The resistor is shorted',
        'The current is 0.67 mA, flowing opposite to your assumed arrow',
        "The current is zero because current can't be negative",
      ],
      answer: 2,
      why: 'A negative result only says the real direction is opposite to your guess.',
    },
  ],
}
