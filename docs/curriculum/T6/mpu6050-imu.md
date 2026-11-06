# MPU-6050 IMU

*Gyro drifts, accel shakes*

> An uncorrected 2 °/s gyro bias becomes 120° of error in one minute, and a complementary filter with α = 0.98 at 100 Hz cancels it with a 0.5 s time constant.

- **Lesson id:** `mpu6050-imu` · **Track:** T6 Sensors
- **fig:** 34 (video Fig. 09). Provisional: sidebar order.
- **Prerequisites:** `arduino-uno`, `interrupts-timers`, T7 `serial-protocols` (recommended, not required)
- **Power element:** `usb_plug` (powerLabel: "Plug USB")
- **Behaviors:** `imu-mpu6050`, `mcu-supply`, `serial-plotter`
- **transient:** true (vibration motor)

## Learning goals

1. Say what a MEMS gyroscope measures (angular rate) and what an accelerometer measures (specific force, i.e. gravity plus linear acceleration).
2. Convert raw counts to physical units: 131 LSB per °/s at ±250 °/s, and 16384 LSB per g at ±2 g.
3. Compute tilt from the accelerometer with `atan2`, and tilt from the gyro by integration. Explain why the first is noisy and the second drifts.
4. Implement a complementary filter, and relate α to a time constant: τ = α·dt / (1 − α).
5. Wire the GY-521 board correctly: I²C address 0x68/0x69 via AD0, the 3.3 V regulator and pull-ups, and the Uno's 3.5 V I²C threshold.

## Board

