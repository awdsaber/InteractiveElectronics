// HX711 (Avia Semiconductor) 24-bit bridge ADC on a strain-gauge load cell.
//
// The bridge is in the netlist as four real resistors (two gauges in tension, two in compression),
// so the millivolt signal is solved, not computed. Each tick the behavior sets the gauges from the
// load: tension arms R0·(1 + s), compression arms R0·(1 − s), with
//   s = ratedOutput[V/V] × (mass + creep + permanent set) / capacity + zero balance[V/V],
// which gives the full-bridge result V(A+) − V(A−) = V(E+) × s exactly.
//
// The converter reads the differential input and AVDD on every transient step (onStep) and
// averages Vin / AVDD over each conversion period (1/10 s or 1/80 s). Datasheet (Avia HX711):
//   full-scale differential input = ±0.5 × AVDD / gain (gain 128: ±16.8 mV at 4.3 V, ±19.5 mV at 5 V)
//   so code = Vin / AVDD × gain × 2^24, rounded, clamped to 24-bit two's complement
//   (0x800000 .. 0x7FFFFF): the reading is ratiometric to AVDD
//   output data rate 10 or 80 SPS (RATE pin), settling 4 periods (400 ms / 50 ms) after power-up,
//   a gain or rate change, or power_up()
//   input noise 50 nV rms (gain 128, 10 SPS) and 90 nV rms (80 SPS); DVDD 2.6..5.5 V
//   channel A gain 128 or 64; gain 32 selects channel B (not wired here: noise only)
//
// Load cell mechanics (illustrative where marked; check your cell's datasheet):
//   creep: first-order, τ = creepTau, reaching creepPct % of the applied load after 30 min
//   (illustrative 0.05 %), and recovering the same way once unloaded
//   overload: the peak load beyond the safe overload (safePct, 120 % of capacity on typical bar
//   cells) leaves a permanent set of setPct g per g beyond it (illustrative 0.2), kept until
//   Repair (a new cell)
//   shockG: a push of that many grams for shockS seconds whenever the param becomes non-zero
//   (a failure patch: "lean on the pan")
//
// Excitation noise: `noiseEl` names a V source in series with the supply that the behavior drives
// with a slow random wander of railNoiseMv mV rms (τ = railTau). A regulated AVDD rejects it; a
// bridge excited from the raw rail turns it into "weight".
//
// Library: a bogde-style `HX711` class and a ready-made `scale` object: begin(dout, sck, gain=128),
// is_ready(), wait_ready(), read(), read_average(n), get_value(n), get_units(n), tare(n),
// set_scale(f), get_scale(), set_offset(o), get_offset(), set_gain(g), power_down(), power_up().
// The real library blocks in read() until DOUT goes low (up to 100 ms at 10 SPS, so get_units(5)
// takes about 0.5 s). Library calls here cannot block, so read() returns the latest conversion and
// read_average(n) averages the n most recent ones: pace the sketch with delay(). begin() on pins
// other than the wired `dout` / `sck` never sees data ready, and read() returns 0.
//
// Params [defaults]: supply ['5v'], avdd ['avdd'], inP ['ap'], inN ['an'], exc ['ep'],
//   gauges ['sg1,sg2,sg3,sg4'] (compression, tension, tension, compression), r0 [1000],
//   capacityG [1000], mvPerV [1.0], zeroMvV [0], massG [0], shockG [0], shockS [1],
//   safePct [120], setPct [0.2], creepPct [0.05], creepTau [600 s], rate [10], gain [128],
//   noiseNv [50], noise80Nv [90], dout [3], sck [2], vMin [2.6], noiseEl [''], railNoiseMv [0],
//   railTau [0.3 s], seed [1]
// Publishes: true_g, load_g, creep_g, set_g, dR (tension-arm ΔR from load, Ω), vdiff_uV, avdd_V,
//   exc_V, raw, conversions (since power-on), sps, gain, down, counts_per_g (live, from E+ / AVDD).

import type { Behavior, BehaviorContext, Solution } from '../types'

export const CODE_MAX = 0x7fffff
export const CODE_MIN = -0x800000
const FS = 2 ** 24
const SETTLE = 4
const RING = 64

/** Vin / AVDD → 24-bit two's-complement code at this gain */
export function codeFor(ratio: number, gain: number): number {
  const c = Math.round(ratio * gain * FS)
  return c > CODE_MAX ? CODE_MAX : c < CODE_MIN ? CODE_MIN : c
}

