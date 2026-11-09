// logic-analyzer: an 8-channel USB logic analyzer clipped onto the sketch's buses, with UART, I²C and
// SPI protocol decoders.
//
// What it records. The virtual MCU runs Serial, Wire and SPI as instant calls; through a bus monitor
// (ctx.mcu.tapBus) this behavior gets each call (bytes, address, ACK, clock, SPI mode) at the MCU's µs
// time and lays the bits out at the bus's real rate as edges on digital traces (logic/synth.ts):
//   tx            UART TX (8N1 at the sketch's Serial.begin baud). The UART has its own transmit buffer,
//                 so bytes queue one after the other while the sketch carries on (they start no
//                 earlier than the blocking calls before them ended).
//   sda, scl      I²C, open-drain: a falling edge is immediate, a rising one waits until the pull-up has
//                 charged the bus capacitance to V_IH = 0.7·VDD, 1.204·R·C later (R, C read live from
//                 `sdaPull`/`sdaCap`, `sclPull`/`sclCap`; a missing pull-up = never). The master runs a
//                 fixed clock (no clock synchronization), so a rise slower than the SCL half-period
//                 swallows the clock pulse. Before each address goes out, the same waveform is decoded:
//                 if it no longer reads as that address, the device never sees it (NACK, `i2cOk`).
//   sck, mosi, miso  SPI at the transaction's clock and mode.
//   pin:N         every pin the sketch drives (chip selects, latches), from onPin.
//   node:<id>     a circuit node held against `vth`, sampled each frame (only nodes a channel asks for).
// Blocking calls (Wire, SPI) and pin edges share one cursor: each starts no earlier than the previous one
// ended, as if the call had taken its real time on the wire (the MCU's own clock is not stretched).
//
// Channels. `channel({pin} | {node})` resolves a probe: a bus pin gives its bus trace; a node joined to a
// PIN element through wires (R ≤ 1 Ω) or closed switches follows that pin; any other node is thresholded.
// So a probe on an adapter's RX shows the TX frames while the wire is there, and a flat line once TX is
// wired to the wrong pin.
//
// Decoders (logic/decode.ts) read the traces with the analyzer's own settings: UART at `laBaud` (not the
// sketch's baud: a mismatch decodes garbage and framing errors), SPI at `spiMode` (-1: the master's).
//
// Params (defaults): laBaud 115200, txPin 1, sdaPin 18, sclPin 19 (Uno A4/A5), sckPin 13, mosiPin 11,
//   misoPin 12, csPin 10, sdaPull 'r_sda', sclPull 'r_scl', sdaCap 'c_sda', sclCap 'c_scl', uartRx ''
//   (the node the UART decoder watches; '' = TX), spiMode -1, vth 1.5 V (node channels), depth 16384
//   edges per trace.
// Publishes: uart_byte_us (10 bit times at the sketch's baud), la_baud, uart_rx_bytes, uart_rx_rate
//   (bytes/s decoded at the RX probe over the last 0.5 s), la_decode_errors (framing errors since power-on),
//   i2c_tr (s, 30–70 % rise of the slower line, 0.8473·R·C), i2c_tr_limit (the spec's t_r max for the
//   clock in use: 1000 ns to 100 kHz, 300 ns to 400 kHz, 120 ns to 1 MHz), i2c_clock, i2c_acks,
//   i2c_nacks, spi_last, spi_mode, spi_bytes.
// Exposes (Bench.behaviorData): a LogicCapture for the instrument panel.

import { type Frame, decodeI2c, decodeSpi, decodeUart } from '../logic/decode'
import { I2cLines, i2cRiseDelay, i2cRiseTime, spiByte, uartBytes } from '../logic/synth'
import { type DigitalWave, EdgeTrace } from '../logic/trace'
import type { Behavior, BehaviorContext, BusEvent, LogicChannel, Netlist, PinState } from '../types'

export type Protocol = 'uart' | 'i2c' | 'spi'

export interface ResolvedChannel {
  trace: EdgeTrace
  /** what the probe sees: a bus line, a pin the sketch drives, or a thresholded node */
  kind: Protocol | 'pin' | 'node'
  /** I²C lines: the delay from release to V_IH, µs (the UI draws the RC curve over it); 0 otherwise */
  riseUs: number
}

