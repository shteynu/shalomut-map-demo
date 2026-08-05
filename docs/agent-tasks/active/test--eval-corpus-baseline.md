# Первый прогон eval-корпуса на платном ключе

## Metadata

- Branch: `test/eval-corpus-baseline`
- Base branch: `docs/archive-mutation-tasks`
- Base commit: `d18b7fd`
- Current HEAD: `d18b7fd`
- Status: in progress
- Last updated: 2026-08-05
- Last agent/tool: Claude Code (Opus 5)

## Objective

Снять первый отчёт eval-корпуса по настоящему выводу провайдера и тем самым
закрыть внешний блокер из `docs/shalomut-tracker-handoff.md`: «The offline eval
corpus has never scored real provider output».

## User-visible outcome

Никакого. Это измерение качества текстов, а не изменение продукта.

## Context

Владелец подключил платный ключ Gemini 2026-08-05. До этого free tier давал 20
запросов в сутки на модель, а полный прогон корпуса стоит около 140, поэтому
корпус ни разу не оценивал вывод модели — только детерминированный fallback.

## Scope

- Прогон `evals.run_corpus` по всем восьми кейсам на моделях, объявленных в
  `render.yaml`.
- Проверка провенанса по инструкции из `ai-analytics-service/evals/README.md`.
- Отчёт `evals.report` и его хранение как первой базовой линии.

## Non-goals

- Правка промптов по результатам отчёта. Сначала базовая линия, потом решение.
- Превращение любого грейдера в порог.
- Изменение `.env`, секретов и настроек деплоя.

## Acceptance criteria

- Все семь незалоченных кейсов возвращают `status: success`, залоченный —
  `locked_error`.
- Провенанс показывает `outcome: "llm"` на существенной части камней, а не
  сплошной `deterministic_fallback`.
- Отчёт снят и записан вместе с тем, на какой модели он получен.

## Relevant repository instructions

- `AGENTS.md` — ветка на задачу, файл задачи, handoff перед остановкой.
- `.agents/skills/shalomut-verification/SKILL.md` — что считать доказательством.

## Relevant architecture and contracts

- `ai-analytics-service/evals/README.md` — что корпус меряет и чего не меряет.
- `render.yaml` — модели и темп, объявленные для деплоя.

## Decisions made

- Прогон идёт на `gemini-3.5-flash-lite` / `gemini-3.5-flash` — моделях из
  `render.yaml`, а не на умолчаниях локального `.env`
  (`gemini-flash-latest` / `gemini-pro-latest`). Иначе отчёт не говорит ничего
  о задеплоенном поведении.
- Темп поднят до 60 запросов в минуту через переменные окружения на время
  прогона. Файл `.env` не менялся.

## Assumptions

- Платный ключ лежит в `ai-analytics-service/.env` под именем `GEMINI_API_KEY`
  (имя видно в выводе `run_corpus`, значение не читалось).

## Completed

- Полный прогон корпуса на моделях деплоя. Семь незалоченных кейсов —
  `success`, залоченный — `locked_error`. Ни одного `429`.
- Провенанс: `outcome: "llm"` на 55 камнях из 56. Единственный
  `deterministic_fallback` — один камень в `mixed-middle`.
- Отчёт снят и положен в
  `ai-analytics-service/evals/baselines/2026-08-05-gemini-3.5-flash-lite.json`.
- Обновлены `PROGRESS.md`, `docs/shalomut-tracker-handoff.md` и
  `ai-analytics-service/evals/README.md`.

## In progress

- Ничего.

## Remaining

- Решение владельца по `summary_grounding`: чинить грейдер или оставить.
- Решение по `no_overreach`: правка промптов — отдельная задача.

## Changed files

- `docs/agent-tasks/active/test--eval-corpus-baseline.md` (новый)
- `ai-analytics-service/evals/baselines/2026-08-05-gemini-3.5-flash-lite.json`
  (новый)
- `ai-analytics-service/evals/README.md` (раздел «Baselines»)
- `PROGRESS.md`, `docs/shalomut-tracker-handoff.md`

## Verification evidence

### Passed

- `.venv/bin/python -m evals.run_corpus` — 8/8 кейсов вернули ожидаемый статус,
  время на кейс 56–76 секунд, суммарно около девяти минут.
