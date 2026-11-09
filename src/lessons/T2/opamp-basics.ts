// T2 · Op-Amp Basics. Source: docs/curriculum/T2/opamp-basics.md
//
// One LM358 (DIP-8, dual) on a single 5 V supply. Half B buffers a 100k/100k divider into a 2.5 V
// mid-rail reference; half A is the amplifier under test, driven by a function generator's 5 Hz sine
// riding on 2.5 V. Six SW elements rewire half A between four configurations (the `opamp-config`
// behavior, driven by an enum tweak): non-inverting (1 + R_F/R_G), inverting (−R_F/R_G), buffer (1)
// and comparator (no feedback). A second enum tweak swaps the chip for an MCP6002 by moving both
// halves' output ceiling from 3.5 V (LM358, V+ − 1.5 V) to 4.975 V (MCP6002, VDD − 25 mV).
//
// The OPAMP element is static: gain 1e5 with a tanh clamp to fixed vPos / vNeg. It has no gain-
// bandwidth, slew rate, output current limit or input common-mode limit, so the lesson runs at 5 Hz
// (where none of those matter) and the text states those limits instead of simulating them.
//
// Switches: S_SP sig→p, S_PR p→ref, S_GR g→ref, S_SG sig→g, S_F fx→n (R_F in the loop), S_BUF out→n.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, PITCH, bbHole, between, jumper } from '../layout'

const SWITCHES = 'S_SP,S_PR,S_GR,S_SG,S_F,S_BUF'
// one digit per switch above, per mode: non-inverting | inverting | buffer | comparator
const PATTERNS = '101010|010110|100001|101000'

/** LM358 output ceiling on 5 V: V+ − 1.5 V (TI SLOS068, swing from the positive rail 1.5 V max, RL ≥ 2 kΩ) */
const LM358_HI = 3.5
/** MCP6002 output ceiling on 5 V: VDD − 25 mV (Microchip DS20001733, RL = 10 kΩ) */
const MCP6002_HI = 4.975
/** LM358 negative-rail swing: 5 mV typ at RL ≤ 10 kΩ (the MCP6002's 25 mV is a max; the same 5 mV is used for both) */
const V_LOW = 0.005

// Bench layout: supply behind-left, generator in front-left, breadboard centre. The DIP straddles
// the channel on columns 14-17: pin 1 OUT A (14 f), 2 IN− A (15 f), 3 IN+ A (16 f), 4 GND (17 f),
// 5 IN+ B (17 e), 6 IN− B (16 e), 7 OUT B (15 e), 8 VCC (14 e).
const BB: [number, number] = [0.9, 0.5]
const SUP_AT: [number, number] = [-6.3, -2.4]
const GEN_AT: [number, number] = [-6.3, 2.0]
const MOD_W = 3.4
const MOD_D = 2.4
const POST_Y = BENCH_Y + 0.16 + 0.12
const post = (at: [number, number], dx: number): [number, number, number] => [at[0] + dx, POST_Y, at[1] + MOD_D / 2 - 0.25]
const supPlus = post(SUP_AT, 1.1)
const supMinus = post(SUP_AT, 0.5)
const genOut = post(GEN_AT, 1.1)
const genGnd = post(GEN_AT, 0.5)

const dipAt: [number, number, number] = [BB[0], BENCH_Y + 0.85, BB[1]]

// half A (bottom rows f-j)
const rfA = bbHole(BB, 11, 'i') // fx side (jumpered to OUT at column 14)
const rfB = bbHole(BB, 15, 'i') // IN− A
const rgA = bbHole(BB, 15, 'g') // IN− A
const rgB = bbHole(BB, 19, 'g') // node g
const rlA = bbHole(BB, 14, 'j') // OUT A
const rlB = bbHole(BB, 14, '-b')
// half B and the divider (top rows a-e)
const rh1A = bbHole(BB, 17, 'c') // IN+ B (node half)
const rh1B = bbHole(BB, 21, 'c') // to +5 V
const rh2A = bbHole(BB, 17, 'b')
const rh2B = bbHole(BB, 12, 'b') // to ground
const swA = bbHole(BB, 23, 'h')
const swB = bbHole(BB, 25, 'h')

