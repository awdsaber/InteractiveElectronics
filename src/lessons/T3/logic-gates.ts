// T3 · Logic Gates. Source: docs/curriculum/T3/logic-gates.md (see docs/decisions.md for what changed)
//
// Two breadboards of real 74HC parts on one 5 V rail. Every gate is a LOGIC element (inputs high
// impedance, output a source behind 25 Ω; datasheet 4 mA output resistance is 50-130 Ω, so the
// sim is a little stiffer than the part).
//
//  * Board 1 (74HC08 AND, 74HC32 OR, 74HC00 NAND, 74HC86 XOR) is wired to the same two inputs A and B,
//    each a slide switch to +5 V with a 10 kΩ pull-down, so the whole truth table is a flick of
//    two switches away. A 74HC04 inverter on A shows NOT.
//  * Board 2 feeds a slow 2 Hz triangle (plus an optional 100 Hz ripple) to a plain 74HC04 inverter and
//    a 74HC14 Schmitt inverter side by side, and the `edge-counter` behavior counts each output's
//    transitions. Without ripple both flip once per crossing; with 0.4 V of it the plain gate
//    chatters and the Schmitt does not.
//
// Thresholds. 74HC at VCC = 4.5 V (TI SN74HC08, SCLS081): VIH ≥ 3.15 V, VIL ≤ 1.35 V (0.7 and 0.3 × VCC;
// 4.2 / 1.8 V at 6 V). The simulated plain gate switches at VCC/2 = 2.5 V, the middle of the
// undefined band. The 74HC14 (TI SCLS085) at 4.5 V: VT+ 1.55 / 2.5 / 3.13 V and VT− 0.9 / 1.6 / 2.45 V
// (min / typ / max); at 6 V VT+ typ 3.3 V and VT− typ 2.0 V. The sim uses typicals interpolated to 5 V:
// VT+ 2.75 V and VT− 1.75 V (vth 2.25 V, hyst 1.0 V).
import type { Element, LessonDef, LogicGate } from '../../engine/types'
import { BENCH_Y, PITCH, bbHole, between, jumper } from '../layout'

const BB1: [number, number] = [0.3, -3.0]
const BB2: [number, number] = [0.3, 2.9]
const SUP_AT: [number, number] = [-6.6, -3.0]
const GEN_AT: [number, number] = [-6.6, 2.4]
const MOD_W = 3.4
const MOD_D = 2.4
const POST_Y = BENCH_Y + 0.16 + 0.12
const post = (at: [number, number], dx: number): [number, number, number] => [at[0] + dx, POST_Y, at[1] + MOD_D / 2 - 0.25]
const supPlus = post(SUP_AT, 1.1)
const supMinus = post(SUP_AT, 0.5)
const genOut = post(GEN_AT, 1.1)
const genGnd = post(GEN_AT, 0.5)

const dipAt = (bb: [number, number], startCol: number): [number, number, number] => [bbHole(bb, startCol + 3, 'e')[0], BENCH_Y + 0.85, bb[1]]

/** the 74HC family's input / output limits, from the TI SN74HC08 datasheet (SCLS081J) at VCC = 4.5 V, 25 °C */
const HC_FACTS = [
  'SN74HC08 (TI SCLS081): VCC 2 V to 6 V; at 4.5 V a guaranteed 1 needs VIH ≥ 3.15 V and a guaranteed 0 needs VIL ≤ 1.35 V (1.5 / 0.5 V at 2 V, 4.2 / 1.8 V at 6 V)',
  'Output at 4.5 V: VOH ≥ 3.98 V (4.3 V typ) at −4 mA; VOL ≤ 0.26 V (0.17 V typ) at 4 mA',
  'Absolute maximum: ±25 mA continuous through each output, ±50 mA through VCC or GND',
  'Inputs: ±0.1 µA leakage, 3 pF typ (10 pF max); ICC 2 µA max (25 °C, 6 V, inputs at a rail)',
  'Every unused input must be tied to VCC or GND',
]

function gateChip(id: string, startCol: number, bb: [number, number], marking: string, label: string, role: string, circuitIds: string[], facts: string[]) {
  return {
    id,
    kind: 'ic-dip' as const,
    pos: dipAt(bb, startCol),
    mount: 'tht' as const,
    label,
    role,
    params: { pins: 14, marking, callout: [0, 1.8, -1.0] as [number, number, number] },
    circuitIds,
    facts,
  }
}

