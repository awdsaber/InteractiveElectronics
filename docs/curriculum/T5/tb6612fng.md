# TB6612FNG Dual H-Bridge

*MOSFETs that barely warm*

> Four MOSFETs with about 0.5 Ω in the current path let a 3.3–5 V logic pin reverse, brake and PWM a 6 V gear motor at up to 1.2 A per channel.

- **Lesson id:** `tb6612fng` · **Track:** T5 Motors & drivers
- **fig:** 29 (video Fig. 05). Provisional: sidebar order.
- **Prerequisites:** T2 `transistor-switch`, T2 `mosfet-switch`, T3 `adc-dac-pwm`
- **Power element:** `usb_plug` (powerLabel: "Plug USB"). The motor battery is the tweak `bat_sw` (SIM NOTE).
- **Behaviors:** `tb6612`, `mcu-supply`, `serial-plotter`
- **transient:** true (MOTOR)

## Learning goals

1. Explain how an H-bridge reverses a DC motor using four switches, and why closing both switches on one side shorts the supply ("shoot-through").
2. Use the TB6612FNG truth table: CW, CCW, short brake, stop (coast) and standby.
3. Compute motor voltage, stall current and bridge dissipation from Ron, the winding resistance and the battery's internal resistance.
4. Keep logic power (VCC) and motor power (VM) separate, with a common ground.
5. Know the ratings: VM 2.5–13.5 V, VCC 2.7–5.5 V, 1.2 A average and 3.2 A peak per channel, PWM up to 100 kHz.

## Board

Board: `MOTOR BENCH A`, size 14 × 8, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | Logic and PWM source. | `pin4`, `pin5`, `pin7`, `pin8` |
| drv | `module` (title "TB6612FNG", 20 × 20 mm breakout) | `module` | DRIVER | Carrier board for the IC. | — |
| u1 | `ic-smd` (SSOP-24, TB6612FNG) | `smd` | TB6612FNG | Dual H-bridge. Each output stage is a pair of MOSFETs (with body diodes) plus logic, thermal shutdown and low-voltage lockout. | `ha`, `hb`, `ron_a`, `ron_b`, `en_a`, `en_b` |
| c_vm_board | `capacitor-smd` (10 µF, on carrier) | `smd` | VM CAP | Local decoupling on VM (the value varies by carrier). | — |
| c_vcc | `capacitor-smd` (100 nF) | `smd` | VCC CAP | Logic supply decoupling. | — |
| hdr | `header-male` (2 × 8) | `tht` | PINS | VM, VCC, GND, AO1/2, BO1/2, PWMA/B, AIN1/2, BIN1/2, STBY. | — |
| c_bulk | `capacitor-electrolytic` (100 µF 16 V) | `offboard` | BULK 100µF | Supplies the current pulses of PWM so the battery leads don't have to. | `c_vm` |
| bat | `battery-aa-pack` (4 × AA) | `offboard` | 6V PACK | Motor supply. About 0.6 Ω internal resistance for fresh alkalines (approximate). | `bat`, `bat_sw` |
| mot | `gear-motor-wheel` (6 V, 48:1) | `offboard` | GEAR MOTOR | "GM-48", the course's representative 6 V gear motor: 4 Ω winding, ~150 mA no-load, ~250 mA typical, 1.5 A stall at 6 V. | `m1` |
| wires | `wire` | `offboard` | — | | — |

## Circuit

