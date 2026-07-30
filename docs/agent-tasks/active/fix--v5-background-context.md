# PR 1 — сохранить school background context на контракте 5.0

## Metadata

- Branch: `fix/v5-background-context`
- Base branch: `main`
- Base commit: `cb8bed3`
- Current HEAD: `cb8bed3` (изменения ещё не закоммичены)
- Status: правка сделана, verify выполняется
- Last updated: 2026-07-30
- Last agent/tool: Claude Code (Opus 5)

## Objective

Закрыть P0-дефект из плана рефакторинга v4: parser AI-сервиса сохранял
`backgroundContext` только при точном равенстве контракта `4.0`, поэтому на
`5.0` — версии, которая сейчас работает на деплое, — контекст школы терялся
между transport и nodes.

## User-visible outcome

Промпт на контракте `5.0` снова получает контекст школы (заметки, число новых
сотрудников и т.д.), поэтому интерпретации в Stone Map перестают быть общими
там, где Core этот контекст отправил. До правки апгрейд `4.0` → `5.0` менял
контекст на распределения вместо того, чтобы добавить их.

## Context

- Дефект и порядок работ описаны в `docs/wellbeing-refactoring-plan-v4-review.md`
  (PR 1 в §4).
- Core отправляет контекст и на `4.0`, и на `5.0`: `src/app/api/mcp/route.ts:103`.
- Nodes умеют его использовать для обеих версий: `src/agents/nodes.py:120-124`.
- Терялось строго в parser: `src/schemas/mcp_types.py`.

## Scope

- Правка parser в `ai-analytics-service/src/schemas/mcp_types.py`.
- Регрессия через настоящий parser boundary в `tests/test_contract_v5.py`.
- Две устаревшие строки `docs/source-of-truth.md`.

## Non-goals

- Contract Registry и capabilities — это этап C плана, не этот PR.
- DB constraints, durable jobs, health endpoint — PR 2, 2.5 и 3.
- Не трогать семантику immutable контрактов `1.0`–`3.0`.

## Acceptance criteria

- 5.0 payload, пропущенный через `RoundAnalyticsResult.from_dict`, сохраняет
  `backgroundContext` точным равенством.
- 4.0 продолжает работать; 3.0 контекст не получает.
- Locked-раунд не доводит контекст до провайдера.
- Полный `npm run verify` зелёный.

## Decisions made

- Взят **узкий fix** из v4 §10.1: множество версий вместо точного сравнения.
  Целевая форма `contract.capabilities.background_context` появится в этапе C;
  делать её сейчас означало бы тянуть registry в correctness-правку.
- Множество вынесено в именованную константу
  `_BACKGROUND_CONTEXT_CONTRACT_VERSIONS`, чтобы правило читалось как
  capability, а не как сравнение версий, и чтобы добавление версии трогало одно
  место.
- Red-тест сделан через `from_dict`, а не через ручной `round_data`: именно этот
  обход и позволял дефекту оставаться зелёным.

## Assumptions

- `_definition_hash` в тестах повторяет алгоритм Core; это уже используемый в
  репозитории helper, отдельно против Core я его не сверял.

## Completed

- Дефект воспроизведён исполняемо до правки: на `4.0` контекст доходит, на `5.0`
  парсер отдаёт `{}`.
- Добавлены пять тестов в `tests/test_contract_v5.py`:
  - `test_a_5_0_payload_keeps_the_school_context_through_the_parser`
  - `test_a_4_0_payload_keeps_the_school_context_through_the_parser`
  - `test_a_3_0_payload_carries_no_school_context_past_the_parser`
  - `test_parsed_5_0_round_data_still_reaches_the_prompt`
  - `test_a_locked_5_0_round_keeps_the_context_away_from_the_provider`
- До правки падали ровно два теста про `5.0`, остальные три были зелёными.
- Правка `mcp_types.py`: точное сравнение с `4.0` заменено на проверку
  вхождения в `_BACKGROUND_CONTEXT_CONTRACT_VERSIONS`.
- `docs/source-of-truth.md`: строка 6 (deployed `3.0` → `5.0` с историей версий)
  и строка про `backgroundContext` (`4.0` only → `4.0` и `5.0`).

## In progress

Ничего.

## Remaining

- Push — действие владельца.
- Затем PR 2 (`fix(persistence): enforce response idempotency in postgres`).

## Changed files

Всё unstaged, ничего не закоммичено:

- `ai-analytics-service/src/schemas/mcp_types.py`
- `ai-analytics-service/tests/test_contract_v5.py`
- `docs/source-of-truth.md`

Не мой контент, оставлен нетронутым: `next-env.d.ts` — генерируемая churn,
`next build` переключает его между dev- и build-вариантом.

## Verification evidence

### Passed

- Baseline на `cb8bed3` до правки: `npm run verify` exit 0 — typecheck,
  274/274 TypeScript, ESLint, production build, 269/269 Python.
- Исполняемый probe до правки: `from_dict` на 4.0 отдаёт контекст, на 5.0 — `{}`.
- Red-состояние: два новых теста про 5.0 падали, три guard-теста проходили.
- После правки: `tests/test_contract_v5.py` 42/42; полный Python suite
  274/274 (было 269, плюс пять новых).
- Итоговый `npm run verify` — exit 0: typecheck, 274/274 TypeScript, ESLint,
  production build и 274/274 Python.

### Failed

Нет.

### Blocked or not run

- Живой раунд на деплое не проверялся: деплой требует отдельного bounded
  approval владельца. Правка целиком внутри Python-сервиса, поэтому её
  deployment evidence появится только после деплоя AI-сервиса.

### Environment

Локальный worktree. Python-тесты через `.venv/bin/python -m pytest`. К БД,
Vercel и провайдерам не обращался.

### Residual risk

Правка узкая и в одном выражении. Дублирование множества версий между
`mcp_types.py` и `nodes.py:120-124` сохраняется — его снимет Contract Registry
на этапе C; в коде оставлена ссылка на это.

## Failed approaches

- Прогнать builder-фикстуру `build_v5_round_data` через `from_dict` без правок
  не удалось: плейсхолдерный `surveyDefinitionHash` не сходится с агрегатами.
  Использован `build_v5_input_payload`, который считает хеш.

## Known risks

Нет открытых.

## Approval gates

Ничего не запушено и не задеплоено. Push и деплой — действия владельца.

## Questions requiring an owner decision

Открытых нет.

## Next concrete step

Записать результат `npm run verify`, закоммитить три файла одним commit
`fix(ai-contract): preserve v5 background context` и передать владельцу для
push. Затем PR 2 по §4 ревью.