/** the analyzer's live data, for the instrument panel and tests (times are MCU µs) */
export interface LogicCapture {
  /** bumps whenever the capture is cleared (upload, power, MCU restart) */
  readonly gen: number
  /** newest time with data (MCU µs) */
  now(): number
  channel(ch: LogicChannel): ResolvedChannel
  /** the time of the newest activity on that bus (−Infinity when none) */
  lastActivity(p: Protocol): number
  decode(p: Protocol, from: number, to: number): Frame[]
  decodeUartOn(trace: DigitalWave, from: number, to: number): Frame[]
  /** the UART decode baud (laBaud) */
  baud(): number
  /** the SPI decode mode (the master's unless spiMode overrides it) */
  spiMode(): number
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d)
/** a blocking bus call more than this far ahead of the MCU clock is laid out at the MCU time instead */
const MAX_LEAD_US = 20000

/** the I²C spec's maximum rise time for the clock rate (NXP UM10204: Sm 1000 ns, Fm 300 ns, Fm+ 120 ns) */
export function i2cRiseLimit(clockHz: number): number {
  if (clockHz <= 100e3) return 1000e-9
  if (clockHz <= 400e3) return 300e-9
  return 120e-9
}

interface State {
  ctx: BehaviorContext
  gen: number
  depth: number
  traces: Map<string, EdgeTrace>
  watched: Set<string>
  lines: I2cLines
  riseSda: number
  riseScl: number
  /** end of the last blocking call (I²C / SPI) on the analyzer's timeline, µs */
  sync: number
  /** end of the last UART byte queued, µs */
  uartEnd: number
  lastRaw: number
  activity: Record<Protocol, number>
  sketchBaud: number
  i2cClock: number
  spiMode: number
  spiLast: number
  spiBytes: number
  acks: number
  nacks: number
  rxBytes: number
  errors: number
  decFrom: number
  rateT: number
  rateBytes: number
  rate: number
  /** node → MCU pin it is wired to (or −1), rebuilt when the netlist changes */
  topo: { net: Netlist | null; pinOf: Map<string, number> }
  capture: LogicCapture
}

const states = new WeakMap<BehaviorContext, State>()

function busPins(ctx: BehaviorContext): Record<number, { key: string; p: Protocol }> {
  const P = ctx.params
  return {
    [num(P.txPin, 1)]: { key: 'tx', p: 'uart' },
    [num(P.sdaPin, 18)]: { key: 'sda', p: 'i2c' },
    [num(P.sclPin, 19)]: { key: 'scl', p: 'i2c' },
    [num(P.sckPin, 13)]: { key: 'sck', p: 'spi' },
    [num(P.mosiPin, 11)]: { key: 'mosi', p: 'spi' },
    [num(P.misoPin, 12)]: { key: 'miso', p: 'spi' },
  }
}

function trace(s: State, key: string, initial: 0 | 1): EdgeTrace {
  let t = s.traces.get(key)
  if (!t) {
    t = new EdgeTrace(s.depth, initial)
    s.traces.set(key, t)
  }
  return t
}

const IDLE: Record<string, 0 | 1> = { tx: 1, sda: 1, scl: 1, sck: 0, mosi: 0, miso: 1 }

function newLines(s: State): I2cLines {
  return new I2cLines(
    (t, v) => trace(s, 'sda', 1).push(t, v),
    (t, v) => trace(s, 'scl', 1).push(t, v),
    s.riseSda,
  )
}

function clear(s: State): void {
  s.gen++
  for (const [k, t] of s.traces) t.clear(k.startsWith('pin:') ? 0 : (IDLE[k] ?? 0))
  s.sync = 0
  s.uartEnd = 0
  s.lastRaw = 0
  s.activity = { uart: -Infinity, i2c: -Infinity, spi: -Infinity }
  s.lines = newLines(s)
  s.lines.setRise(s.riseSda, s.riseScl, 0)
  s.spiLast = 0
  s.spiBytes = 0
  s.acks = 0
  s.nacks = 0
  s.rxBytes = 0
  s.errors = 0
  s.decFrom = 0
  s.rateT = 0
  s.rateBytes = 0
  s.rate = 0
}

