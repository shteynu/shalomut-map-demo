---
name: shalomut-tracker
description: Управляй контекстом, продолжением работы и handoff проекта shalomut-map-demo. Используй, когда пользователь просит начать или продолжить Shalomut, узнать статус или следующие шаги, сохранить прогресс, подготовить handoff или завершить сессию. Не запускай полный session ritual только из-за случайного упоминания Shalomut в конкретной задаче.
---

# Shalomut Tracker

## Приоритет источников

При расхождениях используй следующий порядок:

1. Текущий запрос пользователя.
2. Актуальный код, `git status`, история Git и результаты реально выполненных
   проверок.
3. Активный task document текущей ветки в `docs/agent-tasks/active/`.
4. `docs/shalomut-tracker-handoff.md` — operational snapshot, blockers и
   approval gates.
5. `PROJECT_CONTEXT.md` — устойчивые архитектурные решения.
6. `PROGRESS.md` — журнал и память прошлых сессий.
7. `PRODUCT.md`, `design.md` и специализированные документы.

Не считай устаревший пункт в документации более надёжным, чем текущий код или
проверяемое состояние.

## Старт работы

1. Определи корень репозитория через `git rev-parse --show-toplevel` и текущую
   ветку через Git.
2. Построй путь task-файла, заменив каждый `/` в имени ветки на `--`:
   `docs/agent-tasks/active/<branch-name>.md`.
3. Прочитай task-файл, если он существует. Если пользователь начал новую
   существенную задачу и файла нет, создай его из
   `docs/agent-tasks/TEMPLATE.md`. Не создавай task-файл для маленького вопроса,
   read-only объяснения или случайного поиска по документации.
4. Загрузи только проектные документы и разделы, релевантные задаче, по
   маршрутизации ниже. Сначала найди нужный раздел по заголовкам или поиском;
   не читай длинный глобальный документ целиком, если задача не требует всего
   его содержимого. Глобальный operational handoff нужен только при
   затрагивании его состояния или содержащихся в нём gates.
5. Проверь `git status --short`, полный текущий diff, недавние commits, а также
   доступное локально состояние upstream/remote refs.
6. Продолжай с раздела `Next concrete step`. Не переоткрывай принятые решения
   без конкретного противоречащего evidence и сохраняй unrelated changes.
7. Если task-файла нет и пользователь сказал только «продолжаем», предложи
   ближайший безопасный незаблокированный шаг из глобального контекста.
8. Задавай вопрос только при необходимом продуктовом решении, внешней
   зависимости или approval gate.

## Маршрутизация контекста

Загружай только документы, нужные текущей задаче:

- UI/UX: `PRODUCT.md`, `design.md` и релевантные компоненты.
- Методология и опрос: `docs/source-of-truth.md` и
  `src/lib/shalomut-source.ts`.
- Runtime, API и persistence: task-файл и релевантный код в первую очередь;
  конкретные разделы `PROJECT_CONTEXT.md` — только когда нужен устойчивый
  архитектурный контекст; конкретные разделы operational handoff — только для
  deployed state, внешних blockers или approval gates.
- AI analytics: `docs/ai-analytics-handoff.md`,
  `contracts/ai-analytics-v1.json` и `ai-analytics-service/README.md`.
- Deployment и migrations: operational handoff, environment configuration и
  migration state.

Когда работа переходит от статуса или handoff к реализации, прочитай и соблюдай
`../shalomut-map/SKILL.md`.

## Инварианты проекта

- Оставляй пустую persistence пустой; не используй demo fixtures как скрытый
  runtime fallback.
- Не раскрывай личность респондента или результаты ниже настроенного privacy
  threshold. Не допускай partial unlocked dynamic-questionnaire result: любой
  анализируемый вопрос ниже threshold блокирует все detailed metrics/stones.
- Сохраняй восемь измерений как стабильную Dashboard taxonomy. Канонические 24
  вопроса — default/legacy template, а не обязательный runtime-инструмент:
  вопросы конкретного раунда могут иметь другие ID, количество и формулировки,
  если они persisted, привязаны к восьми dimensions и проходят privacy gate.
