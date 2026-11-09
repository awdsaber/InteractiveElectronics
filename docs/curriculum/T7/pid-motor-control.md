# PID Motor Speed Control

*Closing the loop*

> The GM-48 gear motor is a first-order plant with a time constant of about 46 ms and a gain of 0.76 rpm per PWM count, so a PI controller with Kp ≈ 0.40 and Ki ≈ 8.7 tracks a speed step with a closed-loop time constant of about 0.15 s (63 % in 0.14 s on the bench, settled within ±3 rpm in about 0.4 s) and wins back a 0.03 N·m brake step in about 0.5 s.

- **Lesson id:** `pid-motor-control` · **Track:** T7 Professional
- **fig:** 44. Provisional: sidebar order.
- **Prerequisites:** `tb6612fng`, `encoders`, `interrupts-timers`
- **Power element:** `usb_plug` (powerLabel: "Plug USB"). The motor battery is the tweak `bat_sw`.
- **Behaviors:** `tb6612`, `quad-encoder`, `dyno-load`, `pid-tune`, `mcu-supply`, `serial-plotter`
- **Guide:** 9 steps: power, upload (P only, Kp 1), raise Kp to 2 (steady error ≈ 62 rpm), the IMC PI 0.40 / 8.7 (error → 0), Kd 0.02 (PWM jitter ≈ 0.5 → 7 counts/sample), a 0.03 N·m brake, swap A/B (runaway), repair, quiz.

> **Implementation notes (2026-11-09, checked on the bench):** the gains, the loop period and the anti-windup switch are bench sliders read by the sketch every sample through the `pid-tune` behavior (`Tune.kp()`, `Tune.ki()`, `Tune.kd()`, `Tune.periodMs()`, `Tune.antiWindup()`), not code constants. The integrator stores the term Σ Ki·e·dt, so a Ki change is bumpless. The original QEM table below counted forward as negative for this encoder (A leads B forward, as in `encoders`): it is corrected. Measured: K = 0.76 rpm/count incremental (86 counts for 60 rpm, 205 for 150) with a ~7-count friction deadband; P-only error at 150 rpm 88 rpm (Kp 1) and 62 rpm (Kp 2), matching e = (sp + K·u₀)/(1 + K·Kp). The sim's frame-coupled encoder and PWM add a few tens of ms of loop lag, so the bench oscillates above Kp ≈ 3 (period ≈ 0.4 s); an ideal 100 Hz loop would reach Kp ≈ 14. A sample-rate failure was added (Kp 1.5 / Ki 20, crisp at 100 Hz, rings 110–175 rpm at 10 Hz), and a too-much-gain failure (Kp 8).
- **transient:** true

## Learning goals

1. Model a DC motor as a first-order plant from its parameters: gain K and time constant τ_m ≈ J·R / (kt·ke).
2. Implement a discrete PID speed loop at a fixed rate (100 Hz) with encoder feedback.
3. Tune PI gains from the model: choose a closed-loop time constant τ_c, then Kp = τ/(K·τ_c) and Ti = τ. Compare with trial-and-error and with Ziegler–Nichols.
4. Handle saturation (anti-windup), measurement quantisation and derivative noise.
5. Recognise loop failures: sign errors (positive feedback), lost feedback (runaway), and insufficient actuator authority.

## Board

Board: `PID BENCH`, size 15 × 9, base `mat`. The motor drives a small flywheel with an adjustable friction brake, a mini dynamometer.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | Runs the 100 Hz PID loop. | `pin2`, `pin3`, `pin4`, `pin5`, `pin7`, `pin8` |
| drv | `module` (TB6612FNG breakout) | `module` | DRIVER | Actuator: PWM → average voltage. | `ha`, `hb`, `ron_a`, `ron_b`, `en_a`, `en_b` |
| mot | `gear-motor-wheel` (GM-48, 48:1, with the 11-PPR hall encoder) | `offboard` | MOTOR + ENCODER | Plant and sensor. | `m1` |
| r_pa, r_pb | `resistor` (10 kΩ) | `offboard` | PULL-UPS | Encoder outputs. | `r_pa`, `r_pb` |
| fly | `module` (title "FLYWHEEL + BRAKE", 60 mm disc with a felt pad on a lever) | `offboard` | DYNO | Adds inertia and a step load (the disturbance). | — |
| bat | `battery-aa-pack` (4 × AA) | `offboard` | 6V PACK | | `bat`, `bat_sw` |
| c_vm | `capacitor-electrolytic` (100 µF) | `offboard` | BULK | | `c_vm` |

## Circuit

