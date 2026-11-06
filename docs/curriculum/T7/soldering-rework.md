# Soldering and Rework

*Joints you can trust*

> A good through-hole joint is about a milliohm. A cold one at 0.6 Ω drops 0.3 V and makes 0.15 W of heat at 0.5 A, and it may only fail when the board vibrates.

- **Lesson id:** `soldering-rework` · **Track:** T7 Professional
- **fig:** 42. Provisional: sidebar order.
- **Prerequisites:** `arduino-uno`, `power-grounding-emc`
- **Power element:** `pwr` (powerLabel: "Switch on 5 V load"). The Uno's USB is always on.
- **Behaviors:** `solder-joints`, `mcu-supply`, `serial-plotter`
- **transient:** false

## Learning goals

1. Recognise good and bad joints by shape. Good: concave, wetted, contact angle well under 90°. Bad: cold or disturbed (grainy, convex, poor wetting), insufficient, excess or balled, bridged, lifted pad, cracked.
2. Know the temperatures: SAC305 lead-free melts at about 217–220 °C, Sn63/Pb37 is eutectic at 183 °C, and the usual tip settings are about 330–370 °C.
3. Measure joint resistance with a 4-wire (Kelvin) style measurement and a reference voltage chosen for resolution.
4. Rework safely: flux, desoldering braid or pump, hot air for SMD, pad care and cleaning.
5. Relate joints to IPC-A-610 acceptability classes (1 general, 2 dedicated service, 3 high reliability) at the level of "know it exists, inspect to a class".

## Board

Board: `JOINT TESTER`, size 12 × 8, base `mat`. A practice PCB with four large through-hole joints (J1–J4) in series with a 0.5 A load, plus two adjacent LED pads for bridge practice.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | Pulses the load and measures each joint's voltage drop on A0–A3. | `pin8`, `pin5`, `pin6` |
| psu | `barrel-jack` (5 V 2 A supply) | `offboard` | 5 V LOAD SUPPLY | | `psu`, `pwr` |
| r_load | `resistor` (10 Ω 5 W cement) | `tht` | LOAD 10 Ω | Sets 0.5 A through the joint chain. | `r_load` |
| q1 | `mosfet-to220` (IRLZ44N) | `tht` | SWITCH | Pulses the load for 20 ms so the resistor stays cool. | `q1` |
| r_g, r_gpd | `resistor` (100 Ω, 10 kΩ) | `tht` | GATE | | `r_g`, `r_gpd` |
| j1–j4 | `testpoint` (large THT pad + wire stub, soldered by the learner) | `tht` | J1 · J2 · J3 · J4 | The joints under test. Their fillet shape shows quality (SIM NOTE). | `j1`, `j2`, `j3`, `j4` |
| sense | `wire` ×4 (thin sense leads to A0–A3) | `offboard` | SENSE | Kelvin-style taps: sense current is tiny, so the sense wires add no error. | — |
| led_n | `led` (green) + `resistor` (330 Ω) | `tht` | LED D6 | Neighbour of the bridge-practice pad pair. | `r_led`, `led6` |
| pad_d5 | `testpoint` | `tht` | PAD D5 | Adjacent pad driven LOW: a bridge target. | — |
| iron | `probe` (soldering iron, decorative) | `offboard` | IRON | Tip temperature shown as a tweak. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `v_usb` | V | `5v`, `0` | 5.0 V, rInternal 0.6 Ω | — | Uno (always on) |
| `i_board` | I | `5v`, `0` | 0.045 A | — | |
| `psu` | V | `p5`, `0` | 5.0 V, rInternal 0.05 Ω | — | Load supply |
| `pwr` | SW | `p5`, `v5l` | closed: false | — | **Power element** |
| `r_load` | R | `v5l`, `ld` | 10 Ω | maxP 5 W | 2.5 W continuous at 0.5 A. Pulsed in the sketch. |
| `q1` | NMOS | `ld`, `g`, `j0` | vth 1.5, k 11 | maxV 55 V | IRLZ44N fit (see `power-grounding-emc`) |
| `pin8` | PIN | `d8`, `0` | pin 8, vcc 5 | — | |
| `r_g` | R | `d8`, `g` | 100 Ω | — | |
| `r_gpd` | R | `g`, `0` | 10 kΩ | — | |
| `j1` | R | `j0`, `n1` | 0.001 Ω (set by behavior) | maxP 0.5 W | Joint 1 |
| `j2` | R | `n1`, `n2` | 0.001 Ω | maxP 0.5 W | Joint 2 |
| `j3` | R | `n2`, `n3` | 0.001 Ω | maxP 0.5 W | Joint 3 |
| `j4` | R | `n3`, `0` | 0.001 Ω | maxP 0.5 W | Joint 4 |
| `pin6` | PIN | `d6`, `0` | pin 6, vcc 5 | — | Neighbour LED |
| `r_led` | R | `d6`, `l6` | 330 Ω | — | |
| `led6` | LED | `l6`, `0` | green | maxI 0.02 A | |
| `pin5` | PIN | `d5`, `0` | pin 5, vcc 5 | — | Driven LOW by the sketch (the bridge partner) |

