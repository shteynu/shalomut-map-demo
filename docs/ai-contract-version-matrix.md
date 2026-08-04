# AI analytics contract version matrix

Updated: 2026-08-04.

## Runtime status

| Boundary | Source of supported versions | Current result |
| --- | --- | --- |
| Shared capability registry | `contracts/capabilities.json` | `1.0`–`6.0` capability metadata |
| Core callback validators | `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` | `1.0`–`6.0` |
| Core producer | `PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS` | `3.0`–`6.0`; unset defaults to `5.0`; deployed Production explicitly selects `6.0` |
| Core health | producer resolver + callback list | reports produced/producible/supported separately |
| Core MCP/OpenAPI | registry plus OpenAPI discriminator integrity tests | callback output `1.0`–`6.0`; deployed round analytics are produced as `6.0` |
| Python parser and pipeline | Python supported-version tuple plus shared capabilities | `1.0`–`6.0`; V6 structured summary, narrative metrics and top-five recommendations are implemented in `main` |
| Python health | `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` | deployed health reports `1.0`–`6.0`; deployed source includes `97f0641` |
| Shared golden corpus | `contracts/fixtures/golden_corpus.json` | positive/negative cases for `1.0`, `3.0`, `4.0`, `5.0`, `6.0` |

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

The consumer-first rollout is complete. Deployed Python and Core source includes
`97f0641`; Python health reports V6 support, Core permits V6 production, and
Production explicitly selects `6.0`. The unset default remains `5.0`, which is
also the configuration rollback value.

## Adding a real next version

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
