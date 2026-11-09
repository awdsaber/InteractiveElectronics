// T5 · A4988 Stepper Driver (video Fig. 07). Source: docs/curriculum/T5/a4988-stepper.md
//
// Each coil is a behavior-controlled I source (the chopper's regulated current) in series with the
// winding's R and L. The `a4988` behavior is the chopper, the microstep translator and the NEMA 17
// rotor: it takes the sketch's STEP/DIR/ENABLE edges at µs resolution (Behavior.onPin), reads
// MS1–MS3 and Vref as voltages, and publishes the shaft angle the 3D motor follows.
import type { Element, LessonDef } from '../../engine/types'
import { PITCH, jumper } from '../layout'

// ── bench layout (one 15 × 9 stepper bench PCB; everything stands on it, y = 0) ──
const UNO_AT: [number, number] = [4.4, 0.4] // rot 90: digital header toward the viewer, USB to the right
const HDR: [number, number] = [-0.3, 1.9] // the carrier's 2 × 8 pins, rot 90: pins run along z
const MOT: [number, number] = [-5.8, -1.7] // NEMA 17 in the back-left corner, connector toward the viewer
const JACK: [number, number] = [-6.3, 3.5]

const UNO_HEADER_Y = 0.16 + 0.85
const HDR_TOP = 0.85

/** Uno digital socket (rot 90: the header runs along the front edge) */
function unoDigital(pin: number): [number, number, number] {
  const lx = pin < 8 ? 2.35 + (3.5 - pin) * PITCH : -0.25 + (4.5 - (pin - 8)) * PITCH
  return [UNO_AT[0] - lx, UNO_HEADER_Y, UNO_AT[1] + 2.4]
}
/** Uno power socket (NC, IOREF, RST, 3V3, 5V, GND, GND, VIN) on the back edge */
function unoPower(k: number): [number, number, number] {
  return [UNO_AT[0] - (-0.35 + (k - 3.5) * PITCH), UNO_HEADER_Y, UNO_AT[1] - 2.4]
}
/**
 * carrier pin (Pololu order). Row 1, toward the Uno: EN MS1 MS2 MS3 RST SLP STEP DIR.
 * Row 0, toward the motor: VMOT GND 2B 2A 1A 1B VDD GND.
 */
function hdrPin(row: 0 | 1, i: number): [number, number, number] {
  return [HDR[0] + (row ? 0.127 : -0.127), HDR_TOP, HDR[1] - (i - 3.5) * PITCH]
}
/** the motor's 4-pin connector on its front face (part-local (x, 0.3, 2.27)) */
const motPin = (k: number): [number, number, number] => [MOT[0] + (k - 1.5) * 0.24, 0.3, MOT[1] + 2.27]
const JACK_P: [number, number, number] = [JACK[0] + 0.6, 0.3, JACK[1] - 0.45]
const JACK_N: [number, number, number] = [JACK[0] + 0.3, 0.3, JACK[1] - 0.45]

