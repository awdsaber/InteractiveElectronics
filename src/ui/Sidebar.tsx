import type { Lesson, Track, TrackId } from '../engine/types'

export type LessonSummary = Pick<Lesson, 'id' | 'fig' | 'track' | 'title' | 'subtitle'>

export interface SidebarProps {
  tracks: Track[]
  lessons: LessonSummary[]
  activeId: string
  completed: string[]
  /** lesson ids pinned under "Start here" */
  pinned?: string[]
  onSelect: (lessonId: string) => void
  /** mobile drawer state; ignored on wide screens */
  open?: boolean
  onClose?: () => void
}

const fig = (n: number) => `Fig. ${String(n).padStart(2, '0')}`

export function Sidebar({ tracks, lessons, activeId, completed, pinned = [], onSelect, open = false, onClose }: SidebarProps) {
  const done = new Set(completed)
  const byTrack = (id: TrackId) => lessons.filter((l) => l.track === id)
  const pinnedLessons = pinned.map((id) => lessons.find((l) => l.id === id)).filter((l): l is LessonSummary => !!l)

  const item = (l: LessonSummary) => (
    <li key={l.id}>
      <button
        type="button"
        className="lesson-link"
        data-active={l.id === activeId}
        aria-current={l.id === activeId ? 'page' : undefined}
        onClick={() => {
          onSelect(l.id)
          onClose?.()
        }}
      >
        <span className="lesson-fig">{fig(l.fig)}</span>
        <span className="lesson-text">
          <span className="lesson-title">{l.title}</span>
          <span className="lesson-sub">{l.subtitle}</span>
        </span>
        <span className="lesson-check" aria-label={done.has(l.id) ? 'completed' : undefined}>
          {done.has(l.id) ? '✓' : ''}
        </span>
      </button>
    </li>
  )

  return (
    <>
      <div className="scrim" data-open={open} onClick={onClose} aria-hidden="true" />
      <aside className="sidebar" data-open={open} aria-label="Course syllabus">
        <div className="brand">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="2" y="2" width="28" height="28" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M6 16h6l2-6 4 12 2-6h6" fill="none" stroke="var(--blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="brand-name">Circuit Atelier</div>
            <div className="brand-tag">a field notebook for electronics</div>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close syllabus">
            ×
          </button>
        </div>
        <nav className="syllabus">
          {pinnedLessons.length > 0 && (
            <section className="track">
              <h2 className="track-head start">
                <span className="track-id">★</span> Start here
              </h2>
              <ul>{pinnedLessons.map(item)}</ul>
            </section>
          )}
          {tracks.map((t) => {
            const ls = byTrack(t.id)
            if (ls.length === 0) return null
            const n = ls.filter((l) => done.has(l.id)).length
            return (
              <section className="track" key={t.id}>
                <h2 className="track-head" title={t.blurb}>
                  <span className="track-id">{t.id}</span>
                  <span className="track-name">{t.name}</span>
                  <span className="track-count">
                    {n}/{ls.length}
                  </span>
                </h2>
                <ul>{ls.map(item)}</ul>
              </section>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
