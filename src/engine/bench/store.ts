// App state: the current lesson's bench (createBench), driven by requestAnimationFrame while it
// is live, plus persisted settings, progress and sketch text, and the toast queue.

import { create } from 'zustand'
import { setEffectsEnabled, sfx, startLofi, stopLofi, unlockAudio } from '../../audio/sound'
import { defaultLessonId, getLesson, lessons } from '../../lessons'
import type { SettingChange } from '../../ui/Controls'
import { PALETTES, type BenchAction, type Settings, type ToastMessage } from '../../ui/types'
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
  /** the lesson's starting tweak values (a momentary button's resting value) */
  tweakDefaults: Record<string, number>
  /** requested sim speed (sim seconds per real second) */
  speed: number
  /** the instrument panel (scope / strip chart) is open */
  instrumentsOpen: boolean
  toasts: ToastMessage[]
  setSpeed(x: number): void
  setInstrumentsOpen(open: boolean): void
  resetPeaks(): void
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

/** the raw parsed value under `key`, or undefined (missing, unreadable, blocked storage) */
export function loadRaw(key: string): unknown {
  try {
    const raw = globalThis.localStorage?.getItem(`${KEY}:${key}`)
    return raw ? (JSON.parse(raw) as unknown) : undefined
  } catch {
    return undefined
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** persisted settings → Settings, field by field (anything malformed falls back to the default) */
export function asSettings(v: unknown): Settings {
  const d = DEFAULT_SETTINGS
  if (!isRecord(v)) return { ...d }
  const bool = (x: unknown, f: boolean) => (typeof x === 'boolean' ? x : f)
  return {
    wobble: typeof v.wobble === 'number' && Number.isFinite(v.wobble) ? Math.min(1, Math.max(0, v.wobble)) : d.wobble,
    palette: PALETTES.some((p) => p.id === v.palette) ? (v.palette as Settings['palette']) : d.palette,
    labels: bool(v.labels, d.labels),
    lofi: bool(v.lofi, d.lofi),
    effects: bool(v.effects, d.effects),
  }
}

export function asProgress(v: unknown): Progress {
  if (!isRecord(v)) return { completed: [], quiz: {} }
  const completed = Array.isArray(v.completed) ? v.completed.filter((x): x is string => typeof x === 'string') : []
  const quiz: Progress['quiz'] = {}
  if (isRecord(v.quiz)) {
    for (const [id, q] of Object.entries(v.quiz)) {
      if (isRecord(q) && typeof q.score === 'number' && typeof q.total === 'number') quiz[id] = { score: q.score, total: q.total }
    }
  }
  return { completed, quiz }
}

export function asCode(v: unknown): Record<string, string> {
  if (!isRecord(v)) return {}
  return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string'))
}

/** call `fn` once `ms` have passed without another call (with the last arguments); `flush` runs it now */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): ((...args: A) => void) & { flush(): void } {
  let h: ReturnType<typeof setTimeout> | null = null
  let pending: A | null = null
  const run = () => {
    h = null
    if (pending) {
      const a = pending
      pending = null
      fn(...a)
    }
  }
  const d = (...args: A) => {
    pending = args
    if (h) clearTimeout(h)
    h = setTimeout(run, ms)
  }
  d.flush = () => {
    if (h) clearTimeout(h)
    run()
  }
  return d
}

const saveCode = debounce((code: Record<string, string>) => saveJSON('code', code), 400)

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
      speed: l.sim?.speed ?? 1,
      // keep a frame's stepping inside ~8 ms of wall clock so the page stays responsive
      stepBudgetMs: hasWindow ? 8 : undefined,
      onNote,
      onSnapshot: (snap) => set({ snap, tweaks: bench.tweakValues() }),
    })
    return bench.snapshot()
  }

  const initialId = (hasWindow && lessonFromHash(location.hash)) || defaultLessonId
  const lesson = getLesson(initialId) ?? lessons[0]
  const code = asCode(loadRaw('code'))
  const settings = asSettings(loadRaw('settings'))
  setEffectsEnabled(settings.effects)
  const snap = mount(lesson, code[lesson.id])

  return {
    lesson,
    snap,
    settings,
    progress: asProgress(loadRaw('progress')),
    code,
    tweaks: bench.tweakValues(),
    tweakDefaults: bench.tweakDefaults(),
    speed: lesson.sim?.speed ?? 1,
    instrumentsOpen: !!lesson.instruments?.open,
    toasts: [],

    setSpeed(x) {
      bench.setSpeed(x)
      set({ speed: x })
      kick()
    },

    setInstrumentsOpen(open) {
      set({ instrumentsOpen: open })
    },

    resetPeaks() {
      bench.resetPeaks()
      set({ snap: bench.snapshot() })
    },

    selectLesson(id) {
      const l = getLesson(id)
      if (!l || l.id === get().lesson.id) return
      if (hasWindow && lessonFromHash(location.hash) !== id) location.hash = `#/lesson/${id}`
      const snap = mount(l, get().code[l.id])
      set({
        lesson: l,
        snap,
        tweaks: bench.tweakValues(),
        tweakDefaults: bench.tweakDefaults(),
        speed: l.sim?.speed ?? 1,
        instrumentsOpen: !!l.instruments?.open || get().instrumentsOpen,
        toasts: [],
      })
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
      saveCode(code) // typing: save after 400 ms of quiet
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
      // a control of the previous lesson letting go on unmount (a held momentary button)
      if (!get().lesson.tweaks?.includes(t)) return
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
  // don't lose the last keystrokes of a sketch to the debounce
  window.addEventListener('pagehide', () => saveCode.flush())
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
