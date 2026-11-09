// T6 · HC-SR04 ultrasonic ranger. Source: docs/curriculum/T6/ultrasonic-hcsr04.md
//
// The `hcsr04` behavior is the module: it times the sketch's TRIG pulse and schedules the ECHO
// edges at the round-trip time with `mcu.injectEdge`, so the sketch's own `pulseIn` measures them.
// The Uno side is in the netlist (USB, the pin elements); `serial-plotter` turns the sketch's
// "cm:…,good:…" line into the MEASURED readouts.
import type { LessonDef } from '../../engine/types'
import { UNO, jumper } from '../layout'

// ── bench layout: one 14 × 7 PCB. The Uno on the right (rot 0: digital header on its −x edge, power
// header on +x); the sensor at the left of the Uno facing −x (rot 270), the target tile beyond it ──
const UNO_AT: [number, number] = [3.6, 0.1]
const UNO_HEADER_Y = 0.16 + 0.85
/** Uno power socket: 3 = 3V3, 4 = 5V, 5 = GND (+x edge) */
const unoPower = (k: number): [number, number, number] => [UNO_AT[0] + 2.4, UNO_HEADER_Y, UNO_AT[1] - (-0.35 + (k - 3.5) * 0.254)]
const SR_AT: [number, number] = [-0.9, 0]
/** HC-SR04 header pad (rot 270: the module's local x lands on world z), VCC first */
const srPin = (i: number): [number, number, number] => [SR_AT[0], 0.42, SR_AT[1] + (i - 1.5) * 0.254]
const TARGET_AT: [number, number] = [-5.6, 0]

const wire = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const SKETCH = `#define TRIG 9
#define ECHO 10
#define N 5                         // readings per median

float airTempC = 20.0;              // what the code assumes
float readings[N];

float readCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);            // >= 10 us trigger pulse
  digitalWrite(TRIG, LOW);
  unsigned long us = pulseIn(ECHO, HIGH, 30000);   // 30 ms ~ 5 m round trip
  if (us == 0) {
    return -1.0;                    // no echo
  }
  float c = 331.3 + 0.606 * airTempC;              // m/s
  return us * c / 20000.0;          // us * 1e-6 * c * 100 cm/m / 2
}

void sortReadings() {               // insertion sort, N is small
  for (int i = 1; i < N; i++) {
    float key = readings[i];
    int j = i - 1;
    while (j >= 0 && readings[j] > key) {
      readings[j + 1] = readings[j];
      j--;
    }
    readings[j + 1] = key;
  }
}

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  digitalWrite(TRIG, LOW);
  Serial.begin(115200);
}

void loop() {
  int good = 0;
  for (int i = 0; i < N; i++) {
    readings[i] = readCm();
    if (readings[i] > 0) {
      good++;
    }
    delay(60);                      // let echoes die out between pings
  }
  sortReadings();
  float median = readings[N / 2];
  Serial.print("cm:");
  Serial.print(median);
  Serial.print(",good:");
  Serial.println(good);
}
`

