import type { AnswerRecord, Case, Question, Session } from '../types/case'

export interface BotMessage {
  kind: 'bot'
  id: string
  /** case prompt or other body that sits above the question label */
  preamble?: string
  /** bold line above the body, e.g. "(Question 3 of 8)" */
  label?: string
  text: string
  exhibitIds?: string[]
}

export interface UserMessage {
  kind: 'user'
  id: string
  text: string
  at: string
}

export type ChatMessage = BotMessage | UserMessage

export const OPENING_LINE =
  'You will now complete a case study that contains {n} questions in total. Once you’re ready, we can start with the case prompt and the first question.'

export const DEFAULT_CLOSING =
  'That is the end of the case. Your transcript is ready — copy it into an LLM to get graded on what you actually said.'

/** What the candidate's bubble reads for an answer of any format. */
export function answerDisplay(q: Question, rec: AnswerRecord): string {
  if (q.responseFormat === 'choice') {
    const picked = (rec.selected ?? []).map((i) => q.options?.[i]).filter(Boolean) as string[]
    return picked.length > 0 ? picked.join('\n') : '(nothing selected)'
  }
  const answer = rec.answer.trim()
  if (!answer) return '(no answer)'
  if (q.responseFormat === 'number' && q.unit) return `${answer} ${q.unit}`
  return answer
}

/**
 * The chat is a pure function of the case and the session, so a refresh replays
 * the whole conversation without any of it being persisted as messages.
 */
export function buildMessages(c: Case, session: Session): ChatMessage[] {
  const n = c.questions.length
  const out: ChatMessage[] = [
    { kind: 'bot', id: 'intro', text: OPENING_LINE.replace('{n}', String(n)) },
    { kind: 'user', id: 'begin', text: 'Okay, let’s begin.', at: session.startedAt },
  ]

  const upTo = Math.min(session.questionIndex, n - 1)
  for (let i = 0; i <= upTo; i++) {
    const q = c.questions[i]
    out.push({
      kind: 'bot',
      id: `q-${q.id}`,
      preamble: i === 0 ? c.prompt : undefined,
      label: `(Question ${i + 1} of ${n})`,
      text: q.prompt,
      exhibitIds: q.exhibitIds,
    })

    const rec = session.answers.find((a) => a.questionId === q.id)
    if (!rec) continue

    out.push({
      kind: 'user',
      id: `a-${q.id}`,
      text: answerDisplay(q, rec),
      at: rec.at,
    })

    if (q.followUp) {
      // A hand-over that the very next question shows again would render the same
      // exhibit twice in a row, so let the question carry it.
      const nextIds = new Set(c.questions[i + 1]?.exhibitIds ?? [])
      const handed = (q.followUpExhibitIds ?? []).filter((id) => !nextIds.has(id))
      out.push({
        kind: 'bot',
        id: `f-${q.id}`,
        text: q.followUp,
        exhibitIds: handed.length > 0 ? handed : undefined,
      })
    }
  }

  if (session.questionIndex >= n) {
    out.push({ kind: 'bot', id: 'closing', text: c.closing ?? DEFAULT_CLOSING })
  }

  return out
}
