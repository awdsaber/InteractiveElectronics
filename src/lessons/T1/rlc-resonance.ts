// T1 · RLC Resonance. Source: docs/curriculum/T1/rlc-resonance.md
//
// A function generator drives a series loop: a damping resistor R_D, a 10 mH drum choke (its 10 Ω
// winding is R_DCR) and a 1 µF film capacitor, with the scope's CH1 on the capacitor and CH2 on the
// drive. The generator's step output is a 0 ↔ 5 V square at 50 Hz, so a fresh step arrives every
// 20 ms and the scope keeps showing the ringing while R_D is swept; its sine output (1 V) shows
// resonance. Behaviors: `source-select` is the generator's waveform button (one of two SWs closed),
// `series-rlc` publishes f0, ζ, Q, f_d and the sine gain from the live L, C and loop resistance.
// The sim runs the trapezoidal rule at 4 µs (≈ 157 steps per ringing cycle; backward Euler would damp
// the ringing) in slow motion (×0.01), where a frame costs about 42 steps.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

// Bench layout: the generator behind-left of the breadboard, the two scope probes in the
// back row of the breadboard. Circuit columns (top half, rows a-e): 14 = drive node a (generator +,
// R_D left, CH2), 18 = node b (R_D right, coil), 20 = node d (coil out, C1 top, CH1), 21 = C1 bottom
// (jumpered to the top ground rail).
const BB: [number, number] = [-0.94, 0.6]
const GEN_AT: [number, number] = [-6.4, -3.2]
const GEN_W = 3.4
const GEN_D = 2.4

const rdA = bbHole(BB, 14, 'b')
const rdB = bbHole(BB, 18, 'b')
const lA = bbHole(BB, 18, 'e')
const lB = bbHole(BB, 20, 'e')
const cA = bbHole(BB, 20, 'b')
const cB = bbHole(BB, 21, 'b')

// generator binding posts on the module's front edge (0.16 above the mat, as in the bench supplies)
const POST_Y = BENCH_Y + 0.16 + 0.12
const postPlus: [number, number, number] = [GEN_AT[0] + 1.1, POST_Y, GEN_AT[1] + GEN_D / 2 - 0.25]
const postMinus: [number, number, number] = [GEN_AT[0] + 0.5, POST_Y, GEN_AT[1] + GEN_D / 2 - 0.25]

const wPlus = jumper(postPlus, bbHole(BB, 14, 'd'), 'red', 0.6)
const wMinus = jumper(postMinus, bbHole(BB, 12, '-t'), 'black', 0.6)
const wGnd = jumper(bbHole(BB, 21, 'a'), bbHole(BB, 22, '-t'), 'black', 0.12)
const wLink = jumper(rdA, rdB, 'green', 0.1) // F1: R_D replaced by a wire link

/** the loop resistance outside R_D and R_DCR: generator output 0.05 Ω + two switch contacts 0.05 Ω each */
const R_EXTRA = 0.15

