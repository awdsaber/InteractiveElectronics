import { describe, expect, it } from 'vitest'
import type { BoardSpec, PartPlacement } from '../engine/types'
import { AUTO_MARGIN, AUTO_MIN_SIZE, autoFrame, boardFrame, matFrame, partBounds } from './autoFrame'

const P = (o: Partial<PartPlacement> & { id: string; kind: PartPlacement['kind'] }): PartPlacement => ({
  pos: [0, 0],
  mount: 'tht',
  role: '',
  ...o,
})
const led1 = P({ id: 'led1', kind: 'led', pos: [10, 0.5, 4] })
const led2 = P({ id: 'led2', kind: 'led', pos: [-3, 0.5, 9] })

describe('partBounds', () => {
  it('uses the module size and rotates it', () => {
    const m = P({ id: 'm', kind: 'module', pos: [2, 0, 3], mount: 'module', params: { w: 4, d: 2 } })
    const b = partBounds(m)
    expect(b.minX).toBeCloseTo(0)
    expect(b.maxX).toBeCloseTo(4)
    expect(b.minZ).toBeCloseTo(2)
    expect(b.maxZ).toBeCloseTo(4)
    const r = partBounds({ ...m, rot: 90 })
    expect(r.maxX - r.minX).toBeCloseTo(2)
    expect(r.maxZ - r.minZ).toBeCloseTo(4)
    expect((r.minX + r.maxX) / 2).toBeCloseTo(2)
  })
  it('covers every point of a wire', () => {
    const w = P({ id: 'w', kind: 'wire', pos: [1, 0.5, 1], mount: 'offboard', params: { points: [[-1, 0, -2], [3, 0, 0]] } })
    const b = partBounds(w)
    expect(b.minX).toBeLessThanOrEqual(0)
    expect(b.maxX).toBeGreaterThanOrEqual(4)
    expect(b.minZ).toBeLessThanOrEqual(-1)
    expect(b.maxZ).toBeGreaterThanOrEqual(1)
  })
  it('uses the footprint pads when the part has them', () => {
    const b = partBounds(P({ id: 'r', kind: 'resistor', pos: [5, 5], params: { ohms: 220 } }))
    expect(b.maxX - b.minX).toBeGreaterThan(0.5)
    expect(b.maxX - b.minX).toBeLessThan(2)
  })
  it('gives an offboard part without a footprint a small default extent', () => {
    const b = partBounds(P({ id: 'x', kind: 'led', pos: [0, 0, 0], mount: 'offboard' }))
    expect(b.maxX).toBeGreaterThan(0)
    expect(b.maxX).toBeLessThan(1)
  })
})

describe('autoFrame', () => {
  it('returns undefined when there are no meaningful parts', () => {
    expect(autoFrame([P({ id: 'bb', kind: 'breadboard', mount: 'offboard' })])).toBeUndefined()
  })
  it('ignores the breadboard however far away it is', () => {
    const f = autoFrame([P({ id: 'bb', kind: 'breadboard', pos: [-40, 0], mount: 'offboard' }), led1])!
    expect(Math.abs(f.center![0] - 10)).toBeLessThan(1)
  })
  it('frames a small cluster at the minimum size', () => {
    const f = autoFrame([led1])!
    expect(f.size[0]).toBeGreaterThanOrEqual(AUTO_MIN_SIZE[0])
    expect(f.size[1]).toBeGreaterThanOrEqual(AUTO_MIN_SIZE[1])
    expect(f.size[0]).toBeLessThan(12)
  })
  it('adds the margin around a large spread', () => {
    const a = P({ id: 'a', kind: 'module', pos: [0, 0, 0], mount: 'module', params: { w: 10, d: 8 } })
    const f = autoFrame([a])!
    expect(f.size[0]).toBeCloseTo(10 + 2 * AUTO_MARGIN)
    expect(f.size[1]).toBeCloseTo(8 + 2 * AUTO_MARGIN)
    expect(f.center![0]).toBeCloseTo(0)
    expect(f.center![1]).toBeCloseTo(0)
  })
  it('counts hidden parts, so the frame is the same whether or not a failure shows them', () => {
    const without = autoFrame([led1])!
    const withHidden = autoFrame([led1, { ...led2, hidden: true }])!
    expect(withHidden.size[0] + withHidden.size[1]).toBeGreaterThan(without.size[0] + without.size[1])
    expect(autoFrame([led1, { ...led2, hidden: false }])).toEqual(withHidden)
  })
})

describe('boardFrame / matFrame', () => {
  const board = (o: Partial<BoardSpec>): BoardSpec => ({ name: 'T', size: [16, 8], parts: [led1], ...o })
  it('manual frame wins', () => {
    const frame = { size: [5, 5] as [number, number], center: [1, 1] as [number, number] }
    expect(boardFrame(board({ base: 'breadboard-only', frame }))).toBe(frame)
    expect(matFrame(board({ base: 'breadboard-only', frame }))).toBe(frame)
  })
  it('falls back to the board size for boards with a PCB', () => {
    expect(boardFrame(board({ base: 'mat' }))).toEqual({ size: [16, 8] })
  })
  it('auto-frames breadboard-only boards', () => {
    const f = boardFrame(board({ base: 'breadboard-only' }))
    expect(f.size[0]).toBeLessThan(16)
    expect(f.center).toBeDefined()
  })
  it('the mat also covers the breadboard when auto-framed', () => {
    const bb = P({ id: 'bb', kind: 'breadboard', pos: [10, 4], mount: 'offboard' })
    const m = matFrame(board({ base: 'breadboard-only', parts: [bb, led1] }))
    expect(m.size[0]).toBeGreaterThanOrEqual(8.25)
    expect(m.size[1]).toBeGreaterThanOrEqual(5.5)
  })
})