/** counts per gram for a cell of `mvPerV` at `capacityG`, excited at excOverAvdd × AVDD */
export function countsPerGram(mvPerV: number, capacityG: number, gain: number, excOverAvdd: number): number {
  return ((mvPerV * 1e-3) / capacityG) * excOverAvdd * gain * FS
}

/** one creep step: first-order toward k × load, k set so that it reaches pct % at 30 min */
export function creepStep(creep: number, load: number, dt: number, pct: number, tau: number): number {
  const k = pct / 100 / (1 - Math.exp(-1800 / tau))
  return creep + (k * load - creep) * (1 - Math.exp(-dt / tau))
}

/** permanent set (g) after a peak load beyond the safe overload */
export function overloadSet(peakG: number, safeG: number, setPerG: number): number {
  return peakG > safeG ? (peakG - safeG) * setPerG : 0
}

interface State {
  // converter
  acc: number
  accT: number
  tPrev: number
  settle: number
  rateSeen: number
  gainSeen: number
  ring: Float64Array
  head: number
  count: number
  seq: number
  lastCode: number
  down: boolean
  chipGain: number
  wired: boolean
  vdiff: number
  avdd: number
  exc: number
  // mechanics
  creep: number
  peak: number
  shockSeen: number
  shockUntil: number
  rail: number
  rng: () => number
  spare: number
  gaugeList: string
  gauges: string[]
}

const states = new WeakMap<BehaviorContext, State>()

