# ESP32-S3 DevKitC-1

*Two cores, WiFi, 3.3 V*

> A dual-core 240 MHz chip with WiFi and Bluetooth LE whose pins are rated to only 3.6 V, so a 5 V signal has to go through a divider first.

- **Lesson id:** `esp32-s3` · **Track:** T4 Microcontrollers
- **fig:** 27 (video Fig. 04). Provisional: sidebar order.
- **Prerequisites:** `arduino-uno`, T1 `resistor-codes-divider`
- **Power element:** `usb_plug` (powerLabel: "Plug USB-C")
- **Behaviors:** `wifi-sim`, `ws2812`, `esp32-boot`, `serial-plotter`
- **transient:** true

## Learning goals

1. Compare the ESP32-S3 with the ATmega328P on clock, cores, memory, logic level, ADC resolution and radio.
2. Identify the DevKitC-1's on-board parts: the WROOM-1 module (with its crystal, flash and antenna inside), the two USB-C ports, the USB-UART bridge, the LDO, the BOOT/RST buttons and the RGB LED.
3. Level-shift a 5 V signal into a 3.3 V input with a resistor divider, and explain why a series resistor alone is not enough.
4. Drive the onboard addressable RGB LED, and know that its GPIO depends on the board revision.
5. Avoid the pins that are reserved: strapping pins, flash/PSRAM pins, USB, and ADC2 while WiFi is on.

## Board

Board: `ESP32-S3-DevKitC-1`, size 6.3 × 2.6 (approximate), base `mat`, with a breadboard alongside.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| u1 | `wifi-module` (ESP32-S3-WROOM-1, 18 × 25.5 mm) | `smd` | WROOM-1 | Dual-core Xtensa LX7 up to 240 MHz, 512 KB SRAM, flash (8 MB on the common N8 variant), 2.4 GHz WiFi + BLE 5, PCB antenna. | `i_module` |
| (inside u1) | `crystal` (40 MHz) | `smd` | 40 MHZ | Main clock and radio reference, under the module's metal can. It is shown in the exploded view only. | — |
| j_uart | `usb-c` | `smd` | UART | USB to the on-board USB-UART bridge: programming plus `Serial`. | `v_usb`, `usb_plug` |
| j_usb | `usb-c` | `smd` | USB | The S3's own USB (GPIO19/20). It can act as a native USB device or JTAG. | — |
| u2 | `ic-smd` (QFN, USB-UART bridge) | `smd` | USB-UART | Converts USB to UART0 (GPIO43/44). The chip varies by revision (CP2102N-class on early boards). Read the marking. | — |
| u3 | `ic-smd` (SOT-223/SOT-23-5 LDO) | `smd` | 3V3 LDO | 5 V to 3.3 V for the module and the 3V3 pins. The part number varies by revision; check the schematic for your board. | `ldo` |
| led_rgb | `led-smd` (5050 WS2812-compatible) | `smd` | RGB | Addressable RGB LED on **GPIO48 (v1.0 boards) or GPIO38 (v1.1 boards)**. | `pin_rgb`, `i_rgb` |
| led_pwr | `led-smd` (red) | `smd` | PWR | Lights when 3.3 V is present. | — |
| sw_boot | `button` | `smd` | BOOT | Holds GPIO0 low at reset to enter the ROM bootloader. | — |
| sw_rst | `button` | `smd` | RST | Pulls EN low, which resets the chip. | — |
| h1, h2 | `header-male` (2 × 22-pin) | `tht` | J1 / J3 | GPIO, 3V3, 5V, GND. | — |
| r_led | `resistor` (150 Ω) | `offboard` | 150 Ω | Limits the external LED on GPIO5. | `r_led` |
| led_ext | `led` (5 mm red) | `offboard` | PWM LED | Brightness follows `analogWrite` on GPIO5. | `led_ext` |
| pot | `potentiometer` (10 kΩ) | `offboard` | POT | 0–3.3 V into GPIO1 (ADC1_CH0). | `pot_top`, `pot_bot` |
| r_dtop, r_dbot | `resistor` (10 kΩ, 20 kΩ) | `offboard` | DIVIDER | Scales a 5 V logic signal to 3.33 V for GPIO4. | `r_dtop`, `r_dbot` |
| sig5 | `module` (title "5 V LOGIC", e.g. an Uno output) | `offboard` | 5V SIGNAL | A 5 V square-wave source. | `v_sig` |
| bb | `breadboard` | `offboard` | BREADBOARD | | — |

