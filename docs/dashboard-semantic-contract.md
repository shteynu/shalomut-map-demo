# Dashboard Semantic Contract

> Lifecycle note (2026-08-02): this document defines the semantic foundation
> introduced by contracts `2.0` and `3.0`. The current runtime extends it
> through deployed `6.0`; current capabilities and sentence/output differences
> are canonical in `contracts/capabilities.json` and
> `docs/ai-contract-version-matrix.md`. Historical rollout steps below are not
> the current producer configuration.

## Status and versioning

The persisted AI analytics `1.0` contract is the deployed structural baseline.
It guarantees the contract version, round identity, privacy state, eight
canonical dimensions, and the basic Stone Map shape. It does not guarantee
content quality or question-level grounding.

The requirements below are published as breaking contract `2.0` in
`contracts/ai-analytics-v2.json`. They are intentionally not presented as
compatible `1.0` behavior: requiring 24 question aggregates and stricter
output validation changes what producers and consumers must send and accept.
`contracts/ai-analytics-v1.json` remains immutable and retains its deployed
structural validation semantics.

Breaking contract `3.0` is implemented, verified, and deployed. It keeps the
same eight dimensions and semantic output rules, but replaces the exact-24
input/metric allowlist with the exact persisted questions of a round.

### Historical contract `2.0` consumer-first rollout

The two transport directions roll out without a version gap:

1. Deploy the Python consumer first so it accepts legacy input (missing version
   or `1.0`) and `2.0`. It must respond with the same effective version as its
   input, so the existing Core keeps receiving `1.0`.
2. Deploy a Core compatibility release whose callback accepts both `1.0` and
   `2.0`, while its MCP producer still sends the legacy shape.
3. Switch the Core MCP producer to explicit `contractVersion: "2.0"` with the
   complete aggregate maps. The compatible Python service then produces `2.0`,
   which the compatible Core validates and persists.
4. Keep `1.0` acceptance during the rollback window. A rollback of the Core
   producer returns the exchange to `1.0` without requiring a Render rollback.

This sequence was completed before the later `3.0` rollout and remains the
legacy compatibility boundary.

### Breaking contract `3.0`: dynamic questionnaires

Contract `2.0` remains immutable and continues to describe the exact canonical
24-question exchange. Contract `3.0` removes that input allowlist without
weakening the output semantics documented below.

For the next version, the exact persisted `SurveyRound.surveyDefinition`
snapshot is the questionnaire source of truth. Question IDs, text, and count
may differ between rounds; each analyzed product-domain question must map to
one of the same eight dimensions. Core sends only privacy-safe aggregates for
those actual questions, and the AI prompt, deterministic fallback, metrics,
and provenance must use their exact IDs and text.

Partial unlocked analysis is forbidden. The round is unlocked only when the
total and every analyzed question meet the configured threshold; otherwise all
detailed maps and stones remain empty and the provider is not invoked.

The Dashboard result remains fixed: exactly eight stones, Core-owned scores
and statuses, Hebrew interpretations, status-scoped actions, one overview
summary, and question-grounded metrics. A dimension without privacy-safe
question evidence makes the definition/payload validation fail; below-threshold
evidence makes the whole result locked. The AI must not invent a stone. The
implementation contract and acceptance matrix are in
`docs/dynamic-questionnaire-ai-contract.md`.

The deployed `3.0` consumer validates a deterministic questionnaire hash, unique
question IDs, supported dimension mappings, complete eight-dimension coverage,
Core score/status consistency and privacy-safe counts. Every successful stone
contains all and only its actual round-question metrics; provenance references
those same IDs and hash. Callback persistence additionally recomputes the Core
analytics and rejects altered scores, statuses, labels, aggregates or counts.

Rollout completed consumer-first on 2026-07-26: Python accepted
`1.0`/`2.0`/`3.0`, then Core callback and Dashboard readers accepted all three,
and only then Core MCP switched to `3.0`. Producer `2.0` remains a valid
rollback boundary.

## Contract `2.0` canonical and privacy-safe input

An unlocked round MUST contain:

- exactly the eight canonical dimension aggregates;
- exactly the 24 canonical question aggregates from
  `src/lib/shalomut-source.ts`;
- for every question aggregate: `questionId`, its canonical `dimensionId`, the
  canonical Hebrew question text, numeric `averageScore`, and
  `responseCount`;
