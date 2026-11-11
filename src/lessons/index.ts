// The syllabus: tracks, lessons in sidebar order, and figure numbers.
//
// Lessons register themselves: any `src/lessons/T<n>/<id>.ts` that exports `lesson: LessonDef` is
// picked up by the glob below, so parallel authors never edit this file. Sidebar order within a
// track comes from TRACK_ORDER (the syllabus in docs/spec.md §6); ids not listed there go last,
// alphabetically. See src/lessons/README.md.

import type { Lesson, LessonDef, Track, TrackId } from '../engine/types'

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

/** syllabus order per track (docs/spec.md §6) */
export const TRACK_ORDER: Record<TrackId, string[]> = {
  T0: ['charge-voltage-current', 'ohms-law', 'power-heat', 'series-parallel', 'kirchhoff', 'batteries', 'multimeter', 'breadboard'],
  T1: ['resistor-codes-divider', 'capacitor-rc', 'inductor-rl', 'rlc-resonance', 'ac-oscilloscope', 'transformer'],
  T2: ['diode-rectifier', 'led-resistor', 'zener', 'transistor-switch', 'mosfet-switch', 'opamp-basics', 'regulators-linear-buck'],
  T3: ['logic-gates', 'flipflops-counters', 'timer-555', 'adc-dac-pwm'],
  T4: ['arduino-uno', 'esp32-s3', 'interrupts-timers', 'teensy-41', 'leo-bodnar-bu0836'],
  T5: ['tb6612fng', 'l298n', 'a4988-stepper', 'pca9685-servo', 'encoders'],
  T6: ['mpu6050-imu', 'ultrasonic-hcsr04', 'loadcell-hx711', 'thermistor'],
  T7: [
    'serial-protocols',
    'power-grounding-emc',
    'thermal-design',
    'pcb-design-workflow',
    'soldering-rework',
    'debugging-instruments',
    'pid-motor-control',
    'capstone-balancing-robot',
  ],
}

/** lesson ids shown under "Start here": the first one that exists */
const PIN_ORDER = ['arduino-uno', 'led-resistor']

const modules = import.meta.glob<{ lesson?: LessonDef }>(['./T*/*.ts', '!./T*/*.test.ts'], { eager: true })

function sortDefs(defs: LessonDef[]): LessonDef[] {
  const trackIdx = (l: LessonDef) => tracks.findIndex((t) => t.id === l.track)
  const rank = (l: LessonDef) => {
    const i = TRACK_ORDER[l.track].indexOf(l.id)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  return [...defs].sort((a, b) => trackIdx(a) - trackIdx(b) || rank(a) - rank(b) || a.id.localeCompare(b.id))
}

/** every lesson file's export, in track then syllabus order */
export const lessonDefs: LessonDef[] = sortDefs(
  Object.entries(modules).map(([path, m]) => {
    if (!m.lesson) throw new Error(`${path} must export \`lesson\``)
    return m.lesson
  }),
)

export const pinned: string[] = PIN_ORDER.filter((id) => lessonDefs.some((d) => d.id === id)).slice(0, 1)

/**
 * Sidebar order: pinned first, then T0..T7. Lessons with a video figure keep it; the rest take
 * the next free number in sidebar order.
 */
export function assignFigs(list: LessonDef[], pins: string[]): Lesson[] {
  const ordered = [...list].sort((a, b) => (pins.includes(a.id) ? 0 : 1) - (pins.includes(b.id) ? 0 : 1))
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

export const lessons: Lesson[] = assignFigs(lessonDefs, pinned)

export function getLesson(id: string): Lesson | undefined {
  return lessons.find((l) => l.id === id)
}

export const defaultLessonId = pinned[0] ?? lessons[0].id
