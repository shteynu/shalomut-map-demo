# Shalomut Map Source Of Truth

This project uses a small canonical source layer for the survey instrument and keeps demo result data separate from methodology.

## Canonical Decisions

- The Google Form is the canonical questionnaire source for v1: 8 dimensions, 24 required statements, and one shared green/yellow/red response scale.
- The Adobe XD file is a visual reference for the organic stone map and dashboard flow. It has 4 web artboards and was last modified on 2025-06-17.
- If sources disagree, keep the 8-dimension questionnaire model unless the product owner explicitly decides to version a different instrument.
- Runtime code should import survey methodology from `src/lib/shalomut-source.ts`; demo scores, mock school data, summaries, metrics, and recommendations may remain in `src/lib/demo-data.ts`.
- A green dimension is a strength to preserve (`חוזקה לשימור`). Its action
  experience offers supporting or maintenance actions (`פעולות לשימור`), not
  improvement goals or remedial recommendations.

## Source Roles

| Source | Role |
| --- | --- |
| [Google Form: מפת שלומות](https://docs.google.com/forms/d/e/1FAIpQLSdoDKUwm_tcRD_mOp4_1t1Zn-3LFE-hOkiEx9Ejey91GuPelQ/viewform) | Canonical survey instrument: dimensions, questions, required state, and response scale. |
| [Adobe XD: מפת השלומות](https://xd.adobe.com/view/29896c9d-096a-4259-88bb-1dfb621f1131-7cda/grid/) | Visual reference for map composition, stone shapes, detail screens, metric screens, and recommendations screens. |
| `/Users/maxim.berenshtein/Downloads/הסבר מפורט_ פלטורפמת מפת שלומות.pdf` | MVP/product requirements: roles, organizations, rounds, anonymous survey, scoring, dashboard, permissions, privacy threshold, and future recommendations. |
| `/Users/maxim.berenshtein/Downloads/Sasha Klyachkina_ Teachers' Wellbeing Map.pdf` | Research and strategy context: rationale, wellbeing definitions, pilot plan, theory of change, and success measures. |
| `/Users/maxim.berenshtein/Downloads/מיזם ״מפת שלומות״ (3).pdf` | One-page initiative narrative: positioning, AI framing, partners, and founder context. |
| `/Users/maxim.berenshtein/Downloads/שלומות לאירה.pdf` | Workshop/storytelling deck: journey metaphor and the 8-dimension map narrative. |
| `/Users/maxim.berenshtein/Downloads/המרחב האנושי דרכא (2).pdf` | Hebrew workshop deck: burnout framing, wellbeing framing, 8 dimensions, scale language, and reflection prompts. |

## Current Code Map

- `src/lib/shalomut-source.ts`: canonical source metadata, response scale, scoring thresholds, status labels, dimensions, and 24 survey questions.
- `src/lib/demo-data.ts`: demo organization, active round, mock dashboard scores, map positions, metrics, recommendations, and compatibility exports for existing components.
- `PRODUCT.md`: product voice, users, principles, privacy posture, accessibility expectations, and brand personality.
- `design.md`: design tokens and implementation notes for the current Next.js demo.

## Implementation Rules

- Preserve Hebrew RTL as the primary experience.
- Never expose respondent identity. Results stay locked below the privacy threshold, defaulting to 10 respondents.
- Treat scoring thresholds as configurable source data: green `>=75`, yellow `50-74`, red `<50`.
- Keep visual mock data distinct from the survey instrument so future pilot data can replace demo values without rewriting methodology.
- When changing questions or dimension labels, update `src/lib/shalomut-source.ts` first and let compatibility exports flow from there.
