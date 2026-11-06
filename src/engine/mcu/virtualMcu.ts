// Virtual microcontroller: runs a transpiled sketch against a deterministic virtual clock.
//
// Time only moves inside `advance(ms)`. `delay()` registers a timer; advance resolves timers in
// time order and lets the program run (microtask flush) between them, so results never depend on
// wall-clock time.

import type { PinMode, PinState } from '../types'
import { ARDUINO_CONSTANTS, INPUT_PULLUP, OUTPUT } from './constants'
import {
  CharBox,
  FloatBox,
  arduinoMap,
  arduinoRound,
  castInt,
  chr,
  constrain,
  cstr,
  formatPrint,
  makeArray,
  makeRng,
  padArray,
  sizeOf,
  toInt,
  u16,
  u8,
} from './runtime'
import { transpile } from './transpile'

export interface VirtualMcuOptions {
  /** supply voltage, volts (5 for Uno, 3.3 for ESP32) */
  vcc: number
  /** called whenever the sketch changes a pin (mode, level, servo angle) */
  onPin(pin: number, state: PinState): void
  /** voltage at an analog input, volts. `pin` is the number the sketch used (A0 = 14 on Uno) */
  readAnalog(pin: number): number
  /** level seen at a digital input */
  readDigital(pin: number): 0 | 1
  /** one complete line of Serial output */
  serial(line: string): void
  /** objects / classes exposed to sketches (behaviour libraries). Classes become usable types. */
  libraries?: Record<string, unknown>
  /** diagnostics (transpiler warnings, runtime errors, the no-delay loop notice). Defaults to Serial. */
  warn?(message: string): void
  /** loop() iterations per virtual second when loop() never waits (default 20000) */
  maxLoopsPerSecond?: number
}

interface Timer {
  at: number
  seq: number
  resolve: () => void
}

interface Program {
  setup: (() => Promise<void>) | null
  loop: (() => Promise<void>) | null
}

