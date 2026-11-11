// T7 debugging-instruments: the "tilt lamp" gadget on a real bench. Each hidden fault must leave its
// signature on the instrument that is meant to find it, and each instrument pitfall must show.
import { describe, expect, it } from 'vitest'
import type { LogicCapture } from '../../engine/behaviors/logic-analyzer'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { getLesson } from '../index'

const FRAME = 1 / 60
const L = getLesson('debugging-instruments') as Lesson

// readout indices
const DMM = 0
const AMMETER = 1
const GATE_HZ = 2
const PIN9_HZ = 3
const RISE = 4
const NACKS = 5
const SENSOR_VCC = 6
const LAMP_TRUE = 7

// DMM leads (behavior:leads.mode)
const LEADS = { rail: 0, sensor: 1, sda: 2, vsense: 3, off: 4 }

function build(): Bench {
  const b = createBench(L)
  b.dispatch('strip')
  b.dispatch('pick-place')
  b.dispatch('place-all')
  b.dispatch('solder')
  b.dispatch('power')
  b.upload()
  return b
}

async function run(b: Bench, seconds: number, each?: (s: BenchSnapshot) => void): Promise<BenchSnapshot> {
  const end = b.t + seconds
  while (b.t < end - 1e-9) {
    await b.frame(FRAME)
    if (each) each(b.snapshot())
  }
  return b.snapshot()
}

const pub = (s: BenchSnapshot, k: string) => s.published[k]
const cap = (b: Bench) => b.behaviorData('logic-analyzer') as LogicCapture

