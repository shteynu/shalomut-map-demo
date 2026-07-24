# PROGRESS: Shalomut Map

## 📌 Текущий статус
- **Текущий этап**: Дизайн-система, RTL-типографика, WCAG AA доступность, каноническая методология (8 измерений, 24 вопроса) и статус полноценного реального проекта зафиксированы. Разработан план бэкенда и слоя данных.
- **Главная цель**: Переход от базовой интеграции фронтенда к реализации Data Layer (модели данных, агрегация баллов, анонимное сохранение ответов) и бэкенд-сервисов.

---

## 🚀 Следующие шаги (Next Up: Data Layer & Backend Phase)
1. [ ] **Выбор и настройка ORM/Persistence**: Подключение Prisma ORM / PostgreSQL / Supabase для постоянного хранения.
2. [ ] **Интеграция API Routes / Server Actions**: Подключение `SurveyService` и `AnalyticsService` к API эндпоинтам (`/api/survey/submit`, `/api/rounds/[id]/analytics`).
3. [ ] **Интеграция с UI**: Замена захардкоженного демо-состояния в `src/components/dashboard-map-interactive.tsx` и `src/components/survey-flow.tsx` на вызовы реального бэкенда.

---

## ✅ Завершенные задачи (Completed)
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

