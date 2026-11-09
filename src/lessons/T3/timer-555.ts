// T3 · The 555 Timer. Source: docs/curriculum/T3/timer-555.md (see docs/decisions.md for what changed)
//
// An NE555 on a breadboard, powered by a 9 V PP3 (V_BAT, 1.5 Ω inside) through a slide switch (SW1).
// The chip is modelled at the level of its blocks (TI NE555, SLFS022):
//   * the three 5 kΩ resistors R_D1..R_D3 are real elements, so pin 5 (th_ref) sits at 2/3 Vcc and the
//     TRIGGER reference (tr_ref) at 1/3 Vcc, and C_CTL decouples pin 5;
//   * R_Q is the quiescent current (1.5 kΩ = 6 mA at 9 V, between the datasheet typicals of 3 mA at 5 V and
//     10 mA at 15 V);
//   * the `ne555` behavior is the two comparators and the SR latch. It reads the THRESHOLD (thr) and
//     TRIGGER (trg) pins against those reference nodes and drives the discharge transistor SW_DIS (pin 7)
//     and the output stage V_OUT (pin 3, Vcc - 1.2 V behind 5 Ω: 1.7 V below Vcc at 100 mA, the datasheet
//     typical, and under 0.1 V low at 10 mA);
//   * the shared `edge-counter` counts LED blinks on the output.
// Astable: pin 2 is tied to pin 6 (SW_LINK closed, the default). Monostable: the shared `source-select`
// behavior (instance `mode`, the "Timer mode" tweak) opens SW_LINK and closes SW_PU, so pin 2 is held high by
// R_TRG (10 kΩ) and the TRIGGER button pulls it to ground; the output gives one pulse of ln3 · (R1 + R2) · C =
// 1.1 RC. The pull-up is switched out in astable mode because 10 kΩ on the capacitor node would skew the timing.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, PITCH, bbHole, between, jumper } from '../layout'

const BB: [number, number] = [0.6, 1.0]
const BAT_AT: [number, number] = [-7.4, 1.0]
/** the PP3's snaps, facing the breadboard (battery turned 180°): round (+) and hex (−) */
const snapPlus: [number, number, number] = [BAT_AT[0] + 2.55, BENCH_Y + 0.88, BAT_AT[1] + 0.5]
const snapMinus: [number, number, number] = [BAT_AT[0] + 2.55, BENCH_Y + 0.88, BAT_AT[1] - 0.5]

// DIP-8 on columns 12..15, centred over the trench: pin 1 (12, f), pin 4 (15, f), pin 5 (15, e), pin 8 (12, e)
const U1_COL = 12
const dipAt: [number, number, number] = [bbHole(BB, U1_COL + 1.5, 'e')[0], BENCH_Y + 0.85, BB[1]]

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const wBat = withCallout(jumper(snapPlus, bbHole(BB, 5, 'a'), 'red', 0.5), [0, 0.5, 0.2])
const wBatN = jumper(snapMinus, bbHole(BB, 3, '-t'), 'black', 0.5)
const wRailP = jumper(bbHole(BB, 7, 'a'), bbHole(BB, 7, '+t'), 'red', 0.15) // switch out → +9 V rail
const wRailLinkP = jumper(bbHole(BB, 1, '+t'), bbHole(BB, 1, '+b'), 'red', 0.5)
const wRailLinkN = jumper(bbHole(BB, 2, '-t'), bbHole(BB, 2, '-b'), 'black', 0.5)
const wVcc = jumper(bbHole(BB, 12, 'a'), bbHole(BB, 12, '+t'), 'red', 0.12) // pin 8
const wR1Rail = jumper(bbHole(BB, 9, 'a'), bbHole(BB, 9, '+t'), 'red', 0.12)
const wThr = jumper(bbHole(BB, 14, 'a'), bbHole(BB, 17, 'a'), 'yellow', 0.35) // pin 6 to R2's far end
const wThrC = jumper(bbHole(BB, 17, 'b'), bbHole(BB, 19, 'b'), 'yellow', 0.3) // on to the capacitor
const wC1Gnd = jumper(bbHole(BB, 20, 'a'), bbHole(BB, 20, '-t'), 'black', 0.12)
const wC2Gnd = jumper(bbHole(BB, 16, 'a'), bbHole(BB, 16, '-t'), 'black', 0.12)
const wGnd = jumper(bbHole(BB, 12, 'j'), bbHole(BB, 12, '-b'), 'black', 0.12) // pin 1
const wReset = jumper(bbHole(BB, 15, 'j'), bbHole(BB, 15, '+b'), 'red', 0.12) // pin 4 tied high
const wLedGnd = jumper(bbHole(BB, 16, 'j'), bbHole(BB, 16, '-b'), 'black', 0.1)
const wThrLow = jumper(bbHole(BB, 19, 'e'), bbHole(BB, 19, 'f'), 'yellow', 0.1) // THR across the trench to the mode switch
const wTrg = withCallout(jumper(bbHole(BB, 13, 'g'), bbHole(BB, 21, 'g'), 'green', 0.7), [0, 0.5, 0.4]) // pin 2 to the mode switch / trigger node
const wTrgBtn = jumper(bbHole(BB, 21, 'j'), bbHole(BB, 26, 'j'), 'green', 0.25)
const wBtnGnd = jumper(bbHole(BB, 29, 'j'), bbHole(BB, 29, '-b'), 'black', 0.12)
const wPullUp = jumper(bbHole(BB, 25, 'j'), bbHole(BB, 25, '+b'), 'red', 0.12)
// F1: R1 left out, pin 7 tied straight to the +9 V column
const wNoR1 = jumper(bbHole(BB, 9, 'c'), bbHole(BB, 13, 'c'), 'orange', 0.3)

