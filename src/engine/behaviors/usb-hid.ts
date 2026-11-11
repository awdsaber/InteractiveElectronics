// usb-hid (shared): a no-code USB HID game-controller board (BU0836-style), as the host sees it.
//
// Axes: every report it samples each `axes` node from the solved circuit, against `refNode` (the
// board's own +5 V terminal, so the reading is ratiometric; '' = the fixed `vref`), adds optional
// pickup noise, and quantises to `bits`: N = clamp(⌊V / Vref × 2^bits⌋, 0, 2^bits − 1).
//
// Buttons: a real row/column scan in the netlist. `rows` are SW elements from each row node to
// ground (closed = that row driven low, open = high impedance); `cols` are column nodes pulled up
// by the lesson. Each transient step (onStep) it reads the columns of the row the previous step
// selected (below `colVth` = closed), then selects the next row. So ghosting is not a rule here:
// it is the solver finding a sneak path through three closed switches when a diode is missing.
// Button number = row × `perRow` + column + 1 (row 1 col 1 = 1, row 2 col 1 = 7 at perRow 6).
// A key's state changes after two scans agree (debounce). `keys` (SW ids) are closed by params
// `k1..kN` (0/1, list order); `keyButtons` gives their button numbers, so a button reported but
// not physically pressed counts as a ghost.
//
// Encoder: `encPair` is the first button of a pair in encoder mode (contacts A, B on that pair).
// The pair's raw contacts are decoded as quadrature from the scan (four valid changes = one
// detent); each detent is reported as a `pulseMs` press of button encPair (+) or encPair + 1 (−).
// The bench's encoder itself: `encA` / `encB` SW ids, driven through one full A/B cycle per click
// over `detentMs` on a rising `cw` / `ccw` param (momentary tweaks). Pulse and detent times are
// illustrative.
//
// Reports go out at `reportHz` (500: Leo Bodnar's figure for the BU0836A). `deadzonePct` is the
// game-side deadzone applied to `ax<i>_game`.
//
// Params (defaults): axes '', axisNames (X,Y,Z,Rx,Ry,Rz,Slider,Dial), refNode '', vref 5, bits 12,
//   reportHz 500, noiseMv 0, noiseAxis -1 (all), deadzonePct 0, rows '', cols '', colVth 2.5,
//   perRow 6, keys '', keyButtons '', encPair 0 (none), encA '', encB '', cw 0, ccw 0, pulseMs 30,
//   detentMs 24, shownButtons 12, buttonLabels ('1:FIRE,2:…'), name 'USB HID', seed 1.
//   List params are read once per bench; numbers every step (a failure may override them).
// Publishes: ax<i> (counts, 1-based), ax<i>_v, ax<i>_pct, ax<i>_game, b<n> (0/1, n ≤ shownButtons),
//   buttons_down, ghosts, enc_steps, enc_pos (knob turns, 0..1), report_hz, reports.
// Exposes: a HidView for the Game controller panel (src/ui/GameController.tsx).

import type { Behavior, BehaviorContext, Solution } from '../types'

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const list = (v: unknown) =>
  String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

const USAGES = ['X', 'Y', 'Z', 'Rx', 'Ry', 'Rz', 'Slider', 'Dial']
/** 32 buttons: the size of the report's button field */
const NBUTTONS = 32

/** N = clamp(⌊V / Vref × 2^bits⌋, 0, 2^bits − 1); 0 without a reference */
export function quantize(v: number, vref: number, bits: number): number {
  const n = 2 ** bits
  if (!(vref > 0) || !Number.isFinite(v)) return 0
  return Math.min(n - 1, Math.max(0, Math.floor((v / vref) * n)))
}

/** a game-side deadzone at the bottom of a 0..100 % axis: 0 inside it, the rest rescaled to 0..100 */
export function applyDeadzone(pct: number, dz: number): number {
  if (!(dz > 0)) return pct
  if (pct <= dz) return 0
  return Math.min(100, ((pct - dz) / (100 - dz)) * 100)
}

