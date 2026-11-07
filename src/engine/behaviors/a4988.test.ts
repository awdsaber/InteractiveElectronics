import { describe, expect, it } from 'vitest'
import type { BehaviorContext, BehaviorMcu, BurnEvent, Element, Netlist, PinState, Solution } from '../types'
import { behavior, decodeMicrostep, tripCurrent } from './a4988'

// A hand-driven context: tests set node voltages and feed STEP/DIR/EN edges through onPin with
// MCU timestamps, then tick, and read back the coil currents the behavior asked for.

const STEP = 3
const DIR = 4
const EN = 8

function netlist(opts: { openA?: boolean } = {}): Netlist {
  const els: Element[] = [
    { id: 'ia', type: 'I', nodes: ['a2', 'a1'], value: 0, partId: 'u1' },
    { id: 'lca', type: 'L', nodes: ['am', 'a2'], value: 2.8e-3 },
    { id: 'ib', type: 'I', nodes: ['b2', 'b1'], value: 0, partId: 'u1' },
    { id: 'rcb', type: 'R', nodes: ['b1', 'bm'], value: 1.5 },
    { id: 'lcb', type: 'L', nodes: ['bm', 'b2'], value: 2.8e-3 },
    { id: 'i_vmot', type: 'I', nodes: ['vmot', '0'], value: 0, partId: 'u1' },
  ]
  if (!opts.openA) els.push({ id: 'rca', type: 'R', nodes: ['a1', 'am'], value: 1.5 })
  return { elements: els }
}

interface Fake {
  ctx: BehaviorContext
  nodeV: Record<string, number>
  set: Record<string, number | boolean>
  pub: Record<string, number>
  burns: [string, BurnEvent['reason']][]
  notes: string[]
  mcu: { timeMicros: number; running: boolean }
  /** the MCU clock restarts at 0 (upload, mcu.reset()) */
  restart(): void
  /** advance the MCU clock and tick once per 1/60 s */
  run(seconds: number): void
  edge(pin: number, level: number, tUs?: number): void
  /** n STEP pulses (2 µs high) every periodUs, ticking as time passes */
  pulses(n: number, periodUs: number | ((i: number) => number)): void
  setMs(ms1: number, ms2: number, ms3: number): void
}

const FRAME_US = 1e6 / 60

function fake(params: Record<string, number | string | boolean> = {}, net: Netlist = netlist()): Fake {
  const nodeV: Record<string, number> = { vmot: 12, '5v': 5, vref: 0.544, ms1: 5, ms2: 5, ms3: 5 }
  const set: Record<string, number | boolean> = {}
  const pub: Record<string, number> = {}
  const burns: [string, BurnEvent['reason']][] = []
  const notes: string[] = []
  const solution: Solution = { ok: true, nodeV, current: {}, power: {}, extra: {} }
  const mcuState = { timeMicros: 0, running: true }
  const mcu: BehaviorMcu = {
    hold() {},
    release() {},
    reset() {},
    injectEdge() {},
    serialIn() {},
    serialOut() {},
    attachI2c() {},
    attachSpi() {},
    get timeMicros() {
      return mcuState.timeMicros
    },
    get running() {
      return mcuState.running
    },
  }
  const ctx: BehaviorContext = {
    t: 0,
    solution,
    pins: {},
    powered: true,
    params: { ...params },
    netlist: net,
    v: (n, ref) => (nodeV[n] ?? 0) - (ref ? (nodeV[ref] ?? 0) : 0),
    publish: (k, v) => {
      pub[k] = v
    },
    setParam: (id, key, value) => {
      set[`${id}.${key}`] = value
    },
    setMotorLoad: () => {},
    burn: (id, reason, detail) => {
      burns.push([id, reason])
      if (detail?.note) notes.push(detail.note)
    },
    events: { push: () => {} },
    mcu,
  }
  let lastTick = 0
  const tickTo = (tUs: number) => {
    while (lastTick + FRAME_US <= tUs) {
      lastTick += FRAME_US
      mcuState.timeMicros = lastTick
      ctx.t = lastTick / 1e6
      behavior.tick!(ctx, FRAME_US / 1e6)
    }
    mcuState.timeMicros = tUs
  }
  const out: PinState = { mode: 'OUTPUT', level: 0 }
  const f: Fake = {
    ctx,
    nodeV,
    set,
    pub,
    burns,
    notes,
    mcu: mcuState,
    restart() {
      lastTick = 0
      mcuState.timeMicros = 0
    },
    run(seconds) {
      tickTo(mcuState.timeMicros + seconds * 1e6)
    },
    edge(pin, level, tUs = mcuState.timeMicros) {
      tickTo(tUs)
      out.level = level
      behavior.onPin!(ctx, pin, out, tUs)
    },
    pulses(n, period) {
      let t = mcuState.timeMicros
      for (let i = 0; i < n; i++) {
        f.edge(STEP, 1, t)
        f.edge(STEP, 0, t + 2)
        t += typeof period === 'number' ? period : period(i)
      }
      tickTo(t)
    },
    setMs(a, b, c) {
      nodeV.ms1 = a * 5
      nodeV.ms2 = b * 5
      nodeV.ms3 = c * 5
    },
  }
  behavior.init?.(ctx)
  behavior.onEvent?.(ctx, 'power-on')
  return f
}