/** the MCU clock went backwards (upload, reset, brown-out restart): the old timeline is meaningless */
function seen(s: State, t: number): void {
  if (t < s.lastRaw - 1) clear(s)
  s.lastRaw = Math.max(s.lastRaw, t)
}

function elementValue(net: Netlist, id: string, missing: number): number {
  const el = net.elements.find((e) => e.id === id) as { value?: number; disabled?: boolean } | undefined
  if (!el || el.disabled) return missing
  return num(el.value, missing)
}

function updateRise(s: State, t: number): void {
  const ctx = s.ctx
  const P = ctx.params
  const net = ctx.netlist
  const rS = elementValue(net, str(P.sdaPull, 'r_sda'), Infinity)
  const rC = elementValue(net, str(P.sclPull, 'r_scl'), Infinity)
  const cS = elementValue(net, str(P.sdaCap, 'c_sda'), 0)
  const cC = elementValue(net, str(P.sclCap, 'c_scl'), 0)
  s.riseSda = i2cRiseDelay(rS, cS) * 1e6
  s.riseScl = i2cRiseDelay(rC, cC) * 1e6
  s.lines.setRise(s.riseSda, s.riseScl, t)
  ctx.publish('i2c_tr', Math.max(i2cRiseTime(rS, cS), i2cRiseTime(rC, cC)))
}

/** union-find over wires (R ≤ 1 Ω) and closed switches: which MCU pin each node is joined to */
function topology(s: State): Map<string, number> {
  const net = s.ctx.netlist
  if (s.topo.net === net) return s.topo.pinOf
  const parent = new Map<string, string>()
  const find = (a: string): string => {
    let r = a
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r) as string
    parent.set(a, r)
    return r
  }
  const join = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const e of net.elements) {
    const el = e as { type: string; nodes: string[]; value?: number; closed?: boolean; disabled?: boolean }
    if (el.disabled) continue
    if ((el.type === 'R' && num(el.value, Infinity) <= 1) || (el.type === 'SW' && el.closed)) join(el.nodes[0], el.nodes[1])
  }
  const rootPin = new Map<string, number>()
  for (const e of net.elements) {
    const el = e as { type: string; nodes: string[]; pin?: number; disabled?: boolean }
    if (el.type === 'PIN' && !el.disabled && typeof el.pin === 'number') rootPin.set(find(el.nodes[0]), el.pin)
  }
  const pinOf = new Map<string, number>()
  for (const e of net.elements) for (const n of (e as { nodes: string[] }).nodes) pinOf.set(n, rootPin.get(find(n)) ?? -1)
  s.topo = { net, pinOf }
  return pinOf
}

function resolve(s: State, ch: LogicChannel): ResolvedChannel {
  const bus = busPins(s.ctx)
  let pin = typeof ch.pin === 'number' ? ch.pin : -1
  if (pin < 0 && ch.node) pin = topology(s).get(ch.node) ?? -1
  if (pin >= 0 && bus[pin]) {
    const b = bus[pin]
    const riseUs = b.key === 'sda' ? s.riseSda : b.key === 'scl' ? s.riseScl : 0
    return { trace: trace(s, b.key, IDLE[b.key]), kind: b.p, riseUs: Number.isFinite(riseUs) ? riseUs : 0 }
  }
  if (pin >= 0) return { trace: trace(s, `pin:${pin}`, 0), kind: 'pin', riseUs: 0 }
  const node = ch.node ?? '0'
  if (!s.watched.has(node)) {
    s.watched.add(node)
    trace(s, `node:${node}`, s.ctx.v(node) > num(s.ctx.params.vth, 1.5) ? 1 : 0)
  }
  return { trace: trace(s, `node:${node}`, 0), kind: 'node', riseUs: 0 }
}

function uartTrace(s: State): EdgeTrace {
  const rx = str(s.ctx.params.uartRx, '')
  return rx ? resolve(s, { node: rx, label: 'RX' }).trace : trace(s, 'tx', 1)
}

