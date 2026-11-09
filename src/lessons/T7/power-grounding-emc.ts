// T7 · Power, Grounding and EMC. Source: docs/curriculum/T7/power-grounding-emc.md
//
// Every effect here comes out of the solve, not a formula. Each 1 m wire is in the netlist as a real
// R (24 AWG, 84 mΩ) in series with a real L (≈ 1 µH), in both the supply and the ground paths; the
// solenoid is R + L; the far board's bulk and ceramic capacitors (with ESR) and the flyback diode
// are elements that a failure can remove. So:
//   · the sensor error in the daisy chain is the solenoid's current times the shared wire's R;
//   · star grounding (a source-select switch pair) takes that current out of the sensor's ground;
//   · without local capacitors the wires' current must stop at Q1's turn-off rate, and L·di/dt
//     spikes the far rail (and, on a shared return, the sensor's ground); with them it barely moves;
//   · without the flyback the solenoid's 20 mH drives the drain into the same clamp for ≈ 0.5 ms.
// The MOSFET has no gate capacitance, so it starts to switch within the first edge substep (≈ 15 ns
// at dt = 1 ms, 16 substeps) and the edge rate is set by the circuit itself, which the geometric
// substeps resolve: with no capacitor at the load, Q1's source rides on the return wire's 1 µH, and
// as the current falls the L·di/dt there pulls the source below the Uno's ground (common-source
// inductance), holding Q1 partly on at V_GS ≈ Vth + √(2I/k) ≈ 1.96 V. So di/dt ≈ 2 A/µs and each
// 1 µH wire carries ≈ 2 V of L·di/dt. (Gate charge would add to the edge time; see the SIM NOTE.)
// The TMP36 is a V source from its output to its OWN ground pin (`tmp36` behavior), so any voltage
// on that ground conductor adds straight onto what the Uno's ADC (referenced to node 0) reads.
import type { Element, LessonDef } from '../../engine/types'
import { PITCH, jumper } from '../layout'

// ── bench layout: one 18 × 10 bench PCB. The Uno and the 12 V supply (the star point) on the right,
// the "far board" with the solenoid driver and the sensor on the left, 1 m of cable between (drawn short)
const UNO_AT: [number, number] = [5.4, 0.4]
const UNO_HEADER_Y = 0.16 + 0.85
const JACK: [number, number] = [2.2, 3.7]
const STAR_TP: [number, number] = [1.6, 2.2]
const TERM_AT: [number, number] = [-1.6, -3.3]
const Q1_AT: [number, number] = [-3.4, -1.0]
const RG_AT: [number, number] = [-1.4, -1.0]
const RGPD_AT: [number, number] = [-3.654, 0.7]
const SOL_AT: [number, number] = [-6.8, -2.6]
const D1_AT: [number, number] = [-5.2, -1.9]
const CBULK_AT: [number, number] = [-6.9, 0.4]
const CHF_AT: [number, number] = [-5.7, 0.6]
const TMP_AT: [number, number] = [-5.6, 3.2]
const CDEC_AT: [number, number] = [-4.5, 3.4]
const TOPO_AT: [number, number] = [-2.0, 1.6]
const RF_AT: [number, number] = [0.8, -1.6]
const CF_AT: [number, number] = [0.8, -2.6]

const unoDigital = (pin: 9 | 'GND'): [number, number, number] => {
  const lx = pin === 'GND' ? -0.25 + (3 - 4.5) * PITCH : -0.25 + (4.5 - (pin - 8)) * PITCH
  return [UNO_AT[0] - 2.4, UNO_HEADER_Y, UNO_AT[1] - lx]
}
/** analog socket A0..A5 (the +x edge, A0 toward the viewer) */
const unoAnalog = (i: number): [number, number, number] => [UNO_AT[0] + 2.4, UNO_HEADER_Y, UNO_AT[1] - (1.95 + (i - 2.5) * 0.254)]
/** power socket NC IOREF RESET 3V3 5V GND GND VIN (k = 0..7) */
const unoPower = (k: number): [number, number, number] => [UNO_AT[0] + 2.4, UNO_HEADER_Y, UNO_AT[1] - (-0.35 + (k - 3.5) * 0.254)]

const P = (xz: [number, number], dx = 0, dz = 0, y = 0.3): [number, number, number] => [xz[0] + dx, y, xz[1] + dz]
const JACK_P = P(JACK, 0.6, -0.45)
const JACK_N = P(JACK, 0.3, -0.45)
const STAR = P(STAR_TP)
const TERM_V12 = P(TERM_AT, -0.254, -0.1, 0.4)
const TERM_RET = P(TERM_AT, 0.254, -0.1, 0.4)
const TMP_GND = P(TMP_AT, 0.254, 0.5)
const TMP_OUT = P(TMP_AT, 0, 0.5)
const TMP_VS = P(TMP_AT, -0.254, 0.5)
const RG_IN = P(RG_AT, 0.508)
const RF_IN = P(RF_AT, -0.508)
const RF_OUT = P(RF_AT, 0.508)

