// T2 · Linear and Buck Regulators. Source: docs/curriculum/T2/regulators-linear-buck.md
//
// One 12 V jack feeds two 3.3 V supplies side by side, each with its own load:
// - Linear: an AMS1117-3.3 LDO as the REG primitive (dropout, quiescent current, current limit) with
//   its real thermal rating: θJA 90 °C/W on a minimal SOT-223 pad (46 °C/W on a big copper pour,
//   both from the AMS datasheet). Junction heat follows P with a 4 s time constant; at 150 °C it
//   enters thermal shutdown and cycles (rating failMode 'shutdown').
// - Buck: a real switching converter, not an averaged model. A P-channel MOSFET (IRF9540N) chops
//   Vin into a 22 mH inductor and a 470 µF capacitor at 10 kHz, with a 1N5819 Schottky as the
//   catch diode. The gate is a PWM pin referenced to Vin (vccNode, a level-shifting gate driver),
//   so the engine's switched PWM solves every on and off interval at its real edge times. A small
//   controller sketch sets D = Vout/Vin (feed-forward) plus a slow integral trim for the losses.
//   The frequency is scaled down from a real buck IC's 150 kHz–1.5 MHz (and the inductor scaled
//   up) so the bench can step at 0.8 ms: the solve cost grows with f (two pieces per period) (docs/decisions.md).
import type { Element, LessonDef } from '../../engine/types'

/**
 * AMS1117-3.3 (Advanced Monolithic Systems datasheet): 3.3 V ±1 %; dropout 1.1 V typ / 1.3 V max at
 * 1 A; current limit 0.9 A min, 1.1 A typ; quiescent current 5 mA typ; input 15 V absolute max;
 * θJA SOT-223 90 °C/W (46 to >90 °C/W with copper area); power transistor junction 150 °C max.
 * The datasheet does not give a shutdown threshold: the model trips at 150 °C and restarts 20 °C lower.
 */
const U1: Element = {
  id: 'U1',
  type: 'REG',
  nodes: ['lin_in', '0', 'vout1'],
  vout: 3.3,
  dropout: 1.1,
  iLimit: 1.1,
  iq: 0.005,
  rating: { maxV: 15, rth: 90, tauTh: 4, tMax: 150, failMode: 'shutdown' },
  partId: 'u1',
}

/** IRF9540N: −100 V, −23 A, R_DS(on) 0.117 Ω max at V_GS −10 V, V_GS(th) −2 to −4 V. vth −3 V, k 1.1 → ≈ 0.1 Ω at −12 V */
const Q_SW: Element = { id: 'Q_SW', type: 'PMOS', nodes: ['sw', 'g', 'bin'], vth: -3, k: 1.1, rating: { maxV: 100, maxI: 23 }, partId: 'q1' }

/** 1N5819: 40 V, 1 A Schottky, V_F 0.60 V max at 1 A; the model gives ≈ 0.33 V at 0.1 A */
const D_CATCH: Element = { id: 'D_CATCH', type: 'D', nodes: ['0', 'sw'], is: 1e-6, n: 1.05, rs: 0.05, rating: { maxV: 40, maxI: 1 }, partId: 'd1' }

