# The Transformer

*Trading volts for amps*

> A 17:1 transformer lets 1 A flow in a 12 Ω load while the 230 V side draws only about 58 mA.

- **Lesson id:** `transformer` · **Track:** T1 Passives
- **Prerequisites:** `inductor-rl`, `ac-oscilloscope`
- **Power element:** `SW_MAINS` (powerLabel: "Plug in the adapter")
- **Transient:** yes

> **Safety framing.** The learner never touches mains. The bench uses a sealed plug-in **12 V AC, 1 A** transformer adapter (output is AC, not DC), so everything on the bench is low voltage. The 230 V primary appears only as a calculated readout.

## Learning goals

1. Apply the turns ratio: V_s/V_p = N_s/N_p and I_s/I_p ≈ N_p/N_s.
2. Use power balance (P_in ≈ P_out + losses) to find the primary current.
3. Explain load regulation: why a "12 V" transformer reads higher off-load.
4. Reflect a load impedance through a transformer: Z_p = (N_p/N_s)²·Z_s.

## Board

Board: `XFMR-14`, size 14 × 9, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| xf | `transformer` (12 V AC 1 A plug-in adapter, 230 V primary) | `offboard` | XFMR | Steps 230 V mains down to a safe 12 V AC. | `V_SEC`, `SW_MAINS`, `R_W` |
| fuse | `fuse` (T1.6A, 5 × 20 mm, slow-blow) | `tht` | FUSE | Opens on a secondary fault. | `F1` |
| term | `screw-terminal` | `tht` | TERMINAL | Secondary connection. | — |
| rl | `resistor` (12 Ω, 25 W aluminium-housed) | `offboard` | LOAD | Draws the rated 1 A. | `R_LOAD` |
| dmm | `multimeter` (AC V) | `offboard` | METER | Reads secondary RMS. | — |

## Circuit

