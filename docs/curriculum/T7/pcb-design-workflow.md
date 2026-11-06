# PCB Design Workflow

*Schematic to factory*

> A 1 A trace on outer-layer 1 oz copper needs about 0.30 mm for a 10 °C rise (IPC-2221), and a USB-C sink that forgets its two 5.1 kΩ CC resistors gets 0 V from a C-to-C charger.

- **Lesson id:** `pcb-design-workflow` · **Track:** T7 Professional
- **fig:** 41. Provisional: sidebar order.
- **Prerequisites:** `arduino-uno`, `power-grounding-emc`, `thermal-design`
- **Power element:** `plug` (powerLabel: "Plug USB-C")
- **Behaviors:** `usbc-source`, `pcb-tour`, `mcu-supply`, `serial-plotter`
- **transient:** true

## Learning goals

1. Walk through the professional flow: schematic and ERC, footprints, stack-up and outline, placement, routing, pours, DRC, then fabrication outputs (Gerber, drill, BOM, pick-and-place) and assembly.
2. Size power traces with IPC-2221 and place decoupling capacitors correctly.
3. Design a correct USB-C power sink (Rd = 5.1 kΩ on each CC) and protect it (polyfuse).
4. Apply DFM rules: the fab's minimum trace and space, drill and annular ring, solder-mask dams, paste apertures, fiducials and polarity marks.
5. Bring up a new board safely: current-limited first power, rail checks, then firmware.

## Board

