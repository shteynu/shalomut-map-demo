# Shalomut Map Redesign Change Log

Date: 2026-07-03
Branch: `feature/ui-redesign`

> Историческая справка. Маршруты и деплой с тех пор изменились: респондентский
> флоу живёт на `/answer/<shareCode>` (упоминания `/survey/dror-q1` относятся к
> статическому demo), а статический GitHub Pages деплой снят с публикации
> 2026-07-26. Актуальное состояние — `docs/shalomut-tracker-handoff.md`.

## Scope

This document summarizes the redesign and product-flow changes made for the Shalomut Map demo. The work preserves the public route structure, Hebrew RTL experience, the privacy threshold of `10`, and the v1 survey model of `8` dimensions and `24` questions.

## Product And Source Model

- Added `PRODUCT.md` as the product voice and design-principle reference for the demo.
- Added `docs/source-of-truth.md` to document canonical sources, product constraints, and code ownership.
- Added `src/lib/shalomut-source.ts` as the canonical methodology layer for the survey instrument: response scale, thresholds, dimensions, and the 24-question model.
- Kept runtime demo scores, dashboard copy, metric samples, recommendations, organization data, and map positions in `src/lib/demo-data.ts`.

## Design System And Shared UI

- Reworked `src/app/globals.css` around the warm organic stone-map language: pastel surfaces, asymmetric radii, soft panel shadows, RTL-first layout, and mobile-safe spacing.
- Added shared visual primitives:
  - `ActionCard`
  - `StatStone`
  - `ScoreRing`
  - `DimensionIcon`
  - `PrivacyTooltip`
- Updated `design.md` with the current token vocabulary, status colors, pastel surfaces, typography, mobile guidance, and implementation notes.
- Added `src/app/icon.svg` for app metadata.

## Navigation And Routing

- Added `src/lib/navigation.ts` as the canonical route/action registry.
- Centralized route URLs, main navigation labels, home action metadata, dashboard detail actions, and common action labels.
- Updated the global header and route-aware header hiding through `HeaderGate`.
- Removed duplicated clickable workflow links from `/setup` and `/round` next-step bands; those bands are now informational, while the real workflow CTAs live in the relevant form/control surfaces.
- Kept dashboard as a fullscreen/headerless experience while preserving a clear return action to the main screen.

## Home Page

- Redesigned `/` as a working management hub rather than a generic landing page.
- Added organic stat stones for response progress, privacy threshold, treatment focus count, and strengths count.
- Replaced hard-coded workflow cards with route metadata from `src/lib/navigation.ts`.
- Kept primary actions for starting a diagnostic round and opening the map.

## Setup Flow

- Expanded `/setup` into a richer setup form with:
  - general round details
  - audience/background inputs
  - privacy mode and threshold explanation
  - contextual management tip
  - save state with follow-up action
- Preserved demo-only form behavior and privacy-first copy.

## Round Flow

- Reworked `/round` metric stones and sharing panel.
- Added a circular response-progress treatment and explicit anonymous-link controls.
- Kept copy/close/demo state behavior while aligning CTA labels to the shared navigation registry.

## Survey Builder

- Reworked `/survey` into a fuller builder surface:
  - basic survey settings
  - 8-dimension / 24-question summary
  - dimension filter tabs
  - editable question cards
  - demo question bank
  - external respondent link panel
  - response-scale legend
- Added a quiet builder flow strip for settings, questions, and distribution.
- Kept the survey model and required-question structure intact.

## Respondent Survey

- Reworked `/survey/dror-q1` into a focused mobile-friendly question flow.
- Added one-question-at-a-time progression, answer auto-advance, back/next controls, review step, progressbar semantics, and public-link completion copy.
- Preserved anonymous response positioning and the original response scale.

## Dashboard Suite

- Rebuilt dashboard around a headerless fullscreen map mode.
- Added an interactive organic map with draggable desktop stones, reset control, mobile tap guidance, and status-safe surfaces.
- Restored the dashboard's three soft status stone colors as the primary map identity.
- Added secondary dimension identity without changing the three-color map system: dimension icons, neutral stone numbers, and detail-page dimension chips.
- Added privacy locked-state copy for results below the threshold.
- Reworked dimension detail, metrics, and recommendations pages to share:
  - the same pastel surfaces
  - organic mobile shapes
  - consistent pill actions
  - shared dashboard action registry

## Lint And Build Fixes

- Rewrote share URL handling in `src/lib/use-share-url.ts` to avoid synchronous state updates in effects.
- Fixed `useBlobFit` dependency warnings by keying the effect with stable dependency strings.
- Normalized `next-env.d.ts` back to `.next/types/routes.d.ts` after dev/build runs.

## Verification

- `npm run lint`
- `npm run build`
- `$impeccable` detector returned no CSS/token findings for `src/app src/components`.
- Browser sanity checks covered:
  - `/`
  - `/setup`
  - `/round`
  - `/survey`
  - `/survey/dror-q1`
  - `/dashboard`
  - `/dashboard/social-resource`
  - `/dashboard/social-resource/metrics`
  - `/dashboard/social-resource/recommendations`
- Additional mobile checks used a `375x812` viewport.
