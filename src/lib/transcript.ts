import {
  QUESTION_TYPE_LABEL,
  totalTimeFor,
  type AnswerRecord,
  type Case,
  type Exhibit,
  type Question,
  type Session,
} from '../types/case'
import { formatClock } from './timer'
import { describeScore, scoreQuestion, scoreSession } from './score'

const GRADER_HEADER = `# Case interview transcript — please grade

You are a BCG interviewer debriefing a candidate who just completed a timed online case under
assessment conditions: a single clock for the whole case, questions asked one at a time in a
chat, no going back. Below you will find the case, the exhibits, and for every question: the
suggested pace, the time the candidate actually used, their verbatim answer, and the model
answer / rubric the case ships with.

Grade like an interviewer, not a teacher. Specifically:

1. For each question, score every dimension listed under "Scoring dimensions" from 1 to 5
   (1 = would not pass, 3 = borderline hire, 5 = clearly above bar) and justify each score
   in one sentence quoting the candidate's own words. Score only the dimensions listed —
   they vary by question, because a multiple-select answer has no prose to judge.
2. The "Objective check" line has already been computed from the case's declared answers.
   Treat it as settled and do not re-derive it; your job is to explain the answers it marks
   wrong, not to re-check the ones it marks right.
3. For multiple-select questions, compare their picks to the correct set: say which distractor
   they fell for and what that reveals about their judgement, not just how many they got.
4. For numeric questions marked outside tolerance, diagnose *where* the reasoning broke — a
   setup error, an arithmetic slip, or a misread exhibit. Check whether the error carried
   forward into later answers or was silently corrected.
5. Answers marked **(answer key was open)** were given with the model answer visible. Do not
   credit them as independent work; say so plainly.
6. Comment on pacing: the case-level clock is the real constraint, so flag questions that ran
   far over their suggested pace, questions that were never reached, and answers that used
   almost no time but were thin.
7. The last question is the closing recommendation, and it is graded on delivery as much as on
   content. Check three things explicitly and quote the candidate on each: did the *first
   sentence* state a firm call, with no preamble and no restatement of the problem; were the
   reasons structured and did each carry a figure established earlier in this case; did they
   close with next steps drawn from loose ends the case actually left. A hedged call ("it
   depends") is a miss even when the analysis behind it was right — hedging belongs in the next
   steps. Do not penalise a defensible call in the other direction if it is argued from the
   case's own figures.
8. Close with an overall verdict (1-5), and the three highest-leverage things this
   candidate should change before their next case. Be blunt; vague encouragement is useless.
   The closed-question tally at the foot of this transcript is a floor, not the verdict — a
   candidate can get every number right and still be below bar on judgement.

---
`

function exhibitToMarkdown(ex: Exhibit): string {
  const lines: string[] = [`**${ex.title}**${ex.unitsNote ? ` _(${ex.unitsNote})_` : ''}`, '']
  if (ex.type === 'table' && ex.table) {
    const { columns, rows } = ex.table
    lines.push(`| ${columns.join(' | ')} |`)
    lines.push(`| ${columns.map(() => '---').join(' | ')} |`)
    for (const row of rows) lines.push(`| ${row.map((c) => String(c)).join(' | ')} |`)
  } else if (ex.type === 'chart' && ex.chart) {
    const { categories, series, valueSuffix } = ex.chart
    lines.push(`_(${ex.chart.kind === 'stacked-bar' ? 'stacked bar' : 'bar'} chart)_`, '')
    lines.push(`| Series | ${categories.join(' | ')} |`)
    lines.push(`| --- | ${categories.map(() => '---').join(' | ')} |`)
    for (const s of series) {
      lines.push(`| ${s.label} | ${s.values.map((v) => `${v}${valueSuffix ?? ''}`).join(' | ')} |`)
    }
  } else if (ex.type === 'text' && ex.text) {
    lines.push(ex.text)
  } else if (ex.type === 'image') {
    lines.push('_(image exhibit — the candidate saw a chart here; it is not reproducible as text)_')
  }
  if (ex.source) lines.push('', `_Source: ${ex.source}_`)
  return lines.join('\n')
}

