// Per-element MNA stamps (including Newton companions for nonlinear parts)
// and post-solve measurement (currents, power, extras).

import type { Element, LedColor, Netlist, NodeId, PinState } from '../types'
import {
  type LinearSystem,
  addA,
  addB,
  stampConductance,
  stampCurrent,
  stampNonlinear,
  stampVoltageSource,
} from './mna'

// ───────────────────────── constants ─────────────────────────

/** thermal voltage kT/q at 300 K */
export const VT = 0.025852
/** minimum conductance from every node to ground */
export const GMIN = 1e-12
export const R_MIN = 1e-6
export const SW_RON = 0.05
export const SW_ROFF = 1e9
export const PIN_ROUT = 25
export const PIN_RPULLUP = 35e3
export const PIN_RIN = 1e9
export const OPAMP_GAIN = 1e5
export const NMOS_VTH = 2
export const MOS_K = 1 // A/V², id = k/2·(Vgs-Vth)² in saturation
export const BJT_BETA = 100
export const BJT_BETA_R = 1
export const BJT_IS = 1e-14
export const DIODE_IS = 1e-14
export const MOTOR_J = 1e-6
/** load torque ramps in over ±this speed so a stalled motor isn't driven backwards */
export const MOTOR_LOAD_W = 1 // rad/s
/** zener breakdown current at exactly V = -vz */
export const ZENER_IZT = 5e-3

/** LED forward voltage at 20 mA (typical 5 mm parts) */
export const LED_VF: Record<LedColor, number> = { red: 1.8, yellow: 2.0, green: 2.1, blue: 2.9, white: 2.9 }
export const LED_N = 2
export const LED_RS = 5
const LED_IREF = 0.02

const SQRT2 = Math.SQRT2
const EXP_MAX = 80
const EXP_MAX_VAL = Math.exp(EXP_MAX)

/** exp() with a linear continuation above EXP_MAX so huge junction voltages stay finite */
export function safeExp(x: number): number {
  return x > EXP_MAX ? EXP_MAX_VAL * (1 + (x - EXP_MAX)) : Math.exp(x)
}
/** derivative of safeExp */
export function safeExpD(x: number): number {
  return x > EXP_MAX ? EXP_MAX_VAL : Math.exp(x)
}

/** SPICE pnjlim: limit a junction-voltage Newton step to a logarithmic increase */
export function pnjlim(vnew: number, vold: number, vt: number, vcrit: number): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt
      return arg > 0 ? vold + vt * Math.log(arg) : vcrit
    }
    return vnew > vt ? vt * Math.log(vnew / vt) : vnew
  }
  return vnew
}

const vcritOf = (nvt: number, is: number) => nvt * Math.log(nvt / (SQRT2 * is))

export function ledSaturationCurrent(color: LedColor): number {
  const vj = LED_VF[color] - LED_IREF * LED_RS
  return LED_IREF / (Math.exp(vj / (LED_N * VT)) - 1)
}

interface DiodeParams {
  is: number
  n: number
  rs: number
}

function diodeParams(el: Element): DiodeParams {
  if (el.type === 'LED') return { is: ledSaturationCurrent(el.color), n: LED_N, rs: LED_RS }
  if (el.type === 'D') return { is: el.is ?? DIODE_IS, n: el.n ?? 1, rs: el.rs ?? 0 }
  return { is: DIODE_IS, n: 1, rs: 0 }
}

// ───────────────────────── compiled netlist ─────────────────────────

export interface Dev {
  el: Element
  /** terminal node indices (-1 = ground), followed by any internal nodes */
  n: number[]
  /** first branch-variable index, -1 if none */
  br: number
}

export interface Compiled {
  /** index -> node name; internal nodes are named `${id}#…` */
  nodeNames: NodeId[]
  nodeIndex: Map<NodeId, number>
  nNodes: number
  size: number
  devs: Dev[]
  nonlinear: boolean
}

