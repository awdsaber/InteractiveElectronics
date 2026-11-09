// T4 · Arduino Uno R3 (video Fig. 01, pinned "Start here"). Source: docs/curriculum/T4/arduino-uno.md
//
// The board is modelled from the USB 5 V rail down. The 3.3 V regulator and the VIN / barrel-jack
// path are on the 3D board only; they are not in the netlist.
import type { LessonDef, PartPlacement } from '../../engine/types'
import { BENCH_Y, PITCH, bbHole, between, jumper } from '../layout'

// ── geometry ──
// PCB 68.6 × 53.3 mm, centred on the origin. USB-B and the barrel jack on the left (−x) edge,
// the digital header along the far (−z) edge, power + analog along the near (+z) edge, exactly
// where a shield expects them (Arduino's 0.1" grid, including the 160 mil gap between D7 and D8).
const PCB: [number, number] = [6.86, 5.33]
const HEADER_H = 0.85 // female header height above the PCB top
const ROW_FAR = -2.413
const ROW_NEAR = 2.413

/** header centres (rot 0: pin index 0 at −x) */
const H_DIG_HI: [number, number] = [-0.406, ROW_FAR] // SCL SDA AREF GND 13 12 11 10 9 8
const H_DIG_LO: [number, number] = [2.032, ROW_FAR] // 7 6 5 4 3 2 1 0
const H_PWR: [number, number] = [0.254, ROW_NEAR] // NC IOREF RESET 3V3 5V GND GND VIN
const H_ANA: [number, number] = [2.286, ROW_NEAR] // A0..A5

const sock = (h: [number, number], pins: number, i: number): [number, number, number] => [
  +(h[0] + (i - (pins - 1) / 2) * PITCH).toFixed(4),
  HEADER_H,
  h[1],
]
const dPin = (p: number) => (p >= 8 ? sock(H_DIG_HI, 10, 17 - p) : sock(H_DIG_LO, 8, 7 - p))
const S_5V = sock(H_PWR, 8, 4)
const S_GND = sock(H_PWR, 8, 5)
const S_GND2 = sock(H_PWR, 8, 6)
const S_A0 = sock(H_ANA, 6, 0)

// Half-size breadboard on the mat to the right of the Uno.
const BB: [number, number] = [8.15, 0]
const h = (col: number, row: string) => bbHole(BB, col, row)

// pin 9 → 220 Ω (cols 4–8, row c) → LED anode col 8, cathode col 7 → top GND rail
const rExtL = h(4, 'c')
const rExtR = h(8, 'c')
const ledCathode = h(7, 'e')
const ledAnode = h(8, 'e')
// tactile button straddles the centre channel at col 15: pins 14 (to D2) and 16 (to GND)
const BTN_X = BB[0] + (15 - 15.5) * PITCH
// 10 kΩ pot, pins in row f (cols 20, 21, 22), body toward the viewer (rot 180: GND end at col 22)
const POT_Z = h(21, 'f')[2] + 0.4
/** breadboard hole tops: parts pushed into it stand here */
const BB_Y = h(1, 'a')[1]

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

const w9 = jumper(dPin(9), h(4, 'a'), 'yellow', 1.0)
const w2 = jumper(dPin(2), h(14, 'a'), 'blue', 0.8)
const wA0 = jumper(S_A0, h(21, 'j'), 'green', 0.9)
const w5v = jumper(S_5V, h(3, '+b'), 'red', 0.7)
const wGnd = jumper(S_GND, h(2, '-b'), 'black', 0.5)
const S_DGND = sock(H_DIG_HI, 10, 3)
const wDGnd = jumper(S_DGND, h(2, '-t'), 'black', 1.2)
const jLedGnd = jumper(h(7, 'a'), h(7, '-t'), 'black', 0.12)
const jBtnGnd = jumper(h(16, 'j'), h(16, '-b'), 'black', 0.12)
const jPotGnd = jumper(h(22, 'j'), h(22, '-b'), 'black', 0.12)
const jPot5v = jumper(h(20, 'j'), h(20, '+b'), 'red', 0.16)

// failure-only parts
const jBypass = jumper(h(4, 'd'), h(8, 'd'), 'white', 0.2)
const jShort = jumper(S_5V, S_GND2, 'white', 0.25)
const MOTOR_AT: [number, number] = [6.9, 3.95] // on the mat in front of the breadboard, terminals at +x
const wM1 = jumper(h(4, 'e'), [MOTOR_AT[0] + 1.62, BENCH_Y + 1.1, MOTOR_AT[1] - 0.42], 'yellow', 0.5)
const wM2 = jumper(h(9, '-b'), [MOTOR_AT[0] + 1.62, BENCH_Y + 1.1, MOTOR_AT[1] + 0.42], 'black', 0.4)
const PSU_AT: [number, number] = [-1.3, 4.15]
const wP1 = jumper([PSU_AT[0] + 0.7, BENCH_Y + 0.2, PSU_AT[1] - 0.45], S_5V, 'red', 0.5)
const wP2 = jumper([PSU_AT[0] + 1.0, BENCH_Y + 0.2, PSU_AT[1] - 0.45], S_GND2, 'black', 0.4)

// ── the board's own parts ──
const smd = (p: Omit<PartPlacement, 'mount'>): PartPlacement => ({ ...p, mount: 'smd' })
const tht = (p: Omit<PartPlacement, 'mount'>): PartPlacement => ({ ...p, mount: 'tht' })
const decouple = (id: string, pos: [number, number], near: string, rot = 0): PartPlacement =>
  smd({
    id,
    kind: 'capacitor-smd',
    pos,
    rot,
    role: `100 nF ceramic right at the ${near} supply pin: it hands over the nanosecond current spikes of switching logic before the long trace back to the regulator can react.`,
    params: { size: '0603', color: '#b8956a' },
  })

