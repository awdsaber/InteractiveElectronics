import { afterEach, describe, expect, it, vi } from 'vitest'
import { lessonFromHash, loadJSON, saveJSON, useStore } from './store'

afterEach(() => vi.unstubAllGlobals())

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
