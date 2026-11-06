// T2 · LED and Resistor (video Fig. 02). Source: docs/curriculum/T2/led-resistor.md
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, UNO, bbHole, between, jumper } from '../layout'

// Bench layout: breadboard on the left, Uno on the right with its digital header facing the breadboard.
const BB: [number, number] = [-3.4, 0.2]
const UNO_AT: [number, number] = [4.3, 0]

const r1Left = bbHole(BB, 23, 'c')
const r1Right = bbHole(BB, 27, 'c')
const ledCathode = bbHole(BB, 22, 'e') // LED cathode (−x, flat side) in column 22
const ledAnode = bbHole(BB, 23, 'e') // anode (+x, long leg) shares column 23 with R1's left lead
const pin13 = UNO.digital(UNO_AT, 13)
const gnd = UNO.digital(UNO_AT, 'GND')

const w1 = jumper(pin13, bbHole(BB, 27, 'a'), 'yellow')
const w2 = jumper(gnd, bbHole(BB, 22, 'a'), 'black', 0.9)

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const sketch = `// Blink: pin 13 drives a red LED through 220 ohms
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
`

export const ledResistor: LessonDef = {
  id: 'led-resistor',
  fig: 2,
  track: 'T2',
  title: 'LED and Resistor',
  subtitle: 'Taming the diode',
  tagline: "Pin 13's 5 V minus a red LED's 1.8 V leaves 3.2 V for 220 Ω: about 13 mA, safely under the LED's 20 mA rating.",

  board: {
    name: 'LED-16',
    size: [16, 8.5],
    base: 'breadboard-only',
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], BENCH_Y, UNO_AT[1]],
        mount: 'module',
        label: 'UNO',
        role: 'ATmega328P at 5 V; pin 13 drives the LED. USB brings 5 V from the computer.',
        params: { variant: 'uno', title: 'ATELIER UNO' },
        circuitIds: ['PIN13', 'V_USB'],
      },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', label: 'BREADBOARD', role: 'Holds the LED and resistor.' },
      {
        id: 'r1',
        kind: 'resistor',
        pos: between(r1Left, r1Right),
        mount: 'tht',
        label: 'LIMIT',
        role: 'Drops the extra 3.2 V and sets the current (220 Ω: red-red-brown-gold, 1/4 W).',
        params: { ohms: 220, callout: [0.3, 2.0, -0.3] },
        circuitIds: ['R1'],
      },
      {
        id: 'led1',
        kind: 'led',
        pos: between(ledCathode, ledAnode),
        mount: 'tht',
        label: 'LED',
        role: '5 mm red LED: lights at about 13 mA. Long leg (anode) toward the resistor.',
        params: { color: 'red', callout: [-1.2, 1.5, 0.3] },
        circuitIds: ['LED1'],
      },
      { id: 'w1', kind: 'wire', ...withCallout(w1, [1.8, 1.0, -0.2]), mount: 'offboard', label: 'PIN13', role: 'Pin 13 to the resistor.' },
      { id: 'w2', kind: 'wire', ...withCallout(w2, [1.2, 0.2, 1.2]), mount: 'offboard', label: 'GND', role: 'LED cathode back to Uno GND.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_USB', type: 'V', nodes: ['usb5v', '0'], value: 5, rInternal: 0.1, partId: 'uno' },
      { id: 'PIN13', type: 'PIN', nodes: ['p13', '0'], pin: 13, vcc: 5, rOut: 25, rating: { maxI: 0.04 }, partId: 'uno' },
      { id: 'R1', type: 'R', nodes: ['p13', 'a'], value: 220, rating: { maxP: 0.25 }, partId: 'r1' },
      { id: 'LED1', type: 'LED', nodes: ['a', '0'], color: 'red', rating: { maxI: 0.03, maxV: 5 }, partId: 'led1' },
    ],
  },
  powerElementId: 'V_USB',
  powerLabel: 'Plug USB',

  readouts: [
    { label: 'LED CURRENT', source: { kind: 'current', elementId: 'LED1' }, unit: 'A' },
    { label: 'PIN 13', source: { kind: 'voltage', node: 'p13' }, unit: 'V' },
    { label: 'LED Vf', source: { kind: 'voltage', node: 'a' }, unit: 'V' },
    { label: 'R1 POWER', source: { kind: 'power', elementId: 'R1' }, unit: 'W' },
  ],

  sketch: { title: 'Blink', code: sketch, pins: { 13: 'PIN13' }, vcc: 5, board: 'uno' },

  tweaks: [{ label: 'Series resistor', elementId: 'R1', key: 'value', min: 47, max: 2200, log: true, unit: 'Ω' }],

  statusLines: [
    { when: { kind: 'pin', pin: 13, level: 0 }, text: 'RUNNING: pin 13 LOW, no current, LED dark' },
    { when: { kind: 'pin', pin: 13, level: 1 }, text: 'RUNNING: pin 13 HIGH, ≈ 13 mA through the LED' },
    { when: { kind: 'above', readout: 0, value: 0.02 }, text: 'WARNING: LED above its 20 mA continuous rating' },
  ],

  failures: [
    {
      id: 'no-resistor',
      label: 'Leave the resistor out (jumper in its place)',
      explain:
        "Only the pin's ≈ 25 Ω output resistance limits the current: (5 − ~2)/25 ≈ 120 mA. Both parts are destroyed, and a dead pin can't be fixed.",
      patches: [{ op: 'short', a: 'p13', b: 'a' }],
    },
    {
      id: 'r-22',
      label: '22 Ω fitted instead of 220 Ω (red-red-black)',
      explain: 'I = 3.2/(22 + 25) = 68 mA. A black third band instead of brown is a factor of ten.',
      patches: [{ op: 'set', elementId: 'R1', key: 'value', value: 22 }],
    },
    {
      id: 'led-reversed',
      label: 'LED in backwards',
      explain:
        'Reverse-biased, the LED blocks. 5 V sits exactly at its reverse-voltage rating, so it survives here but has no margin. Reversed LEDs on higher supplies do get damaged.',
      patches: [
        { op: 'remove', elementId: 'LED1' },
        { op: 'add', element: { id: 'LED1', type: 'LED', nodes: ['0', 'a'], color: 'red', rating: { maxI: 0.03, maxV: 5 }, partId: 'led1' } },
      ],
    },
  ],

  meet: `An LED is a diode that emits light. Below its forward voltage (≈ **1.8 V** for red, 2.0 yellow, 2.1 green, 2.9 blue or white at 20 mA) it barely conducts. Just above it, current rises steeply. You can't set an LED's current with voltage, so you put a resistor in series and let it do the job.

**KVL around the loop** (pin HIGH):

5 V = I·(R_pin + R1) + V_f, so I = (5 − 1.8)/(25 + 220) = **13 mA**

**Sizing for a target.** Ignoring R_pin, R = (V_s − V_f)/I. For 10 mA: (5 − 1.8)/0.010 = 320 Ω, so fit **330 Ω**. For a blue LED on 220 Ω: (5 − 2.9)/245 ≈ **8.6 mA**, dimmer because it has less headroom.

**Power.** P_R1 = I²R = 0.013² × 220 ≈ **37 mW**, well inside 1/4 W.

**MCU limits.** The ATmega328P allows **40 mA absolute maximum** on any pin. Stay at 20 mA or below for long life and good logic levels. The whole chip's VCC/GND pins are limited to **200 mA**, which limits how many LEDs one chip can drive directly.

Polarity: the long leg is the anode (+). The short leg and the flat on the rim mark the cathode (−).`,

  mechanicalAnalogy: `An LED is a relief valve with a cracking pressure (V_f): below it, nothing flows; above it, flow increases enormously for a tiny pressure rise. The resistor is an orifice in series. Once past cracking, the orifice, not the valve, sets the flow, and that's why the current is predictable.

**Where it breaks:** an LED's V_f *falls* about 2 mV/°C as it warms. Drive it from a stiff voltage with no resistor and it heats, conducts more and heats further (thermal runaway). Real relief valves don't run away like that.`,

  proTips: [
    'Modern indicator LEDs are bright at 2–5 mA. Use 1 kΩ on 5 V for indicators, which is cooler, kinder to the pin and less glaring.',
    'Never share one resistor between parallel LEDs. V_f mismatch makes one LED hog the current. Give each its own resistor.',
    "For more than a few LEDs, drive them through a transistor or a dedicated constant-current driver, and keep the MCU's 200 mA package limit in mind.",
  ],

  quiz: [
    {
      q: 'What resistor gives a green LED (V_f = 2.1 V) 15 mA from 5 V, ignoring pin resistance?',
      options: ['140 Ω', '193 Ω (use 200 or 220 Ω)', '333 Ω', '2.1 kΩ'],
      answer: 1,
      why: 'R = (5 − 2.1)/0.015 = 193 Ω.',
    },
    {
      q: 'A blue LED (V_f = 2.9 V) on pin 13 with 220 Ω (plus 25 Ω pin resistance). What current?',
      options: ['8.6 mA', '2.9 mA', '13 mA', '20 mA'],
      answer: 0,
      why: 'I = (5 − 2.9)/245 = 8.6 mA.',
    },
    {
      q: 'What happens if you connect a red LED straight to a 5 V output pin with no resistor?',
      options: [
        'It glows at a safe 20 mA',
        "It doesn't light, because 5 V is above V_f",
        'The Arduino limits it in firmware',
        "Current is limited only by the pin's internal resistance, so both the LED and the pin are overloaded",
      ],
      answer: 3,
      why: "About 120 mA flows, above both the LED's 30 mA and the pin's 40 mA absolute maximums.",
    },
    {
      q: 'What power does the 220 Ω resistor dissipate at 13 mA?',
      options: ['2.9 mW', '0.25 W', '37 mW', '2.86 W'],
      answer: 2,
      why: 'P = I²R = 0.013² × 220 ≈ 0.037 W.',
    },
  ],
}
