# LED and Resistor

*Taming the diode*

> Pin 13's 5 V minus a red LED's 1.8 V leaves 3.2 V for 220 Ω: about 13 mA, safely under the LED's 20 mA rating.

- **Lesson id:** `led-resistor` · **Track:** T2 Semiconductors · **Video:** Fig. 02
- **Prerequisites:** `arduino-uno` (Start here), `ohms-law`, `breadboard`
- **Power element:** `V_USB` (powerLabel: "Plug USB")
- **Sketch:** yes (Blink)

## Learning goals

1. Explain why an LED needs a series resistor: its current rises exponentially above V_f.
2. Size the resistor with R = (V_supply − V_f)/I, including the pin's own output resistance.
3. Know the ATmega328P limits: 40 mA absolute maximum per pin, ~20 mA recommended, 200 mA total.
4. Identify the LED's anode (long leg) and cathode (short leg, flat on the rim).

## Board

Board: `LED-16`, size 16 × 10, base `mat`.

| id | PartKind | mount | label | role | circuitIds |
|---|---|---|---|---|---|
| uno | `module` (title "UNO", Uno-style board area) | `module` | UNO | ATmega328P at 5 V; pin 13 drives the LED. | `PIN13` |
| usb | `usb-b` | `tht` | USB | Brings 5 V from the computer. | `V_USB` |
| bb | `breadboard` | `offboard` | BREADBOARD | Holds the LED and resistor. | — |
| r1 | `resistor` (220 Ω: red-red-brown-gold, 1/4 W) | `tht` | LIMIT | Drops the extra 3.2 V and sets the current. | `R1` |
| led1 | `led` (5 mm red) | `tht` | LED | Lights at ≈ 13 mA. | `LED1` |
| w1 | `wire` (yellow) | `offboard` | PIN13 | Pin 13 to the resistor. | — |
| w2 | `wire` (black) | `offboard` | GND | LED cathode back to Uno GND. | — |

## Circuit

| id | type | nodes | value / params | rating | notes |
|---|---|---|---|---|---|
| `V_USB` | V | `usb5v`, `0` | 5.0 V, rInternal 0.1 Ω | — | **power element**; USB VBUS rail (powers the MCU) |
| `PIN13` | PIN | `p13`, `0` | pin 13, vcc 5, rOut 25 Ω | maxI 0.04 A | ATmega328P I/O: 40 mA abs max, 20 mA recommended |
| `R1` | R | `p13`, `a` | 220 Ω | maxP 0.25 W | |
| `LED1` | LED | `a`, `0` | color: red | maxI 0.03 A, maxV 5 V | 20 mA continuous, 30 mA abs max, 5 V reverse |

Expected with pin HIGH: I = (5 − 1.8)/(220 + 25) ≈ 13 mA; P(R1) ≈ 37 mW.

## Sketch

```cpp
// Blink: pin 13 drives a red LED through 220 ohms
const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED on");
  delay(500);
  digitalWrite(LED_PIN, LOW);
  Serial.println("LED off");
  delay(500);
}
```

`pins: {13: 'PIN13'}`, `vcc: 5`, `board: 'uno'`.

## Readouts

| label | source | unit |
|---|---|---|
| LED CURRENT | `{kind:'current', elementId:'LED1'}` | A |
| PIN 13 | `{kind:'voltage', node:'p13'}` | V |
| LED Vf | `{kind:'voltage', node:'a'}` | V |
| R1 POWER | `{kind:'power', elementId:'R1'}` | W |

## Tweaks

| label | elementId | key | min | max | step | log | unit |
|---|---|---|---|---|---|---|---|
| Series resistor | `R1` | value | 47 | 2200 | — | yes | Ω |

Below about 135 Ω the LED passes 20 mA; below about 50 Ω the pin passes 40 mA.

## Status lines

- `{when:{kind:'pin', pin:13, level:1}, text:'RUNNING: pin 13 HIGH, ≈ 13 mA through the LED'}`
- `{when:{kind:'above', readout:0, value:0.02}, text:'WARNING: LED above its 20 mA continuous rating'}`

## Failures

### F1: Leave the resistor out (jumper in its place)
- **Patch:** `{op:'short', a:'p13', b:'a'}`
- **Sim shows:** current jumps above 100 mA; within 300 ms the LED burns and pin 13 is marked dead (> 40 mA).
- **Why:** only the pin's ≈ 25 Ω output resistance limits the current: (5 − ~2)/25 ≈ 120 mA. Both parts are destroyed, and a dead pin can't be fixed.

