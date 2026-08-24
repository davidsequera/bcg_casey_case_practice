import { useEffect, useMemo, useRef, useState } from 'react'
import { totalTimeFor, type Case, type Session } from '../types/case'
import { buildMessages } from '../lib/chat'
import { formatClock, useDeadline } from '../lib/timer'
import { MessageList } from './MessageList'
import { AnswerDock, type DockSubmission } from './AnswerDock'
import { AnswerKeyPanel } from './AnswerKeyPanel'

export interface ChatSubmission extends DockSubmission {
  secondsUsed: number
  autoSubmitted: boolean
}

function clockLevel(remaining: number, limit: number): 'ok' | 'warn' | 'danger' {
  const frac = limit > 0 ? remaining / limit : 0
  if (frac <= 0.08) return 'danger'
  if (frac <= 0.2) return 'warn'
  return 'ok'
}

export function ChatScreen({
  caseData,
  session,
  onSubmit,
  onTimeUp,
  onPeek,
  onExit,
}: {
  caseData: Case
  session: Session
  onSubmit: (s: ChatSubmission) => void
  onTimeUp: () => void
  onPeek: (questionId: string) => void
  onExit: () => void
}) {
  const [keyOpen, setKeyOpen] = useState(false)
  const scroller = useRef<HTMLDivElement | null>(null)

  const total = caseData.questions.length
  const index = Math.min(session.questionIndex, total - 1)
  const question = caseData.questions[index]
  const messages = useMemo(() => buildMessages(caseData, session), [caseData, session])

  const startMs = Date.parse(session.startedAt)
  const limit = totalTimeFor(caseData)
  const { remaining, elapsed, expired } = useDeadline(startMs, limit, true)

  // The current question opened when the previous answer was sent, so the pacing
  // budget survives a refresh instead of restarting.
  const last = session.answers[session.answers.length - 1]
  const questionStartMs = last ? Date.parse(last.at) : startMs
  const offset = Math.max(0, Math.floor((questionStartMs - startMs) / 1000))
  const softElapsed = Math.max(0, elapsed - offset)

  const outOfTime = expired && !session.practiceMode

  useEffect(() => {
    if (outOfTime) onTimeUp()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outOfTime])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, keyOpen])

  const level = clockLevel(remaining, limit)

  return (
    <div className="chat">
      <header className="chat-head">
        <div>
          <button type="button" className="link" onClick={onExit}>
            ← End and build transcript
          </button>
          <h1>{caseData.title}</h1>
          <p className="muted">
            Question {index + 1} of {total}
            {session.practiceMode ? ' · practice mode' : ''}
          </p>
        </div>
        <div className="chat-head-right">
          <div className={`clock ${level}`}>{formatClock(remaining)}</div>
          <div className="muted clock-note">
            {session.practiceMode ? 'advisory — nothing ends at 0:00' : 'the case ends at 0:00'}
          </div>
          <button
            type="button"
            className="keytoggle"
            aria-expanded={keyOpen}
            onClick={() => setKeyOpen((v) => !v)}
          >
            {keyOpen ? 'Hide answer key' : 'Answer key'}
          </button>
        </div>
      </header>

      <div className="chat-body">
        <div className="chat-stream" ref={scroller}>
          <MessageList caseData={caseData} messages={messages} />
        </div>

        <AnswerKeyPanel
          caseData={caseData}
          reachedIndex={index}
          open={keyOpen}
          peeked={session.peeked}
          onPeek={onPeek}
          onClose={() => setKeyOpen(false)}
        />
      </div>

      <AnswerDock
        question={question}
        softElapsed={softElapsed}
        disabled={outOfTime}
        onSend={(s) => onSubmit({ ...s, secondsUsed: softElapsed, autoSubmitted: false })}
      />
    </div>
  )
}
