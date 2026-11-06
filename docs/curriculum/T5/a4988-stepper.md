# A4988 Stepper Driver

*Current, not voltage*

> A 1.5 Ω NEMA 17 coil on 12 V would draw 8 A, so the A4988 chops the current down to whatever Vref sets: 0.54 V on Vref gives 1.0 A.

- **Lesson id:** `a4988-stepper` · **Track:** T5 Motors & drivers
- **fig:** 31 (video Fig. 07). Provisional: sidebar order.
- **Prerequisites:** `tb6612fng`, T1 `inductor-rl`
- **Power element:** `pwr` (powerLabel: "Switch on 12 V"). The Uno is assumed to be on USB, always on (SIM NOTE).
- **Behaviors:** `a4988`, `mcu-supply`, `serial-plotter`
- **transient:** true

## Learning goals

1. Explain why a stepper is driven by a **current-regulating chopper**, not a voltage, and why the supply is far above I × R.
2. Set the current limit from Vref and the sense resistor: I_trip = Vref / (8 × R_s). Know that R_s differs between boards.
3. Choose microstepping with MS1–MS3 and convert rpm to step rate.
4. Generate STEP/DIR pulses with correct timing and an acceleration ramp, so the motor doesn't stall.
5. Respect the driver's limits: 8–35 V, 2 A peak per coil only with good cooling (about 1 A without), and never unplug the motor while powered.

## Board

Board: `STEPPER BENCH`, size 15 × 9, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | Generates STEP/DIR and sets the microstep pins. | `pin3`, `pin4`, `pin8`, `pin9`, `pin10`, `pin11` |
| drv | `module` (title "A4988", 15 × 20 mm Pololu-format carrier) | `module` | A4988 CARRIER | 16-pin breakout of the driver. | — |
| u1 | `ic-smd` (QFN-28 5 × 5 mm, Allegro A4988) | `smd` | A4988 | Two full bridges, each with a fixed off-time current chopper, plus the microstep translator. | `ia`, `ib`, `i_vmot` |
| rs1, rs2 | `resistor-smd` (current sense, 0.068 Ω on current Pololu boards; often 0.1 Ω "R100" on clones) | `smd` | R_SENSE | Turn coil current into a voltage that the chopper compares with Vref/8. | — |
| pot | `potentiometer` (SMD trimmer) | `smd` | VREF POT | Sets Vref, and so the coil current limit. | `pot_top`, `pot_bot` |
| tp_vref | `testpoint` | `smd` | VREF | Meter point: Vref is measured from the pot wiper (or the via) to GND. | — |
| hs | `heatsink` (stick-on, 9 × 9 mm) | `smd` | HEATSINK | Pushes the safe current from about 1 A toward 1.5 A+ (with airflow). | — |
| c_bulk | `capacitor-electrolytic` (100 µF 35 V) | `offboard` | VMOT CAP | Required: soaks up the LC spikes from the supply leads. | `c_bulk` |
| psu | `barrel-jack` (to a 12 V 2 A adapter) | `offboard` | 12 V IN | Motor supply. | `psu`, `pwr` |
| mot | `stepper-nema17` (17HS4401-class: 1.7 A, 1.5 Ω, ~2.8 mH per phase, 200 steps/rev; representative) | `offboard` | NEMA 17 | Bipolar stepper, 1.8° per full step. | `rca`, `lca`, `rcb`, `lcb` |
| wires | `wire` | `offboard` | — | | — |

## Circuit

