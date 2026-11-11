# Capstone: Two-Wheel Balancer

*IMU, driver, PID: together*

> An 8 cm-tall centre of mass falls with a doubling time of about 62 ms, so the robot has to sense its tilt, filter it and correct the wheels 200 times a second.

- **Lesson id:** `capstone-balancing-robot` · **Track:** T7 Professional
- **fig:** 45. Provisional: sidebar order.
- **Prerequisites:** `mpu6050-imu`, `tb6612fng`, `encoders`, `pid-motor-control`, `power-grounding-emc`
- **Power element:** `pwr` (powerLabel: "Power switch"). The robot runs from its own battery.
- **Behaviors:** `balance-bot`, `imu-mpu6050`, `tb6612` (two channels), `quad-encoder` (two instances), `mcu-supply`, `serial-plotter`
- **transient:** true

## As built (2026-11-11)

The lesson (`src/lessons/T7/capstone-balancing-robot.ts`) follows this draft with these changes. Where they disagree, the lesson and this section win.

- **Model.** `balance-bot` integrates the Lagrangian cart-pendulum including the motors' rotor inertia reflected through the gearbox, J_r = 2·48²·J_m = 1.38e-3 kg·m² (1.31 kg of apparent cart mass), which the draft left out (`src/engine/robot/pendulum.ts`, tested for √(g/l), energy conservation and fall detection). Poles: point mass √(g/l) = 11.1 rad/s; √(M·g·l/(I_c + M·l²)) = 8.8 rad/s; free wheels 8.2 rad/s (84 ms doubling); with the motors on the bridge (back-EMF damping 0.020 N·m·s) the linearised open-loop poles are +7.4, 0, −5.8, −15.8 rad/s.
- **Coupling.** Not `setMotorLoad`: a MOTOR's `load` is an unsigned drag against ω, so it cannot carry a reaction torque that drives the shaft. The MOTOR elements get a prescribed shaft speed (`omegaSet`, new and optional) set every 1 ms step from the pendulum, and the wheels get η·N·kt·i from the solved currents.
- **Gains, derived.** The cascade's three gains are a full state feedback on [θ, θ̇, ẋ]; placing the poles at −12 ± 9i (ω_n 15 rad/s, ζ 0.8) and −3 rad/s gives Kp = 20.7 counts/°, Kd = 2.3 counts/(°/s), KV = 0.11 °/rpm (the draft's 18 / 0.6 / 0.05 were not derived). Angle PD alone leaves a slow pole at +1.7 rad/s: the speed loop is required. MAX_LEAN is 10° (6° could not brake after a 3 N push and fell on the second push). The gains, α, loop period and trim are `pid-tune` sliders read with `Tune.*` / `Tune.get(...)`.
- **IMU.** `imu-mpu6050` with `perStep` 1 samples the robot's pitch every step and adds the robot's own acceleration at the sensor (1.5 cm above the axle), which is what defeats an accelerometer-only estimate.
- **Hold and fall.** The robot is held upright (wheels on the floor) until the sketch has run 0.9 s (its gyro calibration), and with the momentary **Hold it upright**; past 45° it falls to 78° and lies with its wheels free. Push is momentary, with a separate **Push size** (3 N for 50 ms by default).
- **Failures, as built:** accelerometer only (falls within ~2 s), gyro only plus a 20 °C warm-up (0.6 °/s drift, runs away), 10 Hz loop (100 ms; 50 ms still stands), both motors' leads swapped (falls in under a second), tired pack 6.2 V / 1.5 Ω (stands, but a 5 N push that a fresh pack catches knocks it over), battery on a mast (COM 20 cm: ζ falls to ≈ 0.23, it rings at ≈ 2 Hz). Deferred: IMU mount offset, a single reversed motor (needs yaw), gearbox backlash, floor slope, the right encoder (pins 11/12 have no external interrupt; only the left wheel is counted).
- **Board.** Three decks on M3 standoffs (PCB deck with driver, IMU, switch, bulk cap and dividers; Uno; battery on top), two TT-class motors below, drawn with the new `board.dynamic` so the whole robot tilts and rolls. Guide: power, upload, watch it stand, push, break the filter, repair, slow loop, gyro-only drift, quiz.

