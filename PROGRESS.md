# PROGRESS: Shalomut Map

## 📌 Текущий статус
- **Текущий этап**: PR #5 смержен в `main` squash commit `6b369bf`. В ветке `agent/database-backed-manager-ui` завершён database-backed manager slice: реальные organization/current round/counts/analytics, onboarding для пустой БД, persistence setup/survey builder, реальные share codes/round IDs и сохранение статуса раунда.
- **Состояние БД**: создана, но намеренно не применена миграция `20260724180000_add_round_configuration` (`background_context`, `survey_definition`). Единственная найденная локальная Supabase-цель ранее использовалась как production/shared; отдельный staging target не подтверждён.
- **Staging**: alias `https://shalomut-map-demo-ui-redesign.vercel.app/` всё ещё указывает на ранее проверенный preview commit `a20ac66` и честно показывает пустое состояние. В Vercel Preview и Production нет настроенных env vars; отдельного проекта AI-сервиса также нет.
- **Runtime**: static export/GitHub Pages удалены, потому что DB-backed App Router требует server runtime. FastAPI-сервис подготовлен к Vercel entrypoint, работает fail-closed без shared secrets вне development и не полагается на in-process background task.
- **Граница деплоя**: production data, alias, secrets и deployment не изменялись. Для реального staging E2E нужны подтверждённая staging-БД, manager authentication/deployment protection и отдельное разрешение на внешние изменения.
- **Актуальный handoff**: см. [`docs/shalomut-tracker-handoff.md`](docs/shalomut-tracker-handoff.md). AI-детали: [`docs/ai-analytics-handoff.md`](docs/ai-analytics-handoff.md).

---

## 🚀 Следующие шаги (Next Up: Safe Staging)
1. [ ] Провести review/CI нового draft PR и после подтверждения применить `20260724180000_add_round_configuration` только к выделенной staging Supabase с PITR/rollback path.
2. [ ] Добавить manager authentication или как минимум Vercel Deployment Protection до включения публичных manager write endpoints.
3. [ ] Создать staging Vercel project для `ai-analytics-service`, настроить совпадающие shared secrets и staging URLs, затем выполнить реальный round-close → MCP → callback E2E.
4. [ ] После зафиксированных smoke evidence и отдельного подтверждения обновить staging alias; production promotion оставить отдельным approval gate.

---

## ✅ Завершенные задачи (Completed)
- [x] **2026-07-24**: **Manager UI переведён на реальные persisted records и подготовлен безопасный full-stack runtime**:
  - PR #5 смержен в `main` (`6b369bf`); работа продолжена в `agent/database-backed-manager-ui`.
  - Home, setup, round tracking, survey builder, dashboard и respondent flow используют настоящий organization/current round context, response counts, analytics, share code и round ID; пустая БД показывает onboarding, а не demo-записи.
  - `PUT /api/manager/setup`, `PATCH /api/rounds/[roundId]` и `GET/PUT /api/rounds/[roundId]/survey-definition` сохраняют manager setup, статус и definition; 24 канонических вопроса нельзя отключить или переназначить.
  - Добавлены Prisma-поля `background_context` и `survey_definition` с отдельной неприменённой миграцией `20260724180000_add_round_configuration`.
  - Анонимная отправка использует per-round local token и SHA-256 hash, проверяет сохранённый набор вопросов и не показывает ложный success при API/network error.
  - Static export/GitHub Pages удалены; Next.js работает как full-stack server runtime. FastAPI-сервис подготовлен к Vercel, fail-closed secrets и синхронной serverless обработке.
  - Локальные in-memory repositories разделяют один development state между Route Handlers и Server Components; deployed runtime без `DATABASE_URL` отклоняет любые data writes с `503`, а не показывает ложный success.
  - OpenAPI JSON/YAML синхронизированы с manager persistence routes, demo identifiers удалены из runtime examples.
  - Проверки: 70/70 TypeScript tests, локальный setup → survey → submit → locked analytics runtime smoke, 9/9 full Python pytest, 7/7 Python smoke suite, lint, Next.js production build, Prisma validate/generate.