/** the motor connector of coil A pulled out (the bench hands behaviors a new netlist object) */
const unplugA = (f: Fake) => {
  ;(f.ctx as { netlist: Netlist }).netlist = netlist({ openA: true })
}

const near = (v: number, want: number, tol = 0.15) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * tol)

describe('a4988: MS1–MS3 decoding and the trip current', () => {
  it('decodes the datasheet table', () => {
    expect(decodeMicrostep(false, false, false)).toBe(1)
    expect(decodeMicrostep(true, false, false)).toBe(2)
    expect(decodeMicrostep(false, true, false)).toBe(4)
    expect(decodeMicrostep(true, true, false)).toBe(8)
    expect(decodeMicrostep(true, true, true)).toBe(16)
  })

  it('I_trip = Vref / (8 · Rs)', () => {
    expect(tripCurrent(0.544, 0.068)).toBeCloseTo(1.0, 3)
    expect(tripCurrent(0.8, 0.1)).toBeCloseTo(1.0, 3)
    expect(tripCurrent(4.95, 0.068)).toBeCloseTo(9.1, 1)
  })

  it('reads the mode from the MS voltages (VIH = 0.7 VDD) and publishes it', () => {
    const f = fake()
    f.run(0.05)
    expect(f.pub.microstep).toBe(16)
    f.setMs(0, 0, 0)
    f.run(0.05)
    expect(f.pub.microstep).toBe(1)
    f.nodeV.ms1 = 3.0 // below 3.5 V reads LOW
    f.nodeV.ms2 = 3.6
    f.run(0.05)
    expect(f.pub.microstep).toBe(4)
  })
})

