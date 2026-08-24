import { useEffect, useState } from 'react'
import type { Case, Question } from '../types/case'
import { QUESTION_TYPE_LABEL } from '../types/case'

function AnswerKeyBody({ q }: { q: Question }) {
  const ideal = q.idealAnswer
  return (
    <div className="key-body">
      {q.responseFormat === 'choice' ? (
        <ul className="key-options">
          {(q.options ?? []).map((opt, i) => {
            const correct = (ideal.correctOptions ?? []).includes(i)
            return (
              <li key={i} className={correct ? 'correct' : 'distractor'}>
                <span className="mark" aria-hidden="true">
                  {correct ? '✓' : '·'}
                </span>
                <span>
                  <strong>{opt}</strong>
                  {ideal.optionRationale?.[i] ? (
                    <span className="muted"> — {ideal.optionRationale[i]}</span>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}

      {q.responseFormat === 'number' && ideal.value !== undefined ? (
        <p>
          Expected: <strong>{ideal.value.toLocaleString('en-US')}</strong>
          {q.unit ? ` ${q.unit}` : ''}
          {q.tolerancePct ? <span className="muted"> (±{q.tolerancePct}%)</span> : null}
        </p>
      ) : null}

      {ideal.workedSolution ? (
        <div className="prompt-block worked">{ideal.workedSolution}</div>
      ) : null}

      {ideal.keyPoints?.length ? (
        <>
          <h5>Key points expected</h5>
          <ul>
            {ideal.keyPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      ) : null}

      {ideal.commonMistakes?.length ? (
        <>
          <h5>Common mistakes</h5>
          <ul>
            {ideal.commonMistakes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

/**
 * Closed by default, and nothing inside it reaches the DOM until the candidate
 * opens a specific question -- so the key cannot be read out of the page source
 * either. Every question opened is reported through `onPeek` and ends up in the
 * transcript.
 */
export function AnswerKeyPanel({
  caseData,
  reachedIndex,
  open,
  peeked,
  onPeek,
  onClose,
}: {
  caseData: Case
  /** index of the question currently on screen */
  reachedIndex: number
  open: boolean
  peeked: string[]
  onPeek: (questionId: string) => void
  onClose: () => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  // moving to a new question collapses whatever was open
  useEffect(() => {
    setExpanded(null)
  }, [reachedIndex])

  if (!open) return null

  const reached = caseData.questions.slice(
    0,
    Math.min(reachedIndex + 1, caseData.questions.length),
  )

  const toggle = (q: Question) => {
    setExpanded((prev) => {
      if (prev === q.id) return null
      onPeek(q.id)
      return q.id
    })
  }

  return (
    <aside className="keypanel">
      <div className="keypanel-head">
        <h3>Answer key</h3>
        <button type="button" className="link" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="keypanel-note">
        Reading this does not change your answer — but each question you open is flagged in the
        transcript so your grader can weigh it.
      </p>
      <div className="keypanel-body">
        {reached.map((q, i) => (
          <div className="key-entry" key={q.id}>
            <button
              type="button"
              className="key-summary"
              aria-expanded={expanded === q.id}
              onClick={() => toggle(q)}
            >
              <span>
                Q{i + 1} · {QUESTION_TYPE_LABEL[q.type]}
              </span>
              {peeked.includes(q.id) ? <span className="flag">opened</span> : null}
            </button>
            {expanded === q.id ? <AnswerKeyBody q={q} /> : null}
          </div>
        ))}
      </div>
    </aside>
  )
}
