// T5 · Quadrature Encoders. Source: docs/curriculum/T5/encoders.md
//
// The TB6612 + GM-48 gear motor bench of `tb6612fng`, with a hall encoder on the motor shaft. The
// `quad-encoder` behavior integrates the motor's ω into A/B edges and hands them to the Uno's
// INT0/INT1 with `mcu.injectEdge`, so the sketch's ×4 table decoder runs on the real edge times.
import type { Element, LessonDef } from '../../engine/types'
import { PITCH, jumper } from '../layout'

// ── bench layout (the 21 × 11.5 motor bench of tb6612fng, plus the encoder on the left) ──
const UNO_AT: [number, number] = [6.3, 0.6] // rot 90: digital header toward the viewer, USB to the right
const HDR: [number, number] = [0.9, 2.6] // 2 × 8 header, rot 90: pins run along z
const BAT: [number, number] = [-0.4, -2.35] // 4 × AA behind the driver, rot 90: leads toward it
const MOT: [number, number] = [-7.0, -1.0] // gear motor at the left, wheel face toward +x
const ENC_AT: [number, number] = [-4.2, 3.0] // the encoder board in front of the motor, clear of the wheel

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
/** the pull-ups lie on the mat in front of the encoder, one under pad A and one under pad B */
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

const float CPR = 11.0 * 4 * 48;      // 2112 counts per output revolution (x4)
const unsigned long WINDOW_MS = 50;   // speed window

// Transition table indexed by (old state << 2) | new state, state = A<<1 | B.
// A leads B going forward: 00 -> 10 -> 11 -> 01 -> 00 is +1 per step.
// 0 = no change, or an invalid jump (both bits changed at once: an edge was missed).
const int QEM[16] = {0, -1, 1, 0,  1, 0, 0, -1,  -1, 0, 0, 1,  0, 1, -1, 0};

volatile long count = 0;               // x4: every edge of both channels
volatile long count2 = 0;              // x2: both edges of A only
volatile long count1 = 0;              // x1: rising edges of A only
volatile int lastState = 0;
volatile unsigned long invalid = 0;

void onEdge() {
  int a = digitalRead(ENC_A);
  int s = (a << 1) | digitalRead(ENC_B);
  int idx = (lastState << 2) | s;
  int step = QEM[idx];
  if (s != lastState && step == 0) {
    invalid++;                         // both bits changed at once: an edge was missed
  }
  count += step;
  if ((s >> 1) != (lastState >> 1)) {  // channel A moved
    count2 += step;
    if (a == 1) {
      count1 += step;
    }
  }
  lastState = s;
}

void motor(int speed) {
  speed = constrain(speed, -255, 255);
  if (speed >= 0) {
    digitalWrite(AIN1, HIGH);
    digitalWrite(AIN2, LOW);
    analogWrite(PWMA, speed);
  } else {
    digitalWrite(AIN1, LOW);
    digitalWrite(AIN2, HIGH);
    analogWrite(PWMA, -speed);
  }
}

unsigned long lastT = 0;
long lastCount = 0;
int demand = 0;
int dir = 1;

void setup() {
  pinMode(ENC_A, INPUT);               // external 10 k pull-ups
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
}

