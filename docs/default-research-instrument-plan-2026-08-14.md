# Plan: the research instrument becomes the default questionnaire

Dated 2026-08-14. **Live plan, not a historical one** — it is the current task
queue for this change and moves to the historical section of
[`README.md`](README.md) when it is delivered or abandoned.

Owner decisions of 2026-08-14 are recorded in §2 and are settled unless the
owner reopens them. Nothing in this plan is implemented. Every statement about
current behaviour below was read from the code on 2026-08-14 and is cited by
file and line so a reader can re-check it rather than trust this document.

## 1. What is being replaced, and by what

The default questionnaire today is 24 statements over the eight wellbeing
dimensions, answered on one shared three-colour scale
([`src/lib/shalomut-source.ts`](../src/lib/shalomut-source.ts)). The owner has
designated a research instrument held in Google Docs
(`1W7bQhdo0oyJ-WL73MmrsZB3XJqNDo_lE`) as its replacement.

Read on 2026-08-14, that document holds **126 items in three classes the
current model has no representation for**:

| Class | Count | Answer shape |
| --- | --- | --- |
| Demographic / background | 16 | single choice; one free numeric (`מספר שעות עבודה יומי ממוצע`) |
| Time and load allocation | 2 | 13 activity components each, entries summing to 100 |
| Likert statements | 108 in 13 blocks | 1–5 extent (11 blocks) and 1–7 frequency (`שאלון שחיקה שירום מלמד`) |

The 108 break down as `דרישות וגורמי לחץ בעבודה` 22, `משאבים בעבודה` 30,
`שאלון שחיקה` 14, `תוצאות תעסוקתיות נחוות` 22, and 20 across the remaining nine
short blocks (`רגש בעבודה`, `אקלים ארגוני`, `FIT`, `detachment`, peer burnout,
`עיסוק ופנאי`, `סימפטומים פיזיים`, non-work load, `סיפוק בחיים`).

Two properties of the new instrument have no counterpart in the current model
and are the reason this is a data-model change rather than new content:

- **Mixed polarity.** A high answer to `לחץ זמן` is bad and a high answer to
  `תמיכה קולגיאלית` is good. Today every score is "higher is better" by
  construction — `green` is 100 and `red` is 0.
