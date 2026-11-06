# Power and Heat

*Where the watts go*

> A 47 Ω resistor across 5 V turns 0.53 W into heat, more than twice what a 1/4 W part is rated for.

- **Lesson id:** `power-heat` · **Track:** T0 Foundations
- **Prerequisites:** `ohms-law`
- **Power element:** `SW_OUT` (powerLabel: "Output ON")

## Learning goals

1. Calculate power with P = V·I, P = I²·R and P = V²/R, and pick the convenient form.
2. Relate electrical power to temperature rise through a thermal resistance (°C/W).
3. Read a resistor's power rating and derating curve, and apply a 50% design margin.
4. Recognise that current squared, not current, sets the heating.

## Board

Board: `HEAT-03`, size 12 × 8, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| psu | `module` (title "BENCH PSU") | `offboard` | SUPPLY | Adjustable DC supply. | `V_PSU`, `SW_OUT` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the parts. | — |
| r1 | `resistor` (220 Ω, 1/4 W carbon film) | `tht` | HOT | The part we deliberately heat. | `R1` |
| meter | `multimeter` (mA, in series) | `offboard` | AMMETER | Loop current. | `P_I` |
| tc | `probe` (thermocouple tip, visual) | `offboard` | TEMP | Touches the resistor body; its reading comes from a behavior. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_PSU` | V | `psu+`, `0` | 5.0 V, rInternal 0.01 Ω | — | bench supply |
| `SW_OUT` | SW | `psu+`, `out` | closed: false | — | **power element** |
| `P_I` | PROBE | `out`, `r_top` | — | — | ammeter |
| `R1` | R | `r_top`, `0` | 220 Ω | maxP 0.25 W, maxV 250 V | rated 0.25 W at 70 °C ambient, derated linearly to 0 W at 155 °C |

Expected: I = 22.7 mA, P = 0.114 W (45% of rating).

## Readouts

| label | source | unit |
|---|---|---|
| CURRENT | `{kind:'current', elementId:'P_I'}` | A |
| POWER | `{kind:'power', elementId:'R1'}` | W |
| BODY TEMP | `{kind:'behavior', key:'R1.temp'}` | °C |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Resistance | `R1` | value | 22 | 1000 | — | yes | Ω |
| Supply voltage | `V_PSU` | value | 0 | 12 | 0.1 | no | V |

Halving R at constant V doubles the power. Doubling V at constant R quadruples it. Watch BODY TEMP climb slowly after each change, since heat takes time to build.

## Failures

### F1: 47 Ω on 5 V
- **Patch:** `{op:'set', elementId:'R1', key:'value', value:47}`
- **Sim shows:** POWER 0.53 W; R1 burns (open) after 300 ms and the current drops to 0.
- **Why:** P = V²/R = 25/47 = 0.53 W, 213% of the rating. A real part discolours and smells within seconds to minutes, then may go open.

### F2: Same resistor, supply turned up to 12 V
- **Patch:** `{op:'set', elementId:'V_PSU', key:'value', value:12}`
- **Sim shows:** CURRENT 54.5 mA, POWER 0.65 W, R1 burnt.
- **Why:** the voltage went up 2.4×, so power went up 2.4² = 5.8×. Heating follows the square.

### F3: Fit a 2 W resistor instead
- **Patches:** `{op:'set', elementId:'R1', key:'value', value:47}`, `{op:'set', elementId:'R1', key:'rating.maxP', value:2}`
- **Sim shows:** POWER 0.53 W again, but R1 survives.
- **Why:** a larger body has a lower thermal resistance to air, so the same watts make a smaller temperature rise. Its rating reflects that.

## Meet the board

Power is the rate energy is converted, in watts (J/s). Combining P = V·I with Ohm's law gives three forms:

**P = V·I = I²·R = V²/R**

With 5 V across 220 Ω: I = 5/220 = 22.7 mA, so P = 5 × 0.0227 = **0.114 W**. Swap in 47 Ω and P = 25/47 = **0.53 W**.

In a resistor, all of that power becomes heat, and heat raises temperature through a **thermal resistance** θ (°C/W): ΔT = P·θ. The rating sets θ. A typical carbon-film datasheet allows 0.25 W at 70 °C ambient, falling to zero at 155 °C. So full power raises the hot spot by about 155 − 70 = 85 °C, giving θ ≈ 85 / 0.25 ≈ **340 °C/W**.

At 0.114 W the rise is 0.114 × 340 ≈ **39 °C**: about 64 °C on a 25 °C bench, too hot to hold but safe. At 0.53 W the rise would be about 180 °C.

Heating also takes time. Power appears instantly, but the body's thermal mass makes temperature climb over several seconds.

Design rule: run resistors at **50% or less** of their rating, and less again in a hot enclosure.

## For mechanical engineers

> This is your thermal-resistance network with different labels. Heat flow in watts plays the role of current, temperature difference plays voltage, and θ in °C/W is the resistance: ΔT = P·θ, exactly Ohm's law. The body's heat capacity is a capacitor, so temperature rises along an RC-style exponential. **Where it breaks:** convection and radiation are nonlinear in temperature, so θ falls somewhat as the part gets hotter. Electrical resistance also shifts with temperature, which feeds back into the power.

## Pro tips

1. Derate to 50%. A "1/4 W" resistor should see no more than about 0.125 W in a design you want to last.
2. Surface-mount power ratings depend heavily on the copper around the pads: typically 0603 ≈ 0.1 W, 0805 ≈ 0.125 W, 1206 ≈ 0.25 W. Check the datasheet's land-pattern assumptions.
3. Pulse loads are judged by energy and duty, not peak power. Resistors have separate pulse-withstand curves, so use them for inrush and snubber parts.

## Quiz

1. **What does a 330 Ω resistor dissipate on 12 V?**
   - 0.036 W
   - 0.25 W
   - 0.436 W
   - 3.96 W
   - **Answer:** 2. *Why:* P = V²/R = 144/330 = 0.436 W.

2. **50 mA flows through 100 Ω. What is the power?**
   - 0.025 W
   - 0.25 W
   - 5 W
   - 2.5 W
   - **Answer:** 1. *Why:* P = I²R = 0.0025 × 100 = 0.25 W, right at a 1/4 W rating, so too hot for a real design.

3. **The current through a resistor triples. The heat produced…**
   - triples
   - stays the same
   - rises 6×
   - rises 9×
   - **Answer:** 3. *Why:* P = I²R, and 3² = 9.

4. **A resistor is rated 0.25 W at 70 °C and derates linearly to 0 W at 155 °C. What may it dissipate at 112.5 °C ambient?**
   - 0.25 W
   - 0.125 W
   - 0.0625 W
   - 0 W
   - **Answer:** 1. *Why:* 112.5 °C is halfway between 70 and 155 °C, so half the rating: 0.125 W.

## SIM NOTE

- Behavior `thermal-rc`: per-element first-order thermal model, T = T_amb + P·θ with time constant τ_th (≈ 340 °C/W and τ_th ≈ 20 s for a 1/4 W axial body; a 2 W body ≈ 70 °C/W). Publishes `R1.temp`. Ideally the burn decision uses temperature, not the fixed 300 ms over-power timer.
- `FailurePatch` `set` with a nested key (`rating.maxP`) needs support in `applyPatches`.
- `θ` for the 2 W body is an illustrative engine value; tune it against a datasheet derating curve when implementing.
