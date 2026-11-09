// ne555: the NE555 timer at the level of its blocks, so a lesson can wire it as an astable or a
// monostable and watch the capacitor cross the thresholds.
//
// Inside the real part (TI NE555, SLFS022): a three-resistor 5 kΩ divider, two comparators, an SR latch, an
// open-collector discharge transistor on pin 7 and a totem-pole output on pin 3. The lesson builds the
// divider (R_D1..R_D3 on pins 8-5-1) and the pin-5 node as ordinary resistors, so the control voltage
// really does move the thresholds. This behavior is the rest:
//   THRESHOLD comparator: v(thr) >= v(th_ref)  (2/3 Vcc)  -> reset the latch: OUTPUT low, DISCHARGE on
//   TRIGGER comparator:   v(trig) <= v(tr_ref) (1/3 Vcc)  -> set the latch:   OUTPUT high, DISCHARGE off
// TRIGGER wins when both are asserted (datasheet function table: a low trigger forces the output high
// whatever THRESHOLD does), so a trigger held low longer than the pulse keeps a monostable high. The
// supply must be at least 4.5 V (NE555 recommended operating range 4.5 V to 16 V); below it the latch is
// held reset, the output is low and the discharge transistor is off. It leaves that state above 4.6 V.
//
// params (all optional):
//   thr   ('thr')    THRESHOLD node (pin 6)
//   trig  (= thr)    TRIGGER node (pin 2); give it its own node for a monostable
//   vcc   ('vcc')    supply node (pin 8)
//   thRef ('th_ref') node at 2/3 Vcc (pin 5); trRef ('tr_ref') node at 1/3 Vcc. If an id is '' the
//                    reference falls back to 2/3 and 1/3 of the supply.
//   out   ('V_OUT')  a V element: driven to 0 V, or Vcc - drop when the latch is set
//   dis   ('SW_DIS') a SW element: closed while the latch is reset (the discharge transistor)
//   vMin  (4.5)      supply below which the part does nothing, V
//   drop  (1.2)      OUTPUT high drop, V. With the V element's series resistance (5 Ω in the lesson) the
//                    high level is Vcc - 1.7 V at 100 mA, the datasheet typical, and VOL stays under 0.1 V
//                    at 10 mA (typ. 0.1 V at 15 V)
//   disMax (0.2)     discharge current at which the transistor fails (A): the datasheet gives no absolute
//                    maximum for pin 7, so this is a conservative stand-in
//
// Publishes: q (1 = output high), freq (Hz, from consecutive rising edges), duty (high time / period),
// dutyPct (the same in %), pulse (s, the last high width: the monostable pulse), vth / vtl (the comparator levels, V),
// stepLimited (1 when the period is only a few simulation steps, so the shown rate is the solver's, not
// the part's). freq and duty read 0 once the output has stopped switching.
//
// onStep reads the nodes on every instantaneous solve and allocates nothing (state lives in one
// preallocated object per instance). Edge times are interpolated inside the step where a node crossed its
// reference. The outputs (V_OUT, SW_DIS) are changed with setParam only when the latch flips, and the
// bench applies them before the next step. The behavior restarts on power-on/off, break, repair, strip
// and reset.

import type { Behavior, BehaviorContext, Solution } from '../types'

interface State {
  q: number
  uv: number
  tPrev: number // time of the previous step, -1 before the first
  thrPrev: number
  trigPrev: number
  dtSeen: number
  tRise: number // crossing time of the last rising output edge, -1 none
  tPeriodStart: number // the rising edge before it, -1 none
  period: number
  high: number
  pulse: number
  freq: number
  duty: number
  stepLimited: number
  disClosed: number // last applied: -1 unknown, 0, 1
  outValue: number // last applied V_OUT value, NaN unknown
  vccSeen: number
  burnt: number
}

const states = new WeakMap<BehaviorContext, State>()
function stateOf(ctx: BehaviorContext): State {
  let st = states.get(ctx)
  if (!st) {
    st = { q: 0, uv: 0, tPrev: -1, thrPrev: 0, trigPrev: 0, dtSeen: 0, tRise: -1, tPeriodStart: -1, period: 0, high: 0, pulse: 0, freq: 0, duty: 0, stepLimited: 0, disClosed: -1, outValue: NaN, vccSeen: 0, burnt: 0 }
    states.set(ctx, st)
  }
  return st
}

const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d)
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const volts = (s: Solution, node: string): number => (s.voltageOf ? s.voltageOf(node) : (s.nodeV[node] ?? 0))
const UV_HYST = 0.1
const STEP_LIMITED_STEPS = 10

function restart(st: State): void {
  st.q = 0
  st.uv = 0
  st.tPrev = -1
  st.dtSeen = 0
  st.tRise = -1
  st.tPeriodStart = -1
  st.period = 0
  st.high = 0
  st.pulse = 0
  st.freq = 0
  st.duty = 0
  st.stepLimited = 0
  st.vccSeen = 0
  st.burnt = 0
}

