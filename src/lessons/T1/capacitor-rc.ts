// T1 · Capacitors and RC Time. Source: docs/curriculum/T1/capacitor-rc.md
//
// A 5 V supply (V_SUP, plugged in with the power button), a slide switch (SW_CHG, a toggle tweak, open
// at the start) feeding 10 kΩ (R1) into a 100 µF / 16 V aluminium electrolytic (C1), plus a DRAIN
// button (SW_DIS, momentary) that discharges C1 through 1 kΩ (R_DIS). No behavior is needed: the
// engine's C element integrates v(t) = V(1 − e^(−t/RC)) and the instrument panel draws it. C1 is
// `polarized`: reverse voltage beyond 1 V fails it short; `rating.maxV` 16 with failMode 'short' covers
// the overvoltage case.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, bbHole, between, jumper } from '../layout'

// Bench layout: the 5 V supply back left, the breadboard in the middle, the meter behind it.
const BB: [number, number] = [1.0, 0.2]
const PSU_AT: [number, number] = [-5.6, -3.4]
const DMM_AT: [number, number] = [0.96, -4.9]
const DMM_SCALE = 0.34

// columns: 9-11 switch (10 = supply +, 11 = out); R1 11 → 18; node vc = column 18 (R1 right, C1 +, meter V,
// jumper to the button); C1 − = column 19; button columns 22 and 25; R_DIS 25 → 29; ground = the top rail
const swOut = bbHole(BB, 11, 'c')
const swIn = bbHole(BB, 9, 'c')
const r1Left = bbHole(BB, 11, 'e')
const r1Right = bbHole(BB, 18, 'e')
const c1Plus = bbHole(BB, 18, 'c')
const c1Minus = bbHole(BB, 19, 'c')
const rdTop = bbHole(BB, 25, 'd')
const rdBot = bbHole(BB, 29, 'd')
const btnAt: [number, number, number] = [(bbHole(BB, 23, 'e')[0] + bbHole(BB, 24, 'e')[0]) / 2, bbHole(BB, 23, 'e')[1], BB[1]]

// supply posts (front edge of the module) and the meter's V and COM jacks (rot 0: upright LCD)
const POST_Y = BENCH_Y + 0.16 + 0.12
const postPlus: [number, number, number] = [PSU_AT[0] + 1.1, POST_Y, PSU_AT[1] + 0.95]
const postMinus: [number, number, number] = [PSU_AT[0] + 0.5, POST_Y, PSU_AT[1] + 0.95]
const jackY = BENCH_Y + (1.5 + 0.19) * DMM_SCALE
const jackV: [number, number, number] = [DMM_AT[0] + 2.0 * DMM_SCALE, jackY, DMM_AT[1] + 5.5 * DMM_SCALE]
const jackCom: [number, number, number] = [DMM_AT[0], jackY, DMM_AT[1] + 5.5 * DMM_SCALE]

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const wPlus = jumper(postPlus, bbHole(BB, 10, 'a'), 'red', 0.5)
const wMinus = jumper(postMinus, bbHole(BB, 8, '-t'), 'black', 0.5)
const wMeterV = jumper(jackV, bbHole(BB, 18, 'a'), 'yellow', 0.5)
const wMeterCom = jumper(jackCom, bbHole(BB, 14, '-t'), 'blue', 0.4)
const wC1Gnd = jumper(bbHole(BB, 19, 'a'), bbHole(BB, 19, '-t'), 'black', 0.2)
const wDrain = jumper(bbHole(BB, 18, 'b'), bbHole(BB, 22, 'b'), 'green', 0.3)
const wRdGnd = jumper(bbHole(BB, 29, 'a'), bbHole(BB, 29, '-t'), 'black', 0.2)

/** C1: 100 µF, 16 V, ±20 %, Ø6.3 × 11 mm aluminium electrolytic (e.g. Nichicon UVR1C101MED, ESR and leakage not modelled) */
const C1_RATING = { maxV: 16, failMode: 'short' as const }
const R_RATING = { maxP: 0.25, maxV: 250 }

