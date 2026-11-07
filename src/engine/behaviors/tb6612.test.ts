import { describe, expect, it } from 'vitest'
import type { BehaviorContext, Element, Netlist, PinState, Solution } from '../types'
import { MODE, behavior, bridgeLoss, decode } from './tb6612'

// A hand-driven context: tests set node voltages, element currents and pins directly, and read
// back what the behavior asked the circuit to do (setParam) and what it published.

const PINS: [number, string][] = [
  [4, 'd4'],
  [5, 'd5'],
  [7, 'd7'],
  [8, 'd8'],
  [9, 'd9'],
  [10, 'd10'],
  [11, 'd11'],
]

function netlist(extra: Element[] = [], withGndLink = true): Netlist {
  const els: Element[] = [
    ...PINS.map(([pin, node]): Element => ({ id: `pin${pin}`, type: 'PIN', nodes: [node, '0'], pin, vcc: 5 })),
    { id: 'bat', type: 'V', nodes: ['bat_p', 'bat_n'], value: 6, rInternal: 0.6 },
    { id: 'bat_sw', type: 'SW', nodes: ['bat_p', 'vm'], closed: true },
    { id: 'i_vm', type: 'I', nodes: ['vm', 'bat_n'], value: 0 },
    { id: 'ha', type: 'V', nodes: ['ha_i', 'bat_n'], value: 0 },
    { id: 'ron_a', type: 'R', nodes: ['ha_i', 'sa'], value: 0.25 },
    { id: 'en_a', type: 'SW', nodes: ['sa', 'ao1'], closed: false },
    { id: 'hb', type: 'V', nodes: ['hb_i', 'bat_n'], value: 0 },
    { id: 'ron_b', type: 'R', nodes: ['hb_i', 'sb'], value: 0.25 },
    { id: 'en_b', type: 'SW', nodes: ['sb', 'ao2'], closed: false },
    { id: 'm1', type: 'MOTOR', nodes: ['ao1', 'ao2'], r: 4, l: 5e-4, ke: 0.0054 },
    ...extra,
  ]
  if (withGndLink) els.push({ id: 'gnd_link', type: 'R', nodes: ['bat_n', '0'], value: 0.01 })
  return { elements: els }
}

interface Fake {
  ctx: BehaviorContext
  nodeV: Record<string, number>
  current: Record<string, number>
  extra: Record<string, number>
  pins: Record<number, PinState>
  set: Record<string, number | boolean>
  pub: Record<string, number>
  tick(dt?: number): void
  pin(n: number, level: number): void
}