## Learning goals

1. Model the robot as an inverted pendulum on wheels, and compute its unstable pole √(g/l) and the time scale it sets for the control loop.
2. Combine the complementary-filter pitch estimate (IMU) with a PD(+I) balance loop and a slower outer speed loop (cascade control).
3. Respect the actuator limits: gear-motor top speed (ground speed), torque, PWM headroom on a 2S pack, deadband and backlash.
4. Bring up a multi-subsystem robot safely: sign checks per subsystem, a motor cut-off on fall, battery monitoring.
5. Diagnose system-level failures: battery sag, sensor mounting offset, a reversed motor, gearbox backlash.

## Board

Board: `BALANCER`, a chassis plate 10 × 6 with two decks, base `none` (the robot stands on the mat).

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | 200 Hz control loop. Powered from the battery through VIN. | `pin_sda`, `pin_scl`, `pin2`, `pin3`, `pin4`, `pin5`, `pin6`, `pin7`, `pin8`, `pin9`, `pin10`, `pin11`, `pin12` |
| imu | `module` (GY-521 / MPU-6050, see `mpu6050-imu`) | `module` | IMU | Pitch rate (gyro Y) and gravity direction. Mounted at the axle line, aligned with the chassis. | `i_mpu`, `r_sda`, `r_scl` |
| drv | `module` (TB6612FNG, both channels) | `module` | DRIVER | Drives left and right motors. | `ha_l`, `hb_l`, `ha_r`, `hb_r` |
| m_l, m_r | `gear-motor-wheel` (GM-48 with 11-PPR encoders, 65 mm wheels) | `offboard` | LEFT · RIGHT | Wheels: 6 V-class motors, 48:1. | `m_l`, `m_r` |
| bat | `battery-lipo` (2S Li-ion 18650 pack, 7.4 V nominal, 8.4 V full, about 2500 mAh) | `offboard` | 2S PACK | Robot supply. | `bat` |
| sw | `switch-slide` (rated 3 A) | `tht` | POWER | Main switch. | `pwr` |
| c_bulk | `capacitor-electrolytic` (470 µF 16 V) | `tht` | BULK | Motor-current reservoir on VM. | `c_bulk` |
| r_div1, r_div2 | `resistor` (20 kΩ, 10 kΩ) | `tht` | VBAT SENSE | Battery voltage ÷3 into A0 (8.4 V → 2.8 V). | `r_bt`, `r_bb` |
| r_enc | `resistor` ×4 (10 kΩ) | `tht` | ENC PULL-UPS | | `r_pal`, `r_pbl`, `r_par`, `r_pbr` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `bat` | V | `bat_p`, `0` | 7.4 V, rInternal 0.15 Ω | — | 2S pack plus wiring (approximate) |
| `pwr` | SW | `bat_p`, `vbat` | closed: false | maxI 3 A | **Power element** |
| `c_bulk` | C | `vbat`, `0` | 470 µF | maxV 16 V | |
| `uno_reg` | OPAMP | `vbat`, `5v`, `5v` | vPos 5, vNeg 0 | — | Uno's NCP1117 5 V from VIN (clamped-buffer model, dropout not modelled) |
| `i_board` | I | `5v`, `0` | 0.045 A | maxV 6 V | Uno |
| `ldo` | OPAMP | `5v`, `3v3`, `3v3` | vPos 3.3 | — | GY-521 LDO |
| `i_mpu` | I | `3v3`, `0` | 0.0039 A | — | |
| `r_sda`, `r_scl` | R | `3v3`, `sda` / `scl` | 4.7 kΩ | — | |
| `pin_sda`, `pin_scl` | PIN | `sda` / `scl`, `0` | pins 18 / 19 | — | |
| `r_bt` | R | `vbat`, `a0` | 20 kΩ | — | |
| `r_bb` | R | `a0`, `0` | 10 kΩ | — | |
| `i_vcc` | I | `5v`, `0` | 0.0011 A | — | TB6612 logic |
| `pin4` | PIN | `d4`, `0` | pin 4 | — | STBY |
| `pin5`, `pin7`, `pin8` | PIN | `d5`/`d7`/`d8`, `0` | pins 5, 7, 8 | — | Left: PWMA, AIN1, AIN2 |
| `pin6`, `pin9`, `pin10` | PIN | `d6`/`d9`/`d10`, `0` | pins 6, 9, 10 | — | Right: PWMB, BIN1, BIN2 |
| `i_vm` | I | `vbat`, `0` | set by behavior | maxV 15 V | Bridge draw (both channels) |
| `ha_l`, `ron_al`, `en_al`, `hb_l`, `ron_bl`, `en_bl` | V/R/SW | `…`, `lo1`/`lo2` | as `tb6612fng` | — | Left bridge |
| `ha_r`, `ron_ar`, `en_ar`, `hb_r`, `ron_br`, `en_br` | V/R/SW | `…`, `ro1`/`ro2` | as `tb6612fng` | — | Right bridge |
| `m_l` | MOTOR | `lo1`, `lo2` | r 4, l 0.0005, ke 0.0054, j 3e-7, b 8e-7, load (by `balance-bot`) | maxI 2 A | GM-48 |
| `m_r` | MOTOR | `ro1`, `ro2` | same | maxI 2 A | Mounted mirrored. Its wires are swapped on the driver so that "+" means forward for both. |
| `r_pal`, `r_pbl`, `r_par`, `r_pbr` | R | `5v`, `ela`/`elb`/`era`/`erb` | 10 kΩ | — | Encoder pull-ups |
| `pin2`, `pin3` | PIN | `ela`, `elb` → `0` | pins 2, 3 | — | Left encoder A/B (INT0/INT1) |
| `pin11`, `pin12` | PIN | `era`, `erb` → `0` | pins 11, 12 | — | Right encoder A/B (pin-change interrupts, SIM NOTE) |

