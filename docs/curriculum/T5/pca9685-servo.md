# PCA9685 Servo Driver

*16 servos, two wires*

> One I²C address drives 16 independent 12-bit PWM channels. At 50 Hz a 1.5 ms servo pulse is a count of 307 out of 4096.

- **Lesson id:** `pca9685-servo` · **Track:** T5 Motors & drivers
- **fig:** 32 (video Fig. 08). Provisional: sidebar order.
- **Prerequisites:** `arduino-uno`, T3 `adc-dac-pwm`
- **Power element:** `usb_plug` (powerLabel: "Plug USB"). The servo supply is the tweak `psu_sw`.
- **Behaviors:** `pca9685`, `mcu-supply`, `serial-plotter`
- **transient:** true (bulk capacitor)

## Learning goals

1. Explain a hobby servo's control signal: a pulse of about 0.5–2.5 ms repeated every 20 ms, where the width (not the duty) sets the angle.
2. Compute the PCA9685's prescaler for a given frequency and the 12-bit on/off counts for a given pulse width.
3. Wire I²C correctly: SDA/SCL, pull-ups, 7-bit address 0x40 plus the A0–A5 address jumpers.
4. Size a separate servo supply and bulk capacitance, and keep a common ground.
5. Know why the Uno's 5 V pin and USB cannot power several servos.

## Board

Board: `SERVO BENCH`, size 16 × 9, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | I²C master on A4 (SDA) / A5 (SCL). | `pin_sda`, `pin_scl` |
| brd | `module` (title "PCA9685 16-CH", 62 × 25 mm breakout) | `module` | SERVO BOARD | Carrier for the PWM chip, servo headers and power terminal. | — |
| u1 | `ic-smd` (TSSOP-28, NXP PCA9685) | `smd` | PCA9685 | 16-channel, 12-bit PWM controller with an internal 25 MHz oscillator, I²C up to 1 MHz. | `i_pca` |
| r_ser | `resistor-smd` (220 Ω ×16) | `smd` | 220 Ω | Series resistors on each output limit fault current into a servo's signal pin. | — |
| r_pu | `resistor-smd` (10 kΩ ×2) | `smd` | I²C PULL-UP | Pull SDA/SCL up to VCC. Many breakouts fit them; check yours. | `r_sda`, `r_scl` |
| jp_addr | `logic-ic-label` (solder jumpers A0–A5) | `smd` | ADDR | Bridge to change the address from 0x40 up to 0x7F. | — |
| tb_vplus | `screw-terminal` (2-way) | `tht` | V+ | Servo power input, separate from logic VCC. | — |
| c_bulk | `capacitor-electrolytic` (470 µF 10 V) | `tht` | BULK | Rough guide: about 100 µF per servo, for the start-up surges. | `c_bulk` |
| hdr_servo | `header-male` (16 × 3, GND/V+/PWM) | `tht` | CH 0–15 | Servo plugs. | — |
| hdr_logic | `header-male` (6-pin: GND, OE, SCL, SDA, VCC, V+) | `tht` | LOGIC | To the Uno. OE (active LOW) disables all outputs. | — |
| led_pwr | `led-smd` | `smd` | PWR | | — |
| psu | `module` (title "5 V 4 A PSU") | `offboard` | 5V 4A | Dedicated servo supply. | `psu`, `psu_sw` |
| s0–s3 | `servo` (SG90-class micro servo) | `offboard` | SERVO 0–3 | 4.8–6 V servos: about 10 mA idle, a few hundred mA moving, and a stall current often quoted around 0.65 A (unverified; measure yours). | `s0`, `s1`, `s2`, `s3` |

## Circuit

