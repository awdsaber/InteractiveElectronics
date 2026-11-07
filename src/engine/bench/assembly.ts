// Bench assembly: a pure reducer over what is placed, soldered, powered and broken.
// No simulation here; simLoop.ts turns this state into a netlist.

import type { SfxName } from '../../audio/sound'
import type { BenchAction } from '../../ui/types'
import type { BenchStatus, BurnEvent, Lesson, PartPlacement } from '../types'

export interface AssemblyState {
  placed: Set<string>
  soldered: boolean
  /** per power element id (the main one plus `lesson.extraPower`) */
  powered: Record<string, boolean>
  running: boolean
  exploded: boolean
  /** active failure scenario ids, in the order they were applied */
  failures: string[]
  burns: BurnEvent[]
  /** elements in thermal shutdown: off, but not burnt */
  disabled: Set<string>
}

/** Engine-side events from the sim loop, alongside the UI's BenchActions. */
export type AssemblyEvent =
  | { type: 'burn'; burn: BurnEvent }
  | { type: 'thermal'; elementId: string; off: boolean }
  /** the sketch stopped (transpile or runtime error) */
  | { type: 'stopped' }

export type AssemblyAction = BenchAction | AssemblyEvent

export interface Note {
  text: string
  tone: 'info' | 'warn' | 'ok'
  /** sound effect name for src/audio/sound.ts */
  sound?: SfxName
}

export interface AssemblyResult {
  state: AssemblyState
  notes: Note[]
}

export const powerIds = (l: Lesson): string[] => [l.powerElementId, ...(l.extraPower ?? []).map((p) => p.elementId)]

const handPlaced = (p: PartPlacement) => p.mount !== 'smd'

/** the parts you build with (excludes `hidden` parts that only a failure brings onto the bench) */
export const buildParts = (l: Lesson): PartPlacement[] => l.board.parts.filter((p) => !p.hidden)

/** Solder is a step only on a PCB with through-hole parts. Breadboards and module-only benches skip it. */
export function needsSolder(l: Lesson): boolean {
  return l.board.base !== 'breadboard-only' && buildParts(l).some((p) => p.mount === 'tht')
}

/** The finished, unpowered board: what a lesson opens on. */
export function initialAssembly(l: Lesson): AssemblyState {
  return {
    placed: new Set(buildParts(l).map((p) => p.id)),
    soldered: needsSolder(l),
    powered: Object.fromEntries(powerIds(l).map((id) => [id, false])),
    running: false,
    exploded: false,
    failures: [],
    burns: [],
    disabled: new Set(),
  }
}

export function remainingParts(l: Lesson, s: AssemblyState): PartPlacement[] {
  return buildParts(l).filter((p) => handPlaced(p) && !s.placed.has(p.id))
}

const missingSmd = (l: Lesson, s: AssemblyState) => buildParts(l).some((p) => p.mount === 'smd' && !s.placed.has(p.id))
const allPlaced = (l: Lesson, s: AssemblyState) => buildParts(l).every((p) => s.placed.has(p.id))

const KIND_NOUN: Partial<Record<PartPlacement['kind'], string>> = {
  'header-female': 'header',
  'header-male': 'pin header',
  'capacitor-electrolytic': 'electrolytic capacitor',
  'capacitor-ceramic': 'ceramic capacitor',
  'capacitor-smd': 'SMD capacitor',
  'resistor-smd': 'SMD resistor',
  led: 'LED',
  'led-smd': 'SMD LED',
  'ic-dip': 'DIP chip',
  'ic-smd': 'SMD chip',
  'usb-b': 'USB socket',
  'usb-c': 'USB-C socket',
  'micro-usb': 'micro-USB socket',
  'dc-motor': 'DC motor',
  'mosfet-to220': 'MOSFET',
  'regulator-to220': 'regulator',
  'transistor-to92': 'transistor',
  'switch-slide': 'slide switch',
  'battery-aa-pack': 'battery pack',
  'battery-9v': '9 V battery',
  'battery-lipo': 'LiPo battery',
  'stepper-nema17': 'stepper motor',
  'gear-motor-wheel': 'gear motor',
}
const noun = (k: PartPlacement['kind']) => KIND_NOUN[k] ?? k.replace(/-/g, ' ')
const plural = (w: string) => (/(s|x|ch|sh)$/.test(w) ? `${w}es` : `${w}s`)

/**
 * A readable list of parts for status text: a part that is the only one of its kind goes by its
 * label (or kind), several of a kind are counted: "USB, 2 headers, 10 wires, POT". Never raw ids.
 */
