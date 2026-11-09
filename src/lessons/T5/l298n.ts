// T5 · L298N Module (video Fig. 06). Source: docs/curriculum/T5/l298n.md
//
// Same averaged half-bridge model as `tb6612fng` (a V source = duty·Vs behind half the path
// resistance, then a SW that opens for "off"), driven every tick by the `l298n` behavior. The
// difference is the path: two saturated BJTs, fitted to the typical VCE(sat) as 1.4 V + 1.15 Ω per
// path (2.55 V at 1 A), versus the TB6612's 0.5 Ω of MOSFETs. Channel B (OUT3/OUT4, motor m2) is always in
// the netlist with IN3/IN4 pulled low and ENB jumpered (so it brakes, idle); failure F2 jumpers
// IN3/IN4 to IN1/IN2 and shows the second motor. The driver ground is the battery negative
// `bat_n`; `gnd_link` is the common-ground wire to the Uno.
import type { Element, LessonDef } from '../../engine/types'
import { PITCH, jumper } from '../layout'

// ── bench layout (one 21 × 11.5 motor bench, as tb6612fng, so the two lessons compare) ──
const UNO_AT: [number, number] = [6.3, 0.6] // rot 90: digital header toward the viewer
const MOD: [number, number] = [1.2, 2.1] // the red 43 × 43 mm module
const MOD_W = 4.3
const TOP = 0.16 // module top surface (no standoff, 1.6 mm board)
const BAT: [number, number] = [-3.7, 4.0] // 2S pack at the front left, rot 180: leads toward +x (the module)
const MOT: [number, number] = [-7.0, -1.0] // same place and turn as in tb6612fng
const MOT2: [number, number] = [8.6, -5.0] // the second motor (F2 only), behind the Uno, clear of the L298

const UNO_HEADER_Y = 0.16 + 0.85

/** a point on the module, in module-local x/z */
const m = (x: number, z: number, y = TOP): [number, number, number] => [MOD[0] + x, y, MOD[1] + z]

/** Uno digital socket (rot 90: the header runs along the front edge) */
function unoDigital(pin: number | 'GND'): [number, number, number] {
  const lx = pin === 'GND' ? -0.25 + (3 - 4.5) * PITCH : pin < 8 ? 2.35 + (3.5 - pin) * PITCH : -0.25 + (4.5 - (pin - 8)) * PITCH
  return [UNO_AT[0] - lx, UNO_HEADER_Y, UNO_AT[1] + 2.4]
}

// module connectors (module-local)
const HDR: [number, number] = [0.9, 1.85] // ENA IN1 IN2 IN3 IN4 ENB, rot 0: along x
const hdrPin = (i: number) => m(HDR[0] + (i - 2.5) * PITCH, HDR[1], TOP + 0.85)
const TB_PWR: [number, number] = [-1.1, 1.75] // +12V GND +5V, rot 0: entries face +z
const pwrEntry = (i: number) => m(TB_PWR[0] + (i - 1) * 0.508, TB_PWR[1] + 0.382, TOP + 0.3)
const TB_OUT1: [number, number] = [-1.75, -0.55] // rot 270: entries face −x
const out1Entry = (i: number) => m(TB_OUT1[0] - 0.382, TB_OUT1[1] + (i - 0.5) * 0.508, TOP + 0.3)
const TB_OUT2: [number, number] = [1.75, -0.55] // rot 90: entries face +x
const out2Entry = (i: number) => m(TB_OUT2[0] + 0.382, TB_OUT2[1] - (i - 0.5) * 0.508, TOP + 0.3)

// battery leads: the LiPo part's connector at part-local x ≈ −3.85, z = ±0.12 (red +z), rot 180
const BAT_RED: [number, number, number] = [BAT[0] + 3.85, 0.12, BAT[1] - 0.12]
const BAT_BLACK: [number, number, number] = [BAT[0] + 3.85, 0.12, BAT[1] + 0.12]
// motor terminals on the can's end cap (part-local x ≈ -5.3, z = -0.95 ± 0.35), rot 90
const MOT_T1: [number, number, number] = [MOT[0] - 0.95 - 0.35, 3.35, MOT[1] + 5.3]
const MOT_T2: [number, number, number] = [MOT[0] - 0.95 + 0.35, 3.35, MOT[1] + 5.3]
// second motor, rot 0: world = part-local
const MOT2_T1: [number, number, number] = [MOT2[0] - 5.3, 3.35, MOT2[1] - 0.95 - 0.35]
const MOT2_T2: [number, number, number] = [MOT2[0] - 5.3, 3.35, MOT2[1] - 0.95 + 0.35]

