import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, asCode, asProgress, asSettings, debounce, lessonFromHash, loadJSON, saveJSON, useStore } from './store'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('persisted shapes are validated', () => {
  it('settings: bad fields fall back one by one', () => {
    expect(asSettings({ wobble: 2, palette: 'pink', labels: 'yes', lofi: true, effects: false })).toEqual({
      ...DEFAULT_SETTINGS,
      wobble: 1,
      lofi: true,
      effects: false,
    })
    expect(asSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(asSettings([1, 2])).toEqual(DEFAULT_SETTINGS)
  })

  it('progress: keeps only string ids and numeric scores', () => {
    expect(asProgress({ completed: ['a', 3, null], quiz: { a: { score: 2, total: 4 }, b: { score: 'x' }, c: 7 } })).toEqual({
      completed: ['a'],
      quiz: { a: { score: 2, total: 4 } },
    })
    expect(asProgress('nope')).toEqual({ completed: [], quiz: {} })
  })

  it('code: keeps only string sketches', () => {
    expect(asCode({ a: 'void setup(){}', b: 5 })).toEqual({ a: 'void setup(){}' })
    expect(asCode(undefined)).toEqual({})
  })

  it('debounce waits for 400 ms of quiet and keeps the last call', () => {
    vi.useFakeTimers()
    const calls: number[] = []
    const d = debounce((n: number) => calls.push(n), 400)
    d(1)
    vi.advanceTimersByTime(300)
    d(2)
    vi.advanceTimersByTime(399)
    expect(calls).toEqual([])
    vi.advanceTimersByTime(1)
    expect(calls).toEqual([2])
  })
})

describe('store persistence', () => {
  it('survives a localStorage that throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    })
    expect(loadJSON('settings', { a: 1 })).toEqual({ a: 1 })
    expect(() => saveJSON('settings', { a: 2 })).not.toThrow()
  })

  it('round-trips and merges over defaults', () => {
    const mem = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) })
    saveJSON('progress', { completed: ['led-resistor'] })
    expect(loadJSON('progress', { completed: [], quiz: {} })).toEqual({ completed: ['led-resistor'], quiz: {} })
    mem.set('circuit-atelier:progress', '{not json')
    expect(loadJSON('progress', { completed: [] })).toEqual({ completed: [] })
  })

  it('reads the lesson from the hash', () => {
    expect(lessonFromHash('#/lesson/led-resistor')).toBe('led-resistor')
    expect(lessonFromHash('#/lesson/nope')).toBeNull()
    expect(lessonFromHash('')).toBeNull()
  })
})

describe('store actions', () => {
  it('drives the bench and records progress', () => {
    const s = useStore.getState()
    expect(s.lesson.id).toBe('led-resistor')
    s.act('strip')
    expect(useStore.getState().snap.status).toBe('BARE PCB')
    s.act('power')
    expect(useStore.getState().toasts.at(-1)?.text).toMatch(/^Power needs/)
    s.act('place-all')
    s.act('power')
    expect(useStore.getState().snap.status).toBe('POWERED')
    s.setTweak(s.lesson.tweaks![0], 330)
    expect(useStore.getState().tweaks['R1.value']).toBe(330)
    s.completeQuiz(3, 4)
    expect(useStore.getState().progress.completed).toContain('led-resistor')
    expect(useStore.getState().progress.quiz['led-resistor']).toEqual({ score: 3, total: 4 })
  })
})
