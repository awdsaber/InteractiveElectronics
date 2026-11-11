// T7 · Debugging with Instruments. Source: docs/curriculum/T7/debugging-instruments.md
//
// A small "tilt lamp" gadget with hidden faults: a 9 V adapter, an LM7805 making the 5 V rail for an
// Uno (fed on its 5V pin) and a 1 W white LED lamp switched by an IRLZ44N on PWM pin 9, and an
// MPU-6050 breakout on I²C (4.7 kΩ pull-ups on the gadget board, 100 pF of bus capacitance). The
// sketch reads the tilt and sets the lamp's brightness; pin 10 blinks a heartbeat LED.
//
// The instruments are circuit elements, so their errors are simulator results:
//   DMM        10 MΩ from node 'dmm' to ground; its leads (SW m_*) pick the node (`source-select`
//              'leads'); `ac-meter` 'dmm' averages it over 0.5 s, as a meter's display does.
//   ammeter    a second meter on its mA range: 1.8 Ω (1.8 mV/mA burden) that replaces jumper J1 in the
//              lamp loop (`source-select` 'lamp-path').
//   scope      CH1 on the MOSFET gate, CH2 on the 5 V rail. Its ×10 / ×1 probe on SCL is R ‖ C on the
//              node (`probe-load`), and the analyzer adds that C to the SCL rise (`sclCap` list).
//   analyzer   `logic-analyzer`: I²C decode, and a SENSOR VCC lane thresholded at `vth`.
// Hidden faults: a cold joint on the sensor's VCC pin (`intermittent`), a missing SDA pull-up, a
// 78L05 fitted for the LM7805, and the pin 9 / pin 10 wires swapped.
import type { LessonDef } from '../../engine/types'
import { PITCH, jumper } from '../layout'

// ── layout: an 18 × 9.5 PCB. The Uno on the right (digital header on its −x edge facing the lamp
// driver, analog header on +x toward the sensor behind it). Power entry at the back left, the lamp
// along the front left, the meters off the board at the left ──
const UNO_AT: [number, number] = [5.0, 0.6]
const HY = 0.16 + 0.85
/** Uno digital socket (−x edge) */
const unoD = (pin: number): [number, number, number] => {
  const lx = pin < 8 ? 2.35 + (3.5 - pin) * PITCH : -0.25 + (4.5 - (pin - 8)) * PITCH
  return [UNO_AT[0] - 2.4, HY, UNO_AT[1] - lx]
}
/** Uno analog socket A0..A5 (+x edge) */
const unoA = (i: number): [number, number, number] => [UNO_AT[0] + 2.4, HY, UNO_AT[1] - (1.95 + (i - 2.5) * PITCH)]

const GY: [number, number] = [5.6, -3.5]
const gyPin = (i: number): [number, number, number] => [GY[0] + (i - 3.5) * PITCH, 0.62, GY[1] + 0.67] // VCC GND SCL SDA XDA XCL AD0 INT

const Q1_AT: [number, number] = [-1.4, 0.4]
const GATE_PT: [number, number, number] = [Q1_AT[0] - 0.25, 0.3, Q1_AT[1] + 0.75]
const BEAT_R: [number, number] = [0.9, 2.6]
const BEAT_PT: [number, number, number] = [BEAT_R[0], 0.3, BEAT_R[1] - 0.6]

