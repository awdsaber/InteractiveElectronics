# ADC, DAC and PWM

*Between analog and digital*

> A 10-bit ADC splits 5 V into 1024 steps of 4.9 mV, and analogWrite(9, 128) averages to 2.51 V behind a 10 kΩ / 10 µF filter.

- **Lesson id:** `adc-dac-pwm` · **Track:** T3 Digital
- **Prerequisites:** `arduino-uno` (Start here), `resistor-codes-divider`, `capacitor-rc`, `opamp-basics`
- **Power element:** `V_USB` (powerLabel: "Plug USB")
- **Sketch:** yes
- **Transient:** yes

## Learning goals

1. Convert between voltage and ADC code: code = V_in·1024/V_ref, an LSB of 4.88 mV at 5 V.
2. Explain PWM: average voltage = duty × V_CC, and the Uno's PWM frequencies (≈ 490 Hz on pin 9).
3. Design an RC low-pass that turns PWM into a DC level, and estimate the ripple-versus-response trade-off.
4. Recognise when a DAC output needs a buffer, and know the alternatives (R-2R ladder, I²C DAC such as the MCP4725).

## Board

Board: `ADC-25`, size 18 × 11, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (title "UNO") | `module` | UNO | Reads A0, writes PWM on pin 9. | `PIN9` |
| usb | `usb-b` | `tht` | USB | Power and Serial. | `V_USB` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the filter and knob. | — |
| pot | `potentiometer` (10 kΩ linear) | `tht` | KNOB | Wiper gives 0–5 V into A0. | `V_WIPER`, `R_ADC` |
| rf | `resistor` (10 kΩ) | `tht` | FILTER | Series element of the PWM low-pass. | `R_F` |
| cf | `capacitor-electrolytic` (10 µF, 16 V) | `tht` | SMOOTH | Shunt element; averages the pulses. | `C_F` |
| rl | `resistor` (1 kΩ) + `switch-slide` | `tht` | LOAD | Optional heavy load on the filter output. | `R_LOAD`, `SW_LOAD` |
| dmm | `multimeter` | `offboard` | METER | Reads the filtered DC. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_USB` | V | `usb5v`, `0` | 5.0 V, rInternal 0.1 Ω | — | **power element** |
| `V_WIPER` | V | `wiper`, `0` | 2.5 V (tweak = knob position), rInternal 2.5 kΩ | — | Thévenin model of the 10 kΩ pot at mid travel (see SIM NOTE) |
| `R_ADC` | R | `wiper`, `0` | 100 MΩ | — | ATmega328P analog input resistance (typ.) |
| `PIN9` | PIN | `p9`, `0` | pin 9, vcc 5, rOut 25 Ω | maxI 0.04 A | PWM averaged by the engine |
| `R_F` | R | `p9`, `f` | 10 kΩ | maxP 0.25 W | |
| `C_F` | C | `f`, `0` | 10 µF | maxV 16 V | |
| `SW_LOAD` | SW | `f`, `ld` | closed: false | — | |
| `R_LOAD` | R | `ld`, `0` | 1 kΩ | maxP 0.25 W | |

Expected with the knob at 2.50 V: analogRead → 512; duty 128/255 → average 2.51 V at `f`; τ = 0.1 s; f_c = 1.6 Hz; real ripple ≈ 25 mV p-p at 490 Hz.

## Sketch

```cpp
// Read a knob on A0, mirror it as PWM on pin 9
const int KNOB = A0;
const int OUT_PIN = 9;

