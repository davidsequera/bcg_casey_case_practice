import { totalTimeFor, type Case, type ResponseFormat } from '../types/case'
import { formatClock } from '../lib/timer'

const FORMAT_LABEL: Record<ResponseFormat, string> = {
  choice: 'multiple select',
  number: 'numeric entry',
  text: 'written answer',
}

export function CaseIntro({
  caseData,
  practiceMode,
  onPracticeModeChange,
  onBegin,
  onBack,
}: {
  caseData: Case
  practiceMode: boolean
  onPracticeModeChange: (v: boolean) => void
  onBegin: () => void
  onBack: () => void
}) {
  const total = totalTimeFor(caseData)
  const counts = caseData.questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.responseFormat] = (acc[q.responseFormat] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      <button className="ghost" onClick={onBack} style={{ marginBottom: 16 }}>
        ← Library
      </button>

      <div className="panel">
        <div className="row">
          <span className={`tag ${caseData.difficulty}`}>{caseData.difficulty}</span>
          <span className="tag">{caseData.industry}</span>
        </div>
        <h1 style={{ marginTop: 12 }}>{caseData.title}</h1>

        <h3 style={{ marginTop: 20 }}>How this runs</h3>
        <ul>
          <li>
            <strong>{caseData.questions.length} questions</strong>, asked one at a time in a chat,
            with <strong>{formatClock(total)} for the whole case</strong> — one clock, not one per
            question.
          </li>
          <li>
            {Object.entries(counts)
              .map(([f, n]) => `${n} ${FORMAT_LABEL[f as ResponseFormat]}`)
              .join(', ')}
            . Each question shows a suggested pace so you know if you are falling behind.
          </li>
          <li>
            You cannot go back. After each answer the interviewer releases new information you
            will need later, so read it.
          </li>
          <li>
            The answer key is available at any point but stays closed unless you open it, and
            every question you open is flagged in your transcript.
          </li>
        </ul>
        <p className="muted">
          Use a calculator and paper, exactly as you would in the real assessment. At the end you
          get a transcript to paste into an LLM for grading.
        </p>

        <label className="check" style={{ marginTop: 18 }}>
          <input
            type="checkbox"
            checked={practiceMode}
            onChange={(e) => onPracticeModeChange(e.target.checked)}
          />
          <span>
            Practice mode — the clock still runs and is recorded, but the case does not end at
            0:00
          </span>
        </label>

        <div className="row" style={{ marginTop: 18 }}>
          <button className="primary" onClick={onBegin}>
            Begin — the timer starts immediately
          </button>
        </div>
      </div>
    </div>
  )
}