- [x] **2026-07-24**: **Исправлено ложное demo-состояние при пустой БД и обновлён staging**:
  - Установлено две причины: staging alias указывал на старый commit `3083051`, а `getRepositories()` неявно подставлял `DEMO_ORGANIZATION` и `DEMO_ROUND` при отсутствии `DATABASE_URL`.
  - Default in-memory repositories теперь пустые; demo fixtures подключаются только явно в тестах/opt-in demo.
  - Добавлены regression tests для пустых repositories и ответа `GET /api/rounds` → `{"round":null}`.
  - Создан commit `a20ac66`, draft PR #5 и READY preview `dpl_35S9VvwN8V9Bq7da3iP2SJwT4349`.
  - Staging alias переназначен на проверенный preview. Production не изменялся.
  - Проверки: 53/53 tests, lint, production build, GitHub Build & Validate, Vercel smoke.
- [x] **2026-07-24**: **Стабилизирована сквозная AI Analytics интеграция и подключён dashboard**:
  - Добавлен общий versioned contract `contracts/ai-analytics-v1.json`; TypeScript callback отклоняет legacy/mismatched payloads и требует ровно 8 канонических измерений.
  - Python pipeline, mock MCP и intervention catalog синхронизированы с каноническими ID; рекомендации больше не переходят между измерениями.
  - `aiInsights` и `aiInsightsUpdatedAt` добавлены в Prisma; миграция `20260724170000_add_ai_insights` применена к настроенной Supabase-цели, статус проверен как up to date.
  - MCP, webhook и callback поддерживают отдельные shared secrets; mock MCP включается только явным `USE_MOCK_MCP=true`; сетевые ошибки больше не маскируются fake-success.
  - Добавлен настоящий локальный boundary E2E: Next.js MCP → Python pipeline CLI → Next.js callback → persistence GET, включая privacy-lock.
  - Dashboard detail/metrics/recommendations читает валидированные AI-инсайты и показывает loading, locked, not-found и error состояния, сохраняя `roundId` в навигации.
  - Обновлены OpenAPI JSON/YAML и README AI-сервиса; браузерно проверены ready/not-found/locked состояния.
- [x] **2026-07-24**: **Hotfix: TypeScript build ошибки в MCP Server route (`/api/mcp`)**:
  - `AnalyticsService` — статический класс. Убрали неверный `new AnalyticsService(...)`, заменили на прямой вызов статического метода `AnalyticsService.getAnalyticsForRound(roundId, roundRepo, surveyRepo)`.
  - Исправлены ключи репозитория: `repositories.rounds` → `repositories.roundRepo`, `repositories.surveys` → `repositories.surveyRepo`.
  - Убран `await` с синхронной функции `getRepositories()`.
  - `tsc --noEmit` проходит без ошибок. Изменения запушены в `feature/ai-analytics-microservice-mcp`.
- [x] **2026-07-24**: **Архитектурный аудит декаплинга AI-сервиса + Выделен `LLMProviderService`**:
  - Создан изолированный [`src/services/llm_provider.py`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/ai-analytics-service/src/services/llm_provider.py): скрывает всю токеномику, выбор модели (`gpt-4o-mini` vs `gpt-4o`), правила «0 токенов для green-измерений» и фоллбэк-генератор.
  - Узлы graph-style workflow в `nodes.py` не содержат прямых LLM API вызовов — они делегируют `LLMProviderService`.
  - Границы разделены на MCP transport, FastAPI boundary, workflow nodes, LLM provider и structured intervention catalog.
- [x] **2026-07-24**: **Оптимизация токенов: Multi-Tier Model Strategy**:
  - Правило 0 токенов для здоровых (`green`) измерений (`only_llm_for_problematic = True`).
  - Дешевая быстрая модель `gpt-4o-mini` по умолчанию (в 15 раз дешевле `gpt-4o`).
  - Лимит длины генерации `max_tokens_per_dimension = 180`.
  - Поиск рекомендаций в локальном JSON-каталоге не расходует LLM-токены.
