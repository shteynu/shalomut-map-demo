# Shalomut Tracker — актуальный handoff

Обновлено: 2026-07-25

Это оперативная точка входа для перехода от исходного статического demo
Shalomut Map к `shalomut-tracker`, где сохранённые данные должны быть единственным
источником runtime-состояния. Методология продукта остаётся канонической в
`src/lib/shalomut-source.ts`; визуальные mock-данные изолированы в
`src/lib/demo-data.ts`.

## Текущий snapshot

- Активная ветка: `main`.
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
- `DATABASE_URL` staging сохранён в Vercel как Sensitive variable только для
  Preview. В Production project environment variables отсутствуют;
  `DIRECT_URL` в Vercel не добавлялся.
- Исходный Supabase project ref `fvnulyirrqjrnjbahmsn` подтверждён Dashboard как
  `main / Production` и в этой сессии не изменялся.
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
- Protected-preview операция не выполняла production promotion и не меняла
  production env/aliases. Последний проверенный перед session-close merge
  Git-connected production deployment `dpl_3PmjUaFv8xEdS1WAEWq9U3CwKa9b`
  автоматически собран из `origin/main` commit `ed7b44d` и имеет состояние
  `READY`; production project env vars отсутствуют.
- Commit `ed7b44d` с поддержкой protected Vercel core app находится в
  `origin/main`. Session-close update сохраняет operational docs и исключает
  локальную `ai-analytics-service/.venv` из IDE-индексации.
- Deployment AI-сервиса по-прежнему не создавался.

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
- Только Preview получает Sensitive `DATABASE_URL` выделенной staging-БД.
- Новый Preview имеет target `preview`, проходит authenticated read/write/read
  smoke и после cleanup оставляет staging пустым.
- Временный project-wide automation bypass после проверки отозван; постоянного
  bypass secret не оставлено.
- Production environment variables и production aliases в этой операции не
  изменялись.

### Data Layer и API

- Есть PostgreSQL/Supabase schema и Prisma repositories для организаций,
  раундов, анонимных ответов, ответов на вопросы и сохранённых AI insights.
- Реализованы endpoints раундов, отправки опроса, analytics, MCP, webhook trigger
  и AI-insights callback.
- Privacy lock применяется до возврата детальной аналитики.
- Анонимные ответы не содержат имён или email респондентов.

### AI analytics

- Сервис упакован в container image (корневой `Dockerfile`, `render.yaml`);
  интерпретации измерений считаются параллельно, `ENV` fail-closed, core app
  ограничивает ожидание вебхука `AI_SERVICE_TIMEOUT_MS` и отвечает `504`.
- Для protected Vercel core app сервис умеет явно передавать
  `VERCEL_PROTECTION_BYPASS` в обоих исходящих вызовах. Credential не
  отправляется callback-хосту за пределами настроенного Data Layer origin;
  callback URL не логируется.
- PR #4 смержен в `main`.
- TypeScript и Python используют общий versioned contract
  `contracts/ai-analytics-v1.json`.
- Реализованы callback validation, Prisma persistence, fail-closed transport и
  отдельные dashboard states.
- Локальные Next.js → Python → callback E2E и тесты Python-сервиса проходят.

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

- Manager write routes сейчас не привязаны к аутентифицированной организации.
- Protected Preview безопасно закрывает текущий staging slice, но для
  публичного rollout всё ещё нужны application-level authentication,
  organization authorization и isolation tests.

### 2. Реальный staging AI service

- Container image собирается и проверен локально, но нигде не задеплоен: ни
  Cloud Run service, ни Render service не создавались.
- Shared secrets и URLs не настроены; реальный webhook → MCP → callback E2E не
  выполнялся.
- Постоянного Vercel automation bypass сейчас нет (`automationBypassCount: 0`).
  Создание отдельного runtime credential для AI-сервиса или настройка другого
  trusted access требует нового bounded approval; при использовании bypass
  callback обязан оставаться на origin `DATA_LAYER_CALLBACK_URL`.
- Реальный LLM-путь не проверялся: без `OPENAI_API_KEY` конвейер идёт по
  эвристическому fallback.

### 3. Alias и production

- Staging alias остаётся на последнем безопасном empty-runtime preview.
- Новый protected Preview проверен, но переназначение staging alias требует
  отдельного ограниченного подтверждения. Production promotion остаётся
  отдельным approval gate.

## Рекомендуемый порядок продолжения

1. Добавить application-level manager authentication, organization
   authorization и isolation tests до публичного rollout.
2. После отдельного approval создать runtime-доступ к protected Preview,
   задеплоить container image AI-сервиса на Cloud Run (или Render), настроить
   URLs/secrets на обеих сторонах и выполнить полный staging E2E.
3. Отдельно согласовать переназначение staging alias на проверенный protected
   Preview.
4. Production data/env/alias/deployment не затрагивать без нового bounded
   approval.

## Approval gates

- Не изменять production data, secrets, aliases или deployments без явного
  ограниченного подтверждения.
- Не применять migrations к другой БД, пока не подтверждены environment и
  rollback/PITR path.
- Не хранить недиспозабельные staging data на текущем Free project без
  отдельного backup/PITR решения.
- Никогда не раскрывать личность респондента или детальные результаты ниже
  настроенного privacy threshold.
