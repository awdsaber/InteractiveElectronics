# Load Cell and HX711

*Weighing microvolts*

> A 1 kg bar cell gives 4.3 mV at full load, and the HX711's 24-bit, ×128 front end turns that into about 2 100 counts per gram.

- **Lesson id:** `loadcell-hx711` · **Track:** T6 Sensors
- **fig:** provisional: sidebar order.
- **Prerequisites:** T1 `resistor-codes-divider`, T0 `kirchhoff` (the Wheatstone bridge), `arduino-uno`
- **Power element:** `usb_plug` (powerLabel: "Plug USB")
- **Behaviors:** `hx711`, `mcu-supply`, `serial-plotter`
- **transient:** yes (default with a sketch), `sim.dt` 2.5 ms so each conversion averages 40 (10 SPS) or 5 (80 SPS) solved steps

> **Corrected 2026-11-09.** The draft used a 5 kg cell and 430 counts per gram. The lesson uses a 1 kg bar cell (rated output 1.0 ± 0.15 mV/V, ~1 kΩ bridge, safe overload 120 %), which gives about 2 100 counts per gram. With E+ on AVDD the counts per gram do not depend on AVDD at all: (rated output / capacity) × 128 × 2²⁴.

## Learning goals

1. Explain how a strain gauge and a full Wheatstone bridge turn force into a differential voltage: V_out = V_exc × ΔR/R for a four-active-arm bridge.
2. Use a load cell's rating (mV/V at rated capacity) to predict the full-scale signal.
3. Understand the HX711: a PGA with gain 128 or 64 (channel A) or 32 (channel B), 24-bit two's-complement output, and 10 or 80 samples/s.
4. Calibrate: tare, then a known mass, then a scale factor. Know the error sources: creep, temperature, overload, and non-ratiometric excitation.
5. Wire E+/E−/A+/A− correctly and recognise sign, open-wire and offset errors.

## Datasheet figures (checked)

- **Avia HX711:** full-scale differential input ±0.5 × AVDD / gain (gain 128: ±19.5 mV at AVDD 5 V, ±16.8 mV at 4.3 V); output 24-bit two's complement, 800000h..7FFFFFh; data rate 10 SPS (RATE low) or 80 SPS (RATE high) on the internal oscillator; settling 400 ms / 50 ms (4 conversions); input noise 50 nV rms (gain 128, 10 SPS) and 90 nV rms (80 SPS); supply 2.6–5.5 V, under 1.5 mA, under 1 µA powered down; AVDD = VBG × (R1 + R2)/R2 with VBG 1.25 V (about 4.3 V on many modules: 20 kΩ / 8.2 kΩ).
- **1 kg bar cell (typical):** rated output 1.0 ± 0.15 mV/V; bridge about 1 kΩ; zero balance within about ±0.1 mV/V; safe overload 120 % of capacity, ultimate typically 150 %.
- **Illustrative on this bench (labelled so in the lesson):** this cell's certificate value 0.98 mV/V; zero balance 0.05 mV/V; creep 0.05 % of the load in 30 min; permanent set 0.2 g per gram of peak load beyond 120 %; a 30 mV rms wander on the USB rail.

## Board

