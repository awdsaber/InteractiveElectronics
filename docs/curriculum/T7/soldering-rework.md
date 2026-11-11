# Soldering and Rework

*Joints you can trust*

> A good through-hole joint is about a milliohm. A cold one at 0.6 Ω drops 0.3 V and makes 0.15 W of heat at 0.5 A, and it may only fail when the board vibrates.

- **Lesson id:** `soldering-rework` · **Track:** T7 Professional
- **fig:** 42. Provisional: sidebar order.
- **Prerequisites:** `arduino-uno`, `power-grounding-emc`
- **Power element:** `usb` (powerLabel: "Plug USB"), plus `pwr` as extra power ("Switch on 5 V load").
- **Behaviors:** `solder-joints`, `serial-plotter`
- **transient:** false

## Learning goals

1. Recognise good and bad joints by shape. Good: concave, wetted, contact angle well under 90°. Bad: cold or disturbed (grainy, convex, poor wetting), insufficient, excess or balled, bridged, lifted pad, cracked.
2. Know the temperatures: SAC305 lead-free melts at about 217–220 °C, Sn63/Pb37 is eutectic at 183 °C, and the usual tip settings are about 330–370 °C for leaded and 350–400 °C for lead-free.
3. Measure joint resistance with a 4-wire (Kelvin) style measurement and a reference voltage chosen for resolution.
4. Rework safely: flux, desoldering braid or pump, hot air for SMD, pad care and cleaning.
5. Relate joints to IPC-A-610 acceptability classes (1 general, 2 dedicated service, 3 high reliability) at the level of "know it exists, inspect to a class".

## Board

Board: `JOINT TESTER`, size 17 × 9, base `mat`. A practice PCB with four large through-hole joints (J1–J4) in series with a 0.5 A load, plus an LED whose anode joint J5 sits 2.54 mm from its cathode (ground) pad for bridge practice. (Revised in the build: the LED-path joint and the in-place bridge replace the separate PAD D5; the D5/D6 header bridge stays as failure F2.)

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (Uno R3) | `module` | UNO | Pulses the load and measures each joint's voltage drop on A0–A3. | `pin8`, `pin5`, `pin6` |
| psu | `barrel-jack` (5 V 2 A supply) | `offboard` | 5 V LOAD SUPPLY | | `psu`, `pwr` |
| r_load | `resistor` (10 Ω 5 W cement) | `tht` | LOAD 10 Ω | Sets 0.5 A through the joint chain. | `r_load` |
| q1 | `mosfet-to220` (IRLZ44N) | `tht` | SWITCH | Pulses the load for 20 ms so the resistor stays cool. | `q1` |
| r_g, r_gpd | `resistor` (100 Ω, 10 kΩ) | `tht` | GATE | | `r_g`, `r_gpd` |
| j1–j4 | `testpoint` (large THT pad + wire stub, soldered by the learner) | `tht` | J1 · J2 · J3 · J4 | The joints under test. Their fillet shape shows quality (SIM NOTE). | `j1`, `j2`, `j3`, `j4` |
| sense | `wire` ×4 (thin sense leads to A0–A3) | `offboard` | SENSE | Kelvin-style taps: sense current is tiny, so the sense wires add no error. | — |
| led6 | `led` (green) + `resistor` (330 Ω) | `tht` | LED · J5 | Steady on from pin 6. Its anode joint J5 is the fine-pitch joint: too much solder bridges it to the cathode pad. | `led6`, `j5`, `r_led` |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `usb` | V | `5v`, `0` | 5.0 V, rInternal 0.1 Ω | — | Uno, **power element** |
| `psu` | V | `p5`, `0` | 5.0 V, rInternal 0.05 Ω | — | Load supply |
| `pwr` | SW | `p5`, `v5l` | closed: true | — | **Extra power** ("Switch on 5 V load") |
| `r_load` | R | `v5l`, `ld` | 10 Ω | maxP 5 W | 2.5 W continuous at 0.5 A. Pulsed in the sketch. |
| `q1` | NMOS | `ld`, `g`, `j0` | vth 1.5, k 11 | maxV 55 V | IRLZ44N fit (see `power-grounding-emc`) |
| `pin8` | PIN | `d8`, `0` | pin 8, vcc 5 | — | |
| `r_g` | R | `d8`, `g` | 100 Ω | — | |
| `r_gpd` | R | `g`, `0` | 10 kΩ | — | |
| `j1` | R | `j0`, `n1` | 0.001 Ω (set by behavior) | maxP 0.5 W | Joint 1 |
| `j2` | R | `n1`, `n2` | 0.001 Ω | maxP 0.5 W | Joint 2 |
| `j3` | R | `n2`, `n3` | 0.001 Ω | maxP 0.5 W | Joint 3 |
| `j4` | R | `n3`, `0` | 0.001 Ω | maxP 0.5 W | Joint 4 |
| `pin6` | PIN | `d6`, `0` | pin 6, vcc 5, rOut 25 Ω | maxI 0.04 A | LED (steady on) |
| `r_led` | R | `d6`, `l5` | 330 Ω | — | |
| `j5` | R | `l5`, `l6` | 0.001 Ω (set by behavior) | — | Joint 5, the LED anode |
| `led6` | LED | `l6`, `0` | green | maxI 0.03 A | ≈ 8.2 mA: (5 − 2.1) / (330 + 25) |
| `br5` | SW | `l6`, `0` | closed: false (behavior) | — | A solder bridge J5 → cathode pad: shorts the LED |
| `pin5` | PIN | `d5`, `0` | pin 5, vcc 5, rOut 25 Ω | maxI 0.04 A | Driven LOW by the sketch (header neighbour of D6, failure F2) |