Identical to `encoders` (USB/Uno block, battery with `gnd_link`, two averaged half-bridges, GM-48 motor `m1`, encoder pull-ups `r_pa`/`r_pb`, open-drain `enc_sa`/`enc_sb`, wires `w_a`/`w_b` to pins 2/3).

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| (all of `encoders`) | — | — | — | — | **Power element** `usb_plug`; battery tweak `bat_sw` |
| `m1` | MOTOR | `ao1`, `ao2` | r 4, l 0.0005, ke 0.0054, kt 0.0054, j 3e-7, b 8e-7, load (set by `dyno-load`) | maxI 2 A | The flywheel's inertia, reflected through 48:1 (÷48² ≈ 2300), is negligible. J stays at about 3e-7 kg·m². |

**Plant numbers** (from the elements):
- R_total = 4 (winding) + 0.5 (bridge) + 0.6 (battery) = 5.1 Ω.
- τ_m = J·R_total / (kt·ke + R_total·b) = 3e-7 × 5.1 / (2.92e-5 + 4.1e-6) ≈ **46 ms**.
- No-load output speed at 6 V ≈ 193 rpm, so K ≈ 193/255 ≈ **0.76 rpm per PWM count**.

### Behaviors

- **`tb6612`**: see `tb6612fng`.
- **`quad-encoder`**: see `encoders` (CPR 2112 at the output).
- **`dyno-load`**. Parameters: `brakeNm` (output-shaft torque, tweak 0–0.15 N·m) and `stepAtS` (optional time for an automatic step disturbance). It sets `m1.load` = coulomb friction 0.0002 N·m + brakeNm / (48 × 0.7), using a gearbox efficiency of 0.7 (illustrative), always as a positive magnitude: the MOTOR element applies `load` against ω, faded in over ±1 rad/s, so no sign handling or stiction band is needed in the behavior. `stepAtS` counts from power-on. It publishes `brake_Nm`, `motor_load_Nm`, `rpm_out` and `out_power_W`.
- **`pid-tune`**. Params `kp` (1), `ki` (0), `kd` (0), `periodMs` (10), `antiWindup` (1); exposes them to the sketch as `Tune.*()` calls, read live, so sliders and failure overrides land at the next sample.
- **`mcu-supply`**, **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** 100 Hz PI(D) speed loop · **board:** `uno` · **vcc:** 5

| Pin | Use | PIN element |
|---|---|---|
| 2 / 3 | Encoder A / B (CHANGE) | `pin2`, `pin3` |
| 5 | PWMA | `pin5` |
| 7 / 8 | AIN1 / AIN2 | `pin7`, `pin8` |
| 4 | STBY | `pin4` |

```cpp
#define ENC_A 2
#define ENC_B 3
#define PWMA 5
#define AIN1 7
#define AIN2 8
#define STBY 4

const float CPR = 2112.0;        // counts per output revolution (x4)
const float DT = 0.01;           // 100 Hz loop
const float KP = 0.40;           // PWM counts per rpm of error
const float KI = 8.7;            // PWM counts per (rpm * s)
const float KD = 0.0;            // start with PI. D is optional on speed loops
const float U_MAX = 255.0;

// Corrected: A leads B going forward (00 -> 10 -> 11 -> 01 is +1), the quad-encoder behavior's convention.
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

float integral = 0;
float lastRpm = 0;
long lastCount = 0;
unsigned long nextTick = 0;
int printDiv = 0;

float setpointAt(unsigned long ms) {      // 8 s test profile, repeating
  unsigned long t = ms % 8000;
  if (t < 2000) { return 60.0; }
  if (t < 5000) { return 150.0; }
  if (t < 7000) { return -100.0; }
  return 0.0;
}

void setup() {
  pinMode(ENC_A, INPUT);
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
  long wait = nextTick - millis();
  if (wait > 0) {
    delay(wait);
  }
  nextTick += 10;

  noInterrupts();
  long c = count;
  interrupts();
  float rpm = (c - lastCount) / CPR * 60.0 / DT;   // measured output speed
  lastCount = c;

  float sp = setpointAt(millis());
  float err = sp - rpm;

  // Derivative on measurement (no kick when the setpoint steps).
  float dTerm = -KD * (rpm - lastRpm) / DT;
  lastRpm = rpm;

  // Conditional integration: only integrate when not pushing further into saturation.
  float uTry = KP * err + KI * (integral + err * DT) + dTerm;
  if ((uTry < U_MAX || err < 0) && (uTry > -U_MAX || err > 0)) {
    integral = integral + err * DT;
  }
  float u = KP * err + KI * integral + dTerm;
  drive(u);

  printDiv++;
  if (printDiv >= 5) {                    // 20 Hz to the plotter
    printDiv = 0;
    Serial.print("set:");
    Serial.print(sp);
    Serial.print(",rpm:");
    Serial.print(rpm);
    Serial.print(",pwm:");
    Serial.println(constrain(u, -U_MAX, U_MAX));
  }
}
```

