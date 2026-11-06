import { useState } from 'react'
import type { QuizItem } from '../engine/types'

export interface QuizProps {
  items: QuizItem[]
  /** fires once after the last question, with the number answered correctly first try */
  onComplete: (score: number, total: number) => void
  /** per-answer hook, handy for sound effects */
  onAnswer?: (correct: boolean) => void
}

export function Quiz({ items, onComplete, onAnswer }: QuizProps) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)

  if (items.length === 0) return null
  const q = items[i]
  const answered = picked !== null

  const choose = (n: number) => {
    if (answered) return
    setPicked(n)
    const ok = n === q.answer
    if (ok) setScore((s) => s + 1)
    onAnswer?.(ok)
  }
  const next = () => {
    if (i + 1 < items.length) {
      setI(i + 1)
      setPicked(null)
    } else {
      setFinished(true)
      onComplete(score, items.length)
    }
  }
  const restart = () => {
    setI(0)
    setPicked(null)
    setScore(0)
    setFinished(false)
  }

  return (
    <section className="note" aria-labelledby="quiz-h">
      <h2 id="quiz-h" className="note-head">
        <span>C</span> Check yourself
      </h2>
      {finished ? (
        <div className="quiz-done">
          <div className="score">
            {score}
            <small>/{items.length}</small>
          </div>
          <p>{score === items.length ? 'Clean sheet. Lesson marked done.' : 'Lesson marked done. Retake for a clean sheet.'}</p>
          <button type="button" className="pill small" onClick={restart}>
            Retake
          </button>
        </div>
      ) : (
        <div className="quiz">
          <div className="quiz-progress" aria-label={`Question ${i + 1} of ${items.length}`}>
            {items.map((_, n) => (
              <i key={n} data-state={n < i ? 'done' : n === i ? 'now' : 'todo'} />
            ))}
          </div>
          <p className="q">{q.q}</p>
          <div className="opts" role="radiogroup" aria-label="Answers">
            {q.options.map((o, n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={picked === n}
                className="opt"
                data-state={!answered ? '' : n === q.answer ? 'right' : n === picked ? 'wrong' : 'dim'}
                disabled={answered}
                onClick={() => choose(n)}
              >
                <b>{String.fromCharCode(65 + n)}</b>
                {o}
              </button>
            ))}
          </div>
          {answered && (
            <div className="why" data-ok={picked === q.answer} role="status">
              <strong>{picked === q.answer ? 'Right.' : 'Not quite.'}</strong> {q.why}
              <div>
                <button type="button" className="pill small primary" onClick={next}>
                  {i + 1 < items.length ? 'Next question' : 'Finish'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
