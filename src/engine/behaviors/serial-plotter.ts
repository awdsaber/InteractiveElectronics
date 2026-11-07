// serial-plotter (shared): reads the sketch's Serial output the way the Arduino IDE's Serial
// Plotter does, and publishes every value so readouts can show numbers the sketch computes.
//
// Format: one line per sample, `name:value` pairs separated by commas, spaces or tabs, e.g.
//   Serial.print("raw:"); Serial.print(raw); Serial.print(",volts:"); Serial.println(volts);
// Each pair is published as `<instance>.<name>` (instance 'serial' → readout key 'serial.raw').
// Bare numbers are named v1, v2… by their position among the values on the line; words without
// a value ("press") and text-only lines are skipped. A value stays until the next line that
// carries the same name; the bench clears them all on power-off and strip.
//
// Lesson use: behaviors: [{ id: 'serial-plotter', instance: 'serial' }]
//             readouts:  [{ label: 'RAW', source: { kind: 'behavior', key: 'serial.raw' }, unit: 'counts' }]

import type { Behavior } from '../types'

const SEP = /[\s,]+/
const NUM = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i

/** [name, value] pairs on one plotter line, in order */
export function parsePlotterLine(line: string): [string, number][] {
  const out: [string, number][] = []
  let bare = 0
  for (const tok of line.trim().split(SEP)) {
    if (!tok) continue
    const c = tok.indexOf(':')
    if (c < 0) {
      if (NUM.test(tok)) out.push([`v${++bare}`, Number(tok)])
      continue
    }
    const name = tok.slice(0, c).trim()
    const raw = tok.slice(c + 1).trim()
    if (!name || !NUM.test(raw)) continue
    out.push([name, Number(raw)])
  }
  return out
}

export const behavior: Behavior = {
  id: 'serial-plotter',
  onSerial(ctx, line) {
    for (const [name, value] of parsePlotterLine(line)) ctx.publish(name, value)
  },
}