The bridge is modelled as two **averaged half-bridges**. Each half is a voltage source equal to duty × VM, behind half of Ron, plus a switch that opens for high-Z (coast/standby). The `tb6612` behavior sets the source values and switches every tick from the pin states. The PWM ripple itself is not simulated (SIM NOTE).

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_usb` | V | `usb_vbus`, `0` | 5.0 V, rInternal 0.3 Ω | — | |
| `usb_plug` | SW | `usb_vbus`, `vbus_in` | closed: false | — | **Power element** |
| `f1` | R | `vbus_in`, `5v` | 0.3 Ω | maxI 1.0 A | |
| `i_board` | I | `5v`, `0` | 0.045 A | maxV 6 V | Uno |
| `i_vcc` | I | `5v`, `0` | 0.0011 A | — | TB6612 logic supply, about 1 mA (approximate) |
| `pin4` | PIN | `d4`, `0` | pin 4, vcc 5 | — | STBY |
| `pin5` | PIN | `d5`, `0` | pin 5, vcc 5 | — | PWMA (Timer0, ~980 Hz) |
| `pin7` | PIN | `d7`, `0` | pin 7, vcc 5 | — | AIN1 |
| `pin8` | PIN | `d8`, `0` | pin 8, vcc 5 | — | AIN2 |
| `r_in4`…`r_in8` | R | `dX`, `0` | 200 kΩ each | — | Input loading of the TB6612's logic inputs (approximate) |
| `bat` | V | `bat_p`, `bat_n` | 6.0 V, rInternal 0.6 Ω | — | |
| `bat_sw` | SW | `bat_p`, `vm` | closed: false | — | Battery switch (tweak) |
| `gnd_link` | R | `bat_n`, `0` | 0.01 Ω | — | **Common ground** wire |
| `c_vm` | C | `vm`, `0` | 100 µF | maxV 16 V | |
| `i_vm` | I | `vm`, `0` | set by behavior | maxV 15 V | Bridge draw from VM. 15 V is the VM absolute maximum. |
| `ha` | V | `ha_i`, `0` | set by behavior (0…VM) | — | Half-bridge A average output |
| `ron_a` | R | `ha_i`, `sa` | 0.25 Ω | maxI 3.2 A | Half of the 0.5 Ω (upper + lower, typ) |
| `en_a` | SW | `sa`, `ao1` | set by behavior | — | Open = high-Z |
| `hb` | V | `hb_i`, `0` | set by behavior | — | Half-bridge B |
| `ron_b` | R | `hb_i`, `sb` | 0.25 Ω | maxI 3.2 A | |
| `en_b` | SW | `sb`, `ao2` | set by behavior | — | |
| `db_a_hi` | D | `ao1`, `vm` | is 1e-9, n 1.8 | maxI 3 A | Body diode, upper A |
| `db_a_lo` | D | `0`, `ao1` | is 1e-9, n 1.8 | maxI 3 A | Body diode, lower A |
| `db_b_hi` | D | `ao2`, `vm` | is 1e-9, n 1.8 | maxI 3 A | |
| `db_b_lo` | D | `0`, `ao2` | is 1e-9, n 1.8 | maxI 3 A | |
| `m1` | MOTOR | `ao1`, `ao2` | r 4 Ω, l 0.5 mH, ke 0.0054, kt 0.0054, j 3e-7, b 8e-7, load 0 | maxI 2 A | GM-48 (representative values; measure your own) |

Expected values:
- At 100 % CW with no load, the motor sees about 6 − 0.15 × (0.6 + 0.5) ≈ 5.8 V and spins at about 9 200 rpm at the motor shaft, or **≈ 190 rpm** at the 48:1 output.
- Stall current = 6 / (4 + 0.5 + 0.6) ≈ **1.18 A**.

### Behaviors

- **`tb6612`** (reused by `encoders`, `pid-motor-control` and the capstone). Parameters: the pin numbers `{in1:7, in2:8, pwm:5, stby:4}`, `ronTotal` 0.5 Ω, `rthJA` 140 °C/W (derived from the datasheet's ~0.89 W dissipation rating on a PCB at 25 °C, approximate), `tsd` 175 °C (thermal shutdown, typical), and `gnd` = `bat_n`.
  - **Inputs.** Each tick it reads the inputs as **voltages** at `d4/d5/d7/d8` relative to the driver ground node `bat_n`, and compares them with VIH = 0.7 × VCC and VIL = 0.3 × VCC. If the ground is missing, i.e. `bat_n` is floating (|V(bat_n)| > 1 V or no DC path), the inputs are treated as undefined and the outputs chatter randomly. PWM duty comes from `pins[5].level`, gated by the voltage check.
  - **Truth table:**

    | IN1 | IN2 | PWM | STBY | mode | half A | half B |
    |---|---|---|---|---|---|---|
    | H | L | duty | H | CW | duty·VM | 0 |
    | L | H | duty | H | CCW | 0 | duty·VM |
    | H | H | x | H | short brake | 0 | 0 |
    | L | L | H | H | stop (high-Z) | open | open |
    | x | x | x | L | standby | open | open |

    During the PWM-low part of the cycle the datasheet specifies short brake, so the averaged source duty·VM is a fair model of drive/brake PWM.
  - **Supply current:** `i_vm` = duty × |I(m1)| + 1 mA.
  - **Thermal:** P = I(m1)² × 0.5 Ω, and T_j follows a first-order network (τ ≈ 5 s, approximate) toward 25 + P × rthJA. At T_j ≥ `tsd` it opens both halves until T_j < tsd − 20 °C.
  - **Undervoltage:** VM < 2.5 V or VCC < 2.7 V gives standby.
  - **Publishes:** `mode` (0 standby, 1 CW, 2 CCW, 3 brake, 4 coast), `duty`, `motor_A` (signed), `vm_V`, `tj`, `rpm_out` (= `m1.rpm` / 48) and `tsd_active`.
- **`mcu-supply`**, **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** Forward, brake, reverse, coast · **board:** `uno` · **vcc:** 5

| Pin | TB6612 pin | PIN element |
|---|---|---|
| 5 (PWM) | PWMA | `pin5` |
| 7 | AIN1 | `pin7` |
| 8 | AIN2 | `pin8` |
| 4 | STBY | `pin4` |

```cpp
#define PWMA 5
#define AIN1 7
#define AIN2 8
#define STBY 4

