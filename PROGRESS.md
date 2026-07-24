# PROGRESS: Shalomut Map

## 📌 Текущий статус
- **Текущий этап**: Data Layer & Persistence Phase — Схема Prisma (`schema.prisma`), Prisma-репозитории и адаптеры слоя физического хранения сырых данных полностью реализованы.
- **Главная цель**: Все механизмы хранения и работы с сырыми данными готовы для подключения внешнего AI-сервиса и продакшн PostgreSQL/Supabase БД.

---

## 🚀 Следующие шаги (Next Up: External AI Integration & Production DB Connection)
1. [ ] **Подключение реальной PostgreSQL / Supabase базы**: Установка `DATABASE_URL` в окружении и выполнение `npx prisma db push`.
2. [ ] **Интеграция с внешним AI-сервисом**: Чтение сырых данных из Data Layer внешним AI-агентом для генерации текстовых отчетов и умных рекомендаций.

---

## ✅ Завершенные задачи (Completed)
- [x] **2026-07-24**: **Созданы OpenAPI 3.0 / Swagger Спецификация & Интерактивный Swagger UI (shalomut-tracker)**:
  - Разработана спецификация OpenAPI 3.0 в форматах JSON ([`public/openapi.json`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/public/openapi.json)) и YAML ([`docs/openapi.yaml`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/docs/openapi.yaml)), документирующая эндпоинты `/api/rounds`, `/api/survey/[shareCode]`, `/api/survey/[shareCode]/submit` и `/api/rounds/[roundId]/analytics`.
  - Создана страница интерактивного визуализатора Swagger UI [`src/app/api-docs/page.tsx`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api-docs/page.tsx) для онлайн тестирования и проверки схем данных.
  - Написаны автотесты целостности OpenAPI спецификации ([`src/app/api/__tests__/openapi.test.ts`](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/src/app/api/__tests__/openapi.test.ts)). Пройдено 31/31 тестов, успешный production-билд.
- [x] **2026-07-24**: **Исправлена ошибка GitHub Pages CI/CD пайплайна**:
  - Устранена ошибка `touch out/.nojekyll` путем добавления переменной `NEXT_EXPORT: "true"` в [.github/workflows/deploy-github-pages.yml](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/.github/workflows/deploy-github-pages.yml) и безопасного `mkdir -p out`.
  - Добавлены статические декларации роутов для `src/app/api/` для корректного статического экспорта Next.js.
  - Проведены локальные тесты (28/28 пройдено), билд замерджен и отправлен в `origin/main`.
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

