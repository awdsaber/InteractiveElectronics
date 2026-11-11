# Leo Bodnar BU0836: a USB joystick with no code

*Pots and buttons in, a game controller out*

> Wire a throttle pot and a few buttons to a BU0836-style board, plug it in, and the computer already sees a joystick: the board's own firmware speaks USB HID, so you write no code at all.

- **Lesson id:** `leo-bodnar-bu0836` · **Track:** T4 Microcontrollers
- **fig:** not set (no video figure): numbered in sidebar order. Sidebar order: after `teensy-41`, which another author adds in parallel (both ids appended to `TRACK_ORDER.T4`).
- **Prerequisites:** T1 `resistor-codes-divider` (the pot as a divider), T3 `adc-dac-pwm` (quantisation), T5 `encoders` (quadrature)
- **Power element:** `usb_plug` ("Plug USB")
- **Behaviors:** `usb-hid` (new, shared, instance `hid`), `pot-knob` ×2, `intermittent` (instance `wiper`)
- **Sketch:** none. That is the point of the lesson.

## Sourced figures

All from Leo Bodnar Electronics' own product pages and manuals (fetched 2026-11-11).

| Figure | Value | Source |
|---|---|---|
| BU0836A analog inputs | 8, 12-bit (4096 steps) each | BU0836A product page and manual PDF [A], [A-pdf] |
| BU0836A digital inputs | 32 buttons, or up to 16 rotary encoders, plus an 8-way POV hat | [A], [A-pdf] |
| BU0836A button wiring | 6 ROWS × 6 COLUMNS matrix. Row 1 + Column 1 = button 1, Row 1 + Column 2 = button 2, Row 2 + Column 1 = button 7. The last 4 contacts form the hat. | [A-pdf] |
| Matrix diodes | "required if there will be 3 or more contacts activated simultaneously" (on/off switches); not needed for momentary buttons; 1N4148 or 1N4004 suggested | [A-pdf], [A] |
| BU0836A direct wiring | up to 12 buttons or switches between the 12 row/column pins and GND, no diodes, no configuration | [A-pdf] |
| BU0836X inputs | 8 × 12-bit analog; 32 independent digital inputs: "No matrix, no diodes"; push-in terminals, 24–20 AWG | BU0836X product page [X] |
| BU0836-LC | 1 load-cell input (12-bit, 10 mV full scale, excited from the USB 5 V) + 7 × 12-bit analog, 32 buttons (12 direct, or a 6 × 6 matrix), hat | [LC] |
| Encoders | a pair of digital inputs per encoder; types with 1, 2 and 4 pulses per detent; set with Leo Bodnar's encoder configuration software; pairs start on an odd input (1-2, 3-4, ...) | [A-pdf], [X] |
| Pots | any value 1 kΩ to 100 kΩ, 10 kΩ if unsure; linear taper (B), avoid log tapers A, D, Y; one 3-wire set (+5 V, wiper, GND) per pot | [A-pdf], [A] |
| Analog terminals | each analog input has its own +5 V and GND terminals | [A-pdf], [X] |
| Unused inputs | unused analog inputs are disabled automatically and appear once a pot is connected and the board powered; unconnected buttons read "not pressed" | [A-pdf], [X-pdf] |
| Wiring safety | connect pots only with the USB cable unplugged | [A-pdf], [X], [X-pdf] |
| Power | bus-powered from USB, no external supply | [A], [X], [LC] |
| USB | full-speed (12 Mbit/s), USB-B socket; "generic USB HID game controller", no drivers; appears as a game device named after the board (e.g. BU0836A) | [A], [X], [X-pdf] |
| Update rate | 500 position updates per second for each input and button (BU0836A page) | [A] |
| Calibration | standard Windows game-controller calibration; a unique serial number keeps calibration when the board moves to another USB port; curves and deadzones in Leo Bodnar's DIView | [A], [LC] |
| Wire | 24 AWG to 20 AWG | [A-pdf], [X] |
| Noise | for a clean signal use shielded wire and ground a metal pot case; use as much of the pot's travel as possible | [A-pdf] |

Sources:
- [A] https://www.leobodnar.com/products/BU0836A/ and https://www.leobodnar.com/shop/index.php?main_page=product_info&products_id=204
- [A-pdf] https://www.leobodnar.com/products/BU0836A/BU0836A.pdf
- [X] https://www.leobodnar.com/shop/index.php?main_page=product_info&cPath=94&products_id=180 (BU0836X)
- [X-pdf] https://www.leobodnar.com/products/BU0836X/BU0836X.pdf (quick setup)
- [LC] https://www.leobodnar.com/products/BU0836-LC/

