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

const GRADER_HEADER = `# Case interview transcript — please grade

You are a BCG interviewer debriefing a candidate who just completed a timed online case under
assessment conditions: a single clock for the whole case, questions asked one at a time in a
chat, no going back. Below you will find the case, the exhibits, and for every question: the
suggested pace, the time the candidate actually used, their verbatim answer, and the model
answer / rubric the case ships with.

Grade like an interviewer, not a teacher. Specifically:

1. For each question, score every dimension listed under "Scoring dimensions" from 1 to 5
   (1 = would not pass, 3 = borderline hire, 5 = clearly above bar) and justify each score
   in one sentence quoting the candidate's own words.
2. For multiple-select questions, compare their picks to the correct set: say which distractor
   they fell for and what that reveals about their judgement, not just how many they got.
3. For numeric questions, state whether the answer is within the stated tolerance of the
   model value, and if not, diagnose *where* the reasoning broke — a setup error, an
   arithmetic slip, or a misread exhibit.
4. Answers marked **(answer key was open)** were given with the model answer visible. Do not
   credit them as independent work; say so plainly.
5. Comment on pacing: the case-level clock is the real constraint, so flag questions that ran
   far over their suggested pace, questions that were never reached, and answers that used
   almost no time but were thin.
6. Close with an overall verdict (1-5), and the three highest-leverage things this
   candidate should change before their next case. Be blunt; vague encouragement is useless.

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

function dimensionsFor(q: Question): string {
  const weights = q.scoringWeights
  if (weights) {
    const entries = Object.entries(weights).filter(([, v]) => typeof v === 'number')
    if (entries.length > 0) {
      return entries.map(([k, v]) => `${k} (weight ${v})`).join(', ')
    }
  }
  // sensible defaults per type when the case did not declare weights
  switch (q.type) {
    case 'math':
      return 'accuracy, approach, communication'
    case 'structuring':
      return 'MECE-ness, relevance to the client question, communication'
    case 'brainstorming':
      return 'creativity, breadth, structure'
    case 'synthesis':
      return 'top-down recommendation, support, concision'
    case 'exhibit':
      return 'accuracy of read, so-what insight, communication'
  }
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
    out.push(`- Scoring dimensions: ${dimensionsFor(q)}`)
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
  out.push(
    `_Answering time: ${formatClock(totalUsed)} of the ${formatClock(
      limit,
    )} case clock. ${unanswered} question(s) never reached. Answer key was open for ${peeked} of ${
      session.answers.length
    } answered question(s)._`,
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
