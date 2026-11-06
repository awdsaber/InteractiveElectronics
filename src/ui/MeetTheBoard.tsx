import { useMemo } from 'react'
import { marked } from 'marked'

export interface MeetTheBoardProps {
  /** markdown */
  meet: string
  /** markdown, shown in the "For mechanical engineers" box */
  mechanicalAnalogy: string
  proTips: string[]
}

// Lesson copy is first-party static data, but strip raw HTML anyway.
const renderer = new marked.Renderer()
renderer.html = ({ text }) => text.replace(/</g, '&lt;')
const md = (s: string) => marked.parse(s, { renderer, async: false }) as string

export function MeetTheBoard({ meet, mechanicalAnalogy, proTips }: MeetTheBoardProps) {
  const meetHtml = useMemo(() => md(meet), [meet])
  const analogyHtml = useMemo(() => md(mechanicalAnalogy), [mechanicalAnalogy])
  return (
    <section className="note" aria-labelledby="meet-h">
      <h2 id="meet-h" className="note-head">
        <span>A</span> Meet the board
      </h2>
      <div className="prose" dangerouslySetInnerHTML={{ __html: meetHtml }} />
      <aside className="analogy">
        <h3>For mechanical engineers</h3>
        <div className="prose" dangerouslySetInnerHTML={{ __html: analogyHtml }} />
      </aside>
      {proTips.length > 0 && (
        <div className="tips">
          <h3>Pro tips</h3>
          <ul>
            {proTips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