const R_RATING = { maxP: 0.25, maxV: 250 }
/** NE555 datasheet figures, TI SLFS022 */
const NE555_FACTS = [
  'TI NE555: supply 4.5 V to 16 V (recommended operating range); absolute maximum 18 V',
  'Threshold comparator at 2/3 VCC: 9.4 V min, 10 V typ, 10.6 V max at VCC = 15 V; 2.7 / 3.3 / 4 V at VCC = 5 V. Trigger comparator at 1/3 VCC: 4.5 / 5 / 5.6 V at 15 V; 1.1 / 1.67 / 2.2 V at 5 V',
  'Output can source or sink 200 mA. Typical high level at VCC = 15 V: 13.3 V at -100 mA, 12.5 V at -200 mA (3.3 V at 5 V and -100 mA, about 1.7 V below VCC). Typical low level: 0.1 V at 10 mA, 0.4 V at 50 mA',
  'Supply current, output low, no load: 3 mA typ (6 mA max) at VCC = 5 V; 10 mA typ (15 mA max) at 15 V',
  'Pinout: 1 GND, 2 TRIG, 3 OUT, 4 RESET (active low), 5 CTRL, 6 THRES, 7 DISCH, 8 VCC. Internal divider: three 5 kΩ resistors. Pin 7 is an open-collector transistor to ground',
  'CMOS versions (TLC555, LMC555) run from about 2 V (TLC555) and idle at a small fraction of the NE555 current',
]

