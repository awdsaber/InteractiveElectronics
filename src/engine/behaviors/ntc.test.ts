import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { behavior, ntcOhms } from './ntc'

const FRAME = 1 / 60

function make(rFix: number, params: Record<string, number> = {}): Lesson {
  return {
    id: 'ntc-test',
    fig: 1,
    track: 'T6',
    title: 'NTC',
    subtitle: '',
    tagline: '',
    board: { name: 'N', size: [4, 4], parts: [{ id: 'n', kind: 'thermistor', pos: [0, 0], mount: 'tht', role: 'n', circuitIds: ['ntc'] }] },
    circuit: {
      elements: [
        { id: 'V1', type: 'V', nodes: ['5v', '0'], value: 5 },
        { id: 'r_fix', type: 'R', nodes: ['5v', 'a0'], value: rFix },
        { id: 'ntc', type: 'R', nodes: ['a0', '0'], value: 10000 },
      ],
    },
    powerElementId: 'V1',
    readouts: [{ label: 'A0', source: { kind: 'voltage', node: 'a0' }, unit: 'V' }],
    tweaks: [{ label: 'Bath', elementId: 'behavior:ntc', key: 'bathC', min: -20, max: 150, step: 1, unit: '°C' }],
    failures: [],
    meet: '',
    mechanicalAnalogy: '',
    proTips: [],
    quiz: [],
    behaviors: [{ id: 'ntc', params: { bathC: 25, ...params } }],
  }
}

async function run(b: ReturnType<typeof createBench>, sec: number) {
  for (let i = 0; i < Math.round(sec / FRAME); i++) await b.frame(FRAME)
}
const bench = (l: Lesson) => createBench(l, { registry: { ntc: behavior } })

describe('ntc behavior', () => {
  it('Beta model: 10 kOhm at 25 C, 3.56 kOhm at 50 C, within 0.5 %', () => {
    expect(ntcOhms(25)).toBeCloseTo(10000, 6)
    expect(Math.abs(ntcOhms(50) / 3560 - 1)).toBeLessThan(0.005)
    const want = 10000 * Math.exp(3977 * (1 / 323.15 - 1 / 298.15))
    expect(ntcOhms(50)).toBeCloseTo(want, 6)
  })

  it('sets the element resistance from the bath (no lag, no self-heat)', async () => {
    const b = bench(make(10000, { tau: 0, selfHeat: 0, bathC: 50 }))
    b.dispatch('power')
    await run(b, 0.2)
    const s = b.snapshot()
    expect(Math.abs(s.elementValues['ntc.value'] / ntcOhms(50) - 1)).toBeLessThan(0.005)
    expect(s.published['ntc.ntc_C']).toBeCloseTo(50, 6)
    b.dispose()
  })

  it('self-heating at high divider current: 330 ohm over a hot NTC warms it by P/delta', async () => {
    const b = bench(make(330, { tau: 1, bathC: 100 }))
    b.dispatch('power')
    await run(b, 15)
    const s = b.snapshot()
    const heat = s.published['ntc.self_heat_K']
    const dT = s.published['ntc.ntc_C'] - 100
    expect(heat).toBeGreaterThan(1.5)
    expect(Math.abs(dT - heat)).toBeLessThan(0.02)
    expect(heat).toBeCloseTo(s.published['ntc.p_self_mW'] / 1000 / 0.0085, 6)
    b.dispose()
  })

  it('10k on 10k at 25 C dissipates 0.625 mW: about 0.07 K', async () => {
    const b = bench(make(10000, { tau: 1 }))
    b.dispatch('power')
    await run(b, 8)
    const s = b.snapshot()
    expect(s.published['ntc.p_self_mW']).toBeCloseTo(0.625, 2)
    expect(s.published['ntc.self_heat_K']).toBeCloseTo(0.0735, 2)
    b.dispose()
  })

  it('thermal lag: a bath step is followed with the time constant (63 % at tau, 95 % at 3 tau)', async () => {
    const b = bench(make(10000, { tau: 5, selfHeat: 0 }))
    b.dispatch('power')
    await run(b, 0.2)
    b.setTweak('behavior:ntc.bathC', 65)
    await run(b, 5)
    const f1 = (b.snapshot().published['ntc.ntc_C'] - 25) / 40
    expect(f1).toBeGreaterThan(0.61)
    expect(f1).toBeLessThan(0.66)
    await run(b, 10)
    const f3 = (b.snapshot().published['ntc.ntc_C'] - 25) / 40
    expect(f3).toBeGreaterThan(0.94)
    expect(b.snapshot().published['ntc.lag_K']).toBeLessThan(0)
    b.dispose()
  })

  it('a wrong B (3435 K) changes the resistance: about 2.98 kOhm at 60 C', () => {
    expect(Math.abs(ntcOhms(60, 10000, 3435) / 2980 - 1)).toBeLessThan(0.01)
  })
})