/** quadrature step between two (A << 1 | B) states: +1 along 00 → 01 → 11 → 10, −1 back, 0 otherwise */
export function quadDelta(prev: number, next: number): number {
  if (prev === next) return 0
  const order = [0b00, 0b01, 0b11, 0b10]
  const d = (order.indexOf(next) - order.indexOf(prev) + 4) % 4
  return d === 1 ? 1 : d === 3 ? -1 : 0
}

export interface HidAxisView {
  label: string
  usage: string
  raw: number
  max: number
  volts: number
  pct: number
  game: number
}
export interface HidButtonView {
  n: number
  label: string
  on: boolean
  /** reported, but no switch for it is closed */
  ghost: boolean
}
/** what the Game controller panel shows (Bench.behaviorData(instance)) */
export interface HidView {
  name: string
  bits: number
  reportHz: number
  reports: number
  connected: boolean
  axes: HidAxisView[]
  buttons: HidButtonView[]
  encSteps: number
  /** the report descriptor in words */
  descriptor: string[]
  /** the last input report, bytes (illustrative layout: 16-bit axes, then 32 button bits) */
  report: number[]
}

interface State {
  axes: string[]
  names: string[]
  rows: string[]
  cols: string[]
  keys: string[]
  keyButtons: number[]
  labels: Map<number, string>
  raw: Float64Array
  volts: Float64Array
  /** debounced key state per button (index n − 1) and the last raw scan */
  deb: Uint8Array
  last: Uint8Array
  /** the row the current netlist drives low */
  row: number
  nextReport: number
  reports: number
  rateT0: number
  rateN0: number
  rate: number
  // encoder mechanics
  encQueue: number
  encDir: number
  encPhase: number
  encT: number
  encDetents: number
  prevCw: number
  prevCcw: number
  // encoder decode
  quad: number
  quadAcc: number
  steps: number
  pulseUntil: Float64Array
  rng: number
  spare: number
  hasSpare: boolean
  reported: Uint8Array
}

const states = new WeakMap<BehaviorContext, State>()

function fresh(ctx: BehaviorContext): State {
  const p = ctx.params
  const axes = list(p.axes)
  const names = list(p.axisNames)
  const labels = new Map<number, string>()
  for (const kv of list(p.buttonLabels)) {
    const [k, ...rest] = kv.split(':')
    if (Number(k) > 0) labels.set(Number(k), rest.join(':').trim())
  }
  const seed = (Math.imul(Math.trunc(num(p.seed, 1)) | 0, 2654435761) ^ 0x9e3779b9) >>> 0
  return {
    axes,
    names: axes.map((_, i) => names[i] ?? USAGES[i] ?? `Axis ${i + 1}`),
    rows: list(p.rows),
    cols: list(p.cols),
    keys: list(p.keys),
    keyButtons: list(p.keyButtons).map(Number),
    labels,
    raw: new Float64Array(axes.length),
    volts: new Float64Array(axes.length),
    deb: new Uint8Array(NBUTTONS),
    last: new Uint8Array(NBUTTONS),
    row: 0,
    nextReport: 0,
    reports: 0,
    rateT0: 0,
    rateN0: 0,
    rate: 0,
    encQueue: 0,
    encDir: 0,
    encPhase: 0,
    encT: 0,
    encDetents: 0,
    prevCw: 0,
    prevCcw: 0,
    quad: 0,
    quadAcc: 0,
    steps: 0,
    pulseUntil: new Float64Array(2),
    rng: seed || 1,
    spare: 0,
    hasSpare: false,
    reported: new Uint8Array(NBUTTONS),
  }
}

function state(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = fresh(ctx)
    states.set(ctx, s)
  }
  return s
}

