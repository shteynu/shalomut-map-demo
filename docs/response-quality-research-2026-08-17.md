# Research: how a round was filled, and whether the product may act on it

Dated 2026-08-17, against `8231490`. Read-only research. Nothing here is
implemented, and the one design it recommends is smaller than the feature that
was asked for — that narrowing is the result, not a shortfall.

## 1. What was asked

The owner asked to see *how* people answered, in order to spot questionnaires
filled suspiciously — too fast, or 95% one answer. Explicitly **not** automatic
exclusion, because that would depress the completion rate the product reports.
Instead the system should state its findings in a round summary and offer the
manager the choice to exclude or not.

The research question was therefore three questions: is the signal real on this
instrument, may the product publish it, and where would it live.

## 2. The answer in one paragraph

The descriptive half is real and cheap: the product can honestly say how long
filling took relative to the questionnaire's own estimate, and it already holds
almost everything needed. The **acting** half — excluding responses — does not
survive on this data at this school size. Three independent reasons, each
verified against code or literature in §5. The owner's decision on 2026-08-17
was therefore the descriptive report without exclusion, with the exclusion half
reconsidered only if the methodologist adds attention-check items.

## 3. The instrument decides whether any of this is possible

All 24 canonical questions are `polarity: "positive"` — there are no reverse-keyed
items, and there is no UI to create one. The value is hardcoded in both places
that construct a question:
[`survey-definition.ts:601`](../src/lib/survey-definition.ts#L601) for the default
template and [`survey-builder.tsx:73`](../src/components/survey/survey-builder.tsx#L73)
and `:425` for anything a manager adds. All 24 answer on `wellbeing-colour`,
a three-point scale scored 100/60/0.

This matters more than the count of items. The most recent experimental
comparison of 14 careless-responding indices — Goldammer, Stöckli, Escher,
Kuhn & Annen (2024), *Behavior Research Methods* — explicitly does **not**
recommend `longstring` and `IRV`, and reports them ineffective for
unidirectionally keyed scales. Those are precisely the two indices that a
24-item three-point instrument can support. Its recommended core (resampled
personal reliability, Mahalanobis D, normed Guttman errors) needs either
reverse-keyed pairs or a sample larger than the item count.

On a three-point scale a respondent has three possible straight lines, and one
of them — everything green — is the outcome the product exists to produce.

The 126-item research instrument
([`default-research-instrument-plan-2026-08-14.md`](default-research-instrument-plan-2026-08-14.md))
changes this: mixed polarity, 1–5 and 1–7 scales, eight dimensions of roughly
thirteen items. Its phases 1 and 2 are built. Which items are reverse-scored is
part of the methodologist's mapping, which blocks phases 3 and 5 and blocks this
feature for the same reason.

## 4. What the repository already has

- **Filling duration per response, with no migration.** `survey_responses` and
  `survey_attempts` both carry `anonymous_token_hash` under
  `@@unique([roundId, anonymousTokenHash])`
  ([`schema.prisma:141`](../prisma/schema.prisma#L141) and `:177`), and the
  submit route writes the same literal to both
  ([`submit/route.ts:95`](../src/app/api/survey/[shareCode]/submit/route.ts#L95)
  and `:120`). No query in the codebase joins them today.
- **An a-priori cost model for filling.**
  [`survey-duration.ts`](../src/lib/survey/survey-duration.ts) prices each step
  — `blockPreamble` 20s, `blockRow` 6s, `choice` 10s, `allocationRow` 8s — and
  its result is already persisted as `SurveyDefinition.estimatedMinutes` and
  already shown to the respondent. This is the honest denominator for "faster
  than expected", and it replaces the invented "two seconds per item" rule.
- **Two architectural precedents.**
  [`SurveyFunnelService`](../src/lib/services/survey-funnel.service.ts) is a
  deterministic behavioural aggregate with its own privacy floor
  (`ABANDON_DETAIL_MINIMUM = 3`) separate from the round threshold, and
  [`dividedDimensions`](../src/lib/dashboard/dimension-division.ts#L39) is
  documented as new analytics needing "no new data, no new column and no
  contract version".
- **No exclusion concept anywhere.** `SurveyResponse` is `id`, `roundId`,
  `anonymousTokenHash?`, `submittedAt` and its answers; `ISurveyRepository` has
  five round-scoped methods and no `findById` or `update`.

Three caveats bound any duration metric, and each needs an honest third state
rather than a zero:

1. `anonymousTokenHash` is optional on a response
   ([`submit/route.ts:57`](../src/app/api/survey/[shareCode]/submit/route.ts#L57));
   such a response joins to nothing.
2. `markCompleted` does not create an attempt row if the `opened` beacon was
   lost
   ([`prisma-survey-attempt.repository.ts:113`](../src/lib/repositories/prisma/prisma-survey-attempt.repository.ts#L113));
   this is already counted as `completedWithoutAttempt`.
3. `completed_at − opened_at` is the lifetime of a session, not the work in it.
   `openedAt` survives a reload, a backgrounded tab and a lunch break, and
   `markCompleted` backfills `consentAcceptedAt` from `openedAt` when the
   consent beacon was lost.

## 5. Three findings that refuted the acting half

Each was checked against the code, not inferred.

### 5.1 Per-item timing is not measurable in this product

The respondent screen walks **steps**, and a step may be a whole block:
`SurveyStep` is `question | allocation | block`, where `block` holds an array of
analytic questions ([`survey-steps.ts:23`](../src/lib/survey/survey-steps.ts#L23)),
and `survey-flow.tsx` keeps `currentIndex` over steps. The research instrument's
resources block is 30 statements on one screen. A client can time a step, never
an item.

Normalising a step's time by its item count is unsound by the product's own
model: `survey-duration.ts` prices the first row of a block at 20s and each
further row at 6s. "A per-item duration array" is therefore not implementable as
stated; only a per-step array is, and it is a materially weaker signal.

### 5.2 The false-positive rate is high *and directional*

A relative threshold of "twice as fast as the round's median" selects a tail
that exists by construction: for filling times with log-sd 0.5, the expected
position of the fastest of twenty respondents is about 2.4× the median. The
fastest honest respondent in a staff room of twenty is expected to trip it.

At a realistic prevalence for an unpaid, anonymous, voluntary staff wellbeing
survey (2–5% rather than the 10–12% of paid student samples), 60% sensitivity
and 10% false-positive rate on the union of indices, positive predictive value
is about **16%** — five of six flagged respondents are honest.

The decisive part is that the error is not random with respect to what is being
measured. `longstring` fires on homogeneity, and homogeneity lives at the poles:
on a resources scale it flags the satisfied, on a burnout scale the un-burned-out.
Speed correlates the same way. Excluding flagged responses therefore biases
dimension means **down** on wellbeing. A school would read its own filtering
decision as a deteriorating climate.

### 5.3 Excluding responses opens a differencing attack that group-level choice does not close

The proposed mitigation — let the manager choose by *reason* rather than by row
— protects the selection interface. The leak is in the published numbers.

[`displayableDistribution`](../src/lib/ai-insights-view-model.ts#L83) publishes
exact integer `{green, yellow, red}` counts per question once
`responseCount >= MINIMUM_PRIVACY_THRESHOLD`, and asserts
`total === responseCount`. Two publication bases differing by one respondent
move exactly one bucket by exactly one. That is a direct read of that person's
answer, not an estimate: 108 analytic items carry roughly 171 bits about one
individual, where identifying someone in a school of sixty needs about six.

`buildBackgroundBreakdown` publishes group sizes across the demographic
questions, so a one-person difference also yields role, seniority, stage and age
band without reading a single score. And the cell-suppression guarantee is
proved for **one** population
([`cell-suppression.ts:26-56`](../src/lib/privacy/cell-suppression.ts#L26));
two overlapping bases from one round were never in scope.

Two consequences follow:

- The gate "show the block only when exclusion actually changes something" is
  empty. The maximum shift from excluding `k` of `n` is `k·100/(n−k)` and the
  map's own resolution is `ceil(100/(n−k))`
  ([`minimumReadableDelta`](../src/lib/dashboard/round-comparison.ts#L87)), so
  their ratio is about `k`. For any `k >= 1` the shift is at least the
  resolution. Deciding whether exclusion matters requires computing both bases,
  which is the oracle itself.
- The consent screen does not cover this. Measuring how fast someone answered
  and deciding their answers do not count is a new purpose and a decision about
  an individual submission.

## 6. Two claims in the first design that were simply wrong

Recorded so they are not re-derived.

- **"Response rate stays honest because `getResponseCount` is not filtered."**
  False. The manager's response count comes from
  `analytics.totalResponses`
  ([`manager-context.service.ts:196`](../src/lib/services/manager-context.service.ts#L196)),
  computed inside `calculateDynamicRoundAnalytics`. `getResponseCount` feeds the
  funnel card only. Filtering inside the shared function would change the very
  number the owner refused to let automatic exclusion touch, and would put two
  contradicting counts on one screen.
- **"One button closes the round for good."** False. `closed → active` is an
  allowed transition, deliberately
  ([`round-status.ts`](../src/lib/rounds/round-status.ts)), so any stored
  exclusion decision can be outlived by responses that arrive after it.

Also worth recording: `calculateDynamicRoundAnalytics` **is** the single choke
point for the MCP send path and the callback verification path — both reach it,
one via `getAnalyticsForRound` and one via `ai-insights-service.ts:145`. But
`buildBackgroundBreakdown` reads responses separately and computes dimension
means outside it, so it is a genuine third path that any filtering design must
handle.

## 7. The design that survives

A descriptive report about the **collection**, not a verdict on people.

- **What it says.** How many completed questionnaires took less than the
  questionnaire's own `estimatedMinutes`, how filling time was distributed, and
  how many responses have no timing at all — the last stated explicitly, in the
  manner of `completedWithoutAttempt`, because a response without timing is not
  a fast one.
- **What it never says.** No score deltas, no "what changes if you exclude", no
  recoloured stones, no per-response row, no timestamp of an individual filling.
  Nothing that creates a second basis of calculation. This is what removes the
  differencing attack, the directional bias and the consent question at once.
- **What action it sanctions.** Round-level: extend collection, reword the
  invitation. Not subtracting people.
- **Where it lives.** A pure module under `src/lib/analytics/` plus a service
  that takes repositories as parameters, following `SurveyFunnelService`. Not a
  separate deployable service, and no AI-contract change: the numbers are
  deterministic and the LLM is not involved. Routing it through the analytics
  service is in any case blocked three times over — `additionalProperties: false`
  on Core's own outgoing MCP payload
  ([`mcp/route.ts:39`](../src/app/api/mcp/route.ts#L39)),
  `_DYNAMIC_FORBIDDEN_FIELDS` in the Python schema, and the fixed
  `RoundAnalyticsResult` dataclass — and would require a manifest `7.0` that has
  not been started.
- **Group floor.** Counts in the report need their own minimum group size on the
  precedent of `ABANDON_DETAIL_MINIMUM = 3`, not only the round's privacy
  threshold. "One response was excluded as too fast" in a staff of twenty is a
  sentence about an individual.

## 8. Tooling, if indices are ever built

- The R package **`careless` 1.2.2 is MIT**, not GPL, and frozen since 2023 — it
  may be ported or copied verbatim into a proprietary product with its copyright
  notice. Seven functions, about 18 KB of source. `PerFit` and `mirt` are GPL;
  take formulas from the papers, not code.
- **Nothing exists on PyPI or npm.** (`careless` on PyPI is crystallography.)
- A prototype of `longstring`, `IRV`, `even-odd` and Mahalanobis came to **132
  lines of dependency-free TypeScript**; Mahalanobis needs a Cholesky
  decomposition rather than a matrix inverse and returns null on a singular
  covariance.
- At school scale `n < p` always holds against 126 items, so Mahalanobis and
  `psychsyn` are not usable; person-fit statistics additionally need a
  calibrated IRT model the project does not have.
- Two porting traps: `longstring` and `IRV` must be computed from the raw
  `QuestionAnswer.value`, never from `score`, because polarity inversion turns a
  straight-liner into a high-variance respondent; and `even-odd` reversed sign
  in `careless` 1.2.0, so thresholds quoted from pre-2020 papers read backwards.

## 9. Owner decisions taken on 2026-08-17

1. Target the 126-item instrument; the feature is not built against the current 24.
2. The report is descriptive only. No exclusion, for now.
3. Attention-check items go to the methodologist as an open question. They are
   the one signal considered here that is not directionally biased — a satisfied
   respondent fails a trap no more often than a dissatisfied one — so a positive
   answer is what would make an exclusion feature defensible later.
4. Removing the automatic AI analysis during collection is accepted as a
   **separate task**, independent of this feature.
5. Per-round manual close then analysis is the intended shape, subject to (4).

## 10. Open questions

- Whether the methodologist will add attention-check items, and how many.
- Whether the descriptive report should appear before the round closes or only
  after. The owner said it appears once the completed-questionnaire minimum is
  reached; which threshold that is — the round's `privacyThreshold` or a smaller
  floor of its own, as the funnel has — is not settled.
- Whether removing the during-collection analysis also removes the existing
  one-person differencing exposure it creates (a dashboard rendered at `n = 10`
  and again at `n = 11` is already two bases differing by one respondent). That
  belongs to the separate task in §9.4 and is noted here because this research
  is what found it.
