# Arduino Uno R3

*The 5-volt workhorse*

> One 16 MHz ATmega328P with 14 digital pins, 6 of them PWM, and a 20 mA budget per pin: the board the rest of this course plugs into.

- **Lesson id:** `arduino-uno` · **Track:** T4 Microcontrollers
- **fig:** 1 (pinned "Start here"; video Fig. 01). Provisional, because the registry assigns figs in sidebar order.
- **Prerequisites:** none. This is the entry lesson, and it links forward to T0 for Ohm's law and T2 `led-resistor`.
- **Power element:** `usb_plug` (powerLabel: "Plug USB")
- **Behaviors:** `mcu-supply`, `serial-plotter`
- **transient:** true (bulk capacitor; PWM)

## Learning goals

1. Name the main parts of an Uno R3 and say what each one does: the MCU, the USB-serial bridge, the regulators, the clock, the polyfuse and the headers.
2. Use `pinMode`, `digitalWrite`, `digitalRead`, `analogRead` and `analogWrite`, and say which pins can do PWM (3, 5, 6, 9, 10, 11) and at what frequency (about 490 Hz, or about 980 Hz on pins 5 and 6).
3. Convert between an `analogRead` count and volts (10-bit, 5 V reference) and between an `analogWrite` value and average voltage.
4. Respect the pin limits: 20 mA recommended, 40 mA absolute maximum per pin, 200 mA through the VCC/GND pins in total.
5. Know that pins 2 and 3 are the external interrupts INT0 and INT1, and that `Serial` runs over USB through a second chip.

## Board

Board: `UNO R3 · ATELIER`, size 7 × 5.3 (68.6 × 53.4 mm), base `mat`. Off-board parts sit on a half-size breadboard to the right.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| u1 | `ic-dip` (28-pin, socketed ATmega328P-PU) | `tht` | MCU | The brain: 8-bit AVR, 32 KB flash (0.5 KB used by the bootloader), 2 KB SRAM, 1 KB EEPROM, runs your sketch at 16 MHz. | `pin2`, `pin9`, `pin13` |
| u2 | `ic-smd` (QFN-32, ATmega16U2) | `smd` | USB-SERIAL | Turns USB into the UART on pins 0/1 so `Serial` and uploads work. | — |
| y1 | `crystal` (16 MHz, HC-49 style) | `tht` | 16U2 CLOCK | Clock for the USB chip. USB needs a crystal-grade frequency. | — |
| y2 | `crystal` (16 MHz ceramic resonator, SMD) | `smd` | MCU CLOCK | Clock for the 328P. A resonator is cheaper than a crystal and less accurate, at about ±0.5 % (approximate). | — |
| j1 | `usb-b` | `tht` | USB | Power (5 V) plus data from the computer. | `v_usb`, `usb_plug` |
| j2 | `barrel-jack` | `tht` | DC 7–12 V | External supply into the 5 V regulator. Recommended 7–12 V. | — |
| u3 | `ic-smd` (SOT-223, NCP1117ST50T3G) | `smd` | 5V REG | Linear regulator making 5 V from the barrel jack or VIN. | — |
| u4 | `ic-smd` (SOT-23-5, LP2985-33) | `smd` | 3V3 REG | Makes the 3.3 V pin. Arduino rates that pin at 50 mA. | — |
| u5 | `ic-smd` (SOIC-8 / MSOP-8, LMV358) | `smd` | OP-AMP | One half buffers pin 13 to the L LED. The other half selects USB or VIN power. | `u5a` |
| q1 | `ic-smd` (SOT-23, FDN340P P-MOSFET) | `smd` | USB SWITCH | Disconnects USB 5 V when VIN power is present. | `q1_on` |
| f1 | `fuse` (SMD polyfuse, 500 mA hold) | `smd` | POLYFUSE | Resettable fuse protecting your computer's USB port. | `f1` |
| d1 | `diode` (SMD M7 = 1N4007 class) | `smd` | REV-POL | Blocks a reversed barrel-jack supply. | — |
| c1, c2 | `capacitor-electrolytic` (47 µF SMD can) | `smd` | BULK | Reservoirs on the 5 V and VIN rails. | `c_5v` |
| c3–c8 | `capacitor-smd` (100 nF) | `smd` | DECOUPLE | One next to each IC supply pin to supply fast current spikes. | — |
| r1 | `resistor-smd` (1 kΩ ×4 array) | `smd` | LED RES | Current limits for the ON, L, TX and RX LEDs. | `r_l`, `r_on` |
| led_on | `led-smd` (green) | `smd` | ON | Power indicator. | `led_on` |
| led_l | `led-smd` (yellow) | `smd` | L | The "pin 13" LED, driven through the op-amp buffer. | `led_l` |
| led_tx, led_rx | `led-smd` (yellow) | `smd` | TX / RX | Blink when the 16U2 moves serial data. | — |
| sw_rst | `button` (SMD tactile) | `smd` | RESET | Pulls RESET low and restarts the sketch. | — |
| h_dig_hi, h_dig_lo | `header-female` (10-pin, 8-pin) | `tht` | DIGITAL | D0–D13, GND, AREF, SDA, SCL. A `~` marks PWM pins. | — |
| h_pwr | `header-female` (8-pin) | `tht` | POWER | IOREF, RESET, 3V3, 5V, GND, GND, VIN. | — |
| h_ana | `header-female` (6-pin) | `tht` | ANALOG | A0–A5. A4/A5 double as I²C SDA/SCL. | — |
| icsp1, icsp2 | `header-male` (2×3) | `tht` | ICSP | In-circuit programming headers for the 328P and the 16U2. | — |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the external parts. | — |
| r_ext | `resistor` (220 Ω, 1/4 W) | `offboard` | 220 Ω | Limits the external LED to about 13 mA. | `r_ext` |
| led_ext | `led` (5 mm red) | `offboard` | FADE LED | Brightness follows the PWM duty on pin 9. | `led_ext` |
| btn | `button` (6 mm tactile) | `offboard` | BUTTON | Pulls pin 2 to GND when pressed. | `sw_btn` |
| pot | `potentiometer` (10 kΩ linear) | `offboard` | POT | A 0–5 V voltage divider into A0. | `pot_top`, `pot_bot` |
| wires | `wire` | `offboard` | — | Jumpers. | — |

