// Runtime validation for lesson data (src/lessons/**). Mirrors `Lesson` in types.ts.
// Elements are checked loosely (id + type + nodes); the simulator owns their detail.

import { z } from 'zod'
import { ALL_PART_KINDS } from '../three/parts/kinds'
import { registry as defaultRegistry } from './behaviors'
import { readoutGraphErrors } from './bench/readouts'
import type { Behavior, Element, Lesson, Readout } from './types'

/** optional element fields a tweak or `set` patch may target, beyond the ones the element already has */
const OPTIONAL_KEYS: Record<string, string[]> = {
  V: ['rInternal', 'wave', 'iLimit', 'sink'],
  SW: ['vBreak'],
  D: ['is', 'n', 'rs'],
  ZENER: ['rz'],
  NPN: ['beta', 'is', 'vBreak'],
  PNP: ['beta', 'is', 'vBreak'],
  NMOS: ['vth', 'k', 'vBreak'],
  PMOS: ['vth', 'k', 'vBreak'],
  C: ['v0', 'polarized'],
  L: ['i0'],
  MOTOR: ['l', 'kt', 'j', 'b', 'load'],
  PIN: ['rOut', 'vccNode'],
  OPAMP: ['gain'],
  XFMR: ['lm'],
  LOGIC: ['vth', 'hyst'],
  FUSE: ['r', 'blown'],
  REG: ['iq'],
}
const COMMON_KEYS = ['disabled', 'partId']
const RATING_KEYS = ['maxI', 'maxP', 'maxV', 'failMode', 'rth', 'tauTh', 'tMax', 'rmsWindow']

function hasKey(el: Element, key: string): boolean {
  const [head, sub] = key.split('.', 2)
  if (head === 'rating') return sub !== undefined && RATING_KEYS.includes(sub)
  if (sub !== undefined) return false
  return key in el || COMMON_KEYS.includes(key) || (OPTIONAL_KEYS[el.type] ?? []).includes(key)
}

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
  hidden: z.boolean().optional(),
})

const voltageSource = z.object({ kind: z.literal('voltage'), node, ref: node.optional() })
const currentSource = z.object({ kind: z.literal('current'), elementId: z.string() })

const readout = z.object({
  label: z.string().min(1),
  source: z.union([
    currentSource,
    voltageSource,
    z.object({ kind: z.literal('power'), elementId: z.string() }),
    z.object({ kind: z.literal('extra'), key: z.string() }),
    z.object({ kind: z.literal('behavior'), key: z.string() }),
    z.object({ kind: z.literal('derived'), op: z.enum(['sum', 'diff', 'ratio', 'product']), of: z.array(z.number().int()).min(1) }),
  ]),
  unit: z.enum(['A', 'V', 'W', 'Ω', 'mΩ', 'rpm', '°', '°C', 'Hz', 'g', 'cm', '%', 's', 'µs', 'counts', 'dBm', 'C', 'steps', '']),
  digits: z.number().int().min(1).max(6).optional(),
  floor: z.number().nonnegative().optional(),
  peak: z.boolean().optional(),
  warnAbove: z.number().optional(),
})

const tweak = z.object({
  label: z.string(),
  elementId: z.string(),
  key: z.string(),
  kind: z.enum(['slider', 'enum', 'momentary', 'toggle']).optional(),
  options: z.array(z.object({ label: z.string().min(1), value: num })).optional(),
  min: num,
  max: num,
  step: num.positive().optional(),
  log: z.boolean().optional(),
  unit: z.string(),
  link: z.array(z.object({ elementId: z.string().min(1), key: z.string().min(1), scale: num.optional() })).optional(),
})

const scopeChannel = z.object({
  source: z.union([voltageSource, currentSource]),
  label: z.string().optional(),
  perDiv: num.positive().optional(),
  offset: num.min(-4).max(4).optional(),
  marks: z.array(z.object({ value: num, label: z.string() })).optional(),
})

const instruments = z.object({
  scope: z
    .object({
      channels: z.array(scopeChannel).min(1).max(2),
      timePerDiv: num.positive().optional(),
      trigger: z
        .object({
          channel: z.number().int().min(0).max(1).optional(),
          level: num.optional(),
          slope: z.enum(['rising', 'falling']).optional(),
          mode: z.enum(['auto', 'normal']).optional(),
        })
        .optional(),
    })
    .optional(),
  chart: z.object({ signals: z.array(z.union([z.number().int(), readout])).min(1).max(6), span: num.positive().optional() }).optional(),
  open: z.boolean().optional(),
  view: z.enum(['scope', 'chart']).optional(),
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
    frame: z.object({ size: z.tuple([num.positive(), num.positive()]), center: z.tuple([num, num]).optional() }).optional(),
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
  failures: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      explain: z.string().min(1),
      patches: z.array(patch).min(1),
      parts: z.object({ hide: z.array(z.string()).optional(), show: z.array(z.string()).optional() }).optional(),
    }),
  ),
  statusLines: z.array(statusLine).optional(),
  meet: z.string().min(1),
  mechanicalAnalogy: z.string().min(1),
  proTips: z.array(z.string()),
  quiz: z.array(z.object({ q: z.string().min(1), options: z.array(z.string()).min(2), answer: z.number().int(), why: z.string() })),
  behaviors: z.array(behaviorRef).optional(),
  transient: z.boolean().optional(),
  sim: z
    .object({
      dt: num.positive().optional(),
      method: z.enum(['be', 'trap']).optional(),
      stepsPerFrame: z.number().int().positive().optional(),
      edgeSubsteps: z.number().int().min(2).max(20).optional(),
      speed: num.positive().max(1000).optional(),
    })
    .optional(),
  instruments: instruments.optional(),
})