- [x] **2026-07-24**: **Реализованы Next.js MCP Server, AI Webhook Trigger & AI Insights Callback**:
  - **MCP-compatible HTTP JSON-RPC endpoint (`/api/mcp`)**: Экспортирует `tools/list` и инструмент `get_round_analytics(roundId)`.
  - **AI Insights Callback Endpoint (`/api/rounds/[roundId]/ai-insights`)**: Принимает (`POST`) и отдает (`GET`) сгенерированный AI-микросервисом JSON-пейлоאד *"Stone Map"*.
  - **Webhook Trigger Endpoint (`/api/rounds/[roundId]/trigger-ai`)**: Генерирует и отправляет событие `{"event": "round_closed", "roundId": roundId}` на вебхук AI-сервиса.
  - **Хранилище**: Расширен контракт `IRoundRepository`; первоначальная версия хранила результат in-memory, а Prisma-персистентность добавлена в последующем stabilization slice.
  - **Автотесты**: Создан набор автотестов ([`src/app/api/__tests__/mcp-integration.test.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/__tests__/mcp-integration.test.ts)).
- [x] **2026-07-24**: **Разработан и протестирован Decoupled AI Analytics Microservice (`ai-analytics-service/`)**:
  - **Архитектура**: Изолированный Python 3.11+ микросервис на **FastAPI** с HTTP JSON-RPC MCP-клиентом и собственным асинхронным graph-style workflow.
  - **Privacy Gate**: Автоматическая блокировка анализа при `isLocked=True` (количество ответов `< 10`) для предотвращения דאנונימיזציה.
  - **Workflow**: `Privacy_Gate` -> `Agent_Psychologist` -> `Agent_Intervention` -> `Agent_Safety_Validator` (loop) -> `Stone Map Output Formatter`.
  - **Каталог рекомендаций**: Локальная структурированная база знаний с рекомендациями **OECD Wellbeing Framework** и **ISO 45003:2021** для всех 8 измерений.
  - **MCP Client & Mock Data Layer**: Реализован клиенский менеджер MCP и автономный `MockDataLayerMCPServer` для работы в оф라인/дев-режиме.
  - **Тестирование**: Создан набор тестов ([`ai-analytics-service/run_tests.py`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/ai-analytics-service/run_tests.py)); после stabilization suite содержит 7 проверок.
- [x] **2026-07-24**: **Полностью сброшены данные макета UI и счетчики главных страниц (Empty Round State)**:
  - В [`src/lib/demo-data.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/demo-data.ts) сброшены показатели организации, раунда и всех 8 измерений (0/0 השיבו עד כה, 0 מוקדי טיפול, 0 חוזקות, ציון 0).
  - Хелперы `getStatusCount()` и `overallScore` возвращают `0`, когда количество ответов ниже порога анонимности (`< 10`).
  - Дашборд `/dashboard` переведен в защищенный заблокированный режим (`DashboardMapLocked`), отображающий `0 מתוך 10 תשובות נדרשות` и кнопку запуска нового опроса.
  - Прогнаны 31/31 тестов и успешен production-билд.
- [x] **2026-07-24**: **Созданы Prisma Migrations (`0_init`) и разделены URL для Pooler/Direct соединения**:
  - Создана базовая миграция [`prisma/migrations/0_init/migration.sql`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/prisma/migrations/0_init/migration.sql).
  - Разделено подключение к БД: `DATABASE_URL` через Pooler (порт 6543, `pgbouncer=true`) для рантайма и `DIRECT_URL` (порт 5432) для DDL/миграций в [`prisma.config.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/prisma.config.ts), `.env` и `.env.local`.
  - Зафиксирован статус миграции `0_init` в БД (`npx prisma migrate resolve --applied 0_init`). Проверено статусом `Database schema is up to date!`.
  - Добавлены npm-скрипты `db:migrate:dev`, `db:migrate:deploy` и `db:status`.
- [x] **2026-07-24**: **Старт новой сессии shalomut-tracker & полная очистка продакшн-данных**:
  - Создан скрипт `scripts/clear-db.ts` и добавлен npm-скрипт `npm run db:clear`.
  - Выполнена полная очистка данных в продакшн PostgreSQL БД Supabase (`QuestionAnswer`, `SurveyResponse`, `SurveyRound`, `Organization`).
  - Проверено обнуление всех таблиц (организации: 0, раунды: 0, ответы: 0, ответы на вопросы: 0).
  - Успешно прогнаны 31/31 интеграционных и API автотестов.
- [x] **2026-07-24**: **Успешно подключена и развернута продакшн PostgreSQL БД в Supabase**:
  - Настроено подключение к Supabase (Pooler IPv4 в регионе `ap-southeast-1`) в файлах `.env` и `.env.local`.
  - Развернуты таблицы реляционной схемы (`organizations`, `survey_rounds`, `survey_responses`, `question_answers`).
  - Сгенерирован клиент Prisma Client v7 (`npx prisma generate`).
  - Проверено прямое подключение и пройдено 31/31 автотестов слоя хранения и API эндпоинтов.
- [x] **2026-07-24**: **Созданы OpenAPI 3.0 / Swagger Спецификация & Интерактивный Swagger UI (shalomut-tracker)**:
  - Разработана спецификация OpenAPI 3.0 в форматах JSON ([`public/openapi.json`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/public/openapi.json)) и YAML ([`docs/openapi.yaml`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/docs/openapi.yaml)), документирующая эндпоинты `/api/rounds`, `/api/survey/[shareCode]`, `/api/survey/[shareCode]/submit` и `/api/rounds/[roundId]/analytics`.
  - Создана страница интерактивного визуализатора Swagger UI [`src/app/api-docs/page.tsx`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api-docs/page.tsx) для онлайн тестирования и проверки схем данных.
  - Написаны автотесты целостности OpenAPI спецификации ([`src/app/api/__tests__/openapi.test.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/__tests__/openapi.test.ts)). Пройдено 31/31 тестов, успешный production-билд.
