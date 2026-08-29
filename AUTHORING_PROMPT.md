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
a time, answers it, and the interviewer replies with new information the next question depends on.
There is **one clock for the whole case** — typically 35 minutes — not a clock per question.

The mix is roughly: half **multiple select**, a quarter **numeric entry** with an explicit
rounding instruction, and a quarter **short free text** with a hard line cap. The app never tells
the candidate whether an answer was right.

Two things separate a real assessment case from a quiz with a story attached, and both are about
*shape*, not about harder arithmetic:

1. **The brief is front-loaded and dense.** The candidate is handed the industry structure, the
   client, the trigger event and an orientation exhibit *before question 1* — and then has to
   hold all of it. Difficulty comes from carrying context, not from withholding it.
2. **The qualitative questions are conditional, not recall.** They ask what *would change* the
   answer the candidate just gave, what data they would *need* to answer a question nobody has
   answered yet, or which direction a number moves under a changed assumption. None of them can
   be answered by pattern-matching a framework.

Write to that shape.

---

## Part 1 — Front-load the brief

`prompt` is the situation read out before question 1. Make it carry most of the case's facts:

- **The value chain or market structure**, in one or two sentences: who sells to whom, where the
  client sits, what the client buys and from whom. Add an orientation exhibit (a `text` exhibit
  spelling out the chain, or a small table of the players) that is handed over with question 1
  and is never itself the subject of a question. It exists to be *held*, not read off.
- **The client**, with its scale: revenue, volumes, the one or two operating facts that matter
  later (it buys 200 tons a year of X; it runs at 90% utilisation).
- **The trigger**: the specific thing that happened last week and the specific decision the CEO
  wants. Name the number the client is reacting to — an asking price, a lost contract, a
  regulatory deadline.

Six to nine sentences is right; do not pad it with atmosphere. Every fact in the brief must be
used by at least one question, and no question may need a fact the brief and the follow-ups never
gave. Introduce the term the case turns on (spare capacity, incremental margin, transfer price)
in the brief, in plain words, so a candidate is never guessing at vocabulary.

Withhold exactly one thing: the framework. Never hint at buckets.

---

## Part 2 — The eight question archetypes

Build the case out of these. A good 9-question case uses six or seven distinct archetypes; reusing
the same three shapes is the most common failure mode of generated cases.

### 1. Open structuring (question 1, always)

`responseFormat: "text"`, `maxLines: 3`. Ask for a fixed small number of things, capped hard:

> "Let's think about the right structure. What are the **three** key questions you would need to
> answer to help the client decide how much to bid for X? Please summarise in 3 lines maximum."

The cap is the difficulty. `keyPoints` lists the three or four question-buckets a strong answer
names (is the target's market attractive? what are its standalone economics, and what is the risk
of *not* buying? what synergies exist?). `commonMistakes` names the generic-framework answer that
would earn nothing here.

### 2. Aggregate first, components after

The most important structural move, and the one generated cases usually get backwards. Ask the
**hardest composite number first**, with no scaffolding:

> "Given the data in the exhibit, what is the maximum the client should be willing to pay?"

Then, *after* the candidate has committed, walk backwards through the components as separate
questions: "what is the expected annual cost saving if…", "what profit does the target make on
its sales to other customers?". The candidate who got the aggregate wrong now sees exactly where.
The components must never come first — that turns a valuation into a fill-in-the-blank.

Give the composite question a generous `timeLimitSeconds` (240–300) and the components 60–90.

### 3. Explain-your-answer pair

Immediately after a `choice` or `number` question, a `text` question with `maxLines: 3`:

> "Please explain briefly the reasoning behind your answer to the previous question."

Use two or three of these across the case, always attached to the questions where the reasoning
matters more than the digit. They are what makes the transcript diagnostic when the number is
wrong. Do not restate any part of the answer in the prompt. Their `keyPoints` are the reasoning
steps, not the number.

