# Quadrature Encoders

*Counting with direction*

> A magnetic encoder with 11 pulses per revolution on a 48:1 gear motor, decoded ×4, gives 2112 counts per output turn, or 0.17° per count.

- **Lesson id:** `encoders` · **Track:** T5 Motors & drivers
- **fig:** 33. Provisional: sidebar order.
- **Prerequisites:** `interrupts-timers`, `tb6612fng`
- **Power element:** `usb_plug` (powerLabel: "Plug USB"). The motor battery is the tweak `bat_sw`.
- **Behaviors:** `tb6612`, `quad-encoder` (instance `enc`), `mcu-supply`, `serial-plotter`
- **transient:** true

## Learning goals

1. Explain how two channels 90° apart (A and B) encode both position and direction.
2. Decode ×1, ×2 and ×4, and compute counts per revolution through a gearbox.
3. Write a table-driven ×4 decoder ISR that rejects invalid transitions.
4. Compute speed from counts per time window, and choose a window that trades resolution against lag.
5. Spot the common faults: missing pull-ups, swapped channels, and edge rates beyond what the ISR can keep up with.

## Board

Board: `ENCODER BENCH`, size 14 × 8, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | Decodes A/B on INT0/INT1 and drives the motor. | `pin2`, `pin3`, `pin4`, `pin5`, `pin7`, `pin8` |
| drv | `module` (TB6612FNG breakout, see `tb6612fng`) | `module` | DRIVER | Motor drive. | `ha`, `hb`, `ron_a`, `ron_b`, `en_a`, `en_b` |
| mot | `gear-motor-wheel` (GM-48 with a rear-shaft encoder) | `offboard` | GEAR MOTOR | 6 V, 48:1 gearbox. | `m1` |
| enc | `module` (title "HALL ENCODER", 6-pin: M+, M−, GND, VCC, A, B) | `offboard` | ENCODER | A magnet disc on the motor shaft with two hall sensors: 11 pulses per motor revolution per channel (representative; counts vary by model). | `enc_sa`, `enc_sb` |
| r_pa, r_pb | `resistor` (10 kΩ) | `offboard` | PULL-UPS | Hall outputs are open-drain on many encoder boards. Some boards include pull-ups; check yours. | `r_pa`, `r_pb` |
| bat | `battery-aa-pack` (4 × AA) | `offboard` | 6V PACK | Motor supply. | `bat`, `bat_sw` |

## Circuit

