// T7 · PCB Design Workflow. Source: docs/curriculum/T7/pcb-design-workflow.md
//
// The board is the course's own two-layer "ATELIER POWER rev A": a 12 V barrel jack feeds a 2 A
// output terminal through one top-copper trace, with a small MCU section (ISP header, decoupling)
// that is placed and routed for the layer tour but not simulated. Its `board.layers` are real layer
// data: traces with widths in mm, a bottom ground pour, vias, fiducials, pad nets and the fab's rules.
//   · The 3D draws the board layer by layer (src/three/PcbLayers.tsx): Exploded view peels bottom
//     copper, FR-4 core, top copper, solder mask and silkscreen apart, with the drill hits running
//     through them; the `pcb-tour` behavior isolates one layer or overlays the DRC.
//   · The DRC (src/engine/pcb/drc.ts) finds four deliberate violations on the default board: the 2 A
//     feed at 0.30 mm (IPC-2221 wants 0.78 mm), a 0.10 mm gap between SCK and MISO (rule 0.15 mm),
//     C2 14 mm from the AVCC pin it decouples, and J2's ground pad poured solid (no thermal relief).
//   · The power trace is a real R in the netlist (`trace-heat`): ρ(T)·L/(w·t) for 61 mm of 1 oz
//     copper, heating by IPC-2221, burnt open past 300 °C. An electronic load (`e-load`) holds 2 A.
//
// Deferred (docs/decisions.md): the curriculum's USB-C sink (CC resistors, `usbc-source`), the
// ATmega328P bring-up sketch and the paste layer.
import { ipcWidthMm, polylineLengthMm } from '../../engine/pcb/ipc2221'
import type { LessonDef, PcbLayersSpec } from '../../engine/types'
import { jumper } from '../layout'

const PWR: [number, number][] = [
  [-2.6, 1.0],
  [-2.2, 0.6],
  [2.2, 0.6],
  [2.546, 0.95],
  [2.546, 1.6],
]
/** 61 mm of power trace, jack centre pin to the output terminal */
export const PWR_LENGTH_MM = polylineLengthMm(PWR)

const GND_VIA = { net: 'GND', drill: 0.3, pad: 0.6 }

