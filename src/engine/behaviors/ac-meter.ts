// ac-meter: what a true-RMS meter and a scope's measurement menu read from one or two channels.
//
// It integrates every instantaneous solve of the transient (Behavior.onStep: each step, edge
// substep and PWM piece), never the once-per-frame solution, so it can't alias with the frame rate.
// Each step adds its trapezoid-rule values of x, x², y, y², x·y, y', y'² and x·y' (y' the finite-
// difference slope, paired with x at the same midpoint) to exponential running means weighted by the
// step's dt (ratings.ts `mean()`), cascaded three deep so the ripple of a sine falls as (ωτ)⁻³.
// Means are normalised by the running mean of 1, so they are exact weighted averages from the first
// step after a reset. From them, per frame:
//   rms = √⟨x²⟩, dc = ⟨x⟩, acrms = √(⟨x²⟩ − ⟨x⟩²), amp = √2·acrms (the peak of a sine);
//   gain = acrmsB / acrms; phase = atan2(−cov(x, y'), cov(x, y)·σ(y')/σ(y)) of B against A
//   (for y = B·sin(ωt + φ) against x = A·sin ωt: cov(x, y) ∝ cos φ, cov(x, y') ∝ −sin φ);
//   vpp from the min / max of the last two blocks of samples (a block ≥ 1.25 periods, so it never
//   droops between peaks and forgets an old waveform within two blocks);
//   freq from the times of rising crossings through the mean (with hysteresis ±0.3·amp, each time
//   interpolated between steps), averaged over the same window.
//
// params:
//   kind        channel A: 'v' (node voltage, default), 'i' (element current), 'extra' (Solution.extra key)
//   node, ref   for 'v' (ref default ground); `a` is accepted for `node` (ac-oscilloscope)
//   element     for 'i'
//   key         for 'extra', e.g. 'T1.im'
//   kindB, nodeB, refB, elementB, keyB   optional channel B, the same way; `b` is accepted for `nodeB`
//   source      optional V element whose `wave.freq` sets the window floor before a frequency is measured
//   window      averaging window, s (default 0.2): stage τ = max(window/4, 2/f)
//   floor       below this AC RMS a channel counts as no signal (default 1e-6, V or A)
// Publishes: rms, dc, acrms, amp, vpp, freq, period; with channel B also rmsB, dcB, acrmsB, ampB,
// vppB, gain (ratio), gainPct (%), phase (°, + = B leads A).
//
// Lifecycle: the means restart on power-on / off, break, repair, strip and reset, and whenever the
// circuit's structure (a burn, a switch, a removed part) or a V / I source's setting (a tweak of the
// stimulus) changes; the readings stay 0 for the first max(window/8, one period) after a restart. A
// channel that isn't driven (node touched by nothing, or cut off from ground by open / burnt /
// disabled parts; a measured element that is gone or burnt) and a frame with no good solve read 0.
// Other changes (a resistor tweak) are tracked by the means within about a window.

import { OPEN_R } from '../sim/failures'
import type { Behavior, BehaviorContext, Element, Netlist, Solution } from '../types'

const STAGES = 3
/** quantities: 0 one, 1 x, 2 x², 3 y, 4 y², 5 xy, 6 y', 7 y'², 8 x·y' */
const NQ = 9
const HYST = 0.3

const KIND_V = 0
const KIND_I = 1
const KIND_X = 2

interface Channel {
  on: boolean
  kind: number
  node: string
  ref: string
  element: string
  key: string
  owner: string
  driven: boolean
}

interface State {
  params: unknown
  net: Netlist | null
  fp: number
  srcFreq: number
  a: Channel
  b: Channel
  window: number
  floor: number
  /** running means, stage-major: m[s * NQ + q] */
  m: Float64Array
  val: Float64Array
  lastT: number
  px: number
  py: number
  t0: number
  steps: number
  tau: number
  lastH: number
  alpha: number
  // crossings (channel A)
  mean: number
  hyst: number
  armed: boolean
  lastTc: number
  pW: number
  pM: number
  // min / max blocks
  blockT: number
  hiA: number
  loA: number
  hiA0: number
  loA0: number
  hiB: number
  loB: number
  hiB0: number
  loB0: number
}

const channel = (): Channel => ({ on: false, kind: KIND_V, node: '', ref: '', element: '', key: '', owner: '', driven: false })

