# AI analytics contract version matrix

Updated: 2026-08-02.

## Runtime status

| Boundary | Source of supported versions | Current result |
| --- | --- | --- |
| Shared capability registry | `contracts/capabilities.json` | `1.0`–`6.0` capability metadata |
| Core callback validators | `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` | `1.0`–`6.0` |
| Core producer | `PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS` | rollout branch permits `3.0`–`6.0`; unset defaults to `5.0`; deployed config remains `5.0` until the final gate |
| Core health | producer resolver + callback list | reports produced/producible/supported separately |
| Core MCP/OpenAPI | registry plus OpenAPI discriminator integrity tests | callback output `1.0`–`6.0`; rollout branch can produce through `6.0` while the default remains `5.0` |
| Python parser and pipeline | Python supported-version tuple plus shared capabilities | `1.0`–`6.0`; V6 structured summary, narrative metrics and top-five recommendations are implemented in `main` |
| Python health | `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` | deployed health reports `1.0`–`6.0` at `cf9ae07` |
| Shared golden corpus | `contracts/fixtures/golden_corpus.json` | positive/negative cases for `1.0`, `3.0`, `4.0`, `5.0`, `6.0` |

## Contract `6.0`

`6.0` now has an accepted semantic delta and a published
`contracts/ai-analytics-v6.json`. Core can validate, cross-check, persist and
render its callback output: three dimension summary paragraphs, qualitative
metric `insightText` and exactly five recommendations. Numeric metric evidence
remains in the payload for callback verification but is not rendered as the
primary V6 metric content.

The consumer-first deployment gate is satisfied at `cf9ae07`: deployed Python
reports V6 support and deployed Core contains the V6 consumer. The rollout
branch explicitly permits `6.0` as a Core producer choice while preserving the
unset default at `5.0`. The deployed configuration remains `5.0` until this
branch is deployed, health is reconfirmed, and the final configuration switch
is made.

## Adding a real next version

The rollout remains consumer-first:

1. Deploy the Core callback/OpenAPI consumer and verify Core health advertises
   V6 callback support while the produced version remains `5.0`.
2. Deploy the completed Python V6 parser/generation/fallback/catalog branch and
   verify deployed health reports `6.0` at the expected commit.
3. Run a complete local V6 round through callback persistence and Dashboard
   rendering while Core still produces `5.0` by default.
4. Add `6.0` to Core producible versions and only then change the configured or
   default producer version.
5. Run version-fitness, TypeScript, Python, OpenAPI and boundary E2E checks and
   record deployed health evidence from both services.
