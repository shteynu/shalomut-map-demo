# Thin AI insights callback route

## Metadata

- Branch: `refactor/thin-ai-callback-route`
- Base branch: `refactor/ai-insights-repository`
- Base commit: `3e21adc`
- Current HEAD: `e29dc55` плюс следующий за ним docs-коммит этой ветки
- Status: реализация завершена и проверена; ветка не запушена
- Last updated: 2026-08-02
- Last agent/tool: Claude Code (Opus 5)

## Objective

Свести `src/app/api/rounds/[roundId]/ai-insights/route.ts` к транспорту: auth,
разбор идентичности запроса, коды ответов. Оркестрацию и доменную сверку
результата с аналитикой Core вынести за route.

## User-visible outcome

Нет. Те же статусы, тела ответов и порядок проверок.

## Context

§6 плана-ревью, «Этап 4»: тонких routes нет, callback route — 427 строк
оркестрации. Слайс был назван следующим крупнейшим независимым после
`IAiInsightsRepository`.

Ветка отведена от `refactor/ai-insights-repository`, а не от `main`: тот слайс
уже переписал обращения этого route к persistence, и брать `main` значило бы
переписывать их обратно. Обе ветки не запушены; порядок merge — сначала
`refactor/ai-insights-repository`.

## Scope

Выполнен целиком.

## Non-goals

- Изменение контракта, статусов, тел ответов и порядка проверок.
- Ликвидация dual-read/dual-write с `AiAnalysisRun`.
- Composition root вместо `getRepositories()`.
- Остальные routes.

## Acceptance criteria

- Поведение неизменно: `mcp-integration.test.ts` и `ai-e2e.test.ts` проходят
  без правок ожиданий — выполнено, ни один тест route не менялся.
- `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` зелёные.

## Relevant repository instructions

- `AGENTS.md`: одна ветка — один task-файл; сохранять чужие изменения.

## Relevant architecture and contracts

- Порядок проверок — часть безопасности: раунд и принадлежность run
  резолвятся до валидации, иначе callback в чужой раунд мог бы уронить
  корректный leased run одним лишь невалидным payload. Сохранён.
- Core перепроверяет числовые evidence-поля против собственных агрегатов —
  инвариант переехал в `verifyAiResultAgainstRound` без изменений.

## Decisions made

- Application-сервис возвращает outcome-union, route отображает его в HTTP —
  тот же приём, что в `enqueueAiAnalyticsAfterResponse`. `saved === false` и
  «раунд не найден» дают один outcome `round_not_found`, потому что и раньше
  отвечали одним телом.
- Метрики (`recordContractValidation`, `recordAiJobCompleted`,
  `recordValidMapSample`) считаются частью операции, а не транспорта, и ушли в
  сервис.
- Разбор `runId`/`leaseToken` из headers и query остался в route: это чтение
  запроса. Сервис принимает уже разобранную идентичность.
- Три файла вместо одного: транспорт (route), операция
  (`ai-insights-service.ts`), доменная сверка (`verify-ai-result.ts`).
  Сверка вынесена отдельно, потому что она самостоятельна и тестируема без
  репозиториев.

## Assumptions

- `refactor/ai-insights-repository` вливается в `main` раньше этой ветки.

## Completed

- `src/lib/server/verify-ai-result.ts` — `verifyAiResultAgainstRound`.
- `src/lib/server/ai-insights-service.ts` — `applyAiInsightsCallback`,
  `readAiInsights`, outcome-типы.
- Route: 427 → 173 строки, только транспорт.
- `src/lib/server/__tests__/ai-insights-read.test.ts` — четыре ветки
  dual-read GET напрямую.
- §6 плана-ревью: строка «тонких routes нет» убрана, добавлены абзац
  «Закрыто после аудита» и строка в таблицу «Чем закрыто»; следующим
  крупнейшим назван этап 3.

## In progress

Ничего.

## Remaining

- Push ветки и merge в `main` — действие владельца.

## Changed files

Всё закоммичено: `e29dc55` (route, два новых модуля, новый тест) и следующий
docs-коммит (`docs/wellbeing-refactoring-plan-v4-review.md`, этот файл). Staged
и untracked своего нет.

В worktree остаются чужие незакоммиченные изменения, не относящиеся к задаче:
`.idea/shalomut-map-demo.iml` и `next-env.d.ts` — не трогались.

## Verification evidence

### Passed

- `npm run typecheck` — чисто.
- `npm test` — 347/347 pass, включая `mcp-integration.test.ts` и
  `ai-e2e.test.ts` без единой правки ожиданий.
- `npm run lint` — чисто.
- `npm run build` — успешно.
- `npx tsx --test src/lib/server/__tests__/ai-insights-read.test.ts` — 4/4.

### Failed

Нет.

### Blocked or not run

- Реальный boundary-прогон Python → callback на живом сервисе — не
  запускался; локальный boundary покрыт `ai-e2e.test.ts` внутри `npm test`.
- Browser smoke — не запускался: user-visible поведения изменение не имеет.

### Environment

Local, без `DATABASE_URL` в тестовом процессе.

### Residual risk

Порядок шагов внутри `applyAiInsightsCallback` держится тестами route, а не
типами: перестановка проверок компилируется. Кто будет двигать шаги —
`mcp-integration.test.ts` про ownership и stale lease обязателен к прогону.

## Failed approaches

Нет.

## Known risks

- `docs/shalomut-tracker-handoff.md` по-прежнему называет следующей задачей
  `AiInsightsRepository`. Файл не редактировался ни здесь, ни в предыдущем
  слайсе: те же строки правит незалитая `docs/session-close-2026-08-02`.
  После merge всех трёх веток пункт 1 списка «Что делать в начале следующей
  сессии» нужно заменить на этап 3.

## Approval gates

Нет.

## Questions requiring an owner decision

Нет.

## Next concrete step

Запушить `refactor/ai-insights-repository`, затем
`refactor/thin-ai-callback-route`, влить в `main` в этом порядке (действие
владельца).
