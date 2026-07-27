# Shalomut Map — PROGRESS.md

Updated: 2026-07-27 (deployed, migrated, contract 4.0 enabled, manager organization scope mandatory)

## Current State
- **Automated tests & build**: `npm test` 180/180 passed, `npm run lint` 0 errors, `npm run build` 39/39 pages
  (all three re-run on 2026-07-27 after the organization-scope change); `python3 ai-analytics-service/run_tests.py`
  16/16 passed and `pytest ai-analytics-service/tests` 88 passed earlier the same day, Python code unchanged since.
- **Deployed runtime**: `https://shalomut-map-demo.vercel.app/` serves the current `main`
  (`GET /login/` → 200, `GET /api/rounds/` → 401 JSON). Commits `9e15732`, `1f76622`, `82c17f2` are pushed.
- **Database**: the staging Supabase DB is migrated up to date — `20260724180000_add_round_configuration`
  (previously missing, so the deployed app could not persist a questionnaire at all) and
  `20260726210000_privacy_threshold_default_one` were applied on 2026-07-27; `privacy_threshold` default is now `1`.
- **AI contract 4.0 is live**: Render runs commit `82c17f2` and reports
  `supportedContractVersions ["1.0","2.0","3.0","4.0"]` on `/health`; only then was
  `AI_ANALYTICS_CONTRACT_VERSION=4.0` set in Vercel and the app redeployed.
- **Privacy threshold**: product default and minimum are `1` in every layer, including the Python fallback and the
  database column default. Both manager screens warn that a threshold below 5 describes individual respondents.
- **Vercel environment**: `PP_BASE_URL`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD` and
  `DISABLE_BASIC_AUTH_FALLBACK` removed; `MANAGER_ORGANIZATION_ID` now points at the existing organization
  `be9f184a-dee8-4d72-9805-c0f4e45f6d40` and is mandatory on a deployed runtime — without it
  `POST /api/auth/login` answers `503 UNCONFIGURED` instead of issuing a session.
- **Repository**: the six stale origin branches were deleted (tips recorded in the tracker handoff for restore).
- **Single deployed environment**: `https://shalomut-map-demo.vercel.app/` is the only product URL (staging for now).

---

## Next Up

1. [ ] Sign in as a manager on the deployed app once (needs the admin password, so the owner has to do it) and
       confirm the session lands on organization `be9f184a-…` with the round visible. The read-only smoke is
       already green — see the completed entry below.
2. [ ] End-to-end check on the deployed app (needs a manager login, so the owner has to run it): create a round,
       submit a response, confirm the persisted AI result carries `contractVersion: "4.0"` and
       `generationProvenance.backgroundContextIncluded: true`.
3. [ ] AI-generated proposed question flow (slice 3.1, on explicit user request).

---

## Completed Tasks

- [x] **2026-07-27**: **`MANAGER_ORGANIZATION_ID` is mandatory on a deployed runtime**
  ([`manager-auth-service.ts`](src/lib/auth/manager-auth-service.ts)):
  - Deleted the hardcoded fallback `34d05e66-…`, which pointed at an organization removed during an earlier staging
    cleanup. With the variable missing, a manager used to receive a session scoped to a non-existent organization and
    every screen looked empty instead of failing.
  - `resolveManagerOrganizationId()` returns the configured value, `null` on a deployed runtime without it, and
    `"local-dev-organization"` outside a deployed runtime. `isUnconfigured()` now covers it alongside `SESSION_SECRET`
    and `MANAGER_ADMIN_PASSWORD`, so `POST /api/auth/login` answers `503 UNCONFIGURED` even for correct credentials;
    `defaultAccounts()` is fail-closed on the same condition. The production build phase keeps the local fallback.
  - The three demo memberships were module-level constants frozen at import time and are now built per call from the
    resolved organization, which is what makes the variable readable at runtime.
  - Four new tests in [`manager-auth-service.test.ts`](src/lib/auth/__tests__/manager-auth-service.test.ts) cover the
    missing/blank variable (including `VERCEL_ENV=preview`), the trimmed configured value, the local-only fallback
    with a regression guard on the retired UUID, `UNCONFIGURED` when only the organization is missing, and the
    organization a deployed session is scoped to. Confirmed fail-first: the missing-variable case passes login on the
    previous code.
  - Verified locally: `npm test` 180/180, `npm run lint` 0 errors, `npm run build` 39/39 pages. Pushed to `main` as
    `f9b1c50` on 2026-07-27 at the owner's explicit request; Vercel builds every push to `main` automatically.
  - Deployed and smoke-tested: production deployment `shalomut-map-demo-o3os80zm4` is `● Ready` (39s) and carries
    the `shalomut-map-demo.vercel.app` alias. `GET /login/` → 200, `GET /api/rounds/` → 401 JSON, and
    `POST /api/auth/login/` with a deliberately wrong password → `401 INVALID_CREDENTIALS` — not
    `503 UNCONFIGURED`, which proves all three mandatory variables are present in the deployed environment.
  - Residual risk: sessions issued before this change stay valid up to 24h with the stale organization; the gate
    covers new logins only.

- [x] **2026-07-27**: **Deployment, migrations and the contract 4.0 rollout** (explicit user approval):
  - Pushed `9e15732` to `main`; Vercel built production deployment `dpl_EerCv593tZyLTE9kU2SVTAxY4eKX` (Ready, aliased).
  - `npx prisma migrate deploy` on the staging Supabase DB applied the two pending migrations. The DB was missing
    `survey_rounds.background_context` and `survey_rounds.survey_definition` entirely, so the deployed app could not
    save a round. At migration time: 1 organization, 0 rounds, 0 responses. Verified afterwards: both columns present,
    `privacy_threshold` default `1`, both rows in `_prisma_migrations`.
  - Fixed three defects found while preparing the 4.0 flip (`1f76622`): the dynamic parser ignored `4.0`, it rejected
    `privacyThreshold` below 10 (breaking contract 3.0 in production, since Core's default is now 1), and it dropped
    `backgroundContext`. Added Python tests 15 and 16, which fail on the previous code.
  - Added the running commit and accepted contract versions to the Python `/health` (`82c17f2`) so a consumer-first
    rollout can be proven from outside. Render redeployed and answered
    `{"commit":"82c17f2","supportedContractVersions":["1.0","2.0","3.0","4.0"]}`; only then was
    `AI_ANALYTICS_CONTRACT_VERSION=4.0` set in Vercel and the app redeployed.
  - Vercel env cleanup and `MANAGER_ORGANIZATION_ID` correction; six stale origin branches deleted with their tips
    recorded in `docs/shalomut-tracker-handoff.md`.

- [x] **2026-07-26 (evening)**: **Completion plan `docs/completion-plan-2026-07-26-evening.md` executed**:
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

