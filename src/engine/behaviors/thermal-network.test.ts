import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Behavior, BehaviorContext, Lesson, Netlist, Solution } from '../types'
import { behavior } from './thermal-network'

const FRAME = 0.1
// one frame covers 1 sim second: the network integrates at its own rate, the DC solve is instant
const SPEED = 10

function make(params: Record<string, number | string> = {}, over: { vin?: number; load?: number } = {}): Lesson {
  return {
    id: 'thermal-test',
    fig: 1,
    track: 'T7',
    title: 'T',
    subtitle: '',
    tagline: '',
    board: { name: 'T', size: [4, 4], parts: [{ id: 'u', kind: 'regulator-to220', pos: [0, 0], mount: 'tht', role: 'u', circuitIds: ['reg'] }] },
    circuit: {
      elements: [
        { id: 'V1', type: 'V', nodes: ['vin', '0'], value: over.vin ?? 12 },
        { id: 'reg', type: 'REG', nodes: ['vin', '0', 'vout'], vout: 5, dropout: 2, iLimit: 1.5, iq: 0.005 },
        { id: 'rl', type: 'R', nodes: ['vout', '0'], value: over.load ?? 7.5 },
      ],
    },
    powerElementId: 'V1',
    readouts: [{ label: 'VOUT', source: { kind: 'voltage', node: 'vout' }, unit: 'V' }],
    tweaks: [
      {
        label: 'Heatsink',
        elementId: 'behavior:th',
        key: 'sink',
        kind: 'enum',
        min: 0,
        max: 2,
        unit: '',
        options: [
          { label: 'none', value: 0 },
          { label: 'small', value: 1 },
          { label: 'large', value: 2 },
        ],
      },
      { label: 'Airflow', elementId: 'behavior:th', key: 'fan', kind: 'toggle', min: 0, max: 1, unit: '' },
    ],
    failures: [],
    meet: '',
    mechanicalAnalogy: '',
    proTips: [],
    quiz: [],
    behaviors: [{ id: 'thermal-network', instance: 'th', params: { element: 'reg', ...params } }],
  }
}

const bench = (l: Lesson, speed = SPEED) => createBench(l, { registry: { 'thermal-network': behavior }, speed })
type B = ReturnType<typeof bench>

/** sim seconds `sim` at `speed` (a frame is 0.1 s of real time) */
async function run(b: B, sim: number, speed = SPEED) {
  for (let i = 0; i < Math.round(sim / (FRAME * speed)); i++) await b.frame(FRAME)
}
const pub = (b: B, k: string) => b.snapshot().published[`th.${k}`]

describe('thermal-network: dissipation', () => {
  it('12 V in, 5 V at 0.667 A: P = 7 V x 0.667 A + 12 V x 5 mA = 4.73 W (within 0.1 W)', async () => {
    const b = bench(make({ sink: 1, pad: 1 }))
    b.dispatch('power')
    await run(b, 2)
    expect(Math.abs(pub(b, 'p_W') - 4.73)).toBeLessThan(0.1)
    b.dispose()
  })
})

describe('thermal-network: steady state Tj = Ta + P (th_jc + th_cs + th_sa), within 3 K', () => {
  const cases: { name: string; params: Record<string, number>; rth: number }[] = [
    { name: 'small sink 12 C/W, silicone pad 1.0', params: { sink: 1, pad: 1 }, rth: 5 + 1 + 12 },
    { name: 'large sink 5 C/W, silicone pad 1.0', params: { sink: 2, pad: 1 }, rth: 5 + 1 + 5 },
    { name: 'large sink, grease 0.5', params: { sink: 2, pad: 2 }, rth: 5 + 0.5 + 5 },
    { name: 'large sink, dry tab 3.0', params: { sink: 2, pad: 0 }, rth: 5 + 3 + 5 },
    { name: 'large sink, silicone pad, fan (x0.45 on the sink)', params: { sink: 2, pad: 1, fan: 1 }, rth: 5 + 1 + 5 * 0.45 },
    { name: 'small sink, silicone pad, fan', params: { sink: 1, pad: 1, fan: 1 }, rth: 5 + 1 + 12 * 0.45 },
  ]
  for (const c of cases) {
    it(c.name, async () => {
      const b = bench(make(c.params), 20)
      b.dispatch('power')
      await run(b, 900, 20)
      const p = pub(b, 'p_W')
      const want = 25 + p * c.rth
      expect(Math.abs(pub(b, 'tj') - want)).toBeLessThan(3)
      expect(Math.abs(pub(b, 'tj_ss') - want)).toBeLessThan(0.5)
      expect(pub(b, 'tsd')).toBe(0)
      // the chain: Tj > Tc > Ths > Ta, each step is P x its resistance
      expect(pub(b, 'tj')).toBeGreaterThan(pub(b, 'tc'))
      expect(pub(b, 'tc')).toBeGreaterThan(pub(b, 'ths'))
      expect(Math.abs(pub(b, 'tj') - pub(b, 'tc') - p * 5)).toBeLessThan(0.5)
      b.dispose()
    })
  }

  it('bare TO-220 (no heatsink): theta_ja 65 C/W; 0.54 W settles at 25 + 0.54 x 65 = 60 C', async () => {
    const b = bench(make({ sink: 0 }, { vin: 7.5, load: 25 }), 20)
    b.dispatch('power')
    await run(b, 500, 20)
    const p = pub(b, 'p_W')
    expect(Math.abs(pub(b, 'tj') - (25 + p * 65))).toBeLessThan(3)
    expect(pub(b, 'rth_total')).toBeCloseTo(65, 6)
    b.dispose()
  })

  it('ambient moves everything one for one', async () => {
    const b = bench(make({ sink: 2, pad: 1, ambientC: 45 }), 20)
    b.dispatch('power')
    await run(b, 900, 20)
    expect(Math.abs(pub(b, 'tj') - (45 + pub(b, 'p_W') * 11))).toBeLessThan(3)
    b.dispose()
  })

  it('tweaks: the heatsink size and airflow change the target live', async () => {
    const b = bench(make({ sink: 1, pad: 1 }))
    b.dispatch('power')
    await run(b, 20)
    const small = pub(b, 'rth_total')
    b.setTweak('behavior:th.sink', 2)
    b.setTweak('behavior:th.fan', 1)
    await run(b, 20)
    expect(small).toBeCloseTo(18, 6)
    expect(pub(b, 'rth_total')).toBeCloseTo(5 + 1 + 5 * 0.45, 6)
    b.dispose()
  })
})

