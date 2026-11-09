// T6 · Load Cell and HX711. Source: docs/curriculum/T6/loadcell-hx711.md
//
// The Wheatstone bridge is four real resistors in the netlist (sg1..sg4), so the millivolt output is
// solved. The `hx711` behavior sets the gauges from the mass on the pan (with creep and any
// permanent set from an overload), converts V(A+) − V(A−) against AVDD at 10 or 80 SPS, gain 128,
// 24-bit two's complement, and gives the sketch a bogde-style `HX711` / `scale`. The module's AVDD
// regulator is a clamped buffer at 4.3 V, which rejects the slow wander a V source (v_noise) puts
// on the USB rail, until a failure excites the bridge from the raw rail instead.
import type { LessonDef } from '../../engine/types'
import { PITCH, jumper } from '../layout'

// ── bench layout: a 12 × 9 PCB with the Uno on the right (rot 0: USB toward the viewer, digital
// header on its −x edge facing the HX711 area) and the bar cell off the board to the left ──
const UNO_AT: [number, number] = [3.6, 0.6]
const UNO_HEADER_Y = 0.16 + 0.85
/** Uno digital socket D0..D7 */
const unoDigital = (pin: number): [number, number, number] => [UNO_AT[0] - 2.4, UNO_HEADER_Y, UNO_AT[1] - (2.35 + (3.5 - pin) * PITCH)]
/** the GND socket on the digital header */
const unoDigitalGnd: [number, number, number] = [UNO_AT[0] - 2.4, UNO_HEADER_Y, UNO_AT[1] - (-0.25 + (3 - 4.5) * PITCH)]
/** Uno power socket: 4 = 5V */
const unoPower = (k: number): [number, number, number] => [UNO_AT[0] + 2.4, UNO_HEADER_Y, UNO_AT[1] - (-0.35 + (k - 3.5) * PITCH)]

// HX711 module area: MCU header (GND DT SCK VCC) and cell header (E+ E− A− A+ B− B+), rot 90
const HDR_TOP = 0.85
const HM: [number, number] = [-0.6, -0.6]
const HM_PINS = ['GND', 'DT', 'SCK', 'VCC'] as const
const hm = (name: (typeof HM_PINS)[number]): [number, number, number] => [HM[0], HDR_TOP, HM[1] - (HM_PINS.indexOf(name) - 1.5) * PITCH]
const HC: [number, number] = [-4.6, -0.4]
const HC_PINS = ['E+', 'E-', 'A-', 'A+', 'B-', 'B+'] as const
const hc = (name: (typeof HC_PINS)[number]): [number, number, number] => [HC[0], HDR_TOP, HC[1] - (HC_PINS.indexOf(name) - 2.5) * PITCH]
const U1: [number, number] = [-2.6, -0.4]
const CELL: [number, number] = [-11.0, -0.4]

