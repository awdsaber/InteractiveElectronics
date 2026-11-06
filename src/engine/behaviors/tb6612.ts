// TB6612FNG dual H-bridge (Toshiba), as two averaged half-bridges per channel.
//
// The netlist models each output (AO1, AO2, and BO1, BO2 for channel B) as a V source
// (value = duty·VM, referenced to the driver ground) behind half of Ron, followed by a SW that
// opens for high-Z. This behavior reads the logic inputs as voltages every tick, applies the
// datasheet truth table, and sets those sources and switches. It also sets the VM supply draw
// (an I source), runs the die's first-order thermal model with thermal shutdown, and applies
// the undervoltage lockout. The PWM ripple is not simulated: the sources carry the average, and
// the ripple only enters the I²R heating (see bridgeLoss).
//
// Params (defaults in brackets; channel A uses the curriculum's names):
//   pins     in1 [7], in2 [8], pwm [5], stby [4] (-1: tied high); channel B: bin1, bin2, pwmb [-1: unused]
//   elements out1 ['ha'], out2 ['hb'], en1 ['en_a'], en2 ['en_b'], motor ['m1'];
//            channel B: bout1, bout2, ben1, ben2, bmotor (channel B runs only when bout1 and bout2 exist)
//            supply ['i_vm']: I source from VM to gnd for the bridge draw ('' for none)
//   nodes    vm ['vm'], vcc ['5v'], gnd ['0']: the driver's ground; logic inputs are read against it
//   numbers  ronTotal [0.5 Ω, upper + lower, typ], iq [0.001 A from VM], rthJA [140 °C/W],
//            tauTh [2 s], tsd [175 °C], tsdHyst [20 °C], vmMin [2.5 V], vccMin [2.7 V],
//            pwmHz [980: ripple in the heating, 0 = smooth current], gear [1: rpm_out = motor rpm / gear],
//            seed [1: the random chatter of a missing ground]
// Publishes: mode (0 standby, 1 CW, 2 CCW, 3 brake, 4 coast), duty, motor_A, rpm_out, and with
// channel B mode_b, duty_b, motor_b_A, rpm_out_b; plus vm_V, tj, tsd_active, bridge_W, gnd_ok.

import type { Behavior, BehaviorContext, Element, Netlist, Solution } from '../types'

export const MODE = { STANDBY: 0, CW: 1, CCW: 2, BRAKE: 3, COAST: 4 } as const
export type Mode = (typeof MODE)[keyof typeof MODE]

const T_AMB = 25

/** Datasheet truth table (PWM is handled as the duty of the driving half). */
export function decode(in1: boolean, in2: boolean, stby: boolean): Mode {
  if (!stby) return MODE.STANDBY
  if (in1 && in2) return MODE.BRAKE
  if (in1) return MODE.CW
  if (in2) return MODE.CCW
  return MODE.COAST
}

/**
 * Bridge I²R loss, W, for average motor current `iAvg` at PWM `duty`, in drive/brake PWM.
 * The current swings by VM/R between the on (drive) and off (brake) phases: when the motor's L/R
 * is short against the PWM period it follows that square wave, var = D(1-D)(VM/R)²; when it is
 * long, the ripple is a triangle, ΔI = VM·D(1-D)/(L·f), var = ΔI²/12. The smaller one applies.
 */
export function bridgeLoss(iAvg: number, duty: number, vm: number, ron: number, rMotor: number, lMotor: number, pwmHz: number): number {
  let variance = 0
  const d = Math.min(1, Math.max(0, duty))
  if (pwmHz > 0 && d > 0 && d < 1 && rMotor + ron > 0) {
    variance = d * (1 - d) * (vm / (rMotor + ron)) ** 2
    if (lMotor > 0) {
      const dI = (vm * d * (1 - d)) / (lMotor * pwmHz)
      variance = Math.min(variance, (dI * dI) / 12)
    }
  }
  return ron * (iAvg * iAvg + variance)
}

interface Channel {
  suffix: '' | '_b'
  in1: number
  in2: number
  pwm: number
  out1: string
  out2: string
  en1: string
  en2: string
  motor: string
}

interface ChatterState {
  until: number
  mode: Mode
  duty: number
}

interface State {
  tj: number
  tsd: boolean
  /** latched logic level per input pin (inputs between VIL and VIH keep it) */
  latch: Map<number, boolean>
  rng: () => number
  chatter: ChatterState[]
}

const states = new WeakMap<BehaviorContext, State>()

/** mulberry32: a small seeded PRNG, so the "no ground" chatter is reproducible */
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

function state(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = { tj: T_AMB, tsd: false, latch: new Map(), rng: prng(num(ctx, 'seed', 1)), chatter: [] }
    states.set(ctx, s)
  }
  return s
}

// ── netlist lookups, cached per netlist object ──

interface NetInfo {
  els: Map<string, Element>
  pinNode: Map<number, { node: string; vcc: number }>
  /** union-find roots over DC-conducting elements */
  root: (n: string) => string
}
const netCache = new WeakMap<Netlist, NetInfo>()