### 4. Counterfactual sensitivity — "which of these, if true, would change your answer?"

The hardest qualitative format, and the one to build the case around:

> "Which of the following statements, if true, would affect the valuation you gave in question 2?
> Select all that apply."

`selectCount: 0` — see the schema note; the candidate is **not** told how many. Four to six
options, each a single factual claim about the world. Compose the set from these buckets, mixing
them deliberately:

- **Changes an input to the number asked for** → correct. ("All production units can be used
  interchangeably for either product" changes usable spare capacity, so it moves the ceiling.)
- **True, material to the deal, irrelevant to the number asked** → wrong, and the best distractor
  there is. ("We could also buy a downstream converter at an attractive price" — a real
  opportunity, but it does not change what *this* target is worth to us.)
- **Changes what you would *pay*, not what the target is *worth* to you** → wrong. (A rival
  bidding; a seller in distress.)
- **Already reflected in the figures given** → wrong. (Restates an exhibit line in new words.)
- **Right direction, immaterial magnitude** → a judgement call; if you use one, defend it
  explicitly in its `optionRationale`.

Every option must be defensible from the candidate's chair. If a wrong option is wrong because it
is silly, it is not a distractor, it is filler — delete it.

### 5. Scenario re-run

Re-issue the *same exhibit* with one or two cells changed, and ask only for the direction:

> "Which of the following is likely to be true for Scenario 2 compared to Scenario 1? Use the data
> below for your revised calculations."
> Options: bids higher / bids lower / bids the same / there is not enough information to decide.

Author the variant as a second exhibit with the same rows, changed values, and a title that says
what moved ("Exhibit 3 — Scenario 2: the target is selling at full capacity"). Call out the
changed row in `unitsNote`. `selectCount: 1`. "Not enough information" must be a genuine option,
wrong here because the exhibit does supply what is needed — and in one case per author it should
be the *right* answer, so candidates cannot rule it out by habit.

This archetype is where the case's insight usually lives: the changed cell should break an
assumption the candidate silently made in archetype 2.

**Change one term, not two.** The scenario must move exactly one quantity in your model. If the
changed cell moves two — raising a target's sales volume, say, lifts its standalone profit *and*
consumes the spare capacity a synergy needed — the two effects can point in opposite directions and
your "correct" answer becomes arguable. Prefer changing a **capacity, a rate or a price** over
changing a **volume**, because volumes tend to sit in more than one term. Prove the isolation in
your verification script: compute every term of the model under both scenarios and assert that only
the one you intended has moved.

### 6. Whose value is it — comparative bidder

> "In which scenario is our client likely to bid more for the target than a buyer from outside the
> industry?"

Tests the standalone-value-plus-synergy model directly. Pair it with an explain-your-answer text
question (archetype 3). `selectCount: 1`, three options (scenario 1 / scenario 2 / neither).

### 7. Data sufficiency — "what would you need to know?"

Extend the case to something no exhibit covers, then ask what data would answer it:

> "Choose the four pieces of data that, combined, would let us estimate how much profit each
> production unit could generate over its lifetime. Assume full capacity can always be sold."

`selectCount` exactly (4 here), six to eight options. Distractors are data that is real and
plausible but **redundant** (implied by another listed option), **downstream of a decision not yet
made** (the share sold to us, when the assumption says all output sells), or **at the wrong level**
(a company-wide figure when the question is per unit). The correct set must be genuinely
sufficient: print, in your verification output, the formula that combines them.

**The distractor test — apply it to every wrong option in every `choice` question.** Ask: could a
candidate rule this out *without reference to the question being asked*? If yes, it is filler, no
matter how professional it sounds. "The smell of the product" fails the test, but so does a real
datum that is simply off-topic — a competitor's price, where the work is done, the brand of
something. Both are eliminated on instinct, and an option eliminated on instinct teaches nothing.

The strongest distractor is a **real input that one of the correct options already subsumes**:
busiest-hour footfall when annual volume is listed; a model's precision when the fraud it prevents
each year is listed; the premium when a benefit stated net of the discount is listed. Ruling those
out requires reading the whole option set and understanding the formula — which is the skill being
tested. Next best is a datum that would be needed *if one stated assumption were dropped*, so the
candidate has to notice the assumption.

Vary the trick across a library: if one case's redundant datum is the useful life (because the
other figures are projected year by year), another case should express its figures as averages, so
that the life becomes a **required** input and the redundancy sits somewhere else. A trap that
appears in every case is a pattern candidates learn instead of a judgement they make.

