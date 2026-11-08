import { describe, expect, it } from 'vitest'
import type { BehaviorContext, BurnEvent, Element, Netlist, PinState, Solution } from '../types'
import { L298_MODE as M, behavior, coastPwmLoss, coastPwmSource, decodeL298, riseFactor } from './l298n'

// A hand-driven context, as in tb6612.test.ts: tests set node voltages, currents and pins, and
// read back what the behavior asked the circuit to do (setParam / burn) and what it published.

const DIODES: Element[] = [
  { id: 'd_a_hi', type: 'D', nodes: ['out1', 'vs'] },
  { id: 'd_a_lo', type: 'D', nodes: ['bat_n', 'out1'] },
  { id: 'd_b_hi', type: 'D', nodes: ['out2', 'vs'] },
  { id: 'd_b_lo', type: 'D', nodes: ['bat_n', 'out2'] },
]

function netlist(opts: { diodes?: boolean; sink?: boolean; chB?: boolean; deadA?: boolean } = {}): Netlist {
  const { diodes = true, sink = true, chB = false, deadA = false } = opts
  const els: Element[] = [
    { id: 'pin5', type: 'PIN', nodes: ['d5', '0'], pin: 5, vcc: 5 },
    { id: 'pin7', type: 'PIN', nodes: ['d7', '0'], pin: 7, vcc: 5 },
    { id: 'pin8', type: 'PIN', nodes: ['d8', '0'], pin: 8, vcc: 5 },
    { id: 'bat', type: 'V', nodes: ['bat_p', 'bat_n'], value: 7.4, rInternal: 0.15 },
    { id: 'i_vs', type: 'I', nodes: ['vs', 'bat_n'], value: 0 },
    { id: 'ha', type: 'V', nodes: ['ha_i', 'bat_n'], value: 0 },
    { id: 'rq_a', type: 'R', nodes: ['ha_i', 'sa'], value: 0.925 },
    deadA ? { id: 'en_a', type: 'R', nodes: ['sa', 'out1'], value: 0.01 } : { id: 'en_a', type: 'SW', nodes: ['sa', 'out1'], closed: false },
    { id: 'hb', type: 'V', nodes: ['hb_i', 'bat_n'], value: 0 },
    { id: 'rq_b', type: 'R', nodes: ['hb_i', 'sb'], value: 0.925 },
    { id: 'en_b', type: 'SW', nodes: ['sb', 'out2'], closed: false },
    { id: 'm1', type: 'MOTOR', nodes: ['out1', 'out2'], r: 4, l: 5e-4, ke: 0.0054 },
    { id: 'gnd_link', type: 'R', nodes: ['bat_n', '0'], value: 0.01 },
    ...(diodes ? DIODES : []),
    ...(sink ? [{ id: 'hs_tab', type: 'R', nodes: ['hs', 'bat_n'], value: 0.01 } as Element] : []),
  ]
  if (chB) {
    els.push(
      { id: 'hc', type: 'V', nodes: ['hc_i', 'bat_n'], value: 0 },
      { id: 'en_c', type: 'SW', nodes: ['sc', 'out3'], closed: false },
      { id: 'hd', type: 'V', nodes: ['hd_i', 'bat_n'], value: 0 },
      { id: 'en_d', type: 'SW', nodes: ['sd', 'out4'], closed: false },
      { id: 'm2', type: 'MOTOR', nodes: ['out3', 'out4'], r: 4, l: 5e-4, ke: 0.0054 },
    )
  }
  return { elements: els }
}

interface Fake {
  ctx: BehaviorContext
  nodeV: Record<string, number>
  current: Record<string, number>
  extra: Record<string, number>
  set: Record<string, number | boolean>
  pub: Record<string, number>
  burns: [string, BurnEvent['reason']][]
  tick(dt?: number): void
  pin(n: number, level: number): void
}

