import { describe, expect, it } from 'vitest'
import { partGoal } from './BenchScene'
import { createCalloutLayer } from './calloutLayer'
import { bracketSegments } from './Highlight'
import { easeInOut } from './IsoCamera'
import { closeupPart, closeupZoom } from './PartCloseup'

describe('part inspector: view helpers', () => {
  it('corner brackets: 3 ticks at each of 8 corners, padded, a fraction of each edge long', () => {
    const pts = bracketSegments([0, 0, 0], [1, 2, 4], 0, 0.25)
    expect(pts).toHaveLength(48)
    // the first corner is the min corner; its x tick runs a quarter of the width
    expect(pts[0]).toEqual([0, 0, 0])
    expect(pts[1]).toEqual([0.25, 0, 0])
    expect(pts[3]).toEqual([0, 0.5, 0])
    expect(pts[5]).toEqual([0, 0, 1])
    const padded = bracketSegments([0, 0, 0], [1, 1, 1], 0.1)
    expect(padded[0]).toEqual([-0.1, -0.1, -0.1])
  })

  it('partGoal fills ~45 % of the free canvas and shifts the part clear of a docked card', () => {
    const g = partGoal([1, 0, 2], 0.5, 1000, 600, 0, 50, 1000)
    expect(g.zoom).toBeCloseTo((0.45 * 600) / 1, 6)
    expect(g.target).toEqual([1, 0, 2])
    const withCard = partGoal([1, 0, 2], 0.5, 1000, 600, 360, 50, 1000)
    // the target moves along the camera's right vector (+x, −z) by half the card width in units
    const shift = 180 / withCard.zoom
    expect(withCard.target[0]).toBeCloseTo(1 + Math.SQRT1_2 * shift, 6)
    expect(withCard.target[2]).toBeCloseTo(2 - Math.SQRT1_2 * shift, 6)
    // clamped to the zoom limits
    expect(partGoal([0, 0, 0], 0.001, 1000, 600, 0, 50, 400).zoom).toBe(400)
    expect(partGoal([0, 0, 0], 100, 1000, 600, 0, 50, 400).zoom).toBe(50)
  })

  it('camera ease runs 0 → 1 smoothly and clamps', () => {
    expect(easeInOut(-1)).toBe(0)
    expect(easeInOut(0.5)).toBe(0.5)
    expect(easeInOut(2)).toBe(1)
  })

  it('the close-up draws the part at the origin, unrotated', () => {
    const p = closeupPart({ id: 'r', kind: 'resistor', pos: [3, 4], rot: 90, mount: 'tht', role: '' })
    expect(p.pos).toEqual([0, 0])
    expect(p.rot).toBe(0)
    expect(closeupPart({ id: 'm', kind: 'module', pos: [3, 1.2, 4], mount: 'offboard', role: '' }).pos).toEqual([0, 1.2, 0])
  })

  it('the close-up zoom fits the turning footprint across and the foreshortened height up', () => {
    // a flat 1 × 1 chip in a wide, short view: the height limits it
    const flat = closeupZoom([1, 0.1, 1], 400, 150)
    const diag = Math.SQRT2
    expect(flat).toBeCloseTo((0.82 * 150) / (diag * Math.sin((35.264 * Math.PI) / 180) + 0.1 * Math.cos((35.264 * Math.PI) / 180)), 6)
    // a long thin part in a tall view: the width limits it
    expect(closeupZoom([3, 0.2, 0.2], 200, 400)).toBeCloseTo((0.88 * 200) / Math.hypot(3, 0.2), 6)
  })

  it('callout entries carry their target part; a target change notifies', () => {
    const layer = createCalloutLayer()
    let n = 0
    layer.subscribe(() => n++)
    layer.set({ id: 'a', text: 'LIMIT', tone: 'ink', hidden: false, target: 'r1' })
    layer.set({ id: 'a', text: 'LIMIT', tone: 'ink', hidden: false, target: 'r1' })
    expect(n).toBe(1)
    layer.set({ id: 'a', text: 'LIMIT', tone: 'ink', hidden: false, target: 'r2' })
    expect(n).toBe(2)
    expect(layer.list()[0].target).toBe('r2')
  })
})
