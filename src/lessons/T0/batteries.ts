// T0 · Batteries. Source: docs/curriculum/T0/batteries.md
//
// No behavior is needed: a battery is an ideal EMF (V_EMF) in series with an internal resistance
// (R_INT), both drawn as the one PP3 part. The slide switch SW1 connects a power resistor; the
// multimeter reads the terminal voltage, the only point you can actually reach.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, jumper } from '../layout'

const BB: [number, number] = [0.6, 1.0]
const BAT_AT: [number, number] = [-3.9, -2.3]
const METER_AT: [number, number] = [-4.4, 2.5]
const LOAD_AT: [number, number] = [5.6, -1.0]
const METER_SCALE = 0.3

const swPos = bbHole(BB, 8, 'e')

/** the PP3's snaps, facing the breadboard (battery turned 180°): round (+) and hex (−) */
const snapPlus: [number, number, number] = [BAT_AT[0] + 2.55, BENCH_Y + 0.88, BAT_AT[1] + 0.5]
const snapMinus: [number, number, number] = [BAT_AT[0] + 2.55, BENCH_Y + 0.88, BAT_AT[1] - 0.5]

const wBatPlus = jumper(snapPlus, bbHole(BB, 5, 'a'), 'red', 0.5)
const wBatMinus = jumper(snapMinus, bbHole(BB, 3, '-t'), 'black', 0.5)
/** the load's two ends: terminals along the module's front edge */
const loadEnd = (x: number): [number, number, number] => [LOAD_AT[0] + x, BENCH_Y + 0.4, LOAD_AT[1] + 0.8]
const wSwToLoad = jumper(bbHole(BB, 8, 'a'), loadEnd(-1.2), 'orange', 0.5)
const wLoadGnd = jumper(loadEnd(1.2), bbHole(BB, 24, '-t'), 'black', 0.5)

/** R_LOAD: a 100 Ω, 10 W cement/wirewound power resistor */
/** thermal numbers are illustrative: 10 W at 70 C ambient, a ceramic body that cooks past 13 W within a few seconds */
const LOAD_RATING = { maxP: 10, maxV: 500, rth: 15, tauTh: 6, tMax: 150 }

