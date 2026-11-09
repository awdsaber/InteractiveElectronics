# AC and the Oscilloscope

*Seeing voltage over time*

> A 10 V peak-to-peak, 50 Hz sine is 3.54 V RMS, and a 3.3 kΩ / 1 µF low-pass passes only about 69% of it.

- **Lesson id:** `ac-oscilloscope` · **Track:** T1 Passives
- **Prerequisites:** `capacitor-rc`
- **Power element:** `SW_OUT` (powerLabel: "Generator output ON")
- **Transient:** yes

## Learning goals

1. Describe a sine wave by its peak, peak-to-peak, RMS, period, frequency and phase.
2. Set an oscilloscope's volts/div, time/div and trigger to get a stable, readable trace.
3. Calculate a capacitor's reactance X_C = 1/(2πfC), and a first-order RC filter's gain and phase at a given frequency.
4. Account for a generator's 50 Ω source resistance and a probe's ×10 attenuation.

## Board

Board: `SCOPE-13`, size 14 × 9, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| gen | `module` (title "FUNCTION GEN", 50 Ω output) | `offboard` | GEN | Produces the sine. | `V_GEN`, `SW_OUT` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the filter. | — |
| r1 | `resistor` (3.3 kΩ, 1/4 W) | `tht` | FILTER | Series element of the low-pass. | `R1` |
| c1 | `capacitor-ceramic` (1 µF film, 63 V) | `tht` | FILM | Shunt element; its reactance falls with frequency. | `C1` |
| ch1 | `probe` (×10, yellow) | `offboard` | CH1 | Watches the filter input. | — |
| ch2 | `probe` (×10, cyan) | `offboard` | CH2 | Watches the filter output. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_GEN` | V | `gen`, `0` | sine: amp 5 V, freq 50 Hz, offset 0, rInternal 50 Ω | — | value driven by behavior `sine-source` (see SIM NOTE) |
| `SW_OUT` | SW | `gen`, `in` | closed: false | — | **power element** |
| `R1` | R | `in`, `out` | 3300 Ω | maxP 0.25 W | |
| `C1` | C | `out`, `0` | 1 µF | maxV 63 V | |

Expected at 50 Hz: input (CH1, after the generator's 50 Ω) ≈ 4.96 V peak (3.51 V RMS, 9.92 Vpp); X_C = 3183 Ω; output ≈ 0.694 × input ≈ 2.44 V RMS, lagging by ≈ 46.0°. CH1 is the filter input, so the CH1-to-CH2 response is R1 and C1 alone: f_c = 1/(2π·RC) = 48.2 Hz. (The 50 Ω only matters against the generator's own EMF, where it would give 47.5 Hz and 46.5°; the scope never sees that node.)

## Readouts

| label | source | unit |
|---|---|---|
| IN Vpp | `{kind:'behavior', key:'ac.vpp'}` | V |
| IN RMS | `{kind:'behavior', key:'ac.acrms'}` | V |
| OUT RMS | `{kind:'behavior', key:'ac.acrmsB'}` | V |
| GAIN | `{kind:'behavior', key:'ac.gain'}` | % |
| FREQUENCY | `{kind:'behavior', key:'ac.freq'}` | Hz |
| PERIOD | `{kind:'behavior', key:'ac.period'}` | s |
| PHASE | `{kind:'behavior', key:'ac.phase'}` | ° |

The instantaneous CH1 / CH2 voltages are the scope traces (instrument panel, open by default: 2 V/div, 5 ms/div, rising trigger at 0 V on CH1).

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Frequency | `V_GEN` | wave.freq | 5 | 500 | — | yes | Hz |
| Amplitude (peak) | `V_GEN` | wave.amp | 0.5 | 10 | 0.1 | no | V |
| Filter resistor | `R1` | value | 330 | 33000 | — | yes | Ω |

Sweep the frequency: below 10 Hz CH2 tracks CH1 almost exactly. Around 48 Hz it is down to 71% and 45° behind. By 500 Hz it is about a tenth, lagging nearly 90°.

## Failures

### F1: Add a 3 V DC offset
- **Patch:** `{op:'set', elementId:'V_GEN', key:'wave.offset', value:3}` (3 V, not 5 V, so the lifted trace stays on a 2 V/div screen)
- **Sim shows:** both traces lift by 3 V. The output's DC level passes at 100% while its AC part is still cut to 69%.
- **Why:** at DC, X_C is infinite, so the capacitor takes no current and the "filter" passes DC untouched. On the scope, AC coupling would hide the offset, and DC coupling shows it.

### F2: Turn the frequency up to 500 Hz
- **Patch:** `{op:'set', elementId:'V_GEN', key:'wave.freq', value:500}`
- **Sim shows:** OUT RMS ≈ 0.33 V and PHASE ≈ −84.5°.
- **Why:** X_C = 1/(2π × 500 × 1 µ) = 318 Ω, much smaller than R. |H| = 318/√(3300² + 318²) ≈ 0.096 (0.333 V RMS: 0.096 × 4.93 V peak / √2).

### F3: Load the generator with 47 Ω
- **Patch:** `{op:'add', element:{id:'R_X', type:'R', nodes:['in','0'], value:47}}`
- **Sim shows:** CH1 amplitude falls from 5.0 V to ≈ 2.4 V peak.
- **Why:** the generator is 5 V behind 50 Ω, so a 47 Ω load gives 5 × 47/97 = 2.42 V. Bench generators display amplitude assuming either a 50 Ω load or high-Z. Know which setting is active.

## Meet the board

An AC voltage repeats: v(t) = V_p·sin(2πft + φ). Here **V_p = 5 V**, so V_pp = 10 V. The period is T = 1/f = 1/50 = **20 ms**.

**RMS** is the DC voltage that would heat a resistor equally. For a sine, V_rms = V_p/√2 = 5/1.414 = **3.54 V**. Meters show RMS; scopes show the shape.

A capacitor's opposition to AC is its **reactance**, X_C = 1/(2πfC). At 50 Hz, X_C = 1/(2π × 50 × 10⁻⁶) = **3183 Ω**, about the same as R1. The RC divider's gain and phase are

|H| = X_C / √(R² + X_C²) = 3183 / √(3300² + 3183²) = **0.69**, φ = −arctan(R/X_C) = **−46°**

so CH2 is about 2.4 V RMS and peaks 46/360 × 20 ms ≈ **2.6 ms** after CH1. The cutoff, where |H| = 0.707 and φ = −45°, is f_c = 1/(2πRC) = **48.2 Hz**.

**Scope basics.**

- Volts/div sets the vertical scale: at 2 V/div, a 10 V_pp sine spans five divisions.
- Time/div sets the horizontal scale: at 5 ms/div, one period spans four divisions.
- The **trigger** starts each sweep at the same point on the wave (e.g. rising edge through 0 V), which is what makes the trace stand still.

## For mechanical engineers

> This is a frequency-response test on a shaker table. A first-order system, such as a spring driving a damper, follows slow inputs faithfully, attenuates fast ones and lags by up to 90°. That is exactly the RC low-pass. The scope is your accelerometer-plus-DAQ, and the trigger is the tach pulse that lines up each revolution. **Where it breaks:** a mechanical first-order system is usually an approximation of something higher order. An RC network really is first order (until parasitics appear), so its Bode plot matches the formula to the decibel.

## Pro tips

1. Use ×10 probes and compensate them first on the scope's built-in square-wave output. An uncompensated probe distorts every edge you look at.
2. A bench scope's ground clip is tied to mains earth. Clipping it to a non-earth-referenced node of mains-powered gear creates a short through the earth wire. Use a differential probe or an isolated supply.
3. Cheap meters assume a sine when they show RMS. For PWM, triangle or distorted waveforms, use a "true RMS" meter or the scope's RMS measurement.

## Quiz

1. **UK mains is 230 V RMS. What is its peak voltage?**
   - 325 V
   - 163 V
   - 230 V
   - 460 V
   - **Answer:** 0. *Why:* V_p = √2 × 230 = 325 V.

2. **What is the period of a 60 Hz signal?**
   - 6.0 ms
   - 16.7 ms
   - 20.0 ms
   - 60.0 ms
   - **Answer:** 1. *Why:* T = 1/60 = 16.7 ms.

3. **What is the reactance of a 1 µF capacitor at 1 kHz?**
   - 1.59 Ω
   - 15.9 Ω
   - 1.59 kΩ
   - 159 Ω
   - **Answer:** 3. *Why:* X_C = 1/(2π × 1000 × 10⁻⁶) = 159 Ω.

4. **What does the scope's trigger do?**
   - Sets the vertical gain
   - Removes the DC component
   - Starts each sweep at the same point on the waveform, so repeated sweeps overlay
   - Measures RMS
   - **Answer:** 2. *Why:* without a consistent start point, each sweep lands at a different phase and the trace smears.

## SIM NOTE

- **Sine source (done):** `V.wave` now exists; the lesson uses it. (Original note: the engine had only DC `V`. Either add a waveform to `V` (e.g. `wave?: {kind:'sine', amp, freq, offset, phase}`, with tweakable keys `amp`, `freq`, `offset`), or ship a behavior `sine-source` that calls `setParam(V_GEN,'value', offset + amp·sin(2πft))` every tick.)
- **Scope view (done):** the instrument panel's scope. (Original note: readouts are scalars. A two-channel time-trace widget (rolling buffer of node voltages, time/div and volts/div controls, edge trigger) was needed for this lesson to make sense.)
- **Measurement behavior** `ac-meter` (done): a least-squares sine fit at the generator's frequency gives amplitude and phase for two nodes (frame-sampled, so no zero-crossing search); FREQUENCY is the generator's setting, not counted. It publishes `vpp`, `acrms`, `acrmsB`, `gainPct`, `freq`, `period` and `phase`.
- **Time step:** 1 ms gives only 20 samples per 50 Hz cycle and 2 at 500 Hz. The lesson uses `sim: { dt: 50e-6, speed: 0.1, method: 'trap' }`: 40 points a cycle at 500 Hz, and trapezoidal integration because backward Euler at this dt lags the 500 Hz phase by about 4° too few (−80° against −84.5°).
