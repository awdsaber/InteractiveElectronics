# Ohm's Law

*Volts over ohms*

> 5 V across a 1 kΩ resistor drives exactly 5 mA; double the volts and the current doubles too.

- **Lesson id:** `ohms-law` · **Track:** T0 Foundations
- **Prerequisites:** `charge-voltage-current`
- **Power element:** `SW_OUT` (powerLabel: "Output ON")

## Learning goals

1. Apply V = I·R to find any one quantity from the other two.
2. Read resistance as the slope of a straight I–V line, and know that "ohmic" parts keep that slope constant.
3. Predict how current scales when voltage or resistance changes.
4. Check whether a resistor's power stays inside its rating when you change V or R.

## Board

Board: `OHM-02`, size 12 × 8, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| psu | `module` (title "BENCH PSU", 0–30 V) | `offboard` | SUPPLY | Adjustable bench supply; sets the voltage. | `V_PSU`, `SW_OUT` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the resistor and meter leads. | — |
| r1 | `resistor` (1 kΩ, 1/4 W metal film, 1%) | `tht` | LOAD | The resistance under test. | `R1` |
| meter | `multimeter` (mA, in series) | `offboard` | AMMETER | Reads the loop current. | `P_I` |
| tip | `probe` | `offboard` | VOLTS | Voltmeter tip across the resistor. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_PSU` | V | `psu+`, `0` | 5.0 V, rInternal 0.01 Ω | — | bench supply in CV mode |
| `SW_OUT` | SW | `psu+`, `out` | closed: false | — | **power element**; the supply's output button |
| `P_I` | PROBE | `out`, `r_top` | — | — | ammeter |
| `R1` | R | `r_top`, `0` | 1000 Ω | maxP 0.25 W, maxV 250 V | 1/4 W metal film |

Expected: I = 5.0 / 1000 = 5.0 mA; P = 25 mW.

## Readouts

| label | source | unit |
|---|---|---|
| VOLTAGE | `{kind:'voltage', node:'r_top'}` | V |
| CURRENT | `{kind:'current', elementId:'P_I'}` | A |
| R1 POWER | `{kind:'power', elementId:'R1'}` | W |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Supply voltage | `V_PSU` | value | 0 | 12 | 0.1 | no | V |
| Resistance | `R1` | value | 100 | 10000 | — | yes | Ω |

Sweep the voltage with R fixed and the current tracks it in a straight line. With 12 V across anything below about 576 Ω, the 1/4 W resistor is overloaded.

## Failures

### F1: 12 V into 100 Ω
- **Patches:** `{op:'set', elementId:'V_PSU', key:'value', value:12}`, `{op:'set', elementId:'R1', key:'value', value:100}`
- **Sim shows:** CURRENT 120 mA, R1 POWER 1.44 W; after 300 ms R1 is burnt (open) and the current drops to 0 A.
- **Why:** P = V²/R = 144/100 = 1.44 W, almost six times the 0.25 W rating.

### F2: Misread colour bands (10 Ω fitted instead of 1 kΩ)
- **Patch:** `{op:'set', elementId:'R1', key:'value', value:10}`
- **Sim shows:** CURRENT 500 mA, R1 POWER 2.5 W, then burnt.
- **Why:** brown-black-black is 10 Ω and brown-black-red is 1 kΩ. One band's difference is a factor of 100 in current.

### F3: Resistor lead pulls out of the board
- **Patch:** `{op:'remove', elementId:'R1'}`
- **Sim shows:** CURRENT 0 A, VOLTAGE at `r_top` floats (the supply's 5 V now appears across the gap).
- **Why:** an open circuit is infinite resistance, so I = V/∞ = 0.

## Meet the board

Georg Ohm found that for many materials, current is proportional to voltage:

**V = I · R**

R is the constant of proportionality, in ohms (Ω = V/A). Rearranged, it answers three questions:

- **Current:** I = V/R = 5 V / 1000 Ω = **5 mA**. Raise the supply to 12 V and I = 12 mA.
- **Resistance:** if 5 V produced 2.1 mA, then R = 5 / 0.0021 ≈ **2.38 kΩ**.
- **Voltage:** 5 mA through 1 kΩ needs V = 0.005 × 1000 = **5 V**.

Plot I against V and you get a straight line through the origin whose slope is 1/R. That is what "ohmic" means. LEDs, diodes and lamps don't follow a straight line, which is why later lessons treat them separately.

Ohm's law ignores power, but the resistor can't. Every operating point dissipates P = V·I. At 12 V across 470 Ω, I = 25.5 mA and P = 12 × 0.0255 = **0.31 W**, over the 0.25 W rating even though nothing about the current looks dramatic. Check the power every time you move a slider.

## For mechanical engineers

> A resistor behaves like laminar flow through a long capillary (Hagen–Poiseuille): pressure drop is proportional to flow, Δp = R_hyd·Q. A linear viscous damper is the same idea, F = c·v. Voltage is the pressure difference, current is the flow, and R is the proportionality constant. **Where it breaks:** hydraulic resistance changes a lot with fluid viscosity and goes nonlinear once flow turns turbulent (Δp ∝ Q²). A metal-film resistor stays linear over its whole range and drifts only about 50–100 ppm/°C.

## Pro tips

1. Set the bench supply's current limit before you connect a circuit, a little above what you expect to draw. A mistake then becomes a limited current instead of smoke.
2. Measure resistance only with the circuit unpowered, and lift one leg if you can. Parallel paths on the board make an in-circuit reading low.
3. Since 1% metal-film resistors cost about the same as 5% carbon film, use them by default. Their values come from the E96 series.

## Quiz

1. **9 V across a 4.7 kΩ resistor. What current flows?**
   - 0.52 mA
   - 1.91 mA
   - 19.1 mA
   - 42.3 mA
   - **Answer:** 1. *Why:* I = 9 / 4700 = 1.91 mA.

2. **You want 10 mA from a 5 V supply through a single resistor. What value?**
   - 0.5 Ω
   - 50 Ω
   - 500 Ω
   - 5 kΩ
   - **Answer:** 2. *Why:* R = V/I = 5 / 0.010 = 500 Ω (use 470 Ω or 510 Ω from the standard series).

3. **At a fixed voltage the resistance is halved. What happens to the current?**
   - It halves
   - It stays the same
   - It doubles
   - It quadruples
   - **Answer:** 2. *Why:* I = V/R, so halving R doubles I (and doubles the power too).

4. **What power does a 470 Ω resistor dissipate on 12 V?**
   - 0.031 W
   - 0.25 W
   - 0.31 W
   - 5.6 W
   - **Answer:** 2. *Why:* P = V²/R = 144 / 470 = 0.306 W, over a 1/4 W part's rating.

## SIM NOTE

- `V` has no current limit. A "short the output" failure would need a constant-current (CC) mode on `V`, e.g. an `iLimit` field, so a bench supply folds back to its limit instead of reporting hundreds of amps. This lesson avoids that scenario until CC mode exists.
