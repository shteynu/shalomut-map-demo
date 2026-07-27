# Shalomut Map Source Of Truth

This project keeps the stable Dashboard taxonomy separate from configurable
round questionnaires and from demo result data.

> Deployed contract `3.0` implements dynamic round questionnaires while
> immutable contract `2.0` continues to describe the exact default 24-question
> legacy exchange. The consumer-first boundary is described in
> `docs/dynamic-questionnaire-ai-contract.md`.

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
  supplies the dimension/status model and default questionnaire template;
  demo scores, mock school data, summaries, metrics, and recommendations may
  remain in `src/lib/demo-data.ts`.
- AI must consume the exact persisted round-question snapshot and its
  privacy-safe aggregates, then return the fixed eight-stone Dashboard output.
  It must not substitute canonical question text or silently ignore additional
  configured questions.
- Existing AI contracts `1.0` and `2.0` remain immutable. Breaking contract
  `3.0` removes the exact 24-question restriction while preserving the fixed
  eight-stone output and requires a consumer-first rollout.
- A green dimension is a strength to preserve (`חוזקה לשימור`). Its action
  experience offers supporting or maintenance actions (`פעולות לשימור`), not
  improvement goals or remedial recommendations.

## Source Roles

| Source | Role |
| --- | --- |
| [Google Form: מפת שלומות](https://docs.google.com/forms/d/e/1FAIpQLSdoDKUwm_tcRD_mOp4_1t1Zn-3LFE-hOkiEx9Ejey91GuPelQ/viewform) | Default/legacy survey template: dimensions, 24 initial questions, required state, and response scale. |
| [Adobe XD: מפת השלומות](https://xd.adobe.com/view/29896c9d-096a-4259-88bb-1dfb621f1131-7cda/grid/) | Visual reference for map composition, stone shapes, detail screens, metric screens, and recommendations screens. |
| `/Users/maxim.berenshtein/Downloads/הסבר מפורט_ פלטורפמת מפת שלומות.pdf` | MVP/product requirements: roles, organizations, rounds, anonymous survey, scoring, dashboard, permissions, privacy threshold, and future recommendations. |
| `/Users/maxim.berenshtein/Downloads/Sasha Klyachkina_ Teachers' Wellbeing Map.pdf` | Research and strategy context: rationale, wellbeing definitions, pilot plan, theory of change, and success measures. |
| `/Users/maxim.berenshtein/Downloads/מיזם ״מפת שלומות״ (3).pdf` | One-page initiative narrative: positioning, AI framing, partners, and founder context. |
| `/Users/maxim.berenshtein/Downloads/שלומות לאירה.pdf` | Workshop/storytelling deck: journey metaphor and the 8-dimension map narrative. |
| `/Users/maxim.berenshtein/Downloads/המרחב האנושי דרכא (2).pdf` | Hebrew workshop deck: burnout framing, wellbeing framing, 8 dimensions, scale language, and reflection prompts. |

## Current Code Map

- `src/lib/shalomut-source.ts`: canonical source metadata, response scale,
  scoring thresholds, status labels, eight dimensions, and the default 24-question template.
- `SurveyRound.surveyDefinition`: exact versioned questionnaire snapshot for a
  runtime round.
- `contracts/ai-analytics-v3.json`: deployed breaking dynamic-questionnaire AI
  boundary.
- `src/lib/survey-definition-hash.ts`: deterministic hash of the exact enabled
  AI-visible question snapshot.
- `src/lib/demo-data.ts`: demo organization, active round, mock dashboard scores, map positions, metrics, recommendations, and compatibility exports for existing components.
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
| `backgroundContext.totalStaffCount` | Organization record | Drives the expected-response counter on `/round`. |
| Remaining `backgroundContext` fields | Setup screen | Reach the AI prompt on contract `4.0` only, and never for a locked round. |
| `surveyDefinition.questions` | Survey builder | Frozen after the first accepted response. |

## AI Analysis Triggering

- The automatic trigger fires at most once per round: on the submission that
  reaches the privacy threshold, and only while no result is persisted.
- A repository claim (`claimAiAnalysisRun`) makes concurrent submissions
  dispatch a single webhook. The claim is a two-minute lease and is released
  when the dispatch fails.
- Refreshing an existing analysis is an explicit manager action
  (`רענון ניתוח` on `/round` → `POST /api/rounds/{roundId}/trigger-ai`).
- Resetting a round deletes its responses, drops the persisted analysis and
  records a `ROUND_RESET` audit event.

## Implementation Rules

- Preserve Hebrew RTL as the primary experience.
- Never expose respondent identity. Results stay locked below the configured
  privacy threshold. The threshold is configurable with a product default of 1;
  values below 5 make the published average describe individual respondents, so
  the manager screens warn about it explicitly.
- Treat scoring thresholds as configurable source data: green `>=75`, yellow `50-74`, red `<50`.
- Keep visual mock data distinct from persisted round questionnaires so pilot
  data can replace demo values without rewriting the Dashboard taxonomy.
- When changing dimension labels, scoring, or the default template, update
  `src/lib/shalomut-source.ts`. When changing a round's questions, persist and
  analyze its `surveyDefinition` snapshot instead of changing the global source.
