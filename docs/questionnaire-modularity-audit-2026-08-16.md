# Questionnaire modularity — what is separable today, and what only looks separable

Date: 2026-08-16
Snapshot of: `5c7b254`
Status: **read-only audit. Not for implementation.** No decision has been taken
from it, and its `path:line` citations will drift as the code moves. Anyone
acting on a section should re-read the specific lines that section rests on.

## The question this answers

The owner asked whether questionnaire definition, analysis, and the technical
environment around analysis are separated well enough that each of the
following costs configuration or data rather than edits scattered through code:

- **(a)** replacing the default questionnaire with a different one;
- **(b)** offering several default templates a manager picks between;
- **(c)** a questionnaire on 1–5 or 1–7 scales instead of the three colours;
- **(d)** a different set of analysis dimensions.

Short answer: **about half of it holds.** The question *list* is genuinely
data. The answer *scale*, the *dimension set* and the questionnaire's own
*identity* are not, and one of those three is already producing a wrong number
for the instrument the project has decided to adopt.

## How this was produced, and what that is worth

Fifteen agents over four phases — seven subsystem readers, four cross-cutting
probes, three adversarial verifications and one synthesis. Every finding below
is anchored to a line someone read. Three load-bearing hypotheses were sent out
to be **refuted** rather than confirmed, and all three were refuted; §5 records
what survived instead. Two findings were established by *executing* the shipped
code rather than by reading it, and they are marked as such — they are the
strongest evidence in the document.

Documentation was treated as a lead, never as evidence. Where a document
disagreed with the code, the code won.

## 1. What is already right

This section is not politeness. Several of these are better than the thing the
audit was looking for, and a redesign that did not preserve them would be a
regression.