### Behaviors

- **`balance-bot`**. A rigid-body model of an inverted pendulum on two wheels, in the pitch plane only, with a yaw extension for differential wheel torque.
  - **Parameters:** body mass M = 0.8 kg, COM height above the axle l = 0.08 m, body inertia about the COM I_c = 0.003 kg·m² (illustrative, roughly a uniform block), wheel radius r = 0.0325 m, wheel mass 0.03 kg each, gear N = 48, gear efficiency η = 0.7, `backlashDeg` 0 (at the output), `floorFriction` 0.8, and a fall limit of |θ| > 45° (lies down, `fallen = 1`).
  - **Coupling, each 1 ms tick:**
    - wheel speed from the motors: ẋ = ((ω_L + ω_R)/2) × r / N;
    - wheel torque from the currents: τ_w = Σ kt·I_k·N·η;
    - integrate θ, θ̇ with the coupled cart-pendulum equations: (M + 2m_w + 2I_w/r²)·ẍ + M·l·cos θ·θ̈ − M·l·sin θ·θ̇² = τ_w/r, and (I_c + M·l²)·θ̈ + M·l·cos θ·ẍ − M·g·l·sin θ = −τ_w;
    - set each motor's `load` to the reaction torque its shaft must supply to produce the computed ẍ, which is (required force × r / 2) / (N·η), with sign. The one-tick lag is acceptable at 1 ms (SIM NOTE).
  - **Backlash:** within ±backlashDeg of reversal, the wheel torque is zero.
  - Feeds `pitch_true` and the pitch rate to `imu-mpu6050` (its `pitchSource`, plus `mountOffsetDeg`), and the wheel angles to the two `quad-encoder` instances.
  - **Publishes:** `pitch_true`, `x_m`, `v_mps`, `fallen`, `tau_w_Nm` and `pole_rad_s` (= √(M·g·l / (I_c + M·l²))).
- **`imu-mpu6050`**: see `mpu6050-imu`, with `pitchSource:'balance-bot'`.
- **`tb6612`** ×2 channels: see `tb6612fng`, with pins `{pwmA:5, in1A:7, in2A:8, pwmB:6, in1B:9, in2B:10, stby:4}`.
- **`quad-encoder`** ×2: see `encoders` (left pins 2/3, right pins 11/12).
- **`mcu-supply`**: `supplyNode` = `5v`. When the battery sags, the regulator follows it in this model (no dropout). **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** Balance · **board:** `uno` · **vcc:** 5

