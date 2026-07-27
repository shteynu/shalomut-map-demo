# Shalomut Map — PROGRESS.md

Updated: 2026-07-26 (evening — completion plan executed locally, nothing deployed)

## Current State
- **Automated tests & build (this session, local)**: `npm test` 175/175 passed, `npm run lint` 0 errors,
  `npm run build` compiled successfully (39/39 pages), `python3 ai-analytics-service/run_tests.py` 14/14 passed.
- **Uncommitted work tree**: the completion plan of `docs/completion-plan-2026-07-26-evening.md` is implemented
  locally (46 modified files + `src/lib/audience.ts`, `src/lib/server/manager-audit.ts`, the plan document and an
  unapplied Prisma migration). Nothing is committed, pushed or deployed yet.
- **Deployed runtime**: `https://shalomut-map-demo.vercel.app/` still serves the previously deployed commit; none of
  the changes below are live.
- **Secrets configured in Vercel**: `SESSION_SECRET`, `MANAGER_ADMIN_PASSWORD` set for Production and Preview targets.
- **P0 Auth & Popup Sunset**: HTTP Basic Auth challenge popup (`WWW-Authenticate`) completely removed. Unauthenticated
  manager UI requests redirect to `/login` (HTTP 307); API requests return 401 JSON. The dead basic-auth code has now
  been deleted as well (`src/lib/server/basic-auth.ts` only classifies routes).
- **Single deployed environment**: `https://shalomut-map-demo.vercel.app/` is the only product URL (staging for now).

---

## Next Up (all blocked on owner approval or owner-side access)

1. [ ] Commit, push and deploy the current work tree (approval gate: deployment).
2. [ ] Apply `prisma/migrations/20260726210000_privacy_threshold_default_one` (approval gate: environment, target and
       rollback/PITR path must be confirmed first). Until then the DB column default stays `10`; the application layer
       already writes `1`, so behaviour is correct, only the column default is stale.
3. [ ] Flip `AI_ANALYTICS_CONTRACT_VERSION=4.0` **after** the Render deployment is verified to accept contract 4.0
       (consumer-first rollout; Core stays on `3.0` until then).
4. [ ] Staging database read evidence and evidence that Render runs the school-context code (owner-side access).
5. [ ] Optional cleanup: remove the unused `PP_BASE_URL` environment variable, delete the 6 stale origin branches, fix
       `MANAGER_ORGANIZATION_ID`.
6. [ ] AI-generated proposed question flow (slice 3.1, on explicit user request).

---

## Completed Tasks

- [x] **2026-07-26 (evening, local only)**: **Completion plan `docs/completion-plan-2026-07-26-evening.md` executed**:
  - **A1 — auto-trigger survives the response**: `POST /api/survey/[shareCode]/submit` schedules the dispatch with
    `after()` from `next/server` instead of a detached promise (with a try/catch fallback for non-request contexts).
  - **A2 — privacy threshold default 1 everywhere**: `DEFAULT_PRIVACY_THRESHOLD = 1`, `MINIMUM_PRIVACY_THRESHOLD = 1`,
    `prisma/schema.prisma` `@default(1)` plus an unapplied migration. Both manager screens warn explicitly below 5
    (`LOW_PRIVACY_THRESHOLD_WARNING`), because such an average describes individual respondents.
  - **A3 — one run per round + manual rerun**: `claimAiAnalysisRun` / `releaseAiAnalysisClaim` (a 2-minute lease on
    `aiInsightsUpdatedAt`, implemented as a conditional `updateMany`) make concurrent submissions dispatch a single
    webhook; `POST /api/rounds/{roundId}/trigger-ai` answers `409 already_running` while a run is in flight, and
    `/round` got an explicit `רענון ניתוח` button.
  - **B1/B4 — builder**: question cards freeze after the first response (all actions disabled, ids/texts read-only,
    Hebrew freeze notice); a new round starts as an empty draft and is promoted to `active` on save once the
    questionnaire covers all eight dimensions.
  - **B2/B3 — dialog**: full Tab/Shift+Tab focus trap, Escape close, focus restore to the trigger, backdrop close, and
    design-system markup (`question-dialog-*`).
  - **C1 — contract 4.0 consumer-first**: `AI_ANALYTICS_CONTRACT_VERSION` selects the produced version (`3.0` default);
    the school `backgroundContext` reaches the MCP payload and the Python prompt only on `4.0` and never for a locked
    round.
  - **C2/C3/C4**: audience is owned by `/setup` and mirrored read-only into the questionnaire (`src/lib/audience.ts`);
    round reset records a `ROUND_RESET` audit event and clears the persisted analysis; the dead HTTP Basic Auth code
    was deleted and the OpenAPI spec now documents `managerSession` instead of `basicAuth`.
  - **Regression found and fixed during the browser smoke**: with the new empty-draft rounds every manager screen
    crashed (`Invalid round survey definition: Enabled survey questions must cover all eight dimensions`), because
    `AnalyticsService.calculateDynamicRoundAnalytics` parsed strictly. An unfinished questionnaire now returns a
    locked result instead of throwing (two new tests).
  - **Verification (local)**: `npm test` 175/175, `npm run lint` 0 errors, `npm run build` 39/39 pages,
    `python3 ai-analytics-service/run_tests.py` 14/14, `openapi.test.ts` 5/5, plus a browser smoke on a dev server with
    in-memory repositories: empty draft builder → template load → save auto-activates the round → respondent submission
    dispatched exactly one `round_closed` webhook to a local listener (`after()` proven in a real runtime) → two further
    submissions and a manual rerun click produced **no** second webhook and a `409 already_running` note → freeze state,
    dialog focus trap (Tab wraps, Shift+Tab wraps back, Escape restores focus) → reset logged
    `{"audit":"ROUND_RESET",...,"deletedResponseCount":3}` and disabled the refresh button below the threshold.
  - **Not done (owner gates)**: nothing committed, pushed, deployed or migrated; `AI_ANALYTICS_CONTRACT_VERSION` still
    `3.0`.
  - **Follow-up on explicit user instruction**: the threshold `1` was afterwards propagated to *every* layer,
    including the Python fallbacks (`src/config.py` now reads `PRIVACY_THRESHOLD`, default `1`;
    `src/schemas/mcp_types.py`), `surveyInstrument.privacyThresholdDefault`, demo data, `PrivacyTooltip` and the
    OpenAPI / PROJECT_CONTEXT / ROADMAP descriptions. Accepted consequence: a payload without `privacyThreshold`
    no longer locks at 10 by default.

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