**The per-round snapshot is real, and it is load-bearing.**
`survey_definition` is an opaque `Json?` column with no schema and no check
constraint ([prisma/schema.prisma:34](../prisma/schema.prisma#L34)), parsed on
read. The respondent page, the submit route, the dynamic analytics path and the
AI result verifier all read *the round's* copy rather than a global list. Four
shipped contracts declare it in writing — `"sourceOfTruth":
"SurveyRound.surveyDefinition"` in `ai-analytics-v3` through `v6` — and those
four embed zero questions where the legacy `v2` embeds twenty-four. **The
questionnaire has already been evicted from the AI contract.** That work is
done and it was the hard part.

**Proved by execution, not by reading.** A fabricated 128-item instrument on
`likert-7-frequency`, with sections, mixed polarity and entirely new question
ids, parses strict and passes `isActivatableSurveyDefinition`. Both write paths
already accept a whole definition as data. Persistence is not the constraint.

**Answer scales are a genuine registry.**
[`answer-scales.ts:147`](../src/lib/survey/answer-scales.ts#L147) already holds
four scales including 1–5 and 1–7; each question persists its own `scaleId` and
`polarity`; scoring, validity, the builder's per-question picker, the
respondent renderer, the block legend and the duration estimate all read the
registry. A fifth scale is four edits in one file. Someone built this on
purpose and built it correctly.

**`contracts/scoring-bands.json` is the cleanest cross-runtime seam in the
repository** — one JSON read by both runtimes, a validating loader on each side
that refuses gaps, overlaps and wrong ordering, and a test in each runtime
cross-checking the manifest. It is the model the rest of the questionnaire
configuration is *not* built on.

**Version negotiation is solved.** Both runtimes branch on capability flags
rather than version literals, and two enforced fitness gates fail the build if
anyone branches on a version string outside the contract package
([`scripts/check-version-literals.mjs:16`](../scripts/check-version-literals.mjs#L16),
`ai-analytics-service/scripts/check_version_literals.py:7`).

**`surveyDefinitionHash` is a real questionnaire-as-data identity** — computed
by Core from the persisted definition, recomputed independently by Python from
the aggregates it received, mismatch refused, projection specified in the
manifest itself. A completely different questionnaire flows through it
unchanged.

**The orchestration layer is genuinely separated, and it is the best-separated
thing in the system.** `trigger-ai-analytics.ts`, the worker, the
claim/heartbeat/fail routes and the `ai_analysis_runs` table contain no
dimension, question, scale or status vocabulary at all; the only domain values
crossing are an integer threshold and a response count. Python's
`application/ports.py` is a proper hexagonal boundary of six protocols. The
owner asked whether "analysis" and "the environment around analysis" are
separable — they are, and that separation is in better shape than the
questionnaire/analysis one.

**Privacy is questionnaire-agnostic.**
[`cell-suppression.ts`](../src/lib/privacy/cell-suppression.ts) and the single
read-time gate `readAnalyticAnswers`
([`analytic-answers.ts:46`](../src/lib/analytics/analytic-answers.ts#L46)) are
shared by the round aggregate and the demographic breakdown, so the two
arithmetics cannot disagree.

## 2. The four scenarios, priced

| Scenario | Cost | Where it breaks |
| --- | --- | --- |
| (a) different default, same 8 dimensions and 3 colours | 3 edits + 2 collisions | the default is constructed three times |
| (b) several templates a manager picks | ~10 files + 2 new | there is no concept of template identity |
| (c) 1–5 / 1–7 scales | 0 to author, store, render and score; ~8 files to report honestly | the distribution is computed against a global colour scale |
| (d) a different dimension set | ~14 sites, two languages, compiler silent | a ninth dimension cannot even be persisted |

### (a) — cheap, but not one edit

The default question list is built in three independent places, none of which
calls another, each re-typing `scaleId: "wellbeing-colour"` and `polarity:
"positive"` inline:

1. [`survey-definition.ts:503`](../src/lib/survey-definition.ts#L503) —
   `createCanonicalSurveyDefinition`, the factory;
2. [`survey-builder.tsx:341`](../src/components/survey/survey-builder.tsx#L341) —
   `loadDefaultTemplate`, behind a button rendered **twice**;
3. [`survey.service.ts:59`](../src/lib/services/survey.service.ts#L59) —
   `canonicalExpectedQuestions`, wired as the default for submit validation.

Downstream is genuinely free. Two collisions must be paid: the parity test at
[`ai-contract.test.ts:46`](../src/lib/__tests__/ai-contract.test.ts#L46) pins
the 24 ids and their dimensions against `contracts/ai-analytics-v2.json` — and
its own comment says this is deliberate, a template that re-dimensions a
question *has* to fail there — and `e2e/respondent-walk.ts:17` hardcodes the
three colour stones.

### (b) — the missing piece is a concept, not a mechanism

A repository-wide grep for
`templateId|instrumentId|questionnaireId|template_id|instrument_id` across
`src`, `contracts`, `prisma`, `scripts` and `ai-analytics-service/src` returns
**zero matches**. Nothing in the database can answer "which questionnaire did
this round start from". The one declared identity that does exist —
`surveyInstrument.id = "shalomut-organizational-diagnosis-v1"`
([`shalomut-source.ts:325`](../src/lib/shalomut-source.ts#L325)) — has no
reader anywhere in the repository.

And the parser could not carry provenance even if it were added:
`parseSurveyDefinition` rebuilds a fresh object from a strict whitelist at both
levels. Probed directly — setting `templateId`, `schemaVersion` and a
per-question `templateQuestionId` and parsing — **all three are silently
dropped**.

Eight of the ten edits are one value threaded from a picker to the one seeding
site, because the only production creation path rebuilds its payload
field-by-field at
[`manager/setup/route.ts:123`](../src/app/api/manager/setup/route.ts#L123) and
drops anything it does not name. The existing `CreateRoundInput.surveyDefinition`
field is **not** a shortcut: [`round.service.ts:118`](../src/lib/services/round.service.ts#L118)
makes such a round born `active`, which would close the school's running round,
and the comment there says so.

The dangerous edit is `loadDefaultTemplate`: after a manager picks template B,
that button silently replaces B's questions with A's twenty-four, never passing
through the factory.

### (c) — the half that is missing publishes a wrong number

Authoring, persistence, rendering and scoring cost **zero**. Reporting does not.
`bucketForAnswer(value, score)`
([`analytics.service.ts:77`](../src/lib/services/analytics.service.ts#L77)) is
handed only the value and the score, so it structurally cannot read the
question's `scaleId`, and resolves against the module-global three-colour
scale. Its own comment concedes it: a Likert answer has no colour of its own and
falls to the nearest band by score.

**Established by execution.** A round whose *own snapshot* is
`likert-7-frequency` on all eight dimensions, twelve respondents each choosing
`4` — the exact midpoint, score 50 — run through the real method returns:

```
scoreDistribution: { green: 0, yellow: 12, red: 0 }
```

Twelve people who chose a value that does not exist on the colour scale are
published to the manager, into the AI payload and into the divided-dimensions
feature as twelve "yellow". The three-key shape is manufactured inside the
service, before anything leaves it, so this is not a presentation choice.

Two consequences worth carrying: the nearest-anchor rule puts the distribution's
implied crossovers at 80 and 30, which disagrees with the shared scoring bands
at 75 and 50 — invisible on three colours, visible the moment a Likert scale is
used; and `surveyDefinitionHash` omits `scaleId` while `hasSameQuestionSnapshot`
compares it, so the system holds two disagreeing notions of "the same
questionnaire", and switching a question from colour to 1–7 between rounds
produces a cross-round delta the dashboard presents as comparable.

**This scenario is not hypothetical.** The instrument the project has decided to
adopt is exactly 1–5 and 1–7.

### (d) — the expensive one, and the compiler will not help

A ninth dimension cannot be persisted at all: `validDimensionIds` is built from
the module global
([`survey-definition.ts:316`](../src/lib/survey-definition.ts#L316)) and the
parser refuses with "Survey contains an invalid question." A subset of eight
persists but returns `isLocked: true` with zero aggregates **and no error** — a
permanently locked round with nothing on screen to explain it.

Beyond that: a second hand-authored list carrying map geometry and a third label
set ([`dimension-presentation.ts:51`](../src/lib/dashboard/dimension-presentation.ts#L51)),
an icon map with a silent fallback, six published contract JSONs that Python
asserts identical at import, the OpenAPI enum with no test comparing it to the
union, and 192 rows of the Python interventions catalog keyed by dimension.

Worst property: every `Record<WellbeingDimensionId, ...>` is built through an
`as` cast and there is no exhaustive switch over dimensions anywhere, so
**widening the union compiles clean and names none of the sites**. Note the
asymmetry: a wrong-sized dimension set fails loudly in Python (`RuntimeError` at
import) and quietly in Core.

## 3. Defects that exist today, independent of any scenario

1. **The distribution's implied thresholds disagree with the shared scoring
   bands** — 80/30 against 75/50. Currently invisible.
2. **The taxonomy exists in two independently authored copies.**
   `dimension-presentation.ts` imports only `statusLabels` and the types from
   `shalomut-source.ts` — never the dimension list — and re-declares all eight
   with their own labels. Their `label` fields disagree: `self-expression` is
   `קול אישי` at `dimension-presentation.ts:54` against `ביטוי עצמי` at
   `shalomut-source.ts:216`. **This particular difference is probably
   deliberate** rather than drift: the presentation's value is exactly the
   source's own `conceptLabel` (`shalomut-source.ts:217`), so someone chose the
   concept name for the map. The finding is therefore the *duplication without a
   parity test*, not this string — nothing would catch a future edit to one list
   that was meant for both, and the map destructures a dimension's score with no
   guard (`dashboard-map-interactive.tsx:398`), so getting the two lists out of
   step is a TypeError on the manager's main screen.
3. **Two disagreeing definitions of "the same questionnaire"** — the hash omits
   `scaleId`, the comparison function reads it.
4. **A live prompt path is pinned to the frozen 24 regardless of contract
   version.** The question-suggestion prompt feeds the canonical twenty-four
   sentences to the model as style examples
   (`ai-analytics-service/src/services/hebrew_prompts.py:566`), reached from
   `src/app/api/manager/question-suggestion/route.ts:54` with no capability
   gate. A manager building a 126-item instrument is shown imitations of the old
   one. The same file's docstring asserts a six-point scale that no shipped
   scale matches.
5. **`src/config.py` imports `src/contracts.py`**, which raises `RuntimeError`
   at module import unless the v2 manifest defines exactly 24 unique questions.
   A twenty-fifth question takes the whole Python service down at startup rather
   than degrading.

## 4. Options, with no winner declared

### A. Template catalogue as a first-class persisted entity

Add a template table and repository beside the round, following the shape the
round repository already uses; widen `SurveyDefinition` and the parser whitelist
to carry provenance; thread a `templateId` from a picker to the one seeding
site; register in the composition root.

*Buys:* makes (b) a data operation permanently. Records, for the first time, a
fact the database cannot currently express. New templates never touch code
again.

*Costs:* ~10 files plus 2 new, a migration, a repository interface, and an
authoring surface that does not exist. `SurveyInstrument` must gain the five
fields the factory hardcodes today — it has no `scaleId`, `polarity`,
`audience`, `introText` or `anonymityText` — or be retired in favour of
authoring templates as `SurveyDefinition` JSON directly.

*Wrong when:* if there will realistically only ever be two or three templates,
all authored by the team, this builds a CMS for content that fits in a code
file.

### B. Instrument registry in code — a keyed module map, no new persistence

Turn `surveyInstrument` from a bare const into a keyed registry; give the
factory an optional instrument parameter; route `loadDefaultTemplate` and
`canonicalExpectedQuestions` through that same factory; stamp the chosen
instrument id into the snapshot.

*Buys:* cheapest path to (a) and (b) — no migration, no repository, no admin UI.
Directly removes the sharpest structural defect found: the default built three
times, one of which silently overwrites a manager's chosen template. An optional
parameter keeps all existing call sites compiling and breaks no test.
Provenance still gets recorded.

*Costs:* templates stay code, so a new questionnaire is still a deploy — which
does not literally satisfy "configuration rather than edits".

*Wrong when:* if the methodologist rather than the engineering team is meant to
author or swap questionnaires, this does not deliver that and would be redone.

### C. Fix the two axes that break (c) and (d), defer template plumbing

Pass the question into `bucketForAnswer` so the distribution comes from the
question's own scale; source `validDimensionIds` and the analytics dimension
loop from the round's snapshot rather than the module global; derive the
presentation list from one taxonomy rather than three.

*Buys:* attacks the failures that are silent and wrong *today* rather than the
ones that are merely inconvenient. Neither needs a catalogue to be worth fixing.

*Costs:* advances (b) not at all. If the distribution changes shape it reaches
the wire and needs a new contract version across both runtimes; keeping three
buckets but bucketing through the shared scoring bands is far cheaper and also
removes the 80/30-vs-75/50 disagreement. The dimension half cannot be finished
in Core alone, because Python asserts the eight at import and per payload.

*Wrong when:* if (b) is the near-term need and (c) is hypothetical. It is right
if a 1–5 or 1–7 questionnaire is actually coming — which it is.

## 5. What the adversarial pass changed

Three hypotheses were sent out to be refuted. All three were.

- **"The per-round snapshot already makes the questionnaire data, so a different
  questionnaire needs no analysis-path change."** True of the question list,
  false of the scale and the dimension set — and both failures are *inside* the
  analysis path, not downstream of it. The same function that takes the round's
  snapshot builds its stones from `surveyInstrument.dimensions` at
  `analytics.service.ts:354`.
- **"The eight dimensions, not the 24 questions, are the real hardcoded axis."**
  Both are hardcoded, in both runtimes, by the same mechanisms; they differ only
  in *when* they fail. `contracts.py:94` raises `RuntimeError` at import unless
  the manifest holds exactly 24 unique questions, twelve lines below five
  identical assertions about dimensions. The defensible distinction is that the
  dimension set is re-checked *per payload* while question identity is pinned at
  build time and import time.
- **"A second template is cheap because there is exactly one chokepoint."**
  Three chokepoints, and the one the claim omitted is a button in the manager's
  own builder that would silently discard the manager's choice.

Two disagreements between agents were left unresolved rather than smoothed over:
whether `src/app/api/survey/[shareCode]/route.ts:68` — which ships the global
dimension list inside an otherwise snapshot-built payload — matters today (it is
a real break in "everything reads the snapshot"; no in-app consumer reaches it),
and whether the `dimensionPresentations` duplication is a defect or a deliberate
separation of map geometry from methodology.

The second was checked by hand afterwards and the agents' framing was wrong: the
differing label is the source's own `conceptLabel`, so the map is showing the
concept name on purpose. What survives is the weaker, and still real, finding
recorded in §3.2 — two hand-authored lists with nothing asserting they stay in
step.

## 6. Recommendation — agent's, not an owner decision

**Do not build the template catalogue now.** Scenario (b) has no product demand:
templates number one or two and are authored by the team. Persistence is already
open; what is missing is that a template cannot be *named*.

**Do two smaller things.**

1. **Fix `bucketForAnswer`,** because it is already wrong for the instrument the
   project has decided to adopt. The cheap form keeps three buckets and resolves
   them through the shared scoring bands — one signature change, no wire change,
   and it removes the 80/30 disagreement as a side effect. The expensive form
   changes the distribution's shape and belongs with the phase-5 contract work.
2. **Collapse the three constructions of the default into one, and stamp the
   instrument id into the snapshot.** This is hygiene rather than architecture:
   it makes (a) genuinely cheap, removes the button that discards a chosen
   template, and gives half of (b) for free by recording provenance before
   anyone needs to choose.

**Leave the dimensions alone.** The eight are an owner decision, (d) is not
planned, and part of that cost will be paid anyway in phase 5.

**One timing caveat.** The methodologist's answer may move the requirement: if
the scoring bands turn out to be *relative* rather than absolute, the cheap form
of fix 1 becomes temporary. That is an argument for doing it anyway — publishing
a wrong number now is worse than redoing the fix later — but it should be known
in advance.

## 7. Residual risk of this document

- It is a snapshot of `5c7b254`. Citations drift.
- Change-cost counts are estimates from reading, not from performing the change.
  The file lists are the durable part; the numbers are not.
- Nothing here was verified on the deployed endpoint, and nothing needed to be:
  every finding is about source structure.
- The two executed findings (§1 and §2c) are the strongest evidence here and
  were reproduced against shipped code. Everything else is reading.