export const lesson: LessonDef = {
  id: 'timer-555',
  track: 'T3',
  title: 'The 555 Timer',
  subtitle: 'A clock built from comparators',
  tagline: 'R1 = 1 kΩ, R2 = 10 kΩ and 47 µF make an NE555 blink an LED at 1.46 Hz with a 52 % duty cycle.',

  board: {
    name: 'T555-24',
    size: [14, 9],
    base: 'breadboard-only',
    parts: [
      {
        id: 'bat',
        kind: 'battery-9v',
        pos: [BAT_AT[0], BENCH_Y, BAT_AT[1]],
        rot: 180,
        mount: 'offboard',
        label: 'BATTERY',
        role: 'A 9 V PP3 alkaline: 9 V behind about 1.5 Ω. Change the supply with the slider to see that the blink rate does not move.',
        params: { callout: [0, 2.2, 0.2] },
        circuitIds: ['V_BAT'],
      },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the timer.' },
      {
        id: 'sw1',
        kind: 'switch-slide',
        pos: between(bbHole(BB, 5, 'c'), bbHole(BB, 7, 'c')),
        mount: 'tht',
        label: 'SWITCH',
        role: 'Power: connects the battery to the +9 V rail.',
        params: { callout: [0, 1.4, 0.5] },
        circuitIds: ['SW1'],
      },
      {
        id: 'u1',
        kind: 'ic-dip',
        pos: dipAt,
        mount: 'tht',
        label: 'TIMER',
        role: 'NE555 in a DIP-8. Two comparators watch pins 2 and 6 against 1/3 and 2/3 of the supply, a latch remembers which was last, and a transistor on pin 7 discharges the capacitor. The three 5 kΩ divider resistors are real; the comparators, latch and output stage are modelled.',
        params: { pins: 8, marking: 'NE555', callout: [0.3, 1.9, -1.1] },
        circuitIds: ['R_D1', 'R_D2', 'R_D3', 'SW_DIS', 'V_OUT', 'R_Q'],
        facts: NE555_FACTS,
      },
      {
        id: 'r1',
        kind: 'resistor',
        pos: between(bbHole(BB, 9, 'b'), bbHole(BB, 13, 'b')),
        mount: 'tht',
        label: 'CHARGE',
        role: 'R1, 1 kΩ (brown-black-red): from +9 V to the discharge pin (pin 7). It sets the high time, and it is the only thing that limits the discharge transistor’s current.',
        params: { ohms: 1000, span: 4 * PITCH, callout: [-1.0, 1.3, -0.9] },
        circuitIds: ['R1'],
      },
      {
        id: 'r2',
        kind: 'resistor',
        pos: between(bbHole(BB, 13, 'd'), bbHole(BB, 17, 'd')),
        mount: 'tht',
        label: 'TIMING',
        role: 'R2, 10 kΩ (brown-black-orange): from pin 7 to the threshold node. C1 charges through R1 + R2 and discharges through R2 alone.',
        params: { ohms: 10000, span: 4 * PITCH, callout: [0.4, 1.0, -0.7] },
        circuitIds: ['R2'],
      },
      {
        id: 'c1',
        kind: 'capacitor-electrolytic',
        pos: between(bbHole(BB, 19, 'c'), bbHole(BB, 20, 'c')),
        mount: 'tht',
        label: 'TANK',
        role: 'C1, 47 µF / 25 V electrolytic, ±20 %: the timing capacitor. Its voltage ramps between 1/3 and 2/3 of the supply, 3 V to 6 V here. Stripe (negative) on the right.',
        params: { d: 0.63, h: 1.1, callout: [0.5, 1.7, -0.5] },
        circuitIds: ['C1'],
      },
      {
        id: 'c2',
        kind: 'capacitor-ceramic',
        pos: between(bbHole(BB, 15, 'c'), bbHole(BB, 16, 'c')),
        mount: 'tht',
        label: 'CTRL',
        role: 'C2, 10 nF ceramic from pin 5 to ground: it keeps noise off the 2/3 VCC reference.',
        params: { callout: [0, 1.0, 0.7] },
        circuitIds: ['C_CTL'],
      },
      {
        id: 'rled',
        kind: 'resistor',
        pos: between(bbHole(BB, 14, 'h'), bbHole(BB, 17, 'h')),
        mount: 'tht',
        role: '470 Ω current limit for the LED: about 12 mA with the output high at 9 V.',
        params: { ohms: 470, span: 3 * PITCH },
        circuitIds: ['R_LED'],
      },
      {
        id: 'led',
        kind: 'led',
        pos: between(bbHole(BB, 16, 'i'), bbHole(BB, 17, 'i')),
        mount: 'tht',
        label: 'BLINK',
        role: 'Red LED on the output, pin 3. Lit while the output is high.',
        params: { color: 'red', callout: [-0.9, 1.0, 0.9] },
        circuitIds: ['LED1'],
      },
      {
        id: 'swlink',
        kind: 'switch-slide',
        pos: between(bbHole(BB, 19, 'h'), bbHole(BB, 21, 'h')),
        mount: 'tht',
        label: 'MODE',
        role: 'The wire from pin 2 to pin 6, and the pull-up. Astable: pin 2 is tied to pin 6, the trigger watches the capacitor and the timer re-triggers itself. Monostable: the tie is lifted and pin 2 is held high by the pull-up until the button pulls it down.',
        params: { callout: [0.9, 1.3, 0.9] },
        circuitIds: ['SW_LINK', 'SW_PU'],
      },
      {
        id: 'rtrg',
        kind: 'resistor',
        pos: between(bbHole(BB, 21, 'i'), bbHole(BB, 25, 'i')),
        mount: 'tht',
        role: '10 kΩ pull-up: holds the trigger pin high (+9 V) unless the button pulls it down.',
        params: { ohms: 10000, span: 4 * PITCH },
        circuitIds: ['R_TRG'],
      },
      {
        id: 'btn',
        kind: 'button',
        pos: [(bbHole(BB, 27, 'e')[0] + bbHole(BB, 28, 'e')[0]) / 2, bbHole(BB, 27, 'e')[1], BB[1]],
        mount: 'tht',
        label: 'TRIGGER',
        role: 'Pulls pin 2 to ground. In monostable mode a press starts one output pulse; held longer than the pulse, the output stays high.',
        params: { callout: [0, 1.0, -0.6] },
        circuitIds: ['SW_TRIG'],
      },
      {
        id: 'w-r1',
        kind: 'wire',
        ...wNoR1,
        mount: 'offboard',
        role: 'Failure: pin 7 tied straight to +9 V, with R1 left out.',
        hidden: true,
      },
      { id: 'w-bat', kind: 'wire', ...wBat, mount: 'offboard', role: 'Battery + to the power switch.' },
      { id: 'w-bat-n', kind: 'wire', ...wBatN, mount: 'offboard', role: 'Battery − to the ground rail.' },
      { id: 'w-rail', kind: 'wire', ...wRailP, mount: 'offboard', role: 'Switch output to the +9 V rail.' },
      { id: 'w-link-p', kind: 'wire', ...wRailLinkP, mount: 'offboard', role: '+9 V rail, top to bottom.' },
      { id: 'w-link-n', kind: 'wire', ...wRailLinkN, mount: 'offboard', role: 'Ground rail, top to bottom.' },
      { id: 'w-vcc', kind: 'wire', ...wVcc, mount: 'offboard', role: 'Pin 8 (VCC) to the +9 V rail.' },
      { id: 'w-r1-rail', kind: 'wire', ...wR1Rail, mount: 'offboard', role: 'R1 to the +9 V rail.' },
      { id: 'w-thr', kind: 'wire', ...wThr, mount: 'offboard', role: 'Pin 6 (THRESHOLD) to R2’s far end: the capacitor node.' },
      { id: 'w-thr-c', kind: 'wire', ...wThrC, mount: 'offboard', role: 'Capacitor node on to C1’s + lead.' },
      { id: 'w-c1', kind: 'wire', ...wC1Gnd, mount: 'offboard', role: 'C1 − to the ground rail.' },
      { id: 'w-c2', kind: 'wire', ...wC2Gnd, mount: 'offboard', role: 'C2 to the ground rail.' },
      { id: 'w-gnd', kind: 'wire', ...wGnd, mount: 'offboard', role: 'Pin 1 (GND) to the ground rail.' },
      { id: 'w-rst', kind: 'wire', ...wReset, mount: 'offboard', role: 'Pin 4 (RESET, active low) tied to +9 V so it never resets.' },
      { id: 'w-led', kind: 'wire', ...wLedGnd, mount: 'offboard', role: 'LED cathode to the ground rail.' },
      { id: 'w-thr-lo', kind: 'wire', ...wThrLow, mount: 'offboard', role: 'Capacitor node across the trench to the pin 2 link.' },
      { id: 'w-trg', kind: 'wire', ...wTrg, mount: 'offboard', role: 'Pin 2 (TRIGGER) to the link switch, the pull-up and the button.' },
      { id: 'w-trg-b', kind: 'wire', ...wTrgBtn, mount: 'offboard', role: 'Trigger node to the button.' },
      { id: 'w-btn', kind: 'wire', ...wBtnGnd, mount: 'offboard', role: 'Button other side to the ground rail.' },
      { id: 'w-pu', kind: 'wire', ...wPullUp, mount: 'offboard', role: 'Pull-up resistor to the +9 V rail.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_BAT', type: 'V', nodes: ['b', '0'], value: 9, rInternal: 1.5, partId: 'bat' },
      { id: 'SW1', type: 'SW', nodes: ['b', 'vcc'], closed: true, partId: 'sw1' },
      // inside the NE555
      { id: 'R_Q', type: 'R', nodes: ['vcc', '0'], value: 1500, partId: 'u1' },
      { id: 'R_D1', type: 'R', nodes: ['vcc', 'th_ref'], value: 5000, partId: 'u1' },
      { id: 'R_D2', type: 'R', nodes: ['th_ref', 'tr_ref'], value: 5000, partId: 'u1' },
      { id: 'R_D3', type: 'R', nodes: ['tr_ref', '0'], value: 5000, partId: 'u1' },
      { id: 'C_CTL', type: 'C', nodes: ['th_ref', '0'], value: 10e-9, rating: { maxV: 50 }, partId: 'c2' },
      // the discharge transistor: the datasheet gives no absolute maximum for pin 7, so 0.2 A (the output's
      // rating) is a conservative stand-in
      { id: 'SW_DIS', type: 'SW', nodes: ['dis', '0'], closed: false, rating: { maxI: 0.2 }, partId: 'u1' },
      { id: 'V_OUT', type: 'V', nodes: ['o', '0'], value: 0, rInternal: 5, partId: 'u1' },
      // the timing network
      { id: 'R1', type: 'R', nodes: ['vcc', 'dis'], value: 1000, rating: R_RATING, partId: 'r1' },
      { id: 'R2', type: 'R', nodes: ['dis', 'thr'], value: 10000, rating: R_RATING, partId: 'r2' },
      { id: 'C1', type: 'C', nodes: ['thr', '0'], value: 47e-6, v0: 0, polarized: true, rating: { maxV: 25, failMode: 'short' }, partId: 'c1' },
      // pin 2: tied to pin 6 (astable) or held high by a pull-up and pulled down by the button (monostable)
      // the `mode` selector closes exactly one of SW_LINK and SW_PU
      { id: 'SW_LINK', type: 'SW', nodes: ['thr', 'trg'], closed: true, partId: 'swlink' },
      { id: 'SW_PU', type: 'SW', nodes: ['vcc', 'pu'], closed: false, partId: 'swlink' },
      { id: 'R_TRG', type: 'R', nodes: ['pu', 'trg'], value: 10000, rating: R_RATING, partId: 'rtrg' },
      { id: 'SW_TRIG', type: 'SW', nodes: ['trg', '0'], closed: false, partId: 'btn' },
      // the output
      { id: 'R_LED', type: 'R', nodes: ['o', 'led'], value: 470, rating: R_RATING, partId: 'rled' },
      { id: 'LED1', type: 'LED', nodes: ['led', '0'], color: 'red', rating: { maxI: 0.03, maxV: 5 }, partId: 'led' },
    ],
  },
  powerElementId: 'SW1',
  powerLabel: 'Connect battery',

  behaviors: [
    { id: 'ne555', instance: 'u1', params: { thr: 'thr', trig: 'trg', vcc: 'vcc', thRef: 'th_ref', trRef: 'tr_ref', out: 'V_OUT', dis: 'SW_DIS' } },
    // one count per LED blink: the output's rising edges (3 V is above the low level and well under the 9 V high one)
    { id: 'source-select', instance: 'mode', params: { mode: 0, switches: 'SW_LINK,SW_PU' } },
    { id: 'edge-counter', instance: 'blinks', params: { node: 'o', threshold: 2.5, hyst: 1 } },
  ],

  // 0.5 ms steps put even the fastest timing network the sliders allow (about 10 ms) at 20 steps per cycle
  sim: { dt: 5e-4 },

  // The capacitor waveform between 1/3 and 2/3 of the supply, with the output underneath: 1.5 s across shows two
  // cycles. CAP: 1.5 V per division, 0 V at -3.5 divisions, so 3 V and 6 V sit at -1.5 and +0.5.
  instruments: {
    open: true,
    scope: {
      channels: [
        {
          label: 'CAP · pins 2/6',
          source: { kind: 'voltage', node: 'thr' },
          perDiv: 1.5,
          offset: -3.5,
          marks: [
            { value: 6, label: '2/3 Vcc · 6 V' },
            { value: 3, label: '1/3 Vcc · 3 V' },
          ],
        },
        { label: 'OUTPUT · pin 3', source: { kind: 'voltage', node: 'o' }, perDiv: 4, offset: 2 },
      ],
      timePerDiv: 0.15,
      trigger: { channel: 0, level: 4.5, slope: 'rising', mode: 'auto' },
    },
    chart: { signals: [0, 1], span: 10 },
  },

  readouts: [
    { label: 'CAP (pins 2/6)', source: { kind: 'voltage', node: 'thr' }, unit: 'V' },
    { label: 'OUTPUT (pin 3)', source: { kind: 'voltage', node: 'o' }, unit: 'V' },
    { label: 'FREQUENCY', source: { kind: 'behavior', key: 'u1.freq' }, unit: 'Hz' },
    { label: 'DUTY', source: { kind: 'behavior', key: 'u1.dutyPct' }, unit: '%' },
    { label: 'LED CURRENT', source: { kind: 'current', elementId: 'LED1' }, unit: 'A', warnAbove: 0.03 },
    { label: 'PULSE WIDTH', source: { kind: 'behavior', key: 'u1.pulse' }, unit: 's' },
    { label: 'BLINKS', source: { kind: 'behavior', key: 'blinks.rising' }, unit: '' },
    { label: 'SUPPLY (pin 8)', source: { kind: 'voltage', node: 'vcc' }, unit: 'V' },
  ],

  tweaks: [
    { label: 'R1', elementId: 'R1', key: 'value', min: 1000, max: 47000, log: true, unit: 'Ω' },
    { label: 'R2', elementId: 'R2', key: 'value', min: 1000, max: 100000, log: true, unit: 'Ω' },
    { label: 'C1', elementId: 'C1', key: 'value', min: 4.7e-6, max: 470e-6, log: true, unit: 'F' },
    { label: 'Supply', elementId: 'V_BAT', key: 'value', min: 3, max: 15, step: 0.5, unit: 'V' },
    {
      label: 'Timer mode',
      elementId: 'behavior:mode',
      key: 'mode',
      kind: 'enum',
      min: 0,
      max: 1,
      unit: '',
      options: [
        { label: 'Astable', value: 0 },
        { label: 'Monostable', value: 1 },
      ],
    },
    { label: 'TRIGGER button', elementId: 'SW_TRIG', key: 'closed', kind: 'momentary', min: 0, max: 1, step: 1, unit: '' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'READY' }, text: 'BATTERY NOT CONNECTED: the NE555 is dead until you connect it' },
    {
      when: { kind: 'state', is: 'POWERED' },
      text: 'POWERED: supply {7}, output {1}. A blinking light needs 4.5 V to 16 V on pin 8; in monostable mode the timer waits for the TRIGGER button.',
    },
    { when: { kind: 'above', readout: 5, value: 0.001 }, text: 'ONE-SHOT: the last output pulse lasted {5} (1.1 × (R1 + R2) × C1). Press TRIGGER for another.' },
    {
      when: { kind: 'above', readout: 2, value: 0.01 },
      text: 'ASTABLE: C1 ramps between 1/3 and 2/3 of the {7} supply (now {0}); the output blinks at {2} with a {3} duty. LED {4}.',
    },
    {
      when: { kind: 'above', readout: 2, value: 200 },
      text: 'STEP-LIMITED: no timing capacitor, so the node crosses both thresholds in one simulation step and the output flips every step. A real 555 would run far faster than {2}, set by stray capacitance.',
    },
    { when: { kind: 'state', is: 'FAULT' }, text: 'FAULT: the discharge transistor on pin 7 shorted the battery through no R1 and burned out; C1 can no longer discharge, so it charges once and the output stays low' },
  ],

  failures: [
    {
      id: 'no-r1',
      label: 'Leave out R1 (pin 7 tied to +9 V)',
      explain:
        'R1 is what limits the discharge transistor’s current. Without it, the moment the threshold comparator turns the transistor on it shorts the supply to ground, limited only by the battery’s 1.5 Ω and the switch: about 5.8 A. In hardware this destroys the 555’s discharge transistor; here SW_DIS burns open at that first discharge. With the transistor gone C1 can only charge (through R2 alone), the output goes low and stays low, and the oscillation stops.',
      patches: [{ op: 'short', a: 'vcc', b: 'dis' }],
      parts: { hide: ['r1'], show: ['w-r1'] },
    },
    {
      id: 'no-cap',
      label: 'Remove the timing capacitor',
      explain:
        'With no capacitor the threshold node follows pin 7 instantly: it crosses both trip points as soon as the discharge transistor changes state, so the latch flips on every simulation step (the readout shows the solver’s step rate, not the part’s). A real 555 oscillates at a high frequency set by stray capacitance and its internal delays (hundreds of kilohertz at best), far too fast to see blink.',
      patches: [{ op: 'remove', elementId: 'C1' }],
      parts: { hide: ['c1'] },
    },
    {
      id: 'two-aa',
      label: 'Run it from two AA cells (3 V)',
      explain:
        'The bipolar NE555 is specified from 4.5 V to 16 V. Below that the comparator references and the output stage are not guaranteed, and the model holds the latch reset: the output stays low, the LED stays dark and nothing blinks. The CMOS TLC555 works from about 2 V and draws far less current, which is why battery projects use it.',
      patches: [
        { op: 'set', elementId: 'V_BAT', key: 'value', value: 3 },
        { op: 'set', elementId: 'V_BAT', key: 'rInternal', value: 0.3 },
      ],
    },
  ],

  meet: `Inside the 555, three equal **5 kΩ** resistors split the supply into thirds. Two comparators watch the capacitor voltage:

- When it rises to **2/3 V_CC** (6 V on a 9 V supply), the **threshold** comparator resets an SR latch: the output goes low and the **discharge** transistor shorts pin 7 to ground.
- When it falls to **1/3 V_CC** (3 V), the **trigger** comparator sets the latch: the output goes high and the discharge transistor lets go.

Press **Connect battery**, open **Instruments** if it is not already, and watch the CAP trace ramp up and down between the 3 V and 6 V lines while the output flips and the LED blinks.

**Astable.** C1 charges through **R1 + R2** and discharges through **R2** only. Each phase covers the span from 1/3 to 2/3 V_CC. Charging toward V_CC, the gap to the target halves from 2/3 V_CC to 1/3 V_CC, so the time is RC·ln 2. Discharging toward 0, the voltage halves from 2/3 to 1/3, again RC·ln 2.

- t_high = 0.693 × (1k + 10k) × 47 µF = **0.358 s**
- t_low = 0.693 × 10k × 47 µF = **0.326 s**
- f = 1/(0.358 + 0.326) = **1.46 Hz**, duty = 0.358/0.684 = **52 %**

Equivalently, **f = 1.44 / ((R1 + 2R2)·C)** = 1.44/(21k × 47 µ) = 1.46 Hz, and **duty = (R1 + R2)/(R1 + 2R2)**.

V_CC cancels out of both times, so the frequency is independent of the supply: slide **Supply** from 6 V to 15 V and the rate does not move, though the LED brightness does. Since t_high always includes R1, the duty cycle of this basic circuit is always above 50 %. A diode across R2 gets around that.

**Monostable.** Set **Timer mode** to Monostable (this lifts the wire from pin 2 to pin 6 and adds a pull-up). Pin 2 is now held high by a pull-up, so nothing sets the latch: the output rests low and the discharge transistor holds C1 at 0 V. Press **TRIGGER**: pin 2 dips under 1/3 V_CC, the latch sets, the output goes high and C1 starts to charge through R1 + R2 toward V_CC. At 2/3 V_CC the threshold comparator resets it. C1 needs t = RC·ln 3 to get there:

- t = 1.1 × (R1 + R2) × C = 1.1 × 11k × 47 µF = **0.57 s**, whatever the supply.

Hold the button longer than that and the output stays high: the trigger comparator wins over the threshold one.

**Current and ratings.** The LED current is (9 − 1.2 − 1.8)/(470 + 5) ≈ **12.6 mA**. The NE555 itself draws about 6 mA from 9 V (R_Q), which is why it is not a battery chip. The electrolytic’s ±20 % tolerance means the real rate could be anywhere from about 1.2 to 1.8 Hz. Try the **Break it** buttons: a missing R1 shorts the supply when the discharge transistor turns on, a missing capacitor makes the output flip every step, and two AA cells (3 V) are below the part’s 4.5 V minimum.`,

  mechanicalAnalogy: `A 555 astable is a toilet cistern with a two-mark float. Water (charge) fills through the inlet (R1 + R2) until the float hits the upper mark, which trips the flush valve (discharge). The valve then drains it (through R2) to the lower mark and shuts, and the cycle repeats. The gap between the marks is hysteresis, which stops the valve chattering.

**Where it breaks:** the cistern fills at a roughly constant rate, while the capacitor fills exponentially, which is where ln 2 comes from. The 555's "valve" snaps in nanoseconds, not seconds.`,

  proTips: [
    'Always decouple a bipolar 555: 10 nF on pin 5, and 100 nF plus some bulk capacitance across the supply. Its output stage draws large current spikes when it switches, which can glitch the rest of the board.',
    'For battery projects use a CMOS 555 (TLC555, LMC555). It runs from about 2 V and idles at a small fraction of the NE555’s few milliamps.',
    'A 555’s accuracy is limited by its timing capacitor (±10–20 %). For anything that must be accurate, use a crystal-clocked microcontroller timer.',
  ],

  guide: [
    {
      id: 'meet-c1',
      title: 'Meet the timing capacitor',
      body: 'Click the capacitor labelled **TANK** to open its inspector. It is **47 µF**, 25 V, an electrolytic with its stripe on the negative lead.',
      check: { kind: 'inspect', part: 'c1' },
      focus: { part: 'c1' },
      hint: 'It is the tall can on the breadboard, next to the NE555.',
      explain: 'The whole oscillator is this capacitor charging and discharging between 1/3 and 2/3 of the supply, 3 V and 6 V from the 9 V battery. Its value, with R1 and R2, sets the speed.',
    },
    {
      id: 'power-up',
      title: 'Connect the battery',
      body: 'Press **Connect battery**. The LED starts blinking and **FREQUENCY** settles near **1.46 Hz** with a **DUTY** near **52 %**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'power' },
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 2, above: 1.3, below: 1.6, holdMs: 300 },
          { kind: 'readout', index: 3, above: 48, below: 56, holdMs: 300 },
        ],
      },
      focus: { control: 'power' },
      hint: 'The reading appears after the first full cycle, about 0.7 s.',
      explain: 'f = 1.44 / ((R1 + 2 R2) C) = 1.44 / (21 kΩ × 47 µF) = 1.46 Hz. The capacitor charges through R1 + R2 and discharges through R2 only, so the output is high a little longer than low: duty = (R1 + R2) / (R1 + 2 R2) = 52 %.',
    },
    {
      id: 'slow-it',
      title: 'Slow it with a bigger capacitor',
      body: 'Slide **C1** to about **100 µF**. The blink slows to about **0.69 Hz**: 1.44 / (21 kΩ × 100 µF).',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'C1', min: 85e-6, max: 125e-6 },
          { kind: 'readout', index: 2, above: 0.58, below: 0.8, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:C1' },
      hint: 'The slider is logarithmic. 100 µF is a bit past halfway. The new frequency shows after a cycle or two.',
      explain: 'Frequency is inversely proportional to C: double the capacitance and the capacitor takes twice as long to ramp between the same two thresholds.',
    },
    {
      id: 'supply',
      title: 'Raise the supply to 12 V',
      body: 'Slide **Supply** up to about **12 V**. The thresholds move to 4 V and 8 V, yet **FREQUENCY** stays near **0.69 Hz**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Supply', min: 11, max: 13 },
          { kind: 'readout', index: 7, above: 10.5 },
          { kind: 'readout', index: 2, above: 0.58, below: 0.8, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Supply' },
      explain: 'The comparators work from fractions of the same supply that charges the capacitor, so V_CC cancels out of the timing: the capacitor still needs the same ln 2 time constants per phase. The LED just gets brighter.',
    },
    {
      id: 'no-r1',
      title: 'Break it: leave R1 out',
      body: 'Open **Break something** and choose **Leave out R1**. The discharge transistor on pin 7 now shorts the battery to ground and burns out.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'no-r1' }, { kind: 'status', is: 'FAULT' }] },
      focus: { control: 'break' },
      hint: 'The burn happens when the capacitor first reaches the upper threshold, within a couple of seconds.',
      explain: 'R1 is the only thing limiting the current through the discharge transistor. Without it the battery is limited only by its own 1.5 Ω, about 5.8 A from 9 V, and the transistor fails. Then C1 can never discharge and the output sticks low.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**. The blinking resumes.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'repair' }, { kind: 'readout', index: 2, above: 0.1, holdMs: 300 }] },
      focus: { control: 'break' },
    },
    {
      id: 'one-shot',
      title: 'Make it a one-shot',
      body: 'Set **Timer mode** to **Monostable**, then press **TRIGGER**. The output gives one pulse and **PULSE WIDTH** reads about **1.2 s**: 1.1 × 11 kΩ × 100 µF.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Timer mode', min: 1 },
          { kind: 'readout', index: 5, above: 0.9, below: 1.7 },
        ],
      },
      focus: { control: 'tweak:Timer mode' },
      hint: 'Switch the mode first, wait a few seconds for the capacitor to empty, then press and release TRIGGER once.',
      explain: 'In monostable mode pin 2 rests high, so nothing sets the latch. A press pulls it below 1/3 V_CC, the output goes high and the capacitor charges through R1 + R2 until it hits 2/3 V_CC: t = ln 3 × (R1 + R2) × C = 1.1 RC, whatever the supply.',
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: each is a 555 timing calculation.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  quiz: [
    {
      q: 'An astable 555 has R1 = 10 kΩ, R2 = 100 kΩ and C = 10 µF. What is its frequency?',
      options: ['1.44 Hz', '6.9 Hz', '0.069 Hz', '0.69 Hz'],
      answer: 3,
      why: 'f = 1.44/((10k + 200k) × 10 µ) = 1.44/2.1 ≈ 0.686 Hz.',
    },
    {
      q: 'With R1 = 1 kΩ, R2 = 10 kΩ and C = 100 µF, how long is the output high?',
      options: ['0.069 s', '0.762 s', '0.693 s', '1.52 s'],
      answer: 1,
      why: 't_high = 0.693 × 11k × 100 µ = 0.762 s.',
    },
    {
      q: 'Why can’t the basic astable reach a duty cycle below 50 %?',
      options: ['The comparators are asymmetric', 'The output stage can’t sink current', 'Charging goes through R1 + R2 but discharging only through R2, so t_high > t_low', 'The capacitor leaks'],
      answer: 2,
      why: 't_high ∝ (R1 + R2) and t_low ∝ R2, so high always lasts longer.',
    },
    {
      q: 'This blinker is moved from 9 V to 12 V. What happens to the frequency?',
      options: ['It stays the same', 'It rises by 33 %', 'It falls by 25 %', 'It doubles'],
      answer: 0,
      why: 'The thresholds scale with V_CC, so V_CC cancels from the timing equations.',
    },
    {
      q: 'A monostable 555 uses R = 100 kΩ and C = 10 µF. How long is its output pulse?',
      options: ['0.69 s', '1.1 s', '1.44 s', '0.37 s'],
      answer: 1,
      why: 'The capacitor charges from 0 to 2/3 V_CC: t = RC·ln 3 = 1.1 × 100k × 10 µ = 1.1 s.',
    },
  ],
}
