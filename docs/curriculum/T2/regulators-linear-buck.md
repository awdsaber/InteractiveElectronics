# Linear and Buck Regulators

*Burning versus switching*

> Making 3.3 V at 100 mA from 12 V, an AMS1117 LDO turns 0.93 W into heat at 26 % efficiency. A buck converter loses under 0.1 W and draws a third of the input current.

- **Lesson id:** `regulators-linear-buck` · **Track:** T2 Semiconductors
- **Prerequisites:** `zener`, `opamp-basics`, `mosfet-switch`, `inductor-rl`
- **Power element:** `V_IN` (powerLabel: "Plug in 12 V")

> Revised 2026-11-09 against the AMS1117 datasheet (Advanced Monolithic Systems). The first draft used an LM7805 macro-model and an averaged LM2596; the engine now has a `REG` element with thermal shutdown and switched PWM at real edge times, so the lesson uses a real LDO model and a really switching buck. See `docs/decisions.md`.

## Learning goals

1. Explain a linear regulator as a reference, an error amplifier and a pass transistor, and calculate its dissipation, (V_in − V_out)·I + V_in·I_q.
2. Explain a buck converter (switch, inductor, catch diode, capacitor), with duty cycle D ≈ V_out/V_in.
3. Compare efficiency and input current. A buck draws *less* input current than it delivers.
4. Use a thermal budget (θ ≤ (T_J − T_A)/P), and recognise dropout and thermal shutdown.

## Board

Board `REG-21`, 18.5 × 9.5, base `mat`. One 12 V jack feeds both regulators; each has its own 33 Ω load (100 mA at 3.3 V).

| id | PartKind | label | role | circuitIds |
|---|---|---|---|---|
| jack | `barrel-jack` | 12 V IN | 12 V, 2 A adapter | `V_IN` |
| u1 | `ic-smd` (drawn for the SOT-223) | LDO | AMS1117-3.3 | `U1` |
| cin, cout | ceramic 100 nF, electrolytic 22 µF | — | LDO bypass / output capacitor | `C_OUT1` |
| s1, rl1 | `switch-slide`, `resistor` 33 Ω 3 W | LOAD | linear load | `SW_L`, `R_L1` |
| ctrl | `ic-dip` (8 pin) | CONTROLLER | stands in for the buck IC's oscillator and error amp (runs the sketch) | `GATE` |
| rdiv1, rdiv2 | `resistor` 47 k / 10 k | — | Vin sense divider to A0 | `R_DIV1`, `R_DIV2` |
| rgpu | `resistor` 10 k | — | gate pull-up to Vin: holds the P-FET off before the sketch runs | `R_GPU` |
| q1 | `mosfet-to220` IRF9540N | SWITCH | P-channel high-side switch | `Q_SW` |
| d1 | `diode` 1N5819 | DIODE | Schottky catch diode | `D_CATCH` |
| l1 | `inductor` 22 mH | INDUCTOR | energy store / current smoother | `L_BK` |
| cbk | electrolytic 470 µF | — | output capacitor, 0.2 Ω ESR | `C_BK`, `R_ESR` |
| s2, rl2 | `switch-slide`, `resistor` 33 Ω 3 W | LOAD | buck load | `SW_B`, `R_L2` |

## Circuit

**Linear side.** `U1`: `REG` in `lin_in`, gnd, out `vout1`; vout 3.3, dropout 1.1, iLimit 1.1, iq 0.005; rating maxV 15, rth 90, tauTh 4 s, tMax 150, failMode `shutdown`. A PROBE `P_LIN` measures its input current.

**Buck side (switched, 10 kHz).** `GATE` is a PWM `PIN` (pin 9) whose HIGH level is Vin (`vccNode`), a level-shifting gate driver; LOW turns the P-FET on. `Q_SW` PMOS (vth −3 V, k 1.1 → ≈ 0.1 Ω at V_GS −12 V), `D_CATCH` (ground → sw), `L_BK` 22 mH (sw → vout2), `R_ESR` 0.2 Ω + `C_BK` 470 µF, load 33 Ω. `sim.dt` 0.8 ms (8 periods per step, every on and off interval solved at its real edge times). The sketch sets D = 3.3/Vin + an integral trim, with a 50 ms soft-start, and prints `duty:` for the serial-plotter readout.

The frequency is scaled down from a real buck IC (LM2596: 150 kHz; MP1584: up to 1.5 MHz) and the inductor scaled up to match, so the bench stays affordable.

Expected at 12 V, 100 mA each side:

- Linear: input 0.105 A; heat (12 − 3.3) × 0.1 + 12 × 0.005 = **0.93 W**; efficiency 0.33/1.26 = **26 %**; junction 25 + 0.93 × 90 ≈ **109 °C**.
- Buck: duty ≈ **0.29** (0.275 ideal, plus the losses); efficiency ≈ **86 %**; input ≈ **32 mA**; loss ≈ **0.05 W** (diode ≈ 0.02 W; see SIM NOTE); inductor ripple (V_in − V_out)·D/(L·f) = 8.7 × 0.29/(22 mH × 10 kHz) ≈ **12 mA** peak to peak.