## Circuit

The board is modelled from the USB 5 V rail down. The 3.3 V regulator and the VIN path are shown on the 3D board only; they are not in this netlist.

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_usb` | V | `usb_vbus`, `0` | 5.0 V, rInternal 0.3 Ω | — | Host port plus cable, lumped (approximate) |
| `usb_plug` | SW | `usb_vbus`, `vbus_in` | closed: false | — | **Power element** |
| `f1` | R | `vbus_in`, `vbus_f` | 0.2 Ω | maxI 1.0 A, failMode open | Polyfuse: 0.5 A hold, about 1 A trip (SIM NOTE: resettable) |
| `q1_on` | R | `vbus_f`, `5v` | 0.1 Ω | — | FDN340P switched on (Rds(on) is roughly 0.07–0.1 Ω) |
| `c_5v` | C | `5v`, `0` | 47 µF | maxV 16 V | |
| `i_board` | I | `5v`, `0` | 0.045 A | maxV 6.0 V | 328P + 16U2 + LEDs, roughly 45 mA (approximate). 6.0 V is the 328P absolute maximum. |
| `r_on` | R | `5v`, `on_a` | 1 kΩ | maxP 0.063 W | |
| `led_on` | LED | `on_a`, `0` | green | maxI 0.02 A | ≈ 2.9 mA |
| `pin13` | PIN | `d13`, `0` | pin 13, vcc 5 | engine: 40 mA abs max | |
| `u5a` | OPAMP | `d13`, `lbuf`, `lbuf` | vPos 5, vNeg 0 | — | Unity-gain buffer (in+, in−, out) |
| `r_l` | R | `lbuf`, `l_a` | 1 kΩ | — | |
| `led_l` | LED | `l_a`, `0` | yellow | maxI 0.02 A | ≈ 3 mA |
| `pin9` | PIN | `d9`, `0` | pin 9, vcc 5 | — | PWM (Timer1, ~490 Hz) |
| `r_ext` | R | `d9`, `ext_a` | 220 Ω | maxP 0.25 W | |
| `led_ext` | LED | `ext_a`, `0` | red | maxI 0.03 A, maxV 5 V | (5 − 1.8)/(220 + 25) ≈ 13 mA at full duty |
| `pin2` | PIN | `d2`, `0` | pin 2, vcc 5 | — | INPUT_PULLUP set by the sketch |
| `sw_btn` | SW | `d2`, `0` | closed: false | — | Pushbutton (SIM NOTE: momentary click) |
| `pot_top` | R | `5v`, `a0` | 5 kΩ | — | 10 kΩ pot, upper part |
| `pot_bot` | R | `a0`, `0` | 5 kΩ | — | lower part, wiper at `a0` |

Expected at power-up: 5 V rail ≈ 4.96 V (about 65 mA × 0.6 Ω of lumped drop), A0 = 2.49 V, so `analogRead` ≈ 510.

### Behaviors

- **`mcu-supply`** (shared; T5 and T7 reuse it). Each tick it reads `nodeV['5v']` (configurable as `supplyNode`) and the MCU's rated speed and voltage.
  - Below 2.7 V (the Uno's brown-out fuse setting), it holds the virtual MCU in reset.
  - Between 2.7 V and 3.78 V it publishes `mcu_warn = 1`, because the ATmega328P speed grade allows 16 MHz only above about 3.78 V (interpolated between 10 MHz at 2.7 V and 20 MHz at 4.5 V).
  - It publishes `vcc` and `resets` (a count of resets).
  - It needs a hook to stop and restart the MCU (SIM NOTE).
- **`serial-plotter`** (shared). It parses `Serial` lines in Arduino Serial Plotter form (`name:value,name2:value`) and publishes each as `serial.<name>`, so readouts can show values the sketch computes.

## Sketch

**Title:** Uno tour · **board:** `uno` · **vcc:** 5

| Pin | Use | PIN element / node |
|---|---|---|
| 13 | L LED heartbeat | `pin13` |
| 9 | PWM fade LED | `pin9` |
| 2 | Button, INPUT_PULLUP | `pin2` |
| A0 | Potentiometer | analogPins `A0 → a0` |

```cpp
// Uno tour: a heartbeat on L, pot-controlled PWM on pin 9,
// and the button reported over Serial.
const int LED_L    = 13;
const int LED_FADE = 9;     // a ~ pin: PWM at about 490 Hz
const int BUTTON   = 2;     // also INT0, used in the next lesson
const int POT      = A0;

