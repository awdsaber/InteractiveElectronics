import { describe, expect, it } from 'vitest'
import type { PartPlacement } from '../../engine/types'
import { injectWobble } from '../wobble'
import { breadboardHole } from './boards'
import { footprint, toBoard } from './footprints'
import { bakeKeyOf } from './frame'
import { ALL_PART_KINDS, partRegistry } from './index'

describe('bake keys', () => {
  const base = { visible: true, soldered: true, glow: 0, burnt: false, explodedOffset: 0, showLabel: false }
  const mk = (kind: PartPlacement['kind']): PartPlacement => ({ id: 'X', kind, pos: [0, 0], mount: 'offboard', role: '' })

  it('servo angle sweeps do not rebake', () => {
    const p = mk('servo')
    expect(bakeKeyOf(partRegistry.servo, p, { ...base, value: 10 })).toBe(
      bakeKeyOf(partRegistry.servo, p, { ...base, value: 170 }),
    )
  })

  it('live multimeter readings do not rebake', () => {
    const p = mk('multimeter')
    expect(bakeKeyOf(partRegistry.multimeter, p, { ...base, reading: '4.98' })).toBe(
      bakeKeyOf(partRegistry.multimeter, p, { ...base, reading: '5.01', value: 0.3 }),
    )
  })

  it('pot turns do not rebake', () => {
    const p = mk('potentiometer')
    expect(bakeKeyOf(partRegistry.potentiometer, p, { ...base, value: 0.1 })).toBe(
      bakeKeyOf(partRegistry.potentiometer, p, { ...base, value: 0.9 }),
    )
  })

  it('discrete states still rebake: button press, burnt', () => {
    const p = mk('button')
    const up = bakeKeyOf(partRegistry.button, p, { ...base, value: 0 })
    expect(bakeKeyOf(partRegistry.button, p, { ...base, value: 0.2 })).toBe(up)
    expect(bakeKeyOf(partRegistry.button, p, { ...base, value: 1 })).not.toBe(up)
    expect(bakeKeyOf(partRegistry.button, p, { ...base, burnt: true })).not.toBe(up)
  })
})

describe('partRegistry', () => {
  it('has exactly one component per PartKind', () => {
    expect(Object.keys(partRegistry).sort()).toEqual([...ALL_PART_KINDS].sort())
    expect(new Set(ALL_PART_KINDS).size).toBe(ALL_PART_KINDS.length)
  })

  it('every entry is a component function', () => {
    for (const kind of ALL_PART_KINDS) expect(typeof partRegistry[kind]).toBe('function')
  })
})

describe('footprints', () => {
  const mk = (kind: PartPlacement['kind'], params?: Record<string, unknown>, mount: PartPlacement['mount'] = 'tht'): PartPlacement => ({
    id: 'X1',
    kind,
    pos: [0, 0],
    mount,
    role: '',
    params,
  })

  it('produce finite pads for every kind', () => {
    for (const kind of ALL_PART_KINDS) {
      for (const pad of footprint(mk(kind)).pads) {
        for (const v of [pad.x, pad.z, pad.w, pad.d]) expect(Number.isFinite(v)).toBe(true)
      }
    }
  })

  it('DIP-8 has 8 pads on a 0.3" row spacing', () => {
    const pads = footprint(mk('ic-dip', { pins: 8 })).pads
    expect(pads).toHaveLength(8)
    expect(new Set(pads.map((p) => p.z.toFixed(3)))).toEqual(new Set(['0.381', '-0.381']))
  })

  it('axial resistor pads sit 0.4" apart', () => {
    const [a, b] = footprint(mk('resistor')).pads
    expect(b.x - a.x).toBeCloseTo(1.016, 6)
  })

  it('off-board parts have no pads', () => {
    expect(footprint(mk('resistor', {}, 'offboard')).pads).toHaveLength(0)
  })

  it('toBoard applies position and rotation about +Y', () => {
    const part = { ...mk('resistor'), pos: [2, 3] as [number, number], rot: 90 }
    const [x, z] = toBoard(part, 1, 0)
    expect(x).toBeCloseTo(2, 6)
    expect(z).toBeCloseTo(2, 6)
  })
})

describe('breadboardHole', () => {
  it('rows e and f straddle the channel 0.3" apart', () => {
    const e = breadboardHole(10, 'e')
    const f = breadboardHole(10, 'f')
    expect(f[2] - e[2]).toBeCloseTo(0.762, 6)
    expect(breadboardHole(11, 'a')[0] - breadboardHole(10, 'a')[0]).toBeCloseTo(0.254, 6)
  })
})

describe('injectWobble', () => {
  const vs = '#include <common>\nvoid main(){\n#include <begin_vertex>\n#include <project_vertex>\n}'
  it('adds uniforms and displacement once', () => {
    const out = injectWobble(vs)
    expect(out).toContain('uniform float uInkWobble')
    expect(out.indexOf('inkOffset = inkD')).toBeGreaterThan(out.indexOf('#include <begin_vertex>'))
    expect(out.indexOf('gl_Position.xy += inkOffset')).toBeGreaterThan(out.indexOf('#include <project_vertex>'))
    expect(injectWobble(out)).toBe(out)
  })
  it('also offsets hand-written gl_Position assignments (outline shader)', () => {
    const outline = '#include <common>\nvoid main(){\n#include <begin_vertex>\nvec4 c = vec4(0.);\ngl_Position = c;\n}'
    expect(injectWobble(outline)).toContain('gl_Position = c; gl_Position.xy += inkOffset * gl_Position.w;')
  })
})