describe('thermal-network: thermal capacitance and time constants', () => {
  it('the heatsink node rises with tau = C_total x theta_sa (63 % at one tau), within 5 %', async () => {
    const b = bench(make({ sink: 1, pad: 1 }))
    b.dispatch('power')
    const tau = (0.05 + 0.8 + 9) * 12 // J/K x K/W = s
    let t63 = Number.NaN
    for (let i = 0; i < 400 && Number.isNaN(t63); i++) {
      await b.frame(FRAME)
      if (pub(b, 'ths') - 25 >= 0.632 * (pub(b, 'ths_ss') - 25)) t63 = b.snapshot().t
    }
    expect(Math.abs(pub(b, 'ths_ss') - (25 + 4.73 * 12))).toBeLessThan(1)
    expect(Math.abs(pub(b, 'tau_s') / tau - 1)).toBeLessThan(0.02)
    expect(Math.abs(t63 / tau - 1)).toBeLessThan(0.05)
    b.dispose()
  })

  it('a fan cuts theta_sa and the time constant with it: 0.45 x', async () => {
    const b = bench(make({ sink: 1, pad: 1, fan: 1 }))
    b.dispatch('power')
    await run(b, 10)
    expect(pub(b, 'tau_s')).toBeCloseTo((0.05 + 0.8 + 9) * 12 * 0.45, 6)
    b.dispose()
  })

  it('the junction is fast: Tj sits P x theta_jc above the tab within seconds (C_j x theta_jc = 0.25 s)', async () => {
    const b = bench(make({ sink: 2, pad: 1 }))
    b.dispatch('power')
    await run(b, 4)
    const dj = pub(b, 'tj') - pub(b, 'tc')
    expect(Math.abs(dj / (pub(b, 'p_W') * 5) - 1)).toBeLessThan(0.05)
    b.dispose()
  })

  it('a bare tab heats fast: tau about (C_j + C_c) x 60 C/W = 52 s', async () => {
    const b = bench(make({ sink: 0 }, { vin: 7.5, load: 25 }))
    b.dispatch('power')
    await run(b, 10)
    expect(pub(b, 'tau_s')).toBeGreaterThan(45)
    expect(pub(b, 'tau_s')).toBeLessThan(60)
    b.dispose()
  })
})

