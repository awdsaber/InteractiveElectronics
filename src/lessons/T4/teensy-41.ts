// T4 · Teensy 4.1 (PJRC). Source: docs/curriculum/T4/teensy-41.md
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, PITCH, bbHole, between, jumper } from '../layout'

// Bench layout: the breadboard at the back, the Teensy in front of it with its VIN row (VIN, GND, 3.3V,
// 23 … 13) facing the breadboard, the "5 V logic" stand-in at the front left and, only for the back-feed
// failure, a bench supply beside the USB end.
const BB: [number, number] = [-0.7, -1.9]
const T: [number, number] = [0.3, 2.3] // Teensy centre
const SIG: [number, number] = [-4.6, 3.55]
const PSU: [number, number] = [-4.7, 1.45]

/** top of the Teensy PCB (the carrier lies flat on the mat) */
const T_TOP = BENCH_Y + 0.16
/** pin rows 0.6" apart */
const ROW_Z = 0.762
const PIN_LEN = 0.45
const PIN_TOP = T_TOP + 0.25 + PIN_LEN
/** a point on the Teensy in its own frame: USB end at −x, VIN row at −z */
const onT = (x: number, z: number): [number, number, number] => [T[0] + x, T_TOP, T[1] + z]
const pinX = (n: number) => (n - 1 - 11.5) * PITCH
/** VIN row (back): 1 VIN, 2 GND, 3 3.3V, 4 pin 23, 5 pin 22, … 13 pin 14, 14 pin 13, 15 GND, 16 pin 41 … */
const back = (n: number): [number, number, number] => {
  const [x, , z] = onT(pinX(n), -ROW_Z)
  return [x, PIN_TOP, z]
}

// breadboard, front half (rows f..j), 3.3 V on '+b', GND on '-b'
// divider: 5 V in on col 3, pin 23 on col 7, GND on col 11
const rDtopL = bbHole(BB, 3, 'i')
const rDtopR = bbHole(BB, 7, 'i')
const rDbotL = bbHole(BB, 7, 'g')
const rDbotR = bbHole(BB, 11, 'g')
// PWM LED: pin 22 on col 18, 470 Ω to col 14, LED anode col 14, cathode col 13
const rLedL = bbHole(BB, 14, 'h')
const rLedR = bbHole(BB, 18, 'h')
const ledCathode = bbHole(BB, 13, 'f')
const ledAnode = bbHole(BB, 14, 'f')
// pot: rot 180, legs in row f (cols 22 GND, 23 wiper, 24 3.3 V)
const potLeg = bbHole(BB, 23, 'f')
const sigOut: [number, number, number] = [SIG[0] + 0.75, BENCH_Y + 0.17, SIG[1] - 0.3]
const sigGnd: [number, number, number] = [SIG[0] + 0.45, BENCH_Y + 0.17, SIG[1] - 0.3]
const psuOut: [number, number, number] = [PSU[0] + 0.75, BENCH_Y + 0.17, PSU[1] - 0.3]

