# Capacitors and RC Time

*Charge takes time*

> 10 kΩ feeding 100 µF gives τ = 1 s, so the capacitor reaches 63% of 5 V (3.16 V) one second after the switch closes.

- **Lesson id:** `capacitor-rc` · **Track:** T1 Passives
- **Prerequisites:** `ohms-law`, `kirchhoff`
- **Power element:** `SW_CHG` (powerLabel: "Close charge switch")
- **Transient:** yes

## Learning goals

1. Use Q = C·V and i = C·dV/dt to describe what a capacitor does.
2. Predict an RC charge and discharge with v(t) = V(1 − e^(−t/τ)) and τ = R·C.
3. Calculate stored energy, ½CV², and know that charging through a resistor wastes an equal amount.
4. Respect electrolytic polarity, voltage ratings and tolerance.

## Board

Board: `RC-10`, size 12 × 8, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| pwr | `module` (title "5 V SUPPLY") | `offboard` | SUPPLY | 5 V source. | `V_SUP` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the parts. | — |
| sw1 | `switch-slide` | `tht` | CHARGE | Starts the charge. | `SW_CHG` |
| r1 | `resistor` (10 kΩ, 1/4 W) | `tht` | TIMING | Limits the charging current; sets τ with C1. | `R1` |
| c1 | `capacitor-electrolytic` (100 µF, 16 V, ±20%) | `tht` | TANK | Stores charge; its voltage can't jump. | `C1` |
| b1 | `button` | `tht` | DRAIN | Discharges C1 through R_DIS. | `SW_DIS` |
| rd | `resistor` (1 kΩ, 1/4 W) | `tht` | BLEED | Discharge resistor. | `R_DIS` |
| dmm | `multimeter` | `offboard` | METER | Reads V_C. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_SUP` | V | `sup`, `0` | 5.0 V, rInternal 0.05 Ω | — | |
| `SW_CHG` | SW | `sup`, `a` | closed: false | — | **power element** |
| `R1` | R | `a`, `vc` | 10 kΩ | maxP 0.25 W | |
| `C1` | C | `vc`, `0` | 100 µF, v0 0 | maxV 16 V, failMode short | aluminium electrolytic, + at `vc` |
| `SW_DIS` | SW | `vc`, `d` | closed: false | — | push to discharge |
| `R_DIS` | R | `d`, `0` | 1 kΩ | maxP 0.25 W | discharge peak 5 mA, 25 mW |

Expected: τ = 1.0 s; V_C = 3.16 V at 1 s, 4.97 V at 5 s; initial current 0.5 mA.

## Readouts

| label | source | unit |
|---|---|---|
| CAP VOLTAGE | `{kind:'voltage', node:'vc'}` | V |
| CHARGE CURRENT | `{kind:'current', elementId:'R1'}` | A |
| CAP CURRENT | `{kind:'current', elementId:'C1'}` | A |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Timing resistor | `R1` | value | 1000 | 100000 | — | yes | Ω |
| Capacitance | `C1` | value | 0.00001 | 0.001 | — | yes | F |
| Discharge button | `SW_DIS` | closed | 0 | 1 | 1 | no | — |

## Failures

### F1: Plug it into 24 V
- **Patch:** `{op:'set', elementId:'V_SUP', key:'value', value:24}`
- **Sim shows:** V_C climbs past 16 V (at t = τ·ln 3 ≈ 1.1 s) and C1 fails shorted. V_C drops to 0 and a steady 2.4 mA flows through R1.
- **Why:** an electrolytic's dielectric is a thin oxide layer that breaks down above the rated voltage. Real parts heat, bulge and may vent. Electrolytics usually fail shorted or high-leakage.

### F2: Swap in 1000 µF
- **Patch:** `{op:'set', elementId:'C1', key:'value', value:0.001}`
- **Sim shows:** charging takes ten times as long: 63% at 10 s, nearly full at about 50 s.
- **Why:** τ = RC = 10 k × 1000 µ = 10 s. τ scales linearly with C.

### F3: A leaky capacitor
- **Patch:** `{op:'add', element:{id:'R_LEAK', type:'R', nodes:['vc','0'], value:47000}}`
- **Sim shows:** V_C settles at ≈ 4.12 V instead of 5 V, and gets there faster (τ ≈ 0.83 s).
- **Why:** the leakage forms a divider, 5 × 47/57 = 4.12 V. The effective resistance charging the cap is 10 k ∥ 47 k = 8.25 kΩ, so τ = 0.825 s.

## Meet the board

A capacitor is two conductors separated by an insulator. Push charge onto it and its voltage rises in proportion: **Q = C·V**. Differentiating gives the working equation, **i = C · dV/dt**: current flows only while the voltage is changing, and the voltage can't jump instantly.

Charging through R from 0 V:

**v(t) = V·(1 − e^(−t/τ)),  τ = R·C**

On this board, τ = 10 kΩ × 100 µF = **1.0 s**.

| t | V_C |
|---|---|
| 1 s (1τ) | 5 × 0.632 = 3.16 V |
| 2 s | 4.32 V |
| 3 s | 4.75 V |
| 5 s | 4.97 V (99.3%) |

The current starts at V/R = 5/10k = **0.5 mA** and decays with the same τ.

**Energy.** E = ½CV² = ½ × 100 µ × 5² = **1.25 mJ**. Charging from a fixed voltage through any resistor dissipates exactly as much again in the resistor, so the process is 50% efficient whatever the value of R.

**Discharge.** Pressing DRAIN empties C1 through 1 kΩ with τ = 0.1 s.

Electrolytics are polarised: the stripe marks the negative lead. They typically carry ±20% tolerance, so this "1 s" timer is really anywhere from 0.8 s to 1.2 s.

## For mechanical engineers

> An RC charge is a spring in parallel with a damper (a Kelvin–Voigt element) under a step force. Deflection creeps toward F/k as x(t) = (F/k)(1 − e^(−t/τ)) with τ = c/k. The damper plays R and the spring's compliance (1/k) plays C. You can also picture filling a tank through a narrow pipe: the level rises fast at first, then slows. **Where it breaks:** real capacitors leak, have series resistance (ESR), and show dielectric absorption, partly recharging after being shorted, which no simple spring does.

## Pro tips

1. Derate electrolytic voltage. Run at 50–80% of the rating (a 16 V part on 5–12 V rails), and observe polarity. A reversed electrolytic can vent violently.
2. For timing, use film or C0G/NP0 ceramic capacitors (±1–5%) rather than electrolytics (±20%) or X7R/Y5V ceramics, whose capacitance drops with DC bias and temperature.
3. Large capacitors stay charged after power-off. Fit a bleed resistor and measure before touching.

## Quiz

1. **What is the time constant of 47 kΩ and 22 µF?**
   - 0.47 s
   - 1.03 s
   - 2.14 s
   - 10.3 s
   - **Answer:** 1. *Why:* τ = RC = 47 000 × 22 × 10⁻⁶ = 1.034 s.

2. **After two time constants, what fraction of the final voltage has an RC charge reached?**
   - 50%
   - 63.2%
   - 86.5%
   - 95.0%
   - **Answer:** 2. *Why:* 1 − e⁻² = 0.865.

3. **How much energy does a 1000 µF capacitor store at 12 V?**
   - 6 mJ
   - 12 mJ
   - 72 mJ
   - 144 mJ
   - **Answer:** 2. *Why:* E = ½CV² = 0.5 × 0.001 × 144 = 0.072 J.

4. **At the instant the switch closes on an empty capacitor, the current through R is…**
   - zero
   - V/R
   - V/(2R)
   - set by the capacitance only
   - **Answer:** 1. *Why:* the capacitor starts at 0 V, so the full supply appears across R and I = V/R.

## SIM NOTE

- `C` has no ESR or leakage parameters. Optional `esr` and `rLeak` fields would make capacitor failures (and the inrush from a direct short across a charged capacitor) realistic. This lesson avoids the screwdriver-short scenario until then.
- Electrolytic reverse polarity is not modelled. A negative-voltage rating (e.g. `rating.maxVrev`) would let a "fit it backwards" failure exist.
