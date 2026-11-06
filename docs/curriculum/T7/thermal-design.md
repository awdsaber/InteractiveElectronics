# Thermal Design

*Watts become degrees*

> A 7805 dropping 12 V to 5 V at 0.65 A turns 4.6 W into heat. With no heatsink that means a 325 °C junction on paper; a 10 °C/W heatsink brings it down to about 96 °C.

- **Lesson id:** `thermal-design` · **Track:** T7 Professional
- **fig:** 40. Provisional: sidebar order.
- **Prerequisites:** T2 `regulators-linear-buck`, `thermistor`, `power-grounding-emc`
- **Power element:** `pwr` (powerLabel: "Switch on 12 V")
- **Behaviors:** `thermal-network`, `mcu-supply`, `serial-plotter`
- **transient:** true

## Learning goals

1. Compute a linear regulator's dissipation: P = (Vin − Vout) × Iout + Vin × Iq.
2. Build the thermal resistance chain: junction → case → (interface) → heatsink → ambient. Compute T_j = T_a + P × ΣRθ.
3. Size a heatsink from the allowed junction temperature: Rθsa ≤ (T_j,max − T_a)/P − Rθjc − Rθcs.
4. Use thermal capacitance and time constants to predict how long a part takes to heat up.
5. Recognise thermal shutdown cycling and choose between a bigger heatsink, a fan, or a switching regulator.

## Board

Board: `THERMAL BENCH`, size 14 × 9, base `mat`. Here the 7805 also powers the Uno through its 5 V pin.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| u1 | `regulator-to220` (onsemi MC7805CT) | `tht` | 7805 | Linear regulator: 5 V at up to 1 A, 35 V maximum input. | `q_pass`, `u_err`, `dz`, `i_q` |
| hs | `heatsink` (extruded aluminium, about 10 °C/W in still air; illustrative) | `tht` | HEATSINK | Spreads the heat into the air. | — |
| pad | `logic-ic-label` (thermal compound layer, shown in exploded view) | `tht` | GREASE | Interface between tab and heatsink: Rθcs ≈ 0.5 °C/W with grease, 1–3 °C/W with silicone pads, worse dry (approximate). | — |
| c_in | `capacitor-ceramic` (330 nF) | `tht` | C IN 0.33µ | Input capacitor recommended by the datasheet. | `c_in` |
| c_out | `capacitor-ceramic` (100 nF) | `tht` | C OUT 0.1µ | Output capacitor recommended by the datasheet. | `c_out` |
| r_load | `resistor` (10 Ω 10 W wirewound) | `tht` | LOAD 0.5 A | Main load. | `r_load` |
| uno | `module` (Uno R3, powered on its 5 V pin) | `module` | UNO | Logs the heatsink temperature and runs the fan. | `i_uno`, `pin7` |
| ntc_hs | `thermistor` (10 kΩ NTC, B 3977, epoxied to the heatsink) | `offboard` | HS TEMP | Heatsink temperature sensor (`thermistor` lesson). | `ntc_hs` |
| r_ntc | `resistor` (10 kΩ 1 %) | `offboard` | 10k | Divider top. | `r_ntc` |
| fan | `dc-motor` (40 mm 5 V fan, about 0.1 A) | `offboard` | FAN | Forced air over the fins. | `fan` |
| q_fan | `transistor-to92` (2N7000 N-MOSFET) | `offboard` | FAN FET | Switches the fan from pin 7. | `q_fan` |
| d_fan | `diode` (1N5819) | `offboard` | FLYBACK | Fan coil kick. | `d_fan` |
| psu | `barrel-jack` (12 V bench supply) | `offboard` | 12 V IN | | `psu`, `pwr` |

## Circuit

