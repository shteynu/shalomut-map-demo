# Product Roadmap - Shalomut Map (מפת שלומות)

This document details the overall product roadmap and architectural evolution of the Shalomut Map platform.

---

## 🟢 Phase 1: Design System, RTL & Accessibility (Completed)

- **Hebrew Font Stack**: Implemented `"Arial", "Noto Sans Hebrew", system-ui, sans-serif` with subpixel antialiasing.
- **Fluid Typography**: Responsive `clamp()` scaling for headings across desktop and mobile.
- **WCAG AA Compliance**: High-contrast text (`--ink: #383838`) across all organic wellbeing stones (Green, Yellow, Red, Periwinkle).
- **Interactive UI Components**: Stone map dashboard, survey flow, and survey builder.

---

## 🟢 Phase 2: Data Layer & Service Layer (Completed)

- [x] **Data Models & Blueprint**: ERD and service specification defined in `docs/data-layer-and-backend-plan.md`.
- [x] **Backend Domain Types**: Created TypeScript models (`src/lib/types/backend.ts`) for organizations, survey rounds, responses, and scores.
- [x] **AnalyticsService**: Implemented 8-dimension math aggregation, 100/60/0 scoring scale, and `privacyThreshold` anonymity locking (ten respondents — both the default and the minimum a round may be configured with).
- [x] **SurveyService**: Implemented submission validation for 24 canonical questions and anonymous response processing.
- [x] **RoundService**: Implemented survey round creation, share code generation (`SHALOM-XXXX`), and status transitions.
- [x] **Unit Testing**: 100% test coverage on backend services in `src/lib/services/__tests__/analytics.service.test.ts`.

---

## 🟢 Phase 3: Persistence & API Route Integration (Completed)

- [x] **Database & ORM Setup**: Prisma against PostgreSQL on Supabase, with migrations under `prisma/migrations/`.
- [x] **API Routes & Server Actions**: `/api/rounds`, `/api/survey/{shareCode}` and its `/submit`, `/api/rounds/{roundId}/analytics`, `/api/manager/setup` and the survey-definition routes. All of them are described in `docs/openapi.yaml` and `public/openapi.json`.
- [x] **UI Integration**: The dashboard, the survey flow and the questionnaire builder read and write persisted rounds. `demo-data.ts` still supplies the presentation side of the eight dimensions — labels, surfaces, status words and the shared types — but none of the numbers.

---

## 🟡 Phase 4a: AI Analysis (Built; latest slices await deployment)

A second service rather than a feature of the first: a Python FastAPI analytics
service on Render, reached by webhook, reading the round back over MCP and
answering on a result callback. Details in `docs/ai-analytics-handoff.md`; the
current state of the work is in `PROGRESS.md`, which is the document to read
before starting anything.

- [x] **Recommendations Engine**: A local intervention catalog selected by score distribution, then rewritten per school by the model (contract `5.0`).
- [x] **Versioned analytics contracts `1.0`–`5.0`**, immutable below `5.0`, with a partial map when a dimension cannot be written.
- [x] **Fail-closed generation**: a dimension the model never wrote is declared, never substituted. The one exception is a green dimension's aggregate-grounded sentence, which is labelled as its own.
- [x] **AI-suggested questionnaire items**: a suggestion names its source and cannot join the questionnaire unedited. Built and locally verified; deploy Python before Core.

---

## 🟡 Phase 4b: What the instrument is for (Next Up)

- [ ] **Comparative Multi-Round Analytics**: Track wellbeing progress over time across school semesters. This is the largest unbuilt thing and the point of a repeated instrument: today every round is an island, and "ודאות is worse than last time" — the reading a principal runs a second round to get — cannot be produced at all.
- [ ] **Nx Monorepo Migration**: If splitting into distinct apps (`apps/survey`, `apps/admin`, `apps/mobile`), migrate to an Nx Workspace.