unsigned long lastBeat = 0;
bool beatOn = false;
int lastButton = HIGH;

void setup() {
  pinMode(LED_L, OUTPUT);
  pinMode(LED_FADE, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);   // internal 20-50 kOhm pull-up
  Serial.begin(9600);
  Serial.println("Uno tour ready");
}

void loop() {
  unsigned long now = millis();

  // Heartbeat without delay(): check the clock, act, move on.
  if (now - lastBeat >= 500) {
    lastBeat = now;
    beatOn = !beatOn;
    if (beatOn) {
      digitalWrite(LED_L, HIGH);
    } else {
      digitalWrite(LED_L, LOW);
    }
  }

  // 10-bit ADC in, 8-bit PWM out.
  int raw = analogRead(POT);              // 0..1023
  int duty = map(raw, 0, 1023, 0, 255);   // 0..255
  analogWrite(LED_FADE, duty);

  // Report each new press (pressed = LOW because of the pull-up).
  int b = digitalRead(BUTTON);
  if (b == LOW && lastButton == HIGH) {
    float volts = raw * 5.0 / 1023.0;
    Serial.print("press raw:");
    Serial.print(raw);
    Serial.print(",volts:");
    Serial.println(volts);
  }
  lastButton = b;

  delay(10);
}
```

## Readouts

| label | source | unit |
|---|---|---|
| 5V RAIL | `{kind:'voltage', node:'5v'}` | V |
| USB CURRENT | `{kind:'current', elementId:'f1'}` | A |
| PIN 9 AVG | `{kind:'voltage', node:'d9'}` | V |
| FADE LED | `{kind:'current', elementId:'led_ext'}` | A |
| A0 | `{kind:'voltage', node:'a0'}` | V |
| L LED | `{kind:'current', elementId:'led_l'}` | A |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Pot position (lower leg) | `pot_bot` | value | 10 | 9990 | 10 | no | Ω |
| Button | `sw_btn` | closed | 0 | 1 | 1 | no | — |
| Fade resistor | `r_ext` | value | 47 | 2200 | — | yes | Ω |

SIM NOTE: the pot needs a linked tweak, with `pot_top = 10 kΩ − pot_bot`.

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: L blinks at 1 Hz, and the pot sets the brightness on pin 9. |
| pin 2 level 0 | Button down: pin 2 reads LOW through the pull-up. |
| readout 0 below 4.5 | 5 V rail is sagging: something is drawing too much current. |

## Failures

### F1: Drive a motor straight off pin 9
- **Patch:** `{op:'add', element:{id:'m_direct', type:'MOTOR', nodes:['d9','0'], r:4, l:0.0005, ke:0.0054, j:3e-7, b:8e-7}}`, `{op:'remove', elementId:'r_ext'}`
- **Sim shows:** at full duty the pin tries to source 5 V / (25 Ω + 4 Ω) ≈ 170 mA. That is past the 40 mA absolute maximum, so after 300 ms `pin9` is marked dead and the motor barely twitches.
- **Why:** a GPIO pin is a signal, not a power output. A small gear motor needs 150 mA running and more than 1 A to start. Switch it with a transistor (T2 `transistor-switch`) or a driver IC (T5).

### F2: Bypass the 220 Ω resistor
- **Patch:** `{op:'short', a:'d9', b:'ext_a'}`
- **Sim shows:** only the pin's ~25 Ω output resistance limits the LED, so about 100 mA flows. The LED (30 mA) and the pin (40 mA) both burn.
- **Why:** an LED has almost no resistance once it conducts. On real silicon the output transistor heats up and its resistance rises, but it is still far out of spec and the damage builds up.

### F3: Short 5 V to GND on the header
- **Patch:** `{op:'short', a:'5v', b:'0'}`
- **Sim shows:** current through `f1` jumps to 5 V / 0.6 Ω ≈ 8 A in the model, and after 300 ms the polyfuse opens. The rail drops to 0 V and the MCU resets.
- **Why:** this is the polyfuse's job. A real PTC heats up and its resistance rises within milliseconds to seconds. It resets once it cools, which the engine does not yet model. Many host ports also current-limit.

### F4: Feed 12 V into the 5 V pin
- **Patch:** `{op:'add', element:{id:'bench12', type:'V', nodes:['5v','0'], value:12, rInternal:0.05}}`
- **Sim shows:** `i_board` sees 12 V, above the 328P's 6.0 V absolute maximum, and fails at once. The board is burnt.
- **Why:** the 5 V pin bypasses the regulator. Use the barrel jack or VIN for 7–12 V, so that the NCP1117 drops the voltage to 5 V.

## Meet the board

The Uno R3 is a carrier for one chip, the **ATmega328P**. It runs at 16 MHz, so one clock cycle takes 62.5 ns. Most AVR instructions take one or two cycles.

**Digital pins.** Each pin is a push-pull switch to 5 V or 0 V. Keep each one to **20 mA** or less (40 mA is the absolute maximum) and the whole chip to under 200 mA. For a red LED: R = (5 − 1.8) V / 13 mA ≈ 246 Ω, so 220 Ω is the nearest common value.

**Analog in.** The ADC is 10-bit, so 5 V is split into 1024 steps of 4.9 mV each. A reading of 614 means 614 × 5 / 1023 ≈ **3.0 V**. Each conversion takes about 104 µs.

**PWM out.** `analogWrite(9, 64)` switches the pin fully on 25 % of the time, at about 490 Hz (about 980 Hz on pins 5 and 6). The average is 64/255 × 5 ≈ **1.25 V**. The pin itself is still digital. Only the average is "analog".

**Interrupts.** Pins 2 and 3 can run a function the moment they change, instead of waiting for `loop()` to look at them. That is the next lesson.

**Serial.** The second chip, an ATmega16U2, bridges USB to pins 0/1. At 9600 baud, one character takes about 1 ms.

**Power.** USB 5 V comes in through a 500 mA polyfuse. Alternatively, 7–12 V on the barrel jack goes through the NCP1117 regulator. Never put more than 5.5 V on the 5 V pin.

## For mechanical engineers

> The Uno is a PLC shrunk onto 53 × 69 mm. The sketch is the ladder program and the pins are its I/O terminals, with `loop()` as the scan cycle. A digital output is like a pilot valve: it can steer a big actuator, but it cannot flow enough to be the actuator. You always put a power stage (relay, transistor, driver) in between. **Where it breaks:** a PLC output card is built to survive shorts and inductive loads. A bare AVR pin has no current limit, no flyback protection and a 40 mA absolute maximum, so you supply all the protection yourself.

## Pro tips

1. Plan your pin current budget in a table before wiring: LEDs, pull-ups and every module's logic current. The 200 mA total for the chip is easy to exceed with a row of LEDs.
2. Avoid `delay()` in anything bigger than Blink. The `millis()` pattern in this sketch lets one loop run a heartbeat, read sensors and talk serial "at the same time".
3. `int` on the Uno is 16 bits (−32768…32767). `1000 * 60` overflows, and `millis()` needs `unsigned long`. Mixing them is the most common source of "works for a minute, then goes crazy" bugs.

## Quiz

1. **`analogWrite(9, 64)` with a 5 V supply. What does a DMM on pin 9 read?**
   - 0.64 V
   - 1.25 V
   - 2.5 V
   - 5 V flickering
   - **Answer:** 1. *Why:* the DMM averages the PWM: 64/255 × 5 V ≈ 1.25 V.

2. **You want 10 mA through a red LED (Vf ≈ 1.8 V) from a 5 V pin. Which standard resistor is closest?**
   - 180 Ω
   - 330 Ω
   - 1 kΩ
   - 3.3 kΩ
   - **Answer:** 1. *Why:* R = (5 − 1.8)/0.010 = 320 Ω, so 330 Ω (about 9.7 mA) is the nearest E12 value.

3. **`analogRead(A0)` returns 614. What is the voltage on A0?**
   - 1.2 V
   - 2.5 V
   - 3.0 V
   - 6.1 V
   - **Answer:** 2. *Why:* V = 614 × 5 / 1023 ≈ 3.0 V.

4. **Which Uno pins are the external interrupts INT0 and INT1?**
   - 0 and 1
   - 2 and 3
   - 9 and 10
   - A4 and A5
   - **Answer:** 1. *Why:* on the ATmega328P, INT0 is PD2 (pin 2) and INT1 is PD3 (pin 3). Pins 0/1 are the serial lines.

## SIM NOTE

- Behavior `mcu-supply` needs to hold, reset and restart the `VirtualMcu` from a behavior (for example a `ctx.mcu.reset()` / `ctx.mcu.hold(bool)` hook).
- Behavior `serial-plotter` needs a hook into the Serial ring buffer from the behavior side.
- `PIN.vcc` is a fixed number. In brown-out lessons, a pin's HIGH level should follow its supply node (proposal: optional `vccNode`).
- Polyfuse: a "resettable" rating mode, so that a tripped element recovers after a cool-down time instead of staying open.
- Tweaks: a linked potentiometer tweak that drives two elements (top = total − bottom), and a momentary button (click the 3D part to close the SW while the mouse is held).
- Transpiler: Uno `int` is 16-bit and integer division truncates. Since the JS target uses doubles, `int` assignments should truncate (and ideally wrap at 16 bits on `board:'uno'`). Without this, `7/2` gives 3.5.
- Spec §4 lists `VCVS`, but `types.ts` has `OPAMP`. This lesson uses `OPAMP` (types.ts is the source of truth).
