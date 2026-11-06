# Power, Grounding and EMC

*Where the current returns*

> 1.2 A returning through 84 mΩ of shared ground wire lifts a TMP36's ground by 0.1 V, which the Uno reads as a 10 °C error.

- **Lesson id:** `power-grounding-emc` · **Track:** T7 Professional
- **fig:** 39. Provisional: sidebar order.
- **Prerequisites:** T0 `kirchhoff`, T2 `mosfet-switch`, `thermistor`
- **Power element:** `pwr` (powerLabel: "Switch on 12 V"). The Uno's USB is always connected (SIM NOTE).
- **Behaviors:** `emc-edges`, `mcu-supply`, `serial-plotter`
- **transient:** false

## Learning goals

1. Trace the **return path** of every current, and explain why "ground" is a conductor with resistance and inductance, not an ideal 0 V.
2. Compute the voltage shift from a shared ground conductor (I × R) and the inductive spike from switching (L × di/dt).
3. Fix them with star grounding, separate power and signal returns, and short, wide return paths (ground planes).
4. Place decoupling capacitors correctly, and know why 100 nF sits at every IC pin.
5. Choose a logic-level MOSFET for a 5 V gate drive, and know why the datasheet's worst-case Vth matters.

## Board

Board: `GROUND BENCH`, size 16 × 9, base `mat`. On the left the Uno and USB; on the right, 1 m away (shown shortened), the "far board" with the load and sensor.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | Reads the TMP36 on A0 and switches the load from pin 9. | `pin9` |
| psu | `barrel-jack` (to a 12 V 2 A bench supply) | `offboard` | 12 V PSU | Load supply. Its negative is tied to the Uno's GND at the Uno end. | `psu`, `pwr` |
| q1 | `mosfet-to220` (IRLZ44N, logic-level: Vgs(th) 1–2 V, Rds(on) 25 mΩ at Vgs = 5 V) | `tht` | MOSFET | Low-side switch for the load. | `q1` |
| r_g | `resistor` (100 Ω) | `tht` | GATE R | Limits gate charge current and damps ringing. | `r_g` |
| r_gpd | `resistor` (10 kΩ) | `tht` | GATE PULL-DOWN | Keeps the MOSFET off while the Uno boots and its pin floats. | `r_gpd` |
| r_load | `resistor` (10 Ω 25 W, aluminium-clad) | `tht` | LOAD 10 Ω | A 1.2 A heater, standing in for a motor or solenoid. | `r_load` |
| tmp36 | `transistor-to92` (Analog Devices TMP36) | `tht` | TMP36 | Temperature sensor: 750 mV at 25 °C, 10 mV/°C, referenced to *its own* GND pin. | `tmp36` |
| c_dec | `capacitor-ceramic` (100 nF) | `tht` | DECOUPLE | At the TMP36's supply pin. | — |
| w_gnd | `wire` (1 m, 24 AWG, ≈ 84 mΩ) | `offboard` | SENSOR GND | Ground wire from the far board back to the Uno. | `r_gnd_wire` |
| w_ret | `wire` (1 m, 24 AWG) | `offboard` | LOAD RETURN | Separate return for the load, straight to the PSU negative (star). | `r_ret_wire` |
| sw_topo | `switch-slide` | `offboard` | SHARED / STAR | Selects which wire carries the load's return current. | `sw_shared`, `sw_star` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_usb` | V | `5v`, `0` | 5.0 V, rInternal 0.6 Ω | — | Uno USB 5 V, lumped (always on) |
| `i_board` | I | `5v`, `0` | 0.045 A | — | |
| `psu` | V | `p12`, `psu_n` | 12 V, rInternal 0.05 Ω | — | |
| `pwr` | SW | `p12`, `v12` | closed: false | — | **Power element** |
| `r_psu_gnd` | R | `psu_n`, `0` | 0.01 Ω | — | PSU negative tied to Uno GND at the Uno (the single star point) |
| `r_load` | R | `v12`, `drain` | 10 Ω | maxP 25 W | |
| `q1` | NMOS | `drain`, `gate`, `src` | vth 1.5, k 11 | maxV 55 V, maxP 2.4 W | IRLZ44N fit, with k chosen so Rds ≈ 25 mΩ at Vgs = 5 V (assumes Id = k/2·(Vgs − Vth)² in saturation, SIM NOTE). 2.4 W = (175 − 25) °C / 62 °C/W free-air limit. |
| `pin9` | PIN | `d9`, `0` | pin 9, vcc 5 | — | Gate drive (digital ON/OFF only, see SIM NOTE) |
| `r_g` | R | `d9`, `gate` | 100 Ω | — | |
| `r_gpd` | R | `gate`, `0` | 10 kΩ | — | |
| `sw_shared` | SW | `src`, `g_far` | closed: false | — | Load return via the sensor's ground wire (bad) |
| `sw_star` | SW | `src`, `ret` | closed: true | — | Load return via its own wire (good) |
| `r_ret_wire` | R | `ret`, `psu_n` | 0.084 Ω | maxI 3.5 A | 1 m of 24 AWG (≈ 84 mΩ/m) |
| `r_gnd_wire` | R | `g_far`, `0` | 0.084 Ω | maxI 3.5 A | Sensor/far-board ground wire |
| `tmp36` | V | `s_out`, `g_far` | 0.75 V (set by `emc-edges` from the far-board temperature, 25 °C) | — | Output relative to its own ground pin |
| `i_tmp36` | I | `5v`, `g_far` | 0.00005 A | — | TMP36 supply current, under 50 µA (datasheet) |

