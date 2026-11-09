import { describe, expect, it } from 'vitest'
import { createBench } from '../bench/simLoop'
import type { Lesson } from '../types'

// One op-amp on a 5 V supply with a 2.5 V reference, wired by six switches into four configurations:
// 0 non-inverting, 1 inverting, 2 buffer, 3 comparator (no feedback). The signal is 2.5 V ± 0.05 V at 5 Hz.
//   S_SP sig→p   S_PR p→ref   S_GR g→ref   S_SG sig→g   S_F fx→n (R_F in the loop)   S_BUF out→n
const SW = 'S_SP,S_PR,S_GR,S_SG,S_F,S_BUF'
const PATTERNS = '101010|010110|100001|101000'

const lesson: Lesson = {
  id: 'oa',
  fig: 1,
  track: 'T2',
  title: 'Op-amp',
  subtitle: '',
  tagline: '',
  board: { name: 'O', size: [4, 4], parts: [{ id: 'u', kind: 'ic-dip', pos: [0, 0], mount: 'tht', role: 'u', circuitIds: ['U1'] }] },
  circuit: {
    elements: [
      { id: 'V_SUP', type: 'V', nodes: ['vcc', '0'], value: 5 },
      { id: 'V_REF', type: 'V', nodes: ['ref', '0'], value: 2.5 },
      { id: 'V_SIG', type: 'V', nodes: ['sig', '0'], value: 0, wave: { kind: 'sine', amp: 0.05, freq: 5, offset: 2.5 } },
      { id: 'S_SP', type: 'SW', nodes: ['sig', 'p'], closed: true },
      { id: 'S_PR', type: 'SW', nodes: ['p', 'ref'], closed: false },
      { id: 'S_GR', type: 'SW', nodes: ['g', 'ref'], closed: true },
      { id: 'S_SG', type: 'SW', nodes: ['sig', 'g'], closed: false },
      { id: 'S_F', type: 'SW', nodes: ['fx', 'n'], closed: true },
      { id: 'S_BUF', type: 'SW', nodes: ['out', 'n'], closed: false },
      { id: 'R_G', type: 'R', nodes: ['n', 'g'], value: 10e3 },
      { id: 'R_F', type: 'R', nodes: ['out', 'fx'], value: 100e3 },
      { id: 'U1', type: 'OPAMP', nodes: ['p', 'n', 'out'], gain: 1e5, vPos: 3.5, vNeg: 0.005 },
      { id: 'R_L', type: 'R', nodes: ['out', '0'], value: 10e3 },
    ],
  },
  powerElementId: 'V_SUP',
  readouts: [{ label: 'OUT', source: { kind: 'voltage', node: 'out' }, unit: 'V' }],
  tweaks: [],
  failures: [{ id: 'no-rf', label: 'R_F out', explain: '', patches: [{ op: 'remove', elementId: 'R_F' }] }],
  meet: '',
  mechanicalAnalogy: '',
  proTips: [],
  quiz: [],
  behaviors: [
    {
      id: 'opamp-config',
      instance: 'cfg',
      params: { mode: 0, switches: SW, patterns: PATTERNS, rf: 'R_F', rg: 'R_G', opamp: 'U1', sine: 'V_SIG', in: 'sig', out: 'out', ref: 'ref' },
    },
  ],
}

async function settle(b: ReturnType<typeof createBench>, seconds: number) {
  const t1 = b.t + seconds
  while (b.t < t1) await b.frame(1 / 60)
}

function withAmp(amp: number): Lesson {
  const l = structuredClone(lesson)
  const v = l.circuit.elements.find((e) => e.id === 'V_SIG')!
  if (v.type === 'V' && v.wave) v.wave.amp = amp
  return l
}

const pub = (b: ReturnType<typeof createBench>, k: string) => b.snapshot().published[`cfg.${k}`]

describe('opamp-config behavior', () => {
  it('sets the switch pattern of each mode and publishes the ideal gain', async () => {
    const b = createBench(lesson)
    b.dispatch('power')
    await settle(b, 0.1)
    expect(pub(b, 'mode')).toBe(0)
    expect(pub(b, 'ideal')).toBeCloseTo(11, 9)
    b.setTweak('behavior:cfg.mode', 1)
    await settle(b, 0.05)
    expect(pub(b, 'ideal')).toBeCloseTo(-10, 9)
    b.setTweak('behavior:cfg.mode', 2)
    await settle(b, 0.05)
    expect(pub(b, 'ideal')).toBe(1)
    b.setTweak('behavior:cfg.mode', 3)
    await settle(b, 0.05)
    expect(pub(b, 'ideal')).toBe(1e5) // open loop
    b.dispose()
  })

  it('measures the gain over a whole period: +11 non-inverting, −10 inverting', async () => {
    const b = createBench(lesson)
    b.dispatch('power')
    await settle(b, 0.5)
    expect(pub(b, 'gain')).toBeCloseTo(11, 1)
    expect(pub(b, 'clipPct')).toBeLessThan(1)
    expect(pub(b, 'inPp')).toBeGreaterThan(0.09)
    b.setTweak('behavior:cfg.mode', 1)
    await settle(b, 0.5)
    expect(pub(b, 'gain')).toBeCloseTo(-10, 1)
    b.dispose()
  })

  it('reports the output extremes: a clipped non-inverting stage tops out at vPos', async () => {
    const b = createBench(withAmp(0.2))
    b.dispatch('power')
    await settle(b, 0.5)
    // 2.5 + 11 × 0.2 = 4.7 V wanted, the rail is 3.5 V; the bottom 2.5 − 2.2 = 0.3 V is still linear
    expect(pub(b, 'outHi')).toBeCloseTo(3.5, 2)
    expect(pub(b, 'outLo')).toBeLessThan(0.4)
    expect(pub(b, 'outLo')).toBeGreaterThan(0.25)
    // wanted 4.4 V peak-to-peak, got ≈ 3.2 V: about 27 % of the swing is lost
    expect(pub(b, 'clipPct')).toBeGreaterThan(20)
    expect(pub(b, 'clipPct')).toBeLessThan(35)
    b.dispose()
  })

  it('with R_F removed the ideal gain becomes the open-loop gain', async () => {
    const b = createBench(lesson)
    b.dispatch('power')
    b.dispatch('break:no-rf')
    await settle(b, 0.5)
    expect(pub(b, 'ideal')).toBe(1e5)
    expect(pub(b, 'outHi')).toBeCloseTo(3.5, 2)
    expect(pub(b, 'outLo')).toBeCloseTo(0.005, 2)
    b.dispose()
  })
})
