import { describe, expect, it } from 'vitest'
import { createBench } from '../engine/bench/simLoop'
import { getLesson } from '../lessons'
import { partState } from './Board'
import { stepperShaftAngle } from './parts/motion'

describe('stepper shaft angle from a behavior', () => {
  it('params.angleKey / rpmKey carry the published rotor angle and speed into the render state', () => {
    const lesson = getLesson('a4988-stepper')!
    const p = lesson.board.parts.find((x) => x.id === 'mot')!
    const b = createBench(lesson)
    const base = b.snapshot()
    const st = partState(lesson, p, { ...base, published: { 'a4988.shaft_deg': 123.4, 'a4988.rpm': 60 } })
    expect(st.value).toBe(123.4)
    expect(st.rpm).toBe(60)
    expect(partState(lesson, p, base).value).toBe(0)
    b.dispose()
  })

  it('extrapolates between snapshots at the published speed, at most 0.1 s ahead', () => {
    // 60 rpm = 360°/s: 50 ms after a 90° snapshot the shaft shows 108°
    expect(stepperShaftAngle(90, 60, 0.05)).toBeCloseTo((108 * Math.PI) / 180, 6)
    expect(stepperShaftAngle(90, 60, 1)).toBeCloseTo((126 * Math.PI) / 180, 6)
    expect(stepperShaftAngle(-45, 0, 0.3)).toBeCloseTo((-45 * Math.PI) / 180, 6)
  })
})
