# Writing a lesson

1. Create `src/lessons/<TRACK>/<id>.ts` exporting `lesson: LessonDef`. The glob in `index.ts` registers it. Sidebar order comes from `TRACK_ORDER` (spec §6), so you don't edit any shared file.
2. If the lesson needs custom dynamics, add `src/engine/behaviors/<id>.ts` (see that folder's README).
3. Run `npm test`. `registry.test.ts` validates every lesson (`validateLesson`) and runs it headless to RUNNING (with a sketch) or POWERED.

```ts
import type { LessonDef } from '../../engine/types'
import { BENCH_Y, UNO, bbHole, between, jumper } from '../layout'

const BB: [number, number] = [-3.4, 0.2] // breadboard centre on the mat

export const lesson: LessonDef = {
  id: 'my-lesson', track: 'T1', title: '…', subtitle: '…', tagline: '…',
  // fig: 4, // only for lessons with a video figure; others are numbered in sidebar order
  board: {
    name: 'XYZ-01', size: [16, 8.5], // size frames the camera
    base: 'breadboard-only', // no PCB / SMD / solder step; use 'mat' for a soldered PCB
    // frame: { size: [16.6, 7.4], center: [4.3, 0.5] }, // a PCB with a breadboard beside it: what the camera and mat cover
    // a 'breadboard-only' board with no `frame` is framed automatically: the bounding box of every part except the breadboard (hidden failure parts included) plus a margin, never smaller than 7 × 5.5; set `frame` only to override it (src/three/autoFrame.ts)
    parts: [
      { id: 'r1', kind: 'resistor', pos: between(bbHole(BB, 3, 'c'), bbHole(BB, 7, 'c')), mount: 'tht',
        label: 'R1', role: 'One line, toasted when placed.', params: { ohms: 220, callout: [0.3, 2, -0.3] },
        circuitIds: ['R1'] },
      // a part only a failure brings in: hidden: true, then failures[].parts.show
    ],
  },
  circuit: { elements: [ /* { id, type, nodes, …, rating, partId } — ground is '0' */ ] },
  powerElementId: 'V1', // a V or SW; also powers the MCU
  powerLabel: 'Plug USB', // extraPower: [{ elementId: 'VM', label: 'Connect battery' }]
  readouts: [{ label: 'I', source: { kind: 'current', elementId: 'R1' }, unit: 'A' }],
  sketch: { title: 'Blink', code: `…`, pins: { 13: 'PIN13' }, vcc: 5, board: 'uno' }, // optional
  tweaks: [{ label: 'R1', elementId: 'R1', key: 'value', min: 47, max: 2200, log: true, unit: 'Ω' }],
  statusLines: [
    // the last match wins; `{n}` inserts readout n; `pin` lines need the pin in sketch.pins
    { when: { kind: 'pin', pin: 13, level: 1 }, text: 'RUNNING: pin 13 HIGH, {0} through the LED' },
  ],
  failures: [{
    id: 'no-r', label: 'Leave the resistor out', explain: 'What happens and why.',
    patches: [{ op: 'short', a: 'p13', b: 'a' }], parts: { hide: ['r1'], show: ['jumper'] },
  }],
  meet: `markdown`, mechanicalAnalogy: `markdown`, proTips: ['…'],
  quiz: [{ q: '…', options: ['…', '…'], answer: 0, why: '…' }],
  behaviors: [{ id: 'some-behavior', instance: 'b1', params: {} }], // optional
}
```

The template above is a skeleton. `T2/led-resistor.ts` is the complete reference lesson.

## Part inspector and `facts`
Clicking a part (or its callout pill) opens the part inspector: label, kind, `role`, a turning close-up, the band decode for resistors, live I / V / P / Tj of its `circuitIds` elements and their use of each `rating`. Give a part a `circuitIds` link and a real `rating` and the card fills itself. Optionally add `facts: string[]`, short datasheet lines shown under "Datasheet", e.g. `facts: ['Vf 2.0 V typ. at 20 mA', 'IF 30 mA abs. max']`. Use real datasheet values and name the condition; leave `facts` out rather than guess.

## PCB manufacturing layers (`board.layers`)
A `mat` board can carry its real layer data: `board.layers` (`PcbLayersSpec` in `engine/types.ts`) lists the top and bottom copper traces (polylines in board units, widths in mm, optionally live through `widthParam` / `ampsParam` such as `'tr.widthMm'`), pours, vias, pad nets (`'part:padIndex'`), pour pads with or without thermal relief, decoupling pairs, fiducials, silk text and the fab's rules. The board is then drawn layer by layer (`src/three/PcbLayers.tsx`): **Exploded view** peels it into bottom copper, FR-4 core, top copper, solder mask and silkscreen, with the drill hits through them. Add the `pcb-tour` behavior to get a layer-isolation enum tweak (`behavior:<instance>.view`) and a DRC overlay toggle (`.drc`); the DRC is `src/engine/pcb/drc.ts`. `T7/pcb-design-workflow.ts` is the reference.

## Moving boards (`board.dynamic`)
A board can be one rigid body that a behavior moves, like a balancing robot's chassis. `board.dynamic` (`BoardDynamic` in `engine/types.ts`) lifts the PCB and every part by `lift` (board units), pitches them about `pivot` (an [x, y, z] board point, the axle) by the published `pitchKey` (degrees; + tips +y toward +x), and moves them along x by the published `travelKey` (metres × `unitsPerM`, default 100, clamped to ±`maxTravel`). Parts listed in `fixed` stay on the mat. The pose eases between snapshots (`src/three/dynamicPose.ts`), so 15 Hz values still read smoothly. With a lift, place parts in board coordinates where y = 0 is the deck: parts below it (motors, wheels) get a negative y in a 3-component `pos`. `T7/capstone-balancing-robot.ts` (with the `balance-bot` behavior) is the reference.

## Layout helpers (`layout.ts`)
- `bbHole(bb, col, row)` gives a breadboard hole: columns 1–30, rows a–j, rails '+t' '-t' '-b' '+b'.
- `between(a, b)` places a 2-lead part. A resistor at rot 0 spans 4 holes; an LED spans 1, with the cathode at −x.
- `UNO.digital(at, pin | 'GND')` gives a header socket on an Uno module placed at `at` (rot 0, USB toward the viewer).
- `jumper(a, b, color, lift?)` gives a wire's `pos` and `params`. Its callout sits at the top of the arch.

## Fast switching transients (`sim.edgeSubsteps`)
The bench steps at `sim.dt` (default 1 ms) and checks ratings once per frame, so an event lasting microseconds, such as an inductor's kick into a transistor's `vBreak` avalanche clamp when a flyback diode is missing, is neither resolved nor seen. Set `sim: { edgeSubsteps: 10 }` to split the first step after each external switching event (pin change, tweak, failure, power) into 10 backward-Euler substeps growing ×2 (the first is dt/1023 ≈ 1 µs), with the instant ratings (`maxV`) checked on every substep.

- **Use it** only when a failure depends on a sub-millisecond spike: a coil or motor `l` switched by a part with `vBreak` and `maxV` (see `T2/transistor-switch.ts`, failure `no-flyback`). The spike energy is ½·L·I².
- **Cost:** n solves instead of one on each switching step, typically a handful per second, so it's cheap for sketches that toggle pins every few hundred ms. It costs more for sketches that change pins every few ms (bit-banging), because every change splits a step. `analogWrite` PWM is a duty level, not an edge per period, so it doesn't trigger this. Square-wave source edges and internal device mode flips are not split.
- It is opt-in per lesson and never enabled automatically. Lessons without it behave exactly as before.
- The scope and peak-hold readouts sample every substep, so the spike is visible on screen (see below).

## Authoring pitfalls (learned in M3 batch 1)
- The power element (`powerElementId` and every `extraPower` element) must start `closed: true`. The bench disables it while unpowered, and a `closed: false` switch leaves the circuit dead after power-on.
- Breadboard lessons are auto-framed on their non-base parts. Set `board.frame` only when the auto frame is wrong. The circuit must read clearly at default zoom: drop generic labels like "BREADBOARD" and keep callouts off the star parts.
- A `below` status-line condition also matches the all-zero readouts while unpowered. Prefer `above`, or put the state condition first.
- In headless tests, sim time doesn't advance while nothing is powered, so a `runFor(t)` loop before power-on never ends. Use frame counts until powered.
- Validate through `getLesson(id)`, not the raw export: `fig` is assigned at registration.
- Check every curriculum figure against the datasheet. One curriculum file listed a datasheet minimum as "typical". Fix the curriculum file when it's wrong.

## Tweak kinds
`kind` picks the control. Every kind keeps `min`, `max` and `unit`.

```ts
tweaks: [
  // slider (default): linear or `log`, snapped to `step`
  { label: 'Timing resistor', elementId: 'R1', key: 'value', min: 1e3, max: 1e5, log: true, unit: 'Ω' },
  // toggle: an on/off switch, off = min, on = max (a SW `closed` key takes 0/1)
  { label: 'Leads on midpoint', elementId: 'SW_VM', key: 'closed', kind: 'toggle', min: 0, max: 1, unit: '' },
  // momentary: press and hold (pointer, or Space / Enter). Held, the value goes to the end of
  // min..max away from the circuit's own value: normally open 0 → 1, normally closed 1 → 0
  { label: 'CLOCK button', elementId: 'SW_CLK', key: 'closed', kind: 'momentary', min: 0, max: 1, unit: '' },
  // enum: a segmented choice; option values must lie within min..max
  { label: 'Range', elementId: 'R_SH', key: 'value', kind: 'enum', min: 0.1, max: 100, unit: 'Ω',
    options: [{ label: '2 A', value: 0.1 }, { label: '200 mA', value: 1 }, { label: '2 mA', value: 100 }] },
  // link: ganged. Every target gets the value × scale (default 1): a matched pair, a dual pot
  { label: 'Divider resistors', elementId: 'R1', key: 'value', min: 1e3, max: 1e6, log: true, unit: 'Ω',
    link: [{ elementId: 'R2', key: 'value' }] },
]
```

A tweak or `set` patch key may be dotted to reach a source's waveform (`wave.freq`, `wave.amp`, `wave.offset`, `wave.phase`, `wave.duty`; see `T1/ac-oscilloscope.ts`).

Link targets follow the tweak from the start, so they take the tweak's value, not their own netlist value. A target may be `behavior:<instance>`.

## Readouts: units, derived values, peak-hold
- Units: `A V W Ω mΩ rpm ° °C Hz g cm % s µs counts dBm C` or `''`. The SI prefix is automatic (`0.0025 s` shows as "2.50 ms"), except for `rpm ° °C cm % µs mΩ dBm counts`, which are shown as given.
- `source: { kind: 'derived', op: 'sum' | 'diff' | 'ratio' | 'product', of: [i, j, …] }` computes from other readouts (by index): `diff` = of[0] − of[1], `ratio` = of[0] / of[1] (a zero denominator shows "—"), `sum` and `product` take 2 or more. A derived readout may use later or other derived readouts, but not form a cycle.
- `peak: true` shows the value of largest magnitude since power-on, sampled on every sim step and edge substep (so a µs spike counts). Repair, strip and the panel's "reset peak" button clear it.

## Instruments (`lesson.instruments`)
The bench has a toggleable instrument panel (the **Instruments** switch in the controls strip): a 2-channel oscilloscope and a strip chart. Both read sample rings that the bench fills inside its step loop, at every transient step and every edge substep, keyed by sim time, so they show what the simulator computed rather than what the frame rate caught. A lesson sets the starting probes; the learner can re-probe any node (against ground or another node) or any element current.

```ts
instruments: {
  open: false, // the panel starts closed (default)
  scope: {
    channels: [ // 1 or 2
      { label: 'V CE', source: { kind: 'voltage', node: 'c' /*, ref: 'e' */ }, perDiv: 10, offset: -3,
        marks: [{ value: 40, label: 'V_CEO 40 V' }] }, // dashed rating line
      { label: 'I MOTOR', source: { kind: 'current', elementId: 'M1' }, perDiv: 0.1, offset: -3.5 },
    ],
    timePerDiv: 0.5e-3, // 10 divisions wide; the trigger point sits 2 divisions in
    // auto: free-runs without a trigger; normal: holds the last triggered sweep (catches one-off events)
    trigger: { channel: 0, level: 3, slope: 'rising', mode: 'normal' },
  },
  chart: { signals: [0, 2, 3], span: 10 }, // readout indices, or inline readouts (any source)
},
```

- `perDiv` is in V (or A) per division, 8 divisions tall. `offset` moves the trace's zero, in divisions above the centre line (−4..4).
- Without a `scope`, opening the panel probes the lesson's first voltage readout; without a `chart`, it charts readout 0.
- Capacity: 32 768 scope rows (≈ 33 s at the default 1 ms step), 2 048 chart rows. A sweep is 10 × timePerDiv wide, so keep `sim.dt` well under timePerDiv / 10 to have points to draw. Fast edges between steps need `sim.edgeSubsteps`.
- `T2/transistor-switch.ts` is the reference: with D1 removed, the normal-mode scope holds the ≈ 60 V spike across the 40 V line.

**Logic analyzer.** Add the `logic-analyzer` behavior and `instruments.logic` to get a third tab: digital lanes (I²C lines drawn with their RC rise), a decode row (bytes in hex and ASCII, S / Sr / P, A / N) and the decoded text, with zoom (− / +, Ctrl + wheel) and drag-to-pan. Live, the window follows the newest burst on the decoded bus. `T7/serial-protocols.ts` is the reference.

```ts
behaviors: [{ id: 'logic-analyzer', params: { laBaud: 115200, uartRx: 'ad_rx' } }],
instruments: {
  view: 'logic', // open on this tab
  logic: {
    channels: [{ pin: 1, label: 'TX' }, { node: 'sda', label: 'SDA' }, { pin: 10, label: 'LATCH' }], // 1–8, pin or node
    decode: 'i2c', // 'uart' | 'i2c' | 'spi': the starting decoder
    span: 0.001, // seconds across the screen
  },
},
```

A `pin` channel on a bus pin (Uno: 1 TX, 18/19 SDA/SCL, 11/12/13 MOSI/MISO/SCK) shows that bus; another pin shows what the sketch drives on it. A `node` wired to a PIN element (through R ≤ 1 Ω or a closed switch) follows that pin, so a failure that rewires it shows up; other nodes are thresholded at `vth` once per frame.

## Sim speed (`sim.speed`)
The controls strip offers ×0.01, ×0.1, ×1, ×10 and ×100. `sim: { speed: 0.1 }` sets the lesson's starting speed. Slow motion still steps at `sim.dt`; it takes one step whenever a whole dt of sim time has built up. Time-lapse is capped at `sim.stepsPerFrame` steps per frame (default 30 × speed). When the cap holds the sim back, the strip shows "running slower than real time" (or "capped at ×N" above real time). With a fine `dt` (µs), even ×1 may be capped: set `speed` below 1 for those lessons.

## Guided steps (`lesson.guide`)
A lesson can carry a short guided walk-through. The **Guide** card above the bench shows one step at a time: what to do, what to notice, a progress rule, a hint, and Back / Skip / Restart. It advances by itself when the bench detects that the step is done, and then offers the step's `explain`. The learner can switch to **Free explore** at any time. Progress is saved per lesson. A lesson with a guide starts in Guided mode. The two models are `T2/led-resistor.ts` (sketch, pin and readout steps) and `T0/ohms-law.ts` (tweak and readout steps).

```ts
guide: [
  {
    id: 'plug-usb',                          // kebab-case, unique; progress is saved by it
    title: 'Plug in USB',
    body: 'Press **Plug USB**. Notice that **LED CURRENT** stays at 0.', // short markdown
    check: { kind: 'all', of: [{ kind: 'action', action: 'power' }, { kind: 'status', is: 'POWERED' }] },
    focus: { control: 'power' },             // pulses that button; { part: 'r1' } brackets a part in 3D
    hint: 'The blue button at the top left of the bench.', // offered after about 20 s
    explain: 'An input pin sources no current: the sketch has to make pin 13 an OUTPUT.', // shown once done
  },
  {
    id: 'dim-it',
    title: 'Fit 1 kΩ instead',
    body: 'Slide **Series resistor** to about **1 kΩ**. The LED gets (5 − 1.8) / 1025 ≈ **3 mA**.',
    check: { kind: 'all', of: [
      { kind: 'tweak', target: 'Series resistor', min: 900 },                 // a tweak by label (or 'R1.value')
      { kind: 'readout', index: 0, above: 0.002, below: 0.0045, holdMs: 250 }, // SI units: amps
    ] },
    focus: { control: 'tweak:Series resistor' },
  },
  { id: 'quiz', title: 'Check yourself', body: 'Answer the questions below.', check: { kind: 'quiz' }, focus: { control: 'quiz' } },
],
```

**Checks.** A check is plain data, never code. "Event" checks count only what happened after the step became active. "State" checks look at the bench as it is now.

| check | passes when |
|---|---|
| `{ kind: 'action', action }` | that bench button was used after the step began: `strip`, `pick-place`, `place` (any one part), `place-all` (also the last part placed by hand), `solder`, `power` (either way: pair it with a `status` check), `upload`, `explode`, `repair` |
| `{ kind: 'status', is }` | the bench status is `BARE PCB`, `ASSEMBLING`, `READY`, `POWERED`, `RUNNING` or `FAULT` |
| `{ kind: 'break', failure }` | that failure was triggered, or is active now |
| `{ kind: 'tweak', target, min?, max? }` | the tweak (its `label`, or `elementId.key`) is inside min..max, inclusive |
| `{ kind: 'readout', index, above?, below?, holdMs? }` | readout `index` (SI base units) is strictly above / below, continuously for `holdMs` (default 0) |
| `{ kind: 'pin', pin, level }` | the sketch drives that pin as an OUTPUT at 0 or 1 |
| `{ kind: 'inspect', part }` | the part inspector was opened on that part, or is open on it |
| `{ kind: 'instruments' }` | the instrument panel was opened, or is open |
| `{ kind: 'quiz' }` | the quiz was finished after the step began |
| `{ kind: 'all' \| 'any', of: [...] }` | all / any of the nested checks pass |
| `{ kind: 'manual' }` | the learner pressed "I've done this" |

`validateLesson` checks every reference: failure ids, part ids, tweak labels, readout indices (and that a readout check has a bound), sketch pins, and that a `focus` names a control the bench has (`pick-place` and `solder` don't exist on a breadboard bench, and `upload` and `code` need a sketch).

**Focus targets.** `focus.part` puts the inspector's corner brackets on a board part, and the step's "Show me" button frames it. `focus.control` pulses one of these controls: `strip`, `pick-place`, `place`, `solder`, `power`, `upload`, `explode`, `break` (the Break menu, which also holds Repair all), `instruments`, `quiz`, `code` (the sketch editor), or `tweak:<label>`.

**Writing good steps.**
- Use about **5–9 steps**. A guide is a path through the bench, not a second copy of "Meet the board".
- Each step either **does one thing** (press, slide, break) or **notices one concrete number** ("LED CURRENT reads about 13 mA"). Put the number and its one-line derivation in `body`, and put the why in `explain`.
- Build up to a **"break it" step**, then a **repair** step, and end on a **quiz** step.
- **Never ask for something the bench can't detect.** If you can't write a check for it, rephrase the step until you can, such as a readout window instead of "watch the LED dim". Use `manual` sparingly, only for something you truly can only look at.
- Readout windows should be generous (±10–20 %), with a `holdMs` of 250–300 ms, so a passing flicker doesn't count and a slider overshoot isn't punished. A blinking sketch spends half its time LOW, so keep `holdMs` well under the half-period.
- Steps advance one at a time, but a state check that is already true when its step begins passes at once. Order the steps so each one waits for something new (for example, power before upload). Pairing an `action` with a `status` makes a step wait for the press.
- The headless test `src/lessons/guidePilots.test.ts` drives both pilot guides through a real bench. Add a case like it for a new guide.
