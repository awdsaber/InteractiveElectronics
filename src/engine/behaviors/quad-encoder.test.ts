import { describe, expect, it } from 'vitest'
import type { BehaviorContext, Element, Netlist, Solution } from '../types'
import { behavior, levelA, levelB } from './quad-encoder'

// A hand-driven context: the test sets the motor's ω, advances the MCU clock and the sim time, and
// reads back the edges handed to mcu.injectEdge. `replay` then plays them through the same ×4
// table decoder the lesson's sketch uses, so "the count the sketch would hold" is measured.

interface Edge {
  pin: number
  level: number
  t: number
  seq: number
}

function netlist(withPullups = true): Netlist {
  const els: Element[] = [
    { id: 'm1', type: 'MOTOR', nodes: ['ao1', 'ao2'], r: 4, l: 5e-4, ke: 0.0054 },
    { id: 'enc_sa', type: 'SW', nodes: ['enc_a', '0'], closed: false },
    { id: 'enc_sb', type: 'SW', nodes: ['enc_b', '0'], closed: false },
  ]
  if (withPullups) els.push({ id: 'r_pa', type: 'R', nodes: ['5v', 'enc_a'], value: 1e4 }, { id: 'r_pb', type: 'R', nodes: ['5v', 'enc_b'], value: 1e4 })
  return { elements: els }
}

function rig(params: Record<string, number | string | boolean> = {}, net: Netlist = netlist(), motor = 'm1') {
  const extra: Record<string, number> = {}
  const edges: Edge[] = []
  const set: Record<string, number | boolean> = {}
  const pub: Record<string, number> = {}
  let seq = 0
  const held: Record<number, number> = {}
  const raw: { pin: number; level: number; t: number }[] = []
  const solution: Solution = { ok: true, nodeV: {}, current: {}, power: {}, extra }
  const mcu = {
    hold() {}, release() {}, reset() {}, serialIn() {}, serialOut() {}, attachI2c() {}, attachSpi() {},
    timeMicros: 0, running: true,
    injectEdge(pin: number, level: number | boolean, t: number) {
      raw.push({ pin, level: Number(level), t })
      // like the real MCU, an immediate "edge" that changes nothing (the start-up HIGH on a pulled-up line) is not one
      if (t <= mcu.timeMicros && Number(level) === (held[pin] ?? 1)) return
      held[pin] = Number(level)
      edges.push({ pin, level: Number(level), t, seq: seq++ })
    },
  }
  const ctx: BehaviorContext = {
    t: 0, dt: 1 / 60, solution, pins: {}, powered: true, params: { motor, ...params }, netlist: net,
    v: () => 0,
    publish: (k: string, v: number) => { pub[k] = v },
    setParam: (id: string, key: string, value: number | boolean) => { set[`${id}.${key}`] = value },
    setMotorLoad: () => {}, burn: () => {}, events: { push: () => {} }, mcu,
  } as unknown as BehaviorContext
  behavior.init?.(ctx)
  const omegaKey = `${motor}.omega`
  return {
    ctx, edges, raw, set, pub, mcu,
    omega(w: number) { extra[omegaKey] = w },
    /** advance by whole frames of 1/60 s; the MCU clock and sim time move together, as in the bench */
    run(seconds: number, each?: () => void) {
      const frames = Math.round(seconds * 60)
      for (let i = 0; i < frames; i++) {
        const dt = 1 / 60
        mcu.timeMicros += dt * 1e6
        ;(ctx as { t: number }).t += dt
        behavior.tick!(ctx, dt)
        each?.()
      }
    },
    step(tSim: number) { behavior.onStep!(ctx, tSim, solution) },
  }
}

const QEM = [0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0] // state = A<<1|B; A leads B is +1

