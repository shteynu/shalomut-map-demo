# PROGRESS: Shalomut Map

## 📌 Текущий статус
- **Текущий этап**: organization-scoped manager boundary находится в
  `origin/main`: `7a451fd` добавляет server-owned organization scope и
  round ownership, `508410a` сохраняет понятный пользователю fail-closed UI.
  Текущая локальная сессия начата от чистого `main@54c2eaa`.
- **Состояние БД**: отдельный Supabase staging project
  `shalomut-map-staging` (`tpfzhyalaftotljmlont`, `ap-northeast-2`) содержит
  ровно одну organization `34d05e66-fa4d-4a07-a2af-c9d5c41b6088` и один
  round `80e78f3e-1240-42d4-8a9e-23a3467bb650`. Это подтверждено read-only
  запросом; миграции, cleanup и другие data writes в финальной проверке не
  выполнялись.
- **Core app runtime**: production alias
  [shalomut-map-demo.vercel.app](https://shalomut-map-demo.vercel.app/) сейчас
  используется как operational staging endpoint и подключён к выделенной
  staging-БД. Первый проверенный post-env production deployment
  `dpl_Hb1WZR9hHdUKsWhJdXDXDMS8ExPe` получил состояние `READY` и прошёл
  manager-scope smoke. На момент alias verification docs-only deployment
  `dpl_9PrHZzeVrTWJ3YNzCbHKQtxr8Zdq` для `ace5ba8` имел состояние `READY`;
  session-close docs merge может создать более новый deployment ID.
- **Legacy staging alias**:
  [shalomut-map-demo-ui-redesign.vercel.app](https://shalomut-map-demo-ui-redesign.vercel.app/)
  после bounded approval указывает на protected Preview
  `dpl_FjVVtXibnMwWRXHHAaPEW5wgj3bR` (`READY`, source `91bb8d4`). Его Git tree
  идентичен application baseline `ace5ba8`; session-close docs не меняют
  runtime-содержимое. Unauthenticated запрос сохраняет `302` на Vercel SSO.
  Runtime smoke подтвердил тот же staging round и threshold `10`, read-only
  БД — `12` responses.
- **Последний Manager UI browser-smoke**: изолированный локальный Playwright
  открыл актуальный manager runtime на read-only staging persistence.
  После локального regression fix `/setup/`, `/`, `/round/`, `/survey/` и
  `/dashboard/` вернули HTTP `200`; setup показал безопасные defaults для
  legacy `backgroundContext: {note: ...}`. Staging data не менялись.
- **Dashboard content-quality blocker**: persisted AI payload формально валиден,
  но содержательно непригоден для rollout. Ни один из четырёх non-green
  insights не выполнил требование двух законченных предложений; все четыре
  green dimensions получили improvement recommendations; все `11`
  recommendations остались на английском; все восемь metric sets повторяют
  технический шаблон score/status/risk вместо агрегатов канонических вопросов.
  Следующий versioned semantic contract описан, а executable RED tests
  воспроизводят 10 TypeScript и 10 Python gaps. Runtime/Core/MCP contract ещё
  не изменён. Отдельный catalog slice уже удалил cross-status fallback,
  локализовал `11` записей и добавил `8` green-only «חוזקה לשימור» действий.
- **AI runtime**: FastAPI-сервис развёрнут на Render: [shalomut-ai-analytics.onrender.com](https://shalomut-ai-analytics.onrender.com), deployment `dep-d9ibutgk1i2s73b2oolg` для commit `a9b6c34` имеет статус `Live`; `/health` отвечает HTTP 200.
- **Real E2E**: для разрешённого round core trigger вернул `202`, MCP POST
  `/api/mcp/` — `200`, Render webhook — `200`, callback POST — `200`,
  сохранённый GET — `200`. Четыре non-green dimensions завершились как
  Gemini `outcome=llm` с первой попытки; retry и heuristic fallback не
  использовались. Persisted payload имеет `contractVersion: "1.0"`,
  `status: "success"`, `isLocked: false` и восемь canonical stones.
- **Изоляция AI persistence**: локальный исполняемый сценарий с тремя
  раундами — два одной школы и один другой — подтвердил, что повторная запись
  меняет `aiInsights` только выбранного `SurveyRound.id`. Результаты предыдущего
  раунда и другой школы сохранились. Это доказывает изоляцию хранения, но не
  application-level tenant authorization.
- **Остаточный runtime-риск**: provenance LLM/fallback пока фиксируется только
  в service logs, а не в versioned persisted payload. Real privacy-locked
  round после текущей смены provider/deploy не проверялся.
- **Защита и секреты**: три machine-to-machine secret совпадают; raw values не выводились и не коммитились. Старый preview URL и placeholder Vercel bypass удалены из фактической Render-конфигурации. Исходный Supabase ref `fvnulyirrqjrnjbahmsn` не изменялся.
- **Manager deployment gate**: `MANAGER_ORGANIZATION_ID` добавлен в Vercel как
  Sensitive variable для Preview и Production и указывает на единственную
  staging organization. То же значение хранится только в ignored
  `.env.staging.local`; production `.env` и `.env.local` не менялись.
  Deployed read-only smoke подтвердил anonymous `401`, authenticated `200`,
  правильные organization/round и игнорирование поддельного client scope.
- **Git-состояние**: baseline текущей сессии — `main@54c2eaa`. Изменения
  текущей сессии включают setup fix, semantic RED tests/contract, Hebrew
  intervention catalog и подтверждённые handoff updates; unrelated user
  changes не обнаружены.
- **AI coding workflow**: канонические repo-level skills `shalomut-map`, `shalomut-tracker` и `shalomut-verification` находятся в `.agents/skills/`; инструкции для Codex, Gemini, Claude и GitHub Copilot закоммичены в `main`.
- **Актуальный handoff**: см. [`docs/shalomut-tracker-handoff.md`](docs/shalomut-tracker-handoff.md). AI-детали: [`docs/ai-analytics-handoff.md`](docs/ai-analytics-handoff.md).

---

## 🚀 Следующие шаги (Next Up: Safe Staging)
1. [ ] Выбрать и опубликовать следующую версию AI analytics contract, затем
   сделать GREEN Core Data → MCP RED tests: 24 privacy-safe canonical question
   aggregates и пустые detailed maps ниже privacy threshold.
2. [ ] Сделать GREEN provider/output tests: `finish_reason`, Hebrew,
   completeness, status consistency и deterministic question-grounded fallback.
3. [ ] Заменить generic score/status/risk metrics реальными question-level
   metrics и показывать общий summary ровно один раз на dashboard overview.
4. [ ] Интегрировать подтверждённую green semantics «חוזקה לשימור» /
   `פעולות לשימור` в conditional dashboard UX; catalog boundary уже готов.
5. [ ] Заменить organization-scoped shared Basic gate на application-level
   manager identity/roles и полноценную tenant authorization; убрать hardcoded
   `organizationContext` из MCP payload.
6. [ ] Развести staging и production aliases/env окончательно; legacy staging
   alias уже выровнен по Git tree, но текущий production alias используется
   как staging endpoint и не должен считаться production-ready.

---

## ✅ Завершенные задачи (Completed)
- [x] **2026-07-25**: **Зафиксирован dashboard semantic RED и локализован
  intervention catalog**:
  - `docs/dashboard-semantic-contract.md` отделяет deployed structural `1.0`
    от следующей breaking/versioned boundary и фиксирует 24 privacy-safe
    question aggregates, Hebrew/completeness/status quality, реальные metrics
    и single-summary semantics.
  - Product decision записано в `PRODUCT.md` и `docs/source-of-truth.md`:
    green — «חוזקה לשימור» с `פעולות לשימור`, не improvement goals.
  - Новые tests намеренно RED: TypeScript `91 passed / 10 failed`, Python
    `41 passed / 10 failed`; failures точно соответствуют отсутствующим
    aggregates/quality/metrics/summary behaviors. Lint и build прошли.
  - Catalog tests прошли `6/6`, dependency-light Python suite — `13/13`:
    lookup больше не делает cross-status fallback, все `11` исходных записей
    локализованы, добавлено ровно `8` green-only entries и покрыта матрица 8×3.
- [x] **2026-07-25**: **Исправлен `/setup/` crash на partial persisted JSON**:
  - RED repository test получил actual `{note: ...}` вместо полного domain
    shape; Prisma mapper теперь нормализует известные поля на read boundary, а
    `SetupForm` defensively читает `classesPerGrade?.[grade]`.
  - Partial JSON получает безопасные defaults, полный современный context не
    теряет данные, а отсутствующий context остаётся `undefined`.
  - Targeted repository/manager/setup/API suite прошёл `26/26`; до добавления
    следующего semantic RED slice полный `npm test` прошёл `91/91`, lint и
    build прошли.
  - Локальный Playwright на read-only staging persistence подтвердил HTTP 200
    для `/setup/`, `/`, `/round/`, `/survey/` и `/dashboard/`; writes,
    migrations, webhook, deploy и alias mutation не выполнялись.
- [x] **2026-07-25**: **Выполнен локальный Manager UI browser-smoke и
  локализованы dashboard quality blockers**:
  - Playwright на локальном Next.js runtime с read-only staging persistence
    подтвердил manager home, round tracking, survey builder, unlocked map и
    dashboard detail/metrics/recommendations для round с `12` responses при
    threshold `10`.
  - `/setup/` вернул HTTP `500`: сохранённый partial `backgroundContext`
    содержит только `note`, а UI обращается к
    `backgroundContext.classesPerGrade[grade]`.
  - Content audit зафиксировал `0/4` законченных двухфразовых non-green
    interpretations, recommendations у `4/4` green dimensions, `11/11`
    английских recommendation titles и `8/8` generic metric sets.
  - Targeted manager-context/setup/view-model tests прошли `9/9`, что
    подтверждает coverage gap: partial JSON render и semantic quality ими не
    проверяются. Staging writes, webhook, deploy и alias mutation не
    выполнялись; tracked worktree после smoke был чистым.
- [x] **2026-07-25**: **Legacy staging alias выровнен с актуальным Git tree**:
  - После явного bounded approval
    `shalomut-map-demo-ui-redesign.vercel.app` переназначен с
    `dpl_35S9VvwN8V9Bq7da3iP2SJwT4349` на protected Preview
    `dpl_FjVVtXibnMwWRXHHAaPEW5wgj3bR`; production alias/deployment не
    менялись.
  - Source metadata Preview указывает на `91bb8d4`, но его Git tree идентичен
    application baseline `ace5ba8`; session-close docs не меняют runtime.
    `vercel inspect` подтвердил target `preview`, статус `READY`; unauthorized
    request сохранил `302` на Vercel SSO.
  - Protected respondent API вернул staging round, threshold `10` и 24
    обязательных вопроса; read-only PostgreSQL показал `12` responses.
    Targeted privacy tests прошли `5/5`.
  - Временные automation bypass secrets, созданные Vercel CLI для read-only
    smoke, отозваны; финальное состояние — `0`. Manager UI browser-smoke
    заблокирован `ERR_BLOCKED_BY_CLIENT`, поэтому визуальный unlock не заявлен
    как напрямую проверенный.
- [x] **2026-07-25**: **Manager boundary привязан к одной организации**:
  - Middleware удаляет клиентский organization header и передаёт downstream
    только `MANAGER_ORGANIZATION_ID`; deployed manager surfaces fail closed,
    если Basic credential или scope не настроены.
  - Manager pages, round APIs, survey definition, analytics, AI-insights GET и
    trigger проверяют scoped organization/round. Query-controlled dashboard
    `roundId` удалён; respondent и machine-authenticated routes сохраняют
    отдельные boundaries.
  - OpenAPI JSON/YAML документируют Basic auth и scoped 403/404; regression
    coverage включает подмену header, cross-organization create/read и
    multi-school fail-closed context.
  - Local verification: TypeScript suite 90/90, lint и production build
    прошли. Read-only local runtime smoke со staging persistence вернул
    configured organization и round даже при поддельном клиентском scope.
    `MANAGER_ORGANIZATION_ID` настроен для Vercel Preview/Production.
    Post-merge deployment `dpl_Hb1WZR9hHdUKsWhJdXDXDMS8ExPe` — `READY`;
    deployed smoke подтвердил anonymous `401`, authenticated `200` и ту же
    organization/round isolation.
- [x] **2026-07-25**: **Проверена изоляция AI-результатов по раундам и школам**:
  - Prisma хранит `aiInsights` в строке `SurveyRound`, а update/read выполняются
    по уникальному `roundId`; payload обязан содержать тот же `roundId`, что и
    callback route.
  - Локальный сценарий с двумя раундами школы A и одним раундом школы B
    подтвердил: повторный анализ A2 перезаписал только A2, сохранив A1 и B1.
  - Targeted repository/API tests прошли 15/15; полный TypeScript suite —
    81/81; `npx prisma validate`, lint и production build прошли.
  - На этом этапе shared Basic gate ещё не был scoped; текущий session-close
    slice закрыл автоматический выбор школы. MCP по-прежнему передаёт hardcoded
    organization context.
- [x] **2026-07-25**: **Real Gemini path доказан с bounded latency и без fallback**:
  - Commits `38575e5`, `c8f9242`, `98b27c3` и `a9b6c34` добавили
    source-aware provider resolution, безопасную классификацию ошибок,
    bounded retry/backoff, один retry transport timeout и общий
    per-dimension budget (`20s` request, `25s` total, `8s` minimum retry
    window).
  - TDD и full local verification: Python pytest 35/35,
    dependency-light suite 13/13, TypeScript suite 81/81, lint и production
    build прошли.
  - Render deployment `dep-d9ibutgk1i2s73b2oolg` для `a9b6c34` — `Live`;
    GitHub/Vercel pipeline checks прошли.
  - Ровно один подтверждённый webhook для staging round дал 4/4 Gemini
    `outcome=llm`, все `attempt=1`, 0 retry, 0 heuristic; callback и
    persisted GET вернули `200`, `processedAt` изменился.
  - Provider key не добавлялся в tracked repository; raw secret values не
    выводились и не записывались в session memory.
- [x] **2026-07-25**: **Добавлена универсальная поддержка LLM-провайдеров и ключей в `ai-analytics-service`**:
  - `config.py` поддерживает `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_PROVIDER`, `LLM_MODEL_FAST`, `LLM_MODEL_HEAVY` с полным сохранением свойств обратной совместимости (`openai_api_key`, `openai_model_fast`, `openai_model_heavy`).
  - `llm_provider.py` добавляет `_resolve_endpoint` для автоопределения Google Gemini (через OpenAI-совместимый эндпоинт `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`), OpenRouter, OpenAI и кастомных `LLM_BASE_URL` (Ollama/vLLM).
  - Созданы новые unit-тесты `test_llm_provider.py` (5 тестов). Все 20 pytest тестов в venv и 13 системных тестов в `run_tests.py` успешно пройдены.
- [x] **2026-07-25**: **Read-only локализована причина OpenAI `429`**:
  - Render logs подтвердили четыре LLM-вызова: четыре green dimensions были
    пропущены правилом 0-token, а четыре non-green dimensions ушли в OpenAI
    параллельно и получили `429`.
  - OpenAI Platform для текущей API-организации показывает активный ключ
    `Shalomut`, отсутствие успешного usage и прямое предложение добавить API
    credits. Это классифицирует инцидент как quota/billing failure, а не как
    доказанный transient RPM/TPM burst.
  - ChatGPT subscription не считается API-балансом; billing, ключи, лимиты и
    Render environment не изменялись.
  - Обнаружен observability gap: `llm_provider.py` перехватывает общий
    `Exception`, не сохраняет error body/code или rate-limit headers и
    возвращает heuristic fallback, поэтому один текст `HTTP Error 429` ранее не
    позволял различить quota и throttling.
  - Session-close verification для docs-only diff: `git diff --check` и
    проверка относительных Markdown links прошли; runtime suites не запускались,
    потому что код и конфигурация приложения не менялись.
- [x] **2026-07-25**: **Исправлен и доказан реальный Vercel → Render → Vercel AI E2E** (commit `6473a88` в `origin/main`):
  - Диагноз `MCP_SHARED_SECRET mismatch` опровергнут безопасными fingerprint-проверками: секреты совпадали. Первый `401` выдавал Vercel Deployment Protection старого preview; после перехода на production alias реальный blocker локализован как POST `308 Permanent Redirect`.
  - MCP client теперь канонизирует configured URL к trailing slash, callback строится как `/ai-insights/`. Два regression tests сначала зафиксировали slashless URL, затем прошли после минимального fix.
  - Render env переведён на `https://shalomut-map-demo.vercel.app/api/mcp` и `/api/rounds`; placeholder `VERCEL_PROTECTION_BYPASS` удалён. Другие secret values не менялись.
  - Локальная проверка: `python3 ai-analytics-service/run_tests.py` 13/13, full pytest 15/15, `npm test` 81/81, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check` — passed.
  - Vercel deployment `dpl_7FxfrtHYUdaKbD4AMVH6J7V4cx3j` — `READY`; Render deployment `dep-d9iamf3eo5us73cndcu0` — `Live`; health checks обоих runtime — HTTP 200.
  - Разрешённый E2E для round `80e78f3e-1240-42d4-8a9e-23a3467bb650`: trigger `202`, MCP `200`, webhook `200`, callback `200`, persisted GET `200`; сохранены contract `1.0` и восемь canonical stones.
  - Residual evidence: OpenAI вернул четыре `429 Too Many Requests`; pipeline завершился через предусмотренный heuristic fallback. Поэтому transport/persistence закрыты, а real LLM path остаётся отдельной незавершённой проверкой.
- [x] **2026-07-25**: **Первый этап AI service hardening смержен fast-forward в `main`** (commit `7e0e1fd`; позднее вошёл в `origin/main` вместе с параллельным commit `35a190b`):
  - Callback destination всегда строится из доверенного `DATA_LAYER_CALLBACK_URL` и URL-encoded `roundId`; входной `callbackUrl` сохраняется только для совместимости и игнорируется.
  - Origin callback валидируется независимо от наличия Vercel bypass, поэтому transport не может отправить payload или deployment credential на произвольный host.
  - `POST /api/v1/analyze` доступен только при `ENV=development`; вне development отвечает `404`.
  - Production/preview startup требует `MCP_SHARED_SECRET`, `AI_WEBHOOK_SECRET`, `AI_CALLBACK_SECRET`, non-local Data Layer URLs и `USE_MOCK_MCP=false`; webhook authentication выполняется раньше возврата деталей readiness.
  - Проверки AI commit: Python smoke 11/11, полный pytest 15/15 и parse OpenAPI JSON/YAML прошли. После параллельного MCP fix итоговый `main` прошёл TypeScript tests 78/78, `tsc --noEmit`, lint и production build.
  - Повторный Docker build не выполнен: локальный Docker daemon был недоступен. Staging/production deployment и runtime smoke не выполнялись.
- [x] **2026-07-25**: **Manager surfaces получили временную shared Basic protection** (commit `7a4d04d`, уже в `origin/main`):
  - Manager UI/API закрыты одним `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD`; deployed runtime без полного credential отвечает `503`, локальный development остаётся открытым.
  - Respondent survey routes и machine-to-machine MCP/callback endpoints не получают browser challenge и продолжают использовать собственные security boundaries.
  - Gate защищает deployment surface, но не является manager identity, role model или organization authorization; полноценная tenant isolation остаётся следующим security этапом.
- [x] **2026-07-25**: **AI-сервис подготовлен к вызовам protected Vercel core app** (commit `ed7b44d` в `origin/main`):
  - Опциональный `VERCEL_PROTECTION_BYPASS` передаётся как `x-vercel-protection-bypass` в MCP-запросе и callback только при явной настройке.
  - Payload-controlled `callbackUrl` не может увести project-wide credential: при настроенном bypass callback допускается только на тот же нормализованный origin, что и `DATA_LAYER_CALLBACK_URL`, иначе transport не вызывается.
  - Callback URL удалён из логов. Regression suite проверяет как наличие/отсутствие заголовка, так и отказ для чужого origin.
  - Текущие проверки: `python3 ai-analytics-service/run_tests.py` 10/10 и полный Python pytest 10/10.
  - Runtime bypass для AI-сервиса не создавался и сам AI-сервис не разворачивался; после staging smoke в Vercel остаётся `automationBypassCount: 0`.
- [x] **2026-07-25**: **Vercel Preview закрыт и подключён к отдельной staging-БД**:
  - Vercel Authentication включена с точным scope `deploymentType: preview`; unauthenticated запрос получает `302` на Vercel SSO.
  - `DATABASE_URL` добавлен как Sensitive variable только в Preview. `DIRECT_URL` не публиковался, Production project env vars отсутствуют.
  - Из чистого Git snapshot создан READY Preview `dpl_E7pQnJXMDHzoeeMQa5hWskxicCLz` без production promotion.
  - Authorized runtime smoke: `/` → 200, `/api/rounds/` → 200 `{"round":null}`; manager setup write/read доказал соединение с PostgreSQL.
  - Уникальные smoke records удалены; финальные counts staging: organizations 0, rounds 0, responses 0, answers 0.
  - Автоматически созданный CLI automation-bypass secret отозван после smoke без регенерации; постоянного bypass не оставлено.
  - Старый staging alias и production aliases/env этой операцией не менялись.
- [x] **2026-07-25**: **AI-сервис подготовлен к бесплатному контейнерному хостингу** (commit `c0166e0` в `origin/main`):
  - Добавлены корневой `Dockerfile`, `.dockerignore`, `.gcloudignore` и `render.yaml`. Build context — корень репозитория, чтобы общий `contracts/ai-analytics-v1.json` остался единственным источником контракта; образ сохраняет относительную раскладку, поэтому пути в коде не менялись.
  - Выбор площадки: Cloud Run как основной вариант (free tier, scale-to-zero, длинный лимит запроса), Render Free — запасной без привязки карты. Vercel отклонён: нет entrypoint в `api/`, а секция `[tool.vercel]` в `pyproject.toml` не была конвенцией Vercel и удалена.
  - Интерпретации восьми измерений выполняются параллельно через `asyncio.to_thread` + `gather`; MCP-запрос и доставка callback больше не блокируют event loop.
  - `ENV` стал fail-closed: без `ENV`/`VERCEL_ENV` сервис считает себя production и требует `AI_WEBHOOK_SECRET`. Локальный запуск теперь требует явного `ENV=development` (отражено в README и `.env.example`).
  - `POST /api/rounds/[roundId]/trigger-ai` получил таймаут `AI_SERVICE_TIMEOUT_MS` (30s по умолчанию) и отдельный ответ `504`.
  - Проверки (local, с последующим protected-origin regression): `run_tests.py` 10/10, полный pytest в venv 10/10, `npm test` 70/70, `tsc --noEmit`, `npm run lint`, `docker build` (образ 266 МБ, процесс от непривилегированного пользователя).
  - Контейнерный smoke: `/health` → 200 с `env: production`; вебхук без настроенного секрета → 503; без заголовка и с неверным секретом → 401; с верным секретом полный проход конвейера доставил callback с `contractVersion 1.0`, `status success` и восемью каноническими измерениями.
  - Параллельность измерена на заглушке с задержкой 0.5s на измерение: последовательно 4.00s, фактически 0.51s.
  - Реальный LLM-путь не проверялся: ключа OpenAI не было, использовался эвристический fallback. Деплой не выполнялся.
- [x] **2026-07-25**: **Создана и проверена отдельная Supabase staging persistence**:
  - Dashboard подтвердил, что исходный ref `fvnulyirrqjrnjbahmsn` — Production; он не изменялся.
  - Создан Free project `shalomut-map-staging` с отдельным ref `tpfzhyalaftotljmlont` в регионе `ap-northeast-2`; Data API отключён.
  - Staging DB URLs сохранены только в ignored `.env.staging.local` с правами `600`; production env files не менялись.
  - `prisma migrate deploy` применил `0_init`, `20260724170000_add_ai_insights` и `20260724180000_add_round_configuration`; повторный status подтвердил up to date.
  - Transactional CRUD smoke через runtime pooler проверил round configuration JSONB, AI-insights fields и cascade delete; после rollback все четыре доменные таблицы пусты.
  - Проверки: `prisma validate`, `prisma generate`, 70/70 TypeScript tests, lint и production build прошли.
  - На Free plan нет backups/PITR; пока staging пуст и disposable, согласованный rollback — удалить и пересоздать только staging project.
- [x] **2026-07-25**: **Добавлена переносимая система инструкций и verification для AI coding agents**:
  - Канонические repo-level skills `shalomut-map`, `shalomut-tracker` и `shalomut-verification` добавлены в `.agents/skills/`.
  - `AGENTS.md`, `GEMINI.md`, `CLAUDE.md` и `.github/copilot-instructions.md` направляют совместимых агентов к этим skills и содержат direct-read fallback.
  - Устаревшая глобальная копия `shalomut-map` удалена из активных Codex skills; версия в репозитории остаётся source of truth.
  - Commits `03f6ca8` и `bcc6c55` отправлены в `origin/main`; локальный и удалённый `main` совпадают.
  - Проверены frontmatter, относительные ссылки и наличие файлов; runtime test suite не запускался, потому что код приложения не менялся.
- [x] **2026-07-24**: **Manager UI переведён на реальные persisted records и подготовлен безопасный full-stack runtime**:
  - PR #5 смержен в `main` (`6b369bf`); database-backed manager slice смержен через PR #6 (`043f54d`).
  - Home, setup, round tracking, survey builder, dashboard и respondent flow используют настоящий organization/current round context, response counts, analytics, share code и round ID; пустая БД показывает onboarding, а не demo-записи.
  - `PUT /api/manager/setup`, `PATCH /api/rounds/[roundId]` и `GET/PUT /api/rounds/[roundId]/survey-definition` сохраняют manager setup, статус и definition; 24 канонических вопроса нельзя отключить или переназначить.
  - Добавлены Prisma-поля `background_context` и `survey_definition` с отдельной неприменённой миграцией `20260724180000_add_round_configuration`.
  - Анонимная отправка использует per-round local token и SHA-256 hash, проверяет сохранённый набор вопросов и не показывает ложный success при API/network error.
  - Static export/GitHub Pages удалены; Next.js работает как full-stack server runtime. FastAPI-сервис подготовлен к Vercel, fail-closed secrets и синхронной serverless обработке.
  - Локальные in-memory repositories разделяют один development state между Route Handlers и Server Components; deployed runtime без `DATABASE_URL` отклоняет любые data writes с `503`, а не показывает ложный success.
  - OpenAPI JSON/YAML синхронизированы с manager persistence routes, demo identifiers удалены из runtime examples.
  - Проверки: 70/70 TypeScript tests, локальный setup → survey → submit → locked analytics runtime smoke, 9/9 full Python pytest, 7/7 Python smoke suite, lint, Next.js production build, Prisma validate/generate.
  - PR #6 прошёл GitHub `Build & Validate` и Vercel preview и смержен в `main`. Staging alias и production не менялись.
- [x] **2026-07-24**: **Исправлено ложное demo-состояние при пустой БД и обновлён staging**:
  - Установлено две причины: staging alias указывал на старый commit `3083051`, а `getRepositories()` неявно подставлял `DEMO_ORGANIZATION` и `DEMO_ROUND` при отсутствии `DATABASE_URL`.
  - Default in-memory repositories теперь пустые; demo fixtures подключаются только явно в тестах/opt-in demo.
  - Добавлены regression tests для пустых repositories и ответа `GET /api/rounds` → `{"round":null}`.
  - Создан commit `a20ac66`, draft PR #5 и READY preview `dpl_35S9VvwN8V9Bq7da3iP2SJwT4349`.
  - Staging alias переназначен на проверенный preview. Production не изменялся.
  - Проверки: 53/53 tests, lint, production build, GitHub Build & Validate, Vercel smoke.
- [x] **2026-07-24**: **Стабилизирована сквозная AI Analytics интеграция и подключён dashboard**:
  - Добавлен общий versioned contract `contracts/ai-analytics-v1.json`; TypeScript callback отклоняет legacy/mismatched payloads и требует ровно 8 канонических измерений.
  - Python pipeline, mock MCP и intervention catalog синхронизированы с каноническими ID; рекомендации больше не переходят между измерениями.
  - `aiInsights` и `aiInsightsUpdatedAt` добавлены в Prisma; миграция `20260724170000_add_ai_insights` применена к настроенной Supabase-цели, статус проверен как up to date.
  - MCP, webhook и callback поддерживают отдельные shared secrets; mock MCP включается только явным `USE_MOCK_MCP=true`; сетевые ошибки больше не маскируются fake-success.
  - Добавлен настоящий локальный boundary E2E: Next.js MCP → Python pipeline CLI → Next.js callback → persistence GET, включая privacy-lock.
  - Dashboard detail/metrics/recommendations читает валидированные AI-инсайты и показывает loading, locked, not-found и error состояния, сохраняя `roundId` в навигации.
  - Обновлены OpenAPI JSON/YAML и README AI-сервиса; браузерно проверены ready/not-found/locked состояния.
- [x] **2026-07-24**: **Hotfix: TypeScript build ошибки в MCP Server route (`/api/mcp`)**:
  - `AnalyticsService` — статический класс. Убрали неверный `new AnalyticsService(...)`, заменили на прямой вызов статического метода `AnalyticsService.getAnalyticsForRound(roundId, roundRepo, surveyRepo)`.
  - Исправлены ключи репозитория: `repositories.rounds` → `repositories.roundRepo`, `repositories.surveys` → `repositories.surveyRepo`.
  - Убран `await` с синхронной функции `getRepositories()`.
  - `tsc --noEmit` проходит без ошибок. Изменения запушены в `feature/ai-analytics-microservice-mcp`.
- [x] **2026-07-24**: **Архитектурный аудит декаплинга AI-сервиса + Выделен `LLMProviderService`**:
  - Создан изолированный [`src/services/llm_provider.py`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/ai-analytics-service/src/services/llm_provider.py): скрывает всю токеномику, выбор модели (`gpt-4o-mini` vs `gpt-4o`), правила «0 токенов для green-измерений» и фоллбэк-генератор.
  - Узлы graph-style workflow в `nodes.py` не содержат прямых LLM API вызовов — они делегируют `LLMProviderService`.
  - Границы разделены на MCP transport, FastAPI boundary, workflow nodes, LLM provider и structured intervention catalog.
- [x] **2026-07-24**: **Оптимизация токенов: Multi-Tier Model Strategy**:
  - Правило 0 токенов для здоровых (`green`) измерений (`only_llm_for_problematic = True`).
  - Дешевая быстрая модель `gpt-4o-mini` по умолчанию (в 15 раз дешевле `gpt-4o`).
  - Лимит длины генерации `max_tokens_per_dimension = 180`.
  - Поиск рекомендаций в локальном JSON-каталоге не расходует LLM-токены.
- [x] **2026-07-24**: **Реализованы Next.js MCP Server, AI Webhook Trigger & AI Insights Callback**:
  - **MCP-compatible HTTP JSON-RPC endpoint (`/api/mcp`)**: Экспортирует `tools/list` и инструмент `get_round_analytics(roundId)`.
  - **AI Insights Callback Endpoint (`/api/rounds/[roundId]/ai-insights`)**: Принимает (`POST`) и отдает (`GET`) сгенерированный AI-микросервисом JSON-пейлоאד *"Stone Map"*.
  - **Webhook Trigger Endpoint (`/api/rounds/[roundId]/trigger-ai`)**: Генерирует и отправляет событие `{"event": "round_closed", "roundId": roundId}` на вебхук AI-сервиса.
  - **Хранилище**: Расширен контракт `IRoundRepository`; первоначальная версия хранила результат in-memory, а Prisma-персистентность добавлена в последующем stabilization slice.
  - **Автотесты**: Создан набор автотестов ([`src/app/api/__tests__/mcp-integration.test.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/__tests__/mcp-integration.test.ts)).
- [x] **2026-07-24**: **Разработан и протестирован Decoupled AI Analytics Microservice (`ai-analytics-service/`)**:
  - **Архитектура**: Изолированный Python 3.11+ микросервис на **FastAPI** с HTTP JSON-RPC MCP-клиентом и собственным асинхронным graph-style workflow.
  - **Privacy Gate**: Автоматическая блокировка анализа при `isLocked=True` (количество ответов `< 10`) для предотвращения דאנונימיזציה.
  - **Workflow**: `Privacy_Gate` -> `Agent_Psychologist` -> `Agent_Intervention` -> `Agent_Safety_Validator` (loop) -> `Stone Map Output Formatter`.
  - **Каталог рекомендаций**: Локальная структурированная база знаний с рекомендациями **OECD Wellbeing Framework** и **ISO 45003:2021** для всех 8 измерений.
  - **MCP Client & Mock Data Layer**: Реализован клиенский менеджер MCP и автономный `MockDataLayerMCPServer` для работы в оф라인/дев-режиме.
  - **Тестирование**: Создан набор тестов ([`ai-analytics-service/run_tests.py`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/ai-analytics-service/run_tests.py)); после stabilization suite содержит 7 проверок.
- [x] **2026-07-24**: **Полностью сброшены данные макета UI и счетчики главных страниц (Empty Round State)**:
  - В [`src/lib/demo-data.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/demo-data.ts) сброшены показатели организации, раунда и всех 8 измерений (0/0 השיבו עד כה, 0 מוקדי טיפול, 0 חוזקות, ציון 0).
  - Хелперы `getStatusCount()` и `overallScore` возвращают `0`, когда количество ответов ниже порога анонимности (`< 10`).
  - Дашборд `/dashboard` переведен в защищенный заблокированный режим (`DashboardMapLocked`), отображающий `0 מתוך 10 תשובות נדרשות` и кнопку запуска нового опроса.
  - Прогнаны 31/31 тестов и успешен production-билд.
- [x] **2026-07-24**: **Созданы Prisma Migrations (`0_init`) и разделены URL для Pooler/Direct соединения**:
  - Создана базовая миграция [`prisma/migrations/0_init/migration.sql`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/prisma/migrations/0_init/migration.sql).
  - Разделено подключение к БД: `DATABASE_URL` через Pooler (порт 6543, `pgbouncer=true`) для рантайма и `DIRECT_URL` (порт 5432) для DDL/миграций в [`prisma.config.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/prisma.config.ts), `.env` и `.env.local`.
  - Зафиксирован статус миграции `0_init` в БД (`npx prisma migrate resolve --applied 0_init`). Проверено статусом `Database schema is up to date!`.
  - Добавлены npm-скрипты `db:migrate:dev`, `db:migrate:deploy` и `db:status`.
- [x] **2026-07-24**: **Старт новой сессии shalomut-tracker & полная очистка продакшн-данных**:
  - Создан скрипт `scripts/clear-db.ts` и добавлен npm-скрипт `npm run db:clear`.
  - Выполнена полная очистка данных в продакшн PostgreSQL БД Supabase (`QuestionAnswer`, `SurveyResponse`, `SurveyRound`, `Organization`).
  - Проверено обнуление всех таблиц (организации: 0, раунды: 0, ответы: 0, ответы на вопросы: 0).
  - Успешно прогнаны 31/31 интеграционных и API автотестов.
- [x] **2026-07-24**: **Успешно подключена и развернута продакшн PostgreSQL БД в Supabase**:
  - Настроено подключение к Supabase (Pooler IPv4 в регионе `ap-southeast-1`) в файлах `.env` и `.env.local`.
  - Развернуты таблицы реляционной схемы (`organizations`, `survey_rounds`, `survey_responses`, `question_answers`).
  - Сгенерирован клиент Prisma Client v7 (`npx prisma generate`).
  - Проверено прямое подключение и пройдено 31/31 автотестов слоя хранения и API эндпоинтов.
- [x] **2026-07-24**: **Созданы OpenAPI 3.0 / Swagger Спецификация & Интерактивный Swagger UI (shalomut-tracker)**:
  - Разработана спецификация OpenAPI 3.0 в форматах JSON ([`public/openapi.json`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/public/openapi.json)) и YAML ([`docs/openapi.yaml`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/docs/openapi.yaml)), документирующая эндпоинты `/api/rounds`, `/api/survey/[shareCode]`, `/api/survey/[shareCode]/submit` и `/api/rounds/[roundId]/analytics`.
  - Создана страница интерактивного визуализатора Swagger UI [`src/app/api-docs/page.tsx`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api-docs/page.tsx) для онлайн тестирования и проверки схем данных.
  - Написаны автотесты целостности OpenAPI спецификации ([`src/app/api/__tests__/openapi.test.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/__tests__/openapi.test.ts)). Пройдено 31/31 тестов, успешный production-билд.
- [x] **2026-07-24**: **Исправлена ошибка GitHub Pages CI/CD пайплайна**:
  - Устранена ошибка `touch out/.nojekyll` путем добавления переменной `NEXT_EXPORT: "true"` в [.github/workflows/deploy-github-pages.yml](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/.github/workflows/deploy-github-pages.yml) и безопасного `mkdir -p out`.
  - Добавлены статические декларации роутов для `src/app/api/` для корректного статического экспорта Next.js.
  - Проведены локальные тесты (28/28 пройдено), билд замерджен и отправлен в `origin/main`.
  - Историческая запись: этот workflow позднее удалён, когда manager UI стал database-backed и приложению понадобился полноценный server runtime.
- [x] **2026-07-24**: **Реализован Prisma Persistence Layer (Слой физического хранения сырых данных)**:
  - Создана реляционная схема БД [`prisma/schema.prisma`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/prisma/schema.prisma) (`Organization`, `SurveyRound`, `SurveyResponse`, `QuestionAnswer`).
  - Создан модульный клиент БД [`src/lib/repositories/prisma/prisma-client.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/prisma/prisma-client.ts) с ленивой инициализацией.
  - Имплементированы Prisma-репозитории сырых данных: [`PrismaOrganizationRepository`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/prisma/prisma-organization.repository.ts), [`PrismaRoundRepository`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/prisma/prisma-round.repository.ts), [`PrismaSurveyRepository`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/prisma/prisma-survey.repository.ts).
  - Настроена динамическая фабрика `getRepositories()` в [`src/lib/repositories/index.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/index.ts): автоматическое переключение на Prisma при наличии `DATABASE_URL` и фоллбэк на In-Memory в режиме разработчика/демо.
  - Написаны автотесты адаптеров Prisma ([`src/lib/repositories/__tests__/prisma.test.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/__tests__/prisma.test.ts)). Пройдено 28/28 тестов, билд успешен.
- [x] **2026-07-24**: **Созданы API Routes (Next.js App Router) & Подключена UI-Интеграция**:
  - Создан эндпоинт `GET / POST /api/rounds` ([`src/app/api/rounds/route.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/rounds/route.ts)).
  - Создан эндпоинт `GET /api/survey/[shareCode]` ([`src/app/api/survey/[shareCode]/route.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/survey/%5BshareCode%5D/route.ts)).
  - Создан эндпоинт `POST /api/survey/[shareCode]/submit` ([`src/app/api/survey/[shareCode]/submit/route.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/survey/%5BshareCode%5D/submit/route.ts)).
  - Создан эндпоинт `GET /api/rounds/[roundId]/analytics` ([`src/app/api/rounds/[roundId]/analytics/route.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/rounds/%5BroundId%5D/analytics/route.ts)).
  - Интегрирована отправка формы в [`SurveyFlow`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/components/survey/survey-flow.tsx) через API эндпоинт с фоллбэком.
  - Написан комплект автотестов API Routes ([`src/app/api/__tests__/api.test.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/__tests__/api.test.ts)). Пройдено 25/25 тестов, успешный production-билд.
- [x] **2026-07-24**: **Реализован Repository Layer (Data Abstraction & In-Memory Adapters)**:
  - Созданы TypeScript-интерфейсы `IRoundRepository`, `ISurveyRepository`, `IOrganizationRepository` ([`src/lib/repositories/interfaces.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/interfaces.ts)).
  - Имплементированы in-memory адаптеры `InMemoryRoundRepository`, `InMemorySurveyRepository`, `InMemoryOrganizationRepository` с поддержкой генерации демо-семян `SHALOM-DEMO`.
  - Добавлена защита от повторной отправки ответов по анонимному хэшу токена `anonymousTokenHash`.
  - Сервисы `RoundService`, `SurveyService` и `AnalyticsService` расширены методами работы с репозиториями (`createAndSaveRound`, `submitAndSaveResponse`, `getAnalyticsForRound`).
  - Добавлены юнит- и сквозные интеграционные тесты ([`src/lib/repositories/__tests__/repositories.test.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/__tests__/repositories.test.ts)). Пройдено 20/20 тестов, билд успешен.
- [x] **2026-07-24**: **Проведен архитектурный рефакторинг компонентов и вынос утилит (shalomut-tracker)**:
  - Выделены утилиты и хуки (`src/lib/utils/math.ts`, `format.ts`, `src/lib/hooks/use-clipboard.ts`, `use-blob-fit.ts`).
  - Выделен каталог Shared UI компонентов `src/components/ui/` (`ScoreRing`, `StatusBadge`, `StatStone`, `PrivacyTooltip`, `DimensionIcon`, `ActionCard`, `PageIntro`, `MetricCard`).
  - Проведена декомпозиция монолитов `survey-builder.tsx` (20.1 KB) и `dashboard-mock.tsx` (14.2 KB) по доменам (`src/components/dashboard/`, `src/components/survey/`, `src/components/round/`, `src/components/layout/`).
  - Добавлены юнит-тесты маршрутизации и утилит (`src/lib/__tests__/navigation.test.ts`, `src/lib/utils/__tests__/math-and-format.test.ts`). Пройдено 15/15 тестов.
- [x] **2026-07-24**: **Создан Service Layer бэкенда**:
  - Созданы типы данных ([`src/lib/types/backend.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/types/backend.ts)).
  - Реализован [`AnalyticsService`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/services/analytics.service.ts) (агрегация 8 измерений, шкала 100/60/0, порог анонимности `privacyThreshold >= 10`).
  - Реализован [`SurveyService`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/services/survey.service.ts) (валидация 24 вопросов, обработка анонимных ответов).
  - Реализован [`RoundService`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/services/round.service.ts) (генерация кодов доступа `SHALOM-XXXX`, переходы статусов раундов).
  - Написаны и успешно пройдены юнит-тесты ([`src/lib/services/__tests__/analytics.service.test.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/services/__tests__/analytics.service.test.ts)).
- [x] **2026-07-24**: Проект переведен из статуса «демо» в статус реального продукта (`shalomut-map`). Удалены обозначения Demo из UI copy, метаданных, `package.json`, CI/CD workflows и документации. Компонент `SurveyBuilderDemo` переименован в `SurveyBuilder`.
- [x] **2026-07-24**: Все изменения редизайна и конфигурации деплоя замерджены в ветку `main` и запушены в `origin/main`.
- [x] **2026-07-24**: Разделены деплой-окружения (`stg` на `https://shalomut-map-demo-ui-redesign.vercel.app/` с авто-деплоем из `main` и `prod` с ручным деплоем по указанию). Настроен пайплайн GitHub Actions ([.github/workflows/deploy-vercel.yml](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/.github/workflows/deploy-vercel.yml)).
- [x] **2026-07-24**: Составлен и зафиксирован спецификационный документ бэкенда и моделей данных ([docs/data-layer-and-backend-plan.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/docs/data-layer-and-backend-plan.md)).
- [x] **2026-07-24**: Выделен канонический источник методологии опроса в `src/lib/shalomut-source.ts` (8 измерений, 24 вопроса, пороговые значения баллов).
- [x] **2026-07-24**: Добавлен стек шрифтов для иврита (`Arial`, `Noto Sans Hebrew`) и сглаживание шрифтов.
- [x] **2026-07-24**: Настроен `clamp()` для адаптивной типографики заголовков.
- [x] **2026-07-24**: Исправлен контраст текста на камнях статуса (соответствие WCAG AA, замена белого текста на `--ink`).
- [x] **2026-07-24**: Инициализирован файл памяти сессий `PROGRESS.md` и `PROJECT_CONTEXT.md`.

---

## ⚠️ Известные вопросы и заметки
- При добавлении новых вариантов камней сохранять контраст инкового текста (`#383838`) к фону камня не менее 4.5:1.
- Результаты опроса должны оставаться заблокированными на уровне бэкенда (`isLocked: true`), если количество респондентов в раунде менее `privacyThreshold` (по умолчанию 10).
