# Interrupts and Timers

*Never miss an edge*

> An Uno answers a pin change within a few microseconds, but `delay(1000)` leaves the loop blind for a million of them: interrupts let the hardware do the watching.

- **Lesson id:** `interrupts-timers` · **Track:** T4 Microcontrollers
- **fig:** 28. Provisional: sidebar order.
- **Prerequisites:** `arduino-uno`, T3 `flipflops-counters`
- **Power element:** `usb_plug` (powerLabel: "Plug USB")
- **Behaviors:** `tach-gen` (instance `tach`), `irq-bounce` (instance `bounce`), `timerone` (instance `t1`), `mcu-supply`, `serial-plotter`
- **transient:** true

## Learning goals

1. Explain polling versus interrupts, and when each is the right tool.
2. Attach external interrupts on pins 2 and 3 with `attachInterrupt(digitalPinToInterrupt(pin), isr, mode)` and choose RISING, FALLING or CHANGE.
3. Write a correct ISR: short, no `Serial` or `delay`, with shared variables `volatile` and read atomically.
4. Compute a hardware timer's period from the 16 MHz clock, the prescaler and the compare value, and use the TimerOne library for a periodic interrupt.
5. See contact bounce and fix it in hardware (RC) and in software (a time window).

## Board

Board: `IRQ BENCH`, size 12 × 6, base `mat`. Uno R3 on the left, breadboard on the right.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3, see `arduino-uno`) | `module` | UNO | ATmega328P at 16 MHz. INT0 is on pin 2 and INT1 on pin 3. | `pin2`, `pin3`, `pin13` |
| bb | `breadboard` | `offboard` | BREADBOARD | | — |
| btn | `button` (6 mm tactile) | `offboard` | BOUNCY BUTTON | Its metal dome chatters for a few ms on every press. | `sw_btn` |
| r_rc | `resistor` (1 kΩ) | `offboard` | RC 1k | Series part of the debounce filter. | `r_rc` |
| c_rc | `capacitor-ceramic` (1 µF) | `offboard` | RC 1µF | Smooths the chatter. τ_press = 1 kΩ × 1 µF = 1 ms; release τ ≈ 35 kΩ × 1 µF ≈ 35 ms through the internal pull-up. | `c_rc` |
| hall | `module` (title "HALL TACH", A3144-type open-collector sensor) | `offboard` | TACH | Pulls its output low each time a magnet passes: one pulse per revolution of a test wheel. | `tach_sw` |
| r_pull | `resistor` (10 kΩ) | `offboard` | PULL-UP | Gives the open-collector output a HIGH level. | `r_pull` |
| wheel | `dc-motor` (with magnet disc) | `offboard` | TEST WHEEL | Spins at the set speed to make tach pulses (behavior-driven). | — |
| led_l | (on Uno) | — | L | Toggled by the Timer1 interrupt. | `led_l` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_usb` | V | `usb_vbus`, `0` | 5.0 V, rInternal 0.3 Ω | — | |
| `usb_plug` | SW | `usb_vbus`, `vbus_in` | closed: false | — | **Power element** |
| `f1` | R | `vbus_in`, `5v` | 0.3 Ω | maxI 1.0 A | Polyfuse plus FDN340P, lumped |
| `i_board` | I | `5v`, `0` | 0.045 A | maxV 6 V | Uno logic |
| `pin2` | PIN | `d2`, `0` | pin 2, vcc 5 | — | INPUT_PULLUP (about 35 kΩ in the engine; datasheet 20–50 kΩ) |
| `r_rc` | R | `btn_n`, `d2` | 1 kΩ | — | |
| `c_rc` | C | `d2`, `0` | 1 µF | maxV 16 V | |
| `sw_btn` | SW | `btn_n`, `0` | closed: false | — | Toggled by `bounce` |
| `pin3` | PIN | `d3`, `0` | pin 3, vcc 5 | maxV 5.5 V | INPUT. 5.5 V = VCC + 0.5 V absolute max |
| `r_pull` | R | `5v`, `d3` | 10 kΩ | — | |
| `tach_sw` | SW | `d3`, `0` | closed: false | maxI 0.025 A | A3144-class open-collector output (toggled by `tach-gen`) |
| `pin13` | PIN | `d13`, `0` | pin 13, vcc 5 | — | |
| `u5a` | OPAMP | `d13`, `lbuf`, `lbuf` | vPos 5, vNeg 0 | — | Uno's LED buffer |
| `r_l` | R | `lbuf`, `l_a` | 1 kΩ | — | |
| `led_l` | LED | `l_a`, `0` | yellow | maxI 0.02 A | |

### Behaviors

- **`tach-gen`**. Parameter `hz` (default 50, range 0–20000).
  - It schedules falling edges at 1/hz intervals with µs timestamps and delivers them to the MCU's pin-3 interrupt queue directly, so frequencies above the 1 kHz sim step still work (SIM NOTE).
  - Each sim step it also sets `tach_sw.closed`, shown for 25 % of each period at rates below 200 Hz so the 3D LED and scope show it.
  - **Floating input:** if `r_pull` is missing, i.e. `d3` has no DC path (SIM NOTE: behaviors need netlist read access), it instead injects random edges at 0–300 Hz to imitate a floating, noise-coupled input.
  - It models ISR capacity. Each pin-3 ISR costs `isrUs` (default 5 µs: the ATmega328P datasheet gives a 4-cycle (0.25 µs) minimum interrupt response, then Arduino's dispatch wrapper and the user code; approximate). An edge less than `isrUs` after the last accepted one is dropped and counted, as the AVR's single interrupt flag would merge it into the pending request. The MCU's own clock does not charge the ISR time to `loop()`.
  - Publishes `tach.true_hz` and `tach.dropped`. Each period carries 1 % random jitter, because a real wheel is never exact and a polling loop on a fixed 1 ms beat would otherwise lock onto one phase of a 2 kHz pulse train.
- **`irq-bounce`** (instance `bounce`). On each button press or release (from the tweak `behavior:bounce.press`), it emits a burst of contact chatter over 0.5–5 ms, with random timing: a press is closed, then 1–5 open/closed pairs (2–6 closings at the contact); a release is open, then 0–3 closed/open pairs.
  - The RC filter is computed analytically: from the current values of `r_rc`/`c_rc` (or their absence), it decides which of those transitions cross the AVR input thresholds (VIL 0.3 VCC, VIH 0.6 VCC) and injects only those as pin-2 edges. With the capacitor the pin needs about 32 ms after release to climb back through VIH (and after `pinMode(2, INPUT_PULLUP)` at boot), so a sketch must let the pin settle in `setup()` before it starts debouncing.
  - Also drives `sw_btn.closed` for the visual.
  - Publishes `bounce_edges_last`.
- **`timerone`**. Exposes the library `Timer1` with `initialize(periodUs)` and `attachInterrupt(fn)`, `detachInterrupt()`, `stop()` and `start()`. It calls `fn` every `periodUs` of virtual time as an interrupt. Publishes `timer1_hz`.
- **`mcu-supply`**, **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** Counting edges · **board:** `uno` · **vcc:** 5

| Pin | Use | PIN element / node |
|---|---|---|
| 2 | Button (INT0, FALLING) | `pin2` |
| 3 | Hall tach (INT1, FALLING) | `pin3` |
| 13 | L LED, toggled by Timer1 | `pin13` |

```cpp
#include <TimerOne.h>

