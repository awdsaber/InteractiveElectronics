import { describe, expect, it } from 'vitest'
import type { BurnEvent, Element, Netlist } from '../types'
import { applyBurn, applyPatches } from './failures'

const base = (): Netlist => ({
  elements: [
    { id: 'V1', type: 'V', nodes: ['vcc', '0'], value: 5 },
    { id: 'R1', type: 'R', nodes: ['vcc', 'a'], value: 220, partId: 'r1' },
    { id: 'D1', type: 'LED', nodes: ['a', '0'], color: 'red' },
    { id: 'Q1', type: 'NPN', nodes: ['c', 'b', 'e'], rating: { maxI: 0.2, failMode: 'short' } },
    { id: 'M1', type: 'NMOS', nodes: ['d', 'g', 's'] },
  ],
})

const burn = (elementId: string): BurnEvent => ({ elementId, reason: 'overcurrent', value: 1, limit: 0.1, t: 0.3 })

describe('applyPatches', () => {
  it('is pure and applies remove / set / short / add in order', () => {
    const n = base()
    const snapshot = JSON.stringify(n)
    const out = applyPatches(n, [
      { op: 'remove', elementId: 'D1' },
      { op: 'set', elementId: 'R1', key: 'value', value: 22 },
      { op: 'short', a: 'a', b: '0' },
      { op: 'add', element: { id: 'R9', type: 'R', nodes: ['vcc', '0'], value: 1e3 } },
    ])
    expect(JSON.stringify(n)).toBe(snapshot)
    expect(out.elements.find((e) => e.id === 'D1')).toBeUndefined()
    expect(out.elements.find((e) => e.id === 'R1')).toMatchObject({ value: 22, partId: 'r1' })
    const short = out.elements.find((e) => e.type === 'R' && e.nodes[0] === 'a' && e.nodes[1] === '0')
    expect(short).toMatchObject({ type: 'R', value: 0.01 })
    expect(out.elements.at(-1)).toMatchObject({ id: 'R9' })
  })

  it("'add' copies the element and its nodes array", () => {
    const element: Element = { id: 'R9', type: 'R', nodes: ['a', 'b'], value: 10 }
    const out = applyPatches(base(), [{ op: 'add', element }])
    const added = out.elements[out.elements.length - 1]
    expect(added).not.toBe(element)
    expect(added.nodes).not.toBe(element.nodes)
    expect(added).toEqual(element)
  })

  it('gives each short a unique id', () => {
    const out = applyPatches(base(), [
      { op: 'short', a: 'a', b: '0' },
      { op: 'short', a: 'a', b: '0' },
    ])
    const ids = out.elements.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('applyBurn', () => {
  it('open (default) makes the element non-conducting and keeps its id and part', () => {
    const out = applyBurn(base(), burn('R1'))
    const r = out.elements.find((e) => e.id === 'R1')
    expect(r).toMatchObject({ type: 'R', value: 1e9, nodes: ['vcc', 'a'], partId: 'r1' })
    expect(r?.rating).toBeUndefined()
  })

  it('short replaces a transistor with 0.01 Ω from C to E', () => {
    const out = applyBurn(base(), burn('Q1'))
    expect(out.elements.find((e) => e.id === 'Q1')).toMatchObject({ type: 'R', value: 0.01, nodes: ['c', 'e'] })
  })

  it('open MOSFET is opened between D and S', () => {
    const out = applyBurn(base(), burn('M1'))
    expect(out.elements.find((e) => e.id === 'M1')).toMatchObject({ type: 'R', value: 1e9, nodes: ['d', 's'] })
  })

  it('ignores unknown ids and does not mutate the input', () => {
    const n = base()
    const snapshot = JSON.stringify(n)
    expect(applyBurn(n, burn('nope')).elements).toHaveLength(n.elements.length)
    applyBurn(n, burn('R1'))
    expect(JSON.stringify(n)).toBe(snapshot)
  })
})
