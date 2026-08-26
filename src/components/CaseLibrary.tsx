import { useMemo, useState } from 'react'
import {
  QUESTION_TYPE_LABEL,
  totalTimeFor,
  type Case,
  type QuestionType,
} from '../types/case'
import { formatClock } from '../lib/timer'

function typesIn(c: Case): QuestionType[] {
  return Array.from(new Set(c.questions.map((q) => q.type)))
}

/** Everything a candidate might reasonably type into the search box. */
function haystack(c: Case): string {
  return [
    c.title,
    c.industry,
    c.functionalPractice ?? '',
    c.difficulty,
    c.prompt,
    ...typesIn(c).map((t) => QUESTION_TYPE_LABEL[t]),
  ]
    .join(' ')
    .toLowerCase()
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
    </svg>
  )
}

export function CaseLibrary({
  bundled,
  uploaded,
  onStart,
  onDelete,
}: {
  bundled: Case[]
  uploaded: Case[]
  onStart: (c: Case) => void
  onDelete: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const filter = useMemo(
    () => (list: Case[]) => (q === '' ? list : list.filter((c) => haystack(c).includes(q))),
    [q],
  )

  const shownBundled = filter(bundled)
  const shownUploaded = filter(uploaded)
  const total = shownBundled.length + shownUploaded.length

  const render = (c: Case, isUploaded: boolean) => (
    <article className="case-card" key={c.id}>
      <div className="row">
        <span className={`tag ${c.difficulty}`}>{c.difficulty}</span>
        {isUploaded ? <span className="tag uploaded">yours</span> : null}
      </div>
      <h3>{c.title}</h3>
      <div className="case-meta">
        {c.industry}
        {c.functionalPractice ? ` · ${c.functionalPractice}` : ''} · {c.questions.length} questions
        · {formatClock(totalTimeFor(c))} on the clock
      </div>
      <div className="case-meta">
        {typesIn(c)
          .map((t) => QUESTION_TYPE_LABEL[t])
          .join(' · ')}
      </div>
      <div className="row" style={{ marginTop: 'auto', paddingTop: 8 }}>
        <button className="primary" onClick={() => onStart(c)}>
          Start case
        </button>
        {isUploaded ? (
          <button className="danger-text" onClick={() => onDelete(c.id)}>
            Remove
          </button>
        ) : null}
      </div>
    </article>
  )

  return (
    <section className="library">
      <div className="library-head">
        <div>
          <h2>Case library</h2>
          <p className="muted small">
            {q === ''
              ? `${bundled.length + uploaded.length} cases · pick one and the clock starts`
              : `${total} of ${bundled.length + uploaded.length} cases match`}
          </p>
        </div>
        <div className="search">
          <SearchIcon />
          <input
            type="search"
            value={query}
            aria-label="Search cases by title, industry, difficulty or question type"
            placeholder="Search industry, difficulty, topic…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {total === 0 ? (
        <div className="library-empty">
          <p className="last">
            Nothing matches “{query}”. Try an industry, a difficulty, or a question type — or write
            a case on that subject below.
          </p>
        </div>
      ) : null}

      {shownBundled.length > 0 ? (
        <div className="case-grid">{shownBundled.map((c) => render(c, false))}</div>
      ) : null}

      {shownUploaded.length > 0 ? (
        <div className="library-section">
          <h3>Your cases</h3>
          <div className="case-grid">{shownUploaded.map((c) => render(c, true))}</div>
        </div>
      ) : null}
    </section>
  )
}