function netInfo(net: Netlist): NetInfo {
  let info = netCache.get(net)
  if (info) return info
  const els = new Map<string, Element>()
  const pinNode = new Map<number, { node: string; vcc: number }>()
  const parent = new Map<string, string>()
  const find = (n: string): string => {
    let r = n
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!
    parent.set(n, r)
    return r
  }
  const join = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const el of net.elements) {
    els.set(el.id, el)
    if (el.type === 'PIN') pinNode.set(el.pin, { node: el.nodes[0], vcc: el.vcc })
    if (el.disabled) continue
    // capacitors, current sources and probes carry no DC; an open switch or blown fuse neither
    if (el.type === 'C' || el.type === 'I' || el.type === 'PROBE') continue
    if (el.type === 'SW' && !el.closed) continue
    if (el.type === 'FUSE' && el.blown) continue
    // PIN: an input is 1e9 Ω, but an output (or pull-up) ties the pin net to its ground: count it
    for (let i = 1; i < el.nodes.length; i++) join(el.nodes[0], el.nodes[i])
  }
  info = { els, pinNode, root: find }
  netCache.set(net, info)
  return info
}

const curOf = (s: Solution, id: string) => (s.currentOf ? s.currentOf(id) : (s.current[id] ?? 0))
const extraOf = (s: Solution, id: string, key: string) => (s.extraOf ? s.extraOf(id, key) : (s.extra[key] ?? 0))

function channels(ctx: BehaviorContext, info: NetInfo): Channel[] {
  const out: Channel[] = [
    {
      suffix: '',
      in1: num(ctx, 'in1', 7),
      in2: num(ctx, 'in2', 8),
      pwm: num(ctx, 'pwm', 5),
      out1: str(ctx, 'out1', 'ha'),
      out2: str(ctx, 'out2', 'hb'),
      en1: str(ctx, 'en1', 'en_a'),
      en2: str(ctx, 'en2', 'en_b'),
      motor: str(ctx, 'motor', 'm1'),
    },
  ]
  const b1 = str(ctx, 'bout1', '')
  const b2 = str(ctx, 'bout2', '')
  if (b1 && b2 && info.els.has(b1) && info.els.has(b2)) {
    out.push({
      suffix: '_b',
      in1: num(ctx, 'bin1', -1),
      in2: num(ctx, 'bin2', -1),
      pwm: num(ctx, 'pwmb', -1),
      out1: b1,
      out2: b2,
      en1: str(ctx, 'ben1', ''),
      en2: str(ctx, 'ben2', ''),
      motor: str(ctx, 'bmotor', ''),
    })
  }
  return out
}

function setHalf(ctx: BehaviorContext, info: NetInfo, src: string, en: string, value: number, closed: boolean): void {
  if (info.els.has(src)) ctx.setParam(src, 'value', value)
  if (en && info.els.has(en)) ctx.setParam(en, 'closed', closed)
}

/** both halves of every channel high-Z, and no supply draw */
function allOpen(ctx: BehaviorContext): void {
  const info = netInfo(ctx.netlist)
  for (const ch of channels(ctx, info)) {
    setHalf(ctx, info, ch.out1, ch.en1, 0, false)
    setHalf(ctx, info, ch.out2, ch.en2, 0, false)
  }
  const supply = str(ctx, 'supply', 'i_vm')
  if (supply && info.els.has(supply)) ctx.setParam(supply, 'value', 0)
}

