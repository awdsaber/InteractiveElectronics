// T2 · Diodes and Rectifiers. Source: docs/curriculum/T2/diode-rectifier.md
//
// A 12 V AC plug-in adapter (13.5 V RMS open-circuit, 1.5 Ω winding) feeds a four-1N4007 bridge, a
// 1000 µF smoothing capacitor and a 100 Ω load, built on a breadboard. The adapter is a `V.wave`
// sine behind a mains switch (the power element) and the winding resistance. The scope shows the AC
// input and the DC output, so the ripple is seen. The `ac-meter` behavior reads DC out (`dc`), the
// ripple (`vpp`) and the AC input (`acrmsB`). A half-wave/full-wave enum tweak lifts D2 (a switch in
// series with it): the bridge then conducts only on the positive half-cycle.
// The sim runs the trapezoidal rule at 50 µs (the conduction pulses last 1-2 ms) at ×0.2.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

// Bench layout: the adapter at the left, two output posts in front of it, the breadboard to the right.
// Top rail '+t' is the DC output, '-t' is ground; the bottom half is tied up to the top half with
// short jumpers across the centre gap.
// columns: 6 = ground (D3, D4 anodes), 10 = ac1 in the top half / ac2 in the bottom half, 14 = DC out
// (D1, D2 cathodes), 18-20 smoothing capacitor, 22-26 load. Top diodes sit in row d, bottom in row g.
const BB: [number, number] = [1.6, 0.9]
const XF_AT: [number, number] = [-5.4, -0.8]
const POST_A: [number, number, number] = [-3.0, BENCH_Y + 0.25, 0.7]
const POST_B: [number, number, number] = [-3.0, BENCH_Y + 0.25, 1.5]

const C_GND = 6
const C_AC = 10
const C_DC = 14
const C_CAP = 18
const C_LOAD = 22

const d3A = bbHole(BB, C_GND, 'd')
const d3K = bbHole(BB, C_AC, 'd')
const d1A = bbHole(BB, C_AC, 'd')
const d1K = bbHole(BB, C_DC, 'd')
const d4A = bbHole(BB, C_GND, 'g')
const d4K = bbHole(BB, C_AC, 'g')
const d2A = bbHole(BB, C_AC, 'g')
const d2K = bbHole(BB, C_DC, 'g')
const c1Plus = bbHole(BB, C_CAP, 'b')
const c1Minus = bbHole(BB, C_CAP + 2, 'b')
const rlTop = bbHole(BB, C_LOAD, 'd')
const rlBot = bbHole(BB, C_LOAD + 4, 'd')

const wAc1 = jumper(POST_A, bbHole(BB, C_AC, 'a'), 'yellow', 0.7)
const wAc2 = jumper(POST_B, bbHole(BB, C_AC, 'j'), 'blue', 0.7)
const wGndTie = jumper(bbHole(BB, C_GND, 'e'), bbHole(BB, C_GND, 'f'), 'black', 0.12)
const wDcTie = jumper(bbHole(BB, C_DC, 'e'), bbHole(BB, C_DC, 'f'), 'red', 0.12)
const wGndRail = jumper(bbHole(BB, C_GND, 'a'), bbHole(BB, C_GND, '-t'), 'black', 0.12)
const wDcRail = jumper(bbHole(BB, C_DC, 'a'), bbHole(BB, C_DC, '+t'), 'red', 0.12)
const wCapPlus = jumper(bbHole(BB, C_CAP, 'a'), bbHole(BB, C_CAP, '+t'), 'red', 0.12)
const wCapMinus = jumper(bbHole(BB, C_CAP + 2, 'a'), bbHole(BB, C_CAP + 2, '-t'), 'black', 0.12)
const wLoadTop = jumper(bbHole(BB, C_LOAD, 'a'), bbHole(BB, C_LOAD, '+t'), 'red', 0.12)
const wLoadBot = jumper(bbHole(BB, C_LOAD + 4, 'a'), bbHole(BB, C_LOAD + 4, '-t'), 'black', 0.12)

/**
 * 1N4007 as a Shockley diode: the datasheet gives VF ≈ 0.93 V typical, 1.1 V maximum at 1 A (Vishay,
 * Fairchild), and about 0.6 V at 10 mA. n = 1.7, Is = 10 nA, Rs = 0.1 Ω reproduce that: 0.61 V at
 * 10 mA, 0.72 V at 100 mA, 0.91 V at 1 A.
 */
const DIODE = { is: 1e-8, n: 1.7, rs: 0.1 }
/** 1 A average, 1000 V V_RRM; the current rating is RMS over 0.2 s (the pulsed heating a bridge sees) */
const D_RATING = { maxI: 1, maxV: 1000, rmsWindow: 0.2 }