const DEFAULT_DIMENSIONS: Record<Question['type'], string[]> = {
  math: ['accuracy', 'approach', 'communication'],
  structuring: ['MECE-ness', 'relevance to the client question', 'communication'],
  brainstorming: ['creativity', 'breadth', 'structure'],
  synthesis: ['recommendation stated first', 'structured support carrying the case figures', 'next steps', 'concision'],
  exhibit: ['accuracy of read', 'so-what insight', 'communication'],
}

/**
 * A multiple-select answer is a set of clicks and a numeric answer is often a single token --
 * there is no prose to judge, so asking a grader to score "communication" there invites it to
 * invent a number and quietly skew the weighted score. Communication survives on written
 * answers, and on numeric answers only when the candidate showed their working.
 */
function communicationApplies(q: Question, rec: AnswerRecord | undefined): boolean {
  if (q.responseFormat === 'text') return true
  if (q.responseFormat === 'choice') return false
  return Boolean(rec?.scratch?.trim())
}

/** Dropping a dimension must not silently discount the ones that remain. */
function renormalise(entries: [string, number][]): [string, number][] {
  const sum = entries.reduce((s, [, v]) => s + v, 0)
  if (sum <= 0) return entries
  const scaled = entries.map(([k, v]) => [k, Math.round((v / sum) * 100) / 100] as [string, number])
  const residual = Math.round((1 - scaled.reduce((s, [, v]) => s + v, 0)) * 100) / 100
  if (residual !== 0 && scaled.length > 0) {
    const last = scaled[scaled.length - 1]
    scaled[scaled.length - 1] = [last[0], Math.round((last[1] + residual) * 100) / 100]
  }
  return scaled
}

function dimensionsFor(q: Question, rec: AnswerRecord | undefined): string {
  const keepCommunication = communicationApplies(q, rec)
  const isCommunication = (name: string) => name.toLowerCase() === 'communication'

  const weights = q.scoringWeights
  if (weights) {
    const declared = Object.entries(weights).filter(([, v]) => typeof v === 'number') as [
      string,
      number,
    ][]
    if (declared.length > 0) {
      const kept = keepCommunication ? declared : declared.filter(([k]) => !isCommunication(k))
      const entries = kept.length > 0 ? renormalise(kept) : declared
      return entries.map(([k, v]) => `${k} (weight ${v})`).join(', ')
    }
  }
  // sensible defaults per type when the case did not declare weights
  const names = DEFAULT_DIMENSIONS[q.type]
  return (keepCommunication ? names : names.filter((n) => !isCommunication(n))).join(', ')
}

function choiceBlock(q: Question, rec: AnswerRecord | undefined): string[] {
  const out: string[] = ['**Options presented** (✓ = correct, ● = candidate picked):', '']
  const picked = new Set(rec?.selected ?? [])
  const correct = new Set(q.idealAnswer.correctOptions ?? [])
  ;(q.options ?? []).forEach((opt, i) => {
    const marks = `${correct.has(i) ? '✓' : ' '}${picked.has(i) ? '●' : ' '}`
    const why = q.idealAnswer.optionRationale?.[i]
    out.push(`- \`[${marks}]\` ${opt}${why ? ` — _${why}_` : ''}`)
  })
  if (rec) {
    const hits = (rec.selected ?? []).filter((i) => correct.has(i)).length
    out.push('', `Picked ${hits} of ${correct.size} correct.`)
  }
  return out
}