// speed: -255 (full CCW) .. +255 (full CW). 0 = short brake.
void motorA(int speed) {
  speed = constrain(speed, -255, 255);
  if (speed > 0) {
    digitalWrite(AIN1, HIGH);
    digitalWrite(AIN2, LOW);
    analogWrite(PWMA, speed);
  } else if (speed < 0) {
    digitalWrite(AIN1, LOW);
    digitalWrite(AIN2, HIGH);
    analogWrite(PWMA, -speed);
  } else {
    digitalWrite(AIN1, HIGH);     // both high = short brake
    digitalWrite(AIN2, HIGH);
    analogWrite(PWMA, 255);
  }
}

void coastA() {                    // both low + PWM high = outputs off (high-Z)
  digitalWrite(AIN1, LOW);
  digitalWrite(AIN2, LOW);
  analogWrite(PWMA, 255);
}

void ramp(int from, int to, int ms) {
  int steps = 50;
  for (int i = 0; i <= steps; i++) {
    motorA(from + (to - from) * i / steps);
    delay(ms / steps);
  }
}

void report(String phase) {
  Serial.print(phase);
  Serial.print(" t_ms:");
  Serial.println(millis());
}

void setup() {
  pinMode(PWMA, OUTPUT);
  pinMode(AIN1, OUTPUT);
  pinMode(AIN2, OUTPUT);
  pinMode(STBY, OUTPUT);
  Serial.begin(115200);
  digitalWrite(STBY, HIGH);        // wake the driver
  report("ready");
}

