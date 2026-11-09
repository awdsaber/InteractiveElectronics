# RLC Resonance

*Ringing on purpose*

> 10 mH and 1 µF ring at 1.59 kHz, and 200 Ω of total loop resistance is just enough to stop the overshoot.

- **Lesson id:** `rlc-resonance` · **Track:** T1 Passives
- **Prerequisites:** `capacitor-rc`, `inductor-rl`
- **Power element:** `SW1`, the generator's OUTPUT (powerLabel: "Generator output ON"; starts `closed: true`, the bench opens it until power-on)
- **Transient:** yes: `sim: { dt: 4e-6, method: 'trap', speed: 0.01 }` (see SIM NOTE)

## Learning goals

1. Compute the natural frequency f₀ = 1/(2π√LC) and the characteristic impedance Z₀ = √(L/C).
2. Relate the damping ratio ζ = (R/2)·√(C/L) and Q = Z₀/R to the shape of a step response.
3. Identify underdamped, critically damped and overdamped responses, and pick R for each.
4. Explain why an undamped LC filter can nearly double the voltage on hot-plug.

## Board

Board: `RLC-12`, size 14 × 8, base `breadboard-only` (M3 plan: no solder step), manual `frame`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| gen | `module` (title "FUNCTION GEN") | `offboard` | GENERATOR | Buffered low-impedance output (0.05 Ω): STEP = 0 ↔ 5 V square at 50 Hz (a fresh step every 20 ms), SINE = 1 V peak, adjustable. | `V_STEP`, `V_SINE`, `SW_STEP`, `SW_SINE`, `SW1` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the parts. | — |
| rd | `resistor` (10 Ω, 1/4 W) | `tht` | DAMP | Added series damping (adjustable). | `R_D` |
| l1 | `inductor` (10 mH radial drum choke, ≈ 10 Ω DCR, ≈ 100 mA) | `tht` | COIL | Stores energy as current. | `L1`, `R_DCR` |
| c1 | `capacitor-ceramic` (1 µF film, 63 V) | `tht` | FILM | Stores energy as voltage. | `C1` |
| ch1, ch2 | `probe` | `offboard` | CH1 · V_C, CH2 · DRIVE | Scope probes on node d and node a. | — |
| rd-link | `wire` (hidden) | `offboard` | — | F1/F2: the wire link that replaces R_D. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_STEP` | V | `gq`, `0` | square, amp 2.5, offset 2.5, 50 Hz (0 ↔ 5 V); rInternal 0.05 Ω | — | |
| `V_SINE` | V | `gs`, `0` | sine, amp 1 V, 1592 Hz; rInternal 0.05 Ω | — | |
| `SW_STEP`, `SW_SINE` | SW | `gq`/`gs`, `sup` | one closed at a time by `source-select` | — | waveform button |
| `SW1` | SW | `sup`, `a` | closed: true | — | **power element** |
| `R_D` | R | `a`, `b` | 10 Ω | maxP 0.25 W (mean over 0.1 s) | |
| `L1` | L | `b`, `c` | 10 mH, i0 0 | maxI 0.1 A (RMS over 0.1 s: a heating limit) | |
| `R_DCR` | R | `c`, `d` | 10 Ω | — | choke winding (`partId: l1`) |
| `C1` | C | `d`, `0` | 1 µF, v0 0 | maxV 63 V | polyester film |

Expected: f₀ = 1.59 kHz, Z₀ = 100 Ω, R_total = 10 + 10 + 0.15 (generator 0.05 + two switch contacts 0.05 each) ≈ 20.15 Ω → ζ ≈ 0.101, Q ≈ 4.96; ringing at f₀√(1−ζ²) ≈ 1583 Hz; first peak V_C ≈ 8.64 V; peak current ≈ 43 mA. The sim measures 1583 Hz and 8.635 V.

## Readouts

| label | source | unit |
|---|---|---|
| CAP VOLTAGE | `{kind:'voltage', node:'d'}` | V |
| COIL CURRENT | `{kind:'current', elementId:'L1'}` | A |
| PEAK V_C (HOLD) | `{kind:'voltage', node:'d'}`, `peak: true` | V |
| f₀ | `{kind:'behavior', key:'rlc.f0'}` | Hz |
| ζ | `{kind:'behavior', key:'rlc.zeta'}` | '' |
| RING FREQ | `{kind:'behavior', key:'rlc.fd'}` | Hz |
| Q | `{kind:'behavior', key:'rlc.q'}` | '' |
| SINE GAIN | `{kind:'behavior', key:'rlc.gain'}` | '' |

f₀, ζ, f_d, Q and the sine gain are computed from the live L, C and loop resistance by `series-rlc`; the scope shows what the circuit actually does. Instruments open by default: CH1 V_C and CH2 drive at 2 V/div, 0.5 ms/div, auto trigger on CH2 rising at 0.5 V.

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Damping resistor | `R_D` | value | 0 | 470 | 1 | no | Ω |
| Generator waveform (enum: 5 V step / 1 V sine) | `behavior:drive` | mode | 0 | 1 | — | — | |
| Sine frequency | `V_SINE` | wave.freq | 200 | 10000 | — | yes | Hz |
| Capacitance | `C1` | value | 0.0000001 | 0.00001 | — | yes | F |
| Inductance | `L1` | value | 0.001 | 0.1 | — | yes | H |

R_D ≈ 190 Ω makes R_total ≈ 200 Ω, which is critical damping: the fastest rise with no overshoot. (An earlier draft said 180 Ω, which gives 190 Ω total and ζ ≈ 0.95: almost no visible overshoot, but not critical.) The slider sweeps ζ from ≈ 0.05 (R_D = 0) to ≈ 2.4 (R_D = 470 Ω).

## Failures

### F1: Take the damping resistor out
- **Patch:** `{op:'set', elementId:'R_D', key:'value', value:0}`
- **Sim shows:** V_C overshoots to ≈ 9.3 V and rings for many cycles; R_D is replaced by a visible wire link.
- **Why:** R_total ≈ 10.2 Ω gives ζ ≈ 0.05. The peak is 5 × (1 + e^(−πζ/√(1−ζ²))) ≈ 9.3 V. Energy sloshes between L and C with almost nothing to absorb it.

### F2: Hot-plug 12 V into a 16 V ceramic filter
- **Patches:** `R_D` value 0, `V_STEP` `wave.amp` 6 and `wave.offset` 6 (0 ↔ 12 V), `C1` `rating.maxV` 16 and `rating.failMode` 'short', drive mode forced to step.
- **Sim shows:** V_C overshoots toward 22 V; C1 fails short on overvoltage within the first half-cycle (a cracked MLCC usually fails short); the coil alone then sees 12 V (≈ 1.2 A against a 0.1 A rating) and burns open a moment later.
- **Why:** an underdamped LC input filter nearly doubles a step. A "12 V" rail with a 16 V capacitor is a classic hot-plug failure. Real designs add a damping element (e.g. an electrolytic with some ESR across the line) or a TVS diode.

### F3: The capacitor fails short
- **Patch:** `{op:'short', a:'d', b:'0'}`
- **Sim shows:** the circuit becomes a plain RL; COIL CURRENT reaches ≈ 248 mA in each 5 V half of the square drive (≈ 175 mA RMS), and L1 (100 mA rated) burns open after ≈ 0.34 s. R_D (≈ 0.31 W average against 1/4 W) would have been next.
- **Why:** without C there is nothing to oppose DC: I = 5/20.15 ≈ 248 mA.

## Meet the board

Put L and C together and energy swaps between the coil's current (½LI²) and the capacitor's voltage (½CV²). The swap has a natural rate:

**f₀ = 1 / (2π√(LC))** = 1 / (2π√(0.01 × 10⁻⁶)) = 1 / (2π × 10⁻⁴) = **1592 Hz**

The ratio of voltage to current in that swap is the **characteristic impedance**, Z₀ = √(L/C) = √(10⁴) = **100 Ω**. Compare the loop's resistance with Z₀:

- **ζ = R/(2Z₀)**, and **Q = Z₀/R = 1/(2ζ)**.
- On this board, R_total ≈ 10 (R_D) + 10 (DCR) + 0.1 ≈ 20 Ω, so ζ ≈ **0.10** and Q ≈ **5**.

**Step response.** If ζ < 1 the response rings, and the first peak overshoots by e^(−πζ/√(1−ζ²)) = e^(−0.316) = 0.73. V_C therefore peaks near 5 × 1.73 = **8.6 V**. That is more than the supply, from a passive circuit. If ζ = 1 (R = 2Z₀ = **200 Ω**) the response is critically damped: the fastest rise with no overshoot. If ζ > 1 it is overdamped and sluggish.

The ringing frequency is f₀√(1 − ζ²), which is nearly f₀ when damping is light. Count the peaks: with Q = 5, the ringing decays noticeably over about 5 cycles. Q is roughly the number of cycles it takes for the amplitude to fall to e^(−π) ≈ 4% of its start.

## For mechanical engineers

> This is your mass–spring–damper with different labels. L is the mass, C is the compliance (1/k) and R is the damper c. ωₙ = √(k/m) maps to 1/√(LC), and ζ = c/(2√(km)) maps to (R/2)√(C/L). A step in supply voltage is a step force, the current is the velocity, and the charge q = C·V_C is the displacement, so V_C reads displacement. **Where it breaks:** real parts carry parasitics. An inductor's winding capacitance gives it a self-resonant frequency, and core losses add damping that rises with frequency. Electrical Q factors of hundreds are routine, far higher than most structures reach.

## Pro tips

1. LC input filters on power entry can ring and overshoot when hot-plugged. Damp them, and choose capacitor ratings for the overshoot, not the nominal rail.
2. A scope probe's long ground lead is an inductor, roughly 1 nH per mm. Together with the probe's capacitance it rings on fast edges. Use the short ground spring for anything fast.
3. Resonance moves with tolerance. Because f₀ ∝ 1/√(LC), a 10% change in the L·C product shifts f₀ by about 5%. Pick tight-tolerance parts (film or C0G capacitors) for tuned circuits.

## Quiz

1. **What is the resonant frequency of 100 µH with 100 nF?**
   - 50.3 kHz
   - 5.03 kHz
   - 15.9 kHz
   - 159 kHz
   - **Answer:** 0. *Why:* √(10⁻⁴ × 10⁻⁷) = 3.16 µs, so f₀ = 1/(2π × 3.16 µ) = 50.3 kHz.

2. **What total series resistance critically damps 10 mH with 1 µF?**
   - 20 Ω
   - 100 Ω
   - 200 Ω
   - 1 kΩ
   - **Answer:** 2. *Why:* R = 2√(L/C) = 2 × 100 = 200 Ω.

3. **On this board, R_total is raised to 50 Ω. What is Q?**
   - 0.5
   - 2
   - 5
   - 10
   - **Answer:** 1. *Why:* Q = Z₀/R = 100/50 = 2.

4. **An undamped series LC is hit with a 5 V step. What is the highest the capacitor voltage can reach?**
   - 5 V
   - 7.1 V
   - Unlimited
   - 10 V
   - **Answer:** 3. *Why:* with ζ → 0 the overshoot approaches 100%, so the peak approaches 2 × 5 = 10 V.

## SIM NOTE

- **Time step and speed:** `sim.dt` = 4 µs (≈ 157 steps per ringing cycle) with the trapezoidal rule (`method: 'trap'`), which keeps LC ringing; backward Euler would damp it. Square-wave edges take one backward-Euler step (the engine's restart), which costs no visible damping. A frame at ×1 would owe ≈ 4170 steps (≈ 53 ms of compute headless), so the lesson starts at ×0.01 (≈ 42 steps, ≈ 0.35 ms per frame; ×0.1 ≈ 2.2 ms). At ×0.01 a 5 ms sweep draws in half a second and a fresh step arrives every 2 s.
- **Repeating step:** the step comes from a 50 Hz square wave instead of the power switch, so the scope keeps showing the step response while R_D, L or C are swept.
- **Behaviors:** `source-select` (the waveform button: closes one of `SW_STEP`/`SW_SINE`) and `series-rlc` (publishes f0, z0, zeta, q, fd, gain, rTotal from the live netlist; NaN once L or C has failed). The measured peak is a `peak: true` readout (sampled every step); the measured ringing frequency is read off the scope, not a readout (a behavior only sees one sample per frame).