export const lesson: LessonDef = {
  id: 'rlc-resonance',
  track: 'T1',
  title: 'RLC Resonance',
  subtitle: 'Ringing on purpose',
  tagline: '10 mH and 1 µF ring at 1.59 kHz, and 200 Ω of loop resistance is just enough to stop the overshoot.',

  board: {
    name: 'RLC-12',
    size: [14, 8],
    frame: { size: [7.4, 5.2], center: [-2.6, -1.5] }, // generator and loop fill the view; the breadboard's empty front is cropped
    base: 'breadboard-only',
    parts: [
      {
        id: 'gen',
        kind: 'module',
        pos: [GEN_AT[0], BENCH_Y, GEN_AT[1]],
        mount: 'offboard',
        label: 'GENERATOR',
        role: 'Function generator with a buffered, low-impedance output (0.05 Ω here). STEP mode is a 0 ↔ 5 V square wave at 50 Hz, a fresh 5 V step every 20 ms; SINE mode is 1 V peak at an adjustable frequency.',
        params: { title: 'FUNCTION GEN', color: '#4f5d68', w: GEN_W, d: GEN_D, pins: 0, chip: 'none', callout: [-0.4, 1.6, -0.3] },
        circuitIds: ['V_STEP', 'V_SINE', 'SW_STEP', 'SW_SINE', 'SW1'],
      },
      { id: 'post-p', kind: 'testpoint', pos: postPlus, mount: 'offboard', role: 'Generator output.', params: { color: 'red' } },
      { id: 'post-n', kind: 'testpoint', pos: postMinus, mount: 'offboard', role: 'Generator ground.', params: { color: 'black' } },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the series loop.' },
      {
        id: 'rd',
        kind: 'resistor',
        pos: between(rdA, rdB),
        mount: 'tht',
        label: 'DAMP',
        role: 'The damping resistor R_D: 10 Ω, 1/4 W (brown-black-black-gold). It is the dashpot: slide it to set ζ.',
        params: { ohms: 10, callout: [-0.4, 1.5, -0.6] },
        circuitIds: ['R_D'],
      },
      {
        // F1: the damping resistor replaced by a wire link
        id: 'rd-link',
        kind: 'wire',
        ...wLink,
        mount: 'offboard',
        role: 'A wire link where the damping resistor was: only the coil’s own 10 Ω is left to damp the loop.',
        hidden: true,
      },
      {
        id: 'l1',
        kind: 'inductor',
        pos: between(lA, lB),
        mount: 'tht',
        label: 'COIL',
        role: '10 mH radial drum choke, about 10 Ω of winding resistance (DCR) and about 0.1 A rated. It is the mass: it stores energy in its current, ½LI².',
        params: { marking: '10mH', callout: [0.3, 1.8, 0.9] },
        circuitIds: ['L1', 'R_DCR'],
      },
      {
        id: 'c1',
        kind: 'capacitor-ceramic',
        pos: between(cA, cB),
        mount: 'tht',
        label: 'FILM CAP',
        role: '1 µF polyester film capacitor, 63 V (code 105). It is the spring: it stores energy in its voltage, ½CV².',
        color: '#b8452f',
        params: { farads: 1e-6, code: '105', callout: [0.9, 1.5, -0.7] },
        circuitIds: ['C1'],
      },
      {
        id: 'ch1',
        kind: 'probe',
        pos: bbHole(BB, 20, 'a'),
        rot: 180,
        mount: 'offboard',
        label: 'CH1 · V_C',
        role: 'Scope channel 1 on the capacitor (node d): the "displacement".',
        params: { color: 'yellow', tilt: 22, callout: [1.2, 1.1, -0.8] },
      },
      {
        id: 'ch2',
        kind: 'probe',
        pos: bbHole(BB, 14, 'a'),
        rot: 180,
        mount: 'offboard',
        label: 'CH2 · DRIVE',
        role: 'Scope channel 2 on the generator output (node a): the applied "force".',
        params: { color: 'blue', tilt: 22, callout: [-1.2, 1.1, -0.8] },
      },
      { id: 'w-plus', kind: 'wire', ...wPlus, mount: 'offboard', role: 'Generator output to the drive column.' },
      { id: 'w-minus', kind: 'wire', ...wMinus, mount: 'offboard', role: 'Generator ground to the top ground rail.' },
      { id: 'w-gnd', kind: 'wire', ...wGnd, mount: 'offboard', role: 'Capacitor’s lower lead to ground.' },
    ],
  },

  circuit: {
    elements: [
      // the generator: two outputs behind a waveform selector (source-select), then OUTPUT (SW1)
      { id: 'V_STEP', type: 'V', nodes: ['gq', '0'], value: 0, wave: { kind: 'square', amp: 2.5, offset: 2.5, freq: 50 }, rInternal: 0.05, partId: 'gen' },
      { id: 'V_SINE', type: 'V', nodes: ['gs', '0'], value: 0, wave: { kind: 'sine', amp: 1, freq: 1592 }, rInternal: 0.05, partId: 'gen' },
      { id: 'SW_STEP', type: 'SW', nodes: ['gq', 'sup'], closed: true, partId: 'gen' },
      { id: 'SW_SINE', type: 'SW', nodes: ['gs', 'sup'], closed: false, partId: 'gen' },
      // `closed: true`: the bench opens the power element until "Generator output ON"
      { id: 'SW1', type: 'SW', nodes: ['sup', 'a'], closed: true, partId: 'gen' },
      { id: 'R_D', type: 'R', nodes: ['a', 'b'], value: 10, rating: { maxP: 0.25, rmsWindow: 0.1 }, partId: 'rd' },
      // a choke's current rating is a heating limit, so it is RMS over 0.1 s
      { id: 'L1', type: 'L', nodes: ['b', 'c'], value: 0.01, i0: 0, rating: { maxI: 0.1, rmsWindow: 0.1 }, partId: 'l1' },
      { id: 'R_DCR', type: 'R', nodes: ['c', 'd'], value: 10, partId: 'l1' },
      { id: 'C1', type: 'C', nodes: ['d', '0'], value: 1e-6, v0: 0, rating: { maxV: 63 }, partId: 'c1' },
    ],
  },
  powerElementId: 'SW1',
  powerLabel: 'Generator output ON',

  readouts: [
    { label: 'CAP VOLTAGE', source: { kind: 'voltage', node: 'd' }, unit: 'V' },
    { label: 'COIL CURRENT', source: { kind: 'current', elementId: 'L1' }, unit: 'A' },
    { label: 'PEAK V_C (HOLD)', source: { kind: 'voltage', node: 'd' }, unit: 'V', peak: true },
    { label: 'f₀ = 1/(2π√LC)', source: { kind: 'behavior', key: 'rlc.f0' }, unit: 'Hz' },
    { label: 'ζ = (R/2)·√(C/L)', source: { kind: 'behavior', key: 'rlc.zeta' }, unit: '', digits: 3 },
    { label: 'RING FREQ f₀√(1−ζ²)', source: { kind: 'behavior', key: 'rlc.fd' }, unit: 'Hz' },
    { label: 'Q = Z₀/R', source: { kind: 'behavior', key: 'rlc.q' }, unit: '', digits: 3 },
    { label: 'SINE GAIN |V_C/V_in|', source: { kind: 'behavior', key: 'rlc.gain' }, unit: '', digits: 3 },
  ],

  tweaks: [
    { label: 'Damping resistor', elementId: 'R_D', key: 'value', min: 0, max: 470, step: 1, unit: 'Ω' },
    {
      label: 'Generator waveform',
      elementId: 'behavior:drive',
      key: 'mode',
      kind: 'enum',
      min: 0,
      max: 1,
      unit: '',
      options: [
        { label: '5 V step', value: 0 },
        { label: '1 V sine', value: 1 },
      ],
    },
    { label: 'Sine frequency', elementId: 'V_SINE', key: 'wave.freq', min: 200, max: 10000, log: true, unit: 'Hz' },
    { label: 'Capacitance', elementId: 'C1', key: 'value', min: 1e-7, max: 1e-5, log: true, unit: 'F' },
    { label: 'Inductance', elementId: 'L1', key: 'value', min: 0.001, max: 0.1, log: true, unit: 'H' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: the generator drives the loop; watch CH1 (V_C) on the scope' },
    { when: { kind: 'below', readout: 4, value: 0.97 }, text: 'UNDERDAMPED: ζ = {4}, so each step overshoots (peak so far {2}) and rings at {5}; a sine near {3} is amplified about Q = {6} times' },
    { when: { kind: 'above', readout: 4, value: 0.97 }, text: 'CRITICALLY DAMPED: ζ = {4} ≈ 1, the fastest rise with no overshoot' },
    { when: { kind: 'above', readout: 4, value: 1.05 }, text: 'OVERDAMPED: ζ = {4}. No overshoot, but V_C creeps up to 5 V more slowly than it has to' },
    { when: { kind: 'state', is: 'READY' }, text: 'OUTPUT OFF: press Generator output ON and watch the scope' },
    { when: { kind: 'state', is: 'FAULT' }, text: 'FAULT: a part failed and the loop is broken; repair to try again' },
  ],

  failures: [
    {
      id: 'no-damping',
      label: 'Take the damping resistor out',
      explain:
        'Only the coil’s own 10 Ω is left: R_total ≈ 10.2 Ω, so ζ ≈ 0.05 and Q ≈ 10. The first peak is 5 × (1 + e^(−πζ/√(1−ζ²))) ≈ 9.3 V, nearly twice the supply, and the ringing lasts more than ten cycles, because almost nothing absorbs the energy as it sloshes between L and C.',
      patches: [
        { op: 'set', elementId: 'R_D', key: 'value', value: 0 },
        { op: 'set', elementId: 'behavior:drive', key: 'mode', value: 0 },
      ],
      parts: { hide: ['rd'], show: ['rd-link'] },
    },
    {
      id: 'hot-plug-12v',
      label: 'Hot-plug 12 V into a 16 V ceramic filter',
      explain:
        'With no damping resistor a 12 V step overshoots toward 12 × 1.85 ≈ 22 V, and the 16 V ceramic fails on overvoltage within the first half-cycle. Ceramic capacitors usually fail short, so the loop then becomes the coil alone across 12 V: about 1.2 A through a 0.1 A choke, which burns open a moment later. An undamped LC input filter nearly doubles a step: a "12 V" rail with a 16 V capacitor is a classic hot-plug failure. Real designs add damping (for example an electrolytic with some ESR across the line) or a TVS diode, and rate the capacitor for the overshoot.',
      patches: [
        { op: 'set', elementId: 'R_D', key: 'value', value: 0 },
        { op: 'set', elementId: 'V_STEP', key: 'wave.amp', value: 6 },
        { op: 'set', elementId: 'V_STEP', key: 'wave.offset', value: 6 },
        { op: 'set', elementId: 'C1', key: 'rating.maxV', value: 16 },
        { op: 'set', elementId: 'C1', key: 'rating.failMode', value: 'short' }, // a cracked MLCC fails short
        { op: 'set', elementId: 'behavior:drive', key: 'mode', value: 0 },
      ],
      parts: { hide: ['rd'], show: ['rd-link'] },
    },
    {
      id: 'cap-short',
      label: 'The capacitor fails short',
      explain:
        'Without C nothing opposes DC, so the loop is a plain RL: every 5 V half of the square pushes I = 5/20.2 ≈ 248 mA through the coil (it settles in a few L/R = 0.5 ms time constants). That is about 175 mA RMS through a choke rated for 100 mA, so the winding overheats and burns open in well under a second; the 1/4 W damping resistor (≈ 0.31 W average) would have been next.',
      patches: [
        { op: 'short', a: 'd', b: '0' },
        { op: 'set', elementId: 'behavior:drive', key: 'mode', value: 0 },
      ],
    },
  ],

  meet: `Put L and C in one loop and energy swaps between the coil's current (½LI²) and the capacitor's voltage (½CV²). The swap has a natural rate:

**f₀ = 1 / (2π√(LC))** = 1 / (2π√(0.01 × 10⁻⁶)) = 1 / (2π × 10⁻⁴) ≈ **1592 Hz**

The ratio of voltage to current in that swap is the **characteristic impedance**, Z₀ = √(L/C) = √(10⁴) = **100 Ω**. Compare the loop's resistance with it:

- **ζ = R/(2Z₀) = (R/2)·√(C/L)**, and **Q = Z₀/R = 1/(2ζ)**.
- Here R_total = 10 (R_D) + 10 (the coil's winding) + 0.15 (generator and contacts) ≈ 20 Ω, so ζ ≈ **0.10** and Q ≈ **5**.

**Step response.** Press **Generator output ON**. The generator's STEP output is a 0 ↔ 5 V square wave at 50 Hz, so a fresh step arrives every 20 ms and the scope (slowed to ×0.01) catches each one. With ζ < 1 the capacitor overshoots by e^(−πζ/√(1−ζ²)) = e^(−0.32) ≈ 0.73 of the step, so V_C peaks near 5 × 1.73 ≈ **8.6 V**: more than the supply, from a passive circuit. The coil current peaks at about **43 mA**. The ringing runs at f₀√(1 − ζ²) ≈ 1583 Hz, nearly f₀ when damping is light, and each overshoot is about half the one before. Q is roughly the number of cycles it takes the ringing to fall to e^(−π) ≈ 4 %.

**Sweep the damping resistor.** Slide R_D up and watch ζ cross 1 on the scope. At R_D ≈ **190 Ω** (R_total = 2Z₀ = **200 Ω**) the loop is critically damped: the fastest rise with no overshoot. Above that it is overdamped and creeps up slowly. Every falling edge rings too, the same way down.

**Resonance.** Switch the generator to **1 V sine** and slide its frequency through f₀. Far below f₀, V_C just follows the input; far above, the coil blocks the current and V_C shrinks as (f₀/f)². At f₀ the reactances of L and C cancel, only R limits the current (1 V / 20 Ω = 50 mA), and V_C swings **Q ≈ 5 times** the input: ±5 V out of ±1 V in.`,

  mechanicalAnalogy: `This is your mass–spring–damper with different labels. **L is the mass m, 1/C is the stiffness k, and R is the damper c.** The drive voltage is the applied force, the current is the velocity, and the charge on the capacitor (q = C·V_C) is the displacement, so V_C reads displacement. ωₙ = √(k/m) maps to 1/√(LC), and ζ = c/(2√(km)) maps to (R/2)√(C/L). A step in voltage is a step force: an underdamped mass overshoots its new rest position and rings, a critically damped one settles fastest without overshoot, and resonance under a sine force is the same Q-fold amplification.

**Where it breaks:** real parts carry parasitics. An inductor's winding capacitance gives it a self-resonant frequency above which it stops behaving as an inductor, and core losses add damping that rises with frequency. Electrical Q factors of 100 or more are routine, far higher than most structures reach.`,

  proTips: [
    'LC input filters on power entry can ring and overshoot when hot-plugged. Damp them, and choose capacitor ratings for the overshoot, not the nominal rail.',
    'A scope probe’s long ground lead is an inductor, roughly 1 nH per mm. Together with the probe’s capacitance it rings on fast edges, so use the short ground spring for anything fast.',
    'Resonance moves with tolerance. Because f₀ ∝ 1/√(LC), a 10 % change in the L·C product shifts f₀ by about 5 %. Pick tight-tolerance parts (film or C0G capacitors) for tuned circuits.',
    'A typical lab function generator has a 50 Ω output impedance, and it is part of the loop: on this board it would add 50 Ω and take ζ from 0.10 to 0.35.',
  ],

  quiz: [
    {
      q: 'What is the resonant frequency of 100 µH with 100 nF?',
      options: ['50.3 kHz', '5.03 kHz', '15.9 kHz', '159 kHz'],
      answer: 0,
      why: '√(10⁻⁴ × 10⁻⁷) = 3.16 µs, so f₀ = 1/(2π × 3.16 µs) ≈ 50.3 kHz.',
    },
    {
      q: 'What total series resistance critically damps 10 mH with 1 µF?',
      options: ['20 Ω', '100 Ω', '200 Ω', '1 kΩ'],
      answer: 2,
      why: 'R = 2√(L/C) = 2 × 100 = 200 Ω.',
    },
    {
      q: 'On this board, R_total is raised to 50 Ω. What is Q?',
      options: ['0.5', '2', '5', '10'],
      answer: 1,
      why: 'Q = Z₀/R = 100/50 = 2.',
    },
    {
      q: 'An undamped series LC is hit with a 5 V step. What is the highest the capacitor voltage can reach?',
      options: ['5 V', '7.1 V', 'Unlimited', '10 V'],
      answer: 3,
      why: 'As ζ → 0 the overshoot approaches 100 %, so the peak approaches 2 × 5 = 10 V.',
    },
  ],

  behaviors: [
    { id: 'source-select', instance: 'drive', params: { mode: 0, switches: 'SW_STEP,SW_SINE' } },
    { id: 'series-rlc', instance: 'rlc', params: { l: 'L1', c: 'C1', r: 'R_D,R_DCR', rExtra: R_EXTRA, sine: 'V_SINE' } },
  ],

  sim: { dt: 4e-6, method: 'trap', speed: 0.01 },

  instruments: {
    open: true,
    view: 'scope',
    scope: {
      channels: [
        { label: 'V_C', source: { kind: 'voltage', node: 'd' }, perDiv: 2, offset: -1, marks: [{ value: 5, label: 'FINAL 5 V' }] },
        { label: 'DRIVE', source: { kind: 'voltage', node: 'a' }, perDiv: 2, offset: -1 },
      ],
      timePerDiv: 0.5e-3,
      trigger: { channel: 1, level: 0.5, slope: 'rising', mode: 'auto' },
    },
    chart: { signals: [0, 1], span: 0.05 },
  },
}