/** forget the run: scan, reports, encoder (the list params stay) */
function restart(ctx: BehaviorContext, s: State) {
  s.deb.fill(0)
  s.last.fill(0)
  s.reported.fill(0)
  s.raw.fill(0)
  s.volts.fill(0)
  s.row = 0
  s.nextReport = 0
  s.reports = 0
  s.rateT0 = -1
  s.rateN0 = 0
  s.rate = 0
  s.encQueue = 0
  s.encDir = 0
  s.encPhase = 0
  s.quad = 0
  s.quadAcc = 0
  s.steps = 0
  s.encDetents = 0
  s.pulseUntil.fill(-1)
  driveRows(ctx, s)
  driveEncoder(ctx, s)
}

function uniform(s: State): number {
  let x = s.rng
  x ^= x << 13
  x >>>= 0
  x ^= x >>> 17
  x ^= x << 5
  x >>>= 0
  s.rng = x || 1
  return (s.rng + 0.5) / 4294967296
}
/** standard normal (Box–Muller, pairs) */
function gauss(s: State): number {
  if (s.hasSpare) {
    s.hasSpare = false
    return s.spare
  }
  const u = uniform(s)
  const v = uniform(s)
  const r = Math.sqrt(-2 * Math.log(u))
  s.spare = r * Math.sin(2 * Math.PI * v)
  s.hasSpare = true
  return r * Math.cos(2 * Math.PI * v)
}

function driveRows(ctx: BehaviorContext, s: State) {
  for (let r = 0; r < s.rows.length; r++) ctx.setParam(s.rows[r], 'closed', r === s.row)
}

/** contact states along one full cycle per detent, forward: 00 → 01 → 11 → 10 → 00 (A << 1 | B) */
const CYCLE = [0b00, 0b01, 0b11, 0b10]

function driveEncoder(ctx: BehaviorContext, s: State) {
  const a = String(ctx.params.encA ?? '')
  const b = String(ctx.params.encB ?? '')
  if (!a || !b) return
  const st = CYCLE[(((s.encDir >= 0 ? s.encPhase : -s.encPhase) % 4) + 4) % 4]
  ctx.setParam(a, 'closed', (st & 0b10) !== 0)
  ctx.setParam(b, 'closed', (st & 0b01) !== 0)
}

function setKeys(ctx: BehaviorContext, s: State) {
  for (let i = 0; i < s.keys.length; i++) ctx.setParam(s.keys[i], 'closed', num(ctx.params[`k${i + 1}`], 0) > 0.5)
}

function scan(ctx: BehaviorContext, s: State, t: number, sol: Solution) {
  const p = ctx.params
  const vth = num(p.colVth, 2.5)
  const perRow = Math.max(1, Math.round(num(p.perRow, 6)))
  const r = s.row
  for (let c = 0; c < s.cols.length; c++) {
    const n = r * perRow + c
    if (n >= NBUTTONS) break
    const v = sol.voltageOf ? sol.voltageOf(s.cols[c]) : (sol.nodeV[s.cols[c]] ?? 5)
    const closed = v < vth ? 1 : 0
    if (closed === s.last[n]) s.deb[n] = closed
    s.last[n] = closed
  }
  // encoder pair: raw contacts, decoded on every scan of their row
  const pair = Math.round(num(p.encPair, 0))
  if (pair > 0 && pair < NBUTTONS && Math.floor((pair - 1) / perRow) === r) {
    const q = (s.last[pair - 1] << 1) | s.last[pair]
    const d = quadDelta(s.quad, q)
    s.quad = q
    s.quadAcc += d
    if (s.quadAcc >= 4 || s.quadAcc <= -4) {
      const dir = s.quadAcc > 0 ? 1 : -1
      s.quadAcc = 0
      s.steps += dir
      s.pulseUntil[dir > 0 ? 0 : 1] = t + num(p.pulseMs, 30) / 1000
    }
  }
  // next row
  if (s.rows.length > 1) {
    s.row = (s.row + 1) % s.rows.length
    driveRows(ctx, s)
  }
}