type Wire = ReturnType<typeof jumper>
const wire = (w: Wire, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

// ── circuit helpers ──
// Schottky-class flyback diode (Vf ≈ 0.45 V at 1 A)
const flyback = (id: string, a: string, k: string, partId: string): Element => ({ id, type: 'D', nodes: [a, k], is: 1e-6, n: 1.1, rs: 0.05, rating: { maxI: 3 }, partId })
const pin = (n: number): Element => ({ id: `pin${n}`, type: 'PIN', nodes: [`d${n}`, '0'], pin: n, vcc: 5, partId: 'uno' })
/** one output: source behind half the VCE(sat) slope (0.525 Ω + the closed SW's 0.05 Ω = 0.575 Ω; the behavior subtracts the 1.4 V offset from the driving source), then the off-state switch (bipolar: avalanches near 60 V, approximate) */
const half = (h: string, rq: string, en: string, s: string, out: string): Element[] => [
  { id: h, type: 'V', nodes: [`${h}_i`, 'bat_n'], value: 0, partId: 'u1' },
  { id: rq, type: 'R', nodes: [`${h}_i`, s], value: 0.525, rating: { maxI: 3 }, partId: 'u1' },
  { id: en, type: 'SW', nodes: [s, out], closed: false, vBreak: 60, rating: { maxV: 50, failMode: 'short' }, partId: 'u1' },
]
const GM48 = { r: 4, l: 0.5e-3, ke: 0.0054, kt: 0.0054, j: 3e-7, b: 8e-7, load: 0, rating: { maxI: 2 } }

const sketch = `#define ENA 5
#define IN1 7
#define IN2 8

void drive(int speed) {               // -255..255, 0 = brake
  speed = constrain(speed, -255, 255);
  if (speed > 0) {
    digitalWrite(IN1, HIGH);
    digitalWrite(IN2, LOW);
    analogWrite(ENA, speed);
  } else if (speed < 0) {
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, HIGH);
    analogWrite(ENA, -speed);
  } else {
    digitalWrite(IN1, LOW);           // IN1 = IN2 with EN high: fast stop
    digitalWrite(IN2, LOW);
    analogWrite(ENA, 255);
  }
}

void setup() {
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  Serial.begin(115200);
  Serial.println("L298N: stepping duty, watch the drop and the heatsink");
}

void loop() {
  for (int duty = 0; duty <= 255; duty += 51) {   // 0, 20, 40, 60, 80, 100 %
    drive(duty);
    Serial.print("duty_pct:");
    Serial.println(duty * 100 / 255);
    delay(3000);
  }
  drive(0);
  delay(2000);
  for (int duty = 0; duty <= 255; duty += 51) {
    drive(-duty);
    delay(1500);
  }
  analogWrite(ENA, 0);                // EN low: coast
  delay(3000);
}
`

const DIODE_PARTS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8']
const DIODE_IDS: [string, string, string][] = [
  ['d_a_hi', 'out1', 'vs'],
  ['d_a_lo', 'bat_n', 'out1'],
  ['d_b_hi', 'out2', 'vs'],
  ['d_b_lo', 'bat_n', 'out2'],
  ['d_c_hi', 'out3', 'vs'],
  ['d_c_lo', 'bat_n', 'out3'],
  ['d_d_hi', 'out4', 'vs'],
  ['d_d_lo', 'bat_n', 'out4'],
]

export const lesson: LessonDef = {
  id: 'l298n',
  fig: 6,
  track: 'T5',
  title: 'L298N Module',
  subtitle: 'The hot classic',
  tagline: "At 1 A the L298's bipolar output stage drops about 2.5 V (typical; 1.8 V best case, 3.2 V worst) and turns it into heat, about 5 times the TB6612's loss.",

  board: {
    name: 'MOTOR BENCH B',
    size: [21, 11.5],
    base: 'mat',
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], 0, UNO_AT[1]],
        rot: 90,
        mount: 'module',
        label: 'UNO',
        role: 'Logic and PWM: pin 5 drives ENA (jumper removed), pins 7 and 8 drive IN1 and IN2. USB powers the Uno only.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [1.5, 1.6, 0.6] },
        circuitIds: ['pin5', 'pin7', 'pin8', 'v_usb'],
      },
      {
        id: 'mod',
        kind: 'module',
        pos: [MOD[0], 0, MOD[1]],
        mount: 'module',
        label: 'L298N MODULE',
        role: 'The red 43 × 43 mm carrier: the L298 on its heatsink, eight flyback diodes, the 78M05 regulator, bulk caps and the terminals.',
        color: '#b8322a',
        params: { w: MOD_W, d: MOD_W, pins: 0, chip: 'none', title: 'L298N', callout: [2.4, 0.6, 2.6] },
      },
      {
        id: 'u1',
        kind: 'regulator-to220',
        pos: m(0, -0.45),
        mount: 'tht',
        label: 'L298N',
        role: 'Dual full-bridge with bipolar outputs. Vs up to 46 V, 2 A DC per bridge (3 A peak). Each conducting path is two saturated BJTs: about 2.55 V at 1 A (typical).',
        params: { package: 'Multiwatt15', pins: 15, marking: 'L298N', sub: 'MULTIWATT15', callout: [2.2, 2.6, -1.6] },
        circuitIds: ['ha', 'hb', 'rq_a', 'rq_b', 'en_a', 'en_b', 'i_vs', 'hc', 'hd', 'rq_c', 'rq_d', 'en_c', 'en_d'],
      },
      {
        id: 'hs',
        kind: 'heatsink',
        pos: m(0, -0.45),
        mount: 'tht',
        label: 'HEATSINK',
        role: 'Finned aluminium bolted to the tab. It has to move the 2–4 W of loss out of the package: Rθ ≈ 3 + 1 + 15 °C/W with it, 35 °C/W without.',
        params: { callout: [-1.6, 2.4, -0.8] },
        circuitIds: ['hs_tab'],
      },
      ...DIODE_PARTS.map((id, i) => ({
        id,
        kind: 'diode' as const,
        pos: m(-1.4 + i * 0.4, 0.55),
        rot: 90,
        mount: 'tht' as const,
        ...(i === 0 ? { label: 'FLYBACK ×8' } : {}),
        role: 'The L298 has no internal diodes: these Schottky-class diodes (1N5819-class on many modules) catch the motor\'s inductive kick, two per output.',
        params: { marking: 'SS14', ...(i === 0 ? { callout: [-4.4, 0.6, 1.0] } : {}) },
        circuitIds: [DIODE_IDS[i][0]],
      })),
      {
        id: 'u2',
        kind: 'ic-smd',
        pos: m(-1.55, 1.2),
        mount: 'smd',
        role: '78M05 linear regulator (DPAK; drawn here as a small SMD package). Makes 5 V for the L298 logic from Vs when the 5V-EN jumper is fitted. Keep Vs at 12 V or less with the jumper on, or it overheats.',
        params: { package: 'SOIC', pins: 8, marking: '78M05', callout: [-1.6, 1.0, 0.4] },
      },
      {
        id: 'jp_5v',
        kind: 'header-male',
        pos: m(-0.55, 1.2),
        mount: 'tht',
        role: 'Fitted: the +5V terminal is an output (keep Vs ≤ 12 V). Removed: you must supply 5 V to the logic yourself.',
        params: { pins: 2, callout: [-0.3, 1.2, 0.6] },
      },
      {
        id: 'jp_ena',
        kind: 'header-male',
        pos: m(HDR[0] - 2.5 * PITCH, HDR[1] - 0.45),
        rot: 90,
        mount: 'tht',
        role: 'Jumpered = channel A always enabled. Removed here, so pin 5 can PWM the ENA input.',
        params: { pins: 2, callout: [0.2, 1.1, 0.4] },
      },
      {
        id: 'jp_enb',
        kind: 'header-male',
        pos: m(HDR[0] + 2.5 * PITCH, HDR[1] - 0.45),
        rot: 90,
        mount: 'tht',
        role: 'Jumper fitted: channel B is always enabled. With IN3 = IN4 = LOW it holds motor B in a fast stop.',
        params: { pins: 2, callout: [0.4, 1.1, -0.2] },
      },
      {
        id: 'c1',
        kind: 'capacitor-electrolytic',
        pos: m(1.45, -1.55),
        mount: 'tht',
        role: 'Bulk capacitance on Vs and on 5 V (220 µF class; the values vary by module).',
        params: { d: 0.63, h: 1.1, callout: [0.8, 1.6, -0.6] },
        circuitIds: ['c_vs'],
      },
      { id: 'c2', kind: 'capacitor-electrolytic', pos: m(-1.45, -1.55), mount: 'tht', role: 'Bulk capacitor on the 5 V rail.', params: { d: 0.5, h: 0.9 } },
      {
        id: 'tb_out1',
        kind: 'screw-terminal',
        pos: m(TB_OUT1[0], TB_OUT1[1]),
        rot: 270,
        mount: 'tht',
        label: 'OUT1/2',
        role: 'Motor A output (OUT1, OUT2).',
        params: { pins: 2, callout: [-3.2, 0.2, -1.2] },
      },
      {
        id: 'tb_out2',
        kind: 'screw-terminal',
        pos: m(TB_OUT2[0], TB_OUT2[1]),
        rot: 90,
        mount: 'tht',
        role: 'Motor B output (OUT3, OUT4).',
        params: { pins: 2, callout: [0.8, 1.6, 0.2] },
      },
      {
        id: 'tb_pwr',
        kind: 'screw-terminal',
        pos: m(TB_PWR[0], TB_PWR[1]),
        mount: 'tht',
        label: '+12V GND +5V',
        role: 'Vs input, ground (to the battery and to the Uno), and 5 V in or out depending on the 5V-EN jumper.',
        params: { pins: 3, callout: [-2.2, 0.6, 2.6] },
      },
      {
        id: 'hdr_in',
        kind: 'header-male',
        pos: m(HDR[0], HDR[1]),
        mount: 'tht',
        label: 'ENA IN1 IN2 IN3 IN4 ENB',
        role: 'Logic inputs. VIH is 2.3 V minimum, so 3.3 V controllers can drive them too.',
        params: { pins: 6, callout: [1.6, 0.4, 3.2] },
      },
      {
        id: 'led_pwr',
        kind: 'led-smd',
        pos: m(1.65, 1.15),
        mount: 'smd',
        role: 'Power indicator.',
        params: { color: 'red', size: '0603', callout: [0.8, 0.9, 0.3] },
      },
      {
        id: 'bat',
        kind: 'battery-lipo',
        pos: [BAT[0], 0, BAT[1]],
        rot: 180,
        mount: 'offboard',
        label: '2S PACK',
        role: 'Motor supply: a 2S Li-ion pack, 7.4 V nominal, about 0.15 Ω internal resistance (approximate).',
        params: { marking: '2S Li-ion\n7.4 V', callout: [0, 1.4, 0] },
        circuitIds: ['bat', 'bat_sw'],
      },
      {
        id: 'mot',
        kind: 'gear-motor-wheel',
        pos: [MOT[0], 0, MOT[1]],
        rot: 90,
        mount: 'offboard',
        label: 'GEAR MOTOR',
        role: 'GM-48, the same 6 V 48:1 gear motor as in the TB6612FNG lesson, for a direct comparison: 4 Ω winding, ~150 mA no-load.',
        params: { marking: '1:48', callout: [-3.0, -1.6, 0.6] },
        circuitIds: ['m1'],
      },
      {
        id: 'mot2',
        kind: 'gear-motor-wheel',
        pos: [MOT2[0], 0, MOT2[1]],
        mount: 'offboard',
        hidden: true,
        label: 'MOTOR B',
        role: 'A second GM-48 on OUT3/OUT4, mirroring motor A.',
        params: { marking: '1:48', callout: [-2.0, -1.4, 1.2] },
        circuitIds: ['m2'],
      },
      { id: 'w_ena', kind: 'wire', ...wire(jumper(unoDigital(5), hdrPin(0), 'yellow', 0.7), [0.4, 0.8, 0.3]), mount: 'offboard', role: 'Pin 5 (PWM, ~980 Hz) to ENA, with the ENA jumper removed.' },
      { id: 'w_in1', kind: 'wire', ...wire(jumper(unoDigital(7), hdrPin(1), 'blue', 0.9), [0.2, 0.8, 0.1]), mount: 'offboard', role: 'Pin 7 to IN1.' },
      { id: 'w_in2', kind: 'wire', ...wire(jumper(unoDigital(8), hdrPin(2), 'green', 1.1), [0, 0.8, -0.1]), mount: 'offboard', role: 'Pin 8 to IN2.' },
      { id: 'w_gnd', kind: 'wire', ...wire(jumper(unoDigital('GND'), pwrEntry(1), 'black', 1.3), [0.6, 0.6, 0.8]), mount: 'offboard', label: 'COMMON GND', role: 'Uno GND to the module GND terminal: the common ground for the logic signals.' },
      { id: 'w_vs', kind: 'wire', ...wire(jumper(BAT_RED, pwrEntry(0), 'red', 0.9), [0, 0.6, 0.3]), mount: 'offboard', role: 'Battery + to the +12V (Vs) terminal.' },
      { id: 'w_bgnd', kind: 'wire', ...wire(jumper(BAT_BLACK, pwrEntry(1), 'black', 0.7), [-0.2, 0.5, 0.2]), mount: 'offboard', role: 'Battery − to GND.' },
      { id: 'w_out1', kind: 'wire', ...wire(jumper(MOT_T1, out1Entry(0), 'orange', 0.4), [0, 0.5, 0]), mount: 'offboard', role: 'OUT1 to the motor\'s + terminal.' },
      { id: 'w_out2', kind: 'wire', ...wire(jumper(MOT_T2, out1Entry(1), 'brown', 0.4), [0, 0.5, 0]), mount: 'offboard', role: 'OUT2 to the motor\'s − terminal.' },
      { id: 'w_out3', kind: 'wire', ...wire(jumper(MOT2_T1, out2Entry(0), 'orange', 0.4), [0, 0.5, 0]), mount: 'offboard', hidden: true, role: 'OUT3 to motor B.' },
      { id: 'w_out4', kind: 'wire', ...wire(jumper(MOT2_T2, out2Entry(1), 'brown', 0.4), [0, 0.5, 0]), mount: 'offboard', hidden: true, role: 'OUT4 to motor B.' },
      { id: 'w_in3', kind: 'wire', ...wire(jumper(hdrPin(1), hdrPin(3), 'blue', 0.35), [0, 0.4, 0]), mount: 'offboard', hidden: true, role: 'IN1 jumpered to IN3: channel B copies channel A.' },
      { id: 'w_in4', kind: 'wire', ...wire(jumper(hdrPin(2), hdrPin(4), 'green', 0.25), [0, 0.4, 0]), mount: 'offboard', hidden: true, role: 'IN2 jumpered to IN4.' },
    ],
  },

  circuit: {
    elements: [
      // USB 5 V: the Uno
      { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5, rInternal: 0.3, partId: 'uno' },
      { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', 'vbus_in'], closed: true, partId: 'uno' },
      { id: 'f1', type: 'R', nodes: ['vbus_in', '5v'], value: 0.3, rating: { maxI: 1.0 }, partId: 'uno' },
      { id: 'r_board', type: 'R', nodes: ['5v', '0'], value: 111, partId: 'uno' }, // the Uno's ~45 mA
      pin(5),
      pin(7),
      pin(8),
      // L298 inputs: a few µA (modelled as 100 kΩ to the driver ground, approximate)
      { id: 'r_in5', type: 'R', nodes: ['d5', 'bat_n'], value: 100e3, partId: 'u1' },
      { id: 'r_in7', type: 'R', nodes: ['d7', 'bat_n'], value: 100e3, partId: 'u1' },
      { id: 'r_in8', type: 'R', nodes: ['d8', 'bat_n'], value: 100e3, partId: 'u1' },
      { id: 'r_in3', type: 'R', nodes: ['in3', 'bat_n'], value: 100e3, partId: 'u1' },
      { id: 'r_in4', type: 'R', nodes: ['in4', 'bat_n'], value: 100e3, partId: 'u1' },
      // motor battery and the common ground
      { id: 'bat', type: 'V', nodes: ['bat_p', 'bat_n'], value: 7.4, rInternal: 0.15, partId: 'bat' },
      { id: 'bat_sw', type: 'SW', nodes: ['bat_p', 'vs'], closed: true, partId: 'bat' },
      { id: 'gnd_link', type: 'R', nodes: ['bat_n', '0'], value: 0.01, partId: 'w_gnd' },
      { id: 'c_vs', type: 'C', nodes: ['vs', 'bat_n'], value: 220e-6, polarized: true, rating: { maxV: 35 }, partId: 'c1' },
      // the grounded Multiwatt tab bolted to the heatsink (the behavior's "heatsink fitted" flag)
      { id: 'hs_tab', type: 'R', nodes: ['hs', 'bat_n'], value: 0.01, partId: 'hs' },
      // the bridge: Vs draw (50 V absolute maximum), two channels of two outputs, eight diodes
      { id: 'i_vs', type: 'I', nodes: ['vs', 'bat_n'], value: 0, rating: { maxV: 50, failMode: 'short' }, partId: 'u1' },
      ...half('ha', 'rq_a', 'en_a', 'sa', 'out1'),
      ...half('hb', 'rq_b', 'en_b', 'sb', 'out2'),
      ...half('hc', 'rq_c', 'en_c', 'sc', 'out3'),
      ...half('hd', 'rq_d', 'en_d', 'sd', 'out4'),
      ...DIODE_IDS.map(([id, a, k], i) => flyback(id, a, k, DIODE_PARTS[i])),
      // GM-48 motors (representative values; measure your own)
      { id: 'm1', type: 'MOTOR', nodes: ['out1', 'out2'], ...GM48, partId: 'mot' },
      { id: 'm2', type: 'MOTOR', nodes: ['out3', 'out4'], ...GM48, partId: 'mot2' },
    ],
  },
  powerElementId: 'usb_plug',
  powerLabel: 'Plug USB',
  extraPower: [{ elementId: 'bat_sw', label: 'Connect battery' }],
  transient: true,
  // an inductive kick into an open output (no flyback diodes) lasts microseconds
  sim: { edgeSubsteps: 12 },

  behaviors: [
    {
      id: 'l298n',
      params: {
        in1: 'd7', in2: 'd8', ena: 'd5', in3: 'in3', in4: 'in4', enb: '', gnd: 'bat_n', vs: 'vs', supply: 'i_vs', sink: 'hs_tab',
        vce0: 1.4, rTotal: 1.15 /* typical VCE(sat) fit per path: 2.55 V at 1 A, 3.7 V at 2 A */,
        iqHigh: 0.05, iqLow: 0.013, iqOff: 0.004, pwmHz: 980, rthJC: 3, rthCS: 1, rthSA: 15, rthJA: 35,
        tauTh: 4 /* time-compressed: a real module on its heatsink takes minutes */,
        tsd: 150, tsdHyst: 20 /* approximate: the datasheet gives no threshold */, gear: 48,
      },
    },
    { id: 'mcu-supply', instance: 'mcu', params: { supplyNode: '5v', bor: 2.7, fClk: 16 } },
    { id: 'serial-plotter', instance: 'serial' },
  ],

  readouts: [
    { label: 'BATTERY Vs', source: { kind: 'voltage', node: 'vs', ref: 'bat_n' }, unit: 'V' },
    { label: 'MOTOR VOLTS', source: { kind: 'voltage', node: 'out1', ref: 'out2' }, unit: 'V' },
    { label: 'BRIDGE DROP', source: { kind: 'behavior', key: 'l298n.drop_V' }, unit: 'V' },
    { label: 'MOTOR CURRENT', source: { kind: 'current', elementId: 'm1' }, unit: 'A' },
    { label: 'BRIDGE HEAT', source: { kind: 'behavior', key: 'l298n.bridge_W' }, unit: 'W' },
    { label: 'L298 Tj', source: { kind: 'behavior', key: 'l298n.tj' }, unit: '°C' },
    { label: 'OUTPUT SPEED', source: { kind: 'behavior', key: 'l298n.rpm_out' }, unit: 'rpm' },
    { label: 'EFFICIENCY', source: { kind: 'behavior', key: 'l298n.efficiency' }, unit: '%' },
  ],

  sketch: { title: 'Measure the drop', code: sketch, pins: { 5: 'pin5', 7: 'pin7', 8: 'pin8' }, vcc: 5, board: 'uno' },

  tweaks: [
    { label: 'Supply Vs', elementId: 'bat', key: 'value', min: 5, max: 24, step: 0.1, unit: 'V' },
    { label: 'Load torque (motor shaft)', elementId: 'm1', key: 'load', min: 0, max: 0.008, step: 0.0002, unit: 'N·m' },
    { label: 'Heatsink Rθsa', elementId: 'behavior:l298n', key: 'rthSA', min: 2, max: 30, step: 0.5, unit: '°C/W' },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'POWERED: connect the battery too, then upload the sketch. Vs and the Uno\'s USB 5 V are separate supplies with one common ground.' },
    { when: { kind: 'state', is: 'RUNNING' }, text: 'RUNNING: compare MOTOR VOLTS ({1}) with BATTERY ({0}). The difference, {2}, is heat in the L298.' },
    { when: { kind: 'above', readout: 2, value: 2.5 }, text: 'Over 2.5 V lost in the bridge ({2}): a third of a 2S pack, turned into heat.' },
    { when: { kind: 'above', readout: 5, value: 130 }, text: 'L298 junction at {5}: overtemperature shutdown near 150 °C (approximate).' },
  ],

  failures: [
    {
      id: 'no-flyback',
      label: 'Remove the flyback diodes',
      explain:
        'The L298 has no internal diodes, so the datasheet requires external fast ones (trr ≤ 200 ns). Without them, the moment the outputs turn off with current flowing, the motor\'s 0.5 mH has nowhere to send its current: the voltage across the open output transistors jumps far above the 50 V absolute maximum and they fail short. With EN-PWM that happens at the first PWM off edge (here at the 20 % step); in a full coast (EN low) it happens at once. The bridge is then dead, and the next drive command shorts the battery through it: about 5 A and some 30–40 W straight into the package. The energy per kick is tiny, ½ × 0.5 mH × (0.5 A)² ≈ 63 µJ, but it arrives at a voltage that punches through silicon.',
      patches: DIODE_IDS.map(([id]) => ({ op: 'remove' as const, elementId: id })),
      parts: { hide: DIODE_PARTS },
    },
    {
      id: 'two-motors-bare',
      label: 'Two motors at 1.5 A without the heatsink',
      explain:
        'On 12 V with both channels loaded to about 1.5 A, each path drops about 1.4 V + 1.5 A × 1.15 Ω ≈ 3.1 V (typical), so the bridge burns about 2 × 1.5 A × 3.1 V ≈ 9.4 W. Without the heatsink (Rθja 35 °C/W) Tj heads for 25 + 9.4 × 35 ≈ 350 °C, so the overtemperature shutdown trips within seconds of the high-duty steps and the motors pulse on and off. Even with the heatsink (3 + 1 + 15 = 19 °C/W) it would settle near 25 + 9.4 × 19 ≈ 200 °C, still too hot. This module is only comfortable at well under 1 A per channel. The supply is 12 V because on 7.4 V the motor\'s stall current is only about (7.4 − 1.4) / (4 + 1.15) ≈ 1.1 A.',
      patches: [
        { op: 'set', elementId: 'bat', key: 'value', value: 12 },
        { op: 'set', elementId: 'm1', key: 'load', value: 0.0075 },
        { op: 'set', elementId: 'm2', key: 'load', value: 0.0075 },
        { op: 'remove', elementId: 'hs_tab' },
        { op: 'short', a: 'd7', b: 'in3' },
        { op: 'short', a: 'd8', b: 'in4' },
      ],
      parts: { hide: ['hs'], show: ['mot2', 'w_out3', 'w_out4', 'w_in3', 'w_in4'] },
    },
    {
      id: 'one-cell',
      label: 'Run it from a single Li-ion cell (3.7 V)',
      explain:
        'With a light 0.3 A load the motor gets only about 3.7 − (1.4 + 0.3 × 1.15) ≈ 1.9 V. After the winding\'s own 0.3 A × 4 Ω, about 0.7 V of back-EMF is left, so the output turns at roughly 26 rpm (unloaded on 7.4 V it does about 190 rpm). The bridge and its quiescent current take about half of the battery\'s power, and a 0.5 A load would stall the motor outright. The drop is mostly fixed in volts, so it takes a bigger share of a low supply; the datasheet also wants Vs ≥ VIH + 2.5 V, and the 78M05 is far below its dropout. A low-voltage robot needs a MOSFET driver (TB6612FNG, DRV8833).',
      patches: [
        { op: 'set', elementId: 'bat', key: 'value', value: 3.7 },
        { op: 'set', elementId: 'm1', key: 'load', value: 0.0015 },
      ],
    },
  ],

  meet: `The L298 is a 1980s bipolar design that is still everywhere, because the red module is cheap and tough. Each output is a pair of BJTs. A saturated BJT always has a **VCE(sat)** across it, and the motor current passes through two of them: one sourcing from Vs, one sinking to ground.

From the datasheet (typical): source side **1.35 V** and sink side **1.2 V** at 1 A, a **total of about 2.55 V**; at 2 A it is 2.0 + 1.7 = **3.7 V**. The best case at 1 A is 1.8 V (the minimum column), and the guaranteed maximum is 3.2 V at 1 A and 4.9 V at 2 A. The drop is mostly a fixed offset plus a little resistance: about **1.4 V + 1.15 Ω × I**, so even a lightly loaded motor loses 1.5 V.

| EN | IN1 | IN2 | mode |
|---|---|---|---|
| H (or PWM) | H | L | forward |
| H (or PWM) | L | H | reverse |
| H | IN1 = IN2 | | fast motor stop (brake) |
| L | x | x | free-running stop (coast) |

**Worked example:** a 7.4 V pack with the motor drawing 1 A. The motor sees 7.4 − 2.55 ≈ **4.85 V**, and the bridge dissipates 2.55 V × 1 A ≈ **2.55 W**, so efficiency is about 4.85 / 7.4 ≈ **66 %**. The TB6612 at the same current loses 0.5 V and 0.5 W, about a fifth as much.

**Heat:** Rθjc = 3 °C/W, Rθja = 35 °C/W without a heatsink. Two channels at 1 A give about 5.1 W, so Tj ≈ 25 + 5.1 × 35 ≈ **204 °C** bare, far past the 150 °C maximum. With the module's heatsink (about 3 + 1 + 15 = 19 °C/W) it is 25 + 5.1 × 19 ≈ 122 °C. The chip has overtemperature protection, but the datasheet gives no threshold; the sim uses 150 °C with 20 °C of hysteresis (approximate).

**Module quirks:** the L298 has no internal flyback diodes, so the module carries eight. Fit the 5V-EN jumper only when Vs ≤ 12 V, so the 78M05 does not overheat. Remove the ENA/ENB jumpers to PWM. VIH is 2.3 V minimum, so 3.3 V controllers can drive it.

**PWM on EN coasts:** when EN goes low every transistor turns off, and the motor current dies away through the diodes. In the off part of each PWM cycle the motor floats at its own back-EMF, so the speed is not proportional to duty the way it is with the TB6612's drive/brake PWM: a lightly loaded motor already runs fast at 20 %.

**Where it still fits:** 12–46 V supplies, where 2.5 V is a small fraction, and teaching kits.

*Sim note:* each output is simulated as its average. The conducting path is fitted to the typical VCE(sat) as 1.4 V + 1.15 Ω (2.55 V at 1 A, 3.7 V at 2 A); brake uses the resistance only. In EN-PWM the averaged source is corrected for the coasting off phase (d·V_on + (1 − d)·back-EMF) and for the winding's rise time (τ = L/R ≈ 0.1 ms against a 0.2 ms on time at 20 %, so the effective duty is about 0.58 × d); the decay current in the off phase is ignored, so the speed at low duty reads somewhat low, within roughly ±15 % of a switched simulation. BRIDGE HEAT uses the on-phase current and a quiescent draw that depends on the inputs (4–50 mA). Without flyback diodes the averaged model has no PWM edges, so the driver behavior opens the outputs for one real off edge per drive command and the engine's transient does the rest. The junction's thermal time constant is time-compressed to 4 s (a real module on its heatsink takes minutes), so the shutdown shows within one sketch cycle. The 3D L298 is drawn as a TO-220 on its heatsink (the real Multiwatt15 has 15 staggered legs). The 3D wheel turns slowed down for the eye.`,

  mechanicalAnalogy: `The TB6612 is a ball valve: wide open, the only loss is a little pipe friction (I·R). The L298 is a pressure-reducing check valve that always takes about 1.5 bar off the line whatever the flow, plus a bit more as the flow rises, and that pressure drop times flow becomes heat in the valve body. On a 200 bar system nobody notices it. On a 7 bar system you have lost a third of your pressure.

**Where it breaks:** a BJT's drop also depends on temperature and part-to-part spread (1.8 to 3.2 V at 1 A on the datasheet), so "about 2.5 V" is a rule of thumb, not a constant.`,

  proTips: [
    'Read saturation voltages from the max column for design and the typ column for expectations, and never design from the min column. On the L298 at 1 A that is 1.8 V best case, about 2.55 V typical and 3.2 V worst case: the difference between a working robot and a sluggish one.',
    'If you are stuck with an L298N, run it at a higher Vs and limit the PWM to the motor\'s rated voltage. The mostly fixed 2–3 V drop then costs a smaller fraction.',
    'Check the flyback diodes with a meter\'s diode test: about 0.2–0.5 V one way for a Schottky, open the other. Cheap boards sometimes have missing or reversed parts.',
    'Some clone modules fit "M7" (1N4007-class) rectifiers as the flyback diodes. Their reverse recovery is microseconds, far beyond the datasheet\'s trr ≤ 200 ns, so at every PWM edge they conduct backwards for a moment and the bridge and diodes run hot. Swap them for Schottkys (SS14, 1N5819) or ultrafast diodes (UF4007).',
  ],

  guide: [
    {
      id: 'meet-the-bridge',
      title: 'Meet the bridge',
      body: 'Click the black **L298N** package to open its inspector. It is a dual full bridge built from bipolar transistors, rated for **2 A** per channel.',
      check: { kind: 'inspect', part: 'u1' },
      focus: { part: 'u1' },
      hint: 'It is the tall chip bolted to the heatsink.',
      explain: 'Bipolar outputs saturate with a fixed voltage drop instead of a resistance, so the L298N loses about 1.4 V plus a small resistive part in the bridge. That is the whole story of this lesson.',
    },
    {
      id: 'both-supplies',
      title: 'Connect both supplies',
      body: 'Press **Plug USB** for the Uno, then **Connect battery** for the motor. **BATTERY Vs** should read about **7.4 V**, a 2S Li-ion pack.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'power' },
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 0, above: 7.0, below: 7.8, holdMs: 300 },
        ],
      },
      focus: { control: 'power' },
      hint: 'There are two power buttons at the top of the bench, one for each supply.',
      explain: 'Vs and the Uno\'s USB 5 V are separate supplies tied together by one common ground wire.',
    },
    {
      id: 'upload',
      title: 'Upload the duty-step sketch',
      body: 'Press **Upload sketch**. The sketch steps the PWM duty on ENA through 0, 20, 40, 60, 80 and 100 %, three seconds each. The motor starts turning at the 20 % step.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'upload' }, { kind: 'status', is: 'RUNNING' }, { kind: 'pin', pin: 5, level: 1 }] },
      focus: { control: 'upload' },
      hint: 'Upload only works while the board is powered.',
      explain: 'IN1 and IN2 pick the direction, ENA gets the PWM. With EN low the outputs are off and the motor coasts.',
    },
    {
      id: 'bridge-drop',
      title: 'Find the missing volts',
      body: 'Wait for the motor to start. **BRIDGE DROP** reads more than **1.4 V**: the battery says 7.4 V but the motor sees less. The difference is heat in the L298.',
      check: { kind: 'readout', index: 2, above: 1.4, holdMs: 300 },
      hint: 'It shows when the 20 % step begins, about 3 s after the upload.',
      explain: 'The datasheet gives the saturation drops of the source and sink transistors, which add to about 1.4 V plus a resistive part (here 1.15 Ω × I). At 190 rpm and 0.15 A that is about 1.6 V, close to a fifth of a 7.4 V pack.',
    },
    {
      id: 'load',
      title: 'Load the wheel',
      body: 'Slide **Load torque (motor shaft)** up to about **0.005 N·m**. At 1 A the bridge drops about **2.5 V** and **BRIDGE HEAT** passes **1.8 W**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Load torque (motor shaft)', min: 0.004 },
          { kind: 'readout', index: 4, above: 1.8, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Load torque (motor shaft)' },
      hint: 'Heat only rises while the motor is being driven, so wait for the next duty step. The efficiency readout falls toward 60 %.',
      explain: 'P = (1.4 + 1.15 I) × I plus the supply\'s 50 mA quiescent × 7.4 V: about 2.9 W at 1 A, for an efficiency near 62 %. The rest of the battery\'s power is turned into heat in the package, which is what the heatsink is for.',
    },
    {
      id: 'no-flyback',
      title: 'Break it: remove the flyback diodes',
      body: 'Open **Break something** and choose **Remove the flyback diodes**. The L298 has no internal diodes, and the next PWM edge asks the motor inductance to push its current somewhere.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'no-flyback' }, { kind: 'status', is: 'FAULT' }] },
      focus: { control: 'break' },
      hint: 'The output transistors fail at the first PWM off edge. Wait for the duty to step.',
      explain: 'An inductor cannot change its current at once. When the outputs turn off with 0.5 A flowing, the motor\'s 0.5 mH makes the output voltage jump above the 50 V absolute maximum until it finds a path. The fast diodes (trr ≤ 200 ns) give it one.',
    },
    {
      id: 'repair',
      title: 'Repair the bench',
      body: 'Open **Break something** again and choose **Repair all**. The diodes are back.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: bridge drop, heat and flyback diodes.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  quiz: [
    {
      q: 'A 7.4 V pack, the motor drawing 1 A, and a typical L298 total drop of 2.55 V. What voltage reaches the motor?',
      options: ['2.55 V', '4.85 V', '5.6 V', '7.4 V'],
      answer: 1,
      why: '7.4 − 2.55 ≈ 4.85 V. (5.6 V would need the datasheet\'s best-case 1.8 V.)',
    },
    {
      q: 'Both channels at 1 A (about 2.55 W each) with no heatsink (Rθja 35 °C/W, ambient 25 °C). What is the junction temperature?',
      options: ['88 °C', '151 °C', '204 °C', '300 °C'],
      answer: 2,
      why: 'Tj = 25 + 5.1 × 35 ≈ 204 °C, far past the 150 °C maximum, so the heatsink is required.',
    },
    {
      q: 'Why does the L298N module carry eight external diodes?',
      options: [
        'To drop the voltage for the logic',
        'The L298 has no internal flyback diodes, so the motor\'s inductive kick needs a path to the rails',
        'Reverse-polarity protection',
        'Indicator LEDs',
      ],
      answer: 1,
      why: 'The L298\'s BJTs have no body diodes (unlike MOSFETs), and the datasheet specifies external fast diodes.',
    },
    {
      q: 'At 1 A from 7.4 V, roughly what is the bridge efficiency with the L298 versus a 0.5 Ω TB6612?',
      options: ['66 % versus 93 %', '50 % versus 75 %', '93 % versus 66 %', 'Both about 99 %'],
      answer: 0,
      why: 'L298: (7.4 − 2.55) / 7.4 ≈ 66 %. TB6612: (7.4 − 0.5) / 7.4 ≈ 93 %.',
    },
  ],
}