interface Guard {
  n: number
  limit: number
  pause: () => Promise<void>
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

const STATEMENT_LIMIT = 1e6
const SERIAL_RING = 1000
const SHADOWED_GLOBALS = ['window', 'document', 'globalThis', 'self', 'fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'process', 'require', 'Function']

export class VirtualMcu {
  private readonly opts: VirtualMcuOptions
  private readonly perMs: number
  private js: string | null = null

  private now = 0
  private timers: Timer[] = []
  private seq = 0
  private waits = 0
  private gen = 0
  private running = false
  private finished = false
  private warnedLoop = false
  private chain: Promise<void> = Promise.resolve()

  private pins = new Map<number, PinState>()
  private latch = new Map<number, number>()
  private rng = makeRng(1)
  private serialBuf = ''
  private guard: Guard

  /** diagnostics emitted so far */
  readonly warnings: string[] = []
  /** the most recent Serial lines (ring buffer) */
  readonly serialLines: string[] = []

  constructor(opts: VirtualMcuOptions) {
    this.opts = opts
    this.perMs = Math.max(1, Math.round((opts.maxLoopsPerSecond ?? 20000) / 1000))
    this.guard = { n: 0, limit: STATEMENT_LIMIT, pause: () => this.loopPause() }
  }

  /** virtual time, milliseconds (fractional for delayMicroseconds) */
  get timeMs(): number {
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
      .filter(([, v]) => typeof v === 'function')
      .map(([k]) => k)
    const { js, warnings } = transpile(src, { classTypes, knownLibraries: Object.keys(libs) })
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
    this.guard.n = 0
    this.warnedLoop = false
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
  }

  /**
   * Run the program until virtual time has advanced by `ms`. Await each call before making the next.
   * Resolves once the program is parked on its next delay at (or after) the new time.
   */
  advance(ms: number): Promise<void> {
    const next = this.chain.then(() => this.doAdvance(ms))
    this.chain = next.catch(() => undefined)
    return next
  }

  // ── scheduler ──

  private async doAdvance(ms: number): Promise<void> {
    if (!this.running) return
    const gen = this.gen
    const target = this.now + ms
    // The statement budget for the loop guard is per advance() call: a loop that never waits gets
    // STATEMENT_LIMIT iterations, then is paused 1 ms per iteration for the rest of this advance.
    this.guard.n = 0
    await this.settle()
    while (this.running && gen === this.gen) {
      let idx = -1
      for (let k = 0; k < this.timers.length; k++) {
        const t = this.timers[k]
        if (idx < 0 || t.at < this.timers[idx].at || (t.at === this.timers[idx].at && t.seq < this.timers[idx].seq)) idx = k
      }
      if (idx < 0 || this.timers[idx].at > target) break
      const [t] = this.timers.splice(idx, 1)
      if (t.at > this.now) this.now = t.at
      t.resolve()
      await this.settle()
    }
    if (this.running && gen === this.gen && this.now < target) this.now = target
  }

  /** Let the program run until it parks on a timer (or ends). Pure microtask hops, no wall clock. */
  private async settle(): Promise<void> {
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

  private sleep(ms: number): Promise<void> {
    this.waits++
    return new Promise<void>((resolve) => {
      this.timers.push({ at: this.now + ms, seq: this.seq++, resolve })
    })
  }

  private loopPause(): Promise<void> {
    if (!this.warnedLoop) {
      this.warnedLoop = true
      this.warn('loop() never waits — added an implicit 1 ms pause')
    }
    return this.sleep(1)
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
            await this.sleep(1)
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
    const level = constrain(Math.trunc(Number(value) || 0), 0, 255) / 255
    this.latch.set(pin, level > 0 ? 1 : 0)
    this.notify(pin, { mode: 'OUTPUT', level })
  }

  private digitalRead(pin: number): number {
    const st = this.pins.get(pin)
    if (st && st.mode === 'OUTPUT') return st.level >= 0.5 ? 1 : 0
    return this.opts.readDigital(pin) ? 1 : 0
  }

  private analogRead(pin: number): number {
    const v = this.opts.readAnalog(pin)
    return constrain(Math.round((v / this.opts.vcc) * 1023), 0, 1023)
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

    const serial = {
      begin: () => undefined,
      end: () => undefined,
      flush: () => undefined,
      available: () => 0,
      read: () => -1,
      peek: () => -1,
      print: (v: unknown, fmt?: number) => mcu.serialWrite(formatPrint(v, fmt), false),
      println: (...args: unknown[]) => mcu.serialWrite(args.length ? formatPrint(args[0], args[1] as number | undefined) : '', true),
      write: (v: unknown) => mcu.serialWrite(typeof v === 'number' ? String.fromCharCode(v) : String(v), false),
    }

    const wire = {
      begin: () => undefined,
      beginTransmission: () => undefined,
      write: () => 1,
      endTransmission: () => 0,
      requestFrom: () => 0,
      available: () => 0,
      read: () => -1,
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

    const arduino: Record<string, unknown> = {
      ...ARDUINO_CONSTANTS,
      pinMode: (pin: number, mode: number) => mcu.pinMode(Math.trunc(pin), mode),
      digitalWrite: (pin: number, v: number) => mcu.digitalWrite(Math.trunc(pin), v),
      digitalRead: (pin: number) => mcu.digitalRead(Math.trunc(pin)),
      analogWrite: (pin: number, v: number) => mcu.analogWrite(Math.trunc(pin), v),
      analogRead: (pin: number) => mcu.analogRead(Math.trunc(pin)),
      delay: (ms: number) => mcu.sleep(Number(ms) > 0 ? Number(ms) : 0.01),
      delayMicroseconds: (us: number) => mcu.sleep(Number(us) > 0 ? Number(us) / 1000 : 0.001),
      millis: () => Math.floor(mcu.now),
      micros: () => Math.floor(mcu.now * 1000 + 1e-6),
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
      F: (s: string) => s,
      Serial: serial,
      Wire: wire,
      Servo,
    }

    const internals: Record<string, unknown> = {
      __g: this.guard,
      __F: (v: number) => new FloatBox(v),
      __C: (v: number) => new CharBox(Number(v)),
      __cstr: cstr,
      __idiv: (a: number, b: number) => (b === 0 ? 0 : Math.trunc(a / b)),
      __int: toInt,
      __cast: castInt,
      __u8: u8,
      __u16: u16,
      __chr: chr,
      __arr: makeArray,
      __pad: padArray,
      __sizeof: sizeOf,
    }
    return { ...arduino, ...(this.opts.libraries ?? {}), ...internals }
  }
}