analogPins: `A0 → j0`, `A1 → n1`, `A2 → n2`, `A3 → n3`. The drop across Jk is V(A[k−1]) − V(A[k]), and V(A3) is the drop across J4.

Expected (all good): 0.5 A × 1 mΩ = 0.5 mV per joint, which is below one count even on the 1.1 V reference (1.07 mV). The sketch reports "< 2 mΩ".

### Behaviors

- **`solder-joints`** (as built). Each joint has a quality set by the technique: `good` (1 mΩ, concave fillet), `cold` (0.6 Ω, the middle of the 0.2–1 Ω range; a grainy convex lump), `insufficient` (10 mΩ, thin fillet), `excess` (1 mΩ electrically, a balled fillet that hides the wetting), `bridge` (on the fine J5 pad: closes `br5`), `overheated` (1 mΩ, charred flux, a weakened pad) and `lifted` (open, 10 MΩ). A cracked joint is modelled as `cold`.
  - **Intermittency:** while `vibration` (0–1) > 0, a cold joint opens (1 kΩ) in random spells of about 30 ms (at least 10 ms), with closed spells averaging 0.25 s / vibration. On the load chain the 0.5 A pulse drops out; on J5 the LED flickers down to about 2 mA.
  - **The rule** (a lookup, not a thermal model; first match wins): a lifted pad stays lifted. Tip above the alloy's setpoint window + 20 °C (Sn63/Pb37 330–370 °C, so above 390 °C; SAC305 350–400 °C, so above 420 °C), or dwell over 5 s: `overheated`, or `lifted` if it was already overheated. Tip below the window − 20 °C (310 / 330 °C), dwell under 2 s, or no flux: `cold`. Too little solder: `insufficient`; too much: `excess`, or `bridge` on J5. Otherwise `good`. Wicking leaves `insufficient` (its heat still counts).
  - **Controls** (tweaks on `behavior:solder`): Joint (J1–J5), Solder alloy, Iron tip temperature, Dwell time, Flux, Solder fed, "Solder this joint" and "Wick this joint" (momentary), and Vibration.
  - **Publishes:** `jk_q`, `jk_ohm`, `jk_heats`, `sel_q`, `sel_ohm`, `breaks`, `joint_W` (the worst load-chain joint's I²R at 0.5 A) and `last_q`.
- **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** Joint ohmmeter · **board:** `uno` · **vcc:** 5

| Pin | Use | PIN element / node |
|---|---|---|
| 8 | Load MOSFET gate | `pin8` |
| A0–A3 | Joint sense taps | `j0`, `n1`, `n2`, `n3` |
| 6 | LED through J5 (steady on) | `pin6` |
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
| LOAD CURRENT (20 ms PULSES) | `{kind:'current', elementId:'r_load'}` | A |
| LED CURRENT | `{kind:'current', elementId:'led6'}` | A |
| SELECTED JOINT (TRUE) | `{kind:'behavior', key:'solder.sel_ohm'}` | Ω |
| SELECTED JOINT GRADE | `{kind:'behavior', key:'solder.sel_q'}` | '' (0 good … 6 lifted) |
| CONTACT BREAKS | `{kind:'behavior', key:'solder.breaks'}` | '' |
| WORST JOINT I²R AT 0.5 A | `{kind:'behavior', key:'solder.joint_W'}` | W |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Joint (enum J1–J5) | `behavior:solder` | target | 1 | 5 | — | no | — |
| Solder alloy (enum Sn63/Pb37, SAC305) | `behavior:solder` | alloy | 0 | 1 | — | no | — |
| Iron tip temperature | `behavior:solder` | tipC | 250 | 450 | 5 | no | °C |
| Dwell time | `behavior:solder` | dwellS | 0.5 | 8 | 0.5 | no | s |
| Flux (toggle) | `behavior:solder` | flux | 0 | 1 | — | no | — |
| Solder fed (enum too little / right / too much) | `behavior:solder` | feed | 0 | 2 | — | no | — |
| Solder this joint (momentary) | `behavior:solder` | go | 0 | 1 | — | no | — |
| Wick this joint (momentary) | `behavior:solder` | wick | 0 | 1 | — | no | — |
| Vibration (tap the board) | `behavior:solder` | vibration | 0 | 1 | 0.05 | no | — |

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: 20 ms load pulses, four joint resistances per second. |
| readout 5 above 0.05 | A joint is dissipating over 50 mW: it is heating its own solder. |

## Failures

### F1: Cold joint on J2
- **Patch:** `{op:'set', elementId:'behavior:solder', key:'j2', value:'cold'}`
- **Sim shows:** J2 reads about **560 mΩ**. The 0.6 Ω also cuts the load current from ≈ 0.495 A to ≈ 0.468 A, so the drop is 0.28 V (261 counts on the 1.1 V reference), and the sketch divides it by its nominal 0.5 A. (Corrected: the first draft said 600 mΩ and 279 counts, which assumed the current stays at 0.5 A.) Raise the vibration and its contact opens in short bursts, and the load current drops out with it. The 3D fillet turns dull and convex.
- **Why:** the solder melted but never wetted the pad or lead, often because the joint was too cool, there was too little flux, the surface was oxidised, or it moved while solidifying. Electrically it is a contact, not a bond. Reflow with fresh flux at the right temperature, holding the iron 2–4 s so that pad *and* lead both reach temperature.

### F2: Solder bridge between pads D5 and D6
- **Patch:** `{op:'short', a:'d6', b:'d5'}`
- **Sim shows:** when D6 goes HIGH while D5 is LOW, the two pins fight through 2 × 25 Ω: about 100 mA. Both pins exceed 40 mA, so after 300 ms both are dead. The LED never lights.
- **Why:** a bridge connects two nets that the design keeps apart, and two outputs then short each other. Remove it with flux and braid (or drag the iron, with flux, away from the gap). Always inspect fine-pitch work under magnification before power-up.

### F3: Lifted pad on J3 (overheated during rework)
- **Patch:** `{op:'set', elementId:'behavior:solder', key:'j3', value:'lifted'}` (the joint goes open, 10 MΩ)
- **Sim shows:** the load current falls to 0. Tap A2 rises to the supply (through the MOSFET and load), so the sketch's J3 reading jumps to an impossible value.
- **Why:** too much heat, or repeated reflows, delaminates the copper pad from the FR-4. Repair with a jumper wire from the lead to the next point on the trace, glued down. Prevention: correct tip temperature, flux, and no levering with the iron.

### F4: ESD zap on pin 6 (added in the build)
- **Patch:** `{op:'set', elementId:'behavior:solder', key:'esd', value:1}`: the behavior calls `burn('pin6')`.
- **Sim shows:** FAULT on pin 6, and the LED goes out.
- **Why:** a person can charge to several kV and only feels a discharge above roughly 3 kV; many ICs are qualified to only about 2 kV human-body model (100 pF through 1.5 kΩ). Wear a wrist strap (1 MΩ to ground), use an ESD-safe iron, and work on a dissipative mat.

## Meet the board

A solder joint is a **metallurgical bond**: the molten solder dissolves a thin layer of the copper and forms an intermetallic. That only happens if the pad *and* the lead reach the solder's melting point, and flux keeps them oxide-free.

**Temperatures:** SAC305 (lead-free) melts at about **217–220 °C**, and Sn63/Pb37 at **183 °C** (eutectic: it freezes all at once). Tip settings of about 330–370 °C (leaded) and 350–400 °C (lead-free) are typical.

**What a good joint looks like:** a smooth concave fillet that feathers out onto the pad and up the lead, with the lead's outline visible and the contact angle low. **Cold or disturbed:** grainy, lumpy, convex, or not wetting the pad. **Insufficient:** you can see the hole. **Bridged:** solder joins two pads.

**Measuring it:** 0.5 A through a good 1 mΩ joint drops 0.5 mV, below the Uno's 4.9 mV per count on the 5 V reference. Switch to the **1.1 V internal reference**: 1.1 / 1023 = **1.07 mV per count**. A cold 0.6 Ω joint drops about 0.28 V at the 0.47 A it lets through, **261 counts**, unmistakable. The sense taps carry almost no current, so their own joints and wires don't add error. That is the idea of 4-wire (Kelvin) measurement.

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
