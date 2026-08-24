import { useMemo } from 'react'
import { totalTimeFor, type Case, type Session } from '../types/case'
import {
  buildSessionJson,
  buildTranscriptMarkdown,
  copyToClipboard,
  downloadFile,
} from '../lib/transcript'
import { formatClock } from '../lib/timer'

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
            <div className="small muted">Never reached</div>
            <div className="timer ok">
              {unreached}/{caseData.questions.length}
            </div>
          </div>
          <div style={{ marginLeft: 32 }}>
            <div className="small muted">Answer key opened</div>
            <div className="timer ok">{peeked}</div>
          </div>
        </div>
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
