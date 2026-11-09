# Diodes and Rectifiers

*One-way valves for current*

> Four 1N4007s and 1000 µF turn a 12 V AC adapter into about 16 V DC, with about 1.1 V of ripple at 156 mA.

- **Lesson id:** `diode-rectifier` · **Track:** T2 Semiconductors
- **Prerequisites:** `transformer`, `capacitor-rc`
- **Power element:** `SW_MAINS` (powerLabel: "Plug in the adapter")
- **Transient:** yes

## Learning goals

1. Describe a silicon diode's forward drop (≈ 0.6–1 V depending on current) and its reverse blocking.
2. Trace current through a full-wave bridge on each half-cycle.
3. Estimate the DC output and ripple of a capacitor-input rectifier: ΔV ≈ I/(2fC).
4. Check a diode's ratings: average current, surge current (I_FSM) and peak reverse voltage (V_RRM).

## Board

Board: `RECT-15`, size 14 × 9, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| xf | `transformer` (12 V AC 1 A plug-in adapter) | `offboard` | XFMR | Safe low-voltage AC source (same adapter as the `transformer` lesson). | `V_SEC`, `SW_MAINS`, `R_W` |
| term | `screw-terminal` | `tht` | AC IN | Adapter connection. | — |
| d1–d4 | `diode` (1N4007) | `tht` | BRIDGE | Steer both half-cycles the same way into the load. | `D1`–`D4` |
| c1 | `capacitor-electrolytic` (1000 µF, 25 V) | `tht` | SMOOTH | Holds the output up between peaks. | `C1` |
| rl | `resistor` (100 Ω, 5 W) | `tht` | LOAD | Draws ≈ 150 mA. | `R_LOAD` |
| tp | `testpoint` | `tht` | SCOPE | Ripple measurement point. | — |

## Circuit

