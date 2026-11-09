// T1 · Resistor Codes and Dividers. Source: docs/curriculum/T1/resistor-codes-divider.md
//
// A 9 V battery behind a slide switch feeds a 10 kΩ / 4.7 kΩ divider on the breadboard; a voltmeter
// reads the middle node. A second switch hangs a load resistor on that node. The 3D resistors draw
// their colour bands from params.ohms, and Board.tsx feeds each part's live `<id>.value` back in, so
// dragging the R2 or LOAD slider repaints the bands.
//
// Breadboard columns (rows a-e of a column share a strip):
//   col 4  = battery +  (wire on row a, SW1 on row c)
//   col 6  = "top"      (SW1 out, R1 left on row e)
//   col 10 = "out"      (R1 right on row e, R2 top on row b, tap wire on row d)
//   col 14 = ground     (R2 bottom on row b, wire to the − rail on row a)
//   col 17 = "out" again (load tap wire on row a, meter wire on row b, SW_LOAD left on row c)
//   col 19 = "ld"       (SW_LOAD right on row c, R_LOAD left on row d)
//   col 23 = ground     (R_LOAD right on row d, wire to the − rail on row a)
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

const BB: [number, number] = [0.6, 1.0]
const BAT_AT: [number, number] = [-1.8, -3.9]
const DMM_AT: [number, number] = [3.4, -3.9]
const DMM_SCALE = 0.45

// the battery and the meter sit side by side behind the breadboard; (+) is the round snap, (−) the hex one
const snapY = BENCH_Y + 0.9
const batPlus: [number, number, number] = [BAT_AT[0] - 2.65, snapY, BAT_AT[1] - 0.5]
const batMinus: [number, number, number] = [BAT_AT[0] - 2.65, snapY, BAT_AT[1] + 0.5]
const jackY = BENCH_Y + (1.5 + 0.19) * DMM_SCALE
const jackV: [number, number, number] = [DMM_AT[0] - 2.0 * DMM_SCALE, jackY, DMM_AT[1] + 5.5 * DMM_SCALE]
const jackCom: [number, number, number] = [DMM_AT[0], jackY, DMM_AT[1] + 5.5 * DMM_SCALE]

const swIn = bbHole(BB, 4, 'c')
const swOut = bbHole(BB, 6, 'c')
const r1L = bbHole(BB, 6, 'e')
const r1R = bbHole(BB, 10, 'e')
const r2T = bbHole(BB, 10, 'b')
const r2B = bbHole(BB, 14, 'b')
const lsL = bbHole(BB, 17, 'c')
const lsR = bbHole(BB, 19, 'c')
const ldL = bbHole(BB, 19, 'd')
const ldR = bbHole(BB, 23, 'd')

const wPlus = jumper(batPlus, bbHole(BB, 4, 'a'), 'red', 0.5)
const wMinus = jumper(batMinus, bbHole(BB, 2, '-t'), 'black', 0.5)
const wGnd1 = jumper(bbHole(BB, 14, 'a'), bbHole(BB, 14, '-t'), 'black', 0.15)
const wGnd2 = jumper(bbHole(BB, 23, 'a'), bbHole(BB, 23, '-t'), 'black', 0.15)
const wTap = jumper(bbHole(BB, 10, 'd'), bbHole(BB, 17, 'a'), 'yellow', 0.45)
const wMeter = jumper(jackV, bbHole(BB, 17, 'b'), 'orange', 0.5)
const wCom = jumper(jackCom, bbHole(BB, 26, '-t'), 'black', 0.4)

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

/** 1/4 W, ±5 % carbon-film parts */
const R_RATING = { maxP: 0.25, maxV: 250 }