analogPins: `A0 → s_out`. The Uno measures relative to its own GND, node `0`.

Expected, star topology with the load on: I_load = 12 / (10 + 0.025 + 0.084 + 0.05) ≈ 1.18 A. The sensor ground wire carries only 50 µA, so A0 = 0.750 V → 25.0 °C.

Expected, shared topology with the load on: 1.18 A × 0.084 Ω ≈ 0.099 V on `g_far`, so A0 = 0.849 V → **34.9 °C**.

### Behaviors

- **`emc-edges`**. Parameters: `farTempC` 25, `lGround` 1 µH (1 m of wire, about 1 µH by rule of thumb), `tSwitch` 0.5 µs (MOSFET switching time with a 100 Ω gate resistor; approximate, from Qgd and the gate current), and `cDecoupleNear` true.
  - Sets `tmp36.value` = 0.5 + 0.01 × farTempC (TMP36: 500 mV offset, 10 mV/°C).
  - At each pin-9 edge, computes the ground-bounce spike on whichever wire carries the load current: V_spike = lGround × ΔI / tSwitch. It shows the spike on the scope trace and publishes `spike_V`. If `cDecoupleNear` is false, the TMP36 output rings during the spike, and an ADC sample taken within 20 µs of the edge (simulated) reads ±spike/2.
  - **Publishes:** `ground_shift_V` (V(g_far) − V(0)), `true_C`, `spike_V` and `load_A`.
- **`mcu-supply`**, **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** Load on, load off · **board:** `uno` · **vcc:** 5

| Pin | Use | PIN element / node |
|---|---|---|
| 9 | MOSFET gate (via 100 Ω) | `pin9` |
| A0 | TMP36 output | analogPins `A0 → s_out` |

```cpp
#define LOAD 9

float readTmp36C() {
  long sum = 0;
  for (int i = 0; i < 32; i++) {
    sum += analogRead(A0);
    delayMicroseconds(200);
  }
  float volts = sum / 32.0 * 5.0 / 1023.0;
  return (volts - 0.5) * 100.0;          // TMP36: 500 mV offset, 10 mV per C
}

void setup() {
  pinMode(LOAD, OUTPUT);
  digitalWrite(LOAD, LOW);
  Serial.begin(115200);
}

void loop() {
  digitalWrite(LOAD, LOW);
  delay(1000);
  float off = readTmp36C();

  digitalWrite(LOAD, HIGH);              // 1.2 A heater on
  delay(1000);
  float on = readTmp36C();

  Serial.print("off_C:");
  Serial.print(off);
  Serial.print(",on_C:");
  Serial.print(on);
  Serial.print(",shift_C:");
  Serial.println(on - off);
}
```

The sensor's true temperature never changes in this demo, so any `shift_C` is pure wiring error.

## Readouts