The motor and driver are as in `tb6612fng` (two averaged half-bridges, GM-48 motor). The encoder adds:

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_usb`, `usb_plug`, `f1`, `i_board` | — | — | as `tb6612fng` | — | **Power element** `usb_plug` |
| `pin4`, `pin5`, `pin7`, `pin8` | PIN | — | STBY, PWMA, AIN1, AIN2 | — | as `tb6612fng` |
| `bat`, `bat_sw`, `gnd_link`, `c_vm`, `i_vm` | — | — | as `tb6612fng` | — | |
| `ha`, `ron_a`, `en_a`, `hb`, `ron_b`, `en_b`, body diodes | — | — | as `tb6612fng` | — | |
| `m1` | MOTOR | `ao1`, `ao2` | r 4, l 0.0005, ke 0.0054, j 3e-7, b 8e-7 | maxI 2 A | GM-48 |
| `i_enc` | I | `5v`, `0` | 0.008 A | maxV 6 V | Two hall sensors, a few mA each (approximate) |
| `r_pa` | R | `5v`, `enc_a` | 10 kΩ | — | |
| `r_pb` | R | `5v`, `enc_b` | 10 kΩ | — | |
| `enc_sa` | SW | `enc_a`, `0` | set by behavior | maxI 0.02 A | Channel A open-drain output |
| `enc_sb` | SW | `enc_b`, `0` | set by behavior | maxI 0.02 A | Channel B |
| `w_a` | R | `enc_a`, `d2` | 0.01 Ω | — | Wire to pin 2 |
| `w_b` | R | `enc_b`, `d3` | 0.01 Ω | — | Wire to pin 3 |
| `pin2` | PIN | `d2`, `0` | pin 2, vcc 5 | — | INT0 |
| `pin3` | PIN | `d3`, `0` | pin 3, vcc 5 | — | INT1 |

### Behaviors

- **`tb6612`**: see `tb6612fng`.
- **`quad-encoder`** (reused in `pid-motor-control` and the capstone). Parameters: `ppr` 11 (per channel per motor revolution), `gear` 48, `a` 2, `b` 3 (the MCU pins), `swapAB` false, `isrUs` 12 µs (ISR cost: two `digitalRead` calls at about 4 µs each plus entry and exit on an Uno; approximate), `glitchRate` 0 per second.
  - **Shaft angle:** each tick it integrates the motor shaft angle from `extra['m1.omega']`.
  - **Edges:** it generates the A/B levels as two square waves with 50 % duty, offset by 90° electrical (A leads B for positive ω, unless `swapAB`; forward state order 00 → 10 → 11 → 01), and emits each **edge** with a µs timestamp into the MCU's interrupt queue with `mcu.injectEdge` (SIM NOTE). At every solve it sets `enc_sa/enc_sb.closed` (closed = pin LOW) to the level at that instant, for the scope and LED visuals.
  - **Signal validity:** for each channel the edge is delivered only if the pin net actually reaches a valid HIGH (a pull-up present, V > 0.6 × VCC with the switch open). Without the pull-up the pin floats, so it injects random edges at about 200 Hz (as in `interrupts-timers` F2). A single floating line only steps the count up and down; with both floating the noise on A and B interleaves and the count random-walks.
  - **ISR capacity:** if two edges arrive closer than `isrUs`, the second is merged with the first (both level changes land at one instant) and the decoder sees an invalid (double) transition.
  - **Glitches:** `glitchRate` per second injects common-mode spikes (motor noise coupled into both wires): A and B both flip for `glitchUs` (20 µs) and flip back. A table decoder flags two invalid jumps per spike. A single-channel glitch would be harmless to a table decoder (it steps +1 then −1), which is the point of quadrature.
  - **Publishes:** `count_true` (ideal ×4 count at the motor shaft, signed, since the sketch started), `count_sync` (the same at the instant the sketch last printed), `rev_out_true`, `deg_out_true`, `rpm_true`, `rpm_out_true` (from ω / 48), `cpr_out`, `edge_rate` (edges/s), `edges_lost`, `glitches`, `noise_edges`, `floating`.
- **`mcu-supply`**, **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** ×4 decoder and speed · **board:** `uno` · **vcc:** 5

| Pin | Use | PIN element |
|---|---|---|
| 2 | Encoder A (INT0, CHANGE) | `pin2` |
| 3 | Encoder B (INT1, CHANGE) | `pin3` |
| 5 / 7 / 8 / 4 | PWMA / AIN1 / AIN2 / STBY | `pin5`, `pin7`, `pin8`, `pin4` |

```cpp
#define ENC_A 2
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
```

## Readouts

| label | source | unit |
|---|---|---|
| SPEED (TRUE) | `{kind:'behavior', key:'rpm_out_true'}` | rpm |
| SPEED (MEASURED) | `{kind:'behavior', key:'serial.rpm'}` | rpm |
| POSITION | `{kind:'behavior', key:'serial.deg'}` | ° |
| EDGE RATE | `{kind:'behavior', key:'edge_rate'}` | Hz |
| INVALID TRANSITIONS | `{kind:'behavior', key:'serial.invalid'}` | '' |
| COUNT (TRUE) / (SKETCH) / LOST | `enc.count_sync`, `serial.x4`, derived diff | counts |
| POSITION (TRUE) | `enc.deg_out_true` | ° |
| SIGN CHECK | derived product of true and measured speed (negative = opposite signs) | '' |
| ENC A PIN | `{kind:'voltage', node:'d2'}` | V |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Battery switch | `bat_sw` | closed | 0 | 1 | toggle | no | — |
| Motor supply | `bat` | value | 3 | 12 | 0.1 | no | V |
| ISR cost | `behavior:enc` | isrUs | 4 | 500 | — | yes | µs |
| Glitch rate | `behavior:enc` | glitchRate | 0 | 200 | 1 | no | /s |
| Swap A and B | `behavior:enc` | swapAB | 0 | 1 | toggle | no | — |

The earlier draft had a pull-up value slider. It was dropped: the sim models a pull-up as present or absent, so the slider changed nothing visible.

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: the drive sweeps ±200. Watch the sign of the speed follow the direction. |
| readout 4 above 0 | Invalid transitions: edges are arriving too fast or too noisy for the ISR. |

## Failures

### F1: Missing pull-ups
- **Patches:** `{op:'remove', elementId:'r_pa'}`, `{op:'remove', elementId:'r_pb'}`
- **Sim shows:** POSITION no longer follows the shaft: the floating inputs deliver noise edges at about 200 Hz, so the count random-walks and the measured speed is noise. Invalid transitions stay near zero, because the two lines rarely change at the same instant (a single floating line only steps the count up and down).
- **Why:** open-drain hall outputs can only pull low. Floating inputs pick up switching noise from the motor driver right next to them. Fit 4.7–10 kΩ pull-ups, or use `INPUT_PULLUP` for short cables only (20–50 kΩ is weak against noise).

### F2: A and B swapped
- **Patch:** `{op:'set', elementId:'behavior:quad-encoder', key:'swapAB', value:true}`
- **Sim shows:** the speed reads negative while the wheel turns forward. In this open-loop sketch nothing else happens, but in the next lesson's PID loop this is **positive feedback**, and the motor runs away at full speed.
- **Why:** direction comes only from which channel leads. Check the sign once, when you wire it, with a slow hand turn, before closing any loop.

### F3: Overdrive it on 12 V with noisy wiring
- **Patches:** `{op:'set', elementId:'bat', key:'value', value:12}`, `{op:'set', elementId:'behavior:quad-encoder', key:'glitchRate', value:150}`
- **Sim shows:** at the sketch's 200/255 duty on 12 V the motor shaft runs at about 14 500 rpm, so the edge rate is 11 × 4 × 14 500 / 60 ≈ 10 600 edges/s, about 94 µs apart (at full duty it would be about 20 000 rpm, 15 000 edges/s and 67 µs). That is still within the 12 µs ISR's capacity, but each common-mode glitch gives two invalid transitions, and a real edge inside one can be mis-stepped: in the simulation about 3 500 invalid transitions and 26 lost counts (4°) in 12 s.
- **Why:** an encoder is only as good as its edges. Use twisted or shielded encoder cables away from the motor leads, add small RC filters (for example 100 Ω and 1 nF, τ = 0.1 µs, which leaves real edges intact), or use a hardware quadrature decoder. Also: 12 V on a 6 V motor is a lifetime and heat problem of its own.

## Meet the board

Two hall sensors sit 90° apart (electrically) around a magnet disc, so A and B are square waves in **quadrature**. Turning forward, the state sequence (A, B) is 00 → 10 → 11 → 01: A leads B. Backward, it runs the other way. Each change is one count, and the direction is whichever way the sequence goes.

**Counting modes:** ×1 counts rising edges of A only, ×2 counts both edges of A, and ×4 counts every edge of both. With 11 pulses per revolution at the motor and a 48:1 gearbox, ×4 gives 11 × 4 × 48 = **2112 counts per output revolution**, or 360 / 2112 = **0.17°** per count.

**Speed:** counts in a window divided by the window length. At 100 rpm on the output, 100 / 60 × 2112 = 3520 counts/s, so a 50 ms window catches 176 counts, a resolution of 100 / 176 ≈ 0.57 rpm. A shorter window reacts faster but is coarser: at 10 ms, one count is **2.8 rpm**.

**ISR load:** that 3520 counts/s is 3520 interrupts/s. At about 12 µs each (two `digitalRead` calls at about 4 µs each, plus entry and exit) that is about 4 % of the CPU. At the motor's full speed (~190 rpm out, about 6700 edges/s) it is about 8 %. That is fine on an Uno, but at much higher rates you'd use direct port reads (about 10 times faster than `digitalRead`) or a chip with a hardware decoder (the ESP32's PCNT, or STM32 timers).

**The table decoder** rejects "both bits changed" as invalid instead of guessing.

## For mechanical engineers

> An incremental encoder is a dial indicator that counts revolutions of a fine-pitch screw but never reads the absolute position. Two pickups a quarter-pitch apart tell you which way the spindle turned, like the two tracks on a machine tool's glass scale. ×4 decoding uses every line edge as a graduation. **Where it breaks:** if power drops or an edge is missed there is no absolute reference. Like a dial indicator that's been bumped, it must be re-zeroed against a home switch or index pulse before the count means position again.

## Pro tips

1. Put the encoder on the **motor** shaft, before the gearbox, when you want resolution. The gear ratio multiplies your counts. Put it on the **output** when you need to see the backlash.
2. Measure speed by counting at high speed and by timing between edges (`micros()` in the ISR) at low speed. Production motor controllers switch between the two around a few hundred counts per second.
3. Read multi-byte counts with interrupts briefly disabled (as in the sketch). A torn read of a 32-bit `long` on an 8-bit AVR produces rare, huge, unexplained jumps.

## Quiz

1. **11 PPR on the motor shaft, ×4 decoding, 48:1 gearbox. How many counts per output revolution?**
   - 44
   - 528
   - 2112
   - 8448
   - **Answer:** 2. *Why:* 11 × 4 × 48 = 2112.

2. **You count 1760 counts in 0.5 s on that system. What is the output speed?**
   - 50 rpm
   - 100 rpm
   - 176 rpm
   - 3520 rpm
   - **Answer:** 1. *Why:* 1760 / 2112 = 0.833 rev in 0.5 s = 1.667 rev/s = 100 rpm.

3. **With a 10 ms speed window and 2112 counts/rev, what is the speed resolution (one count)?**
   - 0.17 rpm
   - 0.57 rpm
   - 2.84 rpm
   - 28.4 rpm
   - **Answer:** 2. *Why:* 1 count / 2112 rev × (60 000 ms/min ÷ 10 ms) = 2.84 rpm.

4. **The sequence 00 → 11 appears between two samples. What does a good decoder do?**
   - Counts +2
   - Counts −2
   - Counts 0 and flags an invalid transition (an edge was missed)
   - Resets the count
   - **Answer:** 2. *Why:* both bits changing at once means a state was skipped, and its direction is unknowable. Counting it as an error keeps the count honest.

## SIM NOTE

- **Edge injection at kHz rates** (the same requirement as `interrupts-timers` and `a4988-stepper`): `quad-encoder` emits timestamped edges, and `digitalRead` inside the ISR must return the level *at that edge time*, not the level at the end of the 1 ms step.
- The `SW` elements for A/B update at most once per sim step, so voltage readouts on `d2/d3` show only a sampled level. The decoder logic must use the edge queue.
- The transpiler must support bit operators `<<` and `|` on ints and `const int` arrays used as lookup tables. Both are plausible within the subset, but test them.
- Pull-up presence and validity: the behavior needs netlist read access (as in `interrupts-timers`).
