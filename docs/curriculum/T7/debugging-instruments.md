# Debugging Instruments

*Meter, scope, analyzer*

> A 10 MΩ multimeter on a 10 MΩ/10 MΩ divider reads 1.67 V instead of 2.5 V, and a DMM shows 2.50 V for a PWM signal that is really jumping between 0 V and 5 V 490 times a second.

- **Lesson id:** `debugging-instruments` · **Track:** T7 Professional
- **fig:** 43. Provisional: sidebar order.
- **Prerequisites:** T0 `multimeter`, T1 `ac-oscilloscope`, `serial-protocols`
- **Power element:** `usb_plug` (powerLabel: "Plug USB")
- **Behaviors:** `instruments`, `mcu-supply`, `serial-plotter`
- **transient:** true

## Learning goals

1. Choose the right instrument. The DMM gives accurate averages and DC. The oscilloscope shows a waveform in time. The logic analyzer captures many digital channels and decodes protocols.
2. Account for **loading**: DMM input resistance (typically 10 MΩ), scope input (1 MΩ ∥ about 15 pF, or 10 MΩ with a ×10 probe), and the ammeter's burden voltage.
3. Measure current safely: in series, on the right jack, with the fuse intact. Know what happens if you measure volts on the amps jack.
4. Use the scope correctly: ground clip on ground only, ×10 probe compensation, short ground leads for fast edges, and triggering.
5. Estimate RC-filter ripple on a PWM "DAC" and verify it with the scope.

## Board