function branchCount(el: Element): number {
  switch (el.type) {
    case 'V':
    case 'PROBE':
    case 'L':
    case 'OPAMP':
      return 1
    case 'MOTOR':
      return 2 // winding current, shaft speed ω
    default:
      return 0
  }
}

function isNonlinear(el: Element): boolean {
  switch (el.type) {
    case 'D':
    case 'LED':
    case 'ZENER':
    case 'NPN':
    case 'PNP':
    case 'NMOS':
    case 'PMOS':
    case 'OPAMP':
      return true
    case 'MOTOR':
      return (el.load ?? 0) !== 0
    default:
      return false
  }
}

export function compile(netlist: Netlist): Compiled {
  const nodeIndex = new Map<NodeId, number>()
  const nodeNames: NodeId[] = []
  const node = (id: NodeId): number => {
    if (id === '0') return -1
    let i = nodeIndex.get(id)
    if (i === undefined) {
      i = nodeNames.length
      nodeIndex.set(id, i)
      nodeNames.push(id)
    }
    return i
  }
  const devs: Dev[] = netlist.elements.map((el) => ({ el, n: el.nodes.map(node), br: -1 }))
  for (const d of devs) {
    if ((d.el.type === 'D' || d.el.type === 'LED') && diodeParams(d.el).rs > 0) d.n.push(node(`${d.el.id}#a`))
  }
  const nNodes = nodeNames.length
  let size = nNodes
  for (const d of devs) {
    const nb = branchCount(d.el)
    if (nb > 0) {
      d.br = size
      size += nb
    }
  }
  return { nodeNames, nodeIndex, nNodes, size, devs, nonlinear: devs.some((d) => isNonlinear(d.el)) }
}

// ───────────────────────── stamping ─────────────────────────

/** dynamic state carried between transient steps */
export interface DynState {
  capV: Record<string, number>
  indI: Record<string, number>
  omega: Record<string, number>
}

export interface StampCtx {
  mode: 'dc' | 'tran'
  dt: number
  /** current Newton iterate */
  x: Float64Array
  prev: DynState
  pins: Record<number, PinState>
  /** per-device linearisation points from the previous iteration (keyed `${id}:${type}`) */
  lim: Record<string, number[]>
  /** set when any device limited its step this iteration */
  limited: boolean
  /** independent-source scale for source stepping */
  srcScale: number
}

const volt = (x: Float64Array, i: number) => (i < 0 ? 0 : x[i])

function limKey(el: Element) {
  return `${el.id}:${el.type}`
}

function limitedJunction(ctx: StampCtx, el: Element, slot: number, vnew: number, nvt: number, vcrit: number): number {
  const key = limKey(el)
  const mem = (ctx.lim[key] ??= [])
  const vold = mem[slot]
  let v = vnew
  if (vold !== undefined) {
    v = pnjlim(vnew, vold, nvt, vcrit)
    if (v !== vnew) ctx.limited = true
  }
  mem[slot] = v
  return v
}

interface JunctionEval {
  i: number
  g: number
}

function diodeEval(el: Element, vd: number): JunctionEval {
  const p = diodeParams(el)
  const nvt = p.n * VT
  let i = p.is * (safeExp(vd / nvt) - 1)
  let g = (p.is / nvt) * safeExpD(vd / nvt)
  if (el.type === 'ZENER') {
    const u = (-vd - el.vz) / VT
    i -= ZENER_IZT * safeExp(u)
    g += (ZENER_IZT / VT) * safeExpD(u)
  }
  return { i: i + GMIN * vd, g: g + GMIN }
}

