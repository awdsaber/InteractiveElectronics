# The Zener Regulator

*Clamping with breakdown*

> 120 Ω and a 1N4733A hold about 4.9 V from a 9 V battery, while about 24 mA spills through the zener.

- **Lesson id:** `zener` · **Track:** T2 Semiconductors
- **Prerequisites:** `diode-rectifier`, `resistor-codes-divider`, `power-heat`
- **Power element:** `SW1` (powerLabel: "Connect battery")

## Learning goals

1. Explain reverse breakdown, and why a zener's voltage stays nearly constant over a wide current range.
2. Design a shunt regulator: R = (V_in,min − V_z)/(I_load,max + I_z,min).
3. Check both worst cases: maximum input with no load (zener and resistor dissipation) and minimum input at full load (dropout).
4. Recognise the shunt regulator's poor efficiency, and when to use it anyway.

## Board

Board: `ZEN-17`, size 12 × 8, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| bat | `battery-9v` | `offboard` | BATTERY | Unregulated input. | `V_BAT` |
| sw | `switch-slide` | `tht` | SWITCH | Connects the battery. | `SW1` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the regulator. | — |
| r1 | `resistor` (120 Ω, 1/4 W) | `tht` | DROP | Takes up the difference between V_in and V_z. | `R1` |
| z1 | `zener` (1N4733A, 5.1 V, 1 W) | `tht` | CLAMP | Holds the output at ≈ 5.1 V by soaking up surplus current. | `Z1` |
| rl | `resistor` (510 Ω, 1/4 W) | `tht` | LOAD | ≈ 10 mA load. | `R_LOAD` |
| dmm | `multimeter` | `offboard` | METER | Reads V_out. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_BAT` | V | `b`, `0` | 9.0 V, rInternal 1.5 Ω | — | |
| `SW1` | SW | `b`, `s` | closed: false | — | **power element** |
| `R1` | R | `s`, `z` | 120 Ω | maxP 0.25 W | |
| `P_Z` | PROBE | `z`, `zc` | in-line ammeter on the zener's cathode lead (so breakdown current reads positive) | — | |
| `Z1` | ZENER | `0`, `zc` | vz 4.79 (voltage at 5 mA), rz 7 Ω | maxP 1.0 W, rth 150 °C/W, tMax 200 °C | anode at ground, cathode at output (reverse-biased). Datasheet 1N4733A: 5.1 V at I_ZT = 49 mA, Z_ZT = 7 Ω, so 5.1 − 44 mA × 7 Ω = 4.79 V at 5 mA |
| `R_LOAD` | R | `z`, `0` | 510 Ω | maxP 0.25 W | |

Expected: V_out ≈ 4.92 V (the 5.1 V label holds only at 49 mA); I_R1 ≈ 33.6 mA; I_load ≈ 9.7 mA; I_z ≈ 24 mA; P_R1 ≈ 0.135 W; P_Z ≈ 0.118 W. The zener current is read through P_Z so it is positive. R1 carries a thermal rating (rth 340 °C/W, tMax 155 °C, as in power-heat), so it burns on temperature, not a 300 ms timer.

## Readouts

| label | source | unit |
|---|---|---|
| V OUT | `{kind:'voltage', node:'z'}` | V |
| ZENER CURRENT | `{kind:'current', elementId:'P_Z'}` | A |
| LOAD CURRENT | `{kind:'current', elementId:'R_LOAD'}` | A |
| R1 POWER | `{kind:'power', elementId:'R1'}` | W |
| ZENER POWER | `{kind:'power', elementId:'Z1'}` | W |
| R1 TEMP | `{kind:'extra', key:'R1.tj'}` | °C |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Input voltage | `V_BAT` | value | 0 | 15 | 0.1 | no | V |
| Load resistance | `R_LOAD` | value | 47 | 10000 | — | yes | Ω |

Sweep V_in from 0 V up: V_OUT follows the divider until it reaches ≈ 5.1 V, then stays flat while the zener current climbs.

## Failures

### F1: Plug in a 15 V adapter
- **Patch:** `{op:'set', elementId:'V_BAT', key:'value', value:15}`
- **Sim shows:** I_R1 ≈ 81 mA, R1 POWER ≈ 0.8 W, zener ≈ 0.37 W; R1 heats past 155 °C in about 3 s, burns open and V_OUT collapses to 0.
- **Why:** P = (15 − 5.1)²/120 ≈ 0.8 W, over three times R1's rating. The zener (≈ 0.36 W) was fine. The resistor was the weak link.

### F2: Ask for too much current (100 Ω load)
- **Patch:** `{op:'set', elementId:'R_LOAD', key:'value', value:100}`
- **Sim shows:** V_OUT drops to ≈ 4.06 V and the zener current falls to ≈ 0.
- **Why:** a 100 Ω load at 5 V wants about 50 mA, but R1 can only supply ≈ 33 mA. The zener drops out of breakdown and the circuit is just a divider: 9 × 100/221.5 = 4.06 V.

### F3: Zener fitted backwards
- **Patches:** `{op:'remove', elementId:'Z1'}`, `{op:'add', element:{id:'Z1', type:'ZENER', nodes:['z','0'], vz:5.1, rating:{maxP:1}}}`
- **Sim shows:** V_OUT ≈ 0.7 V; ≈ 68 mA flows; R1 (≈ 0.56 W) heats and burns after about 6 s.
- **Why:** forward-biased, a zener is just a diode, clamping at one diode drop. The resistor now carries (9 − 0.7)/121.5 ≈ 68 mA.

## Meet the board

A zener is a diode built to break down in reverse at a precise voltage, here **5.1 V** for the 1N4733A. In breakdown its voltage barely moves as current changes (dynamic resistance ≈ **7 Ω** at its 49 mA test current), so it can hold a node steady by sinking whatever current the load doesn't take.

**Shunt regulator.** R1 drops the difference, and its current splits between load and zener. V_out is a little under the 5.1 V label because the label is at 49 mA and the board runs at about 24 mA: 5.1 − 25 mA × 7 Ω ≈ 4.92 V.

- I_R1 = (9 − 4.92)/(120 + 1.5) = **33.6 mA**
- I_load = 4.92/510 ≈ **9.7 mA**
- I_z = 33.6 − 9.7 ≈ **24 mA**

**Design equation.** R = (V_in,min − V_z)/(I_load,max + I_z,min). With I_z,min ≈ 5 mA, the 120 Ω part supports loads up to about 29 mA (below roughly 160 Ω of load). Beyond that, regulation is lost (F2).

**Worst-case dissipation** comes at maximum input with no load:

- At 9 V, everything flows through Z1: P_z ≈ 4.95 × 34 mA ≈ **0.17 W** (1 W part).
- At 15 V, R1 dissipates (9.9)²/120 = **0.82 W**, so a 1/4 W resistor fails first (F1).

**Efficiency.** The load gets 4.9 V × 9.7 mA = 48 mW of the 9 V × 33.6 mA = 302 mW drawn, about **16%**. Zeners make excellent references, clamps and protection, but poor power supplies.

Zeners near 5–6 V have almost zero temperature coefficient, which made them popular references.

## For mechanical engineers

> A zener shunt regulator is a pressure-relief valve teed across the load, fed from the supply through an orifice (R1). The valve holds the line pressure by dumping whatever flow the load doesn't need back to tank. When the load demands more than the orifice can deliver, the valve shuts and pressure sags. **Where it breaks:** relief valves have hysteresis and can chatter. A zener has a smooth, soft knee and no memory, but its clamp voltage drifts slightly with current and temperature.

## Pro tips

1. Use zeners for references, voltage clamps and input protection. For supply rails, an LDO or a shunt reference like the TL431 is far better.
2. A resistor plus a zener (or a TVS diode) on an input pin is a cheap clamp against overvoltage from cables and sensors.
3. Always run both corner cases: highest V_in with no load (dissipation), and lowest V_in with maximum load (regulation).

## Quiz

1. **12 V in, 5.1 V out, 20 mA load, 5 mA minimum zener current. What series resistor?**
   - 204 Ω
   - 276 Ω (use 270 Ω)
   - 345 Ω
   - 480 Ω
   - **Answer:** 1. *Why:* R = (12 − 5.1)/(0.020 + 0.005) = 276 Ω.

2. **With no load, 30 mA flows through a 5.1 V zener. How much does it dissipate?**
   - 0.153 W
   - 0.03 W
   - 0.51 W
   - 1.53 W
   - **Answer:** 0. *Why:* P = V_z × I_z = 5.1 × 0.030 = 0.153 W.

3. **The load demands more current than R1 can supply. What happens?**
   - The zener supplies the extra
   - The output stays at V_z
   - The zener leaves breakdown and V_out falls below V_z
   - The zener burns out
   - **Answer:** 2. *Why:* a zener can only sink current. With nothing left over for it, the circuit becomes a plain divider.

4. **This board is fed 15 V with no load. What does R1 (120 Ω) dissipate, ignoring the battery's internal resistance?**
   - 0.13 W
   - 0.36 W
   - 1.9 W
   - 0.82 W
   - **Answer:** 3. *Why:* (15 − 5.1)²/120 = 98/120 ≈ 0.82 W.

## SIM NOTE

- The ZENER element supports `rz` (soft knee): `vz` is the voltage at 5 mA, with slope `rz` above it. Datasheet point 5.1 V at 49 mA, 7 Ω gives vz = 4.79 V. Datasheet check (1N4733A, 1 W DO-41): V_Z 5.1 V at I_ZT 49 mA, Z_ZT 7 Ω; 1 W at a 50 °C lead temperature, derated 6.67 mW/°C (150 °C/W) to a 200 °C junction. The earlier draft's "5.1 V at 22 mA" ignored the 7 Ω slope.
- Soft knee: Z_ZK is about 400 ohm at 1 mA and the 1N4733A is +-5 % (4.85 to 5.36 V), so 4.9 V out is typical, not exact. Quiz 1 no longer gives away "use 270 ohm" in the option (it is in the explanation).