A **behavioural 7805**: an error amplifier (OPAMP) drives an NPN pass transistor. The reference comes from a zener fed by Vin, so the output is 0 when the input is off. The pass transistor's dissipation, `power['q_pass']`, is the heat that matters.

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `psu` | V | `psu_p`, `0` | 12.0 V, rInternal 0.05 Ω | — | |
| `pwr` | SW | `psu_p`, `vin` | closed: false | — | **Power element** |
| `c_in` | C | `vin`, `0` | 330 nF | maxV 50 V | |
| `i_q` | I | `vin`, `0` | 0.005 A | maxV 35 V | Quiescent (bias) current, about 4–8 mA (datasheet, approximate). 35 V is the maximum input. |
| `r_z` | R | `vin`, `ref` | 4.7 kΩ | — | Reference bias |
| `dz` | ZENER | `0`, `ref` | vz 2.5 | — | 2.5 V reference (anode, cathode) |
| `u_err` | OPAMP | `ref`, `fb`, `bdrv` | vPos 11, vNeg 0 | — | Error amplifier (in+, in−, out) |
| `r_b` | R | `bdrv`, `b` | 100 Ω | — | |
| `q_pass` | NPN | `vin`, `b`, `vout` | beta 50 | maxI 1.5 A | Pass element. Its power is the regulator's heat. |
| `r_fb1` | R | `vout`, `fb` | 10 kΩ | — | |
| `r_fb2` | R | `fb`, `0` | 10 kΩ | — | Vout = 2 × 2.5 = 5.0 V |
| `c_out` | C | `vout`, `0` | 100 nF | — | |
| `r_load` | R | `vout`, `0` | 10 Ω | maxP 10 W | 0.5 A |
| `i_uno` | I | `vout`, `0` | 0.045 A | maxV 6 V | Uno logic |
| `r_ntc` | R | `vout`, `a1` | 10 kΩ | — | |
| `ntc_hs` | R | `a1`, `0` | set by behavior | — | Heatsink NTC |
| `pin7` | PIN | `d7`, `0` | pin 7, vcc 5 | — | Fan gate |
| `r_gf` | R | `d7`, `gf` | 100 Ω | — | |
| `r_gfpd` | R | `gf`, `0` | 100 kΩ | — | |
| `q_fan` | NMOS | `fan_n`, `gf`, `0` | vth 2.1, k 0.17 | maxI 0.2 A, maxV 60 V | 2N7000 fit, Rds ≈ 2 Ω at Vgs = 5 V |
| `fan` | MOTOR | `vout`, `fan_n` | r 30, l 0.001, ke 0.004, j 2e-7, b 2e-8, load 0.0002 | maxI 0.3 A | 40 mm fan (representative) |
| `d_fan` | D | `fan_n`, `vout` | is 1e-6, n 1.1 | maxI 1 A | 1N5819 |

Expected (fan off): Iout ≈ 0.5 + 0.045 + 0.00025 = 0.545 A. Pass loss = (12 − 5) × 0.545 ≈ 3.8 W, plus i_q 12 × 0.005 = 0.06 W. With the fan on (+0.1 A): about **4.6 W**.

The sketch's analog readings are ratiometric to the Uno's VCC (= `vout`), so the NTC divider works correctly even though VCC comes from the 7805.

### Behaviors