- Не изменяй immutable AI contracts `1.0`/`2.0` молча; dynamic-questionnaire
  rollout должен получить новую breaking version и идти consumer-first.
- Соблюдай RTL-first, WCAG AA и тёплую дизайн-систему.
- Сохраняй границу между Core Data Layer и внешним AI analytics service.
- Обеспечивай fail-closed поведение AI transport и persistence.
- Проект на стадии проектирования: production data нет, содержимое базы
  расходное. Не заводи approval gate на очистку, reseed и миграции; явное
  ограниченное подтверждение нужно только для secrets, credentials,
  authentication configuration и переключения deployment aliases.

## Работа и проверка

- Делай изменения небольшими проверяемыми порциями.
- Для предметной реализации используй `../shalomut-map/SKILL.md`.
- Перед фиксацией результата или handoff используй
  `../shalomut-verification/SKILL.md`.
- Сохраняй только фактически полученное verification evidence.

## Параллельная работа

- Одна независимо поставляемая задача использует одну ветку и один task-файл.
- Два агента не работают одновременно в одном worktree. Для параллельной
  работы используй отдельные Git worktrees или отдельные checkouts, разные
  ветки и разные task-файлы.
- Перед продолжением проверяй локальное и доступное remote/upstream состояние.
- Не выполняй reset, clean, checkout поверх, discard, rebase, force-push или
  amend чужого commit без явного запроса пользователя.
- Перед передачей незакоммиченной работы точно запиши в task-файле, что
  committed, staged, unstaged и untracked.

## Границы памяти

- Active task document — текущее implementation state одной ветки или задачи.
- `docs/shalomut-tracker-handoff.md` — только cross-task operational state,
  deployed state, внешние blockers и approval gates.
- `PROJECT_CONTEXT.md` — стабильная архитектура, продуктовые инварианты и
  долгоживущие решения.
- `PROGRESS.md` — краткие product-level milestones и крупные завершённые
  возможности.

Task-файл — текущий snapshot, а не append-only журнал сессий. При обновлении
заменяй устаревшее состояние, удаляй уже неактуальные подробности и ссылайся на
commits или файлы вместо копирования больших diff. Если task-файл вырос больше
примерно 12 KB, сожми завершённую историю до коротких итогов до handoff.

Не размножай обычные детали сессии по всем глобальным документам. Обновляй
глобальный документ только когда изменилось состояние, которым он владеет.

## Сохранение прогресса

Не изменяй project-memory файлы автоматически после каждой задачи. Обновляй их,
когда пользователь явно просит сохранить прогресс или когда handoff входит в
задачу:

1. Проверь полный текущий diff, `git status`, commits и выбери проверки через
   `../shalomut-verification/SKILL.md`; затем выполни их.
2. Сначала обнови активный task-файл. Запиши только реально выполненные
   проверки, completed и remaining work, решения, assumptions, failed
   approaches, risks и approval gates.
3. Оставь ровно один ясный `Next concrete step`. Запиши текущий HEAD и точное
   состояние committed, staged, unstaged и untracked; не называй worktree
   чистым без проверки.
4. Обнови `PROGRESS.md` только если изменился product-level milestone или
   крупная завершённая возможность.
5. Обнови `docs/shalomut-tracker-handoff.md` только если изменился cross-task
   operational/deployment state, внешний blocker или approval boundary.
6. Изменяй `PROJECT_CONTEXT.md` только при изменении устойчивой архитектуры или
   долгоживущего решения.
7. Не дублируй существующую историю и не записывай секреты, chat transcripts
   или private AI session URLs.
8. Если owned state глобального документа не изменился, не редактируй его.
9. Явно назови границу видимости handoff: незакоммиченное состояние доступно
   только в том же worktree; другой worktree увидит commit в ветке; другой
   checkout или машина — только опубликованную ветку после push. Не выполняй
   commit или push без запроса пользователя, но и не называй незакоммиченный
   handoff меж-worktree или межмашинным.
10. Предложи commit message только при наличии реального diff.
