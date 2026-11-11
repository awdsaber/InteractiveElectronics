// T4 · Leo Bodnar BU0836: a USB joystick with no code. Source: docs/curriculum/T4/leo-bodnar-bu0836.md
//
// The board is original artwork in the style of a BU0836A (8 analog axes, a 6 × 6 button matrix,
// USB-B). The pots are real dividers into 1 MΩ ‖ 100 nF inputs (illustrative), and the button
// matrix is a real row/column scan in the netlist: the `usb-hid` behavior drives one row low per
// 1 ms step through `scan_r1` / `scan_r2` and reads the pulled-up columns, so a ghost is the solver
// finding a sneak path once a diode is missing. No sketch: the board's firmware is fixed, and the
// computer sees a USB HID game controller.
import type { LessonDef, PartPlacement } from '../../engine/types'
import { PITCH, jumper } from '../layout'

// ── layout: a 10 × 4.6 PCB (USB on the left edge, headers along the front), controls on the mat ──
const HDR_Y = 0.85 // header-male pin tops
const LEAD_Y = 0.1
/** pin i of a header of n pins centred at (cx, cz), rot 0 */
const pin = (cx: number, cz: number, n: number, i: number): [number, number, number] => [+(cx + (i - (n - 1) / 2) * PITCH).toFixed(3), HDR_Y, cz]
const AX_Z = 1.75
const AX_X = [-1.3, -0.3, 0.7, 1.7]
/** axis header k (1-based, 1–4 front row, 5–8 back row): pin 0 +5 V, 1 IN, 2 GND */
const ax = (k: number, i: 0 | 1 | 2) => pin(AX_X[(k - 1) % 4], k <= 4 ? AX_Z : 0.85, 3, i)
const ROWS: [number, number] = [2.95, 1.75]
const COLS: [number, number] = [4.25, 1.75]
const row = (r: number) => pin(ROWS[0], ROWS[1], 6, r - 1)
const col = (c: number) => pin(COLS[0], COLS[1], 6, c - 1)

// pots turned 180°: the three leads face the board. Lead −1 (end A, GND) at +x, 0 the wiper, +1 (+5 V) at −x
const THR: [number, number] = [-2.6, 4.4]
const BRK: [number, number] = [-0.6, 4.4]
const potLead = (at: [number, number], i: -1 | 0 | 1): [number, number, number] => [+(at[0] - i * 0.25).toFixed(3), LEAD_Y, at[1] - 0.4]

// matrix keys (2 × 2 corner: buttons 1, 2, 7, 8) and their diodes behind them
const KEY = { k1: [2.2, 3.8], k2: [3.8, 3.8], k7: [2.2, 5.4], k8: [3.8, 5.4] } as const
type KeyId = keyof typeof KEY
const keyLeg = (k: KeyId, side: -1 | 1): [number, number, number] => [+(KEY[k][0] + side * 0.325).toFixed(3), LEAD_Y, KEY[k][1] + 0.225]
const diodeAt = (k: KeyId): [number, number] => [KEY[k][0] + 0.18, KEY[k][1] - 0.55]
/** a diode's ends (span 1.016): anode at −x, cathode (band) at +x */
const dEnd = (k: KeyId, end: 'a' | 'k'): [number, number, number] => [+(diodeAt(k)[0] + (end === 'a' ? -0.508 : 0.508)).toFixed(3), LEAD_Y, diodeAt(k)[1]]

const ENC: [number, number] = [6.2, 4.4]
const encLead = (i: -1 | 0 | 1) => potLead(ENC, i) // −1 A, 0 C (common), +1 B
const DA: [number, number] = [6.75, 3.4]
const DB: [number, number] = [5.65, 3.4]

type Wire = ReturnType<typeof jumper>
const wire = (id: string, w: Wire, role: string, circuitIds?: string[], extra: Partial<PartPlacement> = {}): PartPlacement => ({
  id,
  kind: 'wire',
  pos: w.pos,
  params: w.params,
  mount: 'offboard',
  role,
  ...(circuitIds ? { circuitIds } : {}),
  ...extra,
})

const silk = (id: string, text: string, at: [number, number], size = 0.16): PartPlacement => ({
  id,
  kind: 'logic-ic-label',
  pos: at,
  mount: 'smd',
  role: `Silkscreen: ${text}.`,
  params: { text, size },
})

const keyPart = (k: KeyId, n: number, label: string, role: string): PartPlacement => ({
  id: k,
  kind: 'button',
  pos: [KEY[k][0], KEY[k][1]],
  mount: 'offboard',
  label: `B${n}`,
  role,
  color: n === 1 ? '#b8322a' : '#2a2a2d',
  params: { callout: [0, 0.9, 0.5] },
  circuitIds: [`sw_${k}`],
  facts: [`Matrix position: row ${n <= 6 ? 1 : 2}, column ${((n - 1) % 6) + 1} → button ${n} (button = (row − 1) × 6 + column)`, `${label}: a latching switch, so it can stay closed with others`],
})

