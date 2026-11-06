// T5 · TB6612FNG Dual H-Bridge (video Fig. 05). Source: docs/curriculum/T5/tb6612fng.md
//
// The bridge is two averaged half-bridges (V source = duty·VM behind Ron/2, then a switch that
// opens for high-Z), driven every tick by the `tb6612` behavior from the pin voltages. The driver
// ground is the battery negative `bat_n`; `gnd_link` is the common-ground wire to the Uno.
import type { Element, LessonDef } from '../../engine/types'
import { PITCH, jumper } from '../layout'

// ── bench layout (one 21 × 11.5 motor bench PCB; everything stands on it, y = 0) ──
const UNO_AT: [number, number] = [6.3, 0.6] // rot 90: digital header toward the viewer, USB to the right
const HDR: [number, number] = [0.9, 2.6] // 2 × 8 header, rot 90: pins run along z
const BAT: [number, number] = [-0.4, -2.35] // 4 × AA behind the driver, rot 90: leads toward it
const MOT: [number, number] = [-5.2, 2.0] // TT gear motor at the front, rot 0: wheel facing the viewer

const UNO_HEADER_Y = 0.16 + 0.85
const HDR_TOP = 0.85

/** Uno digital socket (rot 90: the header runs along the front edge) */
function unoDigital(pin: number | 'GND'): [number, number, number] {
  const lx = pin === 'GND' ? -0.25 + (3 - 4.5) * PITCH : pin < 8 ? 2.35 + (3.5 - pin) * PITCH : -0.25 + (4.5 - (pin - 8)) * PITCH
  return [UNO_AT[0] - lx, UNO_HEADER_Y, UNO_AT[1] + 2.4]
}
/** Uno power socket (NC, IOREF, RST, 3V3, 5V, GND, GND, VIN) on the back edge */
function unoPower(k: number): [number, number, number] {
  return [UNO_AT[0] - (-0.35 + (k - 3.5) * PITCH), UNO_HEADER_Y, UNO_AT[1] - 2.4]
}
/** driver header pin: row 0 (toward the motor side) VM VCC GND AO1 AO2 BO2 BO1 GND; row 1 PWMA AIN2 AIN1 STBY BIN1 BIN2 PWMB GND */
function hdrPin(row: 0 | 1, i: number): [number, number, number] {
  return [HDR[0] + (row ? 0.127 : -0.127), HDR_TOP, HDR[1] - (i - 3.5) * PITCH]
}
// battery pack leads (part-local ends at (-4.1, -0.1) red and (-4.05, 0.45) black), rotated 90°
const BAT_RED: [number, number, number] = [BAT[0] - 0.1, 0.06, BAT[1] + 4.1]
const BAT_BLACK: [number, number, number] = [BAT[0] + 0.45, 0.06, BAT[1] + 4.05]
// motor terminals on the can's end cap (part-local x ≈ -5.3, z = -0.95 ± 0.35)
const MOT_T1: [number, number, number] = [MOT[0] - 5.3, 3.35, MOT[1] - 0.95 - 0.35]
const MOT_T2: [number, number, number] = [MOT[0] - 5.3, 3.35, MOT[1] - 0.95 + 0.35]

