# Circuit Atelier: Curriculum (T0–T3)

Lesson design documents for tracks T0–T3. Each file is the source for one `Lesson` object in `src/lessons/<TRACK>/<lesson-id>.ts`, validated by `src/engine/lessonSchema.ts`. The data model is in `src/engine/types.ts` and the syllabus in `docs/spec.md` §6.

## Order and prerequisites

The sidebar opens with **Start here: Arduino Uno** (`arduino-uno`, T4, video Fig. 01), then lists T0 onward. Fig numbers are assigned in sidebar order. Lessons with a video figure keep it: `led-resistor` (Fig. 02) and `transistor-switch` (Fig. 03).

### T0 Foundations

| # | Lesson | File | Prerequisites |
|---|---|---|---|
| 1 | Charge, Voltage and Current | [T0/charge-voltage-current.md](T0/charge-voltage-current.md) | none |
| 2 | Ohm's Law | [T0/ohms-law.md](T0/ohms-law.md) | charge-voltage-current |
| 3 | Power and Heat | [T0/power-heat.md](T0/power-heat.md) | ohms-law |
| 4 | Series and Parallel | [T0/series-parallel.md](T0/series-parallel.md) | ohms-law |
| 5 | Kirchhoff's Laws | [T0/kirchhoff.md](T0/kirchhoff.md) | series-parallel |
| 6 | Batteries | [T0/batteries.md](T0/batteries.md) | ohms-law, series-parallel, power-heat |
| 7 | The Multimeter | [T0/multimeter.md](T0/multimeter.md) | series-parallel, batteries |
| 8 | The Breadboard | [T0/breadboard.md](T0/breadboard.md) | charge-voltage-current, ohms-law |

### T1 Passives

| # | Lesson | File | Prerequisites |
|---|---|---|---|
| 1 | Resistor Codes and Dividers | [T1/resistor-codes-divider.md](T1/resistor-codes-divider.md) | series-parallel, multimeter |
| 2 | Capacitors and RC Time | [T1/capacitor-rc.md](T1/capacitor-rc.md) | ohms-law, kirchhoff |
| 3 | Inductors and RL Time | [T1/inductor-rl.md](T1/inductor-rl.md) | capacitor-rc |
| 4 | RLC Resonance | [T1/rlc-resonance.md](T1/rlc-resonance.md) | capacitor-rc, inductor-rl |
| 5 | AC and the Oscilloscope | [T1/ac-oscilloscope.md](T1/ac-oscilloscope.md) | capacitor-rc |
| 6 | The Transformer | [T1/transformer.md](T1/transformer.md) | inductor-rl, ac-oscilloscope |

### T2 Semiconductors

| # | Lesson | File | Prerequisites |
|---|---|---|---|
| 1 | Diodes and Rectifiers | [T2/diode-rectifier.md](T2/diode-rectifier.md) | transformer, capacitor-rc |
| 2 | LED and Resistor (Fig. 02) | [T2/led-resistor.md](T2/led-resistor.md) | arduino-uno, ohms-law, breadboard |
| 3 | The Zener Regulator | [T2/zener.md](T2/zener.md) | diode-rectifier, resistor-codes-divider, power-heat |
| 4 | The Transistor Switch (Fig. 03) | [T2/transistor-switch.md](T2/transistor-switch.md) | led-resistor, inductor-rl |
| 5 | The MOSFET Switch | [T2/mosfet-switch.md](T2/mosfet-switch.md) | transistor-switch, power-heat |
| 6 | Op-Amp Basics | [T2/opamp-basics.md](T2/opamp-basics.md) | resistor-codes-divider, kirchhoff |
| 7 | Linear and Buck Regulators | [T2/regulators-linear-buck.md](T2/regulators-linear-buck.md) | zener, opamp-basics, mosfet-switch, inductor-rl |

### T3 Digital

| # | Lesson | File | Prerequisites |
|---|---|---|---|
| 1 | Logic Gates | [T3/logic-gates.md](T3/logic-gates.md) | mosfet-switch |
| 2 | Flip-Flops and Counters | [T3/flipflops-counters.md](T3/flipflops-counters.md) | logic-gates, transistor-switch, capacitor-rc |
| 3 | The 555 Timer | [T3/timer-555.md](T3/timer-555.md) | capacitor-rc, flipflops-counters |
| 4 | ADC, DAC and PWM | [T3/adc-dac-pwm.md](T3/adc-dac-pwm.md) | arduino-uno, resistor-codes-divider, capacitor-rc, opamp-basics |

