# Shalomut Tracker — актуальный handoff

Обновлено: 2026-07-24

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
- Новая миграция `20260724180000_add_round_configuration` создана, но не
  применена ни к одной внешней БД.
- Staging:
  [shalomut-map-demo-ui-redesign.vercel.app](https://shalomut-map-demo-ui-redesign.vercel.app/).
- Staging deployment: `dpl_35S9VvwN8V9Bq7da3iP2SJwT4349`, состояние `READY`,
  source commit `a20ac66`.
- Финальный PR #6 preview: `dpl_3KrHd5nbcvqdnSAup2sY1L1jjzmT`, состояние
  `READY`,
  URL
  `https://shalomut-map-demo-16cvkgov9-shteynumaks-1343s-projects.vercel.app`.
- Production data, alias и deployment не изменялись.

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

## Что завершено

### Data Layer и API

- Есть PostgreSQL/Supabase schema и Prisma repositories для организаций,
  раундов, анонимных ответов, ответов на вопросы и сохранённых AI insights.
- Реализованы endpoints раундов, отправки опроса, analytics, MCP, webhook trigger
  и AI-insights callback.
- Privacy lock применяется до возврата детальной аналитики.
- Анонимные ответы не содержат имён или email респондентов.

### AI analytics

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

### 1. Безопасная staging persistence

- В Vercel Preview/Production нет env vars.
- Единственный обнаруженный локальный Supabase project ref ранее использовался
  как production/shared; применять к нему новую migration без подтверждения
  нельзя.
- Нужна выделенная staging Supabase с PITR/rollback path, после чего можно
  применить `20260724180000_add_round_configuration` и проверить CRUD.

### 2. Manager authentication

- Manager write routes сейчас не привязаны к аутентифицированной организации.
- До публичного подключения реальной БД нужно добавить authentication/
  authorization либо закрыть preview через Vercel Deployment Protection.

### 3. Реальный staging AI service

- В Vercel team нет отдельного project для `ai-analytics-service`.
- Python entrypoint и runtime manifests готовы, но deployment не создавался.
- Shared secrets и URLs не настроены; реальный webhook → MCP → callback E2E не
  выполнялся.

### 4. Alias и production

- Staging alias остаётся на последнем безопасном empty-runtime preview.
- Переназначение alias допустимо после миграции, access protection и smoke
  evidence. Production требует отдельного подтверждения.

## Рекомендуемый порядок продолжения

1. Получить подтверждение выделенной staging Supabase и применить новую
   migration только к ней.
2. Добавить manager auth/deployment protection.
3. Создать staging AI Vercel project, настроить URLs/secrets и выполнить полный
   staging E2E.
4. После evidence отдельно согласовать staging alias; production не затрагивать.

## Approval gates

- Не изменять production data, secrets, aliases или deployments без явного
  ограниченного подтверждения.
- Не применять migrations к другой БД, пока не подтверждены environment и
  rollback/PITR path.
- Никогда не раскрывать личность респондента или детальные результаты ниже
  настроенного privacy threshold.
