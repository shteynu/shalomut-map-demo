# Shalomut Tracker — актуальный handoff

Обновлено: 2026-07-24

Это оперативная точка входа для перехода от исходного статического demo
Shalomut Map к `shalomut-tracker`, где сохранённые данные должны быть единственным
источником runtime-состояния. Методология продукта остаётся канонической в
`src/lib/shalomut-source.ts`; визуальные mock-данные изолированы в
`src/lib/demo-data.ts`.

## Текущий snapshot

- Базовая ветка: `main`, merge commit `19401a6` (PR #4, AI analytics).
- Активная fix-ветка: `agent/empty-runtime-repositories`.
- Commit исправления: `a20ac66`
  (`fix: keep empty databases free of demo records`).
- Draft pull request: [#5](https://github.com/shteynu/shalomut-map-demo/pull/5).
- Рабочее дерево перед этим обновлением документации: чистое.
- Staging:
  [shalomut-map-demo-ui-redesign.vercel.app](https://shalomut-map-demo-ui-redesign.vercel.app/).
- Staging deployment: `dpl_35S9VvwN8V9Bq7da3iP2SJwT4349`, состояние `READY`,
  source commit `a20ac66`.
- Production alias не изменялся.

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

- `npm test`: 53/53 теста прошли.
- `npm run lint`: прошёл.
- `npm run build`: прошёл.
- GitHub `Build & Validate`: прошёл.
- Vercel preview: `READY`.
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

## Что не завершено

Staging уже защищён от fake-записей, но manager UI пока не является полностью
database-driven.

### 1. Merge и deployment lifecycle

- PR #5 остаётся draft и ещё не смержен в `main`.
- Staging alias сейчас указывает прямо на PR preview, а не на новый deployment
  ветки `main`.
- Production ещё не получил это исправление.

### 2. Manager UI всё ещё использует visual mock data

Главная, setup, round tracking, survey builder и части dashboard продолжают
импортировать `src/lib/demo-data.ts`. Значения `0/0`, общее имя школы, privacy
threshold, расположение map и locked dashboard сейчас являются статическими
mock values, а не живым чтением PostgreSQL.

Следующий обязательный slice:

- добавить database-backed manager view model для organization, current round,
  response count, threshold и analytics status;
- показывать отдельный onboarding state, если нет организации или раунда;
- передавать реальные round IDs через home, tracking, dashboard и respondent
  links;
- оставить в mock layer только геометрию камней и визуальные metadata, не
  являющиеся записями БД.

### 3. Контракт current-round API не завершён

`GET /api/rounds` всё ещё ищет исторический фиксированный ID `round_demo_1`.
Production contract должен явно делать одно из двух:

- возвращать список раундов аутентифицированной организации; или
- возвращать последний/текущий раунд этой организации.

До выбора варианта нужно определить organization/authentication context.

### 4. Demo identifiers остаются в runtime paths

Static params и survey submission всё ещё используют `SHALOM-DEMO`,
`round_demo_1` и другие demo-only ID. Их нужно удалить из production runtime
или изолировать за явным static-demo/export mode.

### 5. Persistence setup и survey builder

Manager forms пока используют локальный React state. Сохранение setup или
builder ещё не создаёт и не обновляет persisted organization/round end to end.

### 6. Реальный staging AI service

- Python AI service не развёрнут в подтверждённом staging runtime.
- Совпадающие Vercel/AI shared secrets ещё не настроены и не проверены.
- Реальный staging round-close → webhook → MCP → callback smoke test не
  выполнялся.
- Владелец и назначение текущего Supabase target
  (staging или shared/production) требуют явного подтверждения.

## Рекомендуемый порядок продолжения

1. Провести review и merge PR #5 в `main`.
2. Переназначить staging на получившийся проверенный `main` deployment.
3. Определить правила выбора organization/current round и authentication
   assumptions.
4. Реализовать database-backed manager home и настоящие onboarding states
   «нет организации» / «нет раунда».
5. Персистить setup и survey-builder; заменить demo share codes и round IDs в
   respondent flows.
6. Подключить round и dashboard routes к реальным response counts и analytics.
7. Подтвердить staging Supabase target, развернуть Python service, настроить
   shared secrets и провести полный staging E2E.
8. Продвигать в production только после отдельного подтверждения и
   зафиксированных smoke-test evidence.

## Approval gates

- Не изменять production data, secrets, aliases или deployments без явного
  ограниченного подтверждения.
- Не применять migrations к другой БД, пока не подтверждены environment и
  rollback/PITR path.
- Никогда не раскрывать личность респондента или детальные результаты ниже
  настроенного privacy threshold.