export function buildTranscriptMarkdown(c: Case, session: Session): string {
  const out: string[] = [GRADER_HEADER]
  const limit = totalTimeFor(c)

  out.push(`## Case: ${c.title}`)
  out.push('')
  out.push(
    `- Industry: ${c.industry}\n- Difficulty: ${c.difficulty}\n- Mode: ${
      session.practiceMode
        ? 'practice (clock advisory, case does not end at 0:00)'
        : 'timed (assessment conditions)'
    }\n- Case clock: ${formatClock(limit)} total\n- Started: ${session.startedAt}`,
  )
  out.push('')
  out.push('### Prompt given to the candidate')
  out.push('')
  out.push(c.prompt)

  if (c.exhibits.length > 0) {
    out.push('', '### Exhibits')
    for (const ex of c.exhibits) {
      out.push('', exhibitToMarkdown(ex))
    }
  }

  out.push('', '---', '', '## Questions and answers', '')

  c.questions.forEach((q, i) => {
    const rec = session.answers.find((a) => a.questionId === q.id)
    out.push(`### Q${i + 1}. ${QUESTION_TYPE_LABEL[q.type]} · ${q.responseFormat}`)
    out.push('')
    out.push(q.prompt)
    if (q.exhibitIds && q.exhibitIds.length > 0) {
      out.push('', `_Exhibits in view: ${q.exhibitIds.join(', ')}_`)
    }
    out.push('')

    if (!rec) {
      out.push('**Not reached — the case clock ran out before this question.**', '', '---', '')
      return
    }

    out.push(
      `- Suggested pace: ${formatClock(q.timeLimitSeconds)} | Time used: ${formatClock(
        rec.secondsUsed,
      )}${rec.secondsUsed > q.timeLimitSeconds ? ' **(over pace)**' : ''}`,
    )
    out.push(`- Scoring dimensions: ${dimensionsFor(q, rec)}`)
    const objective = describeScore(scoreQuestion(q, rec))
    if (objective) out.push(`- Objective check: ${objective}`)
    if (rec.peeked) out.push('- **The answer key was open for this question.**')
    if (q.responseFormat === 'number') {
      out.push(
        `- Expected: **${q.idealAnswer.value ?? '—'}${q.unit ? ` ${q.unit}` : ''}**` +
          (q.tolerancePct ? ` (tolerance ±${q.tolerancePct}%)` : ''),
      )
    }

    out.push('')
    if (q.responseFormat === 'choice') {
      out.push(...choiceBlock(q, rec))
      out.push('')
    } else {
      out.push('**Candidate answer:**', '')
      const answer = rec.answer.trim()
      out.push(answer ? `> ${answer.split('\n').join('\n> ')}` : '> _(left blank)_')
      if (rec.scratch?.trim()) {
        out.push('', '**Candidate working:**', '', '```', rec.scratch.trim(), '```')
      }
      out.push('')
    }

    const ideal = q.idealAnswer
    out.push('**Model answer / rubric:**', '')
    if (ideal.workedSolution) out.push(ideal.workedSolution, '')
    if (ideal.keyPoints?.length) {
      out.push('Key points expected:')
      for (const p of ideal.keyPoints) out.push(`- ${p}`)
      out.push('')
    }
    if (ideal.commonMistakes?.length) {
      out.push('Common mistakes to check for:')
      for (const m of ideal.commonMistakes) out.push(`- ${m}`)
      out.push('')
    }
    out.push('---', '')
  })

  const totalUsed = session.answers.reduce((sum, a) => sum + a.secondsUsed, 0)
  const unanswered = c.questions.length - session.answers.length
  const peeked = session.answers.filter((a) => a.peeked).length
  const score = scoreSession(c, session)
  out.push(
    `_Answering time: ${formatClock(totalUsed)} of the ${formatClock(
      limit,
    )} case clock. ${unanswered} question(s) never reached. Answer key was open for ${peeked} of ${
      session.answers.length
    } answered question(s)._`,
  )
  out.push('')
  out.push(
    `_Objective check: **${score.correct} of ${score.scorable}** closed questions fully correct` +
      (score.partial > 0 ? ` (${score.partial} partially correct)` : '') +
      `. ${score.unscored} written question${
        score.unscored === 1 ? ' is' : 's are'
      } not machine-checkable and left to your judgement._`,
  )

  return out.join('\n')
}

export function buildSessionJson(c: Case, session: Session): string {
  return JSON.stringify({ case: c, session }, null, 2)
}

export function downloadFile(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