Board: `IMU BENCH`, size 13 × 8, base `mat`. The GY-521 sits on a hinged tilt plate.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | I²C master, filter maths, vibration motor PWM. | `pin_sda`, `pin_scl`, `pin6` |
| gy521 | `module` (title "GY-521", 21 × 16 mm) | `module` | GY-521 | The common MPU-6050 breakout. | — |
| u1 | `ic-smd` (QFN-24 4 × 4 mm, TDK InvenSense MPU-6050) | `smd` | MPU-6050 | 3-axis gyro + 3-axis accelerometer, 16-bit ADCs, digital low-pass filter, I²C at 0x68 or 0x69. | `i_mpu` |
| u2 | `ic-smd` (SOT-23-5 3.3 V LDO; often marked 662K, XC6206-class) | `smd` | 3V3 LDO | Lets the board run from 5 V. The MPU-6050's own VDD range is 2.375–3.46 V. | `ldo` |
| r_pu | `resistor-smd` (×2, pull-ups to 3.3 V; values vary by maker, 2.2–10 kΩ) | `smd` | I²C PULL-UP | Pull SDA/SCL high. | `r_sda`, `r_scl` |
| r_ad0 | `resistor-smd` (pull-down on AD0) | `smd` | AD0 | Default AD0 = LOW gives address 0x68. | `r_ad0` |
| c_reg | `capacitor-smd` (×3) | `smd` | DECOUPLE | LDO and MPU decoupling, plus the MPU's REGOUT and CPOUT capacitors. | — |
| led_pwr | `led-smd` | `smd` | PWR | | — |
| hdr | `header-male` (8-pin: VCC GND SCL SDA XDA XCL AD0 INT) | `tht` | PINS | | — |
| plate | `module` (title "TILT PLATE", hinged) | `offboard` | TILT | You set the true pitch with the tweak, or by dragging the plate. | — |
| vib | `dc-motor` (3 V coin/ERM, eccentric mass) | `offboard` | SHAKER | Shakes the plate to show the accelerometer's weakness. | `vib` |
| q1 | `transistor-to92` (2N2222A) | `offboard` | NPN | Switches the shaker from pin 6. | `q1` |
| d1 | `diode` (1N4148) | `offboard` | FLYBACK | Clamps the shaker's inductive kick. | `d_fly` |
| r_b, r_vib | `resistor` (1 kΩ, 22 Ω) | `offboard` | BASE · LIMIT | Base resistor and shaker current limit. | `r_b`, `r_vib` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_usb` | V | `usb_vbus`, `0` | 5.0 V, rInternal 0.3 Ω | — | |
| `usb_plug` | SW | `usb_vbus`, `vbus_in` | closed: false | — | **Power element** |
| `f1` | R | `vbus_in`, `5v` | 0.3 Ω | maxI 1.0 A | |
| `i_board` | I | `5v`, `0` | 0.045 A | maxV 6 V | Uno |
| `ldo` | OPAMP | `5v`, `3v3`, `3v3` | vPos 3.3, vNeg 0 | — | LDO model (clamped buffer, see `esp32-s3`) |
| `i_mpu` | I | `3v3`, `0` | 0.0039 A | maxV 6 V | 3.9 mA with gyro + accel on (datasheet). 6 V absolute maximum. |
| `r_sda` | R | `3v3`, `sda` | 4.7 kΩ | — | |
| `r_scl` | R | `3v3`, `scl` | 4.7 kΩ | — | |
| `pin_sda` | PIN | `sda`, `0` | pin 18 (A4), vcc 5 | — | INPUT (open-drain idle, SIM NOTE) |
| `pin_scl` | PIN | `scl`, `0` | pin 19 (A5), vcc 5 | — | |
| `r_ad0` | R | `ad0`, `0` | 4.7 kΩ | — | |
| `pin6` | PIN | `d6`, `0` | pin 6, vcc 5 | — | PWM (Timer0, ~980 Hz) |
| `r_b` | R | `d6`, `b1` | 1 kΩ | — | |
| `q1` | NPN | `m_n`, `b1`, `0` | beta 100 | maxI 0.6 A, maxV 40 V | 2N2222A |
| `vib` | MOTOR | `5v`, `vm_r` | r 30 Ω, l 0.0002, ke 0.00095, j 2e-9, b 5e-11 | maxI 0.2 A | 3 V ERM (representative) |
| `r_vib` | R | `vm_r`, `m_n` | 22 Ω | maxP 0.25 W | Drops 5 V to roughly 3 V at the motor |
| `d_fly` | D | `m_n`, `5v` | is 2.5e-9, n 1.75 | maxI 0.2 A | 1N4148 |

Expected values: 3V3 = 3.30 V. SDA/SCL idle at 3.30 V, which is *below* the Uno's TWI VIH of 0.7 × 5 = 3.5 V (see the pro tips). Shaker at full duty: about (5 − 0.2)/(30 + 22) ≈ 90 mA at stall, less once it spins.

### Behaviors

- **`imu-mpu6050`** (reused in the capstone). Parameters: `pitchSource` (tweak `pitchDeg`, a scripted profile, or another behavior's `pitch_true`), `gyroBias` 2.1 °/s (a sample bias within the datasheet's ±20 °/s zero-rate tolerance), `biasTempco` 0.03 °/s per °C (illustrative), `tempC` 25, `gyroNoise` 0.005 °/s/√Hz and `accelNoise` 400 µg/√Hz (datasheet spectral densities), `vibGain` (g of plate vibration per (rad/s)² of shaker speed, chosen so that full shaker speed gives about 0.5 g rms; illustrative), `dlpf` 0–6, `mountOffsetDeg` 0, and `addr` 0x68.
  - **True motion:** each tick it computes the true pitch θ and its rate ω_y, either from the tweak (rate-limited to 200 °/s) or from the source behavior.
  - **Gyro Y:** raw = (ω_y + bias(T) + noise) × 131, clamped to ±32767.
  - **Accelerometer:** ax = −sin θ g + a_vib,x + noise, ay = noise, az = cos θ g + a_vib,z + noise. Raw = value × 16384 (±2 g). a_vib is a sinusoid at the shaker frequency (`extra['vib.omega']` / 2π) with amplitude vibGain·ω².
  - **DLPF:** a first-order low-pass on both, with bandwidth from the DLPF_CFG table (0: 260 Hz, 1: 184, 2: 94, 3: 44, 4: 21, 5: 10, 6: 5 Hz for the accelerometer; the gyro is similar). It attenuates the vibration and adds delay.
  - **Bus check:** V(sda) and V(scl) idle above 0.7 × V(3v3) and V(3v3) above 2.375 V. Address = 0x68 + (V(ad0) > 0.7 × V(3v3) ? 1 : 0). If the bus is bad or the address does not match `addr`, `testConnection()` returns false and every read returns 0.
  - **Library:** exposes `mpu`, modelled on the i2cdevlib MPU6050 API: `initialize()`, `testConnection()`, `getAccelerationX/Y/Z()`, `getRotationX/Y/Z()`, `getTemperature()`, `setDLPFMode(n)`, `setFullScaleGyroRange(r)` and `setFullScaleAccelRange(r)`.
  - **Reference filter:** the behavior runs its own complementary filter (α = 0.98 at 100 Hz) for the readouts.
  - **Publishes:** `pitch_true`, `pitch_gyro` (raw gyro integrated without bias correction, from power-up), `pitch_accel`, `pitch_filtered` (the reference filter), `gyro_bias_now`, `vib_g` (rms) and `i2c_ok`.
- **`mcu-supply`**, **`serial-plotter`**: see `arduino-uno`. The sketch's own estimates arrive as `serial.accel`, `serial.gyro` and `serial.filtered`.

## Sketch

**Title:** Complementary filter · **board:** `uno` · **vcc:** 5

| Pin | Use | PIN element |
|---|---|---|
| A4 (18) | SDA | `pin_sda` |
| A5 (19) | SCL | `pin_scl` |
| 6 | Shaker PWM | `pin6` |

```cpp
#include <Wire.h>
#include <MPU6050.h>
// Real code (i2cdevlib): MPU6050 mpu;   The bench provides `mpu` at 0x68.

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
```

## Readouts

| label | source | unit |
|---|---|---|
| TRUE PITCH | `{kind:'behavior', key:'pitch_true'}` | ° |
| ACCEL PITCH | `{kind:'behavior', key:'serial.accel'}` | ° |
| GYRO PITCH | `{kind:'behavior', key:'serial.gyro'}` | ° |
| FILTERED PITCH | `{kind:'behavior', key:'serial.filtered'}` | ° |
| VIBRATION | `{kind:'behavior', key:'vib_g'}` | g |
| I²C IDLE (SDA) | `{kind:'voltage', node:'sda'}` | V |

SIM NOTE: show the four pitch values as one strip chart (a "plotter" readout).

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Plate pitch | `behavior:imu-mpu6050` | pitchDeg | −60 | 60 | 0.5 | no | ° |
| Sensor temperature | `behavior:imu-mpu6050` | tempC | 0 | 70 | 1 | no | °C |
| DLPF setting | `behavior:imu-mpu6050` | dlpf | 0 | 6 | 1 | no | — |

Change the temperature by 20 °C after calibration. The bias shifts by about 0.6 °/s, so the gyro-only trace walks away at 36° per minute while the filtered one stays within a fraction of a degree.

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: tilt the plate and compare the accel, gyro and filtered traces. |
| readout 4 above 0.2 | Shaker on: the accelerometer pitch is noisy, but the filter barely moves. |

## Failures

### F1: Warm the sensor after calibrating
- **Patch:** `{op:'set', elementId:'behavior:imu-mpu6050', key:'tempC', value:55}`
- **Sim shows:** the gyro bias shifts by about 0.9 °/s. GYRO PITCH drifts at about 54°/min. FILTERED PITCH settles to a steady error of only τ × 0.9 ≈ **0.44°**.
- **Why:** MEMS gyro bias depends on temperature. A one-time calibration at power-up removes the bias at *that* temperature. The complementary filter bounds the error, but leaves a steady offset of bias × τ. A larger (1 − α) shrinks that offset and lets more accelerometer noise through.

### F2: Remove the I²C pull-ups
- **Patches:** `{op:'remove', elementId:'r_sda'}`, `{op:'remove', elementId:'r_scl'}`
- **Sim shows:** SDA idles near 0 V. `testConnection()` fails, and Serial prints "MPU-6050 not found".
- **Why:** open-drain bus lines need pull-ups (`serial-protocols`). Some GY-521 clones skip them, and some setups enable the Uno's internal 20–50 kΩ pull-ups, which pull to 5 V: out of spec for the 3.3 V MPU-6050's pins.

### F3: AD0 pulled high
- **Patch:** `{op:'short', a:'ad0', b:'3v3'}`
- **Sim shows:** the chip now answers at 0x69. The library still looks at 0x68, so nothing is found.
- **Why:** AD0 sets the low address bit. This is useful for putting two IMUs on one bus, and a classic "works on one board, not the other" bug when AD0 is left floating on a breakout without a pull-down.

## Meet the board

The MPU-6050 contains two very different sensors.

**Gyroscope:** measures **rate**. At ±250 °/s full scale it outputs **131 counts per °/s**, so a raw reading of 655 is 5.0 °/s. Integrating rate gives angle, but any bias is integrated too. The datasheet allows up to ±20 °/s of zero-rate offset before calibration. Even 2 °/s left uncorrected becomes 120° in a minute.

**Accelerometer:** at ±2 g, **16384 counts per g**. At rest it measures gravity, so pitch = atan2(−ax, az). It never drifts, but it can't tell tilt from acceleration: a 0.1 g jolt reads as 5.7° of tilt, and motors make it shake.

**Complementary filter:** pitch = α·(pitch + rate·dt) + (1 − α)·accelPitch. With α = 0.98 and dt = 10 ms, the time constant is τ = α·dt/(1 − α) = 0.98 × 0.01 / 0.02 = **0.49 s**. Above about 1/(2πτ) ≈ 0.3 Hz you trust the gyro, and below it the accelerometer. Effectively it is a high-pass on the gyro plus a low-pass on the accelerometer, with crossovers that sum to one.

**Steady error from residual bias:** bias × τ. 0.9 °/s × 0.49 s ≈ 0.44°.

**Wiring:** the GY-521's 3.3 V LDO lets it run from 5 V. Its pull-ups go to 3.3 V, which the Uno's TWI usually accepts even though it is under the datasheet's 0.7 × VCC = 3.5 V threshold.

Note: TDK lists the MPU-6050 as not recommended for new designs. Check the current status.

## For mechanical engineers

> The gyro is a tachometer on a rotary table: precise over seconds, but integrate a tiny calibration error and the position estimate creeps away. The accelerometer is a plumb bob: always knows "down" on average, but swings wildly when the table is bumped. The complementary filter is a mechanical filter in parallel: a stiff, fast linkage from the tachometer and a soft spring to the plumb line, tuned so the spring slowly pulls the drift out without passing the swing through. **Where it breaks:** a plumb bob in a turning vehicle hangs off-vertical in a sustained curve (centripetal acceleration). No filter time constant fixes that. You need a model of the motion or more sensors.

## Pro tips

1. Calibrate the gyro after the sensor has warmed up (10–30 s), with the board perfectly still. Store the offset, or use the MPU's offset registers so the raw data comes out pre-corrected.
2. Choose the DLPF bandwidth for your loop: about 2–5 times your control bandwidth, not "as low as possible". Mode 6 (5 Hz) adds about 19 ms of delay, enough to destabilise a balancing robot.
3. Check the axis signs on *your* board. Tilt it nose-down by hand and confirm both the accel and gyro estimates go the same direction. Mounting orientation decides which axis is "pitch".

## Quiz

1. **At ±250 °/s range, the gyro reads 655 counts. What is the rotation rate?**
   - 0.2 °/s
   - 2.5 °/s
   - 5.0 °/s
   - 65.5 °/s
   - **Answer:** 2. *Why:* 655 / 131 = 5.0 °/s.

2. **A residual gyro bias of 0.5 °/s is integrated for 60 s with no correction. What is the angle error?**
   - 0.5°
   - 8.3°
   - 30°
   - 120°
   - **Answer:** 2. *Why:* 0.5 °/s × 60 s = 30°.

3. **You want τ = 0.5 s with a 200 Hz loop (dt = 5 ms). What α should you use?**
   - 0.90
   - 0.95
   - 0.99
   - 0.999
   - **Answer:** 2. *Why:* α = τ/(τ + dt) = 0.5/0.505 ≈ 0.990.

4. **Why is accelerometer-only tilt unreliable on a moving robot?**
   - The accelerometer drifts with temperature like the gyro
   - It measures gravity plus linear acceleration, so any acceleration looks like tilt
   - It can only measure ±2 g
   - I²C is too slow
   - **Answer:** 1. *Why:* it senses specific force. A 0.1 g push reads as atan(0.1) ≈ 5.7° of false tilt.

## SIM NOTE

- **Math built-ins:** `atan2`, `sin`, `cos`, `sqrt`, `abs`/`fabs`, `min`/`max`, `pow`, `log` and `exp`, plus the constant `PI`, are not in the §5 list but are needed here and in later lessons.
- `while (true) { delay(1000); }` as an intentional halt must work with the loop guard (it does wait).
- A **plotter readout** type (several behavior keys on one time chart) would make this lesson readable. Single numbers are a poor view of drift.
- An open-drain PIN mode, so that I²C idle and pull-up presence come from the netlist (shared with `pca9685-servo`).
- Behavior-param tweaks: `pitchDeg`, `tempC`, `dlpf`. A draggable 3D tilt plate bound to `pitchDeg` would be ideal.
- The `imu-mpu6050` behavior needs `extra['vib.omega']` from the MOTOR, which is available in the Solution.