### 8. Advantages and risks as select-all

Brainstorming, scored on judgement rather than on volume:

> "Which of the following are other likely advantages that might lead the client to buy the
> target? Select all that apply." (`selectCount: 0`)

Include one option that is attractive and wrong for a stateable reason — a benefit this deal's
structure does not deliver (10% of a market is not market power), or one that runs the wrong way
(buying upstream in your own industry *increases* cyclicality, it does not decrease it). Close the
case with the mirror image as free text, `maxLines: 4`:

> "Your project leader has asked for the potential disadvantages — the negative synergies — that
> might result from this deal. Share your thoughts in 3–4 lines."

---

## Part 3 — Writing options that are actually hard

- **Never a filler option.** Every wrong option must be wrong for one specific reason you can
  state in a sentence, and that sentence goes in `optionRationale`. If you cannot write the
  sentence, the option is not ready. Then apply the distractor test in archetype 7: if the option
  can be ruled out without reference to the question asked, it is filler in a good suit.
- **Vary `selectCount`, and hide it where you can.** A ten-question case has room for about three
  `choice` questions, so give them three different counts — typically one `0` ("select all that
  apply", on the counterfactual), one `1` (the scenario re-run), and one exact count of 4 or 5 (the
  data-sufficiency question). Never settle into 2 / 4 / 3 across a case: a count the candidate can
  predict is a count that is doing some of their thinking.
- **Options must be parallel in length and register.** The correct ones must not be the longest,
  most hedged or most technical-sounding. Check this deliberately: a candidate should not be able
  to score by prose style alone.
- **Options make claims, not gestures.** "Costs might be higher" is a gesture; "raw material cost
  per ton is 15% above the market average" is a claim, and can be checked.
- **Where an option makes a factual claim about an exhibit, prove it in the verification script** —
  print the claim and the computed evidence for it.

---

## Part 4 — The economic spine

Pick one mechanism and make the whole case turn on it. Good ones:

- **Value to *this* buyer versus standalone value.** Maximum willingness to pay = the target's
  standalone profit + the synergy it delivers to us. The trap: the synergy only exists if the
  target has spare capacity. At full capacity, serving us displaces an external sale and the
  premium evaporates — so the same buyer rationally bids *less* for the same asset.
- **Incremental versus total.** A contract that loses money on fully-loaded cost makes money on
  incremental cost, because the fixed cost is already sunk.
- **Peak versus average.** Paying for capacity sized to the peak while billing the average.
- **Cost per outcome versus cost per participant.** The programme that is cheaper per head is the
  more expensive one per successful outcome.

Whatever you pick: the naive calculation must be *reachable and wrong*, the correct one must change
the decision, and the case must contain a question (archetype 5 is ideal) where the candidate
discovers it. Name the principle in a `followUp` only *after* the candidate has committed.

Depreciation, sunk costs and other non-cash lines belong in the exhibit as a deliberate test of
what enters the calculation. Say in the `optionRationale` or `workedSolution` why each is in or out.

---

## Part 5 — Non-negotiable rule: every number must be tool-verified

You have a code execution tool. Use it.