General USB facts (USB 2.0 and HID 1.11 specifications, not Leo Bodnar): HID is interface class 0x03; a device describes its reports with a report descriptor (Usage Page Generic Desktop 0x01, Usage Joystick 0x04, axes X 0x30, Y 0x31, ...; Button page 0x09); input reports go over an interrupt IN endpoint, which a full-speed device can ask to be polled at most once per 1 ms frame (1000 Hz).

### Could not verify (said less, or marked as the bench's model)

- The ADC reference of the BU0836 family. The bench treats the axis as **ratiometric** to the board's own +5 V terminal, which is what "independent +5 V and GND per input" suggests, but Leo Bodnar does not say so.
- The input impedance of an analog input. The bench uses 1 MΩ plus 100 nF to ground (illustrative), so an open wiper sinks toward 0 and an open ground lead pins the axis near full scale.
- The matrix scan rate and the column pull-ups: the bench scans one row per 1 ms step with 10 kΩ pull-ups (illustrative).
- Exactly how a decoded encoder step is reported. The bench reports each detent as a short press (30 ms, illustrative) on one of the pair's two buttons, one per direction.
- The exact meaning of "1, 2 and 4 pulses per detent". The bench's encoder makes one full A/B cycle (four contact changes) per detent and the board is set to match; the lesson only says "set the mode to your encoder's datasheet".
- The axis-to-usage mapping (which input is X, Y, Z...) and the report byte layout. The panel's report bytes are labelled "illustrative layout".
- The BU0836A product page says USB 500 mA; the BU0836X page says 100 mA. The lesson says only "bus-powered".
- Pot noise in a long cable: the bench's 40 mV rms pickup is illustrative.

## Learning goals

1. Say what USB HID is: a class the OS already has a driver for, a report descriptor that lists the axes and buttons, and input reports polled on an interrupt endpoint.
2. Explain why a dedicated HID encoder board needs no firmware from you: its firmware is fixed, and the descriptor is the whole contract.
3. Wire a pot as a divider into an axis input and predict the raw count: N = ⌊V / Vref × 4096⌋.
4. Wire buttons into a row/column matrix, explain ghosting, and show why a diode per switch stops it.
5. Wire a rotary encoder to a pair of inputs.
6. Choose between a no-code board and a programmable one (ATmega32U4 Leonardo / Pro Micro, Teensy).
7. Diagnose the cockpit's classic faults from the controller panel: an open wiper, an open ground, pickup on a long cable.

## Board

`JOY-8 HID` (original artwork, BU0836A-style): 9 × 4.4, base `mat`, with the cockpit controls on the mat in front.

| id | kind | mount | label | role |
|---|---|---|---|---|
| usb | `usb-b` | tht | USB | Full-speed USB device port: power and the HID link. |
| mcu | `ic-smd` (TQFP) | smd | USB MCU | The board's fixed firmware: samples, scans, builds the reports. |
| xtal | `crystal` | tht | 12 MHz | (generic: full-speed USB needs an accurate clock) |
| led | `led-smd` | smd | — | power LED |
| ax1..ax8 | `header-male` 3 pin | tht | AXIS 1..8 | +5 V, input, GND per axis |
| rows, cols | `header-male` 6 pin | tht | ROWS / COLUMNS | the button matrix |
| pot_thr, pot_brk | `potentiometer` | offboard | THROTTLE / BRAKE | 10 kΩ linear (B) |
| k1, k2, k7, k8 | `button` (latching) | offboard | B1 B2 B7 B8 | 2 × 2 corner of the matrix |
| d1, d2, d7, d8 | `diode` 1N4148 | offboard | — | one per switch |
| enc | `potentiometer` (styled encoder knob) | offboard | ENCODER | pair 3-4 on row 1 |
| wires | `wire` | offboard | — | 3 per pot, matrix and encoder |

## Circuit

- `v_usb` 5 V → `usb_plug` SW (power) → `5v`.
- Throttle: `lead_thr_v` (5v→thr_hi), POT `pot_thr` [thr_lo, thr_w, thr_hi] 10 kΩ, `lead_thr_g` (thr_lo→0), `lead_thr_w` (thr_w→ax1), `rin_ax1` 1 MΩ + `cin_ax1` 100 nF to ground. Brake the same on `ax2`.
- Matrix: row drivers `scan_r1`, `scan_r2` (SW to ground; closed = that row selected; the other is open, high-impedance); columns `col1..col4` pulled up 10 kΩ to 5 V. Key k at (row r, column c): SW `sw_k` from the column to `k_m`, diode `d_k` from `k_m` (anode) to the row (cathode). Encoder contacts A and B are keys 3 and 4 (row 1, columns 3 and 4) with their own diodes.

