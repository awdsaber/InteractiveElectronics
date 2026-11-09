// T7 · PID Motor Speed Control. Source: docs/curriculum/T7/pid-motor-control.md
//
// The encoder bench of `encoders` (TB6612 + GM-48 + 11-PPR hall encoder) with the loop closed: the Uno
// measures output rpm from the ×4 count every sample and runs a discrete PID at a fixed rate. The gains,
// the loop period and the anti-windup switch are bench sliders (`pid-tune`, read by the sketch as
// Tune.kp() … each loop, so a change lands at the next sample). A felt brake on a flywheel (`dyno-load`)
// loads the output shaft. The strip chart plots setpoint, measured speed and PWM duty together.
import type { Element, LessonDef } from '../../engine/types'
import { PITCH, jumper } from '../layout'

// ── bench layout (the 21 × 11.5 encoder bench, with the dyno behind the motor) ──
const UNO_AT: [number, number] = [6.3, 0.6] // rot 90: digital header toward the viewer, USB to the right
const HDR: [number, number] = [0.9, 2.6] // 2 × 8 header, rot 90: pins run along z
const BAT: [number, number] = [-0.4, -2.35] // 4 × AA behind the driver, rot 90: leads toward it
const MOT: [number, number] = [-7.0, -1.0] // gear motor at the left, wheel face toward +x
const ENC_AT: [number, number] = [-4.2, 3.0] // the encoder board in front of the motor, clear of the wheel
const DYNO_AT: [number, number] = [-4.4, -3.9] // flywheel + brake lever behind the wheel

const UNO_HEADER_Y = 0.16 + 0.85
const HDR_TOP = 0.85

function unoDigital(pin: number | 'GND'): [number, number, number] {
  const lx = pin === 'GND' ? -0.25 + (3 - 4.5) * PITCH : pin < 8 ? 2.35 + (3.5 - pin) * PITCH : -0.25 + (4.5 - (pin - 8)) * PITCH
  return [UNO_AT[0] - lx, UNO_HEADER_Y, UNO_AT[1] + 2.4]
}
function unoPower(k: number): [number, number, number] {
  return [UNO_AT[0] - (-0.35 + (k - 3.5) * PITCH), UNO_HEADER_Y, UNO_AT[1] - 2.4]
}
function hdrPin(row: 0 | 1, i: number): [number, number, number] {
  return [HDR[0] + (row ? 0.127 : -0.127), HDR_TOP, HDR[1] - (i - 3.5) * PITCH]
}
const BAT_RED: [number, number, number] = [BAT[0] - 0.1, 0.06, BAT[1] + 4.1]
const BAT_BLACK: [number, number, number] = [BAT[0] + 0.45, 0.06, BAT[1] + 4.05]
const MOT_T1: [number, number, number] = [MOT[0] - 0.95 - 0.35, 3.35, MOT[1] + 5.3]
const MOT_T2: [number, number, number] = [MOT[0] - 0.95 + 0.35, 3.35, MOT[1] + 5.3]

/** the six solder pads along the encoder board's front edge: M+, M−, GND, VCC, A, B */
const ENC_PITCH = 0.42
const encPad = (i: number): [number, number, number] => [ENC_AT[0] + (i - 2.5) * ENC_PITCH, 0.34, ENC_AT[1] + 0.5]
const R_Z = ENC_AT[1] + 1.8
const rEnd = (i: number, far: boolean): [number, number, number] => [encPad(i)[0], 0.12, R_Z + (far ? 0.5 : -0.5)]