function diodeLimit(ctx: StampCtx, el: Element, vnew: number): number {
  const p = diodeParams(el)
  const nvt = p.n * VT
  if (el.type !== 'ZENER') return limitedJunction(ctx, el, 0, vnew, nvt, vcritOf(nvt, p.is))
  // zener: limit the forward junction, or the breakdown "junction" u = -v - vz
  const key = limKey(el)
  const mem = (ctx.lim[key] ??= [])
  const vold = mem[0]
  let v = vnew
  if (vold !== undefined) {
    if (vnew >= -el.vz / 2) v = pnjlim(vnew, vold, nvt, vcritOf(nvt, p.is))
    else v = -pnjlim(-vnew - el.vz, -vold - el.vz, VT, vcritOf(VT, ZENER_IZT)) - el.vz
    if (v !== vnew) ctx.limited = true
  }
  mem[0] = v
  return v
}

interface BjtEval {
  ic: number
  ib: number
  /** dI/d(v1, v2) for currents into C, B, E (NPN sense) */
  G: [number, number][]
}

/** Ebers-Moll (transport form), NPN sense: v1 = Vbe, v2 = Vbc */
function bjtEval(is: number, bf: number, br: number, v1: number, v2: number): BjtEval {
  const icc = is * (safeExp(v1 / VT) - 1)
  const iec = is * (safeExp(v2 / VT) - 1)
  const gF = (is / VT) * safeExpD(v1 / VT)
  const gR = (is / VT) * safeExpD(v2 / VT)
  const ic = icc - iec * (1 + 1 / br)
  const ib = icc / bf + iec / br
  const G: [number, number][] = [
    [gF, -gR * (1 + 1 / br)],
    [gF / bf, gR / br],
    [-gF * (1 + 1 / bf), gR],
  ]
  return { ic, ib, G }
}

interface MosEval {
  id: number
  gm: number
  gds: number
}

/** square law, N sense, current into drain; symmetric for vds < 0 */
function mosEval(vgs: number, vds: number, vth: number, k: number): MosEval {
  if (vds < 0) {
    const r = mosEval(vgs - vds, -vds, vth, k)
    return { id: -r.id, gm: -r.gm, gds: r.gm + r.gds }
  }
  const vov = vgs - vth
  if (vov <= 0) return { id: 0, gm: 0, gds: 0 }
  if (vds < vov) return { id: k * (vov * vds - (vds * vds) / 2), gm: k * vds, gds: k * (vov - vds) }
  return { id: (k / 2) * vov * vov, gm: k * vov, gds: 0 }
}

function bjtSetup(d: Dev) {
  const el = d.el as Extract<Element, { type: 'NPN' | 'PNP' }>
  const [c, b, e] = d.n
  const p = el.type === 'NPN' ? 1 : -1
  const ctrl: [number, number][] = p > 0 ? [[b, e], [b, c]] : [[e, b], [c, b]]
  return { el, terms: [c, b, e], p, ctrl, is: el.is ?? BJT_IS, bf: el.beta ?? BJT_BETA }
}

function mosSetup(d: Dev) {
  const el = d.el as Extract<Element, { type: 'NMOS' | 'PMOS' }>
  const [dr, g, s] = d.n
  const p = el.type === 'NMOS' ? 1 : -1
  const ctrl: [number, number][] = p > 0 ? [[g, s], [dr, s]] : [[s, g], [s, dr]]
  // PMOS vth may be given as negative (datasheet style) or as a magnitude
  const vth = p > 0 ? (el.vth ?? NMOS_VTH) : Math.abs(el.vth ?? NMOS_VTH)
  return { el, terms: [dr, g, s], p, ctrl, vth, k: el.k ?? MOS_K }
}

function opampSetup(el: Extract<Element, { type: 'OPAMP' }>, srcScale: number) {
  const vPos = el.vPos * srcScale
  const vNeg = el.vNeg * srcScale
  return { gain: el.gain ?? OPAMP_GAIN, vm: (vPos + vNeg) / 2, vh: Math.max((vPos - vNeg) / 2, 1e-6), vPos, vNeg }
}

