// pcb-design-workflow: the bench flow, the curriculum's key numbers, the failures, and the layer data's
// DRC (the deliberate violations, and that the behavior's static count agrees with the real check).
import { describe, expect, it } from 'vitest'
import { createBench } from '../../engine/bench/simLoop'
import { runDrc } from '../../engine/pcb/drc'
import { ipcRise, ipcWidthMm, traceResistance } from '../../engine/pcb/ipc2221'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { padResolver } from '../../three/pcbPads'
import { getLesson } from '../index'
import { LAYERS, PWR_LENGTH_MM, STATIC_DRC_ERRORS } from './pcb-design-workflow'

const L = getLesson('pcb-design-workflow') as Lesson
const near = (v: number, want: number, tol = 0.15) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * tol)

async function run(b: ReturnType<typeof createBench>, sec: number) {
  for (let i = 0; i < Math.round(sec * 60); i++) await b.frame(1 / 60)
  return b.snapshot()
}

describe('pcb-design-workflow', () => {
  it('validates', () => {
    expect(validateLesson(L)).toEqual([])
  })

  it('IPC-2221 figures in the curriculum: 1 A → 0.30 mm, 2 A → 0.78 mm (1 oz, 10 °C rise)', () => {
    expect(ipcWidthMm(1, 10, 1)).toBeCloseTo(0.3, 2)
    expect(ipcWidthMm(2, 10, 1)).toBeCloseTo(0.78, 2)
    near(PWR_LENGTH_MM, 61, 0.03)
  })

  describe('DRC on the layer data', () => {
    const padAt = padResolver(L.board.parts)
    const live = (w: number) => (k: string) => ({ 'tr.widthMm': w, 'load.iSet': 2, 'tr.oz': 1 })[k]

    it('the default board has the four deliberate violations', () => {
      const v = runDrc(LAYERS, { param: live(0.3), padAt })
      expect(v.map((x) => x.id).sort()).toEqual(['clearance:SCK:MISO', 'decoupling:c2', 'thermal-relief:j2:1', 'trace-width:PWR'])
      const gap = v.find((x) => x.rule === 'clearance')!
      expect(gap.value).toBeCloseTo(0.1, 2)
      expect(gap.limit).toBe(0.15)
      near(v.find((x) => x.rule === 'decoupling')!.value, 14, 0.1)
      expect(v.find((x) => x.rule === 'trace-width')!.limit).toBeCloseTo(0.78, 2)
    })

    it('0.80 mm clears the trace rule; the static count matches the pcb-tour param', () => {
      const v = runDrc(LAYERS, { param: live(0.8), padAt })
      expect(v).toHaveLength(STATIC_DRC_ERRORS)
      expect(v.some((x) => x.rule === 'trace-width')).toBe(false)
      const tour = L.behaviors!.find((b) => typeof b !== 'string' && b.id === 'pcb-tour')
      expect(typeof tour !== 'string' && tour?.params?.staticErrors).toBe(STATIC_DRC_ERRORS)
    })

    it('C1 sits within 3 mm of its VCC pin', () => {
      const v = runDrc(LAYERS, { param: live(0.8), padAt })
      expect(v.some((x) => x.id === 'decoupling:c1')).toBe(false)
    })
  })

  it('bench flow: 2 A, 0.30 mm runs about 73 °C, 0.80 mm about 35 °C with ≈ 80 mV drop; DRC 4 → 3', async () => {
    const b = createBench(L)
    b.dispatch('power')
    let s = await run(b, 10)
    expect(s.status).toBe('POWERED')
    near(s.values[0], 2, 0.02)
    near(s.values[1], 25 + ipcRise(2, 0.3, 1))
    near(s.values[1], 73)
    expect(s.values[3]).toBeCloseTo(0.78, 2)
    expect(s.values[8]).toBe(4)
    near(s.values[9], (12 - 1.8) / 4700, 0.15)
    b.setTweak('behavior:tr.widthMm', 0.8)
    s = await run(b, 10)
    near(s.values[1], 35, 0.1)
    expect(s.values[8]).toBe(3)
    near(s.values[5], traceResistance(PWR_LENGTH_MM, 0.8, 1, 35))
    near(s.values[6], 0.08)
    near(s.values[7], 4 * traceResistance(PWR_LENGTH_MM, 0.8, 1, 35))
    // 2 oz copper: the width needed halves
    b.setTweak('behavior:tr.oz', 2)
    s = await run(b, 2)
    expect(s.values[3]).toBeCloseTo(0.39, 2)
    b.dispose()
  })

  it('F1: a 0.10 mm feed burns open within seconds and the load current drops to 0', async () => {
    const b = createBench(L)
    b.dispatch('power')
    await run(b, 1)
    b.dispatch('break:thin-trace')
    const s = await run(b, 10)
    expect(s.status).toBe('FAULT')
    expect(s.assembly.burns.map((x) => x.elementId)).toEqual(['TRACE'])
    expect(s.values[0]).toBeLessThan(0.01)
    b.dispatch('repair')
    const r = await run(b, 2)
    expect(r.status).toBe('POWERED')
    near(r.values[0], 2, 0.02)
    b.dispose()
  })

  it('F2: a cold J2 ground joint (0.5 Ω, illustrative) loses about 1 V at 2 A', async () => {
    const b = createBench(L)
    b.dispatch('power')
    await run(b, 1)
    b.dispatch('break:cold-joint')
    const s = await run(b, 2)
    near(s.values[10], 1)
    near(s.values[0], 2, 0.02)
    b.dispose()
  })
})
