import { describe, expect, it } from 'vitest'
import type { Tweak } from '../types'
import { momentaryValues, snapTweak, tweakAssignments, tweakTargets, isOn } from './tweaks'

const base = { label: 't', elementId: 'R1', key: 'value', unit: 'Ω' }

describe('snapTweak', () => {
  it('slider: clamps to min..max and snaps to step', () => {
    const t: Tweak = { ...base, min: 0, max: 10, step: 0.5 }
    expect(snapTweak(t, 3.3)).toBe(3.5)
    expect(snapTweak(t, -1)).toBe(0)
    expect(snapTweak(t, 99)).toBe(10)
    expect(snapTweak({ ...base, min: 100, max: 1e4, log: true }, 470)).toBe(470) // log sliders don't snap
  })

  it('toggle and momentary: only min or max', () => {
    const t: Tweak = { ...base, kind: 'toggle', min: 0, max: 1 }
    expect(snapTweak(t, 0.7)).toBe(1)
    expect(snapTweak(t, 0.2)).toBe(0)
    expect(snapTweak({ ...t, kind: 'momentary' }, 1)).toBe(1)
  })

  it('enum: the nearest option value', () => {
    const t: Tweak = {
      ...base,
      kind: 'enum',
      min: 0,
      max: 1000,
      options: [
        { label: '10', value: 10 },
        { label: '100', value: 100 },
        { label: '1k', value: 1000 },
      ],
    }
    expect(snapTweak(t, 90)).toBe(100)
    expect(snapTweak(t, 600)).toBe(1000)
    expect(snapTweak(t, -5)).toBe(10)
  })

  it('NaN falls back to min', () => {
    expect(snapTweak({ ...base, min: 2, max: 5 }, NaN)).toBe(2)
  })
})

describe('isOn', () => {
  it('a toggle reads on in the upper half', () => {
    const t: Tweak = { ...base, kind: 'toggle', min: 0, max: 1 }
    expect(isOn(t, 1)).toBe(true)
    expect(isOn(t, 0)).toBe(false)
  })
})

describe('momentaryValues', () => {
  const t: Tweak = { ...base, elementId: 'SW', key: 'closed', kind: 'momentary', min: 0, max: 1 }
  it('normally open: rests at the circuit value 0, held = 1', () => {
    expect(momentaryValues(t, 0)).toEqual({ rest: 0, held: 1 })
  })
  it('normally closed: rests at 1, held = 0', () => {
    expect(momentaryValues(t, 1)).toEqual({ rest: 1, held: 0 })
  })
  it('a rest value between the ends: held = max', () => {
    expect(momentaryValues({ ...t, max: 5 }, 2)).toEqual({ rest: 2, held: 5 })
  })
})

describe('ganged tweaks (link)', () => {
  const t: Tweak = {
    ...base,
    min: 1e3,
    max: 1e6,
    log: true,
    link: [
      { elementId: 'R2', key: 'value' },
      { elementId: 'behavior:meter', key: 'r', scale: 2 },
    ],
  }

  it('targets: the tweak itself, then its links (scale defaults to 1)', () => {
    expect(tweakTargets(t)).toEqual([
      { elementId: 'R1', key: 'value', scale: 1 },
      { elementId: 'R2', key: 'value', scale: 1 },
      { elementId: 'behavior:meter', key: 'r', scale: 2 },
    ])
  })

  it('assignments: every target of every tweak with its value × scale', () => {
    const other: Tweak = { ...base, elementId: 'C1', min: 0, max: 1 }
    expect(tweakAssignments([t, other], { 'R1.value': 4700, 'C1.value': 0.5 })).toEqual([
      { elementId: 'R1', key: 'value', value: 4700 },
      { elementId: 'R2', key: 'value', value: 4700 },
      { elementId: 'behavior:meter', key: 'r', value: 9400 },
      { elementId: 'C1', key: 'value', value: 0.5 },
    ])
  })

  it('a tweak with no value yet assigns nothing', () => {
    expect(tweakAssignments([t], {})).toEqual([])
  })
})