export const LAYERS: PcbLayersSpec = {
  thicknessMm: 1.6,
  copperOz: 1,
  copperOzParam: 'tr.oz',
  top: [
    { id: 'PWR', net: 'VIN', pts: PWR, w: 0.3, amps: 2, widthParam: 'tr.widthMm', ampsParam: 'load.iSet', elementId: 'TRACE' },
    { id: 'TP1', net: 'VIN', pts: [[-1.6, 0.6], [-1.6, 0.25]], w: 0.3 },
    { id: 'LED_FEED', net: 'VIN', pts: [[-1.0, 0.6], [-1.0, 1.4], [-0.684, 1.4]], w: 0.25 },
    { id: 'LED_A', net: 'LED', pts: [[-0.516, 1.4], [0.116, 1.4]], w: 0.25 },
    { id: 'LED_K', net: 'GND', pts: [[0.284, 1.4], [0.5, 1.4]], w: 0.25 },
    { id: 'VCC', net: 'VCC', pts: [[0.36, -0.27], [0.36, -0.08]], w: 0.25 },
    { id: 'C1_GND', net: 'GND', pts: [[0.528, -0.08], [0.65, -0.08]], w: 0.25 },
    { id: 'AVCC', net: 'AVCC', pts: [[0.83, -0.66], [1.25, -0.66], [1.816, -1.226], [1.816, -1.7]], w: 0.25 },
    { id: 'C2_GND', net: 'GND', pts: [[1.984, -1.7], [2.15, -1.7]], w: 0.25 },
    { id: 'SCK', net: 'SCK', pts: [[-1.546, -1.327], [-1.2, -1.327], [-0.9, -0.82], [-0.03, -0.82]], w: 0.2 },
    { id: 'MISO', net: 'MISO', pts: [[-1.546, -1.073], [-1.25, -1.073], [-1.0, -0.79], [-0.25, -0.79], [-0.15, -0.74], [-0.03, -0.74]], w: 0.2 },
    { id: 'RST_TOP', net: 'RST', pts: [[0.2, -1.5], [0.12, -1.3], [0.12, -1.13]], w: 0.2 },
  ],
  bottom: [{ id: 'RST_BOT', net: 'RST', pts: [[-2.054, -1.327], [-2.054, -1.8], [0.2, -1.8], [0.2, -1.5]], w: 0.25 }],
  pours: [{ net: 'GND', layer: 'bottom', clearance: 0.3 }],
  vias: [
    { at: [-2.6, -1.9], ...GND_VIA },
    { at: [2.6, -1.9], ...GND_VIA },
    { at: [-3.1, 0.2], ...GND_VIA },
    { at: [3.1, 0.2], ...GND_VIA },
    { at: [0, 0.1], ...GND_VIA },
    { at: [0.65, -0.08], ...GND_VIA },
    { at: [2.15, -1.7], ...GND_VIA },
    { at: [0.5, 1.4], ...GND_VIA },
    { at: [0.2, -1.5], net: 'RST', drill: 0.3, pad: 0.6 },
  ],
  padNets: { 'j1:0': 'VIN', 'j1:1': 'GND', 'j1:2': 'GND', 'j2:0': 'VIN', 'j2:1': 'GND', 'j3:0': 'RST', 'j3:1': 'VCC', 'j3:2': 'SCK', 'j3:3': 'GND', 'j3:4': 'MOSI', 'j3:5': 'MISO', 'tp1:0': 'VIN', 'tp2:0': 'GND' },
  pourPads: [
    { part: 'j1', pad: 1, relief: true },
    { part: 'j1', pad: 2, relief: true },
    { part: 'j2', pad: 1, relief: false },
    { part: 'j3', pad: 3, relief: true },
    { part: 'tp2', pad: 0, relief: true },
  ],
  decoupling: [
    { cap: 'c1', ic: 'u1', pad: 3, pin: 'VCC', maxMm: 3 },
    { cap: 'c2', ic: 'u1', pad: 20, pin: 'AVCC', maxMm: 3 },
  ],
  fiducials: [
    { at: [-3.1, -1.0], d: 1 },
    { at: [3.1, -1.0], d: 1 },
  ],
  silk: [
    { text: '12V IN', at: [-2.95, 0.72] },
    { text: 'OUT 2A', at: [2.35, 1.12] },
    { text: '+', at: [2.47, 2.08] },
    { text: 'ISP', at: [-2.0, -1.55] },
    { text: 'TP 12V', at: [-1.85, 0.08] },
    { text: 'TP GND', at: [1.35, 0.08] },
  ],
  // a common low-cost fab's two-layer capability, rounded: 0.15 mm (6 mil) trace and space
  rules: { minTrace: 0.15, minClearance: 0.15, minAnnular: 0.13, riseC: 10 },
}

/** the layout's fixed DRC violations (the lesson test checks this against runDrc) */
export const STATIC_DRC_ERRORS = 3

const WIRE_Y = 0.42
const OUT_POS: [number, number, number] = [2.546, WIRE_Y, 1.6]
const OUT_NEG: [number, number, number] = [3.054, WIRE_Y, 1.6]
const LOAD_POS: [number, number, number] = [4.75, 0.12, 1.05]
const LOAD_NEG: [number, number, number] = [4.75, 0.12, 1.45]