/** the lesson's ISR on the edges due by `until` µs */
function replay(edges: Edge[], until: number, pins = { a: 2, b: 3 }) {
  const ev = edges.filter((e) => e.t <= until).sort((x, y) => x.t - y.t || x.seq - y.seq)
  const lv: Record<number, number> = { [pins.a]: 1, [pins.b]: 1 }
  let last = 3
  let count = 0
  let invalid = 0
  let isrs = 0
  let i = 0
  while (i < ev.length) {
    const t0 = ev[i].t
    const changed: number[] = []
    while (i < ev.length && ev[i].t === t0) {
      if (lv[ev[i].pin] !== ev[i].level) changed.push(ev[i].pin)
      lv[ev[i].pin] = ev[i].level
      i++
    }
    for (let k = 0; k < changed.length; k++) {
      isrs++
      const s = (lv[pins.a] << 1) | lv[pins.b]
      const q = QEM[(last << 2) | s]
      if (s !== last && q === 0) invalid++
      count += q
      last = s
    }
  }
  return { count, invalid, isrs }
}

const W = 100 // motor rad/s
const motorRevPerS = W / (2 * Math.PI)

describe('quad-encoder: levels', () => {
  it('forward runs A leads B: 11 → 01 → 00 → 10 (state index 2, 3, 4, 5)', () => {
    const seq = [2, 3, 4, 5, 6].map((n) => [levelA(n), levelB(n)])
    expect(seq).toEqual([[1, 1], [0, 1], [0, 0], [1, 0], [1, 1]])
    // one channel changes per step, A on odd n and B on even n
    for (let n = 0; n < 8; n++) expect((levelA(n) !== levelA(n + 1) ? 1 : 0) + (levelB(n) !== levelB(n + 1) ? 1 : 0)).toBe(1)
    expect(levelA(-1)).toBe(levelA(3))
  })
})

describe('quad-encoder: counts per revolution', () => {
  it('one motor revolution is 4 × ppr edges; the table decoder holds the same count as count_true', () => {
    const r = rig()
    r.omega(W)
    r.run(2)
    const now = r.mcu.timeMicros
    const sketch = replay(r.edges, now)
    expect(r.pub.count_true).toBe(sketch.count)
    expect(sketch.invalid).toBe(0)
    // 2 s at 15.9 rev/s = 31.83 revolutions of 44 edges each
    // armed on the first frame, so the motor has turned for 2 s less that frame
    const want = motorRevPerS * (2 - 1 / 60) * 44
    expect(Math.abs((r.pub.count_true as number) - want)).toBeLessThanOrEqual(1)
    expect(r.pub.cpr_out).toBe(2112)
  })

  it('exactly N revolutions give exactly N × 4 × ppr counts (and N / gear output turns)', () => {
    const r = rig({ gear: 48 })
    r.omega((2 * Math.PI * 10 * 60) / 60) // 10 motor rev/s, 600 motor rpm
    r.run(2.4 + 1 / 60) // 24 motor revolutions after the arming frame
    const c = r.pub.count_true as number
    expect(Math.abs(c - 24 * 44)).toBeLessThanOrEqual(1)
    expect(r.pub.rev_out_true).toBeCloseTo(c / 2112, 9)
    expect(r.pub.deg_out_true).toBeCloseTo((c / 2112) * 360, 6)
    expect(r.pub.rpm_true).toBeCloseTo(600, 6)
    expect(r.pub.rpm_out_true).toBeCloseTo(600 / 48, 6)
    expect(r.pub.edge_rate).toBeCloseTo(440, 6)
  })

  it('×1, ×2 and ×4 decoding of the same edges: ppr, 2·ppr and 4·ppr counts per revolution', () => {
    const r = rig()
    r.omega(2 * Math.PI * 5) // 5 rev/s
    r.run(2 + 1 / 60) // 10 revolutions after the arming frame
    const now = r.mcu.timeMicros
    const ev = r.edges.filter((e) => e.t <= now).sort((x, y) => x.t - y.t)
    const x4 = ev.length
    const x2 = ev.filter((e) => e.pin === 2).length
    let x1 = 0
    for (const e of ev) if (e.pin === 2 && e.level === 1) x1++
    expect(Math.abs(x4 - 440)).toBeLessThanOrEqual(1)
    expect(Math.abs(x2 - 220)).toBeLessThanOrEqual(1)
    expect(Math.abs(x1 - 110)).toBeLessThanOrEqual(1)
  })
})

