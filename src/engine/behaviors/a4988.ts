// A4988 (Allegro) microstepping bipolar stepper driver with its NEMA 17 rotor.
//
// The netlist carries each coil as an I source (the chopper's regulated current) in series with the
// winding's R and L. This behavior is the chopper, the translator and the rotor:
//   - STEP/DIR/ENABLE edges arrive through `onPin` with the MCU's µs timestamps and are queued; tick
//     integrates the coils and the rotor in ≤ 20 µs slices up to the MCU's clock, applying each
//     edge at its own time. A rising STEP edge advances the translator by 16/m table positions
//     (64 per electrical cycle, home at 45°); pulses under 1 µs high or low are ignored (datasheet
//     minimums). The translator keeps counting while ENABLE is HIGH (outputs off).
//   - MS1–MS3 are read as voltages against VIH = 0.7·VDD (the internal pull-downs make a cut wire LOW).
//   - Coil targets I_trip·cos θ and I_trip·sin θ, I_trip = V(vref) / (8·Rs). Each coil's current moves
//     toward its target no faster than the bridge can push it: di/dt = (±VMOT − I·(Rcoil + Rds) − e)/L,
//     with e the back-EMF. Above the target the bridge reverses (a fast-decay simplification of the
//     A4988's mixed decay). With the outputs off the current decays into VMOT through the body diodes.
//   - Rotor (hybrid stepper, 50 rotor teeth): T = Km·(I_B·cos φ − I_A·sin φ), φ = 50·θ_shaft,
//     Km = holdTorque / iRated (T_max = holdTorque·|I|/iRated), back-EMF constant = Km.
//     J·dω/dt = T − b·ω − (friction + loadNm) (Coulomb, the load does not back-drive).
//     When the rotor falls a whole electrical cycle behind the translator it has skipped 4 full steps.
//   - Supply draw (`supply`, an I source on VMOT): the power balance (Σ I²·(Rcoil + Rds) + T·ω)/VMOT + iq.
//   - Die: first order toward 25 °C + Σ I²·Rds·RthJA with tauTh; thermal shutdown at tsd, back on
//     tsdHyst below it. Output current above iAbsMax (2 A, the A4988's absolute maximum) for a total
//     of damageS burns the driver ('overcurrent'): a teaching threshold, not a datasheet figure.
//   - A coil whose winding element is missing (or burnt open) while it carries > 0.1 A burns the
//     driver ('overvoltage'): the averaged current source hides the L·di/dt kick, so it is a rule.
//
// Params (defaults in brackets):
//   pins     step [3], dir [4], enable [8]
//   nodes    ms1 ['ms1'], ms2 ['ms2'], ms3 ['ms3'], vref ['vref'], vmot ['vmot'], vdd ['5v']
//   elements coilA ['ia'], coilB ['ib'], rA ['rca'], rB ['rcb'], lA ['lca'], lB ['lcb'], supply ['i_vmot']
//   numbers  rs [0.068 Ω], rdsTotal [0.7 Ω source + sink], rthJA [50 °C/W], tauTh [8 s], tsd [165 °C],
//            tsdHyst [15 °C], iq [0.003 A], iAbsMax [2 A], damageS [0.75 s], holdTorque [0.40 N·m],
//            iRated [1.7 A], rotorJ [5.7e-6 kg·m²], loadJ [0], damping [1e-3 N·m·s/rad],
//            friction [0.005 N·m], loadNm [0 N·m], teeth [50], openUs [10 µs: how fast a pulled connector
//            breaks the current, for the kick estimate L·I/t], vbbMax [35 V]
// Publishes: microstep, itrip_A, vref_V, coilA_A, coilB_A, steps, shaft_deg (continuous, from home),
//   rpm, skipped (full steps), tj, tsd_active, driver_W.

import type { Behavior, BehaviorContext, Element, Netlist, PinState } from '../types'

const T_AMB = 25
/** integration slice, µs */
const H_US = 20
/** at most this much MCU time is integrated per tick (a stalled tab catches up, not replays) */
const MAX_CATCHUP_US = 250_000
const QCAP = 8192
const UNITS = 64 // table positions per electrical cycle (1/16 of a 90° full step each)
const HOME = 8 // 45°
const UNIT_RAD = (2 * Math.PI) / UNITS

const COS = new Float64Array(UNITS)
const SIN = new Float64Array(UNITS)
for (let k = 0; k < UNITS; k++) {
  COS[k] = Math.cos(k * UNIT_RAD)
  SIN[k] = Math.sin(k * UNIT_RAD)
}