The PCA9685's outputs are not simulated as waveforms. The `pca9685` behavior holds its registers, works out each channel's pulse width, moves the servo models, and sets each servo's supply current on the V+ rail.

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_usb` | V | `usb_vbus`, `0` | 5.0 V, rInternal 0.3 Ω | — | |
| `usb_plug` | SW | `usb_vbus`, `vbus_in` | closed: false | — | **Power element** |
| `f1` | R | `vbus_in`, `5v` | 0.3 Ω | maxI 1.0 A | Polyfuse + FDN340P |
| `i_board` | I | `5v`, `0` | 0.045 A | maxV 6 V | Uno |
| `i_pca` | I | `5v`, `0` | 0.006 A | maxV 6 V | PCA9685 logic, a few mA (approximate). 6 V is the VDD absolute maximum. |
| `r_sda` | R | `5v`, `sda` | 10 kΩ | — | |
| `r_scl` | R | `5v`, `scl` | 10 kΩ | — | |
| `pin_sda` | PIN | `sda`, `0` | pin 18 (A4), vcc 5 | — | INPUT/open-drain (SIM NOTE) |
| `pin_scl` | PIN | `scl`, `0` | pin 19 (A5), vcc 5 | — | |
| `psu` | V | `psu_p`, `psu_n` | 5.0 V, rInternal 0.05 Ω | — | |
| `psu_sw` | SW | `psu_p`, `vplus` | closed: false | — | Servo supply switch (tweak) |
| `gnd_link` | R | `psu_n`, `0` | 0.01 Ω | — | Common ground through the board |
| `c_bulk` | C | `vplus`, `psu_n` | 470 µF | maxV 10 V | |
| `s0` | I | `vplus`, `psu_n` | set by behavior | maxV 7.2 V | Servo 0 supply current |
| `s1` | I | `vplus`, `psu_n` | set by behavior | maxV 7.2 V | |
| `s2` | I | `vplus`, `psu_n` | set by behavior | maxV 7.2 V | |
| `s3` | I | `vplus`, `psu_n` | set by behavior | maxV 7.2 V | |

### Behaviors

- **`pca9685`**. Exposes a pre-made library object `pwm`, modelled on the Adafruit PWM Servo Driver API: `begin()`, `setOscillatorFrequency(hz)`, `setPWMFreq(f)`, `setPWM(ch, on, off)`, `writeMicroseconds(ch, us)` and `sleep()`/`wakeup()`. It also exposes `Wire.setClock(hz)`.
  - **Bus check (each call):** SDA and SCL must idle above 0.7 × 5 V (pull-ups present, VDD present), VDD (`5v`) must be above 2.3 V, and the address must be 0x40 (behavior param `addr`; the jumper patch changes it). On failure the call does nothing and increments `i2c_errors`. Like the Adafruit library, it does not report errors to the sketch.
  - **Frequency:** prescale = round(osc / (4096 × f)) − 1, clamped to 3…255. The actual frequency is f_act = oscActual / (4096 × (prescale + 1)). `osc` is the value the sketch passes in, default 25 MHz. `oscActual` is a behavior param, default 25.0 MHz. Real chips vary by several percent; Adafruit suggests calibrating.
  - **Per channel:** pulse_us = (off − on) / 4096 × 1e6 / f_act.
  - **Servo model (channels 0–3):** target angle = (pulse_us − 500) / 2000 × 180°, clamped to 0–180°. That is the 500–2500 µs convention; many SG90s cover less, so calibrate. The servo slews at about 0.1 s per 60° (SG90 at 4.8 V, approximate) and responds only if V(vplus) − V(psu_n) > 4.0 V and the signal has a valid ground reference (`gnd_link` present). If V+ is below 3.5 V or the ground is missing, it jitters randomly.
  - **Servo current:** 0.01 A when holding with no load, 0.25 A while moving (approximate), 0.65 A for 30 ms at each move start (surge) or when blocked by the behavior param `blocked[ch]`.
  - **Publishes:** `freq_actual`, `prescale`, `ch<n>_us`, `ch<n>_deg`, `vplus_V`, `servo_A_total` and `i2c_errors`.
- **`mcu-supply`**, **`serial-plotter`**: see `arduino-uno`. If V(5v) < 2.7 V the Uno resets, which matters in F1.

## Sketch

**Title:** Walking wave · **board:** `uno` · **vcc:** 5

| Pin | Use | PIN element |
|---|---|---|
| A4 (18) | SDA | `pin_sda` |
| A5 (19) | SCL | `pin_scl` |
| — | PCA9685 channels 0–3: servos s0–s3 | (behavior) |

```cpp
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
// On real hardware you would declare:
//   Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver(0x40);
// The bench provides `pwm` at address 0x40 already.

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
```

## Readouts

| label | source | unit |
|---|---|---|
| PWM FREQ (ACTUAL) | `{kind:'behavior', key:'freq_actual'}` | Hz |
| CH0 PULSE | `{kind:'behavior', key:'ch0_us'}` | '' (µs) |
| CH0 ANGLE | `{kind:'behavior', key:'ch0_deg'}` | ° |
| SERVO RAIL V+ | `{kind:'voltage', node:'vplus', ref:'psu_n'}` | V |
| SERVO CURRENT | `{kind:'behavior', key:'servo_A_total'}` | A |
| UNO 5V | `{kind:'voltage', node:'5v'}` | V |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Servo PSU switch | `psu_sw` | closed | 0 | 1 | 1 | no | — |
| PSU internal R | `psu` | rInternal | 0.02 | 2 | — | yes | Ω |
| Bulk capacitor | `c_bulk` | value | 1e-5 | 2.2e-3 | — | yes | F |
| Real oscillator | `behavior:pca9685` | oscActual | 23e6 | 27e6 | 1e5 | no | Hz |

Set the real oscillator to 26.5 MHz while the sketch still says 25 MHz. The frame runs 6 % fast, every pulse is 6 % short, and the servos shift by several degrees.

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: four servos ripple through a wave, one I²C command per channel per frame. |
| readout 3 below 4.5 | Servo rail sagging under the surge: add capacitance or a stiffer supply. |
| readout 5 below 4.0 | Uno 5 V is collapsing: brown-out reset ahead. |

## Failures

### F1: Power the servos from the Uno's 5 V pin
- **Patches:** `{op:'remove', elementId:'psu_sw'}`, `{op:'remove', elementId:'gnd_link'}`, `{op:'add', element:{id:'vplus_from_uno', type:'R', nodes:['5v','vplus'], value:0.05}}`, `{op:'short', a:'psu_n', b:'0'}`
- **Sim shows:** four servos starting together draw a surge of about 4 × 0.65 ≈ 2.6 A through USB. The lumped 0.6 Ω path drops the Uno's 5 V to about 3.4 V, `mcu_warn` lights, and the polyfuse trips after 300 ms. The Uno resets, re-runs `setup()`, centres the servos (surge), and resets again: a **boot loop**.
- **Why:** USB 2.0 ports promise 500 mA, and the Uno's polyfuse holds 500 mA. Servos need amps in short bursts. Give them their own supply with a common ground, plus bulk capacitance.

### F2: No common ground
- **Patch:** `{op:'remove', elementId:'gnd_link'}`
- **Sim shows:** V+ is fine at 5 V and the PCA9685 is happily sending pulses, but the servos twitch randomly or ignore the commands.
- **Why:** a servo reads its signal pin relative to *its* ground. If the servo supply's negative isn't tied to the logic ground, the "pulse" has no defined reference and the return current has no path.

### F3: Breakout without I²C pull-ups
- **Patches:** `{op:'remove', elementId:'r_sda'}`, `{op:'remove', elementId:'r_scl'}`
- **Sim shows:** SDA and SCL sit near 0 V. Every `pwm.*` call fails silently (`i2c_errors` climbs) and the servos never move.
- **Why:** I²C lines are open-drain: devices only ever pull them low. Something has to pull them high, typically 2.2–10 kΩ. The Uno's internal pull-ups (enabled by `Wire`) are 20–50 kΩ, too weak for 400 kHz on anything but a very short bus.

## Meet the board

A hobby servo wants a pulse **every 20 ms (50 Hz)**. The pulse width sets the angle, from about 0.5 ms to 2.5 ms depending on the model, with roughly 1.5 ms at centre. The PCA9685 makes 16 such signals by itself, so the Uno just sends I²C commands.

**Frequency:** prescale = round(25 MHz / (4096 × f)) − 1. For 50 Hz: 25 000 000 / (4096 × 50) = 122.07, which rounds to 122, minus 1 gives **121**. Actual: 25 MHz / (4096 × 122) = **50.03 Hz**. The internal oscillator is not precise, so real boards may run a few percent off. Measure the frame with a scope and correct with `setOscillatorFrequency`.

**Counts:** each frame is 4096 counts over 20 ms, or 4.88 µs per count. 1.5 ms = 1500 / 4.88 ≈ **307 counts**, and 0.5–2.5 ms is 102–512 counts. So a servo only uses about 10 % of the 12-bit range: about 410 steps over 180°, or 0.44° per count.

**Addressing:** the base is 0x40, and the A0–A5 jumpers add 1, 2, 4, 8, 16, 32. Up to 62 boards (992 servos) can share one bus, with some addresses reserved (0x70 is All-Call).

**Power:** outputs sink 25 mA and source 10 mA, which is plenty for signals. Servo current comes from **V+**: SG90-class servos pull a few hundred mA moving and more when blocked. For 8 servos, plan for 8 × 0.65 A ≈ 5 A of peak capability.

## For mechanical engineers

> The PCA9685 is a cam timer with 16 independent cams on one shaft. The shaft turns once every 20 ms, and each cam's lobe length (on/off count) sets how long its follower is lifted. The Uno is the technician who occasionally walks up and swaps a cam profile over a two-wire bus. The servo itself is a closed-loop position actuator: its internal potentiometer is the feedback and the pulse width is the setpoint. **Where it breaks:** the 4096-count resolution is per frame, not per angle, so a servo uses only about 400 of those counts, a coarser "cam" than 12 bits suggests.

## Pro tips

1. Calibrate each servo's endpoints. Sweep `writeMicroseconds` slowly and note where it stops responding or starts buzzing against its end stop. Driving into the stop draws stall current continuously and wears out the gear train.
2. Stagger start-up moves by 100–300 ms per servo, and fit bulk capacitance near the V+ terminal. Start-up surges, not the steady current, are what brown out supplies.
3. Tie OE to a pin. Pulling it HIGH disables every output at once: a cheap, fast software "e-stop" that doesn't depend on the I²C bus.

## Quiz

1. **What PCA9685 prescale value gives about 50 Hz with the 25 MHz internal oscillator?**
   - 30
   - 61
   - 121
   - 255
   - **Answer:** 2. *Why:* round(25e6 / (4096 × 50)) − 1 = round(122.07) − 1 = 121.

2. **At 50 Hz, how many counts (of 4096) make a 1.5 ms pulse?**
   - 75
   - 150
   - 307
   - 2048
   - **Answer:** 2. *Why:* 1.5 ms / 20 ms × 4096 = 307.2, so 307.

3. **A robot arm uses 6 servos that can each stall at about 0.65 A. What peak supply current should you design for?**
   - 0.65 A
   - 2 A
   - About 4 A
   - 20 A
   - **Answer:** 2. *Why:* 6 × 0.65 ≈ 3.9 A worst case, so a 4–5 A supply. Steady state is lower, but surges and stalls are what you design for.

4. **The A0 and A2 address jumpers are bridged. What is the board's I²C address?**
   - 0x40
   - 0x42
   - 0x45
   - 0x50
   - **Answer:** 2. *Why:* 0x40 + 1 (A0) + 4 (A2) = 0x45.

## SIM NOTE

- **Pre-instantiated library objects:** the transpiler does not support C++ object construction (`Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver(0x40);`). The behavior exposes a ready `pwm` global. Proposal: allow `ClassName var(args);` and `ClassName var = ClassName(args);` for behavior-registered classes, the way `Servo` is handled.
- `Wire.setClock` and I²C bus validity checks inside behaviors (node voltages of SDA/SCL). An **open-drain** PIN mode (drive low or release) would let I²C idle states and the "missing pull-up" case come out of the netlist.
- `servoDeg` in `PinState` (from the M1 plan) applies only to the built-in `Servo` on MCU pins. Channels on the PCA9685 need a behavior→3D channel for servo horn angles (for example publish `ch<n>_deg` and let the `servo` part read it).
- Patches that remove a switch and re-route a rail (F1) rely on `add`/`short` ops working together in one scenario.
- Behavior-param tweak `behavior:pca9685.oscActual`.
