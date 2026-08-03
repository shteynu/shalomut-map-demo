---
name: shalomut-map
description: Работай с продуктом и кодом Shalomut Map в репозитории shalomut-map-demo. Используй при изменении UI/UX, RTL Hebrew, опроса и методологии, wellbeing dimensions, scoring, privacy threshold, manager flows, dashboard stone map, persistence, API, AI analytics integration, product docs и source-of-truth файлов.
---

# Shalomut Map

## Назначение

Используй этот скилл для предметной и продуктовой реализации. Для продолжения
сессии, определения текущего статуса и подготовки handoff используй соседний
`../shalomut-tracker/SKILL.md`.

## Старт работы

Перед существенной реализацией используй `../shalomut-tracker/SKILL.md`, чтобы
определить task-файл текущей ветки, scope и `Next concrete step`.

1. Определи корень репозитория через `git rev-parse --show-toplevel`.
2. Прочитай `docs/source-of-truth.md`, `docs/README.md` и релевантный код.
3. Загрузи дополнительный контекст по типу задачи:
   - UI/UX: `PRODUCT.md` и `design.md`;
   - runtime, API и persistence: `PROJECT_CONTEXT.md` и
     `docs/shalomut-tracker-handoff.md`;
   - AI analytics: `docs/ai-contract-version-matrix.md`,
     `contracts/capabilities.json`, релевантный versioned manifest,
     `docs/ai-analytics-handoff.md` и `ai-analytics-service/README.md`;
   - survey methodology: `src/lib/shalomut-source.ts`.
4. Проверь существующие компоненты, тесты и patterns до добавления новых
   abstractions.

## Канонические границы

- Используй `src/lib/shalomut-source.ts` как источник восьми канонических
  dashboard dimensions, scoring/status semantics и default questionnaire
  template. Фактическим источником вопросов для конкретного раунда должен быть
  persisted `SurveyRound.surveyDefinition` snapshot.
- Считай Google Form upstream-источником default/v1 questionnaire template, а
  Adobe XD — визуальной reference, согласно `docs/source-of-truth.md`.
- Не используй `DEMO_ORGANIZATION`, `DEMO_ROUND` или `SHALOM-DEMO` как скрытый
  runtime fallback; они допустимы только как явные test fixtures.
  `src/lib/demo-data.ts` удалён — не возвращай demo-аналитику в production-модуль.
- Экраны Dashboard рендерят `DashboardInsightsDto`
  (`src/lib/dashboard/dashboard-insights.ts`), а не wire-тип. Единственный
  перевод из `StoneMapResult` — `toDashboardInsights` в
  `ai-insights-view-model.ts`. Статическая презентация измерения (подписи,
  геометрия карты, цвет) живёт в `src/lib/dashboard/dimension-presentation.ts`.
- Оставляй пустую или недоступную persistence пустой; deployed writes без
  `DATABASE_URL` должны завершаться fail-closed.
- Сохраняй восемь wellbeing dimensions как стабильную выходную taxonomy для
  Dashboard Stone Map. Не считай канонические 24 вопроса обязательным runtime
  набором: это default/legacy template, а опрос каждого раунда может содержать
  другое количество, ID и формулировки вопросов продуктовой тематики.
- Каждый анализируемый вопрос должен иметь стабильный round-scoped ID, точный
  persisted текст и явную привязку к одной из восьми dimensions. AI input,
  question metrics, fallback и provenance должны использовать именно snapshot
  раунда, не подменяя его текстом или ID из default template.
- Сохраняй фиксированную форму Dashboard output: восемь stones, status-aware
  Hebrew interpretation/actions, общий summary и question-grounded metrics.
  Если безопасных данных недостаточно для покрытия всех восьми dimensions,
  заверши анализ locked/validation state, а не выдумывай отсутствующие stones.
- Не меняй молча семантику опубликованных contracts `1.0`–`6.0`. Capability
  policy находится в `contracts/capabilities.json`, а runtime status — в
  `docs/ai-contract-version-matrix.md`. Новая несовместимая семантика требует
  новой versioned manifest и consumer-first rollout.
- Сохраняй configurable scoring thresholds: green `>=75`, yellow `50–74`, red
  `<50`.
- Применяй настроенный privacy threshold: `10` — и default, и minimum, менеджер
  может только повысить его. Не раскрывай respondent identity, индивидуальные
  ответы или detailed results ниже порога. Для dynamic questionnaire не делай
  partial unlocked analysis: если total или хотя бы один анализируемый вопрос
  ниже threshold, весь detailed result остаётся locked и provider не вызывается.
- Сохраняй границу между Core Data Layer и внешним AI analytics service.
  Проверяй versioned contract и используй fail-closed transport.
- Сохраняй отделение canonical domain models от wire contracts: Core считает
  `CanonicalRoundAnalytics` и кодирует его через `encodeAnalyticsInput`, а
  Python разбирает `CanonicalAnalysisInput` и формирует payload через output
  adapter. В Python application boundary используются порты `AnalyticsSource`,
  `ResultSink`, `JobStore` и `TextGenerator`; в Core composition root вместо
  прямых `getRepositories()` остаётся следующей архитектурной задачей.

## Product и UI

- Проектируй Hebrew RTL как основной experience, включая reading order,
  navigation arrows и responsive layout.
- Соблюдай WCAG AA и не передавай статус только цветом.
- Не используй white text на ярких green/yellow status surfaces.
- Сохраняй warm organic stone-map language из `design.md`; избегай cold
  corporate dashboard aesthetics.
- Предпочитай существующие компоненты и tokens.
- Сохраняй first-class empty, loading, error и privacy-locked states.

## Безопасность изменений

- Проект на стадии проектирования: есть ровно два окружения — local и deployed;
  реальных respondents и production data нет, алиас `Production` в Vercel —
  операционный staging.
  Считай содержимое базы расходным: `db:clear`, reseed, сброс схемы и
  применение миграций — обычная работа без approval-ритуала, backup и
  PITR-чекпоинта. Подтверждай target environment, чтобы не потерять время на
  запись не туда, а не ради сохранности данных.
- Явное ограниченное подтверждение нужно для secrets, credentials,
  authentication configuration и переключения deployment aliases.
- Не подключай публичные manager writes к реальным данным без authentication,
  authorization или подтверждённой deployment protection.
- Если реализация выявила новый architecture, privacy, contract, persistence
  или deployment risk, верни управление `shalomut-tracker` для обновления
  task-state и решения об эскалации.

## Проверка

- Перед утверждением о готовности прочитай и соблюдай
  `../shalomut-verification/SKILL.md`.
- После изменения survey source проверяй respondent и dashboard flows.
- После изменения API синхронизируй и проверяй OpenAPI JSON/YAML и contract
  tests.
- Сообщай только о проверках, которые действительно были выполнены.
