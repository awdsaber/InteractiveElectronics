// T0 · Power and Heat. Source: docs/curriculum/T0/power-heat.md
//
// No behavior is needed: the engine's own thermal rating on R1 (rth / tauTh / tMax) integrates
// Tj = T_amb + P·θ with a first-order lag, publishes `R1.tj`, and burns the part when Tj passes
// tMax. The board draws the body glowing orange as it heats (Board.partState).
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

// Bench: ammeter at the left, breadboard centre, bench supply behind.
const BB: [number, number] = [2.0, 0.3]
const PSU_AT: [number, number] = [-4.3, 1.9]
const METER_AT: [number, number] = [-4.3, -2.0]
const METER_SCALE = 0.3

const r1Left = bbHole(BB, 8, 'f')
const r1Right = bbHole(BB, 12, 'f')

/** a meter jack's top, for the wires: jacks sit at (-2, 0, +2) × 5.5 along the meter's front edge */
const jack = (x: number): [number, number, number] => [METER_AT[0] + x * METER_SCALE, BENCH_Y + 1.72 * METER_SCALE, METER_AT[1] + 5.5 * METER_SCALE]
/** supply terminals: along the module's back edge, toward the meter */
const psuTerm = (x: number): [number, number, number] => [PSU_AT[0] + x, BENCH_Y + 0.75, PSU_AT[1] - 0.8]

const wPsuToMeter = jumper(psuTerm(-0.8), jack(-2.0), 'red', 0.45)
const wMeterToBb = jumper(jack(0), bbHole(BB, 8, 'j'), 'orange', 0.4)
const wBbToGnd = jumper(bbHole(BB, 12, 'j'), bbHole(BB, 14, '-b'), 'black', 0.25)
const wGndToPsu = jumper(bbHole(BB, 3, '-b'), psuTerm(0.8), 'black', 0.45)

/** R1: a 1/4 W carbon-film axial (Yageo CFR-25 class): 0.25 W at 70 °C ambient, derated linearly
 * to zero at 155 °C. θ = (155 − 70)/0.25 = 340 °C/W, so Tj = 25 + 340·P on a 25 °C bench.
 * tauTh is time-compressed (a real body settles in tens of seconds). */
const R1_RATING = { maxP: 0.25, maxV: 250, rth: 340, tauTh: 5, tMax: 155 }

