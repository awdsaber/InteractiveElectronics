// Per-element MNA stamps (including Newton companions for nonlinear parts)
// and post-solve measurement (currents, power, extras).
// Hot paths (stampDevice) are allocation-free: parameters, control indices and
// result keys are precomputed in compile().

import type { Element, LedColor, LogicGate, Netlist, NodeId, PinState, Waveform } from '../types'
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
/** knee width of soft breakdown (zener with rz, avalanche clamps), V */
export const BREAK_KNEE = 0.02
/** dynamic resistance of a vBreak avalanche clamp, Ω */
export const BREAK_RZ = 1
/** logic input transition half-width as a fraction of vcc */
export const LOGIC_W = 0.01
/** default SCHMITT hysteresis as a fraction of vcc */
export const SCHMITT_HYST = 0.2
/** fuse cold resistance when `r` is omitted, Ω */
export const FUSE_R = 0.01
/** REG quiescent current ramps in over ~this input voltage (keeps an unpowered input at 0 V) */
export const REG_IQ_V = 0.5

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

/** ln(1 + e^x) without overflow */
export function softplus(x: number): number {
  return x > 0 ? x + Math.log1p(Math.exp(-x)) : Math.log1p(Math.exp(x))
}
/** 1 / (1 + e^-x), the derivative of softplus */
export function sigmoid(x: number): number {
  if (x >= 0) return 1 / (1 + Math.exp(-x))
  const e = Math.exp(x)
  return e / (1 + e)
}

/**
 * Soft breakdown: current (nk/rz)·softplus((u - u0)/nk) for an overdrive u beyond the breakdown
 * voltage. Asymptotically a resistor rz; below the knee an exponential leak. Writes BK.
 */
function breakEval(u: number, rz: number, u0: number): void {
  const z = (u - u0) / BREAK_KNEE
  BK.i = (BREAK_KNEE / rz) * softplus(z)
  BK.g = sigmoid(z) / rz
}
const BK = { i: 0, g: 0 }

/** knee offset so a soft zener passes exactly ZENER_IZT at u = 0 */
function zenerU0(rz: number): number {
  const x = (ZENER_IZT * rz) / BREAK_KNEE
  return -BREAK_KNEE * (x > 30 ? x : Math.log(Math.expm1(x)))
}

/** periodic waveform value at time t (s) */
export function waveValue(w: Waveform, t: number): number {
  let f = w.freq * t + (w.phase ?? 0) / 360
  f -= Math.floor(f)
  let shape: number
  switch (w.kind) {
    case 'sine':
      shape = Math.sin(2 * Math.PI * f)
      break
    case 'square':
      shape = f < (w.duty ?? 0.5) ? 1 : -1
      break
    case 'triangle':
      shape = f < 0.25 ? 4 * f : f < 0.75 ? 2 - 4 * f : 4 * f - 4
      break
  }
  return (w.offset ?? 0) + w.amp * shape
}

/** value of a V source at time t */
export function sourceValue(el: Extract<Element, { type: 'V' }>, t: number): number {
  return el.wave ? waveValue(el.wave, t) : el.value
}

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
  /** 1 when the element is disabled (stamps open) */
  off: number
  /** avalanche clamp voltage (0 = none), dynamic resistance, knee offset (zener with rz too) */
  vb: number
  rz: number
  u0: number
  /** second conductance (POT wiper-B) */
  g2: number
  /** XFMR turns ratio */
  ratio: number
  /** V / REG current window: upper limit, lower limit (A) */
  iHi: number
  iLo: number
  // REG
  vout: number
  drop: number
  iq: number
  // LOGIC
  gate: number
  vcc: number
  w: number
  hyst: number
  inv: number
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
  linTrap: boolean
  /** `lu` holds the factorisation of Alin (only meaningful for fully linear circuits) */
  luValid: boolean
}

/** number of branch-variable unknowns an element adds */
export function branchCount(el: Element): number {
  switch (el.type) {
    case 'V':
    case 'PROBE':
    case 'L':
    case 'OPAMP':
    case 'REG':
      return 1
    case 'MOTOR':
      return 2 // winding current, shaft speed ω
    case 'XFMR':
      return el.lm ? 2 : 1 // secondary current, magnetizing current
    default:
      return 0
  }
}