const wSupP = jumper(supPlus, bbHole(BB, 3, '+t'), 'red', 0.6)
const wSupN = jumper(supMinus, bbHole(BB, 2, '-t'), 'black', 0.6)
const wGndRails = jumper(bbHole(BB, 1, '-t'), bbHole(BB, 1, '-b'), 'black', 0.25)
const wVcc = jumper(bbHole(BB, 14, 'a'), bbHole(BB, 13, '+t'), 'red', 0.12)
const wGnd = jumper(bbHole(BB, 17, 'j'), bbHole(BB, 18, '-b'), 'black', 0.12)
const wRh1 = jumper(bbHole(BB, 21, 'a'), bbHole(BB, 22, '+t'), 'red', 0.12)
const wRh2 = jumper(bbHole(BB, 12, 'a'), bbHole(BB, 11, '-t'), 'black', 0.12)
const wFollow = jumper(bbHole(BB, 16, 'd'), bbHole(BB, 15, 'd'), 'green', 0.08)
const wRef = jumper(bbHole(BB, 15, 'a'), bbHole(BB, 19, 'j'), 'orange', 0.5)
const wOutF = jumper(bbHole(BB, 11, 'j'), bbHole(BB, 14, 'h'), 'green', 0.12)
const wSig = jumper(genOut, bbHole(BB, 16, 'j'), 'yellow', 0.6)
const wSigGnd = jumper(genGnd, bbHole(BB, 2, '-b'), 'black', 0.5)

