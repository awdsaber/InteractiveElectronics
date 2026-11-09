// The Guide: a notebook-margin card above the bench (a sticky top sheet on phones) that walks a
// lesson's `guide` steps. It shows the active step, a progress rule, a hint that offers itself
// after a while, back / skip / restart, the explain of the step just finished, and a focus
// highlight on the control the step is about (via `data-guide` attributes on the bench UI).
import { useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'
import type { GuideState } from '../engine/guide'
import type { GuideStep } from '../engine/types'
import { RadioSeg } from './RadioSeg'

export type GuideMode = 'guided' | 'free'

export interface GuidePanelProps {
  steps: readonly GuideStep[]
  state: GuideState
  mode: GuideMode
  onMode: (m: GuideMode) => void
  onBack: () => void
  onSkip: () => void
  onRestart: () => void
  /** a manual step's "I've done this" */
  onConfirm: () => void
  /** frame a board part in the camera ("Show me" on a step that focuses a part) */
  onShowPart?: (id: string) => void
  /** ms on a step before the hint offers itself (default 20 s) */
  hintAfterMs?: number
}

const renderer = new marked.Renderer()
renderer.html = ({ text }) => text.replace(/</g, '&lt;')
const md = (s: string) => marked.parse(s, { renderer, async: false }) as string
const mdInline = (s: string) => marked.parseInline(s, { renderer, async: false }) as string

const MODES = [
  { value: 'guided' as const, label: 'Guided' },
  { value: 'free' as const, label: 'Free explore' },
]

/** the CSS selector of a focus target, safe for any tweak label */
function guideSelector(id: string): string {
  const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&')
  return `[data-guide="${esc}"]`
}

export function GuidePanel(p: GuidePanelProps) {
  const { state, steps, mode } = p
  const step = state.step
  const guided = mode === 'guided'
  const [open, setOpen] = useState(true)
  const [hint, setHint] = useState(false)
  const [stuck, setStuck] = useState(false)
  const stepKey = step?.id ?? '(done)'

  // a new step: hide the hint again, and offer it after a while
  useEffect(() => {
    setHint(false)
    setStuck(false)
    if (!guided || !step?.hint) return
    const t = setTimeout(() => setStuck(true), p.hintAfterMs ?? 20_000)
    return () => clearTimeout(t)
  }, [stepKey, guided, step?.hint, p.hintAfterMs])

  const bodyHtml = useMemo(() => (step ? md(step.body) : ''), [step])
  const hintHtml = useMemo(() => (step?.hint ? md(step.hint) : ''), [step])
  const explainHtml = useMemo(() => (state.justDone?.explain ? md(state.justDone.explain) : ''), [state.justDone])
  const titleHtml = useMemo(() => (step ? mdInline(step.title) : ''), [step])

  // the focus highlight: one rule for the target's data-guide attribute (see .guide-focus in ui.css)
  const control = guided ? step?.focus?.control : undefined
  const focusCss = control ? `${guideSelector(control)}{animation:guide-pulse 1.6s ease-in-out infinite;outline:2px dashed var(--blue);outline-offset:3px}` : ''

  const showMe = () => {
    const f = step?.focus
    if (!f) return
    if (f.part) p.onShowPart?.(f.part)
    if (f.control) {
      const el = document.querySelector<HTMLElement>(guideSelector(f.control))
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const target = el?.matches('button, input, [tabindex]') ? el : el?.querySelector<HTMLElement>('button, input, [tabindex]')
      target?.focus({ preventScroll: true })
    }
  }

  const n = Math.min(state.current + 1, state.total)
  const pct = state.total ? (state.current / state.total) * 100 : 0
  const announce = !guided ? 'Free explore: the guide is paused.' : state.complete ? `Guide complete: all ${state.total} steps.` : step ? `Step ${n} of ${state.total}: ${step.title}` : ''
  const headId = 'guide-h'

  return (
    <section className="guide" data-mode={mode} data-complete={state.complete || undefined} aria-labelledby={headId}>
      {focusCss && <style>{focusCss}</style>}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
      <div className="guide-top">
        <h2 id={headId} className="guide-label">
          <span className="guide-mark" aria-hidden="true">
            ✎
          </span>
          Guide
        </h2>
        {guided && (
          <span className="guide-count">
            {state.complete ? `${state.total} of ${state.total} done` : `Step ${n} of ${state.total}`}
          </span>
        )}
        <RadioSeg label="Guide mode" options={MODES} value={mode} onChange={p.onMode} className="seg guide-mode" />
        {guided && (
          <button type="button" className="guide-fold" aria-expanded={open} aria-controls="guide-body" onClick={() => setOpen((o) => !o)}>
            <span className="sr-only">{open ? 'Collapse the guide' : 'Expand the guide'}</span>
            <span aria-hidden="true">{open ? '▴' : '▾'}</span>
          </button>
        )}
      </div>

      {guided && (
        <div
          className="guide-progress"
          role="progressbar"
          aria-label="Guide progress"
          aria-valuemin={0}
          aria-valuemax={state.total}
          aria-valuenow={state.current}
        >
          <span style={{ width: `${pct}%` }} />
          {steps.map((s, i) => (
            <i key={s.id} data-state={state.done.includes(s.id) ? 'done' : i === state.current ? 'now' : undefined} style={{ left: `${((i + 0.5) / state.total) * 100}%` }} />
          ))}
        </div>
      )}

      {!guided && <p className="guide-paused">The bench is yours. The guide waits at step {n} of {state.total}; switch back to Guided to carry on.</p>}

      {guided && open && (
        <div id="guide-body" className="guide-body">
          {state.justDone && (
            <details className="guide-done" key={state.justDone.id}>
              <summary>
                <span className="guide-tick" aria-hidden="true">
                  ✓
                </span>
                {state.justDone.title}
                {explainHtml && <span className="guide-why">why?</span>}
              </summary>
              {explainHtml && <div className="prose" dangerouslySetInnerHTML={{ __html: explainHtml }} />}
            </details>
          )}

          {step ? (
            <div className="guide-step" key={step.id}>
              <h3 className="guide-title" dangerouslySetInnerHTML={{ __html: titleHtml }} />
              <div className="prose" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              {hint && hintHtml && <div className="guide-hint prose" dangerouslySetInnerHTML={{ __html: hintHtml }} />}
            </div>
          ) : (
            <div className="guide-finished">
              <span className="guide-stamp" aria-hidden="true">
                ✓
              </span>
              <div>
                <h3 className="guide-title">Guide complete</h3>
                <p>All {state.total} steps done. Keep experimenting in Free explore, or run the guide again.</p>
              </div>
            </div>
          )}

          <div className="guide-actions">
            <button type="button" className="pill small" onClick={p.onBack} disabled={state.current === 0}>
              ← Back
            </button>
            {step && (
              <>
                {step.check.kind === 'manual' && (
                  <button type="button" className="pill small primary" onClick={p.onConfirm}>
                    I've done this
                  </button>
                )}
                {step.focus && (
                  <button type="button" className="pill small" onClick={showMe}>
                    Show me
                  </button>
                )}
                {step.hint && !hint && (
                  <button type="button" className="pill small guide-hint-btn" data-stuck={stuck || undefined} onClick={() => setHint(true)}>
                    {stuck ? 'Stuck? See a hint' : 'Hint'}
                  </button>
                )}
                <button type="button" className="pill small" onClick={p.onSkip}>
                  Skip →
                </button>
              </>
            )}
            <button type="button" className="pill small guide-restart" onClick={p.onRestart} disabled={state.current === 0 && state.done.length === 0}>
              Restart
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
