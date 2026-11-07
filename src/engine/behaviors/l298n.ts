// L298 dual full-bridge (ST, Multiwatt15) on the red L298N module, as averaged half-bridges.
//
// Same netlist structure as `tb6612`: each output (OUT1, OUT2; OUT3, OUT4 for channel B) is a V
// source referenced to the driver ground, behind a resistor fitted to the datasheet's typical
// VCE(sat), then a SW that opens when the output is off. The differences this behavior models:
//   - bipolar outputs: the conducting path is two saturated BJTs, about 1.85 Ω in total (typical
//     source 0.95 V + sink 0.85 V at 1 A; the resistor fit lives in the netlist, `rTotal` here
//     only for the published numbers and must match it);
//   - truth table: EN low = all four transistors off (coast through the flyback diodes),
//     IN1 = IN2 with EN high = fast stop (brake), there is no standby pin;
//   - PWM on EN: the off phase is a coast, not a brake. With this motor's L/R (≈ 0.1 ms) against
//     the ~1 ms PWM period the current dies out early in each off phase and the terminals float at
//     the back-EMF, so the average across the motor is d·Vs + (1 − d)·E rather than d·Vs, and the
//     on-phase current is I_avg/d (loss R·I²/d). `coastPwm: false` gives the plain d·Vs average;
//   - no internal flyback diodes: when the module's diodes are missing, an EN-PWM drive with
//     current flowing kicks the output transistors at every PWM off edge. The averaged model has no
//     edges, so on such a tick the behavior opens the outputs once (one real off edge) and the
//     transient engine resolves the kick: the SW `vBreak` clamp, `sim.edgeSubsteps` and the SW's
//     `maxV` rating. A full turn-off (EN low, a coast) needs nothing extra. Lessons using a
//     no-diode failure must set `sim.edgeSubsteps` (≈ 12) or the kick is not seen;
//   - a failed (shorted) output transistor, i.e. the SW replaced by a burn: the channel is dead and
//     any drive command shorts Vs to ground through the shorted transistor and its partner;
//   - heat: P = Σ bridge loss + Vs·Iq into a first-order junction model, Rθ = rthJC + rthCS + rthSA
//     with the heatsink fitted (the element `sink` exists: the grounded tab's bond to the heatsink)
//     or rthJA without; overtemperature shutdown with hysteresis opens all outputs.
//
// Params (defaults in brackets):
//   nodes    in1 ['d7'], in2 ['d8'], ena ['d5']; channel B in3 ['in3'], in4 ['in4'], enb ['']
//            (an enable node '' = the EN jumper fitted, always enabled). Inputs are read as voltages
//            against `gnd` ['bat_n'] with VIH [2.3 V] / VIL [1.5 V]; between them the last level is
//            kept. An enable driven by a PIN in OUTPUT mode is read as its analogWrite duty.
//            vs ['vs']: the motor supply node
//   elements out1 ['ha'], out2 ['hb'], en1 ['en_a'], en2 ['en_b'], motor ['m1'], diodes
//            ['d_a_hi,d_a_lo,d_b_hi,d_b_lo']; channel B out3 ['hc'], out4 ['hd'], en3 ['en_c'],
//            en4 ['en_d'], motorB ['m2'], diodesB ['d_c_hi,d_c_lo,d_d_hi,d_d_lo'] (channel B runs only
//            when out3 and out4 exist); supply ['i_vs']: I source Vs → gnd for the draw; sink ['hs_tab']
//   numbers  rTotal [1.85 Ω], iq [0.013 A], rthJC [3], rthCS [1], rthSA [15], rthJA [35 °C/W],
//            tauTh [4 s: time-compressed, a real module on its heatsink takes minutes], tsd [150 °C],
//            tsdHyst [20 °C], gear [1: rpm_out = motor rpm / gear], coastPwm [true],
//            iKick [0.05 A: on-phase current below which a missing-diode PWM edge is not emulated]
// Publishes: mode (L298_MODE), duty, motor_A, rpm_out, drop_V (on-state bridge drop, R·I/d), and
// with channel B mode_b, duty_b, motor_b_A, rpm_out_b, drop_b_V; plus vs_V, bridge_W (both channels
// + quiescent), tj, tsd_active, heatsink (0/1), efficiency (%, motor power / supply power),
// kick_uJ (½·L·I_on² of the last emulated PWM off edge without diodes) and dead (0/1).

