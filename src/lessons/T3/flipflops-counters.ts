// T3 · Flip-Flops and Counters. Source: docs/curriculum/T3/flipflops-counters.md
//
// Two breadboards. Left: a 74HC00 whose two NAND gates are cross-coupled into an SR latch (active-low
// SET and RESET buttons), and a 74HC74 D flip-flop (a behavior, `hc74`). Right: a CLOCK button that
// chatters like a real contact (`switch-bounce`), an RC debounce (R_S, C_DB, R_PD), a 74HC14 whose two
// Schmitt inverters square the slow RC slope up, and a 74HC393 ripple counter (behavior `hc393`)
// driving four LEDs. The 25 Hz AUTO CLOCK switch replaces the finger with an oscillator so the
// strip chart shows the divide-by-2 per stage.
// The sim steps at 100 µs (the bounce lasts a few ms, the debounce time constants 1-10 ms) at x0.1.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, PITCH, bbHole, between } from '../layout'

const BB1: [number, number] = [-4.9, 0.3] // latch + D flip-flop
const BB2: [number, number] = [4.9, 0.3] // clock conditioning + counter
const BB_Y = BENCH_Y + 0.85
const dipAt = (bb: [number, number], col: number): [number, number, number] => [bb[0] + (col - 15.5) * PITCH, BB_Y, bb[1]]
const row = (bb: [number, number], c1: number, c2: number, r: string) => between(bbHole(bb, c1, r), bbHole(bb, c2, r))

/** 74HC input thresholds from the 74HC14 datasheet (TI SCLS085L) at 4.5 V: V_T+ 2.5 V typ, hysteresis 0.9 V typ */
const SCHMITT = { vth: 2.05, hyst: 0.9 }
const LED_R = { maxP: 0.25 }
const LED_RATING = { maxI: 0.03, maxV: 5 }
const OUT_R = 50 // CMOS output stage standing in for a 74HC output

const ledPart = (id: string, bb: [number, number], col: number, color: string, label: string, role: string, circuitIds: string[], callout?: [number, number, number]) => ({
  id,
  kind: 'led' as const,
  pos: row(bb, col, col + 1, 'b'),
  rot: 180,
  mount: 'tht' as const,
  label,
  role,
  params: { color, ...(callout ? { callout } : {}) },
  circuitIds,
})

