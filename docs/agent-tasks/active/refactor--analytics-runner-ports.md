# Application ports around the analysis run (stage 4)

## Metadata

- Branch: `refactor/analytics-runner-ports`
- Base branch: `refactor/canonical-analysis-output`
- Base commit: `03db6df`
- Current HEAD: `6fefc9c` плюс следующий за ним docs-коммит этой ветки
- Status: реализация завершена и проверена; ветка не запушена
- Last updated: 2026-08-02
- Last agent/tool: Claude Code (Opus 5)

## Objective

Назвать зависимости раунда протоколами и передавать их через конструктор
вместо глобальных `mcp_client_manager` и `analytics_graph`.

## User-visible outcome

Нет. Ни один исходящий запрос не изменился.

## Context

§6 плана-ревью, «Этап 4»: портов не было ни одного. Пятый слайс подряд; ветка
отведена от `refactor/canonical-analysis-output`.

Порядок merge: `refactor/ai-insights-repository` →
`refactor/thin-ai-callback-route` → `refactor/canonical-analytics-input` →
`refactor/canonical-analysis-output` → эта ветка.

## Scope

Выполнено: `AnalyticsSource`, `ResultSink`, `JobStore`, `AnalysisRunner`,
`StoneMapPipeline`; constructor injection в `AnalyticsRunnerService`;
`HttpResultSink`; типизация коллабораторов воркера и его фабрики.

Не выполнено намеренно: порт `TextGenerator` — см. «Решения».

## Non-goals

- `TextGenerator` (отдельный слайс).
- Composition root вместо `getRepositories()` в Core.
- Изменение транспорта, заголовков, URL и байтов.

## Acceptance criteria

- Раннер собирается из трёх подставных объектов и проводит раунд без MCP,
  графа и HTTP — выполнено, `tests/test_runner_ports.py`.
- Полный pytest зелёный, исходящие запросы не изменились.

## Relevant repository instructions

- `AGENTS.md`: одна ветка — один task-файл; чужие ветки не переписывать.

## Relevant architecture and contracts

- Граница Core/AI и fail-closed транспорт не менялись.
- Экранирование `round_id` в callback-URL — часть безопасности: раунд с
  косой чертой не должен уметь направить callback на другой путь. Переехало в
  `HttpResultSink.callback_url` вместе с тестом.

## Decisions made

- `TextGenerator` не сделан. Вызовы провайдера живут в четырёх модулях нод, а
  ноды — свободные функции над `AnalyticsState`. Инъекция означает либо
  положить сервис в state-контракт (который защищён
  `test_agent_state_contract.py`), либо превратить ноды в методы класса. Это
  слайс сопоставимого размера, и в нём же живёт последний вопрос к
  capabilities внутри нод. Делать его наполовину значит получить глобал с
  лишними шагами.
- `ResultSink` владеет адресом, а не только доставкой: раннер знает лишь, что
  payload принадлежит раунду.
- Дефолтная композиция осталась в модуле раннера, а не в новом composition
  root: перенос точки сборки — отдельное решение, и в Core та же задача
  (`getRepositories()`) ещё открыта.
- `create_ai_analysis_job_worker` принимает `client` и `runner`, сохраняя
  прежние значения по умолчанию.

## Assumptions

- Четыре предыдущие ветки вливаются раньше этой.

## Completed

- `src/application/ports.py` — `AnalyticsSource`, `StoneMapPipeline`,
  `ResultSink`, `JobStore`, `AnalysisRunner`.
- `src/services/result_sink.py` — `HttpResultSink` с построением URL,
  проверкой origin, заголовками и блокирующей доставкой в потоке.
- `AnalyticsRunnerService.__init__(source, pipeline, sink)`; дефолтная
  композиция внизу модуля.
- `ai_job_worker.py` — типы коллабораторов и параметры фабрики.
- Тесты: новый `tests/test_runner_ports.py` (5 случаев); девять мест в
  `test_service_integration.py` и `test_dynamic_questionnaire_contract.py`
  переведены с внутренностей раннера на sink.

## In progress

Ничего.

## Remaining

- `TextGenerator` — следующий слайс.
- Push и merge — действие владельца.

## Changed files

Всё закоммичено: `6fefc9c` (код и тесты) и следующий docs-коммит
(`docs/wellbeing-refactoring-plan-v4-review.md`, этот файл). Staged и untracked
своего нет.

В worktree остаются чужие незакоммиченные изменения:
`.idea/shalomut-map-demo.iml` и `next-env.d.ts` — не трогались.

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` — 366 passed (было 361, добавлено 5).
- `npm run lint:literals` — exit 0.
- `npm test` — 352/352; Core не менялся.

### Failed

Нет. Девять тестов упали на первом прогоне после инъекции — они патчили
`_send_callback` и `_post_callback` раннера; переведены на sink и проходят.

### Blocked or not run

- `npm run verify:ai` — не запускался: нужен живой стек.
- `typecheck`/`lint`/`build` — TypeScript не менялся.
- Browser smoke — user-visible поведения нет.

### Environment

Local, `.venv` Python 3.14 внутри `ai-analytics-service`.

### Residual risk

Протоколы объявлены, но нигде не проверяются во время выполнения: подставной
объект с неверной сигнатурой упадёт в тесте, а не при сборке. Статического
type-checker'а в CI Python-сервиса нет, так что `Protocol` здесь — документация
с проверкой только в IDE.

## Failed approaches

Нет.

## Known risks

- Ветка `refactor/canonical-models` (worktree Gemini) содержит собственную
  версию портов вместе с этапом 3. Не трогалась по решению владельца
  2026-08-02.
- `docs/shalomut-tracker-handoff.md` по-прежнему называет следующей задачей
  `AiInsightsRepository`; после merge заменить на `TextGenerator`.

## Approval gates

Нет.

## Questions requiring an owner decision

Нет.

## Next concrete step

Запушить пять веток в порядке `refactor/ai-insights-repository` →
`refactor/thin-ai-callback-route` → `refactor/canonical-analytics-input` →
`refactor/canonical-analysis-output` → `refactor/analytics-runner-ports` и
влить в `main` в том же порядке (действие владельца).