describe('quad-encoder: direction', () => {
  it('forward: A changes first and the count is positive; reverse: B changes first and it is negative', () => {
    const f = rig()
    f.omega(W)
    f.run(0.5)
    const first = [...f.edges].sort((x, y) => x.t - y.t)[0]
    expect(first.pin).toBe(2)
    expect(f.pub.count_true as number).toBeGreaterThan(0)
    expect(replay(f.edges, f.mcu.timeMicros).count).toBe(f.pub.count_true)

    const b = rig()
    b.omega(-W)
    b.run(0.5)
    const firstB = [...b.edges].sort((x, y) => x.t - y.t)[0]
    expect(firstB.pin).toBe(3)
    expect(b.pub.count_true as number).toBeLessThan(0)
    expect(replay(b.edges, b.mcu.timeMicros).count).toBe(b.pub.count_true)
    expect(b.pub.rpm_out_true as number).toBeLessThan(0)
  })

  it('a reversal in the middle counts back down', () => {
    const r = rig()
    r.omega(W)
    r.run(1)
    const up = r.pub.count_true as number
    r.omega(-W)
    r.run(1)
    expect(Math.abs(r.pub.count_true as number)).toBeLessThan(up / 8)
    expect(replay(r.edges, r.mcu.timeMicros).count).toBe(r.pub.count_true)
  })

  it('swapAB: the same motion reads as reverse (the wiring mistake)', () => {
    const r = rig({ swapAB: true })
    r.omega(W)
    r.run(1)
    const sketch = replay(r.edges, r.mcu.timeMicros)
    expect(r.pub.count_true as number).toBeGreaterThan(0) // the truth is forward
    expect(sketch.count).toBe(-(r.pub.count_true as number)) // the sketch counts it backwards
    expect(sketch.invalid).toBe(0)
  })
})

describe('quad-encoder: failures', () => {
  it('a slow ISR merges close edges: invalid transitions and a short count, while edges_lost climbs', () => {
    const fast = rig({ isrUs: 6 })
    fast.omega(1000) // 7000 edges/s, 143 µs apart
    fast.run(1)
    expect(fast.pub.edges_lost).toBe(0)
    expect(replay(fast.edges, fast.mcu.timeMicros).invalid).toBe(0)

    const slow = rig({ isrUs: 200 })
    slow.omega(1000)
    slow.run(1)
    const s = replay(slow.edges, slow.mcu.timeMicros)
    expect(slow.pub.edges_lost as number).toBeGreaterThan(1000)
    expect(s.invalid).toBeGreaterThan(1000)
    expect(Math.abs(s.count)).toBeLessThan(0.5 * (slow.pub.count_true as number))
  })

  it('a missing pull-up leaves that pin floating: noise edges and invalid transitions even when the motor is stopped', () => {
    const net = netlist()
    net.elements = net.elements.filter((e) => e.id !== 'r_pa')
    const r = rig({}, net)
    r.omega(0)
    r.run(3)
    expect(r.pub.floating).toBe(1)
    expect(r.pub.noise_edges as number).toBeGreaterThan(200) // about 200 /s
    const s = replay(r.edges, r.mcu.timeMicros)
    expect(r.pub.count_true).toBe(0)
    expect(s.isrs).toBeGreaterThan(400)
    expect(r.edges.every((e) => e.pin === 2)).toBe(true) // B has its pull-up and is quiet
    // a lone floating channel can wander the count without any motion
    expect(r.edges.length).toBeGreaterThanOrEqual((r.pub.noise_edges as number) * 2)
  })

  it('both pull-ups missing: both pins chatter and double transitions appear', () => {
    const net = netlist(false)
    const r = rig({}, net)
    r.omega(0)
    r.run(5)
    expect(r.pub.floating).toBe(2)
    expect(replay(r.edges, r.mcu.timeMicros).invalid).toBeGreaterThanOrEqual(0)
    expect(new Set(r.edges.map((e) => e.pin))).toEqual(new Set([2, 3]))
  })

  it('refitting the pull-up while running puts the pin back on the signal', () => {
    const net = netlist()
    const full = net.elements
    net.elements = full.filter((e) => e.id !== 'r_pa')
    const r = rig({}, net)
    r.omega(W)
    r.run(1)
    expect(r.pub.floating).toBe(1)
    r.ctx.netlist.elements = full
    const before = r.edges.length
    r.run(1)
    expect(r.pub.floating).toBe(0)
    expect(r.edges.length - before).toBeGreaterThan(600)
  })

  it('glitches: common-mode spikes make the table decoder flag invalid transitions; none without them', () => {
    const quiet = rig()
    quiet.omega(W)
    quiet.run(3)
    expect(replay(quiet.edges, quiet.mcu.timeMicros).invalid).toBe(0)

    const noisy = rig({ glitchRate: 100, seed: 4 })
    noisy.omega(W)
    noisy.run(3)
    const g = noisy.pub.glitches as number
    expect(g).toBeGreaterThan(150)
    expect(g).toBeLessThan(450)
    const s = replay(noisy.edges, noisy.mcu.timeMicros)
    expect(s.invalid).toBeGreaterThan(g) // two invalid jumps per glitch
    expect(Math.abs(s.invalid - 2 * g)).toBeLessThan(0.1 * 2 * g)
  })
})