/** MS1/MS2/MS3 (datasheet table) → microsteps per full step */
export function decodeMicrostep(ms1: boolean, ms2: boolean, ms3: boolean): number {
  if (ms1 && ms2 && ms3) return 16
  if (ms1 && ms2) return 8
  if (ms2) return 4
  if (ms1) return 2
  return 1
}

/** I_trip = Vref / (8 · Rs), A */
export function tripCurrent(vref: number, rs: number): number {
  return rs > 0 ? Math.max(0, vref) / (8 * rs) : 0
}

const PIN_STEP = 0
const PIN_DIR = 1
const PIN_EN = 2

interface State {
  // edge queue (ring): time µs, which pin, level
  qt: Float64Array
  qp: Uint8Array
  ql: Uint8Array
  qh: number
  qn: number
  nowUs: number
  wasRunning: boolean
  // inputs as last seen
  stepHigh: boolean
  stepRiseUs: number
  stepFallUs: number
  /** the last rising edge was counted (so a too-short high can take it back) */
  stepCounted: boolean
  stepDelta: number
  dirHigh: boolean
  enHigh: boolean
  // translator
  cmd: number // unwrapped table position
  steps: number
  // coils
  iA: number
  iB: number
  // rotor: electrical angle (unwrapped) and shaft speed
  phi: number
  omega: number
  rpmF: number
  slipK: number
  skipped: number
  // die
  tj: number
  tsd: boolean
  overS: number
  burnt: boolean
  // per-tick integrals
  eDrv: number
  eIn: number
  // per-tick inputs (set once per tick, read in the slices)
  m: number
  on: boolean
  itrip: number
  vm: number
  rA: number
  rB: number
  lA: number
  lB: number
  openA: boolean
  openB: boolean
  km: number
  teeth: number
  j: number
  b: number
  tf: number
  rds: number
  /** iAbsMax */
  overLimit: number
  /** the largest coil current seen (for the damage message) */
  peakI: number
}

const states = new WeakMap<BehaviorContext, State>()

function fresh(): State {
  return {
    qt: new Float64Array(QCAP),
    qp: new Uint8Array(QCAP),
    ql: new Uint8Array(QCAP),
    qh: 0,
    qn: 0,
    nowUs: 0,
    wasRunning: false,
    stepHigh: false,
    stepRiseUs: -1e9,
    stepFallUs: -1e9,
    stepCounted: false,
    stepDelta: 0,
    dirHigh: false,
    enHigh: false,
    cmd: HOME,
    steps: 0,
    iA: 0,
    iB: 0,
    phi: HOME * UNIT_RAD,
    omega: 0,
    rpmF: 0,
    slipK: 0,
    skipped: 0,
    tj: T_AMB,
    tsd: false,
    overS: 0,
    burnt: false,
    eDrv: 0,
    eIn: 0,
    m: 1,
    on: false,
    itrip: 0,
    vm: 0,
    rA: 1.5,
    rB: 1.5,
    lA: 2.8e-3,
    lB: 2.8e-3,
    openA: false,
    openB: false,
    km: 0.4 / 1.7,
    teeth: 50,
    j: 5.7e-6,
    b: 1e-3,
    tf: 0.005,
    rds: 0.7,
    overLimit: 2,
    peakI: 0,
  }
}

function state(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = fresh()
    states.set(ctx, s)
  }
  return s
}

const num = (ctx: BehaviorContext, k: string, d: number): number => {
  const v = ctx.params[k]
  return typeof v === 'number' ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d
}
const str = (ctx: BehaviorContext, k: string, d: string): string => {
  const v = ctx.params[k]
  return typeof v === 'string' ? v : d
}

/** linear scan: the netlist object changes every frame (live params), so a cache would allocate */
function find(net: Netlist, id: string): Element | undefined {
  const els = net.elements
  for (let i = 0; i < els.length; i++) if (els[i].id === id) return els[i]
  return undefined
}

/** a winding's resistance, or -1 when it is missing or burnt open */
function windingR(net: Netlist, id: string): number {
  const el = find(net, id)
  if (!el || el.disabled || el.type !== 'R' || !(el.value < 1e5)) return -1
  return el.value
}
function windingL(net: Netlist, id: string, d: number): number {
  const el = find(net, id)
  return el && el.type === 'L' ? el.value : d
}

