// T4 · Interrupts and Timers. Source: docs/curriculum/T4/interrupts-timers.md
//
// A Hall tachometer on pin 3 (INT1) and a bouncy button on pin 2 (INT0) feed one sketch that counts
// the tach with an ISR, polls the same pin for comparison, debounces the button in hardware (RC)
// and software, and blinks L from Timer1. Three behaviors drive it (src/engine/behaviors):
//   tach-gen    the wheel: timestamped falling edges on pin 3, an ISR-capacity limit, and a floating
//               input when the pull-up is missing
//   irq-bounce  the button: the contact chatters, the 1 kΩ + 1 µF filter is solved exactly, and the
//               pin 2 edges that survive are injected at their microsecond
//   timerone    the TimerOne library (`Timer1.initialize`, `attachInterrupt`)
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, PITCH, UNO, bbHole, between, jumper } from '../layout'

const BB: [number, number] = [-2.5, 2.0]
const UNO_AT: [number, number] = [4.3, 2.0]
const HALL_AT: [number, number] = [-4.6, -2.7]
const WHEEL_AT: [number, number] = [-1.5, -2.9]

const h = (col: number, row: string) => bbHole(BB, col, row)
const BB_Y = h(1, 'a')[1]
const BTN_X = BB[0] + (10 - 15.5) * PITCH // centre column 10: legs in columns 9 (to the resistor) and 11 (ground)

/** the Uno's power header (rot 0: it faces +x); k: NC IOREF RESET 3V3 5V GND GND VIN */
const unoPower = (k: number): [number, number, number] => [UNO_AT[0] + 2.4, UNO.headerY, UNO_AT[1] - (-0.35 + (k - 3.5) * PITCH)]
/** the Hall module's three leads: VCC, GND, OUT */
const hallLead = (i: number): [number, number, number] => [HALL_AT[0] + (i - 1) * PITCH, BENCH_Y + 0.4, HALL_AT[1] + 0.4]

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const w2 = jumper(UNO.digital(UNO_AT, 2), h(5, 'a'), 'blue', 0.9)
const w3 = jumper(UNO.digital(UNO_AT, 3), h(20, 'a'), 'orange', 1.0)
const wGnd = jumper(UNO.digital(UNO_AT, 'GND'), h(2, '-t'), 'black', 0.6)
const w5v = jumper(unoPower(4), h(3, '+t'), 'red', 2.0)
const jBtnGnd = jumper(h(11, 'a'), h(11, '-t'), 'black', 0.12)
const jPull5v = jumper(h(24, 'a'), h(24, '+t'), 'red', 0.12)
const wHallVcc = jumper(hallLead(0), h(26, '+t'), 'red', 0.6)
const wHallGnd = jumper(hallLead(1), h(27, '-t'), 'black', 0.5)
const wHallOut = jumper(hallLead(2), h(20, 'b'), 'orange', 0.7)

const SKETCH = `#include <TimerOne.h>

#define LOOP_DELAY 1      // try 300: polling misses taps and pulses, the ISR does not

volatile unsigned long tachCount = 0;    // shared with the ISRs: volatile
volatile unsigned long buttonEdges = 0;
volatile bool ledState = false;

unsigned long presses = 0;      // debounced, counted by polling
unsigned long polled = 0;       // tach pulses the loop happened to see
unsigned long lastPolled = 0;
unsigned long lastPrint = 0;
unsigned long lastTach = 0;
unsigned long lastChange = 0;
int lastRaw = HIGH;
int stable = HIGH;
int lastLevel = HIGH;

void onTach() {            // INT1: keep it to a few instructions
  tachCount++;
}

void onButton() {          // INT0: counts every edge, bounce included
  buttonEdges++;
}

void onTimer() {           // Timer1 compare: every 0.5 s
  ledState = !ledState;
  digitalWrite(13, ledState);
}

void setup() {
  pinMode(13, OUTPUT);
  pinMode(2, INPUT_PULLUP);
  pinMode(3, INPUT);       // external 10k pull-up
  Serial.begin(115200);
  attachInterrupt(digitalPinToInterrupt(3), onTach, FALLING);
  attachInterrupt(digitalPinToInterrupt(2), onButton, FALLING);
  Timer1.initialize(500000);        // 500 000 us = 0.5 s -> LED at 1 Hz
  Timer1.attachInterrupt(onTimer);  // note: TimerOne takes over PWM on 9/10
  delay(100);                       // the 1 uF fills through the pull-up (about 35 ms)
  lastRaw = digitalRead(2);         // start the debounce from the settled level
  stable = lastRaw;
}

void loop() {
  // Software debounce by polling: accept a level only after 20 ms of quiet.
  int raw = digitalRead(2);
  if (raw != lastRaw) {
    lastChange = millis();
    lastRaw = raw;
  }
  if (millis() - lastChange > 20 && raw != stable) {
    stable = raw;
    if (stable == LOW) {
      presses++;
    }
  }

  // Count the tach by polling too: a falling edge is HIGH then LOW.
  int level = digitalRead(3);
  if (level == LOW && lastLevel == HIGH) {
    polled++;
  }
  lastLevel = level;

  if (millis() - lastPrint >= 1000) {
    lastPrint += 1000;
    noInterrupts();                 // copy multi-byte volatiles atomically
    unsigned long t = tachCount;
    unsigned long e = buttonEdges;
    interrupts();
    unsigned long hz = t - lastTach;
    lastTach = t;
    Serial.print("tach_hz:");
    Serial.print(hz);
    Serial.print(",rpm:");
    Serial.print(hz * 60);
    Serial.print(",poll_hz:");
    Serial.print(polled - lastPolled);
    lastPolled = polled;
    Serial.print(",presses:");
    Serial.print(presses);
    Serial.print(",isr_edges:");
    Serial.println(e);
  }
  delay(LOOP_DELAY);
}
`