function fake(params: Record<string, number | string | boolean> = {}, net: Netlist = netlist()): Fake {
  const nodeV: Record<string, number> = { vs: 7.4, bat_n: 0 }
  const current: Record<string, number> = {}
  const extra: Record<string, number> = {}
  const pins: Record<number, PinState> = {}
  const set: Record<string, number | boolean> = {}
  const pub: Record<string, number> = {}
  const burns: [string, BurnEvent['reason']][] = []
  const solution: Solution = { ok: true, nodeV, current, power: {}, extra }
  const ctx: BehaviorContext = {
    t: 0,
    solution,
    pins,
    powered: true,
    params: { gear: 48, ...params },
    netlist: net,
    v: (n, ref) => (nodeV[n] ?? 0) - (ref ? (nodeV[ref] ?? 0) : 0),
    publish: (k, v) => {
      pub[k] = v
    },
    setParam: (id, key, value) => {
      set[`${id}.${key}`] = value
    },
    setMotorLoad: () => {},
    burn: (id, reason) => {
      burns.push([id, reason])
    },
    events: { push: () => {} },
    mcu: { hold() {}, release() {}, reset() {}, injectEdge() {}, serialIn() {}, serialOut() {}, attachI2c() {}, attachSpi() {}, timeMicros: 0, running: true },
  }
  const f: Fake = {
    ctx,
    nodeV,
    current,
    extra,
    set,
    pub,
    burns,
    tick(dt = 1 / 60) {
      ctx.t += dt
      behavior.tick!(ctx, dt)
    },
    pin(n, level) {
      pins[n] = { mode: 'OUTPUT', level }
      nodeV[`d${n}`] = level * 5
    },
  }
  behavior.init?.(ctx)
  return f
}

/** ENA (pin 5, duty), IN1 (7), IN2 (8) */
function drive(f: Fake, in1: number, in2: number, en: number) {
  f.pin(7, in1)
  f.pin(8, in2)
  f.pin(5, en)
}

/** motor current `i` flowing out1 → out2, sourced by the driving half */
function flow(f: Fake, i: number) {
  f.current.m1 = i
  f.current.ha = i > 0 ? -i : 0
  f.current.hb = i < 0 ? i : 0
}

describe('l298n: datasheet truth table', () => {
  it('EN low coasts whatever the inputs; IN1 = IN2 with EN high is a fast stop (brake)', () => {
    expect(decodeL298(false, true, false)).toBe(M.COAST)
    expect(decodeL298(false, false, true)).toBe(M.COAST)
    expect(decodeL298(true, true, false)).toBe(M.CW)
    expect(decodeL298(true, false, true)).toBe(M.CCW)
    expect(decodeL298(true, false, false)).toBe(M.BRAKE)
    expect(decodeL298(true, true, true)).toBe(M.BRAKE)
  })
})


// typical fit per path: 1.4 V + 1.15 Ω (2.55 V at 1 A, 3.7 V at 2 A)
const V0 = 1.4
const R = 1.15
const IQ_HIGH = 0.05
const IQ_LOW = 0.013
const IQ_OFF = 0.004

