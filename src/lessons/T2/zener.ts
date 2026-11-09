// T2 · The Zener Regulator. Source: docs/curriculum/T2/zener.md
//
// A 9 V battery behind a slide switch, a 120 Ω series resistor (R1), a 1N4733A across the output and
// a 510 Ω load. No behavior is needed: the ZENER element's `rz` gives the soft knee (so V OUT moves a
// few tens of mV with load), and the engine's rth / tauTh / tMax ratings on R1 and Z1 do the heat.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

// Bench layout: the 9 V battery at the left, the breadboard centre, the meter behind it with its jacks
// facing the breadboard (rot 0: the LCD reads upright). The circuit sits in rows b-e; both lots of
// leads (battery and meter) land on row a/b at the back, so no wire crosses a part.
const BB: [number, number] = [1.2, 0.2]
const BAT_AT: [number, number] = [-6.2, -1.7]
const DMM_AT: [number, number] = [1.15, -4.9]
const DMM_SCALE = 0.34

// columns: 9-11 switch (11 = out, 10 = common / battery +); 11 = R1 left; 14 = ground (zener anode,
// load bottom, battery −, meter COM); 18 = output node (R1 right, zener cathode, load top, meter V)
const swOut = bbHole(BB, 11, 'c')
const swIn = bbHole(BB, 9, 'c')
const r1Left = bbHole(BB, 11, 'e')
const r1Right = bbHole(BB, 18, 'e')
const zTop = bbHole(BB, 18, 'c') // cathode (banded end)
const zBot = bbHole(BB, 14, 'c')
const rlTop = bbHole(BB, 18, 'd')
const rlBot = bbHole(BB, 14, 'd')

// the 9 V battery faces +x (rot 180): its snaps sit on the end nearest the breadboard, + on the front side
const SNAP_Y = BENCH_Y + 0.875
const batPlus: [number, number, number] = [BAT_AT[0] + 2.62, SNAP_Y, BAT_AT[1] + 0.5]
const batMinus: [number, number, number] = [BAT_AT[0] + 2.62, SNAP_Y, BAT_AT[1] - 0.5]
const jackY = BENCH_Y + (1.5 + 0.19) * DMM_SCALE
// meter at rot 0: jack row on its front edge, V on the right
const jackV: [number, number, number] = [DMM_AT[0] + 2.0 * DMM_SCALE, jackY, DMM_AT[1] + 5.5 * DMM_SCALE]
const jackCom: [number, number, number] = [DMM_AT[0], jackY, DMM_AT[1] + 5.5 * DMM_SCALE]

const wPlus = jumper(batPlus, bbHole(BB, 10, 'a'), 'red', 0.5)
const wMinus = jumper(batMinus, bbHole(BB, 14, 'b'), 'black', 0.9)
const wMeterV = jumper(jackV, bbHole(BB, 18, 'a'), 'yellow', 0.5)
const wMeterCom = jumper(jackCom, bbHole(BB, 14, 'a'), 'blue', 0.5)

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

/**
 * Z1: 1N4733A (DO-41, 1 W): Vz 5.1 V at Izt = 49 mA, Zzt = 7 Ω at Izt. The sim's `vz` is the voltage at
 * 5 mA on a straight line of slope `rz` above it, so 5.1 V − (49 − 5) mA × 7 Ω = 4.79 V reproduces the
 * datasheet point (about 4.92 V at the 24 mA this board runs, about 5.2 V at 70 mA).
 * Thermal: ON Semiconductor's 1N47xxA sheet gives 1 W at a 50 °C lead temperature, derated 6.67 mW/°C
 * (150 °C/W) to a 200 °C junction. On the 25 °C bench Tj = 25 + 150·P (so the 1 W rating is 175 °C).
 */
const Z1_VZ = 4.79
const Z1_RZ = 7
const Z1_RATING = { maxP: 1.0, rth: 150, tauTh: 6, tMax: 200 }
/** R1: 1/4 W carbon film, 0.25 W at 70 °C derated to zero at 155 °C → 340 °C/W (as in T0/power-heat) */
const R1_RATING = { maxP: 0.25, maxV: 250, rth: 340, tauTh: 5, tMax: 155 }