Board: `DEBUG BENCH`, size 15 × 9, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | Produces PWM, a blinking LED and serial traffic to measure. | `pin9`, `pin6` |
| r_f | `resistor` (10 kΩ) | `tht` | RC 10k | PWM low-pass filter: R. | `rf` |
| c_f | `capacitor-electrolytic` (10 µF) | `tht` | RC 10µ | PWM low-pass filter: C. τ = 0.1 s, fc ≈ 1.6 Hz. | `cf` |
| r_h1, r_h2 | `resistor` (10 MΩ ×2) | `tht` | HI-Z DIVIDER | A high-impedance divider, the kind found in battery monitors. | `rh1`, `rh2` |
| jp_i | `header-male` (2-pin with jumper) | `tht` | I-MEASURE | Remove the jumper and insert the ammeter here. | `jumper` |
| r_load | `resistor` (100 Ω 0.5 W) | `tht` | 50 mA LOAD | A known load current. | `r_load` |
| led6 | `led` (red) + `resistor` (330 Ω) | `tht` | BLINK | A digital signal for the logic analyzer. | `led6`, `r_l6` |
| dmm | `multimeter` | `offboard` | DMM | 3½–4½ digit handheld meter, auto-ranging, with fused mA and A jacks. | (added by behavior) |
| scope | `module` (title "2-CH SCOPE", 100 MHz class) | `offboard` | SCOPE | Earth-grounded bench oscilloscope. | — |
| la | `module` (title "LOGIC ANALYZER") | `offboard` | ANALYZER | 8-channel logic analyzer (as in `serial-protocols`). | — |
| probes | `probe` ×4 | `offboard` | PROBES | DMM leads, scope probe ×10 with ground clip, logic grabbers. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_usb` | V | `usb_vbus`, `0` | 5.0 V, rInternal 0.3 Ω | — | Laptop USB. The laptop's charger is earthed (SIM NOTE). |
| `usb_plug` | SW | `usb_vbus`, `vbus_in` | closed: false | — | **Power element** |
| `f1` | R | `vbus_in`, `5v` | 0.3 Ω | maxI 1.0 A | Polyfuse + FDN340P |
| `i_board` | I | `5v`, `0` | 0.045 A | maxV 6 V | |
| `pin9` | PIN | `d9`, `0` | pin 9, vcc 5 | — | PWM, ~490 Hz |
| `rf` | R | `d9`, `filt` | 10 kΩ | — | |
| `cf` | C | `filt`, `0` | 10 µF | maxV 16 V | |
| `rh1` | R | `5v`, `hiz` | 10 MΩ | — | |
| `rh2` | R | `hiz`, `0` | 10 MΩ | — | 2.48 V unloaded |
| `jumper` | R | `5v`, `ld` | 0.001 Ω | — | Current-measure jumper |
| `r_load` | R | `ld`, `0` | 100 Ω | maxP 0.5 W | ≈ 50 mA |
| `pin6` | PIN | `d6`, `0` | pin 6, vcc 5 | — | |
| `r_l6` | R | `d6`, `l6` | 330 Ω | — | |
| `led6` | LED | `l6`, `0` | red | maxI 0.03 A | |

analogPins: `A0 → filt`.

### Behaviors

- **`instruments`**. Manages three virtual instruments whose probes the learner drops onto nodes (SIM NOTE: probe placement UI). The behavior **adds elements to the netlist** to model loading.
  - **DMM.** Modes `V`, `mA`, `A` and `Ω`.
    - V mode: adds R 10 MΩ between the probe nodes and displays the 1 s average of V(+) − V(−), rounded to 4 digits on auto-range.
    - mA mode (red lead in the mA jack): adds R `dmm_shunt` = 1.0 Ω (burden; typical meters are 1–10 Ω on mA ranges, so check the "burden voltage" in your manual) with rating maxI 0.4 A, failMode open (the jack's fuse, often 400–500 mA; illustrative).
    - A mode: 0.01 Ω, with the fuse rating 10 A (note in the copy: cheap meters may have no fuse on the 10 A jack).
    - A PWM node in V mode reads its *average*.
  - **Scope.** Each channel adds 1 MΩ to the probe ground (×1), or 10 MΩ with the ×10 setting. The probe's ground clip is **tied to earth**, and earth is tied to node `0` through the laptop charger (`earthed` param, default true). Clipping the ground lead to any other node adds a 0.05 Ω element from that node to `0` (the earth path).
    - For display, the scope reconstructs PWM pins as square waves from PinState duty and the pin's frequency (490 or 980 Hz on an Uno), and RC nodes as average + analytic ripple. It does not use the 1 ms MNA samples (SIM NOTE).
    - Ripple on `filt`: ΔV_pp ≈ VCC × D × (1 − D) / (f × R × C).
  - **Logic analyzer:** as `serial-protocols`' `logic-analyzer`.
  - **Publishes:** `dmm_reading`, `dmm_mode`, `scope_vpp`, `scope_freq`, `scope_duty`, `ripple_mVpp` and `fuse_ok`.
- **`mcu-supply`**, **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** Things worth measuring · **board:** `uno` · **vcc:** 5

| Pin | Use | PIN element / node |
|---|---|---|
| 9 | PWM into the RC filter | `pin9` |
| A0 | Filter output | analogPins `A0 → filt` |
| 6 | Blink (for the analyzer) | `pin6` |

```cpp
#define PWM_PIN 9
#define BLINK 6

int level = 0;
int step = 32;