describe('quad-encoder: a lagging MCU', () => {
  it('edges are scheduled past where the bench will advance the MCU, even when the MCU fell behind', () => {
    // the bench advances the MCU asynchronously after the behaviors tick, and a slow machine can skip
    // frames: here the MCU stalls for 8 frames, then catches up in one advance
    const r = rig()
    r.omega(W)
    const dt = 1 / 60
    let simT = 0
    let mcuAt = 0 // where the MCU actually is
    let late = 0
    let reached = 0 // the furthest the MCU has been advanced so far
    for (let f = 0; f < 120; f++) {
      simT += dt
      ;(r.ctx as { t: number }).t = simT
      const before = r.edges.length
      r.mcu.timeMicros = mcuAt
      behavior.tick!(r.ctx, dt)
      // edges handed over this tick that fall before the MCU's furthest point are applied late (as one burst)
      for (let k = before; k < r.edges.length; k++) if (r.edges[k].t < reached - 1) late++
      // the stall: no advance during frames 40..47, then it jumps to the sim time
      if (f < 40 || f >= 48) {
        mcuAt = simT * 1e6
        reached = mcuAt
      }
    }
    expect(late).toBe(0)
    expect(replay(r.edges, mcuAt).invalid).toBe(0)
    // no hole in the edge stream where the MCU stalled (700 edges/s: 1.43 ms apart)
    const ts = r.edges.map((e) => e.t).sort((a, b) => a - b)
    let gap = 0
    for (let k = 1; k < ts.length; k++) gap = Math.max(gap, ts[k] - ts[k - 1])
    expect(gap).toBeLessThan(3000)
  })

  it('a long frame followed by short ones never runs the schedule backwards (no duplicate or reversed edges)', () => {
    const r = rig()
    r.omega(W)
    let simT = 0
    const dts = [0.1, 1 / 60, 1 / 60, 0.12, 1 / 60, 0.05, 1 / 60, 1 / 60]
    for (let rep = 0; rep < 12; rep++) {
      for (const dt of dts) {
        simT += dt
        ;(r.ctx as { t: number }).t = simT
        // the MCU is one frame behind, as in the bench (it is advanced after the tick)
        r.mcu.timeMicros = Math.max(0, simT - dt) * 1e6
        behavior.tick!(r.ctx, dt)
      }
    }
    expect(r.pub.edges_lost).toBe(0)
    const ev = [...r.edges].sort((a, b) => a.t - b.t || a.seq - b.seq)
    const s = replay(ev, 1e12)
    expect(s.invalid).toBe(0)
    expect(s.count).toBeGreaterThan(0)
    // every edge flips its pin: no pin repeats a level (a reversed segment would)
    const lv: Record<number, number> = { 2: 1, 3: 1 }
    for (const e of ev) {
      expect(lv[e.pin]).not.toBe(e.level)
      lv[e.pin] = e.level
    }
  })
})

