import { renderToStaticMarkup } from 'react-dom/server'
import App from '../src/App'
import { CaseIntro } from '../src/components/CaseIntro'
import { MessageList } from '../src/components/MessageList'
import { AnswerDock } from '../src/components/AnswerDock'
import { TranscriptView } from '../src/components/TranscriptView'
import { buildMessages } from '../src/lib/chat'
import { formatStamp } from '../src/lib/timer'
import telco from '../src/cases/telco-network-jv.json'
import type { Case, Session } from '../src/types/case'
import { check, finish, section, text } from './harness'

const c = telco as unknown as Case
const noop = () => {}

section('App shell renders the library')
const appHtml = renderToStaticMarkup(<App />)
const app = text(appHtml)
check('mounts without throwing', app.length > 0)
check('lists all four bundled cases',
  app.includes('Sadong and MinSol') && app.includes('Corvo Coffee') &&
    app.includes('Meridian Air') && app.includes('St Brendan'))
check('shows the case clock rather than a per-question total', app.includes('35:00 on the clock'))
check('offers the upload panel', app.includes('Validate and add'))
check('explains the structure of the assessment before the cases',
  app.includes('How a case is built') && app.includes('Prompt and clarifiers') &&
    app.includes('Recommendation'))
check('states the assessment conditions up front',
  app.includes('8–10') && app.includes('35 min'))
// the placeholder lives in an attribute, so assert against the raw markup
check('offers a search box over the library',
  appHtml.includes('type="search"') && appHtml.includes('Search industry, difficulty, topic'))
check('shows the authoring prompt in the page, not just a copy button',
  app.includes('Copy the prompt') && app.includes('Non-negotiable rule: every number'))

section('The intro sets the assessment conditions')
const intro = text(renderToStaticMarkup(
  <CaseIntro caseData={c} practiceMode={false} onPracticeModeChange={noop}
    onBegin={noop} onBack={noop} />,
))
check('states the single case clock', intro.includes('35:00 for the whole case'))
check('counts the question formats', intro.includes('multiple select') && intro.includes('numeric entry'))
check('warns that the answer key is recorded', intro.includes('flagged in your transcript'))
check('does NOT leak the case prompt before the candidate begins',
  !intro.includes('South Korea'))

section('The chat replays the conversation without leaking the key')
const session: Session = {
  caseId: c.id, caseTitle: c.title, startedAt: '2026-08-23T10:00:00.000Z',
  practiceMode: false, questionIndex: 4, peeked: [],
  answers: c.questions.slice(0, 4).map((q, i) => ({
    questionId: q.id,
    answer: q.responseFormat === 'choice' ? 'picked' : '100',
    selected: q.responseFormat === 'choice' ? [1] : undefined,
    secondsUsed: 60,
    at: `2026-08-23T10:1${i}:00.000Z`,
    autoSubmitted: false,
  })),
}
const chat = text(renderToStaticMarkup(
  <MessageList caseData={c} messages={buildMessages(c, session)} />,
))
check('opens with the interviewer', chat.includes('8 questions in total') || chat.includes('10 questions in total'))
check('shows the case prompt', chat.includes('South Korea'))
check('numbers each question', chat.includes('(Question 1 of 10)') && chat.includes('(Question 5 of 10)'))
check('shows the candidate answers back', chat.includes('Who are our clients'))
// stamps render in the viewer's local time, so derive the expected value
check('stamps the candidate messages',
  chat.includes(formatStamp('2026-08-23T10:10:00.000Z')))
check('releases the follow-up information', chat.includes('market shares of 33% and 25%'))
check('renders the exhibits that were handed over',
  chat.includes('Subscribers (M)') && chat.includes('Annual fixed cost ($M)'))
check('does NOT show the answer key', !chat.includes('Growth rates matter for a market-sizing case'))
check('does NOT show questions the candidate has not reached',
  !chat.includes('(Question 6 of 10)'))

section('The dock matches the question format')
const choiceDock = text(renderToStaticMarkup(
  <AnswerDock question={c.questions[0]} softElapsed={10} disabled={false} onSend={noop} />,
))
check('lists every option as a button', c.questions[0].options!.every((o) => choiceDock.includes(o)))
check('says how many to select', choiceDock.includes('Select 2: 0/2 chosen'))
check('shows the pacing budget', choiceDock.includes('of suggested time left'))

const numberDock = text(renderToStaticMarkup(
  <AnswerDock question={c.questions[3]} softElapsed={10} disabled={false} onSend={noop} />,
))
check('shows the rounding instruction', numberDock.includes('without a minus sign'))
check('offers optional working', numberDock.includes('show your working'))
check('does NOT leak the expected value', !numberDock.includes('12.5B'))

const overDock = text(renderToStaticMarkup(
  <AnswerDock question={c.questions[0]} softElapsed={200} disabled={false} onSend={noop} />,
))
check('flags running over the suggested pace', overDock.includes('on this question — suggested'))

section('Transcript screen')
const done: Session = { ...session, questionIndex: c.questions.length }
const tv = text(renderToStaticMarkup(
  <TranscriptView caseData={c} session={done} onRestart={noop} onLibrary={noop} notify={noop} />,
))
check('offers the copy button', tv.includes('Copy transcript for an LLM'))
check('offers both downloads', tv.includes('Download .md') && tv.includes('Download session .json'))
check('counts the questions never reached', tv.includes('6/10'))
check('reports against the case clock', tv.includes('of the 35:00 case clock'))
check('shows the transcript body', tv.includes('please grade') && tv.includes('South Korea'))

finish()
