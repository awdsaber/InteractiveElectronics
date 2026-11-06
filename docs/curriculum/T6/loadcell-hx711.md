# Load Cell and HX711

*Weighing microvolts*

> A 5 kg bar cell gives just 4.3 mV at full load, and the HX711's 24-bit, ×128 front end turns that into about 430 counts per gram.

- **Lesson id:** `loadcell-hx711` · **Track:** T6 Sensors
- **fig:** 36. Provisional: sidebar order.
- **Prerequisites:** T1 `resistor-codes-divider`, T0 `kirchhoff` (the Wheatstone bridge), `arduino-uno`
- **Power element:** `usb_plug` (powerLabel: "Plug USB")
- **Behaviors:** `hx711`, `mcu-supply`, `serial-plotter`
- **transient:** false

## Learning goals

1. Explain how a strain gauge and a full Wheatstone bridge turn force into a differential voltage: V_out = V_exc × ΔR/R for a four-active-arm bridge.
2. Use a load cell's rating (mV/V at rated capacity) to predict the full-scale signal.
3. Understand the HX711: a PGA with gain 128 or 64 (channel A) or 32 (channel B), 24-bit output, and 10 or 80 samples/s.
4. Calibrate: tare, then a known mass, then a scale factor. Know the error sources: creep, temperature, overload, and non-ratiometric excitation.
5. Wire E+/E−/A+/A− correctly and recognise sign and offset errors.

## Board