#define LOOP_DELAY 1      // try 300: polling misses presses, the ISR does not

volatile unsigned long tachCount = 0;
volatile unsigned long buttonEdges = 0;
volatile bool ledState = false;

unsigned long presses = 0;      // debounced, counted by polling
unsigned long polled = 0;       // tach pulses the loop happened to see
unsigned long lastPolled = 0;
unsigned long lastPrint = 0;
unsigned long lastTach = 0;
unsigned long lastChange = 0;
int lastRaw = HIGH;
int stable = HIGH;
int lastLevel = HIGH;

void onTach() {            // INT1: keep it to a few instructions
  tachCount++;
}

void onButton() {          // INT0: counts every edge, bounce included
  buttonEdges++;
}

void onTimer() {           // Timer1 compare: every 0.5 s
  ledState = !ledState;
  digitalWrite(13, ledState);
}

void setup() {
  pinMode(13, OUTPUT);
  pinMode(2, INPUT_PULLUP);
  pinMode(3, INPUT);       // external 10k pull-up
  Serial.begin(115200);
  attachInterrupt(digitalPinToInterrupt(3), onTach, FALLING);
  attachInterrupt(digitalPinToInterrupt(2), onButton, FALLING);
  Timer1.initialize(500000);        // 500 000 us = 0.5 s -> LED at 1 Hz
  Timer1.attachInterrupt(onTimer);  // note: TimerOne takes over PWM on 9/10
  delay(100);                       // the 1 uF fills through the pull-up (about 35 ms)
  lastRaw = digitalRead(2);         // start the debounce from the settled level
  stable = lastRaw;
}