1. Before writing any JSON, decide the underlying business model of the case (volumes, prices,
   costs, capacities, growth rates) and **compute every derived figure in code** — never in your
   head, never "approximately". This includes each exhibit cell, each `idealAnswer.value`, **and
   every number you quote inside a `followUp` or an `optionRationale`**.
2. The numbers in your exhibits and the numbers in your worked solutions must come from the *same*
   computation. Do not retype them; print them from the script and copy the printed values.
3. After drafting the JSON, run a **final verification script**: hard-code the exhibit values
   exactly as they appear in your JSON, re-derive every `idealAnswer.value` from them, and `assert`
   each one matches within the question's `tolerancePct`. Then also:
   - **Scenario variants**: compute the answer under both scenarios and assert the *direction* the
     scenario question claims (`assert v2 < v1`).
   - **Counterfactual options**: for each option in an archetype-4 question, recompute the
     valuation with that statement true and assert it does or does not move, matching your
     `correctOptions`. An option that cannot be tested this way must be defended in words in its
     rationale and flagged as a judgement call in the log.
   - **Data-sufficiency options**: print the formula that combines the correct set, and show that
     it consumes exactly those inputs and no others.
   - **The figures in `commonMistakes`**: when you write "answering $X" for a named wrong
     approach, compute $X in the script and assert it. These are the figures that rot, every time,
     because nobody works a wrong answer carefully — and a wrong wrong-answer is worse than none,
     since it teaches a mistake the candidate did not make.
   - **Structure**: the sum of `timeLimitSeconds` fits inside `totalTimeSeconds`; every exhibit id
     is referenced by some question's `exhibitIds` or `followUpExhibitIds`; every `choice`
     question's `correctOptions` length equals its `selectCount` unless `selectCount` is 0;
     `optionRationale` has one entry per option.
4. Compare money with rounding, never with `==`: `4.5 - 1.8` and `480 * 1.05` do not land on
   `2.7` and `504` in binary floating point, and a checker that fails on that wastes a cycle
   convincing you a correct case is broken. Round to whole cents or whole dollars before comparing.
5. If any assertion fails, fix the JSON and run the script again. Repeat until all pass.
6. Paste the final script's output verbatim into `authoring.verificationLog`, and set
   `authoring.mathVerifiedWith` to the tool you used.

A case emitted without having actually executed step 3 is a failed response. The app trusts your
declared answers completely — it does not recompute them — so this is the only thing standing
between a learner and a wrong answer key.

Also check, in code, that the numbers are *interview-realistic*: percentages within a plausible
range, margins that are not negative by accident, market shares summing to ≤ 100%, and figures
round enough that a candidate can work them on paper (prefer 240 and 15% over 237.4 and 14.6%).

