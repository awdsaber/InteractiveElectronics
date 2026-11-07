// T0 · Ohm's Law. Source: docs/curriculum/T0/ohms-law.md
//
// A bench supply (V_PSU with a current limit, iLimit) behind its OUTPUT button (SW_OUT), an
// ammeter in series (P_I) and one 1/4 W resistor. Sweep V and R and watch I follow V/R; push the
// power past 0.25 W and the resistor burns; short the output and the supply folds back into
// constant-current mode instead of reporting hundreds of amps.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

// Bench layout: supply on the left, breadboard in the middle, ammeter on the right.
const BB: [number, number] = [0.0, -1.4]
const PSU_AT: [number, number] = [-5.6, 2.6]
const DMM_AT: [number, number] = [6.4, 0.4]
const DMM_SCALE = 0.5

const r1Top = bbHole(BB, 13, 'c')
const r1Bot = bbHole(BB, 17, 'c')
// supply binding posts (the front edge of the module, 0.16 above the mat) and the ammeter's A and COM jacks
const POST_Y = BENCH_Y + 0.16 + 0.12
const postPlus: [number, number, number] = [PSU_AT[0] + 1.3, POST_Y, PSU_AT[1] + 0.95]
const postMinus: [number, number, number] = [PSU_AT[0] + 0.7, POST_Y, PSU_AT[1] + 0.95]
const jackY = BENCH_Y + (1.5 + 0.19) * DMM_SCALE
const jackA: [number, number, number] = [DMM_AT[0] - 2.0 * DMM_SCALE, jackY, DMM_AT[1] + 5.5 * DMM_SCALE]
const jackCom: [number, number, number] = [DMM_AT[0], jackY, DMM_AT[1] + 5.5 * DMM_SCALE]

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

// supply + → ammeter A jack; ammeter COM → R1's top column; R1's bottom column → supply −
const wPlus = jumper(postPlus, jackA, 'red', 1.1)
const wMeter = jumper(jackCom, bbHole(BB, 13, 'a'), 'yellow', 0.9)
const wMinus = jumper(postMinus, bbHole(BB, 17, 'a'), 'black', 1.3)

