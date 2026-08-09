# Shalomut Map Source Of Truth

This project keeps the stable Dashboard taxonomy separate from configurable
round questionnaires and from demo result data.

> Deployed contract `6.0` is what Core produces; `3.0` introduced dynamic round
> questionnaires, `4.0` added the school background context and `5.0` added
> per-question score distributions, while `6.0` adds three-part summaries,
> qualitative question insights and five recommendations per stone. Immutable
> contract `2.0`
> continues to describe the exact default 24-question legacy exchange. The
> consumer-first boundary is described in
> `docs/dynamic-questionnaire-ai-contract.md`.
> An unset Core producer version still defaults to the rollback-safe `5.0`;
> Production explicitly selects `6.0` after the completed consumer-first
> rollout.

## Canonical Decisions

- The Google Form is the canonical default/legacy questionnaire source for v1:
  8 dimensions, 24 statements, and one shared green/yellow/red response scale.
  Those 24 questions are a template, not the mandatory runtime questionnaire.
- The Adobe XD file is a visual reference for the organic stone map and dashboard flow. It has 4 web artboards and was last modified on 2025-06-17.
- The eight wellbeing dimensions are the stable Dashboard output taxonomy.
  A round may use different product-domain question IDs, text, and counts, but
  every analyzed question must map to one of those dimensions.
- `SurveyRound.surveyDefinition` is the runtime source of truth for the exact
  questions shown and analyzed in that round. `src/lib/shalomut-source.ts`
  supplies the dimension/status model and default questionnaire template. The
  Dashboard's static presentation of those dimensions — labels, map geometry,
  colours — lives in `src/lib/dashboard/dimension-presentation.ts`, and
  everything about a round comes from the analysis as a `DashboardInsightsDto`.
  `src/lib/demo-data.ts` no longer exists; nothing renders fixture analysis.
- AI must consume the exact persisted round-question snapshot and its
  privacy-safe aggregates, then return the fixed eight-stone Dashboard output.
  It must not substitute canonical question text or silently ignore additional
  configured questions.
- Published AI contracts `1.0`–`6.0` keep their released semantics. Contract
  `3.0` introduced dynamic questions; later versions add capabilities without
  making the default 24-question template mandatory again. Any new
  incompatible exchange requires a new manifest and consumer-first rollout.
- A green dimension is a strength to preserve (`חוזקה לשימור`). Its action
  experience offers supporting or maintenance actions (`פעולות לשימור`), not
  improvement goals or remedial recommendations.

## Source Roles