function onBus(s: State, ev: BusEvent): void {
  seen(s, ev.t)
  if (s.sync - ev.t > MAX_LEAD_US) s.sync = ev.t
  if (ev.bus === 'uart') {
    s.sketchBaud = ev.baud
    // Serial.print returns at once (the bytes go to a buffer), but it was only reached once the blocking
    // Wire / SPI calls before it had finished
    const t0 = Math.max(ev.t, s.uartEnd, s.sync)
    const tx = trace(s, 'tx', 1)
    s.uartEnd = uartBytes(ev.bytes, ev.baud, t0, (t, v) => tx.push(t, v))
    s.activity.uart = s.uartEnd
  } else if (ev.bus === 'i2c') {
    s.i2cClock = ev.clock
    const t0 = Math.max(ev.t, s.sync)
    s.sync = s.lines.transaction(ev, t0)
    s.activity.i2c = s.sync
    if (ev.addrAck) s.acks++
    else s.nacks++
  } else {
    const h = 1e6 / (2 * ev.clock)
    const sck = trace(s, 'sck', 0)
    const t0 = Math.max(ev.t, s.sync) + h // CS set-up before the first clock
    sck.push(t0 - h / 2, ((ev.mode >> 1) & 1) as 0 | 1) // the clock idles at CPOL
    const mosi = trace(s, 'mosi', 0)
    const miso = trace(s, 'miso', 1)
    s.sync = spiByte(ev, t0, (t, v) => sck.push(t, v), (t, v) => mosi.push(t, v), (t, v) => miso.push(t, v))
    s.activity.spi = s.sync
    s.spiMode = ev.mode
    s.spiLast = ev.mosi
    s.spiBytes++
  }
}

function makeState(ctx: BehaviorContext): State {
  const s = {
    ctx,
    gen: 0,
    depth: Math.max(256, Math.round(num(ctx.params.depth, 16384))),
    traces: new Map(),
    watched: new Set(),
    riseSda: Infinity,
    riseScl: Infinity,
    sync: 0,
    uartEnd: 0,
    lastRaw: 0,
    activity: { uart: -Infinity, i2c: -Infinity, spi: -Infinity },
    sketchBaud: 0,
    i2cClock: 100000,
    spiMode: 0,
    spiLast: 0,
    spiBytes: 0,
    acks: 0,
    nacks: 0,
    rxBytes: 0,
    errors: 0,
    decFrom: 0,
    rateT: 0,
    rateBytes: 0,
    rate: 0,
    topo: { net: null, pinOf: new Map() },
  } as unknown as State
  s.lines = newLines(s)
  for (const k of Object.keys(IDLE)) trace(s, k, IDLE[k])
  const decodeMode = () => {
    const m = num(s.ctx.params.spiMode, -1)
    return m >= 0 && m <= 3 ? Math.trunc(m) : s.spiMode
  }
  s.capture = {
    get gen() {
      return s.gen
    },
    now: () => Math.max(s.ctx.mcu.timeMicros, s.lastRaw),
    channel: (ch) => {
      s.lines.flush(Math.max(s.ctx.mcu.timeMicros, s.lastRaw))
      return resolve(s, ch)
    },
    lastActivity: (p) => s.activity[p],
    baud: () => num(s.ctx.params.laBaud, 115200),
    spiMode: decodeMode,
    decodeUartOn: (tr, from, to) => decodeUart(tr, num(s.ctx.params.laBaud, 115200), from, to),
    decode(p, from, to) {
      s.lines.flush(Math.max(s.ctx.mcu.timeMicros, s.lastRaw)) // rises that are due but not yet drawn
      if (p === 'uart') return decodeUart(uartTrace(s), num(s.ctx.params.laBaud, 115200), from, to)
      if (p === 'i2c') return decodeI2c(trace(s, 'sda', 1), trace(s, 'scl', 1), from, to)
      const cs = s.traces.get(`pin:${num(s.ctx.params.csPin, 10)}`) ?? null
      return decodeSpi(trace(s, 'sck', 0), trace(s, 'mosi', 0), cs, decodeMode(), 1, from, to)
    },
  }
  return s
}

