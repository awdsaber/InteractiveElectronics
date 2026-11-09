# The 555 Timer

*A clock built from comparators*

> R1 = 1 kΩ, R2 = 10 kΩ and 47 µF make an NE555 blink an LED at 1.46 Hz with a 52% duty cycle.

- **Lesson id:** `timer-555` · **Track:** T3 Digital
- **Prerequisites:** `capacitor-rc`, `flipflops-counters`
- **Power element:** `SW1` (powerLabel: "Connect battery")
- **Transient:** yes
- **As built:** a breadboard-only board (no solder step) with a mode selector for monostable (`SW_LINK`, `SW_PU`, `R_TRG`, `SW_TRIG`) and a blink counter; see `docs/decisions.md` (2026-11-09, timer-555).

## Learning goals

1. Describe the 555's internals: a three-resistor divider, two comparators (at ⅔ and ⅓ V_CC), an SR latch, a discharge transistor and an output stage.
2. Derive the astable timing: t_high = ln2·(R1 + R2)·C, t_low = ln2·R2·C.
3. Explain why the frequency doesn't depend on the supply voltage, and why the duty cycle of the basic circuit is always above 50%.
4. Choose between bipolar (NE555) and CMOS (TLC555) versions for supply range and current.

## Board

Board: `T555-24`, size 14 × 9, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| bat | `battery-9v` | `offboard` | BATTERY | 9 V supply. | `V_BAT` |
| sw | `switch-slide` | `tht` | SWITCH | Power. | `SW1` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the timer. | — |
| u1 | `ic-dip` (NE555, DIP-8) | `tht` | TIMER | Comparators, latch and discharge switch (modelled). | `R_D1`, `R_D2`, `R_D3`, `SW_DIS`, `V_OUT`, `R_Q` |
| r1 | `resistor` (1 kΩ) | `tht` | CHARGE | V_CC to the discharge pin (pin 7). | `R1` |
| r2 | `resistor` (10 kΩ) | `tht` | TIMING | Pin 7 to the threshold/trigger node (pins 6 and 2). | `R2` |
| c1 | `capacitor-electrolytic` (47 µF, 25 V) | `tht` | TANK | Timing capacitor. | `C1` |
| c2 | `capacitor-ceramic` (10 nF) | `tht` | CTRL | Decouples the control pin (pin 5). | `C_CTL` |
| led | `led` (red) + `resistor` (470 Ω) | `tht` | BLINK | Output indicator on pin 3. | `LED1`, `R_LED` |

## Circuit