- [x] **2026-07-24**: **Исправлена ошибка GitHub Pages CI/CD пайплайна**:
  - Устранена ошибка `touch out/.nojekyll` путем добавления переменной `NEXT_EXPORT: "true"` в [.github/workflows/deploy-github-pages.yml](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/.github/workflows/deploy-github-pages.yml) и безопасного `mkdir -p out`.
  - Добавлены статические декларации роутов для `src/app/api/` для корректного статического экспорта Next.js.
  - Проведены локальные тесты (28/28 пройдено), билд замерджен и отправлен в `origin/main`.
  - Историческая запись: этот workflow позднее удалён, когда manager UI стал database-backed и приложению понадобился полноценный server runtime.
- [x] **2026-07-24**: **Реализован Prisma Persistence Layer (Слой физического хранения сырых данных)**:
  - Создана реляционная схема БД [`prisma/schema.prisma`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/prisma/schema.prisma) (`Organization`, `SurveyRound`, `SurveyResponse`, `QuestionAnswer`).
  - Создан модульный клиент БД [`src/lib/repositories/prisma/prisma-client.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/prisma/prisma-client.ts) с ленивой инициализацией.
  - Имплементированы Prisma-репозитории сырых данных: [`PrismaOrganizationRepository`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/prisma/prisma-organization.repository.ts), [`PrismaRoundRepository`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/prisma/prisma-round.repository.ts), [`PrismaSurveyRepository`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/prisma/prisma-survey.repository.ts).
  - Настроена динамическая фабрика `getRepositories()` в [`src/lib/repositories/index.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/index.ts): автоматическое переключение на Prisma при наличии `DATABASE_URL` и фоллбэк на In-Memory в режиме разработчика/демо.
  - Написаны автотесты адаптеров Prisma ([`src/lib/repositories/__tests__/prisma.test.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/__tests__/prisma.test.ts)). Пройдено 28/28 тестов, билд успешен.
- [x] **2026-07-24**: **Созданы API Routes (Next.js App Router) & Подключена UI-Интеграция**:
  - Создан эндпоинт `GET / POST /api/rounds` ([`src/app/api/rounds/route.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/rounds/route.ts)).
  - Создан эндпоинт `GET /api/survey/[shareCode]` ([`src/app/api/survey/[shareCode]/route.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/survey/%5BshareCode%5D/route.ts)).
  - Создан эндпоинт `POST /api/survey/[shareCode]/submit` ([`src/app/api/survey/[shareCode]/submit/route.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/survey/%5BshareCode%5D/submit/route.ts)).
  - Создан эндпоинт `GET /api/rounds/[roundId]/analytics` ([`src/app/api/rounds/[roundId]/analytics/route.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/rounds/%5BroundId%5D/analytics/route.ts)).
  - Интегрирована отправка формы в [`SurveyFlow`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/components/survey/survey-flow.tsx) через API эндпоинт с фоллбэком.
  - Написан комплект автотестов API Routes ([`src/app/api/__tests__/api.test.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/__tests__/api.test.ts)). Пройдено 25/25 тестов, успешный production-билд.
- [x] **2026-07-24**: **Реализован Repository Layer (Data Abstraction & In-Memory Adapters)**:
  - Созданы TypeScript-интерфейсы `IRoundRepository`, `ISurveyRepository`, `IOrganizationRepository` ([`src/lib/repositories/interfaces.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/interfaces.ts)).
  - Имплементированы in-memory адаптеры `InMemoryRoundRepository`, `InMemorySurveyRepository`, `InMemoryOrganizationRepository` с поддержкой генерации демо-семян `SHALOM-DEMO`.
  - Добавлена защита от повторной отправки ответов по анонимному хэшу токена `anonymousTokenHash`.
  - Сервисы `RoundService`, `SurveyService` и `AnalyticsService` расширены методами работы с репозиториями (`createAndSaveRound`, `submitAndSaveResponse`, `getAnalyticsForRound`).
  - Добавлены юнит- и сквозные интеграционные тесты ([`src/lib/repositories/__tests__/repositories.test.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/repositories/__tests__/repositories.test.ts)). Пройдено 20/20 тестов, билд успешен.
