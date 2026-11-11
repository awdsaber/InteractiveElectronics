// T7 · Capstone: the two-wheel balancing robot. Source: docs/curriculum/T7/capstone-balancing-robot.md
//
// An Uno reads an MPU-6050 over I²C, fuses gyro and accelerometer with a complementary filter, and drives two
// TT-class 48:1 gear motors through a TB6612FNG from a 2S Li-ion pack, with the left wheel's encoder for the
// speed loop. The robot itself is `balance-bot`: a wheeled inverted pendulum co-simulated with the two MOTOR
// elements (their shaft speed is prescribed from the pendulum every step, the circuit solves the currents and
// so the torque). Its pitch feeds the IMU every step, and the whole board (BoardSpec.dynamic) tilts and rolls.
// The gains and filter knobs are `pid-tune` sliders the sketch reads every loop, so no re-upload is needed.
import { DEFAULT_SKETCH_GAINS } from '../../engine/robot/pendulum'
import type { Element, LessonDef, PartPlacement } from '../../engine/types'

// ── geometry, board units (1 = 10 mm). y = 0 is the lower deck (the PCB); the board is lifted 4.5 onto its wheels ──
const LIFT = 4.5
/** the axle: 3.3 above the mat (65 mm wheels), so 1.2 below the deck */
const AXLE_Y = 3.3 - LIFT
const DECK2 = 5.0
const DECK3 = 10.0
const POST = '#d9d4c7'

type V3 = [number, number, number]

/** a wire along a polyline (no arch), absolute board points */
function route(id: string, pts: V3[], color: string, role: string, extra: Partial<PartPlacement> = {}): PartPlacement {
  const [ox, oy, oz] = pts[0]
  return {
    id,
    kind: 'wire',
    pos: [ox, oy, oz],
    mount: 'offboard',
    role,
    params: { points: pts.map(([x, y, z]) => [+(x - ox).toFixed(3), +(y - oy).toFixed(3), +(z - oz).toFixed(3)]), arch: false, tips: false, color, radius: 0.05 },
    ...extra,
  }
}

/** an M3 standoff between two decks */
function post(id: string, x: number, z: number, y0: number, y1: number): PartPlacement {
  return {
    id,
    kind: 'wire',
    pos: [x, y0, z],
    mount: 'offboard',
    role: 'M3 nylon standoff: the decks are one rigid body, so the battery up top raises the centre of mass.',
    params: { points: [[0, 0, 0], [0, y1 - y0, 0]], arch: false, tips: false, color: POST, radius: 0.14 },
  }
}

const DIODE = { is: 1e-9, n: 1.8, rating: { maxI: 3 }, partId: 'drv' }
const bodyDiode = (id: string, a: string, k: string): Element => ({ id, type: 'D', nodes: [a, k], ...DIODE })
const pin = (n: number): Element => ({ id: `pin${n}`, type: 'PIN', nodes: [`d${n}`, '0'], pin: n, vcc: 5, vccNode: '5v', partId: 'uno' })
const rIn = (n: number): Element => ({ id: `r_in${n}`, type: 'R', nodes: [`d${n}`, '0'], value: 200e3, partId: 'drv' })
/** one TB6612 channel: two averaged half-bridges (V behind Ron/2, a high-Z switch) and four body diodes */
function bridge(ch: 'l' | 'r', o1: string, o2: string): Element[] {
  return [
    { id: `ha_${ch}`, type: 'V', nodes: [`ha_${ch}i`, '0'], value: 0, partId: 'drv' },
    { id: `ron_a${ch}`, type: 'R', nodes: [`ha_${ch}i`, `sa_${ch}`], value: 0.25, rating: { maxI: 3.2 }, partId: 'drv' },
    { id: `en_a${ch}`, type: 'SW', nodes: [`sa_${ch}`, o1], closed: false, partId: 'drv' },
    { id: `hb_${ch}`, type: 'V', nodes: [`hb_${ch}i`, '0'], value: 0, partId: 'drv' },
    { id: `ron_b${ch}`, type: 'R', nodes: [`hb_${ch}i`, `sb_${ch}`], value: 0.25, rating: { maxI: 3.2 }, partId: 'drv' },
    { id: `en_b${ch}`, type: 'SW', nodes: [`sb_${ch}`, o2], closed: false, partId: 'drv' },
    bodyDiode(`db_${ch}1h`, o1, 'vbat'),
    bodyDiode(`db_${ch}1l`, '0', o1),
    bodyDiode(`db_${ch}2h`, o2, 'vbat'),
    bodyDiode(`db_${ch}2l`, '0', o2),
  ]
}
/** a TT-class 48:1 gear motor (the course's representative values); its shaft speed is set by balance-bot */
const motor = (id: string, a: string, b: string, partId: string): Element => ({
  id,
  type: 'MOTOR',
  nodes: [a, b],
  r: 4,
  l: 0.5e-3,
  ke: 0.0054,
  kt: 0.0054,
  j: 3e-7,
  b: 8e-7,
  omegaSet: 0,
  rating: { maxI: 2 },
  partId,
})

const G0 = DEFAULT_SKETCH_GAINS

