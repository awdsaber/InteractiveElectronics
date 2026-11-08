// T0 · The Breadboard. Source: docs/curriculum/T0/breadboard.md
//
// A plug-on 5 V supply module feeds the bottom rails of a breadboard. The circuit is four nodes:
// + rail, strip 10, strip 15 and strip 16 (the return). R1 spans strips 10 → 15, the LED spans
// 15 → 16, and two jumpers close the loop. The nodes are named after the strips they live in, so
// the sim and the 3D agree: a failure that moves a part to the wrong strip is a patch on nodes.
// The ground rail is split at the middle (as on many full-length boards) and a blue bridge
// jumper joins its two halves; the board's strip highlight is not drawn (the wire colours and
// callouts carry that), see docs/decisions.md.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

const BB: [number, number] = [0.6, -0.4]
const PWR_AT: [number, number] = [-1.8, 3.9] // in front of the board, near the left end of the rails
const MOD_Y = BENCH_Y + 0.62 // where the module's own leads leave it

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

// module → rail feeders (red lands one column left of black so the two never cross)
const fRed = jumper([PWR_AT[0] - 0.3, MOD_Y, PWR_AT[1] - 0.9], bbHole(BB, 6, '+b'), 'red', 0.45)
const fBlack = jumper([PWR_AT[0] + 0.3, MOD_Y, PWR_AT[1] - 0.9], bbHole(BB, 7, '-b'), 'black', 0.45)
// the ground-rail bridge across the rail's mid-gap
const bridge = withCallout(jumper(bbHole(BB, 8, '-b'), bbHole(BB, 22, '-b'), 'blue', 0.9), [-0.4, 0.5, 1.6])
// the circuit: + rail → col 10 (j1), R1 10 → 15, LED 15 → 16, col 16 → − rail (j2)
const j1 = withCallout(jumper(bbHole(BB, 10, '+b'), bbHole(BB, 10, 'j'), 'red', 0.4), [-1.2, 0.9, 0.5])
const j2 = withCallout(jumper(bbHole(BB, 16, 'j'), bbHole(BB, 16, '-b'), 'black', 0.3), [1.8, 0.6, 1.2])
// F4: the same jumper, one wrong strip over
const j1Wrong = withCallout(jumper(bbHole(BB, 15, '+b'), bbHole(BB, 15, 'j'), 'red', 0.4), [1.0, 0.9, 0.6])

const LED_RATING = { maxI: 0.03, maxV: 5.5 }