| Source | Role |
| --- | --- |
| [Google Form: מפת שלומות](https://docs.google.com/forms/d/e/1FAIpQLSdoDKUwm_tcRD_mOp4_1t1Zn-3LFE-hOkiEx9Ejey91GuPelQ/viewform) | Default/legacy survey template: dimensions, 24 initial questions, required state, and response scale. |
| [Adobe XD: מפת השלומות](https://xd.adobe.com/view/29896c9d-096a-4259-88bb-1dfb621f1131-7cda/grid/) | Visual reference for map composition, stone shapes, detail screens, metric screens, and recommendations screens. |
| `הסבר מפורט: פלטורפמת מפת שלומות` (owner-held PDF) | MVP/product requirements: roles, organizations, rounds, anonymous survey, scoring, dashboard, permissions, privacy threshold, and future recommendations. |
| `Teachers' Wellbeing Map` by Sasha Klyachkina (owner-held PDF) | Research and strategy context: rationale, wellbeing definitions, pilot plan, theory of change, and success measures. |
| `מיזם ״מפת שלומות״` (owner-held PDF) | One-page initiative narrative: positioning, AI framing, partners, and founder context. |
| `שלומות לאירה` (owner-held PDF) | Workshop/storytelling deck: journey metaphor and the 8-dimension map narrative. |
| `המרחב האנושי דרכא` (owner-held PDF) | Hebrew workshop deck: burnout framing, wellbeing framing, 8 dimensions, scale language, and reflection prompts. |

## Current Code Map

- `src/lib/shalomut-source.ts`: canonical source metadata, response scale,
  scoring thresholds, status labels, eight dimensions, and the default 24-question template.
- `SurveyRound.surveyDefinition`: exact versioned questionnaire snapshot for a
  runtime round.
- `contracts/capabilities.json`: shared cross-runtime capability policy for
  versions `1.0`–`6.0`.
- `contracts/ai-analytics-v3.json`: dynamic-questionnaire foundation.
- `contracts/ai-analytics-v6.json`: currently deployed structured summary,
  narrative-metric and five-recommendation output boundary.
- `docs/ai-contract-version-matrix.md`: current producer/parser/callback status
  and rollback value.
- `src/lib/survey-definition-hash.ts`: deterministic hash of the exact enabled
  AI-visible question snapshot.
- `src/lib/dashboard/dashboard-insights.ts`: `DashboardInsightsDto`, the stable presentation contract the screens render; `ai-insights-view-model.ts` is the only translation from the versioned wire payload.
- `src/lib/dashboard/dimension-presentation.ts`: per-dimension labels, map geometry, concept colours and status surfaces.
- `PRODUCT.md`: product voice, users, principles, privacy posture, accessibility expectations, and brand personality.
- `docs/product-requirements-summary.md`: canonical summary of original product requirements documents, methodology, MVP definition, 8 wellbeing dimensions, and pilot roadmap.
- `design.md`: design tokens and implementation notes for the current Next.js demo.

## Round Field Ownership

Which screen owns which value, so the same fact is never edited in two places:

| Field | Owner | Notes |
| --- | --- | --- |
| `backgroundContext.audience` | Setup screen (`/setup`) | Stored as a code (`all-staff`, `teachers`, `administration`). |
| `surveyDefinition.audience` | Derived | Mirrors the setup selection through `resolveAudienceLabel`; read-only in the builder. |
| `privacyThreshold` / `surveyDefinition.minimumResponses` | Setup screen, editable in the builder | Same number in both places; the builder writes it back on save. |
| `Organization.totalStaffCount` | Organization record, edited on the setup screen | Drives the expected-response counter on `/round` and the home-page ratio. It is not part of `backgroundContext` and does not cross the MCP boundary, so the AI never sees it. |
| Remaining `backgroundContext` fields | Setup screen | Reach the AI prompt on contracts `4.0`, `5.0` and `6.0`, and never for a locked round. |
| `surveyDefinition.questions` | Survey builder | Frozen after the first accepted response. |

## AI Analysis Triggering

- The automatic trigger fires at most once per round: on the submission that
  reaches the privacy threshold, and only while no result is persisted. Core
  commits an `AiAnalysisRun` with the stable `automatic` request key before the
  respondent request returns.
- PostgreSQL permits one `queued` or `running` run per round. The Python worker
  polls Core, atomically claims the oldest due run under an opaque 90-second
  lease, renews it by heartbeat, and may recover abandoned work up to three
  attempts. An expired owner cannot complete the run.
- The callback carries the run and lease identity. Completion is idempotent for
  the same result and rejects a superseded token or different retry payload.
  `AiAnalysisRun.result` is the durable read source; Core temporarily dual-reads
  and dual-writes `SurveyRound.aiInsights` for rollback compatibility.
- Refreshing an existing analysis is an explicit manager action
  (`רענון ניתוח` on `/round` → `POST /api/rounds/{roundId}/trigger-ai`), which
  enqueues a new run only after the previous one is terminal.
- API/UI run states are `queued`, `running`, `succeeded`, and `failed`; retry
  recovery also emits the `stalled` operational counter. Metrics are structured
  safe logs keyed only by round/run correlation, never respondent data.
- Resetting a round deletes its responses, every analysis run and the legacy
  persisted analysis, then records a `ROUND_RESET` audit event.

## Implementation Rules

- Preserve Hebrew RTL as the primary experience.
- Never expose respondent identity. Results stay locked below the configured
  privacy threshold. Ten respondents is both the default and the minimum a
  round may be configured with; a round persisted below it is read at ten rather
  than refused, and the manager screens name the gap explicitly — below five
  they say plainly that the published average describes individual respondents.
- Treat scoring thresholds as configurable source data. They live in
  `contracts/scoring-bands.json`, which Core reads through
  `src/lib/scoring-bands.ts` and the AI analytics service through
  `src/schemas/scoring_bands.py`. The shipped bands are green `>=75`, yellow
  `50-74`, red `<50`. Changing them is an edit to that one file plus a deploy of
  both services; they are deployment-wide rather than per round, because the
  service validates a payload's status against its score and per-round bands
  would be new contract semantics.
- Keep visual mock data distinct from persisted round questionnaires so pilot
  data can replace demo values without rewriting the Dashboard taxonomy.
- When changing dimension labels, scoring, or the default template, update
  `src/lib/shalomut-source.ts`. When changing a round's questions, persist and
  analyze its `surveyDefinition` snapshot instead of changing the global source.
