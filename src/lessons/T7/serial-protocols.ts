// T7 · UART, I²C and SPI. Source: docs/curriculum/T7/serial-protocols.md
//
// One Uno drives three buses: UART TX (pin 1) into a USB-UART adapter's RX, I²C (A4/A5) to a GY-521
// (`imu-mpu6050`, register-level at 0x68) with 4.7 kΩ pull-ups and 100 pF of bus capacitance in the
// netlist, and hardware SPI (pins 11/13, latch on 10) into a 74HC595 (`hc595`) lighting an 8-LED bar.
// The `logic-analyzer` behavior taps the MCU's Serial / Wire / SPI calls, lays the bits out at the
// real bit rate (I²C rising edges at the RC rate of the live pull-up and capacitance values) and
// decodes them for the Logic analyzer tab of the instrument panel.
import type { Element, LessonDef } from '../../engine/types'
import { PITCH, jumper } from '../layout'

// ── bench layout: an 18 × 9.5 PCB. The Uno on the right (rot 0: digital header on its −x edge, facing
// the 74HC595; analog header on +x, toward the GY-521 behind it). The LED bar along the front left, the
// USB-UART adapter at the back, the analyzer off the board at the back left ──
const UNO_AT: [number, number] = [5.0, 0.6]
const HY = 0.16 + 0.85
/** Uno digital socket (−x edge) */
const unoD = (pin: number): [number, number, number] => {
  const lx = pin < 8 ? 2.35 + (3.5 - pin) * PITCH : -0.25 + (4.5 - (pin - 8)) * PITCH
  return [UNO_AT[0] - 2.4, HY, UNO_AT[1] - lx]
}
/** Uno analog socket A0..A5 (+x edge) */
const unoA = (i: number): [number, number, number] => [UNO_AT[0] + 2.4, HY, UNO_AT[1] - (1.95 + (i - 2.5) * PITCH)]

const DIP: [number, number] = [-0.8, 0.4]
/** 74HC595 pin 9..16 along the back row (pin 16 above pin 1) */
const dipBack = (p: number): [number, number, number] => [DIP[0] + (16 - p - 3.5) * PITCH, 0.42, DIP[1] - 0.381]
/** pin 1..8 along the front row */
const dipFront = (p: number): [number, number] => [DIP[0] + (p - 1 - 3.5) * PITCH, DIP[1] + 0.381]

const GY: [number, number] = [5.6, -3.5]
const gyPin = (i: number): [number, number, number] => [GY[0] + (i - 3.5) * PITCH, 0.62, GY[1] + 0.67] // VCC GND SCL SDA XDA XCL AD0 INT
const AD: [number, number] = [-2.2, -3.4]
const adPin = (i: number): [number, number, number] => [AD[0] + (i - 2.5) * PITCH, 0.62, AD[1] + 0.57] // DTR RX TX VCC CTS GND

const LED_X = (k: number) => -5.6 + k * 0.62
const LED_Z = 3.3
const RES_Z = 2.0