export function describeParts(parts: PartPlacement[]): string {
  const groups = new Map<string, PartPlacement[]>()
  for (const p of parts) groups.set(p.kind, [...(groups.get(p.kind) ?? []), p])
  return [...groups.values()]
    .map((g) => (g.length === 1 ? (g[0].label ?? noun(g[0].kind)) : `${g.length} ${plural(noun(g[0].kind))}`))
    .join(', ')
}

/** What still has to happen before `what` can: "SMD parts (pick & place), USB, 4 headers". */
function missingList(l: Lesson, s: AssemblyState): string[] {
  const out: string[] = []
  if (missingSmd(l, s)) out.push('SMD parts (pick & place)')
  const rest = describeParts(remainingParts(l, s))
  if (rest) out.push(rest)
  return out
}

export function readyToPower(l: Lesson, s: AssemblyState): boolean {
  return allPlaced(l, s) && (s.soldered || !needsSolder(l))
}

export function isPowered(l: Lesson, s: AssemblyState): boolean {
  return powerIds(l).some((id) => s.powered[id])
}

/** The MCU runs from the main supply. */
export const mcuPowered = (l: Lesson, s: AssemblyState): boolean => !!s.powered[l.powerElementId]

export function benchStatus(l: Lesson, s: AssemblyState): BenchStatus {
  if (s.burns.length > 0) return 'FAULT'
  if (s.running) return 'RUNNING'
  if (isPowered(l, s)) return 'POWERED'
  if (readyToPower(l, s)) return 'READY'
  if (s.placed.size > 0) return 'ASSEMBLING'
  return 'BARE PCB'
}

const partName = (l: Lesson, elementId: string, partId?: string): string => {
  const p = l.board.parts.find((x) => x.id === partId) ?? l.board.parts.find((x) => x.circuitIds?.includes(elementId))
  return p?.label && p.label.length <= 12 ? `${elementId} (${p.label.toLowerCase()})` : elementId
}

function burnText(l: Lesson, b: BurnEvent): string {
  const name = partName(l, b.elementId, b.partId)
  const v = (x: number, unit: string) => {
    const a = Math.abs(x)
    if (a >= 1) return `${+a.toPrecision(2)} ${unit}`
    return `${+(a * 1000).toPrecision(2)} m${unit}`
  }
  switch (b.reason) {
    case 'overvoltage':
      return `${name} failed: ${v(b.value, 'V')} across a ${v(b.limit, 'V')} part`
    case 'overpower':
      return `${name} burnt: ${v(b.value, 'W')} in a ${v(b.limit, 'W')} part`
    case 'overtemp':
      return `${name} overheated: ${+b.value.toPrecision(3)} °C past its ${+b.limit.toPrecision(3)} °C limit`
    case 'reverse-voltage':
      return `${name} failed short: ${v(b.value, 'V')} reverse across a polarized part`
    case 'blown':
      return `${name} blew: ${v(b.value, 'A')} through a ${v(b.limit, 'A')} fuse`
    case 'pin-overcurrent':
      return `${name} dead: ${v(b.value, 'A')} through a ${v(b.limit, 'A')} pin`
    default:
      return `${name} burnt: ${v(b.value, 'A')} through a ${v(b.limit, 'A')} part`
  }
}

export const describeBurn = burnText

function clone(s: AssemblyState): AssemblyState {
  return {
    ...s,
    placed: new Set(s.placed),
    powered: { ...s.powered },
    failures: s.failures.slice(),
    burns: s.burns.slice(),
    disabled: new Set(s.disabled),
  }
}

function setPower(l: Lesson, s: AssemblyState, ids: string[], on: boolean, notes: Note[]): void {
  if (on && !readyToPower(l, s)) {
    const need = missingList(l, s)
    if (needsSolder(l) && !s.soldered && need.length === 0) need.push('soldered joints')
    else if (needsSolder(l) && !s.soldered) need.push('then soldered joints')
    notes.push({ text: `Power needs: ${need.join(', ')}`, tone: 'warn', sound: 'click' })
    return
  }
  for (const id of ids) s.powered[id] = on
  if (!mcuPowered(l, s)) s.running = false
  // with everything off, parts in thermal shutdown cool down and come back
  if (!isPowered(l, s)) s.disabled.clear()
  notes.push(on ? { text: 'Power on.', tone: 'ok', sound: 'plug' } : { text: 'Power off.', tone: 'info', sound: 'plug' })
}