void loop() {
  // Software debounce by polling: accept a level only after 20 ms of quiet.
  int raw = digitalRead(2);
  if (raw != lastRaw) {
    lastChange = millis();
    lastRaw = raw;
  }
  if (millis() - lastChange > 20 && raw != stable) {
    stable = raw;
    if (stable == LOW) {
      presses++;
    }
  }

  // Count the tach by polling too: a falling edge is HIGH then LOW.
  int level = digitalRead(3);
  if (level == LOW && lastLevel == HIGH) {
    polled++;
  }
  lastLevel = level;

  if (millis() - lastPrint >= 1000) {
    lastPrint += 1000;
    noInterrupts();                 // copy multi-byte volatiles atomically
    unsigned long t = tachCount;
    unsigned long e = buttonEdges;
    interrupts();
    unsigned long hz = t - lastTach;
    lastTach = t;
    Serial.print("tach_hz:");
    Serial.print(hz);
    Serial.print(",rpm:");
    Serial.print(hz * 60);
    Serial.print(",poll_hz:");
    Serial.print(polled - lastPolled);
    lastPolled = polled;
    Serial.print(",presses:");
    Serial.print(presses);
    Serial.print(",isr_edges:");
    Serial.println(e);
  }
  delay(LOOP_DELAY);
}
```

## Readouts

| label | source | unit |
|---|---|---|
| TACH (TRUE) | `{kind:'behavior', key:'tach.true_hz'}` | Hz |
| TACH (COUNTED) | `{kind:'behavior', key:'serial.tach_hz'}` | Hz |
| SHAFT SPEED | `{kind:'behavior', key:'serial.rpm'}` | rpm |
| TACH (POLLED) | `{kind:'behavior', key:'serial.poll_hz'}` | Hz |
| PRESSES (DEBOUNCED) | `{kind:'behavior', key:'serial.presses'}` | '' |
| ISR EDGES (PIN 2) | `{kind:'behavior', key:'serial.isr_edges'}` | '' |
| PIN 2 | `{kind:'voltage', node:'d2'}` | V |
| DROPPED EDGES | `{kind:'behavior', key:'tach.dropped'}` | '' |
| L LED | `{kind:'current', elementId:'led_l'}` | A |
| EXTRA EDGES | derived diff of ISR EDGES and PRESSES | '' |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Wheel speed | `behavior:tach` | hz | 1 | 20000 | — | yes | Hz |
| Debounce capacitor | `c_rc` | value | 1e-8 | 1e-5 | — | yes | F |
| Button | `behavior:bounce` | press (momentary) | 0 | 1 | 1 | no | — |

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: Timer1 toggles L every 0.5 s while the ISRs count pulses. |
| EXTRA EDGES above 0.5 | MISCOUNTING: the ISR saw more falling edges than debounced presses. |
| DROPPED EDGES above 0 | Edges are arriving faster than the ISR can finish: counts are being lost. |

## Failures

### F1: Remove the debounce capacitor
- **Patch:** `{op:'remove', elementId:'c_rc'}`
- **Sim shows:** one press now gives `isr_edges` +2…+6 (plus up to 3 more on release), while `presses` (the polled, 20 ms-debounced count) still goes up by 1. (The earlier draft said +3…+12: that counted every contact transition, but a FALLING interrupt only fires on the closings.)
- **Why:** a FALLING interrupt fires on every closing of the chattering contact. It is fast enough to see each one. The RC (τ = 1 ms on press) used to hide them. Either filter in hardware or ignore re-triggers inside a time window in software.

### F2: Leave out the tach pull-up
- **Patch:** `{op:'remove', elementId:'r_pull'}`
- **Sim shows:** with the wheel nearly stopped (the slider's minimum is 1 Hz), `tach_hz` still reads about 100 to 150 Hz of nonsense.
- **Why:** an open-collector (A3144-type) output can only pull low. Without a pull-up the pin floats and picks up mains hum and the switching noise of anything nearby. Every crossing of the threshold is an "edge". Inputs should never float.

### F3: Spin the wheel at 300 kHz
- **Patch:** `{op:'set', elementId:'behavior:tach-gen', key:'hz', value:300000}`
- **Sim shows:** `tach_hz` reads about 150 kHz (every second edge is accepted, since the edges are 3.3 µs apart and the ISR needs 5 µs) and `tach.dropped` climbs. The sim does not slow `loop()` down; on a real Uno near this rate nearly all CPU time goes into entering and leaving the ISR and `loop()` crawls.
- **Why:** each interrupt costs a few µs, so about 1/5 µs = 200 kHz is the ceiling here, before any loop code runs. For high-rate pulses, use a hardware counter. Timer1's T1 input on pin 5 can count external pulses with no CPU cost.

## Meet the board

Polling means `loop()` checks a pin whenever it gets around to it. With `delay(300)` in the loop, a press shorter than 300 ms can be missed completely. An **interrupt** is a hardware alarm: when pin 2 or 3 sees the chosen edge, the CPU stops what it is doing, saves its place and runs your ISR. On the Uno that takes a few µs, and the response does not depend on `delay()`.

**Rules for ISRs:** keep them tiny and avoid `Serial`, `delay()` and long maths. Mark the variables they share with the loop as `volatile`. Copy multi-byte values with interrupts briefly off, because the 8-bit AVR reads a 32-bit `unsigned long` in four pieces.

**Timers** are counters clocked from 16 MHz through a prescaler. Timer1 is 16-bit (INT0 and INT1 are PD2 and PD3 on the ATmega328P, which are Arduino pins 2 and 3). For a 2 Hz compare interrupt with prescaler 256: 16 000 000 / 256 = 62 500 ticks/s, so OCR1A = 62 500 / 2 − 1 = **31 249**. The longest Timer1 period is 65 536 × 1024 / 16 MHz = **4.19 s**. TimerOne does this arithmetic for you, but it takes over PWM on pins 9 and 10, and so does the Servo library.

**Bounce:** the button's contacts chatter for roughly 1–5 ms, sometimes longer. With 1 kΩ and 1 µF, the input needs about 1 ms to fall, which swallows the fast chatter.

## For mechanical engineers

> Polling is a technician walking the line every few minutes to read gauges. An interrupt is a pressure switch wired to an alarm bell: the moment it trips, someone drops what they are doing. Contact bounce is the bell rattling as the switch settles, like valve chatter. The RC filter is a damper (a snubber orifice) on the gauge line. **Where it breaks:** a real technician can handle two alarms at once. The AVR runs one ISR at a time, and interrupts that arrive meanwhile wait (or merge into one), so a long ISR delays or loses events.

## Pro tips

1. Increment a counter in the ISR and do the maths in `loop()`. If you think you need `Serial.print` inside an ISR, set a flag instead.
2. For speed measurement, choose the method by speed. At low rpm, time the interval between edges with `micros()` in the ISR (one reading per pulse). At high rpm, count edges over a fixed window. A 1-pulse-per-rev wheel at 60 rpm gives only 1 count per second.
3. Hall sensors with open-collector outputs usually run happily on 5 V. If they run on 12 V, keep the pull-up on the MCU's 5 V rail, not on 12 V. The sensor only ever pulls down.

## Quiz

1. **Timer1 with prescaler 1024 on a 16 MHz Uno. What is the longest period before it overflows?**
   - 4.1 ms
   - 65.5 ms
   - 1.05 s
   - 4.19 s
   - **Answer:** 3. *Why:* 65 536 counts × 1024 / 16 000 000 Hz = 4.19 s.

2. **A hall tach gives 2 pulses per revolution and you count 120 pulses in one second. What is the shaft speed?**
   - 60 rpm
   - 120 rpm
   - 3600 rpm
   - 7200 rpm
   - **Answer:** 2. *Why:* 120 / 2 = 60 rev/s, and 60 rev/s × 60 = 3600 rpm.

3. **Printing a 30-character line at 9600 baud takes about how long, and why does that matter inside an ISR?**
   - 3 µs: it doesn't matter
   - 0.3 ms: it barely matters
   - 31 ms: it blocks every other interrupt meanwhile
   - 3 s: Serial never works
   - **Answer:** 2. *Why:* each character is 10 bits (start, 8 data, stop), so 30 × 10 / 9600 ≈ 31 ms. During that time other interrupts wait, and Serial may even deadlock inside the ISR.

4. **Why must `tachCount` be declared `volatile`?**
   - It makes the variable faster
   - It stops the compiler caching it in a register, because the ISR can change it at any moment
   - It disables interrupts automatically
   - It makes 32-bit reads atomic
   - **Answer:** 1. *Why:* `volatile` forces a fresh memory read each time. It does **not** make multi-byte reads atomic; the `noInterrupts()` / `interrupts()` pair does that.

## SIM NOTE

- **MCU interrupt support (required):** `attachInterrupt`, `detachInterrupt`, `digitalPinToInterrupt`, the constants `RISING`/`FALLING`/`CHANGE`/`LOW`, and `noInterrupts()`/`interrupts()`.
  - ISRs must run **synchronously** between statements of the async `loop()` (they preempt at statement boundaries), and they must not be awaited.
  - The transpiler must allow a function name as a value (a callback argument) and accept the `volatile` qualifier.
- **Pin edge events:** behaviors must be able to inject timestamped edges (µs resolution) into the MCU's interrupt queue, independent of the 1 ms sim step. `digitalRead` inside an ISR should return the level at the edge time.
- **Behavior parameters as tweak/patch targets:** this lesson uses the convention `elementId:'behavior:<id>'`. Both the `Tweak` and the `FailurePatch` `set` op need it.
- Behaviors need read access to the current (patched) netlist, to see whether `r_pull`/`c_rc` exist and their values.
- `Readout.unit` has no `F` for the capacitor tweak's unit string (a Tweak's unit is a free string, so this is fine), and no count/edge unit (use `''`).