export const lesson: LessonDef = {
  id: 'power-heat',
  track: 'T0',
  title: 'Power and Heat',
  subtitle: 'Where the watts go',
  tagline: 'A 47 Ω resistor across 5 V turns 0.53 W into heat, more than twice what a 1/4 W part is rated for.',

  board: {
    name: 'HEAT-03',
    size: [13.5, 9.2],
    base: 'breadboard-only',
    frame: { size: [10.5, 6.4], center: [-0.2, 0.2] },
    parts: [
      {
        id: 'psu',
        kind: 'module',
        pos: [PSU_AT[0], BENCH_Y, PSU_AT[1]],
        mount: 'offboard',
        label: 'SUPPLY',
        role: 'Adjustable DC supply, 5 V to start. Turn it up with the voltage slider.',
        params: { w: 4.2, d: 1.8, title: 'BENCH PSU', pins: 0, callout: [0, 1.4, -0.6] },
        circuitIds: ['V_PSU', 'SW_OUT'],
      },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', label: 'BREADBOARD', role: 'Holds the resistor.' },
      {
        id: 'r1',
        kind: 'resistor',
        pos: between(r1Left, r1Right),
        mount: 'tht',
        label: 'HOT',
        role: 'The part we deliberately heat: 220 Ω, 1/4 W carbon film (red-red-brown-gold). Its body glows as it heats.',
        params: { ohms: 220, callout: [0.2, 2.3, -0.4] },
        circuitIds: ['R1'],
      },
      {
        // F3: a 2 W resistor, drawn as a metal-film part in the same holes
        id: 'r1big',
        kind: 'resistor',
        pos: between(r1Left, r1Right),
        mount: 'tht',
        label: '2 W',
        role: 'A 2 W resistor: a bigger body sheds heat to the air far more easily (42.5 °C/W).',
        params: { ohms: 47, film: 'metal', callout: [0.2, 2.3, -0.4] },
        circuitIds: ['R1'],
        hidden: true,
      },
      {
        id: 'meter',
        kind: 'multimeter',
        pos: [METER_AT[0], BENCH_Y, METER_AT[1]],
        mount: 'offboard',
        label: 'AMMETER',
        role: 'In series with the resistor: reads the loop current.',
        params: { unit: 'A', mode: 'A', readout: 0, scale: METER_SCALE, title: 'AMMETER', callout: [0, 1.6, 0] },
        circuitIds: ['P_I'],
      },
      {
        id: 'tc',
        kind: 'probe',
        pos: [(r1Left[0] + r1Right[0]) / 2 + 0.05, r1Left[1] + 0.3, (r1Left[2] + r1Right[2]) / 2 + 0.05],
        rot: 200,
        mount: 'offboard',
        label: 'TEMP',
        role: 'Thermocouple tip on the resistor body. The BODY TEMP readout is its reading.',
        params: { color: '#d9a21b', tilt: 25, callout: [1.0, 0.6, 2.2] },
      },
      { id: 'w1', kind: 'wire', ...wPsuToMeter, mount: 'offboard', role: 'Supply positive to the ammeter.' },
      { id: 'w2', kind: 'wire', ...wMeterToBb, mount: 'offboard', role: 'Ammeter out to the resistor.' },
      { id: 'w3', kind: 'wire', ...wBbToGnd, mount: 'offboard', role: 'Resistor to the ground rail.' },
      { id: 'w4', kind: 'wire', ...wGndToPsu, mount: 'offboard', role: 'Ground rail back to the supply.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_PSU', type: 'V', nodes: ['psu+', '0'], value: 5, rInternal: 0.01, partId: 'psu' },
      { id: 'SW_OUT', type: 'SW', nodes: ['psu+', 'out'], closed: true, partId: 'psu' },
      { id: 'P_I', type: 'PROBE', nodes: ['out', 'r_top'], partId: 'meter' },
      { id: 'R1', type: 'R', nodes: ['r_top', '0'], value: 220, rating: R1_RATING, partId: 'r1' },
    ],
  },
  powerElementId: 'SW_OUT',
  powerLabel: 'Output ON',

  readouts: [
    { label: 'CURRENT', source: { kind: 'current', elementId: 'P_I' }, unit: 'A' },
    { label: 'POWER', source: { kind: 'power', elementId: 'R1' }, unit: 'W' },
    { label: 'BODY TEMP', source: { kind: 'extra', key: 'R1.tj' }, unit: '°C', digits: 3, warnAbove: 90 },
    { label: 'SUPPLY', source: { kind: 'voltage', node: 'r_top' }, unit: 'V' },
  ],

  tweaks: [
    { label: 'Resistance', elementId: 'R1', key: 'value', min: 22, max: 1000, log: true, unit: 'Ω' },
    { label: 'Supply voltage', elementId: 'V_PSU', key: 'value', min: 0, max: 12, step: 0.1, unit: 'V' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: {1} into R1; BODY TEMP climbs slowly toward its steady value' },
    { when: { kind: 'above', readout: 2, value: 90 }, text: 'WARNING: R1 at {2} on {1}: too hot to touch, and a 1/4 W carbon-film part fails at 155 °C' },
  ],

  failures: [
    {
      id: 'r-47',
      label: '47 Ω fitted instead of 220 Ω',
      explain:
        'P = V²/R = 25/47 = 0.53 W, 213 % of the 1/4 W rating, and the body would settle at 25 + 0.53 × 340 ≈ 205 °C. It climbs past 155 °C in a few seconds and R1 goes open (a real part discolours and smells first). Heat takes time, but it always arrives. The sensor reads 0 once the part is open.',
      patches: [{ op: 'set', elementId: 'R1', key: 'value', value: 47 }],
    },
    {
      id: 'v-12',
      label: 'Supply turned up to 12 V',
      explain:
        'The voltage went up 2.4×, so the power went up 2.4² = 5.8×: 0.65 W on the same 220 Ω. Current only rose 2.4×; heating follows the current squared, which is why it burns so fast.',
      patches: [{ op: 'set', elementId: 'V_PSU', key: 'value', value: 12 }],
    },
    {
      id: 'big-2w',
      label: 'Fit a 2 W resistor instead',
      explain:
        'The same 47 Ω still turns 0.53 W into heat, but a larger body has a lower thermal resistance to the air (42.5 °C/W instead of 340), so the temperature rise is about 23 °C instead of 180 °C. The rating exists because of the body, not the ohms.',
      patches: [
        { op: 'set', elementId: 'R1', key: 'value', value: 47 },
        { op: 'set', elementId: 'R1', key: 'rating.maxP', value: 2 },
        { op: 'set', elementId: 'R1', key: 'rating.rth', value: 42.5 },
        { op: 'set', elementId: 'R1', key: 'rating.tauTh', value: 8 },
      ],
      parts: { hide: ['r1'], show: ['r1big'] },
    },
  ],

  meet: `Power is the rate energy is converted, in watts (J/s). Combine P = V·I with Ohm's law and you get three forms:

**P = V·I = I²·R = V²/R**

With 5 V across 220 Ω: I = 5/220 = 22.7 mA, so P = 5 × 0.0227 = **0.114 W**. Swap in 47 Ω and P = 25/47 = **0.53 W**. Pick the form that uses what you know: V and R, use V²/R. I and R, use I²R.

In a resistor, all of that power becomes heat, and heat raises temperature through a **thermal resistance** θ (°C/W): ΔT = P·θ. The rating sets θ. A typical 1/4 W carbon-film datasheet allows 0.25 W at 70 °C ambient, falling linearly to zero at 155 °C. So full power raises the hot spot by about 155 − 70 = 85 °C, giving θ ≈ 85 / 0.25 = **340 °C/W**.

At 0.114 W the rise is 0.114 × 340 ≈ **39 °C**: about 64 °C on a 25 °C bench, too hot to hold for long but safe. At 0.53 W the rise would be about 180 °C, so the part never gets there.

Heating also takes time. Power appears instantly, but the body's thermal mass makes temperature climb over seconds (the bench compresses a real body's tens of seconds to a time constant of 5 s).

The 0.25 W rating holds at **70 °C ambient**. On this 25 °C bench the part survives up to about 0.38 W (155 − 25 = 130 °C of rise ÷ 340 °C/W), but inside a 70 °C enclosure the same 0.25 W reaches 155 °C and it burns. That margin is why engineers derate.

Design rule: run resistors at **50 % or less** of their rating, and less again in a hot enclosure.`,

  mechanicalAnalogy: `This is your thermal-resistance network with different labels. Heat flow in watts plays the role of current, temperature difference plays voltage, and θ in °C/W is the resistance: ΔT = P·θ, exactly Ohm's law. The body's heat capacity is a capacitor, so temperature rises along an RC-style exponential.

**Where it breaks:** convection and radiation are nonlinear in temperature, so θ falls somewhat as the part gets hotter. Electrical resistance also shifts with temperature, which feeds back into the power.`,

  proTips: [
    'Derate to 50 %. A "1/4 W" resistor should see no more than about 0.125 W in a design you want to last.',
    "Surface-mount power ratings depend heavily on the copper around the pads: typically 0603 ≈ 0.1 W, 0805 ≈ 0.125 W, 1206 ≈ 0.25 W. Check the datasheet's land-pattern assumptions.",
    'Pulse loads are judged by energy and duty, not peak power. Resistors have separate pulse-withstand curves, so use them for inrush and snubber parts.',
  ],

  quiz: [
    {
      q: 'What does a 330 Ω resistor dissipate on 12 V?',
      options: ['0.036 W', '0.436 W', '0.25 W', '3.96 W'],
      answer: 1,
      why: 'P = V²/R = 144/330 = 0.436 W.',
    },
    {
      q: '50 mA flows through 100 Ω. What is the power?',
      options: ['0.25 W', '0.025 W', '5 W', '2.5 W'],
      answer: 0,
      why: 'P = I²R = 0.0025 × 100 = 0.25 W, right at a 1/4 W rating, so too hot for a real design.',
    },
    {
      q: 'The current through a resistor triples. The heat produced…',
      options: ['triples', 'stays the same', 'rises 9×', 'rises 6×'],
      answer: 2,
      why: 'P = I²R, and 3² = 9.',
    },
    {
      q: 'A resistor is rated 0.25 W at 70 °C and derates linearly to 0 W at 155 °C. What may it dissipate at 112.5 °C ambient?',
      options: ['0.25 W', '0.0625 W', '0 W', '0.125 W'],
      answer: 3,
      why: '112.5 °C is halfway between 70 and 155 °C, so half the rating: 0.125 W.',
    },
  ],
}
