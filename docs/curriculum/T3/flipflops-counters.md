# Flip-Flops and Counters

*Circuits that remember*

> Two cross-coupled 2N3904s hold one bit on about 8 mA, and four flip-flops in a 74HC393 count button presses from 0 to 15.

- **Lesson id:** `flipflops-counters` · **Track:** T3 Digital
- **Prerequisites:** `logic-gates`, `transistor-switch`, `capacitor-rc`
- **Power element:** `V_CC` (powerLabel: "Connect 5 V")
- **Transient:** yes

## Learning goals

1. Explain memory as positive feedback: a bistable circuit has two stable states.
2. Operate an SR latch, and identify its forbidden input (S = R = 1).
3. Describe D and T flip-flops and edge-triggering, and how a chain of toggling flip-flops divides by 2ⁿ.
4. Read a 4-bit binary count, and explain why mechanical buttons must be debounced before they clock a counter.

## Board

Board: `MEM-23`, size 20 × 12, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| pwr | `module` (title "5 V SUPPLY") | `offboard` | POWER | 5 V rail. | `V_CC` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds both halves of the lesson. | — |
| q1, q2 | `transistor-to92` (2N3904 ×2) | `tht` | LATCH | Cross-coupled pair: whichever is on holds the other off. | `Q1`, `Q2` |
| rc1, rc2 | `resistor` (1 kΩ ×2) | `tht` | COLLECTOR | Collector loads. | `R_C1`, `R_C2` |
| rb1, rb2 | `resistor` (4.7 kΩ ×2) | `tht` | CROSS | The feedback links that make it remember. | `R_B1`, `R_B2` |
| bs | `button` | `tht` | SET | Forces Q = 1. | `SW_SET` |
| br | `button` | `tht` | RESET | Forces Q = 0. | `SW_RESET` |
| lq | `led` (green) | `tht` | Q | Lit when Q = 1. | `LED_Q` |
| lqn | `led` (red) | `tht` | QBAR | Lit when Q = 0. | `LED_QN` |
| u2 | `ic-dip` (74HC14 hex Schmitt inverter) | `tht` | SCHMITT | Squares up the debounced clock edge (behavior). | — |
| u3 | `ic-dip` (74HC393 dual 4-bit ripple counter) | `tht` | COUNTER | Counts the clock's falling edges (behavior). | `V_Q0`–`V_Q3` |
| bc | `button` | `tht` | CLOCK | One press is one count. | `SW_CLK` |
| rdb, cdb | `resistor` (1 kΩ, 10 kΩ) + `capacitor-ceramic` (1 µF) | `tht` | DEBOUNCE | RC filter that swallows contact bounce. | `R_S`, `R_PD`, `C_DB` |
| l0–l3 | `led` (yellow ×4) + `resistor` (1 kΩ ×4) | `tht` | BITS | Binary count, Q0 (LSB) to Q3 (MSB). | `LED_B0`–`LED_B3` |

## Circuit

