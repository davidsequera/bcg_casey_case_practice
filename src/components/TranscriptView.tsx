import { useMemo } from 'react'
import { totalTimeFor, type Case, type Session } from '../types/case'
import {
  buildSessionJson,
  buildTranscriptMarkdown,
  copyToClipboard,
  downloadFile,
} from '../lib/transcript'
import { formatClock } from '../lib/timer'
import { scoreSession } from '../lib/score'

export function TranscriptView({
  caseData,
  session,
  onRestart,
  onLibrary,
  notify,
}: {
  caseData: Case
  session: Session
  onRestart: () => void
  onLibrary: () => void
  notify: (msg: string) => void
}) {
  const markdown = useMemo(
    () => buildTranscriptMarkdown(caseData, session),
    [caseData, session],
  )

  const totalUsed = session.answers.reduce((s, a) => s + a.secondsUsed, 0)
  const totalLimit = totalTimeFor(caseData)
  const unreached = caseData.questions.length - session.answers.length
  const peeked = session.answers.filter((a) => a.peeked).length
  const slug = caseData.id.replace(/[^a-z0-9-]/gi, '-')
  const score = useMemo(() => scoreSession(caseData, session), [caseData, session])

  return (
    <div>
      <h1>Case complete</h1>
      <p className="muted">
        Copy the transcript below and paste it into Claude, ChatGPT, or Gemini. It carries the
        case, the rubrics, your answers and your timings, plus grading instructions — nothing
        else needs to be explained to the model.
      </p>

      <div className="panel">
        <div className="row">
          <div>
            <div className="small muted">Time used</div>
            <div className="timer ok">{formatClock(totalUsed)}</div>
            <div className="small muted">of the {formatClock(totalLimit)} case clock</div>
          </div>
          <div style={{ marginLeft: 32 }}>
            <div className="small muted">Closed questions</div>
            <div className="timer ok">
              {score.correct}/{score.scorable}
            </div>
            <div className="small muted">answered correctly</div>
          </div>
          <div style={{ marginLeft: 32 }}>
            <div className="small muted">Never reached</div>
            <div className="timer ok">{unreached}</div>
            <div className="small muted">of {caseData.questions.length} questions</div>
          </div>
          <div style={{ marginLeft: 32 }}>
            <div className="small muted">Answer key opened</div>
            <div className="timer ok">{peeked}</div>
            <div className="small muted">
              {peeked === 1 ? 'question' : 'questions'}
            </div>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Only the multiple-select and numeric questions can be checked mechanically, against the
          answers the case declares. The {score.unscored} written{' '}
          {score.unscored === 1 ? 'question is' : 'questions are'} left unscored — paste the
          transcript below to have those judged, and to find out <em>why</em> anything above went
          wrong.
        </p>
      </div>

      <div className="panel">
        <div className="row" style={{ marginBottom: 14 }}>
          <button
            className="primary"
            onClick={async () => {
              const ok = await copyToClipboard(markdown)
              notify(ok ? 'Transcript copied — paste it into your LLM' : 'Clipboard blocked; use Download instead')
            }}
          >
            Copy transcript for an LLM
          </button>
          <button onClick={() => downloadFile(`${slug}-transcript.md`, markdown, 'text/markdown')}>
            Download .md
          </button>
          <button
            onClick={() =>
              downloadFile(
                `${slug}-session.json`,
                buildSessionJson(caseData, session),
                'application/json',
              )
            }
          >
            Download session .json
          </button>
        </div>

        <pre className="transcript-pre">{markdown}</pre>
      </div>

      <div className="row">
        <button onClick={onRestart}>Retake this case</button>
        <button className="ghost" onClick={onLibrary}>
          Back to library
        </button>
      </div>
    </div>
  )
}
