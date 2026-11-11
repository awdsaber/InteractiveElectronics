import { describe, expect, it } from 'vitest'
import type { PcbLayersSpec } from '../types'
import { liveTrace, runDrc, segmentGap } from './drc'

const RULES = { minTrace: 0.15, minClearance: 0.15, minAnnular: 0.1, riseC: 10 }

function spec(over: Partial<PcbLayersSpec> = {}): PcbLayersSpec {
  return { thicknessMm: 1.6, copperOz: 1, top: [], bottom: [], rules: RULES, ...over }
}

describe('segmentGap (board units in, closest distance and midpoint out)', () => {
  it('parallel segments', () => {
    const g = segmentGap([0, 0], [1, 0], [0, 0.03], [1, 0.03])
    expect(g.d).toBeCloseTo(0.03, 9)
  })
  it('crossing segments touch', () => {
    expect(segmentGap([0, -1], [0, 1], [-1, 0], [1, 0]).d).toBe(0)
  })
  it('end to end', () => {
    const g = segmentGap([0, 0], [1, 0], [1.5, 0], [2, 0])
    expect(g.d).toBeCloseTo(0.5, 9)
    expect(g.at[0]).toBeCloseTo(1.25, 9)
  })
})

describe('runDrc', () => {
  it('a clean board passes', () => {
    const s = spec({ top: [{ id: 'a', net: 'A', pts: [[0, 0], [2, 0]], w: 0.3, amps: 0.5 }, { id: 'b', net: 'B', pts: [[0, 0.1], [2, 0.1]], w: 0.25 }] })
    expect(runDrc(s)).toEqual([])
  })

  it('trace width against IPC-2221: 0.30 mm passes at 1 A but fails at 2 A (needs 0.78 mm)', () => {
    const t = { id: 'pwr', net: 'VIN', pts: [[0, 0], [3, 0]] as [number, number][], w: 0.3 }
    expect(runDrc(spec({ top: [{ ...t, amps: 1 }] }))).toEqual([])
    const v = runDrc(spec({ top: [{ ...t, amps: 2 }] }))
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ rule: 'trace-width', layer: 'top', id: 'trace-width:pwr' })
    expect(v[0].value).toBeCloseTo(0.3, 9)
    expect(v[0].limit).toBeCloseTo(0.78, 2)
    expect(v[0].at).toEqual([1.5, 0])
    expect(v[0].message).toMatch(/0\.78 mm/)
  })

  it('the width and current can follow live params', () => {
    const t = { id: 'pwr', net: 'VIN', pts: [[0, 0], [3, 0]] as [number, number][], w: 0.3, widthParam: 'tr.widthMm', ampsParam: 'load.iSet' }
    const p = (k: string) => ({ 'tr.widthMm': 0.8, 'load.iSet': 2 })[k]
    expect(liveTrace(t, p)).toMatchObject({ w: 0.8, amps: 2 })
    expect(runDrc(spec({ top: [t] }), { param: p })).toEqual([])
    expect(runDrc(spec({ top: [t] }), { param: (k) => (k === 'load.iSet' ? 2 : undefined) })[0].rule).toBe('trace-width')
    // 2 oz copper: 0.39 mm is enough for 2 A, so 0.5 mm passes
    const p2 = (k: string) => ({ 'tr.widthMm': 0.5, 'load.iSet': 2, 'tr.oz': 2 })[k]
    expect(runDrc(spec({ top: [t] }), { param: p2 }).map((v) => v.rule)).toEqual(['trace-width'])
    expect(runDrc(spec({ top: [t], copperOzParam: 'tr.oz' }), { param: p2 })).toEqual([])
  })

  it('below the fab minimum width', () => {
    const v = runDrc(spec({ top: [{ id: 's', net: 'S', pts: [[0, 0], [1, 0]], w: 0.1 }] }))
    expect(v.map((x) => x.rule)).toEqual(['min-trace'])
  })

  it('clearance: edge to edge between nets on the same layer, in mm', () => {
    // centres 0.03 units = 0.30 mm apart, two 0.20 mm traces: 0.10 mm of air < 0.15 mm
    const a = { id: 'a', net: 'A', pts: [[0, 0], [1, 0]] as [number, number][], w: 0.2 }
    const b = { id: 'b', net: 'B', pts: [[0, 0.03], [1, 0.03]] as [number, number][], w: 0.2 }
    const v = runDrc(spec({ top: [a, b] }))
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ rule: 'clearance', id: 'clearance:a:b' })
    expect(v[0].value).toBeCloseTo(0.1, 9)
    expect(v[0].limit).toBe(0.15)
    // same net: no clearance rule; other layer: no clearance rule
    expect(runDrc(spec({ top: [a, { ...b, net: 'A' }] }))).toEqual([])
    expect(runDrc(spec({ top: [a], bottom: [b] }))).toEqual([])
  })

  it('a via too close to another net, and a thin annular ring', () => {
    const t = { id: 'a', net: 'A', pts: [[0, 0], [1, 0]] as [number, number][], w: 0.2 }
    const v = runDrc(spec({ top: [t], vias: [{ at: [0.5, 0.04], net: 'GND', drill: 0.3, pad: 0.6 }] }))
    // 0.40 mm centre to centre − 0.30 pad radius − 0.10 half width = 0 mm
    expect(v.map((x) => x.rule)).toEqual(['clearance'])
    expect(v[0].value).toBeCloseTo(0, 9)
    const r = runDrc(spec({ vias: [{ at: [0, 0], net: 'GND', drill: 0.4, pad: 0.5 }] }))
    expect(r.map((x) => x.rule)).toEqual(['annular-ring'])
    expect(r[0].value).toBeCloseTo(0.05, 9)
  })

  it('decoupling capacitor distance from its IC pin, through the pad resolver', () => {
    const padAt = (part: string, pad: number): [number, number] | undefined =>
      part === 'u1' && pad === 3 ? [0, 0] : part === 'c1' ? [0.1 + pad * 0.1, 0] : part === 'c2' ? [0.8 + pad * 0.1, 0] : undefined
    const s = spec({
      decoupling: [
        { cap: 'c1', ic: 'u1', pad: 3, pin: 'VCC', maxMm: 3 },
        { cap: 'c2', ic: 'u1', pad: 3, pin: 'AVCC', maxMm: 3 },
      ],
    })
    const v = runDrc(s, { padAt })
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ rule: 'decoupling', id: 'decoupling:c2' })
    expect(v[0].value).toBeCloseTo(8, 9) // nearest pad 0.8 units = 8 mm
    expect(v[0].at).toEqual([0.8, 0])
    // without a resolver the rule cannot run
    expect(runDrc(s)).toEqual([])
  })

  it('a pad joined solid to a pour has no thermal relief', () => {
    const padAt = () => [1, 1] as [number, number]
    const s = spec({ pourPads: [{ part: 'j2', pad: 1, relief: false }, { part: 'j1', pad: 1, relief: true }] })
    const v = runDrc(s, { padAt })
    expect(v.map((x) => [x.rule, x.id, x.layer])).toEqual([['thermal-relief', 'thermal-relief:j2:1', 'bottom']])
  })
})