## Readouts

SUPPLY (V vin) · LINEAR IN (P_LIN) · LINEAR OUT (vout1) · LINEAR HEAT (P of U1) · LDO TEMP (`U1.tj`) · LINEAR EFF (`lin.eta`, power-meter) · BUCK IN (P_BK) · BUCK OUT (vout2) · BUCK DUTY (`serial.duty`) · BUCK LOSS (`buck.loss`) · BUCK EFF (`buck.eta`).

Scope: capacitor current (the inductor's ripple, 5 mA/div, centred on zero) and inductor current (50 mA/div), 100 µs/div. Chart: LDO temperature and heat over 20 s.

## Tweaks

| label | target | range |
|---|---|---|
| Input voltage | `V_IN.value` | 5–14 V |
| Load resistance (both sides) | `R_L1.value`, linked `R_L2.value` | 6.8–100 Ω, log |
| LDO cooling (enum) | `U1.rating.rth` | 90 °C/W minimal pad / 46 °C/W big copper pour |

## Failures

### F1 `hot-ldo`: Ask the LDO for 220 mA
- **Patch:** `R_L1.value = 15`.
- **Sim shows:** LINEAR HEAT ≈ 1.97 W. On the minimal pad the junction heads for ≈ 200 °C, reaches 150 °C in about 5 s and shuts down, then cools to 130 °C, restarts, and cycles. With the big copper pour (46 °C/W) it settles at ≈ 116 °C.

### F2 `low-input`: Feed it only 4 V (dropout)
- **Patch:** `V_IN.value = 4`.
- **Sim shows:** LINEAR OUT ≈ 4 − 1.1 = 2.9 V. The buck raises its duty above 0.8 and still makes 3.3 V.

### F3 `adapter-24v`: Plug in a 24 V adapter
- **Patch:** `V_IN.value = 24`.
- **Sim shows:** the AMS1117 fails (its absolute maximum input is 15 V). The buck's duty falls to ≈ 0.14 and its input current drops: input power stays roughly constant.

## Datasheet figures used

- **AMS1117** (Advanced Monolithic Systems): input 15 V absolute max; dropout 1.1 V typ, 1.3 V max at 1 A; current limit 0.9 A min, 1.1 A typ, 1.5 A max; quiescent current 5 mA typ, 10 mA max; θJA 90 °C/W for SOT-223, 46 to over 90 °C/W depending on copper area; θJC 15 °C/W; power transistor junction 0–150 °C. No shutdown threshold is published: the model trips at 150 °C with 20 °C hysteresis. Packages: SOT-223, TO-252, SO-8 (no TO-220).
- **IRF9540N**: −100 V, −23 A, R_DS(on) 0.117 Ω max at V_GS −10 V, V_GS ±20 V.
- **1N5819**: 40 V, 1 A, V_F 0.60 V max at 1 A.
- **Buck ICs**: LM2596 switches at a fixed 150 kHz; MP1584 is programmable from 100 kHz to 1.5 MHz. Efficiency comes from each datasheet's curves (it depends on V_in, V_out and load), so the lesson quotes "typically 75–95 %" rather than a single figure.

## Meet the board, analogy, tips, quiz

See `src/lessons/T2/regulators-linear-buck.ts`: the text is written against the numbers above (0.93 W, 26 %, D ≈ 0.275–0.29, I_in ≈ 32 mA, ΔI ≈ 12 mA). The mechanical analogy is unchanged: a linear regulator is a pressure-reducing valve (Δp·Q becomes heat), and a buck is a gearbox (I_in < I_out, like torque in a reduction gear).

## SIM NOTE

- **Gate drive:** the PWM pin's HIGH level is Vin, so at 24 V the modelled V_GS reaches −24 V, beyond the IRF9540N's ±20 V. A real design clamps the gate drive. Gate voltage isn't rated in the model.
- **Numerical loss:** backward Euler loses about ½·L·ΔI² per switching interval in the inductor, ≈ 0.015 W here (it falls as L·f rises). The 22 mH / 10 kHz choice keeps it under a third of the buck's total loss at about 4–7 ms of solve per frame; 20 kHz cost twice as much, and 2.2 mH lost 0.15 W numerically.
- **Controller timing:** the sketch reads its ADC, then writes the PWM only when the 8-bit duty changes (with a 30 mV dead band), every 20 ms. A read inside the same frame as a PWM change goes through the bench's look-ahead (peek), which stretches the PWM period over the look-ahead and reads a wrong Vout (discontinuous-mode values, about 4.7 V). Rare writes avoid it.
- **Dropout** is a constant 1.1 V. The real part's dropout falls at lower currents.
