import { useEffect, useMemo, useState } from 'react'
import type { Case, Phase, Session } from './types/case'
import { CaseLibrary } from './components/CaseLibrary'
import { CaseUpload } from './components/CaseUpload'
import { CaseIntro } from './components/CaseIntro'
import { AssessmentIntro } from './components/AssessmentIntro'
import { ChatScreen, type ChatSubmission } from './components/ChatScreen'
import { TranscriptView } from './components/TranscriptView'
import {
  clearCompletedCaseIds,
  deleteUploadedCase,
  loadCompletedCaseIds,
  loadSession,
  loadUploadedCases,
  saveSession,
  saveUploadedCase,
  toggleCaseCompleted,
} from './lib/storage'

import coffee from './cases/coffee-chain-profitability.json'
import pumps from './cases/pumps-vietnam-plant.json'
import cloud from './cases/media-cloud-migration.json'
import bank from './cases/bank-fraud-losses.json'
import coal from './cases/coal-retirement.json'
import vets from './cases/pe-vet-referral.json'
import hospital from './cases/hospital-cost-reduction.json'
import motor from './cases/motor-telematics-pricing.json'
import jobs from './cases/jobs-programme.json'
import airline from './cases/airline-market-entry.json'
import turnaround from './cases/department-store-turnaround.json'

/** One case per industry, in the order of the practice-area map. */
const BUNDLED: Case[] = [
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
] as unknown as Case[]

function newSession(c: Case, practiceMode: boolean): Session {
  return {
    caseId: c.id,
    caseTitle: c.title,
    startedAt: new Date().toISOString(),
    practiceMode,
    questionIndex: 0,
    answers: [],
    peeked: [],
  }
}

export default function App() {
  const [uploaded, setUploaded] = useState<Case[]>(() => loadUploadedCases())
  const [phase, setPhase] = useState<Phase>('library')
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [practiceMode, setPracticeMode] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [completedIds, setCompletedIds] = useState<string[]>(() => loadCompletedCaseIds())

  const allCases = useMemo(() => [...BUNDLED, ...uploaded], [uploaded])
  const activeCase = allCases.find((c) => c.id === activeCaseId) ?? null

  // resume an in-flight session after a refresh
  useEffect(() => {
    const saved = loadSession()
    if (!saved) return
    const c = [...BUNDLED, ...loadUploadedCases()].find((x) => x.id === saved.caseId)
    if (!c) return
    setActiveCaseId(c.id)
    setSession({ ...saved, peeked: saved.peeked ?? [] })
    setPracticeMode(saved.practiceMode)
    setPhase(saved.questionIndex >= c.questions.length ? 'transcript' : 'running')
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(id)
  }, [toast])

  const notify = (msg: string) => setToast(msg)

  const startCase = (c: Case) => {
    setActiveCaseId(c.id)
    setSession(null)
    saveSession(null)
    setPhase('intro')
  }

  const begin = () => {
    if (!activeCase) return
    const s = newSession(activeCase, practiceMode)
    setSession(s)
    saveSession(s)
    setPhase('running')
  }

  const commit = (next: Session) => {
    setSession(next)
    saveSession(next)
  }

  const submitAnswer = (a: ChatSubmission) => {
    if (!activeCase || !session) return
    const q = activeCase.questions[session.questionIndex]
    if (!q) return
    const next: Session = {
      ...session,
      answers: [
        ...session.answers,
        {
          questionId: q.id,
          answer: a.answer,
          selected: a.selected,
          scratch: a.scratch,
          secondsUsed: a.secondsUsed,
          at: new Date().toISOString(),
          autoSubmitted: a.autoSubmitted,
          peeked: session.peeked.includes(q.id),
        },
      ],
      questionIndex: session.questionIndex + 1,
    }
    commit(next)
    if (next.questionIndex >= activeCase.questions.length) setPhase('transcript')
  }

  /** The case-level clock ran out, or the candidate ended early. */
  const endCase = () => {
    if (!activeCase || !session) return
    if (phase === 'transcript') return
    commit({ ...session, questionIndex: activeCase.questions.length })
    setPhase('transcript')
  }

  const peek = (questionId: string) => {
    if (!session || session.peeked.includes(questionId)) return
    commit({ ...session, peeked: [...session.peeked, questionId] })
  }

  const toLibrary = () => {
    setPhase('library')
    setActiveCaseId(null)
    setSession(null)
    saveSession(null)
  }

  if (phase === 'running' && activeCase && session) {
    return (
      <>
        <ChatScreen
          caseData={activeCase}
          session={session}
          onSubmit={submitAnswer}
          onTimeUp={endCase}
          onPeek={peek}
          onExit={endCase}
        />
        {toast ? <div className="toast">{toast}</div> : null}
      </>
    )
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          Web <span>Casey</span>
        </div>
        <div className="small muted">
          Timed case practice · answers graded by the LLM of your choice
        </div>
      </div>

      {phase === 'library' ? (
        <>
          <AssessmentIntro />
          <CaseLibrary
            bundled={BUNDLED}
            uploaded={uploaded}
            completedIds={completedIds}
            onStart={startCase}
            onDelete={(id) => {
              setUploaded(deleteUploadedCase(id))
              notify('Case removed')
            }}
            onToggleCompleted={(id) => setCompletedIds(toggleCaseCompleted(id))}
            onClearCompleted={() => {
              setCompletedIds(clearCompletedCaseIds())
              notify('Completed cases cleared')
            }}
          />
          <CaseUpload notify={notify} onAdd={(c) => setUploaded(saveUploadedCase(c))} />
        </>
      ) : null}

      {phase === 'intro' && activeCase ? (
        <CaseIntro
          caseData={activeCase}
          practiceMode={practiceMode}
          onPracticeModeChange={setPracticeMode}
          onBegin={begin}
          onBack={toLibrary}
        />
      ) : null}

      {phase === 'transcript' && activeCase && session ? (
        <TranscriptView
          caseData={activeCase}
          session={session}
          notify={notify}
          onRestart={() => startCase(activeCase)}
          onLibrary={toLibrary}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
