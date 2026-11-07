// T6 · MPU-6050 IMU (video Fig. 09). Source: docs/curriculum/T6/mpu6050-imu.md
//
// The `imu-mpu6050` behavior models the chip (gyro bias and noise, accelerometer gravity,
// vibration and noise, the DLPF, register-level I²C at 0x68/0x69) and runs a reference
// complementary filter for the readouts. The carrier's circuit (LDO, pull-ups, AD0 pull-down,
// power LED) is in the netlist, so the bus check reads real node voltages.
import type { LessonDef } from '../../engine/types'
import { PITCH, jumper } from '../layout'

// ── bench layout: one 13 × 10 PCB; the Uno on the left (rot 0: USB toward the viewer, analog and
// power headers on its +x edge, facing the IMU carrier); the shaker row along the back ──
const UNO_AT: [number, number] = [-2.6, 0.6]
const UNO_HEADER_Y = 0.16 + 0.85
/** Uno analog socket A0..A5 (rot 0: the module's local (x, z) lands at world (x0 + z, z0 − x)) */
const unoAnalog = (i: number): [number, number, number] => [UNO_AT[0] + 2.4, UNO_HEADER_Y, UNO_AT[1] - (1.95 + (i - 2.5) * PITCH)]
/** Uno power socket: 3 = 3V3, 4 = 5V, 5 = GND */
const unoPower = (k: number): [number, number, number] => [UNO_AT[0] + 2.4, UNO_HEADER_Y, UNO_AT[1] - (-0.35 + (k - 3.5) * PITCH)]
/** Uno digital socket D0..D7 */
const unoDigital = (pin: number): [number, number, number] => [UNO_AT[0] - 2.4, UNO_HEADER_Y, UNO_AT[1] - (2.35 + (3.5 - pin) * PITCH)]

// GY-521-style carrier: 8-pin header (rot 90: pins run along z), VCC first
const HDR: [number, number] = [2.4, 0.6]
const HDR_TOP = 0.85
const HDR_PINS = ['VCC', 'GND', 'SCL', 'SDA', 'XDA', 'XCL', 'AD0', 'INT'] as const
const hdrPin = (name: (typeof HDR_PINS)[number]): [number, number, number] => [HDR[0], HDR_TOP, HDR[1] - (HDR_PINS.indexOf(name) - 3.5) * PITCH]
const U1: [number, number] = [4.3, 0.6]

// shaker row at the back: R_B, Q1, D1, R_VIB, then the ERM motor (rot 180: terminals toward −x)
const ROW_Z = -4.1
const RB_X = -5.0
const Q1_X = -3.8
const D1_X = -2.6
const RV_X = -1.4
const MOT: [number, number] = [0.9, -3.9]
const LEAD = 0.508 // a resistor / diode at rot 0 spans 4 holes
const lead = (x: number, side: -1 | 1): [number, number, number] => [x + side * LEAD, 0.05, ROW_Z]
// dc-motor terminals: part-local (1.62, 1.115, ±0.42), rotated 180°
const MOT_T1: [number, number, number] = [MOT[0] - 1.62, 1.115, MOT[1] - 0.42]
const MOT_T2: [number, number, number] = [MOT[0] - 1.62, 1.115, MOT[1] + 0.42]