Internal blocks (`partId: u1`) are modelled with real elements. The comparator-and-latch logic is a behavior.

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_BAT` | V | `b`, `0` | 9.0 V, rInternal 1.5 Ω | — | |
| `SW1` | SW | `b`, `vcc` | closed: false | — | **power element** |
| `R_Q` | R | `vcc`, `0` | 1.5 kΩ | — | ≈ 6 mA quiescent, between the datasheet typicals at 5 V (≈ 3 mA) and 15 V (≈ 10 mA) |
| `R_D1` | R | `vcc`, `th_ref` | 5 kΩ | — | internal divider: ⅔ V_CC at `th_ref` (pin 5) |
| `R_D2` | R | `th_ref`, `tr_ref` | 5 kΩ | — | ⅓ V_CC at `tr_ref` |
| `R_D3` | R | `tr_ref`, `0` | 5 kΩ | — | |
| `C_CTL` | C | `th_ref`, `0` | 10 nF | maxV 50 V | pin 5 decoupling |
| `SW_DIS` | SW | `dis`, `0` | closed: false (behavior) | maxI 0.2 A | discharge transistor, pin 7 (the rating is a conservative stand-in; the datasheet gives no absolute discharge maximum) |
| `V_OUT` | V | `o`, `0` | 0 or (V_CC − 1.2 V), behavior; rInternal 5 Ω | — | output stage, pin 3. Datasheet typicals: high level V_CC − 1.7 V at −100 mA (13.3 V at 15 V, 3.3 V at 5 V); low level 0.1 V at 10 mA. 1.2 V behind 5 Ω reproduces 1.7 V at 100 mA and under 0.1 V low at 10 mA |
| `R1` | R | `vcc`, `dis` | 1 kΩ | maxP 0.25 W | |
| `R2` | R | `dis`, `thr` | 10 kΩ | maxP 0.25 W | |
| `C1` | C | `thr`, `0` | 47 µF | maxV 25 V | |
| `SW_LINK` | SW | `thr`, `trg` | closed: true (astable) | — | pin 2 tied to pin 6; opened in monostable mode |
| `SW_PU` | SW | `vcc`, `pu` | closed: false | — | closed in monostable mode only; a pull-up on the capacitor node would skew the astable timing |
| `R_TRG` | R | `pu`, `trg` | 10 kΩ | maxP 0.25 W | trigger pull-up (monostable) |
| `SW_TRIG` | SW | `trg`, `0` | closed: false (momentary) | — | TRIGGER button |
| `R_LED` | R | `o`, `led` | 470 Ω | maxP 0.25 W | |
| `LED1` | LED | `led`, `0` | color: red | maxI 0.03 A, maxV 5 V | ≈ 12.7 mA when the output is high at 9 V (25 mA at 15 V) |

Behavior `ne555`: when v(thr) ≥ v(th_ref), the output goes low and SW_DIS closes. When v(thr) ≤ v(tr_ref), the output goes high and SW_DIS opens. It does nothing (output low) while V_CC < 4.5 V. It publishes `u1.freq` and `u1.duty`.

Monostable (`source-select` instance `mode` opens `SW_LINK` and closes `SW_PU`): the output gives one pulse of t = ln 3 · (R1 + R2) · C = 1.1 RC = 0.57 s after a TRIGGER press; trigger held longer than the pulse keeps the output high (the trigger comparator dominates, per the datasheet function table).

Expected: t_high ≈ 0.358 s, t_low ≈ 0.326 s, f ≈ 1.46 Hz, duty ≈ 52%; C1 swings between 3 V and 6 V.

## Readouts

| label | source | unit |
|---|---|---|
| CAP (pins 2/6) | `{kind:'voltage', node:'thr'}` | V |
| OUTPUT (pin 3) | `{kind:'voltage', node:'o'}` | V |
| FREQUENCY | `{kind:'behavior', key:'u1.freq'}` | Hz |
| DUTY | `{kind:'behavior', key:'u1.duty'}` | '' |
| LED CURRENT | `{kind:'current', elementId:'LED1'}` | A |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| R1 | `R1` | value | 1000 | 47000 | — | yes | Ω |
| R2 | `R2` | value | 1000 | 100000 | — | yes | Ω |
| C1 | `C1` | value | 0.0000047 | 0.00047 | — | yes | F |
| Supply | `V_BAT` | value | 3 | 15 | 0.5 | no | V |

Change the supply from 6 V to 15 V and the frequency doesn't move, though the LED brightness does.

## Failures

### F1: Leave out R1 (pin 7 tied straight to V_CC)
- **Patch:** `{op:'short', a:'vcc', b:'dis'}`
- **Sim shows:** the first time discharge turns on, about 5.8 A (9 V / (1.5 Ω + the switch)) flows from the battery through SW_DIS; the discharge switch fails and the oscillation stops.
- **Why:** R1 is what limits the discharge-transistor current. Without it, discharge shorts the supply, limited only by the battery's ≈ 1.5 Ω. In hardware this destroys the 555's discharge transistor.

### F2: Remove the timing capacitor
- **Patch:** `{op:'remove', elementId:'C1'}`
- **Sim shows:** the output flips every simulation step, and the LED looks steadily half-lit.
- **Why:** with no capacitor, the threshold node crosses both trip points almost instantly. A real 555 oscillates at a high frequency set by stray capacitance and its internal delays, far too fast to see blink.

### F3: Run it from two AA cells
- **Patches:** `{op:'set', elementId:'V_BAT', key:'value', value:3}`, `{op:'set', elementId:'V_BAT', key:'rInternal', value:0.3}`
- **Sim shows:** the output stays low and nothing blinks.
- **Why:** the bipolar NE555 is specified from 4.5 V to 16 V. Below that it is not guaranteed to work. The CMOS TLC555 works from 2 V and draws far less current.

## Meet the board

Inside the 555, three equal resistors split V_CC into thirds. Two comparators watch the capacitor:

- When it rises to **⅔ V_CC** (6 V here), the latch resets: the output goes low and the **discharge** transistor shorts pin 7 to ground.
- When it falls to **⅓ V_CC** (3 V), the latch sets: the output goes high and discharge lets go.

In the astable circuit C1 charges through **R1 + R2** and discharges through **R2** only. Each phase covers the span from ⅓ to ⅔ V_CC. Charging toward V_CC, the gap to the target halves from ⅔ V_CC to ⅓ V_CC, so the time is RC·ln 2. Discharging toward 0, the voltage halves from ⅔ to ⅓, again RC·ln 2.

- t_high = 0.693 × (1k + 10k) × 47 µF = **0.358 s**
- t_low = 0.693 × 10k × 47 µF = **0.326 s**
- f = 1/(0.358 + 0.326) = **1.46 Hz**, duty = 0.358/0.684 = **52%**

Equivalently, f = 1.44/((R1 + 2R2)·C) = 1.44/(21k × 47 µ) = 1.46 Hz ✓.

V_CC cancels out of both times, so the frequency is independent of the supply. Since t_high always includes R1, the duty cycle is always above 50%. A diode across R2 gets around that.

The LED current is (9 − 1.2 − 1.8)/(470 + 5) ≈ **12.6 mA** (the sim gives 12.7 mA). The electrolytic's ±20% tolerance means the real rate could be anywhere from about 1.2 to 1.8 Hz.

## For mechanical engineers

> A 555 astable is a toilet cistern with a two-mark float. Water (charge) fills through the inlet (R1 + R2) until the float hits the upper mark, which trips the flush valve (discharge). The valve then drains it (through R2) to the lower mark and shuts, and the cycle repeats. The gap between the marks is hysteresis, which stops the valve chattering. **Where it breaks:** the cistern fills at a roughly constant rate, while the capacitor fills exponentially, which is where ln 2 comes from. The 555's "valve" snaps in nanoseconds, not seconds.

## Pro tips

1. Always decouple a bipolar 555: 10 nF on pin 5, and 100 nF plus some bulk capacitance across the supply. Its output stage draws large current spikes when it switches, which can glitch the rest of the board.
2. For battery projects use a CMOS 555 (TLC555, LMC555). It runs from about 2 V and idles at a small fraction of the NE555's few milliamps.
3. A 555's accuracy is limited by its timing capacitor (±10–20%). For anything that must be accurate, use a crystal-clocked microcontroller timer.

## Quiz

1. **An astable 555 has R1 = 10 kΩ, R2 = 100 kΩ and C = 10 µF. What is its frequency?**
   - 1.44 Hz
   - 6.9 Hz
   - 0.069 Hz
   - 0.69 Hz
   - **Answer:** 3. *Why:* f = 1.44/((10k + 200k) × 10 µ) = 1.44/2.1 ≈ 0.686 Hz.

2. **With R1 = 1 kΩ, R2 = 10 kΩ and C = 100 µF, how long is the output high?**
   - 0.069 s
   - 0.762 s
   - 0.693 s
   - 1.52 s
   - **Answer:** 1. *Why:* t_high = 0.693 × 11k × 100 µ = 0.762 s.

3. **Why can't the basic astable reach a duty cycle below 50%?**
   - The comparators are asymmetric
   - The output stage can't sink current
   - Charging goes through R1 + R2 but discharging only through R2, so t_high > t_low
   - The capacitor leaks
   - **Answer:** 2. *Why:* t_high ∝ (R1 + R2) and t_low ∝ R2, so high always lasts longer.

4. **This blinker is moved from 9 V to 12 V. What happens to the frequency?**
   - It stays the same
   - It rises by 33%
   - It falls by 25%
   - It doubles
   - **Answer:** 0. *Why:* the thresholds scale with V_CC, so V_CC cancels from the timing equations.

## SIM NOTE

- Behavior `ne555`: comparator and latch logic reading `thr`, `th_ref` and `tr_ref`; drives `SW_DIS.closed` and `V_OUT.value` (V_CC − 1.7 V when high); enforces V_CC ≥ 4.5 V; publishes `u1.freq` and `u1.duty` from edge timestamps. It needs the behavior to call `setParam` on a `V` value and a `SW` closed state each tick, which the current API supports.
- **Step-limited oscillation (F2):** without C1 the behavior toggles every step (≈ 500 Hz at 1 ms). It should show a status line explaining that the real frequency is much higher.
- **Rating for a closed `SW`:** `maxI` must be checked on `SW` elements too (F1).
- `R_Q`'s 6 mA is an interpolated estimate, not a datasheet value at 9 V.