| label | source | unit |
|---|---|---|
| LOAD CURRENT | `{kind:'current', elementId:'r_load'}` | A |
| FAR-GROUND SHIFT | `{kind:'voltage', node:'g_far', ref:'0'}` | V |
| A0 (AS SEEN BY UNO) | `{kind:'voltage', node:'s_out', ref:'0'}` | V |
| READ WITH LOAD ON | `{kind:'behavior', key:'serial.on_C'}` | °C |
| WIRING ERROR | `{kind:'behavior', key:'serial.shift_C'}` | °C |
| MOSFET LOSS | `{kind:'power', elementId:'q1'}` | W |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Ground wire resistance | `r_gnd_wire` | value | 0.005 | 0.5 | — | yes | Ω |
| Load resistance | `r_load` | value | 5 | 100 | — | yes | Ω |
| Shared return | `sw_shared` | closed | 0 | 1 | 1 | no | — |
| Star return | `sw_star` | closed | 0 | 1 | 1 | no | — |

SIM NOTE: the two topology switches should be one linked tweak (shared ⇔ not star).

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: the heater toggles every second. Watch whether the "temperature" moves with it. |
| readout 1 above 0.02 | The far board's ground is more than 20 mV off: the load current is flowing in the sensor's ground. |
| readout 5 above 1 | MOSFET dissipating over 1 W: it is not fully on. |

## Failures

### F1: Return the load through the sensor ground
- **Patches:** `{op:'set', elementId:'sw_star', key:'closed', value:false}`, `{op:'set', elementId:'sw_shared', key:'closed', value:true}`
- **Sim shows:** load on: FAR-GROUND SHIFT = 0.099 V and WIRING ERROR ≈ **+9.9 °C**. Load off: back to 25 °C.
- **Why:** the TMP36 reports its voltage relative to *its* GND pin. That pin now sits 99 mV above the Uno's ground, because 1.18 A flows through the same 84 mΩ wire. Give high-current loads their own return to the star point, and never let power current flow in a measurement ground.

### F2: The same, with thin 30 AWG wire
- **Patches:** F1 patches, plus `{op:'set', elementId:'r_gnd_wire', key:'value', value:0.34}`
- **Sim shows:** shift ≈ 1.18 × 0.34 ≈ 0.40 V, so a **40 °C** error. Meanwhile the wire dissipates 1.18² × 0.34 ≈ 0.47 W along its 1 m length.
- **Why:** 30 AWG is about 0.34 Ω/m. Ground errors scale with resistance, and with the current you didn't mean to send there.

### F3: Swap in a non-logic-level MOSFET (IRF540N, worst-case part)
- **Patch:** `{op:'set', elementId:'q1', key:'vth', value:4.0}`, `{op:'set', elementId:'q1', key:'k', value:1.6}`
- **Sim shows:** with Vgs = 5 V the MOSFET saturates at about 1.6/2 × (5 − 4)² = 0.8 A. The load gets 0.8 A instead of 1.2 A, and Vds ≈ 12 − 8 = 4 V, so the MOSFET dissipates about **3.2 W**. That is above the 2.4 W the TO-220 can shed without a heatsink, so it burns after 300 ms.
- **Why:** the IRF540N's datasheet specifies Rds(on) at Vgs = **10 V** and allows Vgs(th) up to **4 V**. A typical part may work at 5 V on your bench; a worst-case one, or a hot one, won't. For 5 V or 3.3 V gate drive, pick a part with Rds(on) specified at 4.5 V or 2.5 V (IRLZ44N, AO3400 and so on).

## Meet the board

Every amp that leaves a supply must come back to it. Wires and traces have resistance, so **ground is not one voltage**: it is everywhere a little different, by I × R.

**Shared return:** 1.18 A through 1 m of 24 AWG (84 mΩ) gives 1.18 × 0.084 = **99 mV**. A TMP36 reports 10 mV/°C, so that is a **9.9 °C** error, and the Uno's 4.9 mV per count resolves it as about 20 counts.

**PCB traces:** a 100 mm long, 0.5 mm wide trace of 1 oz (35 µm) copper has R = ρL/A = 1.72e-8 × 0.1 / (0.5e-3 × 35e-6) ≈ **0.098 Ω**, about the same as our wire.