| Pin | Use | PIN element |
|---|---|---|
| A4 / A5 | IMU I²C | `pin_sda`, `pin_scl` |
| 5 / 7 / 8 | Left PWM / IN1 / IN2 | `pin5`, `pin7`, `pin8` |
| 6 / 9 / 10 | Right PWM / IN1 / IN2 | `pin6`, `pin9`, `pin10` |
| 4 | Driver STBY | `pin4` |
| 2 / 3 | Left encoder A / B | `pin2`, `pin3` |
| 11 / 12 | Right encoder (only counted, at ×1, in this sketch) | `pin11`, `pin12` |
| A0 | Battery ÷3 | analogPins `A0 → a0` |

Note: this sketch uses only `analogWrite` on pins 5/6/9/10 for PWM, with no Servo or TimerOne, so Timer1 stays free for PWM on pins 9/10.

```cpp
#include <Wire.h>
#include <MPU6050.h>
// Real code: MPU6050 mpu;   The bench provides `mpu`.

// ---- tuning: starting values for this simulated robot; retune on hardware ----
const float KP_ANGLE = 18.0;     // PWM per degree of tilt error
const float KD_ANGLE = 0.6;      // PWM per deg/s of pitch rate (from the gyro)
const float KV_SPEED = 0.05;     // degrees of lean per rpm of wheel speed
const float MAX_LEAN = 6.0;      // outer loop may ask for at most +/-6 degrees
const int   MAX_PWM  = 182;      // 6 V motors on an 8.4 V pack: 6/8.4*255
const int   DEADBAND = 18;       // PWM below which the motors don't turn
const float FALL_DEG = 35.0;

const float DT = 0.005;          // 200 Hz
const float ALPHA = 0.98;        // tau = 0.245 s
const float GYRO_SENS = 131.0;
const float CPR = 2112.0;

#define STBY 4
#define PWM_L 5
#define L_IN1 7
#define L_IN2 8
#define PWM_R 6
#define R_IN1 9
#define R_IN2 10

const int QEM[16] = {0, 1, -1, 0,  -1, 0, 0, 1,  1, 0, 0, -1,  0, -1, 1, 0};
volatile long countL = 0;
volatile int lastL = 0;

void onLeft() {
  int s = (digitalRead(2) << 1) | digitalRead(3);
  countL += QEM[(lastL << 2) | s];
  lastL = s;
}

float gyroBias = 0;
float pitch = 0;
long lastCountL = 0;
float wheelRpm = 0;
unsigned long nextTick = 0;
int tick = 0;
bool running = false;

void motor(int pwmPin, int in1, int in2, float u) {
  int mag = abs(u);
  if (mag > 0) {
    mag = mag + DEADBAND;                // deadband compensation
  }
  mag = constrain(mag, 0, MAX_PWM);
  if (u >= 0) {
    digitalWrite(in1, HIGH);
    digitalWrite(in2, LOW);
  } else {
    digitalWrite(in1, LOW);
    digitalWrite(in2, HIGH);
  }
  analogWrite(pwmPin, mag);
}

void stopMotors() {
  analogWrite(PWM_L, 0);
  analogWrite(PWM_R, 0);
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.setClock(400000);
  pinMode(STBY, OUTPUT);
  pinMode(PWM_L, OUTPUT);  pinMode(L_IN1, OUTPUT);  pinMode(L_IN2, OUTPUT);
  pinMode(PWM_R, OUTPUT);  pinMode(R_IN1, OUTPUT);  pinMode(R_IN2, OUTPUT);
  pinMode(2, INPUT);
  pinMode(3, INPUT);
  digitalWrite(STBY, HIGH);

  mpu.initialize();
  if (!mpu.testConnection()) {
    Serial.println("IMU missing: motors stay off");
    while (true) { delay(1000); }
  }
  mpu.setDLPFMode(3);                    // ~44 Hz, ~5 ms delay: fine at 200 Hz

  Serial.println("Hold upright and still: calibrating");
  long sum = 0;
  for (int i = 0; i < 400; i++) {
    sum += mpu.getRotationY();
    delay(2);
  }
  gyroBias = sum / 400.0;
  pitch = atan2(-1.0 * mpu.getAccelerationX(), mpu.getAccelerationZ()) * 180.0 / PI;

  lastL = (digitalRead(2) << 1) | digitalRead(3);
  attachInterrupt(digitalPinToInterrupt(2), onLeft, CHANGE);
  attachInterrupt(digitalPinToInterrupt(3), onLeft, CHANGE);

  float vbat = analogRead(A0) * 5.0 / 1023.0 * 3.0;
  Serial.print("battery V:");
  Serial.println(vbat);
  running = true;
  nextTick = millis();
}

void loop() {
  long wait = nextTick - millis();
  if (wait > 0) {
    delay(wait);
  }
  nextTick += 5;

  // 1. Estimate pitch (complementary filter).
  float rate = (mpu.getRotationY() - gyroBias) / GYRO_SENS;      // deg/s
  float ax = mpu.getAccelerationX();
  float az = mpu.getAccelerationZ();
  float accelPitch = atan2(-ax, az) * 180.0 / PI;
  pitch = ALPHA * (pitch + rate * DT) + (1.0 - ALPHA) * accelPitch;

  // 2. Wheel speed every 20 ms (4 ticks) from the left encoder.
  tick++;
  if (tick % 4 == 0) {
    noInterrupts();
    long c = countL;
    interrupts();
    wheelRpm = (c - lastCountL) / CPR * 60.0 / 0.02;
    lastCountL = c;
  }

  // 3. Safety: lying down -> motors off until stood up again.
  if (abs(pitch) > FALL_DEG) {
    running = false;
  }
  if (!running && abs(pitch) < 3.0) {
    running = true;
  }
  if (!running) {
    stopMotors();
    return;
  }

  // 4. Outer loop: lean against the wheel speed to stay in place.
  float targetLean = constrain(-KV_SPEED * wheelRpm, -MAX_LEAN, MAX_LEAN);

  // 5. Inner loop: PD on the tilt, using the gyro rate as the derivative.
  float u = KP_ANGLE * (pitch - targetLean) + KD_ANGLE * rate;

  motor(PWM_L, L_IN1, L_IN2, u);
  motor(PWM_R, R_IN1, R_IN2, u);

  if (tick % 10 == 0) {                  // 20 Hz to the plotter
    Serial.print("pitch:");
    Serial.print(pitch);
    Serial.print(",target:");
    Serial.print(targetLean);
    Serial.print(",u:");
    Serial.print(u);
    Serial.print(",rpm:");
    Serial.println(wheelRpm);
  }
}
```