## Circuit

The LDO is modelled as a unity buffer whose output is clamped to 3.3 V. It gives 3.3 V whenever the 5 V rail is above 3.3 V. Its dropout and input current are not modelled (SIM NOTE).

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_usb` | V | `usb_vbus`, `0` | 5.0 V, rInternal 0.3 Ω | — | |
| `usb_plug` | SW | `usb_vbus`, `5v` | closed: false | — | **Power element** |
| `ldo` | OPAMP | `5v`, `3v3`, `3v3` | vPos 3.3, vNeg 0 | — | LDO model (in+, in−, out) |
| `c_3v3` | C | `3v3`, `0` | 22 µF | maxV 10 V | |
| `i_module` | I | `3v3`, `0` | 0.045 A (set by `wifi-sim`) | — | About 40–50 mA with the CPU active and no radio. TX bursts reach a few hundred mA. Approximate; see the datasheet's current table. |
| `pin_rgb` | PIN | `g48`, `0` | pin 48, vcc 3.3 | — | WS2812 data. The bench uses 48; on v1.1 set 38 |
| `i_rgb` | I | `3v3`, `0` | 0 A (set by `ws2812`) | — | LED supply current |
| `pin5` | PIN | `g5`, `0` | pin 5, vcc 3.3 | maxV 3.6 V | |
| `r_led` | R | `g5`, `led_a` | 150 Ω | maxP 0.25 W | |
| `led_ext` | LED | `led_a`, `0` | red | maxI 0.03 A | (3.3 − 1.8)/(150 + 25) ≈ 8.6 mA |
| `pot_top` | R | `3v3`, `g1` | 5 kΩ | — | |
| `pot_bot` | R | `g1`, `0` | 5 kΩ | — | |
| `v_sig` | V | `s5`, `0` | 5.0 V (toggled 0/5 V by `wifi-sim` at 1 Hz) | — | Stand-in for a 5 V device |
| `r_dtop` | R | `s5`, `g4` | 10 kΩ | — | |
| `r_dbot` | R | `g4`, `0` | 20 kΩ | — | 5 × 20/30 = 3.33 V |
| `pin4` | PIN | `g4`, `0` | pin 4, vcc 3.3 | maxV 3.6 V | INPUT. 3.6 V = VDD + 0.3 V absolute max |
| `d_esd` | D | `g4`, `3v3` | is 1e-12, n 1.5 | maxI 0.005 A | Internal ESD clamp to VDD. The 5 mA limit is a teaching threshold: Espressif publishes no injection-current rating. |
| `pin0` | PIN | `g0`, `0` | pin 0, vcc 3.3 | — | Strapping pin, INPUT with internal pull-up at boot |

### Behaviors

- **`wifi-sim`**. Exposes the library `WiFi`:
  - `WiFi.mode(m)`, `WiFi.begin(ssid, pass)`, `WiFi.status()` (returns `WL_CONNECTED` about 1.5 s of sim time after `begin` if the SSID matches the bench network `atelier-bench`), `WiFi.localIP()` (returns the string `"192.168.4.23"`), `WiFi.RSSI()` (about −55 dBm ± 3), `WiFi.disconnect()`.
  - Also exposes `xPortGetCoreID()`, which returns 1 inside `setup`/`loop` because Arduino-ESP32 runs `loop()` on core 1 and the WiFi stack on core 0.
  - Each tick it sets `i_module.value`: 0.045 A with the radio off, 0.10 A average once connected, and a 0.30 A pulse lasting 2 ms every 100 ms (the beacon/TX bursts, approximate).
  - Toggles `v_sig` between 0 and 5 V at 1 Hz.
  - Publishes `wifi_state` (0 off, 1 connecting, 2 connected), `rssi` and `module_mA`.
- **`ws2812`**. Exposes `rgbLedWrite(pin, r, g, b)` (Arduino-ESP32 core 3.x; core 2.x called it `neopixelWrite`). If `pin` matches `pin_rgb.pin`, it publishes `rgb_r`, `rgb_g` and `rgb_b` (0–255) for the 3D LED glow. It sets `i_rgb` ≈ (r + g + b)/765 × 36 mA, a rough figure for a WS2812-class LED at full white.
- **`esp32-boot`**. At power-up it reads `nodeV['g0']`. If GPIO0 is below 0.25 × 3.3 V, it halts the MCU, prints `waiting for download` to Serial, and publishes `boot_mode = 1`. Otherwise it runs the sketch. Needs an MCU hold hook (SIM NOTE).
- **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** S3 hello · **board:** `esp32s3` · **vcc:** 3.3

| GPIO | Use | PIN element / node |
|---|---|---|
| 48 (38 on v1.1) | Onboard RGB LED | `pin_rgb` |
| 5 | PWM LED | `pin5` |
| 4 | 5 V signal via divider | `pin4` |
| 1 | Pot (ADC1_CH0, 12-bit) | analogPins `1 → g1` |

```cpp
#include <WiFi.h>

