// T0 · The Multimeter. Source: docs/curriculum/T0/multimeter.md
//
// One bench supply (10 V) feeds two things at once on the breadboard: a 1 MΩ / 1 MΩ divider that a
// voltmeter (10 MΩ input) measures, and a 47 Ω load that an ammeter (1.8 Ω burden, 0.44 A fuse)
// measures in series. Both meters are circuit elements, so the loading error and the burden voltage
// are real simulator results, not scripted ones.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

const BB: [number, number] = [-0.5, -1.5]
const PSU_AT: [number, number] = [-4.6, 2.8]
const VM_AT: [number, number] = [5.2, -3.6]
const AM_AT: [number, number] = [5.2, 2.2]
const DMM_SCALE = 0.38

// divider: R1 (node v → mid) and R2 (mid → ground rail), both along the breadboard; load R3 beside it
const r1L = bbHole(BB, 6, 'g')
const r1R = bbHole(BB, 10, 'g')
const r2L = bbHole(BB, 10, 'h')
const r2R = bbHole(BB, 14, 'h')
const r3L = bbHole(BB, 20, 'g')
const r3R = bbHole(BB, 24, 'g')

const POST_Y = BENCH_Y + 0.16 + 0.12
const postPlus: [number, number, number] = [PSU_AT[0] + 1.1, POST_Y, PSU_AT[1] + 0.95]
const postMinus: [number, number, number] = [PSU_AT[0] + 0.5, POST_Y, PSU_AT[1] + 0.95]
// meter jacks: A at −2, COM at 0, VΩ at +2 (in the meter's frame, scaled), on its front edge
const jackY = BENCH_Y + (1.5 + 0.19) * DMM_SCALE
const jack = (at: [number, number], dx: number): [number, number, number] => [at[0] + dx * DMM_SCALE, jackY, at[1] + 5.5 * DMM_SCALE]

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const wPlus = jumper(postPlus, bbHole(BB, 6, 'j'), 'red', 0.5)
const wMinus = jumper(postMinus, bbHole(BB, 14, '-b'), 'black', 0.5)
const wR2Gnd = jumper(bbHole(BB, 14, 'j'), bbHole(BB, 15, '-b'), 'black', 0.15)
const wR3Gnd = jumper(bbHole(BB, 24, 'j'), bbHole(BB, 25, '-b'), 'black', 0.15)
// ammeter: supply side to the A jack, COM to the load
const wAmpIn = jumper(bbHole(BB, 6, 'i'), jack(AM_AT, -2), 'red', 1.0)
const wAmpOut = jumper(jack(AM_AT, 0), bbHole(BB, 20, 'j'), 'yellow', 0.5)
// voltmeter: VΩ jack to the divider midpoint (these are "the leads", SW_VM), COM to the ground rail
const wVolt = jumper(jack(VM_AT, 2), bbHole(BB, 10, 'j'), 'red', 0.8)
const wVoltCom = jumper(jack(VM_AT, 0), bbHole(BB, 26, '-b'), 'black', 0.6)

/** 1/4 W metal-film resistors */
const R_RATING = { maxP: 0.25 }

