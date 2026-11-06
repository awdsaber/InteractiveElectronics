// Runtime validation for lesson data (src/lessons/**). Mirrors `Lesson` in types.ts.
// Elements are checked loosely (id + type + nodes); the simulator owns their detail.

import { z } from 'zod'
import { ALL_PART_KINDS } from '../three/parts/kinds'
import type { Lesson } from './types'

const num = z.number().finite()
const node = z.string().min(1)

const element = z.looseObject({
  id: z.string().min(1),
  type: z.string().min(1),
  nodes: z.array(node).min(2),
})

const patch = z.union([
  z.object({ op: z.literal('remove'), elementId: z.string() }),
  z.object({ op: z.literal('set'), elementId: z.string(), key: z.string(), value: z.union([num, z.boolean(), z.string()]) }),
  z.object({ op: z.literal('short'), a: node, b: node }),
  z.object({ op: z.literal('add'), element }),
])

const vec = z.union([z.tuple([num, num]), z.tuple([num, num, num])])

const part = z.object({
  id: z.string().min(1),
  kind: z.enum(ALL_PART_KINDS),
  pos: vec,
  rot: num.optional(),
  mount: z.enum(['smd', 'tht', 'module', 'offboard']),
  label: z.string().optional(),
  role: z.string(),
  color: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  circuitIds: z.array(z.string()).optional(),
})

const readout = z.object({
  label: z.string().min(1),
  source: z.union([
    z.object({ kind: z.literal('current'), elementId: z.string() }),
    z.object({ kind: z.literal('voltage'), node, ref: node.optional() }),
    z.object({ kind: z.literal('power'), elementId: z.string() }),
    z.object({ kind: z.literal('extra'), key: z.string() }),
    z.object({ kind: z.literal('behavior'), key: z.string() }),
  ]),
  unit: z.enum(['A', 'V', 'W', 'Ω', 'mΩ', 'rpm', '°', '°C', 'Hz', 'g', 'cm', '%', 's', 'µs', 'counts', 'dBm', 'C', '']),
  digits: z.number().int().min(1).max(6).optional(),
})

const tweak = z.object({
  label: z.string(),
  elementId: z.string(),
  key: z.string(),
  kind: z.enum(['slider', 'toggle', 'momentary']).optional(),
  min: num,
  max: num,
  step: num.positive().optional(),
  log: z.boolean().optional(),
  unit: z.string(),
})

const status = z.enum(['BARE PCB', 'ASSEMBLING', 'READY', 'POWERED', 'RUNNING', 'FAULT'])

const statusLine = z.object({
  when: z.union([
    z.object({ kind: z.literal('state'), is: status }),
    z.object({ kind: z.literal('above'), readout: z.number().int().min(0), value: num }),
    z.object({ kind: z.literal('below'), readout: z.number().int().min(0), value: num }),
    z.object({ kind: z.literal('pin'), pin: z.number().int(), level: z.union([z.literal(0), z.literal(1)]) }),
  ]),
  text: z.string().min(1),
})

const behaviorRef = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1),
    instance: z.string().min(1).optional(),
    params: z.record(z.string(), z.union([num, z.string(), z.boolean()])).optional(),
  }),
])

export const lessonSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case id'),
  fig: z.number().int().min(1),
  track: z.enum(['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']),
  title: z.string().min(1),
  subtitle: z.string(),
  tagline: z.string(),
  board: z.object({
    name: z.string(),
    size: z.tuple([num.positive(), num.positive()]),
    pcbColor: z.string().optional(),
    traces: z.array(z.array(z.tuple([num, num]))).optional(),
    base: z.enum(['mat', 'breadboard-only', 'none']).optional(),
    parts: z.array(part),
  }),
  circuit: z.object({ elements: z.array(element).min(1) }),
  powerElementId: z.string().min(1),
  powerLabel: z.string().optional(),
  extraPower: z.array(z.object({ elementId: z.string(), label: z.string().min(1) })).optional(),
  readouts: z.array(readout),
  sketch: z
    .object({
      title: z.string().min(1),
      code: z.string(),
      pins: z.record(z.string(), z.string()),
      analogPins: z.record(z.string(), node).optional(),
      vcc: num.positive(),
      board: z.enum(['uno', 'esp32s3', 'generic']),
    })
    .optional(),
  tweaks: z.array(tweak).optional(),
  failures: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), explain: z.string().min(1), patches: z.array(patch).min(1) })),
  statusLines: z.array(statusLine).optional(),
  meet: z.string().min(1),
  mechanicalAnalogy: z.string().min(1),
  proTips: z.array(z.string()),
  quiz: z.array(z.object({ q: z.string().min(1), options: z.array(z.string()).min(2), answer: z.number().int(), why: z.string() })),
  behaviors: z.array(behaviorRef).optional(),
  transient: z.boolean().optional(),
  sim: z.object({ dt: num.positive().optional(), method: z.enum(['be', 'trap']).optional(), stepsPerFrame: z.number().int().positive().optional() }).optional(),
})