export const lesson: LessonDef = {
  id: 'resistor-codes-divider',
  track: 'T1',
  title: 'Resistor Codes and Dividers',
  subtitle: 'From bands to volts',
  tagline: 'Yellow-violet-red under brown-black-orange means 4.7 kΩ under 10 kΩ, which turns 9 V into 2.88 V.',

  board: {
    name: 'DIV-09',
    size: [14, 8],
    frame: { size: [6.6, 3.9], center: [0.9, -0.9] }, // tight on the resistors so the bands read; the battery and meter sit at the edge
    base: 'breadboard-only',
    parts: [
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the divider; each 5-hole strip is one electrical node.' },
      {
        id: 'bat',
        kind: 'battery-9v',
        pos: [BAT_AT[0], BENCH_Y, BAT_AT[1]],
        mount: 'offboard',
        label: 'BATTERY',
        role: 'Alkaline PP3: 9 V nominal, about 1.5 Ω inside.',
        params: { callout: [0, 2.0, 0] },
        circuitIds: ['V_BAT'],
      },
      {
        id: 'sw',
        kind: 'switch-slide',
        pos: between(swIn, swOut),
        mount: 'tht',
        label: 'SWITCH',
        role: 'Connects the battery. It is the Connect battery button.',
        params: { callout: [-0.4, 1.9, -0.9] },
        circuitIds: ['SW1'],
      },
      {
        id: 'r1',
        kind: 'resistor',
        pos: between(r1L, r1R),
        mount: 'tht',
        role: 'R1, the upper leg: 10 kΩ, ±5 %, 1/4 W (brown-black-orange-gold).',
        params: { ohms: 10000 },
        circuitIds: ['R1'],
      },
      {
        id: 'r2',
        kind: 'resistor',
        pos: between(r2T, r2B),
        mount: 'tht',
        role: 'R2, the lower leg: 4.7 kΩ, ±5 %, 1/4 W (yellow-violet-red-gold). The output is taken across it. Its bands repaint as you slide R2.',
        params: { ohms: 4700 },
        circuitIds: ['R2'],
      },
      {
        id: 'lsw',
        kind: 'switch-slide',
        pos: between(lsL, lsR),
        mount: 'tht',
        label: 'ATTACH',
        role: 'Connects the load to the output (the Load attached toggle).',
        params: { callout: [0.2, 1.9, 1.6] },
        circuitIds: ['SW_LOAD'],
      },
      {
        id: 'ld',
        kind: 'resistor',
        pos: between(ldL, ldR),
        mount: 'tht',
        label: 'LOAD',
        role: 'R_LOAD, 100 kΩ (brown-black-yellow-gold): a stand-in for whatever reads the output, such as an ADC pin or a sensor input.',
        params: { ohms: 100000, callout: [1.2, 0.8, 2.4] },
        circuitIds: ['R_LOAD'],
      },
      {
        id: 'dmm',
        kind: 'multimeter',
        pos: [DMM_AT[0], BENCH_Y, DMM_AT[1]],
        mount: 'offboard',
        label: 'METER',
        role: 'Voltmeter on the output node: reads V OUT.',
        params: { scale: DMM_SCALE, readout: 0, unit: 'V', autoUnit: true, title: 'VOLTMETER', callout: [-0.6, 1.2, 1.8] },
      },
      { id: 'w-plus', kind: 'wire', ...wPlus, mount: 'offboard', role: 'Battery + to the switch.' },
      { id: 'w-minus', kind: 'wire', ...wMinus, mount: 'offboard', role: 'Battery − to the ground rail.' },
      { id: 'w-gnd1', kind: 'wire', ...wGnd1, mount: 'offboard', role: 'Bottom of R2 to the ground rail.' },
      { id: 'w-gnd2', kind: 'wire', ...wGnd2, mount: 'offboard', role: 'Bottom of the load to the ground rail.' },
      { id: 'w-tap', kind: 'wire', ...wTap, mount: 'offboard', role: 'Output node to the load switch.' },
      { id: 'w-meter', kind: 'wire', ...withCallout(wMeter, [0, 0.6, 0.2]), mount: 'offboard', label: 'V OUT', role: 'Voltmeter + lead to the output node.' },
      { id: 'w-com', kind: 'wire', ...wCom, mount: 'offboard', role: 'Voltmeter COM lead to the ground rail.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_BAT', type: 'V', nodes: ['b', '0'], value: 9.0, rInternal: 1.5, partId: 'bat' },
      // `closed: true`: the bench opens the power element until "Connect battery"
      { id: 'SW1', type: 'SW', nodes: ['b', 'top'], closed: true, rating: { maxI: 0.5 }, partId: 'sw' },
      { id: 'R1', type: 'R', nodes: ['top', 'out'], value: 10000, rating: R_RATING, partId: 'r1' },
      { id: 'R2', type: 'R', nodes: ['out', '0'], value: 4700, rating: R_RATING, partId: 'r2' },
      { id: 'SW_LOAD', type: 'SW', nodes: ['out', 'ld'], closed: false, partId: 'lsw' },
      { id: 'R_LOAD', type: 'R', nodes: ['ld', '0'], value: 100000, rating: R_RATING, partId: 'ld' },
    ],
  },
  powerElementId: 'SW1',
  powerLabel: 'Connect battery',

  readouts: [
    { label: 'V OUT', source: { kind: 'voltage', node: 'out' }, unit: 'V' },
    { label: 'DIVIDER I', source: { kind: 'current', elementId: 'R1' }, unit: 'A' },
    { label: 'LOAD I', source: { kind: 'current', elementId: 'R_LOAD' }, unit: 'A', floor: 1e-7 },
  ],

  tweaks: [
    { label: 'Bottom resistor R2', elementId: 'R2', key: 'value', min: 1000, max: 47000, log: true, unit: 'Ω' },
    { label: 'Load resistance', elementId: 'R_LOAD', key: 'value', min: 1000, max: 1000000, log: true, unit: 'Ω' },
    { label: 'Load attached', elementId: 'SW_LOAD', key: 'closed', kind: 'toggle', min: 0, max: 1, step: 1, unit: '' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: {1} flows through both legs and V OUT sits at {0}, the fraction R2/(R1 + R2) of the 9 V' },
    { when: { kind: 'above', readout: 2, value: 0.00002 }, text: 'LOADED: the load takes {2} out of the divider, so V OUT sags to {0}. Keep the load 10 to 100 times the 3.2 kΩ Thévenin resistance.' },
    { when: { kind: 'above', readout: 2, value: 0.0003 }, text: 'COLLAPSED: the load is a short on a weak source: it pulls {2}, and V OUT falls to {0}.' },
  ],

  failures: [
    {
      id: 'heavy-load',
      label: 'Hang a 1 kΩ sensor input on the output',
      explain:
        'Seen from the output the divider is a 2.88 V source behind R1 ∥ R2 = 3.2 kΩ. A 1 kΩ load is far below that, so 4.7 kΩ ∥ 1 kΩ = 825 Ω and V = 9 × 825/(10 000 + 825) = 0.69 V. The load, not the divider ratio, now sets the output.',
      patches: [
        { op: 'set', elementId: 'SW_LOAD', key: 'closed', value: true },
        { op: 'set', elementId: 'R_LOAD', key: 'value', value: 1000 },
      ],
    },
    {
      id: 'r2-open',
      label: 'Bottom resistor drops out',
      explain:
        'With no lower leg, no current can flow through R1, so it drops nothing and V OUT floats up to the full 9 V (unloaded). A 3.3 V ADC wired here would see 9 V, far past its absolute maximum.',
      patches: [{ op: 'remove', elementId: 'R2' }],
      parts: { hide: ['r2'] },
    },
    {
      id: 'misread-band',
      label: 'Misread band: yellow-violet-orange (47 kΩ) fitted',
      explain:
        'Orange as the multiplier means ×1000, so the part is 47 kΩ, not 4.7 kΩ: with no load attached, V = 9 × 47/57 = 7.42 V instead of 2.88 V. One band is a factor of ten. Measure a part before you fit it.',
      patches: [
        { op: 'set', elementId: 'SW_LOAD', key: 'closed', value: false },
        { op: 'set', elementId: 'R2', key: 'value', value: 47000 },
      ],
    },
  ],

  meet: `**Colour code.** The first two bands (three on 1 % parts) are digits: black 0, brown 1, red 2, orange 3, yellow 4, green 5, blue 6, violet 7, grey 8, white 9. The next band is the power-of-ten multiplier, and the last, set slightly apart, is tolerance (gold ±5 %, brown ±1 %). Slide the R2 control and watch its bands repaint, then drag the load resistance down with the load attached and feel V OUT sag.

- Brown-black-orange = 1, 0, ×10³ = **10 kΩ**.
- Yellow-violet-red = 4, 7, ×10² = **4.7 kΩ**.

Standard values come from the E-series: E12 has 12 values per decade (1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2) for ±10 % parts, and E24 has 24 (adding 1.1, 1.3, 1.6, 2.0, 2.4, 3.0, 3.6, 4.3, 5.1, 6.2, 7.5, 9.1) for ±5 % parts.

**Divider.** One current flows through both legs, so

V_out = V_in · R2 / (R1 + R2) = 9 × 4.7 / 14.7 = **2.88 V**, with I = 9 / 14.7 kΩ = **0.61 mA**.

**Loading.** Seen from the output, the divider is a 2.88 V source behind R1 ∥ R2 = 10k·4.7k/14.7k = **3.20 kΩ**. Attach 100 kΩ and V_out = 2.88 × 100/(100 + 3.2) = **2.79 V** (−3 %). Keep the load at least 10 to 100 times the Thévenin resistance.

**Tolerance.** In the worst case, R1 is +5 % and R2 is −5 %: 9 × 4.465/(10.5 + 4.465) = **2.69 V**. The opposite corner gives 9 × 4.935/(9.5 + 4.935) = **3.08 V**. Two ±5 % parts give roughly ±7 % here. Use 1 % parts when the voltage matters.`,

  mechanicalAnalogy: `A divider is like two orifices in series between a supply and a drain: the pressure between them sits at a fixed fraction of the supply, set by the ratio of their resistances. Tapping flow off that middle point (loading) drags the pressure down, just as the 1 kΩ load did.

**Where it breaks:** real orifices are nonlinear (Δp ∝ Q²), so the hydraulic "ratio" shifts with flow. An electrical divider stays perfectly linear, so its loaded output can be calculated exactly.`,

  proTips: [
    'Never use a divider as a power supply. Its output impedance makes the voltage depend on whatever you connect. Use a regulator.',
    "For ADC inputs, keep the source resistance within the converter's recommendation. The ATmega328P datasheet asks for about 10 kΩ or less. Otherwise add a capacitor (e.g. 100 nF) at the pin.",
    'Bands fade and confuse (red and orange, brown and red under warm light). Use the meter on every resistor before it goes in. It takes two seconds.',
  ],

  guide: [
    {
      id: 'read-the-bands',
      title: 'Read the bottom resistor',
      body: 'Click **R2** to open its inspector. **Yellow-violet-red** is 47 × 100 = **4.7 kΩ**.',
      check: { kind: 'inspect', part: 'r2' },
      focus: { part: 'r2' },
      hint: 'The lower of the two divider resistors, with a gold tolerance band set apart from the rest.',
      explain: 'Yellow (4), violet (7), red (×100): 47 × 100 = 4700 Ω. The first two bands are digits and the third is the power of ten, so one band is a factor of ten.',
    },
    {
      id: 'connect',
      title: 'Connect the battery',
      body: 'Press **Connect battery**. **V OUT** reads about **2.88 V**: 9 V × 4.7 / (10 + 4.7).',
      check: { kind: 'all', of: [{ kind: 'status', is: 'POWERED' }, { kind: 'readout', index: 0, above: 2.75, below: 3.0, holdMs: 300 }] },
      focus: { control: 'power' },
      explain: 'Vout = Vin × R2 / (R1 + R2) = 9 × 4700 / 14 700 = 2.88 V, with 0.61 mA through both legs. The output is the fraction of the supply that falls across the bottom resistor.',
    },
    {
      id: 'bigger-bottom',
      title: 'Make R2 bigger',
      body: 'Slide **Bottom resistor R2** to about **10 kΩ**. Its bands repaint and **V OUT** rises to **4.5 V**: half the supply.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Bottom resistor R2', min: 9000, max: 11000 },
          { kind: 'readout', index: 0, above: 4.3, below: 4.7, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Bottom resistor R2' },
      explain: 'Equal resistors divide equally: 10 k over 10 k is exactly half. A larger share of the resistance gets a larger share of the voltage.',
    },
    {
      id: 'attach-load',
      title: 'Hang a 10 kΩ load on it',
      body: 'Turn **Load attached** on and slide **Load resistance** to about **10 kΩ**. **V OUT** sags from 4.5 V to about **3 V**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Load attached', min: 1 },
          { kind: 'tweak', target: 'Load resistance', min: 8000, max: 12500 },
          { kind: 'readout', index: 0, above: 2.7, below: 3.3, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Load attached' },
      hint: 'Two controls: the Load attached switch first, then the Load resistance slider.',
      explain: 'The load sits in parallel with R2: 10 k ∥ 10 k = 5 k, so Vout = 9 × 5 / 15 = 3 V. A divider only gives its ratio when the load is 10 to 100 times larger than R2.',
    },
    {
      id: 'heavy-load',
      title: 'Break it: a heavy load',
      body: 'Open **Break something** and choose **Hang a 1 kΩ sensor input on the output**. **V OUT** collapses to under **1 V**.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'heavy-load' }, { kind: 'readout', index: 0, below: 1.0, holdMs: 300 }] },
      focus: { control: 'break' },
      explain: 'Now 10 k ∥ 1 k = 0.91 kΩ is the bottom of the divider, so Vout = 9 × 0.91 / (10 + 0.91) = 0.75 V. The load, not the colour bands, sets the output.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**. **V OUT** returns to about 3 V.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'repair' }, { kind: 'readout', index: 0, above: 2.5, holdMs: 300 }] },
      focus: { control: 'break' },
    },
    {
      id: 'misread-band',
      title: 'Break it: misread a band',
      body: 'Choose **Misread band**. A **47 kΩ** part is fitted in place of 4.7 kΩ, and **V OUT** jumps to **7.4 V**.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'misread-band' }, { kind: 'readout', index: 0, above: 7.0, holdMs: 300 }] },
      focus: { control: 'break' },
      explain: 'Orange as the multiplier is ×1000, so 47 kΩ. With no load, V = 9 × 47 / 57 = 7.42 V instead of 2.88 V. A 3.3 V input would see more than double its limit. Measure a part before you fit it.',
    },
    {
      id: 'repair-again',
      title: 'Repair again',
      body: 'Choose **Repair all** to fit the right resistor.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'repair' }, { kind: 'readout', index: 0, below: 4, holdMs: 300 }] },
      focus: { control: 'break' },
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: colour bands and the divider formula.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  quiz: [
    {
      q: 'What is a resistor banded red-red-brown-gold?',
      options: ['22 Ω ±5 %', '2.2 kΩ ±5 %', '221 Ω ±1 %', '220 Ω ±5 %'],
      answer: 3,
      why: '2, 2, ×10¹ = 220 Ω; gold means ±5 %.',
    },
    {
      q: 'A divider has R1 = 20 kΩ (top) and R2 = 10 kΩ (bottom) on 12 V. What is V_out?',
      options: ['4 V', '6 V', '8 V', '3 V'],
      answer: 0,
      why: '12 × 10/(20 + 10) = 4 V.',
    },
    {
      q: 'What is the Thévenin (output) resistance of a 10 kΩ / 10 kΩ divider?',
      options: ['20 kΩ', '10 kΩ', '5 kΩ', '2.5 kΩ'],
      answer: 2,
      why: 'R1 ∥ R2 = 10k·10k/20k = 5 kΩ.',
    },
    {
      q: 'You need about 3.3 V from 5 V with R1 = 1.8 kΩ on top. Which of these standard R2 values is closest?',
      options: ['1.0 kΩ', '3.3 kΩ', '2.2 kΩ', '6.8 kΩ'],
      answer: 1,
      why: 'R2 = 3.3 × 1.8/(5 − 3.3) = 3.49 kΩ. 3.3 kΩ gives 5 × 3.3/5.1 = 3.24 V (E24 also has 3.6 kΩ, which gives 3.33 V).',
    },
  ],
}