- only aggregates calculated after the configured privacy threshold is met.

The question aggregate map MUST be keyed by canonical `questionId`. Each
question MUST occur exactly once and under its canonical dimension. Dimension
scores and statuses remain Core Data facts; the AI service MUST NOT generate or
override them.

The boundary MUST NOT contain respondent identity, response IDs, anonymous
tokens, timestamps tied to a response, individual answers, or per-respondent
rows.

A privacy-locked round MUST contain empty dimension and question aggregate
maps. The provider MUST NOT be invoked for a locked round, and a locked output
MUST NOT contain stones, interpretations, metrics, or interventions.

## Interpretation quality

Every successful dimension interpretation MUST:

- contain exactly two complete sentences;
- end each sentence with terminal punctuation;
- use Hebrew for all user-facing prose;
- contain no Latin-script prose;
- stay consistent with the Core Data status and score;
- be grounded in canonical question aggregates from the same dimension.

Technical values such as contract versions, dimension IDs, status enums, and
internal source identifiers may remain Latin. Numeric values and punctuation
are allowed in Hebrew user-facing copy.

An OpenAI-compatible provider response is eligible only when its selected
choice has `finish_reason: "stop"`. A missing or different finish reason,
empty text, truncated text, non-Hebrew prose, or an explicit contradiction of
the Core status is invalid even when the HTTP response is `200`.

Invalid provider output follows the existing bounded retry and time-budget
rules. When no valid response is obtained, the service MUST use a deterministic
Hebrew fallback derived from same-dimension question aggregates. The fallback
MUST describe observed aggregate patterns and MUST NOT invent respondent-level
facts, unobserved causes, diagnoses, or identities.

## Contract `2.0` question-level metrics

Each Stone MUST contain exactly the three canonical question metrics belonging
to that dimension. A metric MUST identify the canonical question and expose
its Hebrew text, numeric aggregate score, and aggregate response count. The UI
may format those numeric facts for display.

The current generic `score / status / risk` triplet is not a question-level
metric set and MUST be rejected. A Stone's dimension score and status MUST be
consistent with the Core aggregate and the configured thresholds: green
`>=75`, yellow `50-74`, and red `<50`. Since 2026-08-03 both runtimes read
those bands from `contracts/scoring-bands.json`, so this rule is checked
against one definition rather than a copy per validator.

## Contract `2.0` generation provenance

Every `2.0` Stone MUST persist verifiable `generationProvenance`:

- `outcome`: `llm` or `deterministic_fallback`;
- total provider `attempts` and derived `retryCount`;
- exactly the three same-dimension canonical `sourceQuestionIds`.

An `llm` outcome requires at least one provider attempt. A deterministic
fallback may record zero attempts when no provider is configured or a bounded
positive attempt count after invalid provider output. Provenance contains no
prompt, generated response, secret, respondent row, or identity.

## Hebrew user-facing copy

The following fields are user-facing and MUST be Hebrew-only when present:

- the overall psychological summary;
- dimension names and interpretations;
- metric labels, helpers, and formatted display values;
- intervention titles, summaries, and actionable steps;
- dashboard action labels and explanatory copy.

Raw validation, transport, or provider errors MUST NOT be rendered directly to
the manager. The dashboard uses localized error and privacy states.

## Summary placement

`overallPsychologicalSummary` is round-level content. It MUST be rendered once
on the dashboard overview. It MUST NOT be appended to every dimension detail,
metric, or recommendation view. A dimension detail renders only its own
`psychologicalInterpretation`.

## Status-aware actions

The confirmed product semantics are:

- green is `חוזקה לשימור` and offers supporting or maintenance actions under
  `פעולות לשימור`;
- green MUST NOT be presented as an improvement goal or remedial problem;
- yellow and red may offer status-appropriate attention or improvement
  actions;
- an intervention selected for one status MUST NOT be used as a cross-status
  fallback.

The intervention catalog and selection policy are verified in their dedicated
slice. This contract defines their externally visible behavior without taking
ownership of the catalog implementation.

## Acceptance evidence

Readiness requires focused Core aggregation and MCP tests, Python provider and
formatter quality tests, TypeScript callback validation tests, view-model tests,
the cross-service suite, and a local browser smoke. No staging write, real
webhook, deployment, or alias mutation is implied by those checks.
