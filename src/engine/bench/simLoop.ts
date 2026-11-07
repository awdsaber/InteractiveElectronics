// The bench engine: assembly state + simulator + virtual MCU + behaviors, framework-free.
// The zustand store (store.ts) drives it from requestAnimationFrame; tests drive it headless.
//
// Per frame: step the circuit (DC or transient), advance the MCU to the same sim time
// (serially; a frame whose MCU advance is still pending skips it), tick behaviors, check
// ratings once, then publish a throttled snapshot (~15 Hz) for the UI.

import { registry as defaultRegistry, resolveBehaviorRef, type ResolvedBehavior } from '../behaviors'
import { TranspileError, VirtualMcu } from '../mcu'
import {
  applyBurn,
  applyPatches,
  checkRatings,
  createRatingState,
  createTransient,
  effectiveRating,
  formatSI,
  pinWarnings,
  solveDC,
  type RatingState,
  type Transient,
} from '../sim'
import type {
  Behavior,
  BehaviorContext,
  BehaviorEvent,
  BehaviorLifecycleEvent,
  BenchStatus,
  BurnEvent,
  Element,
  FailurePatch,
  Lesson,
  Netlist,
  PinState,
  Readout,
  Solution,
  StatusLine,
  Tweak,
} from '../types'
import type { PartChoice, ReadoutView } from '../../ui/types'
import {
  type AssemblyAction,
  type AssemblyState,
  type Note,
  benchStatus,
  buildParts,
  describeBurn,
  describeParts,
  initialAssembly,
  isPowered,
  mcuPowered,
  needsSolder,
  powerIds,
  readyToPower,
  reduceAssembly,
  remainingParts,
} from './assembly'

export interface BenchOptions {
  /** behavior registry (defaults to src/engine/behaviors) */
  registry?: Record<string, Behavior>
  /** throttled snapshots (about `snapshotHz`) plus one after every dispatch / tweak / upload */
  onSnapshot?(s: BenchSnapshot): void
  /** toasts and sounds */
  onNote?(n: Note): void
  snapshotHz?: number
  /** sim seconds per real second (default 1) */
  speed?: number
  /** sketch text to start from (default: the lesson's) */
  code?: string
  /** tweak values to start from, keyed like tweakKey() */
  tweaks?: Record<string, number>
}

export interface StatusLineView {
  text: string
  tone: 'info' | 'ok' | 'warn'
}

export interface BenchSnapshot {
  /** sim time, s */
  t: number
  status: BenchStatus
  assembly: {
    placed: string[]
    soldered: boolean
    powered: Record<string, boolean>
    running: boolean
    exploded: boolean
    failures: string[]
    burns: BurnEvent[]
    disabled: string[]
  }
  placedCount: number
  totalParts: number
  remaining: PartChoice[]
  smdPlaced: boolean
  allPlaced: boolean
  needsSolder: boolean
  readyToPower: boolean
  powered: boolean
  readouts: ReadoutView[]
  /** raw readout values (SI base units), same order as lesson.readouts */
  values: number[]
  statusLine: StatusLineView
  /** pin states the circuit currently sees (INPUT while unpowered or held) */
  pins: Record<number, PinState>
  /** element currents of the latest good solution */
  current: Record<string, number>
  extra: Record<string, number>
  /** behavior values, keyed `${instance}.${key}` */
  published: Record<string, number>
  /** live element parameters of the simulated netlist: `${id}.value` (R/C/L), `${id}.pos` (POT) */
  elementValues: Record<string, number>
  /** burnt state per 3D part id */
  partBurnt: Record<string, boolean>
  /** on the bench right now: placed, minus parts an active failure hides, plus parts it shows */
  partVisible: Record<string, boolean>
  serial: string[]
  sketchError: string | null
  warnings: string[]
}