const SKETCH = `#include <Wire.h>
#include <MPU6050.h>
// Real code: MPU6050 mpu;   The bench provides \`mpu\`, and \`Tune\` hands over the bench's sliders.

const int   MAX_PWM   = 182;     // 6 V motors on an 8.4 V pack: 6 / 8.4 * 255
const float FALL_DEG  = 40.0;    // past this it cannot recover: motors off
const float MAX_LEAN  = 10.0;    // the speed loop may ask for +/-10 degrees: braking at up to g*tan(10) = 1.7 m/s^2
const float GYRO_SENS = 131.0;   // LSB per deg/s at +/-250 deg/s
const float CPR = 2112.0;        // 11 PPR x 4 edges x 48:1 = counts per wheel turn

#define STBY 4
#define PWMA 5
#define PWMB 6
#define AIN1 7
#define AIN2 8
#define BIN1 9
#define BIN2 10
#define ENC_A 2
#define ENC_B 3

// x4 table decoder, state = A<<1 | B. A leads B going forward: 00 -> 10 -> 11 -> 01 is +1 per step.
const int QEM[16] = {0, -1, 1, 0,  1, 0, 0, -1,  -1, 0, 0, 1,  0, 1, -1, 0};
volatile long count = 0;
volatile int lastState = 0;

void onEdge() {
  int s = (digitalRead(ENC_A) << 1) | digitalRead(ENC_B);
  count += QEM[(lastState << 2) | s];
  lastState = s;
}

float gyroBias = 0;
float pitch = 0;
float iTerm = 0;
float wheelRpm = 0;
float target = 0;
float u = 0;
long lastCount = 0;
unsigned long lastSpeedAt = 0;
unsigned long nextTick = 0;
unsigned long nextPrint = 0;
int armed = 0;

// both wheels the same way: + drives forward
void drive(float cmd) {
  int pwm = constrain(cmd, -MAX_PWM, MAX_PWM);
  if (pwm >= 0) {
    digitalWrite(AIN1, HIGH);
    digitalWrite(AIN2, LOW);
    digitalWrite(BIN1, HIGH);
    digitalWrite(BIN2, LOW);
    analogWrite(PWMA, pwm);
    analogWrite(PWMB, pwm);
  } else {
    digitalWrite(AIN1, LOW);
    digitalWrite(AIN2, HIGH);
    digitalWrite(BIN1, LOW);
    digitalWrite(BIN2, HIGH);
    analogWrite(PWMA, -pwm);
    analogWrite(PWMB, -pwm);
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.setClock(400000);
  pinMode(STBY, OUTPUT);
  pinMode(PWMA, OUTPUT);
  pinMode(PWMB, OUTPUT);
  pinMode(AIN1, OUTPUT);
  pinMode(AIN2, OUTPUT);
  pinMode(BIN1, OUTPUT);
  pinMode(BIN2, OUTPUT);
  pinMode(ENC_A, INPUT);         // external 10 k pull-ups
  pinMode(ENC_B, INPUT);
  digitalWrite(STBY, HIGH);

  mpu.initialize();
  if (!mpu.testConnection()) {
    Serial.println("IMU missing: motors stay off");
    while (true) {
      delay(1000);
    }
  }
  mpu.setDLPFMode(3);            // 44 Hz, about 5 ms of delay: fine at 200 Hz

  Serial.println("Hold it upright and still: calibrating");
  long sum = 0;
  for (int i = 0; i < 400; i++) {
    sum += mpu.getRotationY();
    delay(2);
  }
  gyroBias = sum / 400.0;
  pitch = atan2(-1.0 * mpu.getAccelerationX(), mpu.getAccelerationZ()) * 180.0 / PI;

  lastState = (digitalRead(ENC_A) << 1) | digitalRead(ENC_B);
  attachInterrupt(digitalPinToInterrupt(ENC_A), onEdge, CHANGE);
  attachInterrupt(digitalPinToInterrupt(ENC_B), onEdge, CHANGE);

  float vbat = analogRead(A0) * 5.0 / 1024.0 * 3.0;
  Serial.print("battery V:");
  Serial.println(vbat);
  nextTick = millis();
  lastSpeedAt = millis();
}

void loop() {
  // Fixed-rate tick on millis(): the work below never shifts the next sample.
  long wait = nextTick - millis();
  if (wait > 0) {
    delay(wait);
  }
  int periodMs = Tune.periodMs();            // the bench's Loop period
  nextTick += periodMs;
  float dt = periodMs / 1000.0;
  float alpha = Tune.get("alpha", 0.98);     // the bench's filter alpha

  // 1. Estimate the pitch: the complementary filter.
  float rate = (mpu.getRotationY() - gyroBias) / GYRO_SENS;      // deg/s
  float accelPitch = atan2(-1.0 * mpu.getAccelerationX(), mpu.getAccelerationZ()) * 180.0 / PI;
  pitch = alpha * (pitch + rate * dt) + (1.0 - alpha) * accelPitch;

  // 2. Wheel speed every 20 ms from the left encoder (output rpm, wheel against the body).
  unsigned long now = millis();
  if (now - lastSpeedAt >= 20) {
    noInterrupts();
    long c = count;
    interrupts();
    wheelRpm = (c - lastCount) / CPR * 60000.0 / (now - lastSpeedAt);
    lastCount = c;
    lastSpeedAt = now;
  }

  // 3. Safety: lying down -> motors off until it is stood up again.
  if (abs(pitch) > FALL_DEG) {
    armed = 0;
  }
  if (armed == 0 && abs(pitch) < 3.0) {
    armed = 1;
    iTerm = 0;
  }

  if (armed == 1) {
    // 4. Outer loop: lean against the wheel speed, so it stays put (and the trim sets the balance point).
    float trim = Tune.get("trim", 0);
    target = constrain(trim - Tune.get("kv", ${G0.kv}) * wheelRpm, trim - MAX_LEAN, trim + MAX_LEAN);

    // 5. Inner loop: PID on the tilt, with the gyro rate as the derivative.
    float err = pitch - target;
    iTerm = constrain(iTerm + Tune.ki() * err * dt, -60.0, 60.0);
    u = constrain(Tune.kp() * err + iTerm + Tune.kd() * rate, -MAX_PWM, MAX_PWM);
    drive(u);
  } else {
    u = 0;
    analogWrite(PWMA, 0);
    analogWrite(PWMB, 0);
  }

  if (millis() >= nextPrint) {               // 20 Hz to the plotter
    nextPrint += 50;
    Serial.print("pitch:");
    Serial.print(pitch);
    Serial.print(",target:");
    Serial.print(target);
    Serial.print(",u:");
    Serial.print(u);
    Serial.print(",rpm:");
    Serial.print(wheelRpm);
    Serial.print(",armed:");
    Serial.println(armed);
  }
}
`

// ── parts ──
const MOT_R: V3 = [0, -LIFT, 2.25] // rot 0: wheel toward +z
const MOT_L: V3 = [0, -LIFT, -2.25] // rot 180: wheel toward −z
const DRV: V3 = [-2.4, 0, 0]
const IMU: V3 = [1.3, 0, 0]
const UNO: V3 = [-1.4, DECK2 + 0.16, 0]
const BAT: V3 = [0.2, DECK3 + 0.16, 0]
const SW: V3 = [4.5, 0, 1.3]

