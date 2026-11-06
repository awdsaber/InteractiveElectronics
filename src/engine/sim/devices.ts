// Per-element MNA stamps (including Newton companions for nonlinear parts)
// and post-solve measurement (currents, power, extras).
// Hot paths (stampDevice) are allocation-free: parameters, control indices and
// result keys are precomputed in compile().

import type { Element, LedColor, Netlist, NodeId, PinState } from '../types'
import {
  type LUWork,
  type LinearSystem,
  addA,
  addB,
  createLU,
  createSystem,
  stampConductance,
  stampCurrent,
  stampNonlinear2,
  stampNonlinear3,
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
/** reverse beta; gives Vce(sat) ≈ 0.1–0.2 V in hard saturation */
export const BJT_BETA_R = 0.1
export const BJT_IS = 1e-14
export const DIODE_IS = 1e-14
export const MOTOR_J = 1e-6
/** load torque ramps in over ±this speed so a stalled motor isn't driven backwards */
export const MOTOR_LOAD_W = 1 // rad/s
/** zener breakdown current at exactly V = -vz */
export const ZENER_IZT = 5e-3

/** LED forward voltage at 20 mA (typical 5 mm parts) */
export const LED_VF: Record<LedColor, number> = { red: 1.8, yellow: 2.0, green: 2.1, blue: 2.9, white: 2.9 }
export const LED_RS = 5
const LED_IREF = 0.02
/**
 * LED emission coefficient: chosen so the exponent at 20 mA is 30, which keeps normal
 * and gross-overload operation (amps) below the EXP_MAX clamp. Gives n ≈ 2.2 (red) to
 * 3.6 (blue/white), in line with measured AlGaInP / InGaN ideality factors.
 */
export function ledN(color: LedColor): number {
  return (LED_VF[color] - LED_IREF * LED_RS) / (VT * 30)
}

export const EXP_MAX = 40
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

/** SPICE3 fetlim: limit a MOSFET Vgs Newton step around threshold */
export function fetlim(vnew: number, vold: number, vto: number): number {
  const vtsthi = Math.abs(2 * (vold - vto)) + 2
  const vtstlo = vtsthi / 2 + 2
  const vtox = vto + 3.5
  const delv = vnew - vold
  if (vold >= vto) {
    if (vold >= vtox) {
      if (delv <= 0) {
        if (vnew >= vtox) {
          if (-delv > vtstlo) return vold - vtstlo
        } else return Math.max(vnew, vto + 2)
      } else if (delv >= vtsthi) return vold + vtsthi
    } else if (delv <= 0) return Math.max(vnew, vto - 0.5)
    else return Math.min(vnew, vto + 4)
  } else if (delv <= 0) {
    if (-delv > vtsthi) return vold - vtsthi
  } else {
    const vtemp = vto + 0.5
    if (vnew <= vtemp) {
      if (delv > vtstlo) return vold + vtstlo
    } else return vtemp
  }
  return vnew
}

const vcritOf = (nvt: number, is: number) => nvt * Math.log(nvt / (Math.SQRT2 * is))

export function ledSaturationCurrent(color: LedColor): number {
  const vj = LED_VF[color] - LED_IREF * LED_RS
  return LED_IREF / (Math.exp(vj / (ledN(color) * VT)) - 1)
}

// ───────────────────────── compiled netlist ─────────────────────────

/** precomputed numeric parameters (one monomorphic shape for every device) */
export interface DevParams {
  /** conductance (R, SW) */
  g: number
  // junctions
  is: number
  nvt: number
  rs: number
  vcrit: number
  vz: number
  vcritZ: number
  // transistors: +1 N-type, -1 P-type
  pol: number
  bf: number
  vth: number
  k: number
  // op-amp (unscaled rails)
  gain: number
  vPos: number
  vNeg: number
  // motor
  r: number
  l: number
  ke: number
  kt: number
  j: number
  b: number
  load: number
}

export interface Dev {
  el: Element
  /** terminal node indices (-1 = ground), followed by any internal node */
  n: number[]
  /** first branch-variable index, -1 if none */
  br: number
  /** `${id}:${type}`, used to carry limiter memory across recompiles */
  key: string
  /** offset of this device's limiter slots in Compiled.lim, -1 if none */
  lim: number
  nlim: number
  /** offset of this device's dynamic state (C: v, L: i, MOTOR: i, ω) in Compiled.st, -1 if none */
  st: number
  /** controlling-voltage node pairs for transistors: [c0p, c0n, c1p, c1n] */
  ctrl: [number, number, number, number]
  /** terminal order for transistors (C,B,E / D,G,S) */
  t: [number, number, number]
  p: DevParams
  /** extra-map keys, precomputed */
  xk: string[]
}

export interface Compiled {
  /** k -> node name (internal nodes are named `${id}#…`) */
  nodeNames: NodeId[]
  /** k -> unknown index of that node */
  nodeUnk: Int32Array
  /** node name -> unknown index */
  nodeIndex: Map<NodeId, number>
  nNodes: number
  /** per unknown: 1 for a node voltage, 0 for a branch variable */
  isNode: Uint8Array
  size: number
  devs: Dev[]
  byId: Map<string, Dev>
  nonlinear: boolean
  /** committed dynamic state from the last accepted transient step */
  st: Float64Array
  /** limiter memory (linearisation points), NaN = none yet */
  lim: Float64Array
  limSave: Float64Array
  // preallocated work buffers
  sys: LinearSystem
  lu: LUWork
  xa: Float64Array
  xb: Float64Array
  /** devices whose stamps don't depend on the iterate, and the rest */
  linDevs: Dev[]
  nlDevs: Dev[]
  /** cached matrix (with gmin) and extents of the linear devices, valid for linMode/linDt/linGmin/linScale */
  Alin: Float64Array
  blin: Float64Array
  rfLin: Int32Array
  rlLin: Int32Array
  clLin: Int32Array
  linValid: boolean
  linMode: string
  linDt: number
  linGmin: number
  linScale: number
  /** `lu` holds the factorisation of Alin (only meaningful for fully linear circuits) */
  luValid: boolean
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

function limitSlots(el: Element): number {
  switch (el.type) {
    case 'D':
    case 'LED':
    case 'ZENER':
    case 'NMOS':
    case 'PMOS':
    case 'OPAMP':
      return 1
    case 'NPN':
    case 'PNP':
      return 2
    default:
      return 0
  }
}

export function isNonlinear(el: Element): boolean {
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

function hasInternalNode(el: Element): boolean {
  if (el.type === 'LED') return LED_RS > 0
  if (el.type === 'D') return (el.rs ?? 0) > 0
  return false
}

/** anything that changes the matrix layout; setParam can patch in place when this is unchanged */
export function layoutSignature(el: Element): string {
  return `${el.type}|${el.nodes.join(',')}|${branchCount(el)}|${hasInternalNode(el) ? 1 : 0}`
}

function blankParams(): DevParams {
  return {
    g: 0,
    is: 0,
    nvt: VT,
    rs: 0,
    vcrit: 0,
    vz: 0,
    vcritZ: 0,
    pol: 1,
    bf: BJT_BETA,
    vth: NMOS_VTH,
    k: MOS_K,
    gain: OPAMP_GAIN,
    vPos: 0,
    vNeg: 0,
    r: 0,
    l: 0,
    ke: 0,
    kt: 0,
    j: 0,
    b: 0,
    load: 0,
  }
}

/** (re)compute a device's numeric parameters from its element */
export function prepareDevice(d: Dev): void {
  const el = d.el
  const p = blankParams()
  switch (el.type) {
    case 'R':
      p.g = 1 / Math.max(el.value, R_MIN)
      break
    case 'SW':
      p.g = 1 / (el.closed ? SW_RON : SW_ROFF)
      break
    case 'D':
      p.is = el.is ?? DIODE_IS
      p.nvt = (el.n ?? 1) * VT
      p.rs = el.rs ?? 0
      break
    case 'LED':
      p.is = ledSaturationCurrent(el.color)
      p.nvt = ledN(el.color) * VT
      p.rs = LED_RS
      break
    case 'ZENER':
      p.is = DIODE_IS
      p.nvt = VT
      p.vz = el.vz
      p.vcritZ = vcritOf(VT, ZENER_IZT)
      break
    case 'NPN':
    case 'PNP':
      p.pol = el.type === 'NPN' ? 1 : -1
      p.is = el.is ?? BJT_IS
      p.bf = el.beta ?? BJT_BETA
      break
    case 'NMOS':
      p.pol = 1
      p.vth = el.vth ?? NMOS_VTH
      p.k = el.k ?? MOS_K
      break
    case 'PMOS':
      // PMOS vth may be given as negative (datasheet style) or as a magnitude
      p.pol = -1
      p.vth = Math.abs(el.vth ?? NMOS_VTH)
      p.k = el.k ?? MOS_K
      break
    case 'OPAMP':
      p.gain = el.gain ?? OPAMP_GAIN
      p.vPos = el.vPos
      p.vNeg = el.vNeg
      break
    case 'MOTOR':
      p.r = Math.max(el.r, R_MIN)
      p.l = el.l ?? 0
      p.ke = el.ke
      p.kt = el.kt ?? el.ke
      p.j = el.j ?? MOTOR_J
      p.b = el.b ?? 0
      p.load = el.load ?? 0
      break
    default:
      break
  }
  if (p.is > 0) p.vcrit = vcritOf(p.nvt, p.is)
  d.p = p

  const [a, b, c] = d.n
  if (el.type === 'NPN' || el.type === 'PNP') {
    // C, B, E; controls Vbe, Vbc (NPN) or Veb, Vcb (PNP)
    d.t = [a, b, c]
    d.ctrl = p.pol > 0 ? [b, c, b, a] : [c, b, a, b]
  } else if (el.type === 'NMOS' || el.type === 'PMOS') {
    // D, G, S; controls Vgs, Vds (NMOS) or Vsg, Vsd (PMOS)
    d.t = [a, b, c]
    d.ctrl = p.pol > 0 ? [b, c, a, c] : [c, b, c, a]
  }
}

function extraKeys(el: Element): string[] {
  const id = el.id
  switch (el.type) {
    case 'NPN':
    case 'PNP':
      return ['ic', 'ib', 'ie', 'vce', 'vbe'].map((k) => `${id}.${k}`)
    case 'NMOS':
    case 'PMOS':
      return ['id', 'vgs', 'vds'].map((k) => `${id}.${k}`)
    case 'OPAMP':
      return ['iout', 'vout'].map((k) => `${id}.${k}`)
    case 'MOTOR':
      return ['omega', 'rpm', 'torque', 'bemf'].map((k) => `${id}.${k}`)
    default:
      return []
  }
}

export function compile(netlist: Netlist): Compiled {
  // Unknowns are numbered in element order, each branch variable right after its
  // element's nodes, so chain-like circuits give banded matrices (cheap LU).
  const nodeIndex = new Map<NodeId, number>()
  const nodeNames: NodeId[] = []
  const nodeUnk: number[] = []
  let size = 0
  const node = (id: NodeId): number => {
    if (id === '0') return -1
    let i = nodeIndex.get(id)
    if (i === undefined) {
      i = size++
      nodeIndex.set(id, i)
      nodeNames.push(id)
      nodeUnk.push(i)
    }
    return i
  }
  let nlim = 0
  let nst = 0
  const devs: Dev[] = netlist.elements.map((el) => {
    const n = el.nodes.map(node)
    // internal node right after the element's own nodes keeps chains banded (little LU fill-in)
    if (hasInternalNode(el)) n.push(node(`${el.id}#a`))
    const slots = limitSlots(el)
    const d: Dev = {
      el,
      n,
      br: -1,
      key: `${el.id}:${el.type}`,
      lim: slots ? nlim : -1,
      nlim: slots,
      st: -1,
      ctrl: [-1, -1, -1, -1],
      t: [-1, -1, -1],
      p: blankParams(),
      xk: extraKeys(el),
    }
    nlim += slots
    const ns = stateSlots(el)
    if (ns > 0) {
      d.st = nst
      nst += ns
    }
    const nb = branchCount(el)
    if (nb > 0) {
      d.br = size
      size += nb
    }
    prepareDevice(d)
    return d
  })
  const isNode = new Uint8Array(size)
  for (const i of nodeUnk) isNode[i] = 1
  const lim = new Float64Array(nlim).fill(Number.NaN)
  const st = new Float64Array(nst)
  for (const d of devs) {
    if (d.el.type === 'C') st[d.st] = d.el.v0 ?? 0
    else if (d.el.type === 'L') st[d.st] = d.el.i0 ?? 0
  }
  const c: Compiled = {
    nodeNames,
    nodeUnk: Int32Array.from(nodeUnk),
    nodeIndex,
    nNodes: nodeNames.length,
    isNode,
    size,
    devs,
    byId: new Map(devs.map((d) => [d.el.id, d])),
    nonlinear: devs.some((d) => isNonlinear(d.el)),
    lim,
    st,
    limSave: new Float64Array(nlim),
    sys: createSystem(size),
    lu: createLU(size),
    xa: new Float64Array(size),
    xb: new Float64Array(size),
    linDevs: [],
    nlDevs: [],
    Alin: new Float64Array(size * size),
    blin: new Float64Array(size),
    rfLin: new Int32Array(size),
    rlLin: new Int32Array(size),
    clLin: new Int32Array(size),
    linValid: false,
    linMode: '',
    linDt: 0,
    linGmin: 0,
    linScale: 0,
    luValid: false,
  }
  partition(c)
  return c
}

/** refresh nonlinear flag and the linear / nonlinear device split; drops cached matrices */
export function partition(c: Compiled): void {
  c.linDevs = c.devs.filter((d) => !isNonlinear(d.el))
  c.nlDevs = c.devs.filter((d) => isNonlinear(d.el))
  c.nonlinear = c.nlDevs.length > 0
  c.linValid = false
  c.luValid = false
}

function stateSlots(el: Element): number {
  return el.type === 'C' || el.type === 'L' ? 1 : el.type === 'MOTOR' ? 2 : 0
}

/** copy limiter memory and dynamic state from an older compile for devices whose id and type survive */
export function inheritState(from: Compiled, to: Compiled): void {
  const old = new Map(from.devs.map((d) => [d.key, d]))
  for (const d of to.devs) {
    const o = old.get(d.key)
    if (!o) continue
    if (d.lim >= 0 && o.lim >= 0) for (let s = 0; s < d.nlim; s++) to.lim[d.lim + s] = from.lim[o.lim + s]
    if (d.st >= 0 && o.st >= 0) for (let s = 0; s < stateSlots(d.el); s++) to.st[d.st + s] = from.st[o.st + s]
  }
}

// ───────────────────────── stamping ─────────────────────────

export interface StampCtx {
  mode: 'dc' | 'tran'
  dt: number
  /** current Newton iterate */
  x: Float64Array
  /** committed dynamic state (Compiled.st) */
  st: Float64Array
  pins: Record<number, PinState>
  /** limiter memory (Compiled.lim) */
  lim: Float64Array
  /** set when any device limited its step this iteration */
  limited: boolean
  /** independent-source scale for source stepping */
  srcScale: number
}

const volt = (x: Float64Array, i: number) => (i < 0 ? 0 : x[i])

/** limit against the slot's previous value, store the result, flag if limited */
function remember(ctx: StampCtx, slot: number, vnew: number, v: number): number {
  if (v !== vnew) ctx.limited = true
  ctx.lim[slot] = v
  return v
}

// scratch results (no per-iteration allocation)
const J = { i: 0, g: 0 }
const Q = { ic: 0, ib: 0, gF: 0, gR: 0 }
const M = { id: 0, gm: 0, gds: 0 }

function diodeEval(p: DevParams, zener: boolean, vd: number): void {
  const e = vd / p.nvt
  let i = p.is * (safeExp(e) - 1)
  let g = (p.is / p.nvt) * safeExpD(e)
  if (zener) {
    const u = (-vd - p.vz) / VT
    i -= ZENER_IZT * safeExp(u)
    g += (ZENER_IZT / VT) * safeExpD(u)
  }
  J.i = i + GMIN * vd
  J.g = g + GMIN
}

/** Ebers-Moll (transport form), NPN sense: v1 = Vbe, v2 = Vbc */
function bjtEval(is: number, bf: number, v1: number, v2: number): void {
  const e1 = v1 / VT
  const e2 = v2 / VT
  const icc = is * (safeExp(e1) - 1)
  const iec = is * (safeExp(e2) - 1)
  Q.gF = (is / VT) * safeExpD(e1)
  Q.gR = (is / VT) * safeExpD(e2)
  Q.ic = icc - iec * (1 + 1 / BJT_BETA_R)
  Q.ib = icc / bf + iec / BJT_BETA_R
}

/** square law, N sense, current into drain; symmetric for vds < 0 */
function mosEval(vgs: number, vds: number, vth: number, k: number): void {
  if (vds < 0) {
    mosEval(vgs - vds, -vds, vth, k)
    const gm = M.gm
    M.id = -M.id
    M.gm = -gm
    M.gds = gm + M.gds
    return
  }
  const vov = vgs - vth
  if (vov <= 0) {
    M.id = 0
    M.gm = 0
    M.gds = 0
  } else if (vds < vov) {
    M.id = k * (vov * vds - (vds * vds) / 2)
    M.gm = k * vds
    M.gds = k * (vov - vds)
  } else {
    M.id = (k / 2) * vov * vov
    M.gm = k * vov
    M.gds = 0
  }
}

function pinNorton(el: Extract<Element, { type: 'PIN' }>, state: PinState | undefined, srcScale: number) {
  const mode = state?.mode ?? 'INPUT'
  if (mode === 'OUTPUT') {
    const level = Math.min(1, Math.max(0, state?.level ?? 0))
    PN.g = 1 / Math.max(el.rOut ?? PIN_ROUT, R_MIN)
    PN.vs = level * el.vcc * srcScale
  } else if (mode === 'INPUT_PULLUP') {
    PN.g = 1 / PIN_RPULLUP
    PN.vs = el.vcc * srcScale
  } else {
    PN.g = 1 / PIN_RIN
    PN.vs = 0
  }
  return PN
}
const PN = { g: 0, vs: 0 }

export function stampDevice(d: Dev, sys: LinearSystem, ctx: StampCtx): void {
  const el = d.el
  const p = d.p
  const a = d.n[0]
  const b = d.n[1]
  const x = ctx.x
  const tran = ctx.mode === 'tran'
  switch (el.type) {
    case 'R':
    case 'SW':
      stampConductance(sys, a, b, p.g)
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
      const vprev = ctx.st[d.st]
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
      const iprev = ctx.st[d.st]
      stampVoltageSource(sys, a, b, d.br, -req * iprev, req)
      return
    }
    case 'PIN': {
      const pn = pinNorton(el, ctx.pins[el.pin], ctx.srcScale)
      stampConductance(sys, a, b, pn.g)
      stampCurrent(sys, a, b, -pn.g * pn.vs)
      return
    }
    case 'D':
    case 'LED':
    case 'ZENER': {
      const ja = p.rs > 0 ? d.n[2] : a
      if (p.rs > 0) stampConductance(sys, a, ja, 1 / p.rs)
      const vnew = volt(x, ja) - volt(x, b)
      const slot = d.lim
      const vold = ctx.lim[slot]
      let vd = vnew
      if (vold === vold) {
        if (el.type !== 'ZENER' || vnew >= -p.vz / 2) vd = pnjlim(vnew, vold, p.nvt, p.vcrit)
        // zener breakdown: limit the "junction" u = -v - vz instead
        else vd = -pnjlim(-vnew - p.vz, -vold - p.vz, VT, p.vcritZ) - p.vz
      }
      remember(ctx, slot, vnew, vd)
      diodeEval(p, el.type === 'ZENER', vd)
      stampNonlinear2(sys, ja, b, vd, J.i, J.g)
      return
    }
    case 'NPN':
    case 'PNP': {
      const [c0p, c0n, c1p, c1n] = d.ctrl
      const v1new = volt(x, c0p) - volt(x, c0n)
      const v2new = volt(x, c1p) - volt(x, c1n)
      const o1 = ctx.lim[d.lim]
      const o2 = ctx.lim[d.lim + 1]
      const v1 = remember(ctx, d.lim, v1new, o1 === o1 ? pnjlim(v1new, o1, VT, p.vcrit) : v1new)
      const v2 = remember(ctx, d.lim + 1, v2new, o2 === o2 ? pnjlim(v2new, o2, VT, p.vcrit) : v2new)
      bjtEval(p.is, p.bf, v1, v2)
      const s = p.pol
      const kr = 1 + 1 / BJT_BETA_R
      const ie = -(Q.ic + Q.ib)
      stampNonlinear3(
        sys,
        d.t[0],
        d.t[1],
        d.t[2],
        c0p,
        c0n,
        c1p,
        c1n,
        v1,
        v2,
        s * Q.ic,
        s * Q.ib,
        s * ie,
        s * Q.gF,
        -s * Q.gR * kr,
        (s * Q.gF) / p.bf,
        (s * Q.gR) / BJT_BETA_R,
        -s * Q.gF * (1 + 1 / p.bf),
        s * Q.gR,
      )
      return
    }
    case 'NMOS':
    case 'PMOS': {
      const [c0p, c0n, c1p, c1n] = d.ctrl
      const vgsNew = volt(x, c0p) - volt(x, c0n)
      const vds = volt(x, c1p) - volt(x, c1n)
      const old = ctx.lim[d.lim]
      const vgs = remember(ctx, d.lim, vgsNew, old === old ? fetlim(vgsNew, old, p.vth) : vgsNew)
      mosEval(vgs, vds, p.vth, p.k)
      const s = p.pol
      stampNonlinear3(
        sys,
        d.t[0],
        d.t[1],
        d.t[2],
        c0p,
        c0n,
        c1p,
        c1n,
        vgs,
        vds,
        s * M.id,
        0,
        -s * M.id,
        s * M.gm,
        s * M.gds,
        0,
        0,
        -s * M.gm,
        -s * M.gds,
      )
      return
    }
    case 'OPAMP': {
      const ip = d.n[0]
      const inn = d.n[1]
      const out = d.n[2]
      const vPos = p.vPos * ctx.srcScale
      const vNeg = p.vNeg * ctx.srcScale
      const vm = (vPos + vNeg) / 2
      const vh = Math.max((vPos - vNeg) / 2, 1e-6)
      // normalised drive u = gain·vd/vh; tanh(u) maps it onto the rails
      const unew = (p.gain * (volt(x, ip) - volt(x, inn))) / vh
      const uold = ctx.lim[d.lim]
      let u = unew
      if (uold === uold && Math.abs(unew - uold) > 2) {
        const bothSaturated = Math.sign(unew) === Math.sign(uold) && Math.abs(uold) > 4 && Math.abs(unew) > 4
        if (!bothSaturated) u = uold + 2 * Math.sign(unew - uold)
      }
      remember(ctx, d.lim, unew, u)
      const th = Math.tanh(u)
      const f = vm + vh * th
      const fp = p.gain * (1 - th * th)
      const vd = (u * vh) / p.gain
      addA(sys, out, d.br, -1) // branch current is sourced into `out`
      addA(sys, d.br, out, 1)
      addA(sys, d.br, ip, -fp)
      addA(sys, d.br, inn, fp)
      addB(sys, d.br, f - fp * vd)
      return
    }
    case 'MOTOR': {
      const ib = d.br
      const iw = d.br + 1
      const lr = tran ? p.l / ctx.dt : 0
      const jr = tran ? p.j / ctx.dt : 0
      // electrical: Va - Vb - R·i - ke·ω - (L/dt)(i - iprev) = 0
      addA(sys, a, ib, 1)
      addA(sys, b, ib, -1)
      addA(sys, ib, a, 1)
      addA(sys, ib, b, -1)
      addA(sys, ib, ib, -p.r - lr)
      addA(sys, ib, iw, -p.ke)
      if (tran) addB(sys, ib, -lr * (ctx.st[d.st]))
      // mechanical: kt·i - b·ω - Tload(ω) - (J/dt)(ω - ωprev) = 0
      const w0 = x[iw]
      const th = Math.tanh(w0 / MOTOR_LOAD_W)
      const T0 = p.load * th
      const Tp = (p.load * (1 - th * th)) / MOTOR_LOAD_W
      addA(sys, iw, ib, p.kt)
      addA(sys, iw, iw, -p.b - Tp - jr)
      addB(sys, iw, T0 - Tp * w0 - (tran ? jr * (ctx.st[d.st + 1]) : 0))
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

export function measureDevice(
  d: Dev,
  x: Float64Array,
  ctx: Pick<StampCtx, 'mode' | 'dt' | 'st' | 'pins'>,
  out: Measured,
): void {
  const el = d.el
  const p = d.p
  const id = el.id
  const a = d.n[0]
  const b = d.n[1]
  const vab = volt(x, a) - volt(x, b)
  const xk = d.xk
  let i = 0
  switch (el.type) {
    case 'R':
    case 'SW':
      i = vab * p.g
      break
    case 'V':
    case 'PROBE':
    case 'L':
      i = x[d.br]
      break
    case 'I':
      i = el.value
      break
    case 'C':
      if (ctx.mode === 'tran') i = (el.value / ctx.dt) * (vab - ctx.st[d.st])
      break
    case 'PIN': {
      const pn = pinNorton(el, ctx.pins[el.pin], 1)
      i = pn.g * (vab - pn.vs)
      break
    }
    case 'D':
    case 'LED':
    case 'ZENER':
      if (p.rs > 0) i = (vab - (volt(x, d.n[2]) - volt(x, b))) / p.rs
      else {
        diodeEval(p, el.type === 'ZENER', vab)
        i = J.i
      }
      break
    case 'NPN':
    case 'PNP': {
      const [c0p, c0n, c1p, c1n] = d.ctrl
      bjtEval(p.is, p.bf, volt(x, c0p) - volt(x, c0n), volt(x, c1p) - volt(x, c1n))
      const vC = volt(x, d.t[0])
      const vB = volt(x, d.t[1])
      const vE = volt(x, d.t[2])
      const iC = p.pol * Q.ic
      const iB = p.pol * Q.ib
      out.current[id] = iC
      out.power[id] = iC * (vC - vE) + iB * (vB - vE)
      // magnitudes positive in forward-active for both polarities
      out.extra[xk[0]] = Q.ic
      out.extra[xk[1]] = Q.ib
      out.extra[xk[2]] = Q.ic + Q.ib
      out.extra[xk[3]] = vC - vE
      out.extra[xk[4]] = vB - vE
      return
    }
    case 'NMOS':
    case 'PMOS': {
      const [c0p, c0n, c1p, c1n] = d.ctrl
      mosEval(volt(x, c0p) - volt(x, c0n), volt(x, c1p) - volt(x, c1n), p.vth, p.k)
      const vD = volt(x, d.t[0])
      const vG = volt(x, d.t[1])
      const vS = volt(x, d.t[2])
      const iD = p.pol * M.id
      out.current[id] = iD
      out.power[id] = iD * (vD - vS)
      out.extra[xk[0]] = M.id
      out.extra[xk[1]] = vG - vS
      out.extra[xk[2]] = vD - vS
      return
    }
    case 'OPAMP': {
      const vout = volt(x, d.n[2])
      const iout = x[d.br]
      out.current[id] = 0 // into in+ (ideal inputs)
      out.power[id] = iout >= 0 ? (p.vPos - vout) * iout : (vout - p.vNeg) * -iout
      out.extra[xk[0]] = iout
      out.extra[xk[1]] = vout
      return
    }
    case 'MOTOR': {
      i = x[d.br]
      const w = x[d.br + 1]
      out.extra[xk[0]] = w
      out.extra[xk[1]] = (w * 60) / (2 * Math.PI)
      out.extra[xk[2]] = p.kt * i
      out.extra[xk[3]] = p.ke * w
      break
    }
  }
  out.current[id] = i
  out.power[id] = vab * i
}

/** commit the dynamic state (cap voltages, inductor/motor currents, shaft speed) after an accepted step */
export function captureState(c: Compiled, x: Float64Array): void {
  for (const d of c.devs) {
    if (d.st < 0) continue
    const el = d.el
    if (el.type === 'C') c.st[d.st] = volt(x, d.n[0]) - volt(x, d.n[1])
    else if (el.type === 'L') c.st[d.st] = x[d.br]
    else if (el.type === 'MOTOR') {
      c.st[d.st] = x[d.br]
      c.st[d.st + 1] = x[d.br + 1]
    }
  }
}
