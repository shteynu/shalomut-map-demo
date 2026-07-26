# Shalomut Map — PROGRESS.md

Updated: 2026-07-26

## Current State
- Automated tests and build: `npm test` 168/168 passed, `npm run lint` 0 errors, `npm run build` (39 pages) successful.
- Python AI analytics: `python3 ai-analytics-service/run_tests.py` 13/13 passed.
- UI Loaders & Feedback: Added `Loader2` animated spinners and disabled states to all backend-driven actions (`/login`, `ManagerUserBar`, `RoundControls`, `SetupForm`, `SurveyBuilder`, `SurveyFlow`).
- AI Contract: Contract `4.0` (`contracts/ai-analytics-v4.json`) implemented with school `backgroundContext` and `generationProvenance`.
- P0 Auth: Default password (`manager123`) removed from deployed runtime, SHA-256 password hashing active, returns `503` when mandatory secrets are missing.
- Product UX: Setup CTA redirects to `/survey/`, active questions numbered sequentially, empty draft, clear questionnaire, load template, delete confirmation, Esc / validation / preview in `QuestionEditDialog`.

---

## Next Up

1. [ ] **Deployment is down — restore first**: set `SESSION_SECRET` and `MANAGER_ADMIN_PASSWORD` in Vercel (Production *and* Preview scope) and redeploy. Every route of `shalomut-map-demo.vercel.app`, including the public respondent route `/answer/...`, returns `500 MIDDLEWARE_INVOCATION_FAILED` with `[Error: SESSION_SECRET environment variable must be configured in production/deployed environment.]`.
2. [ ] Make the middleware resilient: `session-auth.ts` constructs `JwtSessionProvider` at module scope, so a missing manager secret takes down respondent routes that never needed it.
3. [ ] Enable `DISABLE_BASIC_AUTH_FALLBACK="true"` in Vercel only after items 1–2.
4. [ ] Staging E2E smoke test after the runtime is restored.
5. [ ] Optional cleanup: remove the unused `PP_BASE_URL` environment variable from Vercel.

---

## Completed Tasks

- [x] **2026-07-26**: **Consolidated to a single deployed environment** (explicit user approval): alias `shalomut-map-demo-ui-redesign.vercel.app` removed via `vercel alias rm` (URL now `404`; its preview deployment `dpl_FystEnZZ5rNPbJevXcNrfQmn83in` was not deleted and stays `READY`). The only product URL is `https://shalomut-map-demo.vercel.app/`, serving as staging for now; a separate production environment will be created later. `docs/openapi.yaml`, `public/openapi.json` and the environments section of `PROJECT_CONTEXT.md` updated accordingly. Verified with `openapi.test.ts` 5/5 and `vercel alias ls`.

- [x] **2026-07-26**: **UI Loading Indicators Added**: Added animated `Loader2` spinners and disabled states across all screens where backend API calls occur upon clicking buttons or forms (`/login`, `ManagerUserBar`, `RoundControls`, `SetupForm`, `SurveyBuilder`, `SurveyFlow`). Executed `npm test` (168/168 passed), `npm run lint` (0 errors), and `npm run build` (39/39 pages compiled).

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