export const lesson: LessonDef = {
  id: 'capstone-balancing-robot',
  track: 'T7',
  title: 'Capstone: Two-Wheel Balancer',
  subtitle: 'IMU, driver, PID: together',
  tagline:
    'Its centre of mass sits 8 cm above the axle, so left alone the tilt doubles every 84 ms. Two hundred times a second the robot fuses gyro and accelerometer, decides how far it is from upright, and drives its wheels back under itself.',

  guide: [
    {
      id: 'power-on',
      title: 'Switch it on',
      body: 'Slide the **Power switch** on. The 2S pack feeds the driver’s VM and, through VIN and the regulator, the Uno. Nothing drives the wheels until a sketch runs, so for now you are holding the robot upright.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'power' }, { kind: 'status', is: 'POWERED' }] },
      focus: { control: 'power' },
      hint: 'The power button at the top left of the bench.',
    },
    {
      id: 'upload',
      title: 'Upload the balance loop',
      body: 'Press **Upload sketch**. It averages the gyro for 0.8 s while you hold it still (its bias), then you let go and the 200 Hz loop takes over. Open **Instruments**: the strip chart shows **TRUE PITCH**, **ESTIMATED PITCH** and **TARGET LEAN**.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'upload' }, { kind: 'status', is: 'RUNNING' }] },
      focus: { control: 'upload' },
      explain: 'Calibrating the gyro first matters: its zero-rate output is about 2 °/s here, which would add 2° of tilt every second to an integrated angle.',
    },
    {
      id: 'stand',
      title: 'Watch it stand',
      body: 'Once you let go it stands by itself: **TRUE PITCH** stays within **±1°**, and **ESTIMATED PITCH** (what the sketch believes) follows it within a fraction of a degree. The board on the bench tilts with every correction.',
      check: {
        kind: 'all',
        of: [
          { kind: 'readout', index: 13, below: 0.5 },
          { kind: 'readout', index: 9, below: 0.5 },
          { kind: 'readout', index: 0, above: -1, below: 1, holdMs: 2000 },
          { kind: 'readout', index: 11, above: -1, below: 1 },
        ],
      },
      focus: { part: 'imu' },
      explain: 'Kp = 20.7, Kd = 2.3 and KV = 0.11 are not tuned by hand: on the linearised model they place the closed-loop poles at −12 ± 9i rad/s (ω_n 15 rad/s, ζ 0.8) and −3 rad/s, against an open-loop fall at +7.4 rad/s. Meet the board has the derivation.',
    },
    {
      id: 'push',
      title: 'Push it',
      body: 'Press **Push**: 3 N at the centre of mass for 50 ms. Watch the board tip, the wheels run under it, **TARGET LEAN** swing back to slow it, and **TRUE PITCH** settle within about a second. **RING AFTER PUSH** (the rms pitch rate 0.3–1.5 s after it) shows how hard it was still swinging.',
      check: {
        kind: 'all',
        of: [
          { kind: 'readout', index: 14, above: 0.5 },
          { kind: 'readout', index: 16, above: 0.5, below: 50 },
          { kind: 'readout', index: 9, below: 0.5 },
          { kind: 'readout', index: 0, above: -2, below: 2, holdMs: 500 },
        ],
      },
      focus: { control: 'tweak:Push' },
      hint: 'Push is a press-and-hold button; a short press is enough. RING AFTER PUSH updates 1.5 s later.',
      explain: 'The push tips it forward, so the inner loop drives forward to get the wheels back under the centre of mass. Then the robot is moving, and the speed loop asks for a lean backwards (up to 10°) to stop it. That is the cascade: speed → target angle → PWM. It ends about 10 cm away: nothing in this sketch holds the position.',
    },
    {
      id: 'break-filter',
      title: 'Break the filter',
      body: 'Open **Break something** and pick **No filter: accelerometer only (α = 0)**. The estimate now jumps by several degrees whenever the robot accelerates, the loop chases those jumps, and it falls within a couple of seconds.',
      check: {
        kind: 'all',
        of: [
          { kind: 'break', failure: 'accel-only' },
          { kind: 'readout', index: 9, above: 0.5 },
        ],
      },
      focus: { control: 'break' },
      explain: 'An accelerometer cannot tell tilt from acceleration: driving forward at 1 m/s² tilts the measured gravity by atan(1/9.81) ≈ 6°. The gyro is clean over short times but drifts; the accelerometer is right on average but noisy and fooled by every catch. The complementary filter trusts the gyro over τ = 0.245 s and the accelerometer beyond it.',
    },
    {
      id: 'repair',
      title: 'Fix it',
      body: 'Choose **Repair all**. The sketch restarts, calibrates while it is held upright, and balances again.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'repair' },
          { kind: 'readout', index: 9, below: 0.5 },
          { kind: 'readout', index: 13, below: 0.5 },
          { kind: 'readout', index: 0, above: -2, below: 2, holdMs: 1000 },
        ],
      },
      focus: { control: 'break' },
    },
    {
      id: 'slow-loop',
      title: 'Slow the loop down',
      body: 'Now pick **Run the loop at 10 Hz (100 ms)**. The same gains, but each correction is now based on a measurement up to 100 ms old and held for 100 ms. It shakes, swings wider each time, and falls within a few seconds.',
      check: {
        kind: 'all',
        of: [
          { kind: 'break', failure: 'slow-loop' },
          { kind: 'readout', index: 9, above: 0.5 },
        ],
      },
      focus: { control: 'break' },
      explain: 'The open-loop pole is +7.4 rad/s: left alone the tilt doubles every 94 ms. A loop must sample several times inside that window; at 100 ms it gets less than one look per doubling. The sample-and-hold delay of T/2 alone costs ω·T/2 of phase at the 15 rad/s loop frequency: 2° at 200 Hz, 43° at 10 Hz, more than the margin these gains have.',
    },
    {
      id: 'gyro-drift',
      title: 'Now trust only the gyro',
      body: 'Choose **Repair all** and let it stand again. Then pick **No filter: gyro only (α = 1), and the chip warms up**. Watch **ESTIMATE ERROR**: it creeps by about 0.6° every second, so the robot leans further and further from where it thinks upright is, and runs away.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'repair' },
          { kind: 'break', failure: 'gyro-only' },
          { kind: 'any', of: [{ kind: 'readout', index: 11, above: 3 }, { kind: 'readout', index: 11, below: -3 }] },
        ],
      },
      focus: { control: 'break' },
      explain: 'The gyro’s zero-rate output depends on temperature (here 0.03 °/s per °C, illustrative): the bias the sketch measured at start-up is wrong 20 °C later, and an integrated rate turns a constant error into a growing angle. The complementary filter’s accelerometer path is what pulls the estimate back to gravity.',
    },
    { id: 'quiz', title: 'Check yourself', body: 'Answer the questions below.', check: { kind: 'quiz' }, focus: { control: 'quiz' } },
  ],

  board: {
    name: 'BALANCER',
    size: [11, 4.4],
    base: 'mat',
    frame: { size: [30, 22], center: [0, -2] },
    dynamic: { lift: LIFT, pivot: [0, AXLE_Y, 0], pitchKey: 'bot.pitch', travelKey: 'bot.x_m', unitsPerM: 100, maxTravel: 8 },
    parts: [
      {
        id: 'm_r',
        kind: 'gear-motor-wheel',
        pos: MOT_R,
        mount: 'offboard',
        label: 'RIGHT MOTOR',
        role: 'TT-class 48:1 gear motor with a 65 mm wheel, on driver channel B. Its rotor, reflected through the gearbox (48² = 2304), weighs on the wheel like 0.65 kg of extra cart.',
        params: { marking: '1:48', callout: [1.4, -1.6, 1.4] },
        facts: ['Representative values: R 4 Ω, ke = kt = 0.0054 V·s/rad, J 3e-7 kg·m², b 8e-7 N·m·s', 'About 190 rpm at the output unloaded on 6 V'],
        circuitIds: ['m_r'],
      },
      {
        id: 'm_l',
        kind: 'gear-motor-wheel',
        pos: MOT_L,
        rot: 180,
        mount: 'offboard',
        label: 'LEFT MOTOR + ENCODER',
        role: 'The same gear motor on channel A, with an 11-PPR Hall encoder on its motor shaft: ×4 decoding gives 2112 counts per wheel turn, the speed loop’s sensor.',
        params: { marking: '1:48', callout: [-1.6, -1.4, -1.2] },
        facts: ['Encoder: 11 pulses per motor turn per channel, open-drain, 10 kΩ pull-ups', 'One count in 20 ms = 1.42 rpm at the wheel'],
        circuitIds: ['m_l', 'enc_sa', 'enc_sb'],
      },
      {
        id: 'drv',
        kind: 'module',
        pos: DRV,
        rot: 90,
        mount: 'module',
        label: 'TB6612FNG',
        role: 'The actuator: two H-bridges, PWM on pins 5 and 6, direction on 7/8 and 9/10, STBY on 4. VM is the raw pack.',
        params: { w: 2.0, d: 2.0, pins: 8, title: 'TB6612FNG', color: '#a8222e', callout: [-1.6, 1.6, 0.6] },
        facts: ['VM 2.5–13.5 V (15 V abs. max), VCC 2.7–5.5 V', '1.2 A average, 3.2 A peak per channel', 'About 0.5 Ω high side + low side (typ.)', 'PWM input up to 100 kHz'],
        circuitIds: ['ha_l', 'hb_l', 'ha_r', 'hb_r', 'i_vm'],
      },
      {
        id: 'imu',
        kind: 'module',
        pos: IMU,
        rot: 90,
        mount: 'module',
        label: 'MPU-6050',
        role: 'GY-521 breakout on I²C (0x68): gyro Y gives the pitch rate, the accelerometer the direction of gravity, plus whatever the robot’s own acceleration adds. Mounted 1.5 cm above the axle, square to the chassis.',
        params: { w: 2.1, d: 1.6, pins: 8, title: 'GY-521', color: '#1d4f91', callout: [1.2, 1.7, 0.8] },
        facts: [
          'Gyro ±250 °/s: 131 LSB per °/s; noise 0.005 °/s/√Hz',
          'Accelerometer ±2 g: 16384 LSB per g; noise 400 µg/√Hz',
          'DLPF_CFG 3: 44 Hz accel / 42 Hz gyro, about 5 ms of delay',
          'Supply 2.375–3.46 V (the GY-521 has its own 3.3 V LDO)',
        ],
        circuitIds: ['i_mpu', 'r_sda', 'r_scl'],
      },
      {
        id: 'sw',
        kind: 'switch-slide',
        pos: SW,
        mount: 'tht',
        label: 'POWER',
        role: 'The main switch between the pack and everything else.',
        params: { callout: [1.0, 1.2, 0.6] },
        circuitIds: ['pwr'],
      },
      {
        id: 'c_bulk',
        kind: 'capacitor-electrolytic',
        pos: [-4.6, 0, 1.3],
        mount: 'tht',
        label: 'BULK CAP',
        role: 'A 470 µF, 16 V reservoir on VM, right at the driver: the motors’ current steps come out of it, not down the battery leads.',
        params: { d: 0.8, h: 1.3, callout: [-0.8, 1.2, 0.6] },
        circuitIds: ['c_bulk'],
      },
      {
        id: 'r_bt',
        kind: 'resistor',
        pos: [3.4, 0, -1.5],
        mount: 'tht',
        label: 'VBAT ÷3',
        role: 'Battery sense, top: 20 kΩ from the pack to A0.',
        params: { ohms: 20000, callout: [0.8, 1.0, -0.6] },
        circuitIds: ['r_bt'],
      },
      {
        id: 'r_bb',
        kind: 'resistor',
        pos: [3.4, 0, -0.8],
        mount: 'tht',
        role: 'Battery sense, bottom: 10 kΩ from A0 to ground, so a full 8.4 V pack reads 2.8 V.',
        params: { ohms: 10000 },
        circuitIds: ['r_bb'],
      },
      {
        id: 'r_pa',
        kind: 'resistor',
        pos: [-4.4, 0, -1.6],
        mount: 'tht',
        role: 'Encoder A pull-up, 10 kΩ to 5 V.',
        params: { ohms: 10000 },
        circuitIds: ['r_pa'],
      },
      {
        id: 'r_pb',
        kind: 'resistor',
        pos: [-4.4, 0, -0.9],
        mount: 'tht',
        role: 'Encoder B pull-up, 10 kΩ to 5 V.',
        params: { ohms: 10000 },
        circuitIds: ['r_pb'],
      },
      post('post1', -5.1, -1.8, 0, DECK2),
      post('post2', 5.1, -1.8, 0, DECK2),
      post('post3', -5.1, 1.8, 0, DECK2),
      post('post4', 5.1, 1.8, 0, DECK2),
      {
        id: 'deck2',
        kind: 'module',
        pos: [0, DECK2, 0],
        mount: 'offboard',
        role: 'The middle deck (3 mm acrylic): carries the Uno.',
        params: { w: 11, d: 6, pins: 0, chip: 'none', title: 'DECK 2', color: '#e3dccb', standoff: 0 },
      },
      {
        id: 'uno',
        kind: 'module',
        pos: UNO,
        mount: 'module',
        label: 'UNO',
        role: 'Runs the 200 Hz balance loop: I²C to the IMU on A4/A5, encoder A/B on INT0/INT1 (pins 2, 3), PWM on 5 and 6. Powered from the pack through VIN and its NCP1117 5 V regulator.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [-2.2, 1.6, 0.8] },
        facts: [
          'ATmega328P at 16 MHz, no FPU: the filter and PID maths take a few hundred µs of the 5 ms',
          'NCP1117 5 V regulator: about 1.1 V dropout, 1 A current limit',
          'INT0 = pin 2, INT1 = pin 3: the only two external interrupts',
        ],
        circuitIds: ['pin2', 'pin3', 'pin4', 'pin5', 'pin6', 'pin7', 'pin8', 'pin9', 'pin10', 'reg'],
      },
      post('post5', -5.1, -1.8, DECK2, DECK3),
      post('post6', 5.1, -1.8, DECK2, DECK3),
      post('post7', -5.1, 1.8, DECK2, DECK3),
      post('post8', 5.1, 1.8, DECK2, DECK3),
      {
        id: 'deck3',
        kind: 'module',
        pos: [0, DECK3, 0],
        mount: 'offboard',
        role: 'The top deck: the battery rides here, high up, which slows the fall (a longer pendulum).',
        params: { w: 11, d: 6, pins: 0, chip: 'none', title: 'DECK 3', color: '#e3dccb', standoff: 0 },
      },
      {
        id: 'bat',
        kind: 'battery-lipo',
        pos: BAT,
        mount: 'offboard',
        label: '2S PACK',
        role: 'Two Li-ion cells in series: 8.4 V full, about 7.4 V nominal, 6.0 V empty (3.0 V per cell). About 0.15 Ω internal resistance with its wiring (approximate).',
        params: { marking: '2S Li-ion\n7.4 V', callout: [1.6, 1.2, 0.6] },
        facts: ['Charge to 4.20 V per cell, stop discharging at about 3.0 V per cell', 'Voltage sags by I × R_internal under the motors’ current'],
        circuitIds: ['bat'],
      },
      route('w_bat', [[1.9, DECK3 + 0.5, 1.0], [5.4, DECK3 - 0.2, 2.2], [5.4, 0.6, 2.2], [SW[0], 0.4, SW[2]]], 'red', 'Pack + to the power switch.'),
      route('w_vin', [[SW[0] - 0.3, 0.4, SW[2]], [4.0, 1.2, 2.4], [2.4, DECK2 + 0.9, 2.4], [1.6, DECK2 + 0.5, 2.2]], 'orange', 'Switched pack voltage to the Uno’s VIN (and to the driver’s VM on the deck).'),
      route('w_i2c', [[IMU[0], 0.6, -0.6], [1.6, 1.5, -2.6], [1.6, DECK2 - 0.2, -2.6], [1.2, DECK2 + 0.5, -2.2]], 'blue', 'SDA/SCL from the IMU to A4/A5, with 3.3 V and GND.'),
      route('w_mr', [[DRV[0], 0.5, 0.8], [-3.0, -0.4, 1.6], [-4.6, -1.0, 1.3]], 'yellow', 'Driver BO1/BO2 to the right motor.'),
      route('w_ml', [[DRV[0], 0.5, -0.8], [-1.0, -0.6, -1.4], [3.6, -1.1, -1.3]], 'green', 'Driver AO1/AO2 to the left motor, and the encoder’s A/B back to pins 2/3.'),
    ],
  },

  circuit: {
    elements: [
      // the pack, the switch and the motor reservoir
      { id: 'bat', type: 'V', nodes: ['bat_p', '0'], value: 7.4, rInternal: 0.15, partId: 'bat' },
      { id: 'pwr', type: 'SW', nodes: ['bat_p', 'vbat'], closed: true, rating: { maxI: 3 }, partId: 'sw' },
      { id: 'c_bulk', type: 'C', nodes: ['vbat', '0'], value: 470e-6, polarized: true, rating: { maxV: 16 }, partId: 'c_bulk' },
      // the Uno from VIN: NCP1117 5 V (dropout 1.1 V), the board's ~45 mA
      { id: 'reg', type: 'REG', nodes: ['vbat', '0', '5v'], vout: 5, dropout: 1.1, iLimit: 1.0, partId: 'uno' },
      { id: 'r_board', type: 'R', nodes: ['5v', '0'], value: 111, partId: 'uno' },
      // the IMU: GY-521 LDO (clamped buffer), the chip, I²C pull-ups, AD0 pulled down
      { id: 'ldo', type: 'OPAMP', nodes: ['5v', '3v3', '3v3'], vPos: 3.3, vNeg: 0, partId: 'imu' },
      { id: 'i_mpu', type: 'I', nodes: ['3v3', '0'], value: 0.0039, rating: { maxV: 6 }, partId: 'imu' },
      { id: 'r_sda', type: 'R', nodes: ['3v3', 'sda'], value: 4700, partId: 'imu' },
      { id: 'r_scl', type: 'R', nodes: ['3v3', 'scl'], value: 4700, partId: 'imu' },
      { id: 'r_ad0', type: 'R', nodes: ['ad0', '0'], value: 4700, partId: 'imu' },
      { id: 'pin_sda', type: 'PIN', nodes: ['sda', '0'], pin: 18, vcc: 5, partId: 'uno' },
      { id: 'pin_scl', type: 'PIN', nodes: ['scl', '0'], pin: 19, vcc: 5, partId: 'uno' },
      // battery sense ÷3 into A0
      { id: 'r_bt', type: 'R', nodes: ['vbat', 'a0'], value: 20000, partId: 'r_bt' },
      { id: 'r_bb', type: 'R', nodes: ['a0', '0'], value: 10000, partId: 'r_bb' },
      // the driver: logic, inputs, VM draw, two channels
      { id: 'r_vcc', type: 'R', nodes: ['5v', '0'], value: 4500, partId: 'drv' },
      pin(4),
      pin(5),
      pin(6),
      pin(7),
      pin(8),
      pin(9),
      pin(10),
      rIn(4),
      rIn(5),
      rIn(6),
      rIn(7),
      rIn(8),
      rIn(9),
      rIn(10),
      { id: 'i_vm', type: 'I', nodes: ['vbat', '0'], value: 0, rating: { maxV: 15, failMode: 'short' }, partId: 'drv' },
      ...bridge('l', 'lo1', 'lo2'),
      ...bridge('r', 'ro1', 'ro2'),
      motor('m_l', 'lo1', 'lo2', 'm_l'),
      motor('m_r', 'ro1', 'ro2', 'm_r'),
      // the left encoder: open-drain Hall outputs, pulled up, on INT0 / INT1
      { id: 'i_enc', type: 'I', nodes: ['5v', '0'], value: 0.008, rating: { maxV: 6 }, partId: 'm_l' },
      { id: 'r_pa', type: 'R', nodes: ['5v', 'd2'], value: 10000, partId: 'r_pa' },
      { id: 'r_pb', type: 'R', nodes: ['5v', 'd3'], value: 10000, partId: 'r_pb' },
      { id: 'enc_sa', type: 'SW', nodes: ['d2', '0'], closed: false, rating: { maxI: 0.02 }, partId: 'm_l' },
      { id: 'enc_sb', type: 'SW', nodes: ['d3', '0'], closed: false, rating: { maxI: 0.02 }, partId: 'm_l' },
      { id: 'pin2', type: 'PIN', nodes: ['d2', '0'], pin: 2, vcc: 5, vccNode: '5v', partId: 'uno' },
      { id: 'pin3', type: 'PIN', nodes: ['d3', '0'], pin: 3, vcc: 5, vccNode: '5v', partId: 'uno' },
    ],
  },
  powerElementId: 'pwr',
  powerLabel: 'Power switch',
  transient: true,

  behaviors: [
    // listed first: its onStep publishes the pitch the IMU samples in the same step
    { id: 'balance-bot', instance: 'bot', params: { motorL: 'm_l', motorR: 'm_r', M: 0.8, l: 0.08, Ic: 0.003, r: 0.0325, wheelMass: 0.03, gear: 48, eff: 0.7, imuH: 0.015, pushN: 3 } },
    { id: 'imu-mpu6050', instance: 'imu', params: { pitchSource: 'bot.pitch', perStep: 1, seed: 7 } },
    {
      id: 'tb6612',
      instance: 'drv',
      params: {
        in1: 7, in2: 8, pwm: 5, stby: 4, out1: 'ha_l', out2: 'hb_l', en1: 'en_al', en2: 'en_bl', motor: 'm_l',
        bin1: 9, bin2: 10, pwmb: 6, bout1: 'ha_r', bout2: 'hb_r', ben1: 'en_ar', ben2: 'en_br', bmotor: 'm_r',
        gnd: '0', vm: 'vbat', vcc: '5v', supply: 'i_vm', ronTotal: 0.5, rthJA: 140, tauTh: 2, tsd: 175, gear: 48, pwmHz: 980,
      },
    },
    { id: 'quad-encoder', instance: 'enc', params: { motor: 'm_l', ppr: 11, gear: 48, a: 2, b: 3, swapAB: 0, isrUs: 12, glitchRate: 0, pullA: 'r_pa', pullB: 'r_pb', swA: 'enc_sa', swB: 'enc_sb' } },
    { id: 'pid-tune', instance: 'tune', params: { kp: G0.kp, ki: 0, kd: G0.kd, periodMs: 5, antiWindup: 1, alpha: 0.98, kv: G0.kv, trim: 0 } },
    { id: 'mcu-supply', instance: 'mcu', params: { supplyNode: '5v', bor: 2.7, fClk: 16 } },
    { id: 'serial-plotter', instance: 'serial' },
  ],

  readouts: [
    { label: 'TRUE PITCH', source: { kind: 'behavior', key: 'bot.pitch' }, unit: '°', digits: 1 },
    { label: 'ESTIMATED PITCH', source: { kind: 'behavior', key: 'serial.pitch' }, unit: '°', digits: 1 },
    { label: 'TARGET LEAN', source: { kind: 'behavior', key: 'serial.target' }, unit: '°', digits: 1 },
    { label: 'CONTROL u (PWM COUNTS)', source: { kind: 'behavior', key: 'serial.u' }, unit: '' },
    { label: 'WHEEL SPEED', source: { kind: 'behavior', key: 'serial.rpm' }, unit: 'rpm' },
    { label: 'GROUND SPEED (M/S)', source: { kind: 'behavior', key: 'bot.v_mps' }, unit: '', digits: 2 },
    { label: 'TRAVEL', source: { kind: 'behavior', key: 'bot.x_cm' }, unit: 'cm' },
    { label: 'BATTERY', source: { kind: 'voltage', node: 'vbat' }, unit: 'V' },
    { label: 'MOTOR CURRENT (L)', source: { kind: 'current', elementId: 'm_l' }, unit: 'A' },
    { label: 'FALLEN', source: { kind: 'behavior', key: 'bot.fallen' }, unit: '' },
    { label: 'OPEN-LOOP POLE (RAD/S)', source: { kind: 'behavior', key: 'bot.pole_rad_s' }, unit: '', digits: 1 },
    { label: 'ESTIMATE ERROR', source: { kind: 'derived', op: 'diff', of: [1, 0] }, unit: '°', digits: 1 },
    { label: 'LOOP RATE', source: { kind: 'behavior', key: 'tune.loop_hz' }, unit: 'Hz' },
    { label: 'HELD', source: { kind: 'behavior', key: 'bot.held' }, unit: '' },
    { label: 'PUSHES', source: { kind: 'behavior', key: 'bot.pushes' }, unit: '' },
    { label: 'WOBBLE (PITCH RATE RMS, °/S)', source: { kind: 'behavior', key: 'bot.wobble_dps' }, unit: '', digits: 1 },
    { label: 'RING AFTER PUSH (°/S RMS)', source: { kind: 'behavior', key: 'bot.ring_dps' }, unit: '', digits: 1 },
  ],

  instruments: {
    open: false,
    scope: {
      channels: [
        { label: 'BATTERY', source: { kind: 'voltage', node: 'vbat' }, perDiv: 2, offset: -3 },
        { label: 'MOTOR CURRENT (L)', source: { kind: 'current', elementId: 'm_l' }, perDiv: 0.5, offset: 0 },
      ],
      timePerDiv: 0.1,
      trigger: { channel: 1, level: 0.3, slope: 'rising', mode: 'auto' },
    },
    chart: { signals: [0, 1, 2], span: 6 },
    view: 'chart',
  },

  sketch: {
    title: 'Complementary filter + cascaded balance loop',
    code: SKETCH,
    pins: { 2: 'pin2', 3: 'pin3', 4: 'pin4', 5: 'pin5', 6: 'pin6', 7: 'pin7', 8: 'pin8', 9: 'pin9', 10: 'pin10', 18: 'pin_sda', 19: 'pin_scl' },
    analogPins: { A0: 'a0' },
    vcc: 5,
    board: 'uno',
  },

  tweaks: [
    { label: 'Push', elementId: 'behavior:bot', key: 'push', kind: 'momentary', min: 0, max: 1, unit: '' },
    { label: 'Push size (N)', elementId: 'behavior:bot', key: 'pushN', min: 0.5, max: 10, step: 0.5, unit: '' },
    { label: 'Hold it upright', elementId: 'behavior:bot', key: 'hold', kind: 'momentary', min: 0, max: 1, unit: '' },
    { label: 'Kp', elementId: 'behavior:tune', key: 'kp', min: 0, max: 60, step: 0.1, unit: '' },
    { label: 'Ki', elementId: 'behavior:tune', key: 'ki', min: 0, max: 200, step: 1, unit: '' },
    { label: 'Kd', elementId: 'behavior:tune', key: 'kd', min: 0, max: 6, step: 0.05, unit: '' },
    { label: 'Speed loop KV', elementId: 'behavior:tune', key: 'kv', min: 0, max: 0.4, step: 0.005, unit: '' },
    { label: 'Filter alpha', elementId: 'behavior:tune', key: 'alpha', min: 0, max: 1, step: 0.005, unit: '' },
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
    { label: 'Setpoint trim', elementId: 'behavior:tune', key: 'trim', min: -5, max: 5, step: 0.1, unit: '°' },
    { label: 'COM height', elementId: 'behavior:bot', key: 'l', min: 0.03, max: 0.2, step: 0.005, unit: '' },
    { label: 'Battery voltage', elementId: 'bat', key: 'value', min: 6.0, max: 8.4, step: 0.1, unit: 'V' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: upload the sketch. Until it runs, you are holding the robot upright.' },
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING at {12}: true pitch {0}, estimate {1}, u {3}. Press Push and watch the lean, the catch and the return.' },
    { when: { kind: 'above', readout: 13, value: 0.5 }, text: 'Held upright (calibrating, or in your hand). Let go and it has to balance itself.' },
    { when: { kind: 'above', readout: 9, value: 0.5 }, text: 'Fallen: the sketch has cut the motors. Press Hold it upright to stand it up again.' },
  ],

  failures: [
    {
      id: 'accel-only',
      label: 'No filter: accelerometer only (α = 0)',
      explain:
        'With α = 0 the estimate is the accelerometer’s atan2 alone. At rest that is exact, but an accelerometer measures gravity minus its own acceleration: every time the wheels speed up to catch a lean, the measured "down" swings by atan(a/g), about 6° per m/s². The loop reads its own correction as a tilt and corrects that, so the estimate jumps by many degrees, the PWM slams from side to side, and within a couple of seconds it falls. The fix is not a bigger filter on the accelerometer (that adds lag the loop cannot afford) but the gyro: trust the integrated rate over short times and let the accelerometer only correct the slow drift.',
      patches: [{ op: 'set', elementId: 'behavior:tune', key: 'alpha', value: 0 }],
    },
    {
      id: 'gyro-only',
      label: 'No filter: gyro only (α = 1), and the chip warms up',
      explain:
        'With α = 1 the estimate is the integrated gyro alone, which is fine for a while because the sketch measured the bias at start-up. Then the MPU-6050 warms by 20 °C, and its zero-rate output moves by about 0.03 °/s per °C (an illustrative tempco): 0.6 °/s of bias the sketch no longer subtracts. The estimate creeps by 0.6° every second, so the robot balances at a true lean that keeps growing the other way. The speed loop leans against the drift until it reaches its ±10° limit, the robot runs away faster and faster, and finally falls. A gyro alone always drifts; the accelerometer in the complementary filter is what ties the estimate back to gravity (at α = 0.98, over about 0.25 s).',
      patches: [
        { op: 'set', elementId: 'behavior:tune', key: 'alpha', value: 1 },
        { op: 'set', elementId: 'behavior:imu', key: 'tempC', value: 45 },
      ],
    },
    {
      id: 'slow-loop',
      label: 'Run the loop at 10 Hz (100 ms)',
      explain:
        'The gains are the ones designed for 200 Hz, but now the sketch looks at the pitch every 100 ms and holds each PWM value for 100 ms. Left alone the tilt doubles every 94 ms, so the loop sees less than one sample per doubling, and the sample-and-hold alone adds about 50 ms of delay: 43° of phase at the loop’s 15 rad/s. Each correction arrives late and overshoots, the swing grows, and it falls. At 50 ms it still stands, but it buzzes. Rule of thumb: sample 10 to 20 times faster than the fastest closed-loop pole (here 15 rad/s, about 2.4 Hz, so at least 50 Hz, and 200 Hz to be comfortable).',
      patches: [{ op: 'set', elementId: 'behavior:tune', key: 'periodMs', value: 100 }],
    },
    {
      id: 'motor-polarity',
      label: 'Swap both motors’ leads',
      explain:
        'Now a forward lean drives the wheels backward, away from under the centre of mass: the feedback is positive. The first correction pushes the body further over, the next one harder still, and the robot is on the floor in well under a second. Before closing any loop, check each sign open loop: hold the robot, tilt it forward, and the wheels must turn forward (and the encoder count must go up).',
      patches: [{ op: 'set', elementId: 'behavior:bot', key: 'polarity', value: -1 }],
    },
    {
      id: 'low-battery',
      label: 'Tired, high-resistance battery',
      explain:
        'The pack is at 6.2 V (3.1 V per cell, nearly empty) with 1.5 Ω of internal resistance. Standing still it needs only a few tens of milliamps and balances happily. Set **Push size** to 5 N, which a fresh pack catches, and push: the motors pull about half an amp each, the pack sags by I·R to about 5.2 V, the motors lose torque and top speed just when they need them most, and the wheels cannot get back under the centre of mass. It falls the way it was pushed. Gains cannot create volts: balancing needs reserve authority. Watch the battery (this sketch reads it on A0 through a 20 k / 10 k divider) and stop before about 3.0 V per cell.',
      patches: [
        { op: 'set', elementId: 'bat', key: 'value', value: 6.2 },
        { op: 'set', elementId: 'bat', key: 'rInternal', value: 1.5 },
      ],
    },
    {
      id: 'high-com',
      label: 'Battery on a tall mast (COM 20 cm)',
      explain:
        'Moving the battery up to put the centre of mass 20 cm above the axle makes the body’s inertia about the axle four times larger (0.035 instead of 0.008 kg·m²). It falls a little more slowly (open-loop pole 7.2 instead of 8.2 rad/s), but the gains were designed for the short robot: the same Kd now gives less than a third of the damping ratio, the angle poles move to −2.9 ± 12.2i (ζ ≈ 0.23), and it rings at about 2 Hz: WOBBLE doubles standing still, and again after a push. A higher centre of mass is easier for a human balancing a broom, because it is slower; for a fixed controller it is a different plant. Retune: Kd ≈ 4 brings ζ back up.',
      patches: [{ op: 'set', elementId: 'behavior:bot', key: 'l', value: 0.2 }],
    },
  ],

  meet: `**The plant.** A two-wheel balancer is an inverted pendulum on a cart: body mass M = 0.8 kg with its centre of mass l = 8 cm above the axle and I_c = 0.003 kg·m² about it, on 65 mm wheels (r = 32.5 mm) driven by two 48:1 gear motors. Each rotor (J_m = 3e-7 kg·m²) turns 48 times faster than the wheel relative to the body, so the rotors add J_r = 2 · 48² · J_m = 1.38e-3 kg·m² at the wheel: 1.31 kg of apparent cart mass, more than the robot itself. With x the travel and θ the pitch (+ forward), the Lagrangian gives

a11·ẍ + (M·l·cos θ − J_r/r)·θ̈ = τ/r + M·l·sin θ·θ̇²
(M·l·cos θ − J_r/r)·ẍ + (I_c + M·l² + J_r)·θ̈ = M·g·l·sin θ − τ

where τ is the motors’ torque on the wheels and a11 = M + m_w + (I_w + J_r)/r².

**The poles.** A point mass on a fixed pivot falls at √(g/l) = **11.1 rad/s**. Its own inertia slows the body to √(M·g·l / (I_c + M·l²)) = 8.8 rad/s, and on free wheels, with the cart recoiling and the rotors spinning, it is **8.2 rad/s**: the tilt doubles every 84 ms. With the motors connected to the bridge their back-EMF damps the wheels (0.020 N·m·s), and the linearised model, state [θ, θ̇, x, ẋ] and input u in PWM counts, has open-loop poles **+7.4**, 0, −5.8 and −15.8 rad/s. The +7.4 is the fall (doubling every 94 ms); the 0 is the robot parked anywhere.

**The drive.** Each motor draws i = (duty·V − ke·48·ψ̇)/R with R = 4 + 0.5 + 2 × 0.15 = 4.8 Ω, so the wheels get **2.19 mN·m per PWM count** on 7.4 V. A torque τ on the wheels tips the body back by β·τ, β = 1.30 (the cart’s recoil adds to the reaction). Gravity’s negative stiffness is M·g·l = 0.63 N·m per rad, so Kp must exceed M·g·l / (β · 2.19 mN·m) = **3.8 counts per degree** just to hold it.

**The design.** The sketch is a cascade: u = Kp·(θ − θ_t) + Kd·θ̇ with θ_t = −KV·(wheel rpm). The position does not feed back, so the loop has three states (θ, θ̇, ẋ) and the cascade’s three gains are exactly a full state feedback on them. Placing the poles at **−12 ± 9i** (ω_n = 15 rad/s, ζ = 0.8, about twice the fall rate) and **−3 rad/s** (the speed loop, a third of a second) gives **Kp = 20.7 counts/°, Kd = 2.3 counts per °/s, KV = 0.11 ° per rpm**: five times gravity’s stiffness. The angle PD alone (KV = 0) is not enough: a slow pole stays at +1.7 rad/s, because a robot that leans must speed up, and the back-EMF then eats the torque it needs, so it runs away.

**Estimation.** A complementary filter at dt = 5 ms with α = 0.98: τ = α·dt/(1 − α) = **0.245 s**. Inside τ it integrates the gyro (fast, but drifting); beyond it the accelerometer (true on average, but noisy and fooled by every acceleration). The gyro rate itself is the D term, so the derivative adds no lag.

**Authority.** The motors are 6 V parts, so PWM is capped at 6/8.4 × 255 = 182. On 7.4 V that is 5.3 V and about 0.65 m/s of ground speed: a push that needs the wheels faster than that cannot be caught, whatever the gains.

*Sim note:* the pendulum and the motors are co-simulated every 1 ms step: the circuit solves the winding currents with the shaft speeds the pendulum prescribes, and their torque drives the pendulum (one step of lag). The IMU samples that same step. Two wheels are lumped into one, with no yaw, slip or gearbox backlash; I_c, the wheel inertia (½·m·r²) and the 70 % gearbox efficiency are illustrative.`,

  mechanicalAnalogy: `This is the broomstick on your palm, and the cart-pole from every controls textbook: a statically unstable system made dynamically stable by moving the support under the centre of mass. Kp is a torsional spring that must be stiffer than gravity’s negative spring M·g·l; Kd is the damper across it; the speed loop is a slow trim that leans the body to accelerate or brake, just as you lean into a bicycle’s acceleration. The complementary filter is a crossover between two transducers: a rate gyro for the high frequencies and a pendulum-type inclinometer for the low ones. One more ME detail: through a 48:1 gearbox the motor rotors’ inertia is multiplied by 48² and dominates the wheels’ effective mass.

**Where it breaks:** the linear model assumes small angles, an unsaturated drive and no delay. Real gearbox backlash, motor saturation, the IMU’s filter delay and loop-rate jitter all eat phase margin, which is why gains tuned on a real robot usually end up below the textbook numbers.`,

  proTips: [
    'Bring it up one subsystem at a time: IMU signs (tilt forward, pitch goes +), motor signs (+u, both wheels forward), encoder sign (forward, count goes up), then the angle loop with KV = 0 while you hold it, then the speed loop.',
    'Keep the loop period fixed and measure it: toggle a pin each tick and look at it on the scope. A Serial.print that blocks can stretch 5 ms to 20 ms and destabilise it.',
    'Cut the motors past about 40° and re-arm only near upright. A fallen robot that keeps driving its wheels at full PWM drains the pack and stalls the motors.',
  ],

  quiz: [
    {
      q: 'A point-mass pendulum with its centre of mass 8 cm above a fixed pivot. What is the unstable pole, and how long does the tilt take to double?',
      options: ['3.5 rad/s, 0.2 s', '11.1 rad/s, 63 ms', '31 rad/s, 22 ms', '98 rad/s, 7 ms'],
      answer: 1,
      why: '√(9.81 / 0.08) = 11.1 rad/s, and ln 2 / 11.1 ≈ 0.063 s. The real robot is a little slower (8.2 rad/s) because of its own inertia and its rotors.',
    },
    {
      q: 'A complementary filter at 200 Hz should cross over at τ ≈ 0.25 s. Which α?',
      options: ['0.90', '0.95', '0.98', '0.999'],
      answer: 2,
      why: 'α = τ / (τ + dt) = 0.25 / 0.255 ≈ 0.98.',
    },
    {
      q: 'Why does the robot need the outer speed loop at all, if the angle loop already keeps it upright?',
      options: [
        'The angle loop cannot react fast enough',
        'To stay upright at a lean it must accelerate; as it speeds up, the motors’ back-EMF steals the torque it needs, so with no speed feedback it runs away and falls',
        'The encoder is needed to measure the pitch',
        'The speed loop filters the gyro noise',
      ],
      answer: 1,
      why: 'With KV = 0 a slow closed-loop pole stays at +1.7 rad/s. Leaning against the wheel speed (θ_t = −KV·rpm) moves it to −3 rad/s.',
    },
    {
      q: 'Why is the D term taken from the gyro rate instead of differentiating the filtered angle?',
      options: [
        'The gyro is more accurate at DC',
        'The gyro measures the rate directly with little delay, while differentiating the angle amplifies noise and adds the filter’s lag',
        'The accelerometer cannot be differentiated',
        'It saves an I²C read',
      ],
      answer: 1,
      why: 'The rate is the derivative, measured directly. Differentiating a quantised, filtered angle is noisy and late.',
    },
    {
      q: 'Each rotor has J = 3e-7 kg·m² behind a 48:1 gearbox, and the wheels are 65 mm. How much apparent mass do the two rotors add to the cart?',
      options: ['About 0.3 g', 'About 14 g', 'About 1.3 kg', 'About 130 kg'],
      answer: 2,
      why: 'J_r = 2 × 48² × 3e-7 = 1.38e-3 kg·m²; divided by r² = 0.0325² it is 1.31 kg. A gearbox multiplies the inertia by the ratio squared.',
    },
  ],
}
