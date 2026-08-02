# AI analytics contract version matrix

Updated: 2026-08-02.

## Runtime status

| Boundary | Source of supported versions | Current result |
| --- | --- | --- |
| Shared capability registry | `contracts/capabilities.json` | `1.0`–`5.0` |
| Core callback validators | `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` | `1.0`–`5.0` |
| Core producer | `PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS` | `3.0`–`5.0`; unset defaults to `5.0` |
| Core health | producer resolver + callback list | reports produced/producible/supported separately |
| Core MCP/OpenAPI | registry plus OpenAPI discriminator integrity tests | `1.0`–`5.0` only |
| Python parser and pipeline | shared manifests + `CONTRACT_REGISTRY` | `1.0`–`5.0` |
| Python health | `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` | `1.0`–`5.0` |
| Shared golden corpus | `contracts/fixtures/golden_corpus.json` | positive/negative cases for `1.0`, `3.0`, `4.0`, `5.0` |

## Contract `6.0`

`6.0` is reserved, not published. It has no accepted semantic delta and no
`contracts/ai-analytics-v6.json`; consequently it is absent from the production
capability manifest, Core/Python supported-version lists, health responses and
OpenAPI discriminators. A configured Core producer value of `6.0` fails closed.

Both languages inject a dummy `6.0` into a test-only registry copy. Those tests
prove that a future version can be expressed through capabilities without
adding exact-version policy branches; they do not advertise runtime support.

## Adding a real next version

The rollout remains consumer-first:

1. Accept the semantic delta and publish `contracts/ai-analytics-v6.json` plus
   its capability entry and golden-corpus cases.
2. Update Python parsing/output validation and deploy the consumer. Its health
   must report `6.0` before any producer emits it.
3. Update Core callback/OpenAPI readers and deploy them.
4. Add `6.0` to Core producible versions and only then change the configured or
   default producer version.
5. Run version-fitness, TypeScript, Python, OpenAPI and boundary E2E checks and
   record deployed health evidence from both services.