- **Items that score nothing.** The 16 demographic items and the 2 allocation
  grids belong to no wellbeing dimension. Today every question must carry a
  valid `dimensionId` or the definition is refused
  ([`survey-definition.ts:119`](../src/lib/survey-definition.ts#L119)).

## 2. Owner decisions taken on 2026-08-14

1. **The research instrument replaces the canonical 24** rather than sitting
   beside them as a second template. See §3 for the one qualification this
   carries.
2. **Demographic cross-tabulation is a product feature, with k-anonymity.**
   Breakdowns by group are allowed and cells below the threshold are suppressed.
   The rejected alternatives were storing demographics unlinked from answers,
   excluding them from the AI boundary only, and not collecting them at all.
3. **The item-to-dimension mapping is owner-supplied.** The methodologist
   provides which of the eight dimensions each of the 108 Likert items belongs
   to, and which items are reverse-scored.

Decision 3 is a blocker for phases 3 and 5 and for nothing else. Phases 1, 2
and 4 can be built and verified while it is outstanding.

This also settles an open question recorded in
[`shalomut-tracker-handoff.md`](shalomut-tracker-handoff.md) §"What is open" —
whether the three-colour answer scale may become 5–6 points with the map kept as
a derived presentation band. It may, and the instrument that does it is this
one.

## 3. The qualification on "replaces"

`surveyInstrument.questions` is not only a template. It is the **default
parameter value** of `SurveyService.validateInput` and
`SurveyService.processSubmission`
([`survey.service.ts:61`](../src/lib/services/survey.service.ts#L61),
[`:141`](../src/lib/services/survey.service.ts#L141)) and the question set
`AnalyticsService` aggregates and locks against
([`analytics.service.ts:118`](../src/lib/services/analytics.service.ts#L118),
[`:135`](../src/lib/services/analytics.service.ts#L135)). A round whose
`surveyDefinition` is null is therefore scored against those 24 questions today.

Deleting the array outright would silently change how such a round is validated
and aggregated, and would make its stored answers — keyed by the old question
IDs — unrecognisable. So "replaces" means the new instrument becomes the
default template, the AI-facing instrument and the only one a manager is
offered, while the 24 survive in exactly one of two ways:

- **Preferred — migrate.** Backfill a `surveyDefinition` snapshot of the 24 onto
  every round that has none, then remove the fallback so the default parameter
  no longer exists. After this the legacy array has no runtime consumer.
- **Otherwise — freeze.** Keep the 24 as a named `LEGACY_TEMPLATE` constant
  reachable only from that fallback path.

`contracts/ai-analytics-v2.json` carries its own copy of the 24 sentences, is
immutable, and is untouched either way. A canary test already fails if anyone
edits that manifest to match new copy; it stays.

## 4. Defects in the source document

These are read from the document as it stands on 2026-08-14 and need an owner
answer before the item list can be treated as final. None of them blocks phase 1.

1. Item 13 of `דרישות וגורמי לחץ בעבודה` (`כוח אדם לא מספיק ביחס לדרישות העבודה`)
   appears twice with the same number.
2. `אי ודאות לגבי המשך העסקה` sits in that block with no number. It is either
   the block's 22nd item or a leftover.
3. `בדיקת מבחנים` appears twice in the component list of both allocation grids,
   leaving 13 unique components rather than 14.
4. `מספר שעות עבודה יומי ממוצע` offers no answer options. Assumed a free
   numeric input until the owner says otherwise.
5. `סיפוק בחיים` uses `במידה נמוכה` where the other 1–5 blocks use
   `במידה מועטה`. Either a second named scale or a typo.
6. The document states ~15 minutes. 126 items is 20–30 realistically, and
   `estimateMinutesForQuestions` would compute 21
   ([`survey-definition.ts:276`](../src/lib/survey-definition.ts#L276)).

## 5. Phases

Each phase is independently deliverable, gets its own branch and its own task
file, and is verified per `.agents/skills/shalomut-verification/SKILL.md`.

### Phase 1 — the answer model (no UI)

The blocking layer. Nothing else can be built against the current types.

- `SurveyDefinitionQuestion` gains `kind` (`analytic` | `background`),
  `scaleId`, `options`, `polarity` and `sectionId`; `dimensionId` becomes
  optional and is required only for `analytic`
  ([`types/backend.ts:26`](../src/lib/types/backend.ts#L26)).
- Named scales become data rather than the single `responseScale` export:
  `likert-5-extent`, `likert-5-extent-low`, `likert-7-frequency`, and the
  existing three-colour scale kept under its own id so existing rounds keep
  rendering.
- Score normalisation to 0–100 — `(v − 1) / (n − 1) × 100`, reversed for
  negative polarity — so a dimension average keeps meaning one thing across
  scales. This replaces `SurveyService.valueToScore`
  ([`survey.service.ts:47`](../src/lib/services/survey.service.ts#L47)).
- `parseSurveyDefinition` validates per kind instead of demanding a dimension
  from every question.
- Persistence: `QuestionAnswer.value`/`score` must carry numeric answers, and
  the allocation grid needs a representation — 13 sub-question rows or a JSON
  value column. Decide in the phase, record it in an ADR.
- The §3 migration.
- `answerMode`, a free-text label today, becomes a typed union.

**Verification:** typecheck, lint, build, `npm test`, plus `verify:db` because
the schema changes. New unit tests for normalisation in both polarities and for
per-kind validation.

### Phase 2 — k-anonymity

- A suppression module with its own tests. Nothing in the product does cell
  suppression today; `privacyThreshold` protects totals, not cross-tabs.
- Revisit the per-question unlock rule. ADR-004 makes unlocked analysis
  all-or-nothing across every analysed question, so under the current rule one
  skipped demographic item locks the entire round
  ([`PROJECT_CONTEXT.md` ADR-004](../PROJECT_CONTEXT.md)). Background items must
  be outside that rule, or the rule changes; either way it is an ADR amendment.
- Decide and document whether background items cross the AI boundary at all.
  `encodeAnalyticsInput` sends every question aggregate
  ([`analytics-encoder.ts:64`](../src/lib/analytics-encoder.ts#L64)), so
  demographics would travel unless excluded deliberately.

**Verification:** unit tests that a below-threshold cell is suppressed and that
suppression cannot be undone by combining cells; update
[`data-flow-and-subprocessors.md`](data-flow-and-subprocessors.md) in the same
branch.

### Phase 3 — the respondent experience *(needs decision 3)*

- Render by block with the scale anchors shown once per block, rather than one
  question per screen ([`survey-flow.tsx`](../src/components/survey/survey-flow.tsx)).
  126 single-question screens is a different product from 24.
- Three new input widgets: N-option radio group, numeric field, and the
  allocation grid with a live sum-to-100 refusal.
- Re-derive the time estimate and re-define `lastQuestionReached` — the funnel's
  drop-off index means something different when a screen holds a block
  ([`types/backend.ts:120`](../src/lib/types/backend.ts#L120)).
- Consent, intro and anonymity copy taken from the document.
- `survey-draft-storage` fingerprint and the attempt beacon follow the new shape.

**Verification:** component tests per widget, plus a browser smoke of one
complete pass at desktop and phone viewports.

### Phase 4 — the builder

- Answer-type selection, option-set editing, section editing and polarity, in
  place of today's free-text `answerMode`.
- Collapsible sections. 126 rows as a flat list is not readable
  ([`survey-builder-questions.tsx`](../src/components/survey/survey-builder/survey-builder-questions.tsx)).
- `getBuilderQuestionnaireValidation` reports per-kind problems
  ([`survey-builder/types.ts:29`](../src/components/survey/survey-builder/types.ts#L29)).

**Verification:** builder tests plus a signed-in browser walk.

### Phase 5 — contract `7.0`, consumer-first *(needs decision 3)*

`6.0` cannot carry this and must not be amended to. Two of its rules are
incompatible rather than merely tight:

- `metricCoverage: "exactly every input question aggregate in its persisted
  dimension"` with a 300–500 character Hebrew `insightText` on every metric
  would mean 108 narratives per round, on top of five recommendations for each
  of eight stones.
- `scoreDistribution` is `{green, yellow, red}` and required from `5.0`, which
  is not a description of a 1–7 item.

So: a new immutable manifest, a capability entry, and the six-step rollout of
[`ai-contract-version-matrix.md`](ai-contract-version-matrix.md) §"Adding a real
next version" — Python first, Core producing the rollback value throughout.
`1.0`–`6.0` keep their semantics.

**Verification:** the version-fitness checks, `lint:contract-refusals`, a
refusal suite for the new version, `verify:ai`, and deployed health evidence
from both services.

### Phase 6 — the swap and the documentation

- `createCanonicalSurveyDefinition` builds the new instrument
  ([`survey-definition.ts:280`](../src/lib/survey-definition.ts#L280)).
- Builder suggestions read from it
  ([`question-suggestions.ts:39`](../src/components/survey/survey-builder/question-suggestions.ts#L39)).
- `sourceMaterials` gains the document.
- `docs/openapi.yaml:1147` — the `[green, yellow, red]` answer enum — and
  `public/openapi.json` via `npm run openapi:generate`.
- [`source-of-truth.md`](source-of-truth.md), `PROJECT_CONTEXT.md` ADR-004 and
  ADR-005, `PROGRESS.md`, `ROADMAP.md`, `capabilities.json`, the seed and the
  tests that build fixtures from `surveyInstrument.questions`.

## 6. What this plan does not do

- It does not change the eight dimensions. They are the dashboard taxonomy, the
  map geometry and the shape of every AI output, and the owner's decision keeps
  them.
- It does not change the scoring bands. Green `≥75` / yellow `50–74` / red `<50`
  are deployment-wide and validated by both runtimes
  ([`source-of-truth.md`](source-of-truth.md) §Implementation Rules). A
  normalised Likert midpoint lands at 50, so most items will read yellow or red
  under the shipped bands. **That is a measurement question for the owner, and
  it is deliberately not answered here** — per-round bands would be new contract
  semantics.
- It does not touch rounds that already exist. A round analyses its own
  persisted snapshot, so a school mid-collection keeps the questionnaire its
  staff started with.
- It does not add cross-round AI narrative, which was decided against on
  2026-08-04.

## 7. Open questions for the owner

1. The item-to-dimension mapping and the reverse-scored list (decision 3).
2. The six document defects in §4.
3. Whether the scoring bands stay as they are once answers are normalised
   Likert values (§6).
4. Whether background items cross the AI boundary (phase 2).
5. Whether the allocation grids are analysed at all, or collected and shown
   without reaching a stone.