## Readouts

| label | source | unit |
|---|---|---|
| TRUE PITCH | `{kind:'behavior', key:'pitch_true'}` | ° |
| ESTIMATED PITCH | `{kind:'behavior', key:'serial.pitch'}` | ° |
| CONTROL u | `{kind:'behavior', key:'serial.u'}` | '' |
| GROUND SPEED | `{kind:'behavior', key:'v_mps'}` | '' (m/s) |
| BATTERY | `{kind:'voltage', node:'vbat'}` | V |
| MOTOR CURRENT (L) | `{kind:'current', elementId:'m_l'}` | A |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Push (impulse) | `behavior:balance-bot` | pushN | −5 | 5 | 0.5 | no | N (applied for 50 ms) |
| COM height | `behavior:balance-bot` | l | 0.04 | 0.2 | 0.01 | no | m |
| Battery voltage | `bat` | value | 6.0 | 8.4 | 0.1 | no | V |
| Floor slope | `behavior:balance-bot` | slopeDeg | −5 | 5 | 0.5 | no | ° |

Raise the COM to 0.15 m: the pole (point-mass estimate) drops to about 8 rad/s and the robot gets *easier* to balance (but needs more lean to stop). Lower it to 0.04 m and the pole rises to about 16 rad/s, so the same gains start to oscillate.

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: 200 Hz loop. Push it and watch the lean, the catch, and the return. |
| readout 0 above 35 | Fallen: motors cut. Stand it up within 3° to re-arm. |
| readout 4 below 6.6 | Pack below 3.3 V per cell: stop and charge. Li-ion cells don't like deep discharge. |

