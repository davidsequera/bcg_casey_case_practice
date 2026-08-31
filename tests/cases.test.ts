import { validateCase } from '../src/lib/validateCase'
import { buildTranscriptMarkdown } from '../src/lib/transcript'
import { buildMessages } from '../src/lib/chat'
import coffee from '../src/cases/coffee-chain-profitability.json'
import pumps from '../src/cases/pumps-vietnam-plant.json'
import cloud from '../src/cases/media-cloud-migration.json'
import bank from '../src/cases/bank-fraud-losses.json'
import coal from '../src/cases/coal-retirement.json'
import vets from '../src/cases/pe-vet-referral.json'
import hospital from '../src/cases/hospital-cost-reduction.json'
import motor from '../src/cases/motor-telematics-pricing.json'
import jobs from '../src/cases/jobs-programme.json'
import airline from '../src/cases/airline-market-entry.json'
import turnaround from '../src/cases/department-store-turnaround.json'
import { totalTimeFor, type Case, type Session } from '../src/types/case'
import { check, finish, section } from './harness'

const BUNDLED = {
  coffee,
  pumps,
  cloud,
  bank,
  coal,
  vets,
  hospital,
  motor,
  jobs,
  airline,
  turnaround,
}

section('Bundled cases validate')
for (const [name, c] of Object.entries(BUNDLED)) {
  const r = validateCase(c)
  check(`${name} is schema-valid`, r.ok, r.ok ? '' : '-> ' + r.errors.join('; '))
  if (r.ok) {
    check(`${name} raises no warnings`, r.warnings.length === 0, '-> ' + r.warnings.join('; '))
  }
}

section('Bundled cases follow the Casey shape')
for (const [name, raw] of Object.entries(BUNDLED)) {
  const c = raw as unknown as Case
  const formats = new Set(c.questions.map((q) => q.responseFormat))
  check(`${name} asks 8-10 questions`,
    c.questions.length >= 8 && c.questions.length <= 10, `-> ${c.questions.length}`)
  check(`${name} leans on multiple select`, formats.has('choice'))
  check(`${name} has numeric questions`, formats.has('number'))
  check(`${name} ends on a written recommendation`,
    c.questions[c.questions.length - 1].responseFormat === 'text')
  check(`${name} declares a case clock`, totalTimeFor(c) > 0)
  check(`${name} fits its pacing budget inside the case clock`,
    c.questions.reduce((s, q) => s + q.timeLimitSeconds, 0) <= totalTimeFor(c),
    `-> ${c.questions.reduce((s, q) => s + q.timeLimitSeconds, 0)}s of ${totalTimeFor(c)}s`)
  check(`${name} releases information between questions`,
    c.questions.slice(0, -1).filter((q) => q.followUp).length >= c.questions.length - 3)
  check(`${name} explains every option it offers`,
    c.questions
      .filter((q) => q.responseFormat === 'choice')
      .every((q) => q.idealAnswer.optionRationale?.length === q.options?.length))
  check(`${name} tells the candidate how to format every number`,
    c.questions
      .filter((q) => q.responseFormat === 'number')
      .every((q) => Boolean(q.answerFormatNote) && Boolean(q.unit) && Boolean(q.tolerancePct)))
}

section('The library covers the industry map')
{
  const cases = Object.values(BUNDLED) as unknown as Case[]
  const industries = cases.map((c) => c.industry)
  check('one case per industry — no repeats', new Set(industries).size === cases.length,
    `-> ${industries.join(', ')}`)
  check('every bundled case declares a functional practice',
    cases.every((c) => typeof c.functionalPractice === 'string' && c.functionalPractice.length > 0))
  const practices = new Set(cases.map((c) => c.functionalPractice))
  check('the nine functional practices are all represented', practices.size >= 9,
    `-> ${practices.size} distinct`)
}

section('Validator rejects malformed cases')
const broken = {
  schemaVersion: 2, id: 'x', title: 'X', industry: 'Y', difficulty: 'spicy',
  estimatedMinutes: 10, prompt: 'p', exhibits: [],
  questions: [{
    id: 'q1', type: 'math', timeLimitSeconds: 60, prompt: 'p',
    responseFormat: 'number', exhibitIds: ['nope'], idealAnswer: {},
  }],
}
const r = validateCase(broken)
check('broken case is rejected', !r.ok)
if (!r.ok) {
  const joined = r.errors.join(' | ')
  check('flags the bad difficulty enum', joined.includes('difficulty'))
  check('flags the dangling exhibit reference', joined.includes('unknown exhibit "nope"'))
  check('flags the missing numeric answer key', joined.includes('idealAnswer.value'))
}
check('non-object input is rejected', !validateCase('not a case').ok)
check('empty questions array is rejected',
  !validateCase({ ...broken, difficulty: 'easy', questions: [] }).ok)

