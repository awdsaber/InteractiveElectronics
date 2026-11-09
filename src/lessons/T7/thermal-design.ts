// T7 · Thermal Design. Source: docs/curriculum/T7/thermal-design.md
//
// An onsemi MC7805 (TO-220) turns 12 V into 5 V at 0.67 A, so (12 − 5) × 0.667 A + 12 V × 5 mA
// = 4.73 W goes into the tab as heat. The REG element makes the electrical side (dropout, quiescent
// current, current limit); the `thermal-network` behavior reads its solved power and integrates the
// junction - case - heatsink RC network, shuts the regulator down at 150 °C and restarts it at 130 °C.
// Heatsink, thermal interface, airflow and ambient are tweaks; removing the sink, forgetting the pad,
// a dead fan and a 24 V adapter are the failures. The thermal time constants are minutes, so the
// lesson opens in time-lapse (x20) with the strip chart showing the three temperatures.
//
// The curriculum's Uno / NTC / fan-control sketch is deferred (docs/decisions.md): the fan is a
// tweak here, which is enough to teach θ, C_th and shutdown.
import type { LessonDef } from '../../engine/types'

export const lesson: LessonDef = {
  id: 'thermal-design',
  track: 'T7',
  title: 'Thermal Design',
  subtitle: 'Watts become degrees',
  tagline: 'A 7805 dropping 12 V to 5 V at 0.67 A turns 4.7 W into heat: bare, the maths says 330 °C; on a small heatsink it settles near 110 °C.',

  board: {
    name: 'THERMAL BENCH',
    size: [13, 7.5],
    base: 'mat',
    parts: [
      {
        id: 'jack',
        kind: 'barrel-jack',
        pos: [-5, 0.2],
        mount: 'tht',
        label: '12 V IN',
        role: 'A 12 V bench supply. The 7805 accepts up to 35 V, but every extra volt it drops becomes heat.',
        params: { callout: [-0.4, 1.4, 0.6] },
        circuitIds: ['V_IN'],
      },
      {
        id: 'cin',
        kind: 'capacitor-ceramic',
        pos: [-2.8, 1.5],
        mount: 'tht',
        role: '0.33 µF input capacitor, as the datasheet recommends when the regulator is far from the supply filter.',
        params: { farads: 330e-9 },
      },
      {
        id: 'u1',
        kind: 'regulator-to220',
        pos: [0, 1.0],
        mount: 'tht',
        label: '7805',
        role: 'MC7805 5 V linear regulator in a TO-220. Its metal tab is the thermal path: the die heat leaves through θjc into the tab, then through the pad and the heatsink into the air.',
        params: { marking: 'MC7805', callout: [0.2, 2.6, 0.9] },
        circuitIds: ['REG'],
        facts: [
          'Output 5 V (4.8 to 5.2 V over its limits)',
          'Input 35 V absolute maximum',
          'Dropout about 2 V',
          'Quiescent current about 4.3 mA typ, 8 mA max',
          'θjc 5 °C/W, θja 65 °C/W bare in free air (onsemi); ST L7805 lists 50 °C/W',
          'Operating junction 0 to 125 °C (C suffix)',
          'Internal thermal overload protection (the datasheet gives no trip number; the model trips at 150 °C and restarts at 130 °C)',
        ],
      },
      {
        id: 'hs',
        kind: 'heatsink',
        pos: [0, 1.2],
        mount: 'tht',
        label: 'HEATSINK',
        role: 'An extruded-aluminium sink bolted to the tab. Illustrative values: 12 °C/W small (about 10 g, 9 J/K) or 5 °C/W large (about 30 g, 27 J/K) in still air. Real sinks list their θsa on the datasheet; a fan lowers it.',
        params: { callout: [0.4, 2.2, -0.9] },
        facts: ['Illustrative class values, not a catalogue part', 'Small clip-on: 12 °C/W, 9 J/K', 'Large finned: 5 °C/W, 27 J/K', 'Fan: θsa × 0.45 (curves in real datasheets vary)'],
      },
      {
        id: 'cout',
        kind: 'capacitor-ceramic',
        pos: [2.8, 1.5],
        mount: 'tht',
        role: '0.1 µF output capacitor, as the datasheet recommends for stability and transient response.',
        params: { farads: 100e-9 },
      },
      {
        id: 'rl',
        kind: 'resistor',
        pos: [5, 0.8],
        mount: 'tht',
        label: 'LOAD',
        role: 'The load: 7.5 Ω, 10 W wirewound. 5 V across it is 0.67 A.',
        params: { ohms: 7.5, callout: [0.3, 1.6, 0.8] },
        circuitIds: ['R_LOAD'],
      },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_IN', type: 'V', nodes: ['src', '0'], value: 12, rInternal: 0.05, partId: 'jack' },
      { id: 'P_IN', type: 'PROBE', nodes: ['src', 'vin'] },
      // MC7805: 5 V, about 2 V dropout, 5 mA quiescent. Its heat is modelled by `thermal-network` (no rth here).
      { id: 'REG', type: 'REG', nodes: ['vin', '0', 'vout'], vout: 5, dropout: 2, iLimit: 1.5, iq: 0.005, rating: { maxV: 35 }, partId: 'u1' },
      { id: 'R_LOAD', type: 'R', nodes: ['vout', '0'], value: 7.5, rating: { maxP: 10 }, partId: 'rl' },
    ],
  },
  powerElementId: 'V_IN',
  powerLabel: 'Switch on 12 V',
  // DC solve: the thermal lag lives in the behavior. The time constants are minutes, so start in time-lapse.
  transient: false,
  sim: { speed: 20 },

  readouts: [
    { label: 'REGULATOR LOSS', source: { kind: 'behavior', key: 'th.p_W' }, unit: 'W' },
    { label: 'JUNCTION Tj', source: { kind: 'behavior', key: 'th.tj' }, unit: '°C', digits: 3, warnAbove: 125 },
    { label: 'CASE Tc', source: { kind: 'behavior', key: 'th.tc' }, unit: '°C', digits: 3 },
    { label: 'HEATSINK Ths', source: { kind: 'behavior', key: 'th.ths' }, unit: '°C', digits: 3 },
    { label: 'OUTPUT 5V', source: { kind: 'voltage', node: 'vout' }, unit: 'V' },
    { label: 'EFFICIENCY', source: { kind: 'behavior', key: 'pm.eta' }, unit: '%', digits: 3 },
    { label: 'Tj ON PAPER', source: { kind: 'behavior', key: 'th.tj_ss' }, unit: '°C', digits: 3 },
    { label: 'TAB-SINK ΔT', source: { kind: 'derived', op: 'diff', of: [2, 3] }, unit: '°C', digits: 3 },
    { label: 'SHUTDOWN TRIPS', source: { kind: 'behavior', key: 'th.tsd_count' }, unit: '', digits: 2 },
    { label: 'θ TOTAL, °C/W', source: { kind: 'behavior', key: 'th.rth_total' }, unit: '', digits: 3 },
    { label: 'MAX POWER at 125 °C', source: { kind: 'behavior', key: 'th.pmax_W' }, unit: 'W' },
    { label: 'TIME CONSTANT', source: { kind: 'behavior', key: 'th.tau_s' }, unit: 's', digits: 3 },
  ],

  behaviors: [
    { id: 'thermal-network', instance: 'th', params: { element: 'REG', ambientC: 25, sink: 1, pad: 1, fan: 0 } },
    { id: 'power-meter', instance: 'pm', params: { vin: 'vin', iin: 'P_IN', vout: 'vout', iout: 'R_LOAD' } },
  ],

  tweaks: [
    {
      label: 'Heatsink',
      elementId: 'behavior:th',
      key: 'sink',
      kind: 'enum',
      min: 1,
      max: 2,
      unit: '',
      options: [
        { label: 'Small clip-on, 12 °C/W', value: 1 },
        { label: 'Large finned, 5 °C/W', value: 2 },
      ],
    },
    {
      label: 'Thermal interface',
      elementId: 'behavior:th',
      key: 'pad',
      kind: 'enum',
      min: 0,
      max: 2,
      unit: '',
      options: [
        { label: 'Dry tab, 3 °C/W', value: 0 },
        { label: 'Silicone pad, 1 °C/W', value: 1 },
        { label: 'Thermal grease, 0.5 °C/W', value: 2 },
      ],
    },
    {
      label: 'Airflow',
      elementId: 'behavior:th',
      key: 'fan',
      kind: 'enum',
      min: 0,
      max: 1,
      unit: '',
      options: [
        { label: 'Still air', value: 0 },
        { label: 'Fan on, θsa × 0.45', value: 1 },
      ],
    },
    { label: 'Ambient', elementId: 'behavior:th', key: 'ambientC', min: 0, max: 60, step: 1, unit: '°C' },
    { label: 'Input voltage', elementId: 'V_IN', key: 'value', min: 7, max: 30, step: 0.5, unit: 'V' },
    { label: 'Load resistor', elementId: 'R_LOAD', key: 'value', min: 5, max: 50, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'READY' }, text: 'READY: switch on 12 V. The 7805 will turn the 7 V it drops into heat.' },
    {
      when: { kind: 'state', is: 'POWERED' },
      text: 'POWERED: {0} of heat. Tj {1} now, heading for {6} ({9} °C/W in the chain). The time constant is {11}: watch the chart.',
    },
    { when: { kind: 'above', readout: 1, value: 125 }, text: 'Junction above 125 °C: outside the operating rating. Shutdown comes near 150 °C.' },
    { when: { kind: 'above', readout: 8, value: 0.5 }, text: 'THERMAL SHUTDOWN: tripped {8} times. The output drops to 0 V, the die falls back to the tab temperature, the part restarts, and trips again.' },
  ],

  failures: [
    {
      id: 'no-heatsink',
      label: 'Take the heatsink off',
      explain:
        'With only the tab in free air the chain is θja = 65 °C/W: 25 + 4.7 W × 65 = about 330 °C on paper. Only the die and tab (about 0.85 J/K) hold heat, so the junction reaches 150 °C within a minute (sooner with no fan). The 7805 shuts down at 150 °C and the output goes to 0 V. With no heat being made, the die drops to the tab temperature within a second (the 4.7 W × 5 °C/W = 24 K die-to-tab step vanishes), so as soon as it is under 130 °C it restarts, heats that 24 K again in about a second and trips again: the 5 V rail chatters on and off every few seconds while the tab creeps up. Thermal shutdown is a last-ditch protection, not a design feature; repeated cycling stresses the die attach and bond wires.',
      patches: [{ op: 'set', elementId: 'behavior:th', key: 'sink', value: 0 }],
      parts: { hide: ['hs'] },
    },
    {
      id: 'dry-tab',
      label: 'Forget the thermal pad (dry tab)',
      explain:
        'A tab pressed dry against the sink touches only at its high points; air fills the gaps. Take θcs as 3 °C/W instead of 1 and the tab climbs by 4.7 W × 2 = about 9 K, and Tj with it. The heatsink itself does not change: it still sits at Ta + P × θsa. A cool heatsink with a hot part means the interface is the bottleneck. Grease or a pad fills the air gaps; typical values are 0.5 to 1 °C/W.',
      patches: [{ op: 'set', elementId: 'behavior:th', key: 'pad', value: 0 }],
    },
    {
      id: 'fan-dies',
      label: 'The fan stops',
      explain:
        'Forced air lowers θsa; take it away and the sink goes back to its still-air value. If the airflow was cooling a 12 °C/W clip-on, θsa × 0.45 = 5.4 becomes 12 again and Tj rises by about 4.7 W × 6.6 = 31 K. Turn Airflow on first to see it; this is why fans in a thermal design want a tachometer or a sensor.',
      patches: [{ op: 'set', elementId: 'behavior:th', key: 'fan', value: 0 }],
    },
    {
      id: 'adapter-24v',
      label: 'Plug in a 24 V adapter',
      explain:
        'The regulator burns the voltage difference. (24 − 5) × 0.667 A + 24 V × 5 mA = about 12.8 W. Even on the large sink (5 + 1 + 5 = 11 °C/W) that is 25 + 12.8 × 11 = 166 °C, so it shuts down; with a fan (8.25 °C/W) it holds near 130 °C. The 7805 accepts 35 V, but at this current only a big sink or a switching regulator (about 90 % efficient: it would lose 0.37 W) makes sense.',
      patches: [{ op: 'set', elementId: 'V_IN', key: 'value', value: 24 }],
    },
  ],

  instruments: {
    open: true,
    view: 'chart',
    // junction, case and heatsink temperature against time: the three nodes of the network
    chart: { signals: [1, 2, 3], span: 600 },
  },

  guide: [
    {
      id: 'meet-the-regulator',
      title: 'Meet the 7805',
      body: 'Click the **7805** to open its inspector. It is a TO-220 linear regulator: its metal tab is where the heat leaves.',
      check: { kind: 'inspect', part: 'u1' },
      focus: { part: 'u1' },
      hint: 'The black TO-220 package in front of the aluminium heatsink.',
      explain: 'A linear regulator is a variable resistor in series with the load. It drops the surplus voltage and, with it, the energy: P = (Vin − Vout) × Iout + Vin × Iq. All of it heats a die the size of a fingernail.',
    },
    {
      id: 'power-on',
      title: 'Switch on 12 V',
      body: 'Press **Switch on 12 V**. The 7805 drops 7 V at **0.67 A**: **REGULATOR LOSS** reads about **4.7 W** and **EFFICIENCY** only about **41 %**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'power' },
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 0, above: 4.4, below: 5.0, holdMs: 300 },
          { kind: 'readout', index: 5, above: 36, below: 46, holdMs: 300 },
        ],
      },
      focus: { control: 'power' },
      explain: '(12 − 5) × 0.667 + 12 × 0.005 = 4.73 W, of the 8.06 W taken from the supply. Efficiency is just Vout / Vin = 5 / 12, a bit less because of the quiescent current.',
    },
    {
      id: 'watch-it-heat',
      title: 'Watch the heat build up',
      body: 'The sim runs **×20**. Wait until the **JUNCTION Tj** passes **100 °C** on the strip chart. **Tj ON PAPER** (where it is heading) is about **110 °C**: 25 + 4.73 × (5 + 1 + 12).',
      check: { kind: 'readout', index: 1, above: 100, holdMs: 300 },
      focus: { control: 'instruments' },
      hint: 'The small sink has a time constant of about two minutes, so at ×20 the climb takes around ten seconds.',
      explain: 'Heat flows like current: ΔT = P × θ, and the three resistances add in series: θjc 5 + θcs 1 + θsa 12 = 18 °C/W. The curve rises like a capacitor charging, with τ = C_th × θ ≈ 118 s, so Tj takes three or four time constants (6 to 8 minutes) to settle. A short bench test can lie.',
    },
    {
      id: 'fan-on',
      title: 'Blow air over it',
      body: 'Set **Airflow** to **Fan on**. The fan lowers θsa from 12 to about 5.4 °C/W. **Tj** drops below **90 °C** and **TIME CONSTANT** shortens.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Airflow', min: 1 },
          { kind: 'readout', index: 1, below: 90, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Airflow' },
      explain: 'Forced air raises the convection coefficient h, and θsa = 1 / (h·A_eff). Here it scales θsa by 0.45 (illustrative), so Tj settles at 25 + 4.73 × (5 + 1 + 5.4) = 79 °C. A smaller θsa also shortens the time constant: τ falls with it.',
    },
    {
      id: 'bigger-sink',
      title: 'Fit a larger heatsink',
      body: 'Set **Heatsink** to **Large finned**. Its θsa is 5 °C/W (2.25 with the fan). **Tj** settles below **72 °C**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Heatsink', min: 2 },
          { kind: 'readout', index: 1, below: 72, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Heatsink' },
      explain: 'Tj = 25 + 4.73 × (5 + 1 + 2.25) = 64 °C. A bigger sink has more surface and more mass: θsa falls, and C_th rises, so the same power is slower to heat it (27 J/K against 9 J/K).',
    },
    {
      id: 'dry-tab',
      title: 'Break it: forget the thermal pad',
      body: 'Open **Break something** and choose **Forget the thermal pad**. **TAB-SINK ΔT** jumps from about 5 K to about **14 K**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'break', failure: 'dry-tab' },
          { kind: 'readout', index: 7, above: 11, holdMs: 300 },
        ],
      },
      focus: { control: 'break' },
      explain: 'The interface is a thermal resistance too: 4.73 W × 3 °C/W = 14 K across a dry joint, against 4.7 K with the silicone pad. The heatsink temperature did not change, but the part got hotter. A cool heatsink with a hot part means the interface is the bottleneck.',
    },
    {
      id: 'no-heatsink',
      title: 'Break it: take the heatsink off',
      body: 'Choose **Take the heatsink off**. With only the tab in the air the junction races to 150 °C. Wait for **SHUTDOWN TRIPS** to pass **2** while **OUTPUT 5V** drops to 0 V and returns, over and over.',
      check: {
        kind: 'all',
        of: [
          { kind: 'break', failure: 'no-heatsink' },
          { kind: 'readout', index: 8, above: 1.5 },
        ],
      },
      focus: { control: 'break' },
      hint: 'The bare tab holds almost no heat, so the first trip comes after about a minute of sim time: a few seconds at ×20.',
      explain: 'Bare, θja is 65 °C/W: on paper 25 + 4.73 × 65 = 330 °C. The thermal protection opens the output at 150 °C and restarts it below 130 °C. Because the die is 24 K hotter than the tab only while it dissipates, it drops out, restarts and trips again within seconds: the 5 V rail chatters. It is a last-ditch protection, not a design feature.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** and choose **Repair all**.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  meet: `**Heat is current, temperature is voltage.** Every symbol on this board has an electrical twin:

| thermal | unit | electrical twin | unit |
|---|---|---|---|
| temperature T | °C | voltage V | V |
| heat flow P | W | current I | A |
| thermal resistance θ | °C/W | resistance R | V/A |
| heat capacity C_th | J/K | capacitance C | C/V |

**θ is to °C/W as R is to V/A**: ΔT = P × θ is Ohm's law. **C_th is to J/K as C is to the charge-voltage relation**: Q = C·V stores charge, Q = C_th·ΔT stores heat. Resistances in series add, and an R and a C make a time constant: τ = θ × C_th.

**The chain.** Heat made at the junction leaves through three resistances in series, into the ambient (the ground node):

Tj = Ta + P × (θjc + θcs + θsa)

- θjc = 5 °C/W: die to tab, from the datasheet.
- θcs = 0.5 to 1 °C/W with grease or a pad, a few °C/W dry: tab to heatsink.
- θsa = 5 to 12 °C/W here: heatsink to air. A fan multiplies it by about 0.45.

**The power.** P = (Vin − Vout) × Iout + Vin × Iq = 7 × 0.667 + 12 × 0.005 = **4.73 W** from 12 V, only **41 %** efficient.

**Bare tab:** θja = 65 °C/W (onsemi; ST's L7805 says 50), so on paper Tj = 25 + 4.73 × 65 = **330 °C**. The part trips its thermal protection (about 150 °C here) long before, and cycles.

**Small sink, silicone pad:** 5 + 1 + 12 = 18 °C/W, so Tj = **110 °C**, above the 105 °C a designer wants for a 125 °C part. **Large sink with a fan:** 5 + 1 + 2.25 = 8.25 °C/W, so Tj = **64 °C**.

**Sizing it.** For Tj ≤ 110 °C at 40 °C ambient with a pad: θsa ≤ (110 − 40)/4.73 − 5 − 1 = **8.8 °C/W**.

**Derating.** The chain allows P_max = (125 − Ta)/Σθ. It falls linearly as the ambient rises: with the small sink and pad, 5.6 W at 25 °C but only 3.6 W at 60 °C. **MAX POWER at 125 °C** shows it live; slide **Ambient**.

**Time constants.** The die has about 0.05 J/K and the tab about 0.8 J/K. A 30 g aluminium sink holds about 27 J/K (30 g × 900 J/(kg·K)), and with 5 °C/W τ ≈ 140 s: three time constants (95 %) take 7 minutes. The small sink (9 J/K at 12 °C/W) has τ ≈ 118 s.

**Alternative.** A 90 % efficient buck making the same 3.3 W would lose about 0.37 W: 13 times less heat.`,

  mechanicalAnalogy: `This is your heat-transfer course on a bench. Conduction through a slab is R = L/(kA) and convection from a surface is R = 1/(hA): both are thermal resistances in series, and the lumped capacitance m·c gives the time constant. The junction is a hot spot in a tiny mass, the tab is a spreader, and the heatsink is a finned extended surface whose θsa already folds in the fin efficiency and h. A fan raises h. **Where it breaks:** the datasheet's θja assumes a specific test board in still air, an enclosure recirculates its own warm air, and the hottest point on the die can't be measured, so θjc is a model you trust rather than one you check. The two-resistor, three-capacitor network here is a lumped model; real Zth curves have more poles.`,

  proTips: [
    'Design to a junction temperature with margin: about 100 to 110 °C for a part rated for 125 °C. A widely used rule of thumb says every 10 °C cooler roughly doubles many components\' life; it is a rule, not a law.',
    'Measure the tab (a thermocouple or an NTC epoxied to the sink) and add P × θjc to estimate Tj. Infrared thermometers misread shiny metal badly.',
    'If (Vin − Vout) × I is more than about 1 W, price a buck module before you buy a heatsink: it is usually cheaper, smaller and cooler.',
    'Check the margin at the worst case: the highest ambient inside the enclosure, the highest input voltage and the highest load, all together.',
  ],

  quiz: [
    {
      q: 'A 7805 drops 12 V to 5 V at 0.667 A with 5 mA quiescent current. What does it dissipate?',
      options: ['3.3 W', '4.7 W', '8 W', '12 W'],
      answer: 1,
      why: '(12 − 5) × 0.667 + 12 × 0.005 = 4.67 + 0.06 = 4.73 W. The 3.3 W is the useful output power.',
    },
    {
      q: 'The same part has no heatsink (θja = 65 °C/W) at 25 °C ambient. What junction temperature does the maths give?',
      options: ['90 °C', '125 °C', '225 °C', '330 °C'],
      answer: 3,
      why: '25 + 4.73 × 65 = 332 °C. The part would be in thermal shutdown long before that.',
    },
    {
      q: 'To keep Tj ≤ 110 °C at 40 °C ambient with θjc = 5 and θcs = 1 °C/W, what is the largest θsa?',
      options: ['4.2 °C/W', '8.8 °C/W', '14.8 °C/W', '20 °C/W'],
      answer: 1,
      why: '(110 − 40)/4.73 − 5 − 1 = 14.8 − 6 = 8.8 °C/W. The 14.8 is the whole chain; subtract the part that is already used.',
    },
    {
      q: 'A heatsink holds 27 J/K and has θsa = 5 °C/W. About how long does it take to settle (95 %)?',
      options: ['14 s', '47 s', '7 minutes', '2 hours'],
      answer: 2,
      why: 'τ = C_th × θ = 27.9 × 5 ≈ 140 s, and 95 % is 3τ ≈ 420 s = 7 minutes. This is why a quick bench test can lie.',
    },
    {
      q: 'In the electrical analogy of a thermal network, heat capacity C_th in J/K corresponds to:',
      options: [
        'a capacitor: Q = C·V stores charge, Q = C_th·ΔT stores heat',
        'a resistor: ΔT = P × θ',
        'an inductor storing flux',
        'a voltage source',
      ],
      answer: 0,
      why: 'θ (°C/W) is the resistor, C_th (J/K) the capacitor, power the current and temperature the voltage. R and C together give the time constant τ = θ × C_th.',
    },
    {
      q: 'A 90 % efficient buck replaces the 7805 (5 V, 0.667 A out). How much heat does it make?',
      options: ['0.04 W', '0.37 W', '3.3 W', '4.7 W'],
      answer: 1,
      why: 'Output is 3.33 W; input is 3.33 / 0.9 = 3.70 W, so the loss is about 0.37 W, 13 times less than the linear regulator.',
    },
  ],
}
