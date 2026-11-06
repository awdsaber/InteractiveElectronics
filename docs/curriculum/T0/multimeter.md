# The Multimeter

*Measuring without meddling*

> A 10 MΩ meter across the bottom of a 1 MΩ / 1 MΩ divider on 10 V reads 4.76 V, where the true value is 5.00 V.

- **Lesson id:** `multimeter` · **Track:** T0 Foundations
- **Prerequisites:** `series-parallel`, `batteries`
- **Power element:** `SW_OUT` (powerLabel: "Output ON")

## Learning goals

1. Connect a voltmeter in parallel and an ammeter in series, and say why each must be that way.
2. Quantify voltmeter loading from the meter's input resistance and the circuit's Thévenin resistance.
3. Quantify ammeter burden voltage from the meter's mV/mA figure.
4. Recognise the classic mistake of leaving the lead in the current jack, and know what the meter's fuses are for.

## Board

Board: `DMM-07`, size 14 × 9, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| psu | `module` (title "BENCH PSU") | `offboard` | SUPPLY | 10 V source. | `V_PSU`, `SW_OUT` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds both test circuits. | — |
| r1 | `resistor` (1 MΩ, 1/4 W) | `tht` | TOP | Upper divider leg. | `R1` |
| r2 | `resistor` (1 MΩ, 1/4 W) | `tht` | BOTTOM | Lower divider leg; we measure across it. | `R2` |
| dmm | `multimeter` | `offboard` | METER | Handheld DMM: 10 MΩ on the V ranges; 1.8 mV/mA burden on the mA range. | `R_VM`, `R_SH`, `R_FUSE` |
| leads | `probe` | `offboard` | PROBES | Test leads to the divider midpoint. | `SW_VM` |
| r3 | `resistor` (47 Ω, 5 W wirewound) | `tht` | LOAD | Current-measurement test load. | `R3` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_PSU` | V | `psu+`, `0` | 10.0 V, rInternal 0.01 Ω | — | |
| `SW_OUT` | SW | `psu+`, `v` | closed: false | — | **power element** |
| `R1` | R | `v`, `mid` | 1 MΩ | maxP 0.25 W | |
| `R2` | R | `mid`, `0` | 1 MΩ | maxP 0.25 W | |
| `SW_VM` | SW | `mid`, `vm` | closed: true | — | leads touching the midpoint |
| `R_VM` | R | `vm`, `0` | 10 MΩ | — | meter input resistance on DC V |
| `R_SH` | R | `v`, `sh` | 1.7 Ω | — | mA-range shunt plus leads |
| `R_FUSE` | R | `sh`, `f` | 0.1 Ω | maxI 0.44 A, failMode open | mA-jack fuse (handheld meters typically fit 400–500 mA fuses) |
| `R3` | R | `f`, `0` | 47 Ω | maxP 5 W | |

Expected: mid = 4.76 V with the meter attached (5.00 V without); ammeter reads 204.9 mA (212.8 mA would flow with no meter).

## Readouts

| label | source | unit |
|---|---|---|
| METER READS | `{kind:'voltage', node:'mid'}` | V |
| AMMETER | `{kind:'current', elementId:'R_SH'}` | A |
| BURDEN | `{kind:'voltage', node:'v', ref:'f'}` | V |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Meter input resistance | `R_VM` | value | 10000 | 10000000 | — | yes | Ω |
| Leads on midpoint | `SW_VM` | closed | 0 | 1 | 1 | no | — |
| Divider resistors (R1) | `R1` | value | 1000 | 1000000 | — | yes | Ω |

Lift the leads (closed = 0) and the midpoint jumps back to 5.00 V. Drop R1 to 1 kΩ (and imagine R2 likewise) and the loading error almost vanishes.

## Failures

### F1: Use an old analog meter (20 kΩ/V on the 10 V range)
- **Patch:** `{op:'set', elementId:'R_VM', key:'value', value:200000}`
- **Sim shows:** METER READS ≈ 1.43 V instead of 5 V.
- **Why:** 1 MΩ ∥ 200 kΩ = 167 kΩ, so V = 10 × 167k/(1M + 167k) = 1.43 V. The meter has become part of the circuit.

### F2: Measure volts with the red lead still in the mA jack
- **Patches:** `{op:'add', element:{id:'R_SH2', type:'R', nodes:['v','x'], value:1.7}}`, `{op:'add', element:{id:'R_FUSE2', type:'R', nodes:['x','0'], value:0.1, rating:{maxI:0.44, failMode:'open'}}}`
- **Sim shows:** about 5.4 A through the meter; R_FUSE2 blows (open) and everything returns to normal.
- **Why:** in mA mode the meter is a 1.8 Ω shunt. Put across a 10 V supply, it is nearly a short. The fuse is there for exactly this mistake. On high-energy circuits, only a correctly rated high-breaking-capacity fuse keeps it from becoming an explosion.

### F3: The bottom resistor falls out while you measure
- **Patch:** `{op:'remove', elementId:'R2'}`
- **Sim shows:** METER READS ≈ 9.09 V.
- **Why:** the meter's 10 MΩ is now the only lower leg: 10 × 10M/11M = 9.09 V. A high-impedance meter shows a plausible voltage on a node that is really disconnected.

## Meet the board

A **voltmeter** goes in *parallel*, so it should draw almost no current: high resistance. An **ammeter** goes in *series*, so it should drop almost no voltage: low resistance. Neither is perfect, and the error depends on the circuit.

**Voltmeter loading.** Seen from the midpoint, the divider is a 5 V source behind R1 ∥ R2 = 500 kΩ (its Thévenin equivalent). The meter's 10 MΩ forms a second divider with that:

V_read = 5 × 10M / (10M + 0.5M) = **4.76 V**, an error of −4.8%.

Rule of thumb: the meter must be at least 100× the source resistance for a 1% error. A 10 MΩ meter is excellent on a 10 kΩ divider and poor on a 1 MΩ one.

**Ammeter burden.** A meter specified at 1.8 mV/mA adds 1.8 Ω. With a 47 Ω load:

I = 10 / (47 + 1.8) = **204.9 mA** instead of 212.8 mA (−3.7%), and the meter drops 0.37 V.

Low-resistance loads suffer most. Use the 10 A range (lower burden) or measure the voltage across a known shunt resistor instead.

## For mechanical engineers

> A voltmeter is a pressure gauge with a tiny bleed: it taps off a trickle of flow to read pressure, which is fine on a stiff pump but noticeable on a weak, restricted source. An ammeter is an in-line flowmeter that adds its own pressure drop. **Where it breaks:** a mechanical gauge disturbs the system through added volume and friction. A meter disturbs it only through its resistance (and, at AC, its capacitance and bandwidth limit). That makes the error exactly calculable, as in this lesson.

## Pro tips

1. After every current measurement, move the red lead back to the V/Ω jack. Make it a reflex, because F2 is the most common way meters die.
2. Check the meter's CAT rating (CAT II/III/IV) and fuse type before going near mains. Cheap meters often have undersized glass fuses that can't safely break a fault.
3. To measure a current without breaking the circuit, read the voltage across a known low-value series resistor (or use a clamp meter for larger currents).

## Quiz

1. **A 100 kΩ / 100 kΩ divider on 10 V is measured with a 10 MΩ meter. What does it read?**
   - 4.50 V
   - 4.98 V
   - 5.00 V
   - 4.76 V
   - **Answer:** 1. *Why:* the Thévenin resistance is 50 kΩ, so V = 5 × 10M/10.05M ≈ 4.975 V. The error is only 0.5%.

2. **A meter's mA range has a burden of 1.8 mV/mA. What voltage does it drop at 50 mA?**
   - 1.8 mV
   - 36 mV
   - 90 mV
   - 0.9 V
   - **Answer:** 2. *Why:* 1.8 mV/mA × 50 mA = 90 mV.

3. **To measure the current through a resistor, the ammeter goes…**
   - across the resistor
   - in series with the resistor
   - across the supply
   - between the circuit and earth
   - **Answer:** 1. *Why:* the current must flow through the meter, so the loop is broken and the meter inserted in series.

4. **Why do multimeters have a fuse in the mA jack?**
   - To measure AC
   - To protect the meter when it is accidentally connected across a voltage in current mode
   - To limit the voltmeter's input current
   - To calibrate the shunt
   - **Answer:** 1. *Why:* in current mode the meter is nearly a short, and the fuse opens before the shunt or the user is harmed.

## SIM NOTE

- None required. Fuses are modelled as low-value `R` elements with `maxI` and `failMode:'open'`. A dedicated fuse element with an I²t curve would make blow times realistic (milliseconds rather than the fixed 300 ms).
