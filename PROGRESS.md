# Shalomut Map — PROGRESS.md

Updated: 2026-07-26

## Current State
- Automated tests and build: `npm test` 166/166 passed, `npm run lint` 0 errors, `npm run build` (39 pages) successful.
- Python AI analytics: `python3 ai-analytics-service/run_tests.py` 13/13 passed.
- AI Contract: Contract `4.0` (`contracts/ai-analytics-v4.json`) implemented with school `backgroundContext` and `generationProvenance`.
- P0 Auth: Default password (`manager123`) removed from deployed runtime, SHA-256 password hashing active, returns `503` when mandatory secrets are missing.
- Product UX: Setup CTA redirects to `/survey/`, active questions numbered sequentially, empty draft, clear questionnaire, load template, delete confirmation, Esc / validation / preview in `QuestionEditDialog`.

---

## Next Up

1. [ ] Enable `DISABLE_BASIC_AUTH_FALLBACK="true"` in Vercel Preview/Production after setting `SESSION_SECRET` and `MANAGER_ADMIN_PASSWORD` in Vercel Dashboard.
2. [ ] Staging E2E smoke test and alias alignment upon explicit user approval.

---

## Completed Tasks

- [x] **2026-07-26**: **6 Sequential Quality & Security Blocks Completed (P0 Auth, Lint/Build, AI Contract 4.0, UX & OpenAPI)**:
  - **P0 Auth Hardening**: `ManagerAuthenticationService` uses SHA-256 password hashing. Default `manager123` fallback account prohibited in deployed runtime. Returns HTTP status `503` (UNCONFIGURED) if mandatory secrets `SESSION_SECRET` or `MANAGER_ADMIN_PASSWORD` are absent in deployed runtime.
  - **Lint & Build Recovery**: Added `deleteMany` to `MinimalPrismaClient` contract. Removed synchronous `setState` in `useEffect` in `QuestionEditDialog`. `npm run lint` and `npm run build` pass with 0 errors.
  - **AI Context & Contract 4.0**: Added `contracts/ai-analytics-v4.json`. Passed school `backgroundContext` via Python parser, workflow, and `llm_provider`. Fixed `NameError` in `llm_provider.py`. Added `backgroundContextIncluded` flag in `generationProvenance`. Added unit tests in `ai-contract-v4.test.ts`.
  - **Product UX & Builder Improvements**: Setup form CTA redirects to `/survey/`. Survey builder numbers active (enabled) questions sequentially; hidden questions displayed without number (`-`). Implemented empty draft, clear questionnaire, load template, delete confirmation, and freeze state when responses exist. `QuestionEditDialog` updated with Esc key close, inline validation, and respondent preview.
  - **API & OpenAPI Sync**: Added `POST /api/rounds/{roundId}/reset` endpoint to `docs/openapi.yaml` and `public/openapi.json`. Synchronized `openapi.test.ts` integration tests.
  - **Full Verification**: Executed `npm test` (166/166), `npm run lint`, `npm run build`, `python3 ai-analytics-service/run_tests.py` (13/13), `openapi.test.ts` (5/5).

- [x] **2026-07-26**: **GitHub Pages retired, Vercel established as single web deploy target**:
  - `DELETE /repos/shteynu/shalomut-map-demo/pages` -> `204`, `has_pages: false`.

- [x] **2026-07-26**: **Manager UI auth & Basic Auth sunset preparation**:
  - Auth API routes `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
  - `/login` page and `ManagerUserBar`.