## Readouts

| label | source | unit |
|---|---|---|
| SETPOINT | `{kind:'behavior', key:'serial.set'}` | rpm |
| MEASURED SPEED | `{kind:'behavior', key:'serial.rpm'}` | rpm |
| TRUE SPEED | `{kind:'behavior', key:'rpm_out_true'}` | rpm |
| CONTROL (PWM) | `{kind:'behavior', key:'serial.pwm'}` | '' |
| MOTOR CURRENT | `{kind:'current', elementId:'m1'}` | A |
| BRAKE TORQUE | `{kind:'behavior', key:'brake_Nm'}` | '' (N·m) |

SIM NOTE: plot set/rpm/pwm together on a strip chart. This lesson is unreadable as single numbers.

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Battery switch | `bat_sw` | closed | 0 | 1 | 1 | no | — |
| Brake torque (output) | `behavior:dyno-load` | brakeNm | 0 | 0.15 | 0.005 | no | N·m |
| Battery voltage | `bat` | value | 4 | 9 | 0.1 | no | V |
| Battery internal R | `bat` | rInternal | 0.1 | 3 | — | yes | Ω |

As built, the gains are sliders (`behavior:tune` kp 0–10, ki 0–60, kd 0–0.05), with a Loop period enum (5/10/20/50/100 ms) and an Anti-windup toggle; the sketch above reads constants for clarity, the lesson's sketch reads `Tune.*()` instead. Try Kp = 2.0 with Ki = 0: it is fast but leaves a steady error (≈ 62 rpm at 150) and rings. Try Kp 0.4, Ki = 40: it overshoots by about 20 % and rings. The brake tweak spans 0–0.15 N·m, but above about 0.04 N·m the 150 rpm step needs more than 255 counts and saturates.

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: setpoint steps of 60 → 150 → −100 → 0 rpm. Apply the brake and watch the integral recover. |
| PWM duty above 99 % | Control saturated: the motor cannot go faster. Anti-windup is holding the integrator. |

## Failures

### F1: Encoder A/B swapped (positive feedback)
- **Patch:** `{op:'set', elementId:'behavior:quad-encoder', key:'swapAB', value:true}`
- **Sim shows:** the measured speed is the negative of the true speed. The error *grows* as the motor speeds up, so the output slams to ±255 and the motor runs flat-out in the wrong sense. The loop never settles.
- **Why:** a sign error turns negative feedback into positive feedback. Before closing any loop, run it open-loop with a small positive command and confirm the measurement goes positive. Production firmware also adds a "speed far from setpoint for longer than X ms" fault trip.

### F2: Encoder pull-ups missing (lost feedback)
- **Patches:** `{op:'remove', elementId:'r_pa'}`, `{op:'remove', elementId:'r_pb'}`
- **Sim shows:** the measured speed is noise around 0. The controller sees a huge error, so the integrator (capped only by anti-windup) and the P term drive full PWM. The motor runs flat out (≈ 187 rpm) in the direction of the setpoint, whatever its size.
- **Why:** a feedback controller trusts its sensor completely. With no signal, it does whatever drives the measured error to zero, which is impossible. Detect it: if PWM is high and no counts arrive for 100 ms, stop and flag a sensor fault.

### F3: Tired battery (actuator saturation)
- **Patches:** `{op:'set', elementId:'bat', key:'value', value:4.6}`, `{op:'set', elementId:'bat', key:'rInternal', value:2.0}`
- **Sim shows:** the 150 rpm step can't be reached. PWM sits at 255 and the speed tops out around 136 rpm with no brake (ω = (kt·V/R − T_f)/(kt·ke/R + b), R = 6.5 Ω), and drops further under brake load. Without the anti-windup branch (the lesson's failure also switches it off), the integral winds to about 550 counts in 3 s, and on the −100 rpm step the motor stays at full forward and crosses zero about 0.2 s later than with the clamp.
- **Why:** no gain makes up for a missing volt. A controller can only use the authority the actuator has. Size the supply for the worst case (low battery, maximum load), and always guard the integrator.

## Meet the board

