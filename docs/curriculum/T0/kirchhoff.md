# Kirchhoff's Laws

*Nodes and loops*

> Two supplies at 9 V and 5 V meet at one node through three 1 kΩ arms, and the node settles at 4.67 V.

- **Lesson id:** `kirchhoff` · **Track:** T0 Foundations
- **Prerequisites:** `series-parallel`
- **Power element:** `SW_OUT` (powerLabel: "Output ON"), the dual supply's common output button

## Learning goals

1. Apply Kirchhoff's current law (KCL): the currents into a node sum to zero.
2. Apply Kirchhoff's voltage law (KVL): the voltages around any closed loop sum to zero.
3. Solve a two-source network with one node equation, and verify it with a loop.
4. Read a negative current as "flowing opposite to the arrow I guessed", and know that a real bench supply usually can't sink it.

## Board

Board: `KCL-05`, size 14 × 9, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| psu | `module` (title "DUAL PSU", two channels) | `offboard` | SUPPLY | Channel 1 at 9 V, channel 2 at 5 V, sharing one common terminal. | `V1`, `V2`, `SW_OUT` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the network. | — |
| r1 | `resistor` (1 kΩ, 1/4 W) | `tht` | WEST | Arm from the 9 V channel. | `R1` |
| r2 | `resistor` (1 kΩ, 1/4 W) | `tht` | SINK | Arm from the node to ground. | `R2` |
| r3 | `resistor` (1 kΩ, 1/4 W) | `tht` | EAST | Arm from the 5 V channel. | `R3` |
| tp1–tp3 | `testpoint` | `tht` | AMMETER | Current-sense points in each arm. | `P1`, `P2`, `P3` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V1` | V | `v1`, `com` | 9.0 V, rInternal 0.01 Ω | — | channel 1 |
| `V2` | V | `v2`, `com` | 5.0 V, rInternal 0.01 Ω | — | channel 2 |
| `SW_OUT` | SW | `com`, `0` | closed: false | — | **power element**; common return |
| `P1` | PROBE | `v1`, `p1` | — | — | |
| `R1` | R | `p1`, `a` | 1000 Ω | maxP 0.25 W | |
| `P2` | PROBE | `a`, `p2` | — | — | |
| `R2` | R | `p2`, `0` | 1000 Ω | maxP 0.25 W | |
| `P3` | PROBE | `v2`, `p3` | — | — | |
| `R3` | R | `p3`, `a` | 1000 Ω | maxP 0.25 W | |

Expected: V_a = 4.667 V; I1 = 4.333 mA, I3 = 0.333 mA, I2 = 4.667 mA.

## Readouts

| label | source | unit |
|---|---|---|
| NODE A | `{kind:'voltage', node:'a'}` | V |
| I1 (WEST) | `{kind:'current', elementId:'P1'}` | A |
| I3 (EAST) | `{kind:'current', elementId:'P3'}` | A |
| I2 (SINK) | `{kind:'current', elementId:'P2'}` | A |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Channel 1 | `V1` | value | 0 | 15 | 0.1 | no | V |
| Channel 2 | `V2` | value | 0 | 15 | 0.1 | no | V |
| Sink arm | `R2` | value | 100 | 10000 | — | yes | Ω |

Raise channel 1 slowly and watch I3 shrink to zero and then go negative.

## Failures

### F1: Turn channel 1 up to 12 V
- **Patch:** `{op:'set', elementId:'V1', key:'value', value:12}`
- **Sim shows:** NODE A 5.67 V, I3 = −0.667 mA (current flows *into* the 5 V channel).
- **Why:** V_a now sits above 5 V, so the east arm carries current back toward channel 2. The ideal source in the sim absorbs it. A real linear bench supply usually can't sink current, so its output would drift upward instead.

### F2: The sink arm goes open
- **Patch:** `{op:'remove', elementId:'R2'}`
- **Sim shows:** NODE A 7.0 V, I1 = 2.0 mA, I3 = −2.0 mA.
- **Why:** with no path to ground, the only loop runs from 9 V to 5 V through 2 kΩ: I = (9 − 5)/2000 = 2 mA, all of it pushed into channel 2.

### F3: Short node A to ground
- **Patch:** `{op:'short', a:'a', b:'0'}`
- **Sim shows:** NODE A 0 V, I1 = 9.0 mA, I3 = 5.0 mA; 14 mA flows down the short.
- **Why:** each arm now sees its full source voltage across 1 kΩ, and KCL still holds: 9 + 5 = 14 mA leaves through the short. R1 dissipates 81 mW, which is safe.

## Meet the board

Two conservation laws solve every circuit:

- **KCL (charge is conserved):** at any node, current in = current out, so Σ I = 0.
- **KVL (energy is conserved):** around any closed loop, rises equal drops, so Σ V = 0.

**Node equation.** Call the junction voltage V_a and assume the two source arms flow *into* node A and the sink arm flows *out*:

(9 − V_a)/1k + (5 − V_a)/1k = V_a/1k

so 14 = 3·V_a, and **V_a = 4.667 V**.

**Currents.**

- I1 = (9 − 4.667)/1k = **4.333 mA**
- I3 = (5 − 4.667)/1k = **0.333 mA**
- I2 = 4.667/1k = **4.667 mA**

KCL check: 4.333 + 0.333 = 4.667 ✓.

**Loop check (KVL)**, around channel 1 → R1 → R2 → ground: 9 − 4.333 − 4.667 = 0 ✓.

If you guess a current's direction wrong, the algebra simply returns a negative number. In F1 the east arm comes out at −0.667 mA, meaning the current really flows from the node into the 5 V source.

The simulator uses this same idea, called modified nodal analysis: one KCL equation per node, solved together.

## For mechanical engineers

> KCL is mass continuity at a pipe tee: what flows in must flow out, since a junction stores nothing. KVL is like elevation around a hiking loop: however you wander, you return to the height you started at, so the ups and downs sum to zero. **Where it breaks:** KCL assumes a node can't store charge, which fails once capacitance between conductors matters (fast edges, RF). KVL fails when a changing magnetic flux threads the loop, because the induced EMF is not a "drop" at any single component.

## Pro tips

1. Pick current directions arbitrarily, write the equations and let the signs speak. Don't stop to "fix" arrows mid-calculation.
2. Most bench supplies can't sink current. When two sources fight, add a load resistor or series diode so neither one gets back-fed.
3. Choose as ground the node with the most connections. It removes the most unknowns and matches how you'll probe with a scope.

## Quiz

1. **Three wires meet at a node. 3 mA and 5 mA flow in, and 2 mA flows out on the first exit. What flows out of the second exit?**
   - 0 mA
   - 6 mA
   - 4 mA
   - 10 mA
   - **Answer:** 1. *Why:* KCL: 3 + 5 = 2 + I, so I = 6 mA.

2. **A 12 V source drives three series resistors. Two drop 4.5 V and 3.3 V. What does the third drop?**
   - 4.2 V
   - 7.8 V
   - 3.3 V
   - 12 V
   - **Answer:** 0. *Why:* KVL: 12 − 4.5 − 3.3 = 4.2 V.

3. **On this board, channel 2 is set to 0 V (output still connected). What is node A?**
   - 0 V
   - 4.5 V
   - 9.0 V
   - 3.0 V
   - **Answer:** 3. *Why:* (9 − V_a) + (0 − V_a) = V_a, so 9 = 3·V_a and V_a = 3 V.

4. **Your node analysis gives I3 = −0.67 mA. What does that mean?**
   - The calculation is wrong
   - The resistor is shorted
   - The current is 0.67 mA, flowing opposite to your assumed arrow
   - The current is zero because current can't be negative
   - **Answer:** 2. *Why:* a negative result only says the real direction is opposite to your guess.

## SIM NOTE

- Optional `V` flag `sinkCapable: false` (source-only): a bench-supply channel that rises when back-fed instead of absorbing current. F1 and F2 would then show the real-world drift. Until then the `explain` text notes it.
