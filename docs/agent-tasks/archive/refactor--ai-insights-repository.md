# AiInsightsRepository extraction

## Metadata

- Branch: `refactor/ai-insights-repository`
- Base branch: `main`
- Base commit: `65e04fe`
- Current HEAD: `3e21adc`; включён в локальный `main` через `f313613`
- Status: завершено, проверено и опубликовано в `origin/main`
- Last updated: 2026-08-02
- Last agent/tool: Claude Code (Opus 5)

## Objective

Вынести персистентность AI-результата раунда из `IRoundRepository` в отдельный
`IAiInsightsRepository`, повторив уже сделанное выделение
`IAiAnalysisRunRepository`.

## User-visible outcome

Нет. Внутренняя граница persistence: те же ответы API, тот же формат хранения,
миграции нет.

## Context

§6, «Этап 4» в `docs/wellbeing-refactoring-plan-v4-review.md`: слайс назван
крупнейшим независимым из оставшегося — он не требует ни одного из
отсутствующих портов (`AnalyticsSource`, `ResultSink`, `TextGenerator`,
`JobStore`) и не зависит от этапа 3.

## Scope

Выполнен целиком: интерфейс, обе реализации, проводка фабрики, все вызывающие,
тесты, обновление §6 плана-ревью.

## Non-goals

- Схема БД: колонки `aiInsights`/`aiInsightsUpdatedAt` остаются на
  `survey_rounds`.
- Ликвидация dual-read/dual-write с `AiAnalysisRun` — отдельный слайс.
- Тонкие routes, composition root, порты этапа 4.

## Acceptance criteria

- `IRoundRepository` больше не знает об AI-результатах — выполнено.
- Поведение сохранено: запись в несуществующий раунд возвращает `false`
  (404 на callback), reset чистит результат, авто-триггер не перегенерирует уже
  сохранённый результат — покрыто тестами ниже.
- `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` зелёные.

## Relevant repository instructions

- `AGENTS.md`: одна ветка — один task-файл; сохранять чужие изменения в
  worktree.

## Relevant architecture and contracts

- AI-контракты не затронуты: сохраняется тот же валидированный payload, тот же
  порядок dual-write с `AiAnalysisRun`.

## Decisions made

- Имена методов повторяют `IAiAnalysisRunRepository`: `save`, `findByRoundId`,
  `deleteByRoundId`.
- Отказ записи для несуществующего раунда остаётся частью контракта интерфейса.
  Postgres даёт его провалившимся `update`; in-memory-реализация получает round
  source в конструкторе и спрашивает его. Без source она пишет безусловно —
  это форма для теста, которому нужен только сам результат.
- `setRepositories` пересобирает in-memory insights store, когда вызывающий
  подменил только `roundRepo`: иначе подставленный раунд был бы невидим для
  своего же результата. Явно переданный `aiInsightsRepo` всегда побеждает.
- `enqueueAiAnalyticsAfterResponse` больше не принимает `roundRepo`: раунд
  читался только ради проверки «результат уже есть».

## Assumptions

- Ветка `docs/session-close-2026-08-02` (`f044147`) вливается в `main`
  отдельно; эта ветка отведена от `main` и её не содержит.

## Completed

- `IAiInsightsRepository` в `src/lib/repositories/interfaces.ts`; три метода
  удалены из `IRoundRepository` и обеих его реализаций.
- `PrismaAiInsightsRepository`, `InMemoryAiInsightsRepository`.
- Проводка через `getRepositories`/`setRepositories`/`resetDefaultRepositories`.
- Переведены: GET и callback AI-инсайтов, reset route, submit route,
  `trigger-ai-analytics`, `scripts/inspect-ai-provenance.ts`.
- Тесты: `prisma.test.ts` (переименован на новый класс, добавлено удаление),
  `repositories.test.ts` (отказ для несуществующего раунда, пересборка store в
  `setRepositories`), `api.test.ts`, `submit-auto-trigger.test.ts`,
  `contract-3-staging-dryrun.test.ts`.
- §6 плана-ревью: слайс перенесён из «Нет» в «Закрыто после аудита», строка в
  таблицу «Чем закрыто», следующим крупнейшим слайсом назван тонкий callback
  route.

## In progress

Ничего.

## Remaining

Нет в границах этой задачи.

## Changed files

Всё закоммичено в `13c9e03` (код и тесты) и в следующем docs-коммите
(`docs/wellbeing-refactoring-plan-v4-review.md`, этот файл). Staged и
untracked своего нет.

В worktree остаются чужие незакоммиченные изменения, не относящиеся к задаче:
`.idea/shalomut-map-demo.iml` и `next-env.d.ts` — не трогались.

## Verification evidence

### Passed

- `npm run typecheck` — чисто.
- `npm test` — 343/343 pass (после добавления двух новых тестов).
- `npm run lint` — чисто.
- `npm run build` — успешно; запуск был до добавления двух тестов, тестовые
  файлы в граф сборки не входят.
- `npx tsx --test src/lib/repositories/__tests__/repositories.test.ts` —
  9/9 pass.

### Failed

Нет.

### Blocked or not run

- `src/lib/repositories/__dbtests__/*` — не запускались: нужна реальная база, а
  AI-инсайтов эти тесты не касаются.
- Browser smoke — не запускался: user-visible поведения изменение не имеет.

### Environment

Local, без `DATABASE_URL` в тестовом процессе.

### Residual risk

Prisma-путь проверен только mock-клиентом из `prisma.test.ts`, как и до
рефакторинга. Реальный Postgres тот же самый запрос выполнял и раньше — SQL не
изменился, изменился только класс, который его отправляет.

## Failed approaches

Нет.

## Known risks

- `docs/shalomut-tracker-handoff.md` называет этот слайс задачей следующей
  сессии. Файл намеренно не редактировался здесь: те же строки правит
  незалитая `docs/session-close-2026-08-02`, и правка на двух ветках дала бы
  конфликт. После merge обеих веток пункт 1 списка «Что делать в начале
  следующей сессии» устареет и должен быть заменён.

## Approval gates

Нет: ни secrets, ни credentials, ни deployment aliases не затрагиваются.

## Questions requiring an owner decision

Нет.

## Next concrete step

Done: ветка включена в локальный `main` перед остальными пятью слайсами.
