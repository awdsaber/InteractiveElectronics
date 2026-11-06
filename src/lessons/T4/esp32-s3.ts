// T4 · ESP32-S3 DevKitC-1 (video Fig. 04). Source: docs/curriculum/T4/esp32-s3.md
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, PITCH, bbHole, between, jumper } from '../layout'

// Bench layout: the breadboard at the back, the DevKitC-1 in front of it turned so its J1 header
// (3V3, GPIO4, GPIO5, GND) faces the breadboard, and the "5 V logic" stand-in at the front left.
// (shifted toward −x so the breadboard's right end clears the status panel)
const BB: [number, number] = [-0.7, -1.9]
const DK: [number, number] = [0.5, 2.9] // DevKit centre
const DK_W = 6.3
const DK_D = 2.6
const SIG: [number, number] = [-4.6, 3.55]

/** top of the DevKit carrier board (a generic module: 0.16 thick, no standoff) */
const DK_TOP = BENCH_Y + 0.16
/** header rows 0.9" apart, pin 1 at the antenna end */
const ROW_Z = 1.143
const PIN_LEN = 0.45
const PIN_TOP = DK_TOP + 0.25 + PIN_LEN
/**
 * A point on the DevKit in its own frame (antenna end at −x, J1 along +z, as on Espressif's
 * drawing turned on its side). The board sits turned 180° on the bench: antenna to the right,
 * USB to the left, J1 along the back facing the breadboard.
 */
const onDk = (x: number, z: number): [number, number, number] => [DK[0] - x, DK_TOP, DK[1] - z]
const DK_ROT = 180
const pinX = (n: number) => (n - 1 - 10.5) * PITCH
/** J1: 1 3V3, 2 3V3, 3 RST, 4 GPIO4, 5 GPIO5 … 21 5V, 22 GND */
const j1 = (n: number): [number, number, number] => {
  const [x, , z] = onDk(pinX(n), ROW_Z)
  return [x, PIN_TOP, z]
}
/** J3: 1 GND, 2 TX, 3 RX, 4 GPIO1, 5 GPIO2 … */
const j3 = (n: number): [number, number, number] => {
  const [x, , z] = onDk(pinX(n), -ROW_Z)
  return [x, PIN_TOP, z]
}

// breadboard: everything lives in the front half (rows f..j) with 3V3 on '+b' and GND on '-b'
// pot: rot 180, legs in row f (cols 3 GND, 4 wiper, 5 3V3), body toward the viewer
const potLeg = bbHole(BB, 4, 'f')
// divider: 5 V in on col 10, GPIO4 on col 14, GND on col 18
const rDtopL = bbHole(BB, 10, 'i')
const rDtopR = bbHole(BB, 14, 'i')
const rDbotL = bbHole(BB, 14, 'g')
const rDbotR = bbHole(BB, 18, 'g')
// PWM LED: GPIO5 on col 27, 150 Ω to col 23, LED anode col 23, cathode col 22
const rLedL = bbHole(BB, 23, 'h')
const rLedR = bbHole(BB, 27, 'h')
const ledCathode = bbHole(BB, 22, 'f')
const ledAnode = bbHole(BB, 23, 'f')
const sigOut: [number, number, number] = [SIG[0] + 0.75, BENCH_Y + 0.17, SIG[1] - 0.3]
const sigGnd: [number, number, number] = [SIG[0] + 0.45, BENCH_Y + 0.17, SIG[1] - 0.3]

const wires = {
  w_3v3: jumper(j1(1), bbHole(BB, 30, '+b'), 'red', 0.5),
  w_gnd: jumper(j1(22), bbHole(BB, 9, '-b'), 'black', 0.5),
  w_g4: jumper(j1(4), bbHole(BB, 14, 'j'), 'yellow', 0.9),
  w_g5: jumper(j1(5), bbHole(BB, 27, 'j'), 'orange', 0.5),
  w_g1: jumper(j3(4), bbHole(BB, 4, 'j'), 'green', 1.4),
  w_potg: jumper(bbHole(BB, 3, 'j'), bbHole(BB, 3, '-b'), 'black', 0.12),
  w_potv: jumper(bbHole(BB, 5, 'j'), bbHole(BB, 5, '+b'), 'red', 0.12),
  w_divg: jumper(bbHole(BB, 18, 'j'), bbHole(BB, 18, '-b'), 'black', 0.12),
  w_ledg: jumper(bbHole(BB, 22, 'j'), bbHole(BB, 22, '-b'), 'black', 0.12),
  w_sig: jumper(sigOut, bbHole(BB, 10, 'j'), 'blue', 0.5),
  w_sigg: jumper(sigGnd, bbHole(BB, 7, '-b'), 'black', 0.4),
  // F1: a bare wire from the 5 V column straight to the GPIO4 column; F2: a jumper in place of the 150 Ω
  j_direct: jumper(bbHole(BB, 10, 'h'), bbHole(BB, 14, 'h'), 'blue', 0.22),
  j_nor: jumper(rLedL, rLedR, 'green', 0.22),
}