type Wire = ReturnType<typeof jumper>
const wire = (w: Wire, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

/** the label's nominal 1.0 mV/V: 1e-6 per gram × 128 × 2^24 */
export const NOMINAL_FACTOR = 2147.0

const sketch = `#include <HX711.h>
// The bench's HX711 library returns the latest conversion instead of
// waiting for the next one, so the loop paces itself with delay().

const int DOUT_PIN = 3;
const int SCK_PIN = 2;

// Counts per gram. The label's 1.0 mV/V predicts 2147 (E+ on AVDD:
// 1e-6 per gram x 128 x 2^24). Real cells are 1.0 +/- 0.15 mV/V,
// so calibrate: tare empty, put 500 g on, copy per_g in here.
float calFactor = 2147.0;
const float KNOWN = 500.0;   // grams, the calibration mass

HX711 scale;

void setup() {
  Serial.begin(115200);
  scale.begin(DOUT_PIN, SCK_PIN);    // channel A, gain 128
  Serial.println("Empty the pan: taring...");
  delay(1500);
  scale.tare(10);                    // average of 10 readings: 1 s at 10 SPS
  scale.set_scale(calFactor);
  Serial.print("offset:");
  Serial.println(scale.get_offset());   // the zero balance, in counts
  Serial.println("Tared. Place masses now.");
}

void loop() {
  delay(500);                        // 5 new readings at 10 SPS
  float grams = scale.get_units(5);  // average of 5, minus tare, / calFactor
  float net = scale.get_value(5);    // counts above tare
  Serial.print("g:");
  Serial.print(grams, 1);
  Serial.print(",net:");
  Serial.print(net, 0);
  Serial.print(",per_g:");
  Serial.println(net / KNOWN, 1);    // read this with the known mass on
}
`

export const lesson: LessonDef = {
  id: 'loadcell-hx711',
  track: 'T6',
  title: 'Load Cell and HX711',
  subtitle: 'Weighing microvolts',
  tagline: 'A 1 kg bar cell gives 4.3 mV at full load, and the HX711\'s 24-bit, ×128 front end turns that into about 2 100 counts per gram.',

  board: {
    name: 'SCALE BENCH',
    size: [12, 9],
    base: 'mat',
    frame: { size: [22, 10], center: [-4.6, 0] },
    traces: [
      // MCU header → HX711 (DT, SCK, VCC, GND)
      [[HM[0] - 0.15, hm('DT')[2]], [-1.6, hm('DT')[2]], [-2.1, U1[1] - 0.1]],
      [[HM[0] - 0.15, hm('SCK')[2]], [-1.6, hm('SCK')[2]], [-2.1, U1[1] + 0.1]],
      [[HM[0] - 0.15, hm('VCC')[2]], [-1.2, hm('VCC')[2]], [-1.7, 1.2]],
      [[HM[0] - 0.15, hm('GND')[2]], [-1.3, hm('GND')[2]], [-1.3, -1.6], [-3.5, -1.6]],
      // cell header → HX711 inputs and the excitation
      [[HC[0] + 0.15, hc('A+')[2]], [-3.6, hc('A+')[2]], [-3.1, U1[1] - 0.05]],
      [[HC[0] + 0.15, hc('A-')[2]], [-3.6, hc('A-')[2]], [-3.1, U1[1] + 0.05]],
      [[HC[0] + 0.15, hc('E+')[2]], [-4.0, hc('E+')[2]], [-4.0, 1.2], [-2.9, 1.2]],
      [[HC[0] + 0.15, hc('E-')[2]], [-3.8, hc('E-')[2]], [-3.8, -1.6]],
    ],
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], 0, UNO_AT[1]],
        mount: 'module',
        label: 'UNO',
        role: 'Clocks the HX711 on pin 2 (SCK), reads its data on pin 3 (DT), and turns counts into grams.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [0, 1.8, 1.2] },
        circuitIds: ['pin2', 'pin3', 'v_usb'],
      },
      {
        id: 'hxm',
        kind: 'logic-ic-label',
        pos: [-2.6, 0, 2.4],
        mount: 'smd',
        label: 'HX711 MODULE',
        role: 'The carrier area of the common green HX711 breakout: the converter, its AVDD regulator transistor and divider, and decoupling.',
        params: { text: 'HX711 MODULE', size: 0.2, callout: [-0.8, 0.6, 1.4] },
      },
      {
        id: 'u1',
        kind: 'ic-smd',
        pos: [U1[0], 0, U1[1]],
        mount: 'smd',
        label: 'HX711',
        role: 'Low-noise programmable-gain amplifier plus a 24-bit delta-sigma ADC, with an on-chip regulator controller for the analog supply.',
        params: { package: 'SOP', pins: 16, marking: 'HX711', callout: [0.6, 1.6, -0.6] },
        circuitIds: ['i_hx'],
        facts: [
          'Full-scale input ±0.5 × AVDD / gain: ±16.8 mV at gain 128, AVDD 4.3 V',
          'Channel A gain 128 or 64; channel B gain 32',
          'Output 24-bit two\'s complement, 0x800000 .. 0x7FFFFF',
          'Data rate 10 SPS (RATE low) or 80 SPS (RATE high), internal oscillator',
          'Settling 400 ms at 10 SPS, 50 ms at 80 SPS (4 conversions)',
          'Input noise 50 nV rms (gain 128, 10 SPS), 90 nV rms (80 SPS)',
          'Supply 2.6–5.5 V, under 1.5 mA running, under 1 µA powered down',
        ],
      },
      {
        id: 'q1',
        kind: 'ic-smd',
        pos: [-2.6, 0, 1.2],
        mount: 'smd',
        label: 'AVDD PNP',
        role: 'Pass transistor of the AVDD (excitation) regulator. The HX711 drives its base from VFB, so AVDD = 1.25 V × (R1 + R2) / R2.',
        params: { package: 'SOT-23', pins: 4, marking: 'S8550', callout: [0, 1.7, 1.7] },
        circuitIds: ['avdd_reg'],
      },
      {
        id: 'r_div',
        kind: 'resistor-smd',
        pos: [-1.7, 0, 1.2],
        rot: 90,
        mount: 'smd',
        label: 'AVDD SET',
        role: 'The regulator\'s feedback divider: about 4.3 V on many modules (20 kΩ over 8.2 kΩ gives 1.25 × 28.2 / 8.2 = 4.30 V). Measure E+ on yours.',
        params: { size: '0603', ohms: 20000, callout: [1.2, 1.0, 1.3] },
      },
      {
        id: 'c_dec',
        kind: 'capacitor-smd',
        pos: [-3.5, 0, 1.2],
        rot: 90,
        mount: 'smd',
        label: 'DECOUPLE',
        role: 'AVDD and VBG decoupling. The bridge signal is microvolts, so the analog rail must be quiet.',
        params: { size: '0603', callout: [-1.2, 1.4, -0.2] },
      },
      {
        id: 'hdr_cell',
        kind: 'header-male',
        pos: [HC[0], 0, HC[1]],
        rot: 90,
        mount: 'tht',
        label: 'CELL',
        role: 'E+ E− A− A+ B− B+: excitation out, bridge signal in (channel B unused).',
        params: { pins: 6, callout: [-0.2, 1.6, -1.2] },
        circuitIds: ['w_exc', 'w_sp', 'w_sn'],
      },
      {
        id: 'hdr_mcu',
        kind: 'header-male',
        pos: [HM[0], 0, HM[1]],
        rot: 90,
        mount: 'tht',
        label: 'MCU',
        role: 'GND, DT, SCK, VCC: a two-wire serial link to the Uno (not I²C: the HX711 clocks out 24 bits on SCK).',
        params: { pins: 4, callout: [0.2, 1.5, -1.0] },
      },
      {
        id: 'cell',
        kind: 'load-cell',
        pos: [CELL[0], 0, CELL[1]],
        mount: 'offboard',
        label: 'LOAD CELL',
        role: 'A 1 kg aluminium bar cell: four foil strain gauges in a full bridge, two stretched and two squeezed when the free end is loaded.',
        params: { marking: '1 kg', callout: [0, 2.2, 0.6] },
        circuitIds: ['sg1', 'sg2', 'sg3', 'sg4'],
        facts: [
          'Rated capacity 1 kg; rated output 1.0 ± 0.15 mV/V (typical bar cell)',
          'Bridge resistance about 1 kΩ (input and output)',
          'Zero balance within about ±0.1 mV/V',
          'Safe overload 120 % of capacity; ultimate overload typically 150 %',
          'Wire colours (red E+, black E−, green A+, white A−) are a convention: check the datasheet',
        ],
      },
      { id: 'w_dt', kind: 'wire', ...wire(jumper(unoDigital(3), hm('DT'), 'green', 0.7), [0, 0.6, -0.3]), mount: 'offboard', role: 'Pin 3 to DT (DOUT): the HX711 pulls it low when a conversion is ready.' },
      { id: 'w_sck', kind: 'wire', ...wire(jumper(unoDigital(2), hm('SCK'), 'yellow', 0.9), [0, 0.7, -0.5]), mount: 'offboard', role: 'Pin 2 to SCK: 25 pulses read 24 bits and pick gain 128 for the next conversion.' },
      { id: 'w_gnd', kind: 'wire', ...wire(jumper(unoDigitalGnd, hm('GND'), 'black', 0.5), [0, 0.5, 0.3]), mount: 'offboard', role: 'Uno GND to the module\'s GND.' },
      { id: 'w_vcc', kind: 'wire', ...wire(jumper(unoPower(4), hm('VCC'), 'red', 1.6), [0, 1.0, 0.3]), mount: 'offboard', role: 'Uno 5 V to VCC: the module regulates its own AVDD from it.' },
      {
        id: 'w_exc5',
        kind: 'wire',
        ...wire(jumper(unoPower(4), hc('E+'), 'orange', 2.0), [0, 1.2, 0.4]),
        mount: 'offboard',
        hidden: true,
        label: '5 V → E+',
        role: 'A jumper exciting the bridge straight from the Uno\'s 5 V rail.',
      },
    ],
  },

  circuit: {
    elements: [
      { id: 'v_usb', type: 'V', nodes: ['usb_raw', '0'], value: 5, rInternal: 0.3, partId: 'uno' },
      // the USB rail's slow wander, driven by the hx711 behavior (railNoiseMv rms)
      { id: 'v_noise', type: 'V', nodes: ['usb_vbus', 'usb_raw'], value: 0, partId: 'uno' },
      { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', 'vbus_in'], closed: true, partId: 'uno' },
      { id: 'f1', type: 'R', nodes: ['vbus_in', '5v'], value: 0.3, rating: { maxI: 1.0 }, partId: 'uno' },
      { id: 'r_board', type: 'R', nodes: ['5v', '0'], value: 111, partId: 'uno' }, // the Uno's ~45 mA
      { id: 'i_hx', type: 'I', nodes: ['5v', '0'], value: 0.0015, rating: { maxV: 6 }, partId: 'u1' },
      // AVDD regulator: a clamped buffer at 4.3 V (VBG 1.25 V × 28.2 / 8.2)
      { id: 'avdd_reg', type: 'OPAMP', nodes: ['5v', 'avdd', 'avdd'], vPos: 4.3, vNeg: 0, partId: 'q1' },
      // cell wires (red E+, black E−, green A+, white A−) and the four gauges
      { id: 'w_exc', type: 'R', nodes: ['avdd', 'ep'], value: 0.01, partId: 'hdr_cell' },
      { id: 'sg1', type: 'R', nodes: ['ep', 'sp'], value: 1000, partId: 'cell' }, // compression
      { id: 'sg2', type: 'R', nodes: ['sp', 'em'], value: 1000, partId: 'cell' }, // tension
      { id: 'sg3', type: 'R', nodes: ['ep', 'sn'], value: 1000, partId: 'cell' }, // tension
      { id: 'sg4', type: 'R', nodes: ['sn', 'em'], value: 1000, partId: 'cell' }, // compression
      { id: 'w_em', type: 'R', nodes: ['em', '0'], value: 0.01, partId: 'hdr_cell' },
      { id: 'w_sp', type: 'R', nodes: ['sp', 'ap'], value: 0.01, partId: 'hdr_cell' },
      { id: 'w_sn', type: 'R', nodes: ['sn', 'an'], value: 0.01, partId: 'hdr_cell' },
      { id: 'pin2', type: 'PIN', nodes: ['d2', '0'], pin: 2, vcc: 5, partId: 'uno' },
      { id: 'pin3', type: 'PIN', nodes: ['d3', '0'], pin: 3, vcc: 5, partId: 'uno' },
    ],
  },
  powerElementId: 'usb_plug',
  powerLabel: 'Plug USB',
  // conversions average the solved bridge over each 100 ms / 12.5 ms period: 40 / 5 steps
  sim: { dt: 2.5e-3 },

  behaviors: [
    {
      id: 'hx711',
      params: {
        supply: '5v',
        avdd: 'avdd',
        inP: 'ap',
        inN: 'an',
        exc: 'ep',
        gauges: 'sg1,sg2,sg3,sg4',
        r0: 1000,
        capacityG: 1000,
        mvPerV: 0.98, // this cell's calibration certificate value, inside 1.0 ± 0.15
        zeroMvV: 0.05,
        massG: 0,
        rate: 10,
        gain: 128,
        noiseNv: 50,
        noise80Nv: 90,
        creepPct: 0.05,
        creepTau: 600,
        safePct: 120,
        setPct: 0.2,
        shockG: 0,
        noiseEl: 'v_noise',
        railNoiseMv: 10,
        dout: 3,
        sck: 2,
      },
    },
    { id: 'mcu-supply', instance: 'mcu', params: { supplyNode: '5v', bor: 2.7, fClk: 16 } },
    { id: 'serial-plotter', instance: 'serial' },
  ],

  readouts: [
    { label: 'TRUE MASS', source: { kind: 'behavior', key: 'hx711.true_g' }, unit: 'g' },
    { label: 'MEASURED', source: { kind: 'behavior', key: 'serial.g' }, unit: 'g' },
    { label: 'BRIDGE OUTPUT', source: { kind: 'voltage', node: 'ap', ref: 'an' }, unit: 'V' },
    { label: 'EXCITATION E+', source: { kind: 'voltage', node: 'ep' }, unit: 'V' },
    { label: 'RAW CODE', source: { kind: 'behavior', key: 'hx711.raw' }, unit: 'counts', digits: 1 },
    { label: 'PER GRAM', source: { kind: 'behavior', key: 'serial.per_g' }, unit: 'counts', digits: 1 },
    { label: 'GAUGE ΔR', source: { kind: 'behavior', key: 'hx711.dR' }, unit: 'Ω' },
    { label: 'TARE OFFSET', source: { kind: 'behavior', key: 'serial.offset' }, unit: 'counts', digits: 1 },
  ],

  instruments: {
    chart: { signals: [1, 2], span: 20 },
  },

  sketch: { title: 'Tare and weigh', code: sketch, pins: { 2: 'pin2', 3: 'pin3' }, vcc: 5, board: 'uno' },

  tweaks: [
    {
      label: 'Mass on pan',
      elementId: 'behavior:hx711',
      key: 'massG',
      kind: 'enum',
      min: 0,
      max: 1000,
      unit: 'g',
      options: [
        { label: 'Empty', value: 0 },
        { label: '100 g', value: 100 },
        { label: '200 g', value: 200 },
        { label: '500 g', value: 500 },
        { label: '1 kg', value: 1000 },
      ],
    },
    {
      label: 'Data rate',
      elementId: 'behavior:hx711',
      key: 'rate',
      kind: 'enum',
      min: 10,
      max: 80,
      unit: 'SPS',
      options: [
        { label: '10 SPS', value: 10 },
        { label: '80 SPS', value: 80 },
      ],
    },
    { label: 'USB supply voltage', elementId: 'v_usb', key: 'value', min: 4.4, max: 5.25, step: 0.01, unit: 'V' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: E+ is {3} from the module\'s regulator, and the empty cell already gives {2}: its zero balance. Upload the sketch.' },
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: {0} on the pan, the bridge gives {2}, the HX711 reads {4}, the sketch shows {1}.' },
    { when: { kind: 'above', readout: 4, value: 8388000 }, text: 'RAW CODE is pinned at positive full scale: an input is open or the signal is out of range.' },
    { when: { kind: 'below', readout: 4, value: -8388000 }, text: 'RAW CODE is pinned at negative full scale (0x800000): an input is open or the signal is out of range.' },
  ],

  failures: [
    {
      id: 'broken-wire',
      label: 'Break the green A+ wire',
      explain:
        'With A+ open, nothing drives that input. On the bench it drifts to ground, so the converter sees about −2.15 V against a ±16.8 mV range and RAW CODE pins at −8 388 608 (0x800000): MEASURED drops to about −4 000 g and no longer responds to the mass. On a real board an open input floats: the code pins at a rail or wanders. A reading stuck at full scale, or one that ignores the load, points to the cell wires before the code.',
      patches: [{ op: 'remove', elementId: 'w_sp' }],
    },
    {
      id: 'overload',
      label: 'Lean on the pan with 1.4 kg',
      explain:
        'For a second the cell carries 1.4 kg, 140 % of capacity and past its 120 % safe overload. The aluminium flexure yields a little and keeps a permanent set, so the gauges stay strained: with the pan empty again MEASURED reads about +40 g (this bench\'s illustrative 0.2 g of set per gram beyond the safe limit). Tare would hide the offset, but the span and linearity are no longer what the calibration measured. Fit a mechanical overload stop on anything that can be dropped onto or leaned on. Repair fits a new cell.',
      patches: [{ op: 'set', elementId: 'behavior:hx711', key: 'shockG', value: 1400 }],
    },
    {
      id: 'excite-5v',
      label: 'Excite the bridge from the noisy 5 V rail',
      explain:
        'The HX711\'s range is ±0.5 × AVDD / gain, so its reference is AVDD. Excited from that same AVDD, the bridge output and the range move together and any change cancels: a ratiometric measurement. Excited from the Uno\'s 5 V rail instead, E+ is about 4.97 V against a 4.3 V reference, so every reading is about 16 % high (500 g reads about 580 g), and the rail\'s wander (30 mV rms here, illustrative) shows up as several grams of drifting "weight". Slide USB supply voltage and the reading follows it. Keep E+ on the module\'s AVDD.',
      patches: [
        { op: 'remove', elementId: 'w_exc' },
        { op: 'add', element: { id: 'w_exc5', type: 'R', nodes: ['5v', 'ep'], value: 0.01 } },
        { op: 'set', elementId: 'behavior:hx711', key: 'railNoiseMv', value: 30 },
      ],
      parts: { show: ['w_exc5'] },
    },
    {
      id: 'swap-signal',
      label: 'Swap the A+ and A− wires',
      explain:
        'The bridge output is differential, so swapping its two wires flips the sign. With the old tare a 500 g mass reads about −600 g: the load flips, and so does the 51 g-equivalent zero balance the tare was subtracting. Re-tared, it reads about −500 g, which is why this fault can survive a quick test with the pan empty. Swap the wires back, or use a negative calibration factor.',
      patches: [
        { op: 'remove', elementId: 'w_sp' },
        { op: 'remove', elementId: 'w_sn' },
        { op: 'add', element: { id: 'w_sp_x', type: 'R', nodes: ['sp', 'an'], value: 0.01 } },
        { op: 'add', element: { id: 'w_sn_x', type: 'R', nodes: ['sn', 'ap'], value: 0.01 } },
      ],
    },
  ],

  meet: `A strain gauge is a foil grid whose resistance changes with stretch: ΔR/R = GF × strain, with a gauge factor GF of about 2 for metal foil. A load cell bonds **four** gauges to a machined flexure, two in tension and two in compression, wired as a full Wheatstone bridge. Then V_out = V_exc × ΔR/R.

**The signal is tiny.** This cell is rated **1.0 ± 0.15 mV/V** at 1 kg (its certificate says 0.98). With E+ = 4.3 V, full load gives 4.3 × 0.98 ≈ **4.2 mV**, and each gauge changes by only about 1 Ω of its 1 kΩ (GAUGE ΔR). One gram is about **4.2 µV**.

**The HX711:** gain 128 makes the full-scale input ±0.5 × AVDD / 128 = ±0.5 × 4.3 / 128 = **±16.8 mV** (±19.5 mV at a 5 V AVDD), spread over 2²⁴ codes. One code is 16.8 mV / 2²³ ≈ **2.0 nV**. Because the range is set by AVDD and the bridge is excited from AVDD, AVDD cancels: counts per gram = (rated output / capacity) × 128 × 2²⁴ = 0.98 × 10⁻⁶ × 2 147 483 648 ≈ **2 104**. The label's nominal 1.0 mV/V predicts 2 147, which is why you calibrate.

**Zero balance:** an empty cell is never exactly balanced. This one gives about 0.2 mV (0.05 mV/V) with nothing on it. **Tare** averages that and subtracts it.

**Real resolution** is set by noise, not bits: about 50 nV rms at 10 SPS, which is 25 counts or about **0.01 g**. Creep, temperature drift and the way the pan is mounted usually limit a cheap cell long before that.

**Speed:** 10 SPS by default, or 80 SPS with the RATE pin high (noise rises to 90 nV rms). After power-up or a rate change the output takes 4 conversions to settle: 400 ms at 10 SPS.

**Creep:** under a constant load the reading keeps rising slowly as the flexure and the gauge adhesive relax: about 0.05 % of the load in 30 minutes here (illustrative; check your cell's datasheet).`,

  mechanicalAnalogy: `You know this one: a load cell is a machined flexure with foil gauges bonded in its high-strain zones, exactly like the strain gauges on a test rig. The Wheatstone bridge is the quarter, half or full bridge from an experimental-mechanics lab, and the HX711 is a cheap, slow bridge amplifier with the temperature compensation you would design into a lab installation mostly left out. A bending-beam cell's two tension and two compression gauges also cancel the gauge resistance's own temperature drift, the same trick as a dummy gauge.

**Where it breaks:** the datasheet numbers (mV/V, creep, combined error) assume the load goes through the cell's axis. A pan bolted off-centre adds bending and torsion that the bridge only partly rejects, and an overload is plastic deformation of the flexure: the elastic-limit design margin is the 120 % safe overload. Mechanics, not electronics, sets the accuracy.`,

  proTips: [
    'Calibrate with a mass near your working range (say 50–100 % of the expected load), and recheck zero after removing it. A zero that does not come back points to creep, overload or mounting stress.',
    'Let the cell and electronics warm up for several minutes, then tare. Zero drift with temperature is usually the largest error on cheap cells.',
    'Keep the four cell wires twisted together and away from motor or mains wiring, and keep E+ on the module\'s AVDD. At 2 nV per code the HX711 resolves interference you would never see on a meter.',
  ],

  guide: [
    {
      id: 'meet-the-cell',
      title: 'Meet the load cell',
      body: 'Click the **LOAD CELL** to open its inspector. It is rated **1.0 ± 0.15 mV/V** at **1 kg**, with a bridge of four 1 kΩ gauges.',
      check: { kind: 'inspect', part: 'cell' },
      focus: { part: 'cell' },
      hint: 'The aluminium bar on the left, off the board.',
      explain: 'Loading the free end bends the bar: two gauges stretch and two squeeze. In a full bridge the four small changes add, so V_out = V_exc × ΔR/R.',
    },
    {
      id: 'power',
      title: 'Plug in USB',
      body: 'Press **Plug USB**. **EXCITATION E+** reads about **4.3 V** from the module\'s regulator, and the empty cell already gives about **0.2 mV**: its zero balance.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'power' },
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 3, above: 4.2, below: 4.4, holdMs: 300 },
        ],
      },
      focus: { control: 'power' },
      explain: 'AVDD = 1.25 V × (R1 + R2) / R2 ≈ 4.3 V. It feeds the bridge and also sets the HX711\'s range, so supply changes cancel. 0.05 mV/V of imbalance × 4.3 V ≈ 0.21 mV.',
    },
    {
      id: 'upload',
      title: 'Upload and tare',
      body: 'Keep the pan empty and press **Upload sketch**. The sketch averages 10 readings as its zero: **TARE OFFSET** shows about **107 000** counts, and **MEASURED** then reads about **0 g**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'upload' },
          { kind: 'status', is: 'RUNNING' },
          { kind: 'readout', index: 7, above: 90000, below: 125000 },
        ],
      },
      focus: { control: 'upload' },
      hint: 'The first reading appears about 2 s after the upload.',
      explain: '0.05 mV/V × 128 × 2²⁴ ≈ 107 000 counts of zero balance. tare() stores it as the offset, and get_units() subtracts it before dividing by the calibration factor.',
    },
    {
      id: 'place-500',
      title: 'Put 500 g on the pan',
      body: 'Set **Mass on pan** to **500 g**. **BRIDGE OUTPUT** rises to about **2.3 mV**, but **MEASURED** shows about **490 g**, not 500.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Mass on pan', min: 450, max: 550 },
          { kind: 'readout', index: 2, above: 0.0021, below: 0.00255, holdMs: 300 },
          { kind: 'readout', index: 1, above: 470, below: 510, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Mass on pan' },
      explain: '4.3 V × (0.98 mV/V × 0.5 + 0.05 mV/V) ≈ 2.32 mV. The sketch divides by the nominal 2 147 counts per gram, but this cell gives 0.98 mV/V, so it reads 2 % low. PER GRAM shows the real factor: about 2 104.',
    },
    {
      id: 'calibrate',
      title: 'Calibrate',
      body: 'Note **PER GRAM** (about **2104**). Set the pan to **Empty**, change `calFactor` to that value in the sketch, press **Upload sketch**, then put **500 g** back. **MEASURED** reads **500 g** within 3 g.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'upload' },
          { kind: 'tweak', target: 'Mass on pan', min: 450, max: 550 },
          { kind: 'readout', index: 1, above: 497, below: 503, holdMs: 600 },
        ],
      },
      focus: { control: 'code' },
      hint: 'Upload with the pan empty: the sketch tares at start-up, so a mass on the pan would become the new zero.',
      explain: 'Tare fixes the offset; one known mass fixes the slope. Together they replace the label\'s ±15 % tolerance with your own measurement, good to the accuracy of the calibration mass.',
    },
    {
      id: 'overload',
      title: 'Break it: overload the cell',
      body: 'Set the pan to **Empty**, then open **Break something** and choose **Lean on the pan with 1.4 kg**. After the push, the empty pan reads about **+40 g**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Mass on pan', min: 0, max: 0 },
          { kind: 'break', failure: 'overload' },
          { kind: 'readout', index: 1, above: 20, below: 100, holdMs: 400 },
        ],
      },
      focus: { control: 'break' },
      explain: '1.4 kg is 140 % of capacity, past the 120 % safe overload. The flexure keeps a permanent set, so the gauges stay strained with nothing on the pan. Tare would hide it, but the calibration is no longer trustworthy.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**. That fits a new cell.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: bridge output, counts per gram and ratiometric excitation.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  quiz: [
    {
      q: 'A 2 mV/V load cell is excited at 5.0 V. What is its full-scale output?',
      options: ['2 mV', '5 mV', '10 mV', '25 mV'],
      answer: 2,
      why: '2 mV/V × 5 V = 10 mV.',
    },
    {
      q: 'This bench: E+ and the HX711 reference both on AVDD, a 0.98 mV/V cell at 1 kg, gain 128, 24-bit. About how many counts per gram?',
      options: ['21', '210', '2 100', '21 000'],
      answer: 2,
      why: '0.98 × 10⁻⁶ per gram × 128 × 2²⁴ ≈ 2 104. AVDD cancels because it sets both the bridge output and the range.',
    },
    {
      q: 'On a 1 kΩ full bridge rated 1 mV/V at 1 kg, how much does each gauge\'s resistance change with 200 g on?',
      options: ['0.02 Ω', '0.2 Ω', '1 Ω', '2 Ω'],
      answer: 1,
      why: 'ΔR/R = 0.001 × (200 / 1000) = 0.0002, and 0.0002 × 1000 Ω = 0.2 Ω.',
    },
    {
      q: 'Why should the bridge be excited from the HX711\'s AVDD rather than a separate 5 V rail?',
      options: [
        'AVDD supplies more current',
        'The ADC\'s range is proportional to AVDD, so a ratiometric bridge cancels supply changes',
        '5 V would damage the load cell',
        'The HX711 needs no excitation',
      ],
      answer: 1,
      why: 'The reading is proportional to V_bridge / V_range. If both come from AVDD, its changes cancel.',
    },
  ],
}