function fresh(): State {
  const st: State = {
    params: null,
    net: null,
    fp: 0,
    srcFreq: 0,
    a: channel(),
    b: channel(),
    window: 0.2,
    floor: 1e-6,
    m: new Float64Array(STAGES * NQ),
    val: new Float64Array(NQ),
    lastT: NaN,
    px: 0,
    py: 0,
    t0: NaN,
    steps: 0,
    tau: 0.05,
    lastH: NaN,
    alpha: 0,
    mean: NaN,
    hyst: NaN,
    armed: false,
    lastTc: NaN,
    pW: 0,
    pM: 0,
    blockT: NaN,
    hiA: -Infinity,
    loA: Infinity,
    hiA0: -Infinity,
    loA0: Infinity,
    hiB: -Infinity,
    loB: Infinity,
    hiB0: -Infinity,
    loB0: Infinity,
  }
  return st
}

/** forget every measurement (keeps the resolved channels and the netlist cache) */
function restart(st: State): void {
  st.m.fill(0)
  st.lastT = st.t0 = st.blockT = st.lastTc = st.mean = st.hyst = st.lastH = NaN
  st.armed = false
  st.pW = st.pM = 0
  st.hiA = st.hiA0 = st.hiB = st.hiB0 = -Infinity
  st.loA = st.loA0 = st.loB = st.loB0 = Infinity
}

const states = new WeakMap<BehaviorContext, State>()
function stateOf(ctx: BehaviorContext): State {
  let st = states.get(ctx)
  if (!st) states.set(ctx, (st = fresh()))
  return st
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v === undefined ? '' : String(v))
const kindOf = (v: unknown) => (v === 'i' ? KIND_I : v === 'extra' ? KIND_X : KIND_V)

function setChannel(c: Channel, p: Record<string, unknown>, sfx: '' | 'B', alias: string): void {
  c.kind = kindOf(p[`kind${sfx}`])
  c.node = str(p[`node${sfx}`] ?? p[alias])
  c.ref = str(p[`ref${sfx}`])
  if (c.ref === '0') c.ref = ''
  c.element = str(p[`element${sfx}`])
  c.key = str(p[`key${sfx}`])
  const dot = c.key.indexOf('.')
  c.owner = dot < 0 ? c.key : c.key.slice(0, dot)
  c.on = c.kind === KIND_V ? c.node !== '' : c.kind === KIND_I ? c.element !== '' : c.key !== ''
}

function readParams(st: State, ctx: BehaviorContext): void {
  const p = ctx.params
  st.params = p
  setChannel(st.a, p, '', 'a')
  setChannel(st.b, p, 'B', 'b')
  const w = Number(p.window)
  st.window = w > 0 ? w : 0.2
  const f = Number(p.floor)
  st.floor = f > 0 ? f : 1e-6
  st.net = null // the source and the driven flags depend on the params too
}

// ── netlist: a fingerprint of structure and stimulus, and which nodes are driven ──

const F64 = new Float64Array(1)
const I32 = new Int32Array(F64.buffer)
const mix = (h: number, n: number) => Math.imul(h ^ n, 0x01000193)
function mixNum(h: number, x: number): number {
  F64[0] = x
  return mix(mix(h, I32[0]), I32[1])
}
function mixStr(h: number, s: string): number {
  for (let i = 0; i < s.length; i++) h = mix(h, s.charCodeAt(i))
  return mix(h, 0x2f)
}

/** a part that conducts nothing (open, burnt open, thermally off, blown, an open switch) */
function isCut(e: Element): boolean {
  if (e.disabled) return true
  if (e.type === 'R') return e.value >= OPEN_R
  if (e.type === 'SW') return !e.closed
  if (e.type === 'FUSE') return !!e.blown
  return false
}

function fingerprint(n: Netlist): number {
  let h = 0x811c9dc5
  for (const e of n.elements) {
    h = mixStr(mixStr(h, e.id), e.type)
    for (const node of e.nodes) h = mixStr(h, node)
    h = mix(h, isCut(e) ? 1 : 0)
    if (e.type === 'V' || e.type === 'I') {
      h = mixNum(h, e.value)
      if (e.type === 'V' && e.wave) {
        const w = e.wave
        h = mixNum(mixNum(mixNum(mixNum(mixStr(h, w.kind), w.amp), w.freq), w.offset ?? 0), w.phase ?? 0)
      }
    }
  }
  return h
}

/** nodes joined to ground through parts that conduct (rare: only when the structure changes) */
function groundedNodes(n: Netlist): Set<string> {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    parent.set(x, r)
    return r
  }
  for (const e of n.elements) {
    if (isCut(e)) continue
    for (const node of e.nodes) if (!parent.has(node)) parent.set(node, node)
    const r0 = find(e.nodes[0])
    for (let k = 1; k < e.nodes.length; k++) {
      const r = find(e.nodes[k])
      if (r !== r0) parent.set(r, r0)
    }
  }
  const out = new Set<string>()
  if (!parent.has('0')) return out
  const g = find('0')
  for (const node of parent.keys()) if (find(node) === g) out.add(node)
  return out
}