#define RGB_PIN 48      // DevKitC-1 v1.0. Use 38 on v1.1 boards
#define LED_PIN 5
#define SIGNAL_PIN 4
#define POT_PIN 1       // ADC1: still works while WiFi is on

unsigned long lastReport = 0;
int hue = 0;

void setRgbFromHue(int h) {      // h = 0..299, three 100-step ramps
  int r = 0;
  int g = 0;
  int b = 0;
  if (h < 100) {
    r = 100 - h;  g = h;
  } else if (h < 200) {
    g = 200 - h;  b = h - 100;
  } else {
    b = 300 - h;  r = h - 200;
  }
  rgbLedWrite(RGB_PIN, r / 2, g / 2, b / 2);   // keep it dim: max ~50
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(SIGNAL_PIN, INPUT);

  WiFi.mode(WIFI_STA);
  WiFi.begin("atelier-bench", "breadboard");
  Serial.print("Connecting");
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    rgbLedWrite(RGB_PIN, 40, 20, 0);   // amber blink = waiting
    delay(125);
    rgbLedWrite(RGB_PIN, 0, 0, 0);
    delay(125);
    Serial.print(".");
    tries++;
  }
  Serial.println("");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi failed, running offline");
  }
}

void loop() {
  int raw = analogRead(POT_PIN);              // 0..4095 on the S3
  analogWrite(LED_PIN, map(raw, 0, 4095, 0, 255));

  hue = (hue + 1) % 300;
  setRgbFromHue(hue);

  if (millis() - lastReport >= 1000) {
    lastReport = millis();
    Serial.print("core:");
    Serial.print(xPortGetCoreID());
    Serial.print(",rssi:");
    Serial.print(WiFi.RSSI());
    Serial.print(",pot:");
    Serial.print(raw);
    Serial.print(",sig:");
    Serial.println(digitalRead(SIGNAL_PIN));
  }
  delay(20);
}
```

## Readouts

| label | source | unit |
|---|---|---|
| 3V3 RAIL | `{kind:'voltage', node:'3v3'}` | V |
| MODULE CURRENT | `{kind:'behavior', key:'module_mA'}` | '' (mA) |
| GPIO4 (DIVIDED) | `{kind:'voltage', node:'g4'}` | V |
| GPIO5 LED | `{kind:'current', elementId:'led_ext'}` | A |
| POT (GPIO1) | `{kind:'voltage', node:'g1'}` | V |
| WIFI RSSI | `{kind:'behavior', key:'rssi'}` | '' (dBm) |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Pot (lower leg) | `pot_bot` | value | 10 | 9990 | 10 | no | Ω |
| Divider bottom | `r_dbot` | value | 4700 | 100000 | — | yes | Ω |
| LED resistor | `r_led` | value | 47 | 1000 | — | yes | Ω |

Drag the divider bottom above about 26 kΩ and GPIO4 rises past 3.6 V: 5 × 26/36 = 3.61 V. The ESD diode then starts conducting into the 3.3 V rail.

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: loop() on core 1, WiFi on core 0, RGB cycling. |
| readout 2 above 3.6 | GPIO4 is above VDD + 0.3 V: the clamp diode is conducting. |
| readout 0 below 3.0 | 3.3 V rail is low: brown-out is likely during a WiFi burst. |

## Failures

### F1: Wire a 5 V signal straight into GPIO4
- **Patch:** `{op:'remove', elementId:'r_dbot'}`, `{op:'set', elementId:'r_dtop', key:'value', value:100}`
- **Sim shows:** GPIO4 climbs to about 4.2 V, held there only by `d_esd` conducting into the 3.3 V rail. The clamp carries (5 − 4.2)/100 ≈ 8 mA, so after 300 ms `d_esd` burns (shorts) and `pin4` exceeds its 3.6 V maximum. GPIO4 is marked dead.
- **Why:** the ESP32-S3's absolute maximum on any pin is VDD + 0.3 V. The internal ESD diodes are there to absorb a static zap, not a steady current. A 10 k/20 k divider, a level shifter (e.g. 74LVC1T45) or an open-drain output pulled up to 3.3 V are the safe options.

### F2: LED with no resistor on GPIO5
- **Patch:** `{op:'short', a:'g5', b:'led_a'}`
- **Sim shows:** about (3.3 − 2.0)/25 ≈ 50 mA, above the 40 mA rating, so the pin is marked dead after 300 ms.
- **Why:** at 3.3 V there is less headroom, but the LED still has almost no resistance. The S3 datasheet rates source current at about 40 mA at the strongest drive setting (20 mA at the default). Treat 20 mA as the budget.

### F3: Button on GPIO0 held at power-up
- **Patch:** `{op:'add', element:{id:'boot_held', type:'SW', nodes:['g0','0'], closed:true}}`
- **Sim shows:** after USB power the sketch never starts. Serial prints `waiting for download` and the RGB LED stays dark.
- **Why:** GPIO0 is a **strapping pin**. The ROM samples it at reset, and LOW selects the USB/UART bootloader. GPIO3, 45 and 46 are also strapping pins. Do not hang buttons or pull-downs on them unless you mean to.

## Meet the board

The DevKitC-1 is a breakout for the **ESP32-S3-WROOM-1** module. Inside the metal can are the S3 chip, a 40 MHz crystal and SPI flash, with the antenna as copper on the module's PCB. The dev board adds a USB-UART bridge, a second USB-C wired to the S3's native USB, a 3.3 V LDO, BOOT and RST buttons, and an RGB LED.

**Compared with the Uno:** two 32-bit cores at up to 240 MHz instead of one 8-bit core at 16 MHz (15 times the clock, and much more work per clock), and 512 KB of SRAM against 2 KB. The ADC is 12-bit (0–4095), and there is WiFi plus BLE 5.

**The catch is 3.3 V.** A 5 V signal must be divided first. Choose 10 kΩ and 20 kΩ: 5 × 20/(10 + 20) = **3.33 V**, and the load on the source is only 5 V/30 kΩ = 0.17 mA.

**LED maths at 3.3 V.** A red LED needs (3.3 − 1.8)/0.01 = **150 Ω** for 10 mA, and a blue one (2.9 V) has only 0.4 V left to drop. Use 47 Ω for blue, or drive it from 5 V through a transistor.

**RGB LED.** Espressif's v1.0 boards put it on GPIO48 and v1.1 boards on GPIO38. Check the revision on your board's silkscreen or the seller's page. Arduino-ESP32 also defines `RGB_BUILTIN` for the selected board.

**Power.** A WiFi burst can pull a few hundred mA. A 22 µF capacitor on 3.3 V and a decent cable prevent brown-out resets.

## For mechanical engineers

> Think of the Uno as a single-cylinder engine with a direct linkage. The S3 is a twin with a turbo and an onboard radio. Core 0 is a dedicated governor running the WiFi stack, so your `loop()` on core 1 gets the other cylinder. The 3.3 V logic is a lower-pressure hydraulic system: plumb in a 5 V line without a reducer (the divider) and you blow the seals (the ESD diodes). **Where it breaks:** the two cores share memory and peripherals, so they are less independent than two engines on separate shafts. A busy radio can still delay your code.

## Pro tips

1. Use the ADC1 pins (GPIO1–10) for analog inputs in WiFi projects. The WiFi driver also uses ADC2 (GPIO11–20), and reads there can fail or be delayed while the radio is on.
2. Keep clear of GPIO26–32 (SPI flash/PSRAM), GPIO35–37 on modules with octal PSRAM, GPIO19/20 if you need native USB, and GPIO43/44 if you want `Serial` on the UART port. Check your module variant (N8, N8R8 and so on) in the datasheet's pin table.
3. Many 5 V modules (HC-SR04, some relay boards) accept 3.3 V as a valid HIGH input but send back 5 V outputs. Divide every line that goes *into* the S3. Lines that go *out* to them usually work as they are.

## Quiz

1. **You divide a 5 V signal with a 10 kΩ top resistor. Which bottom resistor gives about 3.3 V?**
   - 4.7 kΩ
   - 10 kΩ
   - 20 kΩ
   - 47 kΩ
   - **Answer:** 2. *Why:* 5 × R/(10k + R) = 3.3 gives R ≈ 19.4 kΩ, so 20 kΩ gives 3.33 V.

2. **A green LED (Vf 2.1 V) on a 3.3 V pin at 10 mA needs which resistor?**
   - 68 Ω
   - 120 Ω
   - 330 Ω
   - 1 kΩ
   - **Answer:** 1. *Why:* (3.3 − 2.1)/0.010 = 120 Ω.

3. **On a DevKitC-1 v1.1, which GPIO drives the onboard RGB LED?**
   - GPIO2
   - GPIO38
   - GPIO48
   - GPIO13
   - **Answer:** 1. *Why:* Espressif moved it from GPIO48 (v1.0) to GPIO38 (v1.1). Always check your revision.

4. **The board averages 100 mA with WiFi on. How long does a 2000 mAh power bank last, ignoring conversion losses?**
   - 2 h
   - 20 h
   - 200 h
   - 2000 h
   - **Answer:** 1. *Why:* 2000 mAh / 100 mA = 20 h. In practice the 5 V boost and the LDO losses take 15–30 % off that.

## SIM NOTE

- `Sketch.analogPins` is keyed `A0…` strings. The ESP32 uses GPIO numbers with `analogRead(gpio)` and a **12-bit** result. The MCU needs an `adcBits` setting per board (12 for `esp32s3`).
- Library functions that are plain globals (`rgbLedWrite`, `xPortGetCoreID`) as well as objects (`WiFi`). Constants `WIFI_STA` and `WL_CONNECTED`.
- `Serial.println` of a string returned by a library (`WiFi.localIP()`).
- `esp32-boot` needs a behavior→MCU hold/halt hook, and access to node voltages at the moment of power-up.
- The LDO-as-clamped-OPAMP model has no dropout, no current limit and no input current. An `LDO` element (vout, dropout, Iq, current limit) would let brown-out from WiFi bursts appear in the netlist.
- Real dual-core scheduling (`xTaskCreatePinnedToCore`) is out of scope. Only `xPortGetCoreID()` is stubbed.
