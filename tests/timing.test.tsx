/**
 * Drives the real chat screen in a DOM against a real clock: a 2-second case
 * clock, so the end-of-case path is exercised end to end rather than mocked.
 */
import { JSDOM } from 'jsdom'
import { check, finish, section } from './harness'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
const g = globalThis as unknown as Record<string, unknown>
g.window = dom.window
g.document = dom.window.document
Object.defineProperty(g, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
})
g.HTMLElement = dom.window.HTMLElement
g.HTMLInputElement = dom.window.HTMLInputElement
g.HTMLTextAreaElement = dom.window.HTMLTextAreaElement
g.Event = dom.window.Event
g.IS_REACT_ACT_ENVIRONMENT = true

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const textQuestion = {
  id: 'q1',
  type: 'structuring',
  timeLimitSeconds: 1,
  prompt: 'Structure it.',
  responseFormat: 'text',
  idealAnswer: { keyPoints: ['SECRET_KEY_POINT'] },
}

const choiceQuestion = {
  id: 'q2',
  type: 'structuring',
  timeLimitSeconds: 1,
  prompt: 'Pick two.',
  responseFormat: 'choice',
  selectCount: 2,
  options: ['Alpha', 'Bravo', 'Charlie'],
  idealAnswer: {
    correctOptions: [0, 1],
    optionRationale: ['Rationale for Alpha', 'Rationale for Bravo', 'Rationale for Charlie'],
  },
}

function makeCase(questions: unknown[], totalTimeSeconds: number) {
  return {
    schemaVersion: 2,
    id: 't',
    title: 'T',
    industry: 'X',
    difficulty: 'easy',
    estimatedMinutes: 1,
    totalTimeSeconds,
    prompt: 'The client has a problem.',
    exhibits: [],
    questions,
  }
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    caseId: 't',
    caseTitle: 'T',
    startedAt: new Date().toISOString(),
    practiceMode: false,
    questionIndex: 0,
    answers: [],
    peeked: [],
    ...overrides,
  }
}

