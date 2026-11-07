// T0 · Series and Parallel. Source: docs/curriculum/T0/series-parallel.md
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

// Bench layout (the camera looks from +x +z): breadboard front left, the 4 × AA pack behind it with its
// leads toward the breadboard, the multimeter to the right. The network sits in the top half of the board
// (rows a-e share a strip per column):
//   column 12 = node "a"  (pack + enters at row a, R1's left lead at row b)
//   column 16 = node "b"  (R1's right lead; R3 row a, R2 row c, and the failure parts R_X row e / bridge row d)
//   column 20 = ground    (R3 row a, R2 row c, R_X row e; the ground jumper leaves from row b to the − rail)
const BB: [number, number] = [-1.0, 1.0]
const PACK_AT: [number, number] = [-1.0, -4.6]
const METER_AT: [number, number] = [5.7, -0.3]

const C_A = 12
const C_B = 16
const C_G = 20

/** where the pack's own red (+) / black (−) leads end (pack at rot 90: leads leave toward +z) */
const packLead = (c: 'red' | 'black'): [number, number, number] =>
  c === 'red' ? [PACK_AT[0] - 0.1, BENCH_Y + 0.06, PACK_AT[1] + 4.1] : [PACK_AT[0] + 0.45, BENCH_Y + 0.06, PACK_AT[1] + 4.05]

const r1L = bbHole(BB, C_A, 'b')
const r1R = bbHole(BB, C_B, 'b')
const r2L = bbHole(BB, C_B, 'c')
const r2R = bbHole(BB, C_G, 'c')
const r3L = bbHole(BB, C_B, 'a')
const r3R = bbHole(BB, C_G, 'a')
const rxL = bbHole(BB, C_B, 'e')
const rxR = bbHole(BB, C_G, 'e')

const wPlus = jumper(packLead('red'), bbHole(BB, C_A, 'a'), 'red', 0.3)
const wMinus = jumper(packLead('black'), bbHole(BB, 17, '-t'), 'black', 0.3)
const wGnd = jumper(bbHole(BB, C_G, 'b'), bbHole(BB, 21, '-t'), 'black', 0.3)
// the "solder bridge" failure: a stray wire from the junction column to the ground column
const wBridge = jumper(bbHole(BB, C_B, 'd'), bbHole(BB, C_G, 'd'), 'green', 0.12)

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

/** 1/4 W carbon-film resistors */
const R_RATING = { maxP: 0.25 }

