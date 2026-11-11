// T7 · Soldering and Rework. Source: docs/curriculum/T7/soldering-rework.md
//
// A practice "joint tester": four big through-hole joints J1–J4 in series with a 10 Ω load that an
// IRLZ44N pulses at 0.5 A for 20 ms each second, and a green LED whose anode joint J5 sits next to
// its cathode pad (ground). The Uno measures each of J1–J4 as a 4-wire (Kelvin) drop: thin sense
// wires to A0–A3, carrying no current, read on the 1.1 V internal reference (1.07 mV per count).
//
// Every joint is an R element whose value comes from the `solder-joints` behavior: the learner picks
// a joint, sets alloy, tip temperature, dwell, flux and how much solder to feed, and presses
// "Solder this joint" or "Wick this joint". A documented rule (src/engine/behaviors/solder-joints.ts)
// turns technique into quality, and quality into the element: good 1 mΩ, cold 0.6 Ω (and open in
// short spells while the board vibrates), insufficient 10 mΩ, excess 1 mΩ, a bridge on J5 closes
// the SW br5 across the LED, overheated 1 mΩ with a weakened pad, lifted open.
import type { Element, LessonDef } from '../../engine/types'
import { PITCH, jumper } from '../layout'

// ── layout: a 17 × 9 practice PCB. The Uno on the left (rot 0: digital header on its −x edge,
// analog header on +x facing the joints). The load path along the back, the joint row in the
// middle, the LED along the front ──
const UNO_AT: [number, number] = [-4.6, 0.4]
const HY = 0.16 + 0.85
/** Uno digital socket (−x edge) */
const unoD = (pin: number): [number, number, number] => {
  const lx = pin < 8 ? 2.35 + (3.5 - pin) * PITCH : -0.25 + (4.5 - (pin - 8)) * PITCH
  return [UNO_AT[0] - 2.4, HY, UNO_AT[1] - lx]
}
/** Uno analog socket A0..A5 (+x edge) */
const unoA = (i: number): [number, number, number] => [UNO_AT[0] + 2.4, HY, UNO_AT[1] - (1.95 + (i - 2.5) * PITCH)]

const JZ = -0.6 // the joint row
const JX = [0.8, 2.4, 4.0, 5.6] // J1..J4
const JACK: [number, number] = [7.4, -3.3]
const RLOAD: [number, number] = [4.6, -3.3]
const Q1_AT: [number, number] = [1.4, -3.2]
const RG_AT: [number, number] = [-0.4, -2.4]
const RGPD_AT: [number, number] = [-0.4, -3.5]
const LED_AT: [number, number] = [2.6, 2.6]
const RLED_AT: [number, number] = [4.6, 2.6]

/** a sense tap: the back edge of a joint's pad, clear of the fillet */
const tp = (x: number): [number, number, number] => [x, 0.12, JZ - 0.32]
type Wire = ReturnType<typeof jumper>
const wire = (w: Wire, callout?: [number, number, number]) => (callout ? { ...w, params: { ...w.params, callout } } : w)

/**
 * IRLZ44N (TO-220AB, Infineon/IR datasheet): V_DSS 55 V; V_GS(th) 1.0–2.0 V; R_DS(on) 25 mΩ at
 * V_GS = 5 V. vth 1.5 / k 11 as in T7/power-grounding-emc.
 */
const Q1: Element = {
  id: 'q1',
  type: 'NMOS',
  nodes: ['ld', 'g', 'j0'],
  vth: 1.5,
  k: 11,
  rating: { maxI: 47, maxP: 2.4, rth: 62, tauTh: 1.5, tMax: 175 },
  partId: 'q1',
}

const SKETCH = `// Joint ohmmeter: 0.5 A through J1..J4, a 4-wire drop on each
#define LOAD 8
const float I_LOAD_A = 0.5;          // 5 V / 10 ohm, nominal
const float VREF = 1.1;              // internal reference, nominal (1.0-1.2 V spread)
const int TAPS[4] = {A0, A1, A2, A3};

float tapMv(int k) {
  long sum = 0;
  for (int i = 0; i < 8; i++) {
    sum += analogRead(TAPS[k]);
  }
  return sum / 8.0 * VREF / 1023.0 * 1000.0;
}

void setup() {
  pinMode(LOAD, OUTPUT);
  pinMode(5, OUTPUT);
  pinMode(6, OUTPUT);
  digitalWrite(5, LOW);              // pad D5, next to D6 on the header
  digitalWrite(6, HIGH);             // the LED through J5 stays on
  analogReference(INTERNAL);         // 1.1 V full scale: ~1.07 mV per count
  Serial.begin(115200);
  analogRead(A0);                    // first read after a reference change is junk
  delay(10);
}

void loop() {
  float mv[4];
  digitalWrite(LOAD, HIGH);          // 20 ms pulse: 0.5 A through J1..J4
  delay(20);
  for (int k = 0; k < 4; k++) {
    mv[k] = tapMv(k);
  }
  digitalWrite(LOAD, LOW);

  for (int k = 0; k < 4; k++) {
    float drop = mv[k];
    if (k < 3) {
      drop = mv[k] - mv[k + 1];      // joint k+1 sits between tap k and tap k+1
    }
    float mohm = drop / I_LOAD_A;    // mV / A = milliohm
    Serial.print("J");
    Serial.print(k + 1);
    Serial.print("_mohm:");
    Serial.print(mohm);
    if (k < 3) {
      Serial.print(",");
    }
  }
  Serial.println("");
  delay(980);
}
`

