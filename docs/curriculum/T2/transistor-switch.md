# The Transistor Switch

*Small current commands big*

> Pin 9 sources under 9 mA, yet through a PN2222A it switches a 6 V hobby motor drawing around 180 mA.

- **Lesson id:** `transistor-switch` · **Track:** T2 Semiconductors · **Video:** Fig. 03
- **Prerequisites:** `led-resistor`, `inductor-rl`
- **Power element:** `V_USB` (powerLabel: "Plug USB")
- **Sketch:** yes
- **Transient:** yes (motor)

## Learning goals

1. Explain the NPN transistor's three regions: cutoff, active (I_c = β·I_b) and saturation.
2. Size a base resistor for hard saturation using a forced β of about 10–30.
3. Wire a low-side switch with a separate motor supply and a shared ground.
4. Protect the transistor with a flyback diode, and check I_c, V_CE and power against the datasheet.

## Board

Board: `NPN-18`, size 18 × 11, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (title "UNO") | `module` | UNO | Pin 9 gives the command. | `PIN9` |
| usb | `usb-b` | `tht` | USB | Powers the Uno. | `V_USB` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the driver. | — |
| rb | `resistor` (470 Ω, 1/4 W) | `tht` | BASE | Limits the base current to ≈ 8.6 mA. | `R_B` |
| q1 | `transistor-to92` (PN2222A, TO-92) | `tht` | SWITCH | Low-side switch; collector to motor, emitter to ground. | `Q1` |
| d1 | `diode` (1N4007) | `tht` | FLYBACK | Clamps the motor's inductive kick at turn-off. | `D1` |
| m1 | `dc-motor` (small 130-size, 3–6 V) | `offboard` | MOTOR | The load. | `M1` |
| pack | `battery-aa-pack` (4 × AA) | `offboard` | PACK | Separate 6 V motor supply. | `V_PACK` |
| wg | `wire` (black) | `offboard` | GROUND | Joins the pack's − to Uno GND. | `W_GND` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_USB` | V | `usb5v`, `0` | 5.0 V, rInternal 0.1 Ω | — | **power element** |
| `PIN9` | PIN | `p9`, `0` | pin 9, vcc 5, rOut 25 Ω | maxI 0.04 A | |
| `R_B` | R | `p9`, `b` | 470 Ω | maxP 0.25 W | |
| `Q1` | NPN | `c`, `b`, `0` | beta 150 | maxI 0.6 A, maxP 0.625 W, maxV 40 V, failMode short | PN2222A: V_CEO 40 V, I_C 600 mA, 625 mW (TO-92) |
| `V_PACK` | V | `pk`, `bgnd` | 6.0 V, rInternal 0.6 Ω | — | 4 × AA |
| `W_GND` | R | `bgnd`, `0` | 0.01 Ω | — | common-ground jumper |
| `M1` | MOTOR | `pk`, `c` | r 4 Ω, l 1 mH, ke 0.005 V·s/rad, kt 0.005 N·m/A, j 1e-6 kg·m², b 9e-7 N·m·s, load 0 | — | illustrative small brushed motor |
| `D1` | D | `c`, `pk` | 1N4007 | maxI 1 A, maxV 1000 V | anode at collector, cathode at +6 V |

Expected (pin HIGH): I_b ≈ (5 − 0.75)/495 ≈ 8.6 mA; motor ≈ 0.18 A at ≈ 9 500 rpm; V_CE(sat) ≈ 0.1–0.2 V; P_Q1 ≈ 30 mW. Stall current would be ≈ 6/4.6 ≈ 1.3 A.

## Sketch

```cpp
// Switch a motor with an NPN low-side driver on pin 9
const int MOTOR_PIN = 9;

void setup() {
  pinMode(MOTOR_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(MOTOR_PIN, HIGH);
  Serial.println("motor ON");
  delay(2000);
  digitalWrite(MOTOR_PIN, LOW);
  Serial.println("motor OFF");
  delay(2000);
}
```

`pins: {9: 'PIN9'}`, `vcc: 5`, `board: 'uno'`.

## Readouts

| label | source | unit |
|---|---|---|
| MOTOR CURRENT | `{kind:'current', elementId:'M1'}` | A |
| BASE CURRENT | `{kind:'extra', key:'Q1.ib'}` | A |
| V CE | `{kind:'extra', key:'Q1.vce'}` | V |
| SPEED | `{kind:'extra', key:'M1.rpm'}` | rpm |
| Q1 POWER | `{kind:'power', elementId:'Q1'}` | W |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Base resistor | `R_B` | value | 100 | 47000 | — | yes | Ω |
| Motor load torque | `M1` | load | 0 | 0.004 | 0.0001 | no | N·m |

Raise R_B to 47 kΩ: I_b falls to ≈ 90 µA, so β·I_b ≈ 14 mA. The transistor drops out of saturation, V_CE climbs, the motor crawls and Q1 heats. Load the shaft and watch the motor current rise.

## Status lines

- `{when:{kind:'pin', pin:9, level:1}, text:'RUNNING: pin 9 HIGH, the transistor saturates and the motor spins'}`
- `{when:{kind:'above', readout:2, value:1}, text:'WARNING: V_CE above 1 V, the transistor is not saturated and is heating'}`

## Failures

### F1: Remove the flyback diode
- **Patch:** `{op:'remove', elementId:'D1'}`
- **Sim shows:** at the first turn-off, the collector spikes far above 40 V; Q1 fails *short* and the motor runs continuously. The sketch can no longer stop it.
- **Why:** the motor's winding inductance keeps current flowing when Q1 turns off, and with no diode the only "path" is through Q1 breaking down. Transistors usually fail shorted, so the load is stuck ON, which is the unsafe direction.

