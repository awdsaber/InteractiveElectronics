// T1 · The Transformer. Source: docs/curriculum/T1/transformer.md
//
// Everything is low voltage and AC. A 12 V rms / 50 Hz sine source feeds a small 4:1 step-down
// transformer (12 V : 3 V, 5 VA) through a slow-blow fuse; a 6 Ω power resistor is the load. The XFMR element
// is the ideal transformer (Vs = n·Vp, Ip = n·Is) with a 2 H magnetizing inductance across the primary,
// so the magnetizing current shows up beside the load current; the winding resistances (RP, RS) and the
// source's own resistance are real resistors. The secondary floats on its own return (R_REF, 1 MΩ to
// ground), so the two windings share no wire. Five `ac-meter` instances turn the 50 Hz waveforms into RMS
// readouts; the scope shows both windings on one scale.
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, jumper } from '../layout'

const XF_AT: [number, number] = [0.4, 0.3]
const SRC_AT: [number, number] = [-6.8, 0.5]
const LOAD_AT: [number, number] = [6.8, 0.5]
const FUSE_AT: [number, number] = [-3.3, -1.0]
const DMM_P: [number, number] = [-3.8, -5.8]
const DMM_S: [number, number] = [4.4, -5.8]
const DMM_SCALE = 0.34

const PIN_Y = BENCH_Y + 0.3
// the transformer's four legs: primary on the left (−x), secondary on the right (+x)
const pA: [number, number, number] = [XF_AT[0] - 1.0, PIN_Y, XF_AT[1] - 0.9]
const pB: [number, number, number] = [XF_AT[0] - 1.0, PIN_Y, XF_AT[1] + 0.9]
const sA: [number, number, number] = [XF_AT[0] + 1.0, PIN_Y, XF_AT[1] - 0.9]
const sB: [number, number, number] = [XF_AT[0] + 1.0, PIN_Y, XF_AT[1] + 0.9]

const srcA: [number, number, number] = [SRC_AT[0] + 1.35, BENCH_Y + 0.45, SRC_AT[1] - 0.5]
const srcB: [number, number, number] = [SRC_AT[0] + 1.35, BENCH_Y + 0.45, SRC_AT[1] + 0.5]
const fuseL: [number, number, number] = [FUSE_AT[0] - 0.75, BENCH_Y + 0.25, FUSE_AT[1]]
const fuseR: [number, number, number] = [FUSE_AT[0] + 0.75, BENCH_Y + 0.25, FUSE_AT[1]]
const loadA: [number, number, number] = [LOAD_AT[0] - 1.7, BENCH_Y + 0.45, LOAD_AT[1] - 0.4]
const loadB: [number, number, number] = [LOAD_AT[0] - 1.7, BENCH_Y + 0.45, LOAD_AT[1] + 0.4]

const jackY = BENCH_Y + (1.5 + 0.19) * DMM_SCALE
const jackOf = (at: [number, number], dx: number): [number, number, number] => [at[0] + dx * DMM_SCALE, jackY, at[1] + 5.5 * DMM_SCALE]

const withCallout = (w: ReturnType<typeof jumper>, callout: [number, number, number]) => ({ ...w, params: { ...w.params, callout } })

// transformer ratings: a 5 VA, 12 V : 3 V part is good for 3 V × 1.67 A on the secondary and 0.42 A on the primary
// thermal, not instantaneous: the winding heats over seconds (rated: 1.67 A × 0.1 Ω = 0.28 W lifts it to 150 °C), so the fuse, not the winding, answers a fault that lasts milliseconds
const RS_RATING = { rth: 446, tauTh: 10, tMax: 150 }
const RP_RATING = { rth: 480, tauTh: 10, tMax: 150 } // 0.42 A × 1.2 Ω = 0.21 W sits at 126 °C, 0.51 A would reach 150 °C

const sine = { kind: 'sine', amp: 16.97, freq: 50 } as const // 12 V rms