function isDriven(c: Channel, n: Netlist, grounded: Set<string>): boolean {
  if (!c.on) return false
  if (c.kind === KIND_V) return grounded.has(c.node) && (c.ref === '' || grounded.has(c.ref))
  const id = c.kind === KIND_I ? c.element : c.owner
  const e = n.elements.find((x) => x.id === id)
  return !!e && !isCut(e)
}

/** check the netlist (cheap identity test per step; the work only when it changed) */
function syncNetlist(st: State, ctx: BehaviorContext): void {
  if (ctx.params !== st.params) readParams(st, ctx)
  const n = ctx.netlist
  if (n === st.net) return
  const first = st.net === null
  st.net = n
  const fp = fingerprint(n)
  if (!first && fp === st.fp) return
  st.fp = fp
  const g = groundedNodes(n)
  st.a.driven = isDriven(st.a, n, g)
  st.b.driven = isDriven(st.b, n, g)
  const src = n.elements.find((e) => e.id === ctx.params.source)
  st.srcFreq = src && src.type === 'V' && src.wave && src.wave.amp !== 0 ? src.wave.freq : 0
  restart(st)
}

function read(c: Channel, s: Solution): number {
  if (c.kind === KIND_V) {
    const v = s.voltageOf ? s.voltageOf(c.node) : (s.nodeV[c.node] ?? 0)
    if (c.ref === '') return v
    return v - (s.voltageOf ? s.voltageOf(c.ref) : (s.nodeV[c.ref] ?? 0))
  }
  if (c.kind === KIND_I) return s.currentOf ? s.currentOf(c.element) : (s.current[c.element] ?? 0)
  return s.extraOf ? s.extraOf(c.owner, c.key) : (s.extra[c.key] ?? 0)
}

/** the frequency the window and the blocks adapt to: the source's setting, else the measured one */
function freqHint(st: State): number {
  if (st.srcFreq > 0) return st.srcFreq
  return st.pW > 0 && st.pM > 0 ? st.pW / st.pM : 0
}

function step(st: State, t: number, x: number, y: number): void {
  if (!Number.isFinite(x)) x = 0
  if (!Number.isFinite(y)) y = 0
  const t1 = st.lastT
  if (!(t > t1)) {
    if (t1 !== t1) {
      // the first sample after a restart: it only seeds the trapezoid
      st.lastT = st.t0 = st.blockT = t
      st.px = x
      st.py = y
    }
    return
  }
  const h = t - t1
  const px = st.px
  const py = st.py
  if (h !== st.lastH) {
    st.lastH = h
    st.alpha = 1 - Math.exp(-h / st.tau)
  }
  const a = st.alpha
  const xm = 0.5 * (x + px)
  const yd = (y - py) / h
  const v = st.val
  v[0] = 1
  v[1] = xm
  v[2] = 0.5 * (x * x + px * px)
  v[3] = 0.5 * (y + py)
  v[4] = 0.5 * (y * y + py * py)
  v[5] = 0.5 * (x * y + px * py)
  v[6] = yd
  v[7] = yd * yd
  v[8] = xm * yd
  const m = st.m
  for (let q = 0; q < NQ; q++) {
    let u = v[q]
    for (let s = 0; s < STAGES; s++) {
      const k = s * NQ + q
      u = m[k] += (u - m[k]) * a
    }
  }

  // rising crossings through the mean (level and band from the last tick)
  const hy = st.hyst
  if (hy > 0) {
    const d = x - st.mean
    if (d < -hy) st.armed = true
    else if (st.armed && d >= 0) {
      st.armed = false
      const d0 = px - st.mean
      const tc = t1 + (d0 < 0 ? (h * -d0) / (d - d0) : 0)
      const lc = st.lastTc
      if (lc === lc) {
        const p = tc - lc
        const ap = 1 - Math.exp(-p / st.tau)
        st.pW += (1 - st.pW) * ap
        st.pM += (p - st.pM) * ap
      }
      st.lastTc = tc
    }
  }

  // min / max blocks
  if (t - st.blockT >= block(st)) {
    st.blockT = t
    st.hiA0 = st.hiA
    st.loA0 = st.loA
    st.hiB0 = st.hiB
    st.loB0 = st.loB
    st.hiA = st.hiB = -Infinity
    st.loA = st.loB = Infinity
  }
  if (x > st.hiA) st.hiA = x
  if (x < st.loA) st.loA = x
  if (y > st.hiB) st.hiB = y
  if (y < st.loB) st.loB = y

  st.lastT = t
  st.px = x
  st.py = y
  st.steps++
}

function block(st: State): number {
  const f = freqHint(st)
  return f > 0 ? Math.max(st.window / 4, 1.25 / f) : st.window / 4
}

