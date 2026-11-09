// T3 · ADC, DAC and PWM. Source: docs/curriculum/T3/adc-dac-pwm.md (see docs/decisions.md for what changed)
//
// An Uno (ATmega328P, 5 V from USB) on a breadboard:
//   * a 10 kΩ pot (POT1) is a divider from 5 V to GND whose wiper goes to A0; the sketch reads it with the
//     10-bit ADC and writes duty = raw / 4 on pin 9 (analogWrite, 490 Hz);
//   * pin 9 feeds a 10 kΩ + 10 µF RC low-pass (R_F, C_F), the "fake DAC". PIN9 has `vccNode: '5v'`, so the
//     transient really switches it high and low at its edge times (sim/pwm.ts): the scope shows the raw 0/5 V
//     square wave next to the filtered level, and the `ac-meter` reads the true peak-to-peak ripple;
//   * a slide switch (SW_LOAD) hangs a 1 kΩ load on the filter output: the failure "load the filter";
//   * a small signal source (V_SIG, 1 kΩ behind it) goes to A1. A slide switch on pin 2 (INPUT_PULLUP)
//     makes the sketch call analogReference(INTERNAL) for the A1 read, so one LSB shrinks from 4.88 mV to
//     1.07 mV. The knob is always read against the 5 V reference;
//   * the shared behaviors: `pot-knob` (the knob in %), `serial-plotter` (the sketch's counts as readouts),
//     `ac-meter` (channel A = filtered node, B = raw pin 9) and `pwm-filter` (fc, tau and the closed-form ripple).
// The ADC in the engine returns round(V / Vref × 1023); the ATmega328P datasheet defines floor(V × 1024 / Vref).
// They differ by at most 1 LSB, inside the chip's own ±2 LSB absolute accuracy.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, PITCH, UNO, bbHole, between, jumper } from '../layout'

// Uno at the back (header sockets on its left and right edges), breadboard in front, so every wire runs
// front to back and none crosses the board.
const UNO_AT: [number, number] = [0, -2.6]
const BB: [number, number] = [0, 3.5]
const SIG_AT: [number, number] = [5.8, -2.2]

const UNO_HDR_Y = UNO.headerY
/** analog socket A0..A5 (the +x edge, A0 toward the viewer) */
const unoAnalog = (i: number): [number, number, number] => [UNO_AT[0] + 2.4, UNO_HDR_Y, UNO_AT[1] - (1.95 + (i - 2.5) * PITCH)]
/** power socket NC IOREF RESET 3V3 5V GND GND VIN (k = 0..7) */
const unoPower = (k: number): [number, number, number] => [UNO_AT[0] + 2.4, UNO_HDR_Y, UNO_AT[1] - (-0.35 + (k - 3.5) * PITCH)]
const h = (col: number, row: string) => bbHole(BB, col, row)
/** hole tops: parts pushed into the breadboard stand here */
const BB_Y = h(1, 'a')[1]

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const sigPlus: [number, number, number] = [SIG_AT[0] - 0.6, BENCH_Y + 0.3, SIG_AT[1] - 0.3]
const sigMinus: [number, number, number] = [SIG_AT[0] - 0.6, BENCH_Y + 0.3, SIG_AT[1] + 0.3]

const w9 = withCallout(jumper(UNO.digital(UNO_AT, 9), h(7, 'a'), 'yellow', 0.9), [0, 0.5, 0.2])
const w2 = jumper(UNO.digital(UNO_AT, 2), h(2, 'a'), 'blue', 0.8)
const wA0 = withCallout(jumper(unoAnalog(0), h(25, 'b'), 'green', 0.9), [0, 0.5, 0.2])
const wA1 = jumper(unoAnalog(1), sigPlus, 'orange', 0.5)
const w5v = jumper(unoPower(4), h(28, '+t'), 'red', 0.6)
const wGnd = jumper(unoPower(5), h(29, '-t'), 'black', 0.5)
const wSigGnd = jumper(unoPower(6), sigMinus, 'black', 0.4)
const wRefGnd = jumper(h(4, 'a'), h(4, '-t'), 'black', 0.12)
const wCapGnd = jumper(h(12, 'a'), h(12, '-t'), 'black', 0.12)
const wLoadGnd = jumper(h(20, 'a'), h(20, '-t'), 'black', 0.12)
const wPot5v = jumper(h(24, 'a'), h(24, '+t'), 'red', 0.12)
const wPotGnd = jumper(h(26, 'a'), h(26, '-t'), 'black', 0.12)
const wLoad = jumper(h(11, 'b'), h(14, 'b'), 'white', 0.3)