type Wire = ReturnType<typeof jumper>
const wire = (w: Wire, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

/** 24 AWG copper, 84.2 mΩ per metre; ≈ 1 µH per metre of wire (rule of thumb) */
const R_WIRE = 0.084
const L_WIRE = 1e-6

/**
 * IRLZ44N (TO-220AB, Infineon/IR datasheet): V_DSS 55 V; V_GS(th) 1.0–2.0 V; R_DS(on) 25 mΩ at 5 V;
 * T_J 175 °C; R_θJA 62 °C/W. vth 1.5 / k 11 give 26 mΩ at V_GS = 5 V (id = k/2·(Vgs − Vth)² in
 * saturation). vBreak 60 V is the avalanche clamp just above V_DSS. The part is avalanche-rated, so
 * there is no instantaneous maxV: a solenoid kick of ½·L·I² ≈ 14 mJ is far below its E_AS.
 */
const Q1: Element = {
  id: 'Q1',
  type: 'NMOS',
  nodes: ['drain', 'g', 'pgnd'],
  vth: 1.5,
  k: 11,
  vBreak: 60,
  rating: { maxI: 47, maxP: 2.4, rth: 62, tauTh: 1.5, tMax: 175, failMode: 'short' },
  partId: 'q1',
}

const SKETCH = `// Solenoid on, solenoid off, and what the TMP36 "reads" each time
#define LOAD 9

float readTmp36C() {
  long sum = 0;
  for (int i = 0; i < 32; i++) {
    sum += analogRead(A0);
    delayMicroseconds(200);
  }
  float volts = sum / 32.0 * 5.0 / 1023.0;
  return (volts - 0.5) * 100.0;          // TMP36: 500 mV offset, 10 mV per C
}

void setup() {
  pinMode(LOAD, OUTPUT);
  digitalWrite(LOAD, LOW);
  Serial.begin(115200);
}

void loop() {
  digitalWrite(LOAD, LOW);
  delay(1000);
  float off = readTmp36C();

  digitalWrite(LOAD, HIGH);              // 1.2 A solenoid on
  delay(1000);
  float on = readTmp36C();

  Serial.print("off_C:");
  Serial.print(off);
  Serial.print(",on_C:");
  Serial.print(on);
  Serial.print(",shift_C:");
  Serial.println(on - off);
}
`

export const lesson: LessonDef = {
  id: 'power-grounding-emc',
  track: 'T7',
  title: 'Power, Grounding and EMC',
  subtitle: 'Where the current returns',
  tagline: '1.17 A coming back through 84 mΩ of shared ground wire lifts a TMP36’s ground by 98 mV, and the Uno reads 10 °C that isn’t there.',

  board: {
    name: 'GROUND BENCH',
    size: [18, 10],
    base: 'mat',
    traces: [
      [[RG_AT[0] - 0.508, RG_AT[1]], [Q1_AT[0] - 0.254, Q1_AT[1]]], // R_G to the gate
      [[Q1_AT[0] - 0.254, Q1_AT[1]], [RGPD_AT[0], RGPD_AT[1] - 0.508]], // gate to the pull-down
      [[Q1_AT[0], Q1_AT[1]], [D1_AT[0] + 0.6, D1_AT[1]]], // drain to D1's anode
      [[SOL_AT[0] + 0.9, SOL_AT[1]], [D1_AT[0] + 0.6, D1_AT[1]]], // solenoid to the drain
      [[TERM_V12[0], TERM_V12[2]], [TERM_V12[0], -4.3], [SOL_AT[0], -4.3], [SOL_AT[0], SOL_AT[1] - 0.9]], // +12 V to the solenoid
      [[D1_AT[0] - 0.6, D1_AT[1]], [D1_AT[0] - 0.6, -4.3]], // D1's cathode to +12 V
      [[CBULK_AT[0], CBULK_AT[1]], [-7.8, CBULK_AT[1]], [-7.8, -4.3], [SOL_AT[0], -4.3]], // bulk cap +
      [[CHF_AT[0], CHF_AT[1]], [CBULK_AT[0], CBULK_AT[1]]], // ceramic beside it
      [[Q1_AT[0] + 0.254, Q1_AT[1]], [Q1_AT[0] + 0.254, 1.6], [TOPO_AT[0], TOPO_AT[1]]], // source (power ground) to the topology switch
      [[TERM_RET[0], TERM_RET[2]], [TERM_RET[0], 0.4], [TOPO_AT[0] + 0.3, TOPO_AT[1]]], // switch to the return terminal (star)
      [[TOPO_AT[0] - 0.3, TOPO_AT[1]], [TOPO_AT[0] - 0.3, 2.6], [TMP_GND[0], 2.6]], // switch to the sensor ground (shared)
      [[CDEC_AT[0], CDEC_AT[1]], [TMP_AT[0], TMP_AT[1]]], // bypass cap at the TMP36
      [[RF_OUT[0], RF_OUT[2]], [CF_AT[0], CF_AT[1]]], // A0 filter: R to C
    ],
    parts: [
      {
        id: 'uno',
        kind: 'module',
        pos: [UNO_AT[0], 0, UNO_AT[1]],
        mount: 'module',
        label: 'UNO',
        role: 'Reads the TMP36 on A0 (against its own GND) and switches the solenoid from pin 9. USB powers it.',
        params: { variant: 'uno', title: 'ATELIER UNO', callout: [1.2, 1.8, 0.4] },
        circuitIds: ['PIN9', 'V_USB'],
        facts: ['ADC: 10 bits over 0–5 V, 4.9 mV per count', 'analogRead measures A0 against the Uno’s own GND pin'],
      },
      {
        id: 'jack',
        kind: 'barrel-jack',
        pos: [JACK[0], 0, JACK[1]],
        mount: 'offboard',
        label: '12 V PSU',
        role: 'Bench supply for the solenoid. Its negative meets the Uno’s GND at one point: the star.',
        params: { callout: [0.4, 1.4, 0.4] },
        circuitIds: ['V_PSU'],
        facts: ['12 V, 2 A bench supply', 'about 50 mΩ output resistance (modelled)'],
      },
      {
        id: 'star',
        kind: 'testpoint',
        pos: [STAR_TP[0], 0, STAR_TP[1]],
        mount: 'tht',
        label: 'STAR POINT',
        role: 'The single point where the supply negative, the load return and the sensor ground meet.',
        params: { color: 'black', callout: [0.3, 1.0, 0.5] },
        circuitIds: ['R_PSU_GND'],
      },
      {
        id: 'term',
        kind: 'screw-terminal',
        pos: [TERM_AT[0], 0, TERM_AT[1]],
        mount: 'tht',
        label: 'FAR BOARD IN',
        role: 'Where the 1 m supply and return wires land on the far board: +12 V left, power return right.',
        params: { pins: 2, callout: [0.4, 1.5, -0.6] },
      },
      {
        id: 'q1',
        kind: 'mosfet-to220',
        pos: [Q1_AT[0], 0, Q1_AT[1]],
        mount: 'tht',
        label: 'MOSFET',
        role: 'IRLZ44N logic-level low-side switch for the solenoid. Its source is the far board’s power ground.',
        params: { callout: [0.2, 2.4, -0.8] },
        circuitIds: ['Q1'],
        facts: [
          'V_DSS 55 V; avalanche-rated (it clamps near 60 V here)',
          'V_GS(th) 1.0–2.0 V; R_DS(on) 25 mΩ at V_GS = 5 V',
          'T_J 175 °C max; R_θJA 62 °C/W in free air',
        ],
      },
      {
        id: 'rg',
        kind: 'resistor',
        pos: [RG_AT[0], 0, RG_AT[1]],
        mount: 'tht',
        label: 'GATE R',
        role: 'Limits the gate-charging current and damps ringing (100 Ω).',
        params: { ohms: 100, callout: [0, 1.0, -0.8] },
        circuitIds: ['R_G'],
      },
      {
        id: 'rgpd',
        kind: 'resistor',
        pos: [RGPD_AT[0], 0, RGPD_AT[1]],
        rot: 90,
        mount: 'tht',
        role: 'Gate pull-down: keeps the MOSFET off while the Uno boots and pin 9 floats (10 kΩ).',
        params: { ohms: 10000 },
        circuitIds: ['R_GPD'],
      },
      {
        id: 'sol',
        kind: 'inductor',
        pos: [SOL_AT[0], 0, SOL_AT[1]],
        mount: 'tht',
        label: 'SOLENOID',
        role: 'A 12 V solenoid: 10 Ω coil, about 20 mH, so 1.17 A once its current has risen (τ = L/R = 2 ms).',
        params: { style: 'toroid', marking: '12V', callout: [0, 1.8, -0.4] },
        circuitIds: ['L_SOL', 'R_SOL'],
        facts: ['coil 10 Ω, ≈ 20 mH (illustrative; real solenoids vary with plunger position)', '12 V / 10 Ω ≈ 1.2 A, 14 W'],
      },
      {
        id: 'd1',
        kind: 'diode',
        pos: [D1_AT[0], 0, D1_AT[1]],
        rot: 180,
        mount: 'tht',
        label: 'FLYBACK',
        role: '1N4007 across the coil: at turn-off the coil’s current circulates through it instead of spiking the drain.',
        params: { marking: '1N4007', callout: [0, 1.0, 0.6] },
        circuitIds: ['D_FLY'],
        facts: ['1000 V, 1 A average, 30 A surge (I_FSM)', 'stripe (cathode) to +12 V'],
      },
      {
        id: 'cbulk',
        kind: 'capacitor-electrolytic',
        pos: [CBULK_AT[0], 0, CBULK_AT[1]],
        mount: 'tht',
        label: 'BULK 100µF',
        role: 'Bulk capacitor at the load: supplies and absorbs fast current changes locally, so the long wires never see them.',
        params: { callout: [-0.4, 1.8, 0.2] },
        circuitIds: ['C_BULK', 'R_ESR'],
        facts: ['100 µF, 25 V aluminium electrolytic', 'ESR ≈ 0.1 Ω (modelled)'],
      },
      {
        id: 'chf',
        kind: 'capacitor-ceramic',
        pos: [CHF_AT[0], 0, CHF_AT[1]],
        mount: 'tht',
        label: '100 nF',
        role: 'Ceramic beside the bulk cap: low inductance, it takes the first nanoseconds of any edge.',
        params: { callout: [0.2, 1.2, 0.4] },
        circuitIds: ['C_HF'],
        facts: ['100 nF, 50 V, X7R'],
      },
      {
        id: 'tmp36',
        kind: 'transistor-to92',
        pos: [TMP_AT[0], 0, TMP_AT[1]],
        mount: 'tht',
        label: 'TMP36',
        role: 'Temperature sensor: 750 mV at 25 °C, 10 mV/°C, measured from its OWN ground pin.',
        params: { marking: 'TMP36', callout: [0, 1.4, 0.6] },
        circuitIds: ['V_TMP', 'I_TMP'],
        facts: ['V_out = 0.5 V + 10 mV/°C × T (750 mV at 25 °C)', 'supply 2.7–5.5 V, under 50 µA', '±1 °C at 25 °C, ±2 °C over −40…+125 °C (typical)'],
      },
      {
        id: 'cdec',
        kind: 'capacitor-ceramic',
        pos: [CDEC_AT[0], 0, CDEC_AT[1]],
        mount: 'tht',
        label: 'DECOUPLE',
        role: '100 nF at the TMP36’s supply pin, as its datasheet asks: one per IC, as close as it fits.',
        params: { callout: [0.3, 1.0, 0.4] },
      },
      {
        id: 'topo',
        kind: 'switch-slide',
        pos: [TOPO_AT[0], 0, TOPO_AT[1]],
        mount: 'tht',
        label: 'STAR / SHARED',
        role: 'Chooses the solenoid’s return: its own wire to the star point, or the sensor’s ground wire (daisy chain).',
        params: { callout: [0.3, 1.2, 0.3] },
        circuitIds: ['SW_STAR', 'SW_SHARED'],
      },
      {
        id: 'rf',
        kind: 'resistor',
        pos: [RF_AT[0], 0, RF_AT[1]],
        mount: 'tht',
        label: 'A0 FILTER',
        role: '1 kΩ into 100 nF at the Uno’s A0: a 100 µs RC that swallows ns spikes but passes the slow temperature.',
        params: { ohms: 1000, callout: [0, 1.0, -0.6] },
        circuitIds: ['R_F'],
      },
      {
        id: 'cf',
        kind: 'capacitor-ceramic',
        pos: [CF_AT[0], 0, CF_AT[1]],
        mount: 'tht',
        role: 'The A0 filter’s 100 nF capacitor, from A0 to the Uno’s own GND.',
        params: {},
        circuitIds: ['C_F'],
      },
      {
        id: 'w-sup',
        kind: 'wire',
        ...wire(jumper(JACK_P, TERM_V12, 'red', 0.9), [0.6, 0.9, -0.8]),
        mount: 'offboard',
        label: '+12 V WIRE',
        role: '1 m of 24 AWG out to the far board: 84 mΩ and about 1 µH.',
        circuitIds: ['R_W_SUP', 'L_W_SUP'],
      },
      {
        id: 'w-ret',
        kind: 'wire',
        ...wire(jumper(TERM_RET, STAR, 'black', 0.7), [0, 0.8, 0.3]),
        mount: 'offboard',
        label: 'LOAD RETURN',
        role: 'The solenoid’s own 1 m return to the star point (84 mΩ, ≈ 1 µH).',
        circuitIds: ['R_W_RET', 'L_W_RET'],
      },
      {
        id: 'w-gnd',
        kind: 'wire',
        ...wire(jumper(TMP_GND, unoDigital('GND'), 'blue', 1.1), [0, 1.1, 0.3]),
        mount: 'offboard',
        label: 'SENSOR GND',
        role: 'The sensor’s 1 m ground wire to the Uno’s GND (84 mΩ, ≈ 1 µH). It should carry only the TMP36’s 50 µA.',
        circuitIds: ['R_W_GND', 'L_W_GND'],
      },
      { id: 'w-a0', kind: 'wire', ...wire(jumper(TMP_OUT, RF_IN, 'green', 1.0), [0, 0.9, 0.2]), mount: 'offboard', role: 'TMP36 output to the A0 filter.' },
      { id: 'w-a0b', kind: 'wire', ...wire(jumper(RF_OUT, unoAnalog(0), 'green', 0.6), [0, 0.6, 0]), mount: 'offboard', role: 'Filtered signal into A0.' },
      { id: 'w-5v', kind: 'wire', ...wire(jumper(unoPower(4), TMP_VS, 'red', 1.3), [0, 1.2, 0]), mount: 'offboard', role: 'The Uno’s 5 V out to the TMP36.' },
      { id: 'w-pin9', kind: 'wire', ...wire(jumper(unoDigital(9), RG_IN, 'yellow', 0.8), [0, 0.8, 0.3]), mount: 'offboard', role: 'Pin 9 out to the gate resistor.' },
      { id: 'w-psu-n', kind: 'wire', ...wire(jumper(JACK_N, STAR, 'black', 0.4), [0, 0.5, 0]), mount: 'offboard', role: 'Supply negative to the star point.' },
      { id: 'w-star-uno', kind: 'wire', ...wire(jumper(STAR, unoDigital('GND'), 'black', 0.4), [0, 0.5, 0]), mount: 'offboard', role: 'Star point to the Uno’s GND.' },
    ],
  },

  circuit: {
    elements: [
      // the Uno: USB 5 V and the gate drive, both referenced to node 0 = the Uno's GND = the star point
      { id: 'V_USB', type: 'V', nodes: ['usb5v', '0'], value: 5, rInternal: 0.1, partId: 'uno' },
      { id: 'PIN9', type: 'PIN', nodes: ['p9', '0'], pin: 9, vcc: 5, rOut: 25, rating: { maxI: 0.04 }, partId: 'uno' },
      // 12 V bench supply; its negative meets the Uno's GND at the star point
      { id: 'V_PSU', type: 'V', nodes: ['p12', 'psu_n'], value: 12, rInternal: 0.05, partId: 'jack' },
      { id: 'R_PSU_GND', type: 'R', nodes: ['psu_n', '0'], value: 0.01, partId: 'star' },
      // 1 m supply wire to the far board
      { id: 'R_W_SUP', type: 'R', nodes: ['p12', 'w_s'], value: R_WIRE, rating: { maxI: 3.5 }, partId: 'w-sup' },
      { id: 'L_W_SUP', type: 'L', nodes: ['w_s', 'v12f'], value: L_WIRE, partId: 'w-sup' },
      // far board: local decoupling, the solenoid, its flyback diode and the switch
      { id: 'C_BULK', type: 'C', nodes: ['v12f', 'esr'], value: 100e-6, polarized: true, rating: { maxV: 25 }, partId: 'cbulk' },
      { id: 'R_ESR', type: 'R', nodes: ['esr', 'pgnd'], value: 0.1, partId: 'cbulk' },
      { id: 'C_HF', type: 'C', nodes: ['v12f', 'pgnd'], value: 100e-9, partId: 'chf' },
      { id: 'L_SOL', type: 'L', nodes: ['v12f', 'sol'], value: 20e-3, partId: 'sol' },
      { id: 'R_SOL', type: 'R', nodes: ['sol', 'drain'], value: 10, rating: { maxP: 25 }, partId: 'sol' },
      { id: 'D_FLY', type: 'D', nodes: ['drain', 'v12f'], rating: { maxI: 1.5, maxV: 1000 }, partId: 'd1' },
      { id: 'R_G', type: 'R', nodes: ['p9', 'g'], value: 100, rating: { maxP: 0.25 }, partId: 'rg' },
      { id: 'R_GPD', type: 'R', nodes: ['g', 'pgnd'], value: 10e3, rating: { maxP: 0.25 }, partId: 'rgpd' },
      Q1,
      // the return topology: power ground to its own wire (star) or onto the sensor's ground (shared)
      { id: 'SW_STAR', type: 'SW', nodes: ['pgnd', 'ret'], closed: true, partId: 'topo' },
      { id: 'SW_SHARED', type: 'SW', nodes: ['pgnd', 'g_far'], closed: false, partId: 'topo' },
      { id: 'R_W_RET', type: 'R', nodes: ['ret', 'w_r'], value: R_WIRE, rating: { maxI: 3.5 }, partId: 'w-ret' },
      { id: 'L_W_RET', type: 'L', nodes: ['w_r', 'psu_n'], value: L_WIRE, partId: 'w-ret' },
      // the sensor's own ground wire back to the Uno
      { id: 'R_W_GND', type: 'R', nodes: ['g_far', 'w_g'], value: R_WIRE, rating: { maxI: 3.5 }, partId: 'w-gnd' },
      { id: 'L_W_GND', type: 'L', nodes: ['w_g', '0'], value: L_WIRE, partId: 'w-gnd' },
      // TMP36: output relative to its own ground pin (value set by the tmp36 behavior); 50 µA supply
      { id: 'V_TMP', type: 'V', nodes: ['s_out', 'g_far'], value: 0.75, partId: 'tmp36' },
      { id: 'I_TMP', type: 'I', nodes: ['usb5v', 'g_far'], value: 50e-6, partId: 'tmp36' },
      // RC filter into A0, at the Uno
      { id: 'R_F', type: 'R', nodes: ['s_out', 'a0'], value: 1000, partId: 'rf' },
      { id: 'C_F', type: 'C', nodes: ['a0', '0'], value: 100e-9, partId: 'cf' },
    ],
  },
  powerElementId: 'V_USB',
  powerLabel: 'Plug USB',
  extraPower: [{ elementId: 'V_PSU', label: 'Switch on 12 V' }],
  // 1 ms steps for the sketch; each switching step is split into 16 substeps growing ×2 from ≈ 15 ns,
  // so the wires' L·di/dt and the avalanche kicks are solved, and seen by the scope and peak readouts
  sim: { edgeSubsteps: 16 },

  readouts: [
    { label: 'SOLENOID CURRENT', source: { kind: 'current', elementId: 'L_SOL' }, unit: 'A' },
    { label: 'FAR-GROUND SHIFT', source: { kind: 'voltage', node: 'g_far', ref: '0' }, unit: 'V' },
    { label: 'A0 (AS THE UNO SEES IT)', source: { kind: 'voltage', node: 'a0', ref: '0' }, unit: 'V' },
    { label: 'READ, LOAD OFF', source: { kind: 'behavior', key: 'serial.off_C' }, unit: '°C' },
    { label: 'READ, LOAD ON', source: { kind: 'behavior', key: 'serial.on_C' }, unit: '°C' },
    { label: 'WIRING ERROR', source: { kind: 'behavior', key: 'serial.shift_C' }, unit: '°C' },
    { label: 'FAR 12 V RAIL', source: { kind: 'voltage', node: 'v12f', ref: 'pgnd' }, unit: 'V' },
    { label: 'FAR RAIL PEAK', source: { kind: 'voltage', node: 'v12f', ref: 'pgnd' }, unit: 'V', peak: true },
    { label: 'DRAIN PEAK', source: { kind: 'voltage', node: 'drain', ref: 'pgnd' }, unit: 'V', peak: true },
    { label: 'GROUND BOUNCE PEAK', source: { kind: 'voltage', node: 'g_far', ref: '0' }, unit: 'V', peak: true },
    { label: 'A0 PEAK', source: { kind: 'voltage', node: 'a0', ref: '0' }, unit: 'V', peak: true },
  ],

  // the scope samples every step and every edge substep: the far ground steps by I·R while the
  // solenoid is on (shared return), and the turn-off kick shows as a spike the frame rate never sees
  instruments: {
    scope: {
      channels: [
        { label: 'FAR GROUND', source: { kind: 'voltage', node: 'g_far' }, perDiv: 0.05, offset: -2, marks: [{ value: 0.049, label: '1 count = 4.9 mV' }] },
        { label: 'I SOLENOID', source: { kind: 'current', elementId: 'L_SOL' }, perDiv: 0.5, offset: -3.5 },
      ],
      timePerDiv: 0.2,
      trigger: { channel: 1, level: 0.3, slope: 'rising', mode: 'normal' },
    },
    chart: { signals: [1, 0], span: 10 },
  },

  sketch: { title: 'Load on, load off', code: SKETCH, pins: { 9: 'PIN9' }, analogPins: { A0: 'a0' }, vcc: 5, board: 'uno' },

  behaviors: [
    { id: 'tmp36', instance: 'tmp', params: { element: 'V_TMP', tempC: 25 } },
    { id: 'source-select', instance: 'topo', params: { switches: 'SW_STAR,SW_SHARED', mode: 0 } },
    { id: 'serial-plotter', instance: 'serial' },
  ],

  tweaks: [
    {
      label: 'Load return',
      elementId: 'behavior:topo',
      key: 'mode',
      kind: 'enum',
      min: 0,
      max: 1,
      unit: '',
      options: [
        { label: 'Star', value: 0 },
        { label: 'Shared (daisy chain)', value: 1 },
      ],
    },
    {
      label: 'A0 filter',
      elementId: 'R_F',
      key: 'value',
      kind: 'enum',
      min: 0.01,
      max: 1000,
      unit: 'Ω',
      options: [
        { label: 'None', value: 0.01 },
        { label: '1 kΩ + 100 nF', value: 1000 },
      ],
    },
    { label: 'Sensor ground wire', elementId: 'R_W_GND', key: 'value', min: 0.005, max: 0.5, log: true, unit: 'Ω' },
  ],

  statusLines: [
    { when: { kind: 'pin', pin: 9, level: 0 }, text: 'RUNNING: solenoid off. The sketch reads the TMP36 with no load current anywhere.' },
    { when: { kind: 'pin', pin: 9, level: 1 }, text: 'RUNNING: solenoid on, {0}. Far ground sits {1} above the Uno’s.' },
    { when: { kind: 'above', readout: 1, value: 0.02 }, text: 'WARNING: the far ground is {1} above the Uno’s: the solenoid’s current is flowing in the sensor’s ground wire.' },
    { when: { kind: 'above', readout: 7, value: 30 }, text: 'WARNING: the far 12 V rail spiked to {7}: nothing at the load absorbs the wires’ inductive current.' },
  ],

  failures: [
    {
      id: 'shared-return',
      label: 'Return the solenoid through the sensor ground',
      explain:
        'The TMP36 reports its voltage relative to its own GND pin. That pin now sits about 98 mV above the Uno’s ground, because the solenoid’s 1.17 A flows back through the same 84 mΩ wire: 1.17 × 0.084 = 98 mV, which the sketch reads as 9.8 °C. Load off, it reads true again. Give high-current loads their own return to the star point, and never let power current flow in a measurement ground.',
      patches: [{ op: 'set', elementId: 'behavior:topo', key: 'mode', value: 1 }],
    },
    {
      id: 'thin-ground',
      label: 'The same, with a thin 30 AWG ground wire',
      explain:
        '30 AWG is about 0.34 Ω per metre. With the solenoid’s 1.17 A on it the far ground lifts by 1.17 × 0.34 ≈ 0.40 V, a 40 °C error, and the wire dissipates 1.17² × 0.34 ≈ 0.47 W along its length. Ground errors scale with resistance, and with the current you never meant to send there.',
      patches: [
        { op: 'set', elementId: 'behavior:topo', key: 'mode', value: 1 },
        { op: 'set', elementId: 'R_W_GND', key: 'value', value: 0.34 },
      ],
    },
    {
      id: 'no-decoupling',
      label: 'Leave out the capacitors at the load',
      explain:
        'At turn-off the flyback diode catches the coil’s current, but the 1.17 A in the 1 m supply and return wires (1 µH each) must stop too, and with no capacitor at the load it can only stop as fast as Q1 turns off. Q1’s gate is driven from the Uno’s ground while its source sits on 1 µH of return wire: as the current falls, L·di/dt pulls the source about 2 V below the Uno’s ground, which holds Q1 partly on at the V_GS that passes the current (V_th + √(2I/k) ≈ 1.96 V). So di/dt ≈ 1.96 V / 1 µH ≈ 2 A/µs, the current takes about 0.6 µs to stop, and the supply wire’s L·di/dt adds another 2 V: the far rail spikes to about 12 + 2 × 1.96 ≈ 16 V. On the shared return that 2 V bounce lands on the TMP36’s ground. With 100 µF + 100 nF in place the wires’ current simply flows on into the capacitors and the rail moves by a fraction of a volt.',
      patches: [
        { op: 'remove', elementId: 'C_BULK' },
        { op: 'remove', elementId: 'R_ESR' },
        { op: 'remove', elementId: 'C_HF' },
      ],
      parts: { hide: ['cbulk', 'chf'] },
    },
    {
      id: 'no-flyback',
      label: 'Remove the flyback diode',
      explain:
        'The coil’s 20 mH keeps its 1.17 A flowing at turn-off, and with no diode the only path is through Q1 in avalanche: the drain jumps to about 60 V, five times the supply, and stays there for about L·I / (60 − 12) ≈ 0.5 ms while ½·L·I² ≈ 14 mJ is dumped into the MOSFET. The IRLZ44N is avalanche-rated and survives this, but a part rated for less, or the long wires radiating the edge, would not be so forgiving. A flyback diode (or a TVS where the coil must release fast) keeps the kick local.',
      patches: [{ op: 'remove', elementId: 'D_FLY' }],
      parts: { hide: ['d1'] },
    },
  ],

  guide: [
    {
      id: 'power-on',
      title: 'Power both sides',
      body: 'Press **Plug USB**, then **Switch on 12 V**. The solenoid is still off, so **FAR 12 V RAIL** reads the full **12 V**.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'power' }, { kind: 'status', is: 'POWERED' }, { kind: 'readout', index: 6, above: 11.5, holdMs: 300 }] },
      focus: { control: 'power' },
      hint: 'Two buttons: Plug USB for the Uno, Switch on 12 V for the solenoid supply.',
      explain: 'Two supplies, one ground: the 12 V negative meets the Uno’s GND at the star point, and every return current has to find its way back there.',
    },
    {
      id: 'star-reads-true',
      title: 'Run it with a star return',
      body: 'Press **Upload**. The solenoid switches every second, and the sketch reads the TMP36 with it off and on. With the star return, **READ, LOAD ON** is the true **25 °C**.',
      check: { kind: 'all', of: [{ kind: 'action', action: 'upload' }, { kind: 'status', is: 'RUNNING' }, { kind: 'readout', index: 4, above: 24, below: 26 }] },
      focus: { control: 'upload' },
      hint: 'The first reading arrives after one full off/on cycle, about 2 s.',
      explain: 'The solenoid’s 1.17 A goes back to the star point on its own wire. The sensor’s ground wire carries only the TMP36’s 50 µA, so its end sits 4 µV from the Uno’s ground: nothing.',
    },
    {
      id: 'daisy-chain',
      title: 'Daisy-chain the grounds',
      body: 'Set **Load return** to **Shared (daisy chain)**. Now the solenoid returns through the sensor’s ground wire. Wait for the next line: **WIRING ERROR** jumps to about **+9.8 °C**.',
      check: { kind: 'all', of: [{ kind: 'tweak', target: 'Load return', min: 1 }, { kind: 'readout', index: 5, above: 8, below: 11.5 }] },
      focus: { control: 'tweak:Load return' },
      hint: 'The sketch prints once per 2 s cycle; the error appears on the line after the change.',
      explain: 'V = I × R: 1.17 A × 0.084 Ω = 98 mV on the TMP36’s ground pin. It reports relative to that pin, so the Uno sees 0.75 + 0.098 V, and at 10 mV/°C that is 9.8 °C of pure wiring error. (Moving the switch while the solenoid is on throws 1.17 A from one 1 µH wire onto the other in an instant: GROUND BOUNCE PEAK catches that hot-switching kick too.)',
    },
    {
      id: 'scope-bounce',
      title: 'Watch the ground bounce',
      body: 'Open **Instruments**. The scope’s **FAR GROUND** trace steps up by about **0.1 V** each time the solenoid current rises: the reading error, live. **FAR-GROUND SHIFT** shows it too.',
      check: { kind: 'all', of: [{ kind: 'instruments' }, { kind: 'readout', index: 1, above: 0.08, below: 0.12, holdMs: 250 }] },
      focus: { control: 'instruments' },
      hint: 'The shift is only there while the solenoid is on: wait up to a second.',
      explain: 'A “ground” wire is a conductor with resistance and inductance like any other: V = I·R + L·di/dt. The I·R part is the steady 98 mV; the L·di/dt part comes at the edges.',
    },
    {
      id: 'no-decoupling',
      title: 'Break it: lose the local capacitors',
      body: 'Press **reset peak**, then open **Break something** and choose **Leave out the capacitors at the load**. At the next turn-off **FAR RAIL PEAK** jumps from 12 V to about **16 V**, and **GROUND BOUNCE PEAK** dips about **2 V** below the Uno’s ground.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'no-decoupling' }, { kind: 'readout', index: 7, above: 14.5 }] },
      focus: { control: 'break' },
      hint: 'The kick comes when the solenoid switches off, at most 2 s after the break.',
      explain: 'The wires carry 1.17 A through 1 µH each. With no capacitor at the load that current must stop as Q1 turns off, in about 0.6 µs: L·di/dt ≈ 1 µH × 2 A/µs ≈ 2 V on each wire. The ground wire’s 2 V lands on the TMP36’s ground; without the A0 filter it would drive the pin to −1.3 V, past the ATmega328P’s −0.5 V absolute maximum.',
    },
    {
      id: 'repair',
      title: 'Put the capacitors back',
      body: 'Open **Break something** again and choose **Repair all**.',
      check: { kind: 'action', action: 'repair' },
      focus: { control: 'break' },
    },
    {
      id: 'no-flyback',
      title: 'Break it: remove the flyback diode',
      body: 'Now choose **Remove the flyback diode**. At the next turn-off **DRAIN PEAK** jumps from 12.7 V to about **60 V**.',
      check: { kind: 'all', of: [{ kind: 'break', failure: 'no-flyback' }, { kind: 'readout', index: 8, above: 50 }] },
      focus: { control: 'break' },
      hint: 'Again, the spike comes at turn-off, within 2 s.',
      explain: 'The coil’s 20 mH stores ½·L·I² ≈ 14 mJ. With no diode to circulate its current, it forces the drain up into Q1’s avalanche for about half a millisecond. The decoupling capacitors can’t help here: this current flows in the coil, not in the wires.',
    },
    {
      id: 'fix-it',
      title: 'Fix it properly',
      body: 'Choose **Repair all**, and set **Load return** back to **Star**. After the next cycle **WIRING ERROR** is back under **0.5 °C**.',
      check: {
        kind: 'all',
        of: [{ kind: 'action', action: 'repair' }, { kind: 'tweak', target: 'Load return', max: 0 }, { kind: 'readout', index: 5, above: -0.5, below: 0.5, holdMs: 250 }],
      },
      focus: { control: 'tweak:Load return' },
      hint: 'Both: the Break menu’s Repair all, and the Load return control.',
      explain: 'Separate returns, local decoupling, a flyback at the coil and a filter at the ADC: each one keeps a current where it belongs.',
    },
    {
      id: 'quiz',
      title: 'Check yourself',
      body: 'Answer the questions in **Check yourself** below: they use V = I·R, L·di/dt and the star rule.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  meet: `Every amp that leaves a supply must come back to it. Wires and traces have resistance, so **ground is not one voltage**: it differs from place to place by I × R, plus L·di/dt while the current is changing.

**Shared return.** The solenoid draws 12 V over its 10 Ω coil plus about 0.29 Ω of supply, wires, MOSFET and switch contact: ≈ **1.17 A**. Sent back through the sensor’s 1 m of 24 AWG (84 mΩ), it lifts the TMP36’s ground by 1.17 × 0.084 = **98 mV**. The TMP36 reports 10 mV/°C relative to its own ground pin, so that is a **9.8 °C** error, about 20 counts of the Uno’s 4.9 mV.

**PCB traces.** 1 oz copper is 35 µm thick, so its sheet resistance is ρ/t = 1.72e-8 / 35e-6 ≈ **0.5 mΩ per square**. A trace 1 mm wide and 40 mm long is 40 squares, **20 mΩ**; one 0.5 mm × 100 mm is 200 squares, about **0.1 Ω**: as bad as our wire.

**Inductance.** A wire is roughly **1 µH per metre** (a straight 24 AWG wire computes to about 1.6 µH). V = L·di/dt, so stopping 1.17 A in 0.6 µs puts about **2 V** across each 1 µH wire. With no capacitor at the load that is what happens at every turn-off: the far rail spikes to about 16 V and, on a shared return, the sensor’s ground dips 2 V below the Uno’s. The edge rate itself comes from the wire: the return wire’s L·di/dt lifts Q1’s source against its gate drive and slows the turn-off.

**Decoupling.** A capacitor at the load supplies and absorbs fast current changes locally, so they never travel the long loop: **100 nF ceramic at every IC supply pin**, plus a **bulk** electrolytic (here 100 µF) where a load draws amps.

**The fixes:**
1. **Star ground:** high-current returns go straight to the supply’s negative on their own wire; sensor grounds take their own wire to the same point.
2. **Ground plane** on PCBs: the return current runs directly under its trace, so the loop is small and so is its inductance.
3. **Decoupling** at every IC and bulk capacitance at every power load.
4. **Flyback diode or TVS** right at every coil, and a **ferrite or RC filter** on sensor lines that must cross a noisy area.`,

  mechanicalAnalogy: `Picture two hydraulic consumers sharing one return line to the tank. When the big cylinder dumps flow, the return line’s pressure rises, and a gauge referenced to that line reads high although the circuit it measures didn’t change. Star grounding gives each consumer its own return line to the tank, with the gauge’s reference port on a dead-ended line where no flow runs. Wire inductance is the oil column’s inertia: stop the flow fast and you get water hammer, and the accumulator next to the valve (the decoupling capacitor) is what absorbs it.

**Where it breaks:** hydraulic lines only have resistance and some inertia. Electrical returns also radiate and pick up fields, so a loop’s *area* matters (EMI), not just its length. There is no hydraulic equivalent of a ground loop acting as an antenna.`,

  proTips: [
    'For every high-current path, draw the return explicitly on the schematic as a real wire with a real length. If you can’t say where 1 A comes back, neither can the PCB.',
    'Measure “ground” with a meter between two ground points while the load runs. Tens of millivolts means current is flowing where your signals live.',
    'Put the flyback diode at the coil’s terminals, and the bulk and 100 nF capacitors at the driver, not at the far end of the cable. A capacitor 1 m away is behind the same 1 µH it was meant to bypass.',
  ],

  quiz: [
    {
      q: '1.2 A flows through 84 mΩ of shared ground. What error does a TMP36 (10 mV/°C) on that ground show?',
      options: ['0.1 °C', '1 °C', '10 °C', '100 °C'],
      answer: 2,
      why: '1.2 × 0.084 ≈ 0.1 V, and 0.1 V / 0.01 V per °C = 10 °C.',
    },
    {
      q: 'A 1 oz copper trace is 1 mm wide and 40 mm long. Roughly what is its resistance (≈ 0.5 mΩ per square)?',
      options: ['0.5 mΩ', '2 mΩ', '20 mΩ', '200 mΩ'],
      answer: 2,
      why: '40 mm / 1 mm = 40 squares, × 0.5 mΩ = 20 mΩ.',
    },
    {
      q: '1 µH of ground lead, 1.2 A switched in 0.5 µs. How big is the spike?',
      options: ['0.24 V', '2.4 V', '24 V', '1.2 mV'],
      answer: 1,
      why: 'V = L·di/dt = 1e-6 × 1.2 / 0.5e-6 = 2.4 V.',
    },
    {
      q: 'What is the main idea of star grounding?',
      options: [
        'Use the thickest possible wire for ground',
        'Connect all grounds in a daisy chain',
        'Give high-current returns their own path to one common point, so their I·R drop doesn’t appear in signal grounds',
        'Ground everything to the chassis',
      ],
      answer: 2,
      why: 'Signal references must sit on conductors that carry negligible current.',
    },
    {
      q: 'Why does a 100 µF capacitor at the solenoid driver stop the turn-off spike on the far rail?',
      options: [
        'It lowers the solenoid’s inductance',
        'The wires’ current can keep flowing into it instead of being stopped in nanoseconds, so L·di/dt stays small',
        'It raises the MOSFET’s breakdown voltage',
        'It filters the TMP36 output',
      ],
      answer: 1,
      why: 'With a local capacitor the 1.17 A in the wires’ inductance flows on into it and decays gently; without one it must stop as fast as the switch turns off, and V = L·di/dt spikes the rail.',
    },
  ],
}