- Провенанс по скрипту из `evals/README.md` — `llm` на 55 из 56 камней.
- `.venv/bin/python -m evals.report` — отчёт снят, `meanScore` 0.6917.

Средние по грейдерам:

| грейдер | среднее |
| --- | --- |
| `recommendation_fit` | 1.0 |
| `evidence_specificity` | 0.9084 |
| `distinctness` | 0.9029 |
| `summary_grounding` | 0.375 |
| `no_overreach` | 0.2725 |

### Failed

- Ничего не падало. Низкие оценки — это измерение, а не сбой.

### Blocked or not run

- `npm run verify:ai` и остальные проверки не запускались: код сервиса не
  менялся, изменения этой ветки — документация плюс отчёт.
- Прогон делался локально. На Render с платным ключом ничего не проверялось.

### Environment

- Локальная машина владельца, `ai-analytics-service/.venv`, провайдер Gemini,
  платный ключ.

### Residual risk

- Отчёт снят локально; деплой на Render использует тот же набор моделей, но
  переменную темпа под платный ключ там пока никто не менял.

## Failed approaches

- Первый запуск шёл на умолчаниях `.env` (`gemini-flash-latest`, 5 запросов в
  минуту) и был остановлен: он мерил не ту модель, что задеплоена.

## Known risks

- `invalid_semantic_output` в логе оказался нестрашен: 86 ретраев и 16
  окончательных отказов на всём прогоне, но повторная попытка почти всегда
  проходила, и до fallback дошёл один камень из 56.

## Что показали два низких грейдера

**`no_overreach` (0.2725) — настоящая находка про промпты.** Модель регулярно
пишет клиническое слово `שחיקה` (выгорание) — в семи кейсах из семи, включая
общее резюме, — и утверждает причинность оборотами `גורמים ל` («вызывают»),
`נובעת מ` («проистекает из»), `עקב` («вследствие»). Рантайм запрещает клиническое
слово только на зелёных измерениях, поэтому на жёлтых и красных оно проходит.
Это ровно тот класс текста, ради которого грейдер написан.

**`summary_grounding` (0.375) — почти целиком дефект самого грейдера.** Он
объявлен как проверка утверждений вида «столько-то *измерений* такого-то цвета»,
но в коде ищет числительное, за которым в окне из трёх слов стоит цветовое
слово, и не требует слова `ממדים` (измерения). Модель же пишет про **ответы**:

- `uniformly-healthy`: `18 תשובות ירוקות ו-2 תשובות צהובות מתוך 20` — 18 зелёных
  ответов из 20. Грейдер прочитал это как «18 зелёных измерений» против восьми.
- `polarized`: `10 תשובות ירוקות מול 10 תשובות אדומות` — распределение ответов,
  и оно верное.
- `workload-pressure`, `mixed-middle`, `dynamic-questionnaire` — то же самое.

Проверены все пять кейсов, где грейдер сработал; ни в одном модель не считала
измерения неправильно. Настоящих ошибок арифметики в резюме этот прогон не
нашёл — но и не искал, потому что грейдер до них не добирается.

## Approval gates

- Ротация четырёх засвеченных секретов остаётся отложенным гейтом, к этой задаче
  отношения не имеет.

## Questions requiring an owner decision

- Чинить ли `summary_grounding` — требовать слово «измерение» рядом с
  числительным. Это правка `evals/graders.py` и его тестов, и она меняет смысл
  базовой линии, поэтому базовая линия сохранена до правки, а не после.
- Нужно ли поднять `LLM_MAX_REQUESTS_PER_MINUTE` на Render под платный ключ.
  Сейчас там `14`, подогнанные под free tier.
- Локальный `.env` не задаёт `LLM_MODEL_FAST`/`LLM_MODEL_HEAVY`, из-за чего
  локальный прогон по умолчанию идёт на `gemini-flash-latest`, а не на
  задеплоенной модели. Стоит дописать их в `.env`.

## Next concrete step

Владелец решает по `summary_grounding`. Если чинить — правка предиката в
`grade_summary_grounding` (`ai-analytics-service/evals/graders.py:190`), тест в
`tests/test_evals.py` на случай «18 зелёных ответов» и повторное снятие отчёта
из уже сохранённых payload-ов: пересчёт бесплатен, провайдер не нужен.
