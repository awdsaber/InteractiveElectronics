# Linear and Buck Regulators

*Burning versus switching*

> Making 5 V at 1 A from 12 V, an LM7805 burns 7 W as heat, while an LM2596 buck loses about 1 W.

- **Lesson id:** `regulators-linear-buck` · **Track:** T2 Semiconductors
- **Prerequisites:** `zener`, `opamp-basics`, `mosfet-switch`, `inductor-rl`
- **Power element:** `V_IN` (powerLabel: "Plug in 12 V")

## Learning goals

1. Explain a linear regulator as a reference, an error amplifier and a pass transistor, and calculate its dissipation, (V_in − V_out)·I.
2. Explain a buck converter (switch, inductor, diode or synchronous FET, capacitor), with duty cycle ≈ V_out/V_in.
3. Compare efficiency and input current. A buck draws *less* input current than it delivers.
4. Size a heatsink from a thermal budget, and recognise dropout and thermal shutdown.

## Board

Board: `REG-21`, size 20 × 12, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| jack | `barrel-jack` | `tht` | JACK | 12 V, 2 A adapter input. | `V_IN` |
| u1 | `regulator-to220` (LM7805) | `tht` | LINEAR | Fixed 5 V linear regulator (internals modelled below). | `Z_REF`, `U_EA`, `Q_PASS`, `R_Q`, `R_REF`, `R_FB1`, `R_FB2` |
| hs | `heatsink` (clip-on TO-220) | `tht` | HEATSINK | Lowers the regulator's thermal resistance to air. | — |
| cin | `capacitor-ceramic` (330 nF) | `tht` | BYPASS | Input capacitor recommended by the datasheet. | — |
| cout | `capacitor-ceramic` (100 nF) | `tht` | BYPASS | Output capacitor. | `C_OUT1` |
| buck | `module` (title "LM2596 BUCK", adjusted to 5.0 V) | `module` | BUCK | 150 kHz switching regulator module. | `I_BUCK`, `V_BUCK` |
| rl1 | `resistor` (25 Ω, 10 W wirewound) | `offboard` | LOAD | Linear-side load (200 mA). | `R_L1` |
| rl2 | `resistor` (25 Ω, 10 W wirewound) | `offboard` | LOAD | Buck-side load (200 mA). | `R_L2` |
| s1, s2 | `switch-slide` | `tht` | SELECT | Connect each load. | `SW_L`, `SW_B` |

## Circuit

