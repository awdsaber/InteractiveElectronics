import { describe, expect, it } from 'vitest'
import { PCB_LAYERS, PCB_STACK, PEEL_FAN, PEEL_GAP, TOUR_VIEWS, coreThicknessMm, layerShift, layerVisible, layerY, partsLift, tourView } from './layers'

describe('PCB layer model', () => {
  it('stacks bottom copper, core, top copper, mask, silk from the bottom up; drill goes through all of them', () => {
    expect(PCB_STACK.map((l) => l.id)).toEqual(['bottom-copper', 'core', 'top-copper', 'mask', 'silk'])
    expect(PCB_LAYERS.map((l) => l.id)).toEqual([...PCB_STACK.map((l) => l.id), 'drill'])
    for (const l of PCB_LAYERS) {
      expect(l.label.length).toBeGreaterThan(2)
      expect(l.file.length).toBeGreaterThan(2)
    }
  })

  it('1.6 mm FR-4 with 1 oz on both sides leaves a 1.53 mm core', () => {
    expect(coreThicknessMm(1.6, 1)).toBeCloseTo(1.53, 2)
    expect(coreThicknessMm(1.6, 2)).toBeCloseTo(1.46, 2)
  })

  it('the tour view index maps to all or one isolated layer, clamped and rounded', () => {
    expect(TOUR_VIEWS[0]).toBe('all')
    expect(tourView(0)).toBe('all')
    expect(tourView(1)).toBe('bottom-copper')
    expect(tourView(3.2)).toBe('top-copper')
    expect(tourView(6)).toBe('drill')
    expect(tourView(99)).toBe('drill')
    expect(tourView(-3)).toBe('all')
    expect(tourView(Number.NaN)).toBe('all')
  })

  it('isolating a layer hides every other one', () => {
    for (const l of PCB_LAYERS) expect(layerVisible('all', l.id)).toBe(true)
    expect(layerVisible('mask', 'mask')).toBe(true)
    expect(layerVisible('mask', 'silk')).toBe(false)
    expect(layerVisible('drill', 'core')).toBe(false)
  })

  it('assembled, the layers sit on the board top (bottom copper under the core); peeled, a gap apart in stack order', () => {
    expect(layerY('core', false, 'all')).toBe(0)
    expect(layerY('bottom-copper', false, 'all')).toBeLessThan(0)
    expect(layerY('silk', false, 'all')).toBeGreaterThan(layerY('mask', false, 'all'))
    expect(layerY('mask', false, 'all')).toBeGreaterThan(layerY('top-copper', false, 'all'))
    const ys = PCB_STACK.map((l) => layerY(l.id, true, 'all'))
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeCloseTo(PEEL_GAP, 9)
    // an isolated layer lies flat on the bench, peeled or not
    expect(layerY('bottom-copper', true, 'bottom-copper')).toBe(0)
    expect(layerY('bottom-copper', false, 'bottom-copper')).toBe(0)
  })

  it('peeled, the lower sheets fan out toward the viewer so each one shows; the top sheet stays under the parts', () => {
    expect(layerShift('silk', true, 'all')).toBe(0)
    const zs = PCB_STACK.map((l) => layerShift(l.id, true, 'all'))
    for (let i = 1; i < zs.length; i++) expect(zs[i - 1] - zs[i]).toBeCloseTo(PEEL_FAN, 9)
    expect(layerShift('bottom-copper', false, 'all')).toBe(0)
    expect(layerShift('bottom-copper', true, 'bottom-copper')).toBe(0)
    // a drill hit's line through the stack is straight: shift is linear in height
    const k = (id: (typeof PCB_STACK)[number]['id']) => layerShift(id, true, 'all') / (layerY('silk', true, 'all') - layerY(id, true, 'all') || 1)
    expect(k('bottom-copper')).toBeCloseTo(k('core'), 9)
  })

  it('peeled, the parts lift clear of the whole stack; assembled they do not move', () => {
    expect(partsLift(false)).toBe(0)
    expect(partsLift(true)).toBeGreaterThan(layerY('silk', true, 'all'))
  })
})