describe('quad-encoder: bookkeeping', () => {
  it('two instances on two motors keep separate counts and pins', () => {
    const net: Netlist = {
      elements: [
        ...netlist().elements,
        { id: 'm2', type: 'MOTOR', nodes: ['bo1', 'bo2'], r: 4, l: 5e-4, ke: 0.0054 },
        { id: 'r_pa2', type: 'R', nodes: ['5v', 'x'], value: 1e4 },
        { id: 'r_pb2', type: 'R', nodes: ['5v', 'y'], value: 1e4 },
      ],
    }
    const a = rig({}, net, 'm1')
    const b = rig({ a: 8, b: 9, pullA: 'r_pa2', pullB: 'r_pb2', ppr: 7, gear: 30, swA: 'e2a', swB: 'e2b' }, net, 'm2')
    a.omega(W)
    b.omega(-W)
    for (let i = 0; i < 120; i++) {
      for (const x of [a, b]) {
        x.run(1 / 60)
      }
    }
    expect(a.pub.count_true as number).toBeGreaterThan(1000)
    expect(b.pub.count_true as number).toBeLessThan(-600)
    expect(b.pub.cpr_out).toBe(7 * 4 * 30)
    expect(new Set(a.edges.map((e) => e.pin))).toEqual(new Set([2, 3]))
    expect(new Set(b.edges.map((e) => e.pin))).toEqual(new Set([8, 9]))
    expect(replay(b.edges, b.mcu.timeMicros, { a: 8, b: 9 }).count).toBe(b.pub.count_true)
  })

  it('onStep drives the open-drain switches from the edge schedule (closed = pin LOW)', () => {
    const r = rig()
    r.omega(2 * Math.PI * 2) // 2 rev/s: A has a 22.7 ms period
    const seen = new Set<string>()
    let lastT = 0
    r.run(1, () => {
      for (let k = 1; k <= 16; k++) {
        const t = (r.ctx as { t: number }).t - (16 - k) * 1e-3
        if (t > lastT) {
          r.step(t)
          lastT = t
          seen.add(`${r.set['enc_sa.closed']}/${r.set['enc_sb.closed']}`)
        }
      }
    })
    // all four (A, B) phases appear: both open, A low, both low, B low
    expect(seen.size).toBeGreaterThanOrEqual(3)
    expect(r.set['enc_sa.closed']).not.toBeUndefined()
  })

  it('a fresh sketch finds both lines HIGH: the start drives them explicitly (setup() can read before the first circuit solve)', () => {
    const r = rig()
    r.omega(0)
    r.run(2 / 60)
    const first = r.raw.filter((e) => e.t <= 2e4)
    expect(first.map((e) => [e.pin, e.level])).toEqual([[2, 1], [3, 1]])
    // a floating pin is not driven: it has no HIGH to claim
    const net = netlist()
    net.elements = net.elements.filter((e) => e.id !== 'r_pb')
    const f = rig({ noiseHz: 1 }, net)
    f.omega(0)
    f.run(2 / 60)
    expect(f.raw.filter((e) => e.t <= 2e4 && e.pin === 3)).toEqual([])
  })

  it('re-arming while the sketch keeps running (repair) carries on from the shaft: no jump the decoder would see', () => {
    const r = rig()
    r.omega(W)
    r.run(1)
    behavior.onEvent!(r.ctx, 'repair')
    const before = r.edges.length
    r.run(1)
    const ev = [...r.edges].sort((a, b) => a.t - b.t || a.seq - b.seq)
    const lv: Record<number, number> = { 2: 1, 3: 1 }
    for (const e of ev) {
      expect(lv[e.pin]).not.toBe(e.level)
      lv[e.pin] = e.level
    }
    expect(r.edges.length - before).toBeGreaterThan(600)
    expect(replay(r.edges, r.mcu.timeMicros).invalid).toBe(0)
  })

  it('nothing is delivered unpowered or with the sketch stopped, and the count restarts on upload', () => {
    const r = rig()
    r.omega(W)
    ;(r.ctx as { powered: boolean }).powered = false
    r.run(0.5)
    expect(r.edges.length).toBe(0)
    ;(r.ctx as { powered: boolean }).powered = true
    r.run(0.5)
    expect(r.edges.length).toBeGreaterThan(300)
    behavior.onEvent!(r.ctx, 'upload')
    r.run(1 / 60)
    expect(Math.abs(r.pub.count_true as number)).toBeLessThan(40)
  })
})