export function reduceAssembly(l: Lesson, prev: AssemblyState, a: AssemblyAction): AssemblyResult {
  const s = clone(prev)
  const notes: Note[] = []
  const done = (): AssemblyResult => ({ state: s, notes })

  if (typeof a !== 'string') {
    if (a.type === 'burn') {
      if (s.burns.some((b) => b.elementId === a.burn.elementId)) return { state: prev, notes }
      s.burns.push(a.burn)
      notes.push({ text: burnText(l, a.burn), tone: 'warn', sound: 'pop' })
    } else if (a.type === 'thermal') {
      if (a.off) s.disabled.add(a.elementId)
      else s.disabled.delete(a.elementId)
      notes.push(
        a.off
          ? { text: `${a.elementId} hit its thermal limit and shut down.`, tone: 'warn' }
          : { text: `${a.elementId} cooled down and restarted.`, tone: 'info' },
      )
    } else if (a.type === 'stopped') {
      s.running = false
    }
    return done()
  }

  if (a === 'strip') {
    s.placed.clear()
    s.soldered = false
    for (const id of Object.keys(s.powered)) s.powered[id] = false
    s.running = false
    s.burns = []
    s.disabled.clear()
    notes.push({ text: 'Stripped to the bare board.', tone: 'info', sound: 'click' })
  } else if (a === 'pick-place') {
    const smd = buildParts(l).filter((p) => p.mount === 'smd' && !s.placed.has(p.id))
    for (const p of smd) s.placed.add(p.id)
    notes.push(
      smd.length
        ? { text: `${smd.length} SMD part${smd.length > 1 ? 's' : ''} dropped in by the pick-and-place.`, tone: 'info', sound: 'place' }
        : { text: 'No SMD parts left to place.', tone: 'info' },
    )
  } else if (a === 'place-all') {
    const rest = remainingParts(l, s)
    for (const p of rest) s.placed.add(p.id)
    if (rest.length) notes.push({ text: `Placed ${rest.length} part${rest.length > 1 ? 's' : ''}.`, tone: 'ok', sound: 'place' })
  } else if (a.startsWith('place:')) {
    const p = buildParts(l).find((x) => x.id === a.slice(6))
    if (!p || !handPlaced(p) || s.placed.has(p.id)) return { state: prev, notes }
    s.placed.add(p.id)
    notes.push({ text: `${p.id.toUpperCase()}: ${p.role}`, tone: 'info', sound: 'place' })
  } else if (a === 'solder') {
    if (!needsSolder(l)) {
      notes.push({
        text: l.board.base === 'breadboard-only' ? 'Nothing to solder: breadboard parts push straight in.' : 'Nothing to solder on this board.',
        tone: 'info',
      })
    } else if (!allPlaced(l, s)) {
      notes.push({ text: `Solder needs: ${missingList(l, s).join(', ')}`, tone: 'warn', sound: 'click' })
    } else if (!s.soldered) {
      s.soldered = true
      notes.push({ text: 'Every joint soldered: shiny cones, no bridges.', tone: 'ok', sound: 'solder' })
    }
  } else if (a === 'power') {
    const ids = powerIds(l)
    const anyOn = ids.some((id) => s.powered[id])
    // the main button switches everything; it turns on only the main supply plus nothing else when partially on
    if (anyOn && s.powered[l.powerElementId]) setPower(l, s, ids, false, notes)
    else setPower(l, s, [l.powerElementId], true, notes)
  } else if (a.startsWith('power:')) {
    const id = a.slice(6)
    if (!(id in s.powered)) return { state: prev, notes }
    setPower(l, s, [id], !s.powered[id], notes)
  } else if (a === 'upload') {
    if (!l.sketch) return { state: prev, notes }
    if (!mcuPowered(l, s)) {
      notes.push({ text: `Upload needs power: ${l.powerLabel ?? 'plug USB'} first.`, tone: 'warn', sound: 'click' })
    } else {
      s.running = true
      notes.push({ text: `${l.sketch.title} uploaded and running.`, tone: 'ok', sound: 'success' })
    }
  } else if (a === 'explode') {
    s.exploded = !s.exploded
  } else if (a.startsWith('break:')) {
    const f = l.failures.find((x) => x.id === a.slice(6))
    if (!f || s.failures.includes(f.id)) return { state: prev, notes }
    s.failures.push(f.id)
    notes.push({ text: `Broken: ${f.label}.`, tone: 'warn', sound: 'click' })
  } else if (a === 'repair') {
    s.failures = []
    s.burns = []
    s.disabled.clear()
    notes.push({ text: 'Repaired: fresh parts fitted, every fault cleared.', tone: 'ok', sound: 'success' })
  }
  return done()
}
