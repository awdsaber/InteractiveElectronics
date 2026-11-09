// T0 · Charge, Voltage and Current. Source: docs/curriculum/T0/charge-voltage-current.md
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

// Bench layout: meter on the left (rot 90: its jacks face the breadboard), breadboard in the middle,
// the cells behind it on the right. Wiring order round the loop: cells + -> switch -> ammeter ->
// R1 -> LED -> cells -. The cells' wires land on row a (back), the ammeter's on row e (front), and
// the parts sit between them on rows b-d, so no wire crosses a part.
const BB: [number, number] = [3.4, 0.6]
const PACK_AT: [number, number] = [5.4, -3.6]
const METER_AT: [number, number] = [-4.5, 0.6]
const METER_SCALE = 0.5

// breadboard columns: 12 = cells + / switch common, 11 = switch out / ammeter A, 8 = ammeter COM /
// R1 left, 4 = R1 right / LED anode, 3 = LED cathode / cells −
const swA = bbHole(BB, 11, 'c')
const swB = bbHole(BB, 13, 'c')
const r1Left = bbHole(BB, 8, 'd')
const r1Right = bbHole(BB, 4, 'd')
const ledCathode = bbHole(BB, 3, 'b')
const ledAnode = bbHole(BB, 4, 'b')

// where the pack's two flying leads end (red is farther from the viewer) and the meter's jacks
const packRed: [number, number, number] = [PACK_AT[0] - 3.9, BENCH_Y + 0.1, PACK_AT[1] - 0.15]
const packBlack: [number, number, number] = [PACK_AT[0] - 3.9, BENCH_Y + 0.1, PACK_AT[1] + 0.5]
const jackY = BENCH_Y + 1.64 * METER_SCALE
const jackX = METER_AT[0] + 5.5 * METER_SCALE // rot 90: the jack row points along +x
const jackA: [number, number, number] = [jackX, jackY, METER_AT[1] + 2.0 * METER_SCALE]
const jackCom: [number, number, number] = [jackX, jackY, METER_AT[1]]

const wRed = jumper(packRed, bbHole(BB, 12, 'a'), 'red')
const wSwOut = jumper(jackA, bbHole(BB, 11, 'e'), 'orange', 0.5)
const wRet = jumper(jackCom, bbHole(BB, 8, 'e'), 'blue', 0.5)
const wBlack = jumper(packBlack, bbHole(BB, 3, 'a'), 'black', 0.5)
// the "bypass the resistor" failure: a bare jumper bridges R1's two columns
const j1 = jumper(r1Left, r1Right, 'green', 0.22)

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

/**
 * 5 mm red LED: 30 mA absolute maximum forward current, 5 V reverse (datasheet-typical, e.g. the
 * Kingbright L-53 family). The sim's reverse limit adds 0.5 V as in T2/led-resistor, so exactly
 * 5 V of reverse bias would read "at the limit"; this lesson only ever applies 3 V.
 */
const LED_RATING = { maxI: 0.03, maxV: 5.5 }