void loop() {
  if (millis() - lastT >= WINDOW_MS) {
    lastT += WINDOW_MS;
    noInterrupts();                    // copy multi-byte volatiles atomically
    long c = count;
    long c2 = count2;
    long c1 = count1;
    unsigned long bad = invalid;
    interrupts();
    long delta = c - lastCount;
    lastCount = c;
    float rpm = delta / CPR * 60000.0 / WINDOW_MS;
    float deg = c * 360.0 / CPR;

    // Triangle sweep of the drive: -200 .. +200, 4 steps per window
    demand = demand + dir * 4;
    if (demand >= 200 || demand <= -200) {
      dir = -dir;
    }
    motor(demand);

    Serial.print("pwm:");
    Serial.print(demand);
    Serial.print(",rpm:");
    Serial.print(rpm);
    Serial.print(",deg:");
    Serial.print(deg);
    Serial.print(",invalid:");
    Serial.print(bad);
    Serial.print(",x4:");
    Serial.print(c);
    Serial.print(",x2:");
    Serial.print(c2);
    Serial.print(",x1:");
    Serial.println(c1);
  }
}
`

export const lesson: LessonDef = {
  id: 'encoders',
  track: 'T5',
  title: 'Quadrature Encoders',
  subtitle: 'Counting with direction',
  tagline: 'A magnetic encoder with 11 pulses per revolution on a 48:1 gear motor, decoded ×4, gives 2112 counts per output turn, or 0.17° per count.',

  guide: [
    {
      id: 'meet-the-encoder',
      title: 'Look at the encoder',
      body: 'Click the **HALL ENCODER** (or its callout). A magnet disc on the motor shaft passes two hall sensors set a quarter of a pulse apart: that offset is how it knows the direction.',
      check: { kind: 'inspect', part: 'enc' },
      focus: { part: 'enc' },
      hint: 'The small dark board behind the motor, or the HALL ENCODER tag above it.',
      explain: 'Both outputs are open drain: they can pull the line low but cannot make a high. That is what the two 10 kΩ pull-ups beside it are for.',
    },
    {
      id: 'power-on',
      title: 'Plug in USB',
      body: 'Press **Plug USB**. The 6 V battery pack is already connected to the driver, but there is no sketch yet, so the motor stays still.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'power' }, { kind: 'status', is: 'POWERED' }] },
      focus: { control: 'power' },
      hint: 'The blue button at the top left of the bench.',
    },
    {
      id: 'upload',
      title: 'Upload the sketch',
      body: 'Press **Upload sketch**. It sweeps the drive up and down and counts every edge of A and B in an interrupt. Watch **SPEED (MEASURED)** follow **SPEED (TRUE)**.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'upload' }, { kind: 'status', is: 'RUNNING' }] },
      focus: { control: 'upload' },
    },
    {
      id: 'reverse',
      title: 'Watch the sign flip',
      body: 'The drive ramps up to +200, then down through zero. Wait until **SPEED (MEASURED)** goes **negative**: the motor is turning the other way, and **POSITION** counts back down.',
      check: { kind: 'readout', index: 1, below: -15, holdMs: 300 },
      hint: 'The sweep takes about 6 s to pass through zero and reverse.',
      explain: 'Direction is whichever channel leads. Going forward A changes first, backward B does. The table decoder turns that order into +1 or −1 per edge.',
    },
    {
      id: 'open-scope',
      title: 'Open the scope',
      body: 'Turn on **Instruments**. CH1 is channel A and CH2 is channel B. Close to a reversal the motor is slow, and the two traces are square waves a quarter of a cycle apart: the one that leads swaps.',
      check: { kind: 'instruments' },
      focus: { control: 'instruments' },
      explain: 'At sweep speed the scope cannot draw every pulse (it samples every 1 ms), so the phase shows best when the motor is slow, close to a reversal.',
    },
    {
      id: 'swap-ab',
      title: 'Swap A and B',
      body: 'Open **Break something** and pick **Swap the A and B wires**. The motor still turns the same way, but **SPEED (MEASURED)** now has the opposite sign to **SPEED (TRUE)**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'break', failure: 'swap-ab' },
          { kind: 'readout', index: 10, below: -50, holdMs: 400 },
        ],
      },
      focus: { control: 'break' },
      hint: 'The motor must be turning for the signs to disagree, so give it a second.',
      explain: 'Nothing is broken in the part. In a speed loop this error is positive feedback: the motor runs away. Check the sign once, with a slow hand turn, before closing any loop.',
    },
    {
      id: 'repair',
      title: 'Wire it back',
      body: 'Open **Break something** and choose **Repair all**.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    {
      id: 'slow-isr',
      title: 'Make the ISR too slow',
      body: 'Slide **ISR cost** up to about **300 µs**, as if the handler did a `Serial.print`. **INVALID TRANSITIONS** starts to climb and **COUNTS LOST** goes up.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'ISR cost', min: 200 },
          { kind: 'readout', index: 5, above: 30, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:ISR cost' },
      hint: 'The slider is logarithmic, about 90 % of the way along. Edges come about 160 µs apart at full sweep.',
      explain: 'An edge that arrives before the last one has been handled is merged with it, so the decoder sees both bits change at once. It cannot tell which way, so it counts 0, and the position drifts.',
    },
    { id: 'quiz', title: 'Check yourself', body: 'Answer the questions below.', check: { kind: 'quiz' }, focus: { control: 'quiz' } },
  ],

  board: {
    name: 'ENCODER BENCH',
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
        role: 'Decodes A and B on INT0 (pin 2) and INT1 (pin 3), and drives the motor: pin 5 is PWMA, 7 and 8 are AIN1/AIN2, 4 is STBY.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [1.5, 1.6, 0.6] },
        facts: [
          'INT0 = PD2 (pin 2), INT1 = PD3 (pin 3)',
          'Interrupt response: 4 clock cycles minimum (0.25 µs at 16 MHz), then the vector jump',
          'digitalRead takes roughly 4 µs on an Uno (about 60 cycles)',
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
        role: 'TB6612FNG dual H-bridge breakout (see the TB6612FNG lesson). Drives the motor from pin 5 (PWM), 7 and 8 (direction) and 4 (standby).',
        params: { package: 'SSOP', pins: 24, marking: 'TB6612\nFNG', callout: [-1.8, 2.2, -0.6] },
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
        role: "Supplies the current pulses of PWM so the battery leads don't have to (100 µF, 16 V).",
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
        role: 'Motor supply: 4 × AA, about 0.6 Ω internal resistance for fresh alkalines (approximate). Its switch is the Battery switch tweak.',
        params: { cells: 4, callout: [0.6, 1.2, -0.8] },
        circuitIds: ['bat', 'bat_sw'],
      },
      {
        id: 'mot',
        kind: 'gear-motor-wheel',
        pos: [MOT[0], 0, MOT[1]],
        rot: 90,
        mount: 'offboard',
        label: 'GEAR MOTOR',
        role: "GM-48, the course's representative 6 V gear motor: 4 Ω winding, 48:1 gearbox, about 190 rpm at the output shaft unloaded. The encoder sits on the fast motor shaft, before the gearbox.",
        params: { marking: '1:48', callout: [-3.0, -1.6, 0.6] },
        circuitIds: ['m1'],
      },
      {
        id: 'enc',
        kind: 'module',
        pos: [ENC_AT[0], 0, ENC_AT[1]],
        mount: 'offboard',
        label: 'HALL ENCODER',
        role: 'A magnet disc on the motor shaft with two hall sensors a quarter of a pulse apart: channels A and B, 11 pulses per motor revolution each (representative; counts vary by model). Open-drain outputs.',
        params: { w: 2.9, d: 1.1, pins: 0, chip: 'none', title: 'HALL ENCODER', color: '#2a3a52', callout: [-0.6, 1.6, -0.5] },
        facts: [
          'A and B are 90° apart electrically, so one pulse gives 4 edges (×4 decoding)',
          '11 pulses per motor revolution is common on small gear-motor encoders; check your datasheet',
          'Open-drain outputs need a pull-up (4.7 kΩ to 10 kΩ)',
        ],
        circuitIds: ['enc_sa', 'enc_sb', 'i_enc'],
      },
      {
        id: 'r_pa',
        kind: 'resistor',
        pos: [encPad(4)[0], 0.12, R_Z],
        rot: 90,
        mount: 'tht',
        label: 'PULL-UP A',
        role: 'Gives channel A a HIGH level: 10 kΩ from 5 V to the A line (brown-black-orange-gold).',
        params: { ohms: 10000, callout: [0.5, 1.2, 0.2] },
        circuitIds: ['r_pa'],
        facts: ['5 V / 10 kΩ = 0.5 mA while the sensor holds the line low'],
      },
      {
        id: 'r_pb',
        kind: 'resistor',
        pos: [encPad(5)[0], 0.12, R_Z],
        rot: 90,
        mount: 'tht',
        label: 'PULL-UP B',
        role: 'Gives channel B a HIGH level: 10 kΩ from 5 V to the B line (brown-black-orange-gold).',
        params: { ohms: 10000, callout: [0.5, 1.2, 0.2] },
        circuitIds: ['r_pb'],
        facts: ['5 V / 10 kΩ = 0.5 mA while the sensor holds the line low'],
      },
      { id: 'w_pwm', kind: 'wire', ...wire(jumper(unoDigital(5), hdrPin(1, 0), 'yellow', 0.7), [0.6, 0.9, 0.4]), mount: 'offboard', role: 'Pin 5 (PWM, ~980 Hz) to PWMA.' },
      { id: 'w_ain2', kind: 'wire', ...wire(jumper(unoDigital(8), hdrPin(1, 1), 'green', 0.9), [0.4, 0.8, 0.2]), mount: 'offboard', role: 'Pin 8 to AIN2.' },
      { id: 'w_ain1', kind: 'wire', ...wire(jumper(unoDigital(7), hdrPin(1, 2), 'blue', 0.8), [0.2, 0.8, 0]), mount: 'offboard', role: 'Pin 7 to AIN1.' },
      { id: 'w_stby', kind: 'wire', ...wire(jumper(unoDigital(4), hdrPin(1, 3), 'white', 0.6), [0, 0.7, -0.2]), mount: 'offboard', role: 'Pin 4 to STBY: HIGH wakes the driver.' },
      { id: 'w_vcc', kind: 'wire', ...wire(jumper(unoPower(4), hdrPin(0, 1), 'red', 1.1), [0, 0.8, -0.4]), mount: 'offboard', role: "Uno 5 V to the driver's logic supply VCC." },
      { id: 'w_gnd', kind: 'wire', ...wire(jumper(unoPower(5), hdrPin(1, 7), 'black', 0.9), [2.4, 0.3, 1.4]), mount: 'offboard', label: 'COMMON GND', role: 'The common ground: Uno GND to the driver GND (and so to the battery negative).' },
      { id: 'w_vm', kind: 'wire', ...wire(jumper(BAT_RED, hdrPin(0, 0), 'red', 0.7), [0, 0.6, 0.3]), mount: 'offboard', role: 'Battery + to VM.' },
      { id: 'w_bgnd', kind: 'wire', ...wire(jumper(BAT_BLACK, hdrPin(0, 2), 'black', 0.6), [-0.2, 0.5, 0.2]), mount: 'offboard', role: 'Battery − to the driver GND.' },
      { id: 'w_ao1', kind: 'wire', ...wire(jumper(MOT_T1, hdrPin(0, 3), 'orange', 0.4), [0, 0.5, 0]), mount: 'offboard', role: "AO1 to the motor's + terminal." },
      { id: 'w_ao2', kind: 'wire', ...wire(jumper(MOT_T2, hdrPin(0, 4), 'brown', 0.4), [0, 0.5, 0]), mount: 'offboard', role: "AO2 to the motor's − terminal." },
      { id: 'w_a', kind: 'wire', ...wire(jumper(encPad(4), unoDigital(2), 'yellow', 1.5), [0.4, 1.0, 0.4]), mount: 'offboard', label: 'A', role: 'Channel A to pin 2 (INT0).' },
      { id: 'w_b', kind: 'wire', ...wire(jumper(encPad(5), unoDigital(3), 'green', 1.9), [0.4, 1.1, 0.2]), mount: 'offboard', label: 'B', role: 'Channel B to pin 3 (INT1).' },
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
      // two hall sensors, a few mA each (approximate)
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
      // GM-48 (representative values; measure your own)
      { id: 'm1', type: 'MOTOR', nodes: ['ao1', 'ao2'], r: 4, l: 0.5e-3, ke: 0.0054, kt: 0.0054, j: 3e-7, b: 8e-7, load: 0, rating: { maxI: 2 }, partId: 'mot' },
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
    { id: 'mcu-supply', instance: 'mcu', params: { supplyNode: '5v', bor: 2.7, fClk: 16 } },
    { id: 'serial-plotter', instance: 'serial' },
  ],

  readouts: [
    { label: 'SPEED (TRUE)', source: { kind: 'behavior', key: 'enc.rpm_out_true' }, unit: 'rpm' },
    { label: 'SPEED (MEASURED)', source: { kind: 'behavior', key: 'serial.rpm' }, unit: 'rpm' },
    { label: 'POSITION', source: { kind: 'behavior', key: 'serial.deg' }, unit: '°' },
    { label: 'POSITION (TRUE)', source: { kind: 'behavior', key: 'enc.deg_out_true' }, unit: '°' },
    { label: 'EDGE RATE', source: { kind: 'behavior', key: 'enc.edge_rate' }, unit: 'Hz' },
    { label: 'INVALID TRANSITIONS', source: { kind: 'behavior', key: 'serial.invalid' }, unit: '', digits: 1 },
    { label: 'ENC A PIN', source: { kind: 'voltage', node: 'd2' }, unit: 'V' },
    { label: 'COUNT (TRUE)', source: { kind: 'behavior', key: 'enc.count_sync' }, unit: 'counts' },
    { label: 'COUNT (SKETCH)', source: { kind: 'behavior', key: 'serial.x4' }, unit: 'counts' },
    { label: 'COUNTS LOST', source: { kind: 'derived', op: 'diff', of: [7, 8] }, unit: 'counts' },
    { label: 'SIGN CHECK (+ = AGREE)', source: { kind: 'derived', op: 'product', of: [0, 1] }, unit: '' },
  ],

  // CH1 is channel A and CH2 channel B on pins 2 and 3. At sweep speed the 1 ms steps can't draw
  // every pulse, so the phase is clearest close to a reversal, when the motor is slow.
  instruments: {
    open: false,
    scope: {
      channels: [
        { label: 'A (PIN 2)', source: { kind: 'voltage', node: 'd2' }, perDiv: 2, offset: 1.5 },
        { label: 'B (PIN 3)', source: { kind: 'voltage', node: 'd3' }, perDiv: 2, offset: -2 },
      ],
      timePerDiv: 20e-3,
      trigger: { channel: 0, level: 2.5, slope: 'falling', mode: 'auto' },
    },
    chart: { signals: [0, 1, 3, 2], span: 12 },
  },

  sketch: { title: '×4 decoder and speed', code: SKETCH, pins: { 2: 'pin2', 3: 'pin3', 4: 'pin4', 5: 'pin5', 7: 'pin7', 8: 'pin8' }, vcc: 5, board: 'uno' },

  tweaks: [
    { label: 'Battery switch', elementId: 'bat_sw', key: 'closed', kind: 'toggle', min: 0, max: 1, unit: '' },
    { label: 'Motor supply', elementId: 'bat', key: 'value', min: 3, max: 12, step: 0.1, unit: 'V' },
    { label: 'ISR cost', elementId: 'behavior:enc', key: 'isrUs', min: 4, max: 500, log: true, unit: 'µs' },
    { label: 'Glitch rate', elementId: 'behavior:enc', key: 'glitchRate', min: 0, max: 200, step: 1, unit: '/s' },
    { label: 'Swap A and B', elementId: 'behavior:enc', key: 'swapAB', kind: 'toggle', min: 0, max: 1, unit: '' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: upload the sketch. The motor battery is connected through the driver, which waits for STBY.' },
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: the drive sweeps ±200. True speed {0}, measured {1}, {4} of edges. Watch the sign of the speed follow the direction.' },
    { when: { kind: 'above', readout: 5, value: 0 }, text: 'Invalid transitions: {5}. Edges are arriving too fast, or too noisy, for the ISR, and {9} are lost.' },
  ],

  failures: [
    {
      id: 'no-pullups',
      label: 'Leave out the pull-ups',
      explain:
        'The hall outputs are open drain: they can pull the line low but cannot make a high. With no pull-up the two inputs float and pick up switching noise from the motor driver right beside them. The sketch gets random edges at a few hundred Hz even with the motor stopped, so POSITION wanders as the noise steps the count up and down, and COUNTS LOST grows. Fit 4.7 to 10 kΩ pull-ups, or use INPUT_PULLUP for short cables only: its 20 to 50 kΩ is weak against noise.',
      patches: [
        { op: 'remove', elementId: 'r_pa' },
        { op: 'remove', elementId: 'r_pb' },
      ],
      parts: { hide: ['r_pa', 'r_pb', 'w_pa_hi', 'w_pa_lo', 'w_pb_hi', 'w_pb_lo'] },
    },
    {
      id: 'swap-ab',
      label: 'Swap the A and B wires',
      explain:
        "Direction comes only from which channel leads. With A on pin 3 and B on pin 2 the motor turns the same way, but the sketch sees the other order, so it counts backwards and reads a negative speed for a forward turn. In this open-loop sketch nothing else happens. In the next lesson's PID loop it is positive feedback, and the motor runs away at full speed. Check the sign once, with a slow hand turn, before closing any loop.",
      patches: [{ op: 'set', elementId: 'behavior:enc', key: 'swapAB', value: 1 }],
    },
    {
      id: 'noisy-12v',
      label: 'Overdrive it on 12 V with noisy wiring',
      explain:
        "On 12 V the sketch's 200/255 drive spins the motor shaft at about 14 500 rpm, so the edge rate is 11 × 4 × 14 500 / 60 ≈ 10 600 per second, about 94 µs apart (at full duty it would be nearer 20 000 rpm and 67 µs). A 12 µs ISR still keeps up, but the long motor wires now couple spikes into both encoder lines at once. Each spike gives the table decoder two invalid jumps, and a real edge that lands inside one can be mis-stepped, so COUNTS LOST creeps up by a few counts every ten seconds or so. An encoder is only as good as its edges: use twisted or shielded cable away from the motor leads, add a small RC filter (100 Ω and 1 nF is τ = 0.1 µs and leaves real edges intact), or use a hardware quadrature decoder. And 12 V on a 6 V motor is a life-and-heat problem of its own.",
      patches: [
        { op: 'set', elementId: 'bat', key: 'value', value: 12 },
        { op: 'set', elementId: 'behavior:enc', key: 'glitchRate', value: 150 },
      ],
    },
  ],

  meet: `Two hall sensors sit a quarter of a pulse apart around a magnet disc, so A and B are square waves in **quadrature**. Turning forward, the state (A, B) steps 00 → 10 → 11 → 01: A leads B. Backward, it runs the other way. Each change is one count, and the direction is whichever way the sequence goes.

