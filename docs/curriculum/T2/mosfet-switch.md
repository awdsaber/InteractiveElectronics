# The MOSFET Switch

*A voltage-driven power gate*

> With 5 V on its gate, an IRLZ44N is under 25 mΩ, so switching a 1 A heater costs it just 25 mW.

- **Lesson id:** `mosfet-switch` · **Track:** T2 Semiconductors
- **Prerequisites:** `transistor-switch`, `power-heat`
- **Power element:** `V_USB` (powerLabel: "Plug USB")
- **Sketch:** yes

## Learning goals

1. Explain why a MOSFET is voltage-controlled: the gate is insulated and draws current only while charging.
2. Read a datasheet's R_DS(on) at the gate voltage you actually have. Know that V_GS(th) is the turn-*on* threshold, not the fully-on voltage.
3. Wire a low-side N-channel switch with a gate resistor, a gate pull-down and a shared ground.
4. Calculate conduction loss (I²·R_DS(on)) and the temperature rise of a TO-220 without a heatsink.

## Board

Board: `FET-19`, size 18 × 11, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (title "UNO") | `module` | UNO | Pin 9 drives the gate. | `PIN9` |
| usb | `usb-b` | `tht` | USB | Powers the Uno. | `V_USB` |
| jack | `barrel-jack` | `tht` | JACK | 12 V, 2 A adapter input for the load. | `V_12` |
| q1 | `mosfet-to220` (IRLZ44N) | `tht` | MOSFET | Logic-level N-channel low-side switch. | `Q1` |
| rg | `resistor` (100 Ω, 1/4 W) | `tht` | GATE | Tames the gate-charging current spike and ringing. | `R_G` |
| rpd | `resistor` (10 kΩ, 1/4 W) | `tht` | PULLDOWN | Holds the gate low while the MCU boots. | `R_PD` |
| load | `resistor` (12 Ω, 25 W aluminium-housed) | `offboard` | HEATER | A 12 W resistive load (heater stand-in). | `R_LOAD` |
| term | `screw-terminal` | `tht` | TERMINAL | Load and 12 V wiring (more than 1 A shouldn't run through breadboard clips). | — |
| wg | `wire` (black) | `offboard` | GROUND | 12 V negative to Uno GND. | `W_GND` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_USB` | V | `usb5v`, `0` | 5.0 V, rInternal 0.1 Ω | — | **power element** |
| `PIN9` | PIN | `p9`, `0` | pin 9, vcc 5, rOut 25 Ω | maxI 0.04 A | |
| `R_G` | R | `p9`, `g` | 100 Ω | maxP 0.25 W | |
| `R_PD` | R | `g`, `0` | 10 kΩ | maxP 0.25 W | |
| `Q1` | NMOS | `d`, `g`, `0` | vth 1.5 V; k chosen for R_DS(on) ≈ 25 mΩ at V_GS ≈ 4.9 V | maxI 47 A, maxP 2.4 W, maxV 55 V, failMode short | IRLZ44N: V_DSS 55 V; V_GS(th) 1–2 V; R_DS(on) ≤ 25 mΩ at V_GS = 5 V; maxP is the free-air limit, (175 − 25)/62 °C/W |
| `V_12` | V | `v12`, `gnd12` | 12.0 V, rInternal 0.1 Ω | — | 12 V 2 A adapter |
| `W_GND` | R | `gnd12`, `0` | 0.01 Ω | — | common-ground wire |
| `R_LOAD` | R | `v12`, `d` | 12 Ω | maxP 25 W | |

Expected (pin HIGH): V_GS = 5 × 10k/10.125k ≈ 4.94 V; I_load ≈ 0.99 A; V_DS ≈ 25 mV; P_Q1 ≈ 25 mW.

## Sketch

```cpp
// Low-side MOSFET switch on pin 9: heater on 3 s, off 3 s
const int GATE_PIN = 9;

void setup() {
  pinMode(GATE_PIN, OUTPUT);
  digitalWrite(GATE_PIN, LOW);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(GATE_PIN, HIGH);
  Serial.println("heater ON");
  delay(3000);
  digitalWrite(GATE_PIN, LOW);
  Serial.println("heater OFF");
  delay(3000);
}
```

`pins: {9: 'PIN9'}`, `vcc: 5`, `board: 'uno'`.

## Readouts

| label | source | unit |
|---|---|---|
| LOAD CURRENT | `{kind:'current', elementId:'R_LOAD'}` | A |
| GATE | `{kind:'voltage', node:'g'}` | V |
| V DS | `{kind:'voltage', node:'d'}` | V |
| FET POWER | `{kind:'power', elementId:'Q1'}` | W |
| LOAD POWER | `{kind:'power', elementId:'R_LOAD'}` | W |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Load resistance | `R_LOAD` | value | 6 | 100 | — | yes | Ω |
| MOSFET threshold (swap part) | `Q1` | vth | 1 | 4.5 | 0.1 | no | V |

Raise vth toward 4.5 V and the FET only half-turns on: V_DS rises, load power falls and FET power climbs. This is the "wrong MOSFET" experience.

## Failures

### F1: A standard (non-logic-level) MOSFET on a 3.3 V GPIO
- **Patches:** `{op:'set', elementId:'PIN9', key:'vcc', value:3.3}`, `{op:'set', elementId:'Q1', key:'vth', value:3.5}`
- **Sim shows:** GATE ≈ 3.26 V; LOAD CURRENT ≈ 0; V_DS ≈ 12 V. The heater stays cold.
- **Why:** an IRFZ44N-type part has V_GS(th) of 2–4 V and its R_DS(on) is specified only at 10 V. A sample near the top of the spread doesn't even begin to conduct at 3.3 V. Others conduct partly and overheat. Either way, the design is wrong.

### F2: The MOSFET fails short
- **Patch:** `{op:'short', a:'d', b:'0'}`
- **Sim shows:** the heater runs at full power whatever the pin does.
- **Why:** MOSFETs usually fail drain-to-source short, after overheating, overvoltage or ESD. Anything that must be able to switch *off* (heaters, motors) needs an independent fuse or thermal cutout.

### F3: Forget the common ground
- **Patch:** `{op:'remove', elementId:'W_GND'}`
- **Sim shows:** GATE ≈ 4.9 V relative to Uno GND, but LOAD CURRENT 0.
- **Why:** the load current must return to the 12 V adapter's negative terminal, through Q1's source to that ground. Without the link, the loop is open and V_GS isn't even defined relative to the load circuit.

## Meet the board

A MOSFET's gate is insulated from its channel by a thin oxide layer. Apply V_GS above the threshold and an N-channel forms between drain and source. Its resistance R_DS(on) falls the harder you drive the gate. At DC the gate draws essentially **no current**. Current flows only while its capacitance (nanofarads for a power FET) charges and discharges.

**Thresholds mislead.** V_GS(th) is where the part *begins* to conduct, at a fraction of a milliamp. For the IRLZ44N it is 1–2 V. What matters is R_DS(on) at your gate voltage. This logic-level part is specified at ≤ **25 mΩ at V_GS = 5 V**, so an Uno can drive it fully on.

**Gate voltage.** The 100 Ω and 10 kΩ form a small divider: V_GS = 5 × 10k/(10k + 125) = **4.94 V**.

**Conduction loss.** I = 12/(12 + 0.1 + 0.025) ≈ **0.99 A**, so P = I²·R_DS(on) = 0.99² × 0.025 ≈ **25 mW**. Push 10 A through the same part and P = 10² × 0.025 = **2.5 W**. In free air a TO-220 has R_θJA ≈ 62 °C/W, so the junction would rise ≈ 155 °C, which needs a heatsink. (R_DS(on) also climbs as the die heats, making it worse.)

**Gate resistor and pull-down.** R_G limits the gate-charging current spike and damps ringing. R_PD keeps the FET off while the MCU's pins float during reset.

## For mechanical engineers

> A MOSFET is like a valve held open by pilot pressure on a sealed piston. Once you've pressurised the piston (charged the gate), no further pilot flow is needed to hold it, unlike the BJT's continuous pilot flow. R_DS(on) is the pressure drop of the fully open valve. Too little pilot pressure (V_GS), and it throttles and heats. **Where it breaks:** every power MOSFET hides a "body diode" from source to drain, a built-in reverse check valve you can't remove. The oxide on the gate is punctured by just tens of volts or static (±16 V maximum here).

## Pro tips

1. Choose MOSFETs by "R_DS(on) at V_GS = 4.5 V" (or 2.5 V for 3.3 V logic) in the datasheet's table. Never choose by V_GS(th).
2. Always fit a gate pull-down (10–100 kΩ) and a small gate resistor (22–220 Ω). For PWM above a few kHz, use a gate-driver IC, because MCU pins charge big gates slowly.
3. Inductive loads (motors, solenoids) still need a flyback diode across the load. Don't count on the MOSFET's avalanche rating to absorb the energy.

## Quiz

1. **What is the conduction loss at 3 A through 25 mΩ?**
   - 0.075 W
   - 0.75 W
   - 0.225 W
   - 2.25 W
   - **Answer:** 2. *Why:* P = I²R = 9 × 0.025 = 0.225 W.

2. **A TO-220 in free air (62 °C/W) dissipates 1.5 W. What is its junction temperature rise?**
   - 24 °C
   - 41 °C
   - 155 °C
   - 93 °C
   - **Answer:** 3. *Why:* ΔT = P·θ = 1.5 × 62 = 93 °C.

3. **What does V_GS(th) on a datasheet tell you?**
   - The gate voltage at which the device just begins to conduct (a small specified drain current)
   - The voltage for minimum R_DS(on)
   - The maximum safe gate voltage
   - The drain breakdown voltage
   - **Answer:** 0. *Why:* it is measured at a tiny drain current (e.g. 250 µA), so the device is far from fully on there.

4. **Why fit a 10 kΩ resistor from gate to source?**
   - To increase switching speed
   - To hold the gate low (FET off) when the driving pin floats, e.g. during reset
   - To limit the drain current
   - To protect against reverse polarity
   - **Answer:** 1. *Why:* an insulated gate holds charge, so a floating gate can leave the load half-on.

## SIM NOTE

- **NMOS parameter convention:** spec §4 says "square law with Vth, k" but not whether the triode conductance is k·(V_GS − V_th) or (k/2)·(…). The lesson asks for R_DS(on) ≈ 25 mΩ at V_GS ≈ 4.94 V with vth = 1.5 V, so k ≈ 11.6 A/V² under the first convention or ≈ 23 A/V² under the second. Document the convention in `devices.ts`.
- **Gate charge and switching loss:** with no gate capacitance (C_iss, Q_g), switching losses and slow edges from a weak MCU drive aren't visible. Optional `cgs`/`cgd` on `NMOS`/`PMOS` would enable a PWM-heating lesson later.
- **Temperature-dependent R_DS(on)** and a thermal model (see `power-heat`) would make the "no heatsink at 10 A" scenario meaningful. It is omitted as a failure here.
- **Body diode:** `NMOS` has no body diode. Add an implicit source→drain diode (needed later for H-bridges and synchronous bucks).