describe('thermal-network: thermal shutdown', () => {
  it('bare 7805 at 4.7 W trips at 150 C, the output collapses, it cools to 130 C, restarts and cycles', async () => {
    const b = bench(make({ sink: 0 }))
    b.dispatch('power')
    let trips = 0
    let last = 0
    let peak = 0
    let low = 1e9
    let vOutAtTrip = Number.NaN
    for (let i = 0; i < 600; i++) {
      await b.frame(FRAME)
      const tj = pub(b, 'tj')
      peak = Math.max(peak, tj)
      if (trips >= 1) low = Math.min(low, tj)
      const tsd = pub(b, 'tsd')
      if (tsd === 1 && last === 0) {
        trips++
        await b.frame(FRAME)
        vOutAtTrip = b.snapshot().values[0]
      }
      last = tsd
    }
    expect(trips).toBeGreaterThanOrEqual(3)
    expect(vOutAtTrip).toBeLessThan(0.1)
    expect(peak).toBeGreaterThan(148) // the frame ends a little after the trip, already cooling
    expect(peak).toBeLessThan(156) // one frame's overshoot, not a runaway
    expect(low).toBeGreaterThan(125)
    expect(low).toBeLessThan(133)
    expect(pub(b, 'tsd_count')).toBeGreaterThanOrEqual(trips)
    b.dispose()
  })

  it('time to first trip from cold: about tau x ln((Tss - Ta)/(Tss - 150)) = 30 s', async () => {
    const b = bench(make({ sink: 0 }))
    b.dispatch('power')
    let t = Number.NaN
    for (let i = 0; i < 300 && Number.isNaN(t); i++) {
      await b.frame(FRAME)
      if (pub(b, 'tsd') === 1) t = b.snapshot().t
    }
    expect(t).toBeGreaterThan(15)
    expect(t).toBeLessThan(45)
    b.dispose()
  })

  it('a decent heatsink never trips; the junction stays under the 125 C operating limit', async () => {
    const b = bench(make({ sink: 2, pad: 1 }), 20)
    b.dispatch('power')
    await run(b, 900, 20)
    expect(pub(b, 'tsd_count')).toBe(0)
    expect(pub(b, 'tj')).toBeLessThan(125)
    b.dispose()
  })

  it('repair forgets the heat: back to ambient, no latched shutdown', async () => {
    const b = bench(make({ sink: 0 }))
    b.dispatch('power')
    await run(b, 60)
    expect(pub(b, 'tsd_count')).toBeGreaterThan(0)
    b.dispatch('repair')
    await b.frame(FRAME)
    expect(pub(b, 'tsd')).toBe(0)
    expect(pub(b, 'tsd_count')).toBe(0)
    expect(pub(b, 'tj')).toBeLessThan(60) // one second of reheating from 25 C
    b.dispose()
  })
})

describe('thermal-network: burn instead of shutdown (a part with no thermal protection)', () => {
  it('protect 0: Tj reaching tMax fails the element through ctx.burn (overtemp)', async () => {
    const b = bench(make({ sink: 0, protect: 0 }))
    b.dispatch('power')
    await run(b, 120)
    const burns = b.snapshot().assembly.burns
    expect(burns.length).toBe(1)
    expect(burns[0]).toMatchObject({ elementId: 'reg', reason: 'overtemp' })
    expect(burns[0].limit).toBe(150)
    expect(burns[0].value).toBeGreaterThanOrEqual(150)
    b.dispose()
  })
})

describe('thermal-network: allocates nothing per tick', { retry: 2 }, () => { // heap deltas are noisy on a loaded machine
  it('a hot tick loop leaves the heap flat (no arrays or objects per call)', () => {
    // a typed-array sink: the harness itself must not allocate (boxing a double into a dictionary would)
    const store = new Float64Array(32)
    let n = 0
    const NET: Netlist = { elements: [{ id: 'reg', type: 'REG', nodes: ['a', '0', 'b'], vout: 5, dropout: 2, iLimit: 1.5 }] }
    const sol = { ok: true, nodeV: {}, current: {}, power: {}, extra: {}, powerOf: () => 4.7 } as unknown as Solution
    const ctx: BehaviorContext = {
      t: 0,
      solution: sol,
      pins: {},
      powered: true,
      params: { element: 'reg', sink: 1, pad: 1 },
      netlist: NET,
      v: () => 0,
      publish(_k, v) {
        store[n++ & 31] = v
      },
      setParam() {},
      setMotorLoad() {},
      burn() {},
      events: { push() {} },
      mcu: {} as BehaviorContext['mcu'],
    }
    const b: Behavior = behavior
    b.init?.(ctx)
    // the control: 13 publishes of changing doubles and nothing else. Passing a double to a function
    // boxes it (16 bytes) whoever calls: that is the cost of publishing, not of the behavior.
    const pubs = 13
    let x = 0.1
    const control = () => {
      for (let k = 0; k < pubs; k++) {
        x += 0.37
        ctx.publish('k', x)
      }
    }
    const heap = () => (globalThis as { process?: { memoryUsage: () => { heapUsed: number } } }).process?.memoryUsage().heapUsed ?? 0
    const grow = (f: () => void) => {
      for (let i = 0; i < 100000; i++) f() // warm up the JIT
      const before = heap()
      for (let i = 0; i < 20000; i++) f()
      return heap() - before
    }
    const base = grow(control)
    const grew = grow(() => b.tick?.(ctx, 0.5))
    // the tick publishes 13 values; anything it allocated itself (arrays, objects, closures) would show on top
    expect(grew).toBeLessThan(Math.max(base * 1.5, 1_500_000))
  })
})
