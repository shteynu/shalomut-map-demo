# AI analytics contract version matrix

## Runtime status

| Boundary | Source of supported versions | Current result |
| --- | --- | --- |
| Shared capability registry | `contracts/capabilities.json` | `1.0`–`7.0` capability metadata |
| Core callback validators | `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` | `1.0`–`7.0`; in `main` since 2026-09-12, deployed since 2026-09-13 |
| Core producer | `PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS` | `3.0`–`7.0`; unset defaults to `5.0`; deployed Production explicitly selects `7.0` since 2026-09-13 |
| Core health | producer resolver + callback list | reports produced/producible/supported separately; deployed Core reports `7.0` produced from configuration, read 2026-09-17 |
| Core MCP/OpenAPI | registry plus OpenAPI discriminator integrity tests | callback output `1.0`–`7.0`; deployed round analytics are produced as `7.0` since 2026-09-13 |
| Python parser and pipeline | Python supported-version tuple plus shared capabilities | `1.0`–`7.0`; in `main` since 2026-09-12, deployed since 2026-09-13; V7 answer scales, no metric narrative |
| Python health | `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` | deployed health reports `1.0`–`7.0`, read 2026-09-17 |
| Shared golden corpus | `contracts/fixtures/golden_corpus.json` | positive/negative cases for `1.0`, `3.0`, `4.0`, `5.0`, `6.0`, `7.0` |
| Shared callback corpus | `contracts/fixtures/callback_corpus.json` | accepted payloads `1.0`–`7.0`, refused mutations both runtimes judge by the same rule; `7.0` since 2026-09-12 |

## Contract `6.0`

`6.0` now has an accepted semantic delta and a published
`contracts/ai-analytics-v6.json`. Core can validate, cross-check, persist and
render its callback output: three dimension summary paragraphs, qualitative
metric `insightText` and exactly five recommendations. Numeric metric evidence
remains in the payload for callback verification but is not rendered as the
primary V6 metric content.

Since 2026-08-04 `6.0` also declares `supportsPartialMaps`. A stone whose
overview this round could not write carries `summary: []`,
`generationProvenance.outcome: "unavailable"` and a matching entry in
`dimensionsWithoutInterpretation`; its metric narratives and recommendations
are still required, so the gap is the three paragraphs about the dimension and
nothing else. What produces one is repair exhaustion, not a silent provider —
on `6.0` a silent provider still falls back (ADR-007).

Also since 2026-08-04, a stone reported as a gap may name its cause in
`generationProvenance.unavailableReason`: `provider_unavailable` when the
service did not answer, `validation_rejected` when this service wrote the copy
and then refused it. The field is optional, is only accepted beside
`outcome: "unavailable"`, and rounds analysed before it existed carry none.

The consumer-first rollout completed with deployed source at `97f0641`, and
Production selected `6.0` from then until 2026-09-13, when it moved to `7.0`
(see *Contract `7.0`*). Both deployed halves still accept `6.0` — each health
endpoint lists it. The unset default remains `5.0`, which is also the
configuration rollback value.

The local stack selected `6.0` from 2026-08-09. It had been pinned to `5.0` in
`.env.local` — which overrides `.env` in both `scripts/local-stack.mjs` and
Next.js — so a local run exercised a lighter contract than the deployment
produced, and did so silently. On a new round it can no longer be silent:
since the swap of 2026-09-12 a stack producing anything below `7.0` refuses to
analyse a round on the research instrument. The stack banner prints the version
it resolved; that line is the check after any env change.

Since 2026-08-05 a stone also says who wrote its metric narratives, in
`generationProvenance.metricInsightsOutcome`: `llm` or `deterministic_fallback`,
one value for all of the dimension's narratives, and never `unavailable`. It is
optional, is refused on any version without narrative metrics, and is absent on
rounds analysed before it existed.

Since 2026-08-19 the round also says who wrote its opening sentence, in
`overallSummaryOutcome`: `llm` or `deterministic_fallback`, the round-level
sibling of every stone's own `outcome`. Until it existed, a `6.0` round the
provider stayed silent for read as a plain success with a real interpretation
of its numbers, and there was no field a screen could check to say otherwise —
the summary and the dimensions fall back independently, so a manager could be
reading the model's account of eight derived stones. It is optional, is refused
on any version without a structured dimension summary (`4.0` and earlier never
ask the model for this sentence at all, and the field would describe a choice
those versions do not make), and is absent on rounds analysed before it
existed.

## Contract `7.0`

Published 2026-09-12 as `contracts/ai-analytics-v7.json`, for the research
instrument that `6.0` cannot carry. It is `6.0` in its overview — three
paragraphs per stone, five adapted recommendations, a two-to-four-sentence
round summary, partial maps, the same provenance — with two changes of
meaning:

