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

## Layout helpers (`layout.ts`)
- `bbHole(bb, col, row)` gives a breadboard hole: columns 1–30, rows a–j, rails '+t' '-t' '-b' '+b'.
- `between(a, b)` places a 2-lead part. A resistor at rot 0 spans 4 holes; an LED spans 1, with the cathode at −x.
- `UNO.digital(at, pin | 'GND')` gives a header socket on an Uno module placed at `at` (rot 0, USB toward the viewer).
- `jumper(a, b, color, lift?)` gives a wire's `pos` and `params`. Its callout sits at the top of the arch.
