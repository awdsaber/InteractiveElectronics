# Teensy 4.1

*600 MHz in a breadboard-sized stick, at 3.3 V*

> An ARM Cortex-M7 at 600 MHz with 1 MB of RAM, Ethernet, USB host and a native USB port, whose pins take 3.3 V and not a millivolt of 5 V logic more than that.

- **Lesson id:** `teensy-41` · **Track:** T4 Microcontrollers, after `esp32-s3`
- **fig:** none set (no video figure): numbered in sidebar order by `assignFigs`
- **Prerequisites:** `arduino-uno`, `esp32-s3`, T1 `resistor-codes-divider`
- **Power element:** `usb_plug` (powerLabel: "Plug micro-USB")
- **Behaviors:** `square-wave` (the 5 V signal), `mcu-supply` (holds the MCU when the 3.3 V rail dies)
- **Sketch board profile:** `teensy41` (new; `src/engine/mcu/virtualMcu.ts`)
- **transient:** true

## Sources

| Tag | Source |
|---|---|
| [P1] | PJRC, Teensy 4.1 product page and technical description, pjrc.com/store/teensy41.html |
| [P2] | PJRC, "PWM & Tone" (analogWrite, analogWriteFrequency, analogWriteResolution), pjrc.com/teensy/td_pulse.html |
| [P3] | PJRC, Teensy 4.1 pinout card (front), linked from [P1] |
| [N1] | NXP, IMXRT1060CEC *i.MX RT1060 Crossover Processors for Consumer Products*, Rev. 4, 04/2024, Table 7 (absolute maximum ratings) and Table 10 (operating ranges) |

## Learning goals

1. Place the Teensy 4.1 against the Uno and the ESP32-S3: clock, memory, I/O count, logic level, and what each is for.
2. Name the board's parts: the i.MX RT1062, the 8 MB QSPI flash, PJRC's separate bootloader chip, the micro-USB device port, the USB-host and Ethernet headers, the microSD socket, the program button and the pin-13 LED.
3. Use the Teensy-only analog calls: `analogReadResolution`, `analogWriteResolution`, `analogWriteFrequency`.
4. Keep every pin at 0–3.3 V: divide any 5 V signal, and know what happens if you don't.
5. Respect PJRC's 4 mA per-pin recommendation.
6. Understand VIN and VUSB being joined, and why you cut the pads before adding external power.

## Key figures (verified)

