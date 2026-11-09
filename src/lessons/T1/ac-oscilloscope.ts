// T1 · AC and the Oscilloscope. Source: docs/curriculum/T1/ac-oscilloscope.md
//
// A function generator (V.wave sine, 5 V peak, 50 Hz, 50 Ω output) drives a 3.3 kΩ / 1 µF RC low-pass
// on a breadboard; two ×10 probes watch the filter input (CH1) and output (CH2). The instrument panel
// opens with the 2-channel scope already set up: 2 V/div, 5 ms/div, rising edge trigger at 0 V on CH1.
// The `ac-meter` behavior supplies the measurements a scope's menu would (Vpp, RMS, gain, phase).
//
// Maths. CH1 is the node after the generator's 50 Ω, so the CH1 -> CH2 response is R1 and C1 alone:
// f_c = 1/(2π·3300·1 µ) = 48.2 Hz; at 50 Hz X_C = 3183 Ω, |H| = 3183/√(3300² + 3183²) = 0.694,
// φ = −atan(3300/3183) = −46.0°. (Measured from the generator's EMF the 50 Ω would make it 47.5 Hz / −46.5°.)
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

const BB: [number, number] = [-1.0, 0.2]
const GEN_AT: [number, number] = [-2.2, -4.5]
const GEN_TOP = BENCH_Y + 0.17 // the generator board's upper face

// breadboard columns: 9 = filter input, 13 = filter output, 14 = ground
const inHole = bbHole(BB, 9, 'c')
const outHole = bbHole(BB, 13, 'c')
const gndHole = bbHole(BB, 14, 'd')

// the generator's two output posts, on its front edge
const genSig: [number, number, number] = [GEN_AT[0] - 0.5, GEN_TOP, GEN_AT[1] + 0.9]
const genGnd: [number, number, number] = [GEN_AT[0] + 0.5, GEN_TOP, GEN_AT[1] + 0.9]

const wSig = jumper(genSig, bbHole(BB, 9, 'a'), 'orange', 0.5)
const wGnd = jumper(genGnd, bbHole(BB, 14, 'a'), 'black', 0.9)

/** R1: 1/4 W carbon film, 0.25 W at 70 °C derated to zero at 155 °C → 340 °C/W (as in T0/power-heat) */
const R1_RATING = { maxP: 0.25, maxV: 250, rth: 340, tauTh: 5, tMax: 155 }