Board: `ATELIER MINI rev A`, size 5 × 3 (50 × 30 mm), 2-layer, 1.6 mm FR-4, 1 oz copper, base `mat`. It is a minimal ATmega328P board at 3.3 V / 8 MHz, the course's own design (similar in spirit to a 3.3 V Pro Mini).

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| j1 | `usb-c` (16-pin USB 2.0 receptacle, power + data) | `smd` | USB-C | 5 V in. CC1/CC2 tell a USB-C source "a sink is here". | `plug`, `vbus_en` |
| r_cc1, r_cc2 | `resistor-smd` (5.1 kΩ 1 %, 0402) | `smd` | CC 5k1 | Rd pull-downs, **one per CC pin**. Without them a C-to-C source won't turn on VBUS. | `r_cc1`, `r_cc2` |
| f1 | `fuse` (1206 PTC, 0.5 A hold / 1.0 A trip, MF-MSMF050-class) | `smd` | F1 500mA | Protects the host and the board from shorts. | `f1` |
| u2 | `ic-smd` (SOT-23, Microchip MCP1700T-3302E/TT) | `smd` | 3V3 LDO | 250 mA LDO, 1.6 µA quiescent current, 178 mV typical dropout at 250 mA. Pinout: 1 GND, 2 VOUT, 3 VIN. | `ldo` |
| c_in, c_out | `capacitor-smd` (1 µF X7R, 0603) | `smd` | 1µF ×2 | Required by the MCP1700 for stability: at least 1 µF ceramic on the output. | `c_in`, `c_out` |
| u1 | `ic-smd` (TQFP-32, ATmega328P-AU) | `smd` | MCU | Same core as the Uno, at 3.3 V. The speed grade allows about 13 MHz at 3.3 V, so it runs at 8 MHz. | `pin13`, `i_mcu` |
| y1 | `crystal` (8 MHz, 3225 SMD) | `smd` | 8 MHZ | MCU clock. | — |
| c_y1, c_y2 | `capacitor-smd` (22 pF C0G) | `smd` | 22p ×2 | Crystal load capacitors (choose them from the crystal's CL). | — |
| c_dec1–3 | `capacitor-smd` (100 nF X7R, 0402) | `smd` | 100n ×3 | VCC, AVCC and AREF decoupling, each within about 2 mm of its pin. | `c_dec` |
| r_rst | `resistor-smd` (10 kΩ) | `smd` | RST PULL-UP | Holds RESET high. | — |
| sw_rst | `button` (SMD tactile) | `smd` | RESET | | — |
| r_led | `resistor-smd` (330 Ω, 0402) | `smd` | 330 Ω | Status-LED limit. | `r_led` |
| d_led | `led-smd` (red, 0603) | `smd` | LED D13 | Bring-up blink. | `led` |
| j_isp | `header-male` (2 × 3, 2.54 mm) | `tht` | ISP | Burns the bootloader or flashes directly. | — |
| j_ftdi | `header-male` (1 × 6) | `tht` | FTDI | Serial and auto-reset (DTR through 100 nF). | — |
| tp1–tp3 | `testpoint` | `smd` | TP 3V3 · TP GND · TP D13 | Probe points for bring-up and production test. | — |
| fid1–fid2 | `logic-ic-label` (1 mm copper fiducials) | `smd` | FIDUCIAL | Pick-and-place camera alignment marks. | — |
| silk | `logic-ic-label` (silkscreen: pin 1 dots, LED polarity, rev and date) | `smd` | SILK | Assembly and debug markings. | — |

## Circuit

The source side (charger) and the board's power path. The USB-C source only switches VBUS on after it sees a valid Rd on CC.

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_src` | V | `src5`, `0` | 5.0 V, rInternal 0.1 Ω | — | USB-C charger |
| `plug` | SW | `src5`, `src_p` | closed: false | — | **Power element**: cable inserted |
| `rp1` | R | `src_p`, `cc1` | 56 kΩ | — | Source Rp for "Default USB Power" (56 kΩ to 5 V) |
| `r_cc1` | R | `cc1`, `0` | 5.1 kΩ | — | Rd on the board |
| `r_cc2` | R | `cc2`, `0` | 5.1 kΩ | — | Rd on the other CC (used when the plug is flipped) |
| `vbus_en` | SW | `src_p`, `vbus` | set by `usbc-source` | — | Source's VBUS switch |
| `f1` | R | `vbus`, `v5` | 0.25 Ω | maxI 1.0 A | PTC (SIM NOTE: resettable) |
| `c_in` | C | `v5`, `0` | 1 µF | maxV 25 V | |
| `ldo` | OPAMP | `v5`, `v33`, `v33` | vPos 3.3, vNeg 0 | — | MCP1700 model (clamped buffer, no dropout) |
| `c_out` | C | `v33`, `0` | 1 µF | maxV 25 V | |
| `c_dec` | C | `v33`, `0` | 300 nF | — | 3 × 100 nF |
| `i_mcu` | I | `v33`, `0` | 0.004 A | maxV 6 V | 328P at 8 MHz / 3.3 V, a few mA (approximate) |
| `pin13` | PIN | `d13`, `0` | pin 13, vcc 3.3 | — | PB5 |
| `r_led` | R | `d13`, `led_a` | 330 Ω | — | |
| `led` | LED | `led_a`, `0` | red | maxI 0.02 A, maxV 5 V | (3.3 − 1.8)/(330 + 25) ≈ 4.2 mA |

Expected: CC1 = 5 × 5.1/(56 + 5.1) ≈ **0.42 V**, inside the 0.25–0.61 V window that a sink at Default USB Power presents.

### Behaviors

- **`usbc-source`**. Each tick, with `plug` closed, it reads V(cc1); or V(cc2) if the behavior param `flipped` is true, in which case `rp1` is re-pointed by swapping which CC node the source sees (SIM NOTE). If 0.2 V < V(cc) < 2.6 V (Rd detected), it closes `vbus_en` after a 100 ms debounce. Otherwise it keeps VBUS off. Publishes `cc_V`, `vbus_on` and `attach_state`. With param `cable:'A-to-C'` it ignores CC and keeps VBUS on always, as a legacy USB-A port does.
- **`pcb-tour`**. Drives a guided **layer tour** of the 3D board (SIM NOTE: new bench mode). The steps are:
  1. Schematic overlay (nets as coloured wires over parts).
  2. Footprints and courtyards.
  3. Placement (decoupling capacitors highlighted with their distance to the pin).
  4. Top copper, then bottom copper with the ground pour.
  5. Vias and drill.
  6. Solder mask openings.
  7. Paste layer.
  8. Silkscreen.
  9. A DRC report with clickable callouts: an example 0.12 mm gap flagged against a 0.15 mm rule, a 0.25 mm annular ring OK, and a missing mask dam between TQFP pins.
  10. Fabrication outputs (Gerber X2, Excellon, BOM, CPL).

  Steps 1–10 map onto the bench actions: "Strip to bare PCB" shows the fabricated board, "Pick & place SMD" is assembly from the CPL file, and "Solder joints" is the THT pass. Publishes `tour_step`.
- **`mcu-supply`**: `supplyNode` = `v33`, minimum 1.8 V, and a speed check: 8 MHz needs ≥ 2.7 V. **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** Bring-up test · **board:** `generic` · **vcc:** 3.3

| Pin | Use | PIN element |
|---|---|---|
| 13 (PB5) | Status LED | `pin13` |

```cpp
// First firmware on a new board: prove the clock, the pin, and the serial link.
#define LED 13
const unsigned long BAUD = 38400;   // a common choice at 8 MHz (low baud error)

int blinkCount = 0;

void blinkCode(int n) {             // n short blinks, then a pause
  for (int i = 0; i < n; i++) {
    digitalWrite(LED, HIGH);
    delay(150);
    digitalWrite(LED, LOW);
    delay(150);
  }
  delay(700);
}

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(BAUD);
  Serial.println("ATELIER MINI rev A bring-up");
  Serial.println("1: clock ok if this text is readable");
  Serial.print("2: millis after setup = ");
  Serial.println(millis());
}