**Linear side**, the LM7805 drawn as its functional blocks (a simplified model):

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_IN` | V | `vin`, `0` | 12.0 V, rInternal 0.05 Ω | — | **power element** |
| `P_LIN` | PROBE | `vin`, `lin_in` | — | — | linear input current |
| `R_Q` | R | `lin_in`, `0` | 2.4 kΩ | — | ≈ 5 mA quiescent (LM7805 typical) |
| `R_REF` | R | `lin_in`, `ref` | 4.7 kΩ | — | reference bias |
| `Z_REF` | ZENER | `0`, `ref` | vz 2.5 | — | stand-in for the internal band-gap reference |
| `U_EA` | OPAMP | `ref`, `fb`, `base` | gain 1e4, vPos 11, vNeg 0 | — | error amplifier (see SIM NOTE on rails) |
| `Q_PASS` | NPN | `lin_in`, `base`, `vout1` | beta 50 | maxP 2.0 W, maxI 1.5 A, maxV 35 V | pass device. 2 W ≈ free-air limit: (125 °C − 25 °C)/≈ 50 °C/W. The real part enters thermal shutdown rather than failing |
| `R_FB1` | R | `vout1`, `fb` | 1 kΩ | — | |
| `R_FB2` | R | `fb`, `0` | 1 kΩ | — | sets V_out = 2 × 2.5 V = 5.0 V |
| `C_OUT1` | C | `vout1`, `0` | 100 nF | maxV 50 V | |
| `SW_L` | SW | `vout1`, `l1` | closed: true | — | |
| `R_L1` | R | `l1`, `0` | 25 Ω | maxP 10 W | |

**Buck side**, as an averaged (power-balance) model:

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `I_BUCK` | I | `vin`, `0` | set each tick by behavior `buck-averaged`: I = V_out·I_out/(η·V_in) | — | buck input current, η = 0.82 |
| `V_BUCK` | V | `vout2`, `0` | 5.0 V, rInternal 0.05 Ω | — | regulated buck output |
| `SW_B` | SW | `vout2`, `l2` | closed: true | — | |
| `R_L2` | R | `l2`, `0` | 25 Ω | maxP 10 W | |

Expected at 25 Ω (200 mA each): linear input ≈ 0.21 A, pass dissipation ≈ (12 − 5) × 0.2 = 1.4 W, efficiency ≈ 40%. Buck input = 1.0 W/(0.82 × 12) ≈ 0.10 A, loss ≈ 0.22 W.

## Readouts

| label | source | unit |
|---|---|---|
| LINEAR IN | `{kind:'current', elementId:'P_LIN'}` | A |
| LINEAR HEAT | `{kind:'power', elementId:'Q_PASS'}` | W |
| LINEAR OUT | `{kind:'voltage', node:'vout1'}` | V |
| BUCK IN | `{kind:'behavior', key:'buck.iin'}` | A |
| BUCK LOSS | `{kind:'behavior', key:'buck.loss'}` | W |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Input voltage | `V_IN` | value | 7 | 24 | 0.5 | no | V |
| Linear load | `R_L1` | value | 5 | 100 | — | yes | Ω |
| Buck load | `R_L2` | value | 5 | 100 | — | yes | Ω |

## Failures

### F1: Ask the linear regulator for 1 A
- **Patch:** `{op:'set', elementId:'R_L1', key:'value', value:5}`
- **Sim shows:** LINEAR HEAT ≈ 7 W; after 300 ms Q_PASS is marked failed and LINEAR OUT drops to 0. Meanwhile, the buck at the same 1 A would lose ≈ 1.1 W.
- **Why:** (12 − 5) × 1 A = 7 W, and in free air a TO-220 can shed only ≈ 2 W. A real LM7805 doesn't burn: it hits its internal thermal shutdown (≈ 150 °C junction) and cycles on and off (see SIM NOTE).

### F2: Feed it only 6 V (dropout)
- **Patches:** `{op:'set', elementId:'V_IN', key:'value', value:6}`, `{op:'set', elementId:'U_EA', key:'vPos', value:5}`
- **Sim shows:** LINEAR OUT sags to ≈ 4.3 V; the buck side (averaged model) still shows 5.0 V.
- **Why:** a 7805 needs about 2 V of headroom (its dropout). With 6 V in, the internal driver can't lift the pass transistor's base high enough. The second patch tells the error amplifier its supply is now lower (see SIM NOTE). A real buck module also needs some headroom, so check its datasheet.

### F3: Switch to a 24 V supply
- **Patch:** `{op:'set', elementId:'V_IN', key:'value', value:24}`
- **Sim shows:** LINEAR HEAT ≈ 3.8 W, over the 2 W limit (failed). BUCK IN *falls* to ≈ 51 mA.
- **Why:** a linear's loss grows with the input voltage, (24 − 5) × 0.2 = 3.8 W. A buck's input current goes the other way: 1 W/(0.82 × 24) ≈ 51 mA. Its input *power* stays roughly constant.

## Meet the board

**Linear regulator.** A reference (≈ 1.25 V band-gap inside a real 7805, modelled here as 2.5 V), an error amplifier and a pass transistor form a feedback loop like the op-amp lesson. The pass transistor drops whatever voltage is left over. Every amp of output is an amp of input, so:

P_loss = (V_in − V_out)·I = (12 − 5) × 0.2 = **1.4 W**, efficiency ≈ 5/12 = **42%**

At 1 A the loss is **7 W**. With θ_JA ≈ 50 °C/W in free air, the junction would rise 350 °C, so it shuts down. To dissipate 7 W at a 125 °C junction and 25 °C ambient, the total θ must be ≤ (125 − 25)/7 ≈ **14 °C/W**, junction to air.

**Buck converter.** A switch connects the inductor to V_in for a fraction D of each period (here at 150 kHz). The inductor and capacitor average the pulses to V_out ≈ D·V_in, so **D ≈ 5/12 = 0.42**. Inductors and capacitors store energy without dissipating it, so the efficiency is typically **80–90%**. Power in ≈ power out / η:

I_in = (5 × 0.2)/(0.82 × 12) ≈ **0.10 A**, half the linear's input current.

**Trade-offs.**

- The linear is quiet, simple and cheap, and best for small drops and low currents.
- The buck is efficient but makes ripple and EMI, so it needs careful layout.

## For mechanical engineers

> A linear regulator is a pressure-reducing valve. It throttles flow from high to low pressure and turns the difference, Δp·Q, into heat. A buck converter is closer to a gearbox, or a hydraulic transformer. It trades voltage for current with little loss, so I_in < I_out just as input torque is less than output torque in a reduction gear. **Where it breaks:** the buck works by chopping, storing energy in a magnetic field and releasing it in pulses, so it always leaves some ripple and radiates switching noise. A gearbox transmits smoothly.

## Pro tips

1. For a linear regulator, calculate dissipation at the *highest* input voltage and *highest* load, then size the heatsink: θ_total = θ_JC + θ_CS (thermal pad) + θ_SA ≤ (T_J,max − T_A,max)/P.
2. Buck layout makes or breaks it. Keep the loop through the input capacitor, switch and diode as small as possible. When in doubt, use a proven module.
3. For small drops, pick an LDO with a low dropout spec (e.g. MCP1700, up to 250 mA, a few hundred mV of dropout). Many "LDOs", like the AMS1117, still need over 1 V of headroom at full current.

## Quiz

1. **An LM7805 runs from 9 V at 0.5 A. What does it dissipate?**
   - 0.5 W
   - 2.0 W
   - 2.5 W
   - 4.5 W
   - **Answer:** 1. *Why:* (9 − 5) × 0.5 = 2.0 W.

2. **A buck converts 24 V to 5 V at 2 A with 88% efficiency. What is its input current?**
   - 0.42 A
   - 2.0 A
   - 0.47 A
   - 2.27 A
   - **Answer:** 2. *Why:* P_in = 10/0.88 = 11.4 W, so I_in = 11.4/24 = 0.47 A.

3. **A linear regulator dissipates 2 W, with T_J,max = 125 °C and ambient 25 °C. What is the maximum total θ_JA?**
   - 25 °C/W
   - 62.5 °C/W
   - 100 °C/W
   - 50 °C/W
   - **Answer:** 3. *Why:* θ ≤ (125 − 25)/2 = 50 °C/W.

4. **Why can a buck's input current be lower than its output current?**
   - Power is conserved (minus losses), so stepping voltage down steps current up
   - It stores charge in the input capacitor
   - It draws from the ground pin
   - It doesn't; the meter is wrong
   - **Answer:** 0. *Why:* V_in·I_in ≈ V_out·I_out/η, and V_in > V_out, so I_in < I_out.

## SIM NOTE

- **Switching buck:** there is no switching model. A real buck at 150 kHz needs dt ≈ 0.1 µs (unaffordable on the bench) plus PWM-driven switching, so this lesson uses an averaged behavior, `buck-averaged`, which reads `V_BUCK`'s current and sets `I_BUCK` = V_out·I_out/(η·V_in), publishing `buck.iin` and `buck.loss`. It should also model dropout (output follows V_in − ~1.5 V when V_in is low; check the module datasheet for real figures). A future switched-mode lesson could run a scaled-down buck (e.g. 1 kHz, mH inductor) with true PWM.
- **OPAMP rails as nodes:** F2 patches `vPos` by hand. If `OPAMP` rails could reference a node (`lin_in`) minus a headroom, dropout would emerge naturally.
- **Thermal shutdown:** the burn rule treats 7 W as destruction, but an LM7805 protects itself (thermal shutdown, current limit). A behavior or rating mode `failMode:'shutdown'` (output disabled while T_J > 150 °C, with hysteresis; needs the `thermal-rc` model from `power-heat`) would be faithful.
- **Regulator element:** alternatively, add a `REG` primitive (V_out, dropout, I_q, current limit) so 7805/LDO parts don't need five-element macro models.