void setup() {
  pinMode(OUT_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(KNOB);      // 0..1023
  int duty = raw / 4;              // 0..255
  analogWrite(OUT_PIN, duty);
  float volts = raw * 5.0 / 1024.0;
  Serial.print("A0 = ");
  Serial.print(raw);
  Serial.print(" (");
  Serial.print(volts);
  Serial.print(" V) -> duty ");
  Serial.println(duty);
  delay(200);
}
```

`pins: {9: 'PIN9'}`, `analogPins: {A0: 'wiper'}`, `vcc: 5`, `board: 'uno'`.

## Readouts

| label | source | unit |
|---|---|---|
| A0 | `{kind:'voltage', node:'wiper'}` | V |
| PIN 9 (avg) | `{kind:'voltage', node:'p9'}` | V |
| FILTERED | `{kind:'voltage', node:'f'}` | V |
| LOAD CURRENT | `{kind:'current', elementId:'R_LOAD'}` | A |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Knob position | `V_WIPER` | value | 0 | 5 | 0.01 | no | V |
| Filter capacitor | `C_F` | value | 0.0000001 | 0.001 | — | yes | F |
| Filter resistor | `R_F` | value | 1000 | 100000 | — | yes | Ω |

Turn the knob slowly. The Serial monitor counts in 4.9 mV steps while FILTERED follows about 0.1 s behind.

## Failures

### F1: Drive a 1 kΩ load straight from the filter
- **Patch:** `{op:'set', elementId:'SW_LOAD', key:'closed', value:true}`
- **Sim shows:** FILTERED drops from 2.51 V to ≈ 0.23 V.
- **Why:** the filter is a 2.51 V source behind 10 kΩ, so the load forms a divider: 2.51 × 1k/11k ≈ 0.23 V. A PWM-RC "DAC" needs an op-amp follower (`opamp-basics`) before any real load.

### F2: Fit a 1000 µF smoothing capacitor
- **Patch:** `{op:'set', elementId:'C_F', key:'value', value:0.001}`
- **Sim shows:** turn the knob and FILTERED takes about 30 s to settle (τ = 10 s).
- **Why:** a bigger RC means less ripple but a slower response. The filter can't tell a slow knob change from PWM ripple. It only knows "fast" and "slow".

### F3: Remove the filter capacitor
- **Patch:** `{op:'remove', elementId:'C_F'}`
- **Sim shows:** FILTERED still averages ≈ 2.51 V on the readout (a meter averages), but the scope shows the raw 490 Hz, 0 to 5 V square wave and the ripple readout (`ac-meter` vpp) reads ≈ 5 V. The engine now switches PWM at its real edges (see SIM NOTE).
- **Why:** nothing averages the pulses. A scope, an ADC or a sensitive analog input sees full-height pulses.

## Meet the board

**ADC (analog → digital).** The Uno's 10-bit converter compares the input to V_ref (5 V by default) and returns

code = V_in × 1024 / V_ref (clipped to 0–1023), so 1 LSB = 5/1024 = **4.88 mV**

At 2.50 V: 2.50 × 1024/5 = **512**. (The simulator uses round(V/5 × 1023), which gives the same code here.)

Accuracy: the ATmega328P datasheet gives about ±2 LSB absolute accuracy (200 kHz ADC clock), and quantization alone is ±½ LSB. With `analogReference(INTERNAL)` the reference is 1.1 V nominal (1.0 to 1.2 V part to part), so 1 LSB ≈ 1.07 mV. Anything above the reference reads 1023.

The ADC samples through a small internal capacitor, so the datasheet asks for a source impedance of about 10 kΩ or less. A 10 kΩ pot is at most 2.5 kΩ, so it's fine.

**PWM (digital → "analog").** `analogWrite(9, d)` switches pin 9 at about 490 Hz (pins 5 and 6 run at about 980 Hz), staying high for d/255 of each period. The average is

V_avg = (d/255) × 5 V = (128/255) × 5 = **2.51 V**

**Filtering.** R_F·C_F = 10 kΩ × 10 µF = **0.1 s**, so f_c = 1/(2π × 0.1) ≈ **1.6 Hz**, about 300× below the PWM frequency. The ripple is roughly

ΔV ≈ V_CC·D(1 − D)/(f·RC) = 5 × 0.25/(490 × 0.1) ≈ **25 mV p-p**

**True DACs.** An R-2R resistor ladder on several pins gives instant steps. An I²C DAC such as the MCP4725 (12-bit) gives a clean, buffered voltage without ripple.

## For mechanical engineers

> PWM is exactly how proportional hydraulics often drive a solenoid valve. You pulse it on and off, and the system's own lag (spool mass, an accumulator) averages the pulses into a steady force. The RC filter is that accumulator. The ADC is a gauge with tick marks every 4.9 mV: readings snap to the nearest mark. **Where it breaks:** a valve's response limits hydraulic PWM to tens or hundreds of hertz, while electronics can PWM at tens of kHz. And the RC filter is perfectly linear, so its ripple and lag can be calculated exactly.

## Pro tips

1. Put a 100 nF capacitor at the ADC pin for any source above a few kΩ or with long wires. It feeds the sample-and-hold and kills noise.
2. ADC accuracy is only as good as V_ref. USB 5 V can sit anywhere from 4.75 V to 5.25 V, so for measurement use the internal 1.1 V reference (`analogReference(INTERNAL)`) or an external precision reference.
3. LEDs, motors and heaters don't need filtering, because their own physics averages PWM. Filter only when something downstream truly needs a DC voltage. For audio or precise voltages, use a real DAC.

## Quiz

1. **analogRead returns 300 with a 5 V reference. What is the input voltage?**
   - 0.30 V
   - 1.50 V
   - 3.00 V
   - 1.46 V
   - **Answer:** 3. *Why:* V = 300 × 5/1024 = 1.46 V.

2. **What average voltage does analogWrite(9, 64) give on a 5 V Uno?**
   - 1.25 V
   - 0.64 V
   - 2.50 V
   - 3.20 V
   - **Answer:** 0. *Why:* 64/255 × 5 = 1.25 V.

3. **What is the cutoff frequency of a 4.7 kΩ / 1 µF RC low-pass?**
   - 3.4 Hz
   - 213 Hz
   - 33.9 Hz
   - 4.7 kHz
   - **Answer:** 2. *Why:* f_c = 1/(2π × 4700 × 10⁻⁶) = 33.9 Hz.

4. **Why does the filtered PWM voltage collapse when a 1 kΩ load is attached?**
   - The PWM frequency changes
   - The filter's 10 kΩ output resistance and the load form a divider, so it needs a buffer
   - The capacitor discharges permanently
   - The ADC is overloaded
   - **Answer:** 1. *Why:* an RC filter has a high source impedance (R_F), and a follower op-amp fixes it.

## SIM NOTE

- **True PWM switching (done):** a `PIN` with `vccNode` is switched at its real frequency (490 Hz for Uno pin 9, 980 Hz for pins 5 and 6) with edge-cut steps (`sim/pwm.ts`), so F3 and the ripple are shown; the scope and `ac-meter` read them.
- **Potentiometer element:** there is no 3-terminal pot. The wiper is modelled as a Thévenin source (`V_WIPER` + 2.5 kΩ). A `POT` element (nodes: end1, wiper, end2; params: r, position 0–1, tweakable `position`) would be faithful, including the source-impedance change with position.
- **ADC formula:** spec §5 uses round(V/V_CC × 1023), but the ATmega328P datasheet defines code = V_in·1024/V_ref (floored). The difference is ≤ 1 LSB. Consider matching the datasheet.
- **Input-pin overvoltage:** there is no rating for an analog input above V_CC + 0.5 V (absolute maximum). An optional `maxV` on analog-pin nodes would enable a "feed A0 from 9 V" failure later.