**Inductance:** wire and trace loops are about 1 nH/mm. Switching 1.2 A in 0.5 µs through 1 µH of ground lead gives L·di/dt = 1e-6 × 1.2 / 0.5e-6 = **2.4 V** spikes. They are short, but enough to upset a nearby ADC sample or logic input.

**The fixes:**
1. **Star ground:** high-current returns go straight to the supply's negative, and sensor grounds take their own wire to the same point.
2. **Ground plane** on PCBs: the return current flows directly under its trace, so the loop is small and the inductance low.
3. **Decoupling:** 100 nF at each IC supply pin supplies fast current locally, so it never travels the long loop. Add a larger bulk capacitor near the load.
4. **Slow the edges** (gate resistor) when EMI matters more than switching loss.

## For mechanical engineers

> Picture two hydraulic consumers sharing one return line to the tank. When the big cylinder dumps flow, the return-line pressure rises, and a pressure gauge referenced to that return line reads high even though the circuit it's measuring didn't change. Star grounding is giving each consumer its own return line to the tank, with the gauge's reference port on a dead-ended line where no flow runs. **Where it breaks:** hydraulic lines only have "resistance" and some inertia. Electrical returns also radiate and pick up fields, so a loop's *area* matters (EMI), not just its length. There is no hydraulic equivalent of a ground loop acting as an antenna.

## Pro tips

1. For every high-current path, draw the return explicitly on the schematic, as a real wire with a real length. If you can't say where 1 A comes back, neither can the PCB.
2. Measure "ground" with a meter between two ground points while the load runs. Any reading in the tens of mV means current is flowing where your signals live.
3. Gate pull-down resistors (10–100 kΩ) are not optional on MOSFET loads. During MCU reset the pin floats, and a floating gate can leave a 1 A load half-on and the MOSFET cooking.

## Quiz

1. **1.2 A flows through 84 mΩ of shared ground. What error does a TMP36 (10 mV/°C) on that ground show?**
   - 0.1 °C
   - 1 °C
   - 10 °C
   - 100 °C
   - **Answer:** 2. *Why:* 1.2 × 0.084 ≈ 0.1 V, and 0.1 V / 0.01 V per °C = 10 °C.

2. **A 1 oz copper trace is 0.5 mm wide and 100 mm long. Roughly what is its resistance (ρ = 1.72e-8 Ω·m)?**
   - 1 mΩ
   - 10 mΩ
   - 100 mΩ
   - 1 Ω
   - **Answer:** 2. *Why:* R = 1.72e-8 × 0.1 / (0.5e-3 × 35e-6) ≈ 0.098 Ω.

3. **1 µH of ground lead, 1.2 A switched in 0.5 µs. How big is the spike?**
   - 0.24 V
   - 2.4 V
   - 24 V
   - 1.2 mV
   - **Answer:** 1. *Why:* V = L·di/dt = 1e-6 × 1.2 / 0.5e-6 = 2.4 V.

4. **What is the main idea of star grounding?**
   - Use the thickest possible wire for ground
   - Connect all grounds in a daisy chain
   - Give high-current returns their own path to one common point, so their I·R drop doesn't appear in signal grounds
   - Ground everything to the chassis
   - **Answer:** 2. *Why:* signal references must sit on conductors that carry negligible current.

## SIM NOTE

- **Averaged PWM into MOSFET gates is wrong:** the engine averages PWM as a pin voltage, which would bias a MOSFET into its linear region (massive dissipation) instead of switching it. This lesson uses only digital ON/OFF. For PWM loads (here and in T2 `mosfet-switch`/`transistor-switch`), the engine needs switching-aware averaging: treat a PIN-driven switch as a duty-weighted switch, or let a behavior replace the gate drive with an averaged switch model.
- **NMOS `k` convention:** document whether saturation current is k/2·(Vgs − Vth)² or k·(Vgs − Vth)². The values here assume the k/2 form.
- **ADC reference node:** `analogRead` is measured relative to node `0` (the Uno's ground). That is correct here, and it is the point of the lesson. Keep it explicit in the MCU readAnalog implementation.
- Two power domains (USB always on plus the switched 12 V), as elsewhere.
- Linked tweak for the shared/star switches.
- The ns-scale L·di/dt is computed analytically by the behavior. A 1 ms transient step can't show it.