const boardParts: PartPlacement[] = [
  // SMD: the pick-and-place drops these in
  decouple('c3', [1.55, -0.6], 'ATmega328P'),
  decouple('c4', [1.55, 1.1], 'ATmega328P', 0),
  decouple('c5', [2.45, 0.95], 'ATmega328P AVCC (ADC)', 90),
  decouple('c6', [-0.95, -0.4], 'ATmega16U2'),
  decouple('c7', [-2.0, -0.95], 'ATmega16U2 USB', 90),
  decouple('c8', [1.05, 1.55], '3.3 V regulator', 90),
  smd({
    id: 'u1',
    kind: 'ic-smd',
    pos: [1.55, 0.25],
    rot: 45,
    label: 'MCU',
    role: 'ATmega328P, the brain: an 8-bit AVR with 32 KB flash (0.5 KB holds the bootloader), 2 KB SRAM and 1 KB EEPROM, running your sketch at 16 MHz. A DIP-28 in a socket on the classic R3; this is the TQFP-32 of the SMD edition.',
    params: { package: 'TQFP', pins: 32, marking: 'MEGA328P', callout: [0.3, 1.5, 0.3] },
    circuitIds: ['pin2', 'pin9', 'pin13', 'i_board'],
  }),
  smd({
    id: 'u2',
    kind: 'ic-smd',
    pos: [-1.45, -0.95],
    label: 'USB-SERIAL',
    role: 'ATmega16U2: turns USB into the UART on pins 0 and 1, so Serial and sketch uploads work. It is a second microcontroller running bridge firmware.',
    params: { package: 'QFN', pins: 32, marking: '16U2', callout: [-0.6, 1.4, -0.6] },
  }),
  smd({
    id: 'y2',
    kind: 'capacitor-smd',
    pos: [0.45, 0.4],
    rot: 90,
    role: '16 MHz ceramic resonator for the 328P: cheaper than a crystal and less accurate (about ±0.5 %), which is fine for UART timing and millis().',
    params: { size: '1206', color: '#9a958a', callout: [-0.4, 1.2, 0.4] },
  }),
  smd({
    id: 'u3',
    kind: 'ic-smd',
    pos: [-1.4, 1.75],
    label: '5V REG',
    role: 'NCP1117ST50T3G, a SOT-223 linear regulator: makes 5 V from the barrel jack or VIN (7–12 V recommended) and burns the difference as heat.',
    params: { package: 'SOIC', pins: 6, marking: '1117-5.0', callout: [-0.4, 1.3, 0.7] },
  }),
  smd({
    id: 'u4',
    kind: 'ic-smd',
    pos: [0.55, 1.5],
    role: 'LP2985-33 (SOT-23-5): makes the 3.3 V header pin from 5 V. Arduino rates that pin at 50 mA, so it powers small sensors, not motors or radios.',
    params: { package: 'SOIC', pins: 4, marking: '2985', callout: [0.3, 1.2, 0.8] },
  }),
  smd({
    id: 'u5',
    kind: 'ic-smd',
    pos: [0.9, -1.55],
    role: 'LMV358 dual op-amp. One half buffers pin 13 to the L LED, so the LED never loads the pin. The other half compares VIN/2 with 3.3 V to choose the supply: VIN takes over above about 6.6 V.',
    params: { package: 'SOIC', pins: 8, marking: 'LMV358', callout: [0.6, 1.2, -0.6] },
    circuitIds: ['u5a'],
  }),
  smd({
    id: 'q1',
    kind: 'ic-smd',
    pos: [-1.6, 0.35],
    role: 'FDN340P P-channel MOSFET: passes USB 5 V onto the board (about 0.1 Ω when on) and switches it off when VIN power is present, so two supplies never fight.',
    params: { package: 'SOIC', pins: 4, marking: '340P', callout: [-0.8, 1.2, 0.4] },
    circuitIds: ['q1_on'],
  }),
  smd({
    id: 'f1',
    kind: 'capacitor-smd',
    pos: [-2.25, 0.0],
    rot: 90,
    label: 'POLYFUSE',
    role: 'Resettable PTC fuse (500 mA hold): a short on the board heats it until its resistance shoots up, protecting your computer\'s USB port. It recovers once it cools.',
    params: { size: '1206', color: '#c9a64a', callout: [-0.9, 1.1, 0.3] },
    circuitIds: ['f1'],
  }),
  smd({
    id: 'd1',
    kind: 'capacitor-smd',
    pos: [-2.0, 1.1],
    role: 'M7 diode (1N4007 class, 1 A, 1000 V): blocks a barrel-jack supply wired backwards, at the cost of about 0.7 V.',
    params: { size: '1206', color: '#2b2926', callout: [-0.9, 1.0, 0.5] },
  }),
  smd({
    id: 'r1',
    kind: 'resistor-smd',
    pos: [0.4, -1.6],
    rot: 90,
    role: '1 kΩ ×4 resistor array: current limits for the ON, L, TX and RX LEDs. (5 − 2)/1000 ≈ 3 mA each, plenty for an indicator.',
    params: { ohms: 1000, size: '1206', callout: [0.0, 1.0, -0.6] },
    circuitIds: ['r_l', 'r_on'],
  }),
  smd({
    id: 'r2',
    kind: 'resistor-smd',
    pos: [-2.15, -1.55],
    role: '22 Ω in each USB data line (D+ and D−): series termination that damps ringing on the fast USB edges.',
    params: { ohms: 22, size: '0805' },
  }),
  smd({
    id: 'r3',
    kind: 'resistor-smd',
    pos: [2.55, -0.85],
    rot: 90,
    role: '10 kΩ pull-up holding the 328P\'s RESET pin high. Pressing RESET, or the 16U2 at the start of an upload, pulls it low and the bootloader starts.',
    params: { ohms: 10000, size: '0805' },
  }),
  smd({
    id: 'led_on',
    kind: 'led-smd',
    pos: [2.6, -1.75],
    role: 'Green power LED: lit whenever the 5 V rail is up (about 3 mA through 1 kΩ).',
    params: { color: 'green', callout: [0.5, 1.0, -0.4] },
    circuitIds: ['led_on'],
  }),
  smd({
    id: 'led_l',
    kind: 'led-smd',
    pos: [-0.1, -1.85],
    label: 'L',
    role: 'The "pin 13" LED, driven through the op-amp buffer: your first Blink lights this one.',
    params: { color: 'yellow', callout: [-0.3, 1.1, -0.7] },
    circuitIds: ['led_l'],
  }),
  smd({
    id: 'led_tx',
    kind: 'led-smd',
    pos: [-0.1, -1.6],
    role: 'Flickers when the 16U2 sends serial data to the computer.',
    params: { color: 'yellow' },
  }),
  smd({
    id: 'led_rx',
    kind: 'led-smd',
    pos: [-0.1, -1.35],
    role: 'Flickers when the 16U2 receives serial data (an upload, or text you type in the monitor).',
    params: { color: 'yellow' },
  }),
  smd({
    id: 'sw_rst',
    kind: 'button',
    pos: [-2.4, -2.05],
    label: 'RESET',
    role: 'Pulls RESET low: the 328P restarts, runs the bootloader for a moment, then starts your sketch again from setup().',
    params: { callout: [-0.6, 1.2, -0.5] },
    color: '#c43d2f',
  }),

  // THT: placed by hand, then soldered
  tht({
    id: 'y1',
    kind: 'crystal',
    pos: [-0.55, -0.85],
    rot: 90,
    role: '16 MHz quartz crystal for the USB chip. USB needs a crystal-grade frequency (better than ±0.25 %), tighter than a resonator gives.',
    params: { mhz: 16, callout: [0.3, 1.2, -0.5] },
  }),
  tht({
    id: 'j1',
    kind: 'usb-b',
    pos: [-3.05, -1.15],
    rot: 270,
    label: 'USB',
    role: 'USB-B socket: 5 V power (through the polyfuse) and data from the computer. This is where "Plug USB" plugs in.',
    params: { callout: [-1.0, 1.6, -0.4] },
    circuitIds: ['v_usb', 'usb_plug'],
  }),
  tht({
    id: 'j2',
    kind: 'barrel-jack',
    pos: [-2.9, 1.75],
    rot: 270,
    label: 'DC 7–12 V',
    role: '2.1 mm barrel jack, centre positive: an external supply into the 5 V regulator. 7–12 V is recommended; below 7 V the regulator drops out, above 12 V it overheats.',
    params: { callout: [-1.0, 1.5, 0.6] },
  }),
  tht({
    id: 'c1',
    kind: 'capacitor-electrolytic',
    pos: [-0.8, 1.7],
    role: '47 µF electrolytic on the VIN rail: a local reservoir that smooths the jack supply ahead of the regulator. Stripe = negative lead.',
    params: { d: 0.63, h: 0.6, callout: [-0.3, 1.3, 0.7] },
  }),
  tht({
    id: 'c2',
    kind: 'capacitor-electrolytic',
    pos: [-0.05, 1.7],
    role: '47 µF electrolytic on the 5 V rail: covers current steps (an LED switching on, a servo starting) faster than the supply behind it can.',
    params: { d: 0.63, h: 0.6, callout: [0.2, 1.3, 0.7] },
    circuitIds: ['c_5v'],
  }),
  tht({
    id: 'h_dig_hi',
    kind: 'header-female',
    pos: H_DIG_HI,
    label: 'DIGITAL',
    role: 'Digital header: D8–D13, GND, AREF and the I²C pins SDA/SCL. A ~ on the silkscreen marks a PWM pin (9, 10, 11 here).',
    params: { pins: 10, callout: [-0.6, 1.0, -0.6] },
  }),
  tht({
    id: 'h_dig_lo',
    kind: 'header-female',
    pos: H_DIG_LO,
    role: 'Digital header: D0–D7. D0/D1 are the serial lines (shared with USB), D2/D3 the external interrupts INT0/INT1, and 3, 5, 6 can PWM.',
    params: { pins: 8, callout: [0.4, 1.0, -0.6] },
  }),
  tht({
    id: 'h_pwr',
    kind: 'header-female',
    pos: H_PWR,
    label: 'POWER',
    role: 'Power header: IOREF, RESET, 3V3, 5V, GND, GND and VIN. Never feed more than 5.5 V into the 5V pin: it bypasses the regulator.',
    params: { pins: 8, callout: [-0.4, 1.0, 0.7] },
  }),
  tht({
    id: 'h_ana',
    kind: 'header-female',
    pos: H_ANA,
    label: 'ANALOG',
    role: 'Analog header: A0–A5 into the 10-bit ADC (0–1023 for 0–5 V). A4/A5 double as I²C SDA/SCL, and all six work as digital pins too.',
    params: { pins: 6, callout: [1.2, 0.8, 1.5] },
  }),
  tht({
    id: 'icsp1',
    kind: 'header-male',
    pos: [2.95, 0.25],
    rot: 90,
    role: 'In-circuit programming header for the 328P (MISO, SCK, MOSI, RESET, 5V, GND): burns a bootloader with an external programmer.',
    params: { pins: 3, rows: 2, pinLength: 0.6, callout: [0.6, 1.2, 0.2] },
  }),
  tht({
    id: 'icsp2',
    kind: 'header-male',
    pos: [-1.5, -1.95],
    role: 'In-circuit programming header for the 16U2, for reflashing the USB-serial bridge firmware.',
    params: { pins: 3, rows: 2, pinLength: 0.6 },
  }),
]