/** an output branch (1 kΩ + LED) on the bottom rows of a breadboard, from output column c */
function branch(prefix: string, bb: [number, number], c: number, color: string, label: string, outName: string, ids: [string, string]) {
  const rA = bbHole(bb, c, 'h')
  const rB = bbHole(bb, c + 3, 'h')
  const cath = bbHole(bb, c + 2, 'i')
  const anode = bbHole(bb, c + 3, 'i')
  const w = jumper(bbHole(bb, c + 2, 'j'), bbHole(bb, c + 2, '-b'), 'black', 0.1)
  return [
    {
      id: `r-${prefix}`,
      kind: 'resistor' as const,
      pos: between(rA, rB),
      mount: 'tht' as const,
      role: `1 kΩ current limit for the ${label} LED.`,
      params: { ohms: 1000, span: 3 * PITCH },
      circuitIds: [ids[0]],
    },
    {
      id: `led-${prefix}`,
      kind: 'led' as const,
      pos: between(cath, anode),
      mount: 'tht' as const,
      role: `Lights when ${outName} is high (about 3.3 mA through 1 kΩ).`,
      params: { color, callout: [0, 1.0, 0.9] as [number, number, number] },
      circuitIds: [ids[1]],
    },
    { id: `w-gnd-${prefix}`, kind: 'wire' as const, ...w, mount: 'offboard' as const, role: `${label} LED cathode to the ground rail.` },
  ]
}

const wSupP1 = jumper(supPlus, bbHole(BB1, 1, '+b'), 'red', 0.6)
const wSupN1 = jumper(supMinus, bbHole(BB1, 2, '-b'), 'black', 0.6)
const wP12 = jumper(bbHole(BB1, 30, '+b'), bbHole(BB2, 30, '+t'), 'red', 0.5)
const wN12 = jumper(bbHole(BB1, 29, '-b'), bbHole(BB2, 29, '-t'), 'black', 0.5)
const wGen = jumper(genOut, bbHole(BB2, 10, 'j'), 'yellow', 0.6)
const wGenGnd = jumper(genGnd, bbHole(BB2, 3, '-b'), 'black', 0.5)

// the IC rows: gate 1 of each logic chip on board 1 starts at columns 2, 9, 16, 23
const C_AND = 2
const C_OR = 9
const C_NAND = 16
const C_XOR = 23
// board 2: 74HC04 at columns 1-7 (gate 1 → NOT A, gate 3 → plain inverter on x), 74HC14 at columns 10-16
const C_04 = 1
const C_14 = 10

const NAND_OUT_NODE = 'ynand'

const lg = (id: string, gate: LogicGate, nodes: string[], extra: { vth?: number; hyst?: number } = {}, partId?: string): Element =>
  ({ id, type: 'LOGIC', gate, nodes, vcc: 5, vth: 2.5, rating: { maxI: 0.025, failMode: 'open' }, ...extra, ...(partId ? { partId } : {}) }) as Element