const wires = {
  w_3v3: jumper(back(3), bbHole(BB, 5, '+b'), 'red', 0.5),
  w_gnd: jumper(back(2), bbHole(BB, 4, '-b'), 'black', 0.5),
  w_p23: jumper(back(4), bbHole(BB, 7, 'j'), 'yellow', 0.8),
  w_p22: jumper(back(5), bbHole(BB, 18, 'j'), 'orange', 0.6),
  w_p14: jumper(back(13), bbHole(BB, 23, 'j'), 'green', 0.6),
  w_potg: jumper(bbHole(BB, 22, 'j'), bbHole(BB, 22, '-b'), 'black', 0.12),
  w_potv: jumper(bbHole(BB, 24, 'j'), bbHole(BB, 24, '+b'), 'red', 0.12),
  w_divg: jumper(bbHole(BB, 11, 'j'), bbHole(BB, 11, '-b'), 'black', 0.12),
  w_ledg: jumper(bbHole(BB, 13, 'j'), bbHole(BB, 13, '-b'), 'black', 0.12),
  w_sig: jumper(sigOut, bbHole(BB, 3, 'j'), 'blue', 0.5),
  w_sigg: jumper(sigGnd, bbHole(BB, 2, '-b'), 'black', 0.4),
  // failure-only: a bare wire from the 5 V column to pin 23's column, a jumper in place of the 470 Ω,
  // and the bench supply's lead to VIN
  j_direct: jumper(bbHole(BB, 3, 'h'), bbHole(BB, 7, 'h'), 'blue', 0.22),
  j_nor: jumper(rLedL, rLedR, 'green', 0.22),
  w_vin: jumper(psuOut, back(1), 'red', 0.6),
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

/** i.MX RT1062 absolute maximum on an I/O pin: OVDD + 0.3 V (NXP IMXRT1060CEC Table 7) */
const PIN_MAX_V = 3.6
/** NXP gives no absolute-maximum pin current: a teaching threshold, well above PJRC's 4 mA recommendation */
const PIN_FAIL_I = 0.02

const sketch = `// Teensy 4.1: a 12-bit pot reading straight into 12-bit PWM
const int LED_PIN = 22;   // a FlexPWM pin
const int POT_PIN = A0;   // pin 14
const int SIG_PIN = 23;   // a 5 V signal, through a 10k/20k divider

unsigned long lastReport = 0;

void setup() {
  Serial.begin(115200);       // native USB: runs at USB speed whatever the baud
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(SIG_PIN, INPUT);
  analogReadResolution(12);   // 0..4095 (the default is 10-bit)
  analogWriteResolution(12);  // analogWrite takes 0..4095 (the default is 8-bit)
  analogWriteFrequency(LED_PIN, 36621.09);  // PJRC's ideal 12-bit frequency at 600 MHz
}

void loop() {
  int raw = analogRead(POT_PIN);   // 0..4095
  analogWrite(LED_PIN, raw);       // 4096 brightness steps, no map() needed

  if (millis() - lastReport >= 500) {
    lastReport = millis();
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));   // heartbeat on pin 13
    Serial.print("pot:");
    Serial.print(raw);
    Serial.print(",duty:");
    Serial.print(raw * 100.0 / 4095, 1);
    Serial.print(",sig:");
    Serial.println(digitalRead(SIG_PIN));
  }
  delay(5);
}
`

export const lesson: LessonDef = {
  id: 'teensy-41',
  track: 'T4',
  title: 'Teensy 4.1',
  subtitle: '600 MHz at 3.3 V',
  tagline: 'An ARM Cortex-M7 at 600 MHz with 1 MB of RAM, Ethernet and native USB, on pins that take 3.3 V and nothing more.',

  board: {
    name: 'TEENSY 4.1',
    size: [10.8, 9.6],
    base: 'breadboard-only',
    parts: [
      // first on purpose (see esp32-s3.ts): the bench drops the first labelled part's callout
      W('j_nor', 'JUMPER', 'A bare jumper where the 470 Ω resistor should be.', [0.6, 1.4, -1.2], true),
      W('w_potg', '', 'Pot end to GND.', [0, 0.4, 0]),
      { id: 'bb', kind: 'breadboard', pos: BB, mount: 'offboard', role: 'Holds the 5 V divider, the PWM LED and the pot.' },
      {
        id: 'teensy',
        kind: 'module',
        pos: [T[0], BENCH_Y, T[1]],
        mount: 'module',
        label: 'TEENSY 4.1',
        role: 'PJRC Teensy 4.1: 61 × 18 mm, 48 breadboard pins in two rows 0.6" apart. Everything on it runs at 3.3 V.',
        params: { variant: 'teensy41', callout: [-1.6, 0.2, 2.4] },
        color: '#1b4a2e',
        circuitIds: ['i_mcu'],
        facts: [
          '55 digital I/O (42 on the breadboard rows), 35 PWM, 18 analog inputs',
          '8 serial, 3 SPI, 3 I²C, 3 CAN (one CAN FD), 2 I²S/TDM',
          'About 100 mA at 600 MHz',
          '3.3 V pins: 250 mA recommended max for your circuits',
          'VIN 3.6–5.5 V; VIN and VUSB joined until you cut the pads',
        ],
      },
      {
        id: 'u1',
        kind: 'ic-smd',
        pos: onT(-0.95, 0),
        mount: 'smd',
        label: 'RT1062',
        role: 'NXP i.MX RT1062: an ARM Cortex-M7 at 600 MHz with a floating-point unit, 1 MB of on-chip RAM and the USB, Ethernet, CAN, I²S and timer peripherals. A BGA package: the balls are underneath.',
        params: { package: 'QFN', pins: 80, marking: 'iMXRT\n1062', callout: [-0.3, 1.4, 1.6] },
        color: '#2b2d31',
        facts: [
          'Cortex-M7 at 600 MHz, dual-issue, 32 KB I + 32 KB D cache',
          'FPU: float and double in hardware (double at half speed)',
          'RAM 1024 KB: 512 KB tightly coupled + 512 KB',
          'Core at 1.25 V for 600 MHz (NXP: "overdrive")',
          'I/O abs. max: −0.5 V to OVDD + 0.3 V = 3.6 V',
        ],
      },
      {
        id: 'u_flash',
        kind: 'ic-smd',
        pos: onT(0.2, 0.3),
        mount: 'smd',
        label: 'FLASH',
        role: 'The 8 MB QSPI flash that holds your program (Winbond W25Q64JV). The top 256 KB is kept for EEPROM emulation and the restore program.',
        params: { package: 'SOIC', pins: 8, marking: '25Q64', callout: [0.4, 1.0, 1.4] },
        facts: ['8 MB, about 7936 KB usable for code', '4284 bytes of emulated EEPROM', 'Two more QSPI pad sites underneath for PSRAM (8 MB chips)'],
      },
      {
        id: 'u_boot',
        kind: 'ic-smd',
        pos: onT(-2.3, 0.3),
        mount: 'smd',
        label: 'BOOT',
        role: "PJRC's bootloader chip. Teensy Loader talks to it to write your program into flash. It does not run at startup, so your code starts at once.",
        params: { package: 'QFN', pins: 24, marking: 'PJRC', callout: [-1.0, 1.0, 1.4] },
      },
      {
        id: 'u_reg',
        kind: 'ic-smd',
        pos: onT(-2.3, -0.3),
        rot: 90,
        mount: 'smd',
        label: '3V3 REG',
        role: 'The 3.3 V regulator, fed from VIN. It runs the board and the 3.3V pins.',
        params: { package: 'SOIC', pins: 4, marking: '3V3', callout: [-1.3, 1.0, -0.6] },
        circuitIds: ['reg'],
        facts: ['Output 3.3 V', 'PJRC: draw at most 250 mA from the 3.3V pins'],
      },
      {
        id: 'j_usb',
        kind: 'micro-usb',
        pos: onT(-2.88, 0),
        rot: -90,
        mount: 'smd',
        label: 'USB',
        role: 'Micro-USB: power (VUSB) and the native 480 Mbit/s USB device port. The same port is Serial, MIDI, keyboard, joystick and more, chosen by the Tools > USB Type menu.',
        params: { callout: [-1.6, 0.8, 0.6] },
        circuitIds: ['v_usb', 'usb_plug', 'usb_i'],
      },
      {
        id: 'h_host',
        kind: 'header-male',
        pos: onT(-1.75, 0),
        rot: 90,
        mount: 'tht',
        label: 'USB HOST',
        role: 'USB host port, 5 pins: plug in a keyboard, MIDI device or hub with a cable. It is current limited and separate from the device port.',
        params: { pins: 5, pinLength: 0.3, callout: [-0.6, 1.2, -1.4] },
      },
      {
        id: 'sw_prog',
        kind: 'button',
        pos: onT(0.9, -0.05),
        mount: 'smd',
        label: 'PROGRAM',
        role: 'Program button: puts the board in programming mode for Teensy Loader. It is not a reset. Held 13–17 s it erases flash and restores the blink program.',
        params: { callout: [0.6, 1.0, -1.6] },
        color: '#e9e4d8',
      },
      {
        id: 'led13',
        kind: 'led-smd',
        pos: onT(0.38, -0.4),
        mount: 'smd',
        label: 'LED 13',
        role: 'The orange LED on pin 13 (LED_BUILTIN). Do not use INPUT_PULLUP on pin 13: the LED loads it.',
        params: { size: '0805', color: 'yellow', callout: [0.1, 0.9, -1.2] },
        circuitIds: ['pin13', 'led13'],
      },
      {
        id: 'u_phy',
        kind: 'ic-smd',
        pos: onT(1.6, 0.3),
        mount: 'smd',
        label: 'ETH PHY',
        role: 'TI DP83825 10/100 Ethernet PHY. An RJ45 magjack kit plugs into the 6-pin header beside it.',
        params: { package: 'QFN', pins: 24, marking: '83825', callout: [1.0, 1.0, 1.4] },
      },
      {
        id: 'h_eth',
        kind: 'header-male',
        pos: onT(1.6, -0.33),
        mount: 'tht',
        label: 'ETH',
        role: 'Ethernet header (2 × 3) for the magjack.',
        params: { pins: 3, pinLength: 0.3, callout: [1.4, 1.0, -1.2] },
      },
      {
        id: 'h_eth2',
        kind: 'header-male',
        pos: onT(1.6, -0.584),
        mount: 'tht',
        role: 'Ethernet header, second row.',
        params: { pins: 3, pinLength: 0.3 },
      },
      {
        id: 'sd',
        kind: 'ic-smd',
        pos: onT(2.55, 0),
        mount: 'smd',
        label: 'microSD',
        role: 'microSD socket, wired to the chip with 4-bit native SDIO (much faster than SPI).',
        params: { package: 'QFN', pins: 64, marking: 'SD', callout: [1.4, 0.9, 1.6] },
        color: '#b9bec4',
      },
      {
        id: 'h_back',
        kind: 'header-male',
        pos: onT(0, -ROW_Z),
        mount: 'tht',
        label: 'VIN ROW',
        role: 'VIN, GND, 3.3V, pins 23 … 13, GND, 41 … 33. Pins point up here so jumper leads can push on.',
        params: { pins: 24, pinLength: PIN_LEN, callout: [2.6, 0.6, -0.8] },
      },
      {
        id: 'h_front',
        kind: 'header-male',
        pos: onT(0, ROW_Z),
        mount: 'tht',
        role: 'GND, pins 0 … 12, 3.3V, pins 24 … 32.',
        params: { pins: 24, pinLength: PIN_LEN },
      },
      {
        id: 'pot',
        kind: 'potentiometer',
        pos: [potLeg[0], potLeg[1], potLeg[2] + 0.4],
        rot: 180,
        mount: 'tht',
        label: 'POT',
        role: '10 kΩ pot: 0–3.3 V into A0 (pin 14).',
        params: { callout: [0.6, 1.4, -1.2] },
        circuitIds: ['pot'],
      },
      {
        id: 'r_dtop',
        kind: 'resistor',
        pos: between(rDtopL, rDtopR),
        mount: 'tht',
        label: '10 kΩ',
        role: 'Divider top, 10 kΩ (brown-black-orange): with 20 kΩ below it scales 5 V to 3.33 V for pin 23.',
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
        label: '470 Ω',
        role: 'Limits the LED on pin 22: (3.3 − 1.8)/(470 + 25) ≈ 3 mA, inside PJRC\'s 4 mA per pin (yellow-violet-brown).',
        params: { ohms: 470, callout: [0.4, 1.4, -1.2] },
        circuitIds: ['r_led'],
      },
      {
        id: 'led_ext',
        kind: 'led',
        pos: between(ledCathode, ledAnode),
        mount: 'tht',
        label: 'PWM LED',
        role: '5 mm red LED on pin 22: 12-bit PWM at 36.6 kHz, 4096 brightness steps.',
        params: { color: 'red', callout: [-0.9, 1.4, -1.4] },
        circuitIds: ['led_ext'],
      },
      {
        id: 'sig5',
        kind: 'module',
        pos: [SIG[0], BENCH_Y, SIG[1]],
        mount: 'offboard',
        label: '5V SIGNAL',
        role: 'A 5 V logic output (an Uno pin, say): a 0/5 V square wave at 0.5 Hz.',
        params: { w: 2.2, d: 1.2, pins: 0, chip: 'soic', chipLabel: '5V', title: '5 V LOGIC', color: '#2b59c3', callout: [1.2, 0.1, 2.4] },
        circuitIds: ['v_sig'],
      },
      {
        id: 'psu',
        kind: 'module',
        pos: [PSU[0], BENCH_Y, PSU[1]],
        mount: 'offboard',
        label: '5.2V SUPPLY',
        role: 'An external 5.2 V supply (a wall adapter, say) wired to VIN.',
        params: { w: 2.0, d: 1.0, pins: 0, chip: 'soic', chipLabel: 'PSU', title: '5.2 V', color: '#6b3a2b', callout: [-0.6, 0.6, 1.6] },
        hidden: true,
      },
      W('w_3v3', '', '3.3V pin to the + rail.', [-0.6, 0.6, 0.3]),
      W('w_gnd', '', 'GND pin to the − rail.', [-0.9, 0.5, 0.6]),
      W('w_p23', 'PIN 23', 'Pin 23 reads the divided 5 V signal.', [-0.3, 0.6, 0.4]),
      W('w_p22', 'PIN 22', 'Pin 22 drives the LED with 12-bit PWM.', [0.5, 0.6, 0.3]),
      W('w_p14', 'A0', 'A0 (pin 14) reads the pot wiper.', [0.6, 0.6, 0.6]),
      W('w_potv', '', 'Pot end to 3.3 V.', [0, 0.4, 0]),
      W('w_divg', '', 'Divider bottom to GND.', [0, 0.4, 0]),
      W('w_ledg', '', 'LED cathode to GND.', [0, 0.4, 0]),
      W('w_sig', '5V OUT', 'The 5 V signal into the top of the divider.', [-0.9, 0.6, 0.2]),
      W('w_sigg', '', 'Common ground with the 5 V device.', [0, 0.4, 0]),
      W('j_direct', 'DIRECT', 'A bare wire: the 5 V signal straight into pin 23.', [0.2, 1.4, -1.2], true),
      W('w_vin', 'TO VIN', 'The external supply into VIN.', [-0.4, 0.7, 0.4], true),
    ],
  },

  circuit: {
    elements: [
      // the computer's USB port and cable: 5.0 V, about 0.3 Ω
      { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5.0, rInternal: 0.3, partId: 'j_usb' },
      { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', 'usb_p'], closed: true, partId: 'j_usb' },
      // current out of the computer's port: positive = USB powers the board, negative = back-feed
      { id: 'usb_i', type: 'PROBE', nodes: ['usb_p', 'vusb'], partId: 'j_usb' },
      // the VUSB–VIN pads on the bottom: joined from the factory, cut to separate the supplies
      { id: 'vin_trace', type: 'SW', nodes: ['vusb', 'vin'], closed: true, partId: 'teensy' },
      // 3.3 V regulator. The dropout is a teaching value consistent with PJRC's 3.6 V VIN minimum
      { id: 'reg', type: 'REG', nodes: ['vin', '0', '3v3'], vout: 3.3, dropout: 0.3, iLimit: 1.0, partId: 'u_reg' },
      { id: 'c_3v3', type: 'C', nodes: ['3v3', '0'], value: 10e-6, partId: 'teensy' },
      // the board itself: about 100 mA at 600 MHz (PJRC)
      { id: 'i_mcu', type: 'I', nodes: ['3v3', '0'], value: 0.1, partId: 'teensy' },
      // pin 13 and its on-board LED (resistor value: not published; 470 Ω is a stand-in)
      { id: 'pin13', type: 'PIN', nodes: ['p13', '0'], pin: 13, vcc: 3.3, vccNode: '3v3', partId: 'u1' },
      { id: 'r13', type: 'R', nodes: ['p13', 'l13'], value: 470, partId: 'teensy' },
      { id: 'led13', type: 'LED', nodes: ['l13', '0'], color: 'yellow', partId: 'led13' },
      // pin 22: 12-bit PWM into the external LED
      { id: 'pin22', type: 'PIN', nodes: ['p22', '0'], pin: 22, vcc: 3.3, vccNode: '3v3', rating: { maxI: PIN_FAIL_I, maxV: PIN_MAX_V }, partId: 'u1' },
      { id: 'r_led', type: 'R', nodes: ['p22', 'led_a'], value: 470, rating: { maxP: 0.25 }, partId: 'r_led' },
      { id: 'led_ext', type: 'LED', nodes: ['led_a', '0'], color: 'red', rating: { maxI: 0.03 }, partId: 'led_ext' },
      // 10 kΩ pot: end A at GND, wiper on A0 (pin 14), end B at 3.3 V
      { id: 'pot', type: 'POT', nodes: ['0', 'p14', '3v3'], value: 10_000, pos: 0.5, partId: 'pot' },
      // stand-in for a 5 V device: 0/5 V square wave at 0.5 Hz (square-wave)
      { id: 'v_sig', type: 'V', nodes: ['s5', '0'], value: 5.0, partId: 'sig5' },
      { id: 'r_dtop', type: 'R', nodes: ['s5', 'p23'], value: 10_000, partId: 'r_dtop' },
      { id: 'r_dbot', type: 'R', nodes: ['p23', '0'], value: 20_000, partId: 'r_dbot' },
      { id: 'pin23', type: 'PIN', nodes: ['p23', '0'], pin: 23, vcc: 3.3, vccNode: '3v3', partId: 'u1' },
      // pin 23's ESD clamp to the 3.3 V supply. 5 mA is a teaching threshold: NXP publishes no injection-current rating
      { id: 'd_esd', type: 'D', nodes: ['p23', '3v3'], is: 1e-12, n: 1.5, rating: { maxI: 0.005, failMode: 'short' }, partId: 'u1' },
    ],
  },
  powerElementId: 'usb_plug',
  powerLabel: 'Plug micro-USB',

  readouts: [
    { label: '3.3V RAIL', source: { kind: 'voltage', node: '3v3' }, unit: 'V' },
    { label: 'VIN', source: { kind: 'voltage', node: 'vin' }, unit: 'V' },
    { label: 'PIN 23 (DIVIDED)', source: { kind: 'voltage', node: 'p23' }, unit: 'V' },
    { label: 'PIN 22 LED', source: { kind: 'current', elementId: 'led_ext' }, unit: 'A' },
    { label: 'A0 (POT)', source: { kind: 'voltage', node: 'p14' }, unit: 'V' },
    { label: 'USB PORT', source: { kind: 'current', elementId: 'usb_i' }, unit: 'A' },
  ],

  sketch: {
    title: '12-bit fade',
    code: sketch,
    pins: { 13: 'pin13', 22: 'pin22', 23: 'pin23' },
    analogPins: { A0: 'p14' },
    vcc: 3.3,
    board: 'teensy41',
  },

  tweaks: [
    { label: 'Pot position', elementId: 'pot', key: 'pos', min: 0, max: 1, step: 0.01, unit: '' },
    { label: 'LED resistor', elementId: 'r_led', key: 'value', min: 100, max: 2200, log: true, unit: 'Ω' },
    { label: 'VUSB–VIN pads joined', elementId: 'vin_trace', key: 'closed', kind: 'toggle', min: 0, max: 1, unit: '' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: 12-bit pot reading into 12-bit PWM on pin 22, heartbeat on pin 13.' },
    { when: { kind: 'above', readout: 3, value: 0.004 }, text: 'WARNING: pin 22 is sourcing more than the 4 mA PJRC recommends per pin.' },
    { when: { kind: 'above', readout: 2, value: 3.6 }, text: 'WARNING: pin 23 is above 3.6 V: its clamp diode is conducting into the 3.3 V rail.' },
    { when: { kind: 'below', readout: 5, value: -0.05 }, text: 'WARNING: current is flowing backwards into the computer\'s USB port.' },
  ],

  failures: [
    {
      id: 'direct-5v',
      label: 'Wire a 5 V signal straight into pin 23',
      explain:
        "Pin 23 climbs to about 4.2 V, held there only by the chip's internal ESD diode conducting into the 3.3 V rail. The clamp carries about 8 mA through the 100 Ω that stands in for the wire and the 5 V source's output, so within a few hundred ms it burns short: pin 23 is dead, stuck at the rail, and reads HIGH whatever the signal does. NXP's absolute maximum on an I/O pin is OVDD + 0.3 V = 3.6 V, and PJRC says plainly that the Teensy 4.1 is not 5 V tolerant. This is the classic way Teensys die. Use a 10 k/20 k divider, a level shifter (74LVC245 or 74LVC1T45 class) or an open-drain output pulled up to 3.3 V.",
      patches: [
        { op: 'remove', elementId: 'r_dbot' },
        { op: 'set', elementId: 'r_dtop', key: 'value', value: 100 },
      ],
      parts: { hide: ['r_dtop', 'r_dbot'], show: ['j_direct'] },
    },
    {
      id: 'no-resistor',
      label: 'LED with no resistor on pin 22',
      explain:
        "With nothing but the pin's own output resistance (about 21–150 Ω depending on the drive-strength setting; the bench uses 25 Ω), roughly (3.3 − 2.0)/25 ≈ 50 mA flows: more than ten times PJRC's 4 mA recommendation. The output stage overheats and pin 22 is dead (the bench fails it at 20 mA; NXP publishes no absolute-maximum pin current, so that figure is a teaching threshold). Keep every pin at 4 mA or less, and drive anything bigger through a transistor or MOSFET.",
      patches: [{ op: 'short', a: 'p22', b: 'led_a' }],
      parts: { hide: ['r_led'], show: ['j_nor'] },
    },
    {
      id: 'vin-backfeed',
      label: 'Add a 5.2 V supply on VIN with USB still plugged in',
      explain:
        "On the Teensy 4.1, VIN and VUSB are joined by a pair of pads on the bottom. Wire a 5.2 V supply to VIN with USB plugged in and the two supplies are tied together: the higher one pushes current backwards into the computer's USB port (USB PORT reads negative, a few hundred mA here). A computer's port is not built to be fed, and the two supplies fight. The fix is PJRC's: cut the VUSB–VIN pads (the 'VUSB–VIN pads joined' toggle) before adding external power. The supply then runs the board and USB carries only data.",
      patches: [
        { op: 'add', element: { id: 'v_ext', type: 'V', nodes: ['ext', '0'], value: 5.2, rInternal: 0.05 } },
        { op: 'add', element: { id: 'r_vin_wire', type: 'R', nodes: ['ext', 'vin'], value: 0.05 } },
      ],
      parts: { show: ['psu', 'w_vin'] },
    },
  ],

  meet: `The **Teensy 4.1** is PJRC's 61 × 18 mm board around NXP's **i.MX RT1062**: an ARM **Cortex-M7 at 600 MHz** with a floating-point unit that does \`float\` and \`double\` in hardware. It has **1 MB of RAM** (half of it tightly coupled to the core, so it runs at full speed), **8 MB of flash**, two pad sites underneath for extra QSPI PSRAM, and a **microSD** socket on 4-bit SDIO.

**I/O.** 55 digital pins (42 on the breadboard rows), **35 PWM**, **18 analog inputs** (A0–A13 = pins 14–27, A14–A17 = pins 38–41), 8 serial ports, 3 SPI, 3 I²C, 3 CAN (one CAN FD; you add the transceiver), 2 I²S/TDM audio ports, a 10/100 **Ethernet** PHY (DP83825) and a separate **USB host** port. There is no true DAC on the 4.1.

**The catch is 3.3 V.** The pins are **not 5 V tolerant**: NXP's absolute maximum is OVDD + 0.3 V = 3.6 V. A 5 V signal needs a divider: 5 × 20/(10 + 20) = **3.33 V**. PJRC recommends **at most 4 mA per pin**, so the LED here gets 470 Ω: (3.3 − 1.8)/(470 + 25) ≈ **3 mA**.

**Analog, Teensy style.** \`analogRead\` is 10-bit by default and \`analogReadResolution(12)\` gives 0–4095 (noise leaves about 10 usable bits; the range is fixed at 0–3.3 V, so \`analogReference\` does nothing). \`analogWrite\` is 8-bit at **4.482 kHz** (FlexPWM pins) or **3.611 kHz** (QuadTimer pins 10–15, 18, 19) by default; \`analogWriteResolution(12)\` and \`analogWriteFrequency(pin, 36621.09)\` give 4096 steps at PJRC's ideal 12-bit frequency. Pins on one timer share a frequency: change pin 2 and pin 3 changes too.

**Native USB.** The micro-USB port is the chip's own 480 Mbit/s USB. From the **Tools > USB Type** menu it can be Serial, MIDI, Audio, keyboard, mouse, joystick, Raw HID and more, with no bridge chip in the way, which is why it is a favourite for MIDI controllers and low-latency input devices.

**Power.** 5 V comes in on VUSB, which is joined to **VIN** (3.6–5.5 V) by pads on the bottom. The 3.3 V regulator runs the board (about 100 mA at 600 MHz) and leaves **250 mA** for your circuits on the 3.3V pins. Cut the VUSB–VIN pads before you power it from VIN with USB plugged in.

**Programming.** Arduino IDE plus PJRC's **Teensyduino**. Upload hands the HEX file to **Teensy Loader**, which writes it through a separate bootloader chip. If your code has crashed the USB side, press the **program button** once: it is not a reset, it puts the board in programming mode.

**When to choose it:** over an Uno for raw speed, memory and 3.3 V sensors; over an ESP32 when you need deterministic timing without a radio stack, DSP and audio (FPU, I²S, PJRC's Audio library), many buses at once, or a USB device with low latency. Choose the ESP32 for WiFi or Bluetooth, the Uno for 5 V shields.`,

  mechanicalAnalogy: `If the Uno is a single-cylinder engine with a direct linkage, the Teensy 4.1 is a high-revving race engine: 600 MHz, with an FPU like a dedicated hydraulic servo for the maths. There is no radio governor taking a cylinder away as on the ESP32, so your code gets the whole machine and its timing stays repeatable.

Its 3.3 V pins are precision hydraulic fittings rated to 3.6 V: connect the 5 V line without a reducer (the divider) and you blow the seal (the ESD diode) on that port for good. VIN and VUSB joined by a pad is two pumps teed into one line with no check valve: the stronger one drives the weaker one backwards. Cutting the pads is fitting the check valve.

**Where it breaks:** a race engine also has tighter limits. 4 mA per pin is a light-duty fitting; anything bigger goes through a transistor, as you would use a pilot valve.`,

  proTips: [
    'PJRC\'s analogWrite table gives an ideal frequency for each resolution (36 621 Hz at 12 bits, 146 kHz at 10 bits, 586 kHz at 8 bits at 600 MHz). Higher frequencies than the ideal throw away resolution.',
    'Pins on one FlexPWM timer share a frequency (2 & 3, 6 & 9, 7 & 8 & 25 on the 4.1). Put motor PWM and an LED dimmer on different timers if they need different frequencies.',
    'Serial on a Teensy is native USB: Serial.begin(115200) runs at USB speed whatever the number. The hardware ports are Serial1 … Serial8.',
    'For a USB MIDI controller, keyboard or joystick, pick it in Tools > USB Type. No extra chip or firmware is needed.',
    'Cut the VUSB–VIN pads before powering from VIN with USB connected, or fit a Schottky diode so the supplies cannot meet.',
  ],

  guide: [
    {
      id: 'meet-the-chip',
      title: 'Meet the processor',
      body: 'Click the black **RT1062** chip to open its inspector: an ARM Cortex-M7 at **600 MHz** with 1 MB of RAM. Every pin on the board runs at **3.3 V**.',
      check: { kind: 'inspect', part: 'u1' },
      focus: { part: 'u1' },
      hint: 'It is the large square chip near the USB end of the green board.',
      explain: 'The Uno runs at 16 MHz with 2 KB of RAM. The Teensy is about 37 times the clock with a much wider core, a floating-point unit and 500 times the RAM, but its pins take 3.3 V only.',
    },
    {
      id: 'power',
      title: 'Plug in micro-USB',
      body: 'Press **Plug micro-USB**. 5 V reaches VIN through the joined VUSB–VIN pads and the regulator makes the **3.3V RAIL**: about **3.3 V**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'power' },
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 0, above: 3.2, below: 3.4, holdMs: 300 },
        ],
      },
      focus: { control: 'power' },
      explain: 'The board draws about 100 mA at 600 MHz. PJRC recommends taking at most 250 mA more from the 3.3V pins for your own circuits.',
    },
    {
      id: 'upload',
      title: 'Upload the 12-bit sketch',
      body: 'Press **Upload sketch**. It sets `analogReadResolution(12)`, `analogWriteResolution(12)` and `analogWriteFrequency(22, 36621.09)`, then copies the pot reading straight into the LED duty. The pin-13 LED blinks as a heartbeat.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'upload' }, { kind: 'status', is: 'RUNNING' }] },
      focus: { control: 'upload' },
      explain: 'On a real board Teensyduino builds the sketch and Teensy Loader writes it through the bootloader chip. Serial is the native USB port, so the 115200 is ignored.',
    },
    {
      id: 'pot-full',
      title: 'Turn the pot to full',
      body: 'Slide **Pot position** to the top. The ADC reads **4095** and pin 22 runs at full duty: **PIN 22 LED** reads about **3 mA** = (3.3 − 1.8) / (470 + 25).',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Pot position', min: 0.97 },
          { kind: 'readout', index: 3, above: 0.0024, below: 0.0036, holdMs: 250 },
        ],
      },
      focus: { control: 'tweak:Pot position' },
      explain: '12-bit PWM gives 4096 brightness steps instead of the Uno\'s 256, so a slow fade has no visible staircase at the dim end.',
    },
    {
      id: 'over-4ma',
      title: 'Push past 4 mA',
      body: 'Slide **LED resistor** down to about **220 Ω**. **PIN 22 LED** rises above **4 mA** and the status line warns.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'LED resistor', max: 260 },
          { kind: 'readout', index: 3, above: 0.004, holdMs: 250 },
        ],
      },
      focus: { control: 'tweak:LED resistor' },
      hint: 'Keep the pot at full so the LED is on all the time.',
      explain: 'PJRC recommends at most 4 mA per pin. The pin will not die at 6 mA, but the output voltage sags and the chip heats; for anything bigger use a transistor.',
    },
    {
      id: 'direct-5v',
      title: 'Break it: 5 V straight into pin 23',
      body: 'Open **Break something** and choose **Wire a 5 V signal straight into pin 23**. The divider is bypassed.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'direct-5v' }, { kind: 'status', is: 'FAULT' }] },
      focus: { control: 'break' },
      hint: 'The clamp burns after a few hundred ms of the signal being high.',
      explain: 'The pin is clamped about a diode drop above 3.3 V by the ESD diode, which carries several mA until it fails short. NXP rates the pins to OVDD + 0.3 V = 3.6 V: the Teensy 4.1 is not 5 V tolerant.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    {
      id: 'backfeed',
      title: 'Back-feed, then cut the pads',
      body: 'Choose **Add a 5.2 V supply on VIN with USB still plugged in**: **USB PORT** goes negative, current flowing into the computer. Then switch **VUSB–VIN pads joined** off, as you would cut them, and USB PORT drops to zero while the 3.3 V rail stays up.',
      check: {
        kind: 'all',
        of: [
          { kind: 'break', failure: 'vin-backfeed' },
          { kind: 'tweak', target: 'VUSB–VIN pads joined', max: 0 },
          { kind: 'readout', index: 5, above: -0.005, below: 0.005, holdMs: 300 },
          { kind: 'readout', index: 0, above: 3.2, holdMs: 300 },
        ],
      },
      focus: { control: 'break' },
      hint: 'Break it first, watch USB PORT read negative, then flip the toggle.',
      explain: 'With the pads cut, VIN is fed only by the external supply and VUSB only by the computer, so neither can drive the other.',
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: 5 V signals, PWM resolution, shared timers and VIN.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  quiz: [
    {
      q: 'A 5 V sensor output must go to a Teensy 4.1 input. What do you need?',
      options: ['Nothing, the pins are 5 V tolerant', 'A divider or level shifter', 'A 1 kΩ series resistor only', 'analogReference(EXTERNAL)'],
      answer: 1,
      why: 'The absolute maximum is OVDD + 0.3 V = 3.6 V. A series resistor alone just lets the ESD diode carry the current; a 10 k/20 k divider gives 3.33 V.',
    },
    {
      q: 'After analogWriteResolution(12), which value gives 50 % duty?',
      options: ['128', '512', '2048', '32768'],
      answer: 2,
      why: '12 bits is 0–4095, so half is about 2048.',
    },
    {
      q: 'On a Teensy 4.1, analogWriteFrequency(2, 20000) also changes the PWM frequency of which pin?',
      options: ['Pin 3', 'Pin 13', 'Pin 22', 'None'],
      answer: 0,
      why: 'Pins 2 and 3 share the FlexPWM4.2 timer, so they always have the same frequency.',
    },
    {
      q: 'Why cut the VUSB–VIN pads before powering from VIN with USB connected?',
      options: ['To lower the board\'s current', 'So the external supply cannot back-feed the computer\'s USB port', 'To enable the USB host port', 'To make the pins 5 V tolerant'],
      answer: 1,
      why: 'Joined, the two supplies are tied together and the higher one drives current into the lower. Cut, each feeds only its own side.',
    },
  ],

  behaviors: [
    // 0.5 Hz: 1 s high, 1 s low, so the twice-a-second report sees both levels
    { id: 'square-wave', instance: 'sig', params: { element: 'v_sig', hz: 0.5, v: 5, duty: 0.5 } },
    // holds the sketch if the 3.3 V rail dies (pads cut with no external supply). bor 2.7 V is a teaching
    // threshold; fClk 1 MHz only switches off the ATmega speed-grade warning, which does not apply here
    { id: 'mcu-supply', instance: 'mcu', params: { supplyNode: '3v3', bor: 2.7, fClk: 1 } },
  ],
  transient: true,
}
