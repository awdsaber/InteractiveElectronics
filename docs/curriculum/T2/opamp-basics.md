# Op-Amp Basics

*Feedback does the work*

> An LM358 with 100 kΩ over 10 kΩ has a gain of exactly 11, so a 0.30 V sensor signal becomes 3.30 V.

- **Lesson id:** `opamp-basics` · **Track:** T2 Semiconductors
- **Prerequisites:** `resistor-codes-divider`, `kirchhoff`
- **Power element:** `V_SUP` (powerLabel: "Connect 5 V")

## Learning goals

1. Use the two "golden rules" of a negative-feedback op-amp: V+ = V−, and the inputs draw no current.
2. Derive and apply the non-inverting gain, 1 + R_f/R_g, and recognise the inverting configuration.
3. Respect the real limits of a single-supply op-amp: output swing, input common-mode range and gain-bandwidth.
4. Explain why positive feedback makes a comparator or latch rather than an amplifier.

## Board

Board: `AMP-20`, size 14 × 9, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| pwr | `module` (title "5 V SUPPLY") | `offboard` | POWER | Single 5 V rail. | `V_SUP` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the amplifier. | — |
| u1 | `ic-dip` (LM358, DIP-8, dual op-amp; one half used) | `tht` | AMP | The amplifier. | `U1` |
| rt | `resistor` (47 kΩ, 1/4 W) | `tht` | BIAS | Top of the sensor divider. | `R_TOP` |
| pot | `potentiometer` (5 kΩ, as a variable sensor) | `tht` | SENSOR | Produces a 0–0.48 V "sensor" signal. | `R_SENS` |
| rf | `resistor` (100 kΩ, 1%) | `tht` | FEEDBACK | Output-to-inverting-input resistor. | `R_F` |
| rg | `resistor` (10 kΩ, 1%) | `tht` | GAIN | Inverting input to ground; with R_F it sets the gain. | `R_G` |
| c1 | `capacitor-ceramic` (100 nF) | `tht` | DECOUPLE | Supply bypass at pin 8 (not simulated). | — |
| rl | `resistor` (10 kΩ) | `tht` | LOAD | Stand-in for an ADC or meter input. | `R_LOAD` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_SUP` | V | `vcc`, `0` | 5.0 V, rInternal 0.05 Ω | — | **power element** |
| `R_TOP` | R | `vcc`, `in` | 47 kΩ | maxP 0.25 W | |
| `R_SENS` | R | `in`, `0` | 3 kΩ | maxP 0.25 W | sensor / pot (tweakable) |
| `U1` | OPAMP | `in`, `fb`, `out` | gain 1e5, vPos 3.5, vNeg 0.0 | — | LM358 on 5 V: open-loop gain ≈ 100 dB; output swings ≈ 0 V to ≈ V_CC − 1.5 V |
| `R_F` | R | `out`, `fb` | 100 kΩ | maxP 0.25 W | |
| `R_G` | R | `fb`, `0` | 10 kΩ | maxP 0.25 W | |
| `R_LOAD` | R | `out`, `0` | 10 kΩ | maxP 0.25 W | |

Expected: V_in = 5 × 3/50 = 0.300 V; V_out = 11 × 0.300 = 3.30 V; V_fb = 0.300 V; output current ≈ 0.36 mA.

## Readouts

| label | source | unit |
|---|---|---|
| V IN (+) | `{kind:'voltage', node:'in'}` | V |
| V FB (−) | `{kind:'voltage', node:'fb'}` | V |
| V OUT | `{kind:'voltage', node:'out'}` | V |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Sensor resistance | `R_SENS` | value | 0 | 5000 | 10 | no | Ω |
| Feedback resistor | `R_F` | value | 10000 | 1000000 | — | yes | Ω |

Watch V FB track V IN exactly. That equality *is* negative feedback at work. Push the sensor past ≈ 3.2 kΩ (V_in ≈ 0.32 V) and V_out pins at 3.5 V. It is clipping.

## Failures

### F1: Feedback resistor drops out
- **Patch:** `{op:'remove', elementId:'R_F'}`
- **Sim shows:** V OUT slams to the 3.5 V ceiling; V FB = 0 V ≠ V IN.
- **Why:** with no feedback, the op-amp's full open-loop gain (≈ 10⁵) multiplies the 0.3 V difference, so the output saturates. The golden rules only apply while feedback is working.

### F2: Too much gain (R_F = 1 MΩ)
- **Patch:** `{op:'set', elementId:'R_F', key:'value', value:1000000}`
- **Sim shows:** V OUT stuck at 3.5 V.
- **Why:** the gain is now 101, and 0.3 V × 101 = 30.3 V, far beyond what a 5 V-powered LM358 can output. Every amplifier clips at its output swing.

### F3: Inputs swapped
- **Patches:** `{op:'remove', elementId:'U1'}`, `{op:'add', element:{id:'U1', type:'OPAMP', nodes:['fb','in','out'], gain:100000, vPos:3.5, vNeg:0}}`
- **Sim shows (intended):** the output latches to a rail and ignores the sensor (see SIM NOTE).
- **Why:** the feedback now goes to the + input. Any rise in the output raises V+ further, which is positive feedback. The circuit becomes a latch, not an amplifier.

## Meet the board

An op-amp amplifies the difference between its inputs by an enormous open-loop gain (≈ 100 000 for an LM358). On its own that is useless, because any input slams the output into a rail. Add **negative feedback** (a fraction of the output fed back to the − input) and two rules emerge:

1. The output moves until **V− = V+**.
2. The inputs draw (almost) **no current**.

**Non-inverting amplifier.** V− comes from the divider R_F/R_G, so V− = V_out·R_G/(R_F + R_G). Setting V− = V+ = V_in:

**V_out = V_in·(1 + R_F/R_G)** = 0.300 × (1 + 100k/10k) = 0.300 × 11 = **3.30 V**

The input signal comes from a divider: V_in = 5 × 3k/(47k + 3k) = **0.300 V**.

**Real limits (LM358 on 5 V).**

- The output reaches down to about ground but only up to about **V_CC − 1.5 V ≈ 3.5 V**, so gains above 3.5/0.3 ≈ 11.7 clip here.
- The inputs work from 0 V up to about V_CC − 1.5 V.
- Gain-bandwidth is ≈ 0.7–1 MHz, so at a gain of 11 the bandwidth is about 60–90 kHz.

**Inverting amplifier** (signal into R_g at the − input, + input at a reference): gain = −R_F/R_G. On a single supply it needs a mid-rail reference.

## For mechanical engineers

> An op-amp with feedback is a hydraulic servo with a position-feedback linkage. The servo valve (the op-amp) is enormously "gainy" and drives the actuator until the feedback linkage says the error is zero. The lever ratio sets the overall gain, 1 + R_F/R_G, not the valve. **Where it breaks:** as with a servo, too much phase lag around the loop makes it hunt and oscillate. Op-amps are compensated internally for stability, but heavy capacitive loads add lag. The output also has hard stops (its rails) and limited current (tens of mA).

## Pro tips

1. Put a 100 nF ceramic capacitor right at the op-amp's supply pin. Long supply leads plus fast edges make amplifiers oscillate.
2. Tie the unused half of a dual op-amp as a follower to a mid-rail voltage (or ground on single-supply parts whose inputs include ground). Never leave it floating.
3. On low single supplies, read the "output voltage swing" and "common-mode input range" tables first. If you need the whole rail, use a rail-to-rail part such as the MCP6002.

## Quiz

1. **What is the gain of a non-inverting amplifier with R_F = 47 kΩ and R_G = 4.7 kΩ?**
   - 10
   - 11
   - 47
   - 0.1
   - **Answer:** 1. *Why:* 1 + 47/4.7 = 11.

2. **This LM358 on 5 V (gain 11) is given 0.5 V. What is the output?**
   - about 3.5 V (clipped)
   - 5.5 V
   - 5.0 V
   - 0.5 V
   - **Answer:** 0. *Why:* it would need 5.5 V, but the LM358 can only reach ≈ V_CC − 1.5 V ≈ 3.5 V.

3. **Why does V− equal V+ in a working negative-feedback circuit?**
   - The inputs are shorted inside the chip
   - The resistors force it
   - The supply sets both inputs
   - The huge open-loop gain drives the output until the fed-back voltage cancels the difference
   - **Answer:** 3. *Why:* any remaining difference times ≈ 10⁵ would move the output, so it settles only when the difference is ≈ 0.

4. **R_G = 10 kΩ. Which R_F gives a non-inverting gain of 6?**
   - 6 kΩ
   - 60 kΩ
   - 50 kΩ (use 51 kΩ)
   - 100 kΩ
   - **Answer:** 2. *Why:* 1 + R_F/10k = 6, so R_F = 50 kΩ.

## SIM NOTE

- **Positive feedback (F3):** an ideal `OPAMP` with positive feedback has a valid but *unstable* DC solution (output at the input-weighted equilibrium), and Newton-Raphson may happily converge to it. To latch to a rail as real hardware does, the engine needs a dynamic op-amp model in transient (single-pole open-loop response from GBW ≈ 0.7 MHz, plus slew ≈ 0.3 V/µs), or at least a small perturbation followed by transient settling.
- **Rails tied to nodes:** `OPAMP` `vPos`/`vNeg` are fixed numbers. Optional supply-node references (e.g. `vPos: 'vcc'` with a headroom offset) would make output swing follow the actual supply in other lessons (see `regulators-linear-buck`).
- **Output current limit:** the LM358 sources only ≈ 20–40 mA into a short. An optional `iMax` on `OPAMP` would enable a "short the output" failure.