describe('l298n: half-bridges', () => {
  it('forward at full EN: OUT1 = Vs − Vce0, OUT2 = 0, both halves conducting', () => {
    const f = fake()
    drive(f, 1, 0, 1)
    f.tick()
    expect(f.set['ha.value']).toBeCloseTo(7.4 - V0, 2)
    expect(f.set['hb.value']).toBe(0)
    expect([f.set['en_a.closed'], f.set['en_b.closed']]).toEqual([true, true])
    expect(f.pub.mode).toBe(M.CW)
    expect(f.pub.duty).toBe(1)
  })

  it('EN low opens all four transistors (coast through the flyback diodes)', () => {
    const f = fake()
    drive(f, 1, 0, 0)
    f.tick()
    expect([f.set['en_a.closed'], f.set['en_b.closed']]).toEqual([false, false])
    expect(f.pub.mode).toBe(M.COAST)
  })

  it('brake ties both outputs to the low side', () => {
    const f = fake()
    drive(f, 0, 0, 1)
    f.tick()
    expect([f.set['ha.value'], f.set['hb.value']]).toEqual([0, 0])
    expect([f.set['en_a.closed'], f.set['en_b.closed']]).toEqual([true, true])
  })

  it('EN-PWM coasts in the off phase: the average is d·V_on + (1 − d)·back-EMF, clamped to the rails', () => {
    expect(coastPwmSource(0.5, 8, 4)).toBeCloseTo(6)
    expect(coastPwmSource(1, 8, 4)).toBeCloseTo(8)
    expect(coastPwmSource(0.2, 8, -3)).toBe(0) // clamped by the diodes to the rails
    expect(coastPwmSource(0.2, 8, 20, 9)).toBe(9)
    // a motor already above V_on draws nothing: the source follows its EMF
    expect(coastPwmSource(0.5, 6, 6.5, 7.4)).toBeCloseTo(6.5)
  })

  it('the rise-time factor: the mean of the rising current over the on time', () => {
    expect(riseFactor(1, 1e-6)).toBeCloseTo(1, 4)
    expect(riseFactor(204e-6, 97e-6)).toBeCloseTo(1 - (1 - Math.exp(-204 / 97)) / (204 / 97), 6)
    expect(riseFactor(204e-6, 97e-6)).toBeCloseTo(0.58, 2)
    expect(riseFactor(0, 1e-4)).toBe(1)
  })

  it('EN-PWM source uses the effective duty d·k (k from τ = L/(R_motor + rTotal) and t_on = d/980 Hz)', () => {
    const f = fake()
    drive(f, 1, 0, 0.5)
    // motor at 5000 rpm → E = 0.0054 × 5000 × 2π/60 ≈ 2.83 V
    f.extra['m1.rpm'] = 5000
    f.tick()
    const e = (0.0054 * 5000 * 2 * Math.PI) / 60
    const dEff = 0.5 * riseFactor(0.5 / 980, 5e-4 / (4 + R))
    const von = 7.4 - V0
    expect(f.set['ha.value'] as number).toBeCloseTo(dEff * von + (1 - dEff) * e, 1)
    // reverse: OUT2 drives, and a motor spinning backwards (negative rpm) adds its EMF to OUT2
    drive(f, 0, 1, 0.5)
    f.extra['m1.rpm'] = -5000
    f.tick()
    expect(f.set['hb.value'] as number).toBeCloseTo(dEff * von + (1 - dEff) * e, 1)
    expect(f.set['ha.value']).toBe(0)
  })

  it('coastPwm: false gives the plain d·V_on average', () => {
    const f = fake({ coastPwm: false })
    drive(f, 1, 0, 0.5)
    f.extra['m1.rpm'] = 5000
    f.tick()
    expect(f.set['ha.value'] as number).toBeCloseTo(0.5 * (7.4 - V0), 2)
  })

  it('reads inputs against fixed TTL thresholds (VIH 2.3 V, VIL 1.5 V): 3.3 V logic works', () => {
    const f = fake()
    drive(f, 1, 0, 1)
    f.nodeV.d7 = 3.3
    f.tick()
    expect(f.pub.mode).toBe(M.CW)
    f.nodeV.d7 = 1.9 // in between: keeps its level
    f.tick()
    expect(f.pub.mode).toBe(M.CW)
    f.nodeV.d7 = 1.4
    f.tick()
    expect(f.pub.mode).toBe(M.BRAKE)
  })

  it('an enable node of "" is the ENA jumper (always enabled)', () => {
    const f = fake({ ena: '' })
    f.pin(7, 1)
    f.pin(8, 0)
    f.tick()
    expect(f.pub.mode).toBe(M.CW)
    expect(f.pub.duty).toBe(1)
  })
})

