# Charge, Voltage and Current

*Electrons on the move*

> Two AA cells push about 12 mA through a red LED, which is roughly 75 million billion electrons every second.

- **Lesson id:** `charge-voltage-current` · **Track:** T0 Foundations
- **Prerequisites:** none (first lesson after "Start here")
- **Power element:** `SW1` (powerLabel: "Flip the switch")

## Learning goals

1. Define charge (coulomb), current (coulombs per second) and voltage (joules per coulomb), and convert between them.
2. Explain why current needs a closed loop but voltage exists across an open gap.
3. Tell conventional current direction (+ to −) apart from electron flow.
4. Estimate how long a battery lasts from its mAh rating and a measured current.

## Board

Board: `CHARGE-01`, size 12 × 8, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the parts; each 5-hole strip is one electrical node. | — |
| bat | `battery-aa-pack` (2 × AA) | `offboard` | CELLS | Two alkaline AA cells in series: about 3.0 V of push. | `V_BAT` |
| sw | `switch-slide` | `tht` | SWITCH | Opens or closes the loop. | `SW1` |
| meter | `multimeter` (A mode, in series) | `offboard` | AMMETER | Counts the charge flowing past per second. | `P_I` |
| r1 | `resistor` (100 Ω, 1/4 W carbon film) | `tht` | LIMIT | Sets how much current the loop allows. | `R1` |
| led1 | `led` (5 mm red) | `tht` | LAMP | Turns current into visible light; brightness follows current. | `LED1` |
| w1–w4 | `wire` | `offboard` | — | Jumpers closing the loop. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_BAT` | V | `bat+`, `0` | 3.0 V, rInternal 0.3 Ω | — | 2 × AA alkaline, ~0.15 Ω per fresh cell |
| `SW1` | SW | `bat+`, `sw` | closed: false | maxI 0.5 A | **power element**; miniature slide switch |
| `P_I` | PROBE | `sw`, `r_in` | — | — | ammeter (ideal) |
| `R1` | R | `r_in`, `led_a` | 100 Ω | maxP 0.25 W, maxV 250 V | 1/4 W carbon film |
| `LED1` | LED | `led_a`, `0` | color: red | maxI 0.03 A, maxV 5 V | 20 mA continuous, 30 mA absolute max, 5 V reverse |

Expected: I ≈ (3.0 − 1.78) / 100.3 ≈ 12 mA.

## Readouts

| label | source | unit |
|---|---|---|
| CURRENT | `{kind:'current', elementId:'P_I'}` | A |
| BATTERY | `{kind:'voltage', node:'bat+'}` | V |
| LED VOLTS | `{kind:'voltage', node:'led_a'}` | V |
| CHARGE MOVED | `{kind:'behavior', key:'coulombs'}` | '' (coulombs; see SIM NOTE) |
| ELECTRONS / s | `{kind:'behavior', key:'electronsPerSec'}` | '' |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Limit resistor | `R1` | value | 47 | 1000 | — | yes | Ω |
| Cells in series | `V_BAT` | value | 1.5 | 4.5 | 1.5 | no | V |

Turning the resistor down raises the current and the LED gets brighter. Three cells with 47 Ω pushes past the LED's 30 mA limit and it burns, so the slider can do damage.

## Failures

### F1: Open the loop
- **Patch:** `{op:'remove', elementId:'R1'}`
- **Sim shows:** CURRENT 0 A, LED dark, BATTERY still 3.0 V.
- **Why:** charge can only flow around a complete loop. The battery's voltage is still there, but without a path no charge moves.

### F2: Bypass the resistor with a jumper
- **Patch:** `{op:'short', a:'r_in', b:'led_a'}`
- **Sim shows:** current jumps well past 30 mA, and after 300 ms LED1 is marked burnt (open), so the current falls to 0.
- **Why:** an LED's current rises exponentially with voltage. Without a resistor, only the cells' 0.3 Ω internal resistance limits it, and 3 V is far above a red LED's ~1.8 V.

### F3: Put the cells in backwards
- **Patch:** `{op:'set', elementId:'V_BAT', key:'value', value:-3}`
- **Sim shows:** CURRENT ≈ 0 A, LED dark, no damage.
- **Why:** an LED is a diode and conducts one way only. 3 V of reverse bias is inside its 5 V reverse rating.

## Meet the board

**Charge** (Q) is counted in coulombs; one coulomb is about 6.24 × 10¹⁸ electrons. **Current** (I) is the rate charge passes a point: 1 ampere = 1 coulomb per second. **Voltage** (V) is the energy each coulomb gains or gives up: 1 volt = 1 joule per coulomb.

Here two AA cells give 3.0 V. The red LED takes about 1.8 V, so the resistor gets the rest:

I = (3.0 V − 1.8 V) / 100 Ω ≈ **12 mA**

That is 0.012 C/s, or 0.012 / 1.602 × 10⁻¹⁹ ≈ 7.5 × 10¹⁶ electrons every second. In one minute, Q = I·t = 0.012 × 60 = **0.72 C** goes around the loop. None of it is used up: the same charge comes back to the battery. What is spent is energy, at P = V·I = 3.0 × 0.012 = 36 mW.

The battery's rating converts the same way. 2500 mAh means 2.5 A·h = 2.5 × 3600 = 9000 C. At 12 mA that lasts 2500 / 12 ≈ **208 hours**, if the rating holds at this drain.

By convention, current flows from + to −. The electrons actually drift the other way, very slowly, but the push travels around the loop almost instantly.

## For mechanical engineers

> Think of a closed hydraulic loop. The battery is a pump that adds pressure (voltage), the flow rate is current, and the volume of fluid moved is charge. The resistor is an orifice and the LED is a check valve that needs some cracking pressure before it passes flow. As in hydraulics, the fluid is not used up; it goes around. **Where it breaks:** cutting a wire does not spill anything. The "pressure" simply sits across the gap. And the push propagates at a large fraction of light speed, far faster than any pressure wave in oil.

## Pro tips

1. When a circuit does nothing, trace the return path back to the source's negative terminal first. An open loop is the most common fault on any bench.
2. A battery's mAh rating is specified at a light, stated discharge rate. At high currents an alkaline cell delivers noticeably less, so check the datasheet's curves rather than dividing.
3. Agree on a polarity habit: red lead on the higher-potential side, and write down the sign of every reading. Negative numbers are information, not mistakes.

## Quiz

1. **A loop carries 12 mA for 10 minutes. How much charge passed?**
   - 0.12 C
   - 7.2 C
   - 72 C
   - 720 C
   - **Answer:** 1. *Why:* Q = I·t = 0.012 A × 600 s = 7.2 C.

2. **What does "1 volt" mean physically?**
   - One coulomb per second
   - One joule of energy per coulomb of charge
   - One watt per ampere squared
   - The number of electrons in a wire
   - **Answer:** 1. *Why:* voltage is energy per unit charge, 1 V = 1 J/C.

3. **A 2500 mAh pack powers a 12 mA load. Roughly how long does it last?**
   - 21 h
   - 30 h
   - 208 h
   - 2083 h
   - **Answer:** 2. *Why:* 2500 mAh / 12 mA ≈ 208 h, if the rating holds at that drain.

4. **With R1 pulled out, what voltage does a meter read across the empty gap?**
   - 0 V
   - 1.2 V
   - 1.8 V
   - 3.0 V
   - **Answer:** 3. *Why:* with no current there is no drop across the LED or the internal resistance, so the full 3.0 V appears across the gap.

## SIM NOTE

- Behavior `coulomb-counter`: integrates the current of `P_I` over sim time and publishes `coulombs` and `electronsPerSec` (= I / 1.602e-19).
- `Readout.unit` has no coulomb option; add `'C'`, or show the readout unitless.
