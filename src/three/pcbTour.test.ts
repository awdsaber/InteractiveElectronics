import { describe, expect, it } from 'vitest'
import { createBench } from '../engine/bench/simLoop'
import type { Lesson } from '../engine/types'
import { getLesson } from '../lessons/index'
import { drcPill, tourState } from './pcbTour'
import { padResolver, worldPads } from './pcbPads'

const L = getLesson('pcb-design-workflow') as Lesson

describe('tourState', () => {
  it('unpowered: tweak, then the lesson default; powered: the published (effective) value', async () => {
    const b = createBench(L)
    let s = tourState(L, b.snapshot(), b.tweakValues())
    expect(s.view).toBe('all')
    expect(s.drc).toBe(false)
    expect(s.peeled).toBe(false)
    expect(s.param('tr.widthMm')).toBe(0.3)
    b.setTweak('behavior:tour.view', 4)
    b.setTweak('behavior:tour.drc', 1)
    s = tourState(L, b.snapshot(), b.tweakValues())
    expect(s.view).toBe('mask')
    expect(s.drc).toBe(true)
    b.dispatch('explode')
    expect(tourState(L, b.snapshot(), b.tweakValues()).peeled).toBe(true)
    // a failure override shows through the published value while powered
    b.dispatch('power')
    for (let i = 0; i < 3; i++) await b.frame(1 / 60)
    b.dispatch('break:thin-trace')
    for (let i = 0; i < 3; i++) await b.frame(1 / 60)
    expect(tourState(L, b.snapshot(), b.tweakValues()).param('tr.widthMm')).toBe(0.1)
    b.dispose()
  })

  it('pills are short', () => {
    expect(drcPill({ rule: 'clearance', id: 'c', at: [0, 0], layer: 'top', value: 0.1, limit: 0.15, message: '' })).toBe('DRC · gap 0.10 mm < 0.15 mm')
  })
})

describe('worldPads', () => {
  it('moves pads with the part and rotates them as the PCB texture does', () => {
    const p = { id: 'r', kind: 'resistor-smd' as const, pos: [1, 2] as [number, number], mount: 'smd' as const, role: '' }
    const a = worldPads(p)
    expect(a[0].x).toBeCloseTo(1 - 0.084, 6)
    expect(a[0].z).toBeCloseTo(2, 6)
    const r = worldPads({ ...p, rot: 90 })
    expect(r[0].x).toBeCloseTo(1, 6)
    expect(r[0].z).toBeCloseTo(2 + 0.084, 6)
    expect(r[0].w).toBeCloseTo(a[0].d, 9)
    expect(padResolver([p])('r', 1)).toEqual([a[1].x, a[1].z])
    expect(padResolver([p])('nope', 0)).toBeUndefined()
  })
})