type Wire = ReturnType<typeof jumper>
const wire = (w: Wire, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const SKETCH = `#include <Wire.h>

#define MPU_ADDR 0x68
#define LAMP 9        // PWM to the MOSFET gate (490 Hz)
#define BEAT 10       // heartbeat LED, 1 Hz

int ax = 0;
int beat = 0;
unsigned long lastBeat = 0;

void wake() {                       // clear the MPU-6050's sleep bit
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0x00);
  Wire.endTransmission();
}

int readAccelX() {                  // 1 = ok, 0 = the sensor did not answer
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) {
    return 0;
  }
  Wire.requestFrom(MPU_ADDR, 2);
  if (Wire.available() < 2) {
    return 0;
  }
  int hi = Wire.read();
  int lo = Wire.read();
  ax = (hi << 8) | lo;
  return 1;
}

void setup() {
  pinMode(LAMP, OUTPUT);
  pinMode(BEAT, OUTPUT);
  Serial.begin(115200);
  Wire.begin();
  Wire.setClock(100000);
  wake();
}

void loop() {
  if (readAccelX()) {
    int tilt = constrain(abs(ax), 0, 16384);
    int level = map(tilt, 0, 16384, 60, 255);   // tilt it further, it gets brighter
    analogWrite(LAMP, level);
    Serial.print("ax:");
    Serial.print(ax);
    Serial.print(",lamp:");
    Serial.println(level);
  } else {
    analogWrite(LAMP, 0);           // fail safe: lamp off
    Serial.println("sensor lost");
    wake();                         // it may have browned out: wake it again
  }
  if (millis() - lastBeat >= 500) {
    lastBeat = millis();
    beat = !beat;
    digitalWrite(BEAT, beat);
  }
  delay(20);
}
`

const LEAD_OPTIONS = [
  { label: '5 V rail', value: 0 },
  { label: 'Sensor 3V3', value: 1 },
  { label: 'SDA', value: 2 },
  { label: 'VIN SENSE', value: 3 },
  { label: 'Off', value: 4 },
]

export const lesson: LessonDef = {
  id: 'debugging-instruments',
  track: 'T7',
  title: 'Debugging with Instruments',
  subtitle: 'Meter, scope, analyzer',
  tagline: 'A 10 MΩ meter on a 1 MΩ / 1 MΩ divider reads 4.8 % low, and a ×1 probe on an I²C clock doubles its rise time from 398 to 797 ns.',

  board: {
    name: 'TILT LAMP',
    size: [18, 9.5],
    base: 'mat',
    traces: [
      // regulator out to the 5 V rail along the back, down to the lamp jumper
      [[-5.2, -3.0], [-3.4, -3.0], [-3.4, 1.0]],
      // lamp: jumper → resistor → LED → MOSFET drain
      [[-3.4, 1.6], [-3.4, 2.6], [-2.6, 2.6]],
      [[-5.6, 2.6], [-5.6, 1.6], [Q1_AT[0], 1.6], [Q1_AT[0], Q1_AT[1] + 0.6]],
      // pull-ups to SDA / SCL at the sensor header
      [[2.8, -3.6], [4.7, -3.6], [4.7, -2.9]],
      [[2.8, -2.9], [4.4, -2.9]],
    ],
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], 0, UNO_AT[1]],
        mount: 'module',
        label: 'UNO',
        role: 'The gadget\'s brain, fed on its 5V pin from the gadget\'s own regulator (its USB is unplugged): I²C on A4/A5, the lamp PWM on pin 9, a heartbeat on pin 10.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [0, 1.8, 1.4] },
        circuitIds: ['r_board', 'pin9', 'pin10'],
        facts: [
          'analogWrite on pin 9: 490 Hz PWM (timer 1); pins 5 and 6 run at 980 Hz',
          'ATmega328P at 16 MHz needs at least about 3.78 V (datasheet speed grade: 10 MHz at 2.7 V, 20 MHz at 4.5 V)',
          'Brown-out reset at 2.7 V (the Uno\'s BODLEVEL fuse setting)',
          'Board draw about 45 mA (modelled as 111 Ω)',
        ],
      },
      {
        id: 'jack',
        kind: 'barrel-jack',
        pos: [-7.8, -3.4],
        mount: 'tht',
        label: '9 V IN',
        role: 'A 9 V wall adapter (about 0.3 Ω of output resistance and cable).',
        params: { callout: [-0.2, 1.4, 0.4] },
        circuitIds: ['v_in'],
      },
      {
        id: 'reg',
        kind: 'regulator-to220',
        pos: [-5.8, -3.3],
        mount: 'tht',
        label: 'LM7805',
        role: 'The 5 V regulator for everything: Uno, sensor and lamp (up to about 0.4 A). At 9 V in it dissipates (9 − 5) × 0.4 ≈ 1.6 W, so it wants a heatsink.',
        params: { marking: 'LM7805', callout: [0.2, 2.4, -0.6] },
        circuitIds: ['reg'],
        facts: ['Output 5 V, 1 A class (TO-220)', 'Dropout about 2 V at 1 A', 'Quiescent current about 5 mA', 'Input 35 V absolute maximum'],
      },
      {
        id: 'reg_small',
        kind: 'transistor-to92',
        pos: [-5.8, -3.3],
        mount: 'tht',
        hidden: true,
        label: '78L05',
        role: 'The fault: a 78L05 in a TO-92, a 100 mA regulator, fitted where the lamp needs about 0.4 A. It current-limits and the rail sags on every lamp pulse.',
        params: { marking: '78L05', callout: [0.2, 1.6, -0.6] },
        circuitIds: ['reg'],
        facts: ['Output current up to 100 mA', 'Peak output (current limit) about 140 mA typ.', 'Dropout about 1.7 V', 'Quiescent current about 3 mA'],
      },
      {
        id: 'c5v',
        kind: 'capacitor-electrolytic',
        pos: [-4.4, -3.0],
        mount: 'tht',
        role: '10 µF on the 5 V rail, at the regulator output.',
        params: { farads: 10e-6 },
        circuitIds: ['c_5v'],
      },
      {
        id: 'tp5v',
        kind: 'testpoint',
        pos: [-3.4, -2.2],
        mount: 'tht',
        label: 'TP 5V',
        role: 'Test point on the 5 V rail: where the meter goes first.',
        params: { color: 'red', callout: [0, 1.0, 0.5] },
      },
      {
        id: 'r_s1',
        kind: 'resistor',
        pos: [-6.6, -1.6],
        mount: 'tht',
        label: 'VIN SENSE',
        role: 'Top of a 1 MΩ / 1 MΩ divider that lets the Uno watch the adapter voltage (a high-impedance node: about 0.5 MΩ Thevenin).',
        params: { ohms: 1e6, callout: [0, 1.2, -0.6] },
        circuitIds: ['r_s1'],
      },
      {
        id: 'r_s2',
        kind: 'resistor',
        pos: [-6.6, -0.8],
        mount: 'tht',
        role: 'Bottom of the VIN SENSE divider, 1 MΩ: a 10 MΩ meter across it makes it 909 kΩ.',
        params: { ohms: 1e6 },
        circuitIds: ['r_s2'],
      },
      {
        id: 'j1',
        kind: 'header-male',
        pos: [-3.4, 1.3],
        mount: 'tht',
        label: 'J1 (I-LAMP)',
        role: 'Lamp current jumper: pull it and put the ammeter across the pins to measure the lamp current in series.',
        params: { pins: 2, callout: [-0.4, 1.0, -0.4] },
        circuitIds: ['j1'],
      },
      {
        id: 'r_lamp',
        kind: 'resistor',
        pos: [-3.0, 2.6],
        mount: 'tht',
        role: '5.6 Ω, 1 W: sets the lamp current, (5 − 3.15) / 5.6 ≈ 0.33 A while the MOSFET is on.',
        params: { ohms: 5.6 },
        circuitIds: ['r_lamp'],
      },
      {
        id: 'lamp',
        kind: 'led',
        pos: [-5.0, 0, 2.6],
        mount: 'tht',
        label: 'LAMP',
        role: 'A 1 W white LED: about 3.15 V at 0.33 A. Its brightness follows the tilt.',
        params: { color: 'white', callout: [-0.4, 1.4, 0.6] },
        circuitIds: ['lamp'],
        facts: ['1 W class white LED: 350 mA maximum', 'Forward voltage about 3.0–3.4 V at 350 mA'],
      },
      {
        id: 'q1',
        kind: 'mosfet-to220',
        pos: [Q1_AT[0], 0, Q1_AT[1]],
        mount: 'tht',
        label: 'IRLZ44N',
        role: 'Logic-level N-MOSFET, the lamp\'s low-side switch. A 100 kΩ pull-down holds the gate low while the pin floats.',
        params: { callout: [0.2, 2.2, -0.8] },
        circuitIds: ['q1', 'r_pd'],
        facts: ['V_GS(th) 1.0–2.0 V', 'R_DS(on) 25 mΩ max at V_GS = 5 V', 'V_DSS 55 V'],
      },
      {
        id: 'r_beat',
        kind: 'resistor',
        pos: [BEAT_R[0], 0, BEAT_R[1]],
        rot: 90,
        mount: 'tht',
        role: '1 kΩ for the heartbeat LED.',
        params: { ohms: 1000 },
        circuitIds: ['r_beat'],
      },
      {
        id: 'beat',
        kind: 'led',
        pos: [BEAT_R[0], 0, BEAT_R[1] + 1.1],
        mount: 'tht',
        label: 'HEARTBEAT',
        role: 'Blinks at 1 Hz from pin 10: a quick "the sketch is alive" check.',
        params: { color: 'red', callout: [0.5, 1.0, 0.5] },
        circuitIds: ['led_beat'],
      },
      {
        id: 'gy521',
        kind: 'module',
        pos: [GY[0], 0, GY[1]],
        mount: 'module',
        label: 'MPU-6050',
        role: 'The tilt sensor breakout on I²C at 0x68, with its own 3.3 V LDO. This one has no pull-ups on it: the gadget board provides them.',
        params: { w: 2.1, d: 1.6, pins: 8, title: 'MPU-6050', color: '#2b59c3', callout: [0.4, 1.3, -0.6] },
        circuitIds: ['j_vcc', 'ldo', 'r_mpu'],
        facts: ['MPU-6050 VDD 2.375–3.46 V', 'About 3.9 mA with the gyro and accelerometer running', 'I²C address 0x68 (AD0 low)'],
      },
      {
        id: 'r_sda',
        kind: 'resistor',
        pos: [2.2, -3.6],
        mount: 'tht',
        label: 'PULL-UPS',
        role: 'SDA pull-up, 4.7 kΩ to the sensor\'s 3.3 V. I²C devices only pull LOW; HIGH is this resistor\'s job.',
        params: { ohms: 4700, callout: [-0.2, 1.1, -0.5] },
        circuitIds: ['r_sda'],
      },
      {
        id: 'r_scl',
        kind: 'resistor',
        pos: [2.2, -2.9],
        mount: 'tht',
        role: 'SCL pull-up, 4.7 kΩ to 3.3 V: t_r = 0.8473 × 4.7 kΩ × 100 pF ≈ 398 ns.',
        params: { ohms: 4700 },
        circuitIds: ['r_scl'],
      },
      {
        id: 'probe_scl',
        kind: 'probe',
        pos: [1.0, 0.3, -2.6],
        rot: 0,
        mount: 'offboard',
        label: 'PROBE ON SCL',
        role: 'A scope probe clipped onto SCL: on ×10 it adds 10 MΩ ‖ 12 pF to the node, on ×1 it adds 1 MΩ ‖ 100 pF.',
        params: { color: '#2fb7c9', tilt: 24, callout: [-0.8, 1.0, 0.4] },
        circuitIds: ['r_probe', 'c_probe'],
      },
      {
        id: 'probe_gate',
        kind: 'probe',
        pos: [GATE_PT[0], 0.3, GATE_PT[2] + 0.2],
        rot: 0,
        mount: 'offboard',
        label: 'CH1',
        role: 'Scope CH1 (×10) on the MOSFET gate: the lamp\'s drive signal.',
        params: { color: 'yellow', tilt: 24, callout: [0.9, 1.2, 0.9] },
      },
      {
        id: 'dmm',
        kind: 'multimeter',
        pos: [-7.6, -0.18, 2.4],
        mount: 'offboard',
        label: 'DMM',
        role: 'Handheld DMM on DC volts: 10 MΩ input, shows the average over about half a second. Pick its lead position with DMM leads.',
        params: { readout: 0, autoUnit: true, title: 'DMM · V', mode: 'V', scale: 0.34, callout: [0.4, 1.4, 0.6] },
        circuitIds: ['r_dmm'],
      },
      {
        id: 'ammeter',
        kind: 'multimeter',
        pos: [7.9, -0.18, 3.2],
        mount: 'offboard',
        label: 'AMMETER',
        role: 'A second meter kept on its mA range (1.8 mV/mA burden, so 1.8 Ω). Put it in the lamp loop with Lamp current path.',
        params: { readout: 1, autoUnit: true, title: 'mA', mode: 'A', scale: 0.3, callout: [-0.6, 1.2, 0.4] },
        circuitIds: ['r_amm'],
      },
      {
        id: 'la',
        kind: 'module',
        pos: [0.0, 0, -3.8],
        mount: 'offboard',
        label: 'ANALYZER',
        role: 'An 8-channel USB logic analyzer: grabbers on SDA, SCL, pin 10 and the sensor\'s VCC pin. Open Instruments → Logic analyzer.',
        params: { w: 2.2, d: 1.4, pins: 0, title: 'LOGIC 8CH', color: '#1d1b17', callout: [0, 1.0, -0.5] },
        facts: ['Shows logic levels only: each sample is HIGH or LOW against one threshold', 'A slow or weak signal shows a clean edge where it happens to cross the threshold'],
      },
      { id: 'w_lamp', kind: 'wire', ...wire(jumper(unoD(9), GATE_PT, 'yellow', 0.8), [0, 0.6, 0]), mount: 'offboard', label: 'D9 → GATE', role: 'Pin 9 (PWM) to the MOSFET gate.' },
      { id: 'w_beat', kind: 'wire', ...wire(jumper(unoD(10), BEAT_PT, 'green', 0.6), [0, 0.5, 0]), mount: 'offboard', role: 'Pin 10 to the heartbeat LED\'s resistor.' },
      {
        id: 'w_lamp_x',
        kind: 'wire',
        ...wire(jumper(unoD(10), GATE_PT, 'yellow', 1.0), [0, 0.6, 0]),
        mount: 'offboard',
        hidden: true,
        label: 'D10 → GATE',
        role: 'The fault: the gate wire landed on pin 10, one socket over.',
      },
      { id: 'w_beat_x', kind: 'wire', ...wire(jumper(unoD(9), BEAT_PT, 'green', 0.4), [0, 0.5, 0]), mount: 'offboard', hidden: true, role: 'The heartbeat wire, now on pin 9.' },
      { id: 'w_sda', kind: 'wire', ...wire(jumper(unoA(4), gyPin(3), 'blue', 0.8), [0, 0.6, 0.2]), mount: 'offboard', role: 'A4 (SDA) to the sensor.' },
      { id: 'w_scl', kind: 'wire', ...wire(jumper(unoA(5), gyPin(2), 'yellow', 1.0), [0, 0.7, -0.2]), mount: 'offboard', role: 'A5 (SCL) to the sensor.' },
    ],
  },

  circuit: {
    elements: [
      // power entry: 9 V adapter, the power switch, the 5 V regulator
      { id: 'v_in', type: 'V', nodes: ['vin_raw', '0'], value: 9, rInternal: 0.3, partId: 'jack' },
      { id: 'plug', type: 'SW', nodes: ['vin_raw', 'vin'], closed: true, partId: 'jack' },
      { id: 'r_s1', type: 'R', nodes: ['vin', 'vsense'], value: 1e6, partId: 'r_s1' },
      { id: 'r_s2', type: 'R', nodes: ['vsense', '0'], value: 1e6, partId: 'r_s2' },
      { id: 'reg', type: 'REG', nodes: ['vin', '0', '5v'], vout: 5, dropout: 2, iLimit: 1.5, iq: 0.005, rating: { maxV: 35 }, partId: 'reg' },
      { id: 'c_5v', type: 'C', nodes: ['5v', '0'], value: 10e-6, partId: 'c5v' },
      { id: 'r_board', type: 'R', nodes: ['5v', '0'], value: 111, partId: 'uno' },
      // lamp: J1 (or the ammeter) → 5.6 Ω → 1 W LED → IRLZ44N (vth 1.5 V, k 11.4 as in T2/mosfet-switch)
      { id: 'j1', type: 'SW', nodes: ['5v', 'lamp_a'], closed: true, partId: 'j1' },
      { id: 'amm_in', type: 'SW', nodes: ['5v', 'amm_a'], closed: false, partId: 'ammeter' },
      { id: 'r_amm', type: 'R', nodes: ['amm_a', 'lamp_a'], value: 1.8, partId: 'ammeter' },
      { id: 'r_lamp', type: 'R', nodes: ['lamp_a', 'lamp_led'], value: 5.6, rating: { maxP: 1 }, partId: 'r_lamp' },
      // a 1 W white LED as a diode: 3.0 V at 100 mA, 3.3 V at 350 mA (the LED element is a 5 mm part: 5 Ω inside)
      { id: 'lamp', type: 'D', nodes: ['lamp_led', 'lamp_k'], is: 1.1e-15, n: 3.6, rs: 0.6, rating: { maxI: 0.35 }, partId: 'lamp' },
      { id: 'q1', type: 'NMOS', nodes: ['lamp_k', 'gate', '0'], vth: 1.5, k: 11.4, rating: { maxV: 55, maxI: 47 }, partId: 'q1' },
      { id: 'r_pd', type: 'R', nodes: ['gate', '0'], value: 100000, partId: 'q1' },
      { id: 'pin9', type: 'PIN', nodes: ['d9', '0'], pin: 9, vcc: 5, partId: 'uno' },
      { id: 'pin10', type: 'PIN', nodes: ['d10', '0'], pin: 10, vcc: 5, partId: 'uno' },
      { id: 'w_lamp', type: 'R', nodes: ['d9', 'gate'], value: 0.05, partId: 'w_lamp' },
      { id: 'w_beat', type: 'R', nodes: ['d10', 'beat'], value: 0.05, partId: 'w_beat' },
      { id: 'r_beat', type: 'R', nodes: ['beat', 'beat_l'], value: 1000, partId: 'r_beat' },
      { id: 'led_beat', type: 'LED', nodes: ['beat_l', '0'], color: 'red', rating: { maxI: 0.03 }, partId: 'beat' },
      // sensor breakout: VCC pin joint, 3.3 V LDO, the MPU-6050 (≈ 3.9 mA), AD0 low
      { id: 'j_vcc', type: 'R', nodes: ['5v', 'gy_vin'], value: 0.01, partId: 'gy521' },
      { id: 'ldo', type: 'REG', nodes: ['gy_vin', '0', '3v3'], vout: 3.3, dropout: 0.25, iLimit: 0.2, partId: 'gy521' },
      { id: 'r_mpu', type: 'R', nodes: ['3v3', '0'], value: 846, partId: 'gy521' },
      { id: 'r_ad0', type: 'R', nodes: ['ad0', '0'], value: 4700, partId: 'gy521' },
      // I²C: pull-ups on the gadget board, 100 pF per line, the Uno's A4/A5
      { id: 'r_sda', type: 'R', nodes: ['3v3', 'sda'], value: 4700, partId: 'r_sda' },
      { id: 'r_scl', type: 'R', nodes: ['3v3', 'scl'], value: 4700, partId: 'r_scl' },
      { id: 'c_sda', type: 'C', nodes: ['sda', '0'], value: 100e-12, partId: 'gy521' },
      { id: 'c_scl', type: 'C', nodes: ['scl', '0'], value: 100e-12, partId: 'gy521' },
      { id: 'pin_sda', type: 'PIN', nodes: ['sda', '0'], pin: 18, vcc: 5, partId: 'uno' },
      { id: 'pin_scl', type: 'PIN', nodes: ['scl', '0'], pin: 19, vcc: 5, partId: 'uno' },
      // the scope probe on SCL (values set by probe-load)
      { id: 'r_probe', type: 'R', nodes: ['scl', '0'], value: 1e7, partId: 'probe_scl' },
      { id: 'c_probe', type: 'C', nodes: ['scl', '0'], value: 12e-12, partId: 'probe_scl' },
      // the DMM: four lead positions into its 10 MΩ input
      { id: 'm_5v', type: 'SW', nodes: ['5v', 'dmm'], closed: true, partId: 'dmm' },
      { id: 'm_3v3', type: 'SW', nodes: ['3v3', 'dmm'], closed: false, partId: 'dmm' },
      { id: 'm_sda', type: 'SW', nodes: ['sda', 'dmm'], closed: false, partId: 'dmm' },
      { id: 'm_vs', type: 'SW', nodes: ['vsense', 'dmm'], closed: false, partId: 'dmm' },
      { id: 'r_dmm', type: 'R', nodes: ['dmm', '0'], value: 1e7, partId: 'dmm' },
    ],
  },
  powerElementId: 'plug',
  powerLabel: 'Plug in 9 V',
  transient: true,
  // 0.1 ms: 20 points per 490 Hz PWM period, so the scope draws the real square wave
  sim: { dt: 1e-4 },

  behaviors: [
    { id: 'logic-analyzer', params: { laBaud: 115200, sclCap: 'c_scl,c_probe', vth: 1.5 } },
    { id: 'imu-mpu6050', params: { pitchSource: 'tweak', pitchDeg: -25, addr: 0x68 } },
    { id: 'mcu-supply', instance: 'mcu', params: { supplyNode: '5v' } },
    { id: 'intermittent', instance: 'joint', params: { element: 'j_vcc', good: 0.01, bad: 1200, active: 0, goodMs: 500, badMs: 150 } },
    { id: 'probe-load', instance: 'probe', params: { r: 'r_probe', c: 'c_probe', mode: 1 } },
    { id: 'source-select', instance: 'leads', params: { switches: 'm_5v,m_3v3,m_sda,m_vs', mode: 0 } },
    { id: 'source-select', instance: 'lamp-path', params: { switches: 'j1,amm_in', mode: 0 } },
    { id: 'ac-meter', instance: 'dmm', params: { node: 'dmm', window: 0.5 } },
    { id: 'ac-meter', instance: 'amm', params: { kind: 'i', element: 'r_amm', window: 0.5 } },
    { id: 'ac-meter', instance: 'lamp', params: { kind: 'i', element: 'r_lamp', window: 0.5 } },
    { id: 'ac-meter', instance: 'gate', params: { node: 'gate' } },
    { id: 'ac-meter', instance: 'pin9', params: { node: 'd9' } },
  ],

  readouts: [
    { label: 'DMM', source: { kind: 'behavior', key: 'dmm.dc' }, unit: 'V' },
    { label: 'AMMETER', source: { kind: 'behavior', key: 'amm.dc' }, unit: 'A', floor: 1e-4 },
    { label: 'GATE FREQ', source: { kind: 'behavior', key: 'gate.freq' }, unit: 'Hz' },
    { label: 'PIN 9 FREQ', source: { kind: 'behavior', key: 'pin9.freq' }, unit: 'Hz' },
    { label: 'I²C RISE (SCL)', source: { kind: 'behavior', key: 'logic-analyzer.i2c_tr' }, unit: 's' },
    { label: 'I²C NACKS', source: { kind: 'behavior', key: 'logic-analyzer.i2c_nacks' }, unit: 'counts' },
    { label: 'SENSOR VCC', source: { kind: 'voltage', node: '3v3' }, unit: 'V' },
    { label: 'LAMP CURRENT (TRUE)', source: { kind: 'behavior', key: 'lamp.dc' }, unit: 'A' },
  ],

  sketch: { title: 'Tilt lamp', code: SKETCH, pins: { 9: 'pin9', 10: 'pin10', 18: 'pin_sda', 19: 'pin_scl' }, vcc: 5, board: 'uno' },

  tweaks: [
    { label: 'DMM leads', elementId: 'behavior:leads', key: 'mode', kind: 'enum', min: 0, max: 4, unit: '', options: LEAD_OPTIONS },
    {
      label: 'Lamp current path',
      elementId: 'behavior:lamp-path',
      key: 'mode',
      kind: 'enum',
      min: 0,
      max: 1,
      unit: '',
      options: [
        { label: 'Jumper J1', value: 0 },
        { label: 'Ammeter (mA)', value: 1 },
      ],
    },
    {
      label: 'Scope probe on SCL',
      elementId: 'behavior:probe',
      key: 'mode',
      kind: 'enum',
      min: 0,
      max: 2,
      unit: '',
      options: [
        { label: 'Lifted', value: 0 },
        { label: '×10', value: 1 },
        { label: '×1', value: 2 },
      ],
    },
    {
      label: 'Analyzer threshold',
      elementId: 'behavior:logic-analyzer',
      key: 'vth',
      kind: 'enum',
      min: 1.5,
      max: 2.5,
      unit: 'V',
      options: [
        { label: '1.5 V', value: 1.5 },
        { label: '2.5 V', value: 2.5 },
      ],
    },
    { label: 'Gadget tilt', elementId: 'behavior:imu-mpu6050', key: 'pitchDeg', min: -80, max: 80, step: 1, unit: '°' },
  ],

  instruments: {
    view: 'scope',
    scope: {
      channels: [
        { label: 'GATE', source: { kind: 'voltage', node: 'gate' }, perDiv: 2, offset: -3.5 },
        { label: '5 V RAIL', source: { kind: 'voltage', node: '5v' }, perDiv: 1, offset: -2 },
      ],
      timePerDiv: 1e-3,
      trigger: { channel: 0, level: 2.5, slope: 'rising', mode: 'auto' },
    },
    logic: {
      channels: [
        { node: 'sda', label: 'SDA' },
        { node: 'scl', label: 'SCL' },
        { pin: 10, label: 'BEAT (D10)' },
        { node: '3v3', label: 'SENSOR VCC' },
      ],
      decode: 'i2c',
      span: 0.001,
    },
  },

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: the DMM reads {0}. Upload the sketch to bring the lamp up.' },
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: the DMM reads {0}; the gate switches at {2}; SCL rises in {4}. Something on this board is wrong: find it with the instruments.' },
    { when: { kind: 'above', readout: 5, value: 0 }, text: 'I²C NACKS ({5}): the sensor stopped answering. Check its supply ({6}) and the pull-ups, then look at the bus.' },
  ],

  failures: [
    {
      id: 'cold-joint',
      label: 'Cold joint on the sensor\'s VCC pin',
      explain:
        'The joint makes and breaks contact at random. In a bad spell it is about 1.2 kΩ, the sensor\'s 3.9 mA drops most of the 5 V across it, and SENSOR VCC falls to about 2.0 V: below the MPU-6050\'s 2.375 V minimum, so it stops answering and the analyzer counts NACKs in bursts. The 1 s meter average barely moves, and an analyzer lane on VCC at a 1.5 V threshold stays HIGH all the time, because 2.0 V is above 1.5 V. Set the threshold to 2.5 V, or use the scope in normal trigger on VCC falling, and each dropout appears. Intermittent faults need an instrument that captures the moment: a trigger, a counter or a long record. A meter reading never does.',
      patches: [{ op: 'set', elementId: 'behavior:joint', key: 'active', value: 1 }],
    },
    {
      id: 'no-pullup',
      label: 'The SDA pull-up was never fitted',
      explain:
        'With no pull-up nothing can make SDA HIGH: the DMM on SDA reads about 0 V, the scope shows a flat line at 0 V and the analyzer shows SDA stuck LOW with SCL still clocking, and no START. Every transaction is NACKed and the lamp goes dark ("sensor lost"). A line that idles LOW on an open-drain bus is a missing pull-up until proven otherwise: measure the idle level first, it takes five seconds.',
      patches: [{ op: 'remove', elementId: 'r_sda' }],
      parts: { hide: ['r_sda'] },
    },
    {
      id: 'small-reg',
      label: 'A 78L05 fitted instead of the LM7805',
      explain:
        'The 78L05 is a 100 mA part that current-limits at about 140 mA. The Uno and sensor take about 50 mA, so while the lamp is off the rail holds 5.0 V. On every lamp pulse the demand is about 0.38 A, the regulator limits and the rail falls to about 3.7 V. The DMM averages a 490 Hz waveform and shows a plausible-looking 4.3 V. The scope on the rail shows the truth: a square wave between 5.0 and 3.7 V, in step with the gate. 3.7 V is also below the 3.78 V the ATmega328P needs at 16 MHz. Fix: a regulator rated for the load (and its heat), and measure rails under the worst-case load, not at idle.',
      patches: [
        { op: 'set', elementId: 'reg', key: 'iLimit', value: 0.14 },
        { op: 'set', elementId: 'reg', key: 'dropout', value: 1.7 },
        { op: 'set', elementId: 'reg', key: 'iq', value: 0.003 },
      ],
      parts: { hide: ['reg'], show: ['reg_small'] },
    },
    {
      id: 'swapped-wires',
      label: 'Swap the gate and heartbeat wires',
      explain:
        'The gate wire went into pin 10 and the heartbeat wire into pin 9. The lamp now blinks at 1 Hz, full on or off, and the heartbeat LED glows at the lamp\'s brightness. The code is right and the parts are good. Split the path in half: pin 9 at the Uno header still carries 490 Hz PWM, the gate does not, so the fault is between them, in the wiring. Two measurements found it, without opening the code.',
      patches: [
        { op: 'remove', elementId: 'w_lamp' },
        { op: 'remove', elementId: 'w_beat' },
        { op: 'add', element: { id: 'w_lamp_x', type: 'R', nodes: ['d10', 'gate'], value: 0.05, partId: 'w_lamp_x' } },
        { op: 'add', element: { id: 'w_beat_x', type: 'R', nodes: ['d9', 'beat'], value: 0.05, partId: 'w_beat_x' } },
      ],
      parts: { hide: ['w_lamp', 'w_beat'], show: ['w_lamp_x', 'w_beat_x'] },
    },
  ],

  meet: `**The method.** Debugging is a search, and instruments make it fast. Work from the outside in:

1. **Power first, with the meter.** Measure every rail at its load, not at the regulator. A board with a bad rail does everything wrong, and nothing else you measure means anything until the rails are right.
2. **Signals next, with the scope.** The meter shows one averaged number; the scope shows the shape in time. A 490 Hz PWM rail that jumps between 5.0 and 3.7 V reads a plausible **4.3 V** on a meter.
3. **Then the bus, with the logic analyzer.** It records many digital lines for a long time and decodes them: who was addressed, who ACKed, which byte came back.
4. **Isolate by halves.** Good at the input, bad at the output? Measure the middle. Each measurement halves the suspects: 16 possible places take only 4 measurements.

**Every instrument changes what it measures.**
- **Meter loading.** A DMM is about **10 MΩ**. On a 1 MΩ / 1 MΩ divider the bottom leg becomes 1 ‖ 10 = 0.909 MΩ, and the reading falls **4.8 %** (here 4.46 → 4.25 V). On low-impedance nodes, like a rail, the error is negligible.
- **Burden voltage.** An ammeter in series drops its own voltage: 1.8 mV/mA on a typical mA range is a 1.8 Ω resistor. In a lamp loop set by 5.6 Ω, it cuts the very current it measures by about a fifth.
- **Probe ×1 vs ×10.** A ×10 passive probe loads the tip with **10 MΩ ‖ about 10–15 pF**; on ×1 the scope's 1 MΩ ‖ ~15 pF input sees the whole cable too, about **1 MΩ ‖ 100 pF**. On a 4.7 kΩ I²C pull-up with 100 pF of bus, the rise time 0.8473·R·C goes from 398 ns to **446 ns** with a ×10 probe and to **797 ns** with ×1. A ×1 probe also cuts the bandwidth to a few MHz. Use ×10 unless the signal is a few mV.
- **The analyzer's threshold.** A logic analyzer decides HIGH or LOW against one threshold, often around 1.5 V. A marginal 2.0 V level reads as a perfect HIGH. It cannot show "almost": for levels, use the scope.
- **The scope ground clip.** On a mains-earthed bench scope, the ground clip *is* mains earth. Clip it to anything that is not at earth potential, such as a node in a mains-powered circuit without an isolation transformer, and you short that node to earth through the probe: a bang, a burnt probe lead or worse. Measure between two points with two channels and A − B, or a differential probe. Never "float" a scope by removing its earth.`,

  mechanicalAnalogy: `Debugging a board is like diagnosing a hydraulic press that "sometimes" loses pressure. First check the pump's supply pressure under load (the rails). Then put a fast transducer on the line and watch the pressure trace in time (the scope). Then read the controller's event log (the analyzer). Finally, close a valve halfway along the line, and check each half on its own (isolate by halves). Every gauge you fit takes a little flow: a gauge with a long, soft hose (a ×1 probe) damps the very spikes you wanted to see.

**Where it breaks:** a pressure gauge on the wrong port rarely destroys the machine. A scope ground clip on the wrong node of a mains-powered circuit is a direct short to earth.`,

  proTips: [
    'Before you measure, predict the reading. If the instrument disagrees, either the circuit or your model of it is wrong, and both are worth knowing.',
    'Measure rails at the load (the chip\'s pins) and under the worst-case load: full brightness, motor stalled, radio transmitting.',
    'Write every measurement down with where and how you took it. Debugging is a search, and the log stops you searching the same place twice.',
    'An intermittent fault needs a capture: a scope in normal (single) trigger, an analyzer with a long record, or a counter. Tap and heat parts gently (a freeze spray or a hot-air pencil) while watching it.',
    'Keep the ×10 probe\'s ground lead short on fast edges, and never clip a bench scope\'s ground to a mains-referenced node.',
  ],

  quiz: [
    {
      q: 'A 10 MΩ DMM measures the midpoint of a 1 MΩ / 1 MΩ divider on 9 V. About what does it read?',
      options: ['4.50 V', '4.29 V', '4.09 V', '3.00 V'],
      answer: 1,
      why: 'The bottom leg becomes 1 MΩ ‖ 10 MΩ = 0.909 MΩ, so 9 × 0.909 / 1.909 ≈ 4.29 V, 4.8 % low.',
    },
    {
      q: 'An I²C line with a 4.7 kΩ pull-up and 100 pF of bus capacitance. What does a ×1 probe (≈ 100 pF) do to its 30–70 % rise time?',
      options: ['Nothing measurable', 'About +10 % (398 → 446 ns)', 'About doubles it (398 → 797 ns)', 'Makes it ten times faster'],
      answer: 2,
      why: 't_r = 0.8473 × 4.7 kΩ × (100 + 100) pF ≈ 797 ns. A ×10 probe adds only about 12 pF: 446 ns.',
    },
    {
      q: 'A 5 V rail feeds a PWM lamp. The DMM reads 4.3 V. What do you do next?',
      options: ['Replace the DMM', 'Put the scope on the rail and look at it in time', 'Raise the PWM duty', 'Trust it: 4.3 V is within 15 %'],
      answer: 1,
      why: 'A meter averages. 4.3 V can be a steady 4.3 V or a rail jumping between 5.0 and 3.7 V on every lamp pulse; only the scope tells you which.',
    },
    {
      q: 'Pin 9 carries 490 Hz PWM at the Uno header, but the MOSFET gate shows a 1 Hz square wave. Where is the fault?',
      options: ['In the sketch', 'In the MOSFET', 'Between the header and the gate: the wiring', 'In the regulator'],
      answer: 2,
      why: 'Isolate by halves: good at one end, wrong at the other, so the fault is in between. The 1 Hz signal is another pin\'s heartbeat: swapped wires.',
    },
    {
      q: 'Why is clipping a bench scope\'s ground lead to a node of a mains-powered, non-isolated circuit dangerous?',
      options: ['The probe tip is not rated for it', 'The ground clip is tied to mains earth, so it shorts that node to earth', 'It changes the trigger level', 'It only matters on ×1'],
      answer: 1,
      why: 'The scope\'s ground clip is connected to mains earth through its power cord. Use two channels with A − B, or a differential probe.',
    },
  ],

  guide: [
    {
      id: 'power-up',
      title: 'Power up, rail first',
      body: 'Press **Plug in 9 V**, then **Upload** the sketch. The DMM sits on the 5 V test point: it reads about **5.0 V**. Power comes first, because nothing else is worth measuring on a bad rail.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'upload' }, { kind: 'status', is: 'RUNNING' }, { kind: 'readout', index: 0, above: 4.85, below: 5.15, holdMs: 300 }] },
      focus: { control: 'upload' },
      hint: 'Plug in first (top left), then Upload.',
      explain: 'The LM7805 holds 5.0 V while the lamp draws about 0.33 A on each pulse. Its 2 V dropout needs at least 7 V in; the 9 V adapter gives it room.',
    },
    {
      id: 'meter-loading',
      title: 'The meter is a load',
      body: 'Set **DMM leads** to **VIN SENSE**, the middle of a 1 MΩ / 1 MΩ divider on the adapter. It should be about 4.46 V; the DMM reads about **4.25 V**.',
      check: { kind: 'all', of: [{ kind: 'tweak', target: 'DMM leads', min: 3, max: 3 }, { kind: 'readout', index: 0, above: 4.0, below: 4.4, holdMs: 300 }] },
      focus: { control: 'tweak:DMM leads' },
      explain: 'The meter\'s 10 MΩ in parallel makes the bottom leg 0.909 MΩ: 4.8 % low. It is no error on the 5 V rail, a big one on a high-impedance node. A buffer, or a meter with a >1 GΩ range, avoids it.',
    },
    {
      id: 'sag',
      title: 'Fault 1: the sagging rail',
      body: 'Open **Break something** and choose **A 78L05 fitted instead of the LM7805**. Put the **DMM leads** back on the **5 V rail**: it reads about **4.3 V**. Low, but is it low all the time?',
      check: {
        kind: 'all',
        of: [{ kind: 'break', failure: 'small-reg' }, { kind: 'tweak', target: 'DMM leads', max: 0 }, { kind: 'readout', index: 0, above: 3.9, below: 4.6, holdMs: 500 }],
      },
      focus: { control: 'break' },
      explain: 'A meter averages over about half a second. 4.3 V could be a steady 4.3 V, or a rail jumping between two levels 490 times a second. Only a picture in time tells you which.',
    },
    {
      id: 'scope',
      title: 'Look at it in time: the scope',
      body: 'Switch on **Instruments**. CH1 is the MOSFET gate: a square wave at **490 Hz** (**GATE FREQ**). CH2 is the 5 V rail: it drops to about **3.7 V** on every gate pulse and recovers in between.',
      check: { kind: 'all', of: [{ kind: 'instruments' }, { kind: 'readout', index: 2, above: 420, below: 560, holdMs: 300 }] },
      focus: { control: 'instruments' },
      explain: 'The 78L05 limits at about 140 mA. The lamp pulse needs about 0.38 A in total, so the regulator gives up and the rail falls until the load takes only 140 mA. 3.7 V is also below the 3.78 V the Uno needs at 16 MHz.',
    },
    {
      id: 'halves',
      title: 'Fault 2: isolate by halves',
      body: 'Choose **Swap the gate and heartbeat wires**. The lamp now blinks. **PIN 9 FREQ**, at the Uno header, still reads about **490 Hz**; **GATE FREQ**, at the far end, reads about **1 Hz**. Good at one end, bad at the other: the fault is in between.',
      check: {
        kind: 'all',
        of: [{ kind: 'break', failure: 'swapped-wires' }, { kind: 'readout', index: 3, above: 420, below: 560, holdMs: 500 }, { kind: 'readout', index: 2, below: 5, holdMs: 500 }],
      },
      focus: { control: 'break' },
      explain: 'Two measurements cleared the code (pin 9 is right) and the MOSFET (its gate gets the wrong signal), leaving the wiring. The 1 Hz on the gate is the heartbeat from pin 10: the two wires are swapped.',
    },
    {
      id: 'probe-x1',
      title: 'The probe is a load too',
      body: 'Pick **Logic analyzer** in the panel. Then set **Scope probe on SCL** to **×1**. **I²C RISE (SCL)** goes from 446 ns to about **797 ns**, and the SCL edges on the analyzer lean further over.',
      check: { kind: 'all', of: [{ kind: 'tweak', target: 'Scope probe on SCL', min: 2 }, { kind: 'readout', index: 4, above: 7e-7, below: 9e-7, holdMs: 300 }] },
      focus: { control: 'tweak:Scope probe on SCL' },
      hint: 'The bench scope samples every 0.1 ms, far too slowly to draw a 400 ns edge, so read the edge on the analyzer and in I²C RISE.',
      explain: 't_r = 0.8473 × 4.7 kΩ × (100 + 100) pF ≈ 797 ns. On ×10 the probe adds 12 pF (446 ns). Leave probes on ×10 unless you need the sensitivity.',
    },
    {
      id: 'cold-joint',
      title: 'Fault 3: the intermittent',
      body: 'Choose **Cold joint on the sensor\'s VCC pin**. Now and then **I²C NACKS** jumps and the lamp flickers off. Watch the **SENSOR VCC** lane: at 1.5 V it never moves. Set **Analyzer threshold** to **2.5 V**, and the dropouts appear.',
      check: {
        kind: 'all',
        of: [{ kind: 'break', failure: 'cold-joint' }, { kind: 'tweak', target: 'Analyzer threshold', min: 2.5 }, { kind: 'readout', index: 5, above: 0 }],
      },
      focus: { control: 'break' },
      hint: 'The joint breaks every half second or so, on average. Give it a few seconds.',
      explain: 'In a bad spell the sensor\'s VCC falls to about 2.0 V: too low for the MPU-6050 (2.375 V minimum), yet above a 1.5 V threshold, so the analyzer drew a perfect HIGH. An analyzer only shows HIGH or LOW. Check levels with the scope.',
    },
    {
      id: 'repair',
      title: 'Repair',
      body: 'Choose **Repair all**: the right regulator, the wires straightened, the joint reflowed. The rail holds 5.0 V, the gate is back at 490 Hz and **I²C NACKS** reads 0.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'repair' }, { kind: 'status', is: 'RUNNING' }, { kind: 'readout', index: 5, below: 0.5 }] },
      focus: { control: 'break' },
      explain: 'The fourth fault in the menu, a missing SDA pull-up, gives the stuck-LOW line: try it with the DMM on SDA and the analyzer open.',
    },
    { id: 'quiz', title: 'Check yourself', body: 'Answer the questions below.', check: { kind: 'quiz' }, focus: { control: 'quiz' } },
  ],
}
