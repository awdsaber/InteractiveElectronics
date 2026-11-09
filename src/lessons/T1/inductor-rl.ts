// T1 · Inductors and RL Time. Source: docs/curriculum/T1/inductor-rl.md
//
// A 5 V bench supply, a momentary push button (SW1), a 1 H iron-core choke (L1 with its 18 Ω of
// winding resistance, R_DCR) and an 82 Ω resistor (R1) in one loop: I → 5/100.05 = 50 mA with
// τ = L/R = 10 ms. A 1N4007 (D1) sits across the loop from ground to the coil's top, reverse-biased
// while current flows. Hold the button and the current rises exponentially; let go and the coil's
// current has nowhere to go but through D1 (switch sees ≈ 5.7 V). Take D1 away and the kick runs
// into SW1's `vBreak` clamp at ≈ 330 V, far past its 50 V rating.
// No behavior is needed: L, SW.vBreak, sim.edgeSubsteps and the scope do all the work.
import type { Element, LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

// Bench layout (camera looks from +x +z): breadboard front, the supply behind it (terminals facing
// the viewer). The circuit sits in the top half, rows a-e, left to right:
//   col 4  = supply + (wire on row a, SW1 left)
//   col 7  = node "a": SW1 right, L1 left (row b), D1 cathode (row e, D1 runs forward across the trench)
//   col 9  = L1 right = the foot of R1 (row e)
//   col 13 = R1 right → ground rail (wire on row a)
// D1's anode is in the front half (col 7 row g) and a wire takes it to the front ground rail; the
// two ground rails are tied together at column 2.
const BB: [number, number] = [0.2, 2.4]
const PSU_AT: [number, number] = [-2.9, -2.0]
const TERM_Y = BENCH_Y + 0.16 // the supply's top face

const C_IN = 4
const C_A = 7
const C_B = 9
const C_GND = 13

const swIn = bbHole(BB, C_IN, 'd')
const swOut = bbHole(BB, C_A, 'd')
const l1Left = bbHole(BB, C_A, 'b')
const l1Right = bbHole(BB, C_B, 'b')
const r1Left = bbHole(BB, C_B, 'e')
const r1Right = bbHole(BB, C_GND, 'e')
const d1Cathode = bbHole(BB, C_A, 'e')
const d1Anode = bbHole(BB, C_A, 'g')

/** the two screw terminals of the supply's block (rot 0): + on the left, − on the right */
const term = (i: number): [number, number, number] => [PSU_AT[0] + (i - 0.5) * 0.508, TERM_Y + 1.03, PSU_AT[1] + 0.55]

const wPlus = jumper(term(0), bbHole(BB, C_IN, 'a'), 'red', 0.5)
const wMinus = jumper(term(1), bbHole(BB, 2, '-t'), 'black', 0.6)
const wGnd = jumper(bbHole(BB, C_GND, 'a'), bbHole(BB, C_GND, '-t'), 'black', 0.15)
const wDiode = jumper(bbHole(BB, C_A, 'h'), bbHole(BB, C_A, '-b'), 'black', 0.2)
const wTie = jumper(bbHole(BB, 2, '-t'), bbHole(BB, 2, '-b'), 'black', 0.45)

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

/**
 * SW1: a miniature push button, 0.5 A / 50 V DC class. Air breaks down at about 330 V at the
 * Paschen minimum, so an opening gap carrying a coil's current clamps near there (`vBreak`) rather
 * than at the volts-per-microsecond the equation asks for. The contacts arc and weld: failMode short.
 */
const SW1: Element = {
  id: 'SW1',
  type: 'SW',
  nodes: ['sup', 'a'],
  closed: false,
  vBreak: 330,
  rating: { maxV: 50, maxI: 0.5, failMode: 'short' },
  partId: 'sw1',
}

/** L1: a generic 1 H iron-core choke; the 0.1 A rating stands in for its thermal / saturation limit */
const L1: Element = { id: 'L1', type: 'L', nodes: ['a', 'b'], value: 1, i0: 0, rating: { maxI: 0.1 }, partId: 'l1' }

/** D1: 1N4007 (DO-41), 1 A / 1000 V; default junction constants give ≈ 0.7 V at 50 mA */
const D1: Element = { id: 'D1', type: 'D', nodes: ['0', 'a'], rating: { maxI: 1, maxV: 1000 }, partId: 'd1' }

export const lesson: LessonDef = {
  id: 'inductor-rl',
  track: 'T1',
  title: 'Inductors and RL Time',
  subtitle: 'Current has inertia',
  tagline: 'A 1 H choke in a 100 Ω loop takes τ = 10 ms to reach 63% of its 50 mA, and when you cut the current it fights back.',

  board: {
    name: 'RL-11',
    size: [14, 10],
    frame: { size: [6.4, 5.2], center: [-1.9, -0.4] }, // the supply and the loop on the left of the breadboard
    base: 'breadboard-only',
    parts: [
      {
        id: 'psu',
        kind: 'module',
        pos: [PSU_AT[0], BENCH_Y, PSU_AT[1]],
        mount: 'offboard',
        label: 'SUPPLY',
        role: 'A 5 V bench supply with about 0.05 Ω inside.',
        color: '#4a5260',
        params: { title: '5 V SUPPLY', w: 3.0, d: 2.0, pins: 0, callout: [0, 1.9, 0.2] },
        circuitIds: ['V_SUP'],
      },
      {
        id: 'terminals',
        kind: 'screw-terminal',
        pos: [PSU_AT[0], TERM_Y, PSU_AT[1] + 0.55],
        mount: 'offboard',
        label: '+ 5 V · GND',
        role: 'The supply’s output: + on the left, ground on the right.',
        params: { pins: 2, callout: [0, 1.5, 0.9] },
      },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the loop: button, choke, resistor and diode.' },
      {
        id: 'sw1',
        kind: 'button',
        pos: between(swIn, swOut),
        mount: 'tht',
        label: 'SWITCH',
        role: 'A push button, normally open. Hold it to close the loop; let go to break the current.',
        params: { callout: [0.1, 1.5, 0.6] },
        color: '#c43d2f',
        circuitIds: ['SW1'],
      },
      {
        id: 'l1',
        kind: 'inductor',
        pos: between(l1Left, l1Right),
        mount: 'tht',
        label: 'CHOKE',
        role: 'A 1 H iron-core choke (about 18 Ω of winding resistance). Stores energy in its magnetic field: ½LI².',
        params: { callout: [0.2, 1.7, -0.2] },
        circuitIds: ['L1', 'R_DCR'],
      },
      {
        id: 'r1',
        kind: 'resistor',
        pos: between(r1Left, r1Right),
        mount: 'tht',
        label: 'LIMIT',
        role: 'Sets the final current with the winding resistance: 82 Ω, 1/2 W (grey-red-black-gold). 0.205 W at 50 mA.',
        params: { ohms: 82, span: 1.016, callout: [1.2, 1.0, -0.8] },
        circuitIds: ['R1'],
      },
      {
        id: 'd1',
        kind: 'diode',
        pos: between(d1Cathode, d1Anode),
        rot: 90,
        mount: 'tht',
        label: 'FLYBACK',
        role: '1N4007 across the coil’s top: reverse-biased while the button is held, it catches the current when it is released. Stripe (cathode) toward the coil.',
        params: { marking: '1N4007', callout: [0.2, 1.0, 1.4] },
        circuitIds: ['D1'],
      },
      {
        // F2: the same diode fitted the wrong way round
        id: 'd1rev',
        kind: 'diode',
        pos: between(d1Cathode, d1Anode),
        rot: -90,
        mount: 'tht',
        label: 'FLYBACK',
        role: 'The diode fitted backwards: stripe toward ground, so it is forward-biased straight across the supply.',
        params: { marking: '1N4007', callout: [0.2, 1.0, 1.4] },
        circuitIds: ['D1'],
        hidden: true,
      },
      {
        id: 'tp',
        kind: 'testpoint',
        pos: bbHole(BB, C_A, 'a'),
        mount: 'tht',
        label: 'PROBE',
        role: 'Scope point on the switch side of the coil (node a).',
        params: { color: 'yellow', callout: [-0.3, 1.1, -0.4] },
      },
      { id: 'w-plus', kind: 'wire', ...withCallout(wPlus, [-0.6, 0.8, -0.4]), mount: 'offboard', role: 'Supply + to the button.' },
      { id: 'w-minus', kind: 'wire', ...wMinus, mount: 'offboard', role: 'Supply ground to the rear ground rail.' },
      { id: 'w-gnd', kind: 'wire', ...wGnd, mount: 'offboard', role: 'R1’s far end to the ground rail.' },
      { id: 'w-diode', kind: 'wire', ...wDiode, mount: 'offboard', role: 'The diode’s anode to the front ground rail.' },
      { id: 'w-tie', kind: 'wire', ...wTie, mount: 'offboard', role: 'Ties the two ground rails together.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_SUP', type: 'V', nodes: ['sup', '0'], value: 5, rInternal: 0.05, partId: 'psu' },
      SW1,
      L1,
      { id: 'R_DCR', type: 'R', nodes: ['b', 'c'], value: 18, partId: 'l1' },
      { id: 'R1', type: 'R', nodes: ['c', '0'], value: 82, rating: { maxP: 0.5 }, partId: 'r1' },
      D1,
    ],
  },
  powerElementId: 'V_SUP',
  powerLabel: 'Switch supply on',
  transient: true,
  // τ = 10 ms against the default 1 ms step is 10 samples per time constant, enough for the
  // exponential. The turn-off kick lasts microseconds, so each switching step is split into 10
  // edge substeps (the first ≈ 1 µs) with SW1's instant rating checked on every one.
  sim: { edgeSubsteps: 10 },

  readouts: [
    { label: 'COIL CURRENT', source: { kind: 'current', elementId: 'L1' }, unit: 'A', floor: 1e-5 },
    { label: 'COIL TOP', source: { kind: 'voltage', node: 'a' }, unit: 'V' },
    { label: 'ACROSS SWITCH', source: { kind: 'voltage', node: 'sup', ref: 'a' }, unit: 'V' },
    { label: 'R1 POWER', source: { kind: 'power', elementId: 'R1' }, unit: 'W' },
    // sampled on every step and edge substep: catches the µs kick the readouts above miss
    { label: 'SWITCH PEAK', source: { kind: 'voltage', node: 'sup', ref: 'a' }, unit: 'V', peak: true },
  ],

  // Tap the button once (about 0.1 s) and one sweep holds the whole story: the exponential rise
  // (trigger on the current rising through 5 mA, normal mode so it holds), the plateau at 50 mA,
  // then the release. With D1 the switch channel steps to ≈ 5.7 V; with D1 removed it runs off the
  // top of the screen through the 50 V line.
  instruments: {
    scope: {
      channels: [
        {
          label: 'I COIL',
          source: { kind: 'current', elementId: 'L1' },
          perDiv: 0.02,
          offset: -3,
          marks: [{ value: 0.1, label: 'L1 100 mA' }],
        },
        {
          label: 'V SWITCH',
          source: { kind: 'voltage', node: 'sup', ref: 'a' },
          perDiv: 10,
          offset: -3.5,
          marks: [{ value: 50, label: 'SW1 50 V' }],
        },
      ],
      timePerDiv: 20e-3,
      trigger: { channel: 0, level: 0.005, slope: 'rising', mode: 'normal' },
    },
    chart: { signals: [0, 2, 4], span: 10 },
  },

  tweaks: [
    { label: 'PUSH BUTTON', elementId: 'SW1', key: 'closed', kind: 'momentary', min: 0, max: 1, unit: '' },
    { label: 'Inductance', elementId: 'L1', key: 'value', min: 0.1, max: 2, step: 0.1, unit: 'H' },
    { label: 'Series resistor', elementId: 'R1', key: 'value', min: 47, max: 470, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: the button is open, so the coil sees 0 A. Press and hold the push button to close the loop' },
    { when: { kind: 'above', readout: 0, value: 0.0005 }, text: 'RISING: {0} through the coil and still climbing toward 50 mA: the coil resists the change, τ = L/R' },
    { when: { kind: 'above', readout: 0, value: 0.0475 }, text: 'STEADY: {0}, the rise is over (after 3τ it is at 95%). The coil is now just a 18 Ω wire holding {3} in R1. Let go of the button' },
    { when: { kind: 'below', readout: 1, value: -0.3 }, text: 'FLYBACK: the coil’s top sits at {1} while D1 carries the current: the switch sees {2}' },
    { when: { kind: 'above', readout: 4, value: 20 }, text: 'KICK: the switch saw {4}, far above its 50 V rating' },
  ],

  failures: [
    {
      id: 'no-flyback',
      label: 'Remove the flyback diode',
      explain:
        'With D1 gone, letting go of the button leaves the coil’s 50 mA with only one place to go: across the opening contacts. v = L·di/dt would be tens of kilovolts, so the voltage climbs until air breaks down, about 330 V for a small gap, and the SCOPE shows the spike running off the top of the screen. That is far past SW1’s 50 V rating: the gap arcs, pitting the contacts until they weld shut (a stuck-on switch is the unsafe way to fail). The kick carries the coil’s stored ½·L·I² = ½ × 1 × 0.05² = 1.25 mJ, small, but delivered in microseconds. A transistor in this spot would avalanche and die instead.',
      patches: [{ op: 'remove', elementId: 'D1' }],
      parts: { hide: ['d1'] },
    },
    {
      id: 'reverse-diode',
      label: 'Fit the flyback diode backwards',
      explain:
        'Backwards, D1 is forward-biased straight across the supply as soon as you press the button: only the source’s 0.05 Ω and the diode’s own drop limit the current, so about 40 A flows, 80 times the switch’s 0.5 A rating and 40 times the diode’s 1 A. Both burn within about 300 ms. Check the stripe: the cathode must face the coil’s top, the positive side.',
      patches: [
        { op: 'remove', elementId: 'D1' },
        { op: 'add', element: { id: 'D1', type: 'D', nodes: ['a', '0'], rating: { maxI: 1, maxV: 1000 }, partId: 'd1rev' } },
      ],
      parts: { hide: ['d1'], show: ['d1rev'] },
    },
    {
      id: 'low-r',
      label: 'Swap R1 for 22 Ω',
      explain:
        'The loop now settles at 5/(18 + 22) ≈ 125 mA, over the choke’s 100 mA rating, so L1 overheats and is marked burnt. On a real iron-core choke it is worse: above its saturation current the core can’t carry more flux, the inductance collapses, and the current rises faster still, as if the coil were only a short length of wire. Hold the button and watch COIL CURRENT.',
      patches: [{ op: 'set', elementId: 'R1', key: 'value', value: 22 }],
    },
  ],

  guide: [
    {
      id: 'meet-the-choke',
      title: 'Meet the choke',
      body: 'Click the part labelled **CHOKE** to open its inspector. It is a **1 H** iron-core coil with about **18 Ω** of wire in its winding.',
      check: { kind: 'inspect', part: 'l1' },
      focus: { part: 'l1' },
      hint: 'It is the big wound coil on the breadboard between the red button and the resistor.',
      explain: 'An inductor stores energy in a magnetic field, E = ½·L·I². The 18 Ω of winding resistance is real copper, so it adds to R1 in the loop.',
    },
    {
      id: 'switch-on',
      title: 'Switch the supply on',
      body: 'Press **Switch supply on**. The button is still open, so **COIL CURRENT** stays at 0 and **ACROSS SWITCH** reads the whole supply, about **5 V**.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'power' }, { kind: 'status', is: 'POWERED' }, { kind: 'readout', index: 2, above: 4.5, below: 5.5, holdMs: 250 }] },
      focus: { control: 'power' },
      explain: 'An open switch drops the full supply voltage and carries nothing. The loop only exists while the button is pressed.',
    },
    {
      id: 'hold-the-button',
      title: 'Hold the button',
      body: 'Press and hold the red **push button** for a moment. **COIL CURRENT** climbs to V / R = 5 / (18 + 82) = **50 mA**.',
      check: { kind: 'all', of: [{ kind: 'tweak', target: 'PUSH BUTTON', min: 1 }, { kind: 'readout', index: 0, above: 0.045, below: 0.055, holdMs: 250 }] },
      focus: { control: 'tweak:PUSH BUTTON' },
      hint: 'Keep the mouse button down on the push button control: it springs open when you let go.',
      explain: 'The current does not jump: v = L·di/dt makes the coil fight any change. It rises as 1 − e^(−t/τ) with τ = L/R = 1 H / 100 Ω = 10 ms, and is within 5 % of 50 mA after 3τ = 30 ms.',
    },
    {
      id: 'let-go',
      title: 'Let go',
      body: 'Release the button. The diode catches the current, so **SWITCH PEAK** holds only about **5.8 V**, not thousands of volts.',
      check: { kind: 'all', of: [{ kind: 'readout', index: 0, below: 0.001, holdMs: 250 }, { kind: 'readout', index: 4, above: 5.5, below: 6.5, holdMs: 250 }] },
      focus: { part: 'd1' },
      explain: 'With the switch open, the coil still wants its 50 mA. D1 gives it a path, so the coil top swings to about −0.7 V and the switch sees 5 + 0.7 = 5.7 V. The stored ½·L·I² = 1.25 mJ is burnt off in D1 and the 100 Ω loop.',
    },
    {
      id: 'open-scope',
      title: 'Watch it on the scope',
      body: 'Open **Instruments**, then tap the button once and hold it long enough for the trace to flatten. **I COIL** is the exponential: 63 % of 50 mA, about **31 mA**, after one 10 ms time constant.',
      check: {
        kind: 'all',
        of: [{ kind: 'instruments' }, { kind: 'tweak', target: 'PUSH BUTTON', min: 1 }, { kind: 'readout', index: 0, above: 0.045, holdMs: 250 }],
      },
      focus: { control: 'instruments' },
      hint: 'The scope triggers when the coil current rises through 5 mA and holds the sweep, so one tap is enough.',
      explain: 'Each division is 20 ms. The curve flattens at 50 mA after about three divisions of 10 ms time constants. This is the same shape as a capacitor charging, with current in the place of voltage.',
    },
    {
      id: 'bigger-resistor',
      title: 'Fit a bigger resistor',
      body: 'Slide **Series resistor** to about **220 Ω**, then hold the button. The loop settles at 5 / (18 + 220) = **21 mA**, and τ = 1 / 238 shrinks to 4 ms.',
      check: {
        kind: 'all',
        of: [{ kind: 'tweak', target: 'Series resistor', min: 200, max: 250 }, { kind: 'readout', index: 0, above: 0.018, below: 0.024, holdMs: 250 }],
      },
      focus: { control: 'tweak:Series resistor' },
      hint: 'The slider is logarithmic. Anything from 200 to 250 Ω counts. Set it first, then hold the button.',
      explain: 'More resistance means a lower final current and a faster rise: the final value is V/R and the time constant is L/R, so a bigger R makes both smaller.',
    },
    {
      id: 'no-flyback',
      title: 'Break it: remove the diode',
      body: 'Open **Break something** and choose **Remove the flyback diode**. Then hold the button and let go. **SWITCH PEAK** jumps past **300 V**.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'no-flyback' }, { kind: 'readout', index: 4, above: 100 }] },
      focus: { control: 'break' },
      hint: 'The kick only happens when the button opens, so press and release it after you break the diode.',
      explain: 'Now the current has to stop in microseconds, and v = L·di/dt wants tens of kilovolts. The voltage climbs until the air gap breaks down at about 330 V, six times the switch rating of 50 V. The contacts arc and weld shut.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: they use τ = L / R and v = L · di/dt.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  meet: `An inductor resists *changes* in current: **v = L · di/dt**. Apply a voltage and the current ramps. Try to stop the current and the inductor generates whatever voltage it takes to keep it flowing.

**Current rise.** Hold the button. With R_total = 18 (winding) + 82 (R1) = 100 Ω:

i(t) = (V/R)·(1 − e^(−t/τ)),  τ = L/R = 1 H / 100 Ω = **10 ms**

The current heads for 5/100 = **50 mA**. At t = 0 it rises at di/dt = V/L = 5 A/s, about 5 mA in the first millisecond; after one τ it is at 63% (31.6 mA), after 3τ at 95%. Open the Instruments panel and tap the button to see exactly that curve.

**Energy.** E = ½LI² = ½ × 1 × 0.05² = **1.25 mJ**, the same energy the 100 µF capacitor held at 5 V in the previous lesson, but kept in a magnetic field instead of an electric one.

**Interrupting it.** Suppose a switch broke the 50 mA in 1 µs. Then v = L·Δi/Δt = 1 × 0.05 / 10⁻⁶ = **50 000 V** in principle. In practice the voltage only rises until something breaks down (air: about 330 V for a small gap), and that something is usually your switch. Remove the diode and let go to watch it happen.

**Flyback diode.** D1 sits reverse-biased while the button is held. When it opens, the coil current turns through D1 and the coil's top only swings to about −0.7 V, so the switch sees just 5.7 V. The loop still has a 100 Ω time constant, but D1's 0.7 V fixed drop makes the current reach zero in about 21 ms rather than coasting on forever. Its cathode must face the supply's positive side.`,

  mechanicalAnalogy: `Inductance is mass. Current is velocity, voltage is force: v = L·di/dt mirrors F = m·dv/dt. Stopping a moving mass instantly needs infinite force, just as a fast-closing valve causes water hammer. The flyback diode is a bypass check valve that lets the moving column coast around a loop and slow down gently.

**Where it breaks:** an iron-core inductor saturates. Above a certain current its "mass" suddenly falls, which a real mass never does. Its energy also lives in a magnetic field, not in moving matter.`,

  proTips: [
    'Every relay coil, solenoid, contactor and brushed motor gets a flyback diode, fitted right at the load: a 1N4148 for small signal relays, a 1N4007 or a Schottky (1N5819) for bigger coils.',
    'A plain diode makes relays and solenoids release slowly, because the current decays gently. A zener in series with the diode clamps higher and speeds release, at the cost of a bigger spike.',
    'Inductor datasheets give two currents: saturation (I_sat) and thermal (I_rms). Design to the lower of the two at your hottest operating temperature.',
  ],

  quiz: [
    {
      q: 'What is the time constant of 10 mH in series with 50 Ω?',
      options: ['0.2 ms', '2 ms', '5 ms', '500 ms'],
      answer: 0,
      why: 'τ = L/R = 0.01 / 50 = 0.2 ms.',
    },
    {
      q: 'This board’s loop heads for 50 mA. What is the current after 3τ?',
      options: ['31.6 mA', '43.2 mA', '50.0 mA', '47.5 mA'],
      answer: 3,
      why: '1 − e⁻³ = 0.95, so 0.95 × 50 mA = 47.5 mA.',
    },
    {
      q: 'The current in a 2 H coil drops by 0.1 A in 1 ms. What is the induced voltage?',
      options: ['0.2 V', '200 V', '20 V', '2000 V'],
      answer: 1,
      why: 'v = L·di/dt = 2 × 0.1 / 0.001 = 200 V.',
    },
    {
      q: 'What does the flyback diode do?',
      options: [
        'Speeds up the current rise',
        'Protects against reversed supply polarity',
        'Gives the coil current a path when the switch opens, clamping the spike',
        "Raises the coil's inductance",
      ],
      answer: 2,
      why: 'It lets the stored current freewheel and decay, so the voltage stays one diode drop beyond the rail.',
    },
  ],
}