- **`thermal-network`**. Parameters: `rthJC` 5 °C/W, `rthCS` 0.5 °C/W, `rthSA` 10 °C/W (heatsink in still air), `rthSAfan` 4 °C/W (with fan airflow; illustrative), `rthCA` 60 °C/W (no heatsink; derived from Rθja = 65 °C/W for the MC7805 TO-220), `heatsink` true, `ambientC` 25, `tsdOn` 150 °C and `tsdOff` 130 °C (typical internal thermal shutdown; the datasheet's operating junction range is 0–125 °C for the C suffix).
  - **Heat capacities:** junction + die 0.05 J/K, case/tab 0.8 J/K (about 2 g of copper), heatsink 18 J/K (about 20 g of aluminium × 900 J/(kg·K)).
  - **Each tick:** P = `power['q_pass']` + `power['i_q']`. It integrates the three-node network junction–case–sink–ambient (or junction–case–ambient without the heatsink). The fan is "on" when `extra['fan.omega']` > 50 % of its free speed, which switches rthSA → rthSAfan.
  - **Thermal shutdown:** if T_j ≥ tsdOn, it sets `dz.vz` to 0 (the reference collapses, so the output is 0) until T_j < tsdOff. The Uno then browns out (`mcu-supply`).
  - Sets `ntc_hs` from the heatsink temperature, using the Beta model of the `thermistor` lesson.
  - **Publishes:** `p_W`, `tj`, `tcase`, `tsink`, `tsd` (0/1), `efficiency` (Pout/Pin) and `tau_sink_s` (≈ heatsink C × (rthSA + share)).
- **`mcu-supply`**: see `arduino-uno`, with `supplyNode` = `vout`.
- **`serial-plotter`**: see `arduino-uno`.

## Sketch

**Title:** Heatsink watchdog · **board:** `uno` · **vcc:** 5

| Pin | Use | PIN element / node |
|---|---|---|
| A1 | Heatsink NTC divider | analogPins `A1 → a1` |
| 7 | Fan MOSFET gate | `pin7` |

```cpp
const float R_FIXED = 10000.0;
const float R25 = 10000.0;
const float BETA = 3977.0;
const int FAN = 7;
const float FAN_ON_C = 60.0;     // hysteresis: on at 60, off at 50
const float FAN_OFF_C = 50.0;

bool fanOn = false;
unsigned long bootMs = 0;

float sinkTempC() {
  long sum = 0;
  for (int i = 0; i < 8; i++) {
    sum += analogRead(A1);
    delay(1);
  }
  float raw = sum / 8.0;
  if (raw < 2.0 || raw > 1021.0) {
    return -999.0;
  }
  float r = R_FIXED * raw / (1023.0 - raw);
  return 1.0 / (1.0 / 298.15 + log(r / R25) / BETA) - 273.15;
}

void setup() {
  pinMode(FAN, OUTPUT);
  digitalWrite(FAN, LOW);
  Serial.begin(115200);
  bootMs = millis();
  Serial.println("boot");            // count these: each one is a brown-out restart
}

void loop() {
  float t = sinkTempC();
  if (t < -100.0) {
    digitalWrite(FAN, HIGH);         // sensor fault: fail safe, fan on
    Serial.println("NTC fault, fan forced on");
  } else {
    if (!fanOn && t > FAN_ON_C) {
      fanOn = true;
    }
    if (fanOn && t < FAN_OFF_C) {
      fanOn = false;
    }
    if (fanOn) {
      digitalWrite(FAN, HIGH);
    } else {
      digitalWrite(FAN, LOW);
    }
    Serial.print("sinkC:");
    Serial.print(t);
    Serial.print(",fan:");
    if (fanOn) {
      Serial.print(1);
    } else {
      Serial.print(0);
    }
    Serial.print(",uptime_s:");
    Serial.println((millis() - bootMs) / 1000.0);
  }
  delay(1000);
}
```

## Readouts

| label | source | unit |
|---|---|---|
| REGULATOR LOSS | `{kind:'behavior', key:'p_W'}` | W |
| JUNCTION Tj | `{kind:'behavior', key:'tj'}` | °C |
| CASE | `{kind:'behavior', key:'tcase'}` | °C |
| HEATSINK | `{kind:'behavior', key:'tsink'}` | °C |
| OUTPUT 5V | `{kind:'voltage', node:'vout'}` | V |
| EFFICIENCY | `{kind:'behavior', key:'efficiency'}` | '' |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Input voltage | `psu` | value | 7 | 30 | 0.5 | no | V |
| Load resistor | `r_load` | value | 5 | 100 | — | yes | Ω |
| Heatsink Rθsa | `behavior:thermal-network` | rthSA | 2 | 30 | 0.5 | no | °C/W |
| Ambient | `behavior:thermal-network` | ambientC | 0 | 60 | 1 | no | °C |

**Time-lapse:** the heatsink's time constant is minutes. SIM NOTE: a ×10 to ×60 sim-speed control for this lesson.

## Status lines

| when | text |
|---|---|
| state RUNNING | RUNNING: 7 V × 0.55 A is burning in the 7805. Watch the heatsink warm over minutes. |
| readout 1 above 125 | Junction above 125 °C: outside the operating rating, with shutdown near 150 °C. |
| readout 4 below 4.5 | Output collapsed: thermal shutdown. The Uno will reboot when it cools. |

## Failures

### F1: Remove the heatsink
- **Patch:** `{op:'set', elementId:'behavior:thermal-network', key:'heatsink', value:false}`
- **Sim shows:** with only the tab's 0.8 J/K, T_j climbs past 150 °C in under a minute. The output drops to 0 and the Uno resets. It cools to 130 °C, restarts and heats again: a slow on/off **cycle**, with `boot` printed each time.
- **Why:** 4.6 W × 65 °C/W = 299 K of rise, giving 324 °C on paper. Thermal shutdown is a last-ditch protection, not a design feature. Repeated cycling stresses the die attach and bond wires.

### F2: Run it from 24 V
- **Patch:** `{op:'set', elementId:'psu', key:'value', value:24}`
- **Sim shows:** P ≈ (24 − 5) × 0.65 ≈ 12.4 W. Even with the heatsink: 25 + 12.4 × 15.5 ≈ 217 °C, so it shuts down within minutes.
- **Why:** the regulator burns the voltage *difference*. The 7805 accepts up to 35 V, but at this current only a large heatsink, or a switching (buck) regulator at about 90 % efficiency, makes sense. The buck would lose 5 × 0.65 × (1/0.9 − 1) ≈ 0.36 W.

### F3: Mount it dry (no grease, poor contact)
- **Patch:** `{op:'set', elementId:'behavior:thermal-network', key:'rthCS', value:4}`
- **Sim shows:** the steady-state T_j rises by 4.6 × 3.5 ≈ 16 K to about 112 °C. The heatsink itself runs *cooler* than before, a classic misleading clue.
- **Why:** a microscopically rough tab touching a rough heatsink only makes contact at high points. Grease or a pad fills the air gaps. A cool heatsink with a hot part means the interface is the bottleneck.

## Meet the board

Heat flows like current: **ΔT = P × Rθ**. The resistances add in series from junction to air.

**Power:** a 7805 with 12 V in and 5 V out at 0.65 A: P = 7 × 0.65 + 12 × 0.005 = **4.61 W**. The efficiency is only Pout/Pin = (5 × 0.65)/(12 × 0.655) ≈ **41 %**.

**No heatsink:** the MC7805 TO-220 is rated Rθja = 65 °C/W, so T_j = 25 + 4.61 × 65 = **325 °C**. That's impossible; the part shuts down long before.

**With a heatsink:** Rθjc 5 + Rθcs 0.5 (grease) + Rθsa 10 = 15.5 °C/W, so T_j = 25 + 4.61 × 15.5 = **96 °C**. In a 40 °C enclosure it is 111 °C.

**Sizing it:** to stay at or below 110 °C at 40 °C ambient, Rθsa ≤ (110 − 40)/4.61 − 5 − 0.5 = **9.7 °C/W**.

**Time constant:** a 20 g aluminium heatsink holds about 18 J/K, and at 10 °C/W, τ ≈ 180 s. The temperature takes 3τ ≈ 9 minutes to settle, so a quick bench test can lie.

**The alternative:** a buck converter at 90 % efficiency wastes 3.25 × (1/0.9 − 1) ≈ 0.36 W, about 13 times less heat.

## For mechanical engineers

> This is your heat-transfer course compressed: thermal resistances in series, R = L/(kA) for conduction and 1/(hA) for convection, and lumped capacitances m·c. The junction is a hot spot in a small mass, the tab is a spreader, and the heatsink is a finned extended surface whose Rθsa already folds in the fin efficiency and h. A fan raises h. **Where it breaks:** the datasheet's Rθja assumes a specific test board and still air, and real enclosures recirculate warm air. The hottest point on the die is not measurable, so Rθjc is a model you trust, not one you check.

## Pro tips

1. Design to a junction temperature with margin: about 100–110 °C for a part rated 125 °C. Every 10 °C cooler roughly doubles many components' life, a widely used rule of thumb rather than a law.
2. Measure the tab with a thermocouple or NTC (as here) and add P × Rθjc to estimate T_j. Infrared thermometers misread shiny metal badly.
3. If (Vin − Vout) × I is more than about 1 W, price a buck module before you buy a heatsink. It is usually cheaper, smaller and cooler.

## Quiz

1. **A 7805 with 12 V in, 5 V out, 0.65 A load and 5 mA quiescent current. What is its dissipation?**
   - 3.25 W
   - 4.61 W
   - 7.8 W
   - 12 W
   - **Answer:** 1. *Why:* (12 − 5) × 0.65 + 12 × 0.005 = 4.55 + 0.06 = 4.61 W.

2. **The same part with no heatsink (Rθja = 65 °C/W) at 25 °C ambient. What junction temperature does the maths give?**
   - 90 °C
   - 125 °C
   - 225 °C
   - 325 °C
   - **Answer:** 3. *Why:* 25 + 4.61 × 65 ≈ 325 °C. It will be in thermal shutdown.

3. **To keep T_j ≤ 110 °C at 40 °C ambient with Rθjc = 5 and Rθcs = 0.5, what is the largest Rθsa you can use?**
   - 4.2 °C/W
   - 9.7 °C/W
   - 15.2 °C/W
   - 20 °C/W
   - **Answer:** 1. *Why:* (110 − 40)/4.61 − 5.5 = 15.18 − 5.5 ≈ 9.7 °C/W.

4. **A 90 % efficient buck replaces the 7805 (5 V, 0.65 A out). How much heat does it make?**
   - 0.036 W
   - 0.36 W
   - 3.6 W
   - 4.6 W
   - **Answer:** 1. *Why:* Pin = 3.25 / 0.9 = 3.61 W, so loss = 3.61 − 3.25 ≈ 0.36 W.

## SIM NOTE

- **Sim-speed control:** the thermal time constants (minutes) need a time-lapse mode. Run the MNA at a coarser step or skip, while the thermal network integrates at its own rate.
- A behavior that sets `ZENER.vz` (thermal shutdown) needs `setParam` to work on ZENER parameters.
- `mcu-supply` must watch `vout` as the Uno's supply (configurable `supplyNode`), and restart the MCU when it recovers. The `boot` line then appears in the serial log on each cycle.
- `power['i_q']` for an `I` element (V × I) must be reported by the solver.
- The OPAMP's `vPos` is a fixed number (11 V). If Vin is tweaked below about 7 V, the pass transistor saturates and the "regulator" has unrealistic dropout behaviour. An `LDO`/`LINREG` element with real dropout (about 2 V for a 7805) would be better.