export const lesson: LessonDef = {
  id: 'series-parallel',
  track: 'T0',
  title: 'Series and Parallel',
  subtitle: 'Adding up resistance',
  tagline: '1 kΩ in series with 2.2 kΩ ∥ 3.3 kΩ makes 2.32 kΩ, so a 6 V pack drives 2.59 mA.',

  board: {
    name: 'NET-04',
    size: [13, 12],
    frame: { size: [13, 11.6], center: [1.2, -1.9] },
    base: 'breadboard-only',
    parts: [
      {
        id: 'pack',
        kind: 'battery-aa-pack',
        pos: [PACK_AT[0], BENCH_Y, PACK_AT[1]],
        rot: 90,
        mount: 'offboard',
        label: 'PACK',
        role: '6 V nominal from four alkaline AAs (about 0.6 Ω internal). Its slide switch is the Connect battery button.',
        params: { cells: 4, callout: [0, 1.8, 0] },
        circuitIds: ['V_PACK', 'SW1'],
      },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', label: 'BREADBOARD', role: 'Holds the network.' },
      {
        id: 'r1',
        kind: 'resistor',
        pos: between(r1L, r1R),
        mount: 'tht',
        label: 'SERIES',
        role: 'R1, 1 kΩ: carries the whole current (brown-black-red-gold, 1/4 W).',
        params: { ohms: 1000, callout: [0, 1.7, -0.3] },
        circuitIds: ['R1'],
      },
      {
        id: 'r2',
        kind: 'resistor',
        pos: between(r2L, r2R),
        mount: 'tht',
        label: 'BRANCH',
        role: 'R2, 2.2 kΩ: one of two parallel paths (red-red-red-gold, 1/4 W).',
        params: { ohms: 2200, callout: [0.3, 1.6, 0.4] },
        circuitIds: ['R2'],
      },
      {
        id: 'r3',
        kind: 'resistor',
        pos: between(r3L, r3R),
        mount: 'tht',
        label: 'SHUNT',
        role: 'R3, 3.3 kΩ: the other parallel path (orange-orange-red-gold, 1/4 W).',
        params: { ohms: 3300, callout: [0.2, 1.6, -0.6] },
        circuitIds: ['R3'],
      },
      {
        id: 'm1',
        kind: 'multimeter',
        pos: [METER_AT[0], BENCH_Y, METER_AT[1]],
        mount: 'offboard',
        label: 'TOTAL',
        role: 'Ammeter in series with the pack: reads the total current. The other currents are on the status panel.',
        params: { scale: 0.5, readout: 0, unit: 'mA', mode: 'A', title: 'BENCH DMM', callout: [0, 1.8, 1.4] },
        circuitIds: ['P_T'],
      },
      { id: 'w-plus', kind: 'wire', ...withCallout(wPlus, [-0.8, 0.5, 0]), mount: 'offboard', label: 'PACK +', role: 'Pack + to the start of R1 (column 12).' },
      { id: 'w-minus', kind: 'wire', ...wMinus, mount: 'offboard', role: 'Pack − to the ground rail.' },
      { id: 'w-gnd', kind: 'wire', ...withCallout(wGnd, [1.0, 0.4, 0.3]), mount: 'offboard', label: 'GND', role: 'Column 20, where R2 and R3 end, to the ground rail.' },
      {
        id: 'bridge',
        kind: 'wire',
        ...withCallout(wBridge, [1.2, 0.9, 1.0]),
        mount: 'offboard',
        label: 'BRIDGE',
        role: 'A stray wire (or solder blob) from the junction to ground.',
        hidden: true,
      },
      {
        id: 'rx',
        kind: 'resistor',
        pos: between(rxL, rxR),
        mount: 'tht',
        label: 'EXTRA 100 Ω',
        role: 'A 100 Ω resistor that someone pushed in across the pair (brown-black-brown-gold).',
        params: { ohms: 100, callout: [0.3, 1.7, 1.0] },
        hidden: true,
      },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_PACK', type: 'V', nodes: ['pk+', '0'], value: 6.0, rInternal: 0.6, partId: 'pack' },
      { id: 'SW1', type: 'SW', nodes: ['pk+', 'sw'], closed: true, rating: { maxI: 0.5 }, partId: 'pack' },
      { id: 'P_T', type: 'PROBE', nodes: ['sw', 'a'], partId: 'm1' },
      { id: 'R1', type: 'R', nodes: ['a', 'b'], value: 1000, rating: R_RATING, partId: 'r1' },
      { id: 'P_2', type: 'PROBE', nodes: ['b', 'c2'] },
      { id: 'R2', type: 'R', nodes: ['c2', '0'], value: 2200, rating: R_RATING, partId: 'r2' },
      { id: 'P_3', type: 'PROBE', nodes: ['b', 'c3'] },
      { id: 'R3', type: 'R', nodes: ['c3', '0'], value: 3300, rating: R_RATING, partId: 'r3' },
    ],
  },
  powerElementId: 'SW1',
  powerLabel: 'Connect battery',

  readouts: [
    { label: 'TOTAL I', source: { kind: 'current', elementId: 'P_T' }, unit: 'A' },
    { label: 'I(R2)', source: { kind: 'current', elementId: 'P_2' }, unit: 'A' },
    { label: 'I(R3)', source: { kind: 'current', elementId: 'P_3' }, unit: 'A' },
    { label: 'JUNCTION V', source: { kind: 'voltage', node: 'b' }, unit: 'V' },
  ],

  tweaks: [
    { label: 'R3', elementId: 'R3', key: 'value', min: 100, max: 100000, log: true, unit: 'Ω' },
    { label: 'R1', elementId: 'R1', key: 'value', min: 100, max: 10000, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: {0} leaves the pack, passes R1, then splits into {1} through R2 and {2} through R3. The junction sits at {3}.' },
    { when: { kind: 'above', readout: 0, value: 0.004 }, text: 'R1 is small now: the parallel pair takes most of the 6 V ({3} at the junction), and {0} flows in total.' },
    { when: { kind: 'above', readout: 2, value: 0.0025 }, text: 'WARNING: R3 is the low-value branch and takes {2} of the {0}: the junction has collapsed to {3}, so R2 barely conducts.' },
  ],

  failures: [
    {
      id: 'r3-open',
      label: 'R3 goes open (lead breaks off)',
      explain:
        'With one branch gone only R1 + R2 = 3.2 kΩ remain: I = 6/3200 = 1.87 mA. The junction rises to 4.12 V, because R2 now has no help sharing the load and so takes a bigger slice of the 6 V. I(R3) is zero.',
      patches: [{ op: 'remove', elementId: 'R3' }],
      parts: { hide: ['r3'] },
    },
    {
      id: 'bridge',
      label: 'Solder bridge shorts the parallel pair',
      explain:
        'A short is a zero-ohm branch in parallel, so the parallel combination becomes 0 Ω and R1 alone sets the current: 6 V / 1 kΩ = 6 mA, and the junction falls to 0 V. R2 and R3 carry nothing. R1 dissipates 36 mW, safe in a 1/4 W part, but a short across a stiffer supply would not be so kind.',
      patches: [{ op: 'short', a: 'b', b: '0' }],
      parts: { show: ['bridge'] },
    },
    {
      id: 'shunt-100',
      label: 'Someone adds a 100 Ω resistor across R2',
      explain:
        '100 Ω ∥ 2.2 kΩ ∥ 3.3 kΩ ≈ 93 Ω: a parallel combination is always smaller than its smallest member. Total current jumps to about 5.5 mA, but the junction drops to about 0.51 V, so R2 and R3 currents fall roughly seven-fold. The fat bypass steals nearly all the current.',
      patches: [{ op: 'add', element: { id: 'R_X', type: 'R', nodes: ['b', '0'], value: 100, rating: R_RATING } }],
      parts: { show: ['rx'] },
    },
  ],

  meet: `**Series:** one current flows through every part, and the voltages add. R_series = R₁ + R₂ + …

**Parallel:** every branch sees the same voltage, and the currents add. Conductances (1/R) add: 1/R_par = 1/R₂ + 1/R₃. For two resistors, R_par = R₂·R₃ / (R₂ + R₃).

**Worked on this board:**

- R2 ∥ R3 = (2200 × 3300) / 5500 = **1320 Ω**
- Total = 1000 + 1320 = **2320 Ω** (the pack's 0.6 Ω barely matters)
- I = 6 / 2320 = **2.59 mA**
- Voltage across R1 = 2.59 mA × 1 kΩ = 2.59 V, which leaves V_b = 6 − 2.59 = **3.41 V**

Now split the current. Each branch gets I_branch = V_b / R_branch:

- I₂ = 3.41 / 2200 = **1.55 mA**
- I₃ = 3.41 / 3300 = **1.03 mA**

Check: 1.55 + 1.03 = 2.58 mA ✓ (it matches the 2.59 mA total up to rounding).

The current-divider shortcut gives the same answer: I₂ = I·R₃/(R₂ + R₃) = 2.59 × 3.3/5.5 = 1.55 mA. The *larger* resistor takes the *smaller* share.

**Method.** Real networks are just these two moves repeated: find the innermost series or parallel group, replace it with its equivalent, and repeat until one resistor is left. Then work back outward, using I = V/R at each step to recover the individual voltages and currents.

**Try it.** Drag R3 up to 100 kΩ and the network behaves as R1 + R2. Drag it down to 100 Ω and it swallows the current while JUNCTION V collapses.`,

  mechanicalAnalogy: `Picture pipes. Pipes in series carry the same flow, and their pressure drops add. Pipes in parallel share the same pressure drop, and their flows add. A fat bypass pipe in parallel steals most of the flow, just as the 100 Ω resistor does in the third failure.

**Where it breaks:** a real pipe tee has junction losses, and the flow split depends on Reynolds number. An electrical node is lossless and perfectly linear, so the split is fixed by the resistances alone.`,

  proTips: [
    'Sanity-check every parallel result: it must be below the smallest resistor. Two equal resistors in parallel give exactly half.',
    'Parallel resistors share power. Two 200 Ω, 1/4 W parts in parallel make a 100 Ω, 1/2 W resistor, which is handy when the drawer lacks the right part.',
    "Series resistors share voltage. High-voltage dividers use several resistors in series to stay inside each part's maximum working voltage.",
  ],

  quiz: [
    {
      q: 'What is 4.7 kΩ ∥ 4.7 kΩ?',
      options: ['9.4 kΩ', '4.7 kΩ', '2.35 kΩ', '1.18 kΩ'],
      answer: 2,
      why: 'Two equal resistors in parallel give half: 2.35 kΩ.',
    },
    {
      q: '100 Ω, 220 Ω and 330 Ω in series on 9 V. What is the current?',
      options: ['13.8 mA', '27.3 mA', '41.0 mA', '90.0 mA'],
      answer: 0,
      why: 'R = 650 Ω, so I = 9/650 = 13.8 mA.',
    },
    {
      q: 'You add a resistor in parallel with an existing one. The total resistance…',
      options: ['always rises', 'always falls', 'stays the same', 'depends on the supply voltage'],
      answer: 1,
      why: 'Adding a branch adds conductance, so the total resistance must fall.',
    },
    {
      q: '10 mA enters a 1 kΩ ∥ 3 kΩ pair. How much goes through the 1 kΩ?',
      options: ['2.5 mA', '3.3 mA', '5.0 mA', '7.5 mA'],
      answer: 3,
      why: 'I₁ = I·R₂/(R₁ + R₂) = 10 × 3/4 = 7.5 mA. The smaller resistor takes the larger share.',
    },
  ],
}