void setup() {
  pinMode(PWM_PIN, OUTPUT);
  pinMode(BLINK, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  analogWrite(PWM_PIN, level);        // 490 Hz square wave, duty = level/255
  delay(600);                         // > 5 tau (0.5 s) so the filter settles

  long sum = 0;
  for (int i = 0; i < 16; i++) {
    sum += analogRead(A0);
  }
  float measured = sum / 16.0 * 5.0 / 1023.0;
  float expected = level * 5.0 / 255.0;

  Serial.print("set_V:");
  Serial.print(expected);
  Serial.print(",filt_V:");
  Serial.println(measured);

  digitalWrite(BLINK, HIGH);          // a pulse to trigger the analyzer on
  delay(50);
  digitalWrite(BLINK, LOW);

  level = level + step;
  if (level > 255 || level < 0) {
    step = -step;
    level = level + 2 * step;
  }
}
```

## Readouts

| label | source | unit |
|---|---|---|
| DMM | `{kind:'behavior', key:'dmm_reading'}` | '' (V/A/Ω per mode) |
| SCOPE Vpp | `{kind:'behavior', key:'scope_vpp'}` | V |
| SCOPE FREQ | `{kind:'behavior', key:'scope_freq'}` | Hz |
| FILTER RIPPLE | `{kind:'behavior', key:'ripple_mVpp'}` | '' (mV pp) |
| HI-Z NODE (TRUE) | `{kind:'voltage', node:'hiz'}` | V |
| LOAD CURRENT (TRUE) | `{kind:'current', elementId:'r_load'}` | A |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Filter R | `rf` | value | 1000 | 100000 | — | yes | Ω |
| Filter C | `cf` | value | 1e-7 | 1e-4 | — | yes | F |
| DMM mode | `behavior:instruments` | dmmMode | 0 | 3 | 1 | no | V/mA/A/Ω |
| Scope probe ×1/×10 | `behavior:instruments` | probeX10 | 0 | 1 | 1 | no | — |

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: PWM steps every 0.6 s. Compare the DMM, the scope and A0 on the same node. |
| readout 3 above 50 | Ripple over 50 mV: the filter is too light for this PWM frequency. |

## Failures

### F1: Measure the 5 V rail with the leads still in the mA jack
- **Patch:** `{op:'add', element:{id:'dmm_shunt', type:'R', nodes:['5v','0'], value:1.0, rating:{maxI:0.4, failMode:'open'}}}`
- **Sim shows:** a 1 Ω shunt straight across the rail. The current is 5 / (1 + 0.6) ≈ 3 A, so the meter's 0.4 A fuse blows (opens after 300 ms) and the rail sags while it lasts. In a real meter the fuse blows in milliseconds. On the 10 A jack, often unfused, the leads or the board's polyfuse take the hit instead.
- **Why:** in current mode the meter is a near-short by design. After any current measurement, move the red lead back to V/Ω *before* touching it to anything. Many pros keep a second meter permanently set up for current.

### F2: Scope ground clip on the 5 V rail
- **Patch:** `{op:'add', element:{id:'earth_clip', type:'R', nodes:['5v','0'], value:0.05}}`
- **Sim shows:** the 5 V rail is shorted to ground through the scope's earth and the laptop charger's earth. Current jumps, the polyfuse trips, and the board resets.
- **Why:** a bench scope's ground clip is connected to mains earth. Anything else earthed (a desktop PC, an earthed laptop charger, the bench supply's negative) makes the clip a short to that node. To measure between two non-ground points, use two channels and the math function (A − B), a differential probe, or a battery-powered or isolated instrument.

### F3: Trust the DMM on the 10 MΩ divider
- **Patch:** `{op:'add', element:{id:'dmm_vin', type:'R', nodes:['hiz','0'], value:10000000}}`
- **Sim shows:** the true node drops from 2.48 V to **1.65 V** while the meter is connected, and the DMM displays 1.65 V. Disconnect it and the node returns.
- **Why:** the meter's 10 MΩ sits in parallel with the bottom resistor, making it 5 MΩ. Then 5 × 5/(10 + 5) ≈ 1.67 V, minus the USB drop. On high-impedance nodes, measure with a ×10 scope probe (10 MΩ, same problem), a high-impedance electrometer mode (some meters have >1 GΩ on DC mV ranges), or a buffer op-amp.

## Meet the board

**The DMM** is the most accurate tool on the bench, but it only shows one number, averaged over about a second. On pin 9 at 50 % PWM it reads **2.50 V**, a voltage the pin never actually has. Its input is about **10 MΩ**. On a 10 MΩ + 10 MΩ divider that becomes 5 MΩ in parallel, and the reading falls to 5 × 5/15 = **1.67 V**.

**Current mode** puts a shunt in series: the meter *measures* by dropping voltage. With a 1 Ω burden at 50 mA, that is 50 mV lost, and the load current becomes 5 / (100 + 1) = **49.5 mA**.

**The oscilloscope** shows the waveform: on pin 9, a 0–5 V square wave at **490 Hz**. Its ground clip is earthed. Use the ×10 probe (10 MΩ, lighter capacitive load), compensated on the scope's square-wave output.

**RC "DAC" ripple:** with R = 10 kΩ and C = 10 µF, τ = 0.1 s, and the ripple at 50 % duty is about 5 × 0.5 × 0.5 / (490 × 0.1) ≈ **25.5 mV pp**. It settles to 99 % in 5τ = 0.5 s, which is why the sketch waits 600 ms.

**The logic analyzer** samples many digital lines (8–16) for a long time, triggers on a pattern, and decodes UART, I²C and SPI.

**The rule:** first ask what you need to see (a value, a shape, a sequence), then pick the instrument.

## For mechanical engineers

> The DMM is a calibrated pressure gauge with a damper: it shows the steady value precisely, but snubs out pulsations. The scope is a fast pressure transducer on a chart recorder: it shows the pulsation, but you must pick the time base and trigger. The logic analyzer is a PLC event log: many on/off signals with timestamps. Instrument loading is the gauge's own volume and flow draw changing the system it measures. **Where it breaks:** a pressure gauge rarely short-circuits your system. An ammeter on the wrong jack, or a scope ground clip on the wrong node, *is* a short, and it can destroy the instrument or the circuit instantly.

## Pro tips

1. Before measuring, predict the reading to one significant figure. If the instrument disagrees, either the circuit is wrong or the measurement is, and both are worth knowing.
2. Keep the scope's ground lead short (use a spring-tip ground for fast edges). A 15 cm ground clip is about 150 nH, which rings with the probe capacitance at tens of MHz and adds "overshoot" that isn't really there.
3. Measure supply current by the drop across a known series resistor (or a current-sense amplifier), not with the DMM's mA range, whenever burden voltage or fuse risk matters.

## Quiz

1. **A 10 MΩ DMM measures the midpoint of a 10 MΩ/10 MΩ divider on 5 V. What does it read?**
   - 0.83 V
   - 1.67 V
   - 2.50 V
   - 3.33 V
   - **Answer:** 1. *Why:* the bottom becomes 10 M ∥ 10 M = 5 MΩ, so 5 × 5/(10 + 5) = 1.67 V.

2. **PWM at 490 Hz, 50 % duty, 5 V, into R = 10 kΩ and C = 10 µF. What is the approximate peak-to-peak ripple?**
   - 2.5 mV
   - 25 mV
   - 250 mV
   - 2.5 V
   - **Answer:** 1. *Why:* ΔV ≈ 5 × 0.5 × 0.5 / (490 × 10 000 × 10e-6) ≈ 25.5 mV.

3. **A 100 Ω load on 5 V is measured through a DMM with a 1.8 Ω burden on the mA range. What current does it display?**
   - 50.0 mA
   - 49.1 mA
   - 45 mA
   - 2.7 A
   - **Answer:** 1. *Why:* 5 / (100 + 1.8) ≈ 49.1 mA, about 1.8 % low because of the meter itself.

4. **An I²C sensor intermittently NACKs. Which instrument finds out why fastest?**
   - DMM on SDA
   - Single-channel scope on SCL
   - Logic analyzer with the I²C decoder, triggered on NACK
   - An ammeter in the supply
   - **Answer:** 2. *Why:* you need the sequence of bytes and ACK bits around the failure. Only a decoder with a protocol trigger shows that directly. Then use the scope on the edges if rise time is suspect.

## SIM NOTE

- **Probe placement UI:** let the learner drop DMM, scope and analyzer probes onto 3D nodes (pads or test points). The `instruments` behavior then adds and removes loading elements live, which needs a behavior API to patch the netlist at runtime (`ctx.addElement`/`removeElement`).
- **Scope trace rendering** from PinState (duty and per-pin PWM frequency), plus analytic RC ripple. The averaged MNA samples cannot show PWM waveforms. The engine also needs a per-board PWM frequency table (Uno: 490 Hz on 3/9/10/11, 980 Hz on 5/6).
- Earth modelling: a `earthed` bench parameter. The scope-ground short is modelled as an added element to `0`, valid when the USB host is earthed.
- A DMM mode tweak with an enumerated value.