/** a wire part; an empty label leaves the short rail hops without a callout */
const W = (id: keyof typeof wires, label: string, role: string, callout: [number, number, number], hidden = false) => ({
  id,
  kind: 'wire' as const,
  pos: wires[id].pos,
  params: { ...wires[id].params, callout },
  mount: 'offboard' as const,
  ...(label ? { label } : {}),
  role,
  ...(hidden ? { hidden: true } : {}),
})

/** ESP32-S3 absolute maximum on any pin: VDD + 0.3 V */
const PIN_MAX_V = 3.6

const sketch = `#include <WiFi.h>

#define RGB_PIN 48      // DevKitC-1 v1.0. Use 38 on v1.1 boards
#define LED_PIN 5
#define SIGNAL_PIN 4
#define POT_PIN 1       // ADC1: still works while WiFi is on

unsigned long lastReport = 0;
int hue = 0;

void setRgbFromHue(int h) {      // h = 0..299, three 100-step ramps
  int r = 0;
  int g = 0;
  int b = 0;
  if (h < 100) {
    r = 100 - h;  g = h;
  } else if (h < 200) {
    g = 200 - h;  b = h - 100;
  } else {
    b = 300 - h;  r = h - 200;
  }
  rgbLedWrite(RGB_PIN, r / 2, g / 2, b / 2);   // keep it dim: max ~50
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(SIGNAL_PIN, INPUT);

  WiFi.mode(WIFI_STA);
  WiFi.begin("atelier-bench", "breadboard");
  Serial.print("Connecting");
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    rgbLedWrite(RGB_PIN, 40, 20, 0);   // amber blink = waiting
    delay(125);
    rgbLedWrite(RGB_PIN, 0, 0, 0);
    delay(125);
    Serial.print(".");
    tries++;
  }
  Serial.println("");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi failed, running offline");
  }
}

void loop() {
  int raw = analogRead(POT_PIN);              // 0..4095 on the S3
  analogWrite(LED_PIN, map(raw, 0, 4095, 0, 255));

  hue = (hue + 1) % 300;
  setRgbFromHue(hue);

  if (millis() - lastReport >= 1000) {
    lastReport = millis();
    Serial.print("core:");
    Serial.print(xPortGetCoreID());
    Serial.print(",rssi:");
    Serial.print(WiFi.RSSI());
    Serial.print(",pot:");
    Serial.print(raw);
    Serial.print(",sig:");
    Serial.println(digitalRead(SIGNAL_PIN));
  }
  delay(20);
}
`