**Counting modes:** ×1 counts rising edges of A only, ×2 counts both edges of A, and ×4 counts every edge of both. With 11 pulses per revolution at the motor and a 48:1 gearbox, ×4 gives 11 × 4 × 48 = **2112 counts per output revolution**, or 360 / 2112 = **0.17°** per count. The sketch keeps all three counts, so you can see ×2 read half of ×4 and ×1 a quarter.

**Speed:** counts in a window divided by the window length. At 100 rpm on the output, 100 / 60 × 2112 = 3520 counts/s, so a 50 ms window catches 176 counts, a resolution of 100 / 176 ≈ 0.57 rpm. A shorter window reacts faster but is coarser: at 10 ms, one count is **2.8 rpm**.

**ISR load:** that 3520 counts/s is 3520 interrupts a second. Each one costs about 12 µs on an Uno (two \`digitalRead\` calls at about 4 µs each, plus entry and exit), about 4 % of the CPU. At the motor's full speed (about 190 rpm out, 6700 edges/s) it is about 8 %. That is fine, but at much higher rates you would use direct port reads (about ten times faster than \`digitalRead\`) or a chip with a hardware decoder (the ESP32's PCNT, or STM32 timers).

**The table decoder** rejects "both bits changed" as invalid instead of guessing.

*Sim note:* the \`quad-encoder\` behavior integrates the motor's speed into edges and hands each one to the Uno at its exact microsecond, so the interrupts see the real edge times. An edge that arrives before the previous one has been handled is merged with it. The scope samples every 1 ms, so it shows the A/B phase only when the motor is slow.`,

  mechanicalAnalogy: `An incremental encoder is a dial indicator that counts revolutions of a fine-pitch screw but never reads the absolute position. Two pickups a quarter-pitch apart tell you which way the spindle turned, like the two tracks on a machine tool's glass scale. ×4 decoding uses every line edge as a graduation.

**Where it breaks:** if power drops or an edge is missed there is no absolute reference. Like a dial indicator that has been bumped, it must be re-zeroed against a home switch or index pulse before the count means position again.`,

  proTips: [
    'Put the encoder on the **motor** shaft, before the gearbox, when you want resolution. The gear ratio multiplies your counts. Put it on the **output** when you need to see the backlash.',
    'Measure speed by counting at high speed and by timing between edges (`micros()` in the ISR) at low speed. Production motor controllers switch between the two around a few hundred counts per second.',
    'Read multi-byte counts with interrupts briefly disabled (as in the sketch). A torn read of a 32-bit `long` on an 8-bit AVR produces rare, huge, unexplained jumps.',
  ],

  quiz: [
    {
      q: '11 PPR on the motor shaft, ×4 decoding, 48:1 gearbox. How many counts per output revolution?',
      options: ['44', '528', '2112', '8448'],
      answer: 2,
      why: '11 × 4 × 48 = 2112.',
    },
    {
      q: 'You count 1760 counts in 0.5 s on that system. What is the output speed?',
      options: ['50 rpm', '100 rpm', '176 rpm', '3520 rpm'],
      answer: 1,
      why: '1760 / 2112 = 0.833 rev in 0.5 s = 1.667 rev/s = 100 rpm.',
    },
    {
      q: 'With a 10 ms speed window and 2112 counts/rev, what is the speed resolution (one count)?',
      options: ['0.17 rpm', '0.57 rpm', '2.84 rpm', '28.4 rpm'],
      answer: 2,
      why: '1 count / 2112 rev × (60 000 ms/min ÷ 10 ms) = 2.84 rpm.',
    },
    {
      q: 'The sequence 00 → 11 appears between two samples. What does a good decoder do?',
      options: ['Counts +2', 'Counts −2', 'Counts 0 and flags an invalid transition (an edge was missed)', 'Resets the count'],
      answer: 2,
      why: 'Both bits changing at once means a state was skipped, and its direction is unknowable. Counting it as an error keeps the count honest.',
    },
  ],
}