| Figure | Value | Source |
|---|---|---|
| CPU | NXP i.MX RT1062, ARM Cortex-M7, 600 MHz, dual-issue | [P1] |
| FPU | 32-bit float and 64-bit double in hardware (double at half the float speed) | [P1] |
| Core voltage at 600 MHz | 1.25 V ("overdrive"); 1.15 V at 528 MHz | [P1], [N1] Table 10 |
| RAM | 1024 KB: 512 KB tightly coupled (RAM1) + 512 KB (RAM2, DMA-friendly) | [P1] |
| Flash | 8 MB (W25Q64JV); top 256 KB reserved (EEPROM emulation and the restore program) | [P1] |
| Extra memory | 2 QSPI pad locations on the bottom for 8-pin chips (8 MB PSRAM supported) | [P1] |
| microSD | built in, 4-bit native SDIO | [P1] |
| I/O | 55 digital pins (42 breadboard-friendly), 35 PWM, 18 analog inputs | [P1] |
| Analog pins | A0–A13 = pins 14–27, A14–A17 = pins 38–41 | [P3] |
| Logic level | 3.3 V, **not 5 V tolerant** | [P1] |
| Pin absolute maximum | V_in/V_out −0.5 V to OVDD + 0.3 V (3.6 V on a 3.3 V supply) | [N1] Table 7 |
| Pin current | 4 mA recommended maximum per pin | [P1] |
| Output drive strength | 7 settings, about 150 Ω down to about 21 Ω | [P1] |
| ADC | 10-bit by default, hardware up to 12-bit, fixed 0–3.3 V range (`analogReference` has no effect); noise leaves about 10 usable bits | [P1] |
| DAC | none on the 4.1 (PJRC suggests an external PT8211 for audio) | [P1] |
| PWM default frequency | 4.482 kHz on FlexPWM pins, 3.611 kHz on QuadTimer pins (10–15, 18, 19); 8-bit by default | [P2] |
| 12-bit PWM ideal frequency (600 MHz) | 36 621.09 Hz | [P2] |
| Pins sharing a timer | e.g. 2 & 3 (FlexPWM4.2), 6 & 9, 7 & 8 & 25: `analogWriteFrequency` on one changes all | [P2] |
| Serial / SPI / I²C / CAN | 8 UARTs, 3 SPI, 3 I²C (100/400/1000 kbit/s), 3 CAN (one CAN FD; needs a transceiver) | [P1] |
| Audio | 2 I²S/TDM ports, S/PDIF | [P1] |
| Ethernet | 10/100 Mbit, TI DP83825 PHY on the board; an RJ45 magjack kit plugs into the 6-pin header | [P1] |
| USB device | 480 Mbit/s: Serial, MIDI, Audio, Keyboard, Mouse, Joystick, MTP, Raw HID, … | [P1] |
| USB host | separate port (5-pin header), 480/12/1.5 Mbit/s, current limited | [P1] |
| Supply | 5 V on VUSB/VIN, VIN 3.6–5.5 V | [P1], [P3] |
| VUSB–VIN | joined by default; cut the bottom pads to separate them before adding external power with USB connected | [P1] |
| 3.3 V for your circuits | 250 mA recommended maximum from the 3.3 V pins | [P1] |
| Board's own draw | about 100 mA at 600 MHz | [P1] |
| Program button | enters programming mode (not a reset); held 13–17 s it restores the blink program | [P1] |
| Bootloader | on a separate PJRC chip, used by Teensy Loader / Teensyduino | [P1] |
| Pin 13 | the orange LED; avoid INPUT_PULLUP on it | [P1] |