Only the secondary is simulated. It is modelled as its open-circuit EMF behind the winding resistance referred to the secondary.

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_SEC` | V | `s1`, `0` | sine: amp 19.1 V (13.5 V RMS), freq 50 Hz | — | open-circuit secondary EMF; driven by behavior `sine-source` |
| `SW_MAINS` | SW | `s1`, `s2` | closed: false | — | **power element** (stands in for the mains plug) |
| `R_W` | R | `s2`, `s3` | 1.5 Ω | — | primary + secondary winding resistance referred to secondary (`partId: xf`) |
| `F1` | R | `s3`, `s4` | 0.1 Ω | maxI 1.6 A (RMS, see SIM NOTE), failMode open | slow-blow fuse |
| `R_LOAD` | R | `s4`, `0` | 12 Ω | maxP 25 W | |

Expected at 12 Ω: I = 13.5/13.6 ≈ 0.99 A RMS, V_load ≈ 11.9 V RMS, copper loss ≈ 1.5 W, primary current ≈ 59 mA RMS.

Behavior `ideal-transformer` (turns ratio n = N_p/N_s = 230/13.5 = 17.0) publishes the primary current I_p = I_s/n (magnetising current neglected) and the reflected impedance.

## Readouts

| label | source | unit |
|---|---|---|
| SECONDARY (inst.) | `{kind:'voltage', node:'s4'}` | V |
| SECONDARY RMS | `{kind:'behavior', key:'rms.s4'}` | V |
| LOAD CURRENT RMS | `{kind:'behavior', key:'rms.iload'}` | A |
| PRIMARY CURRENT | `{kind:'behavior', key:'xfmr.ip'}` | A |
| LOAD POWER | `{kind:'behavior', key:'avg.pload'}` | W |
| COPPER LOSS | `{kind:'behavior', key:'avg.pcu'}` | W |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Load resistance | `R_LOAD` | value | 6 | 1000 | — | yes | Ω |
| Secondary EMF (turns ratio) | `V_SEC` | amp | 5 | 34 | 0.5 | no | V (peak) |

## Failures

### F1: Short the secondary
- **Patch:** `{op:'short', a:'s4', b:'0'}`
- **Sim shows:** secondary current ≈ 8 A RMS; F1 blows (open) and everything goes to 0.
- **Why:** only the winding resistance limits a short: 13.5/1.6 ≈ 8.4 A. Without the fuse the winding would overheat. Small transformers often hide a one-shot thermal fuse inside the primary for exactly this reason.

### F2: Overload: 6 Ω instead of 12 Ω
- **Patch:** `{op:'set', elementId:'R_LOAD', key:'value', value:6}`
- **Sim shows:** current ≈ 1.8 A RMS, V_load sags to ≈ 10.7 V, COPPER LOSS ≈ 4.7 W; the 1.6 A fuse eventually opens.
- **Why:** I = 13.5/7.6 = 1.78 A. Copper loss goes with I², so 3.2× the rated loss heats the windings well beyond design.

### F3: Unload it
- **Patch:** `{op:'set', elementId:'R_LOAD', key:'value', value:1000}`
- **Sim shows:** SECONDARY RMS ≈ 13.5 V; "12 V" is nowhere to be seen.
- **Why:** a transformer's nameplate voltage applies at rated load. Small units regulate poorly (here 12.5%), so off-load voltage runs high. Downstream parts must be rated for it.

## Meet the board

A transformer is two coils on one iron core. A changing current in the primary makes a changing magnetic flux, and that flux induces a voltage in every turn of the secondary. The voltage per turn is the same on both windings, so

**V_s / V_p = N_s / N_p**

This adapter is wound so its off-load secondary is 13.5 V RMS from 230 V: n = 230/13.5 = **17.0**.

**Power balance.** Ignoring core loss, the power in equals the power out plus the copper loss. At 12 Ω the load takes I = 13.5/(1.5 + 0.1 + 12) ≈ **0.99 A** and V = 11.9 V, about 11.8 W. The winding resistance burns I²R ≈ **1.5 W**. Primary current ≈ I_s/n = 0.99/17 ≈ **58 mA**, and 230 V × 58 mA ≈ 13.4 W in. Voltage went down 17×, current went up 17×.

**Reflected impedance.** Seen from the mains, the 12 Ω load looks like n² × 12 = 289 × 12 ≈ **3.5 kΩ**.

**Regulation** is (V_offload − V_fullload)/V_fullload = (13.5 − 11.9)/11.9 ≈ **13%**. Small transformers sag a lot.

Transformers need *changing* flux. Feed one DC and nothing is induced. The primary then becomes a plain resistor across the supply and burns.

## For mechanical engineers

> A transformer is a gearbox for electrical power. Voltage plays speed and current plays torque. A 17:1 reduction drops speed 17× and multiplies torque 17×, with power (V·I, or T·ω) conserved minus friction (copper and core loss). Reflected impedance even follows your reflected-inertia rule, since both scale with the ratio squared. **Where it breaks:** a gearbox transmits steady rotation, but a transformer transmits nothing at DC because it needs changing flux. Its core also saturates if overdriven, which no gear does.

## Pro tips

1. Never breadboard mains. Use a sealed plug-in AC adapter, or a PCB transformer with a fused, enclosed and insulated primary designed to the relevant safety standard.
2. Transformers are rated in VA. Feeding a bridge rectifier and smoothing capacitor, the RMS winding current is much higher than the DC load current, commonly 1.6–1.8×, so derate accordingly.
3. Transformers draw an inrush current at switch-on (toroids especially). Use slow-blow (T) fuses on the primary, sized from the datasheet.

## Quiz

1. **A 230 V primary has 1150 turns and the secondary has 60. What is the secondary voltage?**
   - 6 V
   - 12 V
   - 24 V
   - 4.4 kV
   - **Answer:** 1. *Why:* V_s = 230 × 60/1150 = 12 V.

2. **An ideal transformer delivers 24 V at 2 A from a 230 V primary. What is the primary current?**
   - 0.104 A
   - 2.0 A
   - 0.209 A
   - 19.2 A
   - **Answer:** 2. *Why:* P = 48 W, so I_p = 48/230 = 0.209 A.

3. **A 10:1 step-down transformer drives an 8 Ω load. What impedance does the primary see?**
   - 800 Ω
   - 0.08 Ω
   - 80 Ω
   - 8 kΩ
   - **Answer:** 0. *Why:* Z_p = n²·Z_s = 100 × 8 = 800 Ω.

4. **Why doesn't a transformer work on DC?**
   - DC is too high a voltage
   - The core blocks DC current
   - DC has no RMS value
   - Induction needs changing flux; steady current makes steady flux, which induces nothing
   - **Answer:** 3. *Why:* Faraday's law: v = N·dΦ/dt, so constant flux induces zero voltage.

## SIM NOTE

- **Transformer element:** there is no coupled-inductor or ideal-transformer element. For a faithful model the engine needs either mutual inductance (`K` coupling two `L`s, with a saturation option) or an ideal transformer (`XFMR` with ratio n, magnetising L and winding R). That would let the primary be simulated (from a non-mains, low-voltage source) and enable a "DC into the primary" failure.
- **Sine source:** as in `ac-oscilloscope` (a native sine `V` or a parameterised `sine-source` behavior).
- **AC-aware ratings:** `checkRatings` tests the instantaneous |I| for 300 ms. For sinusoidal currents, `maxI` must be compared with RMS (or a fuse I²t integral), or the 1.6 A fuse will never trip on 1.78 A RMS (peaks of 2.5 A for only part of each cycle).
- **Behaviors:** `ideal-transformer` (primary current, reflected impedance) and `ac-meter` (RMS values and average power for `rms.s4`, `rms.iload`, `avg.pload`, `avg.pcu`).