function fake(params: Record<string, number | string | boolean> = {}, net: Netlist = netlist()): Fake {
  const nodeV: Record<string, number> = { vm: 6, '5v': 5, bat_n: 0 }
  const current: Record<string, number> = {}
  const extra: Record<string, number> = {}
  const pins: Record<number, PinState> = {}
  const set: Record<string, number | boolean> = {}
  const pub: Record<string, number> = {}
  const solution: Solution = { ok: true, nodeV, current, power: {}, extra }
  const base = { gnd: 'bat_n', vcc: '5v', vm: 'vm', supply: 'i_vm', gear: 48, seed: 7 }
  const ctx: BehaviorContext = {
    t: 0,
    solution,
    pins,
    powered: true,
    params: { ...base, ...params },
    netlist: net,
    v: (n, ref) => (nodeV[n] ?? 0) - (ref ? (nodeV[ref] ?? 0) : 0),
    publish: (k, v) => {
      pub[k] = v
    },
    setParam: (id, key, value) => {
      set[`${id}.${key}`] = value
    },
    setMotorLoad: () => {},
    burn: () => {},
    events: { push: () => {} },
    mcu: { hold() {}, release() {}, reset() {}, injectEdge() {}, serialIn() {}, attachI2c() {}, attachSpi() {}, timeMicros: 0, running: true },
  }
  const f: Fake = {
    ctx,
    nodeV,
    current,
    extra,
    pins,
    set,
    pub,
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

/** STBY high, then AIN1/AIN2/PWMA */
function drive(f: Fake, in1: number, in2: number, pwm: number, stby = 1) {
  f.pin(4, stby)
  f.pin(7, in1)
  f.pin(8, in2)
  f.pin(5, pwm)
}

describe('tb6612: truth table (decode)', () => {
  it('maps IN1/IN2/STBY to CW, CCW, short brake, stop and standby', () => {
    expect(decode(true, false, true)).toBe(MODE.CW)
    expect(decode(false, true, true)).toBe(MODE.CCW)
    expect(decode(true, true, true)).toBe(MODE.BRAKE)
    expect(decode(false, false, true)).toBe(MODE.COAST)
    for (const [a, b] of [[true, false], [false, true], [true, true], [false, false]] as const) expect(decode(a, b, false)).toBe(MODE.STANDBY)
  })
})

describe('tb6612: half-bridge outputs', () => {
  it('CW at full PWM: AO1 = VM, AO2 = 0, both halves driving', () => {
    const f = fake()
    drive(f, 1, 0, 1)
    f.tick()
    expect(f.set['ha.value']).toBeCloseTo(6, 6)
    expect(f.set['hb.value']).toBe(0)
    expect(f.set['en_a.closed']).toBe(true)
    expect(f.set['en_b.closed']).toBe(true)
    expect(f.pub.mode).toBe(MODE.CW)
    expect(f.pub.duty).toBe(1)
  })

  it('CCW at half PWM: AO2 = duty·VM', () => {
    const f = fake()
    drive(f, 0, 1, 128 / 255)
    f.tick()
    expect(f.set['ha.value']).toBe(0)
    expect(f.set['hb.value']).toBeCloseTo((128 / 255) * 6, 3) // rounded to 1 mV
    expect(f.pub.mode).toBe(MODE.CCW)
    expect(f.pub.duty).toBeCloseTo(128 / 255, 6)
  })

  it('short brake ties both outputs to ground; stop and standby open them (high-Z)', () => {
    const f = fake()
    drive(f, 1, 1, 1)
    f.tick()
    expect([f.set['ha.value'], f.set['hb.value'], f.set['en_a.closed'], f.set['en_b.closed']]).toEqual([0, 0, true, true])
    expect(f.pub.mode).toBe(MODE.BRAKE)
    drive(f, 0, 0, 1)
    f.tick()
    expect([f.set['en_a.closed'], f.set['en_b.closed']]).toEqual([false, false])
    expect(f.pub.mode).toBe(MODE.COAST)
    drive(f, 1, 0, 1, 0)
    f.tick()
    expect([f.set['en_a.closed'], f.set['en_b.closed']]).toEqual([false, false])
    expect(f.pub.mode).toBe(MODE.STANDBY)
  })

  it('reads inputs as voltages against VIH = 0.7·VCC / VIL = 0.3·VCC, relative to the driver ground', () => {
    const f = fake()
    drive(f, 1, 0, 1)
    f.nodeV.d7 = 3.0 // between VIL (1.5) and VIH (3.5): keeps the previous level
    f.tick()
    expect(f.pub.mode).toBe(MODE.COAST) // IN1 starts LOW
    f.nodeV.d7 = 3.6
    f.tick()
    expect(f.pub.mode).toBe(MODE.CW)
    f.nodeV.d7 = 3.0
    f.tick()
    expect(f.pub.mode).toBe(MODE.CW)
    f.nodeV.d7 = 1.4
    f.tick()
    expect(f.pub.mode).toBe(MODE.COAST)
  })

  it('an input with no PIN element reads LOW (internal pull-down); stby: -1 means tied high', () => {
    const f = fake({ in2: 12, stby: -1 })
    f.pin(7, 1)
    f.pin(5, 1)
    f.tick()
    expect(f.pub.mode).toBe(MODE.CW)
  })

  it('pwm: -1 means PWM tied high (full duty)', () => {
    const f = fake({ pwm: -1 })
    f.pin(4, 1)
    f.pin(7, 1)
    f.pin(8, 0)
    f.tick()
    expect(f.pub.mode).toBe(MODE.CW)
    expect(f.pub.duty).toBe(1)
    expect(f.set['ha.value']).toBeCloseTo(6, 9)
  })

  it('rounds the source value to 1 mV, so a sagging VM does not change it every frame', () => {
    const f = fake()
    drive(f, 1, 0, 0.5)
    f.nodeV.vm = 6.00031
    f.tick()
    expect(f.set['ha.value']).toBeCloseTo(3.0, 9)
    f.nodeV.vm = 5.99988
    f.tick()
    expect(f.set['ha.value']).toBeCloseTo(3.0, 9)
  })

  it('undervoltage lockout: VM < 2.5 V or VCC < 2.7 V puts the bridge in standby', () => {
    const f = fake()
    drive(f, 1, 0, 1)
    f.nodeV.vm = 2.3
    f.tick()
    expect(f.pub.mode).toBe(MODE.STANDBY)
    f.nodeV.vm = 6
    f.nodeV['5v'] = 2.5
    f.tick()
    expect(f.pub.mode).toBe(MODE.STANDBY)
    f.nodeV['5v'] = 5
    f.tick()
    expect(f.pub.mode).toBe(MODE.CW)
  })
})

describe('tb6612: supply current, loss and heat', () => {
  it('draws duty × motor current + 1 mA from VM', () => {
    const f = fake()
    drive(f, 1, 0, 0.5)
    f.current.ha = -0.4 // 0.4 A out of the AO1 half into the motor
    f.current.m1 = 0.4
    f.tick()
    expect(f.set['i_vm.value']).toBeCloseTo(0.5 * 0.4 + 0.001, 6)
    expect(f.pub.motor_A).toBeCloseTo(0.4, 6)
  })

  it('does not draw when regenerating, and draws only the quiescent current in brake', () => {
    const f = fake()
    drive(f, 1, 0, 0.5)
    f.current.ha = 0.3
    f.tick()
    expect(f.set['i_vm.value']).toBeCloseTo(0.001, 6)
    drive(f, 1, 1, 1)
    f.current.ha = 1
    f.current.hb = -1
    f.tick()
    expect(f.set['i_vm.value']).toBeCloseTo(0.001, 6)
  })

  it('bridge loss is Ron·I² at full duty, plus the PWM ripple at part duty', () => {
    // full duty: no ripple, 1 A in 0.5 Ω = 0.5 W
    expect(bridgeLoss(1, 1, 6, 0.5, 4, 5e-4, 980)).toBeCloseTo(0.5, 9)
    // smooth current (pwmHz 0): the plain averaged I²R
    expect(bridgeLoss(0.4, 0.5, 6, 0.5, 4, 5e-4, 0)).toBeCloseTo(0.08, 9)
    // 980 Hz into a 0.11 ms L/R motor: the current follows the PWM, var = D(1-D)(VM/R)^2
    const square = 0.25 * (6 / 4.5) ** 2
    expect(bridgeLoss(0.4, 0.5, 6, 0.5, 4, 5e-4, 980)).toBeCloseTo(0.5 * (0.16 + square), 9)
    // 20 kHz: triangular ripple dI = VM·D(1-D)/(L·f), var = dI^2/12
    const dI = (6 * 0.25) / (5e-4 * 20000)
    expect(bridgeLoss(0.4, 0.5, 6, 0.5, 4, 5e-4, 20000)).toBeCloseTo(0.5 * (0.16 + (dI * dI) / 12), 9)
  })

  it('publishes VM, output rpm through the gearbox and the summed bridge loss', () => {
    const f = fake()
    drive(f, 1, 0, 1)
    f.current.ha = -1
    f.current.m1 = 1
    f.extra['m1.rpm'] = 9600
    f.tick()
    expect(f.pub.vm_V).toBeCloseTo(6, 9)
    expect(f.pub.rpm_out).toBeCloseTo(200, 9)
    expect(f.pub.bridge_W).toBeCloseTo(0.5, 9)
  })

  it('heats toward 25 + P·RthJA, shuts down at Tsd and restarts 20 °C lower', () => {
    const f = fake({ rthJA: 140, tauTh: 2, tsd: 175 })
    drive(f, 1, 0, 1)
    f.current.ha = -1.8
    f.current.m1 = 1.8
    // P = 1.8² × 0.5 = 1.62 W → Tss = 25 + 227 = 252 °C
    let t = 0
    while (!f.pub.tsd_active && t < 20) {
      f.tick(0.05)
      t += 0.05
    }
    expect(f.pub.tsd_active).toBe(1)
    expect(f.pub.tj).toBeGreaterThanOrEqual(175)
    expect(t).toBeGreaterThan(1)
    expect(t).toBeLessThan(5)
    expect([f.set['en_a.closed'], f.set['en_b.closed']]).toEqual([false, false])
    // outputs open: no current, it cools
    f.current.ha = 0
    f.current.m1 = 0
    while (f.pub.tsd_active && t < 40) {
      f.tick(0.05)
      t += 0.05
    }
    expect(f.pub.tsd_active).toBe(0)
    expect(f.pub.tj).toBeLessThan(155)
    expect(f.set['en_a.closed']).toBe(true)
  })

  it('reset forgets heat and a latched shutdown', () => {
    const f = fake({ tauTh: 0.1 })
    drive(f, 1, 0, 1)
    f.current.ha = -3
    for (let i = 0; i < 40; i++) f.tick(0.05)
    expect(f.pub.tsd_active).toBe(1)
    behavior.reset!(f.ctx)
    expect([f.set['en_a.closed'], f.set['en_b.closed'], f.set['i_vm.value']]).toEqual([false, false, 0])
    f.current.ha = 0
    f.tick()
    expect(f.pub.tsd_active).toBe(0)
    expect(f.pub.tj).toBeLessThan(26)
  })
})

describe('tb6612: missing common ground', () => {
  it('with no DC path from the driver ground to the Uno ground the outputs chatter at random', () => {
    const f = fake({}, netlist([], false))
    drive(f, 1, 0, 1)
    const seen = new Set<number>()
    const outs = new Set<string>()
    for (let i = 0; i < 300; i++) {
      f.tick()
      seen.add(f.pub.mode)
      outs.add(`${f.set['en_a.closed']}:${(f.set['ha.value'] as number)?.toFixed(2)}`)
    }
    expect(f.pub.gnd_ok).toBe(0)
    expect(seen.size).toBeGreaterThanOrEqual(3)
    expect(outs.size).toBeGreaterThan(5)
  })

  it('a ground that sits more than 1 V away also counts as missing', () => {
    const f = fake()
    drive(f, 1, 0, 1)
    f.tick()
    expect(f.pub.gnd_ok).toBe(1)
    f.nodeV.bat_n = 2
    f.tick()
    expect(f.pub.gnd_ok).toBe(0)
  })

  it('is deterministic for a given seed', () => {
    const run = () => {
      const f = fake({ seed: 3 }, netlist([], false))
      drive(f, 1, 0, 1)
      const modes: number[] = []
      for (let i = 0; i < 120; i++) {
        f.tick()
        modes.push(f.pub.mode)
      }
      return modes.join(',')
    }
    expect(run()).toBe(run())
  })
})

describe('tb6612: two channels, several instances', () => {
  const chB: Element[] = [
    { id: 'hc', type: 'V', nodes: ['hc_i', 'bat_n'], value: 0 },
    { id: 'en_c', type: 'SW', nodes: ['hc_i', 'bo1'], closed: false },
    { id: 'hd', type: 'V', nodes: ['hd_i', 'bat_n'], value: 0 },
    { id: 'en_d', type: 'SW', nodes: ['hd_i', 'bo2'], closed: false },
    { id: 'm2', type: 'MOTOR', nodes: ['bo1', 'bo2'], r: 4, ke: 0.0054 },
  ]
  const B = { bin1: 9, bin2: 10, pwmb: 11, bout1: 'hc', bout2: 'hd', ben1: 'en_c', ben2: 'en_d', bmotor: 'm2' }

  it('drives channel B from its own pins and publishes *_b values; heat is shared on one die', () => {
    const f = fake(B, netlist(chB))
    drive(f, 1, 0, 1) // A: CW
    f.pin(9, 0)
    f.pin(10, 1)
    f.pin(11, 0.5) // B: CCW at half
    f.current.ha = -1
    f.current.hd = -0.5
    f.extra['m2.rpm'] = -4800
    f.tick()
    expect(f.pub.mode).toBe(MODE.CW)
    expect(f.pub.mode_b).toBe(MODE.CCW)
    expect(f.set['hd.value']).toBeCloseTo(3, 6)
    expect(f.set['hc.value']).toBe(0)
    expect(f.pub.duty_b).toBeCloseTo(0.5, 6)
    expect(f.pub.rpm_out_b).toBeCloseTo(-100, 6)
    expect(f.set['i_vm.value']).toBeCloseTo(1 + 0.25 + 0.001, 6)
    // A: 1 A at full duty, 0.5 W. B: 0.5 A at D = 0.5 into 4 Ω with no L (square ripple):
    // 0.5 × (0.25 + 0.25 × (6 / 4.5)²) = 0.34722 W
    expect(f.pub.bridge_W).toBeCloseTo(0.5 + 0.5 * (0.25 + 0.25 * (6 / 4.5) ** 2), 9)
  })

  it('channel B is optional: without its params nothing of channel B is touched or published', () => {
    const f = fake({}, netlist(chB))
    drive(f, 1, 0, 1)
    f.tick()
    expect(f.set['hc.value']).toBeUndefined()
    expect(f.pub.mode_b).toBeUndefined()
  })

  it('two instances keep separate state (heat, shutdown)', () => {
    const net = netlist(chB)
    const hot = fake({ tauTh: 0.1 }, net)
    const cool = fake({ in1: 9, in2: 10, pwm: 11, out1: 'hc', out2: 'hd', en1: 'en_c', en2: 'en_d', motor: 'm2', supply: '', tauTh: 0.1 }, net)
    drive(hot, 1, 0, 1)
    hot.current.ha = -3
    cool.pin(4, 1)
    cool.pin(9, 1)
    cool.pin(11, 1)
    for (let i = 0; i < 40; i++) {
      hot.tick(0.05)
      cool.tick(0.05)
    }
    expect(hot.pub.tsd_active).toBe(1)
    expect(cool.pub.tsd_active).toBe(0)
    expect(cool.pub.mode).toBe(MODE.CW)
    expect(cool.set['i_vm.value']).toBeUndefined()
  })
})