Ghosting, worked: hold B1 (r1 c1), B7 (r2 c1) and B8 (r2 c2). While row 1 is low, column 2 can reach it through B8 forward, row 2, then *backwards* through B7, column 1 and B1. B7's diode blocks that backward leg. Remove it and column 2 is pulled to about 1.3 V (two diode drops): the board sees B2, a button nobody pressed. With only two switches closed there is no such path, which is why Leo Bodnar says diodes are needed from three simultaneous contacts.

## Behavior `usb-hid` (new, shared)

Params: `axes` (nodes), `axisNames`, `refNode` (ratiometric reference, default '' = `vref` 5 V), `bits` (12), `reportHz` (500), `noiseMv` / `noiseAxis` (pickup, illustrative), `deadzonePct` (game side), `rows` (row-driver SW ids), `cols` (column nodes), `colVth` (2.5 V), `perRow` (6: button = row × 6 + column + 1), `keys` (SW ids) + `keyButtons` (their button numbers) with params `k1..kN` (0/1) that close them, `encPair` (first button of the encoder pair), `encA` / `encB` (contact SW ids), `cw` / `ccw` (momentary, rising edge = one detent), `pulseMs` (30), `detentMs` (24), `buttonLabels`.

Publishes: `ax<i>` (raw counts), `ax<i>_v`, `ax<i>_pct`, `ax<i>_game` (% after deadzone), `buttons_down`, `ghosts`, `b<n>` (0/1), `enc_steps`, `enc_pos` (0..1, knob angle), `report_hz`, `reports`. Exposes a `HidView` for the Game controller panel.

Quantisation: N = clamp(⌊(V / Vref) × 2^bits⌋, 0, 2^bits − 1). Example: 50 % pot, 2.494 V with the 1 MΩ input → 2043.

## Readouts

THROTTLE, BRAKE (counts), THROTTLE WIPER (V), BUTTONS DOWN, GHOSTS, ENCODER STEPS, REPORT RATE (Hz), BRAKE IN GAME (%).

## Tweaks

Throttle pedal, Brake pedal (%), B1 / B2 / B7 / B8 (toggles), Encoder click CW / CCW (momentary), Deadzone (%).

## Failures

1. `no-diode-b7`: leave out B7's diode. Holding B1, B7 and B8 makes B2 appear (GHOSTS 1).
2. `worn-wiper`: the brake pot's wiper loses contact in random spells; the axis jumps toward 0 and back.
3. `thr-ground-open`: the throttle pot's ground lead breaks; the wiper sits at 5 V through the track and THROTTLE pins near 4095 whatever the pedal does.
4. `long-cable`: the brake on 3 m of unshielded wire beside a motor: 40 mV rms pickup (illustrative), about ±33 counts of jitter.

## Guide (9 steps)

meet the board (inspect) → plug USB → open the Game controller panel → throttle to half (≈2048) → latch B1, B7, B8 (3 buttons down) → break B7's diode (a ghost B2) → repair → break the throttle ground (pinned ≈4050) → quiz.

## No-code vs programmable

- **No-code board (BU0836 family):** fixed firmware, plug-and-play, 12-bit axes with filtering, enough inputs for most cockpits. You can't add logic (a shifter's lockout, a combined axis, LEDs).
- **ATmega32U4 (Arduino Leonardo, Pro Micro):** native USB, so a sketch can describe itself as a joystick (e.g. with a joystick library). Its ADC is 10-bit (1024 steps). You write and maintain the code.
- **Teensy:** a faster native-USB board whose core can present a joystick; see the `teensy-41` lesson.

## Cockpit tips

- One three-wire set per pot, wires 24–20 AWG, shielded for long runs, metal pot cases grounded.
- One shared ground between the board, the pots and the buttons. An open ground lead pins an axis.
- Linear-taper (B) pots, and use as much of the pot's travel as the linkage allows: 60° of a 270° pot is only 22 % of the counts.
- Calibrate in the OS game-controller panel after wiring, then set deadzones in the game (or DIView).
- Unplug USB before rewiring the pots.