**The plant.** A DC motor obeys V = I·R + ke·ω and J·dω/dt = kt·I − b·ω − T_load. For a step in voltage it behaves like a first-order system, like an RC circuit or a mass with viscous damping, with time constant **τ_m = J·R/(kt·ke + R·b)** (≈ J·R/(kt·ke) = 52 ms if friction is ignored). For the GM-48 on this bench, 3e-7 × 5.1 / 3.33e-5 ≈ **46 ms**. The steady-state gain is about 193 rpm per 255 counts = **0.76 rpm/count** (measured incrementally on the bench; the gearbox friction takes the first ~7 counts).

**The controller (PI):** u = Kp·e + Ki·∫e dt. Choose the closed-loop time constant τ_c = 0.15 s (about 3 times slower than the plant: safe and smooth). Model-based tuning (internal model control, IMC) gives:
- Kp = τ/(K·τ_c) = 0.046/(0.76 × 0.15) ≈ **0.40**
- Ti = τ = 0.046 s, so Ki = Kp/Ti ≈ **8.7 per second**

**Sampling:** 100 Hz (dt = 10 ms) is about 5 samples per plant time constant, the minimum comfortable rate. Speed resolution per sample is 1/2112 rev / 0.01 s × 60 = **2.84 rpm**, so the measurement has a 2.8 rpm "staircase" that a large Kp amplifies into PWM chatter.

**D term:** on a speed loop, D differentiates a quantised, noisy signal. Leave it at 0, or filter it heavily.

**Anti-windup:** when the PWM is pinned at ±255, stop integrating. Otherwise the integral keeps growing and later causes overshoot.

## For mechanical engineers

> You already know this loop: it is a Watt governor, or cruise control. The P term is a spring: the further from setpoint, the harder it pushes. Alone, it leaves a steady droop under load, exactly like a proportional governor. The I term is a slowly winding preload that removes the droop. The D term is a damper on the *speed*, not the position. The motor itself is a mass with viscous damping (a first-order system), so PI is enough. **Where it breaks:** the actuator has hard limits (±255, the supply voltage), and the sensor is quantised and delayed. Linear control theory assumes neither, so windup, chatter and limit cycles appear that no Bode plot predicted.

## Pro tips

1. Identify the plant first. Run an open-loop step (for example PWM 0 → 150), log the speed, and read τ as the time to reach 63 % and K as Δrpm/ΔPWM. Tuning from measured K and τ beats guessing gains.
2. Run the loop at a fixed rate. Jitter in dt is noise in both the derivative and the speed estimate. Use a timer interrupt or a `millis()`-scheduled tick as here, and never `delay(10)` after a variable amount of work.
3. Log set, measured and control output together at 20–100 Hz. Saturation, quantisation and sign errors are obvious on a plot and nearly invisible in numbers.

## Quiz

1. **J = 3e-7 kg·m², R_total = 5.1 Ω, ke = kt = 0.0054. Ignoring friction, what is the mechanical time constant?**
   - 5 ms
   - 52 ms
   - 0.5 s
   - 5 s
   - **Answer:** 1. *Why:* τ = J·R/(kt·ke) = 3e-7 × 5.1 / 2.92e-5 ≈ 0.052 s.

2. **2112 counts per output revolution, a 10 ms window. What speed does one count represent?**
   - 0.28 rpm
   - 2.84 rpm
   - 28.4 rpm
   - 60 rpm
   - **Answer:** 1. *Why:* (1/2112) rev / 0.01 s × 60 s/min = 2.84 rpm.

3. **With plant gain K = 0.76 rpm/count, τ = 0.046 s and a desired τ_c = 0.15 s, what does IMC give for Kp?**
   - 0.04
   - 0.40
   - 4.0
   - 40
   - **Answer:** 1. *Why:* Kp = τ/(K·τ_c) = 0.046/(0.76 × 0.15) ≈ 0.40.

4. **Why stop integrating while the PWM is saturated?**
   - To save CPU time
   - The integral would keep growing without changing the output, then cause a large overshoot when the error reverses (windup)
   - The encoder stops counting at full speed
   - It makes the D term work
   - **Answer:** 1. *Why:* the actuator can't respond, so the integrator stores error it can't act on. Unwinding it later costs overshoot and delay.

## SIM NOTE

- Everything from `encoders` (edge injection at kHz rates) and `tb6612fng` (averaged bridge, ground-referenced inputs).
- **Strip-chart readout** of several `serial.*` keys over time, with a 10–20 s window. This is essential for control lessons.
- `dyno-load` sets `MOTOR.load` each tick as a magnitude; the MOTOR element already applies it against ω with a tanh band of ±1 rad/s, so it never overshoots zero speed.
- Float-to-int `constrain` result assigned to `int` (truncation), as in other lessons.
- Long sims (8 s profiles at 1 ms steps plus 7 000 encoder interrupts/s) are a performance check for the MCU scheduler.
