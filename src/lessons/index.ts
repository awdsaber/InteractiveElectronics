// The syllabus: tracks, lessons in sidebar order, and figure numbers.
// To add a lesson: write src/lessons/<TRACK>/<id>.ts exporting a LessonDef, then list it in `defs`
// in syllabus order within its track. registry.test.ts validates it and runs it headless.

import type { Lesson, LessonDef, Track } from '../engine/types'
import { ledResistor } from './T2/led-resistor'

export const tracks: Track[] = [
  { id: 'T0', name: 'Foundations', blurb: 'Charge, voltage, current, and the tools to measure them.' },
  { id: 'T1', name: 'Passives', blurb: 'Resistors, capacitors, inductors and transformers.' },
  { id: 'T2', name: 'Semiconductors', blurb: 'Diodes, LEDs, transistors, op-amps and regulators.' },
  { id: 'T3', name: 'Digital', blurb: 'Logic gates, flip-flops, timers and conversion.' },
  { id: 'T4', name: 'Microcontrollers', blurb: 'The Uno, the ESP32-S3, interrupts and timers.' },
  { id: 'T5', name: 'Motors & drivers', blurb: 'H-bridges, steppers, servos and encoders.' },
  { id: 'T6', name: 'Sensors', blurb: 'IMUs, rangefinders, load cells and thermistors.' },
  { id: 'T7', name: 'Professional', blurb: 'Buses, grounding, thermal, PCB design and the capstone.' },
]

/** lesson ids shown under "Start here" (arduino-uno once it exists) */
const PIN_ORDER = ['arduino-uno', 'led-resistor']

const defs: LessonDef[] = [ledResistor]

export const pinned: string[] = [PIN_ORDER.find((id) => defs.some((d) => d.id === id))!].filter(Boolean)

/**
 * Sidebar order: pinned first, then T0..T7 in list order. Lessons with a video figure keep it;
 * the rest take the next free number in sidebar order.
 */
function assignFigs(list: LessonDef[]): Lesson[] {
  const trackIdx = (l: LessonDef) => tracks.findIndex((t) => t.id === l.track)
  const ordered = [...list].sort((a, b) => {
    const pa = pinned.includes(a.id) ? 0 : 1
    const pb = pinned.includes(b.id) ? 0 : 1
    return pa - pb || trackIdx(a) - trackIdx(b) || list.indexOf(a) - list.indexOf(b)
  })
  const taken = new Set(list.flatMap((l) => (l.fig ? [l.fig] : [])))
  let next = 1
  const fig = new Map<string, number>()
  for (const l of ordered) {
    if (l.fig) fig.set(l.id, l.fig)
    else {
      while (taken.has(next)) next++
      taken.add(next)
      fig.set(l.id, next)
    }
  }
  return list.map((l) => ({ ...l, fig: fig.get(l.id)! }))
}

export const lessons: Lesson[] = assignFigs(defs)

export function getLesson(id: string): Lesson | undefined {
  return lessons.find((l) => l.id === id)
}

export const defaultLessonId = pinned[0] ?? lessons[0].id