const SKETCH = `// Buck controller: duty cycle D = Vout / Vin, plus a slow trim for the losses.
const int GATE = 9;        // to the P-channel switch's gate driver: LOW = switch ON
const float VSET = 3.3;    // target output, V
const float KDIV = 5.7;    // A0 sees Vin through a 47k / 10k divider

float trim = 0;            // integral trim: tops D up for the switch and diode losses
float soft = 0;            // soft-start: D ramps up over about 0.2 s
int lastOn = -1;
unsigned long lastPrint = 0;

void setup() {
  pinMode(GATE, OUTPUT);
  analogWrite(GATE, 255);  // gate HIGH: switch off
  Serial.begin(115200);
}

void loop() {
  float vin = analogRead(A0) * (5.0 / 1023.0) * KDIV;
  float vout = analogRead(A1) * (5.0 / 1023.0);
  if (vin < 1.0) vin = 1.0;

  float err = VSET - vout;
  if (soft < 1.0) {
    soft = soft + 0.1;     // no trimming until the soft-start is done
  } else if (err > 0.03 || err < -0.03) {
    // dead band wider than half a PWM step (12 V / 255 = 47 mV), so it settles instead of hunting
    trim = constrain(trim + 0.01 * err, -0.1, 0.2);
  }
  float d = constrain(VSET / vin + trim, 0.0, 0.95) * min(soft, 1.0);

  int on = (int)(d * 255 + 0.5);   // 8-bit PWM
  if (on != lastOn) {
    analogWrite(GATE, 255 - on);   // P-channel: ON while the pin is LOW
    lastOn = on;
  }

  if (millis() - lastPrint >= 100) {
    lastPrint = millis();
    Serial.print("duty:");
    Serial.print(on / 255.0, 3);
    Serial.print(",vin:");
    Serial.print(vin, 2);
    Serial.print(",vout:");
    Serial.println(vout, 3);
  }
  delay(20);
}
`