Board: `SCALE BENCH`, 12 × 9 PCB, base `mat`; the bar cell sits to the left of the board.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | Clocks the HX711 and turns counts into grams. | `pin2`, `pin3`, `v_usb` |
| hxm | `logic-ic-label` | `smd` | HX711 MODULE | Carrier area of the green breakout. | — |
| u1 | `ic-smd` (SOP-16, Avia HX711) | `smd` | HX711 | PGA plus 24-bit ΔΣ ADC, with an on-chip regulator controller. `facts` from the datasheet. | `i_hx` |
| q1 | `ic-smd` (SOT-23 PNP, S8550-class) | `smd` | AVDD PNP | Pass transistor for the AVDD/excitation regulator. | `avdd_reg` |
| r_div | `resistor-smd` | `smd` | AVDD SET | Feedback divider: AVDD = 1.25 V × (R1 + R2)/R2. | — |
| c_dec | `capacitor-smd` | `smd` | DECOUPLE | | — |
| hdr_cell | `header-male` (E+ E− A− A+ B− B+) | `tht` | CELL | Load cell connections. | `w_exc`, `w_sp`, `w_sn` |
| hdr_mcu | `header-male` (GND DT SCK VCC) | `tht` | MCU | Two-wire serial to the Uno. | — |
| cell | `load-cell` (1 kg bar, 1.0 ± 0.15 mV/V, ~1 kΩ) | `offboard` | LOAD CELL | Four strain gauges in a full bridge. `facts` from a typical datasheet. | `sg1`…`sg4` |
| w_dt, w_sck, w_gnd, w_vcc | `wire` | `offboard` | | Uno pins 3, 2, GND, 5 V to the module. | — |
| w_exc5 | `wire` (hidden) | `offboard` | 5 V → E+ | Shown by the excitation failure. | — |

## Circuit

| id | type | nodes | value / params | notes |
|---|---|---|---|---|
| `v_usb` | V | `usb_raw`, `0` | 5.0 V, rInternal 0.3 Ω | USB supply tweak |
| `v_noise` | V | `usb_vbus`, `usb_raw` | 0 V, driven by `hx711` | the rail's slow wander (railNoiseMv rms) |
| `usb_plug` | SW | `usb_vbus`, `vbus_in` | closed | **Power element** |
| `f1` | R | `vbus_in`, `5v` | 0.3 Ω, maxI 1.0 A | |
| `r_board` | R | `5v`, `0` | 111 Ω | Uno ≈ 45 mA |
| `i_hx` | I | `5v`, `0` | 1.5 mA | HX711 |
| `avdd_reg` | OPAMP | `5v`, `avdd`, `avdd` | vPos 4.3, vNeg 0 | AVDD regulator as a clamped buffer |
| `w_exc` | R | `avdd`, `ep` | 0.01 Ω | red E+ wire |
| `sg1` / `sg4` | R | `ep`–`sp` / `sn`–`em` | 1000 × (1 − s) | compression |
| `sg2` / `sg3` | R | `sp`–`em` / `ep`–`sn` | 1000 × (1 + s) | tension |
| `w_em` | R | `em`, `0` | 0.01 Ω | black E− wire |
| `w_sp` / `w_sn` | R | `sp`–`ap` / `sn`–`an` | 0.01 Ω | green A+ / white A− wires |
| `pin2` / `pin3` | PIN | `d2` / `d3` | | SCK / DT |

s = 0.98 × 10⁻³ × (mass + creep + set) / 1000 g + 0.05 × 10⁻³. Check: 500 g gives V(ap) − V(an) = 4.3 × (0.49 + 0.05) mV/V = **2.32 mV**; 1 kg gives 4.43 mV. Each gauge changes by 0.98 Ω at 1 kg.

### `hx711` behavior

- **Bridge:** each tick it sets the four gauges from the load, so the netlist solves the mV signal.
- **Conversions:** every transient step it reads V(ap) − V(an) and V(avdd), and averages their ratio over each 1/rate s. code = round(ratio × gain × 2²⁴) + datasheet noise, clamped to −2²³…2²³ − 1. The first 4 conversions after power-up, a rate or gain change, or power_up() are discarded.
- **Creep:** first-order (τ 600 s) toward 0.05 % of the load at 30 min; recovers when unloaded.
- **Overload:** the peak load beyond 120 % leaves a permanent set of 0.2 g per gram beyond it; Repair fits a new cell.
- **Library:** `HX711` class and `scale`, after the bogde Arduino library: `begin(dout, sck, gain)`, `is_ready()`, `read()`, `read_average(n)`, `get_value(n)`, `get_units(n)`, `tare(n)`, `set_scale(f)`, `get_scale()`, `set_offset(o)`, `get_offset()`, `set_gain(g)`, `power_down()`, `power_up()`. Calls cannot block on the bench, so `read()` returns the latest conversion and `read_average(n)` averages the last n; the sketch paces itself with `delay()`. `begin()` on the wrong pins never sees data ready.
- **Publishes:** `true_g`, `load_g`, `creep_g`, `set_g`, `dR`, `vdiff_uV`, `avdd_V`, `exc_V`, `raw`, `conversions`, `sps`, `gain`, `down`, `counts_per_g`.