export const lesson: LessonDef = {
  id: 'capacitor-rc',
  track: 'T1',
  title: 'Capacitors and RC Time',
  subtitle: 'Charge takes time',
  tagline: '10 kΩ feeding 100 µF gives τ = 1 s, so the capacitor reaches 63 % of 5 V (3.16 V) one second after the switch closes.',

  board: {
    name: 'RC-10',
    size: [17, 12],
    base: 'breadboard-only',
    parts: [
      {
        id: 'psu',
        kind: 'module',
        pos: [PSU_AT[0], BENCH_Y, PSU_AT[1]],
        mount: 'offboard',
        label: 'SUPPLY',
        role: 'A fixed 5 V bench supply. The power button plugs it in.',
        params: { title: '5 V SUPPLY', color: '#5f6b75', w: 3.4, d: 2.4, pins: 0, chip: 'none', callout: [-0.4, 1.6, -0.3] },
        circuitIds: ['V_SUP'],
      },
      { id: 'post-p', kind: 'testpoint', pos: postPlus, mount: 'offboard', role: 'Supply + output post.', params: { color: 'red' } },
      { id: 'post-n', kind: 'testpoint', pos: postMinus, mount: 'offboard', role: 'Supply − output post.', params: { color: 'black' } },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the parts.' },
      {
        id: 'sw1',
        kind: 'switch-slide',
        pos: between(swOut, swIn),
        mount: 'tht',
        label: 'CHARGE',
        role: 'Connects the supply to the timing resistor. Open, nothing can flow in or out of the capacitor except through DRAIN.',
        params: { callout: [-0.5, 1.5, -0.4] },
        circuitIds: ['SW_CHG'],
      },
      {
        id: 'r1',
        kind: 'resistor',
        pos: between(r1Left, r1Right),
        mount: 'tht',
        label: 'TIMING',
        role: 'Limits the charging current and sets τ with C1: 10 kΩ, 1/4 W (brown-black-orange-gold).',
        params: { ohms: 10000, span: 1.778, callout: [0, 1.4, 0.9] },
        circuitIds: ['R1'],
      },
      {
        id: 'c1',
        kind: 'capacitor-electrolytic',
        pos: between(c1Plus, c1Minus),
        mount: 'tht',
        label: 'TANK',
        role: '100 µF, 16 V aluminium electrolytic, ±20 %. Stores charge; its voltage cannot jump. The stripe marks the negative lead, here on the right.',
        params: { d: 0.63, h: 1.1, callout: [0.4, 1.6, -0.5] },
        circuitIds: ['C1'],
      },
      {
        // F4: the same capacitor fitted the wrong way round
        id: 'c1rev',
        kind: 'capacitor-electrolytic',
        pos: between(c1Plus, c1Minus),
        rot: 180,
        mount: 'tht',
        label: 'TANK',
        role: 'The capacitor fitted backwards: the stripe (negative) is on the lead that now goes to the charged node.',
        params: { d: 0.63, h: 1.1, callout: [0.4, 1.6, -0.5] },
        circuitIds: ['C1'],
        hidden: true,
      },
      {
        id: 'b1',
        kind: 'button',
        pos: btnAt,
        mount: 'tht',
        label: 'DRAIN',
        role: 'Hold it down to connect C1 to the 1 kΩ bleed resistor.',
        params: { callout: [0, 1.0, 0.5] },
        circuitIds: ['SW_DIS'],
      },
      {
        id: 'rd',
        kind: 'resistor',
        pos: between(rdTop, rdBot),
        mount: 'tht',
        label: 'BLEED',
        role: 'Discharge resistor: 1 kΩ, 1/4 W (brown-black-red-gold). Peak 5 mA, 25 mW.',
        params: { ohms: 1000, callout: [0.3, 1.2, -0.4] },
        circuitIds: ['R_DIS'],
      },
      {
        id: 'dmm',
        kind: 'multimeter',
        pos: [DMM_AT[0], BENCH_Y, DMM_AT[1]],
        mount: 'offboard',
        label: 'METER',
        role: 'Reads the capacitor voltage, V_C.',
        params: { mode: 'V', readout: 0, scale: DMM_SCALE, title: 'V CAP', callout: [0, 1.4, 0] },
      },
      { id: 'w-p', kind: 'wire', ...withCallout(wPlus, [0, 0.5, 0.2]), mount: 'offboard', role: 'Supply + to the charge switch.' },
      { id: 'w-n', kind: 'wire', ...wMinus, mount: 'offboard', role: 'Supply − to the ground rail.' },
      { id: 'w-v', kind: 'wire', ...wMeterV, mount: 'offboard', role: 'Meter V jack to the capacitor node.' },
      { id: 'w-com', kind: 'wire', ...wMeterCom, mount: 'offboard', role: 'Meter COM to the ground rail.' },
      { id: 'w-c1', kind: 'wire', ...wC1Gnd, mount: 'offboard', role: 'C1 negative lead to the ground rail.' },
      { id: 'w-dr', kind: 'wire', ...wDrain, mount: 'offboard', role: 'Capacitor node to the DRAIN button.' },
      { id: 'w-rd', kind: 'wire', ...wRdGnd, mount: 'offboard', role: 'Bleed resistor to the ground rail.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_SUP', type: 'V', nodes: ['sup', '0'], value: 5, rInternal: 0.05, partId: 'psu' },
      { id: 'SW_CHG', type: 'SW', nodes: ['sup', 'a'], closed: false, partId: 'sw1' },
      { id: 'R1', type: 'R', nodes: ['a', 'vc'], value: 10000, rating: R_RATING, partId: 'r1' },
      { id: 'C1', type: 'C', nodes: ['vc', '0'], value: 100e-6, v0: 0, polarized: true, rating: C1_RATING, partId: 'c1' },
      { id: 'SW_DIS', type: 'SW', nodes: ['vc', 'd'], closed: false, partId: 'b1' },
      { id: 'R_DIS', type: 'R', nodes: ['d', '0'], value: 1000, rating: R_RATING, partId: 'rd' },
    ],
  },
  powerElementId: 'V_SUP',
  powerLabel: 'Plug in the 5 V supply',

  // 1 ms steps resolve even the 10 ms τ of 1 kΩ × 10 µF; real time is 1 s per τ at the default ×1
  sim: { dt: 1e-3 },

  // The scope shows the whole charge in one sweep: 0.5 s/div is 5 s across = 5τ. V C (ch 1) climbs while
  // the R1 current (ch 2) decays; both start at +1.5 div after the trigger at 0.1 V.
  instruments: {
    scope: {
      channels: [
        {
          label: 'V CAP',
          source: { kind: 'voltage', node: 'vc' },
          perDiv: 1,
          offset: -3.5,
          marks: [{ value: 3.16, label: '63 % · 3.16 V' }],
        },
        { label: 'I CHARGE', source: { kind: 'current', elementId: 'R1' }, perDiv: 1e-4, offset: -3.5 },
      ],
      timePerDiv: 0.5,
      trigger: { channel: 0, level: 0.1, slope: 'rising', mode: 'normal' },
    },
    chart: { signals: [0, 1], span: 12 },
  },

  readouts: [
    { label: 'CAP VOLTAGE', source: { kind: 'voltage', node: 'vc' }, unit: 'V', warnAbove: 14 },
    { label: 'CHARGE CURRENT', source: { kind: 'current', elementId: 'R1' }, unit: 'A' },
    { label: 'CAP CURRENT', source: { kind: 'current', elementId: 'C1' }, unit: 'A' },
    { label: 'SUPPLY', source: { kind: 'voltage', node: 'sup' }, unit: 'V' },
  ],

  tweaks: [
    { label: 'Charge switch', elementId: 'SW_CHG', key: 'closed', kind: 'toggle', min: 0, max: 1, step: 1, unit: '' },
    { label: 'DRAIN button', elementId: 'SW_DIS', key: 'closed', kind: 'momentary', min: 0, max: 1, step: 1, unit: '' },
    { label: 'Timing resistor', elementId: 'R1', key: 'value', min: 1000, max: 100000, log: true, unit: 'Ω' },
    { label: 'Capacitance', elementId: 'C1', key: 'value', min: 1e-5, max: 1e-3, log: true, unit: 'F' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'READY' }, text: 'SUPPLY NOT PLUGGED IN: nothing is powered yet' },
    { when: { kind: 'state', is: 'POWERED' }, text: 'SUPPLY ON, CHARGE SWITCH OPEN: C1 sits at {0} of {3} with no path to charge or discharge. Flip CHARGE.' },
    { when: { kind: 'above', readout: 0, value: 0.05 }, text: 'C1 AT {0} (supply {3}); the charge current is {1}' },
    { when: { kind: 'above', readout: 1, value: 1e-5 }, text: 'CHARGING: C1 at {0} of {3} while R1 passes {1}. The current dies away as the voltage rises.' },
    { when: { kind: 'state', is: 'FAULT' }, text: 'FAULT: C1 has failed short, so V CAP is stuck near zero and only R1 limits the current' },
  ],

  failures: [
    {
      id: 'overvoltage-24v',
      label: 'Plug it into 24 V',
      explain:
        'V_C climbs toward 24 V and passes the capacitor’s 16 V rating at t = τ · ln 3 ≈ 1.1 s. C1 fails shorted: V_C drops to 0 and a steady 24 V / 10 kΩ = 2.4 mA flows through R1. An electrolytic’s dielectric is a thin aluminium-oxide film; over its rated voltage the leakage current climbs, the part heats and it may bulge or vent. Real parts tolerate a short surge slightly above the rating (typically about 15 %), not a sustained 24 V.',
      patches: [
        { op: 'set', elementId: 'V_SUP', key: 'value', value: 24 },
        { op: 'set', elementId: 'SW_CHG', key: 'closed', value: true },
      ],
    },
    {
      id: 'big-cap',
      label: 'Swap in 1000 µF',
      explain: 'τ = RC = 10 kΩ × 1000 µF = 10 s. Charging takes ten times as long: 63 % at 10 s and nearly full only after about 50 s. τ scales linearly with C. (Put the time base to 5 s/div to see all of it.)',
      patches: [
        { op: 'set', elementId: 'C1', key: 'value', value: 1e-3 },
        { op: 'set', elementId: 'SW_CHG', key: 'closed', value: true },
      ],
    },
    {
      id: 'leaky',
      label: 'A leaky capacitor (47 kΩ)',
      explain:
        'The leakage forms a divider with R1, so V_C settles at 5 × 47/57 = 4.12 V instead of 5 V, and it gets there faster: the resistance charging the cap is 10 kΩ ∥ 47 kΩ = 8.25 kΩ, so τ = 0.825 s. A real leakage path is rarely this large; aluminium electrolytics leak tens of microamps at rating.',
      patches: [
        { op: 'add', element: { id: 'R_LEAK', type: 'R', nodes: ['vc', '0'], value: 47000 } },
        { op: 'set', elementId: 'SW_CHG', key: 'closed', value: true },
      ],
    },
    {
      id: 'backwards',
      label: 'Fit the electrolytic backwards',
      explain:
        'With the stripe (negative) toward the charged node the capacitor sees reverse voltage as soon as V_C passes about 1 V. The oxide film that makes it work only forms in one direction, so the leakage current rises sharply, the part heats and it fails short. Here V_C is dragged back to ~0 V and 0.5 mA flows through R1 forever. At higher energies a reversed electrolytic can vent violently.',
      patches: [
        { op: 'remove', elementId: 'C1' },
        { op: 'add', element: { id: 'C1', type: 'C', nodes: ['0', 'vc'], value: 100e-6, v0: 0, polarized: true, rating: C1_RATING, partId: 'c1rev' } },
        { op: 'set', elementId: 'SW_CHG', key: 'closed', value: true },
      ],
      parts: { hide: ['c1'], show: ['c1rev'] },
    },
  ],

  meet: `A capacitor is two conductors separated by an insulator. Push charge onto it and its voltage rises in proportion: **Q = C·V**. Differentiating gives the working equation, **i = C · dV/dt**: current flows only while the voltage is changing, and the voltage can't jump instantly.

Charging through R from 0 V:

**v(t) = V·(1 − e^(−t/τ)),  τ = R·C**

On this board, τ = 10 kΩ × 100 µF = **1.0 s**. Press **Plug in the 5 V supply**, open the **Instruments** panel, then flip **Charge switch** and watch the scope: V CAP climbs along the curve while the charging current falls along its mirror image.

| t | V_C |
|---|---|
| 1 s (1τ) | 5 × 0.632 = 3.16 V |
| 2 s | 4.32 V |
| 3 s | 4.75 V |
| 5 s | 4.97 V (99.3 %) |

The current starts at V/R = 5/10k = **0.5 mA** and decays with the same τ.

**Holding.** Open the charge switch again: C1 just sits at its voltage. This model has no leakage, so it stays. A real electrolytic would sag over hours.

**Discharge.** Hold **DRAIN** (with the charge switch open) to empty C1 through 1 kΩ with τ = 0.1 s. If the charge switch is still closed, R1 and the bleed resistor form a divider and V_C only falls to 5 × 1k/11k = 0.45 V.

**Energy.** E = ½CV² = ½ × 100 µ × 5² = **1.25 mJ**. Charging from a fixed voltage through any resistor dissipates exactly as much again in the resistor, so the process is 50 % efficient whatever the value of R.

**Ratings.** The stripe on an electrolytic marks the negative lead. This one is a 100 µF, 16 V, ±20 % part (the class of a Nichicon UVR1C101M), so this "1 s" timer is really anywhere from 0.8 s to 1.2 s. The voltage rating is a maximum, not a target, and the polarity matters: try the **Break it** buttons.`,

  mechanicalAnalogy: `An RC charge is a spring in parallel with a damper (a Kelvin–Voigt element) under a step force. Deflection creeps toward F/k as x(t) = (F/k)(1 − e^(−t/τ)) with τ = c/k. The damper plays R and the spring's compliance (1/k) plays C. You can also picture filling a tank through a narrow pipe: the level rises fast at first, then slows.

**Where it breaks:** real capacitors leak, have series resistance (ESR), and show dielectric absorption, partly recharging after being shorted, which no simple spring does.`,

  proTips: [
    'Derate electrolytic voltage. Run at 50–80 % of the rating (a 16 V part on 5–12 V rails), and observe polarity. A reversed electrolytic can vent violently.',
    'For timing, use film or C0G/NP0 ceramic capacitors (±1–5 %) rather than electrolytics (±20 %) or X7R/Y5V ceramics, whose capacitance drops with DC bias and temperature.',
    'Large capacitors stay charged after power-off. Fit a bleed resistor and measure before touching.',
  ],

  guide: [
    {
      id: 'meet-the-cap',
      title: 'Meet the capacitor',
      body: 'Click the **capacitor** to open its inspector. It is **100 µF**, **16 V**, and the stripe marks the negative leg.',
      check: { kind: 'inspect', part: 'c1' },
      focus: { part: 'c1' },
      hint: 'The tall can with a stripe down one side.',
      explain: 'It is polarised: the oxide film that makes it work only forms in one direction. With R1 = 10 kΩ the time constant is τ = R × C = 10 000 × 0.0001 = 1 s.',
    },
    {
      id: 'plug-in',
      title: 'Plug in the supply',
      body: 'Press **Plug in the 5 V supply**. **SUPPLY** reads 5 V but **CAP VOLTAGE** stays at 0: the charge switch is still open.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'power' }, { kind: 'status', is: 'POWERED' }, { kind: 'readout', index: 3, above: 4.9, holdMs: 300 }] },
      focus: { control: 'power' },
      explain: 'The supply is ready, but there is no path from it to C1. A capacitor only moves current while its voltage is changing.',
    },
    {
      id: 'open-scope',
      title: 'Open the instruments',
      body: 'Open the **Instruments** panel. The scope shows **V CAP** with a mark at **3.16 V**, 63 % of the supply.',
      check: { kind: 'instruments' },
      focus: { control: 'instruments' },
      explain: 'One time constant is when the capacitor reaches 1 − 1/e = 63.2 % of the supply: 3.16 V of 5 V. The scope sweeps 5 s across, so you will see five time constants.',
    },
    {
      id: 'charge-it',
      title: 'Flip the charge switch',
      body: 'Switch **Charge switch** on and watch. **CAP VOLTAGE** passes **3.16 V** after about 1 s, and **CHARGE CURRENT** dwindles from 0.5 mA to almost nothing as it reaches 5 V.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Charge switch', min: 1 },
          { kind: 'readout', index: 0, above: 4.7, holdMs: 300 },
          { kind: 'readout', index: 1, below: 0.00005, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Charge switch' },
      hint: 'Wait about 3 seconds for the voltage to pass 4.7 V.',
      explain: 'V(t) = 5 × (1 − e^(−t/τ)): 63 % at 1 s, 86 % at 2 s, 99 % at 5 s. The current starts at 5 V / 10 kΩ = 0.5 mA and decays the same way, because the less room left in the capacitor, the less voltage there is across R1.',
    },
    {
      id: 'drain-it',
      title: 'Drain it',
      body: 'Switch **Charge switch** off, then press **DRAIN button**. **CAP VOLTAGE** falls to nearly 0 in a fraction of a second.',
      check: { kind: 'all', of: [{ kind: 'tweak', target: 'Charge switch', max: 0.5 }, { kind: 'readout', index: 0, below: 0.3, holdMs: 250 }] },
      focus: { control: 'tweak:DRAIN button' },
      hint: 'With the charge switch still on the voltage only falls to about 0.45 V: switch it off first.',
      explain: 'The drain resistor is 1 kΩ, so τ = 1 kΩ × 100 µF = 0.1 s, ten times quicker than the charge. Energy goes in as ½CV² = 1.25 mJ and comes out as heat in the drain resistor.',
    },
    {
      id: 'overvoltage',
      title: 'Break it: plug it into 24 V',
      body: 'Open **Break something** and choose **Plug it into 24 V**. The voltage races past the **16 V** rating and the capacitor fails.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'overvoltage-24v' }, { kind: 'status', is: 'FAULT' }] },
      focus: { control: 'break' },
      hint: 'It takes about a second to reach 16 V.',
      explain: 'V(t) climbs toward 24 V and passes 16 V at t = τ ln 3 = 1.1 s. The oxide film breaks down, C1 fails shorted, V CAP drops to 0 and only R1 limits the current. A voltage rating is a hard limit.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**. The supply returns to 5 V.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'repair' }, { kind: 'readout', index: 3, below: 6, holdMs: 300 }] },
      focus: { control: 'break' },
    },
    {
      id: 'bigger-cap',
      title: 'Fit a 1000 µF capacitor',
      body: 'Slide **Capacitance** up to **1000 µF**, then switch **Charge switch** on. τ is now 10 s, so after 3 s **CAP VOLTAGE** is only about **1.3 V**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Capacitance', min: 0.0008 },
          { kind: 'tweak', target: 'Charge switch', min: 1 },
          { kind: 'readout', index: 0, above: 0.3, below: 1.5, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Capacitance' },
      hint: 'Set the capacitance first, then flip the charge switch.',
      explain: 'τ = R × C = 10 kΩ × 1000 µF = 10 s: ten times the capacitance, ten times the time. Timing circuits and filters all come down to choosing R and C for the τ you want.',
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: τ = RC and the 63 % rule.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  quiz: [
    {
      q: 'What is the time constant of 47 kΩ and 22 µF?',
      options: ['0.47 s', '2.14 s', '1.03 s', '10.3 s'],
      answer: 2,
      why: 'τ = RC = 47 000 × 22 × 10⁻⁶ = 1.034 s.',
    },
    {
      q: 'After two time constants, what fraction of the final voltage has an RC charge reached?',
      options: ['50 %', '63.2 %', '95.0 %', '86.5 %'],
      answer: 3,
      why: '1 − e⁻² = 0.865.',
    },
    {
      q: 'How much energy does a 1000 µF capacitor store at 12 V?',
      options: ['6 mJ', '72 mJ', '12 mJ', '144 mJ'],
      answer: 1,
      why: 'E = ½CV² = 0.5 × 0.001 × 144 = 0.072 J.',
    },
    {
      q: 'At the instant the switch closes on an empty capacitor, the current through R is…',
      options: ['V/R', 'zero', 'V/(2R)', 'set by the capacitance only'],
      answer: 0,
      why: 'The capacitor starts at 0 V, so the full supply appears across R and I = V/R.',
    },
  ],
}
