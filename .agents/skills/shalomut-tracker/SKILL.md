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
3. `docs/shalomut-tracker-handoff.md` — operational snapshot, blockers и
   approval gates.
4. `PROJECT_CONTEXT.md` — устойчивые архитектурные решения.
5. `PROGRESS.md` — журнал и память прошлых сессий.
6. `PRODUCT.md`, `design.md` и специализированные документы.

Не считай устаревший пункт в документации более надёжным, чем текущий код или
проверяемое состояние.

## Старт работы

1. Определи корень репозитория через `git rev-parse --show-toplevel`.
2. Прочитай:
   - текущий snapshot, незавершённые задачи и approval gates из
     `docs/shalomut-tracker-handoff.md`;
   - архитектурные ограничения из `PROJECT_CONTEXT.md`;
   - текущий статус и следующие шаги из `PROGRESS.md`.
3. Проверь `git status --short` и последние релевантные commits.
4. Если пользователь уже дал конкретную задачу, кратко обозначь важный контекст
   и приступай без дополнительного вопроса.
5. Если пользователь сказал только «продолжаем», предложи ближайший безопасный
   незаблокированный шаг.
6. Задавай вопрос только при необходимом продуктовом решении, внешней
   зависимости или approval gate.

## Маршрутизация контекста

Загружай только документы, нужные текущей задаче:

- UI/UX: `PRODUCT.md`, `design.md` и релевантные компоненты.
- Методология и опрос: `docs/source-of-truth.md` и
  `src/lib/shalomut-source.ts`.
- Runtime, API и persistence: `docs/shalomut-tracker-handoff.md`,
  `PROJECT_CONTEXT.md` и релевантный код.
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
  threshold.
- Сохраняй восемь измерений и 24 обязательных вопроса, пока пользователь явно
  не запросил новую версию инструмента.
- Соблюдай RTL-first, WCAG AA и тёплую дизайн-систему.
- Сохраняй границу между Core Data Layer и внешним AI analytics service.
- Обеспечивай fail-closed поведение AI transport и persistence.
- Не изменяй production data, secrets, aliases, deployments и shared databases
  без явного ограниченного подтверждения.
- Не применяй migration без подтверждённого environment и rollback/PITR path.

## Работа и проверка

- Делай изменения небольшими проверяемыми порциями.
- Для предметной реализации используй `../shalomut-map/SKILL.md`.
- Перед фиксацией результата или handoff используй
  `../shalomut-verification/SKILL.md`.
- Сохраняй только фактически полученное verification evidence.

## Сохранение прогресса

Не изменяй project-memory файлы автоматически после каждой задачи. Обновляй их,
когда пользователь явно просит сохранить прогресс или когда handoff входит в
задачу:

1. Проверь `git status`, diff, commits и evidence из
   `../shalomut-verification/SKILL.md`.
2. Обнови `PROGRESS.md` только подтверждёнными фактами: текущий статус,
   выполненное, проверки, blockers и 2–4 следующих безопасных шага.
3. Обнови `docs/shalomut-tracker-handoff.md`, если изменился operational state,
   deployment state или approval boundary.
4. Изменяй `PROJECT_CONTEXT.md` только при изменении устойчивой архитектуры.
5. Не дублируй существующую историю и не записывай секреты.
6. Если материального изменения состояния нет, не редактируй документацию.
7. Предложи commit message только при наличии реального diff.
