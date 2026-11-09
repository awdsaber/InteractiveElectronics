import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { behavior } from './dyno-load'

// A GM-48 straight across a 6 V source with 1.1 Ω in series (5.1 Ω total, as on the PID bench).
const lesson = (params: Record<string, number | string> = {}, volts = 6): Lesson => ({
  id: 'dyno',
  fig: 1,
  track: 'T7',
  title: 'Dyno',
  subtitle: '',
  tagline: '',
  board: { name: 'D', size: [4, 4], parts: [{ id: 'mot', kind: 'gear-motor-wheel', pos: [0, 0], mount: 'offboard', role: 'm', circuitIds: ['m1'] }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['vm', '0'], value: volts, rInternal: 1.1 },
      { id: 'm1', type: 'MOTOR', nodes: ['vm', '0'], r: 4, l: 0.5e-3, ke: 0.0054, kt: 0.0054, j: 3e-7, b: 8e-7, load: 0 },
    ],
  },
  powerElementId: 'V1',
  transient: true,
  readouts: [{ label: 'I', source: { kind: 'current', elementId: 'm1' }, unit: 'A' }],
  tweaks: [{ label: 'Brake', elementId: 'behavior:dyno', key: 'brakeNm', min: 0, max: 0.15, step: 0.005, unit: '' }],
  failures: [],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  behaviors: [{ id: 'dyno-load', instance: 'dyno', params: { motor: 'm1', ...params } }],
})

async function run(b: ReturnType<typeof createBench>, s: number) {
  const t1 = b.t + s
  while (b.t < t1 - 1e-9) await b.frame(1 / 60)
}
const omega = (b: ReturnType<typeof createBench>) => b.snapshot().extra['m1.omega']

describe('dyno-load behavior', () => {
  it('reflects the output-shaft brake through the gearbox: load = coulomb + brake / (gear × efficiency)', async () => {
    const b = createBench(lesson({ brakeNm: 0.05 }), { registry: { 'dyno-load': behavior } })
    b.dispatch('power')
    await run(b, 0.1)
    expect(b.snapshot().published['dyno.motor_load_Nm']).toBeCloseTo(0.0002 + 0.05 / (48 * 0.7), 9)
    expect(b.snapshot().published['dyno.brake_Nm']).toBeCloseTo(0.05, 9)
    b.dispose()
  })

  it('no brake: only the gearbox friction, and the output runs near the GM-48 no-load speed (~188 rpm at 6 V)', async () => {
    const b = createBench(lesson(), { registry: { 'dyno-load': behavior } })
    b.dispatch('power')
    await run(b, 0.6)
    const rpmOut = (omega(b) * 60) / (2 * Math.PI) / 48
    // ω = (kt·V/R − Tc) / (kt·ke/R + b) = (0.006353 − 0.0002) / 6.518e-6 ≈ 944 rad/s → 188 rpm out
    expect(rpmOut).toBeGreaterThan(180)
    expect(rpmOut).toBeLessThan(195)
    expect(b.snapshot().published['dyno.rpm_out']).toBeCloseTo(rpmOut, 0)
    b.dispose()
  })

  it('a brake slows the motor by the torque-speed line, and the dyno reads the output power T·ω', async () => {
    const b = createBench(lesson(), { registry: { 'dyno-load': behavior } })
    b.dispatch('power')
    await run(b, 0.6)
    const free = omega(b)
    b.setTweak('behavior:dyno.brakeNm', 0.08)
    await run(b, 0.6)
    const w = omega(b)
    // predicted: ω = (kt·V/R − Tc − 0.08/33.6) / 6.518e-6 ≈ 579 rad/s at the motor
    const Tm = 0.0002 + 0.08 / 33.6
    const pred = ((0.0054 * 6) / 5.1 - Tm) / ((0.0054 * 0.0054) / 5.1 + 8e-7)
    expect(w).toBeLessThan(free * 0.7)
    expect(Math.abs(w - pred) / pred).toBeLessThan(0.03)
    const p = b.snapshot().published['dyno.out_power_W']
    expect(p).toBeCloseTo(0.08 * (w / 48), 3)
    b.dispose()
  })

  it('the load follows the brake both ways (the MOTOR applies it against ω, so it never drives the shaft)', async () => {
    const b = createBench(lesson({ brakeNm: 0.04 }, -6), { registry: { 'dyno-load': behavior } })
    // reverse polarity: the brake still opposes the motion
    b.dispatch('power')
    await run(b, 0.6)
    const w = omega(b)
    expect(w).toBeLessThan(-300)
    expect(b.snapshot().published['dyno.out_power_W']).toBeGreaterThan(0)
    b.dispose()
  })

  it('stepAtS: the brake engages only once that long after power-on (a scripted step disturbance)', async () => {
    const b = createBench(lesson({ brakeNm: 0.06, stepAtS: 0.5 }), { registry: { 'dyno-load': behavior } })
    b.dispatch('power')
    await run(b, 0.3)
    expect(b.snapshot().published['dyno.brake_Nm']).toBe(0)
    await run(b, 0.4)
    expect(b.snapshot().published['dyno.brake_Nm']).toBeCloseTo(0.06, 9)
    b.dispose()
  })

  it('clamps nonsense: negative brake torque is no brake, efficiency stays in (0, 1]', async () => {
    const b = createBench(lesson({ brakeNm: -1, eff: 3 }), { registry: { 'dyno-load': behavior } })
    b.dispatch('power')
    await run(b, 0.1)
    expect(b.snapshot().published['dyno.motor_load_Nm']).toBeCloseTo(0.0002, 9)
    b.dispose()
  })
})
