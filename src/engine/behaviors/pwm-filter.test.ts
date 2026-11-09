import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { behavior, rippleVpp } from './pwm-filter'

const lesson = (c: number | null): Lesson => ({
  id: 'pf',
  fig: 1,
  track: 'T0',
  title: 'PWM filter',
  subtitle: '',
  tagline: '',
  board: { name: 'P', size: [4, 4], parts: [{ id: 'r', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['R_F'] }] },
  circuit: {
    elements: [
      { id: 'V1', type: 'V', nodes: ['5v', '0'], value: 5 },
      { id: 'PIN9', type: 'PIN', nodes: ['p9', '0'], pin: 9, vcc: 5, vccNode: '5v' },
      { id: 'R_F', type: 'R', nodes: ['p9', 'f'], value: 10e3 },
      ...(c === null ? [] : [{ id: 'C_F', type: 'C' as const, nodes: ['f', '0'] as [string, string], value: c }]),
      { id: 'R_L', type: 'R', nodes: ['f', '0'], value: 1e9 },
    ],
  },
  powerElementId: 'V1',
  readouts: [],
  failures: [],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  sketch: {
    title: 'pwm',
    code: 'void setup(){ pinMode(9, OUTPUT); analogWrite(9, 128); } void loop(){ delay(10); }',
    pins: { 9: 'PIN9' },
    vcc: 5,
    board: 'uno',
  },
  behaviors: [{ id: 'pwm-filter', instance: 'pf', params: { pin: 9, r: 'R_F', c: 'C_F' } }],
})

const run = async (b: ReturnType<typeof createBench>, sec: number) => {
  for (let t = 0; t < sec; t += 1 / 60) await b.frame(1 / 60)
}

describe('rippleVpp (exact first-order response to a duty-D square wave)', () => {
  it('matches Vcc D (1 - D) / (f RC) when RC >> T', () => {
    const exact = rippleVpp(5, 128 / 255, 1 / 490, 0.1)
    expect(exact).toBeGreaterThan(0.0245)
    expect(exact).toBeLessThan(0.0265)
  })
  it('is zero at 0 % and 100 % duty and saturates at Vcc when RC << T', () => {
    expect(rippleVpp(5, 0, 1 / 490, 0.1)).toBe(0)
    expect(rippleVpp(5, 1, 1 / 490, 0.1)).toBe(0)
    expect(rippleVpp(5, 0.5, 1 / 490, 1e-7)).toBeCloseTo(5, 3)
  })
})

describe('pwm-filter behavior', () => {
  it('10 kΩ / 10 µF at analogWrite(9, 128): fc 1.59 Hz, tau 0.1 s, 490 Hz, average 2.51 V, ripple 25 mV', async () => {
    const b = createBench(lesson(10e-6), { registry: { 'pwm-filter': behavior } })
    b.dispatch('power')
    b.upload()
    await run(b, 0.5)
    const p = b.snapshot().published
    expect(p['pf.fc']).toBeCloseTo(1 / (2 * Math.PI * 0.1), 3)
    expect(p['pf.tau']).toBeCloseTo(0.1, 6)
    expect(p['pf.fpwm']).toBe(490)
    expect(p['pf.ratio']).toBeGreaterThan(300)
    expect(p['pf.vavg']).toBeCloseTo((128 / 255) * 5, 3)
    expect(p['pf.ripple']).toBeGreaterThan(0.024)
    expect(p['pf.ripple']).toBeLessThan(0.027)
  })
  it('with the capacitor gone: no cutoff, and the ripple is the whole 5 V swing', async () => {
    const b = createBench(lesson(null), { registry: { 'pwm-filter': behavior } })
    b.dispatch('power')
    b.upload()
    await run(b, 0.5)
    const p = b.snapshot().published
    expect(Number.isNaN(p['pf.fc'])).toBe(true)
    expect(p['pf.ripple']).toBeCloseTo(5, 3)
  })
})