### Prerequisite graph (summary)

```
charge-voltage-current ─► ohms-law ─┬─► power-heat ─────────────┐
                                    ├─► series-parallel ─► kirchhoff
                                    │        └─► batteries ─► multimeter ─► resistor-codes-divider
                                    └─► breadboard ─► led-resistor (+ arduino-uno)
kirchhoff ─► capacitor-rc ─┬─► inductor-rl ─► rlc-resonance
                           └─► ac-oscilloscope ─► transformer ─► diode-rectifier ─► zener
led-resistor + inductor-rl ─► transistor-switch ─► mosfet-switch ─► logic-gates ─► flipflops-counters ─► timer-555
resistor-codes-divider + kirchhoff ─► opamp-basics ─► regulators-linear-buck (+ zener, mosfet-switch)
opamp-basics + capacitor-rc + arduino-uno ─► adc-dac-pwm
```

The track order in the sidebar stays T0 → T3 as listed. Prerequisites are advisory ("recommended first"), not locks.

## File format

Every lesson file has the same sections, which map onto `Lesson` fields:

| Section | `Lesson` field(s) |
|---|---|
| Title, *subtitle*, > tagline | `title`, `subtitle`, `tagline` |
| Header bullets | `id`, `track`, `powerElementId`, `powerLabel`, `transient` |
| Board table | `board.parts[]` (`kind`, `mount`, `label`, `role`, `circuitIds`); positions are left to the board author |
| Circuit table | `circuit.elements[]` (`id`, `type`, `nodes`, values, `rating`) |
| Sketch | `sketch` (code, `pins`, `analogPins`, `vcc`, `board`) |
| Readouts / Tweaks / Status lines | `readouts`, `tweaks`, `statusLines` |
| Failures | `failures[]`: patches are written exactly as `FailurePatch` objects |
| Meet the board | `meet` |
| For mechanical engineers | `mechanicalAnalogy` |
| Pro tips | `proTips` |
| Quiz | `quiz[]`: **answer indices are 0-based** |
| SIM NOTE | engine requirements; not shipped to the learner |

### Rating conventions used throughout

- **5 mm LED:** `maxI 0.03` (30 mA absolute maximum; 20 mA continuous is the design target, flagged by a status line), `maxV 5` (reverse).
- **1/4 W resistor:** `maxP 0.25`, `maxV 250`.
- **ATmega328P pin:** `maxI 0.04` (40 mA absolute maximum; 20 mA recommended).
- **Transistors:** PN2222A (TO-92 2N2222A) 600 mA / 625 mW / 40 V; 2N3904 200 mA / 625 mW / 40 V; 2N7000 200 mA / 400 mW / 60 V; BS250 180 mA / 830 mW / 45 V; IRLZ44N 55 V, ≤ 25 mΩ at V_GS 5 V, 2.4 W free-air. Transistors use `failMode:'short'`.
- **Diodes:** 1N4007 1 A / 1000 V; 1N4733A 5.1 V / 1 W.
- **Fuses:** modelled as a 0.1 Ω `R` with `maxI` and `failMode:'open'`.
- Motor, inductor and timing-model parameters marked "illustrative" are plausible engine values, not datasheet figures.

## Engine requirements gathered from SIM NOTEs

Grouped by area, with the lessons that need each:

**Sources and waveforms**
1. Sine (and later square/PWM) waveform on `V`: `amp`, `freq`, `offset`, `phase` as tweakable keys. Alternatively, a `sine-source` behavior with per-lesson parameters. Lessons: ac-oscilloscope, transformer, diode-rectifier.
2. Behavior parameters: `behaviors: string[]` can't carry configuration (frequency, η, thresholds). Needs e.g. `behaviors: {id, params}[]`. Lessons: most behaviors below.
3. Constant-current limit on `V` (bench-supply CC mode, `iLimit`). Lesson: ohms-law (deferred short-circuit scenario).
4. Source-only `V` (`sinkCapable:false`) for bench supplies that can't absorb back-fed current. Lesson: kirchhoff.
5. True PWM switching on `PIN` at the real pin frequency (490/980 Hz) instead of averaging. Lessons: adc-dac-pwm; later buck and motor lessons.