**SR latch (fully simulated):**

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_CC` | V | `vcc`, `0` | 5.0 V, rInternal 0.05 Ω | — | **power element** |
| `R_C1` | R | `vcc`, `c1` | 1 kΩ | maxP 0.25 W | |
| `R_C2` | R | `vcc`, `c2` | 1 kΩ | maxP 0.25 W | |
| `Q1` | NPN | `c1`, `b1`, `0` | beta 150 | maxI 0.2 A, maxP 0.625 W, maxV 40 V | 2N3904: 40 V, 200 mA, 625 mW; h_FE 100–300 at 10 mA |
| `Q2` | NPN | `c2`, `b2`, `0` | beta 150 | maxI 0.2 A, maxP 0.625 W, maxV 40 V | |
| `R_B1` | R | `c2`, `b1` | 4.7 kΩ | maxP 0.25 W | Q2's collector drives Q1's base |
| `R_B2` | R | `c1`, `b2` | 4.7 kΩ | maxP 0.25 W | Q1's collector drives Q2's base |
| `LED_Q` | LED | `c2`, `0` | color: green | maxI 0.03 A, maxV 5 V | lit when Q2 is off (Q = 1) |
| `LED_QN` | LED | `c1`, `0` | color: red | maxI 0.03 A, maxV 5 V | lit when Q1 is off |
| `SW_SET` | SW | `b2`, `0` | closed: false | — | grounds Q2's base → Q = 1 |
| `SW_RESET` | SW | `b1`, `0` | closed: false | — | grounds Q1's base → Q = 0 |

**Counter (clock network simulated; counter logic is a behavior):**

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `SW_CLK` | SW | `vcc`, `sw` | closed: false | — | |
| `R_S` | R | `sw`, `clk` | 1 kΩ | — | |
| `C_DB` | C | `clk`, `0` | 1 µF | maxV 50 V | |
| `R_PD` | R | `clk`, `0` | 10 kΩ | — | release τ ≈ 10 ms |
| `V_Q0`…`V_Q3` | V | `q0`…`q3`, `0` | 0 or 5 V, set by behavior `hc393-counter`; rInternal 50 Ω | — | 74HC output stage |
| `R_Q0`…`R_Q3` | R | `qN`, `lN` | 1 kΩ | maxP 0.25 W | |
| `LED_B0`…`LED_B3` | LED | `lN`, `0` | color: yellow | maxI 0.03 A, maxV 5 V | ≈ 3 mA each |

Expected latch: the "on" transistor carries (5 − 0.1)/1k ≈ 4.9 mA. The "off" side's collector is clamped by its LED at ≈ 1.8–2.0 V and feeds ≈ (1.8 − 0.7)/4.7k ≈ 0.23 mA into the other base (forced β ≈ 21, saturated). The LED on that side takes ≈ 3 mA. Total ≈ 8 mA. A logic "1" on Q therefore reads ≈ 2 V here, not 5 V.

## Readouts

| label | source | unit |
|---|---|---|
| Q | `{kind:'voltage', node:'c2'}` | V |
| Q̅ | `{kind:'voltage', node:'c1'}` | V |
| CLOCK | `{kind:'voltage', node:'clk'}` | V |
| COUNT | `{kind:'behavior', key:'count'}` | '' |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| SET button | `SW_SET` | closed | 0 | 1 | 1 | no | — |
| RESET button | `SW_RESET` | closed | 0 | 1 | 1 | no | — |
| CLOCK button | `SW_CLK` | closed | 0 | 1 | 1 | no | — |
| Debounce capacitor | `C_DB` | value | 0.00000001 | 0.00001 | — | yes | F |

Tap SET, then release it: Q stays 1. That is memory. Press CLOCK eleven times and the bits read 1011.

## Failures

### F1: Press SET and RESET together
- **Patches:** `{op:'set', elementId:'SW_SET', key:'closed', value:true}`, `{op:'set', elementId:'SW_RESET', key:'closed', value:true}`
- **Sim shows:** both transistors off and both LEDs lit: Q = Q̅ = 1.
- **Why:** this is the forbidden state. The outputs are no longer complements. Release both at once and the latch's final state depends on which side wins a race, which in hardware is set by tiny mismatches.

### F2: Cut one cross-coupling link
- **Patch:** `{op:'remove', elementId:'R_B1'}`
- **Sim shows:** SET lights Q only while held. When released, Q falls back to 0.
- **Why:** Q1 can no longer be turned on, so its collector stays high and keeps Q2 on. The positive-feedback loop is broken, and so is the memory.

### F3: Remove the debounce capacitor
- **Patch:** `{op:'remove', elementId:'C_DB'}`
- **Sim shows (intended):** single presses advance COUNT by 2–5 at random (see SIM NOTE).
- **Why:** mechanical contacts bounce for roughly a millisecond or more on make and break. Every bounce is a clean edge to a 74HC counter, which can respond in nanoseconds.

## Meet the board

**Memory from feedback.** In the latch, each transistor's collector feeds the other's base. If Q1 is on, its collector is low, which starves Q2's base, so Q2 is off. Q2's collector is high, which feeds Q1's base and keeps it on. Both states are self-sustaining: a **bistable**.

- **SET** grounds Q2's base, forcing Q2 off, so Q = 1, and the loop holds that state after release.
- **RESET** does the mirror image.

**Numbers.** The on-transistor needs I_c = (5 − 0.1)/1k ≈ **4.9 mA**. It gets I_b = (1.8 − 0.7)/4.7k ≈ **0.23 mA** from the off side (whose collector is held at ≈ 1.8–2 V by its LED). Forced β = 4.9/0.23 ≈ **21**, far below the 2N3904's h_FE of 100+, so it is solidly saturated.

**Flip-flops.** A D flip-flop (74HC74) copies D to Q on a clock *edge*. A T flip-flop toggles. Chain four toggling stages and each one changes state at half the rate of the one before: **÷2, ÷4, ÷8, ÷16**. Read Q3…Q0 as a binary number: after 11 falling clock edges it shows 1011 (8 + 2 + 1). The 16th edge wraps it to 0000.

**Debouncing.** Here R_PD and C_DB give a release time constant of 10 kΩ × 1 µF = **10 ms**, longer than typical contact bounce. The 74HC14's Schmitt hysteresis turns the slow RC slope into one clean edge.

## For mechanical engineers

> A latch is a bistable snap mechanism, like an over-centre toggle clamp or a snap-through dome. It has two stable positions with an energy hill between them, and it stays put until pushed past the centre. A ripple counter is an odometer: each wheel advances the next once per full turn. **Where it breaks:** a toggle clamp remembers with the power off, but the latch forgets the moment power is removed. Pushed exactly to its tipping point, an electronic latch can hover unpredictably for nanoseconds (metastability), a real hazard in fast digital design.

## Pro tips

1. Debounce every mechanical input, either in hardware (RC plus Schmitt trigger) or in firmware (ignore changes for 5–20 ms).
2. Ripple counters glitch through intermediate values as each stage ripples. When outputs must change together, use a synchronous counter (e.g. 74HC161).
3. Latches and flip-flops power up in an unknown state. Give them a defined reset (an RC power-on reset or an MCU-driven clear) before relying on their contents.

## Quiz

1. **A 4-bit counter starts at 0000 and receives 11 clock edges. What does it show (Q3 Q2 Q1 Q0)?**
   - 1101
   - 0111
   - 1011
   - 1110
   - **Answer:** 2. *Why:* 11 = 8 + 2 + 1, which is 1011 in binary.

2. **A 1 kHz clock drives a 4-stage ripple counter. What is the frequency at Q3?**
   - 62.5 Hz
   - 250 Hz
   - 125 Hz
   - 16 kHz
   - **Answer:** 0. *Why:* each stage divides by 2, so 1000/2⁴ = 62.5 Hz.

3. **What happens in an SR latch when S and R are both asserted?**
   - It toggles
   - Both outputs go to the same level (forbidden), and the state after release is unpredictable
   - It holds its previous state
   - It resets to 0
   - **Answer:** 1. *Why:* both sides are forced off together, so Q = Q̅, and on release a race decides the result.

4. **What is the release time constant of a 10 kΩ pull-down with a 1 µF debounce capacitor?**
   - 0.1 ms
   - 1 ms
   - 100 ms
   - 10 ms
   - **Answer:** 3. *Why:* τ = RC = 10 000 × 10⁻⁶ = 10 ms.

## SIM NOTE

- **Bistable initial state:** a DC operating point for a symmetric latch may converge to the metastable midpoint (both transistors half-on). The engine needs an initial-condition hint (e.g. a `v0` on a node, or a one-step asymmetric kick from a behavior `latch-init`) so power-up lands in a definite state. For realism, randomise it.
- **Counter primitive:** behavior `hc393-counter` reads node `clk` through Schmitt thresholds with hysteresis (use the 74HC14 datasheet's typical V_T+ and V_T− at 5 V). It counts the 74HC14 output's falling edges (i.e. presses), sets `V_Q0`…`V_Q3` to 0/5 V, and publishes `count`. A general digital-logic element would serve this lesson and `logic-gates`.
- **Switch bounce:** `SW` changes cleanly. A behavior `switch-bounce` (on each toggle, chatter the switch for ~1–5 ms at random intervals) is needed for F3. With the 1 ms bench step the bounce would also need a finer `dt` (≈ 50 µs).

## Implementation notes (as built, 2026-11-09)

- The latch is two 74HC00 NAND gates (active-low SET/RESET with 10 kOhm pull-ups), not the 2N3904 pair above; the transistor version's 2 V logic-1 and ~8 mA do not apply to the built lesson. Both builds teach the same bistable. The board is two breadboards (`breadboard-only`), not a soldered `mat` board.
- Datasheet check (TI SCLS085L, SN74HC14, 4.5 V): V_T+ is 1.55 V min / 2.5 V typ / 3.13 V max and hysteresis 0.4 / 0.9 / 2.1 V; the lesson models V_T+ 2.5 V and V_T- 1.6 V. The 74HC393 (TI) counts on the HIGH-to-LOW clock edge, MR high clears, clock pulse width 20 ns min at 4.5 V (SN74 grade). The 74HC74 hold time is 0 ns at 4.5 V.
- Debounce numbers: charge tau = (R_S || R_PD) x C = 0.91 ms; release tau = 10 kOhm x 1 uF = 10 ms; the node falls from 4.55 V to the 1.6 V falling threshold in 10 x ln(4.55/1.6) = 10.4 ms, so bounce gaps up to several ms are swallowed. The sim's chatter is 1 to 3 bounces of 2 to 4 ms per segment (behavior `switch-bounce`), on both make and break; without C_DB a press-release cycle yields about 5 counts on average (1 + 1 to 3 + 1 to 3).
- Behaviors: `hc393`, `hc74`, `switch-bounce` (the curriculum's `hc393-counter` and `switch-bounce`, split). The sim runs at dt 100 us and x0.1; the bounce is applied once per frame, so its segments must be longer than a frame (1.7 ms).