export const lesson: LessonDef = {
  id: 'ultrasonic-hcsr04',
  track: 'T6',
  title: 'HC-SR04 Ultrasonic Ranger',
  subtitle: 'Timing an echo',
  tagline: 'Sound covers a centimetre and back in 58 µs at 20 °C, so the HC-SR04\'s echo pulse width is the distance, and assuming 20 °C on a 0 °C day costs 3.6 %.',

  board: {
    name: 'RANGER BENCH',
    size: [14, 7],
    base: 'mat',
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], 0, UNO_AT[1]],
        mount: 'module',
        label: 'UNO',
        role: 'Sends the 10 µs trigger on pin 9 and times the echo on pin 10 with pulseIn. USB powers both boards.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [0, 1.8, 1.2] },
        circuitIds: ['pin9', 'pin10', 'v_usb'],
      },
      {
        id: 'sr04',
        kind: 'sensor-ultrasonic',
        pos: [SR_AT[0], 0, SR_AT[1]],
        rot: 270,
        mount: 'module',
        label: 'HC-SR04',
        role: 'Two 40 kHz transducers (T transmits, R receives) and the driver and receiver ICs. A 5 V module drawing about 15 mA.',
        params: { callout: [-0.4, 2.4, 0] },
        circuitIds: ['i_sr04', 'echo_src'],
        facts: [
          'Supply 5 V DC, working current 15 mA',
          'Range 2 cm to 400 cm, beam about 15° (vendor figures)',
          'Trigger: a TTL pulse of at least 10 µs on TRIG',
          'ECHO is a 5 V TTL pulse whose width is the round-trip time',
          'Transducers 40 kHz, board 45 × 20 mm',
        ],
      },
      {
        id: 'target',
        kind: 'module',
        pos: [TARGET_AT[0], 0, TARGET_AT[1]],
        mount: 'offboard',
        label: 'TARGET',
        role: 'The thing being ranged. The Target distance slider sets how far away it is; its surface can be hard, soft or angled.',
        color: '#b9b2a2',
        params: { w: 0.5, d: 2.6, pins: 0, chip: 'none', title: 'TARGET', callout: [0, 1.0, 0] },
      },
      {
        id: 'thermo',
        kind: 'thermistor',
        pos: [-3.2, 0, 2.7],
        mount: 'offboard',
        label: 'AIR TEMP',
        role: 'The air temperature. It sets the speed of sound, c = 331.3 + 0.606·T, so it moves every reading. Set it with the Air temperature slider.',
        params: { callout: [0, 1.0, 0.3] },
      },
      {
        id: 'w_trig',
        kind: 'wire',
        ...wire(jumper(UNO.digital(UNO_AT, 9), srPin(1), 'green', 0.7), [0, 0.6, -0.3]),
        mount: 'offboard',
        role: 'Pin 9 to TRIG.',
      },
      {
        id: 'w_echo',
        kind: 'wire',
        ...wire(jumper(UNO.digital(UNO_AT, 10), srPin(2), 'yellow', 0.5), [0, 0.5, 0.3]),
        mount: 'offboard',
        label: 'ECHO',
        role: 'ECHO to pin 10: a 5 V pulse as long as the round trip.',
        circuitIds: ['w_echo'],
      },
      {
        id: 'w_vcc',
        kind: 'wire',
        ...wire(jumper(unoPower(4), srPin(0), 'red', 1.7), [0, 0.8, 0]),
        mount: 'offboard',
        role: 'Uno 5 V to VCC.',
      },
      {
        id: 'w_gnd',
        kind: 'wire',
        ...wire(jumper(UNO.digital(UNO_AT, 'GND'), srPin(3), 'black', 0.5), [0, 0.5, 0.3]),
        mount: 'offboard',
        role: 'Uno GND to GND.',
      },
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
      // the HC-SR04's working current (vendor: 15 mA). 5.5 V is a conservative limit: no maximum is published
      { id: 'i_sr04', type: 'I', nodes: ['5v', '0'], value: 0.015, rating: { maxV: 5.5 }, partId: 'sr04' },
      { id: 'pin9', type: 'PIN', nodes: ['d9', '0'], pin: 9, vcc: 5, vccNode: '5v', partId: 'uno' },
      // the module's push-pull ECHO output, 0 or 5 V as set by the hcsr04 behavior (output resistance approximate)
      { id: 'echo_src', type: 'V', nodes: ['echo_out', '0'], value: 0, rInternal: 100, partId: 'sr04' },
      { id: 'w_echo', type: 'R', nodes: ['echo_out', 'd10'], value: 0.01, partId: 'w_echo' },
      // pin 10: 5.5 V is VCC + 0.5 V, the ATmega328P absolute maximum
      { id: 'pin10', type: 'PIN', nodes: ['d10', '0'], pin: 10, vcc: 5, vccNode: '5v', rating: { maxV: 5.5 }, partId: 'uno' },
      // a marker for the scope: the behavior pulses it when the sketch triggers (a 10 µs pulse drawn at the sim step)
      { id: 'trig_mon', type: 'V', nodes: ['trig_mon', '0'], value: 0, partId: 'uno' },
    ],
  },
  powerElementId: 'usb_plug',
  powerLabel: 'Plug USB',
  transient: true,
  // 100 µs steps resolve a 6 ms echo; at a quarter of real time that is 42 steps a frame
  sim: { dt: 0.0001, speed: 0.25 },

  behaviors: [
    { id: 'hcsr04', params: { distanceCm: 100, airTempC: 20, surface: 0, noiseCm: 0.3, otherSensor: false, maxCm: 400, timeoutUs: 38000 } },
    { id: 'mcu-supply', instance: 'mcu', params: { supplyNode: '5v', bor: 2.7, fClk: 16 } },
    { id: 'serial-plotter', instance: 'serial' },
  ],

  readouts: [
    { label: 'TRUE DISTANCE', source: { kind: 'behavior', key: 'hcsr04.true_cm' }, unit: 'cm' },
    { label: 'MEASURED', source: { kind: 'behavior', key: 'serial.cm' }, unit: 'cm' },
    { label: 'ECHO WIDTH', source: { kind: 'behavior', key: 'hcsr04.echo_us' }, unit: 'µs' },
    { label: 'SPEED OF SOUND (m/s)', source: { kind: 'behavior', key: 'hcsr04.c_mps' }, unit: '' },
    { label: 'GOOD PINGS (OF 5)', source: { kind: 'behavior', key: 'serial.good' }, unit: '', digits: 1 },
    { label: 'ECHO LEVEL (PEAK)', source: { kind: 'voltage', node: 'd10' }, unit: 'V', peak: true },
    { label: 'PINGS LOST', source: { kind: 'behavior', key: 'hcsr04.pings_lost' }, unit: '', digits: 1 },
  ],

  // The scope catches each ping: TRIG (a marker, since the real pulse is 10 µs) and then ECHO, a 5 V
  // pulse whose width is the round trip. At 4 ms a division, 100 cm is about 1.5 divisions wide.
  instruments: {
    open: true,
    scope: {
      channels: [
        { label: 'TRIG', source: { kind: 'voltage', node: 'trig_mon' }, perDiv: 2, offset: 2.5 },
        {
          label: 'ECHO',
          source: { kind: 'voltage', node: 'd10' },
          perDiv: 2,
          offset: -2.5,
          marks: [{ value: 3.6, label: '3.6 V (ESP32-S3 max)' }],
        },
      ],
      timePerDiv: 4e-3,
      trigger: { channel: 1, level: 2.5, slope: 'rising', mode: 'normal' },
    },
    chart: { signals: [0, 1], span: 12 },
  },

  sketch: { title: 'Median ranger', code: SKETCH, pins: { 9: 'pin9', 10: 'pin10' }, vcc: 5, board: 'uno' },

  tweaks: [
    { label: 'Target distance', elementId: 'behavior:hcsr04', key: 'distanceCm', min: 1, max: 500, step: 1, unit: 'cm' },
    { label: 'Air temperature', elementId: 'behavior:hcsr04', key: 'airTempC', min: -10, max: 40, step: 1, unit: '°C' },
    {
      label: 'Target surface',
      elementId: 'behavior:hcsr04',
      key: 'surface',
      kind: 'enum',
      min: 0,
      max: 2,
      unit: '',
      options: [
        { label: 'hard', value: 0 },
        { label: 'soft', value: 1 },
        { label: 'angled', value: 2 },
      ],
    },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: the module idles with ECHO LOW. Upload the sketch to start pinging.' },
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: 5 pings 60 ms apart, one median per 0.3 s. True {0}, measured {1}, echo {2}.' },
    { when: { kind: 'above', readout: 6, value: 3 }, text: 'Echoes are being lost ({6} pings so far): the target is soft, angled, out of range or the ECHO line is not reaching the pin. Good pings in the last median: {4}.' },
  ],

  failures: [
    {
      id: 'cold-air',
      label: 'Cold morning (0 °C), code still assumes 20 °C',
      explain:
        'The real speed of sound is 331.3 m/s at 0 °C, but the sketch still uses 343.4 m/s. A target at 100.0 cm gives a round trip of 2 × 1.000 / 331.3 = 6037 µs, and 6037 × 343.4 / 20 000 ≈ 103.6 cm. The sensor is fine and the arithmetic is fine; the assumed temperature is the error. Measure the air temperature, or accept about 3 % when you can\'t.',
      patches: [{ op: 'set', elementId: 'behavior:hcsr04', key: 'airTempC', value: 0 }],
    },
    {
      id: 'echo-off',
      label: 'The ECHO wire falls off',
      explain:
        'Nothing reaches pin 10, so every pulseIn waits out its whole 30 ms timeout and returns 0. GOOD PINGS drops to 0 and the median reads -1; the loop slows to 5 × (30 + 60) ms. The timeout argument is what keeps the sketch alive: with none, pulseIn waits up to 1 second by default on every call (five seconds per reading here), the classic "my robot freezes when the sensor is unplugged" bug. Always size the timeout to your maximum range, and treat 0 as "no echo", never "zero distance".',
      patches: [{ op: 'remove', elementId: 'w_echo' }],
      parts: { hide: ['w_echo'] },
    },
    {
      id: 'crosstalk',
      label: 'A second ranger pings at the same time',
      explain:
        'Each module hears the other\'s 40 kHz burst, so about 30 % of the pings end early at a random time and read short. The median of 5 still mostly holds, but GOOD PINGS stays at 5 because the stray echoes look like real ones, so the bad readings can\'t be detected as missing. Fire several rangers in sequence, 60 ms apart, or aim them so their beams don\'t overlap.',
      patches: [{ op: 'set', elementId: 'behavior:hcsr04', key: 'otherSensor', value: true }],
    },
    {
      id: 'ranger-on-3v3',
      label: 'Read the 5 V ECHO with a 3.3 V microcontroller',
      explain:
        'The HC-SR04 drives ECHO to 5 V. A 3.3 V part such as the ESP32-S3 has an absolute maximum of 3.6 V on a pin, so the echo overdrives the input and the pin fails. Divide ECHO before it reaches a 3.3 V board: 1 kΩ in series and 2 kΩ to ground gives 5 × 2/3 = 3.33 V. TRIG is the other direction, and a 3.3 V output is often enough to trigger the module; check your module.',
      patches: [
        { op: 'remove', elementId: 'pin10' },
        { op: 'add', element: { id: 'pin10', type: 'PIN', nodes: ['d10', '0'], pin: 10, vcc: 3.3, rating: { maxV: 3.6 } } },
      ],
    },
  ],

  meet: `The HC-SR04 does the hard part itself. You pulse TRIG HIGH for at least **10 µs**. The module sends eight cycles of 40 kHz sound, then holds ECHO HIGH until the reflection comes back. Your only job is to time that pulse.

**Speed of sound:** c ≈ 331.3 + 0.606·T m/s. At 20 °C that is 331.3 + 12.1 = **343.4 m/s**. Out and back, 1 cm takes 2 × 0.01 / 343.4 = **58.2 µs**, so distance (cm) ≈ echo µs / 58.2. A 1166 µs pulse is 1166 / 58.2 ≈ **20.0 cm**.

**Temperature matters:** from 0 °C to 40 °C, c goes from 331.3 to 355.5 m/s, a 7.3 % change. Assuming 20 °C on a 0 °C day reads 343.4 / 331.3 = 3.6 % long.

**Range and rate:** the vendor claims 2 to 400 cm. The longest round trip, 8 m / 343 m/s ≈ 23 ms, plus the time for the echoes to die away, means one ping every **60 ms** (about 16 Hz) is a safe rate.

**No echo:** when nothing comes back, the module holds ECHO HIGH for about 38 ms. Your \`pulseIn\` timeout decides what happens: at 30 ms it returns 0 ("no echo"), and with no timeout it waits as long as a second and can return 38 000 µs, a fake 650 cm.

**Beam:** about 15° wide (vendor). A wall at a steep angle reflects the sound away from the receiver, and soft fabric absorbs it, so both can vanish.

**Electrical:** 5 V at about 15 mA, with a 5 V ECHO output. That suits an Uno, but **divide ECHO** before it reaches a 3.3 V microcontroller such as the ESP32-S3.`,

  mechanicalAnalogy: `This is an echo sounder on a ship, or a time-of-flight thickness gauge in non-destructive testing: send a pulse, time the reflection, multiply by the wave speed, halve it. As in ultrasonic thickness testing, the answer is only as good as the sound velocity you assume, and here it is set by air temperature instead of by the material.

**Where it breaks:** NDT couples the probe to the part with gel and uses a narrow, focused beam. In open air the beam is wide (about 15°), so the HC-SR04 reports the *nearest* thing in a cone, not the thing straight ahead.`,

  proTips: [
    'Always pass a timeout to pulseIn, sized to your maximum range: 30 ms covers about 5 m. Then treat 0 as "no echo", not "zero distance".',
    'Mount the sensor a few centimetres back from any edge of the chassis, and aim it slightly upward on floor robots, or it ranges the floor.',
    'Use a median, not a mean. One stray echo near zero pulls a mean of 5 readings of 100 cm down by about 19 %, while a median ignores it.',
  ],

  guide: [
    {
      id: 'meet-the-sensor',
      title: 'Meet the sensor',
      body: 'Click the **HC-SR04** to open its inspector. One transducer sends 40 kHz bursts and the other listens. You only need four wires: VCC, TRIG, ECHO and GND.',
      check: { kind: 'inspect', part: 'sr04' },
      focus: { part: 'sr04' },
      hint: 'It is the blue board with two silver cylinders, left of the Uno.',
      explain: 'The module does the sound work itself. The Uno only sends a short trigger pulse and times the pulse that comes back on ECHO.',
    },
    {
      id: 'power',
      title: 'Plug in USB',
      body: 'Press **Plug USB**. The Uno and the ranger both run from 5 V. **SPEED OF SOUND** shows **343** m/s, the value at 20 °C.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'power' },
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 3, above: 340, below: 346, holdMs: 300 },
        ],
      },
      focus: { control: 'power' },
      explain: 'c = 331.3 + 0.606 × 20 = 343.4 m/s. That number is what turns a time into a distance.',
    },
    {
      id: 'upload',
      title: 'Upload the ranger sketch',
      body: 'Press **Upload sketch**. It pings five times, 60 ms apart, and prints the median distance. With the target at **100 cm**, **MEASURED** settles near 100 and **ECHO WIDTH** near **5800 µs**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'upload' },
          { kind: 'status', is: 'RUNNING' },
          { kind: 'readout', index: 1, above: 98, below: 102, holdMs: 300 },
        ],
      },
      focus: { control: 'upload' },
      hint: 'The first reading takes about a third of a second of simulated time.',
      explain: 'The sketch measures the HIGH time on pin 10 with pulseIn. Distance = time × c / 2, which for microseconds and centimetres is us × c / 20 000.',
    },
    {
      id: 'move-target',
      title: 'Move the target to 200 cm',
      body: 'Slide **Target distance** to about **200 cm**. The round trip doubles to 2 × 2.00 / 343.4 ≈ **11 650 µs** and **MEASURED** follows.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Target distance', min: 190, max: 210 },
          { kind: 'readout', index: 1, above: 194, below: 206, holdMs: 400 },
          { kind: 'readout', index: 2, above: 10800, below: 12600, holdMs: 400 },
        ],
      },
      focus: { control: 'tweak:Target distance' },
      explain: 'Echo width is proportional to distance: 58.2 µs per centimetre at 20 °C. Open the instrument scope to see ECHO rise a few hundred microseconds after the TRIG marker and stay high for the round trip.',
    },
    {
      id: 'cold-air',
      title: 'Make the air cold',
      body: 'Slide **Air temperature** to **0 °C**. The code still assumes 20 °C, so a target at 200 cm reads about **207 cm**: 200 × 343.4 / 331.3.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Air temperature', min: -1, max: 1 },
          { kind: 'readout', index: 3, above: 330, below: 333, holdMs: 300 },
          { kind: 'readout', index: 1, above: 203, below: 211, holdMs: 400 },
        ],
      },
      focus: { control: 'tweak:Air temperature' },
      hint: 'Wait for the next median after you move the slider, about a third of a second.',
      explain: 'Cold air is slower, so the echo takes longer and the sketch\'s fixed 343.4 m/s turns that extra time into extra distance. Over 20 °C the error is 3.6 %.',
    },
    {
      id: 'pull-echo',
      title: 'Break it: the ECHO wire falls off',
      body: 'Open **Break something** and choose **The ECHO wire falls off**. Nothing reaches pin 10, so **GOOD PINGS** drops to **0** and **MEASURED** reads **-1**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'break', failure: 'echo-off' },
          { kind: 'readout', index: 4, below: 0.5, holdMs: 300 },
          { kind: 'readout', index: 1, below: 0, holdMs: 300 },
        ],
      },
      focus: { control: 'break' },
      hint: 'It takes one full median, about half a second now that every ping waits 30 ms.',
      explain: 'pulseIn gave up after its 30 ms timeout and returned 0, which the sketch reports as "no echo". Without a timeout it would have waited up to a second for every ping and the sketch would have appeared to freeze.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**. The wire goes back and the readings return.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: echo time, range, temperature and soft targets.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  quiz: [
    {
      q: 'ECHO is HIGH for 1166 µs at 20 °C (c = 343.4 m/s). What is the distance?',
      options: ['10 cm', '20 cm', '40 cm', '58 cm'],
      answer: 1,
      why: 'd = 1166 µs × 343.4 m/s / 2 = 20.0 cm (or 1166 / 58.2).',
    },
    {
      q: 'The longest range you need is 4 m. What is the minimum round-trip time you must wait for?',
      options: ['2.3 ms', '11.7 ms', '23.3 ms', '60 ms'],
      answer: 2,
      why: '8 m / 343 m/s = 23.3 ms. Vendors suggest 60 ms between pings so the reverberation can die away.',
    },
    {
      q: 'The air is 0 °C but the code assumes 20 °C. A target at exactly 100 cm reads as:',
      options: ['96.5 cm', '100 cm', '103.6 cm', '107 cm'],
      answer: 2,
      why: 'reading = 100 × 343.4 / 331.3 ≈ 103.6 cm, because the real sound is slower than the code thinks.',
    },
    {
      q: 'Why might a heavy curtain at 1 m return no reading?',
      options: [
        'The curtain is too close',
        'Soft, porous material absorbs and scatters the ultrasound, so too little echo returns',
        'Curtains are transparent to 40 kHz',
        'The sensor needs a metal target',
      ],
      answer: 1,
      why: 'Absorption and diffuse scattering leave the echo below the receiver\'s threshold, so ECHO just times out.',
    },
  ],
}