type Wire = ReturnType<typeof jumper>
const wire = (w: Wire, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const DIODE = { is: 1e-9, n: 1.8, rating: { maxI: 3 }, partId: 'drv' }
const bodyDiode = (id: string, a: string, k: string): Element => ({ id, type: 'D', nodes: [a, k], ...DIODE })
const pin = (n: number): Element => ({ id: `pin${n}`, type: 'PIN', nodes: [`d${n}`, '0'], pin: n, vcc: 5, vccNode: '5v', partId: 'uno' })
const rIn = (n: number): Element => ({ id: `r_in${n}`, type: 'R', nodes: [`d${n}`, '0'], value: 200e3, partId: 'drv' })

const SKETCH = `#define ENC_A 2
#define ENC_B 3
#define PWMA 5
#define AIN1 7
#define AIN2 8
#define STBY 4

const float CPR = 11.0 * 4 * 48;     // 2112 counts per output revolution (x4)
const float U_MAX = 255.0;           // the PWM limit: the actuator's authority

// x4 table decoder, state = A<<1 | B. A leads B going forward: 00 -> 10 -> 11 -> 01 is +1 per step.
const int QEM[16] = {0, -1, 1, 0,  1, 0, 0, -1,  -1, 0, 0, 1,  0, 1, -1, 0};
volatile long count = 0;
volatile int lastState = 0;

void onEdge() {
  int s = (digitalRead(ENC_A) << 1) | digitalRead(ENC_B);
  count += QEM[(lastState << 2) | s];
  lastState = s;
}

void drive(float u) {
  int pwm = constrain(u, -U_MAX, U_MAX);
  if (pwm >= 0) {
    digitalWrite(AIN1, HIGH);
    digitalWrite(AIN2, LOW);
    analogWrite(PWMA, pwm);
  } else {
    digitalWrite(AIN1, LOW);
    digitalWrite(AIN2, HIGH);
    analogWrite(PWMA, -pwm);
  }
}

// 8 s test profile, repeating: two forward steps, a reversal, a stop
float setpointAt(unsigned long ms) {
  unsigned long t = ms % 8000;
  if (t < 2000) { return 60.0; }
  if (t < 5000) { return 150.0; }
  if (t < 7000) { return -100.0; }
  return 0.0;
}

float iTerm = 0;          // the integral term itself (PWM counts), so a change of Ki is bumpless
float lastRpm = 0;
float lastU = 0;
float jitter = 0;         // average sample-to-sample change of the output, PWM counts
long lastCount = 0;
unsigned long nextTick = 0;
unsigned long nextPrint = 0;

void setup() {
  pinMode(ENC_A, INPUT);             // external 10 k pull-ups
  pinMode(ENC_B, INPUT);
  pinMode(PWMA, OUTPUT);
  pinMode(AIN1, OUTPUT);
  pinMode(AIN2, OUTPUT);
  pinMode(STBY, OUTPUT);
  digitalWrite(STBY, HIGH);
  Serial.begin(115200);
  lastState = (digitalRead(ENC_A) << 1) | digitalRead(ENC_B);
  attachInterrupt(digitalPinToInterrupt(ENC_A), onEdge, CHANGE);
  attachInterrupt(digitalPinToInterrupt(ENC_B), onEdge, CHANGE);
  nextTick = millis();
}

void loop() {
  // Fixed-rate tick, scheduled on millis(): the work below never shifts the next sample.
  long wait = nextTick - millis();
  if (wait > 0) {
    delay(wait);
  }
  unsigned long periodMs = Tune.periodMs();   // the bench's Loop period
  nextTick += periodMs;
  float dt = periodMs / 1000.0;
  float kp = Tune.kp();                       // the bench's gain sliders
  float ki = Tune.ki();
  float kd = Tune.kd();

  noInterrupts();                             // copy the 32-bit count atomically
  long c = count;
  interrupts();
  float rpm = (c - lastCount) / CPR * 60.0 / dt;   // mean output speed over the last sample
  lastCount = c;

  float sp = setpointAt(millis());
  float err = sp - rpm;

  // Derivative on the measurement, not the error: no kick when the setpoint steps.
  float dTerm = -kd * (rpm - lastRpm) / dt;
  lastRpm = rpm;

  // Anti-windup by conditional integration: don't integrate further into a saturated output.
  float iNext = iTerm + ki * err * dt;
  float uTry = kp * err + iNext + dTerm;
  bool pushingUp = uTry > U_MAX && err > 0;
  bool pushingDown = uTry < -U_MAX && err < 0;
  if (Tune.antiWindup() == 0 || (!pushingUp && !pushingDown)) {
    iTerm = iNext;
  }
  float u = constrain(kp * err + iTerm + dTerm, -U_MAX, U_MAX);
  drive(u);

  jitter = 0.9 * jitter + 0.1 * abs(u - lastU);
  lastU = u;

  if (millis() >= nextPrint) {               // 20 Hz to the plotter
    nextPrint += 50;
    Serial.print("set:");
    Serial.print(sp);
    Serial.print(",rpm:");
    Serial.print(rpm);
    Serial.print(",duty:");
    Serial.print(u / U_MAX * 100.0);
    Serial.print(",iterm:");
    Serial.print(iTerm);
    Serial.print(",jitter:");
    Serial.println(jitter);
  }
}
`

export const lesson: LessonDef = {
  id: 'pid-motor-control',
  track: 'T7',
  title: 'PID Motor Speed Control',
  subtitle: 'Closing the loop',
  tagline:
    'The GM-48 gear motor is a first-order plant with a 46 ms time constant and a gain of 0.76 rpm per PWM count, so a PI loop with Kp = 0.40 and Ki = 8.7 tracks a speed step with a 0.15 s time constant and wins back a brake load in about half a second.',

  guide: [
    {
      id: 'power-on',
      title: 'Plug in USB',
      body: 'Press **Plug USB**. The 6 V pack already feeds the driver, but nothing drives it until a sketch runs.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'power' }, { kind: 'status', is: 'POWERED' }] },
      focus: { control: 'power' },
      hint: 'The blue button at the top left of the bench.',
    },
    {
      id: 'upload',
      title: 'Close the loop',
      body: 'Press **Upload sketch**. Every 10 ms it reads the encoder count, works out the speed and sets the PWM. Open **Instruments** to see **SETPOINT**, **MEASURED SPEED** and **PWM DUTY** on the strip chart as the setpoint steps 60 → 150 → −100 → 0 rpm.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'upload' }, { kind: 'status', is: 'RUNNING' }] },
      focus: { control: 'upload' },
      explain: 'It starts as a P-only loop with Kp = 1: the PWM is just 1 count per rpm of error.',
    },
    {
      id: 'p-only',
      title: 'P only: raise Kp',
      body: 'Slide **Kp** up to about **2**. The speed gets closer, and the step now overshoots and rings, but at 150 rpm **ERROR** settles at about **60 rpm**. With P alone, e = (sp + K·u₀) / (1 + K·Kp) = (150 + 0.76 × 7) / (1 + 0.76 × 2) ≈ 62 rpm, where u₀ ≈ 7 counts is what friction eats.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Kp', min: 1.8, max: 3 },
          { kind: 'tweak', target: 'Ki', max: 0.5 },
          { kind: 'readout', index: 4, above: 45, below: 80, holdMs: 600 },
        ],
      },
      focus: { control: 'tweak:Kp' },
      hint: 'The error only shows on the 150 rpm step, which comes round every 8 s.',
      explain: 'A P loop needs an error to make any output at all: the PWM is Kp × error, so the motor can only run as fast as the error it is left with allows. It is a proportional governor’s droop. More Kp shrinks it, but the loop’s lags soon make it ring, and above Kp ≈ 3 it oscillates for good.',
    },
    {
      id: 'add-i',
      title: 'Add I: the model-based PI',
      body: 'Set **Kp** to **0.4** and **Ki** to **8.7**: the internal-model (IMC) tuning Kp = τ / (K·τc) = 0.046 / (0.76 × 0.15) and Ki = Kp / τ. On the next step the speed rises with no overshoot, reaching 63 % in about 0.15 s, and **ERROR** settles to zero.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Kp', min: 0.3, max: 0.6 },
          { kind: 'tweak', target: 'Ki', min: 7, max: 11 },
          { kind: 'readout', index: 0, above: 50 },
          { kind: 'readout', index: 4, above: -6, below: 6, holdMs: 600 },
        ],
      },
      focus: { control: 'tweak:Ki' },
      hint: 'Wait for a forward step (60 or 150 rpm): the error is measured over 0.6 s of steady running.',
      explain: 'The integrator keeps adding up the error until it has wound up exactly the PWM the motor needs, so no error is left. That is the slowly wound preload that removes a governor’s droop.',
    },
    {
      id: 'add-d',
      title: 'Add D: hear the noise',
      body: 'Slide **Kd** up to about **0.02**. The speed hardly changes, but **PWM DUTY** turns to fuzz: **PWM JITTER** goes from about 0.5 to about 7 counts per sample.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Kd', min: 0.015 },
          { kind: 'readout', index: 8, above: 4, holdMs: 400 },
        ],
      },
      focus: { control: 'tweak:Kd' },
      hint: 'PWM JITTER is the average change in PWM from one sample to the next.',
      explain: 'One encoder count in 10 ms is a 2.84 rpm step in the measured speed, so the derivative sees spikes of 284 rpm/s from nothing at all, and Kd = 0.02 turns each into a 5.7-count kick. A first-order motor needs no D: leave it at 0, or filter it heavily.',
    },
    {
      id: 'brake',
      title: 'Load it with the brake',
      body: 'Set **Kd** back to 0 and slide **Brake torque** to **0.03 N·m**. At 150 rpm the speed dips by about 20 rpm, then the integrator winds up the extra PWM and **ERROR** is back to zero within about half a second, with **PWM DUTY** some 14 % higher to hold the load.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Brake torque', min: 0.025, max: 0.04 },
          { kind: 'tweak', target: 'Kd', max: 0.005 },
          { kind: 'readout', index: 0, above: 50 },
          { kind: 'readout', index: 4, above: -6, below: 6, holdMs: 600 },
          { kind: 'readout', index: 6, above: 0.02 },
        ],
      },
      focus: { control: 'tweak:Brake torque' },
      explain: '0.03 N·m on the output is 0.03 / (48 × 0.7) ≈ 0.9 mN·m at the motor. The extra current, 0.9 mN·m / kt ≈ 0.17 A, costs 0.17 × 5.1 Ω ≈ 0.85 V, about 36 more PWM counts. A P-only loop must lose speed to find them (about 11 rpm at Kp = 2); the integrator finds them with no error left. Try 0.05 N·m: at 150 rpm that needs more than 255 counts, so the output saturates and the error stays.',
    },
    {
      id: 'reverse-feedback',
      title: 'Reverse the feedback',
      body: 'Open **Break something** and pick **Swap the encoder A and B wires**. The measured speed now has the wrong sign: the error grows as the motor speeds up, so the output slams to 100 % and **TRUE SPEED** runs away to the maximum whatever the setpoint.',
      check: {
        kind: 'all',
        of: [
          { kind: 'break', failure: 'swap-ab' },
          { kind: 'readout', index: 3, above: 120, holdMs: 1000 },
        ],
      },
      focus: { control: 'break' },
      explain: 'A sign error turns negative feedback into positive feedback. Before closing any loop, run it open loop with a small positive command and check that the measurement goes positive.',
    },
    {
      id: 'repair',
      title: 'Wire it back',
      body: 'Open **Break something** and choose **Repair all**. The loop catches the speed again on the next step.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    { id: 'quiz', title: 'Check yourself', body: 'Answer the questions below.', check: { kind: 'quiz' }, focus: { control: 'quiz' } },
  ],

  board: {
    name: 'PID BENCH',
    size: [21, 11.5],
    base: 'mat',
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], 0, UNO_AT[1]],
        rot: 90,
        mount: 'module',
        label: 'UNO',
        role: 'Runs the PID loop at a fixed rate (100 Hz by default): counts encoder edges on INT0/INT1 (pins 2, 3), and drives PWMA (pin 5), AIN1/AIN2 (7, 8) and STBY (4).',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [1.5, 1.6, 0.6] },
        facts: [
          'ATmega328P at 16 MHz, no FPU: a float multiply takes several µs in software',
          'analogWrite on pin 5 is Timer0 PWM at about 977 Hz, 8 bits (0–255)',
          'INT0 = pin 2, INT1 = pin 3',
        ],
        circuitIds: ['pin2', 'pin3', 'pin4', 'pin5', 'pin7', 'pin8', 'v_usb'],
      },
      {
        id: 'drv',
        kind: 'ic-smd',
        pos: [-0.6, 0, HDR[1]],
        rot: 90,
        mount: 'smd',
        label: 'DRIVER',
        role: 'The actuator: TB6612FNG H-bridge. PWM duty sets the average motor voltage, up to the 6 V supply and no further.',
        params: { package: 'SSOP', pins: 24, marking: 'TB6612\nFNG', callout: [-1.8, 2.2, -0.6] },
        facts: ['1.2 A average, 3.2 A peak per channel', 'About 0.5 Ω high side + low side (typ.)', 'PWM input up to 100 kHz'],
        circuitIds: ['ha', 'hb', 'ron_a', 'ron_b', 'en_a', 'en_b', 'i_vm'],
      },
      {
        id: 'hdr',
        kind: 'header-male',
        pos: [HDR[0], 0, HDR[1]],
        rot: 90,
        mount: 'tht',
        label: 'PINS',
        role: 'VM, VCC, GND, AO1/2 on one row; PWMA, AIN2, AIN1, STBY on the other.',
        params: { pins: 8, rows: 2, callout: [2.4, 1.8, -0.8] },
      },
      {
        id: 'c_bulk',
        kind: 'capacitor-electrolytic',
        pos: [-1.6, 0, HDR[1] + 2.6],
        mount: 'offboard',
        label: 'BULK CAP',
        role: 'Supplies the PWM current pulses locally (100 µF, 16 V).',
        params: { d: 0.63, h: 1.1, callout: [-2.6, 0.5, 1.0] },
        circuitIds: ['c_vm'],
      },
      {
        id: 'bat',
        kind: 'battery-aa-pack',
        pos: [BAT[0], 0, BAT[1]],
        rot: 90,
        mount: 'offboard',
        label: '6V PACK',
        role: 'Motor supply: 4 × AA, about 0.6 Ω internal resistance fresh (approximate). It sets the ceiling on speed: no gain makes up for a missing volt.',
        params: { cells: 4, callout: [0.6, 1.2, -0.8] },
        circuitIds: ['bat', 'bat_sw'],
      },
      {
        id: 'mot',
        kind: 'gear-motor-wheel',
        pos: [MOT[0], 0, MOT[1]],
        rot: 90,
        mount: 'offboard',
        label: 'MOTOR (PLANT)',
        role: "The plant: GM-48, the course's representative 6 V gear motor (4 Ω winding, 48:1). Electrically and mechanically it is a first-order system: τ = J·R / (kt·ke + R·b) ≈ 46 ms.",
        params: { marking: '1:48', callout: [-3.0, -1.6, 0.6] },
        facts: [
          'Representative values: R 4 Ω, ke = kt = 0.0054 V·s/rad, J 3e-7 kg·m², b 8e-7 N·m·s',
          'About 190 rpm at the output unloaded on 6 V',
          'Stall torque at the output ≈ 0.0054 × 6 / 5.1 × 48 × 0.7 ≈ 0.21 N·m',
        ],
        circuitIds: ['m1'],
      },
      {
        id: 'enc',
        kind: 'module',
        pos: [ENC_AT[0], 0, ENC_AT[1]],
        mount: 'offboard',
        label: 'ENCODER (SENSOR)',
        role: 'The sensor: two hall channels, 11 pulses per motor revolution, decoded ×4 to 2112 counts per output turn. Open-drain outputs with 10 kΩ pull-ups.',
        params: { w: 2.9, d: 1.1, pins: 0, chip: 'none', title: 'HALL ENCODER', color: '#2a3a52', callout: [-1.6, 1.3, 0.5] },
        facts: ['One count in a 10 ms sample = 2.84 rpm at the output', 'At 150 rpm: 5280 edges/s into the ISR'],
        circuitIds: ['enc_sa', 'enc_sb', 'i_enc'],
      },
      {
        id: 'dyno',
        kind: 'module',
        pos: [DYNO_AT[0], 0, DYNO_AT[1]],
        mount: 'offboard',
        label: 'DYNO',
        role: 'The disturbance: a 60 mm aluminium flywheel on the output shaft with a felt brake pad on a lever. The Brake torque slider sets the pad force. Its inertia, reflected through 48² ≈ 2300, adds under 3 % to the motor’s J.',
        params: { w: 2.6, d: 1.6, pins: 0, chip: 'none', title: 'FLYWHEEL + BRAKE', color: '#5a4632', callout: [0.4, 1.4, -0.4] },
        facts: [
          'Brake 0–0.15 N·m at the output; the motor feels brake / (48 × 0.7)',
          'Gearbox efficiency 0.7 is illustrative (small spur gearboxes run about 0.5–0.8)',
        ],
      },
      {
        id: 'r_pa',
        kind: 'resistor',
        pos: [encPad(4)[0], 0.12, R_Z],
        rot: 90,
        mount: 'tht',
        label: 'PULL-UP A',
        role: 'Gives channel A its HIGH level: 10 kΩ from 5 V to the A line.',
        params: { ohms: 10000, callout: [0.5, 1.2, 0.2] },
        circuitIds: ['r_pa'],
      },
      {
        id: 'r_pb',
        kind: 'resistor',
        pos: [encPad(5)[0], 0.12, R_Z],
        rot: 90,
        mount: 'tht',
        label: 'PULL-UP B',
        role: 'Gives channel B its HIGH level: 10 kΩ from 5 V to the B line.',
        params: { ohms: 10000, callout: [0.5, 1.2, 0.2] },
        circuitIds: ['r_pb'],
      },
      { id: 'w_pwm', kind: 'wire', ...wire(jumper(unoDigital(5), hdrPin(1, 0), 'yellow', 0.7), [0.6, 0.9, 0.4]), mount: 'offboard', role: 'Pin 5 (PWM) to PWMA: the control output.' },
      { id: 'w_ain2', kind: 'wire', ...wire(jumper(unoDigital(8), hdrPin(1, 1), 'green', 0.9), [0.4, 0.8, 0.2]), mount: 'offboard', role: 'Pin 8 to AIN2.' },
      { id: 'w_ain1', kind: 'wire', ...wire(jumper(unoDigital(7), hdrPin(1, 2), 'blue', 0.8), [0.2, 0.8, 0]), mount: 'offboard', role: 'Pin 7 to AIN1.' },
      { id: 'w_stby', kind: 'wire', ...wire(jumper(unoDigital(4), hdrPin(1, 3), 'white', 0.6), [0, 0.7, -0.2]), mount: 'offboard', role: 'Pin 4 to STBY: HIGH wakes the driver.' },
      { id: 'w_vcc', kind: 'wire', ...wire(jumper(unoPower(4), hdrPin(0, 1), 'red', 1.1), [0, 0.8, -0.4]), mount: 'offboard', role: "Uno 5 V to the driver's logic supply VCC." },
      { id: 'w_gnd', kind: 'wire', ...wire(jumper(unoPower(5), hdrPin(1, 7), 'black', 0.9), [2.4, 0.3, 1.4]), mount: 'offboard', label: 'COMMON GND', role: 'The common ground: Uno GND to the driver GND (and so to the battery negative).' },
      { id: 'w_vm', kind: 'wire', ...wire(jumper(BAT_RED, hdrPin(0, 0), 'red', 0.7), [0, 0.6, 0.3]), mount: 'offboard', role: 'Battery + to VM.' },
      { id: 'w_bgnd', kind: 'wire', ...wire(jumper(BAT_BLACK, hdrPin(0, 2), 'black', 0.6), [-0.2, 0.5, 0.2]), mount: 'offboard', role: 'Battery − to the driver GND.' },
      { id: 'w_ao1', kind: 'wire', ...wire(jumper(MOT_T1, hdrPin(0, 3), 'orange', 0.4), [0, 0.5, 0]), mount: 'offboard', role: "AO1 to the motor's + terminal." },
      { id: 'w_ao2', kind: 'wire', ...wire(jumper(MOT_T2, hdrPin(0, 4), 'brown', 0.4), [0, 0.5, 0]), mount: 'offboard', role: "AO2 to the motor's − terminal." },
      { id: 'w_a', kind: 'wire', ...wire(jumper(encPad(4), unoDigital(2), 'yellow', 1.5), [0.4, 1.0, 0.4]), mount: 'offboard', label: 'A', role: 'Channel A to pin 2 (INT0): the feedback path.' },
      { id: 'w_b', kind: 'wire', ...wire(jumper(encPad(5), unoDigital(3), 'green', 1.9), [0.4, 1.1, 0.2]), mount: 'offboard', label: 'B', role: 'Channel B to pin 3 (INT1). Swap it with A and the feedback changes sign.' },
      { id: 'w_e5v', kind: 'wire', ...wire(jumper(encPad(3), unoPower(4), 'red', 2.2), [0.2, 1.0, -0.3]), mount: 'offboard', role: "Uno 5 V to the encoder's VCC." },
      { id: 'w_egnd', kind: 'wire', ...wire(jumper(encPad(2), unoPower(6), 'black', 2.0), [-0.2, 0.9, -0.3]), mount: 'offboard', role: "Uno GND to the encoder's GND." },
      { id: 'w_pa_hi', kind: 'wire', ...wire(jumper(rEnd(4, true), encPad(3), 'red', 0.3), [0.3, 0.6, 0]), mount: 'offboard', role: 'Pull-up A to the encoder VCC (5 V).' },
      { id: 'w_pa_lo', kind: 'wire', ...wire(jumper(rEnd(4, false), encPad(4), 'yellow', 0.3), [-0.3, 0.6, 0]), mount: 'offboard', role: 'Pull-up A to the A line.' },
      { id: 'w_pb_hi', kind: 'wire', ...wire(jumper(rEnd(5, true), encPad(3), 'red', 0.5), [0.3, 0.6, 0]), mount: 'offboard', role: 'Pull-up B to the encoder VCC (5 V).' },
      { id: 'w_pb_lo', kind: 'wire', ...wire(jumper(rEnd(5, false), encPad(5), 'green', 0.3), [-0.3, 0.6, 0]), mount: 'offboard', role: 'Pull-up B to the B line.' },
    ],
  },

  circuit: {
    elements: [
      // USB 5 V: the Uno, the driver logic and the encoder
      { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5, rInternal: 0.3, partId: 'uno' },
      { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', 'vbus_in'], closed: true, partId: 'uno' },
      { id: 'f1', type: 'R', nodes: ['vbus_in', '5v'], value: 0.3, rating: { maxI: 1.0 }, partId: 'uno' },
      { id: 'r_board', type: 'R', nodes: ['5v', '0'], value: 111, partId: 'uno' }, // the Uno's ~45 mA
      { id: 'r_vcc', type: 'R', nodes: ['5v', 'bat_n'], value: 4500, partId: 'drv' }, // TB6612 logic, ~1.1 mA
      { id: 'i_enc', type: 'I', nodes: ['5v', '0'], value: 0.008, rating: { maxV: 6 }, partId: 'enc' },
      pin(4),
      pin(5),
      pin(7),
      pin(8),
      rIn(4),
      rIn(5),
      rIn(7),
      rIn(8),
      // the encoder: open-drain outputs, pulled up, wired to INT0 / INT1
      { id: 'r_pa', type: 'R', nodes: ['5v', 'enc_a'], value: 10000, partId: 'r_pa' },
      { id: 'r_pb', type: 'R', nodes: ['5v', 'enc_b'], value: 10000, partId: 'r_pb' },
      { id: 'enc_sa', type: 'SW', nodes: ['enc_a', '0'], closed: false, rating: { maxI: 0.02 }, partId: 'enc' },
      { id: 'enc_sb', type: 'SW', nodes: ['enc_b', '0'], closed: false, rating: { maxI: 0.02 }, partId: 'enc' },
      { id: 'w_a_el', type: 'R', nodes: ['enc_a', 'd2'], value: 0.01, partId: 'w_a' },
      { id: 'w_b_el', type: 'R', nodes: ['enc_b', 'd3'], value: 0.01, partId: 'w_b' },
      { id: 'pin2', type: 'PIN', nodes: ['d2', '0'], pin: 2, vcc: 5, vccNode: '5v', partId: 'uno' },
      { id: 'pin3', type: 'PIN', nodes: ['d3', '0'], pin: 3, vcc: 5, vccNode: '5v', partId: 'uno' },
      // motor battery and the common ground
      { id: 'bat', type: 'V', nodes: ['bat_p', 'bat_n'], value: 6, rInternal: 0.6, partId: 'bat' },
      { id: 'bat_sw', type: 'SW', nodes: ['bat_p', 'vm'], closed: true, partId: 'bat' },
      { id: 'gnd_link', type: 'R', nodes: ['bat_n', '0'], value: 0.01, partId: 'w_gnd' },
      { id: 'c_vm', type: 'C', nodes: ['vm', 'bat_n'], value: 100e-6, polarized: true, rating: { maxV: 16 }, partId: 'c_bulk' },
      // the bridge: VM draw, two averaged half-bridges, four body diodes
      { id: 'i_vm', type: 'I', nodes: ['vm', 'bat_n'], value: 0, rating: { maxV: 15, failMode: 'short' }, partId: 'drv' },
      { id: 'ha', type: 'V', nodes: ['ha_i', 'bat_n'], value: 0, partId: 'drv' },
      { id: 'ron_a', type: 'R', nodes: ['ha_i', 'sa'], value: 0.25, rating: { maxI: 3.2 }, partId: 'drv' },
      { id: 'en_a', type: 'SW', nodes: ['sa', 'ao1'], closed: false, partId: 'drv' },
      { id: 'hb', type: 'V', nodes: ['hb_i', 'bat_n'], value: 0, partId: 'drv' },
      { id: 'ron_b', type: 'R', nodes: ['hb_i', 'sb'], value: 0.25, rating: { maxI: 3.2 }, partId: 'drv' },
      { id: 'en_b', type: 'SW', nodes: ['sb', 'ao2'], closed: false, partId: 'drv' },
      bodyDiode('db_a_hi', 'ao1', 'vm'),
      bodyDiode('db_a_lo', 'bat_n', 'ao1'),
      bodyDiode('db_b_hi', 'ao2', 'vm'),
      bodyDiode('db_b_lo', 'bat_n', 'ao2'),
      // GM-48 (representative values). The shaft load is set every tick by dyno-load.
      { id: 'm1', type: 'MOTOR', nodes: ['ao1', 'ao2'], r: 4, l: 0.5e-3, ke: 0.0054, kt: 0.0054, j: 3e-7, b: 8e-7, load: 0.0002, rating: { maxI: 2 }, partId: 'mot' },
    ],
  },
  powerElementId: 'usb_plug',
  powerLabel: 'Plug USB',
  transient: true,

  behaviors: [
    {
      id: 'tb6612',
      instance: 'tb6612',
      params: { in1: 7, in2: 8, pwm: 5, stby: 4, gnd: 'bat_n', vm: 'vm', vcc: '5v', supply: 'i_vm', ronTotal: 0.5, rthJA: 140, tauTh: 2, tsd: 175, gear: 48, pwmHz: 980 },
    },
    { id: 'quad-encoder', instance: 'enc', params: { motor: 'm1', ppr: 11, gear: 48, a: 2, b: 3, swapAB: 0, isrUs: 12, glitchRate: 0, pullA: 'r_pa', pullB: 'r_pb' } },
    { id: 'dyno-load', instance: 'dyno', params: { motor: 'm1', brakeNm: 0, gear: 48, eff: 0.7, coulombNm: 0.0002 } },
    { id: 'pid-tune', instance: 'tune', params: { kp: 1, ki: 0, kd: 0, periodMs: 10, antiWindup: 1 } },
    { id: 'mcu-supply', instance: 'mcu', params: { supplyNode: '5v', bor: 2.7, fClk: 16 } },
    { id: 'serial-plotter', instance: 'serial' },
  ],

  readouts: [
    { label: 'SETPOINT', source: { kind: 'behavior', key: 'serial.set' }, unit: 'rpm' },
    { label: 'MEASURED SPEED', source: { kind: 'behavior', key: 'serial.rpm' }, unit: 'rpm' },
    { label: 'PWM DUTY', source: { kind: 'behavior', key: 'serial.duty' }, unit: '%' },
    { label: 'TRUE SPEED', source: { kind: 'behavior', key: 'dyno.rpm_out' }, unit: 'rpm' },
    { label: 'ERROR', source: { kind: 'derived', op: 'diff', of: [0, 1] }, unit: 'rpm' },
    { label: 'I TERM (PWM COUNTS)', source: { kind: 'behavior', key: 'serial.iterm' }, unit: '', digits: 1 },
    { label: 'BRAKE TORQUE (N·m)', source: { kind: 'behavior', key: 'dyno.brake_Nm' }, unit: '', digits: 3 },
    { label: 'MOTOR CURRENT', source: { kind: 'current', elementId: 'm1' }, unit: 'A' },
    { label: 'PWM JITTER (COUNTS/SAMPLE)', source: { kind: 'behavior', key: 'serial.jitter' }, unit: '', digits: 1 },
    { label: 'BRAKE POWER', source: { kind: 'behavior', key: 'dyno.out_power_W' }, unit: 'W' },
    { label: 'LOOP RATE', source: { kind: 'behavior', key: 'tune.loop_hz' }, unit: 'Hz' },
  ],

  // The strip chart is the lesson: setpoint, measured speed and PWM duty (%) on one time axis.
  instruments: {
    open: false,
    scope: {
      channels: [
        { label: 'A (PIN 2)', source: { kind: 'voltage', node: 'd2' }, perDiv: 2, offset: 1.5 },
        { label: 'MOTOR CURRENT', source: { kind: 'current', elementId: 'm1' }, perDiv: 0.2, offset: -2 },
      ],
      timePerDiv: 50e-3,
      trigger: { channel: 0, level: 2.5, slope: 'falling', mode: 'auto' },
    },
    chart: { signals: [0, 1, 2], span: 10 },
    view: 'chart',
  },

  sketch: { title: 'Fixed-rate PID speed loop', code: SKETCH, pins: { 2: 'pin2', 3: 'pin3', 4: 'pin4', 5: 'pin5', 7: 'pin7', 8: 'pin8' }, vcc: 5, board: 'uno' },

  tweaks: [
    { label: 'Kp', elementId: 'behavior:tune', key: 'kp', min: 0, max: 10, step: 0.05, unit: '' },
    { label: 'Ki', elementId: 'behavior:tune', key: 'ki', min: 0, max: 60, step: 0.1, unit: '' },
    { label: 'Kd', elementId: 'behavior:tune', key: 'kd', min: 0, max: 0.05, step: 0.001, unit: '' },
    { label: 'Brake torque', elementId: 'behavior:dyno', key: 'brakeNm', min: 0, max: 0.15, step: 0.005, unit: '' },
    {
      label: 'Loop period',
      elementId: 'behavior:tune',
      key: 'periodMs',
      kind: 'enum',
      min: 5,
      max: 100,
      unit: 'ms',
      options: [
        { label: '5 ms', value: 5 },
        { label: '10 ms', value: 10 },
        { label: '20 ms', value: 20 },
        { label: '50 ms', value: 50 },
        { label: '100 ms', value: 100 },
      ],
    },
    { label: 'Anti-windup', elementId: 'behavior:tune', key: 'antiWindup', kind: 'toggle', min: 0, max: 1, unit: '' },
    { label: 'Battery switch', elementId: 'bat_sw', key: 'closed', kind: 'toggle', min: 0, max: 1, unit: '' },
    { label: 'Battery voltage', elementId: 'bat', key: 'value', min: 4, max: 9, step: 0.1, unit: 'V' },
    { label: 'Battery internal R', elementId: 'bat', key: 'rInternal', min: 0.1, max: 3, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: upload the sketch to close the loop. The driver waits for STBY.' },
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: setpoint {0}, measured {1}, error {4}, PWM {2}. Open Instruments to watch the step response.' },
    { when: { kind: 'above', readout: 2, value: 99 }, text: 'Output saturated at 100 %: the motor cannot go faster. With anti-windup on, the integrator holds at {5} counts.' },
  ],

  failures: [
    {
      id: 'swap-ab',
      label: 'Swap the encoder A and B wires',
      explain:
        'The measured speed is now minus the true speed. At a 60 rpm setpoint the motor starts forward, the sketch reads it as going backward, so the error grows and the output climbs, which makes it read "more backward" still: positive feedback. The PWM slams to 100 % and the motor runs flat out, about 185 rpm, whatever the setpoint. Before closing any loop, run it open loop with a small positive command and check that the measurement goes positive. Production firmware also trips a fault when the speed stays far from the setpoint for too long.',
      patches: [{ op: 'set', elementId: 'behavior:enc', key: 'swapAB', value: 1 }],
    },
    {
      id: 'too-much-gain',
      label: 'Crank up the gain (Kp = 8)',
      explain:
        'A loop is never instantaneous: the speed is an average over the last sample, the new PWM lands after it, and the motor takes 46 ms to answer. Add up those lags and at some frequency the loop turns a correction half a cycle round, so it arrives just in time to push the wrong way. If the loop gain at that frequency is above 1, the swing grows until the PWM limits stop it: a limit cycle. On this bench that happens above Kp ≈ 3, with a period of about 0.4 s, and at Kp = 8 the speed swings between about 35 and 165 rpm. Gain margin, the factor between your Kp and that limit, is what keeps you clear of it (2 to 3 is usual).',
      patches: [
        { op: 'set', elementId: 'behavior:tune', key: 'kp', value: 8 },
        { op: 'set', elementId: 'behavior:tune', key: 'ki', value: 8.7 },
      ],
    },
    {
      id: 'slow-loop',
      label: 'Run a tight loop at 10 Hz (100 ms period)',
      explain:
        'These gains, Kp = 1.5 and Ki = 20, make a crisp loop at 100 Hz: no overshoot, settled in about 0.35 s. At 10 Hz each sample covers 100 ms, twice the motor’s time constant. The speed reading is a 100 ms average, the PWM then holds for 100 ms, and the integrator adds Ki·e·0.1 in one jump, so every correction acts on old news and overshoots. The speed never settles: it swings between about 110 and 175 rpm. Sample at least 5 to 10 times per plant time constant (here 100 to 200 Hz), or detune the gains to suit a slower rate (the IMC values survive 10 Hz, with a 20 rpm overshoot).',
      patches: [
        { op: 'set', elementId: 'behavior:tune', key: 'kp', value: 1.5 },
        { op: 'set', elementId: 'behavior:tune', key: 'ki', value: 20 },
        { op: 'set', elementId: 'behavior:tune', key: 'periodMs', value: 100 },
      ],
    },
    {
      id: 'no-pullups',
      label: 'Lose the encoder pull-ups',
      explain:
        'With no pull-ups the open-drain hall outputs have no HIGH level: the inputs float and the sketch sees noise, not the shaft. The measured speed is noise around zero, so the controller sees the whole setpoint as error and its integrator winds the output to the limit: the motor runs flat out, about 187 rpm, in whichever direction the setpoint asks, at 60 rpm and at 150 alike. A feedback controller trusts its sensor completely. Detect it: if the PWM is high and no counts arrive for 100 ms, stop and flag a sensor fault.',
      patches: [
        { op: 'remove', elementId: 'r_pa' },
        { op: 'remove', elementId: 'r_pb' },
      ],
      parts: { hide: ['r_pa', 'r_pb', 'w_pa_hi', 'w_pa_lo', 'w_pb_hi', 'w_pb_lo'] },
    },
    {
      id: 'tired-battery',
      label: 'Tired battery, anti-windup removed',
      explain:
        'At 4.6 V with 2 Ω of internal resistance the motor tops out near 136 rpm (ω = (kt·V/R − T_f) / (kt·ke/R + b) with R = 6.5 Ω), so the 150 rpm step cannot be reached: the PWM sits at 100 % and the error never closes. With the anti-windup branch gone, the integrator keeps adding that error for 3 s and winds up to about 550 counts, more than twice the 255 it can use. When the setpoint reverses to −100 rpm the output stays at full forward until the stored integral has unwound, and the motor crosses zero about 0.2 s later than it does with the clamp. No gain makes up for a missing volt: size the supply for the worst case, and always guard the integrator.',
      patches: [
        { op: 'set', elementId: 'bat', key: 'value', value: 4.6 },
        { op: 'set', elementId: 'bat', key: 'rInternal', value: 2.0 },
        { op: 'set', elementId: 'behavior:tune', key: 'kp', value: 0.4 },
        { op: 'set', elementId: 'behavior:tune', key: 'ki', value: 8.7 },
        { op: 'set', elementId: 'behavior:tune', key: 'antiWindup', value: 0 },
      ],
    },
  ],

  meet: `**The plant.** A DC motor obeys V = I·R + ke·ω and J·dω/dt = kt·I − b·ω − T_load. For a step of voltage it is a first-order system, like an RC circuit or a mass with viscous damping, with time constant **τ = J·R / (kt·ke + R·b)**. On this bench R = 4 Ω (winding) + 0.5 Ω (bridge) + 0.6 Ω (battery) = 5.1 Ω, so τ = 3e-7 × 5.1 / (2.92e-5 + 4.1e-6) ≈ **46 ms**. At 6 V it runs about 188 rpm at the output against the gearbox friction, and the bench measures **K ≈ 0.76 rpm per PWM count** (60 rpm needs 86 counts, 150 rpm needs 205), after a friction deadband of about 7 counts.

**The controller.** Every sample (dt = 10 ms) the sketch computes, with e = setpoint − measured speed:

u = Kp·e + Σ Ki·e·dt − Kd·(rpm − rpm_prev) / dt

The derivative acts on the **measurement**, not the error, so a setpoint step gives no kick. The integral is kept as the term itself (Σ Ki·e·dt), so changing Ki on the slider is bumpless.

**Tuning from the model (IMC).** Choose a closed-loop time constant τc = 0.15 s, about 3 times slower than the plant: safe and smooth. Then Kp = τ / (K·τc) = 0.046 / (0.76 × 0.15) ≈ **0.40**, and Ti = τ, so Ki = Kp / τ ≈ **8.7 per second**. The integral zero cancels the motor's pole, so the closed loop is first order with time constant τc: a step reaches 63 % in about 0.15 s with no overshoot. Ziegler–Nichols gets there by experiment instead: raise Kp until the loop oscillates (Ku ≈ 3 here, period Pu ≈ 0.4 s) and take Kp = 0.45·Ku ≈ 1.35, Ti = Pu / 1.2 ≈ 0.33 s. That works, but it creeps in more slowly than the model-based tuning.

**Sampling.** 100 Hz is about 5 samples per plant time constant, the comfortable minimum. One encoder count in 10 ms is (1/2112) rev / 0.01 s × 60 = **2.84 rpm**: the measurement is a staircase, and Kp and especially Kd turn it into PWM chatter.

**Anti-windup.** When the PWM is pinned at ±255, the sketch stops integrating further into the limit (conditional integration). Otherwise the integral keeps growing while it can do nothing, and pays it back later as overshoot.

*Sim note:* the gains, the loop period and the anti-windup switch are bench sliders that the sketch reads every sample with Tune.kp(), Tune.ki(), Tune.kd(), Tune.periodMs() and Tune.antiWindup(). The brake is a torque on the output shaft, reflected to the motor through the 48:1 gearbox at an illustrative 70 % efficiency. The simulator passes the encoder edges and the PWM between the sketch and the circuit once per animation frame, which adds a few tens of milliseconds of lag to the loop. That is why it oscillates above Kp ≈ 3; an ideal 100 Hz loop on this motor, with only its own sampling lag, would hold out to a Kp of about 14. Every real loop has some such lag, and its limit is set the same way.`,

  mechanicalAnalogy: `You already know this loop: it is a Watt governor, or cruise control. The P term is a spring: the further from the setpoint, the harder it pushes. Alone it leaves a steady droop under load, exactly like a proportional governor. The I term is a slowly winding preload that removes the droop. The D term is a damper on the *speed*, not the position. The motor itself is a mass with viscous damping, a first-order system, so PI is enough.

**Where it breaks:** the actuator has hard limits (±255 counts, the supply voltage) and the sensor is quantised and sampled. Linear control theory assumes neither, so windup, chatter and limit cycles appear that no Bode plot predicted.`,

  proTips: [
    'Identify the plant first. Run an open-loop step (for example PWM 0 → 150), log the speed, and read τ as the time to reach 63 % and K as Δrpm / ΔPWM. Tuning from a measured K and τ beats guessing gains.',
    'Run the loop at a fixed rate. Jitter in dt is noise in both the derivative and the speed estimate. Schedule the tick on a timer interrupt, or on millis() as here, never with a delay(10) after a variable amount of work.',
    'Log setpoint, measurement and output together at 20–100 Hz. Saturation, quantisation and sign errors are obvious on a plot and nearly invisible in numbers.',
  ],

  quiz: [
    {
      q: 'J = 3e-7 kg·m², R_total = 5.1 Ω, ke = kt = 0.0054. Ignoring friction, what is the mechanical time constant?',
      options: ['5 ms', '52 ms', '0.5 s', '5 s'],
      answer: 1,
      why: 'τ = J·R / (kt·ke) = 3e-7 × 5.1 / 2.92e-5 ≈ 0.052 s. The viscous friction b brings it down to 46 ms.',
    },
    {
      q: '2112 counts per output revolution, a 10 ms sample. What speed does one count represent?',
      options: ['0.28 rpm', '2.84 rpm', '28.4 rpm', '60 rpm'],
      answer: 1,
      why: '(1/2112) rev / 0.01 s × 60 s/min = 2.84 rpm.',
    },
    {
      q: 'A P-only speed loop with Kp = 2 PWM counts per rpm on a plant of K = 0.76 rpm per count. Ignoring friction, what fraction of a step setpoint is left as steady-state error?',
      options: ['0 %', 'About 15 %', 'About 40 %', 'About 73 %'],
      answer: 2,
      why: 'e / sp = 1 / (1 + K·Kp) = 1 / (1 + 1.52) ≈ 0.40. Only an integrator drives it to zero.',
    },
    {
      q: 'Why stop integrating while the PWM is saturated?',
      options: [
        'To save CPU time',
        'The integral would keep growing without changing the output, then cause a large overshoot when the error reverses (windup)',
        'The encoder stops counting at full speed',
        'It makes the D term work',
      ],
      answer: 1,
      why: 'The actuator cannot respond, so the integrator stores error it cannot act on. Unwinding it later costs overshoot and delay.',
    },
  ],
}