/** a V source with a current window switches between voltage and current modes */
const vLimited = (el: Extract<Element, { type: 'V' }>) => el.iLimit !== undefined || el.sink === false

function limitSlots(el: Element): number {
  switch (el.type) {
    case 'D':
    case 'LED':
    case 'ZENER':
    case 'NMOS':
    case 'PMOS':
    case 'OPAMP':
    case 'REG':
      return 1
    case 'V':
      return vLimited(el) ? 1 : 0
    case 'NPN':
    case 'PNP':
      return 2
    case 'LOGIC':
      return el.nodes.length - 1 // one per input
    default:
      return 0
  }
}

export function isNonlinear(el: Element): boolean {
  if (el.disabled) return false
  switch (el.type) {
    case 'D':
    case 'LED':
    case 'ZENER':
    case 'NPN':
    case 'PNP':
    case 'NMOS':
    case 'PMOS':
    case 'OPAMP':
    case 'LOGIC':
    case 'REG':
      return true
    case 'V':
      return vLimited(el)
    case 'SW':
      return (el.vBreak ?? 0) > 0
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

/** nodes beyond el.nodes that an element connects to (PIN rail) */
function extraNodes(el: Element): NodeId[] {
  return el.type === 'PIN' && el.vccNode !== undefined ? [el.vccNode] : []
}

/** anything that changes the matrix layout; setParam can patch in place when this is unchanged */
export function layoutSignature(el: Element): string {
  const parts = [el.type, el.nodes.join(','), extraNodes(el).join(','), branchCount(el), hasInternalNode(el) ? 1 : 0]
  return `${parts.join('|')}|${limitSlots(el)}|${stateSlots(el)}`
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
    off: 0,
    vb: 0,
    rz: 0,
    u0: 0,
    g2: 0,
    ratio: 1,
    iHi: Infinity,
    iLo: -Infinity,
    vout: 0,
    drop: 0,
    iq: 0,
    gate: 0,
    vcc: 0,
    w: 1,
    hyst: 0,
    inv: 0,
  }
}

/** 0 single-input, 1 AND, 2 OR, 3 XOR (parity); GATE_INV marks the inverting ones */
const GATE_CODE: Record<LogicGate, number> = { BUF: 0, NOT: 0, SCHMITT: 0, AND: 1, NAND: 1, OR: 2, NOR: 2, XOR: 3 }
const GATE_INV: Record<LogicGate, number> = { BUF: 0, NOT: 1, SCHMITT: 1, AND: 0, NAND: 1, OR: 0, NOR: 1, XOR: 0 }

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
      p.vb = el.vBreak ?? 0
      break
    case 'V':
      p.iHi = el.iLimit ?? Infinity
      p.iLo = el.sink === false ? 0 : -Infinity
      break
    case 'POT': {
      const pos = Math.min(1, Math.max(0, el.pos))
      p.g = 1 / Math.max(el.value * pos, R_MIN)
      p.g2 = 1 / Math.max(el.value * (1 - pos), R_MIN)
      break
    }
    case 'FUSE':
      p.g = el.blown ? 1 / SW_ROFF : 1 / Math.max(el.r ?? FUSE_R, R_MIN)
      break
    case 'XFMR':
      p.ratio = el.n
      p.l = el.lm ?? 0
      break
    case 'REG':
      p.vout = el.vout
      p.drop = el.dropout
      p.iHi = el.iLimit
      p.iq = el.iq ?? 0
      break
    case 'LOGIC':
      p.gate = GATE_CODE[el.gate]
      p.inv = GATE_INV[el.gate]
      p.vcc = el.vcc
      p.vth = el.vth ?? el.vcc / 2
      p.w = Math.max(el.vcc * LOGIC_W, 1e-6)
      p.hyst = el.hyst ?? (el.gate === 'SCHMITT' ? SCHMITT_HYST * el.vcc : 0)
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
      if (el.rz !== undefined && el.rz > 0) {
        p.rz = el.rz
        p.u0 = zenerU0(el.rz)
      }
      break
    case 'NPN':
    case 'PNP':
      p.pol = el.type === 'NPN' ? 1 : -1
      p.is = el.is ?? BJT_IS
      p.bf = el.beta ?? BJT_BETA
      p.vb = el.vBreak ?? 0
      break
    case 'NMOS':
      p.pol = 1
      p.vth = el.vth ?? NMOS_VTH
      p.k = el.k ?? MOS_K
      p.vb = el.vBreak ?? 0
      break
    case 'PMOS':
      // PMOS vth may be given as negative (datasheet style) or as a magnitude
      p.pol = -1
      p.vth = Math.abs(el.vth ?? NMOS_VTH)
      p.k = el.k ?? MOS_K
      p.vb = el.vBreak ?? 0
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
  if (p.vb > 0) p.rz = BREAK_RZ
  p.off = el.disabled ? 1 : 0
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
    case 'V':
      return vLimited(el) ? [`${id}.cc`] : []
    case 'XFMR':
      return ['ip', 'is', 'im'].map((k) => `${id}.${k}`)
    case 'LOGIC':
      return ['out', 'iout'].map((k) => `${id}.${k}`)
    case 'REG':
      return ['iout', 'vout', 'dropout', 'cc'].map((k) => `${id}.${k}`)
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
    for (const e of extraNodes(el)) n.push(node(e))
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
    // C: [v, i]; L: [i, v]; XFMR: [im, vp]; LOGIC: [input state]
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
    linTrap: false,
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
  switch (el.type) {
    case 'C':
    case 'L':
    case 'MOTOR':
      return 2
    case 'XFMR':
      return el.lm ? 2 : 0
    case 'LOGIC':
      return el.nodes.length - 1 // hysteresis memory: the committed logic state of each input
    default:
      return 0
  }
}