export const lesson: LessonDef = {
  id: 'esp32-s3',
  fig: 4,
  track: 'T4',
  title: 'ESP32-S3 DevKitC-1',
  subtitle: 'Two cores, WiFi, 3.3 V',
  tagline: 'A dual-core 240 MHz chip with WiFi and Bluetooth LE whose pins are rated to only 3.6 V, so a 5 V signal has to go through a divider first.',

  board: {
    name: 'ESP32-S3-DevKitC-1',
    size: [10.8, 9.6],
    base: 'breadboard-only',
    parts: [
      // first on purpose: the bench currently drops the first part's callout, and this rail hop has none
      W('w_potg', '', 'Pot end to GND.', [0, 0.4, 0]),
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', label: 'BREADBOARD', role: 'Holds the pot, the divider and the PWM LED.', params: { callout: [-1.0, 0.6, -2.6] } },
      {
        id: 'devkit',
        kind: 'module',
        pos: [DK[0], BENCH_Y, DK[1]],
        rot: DK_ROT,
        mount: 'module',
        label: 'DEVKITC-1',
        role: 'The ESP32-S3-DevKitC-1 board: it carries the module, two USB-C ports, the USB-UART bridge, the 3.3 V LDO, BOOT/RST and the RGB LED. The red PWR LED lights when 3.3 V is present.',
        params: { w: DK_W, d: DK_D, pins: 0, chip: 'none', title: 'ESP32-S3-DEVKITC-1', color: '#1d2230', callout: [-1.2, 0.1, 3.2] },
      },
      {
        id: 'u1',
        kind: 'wifi-module',
        pos: onDk(-1.9, 0),
        rot: 90 + DK_ROT,
        mount: 'smd',
        label: 'WROOM-1',
        role: 'ESP32-S3-WROOM-1 (18 × 25.5 mm): dual-core Xtensa LX7 up to 240 MHz, 512 KB SRAM, flash (8 MB on the common N8 variant), 2.4 GHz WiFi + BLE 5 and a PCB antenna. The 40 MHz crystal and the flash sit under the metal can.',
        params: { marking: 'ESP32-S3\nWROOM-1', callout: [1.6, 1.0, 0.9] },
        circuitIds: ['i_module'],
      },
      {
        id: 'j_uart',
        kind: 'usb-c',
        pos: onDk(2.85, 0.6),
        rot: 90 + DK_ROT,
        mount: 'smd',
        label: 'UART',
        role: 'USB-C to the on-board USB-UART bridge: programming plus Serial.',
        params: { callout: [-1.5, 1.6, -1.0] },
        circuitIds: ['v_usb', 'usb_plug'],
      },
      {
        id: 'j_usb',
        kind: 'usb-c',
        pos: onDk(2.85, -0.32),
        rot: 90 + DK_ROT,
        mount: 'smd',
        label: 'USB',
        role: "The S3's own USB (GPIO19/20). It can act as a native USB device or JTAG.",
        params: { callout: [-1.9, 0.9, 0.2] },
      },
      {
        id: 'u2',
        kind: 'ic-smd',
        pos: onDk(0.6, 0.1),
        rot: DK_ROT,
        mount: 'smd',
        label: 'USB-UART',
        role: 'Converts USB to UART0 (GPIO43/44). The chip varies by revision (CP2102N-class on early boards). Read the marking.',
        params: { package: 'QFN', pins: 24, marking: 'UART', callout: [0.6, 0.2, 2.6] },
      },
      {
        id: 'u3',
        kind: 'ic-smd',
        pos: onDk(-0.42, 0.1),
        rot: DK_ROT,
        mount: 'smd',
        label: '3V3 LDO',
        role: '5 V to 3.3 V for the module and the 3V3 pins. The part number varies by revision; check the schematic for your board.',
        params: { package: 'SOIC', pins: 4, marking: 'LDO', callout: [1.4, 0.2, 2.4] },
        circuitIds: ['ldo'],
      },
      {
        id: 'led_rgb',
        kind: 'led-smd',
        pos: onDk(1.35, -0.05),
        rot: DK_ROT,
        mount: 'smd',
        label: 'RGB',
        role: 'Addressable RGB LED (WS2812-compatible) on GPIO48 on v1.0 boards, GPIO38 on v1.1 boards.',
        params: { size: '1206', color: 'white', rgbFrom: 'ws2812', callout: [-0.6, 0.2, 2.4] },
        circuitIds: ['pin_rgb', 'i_rgb'],
      },
      {
        id: 'sw_boot',
        kind: 'button',
        pos: onDk(2.0, 0.55),
        rot: DK_ROT,
        mount: 'smd',
        label: 'BOOT',
        role: 'Holds GPIO0 low at reset to enter the ROM bootloader.',
        params: { callout: [-1.9, 0.9, -0.2] },
        color: '#e9e4d8',
      },
      {
        id: 'sw_rst',
        kind: 'button',
        pos: onDk(2.0, -0.55),
        rot: DK_ROT,
        mount: 'smd',
        label: 'RST',
        role: 'Pulls EN low, which resets the chip.',
        params: { callout: [-1.3, 0.5, 0.9] },
        color: '#e9e4d8',
      },
      {
        id: 'h1',
        kind: 'header-male',
        pos: onDk(0, ROW_Z),
        rot: DK_ROT,
        mount: 'tht',
        label: 'J1',
        role: 'J1, 22 pins: 3V3, 3V3, RST, GPIO4, GPIO5 … 5V, GND. Pins point up here so jumper leads can push on.',
        params: { pins: 22, pinLength: PIN_LEN, callout: [3.3, 0.6, 0.4] },
      },
      {
        id: 'h2',
        kind: 'header-male',
        pos: onDk(0, -ROW_Z),
        rot: DK_ROT,
        mount: 'tht',
        label: 'J3',
        role: 'J3, 22 pins: GND, TX, RX, GPIO1, GPIO2 … with GPIO0 and GPIO48 further along.',
        params: { pins: 22, pinLength: PIN_LEN, callout: [3.0, 0.5, 0.9] },
      },
      {
        id: 'pot',
        kind: 'potentiometer',
        pos: [potLeg[0], potLeg[1], potLeg[2] + 0.4],
        rot: 180,
        mount: 'tht',
        label: 'POT',
        role: '10 kΩ pot: 0–3.3 V into GPIO1 (ADC1_CH0, 12-bit).',
        params: { callout: [-0.6, 1.4, -1.2] },
        circuitIds: ['pot'],
      },
      {
        id: 'r_dtop',
        kind: 'resistor',
        pos: between(rDtopL, rDtopR),
        mount: 'tht',
        label: '10 kΩ',
        role: 'Divider top, 10 kΩ (brown-black-orange): with 20 kΩ below it scales 5 V to 3.33 V for GPIO4.',
        params: { ohms: 10_000, callout: [-0.6, 1.2, 0.5] },
        circuitIds: ['r_dtop'],
      },
      {
        id: 'r_dbot',
        kind: 'resistor',
        pos: between(rDbotL, rDbotR),
        mount: 'tht',
        label: '20 kΩ',
        role: 'Divider bottom, 20 kΩ (red-black-orange): 5 × 20/30 = 3.33 V.',
        params: { ohms: 20_000, callout: [0.2, 1.5, -1.3] },
        circuitIds: ['r_dbot'],
      },
      {
        id: 'r_led',
        kind: 'resistor',
        pos: between(rLedL, rLedR),
        mount: 'tht',
        label: '150 Ω',
        role: 'Limits the external LED on GPIO5: (3.3 − 1.8)/0.01 = 150 Ω for 10 mA (brown-green-brown).',
        params: { ohms: 150, callout: [0.6, 1.4, -1.2] },
        circuitIds: ['r_led'],
      },
      {
        id: 'led_ext',
        kind: 'led',
        pos: between(ledCathode, ledAnode),
        mount: 'tht',
        label: 'PWM LED',
        role: '5 mm red LED: its brightness follows analogWrite on GPIO5. Long leg (anode) toward the resistor.',
        params: { color: 'red', callout: [-0.9, 1.4, -1.4] },
        circuitIds: ['led_ext'],
      },
      {
        id: 'sig5',
        kind: 'module',
        pos: [SIG[0], BENCH_Y, SIG[1]],
        mount: 'offboard',
        label: '5V SIGNAL',
        role: 'A 5 V logic output (an Uno pin, say), toggling between 0 and 5 V once a second.',
        params: { w: 2.2, d: 1.2, pins: 0, chip: 'soic', chipLabel: '5V', title: '5 V LOGIC', color: '#2b59c3', callout: [0.4, 0.2, 1.9] },
        circuitIds: ['v_sig'],
      },
      W('w_3v3', '3V3', '3V3 pin to the + rail.', [0.9, 0.5, 0.3]),
      W('w_gnd', 'GND', 'GND pin to the − rail.', [-0.6, 0.5, 0.4]),
      W('w_g4', 'GPIO4', 'GPIO4 reads the divided 5 V signal.', [0.0, 0.6, 0.5]),
      W('w_g5', 'GPIO5', 'GPIO5 drives the LED with PWM.', [0.6, 0.6, 0.2]),
      W('w_g1', 'GPIO1', 'GPIO1 (ADC1_CH0) reads the pot wiper.', [-0.4, 0.6, 0.8]),
      W('w_potv', '', 'Pot end to 3.3 V.', [0, 0.4, 0]),
      W('w_divg', '', 'Divider bottom to GND.', [0, 0.4, 0]),
      W('w_ledg', '', 'LED cathode to GND.', [0, 0.4, 0]),
      W('w_sig', '5V OUT', 'The 5 V signal into the top of the divider.', [-0.9, 0.6, 0.2]),
      W('w_sigg', '', 'Common ground with the 5 V device.', [0, 0.4, 0]),
      W('j_direct', 'DIRECT', 'A bare wire: the 5 V signal straight into GPIO4.', [0.2, 1.4, -1.2], true),
      W('j_nor', 'JUMPER', 'A bare jumper where the 150 Ω resistor should be.', [0.6, 1.4, -1.2], true),
    ],
  },

  circuit: {
    elements: [
      { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5.0, rInternal: 0.3, partId: 'j_uart' },
      { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', '5v'], closed: false, partId: 'j_uart' },
      // LDO model: a unity buffer clamped to 3.3 V (no dropout, current limit or input current)
      { id: 'ldo', type: 'OPAMP', nodes: ['5v', '3v3', '3v3'], vPos: 3.3, vNeg: 0, partId: 'u3' },
      { id: 'c_3v3', type: 'C', nodes: ['3v3', '0'], value: 22e-6, rating: { maxV: 10 }, partId: 'devkit' },
      // about 40–50 mA with the CPU active and no radio; set every tick by wifi-sim
      { id: 'i_module', type: 'I', nodes: ['3v3', '0'], value: 0.045, partId: 'u1' },
      { id: 'pin_rgb', type: 'PIN', nodes: ['g48', '0'], pin: 48, vcc: 3.3, partId: 'u1' },
      { id: 'i_rgb', type: 'I', nodes: ['3v3', '0'], value: 0, partId: 'led_rgb' },
      { id: 'pin5', type: 'PIN', nodes: ['g5', '0'], pin: 5, vcc: 3.3, rating: { maxI: 0.04, maxV: PIN_MAX_V }, partId: 'u1' },
      { id: 'r_led', type: 'R', nodes: ['g5', 'led_a'], value: 150, rating: { maxP: 0.25 }, partId: 'r_led' },
      { id: 'led_ext', type: 'LED', nodes: ['led_a', '0'], color: 'red', rating: { maxI: 0.03 }, partId: 'led_ext' },
      // 10 kΩ pot: end A at GND, wiper on GPIO1, end B at 3.3 V
      { id: 'pot', type: 'POT', nodes: ['0', 'g1', '3v3'], value: 10_000, pos: 0.5, partId: 'pot' },
      // stand-in for a 5 V device: toggled 0/5 V at 1 Hz by wifi-sim
      { id: 'v_sig', type: 'V', nodes: ['s5', '0'], value: 5.0, partId: 'sig5' },
      { id: 'r_dtop', type: 'R', nodes: ['s5', 'g4'], value: 10_000, partId: 'r_dtop' },
      { id: 'r_dbot', type: 'R', nodes: ['g4', '0'], value: 20_000, partId: 'r_dbot' },
      // INPUT. The absolute maximum is VDD + 0.3 V = 3.6 V, but with the clamp in place the damage comes from the
      // clamp's current: GPIO4 dies with d_esd (F1), not the instant the voltage passes 3.6 V (that only warns)
      { id: 'pin4', type: 'PIN', nodes: ['g4', '0'], pin: 4, vcc: 3.3, partId: 'u1' },
      // internal ESD clamp to VDD. 5 mA is a teaching threshold: Espressif publishes no injection-current rating
      { id: 'd_esd', type: 'D', nodes: ['g4', '3v3'], is: 1e-12, n: 1.5, rating: { maxI: 0.005, failMode: 'short' }, partId: 'u1' },
      // strapping pin: the internal pull-up (about 45 kΩ) holds it high at reset
      { id: 'r_pu0', type: 'R', nodes: ['3v3', 'g0'], value: 45_000, partId: 'u1' },
      { id: 'pin0', type: 'PIN', nodes: ['g0', '0'], pin: 0, vcc: 3.3, partId: 'u1' },
    ],
  },
  powerElementId: 'usb_plug',
  powerLabel: 'Plug USB-C',

  readouts: [
    { label: '3V3 RAIL', source: { kind: 'voltage', node: '3v3' }, unit: 'V' },
    { label: 'MODULE (mA)', source: { kind: 'behavior', key: 'wifi.module_mA' }, unit: '' },
    { label: 'GPIO4 (DIVIDED)', source: { kind: 'voltage', node: 'g4' }, unit: 'V' },
    { label: 'GPIO5 LED', source: { kind: 'current', elementId: 'led_ext' }, unit: 'A' },
    { label: 'POT (GPIO1)', source: { kind: 'voltage', node: 'g1' }, unit: 'V' },
    { label: 'WIFI RSSI', source: { kind: 'behavior', key: 'wifi.rssi' }, unit: 'dBm' },
  ],

  sketch: {
    title: 'S3 hello',
    code: sketch,
    pins: { 48: 'pin_rgb', 5: 'pin5', 4: 'pin4', 0: 'pin0' },
    // the S3 reads analog inputs by GPIO number: analogRead(1) is GPIO1 (ADC1_CH0), 12-bit
    analogPins: { '1': 'g1' },
    vcc: 3.3,
    board: 'esp32s3',
  },

  tweaks: [
    { label: 'Pot position', elementId: 'pot', key: 'pos', min: 0, max: 1, step: 0.01, unit: '' },
    { label: 'Divider bottom', elementId: 'r_dbot', key: 'value', min: 4700, max: 100_000, log: true, unit: 'Ω' },
    { label: 'LED resistor', elementId: 'r_led', key: 'value', min: 47, max: 1000, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: loop() on core 1, WiFi on core 0, RGB cycling.' },
    { when: { kind: 'above', readout: 2, value: 3.6 }, text: 'WARNING: GPIO4 is above VDD + 0.3 V: the clamp diode is conducting.' },
    { when: { kind: 'below', readout: 0, value: 3.0 }, text: 'WARNING: 3.3 V rail is low: brown-out is likely during a WiFi burst.' },
  ],

  failures: [
    {
      id: 'direct-5v',
      label: 'Wire a 5 V signal straight into GPIO4',
      explain:
        "GPIO4 climbs to about 4.2 V, held there only by the internal ESD diode conducting into the 3.3 V rail. The clamp carries (5 − 4.2)/100 ≈ 8 mA (the 100 Ω stands in for the wire and the source's output), so after 300 ms it burns short: GPIO4 is dead, stuck at the 3.3 V rail and reading HIGH whatever the signal does. The ESP32-S3's absolute maximum on any pin is VDD + 0.3 V; the ESD diodes absorb a static zap, not a steady current. A 10 k/20 k divider, a level shifter (e.g. 74LVC1T45) or an open-drain output pulled up to 3.3 V are the safe options.",
      patches: [
        { op: 'remove', elementId: 'r_dbot' },
        { op: 'set', elementId: 'r_dtop', key: 'value', value: 100 },
      ],
      parts: { hide: ['r_dtop', 'r_dbot'], show: ['j_direct'] },
    },
    {
      id: 'no-resistor',
      label: 'LED with no resistor on GPIO5',
      explain:
        'About (3.3 − 2.0)/25 ≈ 50 mA flows, above the 40 mA rating, so the pin is dead. At 3.3 V there is less headroom, but the LED still has almost no resistance. The S3 datasheet rates source current at about 40 mA at the strongest drive setting (20 mA at the default). Treat 20 mA as the budget.',
      patches: [{ op: 'short', a: 'g5', b: 'led_a' }],
      parts: { hide: ['r_led'], show: ['j_nor'] },
    },
    {
      id: 'boot-held',
      label: 'Button on GPIO0 held at power-up',
      explain:
        'The sketch never starts: Serial prints "waiting for download" and the RGB LED stays dark. GPIO0 is a strapping pin. The ROM samples it at reset, and LOW selects the USB/UART bootloader (the bench treats this as a re-plug so you see it at once). GPIO3, 45 and 46 are also strapping pins. Do not hang buttons or pull-downs on them unless you mean to.',
      patches: [{ op: 'add', element: { id: 'boot_held', type: 'SW', nodes: ['g0', '0'], closed: true } }],
    },
  ],

  meet: `The DevKitC-1 is a breakout for the **ESP32-S3-WROOM-1** module. Inside the metal can are the S3 chip, a 40 MHz crystal and SPI flash, with the antenna as copper on the module's PCB. The dev board adds a USB-UART bridge, a second USB-C wired to the S3's native USB, a 3.3 V LDO, BOOT and RST buttons, and an RGB LED.

**Compared with the Uno:** two 32-bit cores at up to 240 MHz instead of one 8-bit core at 16 MHz (15 times the clock, and much more work per clock), and 512 KB of SRAM against 2 KB. The ADC is 12-bit (0–4095), and there is WiFi plus BLE 5.

**The catch is 3.3 V.** A 5 V signal must be divided first. Choose 10 kΩ and 20 kΩ: 5 × 20/(10 + 20) = **3.33 V**, and the load on the source is only 5 V/30 kΩ = 0.17 mA.

**LED maths at 3.3 V.** A red LED needs (3.3 − 1.8)/0.01 = **150 Ω** for 10 mA, and a blue one (2.9 V) has only 0.4 V left to drop. Use 47 Ω for blue, or drive it from 5 V through a transistor.

**RGB LED.** Espressif's v1.0 boards put it on GPIO48 and v1.1 boards on GPIO38. Check the revision on your board's silkscreen or the seller's page.

**Power.** A WiFi burst can pull a few hundred mA. A 22 µF capacitor on 3.3 V and a decent cable prevent brown-out resets.`,

  mechanicalAnalogy: `Think of the Uno as a single-cylinder engine with a direct linkage. The S3 is a twin with a turbo and an onboard radio. Core 0 is a dedicated governor running the WiFi stack, so your \`loop()\` on core 1 gets the other cylinder. The 3.3 V logic is a lower-pressure hydraulic system: plumb in a 5 V line without a reducer (the divider) and you blow the seals (the ESD diodes).

**Where it breaks:** the two cores share memory and peripherals, so they are less independent than two engines on separate shafts. A busy radio can still delay your code.`,

  proTips: [
    'Use the ADC1 pins (GPIO1–10) for analog inputs in WiFi projects. The WiFi driver also uses ADC2 (GPIO11–20), and reads there can fail or be delayed while the radio is on.',
    'Keep clear of GPIO26–32 (SPI flash/PSRAM), GPIO35–37 on modules with octal PSRAM, GPIO19/20 if you need native USB, and GPIO43/44 if you want Serial on the UART port. Check your module variant (N8, N8R8 and so on) in the datasheet\'s pin table.',
    'Many 5 V modules (HC-SR04, some relay boards) accept 3.3 V as a valid HIGH input but send back 5 V outputs. Divide every line that goes into the S3. Lines that go out to them usually work as they are.',
  ],

  quiz: [
    {
      q: 'You divide a 5 V signal with a 10 kΩ top resistor. Which bottom resistor gives about 3.3 V?',
      options: ['4.7 kΩ', '10 kΩ', '20 kΩ', '47 kΩ'],
      answer: 2,
      why: '5 × R/(10k + R) = 3.3 gives R ≈ 19.4 kΩ, so 20 kΩ gives 3.33 V.',
    },
    {
      q: 'A green LED (Vf 2.1 V) on a 3.3 V pin at 10 mA needs which resistor?',
      options: ['68 Ω', '120 Ω', '330 Ω', '1 kΩ'],
      answer: 1,
      why: '(3.3 − 2.1)/0.010 = 120 Ω.',
    },
    {
      q: 'On a DevKitC-1 v1.1, which GPIO drives the onboard RGB LED?',
      options: ['GPIO2', 'GPIO38', 'GPIO48', 'GPIO13'],
      answer: 1,
      why: 'Espressif moved it from GPIO48 (v1.0) to GPIO38 (v1.1). Always check your revision.',
    },
    {
      q: 'The board averages 100 mA with WiFi on. How long does a 2000 mAh power bank last, ignoring conversion losses?',
      options: ['2 h', '20 h', '200 h', '2000 h'],
      answer: 1,
      why: '2000 mAh / 100 mA = 20 h. In practice the 5 V boost and the LDO losses take 15–30 % off that.',
    },
  ],

  behaviors: [
    { id: 'ws2812', instance: 'ws2812', params: { pinElement: 'pin_rgb', currentElement: 'i_rgb' } },
    { id: 'wifi-sim', instance: 'wifi', params: { ssid: 'atelier-bench', moduleElement: 'i_module', sigElement: 'v_sig' } },
    { id: 'esp32-boot', instance: 'boot', params: { strapNode: 'g0', railNode: '3v3' } },
  ],
  transient: true,
}
