// T0 · Batteries. Source: docs/curriculum/T0/batteries.md
//
// No behavior is needed: a battery is an ideal EMF (V_EMF) in series with an internal resistance
// (R_INT), both drawn as the one PP3 part. The slide switch SW1 connects a power resistor; the
// multimeter reads the terminal voltage, the only point you can actually reach.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

const BB: [number, number] = [1.2, 0.9]
const BAT_AT: [number, number] = [-5.0, -1.2]
const METER_AT: [number, number] = [-5.2, 2.2]
const METER_SCALE = 0.3

const swPos = bbHole(BB, 8, 'f')
const rlLeft = bbHole(BB, 15, 'f')
const rlRight = bbHole(BB, 19, 'f')

/** the PP3's snaps, facing the breadboard (battery turned 180°): round (+) and hex (−) */
const snapPlus: [number, number, number] = [BAT_AT[0] + 2.55, BENCH_Y + 0.88, BAT_AT[1] + 0.5]
const snapMinus: [number, number, number] = [BAT_AT[0] + 2.55, BENCH_Y + 0.88, BAT_AT[1] - 0.5]

const wBatPlus = jumper(snapPlus, bbHole(BB, 5, 'j'), 'red', 0.5)
const wBatMinus = jumper(snapMinus, bbHole(BB, 3, '-b'), 'black', 0.5)
const wSwToLoad = jumper(bbHole(BB, 8, 'j'), bbHole(BB, 15, 'j'), 'orange', 0.35)
const wLoadGnd = jumper(bbHole(BB, 19, 'j'), bbHole(BB, 21, '-b'), 'black', 0.25)

/** R_LOAD: a 100 Ω, 10 W cement/wirewound power resistor */
const LOAD_RATING = { maxP: 10, maxV: 500 }

export const lesson: LessonDef = {
  id: 'batteries',
  track: 'T0',
  title: 'Batteries',
  subtitle: 'Real sources sag',
  tagline: 'A fresh 9 V battery with about 1.5 Ω inside sags to 7.8 V when a 10 Ω load asks it for 0.78 A.',

  board: {
    name: 'CELL-06',
    size: [14, 8.6],
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
        kind: 'resistor',
        pos: between(rlLeft, rlRight),
        mount: 'tht',
        label: 'LOAD',
        role: 'The test load: 100 Ω, 10 W power resistor. Slide the load resistance down to ask the battery for more current.',
        params: { ohms: 100, callout: [0.2, 2.1, -0.4] },
        circuitIds: ['R_LOAD'],
      },
      {
        id: 'amm',
        kind: 'testpoint',
        pos: bbHole(BB, 11, 'f'),
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
        'The load power peaks when R_load = r: P = (9/3)² × 1.5 = 13.5 W, with 3 A flowing and 4.5 V at the terminals. But the battery wastes the same 13.5 W internally (50 % efficiency), and the load is over its 10 W rating, so it burns.',
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

**Chemistry cheat sheet.** Alkaline is 1.5 V per cell, not rechargeable. NiMH is 1.2 V and rechargeable. A Li-ion/LiPo cell is 3.7 V nominal, 4.2 V full, and shouldn't go below about 3.0 V.`,

  mechanicalAnalogy: `A battery is like a pump feeding through a narrow internal passage. At zero flow the outlet shows the full pump pressure. As flow rises, the passage drops pressure in proportion, so the delivered pressure sags along a straight line. The slope of that line is the internal resistance.

**Where it breaks:** a battery's "passage" changes with temperature, state of charge and age, and its chemistry recovers partly after a rest. Its voltage also slides as it discharges, unlike a pump with a constant head.`,

  proTips: [
    'Always test a battery under a representative load. Open-circuit voltage says almost nothing about remaining capacity or internal resistance.',
    'Put a fuse right at the battery terminal of anything you build, above all with Li-ion/LiPo packs, which can deliver tens of amps into a fault.',
    'For high-drain loads (motors, servos), choose NiMH or Li-ion over alkaline. Their much lower internal resistance means less sag and less wasted heat.',
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
