// T6 · NTC thermistor. Source: docs/curriculum/T6/thermistor.md
//
// A Vishay NTCLE100E3103JB0 (10 kΩ at 25 °C, B25/85 = 3977 K) in a divider into the Uno's A0. The `ntc`
// behavior sets its resistance from the bath temperature through the Beta model, adds self-heating from
// the solved power and a first-order thermal lag (15 s still-air time constant from the datasheet), and
// publishes the true and sensor temperatures. The sketch does the Beta equation on the 10-bit ADC reading;
// `serial-plotter` turns its "tempC:…,raw:…,fault:…" line into the MEASURED readouts.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, UNO, bbHole, between, jumper } from '../layout'

// ── bench layout: the Uno at the back, the breadboard in front, the water bath at front left ──
const UNO_AT: [number, number] = [0, -2.6]
const BB: [number, number] = [0, 3.5]
const CUP_AT: [number, number] = [-6.3, 3.6]
const NTC_AT: [number, number] = [-4.8, 3.6]

/** analog socket A0..A5 (the +x edge, A0 toward the viewer) */
const unoAnalog = (i: number): [number, number, number] => [UNO_AT[0] + 2.4, UNO.headerY, UNO_AT[1] - (1.95 + (i - 2.5) * 0.254)]
/** power socket NC IOREF RESET 3V3 5V GND GND VIN (k = 0..7) */
const unoPower = (k: number): [number, number, number] => [UNO_AT[0] + 2.4, UNO.headerY, UNO_AT[1] - (-0.35 + (k - 3.5) * 0.254)]
const h = (col: number, row: string) => bbHole(BB, col, row)
/** the thermistor's two lead tips on the mat */
const ntcLead = (side: -1 | 1): [number, number, number] => [NTC_AT[0] + side * 0.127, BENCH_Y + 0.02, NTC_AT[1]]

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const R_RATING = { maxP: 0.25, maxV: 250 }

const SKETCH = `const float R_FIXED = 10000.0;   // ohms, top of the divider
const float R25     = 10000.0;   // NTC resistance at 25 C
const float BETA    = 3977.0;    // B25/85 from the datasheet, kelvin
const float T25     = 298.15;    // 25 C in kelvin
const int   HOT_LED = 9;

float rawAvg = 0.0;              // the averaged ADC reading, for the readout

float readTempC() {
  long sum = 0;
  for (int i = 0; i < 16; i++) {          // average 16 samples
    sum += analogRead(A0);
    delay(2);
  }
  rawAvg = sum / 16.0;
  if (rawAvg < 2.0 || rawAvg > 1021.0) {
    return -999.0;                         // short or open: not a temperature
  }
  // analogRead = floor(1024 * V / 5 V): the middle of the step is raw + 0.5
  float x = rawAvg + 0.5;
  float r = R_FIXED * x / (1024.0 - x);    // the NTC is the bottom leg
  float invT = 1.0 / T25 + log(r / R25) / BETA;
  return 1.0 / invT - 273.15;
}

void setup() {
  pinMode(HOT_LED, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  float t = readTempC();
  int fault = 0;
  if (t < -100.0) {
    fault = 1;
    digitalWrite(HOT_LED, LOW);
  } else if (t > 40.0) {
    digitalWrite(HOT_LED, HIGH);
  } else {
    digitalWrite(HOT_LED, LOW);
  }
  Serial.print("tempC:");
  Serial.print(t);
  Serial.print(",raw:");
  Serial.print(rawAvg);
  Serial.print(",fault:");
  Serial.println(fault);
  delay(500);
}
`

