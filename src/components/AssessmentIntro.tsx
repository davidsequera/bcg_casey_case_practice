interface Stage {
  n: string
  title: string
  body: string
  format: string
}

/** The arc every case in the library follows, in the order it is asked. */
const STAGES: Stage[] = [
  {
    n: 'Stage 1',
    title: 'Prompt and clarifiers',
    body: 'The situation lands in one bubble. You pick the two things worth checking first.',
    format: 'multiple select',
  },
  {
    n: 'Stage 2',
    title: 'Structure',
    body: 'Choose what you would investigate, from a list seeded with plausible wrong turns.',
    format: 'multiple select',
  },
  {
    n: 'Stage 3',
    title: 'Exhibits and the maths',
    body: 'Tables and charts arrive mid-chat. Each answer feeds the next, so a slip carries.',
    format: 'numeric entry',
  },
  {
    n: 'Stage 4',
    title: 'Risks',
    body: 'Judgement, not volume: name the risks your own numbers just raised.',
    format: 'multiple select',
  },
  {
    n: 'Stage 5',
    title: 'Recommendation',
    body: 'A hallway word with the CEO. Eight lines, top-down, no narrating the maths.',
    format: 'written answer',
  },
]

export function AssessmentIntro() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Practice environment</p>
        <h1>The BCG online case, as a chatbot</h1>
        <p className="lede">
          The real assessment is not an interview — it is a chat. One case arrives a question at a
          time, on a single clock, and you cannot go back. Every case here runs under those
          conditions and ends in a transcript you hand to an LLM for a blunt debrief.
        </p>
        <div className="hero-stats">
          <div>
            <b>8–10</b>
            <span>questions per case</span>
          </div>
          <div>
            <b>35 min</b>
            <span>one clock, not one per question</span>
          </div>
          <div>
            <b>0</b>
            <span>scores shown — the transcript is the output</span>
          </div>
        </div>
      </section>

      <section className="stages">
        <h2>How a case is built</h2>
        <p>
          Questions arrive in this order. After each answer the interviewer replies with new client
          information the later questions depend on, so reading the replies is part of the exercise.
        </p>
        <div className="stage-list">
          {STAGES.map((s) => (
            <article className="stage" key={s.n}>
              <b>{s.n}</b>
              <h4>{s.title}</h4>
              <p>{s.body}</p>
              <span className="fmt">{s.format}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
