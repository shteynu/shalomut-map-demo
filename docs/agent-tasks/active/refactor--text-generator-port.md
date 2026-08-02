# Порт TextGenerator для генерирующих нод (этап 4)

## Metadata

- Branch: `refactor/text-generator-port`
- Base branch: `refactor/analytics-runner-ports`
- Base commit: `1d65397`
- Current HEAD: `612b4fb` плюс следующий за ним docs-коммит этой ветки
- Status: реализация завершена и проверена; ветка не запушена
- Last updated: 2026-08-02
- Last agent/tool: Claude Code (Opus 5)

## Objective

Убрать прямые вызовы `llm_provider_service` из нод: генератор приходит
параметром, граф передаёт свой, дефолт остаётся прежним провайдером.

## User-visible outcome

Нет. Ни один prompt, вызов модели и исходящий payload не изменился.

## Context

§6 плана-ревью, «Этап 4»: последний оставшийся порт после `AnalyticsSource`,
`ResultSink`, `JobStore` и `AnalysisRunner`. Шестой слайс подряд; ветка отведена
от `refactor/analytics-runner-ports`.

Порядок merge: `refactor/ai-insights-repository` →
`refactor/thin-ai-callback-route` → `refactor/canonical-analytics-input` →
`refactor/canonical-analysis-output` → `refactor/analytics-runner-ports` →
эта ветка.

## Scope

Выполнено: протокол `TextGenerator`; `generator` как keyword-параметр
`agent_psychologist_node` и `agent_adaptation_node`; `AnalyticsGraphEngine`
принимает генератор конструктором и передаёт его обеим async-нодам.

## Non-goals

- Убрать `get_capabilities` из нод — см. «Решения».
- Композиция графа из отдельного composition root.
- Изменение prompt'ов, модельных тиров, fallback'ов и байтов на проводе.

## Acceptance criteria

- Раунд проходит целиком на подставном генераторе, пока синглтон недоступен —
  выполнено, `tests/test_text_generator_port.py`.
- Дефолтная композиция без аргумента по-прежнему берёт настоящий провайдер.
- Полный pytest зелёный, ни один существующий тест не правился.

## Relevant repository instructions

- `AGENTS.md`: одна ветка — один task-файл; чужие ветки не переписывать.

## Relevant architecture and contracts

- Граница Core/AI, контракты и safety-цикл не менялись.
- `_in_provider_slot` и обработка `ProviderUnavailableError` остались на месте:
  порт меняет, кого зовут, а не что делают с отказом.

## Decisions made

- Инъекция через keyword-параметр ноды с дефолтом, а не через `AnalyticsState`
  и не превращением нод в методы класса. State защищён
  `test_agent_state_contract.py` и описывает данные раунда, а не коллабораторов;
  методы класса потребовали бы трогать все четыре модуля нод ради двух, которые
  действительно зовут провайдера.
- Сигнатуры операций оставлены на `**kwargs`. Провайдер несёт широкий и всё ещё
  меняющийся набор prompt-входов; фиксировать их в протоколе значит копировать
  сигнатуру реализации и править порт при каждой правке prompt'а. Порт
  фиксирует набор операций и форму ответа.
- Капабилити-ветки в нодах не тронуты. Предыдущая редакция §6 обещала, что этот
  слайс их закроет; это была ошибка. Ноды спрашивают контракт, чтобы решить,
  какую копию писать, — это решение генерации, и порт на него не отвечает.
  Формулировки исправлены в двух местах §6.
- `AnalyticsGraphEngine` получил `__init__`, которого у него не было. Дефолт
  `generator=llm_provider_service` держит `analytics_graph = AnalyticsGraphEngine()`
  и все существующие вызовы неизменными.

## Assumptions

- Пять предыдущих веток вливаются раньше этой.

## Completed

- `src/application/ports.py` — протокол `TextGenerator` (пять операций).
- `src/agents/psychologist_node.py` — параметр `generator`, четыре вызова.
- `src/agents/intervention_nodes.py` — параметр `generator`, один вызов.
- `src/agents/graph.py` — `AnalyticsGraphEngine(*, generator=llm_provider_service)`
  и передача в обе async-ноды.
- Тесты: новый `tests/test_text_generator_port.py` (2 случая). Существующие
  тесты не правились.

## In progress

Ничего.

## Remaining

- Push и merge — действие владельца.
- Composition root вместо `getRepositories()` в Core — следующий слайс.

## Changed files

Всё закоммичено: `612b4fb` (код и тесты) и следующий docs-коммит
(`docs/wellbeing-refactoring-plan-v4-review.md`, этот файл). Staged и untracked
своего нет.

В worktree остаются чужие незакоммиченные изменения:
`.idea/shalomut-map-demo.iml` и `next-env.d.ts` — не трогались.

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` — 368 passed (было 366, добавлено 2).
- `npm run lint:literals` — exit 0.
- `npm test` — 352/352; Core не менялся.
- Мутационная проверка нового теста: из `graph.py` временно убрана передача
  `generator=self.generator` — тест упал (`1 failed, 1 passed`); файл
  восстановлен, снова `2 passed`. Без этого тест прошёл бы и на глобале.

### Failed

Нет.

### Blocked or not run

- `npm run verify:ai` — не запускался: нужен живой стек.
- `typecheck`/`lint`/`build` — TypeScript не менялся.
- Browser smoke — user-visible поведения нет.

### Environment

Local, `.venv` Python 3.14 внутри `ai-analytics-service`.

### Residual risk

Тот же, что у портов предыдущего слайса: `Protocol` не проверяется во время
выполнения и статического type-checker'а в CI Python-сервиса нет. Плюс
`**kwargs` в сигнатурах: подставной генератор, забывший аргумент, обнаружится
исключением в тесте, а не несоответствием протоколу.

## Failed approaches

Нет.

## Known risks

- Ветка `refactor/canonical-models` (worktree Gemini) содержит собственную
  версию этапов 3–4. Не трогалась по решению владельца 2026-08-02.
- `docs/shalomut-tracker-handoff.md` по-прежнему называет следующей задачей
  `AiInsightsRepository`; после merge заменить на composition root в Core.

## Approval gates

Нет.

## Questions requiring an owner decision

Нет.

## Next concrete step

Запушить шесть веток в порядке `refactor/ai-insights-repository` →
`refactor/thin-ai-callback-route` → `refactor/canonical-analytics-input` →
`refactor/canonical-analysis-output` → `refactor/analytics-runner-ports` →
`refactor/text-generator-port` и влить в `main` в том же порядке (действие
владельца).