export const lesson: LessonDef = {
  id: 'charge-voltage-current',
  track: 'T0',
  title: 'Charge, Voltage and Current',
  subtitle: 'Electrons on the move',
  tagline: 'Two AA cells push about 12 mA through a red LED: roughly 75 million billion electrons every second.',

  board: {
    name: 'CHARGE-01',
    size: [16.5, 8.6],
    frame: { size: [13.4, 6.6], center: [0.4, -0.6] }, // the circuit fills the view at default zoom
    base: 'breadboard-only',
    parts: [
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the parts; each 5-hole strip is one electrical node.' },
      {
        id: 'bat',
        kind: 'battery-aa-pack',
        pos: [PACK_AT[0], BENCH_Y, PACK_AT[1]],
        mount: 'offboard',
        label: 'CELLS',
        role: 'Two alkaline AA cells in series: about 3.0 V of push, 0.3 Ω inside.',
        params: { cells: 2, callout: [-1.8, 1.6, 1.0] },
        circuitIds: ['V_BAT'],
      },
      {
        id: 'sw',
        kind: 'switch-slide',
        pos: between(swA, swB),
        mount: 'tht',
        label: 'SWITCH',
        role: 'Opens or closes the loop. Open: the push is still there, but nothing can flow.',
        params: { callout: [1.8, 1.8, -0.8] },
        circuitIds: ['SW1'],
      },
      {
        id: 'meter',
        kind: 'multimeter',
        pos: [METER_AT[0], BENCH_Y, METER_AT[1]],
        rot: 90,
        mount: 'offboard',
        label: 'AMMETER',
        role: 'In series, so every coulomb passes through it. Counts the charge going by each second.',
        params: { mode: 'A', unit: 'mA', readout: 0, scale: METER_SCALE, title: 'AMMETER', callout: [0, 1.4, 0] },
        circuitIds: ['P_I'],
      },
      {
        id: 'r1',
        kind: 'resistor',
        pos: between(r1Left, r1Right),
        mount: 'tht',
        label: 'LIMIT',
        role: 'Sets how much current the loop allows: 100 Ω, 1/4 W carbon film (brown-black-brown-gold).',
        params: { ohms: 100, callout: [0.4, 1.9, 0.9] },
        circuitIds: ['R1'],
      },
      {
        id: 'led1',
        kind: 'led',
        pos: between(ledCathode, ledAnode),
        mount: 'tht',
        label: 'LAMP',
        role: '5 mm red LED: turns current into light, brighter as the current rises. Long leg (anode) toward the resistor.',
        params: { color: 'red', callout: [-2.2, 1.3, 1.2] },
        circuitIds: ['LED1'],
      },
      { id: 'w-red', kind: 'wire', ...wRed, mount: 'offboard', role: 'Cells + to the switch.' },
      { id: 'w-sw-out', kind: 'wire', ...wSwOut, mount: 'offboard', role: 'Switch out to the ammeter’s A jack.' },
      { id: 'w-ret', kind: 'wire', ...wRet, mount: 'offboard', role: 'Ammeter COM jack on to the resistor.' },
      { id: 'w-black', kind: 'wire', ...wBlack, mount: 'offboard', role: 'LED cathode back to the cells −: the loop is closed.' },
      {
        id: 'jumper',
        kind: 'wire',
        ...withCallout(j1, [0.3, 2.0, -0.3]),
        mount: 'offboard',
        label: 'JUMPER',
        role: 'A bare jumper where the resistor should be.',
        hidden: true,
      },
    ],
  },

  circuit: {
    elements: [
      // 2 × AA alkaline in series, about 0.15 Ω per fresh cell
      { id: 'V_BAT', type: 'V', nodes: ['bat+', '0'], value: 3.0, rInternal: 0.3, partId: 'bat' },
      // `closed: true`: the bench opens the power element until "Flip the switch"
      { id: 'SW1', type: 'SW', nodes: ['bat+', 'sw'], closed: true, rating: { maxI: 0.5 }, partId: 'sw' },
      { id: 'P_I', type: 'PROBE', nodes: ['sw', 'r_in'], partId: 'meter' }, // ammeter (ideal)
      { id: 'R1', type: 'R', nodes: ['r_in', 'led_a'], value: 100, rating: { maxP: 0.25, maxV: 250 }, partId: 'r1' },
      { id: 'LED1', type: 'LED', nodes: ['led_a', '0'], color: 'red', rating: LED_RATING, partId: 'led1' },
    ],
  },
  powerElementId: 'SW1',
  powerLabel: 'Flip the switch',

  readouts: [
    { label: 'CURRENT', source: { kind: 'current', elementId: 'P_I' }, unit: 'A', floor: 1e-6 },
    { label: 'BATTERY', source: { kind: 'voltage', node: 'bat+' }, unit: 'V' },
    { label: 'LED VOLTS', source: { kind: 'voltage', node: 'led_a' }, unit: 'V' },
    { label: 'CHARGE MOVED', source: { kind: 'behavior', key: 'coulomb-counter.coulombs' }, unit: 'C' },
    // the true count is 7.5e16 per second; the readout shows it in units of 10^15 ("millions of billions")
    { label: 'ELECTRONS/s ×10¹⁵', source: { kind: 'behavior', key: 'coulomb-counter.electronsE15' }, unit: '', digits: 3, floor: 0.01 },
    { label: 'ACROSS R1', source: { kind: 'voltage', node: 'r_in', ref: 'led_a' }, unit: 'V' },
  ],

  // Hook: a V element that is not a multiple of 1.5 V (e.g. a 9 V block) makes liveParams round to the
  // nearest cell count, so only 1.5 V packs should use `cells`. rInternal stays 0.3 Ω for every cell count.
  tweaks: [
    { label: 'Limit resistor', elementId: 'R1', key: 'value', min: 47, max: 1000, log: true, unit: 'Ω' },
    { label: 'Cells in series (1.5 V each)', elementId: 'V_BAT', key: 'value', min: 1.5, max: 4.5, step: 1.5, unit: 'V' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'LOOP CLOSED: {0} goes round, {4} million billion electrons every second, {3} moved so far' },
    { when: { kind: 'below', readout: 0, value: 0.0001 }, text: 'NO CURRENT: the loop is open or the LED is blocking, but the cells still read {1}' },
    { when: { kind: 'state', is: 'READY' }, text: 'SWITCH OPEN: the cells hold 3 V of push, but with no closed loop no charge moves' },
    { when: { kind: 'above', readout: 0, value: 0.02 }, text: "WARNING: {0} is above the LED's 20 mA continuous rating" },
    { when: { kind: 'above', readout: 0, value: 0.03 }, text: "DANGER: {0} is past the LED's 30 mA absolute maximum" },
    { when: { kind: 'state', is: 'FAULT' }, text: 'FAULT: a part burnt open, so the loop is broken and nothing flows' },
  ],

  failures: [
    {
      id: 'open-loop',
      label: 'Open the loop (pull the resistor out)',
      explain:
        'Charge can only flow around a complete loop. The battery still reads 3.0 V, and all 3.0 V now sits across the empty gap, but with no path no charge moves: 0 A, LED dark. Nothing spilled out of the cut wire.',
      patches: [{ op: 'remove', elementId: 'R1' }],
      parts: { hide: ['r1'] },
    },
    {
      id: 'bypass-resistor',
      label: 'Bypass the resistor with a jumper',
      explain:
        "An LED's current rises exponentially with voltage. With the resistor bypassed, only the cells' 0.3 Ω and the LED's own few ohms limit it, and 3 V is far above a red LED's ~1.8 V: the current jumps to 200+ mA (the 30 mA limit is exceeded almost at once) and after about 300 ms the LED burns open, so the current falls to 0.",
      patches: [{ op: 'short', a: 'r_in', b: 'led_a' }],
      parts: { hide: ['r1'], show: ['jumper'] },
    },
    {
      id: 'cells-reversed',
      label: 'Put the cells in backwards',
      explain:
        'An LED is a diode and conducts one way only. 3 V of reverse bias blocks it: about 0 A, LED dark, and no damage, because 3 V is inside the red LED’s 5 V reverse rating.',
      patches: [{ op: 'set', elementId: 'V_BAT', key: 'value', value: -3 }],
    },
  ],

  meet: `Press **Flip the switch**. Charge now goes round one closed loop: out of the cells, through the switch, **through the ammeter**, down the resistor, through the red LED and back into the cells. The ammeter sits *in* the loop so everything that flows must pass through it. It reads about **12 mA**, and the LED glows. Cut the loop anywhere and the reading drops to zero.

Now the three words. **Charge** (Q) is counted in coulombs; one coulomb is about 6.24 × 10¹⁸ electrons. **Current** (I) is how fast charge passes a point: 1 ampere = 1 coulomb per second, which is exactly what the ammeter counts. **Voltage** (V) is the energy each coulomb gains or gives up: 1 volt = 1 joule per coulomb.

Two AA cells give 3.0 V. The red LED takes about 1.8 V, so the resistor gets the rest:

I = (3.0 V − 1.8 V) / 100 Ω ≈ **12 mA**

That is 0.012 C/s, or 0.012 / 1.602 × 10⁻¹⁹ ≈ 7.5 × 10¹⁶ electrons every second. In one minute, Q = I·t = 0.012 × 60 = **0.72 C** goes around the loop. None of it is used up: the same charge comes back to the battery. What is spent is energy, at P = V·I = 3.0 × 0.012 = 36 mW.

The battery's rating converts the same way. 2500 mAh means 2.5 A·h = 2.5 × 3600 = 9000 C. At 12 mA that lasts 2500 / 12 ≈ **208 hours**, if the rating holds at this drain.

A note on direction, for later lessons. Current is drawn flowing from + to −, an old convention chosen before electrons were known. The electrons actually drift the other way, very slowly, but the push travels around the loop almost instantly.`,

  mechanicalAnalogy: `Think of a closed hydraulic loop. The battery is a pump that adds pressure (voltage), the flow rate is current, and the volume of fluid moved is charge. The resistor is an orifice and the LED is a check valve that needs some cracking pressure before it passes flow. As in hydraulics, the fluid is not used up; it goes around.

**Where it breaks:** cutting a wire does not spill anything. The "pressure" simply sits across the gap. And the push propagates at a large fraction of light speed, far faster than any pressure wave in oil.`,

  proTips: [
    'When a circuit does nothing, trace the return path back to the source’s negative terminal first. An open loop is the most common fault on any bench.',
    "A battery's mAh rating is specified at a light, stated discharge rate. At high currents an alkaline cell delivers noticeably less, so check the datasheet's curves rather than dividing.",
    'Agree on a polarity habit: red lead on the higher-potential side, and write down the sign of every reading. Negative numbers are information, not mistakes.',
  ],

  guide: [
    {
      id: 'find-the-limiter',
      title: 'Find the limit resistor',
      body: 'Click the resistor labelled **LIMIT** to open its inspector. **Brown-black-brown** is 100 Ω, and it is a 1/4 W part.',
      check: { kind: 'inspect', part: 'r1' },
      focus: { part: 'r1' },
      hint: 'The striped part on the breadboard between the ammeter lead and the red LED. Its LIMIT tag works too.',
      explain: 'Brown (1), black (0), brown (×10): 10 × 10 = 100 Ω. This part decides how much charge the loop allows to pass each second.',
    },
    {
      id: 'close-the-loop',
      title: 'Close the loop',
      body: 'Press **Flip the switch**. **CURRENT** reads about **12 mA**, and **ELECTRONS/s** shows about **78** (in millions of billions).',
      check: {
        kind: 'all',
        of: [
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 0, above: 0.011, below: 0.014, holdMs: 300 },
          { kind: 'readout', index: 4, above: 70, below: 85, holdMs: 300 },
        ],
      },
      focus: { control: 'power' },
      explain: 'The resistor gets what the LED leaves: (3.0 − 1.8 V) / 100 Ω ≈ 12 mA. One ampere is one coulomb per second, and a coulomb is 6.24 × 10¹⁸ electrons, so 12 mA is about 7.5 × 10¹⁶ electrons every second.',
    },
    {
      id: 'fit-470',
      title: 'Fit a bigger resistor',
      body: 'Slide **Limit resistor** to about **470 Ω**. The current falls to about **3 mA**, so fewer electrons pass each second.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Limit resistor', min: 400, max: 550 },
          { kind: 'readout', index: 0, above: 0.0025, below: 0.0035, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Limit resistor' },
      hint: 'The slider is logarithmic. Anything from 400 to 550 Ω counts.',
      explain: 'Same push, more opposition, less flow: I = (3.0 − 1.6) / 470 ≈ 3 mA. The LED drop sags a little at the lower current, which is why 1.6 V and not 1.8 V.',
    },
    {
      id: 'more-push',
      title: 'Add a cell',
      body: 'Slide **Cells in series** up to **4.5 V** (three cells). Keep the 470 Ω: the current doubles to about **6 mA**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Cells in series (1.5 V each)', min: 4.4 },
          { kind: 'readout', index: 0, above: 0.0052, below: 0.0068, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Cells in series (1.5 V each)' },
      explain: 'More voltage means more energy per coulomb, so more coulombs per second get pushed through the same opposition: (4.5 − 1.65) / 470 ≈ 6 mA.',
    },
    {
      id: 'open-the-loop',
      title: 'Break it: open the loop',
      body: 'Open **Break something** and choose **Open the loop**. **CURRENT** drops to 0 and the LED goes dark, but **BATTERY** still shows the full push.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'open-loop' }, { kind: 'readout', index: 0, below: 0.00001, holdMs: 300 }] },
      focus: { control: 'break' },
      explain: 'Charge can only flow around a closed loop. The battery voltage is still there, and all of it now sits across the gap, but with no path nothing moves. Nothing spills out of the cut.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** and choose **Repair all**. The current comes back.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'repair' }, { kind: 'readout', index: 0, above: 0.004, holdMs: 300 }] },
      focus: { control: 'break' },
    },
    {
      id: 'bypass-it',
      title: 'Break it: bypass the resistor',
      body: 'Choose **Bypass the resistor with a jumper**. Now only the cells and the LED limit the current. Watch what happens to the LED.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'bypass-resistor' }, { kind: 'status', is: 'FAULT' }] },
      focus: { control: 'break' },
      hint: 'Give it a moment: a part takes a few hundred milliseconds to burn.',
      explain: 'An LED passes current exponentially with voltage. Without the resistor the current leaps far past its 30 mA absolute maximum, the LED burns open and the loop is broken again. The resistor was the only thing choosing the current.',
    },
    {
      id: 'repair-again',
      title: 'Repair again',
      body: 'Choose **Repair all** once more to fit a new LED.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'repair' }, { kind: 'readout', index: 0, above: 0.004, holdMs: 300 }] },
      focus: { control: 'break' },
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: charge, current and voltage in numbers.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  quiz: [
    {
      q: 'A loop carries 12 mA for 10 minutes. How much charge passed?',
      options: ['0.12 C', '72 C', '720 C', '7.2 C'],
      answer: 3,
      why: 'Q = I·t = 0.012 A × 600 s = 7.2 C.',
    },
    {
      q: 'What does "1 volt" mean physically?',
      options: ['One joule of energy per coulomb of charge', 'One coulomb per second', 'One watt per ampere squared', 'The number of electrons in a wire'],
      answer: 0,
      why: 'Voltage is energy per unit charge, 1 V = 1 J/C.',
    },
    {
      q: 'A 2500 mAh pack powers a 12 mA load. Roughly how long does it last?',
      options: ['21 h', '30 h', '208 h', '2083 h'],
      answer: 2,
      why: '2500 mAh / 12 mA ≈ 208 h, if the rating holds at that drain.',
    },
    {
      q: 'With R1 pulled out, what voltage does a meter read across the empty gap?',
      options: ['0 V', '3.0 V', '1.2 V', '1.8 V'],
      answer: 1,
      why: 'With no current there is no drop across the LED or the internal resistance, so the full 3.0 V appears across the gap.',
    },
  ],

  behaviors: [{ id: 'coulomb-counter', params: { element: 'P_I' } }],
}