const JOINT_FACTS = ['Good THT joint: about 1 mΩ', 'Cold joint: 0.2–1 Ω, and open when it vibrates', 'Carries the 0.5 A load pulse (I²R heat)']

export const lesson: LessonDef = {
  id: 'soldering-rework',
  track: 'T7',
  title: 'Soldering and Rework',
  subtitle: 'Joints you can trust',
  tagline: 'A good through-hole joint is about a milliohm. A cold one at 0.6 Ω drops 0.3 V and makes 0.15 W of heat at 0.5 A, and it may only fail when the board vibrates.',

  board: {
    name: 'JOINT TESTER',
    size: [17, 9],
    base: 'mat',
    traces: [
      // load supply → load resistor → MOSFET drain
      [[JACK[0] - 0.6, JACK[1]], [RLOAD[0] + 1.0, RLOAD[1]]],
      [[RLOAD[0] - 1.0, RLOAD[1]], [Q1_AT[0] + 0.254, -3.3], [Q1_AT[0] + 0.254, Q1_AT[1]]],
      // MOSFET source down to J1, then the joint chain, J4 back to ground (the jack's −)
      [[Q1_AT[0], Q1_AT[1]], [Q1_AT[0], -1.6], [JX[0], -1.6], [JX[0], JZ]],
      [[JX[0], JZ], [JX[1], JZ]],
      [[JX[1], JZ], [JX[2], JZ]],
      [[JX[2], JZ], [JX[3], JZ]],
      [[JX[3], JZ], [7.6, JZ], [7.6, JACK[1] + 0.6]],
      // gate: R_G to the gate pin, pull-down beside it
      [[RG_AT[0] + 0.508, RG_AT[1]], [Q1_AT[0] - 0.254, RG_AT[1]], [Q1_AT[0] - 0.254, Q1_AT[1]]],
      [[RGPD_AT[0] + 0.508, RGPD_AT[1]], [Q1_AT[0] - 0.254, RGPD_AT[1]]],
      // LED: resistor to the anode (+x pad), cathode to ground
      [[RLED_AT[0] - 0.508, RLED_AT[1]], [LED_AT[0] + 0.127, LED_AT[1]]],
      [[LED_AT[0] - 0.127, LED_AT[1]], [LED_AT[0] - 0.127, 3.6], [7.6, 3.6], [7.6, JZ]],
    ],
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], 0, UNO_AT[1]],
        mount: 'module',
        label: 'UNO',
        role: 'Pulses the load from pin 8, reads each joint’s 4-wire drop on A0–A3 against the 1.1 V reference, and keeps the LED on from pin 6.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [-1.2, 1.8, 0.4] },
        circuitIds: ['usb', 'pin8', 'pin6', 'pin5'],
        facts: ['ADC: 10 bits; analogReference(INTERNAL) = 1.1 V nominal (1.0–1.2 V), 1.07 mV per count', 'I/O pin: 40 mA absolute maximum (ATmega328P)'],
      },
      {
        id: 'jack',
        kind: 'barrel-jack',
        pos: [JACK[0], 0, JACK[1]],
        mount: 'offboard',
        label: '5 V LOAD SUPPLY',
        role: 'A separate 5 V, 2 A supply for the 0.5 A load pulses. Its negative is the Uno’s ground.',
        params: { callout: [0.3, 1.4, -0.4] },
        circuitIds: ['psu', 'pwr'],
        facts: ['5 V, 2 A bench supply', 'about 50 mΩ output resistance (modelled)'],
      },
      {
        id: 'r_load',
        kind: 'resistor',
        pos: [RLOAD[0], RLOAD[1]],
        mount: 'tht',
        label: 'LOAD 10 Ω',
        role: 'Sets about 0.5 A through the joint chain. Pulsed for 20 ms a second, so its 2.5 W only averages 50 mW.',
        params: { ohms: 10, callout: [0, 1.1, -0.4] },
        circuitIds: ['r_load'],
        facts: ['10 Ω, 5 W wirewound (cement) resistor', '2.5 W while on at 0.5 A'],
      },
      {
        id: 'q1',
        kind: 'mosfet-to220',
        pos: [Q1_AT[0], Q1_AT[1]],
        mount: 'tht',
        label: 'SWITCH',
        role: 'IRLZ44N logic-level MOSFET: pin 8 turns the load on for 20 ms while the Uno measures.',
        params: { callout: [-0.5, 1.6, -0.3] },
        circuitIds: ['q1'],
        facts: ['IRLZ44N: V_DSS 55 V', 'R_DS(on) 25 mΩ at V_GS = 5 V', 'V_GS(th) 1.0–2.0 V'],
      },
      { id: 'r_g', kind: 'resistor', pos: [RG_AT[0], RG_AT[1]], mount: 'tht', role: '100 Ω gate resistor.', params: { ohms: 100 }, circuitIds: ['r_g'] },
      { id: 'r_gpd', kind: 'resistor', pos: [RGPD_AT[0], RGPD_AT[1]], mount: 'tht', role: '10 kΩ gate pull-down: the load stays off while the Uno boots.', params: { ohms: 10e3 }, circuitIds: ['r_gpd'] },
      ...JX.map((x, k) => ({
        id: `tp${k + 1}`,
        kind: 'testpoint' as const,
        pos: [x, JZ] as [number, number],
        mount: 'tht' as const,
        label: `J${k + 1}`,
        role: `Practice joint J${k + 1}: a big through-hole pad with a wire stub, in series with the load. Its fillet shows the joint’s quality.`,
        params: { jointKey: `solder.j${k + 1}_q`, pad: 0.5, stub: true, callout: [0, 0.9, 0.5] },
        circuitIds: [`j${k + 1}`],
        facts: JOINT_FACTS,
      })),
      {
        id: 'led6',
        kind: 'led',
        pos: [LED_AT[0], 0, LED_AT[1]],
        mount: 'tht',
        label: 'LED · J5',
        role: 'Green LED on pin 6. Its anode joint J5 sits 2.54 mm from its cathode pad: too much solder there bridges the LED out.',
        params: { color: 'green', jointKey: 'solder.j5_q', jointPads: [1], callout: [-0.5, 1.2, 0.5] },
        circuitIds: ['led6', 'j5'],
        facts: ['Green 5 mm LED: about 2.1 V at 8 mA (modelled)', 'J5: fine-pitch pad, 2.54 mm to its neighbour'],
      },
      {
        id: 'r_led',
        kind: 'resistor',
        pos: [RLED_AT[0], RLED_AT[1]],
        mount: 'tht',
        label: '330 Ω',
        role: 'LED resistor: (5 − 2.1) / (330 + 25) ≈ 8 mA with the pin’s own 25 Ω.',
        params: { ohms: 330, callout: [0.3, 1.0, 0.5] },
        circuitIds: ['r_led'],
      },
      // sense and drive wires
      ...[0, 1, 2, 3].map((i) => ({
        id: `w-a${i}`,
        kind: 'wire' as const,
        ...wire(jumper(unoA(i), tp(JX[i]), ['green', 'yellow', 'blue', 'white'][i], 0.5 + i * 0.25), i === 0 ? [0, 0.9, 0] : undefined),
        mount: 'offboard' as const,
        label: i === 0 ? 'SENSE A0–A3' : undefined,
        role: `Sense lead from A${i} to the top of J${i + 1}. It carries almost no current, so its own joints add no error: a 4-wire (Kelvin) measurement.`,
      })),
      {
        id: 'w-8',
        kind: 'wire',
        ...wire(jumper(unoD(8), [RG_AT[0] - 0.508, 0.3, RG_AT[1]], 'orange', 1.4), [0, 1.2, 0]),
        mount: 'offboard',
        label: 'PIN 8',
        role: 'Pin 8 to the MOSFET gate resistor.',
      },
      {
        id: 'w-6',
        kind: 'wire',
        ...wire(jumper(unoD(6), [RLED_AT[0] + 0.508, 0.3, RLED_AT[1]], 'red', 1.6), [0, 1.3, 0.3]),
        mount: 'offboard',
        label: 'PIN 6',
        role: 'Pin 6 to the LED resistor.',
      },
    ],
  },

  circuit: {
    elements: [
      // the Uno on USB; its pins drive the gate and the LED
      { id: 'usb', type: 'V', nodes: ['5v', '0'], value: 5, rInternal: 0.1, partId: 'uno' },
      { id: 'pin8', type: 'PIN', nodes: ['d8', '0'], pin: 8, vcc: 5, rOut: 25, rating: { maxI: 0.04 }, partId: 'uno' },
      { id: 'pin6', type: 'PIN', nodes: ['d6', '0'], pin: 6, vcc: 5, rOut: 25, rating: { maxI: 0.04 }, partId: 'uno' },
      { id: 'pin5', type: 'PIN', nodes: ['d5', '0'], pin: 5, vcc: 5, rOut: 25, rating: { maxI: 0.04 }, partId: 'uno' },
      // the load path: supply → switch → 10 Ω → MOSFET → J1..J4 → ground
      { id: 'psu', type: 'V', nodes: ['p5', '0'], value: 5, rInternal: 0.05, partId: 'jack' },
      { id: 'pwr', type: 'SW', nodes: ['p5', 'v5l'], closed: true, partId: 'jack' },
      { id: 'r_load', type: 'R', nodes: ['v5l', 'ld'], value: 10, rating: { maxP: 5 }, partId: 'r_load' },
      Q1,
      { id: 'r_g', type: 'R', nodes: ['d8', 'g'], value: 100, partId: 'r_g' },
      { id: 'r_gpd', type: 'R', nodes: ['g', '0'], value: 10e3, partId: 'r_gpd' },
      // the joints: values set by the solder-joints behavior every frame
      { id: 'j1', type: 'R', nodes: ['j0', 'n1'], value: 0.001, rating: { maxP: 0.5 }, partId: 'tp1' },
      { id: 'j2', type: 'R', nodes: ['n1', 'n2'], value: 0.001, rating: { maxP: 0.5 }, partId: 'tp2' },
      { id: 'j3', type: 'R', nodes: ['n2', 'n3'], value: 0.001, rating: { maxP: 0.5 }, partId: 'tp3' },
      { id: 'j4', type: 'R', nodes: ['n3', '0'], value: 0.001, rating: { maxP: 0.5 }, partId: 'tp4' },
      // the LED: pin 6 → 330 Ω → J5 → LED → ground; br5 is a solder bridge from J5's pad to the cathode pad
      { id: 'r_led', type: 'R', nodes: ['d6', 'l5'], value: 330, partId: 'r_led' },
      { id: 'j5', type: 'R', nodes: ['l5', 'l6'], value: 0.001, partId: 'led6' },
      { id: 'led6', type: 'LED', nodes: ['l6', '0'], color: 'green', rating: { maxI: 0.03 }, partId: 'led6' },
      { id: 'br5', type: 'SW', nodes: ['l6', '0'], closed: false, partId: 'led6' },
    ],
  },
  powerElementId: 'usb',
  powerLabel: 'Plug USB',
  extraPower: [{ elementId: 'pwr', label: 'Switch on 5 V load' }],

  readouts: [
    { label: 'J1 (MEASURED)', source: { kind: 'behavior', key: 'serial.J1_mohm' }, unit: 'mΩ' },
    { label: 'J2 (MEASURED)', source: { kind: 'behavior', key: 'serial.J2_mohm' }, unit: 'mΩ' },
    { label: 'J3 (MEASURED)', source: { kind: 'behavior', key: 'serial.J3_mohm' }, unit: 'mΩ' },
    { label: 'J4 (MEASURED)', source: { kind: 'behavior', key: 'serial.J4_mohm' }, unit: 'mΩ' },
    { label: 'LOAD CURRENT (20 ms PULSES)', source: { kind: 'current', elementId: 'r_load' }, unit: 'A' },
    { label: 'LED CURRENT', source: { kind: 'current', elementId: 'led6' }, unit: 'A' },
    { label: 'SELECTED JOINT (TRUE)', source: { kind: 'behavior', key: 'solder.sel_ohm' }, unit: 'Ω' },
    { label: 'SELECTED JOINT GRADE', source: { kind: 'behavior', key: 'solder.sel_q' }, unit: '', digits: 1 },
    { label: 'CONTACT BREAKS', source: { kind: 'behavior', key: 'solder.breaks' }, unit: '' },
    { label: 'WORST JOINT I²R AT 0.5 A', source: { kind: 'behavior', key: 'solder.joint_W' }, unit: 'W', warnAbove: 0.05 },
  ],

  sketch: {
    title: 'Joint ohmmeter',
    code: SKETCH,
    pins: { 8: 'pin8', 6: 'pin6', 5: 'pin5' },
    analogPins: { A0: 'j0', A1: 'n1', A2: 'n2', A3: 'n3' },
    vcc: 5,
    board: 'uno',
  },

  behaviors: [
    {
      id: 'solder-joints',
      instance: 'solder',
      params: {
        joints: 'j1,j2,j3,j4,j5',
        fine: 'j5',
        bridgeSw: 'br5',
        target: 1,
        alloy: 0,
        tipC: 350,
        dwellS: 3,
        flux: 1,
        feed: 1,
        go: 0,
        wick: 0,
        vibration: 0,
        esd: 0,
        esdPin: 'pin6',
      },
    },
    { id: 'serial-plotter', instance: 'serial' },
  ],

  tweaks: [
    {
      label: 'Joint',
      elementId: 'behavior:solder',
      key: 'target',
      kind: 'enum',
      min: 1,
      max: 5,
      unit: '',
      options: [
        { label: 'J1', value: 1 },
        { label: 'J2', value: 2 },
        { label: 'J3', value: 3 },
        { label: 'J4', value: 4 },
        { label: 'J5 (LED)', value: 5 },
      ],
    },
    {
      label: 'Solder alloy',
      elementId: 'behavior:solder',
      key: 'alloy',
      kind: 'enum',
      min: 0,
      max: 1,
      unit: '',
      options: [
        { label: 'Sn63/Pb37 (183 °C)', value: 0 },
        { label: 'SAC305 (217–220 °C)', value: 1 },
      ],
    },
    { label: 'Iron tip temperature', elementId: 'behavior:solder', key: 'tipC', min: 250, max: 450, step: 5, unit: '°C' },
    { label: 'Dwell time', elementId: 'behavior:solder', key: 'dwellS', min: 0.5, max: 8, step: 0.5, unit: 's' },
    { label: 'Flux', elementId: 'behavior:solder', key: 'flux', kind: 'toggle', min: 0, max: 1, unit: '' },
    {
      label: 'Solder fed',
      elementId: 'behavior:solder',
      key: 'feed',
      kind: 'enum',
      min: 0,
      max: 2,
      unit: '',
      options: [
        { label: 'Too little', value: 0 },
        { label: 'Right', value: 1 },
        { label: 'Too much', value: 2 },
      ],
    },
    { label: 'Solder this joint', elementId: 'behavior:solder', key: 'go', kind: 'momentary', min: 0, max: 1, unit: '' },
    { label: 'Wick this joint', elementId: 'behavior:solder', key: 'wick', kind: 'momentary', min: 0, max: 1, unit: '' },
    { label: 'Vibration (tap the board)', elementId: 'behavior:solder', key: 'vibration', min: 0, max: 1, step: 0.05, unit: '' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: 20 ms load pulses, four 4-wire joint readings a second. Grade 0: the selected joint is good.' },
    { when: { kind: 'above', readout: 7, value: 0.5 }, text: 'Selected joint is COLD (grade 1): grainy and convex, about 0.6 Ω. Reflow it hotter, longer or with flux.' },
    { when: { kind: 'above', readout: 7, value: 1.5 }, text: 'Selected joint is INSUFFICIENT (grade 2): a thin fillet, about 10 mΩ. Feed more solder.' },
    { when: { kind: 'above', readout: 7, value: 2.5 }, text: 'Selected joint has EXCESS solder (grade 3): a ball that hides whether it wetted. Wick some off.' },
    { when: { kind: 'above', readout: 7, value: 3.5 }, text: 'Selected joint is BRIDGED (grade 4) to its neighbour pad: wick it, then reflow with less solder.' },
    { when: { kind: 'above', readout: 7, value: 4.5 }, text: 'Selected joint is OVERHEATED (grade 5): charred flux and a weakened pad. One more overheat lifts it.' },
    { when: { kind: 'above', readout: 7, value: 5.5 }, text: 'Selected joint has a LIFTED PAD (grade 6): the circuit is open. Only a jumper wire (Repair all) fixes it.' },
  ],

  failures: [
    {
      id: 'cold-j2',
      label: 'Cold joint on J2',
      explain:
        'J2 now reads about 560 mΩ: 0.6 Ω carrying about 0.47 A drops 0.28 V, 261 counts on the 1.1 V reference (the sketch divides by the nominal 0.5 A, so it reads a little low). Raise the vibration and its contact opens in short bursts, and the load current drops out with it. The solder melted but never wetted the pad or lead (too cool, too little flux, an oxidised surface, or it moved while freezing): electrically it is a contact, not a bond. Select J2 and reflow it with flux at the right temperature for 2–4 s.',
      patches: [{ op: 'set', elementId: 'behavior:solder', key: 'j2', value: 'cold' }],
    },
    {
      id: 'bridge-pins',
      label: 'Solder bridge between header pads D5 and D6',
      explain:
        'D6 is driven HIGH and D5 LOW, so through the bridge the two pins fight through their own 25 Ω each: 5 / 50 = 100 mA, over the ATmega328P’s 40 mA absolute maximum on both pins, and they fail. A bridge joins two nets the design keeps apart; between two outputs it shorts one to the other. Remove it with flux and braid, and inspect fine-pitch work under magnification before power-up.',
      patches: [{ op: 'short', a: 'd6', b: 'd5' }],
    },
    {
      id: 'lifted-j3',
      label: 'Lifted pad on J3 (overheated during rework)',
      explain:
        'The load current falls to 0: the copper pad has torn off the FR-4, so the circuit is open. Tap A2 rises to the full reference and the sketch’s J3 reading jumps to an impossible value. Too much heat, too long, or levering with the iron delaminates a pad. Repair it with a jumper wire from the lead to the next point on the trace, glued down (here: Repair all).',
      patches: [{ op: 'set', elementId: 'behavior:solder', key: 'j3', value: 'lifted' }],
    },
    {
      id: 'esd-zap',
      label: 'Touch pin 6 without a wrist strap',
      explain:
        'A person walking on a dry floor can charge to several kilovolts and only feels a discharge above roughly 3 kV. Many ICs are qualified to survive about 2 kV in the human-body model (100 pF through 1.5 kΩ), so a zap you never feel can punch through a pin’s input protection. Pin 6 is dead, and the LED with it. Wear a wrist strap (it grounds you through 1 MΩ), use an ESD-safe iron with a grounded tip, and work on a dissipative mat.',
      patches: [{ op: 'set', elementId: 'behavior:solder', key: 'esd', value: 1 }],
    },
  ],

  guide: [
    {
      id: 'build-run',
      title: 'Power it and measure the joints',
      body: 'Press **Plug USB**, **Switch on 5 V load** and **Upload** (on a stripped board, place the parts and press **Solder** first). The bench’s own joints are textbook: **J2 (MEASURED)** reads under **5 mΩ** (0.5 A × 1 mΩ is only 0.5 mV, under one 1.07 mV count).',
      check: { kind: 'all', of: [{ kind: 'action', action: 'upload' }, { kind: 'status', is: 'RUNNING' }, { kind: 'readout', index: 1, below: 5, holdMs: 300 }] },
      focus: { control: 'upload' },
      hint: 'The first reading arrives about a second after the upload. The load switch is the second power button.',
      explain: 'A milliohm joint is invisible to the 5 V reference (4.9 mV per count), so the sketch switches to the 1.1 V internal reference and puts 0.5 A through the joints. The sense leads carry no current, so only the joint sits between two taps: a 4-wire measurement.',
    },
    {
      id: 'cold',
      title: 'Make a cold joint on J2',
      body: 'Set **Joint** to **J2** and **Iron tip temperature** to **280 °C** (Sn63/Pb37 wants about 330–370 °C), then press **Solder this joint**. **J2 (MEASURED)** jumps to about **560 mΩ**.',
      check: { kind: 'all', of: [{ kind: 'tweak', target: 'Joint', min: 2, max: 2 }, { kind: 'readout', index: 1, above: 400, below: 700, holdMs: 300 }] },
      focus: { control: 'tweak:Iron tip temperature' },
      hint: 'The reading updates once a second, on the next load pulse.',
      explain: 'At 280 °C the tip can’t lift the pad and lead to wetting temperature in 3 s: the solder melts on the tip and sits on the joint as a lump. The model makes it 0.6 Ω: 0.47 A × 0.6 Ω = 0.28 V, and the sketch divides by its nominal 0.5 A, so it reports about 560 mΩ. At 0.5 A that joint makes 0.15 W of heat.',
    },
    {
      id: 'tap',
      title: 'Tap the board',
      body: 'Raise **Vibration (tap the board)** to about **0.5**. The cold joint opens in bursts: **CONTACT BREAKS** climbs past **3**, and the load pulses drop out with it.',
      check: { kind: 'all', of: [{ kind: 'tweak', target: 'Vibration (tap the board)', min: 0.3 }, { kind: 'readout', index: 8, above: 3 }] },
      focus: { control: 'tweak:Vibration (tap the board)' },
      hint: 'Give it a few seconds: the breaks are random.',
      explain: 'A cold or cracked joint is a pressure contact. At rest it can measure fine; flexed, heated or shaken it opens for milliseconds. That is the fault that “goes away when you look at it”, and why a joint is judged by its shape, not only by a continuity beep.',
    },
    {
      id: 'reflow',
      title: 'Reflow J2 properly',
      body: 'Set **Vibration** back to **0**, the tip to **340 °C**, **Dwell time** **3 s**, **Flux** on, then press **Solder this joint** again. **J2 (MEASURED)** falls back under **5 mΩ** and **SELECTED JOINT GRADE** reads **0**.',
      check: {
        kind: 'all',
        of: [{ kind: 'tweak', target: 'Vibration (tap the board)', max: 0 }, { kind: 'readout', index: 7, below: 0.5 }, { kind: 'readout', index: 1, below: 5, holdMs: 300 }],
      },
      focus: { control: 'tweak:Solder this joint' },
      hint: 'Fresh flux matters on a rework: old solder has already lost its flux.',
      explain: 'The order of a good joint: tip on pad and lead together, feed solder into the joint (not onto the tip), let it flow and wet, take the solder away, then the iron. 2–5 s on a through-hole joint lifts both to temperature without cooking the pad.',
    },
    {
      id: 'bridge',
      title: 'Bridge the LED',
      body: 'Set **Joint** to **J5 (LED)** and **Solder fed** to **Too much**, then press **Solder this joint**. The excess runs onto the cathode pad 2.54 mm away: **LED CURRENT** drops from about **8 mA** to **0**.',
      check: { kind: 'all', of: [{ kind: 'readout', index: 7, above: 3.5, below: 4.5 }, { kind: 'readout', index: 5, below: 0.0005, holdMs: 300 }] },
      focus: { control: 'tweak:Solder fed' },
      hint: 'J5 is the LED’s anode joint, at the front of the board.',
      explain: 'A bridge is a short between two nets. Here it shorts the LED, so all of pin 6’s current goes round it: (5 V) / (330 + 25) Ω ≈ 14 mA through the bridge and none through the LED. On a big lone pad the same excess just balls up; next to a neighbour it bridges.',
    },
    {
      id: 'wick',
      title: 'Wick it and redo it',
      body: 'Press **Wick this joint** (the braid takes the solder off and the bridge with it), set **Solder fed** to **Right** and press **Solder this joint**. **LED CURRENT** is back near **8 mA**.',
      check: { kind: 'all', of: [{ kind: 'readout', index: 7, below: 0.5 }, { kind: 'readout', index: 5, above: 0.0065, below: 0.0095, holdMs: 300 }] },
      focus: { control: 'tweak:Wick this joint' },
      hint: 'Wick first, then solder: after the wick the joint is only a thin film (grade 2).',
      explain: 'Desoldering braid is fluxed copper weave: pressed onto the joint under the tip, it pulls molten solder in by capillary action. A spring pump does the same by suction, best on through-holes. Either way, add flux and finish with a fresh joint.',
    },
    {
      id: 'lift',
      title: 'Cook a pad',
      body: 'Set **Joint** to **J3**, the tip to **450 °C**, and press **Solder this joint** twice. The first pass overheats it (grade 5); the second lifts the pad (grade 6) and **LOAD CURRENT** stops for good.',
      check: { kind: 'all', of: [{ kind: 'tweak', target: 'Joint', min: 3, max: 3 }, { kind: 'readout', index: 7, above: 5.5 }] },
      focus: { control: 'tweak:Iron tip temperature' },
      hint: 'Two presses: each one is a full heat cycle on the joint.',
      explain: '450 °C is well above the 330–370 °C window for Sn63/Pb37. Heat softens the adhesive that holds the copper to the FR-4, and a lifted pad is an open circuit that no amount of solder can fix.',
    },
    {
      id: 'repair',
      title: 'Jumper the lifted pad',
      body: 'Open **Break something** and choose **Repair all**: on a real board, a jumper wire from the lead to the next point on the trace, glued down. **J3 (MEASURED)** reads under **5 mΩ** again.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'repair' }, { kind: 'readout', index: 2, below: 5, holdMs: 300 }] },
      focus: { control: 'break' },
      hint: 'Repair all is at the bottom of the Break menu.',
      explain: 'Prevention beats repair: the right tip for the pad’s thermal mass, the right temperature, flux, and never levering with the iron.',
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: Ohm’s law on a joint, the ADC count, the melting points and what a good joint looks like.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  meet: `A solder joint is a **metallurgical bond**: molten solder dissolves a thin skin of the copper and forms an intermetallic layer. That only happens when the pad *and* the lead reach the solder’s melting point and **flux** keeps both oxide-free.

**Alloys.** **Sn63/Pb37** is eutectic: it melts and freezes at one temperature, **183 °C**. Lead-free **SAC305** (Sn96.5 Ag3.0 Cu0.5) melts over about **217–220 °C** and wets more slowly. Typical tip setpoints: **330–370 °C** for leaded, **350–400 °C** for lead-free. The tip runs well above the melting point because heat has to flow from it into the joint quickly.

**Tip choice.** Match the tip to the joint’s thermal mass: a chisel tip for most through-hole and drag work, a fine conical tip only for small pads. A pad on a ground plane needs a bigger tip, not a hotter one. Keep it tinned, and wipe it on brass wool.

**The order of a good joint:** tip on pad and lead together (a little solder on the tip makes the heat path), feed solder into the joint on the far side, let it flow and wet, remove the solder, then remove the iron, and don’t move it while it freezes. About **2–5 s** for a through-hole joint.

**Defects.**
- **Cold or disturbed:** grainy, lumpy, convex, not wetted. Too cool, too short, no flux, or moved while freezing.
- **Insufficient:** a thin fillet, the hole visible.
- **Excess:** a ball that hides whether it wetted.
- **Bridge:** solder joins two pads.
- **Lifted pad:** the copper has torn off the board, from too much heat or levering.
- **Tombstone (SMD):** a chip resistor or capacitor standing up on one end, because one pad melted and wetted before the other.

**Through-hole vs SMD.** THT joints are heated with the iron one at a time. SMD chips can be tacked on one pad and then soldered on the other. Fine-pitch ICs are **drag soldered**: flux the row, load the tip with solder and drag it along the pins, and surface tension pulls the solder into each joint. **Hot air** heats a whole part at once, so all its pads melt together, and **preheating** the board from below (about 100–150 °C) keeps a big copper plane from sinking the heat.

**Desoldering.** Braid (fluxed copper weave) wicks solder off by capillary action; a spring pump sucks it out of a through-hole. Add flux first.

**ESD.** You can charge to several kilovolts and only feel a discharge above roughly 3 kV. Wear a wrist strap (it grounds you through 1 MΩ), use an ESD-safe iron with a grounded tip, and unplug the board before rework. (In the sim the Uno stays on so its meter keeps reading.)

**Inspection.** Look at every joint under magnification: a smooth concave fillet that feathers onto the pad and up the lead, with the lead’s outline visible. Check adjacent pins for bridges before power-up. **IPC-A-610** defines acceptable joints for Class 1 (general), 2 (dedicated service) and 3 (high reliability): pick a class and inspect to it.

**Measuring it.** 0.5 A through a good 1 mΩ joint drops 0.5 mV, under the Uno’s 4.9 mV count on the 5 V reference. On the **1.1 V internal reference**, one count is 1.1 / 1023 = **1.07 mV**, and a cold 0.6 Ω joint drops about 0.28 V, **261 counts**. The sense leads carry almost no current, so their own joints add no error: that is the idea of a 4-wire (Kelvin) measurement.

**The rule in this bench** (a lookup, not a thermal model): within the setpoint window ±20 °C, 2–5 s, with flux and the right amount of solder: good. Cooler, shorter or no flux: cold. Hotter or longer: overheated, and a second overheat lifts the pad. Too little solder: insufficient; too much: excess, or a bridge on J5.`,

  mechanicalAnalogy: `Soldering is brazing at a lower temperature: a filler metal that melts well below the base metals, wets both and is drawn into the gap by capillary action. Welding melts the base metal itself; soldering and brazing never do. Flux does the same job in both: it strips the oxide so the filler can wet. And the heat path is the same problem: braze a thin tube to a heavy block and you heat the block, because the filler only flows onto metal that is already at temperature. A ground plane is the heavy block.

**Where it breaks:** a braze is judged mostly on strength. A solder joint is judged on electrical continuity too, and it can hold mechanically while being electrically intermittent, invisible until the board vibrates. A cracked joint is a fatigue crack from thermal cycling or vibration, the same failure you’d expect in a rigidly mounted part.`,

  proTips: [
    'Add flux when reworking, even with flux-cored wire: old solder has already lost its flux, and most “it won’t flow” problems are oxide, not temperature.',
    'Heat the joint, not the solder: tip on pad and lead together, feed the solder into the joint, take the solder away before the iron. Count 2–5 seconds.',
    'Before power-up, run a continuity check between adjacent nets on fine-pitch work. A bridge found with a meter costs nothing; one found with power on can cost an IC.',
  ],

  quiz: [
    {
      q: '0.5 A flows through a 0.6 Ω cold joint. What are the voltage drop and the power dissipated?',
      options: ['0.03 V and 15 mW', '0.3 V and 0.15 W', '0.6 V and 0.3 W', '3 V and 1.5 W'],
      answer: 1,
      why: 'V = 0.5 × 0.6 = 0.3 V, and P = 0.5² × 0.6 = 0.15 W.',
    },
    {
      q: 'With analogReference(INTERNAL) (1.1 V), about what count does a 0.3 V drop produce?',
      options: ['61', '140', '279', '1023'],
      answer: 2,
      why: '0.3 / 1.1 × 1023 ≈ 279.',
    },
    {
      q: 'At about what temperature does SAC305 lead-free solder melt?',
      options: ['120 °C', '183 °C', '217–220 °C', '350 °C'],
      answer: 2,
      why: 'SAC305 (Sn96.5/Ag3.0/Cu0.5) melts over about 217–220 °C. 183 °C is the tin-lead eutectic, and 350 °C is a typical tip setting.',
    },
    {
      q: 'Which describes a good through-hole joint?',
      options: ['A shiny ball sitting on the pad', 'A concave fillet wetting both pad and lead, with the lead outline visible', 'A grainy grey surface', 'Solder covering the neighbouring pad too'],
      answer: 1,
      why: 'Wetting shows as a low contact angle and a concave fillet. A ball means poor wetting, grainy grey means cold, and solder on the neighbour is a bridge.',
    },
    {
      q: 'A big pad on a ground plane won’t flow at 350 °C. What is the best first fix?',
      options: ['Turn the iron up to 450 °C', 'Use a bigger tip, add flux, and preheat the board', 'Hold the iron for 20 s', 'Use more solder'],
      answer: 1,
      why: 'The plane is a heat sink: the problem is heat flow, not setpoint. A bigger tip and preheat deliver more heat without cooking the pad; flux lets it wet.',
    },
  ],
}
