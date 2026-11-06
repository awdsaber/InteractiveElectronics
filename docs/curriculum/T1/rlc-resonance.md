# RLC Resonance

*Ringing on purpose*

> 10 mH and 1 µF ring at 1.59 kHz, and 200 Ω of total loop resistance is exactly enough to kill the overshoot.

- **Lesson id:** `rlc-resonance` · **Track:** T1 Passives
- **Prerequisites:** `capacitor-rc`, `inductor-rl`
- **Power element:** `SW1` (powerLabel: "Apply the step")
- **Transient:** yes (see SIM NOTE on time step)

## Learning goals

1. Compute the natural frequency f₀ = 1/(2π√LC) and the characteristic impedance Z₀ = √(L/C).
2. Relate the damping ratio ζ = (R/2)·√(C/L) and Q = Z₀/R to the shape of a step response.
3. Identify underdamped, critically damped and overdamped responses, and pick R for each.
4. Explain why an undamped LC filter can nearly double the voltage on hot-plug.

## Board

Board: `RLC-12`, size 14 × 8, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| pwr | `module` (title "BENCH PSU") | `offboard` | SUPPLY | Provides the 5 V step. | `V_SUP` |
| sw1 | `switch-slide` | `tht` | STEP | Applies the step. | `SW1` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the parts. | — |
| rd | `resistor` (10 Ω, 1/4 W) | `tht` | DAMP | Added series damping (adjustable). | `R_D` |
| l1 | `inductor` (10 mH radial drum choke, ≈ 10 Ω DCR, ≈ 100 mA) | `tht` | COIL | Stores energy as current. | `L1`, `R_DCR` |
| c1 | `capacitor-ceramic` (1 µF film, 63 V) | `tht` | FILM | Stores energy as voltage. | `C1` |
| scope | `probe` (×10 scope probe) | `offboard` | SCOPE | Watches V_C ring. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_SUP` | V | `sup`, `0` | 5.0 V, rInternal 0.05 Ω | — | |
| `SW1` | SW | `sup`, `a` | closed: false | — | **power element** |
| `R_D` | R | `a`, `b` | 10 Ω | maxP 0.25 W | |
| `L1` | L | `b`, `c` | 10 mH, i0 0 | maxI 0.1 A | |
| `R_DCR` | R | `c`, `d` | 10 Ω | — | choke winding (`partId: l1`) |
| `C1` | C | `d`, `0` | 1 µF, v0 0 | maxV 63 V | polyester film |

Expected: f₀ = 1.59 kHz, Z₀ = 100 Ω, R_total ≈ 20.1 Ω → ζ ≈ 0.10, Q ≈ 5; first peak V_C ≈ 8.6 V; peak current ≈ 43 mA.

## Readouts

| label | source | unit |
|---|---|---|
| CAP VOLTAGE | `{kind:'voltage', node:'d'}` | V |
| COIL CURRENT | `{kind:'current', elementId:'L1'}` | A |
| PEAK V | `{kind:'behavior', key:'peak.vc'}` | V |
| RING FREQ | `{kind:'behavior', key:'ring.hz'}` | Hz |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Damping resistor | `R_D` | value | 0 | 470 | 1 | no | Ω |
| Capacitance | `C1` | value | 0.0000001 | 0.00001 | — | yes | F |
| Inductance | `L1` | value | 0.001 | 0.1 | — | yes | H |

R_D = 180 Ω makes R_total = 200 Ω, which is critical damping: the fastest rise with no overshoot.

## Failures

### F1: Take the damping resistor out
- **Patch:** `{op:'set', elementId:'R_D', key:'value', value:0}`
- **Sim shows:** V_C overshoots to ≈ 9.3 V and rings for many cycles.
- **Why:** R_total ≈ 10 Ω gives ζ ≈ 0.05. The peak is 5 × (1 + e^(−πζ/√(1−ζ²))) ≈ 9.3 V. Energy sloshes between L and C with almost nothing to absorb it.

### F2: Hot-plug 12 V into a 16 V ceramic filter
- **Patches:** `{op:'set', elementId:'R_D', key:'value', value:0}`, `{op:'set', elementId:'V_SUP', key:'value', value:12}`, `{op:'set', elementId:'C1', key:'rating.maxV', value:16}`
- **Sim shows:** V_C overshoots toward 22 V; C1 fails on overvoltage within the first half-cycle.
- **Why:** an underdamped LC input filter nearly doubles a step. A "12 V" rail with a 16 V capacitor is a classic hot-plug failure. Real designs add a damping element (e.g. an electrolytic with some ESR across the line) or a TVS diode.

### F3: The capacitor fails short
- **Patch:** `{op:'short', a:'d', b:'0'}`
- **Sim shows:** the circuit becomes a plain RL; COIL CURRENT settles at ≈ 250 mA, and both R_D (0.62 W) and L1 (over 100 mA) burn.
- **Why:** without C there is nothing to oppose DC: I = 5/20.1 = 249 mA.

## Meet the board

Put L and C together and energy swaps between the coil's current (½LI²) and the capacitor's voltage (½CV²). The swap has a natural rate:

**f₀ = 1 / (2π√(LC))** = 1 / (2π√(0.01 × 10⁻⁶)) = 1 / (2π × 10⁻⁴) = **1592 Hz**

The ratio of voltage to current in that swap is the **characteristic impedance**, Z₀ = √(L/C) = √(10⁴) = **100 Ω**. Compare the loop's resistance with Z₀:

- **ζ = R/(2Z₀)**, and **Q = Z₀/R = 1/(2ζ)**.
- On this board, R_total ≈ 10 (R_D) + 10 (DCR) + 0.1 ≈ 20 Ω, so ζ ≈ **0.10** and Q ≈ **5**.

**Step response.** If ζ < 1 the response rings, and the first peak overshoots by e^(−πζ/√(1−ζ²)) = e^(−0.316) = 0.73. V_C therefore peaks near 5 × 1.73 = **8.6 V**. That is more than the supply, from a passive circuit. If ζ = 1 (R = 2Z₀ = **200 Ω**) the response is critically damped: the fastest rise with no overshoot. If ζ > 1 it is overdamped and sluggish.

The ringing frequency is f₀√(1 − ζ²), which is nearly f₀ when damping is light. Count the peaks: with Q = 5, the ringing decays noticeably over about 5 cycles. Q is roughly the number of cycles it takes for the amplitude to fall to e^(−π) ≈ 4% of its start.

## For mechanical engineers

> This is your mass–spring–damper with different labels. L is the mass, C is the compliance (1/k) and R is the damper c. ωₙ = √(k/m) maps to 1/√(LC), and ζ = c/(2√(km)) maps to (R/2)√(C/L). A step in supply voltage is a step force, and V_C is the displacement. **Where it breaks:** real parts carry parasitics. An inductor's winding capacitance gives it a self-resonant frequency, and core losses add damping that rises with frequency. Electrical Q factors of hundreds are routine, far higher than most structures reach.

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

- **Time step:** f₀ = 1.59 kHz needs dt ≤ ~5 µs (≥ 120 steps per cycle). The bench's fixed 1 ms step can't resolve it. The engine needs a per-lesson `dt` (e.g. a `Lesson.dt` field), and the bench must run proportionally more steps per frame, or slow sim time down (a "slow-motion" factor).
- **Integration:** backward Euler adds artificial damping to LC circuits (even at 120 steps per cycle the amplitude visibly decays faster than Q = 5 implies). Use trapezoidal integration (with a damping fallback for stiff steps), at least for lessons containing both L and C.
- Behavior `peak-and-freq`: tracks the maximum of node `d` and estimates the ringing frequency from zero crossings of (V_C − final value). It publishes `peak.vc` and `ring.hz`.