const KEYS_A = ['rms', 'dc', 'acrms', 'amp', 'vpp', 'freq', 'period'] as const
const KEYS_B = ['rmsB', 'dcB', 'acrmsB', 'ampB', 'vppB', 'gain', 'gainPct', 'phase'] as const

function publishZeros(ctx: BehaviorContext, st: State, a: boolean, b: boolean): void {
  if (a) for (const k of KEYS_A) ctx.publish(k, 0)
  if (b && st.b.on) for (const k of KEYS_B) ctx.publish(k, 0)
}

export const behavior: Behavior = {
  id: 'ac-meter',

  onStep(ctx, t, s) {
    const st = stateOf(ctx)
    syncNetlist(st, ctx)
    if (!st.a.driven && !st.b.driven) return
    step(st, t, st.a.driven ? read(st.a, s) : 0, st.b.driven ? read(st.b, s) : 0)
  },

  tick(ctx, dt) {
    const st = stateOf(ctx)
    syncNetlist(st, ctx)
    const steps = st.steps
    st.steps = 0
    if (!(dt > 0)) return // slow motion: no step this frame, the readings stand
    const { a, b } = st
    const f0 = freqHint(st)
    const warm = Math.max(st.window / 8, f0 > 0 ? 1 / f0 : 0)
    const w = st.m[(STAGES - 1) * NQ]
    if (steps === 0 || !(w > 0) || !(st.lastT - st.t0 >= warm)) {
      publishZeros(ctx, st, true, true)
      return
    }
    const k0 = (STAGES - 1) * NQ
    const M = (q: number) => st.m[k0 + q] / w
    const floor = st.floor
    const tau = Math.max(st.window / 4, f0 > 0 ? 2 / f0 : 0)
    if (tau !== st.tau) {
      st.tau = tau
      st.lastH = NaN
    }

    // channel A
    let acA = 0
    if (a.driven) {
      const dc = M(1)
      const ms = Math.max(0, M(2))
      acA = Math.sqrt(Math.max(0, ms - dc * dc))
      if (acA < floor || acA < 1e-7 * Math.sqrt(ms)) acA = 0
      st.mean = dc
      st.hyst = acA > 0 ? HYST * Math.SQRT2 * acA : NaN
      let vpp = Math.max(st.hiA, st.hiA0) - Math.min(st.loA, st.loA0)
      if (!(vpp > 2 * Math.SQRT2 * floor)) vpp = 0
      let freq = 0
      const per = st.pW > 0 ? st.pM / st.pW : 0
      if (acA > 0 && per > 0 && st.lastT - st.lastTc < 2.5 * per) freq = 1 / per
      ctx.publish('rms', Math.sqrt(ms))
      ctx.publish('dc', dc)
      ctx.publish('acrms', acA)
      ctx.publish('amp', Math.SQRT2 * acA)
      ctx.publish('vpp', vpp)
      ctx.publish('freq', freq)
      ctx.publish('period', freq > 0 ? 1 / freq : 0)
    } else {
      st.hyst = NaN
      publishZeros(ctx, st, true, false)
    }
    if (!b.on) return

    // channel B and the ratios
    if (!b.driven) {
      publishZeros(ctx, st, false, true)
      return
    }
    const dcB = M(3)
    const msB = Math.max(0, M(4))
    let acB = Math.sqrt(Math.max(0, msB - dcB * dcB))
    if (acB < floor || acB < 1e-7 * Math.sqrt(msB)) acB = 0
    let vppB = Math.max(st.hiB, st.hiB0) - Math.min(st.loB, st.loB0)
    if (!(vppB > 2 * Math.SQRT2 * floor)) vppB = 0
    ctx.publish('rmsB', Math.sqrt(msB))
    ctx.publish('dcB', dcB)
    ctx.publish('acrmsB', acB)
    ctx.publish('ampB', Math.SQRT2 * acB)
    ctx.publish('vppB', vppB)
    const gain = acA > 0 ? acB / acA : 0
    ctx.publish('gain', gain)
    ctx.publish('gainPct', 100 * gain)
    let phase = 0
    const sdB = Math.sqrt(Math.max(0, M(7) - M(6) * M(6)))
    if (acA > 0 && acB > 0 && sdB > 0) {
      const cxy = M(5) - M(1) * dcB
      const cxd = M(8) - M(1) * M(6)
      phase = (Math.atan2(-cxd * acB, cxy * sdB) * 180) / Math.PI
    }
    ctx.publish('phase', phase)
  },

  onEvent(ctx, ev) {
    if (ev === 'upload') return
    const st = stateOf(ctx)
    restart(st)
    st.steps = 0
  },

  reset(ctx) {
    restart(stateOf(ctx))
  },
}