const diodePart = (k: KeyId, n: number): PartPlacement => ({
  id: `d${n}`,
  kind: 'diode',
  pos: diodeAt(k),
  mount: 'offboard',
  ...(n === 7 ? { label: 'D7', params: { marking: '1N4148', span: 1.016, callout: [0, 0.8, -0.4] } } : { params: { marking: '1N4148', span: 1.016 } }),
  role: `One diode per switch, column side to row side: current can only flow from the column into the selected row through button ${n}, never back out of it.`,
  circuitIds: [`d_${k}`],
  facts: ['1N4148 small-signal diode: VRRM 100 V', 'VF ≤ 1 V at IF 10 mA', 'Leo Bodnar suggests 1N4148 or 1N4004 for the matrix'],
})

export const lesson: LessonDef = {
  id: 'leo-bodnar-bu0836',
  track: 'T4',
  title: 'Leo Bodnar BU0836: a USB Joystick with No Code',
  subtitle: 'Pots and buttons in, a game controller out',
  tagline: 'Wire a throttle pot and a few buttons to a BU0836-style board, plug it in, and the computer already sees a joystick: the board speaks USB HID, so you write no code at all.',

  board: {
    name: 'JOY-8 HID',
    size: [10, 4.6],
    base: 'mat',
    pcbColor: '#1d3a5f',
    frame: { size: [16, 9.8], center: [0.8, 2.4] },
    traces: [
      // USB → MCU, MCU → headers (decorative)
      [[-3.6, -0.75], [-3.0, -0.75]],
      [[-3.6, -0.45], [-3.0, -0.45]],
      [[-2.0, -0.6], [-1.3, -0.6], [-1.3, 1.45]],
      [[-2.0, -0.9], [-0.3, -0.9], [-0.3, 1.45]],
      [[-2.0, -1.2], [0.7, -1.2], [0.7, 0.55]],
      [[-2.0, -1.5], [2.95, -1.5], [2.95, 1.45]],
      [[-2.0, -1.8], [4.25, -1.8], [4.25, 1.45]],
    ],
    parts: [
      {
        id: 'usb',
        kind: 'usb-b',
        pos: [-4.35, -0.6],
        rot: 270,
        mount: 'tht',
        label: 'USB',
        role: 'Full-speed USB device port: the board takes its 5 V from the bus and sends its input reports up the same cable. This is where "Plug USB" plugs in.',
        params: { callout: [-0.4, 1.4, 0.6] },
        circuitIds: ['usb_plug'],
      },
      {
        id: 'mcu',
        kind: 'ic-smd',
        pos: [-2.5, -0.75],
        mount: 'smd',
        label: 'HID FIRMWARE',
        role: 'A USB microcontroller with fixed firmware: it samples the axes, scans the button matrix, decodes encoders and sends a HID report 500 times a second. You never program it.',
        params: { package: 'TQFP', pins: 32, marking: 'HID-8', callout: [0.2, 1.6, -0.9] },
        facts: [
          'BU0836A / BU0836X: 8 analog axes, 12-bit (4096 steps) each',
          '32 buttons, or up to 16 rotary encoders (input pairs), plus an 8-way POV hat',
          'BU0836A: 6 rows × 6 columns matrix, or up to 12 buttons wired direct to GND',
          'BU0836X: 32 independent inputs, no matrix and no diodes',
          'Matrix diodes needed from 3 simultaneous contacts (1N4148 or 1N4004)',
          'Generic USB HID game controller: no drivers; 500 updates per second (BU0836A)',
          'Bus-powered from USB; full-speed (12 Mbit/s) USB-B',
        ],
      },
      {
        id: 'xtal',
        kind: 'crystal',
        pos: [-2.5, 0.55],
        rot: 90,
        mount: 'tht',
        role: 'Clock reference. Full-speed USB needs a crystal-accurate clock for the 12 Mbit/s link.',
        params: { mhz: 12 },
      },
      { id: 'c_dec', kind: 'capacitor-smd', pos: [-1.55, -0.75], rot: 90, mount: 'smd', role: '100 nF decoupling right at the microcontroller supply pin.', params: { size: '0603', color: '#b8956a' } },
      { id: 'led', kind: 'led-smd', pos: [-4.3, 1.65], mount: 'smd', role: 'Power LED: lit whenever USB is plugged in.', params: { color: 'green' }, circuitIds: ['led_pwr'] },
      ...[1, 2, 3, 4, 5, 6, 7, 8].map(
        (k): PartPlacement => ({
          id: `ax${k}`,
          kind: 'header-male',
          pos: [AX_X[(k - 1) % 4], k <= 4 ? AX_Z : 0.85],
          mount: 'tht',
          ...(k === 1 ? { label: 'AXIS 1', params: { pins: 3, callout: [0, 1.4, 0.5] } } : { params: { pins: 3 } }),
          role: `Analog axis ${k}: its own +5 V, input and GND, one three-wire set per pot.${k > 2 ? ' Unused here: an unconnected axis is not reported.' : ''}`,
          ...(k === 1 ? { circuitIds: ['lead_thr_w'] } : k === 2 ? { circuitIds: ['lead_brk_w'] } : {}),
        }),
      ),
      { id: 'rows', kind: 'header-male', pos: ROWS, mount: 'tht', label: 'ROWS', role: 'Matrix rows 1–6. The firmware pulls one row low at a time and leaves the others high-impedance.', params: { pins: 6, callout: [0, 1.4, 0.5] }, circuitIds: ['scan_r1', 'scan_r2'] },
      { id: 'cols', kind: 'header-male', pos: COLS, mount: 'tht', label: 'COLUMNS', role: 'Matrix columns 1–6, pulled up. A column that reads low while row r is selected means the switch at (r, column) is closed.', params: { pins: 6, callout: [0.3, 1.4, 0.5] } },
      silk('s_ax', '+5V IN GND', [0.2, 2.18], 0.14),
      silk('s_rows', 'ROWS 1-6', [ROWS[0], 2.18], 0.14),
      silk('s_cols', 'COLS 1-6', [COLS[0], 2.18], 0.14),

      // ── the cockpit controls on the mat ──
      {
        id: 'pot_thr',
        kind: 'potentiometer',
        pos: THR,
        rot: 180,
        mount: 'offboard',
        label: 'THROTTLE',
        role: 'The throttle pedal\'s pot: a 10 kΩ linear divider between +5 V and GND, its wiper into axis 1.',
        params: { callout: [0, 1.6, 0.4] },
        circuitIds: ['pot_thr'],
        facts: ['10 kΩ, linear taper (B); Leo Bodnar: any 1–100 kΩ works, 10 kΩ if unsure', 'Avoid log (audio) tapers A, D, Y: the axis would not be linear', 'One +5 V / wiper / GND set per pot'],
      },
      {
        id: 'pot_brk',
        kind: 'potentiometer',
        pos: BRK,
        rot: 180,
        mount: 'offboard',
        label: 'BRAKE',
        role: 'The brake pedal\'s pot, into axis 2.',
        params: { callout: [0, 1.6, 0.4] },
        circuitIds: ['pot_brk'],
        facts: ['10 kΩ, linear taper (B)', 'Industrial pots (Bourns, Vishay Spectrol) last a few million turns'],
      },
      keyPart('k1', 1, 'IGNITION', 'Ignition switch, row 1 × column 1: button 1.'),
      keyPart('k2', 2, 'PIT LIMITER', 'Pit-limiter switch, row 1 × column 2: button 2. Watch it in the ghosting step.'),
      keyPart('k7', 7, 'LIGHTS', 'Lights switch, row 2 × column 1: button 7.'),
      keyPart('k8', 8, 'WIPERS', 'Wipers switch, row 2 × column 2: button 8.'),
      diodePart('k1', 1),
      diodePart('k2', 2),
      diodePart('k7', 7),
      diodePart('k8', 8),
      {
        id: 'enc',
        kind: 'potentiometer',
        pos: ENC,
        rot: 180,
        mount: 'offboard',
        label: 'ENCODER',
        role: 'A rotary encoder (brake bias, say): contacts A and B on columns 3 and 4 of row 1, set to encoder mode, so each click is a short press of button 3 or 4.',
        color: '#3a3c40',
        params: { endless: true, valueKey: 'hid.enc_pos', callout: [0, 1.6, 0.4] },
        circuitIds: ['enc_a', 'enc_b'],
        facts: [
          'Two contacts (A, B) and a common; one full A/B cycle per detent on this bench',
          'Set the input pair to encoder mode with Leo Bodnar\'s encoder software: 1, 2 or 4 pulses per detent, from the encoder datasheet',
          'An encoder pair starts on an odd input: 1-2, 3-4, …',
        ],
      },
      { id: 'da', kind: 'diode', pos: DA, rot: 90, mount: 'offboard', role: 'Diode in the encoder\'s A line, like every other matrix contact.', params: { marking: '1N4148', span: 1.016 }, circuitIds: ['d_ea'] },
      { id: 'db', kind: 'diode', pos: DB, rot: 90, mount: 'offboard', role: 'Diode in the encoder\'s B line.', params: { marking: '1N4148', span: 1.016 }, circuitIds: ['d_eb'] },

      // ── wires: three per pot, the matrix daisy chains, the encoder ──
      wire('w_t5', jumper(potLead(THR, 1), ax(1, 0), 'red', 0.5), 'Throttle pot end B to axis 1 +5 V.', ['lead_thr_v']),
      wire('w_tw', jumper(potLead(THR, 0), ax(1, 1), 'yellow', 0.65), 'Throttle wiper to axis 1 input.', ['lead_thr_w']),
      wire('w_tg', jumper(potLead(THR, -1), ax(1, 2), 'black', 0.8), 'Throttle pot end A to axis 1 GND.', ['lead_thr_g']),
      wire('w_b5', jumper(potLead(BRK, 1), ax(2, 0), 'red', 0.5), 'Brake pot end B to axis 2 +5 V.', ['lead_brk_v']),
      wire('w_bw', jumper(potLead(BRK, 0), ax(2, 1), 'yellow', 0.65), 'Brake wiper to axis 2 input.', ['lead_brk_w']),
      wire('w_bg', jumper(potLead(BRK, -1), ax(2, 2), 'black', 0.8), 'Brake pot end A to axis 2 GND.', ['lead_brk_g']),
      wire('w_r1', jumper(row(1), dEnd('k1', 'k'), 'blue', 0.6), 'Row 1 to the cathodes of D1 and D2.'),
      wire('w_r1b', jumper(dEnd('k1', 'k'), dEnd('k2', 'k'), 'blue', 0.25), 'Row 1 daisy chain.'),
      wire('w_r2', jumper(row(2), dEnd('k7', 'k'), 'green', 1.1), 'Row 2 to the cathodes of D7 and D8.'),
      wire('w_r2b', jumper(dEnd('k7', 'k'), dEnd('k8', 'k'), 'green', 0.25), 'Row 2 daisy chain.'),
      wire('w_c1', jumper(col(1), keyLeg('k1', -1), 'orange', 0.9), 'Column 1 to buttons 1 and 7.'),
      wire('w_c1b', jumper(keyLeg('k1', -1), keyLeg('k7', -1), 'orange', 0.3), 'Column 1 daisy chain.'),
      wire('w_c2', jumper(col(2), keyLeg('k2', -1), 'white', 0.8), 'Column 2 to buttons 2 and 8.'),
      wire('w_c2b', jumper(keyLeg('k2', -1), keyLeg('k8', -1), 'white', 0.3), 'Column 2 daisy chain.'),
      wire('w_ec', jumper(row(1), encLead(0), 'blue', 1.0), 'Row 1 to the encoder common.'),
      wire('w_ea', jumper(col(3), [DA[0], LEAD_Y, DA[1] - 0.508], 'purple', 0.6), 'Column 3 to the encoder\'s A contact, through its diode.'),
      wire('w_eb', jumper(col(4), [DB[0], LEAD_Y, DB[1] - 0.508], 'gray', 0.5), 'Column 4 to the encoder\'s B contact, through its diode.'),
    ],
  },

  circuit: {
    elements: [
      { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5, rInternal: 0.2, partId: 'usb' },
      { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', '5v'], closed: true, partId: 'usb' },
      { id: 'r_led', type: 'R', nodes: ['5v', 'led_a'], value: 1000, partId: 'led' },
      { id: 'led_pwr', type: 'LED', nodes: ['led_a', '0'], color: 'green', rating: { maxI: 0.02 }, partId: 'led' },

      // axis 1: throttle. Pot end B on +5 V, end A on GND, wiper into a 1 MΩ ‖ 100 nF input (illustrative)
      { id: 'lead_thr_v', type: 'R', nodes: ['5v', 'thr_hi'], value: 0.05, partId: 'w_t5' },
      { id: 'pot_thr', type: 'POT', nodes: ['thr_lo', 'thr_w', 'thr_hi'], value: 10000, pos: 0, partId: 'pot_thr' },
      { id: 'lead_thr_g', type: 'R', nodes: ['thr_lo', '0'], value: 0.05, partId: 'w_tg' },
      { id: 'lead_thr_w', type: 'R', nodes: ['thr_w', 'ax1'], value: 0.05, partId: 'w_tw' },
      { id: 'rin_ax1', type: 'R', nodes: ['ax1', '0'], value: 1e6, partId: 'ax1' },
      { id: 'cin_ax1', type: 'C', nodes: ['ax1', '0'], value: 100e-9, partId: 'ax1' },
      // axis 2: brake
      { id: 'lead_brk_v', type: 'R', nodes: ['5v', 'brk_hi'], value: 0.05, partId: 'w_b5' },
      { id: 'pot_brk', type: 'POT', nodes: ['brk_lo', 'brk_w', 'brk_hi'], value: 10000, pos: 0, partId: 'pot_brk' },
      { id: 'lead_brk_g', type: 'R', nodes: ['brk_lo', '0'], value: 0.05, partId: 'w_bg' },
      { id: 'lead_brk_w', type: 'R', nodes: ['brk_w', 'ax2'], value: 0.05, partId: 'w_bw' },
      { id: 'rin_ax2', type: 'R', nodes: ['ax2', '0'], value: 1e6, partId: 'ax2' },
      { id: 'cin_ax2', type: 'C', nodes: ['ax2', '0'], value: 100e-9, partId: 'ax2' },

      // matrix scan: the selected row is pulled low, the others float; columns pulled up (10 kΩ, illustrative)
      { id: 'scan_r1', type: 'SW', nodes: ['row1', '0'], closed: true, partId: 'rows' },
      { id: 'scan_r2', type: 'SW', nodes: ['row2', '0'], closed: false, partId: 'rows' },
      { id: 'pu_c1', type: 'R', nodes: ['5v', 'col1'], value: 10000, partId: 'cols' },
      { id: 'pu_c2', type: 'R', nodes: ['5v', 'col2'], value: 10000, partId: 'cols' },
      { id: 'pu_c3', type: 'R', nodes: ['5v', 'col3'], value: 10000, partId: 'cols' },
      { id: 'pu_c4', type: 'R', nodes: ['5v', 'col4'], value: 10000, partId: 'cols' },
      // key at (row r, column c): switch from the column, diode (anode → cathode) into the row
      { id: 'sw_k1', type: 'SW', nodes: ['col1', 'k1_m'], closed: false, partId: 'k1' },
      { id: 'd_k1', type: 'D', nodes: ['k1_m', 'row1'], partId: 'd1' },
      { id: 'sw_k2', type: 'SW', nodes: ['col2', 'k2_m'], closed: false, partId: 'k2' },
      { id: 'd_k2', type: 'D', nodes: ['k2_m', 'row1'], partId: 'd2' },
      { id: 'sw_k7', type: 'SW', nodes: ['col1', 'k7_m'], closed: false, partId: 'k7' },
      { id: 'd_k7', type: 'D', nodes: ['k7_m', 'row2'], partId: 'd7' },
      { id: 'sw_k8', type: 'SW', nodes: ['col2', 'k8_m'], closed: false, partId: 'k8' },
      { id: 'd_k8', type: 'D', nodes: ['k8_m', 'row2'], partId: 'd8' },
      // encoder contacts A and B: buttons 3 and 4 (row 1, columns 3 and 4)
      { id: 'enc_a', type: 'SW', nodes: ['col3', 'ea_m'], closed: false, partId: 'enc' },
      { id: 'd_ea', type: 'D', nodes: ['ea_m', 'row1'], partId: 'da' },
      { id: 'enc_b', type: 'SW', nodes: ['col4', 'eb_m'], closed: false, partId: 'enc' },
      { id: 'd_eb', type: 'D', nodes: ['eb_m', 'row1'], partId: 'db' },
    ],
  },
  powerElementId: 'usb_plug',
  powerLabel: 'Plug USB',

  behaviors: [
    {
      id: 'usb-hid',
      instance: 'hid',
      params: {
        name: 'JOY-8 HID (BU0836-style)',
        axes: 'ax1,ax2',
        axisNames: 'Throttle,Brake',
        refNode: '5v',
        bits: 12,
        reportHz: 500,
        noiseMv: 0,
        noiseAxis: 1,
        deadzonePct: 0,
        rows: 'scan_r1,scan_r2',
        cols: 'col1,col2,col3,col4',
        colVth: 2.5,
        perRow: 6,
        keys: 'sw_k1,sw_k2,sw_k7,sw_k8',
        keyButtons: '1,2,7,8',
        k1: 0,
        k2: 0,
        k3: 0,
        k4: 0,
        encPair: 3,
        encA: 'enc_a',
        encB: 'enc_b',
        cw: 0,
        ccw: 0,
        shownButtons: 12,
        buttonLabels: '1:IGNITION,2:PIT LIM,3:ENC +,4:ENC −,7:LIGHTS,8:WIPERS',
      },
    },
    { id: 'pot-knob', instance: 'thr', params: { pot: 'pot_thr', turn: 0 } },
    { id: 'pot-knob', instance: 'brk', params: { pot: 'pot_brk', turn: 0 } },
    { id: 'intermittent', instance: 'wiper', params: { element: 'lead_brk_w', good: 0.05, bad: 1e9, active: 0, goodMs: 350, badMs: 120, minMs: 30, seed: 11 } },
  ],

  readouts: [
    { label: 'THROTTLE', source: { kind: 'behavior', key: 'hid.ax1' }, unit: 'counts' },
    { label: 'BRAKE', source: { kind: 'behavior', key: 'hid.ax2' }, unit: 'counts' },
    { label: 'THROTTLE WIPER', source: { kind: 'voltage', node: 'ax1' }, unit: 'V' },
    { label: 'BUTTONS DOWN', source: { kind: 'behavior', key: 'hid.buttons_down' }, unit: '' },
    { label: 'GHOSTS', source: { kind: 'behavior', key: 'hid.ghosts' }, unit: '' },
    { label: 'ENCODER STEPS', source: { kind: 'behavior', key: 'hid.enc_steps' }, unit: '' },
    { label: 'REPORT RATE', source: { kind: 'behavior', key: 'hid.report_hz' }, unit: 'Hz' },
    { label: 'BRAKE IN GAME', source: { kind: 'behavior', key: 'hid.ax2_game' }, unit: '%' },
  ],

  instruments: {
    hid: { instance: 'hid' },
    view: 'hid',
    chart: { signals: [0, 1], span: 10 },
  },

  tweaks: [
    { label: 'Throttle pedal', elementId: 'behavior:thr', key: 'turn', min: 0, max: 100, step: 1, unit: '%' },
    { label: 'Brake pedal', elementId: 'behavior:brk', key: 'turn', min: 0, max: 100, step: 1, unit: '%' },
    { label: 'B1 IGNITION', elementId: 'behavior:hid', key: 'k1', kind: 'toggle', min: 0, max: 1, unit: '' },
    { label: 'B2 PIT LIMITER', elementId: 'behavior:hid', key: 'k2', kind: 'toggle', min: 0, max: 1, unit: '' },
    { label: 'B7 LIGHTS', elementId: 'behavior:hid', key: 'k3', kind: 'toggle', min: 0, max: 1, unit: '' },
    { label: 'B8 WIPERS', elementId: 'behavior:hid', key: 'k4', kind: 'toggle', min: 0, max: 1, unit: '' },
    { label: 'Encoder: one click clockwise', elementId: 'behavior:hid', key: 'cw', kind: 'momentary', min: 0, max: 1, unit: '' },
    { label: 'Encoder: one click anticlockwise', elementId: 'behavior:hid', key: 'ccw', kind: 'momentary', min: 0, max: 1, unit: '' },
    { label: 'Game deadzone', elementId: 'behavior:hid', key: 'deadzonePct', min: 0, max: 20, step: 1, unit: '%' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: the computer sees a game controller, with no driver and no code. THROTTLE {0}, BRAKE {1}, {6} reports.' },
    { when: { kind: 'above', readout: 0, value: 4040 }, text: 'THROTTLE reads full scale ({0}): the pedal is floored, or the pot\'s ground lead is open and the wiper sits at +5 V through the track.' },
    { when: { kind: 'above', readout: 4, value: 0.5 }, text: 'GHOST: {4} button reported that nobody pressed. Three switches are closed around a corner of the matrix and a diode is missing.' },
  ],

  failures: [
    {
      id: 'no-diode-b7',
      label: 'Leave out the diode on B7',
      explain:
        'Hold B1, B7 and B8 and the panel also lights B2, which nobody pressed: a ghost. While row 1 is low, column 2 finds a sneak path to it: through B8 into row 2, backwards through B7 to column 1, then through B1 into row 1. The column reads about 1.3 V, well under the threshold, so the firmware decides the switch at row 1 × column 2 is closed. B7\'s diode was the only thing blocking that backward leg. With two switches closed there is no such loop, which is why Leo Bodnar says diodes are needed from three simultaneous contacts (latching switches, a held button plus a toggle). Fit one diode per switch, or use a board with direct inputs (the BU0836X has 32).',
      patches: [
        { op: 'remove', elementId: 'd_k7' },
        { op: 'add', element: { id: 'd_k7_wire', type: 'R', nodes: ['k7_m', 'row2'], value: 0.01 } },
      ],
      parts: { hide: ['d7'] },
    },
    {
      id: 'worn-wiper',
      label: 'Wear out the brake pot\'s wiper',
      explain:
        'A worn or dirty track makes the wiper lose contact for tens of milliseconds at a time. While it is lifted, nothing drives the input: here it sags toward 0 through the input\'s 1 MΩ (illustrative), so BRAKE jumps down and back even with your foot still. In a game that is a brake stab. A deadzone does not fix it, because the jump is from wherever you are. Replace the pot; industrial pots (Bourns, Vishay Spectrol) last millions of turns, and a contactless Hall sensor lasts longer still.',
      patches: [{ op: 'set', elementId: 'behavior:wiper', key: 'active', value: 1 }],
    },
    {
      id: 'thr-ground-open',
      label: 'Break the throttle pot\'s ground lead',
      explain:
        'With end A no longer on GND, no current flows in the track, so there is no divider: the wiper sits at +5 V through the track resistance. The input sees 5 V × 1 MΩ / (1 MΩ + up to 10 kΩ), at least 4.95 V, so THROTTLE pins near 4095 and ignores the pedal. A pinned axis means an open ground (or a short to +5 V); an axis stuck at 0 means an open +5 V lead or a shorted wiper. That is why Leo Bodnar gives every axis its own +5 V and GND: one pot\'s broken ground cannot take the others with it.',
      patches: [{ op: 'remove', elementId: 'lead_thr_g' }],
      parts: { hide: ['w_tg'] },
    },
    {
      id: 'long-cable',
      label: 'Run the brake pot down 3 m of unshielded cable',
      explain:
        'A long unshielded run beside motor and mains wiring picks up interference. 40 mV rms (illustrative) on a 5 V, 12-bit axis is 40 / 5000 × 4096 ≈ 33 counts rms, so BRAKE jitters by about ±1 % even with the pedal still. Use shielded cable with the shield grounded at the board end, keep the pot\'s three wires together, ground a metal pot case, and use the whole pot travel so the noise is a smaller fraction of it.',
      patches: [{ op: 'set', elementId: 'behavior:hid', key: 'noiseMv', value: 40 }],
    },
  ],

  meet: `**USB HID** (Human Interface Device) is a USB class that every desktop operating system already has a driver for. A HID device starts by sending a **report descriptor**: a short, standard description of what it will send. "Generic Desktop, Joystick: 2 axes, 12 bits each, 0 to 4095; 32 buttons, 1 bit each." From then on the host polls its interrupt endpoint and receives **input reports**, a few bytes holding every axis value and button bit. A full-speed device can ask to be polled at most once per 1 ms frame; Leo Bodnar quotes **500 updates per second** for the BU0836A.

**Why no code.** The BU0836 boards ship with fixed firmware. It samples the axes, scans the buttons, decodes encoders and fills the report. Because the descriptor says "joystick", the OS's own HID driver and every game see a game controller as soon as it enumerates. There is nothing for you to program.

**The family** (Leo Bodnar's pages): **BU0836A** has 8 analog inputs at **12 bits (4096 steps)** and 32 button inputs on a **6 × 6 matrix** (or 12 buttons wired straight to GND); **BU0836X** has the same 8 axes and **32 independent inputs**, no matrix and no diodes, on push-in terminals; **BU0836-LC** swaps one axis for a load-cell input for a pressure-sensing brake. Up to 16 encoders can use input pairs, plus an 8-way hat. All are powered from USB.

**Axes are dividers.** A pot from +5 V to GND puts V = 5 V × turn on the wiper (the T1 divider lesson). The board converts it like any ADC (T3): **N = ⌊V / Vref × 4096⌋**, so half travel is about **2048**, and one count is 5 V / 4096 ≈ **1.2 mV**. The bench treats the reference as the same +5 V that feeds the pot, so the reading is a ratio and supply wander cancels.

**Buttons are a matrix.** Twelve wires (6 rows, 6 columns) serve 36 contacts: the firmware pulls one row low at a time and reads which columns follow it. Leo Bodnar numbers them row by row: row 1 + column 1 is button 1, row 1 + column 2 is button 2, row 2 + column 1 is button 7. With three switches closed on three corners of a rectangle, current can sneak round the loop and the fourth corner reads closed: a **ghost**. One diode per switch blocks the backward leg.

**Encoders** use a pair of inputs, A and B, which close in a set order as you turn: the order gives the direction. Leo Bodnar's encoder software sets a pair to the encoder's type (1, 2 or 4 pulses per detent). On this bench each click is reported as a short press of button 3 (clockwise) or 4.

**No-code or programmable?** A BU0836 is the quick, robust answer when you just need axes and buttons. If you need logic (an H-shifter's lockout, a combined clutch axis, LEDs or a display), use a board with **native USB** that you program to describe itself as a joystick: an **ATmega32U4** (Arduino Leonardo, Pro Micro; its ADC is 10-bit, 1024 steps) or a **Teensy** (see the Teensy lesson).`,

  mechanicalAnalogy: `Think of the BU0836 as a **data-acquisition card with a fixed configuration**: like a USB DAQ module you buy for a test rig, with its channel list hard-coded. The pots are **position transducers** on linkages (a pedal arm turning a shaft), exactly as you would fit a rotary potentiometer to read a lever angle on a rig. The report descriptor is the **channel map** and the 500 Hz report is the **sample rate**.

The matrix is a **multiplexed sensor array**: instead of 36 wires you share rows and columns and select one row at a time, the same trade as multiplexing strain-gauge channels through one amplifier. The diode is a **check valve** in each branch: without it, flow can loop back through a neighbouring open path and fake a reading.

Pot linearity is a **linkage design** problem: a pedal that swings 60° on a 270° pot uses only 22 % of the counts (900 of 4096), so gear or lever it to sweep most of the track, as you would match a transducer's range to the motion.`,

  proTips: [
    'Unplug USB before wiring pots (Leo Bodnar says so), and give each pot its own +5 V, wiper and GND from that axis\'s terminals.',
    'Wire 24 to 20 AWG. For long runs use shielded cable, shield grounded at the board end, and ground any metal pot case. Keep one common ground for the board, pots and switches.',
    'Use linear (taper B) pots and as much of their travel as the linkage allows, then calibrate in the OS game-controller panel so the full pedal travel maps to the full axis.',
    'Set deadzones in the game (or in Leo Bodnar\'s DIView), not by wasting pot travel: a few percent at the bottom of a brake stops a resting foot from dragging it.',
    'Latching switches and rotary switches in a matrix need a diode each. If you have many toggles, a board with direct inputs (BU0836X) avoids the diodes entirely.',
  ],

  guide: [
    {
      id: 'meet-the-board',
      title: 'Meet the interface',
      body: 'Click the **HID FIRMWARE** chip in the middle of the board to open its inspector: **8 axes at 12 bits**, **32 buttons**, a USB HID game controller with **no drivers**.',
      check: { kind: 'inspect', part: 'mcu' },
      focus: { part: 'mcu' },
      hint: 'The square chip with pins on four sides, left of centre.',
      explain: 'Its firmware is fixed: it samples, scans and reports. The report descriptor it sends on plug-in says "joystick", so the OS uses its own HID driver.',
    },
    {
      id: 'power',
      title: 'Plug in USB',
      body: 'Press **Plug USB**. The board enumerates and **REPORT RATE** settles at about **500 Hz**: a new input report every 2 ms.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'power' },
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 6, above: 450, below: 550, holdMs: 300 },
        ],
      },
      focus: { control: 'power' },
      explain: 'There is no sketch to upload: POWERED is as far as this bench goes. 500 updates per second is Leo Bodnar\'s figure for the BU0836A; full-speed USB allows up to one poll per 1 ms frame.',
    },
    {
      id: 'open-panel',
      title: 'Open the game controller panel',
      body: 'Switch on **Instruments**. The **Game controller** tab shows what the computer receives: an axis bar with its raw count for Throttle and Brake, and a lamp for each button.',
      check: { kind: 'instruments' },
      focus: { control: 'instruments' },
      explain: 'It is the same information an OS game-controller panel shows, plus the raw counts and the report bytes behind them.',
    },
    {
      id: 'throttle-half',
      title: 'Press the throttle halfway',
      body: 'Set **Throttle pedal** to **50 %**. **THROTTLE WIPER** reads about **2.49 V** and **THROTTLE** about **2042** of 4095.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Throttle pedal', min: 45, max: 55 },
          { kind: 'readout', index: 0, above: 1850, below: 2250, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Throttle pedal' },
      explain: 'The pot is a divider: 5 V × 0.5 = 2.5 V, less 0.25 % for the 2.5 kΩ wiper source into the 1 MΩ input. N = ⌊2.494 / 5 × 4096⌋ = 2042. One count is 1.2 mV.',
    },
    {
      id: 'three-buttons',
      title: 'Latch three switches',
      body: 'Switch on **B1 IGNITION**, **B7 LIGHTS** and **B8 WIPERS**. The panel lights exactly those three: **BUTTONS DOWN 3**, **GHOSTS 0**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'B1 IGNITION', min: 1 },
          { kind: 'tweak', target: 'B7 LIGHTS', min: 1 },
          { kind: 'tweak', target: 'B8 WIPERS', min: 1 },
          { kind: 'readout', index: 3, above: 2.5, below: 3.5, holdMs: 250 },
        ],
      },
      focus: { control: 'tweak:B1 IGNITION' },
      explain: 'Three corners of the rectangle rows 1–2 × columns 1–2 are closed. The diodes let current flow only from a column into the selected row, so the fourth corner (B2) stays dark.',
    },
    {
      id: 'ghost',
      title: 'Break it: leave out B7\'s diode',
      body: 'Open **Break something** and choose **Leave out the diode on B7**. **B2 PIT LIMITER** lights up although it is off: **GHOSTS 1**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'break', failure: 'no-diode-b7' },
          { kind: 'readout', index: 4, above: 0.5, holdMs: 250 },
        ],
      },
      focus: { control: 'break' },
      explain: 'While row 1 is low, column 2 reaches it through B8, row 2, backwards through B7 to column 1, then B1. Column 2 reads about 1.3 V, so the firmware sees row 1 × column 2 closed. In a race that is the pit limiter engaging by itself.',
    },
    {
      id: 'repair',
      title: 'Fit the diode back',
      body: 'Open **Break something** again and choose **Repair all**. B2 goes dark.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    {
      id: 'ground-open',
      title: 'Break it: open the throttle\'s ground lead',
      body: 'Choose **Break the throttle pot\'s ground lead**. **THROTTLE** pins at about **4075** whatever the pedal does.',
      check: {
        kind: 'all',
        of: [
          { kind: 'break', failure: 'thr-ground-open' },
          { kind: 'readout', index: 0, above: 4040, holdMs: 300 },
        ],
      },
      focus: { control: 'break' },
      explain: 'No ground, no divider: the wiper sits at +5 V through the track, 5 V × 1 MΩ / (1 MΩ + 5 kΩ) ≈ 4.98 V, about 4075 counts. An axis pinned at the top points to the ground lead; pinned at zero, to the +5 V lead or the wiper.',
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: counts, ghosts, open leads and when to use a programmable board.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  quiz: [
    {
      q: 'A 12-bit axis measured against 5 V reads a wiper at 1.25 V. What raw count does the game controller report?',
      options: ['312', '1024', '2048', '1250'],
      answer: 1,
      why: '⌊1.25 / 5 × 4096⌋ = 1024: a quarter of the range.',
    },
    {
      q: 'Why does the BU0836 need no driver and no code?',
      options: [
        'It emulates a keyboard, which needs no driver',
        'It is a USB HID device: its fixed firmware sends a report descriptor that says "joystick", and the OS\'s built-in HID driver handles it',
        'The game installs a driver for it',
        'It uses a serial port that every game reads',
      ],
      answer: 1,
      why: 'HID is a standard USB class. The descriptor tells the host the report format, so any OS with a HID driver can read it without vendor software.',
    },
    {
      q: 'In a diode-less button matrix, when can a ghost button appear?',
      options: [
        'Whenever any button is pressed',
        'When two buttons share a row',
        'When three switches are closed on three corners of a rectangle of rows and columns',
        'Only when the USB cable is long',
      ],
      answer: 2,
      why: 'The fourth corner reads closed through a loop of the other three. Leo Bodnar asks for diodes from three simultaneous contacts.',
    },
    {
      q: 'An axis reads about 4060 of 4095 and does not move with the pedal. The most likely fault?',
      options: ['The wiper lead is open', 'The pot\'s ground lead is open', 'The pot is log taper', 'The deadzone is too large'],
      answer: 1,
      why: 'Without its ground, the track carries no current, so the wiper sits at +5 V. An open wiper would sag toward 0 instead.',
    },
    {
      q: 'You need a combined clutch axis and a gear-indicator LED. Which is the better choice?',
      options: [
        'A BU0836X, because it has more inputs',
        'A native-USB board you program (ATmega32U4 Leonardo / Pro Micro, or a Teensy) to present a joystick',
        'Two BU0836A boards',
        'An Arduino Uno, which has native USB',
      ],
      answer: 1,
      why: 'The BU0836 firmware is fixed: it reports what it measures. Logic and outputs need your own code on a board with native USB (the Uno\'s ATmega328P has none).',
    },
  ],
}
