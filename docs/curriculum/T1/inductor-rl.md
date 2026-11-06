# Inductors and RL Time

*Current has inertia*

> A 1 H choke in a 100 Ω loop takes τ = 10 ms to reach 63% of its 50 mA, and when you cut the current it fights back.

- **Lesson id:** `inductor-rl` · **Track:** T1 Passives
- **Prerequisites:** `capacitor-rc`
- **Power element:** `SW1` (powerLabel: "Close the switch")
- **Transient:** yes

## Learning goals

1. Use v = L·di/dt to explain why inductor current can't change instantly.
2. Predict RL current rise and decay with τ = L/R.
3. Calculate stored energy, ½LI², and estimate the voltage spike when current is interrupted.
4. Fit and orient a flyback (freewheel) diode correctly.

## Board

Board: `RL-11`, size 12 × 8, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| pwr | `module` (title "5 V SUPPLY") | `offboard` | SUPPLY | 5 V source. | `V_SUP` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the parts. | — |
| sw1 | `switch-slide` (miniature, 0.5 A / 50 V DC class) | `tht` | SWITCH | Makes and breaks the coil current. | `SW1` |
| l1 | `inductor` (1 H iron-core choke, ≈ 18 Ω DCR) | `offboard` | CHOKE | Stores energy in its magnetic field. | `L1`, `R_DCR` |
| r1 | `resistor` (82 Ω, 1/2 W) | `tht` | LIMIT | Sets the final current with the winding resistance. | `R1` |
| d1 | `diode` (1N4007) | `tht` | FLYBACK | Gives the coil current somewhere to go when the switch opens. | `D1` |
| tp | `testpoint` | `tht` | PROBE | Scope point on the switch side of the coil. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_SUP` | V | `sup`, `0` | 5.0 V, rInternal 0.05 Ω | — | |
| `SW1` | SW | `sup`, `a` | closed: false | maxV 50 V, maxI 0.5 A | **power element** |
| `L1` | L | `a`, `b` | 1.0 H, i0 0 | maxI 0.1 A | generic choke; rating stands in for its thermal/saturation limit |
| `R_DCR` | R | `b`, `c` | 18 Ω | — | the choke's winding resistance (`partId: l1`) |
| `R1` | R | `c`, `0` | 82 Ω | maxP 0.5 W | |
| `D1` | D | `0`, `a` | 1N4007 (default Is/n) | maxI 1 A, maxV 1000 V | anode at ground, cathode at the coil's top |

Expected: I_final = 5/100.1 ≈ 50 mA; τ = 10 ms; P(R1) = 0.205 W; switch sees ≈ 5.7 V at turn-off with D1 fitted.

## Readouts

| label | source | unit |
|---|---|---|
| COIL CURRENT | `{kind:'current', elementId:'L1'}` | A |
| COIL TOP | `{kind:'voltage', node:'a'}` | V |
| ACROSS SWITCH | `{kind:'voltage', node:'sup', ref:'a'}` | V |
| R1 POWER | `{kind:'power', elementId:'R1'}` | W |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Inductance | `L1` | value | 0.1 | 2 | 0.1 | no | H |
| Series resistor | `R1` | value | 22 | 470 | — | yes | Ω |

## Failures

### F1: Remove the flyback diode, then open the switch
- **Patch:** `{op:'remove', elementId:'D1'}`
- **Sim shows:** at turn-off, ACROSS SWITCH spikes far past 50 V; SW1 fails on overvoltage.
- **Why:** the coil insists on keeping its 50 mA flowing, and the only path is the opening switch. v = L·di/dt becomes enormous. In reality the gap arcs (pitting the contacts), or a transistor switch avalanches and dies.

### F2: Fit the flyback diode backwards
- **Patches:** `{op:'remove', elementId:'D1'}`, `{op:'add', element:{id:'D1', type:'D', nodes:['a','0'], rating:{maxI:1, maxV:1000}}}`
- **Sim shows:** when the switch closes, amps flow through D1 straight across the supply; D1 burns after 300 ms.
- **Why:** reversed, the diode is forward-biased directly across 5 V, so it is a short circuit with a 0.7 V drop.

### F3: Too little series resistance
- **Patch:** `{op:'set', elementId:'R1', key:'value', value:22}`
- **Sim shows:** COIL CURRENT settles near 125 mA, over the choke's 100 mA rating; L1 is marked burnt.
- **Why:** I = 5/(18 + 22) = 125 mA. A real choke would overheat or saturate. Saturation means its inductance collapses and the current rises even faster.

## Meet the board

An inductor resists *changes* in current: **v = L · di/dt**. Apply a voltage and the current ramps. Try to stop the current and the inductor generates whatever voltage it takes to keep it flowing.

**Current rise.** With R_total = 18 + 82 = 100 Ω:

i(t) = (V/R)·(1 − e^(−t/τ)),  τ = L/R = 1 H / 100 Ω = **10 ms**

The current heads for 5/100 = **50 mA**. At t = 0 it rises at di/dt = V/L = 5 A/s, about 5 mA in the first millisecond.

**Energy.** E = ½LI² = ½ × 1 × 0.05² = **1.25 mJ**, the same energy the 100 µF capacitor held at 5 V in the previous lesson.

**Interrupting it.** Suppose a switch broke the 50 mA in 1 µs. Then v = L·Δi/Δt = 1 × 0.05 / 10⁻⁶ = **50 000 V** in principle. In practice the voltage only rises until something breaks down, and that something is usually your switch.

**Flyback diode.** D1 sits reverse-biased while the switch is closed. When it opens, the coil current turns through D1 and decays with τ ≈ 10 ms, so the coil's top only swings to about −0.7 V. The switch sees just 5.7 V. Its cathode must face the supply's positive side.

## For mechanical engineers

> Inductance is mass. Current is velocity, voltage is force: v = L·di/dt mirrors F = m·dv/dt. Stopping a moving mass instantly needs infinite force, just as a fast-closing valve causes water hammer. The flyback diode is a bypass check valve that lets the moving column coast around a loop and slow down gently. **Where it breaks:** an iron-core inductor saturates. Above a certain current its "mass" suddenly falls, which a real mass never does. Its energy also lives in a magnetic field, not in moving matter.

## Pro tips

1. Every relay coil, solenoid, contactor and brushed motor gets a flyback diode, fitted right at the load: 1N4148 for small signal relays, 1N4007 or a Schottky (1N5819) for bigger coils.
2. A plain diode makes relays and solenoids release slowly, because the current decays gently. A zener in series with the diode clamps higher and speeds release, at the cost of a bigger spike.
3. Inductor datasheets give two currents: saturation (I_sat) and thermal (I_rms). Design to the lower of the two at your hottest operating temperature.

## Quiz

1. **What is the time constant of 10 mH in series with 50 Ω?**
   - 0.2 ms
   - 2 ms
   - 5 ms
   - 500 ms
   - **Answer:** 0. *Why:* τ = L/R = 0.01/50 = 0.2 ms.

2. **This board's loop heads for 50 mA. What is the current after 3τ?**
   - 31.6 mA
   - 43.2 mA
   - 47.5 mA
   - 50.0 mA
   - **Answer:** 2. *Why:* 1 − e⁻³ = 0.95, so 0.95 × 50 = 47.5 mA.

3. **The current in a 2 H coil drops by 0.1 A in 1 ms. What is the induced voltage?**
   - 0.2 V
   - 20 V
   - 200 V
   - 2000 V
   - **Answer:** 2. *Why:* v = L·di/dt = 2 × 0.1/0.001 = 200 V.

4. **What does the flyback diode do?**
   - Speeds up the current rise
   - Gives the coil current a path when the switch opens, clamping the spike
   - Protects against reversed supply polarity
   - Raises the coil's inductance
   - **Answer:** 1. *Why:* it lets the stored current freewheel and decay, so the voltage stays one diode drop beyond the rail.

## SIM NOTE

- `SW` open is 1e9 Ω, so F1 would compute a spike of tens of megavolts. The engine needs a breakdown or arc clamp on `SW` (and avalanche on transistors), e.g. a `vBreak` parameter (a few hundred volts for a small switch) above which the switch conducts. Then the readout stays physically plausible while still tripping `maxV`.
- At the bench's 1 ms step, τ = 10 ms gets only 10 samples, so the spike in F1 is one step wide. A per-lesson `dt` override (e.g. 50 µs here) would make the turn-off edge visible.
- Saturating inductor model (L falling above `iSat`) for F3.