function stepEncoder(ctx: BehaviorContext, s: State, t: number) {
  const p = ctx.params
  const cw = num(p.cw, 0) > 0.5 ? 1 : 0
  const ccw = num(p.ccw, 0) > 0.5 ? 1 : 0
  if (cw && !s.prevCw) s.encQueue++
  if (ccw && !s.prevCcw) s.encQueue--
  s.prevCw = cw
  s.prevCcw = ccw
  const quarter = Math.max(0.001, num(p.detentMs, 24) / 4000)
  if (s.encDir === 0 && s.encQueue !== 0) {
    s.encDir = s.encQueue > 0 ? 1 : -1
    s.encQueue -= s.encDir
    s.encPhase = 0
    s.encT = t
  }
  if (s.encDir !== 0 && t - s.encT >= quarter) {
    s.encT = t
    s.encPhase++
    driveEncoder(ctx, s)
    if (s.encPhase >= 4) {
      s.encDetents += s.encDir
      s.encDir = 0
      s.encPhase = 0
    }
  }
}

function report(ctx: BehaviorContext, s: State, t: number, sol: Solution) {
  const p = ctx.params
  const bits = Math.max(1, Math.min(16, Math.round(num(p.bits, 12))))
  const ref = String(p.refNode ?? '')
  const volt = (n: string) => (sol.voltageOf ? sol.voltageOf(n) : (sol.nodeV[n] ?? 0))
  const vref = ref ? volt(ref) : num(p.vref, 5)
  const noise = num(p.noiseMv, 0) / 1000
  const noiseAxis = Math.round(num(p.noiseAxis, -1))
  for (let i = 0; i < s.axes.length; i++) {
    let v = volt(s.axes[i])
    if (noise > 0 && (noiseAxis < 0 || noiseAxis === i)) v += noise * gauss(s)
    s.volts[i] = v
    s.raw[i] = quantize(v, vref, bits)
  }
  const pair = Math.round(num(p.encPair, 0))
  for (let n = 0; n < NBUTTONS; n++) s.reported[n] = s.deb[n]
  if (pair > 0 && pair < NBUTTONS) {
    s.reported[pair - 1] = t < s.pulseUntil[0] ? 1 : 0
    s.reported[pair] = t < s.pulseUntil[1] ? 1 : 0
  }
  s.reports++
  if (s.rateT0 < 0) {
    s.rateT0 = t
    s.rateN0 = s.reports
  } else if (t - s.rateT0 >= 0.5) {
    s.rate = (s.reports - s.rateN0) / (t - s.rateT0)
    s.rateT0 = t
    s.rateN0 = s.reports
  }
}

function physicallyPressed(ctx: BehaviorContext, s: State, n: number): boolean {
  const i = s.keyButtons.indexOf(n)
  return i >= 0 && num(ctx.params[`k${i + 1}`], 0) > 0.5
}

function isGhost(ctx: BehaviorContext, s: State, n: number): boolean {
  const pair = Math.round(num(ctx.params.encPair, 0))
  if (pair > 0 && (n === pair || n === pair + 1)) return false
  return s.reported[n - 1] === 1 && !physicallyPressed(ctx, s, n)
}