export const lesson: LessonDef = {
  id: 'logic-gates',
  track: 'T3',
  title: 'Logic Gates',
  subtitle: 'Voltages that mean 0 and 1',
  tagline: 'On 5 V, a 74HC input below 1.35 V is a clean 0 and above 3.15 V a clean 1; in between, nobody knows.',

  board: {
    name: 'GATE-22',
    size: [18, 13],
    base: 'breadboard-only',
    parts: [
      {
        id: 'psu',
        kind: 'module',
        pos: [SUP_AT[0], BENCH_Y, SUP_AT[1]],
        mount: 'offboard',
        label: 'SUPPLY',
        role: 'A 5 V logic rail. Every chip on both boards runs from it.',
        params: { title: '5 V SUPPLY', color: '#5f6b75', w: MOD_W, d: MOD_D, pins: 0, chip: 'none', callout: [-0.4, 1.6, -0.3] },
        circuitIds: ['V_SUP'],
      },
      { id: 'sup-p', kind: 'testpoint', pos: supPlus, mount: 'offboard', role: 'Supply + post.', params: { color: 'red' } },
      { id: 'sup-n', kind: 'testpoint', pos: supMinus, mount: 'offboard', role: 'Supply − post.', params: { color: 'black' } },
      {
        id: 'gen',
        kind: 'module',
        pos: [GEN_AT[0], BENCH_Y, GEN_AT[1]],
        mount: 'offboard',
        label: 'SLOW SIGNAL',
        role: 'A function generator: a 2 Hz triangle from 0 V to 5 V (a slow, lazy edge), with an optional 100 Hz ripple added by the noise slider. It feeds the two inverters on the front board.',
        params: { title: 'FUNCTION GEN', color: '#4f5d68', w: MOD_W, d: MOD_D, pins: 0, chip: 'none', callout: [-0.4, 1.6, 0.3] },
        circuitIds: ['V_GEN', 'V_NOISE'],
      },
      { id: 'gen-out', kind: 'testpoint', pos: genOut, mount: 'offboard', role: 'Generator output.', params: { color: 'red' } },
      { id: 'gen-gnd', kind: 'testpoint', pos: genGnd, mount: 'offboard', role: 'Generator ground.', params: { color: 'black' } },
      { id: 'bb1', kind: 'breadboard', pos: BB1, mount: 'offboard', role: 'Holds the four two-input gates.' },
      { id: 'bb2', kind: 'breadboard', pos: BB2, mount: 'offboard', role: 'Holds the inverters, the input switches and the slow signal.' },

      gateChip('u-and', C_AND, BB1, '74HC08', 'AND', 'Quad 2-input AND (DIP-14). Gate 1 is used: inputs A and B on pins 1 and 2, output on pin 3. Pin 14 is +5 V and pin 7 is ground, from the rails.', ['U_AND'], [
        ...HC_FACTS,
        'Pinout: 1A, 2B, 3Y; VCC pin 14, GND pin 7',
        'Input transition time must stay under 500 ns at 4.5 V (recommended operating conditions)',
      ]),
      gateChip('u-or', C_OR, BB1, '74HC32', 'OR', 'Quad 2-input OR (DIP-14). Gate 1: inputs A and B, output on pin 3.', ['U_OR'], ['Pinout: 1A, 2B, 3Y; VCC pin 14, GND pin 7', 'Same 74HC input and output limits as the 74HC08']),
      gateChip('u-nand', C_NAND, BB1, '74HC00', 'NAND', 'Quad 2-input NAND (DIP-14). Gate 1: inputs A and B, output on pin 3. NAND is the universal gate: tie its inputs together and it is a NOT.', ['U_NAND'], [
        'Pinout: 1A, 2B, 3Y; VCC pin 14, GND pin 7',
        'Absolute maximum ±25 mA through each output: shorting a high output to ground asks for about 200 mA',
      ]),
      gateChip('u-xor', C_XOR, BB1, '74HC86', 'XOR', 'Quad 2-input exclusive-OR (DIP-14). Gate 1: high when A and B differ.', ['U_XOR'], ['Pinout: 1A, 1B, 1Y on pins 1, 2, 3; VCC pin 14, GND pin 7', 'Same 74HC input and output limits as the 74HC08']),
      gateChip('u-04', C_04, BB2, '74HC04', 'NOT', 'Hex inverter (DIP-14). Gate 1 inverts input A. Gate 3 is the plain inverter that sees the slow signal.', ['U_NOT', 'U_RAW'], [
        'Pinout: 1A pin 1, 1Y pin 2; 3A pin 5, 3Y pin 6; VCC pin 14, GND pin 7',
        'Plain CMOS input: it switches near VCC/2, and the 74HC datasheet limits the input rise and fall time (500 ns at 4.5 V for the 74HC08)',
      ]),
      gateChip('u-14', C_14, BB2, '74HC14', 'SCHMITT', 'Hex Schmitt-trigger inverter (DIP-14). Gate 1 sees the same slow signal as the plain inverter, but its input has two thresholds.', ['U_SCH'], [
        'SN74HC14 (TI SCLS085) at 4.5 V, 25 °C: VT+ 1.55 V min, 2.5 V typ, 3.13 V max; VT− 0.9 V min, 1.6 V typ, 2.45 V max',
        'Hysteresis VT+ − VT− at 4.5 V: 0.4 V min, 0.9 V typ, 2.1 V max; at 6 V: typ 1.3 V',
        'tpd 12 ns typ, 25 ns max at 4.5 V; absolute maximum ±25 mA per output',
        'Pinout: 1A pin 1, 1Y pin 2; VCC pin 14, GND pin 7',
      ]),

      ...branch('and', BB1, C_AND + 2, 'green', 'AND', 'the AND output', ['R_LAND', 'LED_AND']),
      ...branch('or', BB1, C_OR + 2, 'yellow', 'OR', 'the OR output', ['R_LOR', 'LED_OR']),
      ...branch('nand', BB1, C_NAND + 2, 'red', 'NAND', 'the NAND output', ['R_LNAND', 'LED_NAND']),
      ...branch('xor', BB1, C_XOR + 2, 'white', 'XOR', 'the XOR output', ['R_LXOR', 'LED_XOR']),
      ...branch('not', BB2, C_04 + 1, 'blue', 'NOT A', 'NOT A', ['R_LNOT', 'LED_NOT']),
      ...branch('raw', BB2, C_04 + 5, 'red', 'PLAIN', 'the plain inverter', ['R_LRAW', 'LED_RAW']),
      ...branch('sch', BB2, C_14 + 1, 'green', 'SCHMITT', 'the Schmitt inverter', ['R_LSCH', 'LED_SCH']),

      {
        id: 'sw-a',
        kind: 'switch-slide',
        pos: between(bbHole(BB2, 19, 'h'), bbHole(BB2, 21, 'h')),
        mount: 'tht',
        label: 'INPUT A',
        role: 'Slide switch: +5 V onto input A when closed. Open, only the 10 kΩ pull-down holds A at 0 V. A is bussed to the first input of every gate.',
        params: { callout: [0, 1.5, 0.6] },
        circuitIds: ['SW_A'],
      },
      {
        id: 'sw-b',
        kind: 'switch-slide',
        pos: between(bbHole(BB2, 25, 'h'), bbHole(BB2, 27, 'h')),
        mount: 'tht',
        label: 'INPUT B',
        role: 'Slide switch: +5 V onto input B when closed. B is bussed to the second input of the four two-input gates.',
        params: { callout: [0, 1.5, 0.6] },
        circuitIds: ['SW_B'],
      },
      {
        id: 'rpa',
        kind: 'resistor',
        pos: between(bbHole(BB2, 19, 'c'), bbHole(BB2, 23, 'c')),
        mount: 'tht',
        role: '10 kΩ from input A to ground (brown-black-orange). It defines a 0 when the switch is open, and it costs 0.5 mA when the switch is closed. This is the resistor the floating-input failure takes out.',
        params: { ohms: 10e3, span: 4 * PITCH, callout: [0, 1.4, -0.6] },
        circuitIds: ['R_PA'],
      },
      {
        id: 'rpb',
        kind: 'resistor',
        pos: between(bbHole(BB2, 25, 'c'), bbHole(BB2, 29, 'c')),
        mount: 'tht',
        role: '10 kΩ from input B to ground.',
        params: { ohms: 10e3, span: 4 * PITCH },
        circuitIds: ['R_PB'],
      },
      {
        id: 'ch1',
        kind: 'probe',
        pos: bbHole(BB2, 8, 'i'),
        mount: 'offboard',
        label: 'CH1 · IN',
        role: 'Scope channel 1 on the slow signal x that feeds both inverters.',
        params: { color: 'yellow', tilt: 22, callout: [-0.9, 1.2, 0.8] },
      },
      {
        id: 'ch2',
        kind: 'probe',
        pos: bbHole(BB2, 7, 'g'),
        mount: 'offboard',
        label: 'CH2 · PLAIN',
        role: 'Scope channel 2 on the plain inverter’s output.',
        params: { color: 'blue', tilt: 22, callout: [0.9, 1.2, 0.8] },
      },
      { id: 'w-sup-p', kind: 'wire', ...wSupP1, mount: 'offboard', role: 'Supply + to board 1’s + rail.' },
      { id: 'w-sup-n', kind: 'wire', ...wSupN1, mount: 'offboard', role: 'Supply − to board 1’s ground rail.' },
      { id: 'w-p12', kind: 'wire', ...wP12, mount: 'offboard', role: '+5 V on to board 2.' },
      { id: 'w-n12', kind: 'wire', ...wN12, mount: 'offboard', role: 'Ground on to board 2.' },
      { id: 'w-gen', kind: 'wire', ...wGen, mount: 'offboard', role: 'Generator signal to both inverter inputs.' },
      { id: 'w-gen-gnd', kind: 'wire', ...wGenGnd, mount: 'offboard', role: 'Generator ground to board 2’s ground rail.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_SUP', type: 'V', nodes: ['vcc', '0'], value: 5, rInternal: 0.05, partId: 'psu' },

      // the inputs: a switch to +5 V, a 10 kΩ pull-down, and the 74HC input capacitance (3 pF typ.)
      { id: 'SW_A', type: 'SW', nodes: ['vcc', 'a'], closed: false, partId: 'sw-a' },
      { id: 'R_PA', type: 'R', nodes: ['a', '0'], value: 10e3, rating: { maxP: 0.25 }, partId: 'rpa' },
      { id: 'C_INA', type: 'C', nodes: ['a', '0'], value: 3e-12 },
      // the input's ESD clamp diodes (datasheet IIK ±20 mA): a pin cannot leave −0.7 V … VCC + 0.7 V
      { id: 'D_ESD_H', type: 'D', nodes: ['a', 'vcc'] },
      { id: 'D_ESD_L', type: 'D', nodes: ['0', 'a'] },
      { id: 'SW_B', type: 'SW', nodes: ['vcc', 'b'], closed: false, partId: 'sw-b' },
      { id: 'R_PB', type: 'R', nodes: ['b', '0'], value: 10e3, rating: { maxP: 0.25 }, partId: 'rpb' },

      // the gates (vth VCC/2; the datasheet only guarantees VIL ≤ 1.35 V and VIH ≥ 3.15 V at 4.5 V)
      lg('U_AND', 'AND', ['a', 'b', 'yand'], {}, 'u-and'),
      lg('U_OR', 'OR', ['a', 'b', 'yor'], {}, 'u-or'),
      lg('U_NAND', 'NAND', ['a', 'b', NAND_OUT_NODE], {}, 'u-nand'),
      lg('U_XOR', 'XOR', ['a', 'b', 'yxor'], {}, 'u-xor'),
      lg('U_NOT', 'NOT', ['a', 'ynot'], {}, 'u-04'),

      // output LEDs, 1 kΩ each
      { id: 'R_LAND', type: 'R', nodes: ['yand', 'l_and'], value: 1000, rating: { maxP: 0.25 }, partId: 'r-and' },
      { id: 'LED_AND', type: 'LED', nodes: ['l_and', '0'], color: 'green', rating: { maxI: 0.03 }, partId: 'led-and' },
      { id: 'R_LOR', type: 'R', nodes: ['yor', 'l_or'], value: 1000, rating: { maxP: 0.25 }, partId: 'r-or' },
      { id: 'LED_OR', type: 'LED', nodes: ['l_or', '0'], color: 'yellow', rating: { maxI: 0.03 }, partId: 'led-or' },
      { id: 'R_LNAND', type: 'R', nodes: [NAND_OUT_NODE, 'l_nand'], value: 1000, rating: { maxP: 0.25 }, partId: 'r-nand' },
      { id: 'LED_NAND', type: 'LED', nodes: ['l_nand', '0'], color: 'red', rating: { maxI: 0.03 }, partId: 'led-nand' },
      { id: 'R_LXOR', type: 'R', nodes: ['yxor', 'l_xor'], value: 1000, rating: { maxP: 0.25 }, partId: 'r-xor' },
      { id: 'LED_XOR', type: 'LED', nodes: ['l_xor', '0'], color: 'white', rating: { maxI: 0.03 }, partId: 'led-xor' },
      { id: 'R_LNOT', type: 'R', nodes: ['ynot', 'l_not'], value: 1000, rating: { maxP: 0.25 }, partId: 'r-not' },
      { id: 'LED_NOT', type: 'LED', nodes: ['l_not', '0'], color: 'blue', rating: { maxI: 0.03 }, partId: 'led-not' },

      // the slow signal: 2 Hz triangle 0 to 5 V, plus a series ripple source (off until the noise slider moves)
      { id: 'V_GEN', type: 'V', nodes: ['gen', '0'], value: 0, wave: { kind: 'triangle', amp: 2.5, offset: 2.5, freq: 2, phase: -90 }, rInternal: 0.05, partId: 'gen' },
      { id: 'V_NOISE', type: 'V', nodes: ['x', 'gen'], value: 0, wave: { kind: 'sine', amp: 0, freq: 100, offset: 0 }, rInternal: 0.05, partId: 'gen' },
      lg('U_RAW', 'NOT', ['x', 'yraw'], {}, 'u-04'),
      // 74HC14: VT+ 2.75 V, VT− 1.75 V (typicals interpolated to 5 V)
      lg('U_SCH', 'SCHMITT', ['x', 'ysch'], { vth: 2.25, hyst: 1.0 }, 'u-14'),
      { id: 'R_LRAW', type: 'R', nodes: ['yraw', 'l_raw'], value: 1000, rating: { maxP: 0.25 }, partId: 'r-raw' },
      { id: 'LED_RAW', type: 'LED', nodes: ['l_raw', '0'], color: 'red', rating: { maxI: 0.03 }, partId: 'led-raw' },
      { id: 'R_LSCH', type: 'R', nodes: ['ysch', 'l_sch'], value: 1000, rating: { maxP: 0.25 }, partId: 'r-sch' },
      { id: 'LED_SCH', type: 'LED', nodes: ['l_sch', '0'], color: 'green', rating: { maxI: 0.03 }, partId: 'led-sch' },
    ],
  },
  powerElementId: 'V_SUP',
  powerLabel: 'Connect 5 V',

  readouts: [
    { label: 'A', source: { kind: 'voltage', node: 'a' }, unit: 'V' }, // 0
    { label: 'B', source: { kind: 'voltage', node: 'b' }, unit: 'V' }, // 1
    { label: 'AND', source: { kind: 'voltage', node: 'yand' }, unit: 'V' }, // 2
    { label: 'OR', source: { kind: 'voltage', node: 'yor' }, unit: 'V' }, // 3
    { label: 'NAND', source: { kind: 'voltage', node: NAND_OUT_NODE }, unit: 'V' }, // 4
    { label: 'XOR', source: { kind: 'voltage', node: 'yxor' }, unit: 'V' }, // 5
    { label: 'NOT A', source: { kind: 'voltage', node: 'ynot' }, unit: 'V' }, // 6
    { label: 'NAND LED CURRENT', source: { kind: 'current', elementId: 'LED_NAND' }, unit: 'A' }, // 7
    { label: 'SLOW INPUT x', source: { kind: 'voltage', node: 'x' }, unit: 'V' }, // 8
    { label: 'PLAIN INVERTER', source: { kind: 'voltage', node: 'yraw' }, unit: 'V' }, // 9
    { label: 'SCHMITT INVERTER', source: { kind: 'voltage', node: 'ysch' }, unit: 'V' }, // 10
    { label: 'PLAIN OUTPUT EDGES', source: { kind: 'behavior', key: 'ecraw.edges' }, unit: '' }, // 11
    { label: 'SCHMITT OUTPUT EDGES', source: { kind: 'behavior', key: 'ecsch.edges' }, unit: '' }, // 12
    { label: 'NOT A EDGES', source: { kind: 'behavior', key: 'ecnot.edges' }, unit: '' }, // 13
    { label: 'EXTRA EDGES (PLAIN − SCHMITT)', source: { kind: 'derived', op: 'diff', of: [11, 12] }, unit: '' }, // 14
  ],

  tweaks: [
    { label: 'Input A', elementId: 'SW_A', key: 'closed', kind: 'toggle', min: 0, max: 1, step: 1, unit: '' },
    { label: 'Input B', elementId: 'SW_B', key: 'closed', kind: 'toggle', min: 0, max: 1, step: 1, unit: '' },
    { label: 'Slow signal rate', elementId: 'V_GEN', key: 'wave.freq', min: 0.2, max: 5, log: true, unit: 'Hz' },
    { label: 'Ripple on the signal (peak)', elementId: 'V_NOISE', key: 'wave.amp', min: 0, max: 0.6, step: 0.05, unit: 'V' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'READY' }, text: 'READY: connect 5 V, then flick the A and B switches and watch the LEDs' },
    { when: { kind: 'state', is: 'POWERED' }, text: 'A = {0}, B = {1}. AND {2}, OR {3}, NAND {4}, XOR {5}, NOT A {6}' },
    { when: { kind: 'above', readout: 14, value: 4 }, text: 'CHATTER: the ripple has made the plain inverter flip {11} times, the Schmitt only {12}' },
    { when: { kind: 'above', readout: 13, value: 20 }, text: 'FLOATING: nothing defines input A, so it follows stray hum and NOT A has flipped {13} times' },
    { when: { kind: 'state', is: 'FAULT' }, text: 'FAULT: a gate output failed; repair to try again' },
  ],

  failures: [
    {
      id: 'floating-input',
      label: 'Leave input A floating',
      explain:
        'The 10 kΩ pull-down is gone and the switch is open, so nothing defines the voltage on input A. In a real circuit it picks up charge and mains hum through a few picofarads of stray capacitance and wanders across the threshold: here a 50 Hz hum is coupled in through 4 pF against the pin’s own 3 pF, and the NOT A output flips about a hundred times a second while the LEDs flicker. A real gate can also be left with both of its output transistors partly on, drawing extra supply current. A CMOS input has almost infinite resistance, so it holds whatever voltage you last gave it: always tie it to a rail.',
      patches: [
        { op: 'remove', elementId: 'R_PA' },
        { op: 'set', elementId: 'SW_A', key: 'closed', value: false },
        { op: 'add', element: { id: 'V_HUM', type: 'V', nodes: ['hum', '0'], value: 0, wave: { kind: 'sine', amp: 8, freq: 50, offset: 0 }, rInternal: 0.05 } },
        { op: 'add', element: { id: 'C_HUM', type: 'C', nodes: ['hum', 'a'], value: 4e-12 } },
      ],
      parts: { hide: ['rpa'] },
    },
    {
      id: 'output-short',
      label: 'Short the NAND output to ground',
      explain:
        'With A or B low the 74HC00 output is a switch to +5 V, so a short to ground leaves only the output’s own resistance (about 25 Ω here) in the way: about 200 mA. The datasheet allows ±25 mA through an output (and ±50 mA through VCC or GND), so the chip fails. A logic output is a switch to a rail, not a current source: it will try to deliver whatever the load asks.',
      patches: [{ op: 'short', a: NAND_OUT_NODE, b: '0' }],
    },
    {
      id: 'noisy-edge',
      label: 'Put 0.4 V of noise on the slow signal',
      explain:
        'Long wires next to a motor or a switching supply pick up ripple. Here 0.4 V peak at 100 Hz rides on the slow edge. Around the plain inverter’s threshold the signal wiggles back and forth across it, and each crossing is a clean edge at the output: counted edges jump from 2 per sweep to dozens. The Schmitt inverter needs the input to move a full volt back before it changes its mind, and the ripple is smaller than that, so it flips once per sweep.',
      patches: [{ op: 'set', elementId: 'V_NOISE', key: 'wave.amp', value: 0.4 }],
    },
  ],

  meet: `A digital input does not read voltages: it reads one of two **bands**. On a 74HC at 4.5 V the datasheet guarantees a **1** above **V_IH = 3.15 V** and a **0** below **V_IL = 1.35 V** (the same 0.7 and 0.3 × V_CC ratios hold across the supply range, so a 5 V rail is about 3.5 V and 1.5 V). In between is **undefined**: the gate may output either one, or a half-and-half level, and it may even oscillate. The board's plain gates are modelled as flipping at V_CC/2, the middle of that band. A 74HCT part has V_IH = 2.0 V, so a 3.3 V microcontroller can drive it from a 5 V rail; a plain 74HC at 5 V has only about 0.2 V to spare at 3.3 V, so check the margin.

**Truth tables.** Flick switches A and B on the first board and watch the LEDs:

| A | B | AND | OR | NAND | XOR |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 1 | 0 |
| 0 | 1 | 0 | 1 | 1 | 1 |
| 1 | 0 | 0 | 1 | 1 | 1 |
| 1 | 1 | 1 | 1 | 0 | 0 |

NOT inverts A. NAND is the **universal** gate: tie its inputs together and it is a NOT, follow a NAND with a NOT and it is an AND, and every other function can be built from NANDs alone. Inside a CMOS NAND, two PMOS transistors in parallel pull the output up to V_CC if *either* input is low, and two NMOS in series pull it to ground only if *both* are high. One side is always off, so a still gate draws about a microamp.

**Numbers.** A high output through 1 kΩ and a red LED carries (5 − 1.8)/1 kΩ ≈ **3 mA** (the datasheet is good for ±4 mA with the output within 0.5 V of the rail, and ±25 mA absolute maximum). A closed switch pushes 5 V/10 kΩ = **0.5 mA** into its pull-down.

**A floating input is a failure.** A CMOS input has a resistance in the hundreds of gigaohms and about 3 pF of capacitance, so a pin left open floats to whatever it picks up. Break it on the board: A follows a coupled 50 Hz hum. Never leave an input open. Tie it to ground or V_CC.

**A slow, noisy edge.** The second board feeds the same 2 Hz triangle (plus ripple from the slider) to a plain 74HC04 and to a 74HC14 **Schmitt trigger**. The 74HC14 has two thresholds: it switches up at V_T+ (about 2.5 V typical at 4.5 V, 2.75 V here) and down at V_T− (1.6 V typical, 1.75 V here). The gap is **hysteresis**. With ripple smaller than it, the Schmitt output flips once, while the plain inverter flips every time the ripple crosses its single threshold, as the edge counters show. Plain CMOS inputs also want fast edges: the 74HC08 datasheet limits the input transition time (500 ns at 4.5 V), and a slow edge holds both of an input stage's transistors on at once. The 74HC14 is the part to put behind a slow edge, a long wire or a mechanical switch. **What the sim leaves out:** it does not draw the shoot-through current of a plain gate lingering in the undefined band, the output resistance is a flat 25 Ω rather than the datasheet's 50 to 130 Ω, propagation delay is not modelled, and the floating input is a hum coupled in through two capacitors, not a real thermal drift.`,

  mechanicalAnalogy: `CMOS logic is fluid logic with complementary valves. Two valves in series to the drain make an AND path and two in parallel to the supply make an OR path. Every pull-down valve has a partner pull-up valve that closes when it opens, so at rest there is never a straight-through leak, only a brief flow while switching. The logic thresholds are like a pressure switch with a deadband: below one pressure it reads "off", above another "on", and in between you get chatter unless you add hysteresis (a Schmitt trigger is a snap-action switch).

**Where it breaks:** electronic gates switch in about 10 ns, millions of times faster than any spool. An unconnected input is worse than an unconnected pilot line: it floats to a random voltage and can hold both valves half open.`,

  proTips: [
    'Tie every unused CMOS input to GND or V_CC (directly, or through a resistor if you may want to change it). A floating input causes random behaviour and extra supply current.',
    'Put a 100 nF ceramic capacitor across V_CC and GND at every logic IC, as close to the pins as possible. Switching edges draw sharp current spikes.',
    'Put a Schmitt-trigger input (74HC14, or a gate with a Schmitt input such as the 74HC132) behind anything slow or noisy: a button, a long wire, a sensor. Plain 74HC inputs need edges faster than 500 ns.',
    'When mixing 3.3 V and 5 V logic, check V_IH and V_IL in both directions. Use 74HCT parts or a level shifter going up. Going down, protect the 3.3 V input (a series resistor or a level shifter) unless its datasheet says it is 5 V tolerant.',
  ],

  guide: [
    {
      id: 'meet-the-nand',
      title: 'Meet a gate',
      body: 'Click the chip labelled **NAND** on the first breadboard to open its inspector. It is a **74HC00**: four 2-input NAND gates in a DIP-14, and this board uses gate 1.',
      check: { kind: 'inspect', part: 'u-nand' },
      focus: { part: 'u-nand' },
      hint: 'It is the third of the four chips on the front breadboard, next to the red LED.',
      explain: 'The datasheet gives it a supply of 2 V to 6 V and promises a 1 above V_IH = 3.15 V and a 0 below V_IL = 1.35 V at 4.5 V. Every chip on this bench shares one 5 V rail.',
    },
    {
      id: 'power-up',
      title: 'Connect 5 V',
      body: 'Press **Connect 5 V**. Both input switches are open, so each input sits at 0 V on its 10 kΩ pull-down. **NAND** should read about **5 V** and the red LED lights.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'power' },
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 4, above: 4.5, holdMs: 250 },
        ],
      },
      focus: { control: 'power' },
      explain: 'A NAND is 0 only when both inputs are 1. With A = B = 0 the output is 1: it sources about (5 − 1.8) / 1 kΩ ≈ 3.3 mA into the LED branch.',
    },
    {
      id: 'a-only',
      title: 'Switch on A alone',
      body: 'Slide **Input A** on and leave **Input B** off. **OR** and **XOR** go high, **AND** stays low.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Input A', min: 1 },
          { kind: 'tweak', target: 'Input B', max: 0 },
          { kind: 'readout', index: 3, above: 4.5, holdMs: 250 },
          { kind: 'readout', index: 5, above: 4.5, holdMs: 250 },
          { kind: 'readout', index: 2, below: 0.5, holdMs: 250 },
        ],
      },
      focus: { control: 'tweak:Input A' },
      explain: 'OR needs at least one 1. XOR needs exactly one. AND needs both, so with only A on it stays at 0.',
    },
    {
      id: 'both-on',
      title: 'Switch on A and B',
      body: 'Now slide **Input B** on as well. **AND** goes high; **NAND** and **XOR** drop to 0.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Input A', min: 1 },
          { kind: 'tweak', target: 'Input B', min: 1 },
          { kind: 'readout', index: 2, above: 4.5, holdMs: 250 },
          { kind: 'readout', index: 4, below: 0.5, holdMs: 250 },
          { kind: 'readout', index: 5, below: 0.5, holdMs: 250 },
        ],
      },
      focus: { control: 'tweak:Input B' },
      explain: 'That is the last row of the truth table: A = B = 1 gives AND 1, NAND 0, XOR 0 and OR 1. NAND is the inverse of AND, and XOR is 1 only when the inputs differ.',
    },
    {
      id: 'ripple',
      title: 'Add 0.4 V of ripple',
      body: 'On the second board a slow 2 Hz triangle feeds a plain inverter and a Schmitt inverter. Slide **Ripple on the signal** to about **0.4 V**. Watch **EXTRA EDGES** climb above 4.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Ripple on the signal (peak)', min: 0.35 },
          { kind: 'readout', index: 14, above: 4 },
        ],
      },
      focus: { control: 'tweak:Ripple on the signal (peak)' },
      hint: 'EXTRA EDGES counts how many more times the plain inverter flipped than the Schmitt one. It takes a couple of seconds.',
      explain: 'The plain 74HC04 flips at one threshold, about 2.5 V, so a ripple that crosses it back and forth gives a burst of edges at each slow crossing. The 74HC14 needs the input to fall a full volt (V_T+ 2.75 V down to V_T− 1.75 V here) before flipping back, and 0.8 V peak to peak of ripple never gets there.',
    },
    {
      id: 'float-it',
      title: 'Break it: float input A',
      body: 'Open **Break something** and choose **Leave input A floating**. The pull-down is gone, so hum rides in and **NOT A EDGES** races above 20.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'floating-input' }, { kind: 'readout', index: 13, above: 20 }] },
      focus: { control: 'break' },
      hint: 'Switch A is open now, so nothing at all defines the pin. The count rises about 100 times a second.',
      explain: 'A CMOS input is a few picofarads of capacitance and no DC path: it holds whatever charge it picks up. Here a coupled 50 Hz hum drags it across the threshold twice per cycle, so NOT A flips about 100 times a second. Tie every unused input to V_CC or GND.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**. The 10 kΩ pull-down is back.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the five questions in **Check yourself** below: truth tables, thresholds and the Schmitt trigger.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  quiz: [
    {
      q: 'A NAND gate has A = 1 and B = 1. What is its output?',
      options: ['1', 'Undefined', '0', 'It depends on V_CC'],
      answer: 2,
      why: 'NAND is NOT(A AND B). 1 AND 1 = 1, so the output is 0.',
    },
    {
      q: 'A pressed switch puts 5 V across a 10 kΩ pull-down. What current flows?',
      options: ['0.5 mA', '0.05 mA', '5 mA', '50 mA'],
      answer: 0,
      why: 'I = 5 V / 10 kΩ = 0.5 mA.',
    },
    {
      q: 'A 74HC gate on 4.5 V sees 2.0 V on its input. What does the datasheet promise?',
      options: ['A valid 1, because it is above half of V_CC', 'A valid 0, because it is under 3 V', 'Nothing: it is between V_IL = 1.35 V and V_IH = 3.15 V', 'The gate is damaged'],
      answer: 2,
      why: 'Only below 1.35 V is a 0 guaranteed and only above 3.15 V a 1. In between the output may be either, or a muddy level.',
    },
    {
      q: 'How do you make an inverter out of a 2-input NAND?',
      options: ['Tie one input to ground', 'Tie the output to an input', 'It cannot be done', 'Tie both inputs together'],
      answer: 3,
      why: 'With A = B, NOT(A AND A) = NOT A. (Tying the spare input to V_CC also works.)',
    },
    {
      q: 'A 74HC14 has V_T+ = 2.75 V and V_T− = 1.75 V. A slow edge carries 0.4 V peak (0.8 V peak to peak) of ripple. What does the output do?',
      options: ['Flips every time the ripple crosses 2.5 V', 'Flips once per edge: the ripple is smaller than the 1 V hysteresis', 'It never flips', 'It oscillates at the ripple frequency'],
      answer: 1,
      why: 'After it flips at V_T+ the input would need to fall below V_T−, a full volt lower, for it to flip back. 0.8 V of ripple never gets there.',
    },
  ],

  behaviors: [
    { id: 'edge-counter', instance: 'ecraw', params: { node: 'yraw' } },
    { id: 'edge-counter', instance: 'ecsch', params: { node: 'ysch' } },
    { id: 'edge-counter', instance: 'ecnot', params: { node: 'ynot' } },
  ],

  instruments: {
    open: true,
    view: 'scope',
    scope: {
      channels: [
        {
          label: 'SLOW INPUT x',
          source: { kind: 'voltage', node: 'x' },
          perDiv: 1,
          offset: -2.5,
          marks: [
            { value: 3.15, label: 'V_IH 3.15 V' },
            { value: 1.35, label: 'V_IL 1.35 V' },
          ],
        },
        { label: 'PLAIN OUT', source: { kind: 'voltage', node: 'yraw' }, perDiv: 1, offset: -2.5 },
      ],
      timePerDiv: 0.05,
      trigger: { channel: 0, level: 2.5, slope: 'rising', mode: 'auto' },
    },
    chart: { signals: [8, 9, 10], span: 2 },
  },
}
