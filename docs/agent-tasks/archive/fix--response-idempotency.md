# PR 2 — идемпотентность ответа в PostgreSQL

## Metadata

- Branch: `fix/response-idempotency`
- Base branch: `main`
- Base commit: `cb8bed3`
- Merged as: PR #16, squash commit `8c43385`
- Status: закрыто и заархивировано
- Last updated: 2026-08-01
- Last agent/tool: Claude Code (Opus 5)

## Objective

Закрыть P0 из плана v4: защита от двойной отправки жила в сервисе
(`hasTokenSubmitted()` перед `create()`), что два параллельных запроса проходят
одновременно. Перенести отказ в БД и не отдавать 500 проигравшему.

## User-visible outcome

Два одновременных запроса одной сессии заполнения дают один ответ. Проигравший
получает то же сообщение «уже отправлено», что и при обычной повторной отправке,
а не ошибку сервера. Раньше аналитика раунда могла посчитать один и тот же
опрос дважды.

## Context

- Порядок работ и правки C1, C2, C6, C8 — в
  `docs/wellbeing-refactoring-plan-v4-review.md`.
- Токен — случайный UUID на одну сессию заполнения
  (`src/lib/survey-attempt-token.ts:18`), не идентификация респондента.

## Scope

- Unique-индексы и индексы по FK в `prisma/schema.prisma` + миграция.
- Маппинг `P2002` в доменную `DuplicateResponseError` и в стабильный ответ.
- Тесты против настоящего PostgreSQL + unit-тесты маппинга.
- PostgreSQL-сервис в CI и скрипт `verify:db`.

## Non-goals

- Durable AI jobs — PR 3.
- Fail-closed producer version и health endpoint — PR 2.5.
- Contract Registry — этап C.

## Acceptance criteria

- Два параллельных submission создают один response. ✅
- Один response не содержит два ответа на один `questionId`. ✅
- Unique violation отдаётся как «already submitted», без деталей БД. ✅
- In-memory и Prisma отвечают на дубль одинаково. ✅
- PostgreSQL-suite реально выполняется в pull request. ✅

## Decisions made

- **Токен остаётся необязательным** (решение владельца): обычный
  `@@unique([roundId, anonymousTokenHash])`. PostgreSQL считает NULL
  различными, поэтому partial unique index не нужен, а безтокенные отправки
  ведут себя как раньше. Это закреплено отдельным тестом, чтобы никто не
  «починил» индекс в сторону «один ответ на раунд».
- **Транзакцию не трогал**: вложенный `create` Prisma и так одна транзакция.
  Правка C2 ревью — добавлен только constraint и маппинг ошибки.
- **Миграция сначала удаляет дубликаты**, оставляя самую раннюю строку, иначе
  `migrate deploy` упал бы на окружении, которое их накопило (правка C8).
- **DB-тесты вынесены из `__tests__`** в `src/lib/repositories/__dbtests__/`,
  чтобы `npm test` оставался запускаемым без базы. Их запускает `verify:db`.
- **`verify:db` не читает `.env`**: цель берётся из `TEST_DATABASE_URL` и по
  умолчанию указывает на compose-контейнер. Скрипт отказывается работать против
  managed-хоста, потому что чистит базу между тестами.

## Assumptions

- Локальная БД расходная, отдельная база `shalomut_test` создаётся вручную один
  раз; это описано в `docs/local-environment.md`.

## Completed

- `prisma/schema.prisma`: `@@unique([roundId, anonymousTokenHash])`,
  `@@index([roundId, submittedAt])`, `@@unique([responseId, questionId])`,
  `@@index([responseId])`.
- Миграция `20260730120000_add_response_idempotency_constraints` — дедупликация
  плюс четыре индекса. Применена к тестовой БД, дрейфа против схемы нет.
- `src/lib/repositories/errors.ts` — `DuplicateResponseError`.
- `PrismaSurveyRepository.saveResponse` распознаёт `P2002` и бросает доменную
  ошибку; `InMemorySurveyRepository` делает то же для паритета контракта.
- `SurveyService.submitAndSaveResponse` отвечает на проигранную гонку тем же
  `ALREADY_SUBMITTED_ERROR`, что и pre-check.
- Шесть тестов против настоящего PostgreSQL в
  `src/lib/repositories/__dbtests__/postgres-concurrency.test.ts`.