export interface Bench {
  readonly lesson: Lesson
  readonly assembly: AssemblyState
  /** sim time, s */
  readonly t: number
  readonly code: string
  dispatch(a: AssemblyAction): Note[]
  setCode(code: string): void
  /** set the code (optional) and press Upload */
  upload(code?: string): Note[]
  setTweak(key: string, value: number): void
  tweakValues(): Record<string, number>
  setSpeed(x: number): void
  serialIn(text: string): void
  /** advance by one animation frame of `realDt` seconds; resolves when this frame's MCU advance is done */
  frame(realDt: number): Promise<void>
  /** true while something is live (powered or running): the caller should keep calling frame() */
  needsFrames(): boolean
  snapshot(): BenchSnapshot
  events(): readonly BehaviorEvent[]
  mcuTimeMs(): number
  dispose(): void
}

export const tweakKey = (t: Pick<Tweak, 'elementId' | 'key'>): string => `${t.elementId}.${t.key}`

const MAX_FRAME = 0.1
const SERIAL_KEEP = 200
const EVENT_KEEP = 4000
const DYNAMIC: Element['type'][] = ['C', 'L', 'MOTOR']

const isThermal = (b: BurnEvent) => b.reason === 'thermal-shutdown' || b.reason === 'thermal-recover'

/** Arduino analog pin name → pin number the sketch passes to analogRead (Uno A0 = 14, ESP32-S3 A0 = GPIO1). */
export function analogPinNumber(name: string, board: 'uno' | 'esp32s3' | 'generic'): number {
  const m = /^A(\d+)$/i.exec(name)
  if (!m) return Number(name)
  const n = Number(m[1])
  return board === 'esp32s3' ? n + 1 : 14 + n
}

/** what "power off" means for a source element */
function powerOffPatch(el: Element): FailurePatch {
  // a disabled element stamps as an open circuit
  return { op: 'set', elementId: el.id, key: 'disabled', value: true }
}

const floor = (unit: string) => (unit === 'V' ? 1e-6 : unit === 'A' || unit === 'W' ? 1e-9 : 0)

function initialTweaks(l: Lesson, behaviors: ResolvedBehavior[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of l.tweaks ?? []) {
    let v: unknown
    if (t.elementId.startsWith('behavior:')) {
      v = behaviors.find((b) => `behavior:${b.instance}` === t.elementId)?.params[t.key]
    } else {
      v = (l.circuit.elements.find((e) => e.id === t.elementId) as Record<string, unknown> | undefined)?.[t.key]
    }
    out[tweakKey(t)] = typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : t.min
  }
  return out
}