export const behavior: Behavior = {
  id: 'usb-hid',
  init(ctx) {
    const s = state(ctx)
    restart(ctx, s)
    setKeys(ctx, s)
  },
  onEvent(ctx, ev) {
    const s = state(ctx)
    if (ev === 'power-on' || ev === 'power-off' || ev === 'repair' || ev === 'strip') restart(ctx, s)
    else if (ev === 'break') driveRows(ctx, s)
    setKeys(ctx, s)
  },
  reset(ctx) {
    restart(ctx, state(ctx))
  },
  onStep(ctx, t, sol) {
    if (!ctx.powered) return
    const s = state(ctx)
    setKeys(ctx, s)
    stepEncoder(ctx, s, t)
    if (s.rows.length) scan(ctx, s, t, sol)
    const period = 1 / Math.max(1, num(ctx.params.reportHz, 500))
    if (t + 1e-9 >= s.nextReport) {
      report(ctx, s, t, sol)
      s.nextReport = Math.max(s.nextReport + period, t + period * 0.5)
    }
  },
  tick(ctx) {
    const s = state(ctx)
    if (!ctx.powered) return
    setKeys(ctx, s)
    const bits = Math.max(1, Math.min(16, Math.round(num(ctx.params.bits, 12))))
    const max = 2 ** bits - 1
    const dz = num(ctx.params.deadzonePct, 0)
    for (let i = 0; i < s.axes.length; i++) {
      const pct = (s.raw[i] / max) * 100
      ctx.publish(`ax${i + 1}`, s.raw[i])
      ctx.publish(`ax${i + 1}_v`, s.volts[i])
      ctx.publish(`ax${i + 1}_pct`, pct)
      ctx.publish(`ax${i + 1}_game`, applyDeadzone(pct, dz))
    }
    let down = 0
    let ghosts = 0
    const shown = Math.min(NBUTTONS, Math.round(num(ctx.params.shownButtons, 12)))
    for (let n = 1; n <= NBUTTONS; n++) {
      const on = s.reported[n - 1]
      if (n <= shown) ctx.publish(`b${n}`, on)
      down += on
      if (isGhost(ctx, s, n)) ghosts++
    }
    ctx.publish('buttons_down', down)
    ctx.publish('ghosts', ghosts)
    ctx.publish('enc_steps', s.steps)
    const perDetent = 1 / 24
    const turn = (s.encDetents + (s.encDir * s.encPhase) / 4) * perDetent
    ctx.publish('enc_pos', ((turn % 1) + 1) % 1)
    ctx.publish('report_hz', s.rate)
    ctx.publish('reports', s.reports)
  },
  expose(ctx): HidView {
    const s = state(ctx)
    const p = ctx.params
    const bits = Math.max(1, Math.min(16, Math.round(num(p.bits, 12))))
    const max = 2 ** bits - 1
    const dz = num(p.deadzonePct, 0)
    const shown = Math.min(NBUTTONS, Math.round(num(p.shownButtons, 12)))
    const hz = Math.round(num(p.reportHz, 500))
    const axes = s.axes.map((_, i) => {
      const pct = (s.raw[i] / max) * 100
      return { label: s.names[i], usage: USAGES[i] ?? 'Axis', raw: s.raw[i], max, volts: s.volts[i], pct, game: applyDeadzone(pct, dz) }
    })
    const buttons: HidButtonView[] = []
    for (let n = 1; n <= shown; n++) buttons.push({ n, label: s.labels.get(n) ?? '', on: ctx.powered && s.reported[n - 1] === 1, ghost: ctx.powered && isGhost(ctx, s, n) })
    const bytes: number[] = []
    for (let i = 0; i < s.axes.length; i++) {
      const r = Math.round(s.raw[i])
      bytes.push(r & 0xff, (r >> 8) & 0xff)
    }
    for (let k = 0; k < NBUTTONS / 8; k++) {
      let b = 0
      for (let j = 0; j < 8; j++) b |= s.reported[k * 8 + j] << j
      bytes.push(b)
    }
    return {
      name: String(p.name ?? 'USB HID'),
      bits,
      reportHz: s.rate,
      reports: s.reports,
      connected: ctx.powered,
      axes,
      buttons,
      encSteps: s.steps,
      descriptor: [
        'Usage Page (Generic Desktop) · Usage (Joystick) · Collection (Application)',
        `${s.axes.length} axes (${axes.map((a) => a.usage).join(', ')}): ${bits}-bit, logical 0 to ${max}`,
        `Usage Page (Button) · Buttons 1 to ${NBUTTONS}: 1 bit each`,
        `Interrupt IN endpoint, ${hz} reports/s`,
      ],
      report: bytes,
    }
  },
}