**Things not stated by PJRC or NXP, so the lesson says less:** the regulator's part number and current limit (the lesson only gives PJRC's 250 mA spare figure), an absolute-maximum per-pin current (NXP's Table 7 has none: the bench uses a 20 mA teaching threshold and calls it that), and an injection-current rating for the ESD diodes (the bench uses a 5 mA teaching threshold, as the ESP32 lesson does).

## Board (on the bench)

`breadboard-only` base. The Teensy lies in front of a half-size breadboard with its header pins pointing up so jumper leads push on (as the ESP32 lesson does); in practice you would solder headers and plug it into the breadboard.

| id | kind | label | notes |
|---|---|---|---|
| teensy | `module` (6.1 × 1.8, green) | TEENSY 4.1 | 61 × 18 mm carrier |
| u1 | `ic-smd` (BGA shown as a leadless square) | RT1062 | i.MX RT1062 |
| u_flash | `ic-smd` SOIC-8 | FLASH | 8 MB QSPI |
| u_boot | `ic-smd` QFN | BOOT | PJRC bootloader chip |
| u_phy | `ic-smd` QFN | PHY | DP83825 |
| u_reg | `ic-smd` | 3V3 REG | `reg` element |
| x1 | `crystal` | 24 MHz | system clock source |
| j_usb | `micro-usb` | USB | `v_usb`, `usb_plug` |
| h_host, h_eth | `header-male` | USB HOST / ETH | 5-pin, 2 × 3 |
| sd | `ic-smd` (square, steel) | microSD | socket |
| sw_prog | `button` | PROGRAM | |
| led13 | `led-smd` | LED 13 | `pin13`, `led13` |
| h_l, h_r | `header-male` 24-pin | | rows 0.6" apart |
| pot, r_dtop, r_dbot, r_led, led_ext, sig5, wires | breadboard parts | | |

## Circuit

- USB 5 V (`v_usb`, 0.3 Ω cable and port) → `usb_plug` → probe `usb_i` → `vusb` → `vin_trace` (SW, the VUSB–VIN pads) → `vin` → `reg` (REG 3.3 V, 0.3 V dropout, teaching value consistent with VIN ≥ 3.6 V) → `3v3`.
- `i_mcu` 100 mA on 3v3 [P1].
- Pin 22 (FlexPWM) → 470 Ω → red LED: (3.3 − 1.8) / (470 + 25) ≈ **3.0 mA**, under PJRC's 4 mA.
- Pot on A0 (pin 14), 0–3.3 V.
- 5 V square wave (0.5 Hz) → 10 kΩ / 20 kΩ divider → pin 21: 3.33 V. ESD clamp diode pin 21 → 3v3.
- Pin 13 → orange LED (on board).

## Sketch (board `teensy41`)

12-bit ADC read of the pot straight into a 12-bit PWM duty at 36.6 kHz on pin 22 (4096 brightness steps, no `map()`), a 2 Hz heartbeat on pin 13, and a twice-a-second Serial report: `pot:<0..4095>,duty:<%>,sig:<0|1>`.

## Failures

1. **5 V straight into pin 21** (divider bypassed through 100 Ω): pin 21 sits about one diode drop above 3.3 V, the clamp carries several mA and burns short. Pin 21 is dead, stuck at the rail. Fix: divider, level shifter (74LVC245 / 74LVC1T45-class) or open-drain with a 3.3 V pull-up.
2. **LED with no resistor on pin 22**: about (3.3 − 2) / 25 Ω ≈ 50 mA, more than ten times PJRC's 4 mA. The pin's output stage fails (20 mA teaching threshold).
3. **External 5.2 V on VIN with USB plugged in, pads not cut**: the two supplies are tied, so the higher one pushes current backwards into the PC's USB port (the **USB PORT** readout goes negative). Fix: cut the VUSB–VIN pads (tweak), then the external supply runs the board and USB carries data only.

## Comparison (meet text)

| | Uno R3 | ESP32-S3 | Teensy 4.1 |
|---|---|---|---|
| Core | AVR 8-bit, 16 MHz | 2 × Xtensa LX7, 240 MHz | Cortex-M7, 600 MHz, FPU (double too) |
| RAM | 2 KB | 512 KB | 1024 KB |
| Logic | 5 V | 3.3 V | 3.3 V, not 5 V tolerant |
| ADC | 10-bit | 12-bit | 10-bit default, 12-bit max |
| Radio | — | WiFi + BLE | — (Ethernet instead) |
| USB | via a bridge chip | native + bridge | native 480 Mbit/s device + host |

Choose a Teensy for speed and determinism without an RTOS or radio stack, for DSP and audio (FPU, I²S, PJRC's Audio library), for low-latency native USB devices (MIDI, HID, joystick), and for many hardware buses at once (8 UARTs, 3 CAN). Choose an ESP32 for wireless; an Uno for 5 V shields and simplicity.

## Programming

Arduino IDE plus PJRC's Teensyduino add-on (board support), then **Teensy Loader** writes the HEX through the bootloader chip. Upload normally starts automatically; if the USB code on the board has crashed, press the **program button** once.

## Quiz

1. A 5 V sensor output into a Teensy 4.1 pin: what do you need? → a divider or level shifter (abs. max OVDD + 0.3 V).
2. `analogWriteResolution(12)`: what value gives 50 % duty? → 2048 (of 0–4095).
3. Changing `analogWriteFrequency(2, …)` also changes which pin? → 3 (same FlexPWM4.2 timer).
4. Why cut the VUSB–VIN pads before adding a 5 V supply on VIN? → so the supply cannot back-feed the computer's USB port.