export const lesson: LessonDef = {
  id: 'thermistor',
  track: 'T6',
  title: 'NTC Thermistor',
  subtitle: 'Resistance that feels heat',
  tagline: 'A 10 kΩ NTC drops to 3.56 kΩ at 50 °C. With a 10 kΩ divider on an Uno, that is about 11 ADC counts per kelvin near room temperature.',

  board: {
    name: 'THERMO BENCH',
    size: [16, 12],
    base: 'breadboard-only',
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], BENCH_Y, UNO_AT[1]],
        mount: 'module',
        label: 'UNO',
        role: 'Reads the divider on A0 with its 10-bit ADC, applies the Beta equation and prints the temperature. USB brings the 5 V.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [-1.6, 0.9, -1.4] },
        circuitIds: ['v_usb', 'pin9'],
      },
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the divider, the filter capacitor and the hot LED.' },
      {
        id: 'cup',
        kind: 'module',
        pos: [CUP_AT[0], BENCH_Y, CUP_AT[1]],
        mount: 'offboard',
        label: 'WATER BATH',
        role: 'The thing being measured: a cup of water with a reference thermometer. The Bath temperature slider sets the true temperature.',
        color: '#7fa9c4',
        params: { w: 1.7, d: 1.7, pins: 0, chip: 'none', title: 'WATER BATH', callout: [0, 1.0, 0] },
      },
      {
        id: 'ntc',
        kind: 'thermistor',
        pos: [NTC_AT[0], BENCH_Y, NTC_AT[1]],
        mount: 'offboard',
        label: 'NTC 10k',
        role: 'Vishay NTCLE100E3103JB0: 10 kΩ at 25 °C, B25/85 = 3977 K. Its resistance falls about 4.5 % per kelvin near 25 °C, and it warms itself with the current you measure it with.',
        params: { callout: [0, 1.0, 0.3] },
        circuitIds: ['ntc'],
        facts: [
          'R25 = 10 kΩ (±5 % on the J grade), B25/85 = 3977 K (±0.75 %)',
          'Operating range -40 to +125 °C at zero power',
          'Dissipation factor about 8.5 mW/K and thermal time constant 15 s, both for information only (still air)',
          'Response time in oil 1.2 s',
          'Maximum power 500 mW at 55 °C; keep the voltage on it below 50 V DC',
        ],
      },
      {
        id: 'r_fix',
        kind: 'resistor',
        pos: between(h(5, 'c'), h(9, 'c')),
        mount: 'tht',
        label: 'R FIXED',
        role: 'The upper leg of the divider, 10 kΩ 1 % (brown-black-orange). Its tolerance goes straight into the temperature error.',
        params: { ohms: 10000, span: 4 * 0.254, callout: [0.2, 1.5, -0.5] },
        circuitIds: ['r_fix'],
      },
      {
        id: 'c_f',
        kind: 'capacitor-ceramic',
        pos: between(h(9, 'd'), h(10, 'd')),
        mount: 'tht',
        label: 'FILTER',
        role: '100 nF ceramic: gives the ADC’s sample capacitor a low-impedance source and filters noise.',
        params: { farads: 100e-9, code: '104', callout: [0.3, 1.3, 0.4] },
        circuitIds: ['c_f'],
      },
      {
        id: 'r_led',
        kind: 'resistor',
        pos: between(h(16, 'c'), h(20, 'c')),
        mount: 'tht',
        label: 'LED R',
        role: '220 Ω (red-red-brown) in series with the hot LED: (5 − 1.9) V / 220 Ω is about 14 mA.',
        params: { ohms: 220, span: 4 * 0.254, callout: [0.2, 1.3, -0.5] },
        circuitIds: ['r_led'],
      },
      {
        id: 'led_hot',
        kind: 'led',
        pos: between(h(20, 'e'), h(21, 'e')),
        rot: 180,
        mount: 'tht',
        label: 'HOT',
        role: 'Lights above 40 °C (the sketch’s threshold).',
        params: { color: 'red', callout: [0, 1.1, 0.6] },
        circuitIds: ['led_hot'],
      },
      { id: 'w_a0', kind: 'wire', ...withCallout(jumper(unoAnalog(0), h(9, 'a'), 'green', 0.9), [0, 0.5, 0.2]), mount: 'offboard', role: 'A0 to the divider midpoint.' },
      { id: 'w_5v', kind: 'wire', ...jumper(unoPower(4), h(2, '+t'), 'red', 0.6), mount: 'offboard', role: '5 V to the top + rail.' },
      { id: 'w_gnd', kind: 'wire', ...jumper(unoPower(5), h(3, '-t'), 'black', 0.5), mount: 'offboard', role: 'GND to the top − rail.' },
      { id: 'w_d9', kind: 'wire', ...jumper(UNO.digital(UNO_AT, 9), h(16, 'a'), 'yellow', 0.9), mount: 'offboard', role: 'Pin 9 to the hot LED’s resistor.' },
      { id: 'w_rtop', kind: 'wire', ...jumper(h(5, 'a'), h(5, '+t'), 'red', 0.12), mount: 'offboard', role: 'R FIXED to the 5 V rail.' },
      { id: 'w_cgnd', kind: 'wire', ...jumper(h(10, 'a'), h(10, '-t'), 'black', 0.12), mount: 'offboard', role: 'The NTC’s other lead and the filter capacitor to the ground rail.' },
      { id: 'w_ledgnd', kind: 'wire', ...jumper(h(21, 'a'), h(21, '-t'), 'black', 0.12), mount: 'offboard', role: 'LED cathode to the ground rail.' },
      { id: 'w_ntc1', kind: 'wire', ...jumper(ntcLead(1), h(9, 'e'), 'orange', 0.5), mount: 'offboard', role: 'One thermistor lead to the divider midpoint.' },
      { id: 'w_ntc2', kind: 'wire', ...jumper(ntcLead(-1), h(10, 'e'), 'white', 0.5), mount: 'offboard', role: 'The other thermistor lead to ground.' },
    ],
  },

  circuit: {
    elements: [
      // USB 5 V; the source and fuse resistances are kept small so the rail barely sags: the sim's ADC
      // reference is a fixed 5 V, whereas on a real Uno it is the rail itself (ratiometric).
      { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5.0, rInternal: 0.05, partId: 'uno' },
      { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', 'vbus_in'], closed: true, partId: 'uno' },
      { id: 'f1', type: 'R', nodes: ['vbus_in', '5v'], value: 0.05, rating: { maxI: 1.0 }, partId: 'uno' },
      // the whole Uno, about 45 mA, lumped as a current sink; 6 V is the 328P's absolute maximum
      { id: 'i_board', type: 'I', nodes: ['5v', '0'], value: 0.045, rating: { maxV: 6.0 }, partId: 'uno' },
      { id: 'r_fix', type: 'R', nodes: ['5v', 'a0'], value: 10000, rating: R_RATING, partId: 'r_fix' },
      // set by the ntc behavior (10 kΩ at 25 °C); 0.5 W is the datasheet maximum at 55 °C
      { id: 'ntc', type: 'R', nodes: ['a0', '0'], value: 10000, rating: { maxP: 0.5 }, partId: 'ntc' },
      { id: 'c_f', type: 'C', nodes: ['a0', '0'], value: 100e-9, rating: { maxV: 50 }, partId: 'c_f' },
      { id: 'pin9', type: 'PIN', nodes: ['d9', '0'], pin: 9, vcc: 5, vccNode: '5v', partId: 'uno' },
      { id: 'r_led', type: 'R', nodes: ['d9', 'led_a'], value: 220, rating: R_RATING, partId: 'r_led' },
      { id: 'led_hot', type: 'LED', nodes: ['led_a', '0'], color: 'red', rating: { maxI: 0.03 }, partId: 'led_hot' },
    ],
  },
  powerElementId: 'usb_plug',
  powerLabel: 'Plug USB',
  // DC is enough: the 100 nF filter settles in 0.5 ms and the thermal lag lives in the behavior.
  // Three times real speed makes the 15 s time constant take 5 s of waiting.
  transient: false,
  sim: { speed: 3 },

  behaviors: [
    { id: 'ntc', params: { bathC: 25, r25: 10000, bTrue: 3977, delta: 0.0085, tau: 15 } },
    { id: 'mcu-supply', instance: 'mcu', params: { supplyNode: '5v', bor: 2.7, fClk: 16 } },
    { id: 'serial-plotter', instance: 'serial' },
  ],

  readouts: [
    { label: 'BATH (TRUE)', source: { kind: 'behavior', key: 'ntc.bath_C' }, unit: '°C' },
    { label: 'MEASURED', source: { kind: 'behavior', key: 'serial.tempC' }, unit: '°C' },
    { label: 'NTC RESISTANCE', source: { kind: 'behavior', key: 'ntc.ntc_ohm' }, unit: 'Ω' },
    { label: 'A0 VOLTAGE', source: { kind: 'voltage', node: 'a0' }, unit: 'V' },
    { label: 'SELF-HEATING (K)', source: { kind: 'behavior', key: 'ntc.self_heat_K' }, unit: '' },
    { label: 'NTC POWER', source: { kind: 'power', elementId: 'ntc' }, unit: 'W' },
    { label: 'SENSOR BODY', source: { kind: 'behavior', key: 'ntc.ntc_C' }, unit: '°C' },
    { label: 'A0 COUNTS (AVG)', source: { kind: 'behavior', key: 'serial.raw' }, unit: '', digits: 1 },
  ],

  // the strip chart is the lag: the bath steps, the sensor body and the printed value follow a few seconds later
  instruments: { open: true, view: 'chart', chart: { signals: [0, 6, 1], span: 60 } },

  sketch: { title: 'Beta-equation thermometer', code: SKETCH, pins: { 9: 'pin9' }, analogPins: { A0: 'a0' }, vcc: 5, board: 'uno' },

  tweaks: [
    { label: 'Bath temperature', elementId: 'behavior:ntc', key: 'bathC', min: -20, max: 100, step: 0.5, unit: '°C' },
    { label: 'Fixed resistor', elementId: 'r_fix', key: 'value', min: 330, max: 100000, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: A0 sits at {3}. Upload the sketch to turn counts into degrees.' },
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: 16 samples per reading. True {0}, measured {1}. The HOT LED lights above 40 °C.' },
    { when: { kind: 'above', readout: 4, value: 0.2 }, text: 'Self-heating above 0.2 K ({4} K): the sensor is measuring itself.' },
  ],

  failures: [
    {
      id: 'wrong-beta',
      label: 'Wrong part on the reel (B = 3435 K), code still says 3977',
      explain:
        'At 25 °C both parts are 10 kΩ, so the reading is right. At 60 °C the bath is right but this part is 10 kΩ × exp(3435 × (1/333.15 − 1/298.15)) ≈ 2.98 kΩ. Through the B = 3977 equation that resistance reads 1/T = 1/298.15 + ln(0.298)/3977, so T ≈ 327.9 K = 54.8 °C: 5 K low. Two "10 kΩ NTCs" are not interchangeable. Record the part number and B value with the code.',
      patches: [{ op: 'set', elementId: 'behavior:ntc', key: 'bTrue', value: 3435 }],
    },
    {
      id: 'open-lead',
      label: 'The thermistor lead breaks',
      explain:
        'With the bottom leg open, A0 floats up to 5 V (1023 counts) and the sketch prints a fault instead of a fake temperature. Without the range check the Beta equation would turn 1023 counts into a very cold, very wrong number (-273 °C is what a divider at the rail asks for). Always keep your fault codes (near 0 and near 1023) outside the valid range.',
      patches: [{ op: 'remove', elementId: 'ntc' }],
      parts: { hide: ['ntc'] },
    },
    {
      id: 'shorted',
      label: 'The thermistor leads touch',
      explain:
        'A short pulls A0 to 0 V (0 counts). A real NTC at 125 °C is still about 340 Ω, so 0 counts is not a temperature, it is a fault, and the range check says so. The short also leaves the 10 kΩ resistor carrying 0.5 mA to ground for nothing, which the Uno does not mind.',
      patches: [{ op: 'short', a: 'a0', b: '0' }],
    },
    {
      id: 'wrong-resistor',
      label: 'A 1 kΩ resistor fitted instead of 10 kΩ',
      explain:
        'At 25 °C, A0 = 5 × 10k/11k = 4.55 V (930 counts). The code assumes 10 kΩ, so it computes R = 10k × 930/94 ≈ 99 kΩ, which the Beta equation turns into about -19 °C. The stiffer divider also raises the measuring current to 0.45 mA, so self-heating roughly doubles. Every component in the measurement chain must match its value in the code.',
      patches: [{ op: 'set', elementId: 'r_fix', key: 'value', value: 1000 }],
    },
  ],

  meet: `An NTC thermistor is a ceramic semiconductor whose resistance falls steeply as it warms. The Vishay NTCLE100E3103 is **10 kΩ at 25 °C** with **B25/85 = 3977 K**.

**Beta equation:** R(T) = R25 × exp(B × (1/T − 1/298.15)), with T in kelvin. At 50 °C (323.15 K) the exponent is 3977 × (1/323.15 − 1/298.15) = −1.032, so R = 10 kΩ × 0.356 = **3.56 kΩ**. Solve it the other way for the sketch: 1/T = 1/298.15 + ln(R/R25)/B. Steinhart–Hart adds two more terms and fits a wider range; the Beta form is what you use when a datasheet gives only B.

**Divider:** NTC at the bottom, 10 kΩ on top, 5 V. At 25 °C, A0 = 2.50 V, which reads **512** on the 10-bit ADC (counts = floor(1024 × V / 5)). At 50 °C: 5 × 3.56 / 13.56 = 1.31 V, which reads **268**.

**Sensitivity near 25 °C:** dR/dT = −B/T² × R = −3977 / 298.15² × 10 kΩ ≈ **−447 Ω/K** (−4.5 %/K). At the midpoint the divider gives dV/dR = 5 × 10k / (20k)² = 125 µV/Ω, so 447 × 125 µV ≈ **56 mV/K**, or about **11 counts per kelvin**: one count is about 0.09 K. Accuracy is set by the ±5 % R25 tolerance (about ±1 K) and the 1 % resistor, not by the ADC.

**Choose R_fixed ≈ R_NTC at the temperature you care about most.** The divider's slope peaks there. At 50 °C the NTC is 3.56 kΩ, so 3.3 kΩ would serve better than 10 kΩ.

**Self-heating:** the thermistor's own power is at most V²/(4R) = 25 / 40 000 = **0.625 mW** in this divider. With a dissipation factor of about 8.5 mW/K in still air (datasheet, for information only) that is **0.07 K**: negligible. A stiffer divider multiplies it: 330 Ω over a 3.56 kΩ NTC dissipates 5.9 mW, a 0.7 K error that no calibration removes.

**Thermal lag:** the bead has mass, so it follows the bath with a first-order lag: the datasheet's thermal time constant is **15 s** in still air (1.2 s response in oil). After one time constant it has covered 63 % of a step, after three, 95 %. The strip chart shows this: sensor and printed value trail the bath.

**Faults:** an open lead pins A0 at 5 V (1023 counts), a short at 0 V. Neither is a temperature, so reject readings below 2 or above 1021 counts.`,

  mechanicalAnalogy: `A thermistor is a bimetal strip turned into a resistance: one number (B) describes its curve the way a single expansion coefficient describes a strip, and the divider is a lever that turns the change into a readable deflection. Choosing R_fixed sets the lever's pivot, which decides where on the scale the deflection is largest. The thermal lag is the same first-order response as a thermometer pocket in a pipe: a thermowell adds thermal mass between the fluid and the sensor.

**Where it breaks:** the curve is exponential, not linear, so one B value fits well only over the span it was measured on (25 to 85 °C here). And unlike a passive bimetal, the sensor heats *itself* with the measuring current, an error a mechanical gauge doesn't have.`,

  proTips: [
    'Measure the fixed resistor with a good meter and put the real value in code. 1 % of 10 kΩ is about 0.22 K at 25 °C, so it matters as much as the thermistor\'s tolerance.',
    'For better than about ±0.5 K over a wide range, use the manufacturer\'s R/T table (or Steinhart–Hart coefficients fitted to it) and calibrate against a reference at one or two points.',
    'Power the divider from the same 5 V that the ADC uses as its reference (the default on an Uno). The reading is then ratiometric, and supply drift cancels.',
    'Keep the measuring power small: P/δ is the error. Some designs switch the divider on only while sampling.',
  ],

  guide: [
    {
      id: 'meet-the-ntc',
      title: 'Meet the thermistor',
      body: 'Click the **NTC** beside the water bath to open its inspector. It is 10 kΩ at 25 °C and gets less resistive as it warms.',
      check: { kind: 'inspect', part: 'ntc' },
      focus: { part: 'ntc' },
      hint: 'It is the small dark bead on two orange leads at the front left.',
      explain: 'The datasheet gives two numbers that describe the curve: R25 = 10 kΩ and B25/85 = 3977 K. Everything else in this lesson follows from them.',
    },
    {
      id: 'power',
      title: 'Plug in USB',
      body: 'Press **Plug USB**. At 25 °C the NTC equals the fixed resistor, so **A0 VOLTAGE** reads **2.5 V**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'power' },
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 3, above: 2.4, below: 2.6, holdMs: 300 },
        ],
      },
      focus: { control: 'power' },
      explain: 'Equal resistors split the 5 V in half. That mid-scale point is also where the divider is most sensitive.',
    },
    {
      id: 'upload',
      title: 'Upload the thermometer sketch',
      body: 'Press **Upload sketch**. It averages 16 readings and applies the Beta equation. **MEASURED** settles near **25 °C**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'upload' },
          { kind: 'status', is: 'RUNNING' },
          { kind: 'readout', index: 1, above: 24.4, below: 25.6, holdMs: 300 },
        ],
      },
      focus: { control: 'upload' },
      hint: 'The first reading takes about half a second of simulated time.',
      explain: 'A0 reads 512 counts, so R = 10 kΩ × 512.5 / (1024 − 512.5) = 10 kΩ and the equation returns 298.15 K. **SELF-HEATING** shows the sensor sits about 0.07 K above the bath.',
    },
    {
      id: 'warm-bath',
      title: 'Warm the bath to 50 °C',
      body: 'Slide **Bath temperature** to **50 °C**. The NTC falls to 3.56 kΩ, but the bead lags: **MEASURED** takes about three time constants (45 s) to arrive. Watch the chart.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Bath temperature', min: 49, max: 51 },
          { kind: 'readout', index: 1, above: 48.5, below: 51.5, holdMs: 400 },
          { kind: 'readout', index: 2, above: 3300, below: 3900, holdMs: 400 },
        ],
      },
      focus: { control: 'tweak:Bath temperature' },
      hint: 'The sensor body curve on the chart climbs like a charging capacitor. Speed is 3x, so the wait is about 15 s.',
      explain: 'A first-order lag: 63 % of the step after one 15 s time constant, 95 % after three. The HOT LED lit when the reading passed 40 °C. A thermowell or a thick epoxy coating adds to the lag; a bare bead in oil is 12 times faster.',
    },
    {
      id: 'open-lead',
      title: 'Break it: the lead snaps',
      body: 'Open **Break something** and choose **The thermistor lead breaks**. **A0 VOLTAGE** jumps to **5 V** and **MEASURED** shows the fault value **-999**, not a temperature.',
      check: {
        kind: 'all',
        of: [
          { kind: 'break', failure: 'open-lead' },
          { kind: 'readout', index: 3, above: 4.9, holdMs: 300 },
          { kind: 'readout', index: 1, below: -500, holdMs: 300 },
        ],
      },
      focus: { control: 'break' },
      hint: 'The sketch prints once every half second.',
      explain: 'Open bottom leg, nothing pulls A0 down, and the ADC reads 1023. The sketch\'s range check (below 2 or above 1021 counts) turns that into a fault. Without it, the Beta equation would print an absurd cold temperature and nobody would know the sensor was gone.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**. The lead is back and the readings return.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    {
      id: 'self-heat',
      title: 'Make the divider stiff',
      body: 'Slide **Fixed resistor** down to about **330 Ω**. The NTC (3.56 kΩ at 50 °C) now carries 1.3 mA and dissipates about 5.9 mW, so **SELF-HEATING** reads **0.7 K**. MEASURED goes wrong too: the code still assumes 10 kΩ.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Fixed resistor', min: 300, max: 380 },
          { kind: 'readout', index: 4, above: 0.5, below: 0.9, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Fixed resistor' },
      explain: 'P = I²R with I = 5 V / (330 + 3560 Ω). The error is P / δ = 5.9 mW / 8.5 mW/K. A bigger fixed resistor lowers the current but costs resolution when the NTC is small; the compromise is R_fixed close to the NTC at your mid-range temperature.',
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: the Beta equation, mid-scale counts, self-heating and lag.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  quiz: [
    {
      q: 'An NTC has R25 = 10 kΩ and B = 3977 K. What is its resistance at 50 °C?',
      options: ['1.2 kΩ', '3.56 kΩ', '5.0 kΩ', '28 kΩ'],
      answer: 1,
      why: '10 kΩ × exp(3977 × (1/323.15 − 1/298.15)) = 10 kΩ × exp(−1.032) ≈ 3.56 kΩ.',
    },
    {
      q: '10 kΩ fixed on top, the NTC at the bottom, 5 V, a 10-bit ADC. What does analogRead return at 25 °C?',
      options: ['0', '256', '512', '1023'],
      answer: 2,
      why: 'Equal resistances give 2.5 V, and 2.5 / 5 × 1024 = 512.',
    },
    {
      q: 'The NTC dissipates at most 0.625 mW in the 10 kΩ / 10 kΩ divider. With δ = 8.5 mW/K, what is the self-heating?',
      options: ['0.007 K', '0.07 K', '0.7 K', '7 K'],
      answer: 1,
      why: 'ΔT = P / δ = 0.625 / 8.5 ≈ 0.07 K.',
    },
    {
      q: 'The bath jumps from 25 to 65 °C and the thermal time constant is 15 s. About how long until the sensor has covered 95 % of the step?',
      options: ['15 s', '30 s', '45 s', '150 s'],
      answer: 2,
      why: 'A first-order lag reaches 1 − e⁻³ ≈ 95 % after three time constants: 3 × 15 s = 45 s.',
    },
    {
      q: 'Why does a single-B equation lose accuracy at −20 °C for a part specified as B25/85?',
      options: [
        'The ADC saturates at low temperature',
        'B is a two-point fit between 25 and 85 °C, and the real curve bends away from it outside that span',
        'NTCs stop working below 0 °C',
        'The fixed resistor changes value',
      ],
      answer: 1,
      why: 'B25/85 is defined from the resistances at 25 and 85 °C. Use the R/T table or Steinhart–Hart outside that range.',
    },
  ],
}