function pinNorton(el: Extract<Element, { type: 'PIN' }>, state: PinState | undefined, srcScale: number) {
  const mode = state?.mode ?? 'INPUT'
  if (mode === 'OUTPUT') {
    const level = Math.min(1, Math.max(0, state?.level ?? 0))
    return { g: 1 / Math.max(el.rOut ?? PIN_ROUT, R_MIN), vs: level * el.vcc * srcScale }
  }
  if (mode === 'INPUT_PULLUP') return { g: 1 / PIN_RPULLUP, vs: el.vcc * srcScale }
  return { g: 1 / PIN_RIN, vs: 0 }
}

function motorParams(el: Extract<Element, { type: 'MOTOR' }>) {
  return {
    r: Math.max(el.r, R_MIN),
    l: el.l ?? 0,
    ke: el.ke,
    kt: el.kt ?? el.ke,
    j: el.j ?? MOTOR_J,
    b: el.b ?? 0,
    load: el.load ?? 0,
  }
}

export function stampDevice(d: Dev, sys: LinearSystem, ctx: StampCtx): void {
  const el = d.el
  const [a, b] = d.n
  const x = ctx.x
  const tran = ctx.mode === 'tran'
  switch (el.type) {
    case 'R':
      stampConductance(sys, a, b, 1 / Math.max(el.value, R_MIN))
      return
    case 'SW':
      stampConductance(sys, a, b, 1 / (el.closed ? SW_RON : SW_ROFF))
      return
    case 'V':
      stampVoltageSource(sys, a, b, d.br, el.value * ctx.srcScale, el.rInternal ?? 0)
      return
    case 'PROBE':
      stampVoltageSource(sys, a, b, d.br, 0)
      return
    case 'I':
      stampCurrent(sys, a, b, el.value * ctx.srcScale)
      return
    case 'C': {
      if (!tran) return // open circuit at DC (node gmin keeps it solvable)
      const g = el.value / ctx.dt
      const vprev = ctx.prev.capV[el.id] ?? el.v0 ?? 0
      stampConductance(sys, a, b, g)
      stampCurrent(sys, a, b, -g * vprev)
      return
    }
    case 'L': {
      if (!tran) {
        stampVoltageSource(sys, a, b, d.br, 0)
        return
      }
      const req = el.value / ctx.dt
      const iprev = ctx.prev.indI[el.id] ?? el.i0 ?? 0
      stampVoltageSource(sys, a, b, d.br, -req * iprev, req)
      return
    }
    case 'PIN': {
      const { g, vs } = pinNorton(el, ctx.pins[el.pin], ctx.srcScale)
      stampConductance(sys, a, b, g)
      stampCurrent(sys, a, b, -g * vs)
      return
    }
    case 'D':
    case 'LED':
    case 'ZENER': {
      const { rs } = diodeParams(el)
      const ja = rs > 0 ? d.n[2] : a
      if (rs > 0) stampConductance(sys, a, ja, 1 / rs)
      const vd = diodeLimit(ctx, el, volt(x, ja) - volt(x, b))
      const { i, g } = diodeEval(el, vd)
      stampNonlinear(sys, [ja, b], [[ja, b]], [vd], [i, -i], [[g], [-g]])
      return
    }
    case 'NPN':
    case 'PNP': {
      const q = bjtSetup(d)
      const vc = vcritOf(VT, q.is)
      const v1 = limitedJunction(ctx, el, 0, volt(x, q.ctrl[0][0]) - volt(x, q.ctrl[0][1]), VT, vc)
      const v2 = limitedJunction(ctx, el, 1, volt(x, q.ctrl[1][0]) - volt(x, q.ctrl[1][1]), VT, vc)
      const r = bjtEval(q.is, q.bf, BJT_BETA_R, v1, v2)
      const ie = -(r.ic + r.ib)
      stampNonlinear(
        sys,
        q.terms,
        q.ctrl,
        [v1, v2],
        [q.p * r.ic, q.p * r.ib, q.p * ie],
        r.G.map(([g1, g2]) => [q.p * g1, q.p * g2]),
      )
      return
    }
    case 'NMOS':
    case 'PMOS': {
      const m = mosSetup(d)
      const vgs = volt(x, m.ctrl[0][0]) - volt(x, m.ctrl[0][1])
      const vds = volt(x, m.ctrl[1][0]) - volt(x, m.ctrl[1][1])
      const r = mosEval(vgs, vds, m.vth, m.k)
      const p = m.p
      stampNonlinear(
        sys,
        m.terms,
        m.ctrl,
        [vgs, vds],
        [p * r.id, 0, -p * r.id],
        [
          [p * r.gm, p * r.gds],
          [0, 0],
          [-p * r.gm, -p * r.gds],
        ],
      )
      return
    }
    case 'OPAMP': {
      const [ip, inn, out] = d.n
      const o = opampSetup(el, ctx.srcScale)
      // normalised drive u = gain·vd/vh; tanh(u) maps it onto the rails
      const unew = (o.gain * (volt(x, ip) - volt(x, inn))) / o.vh
      const key = limKey(el)
      const mem = (ctx.lim[key] ??= [])
      const uold = mem[0]
      let u = unew
      if (uold !== undefined && Math.abs(unew - uold) > 2) {
        const bothSaturated = Math.sign(unew) === Math.sign(uold) && Math.abs(uold) > 4 && Math.abs(unew) > 4
        if (!bothSaturated) {
          u = uold + 2 * Math.sign(unew - uold)
          ctx.limited = true
        }
      }
      mem[0] = u
      const th = Math.tanh(u)
      const f = o.vm + o.vh * th
      const fp = o.gain * (1 - th * th)
      const vd = (u * o.vh) / o.gain
      addA(sys, out, d.br, -1) // branch current is sourced into `out`
      addA(sys, d.br, out, 1)
      addA(sys, d.br, ip, -fp)
      addA(sys, d.br, inn, fp)
      addB(sys, d.br, f - fp * vd)
      return
    }
    case 'MOTOR': {
      const m = motorParams(el)
      const ib = d.br
      const iw = d.br + 1
      const lr = tran ? m.l / ctx.dt : 0
      const jr = tran ? m.j / ctx.dt : 0
      // electrical: Va - Vb - R·i - ke·ω - (L/dt)(i - iprev) = 0
      addA(sys, a, ib, 1)
      addA(sys, b, ib, -1)
      addA(sys, ib, a, 1)
      addA(sys, ib, b, -1)
      addA(sys, ib, ib, -m.r - lr)
      addA(sys, ib, iw, -m.ke)
      if (tran) addB(sys, ib, -lr * (ctx.prev.indI[el.id] ?? 0))
      // mechanical: kt·i - b·ω - Tload(ω) - (J/dt)(ω - ωprev) = 0
      const w0 = x[iw]
      const th = Math.tanh(w0 / MOTOR_LOAD_W)
      const T0 = m.load * th
      const Tp = (m.load * (1 - th * th)) / MOTOR_LOAD_W
      addA(sys, iw, ib, m.kt)
      addA(sys, iw, iw, -m.b - Tp - jr)
      addB(sys, iw, T0 - Tp * w0 - (tran ? jr * (ctx.prev.omega[el.id] ?? 0) : 0))
      return
    }
  }
}

