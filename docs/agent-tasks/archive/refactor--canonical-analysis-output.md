# Canonical analysis input and the Stone Map output adapter (stage 3, Python half)

## Metadata

- Branch: `refactor/canonical-analysis-output`
- Base branch: `refactor/canonical-analytics-input`
- Base commit: `470ee78`
- Current HEAD: `03db6df`; включён в локальный `main` через `f313613`
- Status: завершено, проверено и опубликовано в `origin/main`
- Last updated: 2026-08-02
- Last agent/tool: Claude Code (Opus 5)

## Objective

Зеркало Core-половины на производящей стороне: `CanonicalAnalysisInput` без
версии и output adapter, через который идут все исходящие payload'ы.

## User-visible outcome

Нет. Байты Stone Map не изменились.

## Context

§6 плана-ревью, «Этап 3»: после `489b260` в Core оставалась Python-половина —
`CanonicalAnalysisInput` и output adapter. Четвёртый слайс подряд; ветка
отведена от `refactor/canonical-analytics-input`.

Порядок merge: `refactor/ai-insights-repository` →
`refactor/thin-ai-callback-route` → `refactor/canonical-analytics-input` →
эта ветка.

## Scope

Выполнен целиком.

## Non-goals

- Порты этапа 4 (`AnalyticsSource`, `ResultSink`, `TextGenerator`, `JobStore`)
  и constructor injection вместо глобальных `mcp_client_manager` и
  `analytics_graph`.
- Изменение контрактов, версий и байтов на проводе.
- Второй парсер: `mcp_types.RoundAnalyticsResult.from_dict` остаётся
  единственным местом, решающим, приемлем ли payload.

## Acceptance criteria

- Все исходящие формы собираются в одном модуле — выполнено: success, failure
  и locked.
- Байты не изменились — подтверждено полным pytest без правок ожиданий,
  включая `test_golden_corpus`, `test_callback_corpus` и
  `test_outgoing_payload_gate`.

## Relevant repository instructions

- `AGENTS.md`: одна ветка — один task-файл; чужие ветки не переписывать.

## Relevant architecture and contracts

- Граница Core/AI не менялась: тот же versioned contract, тот же fail-closed
  транспорт.
- Locked-раунд по-прежнему выносит наружу только факт блокировки и порог.

## Decisions made

- `CanonicalAnalysisInput` — read-model над уже проверенным payload'ом, а не
  второй парсер. Иначе появилось бы два места, решающих, что приемлемо.
- Ноды сохраняют собственные вопросы к capabilities. Что просить у провайдера —
  решение генерации, а не кодирования: версия, которая копию не понесёт, не
  должна за неё платить. Закрыть это должен порт `TextGenerator` из этапа 4.
- В canonical-модели у камня живут и `interpretation`, и `summary`: разные
  поколения контракта просят у модели разную копию, и адаптер отдаёт ту,
  которую несёт целевая версия.
- Legacy-раунд берёт и порядок, и `dimensionId` из канонического опросника.
  Найдено при переносе: прежний `_question_aggregates_for_dimension` для
  legacy сопоставлял агрегаты по каталогу вопросов, поэтому payload без
  `dimensionId` всё равно попадал на нужный камень. Фильтрация по полю
  агрегата эту связь бы порвала.
- `insightText` добавляется только метрике, стоящей за реальным вопросом:
  три фиксированные строки fallback'а вопроса не имеют, и раньше их ветка
  insight не получала.

## Assumptions

- Три предыдущие ветки вливаются раньше этой.

## Completed

- `ai-analytics-service/src/schemas/canonical.py` — `CanonicalAnalysisInput`,
  `CanonicalQuestionAggregate`, `CanonicalDimensionScore`, `CanonicalMetric`,
  `CanonicalStone`, `CanonicalAnalysisResult`.
- `ai-analytics-service/src/schemas/analytics_output.py` — `encode_stone_map`,
  `encode_failure`, `encode_locked`.
- `graph.py`: `format_stone_map_output_node` собирает canonical и кодирует;
  `build_failure_payload` — тонкий вызов адаптера.
- `privacy_node.py`: locked-payload через адаптер.
- `tests/test_analytics_output.py` — 7 случаев: одна и та же canonical-модель,
  закодированная под 3.0/5.0/6.0, частичная карта, отказ на пяти камнях,
  failure и locked.

## In progress

Ничего.

## Remaining

Нет в границах этой задачи; порты этапа 4 влиты следующими слайсами.

## Changed files

Всё закоммичено: `624d7f7` (код и тест) и следующий docs-коммит
(`docs/wellbeing-refactoring-plan-v4-review.md`, этот файл). Staged и untracked
своего нет.

В worktree остаются чужие незакоммиченные изменения:
`.idea/shalomut-map-demo.iml` и `next-env.d.ts` — не трогались.

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` из `ai-analytics-service` — 361 passed
  (baseline до слайса: 354, добавлено 7).
- `npm run lint:literals` — exit 0, включая Python-checker версионных
  литералов.
- `npm test` — 352/352: Core не менялся, но общие корпуса живут по обе
  стороны границы.

### Failed

Нет.

### Blocked or not run

- `npm run verify:ai` — не запускался: нужен живой стек; локальная граница
  покрыта корпусами и `test_service_integration`.
- `npm run typecheck`, `lint`, `build` — не запускались: TypeScript в этом
  слайсе не изменился.
- Browser smoke — не запускался: user-visible поведения нет.

### Environment

Local, `.venv` Python 3.14 внутри `ai-analytics-service`.

### Residual risk

Равенство байтов держится на корпусах и на порядке ключей в словарях: адаптер
собирает payload в том же порядке, что и прежний код, но ни один тест этот
порядок не фиксирует. JSON-потребители порядок не читают, так что риск
косметический.

## Failed approaches

Нет.

## Known risks

- Ветка `refactor/canonical-models` (worktree Gemini) содержит собственную
  версию этой же работы вместе с портами этапа 4. Не трогалась по решению
  владельца 2026-08-02; конфликт с этим слайсом гарантирован, если её начнут
  вливать.
- `docs/shalomut-tracker-handoff.md` по-прежнему называет следующей задачей
  `AiInsightsRepository` — устареет после merge; заменить на порты этапа 4.

## Approval gates

Нет.

## Questions requiring an owner decision

Нет.

## Next concrete step

Done: ветка включена в локальный `main` четвёртой в refactoring-стеке.
