---
name: shalomut-map
description: Работай с продуктом и кодом Shalomut Map в репозитории shalomut-map-demo. Используй при изменении UI/UX, RTL Hebrew, опроса и методологии, wellbeing dimensions, scoring, privacy threshold, manager flows, dashboard stone map, persistence, API, AI analytics integration, product docs и source-of-truth файлов.
---

# Shalomut Map

## Как читать этот скилл

Всегда в силе: `Назначение` — что этот скилл делает и куда уходит остальное;
`Канонические границы` — инварианты продукта, нарушение любого ломает privacy,
контракт или таксономию; `Безопасность изменений` — approval gates и границы
окружений.

По условию: `Старт работы` — начало или возобновление реализации; `Product и UI`
— diff трогает экраны, копию, стили, доступность или presentation-модули
`src/lib/dashboard/*`; `Проверка` — до утверждения о готовности.

## Назначение

Используй этот скилл для предметной и продуктовой реализации. Для продолжения
сессии, определения текущего статуса и подготовки handoff используй соседний
`../shalomut-tracker/SKILL.md`.

## Старт работы

Перед существенной реализацией используй `../shalomut-tracker/SKILL.md`, чтобы
определить task-файл текущей ветки, scope и `Next concrete step`.

1. Определи корень репозитория через `git rev-parse --show-toplevel`.
2. Начинай с task-файла ветки и релевантного кода: они точнее прозы. Открывай
   `docs/README.md`, чтобы понять статус документа, только когда собираешься на
   него опереться или его править, а `docs/source-of-truth.md` — когда задача
   трогает опрос, методологию или происхождение канонических данных.
3. Загружай по типу задачи только нужные разделы, а не документ целиком:
   - UI/UX: `PRODUCT.md` и `design.md`;
   - runtime, API и persistence: разделы `PROJECT_CONTEXT.md` с устойчивым
     архитектурным решением по затронутой границе;
     `docs/shalomut-tracker-handoff.md` — при deployment, миграциях, смене
     environment configuration или alias, а также когда работа зависит от
     внешнего состояния. Условие названо классом задачи, а не «трогает ли она
     blocker»: существует ли blocker, из diff не видно, это как раз то, что
     документ и сообщает;
   - AI analytics: `docs/ai-contract-version-matrix.md`,
     `contracts/capabilities.json`, релевантный versioned manifest и
     `ai-analytics-service/README.md`; `docs/ai-analytics-handoff.md` даёт
     cross-service overview, а archived rollout details не являются current
     state;
   - survey methodology: `src/lib/shalomut-source.ts`.
4. Проверь существующие компоненты, тесты и patterns до добавления новых
   abstractions.

Сначала найди нужный раздел по заголовкам или поиском — то же правило, что в
`../shalomut-tracker/SKILL.md`. Читай глобальный документ целиком, только когда
задача требует всего содержимого, например при аудите самого документа.

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
- Держи scoring thresholds в единственном источнике `contracts/scoring-bands.json`
  (Core — `src/lib/scoring-bands.ts`, Python — `src/schemas/scoring_bands.py`).
  Текущие полосы: green `>=75`, yellow `50–74`, red `<50`. Не возвращай литералы
  порогов в код. Полосы общие для деплоя, а не пораундовые: сервис валидирует
  status по score, поэтому пораундовые полосы означают новую семантику контракта
  и новую versioned manifest.
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
  `ResultSink`, `JobStore` и `TextGenerator`; в Core все репозитории собираются
  в `src/lib/composition-root.ts`, и `resolveCoreRepositories()` вызывают только
  entrypoints — route handler, загрузчик контекста server components, script или
  тест. Всё, что ниже этой границы, получает репозитории параметром; проверяет
  это `npm run lint:composition`.
- Держи API-описание в единственном редактируемом источнике `docs/openapi.yaml`.
  `public/openapi.json` генерируемый: ручная правка — это drift, а не изменение.
  Правило стоит здесь, а не в `Проверка`, потому что решает, какой файл вообще
  можно открыть на редактирование.

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
- После изменения API запускай `npm run openapi:generate` и коммить обновлённый
  `public/openapi.json`. Какой из двух файлов редактируемый — в
  `Канонические границы`.
- Сообщай только о проверках, которые действительно были выполнены.
