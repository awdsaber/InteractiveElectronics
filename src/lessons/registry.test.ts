import { describe, expect, it } from 'vitest'
import { createBench } from '../engine/bench/simLoop'
import { validateLesson } from '../engine/lessonSchema'
import type { Lesson } from '../engine/types'
import { breadboardHole } from '../three/parts/boards'
import { BENCH_Y as BENCH_Y_3D } from '../three/parts/types'
import { ledResistor } from './T2/led-resistor'
import { getLesson, lessons, pinned, tracks } from './index'
import { BENCH_Y, bbHole } from './layout'

describe('lesson registry', () => {
  it('has the eight tracks and unique lesson ids', () => {
    expect(tracks.map((t) => t.id)).toEqual(['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'])
    const ids = lessons.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(lessons.map((l) => l.fig)).size).toBe(lessons.length)
  })

  it('pins led-resistor until arduino-uno exists, and keeps its video figure', () => {
    expect(pinned).toEqual([getLesson('arduino-uno') ? 'arduino-uno' : 'led-resistor'])
    expect(getLesson('led-resistor')?.fig).toBe(2)
  })

  for (const l of lessons) {
    describe(l.id, () => {
      it('validates', () => {
        expect(validateLesson(l)).toEqual([])
      })

      it('reaches RUNNING or POWERED headless', async () => {
        const b = createBench(l)
        if (b.snapshot().status !== 'READY') b.dispatch('place-all')
        b.dispatch('pick-place')
        b.dispatch('place-all')
        b.dispatch('solder')
        b.dispatch('power')
        if (l.sketch) b.upload()
        for (let i = 0; i < 30; i++) await b.frame(1 / 60)
        const s = b.snapshot()
        expect(s.sketchError).toBeNull()
        expect(s.status).toBe(l.sketch ? 'RUNNING' : 'POWERED')
        b.dispose()
      })
    })
  }
})

describe('validateLesson cross-references', () => {
  const base = getLesson('led-resistor') as Lesson
  const bad = (patch: (l: Lesson) => void) => {
    const l = structuredClone(base)
    patch(l)
    return validateLesson(l).join('\n')
  }

  it('catches a missing circuitId, power element, readout, tweak and patch target', () => {
    expect(bad((l) => (l.board.parts[0].circuitIds = ['NOPE']))).toMatch(/circuitIds: no element "NOPE"/)
    expect(bad((l) => (l.powerElementId = 'V9'))).toMatch(/power: no element "V9"/)
    expect(bad((l) => (l.readouts[0].source = { kind: 'current', elementId: 'X' }))).toMatch(/readouts.0: no element "X"/)
    expect(bad((l) => (l.tweaks![0].elementId = 'R9'))).toMatch(/tweaks.0: no element "R9"/)
    expect(bad((l) => (l.tweaks![0].elementId = 'behavior:ghost'))).toMatch(/no behavior instance "ghost"/)
    expect(bad((l) => (l.failures[1].patches = [{ op: 'set', elementId: 'R7', key: 'value', value: 1 }]))).toMatch(/no element "R7"/)
  })

  it('catches a quiz answer out of range, duplicate parts and a sketch pin that is not a PIN', () => {
    expect(bad((l) => (l.quiz[0].answer = 9))).toMatch(/quiz.0: answer 9 out of range/)
    expect(bad((l) => (l.board.parts[1].id = l.board.parts[0].id))).toMatch(/duplicate part id "uno"/)
    expect(bad((l) => (l.sketch!.pins = { 13: 'R1' }))).toMatch(/"R1" is a R, not a PIN/)
  })

  it('catches schema errors with a path', () => {
    expect(bad((l) => ((l.board.parts[0] as { kind: string }).kind = 'flux-capacitor'))).toMatch(/board.parts.0.kind/)
    expect(bad((l) => ((l as { fig: unknown }).fig = 'two'))).toMatch(/^fig:/)
  })
})

describe('lesson layout helpers', () => {
  it('match the 3D breadboard geometry', () => {
    expect(BENCH_Y).toBeCloseTo(BENCH_Y_3D, 9)
    for (const [c, r] of [[1, 'a'], [17, 'e'], [30, 'j'], [5, '+t'], [9, '-b']] as const) {
      const [x, y, z] = breadboardHole(c, r)
      const w = bbHole([1, 2], c, r)
      expect(w[0]).toBeCloseTo(x + 1, 9)
      expect(w[1]).toBeCloseTo(BENCH_Y_3D + y, 9)
      expect(w[2]).toBeCloseTo(z + 2, 9)
    }
  })

  it('put the LED anode and R1 in the same breadboard column', () => {
    const parts = ledResistor.board.parts
    const led = parts.find((p) => p.id === 'led1')!.pos
    const r1 = parts.find((p) => p.id === 'r1')!.pos
    // LED anode is at +x (0.127), R1's left lead at -0.508
    expect(led[0] + 0.127).toBeCloseTo(r1[0] - 0.508, 6)
  })
})