export const lesson: LessonDef = {
  id: 'zener',
  track: 'T2',
  title: 'The Zener Regulator',
  subtitle: 'Clamping with breakdown',
  tagline: '120 Ω and a 1N4733A hold about 4.9 V from a 9 V battery while about 24 mA spills through the zener.',

  board: {
    name: 'ZEN-17',
    size: [17, 12],
    frame: { size: [10, 6.2], center: [-1.2, -3.0] }, // battery, breadboard and meter fill the view
    base: 'breadboard-only',
    parts: [
      {
        id: 'bat',
        kind: 'battery-9v',
        pos: [BAT_AT[0], BENCH_Y, BAT_AT[1]],
        rot: 180,
        mount: 'offboard',
        label: 'BATTERY',
        role: 'Unregulated input: a 9 V alkaline block with about 1.5 Ω inside.',
        params: { callout: [0, 1.6, 0.4] },
        circuitIds: ['V_BAT'],
      },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the regulator.' },
      {
        id: 'sw',
        kind: 'switch-slide',
        pos: between(swOut, swIn),
        mount: 'tht',
        label: 'SWITCH',
        role: 'Connects the battery to the regulator.',
        params: { callout: [-0.6, 1.6, -0.2] },
        circuitIds: ['SW1'],
      },
      {
        id: 'r1',
        kind: 'resistor',
        pos: between(r1Left, r1Right),
        mount: 'tht',
        label: 'DROP',
        role: 'Takes up the difference between the battery and the zener: 120 Ω, 1/4 W (brown-red-brown-gold).',
        params: { ohms: 120, span: 1.778, callout: [0, 1.6, 1.0] },
        circuitIds: ['R1'],
      },
      {
        id: 'z1',
        kind: 'zener',
        pos: between(zTop, zBot),
        mount: 'tht',
        label: 'CLAMP',
        role: '1N4733A, 5.1 V 1 W zener. Holds the output near 5 V by soaking up whatever current the load does not take. Banded end to the output.',
        params: { span: 1.016, callout: [0.2, 1.8, -0.9] },
        circuitIds: ['Z1', 'P_Z'],
      },
      {
        // F3: the same zener fitted the wrong way round
        id: 'z1rev',
        kind: 'zener',
        pos: between(zTop, zBot),
        rot: 180,
        mount: 'tht',
        label: 'CLAMP',
        role: 'The zener fitted backwards: banded end to ground, so it is forward-biased and clamps at one diode drop.',
        params: { span: 1.016, callout: [0.2, 1.8, -0.9] },
        circuitIds: ['Z1', 'P_Z'],
        hidden: true,
      },
      {
        id: 'rl',
        kind: 'resistor',
        pos: between(rlTop, rlBot),
        mount: 'tht',
        label: 'LOAD',
        role: 'A 510 Ω load (green-brown-brown-gold): about 10 mA at 5 V. Slide it to change what the regulator must supply.',
        params: { ohms: 510, callout: [1.2, 1.5, 0.8] },
        circuitIds: ['R_LOAD'],
      },
      {
        id: 'dmm',
        kind: 'multimeter',
        pos: [DMM_AT[0], BENCH_Y, DMM_AT[1]],
        mount: 'offboard',
        label: 'METER',
        role: 'Reads the output voltage across the load.',
        params: { mode: 'V', readout: 0, scale: DMM_SCALE, title: 'V OUT', callout: [0, 1.4, 0] },
      },
      { id: 'w-bat-p', kind: 'wire', ...wPlus, mount: 'offboard', role: 'Battery + to the switch.' },
      { id: 'w-bat-n', kind: 'wire', ...wMinus, mount: 'offboard', role: 'Battery − to the ground column.' },
      { id: 'w-v', kind: 'wire', ...withCallout(wMeterV, [-0.9, 0.5, 0]), mount: 'offboard', role: 'Meter V jack to the output node.' },
      { id: 'w-com', kind: 'wire', ...withCallout(wMeterCom, [0.9, 0.5, 0]), mount: 'offboard', role: 'Meter COM to ground.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_BAT', type: 'V', nodes: ['b', '0'], value: 9, rInternal: 1.5, partId: 'bat' },
      // `closed: true`: the bench opens the power element until "Connect battery"
      { id: 'SW1', type: 'SW', nodes: ['b', 's'], closed: true, partId: 'sw' },
      { id: 'R1', type: 'R', nodes: ['s', 'z'], value: 120, rating: R1_RATING, partId: 'r1' },
      // an in-line ammeter on the zener's cathode lead, so its breakdown current reads positive
      { id: 'P_Z', type: 'PROBE', nodes: ['z', 'zc'], partId: 'z1' },
      { id: 'Z1', type: 'ZENER', nodes: ['0', 'zc'], vz: Z1_VZ, rz: Z1_RZ, rating: Z1_RATING, partId: 'z1' },
      { id: 'R_LOAD', type: 'R', nodes: ['z', '0'], value: 510, rating: { maxP: 0.25, maxV: 250 }, partId: 'rl' },
    ],
  },
  powerElementId: 'SW1',
  powerLabel: 'Connect battery',

  readouts: [
    { label: 'V OUT', source: { kind: 'voltage', node: 'z' }, unit: 'V' },
    { label: 'ZENER CURRENT', source: { kind: 'current', elementId: 'P_Z' }, unit: 'A' },
    { label: 'LOAD CURRENT', source: { kind: 'current', elementId: 'R_LOAD' }, unit: 'A' },
    { label: 'R1 POWER', source: { kind: 'power', elementId: 'R1' }, unit: 'W' },
    { label: 'ZENER POWER', source: { kind: 'power', elementId: 'Z1' }, unit: 'W' },
    { label: 'R1 TEMP', source: { kind: 'extra', key: 'R1.tj' }, unit: '°C', digits: 3, warnAbove: 90 },
  ],

  tweaks: [
    { label: 'Input voltage', elementId: 'V_BAT', key: 'value', min: 0, max: 15, step: 0.1, unit: 'V' },
    { label: 'Load resistance', elementId: 'R_LOAD', key: 'value', min: 47, max: 10000, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'REGULATING: {0} at the output; R1 passes {1} into the zener and {2} into the load' },
    { when: { kind: 'below', readout: 1, value: 0.005 }, text: 'OUT OF REGULATION: the zener carries only {1}, so V OUT ({0}) just follows the input and the load' },
    { when: { kind: 'state', is: 'READY' }, text: 'SWITCH OPEN: the battery is disconnected, the regulator is dead' },
    { when: { kind: 'above', readout: 5, value: 90 }, text: 'WARNING: R1 is dissipating {3} and has reached {5}; a 1/4 W carbon-film part fails at 155 °C' },
    { when: { kind: 'state', is: 'FAULT' }, text: 'FAULT: a part burnt open and the regulator is no longer fed' },
  ],

  failures: [
    {
      id: 'adapter-15v',
      label: 'Plug in a 15 V adapter',
      explain:
        'R1 now drops about 10 V and carries ≈ 80 mA: P = (15 − 5.1)²/120 ≈ 0.8 W, over three times its 1/4 W rating. Its body climbs past 155 °C in a few seconds and it burns open, so V OUT collapses to 0. The zener (≈ 0.37 W of its 1 W) was fine: the resistor was the weak link.',
      patches: [{ op: 'set', elementId: 'V_BAT', key: 'value', value: 15 }],
    },
    {
      id: 'heavy-load',
      label: 'Ask for too much current (100 Ω load)',
      explain:
        'A 100 Ω load at 5 V wants about 50 mA, but R1 can supply only ≈ 33 mA. The zener has nothing left to sink, drops out of breakdown, and the circuit is just a divider: 9 × 100/221.5 ≈ 4.06 V. A zener can only absorb surplus current; it cannot make up a shortfall.',
      patches: [{ op: 'set', elementId: 'R_LOAD', key: 'value', value: 100 }],
    },
    {
      id: 'zener-backwards',
      label: 'Fit the zener backwards',
      explain:
        'Forward-biased, a zener is just a diode: it clamps at one diode drop, ≈ 0.7 V. R1 now carries (9 − 0.7)/121.5 ≈ 68 mA, which is 0.56 W in a 1/4 W resistor, and it burns. The only thing wrong is which way round the banded end faces.',
      patches: [
        { op: 'remove', elementId: 'Z1' },
        { op: 'add', element: { id: 'Z1', type: 'ZENER', nodes: ['zc', '0'], vz: Z1_VZ, rz: Z1_RZ, rating: Z1_RATING, partId: 'z1rev' } },
      ],
      parts: { hide: ['z1'], show: ['z1rev'] },
    },
  ],

  guide: [
    {
      id: 'meet-the-zener',
      title: 'Meet the zener',
      body: 'Click **Z1** to open its inspector. It is a **1N4733A**: 5.1 V, 1 W. The banded end is the **cathode**, and it faces the output.',
      check: { kind: 'inspect', part: 'z1' },
      focus: { part: 'z1' },
      hint: 'It is the small glass diode on the breadboard, across the output, with a band at one end.',
      explain: 'Wired in reverse, a zener stops conducting until the voltage across it reaches its breakdown voltage V_Z, then conducts hard and holds that voltage. Forward, it is just a diode, which is why the band must face the right way.',
    },
    {
      id: 'connect',
      title: 'Connect the battery',
      body: 'Press **Connect battery**. **V OUT** sits at about **4.9 V** and **ZENER CURRENT** at about **24 mA**, from a 9 V battery through R1 = 120 Ω.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'power' },
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 0, above: 4.7, below: 5.2, holdMs: 300 },
          { kind: 'readout', index: 1, above: 0.018, below: 0.03, holdMs: 300 },
        ],
      },
      focus: { control: 'power' },
      explain: 'R1 carries (9 − 4.93) / 120 = 34 mA. The 510 Ω load takes 9.7 mA of it, and the zener sinks the other 24 mA. The zener works by soaking up whatever the load leaves.',
    },
    {
      id: 'low-input',
      title: 'Starve it',
      body: 'Slide **Input voltage** down to about **6 V**. **ZENER CURRENT** falls to about **1 mA** and **V OUT** to **4.7 V**: the zener has come off its breakdown.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Input voltage', max: 6.5 },
          { kind: 'readout', index: 0, above: 4.5, below: 4.9, holdMs: 300 },
          { kind: 'readout', index: 1, below: 0.003, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Input voltage' },
      hint: 'The slider goes in steps of 0.1 V. Anything from 4.5 V up to 6.5 V works, but not much lower or the output collapses too.',
      explain: 'With so little input the zener has almost no current to sink, so it has left breakdown and stopped regulating: V OUT just follows the input through the divider that R1 and the load make. A zener regulator needs the input comfortably above V_Z.',
    },
    {
      id: 'ten-volts',
      title: 'Feed it 10 V',
      body: 'Slide **Input voltage** up to **10 V**. The input rose by 4 V, but **V OUT** is still about **5 V**, and **ZENER CURRENT** soaks the extra, about **31 mA**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Input voltage', min: 9.5, max: 10.5 },
          { kind: 'readout', index: 0, above: 4.9, below: 5.2, holdMs: 300 },
          { kind: 'readout', index: 1, above: 0.026, below: 0.04, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Input voltage' },
      explain: 'The zener’s 7 Ω dynamic resistance makes V OUT rise a little (tens of millivolts) while the input rises volts. The extra current has to go somewhere, and R1 gets hotter: R1 POWER is now about 0.2 W of its 1/4 W rating.',
    },
    {
      id: 'heavy-load',
      title: 'Ask for too much',
      body: 'Slide **Load resistance** down to about **100 Ω**. The load wants 50 mA but R1 can supply only about 40 mA, so the zener has nothing to sink and **V OUT** sags below **4.7 V**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Load resistance', min: 80, max: 130 },
          { kind: 'readout', index: 0, below: 4.7, holdMs: 300 },
          { kind: 'readout', index: 1, below: 0.003, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Load resistance' },
      explain: 'A zener can only absorb a surplus of current. It cannot make up a shortfall. Once the load takes everything R1 can pass, the regulator is just a divider, 10 × 100 / 220 = 4.5 V, and the output follows the input again.',
    },
    {
      id: 'adapter-15v',
      title: 'Break it: a 15 V adapter',
      body: 'Open **Break something** and choose **Plug in a 15 V adapter**. **R1 POWER** jumps past **0.5 W** and **R1 TEMP** climbs fast.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'adapter-15v' }, { kind: 'readout', index: 5, above: 100 }] },
      focus: { control: 'break' },
      hint: 'R1 TEMP rises toward 155 °C, the failure point of a 1/4 W carbon film resistor. Give it a few seconds.',
      explain: 'R1 drops about 10 V and passes about 80 mA: P = (15 − 5.1)² / 120 ≈ 0.8 W in a 1/4 W part. The zener, at about 0.4 W of its 1 W, was fine. The series resistor is the weak link, and when it burns open the output falls to 0.',
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
      body: 'Answer the questions in **Check yourself** below: they use the series resistor equation and the zener’s power.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  meet: `A zener is a diode built to break down in reverse at a precise voltage: **5.1 V** for the 1N4733A, measured at its 49 mA test current. In breakdown the voltage barely moves as current changes. That steepness is its **dynamic resistance**, about **7 Ω** here: 10 mA more current raises the voltage by only 70 mV. So the zener can hold a node steady by sinking whatever current the load does not take.

**Shunt regulator.** R1 drops the difference, and its current splits between the load and the zener. Press **Connect battery**:

- V OUT is typically **4.9 V**, a little under the 5.1 V label, because the label is at 49 mA and we run at about 24 mA: 5.1 − 25 mA × 7 Ω ≈ 4.92 V. The label voltage only holds at the test current, and a real part is ±5 % (4.85 to 5.36 V). Near the knee (1 mA) the dynamic resistance is far higher, about 400 Ω, so low-current regulation is poor.
- I_R1 = (9 − 4.92)/(120 + 1.5) ≈ **33.6 mA** (1.5 Ω is the battery's own resistance)
- I_load = 4.92/510 ≈ **9.7 mA**
- I_z = 33.6 − 9.7 ≈ **24 mA**

**Slide the input voltage up from 0.** Below about 5 V the output follows the input like a plain divider; the zener turns on gradually over the next volt or so (its soft knee) and V OUT flattens once V_in exceeds about 6 V: 2 V more input at the top of the range moves the output only about 0.1 V (that is 7 Ω × the extra current).

**Design equation.** R = (V_in,min − V_z)/(I_load,max + I_z,min). Keep at least about 5 mA through the zener so it stays in breakdown. With I_z,min = 5 mA the 120 Ω part supports loads up to about (9 − 4.79)/121.5 − 5 mA ≈ **29 mA**; below roughly 160 Ω of load, regulation is lost (failure 2).

**Worst-case dissipation** comes at maximum input with no load, when everything flows through the zener. At 15 V R1 dissipates (15 − 5.1)²/120 = **0.8 W**, so the 1/4 W resistor fails first (failure 1). Check R1's thermal rating the way you did in the Power and Heat lesson: here its body temperature is a readout.

**Efficiency.** The load gets about 4.9 V × 9.7 mA = 48 mW of the 9 V × 33.6 mA = 302 mW the battery supplies, about **16 %**. Zeners make excellent references, clamps and protection parts, but poor power supplies.

Zeners near 5–6 V have almost no temperature drift, which is why the first precision references were built on them.`,

  mechanicalAnalogy: `A zener shunt regulator is a pressure-relief valve teed across the load, fed from the supply through an orifice (R1). The valve holds the line pressure by dumping whatever flow the load doesn't need back to tank. When the load demands more than the orifice can deliver, the valve shuts and pressure sags.

**Where it breaks:** relief valves have hysteresis and can chatter. A zener has a smooth, soft knee and no memory, but its clamp voltage still creeps up with current (that 7 Ω) and drifts a little with temperature.`,

  proTips: [
    'Use zeners for references, voltage clamps and input protection. For supply rails, a linear regulator or a shunt reference like the TL431 is far better.',
    'A resistor plus a zener (or a TVS diode) on an input pin is a cheap clamp against overvoltage from cables and sensors.',
    'Always run both corner cases: highest V_in with no load (dissipation), and lowest V_in with maximum load (regulation).',
  ],

  quiz: [
    {
      q: '12 V in, 5.1 V out, 20 mA load, 5 mA minimum zener current. What series resistor?',
      options: ['204 Ω', '276 Ω', '345 Ω', '480 Ω'],
      answer: 1,
      why: 'R = (12 − 5.1)/(0.020 + 0.005) = 276 Ω, so fit the nearest standard value, 270 Ω.',
    },
    {
      q: 'With no load, 30 mA flows through a 5.1 V zener. How much does it dissipate?',
      options: ['0.153 W', '0.03 W', '0.51 W', '1.53 W'],
      answer: 0,
      why: 'P = V_z × I_z = 5.1 × 0.030 = 0.153 W.',
    },
    {
      q: 'The load demands more current than R1 can supply. What happens?',
      options: [
        'The zener supplies the extra',
        'The output stays at V_z',
        'The zener leaves breakdown and V_out falls below V_z',
        'The zener burns out',
      ],
      answer: 2,
      why: 'A zener can only sink current. With nothing left over for it, the circuit becomes a plain divider.',
    },
    {
      q: 'This board is fed 15 V with no load. What does R1 (120 Ω) dissipate, ignoring the battery’s internal resistance?',
      options: ['0.13 W', '0.36 W', '1.9 W', '0.82 W'],
      answer: 3,
      why: '(15 − 5.1)²/120 = 98/120 ≈ 0.82 W.',
    },
  ],
}