export const lesson: LessonDef = {
  id: 'regulators-linear-buck',
  track: 'T2',
  title: 'Linear and Buck Regulators',
  subtitle: 'Burning versus switching',
  tagline: 'From 12 V to 3.3 V at 100 mA, an LDO turns 0.9 W into heat; a buck converter loses under 0.1 W and draws a third of the current.',

  board: {
    name: 'REG-21',
    size: [18.5, 9.5],
    base: 'mat',
    parts: [
      {
        id: 'jack',
        kind: 'barrel-jack',
        pos: [-8.4, -3.6],
        mount: 'tht',
        label: '12 V IN',
        role: 'A 12 V, 2 A adapter. It feeds both regulators at once.',
        params: { callout: [-0.4, 1.4, 0.6] },
        circuitIds: ['V_IN'],
      },
      {
        id: 'u1',
        kind: 'ic-smd',
        pos: [-5.5, -2.6],
        mount: 'smd',
        label: 'LDO',
        role: 'AMS1117-3.3 low-dropout linear regulator (SOT-223, drawn as a small SMD package). It drops whatever voltage is left over across its pass transistor, as heat.',
        params: { package: 'SOIC', pins: 4, marking: 'AMS1117', callout: [-0.6, 1.6, -0.8] },
        circuitIds: ['U1'],
        facts: [
          'Output 3.3 V ±1 % (25 °C)',
          'Dropout 1.1 V typ, 1.3 V max at 1 A',
          'Current limit 0.9 A min, 1.1 A typ',
          'Quiescent current 5 mA typ, 10 mA max',
          'Input 15 V absolute max',
          'θJA (SOT-223) 90 °C/W; 46 to >90 °C/W with copper area',
          'Power transistor junction 150 °C max',
        ],
      },
      {
        id: 'cin',
        kind: 'capacitor-ceramic',
        pos: [-6.9, -2.6],
        mount: 'tht',
        role: '100 nF input bypass right at the regulator’s input pin.',
        params: { farads: 100e-9 },
      },
      {
        id: 'cout',
        kind: 'capacitor-electrolytic',
        pos: [-4.0, -2.6],
        mount: 'tht',
        role: '22 µF output capacitor. An LDO’s feedback loop needs it to stay stable (the datasheet characterises the part with 22 µF tantalum).',
        circuitIds: ['C_OUT1'],
      },
      {
        id: 's1',
        kind: 'switch-slide',
        pos: [-5.5, 0.6],
        mount: 'tht',
        role: 'Connects the linear side’s load.',
        circuitIds: ['SW_L'],
      },
      {
        id: 'rl1',
        kind: 'resistor',
        pos: [-5.5, 3.2],
        mount: 'tht',
        label: 'LOAD',
        role: 'Linear-side load: 33 Ω, 3 W wirewound, 100 mA at 3.3 V.',
        params: { ohms: 33, callout: [-1.2, 1.2, 0.8] },
        circuitIds: ['R_L1'],
      },
      {
        id: 'ctrl',
        kind: 'ic-dip',
        pos: [-0.2, -3.6],
        mount: 'tht',
        label: 'CONTROLLER',
        role: 'Plays the buck chip’s oscillator and error amplifier: it reads Vin and Vout and sets the switch’s duty cycle at 10 kHz (see the sketch).',
        params: { pins: 8, marking: 'BUCK CTRL', callout: [-0.4, 1.4, -0.8] },
        circuitIds: ['GATE'],
      },
      {
        id: 'rdiv1',
        kind: 'resistor',
        pos: [-0.2, -1.4],
        mount: 'tht',
        role: '47 kΩ top of the Vin sense divider (12 V → 2.1 V at A0).',
        params: { ohms: 47000 },
        circuitIds: ['R_DIV1'],
      },
      {
        id: 'rdiv2',
        kind: 'resistor',
        pos: [-0.2, -0.4],
        mount: 'tht',
        role: '10 kΩ bottom of the Vin sense divider.',
        params: { ohms: 10000 },
        circuitIds: ['R_DIV2'],
      },
      {
        id: 'q1',
        kind: 'mosfet-to220',
        pos: [2.6, -3.6],
        mount: 'tht',
        label: 'SWITCH',
        role: 'IRF9540N P-channel MOSFET: the buck’s switch. Gate pulled 12 V below its source, it is fully on (≈ 0.1 Ω); gate at its source, it is off.',
        params: { marking: 'IRF9540N', callout: [0.4, 2.2, -0.8] },
        circuitIds: ['Q_SW'],
        facts: ['P-channel, V_DSS −100 V, I_D −23 A (25 °C case)', 'R_DS(on) 0.117 Ω max at V_GS −10 V', 'V_GS(th) −2 to −4 V', 'V_GS ±20 V max'],
      },
      {
        id: 'rgpu',
        kind: 'resistor',
        pos: [1.2, -1.9],
        mount: 'tht',
        role: '10 kΩ gate pull-up from Vin: keeps the P-channel switch off while the controller’s pin floats (power on before the sketch runs). Without it the gate sits at 0 V and the full 12 V reaches the load.',
        params: { ohms: 10000 },
        circuitIds: ['R_GPU'],
      },
      {
        id: 'd1',
        kind: 'diode',
        pos: [2.6, -0.8],
        rot: 90,
        mount: 'tht',
        label: 'DIODE',
        role: '1N5819 Schottky catch diode. While the switch is off, the inductor’s current keeps flowing through it from ground.',
        params: { marking: '1N5819', callout: [-1.0, 1.0, 0.6] },
        circuitIds: ['D_CATCH'],
        facts: ['40 V reverse, 1 A average', 'V_F 0.60 V max at 1 A'],
      },
      {
        id: 'l1',
        kind: 'inductor',
        pos: [5.2, -2.6],
        mount: 'tht',
        label: 'INDUCTOR',
        role: '22 mH: smooths the chopped voltage into a steady current. Its ripple is ΔI = (Vin − Vout)·D/(L·f) ≈ 12 mA peak to peak.',
        params: { marking: '22mH', callout: [0.2, 1.8, -0.8] },
        circuitIds: ['L_BK'],
      },
      {
        id: 'cbk',
        kind: 'capacitor-electrolytic',
        pos: [7.4, -2.6],
        mount: 'tht',
        role: '470 µF output capacitor (about 0.2 Ω ESR): absorbs the inductor’s ripple current.',
        circuitIds: ['C_BK', 'R_ESR'],
      },
      {
        id: 's2',
        kind: 'switch-slide',
        pos: [5.6, 0.6],
        mount: 'tht',
        role: 'Connects the buck side’s load.',
        circuitIds: ['SW_B'],
      },
      {
        id: 'rl2',
        kind: 'resistor',
        pos: [5.6, 3.2],
        mount: 'tht',
        label: 'LOAD',
        role: 'Buck-side load: 33 Ω, 3 W wirewound, 100 mA at 3.3 V.',
        params: { ohms: 33, callout: [1.2, 1.2, 0.8] },
        circuitIds: ['R_L2'],
      },
    ],
  },

  circuit: {
    elements: [
      { id: 'V_IN', type: 'V', nodes: ['vin', '0'], value: 12, rInternal: 0.05, partId: 'jack' },
      // ── linear side ──
      { id: 'P_LIN', type: 'PROBE', nodes: ['vin', 'lin_in'] },
      U1,
      { id: 'C_OUT1', type: 'C', nodes: ['vout1', '0'], value: 22e-6, partId: 'cout' },
      { id: 'SW_L', type: 'SW', nodes: ['vout1', 'l1'], closed: true, partId: 's1' },
      { id: 'R_L1', type: 'R', nodes: ['l1', '0'], value: 33, rating: { maxP: 3 }, partId: 'rl1' },
      // ── buck side ──
      { id: 'R_DIV1', type: 'R', nodes: ['vin', 'a0'], value: 47000, partId: 'rdiv1' },
      { id: 'R_DIV2', type: 'R', nodes: ['a0', '0'], value: 10000, partId: 'rdiv2' },
      { id: 'P_BK', type: 'PROBE', nodes: ['vin', 'bin'] },
      // gate driver: HIGH = Vin (switch off), LOW = ground (switch on)
      { id: 'GATE', type: 'PIN', nodes: ['g', '0'], pin: 9, vcc: 5, vccNode: 'bin', rOut: 10, partId: 'ctrl' },
      // gate pull-up: holds the P-FET off while the controller's pin floats (before the sketch runs)
      { id: 'R_GPU', type: 'R', nodes: ['bin', 'g'], value: 10000, partId: 'rgpu' },
      Q_SW,
      D_CATCH,
      { id: 'L_BK', type: 'L', nodes: ['sw', 'vout2'], value: 22e-3, partId: 'l1' },
      { id: 'R_ESR', type: 'R', nodes: ['vout2', 'cb'], value: 0.2, partId: 'cbk' },
      { id: 'C_BK', type: 'C', nodes: ['cb', '0'], value: 470e-6, partId: 'cbk' },
      { id: 'SW_B', type: 'SW', nodes: ['vout2', 'l2'], closed: true, partId: 's2' },
      { id: 'R_L2', type: 'R', nodes: ['l2', '0'], value: 33, rating: { maxP: 3 }, partId: 'rl2' },
    ],
  },
  powerElementId: 'V_IN',
  powerLabel: 'Plug in 12 V',
  transient: true,
  // a 10 kHz switch period is 100 µs: at 0.8 ms each step holds 8 periods, solved edge by edge
  sim: { dt: 8e-4 },

  readouts: [
    { label: 'SUPPLY', source: { kind: 'voltage', node: 'vin' }, unit: 'V' },
    { label: 'LINEAR IN', source: { kind: 'current', elementId: 'P_LIN' }, unit: 'A' },
    { label: 'LINEAR OUT', source: { kind: 'voltage', node: 'vout1' }, unit: 'V' },
    { label: 'LINEAR HEAT', source: { kind: 'power', elementId: 'U1' }, unit: 'W' },
    { label: 'LDO TEMP', source: { kind: 'extra', key: 'U1.tj' }, unit: '°C', digits: 3, warnAbove: 125 },
    { label: 'LINEAR EFF', source: { kind: 'behavior', key: 'lin.eta' }, unit: '%', digits: 3 },
    { label: 'BUCK IN', source: { kind: 'current', elementId: 'P_BK' }, unit: 'A' },
    { label: 'BUCK OUT', source: { kind: 'voltage', node: 'vout2' }, unit: 'V' },
    { label: 'BUCK DUTY', source: { kind: 'behavior', key: 'serial.duty' }, unit: '', digits: 3 },
    { label: 'BUCK LOSS', source: { kind: 'behavior', key: 'buck.loss' }, unit: 'W' },
    { label: 'BUCK EFF', source: { kind: 'behavior', key: 'buck.eta' }, unit: '%', digits: 3 },
  ],

  sketch: {
    title: 'Buck controller',
    code: SKETCH,
    pins: { 9: 'GATE' },
    analogPins: { A0: 'a0', A1: 'vout2' },
    vcc: 5,
    board: 'generic',
    pwmFreq: 10000,
  },

  behaviors: [
    { id: 'serial-plotter', instance: 'serial' },
    { id: 'power-meter', instance: 'lin', params: { vin: 'vin', iin: 'P_LIN', vout: 'vout1', iout: 'R_L1' } },
    { id: 'power-meter', instance: 'buck', params: { vin: 'vin', iin: 'P_BK', vout: 'vout2', iout: 'R_L2' } },
  ],

  tweaks: [
    { label: 'Input voltage', elementId: 'V_IN', key: 'value', min: 5, max: 14, step: 0.5, unit: 'V' },
    {
      label: 'Load resistance (both sides)',
      elementId: 'R_L1',
      key: 'value',
      min: 6.8,
      max: 100,
      log: true,
      unit: 'Ω',
      link: [{ elementId: 'R_L2', key: 'value' }],
    },
    {
      label: 'LDO cooling',
      elementId: 'U1',
      key: 'rating.rth',
      kind: 'enum',
      min: 46,
      max: 90,
      unit: '°C/W',
      options: [
        { label: 'Minimal pad, 90 °C/W', value: 90 },
        { label: 'Big copper pour, 46 °C/W', value: 46 },
      ],
    },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'READY' }, text: 'READY: plug in the 12 V adapter. The sketch then starts the buck with a 50 ms soft-start.' },
    {
      when: { kind: 'state', is: 'RUNNING' },
      text: 'RUNNING: the LDO turns {3} into heat at {5} efficiency; the buck switches at duty {8} and loses {9} ({10})',
    },
    { when: { kind: 'above', readout: 4, value: 125 }, text: 'HOT: the LDO junction is at {4} and still climbing toward thermal shutdown at 150 °C ({3} of heat)' },
    { when: { kind: 'state', is: 'FAULT' }, text: 'FAULT: the LDO is dead; the buck side carries on at {7}' },
  ],

  failures: [
    {
      id: 'hot-ldo',
      label: 'Ask the LDO for 220 mA',
      explain:
        'The linear load drops to 15 Ω: 220 mA. The LDO now drops (12 − 3.3) × 0.22 A ≈ 1.9 W, plus 12 V × 5 mA of its own. On a minimal pad (90 °C/W) the junction heads for 25 + 1.97 × 90 ≈ 200 °C, so within about 5 s it reaches 150 °C and shuts itself down. It cools, restarts at 130 °C and trips again, so the output flickers on and off. Switch the LDO cooling to the big copper pour (46 °C/W) and it settles at about 116 °C. The buck, at the same current, would lose about 0.2 W.',
      patches: [{ op: 'set', elementId: 'R_L1', key: 'value', value: 15 }],
    },
    {
      id: 'low-input',
      label: 'Feed it only 4 V (dropout)',
      explain:
        'The AMS1117 needs about 1.1 V of headroom, so 4 V in gives 4 − 1.1 = 2.9 V out: out of regulation, and enough to brown out a 3.3 V microcontroller. The buck raises its duty cycle toward 0.85 and still makes 3.3 V. Neither can make more than it is fed: a buck only steps down.',
      patches: [{ op: 'set', elementId: 'V_IN', key: 'value', value: 4 }],
    },
    {
      id: 'adapter-24v',
      label: 'Plug in a 24 V adapter',
      explain:
        'The AMS1117’s absolute maximum input is 15 V. At 24 V the datasheet promises nothing, and here it fails. Even if it survived, it would have to burn (24 − 3.3) × 0.1 A ≈ 2.1 W. The buck shrugs: the controller cuts the duty cycle to about 3.3/24 ≈ 0.14, and its input current falls, because input power stays roughly constant.',
      patches: [{ op: 'set', elementId: 'V_IN', key: 'value', value: 24 }],
    },
  ],

  instruments: {
    scope: {
      channels: [
        // the inductor's ripple, as the capacitor current (it carries the AC part, centred on zero)
        { label: 'I CAP (RIPPLE)', source: { kind: 'current', elementId: 'C_BK' }, perDiv: 0.005, offset: 0 },
        { label: 'I INDUCTOR', source: { kind: 'current', elementId: 'L_BK' }, perDiv: 0.05, offset: -3 },
      ],
      timePerDiv: 100e-6,
      trigger: { channel: 0, level: 0, slope: 'rising', mode: 'auto' },
    },
    chart: { signals: [4, 3], span: 20 },
  },

  guide: [
    {
      id: 'meet-the-ldo',
      title: 'Meet the linear regulator',
      body: 'Click **U1** to open its inspector. It is an **AMS1117-3.3** in a SOT-223 package: it turns 12 V into 3.3 V by burning the difference as heat.',
      check: { kind: 'inspect', part: 'u1' },
      focus: { part: 'u1' },
      hint: 'It is the flat tabbed SOT-223 chip on the left-hand supply, beside the 12 V jack.',
      explain: 'A linear regulator is a variable resistor in series with the load, adjusted to hold the output steady. The current passes through it and the dropped voltage becomes heat.',
    },
    {
      id: 'plug-in',
      title: 'Plug in 12 V',
      body: 'Press **Plug in 12 V**. The linear side outputs **3.3 V** from a **100 mA** load, but **LINEAR HEAT** is about **0.93 W** and **LINEAR EFF** only about **26 %**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'power' },
          { kind: 'status', is: 'POWERED' },
          { kind: 'readout', index: 2, above: 3.2, below: 3.4, holdMs: 300 },
          { kind: 'readout', index: 3, above: 0.85, below: 1, holdMs: 300 },
          { kind: 'readout', index: 5, above: 24, below: 28, holdMs: 300 },
        ],
      },
      focus: { control: 'power' },
      explain: 'The LDO passes the 100 mA load plus its own few milliamps of quiescent current. It drops 12 − 3.3 = 8.7 V, and 8.7 V × 0.1 A = 0.9 W of heat to deliver 0.33 W: efficiency is Vout / Vin = 27 %. Watch LDO TEMP climb slowly toward 115 °C.',
    },
    {
      id: 'upload',
      title: 'Start the buck',
      body: 'Press **Upload**. The sketch ramps the buck up over 50 ms. **BUCK OUT** settles at **3.3 V** with **BUCK EFF** above **80 %**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'action', action: 'upload' },
          { kind: 'status', is: 'RUNNING' },
          { kind: 'readout', index: 7, above: 3.2, below: 3.4, holdMs: 500 },
          { kind: 'readout', index: 10, above: 80, holdMs: 500 },
        ],
      },
      focus: { control: 'upload' },
      explain: 'The P-channel MOSFET switches 12 V on and off at 10 kHz and the inductor and capacitor average it. The duty cycle D = Vout / Vin = 3.3 / 12 = 0.28 (BUCK DUTY reads 0.29, the sketch trims for losses). The buck takes 32 mA from the supply for the same 100 mA output, since P in ≈ P out.',
    },
    {
      id: 'open-scope',
      title: 'Look at the ripple',
      body: 'Open **Instruments**. **I CAP (RIPPLE)** is the inductor’s triangle of current at 10 kHz, one 100 µs period for every division.',
      check: { kind: 'instruments' },
      focus: { control: 'instruments' },
      explain: 'During each ON interval the supply pushes the inductor current up, during each OFF interval the Schottky diode lets it fall. The capacitor soaks up the triangle’s AC part and leaves a steady DC output.',
    },
    {
      id: 'low-input',
      title: 'Drop the input to 6 V',
      body: 'Slide **Input voltage** down to about **6 V**. **LINEAR EFF** doubles to about **52 %**, and **BUCK EFF** rises to about **92 %**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'Input voltage', max: 6.5 },
          { kind: 'readout', index: 5, above: 48, below: 56, holdMs: 300 },
          { kind: 'readout', index: 10, above: 90, holdMs: 300 },
        ],
      },
      focus: { control: 'tweak:Input voltage' },
      hint: 'The slider goes in 0.5 V steps. Anything from 5.5 to 6.5 V works.',
      explain: 'A linear regulator’s efficiency is simply Vout / Vin, so a smaller step means less waste: 3.3 / 6 = 55 %. The buck’s losses barely depend on the step, so it stays near 90 %. Never use an LDO for a big drop at real current.',
    },
    {
      id: 'hot-ldo',
      title: 'Break it: ask the LDO for 220 mA',
      body: 'Slide **Input voltage** back up to **12 V**, then open **Break something** and choose **Ask the LDO for 220 mA**. **LDO TEMP** climbs past **135 °C**.',
      check: {
        kind: 'all',
        of: [{ kind: 'tweak', target: 'Input voltage', min: 11.5 }, { kind: 'break', failure: 'hot-ldo' }, { kind: 'readout', index: 4, above: 135 }],
      },
      focus: { control: 'break' },
      hint: 'On the minimal pad the junction heads for 200 °C, so it takes a few seconds to cross 135 °C.',
      explain: 'At 220 mA the LDO drops (12 − 3.3) × 0.22 A ≈ 1.9 W. On a minimal pad that is 90 °C of rise per watt. At 150 °C it shuts itself down and the output goes away. It cools, restarts at about 130 °C, and trips again, so the output flickers.',
    },
    {
      id: 'cool-it',
      title: 'Give it more copper',
      body: 'Set **LDO cooling** to **Big copper pour, 46 °C/W**. The junction settles at about **116 °C** and **LINEAR OUT** holds steady at **3.3 V**.',
      check: {
        kind: 'all',
        of: [
          { kind: 'tweak', target: 'LDO cooling', max: 46 },
          { kind: 'readout', index: 4, below: 125, holdMs: 500 },
          { kind: 'readout', index: 2, above: 3.2, holdMs: 500 },
        ],
      },
      focus: { control: 'tweak:LDO cooling' },
      hint: 'The temperature has a 4 s time constant, so give it several seconds to cool down below 125 °C.',
      explain: 'Junction temperature is ambient plus power times thermal resistance: 25 + 1.97 W × 46 °C/W = 116 °C, which is under the 150 °C shutdown. Better copper helps, but the real fix at this current is a buck: it would lose about 0.2 W.',
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
      body: 'Answer the questions in **Check yourself** below: they use dropout, efficiency and the buck duty cycle.',
      check: { kind: 'quiz' },
      focus: { control: 'quiz' },
    },
  ],

  meet: `**Linear regulator (LDO).** Inside the AMS1117 a reference, an error amplifier and a pass transistor form a feedback loop, like the op-amp lesson. The pass transistor drops whatever voltage is left over. Every amp of output is an amp of input (plus about 5 mA for the chip itself), so:

P_loss = (V_in − V_out)·I = (12 − 3.3) × 0.1 = **0.87 W**, plus 12 V × 5 mA = **0.93 W**; efficiency ≈ 3.3/12 = **27 %**.

The heat has to leave through the package. The datasheet gives θJA = 90 °C/W for a SOT-223 on a minimal pad: 0.93 W lifts the junction by 84 °C, to about 109 °C. Ask for 220 mA and it would rise 177 °C, so it shuts down. To dissipate P at a junction limit T_J and ambient T_A, you need θ ≤ (T_J − T_A)/P.

It can't regulate below its **dropout**: V_out ≈ V_in − 1.1 V at most.

**Buck converter.** A switch connects the inductor to V_in for a fraction D of each period (here 10 kHz; real buck chips run at 150 kHz to 2 MHz). The inductor and capacitor average the pulses to V_out ≈ D·V_in, so **D ≈ 3.3/12 = 0.275**. The controller sketch computes exactly that, plus a small trim for losses. Inductors and capacitors store energy without dissipating it, so the efficiency is typically **75–95 %**. Power in ≈ power out / η:

I_in = (3.3 × 0.1)/(0.85 × 12) ≈ **32 mA**, under a third of what the LDO draws for the same output.

Open the **Instruments** panel. The scope shows the inductor current ramping up while the switch is on and down while the diode carries it: a triangle around the 100 mA load. The capacitor takes the ripple part, ΔI = (V_in − V_out)·D/(L·f) = 8.7 × 0.29/(22 mH × 10 kHz) ≈ 12 mA peak to peak, and passes a steady current to the load.

**Trade-offs.**

- The linear is quiet, simple and cheap, and best for small drops and low currents.
- The buck is efficient but makes ripple and switching noise, so it needs careful layout.`,

  mechanicalAnalogy: `A linear regulator is a pressure-reducing valve. It throttles flow from high to low pressure and turns the difference, Δp·Q, into heat. A buck converter is closer to a gearbox. It trades voltage for current with little loss, so I_in < I_out, just as input torque is less than output torque in a reduction gear. **Where it breaks:** the buck works by chopping. It stores energy in a magnetic field and releases it in pulses, so it always leaves some ripple and radiates switching noise. A gearbox transmits smoothly.`,

  proTips: [
    'For a linear regulator, calculate dissipation at the highest input voltage and the highest load, then check the thermal budget: θ_total ≤ (T_J,max − T_A,max)/P. With an SOT-223 the "heatsink" is copper on the board: the AMS1117 datasheet quotes 46 to over 90 °C/W depending on copper area.',
    'Buck layout makes or breaks it. Keep the loop through the input capacitor, the switch and the diode as small as possible. When in doubt, use a proven module.',
    'Many "LDOs", like the AMS1117, still need over 1 V of headroom at full current (1.3 V max at 1 A). For small drops, pick a part with a low dropout spec, such as the MCP1700 (a few hundred mV at up to 250 mA).',
  ],

  quiz: [
    {
      q: 'An AMS1117-3.3 runs from 5 V at 0.5 A. What does its pass transistor dissipate?',
      options: ['0.5 W', '0.85 W', '1.65 W', '2.5 W'],
      answer: 1,
      why: '(5 − 3.3) × 0.5 = 0.85 W (plus 5 V × 5 mA of quiescent loss).',
    },
    {
      q: 'A buck converts 24 V to 5 V at 2 A with 88 % efficiency. What is its input current?',
      options: ['0.42 A', '2.0 A', '0.47 A', '2.27 A'],
      answer: 2,
      why: 'P_in = 10/0.88 = 11.4 W, so I_in = 11.4/24 = 0.47 A.',
    },
    {
      q: 'A linear regulator dissipates 2 W, with T_J,max = 125 °C and ambient 25 °C. What is the maximum total θ_JA?',
      options: ['25 °C/W', '62.5 °C/W', '100 °C/W', '50 °C/W'],
      answer: 3,
      why: 'θ ≤ (125 − 25)/2 = 50 °C/W.',
    },
    {
      q: 'Why can a buck’s input current be lower than its output current?',
      options: [
        'Power is conserved (minus losses), so stepping voltage down steps current up',
        'It stores charge in the input capacitor',
        'It draws from the ground pin',
        'It doesn’t; the meter is wrong',
      ],
      answer: 0,
      why: 'V_in·I_in ≈ V_out·I_out/η, and V_in > V_out, so I_in < I_out.',
    },
    {
      q: 'A buck makes 3.3 V from 12 V. Roughly what duty cycle does the switch run at?',
      options: ['0.09', '0.28', '0.5', '0.73'],
      answer: 1,
      why: 'D ≈ V_out/V_in = 3.3/12 = 0.275, a little more in practice to cover the losses.',
    },
  ],
}