/** one coil over h seconds: toward `target` while the bridge drives, decaying when it is off */
function coil(i: number, target: number, on: boolean, vm: number, r: number, l: number, e: number, h: number): number {
  if (l <= 0) return on ? target : 0
  if (on) {
    const err = target - i
    const di = ((err >= 0 ? vm : -vm) - r * i - e) * (h / l)
    if ((err >= 0 && di >= err) || (err < 0 && di <= err)) return target // the chopper holds it there
    return i + di
  }
  if (i === 0) return 0
  const ni = i + ((i > 0 ? -vm : vm) - r * i - e) * (h / l)
  return ni > 0 !== i > 0 ? 0 : ni
}

const mod = (a: number, n: number) => ((a % n) + n) % n

/** a timestamped input change, applied in time order */
function applyEdge(st: State, pin: number, high: boolean, tUs: number): void {
  if (pin === PIN_DIR) st.dirHigh = high
  else if (pin === PIN_EN) st.enHigh = high
  else if (high && !st.stepHigh) {
    st.stepHigh = true
    st.stepRiseUs = tUs
    st.stepCounted = tUs - st.stepFallUs >= 1
    if (st.stepCounted) {
      const before = st.cmd
      let next = st.cmd + (st.dirHigh ? 1 : -1) * (16 / st.m)
      // full step: the translator sits on the 45° points only
      if (st.m === 1) next = HOME + 16 * Math.round((next - HOME) / 16)
      st.cmd = next
      st.stepDelta = next - before
      st.steps++
    }
  } else if (!high && st.stepHigh) {
    st.stepHigh = false
    st.stepFallUs = tUs
    if (st.stepCounted && tUs - st.stepRiseUs < 1) {
      // under the 1 µs minimum high time: the translator never saw it
      st.cmd -= st.stepDelta
      st.steps--
    }
    st.stepCounted = false
  }
}

/** integrate coils and rotor over h seconds */
function slice(st: State, h: number): void {
  const idx = mod(st.cmd, UNITS)
  const on = st.on && !st.tsd && !st.burnt
  const sp = Math.sin(st.phi)
  const cp = Math.cos(st.phi)
  const eA = -st.km * st.omega * sp
  const eB = st.km * st.omega * cp
  st.iA = st.openA ? 0 : coil(st.iA, on ? st.itrip * COS[idx] : 0, on, st.vm, st.rA + st.rds, st.lA, eA, h)
  st.iB = st.openB ? 0 : coil(st.iB, on ? st.itrip * SIN[idx] : 0, on, st.vm, st.rB + st.rds, st.lB, eB, h)
  const iA = st.iA
  const iB = st.iB

  const tm = st.km * (iB * cp - iA * sp)
  const tnet = tm - st.b * st.omega
  let om = st.omega
  if (om === 0) {
    if (Math.abs(tnet) > st.tf) om = ((tnet - Math.sign(tnet) * st.tf) / st.j) * h
  } else {
    const nom = om + ((tnet - Math.sign(om) * st.tf) / st.j) * h
    om = nom * om < 0 ? 0 : nom
  }
  st.omega = om
  st.phi += om * st.teeth * h

  const i2 = iA * iA + iB * iB
  st.eDrv += i2 * st.rds * h
  st.eIn += (iA * iA * (st.rA + st.rds) + iB * iB * (st.rB + st.rds) + tm * om) * h
  // over the absolute maximum (only counted while the bridge drives)
  const ipk = Math.max(Math.abs(iA), Math.abs(iB))
  if (ipk > st.peakI) st.peakI = ipk
  if (on && ipk > st.overLimit) st.overS += h

  // whole electrical cycles behind (or ahead of) the translator: 4 full steps each
  const k = Math.round((st.cmd * UNIT_RAD - st.phi) / (2 * Math.PI))
  if (k !== st.slipK) {
    st.skipped += 4 * Math.abs(k - st.slipK)
    st.slipK = k
  }
}

function publishAll(ctx: BehaviorContext, st: State, vref: number, driverW: number): void {
  ctx.publish('microstep', st.m)
  ctx.publish('itrip_A', st.itrip)
  ctx.publish('vref_V', vref)
  ctx.publish('coilA_A', st.iA)
  ctx.publish('coilB_A', st.iB)
  ctx.publish('steps', st.steps)
  ctx.publish('shaft_deg', ((st.phi - HOME * UNIT_RAD) / st.teeth) * (180 / Math.PI))
  ctx.publish('rpm', st.rpmF)
  ctx.publish('skipped', st.skipped)
  ctx.publish('tj', st.tj)
  ctx.publish('tsd_active', st.tsd ? 1 : 0)
  ctx.publish('driver_W', driverW)
}

const quant = (x: number, step: number) => Math.round(x / step) * step