/**
 * Every problem with a lesson, as readable strings (empty = valid). `registry` is the behavior
 * registry ids are checked against (default: the auto-registered behaviors).
 */
export function validateLesson(l: unknown, registry: Record<string, Pick<Behavior, 'id'>> = defaultRegistry): string[] {
  const parsed = lessonSchema.safeParse(l)
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
  const lesson = l as Lesson
  const errs: string[] = []
  const els = new Map(lesson.circuit.elements.map((e) => [e.id, e]))
  // elements that only exist once a failure adds them still count for patches that follow
  const addedEls = lesson.failures.flatMap((f) => f.patches.flatMap((p) => (p.op === 'add' ? [p.element as Element] : [])))
  const element = (id: string) => els.get(id) ?? addedEls.find((e) => e.id === id)
  const has = (id: string) => els.has(id)
  const nodes = new Set(['0', ...[...lesson.circuit.elements, ...addedEls].flatMap((e) => e.nodes as string[])])
  const node = (n: string, where: string) => {
    if (!nodes.has(n)) errs.push(`${where}: no node "${n}"`)
  }
  const keyOk = (id: string, key: string, where: string) => {
    const el = element(id)
    if (el && !hasKey(el, key)) errs.push(`${where}: ${el.type} "${id}" has no key "${key}"`)
  }

  // behaviors
  const refs = (lesson.behaviors ?? []).map((b) => (typeof b === 'string' ? { id: b, instance: b } : { id: b.id, instance: b.instance ?? b.id }))
  const instances = new Set<string>()
  refs.forEach((r, i) => {
    if (!registry[r.id]) errs.push(`behaviors.${i}: no behavior "${r.id}" registered`)
    if (instances.has(r.instance)) errs.push(`behaviors.${i}: duplicate behavior instance "${r.instance}"`)
    instances.add(r.instance)
  })

  const dupEl = lesson.circuit.elements.map((e) => e.id).filter((id, i, a) => a.indexOf(id) !== i)
  for (const id of new Set(dupEl)) errs.push(`circuit: duplicate element id "${id}"`)
  const partIds = lesson.board.parts.map((p) => p.id)
  for (const id of new Set(partIds.filter((id, i) => partIds.indexOf(id) !== i))) errs.push(`board.parts: duplicate part id "${id}"`)

  for (const p of lesson.board.parts)
    for (const c of p.circuitIds ?? []) if (!has(c)) errs.push(`board.parts.${p.id}.circuitIds: no element "${c}"`)
  for (const id of [lesson.powerElementId, ...(lesson.extraPower ?? []).map((x) => x.elementId)]) {
    const el = els.get(id)
    if (!el) errs.push(`power: no element "${id}"`)
    else if (el.type !== 'V' && el.type !== 'SW') errs.push(`power: "${id}" is a ${el.type}; power must be a V or SW`)
  }
  const source = (s: Readout['source'], where: string, readoutCount: number) => {
    if ((s.kind === 'current' || s.kind === 'power') && !has(s.elementId)) errs.push(`${where}: no element "${s.elementId}"`)
    if (s.kind === 'voltage') {
      node(s.node, where)
      if (s.ref !== undefined) node(s.ref, where)
    }
    if (s.kind === 'behavior') {
      const inst = s.key.split('.')[0]
      if (!s.key.includes('.') || !instances.has(inst)) errs.push(`${where}: no behavior instance "${inst}" (keys are <instance>.<key>)`)
    }
    if (s.kind === 'derived') for (const j of s.of) if (j < 0 || j >= readoutCount) errs.push(`${where}: no readout ${j}`)
  }
  lesson.readouts.forEach((r, i) => {
    if (r.source.kind !== 'derived') source(r.source, `readouts.${i}`, lesson.readouts.length)
  })
  errs.push(...readoutGraphErrors(lesson.readouts))
  /** a tweak (or link) target: an element with that key, or a behavior instance */
  const target = (elementId: string, key: string, where: string) => {
    if (elementId.startsWith('behavior:')) {
      if (!instances.has(elementId.slice(9))) errs.push(`${where}: no behavior instance "${elementId.slice(9)}"`)
    } else if (!has(elementId)) errs.push(`${where}: no element "${elementId}"`)
    else keyOk(elementId, key, where)
  }
  lesson.tweaks?.forEach((t, i) => {
    target(t.elementId, t.key, `tweaks.${i}`)
    if (!(t.max > t.min)) errs.push(`tweaks.${i}: max must be above min`)
    if (t.log && t.min <= 0) errs.push(`tweaks.${i}: a log slider needs min > 0`)
    if (t.kind === 'enum') {
      if (!t.options || t.options.length < 2) errs.push(`tweaks.${i}: an enum tweak needs at least 2 options`)
      for (const o of t.options ?? []) if (o.value < t.min || o.value > t.max) errs.push(`tweaks.${i}: option "${o.label}" (${o.value}) is outside min..max`)
    } else if (t.options) errs.push(`tweaks.${i}: options are only for kind "enum"`)
    t.link?.forEach((l, j) => target(l.elementId, l.key, `tweaks.${i}.link.${j}`))
  })
  const ins = lesson.instruments
  if (ins?.scope) {
    ins.scope.channels.forEach((c, i) => source(c.source, `instruments.scope.channels.${i}`, 0))
    const ch = ins.scope.trigger?.channel ?? 0
    if (ch >= ins.scope.channels.length) errs.push(`instruments.scope.trigger: no channel ${ch}`)
  }
  ins?.chart?.signals.forEach((sig, i) => {
    const where = `instruments.chart.signals.${i}`
    if (typeof sig === 'number') {
      if (sig < 0 || sig >= lesson.readouts.length) errs.push(`${where}: no readout ${sig}`)
    } else source(sig.source, where, lesson.readouts.length)
  })
  const partSet = new Set(partIds)
  for (const f of lesson.failures) {
    f.patches.forEach((p, i) => {
      const where = `failures.${f.id}.patches.${i}`
      if (p.op === 'set' && p.elementId.startsWith('behavior:')) {
        // overrides that behavior instance's param while the failure is active
        if (!instances.has(p.elementId.slice(9))) errs.push(`${where}: no behavior instance "${p.elementId.slice(9)}"`)
      } else if (p.op === 'remove' || p.op === 'set') {
        if (!element(p.elementId)) errs.push(`${where}: no element "${p.elementId}"`)
        else if (p.op === 'set') keyOk(p.elementId, p.key, where)
      }
      if (p.op === 'short') {
        node(p.a, where)
        node(p.b, where)
      }
    })
    for (const id of [...(f.parts?.hide ?? []), ...(f.parts?.show ?? [])]) {
      if (!partSet.has(id)) errs.push(`failures.${f.id}.parts: no part "${id}"`)
    }
  }
  const shown = new Set(lesson.failures.flatMap((f) => f.parts?.show ?? []))
  for (const p of lesson.board.parts) if (p.hidden && !shown.has(p.id)) errs.push(`board.parts.${p.id}: hidden, but no failure shows it`)
  const fIds = lesson.failures.map((f) => f.id)
  for (const id of new Set(fIds.filter((id, i) => fIds.indexOf(id) !== i))) errs.push(`failures: duplicate id "${id}"`)
  lesson.quiz.forEach((q, i) => {
    if (q.answer < 0 || q.answer >= q.options.length) errs.push(`quiz.${i}: answer ${q.answer} out of range`)
  })
  lesson.statusLines?.forEach((s, i) => {
    if ((s.when.kind === 'above' || s.when.kind === 'below') && s.when.readout >= lesson.readouts.length)
      errs.push(`statusLines.${i}: no readout ${s.when.readout}`)
    if (s.when.kind === 'pin' && !(lesson.sketch && String(s.when.pin) in lesson.sketch.pins))
      errs.push(`statusLines.${i}: pin ${s.when.pin} is not in sketch.pins`)
    for (const m of s.text.matchAll(/\{(\d+)\}/g))
      if (Number(m[1]) >= lesson.readouts.length) errs.push(`statusLines.${i}: no readout {${m[1]}}`)
  })
  if (lesson.sketch) {
    for (const [pin, id] of Object.entries(lesson.sketch.pins)) {
      const el = els.get(id)
      if (!el) errs.push(`sketch.pins.${pin}: no element "${id}"`)
      else if (el.type !== 'PIN') errs.push(`sketch.pins.${pin}: "${id}" is a ${el.type}, not a PIN`)
      else if (el.pin !== Number(pin)) errs.push(`sketch.pins.${pin}: "${id}" is pin ${el.pin}`)
    }
    for (const [name, n] of Object.entries(lesson.sketch.analogPins ?? {})) node(n, `sketch.analogPins.${name}`)
  }
  return errs
}
