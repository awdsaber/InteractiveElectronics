# Debugging Instruments

*Meter, scope, analyzer*

> A 10 MΩ meter on a 1 MΩ / 1 MΩ divider reads 4.8 % low, and a ×1 probe on an I²C clock doubles its rise time from 398 to 797 ns.

- **Lesson id:** `debugging-instruments` · **Track:** T7 Professional
- **Prerequisites:** T0 `multimeter`, T1 `ac-oscilloscope`, `serial-protocols`
- **Power element:** `plug` (powerLabel: "Plug in 9 V")
- **Behaviors:** `logic-analyzer`, `imu-mpu6050`, `mcu-supply`, `intermittent`, `probe-load`, `source-select` ×2, `ac-meter` ×5
- **transient:** true, `sim.dt` 0.1 ms (20 points per 490 Hz PWM period)

> Revised 2026-11-09 when the lesson was built. The first draft was an "instrument bench" (PWM into an RC filter, a 10 MΩ / 10 MΩ divider, a fused mA jack). The lesson brief asked for a broken gadget with hidden faults to *find*, so the board, circuit and failures below replace it. Its figures were checked: a DMM is 10 MΩ; a ×10 passive probe is 10 MΩ ‖ about 10–15 pF; on ×1 the scope's 1 MΩ ‖ ~15 pF input sees the cable too, about 1 MΩ ‖ 100 pF in total (the draft gave "1 MΩ ∥ about 15 pF" for the ×1 case, which leaves out the cable).

## Learning goals

1. Follow a method: rails with the meter, signals with the scope, the bus with the logic analyzer, then isolate by halves.
2. Account for what each instrument does to the circuit: meter loading (10 MΩ), burden voltage (1.8 mV/mA on a mA range), probe loading (×10 vs ×1).
3. Know what each instrument cannot show: a meter averages, an analyzer only knows HIGH or LOW against its threshold.
4. Never clip a mains-earthed scope's ground lead to a node that is not at earth potential (text only: the lesson never simulates mains).
5. Find four realistic faults: a sagging rail, swapped wires, a cold-joint intermittent, a missing pull-up.

## Board

Board: `TILT LAMP`, size 18 × 9.5, base `mat`. A tilt-controlled lamp: the Uno reads an MPU-6050 over I²C and sets a 1 W LED's brightness with PWM.

| id | PartKind | label | role | circuitIds |
|---|---|---|---|---|
| uno | `module` | UNO | Fed on its 5V pin from the gadget's regulator. I²C A4/A5, lamp PWM pin 9, heartbeat pin 10. | `r_board`, `pin9`, `pin10` |
| jack | `barrel-jack` | 9 V IN | 9 V adapter, 0.3 Ω. | `v_in` |
| reg | `regulator-to220` | LM7805 | 5 V for everything (≤ ≈ 0.4 A). | `reg` |
| reg_small | `transistor-to92` (hidden) | 78L05 | The fault: a 100 mA regulator. | `reg` |
| r_s1, r_s2 | `resistor` 1 MΩ ×2 | VIN SENSE | A high-impedance adapter monitor divider. | `r_s1`, `r_s2` |
| j1 | `header-male` 2-pin | J1 (I-LAMP) | Lamp current jumper; the ammeter replaces it. | `j1` |
| r_lamp, lamp | `resistor` 5.6 Ω 1 W, `led` white | LAMP | 1 W white LED, ≈ 0.30 A while on. | `r_lamp`, `lamp` |
| q1 | `mosfet-to220` | IRLZ44N | Low-side switch, 100 kΩ gate pull-down. | `q1`, `r_pd` |
| r_beat, beat | `resistor` 1 kΩ, `led` red | HEARTBEAT | 1 Hz from pin 10. | `r_beat`, `led_beat` |
| gy521 | `module` | MPU-6050 | Breakout with a 3.3 V LDO and no pull-ups. | `j_vcc`, `ldo`, `r_mpu` |
| r_sda, r_scl | `resistor` 4.7 kΩ | PULL-UPS | To the sensor's 3.3 V. | `r_sda`, `r_scl` |
| probe_scl | `probe` | PROBE ON SCL | ×10 / ×1 probe loading. | `r_probe`, `c_probe` |
| probe_gate | `probe` | CH1 | Scope CH1 on the gate. | — |
| dmm | `multimeter` | DMM | DC volts, 10 MΩ, 0.5 s average. | `r_dmm` |
| ammeter | `multimeter` | AMMETER | A second meter on mA, 1.8 Ω burden. | `r_amm` |
| la | `module` | ANALYZER | 8-channel logic analyzer. | — |

## Circuit (key elements)