function prng(seed: number): () => number {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const num = (ctx: BehaviorContext, k: string, d: number): number => {
  const v = ctx.params[k]
  return typeof v === 'number' ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d
}
const str = (ctx: BehaviorContext, k: string, d: string): string => {
  const v = ctx.params[k]
  return typeof v === 'string' ? v : d
}
const volts = (s: Solution, node: string): number => {
  if (node === '0') return 0
  const v = s.voltageOf ? s.voltageOf(node) : s.nodeV[node]
  // a node no element touches any more (a broken wire) reads as ground, like the solver's gmin
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function stateOf(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = {
      acc: 0,
      accT: 0,
      tPrev: -1,
      settle: SETTLE,
      rateSeen: 0,
      gainSeen: 0,
      ring: new Float64Array(RING),
      head: 0,
      count: 0,
      seq: 0,
      lastCode: 0,
      down: false,
      chipGain: 128,
      wired: true,
      vdiff: 0,
      avdd: 0,
      exc: 0,
      creep: 0,
      peak: 0,
      shockSeen: 0,
      shockUntil: -1,
      rail: 0,
      rng: prng(num(ctx, 'seed', 1)),
      spare: NaN,
      gaugeList: '',
      gauges: [],
    }
    states.set(ctx, s)
  }
  return s
}

function gauss(st: State): number {
  if (!Number.isNaN(st.spare)) {
    const g = st.spare
    st.spare = NaN
    return g
  }
  const u = Math.max(1e-12, st.rng())
  const v = st.rng()
  const r = Math.sqrt(-2 * Math.log(u))
  st.spare = r * Math.sin(2 * Math.PI * v)
  return r * Math.cos(2 * Math.PI * v)
}

/** forget the conversions in flight: power-up, rate or gain change, power_up() */
function restartConversions(st: State): void {
  st.acc = 0
  st.accT = 0
  st.tPrev = -1
  st.settle = SETTLE
}

function clearConversions(st: State): void {
  restartConversions(st)
  st.head = 0
  st.count = 0
  st.seq = 0
  st.lastCode = 0
  st.vdiff = 0
  st.avdd = 0
  st.exc = 0
}

const rateOf = (ctx: BehaviorContext): number => (num(ctx, 'rate', 10) >= 45 ? 80 : 10)
const gainOf = (ctx: BehaviorContext, st: State): number => {
  const g = st.chipGain || num(ctx, 'gain', 128)
  return g === 64 || g === 32 ? g : 128
}

function loadOf(ctx: BehaviorContext, st: State): number {
  const mass = Math.max(0, num(ctx, 'massG', 0))
  return mass + (ctx.t < st.shockUntil ? Math.max(0, num(ctx, 'shockG', 0)) : 0)
}

function setOf(ctx: BehaviorContext, st: State): number {
  const cap = num(ctx, 'capacityG', 1000)
  return overloadSet(st.peak, (num(ctx, 'safePct', 120) / 100) * cap, num(ctx, 'setPct', 0.2))
}

function makeLibrary(ctx: BehaviorContext) {
  const st = () => stateOf(ctx)
  const live = () => {
    const s = st()
    return s.wired && !s.down && ctx.powered
  }
  const average = (times: unknown): number => {
    const s = st()
    if (!s.wired || s.count === 0) return 0
    const n = Math.min(s.count, RING, Math.max(1, Math.trunc(Number(times) || 1)))
    let sum = 0
    for (let i = 0; i < n; i++) sum += s.ring[(s.head - 1 - i + RING * 2) % RING]
    return sum / n
  }
  class HX711 {
    private offset = 0
    private scaleF = 1
    private readSeq = 0
    begin(dout?: unknown, sck?: unknown, gain?: unknown) {
      const s = st()
      s.wired = Math.trunc(Number(dout)) === num(ctx, 'dout', 3) && Math.trunc(Number(sck)) === num(ctx, 'sck', 2)
      this.set_gain(gain === undefined ? 128 : gain)
    }
    is_ready() {
      return live() && st().seq > this.readSeq
    }
    wait_ready() {
      return undefined
    }
    wait_ready_retry() {
      return live() && st().count > 0
    }
    wait_ready_timeout() {
      return live() && st().count > 0
    }
    read() {
      const s = st()
      this.readSeq = s.seq
      return s.wired ? s.lastCode : 0
    }
    read_average(times?: unknown) {
      this.readSeq = st().seq
      return Math.round(average(times ?? 10))
    }
    get_value(times?: unknown) {
      this.readSeq = st().seq
      return average(times ?? 1) - this.offset
    }
    get_units(times?: unknown) {
      return this.get_value(times ?? 1) / this.scaleF
    }
    tare(times?: unknown) {
      this.offset = Math.round(average(times ?? 10))
      this.readSeq = st().seq
    }
    set_scale(f?: unknown) {
      const v = Number(f ?? 1)
      this.scaleF = Number.isFinite(v) && v !== 0 ? v : 1
    }
    get_scale() {
      return this.scaleF
    }
    set_offset(o: unknown) {
      this.offset = Math.trunc(Number(o) || 0)
    }
    get_offset() {
      return this.offset
    }
    set_gain(g?: unknown) {
      const s = st()
      const v = Math.trunc(Number(g ?? 128))
      const next = v === 64 || v === 32 ? v : 128
      if (next !== s.chipGain) {
        s.chipGain = next
        restartConversions(s)
      }
    }
    get_gain() {
      return st().chipGain
    }
    power_down() {
      st().down = true
    }
    power_up() {
      const s = st()
      if (s.down) {
        s.down = false
        restartConversions(s)
      }
    }
  }
  return { HX711, scale: new HX711() }
}

export const behavior: Behavior = {
  id: 'hx711',

  libraries: makeLibrary,

  init(ctx) {
    stateOf(ctx).chipGain = num(ctx, 'gain', 128)
  },

  onStep(ctx, t, s) {
    const st = stateOf(ctx)
    const rate = rateOf(ctx)
    const gain = gainOf(ctx, st)
    if (rate !== st.rateSeen || gain !== st.gainSeen) {
      st.rateSeen = rate
      st.gainSeen = gain
      restartConversions(st)
    }
    const avdd = volts(s, str(ctx, 'avdd', 'avdd'))
    const vdiff = volts(s, str(ctx, 'inP', 'ap')) - volts(s, str(ctx, 'inN', 'an'))
    st.vdiff = vdiff
    st.avdd = avdd
    st.exc = volts(s, str(ctx, 'exc', 'ep'))
    const dt = st.tPrev >= 0 ? t - st.tPrev : 0
    st.tPrev = t
    if (st.down || volts(s, str(ctx, 'supply', '5v')) < num(ctx, 'vMin', 2.6) || avdd < 0.5) {
      restartConversions(st)
      return
    }
    if (dt <= 0) return
    // channel B (gain 32) is not wired: it sees no bridge signal
    const ratio = gain === 32 ? 0 : vdiff / avdd
    st.acc += ratio * dt
    st.accT += dt
    const period = 1 / rate
    if (st.accT < period - 1e-9) return
    const mean = st.acc / st.accT
    st.acc = 0
    st.accT = 0
    if (st.settle > 0) {
      st.settle--
      return
    }
    const nv = rate === 80 ? num(ctx, 'noise80Nv', 90) : num(ctx, 'noiseNv', 50)
    const noise = nv > 0 ? (gauss(st) * nv * 1e-9) / avdd : 0
    const code = codeFor(mean + noise, gain)
    st.lastCode = code
    st.ring[st.head] = code
    st.head = (st.head + 1) % RING
    st.count = Math.min(RING, st.count + 1)
    st.seq++
  },

  tick(ctx, dt) {
    const st = stateOf(ctx)
    const cap = num(ctx, 'capacityG', 1000)
    // a push on the pan whenever shockG becomes non-zero
    const shock = num(ctx, 'shockG', 0)
    if (shock > 0 && shock !== st.shockSeen) st.shockUntil = ctx.t + num(ctx, 'shockS', 1)
    st.shockSeen = shock > 0 ? shock : 0
    const load = loadOf(ctx, st)
    if (dt > 0) st.creep = creepStep(st.creep, load, dt, num(ctx, 'creepPct', 0.05), num(ctx, 'creepTau', 600))
    st.peak = Math.max(st.peak, load + st.creep)
    const set = setOf(ctx, st)
    const strain = ((num(ctx, 'mvPerV', 1.0) * 1e-3) / cap) * (load + st.creep + set)
    const s = strain + num(ctx, 'zeroMvV', 0) * 1e-3
    const list = str(ctx, 'gauges', 'sg1,sg2,sg3,sg4')
    if (list !== st.gaugeList) {
      st.gaugeList = list
      st.gauges = list
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    }
    const r0 = num(ctx, 'r0', 1000)
    const g = st.gauges
    if (g.length === 4) {
      ctx.setParam(g[0], 'value', r0 * (1 - s))
      ctx.setParam(g[1], 'value', r0 * (1 + s))
      ctx.setParam(g[2], 'value', r0 * (1 + s))
      ctx.setParam(g[3], 'value', r0 * (1 - s))
    }
    // excitation noise: a slow random wander on the supply (Ornstein-Uhlenbeck, rms railNoiseMv)
    const noiseEl = str(ctx, 'noiseEl', '')
    if (noiseEl) {
      const sigma = Math.max(0, num(ctx, 'railNoiseMv', 0)) * 1e-3
      const tau = Math.max(1e-3, num(ctx, 'railTau', 0.3))
      if (sigma === 0) st.rail = 0
      else if (dt > 0) {
        const a = Math.exp(-dt / tau)
        st.rail = st.rail * a + sigma * Math.sqrt(1 - a * a) * gauss(st)
      }
      ctx.setParam(noiseEl, 'value', st.rail)
    }

    const gain = gainOf(ctx, st)
    ctx.publish('true_g', Math.max(0, num(ctx, 'massG', 0)))
    ctx.publish('load_g', load)
    ctx.publish('creep_g', st.creep)
    ctx.publish('set_g', set)
    ctx.publish('dR', r0 * strain)
    ctx.publish('vdiff_uV', st.vdiff * 1e6)
    ctx.publish('avdd_V', st.avdd)
    ctx.publish('exc_V', st.exc)
    ctx.publish('raw', st.lastCode)
    ctx.publish('conversions', st.seq)
    ctx.publish('sps', rateOf(ctx))
    ctx.publish('gain', gain)
    ctx.publish('down', st.down ? 1 : 0)
    ctx.publish('counts_per_g', st.avdd > 0.5 ? countsPerGram(num(ctx, 'mvPerV', 1.0), cap, gain, st.exc / st.avdd) : 0)
  },

  onEvent(ctx, ev) {
    const st = stateOf(ctx)
    if (ev === 'power-on' || ev === 'power-off') {
      clearConversions(st)
      st.down = false
    }
    if (ev === 'upload') {
      // the new sketch's begin() picks its pins and gain
      st.wired = true
      st.down = false
    }
  },

  reset(ctx) {
    // Repair fits a new cell: no creep history, no permanent set
    const st = stateOf(ctx)
    st.creep = 0
    st.peak = 0
    st.shockSeen = 0
    st.shockUntil = -1
    st.rail = 0
    st.down = false
    st.chipGain = num(ctx, 'gain', 128)
    restartConversions(st)
  },
}