export const lesson: LessonDef = {
  id: 'multimeter',
  track: 'T0',
  title: 'The Multimeter',
  subtitle: 'Measuring without meddling',
  tagline: 'Touch a 10 MΩ meter to the middle of a 1 MΩ / 1 MΩ divider and its 5.00 V sags to 4.76 V: the meter itself is a load.',

  board: {
    name: 'DMM-07',
    size: [14, 9],
    frame: { size: [12.4, 10.2], center: [1.0, -0.9] }, // divider, load and both meters, stacked so no wire crosses an LCD
    base: 'breadboard-only',
    parts: [
      {
        id: 'psu',
        kind: 'module',
        pos: [PSU_AT[0], BENCH_Y, PSU_AT[1]],
        mount: 'offboard',
        label: 'SUPPLY',
        role: 'Bench supply, 10 V here. The OUTPUT button connects it.',
        params: { title: 'BENCH PSU', color: '#5f6b75', w: 3.4, d: 2.4, pins: 0, chip: 'none', callout: [-0.4, 1.6, -0.3] },
        circuitIds: ['V_PSU', 'SW_OUT'],
      },
      { id: 'post-p', kind: 'testpoint', pos: postPlus, mount: 'offboard', role: 'Supply + output post.', params: { color: 'red' } },
      { id: 'post-n', kind: 'testpoint', pos: postMinus, mount: 'offboard', role: 'Supply − output post.', params: { color: 'black' } },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds both test circuits.' },
      {
        id: 'r1',
        kind: 'resistor',
        pos: between(r1L, r1R),
        mount: 'tht',
        label: 'TOP',
        role: 'Upper divider leg, 1 MΩ, 1/4 W.',
        params: { ohms: 1000000, callout: [0.1, 1.9, -0.9] },
        circuitIds: ['R1'],
      },
      {
        id: 'r2',
        kind: 'resistor',
        pos: between(r2L, r2R),
        mount: 'tht',
        label: 'BOTTOM',
        role: 'Lower divider leg, 1 MΩ, 1/4 W. The voltmeter measures across it.',
        params: { ohms: 1000000, callout: [0.1, 1.5, 0.9] },
        circuitIds: ['R2'],
      },
      {
        id: 'r3',
        kind: 'resistor',
        pos: between(r3L, r3R),
        mount: 'tht',
        label: 'LOAD',
        role: 'Current-measurement test load, 47 Ω, 5 W wirewound.',
        params: { ohms: 47, callout: [0.1, 1.9, -0.9] },
        circuitIds: ['R3'],
      },
      {
        id: 'vmeter',
        kind: 'multimeter',
        pos: [VM_AT[0], BENCH_Y, VM_AT[1]],
        mount: 'offboard',
        label: 'VOLTMETER',
        role: 'Handheld DMM on a DC volts range: 10 MΩ input resistance, in parallel with the part under test. Reads METER READS.',
        params: { readout: 0, autoUnit: true, title: 'VOLTMETER · V', mode: 'V', scale: DMM_SCALE, callout: [-1.0, 1.5, 0.6] },
        circuitIds: ['R_VM', 'SW_VM'],
      },
      {
        id: 'ameter',
        kind: 'multimeter',
        pos: [AM_AT[0], BENCH_Y, AM_AT[1]],
        mount: 'offboard',
        label: 'AMMETER',
        role: 'The same meter on its mA range: a 1.8 Ω shunt (1.8 mV per mA) and a 0.44 A fuse, in series with the load. Reads AMMETER.',
        params: { readout: 1, autoUnit: true, title: 'AMMETER · mA', mode: 'A', scale: DMM_SCALE, callout: [-1.0, 1.5, 0.6] },
        circuitIds: ['R_SH', 'R_FUSE'],
      },
      { id: 'w-plus', kind: 'wire', ...withCallout(wPlus, [0, 0.5, 0.2]), mount: 'offboard', label: 'SUPPLY +', role: 'Supply + to the divider and the ammeter.' },
      { id: 'w-minus', kind: 'wire', ...withCallout(wMinus, [0.2, 0.5, 0.2]), mount: 'offboard', label: 'SUPPLY −', role: 'Supply − to the ground rail.' },
      { id: 'w-r2g', kind: 'wire', ...wR2Gnd, mount: 'offboard', role: 'R2 to ground.' },
      { id: 'w-r3g', kind: 'wire', ...wR3Gnd, mount: 'offboard', role: 'Load to ground.' },
      { id: 'w-amp-in', kind: 'wire', ...wAmpIn, mount: 'offboard', role: 'Supply side to the ammeter A jack.' },
      { id: 'w-amp-out', kind: 'wire', ...wAmpOut, mount: 'offboard', role: 'Ammeter COM to the load: the meter is part of the loop.' },
      { id: 'w-volt', kind: 'wire', ...wVolt, mount: 'offboard', role: 'Voltmeter lead to the divider midpoint.' },
      { id: 'w-volt-com', kind: 'wire', ...wVoltCom, mount: 'offboard', role: 'Voltmeter COM to ground.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_PSU', type: 'V', nodes: ['psu_p', '0'], value: 10, rInternal: 0.01, partId: 'psu' },
      { id: 'SW_OUT', type: 'SW', nodes: ['psu_p', 'v'], closed: true, partId: 'psu' },
      // the divider under test
      { id: 'R1', type: 'R', nodes: ['v', 'mid'], value: 1e6, rating: R_RATING, partId: 'r1' },
      { id: 'R2', type: 'R', nodes: ['mid', '0'], value: 1e6, rating: R_RATING, partId: 'r2' },
      // the voltmeter: leads on the midpoint, then 10 MΩ input resistance to ground
      { id: 'SW_VM', type: 'SW', nodes: ['mid', 'vm'], closed: false, partId: 'vmeter' },
      { id: 'R_VM', type: 'R', nodes: ['vm', '0'], value: 1e7, partId: 'vmeter' },
      // the ammeter on its mA range: shunt (+ leads) 1.7 Ω, then the 0.44 A fast fuse (0.1 Ω cold)
      { id: 'R_SH', type: 'R', nodes: ['v', 'sh'], value: 1.7, partId: 'ameter' },
      { id: 'R_FUSE', type: 'FUSE', nodes: ['sh', 'f'], iRated: 0.44, i2t: 0.1, r: 0.1, partId: 'ameter' },
      { id: 'R3', type: 'R', nodes: ['f', '0'], value: 47, rating: { maxP: 5 }, partId: 'r3' },
      // reference only (no 3D part): the same 47 Ω on an ideal 10 V with no meter, so "what it would be" is a sim result
      { id: 'V_REF', type: 'V', nodes: ['ref', '0'], value: 10 },
      { id: 'R_REF', type: 'R', nodes: ['ref', '0'], value: 47 },
    ],
  },
  powerElementId: 'SW_OUT',
  powerLabel: 'Output ON',

  readouts: [
    { label: 'METER READS', source: { kind: 'voltage', node: 'vm' }, unit: 'V' },
    { label: 'AMMETER', source: { kind: 'current', elementId: 'R_SH' }, unit: 'A', floor: 1e-5 },
    { label: 'BURDEN', source: { kind: 'voltage', node: 'v', ref: 'f' }, unit: 'V' },
    { label: 'MIDPOINT', source: { kind: 'voltage', node: 'mid' }, unit: 'V' },
    // what the load would draw with no meter in the loop: an isolated reference branch (output-gate behaviour)
    { label: 'TRUE (NO METER)', source: { kind: 'current', elementId: 'R_REF' }, unit: 'A' },
  ],
  behaviors: [{ id: 'output-gate', instance: 'gate', params: { elements: 'V_REF' } }],

  tweaks: [
    { label: 'Meter input resistance', elementId: 'R_VM', key: 'value', min: 10000, max: 10000000, log: true, unit: 'Ω' },
    { label: 'Leads on midpoint', elementId: 'SW_VM', key: 'closed', kind: 'toggle', min: 0, max: 1, step: 1, unit: '' },
    { label: 'Load resistance (R3)', elementId: 'R3', key: 'value', min: 33, max: 1000, log: true, unit: 'Ω' },
    { label: 'Upper divider resistor (R1)', elementId: 'R1', key: 'value', min: 1000, max: 1000000, log: true, unit: 'Ω' },
    { label: 'Lower divider resistor (R2)', elementId: 'R2', key: 'value', min: 1000, max: 1000000, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: the divider sits at {3} with the voltmeter leads off. Switch LEADS ON MIDPOINT on and watch it sag. The ammeter reads {1} where {4} would flow with no meter in the loop ({2} of burden)' },
    { when: { kind: 'above', readout: 0, value: 1 }, text: 'LEADS ON: the meter reads {0}, but the divider sat at 5.00 V before you touched it. The meter\'s 10 MΩ is in parallel with R2. Ammeter {1} vs {4} with no meter' },
  ],

  failures: [
    {
      id: 'analog-meter',
      label: 'Use an old analog meter (20 kΩ/V on the 10 V range)',
      explain:
        'On a 10 V range a 20 kΩ/V analog meter has 200 kΩ input resistance. 1 MΩ ∥ 200 kΩ = 167 kΩ, so the meter reads 10 × 167k / (1M + 167k) = 1.43 V instead of 5 V. The meter has become part of the circuit.',
      patches: [{ op: 'set', elementId: 'R_VM', key: 'value', value: 200000 }],
    },
    {
      id: 'amps-across-supply',
      label: 'Measure with the lead in the mA jack, across the supply',
      explain:
        'In mA mode the meter is a 1.8 Ω shunt in series with a fuse. Put straight across a 10 V supply it is nearly a short: 10 / 1.8 ≈ 5.4 A (the supply and switch resistance trim it), over twelve times the 0.44 A fuse rating. The fuse melts in milliseconds and opens: it is there for exactly this mistake, and this supply has no current limit, so it is the only protection. The meter stays dead on its current ranges until the fuse is replaced. On high-energy circuits only a high-breaking-capacity fuse stops this becoming an explosion.',
      patches: [{ op: 'short', a: 'f', b: '0' }],
    },
    {
      id: 'r2-out',
      label: 'The bottom resistor falls out while you measure',
      explain:
        'The meter\'s 10 MΩ is now the only lower leg: 10 × 10M / 11M = 9.09 V. A high-impedance meter shows a plausible voltage on a node that is really disconnected. A low-impedance meter would have read nearly 0 V and warned you.',
      patches: [{ op: 'remove', elementId: 'R2' }],
      parts: { hide: ['r2'] },
    },
  ],

  meet: `A **voltmeter** goes in *parallel*, so it should draw almost no current: high resistance. An **ammeter** goes in *series*, so it should drop almost no voltage: low resistance. Neither is perfect, and the error depends on the circuit.

**Voltmeter loading.** Seen from the midpoint, the divider is a 5 V source behind R1 ∥ R2 = 500 kΩ (its Thévenin equivalent). The meter's 10 MΩ input forms a second divider with that:

V_read = 5 × 10M / (10M + 0.5M) = **4.76 V**, an error of −4.8%. The leads start lifted, so MIDPOINT shows the true 5.00 V; switch LEADS ON MIDPOINT on and it sags to 4.76 V (switch it off and it jumps back).

Rule of thumb: the meter must be at least 100× the source resistance for a 1% error. A 10 MΩ input (the usual figure on a handheld meter's DC volts ranges) is excellent on a 10 kΩ divider and poor on a 1 MΩ one. Slide both divider resistors down to 1 kΩ and the loading error almost vanishes.

**Ammeter burden.** A meter specified at 1.8 mV/mA adds 1.8 Ω. With a 47 Ω load:

I = 10 / (47 + 1.8) = **204.9 mA** instead of 212.8 mA (−3.7%), and the meter drops **0.37 V**.

Low-resistance loads suffer most. Use the 10 A range (lower burden) or measure the voltage across a known shunt resistor instead.

**The fuse.** The current jack is protected by a fast-blow fuse. The 0.44 A rating here is a typical figure for handheld meters (cheaper ones fit 200 mA fuses). Carry 205 mA all day and it does nothing; put the meter across the supply and about 5.4 A melts it in milliseconds.`,

  mechanicalAnalogy: `A voltmeter is a pressure gauge with a tiny bleed: it taps off a trickle of flow to read pressure, which is fine on a stiff pump but noticeable on a weak, restricted source. An ammeter is an in-line flowmeter that adds its own pressure drop.

**Where it breaks:** a mechanical gauge disturbs the system through added volume and friction. A meter disturbs it only through its resistance (and, at AC, its capacitance and bandwidth limit). That makes the error exactly calculable, as in this lesson.`,

  proTips: [
    'After every current measurement, move the red lead back to the V/Ω jack. Make it a reflex, because leaving it in the current jack is the most common way meters die.',
    "Check the meter's CAT rating (CAT II/III/IV) and fuse type before going near mains. Cheap meters often have undersized glass fuses that can't safely break a fault.",
    'To measure a current without breaking the circuit, read the voltage across a known low-value series resistor (or use a clamp meter for larger currents).',
  ],

  quiz: [
    {
      q: 'A 100 kΩ / 100 kΩ divider on 10 V is measured with a 10 MΩ meter. What does it read?',
      options: ['4.50 V', '5.00 V', '4.98 V', '4.76 V'],
      answer: 2,
      why: 'The Thévenin resistance is 50 kΩ, so V = 5 × 10M / 10.05M ≈ 4.975 V. The error is only 0.5%.',
    },
    {
      q: "A meter's mA range has a burden of 1.8 mV/mA. What voltage does it drop at 50 mA?",
      options: ['90 mV', '1.8 mV', '36 mV', '0.9 V'],
      answer: 0,
      why: '1.8 mV/mA × 50 mA = 90 mV.',
    },
    {
      q: 'To measure the current through a resistor, the ammeter goes…',
      options: ['across the resistor', 'across the supply', 'between the circuit and earth', 'in series with the resistor'],
      answer: 3,
      why: 'The current must flow through the meter, so the loop is broken and the meter inserted in series.',
    },
    {
      q: 'Why do multimeters have a fuse in the mA jack?',
      options: [
        'To measure AC',
        'To protect the meter when it is accidentally connected across a voltage in current mode',
        "To limit the voltmeter's input current",
        'To calibrate the shunt',
      ],
      answer: 1,
      why: 'In current mode the meter is nearly a short, and the fuse opens before the shunt or the user is harmed.',
    },
  ],
}
