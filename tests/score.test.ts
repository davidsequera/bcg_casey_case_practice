import pumps from '../src/cases/pumps-vietnam-plant.json'
import { buildTranscriptMarkdown } from '../src/lib/transcript'
import { parseNumericAnswer, scoreSession } from '../src/lib/score'
import type { AnswerRecord, Case, Session } from '../src/types/case'
import { check, finish, section } from './harness'

const c = pumps as unknown as Case

/** The real run this module was written for: Q4 and Q7 wrong, everything else right. */
const RUN: Record<string, { answer: string; selected?: number[]; scratch?: string }> = {
  q1: { answer: 'picked', selected: [0, 1] },
  q2: { answer: 'picked', selected: [0, 1, 2, 4] },
  q3: { answer: '900' },
  q4: { answer: '135' },
  q5: { answer: '2000' },
  q6: { answer: '150' },
  q7: { answer: '2.5' },
  q8: { answer: 'picked', selected: [0, 1, 2] },
  q9: { answer: 'My Recommendation is to invest in the new plant.' },
}

function session(overrides: Partial<Session> = {}): Session {
  const answers: AnswerRecord[] = c.questions.map((q, i) => ({
    questionId: q.id,
    ...RUN[q.id],
    secondsUsed: 60,
    at: `2026-08-27T02:1${i}:00.000Z`,
    autoSubmitted: false,
  }))
  return {
    caseId: c.id,
    caseTitle: c.title,
    startedAt: '2026-08-27T02:15:31.526Z',
    practiceMode: false,
    questionIndex: c.questions.length,
    peeked: [],
    answers,
    ...overrides,
  }
}

section('Numeric answers are parsed the way candidates actually type them')
check('a bare number', parseNumericAnswer('900') === 900)
check('a currency prefix', parseNumericAnswer('$150') === 150)
check('thousands separators', parseNumericAnswer('1,350') === 1350)
check('a decimal with a trailing unit word', parseNumericAnswer('3.6 years') === 3.6)
check('a unit suffix restates the declared unit, it does not multiply',
  parseNumericAnswer('$135M') === 135)
check('a negative', parseNumericAnswer('-42') === -42)
check('prose with no number at all', parseNumericAnswer('I ran out of time') === null)

section('The objective check totals only what it can actually check')
const s = scoreSession(c, session())
check('eight of nine questions are machine-checkable', s.scorable === 8, `-> ${s.scorable}`)
check('the written recommendation is left unscored', s.unscored === 1, `-> ${s.unscored}`)
check('six closed questions are correct', s.correct === 6, `-> ${s.correct}`)
const byId = Object.fromEntries(s.perQuestion.map((p) => [p.questionId, p]))
check('the export-profit slip is marked wrong', byId.q4.verdict === 'incorrect')
check('the payback slip is marked wrong', byId.q7.verdict === 'incorrect')
check('an in-tolerance number is marked correct', byId.q3.verdict === 'correct')
check('a full set of picks is marked correct', byId.q1.verdict === 'correct')

section('Tolerance is read from the question, not assumed')
const near = scoreSession(c, session({
  answers: session().answers.map((a) => (a.questionId === 'q3' ? { ...a, answer: '885' } : a)),
}))
check('1.7% off a ±2% question passes',
  near.perQuestion.find((p) => p.questionId === 'q3')!.verdict === 'correct')
const far = scoreSession(c, session({
  answers: session().answers.map((a) => (a.questionId === 'q3' ? { ...a, answer: '870' } : a)),
}))
check('3.3% off a ±2% question fails',
  far.perQuestion.find((p) => p.questionId === 'q3')!.verdict === 'incorrect')

section('Partial credit on multiple-select is visible, not rounded away')
const half = scoreSession(c, session({
  answers: session().answers.map((a) => (a.questionId === 'q2' ? { ...a, selected: [0, 1, 3, 4] } : a)),
}))
const q2 = half.perQuestion.find((p) => p.questionId === 'q2')!
check('a distractor drops it to partial', q2.verdict === 'partial', `-> ${q2.verdict}`)
check('the distractor is counted', q2.distractors === 1 && q2.hits === 3)
check('partials are not counted as correct', half.correct === 5, `-> ${half.correct}`)

section('A question the clock never reached is not scored as wrong')
const short = scoreSession(c, session({ answers: session().answers.slice(0, 5) }))
check('unreached questions are their own bucket', short.unanswered === 4, `-> ${short.unanswered}`)
check('they do not enter the denominator', short.scorable === 5, `-> ${short.scorable}`)

section('Communication is only scored where there is something to communicate')
const md = buildTranscriptMarkdown(c, session())
const dims = md
  .split('\n')
  .filter((l) => l.startsWith('- Scoring dimensions:'))
  .map((l) => l.replace('- Scoring dimensions: ', ''))
check('one dimension line per question', dims.length === 9, `-> ${dims.length}`)
check('a multiple-select question is not graded on communication',
  !dims[0].includes('communication'), `-> ${dims[0]}`)
check('a bare numeric answer is not graded on communication',
  !dims[2].includes('communication'), `-> ${dims[2]}`)
check('the written recommendation still is', dims[8].includes('communication'), `-> ${dims[8]}`)
check('dropping a dimension renormalises the rest to 1',
  dims[0] === 'structure (weight 0.5), accuracy (weight 0.5)', `-> ${dims[0]}`)
check('accuracy is not silently discounted on a numeric question',
  dims[2] === 'accuracy (weight 0.75), structure (weight 0.25)', `-> ${dims[2]}`)

const withWorking = buildTranscriptMarkdown(c, session({
  answers: session().answers.map((a) =>
    a.questionId === 'q3' ? { ...a, scratch: '6000 - 4200 - 300 - 600' } : a),
}))
check('showing your working brings communication back',
  withWorking
    .split('\n')
    .filter((l) => l.startsWith('- Scoring dimensions:'))[2]
    .includes('communication'))

section('The transcript hands the grader the check instead of making it re-derive one')
check('every checkable question carries a verdict',
  md.split('- Objective check:').length - 1 === 9)
check('a wrong number states both figures',
  md.includes('**outside tolerance** — answered 135, expected 90 (±2%)'))
check('a right number is marked within tolerance', md.includes('**within tolerance**'))
check('a full set of picks is spelled out', md.includes('**all 2 correct options picked**'))
check('the written question is explicitly handed over',
  md.includes('nothing to check mechanically'))
check('the tally closes the transcript',
  md.includes('**6 of 8** closed questions fully correct'))
check('the grader is told not to re-derive the check',
  md.includes('Treat it as settled'))
check('the tally is framed as a floor, not the verdict', md.includes('is a floor, not the verdict'))

finish()
