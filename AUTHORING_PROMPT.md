# Case-generation prompt for Web Casey

Give this whole document to Claude, ChatGPT, or Gemini **with code execution / Python enabled**.
Then add one line saying what case you want, e.g. "Write me a hard case about a European rail
operator losing freight share."

---

You are an experienced BCG case-interview author. Produce **one** practice case as a single JSON
object conforming exactly to the schema below. The case will be loaded by an app that reproduces
the BCG online case assessment, so it must be self-contained: no images, no external references,
no placeholders.

## What the assessment you are writing for actually looks like

This is not a live interview transcript. It is a chatbot. The candidate is shown one question at
a time, answers it, and the interviewer replies with the model context plus **new information**
that the next question depends on. There is **one clock for the whole case** — typically 35
minutes — not a clock per question.

Most questions are **multiple select** ("select the two most relevant"), a substantial minority
are **numeric entry** with an explicit rounding instruction, and the final question is a short
**written recommendation** to the client. Write to that shape, not to an open-ended conversation.

## Non-negotiable rule: every number must be tool-verified

You have a code execution tool. Use it.

1. Before writing any JSON, decide the underlying business model of the case (volumes, prices,
   costs, growth rates) and **compute every derived figure in code** — never in your head, never
   "approximately". This includes each exhibit cell, each `idealAnswer.value`, **and every number
   you quote inside a `followUp` or an `optionRationale`**.
2. The numbers in your exhibits and the numbers in your worked solutions must come from the *same*
   computation. Do not retype them; print them from the script and copy the printed values.
3. After drafting the JSON, run a **final verification script**: hard-code the exhibit values
   exactly as they appear in your JSON, re-derive every `idealAnswer.value` from them, and
   `assert` each one matches within the question's `tolerancePct`. Assert every figure quoted in
   prose too. For each `choice` question whose options make factual claims, print the claim and
   the computed evidence for it, so the correct set is provably correct. Assert the structure as
   well: the sum of `timeLimitSeconds` fits inside `totalTimeSeconds`, and every exhibit id is
   referenced by some question's `exhibitIds` or `followUpExhibitIds`.
4. If any assertion fails, fix the JSON and run the script again. Repeat until all pass.
5. Paste the final script's output verbatim into `authoring.verificationLog`, and set
   `authoring.mathVerifiedWith` to the tool you used.

A case emitted without having actually executed step 3 is a failed response. The app trusts your
declared answers completely — it does not recompute them — so this is the only thing standing
between a learner and a wrong answer key.

Also check, in code, that the numbers are *interview-realistic*: percentages within a plausible
range, margins that are not negative by accident, market shares summing to ≤ 100%, and figures
round enough that a candidate can do them mentally on paper (prefer 240 and 15% over 237.4 and
14.6%).

## Schema

For `industry`, use one of BCG's: Consumer; Industrial Goods; Tech, Media & Communications;
Financial Institutions; Energy; Principal Investors & Private Equity; Health Care; Insurance;
Public Sector; Travel, Cities & Infrastructure; BCG Transform (turnarounds). For
`functionalPractice`, pick the one of the nine practices the case's mechanics genuinely lean on —
Corporate Finance & Strategy; Marketing, Sales & Pricing; People & Organization; Operations;
Tech & Digital Advantage; Global Advantage; Social Impact; Risk and Compliance; Climate and
Sustainability — not the nearest-sounding label: a cost-reduction case is Operations even if the
client is a tech company.

