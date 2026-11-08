import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Lesson, Tweak } from '../engine/types'
import { BenchActions } from './BenchActions'
import type { BenchActionsProps } from './BenchActions'
import { Controls } from './Controls'
import type { ControlsProps, SettingChange } from './Controls'
import { MeetTheBoard } from './MeetTheBoard'
import { Quiz } from './Quiz'
import { Sidebar } from './Sidebar'
import type { SidebarProps } from './Sidebar'
import { StatusLine } from './StatusLine'
import type { StatusLineProps } from './StatusLine'
import { StatusPanel } from './StatusPanel'
import type { StatusPanelProps } from './StatusPanel'
import { Toast } from './Toast'
import { Tweaks } from './Tweaks'
import type { Settings, ToastMessage } from './types'

// CodeMirror is heavy: the editor loads as its own chunk.
const TryItYourself = lazy(() => import('./TryItYourself').then((m) => ({ default: m.TryItYourself })))

function EditorFallback() {
  return (
    <section className="note" aria-labelledby="try-h" aria-busy="true">
      <h2 id="try-h" className="note-head">
        <span>B</span> Try it yourself
      </h2>
      <p className="muted">Loading the editor…</p>
    </section>
  )
}

export interface LayoutProps {
  lesson: Lesson
  syllabus: Omit<SidebarProps, 'open' | 'onClose'>
  /** the 3D canvas goes here */
  children: ReactNode
  actions: BenchActionsProps
  panel: StatusPanelProps
  statusLine: StatusLineProps
  settings: Settings
  onSetting: (change: SettingChange) => void
  code: string
  onCodeChange: (code: string) => void
  onUpload: (code: string) => void
  serialLines: string[]
  sketchError?: string | null
  tweakValues: Record<string, number>
  /** the lesson's starting tweak values (momentary buttons rest there) */
  tweakDefaults?: Record<string, number>
  /** sim speed and the instruments toggle in the controls strip */
  benchControls?: Pick<ControlsProps, 'sim' | 'instruments'>
  /** the instrument panel, rendered under the controls strip while open */
  instruments?: ReactNode
  onTweak: (tweak: Tweak, value: number) => void
  onQuizComplete: (score: number, total: number) => void
  onQuizAnswer?: (correct: boolean) => void
  toasts: ToastMessage[]
  onDismissToast: (id: number) => void
}

export function Layout(p: LayoutProps) {
  const [drawer, setDrawer] = useState(false)
  const burger = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const { lesson } = p

  // drawer: focus moves into it on open and back to the burger on close; Escape closes it from anywhere
  useEffect(() => {
    if (drawer) {
      wasOpen.current = true
      const t = setTimeout(() => {
        const el = document.querySelector<HTMLElement>('.sidebar[data-open="true"] .drawer-close, .sidebar[data-open="true"] .lesson-link')
        el?.focus()
      }, 0)
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setDrawer(false)
      }
      document.addEventListener('keydown', onKey)
      return () => {
        clearTimeout(t)
        document.removeEventListener('keydown', onKey)
      }
    }
    if (wasOpen.current) {
      wasOpen.current = false
      burger.current?.focus()
    }
  }, [drawer])
  return (
    <div className="shell">
      <Sidebar {...p.syllabus} open={drawer} onClose={() => setDrawer(false)} />
      <div className="main">
        <header className="topbar">
          <button ref={burger} type="button" className="burger" aria-expanded={drawer} onClick={() => setDrawer(true)} aria-label="Open syllabus">
            <span /><span /><span />
          </button>
          <span className="topbar-name">Circuit Atelier</span>
          <span className="topbar-fig">Fig. {String(lesson.fig).padStart(2, '0')}</span>
        </header>

        <div className="bench-head">
          <div>
            <p className="eyebrow">
              {lesson.track} · Fig. {String(lesson.fig).padStart(2, '0')}
            </p>
            <h1>{lesson.title}</h1>
          </div>
          <p className="tagline">{lesson.tagline}</p>
        </div>

        <section className="bench" aria-label="Workbench">
          <div className="bench-stage">
            <div className="bench-slot">{p.children}</div>
            <div className="bench-overlay-left">
              <BenchActions {...p.actions} />
            </div>
            <div className="bench-overlay-right">
              <StatusPanel {...p.panel} />
            </div>
          </div>
          <StatusLine {...p.statusLine} />
          <Controls settings={p.settings} onSetting={p.onSetting} {...p.benchControls} />
          {p.instruments}
        </section>

        <div className="notes">
          <MeetTheBoard meet={lesson.meet} mechanicalAnalogy={lesson.mechanicalAnalogy} proTips={lesson.proTips} />
          {lesson.sketch ? (
            <div className="note-stack">
              <Suspense fallback={<EditorFallback />}>
                <TryItYourself
                  sketch={lesson.sketch}
                  code={p.code}
                  onCodeChange={p.onCodeChange}
                  onUpload={p.onUpload}
                  uploadDisabled={!p.actions.powered}
                  serialLines={p.serialLines}
                  error={p.sketchError}
                />
              </Suspense>
              {lesson.tweaks?.length ? <Tweaks tweaks={lesson.tweaks} values={p.tweakValues} defaults={p.tweakDefaults} onTweak={p.onTweak} /> : null}
            </div>
          ) : lesson.tweaks?.length ? (
            <Tweaks tweaks={lesson.tweaks} values={p.tweakValues} defaults={p.tweakDefaults} onTweak={p.onTweak} />
          ) : (
            <section className="note">
              <h2 className="note-head"><span>B</span> Try it yourself</h2>
              <p className="muted">This lesson is hands-on at the bench: use the buttons above.</p>
            </section>
          )}
          <Quiz key={lesson.id} items={lesson.quiz} onComplete={p.onQuizComplete} onAnswer={p.onQuizAnswer} />
        </div>
        <footer className="foot">Circuit Atelier · drawn and wired by hand</footer>
      </div>
      <Toast toasts={p.toasts} onDismiss={p.onDismissToast} />
    </div>
  )
}