### F2: Skip the base resistor
- **Patch:** `{op:'short', a:'p9', b:'b'}`
- **Sim shows:** pin current ≈ 170 mA; pin 9 is marked dead after 300 ms.
- **Why:** the base-emitter junction is a diode (≈ 0.8 V), so only the pin's 25 Ω limits the current: (5 − 0.8)/25 ≈ 170 mA, four times the absolute maximum.

### F3: Stall the motor
- **Patch:** `{op:'set', elementId:'M1', key:'load', value:0.01}`
- **Sim shows:** speed falls to 0, motor current heads past 1 A; Q1 exceeds 600 mA (and its power rating as V_CE rises), then burns short.
- **Why:** a stalled motor has no back-EMF, so only its 4 Ω winding (plus 0.6 Ω battery) limits the current: ≈ 1.3 A. Size the switch for stall current, not running current.

### F4: Forget the common ground
- **Patch:** `{op:'remove', elementId:'W_GND'}`
- **Sim shows:** pin HIGH and base current flowing, but motor current 0.
- **Why:** the motor's current must return to the pack's negative terminal through Q1's emitter. Without the shared ground there's no loop, which is the most common bench mistake with two supplies.

## Meet the board

An NPN bipolar transistor lets a small **base** current control a much larger **collector** current. In the active region, I_c = β·I_b with β ≈ 100–300. As a *switch* we drive it past that, into **saturation**, where V_CE falls to ≈ 0.1–0.3 V and the transistor behaves like a closed contact.

**Base drive.** I_b = (5 − 0.75)/(470 + 25) ≈ **8.6 mA**, well inside the pin's 20 mA comfort zone.

**Is it saturated?** The motor draws ≈ 0.18 A. Forced β = I_c/I_b = 0.18/0.0086 ≈ **21**, far below the part's minimum β (≈ 100 at 150 mA), so it is driven hard into saturation even with a weak sample. Designers aim for a forced β of 10–30.

**Dissipation.** P ≈ V_CE(sat) × I_c ≈ 0.2 × 0.18 ≈ **36 mW**, against 625 mW available. The danger is the half-on state (F3, or a big R_B): at V_CE = 3 V and 0.18 A, P = 0.54 W.

**Separate supplies.** The motor runs from its own 6 V pack. The only connection the two circuits need is the **ground**, which closes both loops through the emitter.

**Flyback.** D1 points its cathode at +6 V, so when Q1 turns off, the winding's current circulates through D1 instead of spiking the collector.

## For mechanical engineers

> A transistor switch works like a pilot-operated hydraulic valve: a small pilot flow (base current) opens a main spool that passes a far larger flow (collector current). Fully open, it drops little pressure (saturation). Half open, it throttles and gets hot. The flyback diode is the relief path for the motor's "inertia", its inductance. **Where it breaks:** a BJT's pilot needs about 0.7 V just to begin, and its gain β varies two- or threefold between parts and with temperature. Design for the worst sample, not the typical one.

## Pro tips

1. Above roughly 0.5 A, or wherever base current is precious, switch to a logic-level MOSFET (next lesson). A BJT needs a continuous base current, but a MOSFET's gate draws current only while switching.
2. Add a 10 kΩ resistor from base to emitter. During reset and boot the MCU's pins are high-impedance inputs, and the pull-down keeps the motor off.
3. Fit the flyback diode at the motor terminals with short leads. For PWM speed control, use a fast Schottky (1N5819) rather than a slow 1N4007.

## Quiz

1. **A 300 mA load must be driven with a forced β of 15. What base current is needed?**
   - 2 mA
   - 4.5 mA
   - 20 mA
   - 45 mA
   - **Answer:** 2. *Why:* I_b = 300/15 = 20 mA, which is at the pin's recommended limit, so a MOSFET is a better choice.

2. **What base resistor gives about 10 mA from a 5 V pin (V_BE ≈ 0.7 V, ignore pin resistance)?**
   - 43 Ω
   - 430 Ω
   - 4.3 kΩ
   - 50 Ω
   - **Answer:** 1. *Why:* R = (5 − 0.7)/0.010 = 430 Ω (470 Ω is the common choice).

3. **Q1 carries 0.2 A with V_CE = 0.25 V. What is its dissipation?**
   - 5 mW
   - 50 mW
   - 0.5 W
   - 1.25 W
   - **Answer:** 1. *Why:* P = V_CE × I_c = 0.25 × 0.2 = 0.05 W.

4. **Why is the diode across the motor essential?**
   - It increases motor speed
   - It stops the motor running backwards
   - It gives the winding's current a path at turn-off, preventing a collector voltage spike
   - It filters noise on the 5 V rail
   - **Answer:** 2. *Why:* the motor's inductance forces current to keep flowing, and without the diode it drives V_CE above 40 V.

## SIM NOTE

- **Breakdown clamp:** as in `inductor-rl`, F1 needs a V_CE avalanche model (clamp at a breakdown voltage, then fail per `maxV`) so the spike reads tens of volts, not megavolts.
- **Time step:** a 1 mH, 4 Ω winding has τ = 0.25 ms, shorter than the 1 ms bench step. The turn-off transient (F1) needs a per-lesson `dt` (≈ 20 µs) or adaptive stepping around switching events.
- Motor parameters are illustrative for a small 130-size motor (no specific datasheet). The values give a plausible ≈ 0.18 A and ≈ 9 500 rpm at 6 V.
