# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build -> dist/
npm run typecheck  # tsc --noEmit
npm test           # runs every tests/*.test.ts(x)
```

Run a single test file (there is no test-name filter; `tests/run.mjs` always runs all files):

```bash
npx esbuild tests/timing.test.tsx --bundle --platform=node --format=cjs \
  --loader:.json=json --loader:.css=empty --loader:.md=text \
  --jsx=automatic --external:jsdom --outfile=.tmp/one.cjs --log-level=error && node .tmp/one.cjs
```

`tsconfig.json` includes only `src` and `vite.config.ts`, so **`npm run typecheck` and `npm run build` do not cover `tests/`**. Test files are only validated by running them.

## What this app is

A browser reimplementation of the BCG online case assessment: JSON-defined cases delivered as a
**chatbot**, ending in a markdown transcript the user pastes into an LLM for grading. No backend,
no API key, no runtime network calls. `npm run build` output is a deployable static bundle.

The fidelity target is the hosted product, not a generic study tool. That means:

- **One clock for the whole case** (`totalTimeSeconds`, default 35 min), not one per question.
  `Question.timeLimitSeconds` survives as an *advisory* pacing budget shown in the dock; nothing
  locks when it runs out. Only the case clock ends the case.
- **Questions are mostly multiple-select** ("select the two most relevant"), with numeric entry
  carrying explicit rounding instructions, and a single written recommendation last.
- **The interviewer answers back.** After each answer, `Question.followUp` is posted as a new bot
  bubble carrying the information later questions depend on. This is not optional decoration —
  the numeric chain breaks without it.

**The transcript is the product.** The app deliberately never scores anything, and never tells the
candidate whether they were right. When changing question flow or answer capture, the question to
ask is "does the transcript still give a grader everything it needs" — that is what
`src/lib/transcript.ts` exists to guarantee, and what most of `tests/cases.test.ts` asserts.

## Repo layout

```
src/cases/*.json        eleven bundled cases — one per BCG industry, each tagged with a
                        functionalPractice and carrying a verificationLog
src/components/         AssessmentIntro, CaseLibrary, CaseUpload   (landing)
                        CaseIntro                                  (pre-case briefing)
                        ChatScreen > MessageList + AnswerDock + AnswerKeyPanel, Exhibit
                        TranscriptView                             (the deliverable)
src/lib/                chat.ts (message derivation), timer.ts, transcript.ts,
                        validateCase.ts, storage.ts, authoringPrompt.ts
src/types/case.ts       the schema, SCHEMA_VERSION = 2
```

`SCHEMA_VERSION` is **2**. A v1 case still *loads* — `validateCase` only warns on a version
mismatch — but v1 has no `options`, `selectCount`, `followUp` or `totalTimeSeconds`, so it runs
as an all-free-text case on the default 35-minute clock. If you meet one, migrate it rather than
special-casing the reader.

## The answer key is opt-in and self-incriminating

`AnswerKeyPanel` is closed by default and **renders nothing into the DOM until the candidate
expands a specific question** — so the key cannot be read out of the page source either. Every
question opened is recorded in `Session.peeked`, copied onto the `AnswerRecord`, and surfaced in
the transcript as "**The answer key was open for this question.**" Do not make the panel render
eagerly for convenience; a test asserts it stays out of the DOM.

The split that matters: `followUp` is always shown (it is case information); `idealAnswer` is
always behind the key (it is the rubric). A `followUp` must never restate a figure the candidate
was just asked to compute — let wrong answers carry forward, which is what makes the transcript
diagnostic.

## The trust boundary (most important design decision)

Case JSON is validated for **structure only**. Declared answers (`idealAnswer.value`,
`idealAnswer.correctOptions`, exhibit figures) are **trusted and never recomputed** — this is
intentional, not an oversight.

Arithmetic correctness is enforced *upstream*, at authoring time, by `AUTHORING_PROMPT.md`: the
prompt users hand to an LLM requires it to compute every figure with a code-execution tool, run a
final assertion script re-deriving each answer from the exhibit values, and paste that output into
`authoring.verificationLog`. `validateCase` warns (does not reject) when that log is absent.

Consequences for anyone editing this repo:

- Do not add answer recomputation to `validateCase.ts`.
- If you change the case schema, change it in **three** places or the contract breaks:
  `src/types/case.ts`, `src/lib/validateCase.ts`, and the schema block in `AUTHORING_PROMPT.md`.
- If you hand-edit numbers in `src/cases/*.json`, verify them by executing a script, not mentally,
  and update that case's `verificationLog`. A past edit to the coffee case introduced an exhibit
  whose implied revenue ($831.6K) contradicted its own P&L ($840K); only running the arithmetic
  caught it. The verification must also cover **figures quoted in `followUp` prose and in
  `optionRationale`**, not just `idealAnswer.value` — those are the ones that rot silently.

## The landing page

`AssessmentIntro` explains the shape of the assessment before any case is offered — a hero with
the three constraints that define it (8–10 questions, one 35-minute clock, no scores shown) and
the five-stage arc every bundled case follows. `CaseLibrary` owns a client-side search that
filters on title, industry, difficulty, prompt text and question types. `CaseUpload` is a
three-step flow that **shows the authoring prompt in the page** (collapsed, with a fade, and
expandable) rather than hiding it behind a copy button — the prompt is the thing a user is being
asked to trust, so it is readable before it is copied.

## Architecture

State lives in `src/App.tsx` as plain `useState` — a `phase` field
(`library | intro | running | transcript`) switches screens, so there is no router. The `Session`
object (answers, timings, peeks) is written to localStorage on every submit and restored on mount,
so a refresh mid-case resumes.

`phase === 'running'` returns the full-viewport `ChatScreen` instead of the padded `.app` shell —
that early return in `App.tsx` is deliberate, since the chat owns the whole window.

**The chat is a pure function of the session.** `src/lib/chat.ts#buildMessages` derives the entire
conversation from `(case, session)`; no messages are stored. A refresh replays it exactly. When
adding anything to the conversation, add it there rather than accumulating message state.
`buildMessages` also suppresses a `followUpExhibitIds` hand-over when the very next question shows
the same exhibit, so exhibits do not render twice in a row.

**The timing contract** (`ChatScreen.tsx` + `lib/timer.ts`):

- `useDeadline` is anchored to `session.startedAt` (an absolute time), not to mount, so a refresh
  mid-case resumes on the *same* deadline and a backgrounded tab cannot drift.
- Timed mode: at 0:00 the case ends — `onTimeUp` fires, unanswered questions are transcribed as
  "not reached". The dock locks. Nothing is auto-submitted as an answer.
- Practice mode: the clock still runs and is recorded, but the case never ends.
- The per-question pacing budget is derived as `globalElapsed − (previous answer's timestamp)`,
  so it too survives a refresh rather than restarting.
- Both halves of this contract are asserted in `tests/timing.test.tsx`.

`AUTHORING_PROMPT.md` is imported into the bundle via `?raw` (see the module declaration in
`src/vite-env.d.ts`) so the app can both render it on the landing page and copy it to the
clipboard — editing the markdown file changes what users read and what the "Copy the prompt"
button hands them.

## Styling

`src/styles.css` is a **single light theme, deliberately**. The real assessment is a light chat on
a photographic backdrop; a dark variant would read as a different product. There is no dark-mode
block and none should be added without a reason to diverge from the reference.

Type and colour are set once as tokens at the top of the file:

- `--sans` is the **system UI stack** (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, …), used
  for everything; `--mono` stays on clocks, numeric inputs, tables and the transcript. Nothing is
  fetched and nothing is bundled, which keeps the "no runtime network calls" rule intact.
  An earlier revision self-hosted BCG's Henderson faces; they were removed before the repo was
  published, because `fonts.bcg.com` is CORS-locked to `https://www.bcg.com` (so hotlinking
  renders nothing) and self-hosting them meant redistributing a licensed typeface from a public
  deployment. Do not add them back to a public build.
- `--deep` (#0c2b15) is for dark bands: the hero, the "write your own case" header, the
  candidate's chat bubble, the toast. `--green` (#147b58) is the logo and every primary action.
  `--bright` (#96f878) is an accent **only on dark surfaces** — it fails contrast on white.
  All the pairings in use clear 5:1; re-check with a contrast script before introducing a new one.

Exhibit charts (`Exhibit.tsx`) use categorical slots 1–3 of a CVD-validated palette. **Three is the
cap** — a fourth slot puts yellow beside orange and fails the colour-blind separation floor. Every
bar is direct-labelled and every chart carries a "View as table" fallback, so identity and
magnitude never rest on colour alone. Author wider data as a table, and a single figure as a
`text` exhibit rather than a one-bar chart.

## Tests

Hand-rolled harness (`tests/harness.ts`), not vitest or jest — `tests/run.mjs` esbuilds each
`*.test.ts(x)` and runs it in Node. Assertions are `check(name, condition, detail)`; a file reports
via `finish()` and exits non-zero on failure.

`tests/timing.test.tsx` drives the real `ChatScreen` in jsdom against a **real clock** with a
1–2 second case clock, so it takes a few seconds and is timing-sensitive. Keep limits short but not
sub-second.

`tests/cases.test.ts` asserts the bundled cases keep the Casey *shape* — 8–10 questions, at least
one of each closed format, a written recommendation last, pacing budgets fitting inside the case
clock, an `optionRationale` for every option, and an `answerFormatNote` on every numeric question.
A new bundled case that skips these fails the suite.

When asserting on server-rendered markup, use the `text()` helper from the harness — React escapes
entities, so a raw `includes('P&L')` will fail against `P&amp;L`.

Chat timestamps render in the viewer's local time, so assert against `formatStamp(iso)` rather than
a hard-coded clock string.

## Note

A Gemini CLI config exists at `~/.gemini/settings.json`. If you want its user-level items (MCP servers, commands, instructions) available in Claude Code, reply `/import` to see what is importable, then `/import --yes=<digest>` to apply it. If `/import` is unavailable on this surface, run `claude import` from a terminal.
