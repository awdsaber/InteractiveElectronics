# NTC Thermistor

*Resistance that feels heat*

> A 10 kΩ NTC drops to 3.56 kΩ at 50 °C. With a 10 kΩ divider on an Uno, that is about 11 ADC counts per kelvin near room temperature.

- **Lesson id:** `thermistor` · **Track:** T6 Sensors
- **fig:** 37. Provisional: sidebar order.
- **Prerequisites:** T1 `resistor-codes-divider`, `arduino-uno`
- **Power element:** `usb_plug` (powerLabel: "Plug USB")
- **Behaviors:** `ntc`, `mcu-supply`, `serial-plotter`
- **transient:** true (filter capacitor; thermal lag)

## Learning goals

1. Describe an NTC thermistor's exponential R–T curve and its datasheet parameters: R25 and B25/85.
2. Use the Beta equation, 1/T = 1/T₀ + ln(R/R₀)/B, and know where it loses accuracy (outside the B-value's temperature span). Know that Steinhart–Hart is the more precise alternative.
3. Design a divider: choose the fixed resistor for best sensitivity at the temperature you care about.
4. Estimate self-heating from the dissipation constant.
5. Detect sensor faults (open or short) from impossible ADC readings.

## Board

Board: `THERMO BENCH`, size 12 × 7, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | Reads the divider on A0 and computes temperature. | `pin9` |
| bb | `breadboard` | `offboard` | BREADBOARD | | — |
| ntc | `thermistor` (Vishay NTCLE100E3103JB0: R25 = 10 kΩ ±5 %, B25/85 = 3977 K ±0.75 %) | `offboard` | NTC 10k | Its resistance falls about 4.5 % per kelvin near 25 °C. | `ntc` |
| r_fix | `resistor` (10 kΩ 1 % metal film) | `offboard` | R FIXED | Upper leg of the divider. Its tolerance goes straight into the temperature error. | `r_fix` |
| c_f | `capacitor-ceramic` (100 nF) | `offboard` | FILTER | Gives the ADC's sample capacitor a low-impedance source and filters noise. | `c_f` |
| cup | `module` (title "WATER BATH", a cup with a reference thermometer) | `offboard` | BATH | Sets the true temperature (tweak). | — |
| r_led, led | `resistor` (220 Ω), `led` (red) | `offboard` | HOT LED | Lights above 40 °C. | `r_led`, `led_hot` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_usb` | V | `usb_vbus`, `0` | 5.0 V, rInternal 0.3 Ω | — | |
| `usb_plug` | SW | `usb_vbus`, `vbus_in` | closed: false | — | **Power element** |
| `f1` | R | `vbus_in`, `5v` | 0.3 Ω | maxI 1.0 A | |
| `i_board` | I | `5v`, `0` | 0.045 A | maxV 6 V | Uno |
| `r_fix` | R | `5v`, `a0` | 10 kΩ | maxP 0.25 W | |
| `ntc` | R | `a0`, `0` | set by behavior (10 kΩ at 25 °C) | maxP 0.5 W | NTCLE100 rated power 500 mW at 25 °C |
| `c_f` | C | `a0`, `0` | 100 nF | maxV 50 V | |
| `pin9` | PIN | `d9`, `0` | pin 9, vcc 5 | — | HOT LED |
| `r_led` | R | `d9`, `led_a` | 220 Ω | maxP 0.25 W | |
| `led_hot` | LED | `led_a`, `0` | red | maxI 0.03 A | |

### Behaviors

- **`ntc`**. Parameters: `bathC` 25 (tweak), `r25` 10 000, `bTrue` 3977 (the *actual* part's B; a patch can change it), `delta` 0.007 W/K (dissipation constant in still air, about 7 mW/K for this leaded disc, approximate; still water is several times higher), and `tau` 10 s (thermal time constant in stirred water, illustrative; the datasheet gives the value in air, which is much longer).
  - Each tick: P_self = `power['ntc']` from the solution. The thermistor temperature relaxes toward T_target = bathC + P_self/δ with time constant τ.
  - R = r25 × exp(bTrue × (1/T − 1/298.15)), with T in kelvin. It calls `setParam('ntc','value',R)`.
  - The Beta model is used across the whole range. SIM NOTE: the real part follows its R/T table, which differs by fractions of a kelvin outside 25–85 °C.
  - **Publishes:** `bath_C`, `ntc_C`, `ntc_ohm`, `self_heat_K` and `p_self_mW`.
- **`mcu-supply`**, **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** Beta-equation thermometer · **board:** `uno` · **vcc:** 5

| Pin | Use | PIN element / node |
|---|---|---|
| A0 | Divider midpoint | analogPins `A0 → a0` |
| 9 | HOT LED | `pin9` |

```cpp
const float R_FIXED = 10000.0;   // ohms, top of the divider
const float R25     = 10000.0;   // NTC resistance at 25 C
const float BETA    = 3977.0;    // B25/85 from the datasheet
const float T25     = 298.15;    // 25 C in kelvin
const int   HOT_LED = 9;

float readTempC() {
  long sum = 0;
  for (int i = 0; i < 16; i++) {          // average 16 samples
    sum += analogRead(A0);
    delay(2);
  }
  float raw = sum / 16.0;
  if (raw < 2.0 || raw > 1021.0) {
    return -999.0;                         // short or open: not a temperature
  }
  float r = R_FIXED * raw / (1023.0 - raw);    // NTC is the bottom leg
  float invT = 1.0 / T25 + log(r / R25) / BETA;
  return 1.0 / invT - 273.15;
}

void setup() {
  pinMode(HOT_LED, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  float t = readTempC();
  if (t < -100.0) {
    Serial.println("sensor fault");
    digitalWrite(HOT_LED, LOW);
  } else {
    Serial.print("tempC:");
    Serial.println(t);
    if (t > 40.0) {
      digitalWrite(HOT_LED, HIGH);
    } else {
      digitalWrite(HOT_LED, LOW);
    }
  }
  delay(500);
}
```

## Readouts

| label | source | unit |
|---|---|---|
| BATH (TRUE) | `{kind:'behavior', key:'bath_C'}` | °C |
| MEASURED | `{kind:'behavior', key:'serial.tempC'}` | °C |
| NTC RESISTANCE | `{kind:'behavior', key:'ntc_ohm'}` | Ω |
| A0 VOLTAGE | `{kind:'voltage', node:'a0'}` | V |
| SELF-HEATING | `{kind:'behavior', key:'self_heat_K'}` | '' (K) |
| NTC POWER | `{kind:'power', elementId:'ntc'}` | W |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Bath temperature | `behavior:ntc` | bathC | −20 | 100 | 0.5 | no | °C |
| Fixed resistor | `r_fix` | value | 1000 | 100000 | — | yes | Ω |

Try R_FIXED = 3.3 kΩ in the circuit *and* in the code: sensitivity is now highest near 50 °C, where the NTC is about 3.6 kΩ.

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: 16 samples per reading. The HOT LED lights above 40 °C. |
| readout 4 above 0.2 | Self-heating above 0.2 K: the sensor is measuring itself. |

## Failures

### F1: Wrong part on the reel (B = 3435 K), code still says 3977
- **Patch:** `{op:'set', elementId:'behavior:ntc', key:'bTrue', value:3435}`
- **Sim shows:** at 25 °C both agree (10 kΩ). At 60 °C the bath is right but MEASURED says about **54.8 °C**.
- **Why:** this part is 10 kΩ × exp(3435 × (1/333.15 − 1/298.15)) ≈ 2.98 kΩ at 60 °C. Put through the B = 3977 equation, that reads as 1/T = 1/298.15 + ln(0.298)/3977 → T ≈ 327.9 K = 54.8 °C. Two "10 kΩ NTCs" are not interchangeable. Record the part number and B value with the code.

### F2: Thermistor lead breaks
- **Patch:** `{op:'remove', elementId:'ntc'}`
- **Sim shows:** A0 rises to 5 V (1023 counts), and the sketch prints `sensor fault` instead of a fake −50 °C.
- **Why:** with the bottom leg open, the divider reads full scale. Without the range check, the Beta equation would turn 1023 counts into a very cold, very wrong number. Always design the fault codes (near 0 and near 1023) out of the valid range.

### F3: A 1 kΩ resistor fitted instead of 10 kΩ
- **Patch:** `{op:'set', elementId:'r_fix', key:'value', value:1000}`
- **Sim shows:** at 25 °C the reading is about **−19 °C**.
- **Why:** A0 = 5 × 10k/11k ≈ 4.55 V (930 counts). The code assumes 10 kΩ, so it computes R = 10k × 930/93 ≈ 100 kΩ, which the Beta equation maps to −19 °C. The stiffer divider also raises self-heating: I = 5 V / 11 kΩ ≈ 0.45 mA, P ≈ 2.1 mW, ≈ 0.3 K in still air. Any component in the measurement chain must match its value in code.

## Meet the board

An NTC thermistor is a ceramic semiconductor whose resistance falls steeply with temperature. The Vishay NTCLE100E3103 is **10 kΩ at 25 °C** with **B25/85 = 3977 K**.

**Beta equation:** R(T) = R25 × exp(B × (1/T − 1/298.15)), with T in kelvin. At 50 °C (323.15 K): exponent = 3977 × (1/323.15 − 1/298.15) = −1.032, so R = 10 kΩ × 0.356 = **3.56 kΩ**.

**Divider:** NTC at the bottom, 10 kΩ on top, 5 V supply. At 25 °C, A0 = 2.50 V, which reads **512**. At 50 °C: 5 × 3.56/(10 + 3.56) = 1.31 V, which reads **269**.

**Sensitivity near 25 °C:** dR/dT = −B/T² × R = −3977/298.15² × 10 kΩ ≈ **−447 Ω/K** (−4.5 %/K). At the midpoint the divider gives dV/dR = 5 × 10k/(20k)² = 125 µV/Ω, so 447 × 125 µV ≈ **56 mV/K**, or about **11 counts per kelvin**. One count is about 0.09 K. The resolution is good, but accuracy is set by the ±5 % R25 tolerance (about ±1.1 K) and the 1 % resistor.

**Self-heating:** the NTC's power peaks when its resistance equals R_fixed: P = V²/(4R) = 25/40 000 = **0.625 mW**. At a dissipation constant of about 7 mW/K, that is about **0.09 K**. That's fine for 10 kΩ, but the error grows fast with stiffer dividers.

**Choose R_fixed ≈ R_NTC at the temperature you care about most.**

## For mechanical engineers

> A thermistor is a bimetal strip turned into a resistance: one number (B) describes its curve the way a single expansion coefficient describes a strip, and the divider is a lever that turns the change into a readable deflection. Choosing R_fixed sets the lever's pivot, which decides where on the scale the deflection is biggest. **Where it breaks:** the curve is exponential, not linear, so one B value fits well only over the span it was measured on (25–85 °C here). And unlike a passive bimetal, the sensor heats *itself* with the measuring current, an error a mechanical gauge doesn't have.

## Pro tips

1. Measure the fixed resistor with a good meter and put the real value in code. 1 % of 10 kΩ is about 0.22 K at 25 °C, so it matters as much as the NTC's tolerance.
2. For better than about ±0.5 K over a wide range, use the manufacturer's R/T table (or Steinhart–Hart coefficients fitted to it) and calibrate against a reference at one or two points.
3. Power the divider from the same 5 V that the ADC uses as its reference (the default on an Uno). The reading is then ratiometric, and supply drift cancels.

## Quiz

1. **NTC with R25 = 10 kΩ and B = 3977 K. What is its resistance at 50 °C?**
   - 1.2 kΩ
   - 3.56 kΩ
   - 5.0 kΩ
   - 28 kΩ
   - **Answer:** 1. *Why:* 10k × exp(3977 × (1/323.15 − 1/298.15)) = 10k × exp(−1.032) ≈ 3.56 kΩ.

2. **10 kΩ fixed on top, NTC at the bottom, 5 V, 10-bit ADC. What does `analogRead` return at 25 °C?**
   - 0
   - 256
   - 512
   - 1023
   - **Answer:** 2. *Why:* equal resistances give 2.5 V, and 2.5/5 × 1023 ≈ 512.

3. **Peak NTC dissipation in a 10 kΩ/10 kΩ divider on 5 V is 0.625 mW. With δ = 7 mW/K, what is the self-heating?**
   - 0.009 K
   - 0.09 K
   - 0.9 K
   - 9 K
   - **Answer:** 1. *Why:* ΔT = P/δ = 0.625 / 7 ≈ 0.09 K.

4. **Why does a single-B equation lose accuracy at −20 °C for a part specified as B25/85?**
   - The ADC saturates at low temperature
   - B is a two-point fit between 25 and 85 °C, and the real curve bends away from it outside that span
   - NTCs stop working below 0 °C
   - The fixed resistor changes value
   - **Answer:** 1. *Why:* B25/85 is defined from the resistances at 25 and 85 °C. Use the R/T table or Steinhart–Hart outside that range.

## SIM NOTE

- `log()` (natural log) is needed (see the math built-ins note in `mpu6050-imu`).
- Self-heating closes a loop between the solution (the NTC's power) and a netlist parameter (its R). The behavior must be stable with that one-tick lag. τ ≫ dt makes it so.
- Behavior-param patch `bTrue` and tweak `bathC`.
- The ADC-to-temperature error budget would benefit from a readout comparing MEASURED with TRUE (the difference). A computed/derived readout type would help.