// ── the breadboard circuit ──
const benchParts: PartPlacement[] = [
  { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Half-size breadboard: holds the fade LED, the button and the pot.' },
  {
    id: 'r_ext',
    kind: 'resistor',
    pos: between(rExtL, rExtR),
    mount: 'offboard',
    label: '220 Ω',
    role: 'Limits the fade LED to about 13 mA at full duty: (5 − 1.8)/(220 + 25) Ω (red-red-brown-gold, 1/4 W).',
    params: { ohms: 220, callout: [0.2, 1.6, -0.5] },
    circuitIds: ['r_ext'],
  },
  {
    id: 'led_ext',
    kind: 'led',
    pos: between(ledCathode, ledAnode),
    mount: 'offboard',
    label: 'FADE LED',
    role: '5 mm red LED on pin 9: its brightness follows the PWM duty the pot sets. Long leg (anode) toward the resistor.',
    params: { color: 'red', callout: [-0.6, 1.5, 0.6] },
    circuitIds: ['led_ext'],
  },
  {
    id: 'btn',
    kind: 'button',
    pos: [BTN_X, BB_Y, 0],
    rot: 90,
    mount: 'offboard',
    label: 'BUTTON',
    role: '6 mm tactile button: pulls pin 2 to GND when pressed. With INPUT_PULLUP, released reads HIGH and pressed reads LOW.',
    params: { callout: [0.2, 1.5, 0.4] },
    circuitIds: ['sw_btn'],
  },
  {
    id: 'pot',
    kind: 'potentiometer',
    pos: [h(21, 'f')[0], BB_Y, POT_Z],
    rot: 180,
    mount: 'offboard',
    label: 'POT',
    role: '10 kΩ linear potentiometer: a voltage divider from 0 to 5 V into A0. Turn it and analogRead() follows from 0 to 1023.',
    params: { callout: [0.6, 1.8, 0.5] },
    circuitIds: ['pot'],
  },
  { id: 'w9', kind: 'wire', ...withCallout(w9, [0.4, 0.9, -0.4]), mount: 'offboard', role: 'Pin 9 (a ~ PWM pin) to the 220 Ω resistor.' },
  { id: 'w2', kind: 'wire', ...w2, mount: 'offboard', role: 'Pin 2 to the button. Pin 2 is also INT0, used in the next lesson.' },
  { id: 'wA0', kind: 'wire', ...wA0, mount: 'offboard', role: 'A0 to the pot wiper.' },
  { id: 'w5v', kind: 'wire', ...w5v, mount: 'offboard', role: '5 V to the bottom + rail (the pot\'s top end).' },
  { id: 'wGnd', kind: 'wire', ...wGnd, mount: 'offboard', role: 'GND to the bottom − rail.' },
  { id: 'wDGnd', kind: 'wire', ...wDGnd, mount: 'offboard', role: 'GND (next to pin 13) to the top − rail.' },
  { id: 'jLedGnd', kind: 'wire', ...jLedGnd, mount: 'offboard', role: 'LED cathode to the top GND rail.' },
  { id: 'jBtnGnd', kind: 'wire', ...jBtnGnd, mount: 'offboard', role: 'Button to the bottom GND rail.' },
  { id: 'jPotGnd', kind: 'wire', ...jPotGnd, mount: 'offboard', role: 'Pot end to GND.' },
  { id: 'jPot5v', kind: 'wire', ...jPot5v, mount: 'offboard', role: 'Pot end to 5 V.' },

  // only on the bench while a failure is active
  { id: 'motor', kind: 'dc-motor', pos: MOTOR_AT, mount: 'offboard', label: 'MOTOR', role: 'A small DC motor wired straight to pin 9.', hidden: true, params: { callout: [0, 1.8, 0.4] } },
  { id: 'wM1', kind: 'wire', ...wM1, mount: 'offboard', role: 'Pin 9 to the motor.', hidden: true },
  { id: 'wM2', kind: 'wire', ...wM2, mount: 'offboard', role: 'Motor to GND.', hidden: true },
  { id: 'jBypass', kind: 'wire', ...withCallout(jBypass, [0.2, 1.4, 0.3]), mount: 'offboard', label: 'BYPASS', role: 'A jumper around the 220 Ω resistor.', hidden: true },
  { id: 'jShort', kind: 'wire', ...withCallout(jShort, [0.3, 1.2, 0.6]), mount: 'offboard', label: 'SHORT', role: 'A stray jumper from 5V to GND on the power header.', hidden: true },
  {
    id: 'psu',
    kind: 'module',
    pos: PSU_AT,
    mount: 'offboard',
    label: '12 V',
    role: 'A 12 V bench supply.',
    hidden: true,
    params: { w: 2.4, d: 1.3, color: '#3b4250', title: 'BENCH PSU 12.0 V', pins: 0, callout: [0, 1.2, 0.6] },
  },
  { id: 'wP1', kind: 'wire', ...wP1, mount: 'offboard', role: '12 V into the 5V pin.', hidden: true },
  { id: 'wP2', kind: 'wire', ...wP2, mount: 'offboard', role: 'Supply ground to GND.', hidden: true },
]

// decorative copper: USB power path, jack → diode → regulator, serial between the chips, and the
// MCU fanning out to its headers
const traces: [number, number][][] = [
  [[-2.45, -1.15], [-2.25, -0.95], [-2.25, -0.25]],
  [[-2.25, 0.25], [-2.25, 0.35], [-1.85, 0.35]],
  [[-1.35, 0.35], [-0.95, 0.75], [-0.05, 0.75], [-0.05, 1.35]],
  [[-0.05, 0.75], [0.85, 0.75], [1.15, 0.6]],
  [[-2.55, 1.55], [-2.3, 1.1], [-2.2, 1.1]],
  [[-1.8, 1.1], [-1.6, 1.3], [-1.6, 1.55]],
  [[-1.15, 1.75], [-1.05, 1.95], [-0.8, 2.0]],
  [[-2.45, -1.35], [-2.0, -1.35], [-1.75, -1.15]],
  [[-2.45, -1.05], [-1.95, -0.75], [-1.7, -0.75]],
  [[-1.15, -0.95], [-0.3, -0.45], [0.75, -0.45], [1.15, -0.15]],
  [[-1.15, -1.05], [-0.25, -0.6], [0.65, -0.6], [1.0, -0.3]],
  [[-0.55, -0.35], [-0.95, -0.7]],
  [[0.45, 0.65], [0.95, 0.65], [1.1, 0.55]],
  [[1.1, -0.1], [0.65, -1.2], [0.65, -2.1]],
  [[1.25, -0.2], [1.0, -1.0], [1.05, -1.25]],
  [[1.45, -0.3], [1.45, -1.0], [1.7, -1.35], [1.7, -2.15]],
  [[1.65, -0.3], [2.0, -1.2], [2.16, -2.15]],
  [[1.85, -0.2], [2.4, -1.2], [2.67, -2.15]],
  [[2.0, 0.05], [2.8, -0.6], [2.92, -2.15]],
  [[2.1, 0.35], [2.95, -0.1]],
  [[1.9, 0.75], [1.65, 1.4], [1.65, 2.15]],
  [[2.0, 0.6], [2.15, 1.4], [2.16, 2.15]],
  [[2.1, 0.45], [2.67, 1.4], [2.67, 2.15]],
  [[-0.1, -1.85], [-0.5, -2.15], [-0.53, -2.25]],
  [[0.4, -1.95], [0.4, -2.1]],
  [[-0.05, 2.0], [0.38, 2.15], [0.38, 2.25]],
  [[-2.4, -1.75], [-1.95, -1.3]],
]

const SKETCH = `// Uno tour: a heartbeat on L, pot-controlled PWM on pin 9,
// and the button reported over Serial.
const int LED_L    = 13;
const int LED_FADE = 9;     // a ~ pin: PWM at about 490 Hz
const int BUTTON   = 2;     // also INT0, used in the next lesson
const int POT      = A0;

unsigned long lastBeat = 0;
bool beatOn = false;
int lastButton = HIGH;

void setup() {
  pinMode(LED_L, OUTPUT);
  pinMode(LED_FADE, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);   // internal 20-50 kOhm pull-up
  Serial.begin(9600);
  Serial.println("Uno tour ready");
}

void loop() {
  unsigned long now = millis();

  // Heartbeat without delay(): check the clock, act, move on.
  if (now - lastBeat >= 500) {
    lastBeat = now;
    beatOn = !beatOn;
    if (beatOn) {
      digitalWrite(LED_L, HIGH);
    } else {
      digitalWrite(LED_L, LOW);
    }
  }

  // 10-bit ADC in, 8-bit PWM out.
  int raw = analogRead(POT);              // 0..1023
  int duty = map(raw, 0, 1023, 0, 255);   // 0..255
  analogWrite(LED_FADE, duty);

  // Report each new press (pressed = LOW because of the pull-up).
  int b = digitalRead(BUTTON);
  if (b == LOW && lastButton == HIGH) {
    float volts = raw * 5.0 / 1023.0;
    Serial.print("press raw:");
    Serial.print(raw);
    Serial.print(",volts:");
    Serial.println(volts);
  }
  lastButton = b;

  delay(10);
}
`

/** "What's on the board" in Meet the board: the pick-and-place parts never toast their roles, so list them */
const PART_NAMES: [string, string][] = [
  ['u1', 'U1 · ATmega328P'],
  ['u2', 'U2 · ATmega16U2'],
  ['y1', 'Y1 · 16 MHz crystal'],
  ['y2', 'Y2 · 16 MHz resonator'],
  ['j1', 'J1 · USB-B'],
  ['f1', 'F1 · polyfuse'],
  ['q1', 'Q1 · FDN340P'],
  ['j2', 'J2 · barrel jack'],
  ['d1', 'D1 · M7 diode'],
  ['u3', 'U3 · NCP1117 5 V'],
  ['u4', 'U4 · LP2985 3.3 V'],
  ['c2', 'C1, C2 · 47 µF'],
  ['c3', 'C3–C8 · 100 nF'],
  ['u5', 'U5 · LMV358'],
  ['r1', 'RN · 1 kΩ array'],
  ['led_l', 'L · pin 13 LED'],
  ['sw_rst', 'RESET'],
  ['icsp1', 'ICSP'],
]
const partsList = PART_NAMES.map(([id, name]) => `- **${name}**: ${boardParts.find((p) => p.id === id)!.role}`).join('\n')

/** the red 5 mm LED's ratings (30 mA absolute maximum, 5 V reverse) */
const LED_EXT_RATING = { maxI: 0.03, maxV: 5 }

export const lesson: LessonDef = {
  id: 'arduino-uno',
  fig: 1,
  track: 'T4',
  title: 'Arduino Uno R3',
  subtitle: 'The 5-volt workhorse',
  tagline: 'One 16 MHz ATmega328P with 14 digital pins, 6 of them PWM, and a 20 mA budget per pin: the board the rest of this course plugs into.',

  board: {
    name: 'UNO R3 · ATELIER',
    size: PCB,
    base: 'mat',
    frame: { size: [16.0, 7.6], center: [4.2, 0.9] },
    traces,
    // the 12 V supply goes first: the Board currently drops the first labelled part's callout
    // (led-resistor loses its UNO tag the same way), and the supply's tag matters least
    parts: [...benchParts.filter((p) => p.id === 'psu'), ...boardParts, ...benchParts.filter((p) => p.id !== 'psu')],
  },

  circuit: {
    elements: [
      { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5.0, rInternal: 0.3, partId: 'j1' },
      // the power element: "Plug USB" enables it (unplugged, the bench disables it: an open circuit)
      { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', 'vbus_in'], closed: true, partId: 'j1' },
      // polyfuse: 0.5 A hold; the melt integral makes a dead short (≈ 8 A) open it in about 0.15 s
      { id: 'f1', type: 'FUSE', nodes: ['vbus_in', 'vbus_f'], iRated: 0.5, i2t: 10, r: 0.2, partId: 'f1' },
      { id: 'q1_on', type: 'R', nodes: ['vbus_f', '5v'], value: 0.1, partId: 'q1' },
      { id: 'c_5v', type: 'C', nodes: ['5v', '0'], value: 47e-6, polarized: true, rating: { maxV: 16 }, partId: 'c2' },
      // 328P + 16U2 + LEDs, roughly 45 mA at 5 V, lumped as a resistive load (an ideal current
      // source would drag the unpowered rail negative); 6.0 V is the 328P's absolute maximum
      { id: 'i_board', type: 'R', nodes: ['5v', '0'], value: 110, rating: { maxV: 6.0 }, partId: 'u1' },
      { id: 'r_on', type: 'R', nodes: ['5v', 'on_a'], value: 1000, rating: { maxP: 0.063 }, partId: 'r1' },
      { id: 'led_on', type: 'LED', nodes: ['on_a', '0'], color: 'green', rating: { maxI: 0.02 }, partId: 'led_on' },
      { id: 'pin13', type: 'PIN', nodes: ['d13', '0'], pin: 13, vcc: 5, vccNode: '5v', partId: 'u1' },
      { id: 'u5a', type: 'OPAMP', nodes: ['d13', 'lbuf', 'lbuf'], vPos: 5, vNeg: 0, partId: 'u5' },
      { id: 'r_l', type: 'R', nodes: ['lbuf', 'l_a'], value: 1000, partId: 'r1' },
      { id: 'led_l', type: 'LED', nodes: ['l_a', '0'], color: 'yellow', rating: { maxI: 0.02 }, partId: 'led_l' },
      { id: 'pin9', type: 'PIN', nodes: ['d9', '0'], pin: 9, vcc: 5, vccNode: '5v', partId: 'u1' },
      { id: 'r_ext', type: 'R', nodes: ['d9', 'ext_a'], value: 220, rating: { maxP: 0.25 }, partId: 'r_ext' },
      { id: 'led_ext', type: 'LED', nodes: ['ext_a', '0'], color: 'red', rating: LED_EXT_RATING, partId: 'led_ext' },
      { id: 'pin2', type: 'PIN', nodes: ['d2', '0'], pin: 2, vcc: 5, vccNode: '5v', partId: 'u1' },
      { id: 'sw_btn', type: 'SW', nodes: ['d2', '0'], closed: false, partId: 'btn' },
      // 10 kΩ pot: GND end, wiper on A0, 5 V end (pos 0.5 = centred)
      { id: 'pot', type: 'POT', nodes: ['0', 'a0', '5v'], value: 10000, pos: 0.5, partId: 'pot' },
    ],
  },
  powerElementId: 'usb_plug',
  powerLabel: 'Plug USB',
  transient: true,

  readouts: [
    { label: '5V RAIL', source: { kind: 'voltage', node: '5v' }, unit: 'V' },
    { label: 'USB CURRENT', source: { kind: 'current', elementId: 'f1' }, unit: 'A', floor: 1e-6 },
    { label: 'PIN 9 AVG', source: { kind: 'voltage', node: 'd9' }, unit: 'V' },
    { label: 'FADE LED', source: { kind: 'current', elementId: 'led_ext' }, unit: 'A' },
    { label: 'A0', source: { kind: 'voltage', node: 'a0' }, unit: 'V' },
    { label: 'L LED', source: { kind: 'current', elementId: 'led_l' }, unit: 'A' },
    { label: 'PULL-UP I', source: { kind: 'current', elementId: 'sw_btn' }, unit: 'A', floor: 1e-6 },
    { label: 'ADC AT PRESS', source: { kind: 'behavior', key: 'serial.raw' }, unit: 'counts', digits: 1 },
    { label: 'BROWN-OUTS', source: { kind: 'behavior', key: 'mcu.resets' }, unit: '', digits: 1 },
  ],

  sketch: {
    title: 'Uno tour',
    code: SKETCH,
    pins: { 13: 'pin13', 9: 'pin9', 2: 'pin2' },
    analogPins: { A0: 'a0' },
    vcc: 5,
    board: 'uno',
  },

  tweaks: [
    { label: 'Pot (turned toward 5 V)', elementId: 'behavior:knob', key: 'turn', min: 0, max: 100, step: 1, unit: '%' },
    { label: 'Button (1 = held down)', elementId: 'sw_btn', key: 'closed', min: 0, max: 1, step: 1, unit: '' },
    { label: 'Fade resistor', elementId: 'r_ext', key: 'value', min: 47, max: 2200, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: L blinks at 1 Hz, and the pot sets the brightness on pin 9.' },
    // pressed and running: the internal pull-up's current flows through the button
    { when: { kind: 'above', readout: 6, value: 50e-6 }, text: 'Button down: pin 2 reads LOW through the pull-up ({6} flows through it to GND).' },
    { when: { kind: 'above', readout: 1, value: 0.3 }, text: 'WARNING: the 5 V rail is sagging ({0}, {1} from USB): something is drawing too much current.' },
  ],

  failures: [
    {
      id: 'motor-on-pin',
      label: 'Drive a motor straight off pin 9',
      explain:
        'At full duty the pin tries to source 5 V/(25 Ω + 4 Ω) ≈ 170 mA, far past its 40 mA absolute maximum, so pin 9 dies within a third of a second and the motor barely twitches. A GPIO pin is a signal, not a power output: a small gear motor needs 150 mA running and over 1 A to start. Switch it with a transistor (T2) or a driver IC (T5).',
      patches: [
        { op: 'add', element: { id: 'm_direct', type: 'MOTOR', nodes: ['d9', '0'], r: 4, l: 0.0005, ke: 0.0054, j: 3e-7, b: 8e-7 } },
        { op: 'remove', elementId: 'r_ext' },
      ],
      parts: { hide: ['r_ext'], show: ['motor', 'wM1', 'wM2'] },
    },
    {
      id: 'bypass-resistor',
      label: 'Bypass the 220 Ω resistor',
      explain:
        "Only the pin's ≈ 25 Ω output resistance limits the LED, so about 100 mA flows whenever the pin is HIGH: the LED (30 mA) and the pin (40 mA) both burn. Turning the pot down doesn't save them: lower duty only shortens the pulses, and each pulse is still about 100 mA, which is what the ratings see. An LED has almost no resistance once it conducts. On real silicon the output transistor heats and its resistance rises, but it is still far out of spec and the damage builds up.",
      patches: [{ op: 'short', a: 'd9', b: 'ext_a' }],
      parts: { show: ['jBypass'] },
    },
    {
      id: 'short-5v',
      label: 'Short 5V to GND on the header',
      explain:
        'Current through the polyfuse jumps to 5 V/0.6 Ω ≈ 8 A in the model and the fuse opens within a fraction of a second. The rail drops to 0 V and the brown-out detector holds the MCU in reset. That is the polyfuse\'s job: a real PTC heats and its resistance rises within milliseconds to seconds, and it resets once it cools (Repair all stands in for the cool-down here). Many host ports also current-limit.',
      patches: [{ op: 'short', a: '5v', b: '0' }],
      parts: { show: ['jShort'] },
    },
    {
      id: '12v-into-5v',
      label: 'Feed 12 V into the 5V pin',
      explain:
        "The 5V pin bypasses the regulator, so the ATmega328P sees 12 V, twice its 6.0 V absolute maximum, and fails at once: the board is burnt. 7–12 V belongs on the barrel jack or VIN, where the NCP1117 drops it to 5 V.",
      patches: [
        { op: 'add', element: { id: 'bench12', type: 'V', nodes: ['5v', '0'], value: 12, rInternal: 0.05 } },
        // with the rail far above USB, Q1 no longer passes USB power: open it (no back-feed into the host)
        { op: 'set', elementId: 'q1_on', key: 'value', value: 1e9 },
      ],
      parts: { show: ['psu', 'wP1', 'wP2'] },
    },
  ],

  meet: `The Uno R3 is a carrier for one chip, the **ATmega328P**. It runs at 16 MHz, so one clock cycle takes 62.5 ns.

**Digital pins.** Each pin is a push-pull switch to 5 V or 0 V. Keep each one to **20 mA** or less (40 mA is the absolute maximum) and the whole chip to under 200 mA. For a red LED: R = (5 − 1.8) V / 13 mA ≈ 246 Ω total, minus the pin's ≈ 25 Ω → 220 Ω.

**Analog in.** The ADC is 10-bit, so 5 V is split into 1024 steps of 4.9 mV each. A reading of 614 means 614 × 5 / 1023 ≈ **3.0 V**. Each conversion takes about 104 µs.

**PWM out.** \`analogWrite(9, 64)\` switches the pin fully on 25 % of the time, at about 490 Hz (about 980 Hz on pins 5 and 6). The average is 64/255 × 5 ≈ **1.25 V**. The pin itself is still digital. Only the average is "analog".

**Interrupts.** Pins 2 and 3 can run a function the moment they change, instead of waiting for \`loop()\` to look at them. That is the next lesson.

**Serial.** The second chip, an ATmega16U2, bridges USB to pins 0/1. At 9600 baud, one character takes about 1 ms.

**Power.** USB 5 V comes in through a 500 mA polyfuse. Alternatively, 7–12 V on the barrel jack goes through the NCP1117 regulator. Never put more than 5.5 V on the 5 V pin.

**What's on the board.** Strip it and rebuild it to watch each one go in.

${partsList}`,

  mechanicalAnalogy: `The Uno is a PLC shrunk onto 53 × 69 mm. The sketch is the ladder program and the pins are its I/O terminals, with \`loop()\` as the scan cycle. A digital output is like a pilot valve: it can steer a big actuator, but it cannot flow enough to be the actuator. You always put a power stage (relay, transistor, driver) in between.

**Where it breaks:** a PLC output card is built to survive shorts and inductive loads. A bare AVR pin has no current limit, no flyback protection and a 40 mA absolute maximum, so you supply all the protection yourself.`,

  proTips: [
    "Plan your pin current budget in a table before wiring: LEDs, pull-ups and every module's logic current. The 200 mA total for the chip is easy to exceed with a row of LEDs.",
    'Avoid `delay()` in anything bigger than Blink. The `millis()` pattern in this sketch lets one loop run a heartbeat, read sensors and talk serial "at the same time".',
    '`int` on the Uno is 16 bits (−32768…32767). `1000 * 60` overflows, and `millis()` needs `unsigned long`. Mixing them is the most common source of "works for a minute, then goes crazy" bugs.',
  ],

  guide: [
    {
      id: 'strip',
      title: 'Strip it to the bare PCB',
      body: 'Press **Strip to bare PCB**. Every part comes off the board and you are left with copper, pads and silkscreen. Nothing on a bare board can run, which is the point.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'strip' }, { kind: 'status', is: 'BARE PCB' }] },
      focus: { control: 'strip' },
      hint: 'It is the first button at the top of the bench.',
      explain: 'You are about to put back the whole thing: the ATmega328P, the USB-serial chip, the 5 V regulator, the polyfuse, the crystal and the headers. That is how a factory builds this board, and how you will understand it.',
    },
    {
      id: 'rebuild',
      title: 'Place every part',
      body: 'Press **Pick & place** to drop the surface-mount parts with the machine, then place the through-hole parts (USB-B jack, barrel jack, headers, crystal, capacitors) by hand, or press **Place all**.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'pick-place' }, { kind: 'action', action: 'place-all' }] },
      focus: { control: 'pick-place' },
      hint: 'Do Pick & place first. The parts still waiting are listed in the parts tray, and each one clicked goes to its pads.',
      explain: 'A real line places the tiny SMD parts by machine first, then the big connectors go in by hand or wave. Placed is not connected yet: the parts only sit on the pads.',
    },
    {
      id: 'solder',
      title: 'Solder the joints',
      body: 'Press **Solder**. The paste melts and every pin becomes a connection. The status turns to **READY**.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'solder' }, { kind: 'status', is: 'READY' }] },
      focus: { control: 'solder' },
      explain: 'Until the solder flows nothing conducts: if you try to power the board before this step the bench refuses. One bad joint on a real board looks identical to a working one, which is why inspection is a job.',
    },
    {
      id: 'power',
      title: 'Plug in USB',
      body: 'Press **Plug USB**. The **5V RAIL** should read about **4.96 V**: the 5 V from the cable, less a small drop in the polyfuse.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'power' },
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 0, above: 4.85, below: 5.05, holdMs: 300 },
        ],
      },
      focus: { control: 'power' },
      explain: 'USB source resistance and the polyfuse (a resettable fuse) together are about 0.6 Ω, so the roughly 65 mA drops about 40 mV. No sketch is running yet, so pin 13 is still an input.',
    },
    {
      id: 'upload',
      title: 'Upload the tour sketch',
      body: 'Press **Upload sketch**. The sketch makes pin 13 an OUTPUT and blinks the **L** LED at 1 Hz. Wait for pin 13 to go **HIGH**.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'upload' }, { kind: 'pin', pin: 13, level: 1 }] },
      focus: { control: 'upload' },
      hint: 'The sketch is in the editor under the bench. Upload only works while the board is powered.',
      explain: 'The heartbeat uses millis() rather than delay(), so the loop stays free to read the pot and the button while L blinks: 500 ms on, 500 ms off.',
    },
    {
      id: 'fade',
      title: 'Turn the pot all the way up',
      body: 'Slide the **Pot** to the top (above 95). analogRead on A0 gives 1023, the sketch maps that to a PWM duty of 255, and **FADE LED** reads about **13 mA**: (5 − 1.8) / (220 + 25).',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Pot (turned toward 5 V)', min: 95 },
          { kind: 'readout', index: 3, above: 0.011, below: 0.015, holdMs: 250 },
        ],
      },
      focus: { control: 'tweak:Pot (turned toward 5 V)' },
      hint: 'The slider runs from 0 (toward ground) to 100 (toward 5 V).',
      explain: 'The pot is a voltage divider into the 10-bit ADC (5 V / 1024 steps ≈ 4.9 mV per count). The 25 Ω is the pin\'s own output resistance; 13 mA is under the LED\'s 20 mA continuous rating and the pin\'s 40 mA absolute maximum.',
    },
    {
      id: 'bypass',
      title: 'Break it: bypass the resistor',
      body: 'Open **Break something** and choose **Bypass the 220 Ω resistor**. Only the pin\'s 25 Ω is left to limit the current.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'bypass-resistor' }, { kind: 'status', is: 'FAULT' }] },
      focus: { control: 'break' },
      hint: 'The LED burns while pin 9 is driving it; with the pot up, that is immediately.',
      explain: 'About (5 − 2) / 25 ≈ 100 mA flows: over three times the LED\'s 30 mA maximum and 2.5 times the pin\'s 40 mA absolute maximum. Turning the pot down does not help, because each PWM pulse is still 100 mA.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**. The fade LED comes back.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
      explain: 'Repair is the bench\'s undo. On a real Uno that pin, and often the ATmega328P, would stay damaged: fit the resistor before you apply power.',
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below. They are all about the numbers you just saw on this board.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  quiz: [
    {
      q: '`analogWrite(9, 64)` with a 5 V supply. What does a DMM on pin 9 read?',
      options: ['0.64 V', '1.25 V', '2.5 V', '5 V flickering'],
      answer: 1,
      why: 'The DMM averages the PWM: 64/255 × 5 V ≈ 1.25 V.',
    },
    {
      q: 'You want 10 mA through a red LED (Vf ≈ 1.8 V) from a 5 V pin. Which standard resistor is closest?',
      options: ['180 Ω', '330 Ω', '1 kΩ', '3.3 kΩ'],
      answer: 1,
      why: 'R = (5 − 1.8)/0.010 = 320 Ω, so 330 Ω (about 9.7 mA) is the nearest E12 value.',
    },
    {
      q: '`analogRead(A0)` returns 614. What is the voltage on A0?',
      options: ['1.2 V', '2.5 V', '3.0 V', '6.1 V'],
      answer: 2,
      why: 'V = 614 × 5 / 1023 ≈ 3.0 V.',
    },
    {
      q: 'Which Uno pins are the external interrupts INT0 and INT1?',
      options: ['0 and 1', '2 and 3', '9 and 10', 'A4 and A5'],
      answer: 1,
      why: 'On the ATmega328P, INT0 is PD2 (pin 2) and INT1 is PD3 (pin 3). Pins 0/1 are the serial lines.',
    },
  ],

  behaviors: [
    { id: 'mcu-supply', instance: 'mcu', params: { supplyNode: '5v', bor: 2.7, fClk: 16 } },
    { id: 'serial-plotter', instance: 'serial' },
    { id: 'pot-knob', instance: 'knob', params: { pot: 'pot', turn: 50 } },
  ],
}