type Wire = ReturnType<typeof jumper>
const wire = (w: Wire, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const sketch = `#include <Wire.h>
#include <MPU6050.h>
// Real code (i2cdevlib): MPU6050 mpu;   The bench provides \`mpu\` at 0x68.

const float GYRO_SENS = 131.0;   // LSB per deg/s at +/-250 deg/s
const float DT = 0.01;           // 100 Hz loop
const float ALPHA = 0.98;        // tau = ALPHA*DT/(1-ALPHA) = 0.49 s
const int SHAKER = 6;

float gyroBias = 0;              // in raw counts
float pitchGyro = 0;             // gyro-only estimate (drifts)
float pitch = 0;                 // complementary-filter estimate
unsigned long nextTick = 0;

float accelPitch() {
  float ax = mpu.getAccelerationX();
  float az = mpu.getAccelerationZ();
  return atan2(-ax, az) * 180.0 / PI;
}

void calibrateGyro() {
  long sum = 0;
  for (int i = 0; i < 200; i++) {       // 1 s of samples, held still
    sum += mpu.getRotationY();
    delay(5);
  }
  gyroBias = sum / 200.0;
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  pinMode(SHAKER, OUTPUT);
  mpu.initialize();
  if (!mpu.testConnection()) {
    Serial.println("MPU-6050 not found at 0x68: check wiring, pull-ups, AD0");
    while (true) {
      delay(1000);
    }
  }
  mpu.setDLPFMode(3);                   // ~44 Hz bandwidth, ~5 ms delay
  Serial.println("Hold still: calibrating gyro");
  calibrateGyro();
  pitch = accelPitch();
  pitchGyro = pitch;
  nextTick = millis();
}

void loop() {
  // Fixed-rate loop: wait for the next 10 ms tick.
  long wait = nextTick - millis();
  if (wait > 0) {
    delay(wait);
  }
  nextTick += 10;

  float rate = (mpu.getRotationY() - gyroBias) / GYRO_SENS;   // deg/s
  float pa = accelPitch();

  pitchGyro = pitchGyro + rate * DT;                          // integrate only
  pitch = ALPHA * (pitch + rate * DT) + (1.0 - ALPHA) * pa;   // blend

  // Shaker: on for 3 s out of every 10 s.
  unsigned long phase = millis() % 10000;
  if (phase < 3000) {
    analogWrite(SHAKER, 200);
  } else {
    analogWrite(SHAKER, 0);
  }

  Serial.print("accel:");
  Serial.print(pa);
  Serial.print(",gyro:");
  Serial.print(pitchGyro);
  Serial.print(",filtered:");
  Serial.println(pitch);
}
`

export const lesson: LessonDef = {
  id: 'mpu6050-imu',
  fig: 9,
  track: 'T6',
  title: 'MPU-6050 IMU',
  subtitle: 'Gyro drifts, accel shakes',
  tagline: 'An uncorrected 2 °/s gyro bias becomes 120° of error in one minute, and a complementary filter with α = 0.98 at 100 Hz cancels it with a 0.5 s time constant.',

  board: {
    name: 'IMU BENCH',
    size: [13, 10],
    base: 'mat',
    traces: [
      // header → MPU-6050 (SCL, SDA, AD0) and the LDO
      [[HDR[0] + 0.15, hdrPin('SCL')[2]], [3.6, hdrPin('SCL')[2]], [3.9, U1[1] + 0.1]],
      [[HDR[0] + 0.15, hdrPin('SDA')[2]], [3.9, hdrPin('SDA')[2]]],
      [[HDR[0] + 0.15, hdrPin('AD0')[2]], [3.6, hdrPin('AD0')[2]], [3.9, -0.6]],
      [[HDR[0] + 0.15, hdrPin('VCC')[2]], [3.0, hdrPin('VCC')[2]], [3.3, 2.4]],
      [[3.7, 2.4], [4.0, 2.4]],
      [[4.6, 2.4], [4.9, 2.4]],
      // shaker row: base resistor → Q1 → R_VIB, D1 across the motor
      [[RB_X + LEAD, ROW_Z], [Q1_X - 0.1, ROW_Z]],
      [[Q1_X + 0.1, ROW_Z], [Q1_X + 0.3, ROW_Z + 0.5], [RV_X - LEAD, ROW_Z + 0.5], [RV_X - LEAD, ROW_Z]],
      [[D1_X - LEAD, ROW_Z], [D1_X - LEAD, ROW_Z + 0.5]],
    ],
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], 0, UNO_AT[1]],
        mount: 'module',
        label: 'UNO',
        role: 'I²C master on A4 (SDA) and A5 (SCL), runs the filter maths at 100 Hz, and drives the shaker from pin 6.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [0, 1.8, 1.2] },
        circuitIds: ['pin_sda', 'pin_scl', 'pin6', 'v_usb'],
      },
      {
        id: 'gy521',
        kind: 'logic-ic-label',
        pos: [4.3, 0, 3.5],
        mount: 'smd',
        label: 'GY-521',
        role: 'The carrier area of the common MPU-6050 breakout: sensor, 3.3 V LDO, pull-ups, AD0 pull-down and power LED.',
        params: { text: 'GY-521 · MPU-6050', size: 0.2, callout: [0.2, 0.6, 0.6] },
      },
      {
        id: 'u1',
        kind: 'ic-smd',
        pos: [U1[0], 0, U1[1]],
        mount: 'smd',
        label: 'MPU-6050',
        role: '3-axis gyro + 3-axis accelerometer with 16-bit ADCs and a digital low-pass filter. I²C at 0x68 (AD0 low) or 0x69 (AD0 high).',
        params: { package: 'QFN', pins: 24, marking: 'MPU\n6050', callout: [0.8, 1.8, 0.2] },
        circuitIds: ['i_mpu'],
      },
      {
        id: 'u2',
        kind: 'ic-smd',
        pos: [3.4, 0, 2.4],
        rot: 90,
        mount: 'smd',
        label: '3V3 LDO',
        role: 'A SOT-23-5 3.3 V regulator (often marked 662K) lets the board run from 5 V. The MPU-6050\'s own VDD range is 2.375–3.46 V.',
        params: { package: 'SOT-23-5', pins: 6, marking: '662K', callout: [-0.4, 1.3, 0.9] },
        circuitIds: ['ldo'],
      },
      {
        id: 'c_reg',
        kind: 'capacitor-smd',
        pos: [4.3, 0, 2.4],
        rot: 90,
        mount: 'smd',
        label: 'DECOUPLE',
        role: 'LDO and MPU decoupling, plus the MPU\'s REGOUT and CPOUT capacitors.',
        params: { size: '0603', callout: [0.3, 1.0, 1.1] },
      },
      {
        id: 'led_pwr',
        kind: 'led-smd',
        pos: [5.2, 0, 2.4],
        mount: 'smd',
        label: 'PWR',
        role: 'Power LED on the 3.3 V rail.',
        params: { color: 'red', size: '0603', callout: [0.8, 0.9, 0.8] },
        circuitIds: ['led_pwr'],
      },
      {
        id: 'r_pu',
        kind: 'resistor-smd',
        pos: [3.4, 0, -0.35],
        rot: 90,
        mount: 'smd',
        label: 'I²C PULL-UP',
        role: 'Two 4.7 kΩ pull-ups to 3.3 V on SDA and SCL (values vary by maker, 2.2–10 kΩ).',
        params: { size: '0603', ohms: 4700, callout: [-0.5, 1.3, -0.3] },
        circuitIds: ['r_sda', 'r_scl'],
      },
      {
        id: 'r_ad0',
        kind: 'resistor-smd',
        pos: [4.3, 0, -0.6],
        mount: 'smd',
        label: 'AD0',
        role: 'Pull-down on AD0: the default LOW gives address 0x68.',
        params: { size: '0603', ohms: 4700, callout: [1.2, 1.0, -0.4] },
        circuitIds: ['r_ad0'],
      },
      {
        id: 'hdr',
        kind: 'header-male',
        pos: [HDR[0], 0, HDR[1]],
        rot: 90,
        mount: 'tht',
        label: 'PINS',
        role: 'VCC, GND, SCL, SDA, XDA, XCL, AD0, INT.',
        params: { pins: 8, callout: [-0.4, 1.6, 1.4] },
      },
      {
        id: 'vib',
        kind: 'dc-motor',
        pos: [MOT[0], 0, MOT[1]],
        rot: 180,
        mount: 'offboard',
        label: 'SHAKER',
        role: 'A 3 V coin/ERM vibration motor (eccentric mass) on the bench PCB: it shakes the sensor to show the accelerometer\'s weakness.',
        params: { callout: [0.6, 1.6, 0.4] },
        circuitIds: ['vib'],
      },
      {
        id: 'r_b',
        kind: 'resistor',
        pos: [RB_X, 0, ROW_Z],
        mount: 'tht',
        label: 'BASE',
        role: '1 kΩ base resistor: pin 6 drives Q1 with about 4 mA.',
        params: { ohms: 1000, callout: [0, 0.9, 0.5] },
        circuitIds: ['r_b'],
      },
      {
        id: 'q1',
        kind: 'transistor-to92',
        pos: [Q1_X, 0, ROW_Z],
        mount: 'tht',
        label: 'NPN',
        role: '2N2222A: switches the shaker from pin 6.',
        params: { marking: '2N2222A', callout: [0, 1.4, 0.4] },
        circuitIds: ['q1'],
      },
      {
        id: 'd1',
        kind: 'diode',
        pos: [D1_X, 0, ROW_Z],
        mount: 'tht',
        label: 'FLYBACK',
        role: '1N4148 across the shaker: clamps its inductive kick when Q1 turns off.',
        params: { marking: '4148', callout: [0, 0.9, 0.5] },
        circuitIds: ['d_fly'],
      },
      {
        id: 'r_vib',
        kind: 'resistor',
        pos: [RV_X, 0, ROW_Z],
        mount: 'tht',
        label: 'LIMIT',
        role: '22 Ω current limit for the 3 V shaker on the 5 V rail.',
        params: { ohms: 22, callout: [0, 0.9, 0.5] },
        circuitIds: ['r_vib'],
      },
      { id: 'w_sda', kind: 'wire', ...wire(jumper(unoAnalog(4), hdrPin('SDA'), 'blue', 0.7), [0, 0.6, 0.2]), mount: 'offboard', role: 'A4 (SDA) to the carrier\'s SDA.' },
      { id: 'w_scl', kind: 'wire', ...wire(jumper(unoAnalog(5), hdrPin('SCL'), 'yellow', 0.9), [0, 0.7, -0.2]), mount: 'offboard', role: 'A5 (SCL) to the carrier\'s SCL.' },
      { id: 'w_vcc', kind: 'wire', ...wire(jumper(unoPower(4), hdrPin('VCC'), 'red', 0.6), [0, 0.6, 0.3]), mount: 'offboard', role: 'Uno 5 V to VCC: the carrier\'s LDO makes 3.3 V from it.' },
      { id: 'w_gnd', kind: 'wire', ...wire(jumper(unoPower(5), hdrPin('GND'), 'black', 0.5), [0, 0.5, 0]), mount: 'offboard', role: 'Uno GND to GND.' },
      { id: 'w_d6', kind: 'wire', ...wire(jumper(unoDigital(6), lead(RB_X, -1), 'green', 0.6), [-0.3, 0.6, 0]), mount: 'offboard', role: 'Pin 6 (PWM) to the base resistor.' },
      { id: 'w_m1', kind: 'wire', ...wire(jumper(MOT_T1, lead(RV_X, 1), 'red', 0.3), [0, 0.4, -0.3]), mount: 'offboard', role: 'Shaker to R_VIB and Q1\'s collector.' },
      { id: 'w_m2', kind: 'wire', ...wire(jumper(MOT_T2, lead(D1_X, 1), 'orange', 0.4), [0, 0.4, 0.3]), mount: 'offboard', role: 'Shaker\'s other terminal to 5 V, at the flyback diode\'s cathode.' },
      {
        id: 'w_ad0',
        kind: 'wire',
        ...wire(jumper(hdrPin('AD0'), hdrPin('VCC'), 'white', 0.5), [0.4, 0.5, 0]),
        mount: 'offboard',
        hidden: true,
        label: 'AD0 → VCC',
        role: 'A jumper tying AD0 high.',
      },
    ],
  },

  circuit: {
    elements: [
      { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5, rInternal: 0.3, partId: 'uno' },
      { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', 'vbus_in'], closed: true, partId: 'uno' },
      { id: 'f1', type: 'R', nodes: ['vbus_in', '5v'], value: 0.3, rating: { maxI: 1.0 }, partId: 'uno' },
      { id: 'r_board', type: 'R', nodes: ['5v', '0'], value: 111, partId: 'uno' }, // the Uno's ~45 mA
      // GY-521: LDO (clamped buffer), MPU supply, pull-ups, AD0 pull-down, power LED
      { id: 'ldo', type: 'OPAMP', nodes: ['5v', '3v3', '3v3'], vPos: 3.3, vNeg: 0, partId: 'u2' },
      { id: 'i_mpu', type: 'I', nodes: ['3v3', '0'], value: 0.0039, rating: { maxV: 6 }, partId: 'u1' },
      { id: 'r_sda', type: 'R', nodes: ['3v3', 'sda'], value: 4700, partId: 'r_pu' },
      { id: 'r_scl', type: 'R', nodes: ['3v3', 'scl'], value: 4700, partId: 'r_pu' },
      { id: 'pin_sda', type: 'PIN', nodes: ['sda', '0'], pin: 18, vcc: 5, partId: 'uno' },
      { id: 'pin_scl', type: 'PIN', nodes: ['scl', '0'], pin: 19, vcc: 5, partId: 'uno' },
      { id: 'r_ad0', type: 'R', nodes: ['ad0', '0'], value: 4700, partId: 'r_ad0' },
      { id: 'r_led', type: 'R', nodes: ['3v3', 'led_a'], value: 1000, partId: 'led_pwr' },
      { id: 'led_pwr', type: 'LED', nodes: ['led_a', '0'], color: 'red', partId: 'led_pwr' },
      // shaker: pin 6 → 1 kΩ → 2N2222A, ERM + 22 Ω from 5 V, 1N4148 flyback
      { id: 'pin6', type: 'PIN', nodes: ['d6', '0'], pin: 6, vcc: 5, partId: 'uno' },
      { id: 'r_b', type: 'R', nodes: ['d6', 'b1'], value: 1000, partId: 'r_b' },
      { id: 'q1', type: 'NPN', nodes: ['m_n', 'b1', '0'], beta: 100, rating: { maxI: 0.6, maxV: 40 }, partId: 'q1' },
      { id: 'vib', type: 'MOTOR', nodes: ['5v', 'vm_r'], r: 30, l: 0.0002, ke: 0.00095, j: 2e-9, b: 4e-8, rating: { maxI: 0.2 }, partId: 'vib' }, // b lumps the eccentric mass's drag: ≈ 15 000 rpm, ≈ 65 mA, spins down in ≈ 50 ms
      { id: 'r_vib', type: 'R', nodes: ['vm_r', 'm_n'], value: 22, rating: { maxP: 0.25 }, partId: 'r_vib' },
      { id: 'd_fly', type: 'D', nodes: ['m_n', '5v'], is: 2.5e-9, n: 1.75, rating: { maxI: 0.2 }, partId: 'd1' },
    ],
  },
  powerElementId: 'usb_plug',
  powerLabel: 'Plug USB',
  transient: true,

  behaviors: [
    {
      id: 'imu-mpu6050',
      params: { pitchSource: 'tweak', pitchDeg: 0, tempC: 25, dlpf: 3, gyroBias: 2.1, biasTempco: 0.03, gyroNoise: 0.005, accelNoise: 400e-6, motorId: 'vib', addr: 0x68 },
    },
  ],

  readouts: [
    { label: 'TRUE PITCH', source: { kind: 'behavior', key: 'imu-mpu6050.pitch_true' }, unit: '°' },
    { label: 'ACCEL PITCH', source: { kind: 'behavior', key: 'imu-mpu6050.pitch_accel' }, unit: '°' },
    { label: 'GYRO PITCH (RAW)', source: { kind: 'behavior', key: 'imu-mpu6050.pitch_gyro' }, unit: '°' },
    { label: 'GYRO PITCH (CAL)', source: { kind: 'behavior', key: 'imu-mpu6050.pitch_gyro_cal' }, unit: '°' },
    { label: 'FILTERED PITCH', source: { kind: 'behavior', key: 'imu-mpu6050.pitch_filtered' }, unit: '°' },
    { label: 'VIBRATION', source: { kind: 'behavior', key: 'imu-mpu6050.vib_g' }, unit: 'g' },
    { label: 'I²C IDLE (SDA)', source: { kind: 'voltage', node: 'sda' }, unit: 'V' },
  ],

  sketch: { title: 'Complementary filter', code: sketch, pins: { 18: 'pin_sda', 19: 'pin_scl', 6: 'pin6' }, vcc: 5, board: 'uno' },

  tweaks: [
    { label: 'Plate pitch', elementId: 'behavior:imu-mpu6050', key: 'pitchDeg', min: -60, max: 60, step: 0.5, unit: '°' },
    { label: 'Sensor temperature', elementId: 'behavior:imu-mpu6050', key: 'tempC', min: 0, max: 70, step: 1, unit: '°C' },
    { label: 'DLPF setting', elementId: 'behavior:imu-mpu6050', key: 'dlpf', min: 0, max: 6, step: 1, unit: '' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: SDA idles at {6} through the carrier\'s pull-ups. The raw gyro integral is already drifting at the 2.1 °/s bias: {2}. Upload the sketch.' },
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: tilt the plate and compare. True {0}, accel {1}, filtered {4}; the raw gyro integral has drifted to {2}.' },
    { when: { kind: 'above', readout: 5, value: 0.2 }, text: 'Shaker on ({5} rms): the accelerometer pitch ({1}) is noisy, but the filter barely moves ({4}).' },
  ],

  failures: [
    {
      id: 'warm',
      label: 'Warm the sensor after calibrating (25 → 55 °C)',
      explain:
        'The gyro bias shifts by 30 °C × 0.03 °/s/°C ≈ 0.9 °/s. GYRO PITCH (CAL) walks away at about 54° per minute, while FILTERED PITCH settles to a steady error of only τ × 0.9 °/s ≈ 0.49 s × 0.9 ≈ 0.44°. MEMS gyro bias depends on temperature, and a one-time calibration at power-up removes it only at that temperature. The complementary filter bounds the error but leaves an offset of bias × τ. A larger (1 − α) shrinks it and lets more accelerometer noise through.',
      patches: [{ op: 'set', elementId: 'behavior:imu-mpu6050', key: 'tempC', value: 55 }],
    },
    {
      id: 'no-pullups',
      label: 'Remove the I²C pull-ups',
      explain:
        'SDA and SCL idle near 0 V: nothing pulls the open-drain lines high, so the MPU-6050 never sees a start condition. testConnection() fails and the sketch prints "MPU-6050 not found". Some GY-521 clones skip the pull-ups. Enabling the Uno\'s internal 20–50 kΩ pull-ups is no fix either: they pull to 5 V, out of spec for the 3.3 V chip\'s pins.',
      patches: [
        { op: 'remove', elementId: 'r_sda' },
        { op: 'remove', elementId: 'r_scl' },
      ],
      parts: { hide: ['r_pu'] },
    },
    {
      id: 'ad0-high',
      label: 'Tie AD0 high',
      explain:
        'AD0 sets the low address bit, so the chip now answers at 0x69 while the library still calls 0x68: nothing is found. It is how you put two IMUs on one bus, and a classic "works on one board, not the other" bug when AD0 floats on a breakout without a pull-down.',
      patches: [{ op: 'short', a: 'ad0', b: '3v3' }],
      parts: { show: ['w_ad0'] },
    },
  ],

  meet: `The MPU-6050 contains two very different sensors.

**Gyroscope:** measures **rate**. At ±250 °/s full scale it outputs **131 counts per °/s**, so a raw reading of 655 is 5.0 °/s. Integrating rate gives angle, but any bias is integrated too. The datasheet allows up to ±20 °/s of zero-rate offset before calibration. Even 2 °/s left uncorrected becomes 120° in a minute: watch GYRO PITCH (RAW), the bias integrated with no correction. GYRO PITCH (CAL) subtracts the bias measured at power-up, as the sketch does.

**Accelerometer:** at ±2 g, **16384 counts per g**. At rest it measures gravity, so pitch = atan2(−ax, az). It never drifts, but it can't tell tilt from acceleration: a 0.1 g jolt reads as 5.7° of tilt, and motors make it shake. Turn on the shaker and watch ACCEL PITCH.

**Complementary filter:** pitch = α·(pitch + rate·dt) + (1 − α)·accelPitch. With α = 0.98 and dt = 10 ms, the time constant is τ = α·dt/(1 − α) = 0.98 × 0.01 / 0.02 = **0.49 s**. Above about 1/(2πτ) ≈ 0.3 Hz you trust the gyro, below it the accelerometer: a high-pass on the gyro plus a low-pass on the accelerometer, with crossovers that sum to one.

**Steady error from residual bias:** bias × τ. 0.9 °/s × 0.49 s ≈ 0.44°.

**Digital low-pass filter (DLPF):** CONFIG register setting 0–6 trades bandwidth for delay: 260 Hz with no delay at 0, 44 Hz and about 5 ms at 3, 5 Hz and about 19 ms at 6. A wider setting lets more noise and vibration through.

**Wiring:** the GY-521's 3.3 V LDO lets it run from 5 V. Its pull-ups go to 3.3 V, which the Uno's TWI usually accepts even though it is under the datasheet's 0.7 × VCC = 3.5 V threshold. AD0 picks the address: 0x68 low, 0x69 high. WHO_AM_I (register 0x75) reads 0x68 either way.

Note: TDK lists the MPU-6050 as not recommended for new designs. Check the current status.`,

  mechanicalAnalogy: `The gyro is a tachometer on a rotary table: precise over seconds, but integrate a tiny calibration error and the position estimate creeps away. The accelerometer is a plumb bob: it always knows "down" on average, but swings wildly when the table is bumped. The complementary filter is a mechanical filter in parallel: a stiff, fast linkage from the tachometer and a soft spring to the plumb line, tuned so the spring slowly pulls the drift out without passing the swing through.

**Where it breaks:** a plumb bob in a turning vehicle hangs off-vertical in a sustained curve (centripetal acceleration). No filter time constant fixes that. You need a model of the motion or more sensors.`,

  proTips: [
    'Calibrate the gyro after the sensor has warmed up (10–30 s), with the board perfectly still. Store the offset, or use the MPU\'s offset registers so the raw data comes out pre-corrected.',
    'Choose the DLPF bandwidth for your loop: about 2–5 times your control bandwidth, not "as low as possible". Mode 6 (5 Hz) adds about 19 ms of delay, enough to destabilise a balancing robot.',
    'Check the axis signs on your board. Tilt it nose-down by hand and confirm the accel and gyro estimates go the same direction. Mounting orientation decides which axis is "pitch".',
  ],

  quiz: [
    {
      q: 'At ±250 °/s range, the gyro reads 655 counts. What is the rotation rate?',
      options: ['0.2 °/s', '2.5 °/s', '5.0 °/s', '65.5 °/s'],
      answer: 2,
      why: '655 / 131 = 5.0 °/s.',
    },
    {
      q: 'A residual gyro bias of 0.5 °/s is integrated for 60 s with no correction. What is the angle error?',
      options: ['0.5°', '8.3°', '30°', '120°'],
      answer: 2,
      why: '0.5 °/s × 60 s = 30°.',
    },
    {
      q: 'You want τ = 0.5 s with a 200 Hz loop (dt = 5 ms). What α should you use?',
      options: ['0.90', '0.95', '0.99', '0.999'],
      answer: 2,
      why: 'α = τ/(τ + dt) = 0.5/0.505 ≈ 0.990.',
    },
    {
      q: 'Why is accelerometer-only tilt unreliable on a moving robot?',
      options: [
        'The accelerometer drifts with temperature like the gyro',
        'It measures gravity plus linear acceleration, so any acceleration looks like tilt',
        'It can only measure ±2 g',
        'I²C is too slow',
      ],
      answer: 1,
      why: 'It senses specific force. A 0.1 g push reads as atan(0.1) ≈ 5.7° of false tilt.',
    },
  ],
}