export const lesson: LessonDef = {
  id: 'batteries',
  track: 'T0',
  title: 'Batteries',
  subtitle: 'Real sources sag',
  tagline: 'A fresh 9 V battery with about 1.5 Ω inside sags to 7.8 V when a 10 Ω load asks it for 0.78 A.',

  board: {
    name: 'CELL-06',
    size: [14, 8.6],
    frame: { size: [12, 7.6], center: [0.8, -1.5] },
    base: 'breadboard-only',
    parts: [
      {
        id: 'bat',
        kind: 'battery-9v',
        pos: [BAT_AT[0], BENCH_Y, BAT_AT[1]],
        rot: 180,
        mount: 'offboard',
        label: 'PP3',
        role: 'The source under test: a 9 V alkaline PP3 is a 9 V EMF with about 1.5 Ω of internal resistance hidden inside it.',
        params: { callout: [0, 2.2, 0.2] },
        circuitIds: ['V_EMF', 'R_INT'],
      },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the switch and the load.' },
      {
        id: 'sw',
        kind: 'switch-slide',
        pos: swPos,
        mount: 'tht',
        label: 'SWITCH',
        role: 'Connects the load. Closed, the battery has to deliver current.',
        params: { callout: [0, 1.4, -0.5] },
        circuitIds: ['SW1'],
      },
      {
        id: 'rl',
        kind: 'module',
        pos: [LOAD_AT[0], BENCH_Y, LOAD_AT[1]],
        mount: 'offboard',
        label: 'LOAD',
        role: 'The test load: 100 Ω, 10 W power resistor. Slide the load resistance down to ask the battery for more current.',
        params: { title: '100R 10W', color: '#d9cfae', w: 3.2, d: 1.5, pins: 0, chip: 'none', callout: [0, 1.4, -0.4] },
        circuitIds: ['R_LOAD'],
      },
      {
        id: 'amm',
        kind: 'testpoint',
        pos: bbHole(BB, 11, 'e'),
        mount: 'tht',
        label: 'AMMETER',
        role: 'Series current-sense point: the CURRENT reading is the current through here.',
        params: { color: 'yellow', callout: [0, 1.3, 0.6] },
        circuitIds: ['P_I'],
      },
      {
        id: 'meter',
        kind: 'multimeter',
        pos: [METER_AT[0], BENCH_Y, METER_AT[1]],
        mount: 'offboard',
        label: 'METER',
        role: 'Volts across the battery terminals: the only voltage you can actually measure, and it sags under load.',
        params: { unit: 'V', mode: 'V', readout: 0, scale: METER_SCALE, title: 'VOLTMETER', callout: [0, 1.6, 0] },
      },
      { id: 'w-plus', kind: 'wire', ...wBatPlus, mount: 'offboard', role: 'Battery + to the switch.' },
      { id: 'w-minus', kind: 'wire', ...wBatMinus, mount: 'offboard', role: 'Battery − to the ground rail.' },
      { id: 'w-load', kind: 'wire', ...wSwToLoad, mount: 'offboard', role: 'Switch to the load.' },
      { id: 'w-gnd', kind: 'wire', ...wLoadGnd, mount: 'offboard', role: 'Load to the ground rail.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_EMF', type: 'V', nodes: ['emf', '0'], value: 9, rInternal: 0, partId: 'bat' },
      { id: 'R_INT', type: 'R', nodes: ['emf', 'term'], value: 1.5, partId: 'bat' },
      { id: 'SW1', type: 'SW', nodes: ['term', 'sw'], closed: true, rating: { maxI: 5 }, partId: 'sw' },
      { id: 'P_I', type: 'PROBE', nodes: ['sw', 'load'], partId: 'amm' },
      { id: 'R_LOAD', type: 'R', nodes: ['load', '0'], value: 100, rating: LOAD_RATING, partId: 'rl' },
    ],
  },
  powerElementId: 'SW1',
  powerLabel: 'Connect load',

  readouts: [
    { label: 'TERMINAL V', source: { kind: 'voltage', node: 'term' }, unit: 'V' },
    { label: 'CURRENT', source: { kind: 'current', elementId: 'P_I' }, unit: 'A' },
    { label: 'LOAD POWER', source: { kind: 'power', elementId: 'R_LOAD' }, unit: 'W' },
    { label: 'INTERNAL LOSS', source: { kind: 'power', elementId: 'R_INT' }, unit: 'W', warnAbove: 5 },
    { label: 'LOAD TEMP', source: { kind: 'extra', key: 'R_LOAD.tj' }, unit: '°C', digits: 3, warnAbove: 100 },
  ],

  tweaks: [
    { label: 'Load resistance', elementId: 'R_LOAD', key: 'value', min: 1, max: 1000, log: true, unit: 'Ω' },
    { label: 'Internal resistance (age)', elementId: 'R_INT', key: 'value', min: 1, max: 20, step: 0.5, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: the battery pushes {1} through its own 1.5 Ω, so the terminal reads {0}, not 9 V' },
    { when: { kind: 'above', readout: 3, value: 0.5 }, text: 'LOAD IS HEAVY: the battery wastes {3} inside itself while the load gets {2}' },
    { when: { kind: 'above', readout: 3, value: 5 }, text: 'WARNING: {3} dissipated inside the battery, with almost nothing left for a load. A real PP3 heats fast and can rupture.' },
  ],

  failures: [
    {
      id: 'short',
      label: 'Keys in the pocket (terminals shorted)',
      explain:
        'Only the internal resistance limits the current: 9 / 1.5 = 6 A, and the terminal voltage collapses to about 0 V. All of the power, 9 × 6 = 54 W, is dumped inside the battery. A real PP3 heats fast and can rupture. That is why 9 V batteries ship with terminal caps.',
      patches: [{ op: 'short', a: 'term', b: '0' }],
    },
    {
      id: 'tired',
      label: 'A tired battery',
      explain:
        'Aging raises the internal resistance far more than it lowers the EMF. With the load disconnected the meter would still read 8.4 V, which looks healthy. Under the 100 Ω load it drops to 7.3 V at 73 mA. Test batteries under load.',
      patches: [
        { op: 'set', elementId: 'V_EMF', key: 'value', value: 8.4 },
        { op: 'set', elementId: 'R_INT', key: 'value', value: 15 },
      ],
    },
    {
      id: 'max-power',
      label: 'Chase maximum power',
      explain:
        'The load power peaks when R_load = r: P = (9/3)² × 1.5 = 13.5 W, with 3 A flowing and 4.5 V at the terminals. But the battery wastes the same 13.5 W internally (50 % efficiency), and the load is over its 10 W rating, so its temperature climbs past 150 °C within a few seconds and it burns open. With no load current left, the meter then shows the full 9.00 V of the open-circuit EMF: a battery that is not delivering anything shows no sag.',
      patches: [{ op: 'set', elementId: 'R_LOAD', key: 'value', value: 1.5 }],
    },
  ],

  meet: `A battery is not a perfect voltage source. Model it as an ideal **EMF** E in series with an **internal resistance** r. The terminal voltage then falls as you draw current:

**V_term = E − I·r**, with I = E / (r + R_load)

With E = 9 V and r = 1.5 Ω:

- R_load = 100 Ω: I = 9 / 101.5 = 88.7 mA, and V_term = 9 − 0.133 = **8.87 V**
- R_load = 10 Ω: I = 9 / 11.5 = 0.783 A, and V_term = 9 − 1.17 = **7.83 V**

The fraction of the energy that reaches the load is η = R_load / (R_load + r): 98.5 % at 100 Ω, but only 50 % when R_load = r, which is also where load power peaks. Good battery designs run far from that point.

**Energy.** A PP3 alkaline holds very roughly 500 to 600 mAh at light drain, so E ≈ 9 V × 0.5 Ah ≈ 4.5 Wh. Four AA alkalines (about 2.5 Ah each at 1.5 V, depending on the brand and the drain) store more than three times that. Capacity shrinks at high currents, because r converts more of the chemistry's energy into heat.

**Chemistry cheat sheet.** Alkaline is 1.5 V per cell, not rechargeable. NiMH is 1.2 V and rechargeable. A Li-ion/LiPo cell is 3.7 V nominal, 4.2 V full, and shouldn't go below about 3.0 V.

**Try it.** Slide the load resistance slowly down through 1.5 Ω and watch LOAD POWER climb, peak at about 13 W, then fall again while INTERNAL LOSS catches up. Park there and LOAD TEMP runs away: the load is over its 10 W rating.`,

  mechanicalAnalogy: `A battery is like a pump feeding through a narrow internal passage. At zero flow the outlet shows the full pump pressure. As flow rises, the passage drops pressure in proportion, so the delivered pressure sags along a straight line. The slope of that line is the internal resistance.

**Where it breaks:** a battery's "passage" changes with temperature, state of charge and age, and its chemistry recovers partly after a rest. Its voltage also slides as it discharges, unlike a pump with a constant head.`,

  proTips: [
    'Always test a battery under a representative load. Open-circuit voltage says almost nothing about remaining capacity or internal resistance.',
    'Put a fuse right at the battery terminal of anything you build, above all with Li-ion/LiPo packs, which can deliver tens of amps into a fault.',
    'For high-drain loads (motors, servos), choose NiMH or Li-ion over alkaline. Their much lower internal resistance means less sag and less wasted heat.',
  ],

  guide: [
    {
      id: 'meet-the-battery',
      title: 'Meet the battery',
      body: 'Click the **9 V battery** to open its inspector. Inside is an ideal **9 V** source in series with **1.5 Ω**.',
      check: { kind: 'inspect', part: 'bat' },
      focus: { part: 'bat' },
      hint: 'The blue battery block on the right of the bench.',
      explain: 'A real battery is an EMF plus an internal resistance r. The EMF is what a meter shows with nothing connected; r is what makes the terminal voltage fall as you draw current.',
    },
    {
      id: 'connect-load',
      title: 'Connect the load',
      body: 'Press **Connect load**. **TERMINAL V** reads about **8.87 V**, not 9 V, with about **89 mA** flowing through the 100 Ω load.',
      check: {
        kind: 'all',
        of: [
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 0, above: 8.8, below: 8.95, holdMs: 300 },
          { kind: 'readout', index: 1, above: 0.085, below: 0.092, holdMs: 300 },
        ],
      },
      focus: { control: 'power' },
      explain: 'I = E / (r + R) = 9 / 101.5 = 88.7 mA, and the terminal voltage is E − I·r = 9 − 0.089 × 1.5 = 8.87 V. The missing 0.13 V was spent inside the battery.',
    },
    {
      id: 'heavier-load',
      title: 'Draw more current',
      body: 'Slide **Load resistance** down to about **10 Ω**. The current rises to about **0.78 A** and **TERMINAL V** sags to about **7.8 V**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Load resistance', max: 12 },
          { kind: 'readout', index: 0, above: 7.5, below: 8.1, holdMs: 300 },
          { kind: 'readout', index: 3, above: 0.7, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Load resistance' },
      hint: 'The slider is logarithmic: 10 Ω is about two-thirds of the way along from the right. Stay above 5 Ω so the load stays cool.',
      explain: 'The terminal voltage is a straight line: V = E − I·r. At 0.78 A the battery wastes 0.78² × 1.5 = 0.91 W inside itself, heat you never get to use (see INTERNAL LOSS).',
    },
    {
      id: 'keys-in-pocket',
      title: 'Break it: short the terminals',
      body: 'Open **Break something** and choose **Keys in the pocket**. **TERMINAL V** collapses to about 0 V and **INTERNAL LOSS** shoots past **50 W**.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'short' }, { kind: 'readout', index: 3, above: 20, holdMs: 300 }] },
      focus: { control: 'break' },
      explain: 'Only the 1.5 Ω inside limits the current: 9 / 1.5 = 6 A, and all of 9 × 6 = 54 W is dumped in the battery. A real PP3 heats fast and can rupture, which is why 9 V batteries ship with a cap over the terminals.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**. **TERMINAL V** climbs back to about 7.8 V.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'repair' }, { kind: 'readout', index: 0, above: 7.2, holdMs: 300 }] },
      focus: { control: 'break' },
    },
    {
      id: 'age-it',
      title: 'Let the battery age',
      body: 'Slide **Internal resistance (age)** up to about **15 Ω**. With the same load, **TERMINAL V** falls to about **3.6 V**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Internal resistance (age)', min: 14 },
          { kind: 'readout', index: 0, above: 3.2, below: 4.0, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Internal resistance (age)' },
      explain: 'A tired battery loses far more in internal resistance than in EMF. Here I = 9 / 25 = 0.36 A and the terminal sits at 9 − 0.36 × 15 = 3.6 V. Unloaded it would still read about 9 V, which is why you test a battery under load.',
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: EMF, internal resistance and what a load does to the terminal voltage.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  quiz: [
    {
      q: 'A battery has E = 9 V and r = 2 Ω and drives a 16 Ω load. What is the terminal voltage?',
      options: ['9.0 V', '7.0 V', '4.5 V', '8.0 V'],
      answer: 3,
      why: 'I = 9/18 = 0.5 A, so V = 9 − 0.5 × 2 = 8.0 V.',
    },
    {
      q: 'A pack reads 4.5 V open-circuit and 4.2 V while delivering 0.3 A. What is its internal resistance?',
      options: ['0.1 Ω', '1.0 Ω', '0.3 Ω', '14 Ω'],
      answer: 1,
      why: 'r = ΔV/I = 0.3/0.3 = 1.0 Ω.',
    },
    {
      q: 'A fresh 1.5 V cell has r = 0.15 Ω. What is its short-circuit current?',
      options: ['0.225 A', '1 A', '10 A', '100 A'],
      answer: 2,
      why: 'I = E/r = 1.5/0.15 = 10 A, enough to heat a wire quickly.',
    },
    {
      q: 'At maximum power transfer (R_load = r), the efficiency is…',
      options: ['50 %', '100 %', '75 %', '25 %'],
      answer: 0,
      why: 'The load and the internal resistance carry the same current and have equal resistance, so they dissipate equal power.',
    },
  ],
}