### F2: 22 Ω fitted instead of 220 Ω (red-red-black)
- **Patch:** `{op:'set', elementId:'R1', key:'value', value:22}`
- **Sim shows:** ≈ 68 mA; LED burns, pin dead.
- **Why:** I = 3.2/(22 + 25) = 68 mA. A black third band instead of brown is a factor of ten.

### F3: LED in backwards
- **Patches:** `{op:'remove', elementId:'LED1'}`, `{op:'add', element:{id:'LED1', type:'LED', nodes:['0','a'], color:'red', rating:{maxI:0.03, maxV:5}}}`
- **Sim shows:** LED dark, current ≈ 0, node `a` at 5 V when the pin is HIGH.
- **Why:** reverse-biased, the LED blocks. 5 V sits exactly at its reverse-voltage rating, so it survives here but has no margin. Reversed LEDs on higher supplies do get damaged.

## Meet the board

An LED is a diode that emits light. Below its forward voltage (≈ **1.8 V** for red, 2.0 yellow, 2.1 green, 2.9 blue or white at 20 mA) it barely conducts. Just above it, current rises steeply. You can't set an LED's current with voltage, so you put a resistor in series and let it do the job.

**KVL around the loop** (pin HIGH):

5 V = I·(R_pin + R1) + V_f, so I = (5 − 1.8)/(25 + 220) = **13 mA**

**Sizing for a target.** Ignoring R_pin, R = (V_s − V_f)/I. For 10 mA: (5 − 1.8)/0.010 = 320 Ω, so fit **330 Ω**. For a blue LED on 220 Ω: (5 − 2.9)/245 ≈ **8.6 mA**, dimmer because it has less headroom.

**Power.** P_R1 = I²R = 0.013² × 220 ≈ **37 mW**, well inside 1/4 W.

**MCU limits.** The ATmega328P allows **40 mA absolute maximum** on any pin. Stay at 20 mA or below for long life and good logic levels. The whole chip's VCC/GND pins are limited to **200 mA**, which limits how many LEDs one chip can drive directly.

Polarity: the long leg is the anode (+). The short leg and the flat on the rim mark the cathode (−).

## For mechanical engineers

> An LED is a relief valve with a cracking pressure (V_f): below it, nothing flows; above it, flow increases enormously for a tiny pressure rise. The resistor is an orifice in series. Once past cracking, the orifice, not the valve, sets the flow, and that's why the current is predictable. **Where it breaks:** an LED's V_f *falls* about 2 mV/°C as it warms. Drive it from a stiff voltage with no resistor and it heats, conducts more and heats further (thermal runaway). Real relief valves don't run away like that.

## Pro tips

1. Modern indicator LEDs are bright at 2–5 mA. Use 1 kΩ on 5 V for indicators, which is cooler, kinder to the pin and less glaring.
2. Never share one resistor between parallel LEDs. V_f mismatch makes one LED hog the current. Give each its own resistor.
3. For more than a few LEDs, drive them through a transistor or a dedicated constant-current driver, and keep the MCU's 200 mA package limit in mind.

## Quiz

1. **What resistor gives a green LED (V_f = 2.1 V) 15 mA from 5 V, ignoring pin resistance?**
   - 140 Ω
   - 193 Ω (use 200 or 220 Ω)
   - 333 Ω
   - 2.1 kΩ
   - **Answer:** 1. *Why:* R = (5 − 2.1)/0.015 = 193 Ω.

2. **A blue LED (V_f = 2.9 V) on pin 13 with 220 Ω (plus 25 Ω pin resistance). What current?**
   - 8.6 mA
   - 2.9 mA
   - 13 mA
   - 20 mA
   - **Answer:** 0. *Why:* I = (5 − 2.9)/245 = 8.6 mA.

3. **What happens if you connect a red LED straight to a 5 V output pin with no resistor?**
   - It glows at a safe 20 mA
   - It doesn't light, because 5 V is above V_f
   - The Arduino limits it in firmware
   - Current is limited only by the pin's internal resistance, so both the LED and the pin are overloaded
   - **Answer:** 3. *Why:* about 120 mA flows, above both the LED's 30 mA and the pin's 40 mA absolute maximums.

4. **What power does the 220 Ω resistor dissipate at 13 mA?**
   - 2.9 mW
   - 0.25 W
   - 37 mW
   - 2.86 W
   - **Answer:** 2. *Why:* P = I²R = 0.013² × 220 ≈ 0.037 W.

## SIM NOTE

- `PIN` has its own internal `vcc`, so toggling `V_USB` (the power element) must also gate the MCU (pins go high-Z when unpowered). This is a bench/MCU integration rule rather than a netlist feature.