const R_RATING = { maxP: 0.25, maxV: 250 }

/** ATmega328P datasheet figures (ADC characteristics, internal reference, I/O) plus the Arduino core's PWM settings */
const MCU_FACTS = [
  'ATmega328P ADC: 10-bit, successive approximation, 0 V to VREF. Absolute accuracy about ±2 LSB at a 200 kHz ADC clock (INL ±0.5 LSB, DNL ±0.25 LSB typ.)',
  'Internal reference: 1.1 V nominal (1.0 V min, 1.2 V max). AREF may be 1.0 V up to AVCC. The datasheet asks for a source impedance of about 10 kΩ or less',
  'The Arduino core runs the ADC at 125 kHz: one analogRead takes about 104 µs (13 ADC clocks)',
  'analogWrite is 8-bit: 490 Hz on pins 3, 9, 10, 11 (timers 1 and 2, phase-correct) and 980 Hz on pins 5 and 6 (timer 0, fast PWM)',
  'Absolute maximum 40 mA per I/O pin',
]

const sketch = `// ADC in, PWM out. The knob on A0 sets the duty on pin 9;
// A1 reads a small signal against 5 V or against the internal 1.1 V reference.
const int KNOB = A0;
const int SENSOR = A1;
const int OUT_PIN = 9;       // ~490 Hz PWM, into the RC filter
const int REF_SWITCH = 2;    // closed (LOW) = measure A1 against the internal 1.1 V

void setup() {
  pinMode(OUT_PIN, OUTPUT);
  pinMode(REF_SWITCH, INPUT_PULLUP);
  Serial.begin(9600);
}

void loop() {
  // The knob always uses the 5 V reference: 1 LSB = 5/1024 = 4.88 mV.
  analogReference(DEFAULT);
  int raw = analogRead(KNOB);       // 0..1023
  int duty = raw / 4;               // 0..255
  analogWrite(OUT_PIN, duty);       // average = duty/255 x 5 V

  // The sensor: 1.1 V full scale makes one LSB 1.07 mV.
  float vref = 5.0;
  if (digitalRead(REF_SWITCH) == LOW) {
    analogReference(INTERNAL);
    vref = 1.1;
  } else {
    analogReference(DEFAULT);
  }
  analogRead(SENSOR);               // throw one away: the reference needs a moment to settle
  int s = analogRead(SENSOR);
  float mv = s * vref * 1000.0 / 1024.0;

  Serial.print("knob:");
  Serial.print(raw);
  Serial.print(",duty:");
  Serial.print(duty);
  Serial.print(",sensor:");
  Serial.print(s);
  Serial.print(",mV:");
  Serial.println(mv);
  delay(50);
}
`