describe('a4988: coil currents from the sine/cosine table', () => {
  it('home position (45°): each coil carries 70.7 % of I_trip', () => {
    const f = fake()
    f.run(0.1)
    expect(f.pub.itrip_A).toBeCloseTo(1.0, 3)
    expect(f.pub.coilA_A).toBeCloseTo(0.707, 2)
    expect(f.pub.coilB_A).toBeCloseTo(0.707, 2)
    expect(f.set['ia.value']).toBeCloseTo(0.707, 2)
    expect(f.set['ib.value']).toBeCloseTo(0.707, 2)
  })

  it('1/16: four slow microsteps turn the vector 22.5° (coil A = cos 67.5°)', () => {
    const f = fake()
    f.edge(DIR, 1)
    f.pulses(4, 20000)
    f.run(0.1)
    expect(f.pub.coilA_A).toBeCloseTo(Math.cos((67.5 * Math.PI) / 180), 2)
    expect(f.pub.coilB_A).toBeCloseTo(Math.sin((67.5 * Math.PI) / 180), 2)
    expect(f.pub.steps).toBe(4)
  })

  it('half step reaches 100 % on one coil; full step stays on the 45° points', () => {
    const f = fake()
    f.setMs(1, 0, 0)
    f.edge(DIR, 1)
    f.pulses(1, 20000)
    f.run(0.1)
    expect(f.pub.coilA_A).toBeCloseTo(0, 2)
    expect(f.pub.coilB_A).toBeCloseTo(1, 2)
    f.setMs(0, 0, 0)
    f.pulses(1, 20000)
    f.run(0.1)
    expect(Math.abs(f.pub.coilA_A)).toBeCloseTo(0.707, 2)
    expect(Math.abs(f.pub.coilB_A)).toBeCloseTo(0.707, 2)
  })

  it('ENABLE HIGH turns the outputs off; the translator still counts', () => {
    const f = fake()
    f.edge(EN, 1)
    f.run(0.05)
    expect(f.pub.coilA_A).toBe(0)
    expect(f.set['ia.value']).toBe(0)
    f.pulses(3, 10000)
    f.run(0.02)
    expect(f.pub.steps).toBe(3)
    f.edge(EN, 0)
    f.run(0.05)
    expect(f.pub.coilA_A).toBeGreaterThan(0.3)
  })

  it('ignores pulses shorter than 1 µs', () => {
    const f = fake()
    const t = f.mcu.timeMicros + 100
    f.edge(STEP, 1, t)
    f.edge(STEP, 0, t + 0.5)
    f.run(0.05)
    expect(f.pub.steps).toBe(0)
  })
})

describe('a4988: rotor', () => {
  it('3200 microsteps at 60 rpm (312 µs) make one turn with nothing skipped', () => {
    const f = fake()
    f.edge(DIR, 1)
    f.pulses(3200, 312.5)
    f.run(0.3)
    expect(f.pub.skipped).toBe(0)
    expect(f.pub.steps).toBe(3200)
    near(f.pub.shaft_deg, 360, 0.01)
  })

  it('publishes rpm while turning, and DIR LOW turns it back', () => {
    const f = fake()
    f.edge(DIR, 1)
    let rpm = 0
    f.pulses(1600, (i) => {
      if (i === 1500) rpm = f.pub.rpm
      return 312.5
    })
    near(rpm, 60, 0.1)
    f.run(0.3)
    f.edge(DIR, 0)
    f.pulses(1600, 312.5)
    f.run(0.3)
    expect(Math.abs(f.pub.shaft_deg)).toBeLessThan(1)
  })

  it('a step rate the torque cannot follow (full step from standstill at 1500 steps/s, loaded) skips steps', () => {
    const f = fake({ loadNm: 0.1 })
    f.setMs(0, 0, 0)
    f.edge(DIR, 1)
    f.pulses(400, 667)
    f.run(0.3)
    expect(f.pub.skipped).toBeGreaterThan(0)
    expect(f.pub.shaft_deg).toBeLessThan(400 * 1.8 * 0.5)
  })

  it('a load above the holding torque stalls it; within it, it holds', () => {
    // T_max = 0.40 N·m × 1.0 A / 1.7 A ≈ 0.235 N·m at I_trip = 1 A
    const ok = fake({ loadNm: 0.15 })
    ok.edge(DIR, 1)
    ok.pulses(800, 1000)
    ok.run(0.3)
    expect(ok.pub.skipped).toBe(0)
    const stall = fake({ loadNm: 0.3 })
    stall.edge(DIR, 1)
    stall.pulses(800, 1000)
    stall.run(0.3)
    expect(stall.pub.shaft_deg).toBeLessThan(5)
    expect(stall.pub.skipped).toBeGreaterThan(0)
  })

  it('a higher supply raises the top speed (current builds faster against L and back-EMF)', () => {
    // a 1/8 ramp up to 900 rpm (12 000 steps/s): at 12 V it falls out (≈ 640 rpm), at 24 V it keeps up
    const ramp = (v: number) => {
      const f = fake({ loadNm: 0.05 })
      f.nodeV.vmot = v
      f.setMs(1, 1, 0)
      f.edge(DIR, 1)
      const n = 9000
      f.pulses(n, (i) => {
        const rpm = 30 + ((900 - 30) * Math.min(1, i / 6000))
        return 1e6 / ((rpm / 60) * 200 * 8)
      })
      return f.pub.skipped
    }
    expect(ramp(12)).toBeGreaterThan(0)
    expect(ramp(24)).toBe(0)
  })
})