// ───────────────────────── measurement ─────────────────────────

export interface Measured {
  current: Record<string, number>
  power: Record<string, number>
  extra: Record<string, number>
}

export function measureDevice(d: Dev, x: Float64Array, ctx: Pick<StampCtx, 'mode' | 'dt' | 'prev' | 'pins'>, out: Measured): void {
  const el = d.el
  const id = el.id
  const [a, b] = d.n
  const vab = volt(x, a) - volt(x, b)
  const set = (i: number) => {
    out.current[id] = i
    out.power[id] = vab * i
  }
  switch (el.type) {
    case 'R':
      set(vab / Math.max(el.value, R_MIN))
      return
    case 'SW':
      set(vab / (el.closed ? SW_RON : SW_ROFF))
      return
    case 'V':
    case 'PROBE':
    case 'L':
      set(x[d.br])
      return
    case 'I':
      set(el.value)
      return
    case 'C': {
      if (ctx.mode !== 'tran') return set(0)
      const vprev = ctx.prev.capV[id] ?? el.v0 ?? 0
      set((el.value / ctx.dt) * (vab - vprev))
      return
    }
    case 'PIN': {
      const { g, vs } = pinNorton(el, ctx.pins[el.pin], 1)
      set(g * (vab - vs))
      return
    }
    case 'D':
    case 'LED':
    case 'ZENER': {
      const { rs } = diodeParams(el)
      if (rs > 0) set((volt(x, a) - volt(x, d.n[2])) / rs)
      else set(diodeEval(el, vab).i)
      return
    }
    case 'NPN':
    case 'PNP': {
      const q = bjtSetup(d)
      const v1 = volt(x, q.ctrl[0][0]) - volt(x, q.ctrl[0][1])
      const v2 = volt(x, q.ctrl[1][0]) - volt(x, q.ctrl[1][1])
      const r = bjtEval(q.is, q.bf, BJT_BETA_R, v1, v2)
      const [vC, vB, vE] = q.terms.map((t) => volt(x, t))
      const iC = q.p * r.ic
      const iB = q.p * r.ib
      out.current[id] = iC
      out.power[id] = iC * (vC - vE) + iB * (vB - vE)
      // magnitudes positive in forward-active for both polarities
      out.extra[`${id}.ic`] = r.ic
      out.extra[`${id}.ib`] = r.ib
      out.extra[`${id}.ie`] = r.ic + r.ib
      out.extra[`${id}.vce`] = vC - vE
      out.extra[`${id}.vbe`] = vB - vE
      return
    }
    case 'NMOS':
    case 'PMOS': {
      const m = mosSetup(d)
      const vgs = volt(x, m.ctrl[0][0]) - volt(x, m.ctrl[0][1])
      const vds = volt(x, m.ctrl[1][0]) - volt(x, m.ctrl[1][1])
      const r = mosEval(vgs, vds, m.vth, m.k)
      const [vD, vG, vS] = m.terms.map((t) => volt(x, t))
      const iD = m.p * r.id
      out.current[id] = iD
      out.power[id] = iD * (vD - vS)
      out.extra[`${id}.id`] = r.id
      out.extra[`${id}.vgs`] = vG - vS
      out.extra[`${id}.vds`] = vD - vS
      return
    }
    case 'OPAMP': {
      const o = opampSetup(el, 1)
      const vout = volt(x, d.n[2])
      const iout = x[d.br]
      out.current[id] = 0 // into in+ (ideal inputs)
      out.power[id] = iout >= 0 ? (o.vPos - vout) * iout : (vout - o.vNeg) * -iout
      out.extra[`${id}.iout`] = iout
      out.extra[`${id}.vout`] = vout
      return
    }
    case 'MOTOR': {
      const m = motorParams(el)
      const i = x[d.br]
      const w = x[d.br + 1]
      set(i)
      out.extra[`${id}.omega`] = w
      out.extra[`${id}.rpm`] = (w * 60) / (2 * Math.PI)
      out.extra[`${id}.torque`] = m.kt * i
      out.extra[`${id}.bemf`] = m.ke * w
      return
    }
  }
}

/** capture the dynamic state (cap voltages, inductor/motor currents, shaft speed) after a step */
export function captureState(c: Compiled, x: Float64Array, into: DynState): void {
  for (const d of c.devs) {
    const el = d.el
    if (el.type === 'C') into.capV[el.id] = volt(x, d.n[0]) - volt(x, d.n[1])
    else if (el.type === 'L') into.indI[el.id] = x[d.br]
    else if (el.type === 'MOTOR') {
      into.indI[el.id] = x[d.br]
      into.omega[el.id] = x[d.br + 1]
    }
  }
}