describe('l298n: drop, heat and efficiency', () => {
  it('1 A at full EN on 7.4 V: drop ≈ 2.55 V (typical), bridge heat ≈ 2.55 W + Vs·50 mA, efficiency ≈ 65 %', () => {
    const f = fake()
    drive(f, 1, 0, 1)
    flow(f, 1)
    f.tick()
    expect(f.pub.drop_V).toBeCloseTo(2.55, 2)
    expect(f.pub.bridge_W).toBeCloseTo(2.55 + 7.4 * IQ_HIGH, 3)
    const pIn = 7.4 * (1 + IQ_HIGH)
    expect(f.pub.efficiency).toBeCloseTo((100 * (pIn - 2.55 - 7.4 * IQ_HIGH)) / pIn, 1)
    expect(f.set['i_vs.value'] as number).toBeCloseTo(1 + IQ_HIGH, 3)
    expect(f.pub.motor_A).toBe(1)
  })

  it('2 A at full EN: drop ≈ 3.7 V; a light 0.14 A load still loses ≈ 1.56 V', () => {
    const f = fake()
    drive(f, 1, 0, 1)
    flow(f, 2)
    f.tick()
    expect(f.pub.drop_V).toBeCloseTo(3.7, 2)
    flow(f, 0.14)
    f.tick()
    expect(f.pub.drop_V).toBeCloseTo(V0 + 0.14 * R, 2)
  })

  it('in EN-PWM the on-phase current is I/d_eff: loss Vce0·I + R·I²/d_eff, drop Vce0 + R·I/d_eff', () => {
    expect(coastPwmLoss(0.5, 0.5, R, V0)).toBeCloseTo(V0 * 0.5 + R * 0.5, 6)
    expect(coastPwmLoss(1, 0, R, V0)).toBe(0)
    const f = fake({ pwmHz: 0 }) // no rise-time correction: d_eff = d
    drive(f, 1, 0, 0.5)
    flow(f, 0.5)
    f.tick()
    expect(f.pub.drop_V).toBeCloseTo(V0 + R, 2)
    expect(f.pub.bridge_W).toBeCloseTo(V0 * 0.5 + R * 0.5 + 7.4 * IQ_HIGH, 3)
  })

  it('quiescent Vs current by state: 50 mA enabled with an input high, 13 mA inputs low, 4 mA EN low', () => {
    const f = fake()
    drive(f, 0, 0, 1) // brake: enabled, inputs low
    f.tick()
    expect(f.set['i_vs.value'] as number).toBeCloseTo(IQ_LOW, 3)
    drive(f, 1, 0, 0) // EN low
    f.tick()
    expect(f.set['i_vs.value'] as number).toBeCloseTo(IQ_OFF, 3)
    drive(f, 1, 0, 1)
    f.tick()
    expect(f.set['i_vs.value'] as number).toBeCloseTo(IQ_HIGH, 3)
  })

  it('brake loss is I²·R; coast has no bridge loss beyond the quiescent draw', () => {
    const f = fake()
    drive(f, 0, 0, 1)
    flow(f, 0)
    f.current.ha = 0.8
    f.tick()
    expect(f.pub.bridge_W).toBeCloseTo(0.64 * R + 7.4 * IQ_LOW, 3)
    drive(f, 1, 0, 0)
    f.tick()
    expect(f.pub.bridge_W).toBeCloseTo(7.4 * IQ_OFF, 4)
  })

  it('publishes the output rpm through the 48:1 gearbox', () => {
    const f = fake()
    drive(f, 1, 0, 1)
    f.extra['m1.rpm'] = 9600
    f.tick()
    expect(f.pub.rpm_out).toBeCloseTo(200)
  })
})

describe('l298n: thermal', () => {
  /** ticks until `cond` or `max` s, returns the elapsed time */
  const until = (f: Fake, cond: () => boolean, max: number) => {
    let t = 0
    while (!cond() && t < max) {
      f.tick(0.05)
      t += 0.05
    }
    return t
  }

  it('with the heatsink Rθ = 3 + 1 + rthSA; Tj settles at 25 + P·Rθ', () => {
    const f = fake({ rthSA: 15, tauTh: 1 })
    drive(f, 1, 0, 1)
    flow(f, 1)
    until(f, () => false, 15)
    const p = 2.55 + 7.4 * IQ_HIGH
    expect(f.pub.tj).toBeCloseTo(25 + p * 19, 0)
    expect(f.pub.heatsink).toBe(1)
  })

  it('without the heatsink (its tab bond removed) Rθja = 35 °C/W: two channels at 1 A pass 150 °C and shut down', () => {
    const f = fake({ tauTh: 2 }, netlist({ sink: false, chB: true }))
    drive(f, 1, 0, 1)
    f.nodeV.in3 = 5
    f.nodeV.in4 = 0
    flow(f, 1)
    f.current.hc = -1
    f.current.m2 = 1
    // 2 × 2.55 W + 7.4 × 50 mA ≈ 5.5 W → 25 + 5.5 × 35 ≈ 217 °C
    const t = until(f, () => f.pub.tsd_active === 1, 20)
    expect(f.pub.heatsink).toBe(0)
    expect(f.pub.tsd_active).toBe(1)
    expect(f.pub.tj).toBeGreaterThanOrEqual(150)
    expect(t).toBeGreaterThan(0.5)
    expect(t).toBeLessThan(10)
    expect([f.set['en_a.closed'], f.set['en_b.closed'], f.set['en_c.closed'], f.set['en_d.closed']]).toEqual([false, false, false, false])
    // outputs open, it cools and restarts below 150 − 20 °C
    flow(f, 0)
    f.current.hc = 0
    f.current.m2 = 0
    until(f, () => f.pub.tsd_active === 0, 30)
    expect(f.pub.tsd_active).toBe(0)
    expect(f.pub.tj).toBeLessThan(131)
    expect(f.set['en_a.closed']).toBe(true)
  })

  it('reset and power-off forget the heat', () => {
    const f = fake({ tauTh: 0 })
    drive(f, 1, 0, 1)
    flow(f, 2)
    f.tick()
    expect(f.pub.tj).toBeGreaterThan(100)
    behavior.onEvent!(f.ctx, 'power-off')
    flow(f, 0)
    f.tick()
    expect(f.pub.tj).toBeLessThan(35)
    flow(f, 2)
    f.tick()
    behavior.reset!(f.ctx)
    flow(f, 0)
    f.tick()
    expect(f.pub.tj).toBeLessThan(35)
  })
})

