# Shalomut Tracker — актуальный handoff

Обновлено: 2026-07-25

Это оперативная точка входа для перехода от исходного статического demo
Shalomut Map к `shalomut-tracker`, где сохранённые данные должны быть единственным
источником runtime-состояния. Методология продукта остаётся канонической в
`src/lib/shalomut-source.ts`; визуальные mock-данные изолированы в
`src/lib/demo-data.ts`.

## Текущий snapshot

- Активная ветка: `main`.
- `origin/main` содержит commit `6473a88`, который добавляет canonical trailing
  slash для MCP и callback POST routes. Локальный `main` содержит поверх него
  только session-memory close commit; новый push не выполняется, потому что он
  снова запустит production deployments.
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
- Исходный Supabase project ref `fvnulyirrqjrnjbahmsn` подтверждён Dashboard как
  `main / Production` и не изменялся.
- Staging:
  [shalomut-map-demo-ui-redesign.vercel.app](https://shalomut-map-demo-ui-redesign.vercel.app/).
- Staging deployment: `dpl_35S9VvwN8V9Bq7da3iP2SJwT4349`, состояние `READY`,
  source commit `a20ac66`.
- Новый protected Preview со staging persistence:
  `dpl_E7pQnJXMDHzoeeMQa5hWskxicCLz`, состояние `READY`, target `preview`, URL
  `https://shalomut-map-demo-3b0szbymo-shteynumaks-1343s-projects.vercel.app`.
  Он собран из чистого Git snapshot без локальных незакоммиченных файлов.
- Финальный PR #6 preview: `dpl_3KrHd5nbcvqdnSAup2sY1L1jjzmT`, состояние
  `READY`,
  URL
  `https://shalomut-map-demo-16cvkgov9-shteynumaks-1343s-projects.vercel.app`.
- Текущий Vercel production deployment
  `dpl_7FxfrtHYUdaKbD4AMVH6J7V4cx3j` автоматически собран из commit `6473a88`,
  имеет состояние `READY` и обслуживает production alias.
- AI-сервис развёрнут на Render:
  `https://shalomut-ai-analytics.onrender.com`. Deployment
  `dep-d9iamf3eo5us73cndcu0` собран из commit `6473a88`, имеет состояние `Live`;
  `/health` отвечает HTTP 200 с `env: production`.
- Разрешённый real E2E для round
  `80e78f3e-1240-42d4-8a9e-23a3467bb650` завершён: trigger `202`, MCP `200`,
  Render webhook `200`, callback `200`, persisted GET `200`; сохранён payload
  contract `1.0` с восемью canonical stones.
- Real LLM path остаётся частично недоказанным: четыре запроса к OpenAI получили
  `429 Too Many Requests`, после чего сервис штатно использовал domain
  heuristic fallback.

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
- Manager UI/API на текущем deployment дополнительно закрыты shared Basic
  credential. Эта защита не заменяет identity/org authorization.
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
- TypeScript и Python используют общий versioned contract
  `contracts/ai-analytics-v1.json`.
- Реализованы callback validation, Prisma persistence, fail-closed transport и
  отдельные dashboard states.
- Локальные Next.js → Python → callback tests и реальный
  Vercel → Render → Vercel transport/persistence E2E проходят.

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
- Survey builder сохраняет definition; 24 канонических вопроса остаются
  обязательными и включёнными.
- Respondent route использует настоящий share code, а submit валидируется
  против сохранённого definition и использует анонимный per-round token hash.
- Закрытие раунда сохраняет status через API; сетевые ошибки больше не
  маскируются success-состоянием.
- Static export/GitHub Pages удалены; приложение переведено на Next.js server
  runtime.
- Локальный in-memory fallback разделяется между Route Handlers и Server
  Components; deployed runtime без `DATABASE_URL` отвечает `503` на writes.

## Что не завершено

### 1. Application-level manager authentication

- Shared Basic gate закрывает manager routes одним deployment credential, но
  не идентифицирует менеджера и не привязывает запрос к организации.
- Для публичного rollout всё ещё нужны application-level authentication,
  roles/organization authorization, audit boundary и isolation tests.

### 2. Real LLM provider path

- Runtime transport и persistence E2E доказаны, но OpenAI вернул четыре
  `429 Too Many Requests`; результат был сформирован через domain heuristic
  fallback.
- Следующая проверка должна сначала read-only локализовать quota/rate-limit
  причину. Изменение key, billing, limits или provider configuration требует
  отдельного bounded approval.

### 3. Staging/production boundary

- Legacy staging alias остаётся на проверенном empty-runtime preview, а
  production alias временно используется как staging core endpoint для Render.
- Перед production rollout нужно явно развести aliases/env, повторно проверить
  target DB и не считать текущую конфигурацию production-ready.

## Рекомендуемый порядок продолжения

1. Read-only проверить OpenAI quota/rate-limit evidence для четырёх `429`.
2. После отдельного approval на нужную provider mutation повторить один
   явно выбранный round E2E и доказать LLM path без fallback.
3. Отдельным малым PR ввести строгие Pydantic/request/output/privacy contracts
   и явные fail-closed safety semantics внутри AI-сервиса.
4. Заменить shared Basic gate на application-level manager identity,
   organization authorization и isolation tests.
5. Согласовать окончательное разделение staging/production aliases и env;
   production data/env/alias/deployment не затрагивать без нового bounded
   approval.

## Approval gates

- Не изменять production data, secrets, aliases или deployments без явного
  ограниченного подтверждения.
- Не изменять OpenAI key, billing, limits или provider configuration без
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
