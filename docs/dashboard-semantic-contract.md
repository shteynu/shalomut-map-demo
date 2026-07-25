# Dashboard Semantic Contract

## Status and versioning

The persisted AI analytics `1.0` contract is the deployed structural baseline.
It guarantees the contract version, round identity, privacy state, eight
canonical dimensions, and the basic Stone Map shape. It does not guarantee
content quality or question-level grounding.

The requirements below describe the next, explicitly versioned contract. They
are intentionally not presented as compatible `1.0` behavior: requiring 24
question aggregates and stricter output validation changes what producers and
consumers must send and accept. The shared contract owner must select and
publish the next version before runtime implementation is integrated.

## Canonical and privacy-safe input

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

## Question-level metrics

Each Stone MUST contain exactly the three canonical question metrics belonging
to that dimension. A metric MUST identify the canonical question and expose
its Hebrew text, numeric aggregate score, and aggregate response count. The UI
may format those numeric facts for display.

The current generic `score / status / risk` triplet is not a question-level
metric set and MUST be rejected. A Stone's dimension score and status MUST be
consistent with the Core aggregate and the configured thresholds: green
`>=75`, yellow `50-74`, and red `<50`.

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