export const lesson: LessonDef = {
  id: 'ac-oscilloscope',
  track: 'T1',
  title: 'AC and the Oscilloscope',
  subtitle: 'Seeing voltage over time',
  tagline: 'A 10 V peak-to-peak, 50 Hz sine is 3.54 V RMS, and a 3.3 kΩ / 1 µF low-pass passes only about 69% of it.',

  board: {
    name: 'SCOPE-13',
    size: [14, 9],
    frame: { size: [7.2, 5.2], center: [-0.9, -1.5] }, // the generator and the filter fill the view; the breadboard runs off the edge
    base: 'breadboard-only',
    parts: [
      {
        id: 'gen',
        kind: 'module',
        pos: [GEN_AT[0], BENCH_Y, GEN_AT[1]],
        mount: 'offboard',
        label: 'GENERATOR',
        role: 'A function generator set to a 5 V peak, 50 Hz sine, with a 50 Ω output resistance.',
        color: '#1f6a73',
        params: { w: 3.4, d: 2.2, pins: 0, chip: 'none', title: 'FUNCTION GEN', callout: [-1.4, 1.2, -0.4] },
        circuitIds: ['V_GEN', 'SW_OUT'],
      },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the filter.' },
      {
        id: 'r1',
        kind: 'resistor',
        pos: between(inHole, outHole),
        mount: 'tht',
        label: 'FILTER',
        role: 'The series element of the low-pass: 3.3 kΩ, 1/4 W (orange-orange-red-gold).',
        params: { ohms: 3300, callout: [0, 1.5, -0.9] },
        circuitIds: ['R1'],
      },
      {
        id: 'c1',
        kind: 'capacitor-ceramic',
        pos: between(bbHole(BB, 13, 'd'), gndHole),
        mount: 'tht',
        label: 'FILM',
        role: 'The shunt element: 1 µF, 63 V. Its reactance falls as the frequency rises.',
        color: '#d9a441',
        params: { farads: 1e-6, code: '105', callout: [0.6, 1.4, 0.7] },
        circuitIds: ['C1'],
      },
      {
        // F3: a 47 Ω load clipped across the generator output
        id: 'rx',
        kind: 'resistor',
        pos: between(bbHole(BB, 9, 'b'), bbHole(BB, 14, 'b')),
        mount: 'tht',
        label: 'LOAD',
        role: '47 Ω (yellow-violet-black-gold) across the filter input: about as heavy as the generator’s own output resistance.',
        params: { ohms: 47, span: 1.27, callout: [0, 1.2, 1.0] },
        hidden: true,
      },
      {
        id: 'ch1',
        kind: 'probe',
        pos: bbHole(BB, 9, 'e'),
        rot: 0,
        mount: 'offboard',
        label: 'CH1',
        role: '×10 probe on the filter input (yellow trace).',
        params: { color: 'yellow', tilt: 24, callout: [-1.7, 1.0, -0.9] },
      },
      {
        id: 'ch2',
        kind: 'probe',
        pos: bbHole(BB, 13, 'e'),
        rot: 0,
        mount: 'offboard',
        label: 'CH2',
        role: '×10 probe on the filter output (cyan trace).',
        params: { color: '#2fb7c9', tilt: 24, callout: [-1.5, 1.0, -0.9] },
      },
      { id: 'w-sig', kind: 'wire', ...wSig, mount: 'offboard', role: 'Generator output to the filter input.' },
      { id: 'w-gnd', kind: 'wire', ...wGnd, mount: 'offboard', role: 'Generator ground to the ground column.' },
    ],
  },

  circuit: {
    elements: [
      // 5 V peak behind 50 Ω; the 50 Ω is the generator's output resistance
      { id: 'V_GEN', type: 'V', nodes: ['gen', '0'], value: 0, rInternal: 50, wave: { kind: 'sine', amp: 5, freq: 50, offset: 0 }, partId: 'gen' },
      // `closed: true`: the bench opens the power element until "Generator output ON"
      { id: 'SW_OUT', type: 'SW', nodes: ['gen', 'in'], closed: true, partId: 'gen' },
      { id: 'R1', type: 'R', nodes: ['in', 'out'], value: 3300, rating: R1_RATING, partId: 'r1' },
      { id: 'C1', type: 'C', nodes: ['out', '0'], value: 1e-6, rating: { maxV: 63 }, partId: 'c1' },
    ],
  },
  powerElementId: 'SW_OUT',
  powerLabel: 'Generator output ON',

  readouts: [
    { label: 'IN Vpp', source: { kind: 'behavior', key: 'ac.vpp' }, unit: 'V' },
    { label: 'IN RMS', source: { kind: 'behavior', key: 'ac.acrms' }, unit: 'V' },
    { label: 'OUT RMS', source: { kind: 'behavior', key: 'ac.acrmsB' }, unit: 'V' },
    { label: 'GAIN', source: { kind: 'behavior', key: 'ac.gainPct' }, unit: '%' },
    { label: 'FREQUENCY', source: { kind: 'behavior', key: 'ac.freq' }, unit: 'Hz' },
    { label: 'PERIOD', source: { kind: 'behavior', key: 'ac.period' }, unit: 's' },
    { label: 'PHASE', source: { kind: 'behavior', key: 'ac.phase' }, unit: '°' },
  ],

  behaviors: [{ id: 'ac-meter', instance: 'ac', params: { source: 'V_GEN', a: 'in', b: 'out' } }],

  // 20 µs would be T/100 at 500 Hz; 50 µs still gives 40 points a cycle there and 400 at 50 Hz.
  // Slow motion (×0.1) keeps the scope sweeping at a watchable rate and the sim well inside its frame budget.
  sim: { dt: 50e-6, speed: 0.1, method: 'trap' },

  instruments: {
    open: true,
    view: 'scope',
    scope: {
      channels: [
        { label: 'IN', source: { kind: 'voltage', node: 'in' }, perDiv: 2, offset: 0 },
        { label: 'OUT', source: { kind: 'voltage', node: 'out' }, perDiv: 2, offset: 0 },
      ],
      timePerDiv: 5e-3,
      trigger: { channel: 0, level: 0, slope: 'rising', mode: 'auto' },
    },
  },

  tweaks: [
    { label: 'Frequency', elementId: 'V_GEN', key: 'wave.freq', min: 5, max: 500, log: true, unit: 'Hz' },
    { label: 'Amplitude (peak)', elementId: 'V_GEN', key: 'wave.amp', min: 0.5, max: 10, step: 0.1, unit: 'V' },
    { label: 'Filter resistor', elementId: 'R1', key: 'value', min: 330, max: 33000, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'RUNNING: {4} sine, {0} peak-to-peak at the filter input; the output is {2} RMS, {3} of the input, {6} behind' },
    { when: { kind: 'above', readout: 4, value: 100 }, text: 'ABOVE THE CUTOFF: at {4} the capacitor shorts the signal, so the output is only {3} of the input and lags {6}' },
    { when: { kind: 'state', is: 'READY' }, text: 'GENERATOR OFF: no signal; press "Generator output ON" and watch the scope' },
    { when: { kind: 'state', is: 'FAULT' }, text: 'FAULT: a part burnt open and the filter is no longer fed' },
  ],

  failures: [
    {
      id: 'dc-offset',
      label: 'Add a 3 V DC offset',
      explain:
        'Both traces lift by 3 V. The output’s DC level passes at 100 % while its AC part is still cut to 69 % (GAIN and the RMS readouts count only the AC part). At DC the capacitor’s reactance is infinite, so it takes no current and the "filter" passes DC untouched. On a real scope, AC coupling would hide the offset and DC coupling shows it.',
      patches: [{ op: 'set', elementId: 'V_GEN', key: 'wave.offset', value: 3 }],
    },
    {
      id: 'fast',
      label: 'Turn the frequency up to 500 Hz',
      explain:
        'X_C = 1/(2π × 500 × 1 µ) = 318 Ω, now far below R. |H| = 318/√(3300² + 318²) ≈ 0.096, so OUT RMS falls to about 0.33 V and the phase lag approaches −90° (−84.5° here). At 5 ms/div the sweep now holds 25 cycles; turn the time/div down to 0.5 ms to see them again.',
      patches: [{ op: 'set', elementId: 'V_GEN', key: 'wave.freq', value: 500 }],
    },
    {
      id: 'load-47',
      label: 'Load the generator with 47 Ω',
      explain:
        'The generator is 5 V behind 50 Ω, so a 47 Ω load gives 5 × 47/97 = 2.4 V peak, and CH1 falls to half. Bench generators label their amplitude assuming either a 50 Ω load or an open circuit (high-Z). Know which is set, or every voltage you dial in is off by a factor of two.',
      patches: [{ op: 'add', element: { id: 'R_X', type: 'R', nodes: ['in', '0'], value: 47, rating: { maxP: 0.25 }, partId: 'rx' } }],
      parts: { show: ['rx'] },
    },
  ],

  meet: `An AC voltage repeats: v(t) = V_p·sin(2πft + φ). Here **V_p = 5 V**, so V_pp = 10 V. The period is T = 1/f = 1/50 = **20 ms**. Press **Generator output ON**: the Instruments panel is already open on the scope, with CH1 (yellow) on the filter input and CH2 (cyan) on the output.

**RMS** is the DC voltage that would heat a resistor equally. For a sine, V_rms = V_p/√2 = 5/1.414 = **3.54 V**. A meter shows RMS; a scope shows the shape.

A capacitor's opposition to AC is its **reactance**, X_C = 1/(2πfC). At 50 Hz, X_C = 1/(2π × 50 × 10⁻⁶) = **3183 Ω**, about the same as R1. The RC divider's gain and phase are

|H| = X_C / √(R² + X_C²) = 3183 / √(3300² + 3183²) = **0.69**, φ = −arctan(R/X_C) = **−46°**

So CH2 is about 2.4 V RMS and crosses zero 46/360 × 20 ms ≈ **2.6 ms** after CH1. The cutoff, where |H| = 0.707 and φ = −45°, is f_c = 1/(2πRC) = **48.2 Hz**. Slide **Frequency** to find it: far below it CH2 tracks CH1, far above it CH2 shrinks and lags towards 90°.

**Scope basics.**

- **Volts/div** sets the vertical scale: at 2 V/div, a 10 V_pp sine spans five divisions.
- **Time/div** sets the horizontal scale: at 5 ms/div, one 50 Hz period spans four divisions.
- The **trigger** starts each sweep at the same point on the wave (here a rising edge through 0 V on CH1), which is what makes the trace stand still. Try moving its level, or running at a frequency where the sweep holds many cycles.

The sim runs at a tenth of real time and steps every 50 µs (trapezoidal), so a 500 Hz cycle still has 40 points on the trace.`,

  mechanicalAnalogy: `This is a frequency-response test on a shaker table. A first-order system, such as a spring driving a damper, follows slow inputs faithfully, attenuates fast ones and lags by up to 90°. That is exactly the RC low-pass. The scope is your accelerometer-plus-DAQ, and the trigger is the tach pulse that lines up each revolution.

**Where it breaks:** a mechanical first-order system is usually an approximation of something higher order. An RC network really is first order (until parasitics appear), so its Bode plot matches the formula to the decibel.`,

  proTips: [
    'Use ×10 probes and compensate them first on the scope’s built-in square-wave output. An uncompensated probe distorts every edge you look at.',
    'A bench scope’s ground clip is tied to mains earth. Clipping it to a non-earth-referenced node of mains-powered gear creates a short through the earth wire. Use a differential probe or an isolated supply.',
    'Cheap meters assume a sine when they show RMS. For PWM, triangle or distorted waveforms, use a "true RMS" meter or the scope’s RMS measurement.',
  ],

  quiz: [
    {
      q: 'UK mains is 230 V RMS. What is its peak voltage?',
      options: ['325 V', '163 V', '230 V', '460 V'],
      answer: 0,
      why: 'V_p = √2 × 230 = 325 V.',
    },
    {
      q: 'What is the period of a 60 Hz signal?',
      options: ['6.0 ms', '16.7 ms', '20.0 ms', '60.0 ms'],
      answer: 1,
      why: 'T = 1/60 = 16.7 ms.',
    },
    {
      q: 'What is the reactance of a 1 µF capacitor at 1 kHz?',
      options: ['1.59 Ω', '15.9 Ω', '1.59 kΩ', '159 Ω'],
      answer: 3,
      why: 'X_C = 1/(2π × 1000 × 10⁻⁶) = 159 Ω.',
    },
    {
      q: 'What does the scope’s trigger do?',
      options: ['Sets the vertical gain', 'Removes the DC component', 'Starts each sweep at the same point on the waveform, so repeated sweeps overlay', 'Measures RMS'],
      answer: 2,
      why: 'Without a consistent start point, each sweep lands at a different phase and the trace smears.',
    },
  ],
}