/** copy limiter memory and dynamic state from an older compile for devices whose id and type survive */
export function inheritState(from: Compiled, to: Compiled): void {
  const old = new Map(from.devs.map((d) => [d.key, d]))
  for (const d of to.devs) {
    const o = old.get(d.key)
    if (!o) continue
    if (d.lim >= 0 && o.lim >= 0) for (let s = 0; s < d.nlim; s++) to.lim[d.lim + s] = from.lim[o.lim + s]
    const ns = Math.min(stateSlots(d.el), stateSlots(o.el))
    if (d.st >= 0 && o.st >= 0) for (let s = 0; s < ns; s++) to.st[d.st + s] = from.st[o.st + s]
  }
}

// ───────────────────────── stamping ─────────────────────────

export interface StampCtx {
  mode: 'dc' | 'tran'
  dt: number
  /** time of the solution being computed, s (source waveforms) */
  t: number
  /** trapezoidal companions for C / L (else backward Euler) */
  trap: boolean
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
    if (p.rz > 0) {
      breakEval(-vd - p.vz, p.rz, p.u0)
      i -= BK.i
      g += BK.g
    } else {
      const u = (-vd - p.vz) / VT
      i -= ZENER_IZT * safeExp(u)
      g += (ZENER_IZT / VT) * safeExpD(u)
    }
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

/**
 * Pin driver as conductance g to a target: fraction `frac` of g goes to the supply (ideal vcc,
 * or the vccNode rail), the rest to GND. PN.vs is the equivalent Thevenin voltage for an ideal rail.
 */
function pinNorton(el: Extract<Element, { type: 'PIN' }>, state: PinState | undefined, srcScale: number) {
  const mode = state?.mode ?? 'INPUT'
  const level = Math.min(1, Math.max(0, state?.level ?? 0))
  if (mode === 'OUTPUT') {
    PN.g = 1 / Math.max(el.rOut ?? PIN_ROUT, R_MIN)
    PN.frac = level
  } else if (mode === 'OUTPUT_OPEN_DRAIN') {
    // LOW for (1 - level) of the time (PWM duty averages the conductance)
    PN.g = (1 - level) / Math.max(el.rOut ?? PIN_ROUT, R_MIN) + level / PIN_RIN
    PN.frac = 0
  } else if (mode === 'INPUT_PULLUP') {
    PN.g = 1 / PIN_RPULLUP
    PN.frac = 1
  } else {
    PN.g = 1 / PIN_RIN
    PN.frac = 0
  }
  PN.vs = PN.frac * el.vcc * srcScale
  return PN
}
const PN = { g: 0, vs: 0, frac: 0 }

/** one-directional avalanche clamp a -> b above vb; returns current a -> b, writes BK.g */
function clampEval(p: DevParams, v: number): number {
  breakEval(v - p.vb, p.rz, 0)
  return BK.i
}

/** C companion: i = geq·v + ieq */
const CC = { geq: 0, ieq: 0 }
function capCompanion(c: number, dt: number, trap: boolean, vprev: number, iprev: number): void {
  if (trap) {
    CC.geq = (2 * c) / dt
    CC.ieq = -(CC.geq * vprev + iprev)
  } else {
    CC.geq = c / dt
    CC.ieq = -CC.geq * vprev
  }
}

/** inductor between a, b with branch k: BE v = (L/dt)(i - iprev); trap v = (2L/dt)(i - iprev) - vprev */
function stampInductor(sys: LinearSystem, ctx: StampCtx, a: number, b: number, k: number, l: number, s: number): void {
  if (ctx.mode !== 'tran') {
    stampVoltageSource(sys, a, b, k, 0)
    return
  }
  const iprev = ctx.st[s]
  if (ctx.trap) {
    const req = (2 * l) / ctx.dt
    stampVoltageSource(sys, a, b, k, -req * iprev - ctx.st[s + 1], req)
  } else {
    const req = l / ctx.dt
    stampVoltageSource(sys, a, b, k, -req * iprev, req)
  }
}

/** V/REG mode memory: 0 voltage mode, 1 current limit, 2 off (not sinking), 3 dropout (REG) */
const MODE_CV = 0
const MODE_CC = 1
const MODE_OFF = 2
const MODE_DROP = 3

/** scratch for LOGIC input levels, their slopes and linearisation-point voltages */
let LV = new Float64Array(8)
let LD = new Float64Array(8)
let LU = new Float64Array(8)

/**
 * Centre of the input transition for a LOGIC device given its committed input state.
 * With hysteresis the state flips exactly at vth ± hyst/2 (captureState) and the output
 * follows on the next step; the transition is centred LOGIC_EDGE half-widths beyond the trip
 * point so the output hasn't started to move before the flip. (A continuous inverter
 * characteristic would give an RC-feedback oscillator a false equilibrium.)
 */
function logicThreshold(p: DevParams, state: number): number {
  if (!(p.hyst > 0)) return p.vth
  return state > 0.5 ? p.vth - p.hyst / 2 - LOGIC_EDGE * p.w : p.vth + p.hyst / 2 + LOGIC_EDGE * p.w
}
const LOGIC_EDGE = 4

/** gate function of the levels in LV[0..n); writes the partials into LD (multiplied in place) */
function gateEval(p: DevParams, n: number): number {
  let f: number
  switch (p.gate) {
    case 1: {
      f = 1
      for (let j = 0; j < n; j++) f *= LV[j]
      for (let j = 0; j < n; j++) {
        let q = 1
        for (let m = 0; m < n; m++) if (m !== j) q *= LV[m]
        LD[j] *= q
      }
      break
    }
    case 2: {
      let z = 1
      for (let j = 0; j < n; j++) z *= 1 - LV[j]
      f = 1 - z
      for (let j = 0; j < n; j++) {
        let q = 1
        for (let m = 0; m < n; m++) if (m !== j) q *= 1 - LV[m]
        LD[j] *= q
      }
      break
    }
    case 3: {
      let z = 1
      for (let j = 0; j < n; j++) z *= 1 - 2 * LV[j]
      f = (1 - z) / 2
      for (let j = 0; j < n; j++) {
        let q = 1
        for (let m = 0; m < n; m++) if (m !== j) q *= 1 - 2 * LV[m]
        LD[j] *= q
      }
      break
    }
    default:
      f = LV[0]
  }
  if (p.inv) {
    f = 1 - f
    for (let j = 0; j < n; j++) LD[j] = -LD[j]
  }
  return f
}

function ensureLogicScratch(n: number): void {
  if (LV.length < n) {
    LV = new Float64Array(n * 2)
    LD = new Float64Array(n * 2)
    LU = new Float64Array(n * 2)
  }
}

export function stampDevice(d: Dev, sys: LinearSystem, ctx: StampCtx): void {
  const el = d.el
  const p = d.p
  const a = d.n[0]
  const b = d.n[1]
  const x = ctx.x
  const tran = ctx.mode === 'tran'
  if (p.off) {
    // disabled: an open circuit; branch variables pinned to 0
    for (let k = 0; k < branchCount(el); k++) addA(sys, d.br + k, d.br + k, 1)
    return
  }
  switch (el.type) {
    case 'R':
    case 'FUSE':
      stampConductance(sys, a, b, p.g)
      return
    case 'SW': {
      stampConductance(sys, a, b, p.g)
      if (p.vb > 0) {
        // bidirectional avalanche clamp across the contacts
        const v = volt(x, a) - volt(x, b)
        const i = clampEval(p, v)
        const g1 = BK.g
        const i2 = clampEval(p, -v)
        stampNonlinear2(sys, a, b, v, i - i2, g1 + BK.g)
      }
      return
    }
    case 'POT':
      stampConductance(sys, a, b, p.g)
      stampConductance(sys, b, d.n[2], p.g2)
      return
    case 'V': {
      const v = (el.wave ? waveValue(el.wave, ctx.t) : el.value) * ctx.srcScale
      const r = el.rInternal ?? 0
      if (d.lim < 0) {
        stampVoltageSource(sys, a, b, d.br, v, r)
        return
      }
      // current-window source: piecewise-linear modes chosen from the iterate
      const k = d.br
      const io = -x[k] // delivered out of the + terminal
      const vd = volt(x, a) - volt(x, b)
      const old = ctx.lim[d.lim]
      let mode = old === old ? old : MODE_CV
      if (mode === MODE_CV) {
        if (io > p.iHi) mode = MODE_CC
        else if (io < p.iLo) mode = MODE_OFF
      } else if (mode === MODE_CC) {
        if (vd > v - r * p.iHi) mode = MODE_CV
      } else if (vd < v - r * p.iLo) mode = MODE_CV
      if (mode !== old) ctx.limited = true
      ctx.lim[d.lim] = mode
      addA(sys, a, k, 1)
      addA(sys, b, k, -1)
      if (mode === MODE_CV) {
        addA(sys, k, a, 1)
        addA(sys, k, b, -1)
        if (r !== 0) addA(sys, k, k, -r)
        addB(sys, k, v)
      } else {
        addA(sys, k, k, 1)
        addB(sys, k, mode === MODE_CC ? -p.iHi : -p.iLo)
      }
      return
    }
    case 'PROBE':
      stampVoltageSource(sys, a, b, d.br, 0)
      return
    case 'I':
      stampCurrent(sys, a, b, el.value * ctx.srcScale)
      return
    case 'C': {
      if (!tran) return // open circuit at DC (node gmin keeps it solvable)
      capCompanion(el.value, ctx.dt, ctx.trap, ctx.st[d.st], ctx.st[d.st + 1])
      stampConductance(sys, a, b, CC.geq)
      stampCurrent(sys, a, b, CC.ieq)
      return
    }
    case 'L':
      stampInductor(sys, ctx, a, b, d.br, el.value, d.st)
      return
    case 'XFMR': {
      const s1 = d.n[2]
      const s2 = d.n[3]
      const k = d.br
      const n = p.ratio
      // ix flows into s1 from the circuit; the primary carries -n·ix into p1 (power balance)
      addA(sys, s1, k, 1)
      addA(sys, s2, k, -1)
      addA(sys, a, k, -n)
      addA(sys, b, k, n)
      // Vs = n·Vp
      addA(sys, k, s1, 1)
      addA(sys, k, s2, -1)
      addA(sys, k, a, -n)
      addA(sys, k, b, n)
      if (p.l > 0) stampInductor(sys, ctx, a, b, k + 1, p.l, d.st)
      return
    }
    case 'PIN': {
      const pn = pinNorton(el, ctx.pins[el.pin], ctx.srcScale)
      if (d.n.length > 2) {
        stampConductance(sys, a, d.n[2], pn.g * pn.frac)
        stampConductance(sys, a, b, pn.g * (1 - pn.frac))
      } else {
        stampConductance(sys, a, b, pn.g)
        stampCurrent(sys, a, b, -pn.g * pn.vs)
      }
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
        // zener breakdown: limit the "junction" u = -v - vz instead (the soft rz model needs none)
        else if (p.rz === 0) vd = -pnjlim(-vnew - p.vz, -vold - p.vz, VT, p.vcritZ) - p.vz
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
      if (p.vb > 0) stampClamp(sys, d, x)
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
      if (p.vb > 0) stampClamp(sys, d, x)
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
    case 'LOGIC': {
      const nin = el.nodes.length - 1
      const out = d.n[nin]
      ensureLogicScratch(nin)
      const vs = p.vcc * ctx.srcScale
      for (let j = 0; j < nin; j++) {
        const th = logicThreshold(p, ctx.st[d.st + j])
        // normalised input u = (v - th)/w; limited like the op-amp so feedback loops converge
        const unew = (volt(x, d.n[j]) - th) / p.w
        const slot = d.lim + j
        const uold = ctx.lim[slot]
        let u = unew
        if (uold === uold) {
          const uo = Math.min(5, Math.max(-5, uold))
          const bothSaturated = Math.sign(unew) === Math.sign(uold) && Math.abs(uold) > 5 && Math.abs(unew) > 5
          if (!bothSaturated && Math.abs(unew - uo) > 2) u = uo + 2 * Math.sign(unew - uo)
        }
        remember(ctx, slot, unew, u)
        const t = Math.tanh(u)
        LV[j] = 0.5 * (1 + t)
        LD[j] = (0.5 * (1 - t * t)) / p.w
        LU[j] = th + u * p.w // linearisation point
      }
      const f = gateEval(p, nin)
      // output: vs·f behind PIN_ROUT; injected current g·vs·f(v) linearised at LU
      const g = 1 / PIN_ROUT
      stampConductance(sys, out, -1, g)
      let rhs = g * vs * f
      for (let j = 0; j < nin; j++) {
        const c = g * vs * LD[j]
        addA(sys, out, d.n[j], -c)
        rhs -= c * LU[j]
      }
      addB(sys, out, rhs)
      return
    }
    case 'REG': {
      const out = d.n[2]
      const k = d.br
      const vin = volt(x, a) - volt(x, b)
      const vo = volt(x, out) - volt(x, b)
      const io = x[k]
      const vreg = p.vout * ctx.srcScale
      const vdrop = vin - p.drop
      const target = Math.min(vreg, vdrop)
      const old = ctx.lim[d.lim]
      let mode = old === old ? old : MODE_CV
      if (mode === MODE_CV || mode === MODE_DROP) {
        if (io > p.iHi) mode = MODE_CC
        else if (io < 0) mode = MODE_OFF
        else mode = vdrop >= vreg ? MODE_CV : MODE_DROP
      } else if (mode === MODE_CC ? vo > target : vo < target) mode = vdrop >= vreg ? MODE_CV : MODE_DROP
      if (mode !== old) ctx.limited = true
      ctx.lim[d.lim] = mode
      // io is drawn from `in` and delivered into `out`
      addA(sys, a, k, 1)
      addA(sys, out, k, -1)
      if (mode === MODE_CV) {
        addA(sys, k, out, 1)
        addA(sys, k, b, -1)
        addB(sys, k, vreg)
      } else if (mode === MODE_DROP) {
        addA(sys, k, out, 1)
        addA(sys, k, a, -1)
        addB(sys, k, -p.drop)
      } else {
        addA(sys, k, k, 1)
        addB(sys, k, mode === MODE_CC ? p.iHi : 0)
      }
      if (p.iq > 0) {
        const th = Math.tanh(vin / REG_IQ_V)
        stampNonlinear2(sys, a, b, vin, p.iq * th, (p.iq * (1 - th * th)) / REG_IQ_V)
      }
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
      if (tran) addB(sys, ib, -lr * ctx.st[d.st])
      // mechanical: kt·i - b·ω - Tload(ω) - (J/dt)(ω - ωprev) = 0
      const w0 = x[iw]
      const th = Math.tanh(w0 / MOTOR_LOAD_W)
      const T0 = p.load * th
      const Tp = (p.load * (1 - th * th)) / MOTOR_LOAD_W
      addA(sys, iw, ib, p.kt)
      addA(sys, iw, iw, -p.b - Tp - jr)
      addB(sys, iw, T0 - Tp * w0 - (tran ? jr * ctx.st[d.st + 1] : 0))
      return
    }
  }
}
/** transistor avalanche clamp from collector/drain to emitter/source (polarity-aware) */
function stampClamp(sys: LinearSystem, d: Dev, x: Float64Array): void {
  const p = d.p
  const s = p.pol
  const v = s * (volt(x, d.t[0]) - volt(x, d.t[2]))
  const i = clampEval(p, v)
  // current s·i into t0 out of t2, as a function of v(t0) - v(t2) with slope BK.g
  stampNonlinear2(sys, d.t[0], d.t[2], s * v, s * i, BK.g)
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
  ctx: Pick<StampCtx, 'mode' | 'dt' | 'st' | 'pins' | 't' | 'trap'>,
  out: Measured,
): void {
  const el = d.el
  const p = d.p
  const id = el.id
  const a = d.n[0]
  const b = d.n[1]
  const vab = volt(x, a) - volt(x, b)
  const xk = d.xk
  if (p.off) {
    out.current[id] = 0
    out.power[id] = 0
    for (const k of xk) out.extra[k] = 0
    return
  }
  let i = 0
  switch (el.type) {
    case 'R':
    case 'FUSE':
      i = vab * p.g
      break
    case 'SW':
      i = vab * p.g
      if (p.vb > 0) i += clampEval(p, vab) - clampEval(p, -vab)
      break
    case 'POT': {
      const w = volt(x, b)
      i = (volt(x, a) - w) * p.g
      const i2 = (w - volt(x, d.n[2])) * p.g2
      out.current[id] = i
      out.power[id] = (i * i) / p.g + (i2 * i2) / p.g2
      return
    }
    case 'V': {
      i = x[d.br]
      if (xk.length) {
        const v = sourceValue(el, ctx.t)
        const r = el.rInternal ?? 0
        out.extra[xk[0]] = vab < v + r * i - 1e-6 * Math.max(1, Math.abs(v)) ? 1 : 0
      }
      break
    }
    case 'PROBE':
    case 'L':
      i = x[d.br]
      break
    case 'XFMR': {
      const ix = x[d.br]
      const im = p.l > 0 ? x[d.br + 1] : 0
      const ip = -p.ratio * ix + im
      const vs = volt(x, d.n[2]) - volt(x, d.n[3])
      out.current[id] = ip
      out.power[id] = vab * ip + vs * ix
      out.extra[xk[0]] = ip
      out.extra[xk[1]] = -ix
      out.extra[xk[2]] = im
      return
    }
    case 'I':
      i = el.value
      break
    case 'C':
      if (ctx.mode === 'tran') {
        capCompanion(el.value, ctx.dt, ctx.trap, ctx.st[d.st], ctx.st[d.st + 1])
        i = CC.geq * vab + CC.ieq
      }
      break
    case 'PIN': {
      const pn = pinNorton(el, ctx.pins[el.pin], 1)
      if (d.n.length > 2) i = pn.g * (1 - pn.frac) * vab + pn.g * pn.frac * (volt(x, a) - volt(x, d.n[2]))
      else i = pn.g * (vab - pn.vs)
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
      const icl = p.vb > 0 ? clampEval(p, p.pol * (vC - vE)) : 0
      const iC = p.pol * (Q.ic + icl)
      const iB = p.pol * Q.ib
      out.current[id] = iC
      out.power[id] = iC * (vC - vE) + iB * (vB - vE)
      // magnitudes positive in forward-active for both polarities
      out.extra[xk[0]] = Q.ic + icl
      out.extra[xk[1]] = Q.ib
      out.extra[xk[2]] = Q.ic + icl + Q.ib
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
      const icl = p.vb > 0 ? clampEval(p, p.pol * (vD - vS)) : 0
      const iD = p.pol * (M.id + icl)
      out.current[id] = iD
      out.power[id] = iD * (vD - vS)
      out.extra[xk[0]] = M.id + icl
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
    case 'LOGIC': {
      const nin = el.nodes.length - 1
      ensureLogicScratch(nin)
      for (let j = 0; j < nin; j++) {
        const t = Math.tanh((volt(x, d.n[j]) - logicThreshold(p, ctx.st[d.st + j])) / p.w)
        LV[j] = 0.5 * (1 + t)
        LD[j] = 0
      }
      const f = gateEval(p, nin)
      const vo = volt(x, d.n[nin])
      const iout = (p.vcc * f - vo) / PIN_ROUT // sourced into the output node
      out.current[id] = iout
      out.power[id] = iout >= 0 ? (p.vcc - vo) * iout : vo * -iout
      out.extra[xk[0]] = f
      out.extra[xk[1]] = iout
      return
    }
    case 'REG': {
      const io = x[d.br]
      const vin = vab
      const vo = volt(x, d.n[2]) - volt(x, b)
      const iq = p.iq * Math.tanh(vin / REG_IQ_V)
      const vdrop = vin - p.drop
      const target = Math.min(p.vout, vdrop)
      const cc = io >= p.iHi * (1 - 1e-9) && vo < target - 1e-6 ? 1 : 0
      out.current[id] = io + iq
      out.power[id] = (vin - vo) * io + vin * iq
      out.extra[xk[0]] = io
      out.extra[xk[1]] = vo
      out.extra[xk[2]] = !cc && io > 0 && vdrop < p.vout ? 1 : 0
      out.extra[xk[3]] = cc
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

/** current and power of one device (IP.i, IP.p): the per-element read behind Solution.currentOf */
export const IP = { i: 0, p: 0 }
const IP_SCRATCH: Measured = { current: {}, power: {}, extra: {} }
export function measureCurrentPower(d: Dev, x: Float64Array, ctx: Pick<StampCtx, 'mode' | 'dt' | 'st' | 'pins' | 't' | 'trap'>): void {
  const t = d.el.type
  if (!d.p.off && (t === 'R' || t === 'FUSE' || (t === 'SW' && !(d.p.vb > 0)))) {
    // the common rated parts, without going through the string-keyed maps
    const vab = volt(x, d.n[0]) - volt(x, d.n[1])
    IP.i = vab * d.p.g
    IP.p = vab * IP.i
    return
  }
  measureDevice(d, x, ctx, IP_SCRATCH)
  IP.i = IP_SCRATCH.current[d.el.id]
  IP.p = IP_SCRATCH.power[d.el.id]
}

/**
 * True when a switching device changed mode in the solve just accepted: a V current-window or
 * REG mode flip, or a LOGIC input crossing its threshold (an output edge). Compares Compiled.lim
 * with Compiled.limSave, which solveCompiled saves before solving.
 */
export function modesChanged(c: Compiled): boolean {
  const lim = c.lim
  const prev = c.limSave
  for (const d of c.nlDevs) {
    const t = d.el.type
    if (t === 'REG' || (t === 'V' && d.lim >= 0)) {
      const p = prev[d.lim]
      if (p === p && lim[d.lim] !== p) return true // NaN: first solve, nothing to compare
    } else if (t === 'LOGIC') {
      for (let j = 0; j < d.nlim; j++) {
        const p = prev[d.lim + j]
        if (p === p && lim[d.lim + j] > 0 !== p > 0) return true
      }
    }
  }
  return false
}

/**
 * Commit the dynamic state after an accepted step at step size dt: cap voltage and current,
 * inductor current and voltage, motor current and speed, schmitt input state.
 */
export function captureState(c: Compiled, x: Float64Array, dt: number, trap: boolean): void {
  const st = c.st
  for (const d of c.devs) {
    if (d.st < 0 || d.p.off) continue
    const el = d.el
    const s = d.st
    const vab = volt(x, d.n[0]) - volt(x, d.n[1])
    switch (el.type) {
      case 'C':
        capCompanion(el.value, dt, trap, st[s], st[s + 1])
        st[s + 1] = CC.geq * vab + CC.ieq
        st[s] = vab
        break
      case 'L':
        st[s] = x[d.br]
        st[s + 1] = vab
        break
      case 'XFMR':
        st[s] = x[d.br + 1]
        st[s + 1] = vab
        break
      case 'MOTOR':
        st[s] = x[d.br]
        st[s + 1] = x[d.br + 1]
        break
      case 'LOGIC': {
        const p = d.p
        if (p.hyst > 0) {
          for (let j = 0; j < el.nodes.length - 1; j++) {
            const v = volt(x, d.n[j])
            if (v > p.vth + p.hyst / 2) st[s + j] = 1
            else if (v < p.vth - p.hyst / 2) st[s + j] = 0
          }
        }
        break
      }
    }
  }
}
