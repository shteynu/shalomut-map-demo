# Canonical round analytics and the input encoder (stage 3, Core half)

## Metadata

- Branch: `refactor/canonical-analytics-input`
- Base branch: `refactor/thin-ai-callback-route`
- Base commit: `436eda4`
- Current HEAD: `470ee78`; включён в локальный `main` через `f313613`
- Status: завершено, проверено и влито в локальный `main`; `main` ещё не запушен
- Last updated: 2026-08-02
- Last agent/tool: Claude Code (Opus 5)

## Objective

Убрать wire-форму из доменного расчёта: `CanonicalRoundAnalytics` без версии
контракта плюс `encodeAnalyticsInput`/`encodeRoundAnalytics` в contract package.

## User-visible outcome

Нет. Байты на проводе и тела API не изменились.

## Context

§6 плана-ревью, «Этап 3»: доменный расчёт сам формировал wire-форму через
`if (getCapabilities(producedVersion).supportsScoreDistribution)` — средний
вариант из §3.2 вместо целевого `contract.encodeAnalyticsInput(canonical)`.

Третий слайс подряд; ветка отведена от `refactor/thin-ai-callback-route`,
потому что сверка callback — одна из кодирующих границ. Порядок merge:
`refactor/ai-insights-repository` → `refactor/thin-ai-callback-route` →
эта ветка.

## Scope

Выполнен целиком в границах решения владельца (только Core/TypeScript).

## Non-goals

- Python: `CanonicalAnalysisInput` и output adapter — следующий слайс.
- Изменение схемы контрактов, версий и байтов на проводе.
- Порты и composition root этапа 4, DTO представления этапа 5.
- Ветка `refactor/canonical-models` — не трогалась (см. «Известные риски»).

## Acceptance criteria

- Домен не знает версию контракта: в `analytics.service.ts` нет ни
  `getCapabilities`, ни стамповки `contractVersion` — выполнено.
- Байты MCP-payload и тело `/api/rounds/[roundId]/analytics` не изменились —
  подтверждено golden corpus, MCP-тестами и E2E без правок ожиданий.
- `npm run verify:core` зелёный.

## Relevant repository instructions

- `AGENTS.md`: одна ветка — один task-файл; параллельные агенты не делят
  worktree; чужие ветки не переписывать.

## Relevant architecture and contracts

- Граница Core/AI сохранена: версия контракта решает, что отправляется, и
  никогда — что истинно.
- Locked-раунд по-прежнему не выносит `backgroundContext` за границу.

## Decisions made

- Решение владельца 2026-08-02: ветку `refactor/canonical-models` от Gemini не
  трогать, этап 3 писать заново против текущего `main`; слайс ограничен Core.
- Два encoder'а вместо одного: `encodeRoundAnalytics` даёт версионную
  Core-форму (manager API и сверка callback), `encodeAnalyticsInput` — то, что
  реально уходит в AI-сервис (плюс `backgroundContext` и ISO-таймстамп).
  Одна функция сделала бы `backgroundContext` частью ответа менеджеру, то есть
  изменила бы API.
- `backgroundContext` живёт в canonical-модели, а не дочитывается на границе:
  MCP route из-за этого перестал читать раунд второй раз.
- Сверка callback получает результат `encodeRoundAnalytics(...)`, а не сам
  canonical: сравнивать надо с тем, что Core отправил бы для своей версии.
  Иначе отказ «у Core нет распределения для сверки» стал бы недостижим, и
  5.0-результат прошёл бы проверку на деплое, производящем 4.0.
- `calculateRoundAnalytics` (legacy 2.0) не тронут: он immutable-контракт.

## Assumptions

- Ветки предыдущих двух слайсов вливаются раньше этой.

## Completed

- `src/lib/types/canonical-analytics.ts` — `CanonicalRoundAnalytics`,
  `CanonicalQuestionAggregate` (распределение всегда есть).
- `src/lib/analytics-encoder.ts` — `encodeRoundAnalytics`,
  `encodeAnalyticsInput`.
- `analytics.service.ts` — возвращает canonical; `getCapabilities` и стамповка
  версии удалены из динамического расчёта.
- Границы кодируют: MCP route (минус повторное чтение раунда и capability-ветка),
  manager analytics route, `ai-insights-service`.
- `manager-context.service.ts` — тип контекста стал canonical; дашборд читает
  только `dimensionScores`/`isLocked`/`totalResponses`.
- Тесты: новый `src/lib/__tests__/analytics-encoder.test.ts` (5 случаев),
  перенос проверок версии на encoder в пяти существующих файлах, усиление
  теста распределения 5.0 — он теперь сравнивает 5.0 и 3.0 из одного canonical.

## In progress

Ничего.

## Remaining

Нет в границах этой задачи; Python-половина этапа 3 влита следующим слайсом.

## Changed files

Всё закоммичено: `489b260` (код и тесты) и следующий docs-коммит
(`docs/wellbeing-refactoring-plan-v4-review.md`, этот файл). Staged и untracked
своего нет.

В worktree остаются чужие незакоммиченные изменения:
`.idea/shalomut-map-demo.iml` и `next-env.d.ts` — не трогались.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0 целиком: `lint:literals` (включая оба
  checker'а версионных литералов), `typecheck`, `test` 352/352, `lint`,
  `build`.
- `npx tsx --test src/lib/__tests__/analytics-encoder.test.ts` — 5/5.
- `npx tsx --test src/lib/services/__tests__/analytics.service.test.ts` — 12/12.

### Failed

Нет.

### Blocked or not run

- `npm run verify:db` и `verify:ai` — не запускались: нужна база и живой
  AI-сервис; persistence и транспорт слайс не трогает.
- Python `pytest` — не запускался: `ai-analytics-service` не менялся.
- Browser smoke — не запускался: user-visible поведения нет.

### Environment

Local, без `DATABASE_URL` в тестовом процессе.

### Residual risk

Равенство байтов держится на тестах, а не на типах: `encodeAnalyticsInput`
возвращает `Record<string, unknown>`, потому что MCP-payload — это wire-форма,
которую валидирует `validateRoundAnalyticsPayload`. Опечатка в имени поля
упадёт в валидаторе и в MCP-тестах, но не при компиляции.

## Failed approaches

Нет.

## Known risks

- Ветка `refactor/canonical-models` (worktree Gemini, три коммита 2026-08-02)
  делает то же самое плюс порты этапа 4 сразу в двух рантаймах, отстав от
  `main` на 38 коммитов и с несовместимой моделью распределения. По решению
  владельца не трогалась. Её судьба — отдельное решение; если она когда-нибудь
  будет вливаться, конфликт с этим слайсом гарантирован.
- `docs/shalomut-tracker-handoff.md` по-прежнему называет следующей задачей
  `AiInsightsRepository`. Не редактировался ни в одном из трёх слайсов: те же
  строки правит незалитая `docs/session-close-2026-08-02`. После merge всех
  веток пункт 1 нужно заменить на Python-половину этапа 3.

## Approval gates

Нет.

## Questions requiring an owner decision

Нет.

## Next concrete step

Done: ветка включена в локальный `main` третьей в refactoring-стеке.