- **Every question aggregate names its answer scale and its polarity**
  (`scaleId`, `polarity: positive | negative`), and every metric echoes both
  back for Core to verify the way `5.0` echoes the distribution. The average
  is already normalised to 0–100 with the polarity applied, so a high number is
  good for the dimension on every question; the fields say what the respondent
  was shown, and the prompts say so to the model. `scoreDistribution` keeps its
  shape and gains its definition: the count of normalised answer scores in each
  band, which on the colour scale is the count of chosen colours.
- **Metrics carry no narrative.** `insightText` is forbidden on a metric and
  `metricInsightsOutcome` on a stone: with over a hundred statements a round,
  a narrative per metric is over a hundred narratives, and the dimension's
  paragraphs are the reading of its questions. The screens render a `7.0`
  metric as the numeric evidence they render for `5.0`.

The capability manifest says this as `usesNarrativeMetrics: false` and a new
flag, `carriesAnswerScale: true`; every earlier version declares the flag
false. The refusal-suite gate now groups versions by `usesNarrativeMetrics` as
well, so `7.0` has its own validation path and its own refusal suite.

**Rollout state: all six steps of the sequence below are done, and Production
produces `7.0` since 2026-09-13.** Steps 1 and 4 landed on 2026-09-12: the
manifest and capability entry are published; the Python parser, pipeline and
outgoing gate accept and produce `7.0`; Core validates, verifies, persists and
renders it; `7.0` is in Core's producible list with the unset default unmoved
at `5.0`; and a complete local round on a mixed-scale questionnaire has crossed
MCP → the shipping Python pipeline → callback verification → the Dashboard DTO
under `AI_ANALYTICS_CONTRACT_VERSION=7.0`. The branch's local checks for step 6
are in its archived task file, `claude--methodology-questions-analysis-gvh18u.md`.
Steps 2, 3 and 5 followed on 2026-09-13: both halves were deployed with the
`7.0` code, then Production's `AI_ANALYTICS_CONTRACT_VERSION` moved from `6.0`
to `7.0` and Core was redeployed, and both health endpoints were read saying so
— that day, and again on 2026-09-17. The tracker handoff's *Last read* owns the
reading.

The refusal the swap made necessary still exists and no longer fires on the
deployment. Since 2026-09-12 (ADR-004 as amended) every new round is on the
instrument, and any environment producing a version without
`carriesAnswerScale` refuses to analyse such a round at the MCP boundary —
`encodeAnalyticsInput`, naming the variable to change — rather than analysing
it as a colour-scale round. That includes the unset default: a rollback to
`5.0` refuses every round on the instrument. No round on the instrument has
been analysed through the deployment yet; what that waits on is in the tracker
handoff.

## Amending a published version

`supportsPartialMaps`, `generationProvenance.unavailableReason`,
`generationProvenance.metricInsightsOutcome` and `overallSummaryOutcome` were
added to `6.0` after it was published. That is allowed, and only in the narrow
form
ADR-002 describes since 2026-08-05: an optional field whose absence means what
the version already meant, no existing field touched, a consumer written before
it still working, and the consumer still accepting before the producer emits.
Everything wider — a changed meaning, a new required field, a removal, a shape a
consumer must understand to render a round — is a new version, and the sequence
in the next section applies instead.

Record an amendment in three places or it is not one: the version's manifest
under `contracts/`, this document, and the ADR that owns the behaviour.

## Adding a real next version

`7.0` followed this sequence in 2026-09 (see *Contract `7.0`* above for where
it stands). The reasoning that made it a version rather than an amendment is
kept here because the next one will face it again: `scoreDistribution` was
`{green, yellow, red}` of chosen colours, which cannot describe a 1–7 item, and
`metricCoverage` — exactly every input question aggregate, each with a 300–500
character `insightText` — would have meant 108 narratives per round. Both were
changed meanings rather than optional additions, so the amendment rule in the
section above did not apply and the sequence below did. Nothing about
`1.0`–`6.0` changed.

The rollout remains consumer-first:

1. Publish a new immutable manifest and capability entry without changing the
   semantics of `1.0`–`6.0`.
2. Deploy Python parser/generation support and verify health reports the new
   accepted version while Core still produces the previous rollback value.
3. Deploy Core callback/OpenAPI/Dashboard consumer support and verify the
   produced version is still unchanged.
4. Run a complete local round through callback persistence and Dashboard
   rendering for the new version.
5. Add the version to Core producible choices and only then change the explicit
   deployed producer configuration. Change the unset default only as a separate
   rollback-policy decision.
6. Run version-fitness, TypeScript, Python, OpenAPI and boundary E2E checks and
   record deployed health evidence from both services.
