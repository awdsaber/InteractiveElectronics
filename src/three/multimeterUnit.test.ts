import { describe, expect, it } from 'vitest'
import { createBench } from '../engine/bench/simLoop'
import { getLesson } from '../lessons'
import { partState } from './Board'
import { multimeterMode } from './parts/misc'

describe('multimeter LCD unit hook (params.autoUnit)', () => {
  const lesson = getLesson('ohms-law')!
  const meter = lesson.board.parts.find((x) => x.id === 'meter')!

  it('takes the unit, with its SI prefix, from the bound readout', async () => {
    const b = createBench(lesson)
    b.dispatch('power')
    for (let i = 0; i < 20; i++) await b.frame(1 / 60)
    const st = partState(lesson, meter, b.snapshot())
    expect(st.reading).toBe('5.00')
    expect(st.readingUnit).toBe('mA')
    b.setTweak('V_PSU.value', 0.5)
    b.setTweak('R1.value', 10000)
    for (let i = 0; i < 20; i++) await b.frame(1 / 60)
    expect(partState(lesson, meter, b.snapshot()).readingUnit).toBe('µA')
    b.dispose()
  })

  it('is left unset without autoUnit, so other meters keep params.unit', () => {
    const b = createBench(lesson)
    const plain = { ...meter, params: { ...meter.params, autoUnit: undefined } }
    expect(partState(lesson, plain, b.snapshot()).readingUnit).toBeUndefined()
    b.dispose()
  })

  it('derives the dial mode from the last character of the unit', () => {
    expect(multimeterMode('mA')).toBe('A')
    expect(multimeterMode('µA')).toBe('A')
    expect(multimeterMode('A')).toBe('A')
    expect(multimeterMode('mV')).toBe('V')
    expect(multimeterMode('V')).toBe('V')
    expect(multimeterMode('kΩ')).toBe('R')
    expect(multimeterMode('Ω')).toBe('R')
  })
})
