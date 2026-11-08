# Resistor Codes and Dividers

*From bands to volts*

> Yellow-violet-red under brown-black-orange means 4.7 kΩ under 10 kΩ, which turns 9 V into 2.88 V.

- **Lesson id:** `resistor-codes-divider` · **Track:** T1 Passives
- **Prerequisites:** `series-parallel`, `multimeter`
- **Power element:** `SW1` (powerLabel: "Connect battery")

## Learning goals

1. Read 4-band and 5-band resistor colour codes, including the tolerance band.
2. Calculate a voltage divider's output, and its Thévenin resistance.
3. Predict how a load pulls a divider's output down, and size the divider so the error stays small.
4. Bound the output under worst-case resistor tolerance.

## Board

Board: `DIV-09`, size 12 × 8, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| bat | `battery-9v` | `offboard` | BATTERY | 9 V source. | `V_BAT` |
| sw | `switch-slide` | `tht` | SWITCH | Connects the battery. | `SW1` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the divider. | — |
| r1 | `resistor` (10 kΩ: brown-black-orange-gold) | `tht` | TOP | Upper leg. | `R1` |
| r2 | `resistor` (4.7 kΩ: yellow-violet-red-gold) | `tht` | BOTTOM | Lower leg; the output is taken across it. | `R2` |
| ld | `resistor` (100 kΩ: brown-black-yellow-gold) | `tht` | LOAD | Stand-in for whatever reads the output (an ADC pin, a sensor input). | `R_LOAD` |
| lsw | `switch-slide` | `tht` | ATTACH | Connects the load. | `SW_LOAD` |
| dmm | `multimeter` | `offboard` | METER | Reads V_out. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_BAT` | V | `b`, `0` | 9.0 V, rInternal 1.5 Ω | — | alkaline PP3 |
| `SW1` | SW | `b`, `top` | closed: false | — | **power element** |
| `R1` | R | `top`, `out` | 10 kΩ | maxP 0.25 W | ±5% |
| `R2` | R | `out`, `0` | 4.7 kΩ | maxP 0.25 W | ±5% |
| `SW_LOAD` | SW | `out`, `ld` | closed: false | — | |
| `R_LOAD` | R | `ld`, `0` | 100 kΩ | maxP 0.25 W | |

Expected: V_out = 2.88 V unloaded; 2.79 V with the 100 kΩ load attached; divider current 0.61 mA.

## Readouts

| label | source | unit |
|---|---|---|
| V OUT | `{kind:'voltage', node:'out'}` | V |
| DIVIDER I | `{kind:'current', elementId:'R1'}` | A |
| LOAD I | `{kind:'current', elementId:'R_LOAD'}` | A |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Bottom resistor R2 | `R2` | value | 1000 | 47000 | — | yes | Ω |
| Load resistance | `R_LOAD` | value | 1000 | 1000000 | — | yes | Ω |
| Load attached | `SW_LOAD` | closed | 0 | 1 | 1 | no | — |

## Failures

### F1: Hang a 1 kΩ sensor input on the output
- **Patches:** `{op:'set', elementId:'SW_LOAD', key:'closed', value:true}`, `{op:'set', elementId:'R_LOAD', key:'value', value:1000}`
- **Sim shows:** V OUT collapses to ≈ 0.69 V.
- **Why:** 4.7 k ∥ 1 k = 825 Ω, so V = 9 × 825/(10 000 + 825) = 0.69 V. The load is far smaller than the divider's 3.2 kΩ Thévenin resistance.

### F2: Bottom resistor drops out
- **Patch:** `{op:'remove', elementId:'R2'}`
- **Sim shows:** V OUT rises to ≈ 9 V (unloaded).
- **Why:** with no lower leg, no current flows through R1, so it drops nothing. A 3.3 V ADC wired here would see 9 V, far past its absolute maximum.

### F3: Misread band: yellow-violet-orange (47 kΩ) fitted
- **Patch:** `{op:'set', elementId:'R2', key:'value', value:47000}`
- **Sim shows:** V OUT ≈ 7.42 V.
- **Why:** orange as the multiplier means ×1000, so the part is 47 kΩ, and V = 9 × 47/57 = 7.42 V. Measure a part before fitting it.

## Meet the board

**Colour code.** The first two bands (three on 1% parts) are digits: black 0, brown 1, red 2, orange 3, yellow 4, green 5, blue 6, violet 7, grey 8, white 9. The next band is the power-of-ten multiplier, and the last, set slightly apart, is tolerance (gold ±5%, brown ±1%).

- Brown-black-orange = 1, 0, ×10³ = **10 kΩ**.
- Yellow-violet-red = 4, 7, ×10² = **4.7 kΩ**.

**Divider.** One current flows through both legs, so

V_out = V_in · R2 / (R1 + R2) = 9 × 4.7 / 14.7 = **2.88 V**, with I = 9/14.7k = 0.61 mA.

**Loading.** Seen from the output, the divider is a 2.88 V source behind R1 ∥ R2 = 10k·4.7k/14.7k = **3.20 kΩ**. Attach 100 kΩ and V_out = 2.88 × 100/(100 + 3.2) = **2.79 V** (−3%). Keep the load at least 10–100× the Thévenin resistance.

**Tolerance.** In the worst case, R1 is +5% and R2 is −5%: 9 × 4.465/(10.5 + 4.465) = **2.69 V**. The opposite corner gives 9 × 4.935/(9.5 + 4.935) = **3.08 V**. Two ±5% parts give roughly ±7% here. Use 1% parts when the voltage matters.

## For mechanical engineers

> A divider is like two orifices in series between a supply and a drain: the pressure between them sits at a fixed fraction of the supply, set by the ratio of their resistances. Tapping flow off that middle point (loading) drags the pressure down, just as the 1 kΩ load did. **Where it breaks:** real orifices are nonlinear (Δp ∝ Q²), so the hydraulic "ratio" shifts with flow. An electrical divider stays perfectly linear, so its loaded output can be calculated exactly.

## Pro tips

1. Never use a divider as a power supply. Its output impedance makes the voltage depend on whatever you connect. Use a regulator.
2. For ADC inputs, keep the source resistance within the converter's recommendation. The ATmega328P datasheet asks for about 10 kΩ or less. Otherwise add a capacitor (e.g. 100 nF) at the pin.
3. Bands fade and confuse (red and orange, brown and red under warm light). Use the meter on every resistor before it goes in. It takes two seconds.

## Quiz

1. **What is a resistor banded red-red-brown-gold?**
   - 22 Ω ±5%
   - 2.2 kΩ ±5%
   - 221 Ω ±1%
   - 220 Ω ±5%
   - **Answer:** 3. *Why:* 2, 2, ×10¹ = 220 Ω; gold means ±5%.

2. **A divider has R1 = 20 kΩ (top) and R2 = 10 kΩ (bottom) on 12 V. What is V_out?**
   - 4 V
   - 6 V
   - 8 V
   - 3 V
   - **Answer:** 0. *Why:* 12 × 10/(20 + 10) = 4 V.

3. **What is the Thévenin (output) resistance of a 10 kΩ / 10 kΩ divider?**
   - 20 kΩ
   - 10 kΩ
   - 5 kΩ
   - 2.5 kΩ
   - **Answer:** 2. *Why:* R1 ∥ R2 = 10k·10k/20k = 5 kΩ.

4. **You need about 3.3 V from 5 V with R1 = 1.8 kΩ on top. Which of these standard R2 values is closest?**
   - 1.0 kΩ
   - 3.3 kΩ
   - 2.2 kΩ
   - 6.8 kΩ
   - **Answer:** 1. *Why:* R2 = 3.3 × 1.8/(5 − 3.3) = 3.49 kΩ. 3.3 kΩ gives 5 × 3.3/5.1 = 3.24 V (E24 also has 3.6 kΩ, which gives 3.33 V).