export const lesson: LessonDef = {
  id: 'adc-dac-pwm',
  track: 'T3',
  title: 'ADC, DAC and PWM',
  subtitle: 'Between analog and digital',
  tagline: 'A 10-bit ADC splits 5 V into 1024 steps of 4.88 mV, and analogWrite(9, 128) averages to 2.51 V behind a 10 kΩ / 10 µF filter.',

  board: {
    name: 'ADC-25',
    size: [16, 12],
    base: 'breadboard-only',
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], BENCH_Y, UNO_AT[1]],
        mount: 'module',
        label: 'UNO',
        role: 'ATmega328P at 5 V. Its ADC reads A0 (the knob) and A1 (the small signal); pin 9 writes the PWM. USB brings the 5 V.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [-1.6, 0.9, -1.4] },
        circuitIds: ['PIN9', 'PIN2', 'V_USB'],
        facts: MCU_FACTS,
      },
      {
        id: 'sig',
        kind: 'module',
        pos: [SIG_AT[0], BENCH_Y, SIG_AT[1]],
        mount: 'offboard',
        label: 'SIGNAL',
        role: 'A small signal source, 0 to 1.5 V, with 1 kΩ behind it: a stand-in for a thermocouple amplifier or a shunt. At 5 V full scale a 300 mV signal is only 61 counts; against the 1.1 V reference it is 279.',
        params: { w: 2.0, d: 1.3, color: '#3b4250', title: 'SIGNAL 0-1.5 V', pins: 0, callout: [0.2, 1.2, 0.2] },
        circuitIds: ['V_SIG'],
      },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the filter, the knob and the switches.' },
      {
        id: 'swref',
        kind: 'switch-slide',
        pos: between(h(2, 'c'), h(4, 'c')),
        mount: 'tht',
        label: 'REF',
        role: 'Pulls pin 2 to ground. Closed: the sketch calls analogReference(INTERNAL) and measures A1 against 1.1 V instead of 5 V.',
        params: { callout: [0, 1.2, 0.5] },
        circuitIds: ['SW_REF', 'PIN2'],
      },
      {
        id: 'rf',
        kind: 'resistor',
        pos: between(h(7, 'c'), h(11, 'c')),
        mount: 'tht',
        label: 'FILTER R',
        role: 'R_F, 10 kΩ (brown-black-orange): the series half of the RC low-pass. With C_F it sets the cutoff, 1/(2π R C), and the time constant R × C.',
        params: { ohms: 10000, callout: [0.2, 1.5, -0.5] },
        circuitIds: ['R_F'],
      },
      {
        id: 'cf',
        kind: 'capacitor-electrolytic',
        pos: between(h(11, 'd'), h(12, 'd')),
        mount: 'tht',
        label: 'SMOOTH',
        role: 'C_F, 10 µF / 16 V electrolytic: the shunt half of the filter. It charges a little in each high pulse and drains a little in each low one, so the voltage on it is the average. Stripe (negative) toward the ground jumper.',
        params: { d: 0.63, h: 1.1, callout: [0.3, 1.8, -0.4] },
        circuitIds: ['C_F'],
      },
      {
        id: 'swload',
        kind: 'switch-slide',
        pos: between(h(14, 'c'), h(16, 'c')),
        mount: 'tht',
        label: 'LOAD',
        role: 'Hangs the 1 kΩ load on the filter output. Open it stays unloaded; closed, the divider R_F against R_LOAD pulls the output down.',
        params: { callout: [0, 1.2, 0.5] },
        circuitIds: ['SW_LOAD'],
      },
      {
        id: 'rload',
        kind: 'resistor',
        pos: between(h(16, 'd'), h(20, 'd')),
        mount: 'tht',
        role: '1 kΩ load (brown-black-red) to ground: about 2.3 mA at 2.3 V, which the 10 kΩ filter resistor cannot supply.',
        params: { ohms: 1000, callout: [0.2, 1.1, 0.5] },
        circuitIds: ['R_LOAD'],
      },
      {
        id: 'pot',
        kind: 'potentiometer',
        pos: [h(25, 'e')[0], BB_Y, h(25, 'e')[2] + 0.4],
        rot: 180,
        mount: 'tht',
        label: 'KNOB',
        role: '10 kΩ linear pot between 5 V and GND: the wiper gives 0 to 5 V into A0. At mid travel the wiper is a 2.5 V source behind 2.5 kΩ, inside the ADC’s 10 kΩ source-impedance advice.',
        params: { callout: [0.6, 1.8, 0.5] },
        circuitIds: ['POT1'],
      },
      { id: 'w9', kind: 'wire', ...w9, mount: 'offboard', role: 'Pin 9 (a ~ PWM pin, 490 Hz) to the filter resistor.' },
      { id: 'w2', kind: 'wire', ...w2, mount: 'offboard', role: 'Pin 2 to the reference switch.' },
      { id: 'wA0', kind: 'wire', ...wA0, mount: 'offboard', role: 'A0 to the pot wiper.' },
      { id: 'wA1', kind: 'wire', ...wA1, mount: 'offboard', role: 'A1 to the small signal source.' },
      { id: 'w5v', kind: 'wire', ...w5v, mount: 'offboard', role: '5 V to the top + rail.' },
      { id: 'wGnd', kind: 'wire', ...wGnd, mount: 'offboard', role: 'GND to the top − rail.' },
      { id: 'wSigGnd', kind: 'wire', ...wSigGnd, mount: 'offboard', role: 'Signal source ground back to the Uno GND.' },
      { id: 'jRefGnd', kind: 'wire', ...wRefGnd, mount: 'offboard', role: 'Reference switch to the ground rail.' },
      { id: 'jCapGnd', kind: 'wire', ...wCapGnd, mount: 'offboard', role: 'C_F negative lead to the ground rail.' },
      { id: 'jLoadGnd', kind: 'wire', ...wLoadGnd, mount: 'offboard', role: 'Load resistor to the ground rail.' },
      { id: 'jPot5v', kind: 'wire', ...wPot5v, mount: 'offboard', role: 'Pot end to the 5 V rail.' },
      { id: 'jPotGnd', kind: 'wire', ...wPotGnd, mount: 'offboard', role: 'Pot end to the ground rail.' },
      { id: 'jLoad', kind: 'wire', ...wLoad, mount: 'offboard', role: 'The filter output (R_F meets C_F) over to the load switch.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_USB', type: 'V', nodes: ['5v', '0'], value: 5, rInternal: 0.1, partId: 'uno' },
      // pin 9: PWM at 490 Hz. vccNode makes the transient switch it between the 5 V rail and ground
      { id: 'PIN9', type: 'PIN', nodes: ['p9', '0'], pin: 9, vcc: 5, vccNode: '5v', rOut: 25, rating: { maxI: 0.04 }, partId: 'uno' },
      { id: 'PIN2', type: 'PIN', nodes: ['d2', '0'], pin: 2, vcc: 5, vccNode: '5v', partId: 'uno' },
      { id: 'SW_REF', type: 'SW', nodes: ['d2', '0'], closed: false, partId: 'swref' },
      // the knob: 5 V end at col 24, GND end at col 26, pos 0.5 = centred
      { id: 'POT1', type: 'POT', nodes: ['0', 'wiper', '5v'], value: 10000, pos: 0.5, partId: 'pot' },
      { id: 'V_SIG', type: 'V', nodes: ['sig', '0'], value: 0.3, rInternal: 1000, partId: 'sig' },
      // the PWM low-pass: 10 kΩ x 10 µF = 0.1 s, fc = 1.59 Hz
      { id: 'R_F', type: 'R', nodes: ['p9', 'f'], value: 10000, rating: R_RATING, partId: 'rf' },
      { id: 'C_F', type: 'C', nodes: ['f', '0'], value: 10e-6, polarized: true, rating: { maxV: 16 }, partId: 'cf' },
      { id: 'SW_LOAD', type: 'SW', nodes: ['f', 'ld'], closed: false, partId: 'swload' },
      { id: 'R_LOAD', type: 'R', nodes: ['ld', '0'], value: 1000, rating: R_RATING, partId: 'rload' },
    ],
  },
  powerElementId: 'V_USB',
  powerLabel: 'Plug USB',
  transient: true,

  sketch: {
    title: 'Knob to PWM',
    code: sketch,
    pins: { 9: 'PIN9', 2: 'PIN2' },
    analogPins: { A0: 'wiper', A1: 'sig' },
    vcc: 5,
    board: 'uno',
  },

  behaviors: [
    { id: 'pot-knob', instance: 'knob', params: { pot: 'POT1', turn: 50 } },
    { id: 'serial-plotter', instance: 'serial' },
    { id: 'ac-meter', instance: 'meter', params: { node: 'f', nodeB: 'p9' } },
    { id: 'pwm-filter', instance: 'pf', params: { pin: 9, r: 'R_F', c: 'C_F' } },
  ],

  // 1 ms steps (the PWM edges cut them at every 1.02 ms half-period) resolve the 2.04 ms period and a 1 µF filter
  // (tau 10 ms); about 17 steps and 34 PWM pieces per frame.
  sim: { dt: 1e-3, stepsPerFrame: 60 },

  // Raw pin 9 (0 or 5 V) against the filtered level, same scale: 1 V per division, 0 V at -3 divisions.
  // 2 ms per division shows about 10 PWM periods.
  instruments: {
    open: true,
    scope: {
      channels: [
        { label: 'PIN 9 · raw PWM', source: { kind: 'voltage', node: 'p9' }, perDiv: 1, offset: -3 },
        { label: 'FILTERED', source: { kind: 'voltage', node: 'f' }, perDiv: 1, offset: -3 },
      ],
      timePerDiv: 2e-3,
      trigger: { channel: 0, level: 2.5, slope: 'rising', mode: 'auto' },
    },
    chart: { signals: [0, 6], span: 10 },
  },

  readouts: [
    { label: 'A0 (knob)', source: { kind: 'voltage', node: 'wiper' }, unit: 'V' },
    { label: 'KNOB ADC', source: { kind: 'behavior', key: 'serial.knob' }, unit: 'counts', digits: 1 },
    { label: 'A1 (signal)', source: { kind: 'voltage', node: 'sig' }, unit: 'V' },
    { label: 'SIGNAL ADC', source: { kind: 'behavior', key: 'serial.sensor' }, unit: 'counts', digits: 1 },
    { label: 'DUTY (of 255)', source: { kind: 'behavior', key: 'serial.duty' }, unit: '', digits: 1 },
    { label: 'PIN 9 (avg)', source: { kind: 'voltage', node: 'p9' }, unit: 'V' },
    { label: 'FILTERED', source: { kind: 'voltage', node: 'f' }, unit: 'V' },
    { label: 'RIPPLE (meter)', source: { kind: 'behavior', key: 'meter.vpp' }, unit: 'V' },
    { label: 'RIPPLE (formula)', source: { kind: 'behavior', key: 'pf.ripple' }, unit: 'V' },
    { label: 'CUTOFF', source: { kind: 'behavior', key: 'pf.fc' }, unit: 'Hz' },
    { label: 'PWM FREQ', source: { kind: 'behavior', key: 'pf.fpwm' }, unit: 'Hz' },
    { label: 'LOAD CURRENT', source: { kind: 'current', elementId: 'R_LOAD' }, unit: 'A', floor: 1e-6 },
  ],

  tweaks: [
    { label: 'Knob', elementId: 'behavior:knob', key: 'turn', min: 0, max: 100, step: 1, unit: '%' },
    { label: 'Small signal', elementId: 'V_SIG', key: 'value', min: 0, max: 1.5, step: 0.001, unit: 'V' },
    { label: 'Reference switch (1 = internal 1.1 V)', elementId: 'SW_REF', key: 'closed', kind: 'toggle', min: 0, max: 1, unit: '' },
    {
      label: 'Filter capacitor',
      elementId: 'C_F',
      key: 'value',
      kind: 'enum',
      min: 1e-7,
      max: 1e-4,
      unit: 'F',
      options: [
        { label: '100 nF', value: 1e-7 },
        { label: '1 µF', value: 1e-6 },
        { label: '10 µF', value: 10e-6 },
        { label: '100 µF', value: 100e-6 },
      ],
    },
    { label: 'Filter resistor', elementId: 'R_F', key: 'value', min: 1000, max: 100000, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'READY' }, text: 'USB NOT PLUGGED: the Uno is dead, so there is no 5 V, no ADC and no PWM' },
    {
      when: { kind: 'state', is: 'POWERED' },
      text: 'POWERED: upload the sketch. The knob on A0 sets the duty on pin 9, and the RC filter turns the pulses into a level.',
    },
    {
      when: { kind: 'state', is: 'RUNNING' },
      text: 'RUNNING: A0 = {0} reads {1}; analogWrite({4}) averages {6} on the filter, with {7} of ripple (the formula says {8}).',
    },
    { when: { kind: 'above', readout: 7, value: 0.5 }, text: 'RIPPLE: {7} peak to peak. The filter barely touches the 490 Hz pulses: its cutoff is {9}, near the PWM frequency.' },
    { when: { kind: 'above', readout: 11, value: 0.0002 }, text: 'LOADED: {11} flows out of a filter that is 10 kΩ behind its voltage, so FILTERED sags to {6} instead of the {5} the pin averages.' },
  ],

  failures: [
    {
      id: 'heavy-load',
      label: 'Drive a 1 kΩ load from the filter',
      explain:
        'The RC filter is a 2.51 V source with 10 kΩ behind it, so a 1 kΩ load makes a divider: 2.51 × 1k/(10k + 25 + 1k) ≈ 0.23 V. A PWM filter has a high source impedance, so put an op-amp follower between it and anything that draws current.',
      patches: [{ op: 'set', elementId: 'SW_LOAD', key: 'closed', value: true }],
    },
    {
      id: 'big-cap',
      label: 'Fit a 1000 µF smoothing capacitor',
      explain:
        'τ = 10 kΩ × 1000 µF = 10 s, so the output needs about 30 s to settle after a knob change. The ripple is ten times smaller than with 100 µF, but the filter cannot tell a slow knob turn from PWM ripple: it only knows fast and slow. Speed the sim up to watch.',
      patches: [{ op: 'set', elementId: 'C_F', key: 'value', value: 1e-3 }],
    },
    {
      id: 'no-cap',
      label: 'Remove the filter capacitor',
      explain:
        'Without C_F nothing averages the pulses. FILTERED is the raw 490 Hz square wave behind a resistor: the meter reads its average, 2.51 V, but the scope and the ripple readout see the whole 5 V swing. A meter averages and an ADC or a sensitive input does not, so a "2.5 V" that is really 0 and 5 V can read anything from 0 to 1023 depending on when the ADC samples.',
      patches: [{ op: 'remove', elementId: 'C_F' }],
      parts: { hide: ['cf'] },
    },
  ],

  guide: [
    {
      id: 'plug-usb',
      title: 'Plug in the Uno',
      body: 'Press **Plug USB**. The knob is a 10 kΩ pot across 5 V, so even before any code runs **A0 (knob)** reads about **2.5 V** at the halfway position.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'power' }, { kind: 'status', is: 'POWERED' }, { kind: 'readout', index: 0, above: 2.4, below: 2.6, holdMs: 300 }] },
      focus: { control: 'power' },
      explain: 'A potentiometer is a voltage divider with a movable tap. The wiper goes to analog pin A0, so the pin sees a fraction of 5 V equal to the knob’s position. The scope (already open) is waiting for the PWM.',
    },
    {
      id: 'upload',
      title: 'Run the sketch',
      body: 'Press **Upload**. **KNOB ADC** shows about **511** of 1023, **DUTY** about **127** of 255, and the filter output settles near **2.5 V**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'upload' },
          { kind: 'status', is: 'RUNNING' },
          { kind: 'readout', index: 1, above: 505, below: 517, holdMs: 300 },
          { kind: 'readout', index: 4, above: 120, below: 135, holdMs: 300 },
        ],
      },
      focus: { control: 'upload' },
      explain: 'analogRead returns 0 to 1023: 10 bits, each step 5 / 1024 = 4.88 mV. The sketch divides by 4 to fit the 8-bit analogWrite, and a duty of 127/255 = 50 % of 5 V averages to 2.5 V at 490 Hz. The RC filter turns the pulses into that average.',
    },
    {
      id: 'turn-the-knob',
      title: 'Turn the knob down',
      body: 'Slide **Knob** to about **20 %**. **KNOB ADC** falls to about **204**, and **FILTERED** settles at about **1.0 V**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Knob', min: 15, max: 25 },
          { kind: 'readout', index: 1, above: 190, below: 220, holdMs: 300 },
          { kind: 'readout', index: 6, above: 0.9, below: 1.1, holdMs: 500 },
        ],
      },
      focus: { control: 'tweak:Knob' },
      explain: 'The knob moves the ADC count (204 of 1023 is 20 %), the sketch moves the duty (51 of 255) and the filter moves the average (0.2 × 5 V = 1.0 V). This chain is a digital-to-analog converter made of a timer and an RC.',
    },
    {
      id: 'small-cap',
      title: 'Shrink the filter capacitor',
      body: 'Set **Filter capacitor** to **100 nF**. The cutoff rises to about **159 Hz**, much closer to the 490 Hz PWM, so **RIPPLE (meter)** grows to over **1 V**.',
      check: {
        kind: 'all',
        of: [{ kind: 'tweak', target: 'Filter capacitor', max: 2e-7 }, { kind: 'readout', index: 7, above: 0.8, holdMs: 300 }],
      },
      focus: { control: 'tweak:Filter capacitor' },
      explain: 'The cutoff is f_c = 1 / (2π·R·C): 10 kΩ and 100 nF give 159 Hz, only a factor of 3 under the PWM. A first-order filter cuts that by just 3 times, so most of the square wave leaks through. The ripple formula agrees with the meter.',
    },
    {
      id: 'big-cap',
      title: 'Put a big capacitor back',
      body: 'Set **Filter capacitor** back to **10 µF** (or 100 µF). The cutoff is about **1.6 Hz** and the ripple falls to about **25 mV**.',
      check: {
        kind: 'all',
        of: [{ kind: 'tweak', target: 'Filter capacitor', min: 5e-6 }, { kind: 'readout', index: 7, below: 0.05, holdMs: 300 }],
      },
      focus: { control: 'tweak:Filter capacitor' },
      explain: 'Ripple falls with C, but so does speed: the filter settles in about 5 R·C = 0.5 s at 10 µF. A smoother DAC level is a slower DAC. You pay in response time, with no way round it.',
    },
    {
      id: 'internal-reference',
      title: 'Use the 1.1 V reference',
      body: 'Slide **Reference switch** to **1** (internal 1.1 V). The same 0.3 V signal now reads about **279** counts instead of 61.',
      check: {
        kind: 'all',
        of: [{ kind: 'tweak', target: 'Reference switch (1 = internal 1.1 V)', min: 1 }, { kind: 'readout', index: 3, above: 250, below: 310, holdMs: 300 }],
      },
      focus: { control: 'tweak:Reference switch (1 = internal 1.1 V)' },
      explain: 'One count is Vref / 1024, which is 4.88 mV against 5 V and 1.07 mV against the internal 1.1 V. The same small signal gets 4.5 times as many counts, which is 4.5 times the resolution. The catch: nothing above 1.1 V can be measured.',
    },
    {
      id: 'heavy-load',
      title: 'Break it: load the filter',
      body: 'Open **Break something** and choose **Drive a 1 kΩ load from the filter**. **FILTERED** sags to about **0.2 V** and **LOAD CURRENT** shows tens of microamps.',
      check: {
        kind: 'all',
        of: [{ kind: 'break', failure: 'heavy-load' }, { kind: 'readout', index: 11, above: 5e-5, holdMs: 300 }, { kind: 'readout', index: 6, below: 0.5, holdMs: 300 }],
      },
      focus: { control: 'break' },
      explain: 'The RC filter is a voltage source with 10 kΩ behind it. A 1 kΩ load makes a divider: 1 / (10 + 1) of the voltage, so 2.5 V becomes about 0.23 V. PWM filters are high-impedance sources; put an op-amp follower after them.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: they use ADC counts, PWM duty and the filter cutoff.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  meet: `**ADC (analog to digital).** The Uno's 10-bit converter compares the input with a reference voltage V_ref (5 V from USB by default) and returns

code = V_in × 1024 / V_ref, clipped to 0 to 1023, so **1 LSB = 5/1024 = 4.88 mV**

At the knob's 2.50 V: 2.50 × 1024/5 = **512**. The datasheet floors the result; the simulator rounds V/V_ref × 1023, so at exactly mid travel it shows **511** (duty 127, 2.49 V) where the formula says 512 (duty 128, 2.51 V). They differ by at most one count, which is well inside the chip's own accuracy: the ATmega328P specifies about **±2 LSB** absolute error (gain, offset and nonlinearity together) at a 200 kHz ADC clock. Quantization alone is ±½ LSB, so the lowest bits of a reading are partly noise and partly truth.

The ADC charges a small sample capacitor through your source, so the datasheet asks for a source impedance of about **10 kΩ or less**. The 10 kΩ pot is at most 2.5 kΩ, fine.

**The reference.** \`analogReference(INTERNAL)\` swaps 5 V for the chip's internal **1.1 V** reference (1.0 V to 1.2 V across parts and temperature). Now 1 LSB = 1.1/1024 = **1.07 mV**: the 300 mV signal on A1 reads 61 counts against 5 V but 279 against 1.1 V, with four and a half times the resolution. Anything above 1.1 V reads 1023, so the knob would peg at 1023 above 22 % of travel. Closing REF does this to A1 only.

**PWM (digital to "analog").** \`analogWrite(9, d)\` holds pin 9 high for d/255 of every period. The Uno runs pins 3, 9, 10 and 11 at about **490 Hz**, and pins 5 and 6 at about **980 Hz**. The average is

V_avg = (d/255) × 5 V = (128/255) × 5 = **2.51 V**

**Filtering.** R_F × C_F = 10 kΩ × 10 µF = **0.1 s**, so f_c = 1/(2π × 0.1) = **1.6 Hz**, about 300 times below the PWM frequency. What is left of the pulses is a sawtooth ripple

ΔV ≈ V_CC × D(1 − D) / (f × R C) = 5 × 0.25 / (490 × 0.1) ≈ **25 mV peak to peak**

The scope shows raw pin 9 as a 0 and 5 V square wave, and the filtered level as a flat line; the **RIPPLE (meter)** readout measures the sawtooth the simulator really computes, and the formula readout sits beside it. Choose C_F = 1 µF and the ripple is ten times bigger (about 0.25 V) but the output settles ten times faster: **ripple against response time is the whole trade**. Making the filter faster costs ripple, and making it quieter costs lag.

**True DACs.** An R-2R resistor ladder on several pins gives instant steps with no ripple. An I²C DAC such as the MCP4725 (12-bit) gives a buffered, ripple-free voltage. PWM plus RC is the cheapest and slowest of the three.`,

  mechanicalAnalogy: `PWM is exactly how proportional hydraulics often drive a solenoid valve: you pulse it fully on and off, and the system's own lag (the spool's mass, an accumulator) averages the pulses into a steady force. The RC filter is that accumulator. The ADC is a gauge with tick marks every 4.88 mV: a reading snaps to the nearest tick, and no reading can be finer than a tick.

**Where it breaks:** a valve's response limits hydraulic PWM to tens or hundreds of hertz, while electronics can PWM at tens of kilohertz. The accumulator also has no source-impedance problem: ask a real accumulator for flow and the pressure sags a little, but it does not collapse the way a 10 kΩ filter does when you hang a 1 kΩ load on it. And the RC filter is perfectly linear, so its ripple and lag can be calculated exactly.`,

  proTips: [
    'Put a 100 nF capacitor from the ADC pin to ground for any source above a few kΩ or on long wires. It feeds the sample-and-hold and keeps noise out.',
    'ADC accuracy is only as good as V_ref. USB 5 V can sit anywhere from 4.75 V to 5.25 V, so for measurement use the internal 1.1 V reference (1.0 V to 1.2 V, so calibrate it) or an external precision reference. A ratiometric sensor, like this pot wired to the same 5 V, does not care: its reading tracks V_ref.',
    'After analogReference() changes, the first reading or two can be wrong; throw one away, as the sketch does.',
    'LEDs, motors and heaters do not need filtering, because their own physics averages PWM. Filter only when something downstream truly needs a DC voltage. For audio or precise voltages, use a real DAC.',
  ],

  quiz: [
    {
      q: 'analogRead returns 300 with a 5 V reference. What is the input voltage?',
      options: ['0.30 V', '1.50 V', '3.00 V', '1.46 V'],
      answer: 3,
      why: 'V = 300 × 5/1024 = 1.46 V. One count is 4.88 mV, so 300 counts is 1.46 V, not 1.5.',
    },
    {
      q: 'What average voltage does analogWrite(9, 64) give on a 5 V Uno?',
      options: ['1.25 V', '0.64 V', '2.50 V', '3.20 V'],
      answer: 0,
      why: '64/255 × 5 = 1.25 V.',
    },
    {
      q: 'What is the cutoff frequency of a 4.7 kΩ / 1 µF RC low-pass?',
      options: ['3.4 Hz', '213 Hz', '33.9 Hz', '4.7 kHz'],
      answer: 2,
      why: 'f_c = 1/(2π × 4700 × 10⁻⁶) = 33.9 Hz.',
    },
    {
      q: 'Why does the filtered PWM voltage collapse when a 1 kΩ load is attached?',
      options: [
        "The PWM frequency changes",
        "The filter's 10 kΩ output resistance and the load form a divider, so it needs a buffer",
        'The capacitor discharges permanently',
        'The ADC is overloaded',
      ],
      answer: 1,
      why: 'An RC filter has a high source impedance (R_F), and a follower op-amp fixes it.',
    },
    {
      q: 'With analogReference(INTERNAL), what is one ADC count on an ATmega328P?',
      options: ['4.88 mV', '1.07 mV', '1.1 mV exactly', '0.1 mV'],
      answer: 1,
      why: '1.1 V / 1024 = 1.07 mV (the reference itself is only 1.0 V to 1.2 V from part to part, so the scale is not exact).',
    },
    {
      q: 'You change C_F from 10 µF to 100 µF. What happens to the ripple and to the response time?',
      options: [
        'Ripple 10 times smaller, response 10 times slower',
        'Ripple 10 times larger, response 10 times slower',
        'Ripple unchanged, response 10 times slower',
        'Both 10 times smaller',
      ],
      answer: 0,
      why: 'Ripple ≈ V_CC D(1 − D)/(f R C) and the time constant is R C, so a tenfold C divides the ripple by ten and multiplies τ by ten.',
    },
  ],
}