describe('T7 debugging-instruments lesson', () => {
  it('validates: four hidden faults, a scope and a logic-analyzer tab, a 6–9 step guide', () => {
    expect(validateLesson(L)).toEqual([])
    expect(L.failures.map((f) => f.id)).toEqual(['cold-joint', 'no-pullup', 'small-reg', 'swapped-wires'])
    expect(L.instruments!.scope!.channels.length).toBe(2)
    expect(L.instruments!.logic!.channels.map((c) => c.label)).toEqual(['SDA', 'SCL', 'BEAT (D10)', 'SENSOR VCC'])
    expect(L.guide!.length).toBeGreaterThanOrEqual(6)
    expect(L.guide!.length).toBeLessThanOrEqual(9)
  })

  it('healthy gadget: 5.0 V rail on the meter, 490 Hz on the gate, 446 ns SCL rise with the ×10 probe, no NACKs', async () => {
    const b = build()
    const s = await run(b, 2.0)
    expect(s.status).toBe('RUNNING')
    expect(s.serial.at(-1)).toMatch(/^ax:-?\d+,lamp:\d+$/)
    expect(s.values[DMM]).toBeGreaterThan(4.9)
    expect(s.values[DMM]).toBeLessThan(5.1)
    expect(s.values[GATE_HZ]).toBeGreaterThan(490 * 0.85)
    expect(s.values[GATE_HZ]).toBeLessThan(490 * 1.15)
    expect(s.values[PIN9_HZ]).toBeGreaterThan(490 * 0.85)
    // 0.8473 × 4.7 kΩ × (100 + 12) pF = 446 ns on SCL, the slower line
    expect(s.values[RISE] * 1e9).toBeCloseTo(446, 0)
    expect(s.values[NACKS]).toBe(0)
    expect(s.values[SENSOR_VCC]).toBeCloseTo(3.3, 1)
    // lamp at the default tilt (−25°): duty 142/255 = 56 % of ≈ 0.33 A
    expect(s.values[LAMP_TRUE]).toBeGreaterThan(0.15)
    expect(s.values[LAMP_TRUE]).toBeLessThan(0.21)
    expect(pub(s, 'mcu.warn')).toBe(0)
    b.dispose()
  })

  it('meter loading: 10 MΩ on the 1 MΩ / 1 MΩ VIN SENSE divider reads 4.8 % low', async () => {
    const b = build()
    b.setTweak('behavior:leads.mode', LEADS.off)
    const off = await run(b, 1.0)
    const unloaded = off.elementV.r_s2
    expect(unloaded).toBeGreaterThan(4.3)
    expect(unloaded).toBeLessThan(4.5)
    b.setTweak('behavior:leads.mode', LEADS.vsense)
    const on = await run(b, 1.5)
    // bottom leg 1 M ‖ 10 M = 909 k: ratio (0.909 / 1.909) / 0.5 = 0.952
    expect(on.values[DMM] / unloaded).toBeCloseTo(0.952, 2)
    expect(on.elementV.r_s2).toBeCloseTo(on.values[DMM], 2) // the node itself sags: the meter reads the truth it created
    b.dispose()
  })

  it('burden voltage: the 1.8 Ω mA shunt in the lamp loop cuts the very current it measures', async () => {
    const b = build()
    const j = await run(b, 1.5)
    const trueI = j.values[LAMP_TRUE]
    expect(j.values[AMMETER]).toBeLessThan(0.005) // the jumper is fitted: no current through the meter
    b.setTweak('behavior:lamp-path.mode', 1)
    const m = await run(b, 1.5)
    expect(m.values[AMMETER]).toBeCloseTo(m.values[LAMP_TRUE], 2)
    // on-current (5 − 3.15) / (5.6 + 1.8) instead of / 5.6: about 23 % lower
    const ratio = m.values[AMMETER] / trueI
    expect(ratio).toBeGreaterThan(0.7)
    expect(ratio).toBeLessThan(0.85)
    b.dispose()
  })

  it('probe ×1 on SCL: 1 MΩ ‖ 100 pF doubles the rise (398 → 797 ns); lifting the probe gives the bare 398 ns', async () => {
    const b = build()
    await run(b, 0.6)
    b.setTweak('behavior:probe.mode', 2)
    const x1 = await run(b, 0.6)
    expect(x1.values[RISE] * 1e9).toBeCloseTo(796, 0)
    expect(x1.values[NACKS]).toBe(0) // slower, still inside the 1000 ns standard-mode limit
    b.setTweak('behavior:probe.mode', 0)
    const off = await run(b, 0.6)
    expect(off.values[RISE] * 1e9).toBeCloseTo(398, 0)
    b.dispose()
  })

  it('fault: undersized regulator (78L05). The meter reads a low average, the scope shows the rail dropping to 3.7 V on every lamp pulse', async () => {
    const b = build()
    await run(b, 1.0)
    b.dispatch('break:small-reg')
    const s = await run(b, 2.0)
    expect(s.values[DMM]).toBeGreaterThan(3.9)
    expect(s.values[DMM]).toBeLessThan(4.6)
    // scope CH2 is the 5 V rail: a 490 Hz square wave between 5.0 V (lamp off) and about 3.7 V (lamp on)
    const r = b.scope
    let lo = Infinity
    let hi = -Infinity
    for (let k = 0; k < r.count; k++) {
      if (r.time(k) < b.t - 0.1) continue
      lo = Math.min(lo, r.value(1, k))
      hi = Math.max(hi, r.value(1, k))
    }
    expect(hi).toBeGreaterThan(4.95)
    expect(lo).toBeGreaterThan(3.4)
    expect(lo).toBeLessThan(3.9)
    expect(s.partVisible.reg).toBe(false)
    expect(s.partVisible.reg_small).toBe(true)
    // tilted fully, the lamp is on all the time: the rail sits at 3.7 V, under the 3.78 V a 16 MHz ATmega328P needs
    b.setTweak('behavior:imu-mpu6050.pitchDeg', 80)
    const f = await run(b, 1.5)
    expect(f.values[DMM]).toBeLessThan(3.8)
    expect(pub(f, 'mcu.warn')).toBe(1)
    b.dispatch('repair')
    const rp = await run(b, 1.5)
    expect(rp.values[DMM]).toBeGreaterThan(4.9)
    expect(pub(rp, 'mcu.warn')).toBe(0)
    b.dispose()
  })

  it('fault: swapped wires. 490 Hz still leaves pin 9 but the gate sees the 1 Hz heartbeat: halve the path to find it', async () => {
    const b = build()
    await run(b, 1.0)
    b.dispatch('break:swapped-wires')
    const s = await run(b, 4.0)
    expect(s.values[PIN9_HZ]).toBeGreaterThan(490 * 0.85)
    expect(s.values[PIN9_HZ]).toBeLessThan(490 * 1.15)
    expect(s.values[GATE_HZ]).toBeGreaterThan(0.7)
    expect(s.values[GATE_HZ]).toBeLessThan(1.3)
    expect(s.partVisible.w_lamp).toBe(false)
    expect(s.partVisible.w_lamp_x).toBe(true)
    b.dispose()
  })

  it('fault: missing SDA pull-up. SDA is stuck low on the meter and the analyzer, every read NACKs', async () => {
    const b = build()
    await run(b, 1.0)
    b.dispatch('break:no-pullup')
    b.setTweak('behavior:leads.mode', LEADS.sda)
    const s = await run(b, 1.5)
    expect(s.values[DMM]).toBeLessThan(0.3)
    expect(s.values[NACKS]).toBeGreaterThan(5)
    expect(s.serial.at(-1)).toBe('sensor lost')
    const c = cap(b)
    const now = c.now()
    expect(c.decode('i2c', now - 300000, now).filter((f) => f.kind === 'start')).toEqual([])
    expect(s.partVisible.r_sda).toBe(false)
    b.dispose()
  })

  it('fault: cold joint on the sensor VCC pin. Intermittent NACK bursts; a 1.5 V analyzer threshold hides the ≈ 2 V dropouts, 2.5 V shows them', async () => {
    const b = build()
    await run(b, 1.0)
    b.dispatch('break:cold-joint')
    let vMin = Infinity
    const s = await run(b, 6.0, (x) => {
      vMin = Math.min(vMin, x.values[SENSOR_VCC])
    })
    const acks0 = pub(s, 'logic-analyzer.i2c_acks')
    expect(s.values[NACKS]).toBeGreaterThan(2) // it fails sometimes...
    expect(acks0).toBeGreaterThan(50) // ...and works most of the time
    expect(pub(s, 'joint.breaks')).toBeGreaterThan(2)
    expect(vMin).toBeGreaterThan(1.7) // below the MPU-6050's 2.375 V minimum, above a 1.5 V threshold
    expect(vMin).toBeLessThan(2.2)
    const lane = () => cap(b).channel({ node: '3v3', label: 'SENSOR VCC' }).trace
    const edges15 = lane().count
    await run(b, 4.0)
    expect(lane().count).toBe(edges15) // at 1.5 V the lane never leaves HIGH
    expect(lane().last).toBe(1)
    b.setTweak('behavior:logic-analyzer.vth', 2.5)
    const before = lane().count
    await run(b, 6.0)
    expect(lane().count - before).toBeGreaterThan(3) // at 2.5 V every dropout is a LOW pulse
    b.dispatch('repair')
    const r = await run(b, 2.0)
    expect(r.values[NACKS]).toBe(0)
    expect(r.values[SENSOR_VCC]).toBeCloseTo(3.3, 1)
    b.dispose()
  })
})
