// Virtual microcontroller: runs a transpiled sketch against a deterministic virtual clock.
//
// Time only moves inside `advance(ms)`. `delay()` registers a timer; advance resolves timers in
// time order and lets the program run (microtask flush) between them, so results never depend on
// wall-clock time. The clock counts microseconds.
//
// Interrupts: behaviours inject timestamped pin edges (`injectEdge`) and libraries schedule timer
// callbacks (`schedule`). Both sit in one event queue that advance() merges with the sketch's timers
// in time order (an event wins a tie with a timer). An ISR runs to completion at the event's time
// while the main program is parked, or, for an edge that arrives while the sketch is running, at the
// next loop iteration (the loop guard checks `__g.irq`), at the next blocking call, or at interrupts().

import type { BusEvent, BusMonitor, PinMode, PinState, Sketch } from '../types'
import { ARDUINO_CONSTANTS, CHANGE, DEFAULT, ESP32S3_ANALOG, EXTERNAL, TEENSY41_GLOBALS, FALLING, INPUT_PULLUP, INTERNAL, LOW, MSBFIRST, OUTPUT, RISING, SPI_MODE0 } from './constants'
import {
  CharBox,
  FloatBox,
  STRING_METHODS,
  arduinoMap,
  arduinoRound,
  bitClearFn,
  bitSetFn,
  bitWriteFn,
  castInt,
  chr,
  constrain,
  cstr,
  formatPrint,
  i16,
  i32,
  i8,
  makeArray,
  makeRng,
  padArray,
  sizeOf,
  toInt,
  u16,
  u16w,
  u32,
  u8,
} from './runtime'
import { transpile } from './transpile'

export type Board = Sketch['board']

/** An I²C target on the virtual bus (a sensor or driver behaviour). */
export interface I2cDevice {
  /** false: the device does not acknowledge its address right now (bus fault, wrong address jumper); default true */
  ack?(): boolean
  /** bytes the master wrote in one transmission (beginTransmission .. endTransmission) */
  write?(bytes: number[]): void
  /** the master asks for `n` bytes (requestFrom); return up to n */
  read?(n: number): number[]
}

export interface SpiSettingsLike {
  clock: number
  bitOrder: number
  /** 0..3 */
  mode: number
}

/** An SPI device selected by its chip-select pin going LOW. */
export interface SpiDevice {
  /** one full-duplex byte: receives what the master sends, returns the byte it shifts back */
  transfer(byte: number, settings: SpiSettingsLike): number
  /** chip select changed (true = selected, CS low) */
  select?(active: boolean): void
}

export interface VirtualMcuOptions {
  /** supply voltage, volts (5 for Uno, 3.3 for ESP32) */
  vcc: number
  /**
   * 'uno': 16-bit int that wraps, 10-bit ADC, analogReference, interrupts on pins 2 and 3.
   * 'esp32s3': 32-bit int, 12-bit ADC (analogReadResolution), A0..A19 = GPIO1..20, interrupts on every pin.
   * 'teensy41': 32-bit int, 10-bit ADC (analogReadResolution up to 12), no analogReference, analogWriteResolution
   * and analogWriteFrequency (PJRC defaults: 8-bit, FlexPWM 4.482 kHz, QuadTimer 3.611 kHz), A0..A17, F_CPU_ACTUAL.
   * 'generic' (default): unbounded ints, 10-bit ADC, interrupts on every pin (the pre-M1.5 behaviour).
   */
  board?: Board
  /** called whenever the sketch changes a pin (mode, level, servo angle, tone) */
  onPin(pin: number, state: PinState): void
  /** voltage at an analog input, volts. `pin` is the number the sketch used (A0 = 14 on Uno, GPIO on ESP32) */
  readAnalog(pin: number): number
  /** level seen at a digital input (pins that receive injected edges use the injected level instead) */
  readDigital(pin: number): 0 | 1
  /** voltage on AREF, for analogReference(EXTERNAL). Defaults to vcc. */
  readAref?(): number
  /** one complete line of Serial output */
  serial(line: string): void
  /** objects / classes exposed to sketches (behaviour libraries). Classes become usable types. */
  libraries?: Record<string, unknown>
  /** diagnostics (transpiler warnings, runtime errors, the no-delay loop notice). Defaults to Serial. */
  warn?(message: string): void
  /** loop() iterations per virtual second when loop() never waits (default 20000) */
  maxLoopsPerSecond?: number
  /** analogWrite PWM frequency, Hz, for every pin (default: the board's, see pwmHzFor) */
  pwmFreq?: number
}

/** Teensy 4.1 pins on QuadTimers (PJRC td_pulse: default 3.611 kHz); the other PWM pins are FlexPWM (4.482 kHz) */
const TEENSY41_QUADTIMER_PINS = new Set([10, 11, 12, 13, 14, 15, 18, 19])
/** Teensy 4.1 PWM pins that share a FlexPWM timer, so analogWriteFrequency moves them together (PJRC td_pulse) */
const TEENSY41_TIMER_GROUPS: readonly number[][] = [
  [1, 44, 45],
  [0, 42, 43],
  [24, 46, 47],
  [7, 8, 25],
  [4, 33],
  [6, 9],
  [36, 37],
  [2, 3],
]

/** analogWrite frequency of a pin: Uno 490 Hz (pins 5 and 6 on timer 0: 980 Hz), ESP32-S3 1 kHz, Teensy 4.1 4.482 / 3.611 kHz */
export function pwmHzFor(board: Board, pin: number): number {
  if (board === 'teensy41') return TEENSY41_QUADTIMER_PINS.has(pin) ? 3611 : 4482
  if (board === 'esp32s3') return 1000
  if (board === 'uno' && (pin === 5 || pin === 6)) return 980
  return 490
}

interface Timer {
  /** virtual time, µs */
  at: number
  seq: number
  resolve: () => void
}

type IsrFn = () => unknown

interface QueuedEvent {
  at: number
  seq: number
  kind: 'edge' | 'isr' | 'sys'
  pin: number
  level: 0 | 1
  fn: IsrFn | null
}

