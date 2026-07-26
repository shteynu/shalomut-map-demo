# Shalomut Map — PROGRESS.md

Updated: 2026-07-26 (Session close)

## Current State
- **Automated tests & build**: `npm test` 168/168 passed, `npm run lint` 0 errors, `npm run build` (39 pages) successful.
- **Python AI analytics**: `python3 ai-analytics-service/run_tests.py` 13/13 passed.
- **Deployed runtime IS UP**: `https://shalomut-map-demo.vercel.app/` restored and live (`GET /login/` -> `200 OK`).
- **Secrets configured in Vercel**: `SESSION_SECRET`, `MANAGER_ADMIN_PASSWORD`, `DISABLE_BASIC_AUTH_FALLBACK="true"` set for Production and Preview targets.
- **P0 Auth & Popup Sunset**: HTTP Basic Auth challenge popup (`WWW-Authenticate`) completely removed. Unauthenticated manager UI requests redirect to `/login` (HTTP 307); API requests return 401 JSON.
- **UX & Builder Fixes**: Questionnaire freeze after first response wired (`isFrozen`), draft questionnaire saving allowed with incomplete dimensions (`isSaveable`), auto-focus and focus return added to `QuestionEditDialog`.
- **Single deployed environment**: `https://shalomut-map-demo.vercel.app/` is the only product URL (staging for now).

---

## Next Up

1. [ ] Staging database read evidence & end-to-end smoke test (slice 2.4).
2. [ ] Consolidate audience fields between `backgroundContext` and survey definition (slice 2.3).
3. [ ] Contract 4.0 Core analytics service invocation & Render verification (slice 2.2 follow-up).
4. [ ] AI-generated proposed question flow (slice 3.1, on explicit user request).
5. [ ] Optional cleanup: remove the unused `PP_BASE_URL` environment variable from Vercel.

---

## Completed Tasks

- [x] **2026-07-26**: **Global Privacy Threshold Floor 1 & Automatic AI Analytics Triggering**:
  - Set default & minimum allowed `privacyThreshold` to `1` across Core, setup forms, survey definitions, Python service docstrings, and `.agents/skills/shalomut-map/SKILL.md`.
  - Implemented automatic non-blocking AI analytics trigger in `POST /api/survey/[shareCode]/submit`: when survey response submission causes response count to reach or exceed `privacyThreshold` (for threshold = 1, on the 1st response), AI generation is automatically dispatched.
  - Added reusable server utility `src/lib/server/trigger-ai-analytics.ts` and automated integration test `submit-auto-trigger.test.ts`.
  - Full verification: `npm test` 169/169 passed, `python3 ai-analytics-service/run_tests.py` 13/13 passed.

- [x] **2026-07-26**: **Privacy Threshold Floor Lowered to 1**:
  - Lowered minimum allowed privacy threshold (`minimumResponses` / `privacyThreshold`) from 10 to 1 across `survey-definition.ts`, manager setup API (`route.ts`), `SetupForm`, `SurveyBuilderSettings`, and `survey-definition.test.ts`.
  - Full verification executed: `npm test` 168/168 passed, `npm run lint` 0 errors, `npm run build` 39/39 pages compiled.

- [x] **2026-07-26**: **Session Close — P0 Deployment Recovery & Basic Auth Sunset**:
  - **P0 Lazy Session Provider**: `JwtSessionProvider` instantiated lazily in `session-auth.ts` and `login/route.ts` so module loading never throws when manager secrets are absent. Respondent and machine routes operate without manager secrets.
  - **Vercel Secrets & Redeploy**: Configured `SESSION_SECRET` and `MANAGER_ADMIN_PASSWORD` in Vercel for Production & Preview. Deployed build `334db68` -> **Ready**. Tested live `GET /login/` (`200 OK`).
  - **HTTP Basic Auth Popup Sunset**: Completely removed `WWW-Authenticate: Basic ...` popup challenge header from `middleware.ts`. Set `DISABLE_BASIC_AUTH_FALLBACK="true"` in Vercel. Unauthenticated manager UI requests redirect to `/login` (307); API routes return 401 JSON. Removed dev credentials hint footer from `/login`.
  - **Builder Freeze & Draft Persistence**: Wired `isFrozen` in `SurveyBuilder` & `page.tsx`. Added `allowIncomplete: true` option in `parseSurveyDefinition` and `isSaveable` in `BuilderQuestionnaireValidation` to allow saving draft questionnaires before all 8 dimensions are populated.
  - **Dialog Focus & Accessibility**: Auto-focus on `textarea` and focus return on close in `QuestionEditDialog`.
  - **Full Verification**: `npm test` (168/168), `npm run lint` (0 errors), `npm run build` (39/39 pages), `python3 ai-analytics-service/run_tests.py` (13/13), live HTTP probes on `/login/` (200) and `/setup/` (307).

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

