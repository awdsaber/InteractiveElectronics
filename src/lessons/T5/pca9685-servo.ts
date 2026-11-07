// T5 · PCA9685 Servo Driver (video Fig. 08). Source: docs/curriculum/T5/pca9685-servo.md
//
// The PCA9685's outputs are not simulated as waveforms. The `pca9685` behavior is the chip's
// register file on the Uno's I²C bus (Wire / the Adafruit library class), works out each
// channel's pulse width from PRE_SCALE, LEDn_ON/OFF and the real oscillator, slews four servo
// models and sets each servo's supply draw (s0..s3, resistors across V+). The servo supply is
// its own PSU; `gnd_link` is the common ground between its negative and the Uno's ground.
import type { LessonDef } from '../../engine/types'
import { PITCH, jumper } from '../layout'

// ── bench layout (one 17 × 10 bench PCB; y = 0 is its top) ──
const UNO_AT: [number, number] = [-4.7, 0.6] // rot 0: USB toward the viewer, analog + power headers face +x
const BRD: [number, number] = [2.9, 0.9] // the PCA9685 breakout, 6.2 × 2.5
const BRD_W = 6.2
const BRD_D = 2.5
const BRD_TOP = 0.16 // module slab on the bench PCB (no standoff)
const HDR_TOP = BRD_TOP + 0.85 // header-male pin tops on the breakout
const UNO_HDR_Y = 0.16 + 0.85 // Uno female header tops
const SERVO_Z = -3.3
const SERVO_X = [-0.6, 1.0, 2.6, 4.2]
const START_DEG = [20, 160, 45, 135] // where each horn happens to sit before power-up
const LOGIC: [number, number] = [BRD[0] - BRD_W / 2 + 0.3, BRD[1]] // 6-pin logic header, left edge
const SERVO_HDR_Z = BRD[1] - BRD_D / 2 + 0.3 // 16 × 3 servo header, back edge (PWM row nearest the servos)
const TERM: [number, number] = [BRD[0] - 0.4, BRD[1] + BRD_D / 2 - 0.45] // V+ screw terminal, front edge
const PSU: [number, number] = [2.6, 3.9]

/** Uno analog socket A0..A5 (rot 0: the header sits on the +x edge, A0 toward the viewer) */
const unoAnalog = (i: number): [number, number, number] => [UNO_AT[0] + 2.4, UNO_HDR_Y, UNO_AT[1] - (1.95 + (i - 2.5) * PITCH)]
/** Uno power socket (NC, IOREF, RST, 3V3, 5V, GND, GND, VIN) */
const unoPower = (k: number): [number, number, number] => [UNO_AT[0] + 2.4, UNO_HDR_Y, UNO_AT[1] - (-0.35 + (k - 3.5) * PITCH)]
/** logic header pin (rot -90, GND at the back): GND OE SCL SDA VCC V+ */
const logicPin = (i: number): [number, number, number] => [LOGIC[0], HDR_TOP, LOGIC[1] + (i - 2.5) * PITCH]
/** servo channel n's PWM pin (the back row) */
const pwmPin = (n: number): [number, number, number] => [BRD[0] + (n - 7.5) * PITCH, HDR_TOP, SERVO_HDR_Z - PITCH]
/** a servo's cable end (servo rot 90: the leads run toward +z) */
const servoLead = (n: number): [number, number, number] => [SERVO_X[n], 0.06, SERVO_Z + 2.5]
/** V+ terminal wire entries (+ at the left) */
const termEntry = (k: 0 | 1): [number, number, number] => [TERM[0] + (k ? 0.254 : -0.254), BRD_TOP + 0.3, TERM[1] + 0.4]
/** PSU output leads, on the PSU's back edge */
const psuOut = (k: 0 | 1): [number, number, number] => [PSU[0] + (k ? 0.3 : -0.3), 0.16, PSU[1] - 0.8]

type Wire = ReturnType<typeof jumper>
const wire = (w: Wire, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })
const onBrd = (x: number, z: number): [number, number, number] => [x, BRD_TOP, z]

