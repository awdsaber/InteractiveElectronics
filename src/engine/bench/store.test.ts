import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultLessonId, lessons } from '../../lessons'
import { DEFAULT_SETTINGS, asCode, asGuideSaves, asProgress, asSettings, debounce, lessonFromHash, loadJSON, saveJSON, useStore } from './store'

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
    expect(useStore.getState().lesson.id).toBe(defaultLessonId)
    useStore.getState().selectLesson('led-resistor')
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

describe('part inspector selection', () => {
  it('selects a part of the lesson, ignores unknown ids, clears on close and on lesson change', () => {
    useStore.getState().selectLesson('resistor-codes-divider') // a lesson with parts r1 and r2
    expect(useStore.getState().selectedPart).toBeNull()
    useStore.getState().selectPart('r1')
    expect(useStore.getState().selectedPart).toBe('r1')
    useStore.getState().selectPart('no-such-part')
    expect(useStore.getState().selectedPart).toBe('r1')
    useStore.getState().selectPart(null)
    expect(useStore.getState().selectedPart).toBeNull()
    useStore.getState().selectPart('r2')
    useStore.getState().selectLesson('led-resistor')
    expect(useStore.getState().selectedPart).toBeNull()
  })

  it('zoom to part and reset view are camera requests; selecting alone never moves the camera', () => {
    useStore.getState().selectLesson('resistor-codes-divider') // a lesson with part r1
    const v0 = useStore.getState().view
    expect(v0.partId).toBeNull()
    useStore.getState().selectPart('r1')
    expect(useStore.getState().view).toBe(v0)
    useStore.getState().zoomToPart('r1')
    expect(useStore.getState().view).toEqual({ partId: 'r1', seq: v0.seq + 1 })
    useStore.getState().resetView()
    expect(useStore.getState().view).toEqual({ partId: null, seq: v0.seq + 2 })
    useStore.getState().zoomToPart('r1')
    useStore.getState().selectLesson('led-resistor')
    expect(useStore.getState().view.partId).toBeNull()
  })
})

describe('guided steps in the store', () => {
  it('records bench actions and inspector opens as guide events, advances, and saves progress per lesson', () => {
    const saved: Record<string, string> = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => saved[k] ?? null, setItem: (k: string, v: string) => (saved[k] = v) })
    useStore.getState().selectLesson('ohms-law')
    useStore.getState().selectLesson('led-resistor')
    useStore.getState().guideRestart()
    let s = useStore.getState()
    expect(s.guideMode).toBe('guided')
    expect(s.guide).toMatchObject({ current: 0, total: s.lesson.guide!.length })
    s.selectPart('r1') // step 1: inspect the resistor
    s = useStore.getState()
    expect(s.guide).toMatchObject({ current: 1, done: ['meet-the-resistor'] })
    expect(JSON.parse(saved['circuit-atelier:guide'])['led-resistor']).toEqual({ current: 1, done: ['meet-the-resistor'], mode: 'guided' })
    s.act('power') // step 2: power + POWERED
    expect(useStore.getState().guide?.current).toBe(2)
    s.guideBack()
    expect(useStore.getState().guide).toMatchObject({ current: 1, done: ['meet-the-resistor'] })
    s.guideSkip()
    expect(useStore.getState().guide?.current).toBe(2)
  })

  it('free explore pauses the guide; a lesson without a guide has none', () => {
    useStore.getState().selectLesson('ohms-law')
    useStore.getState().selectLesson('led-resistor')
    useStore.getState().guideRestart()
    useStore.getState().setGuideMode('free')
    useStore.getState().selectPart('r1')
    expect(useStore.getState().guide?.current).toBe(0)
    useStore.getState().setGuideMode('guided')
    // the inspector is still open on r1, so the step passes as soon as the guide resumes
    expect(useStore.getState().guide?.current).toBe(1)
    useStore.getState().selectLesson(lessons.find((l) => !l.guide)!.id) // any lesson that has no guide yet
    expect(useStore.getState().guide).toBeNull()
    expect(useStore.getState().guideMode).toBe('free')
  })

  it('asGuideSaves keeps well-formed entries only', () => {
    expect(asGuideSaves({ a: { current: 2, done: ['x', 3], mode: 'free' }, b: { current: 'x' }, c: 4 })).toEqual({
      a: { current: 2, done: ['x'], mode: 'free' },
    })
    expect(asGuideSaves(null)).toEqual({})
  })
})