describe('a4988: limits and failures', () => {
  it('runs warm but safe at 1 A on a bare carrier: Tj ≈ 25 + 0.7 W × 90 °C/W ≈ 88 °C', () => {
    const f = fake()
    f.edge(DIR, 1)
    f.run(40)
    near(f.pub.tj, 25 + (0.707 ** 2 * 2) * 0.7 * 90, 0.1)
    expect(f.pub.tsd_active).toBe(0)
  })

  it('without a heatsink thermal shutdown trips near 1.5 A, not at 1.3 A', () => {
    const tsdAt = (amps: number) => {
      const f = fake()
      f.nodeV.vref = amps * 8 * 0.068
      let tripped = false
      for (let k = 0; k < 240; k++) {
        f.run(0.25)
        if (f.pub.tsd_active === 1) tripped = true
      }
      return tripped
    }
    expect(tsdAt(1.3)).toBe(false)
    expect(tsdAt(1.6)).toBe(true)
  })

  it('no current limit on a genuine A4988: the overcurrent latch (> 2.1 A) turns the outputs off; toggling ENABLE retries', () => {
    const f = fake()
    f.nodeV.vref = 4.95
    f.setMs(0, 0, 0)
    f.run(0.05)
    near(f.pub.itrip_A, 9.1, 0.02)
    expect(f.pub.ocp_latched).toBe(1)
    expect(f.pub.coilA_A).toBe(0)
    expect(f.set['ia.value']).toBe(0)
    f.run(2)
    expect(f.burns).toEqual([])
    expect(f.pub.tj).toBeLessThan(30)
    f.edge(EN, 1)
    f.run(0.02)
    expect(f.pub.ocp_latched).toBe(0)
    f.edge(EN, 0)
    f.run(0.05)
    expect(f.pub.ocp_latched).toBe(1) // the trimmer is still at the stop: it trips again
    // and a power cycle clears it too
    behavior.onEvent!(f.ctx, 'power-off')
    expect(f.pub.ocp_latched).toBe(1) // (published on the next tick)
    behavior.onEvent!(f.ctx, 'power-on')
    f.nodeV.vref = 0.544
    f.run(0.05)
    expect(f.pub.ocp_latched).toBe(0)
    near(f.pub.coilA_A, 0.707, 0.05)
  })

  it('a clone without working protection (ocp false): coils cap at V/R ≈ 5.5 A, thermal shutdown trips, then the driver is damaged', () => {
    const f = fake({ ocp: false })
    f.nodeV.vref = 4.95
    f.setMs(0, 0, 0)
    f.run(0.05)
    near(f.pub.itrip_A, 9.1, 0.02)
    near(f.pub.coilA_A, 12 / 2.2, 0.05)
    let tsdAt = -1
    for (let i = 0; i < 1500 && !f.burns.length; i++) {
      f.run(1 / 60)
      if (tsdAt < 0 && f.pub.tsd_active === 1) tsdAt = f.mcu.timeMicros / 1e6
    }
    expect(tsdAt).toBeGreaterThan(0)
    expect(tsdAt).toBeLessThan(2)
    expect(f.burns.length).toBe(1)
    expect(f.burns[0][0]).toBe('ia')
    expect(f.mcu.timeMicros / 1e6).toBeGreaterThan(tsdAt)
  })

  it('thermal shutdown recovers 15 °C below the trip', () => {
    const f = fake({ rthJA: 200 }) // 0.7 W × 200 → 165 °C: just over the trip
    f.run(60)
    // it cycles: sometimes off, the die between 150 and 165 °C
    expect(f.pub.tj).toBeGreaterThan(145)
    expect(f.pub.tj).toBeLessThan(170)
  })

  it('unplugging a coil while energised burns the driver', () => {
    const f = fake()
    f.run(0.1)
    expect(f.burns).toEqual([])
    unplugA(f)
    f.run(0.05)
    expect(f.burns).toEqual([['ia', 'overvoltage']])
    expect(f.notes[0]).toMatch(/coil A was cut open carrying 0\.71 A, and its ½·L·I² = 0\.70 mJ/)
    expect(f.pub.coilA_A).toBe(0)
    expect(f.pub.coilB_A).toBe(0)
  })

  it('unplugging coil B burns coil B\'s source', () => {
    const f = fake()
    f.run(0.1)
    ;(f.ctx as { netlist: Netlist }).netlist = { elements: netlist().elements.filter((e) => e.id !== 'rcb') }
    f.run(0.05)
    expect(f.burns).toEqual([['ib', 'overvoltage']])
  })

  it('a VMOT power cycle keeps the input levels (VDD is the Uno\'s): ENABLE HIGH stays HIGH', () => {
    const f = fake()
    f.edge(EN, 1)
    f.run(0.05)
    behavior.onEvent!(f.ctx, 'power-off')
    behavior.onEvent!(f.ctx, 'power-on')
    f.run(0.05)
    expect(f.pub.coilA_A).toBe(0)
  })

  it('after mcu.reset() the old run\'s queued entries are dropped and the new run\'s edges count', () => {
    const f = fake()
    f.edge(DIR, 1)
    f.pulses(320, 312.5) // 1/16: 36° electrical... 320 microsteps = 36° of shaft
    f.run(0.1)
    const t = f.mcu.timeMicros
    expect(f.pub.steps).toBe(320)
    // the reset: floats stamped at the old time, then the clock restarts at 0 and the new run writes
    f.edge(STEP, 0, t)
    behavior.onPin!(f.ctx, DIR, { mode: 'INPUT', level: 0 }, t + 10)
    behavior.onPin!(f.ctx, STEP, { mode: 'INPUT', level: 0 }, t + 10)
    f.restart()
    f.edge(DIR, 1, 50)
    f.pulses(320, 312.5)
    f.run(0.2)
    expect(f.pub.steps).toBe(640)
    expect(f.pub.skipped).toBe(0)
    near(f.pub.shaft_deg, 72, 0.02)
  })

  it('a coil that was never energised can be open without damage', () => {
    const f = fake()
    f.edge(EN, 1)
    f.run(0.1)
    unplugA(f)
    f.run(0.05)
    expect(f.burns).toEqual([])
  })

  it('draws supply current from the power balance: Σ I²·(Rcoil + Rds) / VMOT + 3 mA', () => {
    const f = fake()
    f.run(0.5)
    near(f.set['i_vmot.value'] as number, (2 * 0.707 ** 2 * 2.2) / 12 + 0.003, 0.03)
  })

  it('reset forgets the burn and the heat', () => {
    const f = fake()
    f.run(0.1)
    unplugA(f)
    f.run(0.05)
    behavior.reset!(f.ctx)
    expect(f.set['ia.value']).toBe(0)
    expect(f.set['ib.value']).toBe(0)
  })
})