| id | type | nodes | value | notes |
|---|---|---|---|---|
| `v_in` | V | vin_raw, 0 | 9 V, rInternal 0.3 Ω | |
| `plug` | SW | vin_raw, vin | closed | power element |
| `reg` | REG | vin, 0, 5v | 5 V, dropout 2 V, iLimit 1.5 A, iq 5 mA | 78L05 fault: iLimit 0.14 A, dropout 1.7 V, iq 3 mA |
| `r_board` | R | 5v, 0 | 111 Ω | Uno ≈ 45 mA |
| `j1` / `amm_in` + `r_amm` | SW / SW + R | 5v → lamp_a | jumper, or 1.8 Ω ammeter | `source-select` 'lamp-path' |
| `r_lamp`, `lamp` | R, D | lamp_a → lamp_k | 5.6 Ω; is 1.1e-15, n 3.6, rs 0.6 Ω | 3.0 V at 100 mA, 3.3 V at 350 mA (a D: the LED element is a 5 mm part with 5 Ω inside) |
| `q1` | NMOS | lamp_k, gate, 0 | vth 1.5 V, k 11.4 | IRLZ44N, as in T2 mosfet-switch |
| `w_lamp`, `w_beat` | R 0.05 Ω | d9→gate, d10→beat | wires | swapped by the fault |
| `j_vcc` | R | 5v, gy_vin | 0.01 Ω | the sensor's VCC joint (`intermittent`: 1.2 kΩ in bad spells) |
| `ldo` | REG | gy_vin, 0, 3v3 | 3.3 V, dropout 0.25 V | |
| `r_mpu` | R | 3v3, 0 | 846 Ω | MPU-6050 ≈ 3.9 mA |
| `r_sda`, `r_scl` | R | 3v3 → sda / scl | 4.7 kΩ | |
| `c_sda`, `c_scl` | C | sda / scl → 0 | 100 pF | bus capacitance |
| `r_probe`, `c_probe` | R, C | scl → 0 | 10 MΩ ‖ 12 pF (×10), 1 MΩ ‖ 100 pF (×1) | `probe-load`; the analyzer adds `c_probe` to the SCL rise |
| `m_5v`…`m_vs`, `r_dmm` | SW, R | node → dmm → 0 | 10 MΩ | `source-select` 'leads' |

## Readouts

DMM (`dmm.dc`, V) · AMMETER (`amm.dc`, A) · GATE FREQ (`gate.freq`) · PIN 9 FREQ (`pin9.freq`) · I²C RISE (SCL) (`logic-analyzer.i2c_tr`) · I²C NACKS · SENSOR VCC (node 3v3) · LAMP CURRENT (TRUE) (`lamp.dc`).

## Tweaks

DMM leads (5 V rail / Sensor 3V3 / SDA / VIN SENSE / Off) · Lamp current path (Jumper J1 / Ammeter) · Scope probe on SCL (Lifted / ×10 / ×1) · Analyzer threshold (1.5 V / 2.5 V) · Gadget tilt (−80…80°).

## Failures (hidden faults)

| id | patch | signature |
|---|---|---|
| `small-reg` | reg iLimit 0.14 A, dropout 1.7 V | DMM on the rail ≈ 4.3 V (an average); scope CH2: 5.0 V ↔ ≈ 3.7 V at 490 Hz; fully tilted the rail sits at 3.7 V, below the 3.78 V a 16 MHz ATmega328P needs |
| `swapped-wires` | pin 9 ↔ pin 10 wires | PIN 9 FREQ 490 Hz at the header, GATE FREQ ≈ 1 Hz: the fault is between them |
| `cold-joint` | `intermittent` active | SENSOR VCC drops to ≈ 2.0 V in random spells (MPU-6050 minimum 2.375 V): NACK bursts; a 1.5 V analyzer lane stays HIGH, a 2.5 V one shows each dropout |
| `no-pullup` | remove r_sda | SDA stuck at ≈ 0 V on the meter and the analyzer, no START, every read NACKs, "sensor lost" |

## Key numbers (as built)

- Healthy: rail 5.00 V; gate 490 Hz; SCL t_r = 0.8473 × 4.7 kΩ × (100 + 12) pF = 446 ns with the ×10 probe (398 ns lifted, 797 ns on ×1); no NACKs; lamp 0.30 A on, 0.17 A average at the default tilt (duty 141/255).
- Meter loading: VIN SENSE 4.46 V unloaded, 4.25 V with the DMM (ratio 0.952 = (0.909/1.909)/0.5).
- Burden: with the 1.8 Ω ammeter in the loop the lamp current falls about 21 % (0.169 → 0.133 A average).

## Meet the board, analogy, tips, quiz

See the lesson file (`src/lessons/T7/debugging-instruments.ts`). The mains ground-clip trap is text and a quiz question only.

## SIM NOTE

- The bench scope samples the netlist every 0.1 ms. It shows the PWM and the rail, but not an I²C edge: the probe-loading step reads the edge on the analyzer, which draws it from the live R and C (`i2c_tr`), and the I²C RISE readout.
- The analyzer's node lanes are thresholded once per frame, so they only show slow levels (the cold-joint dropouts last 30 ms or more).
- The cold joint is a single bad resistance (1.2 kΩ), not the full erratic range of a real one.
- Not modelled: probe bandwidth (×1 is a few MHz), ground-lead ringing, the mA jack's fuse.
