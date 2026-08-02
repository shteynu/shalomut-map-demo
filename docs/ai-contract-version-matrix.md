# AI analytics contract version matrix

Updated: 2026-08-02.

## Runtime status

| Boundary | Source of supported versions | Current result |
| --- | --- | --- |
| Shared capability registry | `contracts/capabilities.json` | `1.0`–`6.0` capability metadata |
| Core callback validators | `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` | `1.0`–`6.0` |
| Core producer | `PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS` | `3.0`–`5.0`; unset defaults to `5.0` |
| Core health | producer resolver + callback list | reports produced/producible/supported separately |
| Core MCP/OpenAPI | registry plus OpenAPI discriminator integrity tests | callback output `1.0`–`6.0`; produced round analytics through `5.0` |
| Python parser and pipeline | Python supported-version tuple plus shared capabilities | `1.0`–`5.0`; V6 capability metadata is readable but V6 payloads are not supported |
| Python health | `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` | `1.0`–`5.0` |
| Shared golden corpus | `contracts/fixtures/golden_corpus.json` | positive/negative cases for `1.0`, `3.0`, `4.0`, `5.0` |

## Contract `6.0`

`6.0` now has an accepted semantic delta and a published
`contracts/ai-analytics-v6.json`. Core can validate, cross-check, persist and
render its callback output: three dimension summary paragraphs, qualitative
metric `insightText` and exactly five recommendations. Numeric metric evidence
remains in the payload for callback verification but is not rendered as the
primary V6 metric content.

This is deliberately a consumer-first state. Core still produces only
`3.0`–`5.0` and defaults to `5.0`; configuring its producer to `6.0` fails
closed. Python reads the shared V6 capability metadata but its parser, pipeline
and health list remain `1.0`–`5.0`, so no service currently emits V6.

## Adding a real next version

The rollout remains consumer-first:

1. Deploy the Core callback/OpenAPI consumer and verify Core health advertises
   V6 callback support while the produced version remains `5.0`.
2. Update Python parsing, typed state, generation and output validation; add V6
   golden-corpus/fixture coverage and deploy Python. Its health must report
   `6.0` before any producer emits it.
3. Expand the intervention catalog so every dimension/status pair can supply
   five distinct recommendations and verify deterministic fallback output.
4. Add `6.0` to Core producible versions and only then change the configured or
   default producer version.
5. Run version-fitness, TypeScript, Python, OpenAPI and boundary E2E checks and
   record deployed health evidence from both services.