describe('l298n: channel B', () => {
  it('runs from IN3/IN4 nodes when its half-bridges exist, ENB jumpered', () => {
    const f = fake({}, netlist({ chB: true }))
    drive(f, 1, 0, 1)
    f.nodeV.in3 = 0
    f.nodeV.in4 = 5
    f.tick()
    expect(f.pub.mode_b).toBe(M.CCW)
    expect(f.set['hd.value']).toBeCloseTo(7.4 - V0, 2)
    expect(f.set['hc.value']).toBe(0)
  })

  it('is optional: without hc/hd nothing of channel B is touched or published', () => {
    const f = fake()
    drive(f, 1, 0, 1)
    f.tick()
    expect(f.pub.mode_b).toBeUndefined()
    expect(f.set['hc.value']).toBeUndefined()
  })
})

describe('l298n: flyback diodes and a dead bridge', () => {
  it('EN-PWM with current flowing and no flyback diodes: the outputs open for one real off edge per drive command', () => {
    const f = fake({ pwmHz: 0 }, netlist({ diodes: false }))
    drive(f, 1, 0, 0.4)
    flow(f, 0.3)
    f.tick()
    expect([f.set['en_a.closed'], f.set['en_b.closed']]).toEqual([false, false])
    // ½·L·I_on², I_on = 0.3 / 0.4
    expect(f.pub.kick_uJ).toBeCloseTo(0.5 * 5e-4 * 0.75 ** 2 * 1e6, 1)
    // the behavior never fails parts itself: the transient engine's maxV check does
    expect(f.burns).toEqual([])
    // latched: the same command does not kick again, however many frames follow
    for (let k = 0; k < 5; k++) {
      f.tick()
      expect(f.set['en_a.closed']).toBe(true)
    }
    // a new duty is a new command: one more edge
    drive(f, 1, 0, 0.6)
    f.tick()
    expect(f.set['en_a.closed']).toBe(false)
  })

  it('with the diodes fitted, EN-PWM stays closed; full EN has no PWM edges', () => {
    const f = fake()
    drive(f, 1, 0, 0.4)
    flow(f, 0.3)
    f.tick()
    expect(f.set['en_a.closed']).toBe(true)
    const g = fake({}, netlist({ diodes: false }))
    drive(g, 1, 0, 1)
    flow(g, 0.3)
    g.tick()
    expect(g.set['en_a.closed']).toBe(true)
  })

  it('numerical dust in the rpm and the drop reads as 0', () => {
    const f = fake()
    drive(f, 0, 0, 1)
    f.extra['m1.rpm'] = 3e-20
    f.current.ha = 1e-9
    f.tick()
    expect(f.pub.rpm_out).toBe(0)
    expect(f.pub.drop_V).toBe(0)
  })

  it('a failed (shorted) output transistor: the bridge is dead and any drive command shorts Vs to ground', () => {
    const f = fake({}, netlist({ deadA: true }))
    drive(f, 1, 0, 1)
    f.tick()
    expect(f.pub.mode).toBe(M.DEAD)
    expect(f.pub.dead).toBe(1)
    expect(f.set['ha.value']).toBe(0)
    expect(f.set['i_vs.value'] as number).toBeCloseTo((7.4 - V0) / R + IQ_HIGH, 2)
    expect(f.pub.bridge_W).toBeGreaterThan(25)
    drive(f, 1, 0, 0) // EN low: everything off, no short
    f.tick()
    expect(f.set['i_vs.value'] as number).toBeCloseTo(IQ_OFF, 3)
  })
})