import type { Behavior, BehaviorContext, Element, Netlist, Solution } from '../types'
import { MODE } from './tb6612'

export const L298_MODE = { CW: MODE.CW, CCW: MODE.CCW, BRAKE: MODE.BRAKE, COAST: MODE.COAST, DEAD: 5 } as const
export type L298Mode = (typeof L298_MODE)[keyof typeof L298_MODE]

const T_AMB = 25
const TWO_PI_60 = (2 * Math.PI) / 60

/** L298 datasheet truth table: EN low → free-running stop; IN1 = IN2 → fast motor stop */
export function decodeL298(en: boolean, in1: boolean, in2: boolean): L298Mode {
  if (!en) return L298_MODE.COAST
  if (in1 === in2) return L298_MODE.BRAKE
  return in1 ? L298_MODE.CW : L298_MODE.CCW
}

/**
 * Average source value of the driving half under EN-PWM whose off phase coasts: d·Vs while on, the
 * back-EMF `e` (as seen from this half) while the outputs float, clamped to the rails by the diodes.
 */
export function coastPwmSource(d: number, vs: number, e: number): number {
  const v = d * vs + (1 - d) * e
  return v < 0 ? 0 : v > vs ? vs : v
}

/** bridge I²R loss with EN-PWM coast: the current flows only in the on phase, I_on = I_avg / d */
export function coastPwmLoss(iAvg: number, d: number, r: number): number {
  return d > 0 ? (r * iAvg * iAvg) / d : 0
}

interface Channel {
  in1: string
  in2: string
  en: string
  out1: string
  out2: string
  en1: string
  en2: string
  motor: string
  diodes: string[]
  kMode: string
  kDuty: string
  kMotor: string
  kRpm: string
  kDrop: string
  kRpmExtra: string
  // per-netlist facts
  hasDiodes: boolean
  dead: boolean
  ke: number
  lMotor: number
  // per-tick scratch
  mode: L298Mode
  d: number
  e: number
  /** this tick emulates one PWM off edge (no flyback diodes) */
  edge: boolean
}

interface State {
  tj: number
  tsd: boolean
  kick: number
  latch: Map<string, boolean>
  chs: Channel[]
  chNet: Netlist | null
}

const states = new WeakMap<BehaviorContext, State>()

const num = (ctx: BehaviorContext, k: string, d: number): number => {
  const v = ctx.params[k]
  return typeof v === 'number' ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d
}
const str = (ctx: BehaviorContext, k: string, d: string): string => {
  const v = ctx.params[k]
  return typeof v === 'string' ? v : d
}
const bool = (ctx: BehaviorContext, k: string, d: boolean): boolean => {
  const v = ctx.params[k]
  return typeof v === 'boolean' ? v : typeof v === 'number' ? v >= 0.5 : d
}

function state(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = { tj: T_AMB, tsd: false, kick: 0, latch: new Map(), chs: [], chNet: null }
    states.set(ctx, s)
  }
  return s
}

interface NetInfo {
  els: Map<string, Element>
  /** PIN elements by the node they drive */
  pinAt: Map<string, { pin: number; vcc: number }>
}
const netCache = new WeakMap<Netlist, NetInfo>()

function netInfo(net: Netlist): NetInfo {
  let info = netCache.get(net)
  if (info) return info
  const els = new Map<string, Element>()
  const pinAt = new Map<string, { pin: number; vcc: number }>()
  for (const el of net.elements) {
    els.set(el.id, el)
    if (el.type === 'PIN') pinAt.set(el.nodes[0], { pin: el.pin, vcc: el.vcc })
  }
  info = { els, pinAt }
  netCache.set(net, info)
  return info
}

