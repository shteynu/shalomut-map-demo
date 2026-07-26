# Shalomut Tracker — актуальный handoff

Обновлено: 2026-07-26

Это оперативная точка входа для перехода от исходного статического demo
Shalomut Map к `shalomut-tracker`, где сохранённые данные должны быть единственным
источником runtime-состояния. `src/lib/shalomut-source.ts` остаётся источником
восьми dimensions, scoring/status semantics и default questionnaire template;
exact вопросы раунда принадлежат persisted `SurveyRound.surveyDefinition`.
Визуальные mock-данные изолированы в `src/lib/demo-data.ts`.

## Текущий snapshot

- Активный план работ: [`manager-feedback-plan-2026-07-26.md`](manager-feedback-plan-2026-07-26.md) —
  замечания директора и находки аудита деплоя, разложенные на слайсы P0–P3 с
  критериями приёмки, проверками и approval gates.
- Активная ветка: `main`/`origin/main` содержат реализации вплоть до коммитов `069d752` (Manager UI Auth & Sunset prep) и `d68806c` (Progress documentation).
- Contract `3.0` реализует dynamic round-scoped questions при фиксированных
  восьми Dashboard dimensions и output shape. Specification находится в
  `docs/dynamic-questionnaire-ai-contract.md`; contracts `1.0`/`2.0` не
  изменены. Deployed Core producer формирует dynamic `3.0`; `2.0` остаётся
  совместимым legacy/rollback boundary.
- Application runtime snapshot: Vercel Preview
  `dpl_FystEnZZ5rNPbJevXcNrfQmn83in` — `READY`, Staging alias —
  `https://shalomut-map-demo-ui-redesign.vercel.app`; Render
  `dep-d9iro1uk1jcs73f6kmh0` — `Live`.
- **GitHub Pages сайт снят с публикации (2026-07-26, по явному указанию
  пользователя)**: `DELETE /repos/shteynu/shalomut-map-demo/pages` вернул `204`,
  `has_pages` теперь `false`. Сайт отдавал замороженный статический артефакт от
  2026-07-24 (`Last-Modified: 24 Jul 2026 15:07 GMT`) без каких-либо API-роутов
  (`GET /api/rounds` → `404 HTML`), а его bundle показывал экран успешной
  отправки независимо от результата запроса и обращался к hardcoded
  `/api/survey/SHALOM-DEMO/submit`. Единственный поддерживаемый web-деплой —
  Vercel. Локальный устаревший `out/` (gitignored) удалён.
- Vercel alias state (read-only, 2026-07-26): `shalomut-map-demo.vercel.app` →
  `dpl_6EfNFk8FN2cLmLVtF3LTxwG7m7pP` (`target: production`, собран из `8bf0cff`,
  Git-интеграция авто-деплоит `main` в Production);
  `shalomut-map-demo-ui-redesign.vercel.app` →
  `dpl_FystEnZZ5rNPbJevXcNrfQmn83in` (`target: preview`, Vercel SSO). Решение о
  сведении к одному URL требует отдельного bounded approval: Render настроен на
  `shalomut-map-demo.vercel.app`, а `docs/openapi.yaml` и `public/openapi.json`
  указывают `-ui-redesign` как первый server URL.