## Failures

### F1: Tired, high-resistance battery
- **Patches:** `{op:'set', elementId:'bat', key:'value', value:6.4}`, `{op:'set', elementId:'bat', key:'rInternal', value:1.5}`
- **Sim shows:** it balances when undisturbed. After a 3 N push the motors demand about 1.5–2 A, the pack sags by 2–3 V, top speed and torque fall, and the robot can't catch itself. It falls in the direction of the push.
- **Why:** balancing needs *reserve* authority: the speed and torque to drive under the falling COM. As in the PID lesson, gains can't create volts. Monitor the battery (A0) and stop before the cells reach 3.0–3.3 V each.

### F2: IMU mounted 3° off
- **Patch:** `{op:'set', elementId:'behavior:imu-mpu6050', key:'mountOffsetDeg', value:3}`
- **Sim shows:** the robot balances at a true lean of about 3°, so it constantly accelerates forward. The outer speed loop asks for −6° (its limit), which isn't enough to cancel 3° of offset plus drift, and it runs off the mat.
- **Why:** the controller balances what the sensor *says* is upright. Calibrate the zero angle by balancing it by hand, or let a slow integral on wheel position or speed find the true balance point.

### F3: Right motor wired backwards
- **Patches:** `{op:'remove', elementId:'m_r'}`, `{op:'add', element:{id:'m_r', type:'MOTOR', nodes:['ro2','ro1'], r:4, l:0.0005, ke:0.0054, j:3e-7, b:8e-7}}`
- **Sim shows:** on the first correction one wheel drives forward and the other back. The robot spins on the spot and falls within about 0.3 s.
- **Why:** a sign error in one actuator. Test each subsystem open-loop first: command +50 PWM with the robot held up and check both wheels turn "forward", and both encoders count up.

### F4: Worn gearbox (4° backlash)
- **Patch:** `{op:'set', elementId:'behavior:balance-bot', key:'backlashDeg', value:4}`
- **Sim shows:** it stays up, but with a constant 2–3 Hz wobble: a **limit cycle**. Each direction change passes through 4° of free play before the torque reaches the wheels.
- **Why:** backlash is a dead zone inside the loop. The controller overshoots into it, waits, and corrects late, over and over. Fixes: lower-backlash gearboxes, a smaller KP, or backlash compensation (adding a quick extra kick on reversal). Cheap TT-style gearboxes are a common reason hobby balancers wobble.

## Meet the board

**Physics.** A rigid body pivoting at the axle with COM height l falls as θ̈ ≈ (g/l)·θ for small angles. Its unstable pole is **√(g/l)**. For a point mass at l = 0.08 m: √(9.81/0.08) = **11.1 rad/s**. The tilt doubles every ln 2 / 11.1 ≈ **62 ms**. With the body's own inertia included the pole is slower: √(M·g·l/(I_c + M·l²)) = √(0.628/0.00812) ≈ 8.8 rad/s with the values here. The controller must act several times inside that window, so **200 Hz** (5 ms) gives about 12 updates per doubling.

**Estimation.** Complementary filter at dt = 5 ms with α = 0.98, giving τ = 0.98 × 0.005 / 0.02 = **0.245 s**. The gyro covers the fast motion and the accelerometer corrects the slow drift.

**Control.** Inner PD on the angle: u = Kp·(θ − θ_target) + Kd·θ̇. Using the gyro rate directly for θ̇ avoids differentiating a noisy angle. Outer loop: θ_target = −Kv·speed, so to stop, the robot first leans back.

**Authority.** 6 V motors on an 8.4 V pack: cap PWM at 6/8.4 × 255 ≈ **182**. Top output speed is about 190 rpm, so the ground speed is 190/60 × π × 0.065 ≈ **0.65 m/s**. To stay up, the wheels must be able to get back under the COM. A push faster than that is unrecoverable whatever the gains.