export const lesson: LessonDef = {
  id: 'opamp-basics',
  track: 'T2',
  title: 'Op-Amp Basics',
  subtitle: 'Feedback does the work',
  tagline: 'An LM358 with 100 kΩ over 10 kΩ turns ±50 mV into ±0.55 V, until it runs into its 3.5 V ceiling.',

  board: {
    name: 'AMP-20',
    size: [16, 10],
    base: 'breadboard-only',
    parts: [
      {
        id: 'psu',
        kind: 'module',
        pos: [SUP_AT[0], BENCH_Y, SUP_AT[1]],
        mount: 'offboard',
        label: 'SUPPLY',
        role: 'A single 5 V bench supply: the op-amp’s only power. Everything else on the board has to live between 0 V and 5 V.',
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
        label: 'GENERATOR',
        role: 'Function generator: a 5 Hz sine riding on a 2.5 V offset, 50 mV peak to start. It stands in for a small sensor signal.',
        params: { title: 'FUNCTION GEN', color: '#4f5d68', w: MOD_W, d: MOD_D, pins: 0, chip: 'none', callout: [-0.4, 1.6, 0.3] },
        circuitIds: ['V_SIG'],
      },
      { id: 'gen-out', kind: 'testpoint', pos: genOut, mount: 'offboard', role: 'Generator output.', params: { color: 'red' } },
      { id: 'gen-gnd', kind: 'testpoint', pos: genGnd, mount: 'offboard', role: 'Generator ground.', params: { color: 'black' } },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the amplifier.' },
      {
        id: 'u1',
        kind: 'ic-dip',
        pos: dipAt,
        mount: 'tht',
        label: 'LM358',
        role: 'A dual op-amp (DIP-8). Half A (pins 1-3) is the amplifier you rewire; half B (pins 5-7) buffers the 2.5 V reference. The chip selector swaps in an MCP6002, which has the same pinout.',
        params: { pins: 8, marking: 'LM358', callout: [0, 1.9, -0.9] },
        circuitIds: ['U1A', 'U1B'],
        facts: [
          'LM358 (TI SLOS068): supply 3 V to 30 V; quiescent current 350 µA typ per amplifier',
          'Open-loop gain 100 V/mV typ (25 min) at V+ = 15 V, RL ≥ 2 kΩ',
          'Output swing: high to within 1.5 V of V+ (max, V+ = 5 V, RL ≥ 2 kΩ); low 5 mV typ, 20 mV max (RL ≤ 10 kΩ)',
          'Input common-mode range 0 V to V+ − 1.5 V at 25 °C (V+ − 2 V over temperature)',
          'Gain-bandwidth 0.7 MHz typ; slew rate 0.3 V/µs (G = +1); short-circuit current ±40 mA typ',
          'MCP6002 (Microchip DS20001733): 1.8 V to 6.0 V; rail-to-rail in (VSS − 0.3 V to VDD + 0.3 V) and out (within 25 mV, RL = 10 kΩ)',
          'MCP6002: GBWP 1 MHz typ, slew 0.6 V/µs, 100 µA per amplifier, ±23 mA short-circuit at 5.5 V',
        ],
      },
      {
        id: 'rf',
        kind: 'resistor',
        pos: between(rfA, rfB),
        mount: 'tht',
        label: 'R_F',
        role: 'Feedback resistor, 100 kΩ 1 % (brown-black-black-orange-brown): feeds a fraction of the output back to the − input.',
        params: { ohms: 100e3, span: 4 * PITCH, callout: [-0.5, 1.5, 0.9] },
        circuitIds: ['R_F'],
      },
      {
        id: 'rg',
        kind: 'resistor',
        pos: between(rgA, rgB),
        mount: 'tht',
        label: 'R_G',
        role: 'Gain resistor, 10 kΩ 1 % (brown-black-black-red-brown): from the − input to the reference (non-inverting) or to the signal (inverting).',
        params: { ohms: 10e3, span: 4 * PITCH, callout: [0.6, 1.5, 0.5] },
        circuitIds: ['R_G'],
      },
      {
        id: 'rl',
        kind: 'resistor',
        pos: between(rlA, rlB),
        rot: 90,
        mount: 'tht',
        role: 'A 10 kΩ load to ground, standing in for an ADC or meter input.',
        params: { ohms: 10e3, span: rlB[2] - rlA[2] },
        circuitIds: ['R_LOAD'],
      },
      {
        id: 'rh1',
        kind: 'resistor',
        pos: between(rh1A, rh1B),
        mount: 'tht',
        role: 'Top of the reference divider, 100 kΩ, from +5 V.',
        params: { ohms: 100e3, span: 4 * PITCH },
        circuitIds: ['R_H1'],
      },
      {
        id: 'rh2',
        kind: 'resistor',
        pos: between(rh2A, rh2B),
        mount: 'tht',
        label: 'BIAS',
        role: 'Bottom of the reference divider, 100 kΩ to ground. With the top one it makes 2.5 V, which half B buffers as the mid-rail reference.',
        params: { ohms: 100e3, span: 5 * PITCH, callout: [-0.6, 1.5, -0.6] },
        circuitIds: ['R_H2'],
      },
      {
        id: 'c1',
        kind: 'capacitor-ceramic',
        pos: between(bbHole(BB, 9, '+t'), bbHole(BB, 9, '-t')),
        mount: 'tht',
        role: '100 nF ceramic across the supply rails next to the chip (decoupling; not simulated).',
        params: { farads: 1e-7, code: '104' },
      },
      {
        id: 'cfg',
        kind: 'switch-slide',
        pos: between(swA, swB),
        mount: 'tht',
        label: 'CONFIG',
        role: 'The configuration selector. On a real breadboard you would move a few jumpers; here one selector rewires half A as non-inverting, inverting, buffer or comparator.',
        params: { callout: [0.6, 1.5, 0.8] },
        circuitIds: ['S_SP', 'S_PR', 'S_GR', 'S_SG', 'S_F', 'S_BUF'],
      },
      {
        id: 'ch1',
        kind: 'probe',
        pos: bbHole(BB, 16, 'h'),
        mount: 'offboard',
        label: 'CH1 · IN',
        role: 'Scope channel 1 on the generator signal, measured against the 2.5 V reference.',
        params: { color: 'yellow', tilt: 22, callout: [0.9, 1.2, 0.8] },
      },
      {
        id: 'ch2',
        kind: 'probe',
        pos: bbHole(BB, 14, 'g'),
        mount: 'offboard',
        label: 'CH2 · OUT',
        role: 'Scope channel 2 on the amplifier output (pin 1), measured against ground.',
        params: { color: 'blue', tilt: 22, callout: [-0.9, 1.2, 0.8] },
      },
      { id: 'w-sup-p', kind: 'wire', ...wSupP, mount: 'offboard', role: 'Supply + to the top + rail.' },
      { id: 'w-sup-n', kind: 'wire', ...wSupN, mount: 'offboard', role: 'Supply − to the top ground rail.' },
      { id: 'w-rails', kind: 'wire', ...wGndRails, mount: 'offboard', role: 'Ties the two ground rails together.' },
      { id: 'w-vcc', kind: 'wire', ...wVcc, mount: 'offboard', role: 'Pin 8 (V+) to +5 V.' },
      { id: 'w-gnd', kind: 'wire', ...wGnd, mount: 'offboard', role: 'Pin 4 (GND) to ground.' },
      { id: 'w-rh1', kind: 'wire', ...wRh1, mount: 'offboard', role: 'Divider top to +5 V.' },
      { id: 'w-rh2', kind: 'wire', ...wRh2, mount: 'offboard', role: 'Divider bottom to ground.' },
      { id: 'w-follow', kind: 'wire', ...wFollow, mount: 'offboard', role: 'Half B: output (pin 7) straight to its − input (pin 6), a buffer.' },
      { id: 'w-ref', kind: 'wire', ...wRef, mount: 'offboard', role: 'The buffered 2.5 V reference to R_G.' },
      { id: 'w-outf', kind: 'wire', ...wOutF, mount: 'offboard', role: 'Output (pin 1) to the top of R_F.' },
      { id: 'w-sig', kind: 'wire', ...wSig, mount: 'offboard', role: 'Generator signal to the + input (pin 3).' },
      { id: 'w-sig-gnd', kind: 'wire', ...wSigGnd, mount: 'offboard', role: 'Generator ground to the bottom ground rail.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_SUP', type: 'V', nodes: ['vcc', '0'], value: 5, rInternal: 0.05, partId: 'psu' },
      // the 2.5 V reference: a 100k/100k divider buffered by half B
      { id: 'R_H1', type: 'R', nodes: ['vcc', 'half'], value: 100e3, rating: { maxP: 0.25 }, partId: 'rh1' },
      { id: 'R_H2', type: 'R', nodes: ['half', '0'], value: 100e3, rating: { maxP: 0.25 }, partId: 'rh2' },
      { id: 'U1B', type: 'OPAMP', nodes: ['half', 'ref', 'ref'], gain: 1e5, vPos: LM358_HI, vNeg: V_LOW, partId: 'u1' },
      // the signal: a buffered generator output, 2.5 V ± 50 mV at 5 Hz
      { id: 'V_SIG', type: 'V', nodes: ['sig', '0'], value: 0, wave: { kind: 'sine', amp: 0.05, freq: 5, offset: 2.5 }, rInternal: 0.05, partId: 'gen' },
      // the configuration selector (opamp-config sets these every tick)
      { id: 'S_SP', type: 'SW', nodes: ['sig', 'p'], closed: true, partId: 'cfg' },
      { id: 'S_PR', type: 'SW', nodes: ['p', 'ref'], closed: false, partId: 'cfg' },
      { id: 'S_GR', type: 'SW', nodes: ['g', 'ref'], closed: true, partId: 'cfg' },
      { id: 'S_SG', type: 'SW', nodes: ['sig', 'g'], closed: false, partId: 'cfg' },
      { id: 'S_F', type: 'SW', nodes: ['fx', 'n'], closed: true, partId: 'cfg' },
      { id: 'S_BUF', type: 'SW', nodes: ['out', 'n'], closed: false, partId: 'cfg' },
      { id: 'R_G', type: 'R', nodes: ['n', 'g'], value: 10e3, rating: { maxP: 0.25 }, partId: 'rg' },
      { id: 'R_F', type: 'R', nodes: ['out', 'fx'], value: 100e3, rating: { maxP: 0.25 }, partId: 'rf' },
      // half A: in+, in−, out
      { id: 'U1A', type: 'OPAMP', nodes: ['p', 'n', 'out'], gain: 1e5, vPos: LM358_HI, vNeg: V_LOW, partId: 'u1' },
      { id: 'R_LOAD', type: 'R', nodes: ['out', '0'], value: 10e3, rating: { maxP: 0.25 }, partId: 'rl' },
    ],
  },
  powerElementId: 'V_SUP',
  powerLabel: 'Connect 5 V',

  readouts: [
    { label: 'V+ (PIN 3)', source: { kind: 'voltage', node: 'p' }, unit: 'V' },
    { label: 'V− (PIN 2)', source: { kind: 'voltage', node: 'n' }, unit: 'V' },
    { label: 'V OUT (PIN 1)', source: { kind: 'voltage', node: 'out' }, unit: 'V' },
    { label: 'V+ − V−', source: { kind: 'derived', op: 'diff', of: [0, 1] }, unit: 'V' },
    { label: 'IDEAL GAIN', source: { kind: 'behavior', key: 'cfg.ideal' }, unit: '', digits: 3 },
    { label: 'MEASURED GAIN', source: { kind: 'behavior', key: 'cfg.gain' }, unit: '', digits: 3 },
    { label: 'OUT HIGHEST', source: { kind: 'behavior', key: 'cfg.outHi' }, unit: 'V' },
    { label: 'OUT LOWEST', source: { kind: 'behavior', key: 'cfg.outLo' }, unit: 'V' },
    { label: 'SWING LOST TO CLIPPING', source: { kind: 'behavior', key: 'cfg.clipPct' }, unit: '%' },
    { label: 'REFERENCE', source: { kind: 'voltage', node: 'ref' }, unit: 'V' },
  ],

  tweaks: [
    {
      label: 'Configuration',
      elementId: 'behavior:cfg',
      key: 'mode',
      kind: 'enum',
      min: 0,
      max: 3,
      unit: '',
      options: [
        { label: 'Non-inverting', value: 0 },
        { label: 'Inverting', value: 1 },
        { label: 'Buffer', value: 2 },
        { label: 'Comparator', value: 3 },
      ],
    },
    {
      label: 'Chip',
      elementId: 'U1A',
      key: 'vPos',
      kind: 'enum',
      min: LM358_HI,
      max: MCP6002_HI,
      unit: 'V',
      options: [
        { label: 'LM358', value: LM358_HI },
        { label: 'MCP6002 (rail-to-rail)', value: MCP6002_HI },
      ],
      link: [{ elementId: 'U1B', key: 'vPos' }],
    },
    { label: 'Input amplitude (peak)', elementId: 'V_SIG', key: 'wave.amp', min: 0.01, max: 2.5, log: true, unit: 'V' },
    { label: 'Feedback resistor R_F', elementId: 'R_F', key: 'value', min: 10e3, max: 1e6, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'READY' }, text: 'READY: connect 5 V, then watch CH1 (input) and CH2 (output) on the scope' },
    { when: { kind: 'state', is: 'POWERED' }, text: 'LINEAR: gain {5} (ideal {4}); V+ − V− = {3}, so the − input follows the + input' },
    { when: { kind: 'above', readout: 8, value: 2 }, text: 'CLIPPING: the output wants more than the chip can give, so it stops at {6} / {7} and {8} of the swing is cut off' },
    { when: { kind: 'above', readout: 4, value: 1000 }, text: 'NO FEEDBACK: open-loop gain {4} turns any difference into a rail: the output jumps between {7} and {6}' },
    { when: { kind: 'state', is: 'FAULT' }, text: 'FAULT: a part failed; repair to try again' },
  ],

  failures: [
    {
      id: 'no-feedback',
      label: 'The feedback resistor pops out',
      explain:
        'With R_F gone nothing ties the output back to the − input, which now just sits on the 2.5 V reference through R_G. The full open-loop gain (about 100 000) multiplies the ±50 mV difference, so the output slams to 3.5 V on every positive half-cycle and to 0 V on every negative one. V+ − V− is no longer ≈ 0: the golden rules only hold while negative feedback is working.',
      patches: [
        { op: 'remove', elementId: 'R_F' },
        { op: 'set', elementId: 'behavior:cfg', key: 'mode', value: 0 },
      ],
      parts: { hide: ['rf'] },
    },
    {
      id: 'too-much-gain',
      label: 'Fit a 1 MΩ feedback resistor',
      explain:
        'The gain is now 1 + 1 MΩ/10 kΩ = 101, so ±50 mV in asks for ±5.05 V around 2.5 V: from −2.55 V to 7.55 V. A 5 V LM358 can only go from about 0 V to 3.5 V, so the sine is cut flat at both ends. Every amplifier clips at its output swing, and on a single low supply that swing is small.',
      patches: [
        { op: 'set', elementId: 'R_F', key: 'value', value: 1e6 },
        { op: 'set', elementId: 'behavior:cfg', key: 'mode', value: 0 },
      ],
    },
    {
      id: 'lost-bias',
      label: 'The bias resistor to ground is missing',
      explain:
        'Without the bottom divider resistor, half B’s + input is pulled to 5 V and its output rises as far as it can, 3.5 V. The "mid-rail" reference is now 3.5 V while the signal still sits at 2.5 V, so the non-inverting stage wants 3.5 + 11 × (2.5 − 3.5) = −7.5 V and sits on 0 V. A single-supply amplifier lives on its bias point: lose it and the signal is gone.',
      patches: [
        { op: 'remove', elementId: 'R_H2' },
        { op: 'set', elementId: 'behavior:cfg', key: 'mode', value: 0 },
      ],
      parts: { hide: ['rh2'] },
    },
  ],

  guide: [
    {
      id: 'meet-the-chip',
      title: 'Meet the op-amp',
      body: 'Click **U1** to open its inspector. It is an **LM358**, a dual op-amp in an 8-pin DIP. This lesson uses one half as the amplifier and the other half for a 2.5 V reference.',
      check: { kind: 'inspect', part: 'u1' },
      focus: { part: 'u1' },
      hint: 'It is the black 8-pin chip straddling the middle channel of the breadboard.',
      explain: 'An op-amp amplifies the difference between its two inputs by a huge factor, about 100 000 here. On its own that is useless, since a millivolt of difference slams the output into a rail. Feedback is what turns it into a precise amplifier.',
    },
    {
      id: 'connect',
      title: 'Connect 5 V',
      body: 'Press **Connect 5 V**. In the non-inverting setup **MEASURED GAIN** reads **11**, and **V+ − V−** is almost exactly **0**: the − input follows the + input.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'power' },
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 9, above: 2.4, below: 2.6, holdMs: 300 },
          { kind: 'readout', index: 5, above: 10.5, below: 11.5, holdMs: 300 },
          { kind: 'readout', index: 3, above: -0.001, below: 0.001, holdMs: 300 },
        ],
      },
      focus: { control: 'power' },
      explain: 'With R_F = 100 kΩ and R_G = 10 kΩ the gain is 1 + R_F / R_G = 11. The op-amp adjusts its output until its inputs match to within microvolts. That is the golden rule of negative feedback: it makes V+ − V− ≈ 0, and the gain is then set by the resistors alone.',
    },
    {
      id: 'inverting',
      title: 'Flip it: inverting',
      body: 'Set **Configuration** to **Inverting**. **MEASURED GAIN** becomes about **−10**: the output swings opposite to the input.',
      check: {
        kind: 'all',
        of: [{ kind: 'tweak', target: 'Configuration', min: 1, max: 1 }, { kind: 'readout', index: 5, above: -10.5, below: -9.5, holdMs: 300 }],
      },
      focus: { control: 'tweak:Configuration' },
      hint: 'Wait a second or so after the change: the gain is measured over a whole cycle of the 5 Hz signal.',
      explain: 'Now the signal goes into the − input through R_G, and R_F feeds the output back to it. The − input is held at the 2.5 V reference by feedback (a virtual ground), so the gain is −R_F / R_G = −10.',
    },
    {
      id: 'clip',
      title: 'Ask for too much',
      body: 'Slide **Input amplitude (peak)** up to about **0.5 V**. The output wants to swing ±5 V, but the chip can only manage 0 to 3.5 V, so **SWING LOST TO CLIPPING** goes above **20 %**.',
      check: {
        kind: 'all',
        of: [{ kind: 'tweak', target: 'Input amplitude (peak)', min: 0.4 }, { kind: 'readout', index: 8, above: 20, holdMs: 300 }],
      },
      focus: { control: 'tweak:Input amplitude (peak)' },
      hint: 'The slider is logarithmic. Slide it about two thirds of the way along.',
      explain: 'The output can’t exceed the supply rails, and an LM358’s output stops about 1.5 V short of the positive rail, so it flat-tops at 3.5 V on a 5 V supply. The gain equation only holds while the output has room to move.',
    },
    {
      id: 'rail-to-rail',
      title: 'Swap the chip',
      body: 'Set **Chip** to **MCP6002 (rail-to-rail)**. The output now reaches **4.97 V**, so **OUT HIGHEST** goes above **4.5 V**.',
      check: {
        kind: 'all',
        of: [{ kind: 'tweak', target: 'Chip', min: 4.9 }, { kind: 'readout', index: 6, above: 4.5, holdMs: 300 }],
      },
      focus: { control: 'tweak:Chip' },
      explain: 'A rail-to-rail output stage can get within about 25 mV of the supply. On a single 5 V supply that is the difference between 3.5 V and 4.97 V of usable swing, which is why modern single-supply designs choose rail-to-rail parts.',
    },
    {
      id: 'no-feedback',
      title: 'Break it: lose the feedback',
      body: 'Open **Break something** and choose **The feedback resistor pops out**. **IDEAL GAIN** jumps to the open-loop value of about **100 000**.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'no-feedback' }, { kind: 'readout', index: 4, above: 1000, holdMs: 300 }] },
      focus: { control: 'break' },
      explain: 'Nothing now ties the output back to the − input, which just sits at 2.5 V. The 100 000-fold gain multiplies even a few millivolts of difference, so the output slams between the rails: the op-amp has become a comparator. V+ − V− is no longer zero, because the golden rule only holds while feedback works.',
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
      body: 'Answer the questions in **Check yourself** below: they use 1 + R_F / R_G, −R_F / R_G and the output swing.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  meet: `An op-amp amplifies the **difference** between its two inputs by an enormous open-loop gain, about 100 000 for an LM358. On its own that is useless: 50 µV of difference would already be 5 V. Add **negative feedback** (a fraction of the output fed back to the − input) and two rules emerge:

1. The output moves until **V− = V+**. Watch the **V+ − V−** readout: tens of microvolts.
2. The inputs draw (almost) **no current**.

**Single supply, mid-rail reference.** This board has only 5 V, so the signal rides on a **2.5 V reference** made by a 100k/100k divider and buffered by the chip's other half (a *buffer*: output tied straight to the − input, gain 1). The generator sends 2.5 V ± 50 mV at 5 Hz.

**Non-inverting.** V− is the output divided by R_F and R_G, so V− = V_out·R_G/(R_F + R_G) (measured from the reference). Setting V− = V+ gives

**gain = 1 + R_F/R_G** = 1 + 100k/10k = **11**, so ±50 mV becomes **±0.55 V** around 2.5 V.

**Inverting.** Switch the configuration: + goes to the reference, the signal goes into R_G. The − input becomes a *virtual* 2.5 V (rule 1), so the signal current through R_G must all flow through R_F (rule 2): **gain = −R_F/R_G = −10**. On the scope the output is upside down.

**Buffer.** Gain 1, but the output can drive a load the source could not: the input draws almost nothing.

**Clipping.** Raise the amplitude to 150 mV in non-inverting mode: the stage asks for 2.5 + 1.65 = 4.15 V, but an LM358 on 5 V is only guaranteed to reach **V+ − 1.5 V = 3.5 V**. The top of the sine is cut flat while the bottom (0.85 V) is still clean. Its low side reaches within about 5 mV of ground. Swap the **chip** to an **MCP6002**: its output swings to within 25 mV of each rail, so the same 4.15 V peak passes untouched.

**Comparator.** With no feedback at all, the output just reports which input is higher: it jumps between the two output limits, 0 V and 3.5 V on an LM358, 0 V and 4.975 V on an MCP6002. (A real LM358 makes a slow comparator: at 0.3 V/µs a 3.5 V swing takes over 10 µs. Dedicated comparators like the LM393 exist for this.)

**What this simulation leaves out.** The op-amp model is an ideal high-gain amplifier clamped to its output limits. It has **no gain-bandwidth** (the LM358's 0.7 MHz typical means a gain of 11 runs out of gain near 64 kHz), **no slew-rate limit**, **no output current limit** (about ±40 mA into a short) and **no input common-mode limit**, and its solver settles on a balance point that real hardware never holds, so **swapped inputs** (positive feedback, which in a real circuit latches the output at a rail) are not offered as a failure here. The common-mode limit matters on this board: an LM358's inputs only work up to V+ − 1.5 V, so a buffer fed 4 V misbehaves in real life even before the output stops at 3.5 V. The signal is kept at 5 Hz so none of these change what you see.`,

  mechanicalAnalogy: `An op-amp with feedback is a hydraulic servo with a position-feedback linkage. The servo valve (the op-amp) has enormous gain and drives the actuator until the feedback linkage says the error is zero. The lever ratio sets the overall gain, 1 + R_F/R_G, not the valve. Take the linkage off (no feedback) and the actuator runs to an end stop: that is the comparator. Hook the linkage up backwards (positive feedback) and any error makes itself bigger, so the actuator slams to a stop and stays there.

**Where it breaks:** like a servo, too much phase lag around the loop makes it hunt and oscillate. Op-amps are compensated internally to stay stable, but heavy capacitive loads add lag. The output also has hard stops (its swing limits) and limited force (current, tens of mA).`,

  proTips: [
    'Put a 100 nF ceramic capacitor right at the op-amp’s supply pin. Long supply leads plus fast edges make amplifiers oscillate.',
    'Tie the unused half of a dual op-amp as a follower to a voltage inside its input range (mid-rail, or ground for parts whose inputs include ground). Never leave its inputs floating.',
    'On a low single supply, read the "output voltage swing" and "common-mode input range" lines first. If you need the whole rail, use a rail-to-rail part such as the MCP6002 (1.8 V to 6 V supplies only).',
    'Gain × bandwidth is roughly constant: an LM358 (0.7 MHz) at a gain of 100 has only about 7 kHz of bandwidth. Split a big gain across two stages.',
  ],

  quiz: [
    {
      q: 'What is the gain of a non-inverting amplifier with R_F = 47 kΩ and R_G = 4.7 kΩ?',
      options: ['10', '11', '47', '0.1'],
      answer: 1,
      why: '1 + 47/4.7 = 11.',
    },
    {
      q: 'The same two resistors in the inverting configuration give a gain of…',
      options: ['−11', '−10', '−0.1', '+10'],
      answer: 1,
      why: 'Inverting gain is −R_F/R_G = −47/4.7 = −10. Only the non-inverting stage adds the 1.',
    },
    {
      q: 'An LM358 on 5 V, gain 11 around 2.5 V, is given 2.5 V ± 0.15 V. What does the output do?',
      options: ['Swings 0.85 V to 4.15 V', 'Clips at about 3.5 V on top, swings down cleanly to 0.85 V', 'Clips at 5 V', 'Clips at both ends'],
      answer: 1,
      why: 'It needs 4.15 V at the top, but an LM358 is only guaranteed to reach V+ − 1.5 V = 3.5 V. The bottom, 0.85 V, is within its range.',
    },
    {
      q: 'Why does V− equal V+ in a working negative-feedback circuit?',
      options: [
        'The inputs are shorted inside the chip',
        'The resistors force it',
        'The supply sets both inputs',
        'The huge open-loop gain drives the output until the fed-back voltage cancels the difference',
      ],
      answer: 3,
      why: 'Any remaining difference times ≈ 10⁵ would move the output, so it settles only when the difference is ≈ 0.',
    },
    {
      q: 'R_G = 10 kΩ. Which R_F gives a non-inverting gain of 6?',
      options: ['6 kΩ', '60 kΩ', '50 kΩ (use 51 kΩ)', '100 kΩ'],
      answer: 2,
      why: '1 + R_F/10k = 6, so R_F = 50 kΩ; the nearest standard E24 value is 51 kΩ.',
    },
  ],

  behaviors: [
    {
      id: 'opamp-config',
      instance: 'cfg',
      params: {
        mode: 0,
        switches: SWITCHES,
        patterns: PATTERNS,
        rf: 'R_F',
        rg: 'R_G',
        opamp: 'U1A',
        sine: 'V_SIG',
        in: 'sig',
        out: 'out',
        ref: 'ref',
      },
    },
  ],

  instruments: {
    open: true,
    view: 'scope',
    scope: {
      channels: [
        { label: 'IN (vs 2.5 V)', source: { kind: 'voltage', node: 'sig', ref: 'ref' }, perDiv: 0.05, offset: 0 },
        {
          label: 'OUT',
          source: { kind: 'voltage', node: 'out' },
          perDiv: 1,
          offset: -2.5,
          marks: [
            { value: LM358_HI, label: 'LM358 MAX 3.5 V' },
            { value: 5, label: 'V+ 5 V' },
          ],
        },
      ],
      timePerDiv: 0.05,
      trigger: { channel: 0, level: 0, slope: 'rising', mode: 'auto' },
    },
    chart: { signals: [0, 2], span: 2 },
  },
}