The chopper is modelled as two behavior-controlled **current sources** (one per coil), with each coil's R and L in series. The behavior sets the target current from the microstep table and Vref. It limits that target to what VMOT can actually push through R and L in the time available. Supply current comes from a power balance.

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `psu` | V | `psu_p`, `0` | 12 V, rInternal 0.05 Ω | — | |
| `pwr` | SW | `psu_p`, `vlead` | closed: false | — | **Power element** |
| `r_lead` | R | `vlead`, `vl2` | 0.05 Ω | — | 1 m of supply lead |
| `l_lead` | L | `vl2`, `vmot` | 1 µH | — | Lead inductance, ~1 µH per metre of pair (rule of thumb) |
| `c_bulk` | C | `vmot`, `0` | 100 µF | maxV 35 V | |
| `i_vmot` | I | `vmot`, `0` | set by behavior | maxV 35 V | Driver input current. 35 V is the A4988 VBB maximum. |
| `v_logic` | V | `5v`, `0` | 5.0 V | — | Uno 5 V (USB, always on) |
| `pot_top` | R | `5v`, `vref` | 8 912 Ω | — | Trimmer: the two legs sum to 10 kΩ |
| `pot_bot` | R | `vref`, `0` | 1 088 Ω | — | Vref = 5 × 1088/10000 = 0.544 V gives 1.0 A on a 0.068 Ω board. The range is illustrative; real carriers differ. |
| `pin3` | PIN | `d3`, `0` | pin 3, vcc 5 | — | STEP |
| `pin4` | PIN | `d4`, `0` | pin 4, vcc 5 | — | DIR |
| `pin8` | PIN | `d8`, `0` | pin 8, vcc 5 | — | ENABLE (active LOW) |
| `pin9` | PIN | `d9`, `0` | pin 9, vcc 5 | — | MS1 |
| `pin10` | PIN | `d10`, `0` | pin 10, vcc 5 | — | MS2 |
| `pin11` | PIN | `d11`, `0` | pin 11, vcc 5 | — | MS3 |
| `w_ms1` | R | `d9`, `ms1` | 0.01 Ω | — | Jumper wire |
| `w_ms2` | R | `d10`, `ms2` | 0.01 Ω | — | |
| `w_ms3` | R | `d11`, `ms3` | 0.01 Ω | — | |
| `r_pd1` | R | `ms1`, `0` | 100 kΩ | — | Internal pull-down (datasheet: MS1 and MS3 100 kΩ, MS2 50 kΩ) |
| `r_pd2` | R | `ms2`, `0` | 50 kΩ | — | |
| `r_pd3` | R | `ms3`, `0` | 100 kΩ | — | |
| `ia` | I | `a2`, `a1` | set by behavior | — | Coil A drive (flows into `a1`) |
| `rca` | R | `a1`, `am` | 1.5 Ω | maxP 10 W | Coil A resistance |
| `lca` | L | `am`, `a2` | 2.8 mH | — | |
| `ref_a` | R | `a2`, `0` | 1 MΩ | — | Reference for the floating coil |
| `ib` | I | `b2`, `b1` | set by behavior | — | Coil B drive |
| `rcb` | R | `b1`, `bm` | 1.5 Ω | maxP 10 W | |
| `lcb` | L | `bm`, `b2` | 2.8 mH | — | |
| `ref_b` | R | `b2`, `0` | 1 MΩ | — | |

### Behaviors

