import { describe, expect, it } from 'vitest'
import { lesson as ledResistor } from '../lessons/T2/led-resistor'
import type { PartPlacement } from '../engine/types'
import { partCallout } from './Board'
import { createCalloutLayer } from './calloutLayer'
import { DEFAULT_PART_STATE } from './parts/types'

const fakeEl = () => ({ style: {} as Record<string, string> }) as unknown as HTMLElement

describe('callout layer', () => {
  it('keeps every registered tag, the first one included, in registration order', () => {
    const layer = createCalloutLayer()
    let notified = 0
    layer.subscribe(() => notified++)
    layer.set({ id: 'a', text: 'UNO', tone: 'ink', hidden: false })
    layer.set({ id: 'b', text: 'LED', tone: 'ink', hidden: false })
    expect(layer.list().map((e) => e.text)).toEqual(['UNO', 'LED'])
    expect(notified).toBe(2)
    // an unchanged update is a no-op and keeps the snapshot reference
    const snap = layer.list()
    layer.set({ id: 'a', text: 'UNO', tone: 'ink', hidden: false })
    expect(layer.list()).toBe(snap)
    expect(notified).toBe(2)
  })

  it('survives a remove + re-register of the same tag (StrictMode / effect re-runs)', () => {
    const layer = createCalloutLayer()
    layer.set({ id: 'a', text: 'UNO', tone: 'ink', hidden: false })
    layer.remove('a')
    layer.set({ id: 'a', text: 'UNO', tone: 'ink', hidden: false })
    expect(layer.list().map((e) => e.text)).toEqual(['UNO'])
  })

  it('positions an element bound after its first placement, and hides unplaced ones', () => {
    const layer = createCalloutLayer()
    const early = fakeEl()
    layer.bind('x', early)
    expect(early.style.visibility).toBe('hidden')
    layer.place('a', { x: 10, y: 20, visible: true, z: 3 })
    const el = fakeEl()
    layer.bind('a', el)
    expect(el.style.transform).toContain('translate3d(10px,20px,0)')
    expect(el.style.visibility).toBe('visible')
    layer.place('a', { x: 10, y: 20, visible: false, z: 3 })
    expect(el.style.visibility).toBe('hidden')
  })
})

describe('partCallout', () => {
  const placed = { ...DEFAULT_PART_STATE, visible: true }

  it('gives every labelled led-resistor part a callout, including the first (UNO)', () => {
    const labelled = ledResistor.board.parts.filter((p) => p.label)
    expect(labelled[0].label).toBe('UNO')
    expect(ledResistor.board.parts.indexOf(labelled[0])).toBe(0)
    const callouts = ledResistor.board.parts.map((p) => partCallout(p, placed, true)).filter((c) => c !== null)
    expect(callouts.map((c) => c.text)).toEqual(labelled.map((p) => p.label))
    expect(callouts.every((c) => !c.hidden)).toBe(true)
  })

  it('hides (not drops) the callout when labels are off or the part is not placed; none without a label', () => {
    const p: PartPlacement = ledResistor.board.parts[0]
    expect(partCallout(p, placed, false)?.hidden).toBe(true)
    expect(partCallout(p, { ...placed, visible: false }, true)?.hidden).toBe(true)
    expect(partCallout(p, { ...placed, burnt: true }, true)?.tone).toBe('warn')
    expect(partCallout({ ...p, label: undefined }, placed, true)).toBeNull()
  })
})
