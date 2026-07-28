# Product Roadmap - Shalomut Map (מפת שלומות)

This document details the overall product roadmap and architectural evolution of the Shalomut Map platform.

---

## 🟢 Phase 1: Design System, RTL & Accessibility (Completed)

- **Hebrew Font Stack**: Implemented `"Arial", "Noto Sans Hebrew", system-ui, sans-serif` with subpixel antialiasing.
- **Fluid Typography**: Responsive `clamp()` scaling for headings across desktop and mobile.
- **WCAG AA Compliance**: High-contrast text (`--ink: #383838`) across all organic wellbeing stones (Green, Yellow, Red, Periwinkle).
- **Interactive UI Components**: Stone map dashboard, survey flow, and survey builder.

---

## 🔵 Phase 2: Data Layer & Service Layer (Current - In Progress)

- [x] **Data Models & Blueprint**: ERD and service specification defined in `docs/data-layer-and-backend-plan.md`.
- [x] **Backend Domain Types**: Created TypeScript models (`src/lib/types/backend.ts`) for organizations, survey rounds, responses, and scores.
- [x] **AnalyticsService**: Implemented 8-dimension math aggregation, 100/60/0 scoring scale, and `privacyThreshold` anonymity locking (ten respondents — both the default and the minimum a round may be configured with).
- [x] **SurveyService**: Implemented submission validation for 24 canonical questions and anonymous response processing.
- [x] **RoundService**: Implemented survey round creation, share code generation (`SHALOM-XXXX`), and status transitions.
- [x] **Unit Testing**: 100% test coverage on backend services in `src/lib/services/__tests__/analytics.service.test.ts`.

---

## 🟡 Phase 3: Persistence & API Route Integration (Next Up)

- [ ] **Database & ORM Setup**: Select and configure Prisma ORM / PostgreSQL / Supabase for persistent data storage.
- [ ] **API Routes & Server Actions**: Expose `/api/survey/submit`, `/api/rounds/[roundId]/analytics`, and `/api/rounds`.
- [ ] **UI Integration**: Connect React components (`dashboard-map-interactive.tsx`, `survey-flow.tsx`) to live backend services.

---

## 🟣 Phase 4: Extended Features & Monorepo Scaling (Future)

- [ ] **Recommendations Engine**: Automated action recommendations for principals based on red/yellow dimensions.
- [ ] **Comparative Multi-Round Analytics**: Track wellbeing progress over time across school semesters.
- [ ] **Nx Monorepo Migration**: If splitting into distinct apps (`apps/survey`, `apps/admin`, `apps/mobile`), migrate to an Nx Workspace.