- **`a4988`**. Parameters: `rs` 0.068 Ω (set 0.1 for clone boards), `rdsTotal` 0.7 Ω (source + sink per bridge, roughly 0.3–0.4 Ω each, approximate), `rthJA` 50 °C/W (carrier board without a heatsink, approximate), `tsd` 165 °C (typical), `holdTorque` 0.40 N·m at 1.7 A, and `rotorJ` 5.7e-6 kg·m² (approximate; check the motor's datasheet).
  - **Edges.** It consumes timestamped STEP rising edges from the MCU's pin-event stream (µs resolution, SIM NOTE). Pulses narrower than 1 µs high or 1 µs low are ignored (datasheet minimums). DIR is sampled at each edge, and `ENABLE` HIGH turns the outputs off.
  - **Microstep mode** is read from the **voltages** on `ms1–ms3` (VIH 0.7 × VDD):

    | MS1 | MS2 | MS3 | mode |
    |---|---|---|---|
    | L | L | L | full |
    | H | L | L | half |
    | L | H | L | 1/4 |
    | H | H | L | 1/8 |
    | H | H | H | 1/16 |

  - **Current.** Each edge advances the electrical angle θ by 90°/m, where m is the microstep factor. I_trip = V(vref) / (8 × rs). The targets are I_A = I_trip·cos θ and I_B = I_trip·sin θ. In full-step mode θ sits at 45° + k·90°, so each coil carries **70.7 %** of I_trip.
  - **Voltage-limited rise.** Each tick, the coil current approaches its target no faster than di/dt = (VMOT − I·R − ω·ke_motor)/L. At high step rates the current therefore cannot follow and torque falls, which is the torque–speed curve. The behavior sets `ia`/`ib` to that current.
  - **Rotor.** Holding torque scales with current: T_max = holdTorque × (I_peak / 1.7 A). The rotor follows the electrical angle unless the required torque, for load plus inertia × acceleration, exceeds T_max. Then it slips: it publishes `skipped`, and the rotor angle stops advancing.
  - **Supply and heat.** `i_vmot` = (Σ I² × R_coil + Σ I² × rdsTotal) / VMOT + 3 mA. T_j uses a first-order model with τ ≈ 8 s. At T_j ≥ tsd the outputs turn off.
  - **Open coil while energised** (`rca` or `rcb` removed while I > 0.1 A, or an L with no path): the A4988's outputs see an unclamped inductive kick. The behavior marks the driver part burnt (SIM NOTE: behavior-triggered burn).
  - **Publishes:** `microstep`, `itrip_A`, `coilA_A`, `coilB_A`, `steps`, `shaft_deg`, `rpm`, `skipped`, `tj` and `vref_V`.
- **`mcu-supply`**, **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** One turn, ramped · **board:** `uno` · **vcc:** 5

| Pin | A4988 pin | PIN element |
|---|---|---|
| 3 | STEP | `pin3` |
| 4 | DIR | `pin4` |
| 8 | ENABLE (active LOW) | `pin8` |
| 9 / 10 / 11 | MS1 / MS2 / MS3 | `pin9`, `pin10`, `pin11` |
| — | SLEEP and RESET tied together on the carrier | — |

```cpp
#define STEP_PIN 3
#define DIR_PIN  4
#define EN_PIN   8
#define MS1_PIN  9
#define MS2_PIN  10
#define MS3_PIN  11

const long FULL_STEPS_PER_REV = 200;    // 1.8 degrees per full step
int microsteps = 16;

void setMicrostep(int m) {
  int a = LOW;
  int b = LOW;
  int c = LOW;
  if (m == 2)  { a = HIGH; }
  if (m == 4)  { b = HIGH; }
  if (m == 8)  { a = HIGH; b = HIGH; }
  if (m == 16) { a = HIGH; b = HIGH; c = HIGH; }
  digitalWrite(MS1_PIN, a);
  digitalWrite(MS2_PIN, b);
  digitalWrite(MS3_PIN, c);
  microsteps = m;
}

// Step period in microseconds for a given speed.
long periodUs(float rpm) {
  float stepsPerSec = rpm / 60.0 * FULL_STEPS_PER_REV * microsteps;
  return 1000000.0 / stepsPerSec;
}

// Move n microsteps, ramping linearly from startRpm up to topRpm and back down.
void move(long n, float startRpm, float topRpm) {
  long rampSteps = n / 4;
  for (long i = 0; i < n; i++) {
    float rpm = topRpm;
    if (i < rampSteps) {
      rpm = startRpm + (topRpm - startRpm) * i / rampSteps;
    } else if (i > n - rampSteps) {
      rpm = startRpm + (topRpm - startRpm) * (n - i) / rampSteps;
    }
    long p = periodUs(rpm);
    digitalWrite(STEP_PIN, HIGH);
    delayMicroseconds(2);              // >= 1 us high (datasheet)
    digitalWrite(STEP_PIN, LOW);
    delayMicroseconds(p - 2);
  }
}

void setup() {
  pinMode(STEP_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);
  pinMode(EN_PIN, OUTPUT);
  pinMode(MS1_PIN, OUTPUT);
  pinMode(MS2_PIN, OUTPUT);
  pinMode(MS3_PIN, OUTPUT);
  Serial.begin(115200);
  setMicrostep(16);
  digitalWrite(EN_PIN, LOW);           // LOW = outputs enabled
  Serial.println("A4988 ready: 1/16 step, 3200 steps per rev");
}

void loop() {
  long oneRev = FULL_STEPS_PER_REV * microsteps;

  digitalWrite(DIR_PIN, HIGH);
  delayMicroseconds(5);                // DIR setup before the first STEP
  Serial.println("CW one turn, 20 -> 120 rpm");
  move(oneRev, 20, 120);
  delay(500);

  digitalWrite(DIR_PIN, LOW);
  delayMicroseconds(5);
  Serial.println("CCW one turn, 20 -> 60 rpm");
  move(oneRev, 20, 60);
  delay(500);

  Serial.println("Holding torque for 2 s, then free");
  delay(2000);
  digitalWrite(EN_PIN, HIGH);          // outputs off: shaft turns by hand, coils cool
  delay(2000);
  digitalWrite(EN_PIN, LOW);
}
```

## Readouts

| label | source | unit |
|---|---|---|
| VREF | `{kind:'voltage', node:'vref'}` | V |
| CURRENT LIMIT | `{kind:'behavior', key:'itrip_A'}` | A |
| COIL A | `{kind:'current', elementId:'rca'}` | A |
| COIL B | `{kind:'current', elementId:'rcb'}` | A |
| SHAFT SPEED | `{kind:'behavior', key:'rpm'}` | rpm |
| SKIPPED STEPS | `{kind:'behavior', key:'skipped'}` | '' |
| DRIVER Tj | `{kind:'behavior', key:'tj'}` | °C |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Vref trimmer (lower leg) | `pot_bot` | value | 100 | 9900 | 10 | no | Ω |
| Sense resistor on board | `behavior:a4988` | rs | 0.05 | 0.2 | 0.001 | no | Ω |
| Supply voltage | `psu` | value | 8 | 30 | 0.5 | no | V |
| Load torque | `behavior:a4988` | loadNm | 0 | 0.4 | 0.01 | no | N·m |

Raise the supply from 12 V to 24 V and the top speed before skipping roughly doubles. Higher VMOT pushes current into the inductance faster.

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: 3200 microsteps make one turn. Listen for the ramp. |
| readout 1 above 1.5 | Current limit is above 1.5 A: add a heatsink and airflow, or turn Vref down. |
| readout 5 above 0 | Steps lost: the load or acceleration is too much for this current and speed. |

## Failures

### F1: No current limit (trimmer at the stop)
- **Patch:** `{op:'set', elementId:'pot_bot', key:'value', value:9900}`
- **Sim shows:** Vref ≈ 4.95 V gives an I_trip of 4.95 / (8 × 0.068) ≈ 9.1 A target. The chopper never trips, because the coil can only reach V/R = 12 / (1.5 + 0.7) ≈ 5.5 A. Driver loss ≈ 2 × 5.5² × 0.7 ≈ 42 W, so T_j rockets: thermal shutdown, then damage. The motor (rated 1.7 A) also overheats. On the real part, an output current above the 2 A rating can destroy it before the thermal protection acts.
- **Why:** a stepper's winding resistance is tiny on purpose. The driver *must* limit current. Always set Vref before connecting the motor: Vref = I × 8 × R_s, so 1.0 A × 8 × 0.068 = 0.544 V.

### F2: Unplug the motor while powered
- **Patch:** `{op:'remove', elementId:'rca'}`
- **Sim shows:** coil A's current path opens at about 0.7–1 A. The L·di/dt spike exceeds the driver's output rating and the A4988 is marked burnt.
- **Why:** Pololu warns explicitly against connecting or disconnecting a stepper while the driver is powered. Pulling a connector is an instantly opened inductor. Loose screw terminals cause the same thing slowly.

### F3: MS wires fall off
- **Patches:** `{op:'remove', elementId:'w_ms1'}`, `{op:'remove', elementId:'w_ms2'}`, `{op:'remove', elementId:'w_ms3'}`
- **Sim shows:** the internal pull-downs make MS1–3 LOW, which means full step. The sketch still sends 3200 pulses per "rev", so the shaft turns **16 turns**, 16 times faster, and skips steps on the fast part of the ramp.
- **Why:** pins with internal pull-downs default safely, but the firmware's idea of steps per revolution no longer matches the hardware. Tie MS pins to fixed levels with jumpers, or read them back.

## Meet the board

A NEMA 17 like the 17HS4401 class has about **1.5 Ω and 2.8 mH** per phase and is rated **1.7 A**. Across 12 V a coil would draw 12 / 1.5 = 8 A and cook. So the A4988 regulates **current**. It switches the full supply on until the current reaches the trip level, then off for a fixed time, many times per millisecond.

**The trip level:** I_trip = Vref / (8 × R_s). Pololu's current boards use R_s = 0.068 Ω. For 1.0 A, Vref = 1.0 × 8 × 0.068 = **0.544 V**. Clones often use 0.1 Ω (marked "R100"), where 1.0 A needs 0.8 V. Read the sense resistors' marking before you trust anyone's formula. In full-step mode each coil gets 70.7 % of I_trip.

**Why 12–24 V then?** Inductance resists change: di/dt = V/L. At 12 V, the current rises 1 A in about 2.8 mH × 1 A / 12 V ≈ 0.23 ms. At 600 rpm in full step (2000 steps/s) each step lasts 0.5 ms, so a higher voltage is the only way to keep torque at speed.

**Microstepping:** at 1/16, one revolution is 200 × 16 = **3200 steps**. 60 rpm needs 3200 steps/s, a period of 312 µs. Microsteps smooth the motion, but each one carries far less incremental torque than a full step. Don't count on 1/16 for positional accuracy.

**Ratings:** VMOT 8–35 V, logic 3–5.5 V, 2 A per coil maximum (about 1 A without a heatsink, per Pololu).

## For mechanical engineers

> A stepper with an A4988 is a position-controlled detent mechanism. Each STEP pulse moves the magnetic "detent" by 1.8°/m, and the rotor follows like a spring-loaded follower in a cam track. The current limit sets how stiff the spring is (holding torque). Microstepping is a finer cam profile. Load or acceleration beyond the spring force and the follower jumps a tooth (a skipped step), and nothing tells you, because there is no feedback. **Where it breaks:** the magnetic spring weakens as speed rises, because the voltage-limited current can't build in time, so a stepper's stiffness, unlike a cam's, depends on speed.

## Pro tips

1. Set Vref with the motor disconnected and the logic powered, using a ceramic or plastic screwdriver if you can, and the meter's COM on GND. Turn the trimmer in small amounts: on many carriers a quarter turn changes the current by hundreds of mA.
2. Ramp speed up and down. A NEMA 17 starting cold at 600 rpm usually just buzzes, while a 0.2 s ramp gets it there. Libraries like AccelStepper do this for you on real hardware.
3. Disable the outputs (EN HIGH) when holding torque isn't needed. A motor holding at 1 A per coil dissipates 2 × 1² × 1.5 = 3 W in the windings, plus the driver's share, even while standing still.

## Quiz

1. **On a board with R_s = 0.068 Ω, what Vref sets a 1.2 A limit?**
   - 0.082 V
   - 0.41 V
   - 0.65 V
   - 1.2 V
   - **Answer:** 2. *Why:* Vref = 1.2 × 8 × 0.068 = 0.653 V.

2. **How many steps per second does 90 rpm need at 1/8 microstepping on a 200-step motor?**
   - 300
   - 1200
   - 2400
   - 14 400
   - **Answer:** 2. *Why:* 90/60 = 1.5 rev/s, and 1.5 × 200 × 8 = 2400 steps/s.

3. **I_trip is set to 1.0 A and the driver is in full-step mode. What is the coil current while holding?**
   - 0.5 A
   - 0.707 A
   - 1.0 A
   - 1.41 A
   - **Answer:** 1. *Why:* in full-step mode the A4988 sits at the 45° point of its sine table, so each coil carries 70.7 % of I_trip.

4. **Why is unplugging a stepper from a powered A4988 dangerous?**
   - The motor turns into a generator
   - Opening an inductor carrying current produces a large voltage spike that can destroy the driver's outputs
   - It resets the microstep mode
   - It drains the 100 µF capacitor
   - **Answer:** 1. *Why:* V = L·di/dt. Interrupting about 1 A in microseconds through 2.8 mH gives hundreds of volts.

## SIM NOTE

- **STEP edge stream:** at 1/16 step, pulses arrive every 100–300 µs, far faster than the 1 ms sim step. The MCU must timestamp `digitalWrite` edges at µs resolution, and `delayMicroseconds` must advance virtual time precisely. Behaviors then subscribe to edges on specific pins.
- Two power domains again (12 V and USB 5 V). Here the Uno's 5 V is a fixed `V` element with no switch.
- Behavior-triggered burn (`ctx.burn(partId, reason)`) for "driver killed by an open coil", since the averaged current source hides the spike.
- The torque–speed and missed-step physics live in the behavior (rotor state, holding torque, inertia). The netlist only carries the coil R/L and the current sources.
- `Readout` for coil current uses the current through `rca`, which follows the source `ia`.
- `long` and float mixing in `periodUs` relies on assignment to `long` truncating (see the integer-semantics note in `arduino-uno`).