The secondary floats; the DC negative is ground `0`.

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_SEC` | V | `x`, `ac2` | sine: amp 19.1 V (13.5 V RMS open-circuit), 50 Hz | — | behavior `sine-source` |
| `SW_MAINS` | SW | `x`, `y` | closed: false | — | **power element** |
| `R_W` | R | `y`, `ac1` | 1.5 Ω | — | winding resistance (`partId: xf`) |
| `D1` | D | `ac1`, `dcp` | 1N4007 | maxI 1 A, maxV 1000 V | |
| `D2` | D | `ac2`, `dcp` | 1N4007 | maxI 1 A, maxV 1000 V | |
| `D3` | D | `0`, `ac1` | 1N4007 | maxI 1 A, maxV 1000 V | |
| `D4` | D | `0`, `ac2` | 1N4007 | maxI 1 A, maxV 1000 V | |
| `C1` | C | `dcp`, `0` | 1000 µF | maxV 25 V, failMode short | |
| `R_LOAD` | R | `dcp`, `0` | 100 Ω | maxP 5 W | |

Expected (sim): DC ≈ 16.0 V average (peak 16.5 V), ripple ≈ 1.1 V p-p at 100 Hz (the formula I/(2fC) = 1.56 V is an upper bound; the diodes recharge for ≈ 2.5 ms of each 10 ms), load ≈ 156 mA (2.5 W). Half-wave: ≈ 2.5 V ripple, DC ≈ 14.8 V. Diode current comes in short pulses of several hundred mA near each peak. No-load output ≈ 17.5 V (< 25 V cap rating).

## Readouts

| label | source | unit |
|---|---|---|
| DC OUT | `{kind:'voltage', node:'dcp'}` | V |
| RIPPLE p-p | `{kind:'behavior', key:'ripple.dcp'}` | V |
| LOAD CURRENT | `{kind:'current', elementId:'R_LOAD'}` | A |
| D1 PEAK | `{kind:'behavior', key:'peak.D1'}` | A |
| AC IN | `{kind:'voltage', node:'ac1', ref:'ac2'}` | V |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Smoothing capacitor | `C1` | value | 0.0001 | 0.0047 | — | yes | F |
| Load resistance | `R_LOAD` | value | 47 | 1000 | — | yes | Ω |

Doubling C halves the ripple. Halving R_LOAD doubles the current and the ripple, and the diode pulses grow taller and narrower.

## Failures

### F1: One diode goes open
- **Patch:** `{op:'remove', elementId:'D2'}`
- **Sim shows:** only one half-cycle is rectified; ripple doubles to ≈ 3 V at 50 Hz and DC OUT drops.
- **Why:** the bridge becomes a half-wave rectifier, so the capacitor is recharged every 20 ms instead of every 10 ms: ΔV ≈ I/(fC).

### F2: Leave out the smoothing capacitor
- **Patch:** `{op:'remove', elementId:'C1'}`
- **Sim shows:** DC OUT is a string of 100 Hz humps from 0 V to ≈ 17 V. A DC meter would read their average, ≈ 11 V.
- **Why:** without storage, the output is just |v_ac| minus two diode drops. The average of a full-wave rectified sine is 2V_p/π.

### F3: A diode fitted backwards
- **Patch:** remove `D2`, add `D2R` with its nodes swapped (`dcp`, `a2`).
- **Sim shows:** on every positive half-cycle the loop adapter → R_W → D1 → D2R → adapter has only 1.5 Ω and two diode drops in it: ≈ 10 A peaks. D1 and D2R burn open after ≈ 0.3 s.
- **Why:** a reversed diode turns the bridge into a short circuit across the secondary. This is why rectifiers are fused and why you check the stripe first.

## Meet the board

A diode conducts when its anode is about **0.6–0.7 V** above its cathode (a 1N4007 reaches ≈ 0.9 V near 1 A). In reverse it blocks, up to its V_RRM of **1000 V**.

**Bridge.** On the positive half-cycle, current flows ac1 → D1 → load → D4 → ac2. On the negative half-cycle it flows ac2 → D2 → load → D3 → ac1. Either way it passes through the load the same way, crossing **two** diodes.

**Peak output.** Off-load the secondary peaks at √2 × 13.5 = **19.1 V**. Under load, subtract two diode drops (≈ 1.7 V) and the winding's drop during the charging pulses (≈ 1.3 V), leaving a peak of about **16.1 V**.

**Ripple.** Between peaks the capacitor alone feeds the load, sagging by

ΔV ≈ I / (2·f·C) = 0.15 / (2 × 50 × 0.001) = **1.5 V p-p**

so the average is about 16.1 − 0.75 ≈ **15.3 V**, and I ≈ 15.3/100 ≈ 0.15 A ✓.

**Diode stress.** Each diode carries half the load current on average (75 mA). But the capacitor recharges only near the peaks, so each pulse is several times the DC current. Each diode also blocks about one peak voltage (≈ 19 V) in reverse, far below its 1000 V rating. At switch-on, the empty 1000 µF looks like a short, and the 1N4007's **30 A** surge rating (I_FSM) covers that first gulp.

## For mechanical engineers

> Diodes are check valves, and the bridge is the classic four-check-valve circuit that turns a double-acting piston's back-and-forth flow into one-way flow. The smoothing capacitor is an accumulator that soaks up the pulsation, and ripple is the residual pressure pulsation. **Where it breaks:** a check valve opens at a fixed cracking pressure, but a diode's current rises exponentially with voltage, so there's no sharp threshold. Diodes also take a moment to stop conducting when reversed (reverse recovery), which matters at high switching frequencies.

## Pro tips

1. Rate diodes with margin: V_RRM at least 2× the peak reverse voltage, and average current well inside the rating. Also check I_FSM against the switch-on inrush into your capacitor.
2. Electrolytic life roughly halves for every 10 °C hotter they run, and ripple current heats them. Check the capacitor's ripple-current rating, not just its µF and volts.
3. For low-voltage, high-current outputs, Schottky diodes (1N5819, 1N5822) drop roughly half a volt or less instead of ≈ 1 V. Above about 1 A, use a packaged bridge (e.g. KBP206) on a proper footprint.

## Quiz

1. **A full-wave rectifier on 50 Hz feeds 0.5 A from 2200 µF. Roughly how much ripple?**
   - 1.1 V
   - 2.3 V
   - 4.5 V
   - 0.23 V
   - **Answer:** 1. *Why:* ΔV = I/(2fC) = 0.5/(100 × 0.0022) = 2.27 V.

2. **A 9 V RMS secondary feeds a bridge. What is the approximate peak DC output (ignoring winding drop)?**
   - 9.0 V
   - 10.3 V
   - 11.1 V
   - 12.7 V
   - **Answer:** 2. *Why:* 9 × √2 = 12.73 V peak, minus two drops of ≈ 0.8 V, gives ≈ 11.1 V.

3. **Compared with full-wave, a half-wave rectifier with the same C and load has…**
   - twice the ripple
   - half the ripple
   - the same ripple
   - no ripple
   - **Answer:** 0. *Why:* it recharges once per cycle instead of twice, so it sags for twice as long.

4. **In this bridge, roughly what peak reverse voltage does each diode block?**
   - 0.7 V
   - twice the peak (≈ 38 V)
   - 1000 V
   - about one secondary peak (≈ 19 V)
   - **Answer:** 3. *Why:* when off, each diode sits across the output in series with a conducting diode, so it sees ≈ V_peak.

## SIM NOTE

- **Sine source:** as in `ac-oscilloscope`.
- **Time step:** the conduction pulses last ~1–2 ms. A 1 ms step badly under-resolves them, so use dt ≤ 100 µs (per-lesson `dt`).
- **AC/pulsed ratings:** the short-diode current in F3 is pulsed (≈ 8 ms on, 12 ms off), so a "continuously over `maxI` for 300 ms" rule never fires. Ratings need RMS or thermal integration (e.g. I²t or a junction-temperature RC) so pulsed overloads burn parts. Real diodes also need a separate `I_FSM` surge rating.
- **Behaviors:** the shared `ac-meter` (DC out, ripple p-p, AC rms); D1's peak current is a `peak: true` readout. I_FSM is stated, not simulated. Built on a breadboard with a floating secondary.
- Electrolytic reverse polarity is not modelled (see `capacitor-rc`).