/** Min-heap of events ordered by (at, seq). */
class EventQueue {
  private h: QueuedEvent[] = []
  get size(): number {
    return this.h.length
  }
  clear(): void {
    this.h = []
  }
  peek(): QueuedEvent | undefined {
    return this.h[0]
  }
  private less(a: QueuedEvent, b: QueuedEvent): boolean {
    return a.at < b.at || (a.at === b.at && a.seq < b.seq)
  }
  push(e: QueuedEvent): void {
    const h = this.h
    h.push(e)
    let i = h.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (!this.less(h[i], h[p])) break
      ;[h[i], h[p]] = [h[p], h[i]]
      i = p
    }
  }
  pop(): QueuedEvent | undefined {
    const h = this.h
    const top = h[0]
    const last = h.pop()
    if (h.length && last) {
      h[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < h.length && this.less(h[l], h[m])) m = l
        if (r < h.length && this.less(h[r], h[m])) m = r
        if (m === i) break
        ;[h[i], h[m]] = [h[m], h[i]]
        i = m
      }
    }
    return top
  }
}

interface Program {
  setup: (() => Promise<void>) | null
  loop: (() => Promise<void>) | null
}

interface Guard {
  n: number
  limit: number
  /** true when an interrupt is pending and may run now */
  irq: boolean
  pause: () => Promise<void>
}

interface PendingIrq {
  pin: number
  fn: IsrFn | null
  /** pin level right after the edge that raised the request, and when it happened (µs) */
  level: 0 | 1
  t: number
}

/** The sandbox function body is PREFIX + js, so js line 1 sits at a fixed offset in stack traces. */
const PREFIX = '"use strict";\nreturn (async () => {\n'
let probeLine: Promise<number | null> | null = null

/** Stack-trace line at which js line 1 appears, found by running a one-line probe. */
function probeFirstLine(): Promise<number | null> {
  probeLine ??= (async () => {
    try {
      await (new Function(PREFIX + 'throw new Error("probe");\n})()') as () => Promise<void>)()
    } catch (e) {
      const m = /<anonymous>:(\d+):\d+/.exec(e instanceof Error ? (e.stack ?? '') : '')
      return m ? Number(m[1]) : null
    }
    return null
  })()
  return probeLine
}

async function lineOfError(e: unknown): Promise<number | null> {
  const m = /<anonymous>:(\d+):\d+/.exec(e instanceof Error ? (e.stack ?? '') : '')
  const base = await probeFirstLine()
  if (!m || base === null) return null
  const line = Number(m[1]) - base + 1
  return line >= 1 ? line : null
}

