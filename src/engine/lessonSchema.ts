// Runtime validation for lesson data (src/lessons/**). Mirrors `Lesson` in types.ts.
// Elements are checked loosely (id + type + nodes); the simulator owns their detail.

import { z } from 'zod'
import { ALL_PART_KINDS } from '../three/parts/kinds'
import { registry as defaultRegistry } from './behaviors'
import { readoutGraphErrors } from './bench/readouts'
import type { Behavior, Element, GuideCheck, Lesson, Readout } from './types'

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
  MOTOR: ['l', 'kt', 'j', 'b', 'load', 'omegaSet'],
  PIN: ['rOut', 'vccNode'],
  OPAMP: ['gain'],
  XFMR: ['lm'],
  LOGIC: ['vth', 'hyst'],
  FUSE: ['r', 'blown'],
  REG: ['iq'],
}
const COMMON_KEYS = ['disabled', 'partId']
const RATING_KEYS = ['maxI', 'maxP', 'maxV', 'failMode', 'rth', 'tauTh', 'tMax', 'rmsWindow']
/** numeric fields of a V source's `wave` (dotted keys 'wave.freq' …, on a V that has a wave) */
const WAVE_KEYS = ['amp', 'freq', 'offset', 'phase', 'duty']

function hasKey(el: Element, key: string): boolean {
  const [head, sub] = key.split('.', 2)
  if (head === 'rating') return sub !== undefined && RATING_KEYS.includes(sub)
  if (head === 'wave') return el.type === 'V' && el.wave !== undefined && sub !== undefined && WAVE_KEYS.includes(sub)
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
  facts: z.array(z.string().min(1)).optional(),
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
  logic: z
    .object({
      channels: z
        .array(
          z
            .object({ pin: z.number().int().min(0).optional(), node: node.optional(), label: z.string().min(1) })
            .refine((c) => (c.pin === undefined) !== (c.node === undefined), 'a logic channel names a pin or a node'),
        )
        .min(1)
        .max(8),
      decode: z.enum(['uart', 'i2c', 'spi']).optional(),
      baud: num.positive().optional(),
      span: num.positive().optional(),
    })
    .optional(),
  open: z.boolean().optional(),
  view: z.enum(['scope', 'chart', 'logic']).optional(),
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

const guideAction = z.enum(['strip', 'pick-place', 'place', 'place-all', 'solder', 'power', 'upload', 'explode', 'repair'])

const guideCheck: z.ZodType<GuideCheck> = z.lazy(() =>
  z.union([
    z.object({ kind: z.literal('action'), action: guideAction }),
    z.object({ kind: z.literal('status'), is: status }),
    z.object({ kind: z.literal('break'), failure: z.string().min(1) }),
    z.object({ kind: z.literal('tweak'), target: z.string().min(1), min: num.optional(), max: num.optional() }),
    z.object({
      kind: z.literal('readout'),
      index: z.number().int().min(0),
      above: num.optional(),
      below: num.optional(),
      holdMs: num.nonnegative().optional(),
    }),
    z.object({ kind: z.literal('pin'), pin: z.number().int(), level: z.union([z.literal(0), z.literal(1)]) }),
    z.object({ kind: z.literal('inspect'), part: z.string().min(1) }),
    z.object({ kind: z.literal('instruments') }),
    z.object({ kind: z.literal('quiz') }),
    z.object({ kind: z.enum(['all', 'any']), of: z.array(guideCheck).min(1) }),
    z.object({ kind: z.literal('manual') }),
  ]),
)

const GUIDE_CONTROLS = ['strip', 'pick-place', 'place', 'solder', 'power', 'upload', 'explode', 'break', 'instruments', 'quiz', 'code'] as const
const guideControl = z.union([z.enum(GUIDE_CONTROLS), z.templateLiteral(['tweak:', z.string().min(1)])])

const guideStep = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case id'),
  title: z.string().min(1),
  body: z.string().min(1),
  check: guideCheck,
  hint: z.string().min(1).optional(),
  focus: z.object({ part: z.string().min(1).optional(), control: guideControl.optional() }).optional(),
  explain: z.string().min(1).optional(),
})

const behaviorRef = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1),
    instance: z.string().min(1).optional(),
    params: z.record(z.string(), z.union([num, z.string(), z.boolean()])).optional(),
  }),
])

