import { useEffect, useRef, useState } from 'react'
import type { Question } from '../types/case'
import { formatClock } from '../lib/timer'

export interface DockSubmission {
  answer: string
  selected?: number[]
  scratch?: string
}

const PLACEHOLDER: Record<Question['type'], string> = {
  structuring: 'Name the buckets, then say what you would look at inside each one.',
  math: 'State your approach, then the number.',
  exhibit: 'What does the exhibit say, and so what for the client?',
  brainstorming: 'List your ideas, grouped. Breadth first, then depth.',
  synthesis: 'Recommendation first, then your reasons, then risks and next steps.',
}

export function AnswerDock({
  question,
  softElapsed,
  disabled,
  onSend,
}: {
  question: Question
  /** seconds spent on this question, against its advisory budget */
  softElapsed: number
  disabled: boolean
  onSend: (s: DockSubmission) => void
}) {
  const [selected, setSelected] = useState<number[]>([])
  const [value, setValue] = useState('')
  const [scratch, setScratch] = useState('')
  const [showScratch, setShowScratch] = useState(false)
  const firstField = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)

  useEffect(() => {
    setSelected([])
    setValue('')
    setScratch('')
    setShowScratch(false)
    firstField.current?.focus()
  }, [question.id])

  const isChoice = question.responseFormat === 'choice'
  /** selectCount 0 means "select all that apply" -- the candidate is not told how many. */
  const openEnded = isChoice && question.selectCount === 0
  const need = openEnded ? (question.options?.length ?? 0) : (question.selectCount ?? 1)
  const ready = isChoice
    ? openEnded
      ? selected.length > 0
      : selected.length === need
    : value.trim().length > 0

  const send = () => {
    if (!ready || disabled) return
    if (isChoice) {
      const ordered = [...selected].sort((a, b) => a - b)
      onSend({
        answer: ordered.map((i) => question.options?.[i] ?? '').join(' | '),
        selected: ordered,
      })
    } else {
      onSend({ answer: value.trim(), scratch: scratch.trim() || undefined })
    }
  }

  const toggle = (i: number) => {
    setSelected((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i)
      if (prev.length >= need) return prev
      return [...prev, i]
    })
  }

  const over = softElapsed > question.timeLimitSeconds

  return (
    <div className="dock">
      <div className="dock-inner">
        {isChoice ? (
          <div className="options">
            {(question.options ?? []).map((opt, i) => {
              const on = selected.includes(i)
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  className={`option ${on ? 'on' : ''}`}
                  disabled={disabled || (!on && selected.length >= need)}
                  onClick={() => toggle(i)}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        ) : question.responseFormat === 'number' ? (
          <div className="number-entry">
            {question.answerFormatNote ? (
              <p className="format-note">{question.answerFormatNote}</p>
            ) : null}
            <input
              ref={firstField as React.RefObject<HTMLInputElement>}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              aria-label={`Your answer${question.unit ? ` in ${question.unit}` : ''}`}
              placeholder={question.unit ? `Your answer (${question.unit})` : 'Your answer'}
              value={value}
              disabled={disabled}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send()
              }}
            />
            {showScratch ? (
              <textarea
                className="scratch"
                value={scratch}
                disabled={disabled}
                placeholder="Your working — the grader reads this to find where a slip happened."
                onChange={(e) => setScratch(e.target.value)}
              />
            ) : (
              <button type="button" className="link" onClick={() => setShowScratch(true)}>
                + show your working (optional, goes in the transcript)
              </button>
            )}
          </div>
        ) : (
          <textarea
            ref={firstField as React.RefObject<HTMLTextAreaElement>}
            value={value}
            disabled={disabled}
            placeholder={PLACEHOLDER[question.type]}
            onChange={(e) => setValue(e.target.value)}
          />
        )}

        <div className="dock-foot">
          <span className={`pace ${over ? 'over' : ''}`}>
            {isChoice
              ? openEnded
                ? `Select all that apply: ${selected.length} chosen · `
                : `Select ${need}: ${selected.length}/${need} chosen · `
              : ''}
            {over
              ? `${formatClock(softElapsed)} on this question — suggested ${formatClock(
                  question.timeLimitSeconds,
                )}`
              : `${formatClock(question.timeLimitSeconds - softElapsed)} of suggested time left`}
            {question.maxLines ? ` · ${question.maxLines} lines maximum` : ''}
          </span>
          <button type="button" className="send" disabled={!ready || disabled} onClick={send}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
