// App state: the current lesson's bench (createBench), driven by requestAnimationFrame while it
// is live, plus persisted settings, progress and sketch text, and the toast queue.

import { create } from 'zustand'
import { setEffectsEnabled, sfx, startLofi, stopLofi, unlockAudio } from '../../audio/sound'
import { defaultLessonId, getLesson, lessons } from '../../lessons'
import type { SettingChange } from '../../ui/Controls'
import type { BenchAction, Settings, ToastMessage } from '../../ui/types'
import type { Lesson, Tweak } from '../types'
import type { Note } from './assembly'
import { type Bench, type BenchSnapshot, createBench, tweakKey } from './simLoop'

export interface Progress {
  completed: string[]
  quiz: Record<string, { score: number; total: number }>
}

export interface AppState {
  lesson: Lesson
  snap: BenchSnapshot
  settings: Settings
  progress: Progress
  /** sketch text per lesson id (only edited ones) */
  code: Record<string, string>
  tweaks: Record<string, number>
  toasts: ToastMessage[]
  selectLesson(id: string): void
  act(a: BenchAction): void
  setSetting(c: SettingChange): void
  setCode(code: string): void
  upload(code: string): void
  setTweak(t: Tweak, value: number): void
  completeQuiz(score: number, total: number): void
  toast(text: string, tone?: ToastMessage['tone']): void
  dismissToast(id: number): void
}

const KEY = 'circuit-atelier'
export const DEFAULT_SETTINGS: Settings = { wobble: 0.35, palette: 'green', labels: true, lofi: false, effects: true }

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(`${KEY}:${key}`)
    if (!raw) return fallback
    const v = JSON.parse(raw) as unknown
    return v && typeof v === 'object' ? ({ ...fallback, ...(v as object) } as T) : fallback
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(`${KEY}:${key}`, JSON.stringify(value))
  } catch {
    // storage full or blocked (private mode): progress just isn't kept
  }
}

/** `#/lesson/<id>` → id (when it names a lesson) */
export function lessonFromHash(hash: string): string | null {
  const m = /^#\/lesson\/([a-z0-9-]+)/.exec(hash)
  return m && getLesson(m[1]) ? m[1] : null
}

const hasWindow = typeof window !== 'undefined'

let bench: Bench
let raf = 0
let last = 0
let toastSeq = 1

export const useStore = create<AppState>()((set, get) => {
  const onNote = (n: Note) => {
    if (n.sound) sfx(n.sound, n.sound === 'pop' ? 0.8 : 0.5)
    get().toast(n.text, n.tone)
  }

  function loop(now: number) {
    raf = 0
    const dt = last ? (now - last) / 1000 : 1 / 60
    last = now
    void bench.frame(dt)
    if (bench.needsFrames()) raf = requestAnimationFrame(loop)
    else last = 0
  }

  function kick() {
    if (!hasWindow || raf || !bench.needsFrames()) return
    last = 0
    raf = requestAnimationFrame(loop)
  }

  function mount(l: Lesson, code: string | undefined): BenchSnapshot {
    bench?.dispose()
    if (raf && hasWindow) cancelAnimationFrame(raf)
    raf = 0
    bench = createBench(l, {
      code,
      onNote,
      onSnapshot: (snap) => set({ snap, tweaks: bench.tweakValues() }),
    })
    return bench.snapshot()
  }

  const initialId = (hasWindow && lessonFromHash(location.hash)) || defaultLessonId
  const lesson = getLesson(initialId) ?? lessons[0]
  const code = loadJSON<Record<string, string>>('code', {})
  const settings = loadJSON<Settings>('settings', DEFAULT_SETTINGS)
  setEffectsEnabled(settings.effects)
  const snap = mount(lesson, code[lesson.id])

  return {
    lesson,
    snap,
    settings,
    progress: loadJSON<Progress>('progress', { completed: [], quiz: {} }),
    code,
    tweaks: bench.tweakValues(),
    toasts: [],

    selectLesson(id) {
      const l = getLesson(id)
      if (!l || l.id === get().lesson.id) return
      if (hasWindow && lessonFromHash(location.hash) !== id) location.hash = `#/lesson/${id}`
      const snap = mount(l, get().code[l.id])
      set({ lesson: l, snap, tweaks: bench.tweakValues(), toasts: [] })
    },

    act(a) {
      unlockAudio()
      bench.dispatch(a)
      set({ snap: bench.snapshot() })
      kick()
    },

    setSetting(c) {
      unlockAudio()
      const settings = { ...get().settings, [c.key]: c.value } as Settings
      if (c.key === 'lofi') {
        if (c.value) startLofi()
        else stopLofi()
      }
      if (c.key === 'effects') setEffectsEnabled(c.value)
      saveJSON('settings', settings)
      set({ settings })
    },

    setCode(text) {
      bench.setCode(text)
      const code = { ...get().code, [get().lesson.id]: text }
      saveJSON('code', code)
      set({ code })
    },

    upload(text) {
      get().setCode(text)
      unlockAudio()
      bench.upload(text)
      set({ snap: bench.snapshot() })
      kick()
    },

    setTweak(t, value) {
      bench.setTweak(tweakKey(t), value)
      set({ snap: bench.snapshot(), tweaks: bench.tweakValues() })
    },

    completeQuiz(score, total) {
      const id = get().lesson.id
      const p = get().progress
      const progress: Progress = {
        completed: p.completed.includes(id) ? p.completed : [...p.completed, id],
        quiz: { ...p.quiz, [id]: { score, total } },
      }
      saveJSON('progress', progress)
      set({ progress })
      sfx('success')
      get().toast(`Quiz done: ${score}/${total} first try. Lesson marked complete.`, 'ok')
    },

    toast(text, tone = 'info') {
      set((s) => ({ toasts: [...s.toasts.slice(-2), { id: toastSeq++, text, tone }] }))
    },

    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    },
  }
})

if (hasWindow) {
  window.addEventListener('hashchange', () => {
    const id = lessonFromHash(location.hash)
    if (id) useStore.getState().selectLesson(id)
  })
  // the lo-fi loop needs a user gesture before it can start
  window.addEventListener(
    'pointerdown',
    () => {
      unlockAudio()
      if (useStore.getState().settings.lofi) startLofi()
    },
    { once: true },
  )
}

/** for tests and the e2e harness */
export const getBench = (): Bench => bench