```jsonc
{
  "schemaVersion": 2,
  "id": "kebab-case-unique-id",
  "title": "Human readable title",
  "industry": "e.g. Consumer",
  "functionalPractice": "e.g. Marketing, Sales & Pricing",
  "difficulty": "easy | medium | hard",
  "estimatedMinutes": 35,
  "totalTimeSeconds": 2100,            // the single clock for the whole case; 2100 = 35 min

  // The situation read to the candidate, shown in the first chat bubble above
  // question 1. 3-6 sentences: client, context, and the specific question they are
  // being asked to answer. No hints about the framework.
  "prompt": "Our clients are ...",

  "exhibits": [
    {
      "id": "ex1",
      "title": "Exhibit 1 — Revenue by segment, 2021 vs 2024",
      "type": "table",                 // "table" | "chart" | "text" | "image"
      "table": {
        "columns": ["Segment", "2021", "2024"],
        "rows": [["Retail", 120, 95], ["Wholesale", 60, 88]]
      },
      "unitsNote": "$M unless stated",
      "source": "Client data"
    },
    {
      "id": "ex2",
      "title": "Exhibit 2 — Planned sites by operator",
      "type": "chart",
      "chart": {
        "kind": "bar",                 // "bar" (grouped) | "stacked-bar"
        "categories": ["Operator A", "Operator B"],
        "series": [{ "label": "Planned sites", "values": [25.2, 16.8] }],
        "valueSuffix": "K"
      }
    }
    // "text" exhibits use { "text": "..." } instead. Use one for a single figure
    //   rather than drawing a chart with one bar.
    // "image" exhibits use { "src": "data:image/png;base64,..." } -- avoid these.
    // Charts render at most THREE series; author anything wider as a table.
  ],

  "questions": [
    {
      "id": "q1",
      "type": "structuring | math | exhibit | brainstorming | synthesis",
      "timeLimitSeconds": 120,         // ADVISORY pacing budget shown to the candidate.
                                       // Nothing locks when it runs out -- only the
                                       // case clock ends the case. The sum of these
                                       // must be <= totalTimeSeconds.
      "prompt": "What the interviewer says out loud.",
      "exhibitIds": ["ex1"],           // exhibits shown with this question

      "responseFormat": "choice",      // "choice" | "number" | "text"

      // --- responseFormat "choice" ---
      "options": ["...", "...", "..."],   // 5-8 options, one line each
      "selectCount": 2,                   // how many the candidate must pick

      // --- responseFormat "number" ---
      "unit": "$M",
      "tolerancePct": 2,
      "answerFormatNote": "Enter in $ millions, rounded to the nearest million.",

      // --- responseFormat "text" ---
      "maxLines": 8,

      "idealAnswer": {
        "correctOptions": [1, 2],         // required for "choice"; length == selectCount
        "optionRationale": ["...", "..."],// one entry per option, correct AND wrong
        "value": 42.5,                    // required for "number"
        "workedSolution": "Step 1 ...\nStep 2 ...",
        "keyPoints": ["...", "..."],
        "commonMistakes": ["..."]
      },

      // What the interviewer says once the answer is in. ALWAYS shown to the
      // candidate, so it must not be the rubric -- it is the NEW INFORMATION that
      // later questions depend on. See the rule below.
      "followUp": "The clients are ...",
      "followUpExhibitIds": ["ex1", "ex2"],

      "scoringWeights": { "structure": 0.4, "accuracy": 0.4, "communication": 0.2 }
    }
  ],

  "closing": "What the interviewer says once every question is answered.",

  "authoring": {
    "model": "the model you are",
    "generatedAt": "YYYY-MM-DD",
    "mathVerifiedWith": "code-execution",
    "verificationLog": "paste the final verification script output here"
  }
}
```

## The followUp rule

`followUp` is shown to every candidate. `idealAnswer` is hidden behind an answer key the
candidate has to choose to open, and opening it is recorded against them. So:

- Put in `followUp` anything a **later question depends on**: new client facts, the objective,
  the terms of a deal, the definition of a cost line, an exhibit hand-over.
- When a later question needs a figure the candidate has already calculated, do **not** restate
  their figure in the `followUp`. Let a wrong answer carry forward — that is what the real
  assessment does, and it is what makes the transcript diagnostic. Give the *parallel* figure they
  were not asked for (the other company, the other segment) when the case needs it.
- Never put the rubric, the key points, or "correct!" in a `followUp`. The app deliberately never
  tells the candidate whether they were right.

## Question design rules

- **8 to 10 questions.** Roughly half `choice`, a third `number`, and the last one `text`.
- The sum of `timeLimitSeconds` must fit inside `totalTimeSeconds`, with room to spare — the
  candidate reads as well as answers.
- `choice` — 5 to 8 options, of which `selectCount` are correct. The wrong options must be
  *plausible*: things a weak candidate would genuinely pick, not filler. Every option needs an
  `optionRationale` entry, including the wrong ones — that is what teaches. Where an option makes
  a factual claim about an exhibit, prove it in the verification script.
- `number` — one number, always with `unit`, `tolerancePct` (2 unless rounding makes a wider band
  fair) and `answerFormatNote`. The note must be explicit about rounding and about signs: if the
  answer is a loss, say whether to enter it with a minus sign. `workedSolution` must show every
  arithmetic step, using the exact figures printed by your script.
- `exhibit` — must reference at least one exhibit in `exhibitIds`, and the answer must be
  impossible to give without reading it. Ask for the *so what*, not just the read.
- `brainstorming` — best written as a `choice` question over levers or risks, so the candidate is
  scored on judgement rather than on volume of ideas.
- `synthesis` — the last question, `responseFormat: "text"`, with `maxLines` of 6 to 8. Frame it
  the way the real thing does: a hallway conversation with the CEO.
- Build the case so the numbers **chain**: question 6 should need what question 5 established.
  That is what makes a case feel like a case rather than a quiz.
- Give the case **one real insight** — a point where the naive calculation is wrong and the
  correct one changes the answer: paying for peak capacity when you use the average, incremental
  profit versus total profit, cost per outcome versus cost per participant, a discount funded by
  a claims reduction. Design the trap into a question, and let the `followUp` name the principle
  once the candidate has committed. A case without one is arithmetic with a story attached.
- Every exhibit must actually reach the candidate — referenced by some question's `exhibitIds`
  or handed over in a `followUpExhibitIds`. An exhibit nobody is shown is dead weight. (Handing
  an exhibit over in a `followUp` and listing it again on the next question is safe: the app
  will not render it twice in a row.)
- Every question needs `commonMistakes` — the specific traps in *this* case, not generic advice.
- `scoringWeights` values should sum to 1.0.

## Output format

Run your verification first. Then reply with **only** the JSON, in a single fenced ```json block,
with no commentary before or after it — it gets pasted straight into the app. Ensure it parses:
no trailing commas, no comments, no `NaN`, all strings double-quoted.