/** A function value that can be constructed (a class, or an old-style constructor with prototype methods). */
function isClass(v: unknown): boolean {
  if (typeof v !== 'function') return false
  if (/^class[\s{]/.test(Function.prototype.toString.call(v))) return true
  const proto = (v as { prototype?: object }).prototype
  return proto !== undefined && Object.getOwnPropertyNames(proto).length > 1
}

const STATEMENT_LIMIT = 1e6
const SERIAL_RING = 1000
/** pulseIn() polls a pin that has no injected edges every max(PULSE_POLL_US, timeout / PULSE_POLLS) µs */
const PULSE_POLL_US = 10
const PULSE_POLLS = 1000
const NEVER = new Promise<never>(() => undefined)
const SHADOWED_GLOBALS = ['window', 'document', 'globalThis', 'self', 'fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'process', 'require', 'Function']

export class VirtualMcu {
  private readonly opts: VirtualMcuOptions
  private readonly board: Board
  private readonly perMs: number
  private js: string | null = null

  /** virtual time, µs */
  private now = 0
  private timers: Timer[] = []
  private seq = 0
  private waits = 0
  private gen = 0
  private running = false
  private finished = false
  private warnedLoop = false
  private warnedIsrDelay = false
  private chain: Promise<void> = Promise.resolve()

  private pins = new Map<number, PinState>()
  private latch = new Map<number, number>()
  private rng = makeRng(1)
  private serialBuf = ''
  private rx: number[] = []
  private guard: Guard

  // interrupts
  private events = new EventQueue()
  private irqs = new Map<number, { fn: IsrFn; mode: number }>()
  private pending: PendingIrq[] = []
  private pendingPins = new Set<number>()
  private irqEnabled = true
  private inIsr = false
  /** while a pin's ISR runs: that pin reads the level of the edge that raised it (even if serviced late) */
  private isrPin = -1
  private isrLevel: 0 | 1 = 0
  /** pins driven by injectEdge: their level comes from the injected edges */
  private injected = new Set<number>()
  private injLevel = new Map<number, 0 | 1>()
  /** last level seen by the edge detector on interrupt pins without injected edges (polled or self-driven) */
  private irqLevel = new Map<number, 0 | 1>()
  /** the main program is parked in pulseIn() waiting for this pin */
  private pinWait: { pin: number; timer: Timer } | null = null
  private woke = false

  // analog
  private adcBits = 10
  private aref = DEFAULT
  /** analogWrite resolution, bits (teensy41: analogWriteResolution) */
  private pwmBits = 8
  /** per-pin analogWriteFrequency overrides, Hz (teensy41) */
  private pwmHzSet = new Map<number, number>()

  // buses
  private readonly i2c = new Map<number, I2cDevice>()
  private readonly spi = new Map<number, SpiDevice>()
  private csActive = new Map<number, boolean>()
  /** logic-analyzer taps (they stay across start()) */
  private readonly monitors: BusMonitor[] = []
  /** Serial.begin baud, Wire.setClock Hz (bus monitors report them) */
  private uartBaud = 9600
  private i2cClock = 100000
  private toneGen = new Map<number, number>()

  /** diagnostics emitted so far */
  readonly warnings: string[] = []
  /** the most recent Serial lines (ring buffer) */
  readonly serialLines: string[] = []

  constructor(opts: VirtualMcuOptions) {
    this.opts = opts
    this.board = opts.board ?? 'generic'
    this.perMs = Math.max(1, Math.round((opts.maxLoopsPerSecond ?? 20000) / 1000))
    this.guard = { n: 0, limit: STATEMENT_LIMIT, irq: false, pause: () => this.guardPause() }
  }

  /** virtual time, milliseconds (fractional below 1 ms) */
  get timeMs(): number {
    return this.now / 1000
  }

  /** virtual time, microseconds */
  get timeMicros(): number {
    return this.now
  }

  get isRunning(): boolean {
    return this.running
  }

  /** Transpile a sketch. Throws TranspileError. Stops any program that was running. */
  load(src: string): void {
    this.stop()
    const libs = this.opts.libraries ?? {}
    const classTypes = Object.entries(libs)
      .filter(([, v]) => isClass(v))
      .map(([k]) => k)
    const { js, warnings } = transpile(src, {
      classTypes,
      knownLibraries: Object.keys(libs),
      intBits: this.board === 'uno' ? 16 : this.board === 'esp32s3' || this.board === 'teensy41' ? 32 : undefined,
      extraGlobals: this.board === 'esp32s3' ? Object.keys(ESP32S3_ANALOG) : this.board === 'teensy41' ? Object.keys(TEENSY41_GLOBALS) : [],
    })
    this.js = js
    for (const w of warnings) this.warn(w)
  }

  /** (Re)start the loaded sketch from time zero: runs setup() once, then loop() repeatedly. */
  start(): void {
    if (this.js === null) throw new Error('VirtualMcu.start(): call load() first')
    this.stop()
    this.gen++
    this.now = 0
    this.timers = []
    this.seq = 0
    this.waits = 0
    this.pins.clear()
    this.latch.clear()
    this.rng = makeRng(1)
    this.serialBuf = ''
    this.rx = []
    this.guard.n = 0
    this.guard.irq = false
    this.warnedLoop = false
    this.warnedIsrDelay = false
    this.events.clear()
    this.irqs.clear()
    this.pending = []
    this.pendingPins.clear()
    this.irqEnabled = true
    this.inIsr = false
    this.injected.clear()
    this.injLevel.clear()
    this.irqLevel.clear()
    this.pinWait = null
    this.woke = false
    this.adcBits = this.board === 'esp32s3' ? 12 : 10
    this.aref = DEFAULT
    this.pwmBits = 8
    this.pwmHzSet.clear()
    this.csActive.clear()
    this.uartBaud = 9600
    this.i2cClock = 100000
    this.toneGen.clear()
    this.finished = false
    this.running = true
    const gen = this.gen

    const api = this.buildApi()
    const names = Object.keys(api)
    let loaded: Promise<Program>
    try {
      const body =
        PREFIX +
        this.js +
        '\nreturn { setup: typeof setup === "function" ? setup : null, loop: typeof loop === "function" ? loop : null };\n})()'
      const factory = new Function(...names, ...SHADOWED_GLOBALS, body) as (...args: unknown[]) => Promise<Program>
      loaded = factory(...names.map((n) => api[n]), ...SHADOWED_GLOBALS.map(() => undefined))
    } catch (e) {
      loaded = Promise.reject(e)
    }
    void this.runProgram(gen, loaded)
  }

  /** Names the sandbox provides to sketches. */
  apiNames(): string[] {
    return Object.keys(this.buildApi())
  }

  stop(): void {
    if (this.serialBuf) {
      this.pushLine(this.serialBuf)
      this.serialBuf = ''
    }
    this.running = false
    this.gen++
    this.timers = []
    this.events.clear()
    this.pending = []
    this.pendingPins.clear()
    this.pinWait = null
    this.guard.irq = false
  }

  /**
   * Run the program until virtual time has advanced by `ms`. Await each call before making the next.
   * Resolves once the program is parked on its next delay at (or after) the new time.
   * `keepBudget`: this advance continues the previous one's loop-guard statement budget instead of
   * starting a fresh one (a host that advances one frame in several small chunks passes it for every
   * chunk after the first, so a loop that never waits is bounded per frame, not per chunk).
   */
  advance(ms: number, opts?: { keepBudget?: boolean }): Promise<void> {
    const keep = !!opts?.keepBudget
    const next = this.chain.then(() => this.doAdvance(ms, keep))
    this.chain = next.catch(() => undefined)
    return next
  }

  // ── inputs from behaviours and the UI ──

  /**
   * A level change on an input pin at virtual time `tMicros` (µs since start()). Edges in the past or at the current
   * time apply at once; later ones are queued. The pin then reads the injected level, and an attached interrupt fires
   * when the change matches its mode.
   */
  injectEdge(pin: number, level: number | boolean, tMicros: number): void {
    if (!this.running) return
    const p = Math.trunc(pin)
    const lv: 0 | 1 = Number(level) >= 0.5 ? 1 : 0
    this.injected.add(p)
    if (!(tMicros > this.now)) {
      this.applyEdge(p, lv)
      return
    }
    this.events.push({ at: tMicros, seq: this.seq++, kind: 'edge', pin: p, level: lv, fn: null })
  }

  /**
   * Run `fn` as an interrupt handler at virtual time `tMicros` (for timer libraries such as TimerOne). It respects
   * noInterrupts() like a hardware interrupt. A returned promise (a sketch function) is awaited.
   */
  schedule(tMicros: number, fn: () => unknown): void {
    if (!this.running) return
    if (!(tMicros > this.now)) this.raiseFn(fn)
    else this.events.push({ at: tMicros, seq: this.seq++, kind: 'isr', pin: -1, level: 0, fn })
  }

  /** Text typed into the serial monitor: queued for Serial.available() / read(). */
  serialIn(text: string): void {
    for (const ch of text) this.rx.push(ch.charCodeAt(0) & 0xff)
  }

  /** Attach an I²C target at a 7-bit address (stays attached across start()). */
  attachI2c(address: number, device: I2cDevice): void {
    this.i2c.set(Math.trunc(address) & 0x7f, device)
  }

  detachI2c(address: number): void {
    this.i2c.delete(Math.trunc(address) & 0x7f)
  }

  /** Attach an SPI device selected by `csPin` going LOW (stays attached across start()). */
  attachSpi(csPin: number, device: SpiDevice): void {
    this.spi.set(Math.trunc(csPin), device)
  }

  detachSpi(csPin: number): void {
    this.spi.delete(Math.trunc(csPin))
  }

  /** Listen to the sketch's Serial, Wire and SPI activity (a logic analyzer). Stays across start(). */
  addBusMonitor(m: BusMonitor): void {
    if (!this.monitors.includes(m)) this.monitors.push(m)
  }

  removeBusMonitor(m: BusMonitor): void {
    const k = this.monitors.indexOf(m)
    if (k >= 0) this.monitors.splice(k, 1)
  }

  private busEvent(ev: BusEvent): void {
    for (const m of this.monitors) m.event?.(ev)
  }

  /** every monitor lets this I²C address through (none vetoes it as a mangled bus) */
  private i2cLineOk(addr: number, read: boolean): boolean {
    for (const m of this.monitors) if (m.i2cOk && !m.i2cOk(addr, read, this.i2cClock)) return false
    return true
  }

  /** bytes leaving the UART (what a probe on TX sees), at the begin() baud */
  private uartOut(text: string): void {
    if (!this.monitors.length || !text) return
    const bytes: number[] = []
    for (let k = 0; k < text.length; k++) bytes.push(text.charCodeAt(k) & 0xff)
    this.busEvent({ bus: 'uart', t: this.now, baud: this.uartBaud, bytes })
  }

  // ── scheduler ──

  private alive(gen: number): boolean {
    return this.running && gen === this.gen
  }

  private async doAdvance(ms: number, keepBudget = false): Promise<void> {
    if (!this.running) return
    const gen = this.gen
    const target = this.now + ms * 1000
    // The statement budget for the loop guard is per advance() call (or per run of keepBudget calls): a
    // loop that never waits gets STATEMENT_LIMIT iterations, then is paused 1 ms per iteration after that.
    if (!keepBudget) this.guard.n = 0
    await this.settle()
    if (!this.alive(gen)) return
    this.pollInterruptPins()
    for (;;) {
      if (!this.alive(gen)) return
      if (this.irqReady()) {
        await this.serviceIrq()
        if (this.woke) await this.settle()
        continue
      }
      let idx = -1
      for (let k = 0; k < this.timers.length; k++) {
        const t = this.timers[k]
        if (idx < 0 || t.at < this.timers[idx].at || (t.at === this.timers[idx].at && t.seq < this.timers[idx].seq)) idx = k
      }
      const tAt = idx >= 0 ? this.timers[idx].at : Infinity
      const ev = this.events.peek()
      const eAt = ev ? ev.at : Infinity
      if (Math.min(tAt, eAt) > target) break
      if (eAt <= tAt) {
        if (eAt > this.now) this.now = eAt
        // apply every event at this instant before any ISR runs (simultaneous edges are seen together)
        while (this.events.peek()?.at === eAt) this.runEvent(this.events.pop() as QueuedEvent)
        if (this.woke) await this.settle()
        continue
      }
      const [t] = this.timers.splice(idx, 1)
      if (this.pinWait?.timer === t) this.pinWait = null
      if (t.at > this.now) this.now = t.at
      t.resolve()
      await this.settle()
    }
    if (this.alive(gen) && this.now < target) this.now = target
  }

  /** Let the program run until it parks on a timer (or ends). Pure microtask hops, no wall clock. */
  private async settle(): Promise<void> {
    this.woke = false
    for (let round = 0; round < 20; round++) {
      for (let hop = 0; hop < 50000; hop++) {
        if (this.timers.length > 0 || this.finished || !this.running) return
        await Promise.resolve()
      }
      await new Promise<void>((r) => setTimeout(r, 0)) // something is genuinely asynchronous
    }
    this.warn('the sketch stopped responding')
    this.finished = true
  }

  private sleep(us: number): Promise<void> {
    if (this.inIsr) {
      if (!this.warnedIsrDelay) {
        this.warnedIsrDelay = true
        this.warn('delay() inside an interrupt handler does not wait (time stands still in an ISR)')
      }
      return Promise.resolve()
    }
    this.waits++
    return new Promise<void>((resolve) => {
      this.timers.push({ at: this.now + us, seq: this.seq++, resolve })
    })
  }

  /** Park the main program until `pin` changes (injected edge) or virtual time reaches `untilUs`. */
  private waitPin(pin: number, untilUs: number): Promise<void> {
    this.waits++
    return new Promise<void>((resolve) => {
      const timer = { at: untilUs, seq: this.seq++, resolve }
      this.timers.push(timer)
      this.pinWait = { pin, timer }
    })
  }

  private loopPause(): Promise<void> {
    if (!this.warnedLoop) {
      this.warnedLoop = true
      this.warn('loop() never waits — added an implicit 1 ms pause')
    }
    return this.sleep(1000)
  }

  /** Called by the loop guard: run pending ISRs, then pause a loop that has run too long without waiting. */
  private async guardPause(): Promise<void> {
    if (this.irqReady()) await this.serviceIrq()
    if (this.guard.n > this.guard.limit) {
      if (this.inIsr) throw new Error('an interrupt handler never returns (endless loop in the ISR)')
      await this.loopPause()
    }
  }

  private async runProgram(gen: number, loaded: Promise<Program>): Promise<void> {
    try {
      const prog = await loaded
      if (gen !== this.gen) return
      if (prog.setup) await prog.setup()
      if (prog.loop) {
        let idle = 0
        while (gen === this.gen) {
          const w0 = this.waits
          await prog.loop()
          if (gen !== this.gen) return
          if (this.waits !== w0) {
            idle = 0
          } else if (++idle >= this.perMs) {
            // a loop() that never waits still takes time on a real chip
            idle = 0
            await this.sleep(1000)
          }
        }
      }
    } catch (e) {
      if (gen === this.gen) {
        const line = await lineOfError(e)
        this.warn(`runtime error${line ? ` on line ${line}` : ''}: ${e instanceof Error ? e.message : String(e)}`)
      }
    } finally {
      if (gen === this.gen) this.finished = true
    }
  }

  // ── interrupts ──

  private irqReady(): boolean {
    return this.irqEnabled && !this.inIsr && this.pending.length > 0
  }

  private refreshIrq(): void {
    this.guard.irq = this.irqReady()
  }

  private runEvent(e: QueuedEvent): void {
    if (e.kind === 'edge') this.applyEdge(e.pin, e.level)
    else if (e.kind === 'isr') this.raiseFn(e.fn as IsrFn)
    else (e.fn as IsrFn)()
  }

  /** Level of a pin as the edge detector sees it before an injected change. */
  private rawLevel(pin: number): 0 | 1 {
    const inj = this.injLevel.get(pin)
    if (inj !== undefined) return inj
    const st = this.pins.get(pin)
    if (st && st.mode === 'OUTPUT') return st.level >= 0.5 ? 1 : 0
    return this.opts.readDigital(pin) ? 1 : 0
  }

  private applyEdge(pin: number, level: 0 | 1): void {
    const prev = this.rawLevel(pin)
    this.injLevel.set(pin, level)
    if (prev === level) return
    const w = this.pinWait
    if (w && w.pin === pin) {
      this.pinWait = null
      const k = this.timers.indexOf(w.timer)
      if (k >= 0) this.timers.splice(k, 1)
      this.woke = true
      w.timer.resolve()
    }
    this.detectIrq(pin, prev, level)
  }

  /** Edge detector for interrupt pins that get no injected edges (simulated level, or the sketch driving the pin). */
  private sense(pin: number, level: 0 | 1): void {
    const prev = this.irqLevel.get(pin)
    this.irqLevel.set(pin, level)
    if (prev !== undefined && prev !== level) this.detectIrq(pin, prev, level)
  }

  private detectIrq(pin: number, prev: 0 | 1, level: 0 | 1): void {
    const irq = this.irqs.get(pin)
    if (!irq) return
    const m = irq.mode
    const hit = m === CHANGE || (m === RISING && prev === 0 && level === 1) || ((m === FALLING || m === LOW) && prev === 1 && level === 0)
    if (!hit || this.pendingPins.has(pin)) return // like an AVR flag, one pending request per interrupt
    this.pendingPins.add(pin)
    this.pending.push({ pin, fn: null, level, t: this.now })
    this.refreshIrq()
  }

  private raiseFn(fn: IsrFn): void {
    this.pending.push({ pin: -1, fn, level: 0, t: this.now })
    this.refreshIrq()
  }

  private pollInterruptPins(): void {
    for (const pin of this.irqs.keys()) {
      if (this.injected.has(pin) || this.pins.get(pin)?.mode === 'OUTPUT') continue
      this.sense(pin, this.opts.readDigital(pin) ? 1 : 0)
    }
  }

  /** Run every pending ISR to completion (interrupts are off inside an ISR, so they never nest). */
  private async serviceIrq(): Promise<void> {
    if (!this.irqReady()) return
    const gen = this.gen
    const savedN = this.guard.n
    this.inIsr = true
    this.refreshIrq()
    try {
      while (this.pending.length && gen === this.gen) {
        const e = this.pending.shift() as PendingIrq
        let fn = e.fn
        if (e.pin >= 0) {
          this.pendingPins.delete(e.pin)
          fn = this.irqs.get(e.pin)?.fn ?? null
        }
        if (typeof fn !== 'function') continue
        this.guard.n = 0
        this.isrPin = e.pin
        this.isrLevel = e.level
        try {
          await fn()
        } finally {
          this.isrPin = -1
        }
      }
    } catch (err) {
      if (gen === this.gen) {
        const line = await lineOfError(err)
        this.warn(`runtime error in an interrupt handler${line ? ` on line ${line}` : ''}: ${err instanceof Error ? err.message : String(err)}`)
        this.stop()
      }
    } finally {
      if (gen === this.gen) {
        this.inIsr = false
        this.guard.n = savedN
        this.refreshIrq()
      }
    }
  }

  /** Interrupt number -> pin. Uno: INT0 = pin 2, INT1 = pin 3. ESP32 and generic: every pin is its own interrupt. */
  private interruptPin(n: number): number {
    if (this.board === 'uno') return n === 0 ? 2 : n === 1 ? 3 : -1
    return n >= 0 ? n : -1
  }

  private digitalPinToInterrupt(pin: number): number {
    if (this.board === 'uno') return pin === 2 ? 0 : pin === 3 ? 1 : -1
    return pin
  }

  private attachInterrupt(n: number, fn: unknown, mode: number): void {
    const pin = this.interruptPin(Math.trunc(n))
    if (pin < 0) {
      this.warn(
        this.board === 'uno'
          ? `attachInterrupt(${n}, ...): the Uno has external interrupts 0 (pin 2) and 1 (pin 3) only - use digitalPinToInterrupt(pin)`
          : `attachInterrupt(${n}, ...): not an interrupt`,
      )
      return
    }
    if (typeof fn !== 'function') {
      this.warn('attachInterrupt(): the second argument must be the name of a function')
      return
    }
    this.irqs.set(pin, { fn: fn as IsrFn, mode: Math.trunc(mode) })
    if (!this.injected.has(pin)) this.irqLevel.set(pin, this.rawLevel(pin))
  }

  private detachInterrupt(n: number): void {
    const pin = this.interruptPin(Math.trunc(n))
    this.irqs.delete(pin)
    if (this.pendingPins.delete(pin)) this.pending = this.pending.filter((e) => e.pin !== pin)
    this.refreshIrq()
  }

  private async interrupts(): Promise<void> {
    this.irqEnabled = true
    this.refreshIrq()
    await this.serviceIrq()
  }

  private noInterrupts(): void {
    this.irqEnabled = false
    this.refreshIrq()
  }

  /** pulseIn(pin, level, timeout): length in µs of the next pulse at `level`, or 0 on timeout. Virtual time passes. */
  private async pulseIn(pin: number, state: unknown, timeout: number): Promise<number> {
    if (this.inIsr) return 0
    const want = state ? 1 : 0
    const deadline = this.now + timeout
    const poll = Math.max(PULSE_POLL_US, timeout / PULSE_POLLS)
    const read = () => this.digitalRead(pin)
    const wait = async (): Promise<boolean> => {
      if (this.now >= deadline) return false
      await this.waitPin(pin, this.injected.has(pin) ? deadline : Math.min(deadline, this.now + poll))
      return true
    }
    while (read() === want) if (!(await wait())) return 0 // a pulse already in progress does not count
    while (read() !== want) if (!(await wait())) return 0
    const t0 = this.now
    while (read() === want) if (!(await wait())) return 0
    return Math.round(this.now - t0)
  }

  // ── output ──

  private warn(message: string): void {
    this.warnings.push(message)
    if (this.opts.warn) this.opts.warn(message)
    else this.pushLine(`[mcu] ${message}`)
  }

  private pushLine(line: string): void {
    this.serialLines.push(line)
    if (this.serialLines.length > SERIAL_RING) this.serialLines.shift()
    this.opts.serial(line)
  }

  private serialWrite(text: string, newline: boolean): void {
    this.serialBuf += text
    if (newline) this.serialBuf += '\n'
    let nl: number
    while ((nl = this.serialBuf.indexOf('\n')) >= 0) {
      this.pushLine(this.serialBuf.slice(0, nl).replace(/\r$/, ''))
      this.serialBuf = this.serialBuf.slice(nl + 1)
    }
  }

  // ── pins ──

  private notify(pin: number, state: PinState): void {
    this.pins.set(pin, state)
    this.opts.onPin(pin, { ...state })
    const dev = this.spi.get(pin)
    if (dev) {
      const active = state.mode === 'OUTPUT' && state.level < 0.5
      if (active !== (this.csActive.get(pin) ?? false)) {
        this.csActive.set(pin, active)
        dev.select?.(active)
      }
    }
    // a pin that drives itself still triggers its own interrupt (the AVR "software interrupt" trick)
    if (state.mode === 'OUTPUT' && this.irqs.has(pin) && !this.injected.has(pin)) this.sense(pin, state.level >= 0.5 ? 1 : 0)
  }

  private pinMode(pin: number, mode: number): void {
    const m: PinMode = mode === OUTPUT ? 'OUTPUT' : mode === INPUT_PULLUP ? 'INPUT_PULLUP' : 'INPUT'
    const level = m === 'INPUT_PULLUP' ? 1 : m === 'OUTPUT' ? (this.latch.get(pin) ?? 0) : 0
    this.notify(pin, { mode: m, level })
  }

  private digitalWrite(pin: number, value: number): void {
    const v = value ? 1 : 0
    this.latch.set(pin, v)
    const st = this.pins.get(pin)
    if (!st || st.mode === 'OUTPUT') this.notify(pin, { mode: 'OUTPUT', level: v })
    else this.notify(pin, { mode: v ? 'INPUT_PULLUP' : 'INPUT', level: v }) // AVR: writing HIGH to an input enables the pull-up
  }

  private analogWrite(pin: number, value: number): void {
    const max = 2 ** this.pwmBits - 1
    const level = constrain(Math.trunc(Number(value) || 0), 0, max) / max
    this.latch.set(pin, level > 0 ? 1 : 0)
    this.notify(pin, { mode: 'OUTPUT', level, pwmHz: this.pwmHzSet.get(pin) ?? this.opts.pwmFreq ?? pwmHzFor(this.board, pin) })
  }

  /** Teensy: analogWrite's range becomes 0..2^bits - 1 (PJRC's table covers 2..15 bits; default 8) */
  private analogWriteResolution(bits: number): void {
    if (this.board !== 'teensy41') {
      this.warn('analogWriteResolution() is not modelled on this board - it is ignored (analogWrite stays 0..255)')
      return
    }
    this.pwmBits = constrain(Math.trunc(bits), 2, 15)
  }

  /** Teensy: PWM frequency of a pin and of every pin on the same timer */
  private analogWriteFrequency(pin: number, hz: number): void {
    if (this.board !== 'teensy41') {
      this.warn('analogWriteFrequency() is a Teensy function - it is ignored on this board')
      return
    }
    const f = Number(hz)
    if (!(f > 0)) return
    const group = TEENSY41_TIMER_GROUPS.find((g) => g.includes(pin)) ?? [pin]
    for (const p of group) this.pwmHzSet.set(p, f)
  }

  private digitalRead(pin: number): number {
    const st = this.pins.get(pin)
    if (st && st.mode === 'OUTPUT') return st.level >= 0.5 ? 1 : 0
    if (pin === this.isrPin) return this.isrLevel
    const inj = this.injLevel.get(pin)
    if (inj !== undefined) return inj
    return this.opts.readDigital(pin) ? 1 : 0
  }

  private analogRead(pin: number): number {
    const v = this.opts.readAnalog(pin)
    const max = 2 ** this.adcBits - 1
    let ref = this.opts.vcc
    if (this.board !== 'esp32s3' && this.board !== 'teensy41') {
      if (this.aref === INTERNAL) ref = 1.1
      else if (this.aref === EXTERNAL) ref = this.opts.readAref ? this.opts.readAref() : this.opts.vcc
    }
    if (!(ref > 0)) return max
    // datasheet transfer: code = floor(V · 2^bits / Vref), clamped (2.50 V of 5 V is 512, not 511)
    return constrain(Math.floor((v / ref) * (max + 1)), 0, max)
  }

  private analogReference(mode: number): void {
    if (this.board === 'esp32s3') {
      this.warn('analogReference() does not exist on the ESP32 - it is ignored')
      return
    }
    if (this.board === 'teensy41') {
      this.warn('analogReference() has no effect on the Teensy 4.x: the analog range is fixed at 0-3.3 V')
      return
    }
    this.aref = Math.trunc(mode)
  }

  private analogReadResolution(bits: number): void {
    if (this.board === 'uno') {
      this.warn('analogReadResolution() is not available on the Uno (its ADC is 10-bit) - it is ignored')
      return
    }
    if (this.board === 'teensy41' && Math.trunc(bits) > 12) {
      this.warn(`analogReadResolution(${bits}): the Teensy 4.x ADC is 12-bit at most - using 12`)
      this.adcBits = 12
      return
    }
    this.adcBits = constrain(Math.trunc(bits), 1, 16)
  }

  private tone(pin: number, freq: number, durationMs?: number): void {
    const f = Math.max(0, Number(freq) || 0)
    const token = (this.toneGen.get(pin) ?? 0) + 1
    this.toneGen.set(pin, token)
    this.latch.set(pin, 0)
    this.notify(pin, { mode: 'OUTPUT', level: 0.5, toneHz: f })
    if (durationMs !== undefined && Number(durationMs) > 0) {
      this.events.push({
        at: this.now + Number(durationMs) * 1000,
        seq: this.seq++,
        kind: 'sys',
        pin,
        level: 0,
        fn: () => {
          if (this.toneGen.get(pin) === token) this.noTone(pin)
        },
      })
    }
  }

  private noTone(pin: number): void {
    this.toneGen.set(pin, (this.toneGen.get(pin) ?? 0) + 1)
    this.latch.set(pin, 0)
    this.notify(pin, { mode: 'OUTPUT', level: 0 })
  }

  // ── sandbox API ──

  private buildApi(): Record<string, unknown> {
    const mcu = this
    const gen = this.gen
    const alive = () => gen === mcu.gen

    class Servo {
      private pin = -1
      private deg = 0
      private warned = false
      attach(pin: number): number {
        this.pin = Math.trunc(pin)
        return 1
      }
      detach(): void {
        this.pin = -1
      }
      attached(): boolean {
        return this.pin >= 0
      }
      write(value: number): void {
        const v = Number(value)
        if (v >= 544) return this.writeMicroseconds(v)
        this.set(constrain(Math.round(v), 0, 180))
      }
      writeMicroseconds(us: number): void {
        this.set(constrain(((Number(us) - 544) * 180) / (2400 - 544), 0, 180))
      }
      read(): number {
        return Math.round(this.deg)
      }
      private set(deg: number): void {
        if (this.pin < 0) {
          if (!this.warned) {
            this.warned = true
            mcu.warn('Servo.write() was called before attach() — the servo will not move')
          }
          return
        }
        this.deg = deg
        if (alive()) mcu.notify(this.pin, { mode: 'OUTPUT', level: deg / 180, servoDeg: deg })
      }
    }

    // ── Serial (input comes from serialIn) ──
    const rx = () => mcu.rx
    const readUntil = (stop: (c: number) => boolean): string => {
      let s = ''
      while (rx().length) {
        const c = rx().shift() as number
        if (stop(c)) break
        s += String.fromCharCode(c)
      }
      return s
    }
    const parseNumber = (float: boolean): number => {
      const q = rx()
      const isDigit = (c: number) => c >= 48 && c <= 57
      while (q.length && !isDigit(q[0]) && q[0] !== 45 && !(float && q[0] === 46)) q.shift()
      let s = ''
      if (q[0] === 45) s += String.fromCharCode(q.shift() as number)
      let dot = false
      while (q.length && (isDigit(q[0]) || (float && q[0] === 46 && !dot))) {
        if (q[0] === 46) dot = true
        s += String.fromCharCode(q.shift() as number)
      }
      const n = float ? parseFloat(s) : parseInt(s, 10)
      return Number.isFinite(n) ? n : 0
    }
    const serial = {
      begin: (baud?: unknown) => {
        const b = Number(baud)
        if (Number.isFinite(b) && b > 0) mcu.uartBaud = b
      },
      end: () => undefined,
      flush: () => undefined,
      setTimeout: () => undefined,
      available: () => rx().length,
      read: () => (rx().length ? (rx().shift() as number) : -1),
      peek: () => (rx().length ? rx()[0] : -1),
      readString: () => readUntil(() => false),
      readStringUntil: (term: unknown) => {
        const t = typeof term === 'string' ? term.charCodeAt(0) : Number(term)
        return readUntil((c) => c === t)
      },
      parseInt: () => parseNumber(false),
      parseFloat: () => parseNumber(true),
      print: (v: unknown, fmt?: number) => {
        const text = formatPrint(v, fmt)
        mcu.uartOut(text)
        mcu.serialWrite(text, false)
      },
      println: (...args: unknown[]) => {
        const text = args.length ? formatPrint(args[0], args[1] as number | undefined) : ''
        mcu.uartOut(text + '\r\n') // Arduino's println ends with CR LF on the wire
        mcu.serialWrite(text, true)
      },
      write: (v: unknown) => {
        const text = typeof v === 'number' ? String.fromCharCode(v) : String(v)
        mcu.uartOut(text)
        mcu.serialWrite(text, false)
      },
    }

    // ── Wire: I²C master, delegating to attached devices ──
    let txAddr = -1
    let txBuf: number[] = []
    let rxBuf: number[] = []
    const bytesOf = (v: unknown, n?: number): number[] => {
      if (Array.isArray(v)) return v.slice(0, n ?? v.length).map((b) => Number(b) & 0xff)
      if (typeof v === 'string') return [...v].map((c) => c.charCodeAt(0) & 0xff)
      return [Number(v) & 0xff]
    }
    const wire = {
      begin: () => undefined,
      end: () => undefined,
      setClock: (hz: unknown) => {
        const f = Number(hz)
        if (Number.isFinite(f) && f > 0) mcu.i2cClock = f
      },
      beginTransmission: (addr: number) => {
        txAddr = Math.trunc(addr) & 0x7f
        txBuf = []
      },
      write: (v: unknown, n?: number) => {
        const b = bytesOf(v, n)
        txBuf.push(...b)
        return b.length
      },
      endTransmission: (stop?: unknown) => {
        const dev = mcu.i2c.get(txAddr)
        const bytes = txBuf
        txBuf = []
        const ok = !!dev && dev.ack?.() !== false && mcu.i2cLineOk(txAddr, false)
        if (mcu.monitors.length) {
          mcu.busEvent({ bus: 'i2c', t: mcu.now, clock: mcu.i2cClock, addr: txAddr, read: false, bytes: ok ? [...bytes] : [], addrAck: ok, stop: ok ? stop === undefined || !!stop : true })
        }
        if (!ok) return 2 // NACK on the address
        dev.write?.(bytes)
        return 0
      },
      requestFrom: (addr: number, n: number, stop?: unknown) => {
        const a = Math.trunc(addr) & 0x7f
        const dev = mcu.i2c.get(a)
        const want = Math.max(0, Math.trunc(n))
        const ok = !!dev && dev.ack?.() !== false && mcu.i2cLineOk(a, true)
        rxBuf = ok ? (dev.read?.(want) ?? []).slice(0, want).map((b) => Number(b) & 0xff) : []
        if (mcu.monitors.length) {
          mcu.busEvent({ bus: 'i2c', t: mcu.now, clock: mcu.i2cClock, addr: a, read: true, bytes: [...rxBuf], addrAck: ok, stop: ok ? stop === undefined || !!stop : true })
        }
        return rxBuf.length
      },
      available: () => rxBuf.length,
      read: () => (rxBuf.length ? (rxBuf.shift() as number) : -1),
      peek: () => (rxBuf.length ? rxBuf[0] : -1),
    }

    // ── SPI: the device whose CS pin is LOW answers ──
    class SPISettings implements SpiSettingsLike {
      clock: number
      bitOrder: number
      mode: number
      constructor(clock = 4000000, bitOrder = MSBFIRST, mode = SPI_MODE0) {
        this.clock = Number(clock)
        this.bitOrder = Number(bitOrder)
        this.mode = Math.trunc(Number(mode)) & 3
      }
    }
    let settings: SpiSettingsLike = new SPISettings()
    const xfer = (b: number): number => {
      let out = 0xff // nothing selected: MISO idles high
      for (const [cs, dev] of mcu.spi) if (mcu.csActive.get(cs)) out = Number(dev.transfer(b & 0xff, settings)) & 0xff
      if (mcu.monitors.length) mcu.busEvent({ bus: 'spi', t: mcu.now, clock: settings.clock, mode: settings.mode & 3, bitOrder: settings.bitOrder, mosi: b & 0xff, miso: out })
      return out
    }
    const spi = {
      begin: () => undefined,
      end: () => undefined,
      beginTransaction: (s: SpiSettingsLike) => {
        settings = s
      },
      endTransaction: () => undefined,
      setBitOrder: (o: number) => {
        settings = { ...settings, bitOrder: o }
      },
      setDataMode: (m: number) => {
        settings = { ...settings, mode: m & 3 }
      },
      setClockDivider: () => undefined,
      transfer: (v: unknown, n?: number) => {
        if (Array.isArray(v)) {
          const len = Math.min(v.length, n ?? v.length)
          for (let k = 0; k < len; k++) v[k] = xfer(Number(v[k]))
          return undefined
        }
        return xfer(Number(v))
      },
      transfer16: (v: number) => {
        const x = Math.trunc(v) & 0xffff
        const hi = xfer(x >> 8)
        return (hi << 8) | xfer(x & 0xff)
      },
    }

    const random = (a: number, b?: number): number => {
      if (b === undefined) {
        const max = Math.trunc(a)
        return max > 0 ? Math.floor(mcu.rng() * max) : 0
      }
      const lo = Math.trunc(a)
      const hi = Math.trunc(b)
      return hi > lo ? lo + Math.floor(mcu.rng() * (hi - lo)) : lo
    }

    const wait = <T>(p: () => Promise<T>): Promise<T> => (alive() ? p() : NEVER)

    const arduino: Record<string, unknown> = {
      ...ARDUINO_CONSTANTS,
      ...(this.board === 'esp32s3' ? ESP32S3_ANALOG : {}),
      ...(this.board === 'teensy41' ? TEENSY41_GLOBALS : {}),
      pinMode: (pin: number, mode: number) => mcu.pinMode(Math.trunc(pin), mode),
      digitalWrite: (pin: number, v: number) => mcu.digitalWrite(Math.trunc(pin), v),
      digitalRead: (pin: number) => mcu.digitalRead(Math.trunc(pin)),
      analogWrite: (pin: number, v: number) => mcu.analogWrite(Math.trunc(pin), v),
      analogRead: (pin: number) => mcu.analogRead(Math.trunc(pin)),
      analogReference: (m: number) => mcu.analogReference(m),
      analogReadResolution: (b: number) => mcu.analogReadResolution(b),
      analogWriteResolution: (b: number) => mcu.analogWriteResolution(b),
      analogWriteFrequency: (pin: number, hz: number) => mcu.analogWriteFrequency(Math.trunc(pin), hz),
      delay: (ms: number) => wait(() => mcu.sleep(Number(ms) > 0 ? Number(ms) * 1000 : 10)),
      delayMicroseconds: (us: number) => wait(() => mcu.sleep(Number(us) > 0 ? Number(us) : 1)),
      millis: () => Math.floor(mcu.now / 1000 + 1e-9),
      micros: () => Math.floor(mcu.now + 1e-6),
      attachInterrupt: (n: number, fn: unknown, mode: number) => mcu.attachInterrupt(n, fn, mode),
      detachInterrupt: (n: number) => mcu.detachInterrupt(n),
      digitalPinToInterrupt: (pin: number) => mcu.digitalPinToInterrupt(Math.trunc(pin)),
      interrupts: () => wait(() => mcu.interrupts()),
      noInterrupts: () => mcu.noInterrupts(),
      pulseIn: (pin: number, state: unknown, timeout?: number) => wait(() => mcu.pulseIn(Math.trunc(pin), state, timeout === undefined ? 1000000 : Number(timeout))),
      pulseInLong: (pin: number, state: unknown, timeout?: number) => wait(() => mcu.pulseIn(Math.trunc(pin), state, timeout === undefined ? 1000000 : Number(timeout))),
      tone: (pin: number, f: number, d?: number) => mcu.tone(Math.trunc(pin), f, d),
      noTone: (pin: number) => mcu.noTone(Math.trunc(pin)),
      map: arduinoMap,
      constrain,
      random,
      randomSeed: (s: number) => {
        mcu.rng = makeRng(Math.trunc(s))
      },
      abs: Math.abs,
      min: Math.min,
      max: Math.max,
      sq: (x: number) => x * x,
      sqrt: Math.sqrt,
      pow: Math.pow,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      atan2: Math.atan2,
      exp: Math.exp,
      log: Math.log,
      log10: Math.log10,
      floor: Math.floor,
      ceil: Math.ceil,
      round: arduinoRound,
      radians: (d: number) => (d * Math.PI) / 180,
      degrees: (r: number) => (r * 180) / Math.PI,
      lowByte: (x: number) => Math.trunc(x) & 0xff,
      highByte: (x: number) => (Math.trunc(x) >> 8) & 0xff,
      bitRead: (x: number, n: number) => (Math.trunc(x) >> n) & 1,
      bit: (n: number) => 1 << n,
      bitSet: bitSetFn,
      bitClear: bitClearFn,
      bitWrite: bitWriteFn,
      F: (s: string) => s,
      Serial: serial,
      Wire: wire,
      SPI: spi,
      SPISettings,
      Servo,
    }

    const internals: Record<string, unknown> = {
      __g: this.guard,
      __F: (v: number) => new FloatBox(v),
      __C: (v: number) => new CharBox(Number(v)),
      __S: STRING_METHODS,
      __cstr: cstr,
      __idiv: (a: number, b: number) => (b === 0 ? 0 : Math.trunc(a / b)),
      __int: toInt,
      __cast: castInt,
      __u8: u8,
      __u16: u16,
      __u16w: u16w,
      __i8: i8,
      __i16: i16,
      __i32: i32,
      __u32: u32,
      __bitSet: bitSetFn,
      __bitClear: bitClearFn,
      __bitWrite: bitWriteFn,
      __chr: chr,
      __arr: makeArray,
      __pad: padArray,
      __sizeof: sizeOf,
    }
    return { ...arduino, ...(this.opts.libraries ?? {}), ...internals }
  }
}