void loop() {
  report("ramp CW");
  ramp(0, 200, 2000);
  delay(1000);
  report("brake");
  motorA(0);                       // stops in a fraction of a second
  delay(700);
  report("ramp CCW");
  ramp(0, -200, 2000);
  delay(1000);
  report("coast");
  coastA();                        // spins down slowly on friction alone
  delay(1500);
}
```

## Readouts

| label | source | unit |
|---|---|---|
| MOTOR CURRENT | `{kind:'current', elementId:'m1'}` | A |
| MOTOR VOLTS | `{kind:'voltage', node:'ao1', ref:'ao2'}` | V |
| VM (BATTERY) | `{kind:'voltage', node:'vm', ref:'bat_n'}` | V |
| OUTPUT SPEED | `{kind:'behavior', key:'rpm_out'}` | rpm |
| DRIVER Tj | `{kind:'behavior', key:'tj'}` | °C |
| BRIDGE LOSS | `{kind:'power', elementId:'ron_a'}` | W |

`BRIDGE LOSS` shows half A only, so the total is about twice that (SIM NOTE: a summed readout).

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Battery switch | `bat_sw` | closed | 0 | 1 | 1 | no | — |
| Battery voltage | `bat` | value | 3 | 14 | 0.1 | no | V |
| Wheel load torque | `m1` | load | 0 | 0.008 | 0.0002 | no | N·m (motor shaft) |
| Battery internal R | `bat` | rInternal | 0.05 | 3 | — | yes | Ω |

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: the sketch cycles CW, brake, CCW and coast. |
| readout 0 above 1.2 | Above the 1.2 A average rating: the driver is heating. |
| readout 4 above 150 | Driver Tj above 150 °C: thermal shutdown is close. |

## Failures

### F1: Stall it on a fresh 2S Li-ion pack
- **Patches:** `{op:'set', elementId:'bat', key:'value', value:8.4}`, `{op:'set', elementId:'bat', key:'rInternal', value:0.1}`, `{op:'set', elementId:'m1', key:'load', value:0.05}`
- **Sim shows:** about 8.4 / (4 + 0.5 + 0.1) ≈ 1.8 A at full duty with the wheel locked. Driver loss ≈ 1.8² × 0.5 ≈ 1.6 W, so T_j heads for 25 + 1.6 × 140 ≈ 250 °C. Thermal shutdown trips within seconds, the motor stops and restarts, and the cycle repeats.
- **Why:** 1.8 A is above the 1.2 A average rating, though below the 3.2 A peak. The IC protects itself with thermal shutdown, but repeated cycling stresses it. Limit PWM when VM is above the motor's rating, add current sensing, or use a bigger driver.

### F2: VM from a 4S LiPo (16.8 V)
- **Patch:** `{op:'set', elementId:'bat', key:'value', value:16.8}`
- **Sim shows:** `i_vm` sees 16.8 V, above the 15 V absolute maximum, and fails at once (short). The driver is burnt.
- **Why:** the TB6612 is rated 13.5 V operating and 15 V absolute. A 3S pack (12.6 V fully charged) is the most it can take, and inductive spikes on long leads eat into that margin.

### F3: Forget the common ground
- **Patch:** `{op:'remove', elementId:'gnd_link'}`
- **Sim shows:** VM still reads 6 V across the battery, but the driver's inputs no longer have a reference. The motor twitches randomly or not at all.
- **Why:** a logic HIGH is "5 V **relative to the driver's GND**". Without a ground wire between the Uno and the battery negative, the signal has no return path. Every multi-supply system needs one common reference (T7 `power-grounding-emc`).

## Meet the board

An **H-bridge** is four switches with the motor across the middle. Close upper-left and lower-right and current flows one way. Close the other diagonal and the motor reverses. Close both lower switches and the motor's own back-EMF drives current through a short, which is **short brake**. Open all four and it coasts.

The TB6612FNG builds each switch from a MOSFET. Toshiba gives about **0.5 Ω** for the upper and lower switch together (typical). At 1 A that is 1 A × 0.5 Ω = 0.5 V lost and 1² × 0.5 = **0.5 W** of heat, which a small SSOP-24 can handle.

**Ratings:** VM 2.5–13.5 V (15 V absolute), VCC 2.7–5.5 V (3.3 V logic works), **1.2 A average** and 3.2 A peak per channel, PWM up to 100 kHz.

**Worked stall:** a 4 Ω motor on a 6 V AA pack (0.6 Ω) gives I = 6 / (4 + 0.5 + 0.6) = **1.18 A**, right at the rating. On an 8.4 V Li-ion pack it is 1.8 A, too much for a held stall.

**PWM:** `analogWrite(5, 128)` gives an average of 128/255 × 6 ≈ **3.0 V**. Pin 5 runs at about 980 Hz, which you can hear as a whine. The chip can PWM at 20 kHz+, above hearing, but the Uno's default `analogWrite` cannot.

Body diodes in each MOSFET catch the motor's inductive kick, so no external flyback diodes are needed. A 100 µF bulk capacitor on VM is still a must.

## For mechanical engineers

> An H-bridge is a 4-way, 3-position directional valve for a hydraulic motor. The diagonal pairs are the A→B and B→A spool positions. Short brake is the "motor ports connected" centre position, where the motor pumps against itself and stops fast. Coast is the "float" centre. PWM is a proportional valve dithering fast enough that the motor's inertia sees only the average flow. **Where it breaks:** a hydraulic spool can't connect P straight to T through both sides. An H-bridge can (shoot-through), so the driver IC's dead-time logic is what prevents it.

## Pro tips

1. Wire the bulk capacitor (100–470 µF, rated at least 1.5 × VM) close to the VM pin. Long battery leads are inductors, and without the capacitor the PWM current pulses turn into voltage spikes.
2. Brake versus coast is a design choice. Brake gives crisp stops for positioning, while coast is gentler on gearboxes and saves energy. Choose it on purpose rather than by accident from your pin states.
3. Raise the PWM frequency to 20 kHz on pins 9/10 (Timer1 registers or the TimerOne library) to remove the audible whine. Check the motor still starts at low duty, because higher frequency means more switching loss per second, and at very low duty the current never builds up.

## Quiz

1. **A 4 Ω motor, a 0.5 Ω bridge and a 6 V pack with 0.6 Ω internal resistance. What is the stall current?**
   - 0.6 A
   - 1.18 A
   - 1.5 A
   - 12 A
   - **Answer:** 1. *Why:* I = 6 / (4 + 0.5 + 0.6) ≈ 1.18 A.

2. **`analogWrite(PWMA, 128)` with VM = 6 V. What average voltage does the motor see (ignoring drops)?**
   - 0.6 V
   - 3.0 V
   - 4.8 V
   - 6 V
   - **Answer:** 1. *Why:* 128/255 × 6 ≈ 3.0 V.

3. **AIN1 = HIGH and AIN2 = HIGH. What does the TB6612 do?**
   - Spins CW
   - Coasts (outputs off)
   - Short brakes
   - Shoots through and burns
   - **Answer:** 2. *Why:* both inputs high turns both low-side switches on, shorting the motor terminals. Its back-EMF brakes it.

4. **How much heat does the TB6612 bridge make at 1 A (0.5 Ω path)?**
   - 0.05 W
   - 0.5 W
   - 1.85 W
   - 5 W
   - **Answer:** 1. *Why:* P = I²R = 1² × 0.5 = 0.5 W. Compare about 1.85 W for an L298N at the same current (next lesson).

## SIM NOTE

- `powerElementId` is a single element. This bench has two supplies (USB and battery). Proposal: `powerElementIds: string[]`, or keep the battery switch as a tweak, as done here.
- **PWM into switching stages:** the engine averages PWM as a pin voltage. For bridges this lesson uses behavior-driven averaged sources, which is accurate for the mean current but has no ripple. A scope view of the motor current ripple would need the behavior to compute it analytically: ΔI ≈ VM·D(1−D)/(L·f).
- Behaviors need to read node voltages relative to a chosen ground (`bat_n`), and to detect a floating node (no DC path), so that "no common ground" produces undefined inputs.
- A summed readout (`ron_a` + `ron_b` power), or let the behavior publish `bridge_W`.
- Gear ratio: `MOTOR` reports motor-shaft rpm. Output rpm comes from the behavior (÷48). A `gear` param on MOTOR would help the 3D wheel.