analogPins: `A0 → j0`, `A1 → n1`, `A2 → n2`, `A3 → n3`. The drop across Jk is V(A[k−1]) − V(A[k]), and V(A3) is the drop across J4.

Expected (all good): 0.5 A × 1 mΩ = 0.5 mV per joint, which is below one count even on the 1.1 V reference (1.07 mV). The sketch reports "< 2 mΩ".

### Behaviors

- **`solder-joints`**. Each joint has a `quality`: `good` (0.5–1.5 mΩ, concave fillet), `cold` (0.2–1 Ω, grainy convex fillet, intermittent), `insufficient` (5–20 mΩ, thin fillet, a hole visible), `excess` (≈1 mΩ electrically, a balled fillet that hides the wetting), `lifted` (open circuit: the pad has torn from the laminate) and `cracked` (≈1 mΩ at rest, open circuit while `vibration` > 0).
  - **Intermittency:** a `cold` joint adds random 1–50 Ω spikes for 5–50 ms at a rate proportional to the behavior param `vibration` (0–1). It sets `jk.value` each tick and publishes the quality for the 3D fillet variant.
  - **Iron temperature** (behavior param `tipC`, tweak). Reworking a joint (the menu item "Reflow Jk") at `tipC` between 330 and 380 °C with flux makes it `good`. Below 280 °C it becomes `cold`. Above 420 °C, or more than 3 reflows of the same joint, it becomes `lifted` (pad damage).
  - **Publishes:** `jk_quality`, `jk_mohm`, `joint_W` (the worst joint's I²R) and `vibration`.
- **`mcu-supply`**, **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** Joint ohmmeter · **board:** `uno` · **vcc:** 5

| Pin | Use | PIN element / node |
|---|---|---|
| 8 | Load MOSFET gate | `pin8` |
| A0–A3 | Joint sense taps | `j0`, `n1`, `n2`, `n3` |
| 6 | Neighbour LED (blinks) | `pin6` |
| 5 | Held LOW (bridge partner) | `pin5` |

```cpp
#define LOAD 8
const float I_LOAD_A = 0.5;          // 5 V / 10 ohm. Measure it for better accuracy.
const float VREF = 1.1;              // internal reference, nominal (1.0-1.2 V spread)
const int TAPS[4] = {A0, A1, A2, A3};

float tapMv(int k) {
  long sum = 0;
  for (int i = 0; i < 8; i++) {
    sum += analogRead(TAPS[k]);
  }
  return sum / 8.0 * VREF / 1023.0 * 1000.0;
}

void setup() {
  pinMode(LOAD, OUTPUT);
  pinMode(5, OUTPUT);
  pinMode(6, OUTPUT);
  digitalWrite(5, LOW);
  analogReference(INTERNAL);         // 1.1 V full scale: ~1.07 mV per count
  Serial.begin(115200);
  analogRead(A0);                    // first read after a reference change is junk
  delay(10);
}

void loop() {
  float mv[4];
  digitalWrite(LOAD, HIGH);          // 20 ms pulse: 0.5 A through J1..J4
  delay(20);
  for (int k = 0; k < 4; k++) {
    mv[k] = tapMv(k);
  }
  digitalWrite(LOAD, LOW);

  for (int k = 0; k < 4; k++) {
    float drop = mv[k];
    if (k < 3) {
      drop = mv[k] - mv[k + 1];      // joint k+1 sits between tap k and tap k+1
    }
    float mohm = drop / I_LOAD_A;    // mV / A = milliohm
    Serial.print("J");
    Serial.print(k + 1);
    Serial.print("_mohm:");
    Serial.print(mohm);
    if (k < 3) {
      Serial.print(",");
    }
  }
  Serial.println("");

  digitalWrite(6, HIGH);             // neighbour LED heartbeat
  delay(200);
  digitalWrite(6, LOW);
  delay(780);
}
```

## Readouts

| label | source | unit |
|---|---|---|
| J1 | `{kind:'behavior', key:'serial.J1_mohm'}` | '' (mΩ) |
| J2 | `{kind:'behavior', key:'serial.J2_mohm'}` | '' (mΩ) |
| J3 | `{kind:'behavior', key:'serial.J3_mohm'}` | '' (mΩ) |
| J4 | `{kind:'behavior', key:'serial.J4_mohm'}` | '' (mΩ) |
| LOAD CURRENT | `{kind:'current', elementId:'r_load'}` | A |
| WORST JOINT HEAT | `{kind:'behavior', key:'joint_W'}` | W |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Vibration (tap the board) | `behavior:solder-joints` | vibration | 0 | 1 | 0.05 | no | — |
| Iron tip temperature | `behavior:solder-joints` | tipC | 250 | 450 | 5 | no | °C |

SIM NOTE: "Reflow J1…J4" and "Wick bridge" as bench actions, next to "Solder joints".

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: 20 ms load pulses, four joint resistances per second. |
| readout 5 above 0.05 | A joint is dissipating over 50 mW: it is heating its own solder. |

## Failures

### F1: Cold joint on J2
- **Patch:** `{op:'set', elementId:'behavior:solder-joints', key:'j2', value:'cold'}`
- **Sim shows:** J2 reads about **600 mΩ**: a 0.3 V drop, which is 279 counts on the 1.1 V reference. Raise the vibration and it spikes to tens of ohms, and the load current drops in bursts. The 3D fillet turns dull and convex.
- **Why:** the solder melted but never wetted the pad or lead, often because the joint was too cool, there was too little flux, the surface was oxidised, or it moved while solidifying. Electrically it is a contact, not a bond. Reflow with fresh flux at the right temperature, holding the iron 2–4 s so that pad *and* lead both reach temperature.

### F2: Solder bridge between pads D5 and D6
- **Patch:** `{op:'short', a:'d6', b:'d5'}`
- **Sim shows:** when D6 goes HIGH while D5 is LOW, the two pins fight through 2 × 25 Ω: about 100 mA. Both pins exceed 40 mA, so after 300 ms both are dead. The LED never lights.
- **Why:** a bridge connects two nets that the design keeps apart, and two outputs then short each other. Remove it with flux and braid (or drag the iron, with flux, away from the gap). Always inspect fine-pitch work under magnification before power-up.

### F3: Lifted pad on J3 (overheated during rework)
- **Patch:** `{op:'remove', elementId:'j3'}`
- **Sim shows:** the load current falls to 0. Tap A2 rises to the supply (through the MOSFET and load), so the sketch's J3 reading jumps to an impossible value.
- **Why:** too much heat, or repeated reflows, delaminates the copper pad from the FR-4. Repair with a jumper wire from the lead to the next point on the trace, glued down. Prevention: correct tip temperature, flux, and no levering with the iron.

## Meet the board

A solder joint is a **metallurgical bond**: the molten solder dissolves a thin layer of the copper and forms an intermetallic. That only happens if the pad *and* the lead reach the solder's melting point, and flux keeps them oxide-free.

**Temperatures:** SAC305 (lead-free) melts at about **217–220 °C**, and Sn63/Pb37 at **183 °C** (eutectic: it freezes all at once). Tip settings of about 330–370 °C are typical.

**What a good joint looks like:** a smooth concave fillet that feathers out onto the pad and up the lead, with the lead's outline visible and the contact angle low. **Cold or disturbed:** grainy, lumpy, convex, or not wetting the pad. **Insufficient:** you can see the hole. **Bridged:** solder joins two pads.

**Measuring it:** 0.5 A through a good 1 mΩ joint drops 0.5 mV, below the Uno's 4.9 mV per count on the 5 V reference. Switch to the **1.1 V internal reference**: 1.1 / 1023 = **1.07 mV per count**. A cold 0.6 Ω joint drops 0.3 V, which is **279 counts**, unmistakable. The sense taps carry almost no current, so their own joints and wires don't add error. That is the idea of 4-wire (Kelvin) measurement.

**Heat in a bad joint:** P = I²R = 0.5² × 0.6 = **0.15 W** concentrated in a few mm³. Under sustained current it can crack or reflow itself.

**IPC-A-610** defines what "acceptable" looks like at Class 1, 2 or 3. Pick a class and inspect to it.

## For mechanical engineers

> A solder joint is closer to brazing than to gluing: a filler metal with a lower melting point that wets and alloys with both base metals, so capillary action pulls it into the gap. As in brazing, joint strength comes from wetting, and a fillet that sits on top of an unwetted surface is a cosmetic bead, like a braze that never flowed. A cracked joint is a fatigue crack from thermal cycling or vibration. **Where it breaks:** a braze is judged mostly on strength. A solder joint is judged on *electrical* continuity too, and it can be mechanically "holding" while electrically intermittent: invisible until the board vibrates.

## Pro tips

1. Add flux even with flux-cored wire when reworking. Old solder has already lost its flux, and most "it won't flow" problems are oxidation, not temperature.
2. Heat the joint, not the solder: tip against pad and lead together, feed the solder into the joint (not onto the tip), and remove the solder before the iron. Count 2–4 seconds.
3. Clean flux residue off precision analog circuits (high-impedance nodes, load-cell amplifiers). "No-clean" flux is safe to leave, but it can still leak tiny currents on high-impedance nodes.

## Quiz

1. **0.5 A flows through a 0.6 Ω cold joint. What are the voltage drop and the power dissipated?**
   - 0.03 V and 15 mW
   - 0.3 V and 0.15 W
   - 0.6 V and 0.3 W
   - 3 V and 1.5 W
   - **Answer:** 1. *Why:* V = 0.5 × 0.6 = 0.3 V, and P = 0.5² × 0.6 = 0.15 W.

2. **With `analogReference(INTERNAL)` (1.1 V), what count does a 0.3 V drop produce?**
   - 61
   - 140
   - 279
   - 1023
   - **Answer:** 2. *Why:* 0.3 / 1.1 × 1023 ≈ 279.

3. **At about what temperature does SAC305 lead-free solder melt?**
   - 120 °C
   - 183 °C
   - 217–220 °C
   - 350 °C
   - **Answer:** 2. *Why:* SAC305 (Sn96.5/Ag3.0/Cu0.5) melts over about 217–220 °C. 183 °C is the eutectic of tin-lead, and 350 °C is a typical *tip* setting.

4. **Which describes a good through-hole joint?**
   - A shiny ball sitting on the pad
   - A concave fillet wetting both pad and lead, with the lead outline visible
   - A grainy grey surface
   - Solder covering the neighbouring pad too
   - **Answer:** 1. *Why:* wetting shows as a low contact angle and a concave meniscus. A ball means poor wetting.

## SIM NOTE

- **3D fillet variants per joint quality** (concave, convex/grainy, ball, bridge, lifted pad), driven by behavior state instead of a single "soldered" boolean in `PartRenderState`.
- **New bench actions:** "Reflow J1…J4" and "Wick bridge", with an iron-temperature tweak. Repair actions currently exist only as "Repair all".
- **Patch with a string value for behavior params** (`key:'j2', value:'cold'`). `FailurePatch.set` already allows strings; behaviors must accept them.
- `analogReference(INTERNAL)` must be supported in the MCU, changing the ADC full scale to 1.1 V, as must `const int` arrays of pin constants (`A0…A3`).
- Milliohm values in MNA: 1 mΩ elements with 0.5 A are numerically fine, but tiny drops (0.5 mV) only matter for the ADC model. Make sure readAnalog uses node voltages relative to `0`, not to gmin-biased nodes.