export const lesson: LessonDef = {
  id: 'breadboard',
  track: 'T0',
  title: 'The Breadboard',
  subtitle: 'Hidden metal strips',
  tagline: 'A 330 Ω resistor and a red LED on 5 V draw about 10 mA, unless two legs land in the same 5-hole strip.',

  board: {
    name: 'PROTO-08',
    size: [17, 6],
    base: 'breadboard-only',
    parts: [
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Every 5-hole strip is one node; the rails run along the edges.' },
      {
        id: 'pwr',
        kind: 'module',
        pos: [PWR_AT[0], BENCH_Y, PWR_AT[1]],
        mount: 'module',
        label: 'RAILS',
        role: 'Plug-on supply module (MB102 style): USB 5 V to the rails. Its push button is the power switch.',
        params: { title: 'MB102 5V/3.3V', color: '#5f6b75', w: 2.6, d: 2.2, pins: 0, chip: 'none', callout: [1.4, 1.2, 0.2] },
        circuitIds: ['V_USB', 'SW_PWR'],
      },
      { id: 'f-red', kind: 'wire', ...fRed, mount: 'offboard', role: 'Module 5 V to the + rail (the outer rail, red line).' },
      { id: 'f-black', kind: 'wire', ...fBlack, mount: 'offboard', role: 'Module ground to the left end of the − rail (blue line).' },
      {
        id: 'bridge',
        kind: 'wire',
        ...bridge,
        mount: 'offboard',
        label: 'RAIL BRIDGE',
        role: 'Many full-length boards break each rail at the midpoint. This jumper joins the two halves of the − rail again.',
        circuitIds: ['W_RAIL'],
      },
      { id: 'j1', kind: 'wire', ...j1, mount: 'offboard', label: 'JUMPER', role: '+ rail to strip 10.', circuitIds: ['W1'] },
      {
        id: 'r1',
        kind: 'resistor',
        pos: between(bbHole(BB, 10, 'g'), bbHole(BB, 15, 'g')),
        mount: 'tht',
        label: 'LIMIT',
        role: '330 Ω, 1/4 W (orange-orange-brown-gold). Its legs stand in strip 10 and strip 15, so it bridges the two.',
        params: { ohms: 330, span: 1.27, callout: [-0.4, 1.8, -0.9] },
        circuitIds: ['R1'],
      },
      {
        id: 'led1',
        kind: 'led',
        pos: between(bbHole(BB, 15, 'h'), bbHole(BB, 16, 'h')),
        rot: 180,
        mount: 'tht',
        label: 'LED',
        role: '5 mm red LED. Long leg (anode) in strip 15, short leg (cathode) in strip 16.',
        params: { color: 'red', callout: [1.2, 1.5, -0.9] },
        circuitIds: ['LED1'],
      },
      { id: 'j2', kind: 'wire', ...j2, mount: 'offboard', label: 'RETURN', role: 'Strip 16 to the − rail.', circuitIds: ['W2'] },

      // parts only a failure brings in
      {
        id: 'r1-bad',
        kind: 'resistor',
        pos: between(bbHole(BB, 10, 'f'), bbHole(BB, 10, 'i')),
        rot: 90,
        mount: 'tht',
        label: 'SAME STRIP',
        role: 'The resistor pushed in along one strip: both legs in strip 10, so it joins strip 10 to itself and nothing else.',
        params: { ohms: 330, span: 0.762, callout: [-1.3, 1.4, -0.9] },
        hidden: true,
      },
      {
        id: 'led-bad',
        kind: 'led',
        pos: between(bbHole(BB, 15, 'h'), bbHole(BB, 15, 'i')),
        rot: 90,
        mount: 'tht',
        label: 'SAME STRIP',
        role: 'The LED pushed in along one strip: both legs in strip 15, so the strip shorts it out.',
        params: { color: 'red', callout: [1.2, 1.4, -0.9] },
        hidden: true,
      },
      {
        id: 'j1-wrong',
        kind: 'wire',
        ...j1Wrong,
        mount: 'offboard',
        label: 'ONE HOLE OFF',
        role: 'The supply jumper landed in strip 15, the LED strip, instead of strip 10.',
        hidden: true,
      },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_USB', type: 'V', nodes: ['usb', '0'], value: 5.0, rInternal: 0.1, partId: 'pwr' },
      // `closed: true`: the bench opens the power element until the button is pressed
      { id: 'SW_PWR', type: 'SW', nodes: ['usb', 'rail+'], closed: true, rating: { maxI: 0.7 }, partId: 'pwr' },
      { id: 'W1', type: 'R', nodes: ['rail+', 'col10'], value: 0.02, rating: { maxI: 1 }, partId: 'j1' },
      { id: 'R1', type: 'R', nodes: ['col10', 'col15'], value: 330, rating: { maxP: 0.25, maxV: 250 }, partId: 'r1' },
      { id: 'LED1', type: 'LED', nodes: ['col15', 'col16'], color: 'red', rating: LED_RATING, partId: 'led1' },
      { id: 'W2', type: 'R', nodes: ['col16', 'rail-'], value: 0.02, rating: { maxI: 1 }, partId: 'j2' },
      // the − rail's far half is reached through the bridge jumper
      { id: 'W_RAIL', type: 'R', nodes: ['rail-', '0'], value: 0.02, rating: { maxI: 1 }, partId: 'bridge' },
    ],
  },
  powerElementId: 'SW_PWR',
  powerLabel: 'Press module power button',

  readouts: [
    { label: 'LED CURRENT', source: { kind: 'current', elementId: 'LED1' }, unit: 'A' },
    { label: 'R1 CURRENT', source: { kind: 'current', elementId: 'R1' }, unit: 'A' },
    { label: 'STRIP 15', source: { kind: 'voltage', node: 'col15' }, unit: 'V' },
    { label: '+ RAIL', source: { kind: 'voltage', node: 'rail+' }, unit: 'V' },
    { label: '- RAIL', source: { kind: 'voltage', node: 'rail-' }, unit: 'V', warnAbove: 0.5 },
  ],

  tweaks: [{ label: 'Limit resistor', elementId: 'R1', key: 'value', min: 100, max: 4700, log: true, unit: 'Ω' }],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: {1} flows rail → strip 10 → R1 → strip 15 → LED → strip 16 → rail; strip 15 sits at {2}' },
    { when: { kind: 'above', readout: 4, value: 0.5 }, text: 'WARNING: the − rail reads {4}, not 0 V. It is cut off from the module ground, so no return current can flow' },
    { when: { kind: 'above', readout: 1, value: 0.012 }, text: 'LED SHORTED OUT: R1 alone sets {1} (5 V ÷ 330 Ω), and the LED sees almost nothing' },
    { when: { kind: 'above', readout: 0, value: 0.03 }, text: 'DANGER: {0} through the LED, past its 30 mA absolute maximum' },
  ],

  failures: [
    {
      id: 'resistor-one-strip',
      label: 'Both resistor legs in one strip',
      explain:
        'Both legs of R1 stand in strip 10. A strip is one piece of metal, so the resistor joins strip 10 to itself and bridges nothing: strip 15 is never connected to the supply, the series path is open, LED CURRENT and R1 CURRENT read 0 and STRIP 15 sits at 0 V. The same mistake with any part makes it do nothing.',
      patches: [{ op: 'remove', elementId: 'R1' }],
      parts: { hide: ['r1'], show: ['r1-bad'] },
    },
    {
      id: 'led-one-strip',
      label: 'LED legs in one strip',
      explain:
        'Both LED legs share strip 15, so the strip shorts the LED out: its anode and cathode are the same node and it carries nothing, so it stays dark. R1 alone sets the current: 5 V ÷ 330 Ω = 15.2 mA, dissipating 76 mW, which is safe. A short across the load does not blow anything here only because the resistor is still in series.',
      patches: [{ op: 'short', a: 'col15', b: 'col16' }],
      parts: { hide: ['led1'], show: ['led-bad'] },
    },
    {
      id: 'split-rail',
      label: 'Split ground rail (bridge left out)',
      explain:
        'Many full-length breadboards break each power rail at the midpoint, often marked by a gap in the printed line. Without the bridge jumper the right half of the − rail is cut off from the module ground: the LED is dark, and a meter on the − rail reads close to the + rail voltage instead of 0 V, because almost no current flows to drop any voltage. A reading that looks like power is not a working return path.',
      patches: [{ op: 'remove', elementId: 'W_RAIL' }],
      parts: { hide: ['bridge'] },
    },
    {
      id: 'jumper-wrong-strip',
      label: 'Supply jumper one strip off',
      explain:
        'The jumper landed in strip 15 instead of strip 10. R1 is bypassed and the LED sits directly across 5 V with only the wires and the module to limit it: the current leaps past 30 mA and the LED burns open after 300 ms. One hole off, and the circuit is a different circuit.',
      patches: [{ op: 'short', a: 'rail+', b: 'col15' }],
      parts: { hide: ['j1'], show: ['j1-wrong'] },
    },
  ],

  meet: `Under the plastic, every **terminal strip** is a spring-metal clip joining 5 holes. The holes a–e of one numbered column are one node, and f–j of the same column are another. The **centre channel** (0.3 in / 7.62 mm wide) separates them, so a DIP chip can straddle it with each pin on its own node. The long **power rails** along the edges carry + and −.

Build node by node, not part by part. This circuit has four nodes: the + rail, strip 10, strip 15 and strip 16 (tied to the − rail). R1 spans strips 10 → 15 and the LED spans 15 → 16 with its long leg (anode) in 15. The jumpers connect the rails: red to strip 10, black from strip 16. The blue jumper bridges the − rail, which on many full-length boards is cut in the middle.

The current follows from KVL around the loop:

I = (5.0 V − 1.8 V) / 330 Ω ≈ **9.7 mA**, and P_R = I²R = 0.0097² × 330 ≈ **31 mW**.

Now break it. Put both legs of a part in one strip and it is shorted on itself: with the LED that leaves R1 alone to set 5 V / 330 Ω = **15.2 mA** (76 mW) and a dark LED. Put them in a resistor and the path is simply open.

**Limits.**

- Contacts are typically rated about **1 A**, and each adds a few tens of milliohms.
- Adjacent strips have a few picofarads of capacitance between them, so breadboards are poor for signals above a few MHz.
- Thick leads (power diodes, header pins) stretch the clips and make later contacts unreliable.`,

  mechanicalAnalogy: `A breadboard is a manifold block with drilled galleries: every port along one gallery is at the same pressure, and the centre channel is a solid web keeping two galleries apart. Placing a part means choosing which two galleries it bridges.

**Where it breaks:** a manifold's galleries are visible on the drawing, but a breadboard's are hidden, so errors are invisible until measured. Its spring contacts also wear and loosen, giving intermittent faults that a machined block would never have.`,

  proTips: [
    'Colour-code your wiring: red for supply, black or blue for ground, and other colours for signals. Keep the top rail positive on every board you build so your hands learn it.',
    'Use 22 AWG (0.64 mm) solid-core wire. Stranded wire frays in the clips, and fat leads damage them.',
    "Before you power up, use the meter's continuity mode to check rail-to-rail (it must not beep) and each intended connection (it must beep).",
  ],

  quiz: [
    {
      q: 'How many holes does one standard terminal strip connect?',
      options: ['2', '5', '10', '30'],
      answer: 1,
      why: 'Each strip joins 5 holes (a–e or f–j in one numbered column).',
    },
    {
      q: 'What resistor gives a green LED (Vf 2.1 V) about 10 mA from 5 V?',
      options: ['29 Ω', '210 Ω', '500 Ω', '290 Ω (use 270 or 330 Ω)'],
      answer: 3,
      why: 'R = (5 − 2.1) / 0.010 = 290 Ω. The nearest standard values are 270 Ω and 330 Ω.',
    },
    {
      q: "On this board the LED's legs end up in the same strip. What current flows through the 330 Ω resistor?",
      options: ['15.2 mA', '0 mA', '9.7 mA', '30 mA'],
      answer: 0,
      why: 'The LED is shorted, so all 5 V falls across R1: 5 / 330 = 15.2 mA.',
    },
    {
      q: 'Why do DIP ICs straddle the centre channel?',
      options: [
        'To keep them cool',
        'Because the channel carries the supply',
        "So each pin lands in its own strip instead of being shorted to the pin opposite",
        "So the chip can't be inserted backwards",
      ],
      answer: 2,
      why: 'Without the channel, opposite pins would share a strip and be connected together.',
    },
  ],
}
