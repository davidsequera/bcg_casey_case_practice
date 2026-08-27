# Web Casey

A browser reimplementation of the **BCG online case assessment**, built for practice.

The real thing is not an interview — it is a chatbot. One case arrives a question at a time, on a
single 35-minute clock, and you cannot go back. This runs under the same conditions and ends in a
markdown transcript you paste into an LLM for a blunt debrief.

No backend, no API key, no runtime network calls. `npm run build` produces a static bundle.

## What it does

- **Questions arrive in a chat.** Case prompt, then `(Question 3 of 10)`, then your answer, then
  the interviewer replies with new client information the next question depends on.
- **The real answer formats.** Mostly *"select the two most relevant"* multiple-select; numeric
  entry with explicit rounding instructions; one written recommendation at the end.
- **One clock for the whole case**, not one per question. Each question shows an advisory pace so
  you know if you are falling behind, but only the case clock ends the case.
- **It never scores you.** The answer key exists, stays closed unless you open it, and records
  every question you opened so your grader can weigh it. The verdict comes from the transcript.
- **Bring your own cases.** Copy the built-in authoring prompt into an LLM with code execution
  enabled, paste the JSON back, and it is schema-checked and added to your library. Uploaded cases
  live in your browser's localStorage and go nowhere else.

## Running it

```bash
npm install
npm run dev        # Vite dev server
npm run build      # -> dist/
npm run typecheck  # tsc --noEmit
npm test           # hand-rolled harness, runs every tests/*.test.ts(x)
```

## The bundled cases, and why the arithmetic is trustworthy

Four cases ship with it: a telco network JV, a coffee-chain profitability collapse, an airline
route entry, and a hospital cost programme.

Case JSON is validated for **structure only** — declared answers are never recomputed at runtime.
That is deliberate. Correctness is enforced at *authoring* time: every figure in every bundled case
was derived by an executed script that re-derives each answer from the exhibit values and asserts
it matches, including the numbers quoted in follow-up prose. That script's output is pasted
verbatim into each case's `authoring.verificationLog`, and `AUTHORING_PROMPT.md` requires the same
of any case you generate yourself.

If you hand-edit a number, run the arithmetic — do not do it in your head. An earlier edit put an
exhibit's implied revenue ($831.6K) at odds with its own P&L ($840K), and only executing it caught
that.

## Attribution and disclaimers

- **Not affiliated with, endorsed by, or connected to Boston Consulting Group.** "BCG" and
  "Casey" are used only to describe what this practice tool imitates.
- The telco case is adapted from a walkthrough published publicly on YouTube by Prep Matters, who
  state their case was independently created for educational purposes. The prose, options and
  rationales here are rewritten; the scenario and figures follow theirs.
- The other three cases are original.
- The interface uses BCG's brand colours to feel familiar. It does **not** bundle BCG's Henderson
  typeface — that is licensed, so the app uses the system UI sans instead.

## Licence

Code: GPL-3.0 (see `LICENSE`). The case content is provided for personal interview practice.


## Cases 

  ┌─────────────────────────┬─────────────────────────────────────────────────────────────────────────┬───────────────────────┬────────────┐
  │        Industry         │                                  Case                                   │       Practice        │ Difficulty │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ Consumer                │ Corvo Coffee: the vanishing profit (kept)                               │ Marketing, Sales &    │ medium     │
  │                         │                                                                         │ Pricing               │            │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ Industrial Goods        │ Kestrel Pumps: a plant in Vietnam — build local vs export past tariffs  │ Global Advantage      │ medium     │
  │                         │ and a capacity cap                                                      │                       │            │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ Tech, Media &           │ Aurora Studios: leaving the data centre — cloud migration, with the     │ Tech & Digital        │ hard       │
  │ Communications          │ peak-vs-average utilisation insight at its core                         │ Advantage             │            │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ Financial Institutions  │ Harbrook Bank: the fraud leak — fraud losses vs false declines, with a  │ Risk and Compliance   │ medium     │
  │                         │ regulatory bp threshold                                                 │                       │            │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ Energy                  │ Grellin Power: retiring Marsh Creek — coal retrofit vs solar + storage  │ Climate and           │ hard       │
  │                         │ under a new carbon price                                                │ Sustainability        │            │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ Principal Investors &   │ Bramfield Capital: the veterinary roll-up — diligence that lands on     │ Corporate Finance &   │ hard       │
  │ PE                      │ "not at $240M; bid $185M"                                               │ Strategy              │            │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ Health Care             │ St Brendan's: finding $30 million (kept)                                │ Operations            │ easy       │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ Insurance               │ Solvenn Mutual: pricing the safe drivers — telematics pricing to stop   │ Marketing, Sales &    │ medium     │
  │                         │ cross-subsidy cherry-picking                                            │ Pricing               │            │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ Public Sector           │ Pathways: buying more first jobs — cost per placement, with the         │ Social Impact         │ easy       │
  │                         │ fewer-places equity trade-off owned honestly                            │                       │            │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ Travel, Cities &        │ Meridian Air: the Northport route (kept)                                │ Corporate Finance &   │ hard       │
  │ PE                      │ "not at $240M; bid $185M"                                               │ Strategy              │            │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ Health Care             │ St Brendan's: finding $30 million (kept)                                │ Operations            │ easy       │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ Insurance               │ Solvenn Mutual: pricing the safe drivers — telematics pricing to stop   │ Marketing, Sales &    │ medium     │
  │                         │ cross-subsidy cherry-picking                                            │ Pricing               │            │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ Public Sector           │ Pathways: buying more first jobs — cost per placement, with the         │ Social Impact         │ easy       │
  │                         │ fewer-places equity trade-off owned honestly                            │                       │            │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ Travel, Cities &        │ Meridian Air: the Northport route (kept)                                │ Corporate Finance &   │ hard       │
  │ Infrastructure          │                                                                         │ Strategy              │            │
  ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────┼───────────────────────┼────────────┤
  │ BCG Transform           │ Hollis & Vane: the turnaround plan — $180M sized top-down, four levers  │ People & Organization │ hard       │
  │                         │ reach $160M, and the people plan carries the rest                       │                       │            │
  └─────────────────────────┴─────────────────────────────────────────────────────────────────────────┴───────────────────────┴────────────┘