**Bring-up order:** IMU signs → motor signs → encoder signs → inner loop with the outer loop off (KV = 0) → outer loop.

## For mechanical engineers

> This is the broomstick-on-a-palm problem: an inverted pendulum, statically unstable, made dynamically stable by moving the support under the centre of mass. It has the same structure as the cart-pole in every controls textbook. The PD gains set an equivalent rotational stiffness and damping that must beat the "negative stiffness" M·g·l of gravity. The outer loop is like a slow trim tab. **Where it breaks:** the linear model assumes small angles, ideal actuators and no delay. Real gear backlash, motor saturation, sensor filter delay (DLPF + τ) and loop jitter all eat phase margin, which is why tuning on the real robot always ends below the textbook gains.

## Pro tips

1. Hold the robot in your hand at first, with the motors on and the outer loop off. Tilt it and feel the wheels push the right way. Then set it down, ready to catch it.
2. Keep the loop period constant and measure it (toggle a pin each tick and look at it with the scope). A `Serial.print` that blocks at 9600 baud can stretch a 5 ms loop to 20 ms and destabilise it.
3. Put the battery high on the chassis. A higher COM lowers √(g/l), giving you more time, at the cost of needing more lean to accelerate.

## Quiz

1. **Point-mass COM at l = 0.08 m. What is the unstable pole, and how long does the tilt take to double?**
   - 3.5 rad/s, 0.2 s
   - 11.1 rad/s, 62 ms
   - 31 rad/s, 22 ms
   - 98 rad/s, 7 ms
   - **Answer:** 1. *Why:* √(9.81/0.08) = 11.1 rad/s, and ln 2 / 11.1 ≈ 0.062 s.

2. **A complementary filter at 200 Hz should have τ ≈ 0.25 s. Which α?**
   - 0.90
   - 0.95
   - 0.98
   - 0.999
   - **Answer:** 2. *Why:* α = τ/(τ + dt) = 0.25/0.255 ≈ 0.980.

3. **Output shaft maximum 190 rpm, 65 mm wheels. What is the top ground speed?**
   - 0.10 m/s
   - 0.33 m/s
   - 0.65 m/s
   - 1.3 m/s
   - **Answer:** 2. *Why:* v = 190/60 rev/s × π × 0.065 m ≈ 0.65 m/s.

4. **Why use the gyro rate for the D term instead of differentiating the filtered angle?**
   - The gyro is more accurate at DC
   - The gyro measures the rate directly with little delay, while differentiating the angle amplifies noise and adds the filter's lag
   - The accelerometer can't be differentiated
   - It saves an I²C read
   - **Answer:** 1. *Why:* the rate is the derivative, measured directly. Numerical differentiation of a quantised, filtered angle is noisy and late.

## SIM NOTE

- **Mechanical co-simulation:** `balance-bot` couples two MOTOR elements' mechanical states to a pendulum. Setting `load` with a one-tick lag works at 1 ms but can chatter near zero speed. Proposal: a mechanical-coupling API (the behavior supplies the load torque as a function of ω, evaluated inside the solver step), or let MOTOR accept an external inertia and torque input.
- **Pin-change interrupts** on pins 11/12 (PCINT) for the right encoder. The Uno has only two external interrupts. The sketch counts only the left wheel. The full version would use `PCICR`/`PCMSK` registers or a library, so the subset needs either a register stub or a behavior-provided `attachPinChangeInterrupt`.
- Two instances of the same behavior (`quad-encoder` left and right) with different parameters. Behavior instances need ids, e.g. `quad-encoder#L`.
- `abs()` on floats, `return` inside `loop()`, and the float-to-int `int mag = abs(u)` truncation.
- 3D: the robot must move and tilt on the mat (`pitch_true`, `x_m`), so the board itself is a dynamic body, unlike every other lesson's fixed bench. This is a new rendering capability.
- `PartKind` lacks a chassis/standoff part, and `battery-lipo` is used for the 2S 18650 pack.