section('Choice questions are checked against their answer key')
const choiceCase = (q: Record<string, unknown>) =>
  validateCase({
    ...broken, difficulty: 'easy', exhibits: [],
    questions: [{
      id: 'q1', type: 'structuring', timeLimitSeconds: 60, prompt: 'p',
      responseFormat: 'choice', ...q,
    }],
  })

const countMismatch = choiceCase({
  selectCount: 2, options: ['a', 'b', 'c'],
  idealAnswer: { correctOptions: [0], optionRationale: ['x', 'y', 'z'] },
})
check('asking for two but declaring one correct is rejected',
  !countMismatch.ok && countMismatch.errors.some((e) => e.includes('declares 1 correct')))

const outOfRange = choiceCase({
  selectCount: 1, options: ['a', 'b'],
  idealAnswer: { correctOptions: [7], optionRationale: ['x', 'y'] },
})
check('an out-of-range correct index is rejected',
  !outOfRange.ok && outOfRange.errors.some((e) => e.includes('out-of-range')))

const noKey = choiceCase({ selectCount: 1, options: ['a', 'b'], idealAnswer: {} })
check('a choice question with no correctOptions is rejected',
  !noKey.ok && noKey.errors.some((e) => e.includes('correctOptions')))

const raggedRationale = choiceCase({
  selectCount: 1, options: ['a', 'b'],
  idealAnswer: { correctOptions: [0], optionRationale: ['only one'] },
})
check('rationale must cover every option',
  !raggedRationale.ok && raggedRationale.errors.some((e) => e.includes('one entry per option')))

const good = choiceCase({
  selectCount: 1, options: ['a', 'b'],
  idealAnswer: { correctOptions: [0], optionRationale: ['x', 'y'] },
})
check('a well-formed choice question is accepted', good.ok,
  good.ok ? '' : '-> ' + good.errors.join('; '))

const selectAll = choiceCase({
  selectCount: 0, options: ['a', 'b', 'c'],
  idealAnswer: { correctOptions: [0, 2], optionRationale: ['x', 'y', 'z'] },
})
check('"select all that apply" (selectCount 0) is accepted with any number of correct options',
  selectAll.ok, selectAll.ok ? '' : '-> ' + selectAll.errors.join('; '))

const emptyKey = choiceCase({
  selectCount: 0, options: ['a', 'b'],
  idealAnswer: { correctOptions: [], optionRationale: ['x', 'y'] },
})
check('"select all that apply" still needs at least one correct option',
  !emptyKey.ok && emptyKey.errors.some((e) => e.includes('no correct option')))

const negativeCount = choiceCase({
  selectCount: -1, options: ['a', 'b'],
  idealAnswer: { correctOptions: [0], optionRationale: ['x', 'y'] },
})
check('a negative selectCount is rejected',
  !negativeCount.ok && negativeCount.errors.some((e) => e.includes('non-negative')))

section('Ragged exhibit tables and charts are caught')
const ragged = validateCase({
  ...broken, difficulty: 'easy',
  exhibits: [{ id: 'e1', title: 'T', type: 'table', table: { columns: ['a', 'b'], rows: [[1]] } }],
  questions: [{
    id: 'q1', type: 'structuring', timeLimitSeconds: 60, prompt: 'p',
    responseFormat: 'text', idealAnswer: { keyPoints: ['k'] },
  }],
})
check('row/column mismatch is reported',
  !ragged.ok && ragged.errors.some((e) => e.includes('cells')))

const raggedChart = validateCase({
  ...broken, difficulty: 'easy',
  exhibits: [{
    id: 'e1', title: 'T', type: 'chart',
    chart: { kind: 'bar', categories: ['a', 'b'], series: [{ label: 's', values: [1] }] },
  }],
  questions: [{
    id: 'q1', type: 'structuring', timeLimitSeconds: 60, prompt: 'p',
    responseFormat: 'text', idealAnswer: { keyPoints: ['k'] },
  }],
})
check('a chart series shorter than its categories is reported',
  !raggedChart.ok && raggedChart.errors.some((e) => e.includes('categories')))