export function createBench(lesson: Lesson, opts: BenchOptions = {}): Bench {
  const reg = opts.registry ?? defaultRegistry
  const hz = opts.snapshotHz ?? 15
  let speed = opts.speed ?? 1
  let code = opts.code ?? lesson.sketch?.code ?? ''

  let asm = initialAssembly(lesson)
  const warnings: string[] = []

  // ── behaviors ──
  const instances: { def: Behavior; r: ResolvedBehavior; ctx: BehaviorContext }[] = []
  const published: Record<string, number> = {}
  const events: BehaviorEvent[] = []
  const live: Record<string, number | boolean> = {} // `${id}\u0000${key}` → value set by behaviors
  let liveDirty = false

  const resolved = (lesson.behaviors ?? []).map(resolveBehaviorRef)
  const tweaks: Record<string, number> = { ...initialTweaks(lesson, resolved), ...(opts.tweaks ?? {}) }
  for (const r of resolved) {
    for (const [k, v] of Object.entries(tweaks)) {
      const pre = `behavior:${r.instance}.`
      if (k.startsWith(pre)) r.params[k.slice(pre.length)] = v
    }
  }

  // ── circuit ──
  const dynamic =
    lesson.transient ??
    (!!lesson.sketch ||
      lesson.circuit.elements.some((e) => DYNAMIC.includes(e.type)) ||
      resolved.some((r) => !!reg[r.id]?.tick))
  const dt = lesson.sim?.dt ?? 1e-3
  let netlist: Netlist = lesson.circuit
  let sim: Transient | null = null
  let dcSol: Solution | null = null
  let dcDirty = true
  /** transient: the netlist changed since the last step (lastGood describes the old circuit) */
  let stale = false
  let ratings: RatingState = createRatingState()
  let t = 0

  // ── MCU ──
  let mcu: VirtualMcu | null = null
  let mcuStart = 0
  let mcuPending: Promise<void> | null = null
  let held = false
  /** bumps on every upload / stop / dispose: results from an older run are dropped */
  let gen = 0
  const mcuPins: Record<number, PinState> = {}
  const simPins: Record<number, PinState> = {}
  const serial: string[] = []
  let sketchError: string | null = null
  const pendingI2c: [number, unknown][] = []
  const pendingSpi: [number, unknown][] = []

  // ── snapshots ──
  let since = 0
  let disposed = false

  const note = (ns: Note[]) => {
    if (disposed) return
    for (const n of ns) opts.onNote?.(n)
  }

  function buildNetlist(): Netlist {
    const patches: FailurePatch[] = []
    const ids = new Set(lesson.circuit.elements.map((e) => e.id))
    for (const tw of lesson.tweaks ?? []) {
      if (tw.elementId.startsWith('behavior:') || !ids.has(tw.elementId)) continue
      const v = tweaks[tweakKey(tw)]
      const el = lesson.circuit.elements.find((e) => e.id === tw.elementId) as Record<string, unknown> | undefined
      patches.push({ op: 'set', elementId: tw.elementId, key: tw.key, value: typeof el?.[tw.key] === 'boolean' ? v >= 0.5 : v })
    }
    for (const [k, v] of Object.entries(live)) {
      const [elementId, key] = k.split('\u0000')
      patches.push({ op: 'set', elementId, key, value: v })
    }
    for (const id of asm.failures) {
      const f = lesson.failures.find((x) => x.id === id)
      if (f) patches.push(...f.patches)
    }
    let n = applyPatches(lesson.circuit, patches)
    for (const b of asm.burns) if (!isThermal(b)) n = applyBurn(n, b)
    for (const id of asm.disabled) n = applyBurn(n, { elementId: id, reason: 'thermal-shutdown', value: 0, limit: 0, t })
    const off: FailurePatch[] = []
    for (const id of powerIds(lesson)) {
      if (asm.powered[id]) continue
      const el = n.elements.find((e) => e.id === id)
      if (el) off.push(powerOffPatch(el))
    }
    return off.length ? applyPatches(n, off) : n
  }

  /**
   * Rebuild the netlist from the lesson + state. `structural` (assembly actions: power, failures,
   * burns) means the last transient solution describes a different circuit, so until the next frame
   * steps it, readouts come from the new circuit's operating point. Parameter changes (tweaks,
   * behavior setParam) keep the transient state and its last solution.
   */
  function rebuild(structural = true): void {
    netlist = buildNetlist()
    if (dynamic) {
      if (!sim) {
        sim = createTransient(netlist, dt, { method: lesson.sim?.method, edgeSubsteps: lesson.sim?.edgeSubsteps })
        for (const [p, st] of Object.entries(simPins)) sim.setPin(Number(p), st)
      } else sim.setNetlist(netlist)
      if (structural) stale = true
    }
    dcDirty = true
    peekCache = null
  }

  function solution(): Solution | null {
    if (dynamic && !stale) return sim?.lastGood ?? null
    if (dcDirty) {
      dcSol = solveDC(netlist, { pins: simPins })
      dcDirty = false
    }
    return dcSol?.ok ? dcSol : null
  }

  // ── pins ──
  /**
   * transient: MCU time (µs) of the first pin change since the last step, or null. The step's
   * solution predates that change, so a read after it (digitalRead right after pinMode(INPUT_PULLUP),
   * or an input cross-wired to an output that just switched) is taken from a short transient
   * re-solve over the MCU time elapsed since the change, from the circuit's current C/L state.
   */
  let pinsChangedAt: number | null = null
  let peekCache: { h: number; sol: Solution } | null = null
  const mcuMicros = () => mcu?.timeMicros ?? 0
  function applyPin(pin: number, st: PinState): void {
    const prev = simPins[pin]
    if (dynamic && (!prev || prev.mode !== st.mode || prev.level !== st.level)) {
      pinsChangedAt ??= mcuMicros()
      peekCache = null
    }
    simPins[pin] = { ...st }
    if (sim) sim.setPin(pin, st)
    dcDirty = true
  }
  /** a node voltage for an MCU read: re-solved when a pin changed since the last transient step */
  function readV(node: string, ref = '0'): number {
    if (pinsChangedAt === null || !sim || stale) return nodeV(node, ref === '0' ? undefined : ref)
    const h = Math.max(1e-6, (mcuMicros() - pinsChangedAt) * 1e-6)
    if (!peekCache || peekCache.h !== h) peekCache = { h, sol: sim.peek(h) }
    const s = peekCache.sol
    if (!s.ok) return nodeV(node, ref === '0' ? undefined : ref)
    return (s.nodeV[node] ?? 0) - (s.nodeV[ref] ?? 0)
  }
  const mcuLive = () => !!mcu && asm.running && !held
  function floatPins(): void {
    for (const p of Object.keys(simPins)) applyPin(Number(p), { mode: 'INPUT', level: 0 })
  }

  function nodeV(node: string, ref?: string): number {
    const s = solution()
    if (!s) return 0
    return (s.nodeV[node] ?? 0) - (ref ? (s.nodeV[ref] ?? 0) : 0)
  }

  function ensureMcu(): VirtualMcu {
    if (mcu) return mcu
    const sk = lesson.sketch!
    const libraries: Record<string, unknown> = {}
    for (const inst of instances) Object.assign(libraries, inst.def.libraries?.(inst.ctx) ?? {})
    mcu = new VirtualMcu({
      vcc: sk.vcc,
      board: sk.board,
      libraries,
      onPin(pin, st) {
        mcuPins[pin] = { ...st }
        if (mcuLive()) applyPin(pin, st)
      },
      readAnalog(pin) {
        for (const [name, node] of Object.entries(sk.analogPins ?? {})) {
          if (analogPinNumber(name, sk.board) === pin) return Math.max(0, readV(node))
        }
        return 0
      },
      readDigital(pin) {
        const el = netlist.elements.find((e) => e.type === 'PIN' && e.pin === pin)
        return el && readV(el.nodes[0], el.nodes[1]) > sk.vcc / 2 ? 1 : 0
      },
      serial(line) {
        serial.push(line)
        if (serial.length > SERIAL_KEEP) serial.shift()
        if (disposed) return
        for (const inst of instances) inst.def.onSerial?.(inst.ctx, line)
      },
      warn(message) {
        if (disposed) return
        if (message.startsWith('runtime error')) {
          sketchError = message
          act({ type: 'stopped' })
        } else {
          serial.push(`[mcu] ${message}`)
          if (serial.length > SERIAL_KEEP) serial.shift()
        }
      },
    })
    for (const [a, d] of pendingI2c) mcu.attachI2c(a, d as never)
    for (const [p, d] of pendingSpi) mcu.attachSpi(p, d as never)
    return mcu
  }

  function startSketch(): boolean {
    gen++
    const m = ensureMcu()
    serial.length = 0
    sketchError = null
    try {
      m.load(code)
    } catch (e) {
      sketchError = e instanceof TranspileError ? `line ${e.line}: ${e.message}` : String(e instanceof Error ? e.message : e)
      asm = reduceAssembly(lesson, asm, { type: 'stopped' }).state
      note([{ text: `Upload failed: ${sketchError}`, tone: 'warn', sound: 'click' }])
      return false
    }
    for (const k of Object.keys(mcuPins)) delete mcuPins[Number(k)]
    floatPins()
    held = false
    m.start()
    mcuStart = t
    return true
  }

  function stopSketch(): void {
    gen++
    mcu?.stop()
    floatPins()
  }

  // ── behaviors: contexts ──
  for (const r of resolved) {
    const def = reg[r.id]
    if (!def) {
      warnings.push(`unknown behavior "${r.id}"`)
      continue
    }
    const ctx: BehaviorContext = {
      t: 0,
      solution: null,
      pins: simPins,
      powered: false,
      params: r.params,
      get netlist() {
        return netlist
      },
      v: nodeV,
      publish(key, value) {
        published[`${r.instance}.${key}`] = value
      },
      setParam(elementId, key, value) {
        const k = `${elementId}\u0000${key}`
        if (live[k] === value) return
        live[k] = value
        liveDirty = true
      },
      setMotorLoad(elementId, torque) {
        ctx.setParam(elementId, 'load', torque)
      },
      burn(elementId, reason) {
        const el = netlist.elements.find((e) => e.id === elementId)
        if (!el || asm.burns.some((b) => b.elementId === elementId)) return
        const s = solution()
        const rating = effectiveRating(el)
        const value = reason === 'overpower' ? (s?.power[elementId] ?? 0) : (s?.current[elementId] ?? 0)
        const limit = (reason === 'overpower' ? rating?.maxP : reason === 'overvoltage' ? rating?.maxV : rating?.maxI) ?? 0
        pendingBurns.push({ elementId, partId: el.partId, reason, value, limit, t })
      },
      events: {
        push(e) {
          events.push(e)
          if (events.length > EVENT_KEEP) events.shift()
        },
      },
      mcu: {
        hold() {
          if (held) return
          held = true
          floatPins()
        },
        release() {
          if (!held) return
          held = false
          // the MCU was frozen: carry on from its own time instead of replaying the hold
          if (mcu) mcuStart = t - mcu.timeMs / 1000
          if (mcuLive()) for (const [p, st] of Object.entries(mcuPins)) applyPin(Number(p), st)
        },
        reset() {
          if (mcu && asm.running) startSketch()
        },
        injectEdge(pin, level, tMicros) {
          mcu?.injectEdge(pin, level, tMicros)
        },
        serialIn(text) {
          mcu?.serialIn(text)
        },
        attachI2c(address, device) {
          if (mcu) mcu.attachI2c(address, device as never)
          else pendingI2c.push([address, device])
        },
        attachSpi(csPin, device) {
          if (mcu) mcu.attachSpi(csPin, device as never)
          else pendingSpi.push([csPin, device])
        },
        get timeMicros() {
          return mcu?.timeMicros ?? 0
        },
        get running() {
          return mcuLive()
        },
      },
    }
    instances.push({ def, r, ctx })
  }
  const pendingBurns: BurnEvent[] = []

  // ── actions ──
  function lifecycle(ev: BehaviorLifecycleEvent): void {
    for (const inst of instances) inst.def.onEvent?.(inst.ctx, ev)
  }
  function resetBehaviors(): void {
    for (const inst of instances) inst.def.reset?.(inst.ctx)
  }
  const clearPublished = () => {
    for (const k of Object.keys(published)) delete published[k]
  }

  function act(a: AssemblyAction): Note[] {
    const prev = asm
    const { state, notes } = reduceAssembly(lesson, asm, a)
    asm = state
    if (state === prev) return notes
    const wasOn = isPowered(lesson, prev)
    const isOn = isPowered(lesson, state)
    // everything off (or a fresh board): heat and overload timers start over
    if (a === 'repair' || a === 'strip' || (wasOn && !isOn)) ratings = createRatingState()
    let uploaded = false
    if (prev.running && !state.running) stopSketch()
    else if (state.running && (!prev.running || a === 'upload')) uploaded = startSketch()
    rebuild()
    if (!wasOn && isOn) lifecycle('power-on')
    if (wasOn && !isOn) {
      clearPublished()
      lifecycle('power-off')
    }
    if (uploaded) lifecycle('upload')
    if (typeof a === 'string') {
      if (a.startsWith('break:')) lifecycle('break')
      else if (a === 'repair' || a === 'strip') {
        if (a === 'strip') clearPublished()
        lifecycle(a)
        resetBehaviors()
      }
    }
    return notes
  }

  function dispatch(a: AssemblyAction): Note[] {
    const notes = act(a)
    note(notes)
    emit()
    return notes
  }

  // ── readouts / status ──
  function readValue(r: Readout, s: Solution | null): number {
    const src = r.source
    if (src.kind === 'behavior') return published[src.key] ?? 0
    if (!s) return 0
    let v = 0
    if (src.kind === 'current') v = s.current[src.elementId] ?? 0
    else if (src.kind === 'voltage') v = (s.nodeV[src.node] ?? 0) - (src.ref ? (s.nodeV[src.ref] ?? 0) : 0)
    else if (src.kind === 'power') v = s.power[src.elementId] ?? 0
    else if (src.kind === 'extra') v = s.extra[src.key] ?? 0
    return Math.abs(v) < (r.floor ?? floor(r.unit)) ? 0 : v
  }

  function lineMatches(l: StatusLine, values: number[], status: BenchStatus): boolean {
    const w = l.when
    if (w.kind === 'state') return status === w.is
    if (w.kind === 'above') return (values[w.readout] ?? 0) > w.value
    if (w.kind === 'below') return (values[w.readout] ?? 0) < w.value
    const p = simPins[w.pin]
    return asm.running && !!p && p.mode === 'OUTPUT' && Math.round(p.level) === w.level
  }

  function statusLine(status: BenchStatus, values: number[]): StatusLineView {
    const failure = [...asm.failures].reverse().map((id) => lesson.failures.find((f) => f.id === id)).find(Boolean)
    const burns = asm.burns.filter((b) => !isThermal(b))
    if (burns.length) {
      const text = `FAULT: ${burns.map((b) => describeBurn(lesson, b)).join('; ')}.${failure ? ` ${failure.explain}` : ''}`
      return { text, tone: 'warn' }
    }
    if (failure) return { text: `BROKEN: ${failure.explain}`, tone: 'warn' }
    if (asm.disabled.size) return { text: `WARNING: ${[...asm.disabled].join(', ')} in thermal shutdown; it restarts once it cools.`, tone: 'warn' }
    let text = ''
    for (const l of lesson.statusLines ?? []) if (lineMatches(l, values, status)) text = interpolate(l.text, values)
    if (!text) text = defaultLine(status)
    const tone = /^(FAULT|WARNING|BROKEN)/.test(text) ? 'warn' : status === 'RUNNING' || status === 'POWERED' ? 'ok' : 'info'
    return { text, tone }
  }

  /** `{n}` in a status line becomes readout n, formatted like the status panel */
  function interpolate(text: string, values: number[]): string {
    return text.replace(/\{(\d+)\}/g, (m, i: string) => {
      const r = lesson.readouts[Number(i)]
      return r ? formatSI(values[Number(i)] ?? 0, r.unit, r.digits ?? 3) : m
    })
  }

  function defaultLine(status: BenchStatus): string {
    const bb = lesson.board.base === 'breadboard-only'
    const label = lesson.powerLabel ?? 'Plug USB'
    switch (status) {
      case 'BARE PCB':
        return bb ? 'BARE PCB: an empty bench. Place the parts to build the circuit.' : 'BARE PCB: pads and traces only. Pick & place the SMD parts, then hand-place the rest.'
      case 'ASSEMBLING': {
        const rest = describeParts(remainingParts(lesson, asm))
        const smd = buildParts(lesson).some((p) => p.mount === 'smd' && !asm.placed.has(p.id))
        const todo = [...(smd ? ['SMD parts'] : []), ...(rest ? [rest] : [])]
        return todo.length
          ? `ASSEMBLING: ${asm.placed.size}/${buildParts(lesson).length} parts placed; still to place ${todo.join(', ')}.`
          : 'ASSEMBLING: every part is placed. Solder the joints next.'
      }
      case 'READY':
        return needsSolder(lesson) ? `READY: soldered and checked. ${label} to power it.` : `READY: assembled. ${label} to power it.`
      case 'POWERED':
        return lesson.sketch ? `POWERED: the board has power. Upload ${lesson.sketch.title} to run it.` : 'POWERED: the circuit is live; watch the readouts.'
      case 'RUNNING':
        return `RUNNING: ${lesson.sketch?.title ?? 'the sketch'} is running.`
      default:
        return 'FAULT: something burnt.'
    }
  }

  function partVisible(): Record<string, boolean> {
    const hide = new Set<string>()
    const show = new Set<string>()
    for (const id of asm.failures) {
      const f = lesson.failures.find((x) => x.id === id)
      for (const p of f?.parts?.hide ?? []) hide.add(p)
      for (const p of f?.parts?.show ?? []) show.add(p)
    }
    const out: Record<string, boolean> = {}
    for (const p of lesson.board.parts) {
      out[p.id] = show.has(p.id) ? asm.placed.size > 0 : !p.hidden && asm.placed.has(p.id) && !hide.has(p.id)
    }
    return out
  }

  function snapshot(): BenchSnapshot {
    const s = solution()
    const status = benchStatus(lesson, asm)
    const values = lesson.readouts.map((r) => readValue(r, s))
    const pinWarn = s ? pinWarnings(netlist, s).length > 0 : false
    const tone: ReadoutView['tone'] = status === 'FAULT' || pinWarn ? 'warn' : 'normal'
    const readouts = lesson.readouts.map((r, i) => ({ label: r.label, value: formatSI(values[i], r.unit, r.digits ?? 3), tone }))
    // a dead GPIO pin doesn't char the whole board module: the status line reports it instead
    const charring = asm.burns.filter((b) => !isThermal(b))
    const partBurnt: Record<string, boolean> = {}
    for (const p of lesson.board.parts) {
      partBurnt[p.id] = charring.some(
        (b) => (p.circuitIds?.includes(b.elementId) || b.partId === p.id) && !(b.reason === 'pin-overcurrent' && p.mount === 'module'),
      )
    }
    const elementValues: Record<string, number> = {}
    for (const e of netlist.elements) {
      const rec = e as unknown as Record<string, unknown>
      if (typeof rec.value === 'number') elementValues[`${e.id}.value`] = rec.value
      if (typeof rec.pos === 'number') elementValues[`${e.id}.pos`] = rec.pos
    }
    return {
      t,
      status,
      assembly: {
        placed: [...asm.placed],
        soldered: asm.soldered,
        powered: { ...asm.powered },
        running: asm.running,
        exploded: asm.exploded,
        failures: asm.failures.slice(),
        burns: asm.burns.slice(),
        disabled: [...asm.disabled],
      },
      placedCount: asm.placed.size,
      totalParts: buildParts(lesson).length,
      remaining: remainingParts(lesson, asm).map((p) => ({ id: p.id, label: `${p.id.toUpperCase()} · ${p.label ?? p.kind}` })),
      smdPlaced: !buildParts(lesson).some((p) => p.mount === 'smd' && !asm.placed.has(p.id)),
      allPlaced: buildParts(lesson).every((p) => asm.placed.has(p.id)),
      needsSolder: needsSolder(lesson),
      readyToPower: readyToPower(lesson, asm),
      powered: isPowered(lesson, asm),
      readouts,
      values,
      statusLine: statusLine(status, values),
      pins: Object.fromEntries(Object.entries(simPins).map(([k, v]) => [k, { ...v }])),
      current: s ? { ...s.current } : {},
      extra: s ? { ...s.extra } : {},
      published: { ...published },
      elementValues,
      partBurnt,
      partVisible: partVisible(),
      serial: serial.slice(),
      sketchError,
      warnings: warnings.slice(),
    }
  }

  function emit(): void {
    since = 0
    if (opts.onSnapshot && !disposed) opts.onSnapshot(snapshot())
  }

  // ── frame ──
  function frame(realDt: number): Promise<void> {
    if (disposed || !(isPowered(lesson, asm) || asm.running)) return Promise.resolve()
    const rdt = Math.min(MAX_FRAME, Math.max(0, realDt))
    const simDt = rdt * speed
    const t0 = t
    const subBurns: BurnEvent[] = []
    if (dynamic && sim) {
      const n = lesson.sim?.stepsPerFrame ?? Math.min(Math.ceil(30 * Math.max(1, speed)), Math.ceil(simDt / dt - 1e-9))
      for (let k = 0; k < n; k++) {
        sim.step()
        // a split switching step: µs events (an inductive kick) only exist inside it
        for (const sub of sim.substeps) subBurns.push(...checkRatings(netlist, sub.solution, sub.t, ratings, { instantOnly: true }))
      }
      t = sim.t
      stale = false
      pinsChangedAt = null
      peekCache = null
    } else {
      t += simDt
    }

    // MCU: catch up to sim time, one advance at a time
    let wait: Promise<void> = Promise.resolve()
    if (mcuLive() && !mcuPending) {
      const m = mcu!
      const ms = (t - mcuStart) * 1000 - m.timeMs
      if (ms > 0) {
        const runGen = gen
        const p = m.advance(ms).catch((e: unknown) => {
          if (disposed || runGen !== gen) return
          sketchError = String(e instanceof Error ? e.message : e)
          note(act({ type: 'stopped' }))
        })
        mcuPending = p.finally(() => {
          mcuPending = null
        })
        wait = mcuPending
      }
    } else if (mcuPending) wait = mcuPending

    // behaviors
    const s = solution()
    const pw = mcuPowered(lesson, asm)
    for (const inst of instances) {
      const c = inst.ctx
      c.t = t
      c.solution = s
      c.powered = pw
      inst.def.tick?.(c, t - t0)
    }
    if (liveDirty) {
      liveDirty = false
      rebuild(false)
    }

    // ratings: once per frame, on the latest good solution
    const sol = solution()
    const burns = [...subBurns, ...(sol ? checkRatings(netlist, sol, t, ratings) : [])]
    burns.push(...pendingBurns.splice(0))
    if (burns.length) {
      const notes: Note[] = []
      for (const b of burns) {
        const r = b.reason
        if (r === 'thermal-shutdown') notes.push(...act({ type: 'thermal', elementId: b.elementId, off: true }))
        else if (r === 'thermal-recover') notes.push(...act({ type: 'thermal', elementId: b.elementId, off: false }))
        else notes.push(...act({ type: 'burn', burn: b }))
      }
      note(notes)
      emit()
    } else {
      since += rdt
      if (since >= 1 / hz - 1e-9) emit()
    }
    return wait
  }

  rebuild()
  for (const inst of instances) inst.def.init?.(inst.ctx)
  if (liveDirty) {
    // params a behavior set in init apply from the start, not from the first powered frame
    liveDirty = false
    rebuild(false)
  }

  return {
    lesson,
    get assembly() {
      return asm
    },
    get t() {
      return t
    },
    get code() {
      return code
    },
    dispatch,
    setCode(c) {
      code = c
    },
    upload(c) {
      if (c !== undefined) code = c
      return dispatch('upload')
    },
    setTweak(key, value) {
      tweaks[key] = value
      const m = /^behavior:([^.]+)\.(.+)$/.exec(key)
      if (m) {
        const inst = instances.find((i) => i.r.instance === m[1])
        if (inst) inst.r.params[m[2]] = value
      } else rebuild(false)
      emit()
    },
    tweakValues: () => ({ ...tweaks }),
    setSpeed(x) {
      speed = Math.max(0.001, x)
    },
    serialIn(text) {
      mcu?.serialIn(text)
    },
    frame,
    needsFrames: () => !disposed && (isPowered(lesson, asm) || asm.running),
    snapshot,
    events: () => events,
    mcuTimeMs: () => (mcu ? mcu.timeMs + mcuStart * 1000 : 0),
    dispose() {
      if (disposed) return
      for (const inst of instances) inst.def.dispose?.(inst.ctx)
      disposed = true
      gen++
      mcu?.stop()
    },
  }
}