const diodePart = (id: string, pos: [number, number, number], rot: number, label: string, role: string, circuitIds: string[], callout: [number, number, number], extra: object = {}) => ({
  id,
  kind: 'diode' as const,
  pos,
  rot,
  mount: 'tht' as const,
  label,
  role,
  params: { marking: '1N4007', span: 1.016, callout },
  circuitIds,
  facts: ['1N4007: 1 A average, 1000 V repetitive reverse', 'I_FSM 30 A (8.3 ms half-sine), single shot', 'VF about 0.9 V typical, 1.1 V max at 1 A'],
  ...extra,
})

export const lesson: LessonDef = {
  id: 'diode-rectifier',
  track: 'T2',
  title: 'Diodes and Rectifiers',
  subtitle: 'One-way valves for current',
  tagline: 'Four 1N4007s and 1000 µF turn a 12 V AC adapter into about 16 V DC, with about 1 V of ripple at 155 mA.',

  board: {
    name: 'RECT-15',
    size: [14, 9],
    base: 'breadboard-only',
    parts: [
      {
        id: 'xf',
        kind: 'transformer',
        pos: [XF_AT[0], BENCH_Y, XF_AT[1]],
        mount: 'offboard',
        label: 'ADAPTER',
        role: 'A 12 V AC, 1 A plug-in transformer: a safe low-voltage source. 13.5 V RMS (19.1 V peak) with no load, about 1.5 Ω of winding resistance, 50 Hz.',
        params: { marking: '12 V AC', callout: [0.2, 3.0, 0.4] },
        circuitIds: ['V_SEC', 'SW_MAINS', 'R_W'],
      },
      { id: 'post-a', kind: 'testpoint', pos: POST_A, mount: 'offboard', role: 'Adapter output, AC terminal 1.', params: { color: 'yellow' } },
      { id: 'post-b', kind: 'testpoint', pos: POST_B, mount: 'offboard', role: 'Adapter output, AC terminal 2.', params: { color: 'blue' } },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the rectifier.' },
      diodePart('d3', between(d3A, d3K), 0, 'D3', 'Bridge diode D3, 1N4007: conducts on the negative half-cycle, returning current from ground to AC terminal 1. Stripe (cathode) to the right.', ['D3'], [0, 1.1, -0.8]),
      diodePart('d1', between(d1A, d1K), 0, 'D1', 'Bridge diode D1, 1N4007: on the positive half-cycle it steers AC terminal 1 into the DC output. Stripe (cathode) to the right.', ['D1'], [0, 1.1, -0.8]),
      diodePart('d4', between(d4A, d4K), 0, 'D4', 'Bridge diode D4, 1N4007: conducts on the positive half-cycle, returning current from ground to AC terminal 2. Stripe (cathode) to the right.', ['D4'], [0, 1.1, 0.9]),
      diodePart('d2', between(d2A, d2K), 0, 'D2', 'Bridge diode D2, 1N4007: on the negative half-cycle it steers AC terminal 2 into the DC output. Stripe (cathode) to the right.', ['D2', 'SW_D2'], [0, 1.1, 0.9]),
      // F3: D2 fitted the wrong way round
      diodePart('d2rev', between(d2A, d2K), 180, 'D2 ↺', 'D2 fitted backwards: the stripe (cathode) is on the AC side, so it conducts from the DC output back into the adapter and, with D1, shorts the winding.', ['D2'], [0, 1.1, 0.9], { hidden: true }),
      {
        id: 'c1',
        kind: 'capacitor-electrolytic',
        pos: between(c1Plus, c1Minus),
        mount: 'tht',
        label: 'SMOOTH',
        role: '1000 µF, 25 V aluminium electrolytic. Holds the output up between the peaks. The stripe marks the negative lead (on the right, to ground).',
        params: { d: 1.0, h: 1.6, callout: [1.2, 1.5, 0.4] },
        circuitIds: ['C1'],
        facts: ['25 V rated; off-load peak here is about 18 V', 'Electrolytic: polarity matters, ripple current heats it'],
      },
      {
        id: 'rl',
        kind: 'resistor',
        pos: between(rlTop, rlBot),
        mount: 'tht',
        label: 'LOAD',
        role: 'A 100 Ω, 5 W load (brown-black-brown-gold): about 160 mA at 16 V. Slide it to change the current the capacitor must supply.',
        params: { ohms: 100, span: 1.016, callout: [0.3, 1.6, 0.9] },
        circuitIds: ['R_LOAD'],
      },
      {
        id: 'ch1',
        kind: 'probe',
        pos: bbHole(BB, C_DC, 'b'),
        rot: 180,
        mount: 'offboard',
        label: 'CH1 · DC OUT',
        role: 'Scope channel 1 on the DC output (the capacitor’s top): the ripple rides on this trace.',
        params: { color: 'yellow', tilt: 22, callout: [-0.2, 1.4, -1.3] },
      },
      {
        id: 'ch2',
        kind: 'probe',
        pos: bbHole(BB, C_AC, 'b'),
        rot: 180,
        mount: 'offboard',
        label: 'CH2 · AC IN',
        role: 'Scope channel 2 across the adapter’s two terminals (AC terminal 1 against terminal 2).',
        params: { color: 'blue', tilt: 22, callout: [-1.0, 1.3, -0.9] },
      },
      { id: 'w-ac1', kind: 'wire', ...wAc1, mount: 'offboard', role: 'Adapter terminal 1 to the bridge’s AC1 column.' },
      { id: 'w-ac2', kind: 'wire', ...wAc2, mount: 'offboard', role: 'Adapter terminal 2 to the bridge’s AC2 column.' },
      { id: 'w-gnd-tie', kind: 'wire', ...wGndTie, mount: 'offboard', role: 'Ties the ground columns of the two halves of the bridge.' },
      { id: 'w-dc-tie', kind: 'wire', ...wDcTie, mount: 'offboard', role: 'Ties the DC columns of the two halves of the bridge.' },
      { id: 'w-gnd', kind: 'wire', ...wGndRail, mount: 'offboard', role: 'Bridge ground to the ground rail.' },
      { id: 'w-dc', kind: 'wire', ...wDcRail, mount: 'offboard', role: 'Bridge DC output to the output rail.' },
      { id: 'w-cap-p', kind: 'wire', ...wCapPlus, mount: 'offboard', role: 'Capacitor + to the output rail.' },
      { id: 'w-cap-n', kind: 'wire', ...wCapMinus, mount: 'offboard', role: 'Capacitor − to the ground rail.' },
      { id: 'w-load-p', kind: 'wire', ...wLoadTop, mount: 'offboard', role: 'Load to the output rail.' },
      { id: 'w-load-n', kind: 'wire', ...wLoadBot, mount: 'offboard', role: 'Load to the ground rail.' },
    ],
  },

  circuit: {
    elements: [
      // the adapter: the secondary floats; DC negative is ground '0'
      { id: 'V_SEC', type: 'V', nodes: ['x', 'ac2'], value: 0, wave: { kind: 'sine', amp: 19.1, freq: 50 }, partId: 'xf' },
      // `closed: true`: the bench opens the power element until "Plug in the adapter"
      { id: 'SW_MAINS', type: 'SW', nodes: ['x', 'y'], closed: true, partId: 'xf' },
      { id: 'R_W', type: 'R', nodes: ['y', 'ac1'], value: 1.5, partId: 'xf' },
      { id: 'D1', type: 'D', nodes: ['ac1', 'dcp'], ...DIODE, rating: D_RATING, partId: 'd1' },
      // D2 sits behind SW_D2, the half-wave / full-wave tweak
      { id: 'SW_D2', type: 'SW', nodes: ['ac2', 'a2'], closed: true, partId: 'd2' },
      { id: 'D2', type: 'D', nodes: ['a2', 'dcp'], ...DIODE, rating: D_RATING, partId: 'd2' },
      { id: 'D3', type: 'D', nodes: ['0', 'ac1'], ...DIODE, rating: D_RATING, partId: 'd3' },
      { id: 'D4', type: 'D', nodes: ['0', 'ac2'], ...DIODE, rating: D_RATING, partId: 'd4' },
      { id: 'C1', type: 'C', nodes: ['dcp', '0'], value: 1e-3, v0: 0, polarized: true, rating: { maxV: 25, failMode: 'short' }, partId: 'c1' },
      { id: 'R_LOAD', type: 'R', nodes: ['dcp', '0'], value: 100, rating: { maxP: 5 }, partId: 'rl' },
    ],
  },
  powerElementId: 'SW_MAINS',
  powerLabel: 'Plug in the adapter',

  readouts: [
    { label: 'DC OUT (AVERAGE)', source: { kind: 'behavior', key: 'meter.dc' }, unit: 'V', digits: 2 },
    { label: 'RIPPLE p-p', source: { kind: 'behavior', key: 'meter.vpp' }, unit: 'V', digits: 2 },
    { label: 'LOAD CURRENT', source: { kind: 'current', elementId: 'R_LOAD' }, unit: 'A' },
    { label: 'D1 PEAK CURRENT (HOLD)', source: { kind: 'current', elementId: 'D1' }, unit: 'A', peak: true },
    { label: 'AC IN (RMS)', source: { kind: 'behavior', key: 'meter.acrmsB' }, unit: 'V', digits: 2 },
    { label: 'D1 PEAK REVERSE (HOLD)', source: { kind: 'voltage', node: 'dcp', ref: 'ac1' }, unit: 'V', peak: true },
  ],

  tweaks: [
    {
      label: 'Rectifier',
      elementId: 'SW_D2',
      key: 'closed',
      kind: 'enum',
      min: 0,
      max: 1,
      unit: '',
      options: [
        { label: 'Full-wave (bridge)', value: 1 },
        { label: 'Half-wave (D2 lifted)', value: 0 },
      ],
    },
    { label: 'Smoothing capacitor', elementId: 'C1', key: 'value', min: 1e-4, max: 4.7e-3, log: true, unit: 'F' },
    { label: 'Load resistance', elementId: 'R_LOAD', key: 'value', min: 47, max: 1000, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: the bridge charges the capacitor near each peak; watch DC OUT and its ripple on the scope' },
    { when: { kind: 'above', readout: 1, value: 0.05 }, text: 'RECTIFYING: DC OUT {0} with {1} of ripple at {2}; the load takes a steady {2}, but D1 passed {3} at switch-on' },
    { when: { kind: 'above', readout: 1, value: 5 }, text: 'HEAVY RIPPLE: {1} p-p. The capacitor is too small for this load, or only one half-cycle is being rectified' },
    { when: { kind: 'state', is: 'READY' }, text: 'ADAPTER UNPLUGGED: press Plug in the adapter and watch the scope' },
    { when: { kind: 'state', is: 'FAULT' }, text: 'FAULT: a part failed; repair to try again' },
  ],

  failures: [
    {
      id: 'open-diode',
      label: 'D3 goes open',
      explain:
        'With D3 open the negative half-cycle has no return path, so the bridge is a half-wave rectifier: the capacitor is topped up once every 20 ms instead of every 10 ms. It sags for twice as long, so the ripple doubles (ΔV ≈ I/(f·C), about 2.5 V p-p at 50 Hz) and the average output falls to about 14.8 V.',
      patches: [{ op: 'remove', elementId: 'D3' }],
      parts: { hide: ['d3'] },
    },
    {
      id: 'no-cap',
      label: 'Leave out the smoothing capacitor',
      explain:
        'Without storage the output is just the rectified sine, |v_ac| minus two diode drops: a string of 100 Hz humps from 0 V to about 17 V. A DC meter reads their average, about 2·V_p/π less two drops, near 10.6 V, and the ripple is the full 17 V.',
      patches: [{ op: 'remove', elementId: 'C1' }],
      parts: { hide: ['c1'] },
    },
    {
      id: 'reversed-diode',
      label: 'Fit D2 backwards',
      explain:
        'Reversed, D2 conducts from the DC output back to AC terminal 2. On every positive half-cycle the path adapter → R_W → D1 → D2 → adapter is a short circuit with only the 1.5 Ω winding and two diode drops in it: about (19 − 1.8)/1.6 ≈ 10 A, ten times the 1N4007’s 1 A rating. The diodes overheat and burn open in a fraction of a second. This is why rectifiers are fused, and why you check the stripe before you power up.',
      patches: [
        { op: 'remove', elementId: 'D2' },
        { op: 'add', element: { id: 'D2R', type: 'D', nodes: ['dcp', 'a2'], ...DIODE, rating: D_RATING, partId: 'd2rev' } },
      ],
      parts: { hide: ['d2'], show: ['d2rev'] },
    },
  ],

  meet: `A diode conducts when its anode is about **0.6 to 0.7 V** above its cathode, and the drop creeps up with current: a 1N4007 reaches about **0.9 V** at its 1 A rating (1.1 V maximum). In reverse it blocks, up to its **1000 V** V_RRM.

**The bridge.** On the positive half-cycle, current flows AC1 → D1 → load → D4 → AC2. On the negative half-cycle it flows AC2 → D2 → load → D3 → AC1. Either way it passes through the load the same way, crossing **two** diodes.

**Peak output.** The adapter's secondary peaks at √2 × 13.5 = **19.1 V** with no load. Under load, subtract two diode drops and the voltage lost in the 1.5 Ω winding during the charging pulses (about 2.6 V in all), which leaves a peak near 16.5 V.

**Ripple.** Between peaks the capacitor alone feeds the load, sagging by at most

ΔV ≈ I / (2·f·C) = 0.156 / (2 × 50 × 0.001) = **1.56 V p-p**

That assumes the capacitor feeds the load for the whole 10 ms between peaks. In fact the diodes recharge it for the last 2 to 3 ms of every half-cycle, so the scope shows about **1.1 V p-p**: the formula is an upper bound that gets tighter as C grows. The average is the peak (about 16.5 V) minus half the ripple, near **16 V**, and 16 V / 100 Ω = 160 mA agrees. Switch the Rectifier to **Half-wave** and the capacitor is recharged only once per cycle: the ripple more than doubles, to about 2.5 V (ΔV ≈ I/(f·C) is again the upper bound).

**Diode stress.** Each diode carries half the load current on average (75 mA), but the capacitor recharges only near the peaks, so each pulse is several times the DC current. Each diode also blocks about one peak voltage (**17 to 19 V**, see D1 PEAK REVERSE), far below 1000 V. At switch-on the empty 1000 µF looks like a short: **D1 PEAK CURRENT (HOLD)** catches that first gulp of nearly 4 A, well inside the 1N4007's **30 A** surge rating (I_FSM) but several times its 1 A average rating. That is fine for one cycle and fatal if it lasted.`,

  mechanicalAnalogy: `Diodes are check valves, and the bridge is the classic four-check-valve circuit that turns a double-acting piston's back-and-forth flow into one-way flow. The smoothing capacitor is an accumulator that soaks up the pulsation, and ripple is the residual pressure pulsation.

**Where it breaks:** a check valve opens at a fixed cracking pressure, but a diode's current rises exponentially with voltage, so there's no sharp threshold. Diodes also take a moment to stop conducting when reversed (reverse recovery), which matters at high switching frequencies.`,

  proTips: [
    'Rate diodes with margin: V_RRM at least 2× the peak reverse voltage, and average current well inside the rating. Also check I_FSM against the switch-on inrush into your capacitor.',
    'Electrolytic life roughly halves for every 10 °C hotter they run, and ripple current heats them. Check the capacitor’s ripple-current rating, not just its µF and volts.',
    'For low-voltage, high-current outputs, Schottky diodes (1N5819: 1 A, 40 V) drop roughly half a volt or less instead of about 1 V. Above about 1 A, use a packaged bridge (DB107: 1 A, 1000 V; KBP206: 2 A, 600 V) on a proper footprint.',
  ],

  quiz: [
    {
      q: 'A full-wave rectifier on 50 Hz feeds 0.5 A from 2200 µF. Roughly how much ripple?',
      options: ['1.1 V', '2.3 V', '4.5 V', '0.23 V'],
      answer: 1,
      why: 'ΔV = I/(2fC) = 0.5/(100 × 0.0022) = 2.27 V.',
    },
    {
      q: 'A 9 V RMS secondary feeds a bridge. What is the approximate peak DC output (ignoring winding drop)?',
      options: ['9.0 V', '10.3 V', '11.1 V', '12.7 V'],
      answer: 2,
      why: '9 × √2 = 12.73 V peak, minus two drops of about 0.8 V, gives about 11.1 V.',
    },
    {
      q: 'Compared with full-wave, a half-wave rectifier with the same C and load has…',
      options: ['twice the ripple', 'half the ripple', 'the same ripple', 'no ripple'],
      answer: 0,
      why: 'It recharges once per cycle instead of twice, so the capacitor sags for twice as long.',
    },
    {
      q: 'In this bridge, roughly what peak reverse voltage does each diode block?',
      options: ['0.7 V', 'twice the peak (about 38 V)', '1000 V', 'about one secondary peak (17 to 19 V)'],
      answer: 3,
      why: 'When a diode is off, the conducting diodes tie it across the output, which sits near the secondary’s peak, so it blocks about one peak.',
    },
  ],

  behaviors: [{ id: 'ac-meter', instance: 'meter', params: { node: 'dcp', nodeB: 'ac1', refB: 'ac2', source: 'V_SEC' } }],

  sim: { dt: 5e-5, method: 'trap', speed: 0.2 },

  instruments: {
    open: true,
    view: 'scope',
    scope: {
      channels: [
        { label: 'DC OUT', source: { kind: 'voltage', node: 'dcp' }, perDiv: 5, offset: -2 },
        { label: 'AC IN', source: { kind: 'voltage', node: 'ac1', ref: 'ac2' }, perDiv: 5, offset: 0 },
      ],
      timePerDiv: 5e-3,
      trigger: { channel: 1, level: 0, slope: 'rising', mode: 'auto' },
    },
    chart: { signals: [0, 1], span: 1 },
  },
}