---

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
  "industry": "e.g. Industrial Goods",
  "functionalPractice": "e.g. Corporate Finance & Strategy",
  "difficulty": "easy | medium | hard",
  "estimatedMinutes": 35,
  "totalTimeSeconds": 2100,            // the single clock for the whole case; 2100 = 35 min

  // The front-loaded brief, shown in the first chat bubble above question 1.
  // 6-9 sentences: value chain, client and its scale, the trigger and the decision.
  // See Part 1. No hints about the framework.
  "prompt": "Our client is ...",

  "exhibits": [
    {
      "id": "ex0",
      "title": "Exhibit 1 — The recycled plastics value chain",
      "type": "text",                  // orientation exhibit: held, never read off
      "text": "Resin producers -> compounders -> converters -> consumers. Our client converts."
    },
    {
      "id": "ex1",
      "title": "Exhibit 2 — Target economics, by product",
      "type": "table",                 // "table" | "chart" | "text" | "image"
      "table": {
        "columns": ["", "LDPE", "HDPE"],
        "rows": [["Maximum capacity (tons/yr)", 4000, 2100], ["Volume sold (tons/yr)", 3800, 1900]]
      },
      "unitsNote": "$ per ton unless stated",
      "source": "Client data"
    },
    {
      "id": "ex2",
      "title": "Exhibit 3 — Scenario 2: the target is selling at full capacity",
      "type": "table",                 // the scenario variant: same rows, changed cells
      "table": {
        "columns": ["", "LDPE", "HDPE"],
        "rows": [["Maximum capacity (tons/yr)", 4000, 2100], ["Volume sold (tons/yr)", 4000, 2100]]
      },
      "unitsNote": "Changed from Scenario 1: volume sold now equals capacity."
    }
    // Tables cannot merge cells. A figure that belongs to the whole company rather than to one
    //   column must either be split across the columns (allocate the fixed cost to each line of
    //   business) or moved into its own "text" exhibit. Repeating one value in both columns
    //   reads as double counting -- do not.
    // "chart" exhibits use { "chart": { "kind": "bar" | "stacked-bar", "categories": [...],
    //   "series": [{ "label": "...", "values": [...] }], "valueSuffix": "K" } }.
    //   Charts render at most THREE series; author anything wider as a table.
    // "image" exhibits use { "src": "data:image/png;base64,..." } -- avoid these.
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
      "options": ["...", "...", "..."],   // 4-8 options, one line each
      "selectCount": 2,                   // how many to pick. 0 = "select all that apply":
                                          // the count is WITHHELD from the candidate, which is
                                          // what makes archetypes 4 and 8 hard. Use it.

      // --- responseFormat "number" ---
      "unit": "USD",
      "tolerancePct": 1,
      "answerFormatNote": "Give your answer in USD, rounded to the nearest whole number (for example 1111 or 123456 or 500885), without further explanation or working.",

      // --- responseFormat "text" ---
      "maxLines": 3,

      "idealAnswer": {
        "correctOptions": [1, 2],         // required for "choice"; length == selectCount
                                          // unless selectCount is 0
        "optionRationale": ["...", "..."],// one entry per option, correct AND wrong
        "value": 28900000,                // required for "number"
        "workedSolution": "Step 1 ...\nStep 2 ...",
        "keyPoints": ["...", "..."],
        "commonMistakes": ["..."]
      },

      // What the interviewer says once the answer is in. ALWAYS shown to the
      // candidate, so it must not be the rubric -- it is the NEW INFORMATION that
      // later questions depend on. See the followUp rule below.
      "followUp": "The client's contract with its current supplier ...",
      "followUpExhibitIds": ["ex2"],

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

`followUp` is shown to every candidate. `idealAnswer` is hidden behind an answer key the candidate
has to choose to open, and opening it is recorded against them. So:

- Put in `followUp` anything a **later question depends on**: new client facts, the objective, the
  terms of a deal, the definition of a cost line, an exhibit hand-over.
- When a later question needs a figure the candidate has already calculated, do **not** restate
  their figure in the `followUp`. Let a wrong answer carry forward — that is what the real
  assessment does, and it is what makes the transcript diagnostic. Give the *parallel* figure they
  were not asked for (the other company, the other segment) when the case needs it.
- Never put the rubric, the key points, or "correct!" in a `followUp`. The app deliberately never
  tells the candidate whether they were right. Where the real assessment would simply say "Thanks"
  and move on, omit `followUp` entirely rather than inventing filler.

## Question design rules

- **8 to 10 questions**, and the last one is `responseFormat: "text"` — the app requires it.
- **The ten slots are almost fully spoken for.** A case that satisfies these rules lands on:
  1 structuring (arch 1) · 2 composite number (arch 2) · 3 explain (arch 3) · 4–5 two components ·
  6 counterfactual (arch 4) · 7 scenario re-run (arch 5) · 8 explain (arch 3) · 9 data sufficiency
  (arch 7) · 10 closing free text (arch 8). That is the default running order, and it leaves no
  spare slot: archetype 6 (the comparative bidder) and a select-all advantages question are
  *extras*, and taking one means dropping a component or folding it into an explain question's
  rubric. Decide that trade deliberately rather than discovering it at question nine.
- **Move the order around between cases.** The running order above is a default, not a template.
  Putting the scenario before the counterfactual, or the data-sufficiency question earlier, changes
  how a case feels without weakening it — and a library where every case runs the same sequence
  teaches candidates the sequence.
- The sum of `timeLimitSeconds` must fit inside `totalTimeSeconds` with room to spare — the
  candidate reads as well as answers. Budget the composite valuation 240–300s, its components
  60–90s, choice questions 60–120s, text questions 120–180s.
- `number` — one number, always with `unit`, `tolerancePct` and `answerFormatNote`. Prefer **raw
  units** (28900000, not 28.9) with the format note the real assessment uses: "rounded to the
  nearest whole number (for example 1111 or 123456 or 500885), without further explanation or
  working." Switch to `$M` only when raw units would mean typing eight or more zeros — a five-year
  utility cost reads better as `2015` than as `2015000000`. Whichever you pick, the `unit`, the
  `answerFormatNote` and the exhibit must agree; where the exhibit is in `$M` and the answer is in
  dollars, say so in the note, because the conversion is a fair test and an ambiguity is not. Use
  `tolerancePct: 1` when the arithmetic is exact, wider only when rounding makes a band fair. Be explicit about signs: if the answer is a loss, say whether to enter a minus sign.
  `workedSolution` must show every arithmetic step, using the exact figures printed by your script.
- `exhibit`-type questions must reference at least one exhibit and be unanswerable without reading
  it. Ask for the *so what*, not the read.
- Build the case so the numbers **chain**: question 6 should need what question 5 established.
- Every exhibit must actually reach the candidate — referenced by some question's `exhibitIds` or
  handed over in a `followUpExhibitIds`. (Handing an exhibit over in a `followUp` and listing it
  again on the next question is safe: the app will not render it twice in a row.)
- Every question needs `commonMistakes` — the specific traps in *this* case, not generic advice.
- `scoringWeights` values should sum to 1.0. Weight `communication` freely — on a `choice` or bare
  `number` question the app drops it and renormalises the rest, since there is no prose there to
  judge, so it survives only where the candidate actually wrote something.

## If you are adding to an existing library

The app bundles one case per industry and expects the nine functional practices to be represented,
so a new case should take an industry nobody else has, or explicitly replace the case that holds
it. Two library-level rules cannot be satisfied by any single case, and are yours to track across
the set: **"there is not enough information to decide" should be the right answer in one scenario
question somewhere in the library**, or candidates learn to discard it on sight; and **the same
data-sufficiency trick should not appear twice** — if one case's redundant datum is the useful
life, express another case's figures as lifetime averages so that the life becomes required.

## Before you emit: the self-check

Answer these honestly; if any is "no", revise rather than emitting.

1. Could a candidate answer any qualitative question without having done the arithmetic? If yes,
   it is a recall question — rewrite it as a counterfactual or a sufficiency question.
2. Is there a question whose answer changes because of something established *later* in the case?
   There must be at least one.
3. Are the composite numbers asked before their components?
4. Does any distractor exist only to be dismissed? Delete or replace it. Read each wrong option
   once more with the question covered: if you can still rule it out, it is filler.
5. Do the correct options look, in length and tone, like the wrong ones?
6. Does the brief carry every fact the case needs, other than what follow-ups deliberately add?
7. Does the scenario move exactly one term of the model, and did you prove that in code?
8. Is every figure you quoted inside `commonMistakes` computed by the script rather than estimated?
9. Did the verification script actually run, and is its real output in `verificationLog`?

## Output format

Run your verification first. Then reply with **only** the JSON, in a single fenced ```json block,
with no commentary before or after it — it gets pasted straight into the app. Ensure it parses: no
trailing commas, no comments, no `NaN`, all strings double-quoted.