export const lesson: LessonDef = {
  id: 'transformer',
  track: 'T1',
  title: 'The Transformer',
  subtitle: 'Trading volts for amps',
  tagline: 'A 4:1 step-down turns 12 V into 3 V and 0.12 A into 0.48 A: voltage down, current up, power the same.',

  board: {
    name: 'XFMR-14',
    size: [18, 11],
    base: 'breadboard-only',
    frame: { size: [17, 9.6], center: [0, -1.9] },
    parts: [
      {
        id: 'src',
        kind: 'module',
        pos: [SRC_AT[0], BENCH_Y, SRC_AT[1]],
        mount: 'offboard',
        label: '12 V AC',
        role: 'A low-voltage AC bench source: a 12 V rms, 50 Hz sine (17 V peak) with about 1 Ω inside. Never a mains socket.',
        params: { title: '12V AC 50Hz', color: '#2d5f86', w: 2.7, d: 2.2, pins: 0, chip: 'none', callout: [0, 1.4, 0.2] },
        circuitIds: ['V_AC', 'SW_PWR'],
      },
      {
        id: 'fuse',
        kind: 'fuse',
        pos: [FUSE_AT[0], BENCH_Y, FUSE_AT[1]],
        mount: 'offboard',
        label: 'FUSE',
        role: 'T500 mA slow-blow in the primary: it opens if the transformer is fed wrongly or the secondary is shorted.',
        params: { callout: [0, 1.0, -0.7] },
        circuitIds: ['F1'],
      },
      {
        id: 'xf',
        kind: 'transformer',
        pos: [XF_AT[0], BENCH_Y, XF_AT[1]],
        mount: 'offboard',
        label: 'TRANSFORMER',
        role: 'Two coils on one iron core: 12 V in on the left winding, 3 V out of the right. 5 VA, about 1.2 Ω and 0.1 Ω of copper in the windings.',
        params: { marking: '12V : 3V', callout: [0, 2.2, 0] },
        circuitIds: ['T1', 'RP', 'RS'],
      },
      {
        id: 'rl',
        kind: 'module',
        pos: [LOAD_AT[0], BENCH_Y, LOAD_AT[1]],
        mount: 'offboard',
        label: 'LOAD',
        role: 'The load: a 6 Ω power resistor. Slide it to ask the secondary for more or less current.',
        params: { title: '6R 10W', color: '#d9cfae', w: 3.2, d: 1.5, pins: 0, chip: 'none', callout: [0, 1.4, -0.4] },
        circuitIds: ['R_LOAD'],
      },
      {
        id: 'dmm-p',
        kind: 'multimeter',
        pos: [DMM_P[0], BENCH_Y, DMM_P[1]],
        mount: 'offboard',
        label: 'PRIMARY',
        role: 'AC volts across the primary winding (rms).',
        params: { mode: 'VAC', readout: 0, scale: DMM_SCALE, title: 'V PRIMARY', callout: [0, 1.4, 0] },
      },
      {
        id: 'dmm-s',
        kind: 'multimeter',
        pos: [DMM_S[0], BENCH_Y, DMM_S[1]],
        mount: 'offboard',
        label: 'SECONDARY',
        role: 'AC volts across the secondary winding (rms).',
        params: { mode: 'VAC', readout: 1, scale: DMM_SCALE, title: 'V SECONDARY', callout: [0, 1.4, 0] },
      },
      { id: 'w-s1', kind: 'wire', ...jumper(srcA, fuseL, 'red', 0.4), mount: 'offboard', role: 'Source to the fuse.' },
      { id: 'w-f1', kind: 'wire', ...jumper(fuseR, pA, 'red', 0.4), mount: 'offboard', role: 'Fuse to the primary winding.' },
      { id: 'w-s2', kind: 'wire', ...jumper(srcB, pB, 'black', 0.9), mount: 'offboard', role: 'Source return to the primary winding.' },
      { id: 'w-l1', kind: 'wire', ...jumper(sA, loadA, 'orange', 0.4), mount: 'offboard', role: 'Secondary winding to the load.' },
      { id: 'w-l2', kind: 'wire', ...jumper(sB, loadB, 'blue', 0.9), mount: 'offboard', role: 'Load return to the secondary winding.' },
      { id: 'w-mp-v', kind: 'wire', ...withCallout(jumper(jackOf(DMM_P, 2.0), pA, 'yellow', 0.5), [0, 0.5, 0]), mount: 'offboard', role: 'Primary meter V jack to the primary.' },
      { id: 'w-mp-c', kind: 'wire', ...jumper(jackOf(DMM_P, 0), pB, 'blue', 0.5), mount: 'offboard', role: 'Primary meter COM to the primary return.' },
      { id: 'w-ms-v', kind: 'wire', ...jumper(jackOf(DMM_S, 2.0), sA, 'yellow', 0.5), mount: 'offboard', role: 'Secondary meter V jack to the secondary.' },
      { id: 'w-ms-c', kind: 'wire', ...jumper(jackOf(DMM_S, 0), sB, 'blue', 0.5), mount: 'offboard', role: 'Secondary meter COM to the secondary return.' },
    ],
  },

  circuit: {
    elements: [
      // the AC source: 12 V rms, 50 Hz, 0.5 Ω inside
      { id: 'V_AC', type: 'V', nodes: ['ga', '0'], value: 0, wave: sine, rInternal: 0.5, partId: 'src' },
      // `closed: true`: the bench opens the power element until "Switch on the source"
      { id: 'SW_PWR', type: 'SW', nodes: ['ga', 'g'], closed: true, partId: 'src' },
      // T500 mA slow-blow (illustrative i²t)
      { id: 'F1', type: 'FUSE', nodes: ['g', 'f'], iRated: 0.5, i2t: 0.5, r: 0.1, partId: 'fuse' },
      // primary winding copper, then the ideal transformer with its magnetizing inductance
      { id: 'RP', type: 'R', nodes: ['f', 'p'], value: 1.2, rating: RP_RATING, partId: 'xf' },
      { id: 'T1', type: 'XFMR', nodes: ['p', '0', 's', 'sr'], n: 0.25, lm: 2, partId: 'xf' },
      // secondary winding copper, then the load; the secondary floats on its own return
      { id: 'RS', type: 'R', nodes: ['s', 'sa'], value: 0.1, rating: RS_RATING, partId: 'xf' },
      { id: 'R_LOAD', type: 'R', nodes: ['sa', 'sr'], value: 6, rating: { maxP: 10, maxV: 50 }, partId: 'rl' },
      { id: 'R_REF', type: 'R', nodes: ['sr', '0'], value: 1e6 },
    ],
  },
  powerElementId: 'SW_PWR',
  powerLabel: 'Switch on the source',

  behaviors: [
    { id: 'ac-meter', instance: 'vp', params: { kind: 'v', node: 'f', source: 'V_AC' } },
    { id: 'ac-meter', instance: 'vs', params: { kind: 'v', node: 'sa', ref: 'sr', source: 'V_AC' } },
    { id: 'ac-meter', instance: 'ip', params: { kind: 'i', element: 'F1', source: 'V_AC' } },
    { id: 'ac-meter', instance: 'is', params: { kind: 'i', element: 'RS', source: 'V_AC' } },
    { id: 'ac-meter', instance: 'im', params: { kind: 'extra', key: 'T1.im', source: 'V_AC' } },
  ],

  readouts: [
    { label: 'V PRIMARY', source: { kind: 'behavior', key: 'vp.rms' }, unit: 'V' },
    { label: 'V SECONDARY', source: { kind: 'behavior', key: 'vs.rms' }, unit: 'V' },
    { label: 'I PRIMARY', source: { kind: 'behavior', key: 'ip.rms' }, unit: 'A' },
    { label: 'I SECONDARY', source: { kind: 'behavior', key: 'is.rms' }, unit: 'A' },
    { label: 'MAGNETIZING I', source: { kind: 'behavior', key: 'im.rms' }, unit: 'A' },
    { label: 'V RATIO  Vp / Vs', source: { kind: 'derived', op: 'ratio', of: [0, 1] }, unit: '', digits: 3 },
    { label: 'I RATIO  Is / Ip', source: { kind: 'derived', op: 'ratio', of: [3, 2] }, unit: '', digits: 3 },
    { label: 'LOAD SEEN BY SOURCE', source: { kind: 'derived', op: 'ratio', of: [0, 2] }, unit: 'Ω' },
    { label: 'LOAD POWER', source: { kind: 'derived', op: 'product', of: [1, 3] }, unit: 'W' },
    { label: 'INPUT V × I', source: { kind: 'derived', op: 'product', of: [0, 2] }, unit: 'W' },
  ],

  // Both windings on one 5 V/div scale: the secondary is the primary shrunk four-fold, in phase.
  instruments: {
    open: true,
    scope: {
      channels: [
        { label: 'PRIMARY', source: { kind: 'voltage', node: 'f' }, perDiv: 5, offset: 0 },
        { label: 'SECONDARY', source: { kind: 'voltage', node: 'sa', ref: 'sr' }, perDiv: 5, offset: 0 },
      ],
      timePerDiv: 5e-3,
      trigger: { channel: 0, level: 0, slope: 'rising', mode: 'auto' },
    },
    chart: { signals: [2, 3], span: 10 },
  },

  tweaks: [
    { label: 'Load resistance', elementId: 'R_LOAD', key: 'value', min: 1.5, max: 1000, log: true, unit: 'Ω' },
    {
      label: 'Turns ratio  Ns : Np (1 : 2 reflects the 6 Ω as 24 Ω, so the primary draws about 0.46 A, close to the 0.5 A fuse: raise the load before using it)',
      elementId: 'T1',
      key: 'n',
      kind: 'enum',
      min: 0.25,
      max: 0.5,
      unit: '',
      options: [
        { label: '1 : 4 (3 V out)', value: 0.25 },
        { label: '1 : 2 (6 V out)', value: 0.5 },
      ],
    },
  ],

  statusLines: [
    { when: { kind: 'state', is: 'POWERED' }, text: 'RUNNING: {0} in, {1} out; the {3} secondary current is {6} times the {2} primary current' },
    { when: { kind: 'above', readout: 3, value: 1.3 }, text: 'HEAVY LOAD: {3} of a 1.67 A winding rating; the copper loss is climbing with I²' },
    { when: { kind: 'state', is: 'READY' }, text: 'SOURCE OFF: nothing is moving, so nothing is induced' },
    { when: { kind: 'state', is: 'FAULT' }, text: 'FAULT: a fuse or winding opened and the transformer is no longer fed' },
  ],

  failures: [
    {
      id: 'dc',
      label: 'Feed the primary DC',
      explain:
        'With a steady 12 V the flux stops changing, so nothing is induced: the secondary reads 0 V after the first few milliseconds. The primary is now just 1.2 Ω of copper and the fuse, so only resistance limits the current, and the 2 H magnetizing inductance lets it climb at about 12 V / 2 H = 6 A/s (a time constant Lm / R ≈ 1.1 s toward 12 V / 1.8 Ω ≈ 6.7 A). The T500 mA slow-blow fuse opens after about 0.36 s, at roughly 0.7 A rms, in a winding rated near 0.4 A; without it the current would keep climbing and the winding would cook. A real core is far less kind than this linear model: it saturates within a cycle, the inductance collapses, and the current spikes far higher, which is why the fuse matters even more.  A transformer needs changing flux, so it passes AC and blocks DC.',
      patches: [
        { op: 'remove', elementId: 'V_AC' },
        { op: 'add', element: { id: 'V_AC', type: 'V', nodes: ['ga', '0'], value: 12, rInternal: 0.5, partId: 'src' } },
      ],
    },
    {
      id: 'short',
      label: 'Short the secondary',
      explain:
        'Only the copper limits the current. Seen from the source, the 0.1 Ω secondary winding looks like 0.1 / n² = 1.6 Ω, which adds to the 1.8 Ω already in the primary path: about 12 / 3.4 ≈ 3.5 A rms in the primary and 14 A in the shorted secondary. The slow-blow fuse still opens within a few cycles, because (3.5 A)² is far above its 0.5 A rating. Without it the windings would dissipate about 15 W (primary) and 20 W (secondary) in parts built for a watt or so. Small transformers hide a thermal fuse in the winding for exactly this reason.',
      patches: [{ op: 'short', a: 'sa', b: 'sr' }],
    },
    {
      id: 'low-freq',
      label: 'Run the source at 10 Hz',
      explain:
        'The magnetizing current is I = V / (2πf·L_m): five times lower frequency means five times the current, about 95 mA here. A real iron core does worse than this linear model, because flux = ∫v dt: at 10 Hz each half-cycle holds the voltage five times longer, the flux swings five times higher, and past saturation the inductance collapses and the current spikes. That is why a 50 Hz transformer must not be run at a lower frequency, and why a 60 Hz one tolerates 50 Hz only at reduced voltage. The saturation itself is not simulated.',
      patches: [
        { op: 'remove', elementId: 'V_AC' },
        {
          op: 'add',
          element: { id: 'V_AC', type: 'V', nodes: ['ga', '0'], value: 0, wave: { kind: 'sine', amp: 16.97, freq: 10 }, rInternal: 0.5, partId: 'src' },
        },
      ],
    },
  ],

  sim: { dt: 1e-3, method: 'trap' }, // trapezoidal: at 1 ms backward Euler reads the 50 Hz current about 7 % low

  meet: `A transformer is two coils on one iron core. A changing current in the primary makes a changing magnetic flux; the core carries that flux through the secondary, and it induces a voltage in *every turn*. Every turn sees the same flux, so the voltage per turn is the same on both windings:

**V_s / V_p = N_s / N_p = n**

This one is wound 1 : 4, so n = 0.25. Press **Switch on the source** and read the two meters and the scope: **12 V in, about 2.9 V out**, the two traces in phase on the same 5 V/div scale, the secondary a quarter the height. It sits a little under 3 V because the windings have resistance (1.2 Ω on the primary, 0.1 Ω on the secondary) and the source is not ideal.

**Current goes the other way.** The load is 6 Ω, so the secondary carries 2.9 V / 6.1 Ω ≈ **0.48 A**. Power in must equal power out plus losses, and the voltage dropped four-fold, so the current rose four-fold:

**I_s / I_p ≈ N_p / N_s = 1 / n**, and the primary draws only about **0.12 A**. Compare I RATIO with 1 / n = 4: the readout lands within a few percent. LOAD POWER is about 1.4 W and INPUT V × I about 1.5 W. The small gap is the copper loss I²R in the windings and fuse (about 0.05 W) plus the magnetizing current, which V × I counts as apparent power although it does no work.

**Reflected impedance.** Seen from the source, the 6 Ω load looks like 6 / n² = **96 Ω**: current is cut four-fold and voltage held, so the ratio V/I goes up sixteen-fold. Slide the load to 12 Ω and LOAD SEEN BY SOURCE roughly doubles to about 180 Ω (a little short of 192 Ω, because the magnetizing current shunts the primary). This is how a transformer matches a source to a load, such as an output transformer matching a loudspeaker to a tube amplifier.

**Magnetizing current.** Even with the load removed (slide it to 1 kΩ) the primary still draws about **19 mA**. That is the current needed to build the flux in the core: the primary on its own is an inductor, here L_m = 2 H, so I_m = V / (2πf L_m) = 11.7 / 628 ≈ 19 mA, a quarter-cycle behind the voltage. It does not grow when you load the secondary: the load current adds to it (at 90° to it, so as √(I_load² + I_m²)). It stays small beside the load current, which is why n·I_s ≈ I_p works.

**Regulation.** Unloaded (1 kΩ) the secondary reads the full 3.0 V; at 6 Ω it reads 2.9 V, and at 2 Ω about 2.7 V: the winding resistance takes its share as the current rises (regulation = (V_off-load − V_loaded)/V_loaded, about 3.6 % at 6 Ω). Small transformers regulate worse than large ones. Push the load down to 1.5 Ω and the secondary current passes its 1.67 A rating: the winding overheats and opens.

**Why not DC?** Faraday's law: v = N · dΦ/dt. A constant current makes a constant flux, which induces nothing. A transformer passes only *changing* flux, so it blocks DC and passes AC. Break it with failure 1 to see the secondary go dead and the fuse open.

**Mains.** A mains transformer has the same physics, at 230 V or 120 V on the primary. It must be enclosed, fused and properly insulated, and is not for bench experiments or breadboards. Every board here uses a low-voltage AC source for that reason.`,

  mechanicalAnalogy: `A transformer is a **gearbox for electrical power**. Voltage plays the part of speed and current plays torque. A 4 : 1 reduction cuts the speed to a quarter and multiplies the torque by four, with power (T·ω, or V·I) conserved apart from friction (here the copper and core losses).

Even **reflected impedance** follows the rule you know from reflected inertia: a load seen through a gear train looks n² larger or smaller, and the 6 Ω load looks like 96 Ω from the primary side, the same square law as inertia through a ratio.

**Where it breaks:** a gearbox transmits steady rotation, but a transformer transmits nothing at DC, because it needs changing flux. Its core also saturates if overdriven, and no gear does.`,

  proTips: [
    'Never breadboard mains. Mains transformers belong to products whose primary is fused, enclosed and insulated to a safety standard; for bench work use a sealed plug-in AC adapter.',
    'A transformer is rated in VA, not watts. With a bridge rectifier and a smoothing capacitor, the RMS winding current is far higher than the DC load current, commonly 1.6 to 1.8 times as much, so derate the VA accordingly.',
    'Use a slow-blow (T) fuse on the primary. A transformer draws a large inrush current at switch-on, especially a toroid, and a fast fuse nuisance-trips.',
  ],

  quiz: [
    {
      q: 'A 230 V primary has 1150 turns and the secondary has 60. What is the secondary voltage?',
      options: ['6 V', '12 V', '24 V', '4.4 kV'],
      answer: 1,
      why: 'V_s = 230 × 60 / 1150 = 12 V.',
    },
    {
      q: 'An ideal transformer delivers 24 V at 2 A from a 230 V primary. What is the primary current?',
      options: ['0.104 A', '2.0 A', '0.209 A', '19.2 A'],
      answer: 2,
      why: 'P = 24 × 2 = 48 W, so I_p = 48 / 230 = 0.209 A.',
    },
    {
      q: 'A 10 : 1 step-down transformer drives an 8 Ω load. What impedance does the primary see?',
      options: ['800 Ω', '0.08 Ω', '80 Ω', '8 kΩ'],
      answer: 0,
      why: 'Z_p = (N_p / N_s)² · Z_s = 10² × 8 = 800 Ω.',
    },
    {
      q: "Why doesn't a transformer work on DC?",
      options: [
        'DC is too high a voltage',
        'The core blocks DC current',
        'DC has no RMS value',
        'Induction needs changing flux; a steady current makes a steady flux, which induces nothing',
      ],
      answer: 3,
      why: "Faraday's law: v = N · dΦ/dt. Constant flux induces zero voltage.",
    },
  ],
}
