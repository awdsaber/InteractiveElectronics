# Series and Parallel

*Adding up resistance*

> 1 kΩ in series with 2.2 kΩ ∥ 3.3 kΩ makes 2.32 kΩ, so a 6 V pack drives 2.59 mA.

- **Lesson id:** `series-parallel` · **Track:** T0 Foundations
- **Prerequisites:** `ohms-law`
- **Power element:** `SW1` (powerLabel: "Connect battery")

## Learning goals

1. Combine series resistors by adding, and parallel resistors by adding conductances (product over sum for two).
2. State that series parts share one current, and parallel parts share one voltage.
3. Split a current between parallel branches with the current-divider rule.
4. Explain why a low-value branch takes most of the current.

## Board

Board: `NET-04`, size 14 × 9, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| pack | `battery-aa-pack` (4 × AA) | `offboard` | PACK | 6 V nominal from four alkaline cells. | `V_PACK` |
| sw | `switch-slide` | `tht` | SWITCH | Connects the pack. | `SW1` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the network. | — |
| r1 | `resistor` (1 kΩ, 1/4 W) | `tht` | SERIES | Carries the whole current. | `R1` |
| r2 | `resistor` (2.2 kΩ, 1/4 W) | `tht` | BRANCH | One of two parallel paths. | `R2` |
| r3 | `resistor` (3.3 kΩ, 1/4 W) | `tht` | SHUNT | The other parallel path. | `R3` |
| m1 | `multimeter` (mA) | `offboard` | TOTAL | Total current. | `P_T` |
| tp2, tp3 | `testpoint` | `tht` | METER | Clip points for branch currents. | `P_2`, `P_3` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_PACK` | V | `pk+`, `0` | 6.0 V, rInternal 0.6 Ω | — | 4 × AA, ~0.15 Ω/cell |
| `SW1` | SW | `pk+`, `sw` | closed: false | maxI 0.5 A | **power element** |
| `P_T` | PROBE | `sw`, `a` | — | — | total current |
| `R1` | R | `a`, `b` | 1000 Ω | maxP 0.25 W | |
| `P_2` | PROBE | `b`, `c2` | — | — | |
| `R2` | R | `c2`, `0` | 2200 Ω | maxP 0.25 W | |
| `P_3` | PROBE | `b`, `c3` | — | — | |
| `R3` | R | `c3`, `0` | 3300 Ω | maxP 0.25 W | |

Expected: I_T = 2.59 mA, V_b = 3.41 V, I_2 = 1.55 mA, I_3 = 1.03 mA.

## Readouts

| label | source | unit |
|---|---|---|
| TOTAL I | `{kind:'current', elementId:'P_T'}` | A |
| I(R2) | `{kind:'current', elementId:'P_2'}` | A |
| I(R3) | `{kind:'current', elementId:'P_3'}` | A |
| JUNCTION V | `{kind:'voltage', node:'b'}` | V |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| R3 | `R3` | value | 100 | 100000 | — | yes | Ω |
| R1 | `R1` | value | 100 | 10000 | — | yes | Ω |

Drag R3 very high and the network behaves as R1 + R2. Drag it low and it swallows the current while JUNCTION V collapses.

## Failures

### F1: R3 goes open
- **Patch:** `{op:'remove', elementId:'R3'}`
- **Sim shows:** TOTAL I 1.87 mA, JUNCTION V 4.12 V, I(R3) 0.
- **Why:** with one branch gone the network is 1 k + 2.2 k = 3.2 kΩ, so I = 6/3200 = 1.875 mA.

### F2: Solder bridge shorts the parallel pair
- **Patch:** `{op:'short', a:'b', b:'0'}`
- **Sim shows:** TOTAL I ≈ 6.0 mA, JUNCTION V 0 V, branch currents 0.
- **Why:** a short is a zero-ohm branch in parallel, so the parallel combination becomes 0 Ω and R1 takes the full 6 V (36 mW, still safe).

### F3: Someone adds a 100 Ω resistor across R2
- **Patch:** `{op:'add', element:{id:'R_X', type:'R', nodes:['b','0'], value:100, rating:{maxP:0.25}}}`
- **Sim shows:** TOTAL I ≈ 5.5 mA, JUNCTION V ≈ 0.51 V, R2 and R3 currents drop by about 7×.
- **Why:** 100 ∥ 2.2 k ∥ 3.3 k ≈ 93 Ω. A parallel combination is always smaller than its smallest member.

## Meet the board

**Series:** one current flows through every part, and the voltages add. R_series = R₁ + R₂ + …

**Parallel:** every branch sees the same voltage, and the currents add. Conductances (1/R) add: 1/R_par = 1/R₂ + 1/R₃. For two resistors, R_par = R₂·R₃ / (R₂ + R₃).

Worked on this board:

- R2 ∥ R3 = (2200 × 3300) / 5500 = **1320 Ω**
- Total = 1000 + 1320 = **2320 Ω** (the pack's 0.6 Ω barely matters)
- I = 6 / 2320 = **2.59 mA**
- V across R1 = 2.59 mA × 1 kΩ = 2.59 V, leaving V_b = 6 − 2.59 = **3.41 V**

Now split the current. Each branch gets I_branch = V_b / R_branch:

- I₂ = 3.41 / 2200 = **1.55 mA**
- I₃ = 3.41 / 3300 = **1.03 mA**

Check: 1.55 + 1.03 = 2.58 mA ✓.

The current-divider shortcut gives the same answer: I₂ = I·R₃/(R₂ + R₃) = 2.59 × 3.3/5.5 = 1.55 mA. The *larger* resistor takes the *smaller* share.

## For mechanical engineers

> Picture pipes. Pipes in series carry the same flow, and their pressure drops add. Pipes in parallel share the same pressure drop, and their flows add. A fat bypass pipe in parallel steals most of the flow, just as the 100 Ω resistor does in F3. **Where it breaks:** a real pipe tee has junction losses and the flow split depends on Reynolds number. An electrical node is lossless and perfectly linear, so the split is fixed by the resistances alone.

## Pro tips

1. Sanity-check every parallel result: it must be below the smallest resistor. Two equal resistors in parallel give exactly half.
2. Parallel resistors share power. Two 200 Ω, 1/4 W parts in parallel make a 100 Ω, 1/2 W resistor, which is handy when the drawer lacks the right part.
3. Series resistors share voltage. Mains-side or high-voltage dividers use several resistors in series to stay inside each part's maximum working voltage.

## Quiz

1. **What is 4.7 kΩ ∥ 4.7 kΩ?**
   - 9.4 kΩ
   - 4.7 kΩ
   - 2.35 kΩ
   - 1.18 kΩ
   - **Answer:** 2. *Why:* two equal resistors in parallel give half: 2.35 kΩ.

2. **100 Ω, 220 Ω and 330 Ω in series on 9 V. What is the current?**
   - 13.8 mA
   - 27.3 mA
   - 41.0 mA
   - 90.0 mA
   - **Answer:** 0. *Why:* R = 650 Ω, so I = 9/650 = 13.8 mA.

3. **You add a resistor in parallel with an existing one. The total resistance…**
   - always rises
   - always falls
   - stays the same
   - depends on the supply voltage
   - **Answer:** 1. *Why:* adding a branch adds conductance, so the total resistance must fall.

4. **10 mA enters a 1 kΩ ∥ 3 kΩ pair. How much goes through the 1 kΩ?**
   - 2.5 mA
   - 3.3 mA
   - 5.0 mA
   - 7.5 mA
   - **Answer:** 3. *Why:* I₁ = I·R₂/(R₁ + R₂) = 10 × 3/4 = 7.5 mA. The smaller resistor takes the larger share.