export const behavior: Behavior = {
  id: 'tb6612',

  init(ctx) {
    state(ctx)
  },

  tick(ctx, dt) {
    const s = ctx.solution
    if (!s) return
    const st = state(ctx)
    const info = netInfo(ctx.netlist)
    const gnd = str(ctx, 'gnd', '0')
    const vmNode = str(ctx, 'vm', 'vm')
    const vccNode = str(ctx, 'vcc', '5v')
    const ron = num(ctx, 'ronTotal', 0.5)
    const gear = num(ctx, 'gear', 1) || 1
    const pwmHz = num(ctx, 'pwmHz', 980)
    const tsdOn = num(ctx, 'tsd', 175)
    const tsdOff = tsdOn - num(ctx, 'tsdHyst', 20)

    // the logic inputs need the driver's ground tied to the controller's ground ('0')
    const gndOk = gnd === '0' || (info.root(gnd) === info.root('0') && Math.abs(ctx.v(gnd)) <= 1)
    const vm = ctx.v(vmNode, gnd)
    const vcc = ctx.v(vccNode, gnd)
    const vih = 0.7 * vcc
    const vil = 0.3 * vcc
    const level = (pin: number): boolean => {
      const p = info.pinNode.get(pin)
      if (pin < 0 || !p) return false // TB6612 inputs have internal pull-downs
      const v = ctx.v(p.node, gnd)
      const prev = st.latch.get(pin) ?? false
      const now = v >= vih ? true : v <= vil ? false : prev
      st.latch.set(pin, now)
      return now
    }
    const duty = (pin: number): number => {
      const p = info.pinNode.get(pin)
      const ps = ctx.pins[pin]
      if (p && ps && (ps.mode === 'OUTPUT' || ps.mode === 'OUTPUT_OPEN_DRAIN')) {
        // a PWM pin is an averaged voltage; trust its duty when the input really sees it
        const v = ctx.v(p.node, gnd)
        if (Math.abs(v - ps.level * p.vcc) < 0.2 * p.vcc) return Math.min(1, Math.max(0, ps.level))
      }
      return level(pin) ? 1 : 0
    }

    const stbyPin = num(ctx, 'stby', 4)
    // with no ground reference VCC can't be measured either: the logic is erratic, not locked out
    const uvlo = vm < num(ctx, 'vmMin', 2.5) || (gndOk && vcc < num(ctx, 'vccMin', 2.7))
    const stby = stbyPin < 0 ? true : level(stbyPin)
    const chs = channels(ctx, info)

    // 1. decode each channel; its heat and VM draw come from the latest solution
    let loss = 0
    let draw = 0
    const decoded = chs.map((ch, k) => {
      let mode: Mode
      let d: number
      if (!gndOk) {
        // undefined inputs: the outputs chatter at random
        const c = (st.chatter[k] ??= { until: -1, mode: MODE.COAST, duty: 0 })
        if (ctx.t >= c.until) {
          const pick = [MODE.CW, MODE.CCW, MODE.BRAKE, MODE.COAST, MODE.COAST, MODE.STANDBY] as const
          c.mode = pick[Math.floor(st.rng() * pick.length)]
          c.duty = st.rng()
          c.until = ctx.t + 0.02 + st.rng() * 0.18
        }
        mode = uvlo ? MODE.STANDBY : c.mode
        d = c.duty
      } else {
        mode = uvlo ? MODE.STANDBY : decode(level(ch.in1), level(ch.in2), stby)
        d = mode === MODE.CW || mode === MODE.CCW ? duty(ch.pwm) : 0
      }
      const motor = info.els.get(ch.motor)
      // in thermal shutdown the outputs are open: no loss, no draw
      const src = st.tsd ? '' : mode === MODE.CW ? ch.out1 : mode === MODE.CCW ? ch.out2 : ''
      if (mode === MODE.BRAKE && !st.tsd) loss += ron * curOf(s, ch.out1) ** 2
      else if (src) {
        const iOut = -curOf(s, src) // out of the driving half, into the motor
        if (vm > 0) draw += Math.max(0, d * iOut)
        const rM = motor?.type === 'MOTOR' ? motor.r : 0
        const lM = motor?.type === 'MOTOR' ? (motor.l ?? 0) : 0
        loss += bridgeLoss(iOut, d, Math.max(0, vm), ron, rM, lM, motor ? pwmHz : 0)
      }
      return { mode, d, motor: !!motor }
    })

    // 2. die temperature: first order toward Tamb + P·RthJA; thermal shutdown with hysteresis
    const tau = num(ctx, 'tauTh', 2)
    const tss = T_AMB + loss * num(ctx, 'rthJA', 140)
    st.tj = tau > 0 ? st.tj + (tss - st.tj) * (1 - Math.exp(-Math.max(0, dt) / tau)) : tss
    if (!st.tsd && st.tj >= tsdOn) st.tsd = true
    else if (st.tsd && st.tj < tsdOff) st.tsd = false

    // 3. set the half-bridges
    chs.forEach((ch, k) => {
      const { mode, d, motor } = decoded[k]
      const out: Mode = st.tsd && mode !== MODE.STANDBY ? MODE.COAST : mode
      const v = d * Math.max(0, vm)
      const on = out === MODE.CW || out === MODE.CCW || out === MODE.BRAKE
      setHalf(ctx, info, ch.out1, ch.en1, out === MODE.CW ? v : 0, on)
      setHalf(ctx, info, ch.out2, ch.en2, out === MODE.CCW ? v : 0, on)
      ctx.publish(`mode${ch.suffix}`, out)
      ctx.publish(`duty${ch.suffix}`, out === MODE.CW || out === MODE.CCW ? d : 0)
      ctx.publish(ch.suffix ? 'motor_b_A' : 'motor_A', motor ? curOf(s, ch.motor) : 0)
      ctx.publish(`rpm_out${ch.suffix}`, motor ? extraOf(s, ch.motor, `${ch.motor}.rpm`) / gear : 0)
    })

    // 4. the VM draw: the driving halves' share of the motor current, plus the quiescent current
    const supply = str(ctx, 'supply', 'i_vm')
    if (supply && info.els.has(supply)) ctx.setParam(supply, 'value', vm > 0.1 ? draw + num(ctx, 'iq', 0.001) : 0)

    ctx.publish('vm_V', vm)
    ctx.publish('tj', st.tj)
    ctx.publish('tsd_active', st.tsd ? 1 : 0)
    ctx.publish('bridge_W', loss)
    ctx.publish('gnd_ok', gndOk ? 1 : 0)
  },

  onEvent(ctx, ev) {
    // everything off: the die cools to ambient before the next power-up (as the rating timers do)
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
