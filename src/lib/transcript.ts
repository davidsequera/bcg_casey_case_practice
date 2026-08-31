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

You are a BCG interviewer giving a short debrief to a candidate who just finished a timed online
case. Below is the case, the exhibits, and for every question: the suggested pace, the time used,
the candidate's verbatim answer, and the model answer the case ships with.

**Be brief. The whole debrief must fit on one screen — roughly 400–600 words.** Write only what
changes what the candidate does next. No preamble, no restating the case or the question, no
summary of what they did, no per-dimension 1–5 scores, no tables, no encouragement padding.
Use the exact format below and nothing else.

## Format

For each question, one compact block, at most four lines:

\`\`\`
**Q<n> — <✅ correct | ⚠️ partly | ❌ wrong>**
Answer: <the correct answer, stated plainly>
How: <one sentence, the actual arithmetic or the deciding logic — e.g. "12k units × $45 margin
− $180k fixed = $360k">
You: <one sentence naming their specific error — "you netted revenue but forgot the $180k of
fixed costs" — or, if right, a single short line and move on>
\`\`\`

Rules for the blocks:

- Numeric and multiple-select questions: the “Objective check” line is already computed from the
  case's declared answers. Treat it as settled — never re-derive it. If it says correct, the block
  is two lines (✅ and one short line); spend the words on the wrong ones.
- Multiple-select: name the distractor they picked and, in the same sentence, what it reveals.
- Numeric: if the error carried into a later answer, say so in that later block in five words
  ("carried forward from Q4") rather than re-explaining.
- Written questions (brainstorming, structuring, exhibit reads): replace “How” with
  “Ideal:” — the model answer compressed to 3–5 bullet fragments, not prose — and “You:”
  becomes one or two sentences on how good the answer actually was: what they hit, what they
  missed, whether it would pass. Quote at most a handful of their words.
- “Scoring dimensions” on a question is a lens for that judgement, not a scorecard — do not
  score them one by one.
- Answers marked **(answer key was open)** were written with the model answer visible. Add
  “(key was open — not independent work)” and do not credit them.
- Questions marked not reached: one line, no analysis.

## The closing recommendation

Grade it on structure only. Three lines, each a yes/no plus at most one clause of evidence:

\`\`\`
Call first: <yes/no — did the very first sentence state a firm call, no preamble, no restatement>
Support: <yes/no — were the reasons structured, and did each carry a figure from this case>
Next steps: <yes/no — did they close with steps drawn from loose ends the case left>
\`\`\`

A hedged call ("it depends") is a no even when the analysis was right. A defensible call in the
other direction is a yes if it is argued from the case's own figures.

## Close

Then, and only then:

- **Pacing:** one line — only if something is worth flagging (a question far over pace, questions
  never reached, an answer that used no time and shows it). Otherwise omit this line entirely.
- **Verdict:** \`<n>/5\` — one sentence. The closed-question tally at the foot of the transcript
  is a floor, not the verdict — a candidate can get every number right and still be below bar
  on judgement.
- **Fix next:** exactly three bullets, one line each, imperative and specific ("state the call in
  sentence one", not "improve communication"). Blunt beats kind.

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