void loop() {
  blinkCode(3);                     // 3 blinks = alive
  blinkCount++;
  Serial.print("alive:");
  Serial.println(blinkCount);       // each count ~1.6 s: check with a stopwatch
}
```

## Readouts

| label | source | unit |
|---|---|---|
| CC1 VOLTAGE | `{kind:'voltage', node:'cc1'}` | V |
| VBUS | `{kind:'voltage', node:'v5'}` | V |
| 3V3 RAIL | `{kind:'voltage', node:'v33'}` | V |
| BOARD CURRENT | `{kind:'current', elementId:'f1'}` | A |
| LED CURRENT | `{kind:'current', elementId:'led'}` | A |
| TOUR STEP | `{kind:'behavior', key:'tour_step'}` | '' |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Tour step | `behavior:pcb-tour` | step | 1 | 10 | 1 | no | — |
| Cable type (0 = C-to-C, 1 = A-to-C) | `behavior:usbc-source` | cable | 0 | 1 | 1 | no | — |
| Plug flipped | `behavior:usbc-source` | flipped | 0 | 1 | 1 | no | — |
| LED resistor | `r_led` | value | 100 | 2200 | — | yes | Ω |

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: 3 blinks every 1.6 s and a serial counter. The board is alive. |
| readout 1 below 1 | No VBUS: the source didn't see a sink. Check the CC resistors. |

## Failures

### F1: Forgot the CC resistors
- **Patches:** `{op:'remove', elementId:'r_cc1'}`, `{op:'remove', elementId:'r_cc2'}`
- **Sim shows:** with a C-to-C cable, CC1 floats up to about 5 V through Rp. The source never enables VBUS, so the board is dead: 0 V. Switch the tweak to an A-to-C cable and it works, which is why this bug passes testing at the desk and fails in the field.
- **Why:** a USB-C source must not drive VBUS until it detects a sink through Rd (5.1 kΩ to GND on CC). A legacy A-to-C cable has its own pull-up and the A port's VBUS is always on, so it hides the mistake. Fit **two** separate 5.1 kΩ resistors, one per CC pin, so the plug works both ways.

### F2: Solder bridge from PB5 to the neighbouring GND pin
- **Patch:** `{op:'short', a:'d13', b:'0'}`
- **Sim shows:** pin 13 tries to source 3.3 V / 25 Ω ≈ 130 mA, above the 40 mA maximum, so the pin is dead after 300 ms. The LED never lights.
- **Why:** on a 0.8 mm-pitch TQFP, too much paste or a missing solder-mask dam between pads leaves bridges. DFM rule: keep mask dams of at least the fab's minimum (often around 0.1 mm), shrink paste apertures on fine pitch, and inspect under magnification before first power.

### F3: LED footprint drawn backwards
- **Patches:** `{op:'remove', elementId:'led'}`, `{op:'add', element:{id:'led_rev', type:'LED', nodes:['0','led_a'], color:'red'}}`
- **Sim shows:** the LED never lights. Pin 13 toggles correctly on the scope (3.3 V reverse bias is within the LED's 5 V rating, so there is no damage).
- **Why:** a footprint library that marks the cathode on the wrong pad, or silkscreen that disagrees with the part's marking, ships hundreds of boards with dark LEDs. Check polarity marks against the *datasheet* drawing, not just the library.

## Meet the board

A PCB is designed in stages, each with its own check.

1. **Schematic + ERC:** every pin connected or marked no-connect, and power flags in place.
2. **Footprints:** chosen against the datasheet's land pattern. Check pinouts: the MCP1700 in SOT-23 is GND, VOUT, VIN, which differs from many other LDOs.
3. **Placement:** connectors at the edges, decoupling capacitors next to their pins, and the crystal right beside the MCU.
4. **Routing:** power first. IPC-2221 for outer layers is I = 0.048 × ΔT^0.44 × A^0.725 (A in mil²). For 1 A and ΔT = 10 °C: A ≈ 16 mil², which is 16 / 1.378 ≈ 12 mil ≈ **0.30 mm** wide in 1 oz copper. Signals can use the fab's minimum, often 0.15 mm.
5. **Ground pour** on the bottom, stitched with vias.
6. **DRC** with the fab's rules (trace/space, drill, annular ring, mask dams).
7. **Outputs:** Gerbers, drill file, BOM, and CPL (pick-and-place centroids). Fiducials let the assembly machine find the board.

**USB-C sink:** 5.1 kΩ on each CC pin. With the source's 56 kΩ Rp, CC = 5 × 5.1/61.1 = **0.42 V**, read as "a sink, default power".

**Clock choice:** the 328P's speed grade allows about 10 MHz at 2.7 V, rising linearly to 20 MHz at 4.5 V. At 3.3 V that is about **13.3 MHz**, so the board uses 8 MHz.

**Bring-up:** first power through a current-limited bench supply at about 100 mA. Check 5 V, then 3.3 V, then flash the firmware.

## For mechanical engineers

> PCB design follows the same path as your part design: schematic = assembly concept, footprints = standard parts from a library, layout = detailed design, DRC = drawing check, Gerbers + drill = released manufacturing drawings, BOM + CPL = the assembly routing sheet. DFM rules are the fab's equivalent of "minimum wall thickness" and "standard drill sizes". Fiducials are datum features. **Where it breaks:** copper has no tolerance stack in the usual sense, but it has electrical "tolerances" (current, impedance, loop area) that no visual check reveals. A layout can be dimensionally perfect and electrically wrong.

## Pro tips

1. Download your fab's DRC rule file and design to it from the start, not after routing. Retrofitting 0.15 mm clearances into a dense board costs days.
2. Put test points on every rail and key signal, and label them in silkscreen. Probing a 0402 pad with a scope tip during bring-up is how solder pads get lifted.
3. Order 5 boards of rev A and assemble one stage at a time (power, then MCU, then peripherals), measuring between stages. A fully stuffed first board hides which stage is broken.

## Quiz

1. **The source has Rp = 56 kΩ to 5 V and the sink Rd = 5.1 kΩ. What is the CC voltage?**
   - 0.09 V
   - 0.42 V
   - 2.5 V
   - 4.6 V
   - **Answer:** 1. *Why:* 5 × 5.1/(56 + 5.1) ≈ 0.42 V.

2. **By IPC-2221 (outer layer, 1 oz, ΔT = 10 °C), roughly how wide should a 1 A trace be?**
   - 0.05 mm
   - 0.30 mm
   - 1.5 mm
   - 5 mm
   - **Answer:** 1. *Why:* A = (1 / (0.048 × 10^0.44))^(1/0.725) ≈ 16 mil², and 16 / 1.378 ≈ 12 mil ≈ 0.30 mm.

3. **The ATmega328P is rated 10 MHz at 2.7 V and 20 MHz at 4.5 V, linear between. What is the maximum clock at 3.3 V?**
   - 8 MHz
   - 10 MHz
   - 13.3 MHz
   - 16 MHz
   - **Answer:** 2. *Why:* 10 + (3.3 − 2.7)/(4.5 − 2.7) × 10 = 13.3 MHz, so 8 MHz is chosen with margin.

4. **Red LED (1.8 V), 330 Ω, a 3.3 V pin with 25 Ω output resistance. What current flows?**
   - 1.5 mA
   - 4.2 mA
   - 10 mA
   - 45 mA
   - **Answer:** 1. *Why:* (3.3 − 1.8)/(330 + 25) ≈ 4.2 mA.

## SIM NOTE

- **Guided layer-tour bench mode** (`pcb-tour`): 3D layer toggles (copper top/bottom, mask, paste, silk, drill), net-highlight overlays and DRC callouts. These are new rendering capabilities, beyond `traces` polylines.
- PartKind gaps: no SOT-23 or 0402/0603 size parameter (the lesson uses `ic-smd`/`resistor-smd` with `params.package`), no mounting-hole or fiducial kind (`logic-ic-label` is a stand-in), and no TQFP pin-pitch detail.
- `usbc-source` needs to read node voltages and switch an element, which is already covered. "Flipped plug" would ideally re-route `rp1` to `cc2`, a node change that patches can't express. Model it with two Rp resistors and switches instead.
- Resettable PTC (shared with `arduino-uno`).
- Board `generic` at 3.3 V / 8 MHz: `millis` and `Serial` baud are clock-independent in the virtual MCU, which is fine. Note the real 8 MHz baud-error table in the copy only.