async function main() {
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react-dom/test-utils')
  const { ChatScreen } = await import('../src/components/ChatScreen')

  const clock = () => document.querySelector('.clock')!.textContent
  const buttons = () => Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
  const byText = (re: RegExp) => buttons().find((b) => re.test(b.textContent || ''))
  const click = async (el: Element) => {
    await act(async () => {
      el.dispatchEvent(new dom.window.Event('click', { bubbles: true }))
    })
  }
  const typeAnswer = async (value: string) => {
    const ta = document.querySelector('.dock textarea') as HTMLTextAreaElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLTextAreaElement.prototype,
        'value',
      )!.set!
      setter.call(ta, value)
      ta.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
  }

  // ---------- timed mode ----------
  section('Timed mode: the case clock ends the case at 0:00')
  const submissions: { answer: string; secondsUsed: number }[] = []
  let timeUpCalls = 0
  const caseData = makeCase([textQuestion], 2)
  const root = createRoot(document.getElementById('root')!)
  await act(async () => {
    root.render(
      React.createElement(ChatScreen, {
        caseData,
        session: makeSession(),
        onSubmit: (a: never) => submissions.push(a),
        onTimeUp: () => {
          timeUpCalls++
        },
        onPeek: () => {},
        onExit: () => {},
      } as never),
    )
  })

  check('clock starts at the case limit', clock() === '0:02', `-> ${clock()}`)
  check('the case prompt is in the first bot bubble',
    document.body.innerHTML.includes('The client has a problem'))
  check('the question label is rendered', document.body.innerHTML.includes('(Question 1 of 1)'))
  check('answer key is closed by default',
    !document.body.innerHTML.includes('SECRET_KEY_POINT'))

  await typeAnswer('my partial answer')
  await act(async () => {
    await wait(1200)
  })
  check('clock ticks down', clock() !== '0:02', `-> stuck at ${clock()}`)
  check('nothing ended yet', timeUpCalls === 0)

  await act(async () => {
    await wait(1400)
  })
  check('clock reaches 0:00', clock() === '0:00', `-> ${clock()}`)
  check('the case is ended exactly once', timeUpCalls === 1, `-> ${timeUpCalls}`)
  check('the answer box locks when time is up',
    (document.querySelector('.dock textarea') as HTMLTextAreaElement).disabled)
  check('nothing was auto-submitted as an answer', submissions.length === 0)
  await act(async () => {
    root.unmount()
  })

  // ---------- practice mode ----------
  section('Practice mode: the clock runs but the case does not end')
  let practiceTimeUp = 0
  const practiceSubmissions: { answer: string; secondsUsed: number }[] = []
  const root2 = createRoot(document.getElementById('root')!)
  await act(async () => {
    root2.render(
      React.createElement(ChatScreen, {
        caseData: makeCase([textQuestion], 1),
        session: makeSession({ practiceMode: true }),
        onSubmit: (a: never) => practiceSubmissions.push(a),
        onTimeUp: () => {
          practiceTimeUp++
        },
        onPeek: () => {},
        onExit: () => {},
      } as never),
    )
  })
  await typeAnswer('still writing')
  await act(async () => {
    await wait(1600)
  })

  check('clock still shows 0:00', clock() === '0:00', `-> ${clock()}`)
  check('the case did not end', practiceTimeUp === 0, `-> ${practiceTimeUp}`)
  check('the answer box stays editable past zero',
    !(document.querySelector('.dock textarea') as HTMLTextAreaElement).disabled)

  await click(byText(/^Send$/)!)
  check('manual send is delivered', practiceSubmissions.length === 1)
  check('the typed answer survives', practiceSubmissions[0]?.answer === 'still writing')
  check('overtime is recorded honestly', practiceSubmissions[0]?.secondsUsed >= 1,
    `-> ${practiceSubmissions[0]?.secondsUsed}`)
  await act(async () => {
    root2.unmount()
  })

  // ---------- multiple select ----------
  section('Multiple select: Send unlocks only at exactly the requested count')
  const picks: { selected: number[]; answer: string }[] = []
  const peeks: string[] = []
  const root3 = createRoot(document.getElementById('root')!)
  await act(async () => {
    root3.render(
      React.createElement(ChatScreen, {
        caseData: makeCase([choiceQuestion], 600),
        session: makeSession({ peeked: [] }),
        onSubmit: (a: never) => picks.push(a),
        onTimeUp: () => {},
        onPeek: (id: string) => peeks.push(id),
        onExit: () => {},
      } as never),
    )
  })

  const options = () => Array.from(document.querySelectorAll('.option')) as HTMLButtonElement[]
  check('every option is offered', options().length === 3, `-> ${options().length}`)
  check('Send starts disabled', byText(/^Send$/)!.disabled)

  await click(options()[0])
  check('Send stays disabled after one of two picks', byText(/^Send$/)!.disabled)
  await click(options()[2])
  check('Send unlocks at exactly two picks', !byText(/^Send$/)!.disabled)
  check('the third option locks out once the count is met', options()[1].disabled)

  await click(options()[2])
  check('deselecting frees the locked option', !options()[1].disabled)
  await click(options()[1])

  // ---------- the answer key ----------
  section('The answer key is opt-in and its use is recorded')
  check('rationale is hidden while the drawer is shut',
    !document.body.innerHTML.includes('Rationale for Alpha'))
  await click(byText(/^Answer key$/)!)
  check('the drawer lists the question but not its key yet',
    document.body.innerHTML.includes('Q1 · Structuring') &&
      !document.body.innerHTML.includes('Rationale for Alpha'))
  await click(document.querySelector('.key-summary')!)
  check('opening a question records the peek', peeks.includes('q2'), `-> ${JSON.stringify(peeks)}`)
  check('the key is now readable', document.body.innerHTML.includes('Rationale for Alpha'))

  await click(byText(/^Send$/)!)
  check('the pick is delivered', picks.length === 1, `-> ${picks.length}`)
  check('indices are sorted', JSON.stringify(picks[0]?.selected) === '[0,1]',
    `-> ${JSON.stringify(picks[0]?.selected)}`)
  check('the answer text names the chosen options',
    picks[0]?.answer === 'Alpha | Bravo', `-> ${picks[0]?.answer}`)

  finish()
}

void main()