export const lesson: LessonDef = {
  id: 'pcb-design-workflow',
  track: 'T7',
  title: 'PCB Design Workflow',
  subtitle: 'Schematic to factory',
  tagline: 'A 2 A feed in 1 oz copper needs about 0.78 mm of trace for a 10 °C rise (IPC-2221); route it at 0.30 mm and it runs near 75 °C.',

  board: {
    name: 'ATELIER POWER rev A',
    size: [7, 4.5],
    base: 'mat',
    frame: { size: [10.6, 5.4], center: [1.4, 0] },
    layers: LAYERS,
    parts: [
      {
        id: 'j1',
        kind: 'barrel-jack',
        pos: [-2.6, 1.6],
        mount: 'tht',
        label: '12 V IN',
        role: '2.1 mm barrel jack at the board edge: 12 V in. Connectors go on the edge so the cable never crosses the board.',
        params: { callout: [-0.6, 1.4, 0.5] },
        circuitIds: ['V_IN'],
      },
      {
        id: 'j2',
        kind: 'screw-terminal',
        pos: [2.8, 1.7],
        mount: 'tht',
        label: 'OUT 2 A',
        role: '2-way 5.08 mm screw terminal: the 2 A output, also on the edge. Its ground pad is poured solid, which the DRC flags.',
        params: { pins: 2, callout: [0.2, 1.4, 0.6] },
      },
      {
        id: 'u1',
        kind: 'ic-smd',
        pos: [0.4, -0.7],
        mount: 'smd',
        label: 'MCU',
        role: 'ATmega328P-AU in a TQFP-32 (0.8 mm pitch). Placed and routed to show decoupling and fine-pitch clearance; the simulation drives only the 12 V power path.',
        params: { package: 'TQFP', pins: 32, marking: 'ATMEGA328P', callout: [-0.4, 1.3, -0.6] },
        facts: ['TQFP-32, 7 × 7 mm body, 0.8 mm lead pitch', 'Separate VCC and AVCC pins, each wants its own 100 nF next to it'],
      },
      {
        id: 'c1',
        kind: 'capacitor-smd',
        pos: [0.444, -0.08],
        mount: 'smd',
        label: 'C1 100n',
        role: '100 nF X7R decoupling on VCC, its pad about 2 mm from the pin: the high-frequency current loop stays tiny.',
        params: { size: '0805', callout: [0.5, 1.0, 0.3] },
      },
      {
        id: 'c2',
        kind: 'capacitor-smd',
        pos: [1.9, -1.7],
        mount: 'smd',
        label: 'C2 100n',
        role: '100 nF on AVCC, placed 14 mm away at the corner. The trace between is an inductor in series with it, so the DRC rule (within 3 mm) flags it.',
        params: { size: '0805', callout: [0.6, 1.0, -0.3] },
      },
      {
        id: 'r1',
        kind: 'resistor-smd',
        pos: [-0.6, 1.4],
        mount: 'smd',
        role: '4.7 kΩ status-LED resistor: (12 − 1.8) V / 4.7 kΩ ≈ 2.2 mA.',
        params: { size: '0805', ohms: 4700 },
        circuitIds: ['R_LED'],
      },
      {
        id: 'd1',
        kind: 'led-smd',
        pos: [0.2, 1.4],
        mount: 'smd',
        role: 'Red power LED, cathode to a ground via. Its silkscreen bar marks the cathode.',
        params: { size: '0805', color: 'red' },
        circuitIds: ['LED'],
      },
      {
        id: 'j3',
        kind: 'header-male',
        pos: [-1.8, -1.2],
        mount: 'tht',
        label: 'ISP',
        role: '2 × 3 programming header. Its SCK and MISO traces run only 0.10 mm apart near the MCU: a clearance violation.',
        params: { pins: 3, rows: 2, callout: [-0.4, 1.2, -0.5] },
      },
      { id: 'tp1', kind: 'testpoint', pos: [-1.6, 0.25], mount: 'tht', role: 'Test point on the 12 V rail, for the bring-up probe.' },
      { id: 'tp2', kind: 'testpoint', pos: [1.6, 0.25], mount: 'tht', role: 'Ground test point, tied to the pour with a thermal relief.' },
      {
        id: 'eload',
        kind: 'module',
        pos: [5.7, 1.25],
        mount: 'offboard',
        label: 'E-LOAD',
        role: 'A bench electronic load in constant-current mode: it sinks the set current whatever the trace drops, so the trace is tested at exactly 2 A.',
        params: { title: 'E-LOAD CC', color: '#5f6b75', w: 1.9, d: 1.6, pins: 0, chip: 'none', callout: [0.3, 1.3, -0.3] },
        circuitIds: ['R_LOAD'],
      },
      { id: 'w_pos', kind: 'wire', ...jumper(OUT_POS, LOAD_POS, 'red', 0.3), mount: 'offboard', role: 'Output + to the load.' },
      { id: 'w_neg', kind: 'wire', ...jumper(OUT_NEG, LOAD_NEG, 'black', 0.25), mount: 'offboard', role: 'Return from the load.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_IN', type: 'V', nodes: ['src', '0'], value: 12, rInternal: 0.05, partId: 'j1' },
      { id: 'P_IN', type: 'PROBE', nodes: ['src', 'vin'] },
      // the 2 A power trace itself: `trace-heat` sets its value from width, length and temperature
      { id: 'TRACE', type: 'R', nodes: ['vin', 'out'], value: 0.1 },
      // the e-load in CC mode (an R `e-load` re-sizes to V / I_set)
      { id: 'R_LOAD', type: 'R', nodes: ['out', 'gret'], value: 6, partId: 'eload' },
      // J2's ground pad joint (a good joint: 2 mΩ; a failure makes it cold)
      { id: 'J2_GND', type: 'R', nodes: ['gret', '0'], value: 0.002 },
      { id: 'R_LED', type: 'R', nodes: ['vin', 'led_a'], value: 4700, partId: 'r1' },
      { id: 'LED', type: 'LED', nodes: ['led_a', '0'], color: 'red', rating: { maxI: 0.02, maxV: 5 }, partId: 'd1' },
    ],
  },
  powerElementId: 'V_IN',
  powerLabel: 'Switch on 12 V',
  transient: false,

  readouts: [
    { label: 'TRACE CURRENT', source: { kind: 'current', elementId: 'TRACE' }, unit: 'A' },
    { label: 'TRACE TEMP', source: { kind: 'behavior', key: 'tr.temp_C' }, unit: '°C', digits: 3, warnAbove: 105 },
    { label: 'IPC RISE (steady)', source: { kind: 'behavior', key: 'tr.dT_ss' }, unit: '°C', digits: 3 },
    { label: 'IPC WIDTH NEEDED, mm', source: { kind: 'behavior', key: 'tour.wmin_mm' }, unit: '', digits: 2 },
    { label: 'TRACE WIDTH, mm', source: { kind: 'behavior', key: 'tr.widthMm' }, unit: '', digits: 2 },
    { label: 'TRACE RESISTANCE', source: { kind: 'behavior', key: 'tr.r_ohm' }, unit: 'Ω' },
    { label: 'TRACE DROP', source: { kind: 'voltage', node: 'vin', ref: 'out' }, unit: 'V' },
    { label: 'TRACE LOSS', source: { kind: 'power', elementId: 'TRACE' }, unit: 'W' },
    { label: 'DRC ERRORS', source: { kind: 'behavior', key: 'tour.drc_errors' }, unit: '', digits: 1 },
    { label: 'LED CURRENT', source: { kind: 'current', elementId: 'LED' }, unit: 'A' },
    { label: 'GND JOINT DROP', source: { kind: 'voltage', node: 'gret' }, unit: 'V' },
  ],

  behaviors: [
    {
      id: 'trace-heat',
      instance: 'tr',
      params: { element: 'TRACE', widthMm: 0.3, oz: 1, lengthMm: PWR_LENGTH_MM, ambientC: 25, tau: 1.5, failC: 300, riseC: 10 },
    },
    { id: 'e-load', instance: 'load', params: { element: 'R_LOAD', node: 'out', ref: 'gret', iSet: 2 } },
    {
      id: 'pcb-tour',
      instance: 'tour',
      params: { view: 0, drc: 0, staticErrors: STATIC_DRC_ERRORS, widthKey: 'tr.widthMm', ampsKey: 'load.iSet', ozKey: 'tr.oz', riseC: 10, w: 0.3, a: 2, oz: 1 },
    },
  ],

  tweaks: [
    {
      label: 'Power trace width',
      elementId: 'behavior:tr',
      key: 'widthMm',
      kind: 'enum',
      min: 0.1,
      max: 1.5,
      unit: '',
      options: [
        { label: '0.15 mm', value: 0.15 },
        { label: '0.30 mm', value: 0.3 },
        { label: '0.50 mm', value: 0.5 },
        { label: '0.80 mm', value: 0.8 },
        { label: '1.20 mm', value: 1.2 },
      ],
    },
    {
      label: 'Load current',
      elementId: 'behavior:load',
      key: 'iSet',
      kind: 'enum',
      min: 0,
      max: 3,
      unit: '',
      options: [
        { label: '0.5 A', value: 0.5 },
        { label: '1 A', value: 1 },
        { label: '2 A', value: 2 },
      ],
    },
    {
      label: 'Copper weight',
      elementId: 'behavior:tr',
      key: 'oz',
      kind: 'enum',
      min: 1,
      max: 2,
      unit: '',
      options: [
        { label: '1 oz (35 µm)', value: 1 },
        { label: '2 oz (70 µm)', value: 2 },
      ],
    },
    {
      label: 'Layer view',
      elementId: 'behavior:tour',
      key: 'view',
      kind: 'enum',
      min: 0,
      max: 6,
      unit: '',
      options: [
        { label: 'All', value: 0 },
        { label: 'Bottom Cu', value: 1 },
        { label: 'Core', value: 2 },
        { label: 'Top Cu', value: 3 },
        { label: 'Mask', value: 4 },
        { label: 'Silk', value: 5 },
        { label: 'Drill', value: 6 },
      ],
    },
    { label: 'DRC overlay', elementId: 'behavior:tour', key: 'drc', kind: 'toggle', min: 0, max: 1, unit: '' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: {0} through the power trace, which runs at {1} and drops {6}.' },
    { when: { kind: 'above', readout: 1, value: 105 }, text: 'HOT: the trace is at {1}, past what the solder mask and nearby parts like. IPC-2221 wants {3} mm for this current.' },
    { when: { kind: 'above', readout: 10, value: 0.2 }, text: 'COLD JOINT: {10} is lost in J2’s ground pad, so the load gets less than 12 V.' },
    { when: { kind: 'state', is: 'FAULT' }, text: 'FAULT: the power trace has burnt open. The e-load reads 0 A.' },
  ],

  failures: [
    {
      id: 'thin-trace',
      label: 'Route the 2 A feed at 0.10 mm',
      explain:
        'Routed at the fab’s finest 0.10 mm, the feed has a cross-section of about 5.4 mil². IPC-2221 extrapolated well past its 100 °C chart puts 2 A there near a 300 °C rise. Long before that the epoxy under it chars and the copper lifts off. The sim opens the trace once its estimate passes 300 °C. A width that is fine for a signal is not fine for power: size every power net from its current.',
      patches: [{ op: 'set', elementId: 'behavior:tr', key: 'widthMm', value: 0.1 }],
    },
    {
      id: 'cold-joint',
      label: 'Solder J2 GND with no thermal relief',
      explain:
        'J2’s ground pad is poured solid into the bottom copper, so the pour sinks the iron’s heat and the solder never wets properly. The result is a grainy, resistive "cold" joint. The 0.5 Ω here is illustrative (real cold joints vary and are often intermittent), and at 2 A it loses 1 V and makes 2 W of heat right in the joint. Thermal-relief spokes keep the pad hot enough to solder and still carry the current.',
      patches: [{ op: 'set', elementId: 'J2_GND', key: 'value', value: 0.5 }],
    },
  ],

  instruments: {
    chart: { signals: [1, 0, 6], span: 12 },
  },

  meet: `A PCB is designed the way you design a part: a concept, standard library features, a detailed layout, a drawing check, then released manufacturing files.

1. **Schematic and netlist.** The schematic is the circuit's intent. Its output, the **netlist**, lists which pins share a net. The layout tool refuses connections the netlist doesn't have. **ERC** checks the schematic: no unconnected input pins, and every power pin fed.
2. **Footprints.** Each symbol gets a land pattern taken from the datasheet: pad sizes, pitch and the courtyard it occupies. A TQFP-32 has 0.8 mm pitch. Get the pin order wrong and every board is scrap.
3. **Placement.** Connectors go **on the edge** (J1, J2 here). Decoupling capacitors go **right at their pins**: C1 is about 2 mm from VCC. C2, 14 mm from AVCC, breaks the 3 mm rule. Place before you route: placement decides most of the routing.
4. **Routing.** Route power first, sized by **IPC-2221**. For outer layers, I = 0.048 · ΔT^0.44 · A^0.725, with A in mil². For 2 A at a 10 °C rise that gives A ≈ 42 mil², so in 1 oz copper (1.378 mil thick) the trace is about 31 mil ≈ **0.78 mm** wide. For 1 A it is **0.30 mm**. Signals can use the fab's minimum, here **0.15 mm (6 mil)** trace and space.
5. **Pours, vias, layers.** Two layers: top copper for parts and routes, bottom copper flooded as **ground**, with vias stitching the two together. Pads in a pour connect through **thermal-relief** spokes so they can still be soldered.
6. **Solder mask and silkscreen.** The mask covers bare copper and opens only over pads. Silkscreen carries reference designators, pin-1 dots and polarity marks.
7. **DRC.** The design-rule check measures the layout against the fab's rules: trace width, clearance, annular ring, plus your own rules such as the decoupling distance.
8. **Fabrication and assembly outputs.** **Gerbers** (one file per layer), an **Excellon drill** file, the **BOM** (what to buy), and the **pick-and-place / CPL** file (each part's centre, rotation and side). **Fiducials** are the bare copper dots the assembly camera aligns to.

**The trace is a resistor.** 61 mm × 0.80 mm × 35 µm of copper is about 38 mΩ cold (ρ = 1.72 × 10⁻⁸ Ω·m, +0.39 %/°C), so at 2 A it drops about 80 mV and heats by I²R. Make it narrower and both get worse, because R scales as 1/w.`,

  mechanicalAnalogy: `> You already do this in CAD. The schematic is the assembly concept and the netlist is its mate list. Footprints are library features (standard holes, threads). Layout is the detail design, and the DRC is the drawing check against the shop's capabilities. Minimum trace and space are the fab's equivalent of a minimum wall thickness and standard drill sizes. Gerbers and the drill file are the released drawings; the BOM and pick-and-place file are the assembly routing sheet. Fiducials are datum features.
>
> **Where it breaks:** a trace has no visible tolerance stack, but it carries current, and IPC-2221 is its "stress check". A layout can be dimensionally perfect and still overheat, ring or radiate. No visual check finds that.`,

  proTips: [
    'Load your fab’s design rules into the layout tool before you place the first part, not after routing. Squeezing 0.15 mm clearances into a finished board costs days.',
    'Size every power net from its current with IPC-2221, and write the width into a net class, so the router can’t quietly use the signal default.',
    'Put labelled test points on every rail. Probing a 0402 pad during bring-up is how pads get lifted.',
    'Order a handful of rev A boards and bring them up stage by stage (power, then MCU, then the rest), first from a current-limited supply.',
  ],

  quiz: [
    {
      q: 'By IPC-2221 (outer layer, 1 oz, 10 °C rise), roughly how wide should a 2 A trace be?',
      options: ['0.15 mm', '0.30 mm', '0.78 mm', '3 mm'],
      answer: 2,
      why: 'A = (2 / (0.048 × 10^0.44))^(1/0.725) ≈ 42 mil², and 42 / 1.378 ≈ 31 mil ≈ 0.78 mm. 0.30 mm is the figure for 1 A.',
    },
    {
      q: 'You change from 1 oz to 2 oz copper. What happens to the width a 2 A trace needs?',
      options: ['It roughly halves', 'It stays the same', 'It doubles', 'It drops by a factor of four'],
      answer: 0,
      why: 'IPC-2221 sizes the cross-section. Doubling the thickness halves the width for the same area: about 0.39 mm.',
    },
    {
      q: 'Which file tells the assembly machine where each part goes?',
      options: ['The Gerber of the top copper', 'The Excellon drill file', 'The pick-and-place (CPL) file', 'The BOM'],
      answer: 2,
      why: 'The CPL lists every part’s designator, X/Y centre, rotation and side. The BOM says what each part is; the Gerbers and drill file make the bare board.',
    },
    {
      q: 'Why does a pad in a copper pour get thermal-relief spokes?',
      options: ['To raise its current rating', 'So the pour does not sink the soldering heat', 'To pass the clearance rule', 'To lower its inductance'],
      answer: 1,
      why: 'Joined solid to a large pour, the pad cannot get hot enough to wet, so you get a cold joint. Spokes keep the heat in the pad while still connecting it.',
    },
  ],

  guide: [
    {
      id: 'power-on',
      title: 'Switch on 12 V',
      body: 'Press **Switch on 12 V**. The e-load pulls **2 A** through J1, the power trace and J2.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'power' }, { kind: 'status', is: 'POWERED' }] },
      focus: { control: 'power' },
      hint: 'The blue button at the top left of the bench.',
    },
    {
      id: 'hot-trace',
      title: 'Feel the 0.30 mm trace',
      body: `The feed is routed at **0.30 mm**, the IPC-2221 width for 1 A. At 2 A, IPC-2221 gives a rise of about **48 °C**, so **TRACE TEMP** climbs to about **73 °C**.`,
      check: { kind: 'readout', index: 1, above: 62, below: 85, holdMs: 300 },
      focus: { part: 'j2' },
      explain: `The rise grows as I^(1/0.44) ≈ I^2.3. Doubling the current makes it about 4.8 times as large, even though the trace is unchanged.`,
    },
    {
      id: 'drc-on',
      title: 'Run the DRC',
      body: 'Switch on **DRC overlay**. **DRC ERRORS** reads **4**, each one ringed on the board: the 2 A trace, a 0.10 mm SCK/MISO gap, C2 too far from AVCC, and J2’s ground pad with no thermal relief.',
      check: { kind: 'all', of: [{ kind: 'tweak', target: 'DRC overlay', min: 1 }, { kind: 'readout', index: 8, above: 3.5, holdMs: 250 }] },
      focus: { control: 'tweak:DRC overlay' },
      explain: 'A DRC checks geometry against numbers, the fab’s and your own. It can’t know the current a net carries unless you tell it, through a net class or a rule like this one.',
    },
    {
      id: 'widen',
      title: 'Widen it to 0.80 mm',
      body: `Set **Power trace width** to **0.80 mm**. IPC-2221 needs ${ipcWidthMm(2, 10, 1).toFixed(2)} mm for 2 A at a 10 °C rise. **TRACE TEMP** falls to about **35 °C** and **DRC ERRORS** drops to **3**.`,
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Power trace width', min: 0.79 },
          { kind: 'readout', index: 1, below: 40, holdMs: 300 },
          { kind: 'readout', index: 8, below: 3.5 },
        ],
      },
      focus: { control: 'tweak:Power trace width' },
      explain: 'Wider copper means lower R (about 40 mΩ here), less I²R and more surface to shed the heat. Try 2 oz copper: half the width does the same job.',
    },
    {
      id: 'peel',
      title: 'Peel the board apart',
      body: 'Press **Exploded view**. The board separates into what the fab builds: **bottom copper** (the ground pour), the **FR-4 core**, **top copper**, the **solder mask** and the **silkscreen**. The **drill** hits run through all of them.',
      check: { kind: 'action', action: 'explode' },
      focus: { control: 'explode' },
      explain: 'Each sheet is one Gerber file. The drill hits are the Excellon file. Together with the outline, that is everything a fab needs to make the bare board.',
    },
    {
      id: 'bottom-copper',
      title: 'Isolate the bottom copper',
      body: 'Set **Layer view** to **Bottom Cu**. The ground pour fills the layer, cleared around every other net. Look at J2’s ground pad: it is poured solid, while J1’s has four relief spokes.',
      check: { kind: 'tweak', target: 'Layer view', min: 1, max: 1 },
      focus: { control: 'tweak:Layer view' },
      explain: 'A pour is a low-impedance return under every signal, and it spreads heat. The spokes are the compromise between carrying current and letting the pad be soldered.',
    },
    {
      id: 'break-thin',
      title: 'Break it: a signal-width power trace',
      body: 'Set **Layer view** back to **All**, then open **Break something** and choose **Route the 2 A feed at 0.10 mm**. Watch **TRACE TEMP** shoot past 105 °C until the trace burns open.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'thin-trace' }, { kind: 'status', is: 'FAULT' }] },
      focus: { control: 'break' },
      hint: 'It takes a few seconds: the copper has to heat up.',
    },
    {
      id: 'repair',
      title: 'Repair',
      body: 'Choose **Repair all**. The trace returns at your 0.80 mm width and **TRACE CURRENT** is back to **2 A**.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'repair' }, { kind: 'readout', index: 0, above: 1.8, holdMs: 250 }] },
      focus: { control: 'break' },
    },
    { id: 'quiz', title: 'Check yourself', body: 'Answer the questions below.', check: { kind: 'quiz' }, focus: { control: 'quiz' } },
  ],
}