const sketch = `#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver(0x40);

#define SERVO_FREQ 50        // Hz: 20 ms frame
#define US_MIN 500           // pulse for 0 degrees (calibrate per servo)
#define US_MAX 2500          // pulse for 180 degrees
#define N_SERVOS 4

int phase = 0;

// 12-bit count for a pulse width at SERVO_FREQ: 4096 counts per 20 ms frame.
int usToTicks(float us) {
  int ticks = us * 4096.0 * SERVO_FREQ / 1000000.0;
  return ticks;
}

void setAngle(int ch, float deg) {
  deg = constrain(deg, 0, 180);
  float us = US_MIN + (US_MAX - US_MIN) * deg / 180.0;
  pwm.setPWM(ch, 0, usToTicks(us));    // rise at count 0, fall at count N
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  pwm.begin();
  pwm.setOscillatorFrequency(25000000);   // nominal. Calibrate on real boards.
  pwm.setPWMFreq(SERVO_FREQ);             // prescale = round(25e6/(4096*50)) - 1 = 121
  Wire.setClock(400000);
  Serial.print("1.5 ms = ");
  Serial.print(usToTicks(1500));
  Serial.println(" ticks");
  for (int ch = 0; ch < N_SERVOS; ch++) {
    setAngle(ch, 90);                      // centre all, one at a time
    delay(300);                            // stagger the start-up surges
  }
}

void loop() {
  // Four servos follow a travelling triangle wave, 90 degrees apart in phase.
  for (int ch = 0; ch < N_SERVOS; ch++) {
    int p = (phase + ch * 25) % 100;       // 0..99
    float deg = 0;
    if (p < 50) {
      deg = 45 + p * 1.8;                  // 45 -> 135
    } else {
      deg = 135 - (p - 50) * 1.8;          // 135 -> 45
    }
    setAngle(ch, deg);
  }
  phase = (phase + 1) % 100;
  delay(20);                               // one update per 20 ms frame
}
`

const servo = (n: number) => ({
  id: `s${n}`,
  kind: 'servo' as const,
  pos: [SERVO_X[n], 0, SERVO_Z] as [number, number, number],
  rot: 90,
  mount: 'offboard' as const,
  label: `SERVO ${n}`,
  role:
    n === 0
      ? 'SG90-class micro servo on channel 0: 4.8–6 V, about 10 mA idle, a few hundred mA moving, a stall current often quoted around 0.65 A (measure yours).'
      : `Micro servo on channel ${n}, the same SG90 class.`,
  params: { angleKey: `pca9685.ch${n}_deg`, angle: START_DEG[n], callout: [0, 0.9, -0.6] },
  circuitIds: [`s${n}`],
})

const servoWire = (n: number) => ({
  id: `w_s${n}`,
  kind: 'wire' as const,
  ...wire(jumper(servoLead(n), pwmPin(n), n % 2 ? 'brown' : 'orange', 0.5), [0, 0.5, 0]),
  mount: 'offboard' as const,
  role: `Servo ${n}'s cable (GND, V+, signal) into the channel ${n} header.`,
})