- [x] **2026-07-24**: **Проведен архитектурный рефакторинг компонентов и вынос утилит (shalomut-tracker)**:
  - Выделены утилиты и хуки (`src/lib/utils/math.ts`, `format.ts`, `src/lib/hooks/use-clipboard.ts`, `use-blob-fit.ts`).
  - Выделен каталог Shared UI компонентов `src/components/ui/` (`ScoreRing`, `StatusBadge`, `StatStone`, `PrivacyTooltip`, `DimensionIcon`, `ActionCard`, `PageIntro`, `MetricCard`).
  - Проведена декомпозиция монолитов `survey-builder.tsx` (20.1 KB) и `dashboard-mock.tsx` (14.2 KB) по доменам (`src/components/dashboard/`, `src/components/survey/`, `src/components/round/`, `src/components/layout/`).
  - Добавлены юнит-тесты маршрутизации и утилит (`src/lib/__tests__/navigation.test.ts`, `src/lib/utils/__tests__/math-and-format.test.ts`). Пройдено 15/15 тестов.
- [x] **2026-07-24**: **Создан Service Layer бэкенда**:
  - Созданы типы данных ([`src/lib/types/backend.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/types/backend.ts)).
  - Реализован [`AnalyticsService`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/services/analytics.service.ts) (агрегация 8 измерений, шкала 100/60/0, порог анонимности `privacyThreshold >= 10`).
  - Реализован [`SurveyService`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/services/survey.service.ts) (валидация 24 вопросов, обработка анонимных ответов).
  - Реализован [`RoundService`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/services/round.service.ts) (генерация кодов доступа `SHALOM-XXXX`, переходы статусов раундов).
  - Написаны и успешно пройдены юнит-тесты ([`src/lib/services/__tests__/analytics.service.test.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/lib/services/__tests__/analytics.service.test.ts)).
- [x] **2026-07-24**: Проект переведен из статуса «демо» в статус реального продукта (`shalomut-map`). Удалены обозначения Demo из UI copy, метаданных, `package.json`, CI/CD workflows и документации. Компонент `SurveyBuilderDemo` переименован в `SurveyBuilder`.
- [x] **2026-07-24**: Все изменения редизайна и конфигурации деплоя замерджены в ветку `main` и запушены в `origin/main`.
- [x] **2026-07-24**: Разделены деплой-окружения (`stg` на `https://shalomut-map-demo-ui-redesign.vercel.app/` с авто-деплоем из `main` и `prod` с ручным деплоем по указанию). Настроен пайплайн GitHub Actions ([.github/workflows/deploy-vercel.yml](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/.github/workflows/deploy-vercel.yml)).
- [x] **2026-07-24**: Составлен и зафиксирован спецификационный документ бэкенда и моделей данных ([docs/data-layer-and-backend-plan.md](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/docs/data-layer-and-backend-plan.md)).
- [x] **2026-07-24**: Выделен канонический источник методологии опроса в `src/lib/shalomut-source.ts` (8 измерений, 24 вопроса, пороговые значения баллов).
- [x] **2026-07-24**: Добавлен стек шрифтов для иврита (`Arial`, `Noto Sans Hebrew`) и сглаживание шрифтов.
- [x] **2026-07-24**: Настроен `clamp()` для адаптивной типографики заголовков.
- [x] **2026-07-24**: Исправлен контраст текста на камнях статуса (соответствие WCAG AA, замена белого текста на `--ink`).
- [x] **2026-07-24**: Инициализирован файл памяти сессий `PROGRESS.md` и `PROJECT_CONTEXT.md`.

---

## ⚠️ Известные вопросы и заметки
- При добавлении новых вариантов камней сохранять контраст инкового текста (`#383838`) к фону камня не менее 4.5:1.
- Результаты опроса должны оставаться заблокированными на уровне бэкенда (`isLocked: true`), если количество респондентов в раунде менее `privacyThreshold` (по умолчанию 10).
