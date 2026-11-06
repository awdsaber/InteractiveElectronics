# Logic Gates

*Transistors that decide*

> Four MOSFETs make a CMOS NAND gate: its output falls to about 0 V only when both inputs are at 5 V.

- **Lesson id:** `logic-gates` · **Track:** T3 Digital
- **Prerequisites:** `mosfet-switch`
- **Power element:** `V_SUP` (powerLabel: "Connect 5 V")

## Learning goals

1. Write the truth tables for NOT, AND, OR, NAND, NOR and XOR, and explain why NAND alone can build all of them.
2. Explain CMOS structure: a PMOS pull-up network and a complementary NMOS pull-down network, with almost no static current.
3. Use logic-level thresholds (V_IH, V_IL) to decide whether a voltage is a valid 1 or 0, including 3.3 V to 5 V interfacing.
4. Never leave a CMOS input floating, and say why.

## Board

Board: `GATE-22`, size 16 × 10, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| pwr | `module` (title "5 V SUPPLY") | `offboard` | POWER | 5 V logic rail. | `V_SUP` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the discrete gate. | — |
| ba | `button` | `tht` | INPUTA | Drives input A high while pressed. | `SW_A` |
| bbtn | `button` | `tht` | INPUTB | Drives input B high while pressed. | `SW_B` |
| rpa, rpb | `resistor` (10 kΩ ×2) | `tht` | PULLDOWN | Hold the inputs at a solid 0 when the buttons are released. | `R_PA`, `R_PB` |
| mp1, mp2 | `transistor-to92` (BS250 P-channel ×2) | `tht` | PULLUP | Parallel pull-up network: either input low makes Y high. | `MP1`, `MP2` |
| mn1, mn2 | `transistor-to92` (2N7000 N-channel ×2) | `tht` | PULLDN | Series pull-down network: both inputs high make Y low. | `MN1`, `MN2` |
| led | `led` (5 mm red) + `resistor` (1 kΩ) | `tht` | OUTPUT | Shows Y. | `LED_Y`, `R_LED` |
| chip | `ic-dip` (74HC00, quad 2-input NAND, DIP-14) | `tht` | CHIP | The same function in one package, for comparison (not simulated). | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_SUP` | V | `vcc`, `0` | 5.0 V, rInternal 0.05 Ω | — | **power element** |
| `SW_A` | SW | `vcc`, `a` | closed: false | — | |
| `R_PA` | R | `a`, `0` | 10 kΩ | maxP 0.25 W | |
| `SW_B` | SW | `vcc`, `b` | closed: false | — | |
| `R_PB` | R | `b`, `0` | 10 kΩ | maxP 0.25 W | |
| `MP1` | PMOS | `y`, `a`, `vcc` | vth −2.0, k 0.03 | maxI 0.18 A, maxP 0.83 W, maxV 45 V | BS250: V_DS −45 V, I_D −180 mA, V_GS(th) −1 to −3.5 V |
| `MP2` | PMOS | `y`, `b`, `vcc` | vth −2.0, k 0.03 | maxI 0.18 A, maxP 0.83 W, maxV 45 V | |
| `MN1` | NMOS | `y`, `a`, `m` | vth 2.1, k 0.17 | maxI 0.2 A, maxP 0.4 W, maxV 60 V | 2N7000: 60 V, 200 mA, 400 mW, V_GS(th) 0.8–3 V (typ 2.1) |
| `MN2` | NMOS | `m`, `b`, `0` | vth 2.1, k 0.17 | maxI 0.2 A, maxP 0.4 W, maxV 60 V | |
| `R_LED` | R | `y`, `led` | 1 kΩ | maxP 0.25 W | |
| `LED_Y` | LED | `led`, `0` | color: red | maxI 0.03 A, maxV 5 V | |

Expected: with A = 0 or B = 0, Y ≈ 5 V and the LED takes ≈ 3.2 mA. With A = B = 1, Y ≈ 0 V and the LED is dark. Pressing a button draws 0.5 mA through its pull-down. PMOS vth sign follows the engine's PMOS convention.

## Readouts

| label | source | unit |
|---|---|---|
| A | `{kind:'voltage', node:'a'}` | V |
| B | `{kind:'voltage', node:'b'}` | V |
| Y = NOT(A·B) | `{kind:'voltage', node:'y'}` | V |
| LED CURRENT | `{kind:'current', elementId:'LED_Y'}` | A |
| SUPPLY CURRENT | `{kind:'current', elementId:'V_SUP'}` | A |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Button A | `SW_A` | closed | 0 | 1 | 1 | no | — |
| Button B | `SW_B` | closed | 0 | 1 | 1 | no | — |
| Supply voltage | `V_SUP` | value | 2 | 6 | 0.1 | no | V |

Step through all four combinations of A and B to fill in the truth table. The LED goes out only for 1·1.

## Failures

### F1: Forget the pull-down on input A
- **Patch:** `{op:'remove', elementId:'R_PA'}`
- **Sim shows:** with button A released, node A sits near 0 V and the gate "works". That is misleading (see SIM NOTE).
- **Why:** in the sim the only thing touching node A is the tiny Gmin conductance to ground. A real floating CMOS input has nothing defining its voltage. It picks up stray charge, mains hum and neighbouring signals, wanders through the threshold, and can leave both transistors half-on, drawing extra supply current. The LED flickers or glows unpredictably.

### F2: Short the output to ground
- **Patch:** `{op:'short', a:'y', b:'0'}`
- **Sim shows:** with an input low, a PMOS pulls hard against the short. SUPPLY CURRENT jumps to tens or hundreds of mA, limited only by the PMOS on-resistance. If it passes 180 mA, MP1/MP2 burn.
- **Why:** a logic output is a switch to a rail, not a current source. A 74HC00 output in the same situation exceeds its ±25 mA absolute maximum and is damaged.

### F3: Run the discrete gate from 3 V
- **Patch:** `{op:'set', elementId:'V_SUP', key:'value', value:3}`
- **Sim shows:** with A = B = 1 the output no longer drops cleanly to ≈ 0 V, and with inputs low it sits lower than at 5 V, so the margins shrink.
- **Why:** the 2N7000's threshold is 0.8–3 V (typ 2.1 V), so 3 V of gate drive leaves almost no headroom and the FETs are barely on. Purpose-built 74HC logic is specified from 2 V to 6 V because its transistors are designed for it.

## Meet the board

Digital logic treats a voltage as one of two states: near 0 V is **0**, near V_CC is **1**. A **gate** computes an output from its inputs:

| A | B | AND | OR | NAND | NOR | XOR |
|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 1 | 1 | 0 |
| 0 | 1 | 0 | 1 | 1 | 0 | 1 |
| 1 | 0 | 0 | 1 | 1 | 0 | 1 |
| 1 | 1 | 1 | 1 | 0 | 0 | 0 |

**CMOS NAND.** Two PMOS in *parallel* connect Y to 5 V when *either* input is low. Two NMOS in *series* connect Y to ground only when *both* inputs are high. The two networks are complementary: one is always off, so in a steady state almost no current flows from rail to rail. That is why CMOS chips idle at microamps.

**Numbers.** With Y high, the LED takes (5 − 1.8)/1 kΩ ≈ **3.2 mA**. A pressed button pushes 5 V/10 kΩ = **0.5 mA** into its pull-down.

**Thresholds (74HC at 5 V).**

- V_IH ≥ 0.7·V_CC = **3.5 V** counts as a guaranteed 1, and V_IL ≤ 0.3·V_CC = **1.5 V** as a guaranteed 0. Anything in between is undefined.
- A 3.3 V MCU output therefore isn't a valid 1 for 74HC at 5 V. Use 74HCT (V_IH 2.0 V) instead.

**Universality.** NAND with its inputs tied together is NOT. NAND followed by NOT is AND. Any logic function can be built from NANDs alone.

## For mechanical engineers

> CMOS logic is fluid logic with complementary valves. Two valves in series to the drain form an AND path, and two in parallel to the supply form an OR path. Every pull-down valve has a partner pull-up valve that closes when it opens, so there's never a straight-through leak at rest, only a brief flow while switching. **Where it breaks:** electronic gates switch in about 10 ns, a million times faster than any spool. An unconnected input is worse than an unconnected pilot line: it floats to a random voltage and can hold both valves half open.

## Pro tips

1. Tie every unused CMOS input to GND or V_CC (directly or through a resistor). Floating inputs cause random behaviour and extra current.
2. Put a 100 nF ceramic capacitor across V_CC/GND at every logic IC, as close as possible. Switching edges draw sharp current spikes.
3. When mixing 3.3 V and 5 V logic, check V_IH/V_IL in both directions. 74HCT parts or level shifters fix 3.3 V → 5 V. Going 5 V → 3.3 V, protect the 3.3 V input (series resistor or a level shifter) unless its datasheet says it's 5 V tolerant.

## Quiz

1. **A NAND gate's inputs are A = 1 and B = 1. What is the output?**
   - 1
   - Undefined
   - 0
   - It depends on V_CC
   - **Answer:** 2. *Why:* NAND is NOT(A·B), and 1·1 = 1, so the output is 0.

2. **A 10 kΩ pull-down is connected to 5 V through a pressed button. What current flows?**
   - 0.5 mA
   - 0.05 mA
   - 5 mA
   - 50 mA
   - **Answer:** 0. *Why:* I = 5/10 000 = 0.5 mA.

3. **Is 3.3 V a guaranteed logic 1 for a 74HC gate running at 5 V?**
   - Yes, it's above half of V_CC
   - No, it's below V_IH = 0.7 × 5 = 3.5 V
   - Yes, anything above 2 V is high
   - No, 74HC can't run at 5 V
   - **Answer:** 1. *Why:* 3.3 V falls in the undefined band between 1.5 V and 3.5 V, so use 74HCT.

4. **How do you make an inverter from a 2-input NAND?**
   - Tie one input to ground
   - Tie the output to an input
   - It can't be done
   - Tie both inputs together
   - **Answer:** 3. *Why:* with A = B, NOT(A·A) = NOT A. (Tying the spare input to V_CC also works.)

## SIM NOTE

- **Floating inputs:** Gmin (1e-12 S to ground) makes floating nodes sit tidily near 0 V, which hides the most important real-world fault in digital electronics. A behavior `floating-input` (slow random drift plus coupled mains hum on nodes with no DC path other than Gmin), or an engine flag on unconnected high-impedance nodes, would make F1 honest.
- **Digital IC element:** the 74HC00 on the board isn't simulated. A behavior-driven logic primitive (inputs read as node voltages against V_IH/V_IL; outputs as `V` sources with ≈ 50 Ω output resistance) would allow chip-level logic lessons without discrete transistors. See also `flipflops-counters`.
- **PMOS conventions:** document whether PMOS `vth` is given as a negative number and how `k` is applied (see `mosfet-switch`).