export const lesson: LessonDef = {
  id: 'pca9685-servo',
  fig: 8,
  track: 'T5',
  title: 'PCA9685 Servo Driver',
  subtitle: '16 servos, two wires',
  tagline: 'One I²C address drives 16 independent 12-bit PWM channels. At 50 Hz a 1.5 ms servo pulse is a count of 307 out of 4096.',

  board: {
    name: 'SERVO BENCH',
    size: [17, 10],
    base: 'mat',
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], 0, UNO_AT[1]],
        mount: 'module',
        label: 'UNO',
        role: 'The I²C master: A4 is SDA, A5 is SCL. USB powers it and the PCA9685\'s logic (VCC).',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [-1.2, 0.6, -1.2] },
        circuitIds: ['pin_sda', 'pin_scl', 'v_usb', 'f1', 'r_board'],
      },
      {
        id: 'brd',
        kind: 'module',
        pos: [BRD[0], 0, BRD[1]],
        mount: 'module',
        label: 'SERVO BOARD',
        role: 'The 62 × 25 mm breakout: PWM chip, 16 servo headers, logic header and the V+ terminal.',
        params: { w: BRD_W, d: BRD_D, pins: 0, chip: 'none', title: 'PCA9685 16-CH  SERVO DRIVER', color: '#1d4a8c', callout: [1.2, 0.2, 2.0] },
      },
      {
        id: 'u1',
        kind: 'ic-smd',
        pos: onBrd(BRD[0] + 0.3, BRD[1] + 0.2),
        mount: 'smd',
        label: 'PCA9685',
        role: '16-channel, 12-bit PWM controller with an internal 25 MHz oscillator, I²C up to 1 MHz (NXP, TSSOP-28).',
        params: { package: 'SOIC', pins: 28, marking: 'PCA9685', callout: [-1.2, 2.4, -1.2] },
        circuitIds: ['r_pca'],
      },
      {
        id: 'r_ser',
        kind: 'resistor-smd',
        pos: onBrd(BRD[0] - 0.5, SERVO_HDR_Z + 0.55),
        mount: 'smd',
        role: 'One of 16 series resistors: each limits fault current into a servo\'s signal pin.',
        params: { size: '0603', ohms: 220 },
      },
      {
        id: 'r_pu',
        kind: 'resistor-smd',
        pos: onBrd(LOGIC[0] + 0.55, BRD[1] + 0.05),
        rot: 90,
        mount: 'smd',
        label: 'I²C PULL-UP',
        role: 'Two 10 kΩ pull-ups from SDA and SCL to VCC. Many breakouts fit them; check yours.',
        params: { size: '0603', ohms: 10_000, callout: [0.6, 1.0, 2.6] },
        circuitIds: ['r_sda', 'r_scl'],
      },
      {
        id: 'jp_addr',
        kind: 'logic-ic-label',
        pos: onBrd(BRD[0] + 2.1, BRD[1] + 0.25),
        mount: 'smd',
        label: 'ADDR',
        role: 'Solder jumpers A0–A5: bridging one adds 1, 2, 4, 8, 16 or 32 to the base address 0x40.',
        params: { text: 'A0 A1 A2 A3 A4 A5', size: 0.13, callout: [2.2, 0.6, 0.4] },
        circuitIds: ['r_a0'],
      },
      {
        id: 'led_pwr',
        kind: 'led-smd',
        pos: onBrd(BRD[0] + BRD_W / 2 - 0.4, BRD[1] + BRD_D / 2 - 0.35),
        mount: 'smd',
        role: 'Logic power indicator.',
        params: { color: 'red', size: '0603' },
      },
      {
        id: 'hdr_logic',
        kind: 'header-male',
        pos: onBrd(LOGIC[0], LOGIC[1]),
        rot: -90,
        mount: 'tht',
        label: 'LOGIC',
        role: 'GND, OE, SCL, SDA, VCC, V+ to the Uno. OE (active LOW, pulled low on the board) disables every output when driven HIGH.',
        params: { pins: 6, callout: [-0.8, 2.2, -0.8] },
      },
      {
        id: 'hdr_servo',
        kind: 'header-male',
        pos: onBrd(BRD[0], SERVO_HDR_Z + PITCH / 2),
        mount: 'tht',
        label: 'CH 0–15',
        role: 'Servo plugs, 16 × 3: this part is the GND and V+ rows.',
        params: { pins: 16, rows: 2, callout: [0.8, 1.0, -0.6] },
      },
      {
        id: 'hdr_pwm',
        kind: 'header-male',
        pos: onBrd(BRD[0], SERVO_HDR_Z - PITCH),
        mount: 'tht',
        role: 'The PWM row of the servo headers, one signal pin per channel.',
        params: { pins: 16 },
      },
      {
        id: 'tb_vplus',
        kind: 'screw-terminal',
        pos: onBrd(TERM[0], TERM[1]),
        mount: 'tht',
        label: 'V+',
        role: 'Servo power input, separate from the logic VCC. The board joins its − to GND.',
        params: { pins: 2, callout: [0, 0.6, 1.4] },
      },
      {
        id: 'c_bulk',
        kind: 'capacitor-electrolytic',
        pos: onBrd(TERM[0] + 1.3, TERM[1] - 0.1),
        mount: 'tht',
        label: 'BULK',
        role: '470 µF, 10 V across V+. Rough guide: about 100 µF per servo, for the start-up surges.',
        params: { d: 0.8, h: 1.3, callout: [1.4, 0.4, 1.0] },
        circuitIds: ['c_bulk'],
      },
      {
        id: 'psu',
        kind: 'module',
        pos: [PSU[0], 0, PSU[1]],
        mount: 'offboard',
        label: '5V 4A',
        role: 'The dedicated servo supply: 5 V, 4 A, about 0.05 Ω output resistance (approximate).',
        params: { w: 3.4, d: 1.5, pins: 0, chip: 'none', title: '5 V 4 A PSU', color: '#3b3f46', callout: [-1, 0.5, 1.6] },
        circuitIds: ['psu', 'psu_sw'],
      },
      servo(0),
      servo(1),
      servo(2),
      servo(3),
      { id: 'w_sda', kind: 'wire', ...wire(jumper(unoAnalog(4), logicPin(3), 'blue', 0.7), [0, 0.7, 0]), mount: 'offboard', role: 'A4 to SDA.' },
      { id: 'w_scl', kind: 'wire', ...wire(jumper(unoAnalog(5), logicPin(2), 'yellow', 0.9), [0, 0.8, -0.3]), mount: 'offboard', role: 'A5 to SCL.' },
      { id: 'w_vcc', kind: 'wire', ...wire(jumper(unoPower(4), logicPin(4), 'red', 0.5), [0, 0.6, 0.3]), mount: 'offboard', role: 'Uno 5 V to the PCA9685\'s logic supply VCC.' },
      {
        id: 'w_gnd',
        kind: 'wire',
        ...wire(jumper(unoPower(5), logicPin(0), 'black', 0.35), [0.8, 0.3, 1.6]),
        mount: 'offboard',
        label: 'COMMON GND',
        role: 'The common ground: Uno GND to the board GND, which the board joins to the servo supply\'s negative.',
        circuitIds: ['gnd_link'],
      },
      { id: 'w_vp', kind: 'wire', ...wire(jumper(psuOut(0), termEntry(0), 'red', 0.4), [0, 0.5, 0]), mount: 'offboard', role: 'PSU + to V+.' },
      { id: 'w_vn', kind: 'wire', ...wire(jumper(psuOut(1), termEntry(1), 'black', 0.4), [0, 0.5, 0]), mount: 'offboard', role: 'PSU − to the terminal\'s −.' },
      servoWire(0),
      servoWire(1),
      servoWire(2),
      servoWire(3),
    ],
  },

  circuit: {
    elements: [
      // USB 5 V: the Uno (≈ 45 mA) and the PCA9685 logic (a few mA, approximate)
      { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5, rInternal: 0.3, partId: 'uno' },
      { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', 'vbus_in'], closed: true, partId: 'uno' },
      // polyfuse (MF-MSMF050-class: holds 0.5 A, trips by 1 A): a thermal model that shuts off and
      // resets once cool. Time-compressed: trips in about a second at 1 A.
      { id: 'f1', type: 'R', nodes: ['vbus_in', '5v'], value: 0.3, rating: { rth: 600, tauTh: 1.5, tMax: 125, failMode: 'shutdown' }, partId: 'uno' },
      { id: 'r_board', type: 'R', nodes: ['5v', '0'], value: 111, partId: 'uno' },
      { id: 'r_pca', type: 'R', nodes: ['5v', '0'], value: 833, rating: { maxV: 6 }, partId: 'u1' },
      // I²C: open-drain lines pulled up on the breakout
      { id: 'r_sda', type: 'R', nodes: ['5v', 'sda'], value: 10e3, partId: 'r_pu' },
      { id: 'r_scl', type: 'R', nodes: ['5v', 'scl'], value: 10e3, partId: 'r_pu' },
      { id: 'pin_sda', type: 'PIN', nodes: ['sda', '0'], pin: 18, vcc: 5, partId: 'uno' },
      { id: 'pin_scl', type: 'PIN', nodes: ['scl', '0'], pin: 19, vcc: 5, partId: 'uno' },
      // address jumper A0: on-board pull-down; bridging the jumper ties it to VCC
      { id: 'r_a0', type: 'R', nodes: ['a0', '0'], value: 10e3, partId: 'jp_addr' },
      // the servo supply and the common ground
      { id: 'psu', type: 'V', nodes: ['psu_p', 'psu_n'], value: 5, rInternal: 0.05, partId: 'psu' },
      { id: 'psu_sw', type: 'SW', nodes: ['psu_p', 'vplus'], closed: true, partId: 'psu' },
      { id: 'gnd_link', type: 'R', nodes: ['psu_n', '0'], value: 0.01, partId: 'w_gnd' },
      { id: 'c_bulk', type: 'C', nodes: ['vplus', 'psu_n'], value: 470e-6, polarized: true, rating: { maxV: 10 }, partId: 'c_bulk' },
      // four servos' supply draw, set by the behavior (value = V+ / I)
      { id: 's0', type: 'R', nodes: ['vplus', 'psu_n'], value: 500, rating: { maxV: 7.2 }, partId: 's0' },
      { id: 's1', type: 'R', nodes: ['vplus', 'psu_n'], value: 500, rating: { maxV: 7.2 }, partId: 's1' },
      { id: 's2', type: 'R', nodes: ['vplus', 'psu_n'], value: 500, rating: { maxV: 7.2 }, partId: 's2' },
      { id: 's3', type: 'R', nodes: ['vplus', 'psu_n'], value: 500, rating: { maxV: 7.2 }, partId: 's3' },
    ],
  },
  powerElementId: 'usb_plug',
  powerLabel: 'Plug USB',
  extraPower: [{ elementId: 'psu_sw', label: 'Switch on servo PSU' }],
  transient: true,

  behaviors: [
    {
      id: 'pca9685',
      params: {
        addr: 0x40,
        addrNodes: 'a0',
        vdd: '5v',
        sda: 'sda',
        scl: 'scl',
        vplus: 'vplus',
        servoGnd: 'psu_n',
        servos: 's0,s1,s2,s3',
        startDeg: START_DEG.join(','),
        load: 0.3,
        oscActual: 25e6,
        borNode: '5v',
        bor: 2.7,
      },
    },
  ],

  readouts: [
    { label: 'PWM FREQ (ACTUAL)', source: { kind: 'behavior', key: 'pca9685.freq_actual' }, unit: 'Hz', digits: 4 },
    { label: 'CH0 PULSE', source: { kind: 'behavior', key: 'pca9685.ch0_s' }, unit: 's', digits: 4 },
    { label: 'CH0 ANGLE', source: { kind: 'behavior', key: 'pca9685.ch0_deg' }, unit: '°' },
    { label: 'SERVO RAIL V+', source: { kind: 'voltage', node: 'vplus', ref: 'psu_n' }, unit: 'V' },
    { label: 'SERVO CURRENT', source: { kind: 'behavior', key: 'pca9685.servo_A_total' }, unit: 'A' },
    { label: 'UNO 5V', source: { kind: 'voltage', node: '5v' }, unit: 'V' },
    { label: 'I²C NACKS', source: { kind: 'behavior', key: 'pca9685.i2c_errors' }, unit: '', digits: 1 },
  ],

  sketch: { title: 'Walking wave', code: sketch, pins: { 18: 'pin_sda', 19: 'pin_scl' }, vcc: 5, board: 'uno' },

  tweaks: [
    { label: 'PSU internal R', elementId: 'psu', key: 'rInternal', min: 0.02, max: 2, log: true, unit: 'Ω' },
    { label: 'Real oscillator', elementId: 'behavior:pca9685', key: 'oscActual', min: 23e6, max: 27e6, step: 1e5, unit: 'Hz' },
    { label: 'Horn load', elementId: 'behavior:pca9685', key: 'load', min: 0, max: 1, step: 0.05, unit: '× stall torque' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: switch on the servo PSU, then upload the sketch. The Uno and the PCA9685 logic run from USB; the servos only from V+.' },
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: four servos ripple through a wave, one I²C command per channel per frame. Frame {0}, CH0 {1} → {2}, {4} from V+.' },
    { when: { kind: 'below', readout: 3, value: 4.5 }, text: 'WARNING: servo rail sagging ({3}) under the surge: add capacitance or a stiffer supply.' },
    { when: { kind: 'below', readout: 3, value: 0.5 }, text: 'The servo PSU is off: the PCA9685 is sending pulses, but the servos have no power. Switch on the servo PSU.' },
    { when: { kind: 'below', readout: 5, value: 4.0 }, text: 'WARNING: Uno 5 V is collapsing ({5}): brown-out reset ahead.' },
    { when: { kind: 'above', readout: 6, value: 0.5 }, text: 'WARNING: {6} I²C transactions not acknowledged: check the pull-ups, VCC and the address.' },
  ],

  failures: [
    {
      id: 'servos-on-uno-5v',
      label: 'Power the servos from the Uno\'s 5 V pin',
      explain:
        'Four servos holding their horns against a small load draw about 1 A in total, and every move-start surge adds up to 0.65 A per servo. Through USB and the Uno\'s 0.6 Ω path (USB source plus polyfuse) the 5 V rail sags to about 4.3 V, and the polyfuse (rated to hold 0.5 A) heats up and trips within about a second. The 5 V rail collapses, the Uno browns out below 2.7 V and resets, the PCA9685 loses its registers, and when the fuse cools everything starts again: setup() centres the servos, the current climbs, and the fuse trips again. That is a boot loop. A USB 2.0 port only promises 500 mA. Give the servos their own supply with a common ground, plus bulk capacitance.',
      patches: [
        { op: 'remove', elementId: 'psu_sw' },
        { op: 'remove', elementId: 'gnd_link' },
        { op: 'add', element: { id: 'vplus_from_uno', type: 'R', nodes: ['5v', 'vplus'], value: 0.05 } },
        { op: 'short', a: 'psu_n', b: '0' },
      ],
      parts: { hide: ['w_vp', 'w_vn'] },
    },
    {
      id: 'no-common-gnd',
      label: 'Forget the common ground',
      explain:
        'V+ still reads 5 V across the PSU and the PCA9685 is happily sending pulses, but the servos twitch at random or ignore the commands. A servo reads its signal pin relative to its own ground: when the servo supply\'s negative is not tied to the logic ground, the "pulse" has no defined reference and its return current has no path.',
      patches: [{ op: 'remove', elementId: 'gnd_link' }],
      parts: { hide: ['w_gnd'] },
    },
    {
      id: 'no-pullups',
      label: 'Use a breakout without I²C pull-ups',
      explain:
        'SDA and SCL sit near 0 V. Every pwm.* call goes unacknowledged (the I²C NACKS readout climbs), and the library does not tell the sketch. The chip keeps the last values it received, so servos that were already running freeze where they are; after a reset or a re-plug they never get a pulse at all and stay limp. I²C lines are open-drain, so devices only ever pull them low, and something has to pull them high, typically 2.2–10 kΩ. The Uno\'s internal pull-ups, which Wire enables, are 20–50 kΩ: too weak for 400 kHz on anything but a very short bus (the bench does not model them).',
      patches: [
        { op: 'remove', elementId: 'r_sda' },
        { op: 'remove', elementId: 'r_scl' },
      ],
      parts: { hide: ['r_pu'] },
    },
    {
      id: 'addr-jumper',
      label: 'Bridge the A0 address jumper by accident',
      explain:
        'The board now answers at 0x41, not 0x40. The sketch still talks to 0x40, so every transaction is not acknowledged (NACK): servos that were already running freeze at their last command, and after a reset they never get a pulse. Nothing reports it: the Adafruit library ignores the I²C status. An I²C scanner sketch, or checking the return value of setPWM(), finds it at once.',
      patches: [{ op: 'short', a: 'a0', b: '5v' }],
    },
  ],

  meet: `A hobby servo wants a pulse **every 20 ms (50 Hz)**. The pulse width, not the duty, sets the angle: from about 0.5 ms to 2.5 ms depending on the model, with roughly 1.5 ms at centre. The PCA9685 makes 16 such signals by itself, so the Uno only sends I²C commands.

**Frequency:** prescale = round(25 MHz / (4096 × f)) − 1. For 50 Hz: 25 000 000 / (4096 × 50) = 122.07, which rounds to 122, minus 1 gives **121**. Actual: 25 MHz / (4096 × 122) = **50.03 Hz**. The internal oscillator is not precise, so real boards may run a few percent off. Measure the frame with a scope and correct it with \`setOscillatorFrequency\`. Try the *Real oscillator* slider at 26.5 MHz while the sketch still says 25 MHz: the frame runs 6 % fast, every pulse is 6 % short, and the servos shift by several degrees.

**Counts:** each frame is 4096 counts over 20 ms, or 4.88 µs per count. 1.5 ms = 1500 / 4.88 ≈ **307 counts**, and 0.5–2.5 ms is 102–512 counts. So a servo only uses about 10 % of the 12-bit range: about 410 steps over 180°, or 0.44° per count.

**Registers:** \`setPWMFreq\` puts the chip to sleep (MODE1.SLEEP, since PRE_SCALE only takes while asleep), writes PRE_SCALE, wakes it and turns on auto-increment (MODE1.AI). \`setPWM(ch, on, off)\` then writes the four LEDn_ON_L/H, LEDn_OFF_L/H bytes in one transaction: the output rises at count *on* and falls at count *off*.

**Addressing:** the base is 0x40, and the A0–A5 jumpers add 1, 2, 4, 8, 16, 32. Up to 62 boards (992 servos) can share one bus, with some addresses reserved (0x70 is All-Call).

**Power:** outputs sink 25 mA and source 10 mA, which is plenty for signals. Servo current comes from **V+**: SG90-class servos pull a few hundred mA moving and more when blocked. For 8 servos, plan for 8 × 0.65 A ≈ 5 A of peak capability.

*Sim note:* the outputs are not simulated as waveforms: the behavior reads the registers and works out each pulse width. Each servo is a slew-limited model (about 0.1 s per 60° at 4.8 V) whose supply current is an average: about 0.65 A at the start of a move, 0.25 A at full speed, 10 mA idle, plus the torque to hold the *Horn load* (0.3 × stall torque here, a small arm on each horn). Because the current is averaged, the bulk capacitor barely shows in the readouts; on a real board it feeds the motors' millisecond current pulses. The Uno's polyfuse is a time-compressed thermal model: it trips in about a second at 1 A, where a real one can take several seconds.`,

  mechanicalAnalogy: `The PCA9685 is a cam timer with 16 independent cams on one shaft. The shaft turns once every 20 ms, and each cam's lobe length (the on/off counts) sets how long its follower is lifted. The Uno is the technician who occasionally walks up and swaps a cam profile over a two-wire bus. The servo itself is a closed-loop position actuator: its internal potentiometer is the feedback and the pulse width is the setpoint.

**Where it breaks:** the 4096-count resolution is per frame, not per angle, so a servo uses only about 400 of those counts, a coarser "cam" than 12 bits suggests.`,

  proTips: [
    'Calibrate each servo\'s endpoints. Sweep writeMicroseconds slowly and note where it stops responding or starts buzzing against its end stop. Driving into the stop draws stall current continuously and wears out the gear train.',
    'Stagger start-up moves by 100–300 ms per servo, and fit bulk capacitance near the V+ terminal. Start-up surges, not the steady current, are what brown out supplies.',
    'Tie OE to a pin. Pulling it HIGH disables every output at once: a cheap, fast software "e-stop" that doesn\'t depend on the I²C bus.',
  ],

  quiz: [
    {
      q: 'What PCA9685 prescale value gives about 50 Hz with the 25 MHz internal oscillator?',
      options: ['30', '61', '121', '255'],
      answer: 2,
      why: 'round(25e6 / (4096 × 50)) − 1 = round(122.07) − 1 = 121.',
    },
    {
      q: 'At 50 Hz, how many counts (of 4096) make a 1.5 ms pulse?',
      options: ['75', '150', '307', '2048'],
      answer: 2,
      why: '1.5 ms / 20 ms × 4096 = 307.2, so 307.',
    },
    {
      q: 'A robot arm uses 6 servos that can each stall at about 0.65 A. What peak supply current should you design for?',
      options: ['0.65 A', '2 A', 'About 4 A', '20 A'],
      answer: 2,
      why: '6 × 0.65 ≈ 3.9 A worst case, so a 4–5 A supply. Steady state is lower, but surges and stalls are what you design for.',
    },
    {
      q: 'The A0 and A2 address jumpers are bridged. What is the board\'s I²C address?',
      options: ['0x40', '0x42', '0x45', '0x50'],
      answer: 2,
      why: '0x40 + 1 (A0) + 4 (A2) = 0x45.',
    },
  ],
}