export const lesson: LessonDef = {
  id: 'ohms-law',
  track: 'T0',
  title: "Ohm's Law",
  subtitle: 'Volts over ohms',
  tagline: '5 V across a 1 kΩ resistor drives exactly 5 mA; double the volts and the current doubles too.',

  board: {
    name: 'OHM-02',
    size: [17, 9],
    base: 'breadboard-only',
    parts: [
      {
        id: 'psu',
        kind: 'module',
        pos: [PSU_AT[0], BENCH_Y, PSU_AT[1]],
        mount: 'offboard',
        label: 'SUPPLY',
        role: 'Adjustable bench supply, 0–12 V here, with a current limit. The OUTPUT button connects it.',
        params: { title: 'BENCH PSU', color: '#5f6b75', w: 3.8, d: 2.6, pins: 0, chip: 'none', callout: [0, 1.8, 0.2] },
        circuitIds: ['V_PSU', 'SW_OUT'],
      },
      { id: 'post-p', kind: 'testpoint', pos: postPlus, mount: 'offboard', role: 'Supply + output post.', params: { color: 'red' } },
      { id: 'post-n', kind: 'testpoint', pos: postMinus, mount: 'offboard', role: 'Supply − output post.', params: { color: 'black' } },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', label: 'BREADBOARD', role: 'Holds the resistor and meter leads.' },
      {
        id: 'r1',
        kind: 'resistor',
        pos: between(r1Top, r1Bot),
        mount: 'tht',
        label: 'LOAD',
        role: 'The resistance under test: 1 kΩ, 1/4 W metal film, 1 % (brown-black-red). Slide R to swap its value.',
        params: { ohms: 1000, callout: [0.3, 2.0, -0.4] },
        circuitIds: ['R1'],
      },
      {
        id: 'meter',
        kind: 'multimeter',
        pos: [DMM_AT[0], BENCH_Y, DMM_AT[1]],
        mount: 'offboard',
        label: 'AMMETER',
        role: 'In series with the load: all the loop current passes through it. Reads the CURRENT row, auto-ranged (µA, mA or A).',
        params: { readout: 1, autoUnit: true, mode: 'A', title: 'AMMETER', scale: DMM_SCALE, callout: [0, 1.4, 0] },
        circuitIds: ['P_I'],
      },
      {
        id: 'tip',
        kind: 'probe',
        pos: bbHole(BB, 13, 'e'),
        rot: 180,
        mount: 'offboard',
        label: 'VOLTS',
        role: 'Voltmeter tip across the resistor: reads the VOLTAGE row.',
        params: { color: 'red', tilt: 24, callout: [-0.2, 2.2, 0] },
      },
      { id: 'w-plus', kind: 'wire', ...withCallout(wPlus, [0, 0.8, 0.3]), mount: 'offboard', label: 'SUPPLY +', role: 'Supply + to the ammeter.' },
      { id: 'w-meter', kind: 'wire', ...withCallout(wMeter, [0, 0.6, 0.3]), mount: 'offboard', label: 'TO LOAD', role: 'Ammeter COM to the top of the resistor.' },
      { id: 'w-minus', kind: 'wire', ...withCallout(wMinus, [0, 0.8, 0.3]), mount: 'offboard', label: 'SUPPLY −', role: 'Bottom of the resistor back to supply −.' },
    ],
  },

  circuit: {
    elements: [
      // a 0–3 A bench supply in CV mode; the limit is set to 0.6 A, above anything the lesson draws normally
      { id: 'V_PSU', type: 'V', nodes: ['psu_p', '0'], value: 5, rInternal: 0.01, iLimit: 0.6, partId: 'psu' },
      { id: 'SW_OUT', type: 'SW', nodes: ['psu_p', 'out'], closed: true, partId: 'psu' },
      { id: 'P_I', type: 'PROBE', nodes: ['out', 'r_top'], partId: 'meter' },
      { id: 'R1', type: 'R', nodes: ['r_top', '0'], value: 1000, rating: { maxP: 0.25, maxV: 250 }, partId: 'r1' },
    ],
  },
  powerElementId: 'SW_OUT',
  powerLabel: 'Output ON',

  readouts: [
    { label: 'VOLTAGE', source: { kind: 'voltage', node: 'r_top' }, unit: 'V' },
    { label: 'CURRENT', source: { kind: 'current', elementId: 'P_I' }, unit: 'A' },
    { label: 'R1 POWER', source: { kind: 'power', elementId: 'R1' }, unit: 'W' },
    { label: 'SUPPLY CC', source: { kind: 'extra', key: 'V_PSU.cc' }, unit: '', digits: 1 },
  ],

  tweaks: [
    { label: 'Supply voltage', elementId: 'V_PSU', key: 'value', min: 0, max: 12, step: 0.1, unit: 'V' },
    { label: 'Resistance', elementId: 'R1', key: 'value', min: 100, max: 10000, log: true, unit: 'Ω' },
    { label: 'Supply current limit', elementId: 'V_PSU', key: 'iLimit', min: 0.02, max: 0.9, log: true, unit: 'A' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: {0} across R1 drives {1}, so R1 dissipates {2}' },
    { when: { kind: 'above', readout: 3, value: 0.5 }, text: 'CC MODE: the supply is limiting at {1}, so its voltage has folded back to {0}' },
    { when: { kind: 'above', readout: 2, value: 0.25 }, text: 'WARNING: R1 dissipates {2}, over its 0.25 W rating (V²/R is too much)' },
  ],

  failures: [
    {
      id: 'twelve-into-100',
      label: '12 V into 100 Ω',
      explain:
        'I = 12/100 = 120 mA, so P = V²/R = 144/100 = 1.44 W, almost six times the 0.25 W rating. After 300 ms R1 burns open and the current drops to zero. The supply limit (0.6 A) is well above 120 mA, so it does not help.',
      patches: [
        { op: 'set', elementId: 'V_PSU', key: 'value', value: 12 },
        { op: 'set', elementId: 'R1', key: 'value', value: 100 },
      ],
    },
    {
      id: 'wrong-bands',
      label: 'Misread the colour bands (10 Ω fitted instead of 1 kΩ)',
      explain:
        'On a 4-band part brown-black-black is 10 Ω and brown-black-red is 1 kΩ. One band is a factor of 100 in resistance, so 5 V drives 500 mA and 2.5 W into a 1/4 W part, ten times its rating. It burns open.',
      patches: [{ op: 'set', elementId: 'R1', key: 'value', value: 10 }],
    },
    {
      id: 'lead-out',
      label: 'Resistor lead pulls out of the board',
      explain:
        'An open circuit is infinite resistance, so I = V/∞ = 0. The ammeter reads zero, and the supply\'s full 5 V now appears across the gap where the resistor was: no current, no drop in the wire, all the voltage across the break.',
      patches: [{ op: 'remove', elementId: 'R1' }],
      parts: { hide: ['r1'] },
    },
    {
      id: 'short-output',
      label: 'Short the output (wire across the load)',
      explain:
        'With R ≈ 0, Ohm says I = V/R is huge, so a supply with no limit would try for hundreds of amps. This bench supply has its current limit set to 0.6 A: it leaves constant-voltage mode and holds 0.6 A, so its voltage folds back to nearly 0 V and nothing burns. That is why you set the limit before you connect a circuit.',
      patches: [{ op: 'short', a: 'r_top', b: '0' }],
    },
  ],

  meet: `Georg Ohm found that for many materials, current is proportional to voltage:

**V = I · R**

R is the constant of proportionality, in ohms (Ω = V/A). Rearranged, it answers three questions:

- **Current:** I = V/R = 5 V / 1000 Ω = **5 mA**. Raise the supply to 12 V and I = **12 mA**.
- **Resistance:** if 5 V produced 2.1 mA, then R = 5 / 0.0021 ≈ **2.38 kΩ**.
- **Voltage:** 5 mA through 1 kΩ needs V = 0.005 × 1000 = **5 V**.

Plot I against V and you get a straight line through the origin whose slope is 1/R. That is what "ohmic" means. Sweep the supply with the resistor fixed and watch CURRENT track it. LEDs, diodes and lamps don't follow a straight line, which is why later lessons treat them separately.

Ohm's law ignores power, but the resistor can't. Every operating point dissipates P = V·I. At 12 V across 470 Ω, I = 25.5 mA and P = 12 × 0.0255 = **0.31 W**, over the 0.25 W rating even though nothing about the current looks dramatic. With 12 V across anything below about 576 Ω (144 / 0.25) the 1/4 W part is overloaded. Check the power every time you move a slider.

**The supply's current limit.** A bench supply has two modes. Normally it holds the voltage you set (constant voltage, CV). If the load tries to draw more than the limit, it holds the current instead (constant current, CC) and lets the voltage fall. Slide SUPPLY CURRENT LIMIT down to 50 mA with 12 V across 100 Ω: the supply folds back to 5 V (I × R) and R1 stays cool.`,

  mechanicalAnalogy: `A resistor behaves like laminar flow through a long capillary (Hagen–Poiseuille): pressure drop is proportional to flow, Δp = R_hyd·Q. A linear viscous damper is the same idea, F = c·v. Voltage is the pressure difference, current is the flow, and R is the proportionality constant. The supply's current limit is a relief valve on the pump's flow: ask for more flow than it allows and the pressure sags instead.

**Where it breaks:** hydraulic resistance changes a lot with fluid viscosity and goes nonlinear once flow turns turbulent (Δp ∝ Q²). A metal-film resistor stays linear over its whole range and drifts only about 50–100 ppm/°C.`,

  proTips: [
    "Set the bench supply's current limit before you connect a circuit, a little above what you expect to draw. A mistake then becomes a limited current instead of smoke.",
    "Measure resistance only with the circuit unpowered, and lift one leg if you can. Parallel paths on the board make an in-circuit reading low.",
    'Since 1 % metal-film resistors cost about the same as 5 % carbon film, use them by default. Their values usually come from the E96 series.',
  ],

  quiz: [
    {
      q: '9 V across a 4.7 kΩ resistor. What current flows?',
      options: ['1.91 mA', '0.52 mA', '19.1 mA', '42.3 mA'],
      answer: 0,
      why: 'I = 9 / 4700 = 1.91 mA.',
    },
    {
      q: 'You want 10 mA from a 5 V supply through a single resistor. What value?',
      options: ['0.5 Ω', '50 Ω', '5 kΩ', '500 Ω'],
      answer: 3,
      why: 'R = V/I = 5 / 0.010 = 500 Ω (use 470 Ω or 510 Ω, the nearest values in the standard E24 series).',
    },
    {
      q: 'At a fixed voltage the resistance is halved. What happens to the current?',
      options: ['It halves', 'It stays the same', 'It doubles', 'It quadruples'],
      answer: 2,
      why: 'I = V/R, so halving R doubles I (and doubles the power too).',
    },
    {
      q: 'What power does a 470 Ω resistor dissipate on 12 V?',
      options: ['0.031 W', '0.31 W', '0.25 W', '5.6 W'],
      answer: 1,
      why: 'P = V²/R = 144 / 470 = 0.306 W, over a 1/4 W part\'s rating.',
    },
  ],
}