const curOf = (s: Solution, id: string) => (s.currentOf ? s.currentOf(id) : (s.current[id] ?? 0))
const extraOf = (s: Solution, id: string, key: string) => (s.extraOf ? s.extraOf(id, key) : (s.extra[key] ?? 0))
const quant = (x: number, step: number) => Math.round(x / step) * step
/** published values: numerical dust (a decaying motor, a leaking diode) reads as 0 */
const snap = (x: number, eps: number) => (Math.abs(x) < eps ? 0 : x)

function channel(b: boolean, nodes: [string, string, string], ids: [string, string, string, string, string], diodes: string): Channel {
  const sfx = b ? '_b' : ''
  return {
    in1: nodes[0],
    in2: nodes[1],
    en: nodes[2],
    out1: ids[0],
    out2: ids[1],
    en1: ids[2],
    en2: ids[3],
    motor: ids[4],
    diodes: diodes.split(',').map((x) => x.trim()).filter(Boolean),
    kMode: `mode${sfx}`,
    kDuty: `duty${sfx}`,
    kMotor: b ? 'motor_b_A' : 'motor_A',
    kRpm: `rpm_out${sfx}`,
    kDrop: b ? 'drop_b_V' : 'drop_V',
    kRpmExtra: `${ids[4]}.rpm`,
    hasDiodes: true,
    dead: false,
    ke: 0,
    lMotor: 0,
    mode: L298_MODE.COAST,
    d: 0,
    e: 0,
    edge: false,
  }
}

/** channels and their netlist facts, refreshed only when the netlist object changes */
function channels(ctx: BehaviorContext, st: State, info: NetInfo, net: Netlist): Channel[] {
  if (st.chNet === net) return st.chs
  st.chNet = net
  const o3 = str(ctx, 'out3', 'hc')
  const o4 = str(ctx, 'out4', 'hd')
  const withB = info.els.has(o3) && info.els.has(o4)
  if (st.chs.length !== (withB ? 2 : 1)) {
    const out = [
      channel(
        false,
        [str(ctx, 'in1', 'd7'), str(ctx, 'in2', 'd8'), str(ctx, 'ena', 'd5')],
        [str(ctx, 'out1', 'ha'), str(ctx, 'out2', 'hb'), str(ctx, 'en1', 'en_a'), str(ctx, 'en2', 'en_b'), str(ctx, 'motor', 'm1')],
        str(ctx, 'diodes', 'd_a_hi,d_a_lo,d_b_hi,d_b_lo'),
      ),
    ]
    if (withB) {
      out.push(
        channel(
          true,
          [str(ctx, 'in3', 'in3'), str(ctx, 'in4', 'in4'), str(ctx, 'enb', '')],
          [o3, o4, str(ctx, 'en3', 'en_c'), str(ctx, 'en4', 'en_d'), str(ctx, 'motorB', 'm2')],
          str(ctx, 'diodesB', 'd_c_hi,d_c_lo,d_d_hi,d_d_lo'),
        ),
      )
    }
    st.chs = out
  }
  for (const ch of st.chs) {
    ch.hasDiodes = ch.diodes.every((id) => info.els.has(id))
    const e1 = info.els.get(ch.en1)
    const e2 = info.els.get(ch.en2)
    // a burnt output transistor replaces its SW by a short or an open: the channel is dead
    ch.dead = (!!e1 && e1.type !== 'SW') || (!!e2 && e2.type !== 'SW')
    const m = info.els.get(ch.motor)
    ch.ke = m?.type === 'MOTOR' ? m.ke : 0
    ch.lMotor = m?.type === 'MOTOR' ? (m.l ?? 0) : 0
  }
  return st.chs
}

function level(ctx: BehaviorContext, st: State, node: string, gnd: string, vih: number, vil: number): boolean {
  const v = ctx.v(node, gnd)
  const prev = st.latch.get(node) ?? false
  const now = v >= vih ? true : v <= vil ? false : prev
  if (now !== prev) st.latch.set(node, now)
  return now
}