/** drive the discharge transistor and the output stage to match the latch (only calls setParam on a change) */
function apply(ctx: BehaviorContext, st: State, vcc: number): void {
  const dis = str(ctx.params.dis, 'SW_DIS')
  const out = str(ctx.params.out, 'V_OUT')
  const closed = st.uv === 0 && st.q === 0 ? 1 : 0
  if (closed !== st.disClosed) {
    st.disClosed = closed
    ctx.setParam(dis, 'closed', closed === 1)
  }
  const vh = st.q === 1 && st.uv === 0 ? Math.max(0, vcc - num(ctx.params.drop, 1.2)) : 0
  if (!(Math.abs(vh - st.outValue) < 1e-3)) {
    st.outValue = vh
    ctx.setParam(out, 'value', vh)
  }
}

export const behavior: Behavior = {
  id: 'ne555',

  init(ctx) {
    const st = stateOf(ctx)
    restart(st)
    st.disClosed = -1
    st.outValue = NaN
    apply(ctx, st, 0)
  },

  onStep(ctx, t, s) {
    const st = stateOf(ctx)
    const p = ctx.params
    const thrNode = str(p.thr, 'thr')
    const trigNode = str(p.trig, '') || thrNode
    const vcc = volts(s, str(p.vcc, 'vcc'))
    const thr = volts(s, thrNode)
    const trig = volts(s, trigNode)
    const dt = st.tPrev >= 0 ? t - st.tPrev : 0
    if (dt > 0) st.dtSeen = dt
    st.vccSeen = vcc

    // pin 7 shorting a stiff supply: the transistor is gone before the frame's rating check sees it
    if (st.disClosed === 1 && st.burnt === 0) {
      const id = s.currentOf ? s.currentOf(str(p.dis, 'SW_DIS')) : (s.current[str(p.dis, 'SW_DIS')] ?? 0)
      const lim = num(p.disMax, 0.2)
      if (Math.abs(id) > lim) {
        st.burnt = 1
        ctx.burn(str(p.dis, 'SW_DIS'), 'overcurrent', { value: Math.abs(id), limit: lim })
      }
    }

    // supply monitor: below the minimum the part is dead (output low, discharge off)
    if (st.uv === 1) {
      if (vcc >= num(p.vMin, 4.5) + UV_HYST) st.uv = 0
    } else if (vcc < num(p.vMin, 4.5)) st.uv = 1
    if (st.uv === 1) {
      if (st.q === 1) fall(st, st.tPrev >= 0 ? st.tPrev : t)
      st.q = 0
      apply(ctx, st, vcc)
      st.thrPrev = thr
      st.trigPrev = trig
      st.tPrev = t
      return
    }

    const thRefId = str(p.thRef, 'th_ref')
    const trRefId = str(p.trRef, 'tr_ref')
    const vth = thRefId ? volts(s, thRefId) : (2 * vcc) / 3
    const vtl = trRefId ? volts(s, trRefId) : vcc / 3

    // trigger comparator (set) wins over threshold comparator (reset)
    let next = st.q
    let tEdge = t
    if (trig <= vtl) {
      next = 1
      if (st.tPrev >= 0 && st.trigPrev > vtl && st.trigPrev > trig) tEdge = t - (dt * (vtl - trig)) / (st.trigPrev - trig)
    } else if (thr >= vth) {
      next = 0
      if (st.tPrev >= 0 && st.thrPrev < vth && thr > st.thrPrev) tEdge = t - (dt * (thr - vth)) / (thr - st.thrPrev)
    }
    if (next !== st.q) {
      st.q = next
      if (next === 1) rise(st, tEdge)
      else fall(st, tEdge)
      apply(ctx, st, vcc)
    }
    st.thrPrev = thr
    st.trigPrev = trig
    st.tPrev = t
  },

  tick(ctx) {
    const st = stateOf(ctx)
    // follow a supply tweak while the output sits high
    if (st.q === 1 && st.uv === 0 && ctx.powered) apply(ctx, st, st.vccSeen)
    // the rate goes stale once the output stops switching
    let freq = st.freq
    let duty = st.duty
    let fast = st.stepLimited
    if (st.tRise < 0 || st.period <= 0 || ctx.t - st.tRise > 2.5 * st.period + 0.01) {
      freq = 0
      duty = 0
      fast = 0
    }
    const vcc = st.vccSeen
    ctx.publish('q', st.q)
    ctx.publish('freq', freq)
    ctx.publish('duty', duty)
    ctx.publish('dutyPct', duty * 100)
    ctx.publish('pulse', st.pulse)
    ctx.publish('stepLimited', fast)
    ctx.publish('vth', (2 * vcc) / 3)
    ctx.publish('vtl', vcc / 3)
  },

  onEvent(ctx, ev) {
    if (ev === 'upload') return
    const st = stateOf(ctx)
    restart(st)
    apply(ctx, st, 0)
  },

  reset(ctx) {
    const st = stateOf(ctx)
    restart(st)
    apply(ctx, st, 0)
  },
}

function rise(st: State, tEdge: number): void {
  if (st.tRise >= 0) {
    const period = tEdge - st.tRise
    if (period > 0) {
      st.period = period
      st.freq = 1 / period
      st.duty = st.high / period
      st.stepLimited = st.dtSeen > 0 && period < STEP_LIMITED_STEPS * st.dtSeen ? 1 : 0
    }
  }
  st.tPeriodStart = st.tRise
  st.tRise = tEdge
  st.high = 0
}

function fall(st: State, tEdge: number): void {
  if (st.tRise >= 0 && tEdge >= st.tRise) {
    st.high = tEdge - st.tRise
    st.pulse = st.high
  }
}