- **Manager UI Authorization & Basic Auth Sunset**: Реализованы `/login`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `ManagerAuthenticationService` (Web Crypto HMAC-SHA256), шапка пользователя `ManagerUserBar` и флаг `DISABLE_BASIC_AUTH_FALLBACK` в `middleware.ts`.
- **Contract 3.0 Live Staging E2E**: Живая проверка на Staging Supabase DB (`tpfzhyalaftotljmlont`) доказала Scenario A1 (Unlocked custom questionnaire 3.0, 10 responses, exact definition hash `sha256:88489e11...`, 8 custom question aggregates) и Scenario A2 (Privacy lock при < 10 ответов). Автоматическая SQL-очистка удалила все одноразовые записи.
- **Verification Evidence**: `npm test` 162/162 passed, `npm run lint` 0 errors, `npm run build` прошёл успешно (39 страниц).
- PR #5 смержен в `main` squash commit `6b369bf`.
- PR [#6](https://github.com/shteynu/shalomut-map-demo/pull/6) смержен в
  `main` squash commit `043f54d`.
- Реализация разбита на проверяемые commits: manager context, DB-backed UI,
  persistence, full-stack runtime и serverless AI hardening.
- Создан отдельный Supabase staging project `shalomut-map-staging`:
  project ref `tpfzhyalaftotljmlont`, состояние `Healthy`, регион
  `ap-northeast-2` (Seoul), Data API отключён.
- Все три Prisma migration, включая
  `20260724180000_add_round_configuration`, применены только к выделенной
  staging-БД; `prisma migrate status` сообщает `Database schema is up to date!`.
- Staging credentials находятся только в ignored `.env.staging.local` с
  правами `600`; production `.env` и `.env.local` не менялись.
- В Vercel включена Vercel Authentication с точным scope
  `deploymentType: preview`; production domains этим режимом не изменяются.
- Production alias `https://shalomut-map-demo.vercel.app` сейчас используется
  как staging core endpoint и подключён к выделенной staging-БД. Это
  operational staging configuration, а не подтверждение production readiness;
  `DIRECT_URL` в Vercel не добавлялся.
- Staging persistence содержит ровно одну organization
  `34d05e66-fa4d-4a07-a2af-c9d5c41b6088` (`בית ספר בדיקת E2E`) и один round
  `80e78f3e-1240-42d4-8a9e-23a3467bb650`; это подтверждено read-only
  запросом.
- `MANAGER_ORGANIZATION_ID` для этой organization добавлен в Vercel как
  Sensitive variable со scope Preview и Production. Локальная копия находится
  только в ignored `.env.staging.local`; production `.env` и `.env.local` не
  менялись.
- Исторический проверенный Vercel implementation deployment
  `dpl_4eNSv1WpVvhjGBqgUCbbrBGuBbSe` для `ba99a23` имеет состояние `READY` и
  обслуживает `shalomut-map-demo.vercel.app`. `/setup/` partial-JSON regression
  уже исправлен и задеплоен в этом baseline. Session-close docs publish может
  создать более новый deployment без изменения application runtime.
- Исходный Supabase project ref `fvnulyirrqjrnjbahmsn` подтверждён Dashboard как
  `main / Production` и не изменялся.
- Staging:
  [shalomut-map-demo-ui-redesign.vercel.app](https://shalomut-map-demo-ui-redesign.vercel.app/).
- После явного bounded approval legacy staging alias переназначен с
  `dpl_35S9VvwN8V9Bq7da3iP2SJwT4349` (`a20ac66`) на protected Preview
  `dpl_FjVVtXibnMwWRXHHAaPEW5wgj3bR`, состояние `READY`, source commit
  `91bb8d4`. Git tree этого Preview
  (`e6ec733e140cf5af1c0e98c87c3cfcbea3a8c37d`) идентичен application
  baseline `ace5ba8`; последующая session-close документация не меняет
  runtime-содержимое. Production deployment и alias этой операцией не
  менялись.
- Новый protected Preview со staging persistence:
  `dpl_E7pQnJXMDHzoeeMQa5hWskxicCLz`, состояние `READY`, target `preview`, URL
  `https://shalomut-map-demo-3b0szbymo-shteynumaks-1343s-projects.vercel.app`.
  Он собран из чистого Git snapshot без локальных незакоммиченных файлов.
- Финальный PR #6 preview: `dpl_3KrHd5nbcvqdnSAup2sY1L1jjzmT`, состояние
  `READY`,
  URL
  `https://shalomut-map-demo-16cvkgov9-shteynumaks-1343s-projects.vercel.app`.
- Core production alias продолжает использоваться как operational staging
  endpoint. GitHub workflow
  [30160539496](https://github.com/shteynu/shalomut-map-demo/actions/runs/30160539496)
  для commit `a9b6c34` завершился успешно; manual production deploy job
  ожидаемо был пропущен.
- AI-сервис развёрнут на Render; исторический `2.0` rollout:
  `https://shalomut-ai-analytics.onrender.com`. Deployment
  `dep-d9ij9unlk1mc739jao30` собран из `ba99a23`, имеет состояние `Live`;
  `/health` отвечает HTTP 200. Предшествующий consumer-first deployment
  `dep-d9ij96mq1p3s73fhsncg` для `82f7194` также успешно завершился.
- Разрешённый real E2E для round
  `80e78f3e-1240-42d4-8a9e-23a3467bb650` завершён: trigger `202`, MCP `200`,
  Render webhook `200`, callback `200`, persisted GET `200`; сохранён payload
  contract `1.0` с восемью canonical stones.
- Повторный явно подтверждённый E2E после перехода на Gemini доказал real LLM
  path: четыре non-green dimensions дали `outcome=llm` с первой попытки,
  `outcome=retry` — `0`, `outcome=heuristic` — `0`; четыре green dimensions
  ожидаемо были пропущены правилом 0-token. Callback получил `200`, а
  `processedAt` persisted payload изменился на
  `2026-07-25T13:54:46.160682+00:00`.

### Dynamic questionnaire contract `3.0` (rollout 2026-07-26)

- Новый immutable manifest добавлен отдельно; manifests `1.0` и `2.0` не
  изменены. `surveyDefinitionHash` связывает exact enabled question
  ID/dimension/text snapshot между Core, Python, callback и provenance.
- Core использует persisted `SurveyRound.surveyDefinition`, принимает custom и
  supplemental questions, проверяет unique IDs и полное покрытие dimensions,
  замораживает question snapshot после первого accepted response и целиком
  блокирует details, если total или один question ниже threshold.
- Python принимает `1.0`/`2.0`/`3.0`; dynamic prompt, deterministic fallback,
  metrics и provenance используют exact round text/IDs. Locked path не
  вызывает provider.
- Core callback и Dashboard reader принимают все три версии. Callback для
  `3.0` заново сверяет hash, Core-owned score/status и question aggregates;
  Dashboard показывает variable metric counts и сохраняет eight stones,
  single summary, exact-status interventions и green semantics.
- RED evidence воспроизвёл canonical-only aggregation/text, exact-24 Python и
  three-metric Dashboard assumptions. GREEN evidence: targeted TypeScript
  82/82, `npm test` 131/131, full Python pytest 88/88, dependency-light 13/13,
  OpenAPI 5/5 + independent parse/sync, lint, typecheck и build.
- Local Next.js → Python CLI → callback boundary прошёл для 8- и 11-question
  rounds; ниже-threshold question блокирует весь result. Local Playwright на
  явно database-free in-memory runtime проверил `/setup/`, оба respondent
  questionnaires, variable metrics/recommendations, locked `9/10` Dashboard и
  green supporting actions. Внешних writes или webhook не было.
- Deployment выполнен consumer-first: Python `f1cd906`, Core consumers
  `6833cb2`, затем producer `3e3f43f`. Соответствующие Render deployments
  `dep-d9irlm6k1jcs73f6je50`, `dep-d9irmvn41pts73aoi83g` и
  `dep-d9iro1uk1jcs73f6kmh0` стали `Live`; Vercel deployments
  `dpl_CyDBdFHJhw5wPYy2ZwKtxEMbrcQR`, `dpl_AveukVTUW7Zr8iXeVmMng9CvSFuH` и
  `dpl_3mfGbz5FiEfWABkfDx8iWTdB4Ris` стали `READY`; workflows `30193335363`,
  `30193418263`, `30193485699` завершились успешно.
- Read-only deployed MCP smoke существующего staging round вернул `3.0`,
  восемь dimension scores, 24 aggregates и корректный definition hash без
  respondent identity. Реальный webhook/callback и data writes не запускались.

### Dashboard semantic contract `2.0` (rollout 2026-07-26)

- Breaking boundary зафиксирован как `2.0`; immutable manifest `1.0` не
  изменён. Новый manifest сохраняет восемь canonical dimensions и ровно 24
  обязательных вопроса. TypeScript, Python и OpenAPI описывают обе версии.
- Consumer-first compatibility: Python принимает missing/`1.0` как legacy и
  explicit `2.0` как strict input; callback validator принимает обе версии.
  Rollout выполнен в правильном порядке: `82f7194` стал Live на Render до push
  Core producer `ba99a23`.
- Core/MCP формирует privacy-safe aggregates для всех 24 вопросов с round и
  organization isolation. Если total или хотя бы один canonical question не
  достигает threshold, `isLocked=true`, а `dimensionScores` и
  `questionAggregates` равны `{}`.
- Python quality gate проверяет provider `finish_reason`, ровно две законченные
  Hebrew-only пользовательские фразы и status consistency. Invalid,
  truncated и incomplete output получает bounded retry; после исчерпания
  используется deterministic fallback, grounded в question aggregates.
  Payload сохраняет `llm`/`deterministic_fallback` provenance, попытки и три
  source question IDs.
- Intervention lookup не делает cross-status fallback. Dashboard показывает
  реальные question metrics, один organization summary на overview и green UX
  `חוזקה לשימור` / `פעולות לשימור` без improvement goals.
- Verification GREEN: `npm test` 109/109; full Python pytest 65/65 (одно
  существующее Starlette/httpx2 deprecation warning); dependency-light Python
  13/13; OpenAPI 5/5 и независимый JSON/YAML parse/sync; lint; production build;
  `git diff --check`.
- Local Next.js → Python CLI → local callback real-runtime boundary без внешних
  writes подтвердил contract `2.0`, 8 dimension aggregates, 24 question
  aggregates, 8 stones, deterministic provenance и callback `200`.
- Local Playwright на явно изолированном in-memory runtime подтвердил `/setup/`,
  unlocked overview/detail/metrics/recommendations и locked dashboard/API.
  Summary показан один раз, metrics содержат три реальных вопроса по 10 ответов,
  green action label корректен; browser console: 0 errors/0 warnings. После
  smoke dev process остановлен, ephemeral данные исчезли.
- Production/staging data, migrations, secrets, provider settings и aliases не
  менялись. Real webhook/callback не запускался. Vercel
  `dpl_4eNSv1WpVvhjGBqgUCbbrBGuBbSe` — READY, Render
  `dep-d9ij9unlk1mc739jao30` — Live; обе runtime association указывают на
  `ba99a23`.

## Инцидент: непустой UI при пустой БД

### Что наблюдалось

Staging показывал старую demo-школу, имя менеджера, `18/34` ответов, одну зону
внимания и четыре сильные стороны, хотя PostgreSQL не содержал записей.

### Корневые причины

1. Staging alias всё ещё указывал на deployment commit `3083051`, созданный до
   обнуления UI-счётчиков.
2. При отсутствии или недоступности `DATABASE_URL` функция `getRepositories()`
   молча возвращала in-memory repositories с `DEMO_ORGANIZATION` и
   `DEMO_ROUND`. API мог выдумать `SHALOM-DEMO` вместо честного пустого
   состояния.

### Что исправлено

- Default in-memory repositories теперь стартуют пустыми.
- Demo organization и round сохранены только как явные fixtures для тестов или
  opt-in demo режима.
- API- и MCP-тесты подключают demo fixtures явно.
- Regression coverage проверяет, что пустой runtime возвращает
  `{"round":null}`, а не `SHALOM-DEMO`.
- `.env.example` поясняет, что без database URL используются пустые in-memory
  repositories.
- Staging alias переназначен на проверенный preview для commit `a20ac66`.

## Доказательства проверки

- Staging target identity: URL, transaction/session pooler и DB credentials
  ссылаются на `tpfzhyalaftotljmlont`; production ref отсутствует.
- До миграции staging содержал `0` public tables; Prisma status показал ровно
  три pending migrations.
- `prisma migrate deploy` применил `0_init`,
  `20260724170000_add_ai_insights` и
  `20260724180000_add_round_configuration`; повторный status прошёл.
- Staging CRUD smoke через runtime transaction pooler (`:6543`) проверил
  create/read/update/delete, JSONB round configuration, AI-insights columns и
  cascade delete. Smoke выполнен транзакционно; финальные counts организаций,
  раундов, ответов и question answers равны `0`.
- Vercel Authentication с `deploymentType: preview` подтверждена чтением
  project settings. Неавторизованный запрос к новому Preview получает `302` на
  Vercel SSO.
- Vercel metadata подтверждает: `DATABASE_URL` имеет тип Sensitive и scope
  Preview; Production variables отсутствуют.
- Protected runtime smoke через Vercel bypass создал organization и round через
  `PUT /api/manager/setup/`, прочитал тот же round через `/api/rounds/`, затем
  удалил только уникальные smoke records. Повторная прямая проверка staging
  показывает `0` organizations, `0` rounds, `0` responses и `0` answers.
- Автоматически созданный CLI automation-bypass secret отозван после smoke с
  `regenerate: false`; повторная проверка показывает
  `automationBypassCount: 0`, а неавторизованный запрос по-прежнему получает
  `302` на Vercel SSO.
- Повторный authenticated smoke нового Preview: `/` → HTTP 200,
  `/api/rounds/` → HTTP 200 с `{"round":null}`.
- `npm test`: 70/70 тестов прошли.
- `npm run lint`: прошёл.
- `npm run build`: прошёл.
- `npx prisma validate` и `npx prisma generate`: прошли.
- `python3 ai-analytics-service/run_tests.py`: 7/7.
- Полный Python pytest в одноразовом virtualenv: 9/9.
- OpenAPI JSON и YAML валидны; integrity tests покрывают новые manager routes.
- Локальный runtime smoke без внешней БД: setup создал UUID/share code, server
  UI показал школу и `1/34`, 24 вопроса были выданы и приняты, analytics
  сохранил privacy lock.
- PR #6 `Build & Validate` и Vercel checks прошли; PR смержен в `main`.
- PR preview `/` показывает empty onboarding, `/api/rounds/` возвращает
  `{"round":null}`, `PUT /api/manager/setup/` без БД возвращает `503`.
- Предыдущий Vercel preview для empty-runtime fix: `READY`.
- Staging `/`: HTTP 200, содержит `0/0`, строка `18/34` отсутствует.
- Staging `/api/rounds/`: HTTP 200, ответ `{"round":null}`.
- Vercel check для draft PR #5: прошёл.

### Выравнивание legacy staging alias (session close, 2026-07-25)

- `vercel alias set` атомарно переназначил
  `shalomut-map-demo-ui-redesign.vercel.app` на
  `dpl_FjVVtXibnMwWRXHHAaPEW5wgj3bR`; повторный `vercel inspect` разрешил alias
  в тот же deployment с target `preview`, состоянием `READY`.
- Неавторизованный запрос к alias по-прежнему получает HTTP `302` на Vercel
  SSO; Deployment Protection не ослаблялась.
- Read-only protected runtime smoke через respondent API вернул round
  `80e78f3e-1240-42d4-8a9e-23a3467bb650`, privacy threshold `10` и 24
  обязательных вопроса. Отдельный read-only запрос к staging PostgreSQL
  подтвердил `12` сохранённых responses для того же round.
- Targeted privacy regression
  `npx tsx --test src/lib/services/__tests__/analytics.service.test.ts` прошёл
  `5/5`, включая unlock при `responseCount >= privacyThreshold`.
- Vercel CLI дважды создавал временный automation bypass для protected
  read-only smoke. Оба секрета сразу отозваны через Deployment Protection UI;
  финальное состояние — `0` automation bypass secrets.
- Автоматизированный manager UI smoke не выполнен: управляемая Chrome-вкладка
  вернула `ERR_BLOCKED_BY_CLIENT`, а CLI после Vercel protection достиг
  ожидаемого application Basic gate. Это browser/auth limitation проверки, а
  не доказанный runtime failure.
- До записи session-close handoff tracked repository не содержал code changes
  на application baseline `ace5ba8`; session-close diff затрагивает только
  `PROGRESS.md` и этот handoff.

### Manager UI browser-smoke и dashboard semantic audit (2026-07-25, local/read-only staging)

- Исторический `ERR_BLOCKED_BY_CLIENT` обойдён изолированным Playwright
  browser: локальный Next.js runtime читал ту же staging persistence без
  data writes.
- `/`, `/round/`, `/survey/`, `/dashboard/`, dimension detail, metrics и
  recommendations открылись. Карта корректно разблокировалась при `12`
  responses и privacy threshold `10`, показав все восемь canonical
  dimensions.
- `/setup/` воспроизводимо вернул HTTP `500`:
  `SetupForm` читает
  `round?.backgroundContext?.classesPerGrade[grade]`, но текущий legacy
  staging JSON равен `{"note": "Disposable E2E smoke round. Safe to delete."}`.
  Prisma mapper принимает любой object как полный `RoundBackgroundContext`,
  поэтому compile-time type скрывает partial persisted shape.
- Persisted AI payload прошёл structural contract, но провалил semantic audit:
  `0/4` non-green interpretations содержат требуемые два законченных
  предложения; `4/4` green dimensions всё равно получили improvement
  recommendations; все `11` recommendation titles не содержат Hebrew; все
  восемь metric sets являются одинаковым score/status/risk шаблоном.
- Локализованные причины: AI prompt получает только dimension score/status,
  provider adapter принимает любой non-empty HTTP `200` content без проверки
  `finish_reason`/полноты, safety validator проверяет только две green/red
  фразы, intervention store fallback игнорирует status, а UI повторяет общий
  organization summary в каждой dimension.
- Targeted
  `npx tsx --test src/lib/services/__tests__/manager-context.service.test.ts src/lib/services/__tests__/manager-setup.service.test.ts src/lib/__tests__/ai-insights-view-model.test.ts`
  прошёл `9/9`. Это подтверждает coverage gap, а не корректность найденных
  browser/content сценариев.
- Deployed Vercel SSO/Basic-auth browser chain не перепроверялся. Real webhook,
  callback write, staging mutation, deploy и alias change не выполнялись.
  Tracked worktree после проверки был чистым.

### Local setup regression fix и dashboard semantic RED (2026-07-25)

- Prisma read mapper нормализует partial persisted `backgroundContext` в полный
  безопасный domain shape; отсутствующий context остаётся `undefined`, а полный
  современный context сохраняет все известные поля. `SetupForm` дополнительно
  использует defensive read для `classesPerGrade`.
- Regression test сначала упал с actual `{note: ...}`, затем targeted
  repository/manager/setup/API suite прошёл `26/26`. До добавления следующего
  намеренного semantic RED slice полный TypeScript suite прошёл `91/91`, lint и
  production build прошли.
- Local Playwright с read-only staging persistence подтвердил HTTP `200` для
  `/setup/`, `/`, `/round/`, `/survey/` и `/dashboard/`. Setup показал
  безопасные defaults; console errors и data writes отсутствовали.
- Следующая versioned semantic boundary записана в
  `docs/dashboard-semantic-contract.md`. Новые executable RED tests дают
  TypeScript `91 passed / 10 failed` и Python `41 passed / 10 failed`; все
  failures относятся к отсутствующим question aggregates, strict output
  quality, grounded fallback, canonical metrics и single-summary behavior.
- Product semantics green зафиксирована как «חוזקה לשימור» с
  `פעולות לשימור`. Catalog slice удалил cross-status fallback, локализовал
  исходные `11` entries и добавил `8` green-only entries. Catalog pytest прошёл
  `6/6`, dependency-light suite — `13/13`.
- Staging data, migrations, Core/MCP runtime contract, real webhook, callback
  persistence, deployments и aliases не изменялись.

### Контейнеризация и protected-origin hardening AI-сервиса (сессия 2026-07-25, local)

- `python3 ai-analytics-service/run_tests.py`: 10/10.
- Полный Python pytest в venv: 10/10.
- Regression tests подтверждают, что опциональный Vercel bypass отправляется в
  MCP и callback только при явной настройке, а callback на origin, отличный от
  `DATA_LAYER_CALLBACK_URL`, отклоняется до transport и не получает credential.
- `npm test`: 70/70, `npx tsc --noEmit` и `npm run lint`: прошли.
- `docker build`: образ 266 МБ, запуск от непривилегированного `appuser`.
- Контейнерный smoke: `/health` → 200 с `env: production`; вебхук без
  настроенного секрета → 503; без заголовка и с неверным секретом → 401; с
  верным секретом конвейер доставил callback с `contractVersion 1.0`,
  `status success` и восемью каноническими измерениями.
- Параллельность измерена на заглушке 0.5s на измерение: последовательная
  стоимость 4.00s, фактически 0.51s.

### Manager gate и AI transport hardening (сессия 2026-07-25, local)

- Shared Basic credential закрывает manager surfaces вне local development;
  respondent routes, MCP и POST callback используют свои отдельные boundaries.
- Callback destination строится только от доверенного
  `DATA_LAYER_CALLBACK_URL`; webhook `callbackUrl` игнорируется, origin
  проверяется независимо от Vercel bypass.
- Direct analyze endpoint доступен только в development. Production/preview
  startup требует три shared secrets, non-local Data Layer URLs и
  `USE_MOCK_MCP=false`; webhook auth проверяется до readiness details.
- `python3 ai-analytics-service/run_tests.py`: 11/11.
- Полный Python pytest: 15/15; остаётся одно предупреждение совместимости
  Starlette `TestClient`/httpx.
- `npm test`: 78/78; `npx tsc --noEmit`, `npm run lint` и `npm run build`:
  прошли. Build сообщает предупреждение Next.js о будущей замене convention
  `middleware` на `proxy`.
- OpenAPI JSON/YAML успешно разобраны.
- Повторный Docker build был заблокирован выключенным локальным Docker daemon;
  staging/production runtime этой сессией не проверялся.

### Canonical POST routes и real staging E2E (сессия 2026-07-25)

- Первоначальная версия о несовпадающем `MCP_SHARED_SECRET` опровергнута:
  fingerprints Render/Vercel совпали. HTTP `401` возвращал Vercel Deployment
  Protection старого preview, а после смены origin точный runtime blocker
  воспроизвёлся как POST `308 Permanent Redirect`.
- Root cause: `next.config.ts` включает `trailingSlash: true`, а Python
  `urllib` не повторяет POST после `308`. MCP client теперь нормализует URL к
  одному конечному `/`, callback строится как `/ai-insights/`.
- Regression guards в `ai-analytics-service/run_tests.py` сначала получили
  фактические slashless URL и упали, затем прошли после минимального fix.
- Локально прошли: Python smoke 13/13, full pytest 15/15, TypeScript suite
  81/81, `npx tsc --noEmit`, `npm run lint`, `npm run build`,
  `git diff --check`.
- Render env использует production-alias core URLs; placeholder
  `VERCEL_PROTECTION_BYPASS` удалён, три machine-to-machine secret не
  изменялись и raw values не выводились.
- Vercel deployment `dpl_7FxfrtHYUdaKbD4AMVH6J7V4cx3j` — `READY`; Render
  deployment `dep-d9iamf3eo5us73cndcu0` — `Live`; оба относятся к
  `6473a88`.
- Real E2E: core trigger `202`; Vercel logs подтверждают POST `/api/mcp/`
  `200`, callback POST `/api/rounds/<roundId>/ai-insights/` `200` и GET
  persisted insights `200`; Render logs подтверждают webhook `200` и callback
  response `200`.
- Persisted result: `status: success`, `isLocked: false`, contract `1.0`,
  восемь canonical stones. Ни identity респондентов, ни individual results не
  выводились.
- Остаточный риск: четыре OpenAI-вызова получили `429`; pipeline использовал
  предусмотренный heuristic fallback. Это не отменяет transport/persistence
  evidence, но не доказывает real LLM generation.

### Read-only диагностика OpenAI `429` (сессия 2026-07-25)

- Render logs подтвердили точную последовательность: четыре green dimensions
  были обработаны без LLM, четыре non-green dimensions стартовали параллельно и
  получили `429`.
- OpenAI Platform для текущей API-организации показывает активный ключ
  `Shalomut`, отсутствие успешного usage и предложение добавить API credits.
  Корневая причина текущего инцидента — недоступная API quota/billing, а не
  доказанный transient RPM/TPM rate limit.
- Код `LLMProviderService` перехватывает общий `Exception` и пишет только
  `HTTP Error 429`, не сохраняя безопасные `error.type`, `error.code`, request
  ID или rate-limit headers. Поэтому причина не могла быть установлена только
  по исходным Render logs.
- OpenAI key, billing, limits, Render environment и deployments не менялись.
  ChatGPT subscription не является балансом OpenAI API.

### Gemini provider, bounded retry и real LLM E2E (сессия 2026-07-25)

- Provider теперь определяется по имени provider-specific credential
  (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`), а
  provider-neutral `LLM_API_KEY` вне development требует явного
  `LLM_PROVIDER` или `LLM_BASE_URL`.
- Safe observability различает `outcome=llm`, `outcome=retry` и
  `outcome=heuristic`, не логируя ключи, prompts, responses или respondent
  data. Known hard-quota ошибки не ретраятся; transient `408`, `429`, `5xx` и
  transport timeouts используют bounded retry/backoff.
- Один provider request ограничен `20s`; полный цикл одного измерения —
  `25s`; новый retry начинается только если остаётся не менее `8s`. Это
  оставляет время MCP/callback внутри core timeout `30s`.
- TDD и full local verification: Python pytest 35/35, dependency-light suite
  13/13, TypeScript suite 81/81, lint и production build прошли.
- Commit `a9b6c34` развёрнут на Render как
  `dep-d9ibutgk1i2s73b2oolg` (`Live`). Health и MCP preflight прошли.
- Ровно один подтверждённый webhook дал четыре Gemini
  `outcome=llm`, все `attempt=1`, без retry и heuristic fallback; trigger
  вернул `202`, callback — `200`, persisted GET — `200`.
- Provider key не добавлялся в tracked repository; raw credential values в
  verification evidence и документацию не выводились.

### Organization-scoped manager boundary (session close, local)

- `MANAGER_ORGANIZATION_ID` связывает shared Basic credential с одной
  persisted organization. Middleware заменяет любой клиентский scope header
  server-owned значением.
- Manager context, round reads/writes, survey definition, analytics,
  AI-insights GET и AI trigger проверяют organization ownership; foreign
  resources возвращают `404`. Dashboard больше не принимает client-controlled
  `roundId` из query string.
- Respondent routes и machine-authenticated MCP/callback endpoints не получают
  manager scope и сохраняют свои отдельные auth boundaries.
- OpenAPI JSON/YAML синхронизированы. Local TypeScript suite 90/90, lint и
  production build прошли; build сохранил только существующее предупреждение
  Next.js `middleware` → `proxy`.
- Read-only staging lookup подтвердил одну organization и один round. Local
  runtime smoke со staging persistence вернул configured organization/round и
  проигнорировал поддельный client organization header.
- `MANAGER_ORGANIZATION_ID` настроен в точном Vercel project для Preview и
  Production. Post-merge deployed smoke подтвердил anonymous `401`,
  authenticated `200`, configured organization/round и игнорирование
  поддельного client organization header.

## Что завершено

### Безопасная staging persistence

- Выделенный Supabase staging project создан отдельно от production/shared
  target.
- Миграционная история полностью применена и проверена как up to date.
- Runtime pooler и migration pooler проверены; staging после CRUD smoke остался
  пустым.
- Проект работает на Free plan без backups/PITR. Пока он пуст и disposable,
  согласованный rollback — удалить и пересоздать только staging project.

### Protected staging runtime

- Preview deployments закрыты Vercel Authentication; unauthenticated manager
  writes не доступны.
- Shared Basic credential и `MANAGER_ORGANIZATION_ID` теперь настроены для
  Preview/Production и привязаны к одной staging organization. READY deployment
  `dpl_Hb1WZR9hHdUKsWhJdXDXDMS8ExPe` использует этот scope; read-only smoke
  прошёл.
- Protected Preview сохраняет отдельную staging persistence; текущий
  production alias также временно подключён к той же выделенной staging-БД для
  Render E2E и требует последующего разведения environments.
- Новый Preview имеет target `preview`, проходит authenticated read/write/read
  smoke и после cleanup оставляет staging пустым.
- Временный project-wide automation bypass после проверки отозван; постоянного
  bypass secret не оставлено.
- Отдельно от protected preview текущий production alias используется как
  staging core endpoint для Render E2E; разделение staging/production aliases
  остаётся открытым operational решением.

### Data Layer и API

- Есть PostgreSQL/Supabase schema и Prisma repositories для организаций,
  раундов, анонимных ответов, ответов на вопросы и сохранённых AI insights.
- Реализованы endpoints раундов, отправки опроса, analytics, MCP, webhook trigger
  и AI-insights callback.
- Session-close manager-scope slice удаляет клиентский scope header в
  middleware, добавляет server-owned organization ID и проверяет ownership во
  всех manager round routes. Respondent routes и MCP/callback сохраняют свои
  отдельные auth boundaries.
- Privacy lock применяется до возврата детальной аналитики.
- Анонимные ответы не содержат имён или email респондентов.

### AI analytics

- Сервис упакован в container image и развёрнут на Render (корневой
  `Dockerfile`, `render.yaml`);
  интерпретации измерений считаются параллельно, `ENV` fail-closed, core app
  ограничивает ожидание вебхука `AI_SERVICE_TIMEOUT_MS` и отвечает `504`.
- Для protected Vercel core app сервис умеет явно передавать
  `VERCEL_PROTECTION_BYPASS` в обоих исходящих вызовах. Callback target всегда
  строится от `DATA_LAYER_CALLBACK_URL`, входной `callbackUrl` не управляет
  transport, а credential не отправляется за пределы доверенного origin.
- Direct analyze endpoint ограничен development; production/preview
  configuration проходит fail-closed startup validation.
- PR #4 смержен в `main`.
- Deployed runtime сохраняет immutable `contracts/ai-analytics-v1.json` и
  добавляет `contracts/ai-analytics-v2.json`; validators совместимы с обеими
  версиями.
- Реализованы callback validation, Prisma persistence, fail-closed transport и
  отдельные dashboard states.
- Локальные Next.js → Python → callback tests и реальный
  Vercel → Render → Vercel transport/persistence E2E проходят.

### Изоляция AI persistence

- `aiInsights` и `aiInsightsUpdatedAt` принадлежат конкретной строке
  `SurveyRound`; сохранение и чтение выполняются по уникальному `roundId`.
- Callback validation требует совпадения `roundId` в route и payload, поэтому
  payload одного раунда нельзя случайно сохранить по route другого.
- Локальный исполняемый сценарий с двумя раундами школы A и одним раундом
  школы B подтвердил, что повторная запись A2 сохраняет A1 и B1 без изменений.
- Targeted repository/API tests прошли 15/15; полный TypeScript suite — 81/81;
  `npx prisma validate`, lint и production build прошли.
- Это доказательство изоляции хранения, а не полноценной tenant security.
  Manager scope закрывает автоматический глобальный выбор школы и
  query-controlled dashboard round; `2.0` MCP удаляет прежний
  hardcoded `organizationContext`.

### Пустой runtime

- Пустая или недоступная persistence больше не подменяется fake школой или
  раундом.
- Staging возвращает пустое API-состояние и нулевые manager counters.

### Database-backed manager UI

- `ManagerContextService` выбирает текущий раунд и возвращает organization,
  aggregate response count, privacy state и analytics.
- Home, setup, round tracking, dashboard и dimension pages читают этот context;
  пустая БД показывает отдельные states «нет школы» и «нет раунда».
- Setup сохраняет organization, round dates, threshold и background context.
- Survey builder сохраняет exact definition; 24 канонических вопроса остаются
  начальным default template, но ID/text/dimension/count могут меняться до
  первого accepted response.
- Respondent route использует настоящий share code, а submit валидируется
  против сохранённого definition и использует анонимный per-round token hash.
- Закрытие раунда сохраняет status через API; сетевые ошибки больше не
  маскируются success-состоянием.
- Static export/GitHub Pages удалены; приложение переведено на Next.js server
  runtime.
- Локальный in-memory fallback разделяется между Route Handlers и Server
  Components; deployed runtime без `DATABASE_URL` отвечает `503` на writes.

## Что не завершено

### 1. Dynamic questionnaire `3.0` staging evidence

- Consumer-first deployment завершён, но существующий persisted staging round
  использует canonical 24. Нужен отдельный real custom-questionnaire
  provider → callback → persistence E2E и отдельный privacy-locked round.
- Это evidence требует bounded approval; automatic dimension classification и
  изменение privacy semantics не разрешены без отдельного продуктового решения.

### 2. Dashboard semantic staging evidence

- Contract/Core/Python/Dashboard semantics `3.0` развёрнуты consumer-first на
  Core и Render. Immutable `1.0`/`2.0` сохранены как compatibility/rollback
  boundaries.
- Real staging webhook/callback после rollout не запускался: persisted payload
  всё ещё может быть историческим `1.0`. Для нового unlocked/locked `3.0`
  evidence нужен отдельный exact round/environment approval.

### 3. Application-level manager authentication

- Shared Basic gate теперь связывает один deployment credential с одной
  настроенной организацией, но по-прежнему не идентифицирует конкретного
  менеджера, не поддерживает roles и не является полноценной multi-tenant
  authorization.
- Для публичного rollout всё ещё нужны application-level authentication,
  roles/organization authorization, audit boundary и isolation tests.
- **Blocker (проверено на живом `shalomut-map-demo.vercel.app`, 2026-07-26):**
  `/login/` отдаёт `401` вместо страницы входа. При `trailingSlash: true`
  реальный путь — `/login/`, а `middleware.ts` сравнивает `pathname === "/login"`,
  поэтому страница не попадает в публичный bypass и упирается в Basic Auth.
  `/api/auth/*` не затронуты (`startsWith` устойчив к слэшу): `GET /api/auth/me`
  отвечает `200 {"authenticated":false}`. Включение
  `DISABLE_BASIC_AUTH_FALLBACK` до исправления заблокирует доступ полностью:
  middleware редиректит на `/login`, который затем `308` → `/login/` → `401`.
- **Blocker (security, проверено read-only):** в Vercel не заданы
  `SESSION_SECRET`, `MANAGER_ADMIN_EMAIL` и `MANAGER_ADMIN_PASSWORD`, поэтому
  рантайм использует hardcoded дефолты из публичного репозитория
  (`jwt-session-provider.ts`, `manager-auth-service.ts`), а `/api/auth/login`
  доступен вне Basic Auth (`POST` с пустым телом отвечает `400`, не `401`).
  Успешная сессия обходит Basic gate в `middleware.ts`. Эксплуатация не
  выполнялась; до задания секретов и удаления дефолтных credential-fallback
  deployment нельзя считать защищённым.

### 4. Deployed AI provenance и privacy-locked runtime

- Real Gemini generation, transport и persistence доказаны для одного
  explicitly approved unlocked `1.0` round. Развёрнутый `3.0` сохраняет
  provenance, но real staging webhook/callback после rollout не запускался,
  поэтому persisted `3.0` evidence пока отсутствует.
- Locked behavior доказано unit/integration tests и локальным browser/API
  runtime; отдельный реальный staging privacy-locked round после consumer-first
  deploy не проверялся.
- Любое изменение key, billing, limits или provider configuration и следующий
  webhook по-прежнему требуют отдельного bounded approval.

### 5. Staging/production boundary

- Legacy staging alias выровнен с Git tree текущего `main` и указывает на
  protected Preview, а production alias по-прежнему временно используется как
  staging core endpoint для Render.
- Перед production rollout нужно явно развести aliases/env, повторно проверить
  target DB и не считать текущую конфигурацию production-ready.

## Рекомендуемый порядок продолжения

1. С отдельным bounded approval выполнить точные
   unlocked и privacy-locked staging E2E, включая persisted provenance, exact
   custom questions и пустые locked maps. Не использовать production data.
2. Заменить organization-scoped shared Basic gate на application-level manager
   identity/roles и полноценную tenant authorization; передавать реальный
   organization context в MCP payload.
3. Согласовать окончательное разделение staging/production aliases и env;
   текущий legacy staging alias уже выровнен по Git tree, но production alias
   всё ещё используется как staging core endpoint. Production
   data/env/alias/deployment не затрагивать без нового bounded approval.

## Approval gates

- Не изменять production data, secrets, aliases или deployments без явного
  ограниченного подтверждения.
- Следующий core deployment, alias mutation или write-smoke требуют отдельного
  bounded approval; persisted data не менять без дополнительного разрешения.
- Следующий push/deployment после session close снова требует bounded approval.
  Текущий consumer-first rollout завершён, но это не равно production
  readiness без manager authorization и разделения aliases/env.
- Не изменять provider key, billing, limits или provider configuration без
  отдельного bounded approval.
- Не запускать следующий real webhook без явно выбранных environment и round;
  завершённое подтверждение покрывало только round
  `80e78f3e-1240-42d4-8a9e-23a3467bb650`.
- Не применять migrations к другой БД, пока не подтверждены environment и
  rollback/PITR path.
- Не хранить недиспозабельные staging data на текущем Free project без
  отдельного backup/PITR решения.
- Никогда не раскрывать личность респондента или детальные результаты ниже
  настроенного privacy threshold.