/** duty on an enable input: '' is the jumper (1); a PIN output is trusted for its PWM duty */
function enDuty(ctx: BehaviorContext, st: State, info: NetInfo, node: string, gnd: string, vih: number, vil: number): number {
  if (!node) return 1
  const p = info.pinAt.get(node)
  const ps = p ? ctx.pins[p.pin] : undefined
  if (p && ps && (ps.mode === 'OUTPUT' || ps.mode === 'OUTPUT_OPEN_DRAIN')) {
    const v = ctx.v(node, gnd)
    if (Math.abs(v - ps.level * p.vcc) < 0.2 * p.vcc) return Math.min(1, Math.max(0, ps.level))
  }
  return level(ctx, st, node, gnd, vih, vil) ? 1 : 0
}

function setHalf(ctx: BehaviorContext, info: NetInfo, src: string, en: string, value: number, closed: boolean): void {
  if (info.els.has(src)) ctx.setParam(src, 'value', value)
  if (info.els.get(en)?.type === 'SW') ctx.setParam(en, 'closed', closed)
}

function allOpen(ctx: BehaviorContext): void {
  const info = netInfo(ctx.netlist)
  for (const ch of channels(ctx, state(ctx), info, ctx.netlist)) {
    setHalf(ctx, info, ch.out1, ch.en1, 0, false)
    setHalf(ctx, info, ch.out2, ch.en2, 0, false)
  }
  const supply = str(ctx, 'supply', 'i_vs')
  if (supply && info.els.has(supply)) ctx.setParam(supply, 'value', 0)
}