function setOutputs(ctx: BehaviorContext, st: State, supplyA: number): void {
  const net = ctx.netlist
  const a = str(ctx, 'coilA', 'ia')
  const b = str(ctx, 'coilB', 'ib')
  const sup = str(ctx, 'supply', 'i_vmot')
  // a burnt source has been replaced by an open resistor: leave its value alone
  const ea = find(net, a)
  if (ea?.type === 'I') ctx.setParam(a, 'value', quant(st.iA, 1e-3))
  const eb = find(net, b)
  if (eb?.type === 'I') ctx.setParam(b, 'value', quant(st.iB, 1e-3))
  const es = find(net, sup)
  if (es?.type === 'I') ctx.setParam(sup, 'value', quant(supplyA, 1e-4))
}

function pinCode(ctx: BehaviorContext, pin: number): number {
  if (pin === num(ctx, 'step', 3)) return PIN_STEP
  if (pin === num(ctx, 'dir', 4)) return PIN_DIR
  if (pin === num(ctx, 'enable', 8)) return PIN_EN
  return -1
}

export const behavior: Behavior = {
  id: 'a4988',

  init(ctx) {
    state(ctx)
  },

  onPin(ctx, pin, ps: PinState, tMicros) {
    const code = pinCode(ctx, pin)
    if (code < 0) return
    const st = state(ctx)
    // a floating input reads LOW (ENABLE has a pull-down; STEP and DIR are left undriven)
    const high = (ps.mode === 'OUTPUT' || ps.mode === 'OUTPUT_OPEN_DRAIN') && ps.level >= 0.5
    if (st.qn >= QCAP) return // more edges than one tick can hold: drop (never seen at sketch rates)
    const k = (st.qh + st.qn) % QCAP
    st.qt[k] = tMicros
    st.qp[k] = code
    st.ql[k] = high ? 1 : 0
    st.qn++
  },

  tick(ctx, dt) {
    if (!ctx.solution) return
    const st = state(ctx)
    const net = ctx.netlist

    // inputs sampled once per tick
    const vdd = ctx.v(str(ctx, 'vdd', '5v'))
    const vih = 0.7 * vdd
    st.m = decodeMicrostep(
      ctx.v(str(ctx, 'ms1', 'ms1')) >= vih,
      ctx.v(str(ctx, 'ms2', 'ms2')) >= vih,
      ctx.v(str(ctx, 'ms3', 'ms3')) >= vih,
    )
    const vref = ctx.v(str(ctx, 'vref', 'vref'))
    st.itrip = tripCurrent(vref, num(ctx, 'rs', 0.068))
    st.vm = Math.max(0, ctx.v(str(ctx, 'vmot', 'vmot')))
    st.on = !st.enHigh && st.vm > 1
    st.rds = num(ctx, 'rdsTotal', 0.7)
    st.km = num(ctx, 'holdTorque', 0.4) / (num(ctx, 'iRated', 1.7) || 1.7)
    st.teeth = num(ctx, 'teeth', 50) || 50
    st.j = Math.max(1e-9, num(ctx, 'rotorJ', 5.7e-6) + num(ctx, 'loadJ', 0))
    st.b = num(ctx, 'damping', 1e-3)
    st.tf = Math.max(0, num(ctx, 'friction', 0.005) + num(ctx, 'loadNm', 0))
    st.overLimit = num(ctx, 'iAbsMax', 2)
    const rA = windingR(net, str(ctx, 'rA', 'rca'))
    const rB = windingR(net, str(ctx, 'rB', 'rcb'))
    st.lA = windingL(net, str(ctx, 'lA', 'lca'), 2.8e-3)
    st.lB = windingL(net, str(ctx, 'lB', 'lcb'), 2.8e-3)
    st.rA = Math.max(0, rA)
    st.rB = Math.max(0, rB)

    // an inductor carrying current opened: the kick kills the outputs
    const nowOpenA = rA < 0
    const nowOpenB = rB < 0
    if (!st.burnt && ((nowOpenA && Math.abs(st.iA) > 0.1) || (nowOpenB && Math.abs(st.iB) > 0.1))) {
      st.burnt = true
      // the kick, V ≈ L·I / t_open (the contact opens in about openUs), against the 35 V output rating
      const i = nowOpenA && Math.abs(st.iA) > 0.1 ? Math.abs(st.iA) : Math.abs(st.iB)
      const l = nowOpenA && Math.abs(st.iA) > 0.1 ? st.lA : st.lB
      const kick = (l * i) / (Math.max(0.1, num(ctx, 'openUs', 10)) * 1e-6)
      ctx.burn(str(ctx, 'coilA', 'ia'), 'overvoltage', { value: kick, limit: num(ctx, 'vbbMax', 35) })
    }
    st.openA = nowOpenA
    st.openB = nowOpenB
    if (st.burnt) {
      st.iA = 0
      st.iB = 0
    }

    // the clock: the MCU's while a sketch runs (its edges are timestamped on it), else sim time
    const running = ctx.mcu.running
    let target: number
    if (running) {
      target = ctx.mcu.timeMicros
      // (re)joining the MCU's clock (a new upload restarts it at 0): from its earliest queued edge
      if (!st.wasRunning || target < st.nowUs) st.nowUs = st.qn > 0 ? Math.min(target, st.qt[st.qh]) : target
    } else target = st.nowUs + Math.max(0, dt) * 1e6
    st.wasRunning = running
    if (target - st.nowUs > MAX_CATCHUP_US) st.nowUs = target - MAX_CATCHUP_US
    const t0 = st.nowUs
    const phi0 = st.phi
    st.eDrv = 0
    st.eIn = 0
    while (st.nowUs < target || (st.qn > 0 && st.qt[st.qh] <= target)) {
      if (st.qn > 0 && st.qt[st.qh] <= st.nowUs) {
        const h = st.qh
        applyEdge(st, st.qp[h], st.ql[h] === 1, st.qt[h])
        st.qh = (h + 1) % QCAP
        st.qn--
        if (st.qp[h] === PIN_EN) st.on = !st.enHigh && st.vm > 1
        continue
      }
      const next = st.qn > 0 ? st.qt[st.qh] : Infinity
      const seg = Math.min(H_US, next - st.nowUs, target - st.nowUs)
      if (seg > 0) slice(st, seg / 1e6)
      st.nowUs += Math.max(seg, 0)
      if (seg <= 0 && next > target) break
    }
    const span = (st.nowUs - t0) / 1e6

    // die temperature and the protections
    const pDrv = span > 0 ? st.eDrv / span : 0
    const tau = num(ctx, 'tauTh', 8)
    const tss = T_AMB + pDrv * num(ctx, 'rthJA', 50)
    if (span > 0) st.tj = tau > 0 ? st.tj + (tss - st.tj) * (1 - Math.exp(-span / tau)) : tss
    const tsdOn = num(ctx, 'tsd', 165)
    if (!st.tsd && st.tj >= tsdOn) st.tsd = true
    else if (st.tsd && st.tj < tsdOn - num(ctx, 'tsdHyst', 15)) st.tsd = false
    if (!st.burnt && st.overS >= num(ctx, 'damageS', 0.75)) {
      st.burnt = true
      ctx.burn(str(ctx, 'coilA', 'ia'), 'overcurrent', { value: st.peakI, limit: st.overLimit })
    }

    // speed readout: the shaft angle moved this tick (so the microstep ripple averages out), smoothed (τ 50 ms)
    const rpm = span > 0 ? ((st.phi - phi0) / st.teeth / span) * (60 / (2 * Math.PI)) : 0
    st.rpmF += (rpm - st.rpmF) * (span > 0 ? 1 - Math.exp(-span / 0.05) : 0)
    if (Math.abs(st.rpmF) < 1e-3) st.rpmF = 0

    const supply = st.vm > 1 ? Math.max(0, span > 0 ? st.eIn / span : 0) / st.vm + num(ctx, 'iq', 0.003) : 0
    setOutputs(ctx, st, supply)
    publishAll(ctx, st, vref, pDrv)
  },

  onEvent(ctx, ev) {
    const st = state(ctx)
    if (ev === 'upload') {
      // a new sketch: its clock starts at zero and its pins float
      st.qh = 0
      st.qn = 0
      st.nowUs = 0
      st.wasRunning = false
      st.stepHigh = false
      st.dirHigh = false
      st.enHigh = false
    } else if (ev === 'power-off') {
      st.qn = 0
      st.iA = 0
      st.iB = 0
      st.omega = 0
      st.rpmF = 0
      st.tj = T_AMB
      st.tsd = false
      st.stepHigh = false
      st.enHigh = false
    } else if (ev === 'power-on') {
      // the translator powers up at home (45°): the home position nearest the rotor
      st.cmd = HOME + UNITS * Math.round((st.phi / UNIT_RAD - HOME) / UNITS)
      st.slipK = Math.round((st.cmd * UNIT_RAD - st.phi) / (2 * Math.PI))
    }
  },

  reset(ctx) {
    states.delete(ctx)
    const st = state(ctx)
    setOutputs(ctx, st, 0)
  },

  dispose(ctx) {
    states.delete(ctx)
  },
}