**Time stepping and integration**
6. Per-lesson `dt` (e.g. `Lesson.dt`), with the bench running more steps per frame or a slow-motion factor. Lessons: rlc-resonance (≤ 5 µs), ac-oscilloscope (≤ T/100), diode-rectifier (≤ 100 µs), inductor-rl and transistor-switch (switching edges), flipflops-counters (bounce).
7. Trapezoidal integration (or adaptive stepping) for L–C circuits; backward Euler over-damps resonance. Lesson: rlc-resonance.

**Device models**
8. Breakdown/arc clamp on `SW` and avalanche clamp on transistors (`vBreak`), so inductive spikes read hundreds of volts, not megavolts, before `maxV` trips. Lessons: inductor-rl, transistor-switch.
9. Coupled inductors (`K`) or an ideal transformer element (`XFMR`: ratio, magnetising L, winding R, saturation). Lesson: transformer.
10. Capacitor `esr` and `rLeak`, and a reverse-voltage rating for electrolytics. Lessons: capacitor-rc, diode-rectifier.
11. Saturating inductor (`iSat`). Lesson: inductor-rl.
12. Zener dynamic resistance `rz` and soft knee. Lesson: zener.
13. MOSFET gate capacitances (`cgs`, `cgd`), temperature-dependent R_DS(on), and an implicit body diode. Also document the `k` and PMOS `vth` sign convention. Lessons: mosfet-switch, logic-gates.
14. `OPAMP`: rails that reference supply nodes, a dynamic model (GBW, slew) so positive feedback latches, and an output current limit. Lessons: opamp-basics, regulators-linear-buck.
15. Regulator primitive (`REG`: V_out, dropout, I_q, current limit, thermal shutdown) as an alternative to macro models. Lesson: regulators-linear-buck.
16. 3-terminal potentiometer (`POT` with tweakable `position`). Lesson: adc-dac-pwm (also opamp-basics).
17. Digital logic primitive (behavior-driven gates and counters with V_IH/V_IL and Schmitt thresholds; outputs as `V` behind ≈ 50 Ω). Lessons: logic-gates, flipflops-counters.
18. Initial-state hint for bistable circuits (node `v0` or a `latch-init` kick, optionally randomised). Lesson: flipflops-counters.
19. Floating-input realism (drift and hum on nodes held only by Gmin). Lesson: logic-gates.
20. Switch bounce behavior. Lesson: flipflops-counters.

**Ratings and failures**
21. AC-aware ratings: compare `maxI` with RMS, or integrate I²t / junction temperature, so pulsed and sinusoidal overloads burn parts. Lessons: transformer, diode-rectifier. Diodes also need an `I_FSM` surge rating.
22. Thermal model (`thermal-rc` behavior: θ in °C/W plus a thermal time constant), with temperature-based burn instead of a fixed 300 ms timer. Also a `failMode:'shutdown'` for parts with thermal protection. Lessons: power-heat, regulators-linear-buck, mosfet-switch.
23. `applyPatches` support for nested keys (`rating.maxP`, `rating.maxV`). Lessons: power-heat, rlc-resonance.
24. `maxI` checked on `SW` elements. Lessons: timer-555, inductor-rl.
25. Fuse element with an I²t blow curve (optional; `R` + `maxI` works today). Lessons: multimeter, transformer.
26. Analog-input overvoltage rating (> V_CC + 0.5 V). Lesson: adc-dac-pwm (future failure).
27. Battery overheating/capacity (`battery-soc` behavior, rating on internal R). Lesson: batteries.

**Readouts and UI**
28. Scope widget: a two-channel time-trace with time/div, volts/div and edge trigger. Lessons: ac-oscilloscope, rlc-resonance, diode-rectifier, transformer, adc-dac-pwm.
29. Measurement behaviors: `ac-meter` (RMS, frequency, phase, average power), `ripple-meter`, `peak-hold`, `peak-and-freq`, `coulomb-counter`.
30. Readout units: add `'C'` (coulomb), and consider `'%'` for duty cycle.

**Lesson-specific behaviors to register in `src/engine/behaviors/`:** `coulomb-counter`, `thermal-rc`, `battery-soc`, `sine-source`, `ac-meter`, `ideal-transformer`, `ripple-meter`, `peak-hold`, `peak-and-freq`, `buck-averaged`, `ne555`, `hc393-counter`, `latch-init`, `switch-bounce`, `floating-input`.
