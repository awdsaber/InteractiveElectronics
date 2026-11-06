# Batteries

*Real sources sag*

> A fresh 9 V battery with about 1.5 Ω inside sags to 7.8 V when a 10 Ω load asks it for 0.78 A.

- **Lesson id:** `batteries` · **Track:** T0 Foundations
- **Prerequisites:** `ohms-law`, `series-parallel`, `power-heat`
- **Power element:** `SW1` (powerLabel: "Connect load")

## Learning goals

1. Model a battery as an ideal EMF in series with an internal resistance (a Thévenin source).
2. Predict terminal-voltage sag and internal heating from the load current.
3. Explain maximum power transfer (R_load = r) and why it means 50% efficiency.
4. Estimate stored energy from voltage × capacity, and know that the capacity figure depends on the discharge rate.

## Board

Board: `CELL-06`, size 12 × 8, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| bat | `battery-9v` (alkaline PP3) | `offboard` | PP3 | The source under test: 9 V EMF with internal resistance. | `V_EMF`, `R_INT` |
| sw | `switch-slide` | `tht` | SWITCH | Connects the load. | `SW1` |
| term | `screw-terminal` | `tht` | TERMINAL | Clamps the load leads. | — |
| rl | `resistor` (100 Ω, 5 W cement/wirewound) | `tht` | LOAD | Adjustable test load. | `R_LOAD` |
| meter | `multimeter` (V across battery terminals) | `offboard` | METER | Shows the terminal voltage, the only one you can actually measure. | — |
| amm | `testpoint` | `tht` | AMMETER | Series current-sense point. | `P_I` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_EMF` | V | `emf`, `0` | 9.0 V, rInternal 0 | — | ideal EMF inside the battery |
| `R_INT` | R | `emf`, `term` | 1.5 Ω | — | internal resistance, drawn as part of the battery (`partId: bat`); a fresh alkaline PP3 is typically 1–2 Ω |
| `SW1` | SW | `term`, `sw` | closed: false | maxI 5 A | **power element** |
| `P_I` | PROBE | `sw`, `load` | — | — | |
| `R_LOAD` | R | `load`, `0` | 100 Ω | maxP 5 W | |

Expected at 100 Ω: I = 88.7 mA, terminal 8.87 V.

## Readouts

| label | source | unit |
|---|---|---|
| TERMINAL V | `{kind:'voltage', node:'term'}` | V |
| CURRENT | `{kind:'current', elementId:'P_I'}` | A |
| LOAD POWER | `{kind:'power', elementId:'R_LOAD'}` | W |
| INTERNAL LOSS | `{kind:'power', elementId:'R_INT'}` | W |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Load resistance | `R_LOAD` | value | 1 | 1000 | — | yes | Ω |
| Internal resistance (age) | `R_INT` | value | 1 | 20 | 0.5 | no | Ω |

Sweep the load down and watch LOAD POWER peak near 1.5 Ω while INTERNAL LOSS catches up with it.

## Failures

### F1: Keys in the pocket (terminals shorted)
- **Patch:** `{op:'short', a:'term', b:'0'}`
- **Sim shows:** CURRENT ≈ 6 A, TERMINAL V ≈ 0 V, INTERNAL LOSS ≈ 54 W.
- **Why:** only r limits the current: 9 / 1.5 = 6 A, and all the power is dumped inside the battery. A real PP3 heats fast and can rupture. This is why 9 V batteries ship with terminal caps.

### F2: A tired battery
- **Patches:** `{op:'set', elementId:'V_EMF', key:'value', value:8.4}`, `{op:'set', elementId:'R_INT', key:'value', value:15}`
- **Sim shows:** with the load disconnected the meter still reads 8.4 V. Under the 100 Ω load it drops to 7.3 V at 73 mA.
- **Why:** aging raises internal resistance more than it lowers the EMF. An unloaded meter reading hides that, so test batteries under load.

### F3: Chase maximum power
- **Patch:** `{op:'set', elementId:'R_LOAD', key:'value', value:1.5}`
- **Sim shows:** CURRENT 3 A, TERMINAL V 4.5 V, LOAD POWER 13.5 W; the 5 W load resistor burns.
- **Why:** P_load peaks when R_load = r: P = (9/3)² × 1.5 = 13.5 W. But the battery wastes the same 13.5 W internally (50% efficiency), and the load is over its rating.

## Meet the board

A battery is not a perfect voltage source. Model it as an ideal **EMF** E in series with an **internal resistance** r. The terminal voltage then falls as you draw current:

**V_term = E − I·r**, with I = E / (r + R_load)

With E = 9 V and r = 1.5 Ω:

- R_load = 100 Ω: I = 9 / 101.5 = 88.7 mA, and V_term = 9 − 0.133 = **8.87 V**
- R_load = 10 Ω: I = 9 / 11.5 = 0.783 A, and V_term = 9 − 1.17 = **7.83 V**

The fraction of the energy that reaches the load is η = R_load / (R_load + r): 98.5% at 100 Ω, but only 50% when R_load = r, which is also where load power peaks. Good battery designs run far from that point.

**Energy.** A PP3 alkaline holds very roughly 500 mAh at light drain, so E ≈ 9 V × 0.5 Ah ≈ 4.5 Wh. Four AA alkalines (about 2.5 Ah each at 1.5 V) store more than three times that. Capacity shrinks at high currents, because r converts more of the chemistry's energy into heat.

**Chemistry cheat sheet.** Alkaline is 1.5 V per cell, not rechargeable. NiMH is 1.2 V and rechargeable. A Li-ion/LiPo cell is 3.7 V nominal, 4.2 V full, and shouldn't go below about 3.0 V.

## For mechanical engineers

> A battery is like a pump feeding through a narrow internal passage. At zero flow the outlet shows the full pump pressure. As flow rises, the passage drops pressure in proportion, so the delivered pressure sags along a straight line. The slope of that line is the internal resistance. **Where it breaks:** a battery's "passage" changes with temperature, state of charge and age, and its chemistry recovers partly after a rest. Its voltage also slides as it discharges, unlike a pump with a constant head.

## Pro tips

1. Always test a battery under a representative load. Open-circuit voltage says almost nothing about remaining capacity or internal resistance.
2. Put a fuse right at the battery terminal of anything you build, above all with Li-ion/LiPo packs, which can deliver tens of amps into a fault.
3. For high-drain loads (motors, servos), choose NiMH or Li-ion over alkaline. Their much lower internal resistance means less sag and less wasted heat.

## Quiz

1. **A battery has E = 9 V and r = 2 Ω and drives a 16 Ω load. What is the terminal voltage?**
   - 9.0 V
   - 7.0 V
   - 4.5 V
   - 8.0 V
   - **Answer:** 3. *Why:* I = 9/18 = 0.5 A, so V = 9 − 0.5 × 2 = 8.0 V.

2. **A pack reads 4.5 V open-circuit and 4.2 V while delivering 0.3 A. What is its internal resistance?**
   - 0.1 Ω
   - 1.0 Ω
   - 0.3 Ω
   - 14 Ω
   - **Answer:** 1. *Why:* r = ΔV/I = 0.3/0.3 = 1.0 Ω.

3. **A fresh 1.5 V cell has r = 0.15 Ω. What is its short-circuit current?**
   - 0.225 A
   - 1 A
   - 10 A
   - 100 A
   - **Answer:** 2. *Why:* I = E/r = 1.5/0.15 = 10 A, enough to heat a wire quickly.

4. **At maximum power transfer (R_load = r), the efficiency is…**
   - 50%
   - 100%
   - 75%
   - 25%
   - **Answer:** 0. *Why:* the load and the internal resistance carry the same current and have equal resistance, so they dissipate equal power.

## SIM NOTE

- Behavior `battery-soc` (optional): integrates the drawn charge against a capacity and slides E (and raises r) along a discharge curve. It would let a long-running lesson show a battery going flat.
- A short circuit across a battery isn't rated (no burn) because the source has no rating. An optional `rating.maxP` on `R_INT` could trigger a "battery overheating" FAULT line.