function state(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = makeState(ctx)
    states.set(ctx, s)
  }
  s.ctx = ctx
  return s
}

function pinLevel(st: PinState): 0 | 1 {
  if (st.mode === 'OUTPUT') return st.level >= 0.5 ? 1 : 0
  return st.mode === 'INPUT_PULLUP' ? 1 : 0
}

export const behavior: Behavior = {
  id: 'logic-analyzer',
  init(ctx) {
    const s = state(ctx)
    ctx.mcu.tapBus?.({
      event: (ev) => onBus(s, ev),
      i2cOk(addr, read, clock) {
        if (!Number.isFinite(s.riseSda) || !Number.isFinite(s.riseScl)) return false
        // lay the address byte out on scratch traces with today's edges and read it back
        const sda = new EdgeTrace(128, 1)
        const scl = new EdgeTrace(128, 1)
        const lines = new I2cLines((t, v) => sda.push(t, v), (t, v) => scl.push(t, v), s.riseSda)
        lines.setRise(s.riseSda, s.riseScl, 0)
        const end = lines.transaction({ addr, read, bytes: [], addrAck: true, stop: true, clock }, 1)
        lines.flush(end + 1e6)
        const fr = decodeI2c(sda, scl, 0, end + 1e6).find((f) => f.kind === 'addr')
        return !!fr && fr.value === (addr & 0x7f) && fr.read === read
      },
    })
  },
  onPin(ctx, pin, st, tMicros) {
    const s = state(ctx)
    seen(s, tMicros)
    if (s.sync - tMicros > MAX_LEAD_US) s.sync = tMicros
    trace(s, `pin:${pin}`, 0).push(Math.max(tMicros, s.sync), pinLevel(st))
  },
  tick(ctx) {
    const s = state(ctx)
    const now = ctx.mcu.timeMicros
    seen(s, now)
    updateRise(s, Math.max(now, s.sync))
    s.lines.flush(Math.max(now, s.sync))
    const vth = num(ctx.params.vth, 1.5)
    for (const n of s.watched) trace(s, `node:${n}`, 0).push(now, ctx.v(n) > vth ? 1 : 0)

    // the receiving end, decoded as it arrives at laBaud
    const baud = num(ctx.params.laBaud, 115200)
    const tr = uartTrace(s)
    const T = 1e6 / baud
    const to = tr.last === 1 ? Math.max(now, tr.lastT + 11 * T) : tr.lastT
    const fr = decodeUart(tr, baud, s.decFrom, to)
    for (const f of fr) {
      if (f.error) s.errors++
      else s.rxBytes++
    }
    if (fr.length) s.decFrom = fr[fr.length - 1].t0 + 9.5 * T
    if (now - s.rateT >= 500000 || now < s.rateT) {
      s.rate = now > s.rateT ? ((s.rxBytes - s.rateBytes) * 1e6) / (now - s.rateT) : 0
      s.rateT = now
      s.rateBytes = s.rxBytes
    }

    ctx.publish('uart_byte_us', s.sketchBaud > 0 ? 1e7 / s.sketchBaud : 0)
    ctx.publish('la_baud', baud)
    ctx.publish('uart_rx_bytes', s.rxBytes)
    ctx.publish('uart_rx_rate', s.rate)
    ctx.publish('la_decode_errors', s.errors)
    ctx.publish('i2c_tr_limit', i2cRiseLimit(s.i2cClock))
    ctx.publish('i2c_clock', s.i2cClock)
    ctx.publish('i2c_acks', s.acks)
    ctx.publish('i2c_nacks', s.nacks)
    ctx.publish('spi_last', s.spiLast)
    ctx.publish('spi_mode', s.spiMode)
    ctx.publish('spi_bytes', s.spiBytes)
  },
  onEvent(ctx, ev) {
    if (ev === 'upload' || ev === 'power-on' || ev === 'power-off' || ev === 'strip') clear(state(ctx))
  },
  reset(ctx) {
    const s = state(ctx)
    s.acks = 0
    s.nacks = 0
    s.errors = 0
  },
  expose(ctx) {
    return state(ctx).capture
  },
}
