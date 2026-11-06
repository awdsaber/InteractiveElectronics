# The Breadboard

*Hidden metal strips*

> A 330 Ω resistor and a red LED on 5 V draw about 10 mA, unless two legs land in the same 5-hole strip.

- **Lesson id:** `breadboard` · **Track:** T0 Foundations
- **Prerequisites:** `charge-voltage-current`, `ohms-law`
- **Power element:** `SW_PWR` (powerLabel: "Press module power button")

## Learning goals

1. Map a solderless breadboard's internal connections: 5-hole terminal strips, the centre channel and the power rails.
2. Translate a schematic into breadboard placement, node by node.
3. Diagnose the three classic placement errors: a part shorted within one strip, a part missing its strip, and a split rail.
4. Know the breadboard's limits: about 1 A per contact, contact resistance, and stray capacitance.

## Board

Board: `PROTO-08`, size 17 × 6, base `breadboard-only`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| bb | `breadboard` (830-point) | `offboard` | BREADBOARD | Every 5-hole strip is one node; the rails run along the edges. | `W_RAIL` |
| pwr | `module` (title "MB102-style 5 V/3.3 V") | `module` | RAILS | Plug-on supply module feeding the rails from USB. | `V_USB`, `SW_PWR` |
| r1 | `resistor` (330 Ω, 1/4 W) | `tht` | LIMIT | Sets the LED current; spans row 10 to row 15. | `R1` |
| led1 | `led` (5 mm red) | `tht` | LED | Indicator; spans row 15 to row 20. | `LED1` |
| j1 | `wire` (red) | `offboard` | JUMPER | + rail to row 10. | `W1` |
| j2 | `wire` (black) | `offboard` | RETURN | Row 20 to − rail. | `W2` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_USB` | V | `usb`, `0` | 5.0 V, rInternal 0.1 Ω | — | USB 5 V via module |
| `SW_PWR` | SW | `usb`, `rail+` | closed: false | maxI 0.7 A | **power element**; module push switch |
| `W1` | R | `rail+`, `row10` | 0.02 Ω | maxI 1 A | jumper + two contacts |
| `R1` | R | `row10`, `row15` | 330 Ω | maxP 0.25 W | |
| `LED1` | LED | `row15`, `row20` | color: red | maxI 0.03 A, maxV 5 V | 20 mA continuous |
| `W2` | R | `row20`, `rail-` | 0.02 Ω | maxI 1 A | |
| `W_RAIL` | R | `rail-`, `0` | 0.02 Ω | maxI 1 A | − rail back to the module's ground |

Expected: I ≈ (5 − 1.8)/330 ≈ 9.7 mA.

## Readouts

| label | source | unit |
|---|---|---|
| LED CURRENT | `{kind:'current', elementId:'LED1'}` | A |
| ROW 15 | `{kind:'voltage', node:'row15'}` | V |
| + RAIL | `{kind:'voltage', node:'rail+'}` | V |
| − RAIL | `{kind:'voltage', node:'rail-'}` | V |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Limit resistor | `R1` | value | 100 | 4700 | — | yes | Ω |

## Failures

### F1: Both resistor legs pushed into row 10
- **Patch:** `{op:'remove', elementId:'R1'}` (the resistor now connects row 10 to itself, so nothing reaches row 15)
- **Sim shows:** LED CURRENT 0, ROW 15 at ~0 V.
- **Why:** a part whose two legs share a strip is shorted on itself and bridges nothing, so the series path is open.

### F2: LED legs in the same strip
- **Patch:** `{op:'short', a:'row15', b:'row20'}`
- **Sim shows:** LED dark; current through R1 rises to ≈ 15 mA.
- **Why:** the strip shorts the LED out. R1 alone sets the current: 5/330 = 15.2 mA (76 mW, safe).

### F3: Split ground rail
- **Patch:** `{op:'remove', elementId:'W_RAIL'}`
- **Sim shows:** LED dark; − RAIL floats toward the + rail voltage (almost no current flows, so almost nothing drops). A meter on the − rail will mislead you.
- **Why:** many full-length breadboards break each rail at the midpoint, often marked by a gap in the printed line. The return path is missing until you bridge it.

### F4: A jumper lands in row 15 instead of row 10
- **Patch:** `{op:'short', a:'rail+', b:'row15'}`
- **Sim shows:** LED current leaps past 30 mA; LED1 burns after 300 ms.
- **Why:** the resistor is bypassed and the LED sits directly on 5 V. One hole off, and the circuit changes.

## Meet the board

Under the plastic, every **terminal strip** is a spring-metal clip joining 5 holes. In the usual orientation, a numbered row of a–e is one node and f–j is another. The **centre channel** (0.3 in / 7.62 mm wide) separates them so a DIP chip can straddle it with each pin on its own node. The long **power rails** along each edge carry + and −.

Build node by node, not part by part. This circuit has four nodes: + rail, row 10, row 15 and row 20/− rail. The resistor spans rows 10 → 15, the LED spans 15 → 20 with its long leg (anode) at 15, and jumpers connect the rails.

The current follows from KVL around the loop:

I = (5.0 V − 1.8 V) / 330 Ω ≈ **9.7 mA**, and P_R = I²R = 0.0097² × 330 ≈ **31 mW**.

**Limits.**

- Contacts are typically rated about **1 A**, and each adds a few tens of milliohms.
- Adjacent strips have a few picofarads of capacitance between them, so breadboards are poor for signals above a few MHz.
- Thick leads (power diodes, header pins) stretch the clips and make later contacts unreliable.

## For mechanical engineers

> A breadboard is a manifold block with drilled galleries: every port along one gallery is at the same pressure, and the centre channel is a solid web keeping two galleries apart. Placing a part means choosing which two galleries it bridges. **Where it breaks:** a manifold's galleries are visible on the drawing, but a breadboard's are hidden, so errors are invisible until measured. Its spring contacts also wear and loosen, giving intermittent faults that a machined block would never have.

## Pro tips

1. Colour-code your wiring: red for supply, black or blue for ground, and other colours for signals. Keep the top rail positive on every board you build so your hands learn it.
2. Use 22 AWG (0.64 mm) solid-core wire. Stranded wire frays in the clips, and fat leads damage them.
3. Before you power up, use the meter's continuity mode to check rail-to-rail (it must *not* beep) and each intended connection (it must beep).

## Quiz

1. **How many holes does one standard terminal strip connect?**
   - 2
   - 5
   - 10
   - 30
   - **Answer:** 1. *Why:* each strip joins 5 holes (a–e or f–j in one row).

2. **What resistor gives a green LED (Vf 2.1 V) about 10 mA from 5 V?**
   - 29 Ω
   - 210 Ω
   - 290 Ω (use 270 or 330 Ω)
   - 500 Ω
   - **Answer:** 2. *Why:* R = (5 − 2.1)/0.010 = 290 Ω. The nearest standard values are 270 Ω and 330 Ω.

3. **On this board the LED's legs end up in the same strip. What current flows through the 330 Ω resistor?**
   - 0 mA
   - 9.7 mA
   - 15.2 mA
   - 30 mA
   - **Answer:** 2. *Why:* the LED is shorted, so all 5 V falls across R1: 5/330 = 15.2 mA.

4. **Why do DIP ICs straddle the centre channel?**
   - To keep them cool
   - So each pin lands in its own strip instead of being shorted to the pin opposite
   - Because the channel carries the supply
   - So the chip can't be inserted backwards
   - **Answer:** 1. *Why:* without the channel, opposite pins would share a strip and be connected together.