type Wire = ReturnType<typeof jumper>
const wire = (w: Wire, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const pin = (n: number): Element => ({ id: `pin${n}`, type: 'PIN', nodes: [`d${n}`, '0'], pin: n, vcc: 5, partId: 'uno' })

const sketch = `#define STEP_PIN 3
#define DIR_PIN  4
#define EN_PIN   8
#define MS1_PIN  9
#define MS2_PIN  10
#define MS3_PIN  11

const long FULL_STEPS_PER_REV = 200;    // 1.8 degrees per full step
int microsteps = 16;

void setMicrostep(int m) {
  int a = LOW;
  int b = LOW;
  int c = LOW;
  if (m == 2)  { a = HIGH; }
  if (m == 4)  { b = HIGH; }
  if (m == 8)  { a = HIGH; b = HIGH; }
  if (m == 16) { a = HIGH; b = HIGH; c = HIGH; }
  digitalWrite(MS1_PIN, a);
  digitalWrite(MS2_PIN, b);
  digitalWrite(MS3_PIN, c);
  microsteps = m;
}

// Step period in microseconds for a given speed.
long periodUs(float rpm) {
  float stepsPerSec = rpm / 60.0 * FULL_STEPS_PER_REV * microsteps;
  return 1000000.0 / stepsPerSec;
}

// Move n microsteps, ramping linearly from startRpm up to topRpm and back down.
void move(long n, float startRpm, float topRpm) {
  long rampSteps = n / 4;
  for (long i = 0; i < n; i++) {
    float rpm = topRpm;
    if (i < rampSteps) {
      rpm = startRpm + (topRpm - startRpm) * i / rampSteps;
    } else if (i > n - rampSteps) {
      rpm = startRpm + (topRpm - startRpm) * (n - i) / rampSteps;
    }
    long p = periodUs(rpm);
    digitalWrite(STEP_PIN, HIGH);
    delayMicroseconds(2);              // >= 1 us high (datasheet)
    digitalWrite(STEP_PIN, LOW);
    delayMicroseconds(p - 2);
  }
}

void setup() {
  pinMode(STEP_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);
  pinMode(EN_PIN, OUTPUT);
  pinMode(MS1_PIN, OUTPUT);
  pinMode(MS2_PIN, OUTPUT);
  pinMode(MS3_PIN, OUTPUT);
  Serial.begin(115200);
  setMicrostep(16);
  digitalWrite(EN_PIN, LOW);           // LOW = outputs enabled
  Serial.println("A4988 ready: 1/16 step, 3200 steps per rev");
}

void loop() {
  long oneRev = FULL_STEPS_PER_REV * microsteps;

  digitalWrite(DIR_PIN, HIGH);
  delayMicroseconds(5);                // DIR setup before the first STEP
  Serial.println("CW one turn, 20 -> 120 rpm");
  move(oneRev, 20, 120);
  delay(500);

  digitalWrite(DIR_PIN, LOW);
  delayMicroseconds(5);
  Serial.println("CCW one turn, 20 -> 60 rpm");
  move(oneRev, 20, 60);
  delay(500);

  Serial.println("Holding torque for 2 s, then free");
  delay(2000);
  digitalWrite(EN_PIN, HIGH);          // outputs off: shaft turns by hand, coils cool
  delay(2000);
  digitalWrite(EN_PIN, LOW);
}
`

export const lesson: LessonDef = {
  id: 'a4988-stepper',
  fig: 7,
  track: 'T5',
  title: 'A4988 Stepper Driver',
  subtitle: 'Current, not voltage',
  tagline: 'A 1.5 Ω NEMA 17 coil on 12 V would draw 8 A, so the A4988 chops the current down to whatever Vref sets: 0.544 V on Vref gives 1.0 A.',

  board: {
    name: 'STEPPER BENCH',
    size: [17, 12],
    base: 'mat',
    traces: [
      // carrier area: header to the IC, decorative
      [[HDR[0] - 0.127, HDR[1] + 0.889], [-1.2, HDR[1] + 0.889], [-1.45, HDR[1] + 0.3]],
      [[HDR[0] - 0.127, HDR[1] + 0.127], [-1.45, HDR[1] + 0.127]],
      [[HDR[0] - 0.127, HDR[1] - 0.127], [-1.45, HDR[1] - 0.127]],
      [[-1.6, HDR[1] - 0.4], [-1.6, HDR[1] - 0.75]],
      [[-1.6, HDR[1] + 0.4], [-1.6, HDR[1] + 0.75]],
    ],
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], 0, UNO_AT[1]],
        rot: 90,
        mount: 'module',
        label: 'UNO',
        role: 'Generates STEP/DIR and sets the microstep pins: 3 is STEP, 4 is DIR, 8 is ENABLE, 9–11 are MS1–MS3. On USB, always on.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [1.5, 1.6, 0.6] },
        circuitIds: ['pin3', 'pin4', 'pin8', 'pin9', 'pin10', 'pin11', 'v_logic'],
      },
      {
        id: 'drv',
        kind: 'logic-ic-label',
        pos: [-1.6, 0, HDR[1] + 1.45],
        mount: 'smd',
        label: 'A4988 CARRIER',
        role: '16-pin breakout of the driver (15 × 20 mm Pololu format): the IC, two sense resistors, the Vref trimmer and the pin header.',
        params: { text: 'A4988 CARRIER', size: 0.2, callout: [0.2, 0.5, 1.0] },
      },
      {
        id: 'u1',
        kind: 'ic-smd',
        pos: [-1.6, 0, HDR[1]],
        mount: 'smd',
        label: 'A4988',
        role: 'Two full bridges, each with a fixed off-time current chopper, plus the microstep translator (Allegro A4988, QFN-28 5 × 5 mm).',
        params: { package: 'QFN', pins: 28, marking: 'A4988', callout: [0.9, 1.3, 1.9] },
        circuitIds: ['ia', 'ib', 'i_vmot'],
      },
      {
        id: 'rs1',
        kind: 'resistor-smd',
        pos: [-1.6, 0, HDR[1] - 0.85],
        mount: 'smd',
        label: 'R_SENSE',
        role: 'Current sense for coil A: 0.068 Ω on current Pololu boards, often 0.1 Ω ("R100") on clones. The chopper compares its voltage with Vref/8.',
        params: { size: '1206', marking: 'R068', callout: [1.0, 2.2, -1.8] },
      },
      {
        id: 'rs2',
        kind: 'resistor-smd',
        pos: [-1.6, 0, HDR[1] + 0.85],
        mount: 'smd',
        role: 'Current sense for coil B (same value as coil A\'s).',
        params: { size: '1206', marking: 'R068' },
      },
      {
        id: 'pot',
        kind: 'potentiometer',
        pos: [-2.85, 0, HDR[1] - 0.4],
        mount: 'smd',
        label: 'VREF POT',
        role: 'Sets Vref, and so the coil current limit: I_trip = Vref / (8 × R_sense).',
        params: { callout: [-2.2, 1.6, -0.8] },
        circuitIds: ['pot'],
      },
      {
        id: 'tp_vref',
        kind: 'testpoint',
        pos: [-2.85, 0, HDR[1] + 0.75],
        mount: 'smd',
        label: 'VREF',
        role: 'Meter point: measure Vref from here (the wiper) to GND.',
        params: { color: 'yellow', callout: [-2.0, 1.0, 0.6] },
      },
      {
        id: 'hdr',
        kind: 'header-male',
        pos: [HDR[0], 0, HDR[1]],
        rot: 90,
        mount: 'tht',
        label: 'PINS',
        role: 'EN, MS1–3, RST, SLP, STEP, DIR on the logic side; VMOT, GND, 2B, 2A, 1A, 1B, VDD, GND on the power side.',
        params: { pins: 8, rows: 2, callout: [2.4, 1.0, -0.4] },
      },
      {
        id: 'c_bulk',
        kind: 'capacitor-electrolytic',
        pos: [-2.0, 0, HDR[1] + 2.4],
        mount: 'offboard',
        label: 'VMOT CAP',
        role: 'Required: 100 µF 35 V right at VMOT soaks up the LC spikes from the supply leads.',
        params: { d: 0.63, h: 1.1, callout: [-1.0, 0.6, 0.8] },
        circuitIds: ['c_bulk'],
      },
      {
        id: 'psu',
        kind: 'barrel-jack',
        pos: [JACK[0], 0, JACK[1]],
        mount: 'offboard',
        label: '12 V IN',
        role: 'Motor supply from a 12 V 2 A adapter. The A4988 takes 8–35 V on VMOT.',
        params: { callout: [0.4, 1.4, 0.4] },
        circuitIds: ['psu', 'pwr'],
      },
      {
        id: 'mot',
        kind: 'stepper-nema17',
        pos: [MOT[0], 0, MOT[1]],
        mount: 'offboard',
        label: 'NEMA 17',
        role: 'Bipolar stepper, 1.8° per full step (200 per turn). 17HS4401 class: 1.7 A, 1.5 Ω, ~2.8 mH per phase (representative).',
        params: { marking: '17HS4401', angleKey: 'a4988.shaft_deg', rpmKey: 'a4988.rpm', callout: [-2.6, -1.5, 1.6] },
        circuitIds: ['rca', 'lca', 'rcb', 'lcb'],
      },
      // logic wires
      { id: 'w_en', kind: 'wire', ...wire(jumper(unoDigital(8), hdrPin(1, 0), 'white', 0.9), [0.4, 0.7, 0.3]), mount: 'offboard', role: 'Pin 8 to ENABLE (active LOW).' },
      { id: 'wire_ms1', kind: 'wire', ...wire(jumper(unoDigital(9), hdrPin(1, 1), 'green', 1.0), [0.3, 0.8, 0.2]), mount: 'offboard', label: 'MS WIRES', role: 'Pin 9 to MS1.', circuitIds: ['w_ms1'] },
      { id: 'wire_ms2', kind: 'wire', ...wire(jumper(unoDigital(10), hdrPin(1, 2), 'green', 1.1), [0.2, 0.8, 0]), mount: 'offboard', role: 'Pin 10 to MS2.', circuitIds: ['w_ms2'] },
      { id: 'wire_ms3', kind: 'wire', ...wire(jumper(unoDigital(11), hdrPin(1, 3), 'green', 1.2), [0.1, 0.8, -0.2]), mount: 'offboard', role: 'Pin 11 to MS3.', circuitIds: ['w_ms3'] },
      { id: 'w_rst_slp', kind: 'wire', ...wire(jumper(hdrPin(1, 4), hdrPin(1, 5), 'gray', 0.15), [0, 0.4, 0]), mount: 'offboard', role: 'RESET tied to SLEEP: the carrier\'s SLEEP pull-up keeps both HIGH (awake).' },
      { id: 'w_step', kind: 'wire', ...wire(jumper(unoDigital(3), hdrPin(1, 6), 'yellow', 0.7), [0.2, 0.7, 0.3]), mount: 'offboard', role: 'Pin 3 to STEP: one rising edge per microstep.' },
      { id: 'w_dir', kind: 'wire', ...wire(jumper(unoDigital(4), hdrPin(1, 7), 'blue', 0.6), [0, 0.6, 0.2]), mount: 'offboard', role: 'Pin 4 to DIR.' },
      { id: 'w_vdd', kind: 'wire', ...wire(jumper(unoPower(4), hdrPin(0, 6), 'red', 1.0), [0, 0.8, -0.4]), mount: 'offboard', role: 'Uno 5 V to the driver\'s logic supply VDD.' },
      { id: 'w_gnd', kind: 'wire', ...wire(jumper(unoPower(5), hdrPin(0, 7), 'black', 0.9), [0.4, 0.5, -0.2]), mount: 'offboard', role: 'Common ground: Uno GND to the driver GND.' },
      // motor supply
      { id: 'w_vmot', kind: 'wire', ...wire(jumper(JACK_P, hdrPin(0, 0), 'red', 0.8), [0, 0.6, 0.4]), mount: 'offboard', role: '12 V to VMOT.' },
      { id: 'w_pgnd', kind: 'wire', ...wire(jumper(JACK_N, hdrPin(0, 1), 'black', 0.7), [0, 0.5, 0.3]), mount: 'offboard', role: 'Supply negative to the power GND.' },
      // motor coils: 1A/1B is coil A, 2A/2B is coil B
      { id: 'w_2b', kind: 'wire', ...wire(jumper(motPin(0), hdrPin(0, 2), 'blue', 0.5), [0, 0.4, 0]), mount: 'offboard', role: 'Coil B to 2B.' },
      { id: 'w_2a', kind: 'wire', ...wire(jumper(motPin(1), hdrPin(0, 3), 'red', 0.55), [0, 0.4, 0]), mount: 'offboard', role: 'Coil B to 2A.' },
      { id: 'w_1a', kind: 'wire', ...wire(jumper(motPin(2), hdrPin(0, 4), 'green', 0.6), [0, 0.5, 0]), mount: 'offboard', label: 'COIL A', role: 'Coil A to 1A.' },
      { id: 'w_1b', kind: 'wire', ...wire(jumper(motPin(3), hdrPin(0, 5), 'black', 0.65), [0, 0.4, 0]), mount: 'offboard', role: 'Coil A to 1B.' },
    ],
  },

  circuit: {
    elements: [
      // 12 V motor supply, switched
      { id: 'psu', type: 'V', nodes: ['psu_p', '0'], value: 12, rInternal: 0.05, iLimit: 2, partId: 'psu' }, // a 12 V 2 A adapter: it current-limits at about 2 A
      { id: 'pwr', type: 'SW', nodes: ['psu_p', 'vlead'], closed: true, partId: 'psu' },
      { id: 'r_lead', type: 'R', nodes: ['vlead', 'vl2'], value: 0.05, partId: 'w_vmot' }, // 1 m of supply lead
      { id: 'l_lead', type: 'L', nodes: ['vl2', 'vmot'], value: 1e-6, partId: 'w_vmot' }, // ~1 µH per metre of pair
      { id: 'c_bulk', type: 'C', nodes: ['vmot', '0'], value: 100e-6, polarized: true, rating: { maxV: 35 }, partId: 'c_bulk' },
      { id: 'i_vmot', type: 'I', nodes: ['vmot', '0'], value: 0, rating: { maxV: 35 }, partId: 'u1' }, // 35 V: the A4988's VBB maximum
      // Uno 5 V (USB, always on) and the Vref trimmer (10 kΩ, wiper at 10.9 %: 0.544 V)
      { id: 'v_logic', type: 'V', nodes: ['5v', '0'], value: 5, partId: 'uno' },
      { id: 'pot', type: 'POT', nodes: ['0', 'vref', '5v'], value: 10e3, pos: 0.1088, partId: 'pot' },
      pin(3),
      pin(4),
      pin(8),
      pin(9),
      pin(10),
      pin(11),
      // MS jumper wires and the A4988's internal pull-downs (datasheet: MS1, MS3 100 kΩ; MS2 50 kΩ)
      { id: 'w_ms1', type: 'R', nodes: ['d9', 'ms1'], value: 0.01, partId: 'wire_ms1' },
      { id: 'w_ms2', type: 'R', nodes: ['d10', 'ms2'], value: 0.01, partId: 'wire_ms2' },
      { id: 'w_ms3', type: 'R', nodes: ['d11', 'ms3'], value: 0.01, partId: 'wire_ms3' },
      { id: 'r_pd1', type: 'R', nodes: ['ms1', '0'], value: 100e3, partId: 'u1' },
      { id: 'r_pd2', type: 'R', nodes: ['ms2', '0'], value: 50e3, partId: 'u1' },
      { id: 'r_pd3', type: 'R', nodes: ['ms3', '0'], value: 100e3, partId: 'u1' },
      // coil A: the chopper's current into the winding (R, L), referenced to ground through 1 MΩ
      { id: 'ia', type: 'I', nodes: ['a2', 'a1'], value: 0, partId: 'u1' },
      // winding heat: 17HS4401-class rise ~80 K at rated current (≈ 18 K/W per coil); τ time-compressed
      { id: 'rca', type: 'R', nodes: ['a1', 'am'], value: 1.5, rating: { rth: 18, tauTh: 30, tMax: 130 }, partId: 'mot' },
      { id: 'lca', type: 'L', nodes: ['am', 'a2'], value: 2.8e-3, partId: 'mot' },
      { id: 'ref_a', type: 'R', nodes: ['a2', '0'], value: 1e6, partId: 'u1' },
      { id: 'ib', type: 'I', nodes: ['b2', 'b1'], value: 0, partId: 'u1' },
      { id: 'rcb', type: 'R', nodes: ['b1', 'bm'], value: 1.5, rating: { rth: 18, tauTh: 30, tMax: 130 }, partId: 'mot' },
      { id: 'lcb', type: 'L', nodes: ['bm', 'b2'], value: 2.8e-3, partId: 'mot' },
      { id: 'ref_b', type: 'R', nodes: ['b2', '0'], value: 1e6, partId: 'u1' },
    ],
  },
  powerElementId: 'pwr',
  powerLabel: 'Switch on 12 V',
  transient: true,

  behaviors: [
    {
      id: 'a4988',
      params: {
        step: 3,
        dir: 4,
        enable: 8,
        rs: 0.068,
        rdsTotal: 0.7,
        rthJA: 90, // a bare carrier: thermal shutdown near 1.5 A per coil
        ocp: true, // a genuine A4988: the overcurrent latch works (false: a clone without it)
        tauTh: 8, // time-compressed: a real carrier's die settles over tens of seconds
        tsd: 165,
        tsdHyst: 15,
        holdTorque: 0.4,
        iRated: 1.7,
        rotorJ: 5.7e-6,
        loadNm: 0,
      },
    },
  ],

  readouts: [
    { label: 'VREF', source: { kind: 'voltage', node: 'vref' }, unit: 'V' },
    { label: 'CURRENT LIMIT', source: { kind: 'behavior', key: 'a4988.itrip_A' }, unit: 'A' },
    { label: 'COIL A', source: { kind: 'current', elementId: 'rca' }, unit: 'A' },
    { label: 'COIL B', source: { kind: 'current', elementId: 'rcb' }, unit: 'A' },
    { label: 'SHAFT SPEED', source: { kind: 'behavior', key: 'a4988.rpm' }, unit: 'rpm' },
    { label: 'SKIPPED STEPS', source: { kind: 'behavior', key: 'a4988.skipped' }, unit: 'steps', digits: 1 },
    { label: 'DRIVER Tj', source: { kind: 'behavior', key: 'a4988.tj' }, unit: '°C' },
    { label: 'COIL A TEMP', source: { kind: 'behavior', key: 'a4988.coilA_temp' }, unit: '°C' },
    { label: 'OVERCURRENT LATCH', source: { kind: 'behavior', key: 'a4988.ocp_latched' }, unit: '', digits: 1 },
  ],

  sketch: {
    title: 'One turn, ramped',
    code: sketch,
    pins: { 3: 'pin3', 4: 'pin4', 8: 'pin8', 9: 'pin9', 10: 'pin10', 11: 'pin11' },
    vcc: 5,
    board: 'uno',
  },

  tweaks: [
    { label: 'Vref trimmer (wiper)', elementId: 'pot', key: 'pos', min: 0.02, max: 0.99, step: 0.001, unit: '' },
    { label: 'Sense resistor on board', elementId: 'behavior:a4988', key: 'rs', min: 0.05, max: 0.2, step: 0.001, unit: 'Ω' },
    { label: 'Supply voltage', elementId: 'psu', key: 'value', min: 8, max: 30, step: 0.5, unit: 'V' },
    { label: 'Load torque', elementId: 'behavior:a4988', key: 'loadNm', min: 0, max: 0.4, step: 0.01, unit: 'N·m' },
    { label: 'Driver cooling RθJA, °C/W (90 bare; lower with heatsink and air)', elementId: 'behavior:a4988', key: 'rthJA', min: 40, max: 90, step: 1, unit: '' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: 12 V on VMOT and the coils hold at home (45°, 70.7 % of {1} each). Upload the sketch to step.' },
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: 3200 microsteps make one turn. Listen for the ramp: {4} at the shaft, {0} on Vref sets {1}.' },
    { when: { kind: 'above', readout: 1, value: 1.5 }, text: 'WARNING: the current limit ({1}) is above 1.5 A: add a heatsink and airflow, or turn Vref down.' },
    { when: { kind: 'above', readout: 6, value: 140 }, text: 'WARNING: driver Tj {6} is close to the 165 °C thermal shutdown.' },
    { when: { kind: 'above', readout: 5, value: 0 }, text: 'WARNING: steps lost ({5}, full): the load or acceleration is too much for this current and speed, and nothing tells the sketch.' },
    { when: { kind: 'above', readout: 8, value: 0.5 }, text: 'WARNING: the overcurrent protection has latched the outputs off (a coil passed 2.1 A). Turn Vref down, then toggle ENABLE or cycle the 12 V.' },
  ],

  failures: [
    {
      id: 'no-current-limit',
      label: 'No current limit (trimmer at the stop)',
      explain:
        'Vref = 4.95 V (already past the REF pin\'s 4 V range) asks for 4.95 / (8 × 0.068) = 9.1 A, and the chopper never trips, because a coil could only reach V/R = 12 / (1.5 + 0.7) ≈ 5.5 A. A genuine A4988 protects itself: about 0.44 ms after the trimmer hits the stop the coil current passes the 2.1 A overcurrent threshold and the outputs latch off. COIL A/B read 0 A, the shaft goes limp and OVERCURRENT LATCH reads 1. It stays off until ENABLE is toggled (the sketch\'s free phase does that, so it retries and trips again every cycle) or the 12 V is cycled. At a setting just under the latch, thermal shutdown (165 °C) is the next guard: on a bare carrier it trips near 1.5 A per coil. Clones whose protection doesn\'t work can simply die, and so can the motor (rated 1.7 A). Set Vref before connecting the motor: Vref = I × 8 × R_s = 1.0 × 8 × 0.068 = 0.544 V.',
      patches: [{ op: 'set', elementId: 'pot', key: 'pos', value: 0.99 }],
    },
    {
      id: 'unplug-motor',
      label: 'Unplug the motor while powered',
      explain:
        'Coil A\'s current path opens while it carries current (up to 1 A here, depending on where in the sine table it is). The winding stores ½·L·I² (1.4 mJ at 1 A in 2.8 mH), and that energy has to go somewhere the moment the connector breaks: an arc at the contacts and a fast spike into the driver\'s outputs. The body diodes try to clamp the outputs to about VMOT, but they are not built for repeated hits like this, and the A4988 is dead (the FAULT line quotes the simulated current and energy). Never connect or disconnect a stepper while the driver is powered; loose screw terminals do the same thing slowly. (Pull it during the sketch\'s 2 s "free" phase, with ENABLE HIGH, and nothing burns: no current, no kick. But with one coil missing the shaft can\'t follow the steps either.)',
      patches: [{ op: 'remove', elementId: 'rca' }],
      parts: { hide: ['w_1a', 'w_1b'] },
    },
    {
      id: 'ms-wires-off',
      label: 'MS wires fall off',
      explain:
        'The internal pull-downs make MS1–3 LOW, which means full step. The sketch still sends 3200 pulses per "turn" at the 1/16 rates, so each pulse is now a whole 1.8° step: the motor is asked for 16 turns at 16 times the speed, from 320 rpm straight away, and it mostly buzzes and skips. Pins with pull-downs default safely, but the firmware\'s idea of steps per turn no longer matches the hardware: tie the MS pins to fixed levels, or read them back.',
      patches: [
        { op: 'remove', elementId: 'w_ms1' },
        { op: 'remove', elementId: 'w_ms2' },
        { op: 'remove', elementId: 'w_ms3' },
      ],
      parts: { hide: ['wire_ms1', 'wire_ms2', 'wire_ms3'] },
    },
  ],

  meet: `A NEMA 17 like the 17HS4401 class has about **1.5 Ω and 2.8 mH** per phase and is rated **1.7 A**. Across 12 V a coil would draw 12 / 1.5 = 8 A and cook. So the A4988 regulates **current**: it switches the full supply on until the current reaches the trip level, then off for a fixed time, many times per millisecond.

**The trip level:** I_trip = Vref / (8 × R_s). Pololu's current boards use R_s = 0.068 Ω, so 1.0 A needs Vref = 1.0 × 8 × 0.068 = **0.544 V**. Clones often use 0.1 Ω (marked "R100"), where 1.0 A needs 0.8 V. Read the sense resistors' marking before you trust anyone's formula.

**Microstepping:** MS1–MS3 pick the step size. The translator walks a sine/cosine table: coil A gets I_trip·cos θ and coil B I_trip·sin θ, and each STEP pulse moves θ by 90°/m.

| MS1 | MS2 | MS3 | mode |
|---|---|---|---|
| L | L | L | full |
| H | L | L | half |
| L | H | L | 1/4 |
| H | H | L | 1/8 |
| H | H | H | 1/16 |

In full step θ sits on 45° + k·90°, so each coil carries **70.7 %** of I_trip. At 1/16 one turn is 200 × 16 = **3200 steps**: 60 rpm needs 3200 steps/s, a period of 312 µs. Microsteps smooth the motion, but each carries far less incremental torque than a full step, so don't count on 1/16 for positional accuracy.

**Why 12–24 V, then?** Inductance resists change: di/dt = V/L. At 12 V the current rises 1 A in about 2.8 mH × 1 A / 12 V ≈ 0.23 ms, and the spinning rotor's back-EMF eats into the 12 V as speed rises. Push the step rate past what the current can follow and torque collapses: the motor skips. Raise the supply to 24 V and the top speed before skipping rises by about two-thirds here.

**Ratings:** VMOT 8–35 V, logic 3–5.5 V, 2 A per coil maximum (about 1 A without a heatsink, per Pololu). Protection: an overcurrent latch (about 2.1 A minimum trip) that holds the outputs off until ENABLE is toggled or the power is cycled, and thermal shutdown at about 165 °C. On a bare carrier the die runs at roughly 25 °C + I² × 0.7 Ω × 90 °C/W: about 90 °C at 1 A, and shutdown near 1.5 A.

*Sim note:* the chopper is simulated as its average: each coil is a current source that follows the table, rising no faster than (VMOT − I·R − back-EMF)/L allows. STEP edges are timestamped to the microsecond and the rotor (holding torque ∝ current, inertia, load) is integrated in 20 µs slices. The die's thermal time constant is compressed to 8 s and the winding's to 30 s, so heating shows within a sketch cycle. Unplugging a coil is a rule (the averaged source hides the spike). The 12 V adapter current-limits at 2 A. The 3D shaft follows the simulated rotor angle.`,

  mechanicalAnalogy: `A stepper with an A4988 is a position-controlled detent mechanism. Each STEP pulse moves the magnetic "detent" by 1.8°/m, and the rotor follows like a spring-loaded follower in a cam track. The current limit sets how stiff the spring is (holding torque), and microstepping is a finer cam profile. Load or acceleration beyond the spring force and the follower jumps a tooth (a skipped step), and nothing tells you, because there is no feedback.

**Where it breaks:** the magnetic spring weakens as speed rises, because the voltage-limited current can't build in time, so a stepper's stiffness, unlike a cam's, depends on speed.`,

  proTips: [
    'Set Vref with the motor disconnected and the logic powered, using a ceramic or plastic screwdriver if you can, and the meter\'s COM on GND. Turn the trimmer in small amounts: on many carriers a quarter turn changes the current by hundreds of mA.',
    'Ramp speed up and down. A NEMA 17 starting cold at 600 rpm usually just buzzes, while a 0.2 s ramp gets it there. Libraries like AccelStepper do this for you on real hardware.',
    'Disable the outputs (EN HIGH) when holding torque isn\'t needed. A motor holding at 1 A per coil dissipates 2 × 1² × 1.5 = 3 W in the windings, plus the driver\'s share, even while standing still.',
  ],

  guide: [
    {
      id: 'meet-the-driver',
      title: 'Meet the driver',
      body: 'Click the **A4988** chip to open its inspector. It is a microstepping driver with a chopper: it measures coil current across a sense resistor and switches the 12 V to hold it at a limit.',
      check: { kind: 'inspect', part: 'u1' },
      focus: { part: 'u1' },
      hint: 'It is the small chip on the red carrier board, next to the trimmer.',
      explain: 'A stepper coil is a 1.5 Ω resistor and an inductor: 12 V alone would push far too much current. The chopper turns the voltage on and off to hold the current at a set limit.',
    },
    {
      id: 'power',
      title: 'Switch on 12 V',
      body: 'Press **Switch on 12 V**. The motor supply comes up and the coils hold the shaft at its home position.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'power' }, { kind: 'status', is: 'POWERED' }] },
      focus: { control: 'power' },
      explain: 'With no step pulses the driver still energises both coils. The shaft is locked, which is why a stepper is warm even when idle.',
    },
    {
      id: 'read-vref',
      title: 'Read the current limit',
      body: 'Click the **VREF** trimmer to open its inspector. **VREF** reads about **0.54 V** and **CURRENT LIMIT** about **1.0 A**: 0.544 / (8 × 0.068 Ω). Each coil holds **0.707 A**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'inspect', part: 'pot' },
          { kind: 'readout', index: 0, above: 0.5, below: 0.6, holdMs: 300 },
          { kind: 'readout', index: 1, above: 0.95, below: 1.05, holdMs: 300 },
          { kind: 'readout', index: 2, above: 0.6, below: 0.8, holdMs: 300 },
        ],
      },
      focus: { part: 'pot' },
      hint: 'The brass screw on the board is the trimmer.',
      explain: 'The A4988 trips its chopper when the sense voltage reaches Vref / 8, so I_trip = Vref / (8 × R_sense). In full-step hold both coils are at 70.7 % (the sine of 45°), so each carries 1.0 × 0.707 A.',
    },
    {
      id: 'upload',
      title: 'Upload the sketch',
      body: 'Press **Upload sketch**. The sketch sets the MS pins for **1/16 microstepping** (3200 steps per turn) and sends step pulses on pin 3.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'upload' },
          { kind: 'status', is: 'RUNNING' },
          { kind: 'pin', pin: 11, level: 1 },
        ],
      },
      focus: { control: 'upload' },
      hint: 'Upload only works while the board is powered.',
      explain: 'MS1, MS2 and MS3 all HIGH select 1/16 step: 200 full steps × 16 = 3200 pulses per turn, 0.1125° each. A DIR pulse high or low picks the direction.',
    },
    {
      id: 'spin-up',
      title: 'Watch it reach 120 rpm',
      body: 'The first turn ramps the step rate from 20 rpm to **120 rpm**. **SHAFT SPEED** climbs above **80 rpm**.',
      check: { kind: 'readout', index: 4, above: 80, holdMs: 200 },
      hint: 'Wait for the ramp: the motor speeds up over the first quarter of the turn.',
      explain: 'At 120 rpm in 1/16 step the sketch sends 120 / 60 × 3200 = 6400 steps per second. The ramp matters: a stepper that is asked to start at full speed misses steps because the rotor cannot accelerate that fast.',
    },
    {
      id: 'overload',
      title: 'Overload the shaft',
      body: 'Slide **Load torque** above **0.3 N·m**. The holding torque at 1 A is about 0.235 N·m, so **SKIPPED STEPS** starts counting.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Load torque', min: 0.3 },
          { kind: 'readout', index: 5, above: 0.5 },
        ],
      },
      focus: { control: 'tweak:Load torque' },
      hint: 'The slider runs to 0.4 N·m. It takes a second or two for a step to be missed.',
      explain: 'A stepper has no feedback: if the load exceeds the torque the coil current can produce, the rotor slips a step, and the sketch never finds out. This is why a stepper needs a margin of torque, or an encoder.',
    },
    {
      id: 'no-limit',
      title: 'Break it: no current limit',
      body: 'Open **Break something** and choose **No current limit**. Vref hits the stop at 4.95 V, asking for 9 A, and the **OVERCURRENT LATCH** reads **1**.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'no-current-limit' }, { kind: 'readout', index: 8, above: 0.5 }] },
      focus: { control: 'break' },
      explain: 'I_trip = 4.95 / (8 × 0.068) = 9.1 A, higher than a coil can ever reach at 12 V (about 5.5 A). The genuine A4988 notices a coil past 2.1 A, latches the outputs off and the shaft goes limp. It needs ENABLE toggled or the 12 V cycled.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**. The trimmer is back at 1.0 A.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: current limit, microstepping and torque.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  quiz: [
    {
      q: 'On a board with R_s = 0.068 Ω, what Vref sets a 1.2 A limit?',
      options: ['0.082 V', '0.41 V', '0.65 V', '1.2 V'],
      answer: 2,
      why: 'Vref = 1.2 × 8 × 0.068 = 0.653 V.',
    },
    {
      q: 'How many steps per second does 90 rpm need at 1/8 microstepping on a 200-step motor?',
      options: ['300', '1200', '2400', '14 400'],
      answer: 2,
      why: '90/60 = 1.5 rev/s, and 1.5 × 200 × 8 = 2400 steps/s.',
    },
    {
      q: 'I_trip is set to 1.0 A and the driver is in full-step mode. What is the coil current while holding?',
      options: ['0.5 A', '0.707 A', '1.0 A', '1.41 A'],
      answer: 1,
      why: 'In full-step mode the A4988 sits at the 45° point of its sine table, so each coil carries 70.7 % of I_trip.',
    },
    {
      q: 'Why is unplugging a stepper from a powered A4988 dangerous?',
      options: [
        'The motor turns into a generator',
        'Opening an inductor carrying current produces a large voltage spike that can destroy the driver\'s outputs',
        'It resets the microstep mode',
        'It drains the 100 µF capacitor',
      ],
      answer: 1,
      why: 'V = L·di/dt. Interrupting about 1 A in microseconds through 2.8 mH gives hundreds of volts.',
    },
  ],
}