Board: `SCALE BENCH`, size 14 × 8, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | Clocks the HX711 and turns counts into grams. | `pin2` |
| hxm | `module` (title "HX711", green 24 × 16 mm breakout) | `module` | HX711 MODULE | Bridge amplifier/ADC carrier. | — |
| u1 | `ic-smd` (SOP-16, Avia HX711) | `smd` | HX711 | Low-noise PGA plus 24-bit ΔΣ ADC, with an on-chip regulator controller for the analog supply. | `i_hx` |
| q1 | `ic-smd` (SOT-23 PNP, S8550-class) | `smd` | AVDD PNP | Pass transistor for the AVDD/excitation regulator. | `avdd_reg` |
| r_div | `resistor-smd` (×2, feedback divider; AVDD = 1.25 V × (R1 + R2)/R2, about 4.3 V on many modules) | `smd` | AVDD SET | Sets the excitation voltage. Measure E+ on yours. | — |
| c_dec | `capacitor-smd` (×3) | `smd` | DECOUPLE | | — |
| hdr_cell | `header-male` (E+ E− A− A+ B− B+) | `tht` | CELL | Load cell connections. | — |
| hdr_mcu | `header-male` (GND DT SCK VCC) | `tht` | MCU | Two-wire serial to the Uno. | — |
| cell | `load-cell` (5 kg aluminium bar, 1.0 ± 0.15 mV/V, ~1 kΩ bridge; representative) | `offboard` | LOAD CELL | Four strain gauges in a full bridge. | `sg1`, `sg2`, `sg3`, `sg4` |
| pan | `module` (title "PAN", bolted to the cell's free end) | `offboard` | PAN | Where the mass goes. | — |

## Circuit

The bridge is modelled at resistor level. The `hx711` behavior sets ΔR on each arm from the applied mass and reads the differential voltage.

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_usb` | V | `usb_vbus`, `0` | 5.0 V, rInternal 0.3 Ω | — | |
| `usb_plug` | SW | `usb_vbus`, `vbus_in` | closed: false | — | **Power element** |
| `f1` | R | `vbus_in`, `5v` | 0.3 Ω | maxI 1.0 A | |
| `i_board` | I | `5v`, `0` | 0.045 A | maxV 6 V | Uno |
| `i_hx` | I | `5v`, `0` | 0.0015 A | maxV 5.5 V | HX711 < 1.5 mA in normal operation (datasheet) |
| `avdd_reg` | OPAMP | `5v`, `avdd`, `avdd` | vPos 4.3, vNeg 0 | — | AVDD regulator model (clamped buffer) |
| `w_exc` | R | `avdd`, `ep` | 0.01 Ω | — | E+ wire |
| `sg1` | R | `ep`, `sp` | 1000 Ω (− ΔR) | — | Gauge in compression |
| `sg2` | R | `sp`, `0` | 1000 Ω (+ ΔR) | — | Gauge in tension |
| `sg3` | R | `ep`, `sn` | 1000 Ω (+ ΔR) | — | |
| `sg4` | R | `sn`, `0` | 1000 Ω (− ΔR) | — | E− is ground |
| `w_sp` | R | `sp`, `ap` | 0.01 Ω | — | S+ to A+ |
| `w_sn` | R | `sn`, `an` | 0.01 Ω | — | S− to A− |
| `pin2` | PIN | `d2`, `0` | pin 2, vcc 5 | — | SCK (output) |
| `pin3` | PIN | `d3`, `0` | pin 3, vcc 5 | — | DT (input; data is handled by the behavior) |

Check: ΔR/R = 0.001 at 5 kg gives V(ap) − V(an) = 4.3 V × 0.001 = **4.3 mV**. Bridge current = 4.3 V / 1 kΩ = 4.3 mA.

### Behaviors

- **`hx711`**. Parameters: `massG` (tweak), `capacityG` 5000, `sensitivity` 0.001 (ΔR/R at capacity, i.e. 1.0 mV/V), `noiseNv` 50 (input-referred rms at gain 128, 10 SPS, from the datasheet), `rate` 10 SPS, `gain` 128, `creepPct` 0.03 % of FS per 30 min (illustrative; check your cell's datasheet), `tempCoPpm` 50 ppm/°C of span (illustrative), and `overloadG` 6000 (120 % of capacity, a typical "safe overload").
  - **Bridge:** each tick it sets sg2/sg3 = 1000 × (1 + s) and sg1/sg4 = 1000 × (1 − s), with s = sensitivity × massEff / capacity. massEff includes creep, a slow first-order rise of up to creepPct while the load stays on.
  - **Overload:** if `massG` > `overloadG`, a permanent offset is added: 0.2 % of FS per 10 % over (illustrative). This is the "bent" cell.
  - **Conversions** every 1/rate s: V_in = V(ap) − V(an) + noise. Full-scale range = ±0.5 × V(avdd) / gain (the datasheet definition, which makes the reading **ratiometric** to AVDD). code = round(V_in / FSR × 2²³), clamped to −2²³…2²³ − 1 (24-bit two's complement). After a gain change or power-up, the first 4 conversions are discarded (settling: 400 ms at 10 SPS).
  - **Library:** exposes `scale`, modelled on the common bogde HX711 Arduino API: `begin(dout, sck)`, `is_ready()`, `read()` (blocks until the next conversion and advances virtual time), `read_average(n)`, `get_value(n)` (= average − offset), `get_units(n)` (= value / scale), `tare(n)`, `set_scale(f)`, `get_scale()`, `set_offset(o)`, `set_gain(g)`, `power_down()` and `power_up()`. `begin` checks that SCK is OUTPUT. If V(5v) < 2.6 V, reads hang until the timeout and return 0.
  - **Publishes:** `true_g`, `vdiff_uV`, `raw`, `counts_per_g` and `avdd_V`.
- **`mcu-supply`**, **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** Tare and weigh · **board:** `uno` · **vcc:** 5

| Pin | HX711 pin | PIN element |
|---|---|---|
| 3 | DT (DOUT) | `pin3` |
| 2 | SCK | `pin2` |

```cpp
#include <HX711.h>
// Real code: HX711 scale;   The bench provides `scale`.

#define DOUT_PIN 3
#define SCK_PIN 2

// Counts per gram. Measure it: tare, put a known mass on,
// divide get_value() by the mass. Predicted for this bench: about 430.
float calFactor = 430.0;
float known = 1000.0;              // grams, for the calibration printout

void setup() {
  Serial.begin(115200);
  scale.begin(DOUT_PIN, SCK_PIN);  // channel A, gain 128 by default
  Serial.println("Remove everything from the pan...");
  delay(2000);
  scale.tare(10);                  // average 10 readings = 1 s at 10 SPS
  scale.set_scale(calFactor);
  Serial.println("Tared. Place masses now.");
}

void loop() {
  float grams = scale.get_units(5);       // 5 readings, about 0.5 s
  long net = scale.get_value(1);          // counts above tare
  Serial.print("g:");
  Serial.print(grams);
  Serial.print(",counts:");
  Serial.print(net);
  Serial.print(",per_g_if_");
  Serial.print(known);
  Serial.print("g:");
  Serial.println(net / known);            // read this with the known mass on
}
```

## Readouts

| label | source | unit |
|---|---|---|
| TRUE MASS | `{kind:'behavior', key:'true_g'}` | g |
| MEASURED | `{kind:'behavior', key:'serial.g'}` | g |
| BRIDGE OUTPUT | `{kind:'voltage', node:'ap', ref:'an'}` | V |
| EXCITATION E+ | `{kind:'voltage', node:'ep'}` | V |
| RAW CODE | `{kind:'behavior', key:'raw'}` | '' |
| BRIDGE CURRENT | `{kind:'current', elementId:'w_exc'}` | A |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Mass on pan | `behavior:hx711` | massG | 0 | 8000 | 1 | no | g |
| USB supply voltage | `v_usb` | value | 4.4 | 5.25 | 0.01 | no | V |
| Data rate | `behavior:hx711` | rate | 10 | 80 | 70 | no | SPS |

At 80 SPS the noise rises to about 90 nV rms (datasheet), roughly 1.8 times worse.

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: 5 readings per result, 0.5 s per update at 10 SPS. |
| readout 0 above 5000 | Above the cell's rated capacity: beyond about 6 kg the cell deforms permanently. |

## Failures

### F1: S+ and S− swapped
- **Patches:** `{op:'remove', elementId:'w_sp'}`, `{op:'remove', elementId:'w_sn'}`, `{op:'add', element:{id:'w_sp_x', type:'R', nodes:['sp','an'], value:0.01}}`, `{op:'add', element:{id:'w_sn_x', type:'R', nodes:['sn','ap'], value:0.01}}`
- **Sim shows:** adding mass makes MEASURED go **negative**: −1000 g for a 1 kg mass.
- **Why:** the bridge output is differential, and swapping its wires flips the sign. Either swap the wires or use a negative scale factor. Colour codes (red E+, black E−, green A+, white A−) are a convention, not a standard. Check the cell's datasheet.

### F2: Overload it with 10 kg
- **Patch:** `{op:'set', elementId:'behavior:hx711', key:'massG', value:10000}`, then the learner removes the mass.
- **Sim shows:** the reading clips during the overload (the input reaches about 8.6 mV, still inside the ±16.8 mV range, but the cell's metal yields). With the pan empty again it reads about **+70 g** that tare must now hide, and the span is no longer linear.
- **Why:** strain gauges sense elastic strain in an aluminium beam. Beyond about 120–150 % of capacity the beam takes a permanent set, so the gauges stay strained. Fit mechanical overload stops on anything that can be dropped onto.

### F3: Excite the bridge from 5 V instead of AVDD
- **Patches:** `{op:'remove', elementId:'w_exc'}`, `{op:'add', element:{id:'w_exc5', type:'R', nodes:['5v','ep'], value:0.01}}`
- **Sim shows:** with 1000 g on, slide the USB voltage from 5.0 to 4.6 V. MEASURED falls by about 8 %, although nothing changed on the pan.
- **Why:** the HX711's range is set by AVDD. When the bridge is excited from the *same* AVDD, a supply change scales both signal and range, and cancels. That is a **ratiometric** measurement. Excite from a different, noisy rail and every wobble of USB voltage becomes "weight".

## Meet the board

A strain gauge's resistance changes with stretch: ΔR/R = GF × strain, with a gauge factor of about 2 for metal foil. A load cell bonds **four** gauges into a full bridge, two in tension and two in compression. Then V_out = V_exc × ΔR/R.

**The signal is tiny.** The cell is rated **1.0 mV/V** at 5 kg. With E+ = 4.3 V, full load gives 4.3 mV. 1 g is 4.3 mV / 5000 = **0.86 µV**.

**The HX711:** gain 128 makes the full-scale input ±0.5 × AVDD / 128 = ±0.5 × 4.3 / 128 = **±16.8 mV**, divided into 2²⁴ codes. One code is 16.8 mV / 2²³ ≈ **2.0 nV**, so 1 g = 0.86 µV / 2.0 nV ≈ **430 counts**.

**Real resolution** is set by noise, not bits: about 50 nV rms at 10 SPS, which is 50 / 860 ≈ **0.06 g** rms. In practice, creep, temperature drift and mechanical mounting limit cheap cells to roughly 0.1–1 g.

**Speed:** 10 SPS by default, or 80 SPS with the RATE pin high. Each reading takes 100 ms, so `get_units(5)` waits half a second.

**Ratiometric:** the ADC's range scales with AVDD, and so does the bridge output, so supply drift cancels. Keep E+ on the module's AVDD.

**Bridge current:** 4.3 V / 1 kΩ = 4.3 mA, trivial for USB.

## For mechanical engineers

> You know this one: a load cell is a machined flexure with foil gauges bonded in the high-strain zones, just like the strain gauges on a test rig. The Wheatstone bridge is the same quarter, half or full bridge from an experimental-mechanics lab, and the HX711 is a cheap, slow bridge amplifier. The temperature compensation you'd design into a lab installation is mostly missing. **Where it breaks:** the datasheet numbers (mV/V, creep, combined error) assume the load goes through the cell's axis. A pan bolted off-centre adds bending and torsion that the bridge only partly rejects. Mechanics, not electronics, sets the accuracy.

## Pro tips

1. Calibrate with a mass near your working range (say 50–100 % of the expected load), and recheck zero after removing it. A zero that doesn't return points to creep, overload or mounting stress.
2. Let the cell and electronics warm up for several minutes, then tare. Zero drift with temperature is usually the largest error on cheap cells.
3. Keep the four cell wires twisted together and away from motor or mains wiring. At 2 nV per code, the electronics will resolve interference you'd never see on a meter.

## Quiz

1. **A 2 mV/V load cell is excited at 5.0 V. What is its full-scale output?**
   - 2 mV
   - 5 mV
   - 10 mV
   - 25 mV
   - **Answer:** 2. *Why:* 2 mV/V × 5 V = 10 mV.

2. **This bench: 4.3 V excitation, 1 mV/V at 5 kg, HX711 at gain 128 (FSR ±16.8 mV, 24-bit). About how many counts per gram?**
   - 4
   - 43
   - 430
   - 4300
   - **Answer:** 2. *Why:* 0.86 µV per gram / (16.8 mV / 2²³ ≈ 2.0 nV per count) ≈ 430.

3. **On a 1 kΩ full bridge rated 1 mV/V at 5 kg, how much does each gauge's resistance change with 1 kg on?**
   - 0.02 Ω
   - 0.2 Ω
   - 1 Ω
   - 2 Ω
   - **Answer:** 1. *Why:* ΔR/R = 0.001 × (1/5) = 0.0002, and 0.0002 × 1000 Ω = 0.2 Ω.

4. **Why should the bridge be excited from the HX711's AVDD rather than a separate 5 V rail?**
   - AVDD supplies more current
   - The ADC's range is proportional to AVDD, so a ratiometric bridge cancels supply changes
   - 5 V would damage the load cell
   - The HX711 needs no excitation
   - **Answer:** 1. *Why:* the reading is proportional to V_bridge / V_range. If both come from AVDD, its drift cancels.

## SIM NOTE

- A nanovolt-level differential through MNA: the 4.3 mV bridge signal at 1 g resolution (0.86 µV) needs node voltages good to about 1e-9 V. The solver's 1e-6 tolerance is a *convergence* tolerance on a linear circuit, so the bridge solves exactly, but check that gmin (1e-12 S) doesn't bias the 1 kΩ nodes measurably (it shouldn't: about 1 nV).
- Pre-instantiated `scale` object (same as `pca9685-servo`'s `pwm`).
- Behavior-param tweaks: `massG` (ideally by dragging weights onto the 3D pan), and `rate` as a two-value toggle.
- Overload "memory": the behavior keeps state across "Repair all". Repair should reset the behavior state too.