// ---------------------------------------------------------------------------
const c = cloud as unknown as Case

function fullSession(overrides: Partial<Session> = {}): Session {
  return {
    caseId: c.id,
    caseTitle: c.title,
    startedAt: '2026-08-23T10:00:00.000Z',
    practiceMode: false,
    questionIndex: c.questions.length,
    peeked: ['q5'],
    answers: c.questions.map((q, i) => ({
      questionId: q.id,
      answer: q.responseFormat === 'choice' ? 'picked' : `answer for ${q.type}`,
      selected: q.responseFormat === 'choice' ? [0] : undefined,
      scratch: q.responseFormat === 'number' ? 'SCRATCH_WORKING_HERE' : undefined,
      secondsUsed: i === 1 ? q.timeLimitSeconds + 60 : 60,
      at: `2026-08-23T10:0${i}:00.000Z`,
      autoSubmitted: false,
      peeked: q.id === 'q5',
    })),
    ...overrides,
  }
}

section('The chat is a pure replay of the session')
const early = buildMessages(c, fullSession({ questionIndex: 0, answers: [], peeked: [] }))
check('opens with the interviewer and the candidate', early[0].kind === 'bot' && early[1].kind === 'user')
check('announces the question count', early[0].kind === 'bot' && early[0].text.includes('10 questions'))
check('the first bot question carries the case prompt as a preamble',
  early[2].kind === 'bot' && (early[2].preamble ?? '').includes('Aurora Studios'))
check('labels the question', early[2].kind === 'bot' && early[2].label === '(Question 1 of 10)')
check('shows nothing beyond the current question', early.length === 3, `-> ${early.length}`)

const answered = buildMessages(c, fullSession({ questionIndex: 1 }))
check('the candidate bubble names the options picked',
  answered[3].kind === 'user' && answered[3].text === c.questions[0].options![0])
check('the interviewer releases the follow-up after the answer',
  answered[4].kind === 'bot' && answered[4].text.includes('$150M'))
check('the next question follows', answered[5].kind === 'bot' &&
  answered[5].label === '(Question 2 of 10)')

const finished = buildMessages(c, fullSession())
check('a finished case closes the conversation',
  finished[finished.length - 1].kind === 'bot' &&
    (finished[finished.length - 1] as { text: string }).text.includes('end of the case'))

section('Transcript carries everything a grader needs')
const md = buildTranscriptMarkdown(c, fullSession())
check('includes grading instructions', md.includes('Be brief') && md.includes('Fix next:'))
check('includes the case prompt', md.includes('Aurora Studios'))
check('renders table exhibits as markdown',
  md.includes('| Data centre | Annual fixed cost ($M) | Installed capacity (K server units) |'))
check('renders chart exhibits as data, not as a picture',
  md.includes('bar chart') && md.includes('| Series | Ashvale | Derrow |'))
check('includes every question', c.questions.every((q) => md.includes(q.prompt)))
check('lays out the options with correct and picked marked',
  md.includes('✓ = correct') && md.includes('[✓●]'))
check('scores the picks against the key',
  md.includes('Picked 0 of 2 correct.') && md.includes('Picked 1 of 4 correct.'))
check('includes free-text answers', md.includes('> answer for synthesis'))
check('includes the working shown on numeric questions', md.includes('SCRATCH_WORKING_HERE'))
check('flags questions where the answer key was open',
  md.includes('**The answer key was open for this question.**'))
check('flags questions that ran over their suggested pace', md.includes('**(over pace)**'))
check('states the pace and the time used', md.includes('Suggested pace:'))
check('includes the model answer key', md.includes('$800M − $600M = $200M'))
check('reports scoring dimensions', md.includes('Scoring dimensions:'))
check('closes with a time summary', md.includes('case clock'))

section('An abandoned case is transcribed honestly')
const partial = buildTranscriptMarkdown(
  c,
  fullSession({ questionIndex: c.questions.length, answers: fullSession().answers.slice(0, 3) }),
)
check('unanswered questions are marked, not silently dropped',
  partial.includes('Not reached — the case clock ran out'))
check('counts what was never reached', partial.includes('7 question(s) never reached'))

finish()