export const lesson: LessonDef = {
  id: 'interrupts-timers',
  track: 'T4',
  title: 'Interrupts and Timers',
  subtitle: 'Never miss an edge',
  tagline: 'An Uno answers a pin change within a few microseconds, but delay(1000) leaves the loop blind for a million of them: interrupts let the hardware do the watching.',

  board: {
    name: 'IRQ BENCH',
    size: [18, 11],
    base: 'breadboard-only',
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], BENCH_Y, UNO_AT[1]],
        mount: 'module',
        label: 'UNO',
        role: 'ATmega328P at 16 MHz. INT0 is on pin 2 and INT1 on pin 3. Timer1 blinks L from an interrupt.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [1.4, 1.6, -0.2] },
        facts: [
          'INT0 = PD2 (pin 2), INT1 = PD3 (pin 3)',
          'Timer1 is a 16-bit counter, clocked from 16 MHz through a prescaler',
          'Interrupt response: 4 clock cycles minimum (0.25 µs at 16 MHz), then the vector jump',
          'VIL 0.3 VCC max, VIH 0.6 VCC min (VCC 2.4 V to 5.5 V)',
          'Internal pull-up 20 kΩ to 50 kΩ',
          'Absolute max on a pin: VCC + 0.5 V',
        ],
        circuitIds: ['pin2', 'pin3', 'pin13', 'v_usb', 'f1', 'i_board'],
      },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the debounce filter, the button and the tach pull-up.' },
      {
        id: 'r_rc',
        kind: 'resistor',
        pos: between(h(5, 'c'), h(9, 'c')),
        mount: 'tht',
        label: 'RC 1k',
        role: 'Series part of the debounce filter: 1 kΩ (brown-black-red-gold).',
        params: { ohms: 1000, callout: [0.2, 1.5, -0.3] },
        circuitIds: ['r_rc'],
      },
      {
        id: 'c_rc',
        kind: 'capacitor-ceramic',
        pos: between(h(5, 'd'), h(5, '-t')),
        mount: 'tht',
        label: 'RC 1µF',
        role: 'Smooths the chatter. τ on a press is 1 kΩ × 1 µF = 1 ms. On release it charges through the internal pull-up (about 35 kΩ in this model), so τ ≈ 35 ms.',
        color: '#d9a441',
        params: { farads: 1e-6, code: '105', callout: [-0.6, 1.4, 0.4] },
        circuitIds: ['c_rc'],
        facts: ['Pin 2 reads LOW below 0.3 VCC (1.5 V) and HIGH above 0.6 VCC (3.0 V)'],
      },
      {
        id: 'btn',
        kind: 'button',
        pos: [BTN_X, BB_Y, BB[1]],
        rot: 90,
        mount: 'offboard',
        label: 'BOUNCY BUTTON',
        role: 'A 6 mm tactile button on pin 2. Its metal dome chatters for a few ms on every press and every release.',
        params: { callout: [0.4, 1.5, 0.6] },
        circuitIds: ['sw_btn'],
      },
      {
        id: 'r_pull',
        kind: 'resistor',
        pos: between(h(20, 'c'), h(24, 'c')),
        mount: 'tht',
        label: 'PULL-UP',
        role: 'Gives the open-collector tach output a HIGH level: 10 kΩ from 5 V to pin 3 (brown-black-orange-gold).',
        params: { ohms: 10000, callout: [0.3, 1.5, 0.6] },
        circuitIds: ['r_pull'],
        facts: ['5 V / 10 kΩ = 0.5 mA when the sensor pulls the line low'],
      },
      {
        id: 'hall',
        kind: 'module',
        pos: [HALL_AT[0], BENCH_Y, HALL_AT[1]],
        mount: 'offboard',
        label: 'TACH',
        role: 'An A3144-type Hall sensor. It pulls its open-collector output low each time a magnet on the wheel passes: one pulse per revolution.',
        params: { w: 1.3, d: 0.9, pins: 0, chip: 'none', title: 'HALL A3144', color: '#2a3a52', callout: [-0.4, 1.5, -0.3] },
        facts: [
          'Supply 4.5 V to 24 V',
          'Open-collector output sinks 25 mA max, switches 24 V max',
          'Needs a pull-up: it can only pull the line low',
        ],
        circuitIds: ['tach_sw'],
      },
      {
        id: 'wheel',
        kind: 'dc-motor',
        pos: [WHEEL_AT[0], BENCH_Y, WHEEL_AT[1]],
        mount: 'offboard',
        label: 'TEST WHEEL',
        role: 'A wheel with one magnet. The sensor sees one pulse per turn, so pulses per second equal revolutions per second. Set its speed with the Wheel speed slider.',
        params: { callout: [0.4, 1.5, -0.3] },
      },
      { id: 'w2', kind: 'wire', ...withCallout(w2, [1.0, 1.0, -0.3]), mount: 'offboard', label: 'PIN 2', role: 'Pin 2 (INT0) to the node between the 1 kΩ and the 1 µF.' },
      { id: 'w3', kind: 'wire', ...w3, mount: 'offboard', role: 'Pin 3 (INT1) to the tach output and the pull-up.' },
      { id: 'wGnd', kind: 'wire', ...wGnd, mount: 'offboard', role: 'Uno GND to the top ground rail.' },
      { id: 'w5v', kind: 'wire', ...w5v, mount: 'offboard', role: 'Uno 5V to the top + rail.' },
      { id: 'jBtnGnd', kind: 'wire', ...jBtnGnd, mount: 'offboard', role: 'The button’s other leg to ground.' },
      { id: 'jPull5v', kind: 'wire', ...jPull5v, mount: 'offboard', role: 'The pull-up’s upper end to 5 V.' },
      { id: 'wHallVcc', kind: 'wire', ...wHallVcc, mount: 'offboard', role: 'Hall sensor supply, 5 V.' },
      { id: 'wHallGnd', kind: 'wire', ...wHallGnd, mount: 'offboard', role: 'Hall sensor ground.' },
      { id: 'wHallOut', kind: 'wire', ...wHallOut, mount: 'offboard', role: 'Hall output to the pull-up node.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5.0, rInternal: 0.3, partId: 'uno' },
      // the power element: "Plug USB" enables it
      { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', 'vbus_in'], closed: true, partId: 'uno' },
      { id: 'f1', type: 'R', nodes: ['vbus_in', '5v'], value: 0.3, rating: { maxI: 1.0 }, partId: 'uno' },
      // the whole Uno, about 45 mA at 5 V, lumped as a resistor; 6 V is the 328P's absolute maximum
      { id: 'i_board', type: 'R', nodes: ['5v', '0'], value: 110, rating: { maxV: 6.0 }, partId: 'uno' },
      // pin 2: INPUT_PULLUP (the engine's pull-up is about 35 kΩ; the datasheet says 20 to 50 kΩ)
      { id: 'pin2', type: 'PIN', nodes: ['d2', '0'], pin: 2, vcc: 5, vccNode: '5v', partId: 'uno' },
      { id: 'r_rc', type: 'R', nodes: ['btn_n', 'd2'], value: 1000, partId: 'r_rc' },
      { id: 'c_rc', type: 'C', nodes: ['d2', '0'], value: 1e-6, rating: { maxV: 16 }, partId: 'c_rc' },
      { id: 'sw_btn', type: 'SW', nodes: ['btn_n', '0'], closed: false, partId: 'btn' },
      // pin 3: INPUT with an external pull-up. 5.5 V is VCC + 0.5 V, the absolute maximum
      { id: 'pin3', type: 'PIN', nodes: ['d3', '0'], pin: 3, vcc: 5, vccNode: '5v', rating: { maxV: 5.5 }, partId: 'uno' },
      { id: 'r_pull', type: 'R', nodes: ['5v', 'd3'], value: 10000, partId: 'r_pull' },
      // A3144-class open-collector output, driven by tach-gen for the LED and the scope
      { id: 'tach_sw', type: 'SW', nodes: ['d3', '0'], closed: false, rating: { maxI: 0.025 }, partId: 'hall' },
      // pin 13 through the Uno's LED buffer
      { id: 'pin13', type: 'PIN', nodes: ['d13', '0'], pin: 13, vcc: 5, vccNode: '5v', partId: 'uno' },
      { id: 'u5a', type: 'OPAMP', nodes: ['d13', 'lbuf', 'lbuf'], vPos: 5, vNeg: 0, partId: 'uno' },
      { id: 'r_l', type: 'R', nodes: ['lbuf', 'l_a'], value: 1000, partId: 'uno' },
      { id: 'led_l', type: 'LED', nodes: ['l_a', '0'], color: 'yellow', rating: { maxI: 0.02 }, partId: 'uno' },
    ],
  },
  powerElementId: 'usb_plug',
  powerLabel: 'Plug USB',
  transient: true,

  behaviors: [
    { id: 'tach-gen', instance: 'tach', params: { hz: 50, pin: 3, isrUs: 5 } },
    { id: 'irq-bounce', instance: 'bounce', params: { press: 0, pin: 2, seed: 3 } },
    { id: 'timerone', instance: 't1' },
    { id: 'mcu-supply', instance: 'mcu', params: { supplyNode: '5v', bor: 2.7, fClk: 16 } },
    { id: 'serial-plotter', instance: 'serial' },
  ],

  readouts: [
    { label: 'TACH (TRUE)', source: { kind: 'behavior', key: 'tach.true_hz' }, unit: 'Hz' },
    { label: 'TACH (COUNTED)', source: { kind: 'behavior', key: 'serial.tach_hz' }, unit: 'Hz' },
    { label: 'SHAFT SPEED', source: { kind: 'behavior', key: 'serial.rpm' }, unit: 'rpm' },
    { label: 'TACH (POLLED)', source: { kind: 'behavior', key: 'serial.poll_hz' }, unit: 'Hz' },
    { label: 'PRESSES (DEBOUNCED)', source: { kind: 'behavior', key: 'serial.presses' }, unit: '', digits: 1 },
    { label: 'ISR EDGES (PIN 2)', source: { kind: 'behavior', key: 'serial.isr_edges' }, unit: '', digits: 1 },
    { label: 'PIN 2', source: { kind: 'voltage', node: 'd2' }, unit: 'V' },
    { label: 'DROPPED EDGES', source: { kind: 'behavior', key: 'tach.dropped' }, unit: '', digits: 1 },
    { label: 'L LED', source: { kind: 'current', elementId: 'led_l' }, unit: 'A' },
    { label: 'EXTRA EDGES', source: { kind: 'derived', op: 'diff', of: [5, 4] }, unit: '', digits: 1 },
  ],

  // Hold the button: the scope catches pin 2 falling through the RC (the VIL and VIH lines are the
  // datasheet thresholds) while pin 3 shows the tach pulses on the same time base. The chart
  // compares the true wheel rate with what the ISR and the polling loop counted.
  instruments: {
    open: true,
    scope: {
      channels: [
        { label: 'PIN 3 TACH', source: { kind: 'voltage', node: 'd3' }, perDiv: 2, offset: 0.5 },
        {
          label: 'PIN 2 BUTTON',
          source: { kind: 'voltage', node: 'd2' },
          perDiv: 2,
          offset: -3.5,
          marks: [
            { value: 3, label: 'VIH 3.0 V' },
            { value: 1.5, label: 'VIL 1.5 V' },
          ],
        },
      ],
      timePerDiv: 10e-3,
      trigger: { channel: 1, level: 2.5, slope: 'falling', mode: 'normal' },
    },
    chart: { signals: [0, 1, 3], span: 12 },
  },

  sketch: { title: 'Counting edges', code: SKETCH, pins: { 2: 'pin2', 3: 'pin3', 13: 'pin13' }, vcc: 5, board: 'uno' },

  tweaks: [
    { label: 'Wheel speed', elementId: 'behavior:tach', key: 'hz', min: 1, max: 20000, log: true, unit: 'Hz' },
    { label: 'Debounce capacitor', elementId: 'c_rc', key: 'value', min: 1e-8, max: 1e-5, log: true, unit: 'F' },
    { label: 'BUTTON (hold)', elementId: 'behavior:bounce', key: 'press', kind: 'momentary', min: 0, max: 1, unit: '' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: Timer1 toggles L every 0.5 s while the ISRs count pulses. Wheel {0}, counted {1} ({2}), polled {3}.' },
    { when: { kind: 'above', readout: 9, value: 0.5 }, text: 'MISCOUNTING: the ISR saw {5} falling edges for {4} debounced presses. The contact bounced and the interrupt answered every chatter.' },
    { when: { kind: 'above', readout: 7, value: 0 }, text: 'OVERLOAD: edges are arriving faster than the ISR can finish. {7} dropped so far, so the count is lost.' },
  ],

  failures: [
    {
      id: 'no-debounce-cap',
      label: 'Remove the debounce capacitor',
      explain:
        'One press now gives two to six falling edges on pin 2 (and a release can add up to three more), while the polled, 20 ms-debounced count still goes up by exactly 1. A FALLING interrupt fires on every closing of the chattering contact, and it is fast enough to see each one. The 1 kΩ + 1 µF filter (τ = 1 ms on a press) used to hide them, because the capacitor cannot fall below 1.5 V between chatters a few ms apart that open for only a fraction of a ms. Either filter in hardware, or ignore re-triggers inside a time window in software.',
      patches: [{ op: 'remove', elementId: 'c_rc' }],
      parts: { hide: ['c_rc'] },
    },
    {
      id: 'no-pullup',
      label: 'Leave out the tach pull-up',
      explain:
        'With the pull-up gone the tach reads tens to hundreds of Hz of nonsense, even with the wheel crawling at 1 Hz. An A3144-type output is open-collector: it can only pull the line low, so with no resistor the pin floats, picks up mains hum and the switching noise of anything nearby, and every crossing of the input threshold is an edge. Never leave an input floating.',
      patches: [{ op: 'remove', elementId: 'r_pull' }],
      parts: { hide: ['r_pull'] },
    },
    {
      id: 'wheel-300k',
      label: 'Spin the wheel at 300 kHz',
      explain:
        'Each interrupt costs a few microseconds (here 5 µs: 4 cycles of hardware entry plus the Arduino dispatch and your code), so the Uno can take at most about 1 / 5 µs = 200 kHz, and that is before any loop code runs. At 300 kHz an edge arrives every 3.3 µs, the ISR is still busy with the last one, and about every second edge is lost: COUNTED stops near 150 kHz while the wheel reads 300 kHz, and DROPPED EDGES climbs. For pulses this fast use a hardware counter instead: Timer1 can count pulses on its T1 input (pin 5) with no CPU cost.',
      patches: [{ op: 'set', elementId: 'behavior:tach', key: 'hz', value: 300000 }],
    },
  ],

  meet: `**Polling** means \`loop()\` checks a pin whenever it gets around to it. With \`delay(300)\` in the loop, a tap shorter than 300 ms can be missed completely. Try it: change \`LOOP_DELAY\` to 300, upload, and tap the button. An **interrupt** is a hardware alarm: when pin 2 or 3 sees the chosen edge, the CPU stops what it is doing, saves its place and runs your ISR. On the Uno that takes a few µs, and the response does not depend on \`delay()\`.

Watch the two tach counts. At 50 Hz the loop (running every millisecond) polls every pulse, which lasts about 5 ms. Raise the wheel to 2 kHz and each pulse lasts 125 µs: **TACH (POLLED)** collapses, while **TACH (COUNTED)**, the ISR, still reads the true rate.

**Pins and modes.** On the ATmega328P, INT0 is pin 2 and INT1 is pin 3. \`attachInterrupt(digitalPinToInterrupt(pin), isr, mode)\` takes RISING, FALLING or CHANGE (and LOW).

**Rules for ISRs.** Keep them tiny and avoid \`Serial\`, \`delay()\` and long maths. Mark variables they share with the loop \`volatile\`. Copy multi-byte values with interrupts briefly off (\`noInterrupts()\` … \`interrupts()\`), because an 8-bit AVR reads a 32-bit \`unsigned long\` in four pieces and an ISR could change it between two of them.

**Timers** are counters clocked from 16 MHz through a prescaler. Timer1 is 16-bit. For a 2 Hz compare interrupt with prescaler 256: 16 000 000 / 256 = 62 500 ticks per second, so OCR1A = 62 500 / 2 − 1 = **31 249**. The longest Timer1 period before it overflows is 65 536 × 1024 / 16 MHz = **4.19 s**. The TimerOne library does this arithmetic for you, but it takes over PWM on pins 9 and 10 (the Servo library does too).

**Bounce.** The button's contacts chatter for roughly 1 to 5 ms, sometimes longer. With 1 kΩ and 1 µF, the input needs about 1 ms to fall, which swallows the fast chatter. Hold the button with the scope open to see pin 2 slide down through the 1.5 V line instead of snapping. On release it climbs back through the internal pull-up in about 35 ms.

**Rpm from a tach.** With one pulse per revolution, rpm = pulses per second × 60. At 50 Hz that is 3000 rpm. A wheel with 2 magnets would give twice the pulses for the same speed.

*Sim notes:* the wheel's edges and the button's chatter are delivered to the MCU with microsecond timestamps, so the ISRs fire at the right moment even though the circuit is stepped at 1 ms. The cost of an ISR (5 µs here) is a limit on how many edges are accepted, but the sketch's main loop is not slowed down by it, which a real Uno near its limit would be.`,

  mechanicalAnalogy: `Polling is a technician walking the line every few minutes to read gauges. An interrupt is a pressure switch wired to an alarm bell: the moment it trips, someone drops what they are doing. Contact bounce is the bell rattling as the switch settles, like valve chatter. The RC filter is a damper (a snubber orifice) on the gauge line.

**Where it breaks:** a real technician can handle two alarms at once. The AVR runs one ISR at a time, and interrupts that arrive meanwhile wait (or merge into one), so a long ISR delays or loses events.`,

  proTips: [
    'Increment a counter in the ISR and do the maths in loop(). If you think you need Serial.print inside an ISR, set a flag instead.',
    'For speed measurement, choose the method by speed. At low rpm, time the interval between edges with micros() in the ISR (one reading per pulse). At high rpm, count edges over a fixed window. A 1-pulse-per-rev wheel at 60 rpm gives only 1 count per second.',
    'Hall sensors with open-collector outputs usually run happily on 5 V. If they run on 12 V, keep the pull-up on the MCU\'s 5 V rail, not on 12 V. The sensor only ever pulls down.',
  ],

  quiz: [
    {
      q: 'Timer1 with prescaler 1024 on a 16 MHz Uno. What is the longest period before it overflows?',
      options: ['4.1 ms', '65.5 ms', '1.05 s', '4.19 s'],
      answer: 3,
      why: '65 536 counts × 1024 / 16 000 000 Hz = 4.19 s.',
    },
    {
      q: 'A hall tach gives 2 pulses per revolution and you count 120 pulses in one second. What is the shaft speed?',
      options: ['60 rpm', '120 rpm', '3600 rpm', '7200 rpm'],
      answer: 2,
      why: '120 / 2 = 60 rev/s, and 60 rev/s × 60 = 3600 rpm.',
    },
    {
      q: 'Printing a 30-character line at 9600 baud takes about how long, and why does that matter inside an ISR?',
      options: ['3 µs: it doesn\'t matter', '0.3 ms: it barely matters', '31 ms: it blocks every other interrupt meanwhile', '3 s: Serial never works'],
      answer: 2,
      why: 'Each character is 10 bits (start, 8 data, stop), so 30 × 10 / 9600 ≈ 31 ms. During that time other interrupts wait, and Serial may even deadlock inside an ISR.',
    },
    {
      q: 'Why must tachCount be declared volatile?',
      options: [
        'It makes the variable faster',
        'It stops the compiler caching it in a register, because the ISR can change it at any moment',
        'It disables interrupts automatically',
        'It makes 32-bit reads atomic',
      ],
      answer: 1,
      why: 'volatile forces a fresh memory read each time. It does not make multi-byte reads atomic; the noInterrupts() / interrupts() pair does that.',
    },
  ],
}