## Sketch

**Title:** Tare and weigh · `calFactor = 2147.0` (the label's nominal), `KNOWN = 500.0`. `setup()` begins on pins 3 (DT) and 2 (SCK), waits 1.5 s, tares 10 readings, prints `offset:`. `loop()` waits 500 ms, then prints `g:` (get_units(5)), `net:` (get_value(5)) and `per_g:` (net / KNOWN).

## Readouts

TRUE MASS (`hx711.true_g`), MEASURED (`serial.g`), BRIDGE OUTPUT (V ap−an), EXCITATION E+ (V ep), RAW CODE (`hx711.raw`), PER GRAM (`serial.per_g`), GAUGE ΔR (`hx711.dR`), TARE OFFSET (`serial.offset`).

## Tweaks

- Mass on pan: enum Empty / 100 g / 200 g / 500 g / 1 kg (`behavior:hx711.massG`)
- Data rate: enum 10 / 80 SPS (`behavior:hx711.rate`)
- USB supply voltage: 4.4–5.25 V

## Failures

1. **Break the green A+ wire** (`remove w_sp`): the open input reads ground on the bench, about −2.15 V against ±16.8 mV, so RAW CODE pins at −8 388 608 (0x800000), MEASURED ≈ −4 000 g, and the load no longer matters. A real open input pins or wanders.
2. **Lean on the pan with 1.4 kg** (`set behavior:hx711.shockG 1400`): 140 % of capacity for 1 s; the empty pan then reads about +40 g until Repair.
3. **Excite the bridge from the noisy 5 V rail** (`remove w_exc`, `add w_exc5 5v–ep`, `railNoiseMv 30`): E+ ≈ 4.97 V against a 4.3 V reference, so readings are about 16 % high (500 g reads about 580 g), drift by grams with the rail, and follow the USB slider (5.0 → 4.6 V: about −8 %). On AVDD the same slider changes nothing.
4. **Swap the A+ and A− wires**: the sign flips; 500 g reads about −600 g after the tare (the flipped zero balance adds 2 × 51 g).

## Guide (8 steps)

Meet the load cell (inspect) → Plug in USB (E+ 4.2–4.4 V) → Upload and tare (TARE OFFSET 90 000–125 000) → Put 500 g on (bridge 2.1–2.55 mV, MEASURED 470–510 g) → Calibrate (edit calFactor to PER GRAM, upload empty, 500 g reads 497–503 g) → Break: overload (empty pan reads 20–100 g) → Repair → Quiz.

## Meet the board, analogy, pro tips, quiz

See `src/lessons/T6/loadcell-hx711.ts`. Quiz: 2 mV/V × 5 V = 10 mV; 0.98 × 10⁻⁶ × 128 × 2²⁴ ≈ 2 104 counts per gram; 200 g on a 1 kΩ, 1 mV/V, 1 kg bridge changes each gauge by 0.2 Ω; excite from AVDD because the range is proportional to AVDD (ratiometric).

## SIM NOTE

- The bridge solves to a few ppm of its signal (a 2.15 mV output is within about 10 nV, 0.002 g). Tests allow ±5 counts.
- Deferred: temperature drift of zero and span, channel B, the 25/26/27-pulse gain protocol on real pins, dragging masses onto a 3D pan.