- Шесть unit-тестов маппинга ошибки в
  `src/lib/repositories/__tests__/duplicate-response-mapping.test.ts`.
- `scripts/verify-db.mjs` + скрипт `verify:db`, включённый в `verify`.
- PostgreSQL service и `TEST_DATABASE_URL` в
  `.github/workflows/deploy-vercel.yml`.
- `docs/local-environment.md` — как завести тестовую базу.

## In progress

Ничего.

## Remaining

- Коммит и push (push — действие владельца).
- Миграцию к рабочей локальной БД и к deployed БД владелец применяет отдельно.

## Changed files

Всё unstaged. Изменены: `.github/workflows/deploy-vercel.yml`,
`docs/local-environment.md`, `package.json`, `prisma/schema.prisma`,
`src/lib/repositories/in-memory/in-memory-survey.repository.ts`,
`src/lib/repositories/prisma/prisma-survey.repository.ts`,
`src/lib/services/survey.service.ts`. Новые:
`prisma/migrations/20260730120000_add_response_idempotency_constraints/`,
`scripts/verify-db.mjs`, `src/lib/repositories/__dbtests__/`,
`src/lib/repositories/__tests__/duplicate-response-mapping.test.ts`,
`src/lib/repositories/errors.ts`.

Не мой контент: `next-env.d.ts` — генерируемая churn от `next build`.

## Verification evidence

### Passed

- `npm run verify` целиком, exit 0: typecheck, 280/280 TypeScript (274 плюс
  шесть новых), ESLint, production build, `verify:db` 6/6 и 269/269 Python.
- `npm run verify:db` отдельно: 6/6 против PostgreSQL 17 в compose-контейнере,
  база `shalomut_test`.
- Восемь параллельных submission одной сессии дали ровно один принятый ответ и
  одну строку в БД.
- Миграция применена к `shalomut_test`; последующий
  `prisma migrate diff --from-config-datasource --to-schema` вернул пустую
  миграцию, то есть схема и БД сошлись.

### Failed

- Первый прогон DB-suite: 5 из 6 упали. Две разные причины, обе исправлены —
  см. Failed approaches. Ни одна не осталась.

### Blocked or not run

- Миграция к рабочей локальной БД (`shalomut`) и к deployed БД не применялась:
  приложена только к изолированной `shalomut_test`.
- CI-конфигурация проверена только парсингом YAML и локальным прогоном той же
  команды; сам GitHub Actions run на этой ветке не запускался, потому что она
  не запушена.

### Environment

Локальный worktree. PostgreSQL 17 из `compose.yaml` на `127.0.0.1:5433`, база
`shalomut_test`. К deployed БД, Vercel и провайдерам не обращался.

### Residual risk

- Форма `P2002` зависит от того, как клиент дошёл до БД. Распознаются три
  формы, они закреплены unit-тестами, но список получен из наблюдения, а не из
  контракта Prisma. Неизвестная форма даст не 500, а необработанную ошибку —
  то есть заметно, а не тихо.

## Failed approaches

- **Наивная проверка `meta.target`.** С driver adapter (`@prisma/adapter-pg`)
  у `P2002` вообще нет `meta.target`: имя ограничения лежит в
  `meta.driverAdapterError.cause.constraint.fields`. Первая реализация читала
  только `meta.target`, компилировалась и прошла бы любой mock-тест, но каждый
  реальный дубль отдавала бы 500. Поймано настоящей БД; теперь читаются все три
  формы и это закреплено `duplicate-response-mapping.test.ts`.
- **`prisma migrate dev`** интерактивен и в этом окружении не запускается. SQL
  сгенерирован через `prisma migrate diff --from-config-datasource`.
- **Первая версия DB-тестов** не клала `dimensionId` в ответы, и валидация
  сервиса отклоняла их раньше БД.

## Known risks

- `migrate deploy` на непустой БД удалит дубликаты. Для этого проекта данные
  расходные, но действие необратимое и названо в самой миграции.

## Approval gates

Локальная проверка использовала только изолированную `shalomut_test`.
Изменения слиты в `main` как PR #16; применение миграции к конкретному
deployed environment остаётся отдельным deployment-действием.

## Questions requiring an owner decision

Открытых нет.

## Next concrete step

Нет: задача завершена и заархивирована. Актуальная точка входа находится в
`docs/shalomut-tracker-handoff.md`.
