import type { AnswerRecord, Case, Question, Session } from '../types/case'

/**
 * The objective check.
 *
 * Casey never scores *during* a case -- the chat says nothing about whether an answer was
 * right, and that stays true. This module runs only after the case is over, on the transcript
 * screen, where the answer key is already visible question by question. It totals what can be
 * checked mechanically (closed formats against their declared answers) and refuses to guess at
 * what cannot: written questions are handed to the grading LLM unscored.
 *
 * Declared answers are trusted, not recomputed -- the same trust boundary `validateCase` keeps.
 */

export type Verdict =
  | 'correct'
  | 'partial'
  | 'incorrect'
  /** written answer -- there is nothing to compare it against */
  | 'unscored'
  /** the case clock ran out first */
  | 'unanswered'
  /** the case declared no answer to check against */
  | 'undeclared'

export interface QuestionScore {
  questionId: string
  verdict: Verdict
  /** choice: how many of the correct set the candidate picked */
  hits?: number
  /** choice: how many correct options there were */
  needed?: number
  /** choice: options picked that were not in the correct set */
  distractors?: number
  /** number: what the candidate's text parsed to, null when it did not parse */
  parsed?: number | null
  /** number: the declared answer */
  expected?: number
  /** number: the declared tolerance, as a percentage */
  tolerancePct?: number
}

export interface SessionScore {
  perQuestion: QuestionScore[]
  /** questions checkable by machine and actually answered */
  scorable: number
  /** of those, fully correct */
  correct: number
  /** of those, some but not all correct options picked */
  partial: number
  /** written questions left to the grader's judgement */
  unscored: number
  /** questions the clock never reached */
  unanswered: number
}

/**
 * Candidates type into a free-text field with `inputMode="decimal"`, so answers arrive as
 * "$135M", "1,350", "3.6 years". The declared answer is already expressed in the question's
 * unit, so a trailing "M" or "K" is a restatement of that unit, not a multiplier -- strip the
 * decoration and read the first number.
 */
export function parseNumericAnswer(raw: string): number | null {
  const match = raw.replace(/,/g, '').match(/-?\d*\.?\d+/)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) ? n : null
}

function withinTolerance(actual: number, expected: number, tolerancePct?: number): boolean {
  const allowed = Math.abs(expected) * ((tolerancePct ?? 0) / 100)
  return Math.abs(actual - expected) <= allowed + 1e-9
}

export function scoreQuestion(q: Question, rec: AnswerRecord | undefined): QuestionScore {
  if (!rec) return { questionId: q.id, verdict: 'unanswered' }

  if (q.responseFormat === 'choice') {
    const correct = new Set(q.idealAnswer.correctOptions ?? [])
    if (correct.size === 0) return { questionId: q.id, verdict: 'undeclared' }
    const picked = rec.selected ?? []
    const hits = picked.filter((i) => correct.has(i)).length
    const distractors = picked.length - hits
    return {
      questionId: q.id,
      verdict: hits === correct.size && distractors === 0 ? 'correct' : hits > 0 ? 'partial' : 'incorrect',
      hits,
      needed: correct.size,
      distractors,
    }
  }

  if (q.responseFormat === 'number') {
    const expected = q.idealAnswer.value
    if (typeof expected !== 'number') return { questionId: q.id, verdict: 'undeclared' }
    const parsed = parseNumericAnswer(rec.answer)
    return {
      questionId: q.id,
      verdict: parsed !== null && withinTolerance(parsed, expected, q.tolerancePct) ? 'correct' : 'incorrect',
      parsed,
      expected,
      tolerancePct: q.tolerancePct,
    }
  }

  return { questionId: q.id, verdict: 'unscored' }
}

export function scoreSession(c: Case, session: Session): SessionScore {
  const perQuestion = c.questions.map((q) =>
    scoreQuestion(
      q,
      session.answers.find((a) => a.questionId === q.id),
    ),
  )
  const count = (v: Verdict) => perQuestion.filter((s) => s.verdict === v).length
  const correct = count('correct')
  const partial = count('partial')
  return {
    perQuestion,
    scorable: correct + partial + count('incorrect'),
    correct,
    partial,
    unscored: count('unscored'),
    unanswered: count('unanswered'),
  }
}

/** The one-line objective check that goes under a question in the transcript. */
export function describeScore(score: QuestionScore): string | null {
  switch (score.verdict) {
    case 'correct':
      if (score.needed !== undefined) return `**all ${score.needed} correct options picked**`
      return `**within tolerance** — answered ${score.parsed}, expected ${score.expected}${
        score.tolerancePct ? ` (±${score.tolerancePct}%)` : ''
      }`
    case 'partial':
      return `**${score.hits} of ${score.needed} correct options picked**, ${
        score.distractors === 1 ? '1 distractor' : `${score.distractors} distractors`
      }`
    case 'incorrect':
      if (score.needed !== undefined)
        return `**no correct option picked** (${score.distractors} distractor${
          score.distractors === 1 ? '' : 's'
        })`
      if (score.parsed === null) return `**no number found** in the candidate's answer`
      return `**outside tolerance** — answered ${score.parsed}, expected ${score.expected}${
        score.tolerancePct ? ` (±${score.tolerancePct}%)` : ''
      }`
    case 'unscored':
      return 'a written answer — nothing to check mechanically, this one is yours to judge'
    default:
      return null
  }
}