type Wire = ReturnType<typeof jumper>
const wire = (w: Wire, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const SKETCH = `#include <Wire.h>
#include <SPI.h>

#define MPU_ADDR 0x68
#define LATCH 10

// Write one register over I2C. Returns the Wire status (0 = ACK, 2 = address NACK).
int writeReg(int reg, int value) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission();
}

// Read n bytes starting at reg into buf. Returns how many arrived.
int readRegs(int reg, int buf[], int n) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {   // repeated START follows
    return 0;
  }
  Wire.requestFrom(MPU_ADDR, n);
  int got = 0;
  while (Wire.available() && got < n) {
    buf[got] = Wire.read();
    got++;
  }
  return got;
}

void show(int bits) {                       // 8 LEDs via the 74HC595
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  digitalWrite(LATCH, LOW);
  SPI.transfer(bits);
  digitalWrite(LATCH, HIGH);                // rising edge copies to the outputs
  SPI.endTransaction();
}

int buf[2];

void setup() {
  Serial.begin(115200);                     // 8.68 us per bit
  pinMode(LATCH, OUTPUT);
  digitalWrite(LATCH, HIGH);
  SPI.begin();
  Wire.begin();
  Wire.setClock(100000);                    // standard mode

  int who[1];
  who[0] = 0;
  readRegs(0x75, who, 1);
  Serial.print("WHO_AM_I=0x");
  Serial.println(who[0], HEX);              // expect 0x68
  Serial.print("wake status ");
  Serial.println(writeReg(0x6B, 0x00));     // clear the sleep bit
}

void loop() {
  if (readRegs(0x3B, buf, 2) == 2) {
    int ax = (buf[0] << 8) | buf[1];        // 16-bit int: the sign comes for free
    int level = map(constrain(ax, -16384, 16384), -16384, 16384, 0, 8);
    int bits = 0;
    for (int i = 0; i < level; i++) {
      bits = (bits << 1) | 1;               // bar graph: 'level' LEDs lit
    }
    show(bits);
    Serial.print("ax:");
    Serial.print(ax);
    Serial.print(",bar:");
    Serial.println(level);
  } else {
    Serial.println("I2C read failed");
  }
  delay(100);
}
`

// 74HC595 outputs: a high-side switch per bit (LOW = open, so the LED is off), ~50 Ω output
// resistance, 1 kΩ and a green LED. VCC current comes in through a 10 mΩ sense element.
const bar: Element[] = []
for (let k = 0; k < 8; k++) {
  bar.push({ id: `q${k}`, type: 'SW', nodes: ['v595', `q${k}_i`], closed: false, partId: 'u595' })
  bar.push({ id: `rq${k}`, type: 'R', nodes: [`q${k}_i`, `q${k}`], value: 50, rating: { maxI: 0.035 }, partId: 'u595' })
  bar.push({ id: `rl${k}`, type: 'R', nodes: [`q${k}`, `l${k}`], value: 1000, partId: `r${k}` })
  bar.push({ id: `led${k}`, type: 'LED', nodes: [`l${k}`, '0'], color: 'green', rating: { maxI: 0.02 }, partId: `led${k}` })
}

const ledParts = Array.from({ length: 8 }, (_, k) => [
  {
    id: `led${k}`,
    kind: 'led' as const,
    pos: [LED_X(k), 0, LED_Z] as [number, number, number],
    mount: 'tht' as const,
    ...(k === 0 ? { label: 'LED BAR' } : {}),
    role: `Q${k} of the 74HC595: lit when bit ${k} of the last latched byte is 1 (about 2.8 mA).`,
    params: { color: 'green', ...(k === 0 ? { callout: [-0.6, 1.2, 0.6] } : {}) },
    circuitIds: [`led${k}`],
  },
  {
    id: `r${k}`,
    kind: 'resistor' as const,
    pos: [LED_X(k), 0, RES_Z] as [number, number, number],
    rot: 90,
    mount: 'tht' as const,
    ...(k === 7 ? { label: '1k ×8' } : {}),
    role: '1 kΩ: (5 − 2.0) V / 1 kΩ ≈ 3 mA per LED, so all eight draw about 24 mA, well inside the 595\'s 70 mA VCC limit.',
    params: { ohms: 1000, ...(k === 7 ? { callout: [0.6, 1.0, -0.4] } : {}) },
    circuitIds: [`rl${k}`],
  },
]).flat()

export const lesson: LessonDef = {
  id: 'serial-protocols',
  track: 'T7',
  title: 'UART, I²C and SPI',
  subtitle: 'Reading the wire',
  tagline: 'At 115 200 baud a byte takes 86.8 µs on the wire. At 400 kHz an I²C bus with 4.7 kΩ pull-ups and 100 pF already misses its 300 ns rise-time limit.',

  board: {
    name: 'PROTOCOL BENCH',
    size: [18, 9.5],
    base: 'mat',
    traces: [
      // 595 outputs Q0..Q7 (front row and QA on the back) to the LED resistors
      ...Array.from({ length: 7 }, (_, k): [number, number][] => [dipFront(k + 1), [dipFront(k + 1)[0], 1.2], [LED_X(k + 1), 1.4], [LED_X(k + 1), RES_Z - 0.5]]),
      [[dipBack(15)[0], dipBack(15)[2]], [dipBack(15)[0] - 0.4, -0.6], [LED_X(0) + 0.2, -0.6], [LED_X(0), RES_Z - 0.5]],
      // GY-521 carrier: header to the sensor
      [[GY[0] - 0.4, GY[1] + 0.5], [GY[0] - 0.4, GY[1] - 0.2]],
    ],
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], 0, UNO_AT[1]],
        mount: 'module',
        label: 'UNO',
        role: 'Bus master for all three: UART TX on pin 1, I²C on A4 (SDA) and A5 (SCL), hardware SPI on pins 11 (MOSI) and 13 (SCK) with the 595\'s latch on pin 10.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [0, 1.8, 1.4] },
        circuitIds: ['pin1', 'pin_sda', 'pin_scl', 'pin10', 'v_usb'],
        facts: ['ATmega328P: USART, TWI (I²C) and SPI in hardware', 'TWI clock 100 kHz by default (Wire.setClock for 400 kHz)', 'Serial.println sends CR LF after the text'],
      },
      {
        id: 'u595',
        kind: 'ic-dip',
        pos: [DIP[0], 0, DIP[1]],
        mount: 'tht',
        label: 'SPI: 74HC595',
        role: '8-bit shift register with an output latch, driven like an SPI device: SER = MOSI, SRCLK = SCK, RCLK (latch) = the "chip select" on pin 10.',
        params: { pins: 16, marking: '74HC595', callout: [0, 1.6, -0.9] },
        circuitIds: ['r595', 'q0', 'q7'],
        facts: [
          '74HC595: shifts on SRCLK rising, copies to the outputs on RCLK rising',
          'Abs. max: VCC 7 V, ±35 mA per output, ±70 mA through VCC or GND',
          'Samples on the rising edge: SPI mode 0 (mode 3 also works)',
        ],
      },
      {
        id: 'c595',
        kind: 'capacitor-ceramic',
        pos: [DIP[0] + 1.6, 0, DIP[1] - 0.2],
        mount: 'tht',
        role: '100 nF decoupling at the 595\'s VCC pin: it supplies the current spikes when all outputs switch at once.',
        params: { value: '104' },
      },
      ...ledParts,
      {
        id: 'gy521',
        kind: 'module',
        pos: [GY[0], 0, GY[1]],
        mount: 'module',
        label: 'I²C: MPU-6050',
        role: 'A GY-521 carrier: the MPU-6050 at address 0x68, its 3.3 V LDO and 4.7 kΩ pull-ups on SDA and SCL. WHO_AM_I (register 0x75) reads 0x68.',
        params: { w: 2.1, d: 1.6, pins: 8, title: 'GY-521', color: '#2b59c3', callout: [0.4, 1.3, -0.6] },
        circuitIds: ['i_mpu', 'r_sda', 'r_scl', 'ldo'],
        facts: ['MPU-6050 I²C address 0x68 (AD0 low) or 0x69 (AD0 high)', 'WHO_AM_I (0x75) = 0x68; PWR_MGMT_1 (0x6B) resets to 0x40 (asleep)', 'I²C up to 400 kHz (fast mode)', 'Bus capacitance here: about 100 pF per line (estimate: pins + 20 cm of wire)'],
      },
      {
        id: 'adapter',
        kind: 'module',
        pos: [AD[0], 0, AD[1]],
        mount: 'module',
        label: 'USB-UART',
        role: 'A USB-to-UART bridge for a second terminal: its RX input listens to the Uno\'s TX. Its own TX output idles HIGH.',
        params: { w: 2.6, d: 1.4, pins: 6, title: 'USB-UART', color: '#a23b8f', callout: [0, 1.2, -0.6] },
        circuitIds: ['r_adrx'],
        facts: ['UART idle = HIGH; a byte starts with a LOW start bit', 'Its RX must go to the other side\'s TX: TX → RX, RX ← TX'],
      },
      {
        id: 'la',
        kind: 'module',
        pos: [-6.6, 0, -3.3],
        mount: 'offboard',
        label: 'LOGIC ANALYZER',
        role: 'An 8-channel USB logic analyzer, 24 MS/s class: grabbers on TX, the adapter\'s RX, SDA, SCL, SCK, MOSI and LATCH. Open Instruments → Logic analyzer.',
        params: { w: 2.4, d: 1.8, pins: 0, title: 'LOGIC 8CH', color: '#1d1b17', callout: [0, 1.0, 0.6] },
        facts: ['24 MS/s: one sample every 41.7 ns', 'Shows logic levels only: a slow edge appears where it crosses the threshold'],
      },
      { id: 'w_tx', kind: 'wire', ...wire(jumper(unoD(1), adPin(1), 'green', 0.9), [0, 0.7, 0]), mount: 'offboard', label: 'TX → RX', role: 'Uno TX (pin 1) to the adapter\'s RX: one wire carries the UART frames.' },
      {
        id: 'w_tx_x',
        kind: 'wire',
        ...wire(jumper(unoD(1), adPin(2), 'orange', 0.9), [0, 0.7, 0]),
        mount: 'offboard',
        hidden: true,
        label: 'TX → TX',
        role: 'The classic mistake: Uno TX wired to the adapter\'s TX.',
      },
      { id: 'w_sda', kind: 'wire', ...wire(jumper(unoA(4), gyPin(3), 'blue', 0.8), [0, 0.6, 0.2]), mount: 'offboard', role: 'A4 (SDA) to the carrier\'s SDA.' },
      { id: 'w_scl', kind: 'wire', ...wire(jumper(unoA(5), gyPin(2), 'yellow', 1.0), [0, 0.7, -0.2]), mount: 'offboard', role: 'A5 (SCL) to the carrier\'s SCL.' },
      { id: 'w_mosi', kind: 'wire', ...wire(jumper(unoD(11), dipBack(14), 'blue', 0.7), [0, 0.6, 0]), mount: 'offboard', role: 'Pin 11 (MOSI) to SER, pin 14.' },
      { id: 'w_sck', kind: 'wire', ...wire(jumper(unoD(13), dipBack(11), 'yellow', 0.9), [0, 0.6, 0]), mount: 'offboard', role: 'Pin 13 (SCK) to SRCLK, pin 11.' },
      { id: 'w_latch', kind: 'wire', ...wire(jumper(unoD(10), dipBack(12), 'white', 0.5), [0, 0.5, 0]), mount: 'offboard', role: 'Pin 10 to RCLK (latch), pin 12.' },
    ],
  },

  circuit: {
    elements: [
      { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5, rInternal: 0.3, partId: 'uno' },
      { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', 'vbus_in'], closed: true, partId: 'uno' },
      { id: 'f1', type: 'R', nodes: ['vbus_in', '5v'], value: 0.3, rating: { maxI: 1.0 }, partId: 'uno' },
      { id: 'r_board', type: 'R', nodes: ['5v', '0'], value: 111, partId: 'uno' }, // the Uno's ~45 mA
      // GY-521: LDO, MPU supply, pull-ups to 3.3 V, bus capacitance, AD0 pull-down
      { id: 'ldo', type: 'OPAMP', nodes: ['5v', '3v3', '3v3'], vPos: 3.3, vNeg: 0, partId: 'gy521' },
      { id: 'i_mpu', type: 'I', nodes: ['3v3', '0'], value: 0.0039, rating: { maxV: 6 }, partId: 'gy521' },
      { id: 'r_sda', type: 'R', nodes: ['3v3', 'sda'], value: 4700, partId: 'gy521' },
      { id: 'r_scl', type: 'R', nodes: ['3v3', 'scl'], value: 4700, partId: 'gy521' },
      { id: 'c_sda', type: 'C', nodes: ['sda', '0'], value: 100e-12, partId: 'gy521' },
      { id: 'c_scl', type: 'C', nodes: ['scl', '0'], value: 100e-12, partId: 'gy521' },
      { id: 'r_ad0', type: 'R', nodes: ['ad0', '0'], value: 4700, partId: 'gy521' },
      { id: 'pin_sda', type: 'PIN', nodes: ['sda', '0'], pin: 18, vcc: 5, partId: 'uno' },
      { id: 'pin_scl', type: 'PIN', nodes: ['scl', '0'], pin: 19, vcc: 5, partId: 'uno' },
      // UART: Uno TX → wire → adapter RX (weak pull-up inside the adapter); adapter TX idles HIGH
      { id: 'pin1', type: 'PIN', nodes: ['d1', '0'], pin: 1, vcc: 5, partId: 'uno' },
      { id: 'w_tx', type: 'R', nodes: ['d1', 'ad_rx'], value: 0.05, partId: 'w_tx' },
      { id: 'v_ad', type: 'V', nodes: ['ad_vcc', '0'], value: 3.3, rInternal: 0.5, partId: 'adapter' },
      { id: 'r_adrx', type: 'R', nodes: ['ad_vcc', 'ad_rx'], value: 47000, partId: 'adapter' },
      { id: 'r_adtx', type: 'R', nodes: ['ad_vcc', 'ad_tx'], value: 1000, partId: 'adapter' },
      // SPI: pins 10 (latch), 11 (MOSI), 13 (SCK) into the 595; its VCC current through a sense element
      { id: 'pin10', type: 'PIN', nodes: ['d10', '0'], pin: 10, vcc: 5, partId: 'uno' },
      { id: 'pin11', type: 'PIN', nodes: ['d11', '0'], pin: 11, vcc: 5, partId: 'uno' },
      { id: 'pin13', type: 'PIN', nodes: ['d13', '0'], pin: 13, vcc: 5, partId: 'uno' },
      { id: 'r595', type: 'R', nodes: ['5v', 'v595'], value: 0.01, rating: { maxI: 0.07 }, partId: 'u595' },
      ...bar,
    ],
  },
  powerElementId: 'usb_plug',
  powerLabel: 'Plug USB',
  transient: true,

  behaviors: [
    { id: 'logic-analyzer', params: { laBaud: 115200, uartRx: 'ad_rx', csPin: 10 } },
    { id: 'hc595', params: { cs: 10, outs: 'q0,q1,q2,q3,q4,q5,q6,q7', vcc: '5v' } },
    { id: 'imu-mpu6050', params: { pitchSource: 'tweak', pitchDeg: -25, addr: 0x68 } },
  ],

  readouts: [
    { label: 'UART BYTE TIME', source: { kind: 'behavior', key: 'logic-analyzer.uart_byte_us' }, unit: 'µs' },
    { label: 'BYTES/S AT RX', source: { kind: 'behavior', key: 'logic-analyzer.uart_rx_rate' }, unit: '', digits: 3 },
    { label: 'FRAMING ERRORS', source: { kind: 'behavior', key: 'logic-analyzer.la_decode_errors' }, unit: 'counts' },
    { label: 'I²C RISE TIME', source: { kind: 'behavior', key: 'logic-analyzer.i2c_tr' }, unit: 's' },
    { label: 'I²C NACKS', source: { kind: 'behavior', key: 'logic-analyzer.i2c_nacks' }, unit: 'counts' },
    { label: 'SPI LAST BYTE', source: { kind: 'behavior', key: 'logic-analyzer.spi_last' }, unit: '' },
    { label: 'SDA IDLE', source: { kind: 'voltage', node: 'sda' }, unit: 'V' },
    { label: 'LED BAR CURRENT', source: { kind: 'current', elementId: 'r595' }, unit: 'A' },
  ],

  sketch: { title: 'Three buses, one sketch', code: SKETCH, pins: { 1: 'pin1', 10: 'pin10', 11: 'pin11', 13: 'pin13', 18: 'pin_sda', 19: 'pin_scl' }, vcc: 5, board: 'uno' },

  tweaks: [
    { label: 'I²C pull-ups', elementId: 'r_sda', key: 'value', min: 1000, max: 47000, log: true, unit: 'Ω', link: [{ elementId: 'r_scl', key: 'value' }] },
    { label: 'Bus capacitance', elementId: 'c_sda', key: 'value', min: 2e-11, max: 4e-10, log: true, unit: 'F', link: [{ elementId: 'c_scl', key: 'value' }] },
    {
      label: 'Analyzer baud',
      elementId: 'behavior:logic-analyzer',
      key: 'laBaud',
      kind: 'enum',
      min: 9600,
      max: 115200,
      unit: '',
      options: [
        { label: '9600', value: 9600 },
        { label: '57 600', value: 57600 },
        { label: '115 200', value: 115200 },
      ],
    },
    { label: 'Sensor tilt', elementId: 'behavior:imu-mpu6050', key: 'pitchDeg', min: -80, max: 80, step: 1, unit: '°' },
  ],

  instruments: {
    view: 'logic',
    logic: {
      channels: [
        { pin: 1, label: 'TX' },
        { node: 'ad_rx', label: 'RX (adapter)' },
        { node: 'sda', label: 'SDA' },
        { node: 'scl', label: 'SCL' },
        { pin: 13, label: 'SCK' },
        { pin: 11, label: 'MOSI' },
        { pin: 10, label: 'LATCH' },
      ],
      decode: 'i2c',
      span: 0.001,
    },
  },

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: SDA idles at {6} through the GY-521\'s pull-ups. Upload the sketch.' },
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: an I²C read, an SPI byte to the LED bar ({5}), then a UART line, every 100 ms. Open Instruments → Logic analyzer.' },
    { when: { kind: 'above', readout: 2, value: 0 }, text: 'Framing errors ({2}): the analyzer reads the line at the wrong baud. UART has no clock wire, so both ends must agree.' },
    { when: { kind: 'above', readout: 4, value: 0 }, text: 'I²C NACKs ({4}): check the pull-ups, the address and the rise time ({3}).' },
  ],

  failures: [
    {
      id: 'wrong-baud',
      label: 'Set the analyzer to 9600 baud',
      explain:
        'UART has no clock line: both ends must agree on the bit time, 8.68 µs at 115 200 versus 104.2 µs at 9600. The decoder samples each "bit" 12 real bits apart, so a 16-byte line comes out as one or two garbage characters, some with framing errors (the stop bit read LOW). The I²C and SPI rows are untouched. Garbage text, with fewer characters than were sent, is almost always a baud mismatch.',
      patches: [{ op: 'set', elementId: 'behavior:logic-analyzer', key: 'laBaud', value: 9600 }],
    },
    {
      id: 'weak-pullups',
      label: 'Fit 47 kΩ pull-ups',
      explain:
        't_r = 0.8473 × 47 kΩ × 100 pF ≈ 4.0 µs, and reaching V_IH (0.7 × VDD) takes 1.204 × RC ≈ 5.7 µs: longer than the 5 µs half-period at 100 kHz (and far longer than 1.25 µs at 400 kHz). SCL never gets HIGH before the master pulls it LOW again, the address never arrives, every transaction is NACKed (endTransmission returns 2) and the sketch prints "I2C read failed". Pull-ups trade rise time against sink current: Rmax = t_r / (0.8473 × C) = 1000 ns / (0.8473 × 100 pF) ≈ 11.8 kΩ in standard mode and 300 ns / 84.7 ps ≈ 3.5 kΩ in fast mode; Rmin = (3.3 − 0.4) V / 3 mA ≈ 970 Ω. 2.2 kΩ is a safe choice for both.',
      patches: [
        { op: 'set', elementId: 'r_sda', key: 'value', value: 47000 },
        { op: 'set', elementId: 'r_scl', key: 'value', value: 47000 },
      ],
    },
    {
      id: 'long-bus',
      label: 'Add a long cable: 400 pF per line',
      explain:
        '400 pF is the most the I²C spec allows on a bus. With 4.7 kΩ, t_r = 0.8473 × 4.7 kΩ × 400 pF ≈ 1.6 µs, over the 1000 ns standard-mode limit, yet the bus still works at 100 kHz: V_IH arrives after 2.3 µs, inside the 5 µs half-period. Out of spec is not the same as broken, but the margin against noise and temperature is gone. At the full 400 pF, standard mode needs R ≤ 1000 ns / (0.8473 × 400 pF) ≈ 2.9 kΩ.',
      patches: [
        { op: 'set', elementId: 'c_sda', key: 'value', value: 4e-10 },
        { op: 'set', elementId: 'c_scl', key: 'value', value: 4e-10 },
      ],
    },
    {
      id: 'no-pullups',
      label: 'Remove the I²C pull-ups',
      explain:
        'Devices on an I²C bus only ever pull LOW (open-drain). With no pull-up, HIGH never happens: SDA and SCL sit near 0 V, the analyzer shows flat LOW lines with no START, every transaction is NACKed and the sketch prints "I2C read failed". (A real Uno\'s Wire.begin() turns on the ATmega\'s internal 20–50 kΩ pull-ups to 5 V. They are too weak for clean edges and pull the 3.3 V sensor\'s pins above its supply, so fit real pull-ups to 3.3 V.)',
      patches: [
        { op: 'remove', elementId: 'r_sda' },
        { op: 'remove', elementId: 'r_scl' },
      ],
    },
    {
      id: 'tx-to-tx',
      label: 'Wire TX to the adapter\'s TX',
      explain:
        'TX must go to RX. With TX on TX, the adapter\'s RX is left on its pull-up: the RX lane is flat HIGH and BYTES/S AT RX drops to 0, although the TX lane still shows every frame. Two outputs are now tied together, which on real hardware can also fight (one drives HIGH while the other sends a LOW start bit). A UART that "sends but nothing arrives" is first a TX/RX swap, then a baud mismatch, then a missing common ground.',
      patches: [
        { op: 'remove', elementId: 'w_tx' },
        { op: 'add', element: { id: 'w_tx_x', type: 'R', nodes: ['d1', 'ad_tx'], value: 0.05, partId: 'w_tx_x' } },
      ],
      parts: { hide: ['w_tx'], show: ['w_tx_x'] },
    },
  ],

  meet: `**UART** is asynchronous: there is no clock wire. Each byte is a LOW start bit, 8 data bits LSB first and a HIGH stop bit (8N1), so 10 bit times per byte. At 115 200 baud that is **8.68 µs per bit** and **86.8 µs per byte**. At 9600 baud it is 104.2 µs per bit, 1.04 ms per byte, or **960 bytes/s**. The receiver resynchronizes on every start bit and samples mid-bit, so the two clocks may differ by a few percent: the last sample drifts 9.5 × the error.

**I²C** is two open-drain lines with pull-ups, shared by many devices. A transaction is START (SDA falls while SCL is HIGH), the address byte (7 bits + R/W), an ACK from the device (it pulls SDA LOW on the 9th clock), data bytes each followed by an ACK, and STOP (SDA rises while SCL is HIGH). Reading a register is write-the-register-number, **repeated START**, then read: for WHO_AM_I that is 4 bytes × 9 clocks = 36 clocks, about **360 µs** at 100 kHz. The master NACKs the last byte it reads to say "no more".

**Rise time sets the speed.** A device only pulls LOW; the pull-up has to charge the bus capacitance back up. The spec's rise time (30 % → 70 %) is t_r = R·C·ln(0.7/0.3) ≈ **0.8473·R·C**. With 4.7 kΩ and 100 pF that is **398 ns**: fine for standard mode (100 kHz, 1000 ns limit), too slow for fast mode (400 kHz, 300 ns limit). 2.2 kΩ gives 186 ns. The spec allows at most 400 pF on a bus. Try **I²C pull-ups** and **Bus capacitance** and watch the edges on the analyzer, or change \`Wire.setClock(100000)\` to \`400000\` in the code: the rise-time limit drops to 300 ns.

**SPI** is a push-pull master clock (SCK) and data (MOSI, MISO), with an active-LOW chip select per device. There is no addressing and no ACK, and it is fast: 1 MHz here, 8 µs per byte. The **mode** sets the clock's idle level (CPOL) and which edge samples the data (CPHA): modes 0 and 3 sample on SCK rising, modes 1 and 2 on falling. The 74HC595 shifts on SCK rising, with its latch (RCLK) as the "CS": its rising edge copies the shift register to the LEDs. Change \`SPI_MODE0\` to \`SPI_MODE1\` and upload: the master now changes MOSI on the rising edge, the 595 catches each bit one clock late, and the bar is shifted by one bit, while an analyzer set to mode 1 still reads the right byte. (Mode 2 changes data on the rising edge too and only works by the 595's zero hold time: don't rely on it.)

**When to use which:** UART for point-to-point links and logs, I²C for many slow sensors on two wires, SPI for speed (displays, SD cards, ADCs).`,

  mechanicalAnalogy: `UART is two people tapping Morse at an agreed rate without a metronome: if one speeds up 5 %, by the end of a word the letters are garbled. I²C is a party line on a shared pneumatic header: anyone can vent it to zero (pull LOW), the pull-up slowly repressurizes it, and the bigger the header's volume (capacitance), the slower it recovers. SPI is a dedicated drive shaft with a clutch per machine (chip select): rigid, fast and simple, but both ends must agree which way round the keyway goes (the mode).

**Where it breaks:** real "pressure" (voltage) has thresholds, not gauges. A slow-rising line doesn't read "half": it reads LOW until it crosses V_IH, and if the next clock comes first, it never reads HIGH at all.`,

  proTips: [
    'Buy a cheap 8-channel logic analyzer before your next I²C problem. Seeing a NACK, a stretched clock or a 400 ns rise on screen beats an hour of guessing.',
    'Check every I²C call\'s return value. endTransmission() returning 2 means nobody answered at that address: the most common bring-up fault (wrong address, AD0, power, pull-ups).',
    'Keep I²C on the board, or within about 30 cm. For longer runs, lower the clock, use stronger pull-ups, or switch to a differential bus (RS-485, CAN).',
    'Set the analyzer\'s sample rate to at least 4× the fastest bit rate (10× is comfortable): 1 MHz SPI wants 4–10 MS/s.',
  ],

  quiz: [
    {
      q: 'At 9600 baud, 8N1, what is the maximum throughput in bytes per second?',
      options: ['1200', '960', '9600', '76 800'],
      answer: 1,
      why: 'Each byte takes 10 bits (start, 8 data, stop), and 9600 / 10 = 960 bytes/s.',
    },
    {
      q: '4.7 kΩ pull-ups and 100 pF of bus capacitance. What is the 30–70 % rise time, and is 400 kHz in spec?',
      options: ['47 ns, yes', '186 ns, yes', '398 ns, no (limit 300 ns)', '4 µs, no'],
      answer: 2,
      why: '0.8473 × 4700 × 100e-12 ≈ 398 ns, over the 300 ns fast-mode limit.',
    },
    {
      q: 'What is the smallest I²C pull-up to 3.3 V if devices must sink at most 3 mA at VOL = 0.4 V?',
      options: ['330 Ω', '970 Ω', '2.2 kΩ', '10 kΩ'],
      answer: 1,
      why: 'Rmin = (3.3 − 0.4) V / 0.003 A ≈ 967 Ω.',
    },
    {
      q: 'Which SPI line chooses which device is listening?',
      options: ['MOSI', 'MISO', 'SCK', 'CS (chip select), active LOW, one per device'],
      answer: 3,
      why: 'SPI has no addresses. Each device listens only while its CS line is LOW.',
    },
    {
      q: 'A 74HC595 shifts on the SCK rising edge. Which master SPI modes give a correct byte by design?',
      options: ['Only mode 0', 'Modes 0 and 3', 'Modes 1 and 2', 'All four'],
      answer: 1,
      why: 'Modes 0 and 3 sample on the rising edge, with the data held steady across it. Modes 1 and 2 change the data on the rising edge; mode 1 shifts the byte by one bit.',
    },
  ],

  guide: [
    {
      id: 'plug-usb',
      title: 'Plug in USB',
      body: 'Press **Plug USB**. **SDA IDLE** reads about **3.3 V**: nothing is talking, so the GY-521\'s pull-ups hold the line HIGH.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'power' }, { kind: 'status', is: 'POWERED' }] },
      focus: { control: 'power' },
      hint: 'The power button at the top left of the bench.',
      explain: 'I²C lines are open-drain: every device can only pull them LOW. HIGH is the pull-up\'s job.',
    },
    {
      id: 'upload',
      title: 'Upload the sketch',
      body: 'Upload **Three buses, one sketch**. Every 100 ms it reads the accelerometer over I²C, sends the bar graph over SPI, then prints a line over UART. **UART BYTE TIME** reads **86.8 µs**: 10 bits at 115 200 baud.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'upload' }, { kind: 'status', is: 'RUNNING' }, { kind: 'readout', index: 0, above: 80, below: 95 }] },
      focus: { control: 'upload' },
      explain: '1 / 115 200 = 8.68 µs per bit, × 10 bits (start, 8 data, stop) = 86.8 µs per byte.',
    },
    {
      id: 'open-analyzer',
      title: 'Open the logic analyzer',
      body: 'Switch on **Instruments** and pick **Logic analyzer**. The I²C row reads **S, 0x68 W, A, 0x3B, A, Sr, 0x68 R, A**, two data bytes and **P**. Notice the SDA and SCL edges: they fall at once but rise along an RC curve.',
      check: { kind: 'instruments' },
      focus: { control: 'instruments' },
      explain: 'The device acknowledges by pulling SDA LOW on the 9th clock. The master NACKs the last byte it reads to say "no more".',
    },
    {
      id: 'stronger-pullups',
      title: 'Fit 2.2 kΩ pull-ups',
      body: 'Slide **I²C pull-ups** down to about **2.2 kΩ**. **I²C RISE TIME** falls from 398 ns to 0.8473 × 2.2 kΩ × 100 pF ≈ **186 ns**, inside even the 300 ns fast-mode limit.',
      check: { kind: 'all', of: [{ kind: 'tweak', target: 'I²C pull-ups', max: 2600 }, { kind: 'readout', index: 3, above: 1.4e-7, below: 2.3e-7, holdMs: 250 }] },
      focus: { control: 'tweak:I²C pull-ups' },
      explain: 'A smaller pull-up charges the bus capacitance faster, but the device must sink more current to pull it LOW: (3.3 − 0.4) V / 2.2 kΩ ≈ 1.3 mA, well under the 3 mA limit.',
    },
    {
      id: 'wrong-baud',
      title: 'Break it: the wrong baud',
      body: 'Open **Break something** and set the analyzer to **9600 baud**. Switch the decoder to **UART**: one or two garbage characters per line instead of 16, and **FRAMING ERRORS** start counting.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'wrong-baud' }, { kind: 'readout', index: 2, above: 0 }] },
      focus: { control: 'break' },
      explain: 'UART has no clock wire. At 9600 the decoder samples every 104 µs, about 12 real bits apart, so it reads noise.',
    },
    {
      id: 'weak-pullups',
      title: 'Break it: 47 kΩ pull-ups',
      body: 'Now fit **47 kΩ pull-ups** from **Break something**. Reaching V_IH takes 1.204 × 47 kΩ × 100 pF ≈ 5.7 µs, longer than the 5 µs half-period at 100 kHz. **I²C NACKS** climbs and the sketch prints "I2C read failed".',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'weak-pullups' }, { kind: 'readout', index: 4, above: 2 }] },
      focus: { control: 'break' },
      explain: 'SCL never gets HIGH before the master pulls it LOW again, so the device never sees its address and does not ACK.',
    },
    {
      id: 'repair',
      title: 'Repair',
      body: 'Choose **Repair all**. The NACK count resets, the UART text is readable again and the LED bar comes back.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'repair' }, { kind: 'status', is: 'RUNNING' }] },
      focus: { control: 'break' },
      explain: 'Three classic bus faults: a baud mismatch (UART), pull-ups too weak (I²C), and, in the menu, TX wired to TX.',
    },
    { id: 'quiz', title: 'Check yourself', body: 'Answer the questions below.', check: { kind: 'quiz' }, focus: { control: 'quiz' } },
  ],
}