export const lesson: LessonDef = {
  id: 'flipflops-counters',
  track: 'T3',
  title: 'Flip-Flops and Counters',
  subtitle: 'Circuits that remember',
  tagline: 'Two cross-coupled NAND gates hold one bit; four toggling flip-flops count button presses from 0 to 15, once you stop the switch from counting its own bounces.',

  board: {
    name: 'MEM-23',
    size: [19, 9],
    base: 'breadboard-only',
    parts: [
      { id: 'bb1', kind: 'breadboard', pos: BB1, mount: 'offboard', role: 'Memory: the SR latch and the D flip-flop.' },
      { id: 'bb2', kind: 'breadboard', pos: BB2, mount: 'offboard', role: 'Counting: the debounced clock and the ripple counter.' },
      {
        id: 'u1',
        kind: 'ic-dip',
        pos: dipAt(BB1, 6),
        mount: 'tht',
        label: 'LATCH',
        role: 'A 74HC00 (quad 2-input NAND). Two of its gates are cross-coupled: each output feeds the other gate’s input, which gives the pair two stable states.',
        params: { pins: 14, marking: '74HC00', callout: [0, 1.7, -0.9] },
        circuitIds: ['U1A', 'U1B'],
        facts: ['74HC00, 5 V: output = NOT (A AND B)', 'Supply 2 V to 6 V; CMOS inputs draw almost no current', 'Cross-coupled NANDs: S and R are active LOW; S = R = 0 is the forbidden input'],
      },
      {
        id: 'bs',
        kind: 'button',
        pos: bbHole(BB1, 12, 'i'),
        mount: 'tht',
        label: 'SET',
        role: 'Pulls the latch’s S input to ground (through a 10 kΩ pull-up to 5 V it otherwise sits high). Q goes high and stays high after you let go.',
        params: { callout: [0, 1.1, 0.6] },
        circuitIds: ['SW_SET', 'R_PS'],
      },
      {
        id: 'br',
        kind: 'button',
        pos: bbHole(BB1, 16, 'i'),
        mount: 'tht',
        label: 'RESET',
        role: 'Pulls the R input to ground. Q goes low and stays low after you let go.',
        params: { callout: [0, 1.1, 0.6] },
        circuitIds: ['SW_RESET', 'R_PR'],
      },
      ledPart('lq', BB1, 11, 'green', 'Q', 'Lit when Q is high (with its 1 kΩ).', ['LED_Q', 'R_LQ'], [-0.6, 1.3, -0.9]),
      ledPart('lqn', BB1, 15, 'red', 'Q BAR', 'Lit when Q-bar is high. In a working latch exactly one of the two is lit.', ['LED_QN', 'R_LQN'], [0.9, 1.3, -0.8]),
      {
        id: 'u3',
        kind: 'ic-dip',
        pos: dipAt(BB1, 24),
        mount: 'tht',
        label: 'D FLIP-FLOP',
        role: 'Half of a 74HC74: on each rising clock edge it copies D to Q, and ignores D the rest of the time (behavior).',
        params: { pins: 14, marking: '74HC74', callout: [0, 1.7, -0.9] },
        circuitIds: ['V_DQ', 'V_DQN', 'R_DPD'],
        facts: [
          '74HC74 (TI): positive-edge triggered, with clear and preset',
          'Hold time of D after CLK: 0 ns at 4.5 V; D must be steady for a setup time before the edge',
          'Q-bar tied back to D makes a toggle (divide by 2)',
        ],
      },
      {
        id: 'sd',
        kind: 'switch-slide',
        pos: row(BB1, 21, 23, 'i'),
        mount: 'tht',
        label: 'D INPUT',
        role: 'Sets the flip-flop’s D input high (on) or low (off). Nothing happens to Q until the next clock edge.',
        params: { callout: [0, 1.2, 0.6] },
        circuitIds: ['SW_D'],
      },
      {
        id: 'st',
        kind: 'switch-slide',
        pos: row(BB1, 25, 27, 'i'),
        mount: 'tht',
        label: 'TOGGLE',
        role: 'Ties Q-bar back to D. Now every clock edge flips Q: a divide-by-2.',
        params: { callout: [0, 1.2, 0.6] },
        circuitIds: ['SW_TOG'],
      },
      ledPart('lfq', BB1, 28, 'yellow', 'FF Q', 'The flip-flop’s Q output.', ['LED_FQ', 'R_LFQ'], [0.8, 1.3, -0.7]),

      {
        id: 'u2',
        kind: 'ic-dip',
        pos: dipAt(BB2, 6),
        mount: 'tht',
        label: 'SCHMITT',
        role: 'A 74HC14 hex Schmitt inverter. The slow RC curve goes in; one clean edge comes out, because it switches at 2.5 V going up and about 1.6 V going down.',
        params: { pins: 14, marking: '74HC14', callout: [0, 1.7, -0.9] },
        circuitIds: ['U2A', 'U2B'],
        facts: [
          '74HC14 (TI SCLS085L), 4.5 V: V_T+ 1.55 to 3.13 V (2.5 V typ), hysteresis 0.4 to 2.1 V (0.9 V typ)',
          'Used here with V_T+ = 2.5 V and V_T− = 1.6 V (typical values)',
          'Two inverters in a row: the second one restores the press polarity',
        ],
      },
      {
        id: 'bc',
        kind: 'button',
        pos: bbHole(BB2, 12, 'i'),
        mount: 'tht',
        label: 'CLOCK',
        role: 'One press is one count. Its contacts bounce for a few milliseconds each time they make or break, which is what the debounce circuit must hide.',
        params: { callout: [0, 1.1, 0.6] },
        circuitIds: ['SW_CLK'],
      },
      {
        id: 'sa',
        kind: 'switch-slide',
        pos: row(BB2, 15, 17, 'i'),
        mount: 'tht',
        label: 'AUTO CLOCK',
        role: 'Swaps the finger for a 25 Hz oscillator, so you can see each stage halve the frequency of the one before.',
        params: { callout: [0, 1.2, 0.6] },
        circuitIds: ['SW_AUTO', 'V_AUTO'],
      },
      {
        id: 'rs',
        kind: 'resistor',
        pos: row(BB2, 10, 14, 'a'),
        mount: 'tht',
        role: '1 kΩ (brown-black-red-gold) in series with the switch: charges the capacitor in about 1 ms.',
        params: { ohms: 1000, span: 4 * PITCH },
        circuitIds: ['R_S'],
      },
      {
        id: 'rpd',
        kind: 'resistor',
        pos: row(BB2, 10, 14, 'c'),
        mount: 'tht',
        role: '10 kΩ (brown-black-orange-gold) pull-down. With C_DB it sets the 10 ms release time constant.',
        params: { ohms: 10000, span: 4 * PITCH },
        circuitIds: ['R_PD'],
      },
      {
        id: 'cdb',
        kind: 'capacitor-ceramic',
        pos: row(BB2, 16, 17, 'b'),
        mount: 'tht',
        label: 'C_DB',
        role: 'The debounce capacitor, 1 µF. Take it out (or make it small) and the counter sees every bounce.',
        params: { farads: 1e-6, code: '105', callout: [0, 1.2, -0.7] },
        circuitIds: ['C_DB'],
      },
      {
        id: 'u4',
        kind: 'ic-dip',
        pos: dipAt(BB2, 24),
        mount: 'tht',
        label: 'COUNTER',
        role: 'A 74HC393 (dual 4-bit ripple counter, one half used): it counts the falling edges of the clock and shows the count in binary on Q0 (LSB) to Q3 (behavior).',
        params: { pins: 14, marking: '74HC393', callout: [0, 1.7, -0.9] },
        circuitIds: ['V_Q0', 'V_Q1', 'V_Q2', 'V_Q3'],
        facts: [
          '74HC393 (TI): counts on the HIGH-to-LOW clock transition; MR high clears all four outputs',
          'Supply 2 V to 6 V; clock pulse width at least 20 ns at 4.5 V (SN74 grade)',
          'Each output is the previous one divided by 2: 16 states, then it wraps',
        ],
      },
      {
        id: 'bm',
        kind: 'button',
        pos: bbHole(BB2, 29, 'i'),
        mount: 'tht',
        label: 'CLEAR',
        role: 'Master reset: holds MR high (through its pull-down it normally sits low) and clears the count to 0000.',
        params: { callout: [0, 1.1, 0.6] },
        circuitIds: ['SW_MR', 'R_MRPD'],
      },
      ledPart('l0', BB2, 19, 'yellow', 'Q0', 'Bit 0, the least significant: toggles on every clock.', ['LED_B0', 'R_Q0'], [-1.0, 1.0, -0.6]),
      ledPart('l1', BB2, 21, 'yellow', 'Q1', 'Bit 1: toggles every second clock.', ['LED_B1', 'R_Q1'], [-0.5, 1.8, -0.9]),
      ledPart('l2', BB2, 23, 'yellow', 'Q2', 'Bit 2: toggles every fourth clock.', ['LED_B2', 'R_Q2'], [0.4, 1.8, -0.9]),
      ledPart('l3', BB2, 25, 'yellow', 'Q3', 'Bit 3, the most significant: toggles every eighth clock.', ['LED_B3', 'R_Q3'], [1.0, 1.0, -0.6]),
    ],
  },

  circuit: {
    // the latch powers up reset (Q = 0): a real one would pick a side at random
    ic: { q: 0, qn: 5, qf: 0 },
    elements: [
      { id: 'V_CC', type: 'V', nodes: ['vcc', '0'], value: 5, rInternal: 0.05 },

      // ── SR latch: two NAND gates (74HC00), active-low inputs with 10 kΩ pull-ups ──
      { id: 'R_PS', type: 'R', nodes: ['vcc', 'sn'], value: 10e3, rating: LED_R },
      { id: 'R_PR', type: 'R', nodes: ['vcc', 'rn'], value: 10e3, rating: LED_R },
      { id: 'SW_SET', type: 'SW', nodes: ['sn', '0'], closed: false },
      { id: 'SW_RESET', type: 'SW', nodes: ['rn', '0'], closed: false },
      { id: 'U1A', type: 'LOGIC', gate: 'NAND', nodes: ['sn', 'qn', 'q'], vcc: 5, partId: 'u1' },
      // the feedback wire from Q to U1B's input (F2 lifts it)
      { id: 'SW_FB', type: 'SW', nodes: ['q', 'qf'], closed: true, partId: 'u1' },
      { id: 'U1B', type: 'LOGIC', gate: 'NAND', nodes: ['rn', 'qf', 'qn'], vcc: 5, partId: 'u1' },
      { id: 'R_LQ', type: 'R', nodes: ['q', 'lq'], value: 1000, rating: LED_R },
      { id: 'LED_Q', type: 'LED', nodes: ['lq', '0'], color: 'green', rating: LED_RATING },
      { id: 'R_LQN', type: 'R', nodes: ['qn', 'lqn'], value: 1000, rating: LED_R },
      { id: 'LED_QN', type: 'LED', nodes: ['lqn', '0'], color: 'red', rating: LED_RATING },

      // ── clock: finger -> bouncing contact -> RC debounce -> two Schmitt inverters ──
      { id: 'SW_CLK', type: 'SW', nodes: ['vcc', 'sw'], closed: false },
      { id: 'V_AUTO', type: 'V', nodes: ['auto', '0'], value: 0, rInternal: 0.05 },
      { id: 'SW_AUTO', type: 'SW', nodes: ['auto', 'sw'], closed: false },
      { id: 'R_S', type: 'R', nodes: ['sw', 'clk'], value: 1000, rating: LED_R },
      { id: 'C_DB', type: 'C', nodes: ['clk', '0'], value: 1e-6, v0: 0, rating: { maxV: 50 } },
      { id: 'R_PD', type: 'R', nodes: ['clk', '0'], value: 10e3, rating: LED_R },
      // press: clk rises, nck falls (the counter's edge), ck rises (the flip-flop's edge)
      { id: 'U2A', type: 'LOGIC', gate: 'SCHMITT', nodes: ['clk', 'nck'], vcc: 5, ...SCHMITT, partId: 'u2' },
      { id: 'U2B', type: 'LOGIC', gate: 'SCHMITT', nodes: ['nck', 'ck'], vcc: 5, ...SCHMITT, partId: 'u2' },

      // ── D flip-flop (behavior hc74): D from a switch, or from Q-bar for a toggle ──
      { id: 'SW_D', type: 'SW', nodes: ['vcc', 'd'], closed: false },
      { id: 'R_DPD', type: 'R', nodes: ['d', '0'], value: 100e3, rating: LED_R },
      { id: 'SW_TOG', type: 'SW', nodes: ['dqn', 'd'], closed: false },
      { id: 'V_DQ', type: 'V', nodes: ['dq', '0'], value: 0, rInternal: OUT_R },
      { id: 'V_DQN', type: 'V', nodes: ['dqn', '0'], value: 5, rInternal: OUT_R },
      { id: 'R_LFQ', type: 'R', nodes: ['dq', 'lfq'], value: 1000, rating: LED_R },
      { id: 'LED_FQ', type: 'LED', nodes: ['lfq', '0'], color: 'yellow', rating: LED_RATING },

      // ── counter (behavior hc393): master reset and four outputs ──
      { id: 'SW_MR', type: 'SW', nodes: ['vcc', 'mr'], closed: false },
      { id: 'R_MRPD', type: 'R', nodes: ['mr', '0'], value: 10e3, rating: LED_R },
      ...[0, 1, 2, 3].flatMap((k) => [
        { id: `V_Q${k}`, type: 'V' as const, nodes: [`q${k}`, '0'] as [string, string], value: 0, rInternal: OUT_R },
        { id: `R_Q${k}`, type: 'R' as const, nodes: [`q${k}`, `l${k}`] as [string, string], value: 1000, rating: LED_R },
        { id: `LED_B${k}`, type: 'LED' as const, nodes: [`l${k}`, '0'] as [string, string], color: 'yellow' as const, rating: LED_RATING },
      ]),
    ],
  },
  powerElementId: 'V_CC',
  powerLabel: 'Connect 5 V',

  readouts: [
    { label: 'Q', source: { kind: 'voltage', node: 'q' }, unit: 'V' },
    { label: 'Q BAR', source: { kind: 'voltage', node: 'qn' }, unit: 'V' },
    { label: 'CLOCK (RC)', source: { kind: 'voltage', node: 'clk' }, unit: 'V' },
    { label: 'COUNT', source: { kind: 'behavior', key: 'ctr.count' }, unit: '' },
    { label: 'FF Q', source: { kind: 'voltage', node: 'dq' }, unit: 'V' },
    { label: 'PRESSES', source: { kind: 'behavior', key: 'bnc.presses' }, unit: '' },
    { label: 'EDGES COUNTED', source: { kind: 'behavior', key: 'ctr.edges' }, unit: '' },
    { label: 'Q0', source: { kind: 'voltage', node: 'q0' }, unit: 'V' },
    { label: 'Q1', source: { kind: 'voltage', node: 'q1' }, unit: 'V' },
    { label: 'Q2', source: { kind: 'voltage', node: 'q2' }, unit: 'V' },
    { label: 'Q3', source: { kind: 'voltage', node: 'q3' }, unit: 'V' },
    { label: 'EXTRA COUNTS', source: { kind: 'derived', op: 'diff', of: [6, 5] }, unit: '' },
  ],

  tweaks: [
    { label: 'SET button', elementId: 'SW_SET', key: 'closed', kind: 'momentary', min: 0, max: 1, unit: '' },
    { label: 'RESET button', elementId: 'SW_RESET', key: 'closed', kind: 'momentary', min: 0, max: 1, unit: '' },
    { label: 'CLOCK button', elementId: 'behavior:bnc', key: 'press', kind: 'momentary', min: 0, max: 1, unit: '' },
    { label: 'Auto clock (25 Hz)', elementId: 'SW_AUTO', key: 'closed', kind: 'toggle', min: 0, max: 1, unit: '' },
    { label: 'D input', elementId: 'SW_D', key: 'closed', kind: 'toggle', min: 0, max: 1, unit: '' },
    { label: 'Toggle (D = Q-bar)', elementId: 'SW_TOG', key: 'closed', kind: 'toggle', min: 0, max: 1, unit: '' },
    { label: 'CLEAR button', elementId: 'SW_MR', key: 'closed', kind: 'momentary', min: 0, max: 1, unit: '' },
    { label: 'Debounce capacitor', elementId: 'C_DB', key: 'value', min: 1e-8, max: 1e-5, log: true, unit: 'F' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: SET and RESET flip the latch and it remembers; CLOCK counts. Q = {0}, count {3}' },
    { when: { kind: 'above', readout: 6, value: 0 }, text: 'COUNTING: {3} on the yellow LEDs after {5} presses ({6} edges counted)' },
    { when: { kind: 'above', readout: 11, value: 0.5 }, text: 'MISCOUNTING: {6} edges counted for {5} presses. The contact bounced and the counter saw every bounce as a clock' },
    { when: { kind: 'state', is: 'READY' }, text: 'UNPOWERED: press Connect 5 V, then SET and RESET the latch' },
    { when: { kind: 'state', is: 'FAULT' }, text: 'FAULT: a part failed; repair to try again' },
  ],

  failures: [
    {
      id: 'both-buttons',
      label: 'Press SET and RESET together',
      explain:
        'Both active-low inputs are low, so both NAND outputs are forced high: Q and Q-bar are both 1 and no longer complements. This is the forbidden state. Release both at the same instant and the latch settles to Q = 1 or Q = 0 depending on which gate is a hair faster, which is why datasheets forbid it.',
      patches: [
        { op: 'set', elementId: 'SW_SET', key: 'closed', value: true },
        { op: 'set', elementId: 'SW_RESET', key: 'closed', value: true },
      ],
    },
    {
      id: 'cut-feedback',
      label: 'Lift the feedback wire',
      explain:
        'Without the Q-to-gate link the second gate has no memory input. A real floating CMOS input drifts anywhere; the sim shows it as low. Q now follows SET only while it is held and falls back to 0 on release: the loop is the memory, and breaking it breaks the memory.',
      patches: [
        { op: 'set', elementId: 'SW_FB', key: 'closed', value: false },
        { op: 'short', a: 'qf', b: '0' },
      ],
    },
    {
      id: 'no-debounce',
      label: 'Remove the debounce capacitor',
      explain:
        'The contact chatters for a few milliseconds each time it makes or breaks. With no capacitor, every chatter is a clean 0 V to 5 V edge on the Schmitt input and the counter, which responds in nanoseconds, counts all of them: one press, several counts. With 1 µF the node cannot fall fast enough between bounces (10 ms against 2 to 4 ms gaps), so there is one edge. Watch EXTRA COUNTS.',
      patches: [{ op: 'remove', elementId: 'C_DB' }],
      parts: { hide: ['cdb'] },
    },
  ],

  meet: `**Memory from feedback.** In the latch each NAND's output feeds the other's input. A NAND outputs 0 only when both inputs are 1. If Q is 1, the lower gate sees (R, Q) = (1, 1) and outputs Q-bar = 0, and that 0 forces the upper gate's output to stay 1. If Q is 0 the mirror image holds. Both states are self-sustaining: a **bistable**.

- **SET** (active low) pulls S to 0: Q goes to 1, and the loop holds it after you let go.
- **RESET** does the mirror image.
- **Both at once** forces both outputs to 1: the forbidden input.

**Edge triggering.** A gated latch is transparent while its enable is high, so D can race through. A **D flip-flop** (74HC74) samples D only at the instant of the rising clock edge and then ignores it. Try it: set D, and Q does nothing until you press CLOCK; change D with the button held and nothing happens.

**Divide by 2.** Tie Q-bar back to D (TOGGLE) and every clock edge flips Q, so Q runs at half the clock frequency. A 74HC393 chains four such stages: the outputs run at **÷2, ÷4, ÷8, ÷16**. Read Q3 Q2 Q1 Q0 as a binary number: after 11 falling clock edges it shows 1011 (8 + 2 + 1). The 16th edge wraps it to 0000. Switch on the 25 Hz AUTO CLOCK and watch the chart: Q0 at 12.5 Hz, Q1 6.25 Hz, Q2 3.125 Hz, Q3 1.5625 Hz.

**Debouncing.** A push button's contacts chatter for milliseconds, and a 74HC counter responds in nanoseconds (clock pulses of 20 ns are enough). Here R_PD and C_DB give a release time constant of 10 kΩ × 1 µF = **10 ms**, longer than the bounce gaps, so the node never falls far between chatters. The 74HC14's Schmitt trigger (about 2.5 V going up, 1.6 V going down, typical at 4.5 V) turns the slow RC slope into one clean edge. The bounce in this sim lasts 2 to 4 ms per segment, long enough to see; real switches range from well under a millisecond to several.

Everything here is a 74HC gate or a behavior standing in for one; the memory elements are modelled at their logic level, not transistor by transistor. Both bistables power up in a chosen state; a real one picks at random.`,

  mechanicalAnalogy: `A latch is a bistable snap mechanism, like an over-centre toggle clamp or a snap-through dome. It has two stable positions with an energy hill between them, and it stays put until pushed past the centre. A ripple counter is an odometer: each wheel advances the next once per full turn. A bouncing switch is a poorly damped contact: it rings against its stop, just as a mass on a spring would, and the debounce capacitor is the damper.

**Where it breaks:** a toggle clamp remembers with the power off, but the latch forgets the moment power is removed. Pushed exactly to its tipping point, an electronic latch can hover unpredictably for nanoseconds (metastability), a real hazard in fast digital design.`,

  proTips: [
    'Debounce every mechanical input, either in hardware (RC plus Schmitt trigger) or in firmware (ignore changes for 5 to 20 ms).',
    'Ripple counters glitch through intermediate values as each stage ripples. When outputs must change together, use a synchronous counter (e.g. 74HC161).',
    'Latches and flip-flops power up in an unknown state. Give them a defined reset (an RC power-on reset or an MCU-driven clear) before relying on their contents.',
    'Never drive S and R of a NAND latch low together. If two inputs can collide, use a D flip-flop, which has no forbidden state.',
  ],

  quiz: [
    {
      q: 'A 4-bit counter starts at 0000 and receives 11 clock edges. What does it show (Q3 Q2 Q1 Q0)?',
      options: ['1101', '0111', '1011', '1110'],
      answer: 2,
      why: '11 = 8 + 2 + 1, which is 1011 in binary.',
    },
    {
      q: 'A 1 kHz clock drives a 4-stage ripple counter. What is the frequency at Q3?',
      options: ['62.5 Hz', '250 Hz', '125 Hz', '16 kHz'],
      answer: 0,
      why: 'Each stage divides by 2, so 1000 / 2⁴ = 62.5 Hz.',
    },
    {
      q: 'What happens in a NAND SR latch when S and R are both asserted (both low)?',
      options: ['It toggles', 'Both outputs go high (forbidden), and the state after release is unpredictable', 'It holds its previous state', 'It resets to 0'],
      answer: 1,
      why: 'Each NAND with a low input outputs 1, so Q = Q-bar = 1; on release a race between the two gates decides the result.',
    },
    {
      q: 'What is the release time constant of a 10 kΩ pull-down with a 1 µF debounce capacitor?',
      options: ['0.1 ms', '1 ms', '100 ms', '10 ms'],
      answer: 3,
      why: 'τ = RC = 10 000 × 10⁻⁶ = 10 ms.',
    },
  ],

  behaviors: [
    { id: 'switch-bounce', instance: 'bnc', params: { element: 'SW_CLK', seed: 1, minMs: 2, maxMs: 4, maxBounces: 3 } },
    { id: 'hc393', instance: 'ctr', params: { clk: 'nck', mr: 'mr', q: 'V_Q0,V_Q1,V_Q2,V_Q3' } },
    { id: 'hc74', instance: 'ff', params: { d: 'd', clk: 'ck', q: 'V_DQ', qn: 'V_DQN' } },
    { id: 'square-wave', instance: 'osc', params: { element: 'V_AUTO', hz: 25, v: 5, duty: 0.5 } },
  ],

  transient: true,
  sim: { dt: 1e-4, speed: 0.1 },

  instruments: {
    open: false,
    scope: {
      channels: [
        { label: 'CLK (RC)', source: { kind: 'voltage', node: 'clk' }, perDiv: 2, offset: 2 },
        { label: 'COUNTER IN', source: { kind: 'voltage', node: 'nck' }, perDiv: 2, offset: -2 },
      ],
      timePerDiv: 5e-3,
      trigger: { channel: 1, level: 2.5, slope: 'falling', mode: 'normal' },
    },
    chart: { signals: [7, 8, 9, 10], span: 2 },
  },
}