const pt = z.tuple([num, num])
const pcbTrace = z.object({
  id: z.string().min(1),
  net: z.string().min(1),
  pts: z.array(pt).min(2),
  w: num.positive(),
  amps: num.nonnegative().optional(),
  widthParam: z.string().optional(),
  ampsParam: z.string().optional(),
  elementId: z.string().optional(),
})
const pcbLayers = z.object({
  thicknessMm: num.positive(),
  copperOz: num.positive(),
  copperOzParam: z.string().optional(),
  top: z.array(pcbTrace),
  bottom: z.array(pcbTrace),
  pours: z.array(z.object({ net: z.string(), layer: z.enum(['top', 'bottom']), clearance: num.nonnegative() })).optional(),
  vias: z.array(z.object({ at: pt, net: z.string(), drill: num.positive(), pad: num.positive() })).optional(),
  padNets: z.record(z.string(), z.string()).optional(),
  pourPads: z.array(z.object({ part: z.string(), pad: z.number().int().nonnegative(), relief: z.boolean() })).optional(),
  decoupling: z.array(z.object({ cap: z.string(), ic: z.string(), pad: z.number().int().nonnegative(), pin: z.string(), maxMm: num.positive() })).optional(),
  fiducials: z.array(z.object({ at: pt, d: num.positive() })).optional(),
  silk: z.array(z.object({ text: z.string(), at: pt, size: num.positive().optional() })).optional(),
  rules: z.object({ minTrace: num.positive(), minClearance: num.positive(), minAnnular: num.nonnegative(), riseC: num.positive() }),
})

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
    layers: pcbLayers.optional(),
    dynamic: z
      .object({
        lift: num.nonnegative().optional(),
        pivot: z.tuple([num, num, num]),
        pitchKey: z.string().min(1).optional(),
        travelKey: z.string().min(1).optional(),
        unitsPerM: num.positive().optional(),
        maxTravel: num.nonnegative().optional(),
        fixed: z.array(z.string()).optional(),
      })
      .optional(),
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
      board: z.enum(['uno', 'esp32s3', 'teensy41', 'generic']),
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
  guide: z.array(guideStep).min(1).optional(),
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
  for (const id of lesson.board.dynamic?.fixed ?? []) if (!partIds.includes(id)) errs.push(`board.dynamic.fixed: no part "${id}"`)
  const lay = lesson.board.layers
  if (lay) {
    const known = new Set(partIds)
    for (const p of lay.pourPads ?? []) if (!known.has(p.part)) errs.push(`board.layers.pourPads: no part "${p.part}"`)
    for (const d of lay.decoupling ?? []) for (const id of [d.cap, d.ic]) if (!known.has(id)) errs.push(`board.layers.decoupling: no part "${id}"`)
    const tids = [...lay.top, ...lay.bottom].map((t) => t.id)
    for (const id of new Set(tids.filter((id, i) => tids.indexOf(id) !== i))) errs.push(`board.layers: duplicate trace id "${id}"`)
  }

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
  if (ins?.logic) {
    if (!refs.some((r) => r.id === 'logic-analyzer')) errs.push('instruments.logic: needs a "logic-analyzer" behavior to record the buses')
    ins.logic.channels.forEach((c, i) => {
      if (c.node !== undefined) node(c.node, `instruments.logic.channels.${i}`)
    })
  }
  if (ins?.view === 'logic' && !ins.logic) errs.push('instruments.view: "logic" needs instruments.logic')
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
  errs.push(...guideErrors(lesson))
  return errs
}

/** cross-reference problems in `lesson.guide` (its shape is already checked by the schema) */
function guideErrors(lesson: Lesson): string[] {
  const errs: string[] = []
  const steps = lesson.guide ?? []
  const ids = steps.map((s) => s.id)
  for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) errs.push(`guide: duplicate step id "${id}"`)
  const parts = new Set(lesson.board.parts.map((p) => p.id))
  const failures = new Set(lesson.failures.map((f) => f.id))
  const tweaks = lesson.tweaks ?? []
  const tweakNamed = (t: string) => tweaks.some((x) => x.label === t || `${x.elementId}.${x.key}` === t)
  const bb = lesson.board.base === 'breadboard-only'
  const control = (c: string, where: string) => {
    if (bb && (c === 'pick-place' || c === 'solder')) errs.push(`${where}: a breadboard bench has no "${c}" button`)
    if ((c === 'upload' || c === 'code') && !lesson.sketch) errs.push(`${where}: "${c}" needs a sketch`)
  }
  const check = (c: GuideCheck, where: string) => {
    switch (c.kind) {
      case 'action':
        control(c.action, where)
        break
      case 'break':
        if (!failures.has(c.failure)) errs.push(`${where}: no failure "${c.failure}"`)
        break
      case 'inspect':
        if (!parts.has(c.part)) errs.push(`${where}: no part "${c.part}"`)
        break
      case 'tweak':
        if (!tweakNamed(c.target)) errs.push(`${where}: no tweak "${c.target}" (use its label or elementId.key)`)
        if (c.min !== undefined && c.max !== undefined && c.max < c.min) errs.push(`${where}: max must be at least min`)
        break
      case 'readout':
        if (c.index >= lesson.readouts.length) errs.push(`${where}: no readout ${c.index}`)
        if (c.above === undefined && c.below === undefined) errs.push(`${where}: a readout check needs above and/or below`)
        break
      case 'pin':
        if (!(lesson.sketch && String(c.pin) in lesson.sketch.pins)) errs.push(`${where}: pin ${c.pin} is not in sketch.pins`)
        break
      case 'all':
      case 'any':
        c.of.forEach((x, i) => check(x, `${where}.of.${i}`))
        break
    }
  }
  steps.forEach((s, i) => {
    check(s.check, `guide.${i}.check`)
    const f = s.focus
    if (f?.part !== undefined && !parts.has(f.part)) errs.push(`guide.${i}.focus: no part "${f.part}"`)
    if (f?.control?.startsWith('tweak:')) {
      const t = f.control.slice(6)
      if (!tweakNamed(t)) errs.push(`guide.${i}.focus: no tweak "${t}"`)
    } else if (f?.control) control(f.control, `guide.${i}.focus`)
  })
  return errs
}