/** Every problem with a lesson, as readable strings (empty = valid). */
export function validateLesson(l: unknown): string[] {
  const parsed = lessonSchema.safeParse(l)
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
  const lesson = l as Lesson
  const errs: string[] = []
  const ids = new Set(lesson.circuit.elements.map((e) => e.id))
  // ids that only exist once a failure adds them still count for patches that follow
  const added = new Set(lesson.failures.flatMap((f) => f.patches.flatMap((p) => (p.op === 'add' ? [p.element.id] : []))))
  const has = (id: string) => ids.has(id)
  const instances = new Set((lesson.behaviors ?? []).map((b) => (typeof b === 'string' ? b : (b.instance ?? b.id))))

  const dupEl = lesson.circuit.elements.map((e) => e.id).filter((id, i, a) => a.indexOf(id) !== i)
  for (const id of new Set(dupEl)) errs.push(`circuit: duplicate element id "${id}"`)
  const partIds = lesson.board.parts.map((p) => p.id)
  for (const id of new Set(partIds.filter((id, i) => partIds.indexOf(id) !== i))) errs.push(`board.parts: duplicate part id "${id}"`)

  for (const p of lesson.board.parts)
    for (const c of p.circuitIds ?? []) if (!has(c)) errs.push(`board.parts.${p.id}.circuitIds: no element "${c}"`)
  for (const id of [lesson.powerElementId, ...(lesson.extraPower ?? []).map((x) => x.elementId)]) {
    if (!has(id)) errs.push(`power: no element "${id}"`)
  }
  lesson.readouts.forEach((r, i) => {
    const s = r.source
    if ((s.kind === 'current' || s.kind === 'power') && !has(s.elementId)) errs.push(`readouts.${i}: no element "${s.elementId}"`)
  })
  lesson.tweaks?.forEach((t, i) => {
    if (t.elementId.startsWith('behavior:')) {
      if (!instances.has(t.elementId.slice(9))) errs.push(`tweaks.${i}: no behavior instance "${t.elementId.slice(9)}"`)
    } else if (!has(t.elementId)) errs.push(`tweaks.${i}: no element "${t.elementId}"`)
    if (!(t.max > t.min)) errs.push(`tweaks.${i}: max must be above min`)
    if (t.log && t.min <= 0) errs.push(`tweaks.${i}: a log slider needs min > 0`)
  })
  for (const f of lesson.failures) {
    f.patches.forEach((p, i) => {
      if ((p.op === 'remove' || p.op === 'set') && !has(p.elementId) && !added.has(p.elementId))
        errs.push(`failures.${f.id}.patches.${i}: no element "${p.elementId}"`)
    })
  }
  const fIds = lesson.failures.map((f) => f.id)
  for (const id of new Set(fIds.filter((id, i) => fIds.indexOf(id) !== i))) errs.push(`failures: duplicate id "${id}"`)
  lesson.quiz.forEach((q, i) => {
    if (q.answer < 0 || q.answer >= q.options.length) errs.push(`quiz.${i}: answer ${q.answer} out of range`)
  })
  lesson.statusLines?.forEach((s, i) => {
    if ((s.when.kind === 'above' || s.when.kind === 'below') && s.when.readout >= lesson.readouts.length)
      errs.push(`statusLines.${i}: no readout ${s.when.readout}`)
  })
  if (lesson.sketch) {
    for (const [pin, id] of Object.entries(lesson.sketch.pins)) {
      const el = lesson.circuit.elements.find((e) => e.id === id)
      if (!el) errs.push(`sketch.pins.${pin}: no element "${id}"`)
      else if (el.type !== 'PIN') errs.push(`sketch.pins.${pin}: "${id}" is a ${el.type}, not a PIN`)
      else if (el.pin !== Number(pin)) errs.push(`sketch.pins.${pin}: "${id}" is pin ${el.pin}`)
    }
  }
  return errs
}