type Wire = ReturnType<typeof jumper>
const wire = (w: Wire, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const DIODE = { is: 1e-9, n: 1.8, rating: { maxI: 3 }, partId: 'u1' }
const bodyDiode = (id: string, a: string, k: string): Element => ({ id, type: 'D', nodes: [a, k], ...DIODE })
const pin = (n: number): Element => ({ id: `pin${n}`, type: 'PIN', nodes: [`d${n}`, '0'], pin: n, vcc: 5, partId: 'uno' })
const rIn = (n: number): Element => ({ id: `r_in${n}`, type: 'R', nodes: [`d${n}`, '0'], value: 200e3, partId: 'u1' })

const sketch = `#define PWMA 5
#define AIN1 7
#define AIN2 8
#define STBY 4

// speed: -255 (full CCW) .. +255 (full CW). 0 = short brake.
void motorA(int speed) {
  speed = constrain(speed, -255, 255);
  if (speed > 0) {
    digitalWrite(AIN1, HIGH);
    digitalWrite(AIN2, LOW);
    analogWrite(PWMA, speed);
  } else if (speed < 0) {
    digitalWrite(AIN1, LOW);
    digitalWrite(AIN2, HIGH);
    analogWrite(PWMA, -speed);
  } else {
    digitalWrite(AIN1, HIGH);     // both high = short brake
    digitalWrite(AIN2, HIGH);
    analogWrite(PWMA, 255);
  }
}

void coastA() {                    // both low + PWM high = outputs off (high-Z)
  digitalWrite(AIN1, LOW);
  digitalWrite(AIN2, LOW);
  analogWrite(PWMA, 255);
}

void ramp(int from, int to, int ms) {
  int steps = 50;
  for (int i = 0; i <= steps; i++) {
    motorA(from + (to - from) * i / steps);
    delay(ms / steps);
  }
}

void report(String phase) {
  Serial.print(phase);
  Serial.print(" t_ms:");
  Serial.println(millis());
}

void setup() {
  pinMode(PWMA, OUTPUT);
  pinMode(AIN1, OUTPUT);
  pinMode(AIN2, OUTPUT);
  pinMode(STBY, OUTPUT);
  Serial.begin(115200);
  digitalWrite(STBY, HIGH);        // wake the driver
  report("ready");
}

void loop() {
  report("ramp CW");
  ramp(0, 255, 2000);              // up to full speed
  delay(1000);
  report("brake");
  motorA(0);                       // stops in a fraction of a second
  delay(700);
  report("ramp CCW");
  ramp(0, -255, 2000);
  delay(1000);
  report("coast");
  coastA();                        // spins down slowly on friction alone
  delay(1500);
}
`

export const lesson: LessonDef = {
  id: 'tb6612fng',
  fig: 5,
  track: 'T5',
  title: 'TB6612FNG Dual H-Bridge',
  subtitle: 'MOSFETs that barely warm',
  tagline: 'Four MOSFETs with about 0.5 Ω in the current path let a 3.3–5 V logic pin reverse, brake and PWM a 6 V gear motor at up to 1.2 A per channel.',

  board: {
    name: 'MOTOR BENCH A',
    size: [21, 11.5],
    base: 'mat',
    traces: [
      // header row 0 to the IC, decorative
      [[HDR[0] - 0.127, HDR[1] + 0.889], [-0.1, HDR[1] + 0.889], [-0.25, HDR[1] + 0.6]],
      [[HDR[0] - 0.127, HDR[1] - 0.127], [-0.25, HDR[1] - 0.127]],
      [[HDR[0] - 0.127, HDR[1] - 0.381], [-0.25, HDR[1] - 0.381]],
      [[-0.6, HDR[1] - 0.95], [-0.6, HDR[1] - 1.55]],
      [[-0.6, HDR[1] + 0.95], [-0.6, HDR[1] + 1.55]],
    ],
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], 0, UNO_AT[1]],
        rot: 90,
        mount: 'module',
        label: 'UNO',
        role: 'Logic and PWM source: pin 5 is PWMA, 7 and 8 are AIN1/AIN2, 4 is STBY. USB brings 5 V for the driver logic.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [1.5, 1.6, 0.6] },
        circuitIds: ['pin4', 'pin5', 'pin7', 'pin8', 'v_usb'],
      },
      {
        id: 'drv',
        kind: 'logic-ic-label',
        pos: [-0.25, 0, HDR[1] + 2.05],
        mount: 'smd',
        label: 'DRIVER',
        role: 'The carrier area for the IC: bridge, decoupling and the 2 × 8 pin header.',
        params: { text: 'TB6612FNG CARRIER', size: 0.2, callout: [0.2, 0.8, 0.7] },
      },
      {
        id: 'u1',
        kind: 'ic-smd',
        pos: [-0.6, 0, HDR[1]],
        rot: 90,
        mount: 'smd',
        label: 'TB6612FNG',
        role: 'Dual H-bridge. Each output stage is a pair of MOSFETs (with body diodes) plus logic, thermal shutdown and low-voltage lockout.',
        params: { package: 'SSOP', pins: 24, marking: 'TB6612\nFNG', callout: [-0.9, 1.3, 0] },
        circuitIds: ['ha', 'hb', 'ron_a', 'ron_b', 'en_a', 'en_b', 'i_vm'],
      },
      {
        id: 'c_vm_board',
        kind: 'capacitor-smd',
        pos: [-0.6, 0, HDR[1] - 1.25],
        rot: 90,
        mount: 'smd',
        label: 'VM CAP',
        role: 'Local decoupling on VM, 10 µF (the value varies by carrier).',
        params: { size: '1206', callout: [0.1, 1.1, -0.9] },
      },
      {
        id: 'c_vcc',
        kind: 'capacitor-smd',
        pos: [-0.6, 0, HDR[1] + 1.25],
        rot: 90,
        mount: 'smd',
        label: 'VCC CAP',
        role: 'Logic supply decoupling, 100 nF.',
        params: { size: '0603', callout: [-0.4, 0.9, 0.9] },
      },
      {
        id: 'hdr',
        kind: 'header-male',
        pos: [HDR[0], 0, HDR[1]],
        rot: 90,
        mount: 'tht',
        label: 'PINS',
        role: 'VM, VCC, GND, AO1/2, BO1/2 on one row; PWMA/B, AIN1/2, BIN1/2, STBY on the other.',
        params: { pins: 8, rows: 2, callout: [0.9, 1.4, -0.9] },
      },
      {
        id: 'c_bulk',
        kind: 'capacitor-electrolytic',
        pos: [-1.6, 0, HDR[1] + 2.6],
        mount: 'offboard',
        label: 'BULK CAP',
        role: 'Supplies the current pulses of PWM so the battery leads don\'t have to (100 µF, 16 V).',
        params: { d: 0.63, h: 1.1, callout: [-0.7, 1.2, 0.5] },
        circuitIds: ['c_vm'],
      },
      {
        id: 'bat',
        kind: 'battery-aa-pack',
        pos: [BAT[0], 0, BAT[1]],
        rot: 90,
        mount: 'offboard',
        label: '6V PACK',
        role: 'Motor supply: 4 × AA, about 0.6 Ω internal resistance for fresh alkalines (approximate).',
        params: { cells: 4, callout: [0.6, 1.2, -0.8] },
        circuitIds: ['bat', 'bat_sw'],
      },
      {
        id: 'mot',
        kind: 'gear-motor-wheel',
        pos: [MOT[0], 0, MOT[1]],
        mount: 'offboard',
        label: 'GEAR MOTOR',
        role: 'GM-48, the course\'s representative 6 V gear motor: 4 Ω winding, ~150 mA no-load, ~250 mA typical, 1.5 A stall at 6 V.',
        params: { marking: '1:48', callout: [1.2, 0.5, 1.6] },
        circuitIds: ['m1'],
      },
      { id: 'w_pwm', kind: 'wire', ...wire(jumper(unoDigital(5), hdrPin(1, 0), 'yellow', 0.7), [0.6, 0.9, 0.4]), mount: 'offboard', role: 'Pin 5 (PWM, ~980 Hz) to PWMA.' },
      { id: 'w_ain2', kind: 'wire', ...wire(jumper(unoDigital(8), hdrPin(1, 1), 'green', 0.9), [0.4, 0.8, 0.2]), mount: 'offboard', role: 'Pin 8 to AIN2.' },
      { id: 'w_ain1', kind: 'wire', ...wire(jumper(unoDigital(7), hdrPin(1, 2), 'blue', 0.8), [0.2, 0.8, 0]), mount: 'offboard', role: 'Pin 7 to AIN1.' },
      { id: 'w_stby', kind: 'wire', ...wire(jumper(unoDigital(4), hdrPin(1, 3), 'white', 0.6), [0, 0.7, -0.2]), mount: 'offboard', role: 'Pin 4 to STBY: HIGH wakes the driver.' },
      { id: 'w_vcc', kind: 'wire', ...wire(jumper(unoPower(4), hdrPin(0, 1), 'red', 1.1), [0, 0.8, -0.4]), mount: 'offboard', role: 'Uno 5 V to the driver\'s logic supply VCC.' },
      { id: 'w_gnd', kind: 'wire', ...wire(jumper(unoPower(5), hdrPin(1, 7), 'black', 0.9), [1.1, 0.9, 0.5]), mount: 'offboard', label: 'COMMON GND', role: 'The common ground: Uno GND to the driver GND (and so to the battery negative).' },
      { id: 'w_vm', kind: 'wire', ...wire(jumper(BAT_RED, hdrPin(0, 0), 'red', 0.7), [0, 0.6, 0.3]), mount: 'offboard', role: 'Battery + to VM.' },
      { id: 'w_bgnd', kind: 'wire', ...wire(jumper(BAT_BLACK, hdrPin(0, 2), 'black', 0.6), [-0.2, 0.5, 0.2]), mount: 'offboard', role: 'Battery − to the driver GND.' },
      { id: 'w_ao1', kind: 'wire', ...wire(jumper(MOT_T1, hdrPin(0, 3), 'orange', 0.4), [0, 0.5, 0]), mount: 'offboard', role: 'AO1 to the motor\'s + terminal.' },
      { id: 'w_ao2', kind: 'wire', ...wire(jumper(MOT_T2, hdrPin(0, 4), 'brown', 0.4), [0, 0.5, 0]), mount: 'offboard', role: 'AO2 to the motor\'s − terminal.' },
    ],
  },

  circuit: {
    elements: [
      // USB 5 V: the Uno and the driver's logic supply
      { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5, rInternal: 0.3, partId: 'uno' },
      { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', 'vbus_in'], closed: true, partId: 'uno' },
      { id: 'f1', type: 'R', nodes: ['vbus_in', '5v'], value: 0.3, rating: { maxI: 1.0 }, partId: 'uno' },
      { id: 'r_board', type: 'R', nodes: ['5v', '0'], value: 111, partId: 'uno' }, // the Uno's ~45 mA
      { id: 'r_vcc', type: 'R', nodes: ['5v', 'bat_n'], value: 4500, partId: 'u1' }, // TB6612 logic, ~1.1 mA, returns through the driver GND
      pin(4),
      pin(5),
      pin(7),
      pin(8),
      rIn(4),
      rIn(5),
      rIn(7),
      rIn(8),
      // motor battery and the common ground
      { id: 'bat', type: 'V', nodes: ['bat_p', 'bat_n'], value: 6, rInternal: 0.6, partId: 'bat' },
      { id: 'bat_sw', type: 'SW', nodes: ['bat_p', 'vm'], closed: true, partId: 'bat' },
      { id: 'gnd_link', type: 'R', nodes: ['bat_n', '0'], value: 0.01, partId: 'w_gnd' },
      { id: 'c_vm', type: 'C', nodes: ['vm', 'bat_n'], value: 100e-6, polarized: true, rating: { maxV: 16 }, partId: 'c_bulk' },
      // the bridge: VM draw, two averaged half-bridges, four body diodes
      { id: 'i_vm', type: 'I', nodes: ['vm', 'bat_n'], value: 0, rating: { maxV: 15, failMode: 'short' }, partId: 'u1' },
      { id: 'ha', type: 'V', nodes: ['ha_i', 'bat_n'], value: 0, partId: 'u1' },
      { id: 'ron_a', type: 'R', nodes: ['ha_i', 'sa'], value: 0.25, rating: { maxI: 3.2 }, partId: 'u1' },
      { id: 'en_a', type: 'SW', nodes: ['sa', 'ao1'], closed: false, partId: 'u1' },
      { id: 'hb', type: 'V', nodes: ['hb_i', 'bat_n'], value: 0, partId: 'u1' },
      { id: 'ron_b', type: 'R', nodes: ['hb_i', 'sb'], value: 0.25, rating: { maxI: 3.2 }, partId: 'u1' },
      { id: 'en_b', type: 'SW', nodes: ['sb', 'ao2'], closed: false, partId: 'u1' },
      bodyDiode('db_a_hi', 'ao1', 'vm'),
      bodyDiode('db_a_lo', 'bat_n', 'ao1'),
      bodyDiode('db_b_hi', 'ao2', 'vm'),
      bodyDiode('db_b_lo', 'bat_n', 'ao2'),
      // GM-48 (representative values; measure your own)
      { id: 'm1', type: 'MOTOR', nodes: ['ao1', 'ao2'], r: 4, l: 0.5e-3, ke: 0.0054, kt: 0.0054, j: 3e-7, b: 8e-7, load: 0, rating: { maxI: 2 }, partId: 'mot' },
    ],
  },
  powerElementId: 'usb_plug',
  powerLabel: 'Plug USB',
  extraPower: [{ elementId: 'bat_sw', label: 'Connect battery' }],
  transient: true,

  behaviors: [
    {
      id: 'tb6612',
      params: { in1: 7, in2: 8, pwm: 5, stby: 4, gnd: 'bat_n', vm: 'vm', vcc: '5v', supply: 'i_vm', ronTotal: 0.5, rthJA: 140, tauTh: 2, tsd: 175, gear: 48, pwmHz: 980 },
    },
  ],

  readouts: [
    { label: 'MOTOR CURRENT', source: { kind: 'current', elementId: 'm1' }, unit: 'A' },
    { label: 'MOTOR VOLTS', source: { kind: 'voltage', node: 'ao1', ref: 'ao2' }, unit: 'V' },
    { label: 'VM (BATTERY)', source: { kind: 'voltage', node: 'vm', ref: 'bat_n' }, unit: 'V' },
    { label: 'OUTPUT SPEED', source: { kind: 'behavior', key: 'tb6612.rpm_out' }, unit: 'rpm' },
    { label: 'DRIVER Tj', source: { kind: 'behavior', key: 'tb6612.tj' }, unit: '°C' },
    { label: 'BRIDGE LOSS', source: { kind: 'behavior', key: 'tb6612.bridge_W' }, unit: 'W' },
  ],

  sketch: { title: 'Forward, brake, reverse, coast', code: sketch, pins: { 4: 'pin4', 5: 'pin5', 7: 'pin7', 8: 'pin8' }, vcc: 5, board: 'uno' },

  tweaks: [
    { label: 'Battery voltage', elementId: 'bat', key: 'value', min: 3, max: 14, step: 0.1, unit: 'V' },
    { label: 'Wheel load torque', elementId: 'm1', key: 'load', min: 0, max: 0.008, step: 0.0002, unit: 'N·m (motor shaft)' },
    { label: 'Battery internal R', elementId: 'bat', key: 'rInternal', min: 0.05, max: 3, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: connect the battery too, then upload the sketch. Below 2.5 V on VM the driver stays in undervoltage lockout. VM and the Uno\'s 5 V are separate supplies with one common ground.' },
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: the sketch cycles CW, brake, CCW and coast; {3} at the wheel, {0} in the motor.' },
    { when: { kind: 'above', readout: 0, value: 1.2 }, text: 'WARNING: {0} is above the 1.2 A average rating: the driver is heating.' },
    { when: { kind: 'below', readout: 0, value: -1.2 }, text: 'WARNING: {0} is above the 1.2 A average rating: the driver is heating.' },
    { when: { kind: 'above', readout: 4, value: 150 }, text: 'WARNING: driver Tj {4} is above 150 °C: thermal shutdown is close.' },
  ],

  failures: [
    {
      id: 'stall-2s',
      label: 'Stall it on a fresh 2S Li-ion pack (8.4 V)',
      explain:
        'With the wheel locked, about 8.4 / (4 + 0.5 + 0.1) ≈ 1.8 A flows at full duty, above the 1.2 A average rating though below the 3.2 A peak. Driver loss ≈ 1.8² × 0.5 ≈ 1.6 W, so Tj heads for 25 + 1.6 × 140 ≈ 250 °C. Thermal shutdown trips within seconds, the motor stops and restarts, and the cycle repeats. The IC protects itself, but repeated cycling stresses it: limit PWM when VM is above the motor\'s rating, add current sensing, or use a bigger driver.',
      patches: [
        { op: 'set', elementId: 'bat', key: 'value', value: 8.4 },
        { op: 'set', elementId: 'bat', key: 'rInternal', value: 0.1 },
        { op: 'set', elementId: 'm1', key: 'load', value: 0.05 },
      ],
    },
    {
      id: 'vm-4s',
      label: 'VM from a 4S LiPo (16.8 V)',
      explain:
        'The TB6612 is rated 13.5 V operating and 15 V absolute on VM. At 16.8 V the bridge fails at once (short) and the driver is burnt; the 16 V bulk capacitor is over its rating too. A 3S pack (12.6 V fully charged) is the most it can take, and inductive spikes on long leads eat into that margin.',
      patches: [{ op: 'set', elementId: 'bat', key: 'value', value: 16.8 }],
    },
    {
      id: 'no-common-gnd',
      label: 'Forget the common ground',
      explain:
        'VM still reads 6 V across the battery, but the driver\'s inputs no longer have a reference: a logic HIGH is "5 V relative to the driver\'s GND", and without a ground wire between the Uno and the battery negative the signal has no return path. The motor twitches randomly or not at all. Every multi-supply system needs one common reference (T7 power-grounding-emc).',
      patches: [{ op: 'remove', elementId: 'gnd_link' }],
      parts: { hide: ['w_gnd'] },
    },
  ],

  meet: `An **H-bridge** is four switches with the motor across the middle. Close upper-left and lower-right and current flows one way. Close the other diagonal and the motor reverses. Close both lower switches and the motor's own back-EMF drives current through a short, which is **short brake**. Open all four and it coasts.

The TB6612FNG builds each switch from a MOSFET. Toshiba gives about **0.5 Ω** for the upper and lower switch together (typical). At 1 A that is 1 A × 0.5 Ω = 0.5 V lost and 1² × 0.5 = **0.5 W** of heat, which a small SSOP-24 can handle.

| IN1 | IN2 | PWM | STBY | mode |
|---|---|---|---|---|
| H | L | duty | H | CW |
| L | H | duty | H | CCW |
| H | H | x | H | short brake |
| L | L | H | H | stop (high-Z) |
| x | x | x | L | standby |

**Ratings:** VM 2.5–13.5 V (15 V absolute), VCC 2.7–5.5 V (3.3 V logic works), **1.2 A average** and 3.2 A peak per channel, PWM up to 100 kHz.

**Worked stall:** a 4 Ω motor on a 6 V AA pack (0.6 Ω) gives I = 6 / (4 + 0.5 + 0.6) = **1.18 A**, right at the rating. On an 8.4 V Li-ion pack it is 1.8 A, too much for a held stall.

**Full speed:** at 100 % CW with no load the motor sees about 6 − 0.15 × (0.6 + 0.5) ≈ 5.8 V and spins at about 9 200 rpm at the motor shaft, or **≈ 190 rpm** at the 48:1 output.

**PWM:** \`analogWrite(5, 128)\` gives an average of 128/255 × 6 ≈ **3.0 V**. Pin 5 runs at about 980 Hz, which you can hear as a whine. The chip can PWM at 20 kHz+, above hearing, but the Uno's default \`analogWrite\` cannot. During the PWM-low part of each cycle the driver short-brakes, so the motor sees the average. At 980 Hz this motor's current (L/R ≈ 0.1 ms) follows every pulse, so the bridge heats by the RMS current, not the average: the BRIDGE LOSS readout includes that ripple.

Body diodes in each MOSFET catch the motor's inductive kick, so no external flyback diodes are needed. A 100 µF bulk capacitor on VM is still a must.

*Sim note:* each half-bridge is simulated as its average (duty × VM behind Ron/2), so the readouts show mean values without the PWM ripple. The 3D wheel turns with the motor, slowed down for the eye.`,

  mechanicalAnalogy: `An H-bridge is a 4-way, 3-position directional valve for a hydraulic motor. The diagonal pairs are the A→B and B→A spool positions. Short brake is the "motor ports connected" centre position, where the motor pumps against itself and stops fast. Coast is the "float" centre. PWM is a proportional valve dithering fast enough that the motor's inertia sees only the average flow.

**Where it breaks:** a hydraulic spool can't connect P straight to T through both sides. An H-bridge can (shoot-through), so the driver IC's dead-time logic is what prevents it.`,

  proTips: [
    'Wire the bulk capacitor (100–470 µF, rated at least 1.5 × VM) close to the VM pin. Long battery leads are inductors, and without the capacitor the PWM current pulses turn into voltage spikes.',
    'Brake versus coast is a design choice. Brake gives crisp stops for positioning, while coast is gentler on gearboxes and saves energy. Choose it on purpose rather than by accident from your pin states.',
    'Raise the PWM frequency to 20 kHz on pins 9/10 (Timer1 registers or the TimerOne library) to remove the audible whine. Check the motor still starts at low duty, because higher frequency means more switching loss per second, and at very low duty the current never builds up.',
  ],

  quiz: [
    {
      q: 'A 4 Ω motor, a 0.5 Ω bridge and a 6 V pack with 0.6 Ω internal resistance. What is the stall current?',
      options: ['0.6 A', '1.18 A', '1.5 A', '12 A'],
      answer: 1,
      why: 'I = 6 / (4 + 0.5 + 0.6) ≈ 1.18 A.',
    },
    {
      q: '`analogWrite(PWMA, 128)` with VM = 6 V. What average voltage does the motor see (ignoring drops)?',
      options: ['0.6 V', '3.0 V', '4.8 V', '6 V'],
      answer: 1,
      why: '128/255 × 6 ≈ 3.0 V.',
    },
    {
      q: 'AIN1 = HIGH and AIN2 = HIGH. What does the TB6612 do?',
      options: ['Spins CW', 'Coasts (outputs off)', 'Short brakes', 'Shoots through and burns'],
      answer: 2,
      why: 'Both inputs high turns both low-side switches on, shorting the motor terminals. Its back-EMF brakes it.',
    },
    {
      q: 'How much heat does the TB6612 bridge make at 1 A (0.5 Ω path)?',
      options: ['0.05 W', '0.5 W', '1.85 W', '5 W'],
      answer: 1,
      why: 'P = I²R = 1² × 0.5 = 0.5 W. Compare about 1.85 W for an L298N at the same current (next lesson).',
    },
  ],
}