export const behavior: Behavior = {
  id: 'l298n',

  init(ctx) {
    state(ctx)
  },

  tick(ctx, dt) {
    const s = ctx.solution
    if (!s) return
    const st = state(ctx)
    const info = netInfo(ctx.netlist)
    const chs = channels(ctx, st, info, ctx.netlist)
    const gnd = str(ctx, 'gnd', 'bat_n')
    const vs = Math.max(0, ctx.v(str(ctx, 'vs', 'vs'), gnd))
    const vih = num(ctx, 'vih', 2.3)
    const vil = num(ctx, 'vil', 1.5)
    const r = num(ctx, 'rTotal', 1.85)
    const iq = vs > 0.5 ? num(ctx, 'iq', 0.013) : 0
    const gear = num(ctx, 'gear', 1) || 1
    const coast = bool(ctx, 'coastPwm', true)

    // 1. decode; loss and Vs draw from the latest solution
    let loss = vs * iq
    let draw = iq
    for (const ch of chs) {
      const en = enDuty(ctx, st, info, ch.en, gnd, vih, vil)
      const in1 = level(ctx, st, ch.in1, gnd, vih, vil)
      const in2 = level(ctx, st, ch.in2, gnd, vih, vil)
      const logic = decodeL298(en > 0, in1, in2)
      const driving = logic === L298_MODE.CW || logic === L298_MODE.CCW
      ch.d = driving ? en : 0
      ch.mode = ch.dead ? L298_MODE.DEAD : logic
      const rpm = info.els.has(ch.motor) ? extraOf(s, ch.motor, ch.kRpmExtra) : 0
      ch.e = ch.ke * rpm * TWO_PI_60
      let drop = 0
      if (st.tsd) {
        // outputs open: nothing conducts
      } else if (ch.dead) {
        // a shorted transistor plus its conducting partner: Vs straight to ground
        if (logic !== L298_MODE.COAST && r > 0) {
          const iShoot = vs / r
          draw += iShoot
          loss += iShoot * iShoot * r
        }
      } else if (logic === L298_MODE.BRAKE) {
        const i = curOf(s, ch.out1)
        loss += r * i * i
        drop = r * Math.abs(i)
      } else if (driving) {
        const iOut = -curOf(s, logic === L298_MODE.CW ? ch.out1 : ch.out2) // into the motor
        const d = ch.d
        loss += coast ? coastPwmLoss(iOut, d, r) : r * iOut * iOut
        if (iOut > 0) draw += iOut
        const iOn = coast && d > 0 ? Math.abs(iOut) / d : Math.abs(iOut)
        drop = r * iOn
        // no flyback diodes: every PWM off edge drives L·di/dt into the open transistors. The
        // averaged sources have no edges, so this tick opens the outputs as one real off edge
        // and the transient engine (vBreak clamp, edgeSubsteps, maxV) resolves the kick.
        if (!ch.hasDiodes && d < 1 && iOn > num(ctx, 'iKick', 0.05)) {
          ch.edge = true
          st.kick = 0.5 * ch.lMotor * iOn * iOn * 1e6
        }
      }
      ctx.publish(ch.kDrop, snap(drop, 1e-4))
    }

    // 2. junction temperature, first order toward Tamb + P·Rθ; shutdown with hysteresis
    const sink = str(ctx, 'sink', 'hs_tab')
    const hasSink = !!sink && info.els.has(sink) && !info.els.get(sink)!.disabled
    const rth = hasSink ? num(ctx, 'rthJC', 3) + num(ctx, 'rthCS', 1) + num(ctx, 'rthSA', 15) : num(ctx, 'rthJA', 35)
    const tau = num(ctx, 'tauTh', 4)
    const tss = T_AMB + loss * rth
    st.tj = tau > 0 ? st.tj + (tss - st.tj) * (1 - Math.exp(-Math.max(0, dt) / tau)) : tss
    const tsdOn = num(ctx, 'tsd', 150)
    if (!st.tsd && st.tj >= tsdOn) st.tsd = true
    else if (st.tsd && st.tj < tsdOn - num(ctx, 'tsdHyst', 20)) st.tsd = false

    // 3. set the half-bridges (sources rounded to 5 mV so a slow sag doesn't rebuild every frame)
    let anyDead = 0
    for (const ch of chs) {
      if (ch.dead) anyDead = 1
      const out = ch.dead ? L298_MODE.DEAD : st.tsd || ch.edge ? L298_MODE.COAST : ch.mode
      ch.edge = false
      const fwd = out === L298_MODE.CW
      const rev = out === L298_MODE.CCW
      let v = 0
      if (fwd || rev) v = quant(coast ? coastPwmSource(ch.d, vs, fwd ? ch.e : -ch.e) : ch.d * vs, 5e-3)
      const on = fwd || rev || out === L298_MODE.BRAKE
      setHalf(ctx, info, ch.out1, ch.en1, fwd ? v : 0, on)
      setHalf(ctx, info, ch.out2, ch.en2, rev ? v : 0, on)
      const motor = info.els.has(ch.motor)
      ctx.publish(ch.kMode, out)
      ctx.publish(ch.kDuty, fwd || rev ? ch.d : 0)
      ctx.publish(ch.kMotor, motor ? curOf(s, ch.motor) : 0)
      ctx.publish(ch.kRpm, motor ? snap(extraOf(s, ch.motor, ch.kRpmExtra) / gear, 0.01) : 0)
    }

    // 4. the Vs draw (rounded to 1 mA): the driving halves' current, quiescent, any shoot-through
    const supply = str(ctx, 'supply', 'i_vs')
    if (supply && info.els.has(supply)) ctx.setParam(supply, 'value', vs > 0.1 ? quant(draw, 1e-3) : 0)

    const pIn = vs * draw
    ctx.publish('vs_V', vs)
    ctx.publish('bridge_W', loss)
    ctx.publish('tj', st.tj)
    ctx.publish('tsd_active', st.tsd ? 1 : 0)
    ctx.publish('heatsink', hasSink ? 1 : 0)
    ctx.publish('efficiency', pIn > 1e-3 ? Math.max(0, (100 * (pIn - loss)) / pIn) : 0)
    ctx.publish('kick_uJ', st.kick)
    ctx.publish('dead', anyDead)
  },

  onEvent(ctx, ev) {
    if (ev === 'power-off') {
      const st = state(ctx)
      st.tj = T_AMB
      st.tsd = false
    }
  },

  reset(ctx) {
    states.delete(ctx)
    state(ctx)
    allOpen(ctx)
  },

  dispose(ctx) {
    states.delete(ctx)
  },
}
